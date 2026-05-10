import {
  errorResponse,
  okResponse,
  optionalStringField,
  pathId,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";

const REVIEW_ACTIONS = ["approve", "reject", "block", "assign"] as const;
const COMMENT_REQUIRED_ACTIONS = ["approve", "reject", "block"] as const;

Deno.serve(async (req: Request) => {
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const action = stringField(body, "action");
  const idempotencyKey = stringField(body, "idempotencyKey");
  const comment = stringField(body, "comment");
  const assignedTo = stringField(body, "assignedTo");
  const reviewItemId = optionalStringField(body, "reviewItemId") ?? pathId(req, "admin-review-action");

  if (!REVIEW_ACTIONS.includes(action as typeof REVIEW_ACTIONS[number])) {
    return errorResponse(400, "validation_error", "action must be approve, reject, block, or assign");
  }

  if (!reviewItemId) {
    return errorResponse(400, "validation_error", "reviewItemId is required");
  }

  if (!idempotencyKey) {
    return errorResponse(400, "validation_error", "idempotencyKey is required");
  }

  if (
    COMMENT_REQUIRED_ACTIONS.includes(action as typeof COMMENT_REQUIRED_ACTIONS[number]) &&
    !comment
  ) {
    return errorResponse(400, "validation_error", `${action} requires comment`);
  }

  if (action === "assign" && !assignedTo) {
    return errorResponse(400, "validation_error", "assign requires assignedTo");
  }

  return okResponse({
    accepted: true,
    action,
    reviewItemId,
    idempotencyKey,
    comment: comment || null,
    assignedTo: assignedTo || null,
    note: "MVP shell only. DB mutation and audit log write are intentionally not implemented yet.",
  });
});
