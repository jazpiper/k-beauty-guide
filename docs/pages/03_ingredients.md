# Ingredients 페이지 기획서

> 최종 수정: 2026-05-03

---

## 1. 목적

K-뷰티 제품 성분을 **분석·검색·이해**하는 전문 도구 페이지.
성분 목록을 붙여넣으면 매칭된 성분, 효능 태그, 출처 기반 주의 신호를 확인할 수 있으며,
언어 장벽을 해소해 외국인 사용자가 한국어 라벨을 읽을 수 있도록 돕는다.

성분 페이지의 모든 문구는 교육용 정보로 제한한다. 의료 진단, 치료 조언, 법적 compliance 판정, 제품의 절대적 안전/위험 선언을 하지 않고, 출처 기반 신호와 보수적 권장 문구만 제공한다.

---

## 2. 현재 구현 상태

| 기능 | 구현 여부 | 동작 여부 |
|---|---|---|
| 성분 13종 카드 목록 | ✅ | ✅ (Fragrance 포함) |
| Supabase 성분 목록 연결 | ✅ | ✅ (`v_public_ingredients`, fallback 포함) |
| 성분 붙여넣기 분석기 | ✅ | ✅ (Edge Function/fallback) |
| 동의어/alias fallback 매칭 | ✅ | ✅ |
| 효능별 필터 탭 | ✅ | ✅ |
| 텍스트 검색 (영/한) | ✅ | ✅ |
| 카드 클릭 → 상세 설명 토글 | ✅ | ✅ |
| 레거시 안전성 뱃지 | ✅ | ✅ (MVP 엔진 severity로 교체 필요) |
| 라벨 이미지 인식 | ❌ | 별도 feasibility 이후 |
| 성분 조합 호환성 검사 | ❌ | — |
| 성분 → 제품 연결 | ❌ | — |

---

## 3. 섹션별 상세 기획

### 3-1. 성분 스캐너 (Paste Ingredient List)

**현재**
- 텍스트 붙여넣기 → 분석 버튼 클릭 → parsed ingredient 목록 표시
- Supabase 설정 시 `analyze-ingredient-text` Edge Function 호출
- Supabase 미설정 또는 Edge Function 실패 시 local fallback parser와 alias matcher 사용
- `Fragrance`, `Parfum`, `Sodium Hyaluronate`, `Centella Asiatica Extract` 등 기본 alias 매칭 지원
- 한국어·영어 일부 지원

### Current Analyzer Behavior

- When Supabase is configured, the page calls `analyze-ingredient-text`.
- The Edge Function parses comma/semicolon-separated ingredient text, matches tokens against `ingredient_aliases`, and returns active `ingredient_safety_rules` for matched ingredients.
- `Water, Fragrance, Hyaluronic Acid` should return one unmatched token (`Water`), two matched ingredients (`Fragrance`, `Sodium Hyaluronate`), and one fragrance safety flag.
- If Supabase is not configured or the function fails, the frontend uses `src/safety/localIngredientAnalyzer.js` with the same split/normalize behavior and static fallback ingredient aliases.
- The public analyzer rejects allergy/profile fields such as `allergies`, `allergyProfile`, and `skinProfile`; user-specific sensitivity storage remains outside the public analyzer.
- MVP matching is exact normalized alias matching only. Broad substring matching is intentionally avoided to reduce false safety labels such as `fragrance-free` matching `Fragrance`.

**한계**
- INCI 표준명(국제 화장품 성분 명명법)과 다른 표기 매칭 불가
  - e.g. "Butylene Glycol" vs "1,3-Butanediol"
- 성분 순서는 표시하지만 농도처럼 해석하지 말라는 설명이 더 필요
- fallback alias는 최소 seed만 포함되어 있어 대규모 synonym coverage는 부족

**개선 사항**
- [x] **기본 동의어 매핑** 추가 (`aliases` 필드)
- [x] **Supabase alias table 기반 MVP 동의어 매칭**
- [ ] **Supabase alias table 기반 대규모 동의어 확장**
- [x] **성분 순서 표시** — 라벨 표기 순서 번호 표시
- [ ] **성분 순서 안내 강화** — 순서를 정확한 농도처럼 해석하지 않도록 안내
- [x] **기본 주의 성분 하이라이트** — fallback 기준 Fragrance caution 표시
- [x] **Rule 기반 MVP 주의 성분 표시** — Supabase rule 기준 Fragrance safety flag 표시
- [ ] **Rule 기반 주의 성분 확장** — 특정 보존제, 제한 성분 등 출처 기반 신호 표시
- [ ] **전체 성분 분석 리포트** — `info`, `caution`, `avoid_if_sensitive`, `restricted` 통계 요약 카드
- [ ] **공유 기능** — 분석 결과 링크 복사 또는 이미지 저장

**MVP (성분 엔진 연동)**
- [ ] **Rule engine 완성** — 출처 기반 주의 성분 표시, 낮은 신뢰도 성분은 관리자 검수로 보냄
- [ ] **AI 보조 품질 개선** — 성분 텍스트 정리 초안과 낮은 신뢰도 필드 제안에만 사용

**Deferred Research**
- [ ] **라벨 이미지 인식 검토** — 개인정보, 정확도, 비용, 브라우저 권한 UX를 별도 검증하기 전까지 제품 로드맵에 포함하지 않음

---

### 3-2. 성분 검색 & 필터

**현재**: 텍스트 검색 + 효능 탭 필터

**효능 탭 현황**
All / Hydration / Brightening / Soothing / Anti-aging / Acne Care / Barrier / Exfoliation / Repair / Antioxidant / Healing

