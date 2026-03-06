import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";

const API_URL = "http://127.0.0.1:4000";
const WEB_URL = "http://127.0.0.1:3000";

type CookieJar = Record<string, string>;

function startProcess(command: string, args: string[], env: Record<string, string>): ChildProcess {
  return spawn(command, args, {
    stdio: "ignore",
    env: {
      ...process.env,
      ...env
    }
  });
}

async function waitFor(url: string, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 307 || response.status === 308) {
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function setCookies(jar: CookieJar, response: Response) {
  const setCookieValues = response.headers.getSetCookie?.() ?? [];

  for (const entry of setCookieValues) {
    const firstPart = entry.split(";")[0] ?? "";
    const [name, value] = firstPart.split("=");
    if (!name || value === undefined) {
      continue;
    }

    if (value === "") {
      delete jar[name];
    } else {
      jar[name] = value;
    }
  }
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

let apiProcess: ChildProcess | null = null;
let webProcess: ChildProcess | null = null;

test.before(async () => {
  apiProcess = startProcess("pnpm", ["--filter", "@repo/api", "exec", "tsx", "src/server.ts"], {
    PORT: "4000",
    HOST: "127.0.0.1",
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "12345678901234567890123456789012",
    REFRESH_TOKEN_PEPPER: process.env.REFRESH_TOKEN_PEPPER ?? "1234567890123456",
    CSRF_TOKEN_SECRET: process.env.CSRF_TOKEN_SECRET ?? "12345678901234567890123456789012"
  });

  webProcess = startProcess("pnpm", ["--filter", "@repo/web", "start"], {
    PORT: "3000"
  });

  await waitFor(`${API_URL}/health`);
  await waitFor(`${WEB_URL}/login`);
});

test.after(() => {
  webProcess?.kill("SIGTERM");
  apiProcess?.kill("SIGTERM");
});

test("web smoke: public pages, dashboard redirect, login state", async () => {
  const loginPage = await fetch(`${WEB_URL}/login`);
    assert.equal(loginPage.status, 200);
    const loginHtml = await loginPage.text();
    assert.ok(loginHtml.includes("Login"));

    const registerPage = await fetch(`${WEB_URL}/register`);
    assert.equal(registerPage.status, 200);
    const registerHtml = await registerPage.text();
    assert.ok(registerHtml.includes("Register"));

    const loggedOutDashboard = await fetch(`${WEB_URL}/dashboard`, {
      redirect: "manual"
    });
    assert.ok([307, 308].includes(loggedOutDashboard.status));

    const jar: CookieJar = {};
    const email = `websmoke_${Date.now()}@example.com`;

    const registerResponse = await fetch(`${WEB_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email,
        password: "StrongPass123",
        name: "Web Smoke"
      })
    });

    assert.equal(registerResponse.status, 200);
    setCookies(jar, registerResponse);

    const meResponse = await fetch(`${WEB_URL}/api/auth/me`, {
      headers: {
        cookie: cookieHeader(jar)
      }
    });
    assert.equal(meResponse.status, 200);

    const loggedInDashboard = await fetch(`${WEB_URL}/dashboard`, {
      headers: {
        cookie: cookieHeader(jar)
      },
      redirect: "manual"
    });
    assert.equal(loggedInDashboard.status, 200);

    const logoutResponse = await fetch(`${WEB_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(jar)
      },
      body: "{}"
    });
    assert.equal(logoutResponse.status, 200);
    setCookies(jar, logoutResponse);

    const meAfterLogout = await fetch(`${WEB_URL}/api/auth/me`, {
      headers: {
        cookie: cookieHeader(jar)
      }
    });
    assert.equal(meAfterLogout.status, 401);
});

test("web smoke: register XSS payload is not reflected or rendered as HTML", async () => {
  const xssPayload = '<script>alert("xss")</script>';
  const registerResponse = await fetch(`${WEB_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email: xssPayload,
      password: "StrongPass123",
      name: "XSS Probe"
    })
  });

  assert.equal(registerResponse.status, 400);
  const responseBody = await registerResponse.text();
  assert.equal(responseBody.includes(xssPayload), false);

  const registerPage = await fetch(`${WEB_URL}/register`);
  assert.equal(registerPage.status, 200);
  const registerHtml = await registerPage.text();
  assert.equal(registerHtml.includes(xssPayload), false);
  assert.equal(registerHtml.includes("<script>alert(\"xss\")</script>"), false);
});
