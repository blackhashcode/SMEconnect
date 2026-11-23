import "@/server/openapi/setup";
import { z } from "zod";
import { ROLES } from "@/server/auth/roles";

export const roleSchema = z.enum(ROLES);
export const signupRoleSchema = z.enum(["OWNER", "INVESTOR"]);
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

export const verificationTypeSchema = z.enum(["OWNER", "INVESTOR"]);
export const verificationStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const repaymentFrequencySchema = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
]);

export const loanRequestStatusSchema = z.enum([
  "DRAFT",
  "OPEN",
  "IN_DISCUSSION",
  "FUNDED",
  "REPAYING",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
]);

export const offerStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "COUNTERED",
  "WITHDRAWN",
  "EXPIRED",
]);

export const offerProposerSchema = z.enum(["OWNER", "INVESTOR"]);

export const loanStatusSchema = z.enum([
  "PENDING_AGREEMENT",
  "ACTIVE",
  "COMPLETED",
  "DEFAULTED",
]);

export const repaymentStatusSchema = z.enum([
  "UPCOMING",
  "MARKED_PAID",
  "CONFIRMED",
  "OVERDUE",
]);

export const postTypeSchema = z.enum([
  "UPDATE",
  "MILESTONE",
  "LOAN_REQUEST",
  "REPAYMENT",
]);

export const connectionStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
]);

export const notificationTypeSchema = z.enum([
  "OFFER_RECEIVED",
  "OFFER_COUNTERED",
  "OFFER_ACCEPTED",
  "AGREEMENT_CONFIRMED",
  "MESSAGE_RECEIVED",
  "CONNECTION_REQUEST",
  "CONNECTION_ACCEPTED",
  "VERIFICATION_RESULT",
  "REPAYMENT_DUE",
  "REPAYMENT_OVERDUE",
  "REPAYMENT_MARKED_PAID",
  "REPAYMENT_CONFIRMED",
  "NEW_COMMENT",
  "NEW_LIKE",
]);

export const reportTargetTypeSchema = z.enum([
  "USER",
  "POST",
  "COMMENT",
  "MESSAGE",
]);

export const reportStatusSchema = z.enum(["OPEN", "RESOLVED", "DISMISSED"]);
