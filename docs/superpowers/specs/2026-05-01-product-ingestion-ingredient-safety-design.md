# Product Ingestion and Ingredient Safety Automation Design

> 문서 성격: 자동화 설계 아카이브/상세 참고. 현재 구현 상태와 결정값은 `docs/README.md`, `PLANNING.md`, `docs/architecture/06-mvp-backend-decisions.md`를 우선한다.

> Date: 2026-05-01  
> Status: Draft for review  
> Target stack: Vercel + Supabase

## 1. Purpose

K-Beauty Guide needs two automation capabilities:

1. Detect and ingest newly released K-beauty products from official brand pages, commerce pages, or partner feeds.
2. Parse cosmetic ingredient lists, normalize ingredient names, and show user-sensitive ingredient information such as fragrance allergens, preservative sensitizers, restricted-use warnings, and user-specific avoid flags.

The system should not claim that a product is universally "safe" or "unsafe." It should explain known ingredient signals, cite the rule/source behind each warning, and make conservative recommendations such as "check the label," "patch test," or "avoid if you have this sensitivity."

## 2. Recommended Approach

Use Supabase as the backend system of record and Vercel as the frontend/admin deployment platform.

Vercel should host:

- Public web app
- Admin review UI
- Lightweight API routes only when they are tightly coupled to frontend behavior

Supabase should own:

- Postgres database
- Auth and admin roles
- Storage for product images and raw crawl artifacts
- Edge Functions for ingestion, parsing, and API endpoints
- Cron for scheduled syncs
- Work tables for durable ingestion, review, and safety re-analysis jobs
- Row Level Security for user data and admin-only workflows

Crawler work should be split into small idempotent jobs. Do not run one large crawler that tries to process an entire source in a single invocation.

The detailed modular crawler and AI quality layer design is maintained in [Product Ingestion Pipeline](../../architecture/04-product-ingestion-pipeline.md). The detailed rule, evidence, and user sensitivity design is maintained in [Ingredient Safety Engine](../../architecture/05-ingredient-safety-engine.md).

## 3. High-Level Architecture

```text
Vercel App / Admin UI
        |
        v
Supabase Auth + Postgres + Storage
        |
        v
Supabase Cron
        |
        v
Queue: crawl_tasks
        |
        v
Crawler Edge Function or external worker
        |
        v
raw_product_snapshots
        |
        v
Product parser + ingredient normalizer
        |
        v
AI quality layer: duplicate and field suggestions
        |
        v
Review queue
        |
        v
Published product + ingredient safety output
```

The product ingestion pipeline and ingredient safety pipeline must remain separate. Product crawl failures should not block ingredient knowledge-base updates, and ingredient rule changes should be able to re-analyze existing products without re-crawling source pages.

## 4. Product Ingestion Pipeline

### 4.1 Source Registry

Maintain a source registry that describes where products come from and how each source should be processed.

Recommended fields:

- `id`
- `name`
- `source_type`: `brand_official`, `commerce`, `partner_feed`, `manual`
- `base_url`
- `crawl_strategy`: `sitemap`, `html_list`, `json_api`, `rss`, `manual_upload`
  - `json_api` means documented public APIs or partner feeds only. It must not mean reverse-engineered private storefront APIs.
- `allowed_paths`
- `robots_policy_notes`
- `rate_limit_per_minute`
- `enabled`
- `last_checked_at`
- `paused_at`
- `pause_reason`
- `paused_until`

MVP sources should be small and high-signal:

- 3-5 official brand sites
- 1 commerce/catalog source if terms allow
- Manual admin entry as a guaranteed fallback

### 4.2 Crawl Task Model

Every crawl should be represented as a task, not as a hidden background side effect.

Recommended task fields:

- `id`
- `source_id`
- `task_type`: `discover_product_urls`, `fetch_product_detail`, `refresh_existing_product`
- `target_url`
- `status`: `queued`, `running`, `succeeded`, `failed`, `needs_review`
- `attempt_count`
- `next_run_at`
- `error_message`
- `created_at`
- `started_at`
- `finished_at`

Each worker invocation should process a small number of tasks and then exit. This keeps the system compatible with serverless limits and makes failures easy to retry.

### 4.3 Raw Snapshot Storage

Store raw source evidence before parsing.

Recommended fields:

- `id`
- `source_id`
- `target_url`
- `content_type`: `html`, `json`, `text`, `image`
- `storage_path`
- `content_hash`
- `fetched_at`
- `http_status`
- `parser_version`

This allows the parser to improve over time without repeatedly hitting source websites.

### 4.4 Product Normalization

The parser should convert messy source data into a canonical product candidate.

Recommended normalized fields:

- `brand_name`
- `product_name`
- `category`
- `source_price`
- `source_currency`
- `price_krw`
- `image_urls`
- `description`
- `claims`
- `ingredient_text_raw`
- `source_url`
- `source_product_id`
- `release_detected_at`
- `confidence_score`

