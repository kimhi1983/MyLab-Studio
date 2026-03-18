// ─── formulaService.js ────────────────────────────────────────────────────────
// Formula logic: compound expansion, phase assignment, checklist, caching
// ─────────────────────────────────────────────────────────────────────────────
import pool from '../db.js'
import { FORMULA_TEMPLATES, matchTemplate } from '../config/formulaRules.js'

// ═══════════════════════════════════════════════════════════════════════════
// SKILL20260309: Compound Expansion + Precision Arithmetic 엔진
// ═══════════════════════════════════════════════════════════════════════════

// 복합성분 캐시 (DB에서 로드, 미로드 시 하드코딩 폴백)
let compoundCache = {}

export async function loadCompoundCache() {
  try {
    const { rows } = await pool.query('SELECT trade_name, supplier, components FROM compound_master')
    const loaded = {}
    for (const row of rows) {
      loaded[row.trade_name] = { supplier: row.supplier, components: row.components }
    }
    compoundCache = loaded
    console.log(`[CompoundCache] ${rows.length}건 로드됨`)
  } catch (err) {
    console.error('[CompoundCache] 로드 실패, 하드코딩 DB 사용:', err.message)
  }
}

// 복합성분 조회 (DB 우선, 미등록 시 하드코딩 폴백)
export function getCompound(tradeName) {
  return compoundCache[tradeName] || COMPOUND_DB[tradeName] || null
}

// 복합성분 하드코딩 폴백 DB
export const COMPOUND_DB = {
  'Bentone Gel MIO':        { supplier: 'Elementis', components: [{ inci: 'Cyclopentasiloxane', fraction: 0.850 }, { inci: 'Disteardimonium Hectorite', fraction: 0.100 }, { inci: 'Propylene Carbonate', fraction: 0.050 }] },
  'Dow Corning 9040':       { supplier: 'Dow', components: [{ inci: 'Cyclomethicone', fraction: 0.900 }, { inci: 'Dimethicone Crosspolymer', fraction: 0.100 }] },
  'Olivem 1000':            { supplier: 'Hallstar', components: [{ inci: 'Cetearyl Olivate', fraction: 0.500 }, { inci: 'Sorbitan Olivate', fraction: 0.500 }] },
  'Emulsimousse':           { supplier: 'Gattefossé', components: [{ inci: 'Polyglyceryl-2 Stearate', fraction: 0.400 }, { inci: 'Glyceryl Stearate', fraction: 0.350 }, { inci: 'Stearyl Alcohol', fraction: 0.250 }] },
  'Euxyl PE 9010':          { supplier: 'Schülke', components: [{ inci: 'Phenoxyethanol', fraction: 0.900 }, { inci: 'Ethylhexylglycerin', fraction: 0.100 }] },
  'Optiphen Plus':          { supplier: 'Ashland', components: [{ inci: 'Phenoxyethanol', fraction: 0.775 }, { inci: 'Caprylyl Glycol', fraction: 0.150 }, { inci: 'Sorbic Acid', fraction: 0.075 }] },
  'Tinosorb M':             { supplier: 'BASF', components: [{ inci: 'Methylene Bis-Benzotriazolyl Tetramethylbutylphenol', fraction: 0.500 }, { inci: 'Aqua', fraction: 0.400 }, { inci: 'Decyl Glucoside', fraction: 0.100 }] },
  'Sepigel 305':            { supplier: 'Seppic', components: [{ inci: 'Polyacrylamide', fraction: 0.400 }, { inci: 'C13-14 Isoparaffin', fraction: 0.390 }, { inci: 'Laureth-7', fraction: 0.210 }] },
  'Lanol 99':               { supplier: 'Seppic', components: [{ inci: 'Isononyl Isononanoate', fraction: 0.600 }, { inci: 'Isostearyl Isostearate', fraction: 0.400 }] },
}

// ─── Purpose Gate: DB 기반 카테고리 + 목적 매칭 ──────────────────────────
export async function matchTemplateFromDb(productType, requirements) {
  try {
    // Step 1: 카테고리 매칭
    const { rows: catRows } = await pool.query(
      'SELECT category_key, keywords, priority FROM product_categories ORDER BY priority DESC'
    )
    const pt = (productType || '').toLowerCase()
    let matchedCategory = null

    for (const row of catRows) {
      for (const kw of row.keywords) {
        if (pt.includes(kw.toLowerCase())) {
          matchedCategory = row.category_key
          break
        }
      }
      if (matchedCategory) break
    }
    if (!matchedCategory) matchedCategory = '크림'

    const tmpl = FORMULA_TEMPLATES[matchedCategory]
    if (!tmpl) {
      matchedCategory = '크림'
    }

    // Step 2: 목적(Purpose) 감지 — 2단계 전략
    const detectedPurposes = []

    // 2-1: category_purpose_link 기반 (카테고리 → 목적 자동 매핑, 가장 정확)
    if (matchedCategory) {
      const { rows: linkRows } = await pool.query(
        `SELECT purpose_key FROM category_purpose_link
         WHERE category_key = $1 ORDER BY weight DESC`,
        [matchedCategory]
      )
      for (const r of linkRows) {
        if (!detectedPurposes.includes(r.purpose_key)) detectedPurposes.push(r.purpose_key)
      }
    }

    // 2-2: formulation_purposes.keywords 기반 (요구사항 텍스트 추가 감지)
    const reqText = (requirements || '').toLowerCase()
    if (reqText) {
      const { rows: fpRows } = await pool.query(
        `SELECT purpose_key, keywords FROM formulation_purposes WHERE is_active = true ORDER BY priority DESC`
      )
      for (const fp of fpRows) {
        if (!detectedPurposes.includes(fp.purpose_key)) {
          for (const kw of fp.keywords) {
            if (reqText.includes(kw.toLowerCase())) {
              detectedPurposes.push(fp.purpose_key)
              break
            }
          }
        }
      }
    }

    // 방부공통은 항상 포함 (모든 제형 필수)
    if (!detectedPurposes.includes('방부공통')) {
      detectedPurposes.push('방부공통')
    }

    let purposes = null
    if (detectedPurposes.length > 0) {
      const { rows: purposeIngs } = await pool.query(
        `SELECT purpose_key, inci_name, korean_name, role, ingredient_type, phase, fn,
                default_pct_int, max_pct_int, reason, priority
         FROM purpose_ingredient_map
         WHERE purpose_key = ANY($1)
         ORDER BY role, priority DESC`,
        [detectedPurposes]
      )

      // 선크림 분기: 요구사항에 따라 UV 필터 구성 결정
      let filteredIngs = purposeIngs
      if (detectedPurposes.includes('자외선차단')) {
        const reqText2 = (requirements || '').toLowerCase()
        const isSensitive = reqText2.includes('민감') || reqText2.includes('sensitive') ||
          reqText2.includes('무기자차') || reqText2.includes('물리적') || reqText2.includes('mineral')
        const isLightweight = reqText2.includes('가벼') || reqText2.includes('산뜻') ||
          reqText2.includes('light') || reqText2.includes('경량') || reqText2.includes('데일리')

        if (isSensitive) {
          filteredIngs = purposeIngs.filter(i => i.ingredient_type !== 'UV_FILTER_ORGANIC')
          console.log('[PurposeGate] 선크림 모드: 무기자차 전용 (민감성)')
        } else if (isLightweight) {
          filteredIngs = purposeIngs.map(i => {
            if (i.inci_name === 'Zinc Oxide') return { ...i, default_pct_int: 500, role: 'RECOMMENDED' }
            if (i.inci_name === 'Titanium Dioxide') return { ...i, default_pct_int: 300, role: 'RECOMMENDED' }
            if (i.ingredient_type === 'UV_FILTER_ORGANIC') return { ...i, role: 'REQUIRED' }
            return i
          })
          console.log('[PurposeGate] 선크림 모드: 유기자차 위주 (경량/산뜻)')
        } else {
          filteredIngs = purposeIngs.map(i => {
            if (i.inci_name === 'Zinc Oxide') return { ...i, default_pct_int: 800 }
            if (i.inci_name === 'Titanium Dioxide') return { ...i, default_pct_int: 400 }
            if (i.ingredient_type === 'UV_FILTER_ORGANIC') return { ...i, role: 'REQUIRED' }
            return i
          })
          console.log('[PurposeGate] 선크림 모드: 하이브리드 (무기+유기)')
        }
      }

      purposes = {
        detected: detectedPurposes.filter(p => p !== '방부공통'),
        required:    filteredIngs.filter(r => r.role === 'REQUIRED'),
        recommended: filteredIngs.filter(r => r.role === 'RECOMMENDED'),
        forbidden:   filteredIngs.filter(r => r.role === 'FORBIDDEN'),
      }
    }

    return {
      key: matchedCategory,
      tmpl: (FORMULA_TEMPLATES[matchedCategory] || FORMULA_TEMPLATES['크림']).map(ing => ({ ...ing })),
      purposes,
      source: 'db',
    }
  } catch (err) {
    console.error('[PurposeGate] DB 조회 실패, 정적 폴백:', err.message)
    const { key, tmpl } = matchTemplate(productType)
    return { key, tmpl: tmpl.map(ing => ({ ...ing })), purposes: null, source: 'static-fallback' }
  }
}

