import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  // Must match apps/api's CREDENTIALS_ENCRYPTION_KEY -- both encrypt/decrypt
  // the same user_credentials rows. Generate with: openssl rand -base64 32
  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message:
        "CREDENTIALS_ENCRYPTION_KEY must be a base64 string decoding to 32 bytes. Generate one with: openssl rand -base64 32",
    }),
  PEXELS_API_KEY: z.string().optional(),
  PIXABAY_API_KEY: z.string().optional(),
  AZURE_SPEECH_KEY: z.string().optional(),
  AZURE_SPEECH_REGION: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  RENDER_WORKER_CONCURRENCY: z.coerce.number().default(2),
});

export const env = EnvSchema.parse(process.env);
