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

const { isSafeHttpImageUrl } = require("../core/mediaValidation.ts");

// Tests for isSafeHttpImageUrl

// Happy path tests
assert.equal(isSafeHttpImageUrl("http://example.com/image.jpg"), true);
assert.equal(isSafeHttpImageUrl("https://example.com/image.png"), true);
assert.equal(isSafeHttpImageUrl("  https://example.com/image.png  "), true, "should handle whitespace");

// Error path / explicit catch block test
assert.equal(isSafeHttpImageUrl("not a valid url"), false, "should return false for invalid URL strings that throw when parsed");

// Other invalid cases
assert.equal(isSafeHttpImageUrl(undefined), false);
assert.equal(isSafeHttpImageUrl(null), false);
assert.equal(isSafeHttpImageUrl(123), false);
assert.equal(isSafeHttpImageUrl({ url: "https://example.com" }), false);
assert.equal(isSafeHttpImageUrl(""), false);
assert.equal(isSafeHttpImageUrl("   "), false);
assert.equal(isSafeHttpImageUrl("ftp://example.com/image.jpg"), false, "should return false for non-http/https protocols");
assert.equal(isSafeHttpImageUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), false, "should return false for data URIs");

console.log("media validation test harness passed");
