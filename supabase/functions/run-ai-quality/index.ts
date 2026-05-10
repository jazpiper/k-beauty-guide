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

  const candidateId = stringField(body, "candidateId");
  if (!candidateId) {
    return errorResponse(400, "validation_error", "candidateId is required");
  }

  return okResponse({
    candidateId,
    duplicateSuggestionsCreated: 0,
    fieldSuggestionsCreated: 0,
    autoPublished: false,
    autoMerged: false,
    note: "MVP shell only. This function never publishes or merges product candidates automatically.",
  });
});