**개선 사항**
- [ ] **성분 신호 필터** 추가 (`info`, `caution`, `avoid_if_sensitive`, `restricted`)
- [ ] **피부 타입 필터** — Skin Quiz 결과와 연동 (내 피부에 맞는 성분만)
- [ ] **성분 비교** — 2개 선택 후 효능·안전성 나란히 비교

---

### 3-3. 성분 카드

**현재 카드 구성**
- 이모지 + 배경색
- 성분 신호 뱃지 (MVP 엔진은 `info`/`caution`/`avoid_if_sensitive`/`restricted`)
- 성분명 (영문) + 한국어 명칭
- 효능 레이블
- 태그 목록
- 클릭 시 설명 텍스트 토글

**개선 사항**
- [ ] **성분 상세 페이지** 또는 확장형 카드
  - 사용법 (AM/PM, 농도 권장)
  - 함께 쓰면 좋은 성분 / 피해야 할 조합
  - 이 성분이 포함된 추천 제품 목록 (Products 페이지 연결)
- [ ] **북마크 기능** — 자주 쓰는 성분 저장
- [ ] `"PM Only"` 태그가 있는 성분에 달 아이콘 강조

---

### 3-4. 성분 조합 호환성 검사 (신규 기획)

**목적**: 여러 제품을 동시에 사용할 때 성분 충돌 경고

**구현 방안**

```
[성분 A 선택] + [성분 B 선택] → 호환성 결과
```

| 조합 예시 | 결과 |
|---|---|
| Retinol + AHA | 주의 — 피부 자극 가능 (따로 사용 권장) |
| Niacinamide + Vitamin C | 주의 — 함께 쓰면 효과 저하 가능 |
| Hyaluronic Acid + Ceramides | 좋음 — 보습 시너지 효과 |
| Centella + Retinol | 중립 — 센텔라가 자극 완화에 도움 |

**데이터 구조**
```js
compatibility: [
  { ingredients: ["Retinol", "AHA"], result: "caution", reason: "..." },
  ...
]
```

**Phase 2**: [Ingredient Safety Engine](../architecture/05-ingredient-safety-engine.md) 기반 동적 주의 성분 분석

---

## 4. 데이터 요구사항

### 현재 성분 데이터 구조
```js
{
  id, name, korean, aliases, safety, benefit,
  desc, emoji, color, tags
}
```

### 목표 데이터 구조 (MVP Supabase)
```js
{
  id,
  name,                    // 영문 일반명
  inci_name,               // INCI 표준명
  korean,                  // 한국어 명칭
  aliases: [],             // 동의어 목록
  safety_signals: [{       // 공개 UI에 표시할 출처 기반 신호
    severity: "info" | "caution" | "avoid_if_sensitive" | "restricted",
    title,
    source_label,
    source_region
  }],
  benefit,                 // 주 효능
  benefits: [],            // 복수 효능
  desc,
  usage: {
    am: boolean,
    pm: boolean,
    concentration: "0.1%~2%"
  },
  skin_types: [],
  tags: [],
  pairs_well: [],          // 시너지 성분
  avoid_with: [],          // 충돌 성분
  products: [],            // 이 성분이 포함된 제품 ID 목록
  emoji,
  color
}
```

---

## 5. 데이터 확장 계획

| 단계 | 성분 수 | 방법 |
|---|---|---|
| 현재 (v0.2) | 13종 | `src/data/ingredients.js` static fallback + Supabase client path |
| MVP | 50종 | `src/data/ingredients.js` fallback + Supabase ingredient/alias/rule seed |
| Phase 2 | 200종 | 검수된 공식/공개 근거 확장, 관리자 성분 매칭 워크플로 고도화 |
| Phase 3 | 500+종 | 허용된 공식/공개 데이터 소스와 수동 검수 파이프라인 확장 |

### 추가 필요 성분 목록 (우선순위)
- Panthenol (판테놀)
- Allantoin (알란토인)
- Tranexamic Acid (트라넥삼산)
- Azelaic Acid (아젤라산)
- Bakuchiol (바쿠치올 — 자연 레티놀 대안)
- Madecassoside (마데카소사이드)
- Peptides (펩타이드류)
- SPF 성분류 (Zinc Oxide, Tinosorb)

---

## 6. 미완성 인터랙션 목록

| 인터랙션 | 현재 상태 | 우선순위 |
|---|---|---|
| 기본 동의어 매칭 | 구현 | 완료 |
| Supabase alias 확장 | 부분 구현 | 높음 |
| 성분 → 제품 연결 | 미구현 | 높음 |
| 호환성 검사 | 미구현 | 중간 |
| 라벨 이미지 인식 검토 | 미구현 | 별도 feasibility 이후 |
| AI 품질 보조 | 미구현 | 낮음 (Phase 2) |
| 성분 북마크 | 미구현 | 낮음 |

---

## 7. 외부 리소스

| 리소스 | 용도 | 비용 |
|---|---|---|
| COSDNA | 성분 설명 참고 후보 | 정책 확인 후 수동 참고 위주 |
| EWG Skin Deep | 성분 유해성 참고 후보 | 공개 접근 조건 확인 필요 |
| Google Vision API | 라벨 이미지 인식 검토 후보 | 유료 (월 1,000건 무료) |
| Small LLM API | 성분 텍스트 정리와 설명 문구 초안 보조 | 사용량 기반 |
| Tesseract.js | 오프라인 라벨 이미지 인식 검토 후보 | 무료 오픈소스 |
