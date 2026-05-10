import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

import { buildProductMediaDescriptionCandidateOutput } from "../core/productCandidateExtraction";
import type { ProductCandidate, RawSnapshot } from "../core/types";
import type { ReviewItemPayload } from "../core/reviewPayload";

type LocalCrawlTask = {
  id: string;
  sourceId: string;
  sourceKey: string;
  sourceProductId: string;
  targetUrl: string;
  fixtureHtmlPath: string;
  status: "pending" | "leased" | "completed" | "failed";
  leaseToken?: string;
};

type CompletedFixtureTask = {
  taskId: string;
  sourceId: string;
  sourceKey: string;
  targetUrl: string;
  leaseToken: string;
  status: "completed";
  snapshot: RawSnapshot;
  candidate: ProductCandidate;
  reviewPayloads: ReviewItemPayload[];
};

export type LocalFixtureCrawlerRuntimeSummary = {
  liveCrawlingEnabled: false;
  tasks: {
    claimed: number;
    completed: number;
    failed: number;
    invalidLeaseCompletionsRejected: number;
  };
  snapshotsStored: number;
  candidatesCreated: number;
  reviewPayloadsCreated: number;
  completedTasks: CompletedFixtureTask[];
};

type LocalFixtureDefinition = {
  fixture_id: string;
  source_url: string;
};

const SOURCE_ID = "official-brand";
const SOURCE_KEY = "official-brand-fixture";
const SOURCE_PRODUCT_ID = "OB-CICA-50";

function fixtureRoot(): string {
  return join(__dirname, "..", "fixtures");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadFixture(): { definition: LocalFixtureDefinition; html: string } {
  const root = fixtureRoot();
  const definition = JSON.parse(
    readFileSync(join(root, "official-brand-product-snapshot.json"), "utf8"),
  ) as LocalFixtureDefinition;
  const html = readFileSync(
    join(root, "official-brand-product-snapshot.html"),
    "utf8",
  );

  return { definition, html };
}

function createSeedTask(definition: LocalFixtureDefinition): LocalCrawlTask {
  return {
    id: `fixture-task-${definition.fixture_id}`,
    sourceId: SOURCE_ID,
    sourceKey: SOURCE_KEY,
    sourceProductId: SOURCE_PRODUCT_ID,
    targetUrl: definition.source_url,
    fixtureHtmlPath: join(fixtureRoot(), "official-brand-product-snapshot.html"),
    status: "pending",
  };
}

function claimTask(task: LocalCrawlTask): LocalCrawlTask | null {
  if (task.status !== "pending") return null;

  return {
    ...task,
    status: "leased",
    leaseToken: `fixture-lease-${randomUUID()}`,
  };
}

function storeSnapshot(task: LocalCrawlTask, html: string): RawSnapshot {
  return {
    id: `snapshot-${sha256(`${task.id}:${task.targetUrl}`).slice(0, 16)}`,
    sourceId: task.sourceId,
    targetUrl: task.targetUrl,
    contentType: "html",
    contentHash: sha256(html),
    storagePath: task.fixtureHtmlPath,
    fetchedAt: "2026-05-10T00:00:00.000Z",
  };
}

function completeTask(
  task: LocalCrawlTask,
  leaseToken: string,
  snapshot: RawSnapshot,
  candidate: ProductCandidate,
  reviewPayloads: ReviewItemPayload[],
): CompletedFixtureTask | null {
  if (task.status !== "leased" || task.leaseToken !== leaseToken) return null;

  return {
    taskId: task.id,
    sourceId: task.sourceId,
    sourceKey: task.sourceKey,
    targetUrl: task.targetUrl,
    leaseToken,
    status: "completed",
    snapshot,
    candidate,
    reviewPayloads,
  };
}

export async function runLocalFixtureCrawlerRuntime(): Promise<LocalFixtureCrawlerRuntimeSummary> {
  const { definition, html } = loadFixture();
  const seedTask = createSeedTask(definition);
  const leasedTask = claimTask(seedTask);

  if (!leasedTask?.leaseToken) {
    return {
      liveCrawlingEnabled: false,
      tasks: {
        claimed: 0,
        completed: 0,
        failed: 1,
        invalidLeaseCompletionsRejected: 0,
      },
      snapshotsStored: 0,
      candidatesCreated: 0,
      reviewPayloadsCreated: 0,
      completedTasks: [],
    };
  }

  const snapshot = storeSnapshot(leasedTask, html);
  const output = buildProductMediaDescriptionCandidateOutput({
    html,
    sourceId: leasedTask.sourceId,
    snapshotId: snapshot.id,
    sourceUrl: leasedTask.targetUrl,
    sourceProductId: leasedTask.sourceProductId,
    domImageSelectors: ["section[aria-label='Product gallery'] img[0]"],
    domTextSelectors: ["#benefits li[0]", "#claims p", "#how-to-use p"],
  });
  const invalidCompletion = completeTask(
    leasedTask,
    "stale-fixture-lease",
    snapshot,
    output.candidate,
    output.reviewPayloads,
  );
  const completedTask = completeTask(
    leasedTask,
    leasedTask.leaseToken,
    snapshot,
    output.candidate,
    output.reviewPayloads,
  );
  const completedTasks = completedTask ? [completedTask] : [];

  return {
    liveCrawlingEnabled: false,
    tasks: {
      claimed: 1,
      completed: completedTasks.length,
      failed: completedTask ? 0 : 1,
      invalidLeaseCompletionsRejected: invalidCompletion ? 0 : 1,
    },
    snapshotsStored: 1,
    candidatesCreated: 1,
    reviewPayloadsCreated: output.reviewPayloads.length,
    completedTasks,
  };
}
