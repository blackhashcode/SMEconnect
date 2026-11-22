import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

if (!baseURL) {
  throw new Error("BETTER_AUTH_URL is not set");
}

/**
 * Minimal Phase 0 configuration. Sign-up, OTP, verification emails and the
 * Better Auth route handler are added in Phase 2.
 */
export const auth = betterAuth({
  appName: "SME Connect",
  baseURL,
  secret,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // Server-owned: clients must never choose their own role.
      role: {
        type: "string",
        required: true,
        defaultValue: "OWNER",
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
});