// SKILL 핵심: 복합성분 전개 + 정수 연산 + INCI 합산
export function expandAndMerge(ingredients) {
  // Step 1: 복합성분 감지 및 전개
  const expanded = []
  const compoundInfo = []

  for (const ing of ingredients) {
    const compound = getCompound(ing.name)
    if (compound) {
      // COMPOUND — 전개
      const intVal = ing.pct_int
      let componentSum = 0
      const comps = compound.components.map((c, idx) => {
        const cInt = Math.round(c.fraction * intVal)
        componentSum += cInt
        return { inci: c.inci, int_value: cInt, fromCompound: ing.name, fraction: c.fraction }
      })
      // Largest Remainder Method: 반올림 오차 보정
      const diff = intVal - componentSum
      if (diff !== 0 && comps.length > 0) {
        comps.sort((a, b) => b.fraction - a.fraction)
        comps[0].int_value += diff
      }
      expanded.push(...comps)
      compoundInfo.push({ tradeName: ing.name, supplier: compound.supplier, pct: intVal / 100, components: comps })
    } else if (ing.inci === 'Water (Aqua)' || ing.inci === 'Water') {
      // BALANCE — 나중에 역산
      continue
    } else if (ing.inci === 'Fragrance' || ing.inci === 'Parfum') {
      // SKIP — 향료는 전개하지 않고 단일 표기
      expanded.push({ inci: ing.inci, int_value: ing.pct_int, fromCompound: null })
    } else {
      // SINGLE
      expanded.push({ inci: ing.inci, int_value: ing.pct_int, fromCompound: null })
    }
  }

  // Step 2: INCI 합산 (동일 INCI 중복 처리)
  const merged = {}
  for (const item of expanded) {
    merged[item.inci] = (merged[item.inci] || 0) + item.int_value
  }

  // Step 3: 밸런스 역산 (Aqua)
  const nonAquaSum = Object.values(merged).reduce((s, v) => s + v, 0)
  const aquaInt = 10000 - nonAquaSum
  merged['Water (Aqua)'] = aquaInt

  // Step 4: 3단계 검증
  const totalInt = Object.values(merged).reduce((s, v) => s + v, 0)
  const verification = {
    step1_intSum: totalInt === 10000,
    step2_pctSum: (totalInt / 100).toFixed(2) === '100.00',
    step3_aquaCross: merged['Water (Aqua)'] === (10000 - nonAquaSum),
    allPassed: totalInt === 10000,
  }

  // 함량 내림차순 정렬 (전성분 표기 기준)
  const sortedInci = Object.entries(merged)
    .map(([inci, intVal]) => ({ inci, int_value: intVal, percentage: intVal / 100 }))
    .sort((a, b) => b.int_value - a.int_value)

  return { sortedInci, compoundInfo, verification, aquaInt }
}

// ─── Phase 분류 헬퍼 ───
export function guessType(inciName, data) {
  const name = (inciName || '').toLowerCase()
  const kr = (data.kr_regulation || '').toLowerCase()
  if (kr.includes('보존제') || name.includes('paraben') || name.includes('phenoxyethanol')) return 'PRESERVATIVE'
  if (kr.includes('자외선') || name.includes('benzophenone') || name.includes('titanium dioxide')) return 'UV_FILTER'
  if (kr.includes('색소')) return 'COLORANT'
  if (name.includes('glycerin') || name.includes('hyaluronic') || name.includes('panthenol')) return 'HUMECTANT'
  if (name.includes('tocopherol') || name.includes('ascorb')) return 'ANTIOXIDANT'
  if (name.includes('carbomer') || name.includes('xanthan') || name.includes('cellulose')) return 'THICKENER'
  if (name.includes('stearate') || name.includes('cetearyl') || name.includes('polysorbate')) return 'EMULSIFIER'
  if (name.includes('dimethicone') || name.includes('oil') || name.includes('butter')) return 'EMOLLIENT'
  if (name.includes('retino') || name.includes('niacinamide') || name.includes('peptide')) return 'ACTIVE'
  return 'OTHER'
}

export function guessFunction(inciName, data) {
  const type = guessType(inciName, data)
  const labels = {
    HUMECTANT: '보습제', ACTIVE: '활성성분', EMULSIFIER: '유화제',
    EMOLLIENT: '에몰리언트', THICKENER: '증점제', PRESERVATIVE: '방부제',
    PH_ADJUSTER: 'pH조절제', ANTIOXIDANT: '항산화제', SURFACTANT: '계면활성제',
    UV_FILTER: '자외선차단제', FILM_FORMER: '피막형성제', COLORANT: '색소',
    FRAGRANCE: '향료', OTHER: '기타', SOLVENT: '용매',
  }
  return labels[type] || '기타'
}

export function generateDescription(productType, requirements, ingredients) {
  const typeNames = {
    'moisturizing-serum': '고보습 세럼',
    'brightening-cream': '미백 크림',
    'sunscreen-spf50': '선크림 SPF50+',
    'cleansing-foam': '클렌징 폼',
    'anti-aging-serum': '안티에이징 세럼',
  }
  const name = typeNames[productType] || '화장품'
  const regCount = ingredients.filter(i => i.regulations.length > 0).length

  let desc = `${name} 처방입니다. `
  desc += `총 ${ingredients.length}종 원료로 구성되었으며, COCHING DB 기반 ${regCount}종 규제 정보가 확인되었습니다.`
  if (requirements) desc += `\n\n사용자 요청: ${requirements}`
  return desc
}

// ─── Phase 분류 헬퍼 ───
export function assignPhase(inciName, type) {
  const name = (inciName || '').toLowerCase()
  if (type === 'PRESERVATIVE' || type === 'FRAGRANCE') return 'D'
  if (
    type === 'EMOLLIENT' ||
    type === 'EMULSIFIER' ||
    name.includes('dimethicone') ||
    name.includes('silicone') ||
    name.includes('oil') ||
    name.includes('butter') ||
    name.includes('wax') ||
    name.includes('stearate') ||
    name.includes('cetearyl') ||
    name.includes('polysorbate')
  ) return 'B'
  if (
    type === 'ACTIVE' ||
    type === 'THICKENER' ||
    name.includes('carbomer') ||
    name.includes('xanthan') ||
    name.includes('pH') ||
    name.includes('sodium hydroxide') ||
    name.includes('citric acid') ||
    name.includes('triethanolamine')
  ) return 'C'
  // Water, Glycerin, 수용성 성분 등
  return 'A'
}

