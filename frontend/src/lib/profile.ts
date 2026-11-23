import type { Person } from "@/data/types";

/** Where a member's public profile lives. Businesses are keyed by their owner's user id. */
export function profileHref(person: Pick<Person, "id" | "role">) {
  return person.role === "business" ? `/businesses/${person.id}` : `/investors/${person.id}`;
}

const ORIGIN = "http://same-origin.invalid";

/**
 * Only allow redirects back into this site (e.g. "/explore"), never to another
 * origin, so ?next= can't be used for phishing. Browsers ignore tabs and
 * newlines in URLs ("/\t/evil.com" becomes "//evil.com"), so any control
 * character or backslash is rejected outright, and the result is re-checked
 * by resolving it against a dummy origin.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/feed") {
  // eslint-disable-next-line no-control-regex
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, ORIGIN);
    if (url.origin !== ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
