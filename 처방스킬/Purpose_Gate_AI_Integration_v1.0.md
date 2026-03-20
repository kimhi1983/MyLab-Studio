# Purpose Gate → AI 프롬프트 완전 연동 — 구현 가이드
# 터미널 2 (MyLab-Studio) 작업 지시서
# 2026-03-20

## 배경
현재 generate-idea 엔드포인트에 analyzeFormulaIntent()(Gemini Flash 1차 분석)가 추가되어
제형 감지는 개선됐지만, purpose_ingredient_map DB(76,975건)의 REQUIRED/FORBIDDEN 성분이
프롬프트에 주입되지 않고 있음. 쿠션 처방에 색소/자외선차단제가 누락되는 문제가 여기서 발생.

## 3가지 개선 사항

### 개선 1: Purpose Gate DB → 프롬프트 직접 주입 (비용 0원)

server/index.js의 generate-idea 엔드포인트에서, intentSection 생성 직후에
purpose_ingredient_map DB를 조회하여 프롬프트에 주입하는 로직 추가.

흐름:
```
analyzeFormulaIntent() → formulaIntent.key_purposes 추출
    ↓
purpose_ingredient_map에서 해당 목적들의 REQUIRED/RECOMMENDED/FORBIDDEN 조회
    ↓
purposeGateSection 텍스트 생성
    ↓
aiPrompt에 intentSection 다음에 purposeGateSection 삽입
```

구현할 함수:
```javascript
async function loadPurposeGateContext(purposes, productType) {
  // purposes: ['보습', '미백'] 등 (formulaIntent.key_purposes에서 옴)
  // productType: '크림', '쿠션', '선크림' 등

  // 1. purpose_ingredient_map에서 REQUIRED/FORBIDDEN 조회
  const required = await pool.query(`
    SELECT DISTINCT m.inci_name, m.korean_name, m.role, m.reason,
           m.default_pct_int, m.max_pct_int
    FROM purpose_ingredient_map m
    WHERE m.purpose_key = ANY($1)
      AND m.role = 'REQUIRED'
    ORDER BY m.purpose_key, m.inci_name
    LIMIT 30
  `, [purposes]);

  const forbidden = await pool.query(`
    SELECT DISTINCT m.inci_name, m.korean_name, m.reason
    FROM purpose_ingredient_map m
    WHERE m.purpose_key = ANY($1)
      AND m.role = 'FORBIDDEN'
    LIMIT 20
  `, [purposes]);

  const recommended = await pool.query(`
    SELECT DISTINCT m.inci_name, m.korean_name, m.role, m.reason,
           m.default_pct_int, m.max_pct_int
    FROM purpose_ingredient_map m
    WHERE m.purpose_key = ANY($1)
      AND m.role = 'RECOMMENDED'
    ORDER BY m.purpose_key
    LIMIT 30
  `, [purposes]);

  // 2. 텍스트 생성
  let section = '';

  if (required.rows.length > 0) {
    section += '\n🔴🔴🔴 [PURPOSE GATE — DB 기반 필수/금지 성분] 🔴🔴🔴\n';
    section += `처방 목적: ${purposes.join(', ')}\n\n`;

    section += '⚡ 필수 포함 성분 (REQUIRED — 최소 2개 반드시 포함):\n';
    for (const r of required.rows) {
      const pct = r.default_pct_int ? `${(r.default_pct_int / 100).toFixed(2)}%` : '';
      section += `- ${r.inci_name} (${r.korean_name || ''}) ${pct} — ${r.reason || r.role}\n`;
    }
  }

  if (recommended.rows.length > 0) {
    section += '\n✅ 권장 성분 (RECOMMENDED — 3~5개 선택):\n';
    for (const r of recommended.rows) {
      const pct = r.default_pct_int ? `${(r.default_pct_int / 100).toFixed(2)}%` : '';
      section += `- ${r.inci_name} (${r.korean_name || ''}) ${pct}\n`;
    }
  }

  if (forbidden.rows.length > 0) {
    section += '\n🚫 절대 금지 성분 (FORBIDDEN — 포함 시 처방 무효):\n';
    for (const r of forbidden.rows) {
      section += `- ${r.inci_name} (${r.korean_name || ''}) — 사유: ${r.reason || '목적 상충'}\n`;
    }
  }

  if (section) {
    section += '🔴🔴🔴 위 필수/금지 목록은 DB 기반이므로 반드시 준수하세요. 🔴🔴🔴\n';
  }

  console.log(`[PURPOSE GATE] purposes=${purposes.join(',')} required=${required.rows.length} forbidden=${forbidden.rows.length} recommended=${recommended.rows.length}`);
  return section;
}
```

