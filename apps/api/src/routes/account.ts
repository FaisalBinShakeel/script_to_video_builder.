import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";

export async function registerAccountRoutes(app: FastifyInstance) {
  app.get("/account/credits", async (request, reply) => {
    const user = requireAuth(request, reply);
    if (!user) return;
    return { credits: user.credits };
  });
}
