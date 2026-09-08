import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  schema,
  generateScript,
  ScriptGenerationInputSchema,
  VideoScriptSchema,
} from "@video-builder/core";
import { requireAuth } from "../plugins/auth.js";

const MAX_CONCURRENT_RENDERS_PER_USER = 2;

const CreateProjectSchema = ScriptGenerationInputSchema.extend({
  musicMood: z.enum(["upbeat", "ambient", "cinematic", "corporate"]).optional(),
});

export async function registerProjectRoutes(app: FastifyInstance) {
  app.post("/projects", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const body = CreateProjectSchema.parse(request.body);
    const script = await generateScript(body);

    const [project] = await app.ctx.db
      .insert(schema.projects)
      .values({
        userId: user.id,
        title: script.title,
        topic: body.topic,
        format: body.format,
        language: body.language,
        tone: body.tone,
        musicMood: script.musicMood,
        status: "draft",
        scriptJson: script,
      })
      .returning();

    return reply.code(201).send(project);
  });

  app.patch("/projects/:id/script", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const script = VideoScriptSchema.parse(request.body);

    const [updated] = await app.ctx.db
      .update(schema.projects)
      .set({ scriptJson: script, title: script.title, updatedAt: new Date() })
      .where(and(eq(schema.projects.id, params.id), eq(schema.projects.userId, user.id)))
      .returning();

    if (!updated) return reply.code(404).send({ error: "project not found" });
    return updated;
  });

  app.get("/projects/:id", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await app.ctx.db.query.projects.findFirst({
      where: and(eq(schema.projects.id, params.id), eq(schema.projects.userId, user.id)),
    });
    if (!project) return reply.code(404).send({ error: "project not found" });
    return project;
  });

  app.get("/projects", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const query = z
      .object({ limit: z.coerce.number().min(1).max(100).default(20), offset: z.coerce.number().min(0).default(0) })
      .parse(request.query);

    const rows = await app.ctx.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, user.id))
      .orderBy(desc(schema.projects.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    return rows;
  });

  app.post("/projects/:id/render", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const project = await app.ctx.db.query.projects.findFirst({
      where: and(eq(schema.projects.id, params.id), eq(schema.projects.userId, user.id)),
    });
    if (!project) return reply.code(404).send({ error: "project not found" });
    if (!project.scriptJson) {
      return reply.code(400).send({ error: "project has no script to render" });
    }

    const runningCount = await app.ctx.db
      .select({ id: schema.renders.id })
      .from(schema.renders)
      .where(
        and(
          eq(schema.renders.userId, user.id),
          inArray(schema.renders.status, ["queued", "running"]),
        ),
      );
    if (runningCount.length >= MAX_CONCURRENT_RENDERS_PER_USER) {
      return reply.code(429).send({ error: "too many renders already in progress (limit 2)" });
    }

    const [render] = await app.ctx.db
      .insert(schema.renders)
      .values({ projectId: project.id, userId: user.id, status: "queued", percent: 0 })
      .returning();
    if (!render) return reply.code(500).send({ error: "failed to create render" });

    // Credits are deducted on SUCCESS only (worker), never on enqueue.
    // attempts: 2 = one initial attempt + one retry, per the worker's
    // retry-once-then-fail-permanently contract (see markRenderFailed).
    await app.ctx.renderQueue.add(
      "render",
      { renderId: render.id },
      { attempts: 2, backoff: { type: "fixed", delay: 5000 } },
    );

    return reply.code(202).send(render);
  });
}
