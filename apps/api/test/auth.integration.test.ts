import test from "node:test";
import assert from "node:assert/strict";
import type { Hono } from "hono";
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

function getSetCookieHeaders(response: Response): string[] {
  const headersWithSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (headersWithSetCookie.getSetCookie) {
    return headersWithSetCookie.getSetCookie();
  }

  const setCookieHeader = response.headers.get("set-cookie");
  return setCookieHeader ? [setCookieHeader] : [];
}

function getCookieFromSetCookie(response: Response, cookieName: string): string | null {
  const cookieHeaders = getSetCookieHeaders(response);
  for (const cookieHeader of cookieHeaders) {
    const value = parseCookieValue(cookieHeader, cookieName);
    if (value) {
      return value;
    }
  }

  return null;
}

function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

type ApiRequestOptions = {
  method: string;
  path: string;
  payload?: unknown;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
};

async function requestApi(app: Hono, options: ApiRequestOptions): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.payload !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.cookies && Object.keys(options.cookies).length > 0) {
    headers.set("cookie", serializeCookies(options.cookies));
  }

  return app.request(options.path, {
    method: options.method,
    headers,
    body: options.payload !== undefined ? JSON.stringify(options.payload) : undefined
  });
}

if (!process.env.DATABASE_URL) {
  test.skip("API integration tests require DATABASE_URL", () => {});
} else {
  let app: Hono;
  let mobileAuthSecret = "";

  test.before(async () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "12345678901234567890123456789012";
    process.env.REFRESH_TOKEN_PEPPER = process.env.REFRESH_TOKEN_PEPPER ?? "1234567890123456";
    process.env.CSRF_TOKEN_SECRET = process.env.CSRF_TOKEN_SECRET ?? "12345678901234567890123456789012";
    process.env.MOBILE_AUTH_SHARED_SECRET = process.env.MOBILE_AUTH_SHARED_SECRET ?? "1234567890abcdef";
    process.env.ALLOWED_WEB_ORIGIN = process.env.ALLOWED_WEB_ORIGIN ?? "http://localhost:3000";
    mobileAuthSecret = process.env.MOBILE_AUTH_SHARED_SECRET;
    app = await buildApp();
  });

  test.after(async () => {
    await prisma.$disconnect();
  });

  test("register -> me -> refresh -> logout flow", async () => {
    const email = `itest_${Date.now()}@example.com`;

    const registerResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/register",
      payload: {
        email,
        password: "StrongPass123",
        name: "Integration User"
      }
    });

    assert.equal(registerResponse.status, 200);
    const registerBody = (await registerResponse.json()) as AuthResponse;
    assert.equal(registerBody.user.email, email);
    assert.ok(registerBody.token.accessToken.length > 20);

    const refreshToken = getCookieFromSetCookie(registerResponse, "refresh_token");
    const csrfToken = getCookieFromSetCookie(registerResponse, "csrf_token");

    assert.ok(refreshToken);
    assert.ok(csrfToken);

    const refreshRecord = await prisma.refreshToken.findFirst({
      where: { userId: registerBody.user.id },
      orderBy: { createdAt: "desc" }
    });

    assert.ok(refreshRecord);
    assert.notEqual(refreshRecord?.tokenHash, refreshToken);

    const meResponse = await requestApi(app, {
      method: "GET",
      path: "/auth/me",
      headers: {
        authorization: `Bearer ${registerBody.token.accessToken}`
      }
    });

    assert.equal(meResponse.status, 200);

    const refreshResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      cookies: {
        refresh_token: refreshToken ?? "",
        csrf_token: csrfToken ?? ""
      },
      headers: {
        "x-csrf-token": csrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(refreshResponse.status, 200);
    const rotatedToken = getCookieFromSetCookie(refreshResponse, "refresh_token");
    const rotatedCsrfToken = getCookieFromSetCookie(refreshResponse, "csrf_token");
    assert.ok(rotatedToken);
    assert.ok(rotatedCsrfToken);
    assert.notEqual(rotatedToken, refreshToken);

    const logoutResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/logout",
      cookies: {
        refresh_token: rotatedToken ?? "",
        csrf_token: rotatedCsrfToken ?? ""
      },
      headers: {
        "x-csrf-token": rotatedCsrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(logoutResponse.status, 200);

    const refreshAfterLogout = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      cookies: {
        refresh_token: rotatedToken ?? "",
        csrf_token: rotatedCsrfToken ?? ""
      },
      headers: {
        "x-csrf-token": rotatedCsrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(refreshAfterLogout.status, 401);
  });

  test("mobile auth mode returns refresh token in response body", async () => {
    const email = `mobile_${Date.now()}@example.com`;

    const registerResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/register",
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

    assert.equal(registerResponse.status, 200);
    const registerBody = (await registerResponse.json()) as AuthResponse;
    assert.ok(registerBody.refreshToken);

    const refreshResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: registerBody.refreshToken
      }
    });

    assert.equal(refreshResponse.status, 200);
    const refreshBody = (await refreshResponse.json()) as AuthResponse;
    assert.ok(refreshBody.refreshToken);
    assert.notEqual(refreshBody.refreshToken, registerBody.refreshToken);
  });

  test("register/login do not reflect raw XSS payloads in error responses", async () => {
    const xssPayload = '<script>alert("xss")</script>';

    const invalidRegisterResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/register",
      payload: {
        email: xssPayload,
        password: "StrongPass123",
        name: "XSS Probe"
      }
    });

    assert.equal(invalidRegisterResponse.status, 400);
    assert.match(invalidRegisterResponse.headers.get("content-type") ?? "", /application\/json/);
    assert.equal((await invalidRegisterResponse.text()).includes(xssPayload), false);

    const invalidLoginResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/login",
      payload: {
        email: "safe-user@example.com",
        password: xssPayload
      }
    });

    assert.equal(invalidLoginResponse.status, 401);
    assert.match(invalidLoginResponse.headers.get("content-type") ?? "", /application\/json/);
    assert.equal((await invalidLoginResponse.text()).includes(xssPayload), false);
  });

  test("refresh replay detection revokes token family", async () => {
    const email = `replay_${Date.now()}@example.com`;

    const registerResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/register",
      payload: {
        email,
        password: "StrongPass123",
        name: "Replay User"
      }
    });

    const registerBody = (await registerResponse.json()) as AuthResponse;
    const originalRefresh = getCookieFromSetCookie(registerResponse, "refresh_token");
    const originalCsrf = getCookieFromSetCookie(registerResponse, "csrf_token");

    assert.ok(originalRefresh);
    assert.ok(originalCsrf);

    const rotateResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      cookies: {
        refresh_token: originalRefresh ?? "",
        csrf_token: originalCsrf ?? ""
      },
      headers: {
        "x-csrf-token": originalCsrf ?? ""
      },
      payload: {}
    });

    assert.equal(rotateResponse.status, 200);
    const rotatedRefresh = getCookieFromSetCookie(rotateResponse, "refresh_token");

    assert.ok(rotatedRefresh);
    const rotatedRefreshToken = rotatedRefresh as string;

    const replayResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: originalRefresh as string
      }
    });

    assert.equal(replayResponse.status, 401);
    const replayBody = (await replayResponse.json()) as { error: { code: string } };
    assert.equal(replayBody.error.code, "refresh_replay_detected");

    const rotatedReuseResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: rotatedRefreshToken
      }
    });

    assert.equal(rotatedReuseResponse.status, 401);
    const rotatedReuseBody = (await rotatedReuseResponse.json()) as { error: { code: string } };
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

    const registerResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/register",
      payload: {
        email,
        password: "StrongPass123",
        name: "Logout All User"
      }
    });

    assert.equal(registerResponse.status, 200);
    const registerBody = (await registerResponse.json()) as AuthResponse;
    const initialRefreshToken = getCookieFromSetCookie(registerResponse, "refresh_token");
    const initialCsrfToken = getCookieFromSetCookie(registerResponse, "csrf_token");
    assert.ok(initialRefreshToken);
    assert.ok(initialCsrfToken);

    const refreshResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      cookies: {
        refresh_token: initialRefreshToken ?? "",
        csrf_token: initialCsrfToken ?? ""
      },
      headers: {
        "x-csrf-token": initialCsrfToken ?? ""
      },
      payload: {}
    });

    assert.equal(refreshResponse.status, 200);
    const rotatedRefreshToken = getCookieFromSetCookie(refreshResponse, "refresh_token");
    assert.ok(rotatedRefreshToken);

    const logoutAllResponse = await requestApi(app, {
      method: "POST",
      path: "/auth/logout-all",
      headers: {
        authorization: `Bearer ${registerBody.token.accessToken}`
      }
    });

    assert.equal(logoutAllResponse.status, 200);

    const refreshAfterLogoutAll = await requestApi(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: {
        "x-auth-mode": "mobile",
        "x-mobile-auth-secret": mobileAuthSecret
      },
      payload: {
        refreshToken: rotatedRefreshToken as string
      }
    });

    assert.equal(refreshAfterLogoutAll.status, 401);
  });
}
