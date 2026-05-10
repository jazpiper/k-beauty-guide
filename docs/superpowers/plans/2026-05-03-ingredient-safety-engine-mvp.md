# Ingredient Safety Engine MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a consistent MVP ingredient parser, matcher, and rule-based warning flow across frontend fallback and the Supabase `analyze-ingredient-text` Edge Function.

**Architecture:** Keep text parsing and local fallback logic in focused frontend modules under `src/safety/`. Upgrade the Edge Function to query Supabase ingredient aliases and active safety rules, while keeping public requests free of user allergy/profile fields. Verify both paths with the same `Water, Fragrance, Hyaluronic Acid` smoke input so local fallback and Supabase runtime stay aligned.

**Tech Stack:** React 18 / CRA Jest, Supabase JS v2, Supabase Edge Functions on Deno, Postgres RLS/views/RPCs, OrbStack-backed Supabase local stack.

---

## Scope Check

This plan covers only the next core data-quality slice:

- Ingredient text splitting and normalization.
- Frontend local analyzer fallback.
- Supabase Edge Function analyzer backed by `ingredient_aliases` and `ingredient_safety_rules`.
- Smoke scripts and docs updates for the analyzer behavior.

This plan intentionally does not implement Home search, Product Detail SEO, Admin Review Console, crawler dry runs, map data, or Vercel deployment. Those should each get their own plan after this slice passes.

## File Structure

Create:

- `src/safety/ingredientText.js`  
  Owns deterministic parsing helpers: `splitIngredientText`, `normalizeIngredientName`.

- `src/safety/ingredientText.test.js`  
  Unit tests for parser behavior and normalization.

- `src/safety/localIngredientAnalyzer.js`  
  Owns frontend fallback matching and flag generation from `fallbackIngredients`.

- `src/safety/localIngredientAnalyzer.test.js`  
  Unit tests for alias matching, warning generation, and unmatched handling.

- `scripts/smoke-supabase-analyzer.mjs`  
  Runs an HTTP smoke test against local Supabase Edge Function output.

Modify:

- `src/api/ingredientsApi.js`  
  Delegate fallback analysis to `src/safety/localIngredientAnalyzer.js`.

- `supabase/functions/analyze-ingredient-text/index.ts`  
  Replace parser-only shell with DB-backed alias matching and active rule flag generation.

- `package.json`  
  Add a script for the analyzer smoke test.

- `docs/pages/03_ingredients.md`  
  Update current analyzer behavior.

- `docs/api/01-api-contract.md`  
  Update analyzer implementation status and response contract.

- `docs/architecture/05-ingredient-safety-engine.md`  
  Record parser/matcher/rule-engine boundaries.

- `docs/ops/01-deployment-runbook.md`  
  Add the analyzer smoke command and expected output.

## Task 1: Frontend Ingredient Text Parser

**Files:**
- Create: `src/safety/ingredientText.js`
- Create: `src/safety/ingredientText.test.js`

- [ ] **Step 1: Write the failing parser tests**

Create `src/safety/ingredientText.test.js`:

```javascript
import { normalizeIngredientName, splitIngredientText } from "./ingredientText";

describe("ingredientText", () => {
  test("splits comma and semicolon separated ingredient text", () => {
    expect(splitIngredientText("Water, Fragrance; Sodium Hyaluronate")).toEqual([
      { position: 1, rawName: "Water", normalizedName: "water" },
      { position: 2, rawName: "Fragrance", normalizedName: "fragrance" },
      { position: 3, rawName: "Sodium Hyaluronate", normalizedName: "sodium hyaluronate" },
    ]);
  });

  test("drops empty tokens and trims whitespace", () => {
    expect(splitIngredientText("  Water, ,  Fragrance  , ")).toEqual([
      { position: 1, rawName: "Water", normalizedName: "water" },
      { position: 2, rawName: "Fragrance", normalizedName: "fragrance" },
    ]);
  });

  test("normalizes case, parenthetical notes, punctuation, and Korean text", () => {
    expect(normalizeIngredientName("  Sodium Hyaluronate (1%) ")).toBe("sodium hyaluronate");
    expect(normalizeIngredientName("Parfum/Fragrance")).toBe("parfum fragrance");
    expect(normalizeIngredientName("향료")).toBe("향료");
  });
});
```

