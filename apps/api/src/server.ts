import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import "./types.js";
import { env } from "./env.js";
import { createContext } from "./context.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerRenderRoutes } from "./routes/renders.js";
import { registerBrandKitRoutes } from "./routes/brand-kit.js";
import { registerAccountRoutes } from "./routes/account.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.decorate("ctx", createContext());

  await app.register(cors, { origin: env.WEB_URL, credentials: true });
  await app.register(cookie);

  app.get("/health", async () => ({ ok: true }));

  await registerAuthPlugin(app);
  await registerAuthRoutes(app);
  await registerProjectRoutes(app);
  await registerRenderRoutes(app);
  await registerBrandKitRoutes(app);
  await registerAccountRoutes(app);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildApp();
  app.listen({ port: env.API_PORT, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
