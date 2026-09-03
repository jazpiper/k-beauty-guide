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
const ALIAS_QUERY_CHUNK_SIZE = 50;

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
  try {
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
      return errorResponse(
        req,
        400,
        "validation_error",
        "ingredientText is required",
      );
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

    const { data: userData, error: userError } =
      await clientResult.client.auth.getUser(token);
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

    const parsedIngredients = tokens.map((t) => matchToken(t, aliasMap));
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
  } catch (err) {
    return errorResponse(
      req,
      500,
      "internal_error",
      "An unexpected error occurred",
      err instanceof Error ? err.message : String(err),
    );
  }
});

function splitIngredientText(ingredientText: string): IngredientToken[] {
  const rawTokens = String(ingredientText || "").split(/[,;]+/);
  const result: IngredientToken[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const rawName = rawTokens[i].trim();
    if (!rawName) continue;

    const normalizedName = normalizeIngredientName(rawName);
    if (normalizedName.length === 0) continue;

    result.push({
      position: result.length + 1,
      rawName,
      normalizedName,
    });
  }

  return result;
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
  const uniqueNames = [
    ...new Set(
      (normalizedNames || [])
        .map((name) => String(name || "").trim().toLowerCase())
        .filter((name) => name.length > 0),
    ),
  ];
  if (uniqueNames.length === 0) {
    return new Map<string, AliasRow[]>();
  }

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueNames.length; i += ALIAS_QUERY_CHUNK_SIZE) {
    chunks.push(uniqueNames.slice(i, i + ALIAS_QUERY_CHUNK_SIZE));
  }

  try {
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        client
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
          .in("normalized_alias", chunk)
          .in("ingredients.source_status", ["verified", "imported"]),
      ),
    );

    for (const result of chunkResults) {
      if (result?.error) {
        return errorResponse(
          req,
          500,
          "database_error",
          "Failed to load ingredient aliases",
          result.error.message || String(result.error),
        );
      }
    }

    const newAliasMap = new Map<string, AliasRow[]>();
    for (const result of chunkResults) {
      const rows = ((result?.data ?? []) as unknown as AliasRow[]).filter(
        (row) =>
          Boolean(row) &&
          (row.ingredients?.source_status === "verified" ||
            row.ingredients?.source_status === "imported"),
      );

      for (const row of rows) {
        const aliasKey = String(row.normalized_alias || "").trim().toLowerCase();
        if (!aliasKey) continue;
        if (!newAliasMap.has(aliasKey)) {
          newAliasMap.set(aliasKey, []);
        }
        newAliasMap.get(aliasKey)!.push(row);
      }
    }

    return newAliasMap;
  } catch (err) {
    return errorResponse(
      req,
      500,
      "database_error",
      "Failed to load ingredient aliases",
      err instanceof Error ? err.message : String(err),
    );
  }
}

