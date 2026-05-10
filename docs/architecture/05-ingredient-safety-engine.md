# Ingredient Safety Engine

> 작성일: 2026-05-01  
> 상태: 초안  
> 대상: Supabase + rule engine + 사용자 민감 성분 경고

## 1. 목적

이 문서는 K-Beauty Guide의 성분 안전성 엔진을 정의한다. 목표는 제품 성분 문자열을 표준 성분 데이터베이스에 매칭하고, 출처 기반 rule을 실행해 사용자에게 설명 가능한 주의 정보를 제공하는 것이다.

이 엔진은 제품을 의학적으로 "안전" 또는 "위험"하다고 판정하지 않는다. 사용자가 성분을 이해하고, 본인의 민감 성분이나 알레르기 가능성을 더 조심스럽게 확인하도록 돕는 보조 정보 계층이다.

## 2. 설계 원칙

- 최종 판단은 LLM이 아니라 rule engine이 한다.
- 모든 안전성 flag는 rule과 evidence를 통해 설명 가능해야 한다.
- 성분명 매칭과 안전성 rule 실행은 분리한다.
- 제품 라벨의 성분 순서는 보존하되 정확한 농도처럼 해석하지 않는다.
- 사용자 민감 성분 정보는 건강 정보에 가까운 민감 데이터로 취급한다.
- 규제/출처 데이터는 구현 시점에 공식 출처를 다시 확인하고 version을 남긴다.
- UI 문구는 공포를 유발하거나 진단처럼 보이지 않게 작성한다.

## 3. 전체 흐름

```text
Product ingredient text
   -> ingredient normalizer
   -> ingredient splitter
   -> alias matcher
   -> product_ingredients
   -> safety rule engine
   -> product_safety_flags
   -> user sensitivity overlay
   -> product safety report UI
```

관리자 검수 흐름:

```text
Unknown or low-confidence match
   -> review_items: ingredient_match
   -> admin selects existing ingredient or creates alias
   -> affected product re-analysis
```

Rule 변경 흐름:

```text
Safety rule or evidence update
   -> affected ingredient set detected
   -> safety_analysis_runs queued
   -> product_safety_flags regenerated
   -> public UI reads latest successful run
```

## 4. Engine Boundaries

## MVP Runtime Boundary

The MVP safety engine has two runtime paths:

| Path | Runtime | Data source | Purpose |
|---|---|---|---|
| Supabase analyzer | `supabase/functions/analyze-ingredient-text` | `ingredient_aliases`, `ingredients`, `ingredient_safety_rules` | Primary public analyzer when Supabase env is configured |
| Frontend fallback | `src/safety/localIngredientAnalyzer.js` | `src/data/ingredients.js` | Offline/static fallback when Supabase is missing or unavailable |

Both paths use the same split and normalization behavior:

- split on comma and semicolon
- trim empty tokens
- lowercase English text
- remove parenthetical notes
- preserve Korean characters
- collapse punctuation and whitespace

MVP matching is exact normalized alias matching only. Broad substring matching is avoided because false safety labels are worse than leaving a token in `Review` or `unmatched`.

Safety flags are rule-based. LLM output must not be used as the final allergy or safety decision.

### Ingredient Parser

원문 성분 문자열을 순서 있는 성분 토큰으로 바꾼다. Parser는 위험도를 판단하지 않는다.

Input:

- `ingredient_text_raw`
- source language hint
- parser version

Output:

- raw ingredient token list
- position
- normalization notes
- parser confidence

### Ingredient Matcher

토큰을 canonical ingredient에 연결한다.

Matching order:

1. exact alias match
2. normalized alias match
3. Korean/INCI known synonym match
4. CAS number match, if available
5. manual alias from admin review
6. unmatched row

Matcher는 낮은 신뢰도 매칭을 자동 확정하지 않는다. 애매한 경우 `product_ingredients.ingredient_id`를 비워두고 review item을 만든다.

### Ingredient Knowledge Base

성분의 표준명, 한글명, INCI명, CAS number, 기능 태그, 출처 evidence를 관리한다.

이 계층은 제품 수집 파이프라인과 독립적으로 업데이트되어야 한다. 제품 크롤링이 실패해도 성분 지식베이스를 개선할 수 있어야 하고, 성분 alias나 rule이 바뀌면 기존 제품을 재분석할 수 있어야 한다.

### Safety Rule Engine

`product_ingredients`와 `ingredient_safety_rules`를 입력받아 제품별 `product_safety_flags`를 생성한다.

Rule engine은 아래 질문에 답해야 한다.

