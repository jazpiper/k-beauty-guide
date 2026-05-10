# Crawlability Precheck

> 작성일: 2026-05-01  
> 상태: 초안  
> 방식: 2026-05-01에 이미 수행한 read-only 선체크 결과를 정리함. 추가 네트워크 요청 없이 작성.

## 1. 목적

이 문서는 제품 수집 파이프라인을 설계하기 전에 어떤 외부 소스가 실제로 수집 후보가 될 수 있는지 판단한 결과를 남긴다.

중요한 원칙:

- 이 문서는 법률 자문이 아니다.
- `robots.txt`, sitemap, 공개 HTML 접근성, JS 의존도, 차단 신호를 기준으로 한 기술/운영 선체크다.
- 우회, 로그인, 결제, 장바구니, 계정, private API, 차단 회피는 범위에서 제외한다.
- Codex 앱 세션에서는 외부 사이트에 추가 크롤링/자동 요청을 보내며 검증하지 않는다.
- 이후 검증은 실제 크롤러 구현 및 테스트 단계에서, 명시적인 테스트 계획과 rate limit을 둔 로컬/스테이징 환경으로 진행한다.
- 구현 단계에서는 각 사이트의 최신 `robots.txt`, 약관, rate limit을 다시 확인한 뒤 진행한다.

## 2. 평가 기준

| 등급 | 의미 |
|---|---|
| Good candidate | 공개 sitemap/HTML에서 제품 기본 데이터를 안정적으로 얻을 가능성이 높음 |
| Maybe | 일부 데이터는 가능하지만 JS 의존, bot-management, API 제한, 데이터 누락이 있어 보수적 접근 필요 |
| Avoid for MVP | MVP 크롤러 소스로 쓰기 어렵거나, 우회/브라우저 자동화/정책 리스크가 큼 |

검토 항목:

- `robots.txt` 접근 가능 여부
- sitemap 또는 product URL discovery 가능 여부
- 제품 상세 HTML의 정적 데이터 포함 여부
- 성분/가격/브랜드/이미지 등 핵심 필드 접근 가능성
- Cloudflare, captcha, DataDome, PerimeterX 등 차단 신호
- checkout/cart/account/search/filter/sort 경로 제한 여부

## 3. 요약 결과

| Source | Verdict | MVP 사용 방식 |
|---|---|---|
| COSRX official | Good candidate | Shopify sitemap + product HTML/JSON 기반 후보 수집 |
| Innisfree US | Good candidate | Shopify sitemap + product HTML/JSON 기반 후보 수집 |
| Laneige US | Good candidate | Shopify sitemap + product HTML/JSON 기반 후보 수집, 큰 HTML 캐시 주의 |
| Beauty of Joseon | Good candidate | Shopify sitemap + product HTML/JSON-LD 기반 후보 수집 |
| StyleKorean | Good candidate | HTML/JSON-LD 기반 멀티브랜드 후보 수집 |
| YesStyle | Maybe | 낮은 빈도, robots 준수, 공개 product page만 검토 |
| Olive Young Global | Maybe | sitemap URL discovery 중심, 상세 데이터 수집은 보류 |

## 4. Source Notes

### 4.1 COSRX Official

Verdict: Good candidate

관찰:

- `robots.txt`, `sitemap.xml`, 샘플 제품 페이지, 샘플 collection 페이지가 정상 응답했다.
- Shopify 기반 구조로 제품 sitemap이 존재한다.
- 제품 HTML에 title, price, product id, vendor, handle, variant id, SKU 같은 정보가 들어 있었다.
- collection HTML에도 제품/category metadata가 있었다.
- 차단 페이지는 관찰되지 않았다.

주의:

- Shopify robots policy는 checkout/buying automation을 명시적으로 경고한다.
- `/cart`, `/checkout`, `/account`, `/search`, filter/sort collection URL은 제외해야 한다.
- 성분 전체 목록은 제품별로 정적 JSON에 항상 들어있지 않을 수 있다.

MVP 전략:

- `sitemap_products_*.xml`로 제품 URL discovery
- 제품 상세 HTML 또는 Shopify product JSON에서 기본 필드 수집
- 성분 정보는 있으면 수집하고, 없으면 `missing_ingredients`로 review queue에 보낸다.

