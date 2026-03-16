import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema
} from "@repo/validation";
import { getEnv, type ApiEnv } from "../../config/env.js";
import { badRequest, unauthorized } from "../../lib/errors.js";
import { assertCsrfToken, generateCsrfToken } from "../../lib/csrf.js";
import { parseBearerToken } from "../../lib/http.js";
import { parseWithSchema } from "../../lib/validation.js";
import {
  clearCsrfTokenCookie,
  clearRefreshTokenCookie,
  setCsrfTokenCookie,
  setRefreshTokenCookie
} from "../../modules/auth/cookies.js";
import { getCurrentUser, login, logout, logoutAll, refreshSession, register } from "../../modules/auth/service.js";
import { createRateLimitMiddleware } from "../../middleware/rate-limit.js";

const registerRateLimit = createRateLimitMiddleware({ max: 20, windowMs: 60_000 });
const loginRateLimit = createRateLimitMiddleware({ max: 20, windowMs: 60_000 });
const refreshRateLimit = createRateLimitMiddleware({ max: 60, windowMs: 60_000 });
const logoutRateLimit = createRateLimitMiddleware({ max: 60, windowMs: 60_000 });

function getRequestMeta(c: Context) {
  const userAgent = c.req.header("user-agent");
  const forwarded = c.req.header("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || c.req.header("x-real-ip");

  return {
    userAgent,
    ipAddress
  };
}

function readRefreshToken(c: Context, env: ApiEnv, jsonBody: unknown) {
  const payload = parseWithSchema(refreshInputSchema, jsonBody);
  return payload.refreshToken ?? getCookie(c, env.REFRESH_COOKIE_NAME);
}

function isMobileAuthMode(c: Context) {
  return c.req.header("x-auth-mode") === "mobile";
}

function resolveMobileAuthMode(c: Context, env: ApiEnv) {
  const mobileModeRequested = isMobileAuthMode(c);
  if (!mobileModeRequested) {
    return false;
  }

  if (!env.MOBILE_AUTH_SHARED_SECRET) {
    throw unauthorized("Mobile auth mode is disabled", "mobile_auth_mode_disabled");
  }

  const providedSecret = c.req.header("x-mobile-auth-secret");

  if (!providedSecret || providedSecret !== env.MOBILE_AUTH_SHARED_SECRET) {
    throw unauthorized("Invalid mobile auth secret", "invalid_mobile_auth_secret");
  }

  return true;
}

async function readJsonBody(c: Context) {
  try {
    return await c.req.json();
  } catch {
    throw badRequest("Invalid request payload");
  }
}

export function registerAuthRoutes(app: Hono) {
  const env = getEnv();

  app.get("/auth/csrf", (c) => {
    const csrfToken = generateCsrfToken(env.CSRF_TOKEN_SECRET);
    c.header("cache-control", "no-store");
    setCsrfTokenCookie(c, env, csrfToken);
    return c.json({ csrfToken });
  });

  app.post("/auth/register", registerRateLimit, async (c) => {
    const isMobile = resolveMobileAuthMode(c, env);
    const input = parseWithSchema(registerInputSchema, await readJsonBody(c));
    const session = await register({ env }, input, getRequestMeta(c));

    setRefreshTokenCookie(c, env, session.refreshToken);
    setCsrfTokenCookie(c, env, generateCsrfToken(env.CSRF_TOKEN_SECRET));

    return c.json(
      isMobile
        ? {
            ...session.response,
            refreshToken: session.refreshToken
          }
        : session.response
    );
  });

  app.post("/auth/login", loginRateLimit, async (c) => {
    const isMobile = resolveMobileAuthMode(c, env);
    const input = parseWithSchema(loginInputSchema, await readJsonBody(c));
    const session = await login({ env }, input, getRequestMeta(c));

    setRefreshTokenCookie(c, env, session.refreshToken);
    setCsrfTokenCookie(c, env, generateCsrfToken(env.CSRF_TOKEN_SECRET));

    return c.json(
      isMobile
        ? {
            ...session.response,
            refreshToken: session.refreshToken
          }
        : session.response
    );
  });

  app.post("/auth/refresh", refreshRateLimit, async (c) => {
    const jsonBody = await readJsonBody(c);
    const isMobile = resolveMobileAuthMode(c, env);
    assertCsrfToken(
      {
        csrfHeader: c.req.header("x-csrf-token"),
        csrfCookie: getCookie(c, env.CSRF_COOKIE_NAME)
      },
      {
        secret: env.CSRF_TOKEN_SECRET,
        skip: isMobile
      }
    );
    const refreshToken = readRefreshToken(c, env, jsonBody);
    if (!refreshToken) {
      throw unauthorized("Missing refresh token", "missing_refresh_token");
    }

    const session = await refreshSession({ env }, refreshToken, getRequestMeta(c));
    setRefreshTokenCookie(c, env, session.refreshToken);
    setCsrfTokenCookie(c, env, generateCsrfToken(env.CSRF_TOKEN_SECRET));

    return c.json(
      isMobile
        ? {
            ...session.response,
            refreshToken: session.refreshToken
          }
        : session.response
    );
  });

  app.post("/auth/logout", logoutRateLimit, async (c) => {
    const jsonBody = await readJsonBody(c);
    const isMobile = resolveMobileAuthMode(c, env);
    assertCsrfToken(
      {
        csrfHeader: c.req.header("x-csrf-token"),
        csrfCookie: getCookie(c, env.CSRF_COOKIE_NAME)
      },
      {
        secret: env.CSRF_TOKEN_SECRET,
        skip: isMobile
      }
    );

    const payload = parseWithSchema(logoutInputSchema, jsonBody);
    const refreshToken = payload.refreshToken ?? getCookie(c, env.REFRESH_COOKIE_NAME);
    await logout({ env }, refreshToken);

    clearRefreshTokenCookie(c, env);
    clearCsrfTokenCookie(c, env);

    return c.json({ success: true });
  });

  app.get("/auth/me", async (c) => {
    const accessToken = parseBearerToken(c.req.header("authorization"));
    if (!accessToken) {
      throw unauthorized("Missing bearer token", "missing_bearer_token");
    }

    const user = await getCurrentUser({ env }, accessToken);
    return c.json({ user });
  });

  app.post("/auth/logout-all", async (c) => {
    const accessToken = parseBearerToken(c.req.header("authorization"));
    if (!accessToken) {
      throw unauthorized("Missing bearer token", "missing_bearer_token");
    }

    await logoutAll({ env }, accessToken);
    clearRefreshTokenCookie(c, env);
    clearCsrfTokenCookie(c, env);

    return c.json({ success: true });
  });
}
