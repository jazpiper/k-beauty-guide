import { randomUUID } from "node:crypto";

const functionRoot = normalizeFunctionRoot(
  process.env.SUPABASE_FUNCTIONS_ROOT ||
    process.env.SUPABASE_FUNCTIONS_URL ||
    "http://127.0.0.1:54321/functions/v1",
);
const supabaseJwt = process.env.SUPABASE_ANON_KEY ||
  process.env.ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SERVICE_ROLE_KEY;

const headers = { "Content-Type": "application/json" };

if (supabaseJwt) {
  headers.Authorization = `Bearer ${supabaseJwt}`;
  headers.apikey = supabaseJwt;
}

await expectValidationError("claim-crawl-tasks", {}, "workerId is required");

const claimBody = await postOk("claim-crawl-tasks", {
  workerId: `local-smoke-${Date.now()}`,
  limit: 1,
  leaseSeconds: 60,
  taskTypes: ["fetch_product_detail"],
});

const [claimedTask] = claimBody.data?.tasks ?? [];

assert(
  claimedTask,
  "Expected one seeded crawl task to be claimed. Run this smoke after `supabase db reset`.",
);
assertString(claimedTask.id, "claimed task id");
assertString(claimedTask.leaseToken, "claimed task leaseToken");
assertEqual(claimedTask.taskType, "fetch_product_detail", "claimed task taskType");
assertEqual(claimedTask.status, "running", "claimed task status");
assertString(claimedTask.targetUrl, "claimed task targetUrl");
assertNumber(claimedTask.attemptCount, "claimed task attemptCount");
assertString(claimedTask.lockedUntil, "claimed task lockedUntil");

const staleCompleteBody = await post("complete-crawl-task", {
  taskId: claimedTask.id,
  leaseToken: randomUUID(),
  status: "succeeded",
});

assertEqual(staleCompleteBody.status, 409, "stale completion status");
assertEqual(staleCompleteBody.body?.ok, false, "stale completion ok");
assertEqual(staleCompleteBody.body?.error?.code, "conflict", "stale completion error code");

const completeBody = await postOk("complete-crawl-task", {
  taskId: claimedTask.id,
  leaseToken: claimedTask.leaseToken,
  status: "succeeded",
});

assertEqual(completeBody.data?.task?.id, claimedTask.id, "completed task id");
assertEqual(completeBody.data?.task?.status, "succeeded", "completed task status");
assertEqual(completeBody.data?.task?.lockedUntil, null, "completed task lockedUntil");

await expectValidationError("complete-crawl-task", {
  taskId: claimedTask.id,
  status: "succeeded",
}, "leaseToken is required");

await expectValidationError("admin-review-action", {
  action: "approve",
  reviewItemId: randomUUID(),
  idempotencyKey: randomUUID(),
}, "approve requires comment");

await expectValidationError("admin-review-action", {
  action: "assign",
  reviewItemId: randomUUID(),
  idempotencyKey: randomUUID(),
}, "assign requires assignedTo");

await expectValidationError("run-safety-analysis", {}, "analysisRunId is required");

const analysisRunId = randomUUID();
const safetyBody = await postOk("run-safety-analysis", { analysisRunId });
assertEqual(safetyBody.data?.analysisRunId, analysisRunId, "safety analysisRunId");
assertEqual(safetyBody.data?.status, "queued", "safety status");
assertEqual(safetyBody.data?.flagsWritten, 0, "safety flagsWritten");

await expectValidationError("run-ai-quality", {}, "candidateId is required");

const candidateId = randomUUID();
const qualityBody = await postOk("run-ai-quality", { candidateId });
assertEqual(qualityBody.data?.candidateId, candidateId, "AI quality candidateId");
assertEqual(qualityBody.data?.duplicateSuggestionsCreated, 0, "AI quality duplicate suggestions");
assertEqual(qualityBody.data?.fieldSuggestionsCreated, 0, "AI quality field suggestions");
assertEqual(qualityBody.data?.autoPublished, false, "AI quality autoPublished");
assertEqual(qualityBody.data?.autoMerged, false, "AI quality autoMerged");

console.log(JSON.stringify({
  ok: true,
  claimedTaskId: claimedTask.id,
  checkedFunctions: [
    "claim-crawl-tasks",
    "complete-crawl-task",
    "admin-review-action",
    "run-safety-analysis",
    "run-ai-quality",
  ],
}, null, 2));

async function expectValidationError(functionName, payload, message) {
  const result = await post(functionName, payload);

  assertEqual(result.status, 400, `${functionName} validation status`);
  assertEqual(result.body?.ok, false, `${functionName} validation ok`);
  assertEqual(result.body?.error?.code, "validation_error", `${functionName} validation code`);

  if (message) {
    assertEqual(result.body?.error?.message, message, `${functionName} validation message`);
  }
}

async function postOk(functionName, payload) {
  const result = await post(functionName, payload);

  if (!result.response.ok || result.body?.ok !== true) {
    throw new Error(
      `${functionName} expected ok response, received HTTP ${result.status}: ${JSON.stringify(result.body)}`,
    );
  }

  return result.body;
}

async function post(functionName, payload) {
  const response = await fetch(`${functionRoot}/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, status: response.status, body };
}

function normalizeFunctionRoot(value) {
  return value.replace(/\/$/, "").replace(/\/(analyze-ingredient-text)$/, "");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertString(value, label) {
  assert(typeof value === "string" && value.length > 0, `Expected ${label} to be a non-empty string`);
}

function assertNumber(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), `Expected ${label} to be a finite number`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Expected ${label} to be ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}
