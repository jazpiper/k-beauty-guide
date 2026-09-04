import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { constantTimeCompare, validateWorkerToken } from "./auth.ts";

Deno.test("constantTimeCompare - returns true for identical strings", () => {
  assert(constantTimeCompare("secret123", "secret123"));
  assert(constantTimeCompare("", ""));
});

Deno.test("constantTimeCompare - returns false for different strings", () => {
  assertEquals(constantTimeCompare("secret123", "secret124"), false);
  assertEquals(constantTimeCompare("secret123", "secret1234"), false);
  assertEquals(constantTimeCompare("secret123", "Secret123"), false);
  assertEquals(constantTimeCompare("secret123", ""), false);
});

Deno.test("validateWorkerToken - returns true with valid CRAWL_TASK_SECRET", () => {
  Deno.env.set("CRAWL_TASK_SECRET", "my-crawl-secret");
  const req = new Request("http://localhost/complete-crawl-task", {
    headers: {
      Authorization: "Bearer my-crawl-secret",
    },
  });

  assert(validateWorkerToken(req));
  Deno.env.delete("CRAWL_TASK_SECRET");
});

Deno.test("validateWorkerToken - falls back to FUNCTION_SECRET or SUPABASE_SERVICE_ROLE_KEY", () => {
  Deno.env.set("FUNCTION_SECRET", "my-func-secret");
  const req1 = new Request("http://localhost/complete-crawl-task", {
    headers: {
      Authorization: "Bearer my-func-secret",
    },
  });
  assert(validateWorkerToken(req1));
  Deno.env.delete("FUNCTION_SECRET");

  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "my-service-role-key");
  const req2 = new Request("http://localhost/complete-crawl-task", {
    headers: {
      Authorization: "Bearer my-service-role-key",
    },
  });
  assert(validateWorkerToken(req2));
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
});

Deno.test("validateWorkerToken - returns false for invalid token or missing header", () => {
  Deno.env.set("CRAWL_TASK_SECRET", "my-crawl-secret");

  const req1 = new Request("http://localhost/complete-crawl-task", {
    headers: {
      Authorization: "Bearer invalid-secret",
    },
  });
  assertEquals(validateWorkerToken(req1), false);

  const req2 = new Request("http://localhost/complete-crawl-task", {
    headers: {},
  });
  assertEquals(validateWorkerToken(req2), false);

  const req3 = new Request("http://localhost/complete-crawl-task", {
    headers: {
      Authorization: "Basic my-crawl-secret",
    },
  });
  assertEquals(validateWorkerToken(req3), false);

  Deno.env.delete("CRAWL_TASK_SECRET");
});

Deno.test("validateWorkerToken - returns false when no secret is configured", () => {
  Deno.env.delete("CRAWL_TASK_SECRET");
  Deno.env.delete("FUNCTION_SECRET");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  const req = new Request("http://localhost/complete-crawl-task", {
    headers: {
      Authorization: "Bearer my-crawl-secret",
    },
  });
  assertEquals(validateWorkerToken(req), false);
});