삽입 위치 — aiPrompt 구성부에서:
```javascript
// 기존 intentSection 생성 코드 바로 다음에:
let purposeGateSection = '';
if (formulaIntent?.key_purposes?.length > 0) {
  try {
    purposeGateSection = await loadPurposeGateContext(
      formulaIntent.key_purposes,
      product_type
    );
  } catch (e) {
    console.warn('[PURPOSE GATE] DB 조회 실패, 스킵:', e.message);
  }
}

// aiPrompt에 삽입:
const aiPrompt = `...
${getMandatoryRules(baseKey)}${intentSection}${purposeGateSection}
[제품유형]: ${formulaIntent?.detected_type || product_type}
...`;
```

### 개선 2: Flash 프롬프트 파싱 강화

analyzeFormulaIntent() 함수의 프롬프트에 추가 요구사항 파싱 규칙을 강화.
현재는 "미백, 주름개선" 같은 키워드만 인식하지만, 사용자가 자유 입력하는
"나이아신아마이드 3% 이상", "레티놀 제외", "비건 인증" 등을 정밀 파싱해야 함.

analyzeFormulaIntent() 프롬프트에 아래 규칙 추가:
```
추가 요구사항 파싱 규칙 (반드시 적용):
- "~% 이상" / "~% 포함" → must_have_ingredients에 성분명 + 최소 농도 명시
- "~ 제외" / "~ 빼줘" / "~ 없이" → must_not_ingredients에 추가
- "비건" / "vegan" → must_not_ingredients에 "동물유래 성분(Lanolin, Beeswax, Carmine, Collagen(동물), Keratin(동물))" 추가
- "EWG 그린" → must_not_ingredients에 "EWG 주의 성분(Phenoxyethanol 1%이상, Fragrance, DMDM Hydantoin)" 추가
- "무향" → must_not_ingredients에 "Fragrance, Parfum, Linalool, Limonene" 추가
- "무알코올" → must_not_ingredients에 "Alcohol Denat., Ethanol, SD Alcohol" 추가
- "무색소" → must_not_ingredients에 "CI 번호 색소(CI 77891 제외)" 추가
- "워터프루프" → must_have_ingredients에 "Dimethicone, Trimethylsiloxysilicate, Acrylates Copolymer" 추가
- "임산부용" → must_not_ingredients에 "Retinol, Retinyl Palmitate, Salicylic Acid, Hydroquinone" 추가
- "저자극" → must_not_ingredients에 "Alcohol Denat., SLS(Sodium Lauryl Sulfate), Fragrance" + must_have_ingredients에 "Allantoin, Panthenol" 추가
- 숫자+% 패턴 → 해당 성분의 농도를 must_have_ingredients에 구체적으로 명시
```

### 개선 3: 생성 후 자동 검증 루프 (Two-Pass)

처방 생성 완료 후, purpose-gate/validate API를 내부적으로 호출하여
FORBIDDEN 위반이나 REQUIRED 누락이 있으면 1회 자동 재생성.

