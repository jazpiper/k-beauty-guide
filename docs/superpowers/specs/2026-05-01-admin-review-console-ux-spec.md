# Admin Review Console UX Spec

> 문서 성격: 관리자 콘솔 UX 상세 참고. 현재 구현 상태와 우선순위는 `docs/README.md`, `PLANNING.md`, `docs/api/01-api-contract.md`를 우선한다.

> 작성일: 2026-05-01  
> 상태: 초안  
> 관련 문서: [System Architecture Overview](../../architecture/01-system-overview.md), [Data Model](../../architecture/02-data-model.md), [API Contract](../../api/01-api-contract.md), [Product Ingestion and Ingredient Safety Automation Design](./2026-05-01-product-ingestion-ingredient-safety-design.md)

## 1. 목적

Admin Review Console은 자동화 파이프라인과 공개 제품 데이터 사이의 사람 검수 계층이다. 크롤러와 파서가 만든 제품 후보, 성분 매칭, safety rule 결과를 그대로 공개하지 않고, 관리자가 evidence를 확인한 뒤 승인, 수정, 병합, 반려할 수 있게 한다.

이 콘솔의 핵심 디자인 원칙은 **generic CMS가 아니라 evidence review desk**로 만드는 것이다. 관리자는 항상 다음 네 가지를 한 화면에서 판단할 수 있어야 한다.

1. 자동화가 무엇을 추출했는가.
2. 왜 그렇게 판단했는가.
3. 어떤 원본/source evidence가 있는가.
4. 승인하면 공개 데이터가 어떻게 바뀌는가.

## 2. 범위

### 포함

- 신규 제품 후보 검수
- 기존 제품 업데이트 후보 검수
- 원본 snapshot evidence 확인
- 저신뢰 성분 매칭 검수
- unknown ingredient 처리
- safety rule 변경 영향 검토
- 승인, 반려, 병합, 수정, 재분석 실행
- 관리자 audit log 확인
- source와 crawl task의 기본 상태 확인

### 제외

- 완전 자동 공개
- 대규모 크롤러 운영 대시보드
- 의료 진단 또는 치료 조언
- AI-only safety decision
- 정교한 권한 관리 UI
- 외부 worker infrastructure 관리

## 3. 사용자 역할

### `reviewer`

- 제품 후보를 확인한다.
- 제품 필드를 수정한다.
- 중복 후보를 병합 요청 또는 병합 처리한다.
- 검수 항목을 승인/반려한다.

### `ingredient_editor`

- 성분 alias를 추가한다.
- unknown ingredient를 기존 성분에 매핑한다.
- 새 성분 후보를 manual review 상태로 생성한다.
- 성분 매칭 후 제품 safety analysis 재실행을 요청한다.

### `safety_rule_admin`

- safety rule을 생성, 수정, 비활성화한다.
- rule 변경 영향을 미리 확인한다.
- rule 승인 후 영향 제품 재분석을 실행한다.

### `super_admin`

- source registry를 관리한다.
- 관리자 역할을 부여한다.
- 심각한 데이터 오류를 rollback하거나 archive한다.

## 4. 정보 구조

권장 관리자 내비게이션:

```text
Review Queue
Product Candidates
Raw Snapshots
Ingredient Matches
Safety Rules
Sources
Audit Log
```

초기 MVP에서는 `Review Queue`를 중심 화면으로 두고, 나머지 화면은 queue item의 detail view로 접근해도 된다.

## 5. 공통 화면 원칙

### Evidence First

모든 검수 화면은 자동 추출 결과보다 source evidence를 쉽게 확인할 수 있어야 한다.

필수 evidence:

- Source name
- Source URL
- Fetched at
- Content hash
- Parser version
- Raw snapshot preview
- Extracted fields
- Confidence score

### Decision Before Publication

승인 버튼은 다음을 보여준 뒤 활성화한다.

- 공개될 제품명/브랜드/카테고리
- 공개될 대표 이미지
- 공개될 원재료/성분 매칭 수
- 생성될 safety flags
- 중복 가능성
- audit log에 남을 action summary

### Explainable Automation

자동화 결과에는 "왜 이 후보를 만들었는지"가 보여야 한다.

예:

