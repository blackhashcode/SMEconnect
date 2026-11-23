import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.ts";
import { get, run } from "./db.ts";
import { fail } from "./http.ts";
import { toSessionUser, type SessionUser, type UserRow } from "./models.ts";

// ---------- Passwords ----------

export const hashPassword = (password: string) => bcrypt.hash(password, config.bcryptRounds);

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", config.bcryptRounds);

export async function verifyPassword(password: string, hash: string | undefined) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && hash !== undefined;
}

// ---------- Sessions ----------

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export function createSession(res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
    sha256(token),
    userId,
    now,
    now + config.sessionTtlMs,
  ]);
  res.cookie(config.sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    maxAge: config.sessionTtlMs,
  });
}

export function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[config.sessionCookie];
  if (typeof token === "string" && token) run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  res.clearCookie(config.sessionCookie, { path: "/", httpOnly: true, sameSite: "lax", secure: config.isProduction });
}

export function purgeExpiredSessions() {
  run("DELETE FROM sessions WHERE expires_at < ?", [Date.now()]);
}

export function loadSessionUser(userId: string): SessionUser | undefined {
  const row = get<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  if (!row) return undefined;
  const business = get<{ id: string }>("SELECT id FROM businesses WHERE owner_id = ? LIMIT 1", [row.id]);
  return toSessionUser(row, business?.id);
}

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

export function readSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[config.sessionCookie];
  if (typeof token === "string" && token) {
    const session = get<{ user_id: string; expires_at: number }>(
      "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?",
      [sha256(token)],
    );
    if (session && session.expires_at > Date.now()) req.user = loadSessionUser(session.user_id);
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    fail(res, 401, "UNAUTHORIZED", "Please log in to continue.");
    return;
  }
  next();
}

// ---------- Bounded Rate Limiting ----------

export function rateLimit({
  windowMs,
  max,
  maxEntries = 10_000,
  key,
}: {
  windowMs: number;
  max: number;
  maxEntries?: number;
  key: (req: Request) => string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const k = key(req);
    const entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      if (hits.size >= maxEntries) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      hits.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfter);
      fail(res, 429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", {
        retryAfterSec: retryAfter,
      });
      return;
    }
    next();
  };
}
