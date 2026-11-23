import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { toErrorPayload } from "@/server/errors";

export interface ApiMeta {
  [key: string]: unknown;
}

export function ok<T>(data: T, meta?: ApiMeta) {
  return NextResponse.json(meta === undefined ? { data } : { data, meta }, {
    status: 200,
  });
}

/**
 * Like `ok`, for anonymous, non-personalised reads. Lets the CDN (and browsers)
 * reuse the response briefly and serve a stale copy while refreshing, which
 * absorbs traffic spikes on listing pages without touching the database.
 */
export function okPublic<T>(data: T, meta?: ApiMeta, maxAgeSeconds = 30) {
  const response = ok(data, meta);
  response.headers.set(
    "Cache-Control",
    `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 4}`,
  );
  return response;
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(error: unknown) {
  const { status, body } = toErrorPayload(error);
  if (status >= 500) {
    // Clients only ever see a generic message; the details go to the server log
    // with an id the user can quote, so failures can actually be diagnosed.
    const requestId = randomUUID();
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        name: err.name,
        message: err.message,
        stack: err.stack?.split("\n").slice(0, 8).join("\n"),
      }),
    );
    return NextResponse.json(
      { error: { ...body.error, requestId } },
      { status, headers: { "X-Request-Id": requestId } },
    );
  }
  return NextResponse.json(body, { status });
}

/** Keeps route handlers thin: parse/validate → call service → respond. */
export async function handleRequest(handler: () => Promise<NextResponse>) {
  try {
    return await handler();
  } catch (error) {
    return fail(error);
  }
}
