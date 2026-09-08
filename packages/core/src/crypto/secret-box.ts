import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export class SecretBoxError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SecretBoxError";
  }
}

function loadMasterKey(masterKeyB64: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(masterKeyB64, "base64");
  } catch (err) {
    throw new SecretBoxError("CREDENTIALS_ENCRYPTION_KEY is not valid base64", err);
  }
  if (key.length !== KEY_LENGTH) {
    throw new SecretBoxError(
      `CREDENTIALS_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

/**
 * Encrypts a secret (an API key, etc.) with AES-256-GCM under the server's
 * master key. Output is a single base64 string: iv || authTag || ciphertext.
 * Every user-supplied credential is stored this way, never in plaintext.
 */
export function encryptSecret(plaintext: string, masterKeyB64: string): string {
  const key = loadMasterKey(masterKeyB64);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypts a value produced by encryptSecret. Throws SecretBoxError if the
 * master key is wrong or the payload was tampered with (GCM auth failure). */
export function decryptSecret(payload: string, masterKeyB64: string): string {
  const key = loadMasterKey(masterKeyB64);
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch (err) {
    throw new SecretBoxError(
      "Failed to decrypt secret -- wrong CREDENTIALS_ENCRYPTION_KEY or corrupted data",
      err,
    );
  }
}