Products should enter a review queue when confidence is low, when ingredients are missing, or when deduplication is uncertain.

### 4.5 Deduplication

Deduplication should use deterministic matching first:

- Same brand + normalized product name
- Same source product ID
- Same canonical URL
- Same image hash or very similar title

Embedding similarity can be used to create duplicate suggestions after deterministic matching. Small LLM calls can help explain uncertain matches or propose field cleanup, but they must remain a suggestion layer and must not merge products automatically.

## 5. Ingredient Knowledge Base

The ingredient knowledge base is the core safety asset. It should be maintained independently of product crawling.

### 5.1 Core Ingredient Table

Recommended fields:

- `id`
- `canonical_name`
- `inci_name`
- `korean_name`
- `cas_number`
- `definition`
- `function_tags`: moisturizing, preservative, fragrance, colorant, uv_filter, exfoliant, etc.
- `benefit_tags`: hydration, brightening, soothing, barrier, acne_care, anti_aging, etc.
- `safety_notes`
- `source_status`: `verified`, `imported`, `manual_review`
- `updated_at`

### 5.2 Alias Table

Ingredient matching must support multiple naming systems.

Recommended fields:

- `ingredient_id`
- `alias`
- `language`: `ko`, `en`, `inci`, `cas`, `synonym`
- `source`
- `confidence`

Examples:

- `Centella Asiatica Extract`
- `병풀추출물`
- `Cica`
- `Madecassoside`

### 5.3 Source Evidence Table

Every sensitive ingredient classification should have a source.

Recommended fields:

- `id`
- `ingredient_id`
- `source_name`
- `source_url`
- `source_type`: `regulatory`, `association_dictionary`, `scientific_review`, `internal_rule`
- `source_date`
- `claim_type`: `name_standard`, `fragrance_allergen`, `restricted`, `prohibited`, `preservative_warning`, `usage_note`
- `excerpt_summary`

Primary source families:

- Korea Cosmetics Association ingredient dictionary for Korean standardized names
- MFDS regulations and guidance for Korean labeling and allergen notices
- EU CosIng and EU cosmetic regulation annexes for INCI, restricted substances, and fragrance allergen labeling
- FDA consumer guidance for common cosmetic allergen classes and fragrance-labeling limitations

## 6. Ingredient Parsing and Matching

### 6.1 Input

The parser accepts:

- Raw Korean ingredient text
- Raw English/INCI ingredient text
- Mixed-language ingredient text
- Admin-uploaded ingredient lists
- Label image recognition output only if a separate privacy/accuracy feasibility study approves it later

### 6.2 Processing

The parser should:

1. Normalize punctuation and separators.
2. Split ingredient strings into ordered items.
3. Remove obvious label boilerplate.
4. Match exact aliases.
5. Match normalized aliases after lowercasing, whitespace cleanup, and punctuation cleanup.
6. Flag unknown ingredients for review.
7. Preserve ingredient order.

Ingredient order should be displayed as "label order," not interpreted as exact concentration. The app can explain that ingredient lists often place higher-concentration ingredients earlier, but exact percentages are usually unavailable.

### 6.3 Output

Recommended parsed output:

- `product_id`
- `ingredient_id`
- `raw_name`
- `matched_name`
- `position`
- `match_method`: `exact`, `normalized`, `alias`, `cas`, `manual`, `unmatched`
- `confidence`

## 7. Safety and Allergy Rule Engine

The rule engine should produce explainable flags. It should not rely on LLM-only judgment.

This section is the compact design summary. The canonical detailed design is [Ingredient Safety Engine](../../architecture/05-ingredient-safety-engine.md).

### 7.1 Rule Types

Recommended rule categories:

- `fragrance_allergen`: individually listed fragrance allergens or fragrance-related sensitizers
- `fragrance_undisclosed`: generic `fragrance`, `parfum`, `향료`, or `aroma`
- `preservative_sensitizer`: ingredients such as methylisothiazolinone, methylchloroisothiazolinone, formaldehyde releasers
- `exfoliant_caution`: AHA, BHA, retinoids, or strong actives that may irritate sensitive skin
- `photosensitivity_caution`: ingredients where sun exposure guidance matters
- `restricted_or_prohibited`: jurisdiction-specific restriction or prohibition signal
- `user_avoid_match`: user explicitly wants to avoid the ingredient or alias

### 7.2 Risk Output Shape

Each warning shown to users should include:

- `severity`: `info`, `caution`, `avoid_if_sensitive`, `restricted`
- `title`
- `ingredient_name`
- `why_it_matters`
- `who_should_care`
- `recommendation`
- `source_label`
- `source_url`

Example:

```text
Linalool detected
Severity: avoid_if_sensitive
Why it matters: Linalool is a fragrance allergen labeling target in multiple cosmetic regulatory contexts.
Who should care: Users with fragrance sensitivity, allergic contact dermatitis history, or known linalool sensitivity.
Recommendation: Check the product label and patch test before use.
```

### 7.3 User Sensitivity Profile