- 어떤 성분이 어떤 rule에 걸렸는가?
- 왜 사용자에게 보여줄 가치가 있는가?
- 어떤 사용자가 특히 주의해야 하는가?
- 어떤 출처/evidence에 기반하는가?
- rule version이 무엇인가?

`product_safety_flags`는 생성 시점의 `rule_version`과 최소 `rule_snapshot`을 함께 저장한다. Rule row를 수정하더라도 기존 flag가 어떤 버전과 근거에서 나왔는지 감사할 수 있어야 한다.

### User Sensitivity Overlay

공개 제품 flag 위에 사용자의 개인 설정을 덧씌운다. 이 단계는 모든 사용자에게 같은 경고를 생성하는 것이 아니라, 특정 사용자에게 강조해야 할 항목을 계산한다.

예:

- 사용자가 `fragrance` category를 피하고 싶어함
- 제품에 `fragrance_undisclosed` flag가 있음
- UI에서 "Your preference match"를 추가 강조

이 결과는 기본적으로 즉시 계산할 수 있다. 사용자별 결과를 저장하는 것은 MVP에서는 피하고, 필요해질 때 opt-in으로 추가한다.

## 5. Ingredient Parsing

### 5.1 Normalization

Parser는 성분 문자열을 바꾸기 전에 원문을 보존한다.

Normalization steps:

1. HTML entity와 line break 정리
2. 한글/영문 쉼표, 세미콜론, slash, bullet separator 정규화
3. 괄호 안 보조 표기 보존
4. "Ingredients:", "전성분", "성분" 같은 라벨 문구 제거
5. 과도한 whitespace 제거
6. ingredient token list 생성

주의:

- 원문 의미를 바꾸는 번역을 parser 단계에서 수행하지 않는다.
- "fragrance/parfum"처럼 slash가 성분명 일부로 쓰이는 경우를 고려한다.
- "may contain" 또는 색조 제품의 shade-specific 성분은 별도 parsing rule이 필요하다.

### 5.2 Match Confidence

권장 confidence 기준:

| Match Method | Confidence | Notes |
|---|---:|---|
| `exact` | 0.98 | canonical or exact alias |
| `normalized` | 0.90 | punctuation/case normalized |
| `alias` | 0.80 | known synonym |
| `cas` | 0.95 | CAS number match |
| `manual` | 1.00 | admin-confirmed |
| `unmatched` | 0.00 | needs review |

낮은 confidence 또는 중복 alias 충돌은 `review_items.item_type = ingredient_match`로 보낸다.

### 5.3 Unknown Handling

Unknown ingredient는 숨기지 않는다.

처리 방식:

- `product_ingredients.raw_name`은 저장한다.
- `ingredient_id`는 nullable로 둔다.
- `match_method = unmatched`
- 제품 상세에는 "unmatched ingredient"를 관리자 검수 전까지 내부용으로만 표시한다.
- 관리자 콘솔에서 기존 성분에 매칭하거나 신규 성분 후보를 만들 수 있게 한다.

Public UI에서는 불확실한 성분을 과도하게 경고하지 않는다. "일부 성분 정보 검수 중" 같은 중립적 표현을 사용한다.

## 6. Rule Model

`ingredient_safety_rules`는 단순 row-based rule을 기본으로 한다. `condition`은 실행 가능한 코드가 아니라 제한된 JSONB 조건이다.

예시:

```json
{
  "match": {
    "ingredient_id": "uuid"
  },
  "applies_to": {
    "leave_on": true,
    "rinse_off": true
  },
  "user_context": {
    "avoid_category": "fragrance"
  }
}
```

MVP에서는 product type 조건을 최소화한다. leave-on/rinse-off, 국가별 법적 제한, 농도 기반 조건은 데이터가 충분할 때 확장한다.

### 6.1 Rule Types

| Rule Type | Meaning |
|---|---|
| `fragrance_allergen` | 향 알레르기와 관련해 별도 표시/주의 가치가 있는 성분 |
| `fragrance_undisclosed` | `fragrance`, `parfum`, `향료`, `aroma`처럼 구체 성분이 공개되지 않은 향료 표시 |
| `preservative_sensitizer` | 민감 피부에서 주의할 수 있는 방부제 계열 |
| `exfoliant_caution` | AHA, BHA, retinoids 등 자극 가능성이 있는 활성 성분 |
| `photosensitivity_caution` | 햇빛 노출 주의 문구가 필요한 성분 또는 성분군 |
| `restricted_or_prohibited` | 특정 관할권에서 제한 또는 금지 신호가 있는 성분 |
| `user_avoid_match` | 사용자가 명시적으로 피하고 싶은 성분 또는 카테고리 |

