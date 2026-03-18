// server/services/claudeService.js
// ─── Claude AI 처방 생성 서비스 (FORMULA_RULES 기반) ────────────────────────
// Anthropic Claude API 연동 + 43제형 필수원료 검증 로직

import { getFormulaRules, FORMULA_RULES } from '../config/formulaRules.js'
import { getCached, setCached, makeCacheKey } from './geminiService.js'

// ─── Claude API 호출 ─────────────────────────────────────────────────────────
async function callClaude(prompt, taskType = 'formula') {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[Claude] ANTHROPIC_API_KEY 미설정, Gemini로 폴백')
    return null
  }

  const cacheKey = makeCacheKey('claude', taskType, prompt)
  const cached = await getCached(cacheKey)
  if (cached) return cached

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[Claude] API 오류:', resp.status, errText)
      return null
    }

    const data = await resp.json()
    const text = (data.content?.[0]?.text || '').replace(/```json\n?|```/g, '').trim()
    let result
    try { result = JSON.parse(text) } catch { result = { text } }

    await setCached(cacheKey, 'claude', taskType, result)
    return result
  } catch (err) {
    console.warn('[Claude] 호출 실패:', err.message)
    return null
  }
}

// ─── 43제형 필수원료 검증 ────────────────────────────────────────────────────
/**
 * 처방의 원료 목록이 해당 제형 FORMULA_RULES를 충족하는지 검증
 * @param {string} productType - 제품유형
 * @param {Array} ingredients - [{inci_name, percentage, ...}]
 * @returns {{ valid: boolean, warnings: string[], score: number }}
 */
export function validateFormulaRules(productType, ingredients) {
  const rules = getFormulaRules(productType)
  if (!rules) return { valid: true, warnings: [], score: 100 }

  const warnings = []
  let score = 100

  // 1. Aqua 최대 함량 검증
  const aquaPct = ingredients.reduce((sum, ing) => {
    const n = (ing.inci_name || '').toLowerCase()
    if (n === 'water' || n === 'aqua' || n === 'water (aqua)' || n === 'aqua (water)') {
      return sum + (parseFloat(ing.percentage) || 0)
    }
    return sum
  }, 0)

  if (aquaPct > rules.aqua_max) {
    warnings.push(`Aqua 함량 ${aquaPct.toFixed(1)}%가 ${productType} 최대 허용치(${rules.aqua_max}%)를 초과`)
    score -= 20
  }

  // 2. 필수원료 포함 여부 검증
  const inciList = ingredients.map(i => (i.inci_name || '').toLowerCase())
  const hasMust = rules.must_include.some(keyword =>
    inciList.some(inci => inci.includes(keyword.toLowerCase()))
  )
  if (!hasMust) {
    warnings.push(rules.must_include_msg)
    score -= 30
  }

  // 3. 합계 100% 검증
  const total = ingredients.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0)
  if (Math.abs(total - 100) > 0.1) {
    warnings.push(`배합비 합계 ${total.toFixed(2)}% (100%에서 ${Math.abs(total - 100).toFixed(2)}% 차이)`)
    score -= 25
  }

  return { valid: warnings.length === 0, warnings, score: Math.max(0, score) }
}

// ─── 43제형 전체 목록 ────────────────────────────────────────────────────────
export const FORMULA_TYPE_LIST = Object.keys(FORMULA_RULES)

