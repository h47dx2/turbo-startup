import test from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "@repo/database";

type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
  };
  token: {
    accessToken: string;
    tokenType: "Bearer";
    expiresInSeconds: number;
  };
  refreshToken?: string;
};

function parseCookieValue(setCookieHeader: string, cookieName: string): string | null {
  const firstPart = setCookieHeader.split(";")[0] ?? "";
  const [name, value] = firstPart.split("=");

  if (name !== cookieName || !value) {
    return null;
  }

  return value;
}

function getCookieFromSetCookie(setCookieHeader: string | string[] | undefined, cookieName: string): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const cookieHeaders = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookieHeader of cookieHeaders) {
    const value = parseCookieValue(cookieHeader, cookieName);
    if (value) {
      return value;
    }
  }

  return null;
}

if (!process.env.DATABASE_URL) {
  test.skip("API integration tests require DATABASE_URL", () => {});
} else {
  let app: FastifyInstance;
  let mobileAuthSecret = "";

  test.before(async () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "12345678901234567890123456789012";
    process.env.REFRESH_TOKEN_PEPPER = process.env.REFRESH_TOKEN_PEPPER ?? "1234567890123456";
    process.env.CSRF_TOKEN_SECRET = process.env.CSRF_TOKEN_SECRET ?? "12345678901234567890123456789012";
    process.env.MOBILE_AUTH_SHARED_SECRET = process.env.MOBILE_AUTH_SHARED_SECRET ?? "1234567890abcdef";
    process.env.ALLOWED_WEB_ORIGIN = process.env.ALLOWED_WEB_ORIGIN ?? "http://localhost:3000";
    mobileAuthSecret = process.env.MOBILE_AUTH_SHARED_SECRET;
    app = await buildApp();
    await app.ready();
  });

  test.after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  test("register -> me -> refresh -> logout flow", async () => {
    const email = `itest_${Date.now()}@example.com`;

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "StrongPass123",
        name: "Integration User"
      }
    });

    assert.equal(registerResponse.statusCode, 200);
    const registerBody = registerResponse.json() as AuthResponse;
    assert.equal(registerBody.user.email, email);
    assert.ok(registerBody.token.accessToken.length > 20);

    const setCookieHeader = registerResponse.headers["set-cookie"];
    assert.ok(setCookieHeader);
    const refreshToken = getCookieFromSetCookie(setCookieHeader, "refresh_token");
    const csrfToken = getCookieFromSetCookie(setCookieHeader, "csrf_token");

    assert.ok(refreshToken);
    assert.ok(csrfToken);

    const refreshRecord = await prisma.refreshToken.findFirst({
      where: { userId: registerBody.user.id },
      orderBy: { createdAt: "desc" }
    });

    assert.ok(refreshRecord);
    assert.notEqual(refreshRecord?.tokenHash, refreshToken);

    const meResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${registerBody.token.accessToken}`
      }
    });

    assert.equal(meResponse.statusCode, 200);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: refreshToken,
        csrf_token: csrfToken ?? ""
      },
      headers: {
        "x-csrf-token": csrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(refreshResponse.statusCode, 200);
    const rotatedHeader = refreshResponse.headers["set-cookie"];
    assert.ok(rotatedHeader);
    const rotatedToken = getCookieFromSetCookie(rotatedHeader, "refresh_token");
    const rotatedCsrfToken = getCookieFromSetCookie(rotatedHeader, "csrf_token");
    assert.ok(rotatedToken);
    assert.ok(rotatedCsrfToken);
    assert.notEqual(rotatedToken, refreshToken);

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: {
        refresh_token: rotatedToken ?? "",
        csrf_token: rotatedCsrfToken ?? ""
      },
      headers: {
        "x-csrf-token": rotatedCsrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(logoutResponse.statusCode, 200);

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: rotatedToken ?? "",
        csrf_token: rotatedCsrfToken ?? ""
      },
      headers: {
        "x-csrf-token": rotatedCsrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(refreshAfterLogout.statusCode, 401);
  });

  test("mobile auth mode returns refresh token in response body", async () => {
    const email = `mobile_${Date.now()}@example.com`;

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        email,
        password: "StrongPass123",
        name: "Mobile User"
      }
    });

    assert.equal(registerResponse.statusCode, 200);
    const registerBody = registerResponse.json() as AuthResponse;
    assert.ok(registerBody.refreshToken);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: registerBody.refreshToken
      }
    });

    assert.equal(refreshResponse.statusCode, 200);
    const refreshBody = refreshResponse.json() as AuthResponse;
    assert.ok(refreshBody.refreshToken);
    assert.notEqual(refreshBody.refreshToken, registerBody.refreshToken);
  });

  test("register/login do not reflect raw XSS payloads in error responses", async () => {
    const xssPayload = '<script>alert("xss")</script>';

    const invalidRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: xssPayload,
        password: "StrongPass123",
        name: "XSS Probe"
      }
    });

    assert.equal(invalidRegisterResponse.statusCode, 400);
    assert.match(invalidRegisterResponse.headers["content-type"] ?? "", /application\/json/);
    assert.equal(invalidRegisterResponse.body.includes(xssPayload), false);

    const invalidLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "safe-user@example.com",
        password: xssPayload
      }
    });

    assert.equal(invalidLoginResponse.statusCode, 401);
    assert.match(invalidLoginResponse.headers["content-type"] ?? "", /application\/json/);
    assert.equal(invalidLoginResponse.body.includes(xssPayload), false);
  });

  test("refresh replay detection revokes token family", async () => {
    const email = `replay_${Date.now()}@example.com`;

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "StrongPass123",
        name: "Replay User"
      }
    });

    const registerBody = registerResponse.json() as AuthResponse;
    const setCookieHeader = registerResponse.headers["set-cookie"];
    const originalRefresh = getCookieFromSetCookie(setCookieHeader, "refresh_token");
    const originalCsrf = getCookieFromSetCookie(setCookieHeader, "csrf_token");

    assert.ok(originalRefresh);
    assert.ok(originalCsrf);

    const rotateResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: originalRefresh ?? "",
        csrf_token: originalCsrf ?? ""
      },
      headers: {
        "x-csrf-token": originalCsrf ?? ""
      },
      payload: {}
    });

    assert.equal(rotateResponse.statusCode, 200);
    const rotatedHeader = rotateResponse.headers["set-cookie"];
    const rotatedRefresh = getCookieFromSetCookie(rotatedHeader, "refresh_token");

    assert.ok(rotatedRefresh);
    const rotatedRefreshToken = rotatedRefresh as string;

    const replayResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: originalRefresh as string
      }
    });

    assert.equal(replayResponse.statusCode, 401);
    const replayBody = replayResponse.json() as { error: { code: string } };
    assert.equal(replayBody.error.code, "refresh_replay_detected");

    const rotatedReuseResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: rotatedRefreshToken
      }
    });

    assert.equal(rotatedReuseResponse.statusCode, 401);
    const rotatedReuseBody = rotatedReuseResponse.json() as { error: { code: string } };
    assert.equal(rotatedReuseBody.error.code, "refresh_replay_detected");

    const tokenRows = await prisma.refreshToken.findMany({
      where: {
        userId: registerBody.user.id
      }
    });

    assert.ok(tokenRows.length >= 2);
    assert.equal(tokenRows.every((row) => row.tokenHash !== originalRefresh && row.tokenHash !== rotatedRefresh), true);
  });

  test("logout-all revokes all active refresh tokens", async () => {
    const email = `logout_all_${Date.now()}@example.com`;

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "StrongPass123",
        name: "Logout All User"
      }
    });

    assert.equal(registerResponse.statusCode, 200);
    const registerBody = registerResponse.json() as AuthResponse;
    const initialRefreshToken = getCookieFromSetCookie(registerResponse.headers["set-cookie"], "refresh_token");
    const initialCsrfToken = getCookieFromSetCookie(registerResponse.headers["set-cookie"], "csrf_token");
    assert.ok(initialRefreshToken);
    assert.ok(initialCsrfToken);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      cookies: {
        refresh_token: initialRefreshToken ?? "",
        csrf_token: initialCsrfToken ?? ""
      },
      headers: {
        "x-csrf-token": initialCsrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(refreshResponse.statusCode, 200);
    const refreshSetCookie = refreshResponse.headers["set-cookie"];
    const rotatedRefreshToken = getCookieFromSetCookie(refreshSetCookie, "refresh_token");
    assert.ok(rotatedRefreshToken);

    const logoutAllResponse = await app.inject({
      method: "POST",
      url: "/auth/logout-all",
      headers: {
        authorization: `Bearer ${registerBody.token.accessToken}`
      }
    });

    assert.equal(logoutAllResponse.statusCode, 200);

    const refreshAfterLogoutAll = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: rotatedRefreshToken as string
      }
    });

    assert.equal(refreshAfterLogoutAll.statusCode, 401);
  });
}