구현할 함수:
```javascript
async function validateAndRetry(generatedFormula, formulaIntent, purposeGateSection, aiPromptBase, pool) {
  // 1. 생성된 처방의 성분 목록 추출
  const ingredients = generatedFormula.ingredients || generatedFormula.formula || [];
  const inciNames = ingredients.map(i =>
    (i.inci_name || i.name || '').trim()
  ).filter(Boolean);

  if (inciNames.length === 0) return { formula: generatedFormula, validated: false, reason: 'no_ingredients' };

  const purposes = formulaIntent?.key_purposes || [];
  if (purposes.length === 0) return { formula: generatedFormula, validated: true, score: 100 };

  // 2. FORBIDDEN 체크
  const forbiddenCheck = await pool.query(`
    SELECT inci_name, reason FROM purpose_ingredient_map
    WHERE purpose_key = ANY($1) AND role = 'FORBIDDEN'
      AND inci_name ILIKE ANY(
        SELECT '%' || unnest || '%' FROM unnest($2::text[])
      )
  `, [purposes, inciNames]);

  // 3. REQUIRED 체크
  const requiredCheck = await pool.query(`
    SELECT inci_name FROM purpose_ingredient_map
    WHERE purpose_key = ANY($1) AND role = 'REQUIRED'
  `, [purposes]);

  const requiredNames = requiredCheck.rows.map(r => r.inci_name.toLowerCase());
  const formulaLower = inciNames.map(n => n.toLowerCase());
  const requiredFound = requiredNames.filter(rn =>
    formulaLower.some(fn => fn.includes(rn.toLowerCase()) || rn.toLowerCase().includes(fn))
  );

  const violations = forbiddenCheck.rows;
  const requiredMissing = requiredNames.length - requiredFound.length;
  const requiredTotal = requiredNames.length;

  // 4. 스코어 계산 (100점 만점)
  let score = 100;
  score -= violations.length * 15;  // FORBIDDEN 1개당 -15점
  if (requiredTotal > 0) {
    const requiredRatio = requiredFound.length / Math.min(requiredTotal, 3); // 최소 3개 기준
    score -= Math.round((1 - Math.min(requiredRatio, 1)) * 40); // REQUIRED 미충족 시 최대 -40점
  }
  score = Math.max(0, score);

  console.log(`[VALIDATE] score=${score} violations=${violations.length} required=${requiredFound.length}/${requiredTotal}`);

  // 5. 70점 미만이면 1회 재생성
  if (score < 70 && (violations.length > 0 || requiredMissing > 2)) {
    console.log(`[VALIDATE] score=${score} < 70 → 재생성 시도`);

    const feedbackLines = [];
    if (violations.length > 0) {
      feedbackLines.push(`🚫 금지 성분 위반: ${violations.map(v => v.inci_name).join(', ')} — 반드시 제거하세요`);
    }
    if (requiredMissing > 0) {
      const missing = requiredNames.filter(rn => !formulaLower.some(fn => fn.includes(rn.toLowerCase())));
      feedbackLines.push(`⚡ 필수 성분 누락: ${missing.slice(0, 5).join(', ')} — 반드시 포함하세요`);
    }

    return {
      formula: generatedFormula,
      validated: false,
      score,
      violations: violations.map(v => v.inci_name),
      feedback: feedbackLines.join('\n'),
      shouldRetry: true
    };
  }

  return {
    formula: generatedFormula,
    validated: true,
    score,
    violations: violations.map(v => v.inci_name)
  };
}
```

재생성 로직 (generate-idea 엔드포인트 응답 직전에):
```javascript
// 기존 처방 생성 완료 후, 응답 반환 전에:
let validationResult = null;
try {
  validationResult = await validateAndRetry(parsedResult, formulaIntent, purposeGateSection, aiPrompt, dbPool);

  if (validationResult.shouldRetry) {
    console.log('[RETRY] 검증 실패, 피드백 포함하여 1회 재생성');
    // 피드백을 프롬프트에 추가하여 재생성
    const retryPrompt = aiPrompt + `\n\n⚠️⚠️⚠️ [검증 피드백 — 이전 생성에서 아래 문제 발견, 반드시 수정] ⚠️⚠️⚠️\n${validationResult.feedback}\n⚠️⚠️⚠️ 위 피드백을 100% 반영하여 처방을 다시 작성하세요. ⚠️⚠️⚠️`;
    // ... 재생성 API 호출 (기존 Gemini Pro 호출 로직 재사용)
    // 재생성 후 다시 검증 (단, 2회차는 결과 그대로 반환)
  }
} catch (e) {
  console.warn('[VALIDATE] 검증 실패, 원본 결과 반환:', e.message);
}

// 응답에 검증 점수 포함
res.json({
  success: true,
  data: {
    ...parsedResult,
    purpose_score: validationResult?.score ?? null,
    purpose_violations: validationResult?.violations ?? [],
    retried: validationResult?.shouldRetry ?? false
  }
});
```

## 작업 순서 (터미널 2에서 순차 실행)

```
Step 1: loadPurposeGateContext() 함수 추가 (server/index.js)
Step 2: generate-idea 엔드포인트에서 purposeGateSection 생성 + aiPrompt에 삽입
Step 3: analyzeFormulaIntent() 프롬프트에 파싱 규칙 강화
Step 4: validateAndRetry() 함수 추가
Step 5: generate-idea 응답 전에 검증+재생성 로직 추가
Step 6: pm2 restart → 테스트 (쿠션, 멀티밤, 미백세럼, 선크림, PDRN앰플)
Step 7: npm run build → git commit + push
```

## 테스트 케이스
```
1. "쿠션 파운데이션" → REQUIRED에 색소(CI 77891 등) + 자외선차단제(ZnO/TiO2) 포함 확인
2. "미백 세럼, 나이아신아마이드 3% 이상" → Niacinamide 3%+ 확인
3. "진정 크림, 무향, 비건" → Fragrance 없음 + 동물유래 성분 없음 확인
4. "멀티밤" → 무수 제형 + 왁스 베이스 확인 (aqua = 0%)
5. "임산부용 보습크림, 레티놀 제외" → Retinol 없음 확인
```
