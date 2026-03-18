// ─── routes/ingredients.js ───────────────────────────────────────────────────
// /api/ingredients*, /api/ingredient-profile, /api/ingredient-types,
// /api/stability, /api/compounds/*
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express'
import pool from '../db.js'

const router = Router()

// ─── 규제 restriction 파싱 헬퍼 (이 라우터에서만 사용) ──────────────────────
function parseRestrictionField(restriction) {
  if (!restriction) return { text: '', ewg_score: null, concerns: null, primary_function: null, reg_status: null }
  try {
    const obj = typeof restriction === 'object' ? restriction : JSON.parse(restriction)
    if (obj && typeof obj === 'object') {
      const textParts = []
      if (obj.annex_type) textParts.push(obj.annex_type)
      if (obj.annex) textParts.push(`Annex ${obj.annex}`)
      if (obj.summary) textParts.push(obj.summary)
      if (obj.note && obj.note !== 'null') textParts.push(obj.note)
      if (obj.status && !obj.annex_type) textParts.push(obj.status === 'banned' ? '금지' : obj.status === 'restricted' ? '제한' : obj.status)
      if (obj.country && !obj.annex_type) textParts.unshift(`[${obj.country}]`)
      if (obj.cir_assessment) textParts.push(`CIR: ${obj.cir_assessment}`)
      return {
        text: textParts.join(' — ') || '',
        ewg_score: typeof obj.ewg_score === 'number' ? obj.ewg_score : null,
        concerns: Array.isArray(obj.concerns) && obj.concerns.length ? obj.concerns : null,
        primary_function: obj.primary_function || null,
        reg_status: obj.status || null,
      }
    }
  } catch (_) { /* 일반 텍스트 */ }
  return { text: restriction, ewg_score: null, concerns: null, primary_function: null, reg_status: null }
}

function deriveRegStatus(kr, eu) {
  const krR = (kr || '').toLowerCase()
  const euR = (eu || '').toLowerCase()
  if (krR.includes('금지') || euR.includes('ban') || euR.includes('prohibit')) return 'banned'
  if (krR.includes('한도') || krR.includes('제한') || euR.includes('restrict') || euR.includes('annex')) return 'restricted'
  if (kr || eu) return 'allowed'
  return null
}

