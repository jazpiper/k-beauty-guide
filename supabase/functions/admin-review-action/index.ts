import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  errorResponse,
  okResponse,
  optionalStringField,
  pathId,
  readJsonBody,
  requirePost,
  stringField,
} from "../_shared/http.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const REVIEW_ACTIONS = ["approve", "reject", "block", "assign"] as const;
const COMMENT_REQUIRED_ACTIONS = ["approve", "reject", "block"] as const;
const TERMINAL_STATUSES = ["approved", "rejected", "blocked"] as const;
const REVIEW_STATUS_BY_ACTION = {
  approve: "approved",
  reject: "rejected",
  block: "blocked",
  assign: "assigned",
} as const;

type ReviewAction = typeof REVIEW_ACTIONS[number];
type ReviewItem = {
  id: string;
  item_type: string;
  item_id: string;
  status: string;
  assigned_to: string | null;
  resolved_at: string | null;
};
type AdminUser = { user_id: string; role: string; active: boolean };
type ProductCandidate = {
  id: string;
  source_id: string;
  source_product_id: string | null;
  source_url: string;
  brand_name: string | null;
  product_name: string;
  category: string | null;
  description: string | null;
  price_krw: number | null;
  source_price: number | null;
  source_currency: string | null;
  image_urls: string[];
};

Deno.serve((req: Request) => handleRequest(req));

async function handleRequest(req: Request): Promise<Response> {
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const body = await readJsonBody(req);
  if (body instanceof Response) return body;

  const action = stringField(body, "action") as ReviewAction;
  const idempotencyKey = stringField(body, "idempotencyKey");
  const comment = stringField(body, "comment");
  const assignedTo = stringField(body, "assignedTo");
  const reviewItemId = optionalStringField(body, "reviewItemId") ?? pathId(req, "admin-review-action");

  const validationError = validateRequest(action, reviewItemId, idempotencyKey, comment, assignedTo);
  if (validationError) return validationError;

  const serviceClient = createServiceRoleClient();
  if (!serviceClient.ok) {
    return errorResponse(500, "configuration_error", "Missing Supabase service role configuration", {
      missing: serviceClient.missing,
    });
  }

  const actorResult = await requireActiveAdmin(serviceClient.client, req);
  if (actorResult instanceof Response) return actorResult;

  const result = await applyReviewAction(serviceClient.client, {
    action,
    assignedTo,
    actor: actorResult,
    comment,
    idempotencyKey,
    reviewItemId: reviewItemId!,
  });

  if (result instanceof Response) return result;
  return okResponse(result);
}

function validateRequest(
  action: string,
  reviewItemId: string | null,
  idempotencyKey: string,
  comment: string,
  assignedTo: string,
): Response | null {
  if (!REVIEW_ACTIONS.includes(action as ReviewAction)) {
    return errorResponse(400, "validation_error", "action must be approve, reject, block, or assign");
  }

  if (!reviewItemId) {
    return errorResponse(400, "validation_error", "reviewItemId is required");
  }

  if (!idempotencyKey) {
    return errorResponse(400, "validation_error", "idempotencyKey is required");
  }

  if (COMMENT_REQUIRED_ACTIONS.includes(action as typeof COMMENT_REQUIRED_ACTIONS[number]) && !comment) {
    return errorResponse(400, "validation_error", `${action} requires comment`);
  }

  if (action === "assign" && !assignedTo) {
    return errorResponse(400, "validation_error", "assign requires assignedTo");
  }

  return null;
}

async function requireActiveAdmin(client: SupabaseClient, req: Request): Promise<AdminUser | Response> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return errorResponse(401, "unauthorized", "Bearer token is required");
  }

  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) {
    return errorResponse(401, "unauthorized", "Invalid user token");
  }

  const { data: adminUser, error: adminError } = await client
    .from("admin_users")
    .select("user_id, role, active")
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError) {
    return errorResponse(500, "db_error", "Failed to verify admin user", adminError.message);
  }

  if (!adminUser) {
    return errorResponse(403, "forbidden", "Active admin user is required");
  }

  return adminUser as AdminUser;
}

