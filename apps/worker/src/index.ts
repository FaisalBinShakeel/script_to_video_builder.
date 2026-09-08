import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import {
  createDb,
  schema,
  RENDER_QUEUE_NAME,
  type RenderJobData,
  resolveUserCredentials,
  type ResolvedCredentials,
  AssetCache,
  LocalAssetStorage,
  R2AssetStorage,
  createR2Client,
  PexelsClient,
  PixabayClient,
  AzureTTSProvider,
  FfmpegAudioProcessor,
} from "@video-builder/core";
import { renderVideo } from "@video-builder/video";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";
import { runRenderPipeline, markRenderFailed } from "./pipeline-runner.js";

const MAX_ATTEMPTS = 2;
const LOCAL_ASSET_CACHE_DIR = path.join(os.tmpdir(), "video-builder-asset-cache");

const db = createDb(env.DATABASE_URL);
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/** Every render can be owned by a different user with different provider
 * keys (Settings > API Keys), so the R2 client, asset cache, and upload
 * function are all built fresh per job from that user's resolved
 * credentials -- never from a single module-level default. */
function buildUploadOutput(
  credentials: ResolvedCredentials,
): { r2Client?: S3Client; uploadOutput: (localPath: string, key: string) => Promise<string> } {
  const r2Client =
    credentials.r2AccountId && credentials.r2AccessKeyId && credentials.r2SecretAccessKey && credentials.r2Bucket
      ? createR2Client({
          accountId: credentials.r2AccountId,
          accessKeyId: credentials.r2AccessKeyId,
          secretAccessKey: credentials.r2SecretAccessKey,
          bucket: credentials.r2Bucket,
        })
      : undefined;

  async function uploadOutput(localPath: string, key: string): Promise<string> {
    if (!r2Client || !credentials.r2Bucket) {
      console.warn(
        `[worker] R2 is not configured for this user; leaving rendered output at ${localPath} instead of uploading to ${key}`,
      );
      return localPath;
    }
    const body = await readFile(localPath);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: credentials.r2Bucket,
        Key: key,
        Body: body,
        ContentType: "video/mp4",
      }),
    );
    return key;
  }

  return { r2Client, uploadOutput };
}

const worker = new Worker<RenderJobData>(
  RENDER_QUEUE_NAME,
  async (job: Job<RenderJobData>) => {
    const { renderId } = job.data;
    const workDir = path.join(os.tmpdir(), "video-builder-renders", renderId);

    try {
      const render = await db.query.renders.findFirst({ where: eq(schema.renders.id, renderId) });
      if (!render) throw new Error(`render ${renderId} not found`);

      const credentials = await resolveUserCredentials(
        db,
        render.userId,
        env.CREDENTIALS_ENCRYPTION_KEY,
      );

      const { r2Client, uploadOutput } = buildUploadOutput(credentials);
      const assetCache = new AssetCache(
        r2Client && credentials.r2Bucket
          ? new R2AssetStorage(r2Client, credentials.r2Bucket)
          : new LocalAssetStorage(LOCAL_ASSET_CACHE_DIR),
      );

      await runRenderPipeline(renderId, {
        db,
        pexels: new PexelsClient(credentials.pexelsApiKey ?? ""),
        pixabay: new PixabayClient(credentials.pixabayApiKey ?? ""),
        assetCache,
        ttsProvider: new AzureTTSProvider(
          credentials.azureSpeechKey ?? "",
          credentials.azureSpeechRegion ?? "",
        ),
        audioProcessor: new FfmpegAudioProcessor(),
        voice: "en-US-JennyNeural",
        renderVideoFn: renderVideo,
        uploadOutput,
        workDir,
        onProgress: (stage, percent) => job.updateProgress({ stage, percent }),
      });
    } catch (err) {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? MAX_ATTEMPTS);
      if (isLastAttempt) {
        const message = err instanceof Error ? err.message : String(err);
        await markRenderFailed(db, renderId, message);
      }
      throw err;
    }
  },
  { connection, concurrency: env.RENDER_WORKER_CONCURRENCY },
);

worker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
worker.on("failed", (job, err) =>
  console.error(`[worker] job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message),
);

console.log(`[worker] listening on queue "${RENDER_QUEUE_NAME}" (concurrency=${env.RENDER_WORKER_CONCURRENCY})`);
