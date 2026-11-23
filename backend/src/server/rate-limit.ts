import { AppError } from "@/server/errors";

export class RateLimitError extends AppError {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super(
      "RATE_LIMITED",
      "Too many requests. Please wait a moment and try again.",
      429,
      { retryAfterSec },
    );
    this.retryAfterSec = retryAfterSec;
  }
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  /** Bounds in-memory Map growth to protect against memory-exhaustion DoS. */
  maxEntries?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Bounded fixed-window rate limiter.
 * Local single-node implementation; swap for Redis INCR/EXPIRE when scaling horizontally.
 */
export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  check(key: string, now = Date.now()): { remaining: number; resetAt: number } {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      if (this.buckets.size >= this.maxEntries) {
        this.evict(now);
      }
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { remaining: Math.max(0, this.maxRequests - 1), resetAt };
    }

    existing.count += 1;
    if (existing.count > this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      throw new RateLimitError(retryAfterSec);
    }

    return { remaining: Math.max(0, this.maxRequests - existing.count), resetAt: existing.resetAt };
  }

  private evict(now: number) {
    for (const [k, v] of this.buckets) {
      if (v.resetAt <= now) this.buckets.delete(k);
    }
    if (this.buckets.size >= this.maxEntries) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey !== undefined) this.buckets.delete(oldestKey);
    }
  }
}

export const authRateLimiter = new InMemoryRateLimiter({ windowMs: 15 * 60_000, maxRequests: 15 });
export const messageRateLimiter = new InMemoryRateLimiter({ windowMs: 60_000, maxRequests: 30 });
export const writeRateLimiter = new InMemoryRateLimiter({ windowMs: 60_000, maxRequests: 20 });
