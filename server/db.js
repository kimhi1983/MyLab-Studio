import pg from 'pg'

const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'coching_db',
  user: process.env.DB_USER || 'coching_user',
  password: process.env.DB_PASS || 'coching2026!',
  max: 10,
  idleTimeoutMillis: 30000,
})

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message)
})

export default pool
