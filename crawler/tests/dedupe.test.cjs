const assert = require("assert/strict");
const fs = require("fs");
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

const { compareCandidates } = require("../core/dedupe.ts");

function createMockCandidate(overrides = {}) {
  return {
    sourceId: "mock-source",
    snapshotId: "mock-snapshot",
    sourceUrl: "https://example.com/product",
    productName: "Mock Product",
    brandName: "Mock Brand",
    imageUrls: ["https://example.com/image.jpg"],
    claims: [],
    parserVersion: "1.0",
    confidenceHints: [],
    confidenceScore: 1.0,
    ...overrides,
  };
}

function testCompareCandidates() {
  // Test case 1: Identical candidates (all signals)
  const candidate1 = createMockCandidate({ sourceProductId: "123" });
  const candidate2 = createMockCandidate({ sourceProductId: "123" });

  let signals = compareCandidates(candidate1, candidate2);
  let reasons = signals.map(s => s.reasonCode);

  assert.ok(reasons.includes("same_source_product_id"), "Should have same_source_product_id signal");
  assert.ok(reasons.includes("same_source_url"), "Should have same_source_url signal");
  assert.ok(reasons.includes("same_image_url"), "Should have same_image_url signal");
  assert.ok(reasons.includes("same_brand_normalized_name"), "Should have same_brand_normalized_name signal");

  // Test case 2: Different candidates, no signals
  const candidate3 = createMockCandidate({
    sourceId: "other-source",
    sourceProductId: "456",
    sourceUrl: "https://example.com/other",
    productName: "Other Product",
    brandName: "Other Brand",
    imageUrls: ["https://example.com/other.jpg"],
  });

  signals = compareCandidates(candidate1, candidate3);
  assert.equal(signals.length, 0, "Should have no signals for completely different candidates");

  // Test case 3: Same source product ID, different everything else
  const candidate4 = createMockCandidate({
    sourceId: "mock-source",
    sourceProductId: "123",
    sourceUrl: "https://example.com/other",
    productName: "Other Product",
    brandName: "Other Brand",
    imageUrls: ["https://example.com/other.jpg"],
  });

  signals = compareCandidates(candidate1, candidate4);
  reasons = signals.map(s => s.reasonCode);
  assert.ok(reasons.includes("same_source_product_id"));
  assert.equal(reasons.length, 1);

  // Test case 4: Same source URL (normalized), different everything else
  const candidate5 = createMockCandidate({
    sourceId: "mock-source",
    sourceProductId: "789",
    sourceUrl: "HTTPS://EXAMPLE.COM/product?utm_source=test",
    productName: "Other Product",
    brandName: "Other Brand",
    imageUrls: ["https://example.com/other.jpg"],
  });

  signals = compareCandidates(candidate1, candidate5);
  reasons = signals.map(s => s.reasonCode);
  assert.ok(reasons.includes("same_source_url"), "Should have same_source_url signal");
  assert.equal(reasons.length, 1, "Should only have same_source_url signal");

  // Test case 5: Same image URL, different everything else
  const candidate6 = createMockCandidate({
    sourceId: "mock-source",
    sourceProductId: "789",
    sourceUrl: "https://example.com/other",
    productName: "Other Product",
    brandName: "Other Brand",
    imageUrls: ["HTTPS://EXAMPLE.COM/image.jpg?utm_source=test"],
  });

  signals = compareCandidates(candidate1, candidate6);
  reasons = signals.map(s => s.reasonCode);
  assert.ok(reasons.includes("same_image_url"));
  assert.equal(reasons.length, 1);

  // Test case 6: Same brand and product name (normalized), different everything else
  const candidate7 = createMockCandidate({
    sourceId: "mock-source",
    sourceProductId: "789",
    sourceUrl: "https://example.com/other",
    productName: "mock product!",
    brandName: "MOCK BRAND",
    imageUrls: ["https://example.com/other.jpg"],
  });

  signals = compareCandidates(candidate1, candidate7);
  reasons = signals.map(s => s.reasonCode);
  assert.ok(reasons.includes("same_brand_normalized_name"));
  assert.equal(reasons.length, 1);

  console.log("dedupe fixture harness passed");
}

try {
  testCompareCandidates();
} catch (error) {
  console.error("Test failed:");
  console.error(error);
  process.exitCode = 1;
}
