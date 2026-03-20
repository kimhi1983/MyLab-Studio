const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function authHeaders() {
  const token = localStorage.getItem('mylab:auth-token')
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }
}

function isAuth() {
  return !!localStorage.getItem('mylab:auth-token')
}

export function makeUserDataApi(resource) {
  const base = `${API}/api/user/${resource}`

  async function list() {
    if (!isAuth()) return null
    const res = await fetch(base, { headers: authHeaders() })
    if (!res.ok) return null
    return res.json()
  }

  async function save(item) {
    if (!isAuth()) return
    const res = await fetch(base, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(item),
    })
    if (!res.ok) throw new Error(`저장 실패 (${res.status})`)
  }

  async function saveBatch(items) {
    if (!isAuth() || !items.length) return
    const res = await fetch(`${base}/batch`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(items),
    })
    if (!res.ok) throw new Error(`일괄 저장 실패 (${res.status})`)
  }

  async function update(id, item) {
    if (!isAuth()) return
    const res = await fetch(`${base}/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(item),
    })
    if (!res.ok) throw new Error(`수정 실패 (${res.status})`)
  }

  async function remove(id) {
    if (!isAuth()) return
    const res = await fetch(`${base}/${id}`, { method: 'DELETE', headers: authHeaders() })
    if (!res.ok) throw new Error(`삭제 실패 (${res.status})`)
  }

  return { list, save, saveBatch, update, remove }
}

export async function getSettings() {
  if (!isAuth()) return null
  const res = await fetch(`${API}/api/user/settings`, { headers: authHeaders() })
  if (!res.ok) return null
  return res.json()
}

export async function saveSettings(data) {
  if (!isAuth()) return
  await fetch(`${API}/api/user/settings`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
}
