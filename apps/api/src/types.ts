import type { User, Session } from "lucia";
import type { AppContext } from "./context.js";

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
  }
  interface FastifyRequest {
    user: User | null;
    session: Session | null;
  }
}
