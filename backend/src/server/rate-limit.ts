import { RateLimitError } from "@/server/errors";

export type RateLimitAction = "message:send" | "upload:create";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export type RateLimitRules = Record<RateLimitAction, RateLimitRule>;

type RateLimitStore = Map<string, number[]>;

const DEFAULT_RULES: RateLimitRules = {
  "message:send": { limit: 30, windowMs: 60_000 },
  "upload:create": { limit: 20, windowMs: 10 * 60_000 },
};

const globalForRateLimit = globalThis as unknown as {
  smeconnectRateLimitStore?: RateLimitStore;
};

const defaultStore: RateLimitStore =
  globalForRateLimit.smeconnectRateLimitStore ?? new Map<string, number[]>();
globalForRateLimit.smeconnectRateLimitStore = defaultStore;

function positiveIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function rateLimitRulesFromEnv(env: NodeJS.ProcessEnv): RateLimitRules {
  return {
    "message:send": {
      limit: positiveIntEnv(env.MESSAGE_RATE_LIMIT_MAX, DEFAULT_RULES["message:send"].limit),
      windowMs:
        positiveIntEnv(
          env.MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
          DEFAULT_RULES["message:send"].windowMs / 1000,
        ) * 1000,
    },
    "upload:create": DEFAULT_RULES["upload:create"],
  };
}

export interface RateLimitCheckOptions {
  store?: RateLimitStore;
  rules?: RateLimitRules;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function pruneStore(store: RateLimitStore, cutoff: number): void {
  if (store.size <= 1000) return;
  for (const [key, timestamps] of store) {
    if (timestamps.every((timestamp) => timestamp <= cutoff)) {
      store.delete(key);
    }
  }
}

/**
 * Small in-process sliding-window limiter for endpoints that Better Auth and
 * the OTP service do not cover. A shared Redis store is the production upgrade.
 */
export function checkRateLimit(
  action: RateLimitAction,
  key: string,
  options: RateLimitCheckOptions = {},
): RateLimitResult {
  const store = options.store ?? defaultStore;
  const rules = options.rules ?? rateLimitRulesFromEnv(options.env ?? process.env);
  const rule = rules[action];
  const now = (options.now ?? (() => new Date()))().getTime();
  const cutoff = now - rule.windowMs;
  const stored = (store.get(`${action}:${key}`) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (stored.length >= rule.limit) {
    store.set(`${action}:${key}`, stored);
    const retryAfterMs = Math.max(1, (stored[0] ?? now) + rule.windowMs - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  stored.push(now);
  store.set(`${action}:${key}`, stored);
  pruneStore(store, cutoff);
  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - stored.length),
    retryAfterSeconds: 0,
  };
}

export function assertRateLimit(
  action: RateLimitAction,
  key: string,
  options: RateLimitCheckOptions = {},
): void {
  const result = checkRateLimit(action, key, options);
  if (!result.allowed) {
    throw new RateLimitError("Too many messages. Please slow down.", {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

/**
 * Fixed-window counter in Postgres: one atomic upsert per request, so the limit
 * is shared by every API instance (serverless functions don't share memory).
 */
async function hitSharedWindow(key: string, rule: RateLimitRule, now: Date) {
  const windowCutoff = new Date(now.getTime() - rule.windowMs);
  // Imported lazily so the in-memory limiter works without a database (tests, dev).
  const { prisma } = await import("@/server/db");
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "api_rate_limit" ("key", "windowStart", "count")
    VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "api_rate_limit"."windowStart" <= ${windowCutoff} THEN 1 ELSE "api_rate_limit"."count" + 1 END,
      "windowStart" = CASE WHEN "api_rate_limit"."windowStart" <= ${windowCutoff} THEN ${now} ELSE "api_rate_limit"."windowStart" END
    RETURNING "count", "windowStart"`;
  return rows[0];
}

/**
 * Route-level limiter. Uses the shared Postgres store when
 * RATE_LIMIT_STORE=database (set this in production), otherwise the
 * in-process limiter above, which is fine for a single dev server.
 */
export async function enforceRateLimit(action: RateLimitAction, key: string): Promise<void> {
  if (process.env.RATE_LIMIT_STORE !== "database") {
    assertRateLimit(action, key);
    return;
  }
  const rule = rateLimitRulesFromEnv(process.env)[action];
  const now = new Date();
  const hit = await hitSharedWindow(`${action}:${key}`, rule, now);
  if (hit && hit.count > rule.limit) {
    const retryAfterMs = hit.windowStart.getTime() + rule.windowMs - now.getTime();
    throw new RateLimitError("Too many requests. Please slow down.", {
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    });
  }
}
