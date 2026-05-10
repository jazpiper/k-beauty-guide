# API Contract

> 작성일: 2026-05-01  
> 상태: MVP 계약 초안 + 일부 구현 반영  
> 대상: Vercel Web/Admin App + Supabase Postgres/Auth/Edge Functions

## 1. 목적

이 문서는 K-Beauty Guide의 프론트엔드, 관리자 콘솔, Supabase Edge Functions, 크롤러/분석 worker가 공유할 API 계약을 정의한다.

현재 목표는 구현 상세를 고정하는 것이 아니라, 다음 구현 단계에서 흔들리면 안 되는 logical endpoint, payload shape, 권한 경계, 에러 형식을 정하는 것이다. 실제 구현에서는 Supabase SDK, PostgREST view, RPC, Edge Function을 조합한다.

## 2. API 설계 원칙

- 공개 read는 가능한 한 Supabase RLS가 적용된 view/table read로 처리한다.
- 관리자 action, 승인/반려, source 제어, 재분석 실행은 Edge Function 또는 RPC로 감싼다.
- 브라우저에는 service role key를 절대 노출하지 않는다.
- raw snapshot, crawl task, AI run detail은 admin/service 영역으로 제한한다.
- 제품 공개 데이터와 검수 중 candidate 데이터는 endpoint 수준에서도 분리한다.
- LLM/AI 결과는 suggestion으로만 반환하고, public safety flag는 rule engine 결과만 노출한다.
- 모든 mutation은 audit log에 남길 수 있는 `actor`, `action`, `target`, `comment`를 포함한다.
- API는 idempotency와 retry를 고려한다.

## 3. Runtime Mapping

| API Surface | Implementation Direction | Auth |
|---|---|---|
| Public catalog read | Supabase table/view read through client SDK | anon or user |
| Public ingredient search | Supabase view/RPC | anon or user |
| Ingredient text analysis | Edge Function `analyze-ingredient-text` | anon or user, rate-limited |
| User sensitivity profile | Supabase table/RPC with RLS | authenticated user |
| Admin review actions | Edge Function `admin-review-action` | admin JWT |
| Admin source management | Target Edge Function `admin-source-action` (not implemented yet) | `super_admin` |
| Product ingestion worker | Edge Function or external worker using service role | service role |
| Safety re-analysis worker | Edge Function or worker using service role | service role |

### 3.1 Current Implementation Snapshot

| Surface | Current state |
|---|---|
| Product list | Implemented via `v_public_products` + frontend static fallback |
| Product detail | Implemented via `get_public_product_detail(product_slug)` + frontend static fallback |
| Product safety report | Embedded in product detail RPC as `safetyReport`; standalone RPC is documented but not implemented |
| Ingredient list | Implemented via `v_public_ingredients` + frontend static fallback |
| Ingredient text analysis | Implemented as MVP `analyze-ingredient-text` parser/matcher + frontend local fallback |
| Admin/worker endpoints | Edge Function shells exist; full operational verification still requires Supabase local/hosted runtime |

## 4. Shared Conventions

### 4.1 Response Envelope

Read endpoints may return raw typed data when using Supabase SDK. Edge Functions should use a consistent envelope.

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: {
    requestId: string;
    pagination?: PaginationMeta;
  };
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
  };
};
```

### 4.2 Pagination

```ts
type PaginationParams = {
  limit?: number; // default 24, max 100
  cursor?: string;
};

