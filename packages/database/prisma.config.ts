import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

const configDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(configDir, "../..");

loadEnv({ path: resolve(workspaceRoot, ".env"), quiet: true });
loadEnv({ path: resolve(configDir, ".env"), override: false, quiet: true });

const prismaDatasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!prismaDatasourceUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    // Prisma 7 config does not support `directUrl`; use the direct URL for CLI/migrations.
    url: prismaDatasourceUrl
  }
});
