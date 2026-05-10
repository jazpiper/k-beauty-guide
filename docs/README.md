# K-Beauty Guide 문서 인덱스

## 문서 목적

이 문서는 새 에이전트나 개발자가 K-Beauty Guide의 현재 문서, 구현 상태, 다음 문서화 우선순위를 빠르게 파악하기 위한 출발점이다. 상세 계획은 각 문서에 두고, 여기서는 어디를 먼저 읽고 무엇을 조심해야 하는지만 정리한다.

## 빠른 시작 순서

1. 루트 [README.md](../README.md)에서 실행 명령과 현재 스택을 확인한다.
2. [PLANNING.md](../PLANNING.md)에서 제품 목적, 현재 한계, 로드맵을 훑는다.
3. 백엔드나 데이터 작업이면 [MVP Backend Decision Record](architecture/06-mvp-backend-decisions.md)를 먼저 읽고 결정값을 흔들지 않는다.
4. 제품/성분/크롤러 구현이면 [System Architecture Overview](architecture/01-system-overview.md), [Data Model](architecture/02-data-model.md), [API Contract](api/01-api-contract.md)를 함께 본다.
5. 로컬 검증이나 배포 전에는 [Deployment Runbook](ops/01-deployment-runbook.md)의 프론트, Supabase, Edge Function 검증 절차를 따른다.

## Doc Map

### Product / Pages

- [Home](pages/01_home.md): 랜딩, 검색 진입, 카테고리/트렌딩/CTA 상태.
- [Products](pages/02_products.md): 제품 목록, 필터, 상세 진입, Supabase 목표 데이터 구조.
- [Ingredients](pages/03_ingredients.md): 성분 분석기, 검색/필터, rule engine 연동 방향.
- [Shopping Map](pages/04_shopping_map.md): 매장 탐색, 지도 placeholder, Phase 2 지도 연동.
- [Skin Quiz](pages/05_skin_quiz.md): 피부 타입 퀴즈, 결과 저장/연결성 개선 방향.

### Architecture

- [System Overview](architecture/01-system-overview.md): Vercel public/admin app, Supabase backend, crawler/admin/safety 경계.
- [Data Model](architecture/02-data-model.md): Supabase Postgres 테이블, 관계, RLS 의도.
- [Crawlability Precheck](architecture/03-crawlability-precheck.md): source 후보와 MVP crawler guardrail.
- [Product Ingestion Pipeline](architecture/04-product-ingestion-pipeline.md): connector 기반 수집, dedupe, review queue, AI quality layer.
- [Ingredient Safety Engine](architecture/05-ingredient-safety-engine.md): parser, matcher, rule/evidence, 사용자 민감 성분 overlay.
- [MVP Backend Decisions](architecture/06-mvp-backend-decisions.md): MVP 기본 결정값과 Post-MVP로 미룬 항목.

### API

- [API Contract](api/01-api-contract.md): public product/ingredient API, analyzer, user profile, admin review, worker endpoint 계약.

### Ops

- [Deployment Runbook](ops/01-deployment-runbook.md): 로컬/스테이징/프로덕션 검증, 환경 변수, secret scan, Supabase/Vercel 배포 절차.

### Crawler

- [Crawler README](../crawler/README.md): crawler module boundary, connector 규칙, safety rules.
- `crawler/core/`: 공통 타입, confidence scoring, deterministic dedupe 기반.
- `crawler/connectors/manual-import/`, `crawler/connectors/sitemap-only/`: MVP connector shell.

### Plans / Specs

- [MVP Implementation Plan](superpowers/plans/2026-05-01-mvp-implementation-plan.md): Supabase-backed MVP 구현 순서.
- [Product Media and Description Ingestion Plan](superpowers/plans/2026-05-10-product-media-description-ingestion-plan.md): 제품 이미지, 상세 설명, claim 후보 수집과 검수 계획.
- [Product Ingestion and Ingredient Safety Automation](superpowers/specs/2026-05-01-product-ingestion-ingredient-safety-design.md): 수집 자동화와 성분 안전성 설계 초안.
- [Admin Review Console UX](superpowers/specs/2026-05-01-admin-review-console-ux-spec.md): evidence review desk 중심의 관리자 콘솔 UX.

