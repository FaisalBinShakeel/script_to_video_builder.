import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  createDb,
  RENDER_QUEUE_NAME,
  type Database,
  type RenderJobData,
} from "@video-builder/core";
import { createLucia, type AppLucia } from "./auth/lucia.js";
import { env } from "./env.js";

export interface AppContext {
  db: Database;
  lucia: AppLucia;
  redis: Redis;
  renderQueue: Queue<RenderJobData>;
}

export function createContext(): AppContext {
  const db = createDb(env.DATABASE_URL);
  const lucia = createLucia(db);
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const renderQueue = new Queue<RenderJobData>(RENDER_QUEUE_NAME, { connection: redis });
  return { db, lucia, redis, renderQueue };
}
