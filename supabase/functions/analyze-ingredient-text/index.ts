import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

import {
  errorResponse,
  okResponse,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const MAX_INGREDIENT_TEXT_LENGTH = 10_000;
const FORBIDDEN_PROFILE_FIELDS = [
  "allergyProfile",
  "allergies",
  "avoidIngredients",
  "sensitivityProfile",
  "skinProfile",
];
const DISCLAIMER =
  "Ingredient information is educational and not a medical diagnosis.";

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

serve(async (req: Request) => {
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const forbiddenProfileField = FORBIDDEN_PROFILE_FIELDS.find(
    (field) => field in body,
  );
  if (forbiddenProfileField) {
    return errorResponse(
      req,
      400,
      "validation_error",
      `${forbiddenProfileField} is not accepted by the public analyzer`,
    );
  }

  const ingredientText = stringField(body, "ingredientText");
  if (!ingredientText) {
    return errorResponse(req, 400, "validation_error", "ingredientText is required");
  }

  if (ingredientText.length > MAX_INGREDIENT_TEXT_LENGTH) {
    return errorResponse(
      req,
      400,
      "validation_error",
      "ingredientText must be 10,000 characters or fewer",
    );
  }

  const tokens = splitIngredientText(ingredientText);
  if (tokens.length === 0) {
    return errorResponse(
      req,
      400,
      "validation_error",
      "ingredientText must contain at least one ingredient name",
    );
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return errorResponse(req, 401, "unauthorized", "Bearer token is required");
  }

  const clientResult = createServiceRoleClient();
  if (!clientResult.ok) {
    return errorResponse(
      req,
      503,
      "service_unavailable",
      "Analyzer database client is not configured",
      { missing: clientResult.missing },
    );
  }

  const { data: userData, error: userError } = await clientResult.client.auth.getUser(token);
  if (userError || !userData.user) {
    return errorResponse(req, 401, "unauthorized", "Invalid user token");
  }

  const normalizedNames = [...new Set(tokens.map((t) => t.normalizedName))];
  const aliasMap = await loadPublicAliasMap(
    req,
    clientResult.client,
    normalizedNames,
  );
  if (aliasMap instanceof Response) return aliasMap;

  const parsedIngredients = tokens.map((token) => matchToken(token, aliasMap));
  const matchedIngredientIds = [
    ...new Set(
      parsedIngredients
        .map((ingredient) => ingredient.ingredientId)
        .filter((ingredientId): ingredientId is string =>
          Boolean(ingredientId),
        ),
    ),
  ];

  const ruleRows = await loadActiveRules(
    req,
    clientResult.client,
    matchedIngredientIds,
  );
  if (ruleRows instanceof Response) return ruleRows;

  return okResponse(req, {
    parsedIngredients,
    flags: buildFlags(parsedIngredients, ruleRows),
    unmatchedCount: parsedIngredients.filter(
      (ingredient) => !ingredient.ingredientId,
    ).length,
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

async function loadPublicAliasMap(
  req: Request,
  client: SupabaseClient,
  normalizedNames: string[],
): Promise<Map<string, AliasRow[]> | Response> {
  if (normalizedNames.length === 0) {
    return new Map<string, AliasRow[]>();
  }

  const { data, error } = await client
    .from("ingredient_aliases")
    .select(
      `
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
    `,
    )
    .in("normalized_alias", normalizedNames)
    .in("ingredients.source_status", ["verified", "imported"]);

  if (error) {
    return errorResponse(
      req,
      500,
      "database_error",
      "Failed to load ingredient aliases",
      error.message,
    );
  }

  const rows = ((data ?? []) as unknown as AliasRow[]).filter(
    (row) =>
      row.ingredients?.source_status === "verified" ||
      row.ingredients?.source_status === "imported",
  );

  const newAliasMap = new Map<string, AliasRow[]>();
  for (const row of rows) {
    const aliasKey = String(row.normalized_alias || "").trim();
    if (!newAliasMap.has(aliasKey)) {
      newAliasMap.set(aliasKey, []);
    }
    newAliasMap.get(aliasKey)!.push(row);
  }

  return newAliasMap;
}

function matchToken(
  token: IngredientToken,
  aliasMap: Map<string, AliasRow[]>,
): ParsedIngredient {
  const matchingRows = aliasMap.get(token.normalizedName) || [];

  const match = matchingRows
    .map((row) => {
      const aliasConfidence = Number(row.confidence ?? 1);
      return {
        row,
        confidence: Number.isFinite(aliasConfidence) ? aliasConfidence : 1,
      };
    })
    .filter((candidate) => candidate.row.ingredients)
    .sort((a, b) => {
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
    matchMethod: "exact", // Since it's a direct map lookup, it's always an exact alias match
    confidence: Number(match.confidence.toFixed(2)),
  };
}

// In-memory cache for safety rules to reduce database load
const ACTIVE_RULES_CACHE = new Map<string, RuleRow[]>();

async function loadActiveRules(
  req: Request,
  client: SupabaseClient,
  ingredientIds: string[],
): Promise<RuleRow[] | Response> {
  if (ingredientIds.length === 0) return [];

  const uniqueIds = [...new Set(ingredientIds)];
  const uncachedIds: string[] = [];
  const results: RuleRow[] = [];

  for (const id of uniqueIds) {
    if (ACTIVE_RULES_CACHE.has(id)) {
      results.push(...(ACTIVE_RULES_CACHE.get(id) || []));
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length > 0) {
    const { data, error } = await client
      .from("ingredient_safety_rules")
      .select(
        `
        id,
        ingredient_id,
        severity,
        title,
        why_it_matters,
        who_should_care,
        recommendation,
        version
      `,
      )
      .in("ingredient_id", uncachedIds)
      .eq("active", true);

    if (error) {
      return errorResponse(
        req,
        500,
        "database_error",
        "Failed to load safety rules",
        error.message,
      );
    }

    const fetchedRules = (data ?? []) as unknown as RuleRow[];

    // Group rules by ingredient_id
    const rulesByIngredientId = new Map<string, RuleRow[]>();
    for (const id of uncachedIds) {
      rulesByIngredientId.set(id, []);
    }
    for (const rule of fetchedRules) {
      rulesByIngredientId.get(rule.ingredient_id)?.push(rule);
    }

    // Populate cache and add to results
    for (const [id, rules] of rulesByIngredientId.entries()) {
      ACTIVE_RULES_CACHE.set(id, rules);
      results.push(...rules);
    }
  }

  return results;
}

function buildFlags(
  parsedIngredients: ParsedIngredient[],
  ruleRows: RuleRow[],
) {
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