## 현재 구현 스냅샷

### Supabase Schema / Functions

- `supabase/migrations/20260502010339_core_schema.sql`에는 catalog, ingredients, safety, ingestion, AI quality, review/audit 테이블과 task/safety lease RPC가 있다.
- `supabase/migrations/20260502010341_public_views_and_rls.sql`에는 RLS, public grants, `v_public_products`, `v_public_ingredients`, `v_public_product_safety_flags`, `get_public_product_detail(product_slug text)`가 있다.
- `supabase/seed.sql`은 COSRX/Laneige seed product, 3개 ingredient seed, fragrance safety rule, manual crawl task seed를 넣는다.
- Edge Functions는 공통 response helper를 공유한다. `claim-crawl-tasks`와 `complete-crawl-task`는 service role RPC를 호출한다.
- `analyze-ingredient-text`, `admin-review-action`, `run-safety-analysis`, `run-ai-quality`는 validation과 안전한 response shell이 있으나, 실제 DB mutation/parser/rule 실행은 아직 얇다.

### Crawler Foundation

- `crawler/core/types.ts`가 source-agnostic connector 계약을 정의한다.
- `crawler/core/confidenceScorer.ts`는 필수 필드와 hint penalty 기반 confidence score를 계산한다.
- `crawler/core/dedupe.ts`는 source product id, normalized URL, brand+name 기반 deterministic duplicate signal을 만든다.
- `manual-import`와 `sitemap-only` connector는 네트워크 요청을 직접 하지 않는 shell이다. live fetch, snapshot store, parser runner, review queue writer는 아직 runtime wiring 대상이다.

### Frontend Supabase Hooks / Detail Route

- React Router가 적용되어 `/products/:slug` 상세 route가 있다.
- `src/lib/supabaseClient.js`는 `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`가 실제 값일 때만 Supabase client를 만든다.
- `useProducts`, `useIngredients`, `useProductDetail`은 Supabase read/RPC를 먼저 시도하고 실패하거나 미설정이면 static fallback으로 내려간다.
- `src/api/productsApi.js`는 `v_public_products`와 `get_public_product_detail`을 frontend shape로 매핑한다.
- `src/api/ingredientsApi.js`는 `v_public_ingredients`와 `analyze-ingredient-text` Edge Function을 사용하고, 실패 시 local analyzer를 쓴다.

### Verification Caveats

- 문서상 검증 경로는 준비되어 있지만, 새 변경마다 `npm install`, `CI=true npm test -- --watch=false --passWithNoTests`, `npm run build`를 실제로 다시 확인해야 한다.
- Supabase 검증은 Docker 호환 runtime과 Supabase CLI가 필요하며, `npx supabase start`, `npx supabase db reset`, `npx supabase status`로 확인한다.
- Edge Function smoke는 local function serve와 curl로 별도 확인해야 한다. service role env가 없으면 crawler claim/complete 함수는 503을 반환하는 것이 정상적인 방어 동작이다.
- 크롤러 source dry run은 최신 robots/terms/rate limit 재확인 후 staging에서만 수행한다. 현재 connector shell만으로 live crawling 완료를 가정하지 않는다.
- 공개 safety 결과는 latest successful `safety_analysis_runs` 기준이어야 하며, LLM 결과를 최종 안전성 판단으로 쓰지 않는다.

## 다음 문서화 우선순위

1. 실제 로컬 검증 결과를 남기는 짧은 `docs/ops` 체크포인트 문서 또는 runbook 섹션을 추가한다.
2. Supabase Edge Function별 구현 상태와 남은 DB mutation 범위를 API 문서에 반영한다.
3. crawler runtime wiring이 들어오면 `crawler/README.md`에 fetcher, snapshot store, parser runner, review writer의 실제 호출 흐름을 추가한다.
4. frontend fallback과 Supabase live data의 차이를 Products/Ingredients/Product Detail 문서에 업데이트한다.
5. Admin Review Console 구현이 시작되면 권한, audit log, second review 조건을 화면별 acceptance criteria로 쪼갠다.
