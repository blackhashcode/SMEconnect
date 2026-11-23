import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins/email-otp";
import { nextCookies } from "better-auth/next-js";
import {
  DEFAULT_USER_STATUS,
  OTP_EXPIRY_SECONDS,
} from "@/server/auth/constants";
import {
  resolveCreatedUser,
  signupRoleRequestHook,
  socialSignupRole,
  stripProtectedUserFieldsFromUpdate,
} from "@/server/auth/signup-role";
import { prisma } from "@/server/db";
import { sendAuthOtpEmail } from "@/server/notifications/auth-otp";
import { recordAudit } from "@/server/services/audit-log";
import { signupRoleSchema } from "@/server/validators/enums";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

if (!baseURL) {
  throw new Error("BETTER_AUTH_URL is not set");
}

/** Google sign-in is on only when both credentials are configured. */
export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
);

// Browsers reach the API through the frontend's /api/v1 rewrite, so Google must
// redirect back to the frontend origin (where the OAuth state cookie lives).
const publicOrigin = (process.env.APP_URL || baseURL).replace(/\/+$/, "");

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const SEVEN_DAYS_IN_SECONDS = ONE_DAY_IN_SECONDS * 7;

function readTrustedOrigins(): string[] {
  const configured = process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (!configured?.trim()) return [];

  return configured.split(",").map((origin) => {
    const value = origin.trim().replace(/\/+$/, "");
    try {
      new URL(value);
      return value;
    } catch {
      throw new Error("BETTER_AUTH_TRUSTED_ORIGINS contains an invalid URL");
    }
  });
}

/**
 * Phase 2 authentication configuration. The HTTP catch-all is mounted in
 * `src/app/api/v1/auth/[...all]/route.ts`.
 */
export const auth = betterAuth({
  appName: "SME Connect",
  baseURL,
  basePath: "/api/v1/auth",
  trustedOrigins: readTrustedOrigins(),
  secret,
  advanced: {
    // Behind Vercel (and the frontend's /api/v1 rewrite) the visitor's IP is in
    // these headers; rate limits must key on it, not on the proxy's address.
    ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"] },
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  socialProviders: googleAuthEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
          redirectURI: `${publicOrigin}/api/v1/auth/callback/google`,
          prompt: "select_account",
        },
      }
    : {},
  account: {
    // Google confirms the email address, so an existing email account and a
    // Google sign-in with the same address become one member.
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: OTP_EXPIRY_SECONDS,
  },
  session: {
    expiresIn: SEVEN_DAYS_IN_SECONDS,
    updateAge: ONE_DAY_IN_SECONDS,
    // Keep role/status fresh on every request; no stale cached session user.
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    // "database" shares counters across serverless instances (RATE_LIMIT_STORE=database).
    storage: process.env.RATE_LIMIT_STORE === "database" ? "database" : "memory",
    window: 10,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 60, max: 5 },
      "/sign-in/email": { window: 60, max: 10 },
    },
  },
  user: {
    additionalFields: {
      // Maps to the existing User.role column. The request hook derives it
      // from the validated signupRole choice; the update hook forbids changes.
      role: {
        type: "string",
        required: true,
        defaultValue: "OWNER",
        input: true,
        validator: { input: signupRoleSchema },
      },
      // Server-owned output-only status; clients can never set it.
      status: {
        type: "string",
        required: true,
        defaultValue: DEFAULT_USER_STATUS,
        input: false,
      },
    },
  },
  hooks: {
    before: signupRoleRequestHook,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          // Social sign-ups have no request body with signupRole; use the cookie.
          const isSocial = context?.path?.startsWith("/callback/") ?? false;
          const input = isSocial
            ? { ...user, role: socialSignupRole(context?.headers?.get("cookie")) }
            : user;
          return { data: resolveCreatedUser(input) };
        },
        after: async (user, context) => {
          await recordAudit({
            actorId: user.id,
            action: "account.created",
            targetType: "USER",
            targetId: user.id,
            detail: {
              role: (user as { role?: string }).role ?? null,
              method: context?.path?.startsWith("/callback/") ? "google" : "email",
            },
          });
        },
      },
      update: {
        before: async (user) => ({
          data: stripProtectedUserFieldsFromUpdate(user),
        }),
      },
    },
    session: {
      create: {
        // Every new session is a sign-in (password, email code or Google).
        after: async (session) => {
          await recordAudit({
            actorId: session.userId,
            action: "auth.sign_in",
            targetType: "USER",
            targetId: session.userId,
            detail: { userAgent: session.userAgent?.slice(0, 200) ?? null },
            ipAddress: session.ipAddress ?? null,
          });
        },
      },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: OTP_EXPIRY_SECONDS,
      storeOTP: "hashed",
      allowedAttempts: 3,
      resendStrategy: "rotate",
      overrideDefaultEmailVerification: true,
      // Awaiting keeps failures visible: auth must not claim an email was sent.
      // The OTP is only passed to the template, never logged.
      sendVerificationOTP: (data) => sendAuthOtpEmail(data),
    }),
    // nextCookies must remain the last plugin.
    nextCookies(),
  ],
  disabledPaths: [
    "/email-otp/get-verification-otp",
    "/email-otp/create-verification-otp",
    "/email-otp/check-verification-otp",
    "/sign-in/email-otp",
    "/forget-password/email-otp",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
    "/send-verification-email",
    "/verify-email",
    "/request-password-reset",
    "/reset-password",
    "/delete-user",
  ],
});
