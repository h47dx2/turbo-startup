import { Hono } from "hono";
import { getEnv } from "./config/env.js";
import { registerPlatformPlugins } from "./plugins/platform.js";
import { registerOpenApiPlugins } from "./plugins/openapi.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth/index.js";

export async function buildApp() {
  getEnv();
  const app = new Hono();

  registerPlatformPlugins(app);
  registerOpenApiPlugins(app);
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerErrorHandler(app);

  return app;
}
