import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  loginInputSchema,
  logoutInputSchema,
  refreshInputSchema,
  registerInputSchema
} from "@repo/validation";
import { getEnv, type ApiEnv } from "../../config/env.js";
import { unauthorized } from "../../lib/errors.js";
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

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {}
      }
    }
  }
} as const;

const userSchema = {
  type: "object",
  required: ["id", "email", "name", "createdAt"],
  properties: {
    id: { type: "string" },
    email: { type: "string", format: "email" },
    name: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" }
  }
} as const;

const authSuccessSchema = {
  type: "object",
  required: ["user", "token"],
  properties: {
    user: userSchema,
    token: {
      type: "object",
      required: ["accessToken", "tokenType", "expiresInSeconds"],
      properties: {
        accessToken: { type: "string" },
        tokenType: { type: "string", enum: ["Bearer"] },
        expiresInSeconds: { type: "integer", minimum: 1 }
      }
    },
    refreshToken: { type: "string", minLength: 1 }
  }
} as const;

const authModeHeadersSchema = {
  type: "object",
  properties: {
    "x-auth-mode": {
      type: "string",
      enum: ["web", "mobile"]
    },
    "x-csrf-token": {
      type: "string",
      minLength: 1,
      description: "Required for web mode on refresh/logout. Must match csrf cookie value."
    },
    "x-mobile-auth-secret": {
      type: "string",
      minLength: 1,
      description: "Required when x-auth-mode=mobile."
    }
  }
} as const;

const registerBodySchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 8 },
    name: { type: "string", minLength: 1, maxLength: 64 }
  }
} as const;

const loginBodySchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 1 }
  }
} as const;

const refreshBodySchema = {
  type: "object",
  properties: {
    refreshToken: { type: "string", minLength: 1 }
  }
} as const;

const successSchema = {
  type: "object",
  required: ["success"],
  properties: {
    success: { type: "boolean", const: true }
  }
} as const;

const csrfTokenResponseSchema = {
  type: "object",
  required: ["csrfToken"],
  properties: {
    csrfToken: { type: "string" }
  }
} as const;

function getRequestMeta(request: FastifyRequest) {
  return {
    userAgent: request.headers["user-agent"],
    ipAddress: request.ip
  };
}

function readRefreshToken(request: FastifyRequest, env: ApiEnv) {
  const payload = parseWithSchema(refreshInputSchema, request.body ?? {});
  return payload.refreshToken ?? request.cookies[env.REFRESH_COOKIE_NAME];
}

function isMobileAuthMode(request: FastifyRequest) {
  const authModeHeader = request.headers["x-auth-mode"];
  if (!authModeHeader) {
    return false;
  }

  if (Array.isArray(authModeHeader)) {
    return authModeHeader[0] === "mobile";
  }

  return authModeHeader === "mobile";
}

