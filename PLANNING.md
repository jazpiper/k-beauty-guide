# K-Beauty Guide — 프로젝트 기획 문서

> 작성일: 2026-04-15  
> 버전: v0.2 (현재 구현 기준)

## 페이지별 상세 기획

| 페이지 | 문서 |
|---|---|
| Home | [docs/pages/01_home.md](docs/pages/01_home.md) |
| Products | [docs/pages/02_products.md](docs/pages/02_products.md) |
| Ingredients | [docs/pages/03_ingredients.md](docs/pages/03_ingredients.md) |
| Shopping Map | [docs/pages/04_shopping_map.md](docs/pages/04_shopping_map.md) |
| Skin Quiz | [docs/pages/05_skin_quiz.md](docs/pages/05_skin_quiz.md) |

## 아키텍처 설계 문서

| 주제 | 문서 |
|---|---|
| 전체 시스템 아키텍처 | [docs/architecture/01-system-overview.md](docs/architecture/01-system-overview.md) |
| Supabase 데이터 모델 | [docs/architecture/02-data-model.md](docs/architecture/02-data-model.md) |
| 크롤링 가능성 선체크 | [docs/architecture/03-crawlability-precheck.md](docs/architecture/03-crawlability-precheck.md) |
| 모듈형 제품 수집 파이프라인 | [docs/architecture/04-product-ingestion-pipeline.md](docs/architecture/04-product-ingestion-pipeline.md) |
| 성분 안전성 엔진 | [docs/architecture/05-ingredient-safety-engine.md](docs/architecture/05-ingredient-safety-engine.md) |
| MVP 백엔드 결정값 | [docs/architecture/06-mvp-backend-decisions.md](docs/architecture/06-mvp-backend-decisions.md) |
| API 계약 | [docs/api/01-api-contract.md](docs/api/01-api-contract.md) |
| 배포 운영 Runbook | [docs/ops/01-deployment-runbook.md](docs/ops/01-deployment-runbook.md) |
| MVP 구현 계획 | [docs/superpowers/plans/2026-05-01-mvp-implementation-plan.md](docs/superpowers/plans/2026-05-01-mvp-implementation-plan.md) |
| 제품 크롤링 및 성분 안전성 자동화 | [docs/superpowers/specs/2026-05-01-product-ingestion-ingredient-safety-design.md](docs/superpowers/specs/2026-05-01-product-ingestion-ingredient-safety-design.md) |
| 관리자 검수 콘솔 UX | [docs/superpowers/specs/2026-05-01-admin-review-console-ux-spec.md](docs/superpowers/specs/2026-05-01-admin-review-console-ux-spec.md) |

---

## 1. 프로젝트 개요

### 서비스 한 줄 정의
K-뷰티에 관심 있는 **외국인**을 위한 한국 화장품 정보 통합 가이드 플랫폼

### 핵심 가치
- **언어 장벽 해소** — 한국 성분명·제품명을 영어로 쉽게 탐색
- **구매 여정 단일화** — 성분 분석 → 제품 탐색 → 매장 찾기까지 한 앱에서
- **피부 타입 맞춤화** — 퀴즈 기반 개인화 추천

### 타겟 사용자
| 세그먼트 | 설명 |
|---|---|
| 방한 외국인 관광객 | 서울 현지 쇼핑을 계획 중인 K-뷰티 입문자 |
| 해외 K-뷰티 팬 | 직구·유튜브 등으로 이미 관심을 가진 사용자 |
| 뷰티 인플루언서 | 콘텐츠 제작 리서치용 |

---

## 2. 현재 구현 현황 (v0.2)

### 기술 스택
- **프레임워크**: React 18 (CRA)
- **라우팅**: React Router v6 (`/products`, `/products/:slug`, `/ingredients`, `/shopping-map`, `/skin-quiz`)
- **스타일**: CSS (각 페이지별 분리, 반응형)
- **프론트 데이터**: Supabase client + static fallback
- **백엔드**: Supabase migrations, seed, RLS, sanitized public views/RPC, Edge Function shell
- **크롤러**: source-agnostic core contract + connector shell
- **배포 목표**: Vercel Web + Supabase Backend

### 구현된 페이지

#### Home
- 히어로 배너 + 검색창 (UI만)
- 카테고리 빠른 탐색 (Toner, Serum, Moisturizer, Sunscreen, Cleanser, Eye Cream)
- 트렌딩 제품 카드 4개 (좋아요 토글)
- 주요 기능 소개 섹션 (Scan Ingredients, Find Stores, Skin Quiz)
- Skin Quiz 배너 CTA

