import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/errors";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  decodeCursor,
  encodeCursor,
  parsePagination,
} from "@/lib/pagination";

describe("parsePagination", () => {
  it("uses the default limit when none is given", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({
      limit: DEFAULT_PAGE_LIMIT,
      cursor: undefined,
    });
  });

  it("accepts a limit inside the allowed range", () => {
    expect(parsePagination(new URLSearchParams("limit=50")).limit).toBe(
      MAX_PAGE_LIMIT,
    );
  });

  it.each(["0", "51", "-1", "abc", "1.5"])(
    "rejects invalid limit %s",
    (limit) => {
      expect(() =>
        parsePagination(new URLSearchParams(`limit=${limit}`)),
      ).toThrow(ValidationError);
    },
  );

  it("validates a supplied cursor", () => {
    expect(() =>
      parsePagination(new URLSearchParams("cursor=not-a-cursor")),
    ).toThrow(ValidationError);
  });
});

describe("cursor helpers", () => {
  it("round-trips a keyset payload", () => {
    const payload = { id: "abc123", createdAt: "2026-11-22T00:00:00.000Z" };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it("rejects a cursor containing nested objects", () => {
    const invalid = Buffer.from(JSON.stringify({ nested: {} })).toString(
      "base64url",
    );
    expect(() => decodeCursor(invalid)).toThrow(ValidationError);
  });
});
