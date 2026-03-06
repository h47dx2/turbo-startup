import { jwtVerify, SignJWT } from "jose";
import type { AccessTokenOptions, AccessTokenPayload, AuthTokenMeta } from "./types.js";

function getJwtSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  options: AccessTokenOptions
): Promise<{ token: string; meta: AuthTokenMeta }> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((nowSeconds + options.ttlSeconds) * 1000);

  const token = await new SignJWT({
    email: payload.email,
    type: payload.type
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + options.ttlSeconds)
    .sign(getJwtSecret(options.secret));

  return {
    token,
    meta: {
      expiresAt,
      expiresInSeconds: options.ttlSeconds
    }
  };
}

export async function verifyAccessToken(token: string, options: AccessTokenOptions): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(options.secret), {
    issuer: options.issuer,
    audience: options.audience
  });

  if (payload.type !== "access" || !payload.sub || typeof payload.email !== "string") {
    throw new Error("Invalid access token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    type: "access"
  };
}