#### Products
- 제품 목록 12개 static fallback
- Supabase 설정 시 `v_public_products` view에서 공개 제품 목록 조회
- 필터: 카테고리 × 피부 타입 × 정렬 (인기순/별점순)
- 텍스트 검색 (제품명·브랜드)
- 좋아요 토글
- `View Details` 클릭 시 `/products/:slug` 상세 페이지 이동

#### Product Detail
- URL 기반 제품 상세 페이지 (`/products/:slug`)
- Supabase 설정 시 `get_public_product_detail(product_slug)` RPC 호출
- 제품 이미지/이모지 fallback, 가격, 카테고리, 공개 source 링크 표시
- 성분 목록, caution/allergy note, 최고 severity 요약 표시
- Supabase 미설정 시 static fallback 상세 리포트 표시
- unknown slug 상태 처리

#### Ingredients (성분 분석기)
- 성분 13종 static fallback 카드 (Fragrance 포함)
- Supabase 설정 시 `v_public_ingredients` view에서 공개 성분 목록 조회
- 성분 목록 붙여넣기 → `analyze-ingredient-text` Edge Function 호출
- Supabase 미설정 시 local fallback alias 매칭
- 효능별 필터 탭 (Hydration, Brightening, Soothing 등)
- 카드 클릭 시 상세 설명 토글

#### Shopping Map
- 서울 K-뷰티 매장 8곳
- 지역(Area) · 매장 유형(Type) 필터
- 클릭 시 매장 상세 (영업시간, 추천 제품) 표시
- 지도: 시각적 플레이스홀더 (실제 지도 미연동)

#### Skin Quiz
- 5문항 피부 타입 추정/가이드 퀴즈
- 결과: Dry / Oily / Combination / Sensitive / Normal
- 스킨케어 팁 + 추천 제품 + 추천 성분 결과 화면

---

## 3. 현재 한계 및 문제점

| 구분 | 내용 |
|---|---|
| 데이터 | 제품·성분은 Supabase 연결 구조가 생겼지만 실제 hosted project/env 검증 전에는 static fallback 중심 |
| 검색 | Home 검색창은 동작하지 않음 (입력값 처리 미구현) |
| 지도 | ShoppingMap이 실제 지도가 아닌 CSS 플레이스홀더 |
| 라우팅 | 핵심 라우트는 도입됨. 필터/검색 상태의 URL query 동기화는 미구현 |
| 제품 상세 | 제품 상세 페이지는 구현됨. 리뷰, 추천 제품, 구매 링크, SEO metadata는 미구현 |
| 상태 유지 | 좋아요·필터 등이 새로고침 시 초기화 |
| 성분 스캔 | 카메라/OCR 없이 텍스트 붙여넣기만 가능 |
| 백엔드 검증 | Supabase local reset/lint는 Docker/Postgres local stack 필요 |
| 크롤러 | connector/core shell만 있음. 실제 source별 fetch/robots/rate-limit 검증은 구현 단계에서 수행 |
| 다국어 | 영어 고정. 한국어·일본어 등 미지원 |

---

## 4. 개선 로드맵

### Phase 1 — MVP 데이터 기반 구축
**목표**: 현재 UI를 실제 데이터 흐름과 연결하고, 제품 수집·성분 안전성·관리자 검수의 최소 루프를 완성

| 작업 | 설명 | 우선순위 |
|---|---|---|
| React Router 도입 | URL 기반 라우팅으로 전환 | 완료 |
| 홈 검색 기능 연결 | Products·Ingredients 페이지와 연동 | 높음 |
| 제품 상세 페이지 고도화 | 추천 제품, 구매 링크, SEO metadata, source evidence 표시 개선 | 높음 |
| 데이터 분리 | `src/data/` JS seed/fallback 모듈로 정적 데이터 분리 | 완료 |
| Supabase 스키마·RLS | 제품, 성분, 크롤링, 안전성, 검수 테이블 구축 | 완료/검증 필요 |
| 공개 API 클라이언트 | Supabase 사용 가능 시 API, 미설정 시 정적 fallback | 완료 |
| 성분 안전성 엔진 | 텍스트 성분 파싱, 매칭, rule 기반 민감 성분 표시 | 진행 중 |
| 관리자 검수 콘솔 | 크롤링 후보, 성분 매칭, 안전성 rule 검수 큐 | 높음 |
| 모듈형 크롤러 기반 | connector 방식의 수집 계약과 수동 import fallback | 완료/확장 필요 |
| LocalStorage | 좋아요·피부 타입 추정 결과 저장, 민감 데이터는 명시 동의 전 서버 저장 금지 | 중간 |