### 6.2 Severity

Severity는 위험 등급이 아니라 UX 표시 강도다.

| Severity | UI Meaning |
|---|---|
| `info` | 알아두면 좋은 성분 정보 |
| `caution` | 민감 피부나 특정 상황에서 확인 권장 |
| `avoid_if_sensitive` | 해당 민감성/알레르기 이력이 있으면 특히 주의 |
| `restricted` | 출처 기반 제한/금지 신호가 있어 관리자 검토와 명확한 문구 필요 |

`restricted`는 법적 판정처럼 직접 표시하지 않는다. UI에서는 "Source-based restriction signal"처럼 설명하고, 지역과 출처를 함께 보여준다.

### 6.3 Output Shape

`product_safety_flags`는 UI 표시를 위해 rule 결과를 snapshot으로 저장한다.

필수 출력:

- `product_id`
- `ingredient_id`
- `rule_id`
- `analysis_run_id`
- `severity`
- `title`
- `why_it_matters`
- `who_should_care`
- `recommendation`
- `source_label`
- `source_region`
- `source_url`

예시:

```text
Title: Fragrance ingredient detected
Severity: avoid_if_sensitive
Why it matters: This ingredient is commonly tracked as a fragrance allergen signal in cosmetic ingredient references.
Who should care: Users with fragrance sensitivity or allergic contact dermatitis history.
Recommendation: Check the product label and patch test before use.
Source: EU CosIng / internal rule evidence summary
```

## 7. Evidence Model

Evidence는 rule보다 느리게 바뀌는 출처 기록이다.

권장 출처군:

- 한국 성분명 표준/협회 성분 사전 계열
- 한국 식약처 고시/가이드 계열
- EU CosIng 및 관련 cosmetic regulation annex 계열
- FDA consumer guidance 계열
- 내부 검수 rule과 운영 메모

구현 시점에는 공식 출처 URL, source date, imported_at, importer version을 남긴다. 이 문서의 출처군은 방향성이고, 실제 rule seed 작성 시 최신 공식 출처를 다시 확인해야 한다.

Evidence 저장 원칙:

- 긴 원문 복사 대신 짧은 요약을 저장한다.
- 출처 URL과 source date를 남긴다.
- 어떤 claim type에 쓰였는지 명확히 한다.
- rule이 evidence를 참조할 수 있게 한다.

## 8. User Sensitivity Profile

MVP에서는 두 가지 운영 방식을 지원한다.

### 8.1 Local-first Mode

로그인 전 사용자는 민감 성분 설정을 브라우저 LocalStorage에 저장할 수 있다.

장점:

- 계정 없이 빠르게 사용 가능
- 민감 데이터 서버 저장을 피할 수 있음
- MVP UX 검증이 빠름

제약:

- 기기 간 동기화 없음
- 사용자가 브라우저 데이터를 지우면 사라짐

### 8.2 Account Mode

로그인 사용자는 명시적 동의 후 `user_profiles`와 `user_avoid_ingredients`에 저장한다.

필수 조건:

- 동의 문구와 consent version
- 삭제 기능
- RLS로 본인 데이터만 접근
- 관리자 접근 최소화와 audit

### 8.3 User Overlay Logic

사용자 설정은 기존 product flag를 다시 해석한다.

```text
product_safety_flags
   + user_avoid_ingredients
   + user sensitivity level
   -> personalized warning emphasis
```

예:

- `severity = caution`, user `sensitivity_level = high`이면 표시 순위를 올린다.
- user avoid category가 `fragrance`이면 `fragrance_allergen`과 `fragrance_undisclosed`를 강조한다.
- user avoid ingredient가 직접 매칭되면 `user_avoid_match` style badge를 표시한다.

## 9. Re-analysis

재분석은 크롤링과 분리한다.

Re-analysis triggers:

- 제품 성분 문자열 변경
- `ingredient_aliases` 추가 또는 수정
- `ingredient_safety_rules` 변경
- `ingredient_evidence` 업데이트
- 관리자 수동 재분석 요청

분석 실행은 `safety_analysis_runs`에 기록한다.

권장 상태:

- `queued`
- `running`
- `succeeded`
- `failed`

재분석이 성공하면 기존 flag를 대체하거나 stale 처리한다. 실패한 경우 마지막 성공 결과를 공개 앱에 유지하되 관리자에게 실패 상태를 보여준다.

## 10. Admin Review

