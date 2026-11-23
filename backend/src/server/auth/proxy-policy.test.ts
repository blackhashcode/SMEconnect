import { describe, expect, it } from "vitest";
import { isProtectedApiPath } from "@/server/auth/proxy-policy";

describe("optimistic proxy prefixes", () => {
  it.each([
    "/api/v1/me",
    "/api/v1/me/product-images",
    "/api/v1/me/product-images/img_1",
    "/api/v1/verifications",
    "/api/v1/verifications/me",
    "/api/v1/admin/verifications",
    "/api/v1/uploads",
    "/api/v1/phone-otp/request",
    "/api/v1/files/private/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.pdf",
  ])("pre-filters %s", (path) => {
    expect(isProtectedApiPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/docs",
    "/api/docs",
    "/api/v1/health",
    "/api/v1/auth/sign-in/email",
    "/api/v1/files/public/2f8c1a54-6b7d-4c9e-9f31-0a2b3c4d5e6f.jpg",
    "/api/v1/profiles/usr_123",
    "/api/v1/verifications-public",
  ])("leaves %s untouched", (path) => {
    expect(isProtectedApiPath(path)).toBe(false);
  });
});
