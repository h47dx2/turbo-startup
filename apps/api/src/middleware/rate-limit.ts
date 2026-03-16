import { createMiddleware } from "hono/factory";

type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const counters = new Map<string, Counter>();

  return createMiddleware(async (c, next) => {
    const now = Date.now();
    const ipFromForwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = ipFromForwarded || c.req.header("x-real-ip") || "global";
    const key = `${c.req.path}:${ip}`;
    const existing = counters.get(key);

    if (!existing || existing.resetAt <= now) {
      counters.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      c.header("retry-after", String(retryAfterSeconds));
      return c.json(
        {
          error: {
            code: "rate_limited",
            message: "Too many requests"
          }
        },
        429
      );
    }

    existing.count += 1;
    counters.set(key, existing);
    await next();
  });
}
