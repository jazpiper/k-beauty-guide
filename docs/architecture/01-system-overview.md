# System Architecture Overview

> 작성일: 2026-05-01  
> 상태: MVP backend defaults 반영  
> 대상 스택: Vercel + Supabase

## 1. 목적

이 문서는 K-Beauty Guide의 목표 아키텍처를 한눈에 설명한다. 현재 앱은 React 기반 정적 프로토타입이지만, 다음 단계에서는 제품 데이터, 성분 데이터, 크롤링 자동화, 관리자 검수, 사용자 민감 성분 경고를 포함하는 데이터 중심 서비스로 확장한다.

상세 자동화 설계는 [제품 크롤링 및 성분 안전성 자동화 설계](../superpowers/specs/2026-05-01-product-ingestion-ingredient-safety-design.md)를 기준으로 한다. 이 문서는 그 설계를 상위 시스템 구조로 연결한다.
MVP에서 흔들리면 안 되는 결정값은 [MVP Backend Decision Record](./06-mvp-backend-decisions.md)를 기준으로 한다.

## 2. 시스템 목표

### 사용자 가치

- 외국인 사용자가 K-뷰티 제품을 영어 중심으로 탐색한다.
- 한국어/INCI 성분명을 이해 가능한 설명으로 변환한다.
- 사용자의 피부 타입과 민감 성분 기준에 따라 주의할 성분을 보여준다.
- 서울 오프라인 쇼핑 장소와 제품 탐색을 하나의 여정으로 연결한다.

### 운영 가치

- 신규 제품을 수동 입력만으로 관리하지 않는다.
- 크롤러가 제품 후보를 자동 수집하되, 공개 전에는 관리자 검수를 거친다.
- 성분 안전성 판단은 LLM 단독 판단이 아니라 규칙, 출처, 감사 로그를 기반으로 한다.
- Supabase와 Vercel 중심으로 MVP를 운영하고, 필요한 경우에만 외부 worker를 추가한다.

## 3. 최상위 구성

```text
사용자 브라우저
   |
   v
Vercel Web App
   |-- Public App: Home / Products / Ingredients / Shopping Map / Skin Quiz
   |-- Admin App: Product Review / Ingredient Review / Crawl Monitoring
   |
   v
Supabase
   |-- Auth: 사용자, 관리자, 서비스 역할
   |-- Postgres: 제품, 성분, 크롤링, AI 품질 보정, 검수, 사용자 프로필
   |-- Storage: 제품 이미지, 원본 snapshot, import 파일
   |-- Edge Functions: API, ingestion, parser, rule engine
   |-- Cron: 정기 제품 감지와 재분석 트리거
   |-- Work queues/tables: crawl_tasks, review_items, safety_analysis_runs
   |
   v
외부 소스
   |-- 브랜드 공식몰
   |-- 허용된 커머스/카탈로그 소스
   |-- 공식 성분/규제 데이터 소스
```

## 4. Vercel 책임

Vercel은 사용자가 직접 보는 화면과 관리자 운영 화면을 담당한다.

### Public App

- 제품 목록과 제품 상세
- 성분 검색과 성분 분석 결과
- 사용자 피부 타입 퀴즈
- 쇼핑 지도
- 사용자 민감 성분 경고 표시

### Admin App

- 크롤링된 제품 후보 검수
- 원본 snapshot 확인
- 제품 필드 수정
- 중복 제품 병합
- 성분 매칭 실패 처리
- 안전성 규칙 영향 확인
- 승인/반려/재분석 실행

### Vercel에서 피해야 할 역할

- 장시간 크롤링 작업
- 대량 HTML/이미지 처리
- 크롤링 상태의 시스템 오브 레코드
- 민감 사용자 데이터의 직접 보관

Vercel Functions나 API Routes는 프론트와 가까운 가벼운 요청에만 사용한다. 장시간 작업은 Supabase의 작업 테이블(`crawl_tasks`, `review_items`, `safety_analysis_runs`) 또는 외부 worker에 위임한다.

## 5. Supabase 책임

Supabase는 데이터와 백엔드 자동화의 중심이다.

### Postgres

주요 도메인 데이터를 보관한다.

- 제품: `products`, `brands`, `product_images`, `product_sources`
- 성분: `ingredients`, `ingredient_aliases`, `ingredient_evidence`, `product_ingredients`
- 안전성: `ingredient_safety_rules`, `safety_analysis_runs`, `product_safety_flags`
- 크롤링: `ingestion_sources`, `crawl_tasks`, `raw_product_snapshots`, `product_candidates`
- AI 품질 보정: `candidate_embeddings`, `duplicate_suggestions`, `ai_assessment_runs`, `field_extraction_suggestions`
- 검수: `review_items`, `admin_audit_logs`
- 사용자: `user_profiles`, `user_avoid_ingredients`, `user_favorites`, `quiz_results`

### Auth and RLS

- 일반 사용자는 공개 승인된 제품/성분만 읽을 수 있다.
- 사용자는 자기 민감 성분 프로필만 읽고 수정할 수 있다.
- 관리자는 검수 큐와 원본 snapshot을 볼 수 있다.
- Edge Function의 service role은 크롤링, 파싱, 재분석 작업에만 제한적으로 사용한다.

