import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import {
  createDb,
  RENDER_QUEUE_NAME,
  type RenderJobData,
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

const db = createDb(env.DATABASE_URL);
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const r2Client: S3Client | undefined =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET
    ? createR2Client({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
      })
    : undefined;

// Asset cache backend: R2 in production once configured, local disk
// otherwise -- same AssetCache/AssetStorage interface from phase 2, so
// nothing above it changes.
const assetCache = new AssetCache(
  r2Client && env.R2_BUCKET
    ? new R2AssetStorage(r2Client, env.R2_BUCKET)
    : new LocalAssetStorage(path.join(os.tmpdir(), "video-builder-asset-cache")),
);

async function uploadOutput(localPath: string, key: string): Promise<string> {
  if (!r2Client || !env.R2_BUCKET) {
    console.warn(
      `[worker] R2 is not configured; leaving rendered output at ${localPath} instead of uploading to ${key}`,
    );
    return localPath;
  }
  const body = await readFile(localPath);
  await r2Client.send(
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: "video/mp4" }),
  );
  return key;
}

const worker = new Worker<RenderJobData>(
  RENDER_QUEUE_NAME,
  async (job: Job<RenderJobData>) => {
    const { renderId } = job.data;
    const workDir = path.join(os.tmpdir(), "video-builder-renders", renderId);

    try {
      await runRenderPipeline(renderId, {
        db,
        pexels: new PexelsClient(env.PEXELS_API_KEY ?? ""),
        pixabay: new PixabayClient(env.PIXABAY_API_KEY ?? ""),
        assetCache,
        ttsProvider: new AzureTTSProvider(env.AZURE_SPEECH_KEY ?? "", env.AZURE_SPEECH_REGION ?? ""),
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
