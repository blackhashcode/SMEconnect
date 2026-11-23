import { describe, expect, it } from "vitest";
import {
  assertOwnership,
  assertRole,
  assertVerified,
  verificationTypeForRole,
} from "@/server/auth/policy";
import { ForbiddenError } from "@/server/errors";

const owner = { id: "usr_owner", role: "OWNER" as const };
const investor = { id: "usr_investor", role: "INVESTOR" as const };
const admin = { id: "usr_admin", role: "ADMIN" as const };

describe("role policy", () => {
  it("allows listed roles and rejects the rest", () => {
    expect(() => assertRole(owner, "OWNER", "ADMIN")).not.toThrow();
    expect(() => assertRole(investor, "OWNER")).toThrow(ForbiddenError);
    expect(() => assertRole({ id: "usr_1" }, "OWNER")).toThrow(ForbiddenError);
  });

  it("maps only owner and investor roles to verification types", () => {
    expect(verificationTypeForRole(owner.role)).toBe("OWNER");
    expect(verificationTypeForRole(investor.role)).toBe("INVESTOR");
    expect(() => verificationTypeForRole(admin.role)).toThrow(ForbiddenError);
  });
});

describe("ownership policy", () => {
  it("allows the resource owner", () => {
    expect(() => assertOwnership(owner.id, owner)).not.toThrow();
  });

  it("rejects another user unless admin bypass is explicit", () => {
    expect(() => assertOwnership(owner.id, investor)).toThrow(ForbiddenError);
    expect(() => assertOwnership(owner.id, investor, { allowAdmin: true })).toThrow(
      ForbiddenError,
    );
    expect(() => assertOwnership(owner.id, admin, { allowAdmin: true })).not.toThrow();
    expect(() => assertOwnership(owner.id, admin)).toThrow(ForbiddenError);
  });
});

describe("verification gate", () => {
  it("requires an approved verification for the actor", () => {
    expect(() => assertVerified(owner, "APPROVED")).not.toThrow();
    expect(() => assertVerified(owner, null)).toThrow(ForbiddenError);
    expect(() => assertVerified(owner, "PENDING")).toThrow(ForbiddenError);
    expect(() => assertVerified(admin, "APPROVED")).toThrow(ForbiddenError);
  });
});
