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

const { detectClaimRiskFlags, extractDescriptionCandidatesFromDomSelectors } = require("../core/textExtractors.ts");

function testDetectClaimRiskFlags() {
  console.log("Testing detectClaimRiskFlags...");

  const cases = [
    { input: "This product cures eczema.", expected: ["medical_treatment", "disease_reference"] },
    { input: "Contains FDA approved drugs.", expected: ["regulatory_drug"] },
    { input: "SPF 50 and PA++++ protection.", expected: ["spf_pa_claim"] },
    { input: "Safe for pregnancy, hypoallergenic, non-comedogenic, and dermatologist tested.", expected: ["pregnancy_safe_claim", "hypoallergenic_claim", "non_comedogenic_claim", "dermatologist_tested_claim"] },
    { input: "아토피 완치.", expected: ["korean_treatment"] },
    { input: "Just a normal moisturizer.", expected: [] },
    { input: null, expected: [] },
    { input: undefined, expected: [] },
    { input: 123, expected: [] },
  ];

  for (const c of cases) {
    const result = detectClaimRiskFlags(c.input);
    assert.deepEqual(result.sort(), c.expected.sort(), `Failed for input: ${c.input}`);
  }

  console.log("All detectClaimRiskFlags tests passed!");
}

testDetectClaimRiskFlags();


function testExtractDescriptionCandidatesFromDomSelectors() {
  console.log("Testing extractDescriptionCandidatesFromDomSelectors...");
  const html = "<div id=\"content\"><p>Hello world</p><p>Second paragraph</p><span>Span text</span></div>";
  const results = extractDescriptionCandidatesFromDomSelectors(html, ["p", "span"]);
  assert.equal(results.length, 3);
  assert.equal(results[0].text, "Hello world");
  assert.equal(results[1].text, "Second paragraph");
  assert.equal(results[2].text, "Span text");

  // Performance benchmark
  const tags = ["p", "span", "div", "a", "p", "span", "h1", "h2", "p", "div"];
  const start = performance.now();
  const iterations = 50000;
  for (let i = 0; i < iterations; i++) {
    for (const tag of tags) {
      extractDescriptionCandidatesFromDomSelectors(html, [tag]);
    }
  }
  const elapsed = performance.now() - start;
  console.log(`Post-optimization elapsed time for ${iterations * tags.length} extractions: ${elapsed.toFixed(2)} ms`);
  console.log("All extractDescriptionCandidatesFromDomSelectors tests passed!");
}

testExtractDescriptionCandidatesFromDomSelectors();
