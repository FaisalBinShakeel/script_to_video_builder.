import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { schema, createR2Client, signRenderDownloadUrl } from "@video-builder/core";
import { requireAuth } from "../plugins/auth.js";
import { env } from "../env.js";

const SSE_POLL_INTERVAL_MS = 1000;

async function loadOwnedRender(app: FastifyInstance, userId: string, renderId: string) {
  return app.ctx.db.query.renders.findFirst({
    where: and(eq(schema.renders.id, renderId), eq(schema.renders.userId, userId)),
  });
}

export async function registerRenderRoutes(app: FastifyInstance) {
  app.get("/renders/:id", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const render = await loadOwnedRender(app, user.id, params.id);
    if (!render) return reply.code(404).send({ error: "render not found" });
    return render;
  });

  app.get("/renders/:id/stream", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let closed = false;
    request.raw.on("close", () => {
      closed = true;
    });

    while (!closed) {
      const render = await loadOwnedRender(app, user.id, params.id);
      if (!render) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: "render not found" })}\n\n`);
        break;
      }

      reply.raw.write(
        `event: progress\ndata: ${JSON.stringify({ stage: render.stage, percent: render.percent, status: render.status })}\n\n`,
      );

      if (render.status === "succeeded" || render.status === "failed") {
        const downloadUrl = render.outputUrl ? await signOutputUrl(render.outputUrl) : null;
        reply.raw.write(
          `event: done\ndata: ${JSON.stringify({ status: render.status, downloadUrl, errorMessage: render.errorMessage })}\n\n`,
        );
        break;
      }

      await new Promise((r) => setTimeout(r, SSE_POLL_INTERVAL_MS));
    }

    reply.raw.end();
  });

  app.get("/renders/:id/download", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const render = await loadOwnedRender(app, user.id, params.id);
    if (!render || render.status !== "succeeded" || !render.outputUrl) {
      return reply.code(404).send({ error: "render output not available" });
    }
    const url = await signOutputUrl(render.outputUrl);
    return reply.redirect(url, 302);
  });
}

async function signOutputUrl(storageKey: string): Promise<string> {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    throw new Error("R2 is not configured on this server");
  }
  const client = createR2Client({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  });
  return signRenderDownloadUrl(client, env.R2_BUCKET, storageKey);
}
