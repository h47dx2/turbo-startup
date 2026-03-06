import test from "node:test";
import assert from "node:assert/strict";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

test("signAccessToken and verifyAccessToken roundtrip payload", async () => {
  const options = {
    secret: "12345678901234567890123456789012",
    issuer: "test-issuer",
    audience: "test-audience",
    ttlSeconds: 900
  };

  const payload = {
    sub: "user_1",
    email: "user@example.com",
    type: "access" as const
  };

  const signed = await signAccessToken(payload, options);
  assert.ok(signed.token.length > 20);
  assert.equal(signed.meta.expiresInSeconds, 900);

  const verified = await verifyAccessToken(signed.token, options);
  assert.deepEqual(verified, payload);
});

test("verifyAccessToken rejects wrong audience", async () => {
  const options = {
    secret: "12345678901234567890123456789012",
    issuer: "test-issuer",
    audience: "test-audience",
    ttlSeconds: 900
  };

  const signed = await signAccessToken(
    {
      sub: "user_1",
      email: "user@example.com",
      type: "access"
    },
    options
  );

  await assert.rejects(() =>
    verifyAccessToken(signed.token, {
      ...options,
      audience: "wrong-audience"
    })
  );
});
