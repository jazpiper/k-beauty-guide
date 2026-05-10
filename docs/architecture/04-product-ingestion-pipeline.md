# Product Ingestion Pipeline

> 작성일: 2026-05-01  
> 상태: 초안  
> 대상: Supabase + Vercel + 모듈형 크롤러

## 1. 목적

이 문서는 K-Beauty Guide의 제품 수집 파이프라인을 정의한다. 목표는 신규 제품 출시를 자동 감지하고, 제품명/브랜드/이미지/성분/상세 설명을 제품 후보로 수집한 뒤, 중복 제거와 품질 보정을 거쳐 관리자 검수 큐로 보내는 것이다.

이 프로젝트에서 크롤러는 핵심 인프라다. 따라서 MVP부터 임시 스크립트가 아니라, 소스가 늘어날수록 connector를 추가해 확장할 수 있는 모듈형 구조로 설계한다.

이 문서는 외부 사이트에 대한 추가 크롤링 검증을 수행하지 않는다. crawlability 재검증은 실제 구현 및 테스트 단계에서 source connector 단위 테스트, 스테이징 dry run, 관리자 review queue 확인으로 수행한다.

## 2. 설계 원칙

- 소스별 차이는 connector 안에 가둔다.
- 공통 fetch, rate limit, snapshot 저장, retry, review queue 기록은 core에서 처리한다.
- 크롤링 성공과 제품 공개를 분리한다.
- 모든 원본 evidence는 저장하되, 공개 앱은 검수된 제품 데이터만 읽는다.
- LLM은 품질 보정과 중복 후보 제안에만 사용한다.
- 알레르기/민감 성분 판단은 rule engine과 출처 기반 evidence가 담당한다.
- Supabase에서 처리 가능한 작은 job을 기본 단위로 삼는다.
- 장시간 브라우저 자동화가 필요해지면 외부 worker를 붙이되, Supabase가 작업 테이블과 결과 저장의 중심으로 남는다.

## 3. 전체 흐름

```text
ingestion_sources
   -> scheduler creates crawl_tasks
   -> connector discovers product URLs
   -> fetcher stores raw_product_snapshots
   -> parser creates product_candidates
   -> deterministic dedupe checks source IDs and normalized names
   -> AI quality layer enriches confidence and duplicate suggestions
   -> confidence scorer decides review reason and priority
   -> review_items are created
   -> admin approves, rejects, merges, or requests re-parse
   -> approved candidate updates products and product_sources
```

초기 구현은 sitemap, Shopify JSON, JSON-LD, 정적 HTML처럼 브라우저 자동화가 필요 없는 소스부터 시작한다. Playwright나 headless browser가 필요한 소스는 Phase 2 이후 별도 worker로 이동한다.

## 4. 모듈 경계

```text
crawler/
  core/
    scheduler
    queue
    source-policy-loader
    robots-policy-checker
    rate-limiter
    fetcher
    snapshot-store
    parser-runner
    deterministic-dedupe
    confidence-scorer
    review-queue-writer
  connectors/
    shopify-official/
    stylekorean/
    sitemap-only/
    manual-import/
    future-oliveyoung/
    future-yesstyle/
  parsers/
    product-url-parser
    product-detail-parser
    jsonld-parser
    shopify-product-json-parser
    ingredient-text-parser
    price-parser
  ai-quality/
    candidate-embedder
    duplicate-suggester
    field-quality-checker
    ingredient-text-cleaner
    category-classifier
    ai-audit-logger
  policies/
    blocked-paths
    source-rate-limits
    challenge-detection
    pause-rules
```

### 4.1 Core

Core는 모든 소스에 공통으로 적용되는 실행 환경이다.

