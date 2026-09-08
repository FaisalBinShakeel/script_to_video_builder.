import { cookies } from "next/headers";
import { API_URL } from "./config";

/** Server-side API fetch for Server Components: forwards the incoming
 * request's cookies to the API so protected endpoints see the session. */
export async function serverApiFetch<T>(path: string): Promise<{ data: T | null; status: number }> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (res.status === 204) return { data: null, status: res.status };
  const data = await res.json().catch(() => null);
  return { data: res.ok ? (data as T) : null, status: res.status };
}
