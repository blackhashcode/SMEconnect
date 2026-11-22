"use client";

/**
 * Browser-side calls to the API. Requests go to /api/* on this origin, which
 * Next.js forwards to the API server, so the session cookie is sent automatically.
 */

export type FieldErrors = Record<string, string[] | undefined>;
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; fields: FieldErrors };

async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const json = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: json as T };
    return { ok: false, status: res.status, error: json.error ?? "Something went wrong. Please try again.", fields: json.fields ?? {} };
  } catch {
    return { ok: false, status: 0, error: "Can't reach the server. Check your connection and that the API is running.", fields: {} };
  }
}

export const getJson = <T>(url: string) => request<T>("GET", url);
export const postJson = <T>(url: string, body: unknown = {}) => request<T>("POST", url, body);
