import {
  errorResponse,
  okResponse,
  optionalStringField,
  pathId,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const COMPLETION_STATUSES = ["succeeded", "failed", "needs_review"] as const;

type CrawlTaskRow = {
  id: string;
  source_id: string | null;
  task_type: string;
  target_url: string;
  status: string;
  attempt_count: number;
  next_run_at: string | null;
  locked_until: string | null;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
};

Deno.serve(async (req: Request) => {
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const taskId = optionalStringField(body, "taskId") ?? pathId(req, "complete-crawl-task");
  const leaseToken = stringField(body, "leaseToken");
  const status = stringField(body, "status");
  const retryAfter = optionalStringField(body, "retryAfter");
  const errorCode = optionalStringField(body, "errorCode");
  const errorMessage = optionalStringField(body, "errorMessage");

  if (!taskId) {
    return errorResponse(400, "validation_error", "taskId is required");
  }

  if (!leaseToken) {
    return errorResponse(400, "validation_error", "leaseToken is required");
  }

  if (!COMPLETION_STATUSES.includes(status as typeof COMPLETION_STATUSES[number])) {
    return errorResponse(400, "validation_error", "status must be succeeded, failed, or needs_review");
  }

  if (status !== "succeeded" && (!errorCode || !errorMessage)) {
    return errorResponse(
      400,
      "validation_error",
      "failed and needs_review completions require errorCode and errorMessage",
    );
  }

  if (retryAfter && Number.isNaN(Date.parse(retryAfter))) {
    return errorResponse(400, "validation_error", "retryAfter must be an ISO timestamp");
  }

  const serviceClient = createServiceRoleClient();
  if (!serviceClient.ok) {
    return errorResponse(
      503,
      "service_unavailable",
      "Service role Supabase environment is not configured for crawl task completion",
      { missingEnv: serviceClient.missing },
    );
  }

  const { data, error } = await serviceClient.client.rpc("complete_crawl_task", {
    p_task_id: taskId,
    p_lease_token: leaseToken,
    p_status: status,
    p_retry_after: status === "failed" ? retryAfter : null,
    p_error_code: errorCode,
    p_error_message: errorMessage,
  });

  if (error) {
    return mapCompleteError(error.message);
  }

  const task = data as CrawlTaskRow;
  return okResponse({
    task: {
      id: task.id,
      sourceId: task.source_id,
      taskType: task.task_type,
      targetUrl: task.target_url,
      status: task.status,
      attemptCount: task.attempt_count,
      nextRunAt: task.next_run_at,
      lockedUntil: task.locked_until,
      finishedAt: task.finished_at,
      errorCode: task.error_code,
      errorMessage: task.error_message,
    },
    snapshotId: optionalStringField(body, "snapshotId"),
    candidateId: optionalStringField(body, "candidateId"),
    discoveredUrls: Array.isArray(body.discoveredUrls) ? body.discoveredUrls : [],
  });
});

function mapCompleteError(message: string): Response {
  const normalized = message.toLowerCase();

  if (normalized.includes("stale") || normalized.includes("lease")) {
    return errorResponse(409, "conflict", "Crawl task lease is stale or mismatched", {
      message,
    });
  }

  if (normalized.includes("invalid input syntax") || normalized.includes("invalid crawl task")) {
    return errorResponse(400, "validation_error", message);
  }

  return errorResponse(500, "internal_error", "Failed to complete crawl task", { message });
}
