# Skin Quiz 페이지 기획서

> 최종 수정: 2026-04-15

---

## 1. 목적

사용자의 피부 타입 경향을 추정하고 **개인화된 K-뷰티 루틴 가이드**를 제안하는 인터랙티브 퀴즈.
K-뷰티 입문자가 자신에게 맞는 제품을 쉽게 선택할 수 있도록 진입 장벽을 낮춘다.
의학적 판단이나 피부 질환 판별이 아니라, 제품 탐색을 돕는 교육용 가이드로 표현한다.

---

## 2. 현재 구현 상태

| 기능 | 구현 여부 | 동작 여부 |
|---|---|---|
| 인트로 화면 | ✅ | ✅ |
| 5문항 퀴즈 | ✅ | ✅ |
| 프로그레스 바 | ✅ | ✅ |
| 답변 선택 애니메이션 (400ms) | ✅ | ✅ |
| 결과 계산 (최빈값) | ✅ | ✅ |
| 5가지 피부 타입 결과 | ✅ | ✅ |
| 스킨케어 팁 표시 | ✅ | ✅ |
| 추천 제품 목록 | ✅ (텍스트만) | ✅ |
| 추천 성분 태그 | ✅ | ✅ |
| 다시하기 버튼 | ✅ | ✅ |
| 결과 영속화 | ❌ | — |
| 추천 제품 → Products 연결 | ❌ | — |
| 추천 성분 → Ingredients 연결 | ❌ | — |
| 결과 공유 | ❌ | — |

---

## 3. 섹션별 상세 기획

### 3-1. 인트로 화면

**현재**
- 타이틀 + 설명
- 특징 배지 3개: "Takes only 2 minutes / Personalized results / Product recommendations"
- Start Quiz 버튼

**개선 사항**
- [ ] **결과 미리보기** — "Dry, Oily, Combination, Sensitive, Normal 5가지 타입 경향" 시각화
- [ ] **다시 확인 안내** — 이전 결과가 있는 경우 "지난 결과: Oily Skin" + 다시하기 옵션
- [ ] **소요 시간 정확도** — 실제 2분 내 완료 가능하도록 문항 수 유지

---

### 3-2. 퀴즈 진행 화면

**현재 문항 구성**

| # | 질문 | 측정 요소 |
|---|---|---|
| 1 | 낮 12시 피부 상태 | 유분·수분 밸런스 |
| 2 | 트러블 빈도 | 여드름 경향성 |
| 3 | 새 제품 반응 | 민감도 |
| 4 | 주요 피부 고민 | 직접 선택 |
| 5 | 아침 기상 시 피부 | 야간 피지 분비 |

**결과 판정 방식**: 5개 답변 중 최빈값 → 동점 시 `normal`

**개선 사항**

**UX 개선**
- [ ] **뒤로가기 버튼** — 이전 질문으로 돌아가 답변 수정
- [ ] **진행 중 결과 힌트** — "지금까지 보면 Oily 경향이 있어요" 중간 피드백
- [ ] **질문 애니메이션** — 슬라이드 전환 효과
- [ ] 모바일: 답변 버튼 탭 영역 충분히 확보

**로직 개선**
- [ ] **가중치 기반 점수** — 현재 단순 최빈값 → 질문별 가중치 적용
  - e.g. Q3(새 제품 반응)에서 sensitive 선택 시 가중치 2배
- [ ] **복합 피부 타입** 지원 — Oily+Sensitive 조합 결과
- [ ] **점수 경계값 표시** — "Oily 4점, Combination 1점" 등 상세 데이터

**문항 확장 계획 (Phase 2)**
- 7문항으로 확장 (계절·지역·나이·식습관 추가)
- 한국 방문 목적 질문 추가 ("여행 중 / 직구 / 현지 거주")
- 현재 사용 중인 제품 입력 → 더 정교한 추천

---

### 3-3. 결과 화면

**현재 결과 피부 타입**

| 타입 | 설명 |
|---|---|
| Dry Skin | 수분 집중 케어 필요 |
| Oily Skin | 유분 밸런싱 집중 |
| Combination Skin | 부위별 차별 케어 |
| Sensitive Skin | 자극 최소화 |
| Normal Skin | 균형 유지 + 예방 |

**현재 표시 항목**
- 피부 타입 이름 + 설명
- 스킨케어 팁 4개 (bullet)
- 추천 제품 3개 (텍스트 목록)
- 추천 성분 태그 4개
- 다시하기 버튼

**개선 사항**

**연결성 강화**
- [ ] 추천 제품명 클릭 → Products 페이지 해당 제품으로 이동
- [ ] 추천 성분 태그 클릭 → Ingredients 페이지 해당 성분으로 이동
- [ ] "내 피부 타입 기준으로 필터링" 버튼 → Products 페이지 피부 타입 필터 자동 적용

