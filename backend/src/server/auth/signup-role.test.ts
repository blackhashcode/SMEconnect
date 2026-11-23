import { describe, expect, it } from "vitest";
import {
  normalizeSignupBody,
  resolveCreatedUser,
  stripProtectedUserFieldsFromUpdate,
} from "@/server/auth/signup-role";
import { signUpEmailRequestSchema } from "@/server/validators/auth";

describe("normalizeSignupBody", () => {
  it.each(["OWNER", "INVESTOR"] as const)(
    "maps %s onto the existing role column",
    (signupRole) => {
      const result = normalizeSignupBody({
        name: "Test User",
        email: "user@example.com",
        signupRole,
        role: "ADMIN",
        status: "SUSPENDED",
      });

      expect(result.role).toBe(signupRole);
      expect(result).not.toHaveProperty("signupRole");
      expect(result).not.toHaveProperty("status");
      expect(result.email).toBe("user@example.com");
    },
  );

  it.each(["ADMIN", "", undefined, "owner"])(
    "rejects invalid signup choice %s",
    (signupRole) => {
      expect(() =>
        normalizeSignupBody({ email: "user@example.com", signupRole }),
      ).toThrow("Choose OWNER or INVESTOR when signing up");
    },
  );
});

describe("resolveCreatedUser", () => {
  it("forces ACTIVE status and removes client-controlled fields", () => {
    const result = resolveCreatedUser({
      email: "user@example.com",
      role: "INVESTOR",
      status: "SUSPENDED",
      signupRole: "INVESTOR",
    });

    expect(result.role).toBe("INVESTOR");
    expect(result.status).toBe("ACTIVE");
    expect(result).not.toHaveProperty("signupRole");
    expect(result.email).toBe("user@example.com");
  });

  it("rejects an admin role reaching user creation", () => {
    expect(() => resolveCreatedUser({ email: "user@example.com", role: "ADMIN" })).toThrow(
      "Choose OWNER or INVESTOR when signing up",
    );
  });
});

describe("stripProtectedUserFieldsFromUpdate", () => {
  it("removes role, status and signupRole while keeping allowed updates", () => {
    const result = stripProtectedUserFieldsFromUpdate({
      name: "Updated Name",
      role: "ADMIN",
      status: "SUSPENDED",
      signupRole: "INVESTOR",
    });

    expect(result).toEqual({ name: "Updated Name" });
  });
});

describe("signUpEmailRequestSchema", () => {
  it("requires an explicit non-admin signup role", () => {
    const base = {
      name: "Test User",
      email: "user@example.com",
      password: "example-password",
    };

    expect(
      signUpEmailRequestSchema.safeParse({ ...base, signupRole: "OWNER" }).success,
    ).toBe(true);
    expect(
      signUpEmailRequestSchema.safeParse({ ...base, signupRole: "INVESTOR" }).success,
    ).toBe(true);
    expect(
      signUpEmailRequestSchema.safeParse({ ...base, signupRole: "ADMIN" }).success,
    ).toBe(false);
    expect(signUpEmailRequestSchema.safeParse(base).success).toBe(false);
  });

  it("rejects attempts to set server-owned fields", () => {
    const result = signUpEmailRequestSchema.safeParse({
      name: "Test User",
      email: "user@example.com",
      password: "example-password",
      signupRole: "OWNER",
      role: "ADMIN",
    });

    expect(result.success).toBe(false);
  });
});
