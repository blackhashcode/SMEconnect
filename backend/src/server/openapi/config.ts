import pkg from "../../../package.json";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

export const API_TITLE = "SME Connect API";
export const API_DESCRIPTION =
  "Backend API for SME Connect, a networking and lending platform for verified Bangladeshi small businesses and individual investors.";
export const API_VERSION = pkg.version;

/** Tags are declared up front so future modules can be slotted in without reworking the document. */
export const API_TAGS = [
  { name: "Health", description: "Service and dependency health checks" },
  { name: "Authentication", description: "Better Auth sign-up, sign-in and session endpoints" },
  { name: "Users", description: "Current user and account-level operations" },
  { name: "Business profiles", description: "Owner business profiles and product images" },
  { name: "Investor profiles", description: "Investor profiles and lending preferences" },
  { name: "Verification", description: "Owner and investor verification submissions and review" },
  { name: "Loan requests", description: "Owner-created loan requests and their lifecycle" },
  { name: "Offers", description: "Investor offers, counter-offers and responses" },
  { name: "Loans and agreements", description: "Funded loans and dual-confirmation agreements" },
  { name: "Repayments", description: "Repayment schedules, mark-paid and confirmation flows" },
  { name: "Feed and networking", description: "Posts, likes, comments, follows and connections" },
  { name: "Discovery", description: "Approved public business and investor search plus suggestions" },
  { name: "Messaging", description: "Conversations and direct messages" },
  { name: "Notifications", description: "In-app notifications and unread counts" },
  { name: "Administration", description: "Verification queue, moderation, reports and analytics" },
] as const;

export const API_DOC_INFO = {
  title: API_TITLE,
  version: API_VERSION,
  description: API_DESCRIPTION,
} as const;

export const SECURITY_SCHEME_NAME = "BetterAuthSession";
export const BETTER_AUTH_SESSION_COOKIE = SESSION_COOKIE_NAME;

/**
 * Docs are on by default locally and off by default in production.
 * Explicit API_DOCS_ENABLED=true/false always wins.
 */
export function isApiDocsEnabled(): boolean {
  const flag = process.env.API_DOCS_ENABLED?.trim().toLowerCase();

  if (flag === "true") return true;
  if (flag === "false") return false;

  return process.env.NODE_ENV !== "production";
}

/** Prefer the live request origin so Try it out always calls the current host. */
export function resolveServerUrl(requestUrl?: string): string | undefined {
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      // Fall through to configured APP_URL.
    }
  }

  const configured = process.env.APP_URL?.trim();
  return configured ? configured.replace(/\/+$/, "") : undefined;
}
