import "@/server/openapi/setup";
import { z } from "zod";
import { phoneSchema } from "@/server/validators/user";

const otpSchema = z
  .string()
  .regex(/^\d{6}$/, "OTP must be exactly six digits")
  .openapi({ description: "Six-digit phone OTP", example: "123456" });

export const requestPhoneOtpSchema = z
  .object({ phone: phoneSchema })
  .strict();

export const verifyPhoneOtpSchema = z
  .object({ phone: phoneSchema, otp: otpSchema })
  .strict();

export const phoneOtpResultSchema = z
  .object({
    phone: phoneSchema,
    expiresInSeconds: z.number().int().positive(),
    sentVia: z.enum(["email", "console", "sms"]),
  })
  .strict();

export const phoneVerificationResultSchema = z
  .object({
    phone: phoneSchema,
    phoneVerified: z.literal(true),
  })
  .strict();
