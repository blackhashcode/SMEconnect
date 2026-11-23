"use client";

/**
 * Browser-side calls to the backend. Requests go to /api/v1/* on this origin;
 * Next.js forwards them to the backend, so the session cookie is first-party and
 * no CORS is involved.
 */

export type FieldErrors = Record<string, string[] | undefined>;
export type ApiResult<T> =
  | { ok: true; data: T; meta?: { nextCursor?: string | null; hasMore?: boolean } }
  | { ok: false; status: number; code: string; error: string; fields: FieldErrors };

type ErrorBody = {
  error?: { code?: string; message?: string; details?: { fieldErrors?: FieldErrors } } | string;
  // Better Auth's own error shape.
  code?: string;
  message?: string;
};

function toFailure(status: number, body: ErrorBody | null): ApiResult<never> {
  const nested = typeof body?.error === "object" ? body.error : undefined;
  return {
    ok: false,
    status,
    code: nested?.code ?? body?.code ?? "ERROR",
    error: nested?.message ?? body?.message ?? (typeof body?.error === "string" ? body.error : "Something went wrong. Please try again."),
    fields: nested?.details?.fieldErrors ?? {},
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  try {
    const res = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      cache: "no-store",
    });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) return toFailure(res.status, json);
    // App routes wrap payloads as { data, meta }; Better Auth returns the object itself.
    const wrapped = json && typeof json === "object" && "data" in json;
    return { ok: true, data: (wrapped ? json.data : json) as T, meta: wrapped ? json.meta : undefined };
  } catch {
    return toFailure(0, { message: "Can't reach the server. Check your connection and try again." });
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, form),
};

/** First validation message for a field, or undefined. */
export const fieldError = (fields: FieldErrors, name: string) => fields[name]?.[0];
