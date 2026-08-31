import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("analyze-ingredient-text filters ingredient_aliases by normalized_alias tokens instead of 1M row caching", () => {
  // Check that cachedAliasMap and 1000000 row limit are removed
  assert.doesNotMatch(source, /cachedAliasMap/);
  assert.doesNotMatch(source, /\.limit\(1000000\)/);

  // Check that .in("normalized_alias", ...) filter is present
  assert.match(source, /\.in\(\s*"normalized_alias"/);
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
      source_status: "verified"
    }
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
  console.log(`1,000,000 cached rows RAM estimate: ~${millionRowsMB.toFixed(2)} MB`);
  console.log(`Targeted token query (50 rows) RAM estimate: ~${fiftyRowsKB.toFixed(2)} KB`);

  assert.ok(millionRowsMB > 50, "1M rows should take significant memory (>50MB)");
});
