export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type JsonRecord = Record<string, unknown>;

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json");

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function okResponse(data: unknown, status = 200): Response {
  return jsonResponse({ ok: true, data }, { status });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return jsonResponse({
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }, { status });
}

export function requirePost(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Use POST");
  }

  return null;
}

export async function readJsonBody(req: Request): Promise<JsonRecord | Response> {
  try {
    const body = await req.json();

    if (!isRecord(body)) {
      return errorResponse(400, "validation_error", "Request body must be a JSON object");
    }

    return body;
  } catch (_error) {
    return errorResponse(400, "validation_error", "Request body must be valid JSON");
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(body: JsonRecord, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export function optionalStringField(body: JsonRecord, key: string): string | null {
  const value = stringField(body, key);
  return value ? value : null;
}

export function integerField(
  body: JsonRecord,
  key: string,
  options: { defaultValue?: number; min?: number; max?: number } = {},
): number | Response {
  const value = body[key] ?? options.defaultValue;

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return errorResponse(400, "validation_error", `${key} must be an integer`);
  }

  if (options.min !== undefined && value < options.min) {
    return errorResponse(400, "validation_error", `${key} must be at least ${options.min}`);
  }

  if (options.max !== undefined && value > options.max) {
    return errorResponse(400, "validation_error", `${key} must be at most ${options.max}`);
  }

  return value;
}

export function pathId(req: Request, functionName: string): string | null {
  const pathname = new URL(req.url).pathname;
  const segments = pathname.split("/").filter(Boolean);
  const functionIndex = segments.lastIndexOf(functionName);

  if (functionIndex === -1) {
    return null;
  }

  return segments[functionIndex + 1] ?? null;
}
