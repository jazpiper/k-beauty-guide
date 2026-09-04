# [ARCHIVED / 동결] K-Beauty Guide 🌸

> ⚠️ **프로젝트 동결 안내 (2026-09-04)**
> 본 프로젝트는 프론트엔드 UI 프로토타입 및 Supabase/Edge Functions 스캐폴딩 검증 단계에서 동결(Archive)되었습니다.
> - **현재 상태:** React 프론트엔드 UI 및 12종 목업 데이터(`src/data/products.js`) 기반 렌더링, 유닛 테스트 135개 통과.
> - **미완성 영역:** 실제 라이브 크롤러 미연동(커넥터 쉘만 존재), 실제 제품 및 전성분 라이브 데이터베이스 미구축.
> - **향후 재개 시 요건:** 실서비스 론칭을 위해서는 올리브영/화해 등 실제 데이터셋 기반 시드 주입 또는 크롤링 파이프라인 완성 필요.

K-뷰티에 관심 있는 외국인을 위한 한국 화장품 & 성분 정보 가이드 플랫폼

## 시작하기

```bash
npm install
npm start
```

## 빌드

```bash
npm run build
```

## Docker 검증

Windows 로컬 Node/CRA 문제가 있을 때는 Docker Desktop + Node 20 컨테이너에서 분리 검증한다.

```bash
docker build -t k-beauty-guide .
docker run --rm k-beauty-guide npm run build
docker run --rm k-beauty-guide npm test -- --watchAll=false --runInBand
docker compose up app
```

## 백엔드 로컬 확인

```bash
npm run supabase:status
npm run supabase:reset
npm run smoke:supabase:local
```

`smoke:supabase:local`은 Supabase local stack을 시작하고, DB reset 후 analyzer Edge Function smoke까지 실행한 뒤 stack을 정리한다. Mac/Linux는 현재 repo 경로를 그대로 사용하고, Windows에서 프로젝트가 Google Drive/OneDrive 같은 클라우드 드라이브 또는 한글/공백 경로 아래 있으면 Docker bind mount 안정성을 위해 ASCII 임시 미러를 자동으로 사용한다.

```bash
npm run smoke:supabase:local -- --keep-stack
npm run smoke:supabase:local -- --mirror
npm run smoke:supabase:local -- --no-mirror
```

## 현재 실행 스택
- React 18
- React Router v6
- Supabase JS client
- CSS (반응형)

## 목표 MVP 스택
- Supabase: Postgres, Auth, Storage, Edge Functions, Cron-triggered work tables
- Vercel deployment target

## 현재 구현 스냅샷
- 공개 프론트: Home, Products, Product Detail, Ingredients, Shopping Map, Skin Quiz
- Products: `v_public_products` 연결, Supabase 미설정 시 static fallback
- Product Detail: `/products/:slug`, `get_public_product_detail(product_slug)` RPC 연결, fallback 상세 리포트
- Ingredients: `v_public_ingredients` 연결, `analyze-ingredient-text` Edge Function 연결, fallback alias 매칭
- Backend: Supabase migrations, seed, RLS, sanitized public views/RPC, Edge Function shell
- Crawler: source-agnostic core contract + `manual-import`, `sitemap-only` connector shell

## 개발 문서
- 문서 인덱스: [docs/README.md](docs/README.md)
- 전체 계획: [PLANNING.md](PLANNING.md)
- API 계약: [docs/api/01-api-contract.md](docs/api/01-api-contract.md)
- 시스템 아키텍처: [docs/architecture/01-system-overview.md](docs/architecture/01-system-overview.md)
- MVP 백엔드 결정값: [docs/architecture/06-mvp-backend-decisions.md](docs/architecture/06-mvp-backend-decisions.md)
- 배포 운영 Runbook: [docs/ops/01-deployment-runbook.md](docs/ops/01-deployment-runbook.md)
- MVP 구현 계획: [docs/superpowers/plans/2026-05-01-mvp-implementation-plan.md](docs/superpowers/plans/2026-05-01-mvp-implementation-plan.md)

## 현재 알려진 제한
- Local Supabase 검증은 Docker/Postgres local stack이 켜져 있어야 한다.
- 실제 크롤링 가능성 검증은 구현/테스트 단계에서 source별 robots/terms/rate limit을 다시 확인한다.
- CRA dependency chain의 npm audit 취약점은 남아 있으며, 프레임워크 마이그레이션 또는 dependency 정리 시 별도 처리한다.