The app can support user-specific ingredient filtering.

Recommended fields:

- `user_id`
- `skin_type`
- `known_allergies`
- `avoid_ingredients`
- `avoid_categories`: fragrance, essential_oils, alcohol, exfoliating_acids, retinoids, etc.
- `sensitivity_level`: `low`, `medium`, `high`
- `consent_version`
- `updated_at`

This data is sensitive preference/health-adjacent data. It should be private by default, protected by RLS, and deletable by the user.

## 8. Admin Review Workflow

Automation should create candidates. Admin review should decide publication.

Review queues:

- New product candidate
- Product update candidate
- Unknown ingredient
- Low-confidence ingredient match
- Safety rule change impact

Admin actions:

- Approve product
- Reject product
- Merge duplicate product
- Edit normalized product fields
- Map unknown ingredient to existing ingredient
- Create new ingredient alias
- Re-run safety analysis

Every admin action should be logged with actor, timestamp, previous value, and new value.

## 9. Supabase and Vercel Fit

Supabase + Vercel is enough for the MVP and early production if jobs are split into small units.

Good fit:

- Frontend and admin UI on Vercel
- Postgres, Auth, Storage, Cron-triggered work tables, and Edge Functions on Supabase
- Scheduled low-volume product monitoring
- HTML/API/sitemap/RSS-based product discovery
- Ingredient parsing and rule-based safety analysis

Needs extra infrastructure later:

- Browser-heavy crawling with Playwright
- Large-volume crawling
- Sites with strong bot protection
- Long-running jobs that exceed serverless limits
- Complex image recognition processing at scale, only after a separate feasibility decision

If those needs appear, add a dedicated worker service such as Cloud Run, Fly.io, Render, Apify, or Browserless. Supabase should still remain the system of record.

## 10. MVP Scope

The first build should include:

1. Supabase schema for products, sources, crawl tasks, raw snapshots, AI quality tables, ingredient tables, aliases, and safety rules.
2. Admin-only source registry.
3. Manual product entry and CSV/import fallback.
4. One or two crawler strategies that avoid browser automation.
5. Embedding-based duplicate suggestions before any small LLM fallback.
6. Ingredient text parser with exact and alias matching.
7. Rule engine for fragrance allergens, generic fragrance disclosure, preservative sensitizers, exfoliant cautions, and user avoid matches.
8. Admin review queue.
9. Product detail UI showing parsed ingredients and explainable safety flags.

The first build should not include:

- Fully autonomous publishing
- Medical diagnosis
- Universal safety scoring
- Large-scale browser crawling
- Camera/label image recognition
- AI-only ingredient safety decisions

## 11. Later Phases

### Phase 2

- Add more source connectors.
- Add product update detection.
- Add Supabase Storage image mirroring.
- Add user sensitivity profile UI.
- Add ingredient unknowns dashboard.
- Add source-based confidence metrics.

### Phase 3

- Keep label image recognition as a separate feasibility track; do not commit it to Phase 3 implementation until privacy, accuracy, and cost are validated.
- Add external browser worker for JS-heavy sources.
- Add purchase links and affiliate tracking.
- Add re-analysis jobs when ingredient rules change.
- Add multilingual explanations for English, Korean, Japanese, and Chinese users.

## 12. Open Product Decisions

Before implementation, decide:

1. Which 3-5 product sources are allowed and highest priority.
2. MVP uses admin-approved data only. Any post-MVP trusted-source auto-publish requires a separate design covering source policy enforcement, measured parser accuracy thresholds, complete safety-rule analysis, audit logs, rollback, and admin override. It must not bypass review controls by default.
3. Whether user sensitivity profiles are account-based in v1 or stored locally first.
4. Whether ingredient warnings should be shown as badges, a detailed report, or both.
5. Which jurisdictions matter first: Korea-only, Korea + EU, or Korea + EU + US.

Recommended defaults:

- Start with admin-approved data only.
- Start with Korea + EU + US source labels, but avoid claiming legal compliance.
- Store user avoid preferences in Supabase only after explicit consent.
- Show badges on product cards and detailed explanations on product detail pages.

## 13. Reference Sources

- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel Function Duration: https://vercel.com/docs/functions/configuring-functions/duration
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase job/queue options: https://supabase.com/docs/guides/queues
- FDA Allergens in Cosmetics: https://www.fda.gov/cosmetics/cosmetic-ingredients/allergens-cosmetics
- FDA Fragrances in Cosmetics: https://www.fda.gov/cosmetics/cosmetic-ingredients/fragrances-cosmetics
- EU CosIng: https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en
- EU Regulation 2023/1545 on fragrance allergen labeling: https://eur-lex.europa.eu/eli/reg/2023/1545/oj/eng
- MFDS fragrance allergen labeling card news: https://www.mfds.go.kr/eng/brd/m_75/view.do?seq=13
- Korea Cosmetics Association ingredient dictionary: https://kcia.or.kr/cid/search/ingd_list.php
