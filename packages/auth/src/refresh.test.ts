import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRefreshToken,
  generateTokenFamily,
  hashRefreshToken,
  verifyRefreshTokenHash
} from "./refresh.js";

test("refresh token helpers generate and verify securely", () => {
  const token = generateRefreshToken();
  const family = generateTokenFamily();

  assert.ok(token.length >= 40);
  assert.ok(family.length >= 20);

  const pepper = "pepper-value";
  const hash = hashRefreshToken(token, pepper);

  assert.equal(hash.length, 64);
  assert.equal(verifyRefreshTokenHash(token, hash, pepper), true);
  assert.equal(verifyRefreshTokenHash("wrong", hash, pepper), false);
});