| Module | Responsibility |
|---|---|
| `scheduler` | `ingestion_sources`를 읽고 주기적으로 `crawl_tasks`를 생성 |
| `queue` | 작업 상태, retry, `next_run_at`, attempt count 관리 |
| `source-policy-loader` | source별 허용 path, rate limit, pause 상태 로드 |
| `robots-policy-checker` | 구현/테스트 단계에서 최신 robots 정책 확인 |
| `rate-limiter` | source별 최소 간격과 분당 요청 제한 적용 |
| `fetcher` | HTTP fetch, status 기록, timeout, redirect 제한 |
| `snapshot-store` | 원본 HTML/JSON을 Storage에 저장하고 hash 기록 |
| `parser-runner` | connector parser 실행, parser version 기록 |
| `deterministic-dedupe` | source product ID, URL, normalized name 기반 1차 중복 제거 |
| `confidence-scorer` | 필드 완성도, 중복 가능성, 성분 추출 상태로 신뢰도 계산 |
| `review-queue-writer` | 검수 이유와 우선순위를 포함해 `review_items` 생성 |

### 4.2 Connector

Connector는 특정 소스를 다루는 작은 어댑터다. 새로운 크롤링 사이트를 추가할 때는 core를 수정하지 않고 connector만 추가하는 것을 원칙으로 한다.

```ts
export type DiscoveryTarget = {
  url: string;
  taskType: "discover_product_urls";
};

export interface CrawlConnector {
  sourceKey: string;
  getDiscoveryTargets(context: CrawlContext): Promise<DiscoveryTarget[]>;
  parseDiscoverySnapshot(snapshot: RawSnapshot, context: CrawlContext): Promise<DiscoveredUrl[]>;
  parseProductCandidate?(snapshot: RawSnapshot, context: CrawlContext): Promise<ProductCandidate>;
  extractIngredients?(snapshot: RawSnapshot, context: CrawlContext): Promise<IngredientExtractionResult>;
  getDefaultPolicy(): SourceCrawlPolicy;
}
```

Connector는 discovery target 산출과 snapshot parsing만 담당한다. `getDiscoveryTargets`는 source policy와 base URL에서 sitemap/list/feed URL 후보를 계산할 뿐 네트워크 요청을 수행하지 않는다. HTTP 요청, timeout, redirect 제한, rate limit, raw snapshot 저장, pause 판단은 core `fetcher`와 `snapshot-store`가 단일하게 수행한다. `parseDiscoverySnapshot`과 `parseProductCandidate`는 core가 저장한 `RawSnapshot`만 입력받는다. Sitemap-only처럼 discovery-only인 connector는 `parseProductCandidate`를 구현하지 않는다.

초기 connector 후보:

| Connector | Scope | MVP Position |
|---|---|---|
| `shopify-official` | Shopify 기반 공식몰의 sitemap/product JSON/JSON-LD 처리 | MVP 우선 |
| `stylekorean` | 공개 리스트/상세 HTML과 JSON-LD 기반 후보 수집 | Post-MVP candidate |
| `sitemap-only` | sitemap의 product URL과 lastmod 감지 중심 | MVP 우선 |
| `manual-import` | CSV/JSON 수동 업로드를 같은 파이프라인으로 투입 | MVP 필수 |
| `future-oliveyoung` | sitemap 중심 감지, 상세 자동 수집은 보류 | Phase 2 검토 |
| `future-yesstyle` | 공개 상세 페이지 제한 검토, API disallow 영역 제외 | Phase 2 검토 |

### 4.3 Parser

Parser는 원본 snapshot에서 구조화된 후보 데이터를 만든다. Parser는 connector에 종속될 수 있지만, 재사용 가능한 parser는 `parsers/` 아래에 둔다.

```ts
export type ProductCandidate = {
  sourceId: string;
  snapshotId: string;
  sourceProductId?: string;
  sourceUrl: string;
  brandName?: string;
  productName: string;
  category?: string;
  sourcePrice?: number;
  sourceCurrency?: string;
  priceKrw?: number;
  imageUrls: string[];
  description?: string;
  claims: string[];
  ingredientTextRaw?: string;
  parserVersion: string;
  confidenceHints: ConfidenceHint[];
};
```

`snapshotId`는 `raw_product_snapshots.id`를 가리킨다. Deduplication에는 `content_hash`를 별도 signal로 사용하고, FK 위치에 content hash를 넣지 않는다.

MVP parser 우선순위:

1. JSON-LD Product parser
2. Shopify product JSON parser
3. sitemap URL discovery parser
4. static HTML selector parser
5. ingredient text splitter

