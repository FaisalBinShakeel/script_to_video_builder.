import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { User } from "lucia";

/** Resolves the Lucia session from the request's session cookie on every
 * request, refreshing the cookie when Lucia rotates the session id. Route
 * handlers read request.user / request.session; they're null when the
 * request isn't authenticated. */
export async function registerAuthPlugin(app: FastifyInstance) {
  app.decorateRequest("user", null);
  app.decorateRequest("session", null);

  app.addHook("onRequest", async (request, reply) => {
    const sessionId = request.cookies[app.ctx.lucia.sessionCookieName] ?? null;
    if (!sessionId) {
      request.user = null;
      request.session = null;
      return;
    }

    const { session, user } = await app.ctx.lucia.validateSession(sessionId);

    if (session?.fresh) {
      const cookie = app.ctx.lucia.createSessionCookie(session.id);
      reply.setCookie(cookie.name, cookie.value, cookie.attributes);
    }
    if (!session) {
      const cookie = app.ctx.lucia.createBlankSessionCookie();
      reply.setCookie(cookie.name, cookie.value, cookie.attributes);
    }

    request.user = user;
    request.session = session;
  });
}

/** Returns the authenticated user, or sends a 401 and returns null. Callers
 * must `return` immediately when this returns null. */
export function requireAuth(request: FastifyRequest, reply: FastifyReply): User | null {
  if (!request.user) {
    reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return request.user;
}
