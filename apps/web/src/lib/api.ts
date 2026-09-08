"use client";

import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Client-side API fetch. Always sends the Lucia session cookie
 * cross-origin (API and web run on different ports in dev). */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body && typeof body === "object" && "error" in body ? body.error : null) ?? res.statusText;
    throw new ApiError(String(message), res.status);
  }
  return body as T;
}
