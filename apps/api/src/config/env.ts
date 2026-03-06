import { z } from "zod";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS
} from "@repo/auth";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.url().optional(),
  TRUST_PROXY: z.coerce.boolean().default(false),
  ALLOWED_WEB_ORIGIN: z.url().default("http://localhost:3000"),
  CSRF_TOKEN_SECRET: z.string().min(32),
  CSRF_COOKIE_NAME: z.string().min(1).default("csrf_token"),
  MOBILE_AUTH_SHARED_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  REFRESH_TOKEN_PEPPER: z.string().min(16),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(ACCESS_TOKEN_TTL_SECONDS),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(REFRESH_TOKEN_TTL_SECONDS),
  REFRESH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  JWT_ISSUER: z.string().min(1).default(ACCESS_TOKEN_ISSUER),
  JWT_AUDIENCE: z.string().min(1).default(ACCESS_TOKEN_AUDIENCE),
  REFRESH_COOKIE_NAME: z.string().min(1).default(REFRESH_TOKEN_COOKIE_NAME)
});

export type ApiEnv = z.infer<typeof envSchema> & {
  refreshCookieSecure: boolean;
};

let cachedEnv: ApiEnv | null = null;

export function getEnv(): ApiEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issueList = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid API environment: ${issueList}`);
  }

  cachedEnv = {
    ...parsed.data,
    refreshCookieSecure: parsed.data.NODE_ENV === "production"
  };

  return cachedEnv;
}
