import path from "node:path";
import { mkdir } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import {
  schema,
  type Database,
  VideoScriptSchema,
  selectFootage,
  synthesizeVoiceover,
  AssetCache,
  type FootageProviderClient,
  type TTSProvider,
  type AudioProcessor,
  RENDER_STAGES,
  type RenderStage,
} from "@video-builder/core";
import { renderVideo, type TemplateName, type RenderVideoProps } from "@video-builder/video";

const CREDITS_PER_RENDER = 1;
const COST_PER_SCENE_CENTS = 3;

export interface RenderPipelineDeps {
  db: Database;
  pexels: FootageProviderClient;
  pixabay: FootageProviderClient;
  assetCache: AssetCache;
  ttsProvider: TTSProvider;
  audioProcessor: AudioProcessor;
  voice: string;
  renderVideoFn: typeof renderVideo;
  uploadOutput: (localPath: string, key: string) => Promise<string>;
  workDir: string;
  onProgress?: (stage: RenderStage, percent: number) => Promise<void> | void;
}

const STAGE_PERCENT: Record<RenderStage, number> = {
  script: 5,
  footage: 25,
  voice: 55,
  compose: 65,
  encode: 90,
  upload: 100,
};

function toneToTemplate(tone: string): TemplateName {
  if (tone === "energetic") return "energetic";
  if (tone === "professional") return "professional";
  return "calm";
}

async function reportProgress(
  deps: RenderPipelineDeps,
  renderId: string,
  stage: RenderStage,
): Promise<void> {
  const percent = STAGE_PERCENT[stage];
  await deps.db
    .update(schema.renders)
    .set({ stage, percent })
    .where(eq(schema.renders.id, renderId));
  await deps.onProgress?.(stage, percent);
}

/**
 * Runs the full render pipeline for one render row: script -> footage ->
 * voice -> compose -> encode -> upload. Throws on any stage failure; the
 * caller (apps/worker/src/index.ts) decides whether to let BullMQ retry or
 * to mark the render permanently failed, based on the job's attempt count.
 */
