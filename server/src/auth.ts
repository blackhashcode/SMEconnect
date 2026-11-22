import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config.ts";
import { get, run } from "./db.ts";
import { toSessionUser, type SessionUser, type UserRow } from "./models.ts";

// ---------- Passwords ----------

export const hashPassword = (password: string) => bcrypt.hash(password, config.bcryptRounds);

// Compared against when the email is unknown, so a miss takes as long as a hit
// and response timing doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", config.bcryptRounds);

export async function verifyPassword(password: string, hash: string | undefined) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && hash !== undefined;
}

// ---------- Sessions ----------
// The browser holds a random token; the database only stores its SHA-256, so a
// leaked database can't be used to hijack sessions.

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

/** Attaches req.user when the request carries a valid, unexpired session. */
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
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  next();
}

// ---------- Rate limiting ----------
// Small in-memory fixed-window limiter for login and signup. Fine for a single
// process; swap for a shared store (e.g. Redis) if the API is scaled out.

export function rateLimit({ windowMs, max, key }: { windowMs: number; max: number; key: (req: Request) => string }) {
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
      hits.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
      return;
    }
    next();
  };
}