관리자 검수 대상:

| Review Type | Trigger |
|---|---|
| `ingredient_match` | unknown ingredient, low confidence, alias conflict |
| `safety_rule_change` | 새 rule 또는 severity 변경 |
| `evidence_update` | 출처 변경, source URL 변경, claim type 변경 |
| `restricted_signal` | restricted/prohibited 계열 rule 생성 |
| `copy_review` | 사용자 표시 문구가 의료/법률 판단처럼 보일 가능성 |

Admin action:

- alias 생성
- 기존 ingredient에 수동 매칭
- 신규 ingredient 생성
- rule 활성/비활성
- rule severity 변경
- evidence 연결
- 제품 재분석 실행

모든 action은 `admin_audit_logs`에 남긴다.

## 11. Public UI Contract

Public UI는 아래 정보를 받는다.

```ts
type ProductSafetyReport = {
  productId: string;
  generatedAt: string | null;
  ingredientCount: number;
  unmatchedIngredientCount: number;
  flags: ProductSafetyFlag[];
};
```

실제 endpoint와 public/admin payload는 [API Contract](../api/01-api-contract.md)를 기준으로 한다. MVP의 개인화 강조 결과는 서버 응답에 저장하거나 캐싱하지 않고, LocalStorage 민감 성분 설정을 사용해 클라이언트에서 계산한다.

표시 원칙:

- "This product is unsafe" 같은 단정 표현을 피한다.
- "May be worth checking if..."처럼 조건부 문구를 쓴다.
- 사용자의 민감 설정과 일반 성분 정보를 구분한다.
- 출처 label과 region을 표시한다.
- 알레르기 이력이 있으면 전문가 또는 제품 라벨 확인을 권장한다.

## 12. LLM Boundary

LLM 사용 가능:

- 성분 원문 구분자 정리 후보 제안
- 설명 문구 초안 생성
- 긴 evidence 요약 초안
- unknown ingredient review hint

LLM 사용 금지:

- 최종 위험도 판정
- rule 생성 자동 승인
- 법적 제한 여부 단정
- 사용자 알레르기 진단
- 제품 사용 가능/불가능 판정

LLM 출력은 반드시 reviewable suggestion으로 저장한다. Safety flag는 rule engine이 생성한 결과만 public UI에 노출한다.

## 13. MVP Scope

MVP에 포함한다.

- ingredient parser와 ordered token 저장
- exact/normalized/alias/manual matching
- unknown ingredient review queue
- `fragrance_allergen`
- `fragrance_undisclosed`
- `preservative_sensitizer`
- `exfoliant_caution`
- `user_avoid_match`
- 기본 `product_safety_flags`
- LocalStorage 기반 민감 성분 설정
- 계정 저장은 consent copy가 준비된 후 선택

MVP에서 제외한다.

- 농도 기반 판단
- 국가별 법적 compliance 판정
- 자동 의료 조언
- LLM-only safety classification
- 라벨 이미지 인식 기능은 별도 feasibility 이후 검토
- 사용자별 safety result 장기 저장

## 14. Implementation Order

1. seed ingredient와 alias 데이터를 만든다.
2. parser normalization/splitting 함수를 만든다.
3. exact/normalized/alias matcher를 만든다.
4. unknown ingredient review item 생성을 붙인다.
5. `ingredient_safety_rules` seed를 만든다.
6. rule engine을 구현하고 `safety_analysis_runs`를 기록한다.
7. `product_safety_flags` 생성을 붙인다.
8. 사용자 LocalStorage 민감 성분 설정과 overlay를 붙인다.
9. 관리자 alias/rule review workflow를 붙인다.
10. rule/evidence 업데이트 시 재분석 queue를 붙인다.

## 15. MVP Defaults

Detailed backend decisions are centralized in [MVP Backend Decision Record](./06-mvp-backend-decisions.md).

1. 사용자 민감 성분 설정은 MVP에서 LocalStorage로 시작한다. 계정 저장은 consent copy와 삭제 흐름 이후로 미룬다.
2. 첫 seed rule은 KR + EU + US source metadata를 저장할 수 있지만, UI는 법적 compliance 판정을 하지 않는다.
3. Fragrance rule은 generic `fragrance/parfum/향료`와 high-frequency labelled fragrance allergen signal 중심의 limited seed로 시작한다.
4. `restricted` severity는 safety rule admin + second review 후 `source-based restriction signal`로만 공개한다.
5. Ingredient 설명 문구는 영어 public explanation을 우선하고, 한국어명은 parallel field로 저장한다.
