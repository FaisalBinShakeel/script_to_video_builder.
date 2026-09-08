import { Lucia } from "lucia";
import type { Database } from "@video-builder/core";
import { DrizzleLuciaAdapter } from "./adapter.js";

export interface DatabaseUserAttributes {
  email: string;
  name: string | null;
  credits: number;
}

declare module "lucia" {
  interface Register {
    Lucia: ReturnType<typeof createLucia>;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

export function createLucia(db: Database) {
  return new Lucia(new DrizzleLuciaAdapter(db), {
    sessionCookie: {
      attributes: {
        // Secure cookies require HTTPS; disabled here so local dev over
        // plain http:// still works, matching apps/web's local dev URL.
        secure: process.env.NODE_ENV === "production",
      },
    },
    getUserAttributes: (attributes) => ({
      email: attributes.email,
      name: attributes.name,
      credits: attributes.credits,
    }),
  });
}

export type AppLucia = ReturnType<typeof createLucia>;
