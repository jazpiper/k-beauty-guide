# Data Model

> 작성일: 2026-05-01  
> 상태: 초안  
> 대상: Supabase Postgres

## 1. 목적

이 문서는 K-Beauty Guide의 Supabase/Postgres 데이터 모델을 정의한다. 목표는 제품 카탈로그, 성분 지식베이스, 제품 크롤링 evidence, 관리자 검수, 사용자 민감 성분 설정을 하나의 일관된 스키마로 연결하는 것이다.

데이터 모델은 아래 원칙을 따른다.

- 공개 앱은 검수된 데이터만 읽는다.
- 크롤링 원본과 자동 추출 결과는 공개 제품 데이터와 분리한다.
- 성분 안전성 판단은 출처 기반 rule과 감사 가능한 결과로 저장한다.
- 사용자 민감 성분 정보는 명시적 동의와 RLS 보호를 전제로 저장한다.
- LLM 결과는 보조 정보로만 저장하고 최종 판단 근거가 되지 않는다.

## 2. 핵심 관계

```text
brands 1--n products
products 1--n product_images
products n--m ingredients through product_ingredients

ingredients 1--n ingredient_aliases
ingredients 1--n ingredient_evidence
ingredients 1--n ingredient_safety_rules
ingredient_evidence 1--n ingredient_safety_rules
ingredient_safety_rules 1--n product_safety_flags

ingestion_sources 1--n crawl_tasks
crawl_tasks 1--n raw_product_snapshots
raw_product_snapshots 1--n product_candidates
product_candidates 1--n review_items
product_candidates 1--n candidate_embeddings
product_candidates 1--n duplicate_suggestions
product_candidates 1--n field_extraction_suggestions
ai_assessment_runs 1--n field_extraction_suggestions

auth.users 1--1 user_profiles
auth.users 1--n user_favorites
auth.users 1--n user_avoid_ingredients
auth.users 1--n quiz_results
```

## 3. Catalog Tables

### 3.1 `brands`

브랜드의 canonical 정보를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `text` | Display name |
| `slug` | `text` | Unique URL slug |
| `country` | `text` | Example: `KR` |
| `official_url` | `text` | Nullable |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Updated by trigger |

Indexes:

- Unique index on `slug`
- B-tree index on `name`

### 3.2 `products`

공개 가능한 제품 카탈로그의 중심 테이블이다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `brand_id` | `uuid` | FK to `brands.id` |
| `name` | `text` | Product display name |
| `slug` | `text` | Unique product slug |
| `category` | `text` | Toner, Serum, Cleanser, etc. |
| `description` | `text` | Nullable |
| `price_krw` | `integer` | Nullable |
| `currency` | `text` | Default `KRW` |
| `status` | `text` | `draft`, `review`, `published`, `archived` |
| `primary_image_url` | `text` | Public image URL or storage URL |
| `published_at` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Updated by trigger |

Indexes:

- Unique index on `slug`
- B-tree index on `(brand_id, category, status)`
- B-tree index on `(status, published_at desc)`
- Full-text search index on product name, brand name materialized field, and description

Policy:

- Public users can read only `status = 'published'`.
- Admin users can read and write all statuses.
- Service-role ingestion functions can create `draft` or `review` records only through controlled functions.

### 3.3 `product_images`

