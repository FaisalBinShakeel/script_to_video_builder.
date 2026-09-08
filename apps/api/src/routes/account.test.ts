import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";

// apps/api/src/env.ts parses process.env eagerly at import time, so these
// must be set before anything that transitively imports it (../server.js)
// is loaded -- hence the dynamic imports below instead of static ones.
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/video_builder";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.CREDENTIALS_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.WEB_URL ??= "http://localhost:3000";
process.env.API_URL ??= "http://localhost:4000";

const { createDb, schema } = await import("@video-builder/core");
const { eq } = await import("drizzle-orm");

/** Same real-Postgres-or-skip pattern used elsewhere (packages/core/src/
 * credentials/resolve.test.ts, apps/worker/src/pipeline-runner.test.ts):
 * these exercise real Fastify routes end-to-end via app.inject(), which
 * needs a real DB (and Redis, for the render queue) behind it. */
let dbAvailable = false;
try {
  const probe = createDb(process.env.DATABASE_URL!);
  await probe.select().from(schema.users).limit(1);
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

function cookieHeader(res: { cookies: { name: string; value: string }[] }): string {
  return res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

describe.skipIf(!dbAvailable)("apps/api routes (against a real Postgres + Redis)", () => {
  let app: FastifyInstance;
  const email = `api-test-${Date.now()}@test.dev`;
  let sessionCookie = "";

  beforeAll(async () => {
    const { buildApp } = await import("../server.js");
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.ctx.db.delete(schema.sessions).where(eq(schema.sessions.userId, userId()));
    await app.ctx.db.delete(schema.userCredentials).where(eq(schema.userCredentials.userId, userId()));
    await app.ctx.db.delete(schema.users).where(eq(schema.users.email, email));
    await app.close();
  });

  let _userId = "";
  function userId(): string {
    return _userId;
  }

  it("GET /health is unauthenticated and OK", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  it("signs up and returns a session cookie", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email, password: "password123" },
    });
    expect(res.statusCode).toBe(201);
    _userId = res.json().id;
    sessionCookie = cookieHeader(res);
    expect(sessionCookie).not.toBe("");
  });

  it("rejects /account/credentials without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/account/credentials" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /account/credentials starts with nothing set", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/account/credentials",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openrouterApiKeySet).toBe(false);
    expect(body.r2Bucket).toBeNull();
  });

  it("PUT sets a key, the response never contains the plaintext, and GET reflects it", async () => {
    const putRes = await app.inject({
      method: "PUT",
      url: "/account/credentials",
      headers: { cookie: sessionCookie },
      payload: { openrouterApiKey: "sk-test-secret-abc123", r2Bucket: "my-bucket" },
    });
    expect(putRes.statusCode).toBe(200);
    expect(JSON.stringify(putRes.json())).not.toContain("sk-test-secret-abc123");
    expect(putRes.json().openrouterApiKeySet).toBe(true);
    expect(putRes.json().r2Bucket).toBe("my-bucket");

    const getRes = await app.inject({
      method: "GET",
      url: "/account/credentials",
      headers: { cookie: sessionCookie },
    });
    expect(getRes.json().openrouterApiKeySet).toBe(true);

    const row = await app.ctx.db.query.userCredentials.findFirst({
      where: eq(schema.userCredentials.userId, userId()),
    });
    expect(row?.openrouterApiKeyEnc).toBeTruthy();
    expect(row?.openrouterApiKeyEnc).not.toContain("sk-test-secret-abc123");
  });

  it("PUT with null clears a previously-set key", async () => {
    await app.inject({
      method: "PUT",
      url: "/account/credentials",
      headers: { cookie: sessionCookie },
      payload: { openrouterApiKey: null },
    });
    const res = await app.inject({
      method: "GET",
      url: "/account/credentials",
      headers: { cookie: sessionCookie },
    });
    expect(res.json().openrouterApiKeySet).toBe(false);
  });

  it("GET /account/credits reflects the signup bonus", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/account/credits",
      headers: { cookie: sessionCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().credits).toBe(10);
  });

  it("logs out and invalidates the session", async () => {
    const logoutRes = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: sessionCookie },
    });
    expect(logoutRes.statusCode).toBe(204);

    const meRes = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie: sessionCookie },
    });
    expect(meRes.statusCode).toBe(401);
  });
});