### Storage

- 제품 이미지 mirror
- 원본 HTML/JSON snapshot
- 수동 import CSV
- 라벨 이미지 입력은 별도 feasibility 이후에만 추가

원본 snapshot은 파서 개선과 감사 추적을 위해 보관한다. 공개 앱에는 검수된 결과만 노출한다.

### Edge Functions, Cron, Work Tables

- Cron이 정해진 주기로 소스 확인 작업을 생성한다.
- `crawl_tasks`, `review_items`, `safety_analysis_runs`가 크롤링, 검수, 재분석 작업 상태를 보관한다.
- Edge Function이 작은 단위의 작업을 처리한다.
- 실패한 작업은 상태, 에러, 재시도 시간을 남긴다.

프론트엔드, 관리자 콘솔, worker가 사용하는 endpoint와 payload shape는 [API Contract](../api/01-api-contract.md)를 기준으로 한다.

## 6. 주요 데이터 흐름

### 6.1 제품 수집 흐름

```text
Admin registers source
   -> Cron creates crawl_tasks
   -> Worker fetches source page or feed
   -> Raw snapshot stored
   -> Parser extracts product candidate
   -> Deduplication checks existing products
   -> AI quality layer suggests duplicates and field fixes
   -> Candidate enters review queue with reason codes
   -> Admin approves
   -> Product becomes public
```

초기에는 HTML/API/sitemap/RSS처럼 브라우저 자동화가 필요 없는 소스부터 시작한다. Playwright 기반 크롤링은 MVP 이후 외부 worker로 분리한다. 자세한 제품 수집 구조는 [Product Ingestion Pipeline](./04-product-ingestion-pipeline.md)을 기준으로 한다.

### 6.2 성분 분석 흐름

```text
Product ingredient text
   -> Normalize punctuation and separators
   -> Split into ordered ingredient list
   -> Match ingredient aliases
   -> Store product_ingredients
   -> Run safety rules
   -> Store product_safety_flags
   -> Show explainable warnings in product UI
```

성분 순서는 보존하지만 정확한 농도처럼 해석하지 않는다. 제품 라벨 순서 기반의 참고 정보로만 표시한다. 자세한 rule, evidence, 사용자 민감 성분 overlay는 [Ingredient Safety Engine](./05-ingredient-safety-engine.md)을 기준으로 한다.

### 6.3 사용자 민감 성분 흐름

```text
User sets avoid ingredients or categories
   -> Profile stored with consent
   -> Product detail loads parsed ingredients
   -> Rule engine compares product with user profile
   -> UI shows user-specific warning
```

사용자의 알레르기/민감 성분 정보는 건강 정보에 가까운 민감 데이터로 취급한다. 기본값은 비저장 또는 명시적 동의 후 저장이다.

## 7. 핵심 모듈 경계

### Product Catalog

공개 제품 데이터를 제공한다. 크롤링 원본이나 검수 중 후보를 직접 공개하지 않는다.

### Product Ingestion

외부 소스에서 제품 후보를 수집한다. 수집 성공은 공개 성공이 아니다. 모든 후보는 검수 또는 높은 신뢰도 정책을 거친다.

### AI Quality Layer

수집된 제품 후보의 중복 가능성, 필드 추출 품질, 성분 텍스트 정리 필요성을 평가한다. 우선순위는 deterministic parser와 embedding similarity이며, 작은 LLM은 낮은 신뢰도나 충돌 케이스의 보조 제안에만 사용한다.

### Ingredient Knowledge Base

성분의 표준명, 한글명, INCI명, 별칭, 출처, 기능 태그를 관리한다. 제품 수집 파이프라인과 독립적으로 업데이트할 수 있어야 한다.

### Safety Rule Engine

성분 목록과 사용자 프로필을 입력받아 설명 가능한 경고를 생성한다. LLM은 추출 보조나 문구 초안에는 쓸 수 있지만 최종 위험 판단의 단독 근거가 되면 안 된다.

### Admin Review

자동화가 만든 후보와 불확실성을 사람이 검수하는 운영 계층이다. MVP에서는 관리자 승인 후 공개가 기본 정책이다.

### Public UI

검수된 제품, 성분, 안전성 설명을 사용자에게 보여준다. 과도한 공포 표현이나 의학적 진단처럼 보이는 문구를 피한다.

## 8. MVP 아키텍처

MVP에서는 아래 범위까지만 구현한다.

- Supabase schema와 seed 데이터
- 제품/성분 데이터의 DB 이전
- 매장 데이터는 Shopping Map의 정적 fallback으로 유지하고, 지도/매장 DB는 Phase 2에서 확장
- 제품 상세 페이지와 성분 분석 결과
- 관리자 수동 제품 입력
- 1-2개 소스의 비브라우저 크롤링
- 원본 snapshot 저장
- 임베딩 기반 중복 후보 제안
- 성분 alias 기반 매칭
- 기본 safety rule engine
- 관리자 검수 큐
- Vercel 배포

