<template>
  <div class="request-page">
    <!-- 헤더 -->
    <div class="page-header">
      <span class="page-label">SUPPORT</span>
      <h2 class="page-title">요청/문의</h2>
    </div>

    <!-- 요청 작성 폼 -->
    <div class="form-card">
      <h3 class="form-title">새 요청 작성</h3>

      <!-- 요청 유형 -->
      <div class="field">
        <label class="field-label">요청 유형 <span class="required">*</span></label>
        <div class="radio-group">
          <label v-for="t in REQUEST_TYPES" :key="t.value" class="radio-item" :class="{ active: form.request_type === t.value }">
            <input type="radio" v-model="form.request_type" :value="t.value" />
            <span class="radio-label">{{ t.label }}</span>
          </label>
        </div>
      </div>

      <!-- 제목 -->
      <div class="field">
        <label class="field-label">제목 <span class="required">*</span></label>
        <input
          v-model="form.title"
          class="field-input"
          type="text"
          placeholder="요청 제목을 입력하세요"
          maxlength="300"
        />
      </div>

      <!-- 상세 내용 -->
      <div class="field">
        <label class="field-label">상세 내용 <span class="required">*</span></label>
        <textarea
          v-model="form.description"
          class="field-textarea"
          rows="5"
          :placeholder="descPlaceholder"
        />
      </div>

      <!-- 참고 URL -->
      <div class="field">
        <label class="field-label">참고 URL <span class="optional">(선택)</span></label>
        <input
          v-model="form.reference_url"
          class="field-input"
          type="url"
          placeholder="https://..."
        />
      </div>

      <div class="form-footer">
        <span class="form-hint" v-if="submitError">{{ submitError }}</span>
        <button class="btn-submit" @click="submitRequest" :disabled="submitting">
          {{ submitting ? '제출 중...' : '요청 제출' }}
        </button>
      </div>
    </div>

    <!-- 내 요청 목록 -->
    <div class="list-card">
      <div class="list-header">
        <h3 class="list-title">내 요청 목록</h3>
        <button class="btn-refresh" @click="fetchMyRequests" :disabled="loadingList">↻</button>
      </div>

      <div v-if="loadingList" class="state-msg">불러오는 중...</div>
      <div v-else-if="myRequests.length === 0" class="state-msg">아직 요청이 없습니다.</div>

      <table v-else class="req-table">
        <thead>
          <tr>
            <th>#</th>
            <th>제목</th>
            <th>요청 유형</th>
            <th>상태</th>
            <th>관리자 답변</th>
            <th>날짜</th>
            <th style="width:36px"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in myRequests" :key="r.id">
            <tr @click="toggleExpand(r.id)" :class="{ expanded: expandedId === r.id, 'has-reply': !!r.admin_reply }">
              <td class="cell-id">{{ r.id }}</td>
              <td class="cell-title">{{ r.title }}</td>
              <td class="cell-type">{{ r.request_type }}</td>
              <td class="cell-status"><span class="status-badge" :class="statusClass(r.status)">{{ r.status }}</span></td>
              <td class="cell-reply">{{ r.admin_reply ? '✓ 답변 있음' : '-' }}</td>
              <td class="cell-date">{{ fmtDate(r.created_at) }}</td>
              <td class="cell-del" @click.stop>
                <button
                  v-if="r.status === '접수'"
                  class="btn-del"
                  @click="deleteRequest(r)"
                  title="삭제"
                >🗑</button>
              </td>
            </tr>
            <!-- 아코디언: 답변 내용 -->
            <tr v-if="expandedId === r.id && r.admin_reply" class="reply-row">
              <td colspan="7">
                <div class="reply-box">
                  <div class="reply-label">관리자 답변</div>
                  <div class="reply-text">{{ r.admin_reply }}</div>
                  <div class="reply-date">{{ fmtDateFull(r.admin_replied_at) }}</div>
                </div>
              </td>
            </tr>
            <tr v-else-if="expandedId === r.id && !r.admin_reply" class="reply-row">
              <td colspan="7">
                <div class="reply-box reply-pending">아직 답변이 등록되지 않았습니다.</div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const { getAuthHeader } = useAuthStore()

