<template>
  <div class="admin-page">
    <div class="admin-header">
      <div>
        <span class="page-label">Admin</span>
        <h2 class="page-title">사용자 관리</h2>
      </div>
      <div class="header-meta">
        <span class="admin-email-badge">관리자: {{ currentUser?.email }}</span>
      </div>
    </div>

    <!-- 통계 카드 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">{{ users.length }}</div>
        <div class="stat-label">전체 회원</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ adminCount }}</div>
        <div class="stat-label">관리자</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ activeToday }}</div>
        <div class="stat-label">오늘 접속</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ totalFormulas }}</div>
        <div class="stat-label">전체 처방 수</div>
      </div>
    </div>

    <!-- 로딩/에러 -->
    <div v-if="loading" class="state-msg">불러오는 중…</div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>

    <!-- 사용자 테이블 -->
    <div v-else class="table-wrap">
      <table class="user-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>이메일</th>
            <th>역할</th>
            <th>가입일</th>
            <th>최근 접속</th>
            <th>처방 수</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" :class="{ 'is-admin': u.role === 'admin', 'is-me': u.id === currentUser?.id }">
            <td>
              <div class="user-name-cell">
                <div class="avatar" :class="u.role === 'admin' ? 'avatar-admin' : ''">{{ u.name?.[0]?.toUpperCase() || '?' }}</div>
                <span>{{ u.name }}</span>
                <span v-if="u.id === currentUser?.id" class="me-badge">나</span>
              </div>
            </td>
            <td class="email-cell">{{ u.email }}</td>
            <td>
              <span class="role-badge" :class="u.role === 'admin' ? 'role-admin' : 'role-user'">
                {{ u.role === 'admin' ? '관리자' : '일반' }}
              </span>
            </td>
            <td class="date-cell">{{ fmtDate(u.created_at) }}</td>
            <td class="date-cell">{{ u.last_login ? fmtDate(u.last_login) : '없음' }}</td>
            <td class="num-cell">{{ u.formula_count ?? 0 }}</td>
            <td class="action-cell">
              <template v-if="u.id !== currentUser?.id">
                <button
                  class="btn-action"
                  :class="u.role === 'admin' ? 'btn-demote' : 'btn-promote'"
                  @click="onToggleRole(u)"
                  :title="u.role === 'admin' ? '일반 사용자로 변경' : '관리자로 승격'"
                >
                  {{ u.role === 'admin' ? '강등' : '관리자 승격' }}
                </button>
                <button class="btn-action btn-reset" @click="onResetPassword(u)" title="비밀번호 초기화">
                  PW초기화
                </button>
                <button class="btn-action btn-delete" @click="onDelete(u)" title="계정 삭제">
                  삭제
                </button>
              </template>
              <span v-else class="me-text">–</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 비밀번호 초기화 모달 -->
    <div v-if="pwModal" class="modal-overlay" @click.self="pwModal = null">
      <div class="modal-card">
        <div class="modal-title">비밀번호 초기화</div>
        <p class="modal-desc"><strong>{{ pwModal.name }}</strong> ({{ pwModal.email }})의 비밀번호를 초기화합니다.</p>
        <div class="field">
          <label>새 임시 비밀번호</label>
          <input v-model="newPassword" type="text" placeholder="6자 이상" />
        </div>
        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="pwModal = null">취소</button>
          <button class="btn-confirm" @click="doResetPassword" :disabled="modalLoading">
            {{ modalLoading ? '처리 중…' : '초기화' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal-card">
        <div class="modal-title">계정 삭제</div>
        <p class="modal-desc">
          <strong>{{ deleteTarget.name }}</strong> ({{ deleteTarget.email }}) 계정과
          모든 데이터(처방, 프로젝트, 노트)를 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="deleteTarget = null">취소</button>
          <button class="btn-delete-confirm" @click="doDelete" :disabled="modalLoading">
            {{ modalLoading ? '삭제 중…' : '삭제 확인' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const { user: currentUser, getAuthHeader } = useAuthStore()

const users = ref([])
const loading = ref(true)
const error = ref('')
const pwModal = ref(null)
const deleteTarget = ref(null)
const newPassword = ref('')
const modalError = ref('')
const modalLoading = ref(false)

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const activeToday = computed(() => {
  const today = new Date().toDateString()
  return users.value.filter(u => u.last_login && new Date(u.last_login).toDateString() === today).length
})
const totalFormulas = computed(() => users.value.reduce((s, u) => s + Number(u.formula_count || 0), 0))

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API}/api/admin/users`, { headers: getAuthHeader() })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || `HTTP ${res.status}`)
    }
    users.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function onToggleRole(u) {
  const newRole = u.role === 'admin' ? 'user' : 'admin'
  const label = newRole === 'admin' ? '관리자로 승격' : '일반 사용자로 변경'
  if (!confirm(`${u.name}(${u.email})를 ${label}하시겠습니까?`)) return
  try {
    const res = await fetch(`${API}/api/admin/users/${u.id}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ role: newRole }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    u.role = newRole
  } catch (e) {
    alert(`역할 변경 실패: ${e.message}`)
  }
}

