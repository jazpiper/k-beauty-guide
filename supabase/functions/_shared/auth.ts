export function constantTimeCompare(a: string, b: string): boolean {
  const aLen = a.length;
  const bLen = b.length;
  let result = aLen ^ bLen;
  for (let i = 0; i < aLen; i++) {
    const bChar = i < bLen ? b.charCodeAt(i) : 0;
    result |= a.charCodeAt(i) ^ bChar;
  }
  return result === 0;
}

export function validateWorkerToken(req: Request): boolean {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return false;
  }

  const workerSecret =
    Deno.env.get("CRAWL_TASK_SECRET") ||
    Deno.env.get("FUNCTION_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!workerSecret) {
    return false;
  }

  return constantTimeCompare(token, workerSecret);
}
