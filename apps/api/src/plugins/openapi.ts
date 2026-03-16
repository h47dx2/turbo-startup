import type { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { getEnv } from "../config/env.js";

export function registerOpenApiPlugins(app: Hono) {
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

  app.get("/openapi.json", (c) =>
    c.json({
      openapi: "3.1.0",
      info: {
        title: "Turbo Startup API",
        description: "Hono auth API (single backend business-logic source of truth).",
        version: "1.0.0"
      },
      servers,
      paths: {
        "/health": {
          get: {
            tags: ["Health"],
            summary: "Liveness probe",
            responses: {
              "200": {
                description: "OK"
              }
            }
          }
        },
        "/ready": {
          get: {
            tags: ["Health"],
            summary: "Readiness probe",
            responses: {
              "200": {
                description: "OK"
              }
            }
          }
        },
        "/auth/csrf": {
          get: {
            tags: ["Auth"],
            summary: "Issue CSRF token for web cookie flows",
            responses: {
              "200": {
                description: "OK"
              }
            }
          }
        },
        "/auth/register": {
          post: {
            tags: ["Auth"],
            summary: "Register a new user",
            responses: {
              "200": { description: "OK" },
              "400": { description: "Bad Request" },
              "401": { description: "Unauthorized" },
              "409": { description: "Conflict" }
            }
          }
        },
        "/auth/login": {
          post: {
            tags: ["Auth"],
            summary: "Login with email/password",
            responses: {
              "200": { description: "OK" },
              "400": { description: "Bad Request" },
              "401": { description: "Unauthorized" }
            }
          }
        },
        "/auth/refresh": {
          post: {
            tags: ["Auth"],
            summary: "Rotate refresh token and issue new access token",
            responses: {
              "200": { description: "OK" },
              "400": { description: "Bad Request" },
              "401": { description: "Unauthorized" }
            }
          }
        },
        "/auth/logout": {
          post: {
            tags: ["Auth"],
            summary: "Revoke current refresh token",
            responses: {
              "200": { description: "OK" },
              "400": { description: "Bad Request" },
              "401": { description: "Unauthorized" }
            }
          }
        },
        "/auth/me": {
          get: {
            tags: ["Auth"],
            summary: "Get current user from access token",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": { description: "OK" },
              "401": { description: "Unauthorized" }
            }
          }
        },
        "/auth/logout-all": {
          post: {
            tags: ["Auth"],
            summary: "Revoke all active refresh tokens for current user",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": { description: "OK" },
              "401": { description: "Unauthorized" }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    })
  );

  app.get("/docs", swaggerUI({ url: "/openapi.json" }));
}
