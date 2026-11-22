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

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(error: unknown) {
  const { status, body } = toErrorPayload(error);
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