제품별 복수 이미지를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `product_id` | `uuid` | FK to `products.id` |
| `storage_path` | `text` | Supabase Storage path |
| `source_url` | `text` | Original image URL |
| `alt_text` | `text` | Nullable |
| `position` | `integer` | Display order |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(product_id, position)`

### 3.4 `product_sources`

공개 제품이 어떤 외부 소스에서 검증되었는지 추적한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `product_id` | `uuid` | FK to `products.id` |
| `ingestion_source_id` | `uuid` | FK to `ingestion_sources.id` |
| `source_product_id` | `text` | Nullable |
| `source_url` | `text` | Canonical source page |
| `source_price` | `numeric` | Last observed price in source currency, nullable |
| `source_currency` | `text` | Example: `KRW`, `USD`, nullable |
| `price_krw_conversion` | `jsonb` | Nullable conversion metadata |
| `first_seen_at` | `timestamptz` | First crawl/import time |
| `last_seen_at` | `timestamptz` | Last successful source check |

Indexes:

- Unique partial index on `(ingestion_source_id, source_product_id)` where `source_product_id is not null`
- B-tree index on `product_id`

## 4. Ingredient Tables

### 4.1 `ingredients`

성분의 canonical 정보를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `canonical_name` | `text` | English display name |
| `inci_name` | `text` | Nullable but preferred |
| `korean_name` | `text` | Nullable |
| `cas_number` | `text` | Nullable |
| `definition` | `text` | User-facing explanation |
| `function_tags` | `text[]` | Example: `fragrance`, `preservative` |
| `benefit_tags` | `text[]` | Example: `hydration`, `soothing` |
| `source_status` | `text` | `verified`, `imported`, `manual_review` |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Updated by trigger |

Indexes:

- Unique index on `canonical_name`
- B-tree index on `inci_name`
- GIN index on `function_tags`
- GIN index on `benefit_tags`

### 4.2 `ingredient_aliases`

한글명, INCI명, 별칭, 축약 표기를 canonical ingredient와 연결한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `ingredient_id` | `uuid` | FK to `ingredients.id` |
| `alias` | `text` | Raw alias |
| `normalized_alias` | `text` | Lowercase/punctuation-normalized |
| `language` | `text` | `ko`, `en`, `inci`, `cas`, `synonym` |
| `source` | `text` | Source label |
| `confidence` | `numeric` | 0 to 1 |
| `created_at` | `timestamptz` | Default now |

Indexes:

- Unique index on `(normalized_alias, language)`
- B-tree index on `ingredient_id`

### 4.3 `ingredient_evidence`

성분명, 제한, 알레르기, 용도 등 판단 근거의 출처를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `ingredient_id` | `uuid` | FK to `ingredients.id` |
| `source_name` | `text` | Example: KCIA, MFDS, EU CosIng |
| `source_url` | `text` | Public URL |
| `source_region` | `text` | `KR`, `EU`, `US`, `global`, nullable |
| `source_type` | `text` | `regulatory`, `association_dictionary`, `scientific_review`, `internal_rule` |
| `source_date` | `date` | Nullable |
| `claim_type` | `text` | `name_standard`, `fragrance_allergen`, `restricted`, etc. |
| `excerpt_summary` | `text` | Short paraphrased summary |
| `importer_version` | `text` | Importer or curation version |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(ingredient_id, claim_type)`
- B-tree index on `(source_name, claim_type)`
- B-tree index on `(source_region, claim_type)`

### 4.4 `product_ingredients`

