import "dotenv/config";
import { buildApp } from "./app.js";
import { getEnv } from "./config/env.js";

const env = getEnv();

buildApp()
  .then((app) =>
    app.listen({
      host: env.HOST,
      port: env.PORT
    })
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
