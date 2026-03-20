/**
 * test_all_formulas.js
 * 전체 제형 처방 생성 자동 검증 스크립트
 * 실행: node E:\MyLab-Studio\test_all_formulas.js
 */

const BASE_URL = 'http://localhost:3001'

const TEST_CASES = [
  // ── 스킨케어 ──
  { type: '수분크림',    req: '민감성',       check: ['Cetearyl', 'Glyceryl', 'Emulsifier', 'emulsifier', '유화제'] },
  { type: '로션',        req: '비건',         check: ['Cetearyl', 'Polysorbate', 'Glyceryl', '유화제'] },
  { type: '에센스',      req: '미백',         check: ['Niacinamide', 'Extract', 'Hyaluronate', 'Vitamin'] },
  { type: '세럼',        req: '안티에이징',   check: ['Peptide', 'Retinol', 'Adenosine', 'Niacinamide'] },
  { type: '토너',        req: '수분',         check: ['Glycerin', 'Butylene Glycol', 'Propanediol'] },
  { type: '아이크림',    req: '탄력',         check: ['Peptide', 'Caffeine', 'Cetearyl', '유화제'] },
  { type: '나이트크림',  req: '재생',         check: ['Shea', 'Retinol', 'Niacinamide', 'Cetearyl'] },
  // ── 선케어 ──
  { type: '선크림',      req: 'EWG그린',      check: ['Zinc Oxide', 'Titanium Dioxide'] },
  // ── 색조 ──
  { type: '립스틱',      req: '레드',         check: ['CI', 'Iron Oxide', 'Carmine', 'Mica'] },
  { type: '립글로스',    req: '핑크 고광택',  check: ['CI', 'Polybutene', 'Mica'] },
  { type: '립틴트',      req: '코랄',         check: ['CI', 'Glycerin'] },
  { type: '파운데이션',  req: '커버력',       check: ['Iron Oxide', 'Titanium Dioxide', 'CI'] },
  { type: 'BB크림',      req: '자연스러운',   check: ['Iron Oxide', 'Titanium Dioxide', 'CI'] },
  { type: '쿠션',        req: '촉촉한',       check: ['Iron Oxide', 'CI'] },
  { type: '블러셔',      req: '핑크',         check: ['CI', 'Mica'] },
  { type: '아이섀도우',  req: '골드펄',       check: ['Mica', 'CI'] },
  // ── 헤어 ──
  { type: '샴푸',        req: '비건',         check: ['Sodium Laureth', 'Cocamidopropyl', 'Betaine', 'Cocoyl'] },
  { type: '트리트먼트',  req: '손상모',       check: ['Behentrimonium', 'BTMS', 'Cetearyl'] },
  { type: '헤어오일',    req: '광택',         check: ['Dimethicone', 'Cyclopentasiloxane', 'Argan'] },
  // ── 클렌징 ──
  { type: '클렌징폼',    req: '민감성',       check: ['Cocoyl', 'Betaine', 'Cocamide', 'Amino'] },
  { type: '클렌징오일',  req: '메이크업제거', check: ['Caprylic', 'Triglyceride', 'Jojoba', 'PEG'] },
  // ── 바디 ──
  { type: '바디로션',    req: '보습',         check: ['Cetearyl', 'Glyceryl', 'Shea', '유화제'] },
  { type: '바디워시',    req: '저자극',       check: ['Cocamide', 'Betaine', 'Sodium Laureth'] },
]

// Aqua 비율 제한 (aqua_max 기준)
const AQUA_LIMITS = {
  '립스틱': 5, '립글로스': 5, '립틴트': 75, '립밤': 2,
  '파운데이션': 50, 'BB크림': 75, '쿠션': 65,
  '블러셔': 5, '아이섀도우': 5,
  '클렌징오일': 2, '헤어오일': 3,
}

async function generateFormula(type, req) {
  const body = JSON.stringify({ product_type: type, formula_name: `${type} 테스트`, requirements: req })
  const res = await fetch(`${BASE_URL}/api/formula/generate-idea`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'API error')
  return json.data
}

function checkAqua(ingredients, type) {
  const limit = AQUA_LIMITS[type]
  if (!limit) return true // 제한 없는 제형은 통과
  const aqua = ingredients.find(i =>
    (i.inci_name || '').toLowerCase() === 'aqua' || i.name === '정제수'
  )
  if (!aqua) return true
  return aqua.percentage <= limit
}

function checkRequired(ingredients, keywords) {
  const allText = ingredients.map(i =>
    `${i.inci_name || ''} ${i.name || ''} ${i.function || ''}`.toLowerCase()
  ).join(' ')
  return keywords.some(kw => allText.includes(kw.toLowerCase()))
}

async function runTests() {
  const startTime = Date.now()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  전체 제형 처방 생성 검증 테스트')
  console.log(`  대상: ${TEST_CASES.length}개 제형  |  ${new Date().toISOString()}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const results = []
  let pass = 0, fail = 0

  for (const tc of TEST_CASES) {
    try {
      const data = await generateFormula(tc.type, tc.req)
      const ingredients = data.ingredients || []
      const total = data.totalPercentage || 0

      const checks = {
        total_100: Math.abs(total - 100) < 0.1,
        has_required: checkRequired(ingredients, tc.check),
        aqua_ok: checkAqua(ingredients, tc.type),
        ai_enhanced: !!data.ai_enhanced,
      }

      const ok = checks.total_100 && checks.has_required && checks.aqua_ok
      if (ok) pass++; else fail++

      const icon = ok ? '✅' : '❌'
      const aiTag = checks.ai_enhanced ? '[AI]' : '[룰]'
      const issues = []
      if (!checks.total_100) issues.push(`합계${total}%`)
      if (!checks.has_required) issues.push(`필수원료 없음(${tc.check.slice(0, 2).join('/')})`)
      if (!checks.aqua_ok) issues.push(`Aqua초과`)

      const topIngredients = ingredients.slice(0, 4).map(i => `${i.inci_name}(${i.percentage}%)`).join(', ')
      console.log(`${icon} ${aiTag} ${tc.type.padEnd(10)} + ${tc.req.padEnd(12)} | ${total}% | ${topIngredients}`)
      if (issues.length) console.log(`   ⚠  ${issues.join(' / ')}`)

      results.push({ ...tc, ok, checks, total, count: ingredients.length })
    } catch (err) {
      fail++
      console.log(`❌ [ERR] ${tc.type.padEnd(10)} + ${tc.req.padEnd(12)} | ${err.message}`)
      results.push({ ...tc, ok: false, error: err.message })
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  결과: ✅ ${pass}/${TEST_CASES.length} 통과  ❌ ${fail}개 실패  (${elapsed}s)`)

  const failedCases = results.filter(r => !r.ok)
  if (failedCases.length > 0) {
    console.log('\n  [실패 케이스 상세]')
    for (const f of failedCases) {
      if (f.error) {
        console.log(`  - ${f.type}+${f.req}: API 오류 → ${f.error}`)
      } else {
        const issues = []
        if (!f.checks.total_100) issues.push(`합계 ${f.total}%`)
        if (!f.checks.has_required) issues.push(`필수원료 없음: ${f.check.join('|')}`)
        if (!f.checks.aqua_ok) issues.push('Aqua 비율 초과')
        console.log(`  - ${f.type}+${f.req}: ${issues.join(', ')}`)
      }
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  return { pass, fail, total: TEST_CASES.length }
}

runTests().catch(err => {
  console.error('테스트 실행 오류:', err.message)
  process.exit(1)
})