제품과 성분의 매칭 결과를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `product_id` | `uuid` | FK to `products.id` |
| `ingredient_id` | `uuid` | FK to `ingredients.id`, nullable for unmatched rows |
| `raw_name` | `text` | Original parsed ingredient string |
| `matched_name` | `text` | Matched canonical or alias text |
| `position` | `integer` | Label order |
| `match_method` | `text` | `exact`, `normalized`, `alias`, `cas`, `manual`, `unmatched` |
| `confidence` | `numeric` | 0 to 1 |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(product_id, position)`
- B-tree index on `ingredient_id`
- B-tree index on `(match_method, confidence)`

Constraint:

- Unique index on `(product_id, position)` to preserve one ordered row per parsed position.

## 5. Safety Tables

### 5.1 `ingredient_safety_rules`

성분 또는 성분 카테고리에 대한 설명 가능한 rule을 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `ingredient_id` | `uuid` | FK to `ingredients.id`, nullable for category rules |
| `rule_type` | `text` | `fragrance_allergen`, `fragrance_undisclosed`, `preservative_sensitizer`, etc. |
| `severity` | `text` | `info`, `caution`, `avoid_if_sensitive`, `restricted` |
| `condition` | `jsonb` | Simple structured condition |
| `title` | `text` | User-facing warning title |
| `why_it_matters` | `text` | User-facing explanation template |
| `who_should_care` | `text` | Target sensitivity group |
| `recommendation` | `text` | User-facing recommendation |
| `evidence_id` | `uuid` | FK to `ingredient_evidence.id`, nullable |
| `version` | `integer` | Starts at 1 |
| `active` | `boolean` | Default true |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Updated by trigger |

Indexes:

- B-tree index on `(rule_type, active)`
- B-tree index on `(ingredient_id, active)`
- GIN index on `condition`

MVP rule conditions should stay simple. Use JSONB only for structured matching data, not arbitrary code execution.

### 5.2 `safety_analysis_runs`

제품 안전성 분석 실행 이력을 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `product_id` | `uuid` | FK to `products.id` |
| `parser_version` | `text` | Ingredient parser version |
| `rule_version` | `text` | Rule set version |
| `status` | `text` | `queued`, `running`, `succeeded`, `failed` |
| `triggered_by` | `text` | `product_update`, `alias_change`, `rule_change`, `evidence_update`, `manual`, `import` |
| `attempt_count` | `integer` | Default 0 |
| `next_run_at` | `timestamptz` | Retry/schedule time, nullable |
| `claimed_by` | `text` | Worker/function ID for active lease, nullable |
| `lease_token` | `uuid` | Active lease token, nullable |
| `locked_until` | `timestamptz` | Lease expiry, nullable |
| `flag_count` | `integer` | Generated flag count |
| `error_code` | `text` | Machine-readable failure class, nullable |
| `error_message` | `text` | Nullable |
| `created_at` | `timestamptz` | Default now |
| `finished_at` | `timestamptz` | Nullable |

Indexes:

- B-tree index on `(product_id, created_at desc)`
- B-tree index on `(status, created_at)`
- B-tree index on `(status, next_run_at)`
- B-tree index on `(status, locked_until)`

### 5.3 `product_safety_flags`

사용자에게 보여줄 제품별 성분 경고 결과를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `product_id` | `uuid` | FK to `products.id` |
| `ingredient_id` | `uuid` | FK to `ingredients.id`, nullable for generic fragrance |
| `rule_id` | `uuid` | FK to `ingredient_safety_rules.id` |
| `rule_version` | `integer` | Copied from rule at generation time |
| `rule_snapshot` | `jsonb` | Minimal rule/evidence metadata used for audit, nullable |
| `analysis_run_id` | `uuid` | FK to `safety_analysis_runs.id` |
| `severity` | `text` | Copied from rule at generation time |
| `title` | `text` | User-facing title |
| `why_it_matters` | `text` | User-facing explanation |
| `who_should_care` | `text` | Target sensitivity group |
| `recommendation` | `text` | User-facing recommendation |
| `source_label` | `text` | Example: MFDS, EU CosIng |
| `source_region` | `text` | `KR`, `EU`, `US`, `global`, nullable |
| `source_url` | `text` | Nullable |
| `generated_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(product_id, severity)`
- B-tree index on `(ingredient_id, severity)`
- B-tree index on `analysis_run_id`

Policy:

- Public users can read only sanitized flag fields for published products through `v_public_product_safety_flags`, `get_public_product_detail`, or explicit column grants.
- Public access must not expose raw audit/internal fields such as `rule_id`, `rule_snapshot`, `rule_version`, or `analysis_run_id`.
- Admin users can read all flags.

## 6. Ingestion Tables

### 6.1 `ingestion_sources`

크롤링 또는 import 대상 소스를 정의한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `name` | `text` | Source display name |
| `source_type` | `text` | `brand_official`, `commerce`, `partner_feed`, `manual` |
| `base_url` | `text` | Nullable for manual |
| `crawl_strategy` | `text` | `sitemap`, `html_list`, `json_api`, `rss`, `manual_upload`; `json_api` means documented public or partner feeds only |
| `allowed_paths` | `text[]` | Allowed crawl path prefixes |
| `blocked_paths` | `text[]` | Hard-blocked path prefixes |
| `robots_policy_notes` | `text` | Notes from review |
| `rate_limit_per_minute` | `integer` | Conservative source limit |
| `min_delay_ms` | `integer` | Minimum delay between requests |
| `max_pages_per_run` | `integer` | Small invocation limit |
| `user_agent_label` | `text` | User agent label used by core fetcher |
| `pause_on_statuses` | `integer[]` | Example: `{403,429}` |
| `pause_on_challenge` | `boolean` | Pause on captcha/challenge signals |
| `snapshot_retention_days` | `integer` | Raw snapshot retention policy |
| `enabled` | `boolean` | Default false |
| `paused_at` | `timestamptz` | Nullable |
| `pause_reason` | `text` | Nullable |
| `paused_until` | `timestamptz` | Nullable |
| `last_checked_at` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Updated by trigger |

Indexes:

- B-tree index on `(enabled, source_type)`

### 6.2 `crawl_tasks`

작게 쪼갠 크롤링 작업을 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `source_id` | `uuid` | FK to `ingestion_sources.id` |
| `task_type` | `text` | `discover_product_urls`, `fetch_product_detail`, `refresh_existing_product` |
| `target_url` | `text` | URL to fetch |
| `status` | `text` | `queued`, `running`, `succeeded`, `failed`, `needs_review` |
| `attempt_count` | `integer` | Default 0 |
| `next_run_at` | `timestamptz` | Retry/schedule time |
| `claimed_by` | `text` | Worker ID for active lease, nullable |
| `lease_token` | `uuid` | Active lease token, nullable |
| `locked_until` | `timestamptz` | Lease expiry, nullable |
| `error_code` | `text` | Machine-readable failure class, nullable |
| `error_message` | `text` | Nullable |
| `created_at` | `timestamptz` | Default now |
| `started_at` | `timestamptz` | Nullable |
| `finished_at` | `timestamptz` | Nullable |

Indexes:

- B-tree index on `(status, next_run_at)`
- B-tree index on `(status, locked_until)`
- B-tree index on `(source_id, created_at desc)`

### 6.3 `raw_product_snapshots`

크롤링 원본 evidence를 저장한다. 큰 본문은 Storage에 두고 DB에는 metadata를 둔다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `crawl_task_id` | `uuid` | FK to `crawl_tasks.id` |
| `source_id` | `uuid` | FK to `ingestion_sources.id` |
| `target_url` | `text` | Fetched URL |
| `content_type` | `text` | `html`, `json`, `text`, `image` |
| `storage_path` | `text` | Supabase Storage path |
| `content_hash` | `text` | Hash for dedupe/change detection |
| `http_status` | `integer` | Nullable |
| `parser_version` | `text` | Parser used after fetch |
| `fetched_at` | `timestamptz` | Fetch time |

Indexes:

- B-tree index on `content_hash`
- B-tree index on `(source_id, fetched_at desc)`
- B-tree index on `crawl_task_id`

### 6.4 `product_candidates`

자동 추출된 제품 후보를 저장한다. 공개 제품과 분리한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `source_id` | `uuid` | FK to `ingestion_sources.id` |
| `snapshot_id` | `uuid` | FK to `raw_product_snapshots.id` |
| `source_product_id` | `text` | Nullable |
| `source_url` | `text` | Source page |
| `brand_name` | `text` | Extracted brand, nullable |
| `product_name` | `text` | Extracted product name |
| `category` | `text` | Extracted category, nullable |
| `source_price` | `numeric` | Price in source currency, nullable |
| `source_currency` | `text` | Example: `KRW`, `USD`, nullable |
| `price_krw` | `integer` | Normalized KRW price when reliable, nullable |
| `image_urls` | `text[]` | Extracted image URLs |
| `description` | `text` | Nullable |
| `claims` | `text[]` | Product claims |
| `ingredient_text_raw` | `text` | Raw ingredient list, nullable |
| `confidence_score` | `numeric` | 0 to 1 |
| `status` | `text` | `new`, `reviewing`, `approved`, `rejected`, `merged` |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Updated by trigger |

Indexes:

- B-tree index on `(status, confidence_score)`
- B-tree index on `(source_id, source_product_id)`
- B-tree index on `(source_id, created_at desc)`

## 7. AI Quality Tables

AI quality layer는 제품 후보를 더 잘 검수하기 위한 보조 계층이다. 이 계층의 결과는 자동 공개나 최종 안전성 판단에 직접 쓰지 않는다.

### 7.1 `candidate_embeddings`

제품 후보 또는 공개 제품의 짧은 비교 텍스트에 대한 embedding을 저장한다. Postgres에는 `pgvector` extension을 사용하는 것을 전제로 한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `candidate_id` | `uuid` | FK to `product_candidates.id`, nullable when embedding an existing product |
| `product_id` | `uuid` | FK to `products.id`, nullable when embedding a candidate |
| `embedding_model` | `text` | Model or provider label |
| `embedding` | `vector` | pgvector embedding |
| `embedding_text` | `text` | Short sanitized text used for embedding |
| `input_hash` | `text` | Hash of embedding input |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `candidate_id`
- B-tree index on `product_id`
- Unique index on `(embedding_model, input_hash)`
- Vector index after enough volume exists

Constraint:

- Exactly one of `candidate_id` or `product_id` should be present.

### 7.2 `duplicate_suggestions`

중복 가능성이 있는 기존 제품 또는 후보를 제안한다. 자동 병합하지 않고 관리자 검수 화면에 표시한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `candidate_id` | `uuid` | FK to `product_candidates.id` |
| `matched_product_id` | `uuid` | FK to `products.id`, nullable |
| `matched_candidate_id` | `uuid` | FK to `product_candidates.id`, nullable |
| `similarity_score` | `numeric` | 0 to 1 |
| `reason_codes` | `text[]` | Example: `same_brand_similar_name`, `same_ingredient_profile` |
| `source` | `text` | `deterministic`, `embedding`, `llm_assisted`, `manual` |
| `status` | `text` | `open`, `accepted`, `rejected`, `stale` |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(candidate_id, status)`
- B-tree index on `(matched_product_id, status)`
- B-tree index on `(similarity_score desc)`

