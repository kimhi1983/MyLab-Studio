# 병렬 Pro 조합 처방 생성 — 구현 가이드
# 터미널 2 (MyLab-Studio) 작업 지시서
# 2026-03-20

## 구조

```
Pro 의도분석 (temp 0.1, 15초)
    ↓
Purpose Gate DB 조회 (0초)
    ↓
Promise.all([
  Pro A (temp 0.3 — 안정적/보수적),
  Pro B (temp 0.6 — 다양한/창의적)
])  ← 병렬, 60초
    ↓
Pro 조합 (A+B 장점 합산, 50초)
    ↓
Purpose Gate 검증
    ↓
score ≥ 95 → 완료
score < 95 → Pro 재조합 (피드백 포함, 50초) → 완료
```

## 구현할 내용 (server/index.js)

### 1. analyzeFormulaIntent() — Flash → Pro 변경

현재:
```javascript
const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
```

변경:
```javascript
const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
```

temperature도 0.1 유지 (의도분석은 정확해야 하므로).
AbortSignal.timeout은 60000 (Pro는 느리므로 60초).

### 2. generateFormulaParallel() 신규 함수

기존 generate-idea 엔드포인트의 Gemini Pro 호출 부분을 함수로 추출한 뒤,
temperature를 파라미터로 받아 2번 병렬 호출.

```javascript
async function generateFormulaParallel(aiPrompt, apiKey) {
  const callGemini = async (temperature) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }],
          generationConfig: {
            temperature,
            responseMimeType: 'application/json',
            maxOutputTokens: 4096,
          },
        }),
        signal: AbortSignal.timeout(180000), // 3분
      }
    );
    if (!res.ok) throw new Error(`Gemini Pro 오류 (${res.status})`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini Pro 응답 없음');
    return text;
  };

  // 병렬 2회 호출
  const [resultA, resultB] = await Promise.all([
    callGemini(0.3).catch(e => { console.warn('[Pro A] 실패:', e.message); return null; }),
    callGemini(0.6).catch(e => { console.warn('[Pro B] 실패:', e.message); return null; }),
  ]);

  console.log(`[PARALLEL] A=${resultA ? 'OK' : 'FAIL'} B=${resultB ? 'OK' : 'FAIL'}`);
  return { resultA, resultB };
}
```

### 3. combineFormulas() 신규 함수 — Pro 조합

두 처방을 Pro에게 보내서 최적 단일 처방으로 조합.

```javascript
async function combineFormulas(formulaA, formulaB, intentSection, purposeGateSection, formulaIntent, apiKey) {
  const combinePrompt = `당신은 화장품 처방 최적화 전문가입니다.

아래 두 개의 처방(A, B)을 분석하여 **최적의 단일 처방**을 만들어주세요.

## 조합 규칙 (반드시 준수)
1. 각 처방에서 더 적합한 성분 선택을 취합
2. 배합비 합계 = 정확히 100.00%
3. 밸런스(정제수 등)는 역산으로만 계산
4. 유화 시스템 안정성 확인 (HLB 밸런스)
5. pH 호환성 확인 (산성 성분끼리 충돌 여부)
6. 성분 간 물리적 호환성 확인

${intentSection}
${purposeGateSection}

## 처방 A (temperature 0.3 — 보수적)
${formulaA}

## 처방 B (temperature 0.6 — 창의적)
${formulaB}

## 출력 규칙
- 처방 A와 B 중 더 나은 성분 선택, 배합비, 구성을 취합
- 두 처방에서 공통으로 포함된 성분은 우선 채택
- A에만 있는 좋은 성분과 B에만 있는 좋은 성분을 모두 고려
- REQUIRED 성분은 반드시 포함, FORBIDDEN 성분은 반드시 제외
- 최종 배합비 합계 = 100.00%
- JSON 형식으로만 응답 (기존 처방 출력 포맷 동일)`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: combinePrompt }] }],
        generationConfig: {
          temperature: 0.2, // 조합은 정확해야 하므로 낮은 temperature
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
        },
      }),
      signal: AbortSignal.timeout(180000),
    }
  );
  if (!res.ok) throw new Error(`Pro 조합 오류 (${res.status})`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Pro 조합 응답 없음');

  console.log(`[COMBINE] 조합 완료, 응답 길이=${text.length}`);
  return text;
}
```

