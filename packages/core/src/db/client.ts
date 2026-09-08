import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let sql: ReturnType<typeof postgres> | undefined;
let db: Database | undefined;

export function createDb(connectionString: string): Database {
  sql = postgres(connectionString);
  db = drizzle(sql, { schema });
  return db;
}

/** Lazily connects using DATABASE_URL on first access. */
export function getDb(): Database {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    return createDb(url);
  }
  return db;
}

export { schema };
