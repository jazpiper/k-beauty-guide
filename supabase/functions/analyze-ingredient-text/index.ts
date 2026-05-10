import {
  errorResponse,
  okResponse,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

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
  confidence: number | string | null;
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

type IngredientToken = {
  position: number;
  rawName: string;
  normalizedName: string;
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

  const aliasRows = await loadPublicAliasRows(clientResult.client);
  if (aliasRows instanceof Response) return aliasRows;

  const parsedIngredients = tokens.map((token) => matchToken(token, aliasRows));
  const matchedIngredientIds = [
    ...new Set(
      parsedIngredients
        .map((ingredient) => ingredient.ingredientId)
        .filter((ingredientId): ingredientId is string => Boolean(ingredientId)),
    ),
  ];

  const ruleRows = await loadActiveRules(clientResult.client, matchedIngredientIds);
  if (ruleRows instanceof Response) return ruleRows;

  return okResponse({
    parsedIngredients,
    flags: buildFlags(parsedIngredients, ruleRows),
    unmatchedCount: parsedIngredients.filter((ingredient) => !ingredient.ingredientId).length,
    disclaimer: DISCLAIMER,
  });
});

function splitIngredientText(ingredientText: string): IngredientToken[] {
  return String(ingredientText || "")
    .split(/[,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((rawName) => ({
      rawName,
      normalizedName: normalizeIngredientName(rawName),
    }))
    .filter((ingredient) => ingredient.normalizedName.length > 0)
    .map((ingredient, index) => ({
      position: index + 1,
      ...ingredient,
    }));
}

function normalizeIngredientName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadPublicAliasRows(client: SupabaseClient): Promise<AliasRow[] | Response> {
  const { data, error } = await client
    .from("ingredient_aliases")
    .select(`
      ingredient_id,
      normalized_alias,
      confidence,
      ingredients!inner (
        id,
        canonical_name,
        inci_name,
        korean_name,
        source_status
      )
    `)
    .in("ingredients.source_status", ["verified", "imported"])
    .limit(1000);

  if (error) {
    return errorResponse(500, "database_error", "Failed to load ingredient aliases", error.message);
  }

  return ((data ?? []) as unknown as AliasRow[]).filter((row) =>
    row.ingredients?.source_status === "verified" || row.ingredients?.source_status === "imported"
  );
}

function matchToken(token: IngredientToken, aliasRows: AliasRow[]): ParsedIngredient {
  const match = aliasRows
    .map((row) => {
      const score = scoreAliasMatch(token.normalizedName, row.normalized_alias);
      const aliasConfidence = Number(row.confidence ?? 1);

      return {
        row,
        score,
        confidence: score * (Number.isFinite(aliasConfidence) ? aliasConfidence : 1),
      };
    })
    .filter((candidate) => candidate.score > 0 && candidate.row.ingredients)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.confidence - a.confidence;
    })[0];

  if (!match?.row.ingredients) {
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
    ingredientId: match.row.ingredient_id,
    displayName: match.row.ingredients.canonical_name,
    inciName: match.row.ingredients.inci_name,
    koreanName: match.row.ingredients.korean_name,
    matchMethod: match.score === 1 ? "exact" : "alias",
    confidence: Number(match.confidence.toFixed(2)),
  };
}

function scoreAliasMatch(normalizedRawName: string, normalizedAlias: string): number {
  const alias = String(normalizedAlias || "").trim();

  if (!alias) return 0;
  if (normalizedRawName === alias) return 1;

  return 0;
}

async function loadActiveRules(
  client: SupabaseClient,
  ingredientIds: string[],
): Promise<RuleRow[] | Response> {
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

  return (data ?? []) as unknown as RuleRow[];
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
