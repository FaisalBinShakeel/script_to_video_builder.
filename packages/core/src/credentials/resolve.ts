import { eq } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "../crypto/secret-box.js";
import { schema, type Database } from "../db/client.js";

/** Plaintext credentials as used by the pipeline -- never persisted in this
 * shape, only ever held in memory for the duration of one script/render. */
export interface ResolvedCredentials {
  openrouterApiKey?: string;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  azureSpeechKey?: string;
  azureSpeechRegion?: string;
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
}

/** Input to upsertUserCredentials: a string sets/replaces the field, null
 * clears it (falling back to the server's own env var), undefined leaves it
 * unchanged. */
export interface CredentialsInput {
  openrouterApiKey?: string | null;
  pexelsApiKey?: string | null;
  pixabayApiKey?: string | null;
  azureSpeechKey?: string | null;
  azureSpeechRegion?: string | null;
  r2AccountId?: string | null;
  r2AccessKeyId?: string | null;
  r2SecretAccessKey?: string | null;
  r2Bucket?: string | null;
}

/** What the settings UI shows: whether each secret is configured (never
 * the value itself), plus the actual value for non-secret fields. */
export interface CredentialsStatus {
  openrouterApiKeySet: boolean;
  pexelsApiKeySet: boolean;
  pixabayApiKeySet: boolean;
  azureSpeechKeySet: boolean;
  azureSpeechRegion: string | null;
  r2AccountIdSet: boolean;
  r2AccessKeyIdSet: boolean;
  r2SecretAccessKeySet: boolean;
  r2Bucket: string | null;
}

function decryptOr(
  encrypted: string | null | undefined,
  masterKey: string,
  envFallback: string | undefined,
): string | undefined {
  if (encrypted) return decryptSecret(encrypted, masterKey);
  return envFallback || undefined;
}

/**
 * Resolves the credentials a pipeline call should use for `userId`: the
 * user's own key if they've set one in Settings, otherwise the server's
 * env var (the original admin-configured default). This is the single
 * place that decrypts secrets -- callers never touch ciphertext directly.
 */
export async function resolveUserCredentials(
  db: Database,
  userId: string,
  masterKey: string,
): Promise<ResolvedCredentials> {
  const row = await db.query.userCredentials.findFirst({
    where: eq(schema.userCredentials.userId, userId),
  });

  return {
    openrouterApiKey: decryptOr(row?.openrouterApiKeyEnc, masterKey, process.env.OPENROUTER_API_KEY),
    pexelsApiKey: decryptOr(row?.pexelsApiKeyEnc, masterKey, process.env.PEXELS_API_KEY),
    pixabayApiKey: decryptOr(row?.pixabayApiKeyEnc, masterKey, process.env.PIXABAY_API_KEY),
    azureSpeechKey: decryptOr(row?.azureSpeechKeyEnc, masterKey, process.env.AZURE_SPEECH_KEY),
    azureSpeechRegion: row?.azureSpeechRegion || process.env.AZURE_SPEECH_REGION || undefined,
    r2AccountId: decryptOr(row?.r2AccountIdEnc, masterKey, process.env.R2_ACCOUNT_ID),
    r2AccessKeyId: decryptOr(row?.r2AccessKeyIdEnc, masterKey, process.env.R2_ACCESS_KEY_ID),
    r2SecretAccessKey: decryptOr(row?.r2SecretAccessKeyEnc, masterKey, process.env.R2_SECRET_ACCESS_KEY),
    r2Bucket: row?.r2Bucket || process.env.R2_BUCKET || undefined,
  };
}

const SECRET_FIELDS = [
  ["openrouterApiKey", "openrouterApiKeyEnc"],
  ["pexelsApiKey", "pexelsApiKeyEnc"],
  ["pixabayApiKey", "pixabayApiKeyEnc"],
  ["azureSpeechKey", "azureSpeechKeyEnc"],
  ["r2AccountId", "r2AccountIdEnc"],
  ["r2AccessKeyId", "r2AccessKeyIdEnc"],
  ["r2SecretAccessKey", "r2SecretAccessKeyEnc"],
] as const;

const PLAIN_FIELDS = [
  ["azureSpeechRegion", "azureSpeechRegion"],
  ["r2Bucket", "r2Bucket"],
] as const;

/** Encrypts and upserts whichever fields are present in `input`. A field
 * set to null clears it back to "use the server default"; a field omitted
 * (undefined) is left untouched. */
export async function upsertUserCredentials(
  db: Database,
  userId: string,
  masterKey: string,
  input: CredentialsInput,
): Promise<void> {
  const set: Record<string, string | null> = {};

  for (const [inputKey, column] of SECRET_FIELDS) {
    const value = input[inputKey];
    if (value === undefined) continue;
    set[column] = value === null ? null : encryptSecret(value, masterKey);
  }
  for (const [inputKey, column] of PLAIN_FIELDS) {
    const value = input[inputKey];
    if (value === undefined) continue;
    set[column] = value;
  }

  if (Object.keys(set).length === 0) return;

  await db
    .insert(schema.userCredentials)
    .values({ userId, ...set })
    .onConflictDoUpdate({
      target: schema.userCredentials.userId,
      set: { ...set, updatedAt: new Date() },
    });
}

export async function getCredentialsStatus(db: Database, userId: string): Promise<CredentialsStatus> {
  const row = await db.query.userCredentials.findFirst({
    where: eq(schema.userCredentials.userId, userId),
  });

  return {
    openrouterApiKeySet: Boolean(row?.openrouterApiKeyEnc),
    pexelsApiKeySet: Boolean(row?.pexelsApiKeyEnc),
    pixabayApiKeySet: Boolean(row?.pixabayApiKeyEnc),
    azureSpeechKeySet: Boolean(row?.azureSpeechKeyEnc),
    azureSpeechRegion: row?.azureSpeechRegion ?? null,
    r2AccountIdSet: Boolean(row?.r2AccountIdEnc),
    r2AccessKeyIdSet: Boolean(row?.r2AccessKeyIdEnc),
    r2SecretAccessKeySet: Boolean(row?.r2SecretAccessKeyEnc),
    r2Bucket: row?.r2Bucket ?? null,
  };
}
