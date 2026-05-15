const assert = require("assert/strict");
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

const {
  buildProductMediaDescriptionCandidateOutput,
} = require("../core/productCandidateExtraction.ts");

const fixtureRoot = path.join(__dirname, "..", "fixtures");
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(fixtureRoot, "official-brand-product-snapshot.json"),
    "utf8",
  ),
);
const html = fs.readFileSync(
  path.join(fixtureRoot, "official-brand-product-snapshot.html"),
  "utf8",
);

const output = buildProductMediaDescriptionCandidateOutput({
  html,
  sourceId: "official-brand",
  snapshotId: fixture.fixture_id,
  sourceUrl: fixture.source_url,
  sourceProductId: "OB-CICA-50",
  domImageSelectors: ["section[aria-label='Product gallery'] img[0]"],
  domTextSelectors: ["#benefits li[0]", "#claims p", "#how-to-use p"],
});

const expectedImages = fixture.expected_candidates.images;
const expectedTexts = fixture.expected_candidates.texts;

for (const expected of expectedImages) {
  const actual = output.candidate.imageCandidates.find(
    (candidate) => candidate.url === expected.image_url,
  );
  assert.ok(actual, `missing image candidate ${expected.image_url}`);
  assert.equal(actual.candidateRole, expected.role);
  assert.equal(actual.sourceEvidence, expected.source_evidence);
  assert.equal(actual.reviewStatus, "needs_review");
  assert.equal(actual.imageStoragePolicy, "remote_url_only");
  assert.match(actual.url, /^https:\/\//);
}

for (const expected of expectedTexts) {
  const actual = output.candidate.descriptionCandidates.find(
    (candidate) => candidate.text === expected.raw_text,
  );
  assert.ok(actual, `missing text candidate ${expected.raw_text}`);
  assert.equal(actual.fieldType, expected.field_type);
  assert.equal(actual.sourceEvidence, expected.source_evidence);
  assert.equal(actual.reviewStatus, "needs_review");
  assert.deepEqual(actual.riskFlags ?? [], expected.risk_flags ?? []);
}

assert.deepEqual(
  output.candidate.imageUrls,
  expectedImages.map((candidate) => candidate.image_url),
);
assert.equal(output.candidate.description, expectedTexts[0].raw_text);
assert.ok(output.candidate.confidenceScore > 0.7);

const reviewTypes = output.reviewPayloads.map((payload) => payload.item_type);
assert.ok(reviewTypes.includes("image_candidate_review"));
assert.ok(reviewTypes.includes("description_candidate_review"));
assert.ok(reviewTypes.includes("claim_risk_review"));

for (const reviewPayload of output.reviewPayloads) {
  assert.equal(reviewPayload.payload.candidate.source_id, "official-brand");
  assert.equal(reviewPayload.payload.candidate.source_url, fixture.source_url);
  assert.ok(!("publish" in reviewPayload.payload), "must not auto-publish");
}

console.log("product media/description fixture harness passed");
