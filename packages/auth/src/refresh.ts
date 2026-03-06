import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function generateTokenFamily(): string {
  return randomBytes(24).toString("hex");
}

export function hashRefreshToken(token: string, pepper = ""): string {
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

export function verifyRefreshTokenHash(token: string, hash: string, pepper = ""): boolean {
  const calculated = hashRefreshToken(token, pepper);
  const left = Buffer.from(calculated);
  const right = Buffer.from(hash);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
