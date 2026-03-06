import type { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { getEnv } from "../config/env.js";

export async function registerOpenApiPlugins(app: FastifyInstance) {
  const env = getEnv();
  if (env.NODE_ENV === "production") {
    return;
  }

  const servers: Array<{ url: string; description: string }> = [
    {
      url: "/",
      description: "Same origin"
    }
  ];

  if (env.API_BASE_URL) {
    servers.push({
      url: env.API_BASE_URL,
      description: "Configured local API base URL"
    });
  }

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Turbo Startup API",
        description: "Fastify auth API (single backend business-logic source of truth).",
        version: "1.0.0"
      },
      servers,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    }
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    staticCSP: true,
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
      tryItOutEnabled: true
    }
  });
}