MVP에서 제외한다.

- 완전 자동 공개
- 대규모 크롤링
- 브라우저 자동화 기반 크롤러
- 라벨 이미지 인식 기능은 별도 feasibility 이후 검토
- 의료성 진단
- 복잡한 개인화 추천 엔진

## 9. Phase 2 아키텍처

MVP가 안정화되면 다음 확장을 고려한다.

- Next.js 전환 또는 현재 React 앱의 라우팅/데이터 패칭 구조 개선
- 제품 소스 확대
- Supabase Storage 이미지 mirror
- 사용자 계정 기반 민감 성분 프로필
- 성분 unknowns dashboard
- rule 변경 시 기존 제품 재분석
- 관리자 콘솔 고도화
- 다국어 설명 레이어

브라우저 자동화, 대량 크롤링, 긴 이미지 처리, 차단 회피가 필요한 시점에는 외부 worker를 추가한다. 이 경우에도 Supabase는 작업 큐와 결과 저장의 중심으로 유지한다.

## 10. Frontend App Builder 활용 지점

`build-web-apps:frontend-app-builder`는 아래 화면을 만들 때 사용한다.

- Admin Review Console
- Product Detail Safety Report
- Ingredient Search and Analyzer
- User Sensitivity Profile setup
- Public app redesign or Next.js migration

사용 방식은 다음 순서를 따른다.

1. 먼저 문서로 화면 목적, 데이터, workflow를 정의한다.
2. `frontend-app-builder`로 화면 콘셉트를 생성한다.
3. 사용자가 콘셉트를 승인한다.
4. 현재 CRA + React Router 구현으로 옮긴다. Next.js 전환은 별도 마이그레이션 결정 후에만 적용한다.
5. 브라우저에서 데스크톱/모바일을 검증한다.

관리자 콘솔은 특히 이 플러그인에 잘 맞는다. 단순 CRUD가 아니라 원본 evidence, 자동 추출 결과, 성분 매칭, 경고 룰, 승인 이력을 한 화면에서 판단해야 하기 때문이다.

## 11. 다음 문서화 순서

권장 순서:

1. [Data Model](./02-data-model.md)
2. [Crawlability Precheck](./03-crawlability-precheck.md)
3. [Product Ingestion Pipeline](./04-product-ingestion-pipeline.md)
4. [Ingredient Safety Engine](./05-ingredient-safety-engine.md)
5. [Admin Review Console UX Spec](../superpowers/specs/2026-05-01-admin-review-console-ux-spec.md)
6. [API Contract](../api/01-api-contract.md)
7. [MVP Backend Decision Record](./06-mvp-backend-decisions.md)
8. [MVP Implementation Plan](../superpowers/plans/2026-05-01-mvp-implementation-plan.md)
9. [Deployment Runbook](../ops/01-deployment-runbook.md)

다음 단계에서는 구현 계획을 task 단위로 실행하고, 배포 운영 절차는 [Deployment Runbook](../ops/01-deployment-runbook.md)을 기준으로 검증한다.

## 12. 현재 결정 사항

- 배포 기본축은 Vercel + Supabase로 간다.
- Supabase를 백엔드 시스템 오브 레코드로 둔다.
- 크롤러는 작은 `crawl_tasks` 단위로 쪼갠다.
- 크롤러는 core와 source connector를 분리한 모듈형 구조로 설계한다.
- 제품 수집과 성분 안전성 파이프라인은 분리한다.
- 크롤링 가능성 재검증은 Codex 앱 세션이 아니라 실제 구현/테스트 단계에서 수행한다.
- MVP에서는 관리자 승인 후 공개를 기본으로 한다.
- 성분 안전성은 출처 기반 rule engine으로 판단한다.
- 성분 parser, alias matcher, safety rule engine, 사용자 민감 성분 overlay를 분리한다.
- AI 품질 보정은 embedding 중복 제안을 먼저 적용하고, 작은 LLM은 낮은 신뢰도/충돌 케이스의 보조 추출에만 사용한다.
- LLM은 보조 추출/요약/필드 정리에만 사용하고 최종 판단자로 두지 않는다.

## 13. MVP 기준값

남은 아키텍처 결정은 [MVP Backend Decision Record](./06-mvp-backend-decisions.md)에 MVP 기본값으로 잠갔다.

핵심 기준:

- CRA + React Router로 MVP를 진행하고 Next.js 전환은 post-MVP로 분리한다.
- 첫 크롤링은 공식 브랜드 사이트 중심으로 시작하고 commerce source live crawling은 post-MVP 후보로 둔다.
- 사용자 민감 성분 설정은 LocalStorage로 시작하고 서버 저장은 동의/삭제 흐름 이후로 미룬다.
- AI 품질 보정은 deterministic dedupe와 embedding suggestion을 우선하고, small LLM은 낮은 신뢰도 필드 제안에만 사용한다.
- 성분 안전성 UI는 KR/EU/US source metadata를 저장할 수 있지만 법적 compliance 판정으로 표현하지 않는다.
