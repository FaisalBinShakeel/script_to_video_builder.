import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema } from "@video-builder/core";
import { requireAuth } from "../plugins/auth.js";

const BrandKitSchema = z.object({
  name: z.string().min(1),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  font: z.string().optional(),
  logoUrl: z.string().optional(),
  watermarkEnabled: z.boolean().optional(),
});

export async function registerBrandKitRoutes(app: FastifyInstance) {
  app.get("/brand-kit", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const kit = await app.ctx.db.query.brandKits.findFirst({
      where: eq(schema.brandKits.userId, user.id),
    });
    if (!kit) return reply.code(404).send({ error: "no brand kit yet" });
    return kit;
  });

  app.put("/brand-kit", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;

    const body = BrandKitSchema.parse(request.body);
    const existing = await app.ctx.db.query.brandKits.findFirst({
      where: eq(schema.brandKits.userId, user.id),
    });

    if (existing) {
      const [updated] = await app.ctx.db
        .update(schema.brandKits)
        .set(body)
        .where(eq(schema.brandKits.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await app.ctx.db
      .insert(schema.brandKits)
      .values({ userId: user.id, ...body })
      .returning();
    return created;
  });
}
