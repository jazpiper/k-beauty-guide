# K-Beauty Guide — 프로젝트 기획 문서

> 작성일: 2026-04-15  
> 버전: v0.1 (현재 구현 기준)

## 페이지별 상세 기획

| 페이지 | 문서 |
|---|---|
| Home | [docs/pages/01_home.md](docs/pages/01_home.md) |
| Products | [docs/pages/02_products.md](docs/pages/02_products.md) |
| Ingredients | [docs/pages/03_ingredients.md](docs/pages/03_ingredients.md) |
| Shopping Map | [docs/pages/04_shopping_map.md](docs/pages/04_shopping_map.md) |
| Skin Quiz | [docs/pages/05_skin_quiz.md](docs/pages/05_skin_quiz.md) |

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

## 2. 현재 구현 현황 (v0.1)

### 기술 스택
- **프레임워크**: React 18 (CRA)
- **라우팅**: 상태 기반 커스텀 내비게이션 (`activePage` state)
- **스타일**: CSS (각 페이지별 분리, 반응형)
- **데이터**: 하드코딩 (별도 DB·API 없음)
- **배포**: 미정

### 구현된 페이지

#### Home
- 히어로 배너 + 검색창 (UI만)
- 카테고리 빠른 탐색 (Toner, Serum, Moisturizer, Sunscreen, Cleanser, Eye Cream)
- 트렌딩 제품 카드 4개 (좋아요 토글)
- 주요 기능 소개 섹션 (Scan Ingredients, Find Stores, Skin Quiz)
- Skin Quiz 배너 CTA

#### Products
- 제품 목록 12개 (하드코딩)
- 필터: 카테고리 × 피부 타입 × 정렬 (인기순/별점순)
- 텍스트 검색 (제품명·브랜드)
- 좋아요 토글

#### Ingredients (성분 분석기)
- 성분 12종 정보 카드
- 성분 목록 붙여넣기 → 인식 결과 표시 (텍스트 매칭)
- 효능별 필터 탭 (Hydration, Brightening, Soothing 등)
- 카드 클릭 시 상세 설명 토글

#### Shopping Map
- 서울 K-뷰티 매장 8곳
- 지역(Area) · 매장 유형(Type) 필터
- 클릭 시 매장 상세 (영업시간, 추천 제품) 표시
- 지도: 시각적 플레이스홀더 (실제 지도 미연동)

#### Skin Quiz
- 5문항 피부 타입 진단 퀴즈
- 결과: Dry / Oily / Combination / Sensitive / Normal
- 스킨케어 팁 + 추천 제품 + 추천 성분 결과 화면

---

## 3. 현재 한계 및 문제점

| 구분 | 내용 |
|---|---|
| 데이터 | 제품·성분·매장 모두 하드코딩. 실제 데이터 반영 불가 |
| 검색 | Home 검색창은 동작하지 않음 (입력값 처리 미구현) |
| 지도 | ShoppingMap이 실제 지도가 아닌 CSS 플레이스홀더 |
| 라우팅 | URL이 변하지 않아 딥링크·뒤로가기 불가 |
| 제품 상세 | "View Details" 버튼 동작 없음 |
| 상태 유지 | 좋아요·필터 등이 새로고침 시 초기화 |
| 성분 스캔 | 카메라 연동 없이 텍스트 붙여넣기만 가능 |
| 다국어 | 영어 고정. 한국어·일본어 등 미지원 |

---

## 4. 개선 로드맵

### Phase 1 — 기반 강화 (MVP 완성)
**목표**: 현재 UI가 실제로 동작하도록

| 작업 | 설명 | 우선순위 |
|---|---|---|
| React Router 도입 | URL 기반 라우팅으로 전환 | 높음 |
| 홈 검색 기능 연결 | Products·Ingredients 페이지와 연동 | 높음 |
| 제품 상세 페이지 | 각 제품 클릭 시 상세 정보 표시 | 높음 |
| 실제 지도 연동 | Google Maps / Kakao Maps API | 높음 |
| 데이터 분리 | `src/data/` 폴더로 JSON 분리 | 중간 |
| LocalStorage | 좋아요·퀴즈 결과 저장 | 중간 |

### Phase 2 — 데이터 & 콘텐츠 확장
**목표**: 실제 서비스로 쓸 수 있는 데이터 규모

| 작업 | 설명 |
|---|---|
| 백엔드 API | Node.js + Supabase (또는 Firebase) |
| 제품 DB 구축 | 100+ 제품, 실제 이미지, 구매 링크 |
| 성분 DB 확장 | 50+ 성분, INCI 표준명 포함 |
| 매장 DB 확장 | 지역별 30+ 매장, 리뷰 연동 |
| 관리자 CMS | 데이터 직접 입력/수정 인터페이스 |

### Phase 3 — 개인화 & 소셜
**목표**: 재방문 유도 및 커뮤니티 형성

| 작업 | 설명 |
|---|---|
| 회원가입/로그인 | 소셜 로그인 (Google, Apple) |
| 마이페이지 | 내 피부 타입, 위시리스트, 루틴 저장 |
| 리뷰 시스템 | 제품별 사용자 리뷰 및 별점 |
| 루틴 빌더 | 아침/저녁 스킨케어 루틴 조합 추천 |
| AI 성분 분석 | Claude API 연동으로 성분 조합 경고 |

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
│   ├── data/             # 정적 JSON 데이터 (Phase 1)
│   ├── hooks/            # 커스텀 훅 (useProducts, useFavorites, ...)
│   ├── api/              # API 클라이언트 (Phase 2~)
│   └── utils/            # 헬퍼 함수
├── public/
└── package.json
```

**Phase 2+ 백엔드**
- API: Supabase (PostgreSQL + REST + Realtime)
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

- [ ] React Router v6 마이그레이션
- [ ] 홈 검색창 동작 구현 (Products 페이지로 쿼리 전달)
- [ ] 제품 상세 모달 또는 페이지 구현
- [ ] Kakao Maps API 키 발급 및 ShoppingMap 연동
- [ ] `src/data/products.json`, `src/data/ingredients.json`으로 데이터 분리
- [ ] Vercel 배포 세팅
