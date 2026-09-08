import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateState, generateCodeVerifier, decodeIdToken } from "arctic";
import { eq } from "drizzle-orm";
import { schema } from "@video-builder/core";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { getGoogleProvider } from "../auth/google.js";

const SIGNUP_STARTER_CREDITS = 10;

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (request, reply) => {
    const body = SignupSchema.parse(request.body);
    const existing = await app.ctx.db.query.users.findFirst({
      where: eq(schema.users.email, body.email),
    });
    if (existing) return reply.code(409).send({ error: "email already registered" });

    const passwordHash = await hashPassword(body.password);
    const [user] = await app.ctx.db
      .insert(schema.users)
      .values({
        email: body.email,
        passwordHash,
        name: body.name ?? null,
        credits: SIGNUP_STARTER_CREDITS,
      })
      .returning();
    if (!user) return reply.code(500).send({ error: "failed to create user" });

    const session = await app.ctx.lucia.createSession(user.id, {});
    const cookie = app.ctx.lucia.createSessionCookie(session.id);
    reply.setCookie(cookie.name, cookie.value, cookie.attributes);
    return reply.code(201).send({ id: user.id, email: user.email, credits: user.credits });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = LoginSchema.parse(request.body);
    const user = await app.ctx.db.query.users.findFirst({
      where: eq(schema.users.email, body.email),
    });
    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const session = await app.ctx.lucia.createSession(user.id, {});
    const cookie = app.ctx.lucia.createSessionCookie(session.id);
    reply.setCookie(cookie.name, cookie.value, cookie.attributes);
    return { id: user.id, email: user.email, credits: user.credits };
  });

  app.post("/auth/logout", async (request, reply) => {
    if (request.session) await app.ctx.lucia.invalidateSession(request.session.id);
    const cookie = app.ctx.lucia.createBlankSessionCookie();
    reply.setCookie(cookie.name, cookie.value, cookie.attributes);
    return reply.code(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "unauthorized" });
    return request.user;
  });

  app.get("/auth/google", async (request, reply) => {
    const google = getGoogleProvider();
    if (!google) {
      return reply.code(501).send({ error: "Google OAuth is not configured on this server" });
    }
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);

    reply.setCookie("google_oauth_state", state, { path: "/", maxAge: 600, httpOnly: true });
    reply.setCookie("google_oauth_verifier", codeVerifier, { path: "/", maxAge: 600, httpOnly: true });
    return reply.redirect(url.toString());
  });

  app.get("/auth/google/callback", async (request, reply) => {
    const google = getGoogleProvider();
    if (!google) {
      return reply.code(501).send({ error: "Google OAuth is not configured on this server" });
    }

    const query = z
      .object({ code: z.string(), state: z.string() })
      .safeParse(request.query);
    const storedState = request.cookies.google_oauth_state;
    const codeVerifier = request.cookies.google_oauth_verifier;

    if (!query.success || !storedState || !codeVerifier || query.data.state !== storedState) {
      return reply.code(400).send({ error: "invalid oauth callback" });
    }

    const tokens = await google.validateAuthorizationCode(query.data.code, codeVerifier);
    const claims = decodeIdToken(tokens.idToken()) as {
      sub: string;
      email: string;
      name?: string;
    };

    let user = await app.ctx.db.query.users.findFirst({
      where: eq(schema.users.googleId, claims.sub),
    });
    if (!user) {
      const [created] = await app.ctx.db
        .insert(schema.users)
        .values({
          email: claims.email,
          googleId: claims.sub,
          name: claims.name ?? null,
          credits: SIGNUP_STARTER_CREDITS,
        })
        .returning();
      user = created;
    }
    if (!user) return reply.code(500).send({ error: "failed to create user" });

    const session = await app.ctx.lucia.createSession(user.id, {});
    const cookie = app.ctx.lucia.createSessionCookie(session.id);
    reply.setCookie(cookie.name, cookie.value, cookie.attributes);
    return reply.redirect(process.env.WEB_URL ?? "/");
  });
}