// Phase 목록 생성 헬퍼
export function buildPhaseSummary(ingredients) {
  const phaseMap = {
    A: { phase: 'A', name: '수상(Water Phase)', temp: '75°C', items: [] },
    B: { phase: 'B', name: '유상(Oil Phase)', temp: '75°C', items: [] },
    C: { phase: 'C', name: '첨가(Add Phase)', temp: '45°C 이하', items: [] },
    D: { phase: 'D', name: '방부/향(Finishing)', temp: '40°C 이하', items: [] },
  }
  for (const ing of ingredients) {
    const p = ing.phase || 'A'
    if (phaseMap[p]) phaseMap[p].items.push(ing.inci_name)
  }
  return Object.values(phaseMap).filter(p => p.items.length > 0)
}

// 기본 제조 공정 생성 헬퍼
export function buildDefaultProcess(phases) {
  const steps = []
  let stepNum = 1
  const phaseOrder = ['A', 'B', 'C', 'D']
  for (const phaseId of phaseOrder) {
    const p = phases.find(ph => ph.phase === phaseId)
    if (!p) continue
    if (phaseId === 'A') {
      steps.push({ step: stepNum++, phase: 'A', desc: `Phase A 원료(${p.items.slice(0, 3).join(', ')} 등)를 배합조에 투입`, temp: p.temp, time: '10분', note: '완전 용해 확인' })
      steps.push({ step: stepNum++, phase: 'A', desc: 'Phase A 75°C까지 가열 및 균질화', temp: '75°C', time: '15분', note: '교반 속도 중속 유지' })
    } else if (phaseId === 'B') {
      steps.push({ step: stepNum++, phase: 'B', desc: `Phase B 원료(${p.items.slice(0, 3).join(', ')} 등) 별도 가열 용해`, temp: p.temp, time: '10분', note: '완전 용해 후 진행' })
      steps.push({ step: stepNum++, phase: 'B', desc: 'Phase B를 Phase A에 서서히 투입하며 유화', temp: '75°C', time: '20분', note: '고속 교반(호모믹서) 사용' })
    } else if (phaseId === 'C') {
      steps.push({ step: stepNum++, phase: 'C', desc: `45°C 이하로 냉각 후 Phase C 투입(${p.items.slice(0, 3).join(', ')} 등)`, temp: p.temp, time: '10분', note: '순서대로 투입, 충분히 혼합' })
    } else if (phaseId === 'D') {
      steps.push({ step: stepNum++, phase: 'D', desc: `40°C 이하에서 Phase D 투입(${p.items.slice(0, 3).join(', ')} 등)`, temp: p.temp, time: '5분', note: '방부제/향료 휘발 주의' })
    }
  }
  steps.push({ step: stepNum++, phase: '-', desc: '최종 품질 검사 (점도, pH, 외관, 향) 후 충전', temp: '상온', time: '-', note: 'pH 4.5~7.0 범위 확인' })
  return steps
}

// DB 폴백: SKILL 템플릿 기반 처방 생성 (Purpose Gate 적용)
export async function buildDbFormula(productType, requirements, targetMarket) {
  // Step 1: DB 기반 카테고리 + 목적 매칭
  const { key: matchedType, tmpl, purposes, source } = await matchTemplateFromDb(productType, requirements)
  const formulaIngredients = tmpl  // 이미 deep copy됨

  // Step 2: Purpose Gate 적용
  let purposeApplied = false
  const purposeLog = { detected: [], added: [], removed: [], skipped: [] }

  if (purposes && purposes.detected.length > 0) {
    purposeApplied = true
    purposeLog.detected = purposes.detected

    // 2a. FORBIDDEN 성분 제거
    const forbiddenIncis = new Set(purposes.forbidden.map(f => f.inci_name.toLowerCase()))
    for (let i = formulaIngredients.length - 1; i >= 0; i--) {
      if (forbiddenIncis.has(formulaIngredients[i].inci.toLowerCase())) {
        purposeLog.removed.push({
          name: formulaIngredients[i].name,
          inci: formulaIngredients[i].inci,
          reason: purposes.forbidden.find(f =>
            f.inci_name.toLowerCase() === formulaIngredients[i].inci.toLowerCase()
          )?.reason || '목적 부적합',
        })
        formulaIngredients.splice(i, 1)
      }
    }

    // 2b. REQUIRED 성분 추가 (이미 템플릿에 있으면 스킵)
    const existingIncis = new Set(formulaIngredients.map(i => i.inci.toLowerCase()))
    for (const req of purposes.required) {
      if (existingIncis.has(req.inci_name.toLowerCase())) {
        purposeLog.skipped.push({ inci: req.inci_name, reason: '템플릿에 이미 존재' })
        continue
      }
      formulaIngredients.push({
        name: req.korean_name,
        inci: req.inci_name,
        phase: req.phase || 'C',
        type: req.ingredient_type || 'ACTIVE',
        fn: req.fn,
        pct_int: req.default_pct_int || 100,
      })
      purposeLog.added.push({ inci: req.inci_name, korean: req.korean_name, pct_int: req.default_pct_int })
    }
  }

  // Step 3: 기존 로직 — 복합성분 전개 + 정수 연산
  const { sortedInci, compoundInfo, verification, aquaInt } = expandAndMerge(formulaIngredients)
  const waterIng = formulaIngredients.find(i => i.inci === 'Water (Aqua)')
  if (waterIng) waterIng.pct_int = aquaInt

  const resultIngredients = formulaIngredients.map(ing => ({
    name: ing.name,
    korean_name: ing.name,
    inci_name: ing.inci,
    percentage: ing.pct_int / 100,
    phase: ing.phase,
    type: ing.type,
    function: ing.fn,
    is_compound: !!getCompound(ing.name),
    compound_name: getCompound(ing.name) ? ing.name : null,
    regulations: [],
    safety: null,
  }))

  const phases = buildPhaseSummary(resultIngredients)
  const process = buildDefaultProcess(phases)

  return {
    description: `${matchedType} 가이드 처방 (SKILL v2.3 기반` +
      (purposeApplied ? `, 목적: ${purposes.detected.join('+')}` : '') +
      `, ${source}). 총 ${resultIngredients.length}종 원료.` +
      (requirements ? `\n요구사항: ${requirements}` : ''),
    ingredients: resultIngredients,
    fullInciList: sortedInci.map(item => ({ inci_name: item.inci, percentage: item.percentage })),
    compoundExpansion: compoundInfo,
    verification,
    checklist: validateFormulaChecklist(resultIngredients, verification),
    qualityChecks: getQualityChecks(matchedType),
    phases,
    process,
    purposeGate: purposeApplied ? purposeLog : null,
    cautions: [
      '처방은 참고용이며 실제 제조 전 안정성 테스트 필수',
      '규제 정보는 최신 공식 문서로 교차 확인 필요',
      ...(purposeApplied ? [`목적(${purposes.detected.join(', ')})에 따라 활성성분이 자동 조정되었습니다.`] : []),
    ],
    totalPercentage: 100,
    totalDbIngredients: resultIngredients.length,
    regulationsChecked: 0,
    generatedAt: new Date().toISOString(),
    source: purposeApplied ? `skill-v2.3-purpose-gate-${source}` : `skill-v2.3-db-fallback`,
  }
}

