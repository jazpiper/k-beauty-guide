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

const {
  dedupeImageCandidates,
  isSafeHttpImageUrl,
} = require("../core/mediaValidation.ts");

function createCandidate(url) {
  return { url, source: "open_graph" };
}

function runTests() {
  console.log("Running isSafeHttpImageUrl tests...");
  // Happy path
  assert.equal(isSafeHttpImageUrl("http://example.com/image.jpg"), true);
  assert.equal(isSafeHttpImageUrl("https://example.com/image.png"), true);
  assert.equal(isSafeHttpImageUrl("  https://example.com/image.png  "), true, "should handle whitespace");

  // Invalid strings / parse errors
  assert.equal(isSafeHttpImageUrl("not a valid url"), false);
  assert.equal(isSafeHttpImageUrl(""), false);
  assert.equal(isSafeHttpImageUrl("   "), false);

  // Invalid types
  assert.equal(isSafeHttpImageUrl(undefined), false);
  assert.equal(isSafeHttpImageUrl(null), false);
  assert.equal(isSafeHttpImageUrl(123), false);
  assert.equal(isSafeHttpImageUrl({ url: "https://example.com" }), false);

  // Invalid protocols
  assert.equal(isSafeHttpImageUrl("ftp://example.com/image.jpg"), false);
  assert.equal(isSafeHttpImageUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), false);

  console.log("Running dedupeImageCandidates tests...");

  // 1. Exact duplicates
  let candidates = [
    createCandidate("https://example.com/image.jpg"),
    createCandidate("https://example.com/image.jpg"),
  ];
  let result = dedupeImageCandidates(candidates);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://example.com/image.jpg");

  // 2. Non-duplicate valid URLs
  candidates = [
    createCandidate("https://example.com/image1.jpg"),
    createCandidate("https://example.com/image2.jpg"),
  ];
  result = dedupeImageCandidates(candidates);
  assert.equal(result.length, 2);

  console.log("mediaValidation.ts tests passed");
}

try {
  runTests();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