type PaginationMeta = {
  nextCursor?: string;
  hasMore: boolean;
  limit: number;
};
```

Cursor는 `created_at + id`, `published_at + id`, 또는 search rank 기반으로 구현한다. Offset pagination은 관리자 table처럼 데이터량이 적은 화면에서만 허용한다.

### 4.3 Common Error Codes

| Code | Meaning |
|---|---|
| `unauthorized` | 로그인 필요 |
| `forbidden` | 역할 또는 RLS 정책상 접근 불가 |
| `not_found` | 대상 없음 또는 권한상 보이지 않음 |
| `validation_error` | payload 형식/필수값 오류 |
| `conflict` | 중복, stale status, 이미 처리된 review item |
| `rate_limited` | public analyzer 또는 worker 호출 제한 |
| `source_paused` | source pause 상태라 crawl 작업 불가 |
| `analysis_failed` | safety/parser/AI 분석 실패 |
| `internal_error` | 예외 |

### 4.4 Audit Metadata

관리자 mutation은 아래 metadata를 받는다.

```ts
type AdminActionContext = {
  comment?: string;
  reasonCode?: string;
  idempotencyKey?: string;
};
```

High-impact action은 `comment`를 필수로 둔다.

## 5. Public Product API

### 5.1 List Products

Logical endpoint:

```text
GET /products
```

Implementation:

- Supabase view: `v_public_products`
- RLS: published products only

Query:

```ts
type ProductListQuery = {
  q?: string;
  brandSlug?: string;
  category?: string;
  ingredientId?: string;
  sort?: "newest" | "name";
  limit?: number;
  cursor?: string;
};
```

User-specific avoid/sensitivity filtering is not sent to this endpoint in MVP. The client fetches public products and applies LocalStorage-based overlays locally until account-backed consent and deletion flows are implemented.

Response:

```ts
type ProductListItem = {
  id: string;
  slug: string;
  brand: {
    id: string;
    name: string;
    slug: string;
  };
  name: string;
  category: string | null;
  priceKrw: number | null;
  currency: string | null;
  primaryImageUrl: string | null;
  safetySummary: {
    highestSeverity: "info" | "caution" | "avoid_if_sensitive" | "restricted" | null;
    flagCount: number;
  };
  publishedAt: string;
};
```

### 5.2 Get Product Detail

Logical endpoint:

```text
GET /products/:slug
```

Implementation:

- Supabase RPC: `get_public_product_detail(product_slug text)`

Response:

```ts
type ProductDetail = {
  id: string;
  slug: string;
  brand: {
    id: string;
    name: string;
    slug: string;
    officialUrl?: string;
  };
  name: string;
  category: string | null;
  description: string | null;
  priceKrw: number | null;
  currency: string | null;
  primaryImageUrl: string | null;
  images: ProductImage[];
  ingredients: ProductIngredientPublic[];
  safetyReport: ProductSafetyReport;
  sources: PublicProductSource[];
  publishedAt: string;
  updatedAt: string;
};
```

```ts
type ProductImage = {
  storagePath: string | null;
  sourceUrl: string | null;
  altText: string | null;
  position: number;
};

type PublicProductSource = {
  sourceUrl: string;
  sourceProductId: string | null;
  sourcePrice: number | null;
  sourceCurrency: string | null;
  lastSeenAt: string | null;
};

type ProductIngredientPublic = {
  position: number;
  ingredientId: string | null;
  displayName: string;
  inciName?: string;
  koreanName?: string;
  reviewStatus: "matched" | "under_review";
};
```

Public UI should not expose raw admin-only confidence explanations, exact parser internals, or unmatched raw names. When an ingredient is not reviewed yet, return `ingredientId = null`, `displayName = "Ingredient under review"`, and `reviewStatus = "under_review"`.

### 5.3 Get Product Safety Report

Logical endpoint:

```text
GET /products/:slug/safety-report
```

Implementation:

- Supabase RPC: `get_public_product_safety_report(product_slug text)`
- Optional user overlay is computed client-side in MVP when using LocalStorage profile.

Current implementation note: standalone `get_public_product_safety_report` is not in migrations yet. The public app currently reads safety report data through `get_public_product_detail(product_slug).safetyReport`.

Response:

```ts
type ProductSafetyReport = {
  productId: string;
  generatedAt: string | null;
  ingredientCount: number;
  unmatchedIngredientCount: number;
  flags: ProductSafetyFlagPublic[];
};

