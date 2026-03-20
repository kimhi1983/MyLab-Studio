<template>
  <div class="admin-page">
    <div class="admin-header">
      <div>
        <span class="page-label">Admin</span>
        <h2 class="page-title">관리자</h2>
      </div>
      <div class="header-meta">
        <span class="admin-email-badge">관리자: {{ currentUser?.email }}</span>
      </div>
    </div>

    <!-- 탭 -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">사용자 관리</button>
      <button class="tab-btn" :class="{ active: activeTab === 'requests' }" @click="onTabRequests">
        요청 관리
        <span v-if="pendingCount > 0" class="tab-badge">{{ pendingCount }}</span>
      </button>
    </div>

    <!-- ══════════ 사용자 관리 탭 ══════════ -->
    <template v-if="activeTab === 'users'">
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

      <div v-if="loading" class="state-msg">불러오는 중…</div>
      <div v-else-if="error" class="error-banner">{{ error }}</div>

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
    </template>

    <!-- ══════════ 요청 관리 탭 ══════════ -->
    <template v-if="activeTab === 'requests'">
      <!-- 필터 -->
      <div class="req-filter-bar">
        <div class="filter-group">
          <label class="filter-label">상태</label>
          <select v-model="reqFilterStatus" class="filter-select" @change="fetchAllRequests">
            <option value="">전체</option>
            <option>접수</option>
            <option>검토중</option>
            <option>진행중</option>
            <option>완료</option>
            <option>반려</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">요청 유형</label>
          <select v-model="reqFilterType" class="filter-select" @change="fetchAllRequests">
            <option value="">전체</option>
            <option>신규 제형 요청</option>
            <option>기존 제형 개선</option>
            <option>성분 추가 요청</option>
            <option>UI/사용성 개선</option>
            <option>버그 신고</option>
            <option>기타</option>
          </select>
        </div>
        <button class="btn-refresh-req" @click="fetchAllRequests">↻ 새로고침</button>
      </div>

      <div v-if="reqLoading" class="state-msg">불러오는 중...</div>
      <div v-else-if="allRequests.length === 0" class="state-msg">요청이 없습니다.</div>

      <div v-else class="table-wrap">
        <table class="req-table">
          <thead>
            <tr>
              <th>#</th>
              <th>사용자</th>
              <th>요청 유형</th>
              <th>제목</th>
              <th>상태</th>
              <th>접수일</th>
              <th style="width:160px">상태 변경</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="r in allRequests" :key="r.id">
              <tr @click="toggleReqExpand(r.id)" :class="{ 'req-expanded': reqExpandedId === r.id }">
                <td class="cell-id">{{ r.id }}</td>
                <td class="cell-user">{{ r.user_name || r.user_id }}</td>
                <td class="cell-type">{{ r.request_type }}</td>
                <td class="cell-title">{{ r.title }}</td>
                <td><span class="status-badge" :class="statusClass(r.status)">{{ r.status }}</span></td>
                <td class="cell-date">{{ fmtDate(r.created_at) }}</td>
                <td @click.stop>
                  <select
                    :value="r.status"
                    class="status-select"
                    @change="e => quickStatusChange(r, e.target.value)"
                  >
                    <option>접수</option>
                    <option>검토중</option>
                    <option>진행중</option>
                    <option>완료</option>
                    <option>반려</option>
                  </select>
                </td>
              </tr>
              <!-- 아코디언: 상세 + 답변 입력 -->
              <tr v-if="reqExpandedId === r.id" class="req-detail-row">
                <td colspan="7">
                  <div class="req-detail-box">
                    <div class="detail-section">
                      <div class="detail-label">요청 내용</div>
                      <div class="detail-text">{{ r.description }}</div>
                      <div v-if="r.reference_url" class="detail-url">
                        참고: <a :href="r.reference_url" target="_blank">{{ r.reference_url }}</a>
                      </div>
                    </div>
                    <div class="detail-section">
                      <div class="detail-label">관리자 답변</div>
                      <textarea
                        v-model="replyDrafts[r.id]"
                        class="reply-textarea"
                        rows="3"
                        placeholder="답변을 입력하세요..."
                      />
                      <div class="reply-actions">
                        <select v-model="replyStatuses[r.id]" class="status-select">
                          <option>접수</option>
                          <option>검토중</option>
                          <option>진행중</option>
                          <option>완료</option>
                          <option>반려</option>
                        </select>
                        <button class="btn-save-reply" @click="saveReply(r)" :disabled="savingReplyId === r.id">
                          {{ savingReplyId === r.id ? '저장 중...' : '답변 저장' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

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

// ── 탭 ──
const activeTab = ref('users')

// ── 사용자 관리 ──
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

// ── 요청 관리 ──
const allRequests = ref([])
const reqLoading = ref(false)
const reqFilterStatus = ref('')
const reqFilterType = ref('')
const reqExpandedId = ref(null)
const replyDrafts = ref({})
const replyStatuses = ref({})
const savingReplyId = ref(null)

const pendingCount = computed(() => allRequests.value.filter(r => r.status === '접수' || r.status === '검토중').length)

async function fetchAllRequests() {
  reqLoading.value = true
  try {
    const params = new URLSearchParams()
    if (reqFilterStatus.value) params.set('status', reqFilterStatus.value)
    if (reqFilterType.value) params.set('request_type', reqFilterType.value)
    const res = await fetch(`${API}/api/requests/all?${params}`, { headers: getAuthHeader() })
    const data = await res.json()
    allRequests.value = data
    // 드래프트 초기화
    for (const r of data) {
      if (!(r.id in replyDrafts.value)) replyDrafts.value[r.id] = r.admin_reply || ''
      if (!(r.id in replyStatuses.value)) replyStatuses.value[r.id] = r.status
    }
  } catch {}
  finally { reqLoading.value = false }
}

function onTabRequests() {
  activeTab.value = 'requests'
  if (allRequests.value.length === 0) fetchAllRequests()
}

function toggleReqExpand(id) {
  reqExpandedId.value = reqExpandedId.value === id ? null : id
  // 상태 드래프트 초기화
  const r = allRequests.value.find(x => x.id === id)
  if (r && !(id in replyStatuses.value)) replyStatuses.value[id] = r.status
}

async function quickStatusChange(r, newStatus) {
  try {
    const res = await fetch(`${API}/api/requests/${r.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ status: newStatus, admin_reply: r.admin_reply }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    r.status = newStatus
  } catch (e) {
    alert(`상태 변경 실패: ${e.message}`)
  }
}

async function saveReply(r) {
  savingReplyId.value = r.id
  try {
    const res = await fetch(`${API}/api/requests/${r.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        status: replyStatuses.value[r.id] || r.status,
        admin_reply: replyDrafts.value[r.id] || '',
      }),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    const { data } = await res.json()
    Object.assign(r, data)
    reqExpandedId.value = null
  } catch (e) {
    alert(`저장 실패: ${e.message}`)
  } finally {
    savingReplyId.value = null
  }
}

// ── 공통 ──
function fmtDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function statusClass(s) {
  const map = { '접수': 'st-receipt', '검토중': 'st-review', '진행중': 'st-progress', '완료': 'st-done', '반려': 'st-reject' }
  return map[s] || 'st-receipt'
}

onMounted(fetchUsers)
</script>

<style scoped>
.admin-page { display: flex; flex-direction: column; gap: 20px; }

.admin-header {
  display: flex; align-items: flex-end;
  justify-content: space-between; gap: 12px;
}
.page-label {
  font-size: 10px; font-family: var(--font-mono); color: var(--accent);
  letter-spacing: 3px; font-weight: 600; text-transform: uppercase;
}
.page-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 4px 0 0; }
.admin-email-badge {
  font-size: 11px; font-family: var(--font-mono);
  padding: 4px 10px; background: var(--accent-light);
  border-radius: 20px; color: var(--accent);
}

/* 탭 */
.tab-bar {
  display: flex; gap: 4px;
  border-bottom: 2px solid var(--border);
  padding-bottom: 0;
  margin-bottom: -2px;
}
.tab-btn {
  position: relative;
  padding: 8px 20px;
  border: none; background: none;
  font-size: 13px; font-weight: 500;
  color: var(--text-dim); cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.15s, border-color 0.15s;
  display: flex; align-items: center; gap: 6px;
}
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--accent); font-weight: 700; border-bottom-color: var(--accent); }
.tab-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px;
  background: #F44336; color: #fff;
  border-radius: 9px; font-size: 10px; font-weight: 700;
  padding: 0 4px;
}

