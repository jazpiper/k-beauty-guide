import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { constantTimeCompare, validateWorkerToken } from "./auth.ts";

Deno.test("constantTimeCompare - exact match returns true", () => {
  assertEquals(constantTimeCompare("secret-token", "secret-token"), true);
});

Deno.test("constantTimeCompare - different length (user input shorter) returns false", () => {
  assertEquals(constantTimeCompare("secret", "secret-token"), false);
});

Deno.test("constantTimeCompare - different length (user input longer) returns false", () => {
  assertEquals(constantTimeCompare("secret-token-extra", "secret-token"), false);
});

Deno.test("constantTimeCompare - empty input string returns false when secret is non-empty", () => {
  assertEquals(constantTimeCompare("", "secret-token"), false);
});

Deno.test("constantTimeCompare - empty strings match", () => {
  assertEquals(constantTimeCompare("", ""), true);
});

Deno.test("constantTimeCompare - same length different content returns false", () => {
  assertEquals(constantTimeCompare("secret-token-1", "secret-token-2"), false);
});

Deno.test("validateWorkerToken - missing authorization header returns false", () => {
  const req = new Request("http://localhost");
  assertEquals(validateWorkerToken(req), false);
});

Deno.test("validateWorkerToken - invalid header format returns false", () => {
  const req = new Request("http://localhost", {
    headers: { authorization: "Basic secret" },
  });
  assertEquals(validateWorkerToken(req), false);
});

Deno.test("validateWorkerToken - matches CRAWL_TASK_SECRET when set", () => {
  Deno.env.set("CRAWL_TASK_SECRET", "custom-crawl-secret");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  const validReq = new Request("http://localhost", {
    headers: { authorization: "Bearer custom-crawl-secret" },
  });
  const invalidReq = new Request("http://localhost", {
    headers: { authorization: "Bearer service-role-key" },
  });

  assertEquals(validateWorkerToken(validReq), true);
  assertEquals(validateWorkerToken(invalidReq), false);

  Deno.env.delete("CRAWL_TASK_SECRET");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
});

Deno.test("validateWorkerToken - falls back to FUNCTION_SECRET", () => {
  Deno.env.set("FUNCTION_SECRET", "custom-func-secret");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  const validReq = new Request("http://localhost", {
    headers: { authorization: "Bearer custom-func-secret" },
  });

  assertEquals(validateWorkerToken(validReq), true);

  Deno.env.delete("FUNCTION_SECRET");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
});

Deno.test("validateWorkerToken - falls back to SUPABASE_SERVICE_ROLE_KEY", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fallback-service-role-key");

  const validReq = new Request("http://localhost", {
    headers: { authorization: "Bearer fallback-service-role-key" },
  });
  const invalidReq = new Request("http://localhost", {
    headers: { authorization: "Bearer wrong-token" },
  });

  assertEquals(validateWorkerToken(validReq), true);
  assertEquals(validateWorkerToken(invalidReq), false);

  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
});
