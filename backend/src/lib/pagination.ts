import { ValidationError } from "@/server/errors";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

export type CursorValue = string | number | boolean | null;
export type CursorPayload = Record<string, CursorValue>;

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

/** Parses `?cursor=&limit=` with the API defaults and bounds. */
export function parsePagination(params: URLSearchParams): PaginationParams {
  const rawLimit = params.get("limit");
  let limit = DEFAULT_PAGE_LIMIT;

  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) {
      throw new ValidationError("limit must be a positive integer");
    }
    limit = Number(rawLimit);
    if (limit < 1 || limit > MAX_PAGE_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_PAGE_LIMIT}`);
    }
  }

  const cursor = params.get("cursor") ?? undefined;
  if (cursor !== undefined && cursor !== "") {
    decodeCursor(cursor); // validate eagerly
  }

  return { cursor, limit };
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor<T extends CursorPayload = CursorPayload>(cursor: string): T {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Invalid cursor payload");
    }

    for (const value of Object.values(parsed)) {
      const isPrimitive =
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean";
      if (!isPrimitive) throw new Error("Invalid cursor value");
    }

    return parsed as T;
  } catch {
    throw new ValidationError("Invalid cursor");
  }
}