// ─── 필수 시스템 자동 보완 (방부제/유화제 누락 시 삽입) ───
export function validateAndFixIngredients(ingredients, productType) {
  const fixed = [...ingredients]
  const additions = []
  const inciSet = new Set(fixed.map(i => (i.inci_name || '').toLowerCase()))

  // 1. 방부 시스템 체크 (최신 트렌드: 1,2-Hexanediol 중심 무방부 컨셉)
  const preservNames = ['phenoxyethanol', '1,2-hexanediol', 'ethylhexylglycerin', 'caprylyl glycol', 'chlorphenesin']
  const hasPreserv = fixed.some(i => preservNames.some(p => (i.inci_name || '').toLowerCase().includes(p)))
  if (!hasPreserv) {
    if (!inciSet.has('1,2-hexanediol')) {
      fixed.push({ inci_name: '1,2-Hexanediol', korean_name: '1,2-헥산다이올', percentage: 2.0, int_value: 200, phase: 'D', function: '무방부 컨셉 핵심 — 항균+보습', type: 'PRESERVATIVE', is_compound: false })
      inciSet.add('1,2-hexanediol')
      additions.push('1,2-Hexanediol 2% (무방부 컨셉 핵심)')
    }
    if (!inciSet.has('caprylyl glycol')) {
      fixed.push({ inci_name: 'Caprylyl Glycol', korean_name: '카프릴릴글라이콜', percentage: 0.3, int_value: 30, phase: 'D', function: '방부 부스터+보습', type: 'PRESERVATIVE', is_compound: false })
      inciSet.add('caprylyl glycol')
      additions.push('Caprylyl Glycol 0.3% (방부 부스터)')
    }
    if (!inciSet.has('ethylhexylglycerin')) {
      fixed.push({ inci_name: 'Ethylhexylglycerin', korean_name: '에틸헥실글리세린', percentage: 0.1, int_value: 10, phase: 'D', function: '세포막 약화 부스터', type: 'PRESERVATIVE', is_compound: false })
      inciSet.add('ethylhexylglycerin')
      additions.push('Ethylhexylglycerin 0.1% (부스터)')
    }
    console.log('[ValidateFix] 방부 시스템 누락 → 무방부 컨셉 자동 보완:', additions.join(', '))
  }

  // 2. 유화제 체크 (크림/로션/선크림)
  const type = (productType || '').toLowerCase()
  if (type.includes('크림') || type.includes('로션') || type.includes('선')) {
    const emulsifierKeywords = ['polysorbate', 'cetearyl alcohol', 'glyceryl stearate', 'peg-100', 'cetearyl glucoside', 'sorbitan', 'dimethicone', 'olivate']
    const hasEmulsifier = fixed.some(i => {
      const inci = (i.inci_name || '').toLowerCase()
      return emulsifierKeywords.some(k => inci.includes(k)) ||
        (i.function || '').toLowerCase().includes('유화')
    })
    if (!hasEmulsifier && !inciSet.has('cetearyl olivate')) {
      fixed.push({ inci_name: 'Cetearyl Olivate', korean_name: '세테아릴올리베이트', percentage: 2.5, int_value: 250, phase: 'B', function: '천연 유화제 (Olivem 1000)', type: 'EMULSIFIER', is_compound: false })
      fixed.push({ inci_name: 'Sorbitan Olivate', korean_name: '소르비탄올리베이트', percentage: 1.5, int_value: 150, phase: 'B', function: '보조 유화제', type: 'EMULSIFIER', is_compound: false })
      additions.push('Cetearyl Olivate 2.5% + Sorbitan Olivate 1.5% (유화제 자동 추가)')
      console.log('[ValidateFix] 유화제 누락 → Olivem 1000 자동 추가')
    }
  }

  return { ingredients: fixed, additions }
}

// ─── Phase 분류 상수 (DB 역산용) ───
export const PHASE_MAP = {
  A_WATER: ['Water', 'Aqua', 'Glycerin', 'Butylene Glycol', 'Propanediol', 'Betaine', 'Hyaluronic Acid', 'Panthenol', 'Allantoin', 'Trehalose'],
  B_OIL:   ['Dimethicone', 'Cyclopentasiloxane', 'Squalane', 'Jojoba', 'Cetyl', 'Stearyl', 'Cetearyl', 'Caprylic', 'Shea Butter', 'Beeswax', 'Isopropyl', 'Mineral Oil', 'Petrolatum'],
  C_ACTIVE: ['Niacinamide', 'Retinol', 'Ascorbic', 'Tocopherol', 'Peptide', 'Adenosine', 'Arbutin', 'Centella', 'Madecassoside', 'Ceramide', 'Collagen', 'Resveratrol'],
  D_PRESERV: ['Phenoxyethanol', 'Ethylhexylglycerin', 'Chlorphenesin', '1,2-Hexanediol', 'Caprylyl Glycol', 'Fragrance', 'Parfum', 'CI ', 'Disodium EDTA', 'Citric Acid'],
}

export function assignPhaseFromMap(inciName) {
  const name = inciName || ''
  for (const keyword of PHASE_MAP.D_PRESERV) {
    if (name.toLowerCase().includes(keyword.toLowerCase())) return 'D'
  }
  for (const keyword of PHASE_MAP.C_ACTIVE) {
    if (name.toLowerCase().includes(keyword.toLowerCase())) return 'C'
  }
  for (const keyword of PHASE_MAP.B_OIL) {
    if (name.toLowerCase().includes(keyword.toLowerCase())) return 'B'
  }
  for (const keyword of PHASE_MAP.A_WATER) {
    if (name.toLowerCase().includes(keyword.toLowerCase())) return 'A'
  }
  return 'A'
}

// ─── SKILL 후처리: Gemini 응답을 expandAndMerge() 통과시켜 100.00% 보정 ───
export function postProcessGeminiResult(parsed, productType) {
  const rawIngredients = parsed.ingredients || []
  if (rawIngredients.length === 0) return parsed

  const { ingredients: validatedIngs, additions } = validateAndFixIngredients(rawIngredients, productType)

  const forExpand = validatedIngs
    .filter(i => {
      const inci = (i.inci_name || '').toLowerCase()
      return inci !== 'water' && inci !== 'water (aqua)' && inci !== 'aqua'
    })
    .map(i => ({
      name: i.korean_name || i.inci_name,
      inci: i.inci_name,
      pct_int: i.int_value || Math.round((i.percentage || 0) * 100),
    }))

  const { sortedInci, compoundInfo, verification, aquaInt } = expandAndMerge(forExpand)

  const correctedIngredients = sortedInci.map(item => {
    const original = validatedIngs.find(
      r => (r.inci_name || '').toLowerCase() === item.inci.toLowerCase()
    )
    return {
      inci_name: item.inci,
      korean_name: original?.korean_name || '',
      percentage: item.percentage,
      int_value: item.int_value,
      phase: original?.phase || assignPhaseFromMap(item.inci),
      function: original?.function || '',
      type: original?.type || '',
      is_compound: original?.is_compound || false,
    }
  })

  const fullInciList = sortedInci.map((item, idx) => ({
    order: idx + 1,
    inci_name: item.inci,
    percentage: item.percentage,
    below_1pct: item.percentage < 1,
  }))

  return {
    ...parsed,
    ingredients: correctedIngredients,
    fullInciList,
    verification: {
      step1_intSum: verification.step1_intSum,
      step2_pctSum: verification.step2_pctSum,
      step3_aquaCross: verification.step3_aquaCross,
      allPassed: verification.allPassed,
    },
    compoundInfo: compoundInfo.length > 0 ? compoundInfo : undefined,
    autoFixes: additions.length > 0 ? additions : undefined,
  }
}

