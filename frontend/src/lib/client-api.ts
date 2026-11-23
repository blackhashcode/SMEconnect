"use client";

/**
 * Browser-side client for the canonical `/api/v1/*` contract.
 * Unwraps `{ data, meta? }` on success and `{ error: { code, message, details } }` on failure.
 */

export type FieldErrors = Record<string, string[] | undefined>;
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string; error: string; fields: FieldErrors };

export function parseApiError(
  status: number,
  json: unknown,
): { ok: false; status: number; code?: string; error: string; fields: FieldErrors } {
  const fallback = "Something went wrong. Please try again.";
  if (!json || typeof json !== "object") {
    return { ok: false, status, error: fallback, fields: {} };
  }
  const obj = json as Record<string, unknown>;
  // Standard v1 envelope: { error: { code, message, details?: { fieldErrors } } }
  if (obj.error && typeof obj.error === "object") {
    const errObj = obj.error as Record<string, unknown>;
    const details = errObj.details && typeof errObj.details === "object" ? (errObj.details as Record<string, unknown>) : null;
    const fields =
      details && details.fieldErrors && typeof details.fieldErrors === "object"
        ? (details.fieldErrors as FieldErrors)
        : {};
    return {
      ok: false,
      status,
      code: typeof errObj.code === "string" ? errObj.code : undefined,
      error: typeof errObj.message === "string" ? errObj.message : fallback,
      fields,
    };
  }
  // Legacy fallback
  return {
    ok: false,
    status,
    error: typeof obj.error === "string" ? obj.error : fallback,
    fields: obj.fields && typeof obj.fields === "object" ? (obj.fields as FieldErrors) : {},
  };
}

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
    if (res.ok) {
      const data = json && typeof json === "object" && "data" in json ? (json.data as T) : (json as T);
      return { ok: true, data };
    }
    return parseApiError(res.status, json);
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Can't reach the server. Check your connection and that the API is running.",
      fields: {},
    };
  }
}

export const getJson = <T>(url: string) => request<T>("GET", url);
export const postJson = <T>(url: string, body: unknown = {}) => request<T>("POST", url, body);
export const deleteJson = <T>(url: string) => request<T>("DELETE", url, {});
