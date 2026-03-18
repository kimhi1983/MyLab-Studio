// server/services/geminiService.js
// ─── LLM 헬퍼 (Gemini 주 / Qwen 보조) ──────────────────────────────────────

import { createHash } from 'crypto'
import pool from '../db.js'

// ─── 캐시 키 생성 (SHA-256) ───
export function makeCacheKey(model, taskType, input) {
  return createHash('sha256').update(`${model}:${taskType}:${JSON.stringify(input)}`).digest('hex').slice(0, 32)
}

// ─── llm_cache 조회 ───
export async function getCached(cacheKey) {
  try {
    const { rows } = await pool.query(
      `UPDATE llm_cache SET hit_count = hit_count + 1
       WHERE cache_key = $1 AND expires_at > NOW()
       RETURNING result`,
      [cacheKey]
    )
    return rows[0]?.result ?? null
  } catch { return null }
}

// ─── llm_cache 저장 ───
export async function setCached(cacheKey, model, taskType, result) {
  try {
    await pool.query(
      `INSERT INTO llm_cache (cache_key, model, task_type, result)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cache_key) DO UPDATE SET result = $4, hit_count = 0, expires_at = NOW() + INTERVAL '30 days'`,
      [cacheKey, model, taskType, JSON.stringify(result)]
    )
  } catch { /* 캐시 저장 실패는 무시 */ }
}

// ─── Qwen (Ollama) 호출 헬퍼 ───
export async function callQwen(prompt, taskType = 'classify') {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:14b'
  const cacheKey = makeCacheKey('qwen', taskType, prompt)

  const cached = await getCached(cacheKey)
  if (cached) return cached

  try {
    const resp = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, prompt, stream: false,
        options: { temperature: 0.1, num_predict: 1024, num_ctx: 4096 }
      }),
      signal: AbortSignal.timeout(30000)
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const text = (data.response || '').replace(/```json\n?|```/g, '').trim()
    let result
    try { result = JSON.parse(text) } catch { result = { text } }
    await setCached(cacheKey, 'qwen', taskType, result)
    return result
  } catch (err) {
    console.warn(`[Qwen] 호출 실패 (${taskType}):`, err.message)
    return null
  }
}

// ─── Gemini API 실제 호출 ───
export async function _fetchGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text()
    throw new Error(`Gemini API 오류 (${geminiRes.status}): ${errBody}`)
  }

  const geminiData = await geminiRes.json()
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini 응답에 content가 없습니다.')

  const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('Gemini 응답 JSON 파싱 실패: ' + cleaned.substring(0, 200))
  }
}

// ─── Gemini API 호출 헬퍼 (캐시 지원) ───
export async function callGemini(prompt, taskType = 'formula', useCache = false) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  if (useCache) {
    const cacheKey = makeCacheKey('gemini', taskType, prompt)
    const cached = await getCached(cacheKey)
    if (cached) return cached

    const result = await _fetchGemini(prompt)
    if (result) await setCached(cacheKey, 'gemini', taskType, result)
    return result
  }

  return _fetchGemini(prompt)
}

// ─── Layer 1: guide_cache에서 유사 처방 검색 (RAG) ───
export async function findSimilarFormulas(productType, purposes, limit = 3) {
  try {
    const pt = (productType || '').toLowerCase()
    let { rows } = await pool.query(
      `SELECT formula_name, product_type, skin_type, guide_data, total_wt_percent
       FROM guide_cache WHERE lower(product_type) = $1 AND wt_valid = true
       ORDER BY created_at DESC LIMIT $2`,
      [pt, limit]
    )
    if (rows.length < limit) {
      const { rows: fuzzy } = await pool.query(
        `SELECT formula_name, product_type, skin_type, guide_data, total_wt_percent
         FROM guide_cache WHERE lower(product_type) LIKE $1 AND wt_valid = true
         ORDER BY created_at DESC LIMIT $2`,
        [`%${pt}%`, limit - rows.length]
      )
      rows = [...rows, ...fuzzy]
    }
    if (rows.length < limit) {
      const { rows: copyRows } = await pool.query(
        `SELECT formula_name, guide_data, total_wt_percent, confidence
         FROM guide_cache_copy WHERE lower(formula_name) LIKE $1 AND wt_valid = true
         ORDER BY confidence DESC NULLS LAST LIMIT $2`,
        [`%${pt}%`, limit - rows.length]
      )
      rows = [...rows, ...copyRows.map(r => ({ ...r, product_type: pt, skin_type: null }))]
    }
    return rows
  } catch (err) {
    console.error('[RAG] 유사 처방 검색 실패:', err.message)
    return []
  }
}

