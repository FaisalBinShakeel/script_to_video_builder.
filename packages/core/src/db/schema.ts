import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const renderStatusValues = ["queued", "running", "succeeded", "failed"] as const;
export type RenderStatus = (typeof renderStatusValues)[number];

export const fallbackLevelValues = ["a", "b", "c", "d"] as const;
export type FallbackLevelValue = (typeof fallbackLevelValues)[number];

export const usageEventTypeValues = [
  "render_started",
  "render_succeeded",
  "render_failed",
  "credit_purchase",
  "credit_refund",
] as const;
export type UsageEventType = (typeof usageEventTypeValues)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  googleId: text("google_id"),
  name: text("name"),
  credits: integer("credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

/** Not one of the PRD's core 8 domain tables, but required for Lucia
 * session-cookie auth to function -- sessions are an auth implementation
 * detail, not a product entity. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Per-user provider API keys, set from the web app's Settings > API Keys
 * panel instead of the server .env. Secret fields are stored as opaque
 * ciphertext (see packages/core/src/crypto/secret-box.ts) -- this table
 * never holds a plaintext key. Non-secret fields (regions, bucket names)
 * are stored as plain text since they aren't sensitive on their own.
 * A null column means "not set", in which case the pipeline falls back to
 * the server's own environment variables (the previous, admin-only mode).
 */
export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  openrouterApiKeyEnc: text("openrouter_api_key_enc"),
  pexelsApiKeyEnc: text("pexels_api_key_enc"),
  pixabayApiKeyEnc: text("pixabay_api_key_enc"),
  azureSpeechKeyEnc: text("azure_speech_key_enc"),
  azureSpeechRegion: text("azure_speech_region"),
  r2AccountIdEnc: text("r2_account_id_enc"),
  r2AccessKeyIdEnc: text("r2_access_key_id_enc"),
  r2SecretAccessKeyEnc: text("r2_secret_access_key_enc"),
  r2Bucket: text("r2_bucket"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandKits = pgTable("brand_kits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  font: text("font"),
  logoUrl: text("logo_url"),
  watermarkEnabled: boolean("watermark_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  brandKitId: uuid("brand_kit_id").references(() => brandKits.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  format: text("format").notNull(),
  language: text("language").notNull(),
  tone: text("tone").notNull(),
  musicMood: text("music_mood").notNull(),
  status: text("status").notNull().default("draft"),
  scriptJson: jsonb("script_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const renders = pgTable("renders", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  stage: text("stage"),
  percent: integer("percent").notNull().default(0),
  outputUrl: text("output_url"),
  errorMessage: text("error_message"),
  costCents: integer("cost_cents"),
  durationMs: integer("duration_ms"),
  creditsCharged: integer("credits_charged"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const sceneAssets = pgTable("scene_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  renderId: uuid("render_id").notNull().references(() => renders.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id").notNull(),
  footageProvider: text("footage_provider"),
  footageAssetId: text("footage_asset_id"),
  footageUrl: text("footage_url"),
  fallbackLevel: text("fallback_level"),
  audioPath: text("audio_path"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assetCache = pgTable("asset_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  providerAssetId: text("provider_asset_id").notNull(),
  storageKey: text("storage_key").notNull(),
  localPath: text("local_path"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("asset_cache_provider_asset_idx").on(table.provider, table.providerAssetId),
]);

export const musicTracks = pgTable("music_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  mood: text("mood").notNull(),
  title: text("title").notNull(),
  storageKey: text("storage_key").notNull(),
  durationMs: integer("duration_ms"),
  license: text("license"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  creditsDelta: integer("credits_delta").notNull(),
  renderId: uuid("render_id").references(() => renders.id, { onDelete: "set null" }),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  brandKits: many(brandKits),
  projects: many(projects),
  renders: many(renders),
  usageEvents: many(usageEvents),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  brandKit: one(brandKits, { fields: [projects.brandKitId], references: [brandKits.id] }),
  renders: many(renders),
}));

export const rendersRelations = relations(renders, ({ one, many }) => ({
  project: one(projects, { fields: [renders.projectId], references: [projects.id] }),
  user: one(users, { fields: [renders.userId], references: [users.id] }),
  sceneAssets: many(sceneAssets),
}));

export const sceneAssetsRelations = relations(sceneAssets, ({ one }) => ({
  render: one(renders, { fields: [sceneAssets.renderId], references: [renders.id] }),
}));
