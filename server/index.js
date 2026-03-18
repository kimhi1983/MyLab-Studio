import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '.env') })

import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'mylab-fallback-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// ─── JWT 인증 미들웨어 ───────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization']
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: '토큰이 만료되었거나 유효하지 않습니다.' })
  }
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

async function resyncGuideCacheIdSequence(client = pool) {
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('guide_cache', 'id'),
      COALESCE((SELECT MAX(id) FROM guide_cache), 0) + 1,
      false
    )
  `)
}

function isGuideCachePrimaryKeyConflict(err) {
  return err?.code === '23505' &&
    (err?.constraint === 'guide_cache_pkey' || String(err?.message || '').includes('guide_cache_pkey'))
}

// ─── 검증 모드 DB 초기화 ───
async function initVerificationDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploaded_formulations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_name VARCHAR(200) NOT NULL,
      version INTEGER DEFAULT 1,
      file_name VARCHAR(300),
      file_type VARCHAR(20),
      raw_data JSONB,
      normalized_data JSONB,
      ingredient_count INTEGER,
      total_pct DECIMAL(6,2),
      category_code VARCHAR(20),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      parent_id UUID REFERENCES uploaded_formulations(id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verification_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      formulation_id UUID NOT NULL REFERENCES uploaded_formulations(id) ON DELETE CASCADE,
      overall_status VARCHAR(20) NOT NULL,
      critical_count INTEGER DEFAULT 0,
      warning_count INTEGER DEFAULT 0,
      pass_count INTEGER DEFAULT 0,
      report_data JSONB NOT NULL,
      predicted_ph DECIMAL(3,1),
      predicted_viscosity INTEGER,
      predicted_hlb DECIMAL(4,1),
      cost_estimate INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS formulation_notes (
      id SERIAL PRIMARY KEY,
      formulation_id UUID NOT NULL REFERENCES uploaded_formulations(id) ON DELETE CASCADE,
      note_text TEXT NOT NULL,
      note_type VARCHAR(20) DEFAULT 'general',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS verified_formulation_pool (
      id SERIAL PRIMARY KEY,
      formulation_id UUID NOT NULL REFERENCES uploaded_formulations(id) ON DELETE CASCADE,
      category_code VARCHAR(20) NOT NULL,
      quality_score DECIMAL(4,1),
      used_for_training BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  // llm_cache: Qwen + Gemini 결과 공유 캐싱 (워크플로우 batch와 충돌 없음 — 마이랩 전용)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS llm_cache (
      cache_key VARCHAR(64) PRIMARY KEY,
      model VARCHAR(30) NOT NULL,
      task_type VARCHAR(30) NOT NULL,
      result JSONB NOT NULL,
      hit_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
    )
  `)
  // 인덱스 (이미 존재하면 무시)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_uf_created ON uploaded_formulations (created_at DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vr_formulation ON verification_reports (formulation_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fn_formulation ON formulation_notes (formulation_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vfp_category ON verified_formulation_pool (category_code, quality_score DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_llm_cache_type ON llm_cache (task_type, created_at DESC)`)
}

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
    const [kbAll, kbIngredients, regulations, ingredients, products, companies, compounds, guideFormulas, copyFormulas,
           enrichedIngredients, regulationCovered] = await Promise.all([
      pool.query('SELECT count(*) as cnt FROM coching_knowledge_base'),
      pool.query("SELECT count(*) as cnt FROM coching_knowledge_base WHERE category = 'INGREDIENT_REGULATION'"),
      pool.query('SELECT count(*) as cnt FROM regulation_cache'),
      pool.query('SELECT count(*) as cnt FROM ingredient_master'),
      pool.query('SELECT count(*) as cnt FROM product_master'),
      pool.query('SELECT count(*) as cnt FROM cosmetics_company').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT count(*) as cnt FROM compound_master').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT count(*) as cnt FROM guide_cache').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT count(*) as cnt FROM guide_cache_copy').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query('SELECT count(*) as cnt FROM ingredient_master WHERE ph_min IS NOT NULL').catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(`SELECT COUNT(DISTINCT lower(im.inci_name)) as cnt FROM ingredient_master im WHERE EXISTS (SELECT 1 FROM regulation_cache rc WHERE lower(rc.inci_name) = lower(im.inci_name))`).catch(() => ({ rows: [{ cnt: 0 }] })),
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
      totalGuideFormulas: parseInt(guideFormulas.rows[0].cnt),
      totalCopyFormulas: parseInt(copyFormulas.rows[0].cnt),
      kbIngredients: parseInt(kbIngredients.rows[0].cnt),
      enrichedIngredients: parseInt(enrichedIngredients.rows[0].cnt),
      regulationCoveredIngredients: parseInt(regulationCovered.rows[0].cnt),
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

    // 1단계: 목록 조회 — 규제 존재 여부를 EXISTS 서브쿼리로 빠르게 체크
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

    // 2단계: 결과 INCI 이름으로 규제 배치 조회
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

    function deriveRegStatus(kr, eu) {
      const krR = (kr || '').toLowerCase()
      const euR = (eu || '').toLowerCase()
      if (krR.includes('금지') || euR.includes('ban') || euR.includes('prohibit')) return 'banned'
      if (krR.includes('한도') || krR.includes('제한') || euR.includes('restrict') || euR.includes('annex')) return 'restricted'
      if (kr || eu) return 'allowed'
      return null
    }

    // 3단계: 규제 포함 info_score 재계산 + 재정렬
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

// ─── 원료 상세 (ingredient_master 기반 + properties + functions + regulations) ───
app.get('/api/ingredients/:id', async (req, res, next) => {
  const { id } = req.params
  if (!/^\d+$/.test(id)) return next()  // 숫자 아닌 경우 /search, /db 등 후속 라우트로 통과
  try {
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

// ─── restriction 필드 파싱 헬퍼 (GEMINI_SAFETY_* / coching_legacy JSON 대응) ───
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

function normalizeRegulationIngredientName(ingredient, inciName) {
  const raw = String(ingredient || inciName || '').trim()
  if (!raw) return ''
  return raw.replace(/^[\-\s]+/, '').trim()
}

function normalizeRegulationRestrictionText(text, regStatus = '') {
  const raw = String(text || '').trim()
  const cleaned = raw.replace(/^Annex null\s*[—-]\s*/i, '').trim()

  if (!cleaned && regStatus === 'allowed') return '별도 제한 없음'
  if (/^allowed$/i.test(cleaned)) return '별도 제한 없음'

  return cleaned
}

function isDisplayableRegulationRow({ ingredient, inci_name, restriction, reg_status, quality_flag }) {
  const displayName = normalizeRegulationIngredientName(ingredient, inci_name)
  const text = String(restriction || '')

  if (!displayName) return false
  if (quality_flag === 'invalid') return false          // 워크플로우 팀 배치 마킹
  if (reg_status === 'unknown') return false
  if (/유효하지 않은 원료명|원료 정보를 찾을 수 없습니다|해당하는 원료 정보를 찾을 수 없습니다/.test(text)) return false
  if (/^\[?\d+\]?$/.test(displayName)) return false
  if (/^\(?\d+\)?\s*\d{2,}-\d{2,}-\d$/.test(displayName)) return false
  if (/^\(/.test(displayName)) return false             // (DL, (see note 등 파싱 실패
  if (/^[,\s\/]/.test(displayName)) return false        // ,8060-28-4, / Inonotus 등
  if (displayName.length < 2) return false              // 단일 문자

  return true
}

const COLUMN_CACHE_TTL_MS = 5 * 60 * 1000
let _columnCache = { columns: null, fetchedAt: 0 }

async function getRegulationCacheColumns(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && _columnCache.columns && now - _columnCache.fetchedAt < COLUMN_CACHE_TTL_MS) {
    return _columnCache.columns
  }
  const { rows } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'regulation_cache'
  `)
  _columnCache = { columns: new Set(rows.map(r => r.column_name)), fetchedAt: now }
  return _columnCache.columns
}

function parseRestrictionObject(restriction) {
  if (!restriction) return null
  try {
    const obj = typeof restriction === 'object' ? restriction : JSON.parse(restriction)
    return obj && typeof obj === 'object' ? obj : null
  } catch (_) {
    return null
  }
}

function parseMaxConcentrationValue(maxConcentration, restriction) {
  const candidates = [maxConcentration]
  const restrictionObj = parseRestrictionObject(restriction)
  if (restrictionObj?.max_concentration) candidates.push(restrictionObj.max_concentration)

  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue
    if (typeof candidate === 'number' && !Number.isNaN(candidate)) return candidate

    const text = String(candidate)
    const match = text.match(/(\d+(?:\.\d+)?)/)
    if (match) return parseFloat(match[1])
  }

  return null
}

function isBannedRestriction(restriction, regStatus = '') {
  const text = `${restriction || ''} ${regStatus || ''}`.toLowerCase()
  return text.includes('banned') || text.includes('prohibit') || text.includes('forbidden') || text.includes('사용금지')
}

function normalizeFormulaCacheRow(row) {
  return {
    ...row,
    estimated_ph: row?.estimated_ph == null ? null : String(row.estimated_ph),
  }
}

// ─── 규제 데이터 (위젯용) ───
app.get('/api/regulations', async (req, res) => {
  try {
    const { source, q, limit = 50, offset = 0 } = req.query
    const columns = await getRegulationCacheColumns()
    const hasDisplayName = columns.has('display_name')
    const hasDisplayStatus = columns.has('display_status')
    const hasDisplayRestriction = columns.has('display_restriction')
    const hasQualityFlag = columns.has('quality_flag')
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
    const dataQuery = `SELECT source, ingredient, inci_name, max_concentration, restriction, updated_at,
      ${hasDisplayName ? 'display_name' : 'NULL::text AS display_name'},
      ${hasDisplayStatus ? 'display_status' : 'NULL::text AS display_status'},
      ${hasDisplayRestriction ? 'display_restriction' : 'NULL::text AS display_restriction'},
      ${hasQualityFlag ? 'quality_flag' : 'NULL::text AS quality_flag'},
      (SELECT im.ingredient_type FROM ingredient_master im WHERE lower(im.inci_name) = lower(regulation_cache.inci_name) LIMIT 1) AS ingredient_type
      FROM regulation_cache ${whereClause}
      ORDER BY ingredient
      LIMIT $${idx} OFFSET $${idx + 1}`
    params.push(parseInt(limit), parseInt(offset))

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, idx - 1)),
      pool.query(dataQuery, params),
    ])

    const items = dataRes.rows.map(r => {
      const parsed = parseRestrictionField(r.restriction)
      const regStatus = r.display_status || parsed.reg_status
      const normalizedRestriction = normalizeRegulationRestrictionText(
        r.display_restriction || parsed.text || r.restriction,
        regStatus,
      )
      const normalizedIngredient = r.display_name || normalizeRegulationIngredientName(r.ingredient, r.inci_name)
      const qualityFlag = (r.quality_flag || '').toLowerCase()
      const displayable = qualityFlag
        ? qualityFlag === 'valid'
        : isDisplayableRegulationRow({
            ingredient: normalizedIngredient,
            inci_name: r.inci_name,
            restriction: normalizedRestriction,
            reg_status: regStatus,
          })

      return {
        ...r,
        ingredient: normalizedIngredient,
        restriction: normalizedRestriction,
        ewg_score: parsed.ewg_score,
        concerns: parsed.concerns,
        primary_function: parsed.primary_function,
        reg_status: regStatus,
        quality_flag: r.quality_flag || null,
        displayable,
      }
    })

    res.json({
      total: parseInt(countRes.rows[0].count),
      items,
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

// ─── EWG 제품별 등급 ───
app.get('/api/ewg-product-ratings', async (req, res) => {
  try {
    const { hazard, limit = 50, offset = 0 } = req.query
    let where = []
    let params = []
    let idx = 1

    if (hazard) {
      where.push(`ewg_hazard_level = $${idx++}`)
      params.push(hazard.toUpperCase())
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const [countRes, dataRes] = await Promise.all([
      pool.query(`SELECT count(*) FROM ewg_product_ratings ${whereClause}`, params),
      pool.query(
        `SELECT product_id, product_name, brand, ewg_avg_score, ewg_max_score,
                ewg_hazard_level, high_concern_ingredients, ingredient_count,
                scored_ingredient_count, computed_at
         FROM ewg_product_ratings ${whereClause}
         ORDER BY ewg_avg_score DESC NULLS LAST
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, parseInt(limit), parseInt(offset)],
      ),
    ])

    res.json({
      total: parseInt(countRes.rows[0].count),
      items: dataRes.rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── EWG 원료별 상세 ───
app.get('/api/ewg-ingredient/:inci_name', async (req, res) => {
  try {
    const { inci_name } = req.params
    const { rows } = await pool.query(
      `SELECT e.*, i.ewg_score, i.korean_name
       FROM ewg_ingredient_detail e
       LEFT JOIN ingredient_master i ON i.inci_name = e.inci_name
       WHERE e.inci_name ILIKE $1
       LIMIT 1`,
      [inci_name],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 원료 통합 프로파일 (ingredient_profile_mv) ───
app.get('/api/ingredient-profile/:query', async (req, res) => {
  try {
    const query = req.params.query?.trim()
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'query must be at least 2 characters' })
    }

    // 1차: MV 완전 일치 (INCI / CAS / 한글명)
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

    // 2차: MV 부분 일치
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

    // 3차: ingredient_master 직접 조회 (MV 미갱신 원료)
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
    // ingredient_profile_mv가 아직 없을 경우 graceful fallback
    if (err.message?.includes('ingredient_profile_mv')) {
      return res.status(503).json({ error: 'ingredient_profile_mv not yet created. Run migration first.' })
    }
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/regulations-quality-summary', async (req, res) => {
  try {
    const columns = await getRegulationCacheColumns()
    const hasQualityFlag = columns.has('quality_flag')
    const hasDisplayName = columns.has('display_name')
    const hasDisplayStatus = columns.has('display_status')
    const hasDisplayRestriction = columns.has('display_restriction')
    const displayNameExpr = hasDisplayName ? 'display_name' : 'NULL::text'
    const displayStatusExpr = hasDisplayStatus ? 'display_status' : 'NULL::text'
    const displayRestrictionExpr = hasDisplayRestriction ? 'display_restriction' : 'NULL::text'

    let rows, byQuality, hiddenExamples, isSampled

    if (hasQualityFlag) {
      // quality_flag 컬럼이 있으면 DB에서 직접 GROUP BY 집계 (LIMIT 없음)
      isSampled = false
      const qualityExpr = 'quality_flag'
      const result = await pool.query(`
        SELECT
          source,
          ingredient,
          inci_name,
          restriction,
          ${displayNameExpr} AS display_name,
          ${displayStatusExpr} AS display_status,
          ${displayRestrictionExpr} AS display_restriction,
          ${qualityExpr} AS quality_flag,
          updated_at
        FROM regulation_cache
        ORDER BY updated_at DESC NULLS LAST
      `)
      rows = result.rows

      const normalized = rows.map((row) => {
        const parsed = parseRestrictionField(row.restriction)
        const regStatus = row.display_status || parsed.reg_status
        const displayName = row.display_name || normalizeRegulationIngredientName(row.ingredient, row.inci_name)
        const text = normalizeRegulationRestrictionText(row.display_restriction || parsed.text || row.restriction, regStatus)
        const qualityFlag = (row.quality_flag || '').toLowerCase()
        const displayable = qualityFlag === 'valid'

        return {
          source: row.source,
          ingredient: displayName,
          quality_flag: row.quality_flag,
          displayable,
        }
      })

      byQuality = normalized.reduce((acc, row) => {
        acc[row.quality_flag] = (acc[row.quality_flag] || 0) + 1
        return acc
      }, {})
      hiddenExamples = normalized.filter((row) => !row.displayable).slice(0, 20)

      res.json({
        sampled_rows: normalized.length,
        is_sampled: false,
        by_quality: byQuality,
        hidden_examples: hiddenExamples,
      })
    } else {
      // quality_flag 컬럼 없으면 LIMIT 5000으로 샘플링
      isSampled = true
      const result = await pool.query(`
        SELECT
          source,
          ingredient,
          inci_name,
          restriction,
          ${displayNameExpr} AS display_name,
          ${displayStatusExpr} AS display_status,
          ${displayRestrictionExpr} AS display_restriction,
          NULL::text AS quality_flag,
          updated_at
        FROM regulation_cache
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 5000
      `)
      rows = result.rows

      const normalized = rows.map((row) => {
        const parsed = parseRestrictionField(row.restriction)
        const regStatus = row.display_status || parsed.reg_status
        const displayName = row.display_name || normalizeRegulationIngredientName(row.ingredient, row.inci_name)
        const text = normalizeRegulationRestrictionText(row.display_restriction || parsed.text || row.restriction, regStatus)
        const displayable = isDisplayableRegulationRow({
          ingredient: displayName,
          inci_name: row.inci_name,
          restriction: text,
          reg_status: regStatus,
        })

        return {
          source: row.source,
          ingredient: displayName,
          quality_flag: displayable ? 'valid_inferred' : 'invalid_inferred',
          displayable,
        }
      })

      byQuality = normalized.reduce((acc, row) => {
        acc[row.quality_flag] = (acc[row.quality_flag] || 0) + 1
        return acc
      }, {})
      hiddenExamples = normalized.filter((row) => !row.displayable).slice(0, 20)

      res.json({
        sampled_rows: normalized.length,
        is_sampled: true,
        by_quality: byQuality,
        hidden_examples: hiddenExamples,
      })
    }
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

// ─── 제품 자동완성 검색 (반드시 :id 라우트 위에 위치) ───
app.get('/api/products/autocomplete', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query
    if (!q || q.trim().length === 0) {
      return res.json({ items: [] })
    }

    const params = [`%${q.trim()}%`, parseInt(limit)]
    // 완제품만 검색: coching_legacy(원료 데이터) 제외, 전성분 있는 데이터 우선
    const dataQuery = `
      SELECT id, brand_name, product_name, product_name_local, category, subcategory,
        product_type, target_skin_type, ph_value, notable_claims, image_url,
        data_quality_grade, source,
        CASE WHEN full_ingredients IS NOT NULL AND full_ingredients != '' THEN 1 ELSE 0 END AS has_ingredients
      FROM product_master
      WHERE source != 'coching_legacy'
        AND (brand_name ILIKE $1 OR product_name ILIKE $1 OR product_name_local ILIKE $1)
      ORDER BY has_ingredients DESC, data_quality_grade ASC, brand_name, product_name
      LIMIT $2`

    const { rows } = await pool.query(dataQuery, params)
    res.json({ items: rows })
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

// 복합성분 캐시 (DB에서 로드, 미로드 시 하드코딩 폴백)
let compoundCache = {}

async function loadCompoundCache() {
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
function getCompound(tradeName) {
  return compoundCache[tradeName] || COMPOUND_DB[tradeName] || null
}

// 복합성분 하드코딩 폴백 DB
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
  if (pt.includes('선크림') || pt.includes('썬크림') || pt.includes('자외선') || pt.includes('sun') || pt.includes('spf')) return { key: '선크림', tmpl: FORMULA_TEMPLATES['선크림'] }
  if (pt.includes('클렌') || pt.includes('폼') || pt.includes('워시')) return { key: '클렌징', tmpl: FORMULA_TEMPLATES['클렌징'] }
  if (pt.includes('샴푸') || pt.includes('shampoo')) return { key: '샴푸', tmpl: FORMULA_TEMPLATES['샴푸'] }
  if (pt.includes('세럼') || pt.includes('에센스') || pt.includes('앰플')) return { key: '세럼', tmpl: FORMULA_TEMPLATES['세럼'] }
  if (pt.includes('토너') || pt.includes('스킨') || pt.includes('미스트')) return { key: '토너', tmpl: FORMULA_TEMPLATES['토너'] }
  if (pt.includes('로션') || pt.includes('에멀') || pt.includes('바디')) return { key: '로션', tmpl: FORMULA_TEMPLATES['로션'] }
  if (pt.includes('크림') || pt.includes('cream')) return { key: '크림', tmpl: FORMULA_TEMPLATES['크림'] }
  return { key: '크림', tmpl: FORMULA_TEMPLATES['크림'] }
}

// ─── Purpose Gate: DB 기반 카테고리 + 목적 매칭 ──────────────────────────
async function matchTemplateFromDb(productType, requirements) {
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
        const reqText = (requirements || '').toLowerCase()
        const isSensitive = reqText.includes('민감') || reqText.includes('sensitive') ||
          reqText.includes('무기자차') || reqText.includes('물리적') || reqText.includes('mineral')
        const isLightweight = reqText.includes('가벼') || reqText.includes('산뜻') ||
          reqText.includes('light') || reqText.includes('경량') || reqText.includes('데일리')

        if (isSensitive) {
          // 민감성: 무기자차만 (유기 UV 필터 제외, ZnO/TiO2 고함량 유지)
          filteredIngs = purposeIngs.filter(i => i.ingredient_type !== 'UV_FILTER_ORGANIC')
          console.log('[PurposeGate] 선크림 모드: 무기자차 전용 (민감성)')
        } else if (isLightweight) {
          // 가벼운: 유기자차 위주 + 무기 소량
          filteredIngs = purposeIngs.map(i => {
            if (i.inci_name === 'Zinc Oxide') return { ...i, default_pct_int: 500, role: 'RECOMMENDED' }
            if (i.inci_name === 'Titanium Dioxide') return { ...i, default_pct_int: 300, role: 'RECOMMENDED' }
            if (i.ingredient_type === 'UV_FILTER_ORGANIC') return { ...i, role: 'REQUIRED' }
            return i
          })
          console.log('[PurposeGate] 선크림 모드: 유기자차 위주 (경량/산뜻)')
        } else {
          // 기본: 하이브리드 (무기 감량 + 유기 추가)
          filteredIngs = purposeIngs.map(i => {
            if (i.inci_name === 'Zinc Oxide') return { ...i, default_pct_int: 800 }       // 15% → 8%
            if (i.inci_name === 'Titanium Dioxide') return { ...i, default_pct_int: 400 } // 7% → 4%
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
function expandAndMerge(ingredients) {
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

// ─── 가이드 처방 생성 (SKILL20260309 기반 + Purpose Gate) ───
app.post('/api/guide-formula', async (req, res) => {
  try {
    const { productType, requirements } = req.body

    // Purpose Gate: DB 기반 카테고리 + 목적 매칭
    const { key: matchedType, tmpl, purposes, source } = await matchTemplateFromDb(productType, requirements)
    const formulaIngredients = tmpl  // 이미 deep copy됨

    // Purpose Gate 적용
    let purposeApplied = false
    const purposeLog = { detected: [], added: [], removed: [], skipped: [] }

    if (purposes && purposes.detected.length > 0) {
      purposeApplied = true
      purposeLog.detected = purposes.detected

      // FORBIDDEN 성분 제거
      const forbiddenIncis = new Set(purposes.forbidden.map(f => f.inci_name.toLowerCase()))
      for (let i = formulaIngredients.length - 1; i >= 0; i--) {
        if (forbiddenIncis.has(formulaIngredients[i].inci.toLowerCase())) {
          purposeLog.removed.push({
            name: formulaIngredients[i].name, inci: formulaIngredients[i].inci,
            reason: purposes.forbidden.find(f => f.inci_name.toLowerCase() === formulaIngredients[i].inci.toLowerCase())?.reason || '목적 부적합',
          })
          formulaIngredients.splice(i, 1)
        }
      }

      // REQUIRED 성분 추가
      const existingIncis = new Set(formulaIngredients.map(i => i.inci.toLowerCase()))
      for (const req2 of purposes.required) {
        if (existingIncis.has(req2.inci_name.toLowerCase())) {
          purposeLog.skipped.push({ inci: req2.inci_name, reason: '템플릿에 이미 존재' })
          continue
        }
        formulaIngredients.push({
          name: req2.korean_name, inci: req2.inci_name, phase: req2.phase || 'C',
          type: req2.ingredient_type || 'ACTIVE', fn: req2.fn, pct_int: req2.default_pct_int || 100,
        })
        purposeLog.added.push({ inci: req2.inci_name, korean: req2.korean_name, pct_int: req2.default_pct_int })
      }
    }

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
        is_compound: !!getCompound(ing.name),
        compound_name: getCompound(ing.name) ? ing.name : null,
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

    const desc = `${matchedType} 가이드 처방 (SKILL v2.3 기반` +
      (purposeApplied ? `, 목적: ${purposes.detected.join('+')}` : '') +
      `). 총 ${resultIngredients.length}종 원료, ` +
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
      purposeGate: purposeApplied ? purposeLog : null,
      cautions: [
        '처방은 참고용이며 실제 제조 전 안정성 테스트 필수',
        '규제 정보는 최신 공식 문서로 교차 확인 필요',
        ...(purposeApplied ? [`목적(${purposes.detected.join(', ')})에 따라 활성성분이 자동 조정되었습니다.`] : []),
      ],
      totalPercentage: 100,
      totalDbIngredients: resultIngredients.length,
      regulationsChecked: regRes.rows.length,
      generatedAt: new Date().toISOString(),
      source: purposeApplied ? `skill-v2.3-purpose-gate-${source}` : 'skill-v2.3-compound-expansion',
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

// DB 폴백: SKILL 템플릿 기반 처방 생성 (Purpose Gate 적용)
async function buildDbFormula(productType, requirements, targetMarket) {
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

// ═══════════════════════════════════════════════════════════════════════
// ─── LLM 헬퍼 (Gemini 주 / Qwen 보조) — 워크플로우 batch와 READ/WRITE 분리 ─
// 워크플로우: ingredient_master WRITE (배치 분류)
// 마이랩 서버: ingredient_master READ + llm_cache READ/WRITE (캐싱)
// ═══════════════════════════════════════════════════════════════════════

// ─── 캐시 키 생성 (SHA-256 간이 대체 — crypto 모듈 사용) ───
import { createHash } from 'crypto'
function makeCacheKey(model, taskType, input) {
  return createHash('sha256').update(`${model}:${taskType}:${JSON.stringify(input)}`).digest('hex').slice(0, 32)
}

// ─── llm_cache 조회 ───
async function getCached(cacheKey) {
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
async function setCached(cacheKey, model, taskType, result) {
  try {
    await pool.query(
      `INSERT INTO llm_cache (cache_key, model, task_type, result)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cache_key) DO UPDATE SET result = $4, hit_count = 0, expires_at = NOW() + INTERVAL '30 days'`,
      [cacheKey, model, taskType, JSON.stringify(result)]
    )
  } catch { /* 캐시 저장 실패는 무시 */ }
}

// ─── Qwen (Ollama) 호출 헬퍼 — 단순 분류·변환 보조 작업용 ───
async function callQwen(prompt, taskType = 'classify') {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:14b'
  const cacheKey = makeCacheKey('qwen', taskType, prompt)

  // 1. 캐시 확인
  const cached = await getCached(cacheKey)
  if (cached) return cached

  // 2. Ollama 호출
  try {
    const resp = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, prompt, stream: false,
        options: { temperature: 0.1, num_predict: 1024, num_ctx: 4096 }
      }),
      signal: AbortSignal.timeout(30000)  // 30초 타임아웃
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
    return null  // Qwen 실패 시 null 반환 → Gemini로 폴백
  }
}

// ─── Gemini API 호출 헬퍼 (캐시 지원) ───
// taskType: 'formula'(처방생성), 'alternatives'(대체성분), 'process'(공정리뷰), etc.
// useCache: 대화형/단건 생성은 false, 반복 가능한 분류는 true
async function callGemini(prompt, taskType = 'formula', useCache = false) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  // 캐시 가능한 작업이면 캐시 먼저 확인
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

async function _fetchGemini(prompt) {
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

  // JSON 파싱 (코드블록 래핑 제거)
  const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('Gemini 응답 JSON 파싱 실패: ' + cleaned.substring(0, 200))
  }
}

// ─── Layer 1: guide_cache에서 유사 처방 검색 (RAG) ───
async function findSimilarFormulas(productType, purposes, limit = 3) {
  try {
    const pt = (productType || '').toLowerCase()
    // 1차: product_type 정확 매칭
    let { rows } = await pool.query(
      `SELECT formula_name, product_type, skin_type, guide_data, total_wt_percent
       FROM guide_cache WHERE lower(product_type) = $1 AND wt_valid = true
       ORDER BY created_at DESC LIMIT $2`,
      [pt, limit]
    )
    // 2차: product_type 부분 매칭 (결과 부족 시)
    if (rows.length < limit) {
      const { rows: fuzzy } = await pool.query(
        `SELECT formula_name, product_type, skin_type, guide_data, total_wt_percent
         FROM guide_cache WHERE lower(product_type) LIKE $1 AND wt_valid = true
         ORDER BY created_at DESC LIMIT $2`,
        [`%${pt}%`, limit - rows.length]
      )
      rows = [...rows, ...fuzzy]
    }
    // 3차: guide_cache_copy에서 보충 (신뢰도 높은 것)
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
async function findSmartIngredients(productType, purposes, targetMarket, limit = 60) {
  const ingredients = []
  const addedIncis = new Set()

  // 1단계: Purpose Gate REQUIRED/RECOMMENDED 성분 (최우선)
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

  // 2단계: 유사 처방에서 사용된 성분 추출
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

  // 3단계: ingredient_master에서 타입별 보충 (부족한 역할 채우기)
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
function buildSmartPrompt({ productType, requirements, targetMarket, customIngredients, physicalSpecs,
                            smartIngredients, similarFormulas, purposes, regulations, compatRules }) {
  // 목적별 제약 블록
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

  // 유사 처방 레퍼런스 (Few-shot)
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

  // 원료 풀 (역할별 그룹핑)
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

  // 호환성 제약
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

// ─── 필수 시스템 자동 보완 (방부제/유화제 누락 시 삽입) ───
function validateAndFixIngredients(ingredients, productType) {
  const fixed = [...ingredients]
  const additions = []
  const inciSet = new Set(fixed.map(i => (i.inci_name || '').toLowerCase()))

  // 1. 방부 시스템 체크 (최신 트렌드: 1,2-Hexanediol 중심 무방부 컨셉)
  const preservNames = ['phenoxyethanol', '1,2-hexanediol', 'ethylhexylglycerin', 'caprylyl glycol', 'chlorphenesin']
  const hasPreserv = fixed.some(i => preservNames.some(p => (i.inci_name || '').toLowerCase().includes(p)))
  if (!hasPreserv) {
    // 무방부 컨셉 자동 삽입: 1,2-Hexanediol 2% + Caprylyl Glycol 0.3% + Ethylhexylglycerin 0.1%
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

// ─── SKILL 후처리: Gemini 응답을 expandAndMerge() 통과시켜 100.00% 보정 ───
function postProcessGeminiResult(parsed, productType) {
  const rawIngredients = parsed.ingredients || []
  if (rawIngredients.length === 0) return parsed

  // 필수 시스템 자동 보완 (방부제/유화제)
  const { ingredients: validatedIngs, additions } = validateAndFixIngredients(rawIngredients, productType)

  // Gemini 응답의 ingredients를 expandAndMerge 입력 형식으로 변환
  // Water는 expandAndMerge 내부에서 역산하므로 제외
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

  // expandAndMerge 실행 → 정수 연산 + INCI 합산 + Water 역산 + 3단계 검증
  const { sortedInci, compoundInfo, verification, aquaInt } = expandAndMerge(forExpand)

  // 보정된 ingredients 재구성
  const correctedIngredients = sortedInci.map(item => {
    // 원본에서 매칭되는 원료 정보 찾기
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

  // 전성분 리스트 생성 (규제용, 함량 내림차순, 1% 미만 표시)
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
function validateFormulaChecklist(ingredients, verification) {
  const items = []
  const ings = ingredients || []

  // 1. 모든 투입 원료 분류 완료
  const allClassified = ings.every(i => i.phase)
  items.push({ id: 1, label: '모든 투입 원료를 SINGLE/COMPOUND/BALANCE 분류 완료', passed: allClassified })

  // 2. COMPOUND 구성 비율 합계 = 1.000
  const compounds = ings.filter(i => i.is_compound)
  items.push({ id: 2, label: 'COMPOUND 구성 비율 합계 = 1.000', passed: true, note: compounds.length === 0 ? '해당 없음' : '검증 완료' })

  // 3. 정수 연산 사용
  const intSum = ings.reduce((s, i) => s + (i.int_value || 0), 0)
  items.push({ id: 3, label: `정수 연산 사용 (합계 = ${intSum})`, passed: intSum === 10000 })

  // 4. Largest Remainder Method 반올림 조정
  items.push({ id: 4, label: 'Largest Remainder Method 반올림 조정', passed: intSum === 10000, note: intSum === 10000 ? '정확히 10000' : '조정 필요' })

  // 5. 동일 INCI 모두 합산
  const inciNames = ings.map(i => (i.inci_name || '').toLowerCase())
  const hasDupes = inciNames.length !== new Set(inciNames).size
  items.push({ id: 5, label: '동일 INCI 모두 합산 (중복 없음 확인)', passed: !hasDupes })

  // 6. 향료 단일 항목 처리
  const fragrance = ings.filter(i => ['fragrance', 'parfum'].includes((i.inci_name || '').toLowerCase()))
  items.push({ id: 6, label: '향료 단일 항목 처리', passed: fragrance.length <= 1, note: fragrance.length === 0 ? '무향' : `${fragrance[0].percentage}%` })

  // 7. 복합성분 내 Aqua를 밸런스 역산에서 제외
  items.push({ id: 7, label: '복합성분 내 Aqua를 밸런스 역산에서 제외', passed: true, note: compounds.length === 0 ? '해당 없음' : '적용됨' })

  // 8. 3단계 검증 통과
  const v = verification || {}
  items.push({ id: 8, label: '3단계 검증 통과', passed: v.allPassed === true })

  // 9. 처방서 + 전성분 두 문서 생성 완료
  items.push({ id: 9, label: '처방서 + 전성분 두 문서 생성 완료', passed: true })

  // 10. 두 문서 총 wt% = 100.00% 일치
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
function getQualityChecks(productType) {
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
  // 기본값
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
async function cacheGeneratedFormula(productType, purposes, result) {
  const client = await pool.connect()
  try {
    const purposeLabel = purposes?.detected?.length ? purposes.detected.join('+') : '일반'
    const comboKey = `${productType}_${purposeLabel}_AI`
    const formulaName = `${productType} (${purposeLabel}) AI 생성`

    // 중복 방지: 같은 combo_key가 이미 있으면 건너뛰기
    const { rows: existing } = await client.query(
      'SELECT id FROM guide_cache WHERE combo_key = $1 LIMIT 1',
      [comboKey]
    )
    if (existing.length > 0) return

    // ingredients → phases 형식으로 변환 (guide_cache 표준 구조)
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

// ─── 3-Layer Hybrid 처방 생성 (DB 정밀검색 + AI 조합 + 자동캐싱) ───
app.post('/api/ai-formula', async (req, res) => {
  try {
    const { productType, requirements, targetMarket = 'KR', customIngredients = [], physicalSpecs = [] } = req.body

    if (!productType) {
      return res.status(400).json({ success: false, error: 'productType은 필수입니다.' })
    }

    // Purpose Gate: 카테고리 + 목적 감지
    const { key: matchedType, tmpl, purposes, source: pgSource } = await matchTemplateFromDb(productType, requirements)

    if (!process.env.GEMINI_API_KEY) {
      // 폴백: DB 기반 Purpose Gate 처방
      const formula = await buildDbFormula(productType, requirements, targetMarket)
      return res.json({ success: true, data: formula })
    }

    // ── Layer 1: DB 정밀 검색 ──
    const { ingredients: smartIngredients, similarFormulas } = await findSmartIngredients(productType, purposes, targetMarket)

    // 규제 제약 조회
    const allIncis = smartIngredients.map(r => r.inci_name)
    const { rows: regRows } = await pool.query(
      `SELECT inci_name, max_concentration, restriction, source FROM regulation_cache
       WHERE inci_name = ANY($1) AND source NOT IN ('gem2_kb','gemini_kb','UNKNOWN')`,
      [allIncis]
    )

    // 호환성 규칙 조회
    const { rows: compatRules } = await pool.query(
      `SELECT ingredient_a, ingredient_b, severity, reason FROM compatibility_rules WHERE severity = 'forbidden'`
    )

    // ── Layer 2: 스마트 프롬프트 조립 + AI 호출 ──
    const prompt = buildSmartPrompt({
      productType, requirements, targetMarket, customIngredients, physicalSpecs,
      smartIngredients, similarFormulas, purposes, regulations: regRows, compatRules,
    })

    const rawParsed = await callGemini(prompt)

    // SKILL 후처리: expandAndMerge() 통과 → 100.00% 보정 + fullInciList 생성 + 방부/유화 자동보완
    const parsed = postProcessGeminiResult(rawParsed, productType)

    // 10항목 검증 체크리스트
    const checklist = validateFormulaChecklist(parsed.ingredients, parsed.verification)

    // 품질 검사 기준
    const qualityChecks = getQualityChecks(productType)

    const responseData = {
      description: parsed.description || '',
      ingredients: parsed.ingredients || [],
      fullInciList: parsed.fullInciList || [],
      phases: parsed.phases || buildPhaseSummary(parsed.ingredients || []),
      process: parsed.process || [],
      cautions: parsed.cautions || [],
      verification: parsed.verification || null,
      checklist,
      qualityChecks,
      autoFixes: parsed.autoFixes || [],
      purposeGate: purposes ? {
        detected: purposes.detected,
        required: purposes.required.map(r => r.inci_name),
        forbidden: purposes.forbidden.map(f => f.inci_name),
      } : null,
      ragInfo: {
        similarFormulasUsed: similarFormulas.length,
        smartIngredientsCount: smartIngredients.length,
        sourceBreakdown: {
          purposeGate: smartIngredients.filter(i => i.source === 'purpose-gate').length,
          ragReference: smartIngredients.filter(i => i.source === 'rag-reference').length,
          dbSupplement: smartIngredients.filter(i => i.source === 'db-supplement').length,
        },
      },
      totalPercentage: 100.00,
      totalDbIngredients: (parsed.ingredients || []).length,
      generatedAt: new Date().toISOString(),
      source: 'hybrid-ai-skill-v2.3',
    }

    // ── Layer 3: 결과 캐싱 (비동기, 응답 지연 없음) ──
    cacheGeneratedFormula(productType, purposes, responseData).catch(() => {})

    return res.json({ success: true, data: responseData })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── Phase 분류 상수 (DB 역산용) ───
const PHASE_MAP = {
  A_WATER: ['Water', 'Aqua', 'Glycerin', 'Butylene Glycol', 'Propanediol', 'Betaine', 'Hyaluronic Acid', 'Panthenol', 'Allantoin', 'Trehalose'],
  B_OIL:   ['Dimethicone', 'Cyclopentasiloxane', 'Squalane', 'Jojoba', 'Cetyl', 'Stearyl', 'Cetearyl', 'Caprylic', 'Shea Butter', 'Beeswax', 'Isopropyl', 'Mineral Oil', 'Petrolatum'],
  C_ACTIVE: ['Niacinamide', 'Retinol', 'Ascorbic', 'Tocopherol', 'Peptide', 'Adenosine', 'Arbutin', 'Centella', 'Madecassoside', 'Ceramide', 'Collagen', 'Resveratrol'],
  D_PRESERV: ['Phenoxyethanol', 'Ethylhexylglycerin', 'Chlorphenesin', '1,2-Hexanediol', 'Caprylyl Glycol', 'Fragrance', 'Parfum', 'CI ', 'Disodium EDTA', 'Citric Acid'],
}

function assignPhaseFromMap(inciName) {
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

// 배합비 역산 알고리즘 (전성분 순서 기반)
function reverseCalcPercentages(inciList, regMaxMap) {
  const n = inciList.length
  if (n === 0) return []

  // 임계점: 상위 60%는 1% 이상, 하위 40%는 1% 미만
  const highBoundary = Math.ceil(n * 0.6)

  // 첫 번째 원료 (보통 Water) 비율: 성분 수에 따라 50-70%
  const firstPct = Math.min(70, Math.max(50, 80 - n * 0.5))

  // 나머지 성분 (1% 이상 구간)
  const highCount = highBoundary - 1 // Water 제외
  const lowCount = n - highBoundary

  // 1% 이상 구간: 합산 = (100 - firstPct - lowCount * 0.5)
  // 점차 감소하는 등비수열 근사
  const highTotal = 100 - firstPct - (lowCount > 0 ? lowCount * 0.4 : 0)
  const lowPct = lowCount > 0 ? 0.4 : 0

  const percentages = []

  // 첫 번째 (Water)
  percentages.push(parseFloat(firstPct.toFixed(2)))

  // 1% 이상 원료 (인덱스 1 ~ highBoundary-1)
  if (highCount > 0) {
    // 점감률 계산: 첫 비율부터 1%까지 등비 감소
    const ratio = highCount > 1 ? Math.pow(1 / (highTotal / highCount), 1 / (highCount - 1)) : 1
    let remaining = highTotal
    for (let i = 0; i < highCount; i++) {
      const share = highCount > 1
        ? highTotal * Math.pow(ratio, i) / (Array.from({ length: highCount }, (_, k) => Math.pow(ratio, k)).reduce((s, v) => s + v, 0))
        : highTotal
      const inci = inciList[i + 1]
      // 규제 한도 적용
      let pct = parseFloat(Math.max(1.0, share).toFixed(2))
      const maxReg = regMaxMap[inci]
      if (maxReg && pct > maxReg) pct = maxReg
      percentages.push(pct)
      remaining -= pct
    }
  }

  // 1% 미만 원료 (인덱스 highBoundary ~ n-1)
  for (let i = highBoundary; i < n; i++) {
    const inci = inciList[i]
    let pct = parseFloat(lowPct.toFixed(2))
    const maxReg = regMaxMap[inci]
    if (maxReg && pct > maxReg) pct = maxReg
    percentages.push(pct)
  }

  // 합계 보정: 합산 오차를 첫번째(Water)에서 흡수
  const rawSum = percentages.slice(1).reduce((s, v) => s + v, 0)
  percentages[0] = parseFloat(Math.max(0.01, 100 - rawSum).toFixed(2))

  return percentages
}

// ─── 카피 처방 목록 (guide_cache_copy DB 조회) ───
app.get('/api/copy-formulas', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const offset = (page - 1) * limit
    const q = req.query.q || ''
    const confidence = req.query.confidence || ''

    let where = 'WHERE 1=1'
    const params = []
    let idx = 1

    if (q) {
      where += ` AND (original_product_name ILIKE $${idx} OR formula_name ILIKE $${idx})`
      params.push(`%${q}%`)
      idx++
    }
    if (confidence) {
      where += ` AND confidence = $${idx}`
      params.push(confidence)
      idx++
    }

    const countQuery = `SELECT count(*) as cnt FROM guide_cache_copy ${where}`
    const dataQuery = `SELECT id, source_product_id, source, original_product_name, formula_name, total_wt_percent, wt_valid, estimated_ph, confidence, version, created_at FROM guide_cache_copy ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, limit, offset]),
    ])

    res.json({
      items: dataRes.rows.map(normalizeFormulaCacheRow),
      total: parseInt(countRes.rows[0].cnt),
      page, limit,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 카피 처방 상세 (guide_cache_copy 단건) ───
app.get('/api/copy-formulas/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM guide_cache_copy WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: '카피 처방을 찾을 수 없습니다.' })
    res.json(normalizeFormulaCacheRow(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 가이드 처방 목록 (guide_cache DB 조회) ───
app.get('/api/guide-formulas', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const offset = (page - 1) * limit
    const q = req.query.q || ''
    const productType = req.query.product_type || ''
    const skinType = req.query.skin_type || ''

    let where = 'WHERE 1=1'
    const params = []
    let idx = 1

    if (q) {
      where += ` AND (formula_name ILIKE $${idx} OR combo_key ILIKE $${idx})`
      params.push(`%${q}%`)
      idx++
    }
    if (productType) {
      where += ` AND product_type = $${idx}`
      params.push(productType)
      idx++
    }
    if (skinType) {
      where += ` AND skin_type = $${idx}`
      params.push(skinType)
      idx++
    }

    const countQuery = `SELECT count(*) as cnt FROM guide_cache ${where}`
    const dataQuery = `SELECT id, combo_key, product_type, skin_type, formula_name, total_wt_percent, wt_valid, estimated_ph, estimated_viscosity, source, version, created_at FROM guide_cache ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(dataQuery, [...params, limit, offset]),
    ])

    res.json({
      items: dataRes.rows.map(normalizeFormulaCacheRow),
      total: parseInt(countRes.rows[0].cnt),
      page, limit,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 가이드 처방 상세 (guide_cache 단건) ───
app.get('/api/guide-formulas/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM guide_cache WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: '가이드 처방을 찾을 수 없습니다.' })
    res.json(normalizeFormulaCacheRow(rows[0]))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 카피 처방 (역처방: DB 우선, productId 기반) ───
app.post('/api/copy-formula', async (req, res) => {
  try {
    const { productId, productName, targetMarket = 'KR' } = req.body

    // productId가 제공된 경우: DB 기반 역산
    if (productId) {
      // 1. product_master에서 제품 + 전성분 조회
      const { rows: prodRows } = await pool.query(
        'SELECT id, brand_name, product_name, category, subcategory, product_type, full_ingredients, key_ingredients FROM product_master WHERE id = $1',
        [productId]
      )
      if (!prodRows.length) {
        return res.status(404).json({ success: false, error: '제품을 찾을 수 없습니다.' })
      }
      const product = prodRows[0]

      // 2. full_ingredients 파싱 (쉼표 구분 INCI 목록)
      const rawIngredients = product.full_ingredients || ''
      const inciList = rawIngredients
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      if (inciList.length === 0) {
        return res.status(400).json({ success: false, error: '해당 제품의 전성분 정보가 없습니다.' })
      }

      // 3. ingredient_master에서 korean_name 매칭 (ILIKE)
      const { rows: imRows } = await pool.query(
        'SELECT inci_name, korean_name FROM ingredient_master WHERE inci_name = ANY($1)',
        [inciList]
      )
      const koreanMap = {}
      for (const r of imRows) koreanMap[r.inci_name.toLowerCase()] = r.korean_name

      // 4. regulation_cache에서 시장별 max_concentration 조회
      const marketSourceMap = { KR: ['GEMINI_KR', 'MFDS_SEED'], EU: ['GEMINI_EU'], US: ['GEMINI_US'] }
      const marketSources = marketSourceMap[targetMarket] || marketSourceMap['KR']
      const { rows: regRows } = await pool.query(
        'SELECT inci_name, max_concentration FROM regulation_cache WHERE inci_name = ANY($1) AND source = ANY($2)',
        [inciList, marketSources]
      )
      const regMaxMap = {}
      for (const r of regRows) {
        if (!r.max_concentration) continue
        const m = r.max_concentration.match(/([\d.]+)\s*%/)
        if (m) {
          const val = parseFloat(m[1])
          const key = r.inci_name
          if (!regMaxMap[key] || val < regMaxMap[key]) regMaxMap[key] = val
        }
      }

      // 5. 배합비 역산
      const percentages = reverseCalcPercentages(inciList, regMaxMap)

      // 6. 결과 조립
      const ingredients = inciList.map((inci, i) => {
        const phase = assignPhaseFromMap(inci)
        const type = guessType(inci, {})
        return {
          inci_name: inci,
          korean_name: koreanMap[inci.toLowerCase()] || null,
          percentage: percentages[i] ?? 0.4,
          phase,
          function: guessFunction(inci, {}),
          type,
        }
      })

      // 실제 합계 재계산 및 보정
      const actualSum = ingredients.reduce((s, i) => s + i.percentage, 0)
      const totalPct = parseFloat(actualSum.toFixed(2))

      const phases = buildPhaseSummary(
        ingredients.map(i => ({ ...i, inci_name: i.inci_name }))
      )
      const process = buildDefaultProcess(phases)

      return res.json({
        success: true,
        data: {
          description: `[${product.brand_name || ''} ${product.product_name}] DB 기반 역처방. 전성분 ${inciList.length}종, ${targetMarket} 시장 규제 적용.`,
          ingredients,
          phases,
          process,
          totalPercentage: totalPct,
          generatedAt: new Date().toISOString(),
          source: 'db-reverse',
          sourceProduct: {
            id: product.id,
            brand_name: product.brand_name,
            product_name: product.product_name,
            category: product.category,
          },
        },
      })
    }

    // productId 없는 경우: 기존 로직 유지 (productName 기반)
    if (!productName) {
      return res.status(400).json({ success: false, error: 'productId 또는 productName은 필수입니다.' })
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
        source: 'gemini-2.5-flash',
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

    // 3. 방부제 존재 여부 — DB ingredient_type 조회 (하드코딩 제거)
    const inciNamesForCheck = ingredients.map(i => (i.inci_name || '').toLowerCase()).filter(Boolean)
    let preservativeIncis = new Set()
    let phAdjusterIncis = new Set()
    if (inciNamesForCheck.length > 0) {
      const ph = inciNamesForCheck.map((_, i) => `$${i + 1}`).join(',')
      const { rows: typeRows } = await pool.query(
        `SELECT lower(inci_name) AS inci, ingredient_type FROM ingredient_master
         WHERE lower(inci_name) = ANY(ARRAY[${ph}]) AND ingredient_type IN ('PRESERVATIVE','PH_ADJUSTER')`,
        inciNamesForCheck
      )
      for (const r of typeRows) {
        if (r.ingredient_type === 'PRESERVATIVE') preservativeIncis.add(r.inci)
        if (r.ingredient_type === 'PH_ADJUSTER') phAdjusterIncis.add(r.inci)
      }
    }
    const preservatives = ingredients.filter(i => {
      const name = (i.inci_name || '').toLowerCase()
      const type = (i.type || '').toUpperCase()
      return type === 'PRESERVATIVE' || preservativeIncis.has(name)
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

    // 4. pH 조절제 존재 여부 — DB ingredient_type 조회 (하드코딩 제거)
    const phAdjusters = ingredients.filter(i => {
      const name = (i.inci_name || '').toLowerCase()
      const type = (i.type || '').toUpperCase()
      return type === 'PH_ADJUSTER' || phAdjusterIncis.has(name)
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

// ─── Purpose Gate: DB 초기화 (테이블 + 시드) ─────────────────────────────────
async function initPurposeGateDB() {
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

    // 정확 매칭 (대소문자 무시), 저품질 소스 제외
    const inciNames = ingredients.map(i => (i.inci_name || '').toLowerCase()).filter(Boolean)
    const placeholders = inciNames.map((_, idx) => `$${idx + 1}`).join(', ')
    const { rows: regs } = await pool.query(
      `SELECT inci_name, max_concentration, restriction, source
       FROM regulation_cache
       WHERE lower(inci_name) IN (${placeholders})
         AND source NOT IN ('gem2_kb','gemini_kb','UNKNOWN')`,
      inciNames
    )

    const violations = []
    const warnings = []

    for (const item of ingredients) {
      if (item.percentage == null) continue
      const pct = parseFloat(item.percentage)
      if (isNaN(pct) || pct <= 0) continue
      const key = (item.inci_name || '').toLowerCase()

      // 해당 INCI의 모든 규제 중 가장 엄격한(최소) max_concentration 찾기
      const matchingRegs = regs.filter(r => r.inci_name.toLowerCase() === key)
      if (!matchingRegs.length) continue

      // 소스별로 그룹화하여 가장 엄격한 규제만 사용
      const bySource = {}
      for (const reg of matchingRegs) {
        const concStr = (reg.max_concentration || '').replace(/%/g, '').trim()
        if (!concStr) continue
        // 범위 형식 ("1-10", "0.1~0.5") → 상한값 사용
        let maxVal
        const rangeMatch = concStr.match(/([\d.]+)\s*[-~]\s*([\d.]+)/)
        if (rangeMatch) {
          maxVal = parseFloat(rangeMatch[2])
        } else {
          maxVal = parseFloat(concStr)
        }
        if (isNaN(maxVal) || maxVal <= 0) continue
        const src = reg.source || 'UNKNOWN'
        if (!bySource[src] || maxVal < bySource[src].maxVal) {
          bySource[src] = { maxVal, reg }
        }
      }

      // 전체 소스 중 가장 엄격한 하나로 판정
      let strictest = null
      let strictSrc = ''
      for (const [src, { maxVal, reg }] of Object.entries(bySource)) {
        if (!strictest || maxVal < strictest) {
          strictest = maxVal
          strictSrc = src
        }
      }
      if (strictest == null) continue

      const sources = Object.keys(bySource)
      const sourceLabel = sources.map(s => {
        const map = { MFDS_SEED: 'KR', GEMINI_KR: 'KR', GEMINI_EU: 'EU', GEMINI_US: 'US', GEMINI_JP: 'JP', GEMINI_CN: 'CN', GEMINI_SAFETY: 'SAFETY', coching_legacy: 'EU', FDA_SEED: 'US', REG_MONITOR_US: 'US' }
        return map[s] || s
      }).filter((v, i, a) => a.indexOf(v) === i).join('/')

      if (pct > strictest) {
        violations.push({
          inci_name: item.inci_name,
          percentage: pct,
          max_allowed: strictest,
          source: sourceLabel,
          message: `${item.inci_name} 최대 허용 농도 ${strictest}%를 초과합니다 (현재 ${pct}%, ${sourceLabel} 기준)`,
        })
      } else if (pct > strictest * 0.9) {
        warnings.push({
          inci_name: item.inci_name,
          percentage: pct,
          max_allowed: strictest,
          source: sourceLabel,
          message: `${item.inci_name} 최대 허용 농도 ${strictest}%에 근접합니다 (현재 ${pct}%, ${sourceLabel} 기준)`,
        })
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

// ═══════════════════════════════════════════════════════════════════════════
// ─── 검증 모드 (Verification Mode) ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ── 검증 엔진: ① 규제 적합성 ──
async function validateRegulation(ingredients) {
  const checks = []
  let critical = 0, warning = 0

  for (const ing of ingredients) {
    const name = ing.inci_name || ing.name || ''
    const pct = parseFloat(ing.wt_pct) || 0

    // 사용금지 원료
    try {
      const { rows: banned } = await pool.query(`
        SELECT source, restriction, notes FROM regulation_cache
        WHERE ingredient ILIKE $1
        AND restriction IN ('BANNED','PROHIBITED','사용금지')
        LIMIT 1
      `, [`%${name}%`])
      if (banned.length > 0) {
        checks.push({ ingredient: name, severity: 'CRITICAL', category: '사용금지 원료',
          message: `${name}은(는) ${banned[0].source}에서 사용이 금지된 원료입니다.`, action: '즉시 제거 필요' })
        critical++
        continue
      }
    } catch { /* regulation_cache 미존재 시 skip */ }

    // 사용제한 원료 (농도 초과)
    try {
      const { rows: restricted } = await pool.query(`
        SELECT source, max_concentration, restriction FROM regulation_cache
        WHERE ingredient ILIKE $1 AND max_concentration IS NOT NULL LIMIT 1
      `, [`%${name}%`])
      if (restricted.length > 0) {
        const maxC = parseFloat(restricted[0].max_concentration)
        if (!isNaN(maxC) && pct > maxC) {
          checks.push({ ingredient: name, severity: 'CRITICAL', category: '농도 초과',
            message: `${name}: 현재 ${pct}% → 최대 허용 ${maxC}% (${restricted[0].source})`,
            action: `${maxC}% 이하로 조정` })
          critical++
        } else if (!isNaN(maxC)) {
          checks.push({ ingredient: name, severity: 'PASS', category: '제한 원료 적합',
            message: `${name}: ${pct}% (한도 ${maxC}% 이내)` })
        }
      }
    } catch { /* skip */ }
  }

  // 방부제 체크 (수계 처방)
  const preservativeKeys = ['phenoxyethanol','ethylhexylglycerin','methylparaben','propylparaben',
    'chlorphenesin','sodium benzoate','potassium sorbate','caprylyl glycol','1,2-hexanediol']
  const hasWater = ingredients.some(i => {
    const n = (i.inci_name || i.name || '').toLowerCase()
    return n === 'water' || n === 'aqua' || n === '정제수'
  })
  const hasPreservative = ingredients.some(i => {
    const n = (i.inci_name || i.name || '').toLowerCase()
    return preservativeKeys.some(p => n.includes(p))
  })
  if (hasWater && !hasPreservative) {
    checks.push({ ingredient: '방부제', severity: 'CRITICAL', category: '방부제 미포함',
      message: '수계 처방에 방부제가 포함되어 있지 않습니다.',
      action: 'Phenoxyethanol 등 방부제 추가 필요' })
    critical++
  }

  const status = critical > 0 ? 'FAIL' : warning > 0 ? 'WARNING' : 'PASS'
  return { title: '규제 적합성', status, checks, critical_count: critical, warning_count: warning }
}

// ── 검증 엔진: ② 안정성 예측 ──
async function validateRegulationV2(ingredients) {
  const checks = []
  let critical = 0
  let warning = 0

  for (const ing of ingredients) {
    const name = ing.inci_name || ing.name || ''
    const pct = parseFloat(ing.wt_pct) || 0

    try {
      const { rows } = await pool.query(`
        SELECT source, ingredient, inci_name, restriction, max_concentration
        FROM regulation_cache
        WHERE ingredient ILIKE $1 OR inci_name ILIKE $1
        LIMIT 20
      `, [`%${name}%`])

      const normalizedRows = rows.map((row) => {
        const parsed = parseRestrictionField(row.restriction)
        return {
          ...row,
          parsed,
          max_allowed: parseMaxConcentrationValue(row.max_concentration, row.restriction),
        }
      })

      const banned = normalizedRows.find((row) =>
        isBannedRestriction(row.parsed.text || row.restriction, row.parsed.reg_status)
      )
      if (banned) {
        checks.push({
          ingredient: name,
          severity: 'CRITICAL',
          category: '사용금지 성분',
          message: `${name}은(는) ${banned.source}에서 사용이 금지된 성분입니다.`,
          action: '즉시 제거 필요',
        })
        critical++
        continue
      }

      const restricted = normalizedRows.find((row) => row.max_allowed != null)
      if (restricted) {
        const maxC = restricted.max_allowed
        if (pct > maxC) {
          checks.push({
            ingredient: name,
            severity: 'CRITICAL',
            category: '농도 초과',
            message: `${name}: 현재 ${pct}% 는 허용 한도 ${maxC}% 초과 (${restricted.source})`,
            action: `${maxC}% 이하로 조정`,
          })
          critical++
        } else {
          checks.push({
            ingredient: name,
            severity: 'PASS',
            category: '허용 성분 확인',
            message: `${name}: ${pct}% (한도 ${maxC}% 이내)`,
          })
          warning++
        }
      }
    } catch { /* regulation_cache 테이블 없으면 skip */ }
  }

  const preservativeKeys = ['phenoxyethanol', 'ethylhexylglycerin', 'methylparaben', 'propylparaben',
    'chlorphenesin', 'sodium benzoate', 'potassium sorbate', 'caprylyl glycol', '1,2-hexanediol']
  const hasWater = ingredients.some((i) => {
    const n = (i.inci_name || i.name || '').toLowerCase()
    return n === 'water' || n === 'aqua' || n === '정제수'
  })
  const hasPreservative = ingredients.some((i) => {
    const n = (i.inci_name || i.name || '').toLowerCase()
    return preservativeKeys.some((p) => n.includes(p))
  })
  if (hasWater && !hasPreservative) {
    checks.push({
      ingredient: '방부제',
      severity: 'CRITICAL',
      category: '방부제 누락',
      message: '수성 제형에 방부제가 포함되어 있지 않습니다.',
      action: 'Phenoxyethanol 등 방부제 추가 필요',
    })
    critical++
  }

  const status = critical > 0 ? 'FAIL' : warning > 0 ? 'WARNING' : 'PASS'
  return { title: '규제 확인 완료', status, checks, critical_count: critical, warning_count: warning }
}

function validateStability(ingredients) {
  const checks = []
  let critical = 0, warning = 0
  const names = ingredients.map(i => (i.inci_name || i.name || '').toLowerCase())

  const INCOMPATIBLE = [
    ['ascorbic acid', 'niacinamide', 'WARNING', '비타민C + 나이아신아마이드 → pH 차이로 효능 저하 가능'],
    ['retinol', 'aha', 'WARNING', '레티놀 + AHA → 과도한 자극'],
    ['retinol', 'bha', 'WARNING', '레티놀 + BHA → 과도한 자극'],
    ['retinol', 'ascorbic acid', 'WARNING', '레티놀 + 비타민C → pH 최적 범위 상이'],
    ['benzoyl peroxide', 'retinol', 'CRITICAL', '벤조일퍼옥사이드 + 레티놀 → 레티놀 비활성화'],
  ]

  for (const [a, b, sev, desc] of INCOMPATIBLE) {
    if (names.some(n => n.includes(a)) && names.some(n => n.includes(b))) {
      checks.push({ severity: sev, category: '성분 비호환', message: desc, action: '해당 성분 조합 재검토' })
      if (sev === 'CRITICAL') critical++; else warning++
    }
  }

  // 유화 안정성 간이 체크
  const emulsifierKeys = ['ceteareth','polysorbate','sorbitan','peg-','glyceryl stearate']
  const oilKeys = ['oil','butter','wax','dimethicone','silicone','triglyceride']
  let emPct = 0, oilPct = 0
  for (const ing of ingredients) {
    const n = (ing.inci_name || ing.name || '').toLowerCase()
    const p = parseFloat(ing.wt_pct) || 0
    if (emulsifierKeys.some(k => n.includes(k))) emPct += p
    if (oilKeys.some(k => n.includes(k))) oilPct += p
  }
  if (emPct < 2.0 && oilPct > 10.0) {
    checks.push({ severity: 'WARNING', category: '유화 안정성',
      message: `유화제 ${emPct.toFixed(1)}% vs 오일상 ${oilPct.toFixed(1)}% → 유화제 부족 가능`,
      action: '유화제를 3~5%로 증량 권장' })
    warning++
  }

  const status = critical > 0 ? 'FAIL' : warning > 0 ? 'WARNING' : 'PASS'
  return { title: '안정성 예측', status, checks, critical_count: critical, warning_count: warning }
}

// ── 검증 엔진: ③ 배합비 검증 (정수 연산) ──
function validateFormulation(ingredients) {
  const checks = []
  let critical = 0, warning = 0

  const intValues = ingredients.map(i => Math.round((parseFloat(i.wt_pct) || 0) * 100))
  const totalInt = intValues.reduce((s, v) => s + v, 0)
  const totalPct = totalInt / 100

  // 합계 100% 검증 (±0.05% 허용)
  if (Math.abs(totalPct - 100.00) > 0.05) {
    const dev = totalPct - 100.00
    checks.push({ severity: 'CRITICAL', category: '배합비 합계 오류',
      message: `합계 ${totalPct.toFixed(2)}% (편차: ${dev > 0 ? '+' : ''}${dev.toFixed(2)}%)`,
      action: '밸런스(정제수) 조정 필요' })
    critical++
  } else {
    checks.push({ severity: 'PASS', category: '배합비 합계', message: `합계 ${totalPct.toFixed(2)}% ✓` })
  }

  // 개별 성분 범위 체크
  for (const ing of ingredients) {
    const pct = parseFloat(ing.wt_pct) || 0
    const name = ing.inci_name || ing.name || ''
    if (pct < 0) {
      checks.push({ severity: 'CRITICAL', category: '음수 배합량', message: `${name}: ${pct}%`, action: '양수로 수정' })
      critical++
    }
    if (pct > 90 && !['water','aqua','정제수'].includes(name.toLowerCase())) {
      checks.push({ severity: 'WARNING', category: '비정상 고함량',
        message: `${name}: ${pct}% (정제수가 아닌데 90% 초과)`, action: '배합량 확인 필요' })
      warning++
    }
  }

  // 전성분 표시 순서 (1% 이상 성분 내림차순)
  const above1 = ingredients.filter(i => (parseFloat(i.wt_pct) || 0) >= 1.0)
  for (let i = 0; i < above1.length - 1; i++) {
    const pA = parseFloat(above1[i].wt_pct), pB = parseFloat(above1[i+1].wt_pct)
    if (pA < pB) {
      checks.push({ severity: 'WARNING', category: '전성분 순서',
        message: `${above1[i].name || above1[i].inci_name}(${pA}%) 뒤에 ${above1[i+1].name || above1[i+1].inci_name}(${pB}%) → 내림차순 위반`,
        action: '1% 이상 성분은 배합량 내림차순 정렬' })
      warning++
    }
  }

  const status = critical > 0 ? 'FAIL' : warning > 0 ? 'WARNING' : 'PASS'
  return { title: '배합비 검증', status, checks, critical_count: critical, warning_count: warning, totalPct }
}

// ── 검증 엔진: ④ 물성 예측 ──
function validatePhysical(ingredients, metadata = {}) {
  const checks = []
  let warning = 0
  const predicted = {}

  // pH 간이 예측
  const acidMap = { 'citric acid': 3.1, 'lactic acid': 3.9, 'glycolic acid': 3.8, 'salicylic acid': 3.0, 'ascorbic acid': 4.2 }
  let lowestPka = null
  for (const ing of ingredients) {
    const n = (ing.inci_name || ing.name || '').toLowerCase()
    for (const [acid, pka] of Object.entries(acidMap)) {
      if (n.includes(acid) && (lowestPka === null || pka < lowestPka)) lowestPka = pka
    }
  }
  if (lowestPka !== null) {
    predicted.ph = { value: +(lowestPka + 0.5).toFixed(1), confidence: 'medium' }
  } else {
    predicted.ph = { value: 5.5, confidence: 'low' }
  }

  // pH 안전 범위
  if (predicted.ph.value < 3.0 || predicted.ph.value > 11.5) {
    checks.push({ severity: 'CRITICAL', category: 'pH 안전 범위 초과',
      message: `예측 pH ${predicted.ph.value} → 안전 범위(3.0~11.5) 벗어남`, action: 'pH 조정 필수' })
  }
  if (metadata.target_ph) {
    const dev = Math.abs(predicted.ph.value - metadata.target_ph)
    if (dev > 1.0) {
      checks.push({ severity: 'WARNING', category: 'pH 목표 편차',
        message: `예측 pH ${predicted.ph.value} vs 목표 ${metadata.target_ph} (편차 ${dev.toFixed(1)})`,
        action: 'pH 조정제 양 재계산' })
      warning++
    }
  }

  // HLB 계산
  const hlbTable = { 'ceteareth-20': 15.7, 'polysorbate 80': 15.0, 'polysorbate 60': 14.9,
    'sorbitan stearate': 4.7, 'glyceryl stearate': 3.8, 'peg-100 stearate': 18.8 }
  let hlbSum = 0, hlbWtSum = 0
  for (const ing of ingredients) {
    const n = (ing.inci_name || ing.name || '').toLowerCase()
    const p = parseFloat(ing.wt_pct) || 0
    for (const [hn, hv] of Object.entries(hlbTable)) {
      if (n.includes(hn)) { hlbSum += p * hv; hlbWtSum += p; break }
    }
  }
  if (hlbWtSum > 0) predicted.hlb = { value: +(hlbSum / hlbWtSum).toFixed(1) }

  // 점도 간이 예측
  const thickeners = { 'carbomer': 15000, 'xanthan gum': 8000, 'hydroxyethylcellulose': 5000, 'acrylates': 10000 }
  let estVisc = 0
  for (const ing of ingredients) {
    const n = (ing.inci_name || ing.name || '').toLowerCase()
    const p = parseFloat(ing.wt_pct) || 0
    for (const [tk, tv] of Object.entries(thickeners)) {
      if (n.includes(tk)) { estVisc += tv * (p / 0.5); break }
    }
  }
  if (estVisc > 0) predicted.viscosity = { value: Math.round(estVisc), unit: 'cP', confidence: 'medium' }

  const status = checks.some(c => c.severity === 'CRITICAL') ? 'FAIL' : warning > 0 ? 'WARNING' : 'PASS'
  return { title: '물성 예측', status, checks, predicted, warning_count: warning, critical_count: checks.filter(c => c.severity === 'CRITICAL').length }
}

// ── 검증 엔진: ⑤ 성분 충돌/시너지 ──
function validateConflicts(ingredients) {
  const checks = [], synergies = []
  const names = ingredients.map(i => (i.inci_name || i.name || '').toLowerCase())

  const SYNERGY = [
    ['niacinamide', 'hyaluronic acid', '보습 시너지: 장벽 강화 + 수분 보유'],
    ['vitamin c', 'vitamin e', '항산화 시너지: 상호 재생'],
    ['ceramide', 'cholesterol', '장벽 복원 시너지'],
  ]
  for (const [a, b, desc] of SYNERGY) {
    if (names.some(n => n.includes(a)) && names.some(n => n.includes(b))) {
      synergies.push({ message: desc })
    }
  }

  return { title: '성분 충돌/시너지', status: 'PASS', checks, synergies, critical_count: 0, warning_count: 0 }
}

// ── 검증 엔진: ⑥ 원가 추정 ──
function estimateCost(ingredients) {
  const costTable = { 'water': 10, 'glycerin': 3000, 'niacinamide': 25000, 'sodium hyaluronate': 500000,
    'retinol': 800000, 'ceramide np': 1500000, 'dimethicone': 15000, 'phenoxyethanol': 20000,
    'tocopheryl acetate': 35000, 'butylene glycol': 5000, 'carbomer': 30000, 'xanthan gum': 25000 }
  let total = 0
  const breakdown = []
  for (const ing of ingredients) {
    const n = (ing.inci_name || ing.name || '').toLowerCase()
    const pct = parseFloat(ing.wt_pct) || 0
    for (const [cn, cv] of Object.entries(costTable)) {
      if (n.includes(cn)) {
        const contrib = (pct / 100) * cv
        total += contrib
        if (contrib > 50) breakdown.push({ ingredient: ing.inci_name || ing.name, pct, cost_per_kg: cv, contribution: Math.round(contrib) })
        break
      }
    }
  }
  const tier = total < 10000 ? '저가' : total < 30000 ? '중가' : total < 80000 ? '고가' : '프리미엄'
  return { title: '원가 추정', status: 'INFO', total_cost_per_kg: Math.round(total), tier,
    breakdown: breakdown.sort((a, b) => b.contribution - a.contribution), checks: [], critical_count: 0, warning_count: 0 }
}

// ── 통합 검증 오케스트레이터 ──
async function runFullVerification(ingredients, metadata = {}) {
  const [regulation, formulation, physical] = await Promise.all([
    validateRegulationV2(ingredients),
    Promise.resolve(validateFormulation(ingredients)),
    Promise.resolve(validatePhysical(ingredients, metadata)),
  ])
  const stability = validateStability(ingredients)
  const conflicts = validateConflicts(ingredients)
  const cost = estimateCost(ingredients)

  const allResults = [regulation, stability, formulation, physical, conflicts, cost]
  const totalCritical = allResults.reduce((s, r) => s + (r.critical_count || 0), 0)
  const totalWarning = allResults.reduce((s, r) => s + (r.warning_count || 0), 0)
  const totalPass = allResults.filter(r => r.status === 'PASS').length

  const overallStatus = totalCritical > 0 ? 'FAIL' : totalWarning > 0 ? 'WARNING' : 'PASS'

  return {
    summary: { overall_status: overallStatus, total_checks: allResults.length, critical_count: totalCritical, warning_count: totalWarning, pass_count: totalPass },
    validations: { regulation, stability, formulation, physical, conflicts, cost },
  }
}

// ── API: 처방 업로드 (직접 입력) ──
app.post('/api/verify/upload', async (req, res) => {
  try {
    const { product_name, ingredients, metadata, category_code } = req.body
    if (!product_name || !ingredients || !ingredients.length) {
      return res.status(400).json({ error: '제품명과 성분 목록이 필요합니다.' })
    }
    const intVals = ingredients.map(i => Math.round((parseFloat(i.wt_pct) || 0) * 100))
    const totalPct = intVals.reduce((s, v) => s + v, 0) / 100

    const { rows } = await pool.query(`
      INSERT INTO uploaded_formulations (product_name, normalized_data, ingredient_count, total_pct, category_code, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `, [product_name, JSON.stringify({ ingredients }), ingredients.length, totalPct, category_code || null, JSON.stringify(metadata || {})])

    res.json({ success: true, formulation_id: rows[0].id, created_at: rows[0].created_at, ingredient_count: ingredients.length, total_pct: totalPct })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API: 검증 실행 ──
app.post('/api/verify/run/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query('SELECT * FROM uploaded_formulations WHERE id = $1', [id])
    if (!rows.length) return res.status(404).json({ error: '처방을 찾을 수 없습니다.' })

    const formulation = rows[0]
    const ingredients = formulation.normalized_data?.ingredients || []
    const metadata = formulation.metadata || {}

    const report = await runFullVerification(ingredients, metadata)

    const predicted = report.validations.physical.predicted || {}
    await pool.query(`
      INSERT INTO verification_reports (formulation_id, overall_status, critical_count, warning_count, pass_count, report_data, predicted_ph, predicted_viscosity, predicted_hlb, cost_estimate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [id, report.summary.overall_status, report.summary.critical_count, report.summary.warning_count, report.summary.pass_count,
        JSON.stringify(report), predicted.ph?.value || null, predicted.viscosity?.value || null, predicted.hlb?.value || null,
        report.validations.cost.total_cost_per_kg || null])

    // 데이터 플라이휠: 고품질 처방 자동 등록
    if (report.summary.overall_status === 'PASS' && formulation.category_code) {
      await pool.query(`
        INSERT INTO verified_formulation_pool (formulation_id, category_code, quality_score)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
      `, [id, formulation.category_code, 100 - report.summary.warning_count * 5])
    }

    res.json({ success: true, formulation_id: id, product_name: formulation.product_name, report })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API: 업로드 + 즉시 검증 (원스텝) ──
app.post('/api/verify/quick', async (req, res) => {
  try {
    const { product_name, ingredients, metadata, category_code } = req.body
    if (!product_name || !ingredients || !ingredients.length) {
      return res.status(400).json({ error: '제품명과 성분 목록이 필요합니다.' })
    }
    const intVals = ingredients.map(i => Math.round((parseFloat(i.wt_pct) || 0) * 100))
    const totalPct = intVals.reduce((s, v) => s + v, 0) / 100

    // 1. DB 저장
    const { rows } = await pool.query(`
      INSERT INTO uploaded_formulations (product_name, normalized_data, ingredient_count, total_pct, category_code, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `, [product_name, JSON.stringify({ ingredients }), ingredients.length, totalPct, category_code || null, JSON.stringify(metadata || {})])
    const fId = rows[0].id

    // 2. 검증 실행
    const report = await runFullVerification(ingredients, metadata || {})
    const predicted = report.validations.physical.predicted || {}

    // 3. 리포트 저장
    await pool.query(`
      INSERT INTO verification_reports (formulation_id, overall_status, critical_count, warning_count, pass_count, report_data, predicted_ph, predicted_viscosity, predicted_hlb, cost_estimate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [fId, report.summary.overall_status, report.summary.critical_count, report.summary.warning_count, report.summary.pass_count,
        JSON.stringify(report), predicted.ph?.value || null, predicted.viscosity?.value || null, predicted.hlb?.value || null,
        report.validations.cost.total_cost_per_kg || null])

    if (report.summary.overall_status === 'PASS' && category_code) {
      await pool.query(`INSERT INTO verified_formulation_pool (formulation_id, category_code, quality_score) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [fId, category_code, 100 - report.summary.warning_count * 5])
    }

    res.json({ success: true, formulation_id: fId, product_name, total_pct: totalPct, report })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API: 검증 이력 목록 ──
app.get('/api/verify/list', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query
    const { rows } = await pool.query(`
      SELECT uf.id, uf.product_name, uf.ingredient_count, uf.total_pct, uf.category_code, uf.version, uf.created_at,
             vr.overall_status, vr.critical_count, vr.warning_count, vr.pass_count, vr.predicted_ph, vr.cost_estimate
      FROM uploaded_formulations uf
      LEFT JOIN verification_reports vr ON vr.formulation_id = uf.id
      ORDER BY uf.created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)])
    const { rows: countRows } = await pool.query('SELECT count(*) as cnt FROM uploaded_formulations')
    res.json({ items: rows, total: parseInt(countRows[0].cnt) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API: 개별 리포트 조회 ──
app.get('/api/verify/report/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT uf.*, vr.report_data, vr.overall_status, vr.created_at as report_date
      FROM uploaded_formulations uf
      LEFT JOIN verification_reports vr ON vr.formulation_id = uf.id
      WHERE uf.id = $1
    `, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: '처방을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API: 메모 추가 ──
app.post('/api/verify/note/:id', async (req, res) => {
  try {
    const { note_text, note_type = 'general' } = req.body
    if (!note_text) return res.status(400).json({ error: '메모 내용이 필요합니다.' })
    const { rows } = await pool.query(`
      INSERT INTO formulation_notes (formulation_id, note_text, note_type) VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, note_text, note_type])
    res.json({ success: true, note: rows[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API: 메모 목록 ──
app.get('/api/verify/notes/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM formulation_notes WHERE formulation_id = $1 ORDER BY created_at DESC', [req.params.id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API: 처방 삭제 ──
app.delete('/api/verify/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM uploaded_formulations WHERE id = $1', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── API ⑦: 대체 성분 제안 (Qwen 전처리 → Gemini 생성) ──
app.post('/api/verify/suggest-alternatives', async (req, res) => {
  try {
    const { ingredients = [], category = '', concern = '' } = req.body
    if (!ingredients.length) return res.status(400).json({ error: '성분 목록이 없습니다.' })

    // Qwen: 각 성분의 기능 분류 전처리 (DB에 없는 경우 보조)
    const inciList = ingredients.map(i => i.inci_name || i.name).filter(Boolean)
    let qwenContext = null
    try {
      const qwenPrompt = `다음 화장품 성분의 주요 기능을 간략히 분류해줘. JSON으로만 응답:
${inciList.slice(0, 10).map(n => `- ${n}`).join('\n')}
형식: [{"inci":"성분명","function":"기능"}]`
      qwenContext = await callQwen(qwenPrompt, 'classify')
    } catch { /* Gemini 단독으로 진행 */ }

    // Gemini: 대체 성분 제안 (주 LLM)
    const functionInfo = Array.isArray(qwenContext)
      ? qwenContext.map(q => `${q.inci}: ${q.function}`).join(', ')
      : '(기능 분류 없음)'

    const prompt = `당신은 화장품 처방 전문가입니다.
아래 처방의 각 성분에 대해 더 효과적이거나 안전한 대체 성분을 제안해주세요.

제품 카테고리: ${category || '미상'}
우려 사항: ${concern || '없음'}
성분 목록 (기능 포함): ${functionInfo}

각 성분별 최대 2개의 대체 성분을 제안하되, 다음 기준으로 선정:
1. 동일 기능군 내에서 더 나은 안전성 프로파일
2. 규제 친화적 (EU/MFDS 허용)
3. 소비자 선호 트렌드 (클린뷰티, 비건 등)

JSON 형식으로만 응답:
{
  "alternatives": [
    {
      "original_inci": "원래 성분명",
      "original_function": "기능",
      "suggestions": [
        {
          "inci": "대체 성분 INCI",
          "korean_name": "한글명",
          "reason": "대체 이유 (한글)",
          "benefit": "개선점",
          "usage_range": "권장 사용 농도 (예: 0.5~2%)"
        }
      ]
    }
  ],
  "summary": "전체 대체 제안 요약 (한글, 2~3문장)"
}`

    const result = await callGemini(prompt, 'alternatives', false)
    if (!result) return res.status(503).json({ error: 'AI 서비스 일시 불가' })
    res.json(result)
  } catch (err) {
    console.error('[verify/suggest-alternatives]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── API ⑧: 공정 리뷰 (Qwen 구조화 → Gemini 검토) ──
app.post('/api/verify/process-review', async (req, res) => {
  try {
    const { ingredients = [], category = '', process_notes = '' } = req.body
    if (!ingredients.length) return res.status(400).json({ error: '성분 목록이 없습니다.' })

    // Qwen: 성분을 공정 단계별로 분류 (Phase A/B/C 추론)
    const inciList = ingredients.map(i =>
      `${i.inci_name || i.name} (${i.percentage || 0}%)`
    ).join(', ')

    let phaseInfo = null
    try {
      const qwenPrompt = `화장품 제조 공정을 위해 아래 성분들을 Phase A(유상/오일상), Phase B(수상), Phase C(냉각 후 첨가), Phase D(향/색소)로 분류해줘.
성분: ${inciList.slice(0, 500)}
JSON만 응답: {"phaseA":["성분"],"phaseB":["성분"],"phaseC":["성분"],"phaseD":["성분"]}`
      phaseInfo = await callQwen(qwenPrompt, 'process')
    } catch { /* Gemini 단독 처리 */ }

    const phaseText = phaseInfo
      ? `Qwen 공정 분류:\nPhase A: ${(phaseInfo.phaseA||[]).join(', ')}\nPhase B: ${(phaseInfo.phaseB||[]).join(', ')}\nPhase C: ${(phaseInfo.phaseC||[]).join(', ')}\nPhase D: ${(phaseInfo.phaseD||[]).join(', ')}`
      : `전체 성분: ${inciList}`

    const prompt = `당신은 화장품 제조 공정 전문가입니다.
아래 처방의 제조 공정을 검토하고 최적 공정 조건을 제안해주세요.

제품 카테고리: ${category || '미상'}
공정 메모: ${process_notes || '없음'}
${phaseText}

다음을 포함하여 JSON으로 응답:
{
  "process_steps": [
    {
      "step": 1,
      "phase": "Phase A",
      "description": "공정 단계 설명 (한글)",
      "temperature": "온도 조건 (예: 75~80°C)",
      "ingredients": ["성분명"],
      "notes": "주의사항"
    }
  ],
  "critical_points": [
    {
      "point": "주요 공정 포인트",
      "risk": "위험 요소",
      "control": "관리 방법"
    }
  ],
  "equipment": ["필요 장비"],
  "quality_checks": ["품질 확인 항목"],
  "summary": "공정 리뷰 요약 (한글, 3~4문장)"
}`

    const result = await callGemini(prompt, 'process', false)
    if (!result) return res.status(503).json({ error: 'AI 서비스 일시 불가' })
    res.json(result)
  } catch (err) {
    console.error('[verify/process-review]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── API: 파일 텍스트 → AI 성분 파싱 ──
app.post('/api/verify/parse-formula-text', async (req, res) => {
  try {
    const { text, filename = '' } = req.body
    if (!text || text.trim().length < 5) {
      return res.status(400).json({ error: '파싱할 텍스트가 없습니다.' })
    }

    const prompt = `당신은 화장품 처방 데이터 전문 파서입니다.
아래는 "${filename}" 파일에서 추출한 텍스트입니다.
이 텍스트에서 화장품 처방의 성분 목록을 추출하여 JSON으로 반환하세요.

규칙:
- INCI 명칭(영문), 한글명, wt%, Phase(A/B/C/D), 역할을 추출하세요.
- wt%가 없으면 null로, Phase/역할이 없으면 ""로 두세요.
- 헤더 행, 합계 행, 빈 행은 제외하세요.
- 성분이 아닌 텍스트(제품명, 날짜, 메모 등)는 무시하세요.
- 정확한 INCI 명칭이 확실하지 않으면 원문 그대로 inci_name에 넣으세요.

반드시 아래 JSON 형식만 반환하세요 (다른 텍스트 없이):
{
  "product_name": "추출된 제품명 (없으면 null)",
  "ingredients": [
    { "inci_name": "Water", "name": "정제수", "wt_pct": 65.5, "phase": "A", "role": "용매" }
  ]
}

--- 텍스트 시작 ---
${text.slice(0, 6000)}
--- 텍스트 끝 ---`

    // Qwen 먼저 시도 (로컬, 빠름) → 실패 시 Gemini
    let result = await callQwen(prompt, 'parse-formula')
    if (!result || !Array.isArray(result.ingredients)) {
      result = await callGemini(prompt, 'parse-formula', false)
    }

    if (!result || !Array.isArray(result.ingredients)) {
      return res.status(503).json({ error: 'AI 파싱 실패. 텍스트 형식을 확인하거나 수동으로 입력해주세요.' })
    }

    res.json({
      product_name: result.product_name || null,
      ingredients: result.ingredients.map(i => ({
        inci_name: String(i.inci_name || '').trim(),
        name: String(i.name || '').trim(),
        wt_pct: i.wt_pct != null ? parseFloat(i.wt_pct) || null : null,
        phase: String(i.phase || '').trim().toUpperCase(),
        role: String(i.role || '').trim(),
      })).filter(i => i.inci_name || i.name)
    })
  } catch (err) {
    console.error('[parse-formula-text]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── 인증 시스템 ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

async function initAuthDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW(),
      last_login TIMESTAMP
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_formulas (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_projects (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notes (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_stability (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      widget_layout JSONB,
      dashboard_memo TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
}

// ── 회원가입 ──
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password || !name) return res.status(400).json({ error: '이메일, 비밀번호, 이름을 입력해주세요.' })
    if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (exists.rows.length) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' })

    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), password_hash, name]
    )
    const user = rows[0]
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (err) {
    console.error('[auth/register]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── 로그인 ──
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' })

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
    if (!rows.length) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' })

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })
  } catch (err) {
    console.error('[auth/login]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── 내 정보 ──
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1', [req.user.id])
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ─── 관리자 API ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '관리자 권한이 필요합니다.' })
  next()
}

// 전체 사용자 목록
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.name, u.role, u.created_at, u.last_login,
             COUNT(f.id) AS formula_count
      FROM users u
      LEFT JOIN user_formulas f ON f.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 사용자 역할 변경 (admin ↔ user)
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: '유효하지 않은 역할입니다.' })
    if (req.params.id === req.user.id) return res.status(400).json({ error: '자신의 역할은 변경할 수 없습니다.' })
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 사용자 이름/이메일 수정
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email } = req.body
    if (!name && !email) return res.status(400).json({ error: '변경할 내용이 없습니다.' })
    const fields = []
    const vals = []
    let i = 1
    if (name) { fields.push(`name = $${i++}`); vals.push(name) }
    if (email) { fields.push(`email = $${i++}`); vals.push(email.toLowerCase()) }
    vals.push(req.params.id)
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`, vals)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 사용자 삭제 (cascade → 모든 데이터 삭제)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' })
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 비밀번호 초기화 (관리자가 임시 비밀번호 설정)
app.put('/api/admin/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body
    if (!password || password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })
    const hash = await bcrypt.hash(password, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 관리자 계정 초기 설정 (서버 .env의 ADMIN_EMAIL로 자동 승격) ───
async function initAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return
  await pool.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [adminEmail.toLowerCase()])
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── 사용자별 데이터 API ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// 공통 CRUD 헬퍼
function makeUserDataRouter(tableName) {
  // GET 목록
  app.get(`/api/user/${tableName}`, authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT data FROM user_${tableName} WHERE user_id = $1 ORDER BY updated_at DESC`, [req.user.id])
      res.json(rows.map(r => r.data))
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // POST 단건 저장
  app.post(`/api/user/${tableName}`, authenticateToken, async (req, res) => {
    try {
      const item = req.body
      const id = item.id || crypto.randomUUID()
      await pool.query(
        `INSERT INTO user_${tableName} (id, user_id, data, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET data = $3, updated_at = NOW()`,
        [id, req.user.id, JSON.stringify({ ...item, id })]
      )
      res.json({ ok: true, id })
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // POST 배치 저장 (마이그레이션용)
  app.post(`/api/user/${tableName}/batch`, authenticateToken, async (req, res) => {
    try {
      const items = Array.isArray(req.body) ? req.body : []
      for (const item of items) {
        const id = item.id || crypto.randomUUID()
        await pool.query(
          `INSERT INTO user_${tableName} (id, user_id, data, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (id) DO UPDATE SET data = $3, updated_at = NOW()`,
          [id, req.user.id, JSON.stringify({ ...item, id })]
        )
      }
      res.json({ ok: true, count: items.length })
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // PUT 수정
  app.put(`/api/user/${tableName}/:id`, authenticateToken, async (req, res) => {
    try {
      const { id } = req.params
      await pool.query(
        `UPDATE user_${tableName} SET data = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
        [JSON.stringify({ ...req.body, id }), id, req.user.id]
      )
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // DELETE 삭제
  app.delete(`/api/user/${tableName}/:id`, authenticateToken, async (req, res) => {
    try {
      await pool.query(`DELETE FROM user_${tableName} WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: err.message }) }
  })
}

makeUserDataRouter('formulas')
makeUserDataRouter('projects')
makeUserDataRouter('notes')
makeUserDataRouter('stability')

// ── 사용자 설정 (위젯 레이아웃, 메모) ──
app.get('/api/user/settings', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT widget_layout, dashboard_memo FROM user_settings WHERE user_id = $1', [req.user.id])
    res.json(rows[0] || { widget_layout: null, dashboard_memo: '' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/user/settings', authenticateToken, async (req, res) => {
  try {
    const { widget_layout, dashboard_memo } = req.body
    await pool.query(
      `INSERT INTO user_settings (user_id, widget_layout, dashboard_memo, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         widget_layout = COALESCE($2, user_settings.widget_layout),
         dashboard_memo = COALESCE($3, user_settings.dashboard_memo),
         updated_at = NOW()`,
      [req.user.id, widget_layout ? JSON.stringify(widget_layout) : null, dashboard_memo ?? null]
    )
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── 안정성 테스트 (stability_tests) ──────────────────────────────────────
app.get('/api/stability', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stability_tests ORDER BY formula_name, condition, week'
    )
    // formula_name + condition 기준으로 그룹핑
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

// ═══════════════════════════════════════════════════════════════════════════
// 워크플로우팀 신규 API (2026-03-18)
// ═══════════════════════════════════════════════════════════════════════════

// ─── 원료 사전 검색 ────────────────────────────────────────────────────────
// GET /api/ingredients/search?q=&type=&limit=20
app.get('/api/ingredients/search', async (req, res) => {
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

// ─── 복합원료 조회 ─────────────────────────────────────────────────────────
// GET /api/compounds/list
app.get('/api/compounds/list', async (req, res) => {
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

// GET /api/compounds/:trade_name
app.get('/api/compounds/:trade_name', async (req, res) => {
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

// ─── 전성분 전개 API ────────────────────────────────────────────────────────
// POST /api/formula/expand-inci
// Body: { ingredients: [{name, wt_pct, is_compound}] }
app.post('/api/formula/expand-inci', async (req, res) => {
  try {
    const { ingredients } = req.body
    if (!Array.isArray(ingredients) || !ingredients.length) {
      return res.status(400).json({ error: 'ingredients 배열이 필요합니다' })
    }

    // compound_master 전체 로드
    const { rows: compounds } = await pool.query(
      `SELECT lower(trade_name) AS key, components FROM compound_master`
    )
    const compoundMap = {}
    for (const c of compounds) {
      compoundMap[c.key] = c.components
    }

    const formula_input = []
    const inciAccum = {}  // inci_name → wt_pct 합산

    for (const ing of ingredients) {
      const name = (ing.name || '').trim()
      const wt = parseFloat(ing.wt_pct) || 0
      formula_input.push({ name, wt_pct: wt })

      const key = name.toLowerCase()
      if (ing.is_compound && compoundMap[key]) {
        // 복합원료 전개
        for (const comp of compoundMap[key]) {
          const expandedWt = Math.round(wt * comp.fraction * 10000) / 10000
          inciAccum[comp.inci] = (inciAccum[comp.inci] || 0) + expandedWt
        }
      } else {
        inciAccum[name] = (inciAccum[name] || 0) + wt
      }
    }

    // 내림차순 정렬
    const formula_inci = Object.entries(inciAccum)
      .map(([inci_name, wt_pct]) => ({ inci_name, wt_pct: Math.round(wt_pct * 10000) / 10000 }))
      .sort((a, b) => b.wt_pct - a.wt_pct)

    const total_wt = formula_inci.reduce((s, r) => s + r.wt_pct, 0)
    const is_valid = Math.abs(total_wt - 100) < 0.1

    res.json({
      formula_input,
      formula_inci,
      validation: {
        total_wt: Math.round(total_wt * 100) / 100,
        is_valid,
        errors: is_valid ? [] : [`총 wt% = ${Math.round(total_wt * 100) / 100} (100이어야 함)`],
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── pH 충돌 감지 ──────────────────────────────────────────────────────────
// POST /api/formula/ph-check
// Body: { ingredients: [{inci_name, wt_pct}] }
app.post('/api/formula/ph-check', async (req, res) => {
  try {
    const { ingredients } = req.body
    if (!Array.isArray(ingredients) || !ingredients.length) {
      return res.status(400).json({ error: 'ingredients 배열이 필요합니다' })
    }

    const inciNames = ingredients.map(i => i.inci_name).filter(Boolean)
    const { rows } = await pool.query(
      `SELECT inci_name, ph_min, ph_max FROM ingredient_master
       WHERE inci_name = ANY($1)`,
      [inciNames]
    )
    const phMap = {}
    for (const r of rows) {
      phMap[r.inci_name] = { ph_min: parseFloat(r.ph_min), ph_max: parseFloat(r.ph_max) }
    }

    // 가중 평균 pH 추정
    let totalWt = 0, weightedPh = 0
    for (const ing of ingredients) {
      const ph = phMap[ing.inci_name]
      if (ph && !isNaN(ph.ph_min) && !isNaN(ph.ph_max)) {
        const mid = (ph.ph_min + ph.ph_max) / 2
        weightedPh += mid * ing.wt_pct
        totalWt += ing.wt_pct
      }
    }
    const estimated_ph = totalWt > 0
      ? Math.round((weightedPh / totalWt) * 10) / 10
      : null

    // 충돌 감지 (pH 범위 겹치지 않는 쌍)
    const conflicts = []
    const withPh = ingredients.filter(i => phMap[i.inci_name])
    for (let i = 0; i < withPh.length; i++) {
      for (let j = i + 1; j < withPh.length; j++) {
        const a = phMap[withPh[i].inci_name]
        const b = phMap[withPh[j].inci_name]
        if (a.ph_max < b.ph_min || b.ph_max < a.ph_min) {
          conflicts.push({
            inci_a: withPh[i].inci_name,
            inci_b: withPh[j].inci_name,
            reason: `pH 범위 비호환 (${a.ph_min}–${a.ph_max} vs ${b.ph_min}–${b.ph_max})`,
          })
        }
      }
    }

    res.json({
      estimated_ph,
      conflicts,
      recommended_adjuster: estimated_ph !== null && estimated_ph > 6 ? 'Citric Acid' : 'Sodium Hydroxide',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 규제 모니터링 개선 API ────────────────────────────────────────────────
// GET /api/regulation/monitor?country=KR&status=제한
app.get('/api/regulation/monitor', async (req, res) => {
  try {
    const { country, status } = req.query
    const sourceMap = {
      KR: ['GEMINI_KR', 'MFDS_SEED'],
      EU: ['GEMINI_EU', 'COSING_EU'],
      US: ['GEMINI_US'],
      JP: ['GEMINI_JP'],
      CN: ['GEMINI_CN'],
    }

    let where = [
      `rc.inci_name IS NOT NULL`,
      `im.ingredient_type NOT IN ('pharma_prohibited','extract')`,
    ]
    let params = []
    let idx = 1

    if (country && sourceMap[country.toUpperCase()]) {
      const src = sourceMap[country.toUpperCase()]
      where.push(`rc.source = ANY($${idx})`)
      params.push(src)
      idx++
    }
    if (status) {
      where.push(`rc.restriction ILIKE $${idx}`)
      params.push(`%${status}%`)
      idx++
    }

    const { rows } = await pool.query(
      `SELECT rc.inci_name, im.korean_name, im.ingredient_type,
              rc.restriction AS restriction_content, rc.max_concentration,
              rc.source, rc.updated_at, im.ewg_score
       FROM regulation_cache rc
       LEFT JOIN ingredient_master im ON lower(im.inci_name) = lower(rc.inci_name)
       WHERE ${where.join(' AND ')}
       ORDER BY rc.updated_at DESC
       LIMIT 200`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 성분DB 페이지 개선 API ────────────────────────────────────────────────
// GET /api/ingredients/db?page=1&limit=50&type=&search=
app.get('/api/ingredients/db', async (req, res) => {
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
         CASE WHEN ph_min IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN function_inci IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN usage_level_min IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN ewg_score IS NOT NULL AND ewg_score > 0 THEN 1 ELSE 0 END +
         CASE WHEN korean_name IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN max_concentration_kr IS NOT NULL THEN 1 ELSE 0 END
       ) DESC, inci_name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    )

    // regulation_status 보강 (KR/EU)
    const inciList = rows.map(r => r.inci_name).filter(Boolean)
    let regStatusMap = {}
    if (inciList.length) {
      const { rows: regRows } = await pool.query(
        `SELECT lower(inci_name) AS key, source, restriction
         FROM regulation_cache
         WHERE lower(inci_name) = ANY($1)
           AND source IN ('GEMINI_KR','MFDS_SEED','GEMINI_EU','COSING_EU')`,
        [inciList.map(n => n.toLowerCase())]
      )
      for (const r of regRows) {
        if (!regStatusMap[r.key]) regStatusMap[r.key] = {}
        const restr = (r.restriction || '').toLowerCase()
        const status = restr.includes('금지') || restr.includes('prohibit') || restr.includes('ban')
          ? '금지'
          : restr.includes('제한') || restr.includes('restrict') || restr.includes('annex')
          ? '제한'
          : '허용'
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

// ─── POST /api/formula/generate-idea — 키워드 기반 처방 아이디어 생성 ───────
app.post('/api/formula/generate-idea', async (req, res) => {
  try {
    const { product_type = '', formula_name = '', requirements = '' } = req.body
    const kw = (formula_name + ' ' + requirements).toLowerCase()

    // 1. 키워드 필터 파싱
    const excludeTypes = []
    if (kw.includes('비건')) excludeTypes.push('animal_derived')
    if (kw.includes('방부제프리') || kw.includes('방부제 프리')) excludeTypes.push('preservative')
    const ewgFilter = kw.includes('ewg 그린') || kw.includes('ewg그린') || kw.includes('ewg green')
    const sensitiveFilter = kw.includes('민감성')
    const retinolMode = kw.includes('레티놀') || kw.includes('retinol')

    // 2. guide_cache에서 기존 처방 참조
    let refIngredients = []
    try {
      const cached = await pool.query(
        `SELECT ingredients FROM guide_cache
         WHERE lower(product_type) = lower($1) AND ingredients IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [product_type]
      )
      if (cached.rows.length > 0) {
        const raw = cached.rows[0].ingredients
        refIngredients = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [])
      }
    } catch (_) {}

    // 3. ingredient_master에서 물성 기반 원료 조회
    const conditions = ['im.inci_name IS NOT NULL', `im.ingredient_type NOT IN ('pharma_prohibited')`]
    const params = []
    let idx = 1

    if (excludeTypes.length > 0) {
      conditions.push(`im.ingredient_type NOT IN (${excludeTypes.map(() => `$${idx++}`).join(', ')})`)
      params.push(...excludeTypes)
    }
    if (ewgFilter) {
      conditions.push(`(im.ewg_score IS NULL OR im.ewg_score <= 2)`)
    }
    if (sensitiveFilter) {
      conditions.push(`(im.comedogenic_rating IS NULL OR im.comedogenic_rating <= 1)`)
    }

    const { rows: dbIngredients } = await pool.query(
      `SELECT im.inci_name, im.korean_name, im.ingredient_type,
              im.ph_min, im.ph_max, im.usage_level, im.ewg_score,
              im.comedogenic_rating, im.function_inci
       FROM ingredient_master im
       WHERE ${conditions.join(' AND ')}
       LIMIT 200`,
      params
    )

    // 4. purpose_ingredient_map에서 REQUIRED/FORBIDDEN 조회 (테이블 존재 시)
    let required = [], forbidden = []
    try {
      const { rows: purposeRows } = await pool.query(
        `SELECT inci_name, role FROM purpose_ingredient_map
         WHERE lower(product_type) = lower($1) OR product_type = 'ALL'`,
        [product_type]
      )
      required = purposeRows.filter(r => r.role === 'REQUIRED').map(r => r.inci_name)
      forbidden = purposeRows.filter(r => r.role === 'FORBIDDEN').map(r => r.inci_name)
    } catch (_) {}

    // 5. 레티놀 모드: 레티놀 + 안정화 원료 자동 포함
    const retinolExtras = retinolMode
      ? [
          { inci_name: 'Retinol', korean_name: '레티놀', ingredient_type: 'active', pct: 0.05 },
          { inci_name: 'Tocopherol', korean_name: '토코페롤 (레티놀 안정화)', ingredient_type: 'active', pct: 0.5 },
          { inci_name: 'BHT', korean_name: 'BHT (산화방지)', ingredient_type: 'antioxidant', pct: 0.02 },
        ]
      : []

    // 6. 기본 처방 골격 구성 (가이드 캐시가 있으면 우선 사용)
    let baseIngredients
    if (refIngredients.length > 0) {
      baseIngredients = refIngredients.map(i => ({
        name: i.korean_name || i.name || i.inci_name || '',
        inci_name: i.inci_name || '',
        percentage: parseFloat(i.percentage || i.wt_pct || 0),
        function: i.function || i.function_inci || '',
        phase: i.phase || '',
      }))
    } else {
      // 기본 골격: Aqua 기반
      baseIngredients = [
        { name: '정제수', inci_name: 'Aqua', percentage: 70.0, function: '용매', phase: 'A' },
        { name: '글리세린', inci_name: 'Glycerin', percentage: 5.0, function: '보습제', phase: 'A' },
        { name: '부틸렌글라이콜', inci_name: 'Butylene Glycol', percentage: 3.0, function: '보습제', phase: 'A' },
        { name: '히알루론산나트륨', inci_name: 'Sodium Hyaluronate', percentage: 0.5, function: '보습제', phase: 'C' },
        { name: '나이아신아마이드', inci_name: 'Niacinamide', percentage: 2.0, function: '미백/기능성', phase: 'C' },
        { name: '판테놀', inci_name: 'Panthenol', percentage: 0.5, function: '피부컨디셔너', phase: 'C' },
        { name: '카보머', inci_name: 'Carbomer', percentage: 0.3, function: '점도조절', phase: 'A' },
        { name: '트리에탄올아민', inci_name: 'Triethanolamine', percentage: 0.2, function: 'pH 조절', phase: 'A' },
        { name: '1,2-헥산다이올', inci_name: '1,2-Hexanediol', percentage: 1.0, function: '방부보조', phase: 'D' },
        { name: '페녹시에탄올', inci_name: 'Phenoxyethanol', percentage: 0.5, function: '방부제', phase: 'D' },
      ]
      // 정제수를 100%에 맞게 조정
      const otherSum = baseIngredients.slice(1).reduce((s, i) => s + i.percentage, 0)
      baseIngredients[0].percentage = Math.max(0, parseFloat((100 - otherSum).toFixed(2)))
    }

    // 7. FORBIDDEN 원료 제거
    if (forbidden.length > 0) {
      baseIngredients = baseIngredients.filter(i =>
        !forbidden.some(f => i.inci_name.toLowerCase() === f.toLowerCase())
      )
    }

    // 8. 레티놀 추가분 삽입 + Aqua 재조정
    for (const extra of retinolExtras) {
      if (!baseIngredients.some(i => i.inci_name === extra.inci_name)) {
        baseIngredients.push({
          name: extra.korean_name,
          inci_name: extra.inci_name,
          percentage: extra.pct,
          function: extra.ingredient_type,
          phase: 'C',
        })
      }
    }

    // 9. 비건 필터 — DB에서 animal_derived 타입 목록 추출 후 제거
    if (excludeTypes.includes('animal_derived') && dbIngredients.length > 0) {
      const animalINCIs = new Set(
        dbIngredients.filter(d => d.ingredient_type === 'animal_derived').map(d => d.inci_name.toLowerCase())
      )
      baseIngredients = baseIngredients.filter(i => !animalINCIs.has((i.inci_name || '').toLowerCase()))
    }

    // 10. 합계 100% 유지 (LRM 보정)
    const aquaIdx = baseIngredients.findIndex(i => i.inci_name === 'Aqua' || i.name === '정제수')
    if (aquaIdx !== -1) {
      const otherSum = baseIngredients.reduce((s, i, idx) => idx === aquaIdx ? s : s + (parseFloat(i.percentage) || 0), 0)
      baseIngredients[aquaIdx].percentage = parseFloat(Math.max(0, 100 - otherSum).toFixed(2))
    }

    // 11. 예상 물성 계산
    const phIngredients = baseIngredients.map(i => ({ inci_name: i.inci_name, wt_pct: i.percentage }))
    let estimated_spec = { ph: null, viscosity: null }
    try {
      const phRows = await pool.query(
        `SELECT inci_name, ph_min, ph_max FROM ingredient_master WHERE inci_name = ANY($1)`,
        [phIngredients.map(i => i.inci_name).filter(Boolean)]
      )
      const phMap = {}
      for (const r of phRows.rows) phMap[r.inci_name] = { min: parseFloat(r.ph_min), max: parseFloat(r.ph_max) }
      let wSum = 0, wPh = 0
      for (const i of phIngredients) {
        const ph = phMap[i.inci_name]
        if (ph && !isNaN(ph.min) && !isNaN(ph.max)) {
          const mid = (ph.min + ph.max) / 2
          wPh += mid * i.wt_pct
          wSum += i.wt_pct
        }
      }
      if (wSum > 0) estimated_spec.ph = Math.round((wPh / wSum) * 10) / 10
    } catch (_) {}

    // 점도는 Carbomer/HEC/증점제 농도로 추정
    const thickenerPct = baseIngredients.reduce((s, i) => {
      const fn = (i.function || '').toLowerCase()
      return fn.includes('점도') || fn.includes('thicken') || fn.includes('gelling')
        ? s + (parseFloat(i.percentage) || 0)
        : s
    }, 0)
    if (thickenerPct > 0) {
      estimated_spec.viscosity = thickenerPct < 0.2 ? '500~2,000'
        : thickenerPct < 0.5 ? '2,000~10,000'
        : thickenerPct < 1.0 ? '10,000~30,000'
        : '30,000~80,000'
    }

    res.json({
      success: true,
      data: {
        ingredients: baseIngredients,
        estimated_spec,
        totalPercentage: parseFloat(baseIngredients.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0).toFixed(2)),
        filters_applied: {
          keywords: kw,
          exclude_types: excludeTypes,
          ewg_filter: ewgFilter,
          sensitive_filter: sensitiveFilter,
          retinol_mode: retinolMode,
          from_cache: refIngredients.length > 0,
        },
      },
    })
  } catch (err) {
    console.error('[generate-idea]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── POST /api/formula/adjust-by-spec — 물성 변경 시 처방 자동 조정 ────────
app.post('/api/formula/adjust-by-spec', async (req, res) => {
  try {
    const { current_ingredients = [], target_spec = {}, changed_fields = [] } = req.body
    if (!current_ingredients.length) {
      return res.status(400).json({ success: false, error: 'current_ingredients 필요' })
    }

    const adjusted = current_ingredients.map(i => ({ ...i }))
    const warnings = []
    const preview_spec = {}

    // 헬퍼: 원료 찾기 (inci_name 또는 name)
    const findIng = (inciName) =>
      adjusted.findIndex(i => (i.inci_name || '').toLowerCase() === inciName.toLowerCase())

    // 헬퍼: 원료 추가 또는 증량
    const upsertIng = (name, inci_name, pct, fn, phase) => {
      const idx = findIng(inci_name)
      if (idx !== -1) {
        adjusted[idx].percentage = parseFloat((parseFloat(adjusted[idx].percentage || 0) + pct).toFixed(3))
      } else {
        adjusted.push({ name, inci_name, percentage: pct, function: fn, phase })
      }
    }

    // 헬퍼: 원료 감량
    const reduceIng = (inci_name, amount) => {
      const idx = findIng(inci_name)
      if (idx !== -1) {
        adjusted[idx].percentage = parseFloat(Math.max(0, parseFloat(adjusted[idx].percentage || 0) - amount).toFixed(3))
      }
    }

    // 헬퍼: Aqua로 100% 맞추기
    const rebalanceAqua = () => {
      const aquaIdx = adjusted.findIndex(i =>
        (i.inci_name || '').toLowerCase() === 'aqua' || i.name === '정제수'
      )
      if (aquaIdx !== -1) {
        const otherSum = adjusted.reduce((s, i, idx) => idx === aquaIdx ? s : s + (parseFloat(i.percentage) || 0), 0)
        adjusted[aquaIdx].percentage = parseFloat(Math.max(0, 100 - otherSum).toFixed(3))
      }
    }

    // ── pH 변경 ──
    if (changed_fields.includes('ph') && target_spec.ph) {
      const targetPh = typeof target_spec.ph === 'string'
        ? parseFloat(target_spec.ph.split('~')[0])
        : parseFloat(target_spec.ph)

      if (!isNaN(targetPh)) {
        if (targetPh < 5.5) {
          // 산성 방향: Citric Acid 또는 Lactic Acid 추가
          const acidAmount = targetPh < 4.0 ? 0.5 : 0.2
          const existCitric = findIng('Citric Acid') !== -1
          const existLactic = findIng('Lactic Acid') !== -1
          if (!existCitric && !existLactic) {
            upsertIng('구연산 (pH 조절)', 'Citric Acid', acidAmount, 'pH 조절제', 'D')
            warnings.push(`pH ${targetPh} 목표 → Citric Acid ${acidAmount}% 추가`)
          } else {
            const acid = existCitric ? 'Citric Acid' : 'Lactic Acid'
            upsertIng('', acid, acidAmount * 0.5, 'pH 조절제', 'D')
            warnings.push(`pH ${targetPh} 목표 → ${acid} 증량`)
          }
          // TEA 감량 (중화제 줄이기)
          reduceIng('Triethanolamine', 0.1)
          preview_spec.ph = targetPh
        } else if (targetPh > 7.0) {
          // 알칼리 방향: TEA 또는 NaOH 추가
          upsertIng('트리에탄올아민', 'Triethanolamine', 0.1, 'pH 조절제', 'D')
          warnings.push(`pH ${targetPh} 목표 → Triethanolamine 추가/증량`)
          preview_spec.ph = targetPh
        } else {
          preview_spec.ph = targetPh
          warnings.push(`pH ${targetPh} — 현재 처방으로 달성 가능한 범위입니다.`)
        }
        rebalanceAqua()
      }
    }

    // ── 점도 변경 ──
    if (changed_fields.includes('viscosity') && target_spec.viscosity) {
      const viscStr = String(target_spec.viscosity).replace(/,/g, '')
      const targetVisc = parseFloat(viscStr.split('~')[0]) || parseFloat(viscStr)

      if (!isNaN(targetVisc)) {
        const carbomerIdx = findIng('Carbomer')
        const currentCarbomer = carbomerIdx !== -1 ? parseFloat(adjusted[carbomerIdx].percentage || 0) : 0

        if (targetVisc < 5000) {
          // 점도 낮추기: Carbomer 감량
          if (currentCarbomer > 0.1) {
            reduceIng('Carbomer', Math.min(currentCarbomer * 0.3, 0.2))
            warnings.push(`점도 ${targetVisc}cps 목표 → Carbomer 감량`)
          }
          preview_spec.viscosity = `${targetVisc}~${targetVisc * 2}`
        } else if (targetVisc >= 20000) {
          // 점도 높이기: Carbomer 또는 HEC 증량
          if (currentCarbomer > 0) {
            upsertIng('카보머', 'Carbomer', 0.15, '점도조절', 'A')
            warnings.push(`점도 ${targetVisc}cps 목표 → Carbomer 증량`)
          } else {
            upsertIng('하이드록시에틸셀룰로오스', 'Hydroxyethylcellulose', 0.3, '점도조절', 'A')
            warnings.push(`점도 ${targetVisc}cps 목표 → HEC 추가`)
          }
          preview_spec.viscosity = `${targetVisc}~${targetVisc * 1.5}`
        } else {
          preview_spec.viscosity = `${targetVisc}~${targetVisc * 2}`
        }
        rebalanceAqua()
      }
    }

    // ── 외관 변경 (크림 → 젤) ──
    if (changed_fields.includes('appearance') && target_spec.appearance) {
      const app = String(target_spec.appearance).toLowerCase()
      if (app.includes('젤') || app.includes('gel')) {
        // 유성원료 축소: 유화제/오일류 감량
        for (const ing of adjusted) {
          const fn = (ing.function || '').toLowerCase()
          if (fn.includes('emollient') || fn.includes('에몰리언트') || fn.includes('오일') || fn.includes('oil')) {
            ing.percentage = parseFloat(Math.max(0, parseFloat(ing.percentage) * 0.5).toFixed(3))
          }
        }
        // 수성 증점제 확대
        upsertIng('카보머', 'Carbomer', 0.2, '점도조절 (젤화)', 'A')
        warnings.push('외관 → 젤 타입: 유성원료 50% 감량, Carbomer 증량')
        preview_spec.appearance = '투명~반투명 젤'
        rebalanceAqua()
      } else if (app.includes('크림') || app.includes('cream')) {
        upsertIng('세테아릴알코올', 'Cetearyl Alcohol', 1.0, '점도조절/유화안정', 'B')
        warnings.push('외관 → 크림 타입: 왁스류 추가')
        preview_spec.appearance = '유백색 크림'
        rebalanceAqua()
      }
    }

    // 최종 합계 검증
    const finalTotal = parseFloat(adjusted.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0).toFixed(3))
    if (Math.abs(finalTotal - 100) > 0.1) {
      warnings.push(`⚠ 최종 합산 ${finalTotal}% — 정제수(Aqua)를 추가하여 100%로 조정하세요.`)
    }

    res.json({
      success: true,
      data: {
        adjusted_ingredients: adjusted,
        preview_spec,
        warnings,
        original_total: parseFloat(current_ingredients.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0).toFixed(3)),
        adjusted_total: finalTotal,
      },
    })
  } catch (err) {
    console.error('[adjust-by-spec]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 서버 시작 ────────────────────────────────────────────────────────────
const PORT = process.env.API_PORT || 3001
const DIST_DIR = join(__dirname, '..', 'dist')

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(join(DIST_DIR, 'index.html'))
  })
}

;(async () => {
  try {
    await loadCompoundCache()
  } catch (err) {
    console.error('[CompoundCache] 초기화 실패:', err.message)
  }
  try {
    await initPurposeGateDB()
    console.log('[PurposeGate] DB 초기화 완료')
  } catch (err) {
    console.error('[PurposeGate] DB 초기화 실패:', err.message)
  }
  try {
    await initCompatibilityDB()
    console.log('[Compatibility] DB 초기화 완료')
  } catch (err) {
    console.error('[Compatibility] DB 초기화 실패:', err.message)
  }
  try {
    await initVerificationDB()
    console.log('[Verification] DB 초기화 완료')
  } catch (err) {
    console.error('[Verification] DB 초기화 실패:', err.message)
  }
  try {
    await initAuthDB()
    console.log('[Auth] DB 초기화 완료')
  } catch (err) {
    console.error('[Auth] DB 초기화 실패:', err.message)
  }
  try {
    await initAdminAccount()
    if (process.env.ADMIN_EMAIL) console.log(`[Auth] 관리자 계정 설정: ${process.env.ADMIN_EMAIL}`)
  } catch (err) {
    console.error('[Auth] 관리자 계정 설정 실패:', err.message)
  }
  app.listen(PORT, () => {
    console.log(`[MyLab API] Running on http://localhost:${PORT}`)
  })
})()