/* 통계 */
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
.stat-num { font-size: 28px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); line-height: 1; }
.stat-label { font-size: 11px; color: var(--text-dim); margin-top: 6px; }

.state-msg { text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px; }
.error-banner { padding: 12px 16px; background: var(--red-bg); color: var(--red); border-radius: var(--radius); font-size: 13px; }

/* 필터 */
.req-filter-bar {
  display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px 16px;
}
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); }
.filter-select {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; color: var(--text); background: var(--surface); min-width: 120px;
}
.filter-select:focus { border-color: var(--accent); outline: none; }
.btn-refresh-req {
  height: 34px; padding: 0 14px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg); font-size: 12px;
  color: var(--text-sub); cursor: pointer; align-self: flex-end;
}
.btn-refresh-req:hover { background: var(--accent-light); color: var(--accent); }

/* 사용자/요청 공통 테이블 */
.table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: auto; }

.user-table, .req-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.user-table thead th, .req-table thead th {
  padding: 10px 14px; text-align: left;
  font-size: 11px; font-family: var(--font-mono); color: var(--text-dim);
  border-bottom: 1px solid var(--border); white-space: nowrap;
}
.user-table tbody tr, .req-table tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
.user-table tbody tr:last-child, .req-table tbody tr:last-child { border-bottom: none; }
.user-table tbody tr:hover, .req-table tbody tr:hover { background: var(--bg); }
.user-table tbody tr.is-me { background: var(--accent-light); }
.req-table tbody tr { cursor: pointer; }
.user-table td, .req-table td { padding: 10px 14px; color: var(--text); vertical-align: middle; }

