import {
  errorResponse,
  okResponse,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const analysisRunId = stringField(body, "analysisRunId");
  if (!analysisRunId) {
    return errorResponse(400, "validation_error", "analysisRunId is required");
  }

  return okResponse({
    analysisRunId,
    status: "queued",
    flagsWritten: 0,
    note:
      "MVP shell only. Final safety classification must come from deterministic safety rules, not LLM output.",
  });
});
