import "dotenv/config";
import { serve } from "@hono/node-server";
import { buildApp } from "./app.js";
import { getEnv } from "./config/env.js";

const env = getEnv();

try {
  const app = await buildApp();
  serve(
    {
      fetch: app.fetch,
      hostname: env.HOST,
      port: env.PORT
    },
    (info) => {
      console.log(`API listening on http://${info.address}:${info.port}`);
    }
  );
} catch (error) {
  console.error(error);
  process.exit(1);
}
