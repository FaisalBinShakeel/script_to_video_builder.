import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, schema, AssetCache, type Database } from "@video-builder/core";
import { runRenderPipeline, markRenderFailed } from "./pipeline-runner.js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/video_builder";

/**
 * This suite exercises the worker's DB orchestration (stage transitions,
 * scene_assets writes, credit deduction on success, failure bookkeeping)
 * against a REAL Postgres instead of a hand-rolled fake -- Drizzle's fluent
 * query builder isn't practical to mock faithfully. It requires a reachable
 * DATABASE_URL (e.g. `pnpm docker:up`); when one isn't available the whole
 * suite is skipped rather than failing, so `pnpm test` still passes in
 * environments without Postgres running. The availability probe runs at
 * module load (top-level await) since describe.skipIf needs the answer
 * before any test is collected -- a beforeAll runs too late for that.
 */
let db: Database | undefined;
let dbAvailable = false;
try {
  db = createDb(DATABASE_URL);
  await db.select().from(schema.users).limit(1);
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const sampleScript = {
  title: "5 Benefits of Green Tea",
  language: "en" as const,
  tone: "energetic" as const,
  musicMood: "upbeat" as const,
  estimatedDuration: 9,
  scenes: [
    {
      id: 1,
      narration: "Green tea boosts your metabolism.",
      onScreenText: "Boost metabolism",
      searchKeywords: ["green tea cup", "person drinking tea"],
      duration: 3,
      emphasis: "hook" as const,
    },
    {
      id: 2,
      narration: "It's packed with antioxidants.",
      onScreenText: "Antioxidants",
      searchKeywords: ["tea leaves closeup", "person pouring tea"],
      duration: 3,
      emphasis: "normal" as const,
    },
    {
      id: 3,
      narration: "Try one cup a day.",
      onScreenText: "Start today",
      searchKeywords: ["tea cup table", "person smiling tea"],
      duration: 3,
      emphasis: "cta" as const,
    },
  ],
};

async function seedUserAndProject(db: Database, emailSuffix: string, credits = 10) {
  const [user] = await db
    .insert(schema.users)
    .values({ email: `worker-test-${emailSuffix}@test.dev`, credits })
    .returning();
  if (!user) throw new Error("failed to seed user");

  const [project] = await db
    .insert(schema.projects)
    .values({
      userId: user.id,
      title: sampleScript.title,
      topic: "green tea",
      format: "portrait",
      language: "en",
      tone: "energetic",
      musicMood: "upbeat",
      status: "draft",
      scriptJson: sampleScript,
    })
    .returning();
  if (!project) throw new Error("failed to seed project");

  const [render] = await db
    .insert(schema.renders)
    .values({ projectId: project.id, userId: user.id, status: "queued", percent: 0 })
    .returning();
  if (!render) throw new Error("failed to seed render");

  return { user, project, render };
}

async function cleanup(db: Database, userId: string) {
  await db.delete(schema.usageEvents).where(eq(schema.usageEvents.userId, userId));
  const renders = await db.select().from(schema.renders).where(eq(schema.renders.userId, userId));
  for (const r of renders) {
    await db.delete(schema.sceneAssets).where(eq(schema.sceneAssets.renderId, r.id));
  }
  await db.delete(schema.renders).where(eq(schema.renders.userId, userId));
  await db.delete(schema.projects).where(eq(schema.projects.userId, userId));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

function fakeFootageClient() {
  return { name: "pexels" as const, search: vi.fn(async () => []) };
}

function fakeTtsProvider() {
  return {
    synthesizeScene: vi.fn(async (input: { sceneId: number; outputPath: string }) => ({
      sceneId: input.sceneId,
      audioPath: input.outputPath,
      durationMs: 3000,
      words: [{ text: "word", startMs: 0, endMs: 500 }],
    })),
  };
}

function fakeAudioProcessor() {
  return { normalizeLoudness: vi.fn(async () => {}) };
}

describe.skipIf(!dbAvailable)("runRenderPipeline (against a real Postgres)", () => {
  it("runs script->footage->voice->compose->encode->upload, charges one credit, and logs a success event", async () => {
    if (!dbAvailable || !db) return;
    const database = db;
    const { user, render } = await seedUserAndProject(database, "success");

    try {
      const uploadOutput = vi.fn(async (_local: string, key: string) => key);
      const renderVideoFn = vi.fn(async () => "/tmp/fake-output.mp4");

      await runRenderPipeline(render.id, {
        db: database,
        pexels: fakeFootageClient(),
        pixabay: fakeFootageClient(),
        assetCache: new AssetCache({
          has: async () => false,
          put: async (key) => ({ key, url: key }),
        }),
        ttsProvider: fakeTtsProvider(),
        audioProcessor: fakeAudioProcessor(),
        voice: "en-US-JennyNeural",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderVideoFn: renderVideoFn as any,
        uploadOutput,
        workDir: `/tmp/video-builder-test-${render.id}`,
      });

      const updated = await database.query.renders.findFirst({
        where: eq(schema.renders.id, render.id),
      });
      expect(updated?.status).toBe("succeeded");
      expect(updated?.percent).toBe(100);
      expect(updated?.outputUrl).toBe(`renders/${render.id}.mp4`);
      expect(updated?.creditsCharged).toBe(1);

      const sceneAssets = await database
        .select()
        .from(schema.sceneAssets)
        .where(eq(schema.sceneAssets.renderId, render.id));
      expect(sceneAssets).toHaveLength(3);
      expect(sceneAssets.every((s) => s.fallbackLevel === "d")).toBe(true);
      expect(sceneAssets.every((s) => s.durationMs === 3000)).toBe(true);

      const updatedUser = await database.query.users.findFirst({ where: eq(schema.users.id, user.id) });
      expect(updatedUser?.credits).toBe(9); // 10 - 1

      const events = await database
        .select()
        .from(schema.usageEvents)
        .where(eq(schema.usageEvents.userId, user.id));
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("render_succeeded");
      expect(events[0]?.creditsDelta).toBe(-1);

      expect(renderVideoFn).toHaveBeenCalledTimes(1);
      expect(uploadOutput).toHaveBeenCalledWith("/tmp/fake-output.mp4", `renders/${render.id}.mp4`);
    } finally {
      await cleanup(database, user.id);
    }
  });

  it("marks the render failed and charges nothing when the pipeline throws on the last attempt", async () => {
    if (!dbAvailable || !db) return;
    const database = db;
    const { user, render } = await seedUserAndProject(database, "failure");

    try {
      const failingTts = {
        synthesizeScene: vi.fn(async () => {
          throw new Error("Azure TTS unavailable");
        }),
      };

      await expect(
        runRenderPipeline(render.id, {
          db: database,
          pexels: fakeFootageClient(),
          pixabay: fakeFootageClient(),
          assetCache: new AssetCache({
            has: async () => false,
            put: async (key) => ({ key, url: key }),
          }),
          ttsProvider: failingTts,
          audioProcessor: fakeAudioProcessor(),
          voice: "en-US-JennyNeural",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          renderVideoFn: vi.fn() as any,
          uploadOutput: vi.fn(),
          workDir: `/tmp/video-builder-test-${render.id}`,
        }),
      ).rejects.toThrow("Azure TTS unavailable");

      await markRenderFailed(database, render.id, "Azure TTS unavailable");

      const updated = await database.query.renders.findFirst({
        where: eq(schema.renders.id, render.id),
      });
      expect(updated?.status).toBe("failed");
      expect(updated?.errorMessage).toBe("Azure TTS unavailable");

      const updatedUser = await database.query.users.findFirst({ where: eq(schema.users.id, user.id) });
      expect(updatedUser?.credits).toBe(10); // unchanged -- never charged

      const events = await database
        .select()
        .from(schema.usageEvents)
        .where(eq(schema.usageEvents.userId, user.id));
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe("render_failed");
      expect(events[0]?.creditsDelta).toBe(0);
    } finally {
      await cleanup(database, user.id);
    }
  });
});