const REQUEST_TYPES = [
  { value: '신규 제형 요청', label: '신규 제형 요청' },
  { value: '기존 제형 개선', label: '기존 제형 개선' },
  { value: '성분 추가 요청', label: '성분 추가 요청' },
  { value: 'UI/사용성 개선', label: 'UI/사용성 개선' },
  { value: '버그 신고', label: '버그 신고' },
  { value: '기타', label: '기타' },
]

const PLACEHOLDERS = {
  '신규 제형 요청': '어떤 제형이 필요한지, 참고 제품이 있다면 함께 적어주세요.\n예: 손소독제, 염모제, 네일폴리시 등',
  '기존 제형 개선': '어떤 제형의 어떤 부분이 개선되면 좋겠는지 적어주세요.\n예: 선크림 처방에서 백탁 최소화 옵션',
  '성분 추가 요청': 'DB에 등록되지 않은 원료가 있다면 INCI명과 용도를 적어주세요.',
  'UI/사용성 개선': '불편한 화면이나 개선 원하는 부분을 구체적으로 적어주세요.\n예: 버튼 위치, 글자 크기, 레이아웃 등',
  '버그 신고': '어떤 상황에서 어떤 문제가 발생했는지 적어주세요.\n예: 처방 생성 중 멈춤, 저장 안 됨 등',
  '기타': '자유롭게 의견을 남겨주세요.',
}

const form = ref({ request_type: '신규 제형 요청', title: '', description: '', reference_url: '' })
const submitting = ref(false)
const submitError = ref('')

const myRequests = ref([])
const loadingList = ref(false)
const expandedId = ref(null)

const descPlaceholder = computed(() => PLACEHOLDERS[form.value.request_type] || '상세 내용을 입력하세요')

