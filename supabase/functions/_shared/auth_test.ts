import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { constantTimeCompare, validateWorkerToken } from "./auth.ts";

Deno.test("constantTimeCompare - returns true for identical strings", () => {
  assertEquals(constantTimeCompare("secret123", "secret123"), true);
  assertEquals(constantTimeCompare("", ""), true);
});

Deno.test("constantTimeCompare - returns false for different strings", () => {
  assertEquals(constantTimeCompare("secret123", "secret124"), false);
  assertEquals(constantTimeCompare("secret123", "secret12"), false);
  assertEquals(constantTimeCompare("secret123", "secret1234"), false);
  assertEquals(constantTimeCompare("a", "b"), false);
});

Deno.test(
  "validateWorkerToken - validates Authorization header with Bearer token against worker secret",
  () => {
    const originalSecret = Deno.env.get("CRAWL_TASK_SECRET");
    try {
      Deno.env.set("CRAWL_TASK_SECRET", "test-secret-key-123");

      const validReq = new Request("https://example.com", {
        headers: { authorization: "Bearer test-secret-key-123" },
      });
      assertEquals(validateWorkerToken(validReq), true);

      const invalidReq = new Request("https://example.com", {
        headers: { authorization: "Bearer wrong-secret-key" },
      });
      assertEquals(validateWorkerToken(invalidReq), false);

      const missingHeaderReq = new Request("https://example.com");
      assertEquals(validateWorkerToken(missingHeaderReq), false);
    } finally {
      if (originalSecret !== undefined) {
        Deno.env.set("CRAWL_TASK_SECRET", originalSecret);
      } else {
        Deno.env.delete("CRAWL_TASK_SECRET");
      }
    }
  },
);