// ─── Layer 1: DB 정밀 원료 검색 (목적+타입 기반) ───
export async function findSmartIngredients(productType, purposes, targetMarket, limit = 60) {
  const ingredients = []
  const addedIncis = new Set()

  if (purposes) {
    for (const ing of [...purposes.required, ...purposes.recommended]) {
      if (!addedIncis.has(ing.inci_name.toLowerCase())) {
        ingredients.push({
          inci_name: ing.inci_name,
          korean_name: ing.korean_name,
          ingredient_type: ing.ingredient_type || 'ACTIVE',
          source: 'purpose-gate',
          role: ing.role,
          default_pct: ing.default_pct_int ? ing.default_pct_int / 100 : null,
          max_pct: ing.max_pct_int ? ing.max_pct_int / 100 : null,
          fn: ing.fn,
        })
        addedIncis.add(ing.inci_name.toLowerCase())
      }
    }
  }

  const similarFormulas = await findSimilarFormulas(productType, purposes)
  for (const formula of similarFormulas) {
    const phases = formula.guide_data?.phases || []
    for (const phase of phases) {
      for (const ing of (phase.ingredients || [])) {
        const inci = (ing.inci_name || '').toLowerCase()
        if (inci && !addedIncis.has(inci) && inci !== 'water (aqua)' && inci !== 'water') {
          ingredients.push({
            inci_name: ing.inci_name,
            korean_name: ing.korean_name || '',
            ingredient_type: ing.type || 'OTHER',
            source: 'rag-reference',
            role: null,
            default_pct: ing.wt_percent || null,
            fn: ing.function || '',
          })
          addedIncis.add(inci)
        }
      }
    }
  }

  const neededTypes = ['HUMECTANT', 'EMOLLIENT', 'EMULSIFIER', 'THICKENER', 'PRESERVATIVE', 'ACTIVE', 'ANTIOXIDANT', 'UV_FILTER']
  const remaining = limit - ingredients.length
  if (remaining > 0) {
    const excludeList = [...addedIncis]
    const { rows: imRows } = await pool.query(
      `SELECT inci_name, korean_name, ingredient_type
       FROM ingredient_master
       WHERE ingredient_type = ANY($1)
         AND ($2::text[] IS NULL OR lower(inci_name) != ALL($2))
       ORDER BY RANDOM() LIMIT $3`,
      [neededTypes, excludeList.length > 0 ? excludeList : null, remaining]
    )
    for (const r of imRows) {
      if (!addedIncis.has(r.inci_name.toLowerCase())) {
        ingredients.push({
          inci_name: r.inci_name,
          korean_name: r.korean_name || '',
          ingredient_type: r.ingredient_type,
          source: 'db-supplement',
          role: null,
          default_pct: null,
          fn: '',
        })
        addedIncis.add(r.inci_name.toLowerCase())
      }
    }
  }

  return { ingredients, similarFormulas }
}

