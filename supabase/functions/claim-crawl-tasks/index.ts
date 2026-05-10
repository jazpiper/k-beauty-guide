import {
  errorResponse,
  integerField,
  okResponse,
  optionalStringField,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const TASK_TYPES = [
  "discover_product_urls",
  "fetch_product_detail",
  "refresh_existing_product",
] as const;

type ClaimedTaskRow = {
  id: string;
  source_id: string | null;
  task_type: string;
  target_url: string;
  status: string;
  attempt_count: number;
  next_run_at: string | null;
  lease_token: string;
  locked_until: string;
};

Deno.serve(async (req: Request) => {
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const workerId = stringField(body, "workerId");
  if (!workerId) {
    return errorResponse(400, "validation_error", "workerId is required");
  }

  const limit = integerField(body, "limit", { min: 1, max: 25 });
  if (limit instanceof Response) return limit;

  const leaseSeconds = integerField(body, "leaseSeconds", {
    defaultValue: 300,
    min: 1,
    max: 900,
  });
  if (leaseSeconds instanceof Response) return leaseSeconds;

  const taskTypes = validateTaskTypes(body.taskTypes);
  if (taskTypes instanceof Response) return taskTypes;

  const serviceClient = createServiceRoleClient();
  if (!serviceClient.ok) {
    return errorResponse(
      503,
      "service_unavailable",
      "Service role Supabase environment is not configured for crawl task claiming",
      { missingEnv: serviceClient.missing },
    );
  }

  const { data, error } = await serviceClient.client.rpc("claim_due_crawl_tasks", {
    p_worker_id: workerId,
    p_source_id: optionalStringField(body, "sourceId"),
    p_task_types: taskTypes,
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    return errorResponse(500, "internal_error", "Failed to claim crawl tasks", {
      message: error.message,
    });
  }

  return okResponse({
    tasks: ((data ?? []) as ClaimedTaskRow[]).map((task) => ({
      id: task.id,
      sourceId: task.source_id,
      taskType: task.task_type,
      targetUrl: task.target_url,
      status: task.status,
      attemptCount: task.attempt_count,
      nextRunAt: task.next_run_at,
      leaseToken: task.lease_token,
      lockedUntil: task.locked_until,
    })),
  });
});

function validateTaskTypes(value: unknown): string[] | null | Response {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Array.isArray(value)) {
    return errorResponse(400, "validation_error", "taskTypes must be an array");
  }

  const invalidTaskType = value.find((item) =>
    typeof item !== "string" || !TASK_TYPES.includes(item as typeof TASK_TYPES[number])
  );

  if (invalidTaskType !== undefined) {
    return errorResponse(
      400,
      "validation_error",
      "taskTypes must contain only supported crawl task types",
    );
  }

  return value as string[];
}
