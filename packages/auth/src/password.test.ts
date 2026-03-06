import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.js";

test("hashPassword creates argon2id hash and verifyPassword validates it", async () => {
  const password = "StrongPass123";
  const hash = await hashPassword(password);

  assert.ok(hash.length > 20);
  assert.ok(hash.startsWith("$argon2id$"));

  const valid = await verifyPassword(password, hash);
  const invalid = await verifyPassword("WrongPass123", hash);

  assert.equal(valid, true);
  assert.equal(invalid, false);
});