function resolveMobileAuthMode(request: FastifyRequest, env: ApiEnv) {
  const mobileModeRequested = isMobileAuthMode(request);
  if (!mobileModeRequested) {
    return false;
  }

  if (!env.MOBILE_AUTH_SHARED_SECRET) {
    throw unauthorized("Mobile auth mode is disabled", "mobile_auth_mode_disabled");
  }

  const secretHeader = request.headers["x-mobile-auth-secret"];
  const providedSecret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

  if (!providedSecret || providedSecret !== env.MOBILE_AUTH_SHARED_SECRET) {
    throw unauthorized("Invalid mobile auth secret", "invalid_mobile_auth_secret");
  }

  return true;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  const env = getEnv();

  app.get(
    "/auth/csrf",
    {
      schema: {
        tags: ["Auth"],
        summary: "Issue CSRF token for web cookie flows",
        response: {
          200: csrfTokenResponseSchema
        }
      }
    },
    async (_request, reply) => {
      const csrfToken = generateCsrfToken(env.CSRF_TOKEN_SECRET);
      reply.header("cache-control", "no-store");
      setCsrfTokenCookie(reply, env, csrfToken);
      return reply.send({ csrfToken });
    }
  );

  app.post(
    "/auth/register",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      },
      schema: {
        tags: ["Auth"],
        summary: "Register a new user",
        headers: authModeHeadersSchema,
        body: registerBodySchema,
        response: {
          200: authSuccessSchema,
          400: errorSchema,
          401: errorSchema,
          409: errorSchema
        }
      }
    },
    async (request, reply) => {
      const isMobile = resolveMobileAuthMode(request, env);
      const input = parseWithSchema(registerInputSchema, request.body);
      const session = await register(
        { env },
        input,
        {
          userAgent: request.headers["user-agent"],
          ipAddress: request.ip
        }
      );

      setRefreshTokenCookie(reply, env, session.refreshToken);
      setCsrfTokenCookie(reply, env, generateCsrfToken(env.CSRF_TOKEN_SECRET));
      return reply.send(
        isMobile
          ? {
              ...session.response,
              refreshToken: session.refreshToken
            }
          : session.response
      );
    }
  );

  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute"
        }
      },
      schema: {
        tags: ["Auth"],
        summary: "Login with email/password",
        headers: authModeHeadersSchema,
        body: loginBodySchema,
        response: {
          200: authSuccessSchema,
          400: errorSchema,
          401: errorSchema
        }
      }
    },
    async (request, reply) => {
      const isMobile = resolveMobileAuthMode(request, env);
      const input = parseWithSchema(loginInputSchema, request.body);
      const session = await login({ env }, input, getRequestMeta(request));

      setRefreshTokenCookie(reply, env, session.refreshToken);
      setCsrfTokenCookie(reply, env, generateCsrfToken(env.CSRF_TOKEN_SECRET));
      return reply.send(
        isMobile
          ? {
              ...session.response,
              refreshToken: session.refreshToken
            }
          : session.response
      );
    }
  );

  app.post(
    "/auth/refresh",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute"
        }
      },
      schema: {
        tags: ["Auth"],
        summary: "Rotate refresh token and issue new access token",
        headers: authModeHeadersSchema,
        body: refreshBodySchema,
        response: {
          200: authSuccessSchema,
          400: errorSchema,
          401: errorSchema
        }
      }
    },
    async (request, reply) => {
      const isMobile = resolveMobileAuthMode(request, env);
      assertCsrfToken(request, {
        secret: env.CSRF_TOKEN_SECRET,
        cookieName: env.CSRF_COOKIE_NAME,
        skip: isMobile
      });
      const refreshToken = readRefreshToken(request, env);
      if (!refreshToken) {
        throw unauthorized("Missing refresh token", "missing_refresh_token");
      }

      const session = await refreshSession({ env }, refreshToken, getRequestMeta(request));

      setRefreshTokenCookie(reply, env, session.refreshToken);
      setCsrfTokenCookie(reply, env, generateCsrfToken(env.CSRF_TOKEN_SECRET));
      return reply.send(
        isMobile
          ? {
              ...session.response,
              refreshToken: session.refreshToken
            }
          : session.response
      );
    }
  );

  app.post(
    "/auth/logout",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute"
        }
      },
      schema: {
        tags: ["Auth"],
        summary: "Revoke current refresh token",
        headers: authModeHeadersSchema,
        body: refreshBodySchema,
        response: {
          200: successSchema,
          400: errorSchema,
          401: errorSchema
        }
      }
    },
    async (request, reply) => {
      const isMobile = resolveMobileAuthMode(request, env);
      assertCsrfToken(request, {
        secret: env.CSRF_TOKEN_SECRET,
        cookieName: env.CSRF_COOKIE_NAME,
        skip: isMobile
      });
      const payload = parseWithSchema(logoutInputSchema, request.body ?? {});
      const refreshToken = payload.refreshToken ?? request.cookies[env.REFRESH_COOKIE_NAME];

      await logout({ env }, refreshToken);
      clearRefreshTokenCookie(reply, env);
      clearCsrfTokenCookie(reply, env);

      return reply.send({ success: true });
    }
  );

  app.get(
    "/auth/me",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get current user from access token",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            required: ["user"],
            properties: {
              user: userSchema
            }
          },
          401: errorSchema
        }
      }
    },
    async (request, reply) => {
      const accessToken = parseBearerToken(request.headers.authorization);
      if (!accessToken) {
        throw unauthorized("Missing bearer token", "missing_bearer_token");
      }

      const user = await getCurrentUser({ env }, accessToken);
      return reply.send({ user });
    }
  );

  app.post(
    "/auth/logout-all",
    {
      schema: {
        tags: ["Auth"],
        summary: "Revoke all active refresh tokens for current user",
        security: [{ bearerAuth: [] }],
        response: {
          200: successSchema,
          401: errorSchema
        }
      }
    },
    async (request, reply) => {
      const accessToken = parseBearerToken(request.headers.authorization);
      if (!accessToken) {
        throw unauthorized("Missing bearer token", "missing_bearer_token");
      }

      await logoutAll({ env }, accessToken);
      clearRefreshTokenCookie(reply, env);
      clearCsrfTokenCookie(reply, env);

      return reply.send({ success: true });
    }
  );
}