type ProductSafetyFlagPublic = {
  id: string;
  ingredientId: string | null;
  ingredientName: string | null;
  severity: "info" | "caution" | "avoid_if_sensitive" | "restricted";
  title: string;
  whyItMatters: string;
  whoShouldCare: string;
  recommendation: string;
  sourceLabel: string | null;
  sourceRegion: "KR" | "EU" | "US" | "global" | null;
  sourceUrl: string | null;
};
```

## 6. Public Ingredient API

### 6.1 Search Ingredients

Logical endpoint:

```text
GET /ingredients
```

Implementation:

- Supabase view: `v_public_ingredients`
- Search by canonical name, INCI name, Korean name, and public aliases

Query:

```ts
type IngredientSearchQuery = {
  q?: string;
  functionTag?: string;
  benefitTag?: string;
  riskType?: string;
  limit?: number;
  cursor?: string;
};
```

Response:

```ts
type IngredientListItem = {
  id: string;
  canonicalName: string;
  inciName: string | null;
  koreanName: string | null;
  definition: string;
  functionTags: string[];
  benefitTags: string[];
  safetySignalCount: number;
};
```

### 6.2 Get Ingredient Detail

Logical endpoint:

```text
GET /ingredients/:id
```

Implementation:

- Edge Function or private-schema RPC assembled server-side, returning sanitized public fields only.
- Public users must not read raw `ingredient_evidence` or `ingredient_safety_rules` tables directly.
- If implemented as a view over already-public rows, use `security_invoker = true`; if it aggregates private rule/evidence rows, use a sanitized server-side RPC/definer view with a fixed `search_path`.

Response:

```ts
type IngredientDetail = IngredientListItem & {
  aliases: {
    alias: string;
    language: "ko" | "en" | "inci" | "cas" | "synonym";
  }[];
  evidence: {
    sourceName: string;
    sourceRegion: "KR" | "EU" | "US" | "global" | null;
    claimType: string;
    excerptSummary: string;
    sourceUrl: string | null;
  }[];
  safetyRules: {
    ruleType: string;
    severity: "info" | "caution" | "avoid_if_sensitive" | "restricted";
    title: string;
    recommendation: string;
  }[];
};
```

### 6.3 Analyze Ingredient Text

Logical endpoint:

```text
POST /ingredients/analyze-text
```

Implementation:

- Edge Function: `analyze-ingredient-text`
- Does not persist scan history in MVP
- Rate limit is still pending; request shape is constrained and no raw input is persisted

Request:

```ts
type AnalyzeIngredientTextRequest = {
  ingredientText: string; // plain text, max 10,000 characters
  languageHint?: "ko" | "en" | "mixed";
};
```

Validation:

- Reject empty input.
- Reject input longer than 10,000 characters.
- Treat pasted HTML as text; do not fetch URLs or render remote content.
- Do not persist raw analyzer input in MVP.
- Do not accept allergy/sensitivity profile data in this request. User-specific highlighting is computed client-side from LocalStorage after the public analysis response returns.

Response:

```ts
type AnalyzeIngredientTextResponse = {
  parsedIngredients: {
    position: number;
    rawName: string;
    ingredientId: string | null;
    displayName: string;
    matchMethod: "exact" | "normalized" | "alias" | "cas" | "manual" | "unmatched";
    confidence: number;
  }[];
  flags: ProductSafetyFlagPublic[];
  unmatchedCount: number;
  disclaimer: string;
};
```

Safety rule output must use the same language policy as product detail: explainable, conditional, and non-diagnostic.

Implementation status: `analyze-ingredient-text` is implemented as an MVP parser/matcher. It accepts only `ingredientText`, rejects public profile/allergy fields, splits comma/semicolon-separated labels, matches exact normalized aliases from Supabase, and returns active rule flags. Rate limiting, scan history persistence, user-specific sensitivity profiles, broad fuzzy matching, and OCR are outside this endpoint.

## 7. User API

MVP can start with LocalStorage for sensitivity profile. Account-backed APIs should be enabled only after consent copy and deletion flow exist.

### 7.1 Get Sensitivity Profile

Logical endpoint:

```text
GET /me/sensitivity-profile
```

Auth:

- authenticated user
- RLS: own row only

Response:

```ts
type SensitivityProfile = {
  userId: string;
  skinType: "dry" | "oily" | "combo" | "sensitive" | "normal" | null;
  sensitivityLevel: "low" | "medium" | "high" | null;
  consentVersion: string | null;
  avoidIngredients: {
    ingredientId: string;
    canonicalName: string;
    reason?: "allergy" | "sensitivity" | "preference";
  }[];
  avoidCategories: {
    category: string;
    reason?: "allergy" | "sensitivity" | "preference";
  }[];
};
```

### 7.2 Update Sensitivity Profile

Logical endpoint:

```text
PUT /me/sensitivity-profile
```

Request:

```ts
type UpdateSensitivityProfileRequest = {
  skinType?: "dry" | "oily" | "combo" | "sensitive" | "normal" | null;
  sensitivityLevel?: "low" | "medium" | "high" | null;
  consentVersion: string;
  avoidIngredientIds: string[];
  avoidCategories: string[];
};
```

Behavior:

- Replace current avoid list with submitted list.
- Reject if `consentVersion` is missing.
- Keep admin access minimal and audited.

### 7.3 Delete Sensitivity Profile

Logical endpoint:

```text
DELETE /me/sensitivity-profile
```

Behavior:

- Delete `user_avoid_ingredients` rows for the user.
- Clear sensitivity fields and `consentVersion` on `user_profiles`, or delete the profile row if no other profile data is needed.
- Revoke consent for future account-backed sensitivity storage.
- Return an audit-safe confirmation without echoing deleted sensitive values.

### 7.4 Favorites

Logical endpoints:

```text
GET /me/favorites
POST /me/favorites
DELETE /me/favorites/:productId
```

Favorites are not sensitive like allergy data, but still user-private.

## 8. Admin Review API

Admin endpoints are implemented as Edge Functions or RPCs because they trigger multiple table writes and audit logs.

### 8.1 List Review Items

Logical endpoint:

```text
GET /admin/review-items
```

Auth:

- `reviewer`, `ingredient_editor`, `safety_rule_admin`, or `super_admin`

Query:

```ts
type ReviewItemQuery = {
  itemType?: "product_candidate" | "product_update" | "ingredient_match" | "safety_rule_change" | "restricted_signal" | "evidence_update" | "copy_review" | "ingestion_alert";
  status?: "open" | "assigned" | "approved" | "rejected" | "blocked";
  priority?: "low" | "normal" | "high" | "urgent";
  assignedTo?: string;
  sourceId?: string;
  limit?: number;
  cursor?: string;
};
```

Response:

```ts
type ReviewItemListItem = {
  id: string;
  itemType: string;
  itemId: string;
  title: string;
  status: string;
  priority: string;
  reason: string;
  reasonCodes: string[];
  sourceId?: string;
  sourceName?: string;
  confidenceScore?: number;
  requiresSecondReview?: boolean;
  secondReviewStatus?: "not_required" | "pending" | "approved" | "rejected";
  assignedTo?: string;
  createdAt: string;
};
```

### 8.2 Get Review Item Detail

Logical endpoint:

```text
GET /admin/review-items/:id
```

Response shape depends on `itemType`, but should always include:

```ts
type ReviewItemDetail<TTarget> = {
  reviewItem: ReviewItemListItem;
  target: TTarget;
  evidence: ReviewEvidence[];
  automationNotes: AutomationNote[];
  allowedActions: string[];
  auditLog: AdminAuditLogItem[];
};
```

### 8.3 Review Actions

Logical endpoint:

```text
POST /admin/review-items/:id/action
```

Request:

```ts
type ReviewActionRequest =
  | {
      action: "approve";
      comment: string;
      idempotencyKey: string;
    }
  | {
      action: "reject";
      comment: string;
      idempotencyKey: string;
    }
  | {
      action: "block";
      comment: string;
      idempotencyKey: string;
    }
  | {
      action: "assign";
      assignedTo: string;
      comment?: string;
      idempotencyKey: string;
    };
