import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, type Database } from "../db/client.js";
import { schema } from "../db/client.js";
import { resolveUserCredentials, upsertUserCredentials, getCredentialsStatus } from "./resolve.js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/video_builder";
const MASTER_KEY = randomBytes(32).toString("base64");

let db: Database | undefined;
let dbAvailable = false;
try {
  db = createDb(DATABASE_URL);
  await db.select().from(schema.users).limit(1);
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

/** Same real-Postgres-or-skip pattern as apps/worker/src/pipeline-runner.test.ts
 * -- Drizzle upserts and env fallback aren't worth faithfully hand-mocking. */
describe.skipIf(!dbAvailable)("user credentials (against a real Postgres)", () => {
  let userId: string;

  beforeEach(async () => {
    if (!db) return;
    const [user] = await db
      .insert(schema.users)
      .values({ email: `creds-test-${Date.now()}-${Math.random()}@test.dev`, credits: 5 })
      .returning();
    userId = user!.id;
  });

  afterEach(async () => {
    if (!db) return;
    await db.delete(schema.userCredentials).where(eq(schema.userCredentials.userId, userId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("falls back to env vars when the user hasn't set anything", async () => {
    if (!db) return;
    const original = process.env.PEXELS_API_KEY;
    process.env.PEXELS_API_KEY = "env-default-pexels-key";
    try {
      const resolved = await resolveUserCredentials(db, userId, MASTER_KEY);
      expect(resolved.pexelsApiKey).toBe("env-default-pexels-key");
    } finally {
      process.env.PEXELS_API_KEY = original;
    }
  });

  it("prefers the user's own key over the env default once set", async () => {
    if (!db) return;
    const original = process.env.PEXELS_API_KEY;
    process.env.PEXELS_API_KEY = "env-default-pexels-key";
    try {
      await upsertUserCredentials(db, userId, MASTER_KEY, { pexelsApiKey: "user-own-pexels-key" });
      const resolved = await resolveUserCredentials(db, userId, MASTER_KEY);
      expect(resolved.pexelsApiKey).toBe("user-own-pexels-key");
    } finally {
      process.env.PEXELS_API_KEY = original;
    }
  });

  it("never stores the plaintext key in the database row", async () => {
    if (!db) return;
    await upsertUserCredentials(db, userId, MASTER_KEY, { openrouterApiKey: "sk-my-secret-key" });
    const row = await db.query.userCredentials.findFirst({
      where: eq(schema.userCredentials.userId, userId),
    });
    expect(row?.openrouterApiKeyEnc).toBeTruthy();
    expect(row?.openrouterApiKeyEnc).not.toContain("sk-my-secret-key");
  });

  it("clearing a field (null) falls back to the env default again", async () => {
    if (!db) return;
    const original = process.env.AZURE_SPEECH_KEY;
    process.env.AZURE_SPEECH_KEY = "env-default-azure-key";
    try {
      await upsertUserCredentials(db, userId, MASTER_KEY, { azureSpeechKey: "user-azure-key" });
      expect((await resolveUserCredentials(db, userId, MASTER_KEY)).azureSpeechKey).toBe(
        "user-azure-key",
      );

      await upsertUserCredentials(db, userId, MASTER_KEY, { azureSpeechKey: null });
      expect((await resolveUserCredentials(db, userId, MASTER_KEY)).azureSpeechKey).toBe(
        "env-default-azure-key",
      );
    } finally {
      process.env.AZURE_SPEECH_KEY = original;
    }
  });

  it("leaves fields not mentioned in the update untouched", async () => {
    if (!db) return;
    await upsertUserCredentials(db, userId, MASTER_KEY, {
      pexelsApiKey: "pexels-key",
      pixabayApiKey: "pixabay-key",
    });
    await upsertUserCredentials(db, userId, MASTER_KEY, { pexelsApiKey: "updated-pexels-key" });

    const resolved = await resolveUserCredentials(db, userId, MASTER_KEY);
    expect(resolved.pexelsApiKey).toBe("updated-pexels-key");
    expect(resolved.pixabayApiKey).toBe("pixabay-key");
  });

  it("reports credential status without leaking secret values", async () => {
    if (!db) return;
    await upsertUserCredentials(db, userId, MASTER_KEY, {
      openrouterApiKey: "sk-abc",
      r2Bucket: "my-bucket",
    });
    const status = await getCredentialsStatus(db, userId);
    expect(status.openrouterApiKeySet).toBe(true);
    expect(status.pexelsApiKeySet).toBe(false);
    expect(status.r2Bucket).toBe("my-bucket");
    expect(JSON.stringify(status)).not.toContain("sk-abc");
  });
});
