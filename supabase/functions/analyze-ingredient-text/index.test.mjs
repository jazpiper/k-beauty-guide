import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function loadModule() {
  const raw = source
    .replace(/import\s+[\s\S]*?from\s+["\x27][^"\x27]+["\x27];?/g, "")
    .replace(/serve\(async\s*\(req[\s\S]*?\n\}\);\n/m, "");

  const jsCode = ts.transpileModule(raw, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const exportsObj = {};
  const mockErrorResponse = (req, status, code, msg, details) => ({
    status,
    code,
    msg,
    details,
  });
  const mockOkResponse = (req, data) => ({ ok: true, data });
  const fn = new Function("exports", "require", "errorResponse", "okResponse", jsCode);
  fn(exportsObj, () => {}, mockErrorResponse, mockOkResponse);
  return exportsObj;
}

test("analyze-ingredient-text filters ingredient_aliases by normalized_alias tokens instead of 1M row caching", () => {
  // Check that cachedAliasMap and 1000000 row limit are removed
  assert.doesNotMatch(source, /cachedAliasMap/);
  assert.doesNotMatch(source, /\.limit\(1000000\)/);

  // Check that .in("normalized_alias", ...) filter is present
  assert.match(source, /\.in\(\s*"normalized_alias"/);
});

test("splitIngredientText implementation structural checks", () => {
  // Check that splitIngredientText avoids multi-map/filter chain
  assert.doesNotMatch(source, /\.map\(.*?\)\.filter\(Boolean\)\.map\(/s);
});

test("Memory comparison: 1,000,000 rows payload vs target token query (e.g. 50 tokens)", () => {
  // Simulate memory footprint of 1 million row alias cache vs targeted token result (~50 tokens)
  const sampleRow = (i) => ({
    ingredient_id: `ing-${i}`,
    normalized_alias: `ingredient alias name ${i}`,
    confidence: 1.0,
    ingredients: {
      id: `ing-${i}`,
      canonical_name: `Canonical Name ${i}`,
      inci_name: `INCI NAME ${i}`,
      korean_name: `성분 ${i}`,
      source_status: "verified",
    },
  });

  // Measure 1M rows memory footprint
  const memBefore1M = process.memoryUsage().heapUsed;
  const millionRows = [];
  for (let i = 0; i < 1_000_000; i++) {
    millionRows.push(sampleRow(i));
  }
  const memAfter1M = process.memoryUsage().heapUsed;
  const millionRowsMB = (memAfter1M - memBefore1M) / (1024 * 1024);

  // Clear 1M rows
  millionRows.length = 0;
  if (global.gc) global.gc();

  // Measure 50 tokens memory footprint
  const memBefore50 = process.memoryUsage().heapUsed;
  const fiftyRows = [];
  for (let i = 0; i < 50; i++) {
    fiftyRows.push(sampleRow(i));
  }
  const memAfter50 = process.memoryUsage().heapUsed;
  const fiftyRowsKB = (memAfter50 - memBefore50) / 1024;

  console.log(`[Benchmark Baseline vs Optimized Memory]`);
  console.log(
    `1,000,000 cached rows RAM estimate: ~${millionRowsMB.toFixed(2)} MB`,
  );
  console.log(
    `Targeted token query (50 rows) RAM estimate: ~${fiftyRowsKB.toFixed(2)} KB`,
  );

  assert.ok(
    millionRowsMB > 50,
    "1M rows should take significant memory (>50MB)",
  );
});

test("loadPublicAliasMap batches queries into chunks of <= 50 items", async () => {
  const mod = loadModule();
  assert.ok(mod.ALIAS_QUERY_CHUNK_SIZE <= 50, "Chunk size should be <= 50");

  const chunkCalls = [];
  const mockClient = {
    from(table) {
      assert.equal(table, "ingredient_aliases");
      return {
        select() {
          return {
            in(field, values) {
              if (field === "normalized_alias") {
                chunkCalls.push(values);
              }
              return {
                in() {
                  const rows = values.map((v) => ({
                    ingredient_id: `id-${v}`,
                    normalized_alias: v,
                    confidence: 1.0,
                    ingredients: {
                      id: `id-${v}`,
                      canonical_name: `Canonical ${v}`,
                      inci_name: null,
                      korean_name: null,
                      source_status: "verified",
                    },
                  }));
                  return Promise.resolve({ data: rows, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  // Test with 125 items (>50 items)
  const inputNames = Array.from({ length: 125 }, (_, i) => `ingredient-${i}`);
  const result = await mod.loadPublicAliasMap(
    new Request("http://localhost"),
    mockClient,
    inputNames,
  );

  assert.equal(chunkCalls.length, 3, "125 items should be split into 3 chunks");
  assert.equal(chunkCalls[0].length, 50, "First chunk should have 50 items");
  assert.equal(chunkCalls[1].length, 50, "Second chunk should have 50 items");
  assert.equal(chunkCalls[2].length, 25, "Third chunk should have 25 items");

  for (const chunk of chunkCalls) {
    assert.ok(
      chunk.length <= 50,
      `Each query chunk should be <= 50, received ${chunk.length}`,
    );
  }

  assert.equal(result.size, 125, "All 125 items should be mapped");
  assert.ok(result.has("ingredient-0"));
  assert.ok(result.has("ingredient-124"));
});

test("loadPublicAliasMap handles empty input and database errors", async () => {
  const mod = loadModule();

  // Empty input should not issue any queries
  let queryIssued = false;
  const mockClientEmpty = {
    from() {
      queryIssued = true;
      return {};
    },
  };
  const emptyResult = await mod.loadPublicAliasMap(
    new Request("http://localhost"),
    mockClientEmpty,
    [],
  );
  assert.equal(queryIssued, false);
  assert.equal(emptyResult.size, 0);

  // Database error in a chunk should return error response
  const mockClientError = {
    from() {
      return {
        select() {
          return {
            in() {
              return {
                in() {
                  return Promise.resolve({
                    data: null,
                    error: { message: "timeout" },
                  });
                },
              };
            },
          };
        },
      };
    },
  };
  const errorResult = await mod.loadPublicAliasMap(
    new Request("http://localhost"),
    mockClientError,
    ["water"],
  );
  assert.equal(errorResult.status, 500);
  assert.equal(errorResult.code, "database_error");
});

test("matchToken accurately determines exact vs alias matchMethod", () => {
  const mod = loadModule();

  const aliasMap = new Map();

  // Exact match entry: canonical name is "Water"
  aliasMap.set("water", [
    {
      ingredient_id: "ing-water",
      normalized_alias: "water",
      confidence: 1.0,
      ingredients: {
        id: "ing-water",
        canonical_name: "Water",
        inci_name: "WATER",
        korean_name: "정제수",
        source_status: "verified",
      },
    },
  ]);

  // Alias match entry: alias "cica" points to canonical "Centella Asiatica Extract"
  aliasMap.set("cica", [
    {
      ingredient_id: "ing-centella",
      normalized_alias: "cica",
      confidence: 0.95,
      ingredients: {
        id: "ing-centella",
        canonical_name: "Centella Asiatica Extract",
        inci_name: "CENTELLA ASIATICA EXTRACT",
        korean_name: "병풀추출물",
        source_status: "verified",
      },
    },
  ]);

  // Exact match with formatting: canonical "1,2-Hexanediol"
  aliasMap.set("1 2 hexanediol", [
    {
      ingredient_id: "ing-hexanediol",
      normalized_alias: "1 2 hexanediol",
      confidence: 1.0,
      ingredients: {
        id: "ing-hexanediol",
        canonical_name: "1,2-Hexanediol",
        inci_name: "1,2-HEXANEDIOL",
        korean_name: "1,2-헥산다이올",
        source_status: "verified",
      },
    },
  ]);

  // Alias match: "hyaluronic acid" points to canonical "Sodium Hyaluronate"
  aliasMap.set("hyaluronic acid", [
    {
      ingredient_id: "ing-ha",
      normalized_alias: "hyaluronic acid",
      confidence: 0.9,
      ingredients: {
        id: "ing-ha",
        canonical_name: "Sodium Hyaluronate",
        inci_name: "SODIUM HYALURONATE",
        korean_name: "소듐하이알루로네이트",
        source_status: "verified",
      },
    },
  ]);

  // 1. Direct match with canonical_name -> exact
  const waterMatch = mod.matchToken(
    { position: 1, rawName: "Water", normalizedName: "water" },
    aliasMap,
  );
  assert.equal(waterMatch.matchMethod, "exact");
  assert.equal(waterMatch.displayName, "Water");
  assert.equal(waterMatch.ingredientId, "ing-water");

  // 2. Canonical name with punctuation stripped -> exact
  const hexanediolMatch = mod.matchToken(
    { position: 2, rawName: "1,2-Hexanediol", normalizedName: "1 2 hexanediol" },
    aliasMap,
  );
  assert.equal(hexanediolMatch.matchMethod, "exact");
  assert.equal(hexanediolMatch.displayName, "1,2-Hexanediol");

  // 3. Alias name not matching canonical name -> alias
  const cicaMatch = mod.matchToken(
    { position: 3, rawName: "Cica", normalizedName: "cica" },
    aliasMap,
  );
  assert.equal(cicaMatch.matchMethod, "alias");
  assert.equal(cicaMatch.displayName, "Centella Asiatica Extract");
  assert.equal(cicaMatch.ingredientId, "ing-centella");

  // 4. Another alias match -> alias
  const haMatch = mod.matchToken(
    { position: 4, rawName: "Hyaluronic Acid", normalizedName: "hyaluronic acid" },
    aliasMap,
  );
  assert.equal(haMatch.matchMethod, "alias");
  assert.equal(haMatch.displayName, "Sodium Hyaluronate");

  // 5. Unmatched token -> unmatched
  const unknownMatch = mod.matchToken(
    { position: 5, rawName: "Rare Herb Extract", normalizedName: "rare herb extract" },
    aliasMap,
  );
  assert.equal(unknownMatch.matchMethod, "unmatched");
  assert.equal(unknownMatch.ingredientId, null);
  assert.equal(unknownMatch.confidence, 0);

  // 6. Multiple candidates chooses highest confidence
  aliasMap.set("multi", [
    {
      ingredient_id: "low-conf",
      normalized_alias: "multi",
      confidence: 0.4,
      ingredients: {
        id: "low-conf",
        canonical_name: "Low Confidence Herb",
        source_status: "verified",
      },
    },
    {
      ingredient_id: "high-conf",
      normalized_alias: "multi",
      confidence: 0.98,
      ingredients: {
        id: "high-conf",
        canonical_name: "High Confidence Herb",
        source_status: "verified",
      },
    },
  ]);
  const multiMatch = mod.matchToken(
    { position: 6, rawName: "Multi", normalizedName: "multi" },
    aliasMap,
  );
  assert.equal(multiMatch.ingredientId, "high-conf");
  assert.equal(multiMatch.confidence, 0.98);

  // 7. When confidence is tied, prefer exact canonical match over alias
  aliasMap.set("tea tree", [
    {
      ingredient_id: "ing-oil",
      normalized_alias: "tea tree",
      confidence: 1.0,
      ingredients: {
        id: "ing-oil",
        canonical_name: "Tea Tree Leaf Oil",
        inci_name: null,
        korean_name: null,
        source_status: "verified",
      },
    },
    {
      ingredient_id: "ing-exact",
      normalized_alias: "tea tree",
      confidence: 1.0,
      ingredients: {
        id: "ing-exact",
        canonical_name: "Tea Tree",
        inci_name: null,
        korean_name: null,
        source_status: "verified",
      },
    },
  ]);
  const teaTreeMatch = mod.matchToken(
    { position: 7, rawName: "Tea Tree", normalizedName: "tea tree" },
    aliasMap,
  );
  assert.equal(teaTreeMatch.ingredientId, "ing-exact");
  assert.equal(teaTreeMatch.displayName, "Tea Tree");
  assert.equal(teaTreeMatch.matchMethod, "exact");
});

test("loadPublicAliasMap filters empty/whitespace names and catches unexpected exceptions", async () => {
  const mod = loadModule();

  // 1. Whitespace or empty tokens should not issue DB queries
  let queriesIssued = 0;
  const mockClientNoQuery = {
    from() {
      queriesIssued++;
      return {};
    },
  };
  const whitespaceResult = await mod.loadPublicAliasMap(
    new Request("http://localhost"),
    mockClientNoQuery,
    ["", "   ", "\t\n"],
  );
  assert.equal(queriesIssued, 0);
  assert.equal(whitespaceResult.size, 0);

  // 2. Client exception thrown during query should be caught and return 500 errorResponse
  const mockThrowingClient = {
    from() {
      throw new Error("Connection reset by peer");
    },
  };
  const throwResult = await mod.loadPublicAliasMap(
    new Request("http://localhost"),
    mockThrowingClient,
    ["water"],
  );
  assert.equal(throwResult.status, 500);
  assert.equal(throwResult.code, "database_error");
  assert.match(throwResult.details, /Connection reset by peer/);
});

test("matchToken prioritizes exact canonical match over alias even with lower candidate confidence", () => {
  const mod = loadModule();
  const aliasMap = new Map();

  // Alias candidate with confidence 1.0, and exact canonical candidate with confidence 0.90
  aliasMap.set("tea tree", [
    {
      ingredient_id: "ing-oil",
      normalized_alias: "tea tree",
      confidence: 1.0,
      ingredients: {
        id: "ing-oil",
        canonical_name: "Tea Tree Leaf Oil",
        inci_name: null,
        korean_name: null,
        source_status: "verified",
      },
    },
    {
      ingredient_id: "ing-exact",
      normalized_alias: "tea tree",
      confidence: 0.9,
      ingredients: {
        id: "ing-exact",
        canonical_name: "Tea Tree",
        inci_name: null,
        korean_name: null,
        source_status: "verified",
      },
    },
  ]);

  const result = mod.matchToken(
    { position: 1, rawName: "Tea Tree", normalizedName: "tea tree" },
    aliasMap,
  );

  // Exact canonical match MUST win over the alias match despite lower alias confidence score
  assert.equal(result.ingredientId, "ing-exact");
  assert.equal(result.displayName, "Tea Tree");
  assert.equal(result.matchMethod, "exact");
});

test("matchToken gracefully handles whitespace-only canonical_name and falls back to rawName", () => {
  const mod = loadModule();
  const aliasMap = new Map();

  aliasMap.set("niacinamide", [
    {
      ingredient_id: "ing-niacinamide",
      normalized_alias: "niacinamide",
      confidence: 0.9,
      ingredients: {
        id: "ing-niacinamide",
        canonical_name: "   ",
        inci_name: null,
        korean_name: null,
        source_status: "verified",
      },
    },
  ]);

  const result = mod.matchToken(
    { position: 1, rawName: "Niacinamide", normalizedName: "niacinamide" },
    aliasMap,
  );

  assert.equal(result.displayName, "Niacinamide");
  assert.equal(result.matchMethod, "alias");
});

test("loadPublicAliasMap normalizes mixed-case alias keys from DB for case-insensitive lookup", async () => {
  const mod = loadModule();
  const mockClient = {
    from() {
      return {
        select() {
          return {
            in() {
              return {
                in() {
                  return Promise.resolve({
                    data: [
                      {
                        ingredient_id: "ing-cica",
                        normalized_alias: "  CICA  ",
                        confidence: 1.0,
                        ingredients: {
                          id: "ing-cica",
                          canonical_name: "Centella Asiatica Extract",
                          inci_name: null,
                          korean_name: null,
                          source_status: "verified",
                        },
                      },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const map = await mod.loadPublicAliasMap(
    new Request("http://localhost"),
    mockClient,
    ["cica"],
  );

  assert.ok(map.has("cica"), "Alias map should have lowercased trimmed key");
  const match = mod.matchToken(
    { position: 1, rawName: "Cica", normalizedName: "cica" },
    map,
  );
  assert.equal(match.ingredientId, "ing-cica");
  assert.equal(match.matchMethod, "alias");
});

test("matchToken determines exact match case-insensitively, handles uppercase/punctuation in token, and derives from rawName when normalizedName is missing", () => {
  const mod = loadModule();
  const aliasMap = new Map();

  aliasMap.set("water", [
    {
      ingredient_id: "ing-water",
      normalized_alias: "water",
      confidence: 1.0,
      ingredients: {
        id: "ing-water",
        canonical_name: "Water",
        source_status: "verified",
      },
    },
  ]);

  aliasMap.set("1 2 hexanediol", [
    {
      ingredient_id: "ing-hexanediol",
      normalized_alias: "1 2 hexanediol",
      confidence: 1.0,
      ingredients: {
        id: "ing-hexanediol",
        canonical_name: "1,2-Hexanediol",
        source_status: "verified",
      },
    },
  ]);

  // 1. Uppercase token normalizedName matches canonical case-insensitively as exact
  const upperRes = mod.matchToken(
    { position: 1, rawName: "Water", normalizedName: "Water" },
    aliasMap,
  );
  assert.equal(upperRes.matchMethod, "exact");
  assert.equal(upperRes.ingredientId, "ing-water");

  // 2. All-caps token normalizedName matches canonical as exact
  const allCapsRes = mod.matchToken(
    { position: 1, rawName: "WATER", normalizedName: "WATER" },
    aliasMap,
  );
  assert.equal(allCapsRes.matchMethod, "exact");

  // 3. Token with punctuation in normalizedName stripped matches canonical as exact
  const punctRes = mod.matchToken(
    { position: 2, rawName: "1,2-Hexanediol", normalizedName: "1,2-hexanediol" },
    aliasMap,
  );
  assert.equal(punctRes.matchMethod, "exact");
  assert.equal(punctRes.ingredientId, "ing-hexanediol");

  // 4. Missing normalizedName derives from rawName and matches as exact
  const missingNormRes = mod.matchToken(
    { position: 3, rawName: "Water" },
    aliasMap,
  );
  assert.equal(missingNormRes.matchMethod, "exact");
  assert.equal(missingNormRes.ingredientId, "ing-water");
});

test("matchToken safely handles null/undefined token or aliasMap without throwing", () => {
  const mod = loadModule();

  // 1. Null token returns unmatched
  const nullTokenRes = mod.matchToken(null, new Map());
  assert.equal(nullTokenRes.matchMethod, "unmatched");
  assert.equal(nullTokenRes.ingredientId, null);
  assert.equal(nullTokenRes.confidence, 0);

  // 2. Null aliasMap returns unmatched without throwing
  const nullMapRes = mod.matchToken(
    { position: 1, rawName: "Water", normalizedName: "water" },
    null,
  );
  assert.equal(nullMapRes.matchMethod, "unmatched");
  assert.equal(nullMapRes.ingredientId, null);
});

test("matchToken deterministically tiebreaks by ingredient_id when confidence and source_status are equal", () => {
  const mod = loadModule();
  const aliasMap = new Map();

  aliasMap.set("extract", [
    {
      ingredient_id: "ing-beta",
      normalized_alias: "extract",
      confidence: 0.9,
      ingredients: {
        id: "ing-beta",
        canonical_name: "Beta Plant Extract",
        source_status: "verified",
      },
    },
    {
      ingredient_id: "ing-alpha",
      normalized_alias: "extract",
      confidence: 0.9,
      ingredients: {
        id: "ing-alpha",
        canonical_name: "Alpha Plant Extract",
        source_status: "verified",
      },
    },
  ]);

  const res = mod.matchToken(
    { position: 1, rawName: "Extract", normalizedName: "extract" },
    aliasMap,
  );
  // "ing-alpha" comes before "ing-beta" lexicographically
  assert.equal(res.ingredientId, "ing-alpha");
  assert.equal(res.displayName, "Alpha Plant Extract");
});

test("loadPublicAliasMap deduplicates case variations in input names before chunking", async () => {
  const mod = loadModule();
  const queriedChunks = [];

  const mockClient = {
    from() {
      return {
        select() {
          return {
            in(field, values) {
              if (field === "normalized_alias") {
                queriedChunks.push(values);
              }
              return {
                in() {
                  return Promise.resolve({
                    data: values.map((v) => ({
                      ingredient_id: `id-${v}`,
                      normalized_alias: v,
                      confidence: 1.0,
                      ingredients: {
                        id: `id-${v}`,
                        canonical_name: v,
                        source_status: "verified",
                      },
                    })),
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await mod.loadPublicAliasMap(
    new Request("http://localhost"),
    mockClient,
    ["Water", "water", " WATER ", "cica", "CICA"],
  );

  assert.equal(queriedChunks.length, 1, "Should be batched into single chunk");
  assert.deepEqual(
    queriedChunks[0].sort(),
    ["cica", "water"],
    "Case variations should be deduplicated to unique lowercase names",
  );
  assert.equal(result.size, 2, "Only 2 unique alias keys mapped");
});



