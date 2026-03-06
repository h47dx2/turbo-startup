import Fastify from "fastify";
import { getEnv } from "./config/env.js";
import { registerPlatformPlugins } from "./plugins/platform.js";
import { registerOpenApiPlugins } from "./plugins/openapi.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth/index.js";

export async function buildApp() {
  const env = getEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug"
    },
    trustProxy: env.TRUST_PROXY
  });

  await registerPlatformPlugins(app);
  await registerOpenApiPlugins(app);
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerErrorHandler(app);

  return app;
}