브라우저 렌더링 후 DOM을 읽어야 하는 parser는 MVP에서 제외한다.

## 5. Source Policy

각 source는 `ingestion_sources`와 policy 파일의 조합으로 관리한다.

```ts
export type SourceCrawlPolicy = {
  allowedPathPrefixes: string[];
  blockedPathPrefixes: string[];
  maxRequestsPerMinute: number;
  minDelayMs: number;
  maxPagesPerRun: number;
  userAgentLabel: string;
  pauseOnStatuses: number[];
  pauseOnChallenge: boolean;
  snapshotRetentionDays: number;
};
```

MVP 기본값:

- `enabled = false`로 source를 등록한 뒤 관리자 검토 후 켠다.
- checkout, cart, account, order, search, filter, sort path는 기본 차단한다.
- source별 `minDelayMs`를 둔다.
- 403, 429, captcha, challenge 신호가 보이면 source를 자동 pause한다.
- pause 상태는 `ingestion_sources.paused_at`, `pause_reason`, `paused_until`에 저장해 scheduler와 관리자 UI가 같은 상태를 읽는다.
- 한 번의 함수 실행이 너무 많은 URL을 처리하지 않도록 `maxPagesPerRun`을 둔다.

## 6. AI Quality Layer

AI quality layer는 크롤링 결과를 공개 판단하는 계층이 아니다. 제품 후보의 품질을 높이고, 관리자에게 더 좋은 검수 단서를 제공하는 보조 계층이다.

### 6.1 역할

| Capability | Primary Method | Output |
|---|---|---|
| 중복 후보 감지 | normalized key + embedding similarity | `duplicate_suggestions` |
| 제품명/용량/variant 정규화 | deterministic parser + small LLM fallback | `field_extraction_suggestions` |
| 브랜드/카테고리 보정 | rule mapping + classifier | candidate field suggestion |
| 성분 텍스트 정리 | separator normalization + small LLM fallback | cleaned ingredient string |
| claim 추출 | parser + optional small LLM | short structured claims |
| 품질 점수 설명 | deterministic confidence scorer | review reason codes |

### 6.2 Supabase에서 가능한 방식

가장 가벼운 기본안은 Postgres + pgvector 기반 embedding similarity다.

- candidate의 `brand_name`, `product_name`, `category`, `ingredient_text_raw`, `source_url` 일부를 짧은 문자열로 합친다.
- embedding을 생성해 `candidate_embeddings`에 저장한다.
- 기존 `products` 또는 최근 `product_candidates`와 유사도를 비교한다.
- 유사도가 높은 경우 자동 병합하지 않고 `duplicate_suggestions`를 만든다.

Supabase Edge Functions는 stateless하고 짧은 작업에 적합하므로, 무거운 local LLM을 Supabase 내부에서 계속 띄우는 구조는 피한다. 필요하면 아래 순서로 접근한다.

1. deterministic parser와 embedding similarity를 먼저 사용한다.
2. 낮은 신뢰도 또는 충돌 케이스만 작은 외부 LLM API로 보낸다.
3. LLM 입력은 원본 HTML 전체가 아니라 정리된 짧은 snippet만 사용한다.
4. LLM 결과는 `ai_assessment_runs`와 `field_extraction_suggestions`에 저장한다.
5. 관리자 승인 없이 `products`에 직접 반영하지 않는다.

### 6.3 LLM 사용 가능 지점

LLM을 붙일 수 있는 위치는 아래로 제한한다.

| Task | Allowed? | Notes |
|---|---:|---|
| 제품명에서 용량/라인/variant 분리 | Yes | 예: `Snail 96 Mucin Power Essence 100ml` |
| 성분 텍스트의 구분자 정리 | Yes | 원문 의미를 바꾸지 않는 범위 |
| 제품 claim을 짧은 태그로 요약 | Yes | 원문에 없는 claim 생성 금지 |
| 중복 여부 설명 생성 | Yes | 최종 병합은 관리자 판단 |
| 알레르기 위험 최종 판단 | No | rule engine과 evidence가 담당 |
| 규제 준수 여부 판단 | No | 법적 판단처럼 보이는 출력 금지 |
| 자동 공개 결정 | No | review queue를 거쳐야 함 |

