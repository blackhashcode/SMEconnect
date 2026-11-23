import { describe, expect, it } from "vitest";
import { parseApiError } from "@/lib/client-api";

describe("parseApiError — /api/v1 error envelope handling", () => {
  it("extracts code, message, and fieldErrors from the canonical v1 error envelope", () => {
    const res = parseApiError(400, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Please fix the highlighted fields.",
        details: { fieldErrors: { email: ["Enter a valid email address."] } },
      },
    });
    expect(res).toEqual({
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      error: "Please fix the highlighted fields.",
      fields: { email: ["Enter a valid email address."] },
    });
  });

  it("gracefully falls back on unexpected payloads", () => {
    const res = parseApiError(500, null);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Something went wrong");
    expect(res.fields).toEqual({});
  });
});
