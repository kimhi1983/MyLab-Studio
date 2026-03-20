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
    await fetch(base, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(item),
    })
  }

  async function saveBatch(items) {
    if (!isAuth() || !items.length) return
    await fetch(`${base}/batch`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(items),
    })
  }

  async function update(id, item) {
    if (!isAuth()) return
    await fetch(`${base}/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(item),
    })
  }

  async function remove(id) {
    if (!isAuth()) return
    await fetch(`${base}/${id}`, { method: 'DELETE', headers: authHeaders() })
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
