import "@/server/openapi/setup";
import { z } from "zod";
import {
  emailSchema,
  isoDateTimeSchema,
  urlSchema,
} from "@/server/validators/common";
import {
  roleSchema,
  signupRoleSchema,
  userStatusSchema,
} from "@/server/validators/enums";

const authPasswordSchema = z.string().min(8).max(128);
const otpSchema = z.string().regex(/^\d{6}$/);

/** Better Auth's native user output, including the output-only role/status. */
export const authUserSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: emailSchema,
    emailVerified: z.boolean(),
    image: z.string().nullable().optional(),
    role: roleSchema,
    status: userStatusSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough();

export const authSessionSchema = z
  .object({
    id: z.string().min(1),
    token: z.string().min(1),
    userId: z.string().min(1),
    expiresAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema.optional(),
    updatedAt: isoDateTimeSchema.optional(),
  })
  .passthrough();

export const signUpEmailRequestSchema = z
  .object({
    name: z.string().trim().min(1),
    email: emailSchema,
    password: authPasswordSchema,
    signupRole: signupRoleSchema,
    image: urlSchema.optional(),
    callbackURL: z.string().optional(),
    rememberMe: z.boolean().optional(),
  })
  .strict();

export const signInEmailRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1),
    rememberMe: z.boolean().optional(),
    callbackURL: z.string().optional(),
  })
  .strict();

export const authUserResultSchema = z.object({
  token: z.string().nullable(),
  user: authUserSchema,
});

export const authSuccessResponseSchema = z.object({
  success: z.literal(true),
});

export const authStatusResponseSchema = z.object({
  status: z.literal(true),
});

export const getSessionResponseSchema = z.object({
  session: authSessionSchema,
  user: authUserSchema,
});

export const sendVerificationOtpRequestSchema = z
  .object({
    email: emailSchema,
    type: z.enum(["email-verification", "forget-password"]),
  })
  .strict();

export const verifyEmailOtpRequestSchema = z
  .object({
    email: emailSchema,
    otp: otpSchema,
  })
  .strict();

export const verifyEmailOtpResponseSchema = z.object({
  status: z.literal(true),
  token: z.string().nullable(),
  user: authUserSchema,
});

export const requestPasswordResetOtpRequestSchema = z
  .object({ email: emailSchema })
  .strict();

export const resetPasswordOtpRequestSchema = z
  .object({
    email: emailSchema,
    otp: otpSchema,
    password: authPasswordSchema,
  })
  .strict();

export const updateAuthUserRequestSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    image: urlSchema.nullable().optional(),
  })
  .strict();
