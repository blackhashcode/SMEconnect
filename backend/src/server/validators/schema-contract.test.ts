import { describe, expect, it } from "vitest";
import * as PrismaEnums from "@/generated/prisma/enums";
import {
  connectionStatusSchema,
  verificationTypeSchema,
  offerStatusSchema,
  loanRequestStatusSchema,
  loanStatusSchema,
  notificationTypeSchema,
  postTypeSchema,
  ratePctSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
  repaymentFrequencySchema,
  repaymentStatusSchema,
  roleSchema,
  signupRoleSchema,
  userStatusSchema,
  verificationStatusSchema,
} from "@/server/validators";

type EnumObject = Record<string, string>;

function prismaValues(name: keyof typeof PrismaEnums): string[] {
  return Object.values(PrismaEnums[name] as EnumObject);
}

function validatorValues(schema: { options: readonly unknown[] }): string[] {
  return schema.options as string[];
}

describe("validator/Prisma enum contract", () => {
  it.each([
    ["roleSchema", roleSchema, "Role"],
    ["userStatusSchema", userStatusSchema, "UserStatus"],
    ["verificationTypeSchema", verificationTypeSchema, "VerificationType"],
    ["verificationStatusSchema", verificationStatusSchema, "VerificationStatus"],
    ["repaymentFrequencySchema", repaymentFrequencySchema, "RepaymentFrequency"],
    ["loanRequestStatusSchema", loanRequestStatusSchema, "LoanRequestStatus"],
    ["offerStatusSchema", offerStatusSchema, "OfferStatus"],
    ["loanStatusSchema", loanStatusSchema, "LoanStatus"],
    ["repaymentStatusSchema", repaymentStatusSchema, "RepaymentStatus"],
    ["postTypeSchema", postTypeSchema, "PostType"],
    ["connectionStatusSchema", connectionStatusSchema, "ConnectionStatus"],
    ["notificationTypeSchema", notificationTypeSchema, "NotificationType"],
    ["reportTargetTypeSchema", reportTargetTypeSchema, "ReportTargetType"],
    ["reportStatusSchema", reportStatusSchema, "ReportStatus"],
  ] as const)("%s matches Prisma %s", (_label, schema, prismaName) => {
    expect(validatorValues(schema)).toEqual(prismaValues(prismaName));
  });

  it("keeps ADMIN out of the public signup role choices", () => {
    expect(validatorValues(signupRoleSchema)).toEqual(["OWNER", "INVESTOR"]);
  });

  it("does not weaken the rate validator to a free-form string", () => {
    expect(ratePctSchema.safeParse("12.345").success).toBe(false);
  });
});