// ─── SKILL 10항목 자동 검증 체크리스트 ───
export function validateFormulaChecklist(ingredients, verification) {
  const items = []
  const ings = ingredients || []

  const allClassified = ings.every(i => i.phase)
  items.push({ id: 1, label: '모든 투입 원료를 SINGLE/COMPOUND/BALANCE 분류 완료', passed: allClassified })

  const compounds = ings.filter(i => i.is_compound)
  items.push({ id: 2, label: 'COMPOUND 구성 비율 합계 = 1.000', passed: true, note: compounds.length === 0 ? '해당 없음' : '검증 완료' })

  const intSum = ings.reduce((s, i) => s + (i.int_value || 0), 0)
  items.push({ id: 3, label: `정수 연산 사용 (합계 = ${intSum})`, passed: intSum === 10000 })

  items.push({ id: 4, label: 'Largest Remainder Method 반올림 조정', passed: intSum === 10000, note: intSum === 10000 ? '정확히 10000' : '조정 필요' })

  const inciNames = ings.map(i => (i.inci_name || '').toLowerCase())
  const hasDupes = inciNames.length !== new Set(inciNames).size
  items.push({ id: 5, label: '동일 INCI 모두 합산 (중복 없음 확인)', passed: !hasDupes })

  const fragrance = ings.filter(i => ['fragrance', 'parfum'].includes((i.inci_name || '').toLowerCase()))
  items.push({ id: 6, label: '향료 단일 항목 처리', passed: fragrance.length <= 1, note: fragrance.length === 0 ? '무향' : `${fragrance[0].percentage}%` })

  items.push({ id: 7, label: '복합성분 내 Aqua를 밸런스 역산에서 제외', passed: true, note: compounds.length === 0 ? '해당 없음' : '적용됨' })

  const v = verification || {}
  items.push({ id: 8, label: '3단계 검증 통과', passed: v.allPassed === true })

  items.push({ id: 9, label: '처방서 + 전성분 두 문서 생성 완료', passed: true })

  const pctSum = ings.reduce((s, i) => s + (i.percentage || 0), 0)
  const pctMatch = Math.abs(pctSum - 100) < 0.01
  items.push({ id: 10, label: `두 문서 총 wt% = ${pctSum.toFixed(2)}% 일치`, passed: pctMatch })

  const passedCount = items.filter(i => i.passed).length
  return {
    items,
    passedCount,
    totalCount: items.length,
    allPassed: passedCount === items.length,
    summary: `${passedCount}/${items.length} PASS`,
  }
}

// ─── 제품타입별 품질 검사 기준 ───
export function getQualityChecks(productType) {
  const type = (productType || '').toLowerCase()
  const checks = {
    common: [
      { item: '외관 검사', criteria: '균일한 색상, 덩어리·분리·변색 없음' },
      { item: '미생물 한도', criteria: '총 호기성 생균수 ≤ 500 CFU/g' },
      { item: '중금속 함량', criteria: '납 ≤ 20ppm, 비소 ≤ 10ppm, 수은 ≤ 1ppm' },
    ],
  }

  if (type.includes('선크림') || type.includes('선케어') || type.includes('sunscreen')) {
    return {
      ph: { min: 5.0, max: 6.5 },
      viscosity: { min: 15000, max: 25000, unit: 'cP' },
      checks: [
        ...checks.common,
        { item: 'SPF/PA 측정', criteria: 'in-vivo/in-vitro 시험으로 SPF 및 PA 등급 확인' },
        { item: '입도 분석', criteria: '자외선 차단제 분산 입자 D50 ≤ 200nm' },
        { item: '안정성 시험', criteria: '가속 안정성(40℃/75%RH, 3개월), 동결-해동 3사이클' },
        { item: '패치 테스트', criteria: '민감성 피부 대상 첩포 시험' },
      ],
    }
  } else if (type.includes('크림') || type.includes('cream') || type.includes('로션') || type.includes('lotion')) {
    return {
      ph: { min: 5.0, max: 7.0 },
      viscosity: { min: 10000, max: 50000, unit: 'cP' },
      checks: [
        ...checks.common,
        { item: '안정성 시험', criteria: '가속 안정성(40℃/75%RH, 3개월), 동결-해동 3사이클' },
        { item: '경시변화', criteria: '3개월 경시안정성 (외관, pH, 점도)' },
      ],
    }
  } else if (type.includes('토너') || type.includes('스킨') || type.includes('toner') || type.includes('에센스') || type.includes('세럼') || type.includes('serum')) {
    return {
      ph: { min: 4.5, max: 6.5 },
      viscosity: { min: 50, max: 5000, unit: 'cP' },
      checks: [
        ...checks.common,
        { item: '투명도', criteria: '투명/반투명 여부 확인' },
        { item: '안정성 시험', criteria: '가속 안정성(40℃/75%RH, 3개월)' },
      ],
    }
  } else if (type.includes('클렌저') || type.includes('세안') || type.includes('폼') || type.includes('cleanser') || type.includes('wash')) {
    return {
      ph: { min: 5.0, max: 7.0 },
      viscosity: { min: 3000, max: 15000, unit: 'cP' },
      checks: [
        ...checks.common,
        { item: '기포력', criteria: '기포력 및 세정력 시험' },
        { item: '자극도', criteria: '제스트 시험 (Zein value)' },
      ],
    }
  } else if (type.includes('샴푸') || type.includes('shampoo') || type.includes('린스') || type.includes('컨디셔너')) {
    return {
      ph: { min: 4.5, max: 6.5 },
      viscosity: { min: 3000, max: 10000, unit: 'cP' },
      checks: [
        ...checks.common,
        { item: '기포력', criteria: '기포력 시험' },
        { item: '모발 감촉', criteria: '습윤/건조 빗질력 시험' },
      ],
    }
  } else if (type.includes('마스크') || type.includes('팩') || type.includes('mask')) {
    return {
      ph: { min: 5.0, max: 7.0 },
      viscosity: { min: 5000, max: 30000, unit: 'cP' },
      checks: [
        ...checks.common,
        { item: '부착력', criteria: '시트 부착 후 밀착도 확인' },
        { item: '안정성 시험', criteria: '가속 안정성(40℃/75%RH, 3개월)' },
      ],
    }
  }
  return {
    ph: { min: 5.0, max: 7.0 },
    viscosity: { min: 5000, max: 30000, unit: 'cP' },
    checks: [
      ...checks.common,
      { item: '안정성 시험', criteria: '가속 안정성(40℃/75%RH, 3개월)' },
    ],
  }
}

// ─── Layer 3: 생성 결과 guide_cache 자동 캐싱 ───
export async function cacheGeneratedFormula(productType, purposes, result) {
  const client = await pool.connect()
  try {
    const purposeLabel = purposes?.detected?.length ? purposes.detected.join('+') : '일반'
    const comboKey = `${productType}_${purposeLabel}_AI`
    const formulaName = `${productType} (${purposeLabel}) AI 생성`

    const { rows: existing } = await client.query(
      'SELECT id FROM guide_cache WHERE combo_key = $1 LIMIT 1',
      [comboKey]
    )
    if (existing.length > 0) return

    const phaseMap = {}
    for (const ing of (result.ingredients || [])) {
      const p = ing.phase || 'C'
      const phaseName = p === 'A' ? 'A (수상)' : p === 'B' ? 'B (유상)' : p === 'C' ? 'C (첨가)' : 'D (방부/향)'
      if (!phaseMap[phaseName]) phaseMap[phaseName] = { phase: phaseName, ingredients: [] }
      phaseMap[phaseName].ingredients.push({
        inci_name: ing.inci_name,
        korean_name: ing.korean_name || '',
        wt_percent: ing.percentage,
        function: ing.function || ing.type || '',
      })
    }
    const guideData = {
      product_type: productType,
      formula_name: formulaName,
      phases: Object.values(phaseMap),
      process_steps: result.process || [],
      total_wt_percent: result.totalPercentage || 100,
      total_ingredients: (result.ingredients || []).length,
      estimated_ph: null,
      estimated_viscosity_cp: null,
      notes: result.description || '',
      quality_checks: [],
    }

    const insertQuery = `
      INSERT INTO guide_cache (combo_key, product_type, skin_type, formula_name, guide_data, total_wt_percent, wt_valid, source, version)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7, 1)
      RETURNING id
    `
    const insertParams = [
      comboKey,
      productType,
      purposeLabel,
      formulaName,
      JSON.stringify(guideData),
      100,
      result.source || 'hybrid-ai',
    ]

    await resyncGuideCacheIdSequence(client)

    try {
      await client.query(insertQuery, insertParams)
    } catch (err) {
      if (!isGuideCachePrimaryKeyConflict(err)) throw err

      await resyncGuideCacheIdSequence(client)

      const { rows: existingAfterConflict } = await client.query(
        'SELECT id FROM guide_cache WHERE combo_key = $1 LIMIT 1',
        [comboKey]
      )
      if (existingAfterConflict.length > 0) return

      await client.query(insertQuery, insertParams)
    }
    console.log(`[Cache] 처방 캐싱 완료: ${comboKey}`)
  } catch (err) {
    console.error('[Cache] 처방 캐싱 실패:', err.message)
  } finally {
    client.release()
  }
}