async function applyReviewAction(
  client: SupabaseClient,
  params: {
    action: ReviewAction;
    assignedTo: string;
    actor: AdminUser;
    comment: string;
    idempotencyKey: string;
    reviewItemId: string;
  },
): Promise<unknown | Response> {
  const existingAudit = await findExistingAudit(client, params);
  if (existingAudit instanceof Response) return existingAudit;
  if (existingAudit) {
    return {
      accepted: true,
      action: params.action,
      reviewItemId: params.reviewItemId,
      auditLogId: existingAudit.id,
      idempotent: true,
    };
  }

  const { data: reviewItem, error: reviewError } = await client
    .from("review_items")
    .select("id, item_type, item_id, status, assigned_to, resolved_at")
    .eq("id", params.reviewItemId)
    .maybeSingle();

  if (reviewError) {
    return errorResponse(500, "db_error", "Failed to load review item", reviewError.message);
  }

  if (!reviewItem) {
    return errorResponse(404, "not_found", "Review item not found");
  }

  const previousValue = { reviewItem };
  if (TERMINAL_STATUSES.includes(reviewItem.status as typeof TERMINAL_STATUSES[number])) {
    return errorResponse(409, "already_resolved", "Review item is already resolved", {
      status: reviewItem.status,
    });
  }

  const claimResult = await claimReviewItem(client, reviewItem as ReviewItem, params);
  if (claimResult instanceof Response) return claimResult;

  const publicMutation = params.action === "approve"
    ? await approveReviewItem(client, reviewItem as ReviewItem)
    : await markCandidateStatus(client, reviewItem as ReviewItem, params.action);
  if (publicMutation instanceof Response) return publicMutation;

  const updates: Record<string, unknown> = params.action === "assign"
    ? { assigned_to: params.assignedTo, status: "assigned" }
    : { status: REVIEW_STATUS_BY_ACTION[params.action], resolved_at: new Date().toISOString() };

  const { data: updatedReviewItem, error: updateError } = await client
    .from("review_items")
    .update(updates)
    .eq("id", params.reviewItemId)
    .select("id, item_type, item_id, status, assigned_to, resolved_at")
    .single();

  if (updateError) {
    return errorResponse(500, "db_error", "Failed to update review item", updateError.message);
  }

  const auditResult = await writeAuditLog(client, {
    action: params.action,
    actorUserId: params.actor.user_id,
    comment: params.comment || null,
    idempotencyKey: params.idempotencyKey,
    newValue: {
      reviewItem: updatedReviewItem,
      publicMutation,
      assignedTo: params.assignedTo || null,
    },
    previousValue,
    reviewItemId: params.reviewItemId,
  });
  if (auditResult instanceof Response) return auditResult;

  return {
    accepted: true,
    action: params.action,
    reviewItemId: params.reviewItemId,
    auditLogId: auditResult.id,
    idempotencyKey: params.idempotencyKey,
    publicMutation,
  };
}

async function findExistingAudit(
  client: SupabaseClient,
  params: { action: ReviewAction; idempotencyKey: string; reviewItemId: string },
): Promise<{ id: string } | null | Response> {
  const { data, error } = await client
    .from("admin_audit_logs")
    .select("id")
    .eq("object_type", "review_item")
    .eq("object_id", params.reviewItemId)
    .eq("action", params.action)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (error) {
    return errorResponse(500, "db_error", "Failed to check idempotency key", error.message);
  }

  return data as { id: string } | null;
}

async function claimReviewItem(
  client: SupabaseClient,
  reviewItem: ReviewItem,
  params: { action: ReviewAction; actor: AdminUser; assignedTo: string; reviewItemId: string },
): Promise<ReviewItem | Response> {
  const updates = params.action === "assign"
    ? { assigned_to: params.assignedTo, status: "assigned" }
    : { assigned_to: params.actor.user_id, status: "assigned" };

  const { data, error } = await client
    .from("review_items")
    .update(updates)
    .eq("id", params.reviewItemId)
    .eq("status", reviewItem.status)
    .select("id, item_type, item_id, status, assigned_to, resolved_at")
    .maybeSingle();

  if (error) {
    return errorResponse(500, "db_error", "Failed to claim review item", error.message);
  }

  if (!data) {
    return errorResponse(409, "already_resolved", "Review item changed before action could be applied");
  }

  return data as ReviewItem;
}