### 6.4 Audit

LLM/AI 작업은 항상 재현 가능한 metadata를 남긴다.

필수 기록:

- `task_type`
- `model_provider`
- `model_name`
- `prompt_version`
- `input_hash`
- `output_json`
- `confidence`
- `status`
- `latency_ms`
- `estimated_cost_usd`
- `error_message`

원본 HTML 전체를 LLM 입력으로 저장하지 않는다. 필요한 경우 input hash와 짧은 sanitized snippet만 저장한다.

### 6.5 Model Placement Decision

MVP의 기본 결정은 `embedding first, small LLM fallback`이다.

| Layer | Recommended Placement | Notes |
|---|---|---|
| Embedding generation | Supabase-friendly function or lightweight external API | `pgvector`에 저장하고 중복 제안에 사용 |
| Similarity search | Supabase Postgres + pgvector | 제품/후보 비교의 기본 경로 |
| Small LLM cleanup | Edge Function에서 외부 API 호출 | 낮은 confidence, 충돌 field, 성분 텍스트 정리에만 사용 |
| Resident local LLM | Not recommended for MVP | Supabase Edge Functions에 상주시켜 운영하는 구조는 피함 |
| Heavy model/batch AI | External worker | 대량 처리, 긴 실행 시간, 별도 승인된 라벨 이미지 인식이 필요할 때만 |

구현 시점에 Supabase-hosted embedding 옵션이 프로젝트에서 안정적으로 제공되면 우선 검토한다. 예를 들어 `gte-small` 계열처럼 작은 embedding 모델이 사용 가능하면 duplicate suggestion 비용을 낮출 수 있다. 단, provider/model 선택은 문서 확정이 아니라 구현 시점의 실제 지원 여부와 비용/latency 테스트로 결정한다.

## 7. Deduplication Strategy

중복 제거는 3단계로 나눈다.

### 7.1 Deterministic Match

가장 신뢰할 수 있는 신호를 먼저 본다.

- 같은 `source_id + source_product_id`
- 같은 canonical source URL
- 같은 브랜드 + normalized product name
- 같은 제품 이미지 hash
- 같은 GTIN/UPC/EAN이 나중에 들어올 경우 같은 상품 코드

이 단계에서 확실히 같은 제품이면 기존 `product_sources`를 갱신하거나 review item에 merge 제안을 만든다.

### 7.2 Similarity Match

확정하기 어려운 경우 embedding similarity를 사용한다.

비교 텍스트 예시:

```text
brand: COSRX
name: Advanced Snail 96 Mucin Power Essence
category: Essence
ingredients: Snail Secretion Filtrate, Betaine, Butylene Glycol...
```

결과는 자동 병합하지 않고 다음 reason code로 저장한다.

- `same_brand_similar_name`
- `same_name_different_size`
- `same_ingredient_profile`
- `same_image_cluster`
- `possible_reformulation`

### 7.3 Human Merge

관리자 화면에서 아래를 비교한다.

- 기존 제품
- 신규 후보
- 원본 snapshot evidence
- field-level 차이
- AI duplicate reason
- 성분 목록 차이

승인 시 `products`, `product_sources`, `product_images`, `product_ingredients`가 갱신된다.

## 8. Confidence Score

`product_candidates.confidence_score`는 공개 가능성을 의미하지 않는다. 검수 우선순위를 정하는 내부 점수다.

권장 입력:

| Signal | Positive |
|---|---|
| product name exists | 필수 |
| brand name matched | + |
| image URL exists | + |
| ingredient text exists | + |
| source product ID exists | + |
| parser is structured JSON-LD/Shopify | + |
| duplicate conflict found | - |
| ingredient parse failed | - |
| LLM suggested field conflict | - |
| source recently paused/challenged | - |

점수 구간:

- `0.85+`: 검수 우선순위 낮음, 빠른 승인 후보
- `0.65-0.84`: 일반 검수
- `0.40-0.64`: 필드 보정 필요
- `< 0.40`: parser/source 점검 필요

