# MVP Backend Decision Record

> 작성일: 2026-05-02
> 상태: MVP implementation default 확정
> 범위: Supabase, Vercel, crawler, ingredient safety, admin review

이 문서는 백엔드 아키텍처의 남은 결정을 MVP 기본값으로 잠그는 기준 문서다. 이후 구현 중 바뀌는 결정은 이 문서에 decision update로 남긴다.

## 1. Runtime and Deployment

| Decision | MVP Default |
|---|---|
| Public/admin web runtime | 현재 CRA + React Router 유지 |
| Next.js migration | MVP 이후 별도 migration decision으로 분리 |
| Deployment | Vercel Web/Admin App + Supabase backend |
| Backend system of record | Supabase Postgres |
| Long-running or browser-heavy work | MVP 제외, 필요 시 외부 worker 추가 |

## 2. Public API Shape

| Decision | MVP Default |
|---|---|
| Product list | `v_public_products` view 중심 |
| Product detail | `get_public_product_detail(product_slug)` RPC 중심의 sanitized response |
| Product safety report | latest successful `safety_analysis_runs` 기준으로만 공개 |
| Public ingredient search | sanitized public view/RPC |
| Public ingredient detail | raw evidence/rule row를 숨긴 sanitized server-side response |
| Browser credentials | anon key only |
| Service role | Edge Functions, scheduled jobs, trusted workers only |

Privileged DB code는 가능하면 unexposed/private schema 또는 Edge Function wrapper 뒤에 둔다. Public schema에 둘 수밖에 없는 경우에도 fixed `search_path`, explicit grants, sanitized output, review된 SQL만 허용한다.

Current implementation note: `get_public_product_detail`은 public schema의 `security definer` RPC로 구현되어 있으므로 output sanitize와 explicit source-status filtering을 SQL 안에 유지한다.

## 3. Admin and Roles

| Decision | MVP Default |
|---|---|
| Admin source of truth | `admin_users` table 또는 equivalent admin profile table |
| JWT custom claims | Post-MVP optimization, source of truth로 쓰지 않음 |
| User-editable metadata | authorization에 사용 금지 |
| Product candidate approval | mandatory admin comment required |
| Safety rule / restricted / evidence changes | second review required before public impact |
| Reviewer assignment | manual assignment only in MVP |
| Source management UI | admin console에 최소 pause/resume/action 화면 포함 |

## 4. Rate Limits and Public Analyzer

| Decision | MVP Default |
|---|---|
| Anonymous analyzer limit | 20 requests/hour/IP |
| Authenticated analyzer limit | 100 requests/hour/user |
| Max ingredient text length | 10,000 characters |
| Raw user input persistence | MVP에서 저장하지 않음 |
| Abuse logging | raw text 없이 hash/count/status 중심으로 기록 |

## 5. Raw Snapshot Preview

| Decision | MVP Default |
|---|---|
| Admin preview format | plain text preview + JSON tree |
| Sanitized HTML preview | MVP 제외 |
| Raw file access | admin-only signed URL or storage path lookup |
| Public exposure | 금지 |

## 6. Crawler Sources

| Decision | MVP Default |
|---|---|
| First source strategy | official brand sites first |
| Implemented connector shells | `manual-import`, `sitemap-only` |
| Planned MVP connector | `shopify-official` after source dry run |
| Commerce source | `stylekorean`은 post-MVP candidate, MVP live source 아님 |
| Initial source candidates | COSRX official, Laneige official, Beauty of Joseon official, plus one Shopify-based official brand after robots/terms dry run |
| Crawlability verification | implementation/testing stage에서 robots, terms, rate limit 재확인 |
| Auto-publish | 금지, admin approval required |

## 7. Snapshot Retention

| Decision | MVP Default |
|---|---|
| Default raw snapshot retention | 30 days |
| Source override | `ingestion_sources.snapshot_retention_days`로 7-90 days 조정 |
| Approved product evidence summary | 장기 보관 가능하되 원문 전체가 아닌 summary/hash 중심 |
| Manual import files | 90 days 기본, admin deletion 가능 |

## 8. AI Quality Layer

| Decision | MVP Default |
|---|---|
| First duplicate pass | deterministic dedupe first |
| Embedding | pgvector schema + provider adapter 준비 |
| Embedding provider/model | implementation-time benchmark로 선택, env-configurable |
| Small LLM | low-confidence field cleanup suggestion only |
| Resident/local LLM in Supabase | 사용하지 않음 |
| Final safety judgment | LLM 사용 금지 |
| Duplicate review threshold | deterministic exact match always review item; embedding similarity >= 0.88 creates suggestion |
| Auto-merge | 금지 |

## 9. User Sensitivity Data

| Decision | MVP Default |
|---|---|
| Storage | LocalStorage only |
| Server/account storage | consent copy + deletion flow 이후 |
| Personalized overlay | client-side only |
| Scan history | MVP에서 저장하지 않음 |

## 10. Ingredient Safety

| Decision | MVP Default |
|---|---|
| Source regions | KR + EU + US metadata can be stored |
| UI legal stance | legal compliance 판정 금지 |
| First rule seed | fragrance disclosure/allergen signal, preservative sensitizer, exfoliant caution, restricted/prohibited signal skeleton |
| Fragrance depth | generic `fragrance/parfum/향료` + high-frequency labelled fragrance allergens 중심의 limited seed |
| `restricted` public display | safety rule admin + second review 후 `source-based restriction signal`로만 표시 |
| Ingredient copy language | English public explanation first, Korean name parallel field |

## 11. Post-MVP Review Queue

- Next.js migration
- account-backed sensitivity profile
- server-side personalization
- sanitized HTML snapshot preview
- commerce connector live crawling
- trusted-source auto-publish, if ever considered
- dedicated external worker for browser-heavy sources
- fixed embedding/LLM vendor selection after benchmark
