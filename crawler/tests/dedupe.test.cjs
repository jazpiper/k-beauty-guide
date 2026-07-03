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

const { normalizeSourceUrl } = require("../core/dedupe.ts");

// The function is normalizeComparableUrl which is exported via normalizeSourceUrl
// Test the catch block fallback logic: return trimmed.replace(/#.*$/, "").replace(/\/$/, "");

// 1. Invalid URL with hash and trailing slash
assert.equal(
  normalizeSourceUrl("invalid-url-format#some-hash/"),
  "invalid-url-format",
  "should strip hash and trailing slash for invalid URLs"
);

// 2. Invalid URL with only hash
assert.equal(
  normalizeSourceUrl("another-invalid-url#hash"),
  "another-invalid-url",
  "should strip hash for invalid URLs"
);

// 3. Invalid URL with only trailing slash
assert.equal(
  normalizeSourceUrl("invalid-url/"),
  "invalid-url",
  "should strip trailing slash for invalid URLs"
);

// 4. Invalid URL with neither hash nor trailing slash
assert.equal(
  normalizeSourceUrl("just-invalid"),
  "just-invalid",
  "should return as is for invalid URLs without hash or slash"
);

// 5. Empty or undefined inputs
assert.equal(normalizeSourceUrl(undefined), "", "should return empty string for undefined");
assert.equal(normalizeSourceUrl("   "), "", "should return empty string for whitespace");

// 6. Valid URL behavior (just to ensure no regressions in happy path)
assert.equal(
  normalizeSourceUrl("https://EXAMPLE.com/path/?utm_source=test#hash"),
  "https://example.com/path",
  "should normalize valid URLs correctly"
);

console.log("dedupe error path tests passed");