Constraint:

- At least one of `matched_product_id` or `matched_candidate_id` should be present.

### 7.3 `ai_assessment_runs`

LLM 또는 embedding/classifier 계열 AI 작업의 실행 이력을 저장한다. 원본 HTML 전체를 저장하지 않고 sanitized snippet 또는 input hash 중심으로 남긴다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `target_type` | `text` | `product_candidate`, `ingredient_text`, `duplicate_suggestion`, `product` |
| `target_id` | `uuid` | Target record ID |
| `task_type` | `text` | `duplicate_check`, `field_repair`, `ingredient_cleanup`, `category_classification`, `claim_extraction` |
| `model_provider` | `text` | Provider label |
| `model_name` | `text` | Model label |
| `prompt_version` | `text` | FK-like label to `prompt_versions.version` |
| `input_hash` | `text` | Hash of sanitized input |
| `input_summary` | `text` | Short human-readable summary, nullable |
| `output_json` | `jsonb` | Structured output |
| `confidence` | `numeric` | 0 to 1, nullable |
| `status` | `text` | `queued`, `running`, `succeeded`, `failed`, `skipped` |
| `latency_ms` | `integer` | Nullable |
| `estimated_cost_usd` | `numeric` | Nullable |
| `error_message` | `text` | Nullable |
| `created_at` | `timestamptz` | Default now |
| `finished_at` | `timestamptz` | Nullable |

