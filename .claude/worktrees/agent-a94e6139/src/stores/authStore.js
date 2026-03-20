import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { migrateLocalDataToServer } from '../composables/useMigration.js'
import { loadFormulasFromServer } from './formulaStore.js'
import { loadProjectsFromServer } from './projectStore.js'
import { loadNotesFromServer } from './noteStore.js'
import { loadWidgetSettingsFromServer } from './widgetStore.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// 모듈 레벨 상태 (싱글톤)
const token = ref(localStorage.getItem('mylab:auth-token') || null)
const user = ref(JSON.parse(localStorage.getItem('mylab:auth-user') || 'null'))

export function useAuthStore() {
  const router = useRouter()
  const isLoggedIn = computed(() => !!token.value)

  async function login(email, password) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '로그인 실패')

    token.value = data.token
    user.value = data.user
    localStorage.setItem('mylab:auth-token', data.token)
    localStorage.setItem('mylab:auth-user', JSON.stringify(data.user))

    // 최초 로그인 시 localStorage → 서버 마이그레이션, 이후 서버 데이터 로드
    await migrateLocalDataToServer()
    await Promise.all([
      loadFormulasFromServer(),
      loadProjectsFromServer(),
      loadNotesFromServer(),
      loadWidgetSettingsFromServer(),
    ])

    return data
  }

  async function register(email, password, name) {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '회원가입 실패')
    return data
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('mylab:auth-token')
    localStorage.removeItem('mylab:auth-user')
    router.push('/login')
  }

  function getAuthHeader() {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, user, isLoggedIn, login, register, logout, getAuthHeader }
}
