// ─── routes/auth.js ──────────────────────────────────────────────────────────
// /api/auth/*, /api/admin/*, /api/user/*
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'mylab-fallback-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// ─── JWT 인증 미들웨어 (export: 다른 라우터에서 사용) ─────────────────────────
export function authenticateToken(req, res, next) {
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

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '관리자 권한이 필요합니다.' })
  next()
}

// ─── DB 초기화 ───────────────────────────────────────────────────────────────
export async function initAuthDB() {
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

export async function initAdminAccount() {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return
  await pool.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [adminEmail.toLowerCase()])
}

// ─── 인증 라우트 ──────────────────────────────────────────────────────────────

// 회원가입
router.post('/auth/register', async (req, res) => {
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

// 로그인
router.post('/auth/login', async (req, res) => {
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

// 내 정보
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1', [req.user.id])
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── 관리자 API ───────────────────────────────────────────────────────────────

// 전체 사용자 목록
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
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

// 사용자 역할 변경
router.put('/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
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
router.put('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// 사용자 삭제
router.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: '자신의 계정은 삭제할 수 없습니다.' })
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 비밀번호 초기화
router.put('/admin/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
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

// ─── 사용자별 데이터 API (makeUserDataRouter) ─────────────────────────────────
function makeUserDataRouter(tableName) {
  // GET 목록
  router.get(`/user/${tableName}`, authenticateToken, async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT data FROM user_${tableName} WHERE user_id = $1 ORDER BY updated_at DESC`, [req.user.id])
      res.json(rows.map(r => r.data))
    } catch (err) { res.status(500).json({ error: err.message }) }
  })

  // POST 단건 저장
  router.post(`/user/${tableName}`, authenticateToken, async (req, res) => {
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

  // POST 배치 저장
  router.post(`/user/${tableName}/batch`, authenticateToken, async (req, res) => {
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
  router.put(`/user/${tableName}/:id`, authenticateToken, async (req, res) => {
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
  router.delete(`/user/${tableName}/:id`, authenticateToken, async (req, res) => {
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

// 사용자 설정 (위젯 레이아웃, 메모)
router.get('/user/settings', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT widget_layout, dashboard_memo FROM user_settings WHERE user_id = $1', [req.user.id])
    res.json(rows[0] || { widget_layout: null, dashboard_memo: '' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/user/settings', authenticateToken, async (req, res) => {
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

export default router