MVP에서는 높은 점수라도 자동 공개하지 않는다.

## 9. Runtime Placement

### Supabase

Supabase가 담당한다.

- `ingestion_sources`, `crawl_tasks`, `raw_product_snapshots`, `product_candidates` 저장
- Cron 기반 task 생성
- Edge Function 기반 작은 fetch/parse job
- Storage snapshot 저장
- embedding과 duplicate suggestion 저장
- review queue 생성

### Vercel

Vercel이 담당한다.

- Public app 제품 검색/상세 화면
- Admin Review Console
- source 설정 화면
- 검수 action 호출
- 수동 import 업로드 UI

프론트와 관리자 화면의 logical endpoint는 [API Contract](../api/01-api-contract.md)를 따른다.

### External Worker

MVP 이후 필요할 때만 추가한다.

- 장시간 headless browser
- 라벨 이미지 인식 feasibility 이후의 장시간 이미지 처리
- 대량 이미지 처리
- 복잡한 retry/backoff 실행
- source별 특수 세션 관리

External worker도 Supabase 작업 테이블을 읽고 Supabase에 결과를 쓰는 형태로 붙인다.

## 10. Failure and Pause Rules

| Condition | Action |
|---|---|
| HTTP 403 or 429 | source pause, admin alert review item |
| captcha/challenge signal | source pause, no retry until manual review |
| parser selector failure | candidate 생성 보류, parser failure review item |
| missing product name | task failed, source parser 점검 |
| missing ingredient text | candidate 생성 가능, ingredient review reason 추가 |
| LLM timeout | deterministic 결과로 진행, confidence 감점 |
| embedding failure | retry 예약, candidate 생성은 막지 않음 |
| duplicate conflict | merge review item 생성 |

실패는 조용히 삼키지 않는다. 실패한 URL, source, parser version, error class가 남아야 다음 connector 개선으로 이어진다.

## 11. MVP Scope

MVP에 포함한다.

- `manual-import` connector
- `sitemap-only` connector
- `shopify-official` connector
- `stylekorean` connector post-MVP 후보
- JSON-LD parser
- Shopify product JSON parser
- raw snapshot 저장
- deterministic dedupe
- embedding 기반 duplicate suggestion
- admin review queue
- source pause rule

MVP에서 제외한다.

- browser automation crawler
- checkout/cart/account/search/filter/sort path crawling
- 자동 제품 공개
- Olive Young 상세 자동 크롤링
- YesStyle 자동 connector
- local LLM 상시 구동
- LLM 기반 안전성 최종 판단

## 12. Implementation Order

1. Supabase schema에 ingestion, AI quality, review 관련 테이블을 만든다.
2. `manual-import`로 pipeline end-to-end를 먼저 검증한다.
3. `sitemap-only`로 URL discovery와 snapshot 저장을 검증한다.
4. `shopify-official` connector를 추가한다.
5. JSON-LD/Shopify parser를 붙인다.
6. deterministic dedupe와 review item 생성을 붙인다.
7. embedding duplicate suggestion을 붙인다.
8. 낮은 confidence case에만 small LLM field suggestion을 붙인다.
9. Admin Review Console에서 merge/approve/reject workflow를 검증한다.
10. 실제 source별 dry run을 rate limit과 pause rule 하에서 수행한다.

## 13. MVP Defaults

Detailed backend decisions are centralized in [MVP Backend Decision Record](./06-mvp-backend-decisions.md).

1. Embedding provider/model is adapter-based and selected by implementation-time benchmark; schema stores provider/model labels.
2. Small LLM provider/model is optional and env-configurable; only low-confidence field cleanup may call it.
3. MVP live crawling starts with official brand sites through `manual-import`, `sitemap-only`, and `shopify-official`. `stylekorean` remains post-MVP until terms/robots/dry-run results are rechecked.
4. Snapshot retention defaults to 30 days and can be overridden by source policy.
5. Duplicate review threshold: deterministic exact/near-exact match always creates a review item; embedding similarity >= 0.88 creates a suggestion; auto-merge is not allowed.