.user-name-cell { display: flex; align-items: center; gap: 8px; }
.avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0; }
.avatar-admin { background: var(--amber-bg); color: var(--amber); }
.me-badge { font-size: 9px; font-family: var(--font-mono); padding: 1px 5px; background: var(--accent); color: #fff; border-radius: 4px; }
.email-cell { color: var(--text-sub); font-family: var(--font-mono); font-size: 12px; }
.date-cell { color: var(--text-dim); font-size: 11px; font-family: var(--font-mono); white-space: nowrap; }
.num-cell { text-align: center; font-family: var(--font-mono); font-weight: 600; color: var(--text-sub); }
.cell-id { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
.cell-user { font-size: 12px; color: var(--text-sub); }
.cell-type { font-size: 11px; color: var(--text-dim); white-space: nowrap; }
.cell-title { font-weight: 500; max-width: 240px; }
.cell-date { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); white-space: nowrap; }

.role-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.role-admin { background: var(--amber-bg); color: var(--amber); }
.role-user { background: var(--bg); color: var(--text-dim); border: 1px solid var(--border); }

.action-cell { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.btn-action { padding: 4px 8px; border-radius: 5px; border: 1px solid var(--border); background: var(--bg); font-size: 11px; cursor: pointer; white-space: nowrap; transition: all 0.15s; color: var(--text-sub); }
.btn-promote:hover { border-color: var(--amber); background: var(--amber-bg); color: var(--amber); }
.btn-demote:hover { border-color: var(--accent); background: var(--accent-light); color: var(--accent); }
.btn-reset:hover { border-color: var(--blue); background: var(--blue-bg); color: var(--blue); }
.btn-delete:hover { border-color: var(--red); background: var(--red-bg); color: var(--red); }
.me-text { font-size: 11px; color: var(--text-dim); }

/* 상태 뱃지 */
.status-badge { display: inline-block; padding: 2px 9px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.st-receipt  { background: #E0E0E0; color: #555; }
.st-review   { background: #FFF3E0; color: #E65100; }
.st-progress { background: #E3F2FD; color: #1565C0; }
.st-done     { background: #E8F5E9; color: #2E7D32; }
.st-reject   { background: #FFEBEE; color: #B71C1C; }

/* 상태 변경 드롭다운 */
.status-select { padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text); background: var(--surface); cursor: pointer; }
.status-select:focus { border-color: var(--accent); outline: none; }

/* 요청 상세 아코디언 */
.req-detail-row td { padding: 0; border-bottom: 1px solid var(--border); }
.req-detail-box { padding: 16px 20px; background: #FAFAF7; border-top: 1px solid #E8E0D4; display: flex; flex-direction: column; gap: 14px; }
.detail-section { display: flex; flex-direction: column; gap: 6px; }
.detail-label { font-size: 11px; font-weight: 700; color: #C8A96E; letter-spacing: 0.5px; }
.detail-text { font-size: 13px; color: var(--text); line-height: 1.7; white-space: pre-wrap; }
.detail-url { font-size: 12px; color: var(--text-dim); }
.detail-url a { color: var(--accent); }

.reply-textarea {
  width: 100%; padding: 9px 12px;
  border: 1px solid var(--border); border-radius: 7px;
  font-size: 13px; color: var(--text); background: var(--surface);
  font-family: inherit; resize: vertical; line-height: 1.6;
  box-sizing: border-box;
}
.reply-textarea:focus { border-color: #C8A96E; outline: none; }
.reply-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.btn-save-reply {
  height: 34px; padding: 0 18px;
  background: #C8A96E; color: #fff;
  border: none; border-radius: 7px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.btn-save-reply:hover:not(:disabled) { background: #b0933f; }
.btn-save-reply:disabled { opacity: 0.6; cursor: not-allowed; }

/* 모달 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 28px 32px; width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
.modal-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
.modal-desc { font-size: 13px; color: var(--text-sub); margin: 0 0 18px; line-height: 1.6; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 12px; color: var(--text-sub); }
.field input { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font-size: 14px; outline: none; }
.field input:focus { border-color: var(--accent); }
.modal-error { padding: 8px 12px; background: var(--red-bg); color: var(--red); border-radius: 6px; font-size: 12px; margin-bottom: 14px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel { padding: 8px 16px; border: 1px solid var(--border); border-radius: 7px; background: var(--bg); color: var(--text-sub); font-size: 13px; cursor: pointer; }
.btn-confirm { padding: 8px 18px; background: var(--accent); color: #fff; border: none; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-delete-confirm { padding: 8px 18px; background: var(--red); color: #fff; border: none; border-radius: 7px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-delete-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 900px) {
  .stat-row { grid-template-columns: repeat(2, 1fr); }
  .email-cell { font-size: 11px; }
  .action-cell { flex-direction: column; gap: 4px; }
}
</style>