### 4. generate-idea 엔드포인트 수정 — 전체 흐름 교체

기존 단일 Gemini Pro 호출 부분을 아래로 교체:

```javascript
// ── 기존: 단일 Pro 호출 ──
// const geminiRes = await fetch(...) ← 이 부분을 아래로 교체

// ── 신규: 병렬 Pro 생성 + Pro 조합 ──
const apiKey = process.env.GEMINI_API_KEY;

// Step 1: 병렬 2회 생성
console.log('[PARALLEL] Pro A(0.3) + Pro B(0.6) 병렬 생성 시작');
const { resultA, resultB } = await generateFormulaParallel(aiPrompt, apiKey);

let finalResult;

if (resultA && resultB) {
  // Step 2: 둘 다 성공 → Pro 조합
  console.log('[COMBINE] 두 처방 Pro 조합 시작');
  finalResult = await combineFormulas(
    resultA, resultB, intentSection, purposeGateSection, formulaIntent, apiKey
  );
} else if (resultA || resultB) {
  // 하나만 성공 → 그대로 사용
  console.log('[PARALLEL] 하나만 성공, 단일 결과 사용');
  finalResult = resultA || resultB;
} else {
  // 둘 다 실패
  throw new Error('병렬 Pro 생성 모두 실패');
}

// Step 3: 파싱 + Purpose Gate 검증 (기존 로직 재사용)
// ... 기존 parsedResult = parseFormulaResult(finalResult) ...

// Step 4: score < 95 → Pro 재조합
let validationResult = await validateAndRetry(parsedResult, formulaIntent, purposeGateSection, aiPrompt, pool);

if (validationResult.score < 95 && validationResult.shouldRetry) {
  console.log(`[RETRY] score=${validationResult.score} < 95, Pro 재조합 시작`);
  const retryPrompt = aiPrompt + `\n\n⚠️⚠️⚠️ [검증 피드백 — 반드시 수정]\n${validationResult.feedback}\n⚠️⚠️⚠️`;
  
  // Pro로 재생성 (단일)
  const retryRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: retryPrompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(180000),
    }
  );
  // ... 재생성 결과 파싱 + 재검증 ...
}
```

### 5. validateAndRetry() score 기준 변경

기존:
```javascript
if (score < 70 && (violations.length > 0 || requiredMissing > 2)) {
```

변경:
```javascript
if (score < 95) {
```

## 작업 순서

```
1. analyzeFormulaIntent()에서 Flash → Pro 변경 + timeout 60초
2. generateFormulaParallel() 함수 추가
3. combineFormulas() 함수 추가
4. generate-idea 엔드포인트 수정 — 병렬 생성 + 조합 + 검증 흐름
5. validateAndRetry() score 기준 70 → 95 변경
6. pm2 restart mylab-api → pm2 logs 에러 확인
7. 캐시 비우고 테스트 5개 (고보습 수분크림 / 쿠션 파운데이션 / 멀티밤 / 임산부용 보습크림 / 시카 진정 에센스 무향 비건)
8. 결과 보고: score 변화, 응답시간 변화 확인
9. git commit + push
```

## 테스트 기대값

| 케이스 | 이전 (단일) | 병렬 조합 예상 | 시간 예상 |
|--------|-----------|--------------|----------|
| 고보습 수분크림 | score 100 | 100 | ~90초 |
| 쿠션 파운데이션 | score 100 | 100 | ~120초 |
| 멀티밤 | score 87 | 95+ | ~100초 |
| 임산부용 보습크림 | score 100 | 100 | ~90초 |
| 시카 진정 에센스 | score 100 | 100 | ~90초 |

핵심 확인 포인트: 멀티밤 score가 87→95+ 되는지, 전체 응답시간이 2분 이내인지.
