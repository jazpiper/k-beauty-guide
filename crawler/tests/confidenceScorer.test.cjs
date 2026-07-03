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

const { scoreCandidate } = require("../core/confidenceScorer.ts");

function createEmptyCandidate() {
  return {
    sourceId: "test",
    snapshotId: "test",
    sourceUrl: "http://test",
    productName: "",
    imageUrls: [],
    claims: [],
    parserVersion: "1.0",
    confidenceHints: [],
  };
}

function testScoreCandidate() {
  console.log("Testing scoreCandidate...");

  // BASE_SCORE for an empty candidate
  const base = scoreCandidate(createEmptyCandidate());
  assert.equal(base, 0.35, `Base score should be 0.35, got ${base}`);

  // Component scores for strings (productName, brandName, ingredientTextRaw, sourceProductId)
  let candidate = createEmptyCandidate();
  candidate.productName = "Product";
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.20).toFixed(2)), "productName should add 0.20");

  candidate = createEmptyCandidate();
  candidate.brandName = "Brand";
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.15).toFixed(2)), "brandName should add 0.15");

  candidate = createEmptyCandidate();
  candidate.ingredientTextRaw = "Water";
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.15).toFixed(2)), "ingredientTextRaw should add 0.15");

  candidate = createEmptyCandidate();
  candidate.sourceProductId = "123";
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.05).toFixed(2)), "sourceProductId should add 0.05");

  // Image completeness (0, 1, 2, 3+ deduped images)
  candidate = createEmptyCandidate();
  candidate.imageUrls = ["http://test/1.jpg"];
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.08).toFixed(2)), "1 image should add 0.08");

  candidate.imageUrls = ["http://test/1.jpg", "http://test/2.jpg"];
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.11).toFixed(2)), "2 images should add 0.11");

  candidate.imageUrls = ["http://test/1.jpg", "http://test/2.jpg", "http://test/3.jpg"];
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.13).toFixed(2)), "3+ images should add 0.13");

  candidate.imageUrls = ["http://test/1.jpg", "http://test/1.jpg?utm_source=1"]; // deduped to 1
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.08).toFixed(2)), "deduped to 1 image should add 0.08");

  // Description completeness
  candidate = createEmptyCandidate();
  candidate.description = "short"; // < 60
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.04).toFixed(2)), "description < 60 should add 0.04");

  candidate.description = "a".repeat(60); // < 160
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.07).toFixed(2)), "description < 160 should add 0.07");

  candidate.description = "a".repeat(160); // >= 160
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.10).toFixed(2)), "description >= 160 should add 0.10");

  // Claims completeness
  candidate = createEmptyCandidate();
  candidate.claims = ["claim1"];
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.03).toFixed(2)), "1 claim should add 0.03");

  candidate.claims = ["claim1", "claim2"];
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.05).toFixed(2)), "2 claims should add 0.05");

  candidate.claims = ["claim1", "claim2", "claim3"];
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.07).toFixed(2)), "3+ claims should add 0.07");

  // Price existence
  candidate = createEmptyCandidate();
  candidate.sourcePrice = 10;
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.05).toFixed(2)), "sourcePrice should add 0.05");

  candidate = createEmptyCandidate();
  candidate.priceKrw = 1000;
  assert.equal(scoreCandidate(candidate), Number((0.35 + 0.05).toFixed(2)), "priceKrw should add 0.05");

  // Penalties
  candidate = createEmptyCandidate();
  candidate.confidenceHints = [{ reasonCode: "missing" }];
  assert.equal(scoreCandidate(candidate), Number((0.35 - 0.08).toFixed(2)), "missing hint should subtract 0.08");

  candidate.confidenceHints = [{ reasonCode: "weak_match" }];
  assert.equal(scoreCandidate(candidate), Number((0.35 - 0.05).toFixed(2)), "weak_match hint should subtract 0.05");

  candidate.confidenceHints = [{ reasonCode: "conflict" }];
  assert.equal(scoreCandidate(candidate), Number((0.35 - 0.12).toFixed(2)), "conflict hint should subtract 0.12");

  candidate.confidenceHints = [{ reasonCode: "parser_fallback" }];
  assert.equal(scoreCandidate(candidate), Number((0.35 - 0.06).toFixed(2)), "parser_fallback hint should subtract 0.06");

  candidate.confidenceHints = [
    { reasonCode: "conflict" }, // -0.12
    { reasonCode: "conflict" }, // -0.12
    { reasonCode: "conflict" }, // -0.12
  ]; // Total penalty -0.36, but capped at -0.30
  assert.equal(scoreCandidate(candidate), Number((0.35 - 0.30).toFixed(2)), "penalties should cap at 0.30");

  // Maximum and Minimum capping
  candidate = {
    ...createEmptyCandidate(),
    productName: "Product", // +0.20
    brandName: "Brand", // +0.15
    imageUrls: ["1", "2", "3"], // +0.13
    description: "a".repeat(160), // +0.10
    claims: ["1", "2", "3"], // +0.07
    ingredientTextRaw: "Water", // +0.15
    sourceProductId: "123", // +0.05
    sourcePrice: 10, // +0.05
    // Total: 0.35 + 0.90 = 1.25 -> clamped to 1.00
  };
  assert.equal(scoreCandidate(candidate), 1.00, "maximum score should cap at 1.00");

  candidate = createEmptyCandidate();
  // We can't really get a negative score organically with BASE_SCORE=0.35 and max penalty=0.30,
  // but if somehow we could, it would be capped at 0.

  console.log("All scoreCandidate tests passed!");
}

testScoreCandidate();
