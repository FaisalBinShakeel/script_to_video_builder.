import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCredentialsStatus, upsertUserCredentials } from "@video-builder/core";
import { requireAuth } from "../plugins/auth.js";
import { env } from "../env.js";

const nullableString = z.union([z.string().min(1), z.null()]).optional();

const CredentialsUpdateSchema = z.object({
  openrouterApiKey: nullableString,
  pexelsApiKey: nullableString,
  pixabayApiKey: nullableString,
  azureSpeechKey: nullableString,
  azureSpeechRegion: nullableString,
  r2AccountId: nullableString,
  r2AccessKeyId: nullableString,
  r2SecretAccessKey: nullableString,
  r2Bucket: nullableString,
});

export async function registerAccountRoutes(app: FastifyInstance) {
  app.get("/account/credits", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;
    return { credits: user.credits };
  });

  // Lets a logged-in user bring their own provider keys instead of relying
  // on the server's .env -- never returns a decrypted secret, only whether
  // each one is set.
  app.get("/account/credentials", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;
    return getCredentialsStatus(app.ctx.db, user.id);
  });

  app.put("/account/credentials", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const body = CredentialsUpdateSchema.parse(request.body);
    await upsertUserCredentials(app.ctx.db, user.id, env.CREDENTIALS_ENCRYPTION_KEY, body);
    return getCredentialsStatus(app.ctx.db, user.id);
  });
}