// ─── Layer 2: 스마트 프롬프트 조립 ───
export function buildSmartPrompt({ productType, requirements, targetMarket, customIngredients, physicalSpecs,
                                   smartIngredients, similarFormulas, purposes, regulations, compatRules }) {
  let purposeBlock = ''
  if (purposes && purposes.detected.length > 0) {
    const reqList = purposes.required.map(r =>
      `  - [필수] ${r.inci_name} (${r.korean_name}): ${r.fn}, 배합 ${(r.default_pct_int || 0) / 100}%${r.max_pct_int ? ` (최대 ${r.max_pct_int / 100}%)` : ''}`
    ).join('\n')
    const recList = purposes.recommended.slice(0, 12).map(r =>
      `  - [권장] ${r.inci_name} (${r.korean_name}): ${r.fn}, 배합 ${(r.default_pct_int || 0) / 100}%${r.max_pct_int ? ` (최대 ${r.max_pct_int / 100}%)` : ''}`
    ).join('\n')
    const forbList = purposes.forbidden.map(f => `  - [금지] ${f.inci_name}: ${f.reason}`).join('\n')
    purposeBlock = `\n\n처방 목적: ${purposes.detected.join(', ')}
목적별 필수 성분 (반드시 포함):
${reqList}
${recList ? `\n목적별 권장 성분 (가능하면 포함, 배합비 참고):\n${recList}` : ''}
${forbList ? `\n목적별 금지 성분 (절대 사용 금지):\n${forbList}` : ''}`
  }

  let ragBlock = ''
  if (similarFormulas.length > 0) {
    const refs = similarFormulas.map((f, i) => {
      const phases = f.guide_data?.phases || []
      const ings = phases.flatMap(p => (p.ingredients || []).map(ing =>
        `    ${ing.inci_name}: ${ing.wt_percent}% (${ing.function || ''})`
      )).join('\n')
      return `  [참고 처방 ${i + 1}] ${f.formula_name || f.product_type}\n${ings}`
    }).join('\n\n')
    ragBlock = `\n\n실제 처방 레퍼런스 (배합비와 구성을 참고하되 그대로 복사하지 말 것):
${refs}`
  }

  const grouped = {}
  for (const ing of smartIngredients) {
    let src
    if (ing.source === 'purpose-gate') {
      src = ing.role === 'REQUIRED' ? '★ 필수' : '◎ 권장'
    } else if (ing.source === 'rag-reference') {
      src = '◆ 레퍼런스'
    } else {
      src = '○ DB보충'
    }
    const key = ing.ingredient_type || 'OTHER'
    if (!grouped[key]) grouped[key] = []
    const regInfo = regulations.find(r => r.inci_name === ing.inci_name)
    const pctHint = ing.default_pct
      ? ` [권장 ${ing.default_pct}%${ing.max_pct ? `~최대 ${ing.max_pct}%` : ''}]`
      : ''
    grouped[key].push(
      `  ${src} ${ing.inci_name} (${ing.korean_name || '—'})` +
      pctHint +
      (regInfo ? ` {규제한도 ${regInfo.max_concentration}}` : '') +
      (ing.fn ? ` — ${ing.fn}` : '')
    )
  }
  const ingredientBlock = Object.entries(grouped)
    .map(([type, items]) => `[${type}]\n${items.join('\n')}`)
    .join('\n\n')

  let compatBlock = ''
  if (compatRules.length > 0) {
    const forbidden = compatRules.filter(r => r.severity === 'forbidden')
    if (forbidden.length > 0) {
      compatBlock = '\n\n금지 조합 (동시 배합 불가):\n' +
        forbidden.map(r => `  - ${r.ingredient_a} + ${r.ingredient_b}: ${r.reason}`).join('\n')
    }
  }

  const customList = customIngredients?.length
    ? '\n\n사용자 지정 원료 (반드시 포함):\n' + customIngredients.map(c => `- ${c.name}: ${c.percentage}%`).join('\n')
    : ''

  const physSpecBlock = physicalSpecs?.length
    ? '\n\n목표 물성:\n' + physicalSpecs.map(s => `- ${s}`).join('\n')
    : ''

  return `당신은 COCHING AI v2.3 화장품 처방 전문가입니다. 아래 DB 기반 원료 풀과 레퍼런스 처방을 참고하여 최적의 처방을 생성하세요.

핵심 규칙 (SKILL20260309):
1. 배합비 합계 = 정확히 100.00% (정수연산: wt%×100 → 합계 10000)
2. 정제수(Water) = 밸런스 역산 (10000 - 비정제수 합계)
3. Phase A(수상 70-75°C) / B(유상 70-75°C) / C(첨가 ≤45°C) / D(방부/향 ≤40°C)
4. 규제 최대 농도 초과 금지
5. 복합성분 = 투입원료명 + 구성 INCI 모두 표기
6. 동일 INCI 중복 시 전성분 합산
7. 향료(Fragrance) = 전개 안 함
8. 각 원료에 int_value(wt%×100 정수) 포함
9. 제조 공정 포함 (Phase별 온도, 시간, 순서)
10. 목적별 필수 성분은 반드시 포함, 금지 성분은 절대 미사용

방부 시스템 가이드 (2025-2026 최신 트렌드):
- 무방부 컨셉 우선: 1,2-Hexanediol(1.5-3%) 중심 + 부스터 조합
- 부스터: Caprylyl Glycol(0.2-0.5%), Ethylhexylglycerin(0.05-0.1%), Chlorphenesin(0.1-0.2%)
- Phenoxyethanol은 보조적으로만 사용 (0.5% 이하), 가능하면 미사용
- Paraben은 절대 사용하지 않음 (소비자 기피 원료)
- 전체 방부 시스템 합계: 2.0-3.5% 범위

제형: ${productType}
요구사항: ${requirements || '없음'}
타겟 시장: ${targetMarket}
${purposeBlock}${ragBlock}${compatBlock}${customList}${physSpecBlock}

사용 가능한 원료 풀 (★=목적필수[반드시포함], ◎=목적권장[가능하면포함], ◆=실제처방참조, ○=DB보충):
${ingredientBlock}

위 원료 풀에서 선택하여 완전한 처방을 생성하세요. ★표시 원료는 반드시 포함, ◎표시 원료는 가능하면 포함하세요.

응답은 반드시 JSON:
{
  "ingredients": [
    {"inci_name":"...","korean_name":"...","percentage":0.00,"int_value":0,"phase":"A","function":"...","type":"...","is_compound":false}
  ],
  "phases": [{"phase":"A","name":"수상","temp":"75°C","items":["Water","Glycerin"]}],
  "process": [{"step":1,"phase":"A","desc":"...","temp":"75°C","time":"10분","note":"..."}],
  "description": "...",
  "cautions": ["..."],
  "verification": {"step1_intSum":true,"step2_pctSum":true,"step3_aquaCross":true,"allPassed":true}
}`
}
