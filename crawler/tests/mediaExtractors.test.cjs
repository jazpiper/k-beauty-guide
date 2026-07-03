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
  extractImageCandidatesFromJsonLd,
  extractImageCandidatesFromOpenGraph,
  extractImageCandidatesFromShopifyProductJson,
  extractImageCandidatesFromDomSelectors,
} = require("../core/mediaExtractors.ts");

function testExtractImageCandidatesFromJsonLd() {
  console.log("Testing extractImageCandidatesFromJsonLd...");
  const payload1 = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: "Cool Cream",
    image: "https://example.com/image1.jpg",
  };
  const result1 = extractImageCandidatesFromJsonLd(payload1);
  assert.deepEqual(result1, [{ url: "https://example.com/image1.jpg", source: "json_ld", selector: undefined }]);

  const payload2 = {
    "@graph": [
      {
        "@type": "Product",
        image: ["https://example.com/imgA.jpg", "https://example.com/imgB.png"],
      },
      {
        "@type": "Organization",
        image: { url: "https://example.com/logo.webp" },
      }
    ]
  };
  const result2 = extractImageCandidatesFromJsonLd(payload2);
  assert.deepEqual(result2, [
    { url: "https://example.com/imgA.jpg", source: "json_ld", selector: undefined },
    { url: "https://example.com/imgB.png", source: "json_ld", selector: undefined },
    { url: "https://example.com/logo.webp", source: "json_ld", selector: undefined }
  ]);

  const payload3 = "just a string";
  assert.deepEqual(extractImageCandidatesFromJsonLd(payload3), []);

  const payload4 = { image: "javascript:alert(1)" }; // unsafe url
  assert.deepEqual(extractImageCandidatesFromJsonLd(payload4), []);
}

function testExtractImageCandidatesFromOpenGraph() {
  console.log("Testing extractImageCandidatesFromOpenGraph...");
  const html1 = `
    <html>
      <head>
        <meta property="og:image" content="https://example.com/og-image.jpg" />
        <meta name="og:image:url" content="https://example.com/og-image2.png">
        <meta property="og:title" content="Some Title" />
      </head>
      <body></body>
    </html>
  `;
  const result1 = extractImageCandidatesFromOpenGraph(html1);
  assert.deepEqual(result1, [
    { url: "https://example.com/og-image.jpg", source: "open_graph", selector: undefined },
    { url: "https://example.com/og-image2.png", source: "open_graph", selector: undefined }
  ]);

  const html2 = `<html><head></head><body></body></html>`;
  assert.deepEqual(extractImageCandidatesFromOpenGraph(html2), []);
}

function testExtractImageCandidatesFromShopifyProductJson() {
  console.log("Testing extractImageCandidatesFromShopifyProductJson...");
  const payload1 = {
    product: {
      image: "https://example.com/shopify1.jpg",
      featured_image: "https://example.com/shopify2.png",
      images: ["https://example.com/shopify3.webp", { url: "https://example.com/shopify4.gif" }]
    }
  };
  const result1 = extractImageCandidatesFromShopifyProductJson(payload1);
  assert.deepEqual(result1, [
    { url: "https://example.com/shopify1.jpg", source: "shopify_product_json", selector: undefined },
    { url: "https://example.com/shopify2.png", source: "shopify_product_json", selector: undefined },
    { url: "https://example.com/shopify3.webp", source: "shopify_product_json", selector: undefined },
    { url: "https://example.com/shopify4.gif", source: "shopify_product_json", selector: undefined }
  ]);

  const payload2 = {
    image: "https://example.com/shopify5.jpg"
  };
  const result2 = extractImageCandidatesFromShopifyProductJson(payload2);
  assert.deepEqual(result2, [
    { url: "https://example.com/shopify5.jpg", source: "shopify_product_json", selector: undefined }
  ]);

  assert.deepEqual(extractImageCandidatesFromShopifyProductJson(null), []);
}

function testExtractImageCandidatesFromDomSelectors() {
  console.log("Testing extractImageCandidatesFromDomSelectors...");
  const html1 = `
    <html>
      <body>
        <div id="product-gallery">
          <img src="https://example.com/dom1.jpg" />
          <span><img src="https://example.com/dom2.png"></span>
        </div>
        <section aria-label="Product Images">
          <img src="https://example.com/dom3.webp" />
          <img src="https://example.com/dom4.jpg" />
        </section>
        <img src="https://example.com/dom5.jpg" />
      </body>
    </html>
  `;

  const result1 = extractImageCandidatesFromDomSelectors(html1, ["#product-gallery img"]);
  assert.deepEqual(result1, [
    { url: "https://example.com/dom1.jpg", source: "dom_selector", selector: "#product-gallery img" },
    { url: "https://example.com/dom2.png", source: "dom_selector", selector: "#product-gallery img" }
  ]);

  const result2 = extractImageCandidatesFromDomSelectors(html1, ["section[aria-label='Product Images'] img"]);
  assert.deepEqual(result2, [
    { url: "https://example.com/dom3.webp", source: "dom_selector", selector: "section[aria-label='Product Images'] img" },
    { url: "https://example.com/dom4.jpg", source: "dom_selector", selector: "section[aria-label='Product Images'] img" }
  ]);

  const result3 = extractImageCandidatesFromDomSelectors(html1, ["section[aria-label='Product Images'] img[1]"]);
  assert.deepEqual(result3, [
    { url: "https://example.com/dom4.jpg", source: "dom_selector", selector: "section[aria-label='Product Images'] img[1]" }
  ]);

  const result4 = extractImageCandidatesFromDomSelectors(html1, ["img"]);
  assert.deepEqual(result4.length, 5); // 5 total images in HTML
  assert.equal(result4[4].url, "https://example.com/dom5.jpg");

  // Invalid image URLs filtering
  const html2 = `<img src="javascript:alert(1)">`;
  assert.deepEqual(extractImageCandidatesFromDomSelectors(html2, ["img"]), []);
}

testExtractImageCandidatesFromJsonLd();
testExtractImageCandidatesFromOpenGraph();
testExtractImageCandidatesFromShopifyProductJson();
testExtractImageCandidatesFromDomSelectors();

console.log("All mediaExtractors tests passed!");