- [ ] **Step 2: Run the parser tests to verify they fail**

Run:

```bash
CI=true npm test -- --watch=false src/safety/ingredientText.test.js
```

Expected:

```text
Cannot find module './ingredientText'
```

- [ ] **Step 3: Add the parser implementation**

Create `src/safety/ingredientText.js`:

```javascript
export function splitIngredientText(ingredientText) {
  return String(ingredientText || "")
    .split(/[,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((rawName, index) => ({
      position: index + 1,
      rawName,
      normalizedName: normalizeIngredientName(rawName),
    }))
    .filter((ingredient) => ingredient.normalizedName.length > 0);
}

export function normalizeIngredientName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

- [ ] **Step 4: Run the parser tests to verify they pass**

Run:

```bash
CI=true npm test -- --watch=false src/safety/ingredientText.test.js
```

Expected:

```text
PASS src/safety/ingredientText.test.js
```

- [ ] **Step 5: Commit the parser module**

```bash
git add src/safety/ingredientText.js src/safety/ingredientText.test.js
git commit -m "feat: add ingredient text parser"
```

## Task 2: Frontend Local Analyzer Fallback

**Files:**
- Create: `src/safety/localIngredientAnalyzer.js`
- Create: `src/safety/localIngredientAnalyzer.test.js`
- Modify: `src/api/ingredientsApi.js`

- [ ] **Step 1: Write the failing local analyzer tests**

Create `src/safety/localIngredientAnalyzer.test.js`:

```javascript
import { analyzeKnownIngredientsLocally } from "./localIngredientAnalyzer";

const knownIngredients = [
  {
    id: "hyaluronic-acid",
    name: "Hyaluronic Acid",
    korean: "히알루론산",
    aliases: ["Sodium Hyaluronate"],
    safety: "Safe",
    color: "#E3F2FD",
  },
  {
    id: "fragrance",
    name: "Fragrance",
    korean: "향료",
    aliases: ["Parfum", "Perfume"],
    safety: "Caution",
    color: "#FFF0F5",
  },
];