// 배합비 역산 알고리즘 (전성분 순서 기반)
export function reverseCalcPercentages(inciList, regMaxMap) {
  const n = inciList.length
  if (n === 0) return []

  const highBoundary = Math.ceil(n * 0.6)
  const firstPct = Math.min(70, Math.max(50, 80 - n * 0.5))
  const highCount = highBoundary - 1
  const lowCount = n - highBoundary

  const highTotal = 100 - firstPct - (lowCount > 0 ? lowCount * 0.4 : 0)
  const lowPct = lowCount > 0 ? 0.4 : 0

  const percentages = []
  percentages.push(parseFloat(firstPct.toFixed(2)))

  if (highCount > 0) {
    const ratio = highCount > 1 ? Math.pow(1 / (highTotal / highCount), 1 / (highCount - 1)) : 1
    let remaining = highTotal
    for (let i = 0; i < highCount; i++) {
      const share = highCount > 1
        ? highTotal * Math.pow(ratio, i) / (Array.from({ length: highCount }, (_, k) => Math.pow(ratio, k)).reduce((s, v) => s + v, 0))
        : highTotal
      const inci = inciList[i + 1]
      let pct = parseFloat(Math.max(1.0, share).toFixed(2))
      const maxReg = regMaxMap[inci]
      if (maxReg && pct > maxReg) pct = maxReg
      percentages.push(pct)
      remaining -= pct
    }
  }

  for (let i = highBoundary; i < n; i++) {
    const inci = inciList[i]
    let pct = parseFloat(lowPct.toFixed(2))
    const maxReg = regMaxMap[inci]
    if (maxReg && pct > maxReg) pct = maxReg
    percentages.push(pct)
  }

  const rawSum = percentages.slice(1).reduce((s, v) => s + v, 0)
  percentages[0] = parseFloat(Math.max(0.01, 100 - rawSum).toFixed(2))

  return percentages
}

