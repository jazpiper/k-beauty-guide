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
  extractDescriptionCandidatesFromDomSelectors,
  detectClaimRiskFlags,
} = require("../core/textExtractors.ts");

function testCleanupDescriptionText() {
  console.log("Testing cleanupDescriptionText...");

  assert.equal(cleanupDescriptionText(null), "");
  assert.equal(cleanupDescriptionText(undefined), "");
  assert.equal(cleanupDescriptionText(123), "");
  assert.equal(cleanupDescriptionText({ key: "val" }), "");

  const htmlInput = `
    <script>var x = 10;</script>
    <style>body { color: red; }</style>
    <p>Hello &amp; <b>World</b>!&nbsp;This is &#39;test&#39; &quot;text&quot; &lt;tag&gt; &gt;</p>
  `;
  assert.equal(
    cleanupDescriptionText(htmlInput),
    `Hello & World ! This is 'test' "text" <tag> >`,
  );

  const longText = "A".repeat(100);
  assert.equal(cleanupDescriptionText(longText, 10), "A".repeat(10));
  assert.equal(cleanupDescriptionText(longText, 0), "");
  assert.equal(cleanupDescriptionText(longText, -5), "");

  console.log("All cleanupDescriptionText tests passed!");
}

function testExtractDescriptionCandidatesFromJsonLd() {
  console.log("Testing extractDescriptionCandidatesFromJsonLd...");

  const payload1 = {
    "@context": "https://schema.org/",
    "@type": "Product",
    description: "Hydrating facial moisturizer with hyaluronic acid.",
  };
  assert.deepEqual(extractDescriptionCandidatesFromJsonLd(payload1), [
    {
      text: "Hydrating facial moisturizer with hyaluronic acid.",
      source: "json_ld",
      selector: undefined,
    },
  ]);

  const payload2 = {
    "@graph": [
      {
        "@type": "Product",
        description: ["Line 1 description.", "Line 2 description."],
      },
      {
        nested: {
          description: "Nested description string.",
        },
      },
    ],
  };
  assert.deepEqual(extractDescriptionCandidatesFromJsonLd(payload2), [
    { text: "Line 1 description.", source: "json_ld", selector: undefined },
    { text: "Line 2 description.", source: "json_ld", selector: undefined },
    {
      text: "Nested description string.",
      source: "json_ld",
      selector: undefined,
    },
  ]);

  assert.deepEqual(extractDescriptionCandidatesFromJsonLd(null), []);
  assert.deepEqual(extractDescriptionCandidatesFromJsonLd("just string"), []);

  console.log("All extractDescriptionCandidatesFromJsonLd tests passed!");
}

function testExtractDescriptionCandidatesFromOpenGraph() {
  console.log("Testing extractDescriptionCandidatesFromOpenGraph...");

  const html = `
    <html>
      <head>
        <meta property="og:description" content="Best soothing cream for sensitive skin." />
        <meta name="og:description" content="Duplicate or secondary OG desc." />
      </head>
    </html>
  `;
  assert.deepEqual(extractDescriptionCandidatesFromOpenGraph(html), [
    {
      text: "Best soothing cream for sensitive skin.",
      source: "open_graph",
      selector: undefined,
    },
    {
      text: "Duplicate or secondary OG desc.",
      source: "open_graph",
      selector: undefined,
    },
  ]);

  assert.deepEqual(
    extractDescriptionCandidatesFromOpenGraph("<html></html>"),
    [],
  );

  console.log("All extractDescriptionCandidatesFromOpenGraph tests passed!");
}

function testExtractDescriptionCandidatesFromShopifyProductJson() {
  console.log("Testing extractDescriptionCandidatesFromShopifyProductJson...");

  const payload1 = {
    product: {
      description: "Nourishing serum.",
      body_html: "<p>Nourishing serum.</p><p>Contains vitamin C.</p>",
    },
  };
  assert.deepEqual(
    extractDescriptionCandidatesFromShopifyProductJson(payload1),
    [
      {
        text: "Nourishing serum.",
        source: "shopify_product_json",
        selector: undefined,
      },
      {
        text: "Nourishing serum. Contains vitamin C.",
        source: "shopify_product_json",
        selector: undefined,
      },
    ],
  );

  const payload2 = {
    description: ["Root description array point 1."],
  };
  assert.deepEqual(
    extractDescriptionCandidatesFromShopifyProductJson(payload2),
    [
      {
        text: "Root description array point 1.",
        source: "shopify_product_json",
        selector: undefined,
      },
    ],
  );

  assert.deepEqual(
    extractDescriptionCandidatesFromShopifyProductJson(null),
    [],
  );

  console.log(
    "All extractDescriptionCandidatesFromShopifyProductJson tests passed!",
  );
}

function testExtractDescriptionCandidatesFromDomSelectors() {
  console.log("Testing extractDescriptionCandidatesFromDomSelectors...");

  const html = `
    <html>
      <head>
        <meta property="og:description" content="OG description here" />
      </head>
      <body>
        <div id="desc-container">
          <p>Paragraph 1 inside container</p>
          <p>Paragraph 2 inside container</p>
        </div>
        <p>Generic paragraph</p>
      </body>
    </html>
  `;

  const defaultResult = extractDescriptionCandidatesFromDomSelectors(html);
  assert.deepEqual(defaultResult, [
    {
      text: "OG description here",
      source: "dom_selector",
      selector: 'meta[property="og:description"]',
    },
    {
      text: "Paragraph 1 inside container",
      source: "dom_selector",
      selector: "p",
    },
    {
      text: "Paragraph 2 inside container",
      source: "dom_selector",
      selector: "p",
    },
    {
      text: "Generic paragraph",
      source: "dom_selector",
      selector: "p",
    },
  ]);

  const customSelectorResult = extractDescriptionCandidatesFromDomSelectors(
    html,
    ["#desc-container p[1]"],
  );
  assert.deepEqual(customSelectorResult, [
    {
      text: "Paragraph 2 inside container",
      source: "dom_selector",
      selector: "#desc-container p[1]",
    },
  ]);

  console.log("All extractDescriptionCandidatesFromDomSelectors tests passed!");
}

function testDetectClaimRiskFlags() {
  console.log("Testing detectClaimRiskFlags...");

  const cases = [
    {
      input: "This product cures eczema.",
      expected: ["medical_treatment", "disease_reference"],
    },
    { input: "Contains FDA approved drugs.", expected: ["regulatory_drug"] },
    { input: "SPF 50 and PA++++ protection.", expected: ["spf_pa_claim"] },
    {
      input:
        "Safe for pregnancy, hypoallergenic, non-comedogenic, and dermatologist tested.",
      expected: [
        "pregnancy_safe_claim",
        "hypoallergenic_claim",
        "non_comedogenic_claim",
        "dermatologist_tested_claim",
      ],
    },
    { input: "아토피 완치.", expected: ["korean_treatment"] },
    { input: "Just a normal moisturizer.", expected: [] },
    { input: null, expected: [] },
    { input: undefined, expected: [] },
    { input: 123, expected: [] },
  ];

  for (const c of cases) {
    const result = detectClaimRiskFlags(c.input);
    assert.deepEqual(
      result.sort(),
      c.expected.sort(),
      `Failed for input: ${c.input}`,
    );
  }

  console.log("All detectClaimRiskFlags tests passed!");
}

testCleanupDescriptionText();
testExtractDescriptionCandidatesFromJsonLd();
testExtractDescriptionCandidatesFromOpenGraph();
testExtractDescriptionCandidatesFromShopifyProductJson();
testExtractDescriptionCandidatesFromDomSelectors();
testDetectClaimRiskFlags();