describe("localIngredientAnalyzer", () => {
  test("matches aliases and canonical names", () => {
    const result = analyzeKnownIngredientsLocally("Water, Parfum, Sodium Hyaluronate", knownIngredients);

    expect(result.source).toBe("static");
    expect(result.parsedIngredients).toEqual([
      expect.objectContaining({
        position: 1,
        rawName: "Water",
        ingredientId: null,
        displayName: "Water",
        matchMethod: "unmatched",
        confidence: 0,
        safety: "Review",
      }),
      expect.objectContaining({
        position: 2,
        rawName: "Parfum",
        ingredientId: "fragrance",
        displayName: "Fragrance",
        matchMethod: "local_match",
        confidence: 0.85,
        safety: "Caution",
      }),
      expect.objectContaining({
        position: 3,
        rawName: "Sodium Hyaluronate",
        ingredientId: "hyaluronic-acid",
        displayName: "Hyaluronic Acid",
        matchMethod: "local_match",
        confidence: 0.85,
        safety: "Safe",
      }),
    ]);
    expect(result.unmatchedCount).toBe(1);
  });

  test("generates caution flags for matched caution ingredients", () => {
    const result = analyzeKnownIngredientsLocally("Fragrance", knownIngredients);

    expect(result.flags).toEqual([
      {
        ingredientId: "fragrance",
        ingredientName: "Fragrance",
        severity: "caution",
        title: "Fragrance may need extra care",
        whyItMatters: "Fragrance may bother sensitive or allergy-prone skin.",
        recommendation: "Patch test first and avoid if this ingredient has bothered your skin before.",
        sourceLabel: "Static fallback",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the local analyzer tests to verify they fail**

Run:

```bash
CI=true npm test -- --watch=false src/safety/localIngredientAnalyzer.test.js
```

Expected:

```text
Cannot find module './localIngredientAnalyzer'
```

- [ ] **Step 3: Add the local analyzer implementation**

Create `src/safety/localIngredientAnalyzer.js`:

```javascript
import { normalizeIngredientName, splitIngredientText } from "./ingredientText";

const DISCLAIMER = "Ingredient information is educational and not a medical diagnosis.";

export function analyzeKnownIngredientsLocally(ingredientText, knownIngredients) {
  const parsedIngredients = splitIngredientText(ingredientText).map((token) => {
    const match = findLocalMatch(token.normalizedName, knownIngredients);

    if (!match) {
      return {
        position: token.position,
        rawName: token.rawName,
        ingredientId: null,
        displayName: token.rawName,
        matchMethod: "unmatched",
        confidence: 0,
        safety: "Review",
        color: "#FFF0F5",
      };
    }

    return {
      position: token.position,
      rawName: token.rawName,
      ingredientId: match.id,
      displayName: match.name,
      matchMethod: "local_match",
      confidence: 0.85,
      safety: match.safety,
      color: match.color,
    };
  });

  return {
    parsedIngredients,
    flags: buildLocalFlags(parsedIngredients),
    unmatchedCount: parsedIngredients.filter((ingredient) => !ingredient.ingredientId).length,
    disclaimer: DISCLAIMER,
    source: "static",
    error: null,
  };
}

function findLocalMatch(normalizedRawName, knownIngredients) {
  return knownIngredients.find((ingredient) => {
    const candidates = [ingredient.name, ingredient.korean, ...(ingredient.aliases ?? [])]
      .map(normalizeIngredientName)
      .filter(Boolean);

    return candidates.some((candidate) =>
      normalizedRawName === candidate ||
      normalizedRawName.includes(candidate) ||
      candidate.includes(normalizedRawName)
    );
  });
}

function buildLocalFlags(parsedIngredients) {
  return parsedIngredients
    .filter((ingredient) => ingredient.ingredientId && ingredient.safety === "Caution")
    .map((ingredient) => ({
      ingredientId: ingredient.ingredientId,
      ingredientName: ingredient.displayName,
      severity: "caution",
      title: `${ingredient.displayName} may need extra care`,
      whyItMatters: `${ingredient.displayName} may bother sensitive or allergy-prone skin.`,
      recommendation: "Patch test first and avoid if this ingredient has bothered your skin before.",
      sourceLabel: "Static fallback",
    }));
}
```

- [ ] **Step 4: Replace inline fallback logic in the Ingredients API**

Modify `src/api/ingredientsApi.js`:

```javascript
import { fallbackIngredients } from "../data/ingredients";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { analyzeKnownIngredientsLocally } from "../safety/localIngredientAnalyzer";
```

Then replace the current `return analyzeLocally(ingredientText, knownIngredients);` call with:

```javascript
return analyzeKnownIngredientsLocally(ingredientText, knownIngredients);
```

Remove the now-unused inline functions from `src/api/ingredientsApi.js`:

```javascript
function analyzeLocally(ingredientText, knownIngredients) {}
function findLocalMatch(rawName, knownIngredients) {}
function normalizeIngredientName(value) {}
```

Keep `mapIngredientRow` and `titleCase` unchanged.

- [ ] **Step 5: Run the local analyzer tests and targeted API import test**

Run:

```bash
CI=true npm test -- --watch=false src/safety/ingredientText.test.js src/safety/localIngredientAnalyzer.test.js
```

Expected:

```text
PASS src/safety/ingredientText.test.js
PASS src/safety/localIngredientAnalyzer.test.js
```

- [ ] **Step 6: Commit the local analyzer**

```bash
git add src/api/ingredientsApi.js src/safety/localIngredientAnalyzer.js src/safety/localIngredientAnalyzer.test.js
git commit -m "feat: add local ingredient safety analyzer"
```

## Task 3: Supabase Edge Function Analyzer

**Files:**
- Modify: `supabase/functions/analyze-ingredient-text/index.ts`

- [ ] **Step 1: Capture the current failing smoke expectation**

Run with the current parser-only function:

```bash
npx supabase functions serve analyze-ingredient-text --no-verify-jwt > /tmp/k-beauty-analyzer.log 2>&1 &
server_pid=$!
sleep 5
curl --max-time 10 -fsS http://127.0.0.1:54321/functions/v1/analyze-ingredient-text \
  -H "Content-Type: application/json" \
  -d '{"ingredientText":"Water, Fragrance, Hyaluronic Acid"}'
kill "$server_pid" 2>/dev/null || true
```

Expected current failure shape:

```json
{
  "ok": true,
  "data": {
    "unmatchedCount": 3,
    "flags": []
  }
}
```

The implementation is incomplete until `Fragrance` and `Hyaluronic Acid` are matched and `Fragrance` generates one active rule flag.

- [ ] **Step 2: Replace the Edge Function with DB-backed matching**

Replace `supabase/functions/analyze-ingredient-text/index.ts` with this complete file:

```typescript
import {
  errorResponse,
  okResponse,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const MAX_INGREDIENT_TEXT_LENGTH = 10_000;
const FORBIDDEN_PROFILE_FIELDS = [
  "allergyProfile",
  "allergies",
  "avoidIngredients",
  "sensitivityProfile",
  "skinProfile",
];
const DISCLAIMER = "Ingredient information is educational and not a medical diagnosis.";

type AliasRow = {
  ingredient_id: string;
  normalized_alias: string;
  language: string;
  confidence: number;
  ingredients: {
    id: string;
    canonical_name: string;
    inci_name: string | null;
    korean_name: string | null;
    source_status: string;
  } | null;
};

type RuleRow = {
  id: string;
  ingredient_id: string;
  severity: "info" | "caution" | "avoid_if_sensitive" | "restricted";
  title: string;
  why_it_matters: string;
  who_should_care: string;
  recommendation: string;
  version: number;
};

type ParsedIngredient = {
  position: number;
  rawName: string;
  ingredientId: string | null;
  displayName: string;
  inciName?: string | null;
  koreanName?: string | null;
  matchMethod: "exact" | "alias" | "unmatched";
  confidence: number;
};

Deno.serve(async (req: Request) => {
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const forbiddenProfileField = FORBIDDEN_PROFILE_FIELDS.find((field) => field in body);
  if (forbiddenProfileField) {
    return errorResponse(
      400,
      "validation_error",
      `${forbiddenProfileField} is not accepted by the public analyzer`,
    );
  }

  const ingredientText = stringField(body, "ingredientText");
  if (!ingredientText) {
    return errorResponse(400, "validation_error", "ingredientText is required");
  }

  if (ingredientText.length > MAX_INGREDIENT_TEXT_LENGTH) {
    return errorResponse(
      400,
      "validation_error",
      "ingredientText must be 10,000 characters or fewer",
    );
  }

  const tokens = splitIngredientText(ingredientText);
  if (tokens.length === 0) {
    return errorResponse(
      400,
      "validation_error",
      "ingredientText must contain at least one ingredient name",
    );
  }

  const clientResult = createServiceRoleClient();
  if (!clientResult.ok) {
    return errorResponse(
      503,
      "service_unavailable",
      "Analyzer database client is not configured",
      { missing: clientResult.missing },
    );
  }

  const { data: aliasRows, error: aliasError } = await clientResult.client
    .from("ingredient_aliases")
    .select(`
      ingredient_id,
      normalized_alias,
      language,
      confidence,
      ingredients!inner (
        id,
        canonical_name,
        inci_name,
        korean_name,
        source_status
      )
    `)
    .limit(1000);

  if (aliasError) {
    return errorResponse(500, "database_error", "Failed to load ingredient aliases", aliasError.message);
  }

  const publicAliasRows = ((aliasRows ?? []) as AliasRow[]).filter((row) =>
    row.ingredients?.source_status === "verified" || row.ingredients?.source_status === "imported"
  );

  const parsedIngredients = tokens.map((token) => matchToken(token, publicAliasRows));
  const matchedIngredientIds = [
    ...new Set(parsedIngredients.map((ingredient) => ingredient.ingredientId).filter(Boolean)),
  ] as string[];

  const ruleRows = await loadActiveRules(clientResult.client, matchedIngredientIds);
  if (ruleRows instanceof Response) return ruleRows;

  return okResponse({
    parsedIngredients,
    flags: buildFlags(parsedIngredients, ruleRows),
    unmatchedCount: parsedIngredients.filter((ingredient) => !ingredient.ingredientId).length,
    disclaimer: DISCLAIMER,
  });
});

function splitIngredientText(ingredientText: string) {
  return ingredientText
    .split(/[,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((rawName, index) => ({
      position: index + 1,
      rawName,
      normalizedName: normalizeIngredientName(rawName),
    }))
    .filter((ingredient) => ingredient.normalizedName.length > 0);
}

function normalizeIngredientName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchToken(
  token: { position: number; rawName: string; normalizedName: string },
  aliasRows: AliasRow[],
): ParsedIngredient {
  const scored = aliasRows
    .map((row) => {
      const score = scoreAliasMatch(token.normalizedName, row.normalized_alias);
      return { row, score, weightedScore: score * Number(row.confidence ?? 0) };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.weightedScore - a.weightedScore)[0];

  if (!scored?.row.ingredients) {
    return {
      position: token.position,
      rawName: token.rawName,
      ingredientId: null,
      displayName: token.rawName,
      matchMethod: "unmatched",
      confidence: 0,
    };
  }

  return {
    position: token.position,
    rawName: token.rawName,
    ingredientId: scored.row.ingredient_id,
    displayName: scored.row.ingredients.canonical_name,
    inciName: scored.row.ingredients.inci_name,
    koreanName: scored.row.ingredients.korean_name,
    matchMethod: scored.score === 1 ? "exact" : "alias",
    confidence: Number(scored.weightedScore.toFixed(2)),
  };
}

function scoreAliasMatch(normalizedRawName: string, normalizedAlias: string): number {
  if (normalizedRawName === normalizedAlias) return 1;
  if (normalizedRawName.includes(normalizedAlias) || normalizedAlias.includes(normalizedRawName)) return 0.75;
  return 0;
}

async function loadActiveRules(client: ReturnType<typeof createServiceRoleClient> extends { ok: true; client: infer C } ? C : never, ingredientIds: string[]) {
  if (ingredientIds.length === 0) return [];

  const { data, error } = await client
    .from("ingredient_safety_rules")
    .select(`
      id,
      ingredient_id,
      severity,
      title,
      why_it_matters,
      who_should_care,
      recommendation,
      version
    `)
    .in("ingredient_id", ingredientIds)
    .eq("active", true);

  if (error) {
    return errorResponse(500, "database_error", "Failed to load safety rules", error.message);
  }

  return (data ?? []) as RuleRow[];
}

function buildFlags(parsedIngredients: ParsedIngredient[], ruleRows: RuleRow[]) {
  return parsedIngredients.flatMap((ingredient) => {
    if (!ingredient.ingredientId) return [];

    return ruleRows
      .filter((rule) => rule.ingredient_id === ingredient.ingredientId)
      .map((rule) => ({
        ingredientId: ingredient.ingredientId,
        ingredientName: ingredient.displayName,
        severity: rule.severity,
        title: rule.title,
        whyItMatters: rule.why_it_matters,
        whoShouldCare: rule.who_should_care,
        recommendation: rule.recommendation,
        ruleId: rule.id,
        ruleVersion: rule.version,
        sourceLabel: "Supabase safety rule",
      }));
  });
}
```

- [ ] **Step 3: Run the Edge Function smoke and verify matching**

Run:

```bash
npx supabase functions serve analyze-ingredient-text --no-verify-jwt > /tmp/k-beauty-analyzer.log 2>&1 &
server_pid=$!
sleep 5
curl --max-time 10 -fsS http://127.0.0.1:54321/functions/v1/analyze-ingredient-text \
  -H "Content-Type: application/json" \
  -d '{"ingredientText":"Water, Fragrance, Hyaluronic Acid"}' | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const body = JSON.parse(input);
  const data = body.data;
  console.log(JSON.stringify({
    ok: body.ok,
    parsedCount: data.parsedIngredients.length,
    unmatchedCount: data.unmatchedCount,
    matched: data.parsedIngredients.map(item => [item.rawName, item.displayName, item.matchMethod]),
    flagTitles: data.flags.map(flag => flag.title)
  }, null, 2));
});
'
kill "$server_pid" 2>/dev/null || true
```

Expected:

```json
{
  "ok": true,
  "parsedCount": 3,
  "unmatchedCount": 1,
  "matched": [
    ["Water", "Water", "unmatched"],
    ["Fragrance", "Fragrance", "exact"],
    ["Hyaluronic Acid", "Sodium Hyaluronate", "exact"]
  ],
  "flagTitles": ["Fragrance ingredient detected"]
}
```

- [ ] **Step 4: Verify public profile fields are rejected**

Run:

```bash
npx supabase functions serve analyze-ingredient-text --no-verify-jwt > /tmp/k-beauty-analyzer.log 2>&1 &
server_pid=$!
sleep 5
curl --max-time 10 -sS -o /tmp/k-beauty-profile-reject.json -w "%{http_code}" \
  http://127.0.0.1:54321/functions/v1/analyze-ingredient-text \
  -H "Content-Type: application/json" \
  -d '{"ingredientText":"Fragrance","allergies":["fragrance"]}'
cat /tmp/k-beauty-profile-reject.json
kill "$server_pid" 2>/dev/null || true
```

Expected:

```text
400
{"ok":false,"error":{"code":"validation_error","message":"allergies is not accepted by the public analyzer"}}
```

- [ ] **Step 5: Commit the Edge Function analyzer**

```bash
git add supabase/functions/analyze-ingredient-text/index.ts
git commit -m "feat: match ingredients in analyzer function"
```

## Task 4: Analyzer Smoke Script

**Files:**
- Create: `scripts/smoke-supabase-analyzer.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create a failing smoke script**

Create `scripts/smoke-supabase-analyzer.mjs`:

```javascript
const endpoint = process.env.SUPABASE_FUNCTIONS_URL ||
  "http://127.0.0.1:54321/functions/v1/analyze-ingredient-text";

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ingredientText: "Water, Fragrance, Hyaluronic Acid" }),
});

const body = await response.json();

if (!response.ok || !body.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const parsedIngredients = body.data?.parsedIngredients ?? [];
const flags = body.data?.flags ?? [];

const fragrance = parsedIngredients.find((ingredient) => ingredient.rawName === "Fragrance");
const hyaluronic = parsedIngredients.find((ingredient) => ingredient.rawName === "Hyaluronic Acid");

if (body.data?.unmatchedCount !== 1) {
  console.error(`Expected unmatchedCount=1, received ${body.data?.unmatchedCount}`);
  process.exit(1);
}

if (fragrance?.displayName !== "Fragrance" || !fragrance?.ingredientId) {
  console.error("Expected Fragrance to match a Supabase ingredient");
  process.exit(1);
}

if (hyaluronic?.displayName !== "Sodium Hyaluronate" || !hyaluronic?.ingredientId) {
  console.error("Expected Hyaluronic Acid to match Sodium Hyaluronate");
  process.exit(1);
}

if (!flags.some((flag) => flag.title === "Fragrance ingredient detected")) {
  console.error("Expected Fragrance ingredient detected flag");
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  parsedCount: parsedIngredients.length,
  unmatchedCount: body.data.unmatchedCount,
  flagCount: flags.length,
}, null, 2));
```

- [ ] **Step 2: Add a package script**

Modify `package.json`:

```json
{
  "scripts": {
    "smoke:supabase:analyzer": "node scripts/smoke-supabase-analyzer.mjs"
  }
}
```

Keep the existing scripts. The final script block should include:

```json
"scripts": {
  "start": "react-scripts start",
  "build": "react-scripts build",
  "test": "react-scripts test",
  "supabase:status": "npx supabase status",
  "supabase:reset": "npx supabase db reset",
  "supabase:functions:serve": "npx supabase functions serve",
  "smoke:supabase:analyzer": "node scripts/smoke-supabase-analyzer.mjs",
  "eject": "react-scripts eject"
}
```

- [ ] **Step 3: Run the script while the Edge Function is stopped**

Run:

```bash
npm run smoke:supabase:analyzer
```

Expected:

```text
TypeError: fetch failed
```

- [ ] **Step 4: Run the script while the Edge Function is served**

Run:

```bash
npx supabase functions serve analyze-ingredient-text --no-verify-jwt > /tmp/k-beauty-analyzer.log 2>&1 &
server_pid=$!
sleep 5
npm run smoke:supabase:analyzer
kill "$server_pid" 2>/dev/null || true
```

Expected:

```json
{
  "ok": true,
  "parsedCount": 3,
  "unmatchedCount": 1,
  "flagCount": 1
}
```

- [ ] **Step 5: Commit the smoke script**

```bash
git add package.json scripts/smoke-supabase-analyzer.mjs
git commit -m "test: add analyzer smoke script"
```

## Task 5: Documentation Alignment

**Files:**
- Modify: `docs/pages/03_ingredients.md`
- Modify: `docs/api/01-api-contract.md`
- Modify: `docs/architecture/05-ingredient-safety-engine.md`
- Modify: `docs/ops/01-deployment-runbook.md`
- Modify: `PLANNING.md`

- [ ] **Step 1: Update the Ingredients page current-state section**

In `docs/pages/03_ingredients.md`, replace the analyzer current-state paragraph with:

```markdown
### Current Analyzer Behavior

- When Supabase is configured, the page calls `analyze-ingredient-text`.
- The Edge Function parses comma/semicolon-separated ingredient text, matches tokens against `ingredient_aliases`, and returns active `ingredient_safety_rules` for matched ingredients.
- `Water, Fragrance, Hyaluronic Acid` should return one unmatched token (`Water`), two matched ingredients (`Fragrance`, `Sodium Hyaluronate`), and one fragrance safety flag.
- If Supabase is not configured or the function fails, the frontend uses `src/safety/localIngredientAnalyzer.js` with the same split/normalize behavior and static fallback ingredient aliases.
- The public analyzer rejects allergy/profile fields such as `allergies`, `allergyProfile`, and `skinProfile`; user-specific sensitivity storage remains outside the public analyzer.
```

- [ ] **Step 2: Update the API contract status**

In `docs/api/01-api-contract.md`, update the analyzer implementation note to:

```markdown
Implementation status: `analyze-ingredient-text` is implemented as an MVP parser/matcher. It accepts only `ingredientText`, rejects public profile/allergy fields, splits comma/semicolon-separated labels, matches aliases from Supabase, and returns active rule flags. Rate limiting, scan history persistence, user-specific sensitivity profiles, and OCR are outside this endpoint.
```

- [ ] **Step 3: Update the architecture safety engine boundary**

In `docs/architecture/05-ingredient-safety-engine.md`, add:

```markdown
## MVP Runtime Boundary

The MVP safety engine has two runtime paths:

| Path | Runtime | Data source | Purpose |
|---|---|---|---|
| Supabase analyzer | `supabase/functions/analyze-ingredient-text` | `ingredient_aliases`, `ingredients`, `ingredient_safety_rules` | Primary public analyzer when Supabase env is configured |
| Frontend fallback | `src/safety/localIngredientAnalyzer.js` | `src/data/ingredients.js` | Offline/static fallback when Supabase is missing or unavailable |

Both paths use the same split and normalization behavior:

- split on comma and semicolon
- trim empty tokens
- lowercase English text
- remove parenthetical notes
- preserve Korean characters
- collapse punctuation and whitespace

Safety flags are rule-based. LLM output must not be used as the final allergy or safety decision.
```

- [ ] **Step 4: Update the runbook smoke command**

In `docs/ops/01-deployment-runbook.md`, add this command under Local Edge Function Smoke:

````markdown
Analyzer smoke shortcut:

```bash
npx supabase functions serve analyze-ingredient-text --no-verify-jwt > /tmp/k-beauty-analyzer.log 2>&1 &
server_pid=$!
sleep 5
npm run smoke:supabase:analyzer
kill "$server_pid" 2>/dev/null || true
```

Expected:

```json
{
  "ok": true,
  "parsedCount": 3,
  "unmatchedCount": 1,
  "flagCount": 1
}
```
````

- [ ] **Step 5: Update `PLANNING.md` checklist**

In `PLANNING.md`, change:

```markdown
- [ ] 성분 파서·안전성 rule engine을 frontend fallback과 Edge Function 양쪽에 일관되게 정리
```

to:

```markdown
- [x] 성분 파서·안전성 rule engine을 frontend fallback과 Edge Function 양쪽에 일관되게 정리
```

Only check it off after Tasks 1-4 pass.

- [ ] **Step 6: Commit documentation updates**

```bash
git add docs/pages/03_ingredients.md docs/api/01-api-contract.md docs/architecture/05-ingredient-safety-engine.md docs/ops/01-deployment-runbook.md PLANNING.md
git commit -m "docs: document ingredient safety analyzer"
```

## Task 6: Final Verification

**Files:**
- Verify: all files changed in Tasks 1-5

- [ ] **Step 1: Run frontend unit tests**

Run:

```bash
CI=true npm test -- --watch=false src/safety/ingredientText.test.js src/safety/localIngredientAnalyzer.test.js
```

Expected:

```text
PASS src/safety/ingredientText.test.js
PASS src/safety/localIngredientAnalyzer.test.js
```

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully.
```

- [ ] **Step 3: Verify Supabase local services**

Run:

```bash
npx supabase status
npx supabase db lint --local
```

Expected:

```text
supabase local development setup is running.
No schema errors found
```

- [ ] **Step 4: Run analyzer smoke**

Run:

```bash
npx supabase functions serve analyze-ingredient-text --no-verify-jwt > /tmp/k-beauty-analyzer.log 2>&1 &
server_pid=$!
sleep 5
npm run smoke:supabase:analyzer
kill "$server_pid" 2>/dev/null || true
```

Expected:

```json
{
  "ok": true,
  "parsedCount": 3,
  "unmatchedCount": 1,
  "flagCount": 1
}
```

- [ ] **Step 5: Run whitespace and secret checks**

Run:

```bash
git diff --check
if rg -n "service_role|SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY" src public; then
  echo "Secret-like service role reference found in browser code"
  exit 1
else
  echo "No service role references found in browser code"
fi
```

Expected:

```text
No service role references found in browser code
```

- [ ] **Step 6: Commit final verification notes if docs changed during verification**

If verification changes runbook wording, commit it:

```bash
git add docs/ops/01-deployment-runbook.md
git commit -m "docs: record analyzer verification"
```

If no files changed, do not create an empty commit.

## Self-Review

Spec coverage:

- Ingredient parsing is covered by Task 1.
- Frontend fallback alignment is covered by Task 2.
- Supabase alias matching and rule flags are covered by Task 3.
- Repeatable smoke verification is covered by Task 4.
- Documentation drift is covered by Task 5.
- Build, lint, smoke, and secret checks are covered by Task 6.

Placeholder scan:

- The plan does not use forbidden placeholder tokens.
- Each code-changing step includes concrete code or exact replacement text.
- Each verification step includes exact commands and expected outputs.

Type consistency:

- Frontend parsed ingredient fields use `position`, `rawName`, `ingredientId`, `displayName`, `matchMethod`, `confidence`, and `safety`.
- Edge Function parsed ingredient fields use the same core names and additionally include `inciName` and `koreanName` when matched.
- Flag fields use `ingredientId`, `ingredientName`, `severity`, `title`, `whyItMatters`, `recommendation`, and `sourceLabel` across both paths.