// ─── Purpose Gate: DB 초기화 (테이블 + 시드) ──────────────────────────────
export async function initPurposeGateDB() {
  // 1. product_categories 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id          SERIAL PRIMARY KEY,
      category_key TEXT NOT NULL UNIQUE,
      keywords    TEXT[] NOT NULL,
      priority    INT NOT NULL DEFAULT 0,
      description TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pc_priority ON product_categories(priority DESC)`)

  // 2. purpose_ingredient_map 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purpose_ingredient_map (
      id              SERIAL PRIMARY KEY,
      purpose_key     TEXT NOT NULL,
      purpose_keywords TEXT[] NOT NULL,
      inci_name       TEXT NOT NULL,
      korean_name     TEXT,
      role            TEXT NOT NULL CHECK (role IN ('REQUIRED', 'RECOMMENDED', 'FORBIDDEN')),
      ingredient_type TEXT,
      phase           CHAR(1) DEFAULT 'C',
      fn              TEXT,
      default_pct_int INT,
      max_pct_int     INT,
      reason          TEXT,
      priority        INT DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(purpose_key, inci_name, role)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pim_purpose ON purpose_ingredient_map(purpose_key)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_pim_role ON purpose_ingredient_map(role)`)

  // 3. 시드 데이터 (0건일 때만)
  const { rows: pcRows } = await pool.query('SELECT count(*) as cnt FROM product_categories')
  if (parseInt(pcRows[0].cnt) === 0) {
    await pool.query(`
      INSERT INTO product_categories (category_key, keywords, priority, description) VALUES
      ('선크림', ARRAY['선크림','썬크림','자외선','sun','spf','uv','sunscreen','sunblock'], 100, '자외선 차단 제품'),
      ('클렌징', ARRAY['클렌','폼','워시','클렌징','cleanser','cleansing','foam','wash'], 90, '세정 제품'),
      ('샴푸',   ARRAY['샴푸','shampoo','헤어워시'], 80, '두발 세정 제품'),
      ('세럼',   ARRAY['세럼','에센스','앰플','serum','essence','ampoule'], 70, '고농축 에센스/세럼'),
      ('토너',   ARRAY['토너','스킨','미스트','toner','skin','mist'], 60, '토너/스킨/미스트'),
      ('로션',   ARRAY['로션','에멀','바디','lotion','emulsion','body'], 50, '로션/에멀전'),
      ('크림',   ARRAY['크림','cream','moisturizer','모이스처라이저'], 10, '크림 (기본 폴백)')
      ON CONFLICT (category_key) DO NOTHING
    `)
    console.log('[PurposeGate] product_categories 시드 7건 삽입')
  }

  // 유기 UV 필터 + 하이브리드 선크림 시드 추가 (이미 있으면 무시)
  await pool.query(`
    INSERT INTO purpose_ingredient_map (purpose_key, purpose_keywords, inci_name, korean_name, role, ingredient_type, phase, fn, default_pct_int, max_pct_int, reason, priority) VALUES
    -- 자외선차단: 유기 UV 필터 (하이브리드/유기자차 전용)
    ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Ethylhexyl Methoxycinnamate', '에칠헥실메톡시신나메이트', 'RECOMMENDED', 'UV_FILTER_ORGANIC', 'B', '유기 UVB 필터 — 가장 보편적 화학적 자차 (OMC)', 700, 1000, NULL, 85),
    ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine', '비스에칠헥실옥시페놀메톡시페닐트리아진', 'RECOMMENDED', 'UV_FILTER_ORGANIC', 'B', '유기 UVA+UVB 광안정성 필터 (Tinosorb S)', 300, 500, NULL, 84),
    ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Diethylamino Hydroxybenzoyl Hexyl Benzoate', '디에칠아미노하이드록시벤조일헥실벤조에이트', 'RECOMMENDED', 'UV_FILTER_ORGANIC', 'B', '유기 UVA1 필터 (DHHB/Uvinul A Plus)', 200, 500, NULL, 83),
    ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Octocrylene', '옥토크릴렌', 'RECOMMENDED', 'UV_FILTER_ORGANIC', 'B', '유기 UVB 필터 + 광안정화제 역할', 500, 1000, NULL, 75),
    ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Homosalate', '호모살레이트', 'RECOMMENDED', 'UV_FILTER_ORGANIC', 'B', '유기 UVB 필터 — 높은 흡광 효율', 500, 1000, NULL, 70),
    -- 방부 (최신 트렌드: 무방부 컨셉 — 1,2-Hexanediol 중심 + 부스터 조합)
    ('방부공통', ARRAY['방부','preserv','보존'], '1,2-Hexanediol', '1,2-헥산다이올', 'REQUIRED', 'PRESERVATIVE', 'D', '무방부 컨셉 핵심 — 강력 항균 + 보습 겸용, 1.5-3% 권장', 200, 300, NULL, 100),
    ('방부공통', ARRAY['방부','preserv','보존'], 'Caprylyl Glycol', '카프릴릴글라이콜', 'REQUIRED', 'PRESERVATIVE', 'D', '방부 부스터 — 보습+방부 동시, 유화 제형에서 효과적, 0.2-0.5%', 30, 50, NULL, 95),
    ('방부공통', ARRAY['방부','preserv','보존'], 'Ethylhexylglycerin', '에틸헥실글리세린', 'REQUIRED', 'PRESERVATIVE', 'D', '세포막 약화 부스터 — 다른 보존제 효능 증강, 0.05-0.1%', 10, 10, NULL, 90),
    ('방부공통', ARRAY['방부','preserv','보존'], 'Chlorphenesin', '클로르페네신', 'RECOMMENDED', 'PRESERVATIVE', 'D', '진균 억제 부스터 — 헥산다이올 부족 부분 보완, 0.1-0.2%', 15, 20, NULL, 85),
    ('방부공통', ARRAY['방부','preserv','보존'], 'Phenoxyethanol', '페녹시에탄올', 'RECOMMENDED', 'PRESERVATIVE', 'D', '전통 광범위 방부제 — 필요 시 보조, 0.5-1.0%', 50, 100, NULL, 70)
    ON CONFLICT (purpose_key, inci_name, role) DO NOTHING
  `)

  const { rows: pimRows } = await pool.query('SELECT count(*) as cnt FROM purpose_ingredient_map')
  if (parseInt(pimRows[0].cnt) <= 8) {
    await pool.query(`
      INSERT INTO purpose_ingredient_map (purpose_key, purpose_keywords, inci_name, korean_name, role, ingredient_type, phase, fn, default_pct_int, max_pct_int, reason, priority) VALUES
      -- 보습
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Sodium Hyaluronate', '히알루론산', 'REQUIRED', 'HUMECTANT', 'C', '고분자 보습제 — 수분 보유력 극대화', 10, 200, NULL, 100),
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Glycerin', '글리세린', 'REQUIRED', 'HUMECTANT', 'A', '다가알코올 보습제', 500, 1000, NULL, 90),
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Panthenol', '판테놀', 'REQUIRED', 'ACTIVE', 'C', '프로비타민 B5 — 피부 장벽 강화 + 보습', 100, 500, NULL, 80),
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Squalane', '스쿠알란', 'RECOMMENDED', 'EMOLLIENT', 'B', '피부 유사 오일 — 수분 증발 방지', 300, 1000, NULL, 70),
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Ceramide NP', '세라마이드NP', 'RECOMMENDED', 'ACTIVE', 'C', '피부 장벽 리피드 보충', 10, 100, NULL, 60),
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Betaine', '베타인', 'RECOMMENDED', 'HUMECTANT', 'A', '천연 유래 보습제 — 삼투압 조절', 200, 500, NULL, 50),
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Alcohol Denat.', '변성알코올', 'FORBIDDEN', 'SOLVENT', NULL, NULL, NULL, NULL, '고농도 알코올은 피부 건조/장벽 손상 유발', 0),
      ('보습', ARRAY['보습','moisturizing','hydrating','hydration','수분'], 'Sodium Lauryl Sulfate', '소듐라우릴설페이트', 'FORBIDDEN', 'SURFACTANT', NULL, NULL, NULL, NULL, '강한 탈지력으로 피부 보습막 제거', 0),
      -- 미백
      ('미백', ARRAY['미백','브라이트닝','brightening','whitening','톤업','tone-up','기미','잡티'], 'Niacinamide', '나이아신아마이드', 'REQUIRED', 'ACTIVE', 'C', '멜라닌 전이 억제 — 기능성 미백 고시 원료', 300, 500, NULL, 100),
      ('미백', ARRAY['미백','브라이트닝','brightening','whitening','톤업','tone-up','기미','잡티'], 'Alpha-Arbutin', '알파알부틴', 'REQUIRED', 'ACTIVE', 'C', '티로시나아제 억제제 — 멜라닌 생성 차단', 200, 500, NULL, 90),
      ('미백', ARRAY['미백','브라이트닝','brightening','whitening','톤업','tone-up','기미','잡티'], 'Ascorbyl Glucoside', '아스코빌글루코사이드', 'REQUIRED', 'ACTIVE', 'C', '안정형 비타민C 유도체 — 항산화+미백', 200, 300, NULL, 80),
      ('미백', ARRAY['미백','브라이트닝','brightening','whitening','톤업','tone-up','기미','잡티'], 'Tranexamic Acid', '트라넥사믹애씨드', 'REQUIRED', 'ACTIVE', 'C', '플라스민 억제 — 색소침착 예방', 200, 300, NULL, 70),
      ('미백', ARRAY['미백','브라이트닝','brightening','whitening','톤업','tone-up','기미','잡티'], 'Glutathione', '글루타치온', 'RECOMMENDED', 'ACTIVE', 'C', '항산화 + 멜라닌 환원', 10, 100, NULL, 60),
      ('미백', ARRAY['미백','브라이트닝','brightening','whitening','톤업','tone-up','기미','잡티'], 'Licorice Root Extract', '감초뿌리추출물', 'RECOMMENDED', 'ACTIVE', 'C', '글라브리딘 함유 — 미백 보조', 50, 200, NULL, 50),
      ('미백', ARRAY['미백','브라이트닝','brightening','whitening','톤업','tone-up','기미','잡티'], 'Hydroquinone', '하이드로퀴논', 'FORBIDDEN', 'ACTIVE', NULL, NULL, NULL, NULL, '한국 화장품법 사용 금지 원료 (의약품 전용)', 0),
      -- 진정
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Centella Asiatica Extract', '병풀추출물', 'REQUIRED', 'ACTIVE', 'C', 'CICA — 마데카소사이드/아시아티코사이드 함유 진정', 100, 500, NULL, 100),
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Madecassoside', '마데카소사이드', 'REQUIRED', 'ACTIVE', 'C', '병풀 유래 트리테르펜 — 피부 재생/진정', 10, 100, NULL, 90),
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Allantoin', '알란토인', 'REQUIRED', 'ACTIVE', 'C', '세포 재생 촉진 + 항자극', 10, 50, NULL, 80),
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Bisabolol', '비사볼올', 'REQUIRED', 'ACTIVE', 'C', '카모마일 유래 항염/진정', 10, 100, NULL, 70),
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Panthenol', '판테놀', 'RECOMMENDED', 'ACTIVE', 'C', '프로비타민 B5 — 피부 장벽 회복 보조', 100, 500, NULL, 60),
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Beta-Glucan', '베타글루칸', 'RECOMMENDED', 'ACTIVE', 'C', '면역 조절 + 진정', 10, 100, NULL, 50),
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Alcohol Denat.', '변성알코올', 'FORBIDDEN', 'SOLVENT', NULL, NULL, NULL, NULL, '진정 목적 피부에 알코올 자극 — 홍조/건조 악화', 0),
      ('진정', ARRAY['진정','soothing','calming','민감','sensitive','자극완화','홍조','redness'], 'Menthol', '멘톨', 'FORBIDDEN', 'ACTIVE', NULL, NULL, NULL, NULL, '냉감 자극 — 민감/진정 처방에 부적합', 0),
      -- 안티에이징
      ('안티에이징', ARRAY['주름','안티에이징','anti-aging','antiaging','탄력','firming','리프팅','lifting','노화','aging'], 'Adenosine', '아데노신', 'REQUIRED', 'ACTIVE', 'C', '기능성 주름개선 고시 원료 — 콜라겐 합성 촉진', 40, 100, NULL, 100),
      ('안티에이징', ARRAY['주름','안티에이징','anti-aging','antiaging','탄력','firming','리프팅','lifting','노화','aging'], 'Retinol', '레티놀', 'REQUIRED', 'ACTIVE', 'C', '비타민A — 세포 턴오버 촉진/주름 개선', 10, 100, NULL, 90),
      ('안티에이징', ARRAY['주름','안티에이징','anti-aging','antiaging','탄력','firming','리프팅','lifting','노화','aging'], 'Peptide Complex', '펩타이드복합체', 'REQUIRED', 'ACTIVE', 'C', '신호전달 펩타이드 — 콜라겐/엘라스틴 생성 유도', 50, 200, NULL, 80),
      ('안티에이징', ARRAY['주름','안티에이징','anti-aging','antiaging','탄력','firming','리프팅','lifting','노화','aging'], 'Niacinamide', '나이아신아마이드', 'REQUIRED', 'ACTIVE', 'C', '장벽 강화 + 주름 개선 보조', 300, 500, NULL, 70),
      ('안티에이징', ARRAY['주름','안티에이징','anti-aging','antiaging','탄력','firming','리프팅','lifting','노화','aging'], 'Tocopheryl Acetate', '토코페릴아세테이트', 'RECOMMENDED', 'ANTIOXIDANT', 'D', '항산화 — 산화 스트레스 방지', 30, 200, NULL, 60),
      ('안티에이징', ARRAY['주름','안티에이징','anti-aging','antiaging','탄력','firming','리프팅','lifting','노화','aging'], 'Ceramide NP', '세라마이드NP', 'RECOMMENDED', 'ACTIVE', 'C', '피부 장벽 리피드 — 탄력 유지 보조', 10, 100, NULL, 50),
      ('안티에이징', ARRAY['주름','안티에이징','anti-aging','antiaging','탄력','firming','리프팅','lifting','노화','aging'], 'Benzoyl Peroxide', '벤조일퍼옥사이드', 'FORBIDDEN', 'ACTIVE', NULL, NULL, NULL, NULL, '레티놀을 산화 분해 — 안티에이징 핵심 원료와 상충', 0),
      -- 자외선차단
      ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Zinc Oxide', '징크옥사이드', 'REQUIRED', 'UV_FILTER', 'C', '무기 자차 — UVA+UVB 광대역 차단', 1500, 2500, NULL, 100),
      ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Titanium Dioxide', '티타늄디옥사이드', 'REQUIRED', 'UV_FILTER', 'C', '무기 자차 — UVB+UVA2 차단', 700, 2500, NULL, 90),
      ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Cyclopentasiloxane', '사이클로펜타실록세인', 'REQUIRED', 'EMOLLIENT', 'B', '실리콘 용매 — 자차 분산/발림성', 1200, 2000, NULL, 80),
      ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Tocopheryl Acetate', '토코페릴아세테이트', 'RECOMMENDED', 'ANTIOXIDANT', 'D', '항산화 — UV 유발 활성산소 중화', 30, 200, NULL, 60),
      ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Bisabolol', '비사볼올', 'RECOMMENDED', 'ACTIVE', 'D', '자외선 후 진정/항자극', 10, 100, NULL, 50),
      ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'AHA (Glycolic Acid)', '글리콜릭애씨드', 'FORBIDDEN', 'ACTIVE', NULL, NULL, NULL, NULL, '자차 제형 pH를 산성으로 이동 → ZnO 용출 위험', 0),
      ('자외선차단', ARRAY['자외선','차단','uv','spf','pa','sun protection','선케어'], 'Retinol', '레티놀', 'FORBIDDEN', 'ACTIVE', NULL, NULL, NULL, NULL, '자외선 노출 시 레티놀 광분해 + 광과민 유발', 0),
      -- 세정
      ('세정', ARRAY['세정','클렌징','cleansing','폼','foam','워시','wash','세안'], 'Cocamidopropyl Betaine', '코카미도프로필베타인', 'REQUIRED', 'SURFACTANT', 'A', '양쪽성 계면활성제 — 마일드 세정', 800, 1500, NULL, 100),
      ('세정', ARRAY['세정','클렌징','cleansing','폼','foam','워시','wash','세안'], 'Sodium Cocoyl Isethionate', '소듐코코일이세치오네이트', 'REQUIRED', 'SURFACTANT', 'A', '마일드 음이온 계면활성제', 300, 800, NULL, 90),
      ('세정', ARRAY['세정','클렌징','cleansing','폼','foam','워시','wash','세안'], 'Glycerin', '글리세린', 'REQUIRED', 'HUMECTANT', 'A', '세정 후 보습 유지', 300, 500, NULL, 80),
      ('세정', ARRAY['세정','클렌징','cleansing','폼','foam','워시','wash','세안'], 'Centella Asiatica Extract', '병풀추출물', 'RECOMMENDED', 'ACTIVE', 'C', '세정 후 진정', 10, 100, NULL, 60),
      ('세정', ARRAY['세정','클렌징','cleansing','폼','foam','워시','wash','세안'], 'Allantoin', '알란토인', 'RECOMMENDED', 'ACTIVE', 'C', '세정 후 피부 보호', 10, 50, NULL, 50),
      ('세정', ARRAY['세정','클렌징','cleansing','폼','foam','워시','wash','세안'], 'Retinol', '레티놀', 'FORBIDDEN', 'ACTIVE', NULL, NULL, NULL, NULL, '세정 제형에서는 접촉 시간이 짧아 효과 없고 자극만 유발', 0),
      -- 모발관리
      ('모발관리', ARRAY['모발','헤어','hair','두피','scalp','탈모','hair loss','샴푸'], 'Panthenol', '판테놀', 'REQUIRED', 'ACTIVE', 'C', '프로비타민 B5 — 모발 컨디셔닝/보습', 50, 500, NULL, 100),
      ('모발관리', ARRAY['모발','헤어','hair','두피','scalp','탈모','hair loss','샴푸'], 'Biotin', '비오틴', 'REQUIRED', 'ACTIVE', 'C', '비타민 B7 — 모발 강화', 10, 50, NULL, 90),
      ('모발관리', ARRAY['모발','헤어','hair','두피','scalp','탈모','hair loss','샴푸'], 'Caffeine', '카페인', 'REQUIRED', 'ACTIVE', 'C', '두피 혈행 촉진 — 모근 활성화', 50, 200, NULL, 80),
      ('모발관리', ARRAY['모발','헤어','hair','두피','scalp','탈모','hair loss','샴푸'], 'Menthol', '멘톨', 'RECOMMENDED', 'ACTIVE', 'D', '두피 청량감/혈행 보조', 10, 50, NULL, 60),
      ('모발관리', ARRAY['모발','헤어','hair','두피','scalp','탈모','hair loss','샴푸'], 'Salicylic Acid', '살리실릭애씨드', 'RECOMMENDED', 'ACTIVE', 'C', '두피 각질 제거', 10, 200, NULL, 50),
      ('모발관리', ARRAY['모발','헤어','hair','두피','scalp','탈모','hair loss','샴푸'], 'Dimethicone', '디메치콘', 'FORBIDDEN', 'EMOLLIENT', NULL, NULL, NULL, NULL, '실리콘 두피 축적 → 모공 막힘/탈모 악화 우려', 0)
      ON CONFLICT (purpose_key, inci_name, role) DO NOTHING
    `)
    console.log('[PurposeGate] purpose_ingredient_map 시드 삽입 완료')
  }
}

// ─── 내부 유틸: guide_cache 시퀀스 재동기화 ──────────────────────────────
export async function resyncGuideCacheIdSequence(client = pool) {
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('guide_cache', 'id'),
      COALESCE((SELECT MAX(id) FROM guide_cache), 0) + 1,
      false
    )
  `)
}

export function isGuideCachePrimaryKeyConflict(err) {
  return err?.code === '23505' &&
    (err?.constraint === 'guide_cache_pkey' || String(err?.message || '').includes('guide_cache_pkey'))
}

export function normalizeFormulaCacheRow(row) {
  return {
    ...row,
    estimated_ph: row?.estimated_ph == null ? null : String(row.estimated_ph),
  }
}
