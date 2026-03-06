import type { ApiEnv } from "../../config/env.js";

export type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export type AuthServiceContext = {
  env: ApiEnv;
};
