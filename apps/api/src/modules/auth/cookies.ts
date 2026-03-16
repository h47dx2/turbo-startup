import type { Context } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { ApiEnv } from "../../config/env.js";

export function setRefreshTokenCookie(c: Context, env: ApiEnv, token: string) {
  setCookie(c, env.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE as "lax" | "strict" | "none",
    path: "/",
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS
  });
}

export function clearRefreshTokenCookie(c: Context, env: ApiEnv) {
  deleteCookie(c, env.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE as "lax" | "strict" | "none",
    path: "/"
  });
}

export function setCsrfTokenCookie(c: Context, env: ApiEnv, token: string) {
  setCookie(c, env.CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE as "lax" | "strict" | "none",
    path: "/",
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS
  });
}

export function clearCsrfTokenCookie(c: Context, env: ApiEnv) {
  deleteCookie(c, env.CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE as "lax" | "strict" | "none",
    path: "/"
  });
}
