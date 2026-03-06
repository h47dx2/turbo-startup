import { spawn, type ChildProcess } from "node:child_process";
import { test, expect } from "@playwright/test";

function startProcess(command: string, args: string[], env: Record<string, string>): ChildProcess {
  return spawn(command, args, {
    stdio: "ignore",
    env: {
      ...process.env,
      ...env
    }
  });
}

async function waitFor(url: string, timeoutMs = 30_000) {
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

test("register payload is not executed as script in browser", async ({ page }) => {
  const apiProcess = startProcess("pnpm", ["--filter", "@repo/api", "exec", "tsx", "src/server.ts"], {
    PORT: "4000",
    HOST: "127.0.0.1",
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "12345678901234567890123456789012",
    REFRESH_TOKEN_PEPPER: process.env.REFRESH_TOKEN_PEPPER ?? "1234567890123456",
    CSRF_TOKEN_SECRET: process.env.CSRF_TOKEN_SECRET ?? "12345678901234567890123456789012"
  });

  const webProcess = startProcess("pnpm", ["--filter", "@repo/web", "start"], {
    PORT: "3000",
    API_BASE_URL: process.env.API_BASE_URL ?? "http://127.0.0.1:4000"
  });

  try {
    await waitFor("http://127.0.0.1:4000/health");
    await waitFor("http://127.0.0.1:3000/register");

    let dialogCount = 0;
    page.on("dialog", async (dialog) => {
      dialogCount += 1;
      await dialog.dismiss();
    });

    await page.addInitScript(() => {
      (window as Window & { __xss_executed?: number }).__xss_executed = 0;
    });

    const payload = '<img src="x" onerror="window.__xss_executed = 1">';

    await page.goto("/register");
    await page.getByLabel("Name").fill(payload);
    await page.getByLabel("Email").fill(`pw_xss_${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("StrongPass123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    const xssExecuted = await page.evaluate(() => (window as Window & { __xss_executed?: number }).__xss_executed ?? 0);
    expect(xssExecuted).toBe(0);
    expect(dialogCount).toBe(0);

    const injectedImageCount = await page.locator('img[src="x"]').count();
    expect(injectedImageCount).toBe(0);
  } finally {
    webProcess.kill("SIGTERM");
    apiProcess.kill("SIGTERM");
  }
});
