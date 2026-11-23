import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";
import { getEnv } from "@/server/env";

type AuthInstance = ReturnType<typeof createAuth>;

function createAuth() {
  const env = getEnv();
  return betterAuth({
    appName: "SME Connect",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL, env.BETTER_AUTH_URL],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        // Server-owned: clients cannot escalate to ADMIN during sign-up.
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
}

let cachedAuth: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!cachedAuth) {
    cachedAuth = createAuth();
  }
  return cachedAuth;
}

export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop, receiver) {
    const instance = getAuth();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