Indexes:

- B-tree index on `(target_type, target_id, created_at desc)`
- B-tree index on `(task_type, status, created_at)`
- B-tree index on `(model_provider, model_name, created_at desc)`
- GIN index on `output_json`

### 7.4 `field_extraction_suggestions`

AI 또는 parser가 제안한 field-level 보정안을 저장한다. 관리자 승인 전에는 canonical product data에 반영하지 않는다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `candidate_id` | `uuid` | FK to `product_candidates.id` |
| `field_name` | `text` | Example: `product_name`, `category`, `ingredient_text_raw` |
| `current_value` | `jsonb` | Current extracted value |
| `suggested_value` | `jsonb` | Suggested replacement or normalized value |
| `source` | `text` | `parser`, `embedding`, `llm`, `manual` |
| `confidence` | `numeric` | 0 to 1 |
| `ai_run_id` | `uuid` | FK to `ai_assessment_runs.id`, nullable |
| `status` | `text` | `open`, `accepted`, `rejected`, `stale` |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(candidate_id, status)`
- B-tree index on `(field_name, status)`
- B-tree index on `ai_run_id`

### 7.5 `prompt_versions`

LLM을 사용하는 작업의 prompt 버전을 추적한다. Prompt가 바뀌면 같은 입력에도 다른 출력이 나올 수 있으므로 version을 audit 대상에 포함한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `task_type` | `text` | Same domain as `ai_assessment_runs.task_type` |
| `version` | `text` | Example: `ingredient-cleanup-v1` |
| `prompt_hash` | `text` | Hash of prompt template |
| `description` | `text` | What changed and why |
| `active` | `boolean` | Default false |
| `created_at` | `timestamptz` | Default now |

Indexes:

- Unique index on `(task_type, version)`
- B-tree index on `(task_type, active)`

## 8. Review and Audit Tables

### 8.1 `review_items`

제품 후보, 성분 매칭, safety rule 변경 등 검수 대상을 하나의 큐로 모은다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `item_type` | `text` | `product_candidate`, `product_update`, `ingredient_match`, `safety_rule_change`, `restricted_signal`, `evidence_update`, `copy_review`, `ingestion_alert` |
| `item_id` | `uuid` | ID of target record |
| `title` | `text` | Snapshot title for list display |
| `status` | `text` | `open`, `assigned`, `approved`, `rejected`, `blocked` |
| `priority` | `text` | `low`, `normal`, `high`, `urgent` |
| `assigned_to` | `uuid` | FK to `auth.users.id`, nullable |
| `reason` | `text` | Why this needs review |
| `reason_codes` | `text[]` | Machine-readable review reasons |
| `source_id` | `uuid` | FK to `ingestion_sources.id`, nullable |
| `source_name_snapshot` | `text` | Source display name at queue time, nullable |
| `confidence_score` | `numeric` | Nullable |
| `requires_second_review` | `boolean` | Default false |
| `second_review_status` | `text` | `not_required`, `pending`, `approved`, `rejected` |
| `second_reviewer_id` | `uuid` | FK to `auth.users.id`, nullable |
| `created_at` | `timestamptz` | Default now |
| `resolved_at` | `timestamptz` | Nullable |

Indexes:

- B-tree index on `(status, item_type, created_at)`
- B-tree index on `(assigned_to, status)`
- B-tree index on `(source_id, status)`

### 8.2 `admin_audit_logs`

관리자 변경 이력을 감사 가능하게 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `actor_user_id` | `uuid` | FK to `auth.users.id` |
| `action` | `text` | `approve`, `reject`, `edit`, `merge`, `create_alias`, `rerun_analysis`, etc. |
| `object_type` | `text` | Target table/domain |
| `object_id` | `uuid` | Target record ID |
| `previous_value` | `jsonb` | Nullable |
| `new_value` | `jsonb` | Nullable |
| `comment` | `text` | Admin reason/comment |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(object_type, object_id, created_at desc)`
- B-tree index on `(actor_user_id, created_at desc)`
- B-tree index on `(action, created_at desc)`

