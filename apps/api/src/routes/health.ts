import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness probe",
        response: {
          200: {
            type: "object",
            required: ["ok"],
            properties: {
              ok: { type: "boolean", const: true }
            }
          }
        }
      }
    },
    async () => ({ ok: true })
  );

  app.get(
    "/ready",
    {
      schema: {
        tags: ["Health"],
        summary: "Readiness probe",
        response: {
          200: {
            type: "object",
            required: ["ok"],
            properties: {
              ok: { type: "boolean", const: true }
            }
          }
        }
      }
    },
    async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    }
  );
}