// ─── 원료 목록 (ingredient_master + knowledge_base 통합) ───────────────────
router.get('/ingredients', async (req, res) => {
  try {
    const { q, type, limit = 50, offset = 0 } = req.query
    let where = [
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

    const dataQuery = `
      SELECT im.id, im.inci_name, im.korean_name, im.cas_number, im.ec_number,
        im.ingredient_type, im.description, im.origin, im.source, im.updated_at,
        (CASE WHEN im.korean_name IS NOT NULL AND im.korean_name != '' THEN 1 ELSE 0 END
         + CASE WHEN im.cas_number IS NOT NULL AND im.cas_number != '' THEN 1 ELSE 0 END
         + CASE WHEN im.description IS NOT NULL AND im.description != '' THEN 1 ELSE 0 END
         + CASE WHEN EXISTS (
             SELECT 1 FROM regulation_cache rc
             WHERE lower(rc.inci_name) = lower(im.inci_name)
               AND rc.source IN ('GEMINI_KR','MFDS_SEED','GEMINI_EU')
           ) THEN 4 ELSE 0 END
        ) AS info_score
      FROM ingredient_master im
      ${whereClause}
      ORDER BY info_score DESC, im.inci_name
      LIMIT $${idx} OFFSET $${idx + 1}`

    const countQuery = `SELECT count(*) FROM ingredient_master im ${whereClause}`
    params.push(parseInt(limit), parseInt(offset))

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, idx - 1)),
      pool.query(dataQuery, params),
    ])

    const inciNames = dataRes.rows.map(r => r.inci_name).filter(Boolean)
    let regMap = {}
    if (inciNames.length > 0) {
      const regPlaceholders = inciNames.map((_, i) => `$${i + 1}`).join(', ')
      const { rows: regRows } = await pool.query(
        `SELECT lower(inci_name) AS key, source, restriction, max_concentration
         FROM regulation_cache
         WHERE lower(inci_name) IN (${regPlaceholders})
           AND source NOT IN ('coching_legacy','gemini_kb','gem2_kb')`,
        inciNames.map(n => n.toLowerCase())
      )
      for (const r of regRows) {
        if (!regMap[r.key]) regMap[r.key] = {}
        if (r.source === 'GEMINI_KR' || r.source === 'MFDS_SEED') {
          regMap[r.key].kr = r
        } else if (r.source === 'GEMINI_EU') {
          regMap[r.key].eu = r
        }
      }
    }

    const items = dataRes.rows.map(r => {
      const reg = regMap[r.inci_name?.toLowerCase()] || {}
      const regScore = (reg.kr ? 2 : 0) + (reg.eu ? 2 : 0)
      return {
        id: r.id,
        inci_name: r.inci_name,
        korean_name: r.korean_name,
        cas_number: r.cas_number,
        ec_number: r.ec_number,
        ingredient_type: r.ingredient_type,
        description: r.description,
        origin: r.origin,
        source: r.source,
        regulation_status: deriveRegStatus(reg.kr?.restriction, reg.eu?.restriction),
        kr_regulation: reg.kr?.restriction || null,
        eu_regulation: reg.eu?.restriction || null,
        max_concentration: reg.kr?.max_concentration || reg.eu?.max_concentration || null,
        updated_at: r.updated_at,
        _score: (r.info_score || 0) + regScore,
      }
    })
    items.sort((a, b) => b._score - a._score || (a.inci_name || '').localeCompare(b.inci_name || ''))
    items.forEach(i => delete i._score)

    res.json({ total: parseInt(countRes.rows[0].count), items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 원료 검색 (사전 검색) ─────────────────────────────────────────────────
router.get('/ingredients/search', async (req, res) => {
  try {
    const { q, type, limit = 20 } = req.query
    const lim = Math.min(parseInt(limit) || 20, 100)
    let where = [
      `inci_name NOT LIKE '%#REF%'`,
      `(korean_name IS NULL OR korean_name NOT LIKE '%#REF%')`,
    ]
    let params = []
    let idx = 1

    if (q) {
      where.push(`(inci_name ILIKE $${idx} OR korean_name ILIKE $${idx})`)
      params.push(`%${q}%`)
      idx++
    }
    if (type && type !== 'ALL') {
      where.push(`ingredient_type = $${idx}`)
      params.push(type)
      idx++
    }

    params.push(lim)
    const { rows } = await pool.query(
      `SELECT inci_name, korean_name, ingredient_type, ph_min, ph_max,
              viscosity_type, solubility, function_inci,
              usage_level_min, usage_level_max, ewg_score,
              comedogenic_rating, max_concentration_kr, max_concentration_eu,
              skin_type_suitability
       FROM ingredient_master
       WHERE ${where.join(' AND ')}
       ORDER BY inci_name
       LIMIT $${idx}`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 성분DB 페이지 개선 API ────────────────────────────────────────────────
router.get('/ingredients/db', async (req, res) => {
  try {
    const { page = 1, limit = 50, type, search } = req.query
    const lim = Math.min(parseInt(limit) || 50, 200)
    const off = (Math.max(parseInt(page) || 1, 1) - 1) * lim

    let where = [
      `inci_name NOT LIKE '%#REF%'`,
      `(korean_name IS NULL OR korean_name NOT LIKE '%#REF%')`,
    ]
    let params = []
    let idx = 1

    if (search) {
      where.push(`(inci_name ILIKE $${idx} OR korean_name ILIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }
    if (type && type !== 'ALL') {
      where.push(`ingredient_type = $${idx}`)
      params.push(type)
      idx++
    }

    const whereClause = `WHERE ${where.join(' AND ')}`
    const countRes = await pool.query(`SELECT COUNT(*) FROM ingredient_master ${whereClause}`, params.slice(0, idx - 1))
    params.push(lim, off)
    const { rows } = await pool.query(
      `SELECT inci_name, korean_name, ingredient_type, ewg_score,
              max_concentration_kr, max_concentration_eu,
              usage_level_min, usage_level_max, function_inci,
              ph_min, ph_max, comedogenic_rating,
              skin_type_suitability
       FROM ingredient_master
       ${whereClause}
       ORDER BY (
         CASE WHEN function_inci IS NOT NULL AND function_inci != '' THEN 2 ELSE 0 END +
         CASE WHEN ph_min IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN ph_max IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN usage_level_min IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN usage_level_max IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN ewg_score IS NOT NULL AND ewg_score > 0 THEN 1 ELSE 0 END +
         CASE WHEN max_concentration_kr IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN max_concentration_eu IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN korean_name IS NOT NULL THEN 1 ELSE 0 END
       ) DESC, inci_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    )

    const inciList = rows.map(r => r.inci_name).filter(Boolean)
    let regStatusMap = {}
    if (inciList.length) {
      const { rows: regRows } = await pool.query(
        `SELECT lower(inci_name) AS key, source, restriction
         FROM regulation_cache
         WHERE lower(inci_name) = ANY($1)
           AND source IN ('MFDS_SEED','COSING_EU','coching_legacy')`,
        [inciList.map(n => n.toLowerCase())]
      )
      for (const r of regRows) {
        if (!regStatusMap[r.key]) regStatusMap[r.key] = {}
        const restr = (r.restriction || '')
        let status
        if (/^II\//.test(restr) || /^CMR/.test(restr)) {
          status = 'prohibited'
        } else if (/^III\//.test(restr) || /^V\//.test(restr) || /^Annex\s*(III|V)/i.test(restr)) {
          status = 'restricted'
        } else {
          const restrL = restr.toLowerCase()
          status = restrL.includes('금지') && !/부분|특정|3세|영유아/.test(restr)
            ? 'prohibited'
            : restrL.includes('제한') || restrL.includes('restrict') || restrL.includes('annex') || restrL.includes('배합 한도')
            ? 'restricted'
            : 'allowed'
        }
        if (r.source === 'GEMINI_KR' || r.source === 'MFDS_SEED') {
          regStatusMap[r.key].kr = status
        } else {
          regStatusMap[r.key].eu = status
        }
      }
    }

    const items = rows.map(r => {
      const reg = regStatusMap[r.inci_name?.toLowerCase()] || {}
      return {
        ...r,
        regulation_status_kr: reg.kr || null,
        regulation_status_eu: reg.eu || null,
      }
    })

    res.json({ total: parseInt(countRes.rows[0].count), page: parseInt(page), items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 원료 상세 (/api/ingredients/:id) ─────────────────────────────────────
router.get('/ingredients/:id', async (req, res, next) => {
  const { id } = req.params
  if (!/^\d+$/.test(id)) return next()
  try {
    const { rows } = await pool.query('SELECT * FROM ingredient_master WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: 'Not found' })

    const row = rows[0]
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

// ─── 원료 통합 프로파일 ─────────────────────────────────────────────────────
router.get('/ingredient-profile/:query', async (req, res) => {
  try {
    const query = req.params.query?.trim()
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'query must be at least 2 characters' })
    }

    const { rows: mvRows } = await pool.query(
      `SELECT * FROM ingredient_profile_mv
       WHERE inci_name_lower = lower($1)
          OR (cas_number IS NOT NULL AND cas_number ILIKE $1)
          OR korean_name = $1
       LIMIT 1`,
      [query],
    )
    if (mvRows.length > 0) {
      return res.json({ source: 'materialized_view', data: mvRows[0] })
    }

    const { rows: partialRows } = await pool.query(
      `SELECT master_id, inci_name, korean_name, cas_number, ingredient_type,
              ewg_score, reg_kr_status, reg_eu_status, purposes, completeness_score
       FROM ingredient_profile_mv
       WHERE inci_name ILIKE $1 OR korean_name ILIKE $1
       ORDER BY completeness_score DESC
       LIMIT 10`,
      [`%${query}%`],
    )
    if (partialRows.length === 1) {
      const { rows: fullRows } = await pool.query(
        'SELECT * FROM ingredient_profile_mv WHERE master_id = $1',
        [partialRows[0].master_id],
      )
      return res.json({ source: 'materialized_view', data: fullRows[0] })
    }
    if (partialRows.length > 1) {
      return res.json({ source: 'materialized_view_partial', candidates: partialRows })
    }

    const { rows: masterRows } = await pool.query(
      `SELECT id, inci_name, korean_name, cas_number, ec_number,
              ingredient_type, description, origin, ewg_score
       FROM ingredient_master
       WHERE lower(inci_name) = lower($1)
          OR (cas_number IS NOT NULL AND cas_number ILIKE $1)
          OR korean_name = $1
       LIMIT 1`,
      [query],
    )
    if (masterRows.length > 0) {
      return res.json({
        source: 'ingredient_master_direct',
        note: 'ingredient_profile_mv 미갱신 원료입니다.',
        data: masterRows[0],
      })
    }

    return res.status(404).json({ error: 'Ingredient not found', query })
  } catch (err) {
    if (err.message?.includes('ingredient_profile_mv')) {
      return res.status(503).json({ error: 'ingredient_profile_mv not yet created. Run migration first.' })
    }
    res.status(500).json({ error: err.message })
  }
})

// ─── 원료 타입 목록 ────────────────────────────────────────────────────────
router.get('/ingredient-types', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT ingredient_type, count(*) as cnt FROM ingredient_master GROUP BY ingredient_type ORDER BY cnt DESC'
    )
    res.json(rows.map(r => ({ type: r.ingredient_type, count: parseInt(r.cnt) })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 안정성 테스트 ─────────────────────────────────────────────────────────
router.get('/stability', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stability_tests ORDER BY formula_name, condition, week'
    )
    const map = new Map()
    let nextId = 1
    for (const row of rows) {
      const key = `${row.formula_name}__${row.condition}`
      if (!map.has(key)) {
        map.set(key, {
          id: nextId++,
          formulaName: row.formula_name,
          condition: row.condition,
          results: [],
        })
      }
      map.get(key).results.push({
        week: row.week,
        deltaE: parseFloat(row.delta_e),
        viscChange: parseFloat(row.visc_change),
        ph: row.ph != null ? parseFloat(row.ph) : null,
        appearance: row.appearance || '',
        result: row.result || 'pass',
      })
    }
    res.json({ data: [...map.values()] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 복합원료 목록 ─────────────────────────────────────────────────────────
router.get('/compounds/list', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT trade_name, supplier, category,
              jsonb_array_length(components) AS component_count
       FROM compound_master
       ORDER BY trade_name`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 복합원료 상세 ─────────────────────────────────────────────────────────
router.get('/compounds/:trade_name', async (req, res) => {
  try {
    const { trade_name } = req.params
    const { rows } = await pool.query(
      `SELECT trade_name, supplier, category, components, notes
       FROM compound_master
       WHERE lower(trade_name) = lower($1)`,
      [trade_name]
    )
    if (!rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
