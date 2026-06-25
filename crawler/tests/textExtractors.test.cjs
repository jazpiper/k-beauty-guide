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

const { cleanupDescriptionText } = require("../core/textExtractors.ts");

function runTests() {
  // Test 1: Non-string inputs
  assert.equal(cleanupDescriptionText(null), "");
  assert.equal(cleanupDescriptionText(undefined), "");
  assert.equal(cleanupDescriptionText(123), "");
  assert.equal(cleanupDescriptionText({}), "");
  assert.equal(cleanupDescriptionText([]), "");

  // Test 2: Normal string
  assert.equal(cleanupDescriptionText("Hello world"), "Hello world");

  // Test 3: script and style tag removal
  assert.equal(cleanupDescriptionText("<script>alert(1)</script>Hello"), "Hello");
  assert.equal(cleanupDescriptionText("Hello<style>body { color: red; }</style>World"), "Hello World");
  assert.equal(cleanupDescriptionText("<script type='text/javascript'>alert(1)</script>Hello"), "Hello");
  assert.equal(cleanupDescriptionText("<style type='text/css'>body { color: red; }</style>Hello"), "Hello");
  assert.equal(cleanupDescriptionText("<script src='x.js'></script>Hello"), "Hello");

  // Test 4: General HTML tag removal
  assert.equal(cleanupDescriptionText("<p>Hello <b>World</b></p>"), "Hello World");
  assert.equal(cleanupDescriptionText("Hello <br/> World"), "Hello World");

  // Test 5: HTML entity decoding
  assert.equal(cleanupDescriptionText("Hello&nbsp;World"), "Hello World");
  assert.equal(cleanupDescriptionText("Hello &amp; World"), "Hello & World");
  assert.equal(cleanupDescriptionText("1 &lt; 2 &gt; 0"), "1 < 2 > 0");
  assert.equal(cleanupDescriptionText("&quot;Hello&quot;"), '"Hello"');
  assert.equal(cleanupDescriptionText("&#39;Hello&#39;"), "'Hello'");

  // Test 6: Whitespace normalization
  assert.equal(cleanupDescriptionText("  Hello   World  "), "Hello World");
  assert.equal(cleanupDescriptionText("Hello\nWorld"), "Hello World");
  assert.equal(cleanupDescriptionText("Hello\tWorld"), "Hello World");

  // Test 7: maxLength truncation
  assert.equal(cleanupDescriptionText("Hello World", 5), "Hello");
  assert.equal(cleanupDescriptionText("Hello World", 11), "Hello World");
  assert.equal(cleanupDescriptionText("Hello World", 12), "Hello World");
  assert.equal(cleanupDescriptionText("   Hello World   ", 5), "Hello");

  // Test 8: maxLength edge cases
  assert.equal(cleanupDescriptionText("Hello World", 0), "");
  assert.equal(cleanupDescriptionText("Hello World", -5), "");

  // Test 9: Empty strings and strings that become empty
  assert.equal(cleanupDescriptionText(""), "");
  assert.equal(cleanupDescriptionText("   "), "");
  assert.equal(cleanupDescriptionText("<p></p>"), "");
  assert.equal(cleanupDescriptionText("&nbsp;"), "");

  console.log("textExtractors tests passed");
}

runTests();
