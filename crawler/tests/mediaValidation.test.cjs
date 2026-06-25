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

const { dedupeImageCandidates } = require("../core/mediaValidation.ts");

function createCandidate(url) {
  return { url, source: "open_graph" };
}

function runTests() {
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

  console.log("mediaValidation.ts dedupeImageCandidates tests passed");
}

try {
  runTests();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
