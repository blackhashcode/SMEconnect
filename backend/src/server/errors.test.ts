import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  toErrorPayload,
} from "@/server/errors";

describe("toErrorPayload", () => {
  it.each([
    [new ValidationError("Bad input"), 400, "VALIDATION_ERROR"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new ConflictError(), 409, "CONFLICT"],
    [new BusinessRuleError(), 422, "BUSINESS_RULE_VIOLATION"],
  ])("maps %s to the correct status and code", (error, status, code) => {
    const result = toErrorPayload(error);
    expect(result.status).toBe(status);
    expect(result.body.error.code).toBe(code);
    expect(result.body.error.message).toBe(error.message);
  });

  it("includes details from AppError subclasses", () => {
    const result = toErrorPayload(
      new ValidationError("Bad input", { field: "amountBdt" }),
    );
    expect(result.body.error.details).toEqual({ field: "amountBdt" });
  });

  it("maps Zod errors to 400 with field details", () => {
    const schema = z.object({ email: z.string().min(1) });
    const parsed = schema.safeParse({ email: "" });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const result = toErrorPayload(parsed.error);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("VALIDATION_ERROR");
    expect(result.body.error.details).toHaveProperty("fieldErrors.email");
  });

  it("hides unknown errors behind a generic 500", () => {
    const result = toErrorPayload(new Error("database password: secret"));
    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
  });

  it("treats AppError as the base class for all domain errors", () => {
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
  });
});
