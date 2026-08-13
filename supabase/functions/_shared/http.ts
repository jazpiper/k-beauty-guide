export function getCorsHeaders(req: Request): Headers {
  const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsStr.split(",").map((o) => o.trim());
  const origin = req.headers.get("origin") || "";

  let allowOrigin = "";
  if (allowedOrigins.includes("*")) {
    allowOrigin = "*";
  } else if (allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  }

  const headers = new Headers({
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });

  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
  }

  return headers;
}

export type JsonRecord = Record<string, unknown>;

export function okResponse(
  req: Request,
  data: unknown,
  status = 200,
): Response {
  const headers = getCorsHeaders(req);
  headers.set("Content-Type", "application/json");

  return new Response(JSON.stringify({ ok: true, data }), {
    headers,
    status,
  });
}

export function errorResponse(
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const headers = getCorsHeaders(req);
  headers.set("Content-Type", "application/json");

  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    }),
    {
      headers,
      status,
    },
  );
}

export function requirePost(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return errorResponse(req, 405, "method_not_allowed", "Use POST");
  }

  return null;
}

export async function readJsonBody(
  req: Request,
): Promise<JsonRecord | Response> {
  try {
    const body = await req.json();

    if (!isRecord(body)) {
      return errorResponse(
        req,
        400,
        "validation_error",
        "Request body must be a JSON object",
      );
    }

    return body;
  } catch (_error) {
    return errorResponse(
      req,
      400,
      "validation_error",
      "Request body must be valid JSON",
    );
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(body: JsonRecord, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}

export function optionalStringField(
  body: JsonRecord,
  key: string,
): string | null {
  const value = stringField(body, key);
  return value ? value : null;
}

export function integerField(
  req: Request,
  body: JsonRecord,
  key: string,
  options: { defaultValue?: number; min?: number; max?: number } = {},
): number | Response {
  const value = body[key] ?? options.defaultValue;

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return errorResponse(
      req,
      400,
      "validation_error",
      `${key} must be an integer`,
    );
  }

  if (options.min !== undefined && value < options.min) {
    return errorResponse(
      req,
      400,
      "validation_error",
      `${key} must be at least ${options.min}`,
    );
  }

  if (options.max !== undefined && value > options.max) {
    return errorResponse(
      req,
      400,
      "validation_error",
      `${key} must be at most ${options.max}`,
    );
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