```

Behavior:

- Validate role based on `itemType`.
- Reject stale actions if review item is already resolved.
- Require `comment` for every approval. High-risk item types such as `safety_rule_change`, `restricted_signal`, and `evidence_update` may move to `assigned` or `blocked` until second review is complete.
- Write `admin_audit_logs`.
- Trigger follow-up jobs when needed, such as safety re-analysis after ingredient match approval.

### 8.4 List Audit Logs

Logical endpoint:

```text
GET /admin/audit-logs
```

Auth:

- `super_admin` can view all audit logs.
- Other admin roles can view logs related to objects they can manage.

Query:

```ts
type AuditLogQuery = {
  objectType?: string;
  objectId?: string;
  actorUserId?: string;
  action?: string;
  limit?: number;
  cursor?: string;
};
```

Response:

```ts
type AdminAuditLogItem = {
  id: string;
  actorUserId: string;
  action: string;
  objectType: string;
  objectId: string;
  previousValue?: unknown;
  newValue?: unknown;
  comment?: string;
  createdAt: string;
};
```

## 9. Admin Product Candidate API

### 9.1 Get Product Candidate

Logical endpoint:

```text
GET /admin/product-candidates/:id
```

Response:

```ts
type ProductCandidateDetail = {
  candidate: {
    id: string;
    sourceId: string;
    snapshotId: string;
    sourceProductId: string | null;
    sourceUrl: string;
    brandName: string | null;
    productName: string;
    category: string | null;
    sourcePrice: number | null;
    sourceCurrency: string | null;
    priceKrw: number | null;
    imageUrls: string[];
    description: string | null;
    claims: string[];
    ingredientTextRaw: string | null;
    confidenceScore: number;
    status: "new" | "reviewing" | "approved" | "rejected" | "merged";
  };
  duplicateSuggestions: DuplicateSuggestion[];
  fieldSuggestions: FieldExtractionSuggestion[];
  ingredientPreview: ProductIngredientPublic[];
  safetyPreview: ProductSafetyFlagPublic[];
  rawSnapshot: RawSnapshotSummary;
};
```

### 9.2 Update Product Candidate Fields

Logical endpoint:

```text
PATCH /admin/product-candidates/:id
```

Request:

```ts
type UpdateProductCandidateRequest = {
  brandName?: string | null;
  productName?: string;
  category?: string | null;
  sourcePrice?: number | null;
  sourceCurrency?: string | null;
  priceKrw?: number | null;
  imageUrls?: string[];
  description?: string | null;
  claims?: string[];
  ingredientTextRaw?: string | null;
  comment?: string;
};
```

Behavior:

- Save edit to candidate only.
- Do not publish directly.
- Re-run ingredient preview if `ingredientTextRaw` changes.
- Write audit log.

### 9.3 Approve Candidate as Product

Logical endpoint:

```text
POST /admin/product-candidates/:id/approve
```

Request:

```ts
type ApproveProductCandidateRequest = {
  mode: "new_product";
  finalFields?: UpdateProductCandidateRequest;
  comment: string;
  idempotencyKey: string;
};
```

Behavior:

- Create or link `brands`.
- Create `products` with `status = 'published'` and set `published_at` in MVP.
- Create `product_sources`.
- Import images as needed.
- Parse and store `product_ingredients`.
- Queue safety analysis.
- Mark candidate `approved`.
- Resolve related review item.

MVP default still requires explicit admin action before public publication.
Post-MVP can add a separate `review` to `published` transition if publication needs a second approver.

### 9.4 Merge Candidate into Existing Product

Logical endpoint:

```text
POST /admin/product-candidates/:id/merge
```

Request:

```ts
type MergeProductCandidateRequest = {
  productId: string;
  fieldsToUpdate: ("name" | "category" | "description" | "primaryImageUrl" | "ingredients" | "sources")[];
  comment: string;
  idempotencyKey: string;
};
```

Behavior:

- Update selected fields only.
- Add or refresh `product_sources`.
- Re-run safety analysis if ingredients changed.
- Mark duplicate suggestions accepted/rejected as appropriate.
- Write audit log.

## 10. Admin Ingredient and Safety API

### 10.1 Resolve Ingredient Match

Logical endpoint:

```text
POST /admin/ingredient-matches/resolve
```

Request:

```ts
type ResolveIngredientMatchRequest = {
  productIngredientId: string;
  action: "match_existing" | "create_alias" | "create_new_ingredient" | "mark_unmatched";
  ingredientId?: string;
  alias?: {
    alias: string;
    language: "ko" | "en" | "inci" | "cas" | "synonym";
    confidence: number;
  };
  newIngredient?: {
    canonicalName: string;
    inciName?: string;
    koreanName?: string;
    definition?: string;
  };
  comment: string;
  idempotencyKey: string;
};
```

Behavior:

- Update `product_ingredients`.
- Create alias or ingredient if requested.
- Queue product safety re-analysis.
- Resolve related review item if present.
- Write audit log.

### 10.2 List Safety Rules

Logical endpoint:

```text
GET /admin/safety-rules
```

Query:

```ts
type SafetyRuleQuery = {
  ruleType?: string;
  severity?: string;
  active?: boolean;
  ingredientId?: string;
  limit?: number;
  cursor?: string;
};
```

### 10.3 Create or Update Safety Rule

Logical endpoints:

```text
POST /admin/safety-rules
PATCH /admin/safety-rules/:id
```

Request:

```ts
type UpsertSafetyRuleRequest = {
  ingredientId?: string | null;
  ruleType: string;
  severity: "info" | "caution" | "avoid_if_sensitive" | "restricted";
  condition: Record<string, unknown>;
  title: string;
  whyItMatters: string;
  whoShouldCare: string;
  recommendation: string;
  evidenceId?: string | null;
  active: boolean;
  comment: string;
  idempotencyKey: string;
};
```

Behavior:

- High-impact changes create `review_items.item_type = safety_rule_change`.
- `restricted` severity requires `safety_rule_admin` or `super_admin`.
- Publishing a rule should queue affected product re-analysis.

### 10.4 Preview Safety Rule Impact

Logical endpoint:

```text
POST /admin/safety-rules/preview-impact
```

Request:

```ts
type PreviewSafetyRuleImpactRequest = {
  ruleDraft: UpsertSafetyRuleRequest;
  sampleLimit?: number;
};
```

Response:

```ts
type SafetyRuleImpactPreview = {
  affectedProductCountEstimate: number;
  sampleProducts: {
    productId: string;
    productName: string;
    brandName: string;
    currentFlags: ProductSafetyFlagPublic[];
    proposedFlags: ProductSafetyFlagPublic[];
  }[];
};
```

## 11. Admin Source and Ingestion API

### 11.1 List Sources

Logical endpoint:

```text
GET /admin/ingestion-sources
```

Response:

```ts
type IngestionSourceListItem = {
  id: string;
  name: string;
  sourceType: "brand_official" | "commerce" | "partner_feed" | "manual";
  baseUrl: string | null;
  crawlStrategy: "sitemap" | "html_list" | "json_api" | "rss" | "manual_upload";
  enabled: boolean;
  lastCheckedAt: string | null;
  allowedPaths: string[];
  blockedPaths: string[];
  minDelayMs: number;
  maxPagesPerRun: number;
  userAgentLabel: string;
  pauseOnStatuses: number[];
  pauseOnChallenge: boolean;
  snapshotRetentionDays: number;
  pausedAt: string | null;
  pauseReason: string | null;
  pausedUntil: string | null;
  rateLimitPerMinute: number;
  health: "ok" | "paused" | "failing" | "never_run";
};
```

### 11.2 Create or Update Source

Logical endpoints:

```text
POST /admin/ingestion-sources
PATCH /admin/ingestion-sources/:id
```

Auth:

- `super_admin`

Request:

```ts
type UpsertIngestionSourceRequest = {
  name: string;
  sourceType: "brand_official" | "commerce" | "partner_feed" | "manual";
  baseUrl?: string | null;
  crawlStrategy: "sitemap" | "html_list" | "json_api" | "rss" | "manual_upload";
  allowedPaths: string[];
  blockedPaths: string[];
  robotsPolicyNotes?: string;
  rateLimitPerMinute: number;
  minDelayMs: number;
  maxPagesPerRun: number;
  userAgentLabel: string;
  pauseOnStatuses: number[];
  pauseOnChallenge: boolean;
  snapshotRetentionDays: number;
  enabled: boolean;
  comment: string;
  idempotencyKey: string;
};
```

`json_api` means documented public APIs or partner feeds only. It must not mean reverse-engineered private storefront APIs.

### 11.3 Source Control Actions

Logical endpoint:

```text
POST /admin/ingestion-sources/:id/action
```

Request:

```ts
type SourceActionRequest = {
  action: "enable" | "disable" | "pause" | "resume" | "enqueue_discovery";
  comment: string;
  idempotencyKey: string;
};
```

Behavior:

- `enable` should require policy review.
- `enqueue_discovery` creates limited `crawl_tasks`.
- No action performs immediate large crawl.

### 11.4 Manual Product Import

Logical endpoint:

```text
POST /admin/imports/products
```

Implementation:

- Upload CSV/JSON to Supabase Storage
- Create `crawl_tasks` or direct import tasks through `manual-import` connector

Request:

```ts
type ManualProductImportRequest = {
  storagePath: string;
  sourceId: string;
  importFormat: "csv" | "json";
  dryRun: boolean;
  comment: string;
  idempotencyKey: string;
};
```

Response:

```ts
type ManualProductImportResponse = {
  importId: string;
  dryRun: boolean;
  candidateCount: number;
  validationErrors: {
    row: number;
    field: string;
    message: string;
  }[];
};
```

## 12. Worker/Internal API

Internal APIs are not callable from the browser. They use service role credentials inside Supabase scheduled functions or trusted external workers.

### 12.1 Claim Crawl Tasks

Logical endpoint:

```text
POST /internal/crawl-tasks/claim
```

Request:

```ts
type ClaimCrawlTasksRequest = {
  workerId: string;
  sourceId?: string;
  taskTypes?: ("discover_product_urls" | "fetch_product_detail" | "refresh_existing_product")[];
  limit: number;
  leaseSeconds?: number; // default 300, max 900
};
```

Response:

```ts
type ClaimCrawlTasksResponse = {
  tasks: (CrawlTask & {
    leaseToken: string;
    lockedUntil: string;
  })[];
};
```

Behavior:

- Atomically claim due `queued` tasks or expired `running` leases whose `locked_until < now()`.
- Set `status = 'running'`, `claimed_by`, `lease_token`, `locked_until`, `started_at`, and increment `attempt_count`.
- A worker must present the matching `leaseToken` when completing a task.

### 12.2 Complete Crawl Task

Logical endpoint:

```text
POST /internal/crawl-tasks/:id/complete
```

Request:

```ts
type CompleteCrawlTaskRequest =
  | {
      status: "succeeded";
      leaseToken: string;
      snapshotId?: string;
      candidateId?: string;
      discoveredUrls?: string[];
    }
  | {
      status: "failed" | "needs_review";
      leaseToken: string;
      errorCode: string;
      errorMessage: string;
      retryAfter?: string;
    };
