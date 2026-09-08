import { eq, lt } from "drizzle-orm";
import type { Adapter, DatabaseSession, DatabaseUser } from "lucia";
import { schema, type Database } from "@video-builder/core";

/**
 * Minimal Lucia v3 Adapter backed by our own Drizzle schema (users +
 * sessions), instead of pulling in a separate @lucia-auth/adapter-drizzle
 * dependency for two tables.
 */
export class DrizzleLuciaAdapter implements Adapter {
  constructor(private readonly db: Database) {}

  async getSessionAndUser(
    sessionId: string,
  ): Promise<[session: DatabaseSession | null, user: DatabaseUser | null]> {
    const rows = await this.db
      .select({ session: schema.sessions, user: schema.users })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(eq(schema.sessions.id, sessionId));

    const row = rows[0];
    if (!row) return [null, null];

    return [
      {
        id: row.session.id,
        userId: row.session.userId,
        expiresAt: row.session.expiresAt,
        attributes: {},
      },
      {
        id: row.user.id,
        attributes: { email: row.user.email, name: row.user.name, credits: row.user.credits },
      },
    ];
  }

  async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    const rows = await this.db.select().from(schema.sessions).where(eq(schema.sessions.userId, userId));
    return rows.map((r) => ({ id: r.id, userId: r.userId, expiresAt: r.expiresAt, attributes: {} }));
  }

  async setSession(session: DatabaseSession): Promise<void> {
    await this.db.insert(schema.sessions).values({
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    });
  }

  async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    await this.db.update(schema.sessions).set({ expiresAt }).where(eq(schema.sessions.id, sessionId));
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  }
}