## 9. User Tables

### 9.1 `user_profiles`

사용자 기본 프로필과 동의 상태를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | PK and FK to `auth.users.id` |
| `display_name` | `text` | Nullable |
| `skin_type` | `text` | `dry`, `oily`, `combo`, `sensitive`, `normal`, nullable |
| `sensitivity_level` | `text` | `low`, `medium`, `high`, nullable |
| `consent_version` | `text` | Nullable until consent |
| `consent_revoked_at` | `timestamptz` | Nullable |
| `created_at` | `timestamptz` | Default now |
| `updated_at` | `timestamptz` | Updated by trigger |

Policy:

- Users can read and update only their own row.
- Admin access should be limited and audited.

### 9.2 `user_avoid_ingredients`

사용자가 피하고 싶은 성분 또는 성분 카테고리를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `auth.users.id` |
| `ingredient_id` | `uuid` | FK to `ingredients.id`, nullable for category avoids |
| `avoid_category` | `text` | Example: `fragrance`, `essential_oils`, nullable |
| `reason` | `text` | `allergy`, `sensitivity`, `preference`, nullable |
| `created_at` | `timestamptz` | Default now |

Indexes:

- Unique partial index on `(user_id, ingredient_id)` where `ingredient_id is not null`
- Unique partial index on `(user_id, avoid_category)` where `avoid_category is not null`

### 9.3 `user_favorites`

제품 위시리스트를 저장한다.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | FK to `auth.users.id` |
| `product_id` | `uuid` | FK to `products.id` |
| `created_at` | `timestamptz` | Default now |

Constraint:

- Primary key on `(user_id, product_id)`

### 9.4 `quiz_results`

피부 타입 퀴즈 결과를 저장한다. 계정 기능이 없을 때는 LocalStorage로 시작할 수 있다.
LocalStorage 저장도 shared-device privacy를 고려해 명시적인 저장/삭제 UI를 제공해야 한다.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `auth.users.id`, nullable for anonymous future design |
| `skin_type` | `text` | Result type |
| `answers` | `jsonb` | Question answer payload |
| `created_at` | `timestamptz` | Default now |

Indexes:

- B-tree index on `(user_id, created_at desc)`

## 10. RLS Policy Model

### Public Read

Anonymous and authenticated public users can read:

- `brands` linked to published products
- `products` where `status = 'published'`
- `product_images` for published products
- sanitized product ingredient view/RPC output for published products, not raw `product_ingredients`
- `ingredients` where `source_status in ('verified', 'imported')`
- `ingredient_aliases` only if needed for public search
- sanitized public ingredient detail view/RPC output, not raw `ingredient_evidence` or `ingredient_safety_rules`
- sanitized `v_public_product_safety_flags` / product detail RPC output for published products, not raw `product_safety_flags`

