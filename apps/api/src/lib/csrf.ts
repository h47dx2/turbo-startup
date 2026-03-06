import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { badRequest } from "./errors.js";

function signCsrfNonce(nonce: string, secret: string): string {
  return createHmac("sha256", secret).update(nonce).digest("hex");
}

export function generateCsrfToken(secret: string): string {
  const nonce = randomBytes(32).toString("base64url");
  const signature = signCsrfNonce(nonce, secret);
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(token: string, secret: string): boolean {
  const [nonce, signature] = token.split(".");
  if (!nonce || !signature) {
    return false;
  }

  const expected = signCsrfNonce(nonce, secret);
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function assertCsrfToken(
  request: FastifyRequest,
  options: {
    secret: string;
    cookieName: string;
    skip?: boolean;
  }
) {
  if (options.skip) {
    return;
  }

  const headerValue = request.headers["x-csrf-token"];
  const csrfHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const csrfCookie = request.cookies[options.cookieName];

  if (!csrfHeader || !csrfCookie) {
    throw badRequest("Missing CSRF token");
  }

  if (csrfHeader !== csrfCookie) {
    throw badRequest("Invalid CSRF token");
  }

  if (!verifyCsrfToken(csrfHeader, options.secret)) {
    throw badRequest("Invalid CSRF token");
  }
}