### 4.2 Innisfree US

Verdict: Good candidate

관찰:

- `robots.txt`, `sitemap.xml`, 샘플 제품 페이지, 샘플 collection 페이지가 정상 응답했다.
- 제품 HTML에 제품명, 가격, product id, handle 등 inline product JSON이 있었다.
- 명시적인 access denied, Cloudflare challenge, DataDome, PerimeterX 신호는 관찰되지 않았다.

주의:

- Shopify 공통 제한 경로는 피해야 한다.
- 한국 공식몰이 아니라 US몰이므로 제품군과 출시일이 한국 기준과 다를 수 있다.

MVP 전략:

- 영어권 사용자 대상 catalog seed로 적합하다.
- 출시 감지는 US몰 기준으로 해석하고, 한국 출시 판단으로 단정하지 않는다.

### 4.3 Laneige US

Verdict: Good candidate

관찰:

- `robots.txt`, `sitemap.xml`, 샘플 제품 페이지, 샘플 collection 페이지가 정상 응답했다.
- 제품 HTML에 제품명, 가격, product id, handle 등 inline product JSON이 있었다.
- 샘플 제품 HTML이 약 1MB 이상으로 커서 캐시와 낮은 요청 빈도가 필요하다.

주의:

- Shopify 공통 제한 경로는 피해야 한다.
- 큰 HTML을 반복 수집하면 비용과 차단 리스크가 커진다.

MVP 전략:

- sitemap lastmod 기반으로 변동 있는 제품만 fetch한다.
- raw snapshot은 저장하되, 중복 content hash면 파싱을 생략한다.

### 4.4 Beauty of Joseon

Verdict: Good candidate

관찰:

- `robots.txt`, `sitemap.xml`, 샘플 제품 페이지, 샘플 collection 페이지가 정상 응답했다.
- 제품 HTML에 title, price, JSON-LD/Product structured data, Shopify/Tapita/Klaviyo product signals가 있었다.
- hCaptcha/form-protection 관련 script는 있었지만 샘플 catalog/product 페이지는 정상 HTML을 반환했다.

주의:

- 보호 script가 존재하므로 요청 빈도와 user-agent를 보수적으로 둔다.
- 성분 전체 목록은 정적 product JSON보다 상세 HTML/섹션에 있을 수 있어 parser confidence를 분리해야 한다.

MVP 전략:

- sitemap 기반 discovery와 JSON-LD/Product 추출을 우선한다.
- 성분은 별도 field extractor로 탐색하고 없으면 review queue 처리한다.

### 4.5 StyleKorean

Verdict: Good candidate

관찰:

- `robots.txt`는 일반 public path를 허용하고 `/adm/`, `/plugin/`을 제한한다.
- list/product HTML이 브라우저 JS 없이도 유용했다.
- list page에 product URL, name, image, ID, price signal이 있었다.
- product page에 JSON-LD/Product, brand, offer price, currency, availability, GTIN, rating 등 구조화 데이터가 있었다.
- 샘플에서 명확한 challenge/captcha 신호는 관찰되지 않았다.

주의:

- sitemap은 존재하지만 오래된 것으로 보여, list page 기반 discovery가 더 현실적일 수 있다.
- 멀티브랜드 소스라 deduplication과 source reliability metadata가 중요하다.

Post-MVP 전략:

- 브랜드 공식몰과 MVP connector가 안정화된 뒤의 1순위 commerce source 후보로 적합하다.
- 단, 공식 출처가 아니므로 product source confidence를 브랜드 공식몰보다 낮게 둔다.

### 4.6 YesStyle

Verdict: Maybe

관찰:

- `robots.txt`는 public page를 허용하지만 `/*/product-grid/`와 `/rest/product/v1/full-detail-product*`를 disallow한다.
- sitemap index는 brand/category/homepage/CLP 중심이며 product sitemap은 확인되지 않았다.
- list HTML에서 product links를 찾을 수 있었다.
- product HTML에 embedded data로 brand, product id, price, stock status, ingredients, rating이 있었다.
- Cloudflare bot-management, challenge platform, captcha 관련 신호가 관찰됐다.

