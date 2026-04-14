# Ingredients 페이지 기획서

> 최종 수정: 2026-04-15

---

## 1. 목적

K-뷰티 제품 성분을 **분석·검색·이해**하는 전문 도구 페이지.  
성분 목록을 붙여넣으면 안전성과 효능을 즉시 파악할 수 있으며,  
언어 장벽을 해소해 외국인 사용자가 한국어 라벨을 읽을 수 있도록 돕는다.

---

## 2. 현재 구현 상태

| 기능 | 구현 여부 | 동작 여부 |
|---|---|---|
| 성분 12종 카드 목록 | ✅ | ✅ |
| 성분 붙여넣기 분석기 | ✅ | ✅ (텍스트 매칭) |
| 효능별 필터 탭 | ✅ | ✅ |
| 텍스트 검색 (영/한) | ✅ | ✅ |
| 카드 클릭 → 상세 설명 토글 | ✅ | ✅ |
| 안전성 뱃지 (Safe/Caution) | ✅ | ✅ |
| 카메라 스캔 | ❌ | — |
| 성분 조합 호환성 검사 | ❌ | — |
| 성분 → 제품 연결 | ❌ | — |

---

## 3. 섹션별 상세 기획

### 3-1. 성분 스캐너 (Paste Ingredient List)

**현재**
- 텍스트 붙여넣기 → 분석 버튼 클릭 → 인식 성분 목록 표시
- 매칭 방식: `includes()` 단순 문자열 포함 검사
- 한국어·영어 모두 지원

**한계**
- INCI 표준명(국제 화장품 성분 명명법)과 다른 표기 매칭 불가
  - e.g. "Butylene Glycol" vs "1,3-Butanediol"
- 성분 순서(농도 순) 미활용
- 동의어 처리 없음 (Vit C = Ascorbic Acid = L-Ascorbic Acid)

**개선 사항**
- [ ] **동의어 매핑 테이블** 추가 (`aliases` 필드)
- [ ] **성분 순서 표시** — 상위 성분일수록 농도 높음 안내
- [ ] **주의 성분 하이라이트** — 알코올, 향료, 파라벤 등 자동 경고
- [ ] **전체 성분 분석 리포트** — 안전/주의/경고 통계 요약 카드
- [ ] **공유 기능** — 분석 결과 링크 복사 또는 이미지 저장

**Phase 2 (AI 연동)**
- [ ] **Claude API 연동** — 성분 조합 분석, 피부 타입별 적합성 평가
- [ ] **카메라 OCR 스캔** — 제품 라벨 촬영 → 성분 자동 추출
  - Web API: `getUserMedia` + Tesseract.js (오프라인)
  - 또는 Google Vision API (정확도 높음)

---

### 3-2. 성분 검색 & 필터

**현재**: 텍스트 검색 + 효능 탭 필터

**효능 탭 현황**
All / Hydration / Brightening / Soothing / Anti-aging / Acne Care / Barrier / Exfoliation / Repair / Antioxidant / Healing

**개선 사항**
- [ ] **안전성 필터** 추가 (Safe만 / Caution 포함)
- [ ] **피부 타입 필터** — Skin Quiz 결과와 연동 (내 피부에 맞는 성분만)
- [ ] **성분 비교** — 2개 선택 후 효능·안전성 나란히 비교

---

### 3-3. 성분 카드

**현재 카드 구성**
- 이모지 + 배경색
- 안전성 뱃지 (Safe 초록 / Caution 주황)
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

**Phase 2**: Claude API로 동적 호환성 분석

---

## 4. 데이터 요구사항

### 현재 성분 데이터 구조
```js
{
  name, korean, safety, benefit,
  desc, emoji, color, tags
}
```

### 목표 데이터 구조 (Phase 2)
```js
{
  id,
  name,                    // 영문 일반명
  inci_name,               // INCI 표준명
  korean,                  // 한국어 명칭
  aliases: [],             // 동의어 목록
  safety,                  // "Safe" | "Caution" | "Avoid"
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
| 현재 (v0.1) | 12종 | 하드코딩 |
| Phase 1 | 50종 | `src/data/ingredients.json` |
| Phase 2 | 200종 | Supabase DB (INCI 표준 DB 참고) |
| Phase 3 | 500+종 | 외부 성분 API (COSDNA, EWG) 연동 |

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
| 동의어 매칭 | 미구현 | 높음 |
| 성분 → 제품 연결 | 미구현 | 높음 |
| 호환성 검사 | 미구현 | 중간 |
| 카메라 OCR | 미구현 | 낮음 (Phase 2) |
| AI 분석 | 미구현 | 낮음 (Phase 2) |
| 성분 북마크 | 미구현 | 낮음 |

---

## 7. 외부 리소스

| 리소스 | 용도 | 비용 |
|---|---|---|
| COSDNA | 성분 안전성 데이터 참고 | 무료 (스크래핑 주의) |
| EWG Skin Deep | 성분 유해성 평가 | 무료 API |
| Google Vision API | OCR 카메라 스캔 | 유료 (월 1,000건 무료) |
| Claude API | 성분 조합 AI 분석 | 사용량 기반 |
| Tesseract.js | 오프라인 OCR | 무료 오픈소스 |