**공유 기능**
- [ ] **결과 이미지 저장** — Canvas API로 결과 카드 PNG 생성
- [ ] **SNS 공유** — "내 피부 타입 경향은 Oily Skin 쪽에 가까워요" 텍스트 + 링크
- [ ] **결과 URL** — `/quiz/result?type=oily` 로 딥링크 공유 가능

**영속화**
- [ ] **LocalStorage 저장** — 사용자가 명시적으로 저장을 선택한 경우에만 퀴즈 결과 보관
- [ ] **삭제/초기화 제공** — 저장된 결과 삭제 버튼과 공유 기기 주의 문구 제공
- [ ] **서버 저장 보류** — 민감도·알레르기성 선호 데이터는 동의 문구와 삭제 흐름 전까지 Supabase에 저장하지 않음
- [ ] **홈 배너 연동** — 결과 저장 시 "내 결과 보기" CTA로 변경

---

### 3-4. 루틴 추천 (신규 기획)

결과 화면에 아침/저녁 스킨케어 루틴을 단계별로 추천하는 섹션 추가.

**예시 (Oily Skin 기준)**

```
AM Routine
1단계 Cleanser    → TONYMOLY Tako Pore Blackhead
2단계 Toner       → Some By Mi AHA BHA PHA Toner
3단계 Serum       → ANUA Heartleaf Pore Control Serum
4단계 Moisturizer → 가벼운 겔 타입
5단계 Sunscreen   → SPF 50+ 필수

PM Routine
1단계 Oil Cleanser → (이중 세안)
2단계 Foam Cleanser → 저자극
3단계 Exfoliant   → BHA 주 2-3회
4단계 Serum       → Niacinamide 계열
5단계 Moisturizer → 수분 겔 타입
```

**구현 방식**
- Phase 1: 피부 타입별 정적 루틴 JSON
- Phase 2: 사용자 위시리스트 내 제품 기반 동적 루틴 생성
- Phase 3: 성분 안전성 엔진과 AI 보조를 결합한 개인화 루틴

---

## 4. 데이터 요구사항

### 현재 결과 데이터 구조
```js
RESULTS = {
  dry: { type, emoji, color, desc, tips: [], products: [], ingredients: [] },
  oily: { ... },
  combo: { ... },
  sensitive: { ... },
  normal: { ... }
}
```

### 목표 데이터 구조 (Phase 2)
```js
{
  skin_type: "oily",
  display_name: "Oily Skin",
  emoji,
  color,
  desc,
  tips: [],
  recommended_products: [{ id, name, reason }],
  recommended_ingredients: [{ id, name, reason }],
  avoid_ingredients: [{ id, name, reason }],
  routine: {
    am: [{ step, category, product_id, note }],
    pm: [{ step, category, product_id, note }]
  },
  share_text: "내 피부 타입 경향은 Oily Skin 쪽에 가까워요. ..."
}
```

---

## 5. 퀴즈 로직 개선안

### 현재: 단순 최빈값
```js
const count = {};
answers.forEach(a => { count[a] = (count[a] || 0) + 1; });
return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b, "normal");
```

### 개선: 가중치 점수제
```js
const WEIGHTS = {
  q1: { dry: 2, oily: 2, combo: 2, normal: 1 },
  q2: { dry: 1, oily: 2, combo: 1, normal: 1 },
  q3: { sensitive: 3, normal: 1, oily: 1, dry: 1 },  // 민감도 문항 가중치 높음
  q4: { dry: 2, oily: 2, combo: 1, sensitive: 2 },
  q5: { dry: 2, oily: 2, combo: 2, normal: 1 },
};
```

---

## 6. 미완성 인터랙션 목록

| 인터랙션 | 현재 상태 | 우선순위 |
|---|---|---|
| 추천 제품 → Products 연결 | 텍스트만 | 높음 |
| 추천 성분 → Ingredients 연결 | 클릭 무반응 | 높음 |
| 결과 LocalStorage 저장 | 미구현, 명시 저장·삭제 UI 필요 | 중간 |
| 뒤로가기 (문항 수정) | 미구현 | 중간 |
| Products 피부 필터 자동 적용 | 미구현 | 중간 |
| 결과 이미지 저장/공유 | 미구현 | 낮음 |
| 가중치 로직 | 최빈값만 | 낮음 |
| 루틴 추천 섹션 | 미구현 | 낮음 |

---

## 7. 향후 확장 아이디어

- **계절별 루틴 퀴즈** — 겨울 건조 / 여름 유분 대응 루틴
- **여행자 특화 퀴즈** — "서울 며칠 있어?" 기준 미니 쇼핑 목록 생성
- **비교 퀴즈** — 두 제품 중 내 피부에 더 맞는 것 선택
- **성분 회피 항목 입력** — 동의·삭제 흐름이 준비된 뒤 피해야 할 성분을 등록하고 필터링
