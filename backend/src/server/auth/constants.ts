/** Shared OTP lifetime in seconds for Better Auth and authentication emails. */
export const OTP_EXPIRY_SECONDS = 300;

/** Default assigned to every newly created user; never client-supplied. */
export const DEFAULT_USER_STATUS = "ACTIVE";

/** Better Auth's httpOnly session cookie, also used by the optimistic proxy. */
export const SESSION_COOKIE_NAME = "better-auth.session_token";

/** Local phone OTP limits. Email OTP limits live in the Better Auth plugin config. */
export const PHONE_OTP_MAX_ATTEMPTS = 3;
export const PHONE_OTP_RESEND_COOLDOWN_SECONDS = 60;
export const PHONE_OTP_IDENTIFIER_PREFIX = "phone-otp:phone-verification";