// ─── FORMULA_RULES 기반 프롬프트 빌드 ───────────────────────────────────────
export function buildFormulaPrompt({
  product_type,
  formula_name,
  requirements,
  baseIngredients = [],
  dbIngredients = [],
  requirementsRuleLines = [],
  poolFormulas = [],
  compoundList = [],
}) {
  const rules = getFormulaRules(product_type)

  const baseSkeletonStr = baseIngredients.map(i =>
    `  ${i.name || i.inci_name}(${i.inci_name}) ${i.percentage}% [${i.function}] Phase ${i.phase}`
  ).join('\n') || '  (기본 골격 없음)'

  const dbStr = dbIngredients.slice(0, 20).map(i =>
    `  ${i.korean_name || ''}(${i.inci_name}) [${i.ingredient_type}]`
  ).join('\n') || '  (DB원료 없음)'

  const compoundStr = compoundList.slice(0, 15).map(c =>
    `  ${c.trade_name} [${c.function || ''}]`
  ).join('\n') || '  (복합원료 없음)'

  const poolStr = poolFormulas.length
    ? poolFormulas.map(f => `  - ${f.formula_name} (${f.product_type})`).join('\n')
    : '  (없음)'

  const rulesBlock = rules ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  절대 규칙 (위반 시 처방 무효)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 제형 베이스 구조
   ${rules.typical_structure}
   Aqua 최대 허용: ${rules.aqua_max}%

2. 필수 포함 원료
   ${rules.must_include_msg}
   필수 키워드(하나 이상 반드시 포함): ${rules.must_include.join(', ')}

3. 베이스 타입: ${rules.base_type}
` : `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  절대 규칙 (위반 시 처방 무효)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 제형에 맞는 베이스 구조 사용
   PRECISION-ARITHMETIC: 배합비 합계 = 100.00%
`

  return `╔══════════════════════════════════════╗
║     화장품 처방 설계 전문가 역할      ║
╚══════════════════════════════════════╝

[제품유형]: ${product_type}
[처방명]: ${formula_name || '(미지정)'}
[추가요구사항]: ${requirements || '(없음)'}
${rulesBlock}
4. 추가요구사항 반영
${requirementsRuleLines.length ? requirementsRuleLines.map(l => '   ' + l).join('\n') : '   (추가요구사항 없음)'}

5. PRECISION-ARITHMETIC
   배합비 합계 = 100.00% (정확히)
   Aqua = 100 - 나머지 합계 (역산)
   소수점 2자리 반올림

6. 원료 구성 검증 (출력 전 자체 점검)
   □ 제형 베이스 구조 맞는가?
   □ 필수 원료 포함됐는가?
   □ 배합비 합계 = 100.00%?
   □ Aqua ≤ ${rules?.aqua_max ?? 80}%?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 처방 기본 골격 (확장하여 완성할 것)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${baseSkeletonStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗄️  DB 원료 풀 (활용 권장)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dbStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 복합원료 사용 가능
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${compoundStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 유사 처방 참고
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${poolStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 출력 형식 (JSON 반환, 다른 텍스트 없이)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "formula_name": "처방명",
  "product_type": "${product_type}",
  "total_pct": 100.00,
  "ingredients": [
    {
      "step": 1,
      "phase": "A",
      "name": "한글명",
      "inci_name": "INCI명",
      "percentage": 70.00,
      "function": "기능",
      "note": "참고사항(선택)"
    }
  ],
  "manufacturing_process": ["1. ...", "2. ..."],
  "key_features": ["특징1", "특징2"],
  "estimated_spec": {
    "pH": "5.5~6.5",
    "viscosity": "5,000~15,000 cPs"
  },
  "regulatory_notes": ["규제 주의사항"],
  "validation": {
    "aqua_pct": 65.0,
    "aqua_ok": true,
    "must_ingredient_found": true,
    "total_ok": true
  }
}`
}

// ─── Claude로 처방 생성 ──────────────────────────────────────────────────────
export async function generateFormulaWithClaude(params) {
  const prompt = buildFormulaPrompt(params)
  const result = await callClaude(prompt, `formula:${params.product_type}`)

  if (!result) return null

  // 처방 결과 검증
  if (result.ingredients?.length) {
    const validation = validateFormulaRules(params.product_type, result.ingredients)
    result.validation = { ...result.validation, ...validation }
    if (validation.warnings.length) {
      result._warnings = validation.warnings
    }
  }

  return result
}

// ─── 지원 제형 목록 조회 ─────────────────────────────────────────────────────
export function getSupportedFormTypes() {
  return FORMULA_TYPE_LIST.map(key => ({
    key,
    base_type: FORMULA_RULES[key].base_type,
    aqua_max: FORMULA_RULES[key].aqua_max,
    typical_structure: FORMULA_RULES[key].typical_structure,
  }))
}