function onResetPassword(u) {
  pwModal.value = u
  newPassword.value = ''
  modalError.value = ''
}

async function doResetPassword() {
  if (!newPassword.value || newPassword.value.length < 6) {
    modalError.value = '6자 이상 입력해주세요.'
    return
  }
  modalLoading.value = true
  modalError.value = ''
  try {
    const res = await fetch(`${API}/api/admin/users/${pwModal.value.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ password: newPassword.value }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    pwModal.value = null
    alert('비밀번호가 초기화되었습니다.')
  } catch (e) {
    modalError.value = e.message
  } finally {
    modalLoading.value = false
  }
}

function onDelete(u) {
  deleteTarget.value = u
  modalError.value = ''
}

async function doDelete() {
  modalLoading.value = true
  modalError.value = ''
  try {
    const res = await fetch(`${API}/api/admin/users/${deleteTarget.value.id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    users.value = users.value.filter(u => u.id !== deleteTarget.value.id)
    deleteTarget.value = null
  } catch (e) {
    modalError.value = e.message
  } finally {
    modalLoading.value = false
  }
}

function fmtDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

onMounted(fetchUsers)
</script>

<style scoped>
.admin-page { display: flex; flex-direction: column; gap: 20px; }

.admin-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.page-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--accent);
  letter-spacing: 3px;
  font-weight: 600;
  text-transform: uppercase;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin: 4px 0 0;
}
.admin-email-badge {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  padding: 4px 10px;
  background: var(--accent-light);
  border-radius: 20px;
  color: var(--accent);
}

/* 통계 카드 */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
  font-family: var(--font-mono);
  line-height: 1;
}
.stat-label {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 6px;
}

.state-msg {
  text-align: center;
  padding: 40px;
  color: var(--text-dim);
  font-size: 13px;
}
.error-banner {
  padding: 12px 16px;
  background: var(--red-bg);
  color: var(--red);
  border-radius: var(--radius);
  font-size: 13px;
}

/* 테이블 */
.table-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: auto;
}
.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.user-table thead th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.user-table tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.user-table tbody tr:last-child { border-bottom: none; }
.user-table tbody tr:hover { background: var(--bg); }
.user-table tbody tr.is-me { background: var(--accent-light); }
.user-table td { padding: 10px 14px; color: var(--text); vertical-align: middle; }

.user-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 11px; flex-shrink: 0;
}
.avatar-admin { background: var(--amber-bg); color: var(--amber); }
.me-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  padding: 1px 5px;
  background: var(--accent);
  color: #fff;
  border-radius: 4px;
}

.email-cell { color: var(--text-sub); font-family: var(--font-mono); font-size: 12px; }
.date-cell { color: var(--text-dim); font-size: 11px; font-family: var(--font-mono); white-space: nowrap; }
.num-cell { text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--text-sub); }

.role-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}
.role-admin { background: var(--amber-bg); color: var(--amber); }
.role-user { background: var(--bg); color: var(--text-dim); border: 1px solid var(--border); }

.action-cell { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.btn-action {
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  color: var(--text-sub);
}
.btn-promote:hover { border-color: var(--amber); background: var(--amber-bg); color: var(--amber); }
.btn-demote:hover { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
.btn-reset:hover { border-color: var(--blue); background: var(--blue-bg); color: var(--blue); }
.btn-delete:hover { border-color: var(--red); background: var(--red-bg); color: var(--red); }
.me-text { font-size: 11px; color: var(--text-dim); }

/* 모달 */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 28px 32px;
  width: 100%; max-width: 400px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.modal-title {
  font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 10px;
}
.modal-desc {
  font-size: 13px; color: var(--text-sub); margin: 0 0 18px;
  line-height: 1.6;
}
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 12px; color: var(--text-sub); }
.field input {
  padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg); color: var(--text); font-size: 14px; outline: none;
}
.field input:focus { border-color: var(--accent); }
.modal-error {
  padding: 8px 12px; background: var(--red-bg); color: var(--red);
  border-radius: 6px; font-size: 12px; margin-bottom: 14px;
}
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel {
  padding: 8px 16px; border: 1px solid var(--border); border-radius: 7px;
  background: var(--bg); color: var(--text-sub); font-size: 13px; cursor: pointer;
}
.btn-confirm {
  padding: 8px 18px; background: var(--accent); color: #fff; border: none;
  border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-delete-confirm {
  padding: 8px 18px; background: var(--red); color: #fff; border: none;
  border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.btn-delete-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 900px) {
  .stat-row { grid-template-columns: repeat(2, 1fr); }
  .email-cell { font-size: 11px; }
  .action-cell { flex-direction: column; gap: 4px; }
}
</style>
