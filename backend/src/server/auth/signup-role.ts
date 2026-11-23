import { APIError, createAuthMiddleware } from "better-auth/api";
import { DEFAULT_USER_STATUS } from "@/server/auth/constants";
import { signupRoleSchema } from "@/server/validators/enums";

type SignupRole = (typeof signupRoleSchema.options)[number];

export const SIGNUP_EMAIL_PATH = "/sign-up/email";

function invalidRoleError(): APIError {
  return APIError.fromStatus("BAD_REQUEST", {
    code: "INVALID_SIGNUP_ROLE",
    message: "Choose OWNER or INVESTOR when signing up",
  });
}

/**
 * Converts the transport-only `signupRole` into the existing `role` column.
 * Client-supplied `role`/`status` values are discarded before Better Auth
 * parses user input, so an ADMIN role can never enter the signup pipeline.
 */
export function normalizeSignupBody(
  body: Record<string, unknown>,
): Record<string, unknown> & { role: SignupRole } {
  const parsed = signupRoleSchema.safeParse(body.signupRole);
  if (!parsed.success) throw invalidRoleError();

  const safeBody = { ...body };
  delete safeBody.signupRole;
  delete safeBody.role;
  delete safeBody.status;

  return { ...safeBody, role: parsed.data };
}

/** Better Auth request hook that applies signup role selection without a new DB column. */
export const signupRoleRequestHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== SIGNUP_EMAIL_PATH) return;

  return {
    context: {
      body: normalizeSignupBody((ctx.body ?? {}) as Record<string, unknown>),
    },
  };
});

/** Final server-side guard before a user row is created. */
export function resolveCreatedUser<T extends Record<string, unknown>>(
  data: T,
): Omit<T, "signupRole" | "role" | "status"> & {
  role: SignupRole;
  status: typeof DEFAULT_USER_STATUS;
} {
  const parsed = signupRoleSchema.safeParse(data.role);
  if (!parsed.success) throw invalidRoleError();

  const safeData = { ...data };
  delete safeData.signupRole;
  delete safeData.role;
  delete safeData.status;

  return {
    ...safeData,
    role: parsed.data,
    status: DEFAULT_USER_STATUS,
  } as Omit<T, "signupRole" | "role" | "status"> & {
    role: SignupRole;
    status: typeof DEFAULT_USER_STATUS;
  };
}

/** `/update-user` must never change server-owned role or status. */
export function stripProtectedUserFieldsFromUpdate<
  T extends Record<string, unknown>,
>(data: T): Omit<T, "signupRole" | "role" | "status"> {
  const safeData = { ...data };
  delete safeData.signupRole;
  delete safeData.role;
  delete safeData.status;

  return safeData as Omit<T, "signupRole" | "role" | "status">;
}