function matchToken(
  token: IngredientToken,
  aliasMap?: Map<string, AliasRow[]> | null,
): ParsedIngredient {
  if (!token) {
    return {
      position: 1,
      rawName: "",
      ingredientId: null,
      displayName: "",
      matchMethod: "unmatched",
      confidence: 0,
    };
  }

  const map =
    aliasMap instanceof Map ? aliasMap : new Map<string, AliasRow[]>();
  const tokenNormalized = normalizeIngredientName(
    token.normalizedName || token.rawName || "",
  );
  const normalizedKey = (token.normalizedName || "").toLowerCase().trim();
  const rawKey = (token.rawName || "").toLowerCase().trim();

  const matchingRows =
    (token.normalizedName ? map.get(token.normalizedName) : undefined) ||
    (tokenNormalized ? map.get(tokenNormalized) : undefined) ||
    (normalizedKey ? map.get(normalizedKey) : undefined) ||
    (rawKey ? map.get(rawKey) : undefined) ||
    [];

  const match = matchingRows
    .map((row) => {
      const aliasConfidence = Number(row?.confidence ?? 1);
      const clampedConfidence = Math.max(
        0,
        Math.min(1, Number.isFinite(aliasConfidence) ? aliasConfidence : 1),
      );
      return {
        row,
        confidence: clampedConfidence,
      };
    })
    .filter((candidate) => candidate.row?.ingredients)
    .sort((a, b) => {
      const aCanonical = normalizeIngredientName(
        a.row.ingredients?.canonical_name ?? "",
      );
      const bCanonical = normalizeIngredientName(
        b.row.ingredients?.canonical_name ?? "",
      );
      const aIsExact =
        Boolean(aCanonical) &&
        Boolean(tokenNormalized) &&
        aCanonical === tokenNormalized;
      const bIsExact =
        Boolean(bCanonical) &&
        Boolean(tokenNormalized) &&
        bCanonical === tokenNormalized;

      // Exact canonical name match takes strict precedence over alias match
      if (aIsExact !== bIsExact) {
        return aIsExact ? -1 : 1;
      }

      // Higher confidence preferred
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      // Verified source status preferred over imported
      if (
        a.row.ingredients?.source_status !== b.row.ingredients?.source_status
      ) {
        if (a.row.ingredients?.source_status === "verified") return -1;
        if (b.row.ingredients?.source_status === "verified") return 1;
      }

      // Deterministic tiebreaker by ingredient_id
      return String(a.row.ingredient_id || "").localeCompare(
        String(b.row.ingredient_id || ""),
      );
    })[0];

  if (!match?.row?.ingredients) {
    return {
      position: token.position ?? 1,
      rawName: token.rawName ?? "",
      ingredientId: null,
      displayName: token.rawName ?? "",
      matchMethod: "unmatched",
      confidence: 0,
    };
  }

  const canonicalNormalized = normalizeIngredientName(
    match.row.ingredients.canonical_name,
  );
  const isExact =
    Boolean(canonicalNormalized) &&
    Boolean(tokenNormalized) &&
    tokenNormalized === canonicalNormalized;

  const canonicalName = String(
    match.row.ingredients.canonical_name || "",
  ).trim();

  return {
    position: token.position ?? 1,
    rawName: token.rawName ?? "",
    ingredientId: match.row.ingredient_id,
    displayName: canonicalName || token.rawName || "",
    inciName: match.row.ingredients.inci_name,
    koreanName: match.row.ingredients.korean_name,
    matchMethod: isExact ? "exact" : "alias",
    confidence: Number(match.confidence.toFixed(2)),
  };
}

// In-memory cache for safety rules to reduce database load
let cachedRulesMap: Map<string, RuleRow[]> | null = null;
let lastRulesCacheUpdate: number = 0;
const RULES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadActiveRules(
  req: Request,
  client: SupabaseClient,
  ingredientIds: string[],
): Promise<RuleRow[] | Response> {
  if (ingredientIds.length === 0) return [];

  const now = Date.now();
  if (!cachedRulesMap || now - lastRulesCacheUpdate >= RULES_CACHE_TTL_MS) {
    try {
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
        .eq("active", true)
        .limit(10000); // Fetch all active rules for the global cache

      if (error) {
        return errorResponse(
          req,
          500,
          "database_error",
          "Failed to load safety rules",
          error.message || String(error),
        );
      }

      const fetchedRules = (data ?? []) as unknown as RuleRow[];

      const newRulesMap = new Map<string, RuleRow[]>();
      for (const rule of fetchedRules) {
        if (!newRulesMap.has(rule.ingredient_id)) {
          newRulesMap.set(rule.ingredient_id, []);
        }
        newRulesMap.get(rule.ingredient_id)!.push(rule);
      }

      cachedRulesMap = newRulesMap;
      lastRulesCacheUpdate = now;
    } catch (err) {
      return errorResponse(
        req,
        500,
        "database_error",
        "Failed to load safety rules",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const results: RuleRow[] = [];
  const uniqueIds = [...new Set(ingredientIds)];
  for (const id of uniqueIds) {
    if (cachedRulesMap.has(id)) {
      results.push(...cachedRulesMap.get(id)!);
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

export {
  ALIAS_QUERY_CHUNK_SIZE,
  loadPublicAliasMap,
  matchToken,
  normalizeIngredientName,
  splitIngredientText,
};
