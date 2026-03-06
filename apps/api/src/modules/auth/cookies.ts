import type { FastifyReply } from "fastify";
import type { ApiEnv } from "../../config/env.js";

export function setRefreshTokenCookie(reply: FastifyReply, env: ApiEnv, token: string) {
  reply.setCookie(env.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE,
    path: "/",
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS
  });
}

export function clearRefreshTokenCookie(reply: FastifyReply, env: ApiEnv) {
  reply.clearCookie(env.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE,
    path: "/"
  });
}

export function setCsrfTokenCookie(reply: FastifyReply, env: ApiEnv, token: string) {
  reply.setCookie(env.CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE,
    path: "/",
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS
  });
}

export function clearCsrfTokenCookie(reply: FastifyReply, env: ApiEnv) {
  reply.clearCookie(env.CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: env.refreshCookieSecure,
    sameSite: env.REFRESH_COOKIE_SAME_SITE,
    path: "/"
  });
}
