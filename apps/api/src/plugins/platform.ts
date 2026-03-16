import type { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { getEnv } from "../config/env.js";

export function registerPlatformPlugins(app: Hono) {
  const env = getEnv();

  app.use("*", logger());
  app.use(
    "*",
    cors({
    origin: env.ALLOWED_WEB_ORIGIN,
    credentials: true
    })
  );
  app.use(
    "*",
    secureHeaders()
  );
}