주의:

- disallowed REST/detail API와 product-grid 경로는 사용하지 않는다.
- Cloudflare 신호가 있으므로 MVP 자동 크롤링 대상으로는 조심스럽다.
- 낮은 빈도, 공개 HTML, admin 검수 전제일 때만 후보로 둔다.

MVP 전략:

- 초기 자동 수집 대상에서는 제외하거나 낮은 우선순위로 둔다.
- 필요 시 제품 상세 공개 HTML만 제한적으로 수집한다.

### 4.7 Olive Young Global

Verdict: Maybe

관찰:

- `robots.txt`는 `/product`, `/display`, `/event` 등을 허용하고 order/cart/account 등을 제한한다.
- `Crawl-delay: 5`가 명시되어 있다.
- sitemap 품질은 좋다. category/display/product/image/planning sitemap이 있고 product URLs와 lastmod가 풍부하다.
- 샘플 product HTML은 OG title/image/description 정도는 제공했다.
- 상세 brand, price, full detail은 Vue/API 렌더링에 의존하는 것으로 보였다.
- Cloudflare bot-management 신호가 있었다.

주의:

- `Crawl-delay: 5`를 반드시 지킨다.
- 상세 데이터 수집은 JS/API 의존도가 높아 MVP에는 부담이 크다.
- API endpoint 역추적이나 우회성 접근은 하지 않는다.

MVP 전략:

- product sitemap으로 URL discovery와 lastmod tracking만 우선 활용한다.
- 상세 제품 정보는 공식몰/StyleKorean 등 다른 소스와 교차 검수한다.
- Olive Young 단독 상세 크롤링은 Phase 2 이후 브라우저 worker 또는 명시적 허용 데이터 소스가 있을 때 검토한다.

## 5. MVP Source Priority

권장 순서:

1. COSRX official
2. Beauty of Joseon official
3. Innisfree US
4. Laneige US
5. StyleKorean
6. Olive Young Global sitemap-only
7. YesStyle limited public-page candidate

초기 MVP에서는 1-5까지만 실제 제품 후보 수집 대상으로 삼고, 6-7은 research/backlog로 남기는 것을 권장한다.

## 6. 구현 안전장치

모든 소스 connector는 다음 guardrail을 가져야 한다.

- `robots.txt` 최신 확인 없이 실행하지 않는다.
- checkout/cart/account/order/search/filter/sort URL을 hard block한다.
- source별 minimum delay를 둔다.
- sitemap lastmod와 content hash를 사용해 변경된 URL만 fetch한다.
- 한 invocation에서 소수의 URL만 처리한다.
- 403, 429, captcha/challenge 감지 시 즉시 source를 pause한다.
- raw snapshot은 admin-only storage에 저장한다.
- 자동 수집 결과는 바로 공개하지 않고 review queue로 보낸다.

## 7. 문서화/구현에 반영할 결정

- 제품 수집 파이프라인 문서는 Shopify 공식몰 connector를 1차 구현 대상으로 잡는다.
- commerce connector는 MVP live crawling에서 제외하고 StyleKorean을 post-MVP 후보로 둔다.
- Olive Young은 sitemap discovery source로만 문서화한다.
- YesStyle은 disallowed API를 피하고, 공개 HTML low-rate 후보로만 남긴다.
- 성분 전체 목록은 모든 소스에서 안정적으로 보장되지 않으므로 `missing_ingredients` review state가 필요하다.

## 8. 다음 작업

다음 문서는 이 선체크 결과를 전제로 [Product Ingestion Pipeline](./04-product-ingestion-pipeline.md)에 작성한다.

추가 crawlability 검증은 문서 작성 단계에서 수행하지 않는다. 크롤러 구현 후 source connector 단위 테스트, 스테이징 dry run, 관리자 review queue 확인으로 검증한다.

그 문서는 아래 내용을 포함해야 한다.

- Shopify official connector
- StyleKorean connector
- sitemap-only source mode
- source pause 조건
- product candidate confidence model
- missing ingredients review flow
- crawl task queue and retry policy
