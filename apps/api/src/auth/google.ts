import { Google } from "arctic";
import { env } from "../env.js";

export function getGoogleProvider(): Google | undefined {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return undefined;
  return new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.API_URL}/auth/google/callback`,
  );
}
