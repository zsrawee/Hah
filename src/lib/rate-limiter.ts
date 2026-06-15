/**
 * Simple in-memory rate limiter for Vercel serverless.
 * Uses a sliding window approach with a Map.
 * Note: On Vercel, each serverless instance has its own memory,
 * so this is a best-effort rate limiter. For production, use
 * Upstash Redis or similar.
 */

interface LimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, LimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000).unref();

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

const DEFAULTS: RateLimitOptions = {
  max: 60,
  windowSeconds: 60,
};

/**
 * Returns true if the request is within the rate limit.
 * The key is typically the IP address or a combination of IP + route.
 */
export function rateLimit(
  key: string,
  options: Partial<RateLimitOptions> = {},
): { allowed: boolean; remaining: number; resetAt: number } {
  const { max, windowSeconds } = { ...DEFAULTS, ...options };
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: max - 1, resetAt: now + windowSeconds * 1000 };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/**
 * Extract a reasonable client IP from a NextRequest.
 */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as any).get?.('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0]?.trim() || 'unknown';
  return ip;
}
