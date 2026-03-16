import type { Hono } from "hono";
import { prisma } from "@repo/database";

export function registerHealthRoutes(app: Hono) {
  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/ready", async (c) => {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true });
  });
}
