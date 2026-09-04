import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  errorResponse,
  getCorsHeaders,
  integerField,
  okResponse,
  optionalStringField,
  pathId,
  readJsonBody,
  requirePost,
  stringField,
} from "./http.ts";

Deno.test("getCorsHeaders - includes allowed origin when matched", () => {
  Deno.env.set("ALLOWED_ORIGINS", "http://localhost:3000, https://example.com");

  const req = new Request("http://localhost", {
    headers: { origin: "https://example.com" },
  });
  const headers = getCorsHeaders(req);

  assertEquals(headers.get("Access-Control-Allow-Origin"), "https://example.com");
  assertEquals(
    headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type",
  );
  assertEquals(
    headers.get("Access-Control-Allow-Methods"),
    "POST, OPTIONS",
  );

  Deno.env.delete("ALLOWED_ORIGINS");
});

Deno.test("getCorsHeaders - omits allow-origin header when origin not allowed", () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://example.com");

  const req = new Request("http://localhost", {
    headers: { origin: "https://unauthorized.com" },
  });
  const headers = getCorsHeaders(req);

  assertEquals(headers.get("Access-Control-Allow-Origin"), null);

  Deno.env.delete("ALLOWED_ORIGINS");
});

Deno.test("okResponse - constructs 200 response with data by default", async () => {
  const req = new Request("http://localhost");
  const data = { id: 123, name: "Test Item" };
  const res = okResponse(req, data);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");

  const body = await res.json();
  assertEquals(body, { ok: true, data });
});

Deno.test("okResponse - supports custom HTTP status codes", async () => {
  const req = new Request("http://localhost");
  const res = okResponse(req, { created: true }, 201);

  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body, { ok: true, data: { created: true } });
});

Deno.test("errorResponse - constructs error response without details", async () => {
  const req = new Request("http://localhost");
  const res = errorResponse(
    req,
    404,
    "not_found",
    "Resource not found",
  );

  assertEquals(res.status, 404);
  assertEquals(res.headers.get("Content-Type"), "application/json");

  const body = await res.json();
  assertEquals(body, {
    ok: false,
    error: {
      code: "not_found",
      message: "Resource not found",
    },
  });
});

Deno.test("errorResponse - constructs error response with details when provided", async () => {
  const req = new Request("http://localhost");
  const details = { field: "email", issue: "invalid_format" };
  const res = errorResponse(
    req,
    400,
    "validation_error",
    "Invalid input",
    details,
  );

  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body, {
    ok: false,
    error: {
      code: "validation_error",
      message: "Invalid input",
      details,
    },
  });
});

Deno.test("requirePost - returns 204 response for OPTIONS preflight", () => {
  const req = new Request("http://localhost", { method: "OPTIONS" });
  const res = requirePost(req);

  assertEquals(res instanceof Response, true);
  if (res) {
    assertEquals(res.status, 204);
  }
});

Deno.test("requirePost - returns 405 errorResponse for non-POST method", async () => {
  const req = new Request("http://localhost", { method: "GET" });
  const res = requirePost(req);

  assertEquals(res instanceof Response, true);
  if (res) {
    assertEquals(res.status, 405);
    const body = await res.json();
    assertEquals(body.error.code, "method_not_allowed");
    assertEquals(body.error.message, "Use POST");
  }
});

Deno.test("requirePost - returns null for POST method", () => {
  const req = new Request("http://localhost", { method: "POST" });
  const res = requirePost(req);

  assertEquals(res, null);
});

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

Deno.test("stringField - extracts and trims valid string fields", () => {
  const body = { name: "  John Doe  ", age: 30 };
  assertEquals(stringField(body, "name"), "John Doe");
  assertEquals(stringField(body, "missing"), "");
  assertEquals(stringField(body, "age"), "");
});

Deno.test("optionalStringField - returns trimmed string or null", () => {
  const body = { title: "  Developer  ", empty: "   ", count: 5 };
  assertEquals(optionalStringField(body, "title"), "Developer");
  assertEquals(optionalStringField(body, "empty"), null);
  assertEquals(optionalStringField(body, "missing"), null);
  assertEquals(optionalStringField(body, "count"), null);
});

Deno.test("integerField - validates integer values and options", async () => {
  const req = new Request("http://localhost");
  const body = { valid: 10, float: 10.5, str: "10", small: 2, large: 100 };

  // Valid integer
  assertEquals(integerField(req, body, "valid"), 10);

  // Default value fallback
  assertEquals(integerField(req, body, "missing", { defaultValue: 5 }), 5);

  // Non-integer error
  const floatRes = integerField(req, body, "float");
  assertEquals(floatRes instanceof Response, true);
  if (floatRes instanceof Response) {
    assertEquals(floatRes.status, 400);
    const json = await floatRes.json();
    assertEquals(json.error.message, "float must be an integer");
  }

  // Min option error
  const minRes = integerField(req, body, "small", { min: 5 });
  assertEquals(minRes instanceof Response, true);
  if (minRes instanceof Response) {
    assertEquals(minRes.status, 400);
    const json = await minRes.json();
    assertEquals(json.error.message, "small must be at least 5");
  }

  // Max option error
  const maxRes = integerField(req, body, "large", { max: 50 });
  assertEquals(maxRes instanceof Response, true);
  if (maxRes instanceof Response) {
    assertEquals(maxRes.status, 400);
    const json = await maxRes.json();
    assertEquals(json.error.message, "large must be at most 50");
  }
});

Deno.test("pathId - parses path identifier correctly", () => {
  const req1 = new Request("http://localhost/v1/admin-review-action/12345/approve");
  assertEquals(pathId(req1, "admin-review-action"), "12345");

  const req2 = new Request("http://localhost/v1/other-function");
  assertEquals(pathId(req2, "admin-review-action"), null);

  const req3 = new Request("http://localhost/v1/admin-review-action");
  assertEquals(pathId(req3, "admin-review-action"), null);
});
