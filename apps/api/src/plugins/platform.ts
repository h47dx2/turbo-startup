import type { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySensible from "@fastify/sensible";
import { getEnv } from "../config/env.js";

export async function registerPlatformPlugins(app: FastifyInstance) {
  const env = getEnv();

  await app.register(fastifyCookie);

  await app.register(fastifyCors, {
    origin: env.ALLOWED_WEB_ORIGIN,
    credentials: true
  });

  await app.register(fastifyHelmet);
  await app.register(fastifySensible);

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute"
  });
}
