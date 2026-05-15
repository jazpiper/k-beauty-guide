const assert = require("assert/strict");
const Module = require("module");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};

const originalLoad = Module._load;
Module._load = function guardedLoad(request, parent, isMain) {
  if (["http", "https", "net", "dns"].includes(request)) {
    throw new Error(`Network module ${request} must not be used by local fixture runtime`);
  }

  return originalLoad.call(this, request, parent, isMain);
};

global.fetch = async () => {
  throw new Error("fetch must not be used by local fixture runtime");
};

const { runLocalFixtureCrawlerRuntime } = require("../runtime/localFixtureRuntime.ts");

async function main() {
  const summary = await runLocalFixtureCrawlerRuntime();

  assert.equal(summary.liveCrawlingEnabled, false);
  assert.equal(summary.tasks.claimed, 1);
  assert.equal(summary.tasks.completed, 1);
  assert.equal(summary.tasks.failed, 0);
  assert.equal(summary.tasks.invalidLeaseCompletionsRejected, 1);
  assert.equal(summary.snapshotsStored, 1);
  assert.equal(summary.candidatesCreated, 1);
  assert.ok(summary.reviewPayloadsCreated >= 3);
  assert.equal(summary.completedTasks.length, 1);

  const completedTask = summary.completedTasks[0];
  assert.equal(completedTask.status, "completed");
  assert.equal(completedTask.sourceKey, "official-brand-fixture");
  assert.match(completedTask.leaseToken, /^fixture-lease-/);
  assert.equal(completedTask.candidate.productName, "Cica Barrier Cream");
  assert.ok(completedTask.candidate.imageCandidates.length >= 3);
  assert.ok(completedTask.candidate.descriptionCandidates.length >= 3);
  assert.ok(completedTask.candidate.confidenceScore > 0.7);

  const reviewTypes = completedTask.reviewPayloads.map((payload) => payload.item_type);
  assert.ok(reviewTypes.includes("image_candidate_review"));
  assert.ok(reviewTypes.includes("description_candidate_review"));
  assert.ok(reviewTypes.includes("claim_risk_review"));

  for (const payload of completedTask.reviewPayloads) {
    assert.equal(payload.payload.candidate.source_id, "official-brand");
    assert.ok(!("publish" in payload.payload), "runtime must not auto-publish");
  }

  console.log("local fixture crawler runtime harness passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
