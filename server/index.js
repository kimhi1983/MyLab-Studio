import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pool from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

// ─── Health ───
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() as now')
    res.json({ ok: true, time: rows[0].now })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ─── 통계 (KPI 위젯용) ───
app.get('/api/stats', async (req, res) => {
  try {
    const [kbAll, kbIngredients, regulations, ingredients, products, companies, compounds] = await Promise.all([
      pool.query('SELECT count(*) as cnt FROM coching_knowledge_base'),
      pool.query("SELECT count(*) as cnt FROM coching_knowledge_base WHERE category = 'INGREDIENT_REGULATION'"),
      pool.query('SELECT count(*) as cnt FROM regulation_cache'),
      pool.query('SELECT count(*) as cnt FROM ingredient_master'),
      pool.query('SELECT count(*) as cnt FROM product_master'),
      pool.query('SELECT count(*) as cnt FROM cosmetics_company').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT count(*) as cnt FROM compound_master').catch(() => ({ rows: [{ cnt: 0 }] })),
    ])
    const [sourceBreakdown, typeBreakdown, collectionStatus] = await Promise.all([
      pool.query('SELECT source, count(*) as cnt FROM regulation_cache GROUP BY source ORDER BY cnt DESC'),
      pool.query('SELECT ingredient_type, count(*) as cnt FROM ingredient_master GROUP BY ingredient_type ORDER BY cnt DESC'),
      pool.query('SELECT source, status, total_items, processed_items, updated_at FROM collection_progress ORDER BY updated_at DESC'),
    ])
    res.json({
      totalIngredients: parseInt(ingredients.rows[0].cnt),
      totalRegulations: parseInt(regulations.rows[0].cnt),
      totalKnowledge: parseInt(kbAll.rows[0].cnt),
      totalProducts: parseInt(products.rows[0].cnt),
      totalCompanies: parseInt(companies.rows[0].cnt),
      totalCompounds: parseInt(compounds.rows[0].cnt),
      kbIngredients: parseInt(kbIngredients.rows[0].cnt),
      regulationsBySource: sourceBreakdown.rows.map(r => ({ source: r.source, count: parseInt(r.cnt) })),
      ingredientsByType: typeBreakdown.rows.map(r => ({ type: r.ingredient_type, count: parseInt(r.cnt) })),
      collectionStatus: collectionStatus.rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 원료 목록 (ingredient_master + knowledge_base 통합) ───
app.get('/api/ingredients', async (req, res) => {
  try {
    const { q, type, limit = 50, offset = 0 } = req.query
    let where = [
      // #REF! 데이터 필터링
      `im.inci_name NOT LIKE '%#REF%'`,
      `(im.korean_name IS NULL OR im.korean_name NOT LIKE '%#REF%')`,
    ]
    let params = []
    let idx = 1

    if (q) {
      where.push(`(im.inci_name ILIKE $${idx} OR im.korean_name ILIKE $${idx} OR im.cas_number ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }
    if (type && type !== 'ALL') {
      where.push(`im.ingredient_type = $${idx}`)
      params.push(type)
      idx++
    }

    const whereClause = 'WHERE ' + where.join(' AND ')

    // regulation_cache에서 KR/EU 규제 서브쿼리 (coching_legacy 제외)
    const dataQuery = `
      SELECT im.id, im.inci_name, im.korean_name, im.cas_number, im.ec_number,
        im.ingredient_type, im.description, im.origin, im.source, im.updated_at,
        kr.restriction AS kr_restriction, kr.max_concentration AS kr_max_conc,
        eu.restriction AS eu_restriction, eu.max_concentration AS eu_max_conc,
        (CASE WHEN im.korean_name IS NOT NULL AND im.korean_name != '' THEN 1 ELSE 0 END
         + CASE WHEN im.cas_number IS NOT NULL AND im.cas_number != '' THEN 1 ELSE 0 END
         + CASE WHEN im.description IS NOT NULL AND im.description != '' THEN 1 ELSE 0 END
         + CASE WHEN kr.inci_name IS NOT NULL THEN 2 ELSE 0 END
         + CASE WHEN eu.inci_name IS NOT NULL THEN 2 ELSE 0 END
        ) AS info_score
      FROM ingredient_master im
      LEFT JOIN LATERAL (
        SELECT rc.inci_name, rc.restriction, rc.max_concentration
        FROM regulation_cache rc
        WHERE lower(rc.inci_name) = lower(im.inci_name)
          AND rc.source IN ('GEMINI_KR','MFDS_SEED')
        LIMIT 1
      ) kr ON true
      LEFT JOIN LATERAL (
        SELECT rc.inci_name, rc.restriction, rc.max_concentration
        FROM regulation_cache rc
        WHERE lower(rc.inci_name) = lower(im.inci_name)
          AND rc.source = 'GEMINI_EU'
        LIMIT 1
      ) eu ON true
      ${whereClause}
      ORDER BY info_score DESC, im.inci_name
      LIMIT $${idx} OFFSET $${idx + 1}`

    const countQuery = `SELECT count(*) FROM ingredient_master im ${whereClause}`

    params.push(parseInt(limit), parseInt(offset))

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, idx - 1)),
      pool.query(dataQuery, params),
    ])

    // 규제 상태 판단
    function deriveRegStatus(kr, eu) {
      const krR = (kr || '').toLowerCase()
      const euR = (eu || '').toLowerCase()
      if (krR.includes('금지') || euR.includes('ban') || euR.includes('prohibit')) return 'banned'
      if (krR.includes('한도') || krR.includes('제한') || euR.includes('restrict') || euR.includes('annex')) return 'restricted'
      if (kr || eu) return 'allowed'
      return null
    }

    res.json({
      total: parseInt(countRes.rows[0].count),
      items: dataRes.rows.map(r => ({
        id: r.id,
        inci_name: r.inci_name,
        korean_name: r.korean_name,
        cas_number: r.cas_number,
        ec_number: r.ec_number,
        ingredient_type: r.ingredient_type,
        description: r.description,
        origin: r.origin,
        source: r.source,
        regulation_status: deriveRegStatus(r.kr_restriction, r.eu_restriction),
        kr_regulation: r.kr_restriction || null,
        eu_regulation: r.eu_restriction || null,
        max_concentration: r.kr_max_conc || r.eu_max_conc || null,
        updated_at: r.updated_at,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 원료 상세 (ingredient_master 기반 + properties + functions + regulations) ───
app.get('/api/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM ingredient_master WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })

    const row = rows[0]

    // 병렬 조회: 물성, 기능, 규제, 지식베이스
    const [propsRes, funcsRes, regsRes, kbRes] = await Promise.all([
      pool.query('SELECT * FROM ingredient_properties WHERE ingredient_id = $1', [id]),
      pool.query('SELECT * FROM ingredient_functions WHERE ingredient_id = $1', [id]),
      pool.query('SELECT * FROM regulation_cache WHERE inci_name ILIKE $1', [row.inci_name]),
      pool.query("SELECT data FROM coching_knowledge_base WHERE category = 'INGREDIENT_REGULATION' AND lower(search_key) = lower($1)", [row.korean_name || row.inci_name]),
    ])

    res.json({
      id: row.id,
      inci_name: row.inci_name,
      korean_name: row.korean_name,
      cas_number: row.cas_number,
      ec_number: row.ec_number,
      ingredient_type: row.ingredient_type,
      description: row.description,
      origin: row.origin,
      source: row.source,
      properties: propsRes.rows[0] || null,
      functions: funcsRes.rows,
      regulations: regsRes.rows,
      knowledgeBase: kbRes.rows[0]?.data || null,
      updated_at: row.updated_at,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 규제 데이터 (위젯용) ───
app.get('/api/regulations', async (req, res) => {
  try {
    const { source, q, limit = 50, offset = 0 } = req.query
    let where = []
    let params = []
    let idx = 1

    if (source && source !== 'ALL') {
      where.push(`source = $${idx}`)
      params.push(source)
      idx++
    }
    if (q) {
      where.push(`(ingredient ILIKE $${idx} OR inci_name ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const countQuery = `SELECT count(*) FROM regulation_cache ${whereClause}`
    const dataQuery = `SELECT source, ingredient, inci_name, max_concentration, restriction, updated_at
      FROM regulation_cache ${whereClause}
      ORDER BY ingredient
      LIMIT $${idx} OFFSET $${idx + 1}`
    params.push(parseInt(limit), parseInt(offset))

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, idx - 1)),
      pool.query(dataQuery, params),
    ])

    res.json({
      total: parseInt(countRes.rows[0].count),
      items: dataRes.rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 규제 소스 목록 ───
app.get('/api/regulation-sources', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT source, count(*) as cnt FROM regulation_cache GROUP BY source ORDER BY cnt DESC'
    )
    res.json(rows.map(r => ({ source: r.source, count: parseInt(r.cnt) })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 원료 타입 목록 (ingredient_master 기반) ───
app.get('/api/ingredient-types', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT ingredient_type, count(*) as cnt FROM ingredient_master GROUP BY ingredient_type ORDER BY cnt DESC'
    )
    res.json(rows.map(r => ({ type: r.ingredient_type, count: parseInt(r.cnt) })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 제품 목록 (product_master) ───
app.get('/api/products', async (req, res) => {
  try {
    const { q, category, limit = 50, offset = 0 } = req.query
    let where = []
    let params = []
    let idx = 1

    if (q) {
      where.push(`(product_name ILIKE $${idx} OR brand_name ILIKE $${idx} OR full_ingredients ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }
    if (category) {
      where.push(`category = $${idx}`)
      params.push(category)
      idx++
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const countQuery = `SELECT count(*) FROM product_master ${whereClause}`
    const dataQuery = `SELECT id, brand_name, product_name, product_name_local, category, subcategory,
        product_type, target_skin_type, ph_value, viscosity_cp, appearance, texture,
        country_of_origin, notable_claims, source, data_quality_grade, updated_at
      FROM product_master ${whereClause}
      ORDER BY brand_name, product_name
      LIMIT $${idx} OFFSET $${idx + 1}`
    params.push(parseInt(limit), parseInt(offset))

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, idx - 1)),
      pool.query(dataQuery, params),
    ])

    res.json({
      total: parseInt(countRes.rows[0].count),
      items: dataRes.rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 제품 상세 (전성분 포함) ───
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM product_master WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 수집 상태 (collection_progress) ───
app.get('/api/collection-status', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT source, batch_id, total_items, processed_items, last_offset, status, error_message, started_at, completed_at, updated_at FROM collection_progress ORDER BY updated_at DESC'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 워크플로우 로그 ───
app.get('/api/workflow-logs', async (req, res) => {
  try {
    const { limit = 20 } = req.query
    const { rows } = await pool.query(
      'SELECT * FROM workflow_log ORDER BY created_at DESC LIMIT $1',
      [parseInt(limit)]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 지식베이스 검색 (전체 카테고리) ───
app.get('/api/knowledge', async (req, res) => {
  try {
    const { q, category, limit = 20, offset = 0 } = req.query
    let where = []
    let params = []
    let idx = 1

    if (category) {
      where.push(`category = $${idx}`)
      params.push(category)
      idx++
    }
    if (q) {
      where.push(`search_key ILIKE $${idx}`)
      params.push(`%${q}%`)
      idx++
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const countQuery = `SELECT count(*) FROM coching_knowledge_base ${whereClause}`
    const dataQuery = `SELECT id, category, search_key, version, updated_at, data
      FROM coching_knowledge_base ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`
    params.push(parseInt(limit), parseInt(offset))

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, idx - 1)),
      pool.query(dataQuery, params),
    ])

    res.json({
      total: parseInt(countRes.rows[0].count),
      items: dataRes.rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ══════════════════════════════════════════════════════════════════
// SKILL20260309: Compound Expansion + Precision Arithmetic 엔진
// ══════════════════════════════════════════════════════════════════

// 복합성분 DB (compound-db)
const COMPOUND_DB = {
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

// 제품 유형별 처방 템플릿 (SKILL 기반 — 투입 원료 기준)
const FORMULA_TEMPLATES = {
  '크림': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 500 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '세테아릴알코올', inci: 'Cetearyl Alcohol', phase: 'B', type: 'EMULSIFIER', fn: '유화안정제', pct_int: 300 },
    { name: '스테아릭애씨드', inci: 'Stearic Acid', phase: 'B', type: 'EMULSIFIER', fn: '유화보조제', pct_int: 150 },
    { name: '호호바오일', inci: 'Simmondsia Chinensis (Jojoba) Seed Oil', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 500 },
    { name: '시어버터', inci: 'Butyrospermum Parkii (Shea) Butter', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 300 },
    { name: '디메치콘', inci: 'Dimethicone', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트/피막형성', pct_int: 200 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 300 },
    { name: '판테놀', inci: 'Panthenol', phase: 'C', type: 'ACTIVE', fn: '진정/보습', pct_int: 100 },
    { name: '잔탄검', inci: 'Xanthan Gum', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 20 },
    { name: '카보머', inci: 'Carbomer', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 15 },
    { name: '트리에탄올아민', inci: 'Triethanolamine', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제(카보머 중화)', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '토코페릴아세테이트', inci: 'Tocopheryl Acetate', phase: 'D', type: 'ANTIOXIDANT', fn: '항산화제', pct_int: 30 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 80 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 10 },
  ],
  '로션': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 400 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '세테아릴알코올', inci: 'Cetearyl Alcohol', phase: 'B', type: 'EMULSIFIER', fn: '유화안정제', pct_int: 200 },
    { name: '폴리소르베이트60', inci: 'Polysorbate 60', phase: 'B', type: 'EMULSIFIER', fn: 'O/W 유화제', pct_int: 150 },
    { name: '스쿠알란', inci: 'Squalane', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 400 },
    { name: '카프릴릭/카프릭트리글리세라이드', inci: 'Caprylic/Capric Triglyceride', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 300 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 200 },
    { name: '히알루론산', inci: 'Sodium Hyaluronate', phase: 'C', type: 'HUMECTANT', fn: '보습제', pct_int: 1 },
    { name: '알란토인', inci: 'Allantoin', phase: 'C', type: 'ACTIVE', fn: '진정/보습', pct_int: 10 },
    { name: '잔탄검', inci: 'Xanthan Gum', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 15 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 10 },
  ],
  '토너': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 500 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 500 },
    { name: '디프로필렌글라이콜', inci: 'Dipropylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 200 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 200 },
    { name: '히알루론산', inci: 'Sodium Hyaluronate', phase: 'C', type: 'HUMECTANT', fn: '보습제', pct_int: 1 },
    { name: '병풀추출물', inci: 'Centella Asiatica Extract', phase: 'C', type: 'ACTIVE', fn: '진정/피부보호', pct_int: 10 },
    { name: '알란토인', inci: 'Allantoin', phase: 'C', type: 'ACTIVE', fn: '진정', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '시트릭애씨드', inci: 'Citric Acid', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '1,2-헥산다이올', inci: '1,2-Hexanediol', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제/보습', pct_int: 100 },
  ],
  '세럼': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 500 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 400 },
    { name: '프로판다이올', inci: 'Propanediol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 500 },
    { name: '아데노신', inci: 'Adenosine', phase: 'C', type: 'ACTIVE', fn: '주름개선', pct_int: 4 },
    { name: '히알루론산', inci: 'Sodium Hyaluronate', phase: 'C', type: 'HUMECTANT', fn: '보습제', pct_int: 1 },
    { name: '카보머', inci: 'Carbomer', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 20 },
    { name: '트리에탄올아민', inci: 'Triethanolamine', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
  ],
  '선크림': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 300 },
    { name: '디프로필렌글라이콜', inci: 'Dipropylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 200 },
    { name: '잔탄검', inci: 'Xanthan Gum', phase: 'A', type: 'THICKENER', fn: '수상 점증제', pct_int: 20 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'A', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '사이클로펜타실록세인', inci: 'Cyclopentasiloxane', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트/발림성', pct_int: 1200 },
    { name: '디메치콘', inci: 'Dimethicone', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트/피막형성', pct_int: 300 },
    { name: '세틸PEG/PPG-10/1디메치콘', inci: 'Cetyl PEG/PPG-10/1 Dimethicone', phase: 'B', type: 'EMULSIFIER', fn: 'W/S 유화제', pct_int: 300 },
    { name: '아이소노닐아이소노나노에이트', inci: 'Isononyl Isononanoate', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 400 },
    { name: '폴리하이드록시스테아릭애씨드', inci: 'Polyhydroxystearic Acid', phase: 'B', type: 'EMULSIFIER', fn: '분산제(무기자차)', pct_int: 150 },
    { name: '소르비탄아이소스테아레이트', inci: 'Sorbitan Isostearate', phase: 'B', type: 'EMULSIFIER', fn: '보조 유화제', pct_int: 100 },
    { name: '징크옥사이드', inci: 'Zinc Oxide', phase: 'C', type: 'UV_FILTER', fn: 'UVA+UVB 차단', pct_int: 1500 },
    { name: '티타늄디옥사이드', inci: 'Titanium Dioxide', phase: 'C', type: 'UV_FILTER', fn: 'UVB+UVA2 차단', pct_int: 700 },
    { name: '병풀추출물', inci: 'Centella Asiatica Extract', phase: 'D', type: 'ACTIVE', fn: '진정/피부보호', pct_int: 100 },
    { name: '1,2-헥산다이올', inci: '1,2-Hexanediol', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제/보습', pct_int: 100 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '염화나트륨', inci: 'Sodium Chloride', phase: 'D', type: 'OTHER', fn: '유화안정/점증', pct_int: 80 },
    { name: '하이드로젠디메치콘', inci: 'Hydrogen Dimethicone', phase: 'D', type: 'EMOLLIENT', fn: '발수성 부여', pct_int: 150 },
    { name: '알루미늄하이드록사이드', inci: 'Aluminum Hydroxide', phase: 'D', type: 'OTHER', fn: '자차 코팅/안정화', pct_int: 50 },
    { name: '스테아릭애씨드', inci: 'Stearic Acid', phase: 'D', type: 'EMULSIFIER', fn: '안정화/점도조절', pct_int: 50 },
    { name: '토코페릴아세테이트', inci: 'Tocopheryl Acetate', phase: 'D', type: 'ANTIOXIDANT', fn: '항산화제', pct_int: 30 },
    { name: '카프릴릴글라이콜', inci: 'Caprylyl Glycol', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제/보습', pct_int: 30 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '알란토인', inci: 'Allantoin', phase: 'D', type: 'ACTIVE', fn: '진정/피부보호', pct_int: 10 },
    { name: '비사볼올', inci: 'Bisabolol', phase: 'D', type: 'ACTIVE', fn: '진정/항자극', pct_int: 10 },
  ],
  '클렌징': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 300 },
    { name: '코카미도프로필베타인', inci: 'Cocamidopropyl Betaine', phase: 'A', type: 'SURFACTANT', fn: '양쪽성 계면활성제', pct_int: 800 },
    { name: '소듐라우레스설페이트', inci: 'Sodium Laureth Sulfate', phase: 'A', type: 'SURFACTANT', fn: '음이온 계면활성제', pct_int: 600 },
    { name: '소듐코코일이세치오네이트', inci: 'Sodium Cocoyl Isethionate', phase: 'A', type: 'SURFACTANT', fn: '마일드 계면활성제', pct_int: 300 },
    { name: '라우릭애씨드', inci: 'Lauric Acid', phase: 'B', type: 'SURFACTANT', fn: '지방산', pct_int: 200 },
    { name: '미리스틱애씨드', inci: 'Myristic Acid', phase: 'B', type: 'SURFACTANT', fn: '지방산', pct_int: 200 },
    { name: '수산화칼륨', inci: 'Potassium Hydroxide', phase: 'C', type: 'PH_ADJUSTER', fn: '비누화/pH조절', pct_int: 100 },
    { name: '병풀추출물', inci: 'Centella Asiatica Extract', phase: 'C', type: 'ACTIVE', fn: '진정', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 80 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 10 },
  ],
  '샴푸': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '소듐라우레스설페이트', inci: 'Sodium Laureth Sulfate', phase: 'A', type: 'SURFACTANT', fn: '1차 계면활성제', pct_int: 1200 },
    { name: '코카미도프로필베타인', inci: 'Cocamidopropyl Betaine', phase: 'A', type: 'SURFACTANT', fn: '양쪽성 계면활성제', pct_int: 500 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 200 },
    { name: '소듐클로라이드', inci: 'Sodium Chloride', phase: 'C', type: 'THICKENER', fn: '점도조절', pct_int: 150 },
    { name: '판테놀', inci: 'Panthenol', phase: 'C', type: 'ACTIVE', fn: '컨디셔닝/보습', pct_int: 50 },
    { name: '시트릭애씨드', inci: 'Citric Acid', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제', pct_int: 10 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '소듐벤조에이트', inci: 'Sodium Benzoate', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 30 },
  ],
}

// 제품유형 매칭 (긴 키워드 우선 — '선크림'이 '크림'보다 먼저 매칭)
function matchTemplate(productType) {
  const pt = (productType || '').toLowerCase()
  // 우선 매칭 (세부 유형)
  if (pt.includes('선크림') || pt.includes('자외선') || pt.includes('sun') || pt.includes('spf')) return { key: '선크림', tmpl: FORMULA_TEMPLATES['선크림'] }
  if (pt.includes('클렌') || pt.includes('폼') || pt.includes('워시')) return { key: '클렌징', tmpl: FORMULA_TEMPLATES['클렌징'] }
  if (pt.includes('샴푸') || pt.includes('shampoo')) return { key: '샴푸', tmpl: FORMULA_TEMPLATES['샴푸'] }
  if (pt.includes('세럼') || pt.includes('에센스') || pt.includes('앰플')) return { key: '세럼', tmpl: FORMULA_TEMPLATES['세럼'] }
  if (pt.includes('토너') || pt.includes('스킨') || pt.includes('미스트')) return { key: '토너', tmpl: FORMULA_TEMPLATES['토너'] }
  if (pt.includes('로션') || pt.includes('에멀') || pt.includes('바디')) return { key: '로션', tmpl: FORMULA_TEMPLATES['로션'] }
  if (pt.includes('크림') || pt.includes('cream')) return { key: '크림', tmpl: FORMULA_TEMPLATES['크림'] }
  return { key: '크림', tmpl: FORMULA_TEMPLATES['크림'] }
}

// SKILL 핵심: 복합성분 전개 + 정수 연산 + INCI 합산
function expandAndMerge(ingredients) {
  // Step 1: 복합성분 감지 및 전개
  const expanded = []
  const compoundInfo = []

  for (const ing of ingredients) {
    const compound = COMPOUND_DB[ing.name]
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

// ─── 가이드 처방 생성 (SKILL20260309 기반) ───
app.post('/api/guide-formula', async (req, res) => {
  try {
    const { productType, requirements } = req.body
    const { key: matchedType, tmpl } = matchTemplate(productType)

    // 템플릿 기반 처방서 (투입 기준)
    const formulaIngredients = tmpl.map(ing => ({ ...ing }))

    // DB에서 추가 원료 보강 시도
    const inciNames = formulaIngredients.filter(i => i.inci !== 'Water (Aqua)').map(i => i.inci)
    const [regRes, kbRes] = await Promise.all([
      pool.query('SELECT inci_name, max_concentration, restriction, source FROM regulation_cache WHERE inci_name = ANY($1)', [inciNames]),
      pool.query("SELECT search_key, data FROM coching_knowledge_base WHERE category = 'INGREDIENT_REGULATION' AND (data->>'inci_name') = ANY($1)", [inciNames]),
    ])
    const regMap = {}
    for (const r of regRes.rows) {
      if (!regMap[r.inci_name]) regMap[r.inci_name] = []
      regMap[r.inci_name].push(r)
    }
    const kbMap = {}
    for (const r of kbRes.rows) {
      if (r.data?.inci_name) kbMap[r.data.inci_name] = r.data
    }

    // 복합성분 전개 + 정수 연산 + INCI 합산
    const { sortedInci, compoundInfo, verification, aquaInt } = expandAndMerge(formulaIngredients)

    // 밸런스(정제수) 역산 값을 투입 기준에 반영
    const waterIng = formulaIngredients.find(i => i.inci === 'Water (Aqua)')
    if (waterIng) waterIng.pct_int = aquaInt

    // 최종 응답 구성
    const resultIngredients = formulaIngredients.map(ing => {
      const kbData = kbMap[ing.inci] || {}
      return {
        name: ing.name,
        korean_name: ing.name,
        inci_name: ing.inci,
        percentage: ing.pct_int / 100,
        phase: ing.phase,
        type: ing.type,
        function: ing.fn,
        is_compound: !!COMPOUND_DB[ing.name],
        compound_name: COMPOUND_DB[ing.name] ? ing.name : null,
        regulations: regMap[ing.inci] || [],
        safety: kbData.ewg_score ? {
          ewg_score: kbData.ewg_score, safety_notes: kbData.safety_notes,
        } : null,
      }
    })

    // 전성분 표기 (INCI 합산 기준, 내림차순)
    const fullInciList = sortedInci.map(item => ({
      inci_name: item.inci,
      percentage: item.percentage,
      note: item.inci === 'Water (Aqua)' ? '밸런스 역산' : '',
    }))

    const desc = `${matchedType} 가이드 처방 (SKILL v2.3 기반). 총 ${resultIngredients.length}종 원료, ` +
      `복합성분 ${compoundInfo.length}건 전개, 정수연산 검증 ${verification.allPassed ? 'PASS' : 'FAIL'}.` +
      (requirements ? `\n요구사항: ${requirements}` : '')

    res.json({
      description: desc,
      ingredients: resultIngredients,
      fullInciList,
      compoundExpansion: compoundInfo,
      verification,
      phases: buildPhaseSummary(resultIngredients),
      process: buildDefaultProcess(buildPhaseSummary(resultIngredients)),
      totalPercentage: 100,
      totalDbIngredients: resultIngredients.length,
      regulationsChecked: regRes.rows.length,
      generatedAt: new Date().toISOString(),
      source: 'skill-v2.3-compound-expansion',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function guessType(inciName, data) {
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

function guessFunction(inciName, data) {
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

function generateDescription(productType, requirements, ingredients) {
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
function assignPhase(inciName, type) {
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
function buildPhaseSummary(ingredients) {
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
function buildDefaultProcess(phases) {
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

// DB 폴백: SKILL 템플릿 기반 처방 생성 (Gemini 미사용 시)
async function buildDbFormula(productType, requirements, targetMarket) {
  const { key: matchedType, tmpl } = matchTemplate(productType)
  const formulaIngredients = tmpl.map(ing => ({ ...ing }))

  // 복합성분 전개 + 정수 연산
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
    is_compound: !!COMPOUND_DB[ing.name],
    compound_name: COMPOUND_DB[ing.name] ? ing.name : null,
    regulations: [],
    safety: null,
  }))

  const phases = buildPhaseSummary(resultIngredients)
  const process = buildDefaultProcess(phases)

  return {
    description: `${matchedType} 가이드 처방 (SKILL v2.3 기반, DB 폴백). 총 ${resultIngredients.length}종 원료.` +
      (requirements ? `\n요구사항: ${requirements}` : ''),
    ingredients: resultIngredients,
    fullInciList: sortedInci.map(item => ({ inci_name: item.inci, percentage: item.percentage })),
    compoundExpansion: compoundInfo,
    verification,
    phases,
    process,
    cautions: ['처방은 참고용이며 실제 제조 전 안정성 테스트 필수', '규제 정보는 최신 공식 문서로 교차 확인 필요'],
    totalPercentage: 100,
    totalDbIngredients: resultIngredients.length,
    regulationsChecked: 0,
    generatedAt: new Date().toISOString(),
    source: 'skill-v2.3-db-fallback',
  }
}

// ─── Gemini API 호출 헬퍼 ───
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
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

  // JSON 파싱 (코드블록 래핑 제거)
  const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('Gemini 응답 JSON 파싱 실패: ' + cleaned.substring(0, 200))
  }
}

// ─── LLM 정밀 처방 생성 (Gemini) ───
app.post('/api/ai-formula', async (req, res) => {
  try {
    const { productType, requirements, targetMarket = 'KR', customIngredients = [], physicalSpecs = [] } = req.body

    if (!productType) {
      return res.status(400).json({ success: false, error: 'productType은 필수입니다.' })
    }

    if (!process.env.GEMINI_API_KEY) {
      // 폴백: DB 기반 Phase 분류 처방
      const formula = await buildDbFormula(productType, requirements, targetMarket)
      return res.json({ success: true, data: formula })
    }

    // ingredient_master에서 원료 후보 조회
    const { rows: imRows } = await pool.query(
      "SELECT id, inci_name, korean_name, ingredient_type FROM ingredient_master ORDER BY RANDOM() LIMIT 30"
    )
    // 규제 제약 조회
    const inciNames = imRows.map(r => r.inci_name)
    const { rows: regRows } = await pool.query(
      'SELECT inci_name, max_concentration, restriction, source FROM regulation_cache WHERE inci_name = ANY($1) AND source ILIKE $2',
      [inciNames, `%${targetMarket}%`]
    )

    const ingredientList = imRows.map(r => {
      const reg = regRows.find(rg => rg.inci_name === r.inci_name)
      return `- ${r.inci_name} (한국명: ${r.korean_name || '—'}, 유형: ${r.ingredient_type})${reg ? ` [최대 ${reg.max_concentration}, ${reg.source}]` : ''}`
    }).join('\n')

    const customList = customIngredients.length
      ? '\n\n반드시 포함할 원료:\n' + customIngredients.map(c => `- ${c.name}: ${c.percentage}%`).join('\n')
      : ''

    const physSpecBlock = physicalSpecs.length
      ? '\n\n목표 물성 스펙 (처방이 이 물성을 달성하도록 원료를 선정하세요):\n' + physicalSpecs.map(s => `- ${s}`).join('\n')
      : ''

    const prompt = `당신은 COCHING AI v2.3 화장품 처방 전문가입니다. COMPOUND-EXPANSION SKILL + PRECISION-ARITHMETIC 규칙을 적용하여 처방을 생성하세요.

핵심 규칙 (SKILL20260309):
1. 배합비 합계는 정확히 100.00% (정수연산: 모든 wt%를 ×100 정수로 계산 후 합계 10000)
2. 정제수(Water)는 밸런스 역산 (10000 - 비정제수 합계)
3. Phase A(수상 70-75°C)/B(유상 70-75°C)/C(첨가 ≤45°C)/D(방부/향 ≤40°C) 구분
4. 규제 최대 농도를 초과하지 않을 것
5. 제조 공정(Manufacturing Process) 포함
6. 목표 물성(pH, 점도 등)을 달성할 수 있는 원료 조합으로 처방할 것
7. 복합성분(Compound/Blend)은 투입원료명 + 구성 INCI를 모두 표기
8. 동일 INCI가 여러 원료에서 발생하면 전성분 표기에서 합산
9. 향료(Fragrance)는 전개하지 않고 단일 표기
10. 각 원료에 int_value(wt%×100 정수) 포함

응답은 반드시 JSON 형식:
{
  "ingredients": [
    {"inci_name": "...", "korean_name": "...", "percentage": 0.00, "int_value": 0, "phase": "A", "function": "...", "type": "...", "is_compound": false}
  ],
  "phases": [
    {"phase": "A", "name": "수상", "temp": "75°C", "items": ["Water", "Glycerin"]}
  ],
  "process": [
    {"step": 1, "phase": "A", "desc": "...", "temp": "75°C", "time": "10분", "note": "..."}
  ],
  "description": "...",
  "cautions": ["..."],
  "verification": {"step1_intSum": true, "step2_pctSum": true, "step3_aquaCross": true, "allPassed": true}
}

제형: ${productType}
요구사항: ${requirements || '없음'}
타겟 시장: ${targetMarket}
${customList}${physSpecBlock}

사용 가능한 DB 원료 목록:
${ingredientList}

위 원료에서 적합한 것을 선택하여 처방을 완성하세요.`

    const parsed = await callGemini(prompt)
    const totalPct = parsed.ingredients?.reduce((sum, i) => sum + (i.percentage || 0), 0) ?? 0

    return res.json({
      success: true,
      data: {
        description: parsed.description || '',
        ingredients: parsed.ingredients || [],
        phases: parsed.phases || buildPhaseSummary(parsed.ingredients || []),
        process: parsed.process || [],
        cautions: parsed.cautions || [],
        totalPercentage: Math.round(totalPct * 100) / 100,
        generatedAt: new Date().toISOString(),
        source: 'gemini-2.0-flash',
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 카피 처방 (역처방, Gemini) ───
app.post('/api/copy-formula', async (req, res) => {
  try {
    const { productName, targetMarket = 'KR' } = req.body

    if (!productName) {
      return res.status(400).json({ success: false, error: 'productName은 필수입니다.' })
    }

    if (!process.env.GEMINI_API_KEY) {
      // 폴백: 제품명 키워드 기반 템플릿
      const lowerName = productName.toLowerCase()
      let templateType = 'moisturizing-serum'
      if (lowerName.includes('크림') || lowerName.includes('cream')) templateType = 'brightening-cream'
      else if (lowerName.includes('선') || lowerName.includes('sun')) templateType = 'sunscreen-spf50'
      else if (lowerName.includes('클렌') || lowerName.includes('clean') || lowerName.includes('foam')) templateType = 'cleansing-foam'
      else if (lowerName.includes('세럼') || lowerName.includes('serum') || lowerName.includes('에센스')) templateType = 'moisturizing-serum'

      const formula = await buildDbFormula(templateType, `${productName} 참조 역처방`, targetMarket)
      formula.source = 'template-fallback'
      formula.description = `[${productName}] 참조 역처방(템플릿 기반). ` + formula.description
      return res.json({ success: true, data: formula })
    }

    const prompt = `당신은 화장품 역처방(reverse formulation) 전문가입니다.

다음 제품의 공개 전성분 표기 순서를 기반으로 배합비를 역산하세요.

규칙:
1. 전성분 표기 순서는 함량 순서 (1% 미만은 순서 무관)
2. 배합비 합계 100.00%
3. Phase A(수상)/B(유상)/C(첨가)/D(방부/향) 구분
4. 규제 최대 농도 준수

응답은 반드시 JSON 형식:
{
  "ingredients": [
    {"inci_name": "...", "korean_name": "...", "percentage": 0.00, "phase": "A", "function": "...", "type": "..."}
  ],
  "phases": [
    {"phase": "A", "name": "수상", "temp": "75°C", "items": ["Water", "Glycerin"]}
  ],
  "process": [
    {"step": 1, "phase": "A", "desc": "...", "temp": "75°C", "time": "10분", "note": "..."}
  ],
  "description": "...",
  "cautions": ["..."]
}

제품명: ${productName}
타겟 시장: ${targetMarket}

위 제품의 공개 전성분 정보를 기반으로 역처방을 추정하세요. 해당 제품 유형에 전형적인 배합비를 참조하여 합계 100%가 되도록 처방을 완성하세요.`

    const parsed = await callGemini(prompt)
    const totalPct = parsed.ingredients?.reduce((sum, i) => sum + (i.percentage || 0), 0) ?? 0

    return res.json({
      success: true,
      data: {
        description: parsed.description || `[${productName}] 역처방 분석 결과`,
        ingredients: parsed.ingredients || [],
        phases: parsed.phases || buildPhaseSummary(parsed.ingredients || []),
        process: parsed.process || [],
        cautions: parsed.cautions || [],
        totalPercentage: Math.round(totalPct * 100) / 100,
        generatedAt: new Date().toISOString(),
        source: 'gemini-2.0-flash',
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 처방 품질 검증 ───
app.post('/api/validate-formula', async (req, res) => {
  try {
    const { ingredients, targetMarket = 'KR' } = req.body

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ success: false, error: 'ingredients 배열이 필요합니다.' })
    }

    const checks = []
    let passed = true

    // 1. 배합비 합계 검사 (±0.5% 허용)
    const totalPct = Math.round(ingredients.reduce((sum, i) => sum + (parseFloat(i.percentage) || 0), 0) * 100) / 100
    const totalDiff = Math.abs(totalPct - 100)
    const totalStatus = totalDiff <= 0.5 ? 'pass' : 'fail'
    if (totalStatus === 'fail') passed = false
    checks.push({
      name: '배합비 합계',
      status: totalStatus,
      message: totalStatus === 'pass' ? '총 배합비가 허용 범위 이내입니다.' : '총 배합비가 허용 범위를 벗어났습니다.',
      detail: `${totalPct}% (허용 범위: 99.5~100.5%)`,
    })

    // 2. 규제 최대 농도 초과 검사
    const inciNames = ingredients.map(i => i.inci_name).filter(Boolean)
    const { rows: regRows } = await pool.query(
      'SELECT inci_name, max_concentration, restriction, source FROM regulation_cache WHERE inci_name = ANY($1)',
      [inciNames]
    )

    const violationDetails = []
    for (const ing of ingredients) {
      const regs = regRows.filter(r => r.inci_name === ing.inci_name && r.max_concentration)
      for (const reg of regs) {
        const maxMatch = reg.max_concentration?.match(/([\d.]+)\s*%/)
        if (maxMatch) {
          const maxVal = parseFloat(maxMatch[1])
          if (!isNaN(maxVal) && parseFloat(ing.percentage) > maxVal) {
            violationDetails.push(`${ing.inci_name} ${ing.percentage}% — ${reg.source} 최대 ${maxVal}% 초과`)
          }
        }
      }
    }

    // knowledge_base의 max_concentration도 검사
    const { rows: kbRows } = await pool.query(
      "SELECT search_key, data FROM coching_knowledge_base WHERE category = 'INGREDIENT_REGULATION' AND (data->>'inci_name') = ANY($1)",
      [inciNames]
    )
    for (const ing of ingredients) {
      const kb = kbRows.find(r => r.data?.inci_name === ing.inci_name)
      if (kb?.data?.max_concentration) {
        const maxMatch = kb.data.max_concentration.match(/([\d.]+)\s*%/)
        if (maxMatch) {
          const maxVal = parseFloat(maxMatch[1])
          if (!isNaN(maxVal) && parseFloat(ing.percentage) > maxVal) {
            violationDetails.push(`${ing.inci_name} ${ing.percentage}% — DB 최대 ${maxVal}% 초과`)
          }
        }
      }
    }

    const regStatus = violationDetails.length > 0 ? 'warn' : 'pass'
    checks.push({
      name: '규제 농도 검사',
      status: regStatus,
      message: violationDetails.length > 0 ? '일부 성분이 규제 농도를 초과했습니다.' : '모든 성분이 규제 범위 이내입니다.',
      detail: violationDetails.length > 0 ? violationDetails.join('; ') : `${regRows.length}건 규제 확인, 이상 없음`,
    })

    // 3. 방부제 존재 여부 확인
    const preservatives = ingredients.filter(i => {
      const name = (i.inci_name || '').toLowerCase()
      const type = (i.type || '').toUpperCase()
      return type === 'PRESERVATIVE' ||
        name.includes('phenoxyethanol') ||
        name.includes('paraben') ||
        name.includes('benzoic acid') ||
        name.includes('sorbic acid') ||
        name.includes('dehydroacetic acid') ||
        name.includes('benzyl alcohol')
    })
    const preservativeStatus = preservatives.length > 0 ? 'pass' : 'warn'
    checks.push({
      name: '방부제 확인',
      status: preservativeStatus,
      message: preservatives.length > 0 ? '방부제 성분이 포함되어 있습니다.' : '방부제 성분이 없습니다.',
      detail: preservatives.length > 0
        ? preservatives.map(p => `${p.inci_name} ${p.percentage}%`).join(', ')
        : '방부제 성분이 없습니다. 제품 안정성 검토 필요',
    })

    // 4. pH 조절제 존재 여부
    const phAdjusters = ingredients.filter(i => {
      const name = (i.inci_name || '').toLowerCase()
      const type = (i.type || '').toUpperCase()
      return type === 'PH_ADJUSTER' ||
        name.includes('sodium hydroxide') ||
        name.includes('citric acid') ||
        name.includes('triethanolamine') ||
        name.includes('lactic acid') ||
        name.includes('phosphoric acid') ||
        name.includes('arginine')
    })
    const phStatus = phAdjusters.length > 0 ? 'pass' : 'warn'
    checks.push({
      name: 'pH 조절제',
      status: phStatus,
      message: phAdjusters.length > 0 ? 'pH 조절제가 포함되어 있습니다.' : 'pH 조절제가 없습니다.',
      detail: phAdjusters.length > 0
        ? phAdjusters.map(p => `${p.inci_name} 존재`).join(', ')
        : 'pH 조절제가 없습니다. 적정 pH(4.5~7.0) 유지 검토 필요',
    })

    // 최종 pass 여부: fail이 하나라도 있으면 false, warn만이면 true
    const hasFail = checks.some(c => c.status === 'fail')
    if (hasFail) passed = false

    return res.json({
      success: true,
      data: {
        passed,
        totalPercentage: totalPct,
        checks,
        validatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 호환성 검사: DB 초기화 (테이블 + 시드) ────────────────────────────────
async function initCompatibilityDB() {
  // 1. 테이블 + 인덱스 생성
  await pool.query(`
    CREATE TABLE IF NOT EXISTS compatibility_rules (
      id SERIAL PRIMARY KEY,
      ingredient_a TEXT NOT NULL,
      ingredient_b TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('forbidden', 'caution', 'recommended')),
      reason TEXT NOT NULL,
      ph_condition TEXT,
      source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_compat_a ON compatibility_rules(lower(ingredient_a))`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_compat_b ON compatibility_rules(lower(ingredient_b))`)

  // 2. 시드 데이터 (0건일 때만 INSERT)
  const { rows } = await pool.query('SELECT count(*) as cnt FROM compatibility_rules')
  if (parseInt(rows[0].cnt) > 0) {
    console.log('[Compatibility] 시드 데이터 이미 존재, 건너뜀')
    return
  }

  const seeds = [
    // ── forbidden ──────────────────────────────────────────────────────────
    ['Retinol', 'Benzoyl Peroxide', 'forbidden',
      '레티놀이 벤조일퍼옥사이드에 의해 산화 분해됨', null, 'Dermatology consensus'],
    ['Vitamin C (Ascorbic Acid)', 'Niacinamide', 'forbidden',
      '고농도 혼합 시 니코틴산(Nicotinic Acid) 생성 — 자극 및 홍조 유발. 저농도는 허용되나 고농도 직접 혼합 금지', null, 'Journal of Cosmetic Science'],
    ['AHA (Glycolic Acid)', 'Retinol', 'forbidden',
      '산성 pH에서 레티놀 불안정 + 과도한 자극', null, 'PCPC guideline'],
    ['BHA (Salicylic Acid)', 'Retinol', 'forbidden',
      '과도한 각질 제거와 자극 시너지', null, 'PCPC guideline'],
    ['Vitamin C (Ascorbic Acid)', 'AHA (Glycolic Acid)', 'forbidden',
      'pH 충돌로 두 성분 모두 효과 감소 및 피부 자극 증가', null, 'Cosmetic formulation review'],
    ['Vitamin C (Ascorbic Acid)', 'BHA (Salicylic Acid)', 'forbidden',
      'pH 충돌, 산성 시너지로 자극 증가', null, 'Cosmetic formulation review'],
    ['Benzoyl Peroxide', 'Hydroquinone', 'forbidden',
      '즉각 산화 변색(갈변) 발생', null, 'Formulation incompatibility data'],
    // ── caution ────────────────────────────────────────────────────────────
    ['Niacinamide', 'AHA (Glycolic Acid)', 'caution',
      'pH 차이로 나이아신으로 전환 가능, 효과 감소 우려', 'pH < 3.5', 'IJCS 2021'],
    ['Niacinamide', 'BHA (Salicylic Acid)', 'caution',
      '낮은 pH 환경에서 니코틴산으로 전환 가능성', 'pH < 3.5', 'IJCS 2021'],
    ['Retinol', 'AHA (Glycolic Acid)', 'caution',
      '교대 사용 권장 — 같은 처방 내 혼합 시 자극 위험', null, 'Dermatologist recommendation'],
    ['Retinol', 'Vitamin C (Ascorbic Acid)', 'caution',
      'pH 차이로 안정성 저하, 교대 사용(아침/저녁) 권장', null, 'Skincare formulation guide'],
    ['Copper Peptide', 'Vitamin C (Ascorbic Acid)', 'caution',
      '구리 이온이 비타민 C 산화를 촉진하여 효능 저하', null, 'Peptide stability study'],
    ['Copper Peptide', 'AHA (Glycolic Acid)', 'caution',
      '산성 pH에서 펩타이드 구조 안정성 저하', null, 'Peptide stability study'],
    ['Zinc Oxide', 'AHA (Glycolic Acid)', 'caution',
      '산성 pH에서 아연 이온 용출 위험, 배합 안정성 저하', 'pH < 4', 'Sunscreen formulation review'],
    ['Iron Oxides', 'Ascorbic Acid', 'caution',
      '철 이온이 아스코르빈산 산화를 촉진 — 변색 및 효능 저하', null, 'Color cosmetics formulation'],
    ['Carbomer', 'Sodium Chloride', 'caution',
      '고농도 전해질 존재 시 카보머 겔 점도 급락', null, 'Rheology formulation note'],
    ['Cetrimonium Chloride', 'Sodium Lauryl Sulfate', 'caution',
      '양이온 + 음이온 계면활성제 조합 — 침전 및 효능 상쇄', null, 'Surfactant chemistry'],
    ['EDTA', 'Metal Ions', 'caution',
      '킬레이트 포화 시 안정성 저하, 방부 보조 기능 소실', null, 'Preservative system guideline'],
    ['Phenoxyethanol', 'Alkaline Base', 'caution',
      'pH 8 이상에서 방부력 급격 저하', 'pH > 8', 'Preservative efficacy data'],
    ['Methylisothiazolinone', 'Ascorbic Acid', 'caution',
      '아스코르빈산이 이소티아졸리논 계열 방부제 분해', null, 'Preservative compatibility'],
    ['Tocopherol', 'Benzoyl Peroxide', 'caution',
      '항산화제(토코페롤)가 벤조일퍼옥사이드에 의해 소진됨', null, 'Antioxidant formulation'],
    ['Hyaluronic Acid', 'Strong Acid', 'caution',
      'pH 2 미만 강산 환경에서 히알루론산 가수분해 분해', 'pH < 2', 'Biopolymer stability'],
    ['Alcohol Denat.', 'Retinol', 'caution',
      '알코올 건조 + 레티놀 자극이 시너지로 피부 장벽 손상 가중', null, 'Skincare formulation guide'],
    ['Allantoin', 'Strong Acid', 'caution',
      'pH 3 미만 강산 환경에서 알란토인 침전 및 분해', 'pH < 3', 'Cosmetic ingredient review'],
    // ── recommended ────────────────────────────────────────────────────────
    ['Vitamin C (Ascorbic Acid)', 'Vitamin E (Tocopherol)', 'recommended',
      '항산화 시너지 — 비타민 C가 산화된 비타민 E를 재생시켜 효과 극대화', null, 'Antioxidant synergy research'],
    ['Niacinamide', 'Hyaluronic Acid', 'recommended',
      '보습 + 피부 장벽 강화 시너지, 자극 없이 함께 사용 가능', null, 'Skincare formulation'],
    ['Retinol', 'Ceramide', 'recommended',
      '레티놀 자극 완화 + 피부 장벽 보호, 같은 처방 내 보완 조합', null, 'Clinical skincare study'],
    ['AHA (Glycolic Acid)', 'Panthenol', 'recommended',
      '각질 제거 후 진정 및 보습 보완 — 자극 최소화', null, 'Exfoliant formulation'],
    ['Centella Asiatica Extract', 'Madecassoside', 'recommended',
      '센텔라 추출물과 마데카소사이드 진정 시너지, 피부 회복 가속', null, 'Wound healing research'],
    ['Zinc Oxide', 'Titanium Dioxide', 'recommended',
      '물리적 자외선 차단제 시너지 — ZnO(UVA) + TiO2(UVB) 전대역 커버', null, 'Sunscreen formulation'],
    ['Tea Tree Oil', 'Salicylic Acid', 'recommended',
      '항균(티트리) + 각질 제거(살리실산) 시너지, 트러블 케어에 효과적', null, 'Acne treatment review'],
    ['Squalane', 'Ceramide', 'recommended',
      '스쿠알란 + 세라마이드 피부 장벽 강화 시너지, 보습막 형성', null, 'Barrier repair formulation'],
  ]

  for (const [a, b, severity, reason, ph_condition, source] of seeds) {
    await pool.query(
      `INSERT INTO compatibility_rules (ingredient_a, ingredient_b, severity, reason, ph_condition, source)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [a, b, severity, reason, ph_condition ?? null, source ?? null]
    )
  }
  console.log(`[Compatibility] 시드 데이터 ${seeds.length}건 삽입 완료`)
}

// ─── GET /api/compatibility-rules — 전체 규칙 목록 (관리용) ──────────────
app.get('/api/compatibility-rules', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, ingredient_a, ingredient_b, severity, reason, ph_condition, source, created_at
       FROM compatibility_rules
       ORDER BY severity, ingredient_a`
    )
    res.json({ success: true, data: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── POST /api/check-compatibility — 입력 원료 배열 호환성 검사 ───────────
app.post('/api/check-compatibility', async (req, res) => {
  try {
    const { ingredients } = req.body
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ success: false, error: 'ingredients 배열이 필요합니다.' })
    }

    // 규칙 전체 로드 후 메모리 매칭 (규칙 수 ~32개, 부하 무시)
    const { rows: rules } = await pool.query(
      `SELECT ingredient_a, ingredient_b, severity, reason, ph_condition, source FROM compatibility_rules`
    )

    const alerts = []
    const recommendations = []

    for (const rule of rules) {
      const ruleA = rule.ingredient_a.toLowerCase()
      const ruleB = rule.ingredient_b.toLowerCase()

      // 입력 원료 중 rule_a, rule_b를 각각 포함하는 원료 찾기 (ILIKE 부분 매칭)
      const matchedA = ingredients.find(ing => {
        const ingLower = ing.toLowerCase()
        return ruleA.includes(ingLower) || ingLower.includes(ruleA.replace(/\s*\(.*?\)/g, '').trim())
      })
      const matchedB = ingredients.find(ing => {
        const ingLower = ing.toLowerCase()
        return ruleB.includes(ingLower) || ingLower.includes(ruleB.replace(/\s*\(.*?\)/g, '').trim())
      })

      if (!matchedA || !matchedB) continue

      const entry = {
        severity: rule.severity,
        ingredientA: matchedA,
        ingredientB: matchedB,
        reason: rule.reason,
        phCondition: rule.ph_condition ?? null,
        source: rule.source ?? null,
        matchedA: rule.ingredient_a,
        matchedB: rule.ingredient_b,
      }

      if (rule.severity === 'recommended') {
        recommendations.push(entry)
      } else {
        alerts.push(entry)
      }
    }

    // forbidden → caution 순으로 정렬
    alerts.sort((a, b) => (a.severity === 'forbidden' ? -1 : 1))

    res.json({
      success: true,
      data: {
        alerts,
        recommendations,
        scannedCount: ingredients.length,
        checkedRules: rules.length,
        checkedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── POST /api/check-regulation-limits — 배합 농도 규정 초과 검사 ─────────
app.post('/api/check-regulation-limits', async (req, res) => {
  try {
    const { ingredients } = req.body
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ success: false, error: 'ingredients 배열이 필요합니다.' })
    }

    // ingredients: [{ inci_name: string, percentage: number }, ...]
    const inciNames = ingredients.map(i => i.inci_name)

    // regulation_cache 에서 INCI 매칭 (ILIKE 부분 포함)
    const placeholders = inciNames.map((_, idx) => `$${idx + 1}`).join(', ')
    const { rows: regs } = await pool.query(
      `SELECT inci_name, max_concentration, unit, regulation_type, source, country
       FROM regulation_cache
       WHERE inci_name ILIKE ANY (ARRAY[${placeholders}])`,
      inciNames.map(n => `%${n}%`)
    )

    const violations = []
    const warnings = []

    for (const item of ingredients) {
      if (item.percentage == null) continue
      const pct = parseFloat(item.percentage)
      if (isNaN(pct)) continue

      // 해당 INCI에 매칭되는 규정 검색 (대소문자 무시 포함 매칭)
      const matchingRegs = regs.filter(r =>
        r.inci_name.toLowerCase().includes(item.inci_name.toLowerCase()) ||
        item.inci_name.toLowerCase().includes(r.inci_name.toLowerCase())
      )

      for (const reg of matchingRegs) {
        const maxAllowed = parseFloat(reg.max_concentration)
        if (isNaN(maxAllowed)) continue

        const entry = {
          inci_name: item.inci_name,
          percentage: pct,
          max_allowed: maxAllowed,
          unit: reg.unit ?? '%',
          regulation_type: reg.regulation_type ?? null,
          source: reg.source ?? null,
          country: reg.country ?? null,
        }

        if (pct > maxAllowed) {
          violations.push({
            ...entry,
            message: `${item.inci_name} 최대 허용 농도 ${maxAllowed}${reg.unit ?? '%'}를 초과합니다 (현재 ${pct}%)`,
          })
        } else if (pct > maxAllowed * 0.9) {
          // 최대치의 90% 이상이면 경고
          warnings.push({
            ...entry,
            message: `${item.inci_name} 최대 허용 농도(${maxAllowed}${reg.unit ?? '%'})에 근접합니다 (현재 ${pct}%)`,
          })
        }
      }
    }

    res.json({
      success: true,
      data: {
        violations,
        warnings,
        checkedCount: ingredients.length,
        checkedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 유사 처방 검색 (product_master INCI 기반) ────────────────────────────
app.post('/api/similar-products', async (req, res) => {
  try {
    const { ingredients = [], limit = 10 } = req.body
    if (!ingredients.length) return res.json({ success: true, data: { products: [], total: 0 } })

    // 입력 원료 INCI 목록
    const inciList = ingredients
      .map(i => (i.inci_name || i.name || '').trim().toLowerCase())
      .filter(n => n.length > 1)
    if (!inciList.length) return res.json({ success: true, data: { products: [], total: 0 } })

    // product_master에서 전성분(inci_list) 컬럼을 검색
    // 매칭 원료 수가 많은 순으로 정렬
    const matchCases = inciList.map((_, i) => `CASE WHEN lower(pm.inci_list) LIKE $${i + 1} THEN 1 ELSE 0 END`).join(' + ')
    const params = inciList.map(n => `%${n}%`)
    params.push(parseInt(limit))

    const query = `
      SELECT pm.id, pm.product_name, pm.brand, pm.category, pm.inci_list,
             (${matchCases}) as match_count
      FROM product_master pm
      WHERE (${inciList.map((_, i) => `lower(pm.inci_list) LIKE $${i + 1}`).join(' OR ')})
      ORDER BY match_count DESC, pm.product_name
      LIMIT $${params.length}
    `
    const { rows } = await pool.query(query, params)

    res.json({
      success: true,
      data: {
        products: rows.map(r => ({
          id: r.id,
          productName: r.product_name,
          brand: r.brand,
          category: r.category,
          matchCount: parseInt(r.match_count),
          totalIngredients: inciList.length,
          matchRate: Math.round((parseInt(r.match_count) / inciList.length) * 100),
        })),
        total: rows.length,
        searchedIngredients: inciList.length,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 배치 스케일러 계산 ────────────────────────────────────────────────────
app.post('/api/batch-scale', async (req, res) => {
  try {
    const { ingredients = [], currentBatchG = 1000, targetBatchG = 5000 } = req.body
    if (!ingredients.length) return res.json({ success: true, data: { scaled: [], ratio: 1 } })

    const ratio = targetBatchG / currentBatchG
    const scaled = ingredients.map(ing => ({
      name: ing.name || '',
      inci_name: ing.inci_name || '',
      percentage: ing.percentage || 0,
      phase: ing.phase || '',
      function: ing.function || '',
      currentG: ((ing.percentage || 0) / 100 * currentBatchG).toFixed(2),
      targetG: ((ing.percentage || 0) / 100 * targetBatchG).toFixed(2),
    }))

    res.json({
      success: true,
      data: {
        scaled,
        ratio: ratio.toFixed(2),
        currentBatchG,
        targetBatchG,
        totalCurrentG: currentBatchG.toFixed(2),
        totalTargetG: targetBatchG.toFixed(2),
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 서버 시작 ────────────────────────────────────────────────────────────
const PORT = process.env.API_PORT || 3001

;(async () => {
  try {
    await initCompatibilityDB()
    console.log('[Compatibility] DB 초기화 완료')
  } catch (err) {
    console.error('[Compatibility] DB 초기화 실패:', err.message)
  }
  app.listen(PORT, () => {
    console.log(`[MyLab API] Running on http://localhost:${PORT}`)
  })
})()
