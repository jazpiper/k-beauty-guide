import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readJsonBody } from "./http.ts";

Deno.test("readJsonBody returns error on invalid JSON", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: "invalid json",
  });
  const res = await readJsonBody(req);
  assertEquals(res instanceof Response, true);
  if (res instanceof Response) {
    const json = await res.json();
    assertEquals(res.status, 400);
    assertEquals(json.error.message, "Request body must be valid JSON");
    assertEquals(json.error.code, "validation_error");
  }
});

Deno.test("readJsonBody returns error on non-record JSON", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(["array", "instead", "of", "object"]),
  });
  const res = await readJsonBody(req);
  assertEquals(res instanceof Response, true);
  if (res instanceof Response) {
    const json = await res.json();
    assertEquals(res.status, 400);
    assertEquals(json.error.message, "Request body must be a JSON object");
    assertEquals(json.error.code, "validation_error");
  }
});

Deno.test("readJsonBody returns parsed object on valid JSON", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ key: "value" }),
  });
  const res = await readJsonBody(req);
  assertEquals(res instanceof Response, false);
  assertEquals(res, { key: "value" });
});
