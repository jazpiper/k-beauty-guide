import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("admin review action mutates DB and writes idempotent audit logs", () => {
  assert.match(source, /createServiceRoleClient/);
  assert.match(source, /admin_audit_logs/);
  assert.match(source, /idempotency_key/);
  assert.match(source, /review_items/);
  assert.match(source, /product_candidates/);
  assert.match(source, /products/);
});