```

Behavior:

- Store snapshot before candidate parsing where possible.
- Reject completion when the `leaseToken` does not match the active claim.
- Persist `errorCode` to `crawl_tasks.error_code` and `errorMessage` to `crawl_tasks.error_message`.
- If `retryAfter` is present and attempts remain, set `status = 'queued'`, persist `retryAfter` to `next_run_at`, and clear claim fields so the task can be claimed later.
- If no retry is scheduled, keep terminal `failed` or `needs_review` status and clear claim fields.
- Pause source on configured statuses or challenge signals.
- Create review item for parser failure, missing ingredients, or duplicate conflict.

### 12.3 Run AI Quality Step

Logical endpoint:

```text
POST /internal/product-candidates/:id/run-ai-quality
```

Behavior:

- Create/update `candidate_embeddings`.
- Create `duplicate_suggestions`.
- Optionally create `field_extraction_suggestions`.
- Log `ai_assessment_runs`.
- Never approve or publish product.

### 12.4 Run Safety Analysis

Logical endpoint:

```text
POST /internal/safety-analysis-runs/:id/execute
```

Behavior:

- Read product ingredients.
- Apply active safety rules.
- Write `product_safety_flags`.
- Mark run succeeded/failed.
- MVP execute-by-id is not a generic worker claim queue. It must atomically transition only a due `queued` run or an expired `running` lease to `running`, set lease fields, increment `attempt_count`, and clear the lease on completion.
- Failed runs with a retry schedule move back to `queued` with `next_run_at`; terminal failures remain `failed`.
- Do not call LLM for final safety classification.

## 13. Views and RPC Candidates

Recommended public views:

- `v_public_products`
- `v_public_ingredients`
- `v_public_product_safety_flags`

Recommended RPC/Edge Functions:

- `get_public_product_detail`
- `get_public_product_safety_report`
- `analyze-ingredient-text`
- `admin-review-action`
- `admin-product-candidate-action`
- `admin-ingredient-action`
- `admin-safety-rule-action`
- `admin-source-action`
- `run-product-ingestion-task`
- `run-ai-quality`
- `run-safety-analysis`

Implementation can collapse several admin actions into one Edge Function per domain to reduce deployment surface.

Public RPCs that read internal tables must return only sanitized fields, keep an explicit `status = 'published'` product filter, and set a fixed `search_path` when implemented as `security definer`.

## 14. Security Notes

- Browser uses anon key only.
- Authenticated user JWT is required for user-private data.
- Admin role should be represented in custom claims or an admin profile table checked by RPC/Edge Function.
- Service role is allowed only in server-side scheduled functions or trusted workers.
- Raw snapshots are admin-only and should be delivered through short-lived signed URLs or sanitized previews.
- Public text analyzer must be rate-limited and should not persist raw user input in MVP.
- Audit logs should capture actor, action, object type, object ID, previous value, new value, comment, and timestamp.

## 15. MVP Endpoint Set

MVP should implement this minimal set first.

Status note: this section is the target MVP endpoint set, not a claim that every endpoint below is fully implemented. Current implemented/shell status is summarized in [3.1 Current Implementation Snapshot](#31-current-implementation-snapshot).

Public:

- `GET /products`
- `GET /products/:slug`
- `GET /ingredients`
- `GET /ingredients/:id`
- `POST /ingredients/analyze-text`

Admin:

- `GET /admin/review-items`
- `GET /admin/review-items/:id`
- `POST /admin/review-items/:id/action`
- `GET /admin/audit-logs`
- `GET /admin/product-candidates/:id`
- `PATCH /admin/product-candidates/:id`
- `POST /admin/product-candidates/:id/approve`
- `POST /admin/product-candidates/:id/merge`
- `POST /admin/ingredient-matches/resolve`
- `GET /admin/safety-rules`
- `POST /admin/safety-rules`
- `PATCH /admin/safety-rules/:id`
- `POST /admin/safety-rules/preview-impact`
- `GET /admin/ingestion-sources`
- `POST /admin/ingestion-sources/:id/action`

Internal:

- `POST /internal/crawl-tasks/claim`
- `POST /internal/crawl-tasks/:id/complete`
- `POST /internal/product-candidates/:id/run-ai-quality`
- `POST /internal/safety-analysis-runs/:id/execute`

Account-backed user APIs can follow after consent copy is ready.

## 16. MVP Defaults

MVP defaults are defined in [MVP Backend Decision Record](../architecture/06-mvp-backend-decisions.md).

1. Public product detail is RPC/Edge Function centered with sanitized output.
2. Admin authorization uses an `admin_users` table or equivalent admin profile table as source of truth. JWT custom claims can be added later as optimization, but user-editable metadata must not authorize admin access.
3. Public ingredient text analyzer rate limit: anonymous 20 requests/hour/IP, authenticated 100 requests/hour/user, max 10,000 characters.
4. Raw snapshot preview is plain text preview + JSON tree only in MVP. Sanitized HTML preview is post-MVP.