async function submitRequest() {
  submitError.value = ''
  if (!form.value.request_type) { submitError.value = '요청 유형을 선택해주세요.'; return }
  if (!form.value.title.trim()) { submitError.value = '제목을 입력해주세요.'; return }
  if (!form.value.description.trim()) { submitError.value = '상세 내용을 입력해주세요.'; return }
  submitting.value = true
  try {
    const res = await fetch(`${API}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(form.value),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '제출 실패')
    form.value = { request_type: '신규 제형 요청', title: '', description: '', reference_url: '' }
    await fetchMyRequests()
  } catch (e) {
    submitError.value = e.message
  } finally {
    submitting.value = false
  }
}

async function fetchMyRequests() {
  loadingList.value = true
  try {
    const res = await fetch(`${API}/api/requests/my`, { headers: getAuthHeader() })
    myRequests.value = await res.json()
  } catch {}
  finally { loadingList.value = false }
}

async function deleteRequest(r) {
  if (!confirm(`'${r.title}' 요청을 삭제하시겠습니까?`)) return
  try {
    const res = await fetch(`${API}/api/requests/${r.id}`, { method: 'DELETE', headers: getAuthHeader() })
    if (!res.ok) throw new Error((await res.json()).error)
    myRequests.value = myRequests.value.filter(x => x.id !== r.id)
    if (expandedId.value === r.id) expandedId.value = null
  } catch (e) {
    alert(`삭제 실패: ${e.message}`)
  }
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function statusClass(s) {
  const map = { '접수': 'st-receipt', '검토중': 'st-review', '진행중': 'st-progress', '완료': 'st-done', '반려': 'st-reject' }
  return map[s] || 'st-receipt'
}

function fmtDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function fmtDateFull(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

onMounted(fetchMyRequests)
</script>

<style scoped>
.request-page { display: flex; flex-direction: column; gap: 20px; }

.page-header { margin-bottom: 4px; }
.page-label {
  font-size: 10px; font-family: var(--font-mono); color: var(--accent);
  letter-spacing: 3px; font-weight: 600; text-transform: uppercase;
}
.page-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 4px 0 0; }

/* 폼 카드 */
.form-card {
  background: var(--surface);
  border: 1px solid #E8E0D4;
  border-radius: 10px;
  padding: 24px;
  box-shadow: var(--shadow);
}
.form-title { font-size: 15px; font-weight: 700; color: var(--text); margin: 0 0 20px; }

.field { margin-bottom: 18px; }
.field-label { display: block; font-size: 12px; font-weight: 600; color: var(--text-sub); margin-bottom: 8px; letter-spacing: 0.2px; }
.required { color: #F44336; margin-left: 2px; }
.optional { color: var(--text-dim); font-weight: 400; }

.radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
.radio-item {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  border: 1.5px solid var(--border);
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-sub);
  transition: all 0.15s;
  user-select: none;
}
.radio-item input { display: none; }
.radio-item:hover { border-color: #C8A96E; color: #C8A96E; }
.radio-item.active { border-color: #C8A96E; background: #FBF5EC; color: #8B6914; font-weight: 600; }

.field-input, .field-textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  transition: border-color 0.15s;
  box-sizing: border-box;
  font-family: inherit;
}
.field-input:focus, .field-textarea:focus { border-color: #C8A96E; outline: none; }
.field-textarea { resize: vertical; line-height: 1.6; }

.form-footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 4px; }
.form-hint { font-size: 12px; color: #F44336; }

.btn-submit {
  height: 38px; padding: 0 28px;
  background: #C8A96E; color: #fff;
  border: none; border-radius: 8px;
  font-size: 14px; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.btn-submit:hover:not(:disabled) { background: #b0933f; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

/* 목록 카드 */
.list-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.list-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; border-bottom: 1px solid var(--border); }
.list-title { font-size: 15px; font-weight: 700; color: var(--text); margin: 0; }
.btn-refresh { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 14px; color: var(--text-dim); }
.btn-refresh:hover { background: var(--bg); }

.state-msg { padding: 32px; text-align: center; color: var(--text-dim); font-size: 13px; }

.req-table { width: 100%; border-collapse: collapse; }
.req-table th {
  background: var(--bg);
  font-size: 11px; font-family: var(--font-mono); text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-dim); padding: 8px 14px; text-align: left;
}
.req-table td { padding: 10px 14px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
.req-table tbody tr { cursor: pointer; transition: background 0.1s; }
.req-table tbody tr:hover { background: var(--bg); }
.req-table tbody tr.has-reply { }

.cell-id { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
.cell-title { font-weight: 500; max-width: 260px; }
.cell-type { font-size: 12px; color: var(--text-sub); white-space: nowrap; }
.cell-reply { font-size: 12px; color: var(--text-sub); }
.cell-date { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); white-space: nowrap; }
.cell-del { padding: 0 6px; }

.btn-del { background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px; border-radius: 4px; opacity: 0.5; transition: opacity 0.15s; }
.btn-del:hover { opacity: 1; }

/* 상태 뱃지 */
.status-badge {
  display: inline-block; padding: 2px 9px; border-radius: 12px;
  font-size: 11px; font-weight: 600; white-space: nowrap;
}
.st-receipt  { background: #E0E0E0; color: #555; }
.st-review   { background: #FFF3E0; color: #E65100; }
.st-progress { background: #E3F2FD; color: #1565C0; }
.st-done     { background: #E8F5E9; color: #2E7D32; }
.st-reject   { background: #FFEBEE; color: #B71C1C; }

/* 아코디언 답변 */
.reply-row td { padding: 0; border-bottom: 1px solid var(--border); }
.reply-box {
  background: #FAFAF7;
  padding: 14px 20px;
  border-top: 1px solid #E8E0D4;
}
.reply-label { font-size: 11px; font-weight: 700; color: #C8A96E; margin-bottom: 6px; letter-spacing: 0.5px; }
.reply-text { font-size: 13px; color: var(--text); line-height: 1.7; white-space: pre-wrap; }
.reply-date { font-size: 11px; color: var(--text-dim); margin-top: 6px; font-family: var(--font-mono); }
.reply-pending { color: var(--text-dim); font-size: 13px; }
</style>