- `Product name extracted from h1`
- `Ingredient text matched by label "Ingredients"`
- `Linalool matched by exact alias`
- `Duplicate candidate suggested by same brand + similar product name`

### Conservative Safety Language

콘솔의 safety preview도 공개 앱과 같은 표현 정책을 따른다. `dangerous`, `toxic`, `unsafe` 같은 단정적 표현은 피하고, 출처 기반의 `fragrance allergen`, `avoid if sensitive`, `patch test recommended` 같은 설명을 사용한다.

## 6. Screen Specs

### 6.1 Review Queue

목적: 모든 검수 항목을 우선순위와 상태 기준으로 처리한다.

주요 구성:

- Queue summary: open, high priority, failed parsing, unknown ingredients, rule impact count
- Filter controls: item type, source, status, priority, assigned reviewer
- Sort controls: newest, oldest, confidence low first, priority first
- Queue table
  - Type
  - Title
  - Source
  - Confidence
  - Severity
  - Age
  - Assigned to
  - Status
- Bulk actions: assign, mark blocked, re-run extraction

Primary workflow:

```text
Open Review Queue
  -> filter to product candidates
  -> open low-confidence item
  -> review detail
  -> approve/reject/block
  -> return to next queue item
```

Empty states:

- No open review items
- No items for selected filters
- User has no permission for selected queue

### 6.2 Product Candidate Detail

목적: 크롤러가 만든 제품 후보를 공개 제품으로 승인할지 판단한다.

Layout recommendation:

- Left panel: normalized product candidate
- Right panel: raw evidence and extraction notes
- Bottom panel: ingredients, duplicate suggestions, safety preview, audit comment

Fields:

- Brand
- Product name
- Category
- Price
- Image URLs
- Description
- Claims
- Raw ingredient text
- Source URL
- Source product ID
- Confidence score

Actions:

- Approve as new product
- Merge with existing product
- Save edits
- Reject candidate
- Send to ingredient review
- Re-run parser

Validation before approve:

- Brand is selected or created.
- Product name is present.
- Category is present.
- Source URL is present.
- Duplicate suggestions are resolved.
- Ingredient parse has either matched rows or explicit "missing ingredients" reason.

### 6.3 Raw Snapshot Evidence Viewer

목적: 자동 추출 결과가 원본에 근거하는지 확인한다.

Supported previews:

- HTML text preview
- JSON tree preview
- Plain text preview
- Image preview

Metadata:

- URL
- Source
- HTTP status
- Fetched at
- Content type
- Content hash
- Storage path
- Parser version

Useful interactions:

- Highlight extracted product name
- Highlight extracted price
- Highlight extracted ingredient text
- View normalized candidate side by side
- Copy source URL

Failure states:

- Snapshot missing from Storage
- Source URL no longer reachable
- Parser version outdated
- Content hash changed since candidate was created

### 6.4 Ingredient Matching Review

목적: 성분 매칭 실패 또는 낮은 confidence를 사람이 해결한다.

Fields:

- Raw ingredient string
- Normalized string
- Suggested ingredient matches
- Alias source
- Match method
- Confidence
- Language
- Product context
- Source snapshot link

Actions:

- Map to existing ingredient
- Create alias for existing ingredient
- Create new ingredient in `manual_review`
- Mark as non-ingredient text
- Re-run product safety analysis

Primary workflow:

```text
Open low-confidence ingredient
  -> compare raw name with suggestions
  -> choose existing ingredient or create alias
  -> save mapping
  -> re-run analysis for affected product
```

### 6.5 Safety Rule Review

목적: 성분 safety rule의 변경이 공개 제품에 어떤 영향을 주는지 확인한다.

Fields:

- Rule type
- Severity
- Target ingredient or category
- Condition metadata
- Source evidence
- User-facing title
- User-facing recommendation
- Active/version status

Impact preview:

- Affected product count
- New warning examples
- Removed warning examples
- Severity changes
- Products requiring re-analysis

Actions:

- Save draft rule
- Approve rule
- Disable rule
- Re-run affected product analysis
- Require second review for high-impact changes

High-impact changes:

- `restricted` severity, `restricted_signal`, broad rule changes, or changes affecting many published products require a required audit comment and second-review state before publication.
- First approval moves the item to second review when `requires_second_review = true`; final publication happens only after the second reviewer approves.

### 6.6 Sources