export async function runRenderPipeline(renderId: string, deps: RenderPipelineDeps): Promise<void> {
  const startedAt = new Date();
  await deps.db
    .update(schema.renders)
    .set({ status: "running", startedAt })
    .where(eq(schema.renders.id, renderId));

  const render = await deps.db.query.renders.findFirst({ where: eq(schema.renders.id, renderId) });
  if (!render) throw new Error(`render ${renderId} not found`);

  const project = await deps.db.query.projects.findFirst({
    where: eq(schema.projects.id, render.projectId),
  });
  if (!project) throw new Error(`project ${render.projectId} not found for render ${renderId}`);

  // --- stage: script ---------------------------------------------------
  await reportProgress(deps, renderId, "script");
  const script = VideoScriptSchema.parse(project.scriptJson);

  await mkdir(deps.workDir, { recursive: true });

  // --- stage: footage ----------------------------------------------------
  await reportProgress(deps, renderId, "footage");
  const format = project.format as RenderVideoProps["format"];
  const footageResults = await selectFootage(script, {
    format,
    pexels: deps.pexels,
    pixabay: deps.pixabay,
    cache: deps.assetCache,
  });

  for (const f of footageResults) {
    await deps.db.insert(schema.sceneAssets).values({
      renderId,
      sceneId: f.sceneId,
      footageProvider: f.footage.kind === "clip" ? f.footage.provider : null,
      footageAssetId: f.footage.kind === "clip" ? f.footage.providerAssetId : null,
      footageUrl: f.footage.kind === "clip" ? f.footage.fileUrl : null,
      fallbackLevel: f.fallbackLevel,
    });
  }

  // --- stage: voice --------------------------------------------------
  await reportProgress(deps, renderId, "voice");
  const audioDir = path.join(deps.workDir, "audio");
  await mkdir(audioDir, { recursive: true });
  const voiceResult = await synthesizeVoiceover(script, {
    provider: deps.ttsProvider,
    audioProcessor: deps.audioProcessor,
    outDir: audioDir,
    voice: deps.voice,
  });

  for (const scene of voiceResult.scenes) {
    await deps.db
      .update(schema.sceneAssets)
      .set({ audioPath: scene.audioPath, durationMs: scene.durationMs })
      .where(
        sql`${schema.sceneAssets.renderId} = ${renderId} AND ${schema.sceneAssets.sceneId} = ${scene.sceneId}`,
      );
  }

  // --- stage: compose --------------------------------------------------
  await reportProgress(deps, renderId, "compose");
  const audioBySceneId = new Map(voiceResult.scenes.map((s) => [s.sceneId, s]));
  const footageBySceneId = new Map(footageResults.map((f) => [f.sceneId, f.footage]));

  const renderProps: RenderVideoProps = {
    title: voiceResult.script.title,
    template: toneToTemplate(project.tone),
    format,
    musicMood: voiceResult.script.musicMood,
    watermark: true,
    scenes: voiceResult.script.scenes.map((scene) => {
      const audio = audioBySceneId.get(scene.id);
      const footage = footageBySceneId.get(scene.id);
      if (!audio || !footage) {
        throw new Error(`missing footage/audio for scene ${scene.id}`);
      }
      return { scene, footage, audio: { audioPath: audio.audioPath, durationMs: audio.durationMs, words: audio.words } };
    }),
  };

  // --- stage: encode -----------------------------------------------------
  await reportProgress(deps, renderId, "encode");
  const videoOutDir = path.join(deps.workDir, "video");
  const outputPath = await deps.renderVideoFn(renderProps, { outDir: videoOutDir });

  // --- stage: upload -----------------------------------------------------
  await reportProgress(deps, renderId, "upload");
  const storageKey = await deps.uploadOutput(outputPath, `renders/${renderId}.mp4`);

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const costCents = script.scenes.length * COST_PER_SCENE_CENTS;

  await deps.db.transaction(async (tx) => {
    await tx
      .update(schema.renders)
      .set({
        status: "succeeded",
        stage: "upload",
        percent: 100,
        outputUrl: storageKey,
        durationMs,
        costCents,
        creditsCharged: CREDITS_PER_RENDER,
        finishedAt,
      })
      .where(eq(schema.renders.id, renderId));

    // Credits are deducted on SUCCESS only, never on enqueue.
    await tx
      .update(schema.users)
      .set({ credits: sql`${schema.users.credits} - ${CREDITS_PER_RENDER}` })
      .where(eq(schema.users.id, render.userId));

    await tx.insert(schema.usageEvents).values({
      userId: render.userId,
      type: "render_succeeded",
      creditsDelta: -CREDITS_PER_RENDER,
      renderId,
      metadataJson: { durationMs, costCents, stages: RENDER_STAGES },
    });
  });

  console.log(
    `[worker] render ${renderId} succeeded in ${durationMs}ms, estimated cost ${costCents}c`,
  );
}

/**
 * Marks a render permanently failed after the retry budget is exhausted.
 * Nothing is charged until success (see runRenderPipeline), so there is no
 * credit hold to release -- the "refund" is simply never charging the user
 * for a render that didn't complete.
 */
export async function markRenderFailed(
  db: Database,
  renderId: string,
  errorMessage: string,
): Promise<void> {
  const render = await db.query.renders.findFirst({ where: eq(schema.renders.id, renderId) });
  if (!render) return;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.renders)
      .set({ status: "failed", errorMessage, finishedAt: new Date() })
      .where(eq(schema.renders.id, renderId));

    await tx.insert(schema.usageEvents).values({
      userId: render.userId,
      type: "render_failed",
      creditsDelta: 0,
      renderId,
      metadataJson: { errorMessage },
    });
  });
}