async function approveReviewItem(client: SupabaseClient, reviewItem: ReviewItem): Promise<unknown | Response> {
  if (reviewItem.item_type !== "product_candidate") {
    return {
      applied: "review_status_only",
      reason: `approval for ${reviewItem.item_type} does not publish product data`,
    };
  }

  const { data: candidate, error: candidateError } = await client
    .from("product_candidates")
    .select([
      "id",
      "source_id",
      "source_product_id",
      "source_url",
      "brand_name",
      "product_name",
      "category",
      "description",
      "price_krw",
      "source_price",
      "source_currency",
      "image_urls",
    ].join(", "))
    .eq("id", reviewItem.item_id)
    .single();

  if (candidateError) {
    return errorResponse(500, "db_error", "Failed to load product candidate", candidateError.message);
  }

  const productCandidate = candidate as ProductCandidate;
  if (!productCandidate.brand_name) {
    return errorResponse(409, "approval_validation_error", "Product candidate requires brand_name before approval");
  }

  const brandResult = await findOrCreateBrand(client, productCandidate.brand_name);
  if (brandResult instanceof Response) return brandResult;

  const existingProductId = await findExistingProductId(client, productCandidate);
  if (existingProductId instanceof Response) return existingProductId;

  const productPayload = {
    brand_id: brandResult.id,
    name: productCandidate.product_name,
    slug: uniqueSlug(productCandidate.product_name, productCandidate.id),
    category: productCandidate.category,
    description: productCandidate.description,
    price_krw: productCandidate.price_krw,
    currency: "KRW",
    status: "published",
    primary_image_url: productCandidate.image_urls[0] ?? null,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const productResult = existingProductId
    ? await client.from("products").update(productPayload).eq("id", existingProductId).select("id").single()
    : await client.from("products").insert(productPayload).select("id").single();

  if (productResult.error) {
    return errorResponse(500, "db_error", "Failed to publish product candidate", productResult.error.message);
  }

  const productId = productResult.data.id as string;
  const sourceResult = await ensureProductSource(client, productId, productCandidate);
  if (sourceResult instanceof Response) return sourceResult;

  const imageResult = await ensureProductImages(client, productId, productCandidate.image_urls);
  if (imageResult instanceof Response) return imageResult;

  const { error: candidateUpdateError } = await client
    .from("product_candidates")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", productCandidate.id);

  if (candidateUpdateError) {
    return errorResponse(500, "db_error", "Failed to mark product candidate approved", candidateUpdateError.message);
  }

  return {
    applied: existingProductId ? "updated_product" : "created_product",
    productId,
    candidateId: productCandidate.id,
  };
}

async function markCandidateStatus(
  client: SupabaseClient,
  reviewItem: ReviewItem,
  action: ReviewAction,
): Promise<unknown | Response> {
  if (reviewItem.item_type !== "product_candidate" || action === "assign") {
    return { applied: "review_status_only" };
  }

  const candidateStatus = action === "block" ? "blocked" : "rejected";
  const { error } = await client
    .from("product_candidates")
    .update({ status: candidateStatus, updated_at: new Date().toISOString() })
    .eq("id", reviewItem.item_id);

  if (error) {
    return errorResponse(500, "db_error", "Failed to update product candidate status", error.message);
  }

  return { applied: "updated_candidate_status", candidateStatus };
}

async function findOrCreateBrand(client: SupabaseClient, brandName: string): Promise<{ id: string } | Response> {
  const slug = slugify(brandName);
  const { data: existingBrand, error: findError } = await client
    .from("brands")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (findError) {
    return errorResponse(500, "db_error", "Failed to find brand", findError.message);
  }

  if (existingBrand) return existingBrand as { id: string };

  const { data: newBrand, error: insertError } = await client
    .from("brands")
    .insert({ name: brandName, slug })
    .select("id")
    .single();

  if (insertError) {
    return errorResponse(500, "db_error", "Failed to create brand", insertError.message);
  }

  return newBrand as { id: string };
}

async function findExistingProductId(
  client: SupabaseClient,
  candidate: ProductCandidate,
): Promise<string | null | Response> {
  if (candidate.source_product_id) {
    const { data: sourceProductMatch, error: sourceProductError } = await client
      .from("product_sources")
      .select("product_id")
      .eq("ingestion_source_id", candidate.source_id)
      .eq("source_product_id", candidate.source_product_id)
      .limit(1)
      .maybeSingle();

    if (sourceProductError) {
      return errorResponse(500, "db_error", "Failed to find existing product source", sourceProductError.message);
    }

    if (sourceProductMatch?.product_id) return sourceProductMatch.product_id;
  }

  const { data, error } = await client
    .from("product_sources")
    .select("product_id")
    .eq("source_url", candidate.source_url)
    .eq("ingestion_source_id", candidate.source_id)
    .limit(1)
    .maybeSingle();

  if (error) {
    return errorResponse(500, "db_error", "Failed to find existing product source", error.message);
  }

  return data?.product_id ?? null;
}

async function ensureProductSource(
  client: SupabaseClient,
  productId: string,
  candidate: ProductCandidate,
): Promise<unknown | Response> {
  const { data: existingSource, error: findError } = await client
    .from("product_sources")
    .select("id")
    .eq("product_id", productId)
    .eq("source_url", candidate.source_url)
    .limit(1)
    .maybeSingle();

  if (findError) {
    return errorResponse(500, "db_error", "Failed to find product source", findError.message);
  }

  if (existingSource) return { productSourceId: existingSource.id, reused: true };

  const { data: productSource, error: insertError } = await client
    .from("product_sources")
    .insert({
      product_id: productId,
      ingestion_source_id: candidate.source_id,
      source_product_id: candidate.source_product_id,
      source_url: candidate.source_url,
      source_price: candidate.source_price,
      source_currency: candidate.source_currency,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    return errorResponse(500, "db_error", "Failed to create product source", insertError.message);
  }

  return { productSourceId: productSource.id, reused: false };
}

async function ensureProductImages(
  client: SupabaseClient,
  productId: string,
  imageUrls: string[],
): Promise<unknown | Response> {
  const primaryUrls = imageUrls.slice(0, 8).filter(Boolean);
  for (const [position, sourceUrl] of primaryUrls.entries()) {
    const { data: existingImage, error: findError } = await client
      .from("product_images")
      .select("id")
      .eq("product_id", productId)
      .eq("source_url", sourceUrl)
      .limit(1)
      .maybeSingle();

    if (findError) {
      return errorResponse(500, "db_error", "Failed to find product image", findError.message);
    }

    if (existingImage) continue;

    const { error: insertError } = await client
      .from("product_images")
      .insert({ product_id: productId, source_url: sourceUrl, position });

    if (insertError) {
      return errorResponse(500, "db_error", "Failed to create product image", insertError.message);
    }
  }

  return { imageCount: primaryUrls.length };
}

async function writeAuditLog(
  client: SupabaseClient,
  params: {
    action: ReviewAction;
    actorUserId: string;
    comment: string | null;
    idempotencyKey: string;
    newValue: unknown;
    previousValue: unknown;
    reviewItemId: string;
  },
): Promise<{ id: string } | Response> {
  const { data, error } = await client
    .from("admin_audit_logs")
    .insert({
      actor_user_id: params.actorUserId,
      action: params.action,
      object_type: "review_item",
      object_id: params.reviewItemId,
      previous_value: params.previousValue,
      new_value: params.newValue,
      comment: params.comment,
      idempotency_key: params.idempotencyKey,
    })
    .select("id")
    .single();

  if (error) {
    return errorResponse(500, "db_error", "Failed to write audit log", error.message);
  }

  return data as { id: string };
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

function uniqueSlug(value: string, id: string): string {
  return `${slugify(value)}-${id.slice(0, 8)}`;
}
