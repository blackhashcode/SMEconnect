import { NextResponse } from "next/server";
import { AppError, toErrorPayload } from "@/server/errors";
import { logger } from "@/server/logger";
import { RateLimitError } from "@/server/rate-limit";

export interface ApiMeta {
  [key: string]: unknown;
}

export function ok<T>(data: T, meta?: ApiMeta) {
  return NextResponse.json(meta === undefined ? { data } : { data, meta }, {
    status: 200,
  });
}

export function created<T>(data: T, meta?: ApiMeta) {
  return NextResponse.json(meta === undefined ? { data } : { data, meta }, {
    status: 201,
  });
}

export function fail(error: unknown) {
  if (!(error instanceof AppError)) {
    logger.error("Unhandled API error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const { status, body } = toErrorPayload(error);
  const headers: Record<string, string> = {};
  if (error instanceof RateLimitError) {
    headers["Retry-After"] = String(error.retryAfterSec);
  }
  return NextResponse.json(body, { status, headers });
}

/** Keeps route handlers thin: parse/validate → call service → respond. */
export async function handleRequest(handler: () => Promise<NextResponse>) {
  try {
    return await handler();
  } catch (error) {
    return fail(error);
  }
}
