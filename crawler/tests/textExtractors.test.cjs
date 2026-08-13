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
  cleanupDescriptionText,
  extractDescriptionCandidatesFromJsonLd,
  extractDescriptionCandidatesFromOpenGraph,
  extractDescriptionCandidatesFromShopifyProductJson,
  extractDescriptionCandidatesFromDomSelectors
} = require("../core/textExtractors.ts");


const { detectClaimRiskFlags } = require("../core/textExtractors.ts");

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

function testCleanupDescriptionText() {
  console.log("Testing cleanupDescriptionText...");

  assert.equal(cleanupDescriptionText(null), "", "Should handle null");
  assert.equal(cleanupDescriptionText(123), "", "Should handle numbers");

  assert.equal(cleanupDescriptionText("Hello"), "Hello", "Should return plain string");

  // Script and style removal
  assert.equal(
    cleanupDescriptionText("A<script>alert('x')</script>B<style>body{}</style>C"),
    "A B C",
    "Should remove script and style tags and their contents"
  );

  // HTML tag removal
  assert.equal(
    cleanupDescriptionText("<p>Hello <b>World</b></p>"),
    "Hello World",
    "Should remove standard HTML tags"
  );

  // HTML decoding
  assert.equal(
    cleanupDescriptionText("A&nbsp;B&amp;C&lt;D&gt;E&quot;F&#39;G"),
    "A B&C<D>E\"F'G",
    "Should decode minimal HTML entities"
  );

  // Whitespace normalization
  assert.equal(
    cleanupDescriptionText("  Hello   \n\t World  "),
    "Hello World",
    "Should normalize whitespace"
  );

  // Max length
  assert.equal(
    cleanupDescriptionText("1234567890", 5),
    "12345",
    "Should trim to maxLength"
  );

  console.log("cleanupDescriptionText tests passed!");
}

function testExtractDescriptionCandidatesFromJsonLd() {
  console.log("Testing extractDescriptionCandidatesFromJsonLd...");

  assert.deepEqual(extractDescriptionCandidatesFromJsonLd(null), []);
  assert.deepEqual(extractDescriptionCandidatesFromJsonLd("string"), []);

  assert.deepEqual(
    extractDescriptionCandidatesFromJsonLd({ description: "Test desc" }),
    [{ text: "Test desc", source: "json_ld", selector: undefined }]
  );

  assert.deepEqual(
    extractDescriptionCandidatesFromJsonLd({
      "@graph": [
        { description: "Desc 1" },
        { description: ["Desc 2", "Desc 3"] }
      ]
    }),
    [
      { text: "Desc 1", source: "json_ld", selector: undefined },
      { text: "Desc 2", source: "json_ld", selector: undefined },
      { text: "Desc 3", source: "json_ld", selector: undefined }
    ]
  );

  // Nested object
  assert.deepEqual(
    extractDescriptionCandidatesFromJsonLd({
      someKey: { description: "Nested desc" }
    }),
    [{ text: "Nested desc", source: "json_ld", selector: undefined }]
  );

  console.log("extractDescriptionCandidatesFromJsonLd tests passed!");
}

function testExtractDescriptionCandidatesFromOpenGraph() {
  console.log("Testing extractDescriptionCandidatesFromOpenGraph...");

  const html = `
    <head>
      <meta property="og:description" content="OG desc 1">
      <meta name="og:description" content="OG desc 2">
      <meta property="other" content="Not this">
    </head>
  `;

  assert.deepEqual(
    extractDescriptionCandidatesFromOpenGraph(html),
    [
      { text: "OG desc 1", source: "open_graph", selector: undefined },
      { text: "OG desc 2", source: "open_graph", selector: undefined }
    ]
  );

  console.log("extractDescriptionCandidatesFromOpenGraph tests passed!");
}

function testExtractDescriptionCandidatesFromShopifyProductJson() {
  console.log("Testing extractDescriptionCandidatesFromShopifyProductJson...");

  assert.deepEqual(
    extractDescriptionCandidatesFromShopifyProductJson({
      product: {
        description: "Shopify desc",
        body_html: "<p>Shopify body</p>"
      }
    }),
    [
      { text: "Shopify desc", source: "shopify_product_json", selector: undefined },
      { text: "Shopify body", source: "shopify_product_json", selector: undefined }
    ]
  );

  assert.deepEqual(
    extractDescriptionCandidatesFromShopifyProductJson({
      description: "Root desc",
      body_html: "Root body"
    }),
    [
      { text: "Root desc", source: "shopify_product_json", selector: undefined },
      { text: "Root body", source: "shopify_product_json", selector: undefined }
    ]
  );

  console.log("extractDescriptionCandidatesFromShopifyProductJson tests passed!");
}

function testExtractDescriptionCandidatesFromDomSelectors() {
  console.log("Testing extractDescriptionCandidatesFromDomSelectors...");

  const html = `
    <html>
      <head>
        <meta property="og:description" content="OG DOM desc">
      </head>
      <body>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
        <div id="content">
          <article>Div content</article>
        </div>
      </body>
    </html>
  `;

  assert.deepEqual(
    extractDescriptionCandidatesFromDomSelectors(html, ["p"]),
    [
      { text: "Paragraph 1", source: "dom_selector", selector: "p" },
      { text: "Paragraph 2", source: "dom_selector", selector: "p" }
    ]
  );

  assert.deepEqual(
    extractDescriptionCandidatesFromDomSelectors(html, ["og:description"]),
    [
      { text: "OG DOM desc", source: "dom_selector", selector: "og:description" }
    ]
  );

  assert.deepEqual(
    extractDescriptionCandidatesFromDomSelectors(html, ["#content article"]),
    [
      { text: "Div content", source: "dom_selector", selector: "#content article" }
    ]
  );

  assert.deepEqual(
    extractDescriptionCandidatesFromDomSelectors(html, ["#content article[0]"]),
    [
      { text: "Div content", source: "dom_selector", selector: "#content article[0]" }
    ]
  );

  // Deduplication across multiple selectors
  const htmlDup = `<p>Same</p><div>Same</div>`;
  assert.deepEqual(
    extractDescriptionCandidatesFromDomSelectors(htmlDup, ["p", "div"]),
    [
      { text: "Same", source: "dom_selector", selector: "p" } // The second one is ignored due to dedup
    ]
  );

  console.log("extractDescriptionCandidatesFromDomSelectors tests passed!");
}

testCleanupDescriptionText();
testExtractDescriptionCandidatesFromJsonLd();
testExtractDescriptionCandidatesFromOpenGraph();
testExtractDescriptionCandidatesFromShopifyProductJson();
testExtractDescriptionCandidatesFromDomSelectors();

testDetectClaimRiskFlags();
