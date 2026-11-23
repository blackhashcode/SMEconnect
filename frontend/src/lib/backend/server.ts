import { cookies, headers } from "next/headers";

/**
 * Server-side client for the backend API (../backend). Use from Server
 * Components only: it forwards the visitor's cookies so the backend sees their
 * session. Browsers reach the same API through the /api/v1 rewrite in
 * next.config.mjs, so everything stays on one origin.
 */
export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export class BackendUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Can't reach the SME Connect backend at ${BACKEND_URL}. Is it running?`, { cause });
  }
}

type Envelope<T> = { data: T; meta?: { nextCursor?: string | null; hasMore?: boolean } };

export type BackendResult<T> = { status: number; data: T | null; meta?: Envelope<T>["meta"] };

/** GET an /api/v1 path as the current visitor. Non-2xx responses resolve with data: null. */
export async function backendGet<T>(path: string): Promise<BackendResult<T>> {
  const [cookieStore, incoming] = await Promise.all([cookies(), headers()]);
  const forwarded = incoming.get("x-forwarded-for");
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      headers: {
        ...(cookieStore.size ? { cookie: cookieStore.toString() } : {}),
        // Keep the visitor's IP for the backend's rate limits.
        ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new BackendUnavailableError(error);
  }
  if (!res.ok) return { status: res.status, data: null };
  const body = (await res.json()) as Envelope<T>;
  return { status: res.status, data: body.data, meta: body.meta };
}

/** Public, cacheable GET (no cookies) for anonymous pages such as the landing page. */
export async function backendGetPublic<T>(path: string, revalidateSeconds = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, { next: { revalidate: revalidateSeconds } });
    if (!res.ok) return null;
    return ((await res.json()) as Envelope<T>).data;
  } catch {
    return null;
  }
}
