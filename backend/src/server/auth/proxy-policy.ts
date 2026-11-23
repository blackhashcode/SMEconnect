/**
 * Prefixes that the optimistic proxy pre-filters. These are intentionally
 * narrow: the real session, role and ownership checks live in route guards.
 */
export const PROTECTED_API_PREFIXES = [
  "/api/v1/me",
  "/api/v1/verifications",
  "/api/v1/admin",
  "/api/v1/uploads",
  "/api/v1/phone-otp",
  "/api/v1/files/private",
] as const;

export function isProtectedApiPath(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