### Phase 2 — 자동화·콘텐츠 확장
**목표**: 허용된 소스를 늘리고 운영 자동화와 사용자 경험을 확장

| 작업 | 설명 |
|---|---|
| 제품 DB 확장 | 100+ 제품, 실제 이미지, 구매 링크 |
| 성분 DB 확장 | 200+ 성분, INCI 표준명·동의어·근거 출처 포함 |
| 크롤링 소스 확장 | 허용된 브랜드·카탈로그 source connector 추가 |
| 실제 지도 연동 | Google Maps / Kakao Maps API, 지역별 매장 DB |
| 관리자 CMS 고도화 | 데이터 직접 입력·수정, audit log, source health 모니터링 |
| 사용자 동의 기반 프로필 | 알레르기·회피 성분 서버 저장은 동의·삭제 흐름 이후 도입 |

### Phase 3 — 개인화 & 소셜
**목표**: 재방문 유도 및 커뮤니티 형성

| 작업 | 설명 |
|---|---|
| 회원가입/로그인 | 소셜 로그인 (Google, Apple) |
| 마이페이지 | 내 피부 타입, 위시리스트, 루틴 저장 |
| 리뷰 시스템 | 제품별 사용자 리뷰 및 별점 |
| 루틴 빌더 | 아침/저녁 스킨케어 루틴 조합 추천 |
| AI 보조 품질 개선 | 임베딩 중복 제안, 낮은 신뢰도 필드 보정, 성분 안전성은 rule engine 유지 |

### Phase 4 — 수익화
| 모델 | 설명 |
|---|---|
| 제휴 링크 | Olive Young, 쿠팡 파트너스 커미션 |
| 브랜드 프리미엄 노출 | 브랜드 공식 스폰서 카드 |
| 프리미엄 기능 | 상세 루틴 분석, 성분 충돌 검사 유료화 |

---

## 5. 기술 아키텍처 (목표 구조)

```
k-beauty-guide/
├── src/
│   ├── components/       # 공통 UI (Navbar, Card, Modal, ...)
│   ├── pages/            # 라우트별 페이지
│   ├── data/             # 정적 JS seed/fallback 데이터
│   ├── hooks/            # 커스텀 훅 (useProducts, useFavorites, ...)
│   ├── api/              # Supabase API 클라이언트 + 정적 fallback
│   ├── routes/           # React Router route 구성
│   ├── safety/           # 성분 파서, 매칭, rule engine
│   └── utils/            # 헬퍼 함수
├── supabase/             # migrations, seed, Edge Functions
├── crawler/              # 모듈형 crawler core + source connectors
├── public/
└── package.json
```

**MVP 백엔드**
- API: Supabase (PostgreSQL + REST/RPC + Edge Functions)
- 인증: Supabase Auth
- 이미지: Supabase Storage 또는 Cloudinary
- 배포: Vercel (프론트) + Supabase (백엔드)

---

## 6. 핵심 지표 (KPI)

| 지표 | 설명 |
|---|---|
| MAU | 월간 활성 사용자 수 |
| 퀴즈 완료율 | 퀴즈 시작 대비 완료 비율 |
| 성분 분석 횟수 | Ingredients 페이지 분석 액션 수 |
| 제품 클릭률 | 제품 상세 진입 비율 |
| 지도 매장 클릭률 | Shopping Map 인터랙션 비율 |

---

## 7. 다음 액션 아이템

- [x] React Router v6 마이그레이션
- [x] 제품 상세 페이지 1차 구현
- [x] Supabase 공개 목록/상세/성분 analyzer client 연결
- [x] `src/data/products.js`, `src/data/ingredients.js`로 seed/fallback 데이터 분리
- [x] Supabase schema/RLS/seed 작성
- [x] 크롤러 core types와 `manual-import`, `sitemap-only` connector shell 작성
- [ ] 홈 검색창 동작 구현 (Products 페이지로 쿼리 전달)
- [ ] 제품 상세에 source evidence, 추천 제품, 구매 링크, SEO metadata 추가
- [ ] Shopping Map 정적 매장 데이터/좌표 준비 (실제 지도 API 연동은 Phase 2)
- [ ] Local Supabase stack에서 migration/seed/function smoke 검증
- [x] 성분 파서·안전성 rule engine을 frontend fallback과 Edge Function 양쪽에 일관되게 정리
- [ ] 관리자 검수 큐 shell 구현
- [ ] source별 크롤링 dry run 검증 후 connector 추가
- [ ] Vercel 배포 세팅
