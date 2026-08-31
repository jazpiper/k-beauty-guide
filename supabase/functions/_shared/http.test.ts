import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getCorsHeaders } from "./http.ts";

Deno.test("getCorsHeaders - allows matched origin from ALLOWED_ORIGINS", () => {
  const originalEnv = Deno.env.get("ALLOWED_ORIGINS");
  try {
    Deno.env.set("ALLOWED_ORIGINS", "https://example.com, https://app.example.com");
    const req = new Request("https://api.example.com/test", {
      headers: { origin: "https://example.com" },
    });
    const headers = getCorsHeaders(req);
    assertEquals(headers.get("Access-Control-Allow-Origin"), "https://example.com");
  } finally {
    if (originalEnv !== undefined) {
      Deno.env.set("ALLOWED_ORIGINS", originalEnv);
    } else {
      Deno.env.delete("ALLOWED_ORIGINS");
    }
  }
});

Deno.test("getCorsHeaders - rejects unlisted origin", () => {
  const originalEnv = Deno.env.get("ALLOWED_ORIGINS");
  try {
    Deno.env.set("ALLOWED_ORIGINS", "https://example.com");
    const req = new Request("https://api.example.com/test", {
      headers: { origin: "https://evil.com" },
    });
    const headers = getCorsHeaders(req);
    assertEquals(headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    if (originalEnv !== undefined) {
      Deno.env.set("ALLOWED_ORIGINS", originalEnv);
    } else {
      Deno.env.delete("ALLOWED_ORIGINS");
    }
  }
});

Deno.test("getCorsHeaders - ignores wildcard * in ALLOWED_ORIGINS", () => {
  const originalEnv = Deno.env.get("ALLOWED_ORIGINS");
  try {
    Deno.env.set("ALLOWED_ORIGINS", "*");
    const req = new Request("https://api.example.com/test", {
      headers: { origin: "https://anything.com" },
    });
    const headers = getCorsHeaders(req);
    assertEquals(headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    if (originalEnv !== undefined) {
      Deno.env.set("ALLOWED_ORIGINS", originalEnv);
    } else {
      Deno.env.delete("ALLOWED_ORIGINS");
    }
  }
});

Deno.test("getCorsHeaders - handles missing origin header", () => {
  const originalEnv = Deno.env.get("ALLOWED_ORIGINS");
  try {
    Deno.env.set("ALLOWED_ORIGINS", "https://example.com");
    const req = new Request("https://api.example.com/test");
    const headers = getCorsHeaders(req);
    assertEquals(headers.get("Access-Control-Allow-Origin"), null);
  } finally {
    if (originalEnv !== undefined) {
      Deno.env.set("ALLOWED_ORIGINS", originalEnv);
    } else {
      Deno.env.delete("ALLOWED_ORIGINS");
    }
  }
});