### Admin Read/Write

Admin roles can read and write:

- Brands
- Products
- Product sources
- Product images
- Product candidates
- Review items
- Crawl sources
- Crawl tasks
- Raw snapshot metadata
- Ingredient evidence
- Ingredient aliases
- Safety rules
- Candidate embeddings
- Duplicate suggestions
- AI assessment runs
- Field extraction suggestions
- Prompt versions
- Audit logs

Role separation:

- `reviewer`: approve/reject product candidates and ingredient matches
- `ingredient_editor`: edit ingredient and alias data
- `safety_rule_admin`: edit safety rules and trigger re-analysis
- `super_admin`: manage sources and roles

### User-Private Data

Users can read and write only their own:

- `user_profiles`
- `user_avoid_ingredients`
- `user_favorites`
- `quiz_results`

User sensitivity data must be deletable. If scan history is added later, it should be opt-in and private by default.

### Service Role

Only trusted Edge Functions or worker services should use service-role privileges. Service-role writes should be limited to:

- `brands`
- `products`
- `product_sources`
- `product_images`
- `ingestion_sources`
- `crawl_tasks`
- `raw_product_snapshots`
- `product_candidates`
- `product_ingredients`
- `safety_analysis_runs`
- `product_safety_flags`
- `candidate_embeddings`
- `duplicate_suggestions`
- `ai_assessment_runs`
- `field_extraction_suggestions`
- `review_items`
- `admin_audit_logs`

## 11. Data Lifecycle

```text
Admin creates ingestion source
   -> Cron enqueues crawl_tasks
   -> Worker writes raw_product_snapshots
   -> Parser writes product_candidates
   -> AI quality layer writes embeddings, duplicate_suggestions, and field suggestions
   -> System creates review_items with confidence and reason codes
   -> Admin approves or rejects
   -> Approved candidate creates or updates products
   -> Ingredient parser writes product_ingredients
   -> Safety engine writes safety_analysis_runs and product_safety_flags
   -> Public app reads published catalog and flags
```

Re-analysis should be possible without re-crawling. When safety rules or ingredient aliases change, affected products can be queued for a new safety analysis run.

## 12. Search Strategy

MVP search can use Postgres full-text search and normalized aliases.

Recommended search surfaces:

- Product search: product name, brand name, category, description
- Ingredient search: canonical name, INCI name, Korean name, aliases
- Admin review search: source URL, product candidate name, review status, ingredient raw name

If search quality becomes a product differentiator, add a dedicated search index later. Do not add external search infrastructure in MVP.

## 13. Privacy and Safety Notes

- Do not store allergy-like user data without explicit consent.
- Avoid wording that turns sensitivity preferences into medical diagnosis.
- Do not persist raw ingredient scan history unless the user opts in.
- Keep raw crawl snapshots admin-only because source pages may contain unrelated copyrighted page content.
- Keep source evidence summaries short and paraphrased.
- Do not send full raw HTML to an LLM by default. Use sanitized snippets and hashes.
- Treat LLM output as a suggestion that must be reviewable and reversible.
- Store enough audit history to explain why a product or warning was published.

## 14. MVP Decisions

Initial recommended defaults:

- All product candidates require admin approval before publication.
- In MVP, approving a product candidate publishes it immediately and writes `published_at`; a separate publish state can be added post-MVP.
- User sensitivity profile can start as LocalStorage, then move to Supabase after account flow and consent copy exist.
- Safety rules use rows plus constrained JSONB conditions.
- Korea + EU + US can be represented in evidence metadata, but the UI should avoid claiming legal compliance.
- Embedding-based duplicate suggestions can ship before small LLM calls.
- Small LLM calls should be limited to low-confidence or conflicting candidate fields.
- Scan history is omitted in MVP.

## 15. MVP Defaults

Detailed backend decisions are centralized in [MVP Backend Decision Record](./06-mvp-backend-decisions.md).

- Sensitivity settings remain LocalStorage-only in MVP.
- Safety rules start as rows plus constrained JSONB metadata from day one.
- KR + EU + US can be stored as source metadata, but public UI must not present legal compliance judgments.
- Auto-publish is not allowed in MVP.
- Ingredient scan history is omitted in MVP.
- Embedding provider/model is environment-configurable and selected after implementation-time benchmark.
- Small LLM field cleanup is optional, low-confidence only, and never used for final safety judgment.