목적: 크롤링/import 대상 소스를 관리한다.

Fields:

- Source name
- Source type
- Base URL
- Crawl strategy
- Allowed paths
- Robots policy notes
- Rate limit
- Enabled status
- Last checked at
- Last task status

Actions:

- Add source
- Disable source
- Trigger discovery task
- View recent crawl tasks
- View failed tasks

MVP에서는 source 생성/수정 권한을 `super_admin`에 제한한다.

### 6.7 Audit Log

목적: 공개 데이터가 어떻게 만들어졌는지 추적한다.

Fields:

- Actor
- Action
- Object type
- Object ID
- Previous value
- New value
- Comment
- Timestamp

Search keys:

- Product name
- Ingredient name
- Rule ID
- Source URL
- Actor
- Action

Audit log는 rollback UI가 아니어도 된다. MVP에서는 "무슨 일이 있었는지"를 추적하는 읽기 화면으로 시작한다.

## 7. Data Requirements

관리자 콘솔은 다음 planned tables를 사용한다.

- `products`
- `brands`
- `product_images`
- `product_sources`
- `ingredients`
- `ingredient_aliases`
- `ingredient_evidence`
- `product_ingredients`
- `ingredient_safety_rules`
- `safety_analysis_runs`
- `product_safety_flags`
- `ingestion_sources`
- `crawl_tasks`
- `raw_product_snapshots`
- `product_candidates`
- `review_items`
- `admin_audit_logs`

화면 구현 전에 [Data Model](../../architecture/02-data-model.md)의 이름과 필드를 기준으로 [API Contract](../../api/01-api-contract.md)를 확정한다.

## 8. Error and Edge States

반드시 설계해야 하는 상태:

- Product candidate has no ingredient text.
- Source URL is unreachable.
- Raw snapshot is missing from Storage.
- Duplicate suggestion confidence is ambiguous.
- Ingredient match confidence is low.
- Unknown ingredient cannot be mapped.
- Safety rule change affects many products.
- Re-analysis job failed.
- User lacks permission.
- Admin tries to approve without audit comment for a high-risk change.

## 9. Frontend App Builder Plan

이 문서가 승인된 뒤 `build-web-apps:frontend-app-builder`를 사용한다.

Concept generation should produce separate screens for:

1. Review Queue overview
2. Product Candidate detail
3. Raw Snapshot evidence comparison
4. Ingredient Matching review
5. Safety Rule impact review
6. Audit Log table

The MVP queue must also define a generic detail fallback for `product_update`, `evidence_update`, `restricted_signal`, and `copy_review`. The fallback shows title, target object, source/evidence, before/after JSON diff, reason codes, confidence score, required role, audit comment box, and allowed actions. If a specialized screen does not exist, these item types still remain reviewable without inventing a new flow.

Concept requirements:

- The UI should feel like an evidence review desk.
- It should be dense enough for repeated admin work.
- It should not look like a marketing landing page.
- Tables, split panes, side panels, status badges, diff views, and audit trails are appropriate.
- Product images and source previews should be real visual anchors, not decorative cards.
- Warning copy should be calm and evidence-based.

Implementation constraints for later:

- Use the repo's current CRA + React Router direction unless a separate Next.js migration is explicitly chosen.
- Keep controls code-native.
- Keep admin workflows stateful and testable.
- Verify desktop and mobile/tablet responsive behavior, but optimize primary admin use for desktop.

## 10. MVP Screen Set

MVP admin console can start with four screens:

1. Review Queue
2. Product Candidate Detail
3. Ingredient Matching Review
4. Audit Log

`Raw Snapshot Evidence Viewer` can be embedded inside Product Candidate Detail first. `Safety Rule Review` can start as a detail panel or admin-only form until rule management becomes more frequent.

## 11. MVP Defaults

Detailed backend decisions are centralized in [MVP Backend Decision Record](../../architecture/06-mvp-backend-decisions.md).

1. Product candidate approval requires a mandatory admin comment.
2. Safety rule, restricted signal, and evidence changes require second review before public impact.
3. Raw snapshot preview uses plain text preview + JSON tree only in MVP. Sanitized HTML preview is post-MVP.
4. Source management lives in the admin console MVP as a minimal pause/resume/action surface.
5. Reviewer assignment is manual only in MVP.
