<template>
  <div class="formula-list-page">
    <!-- Filters -->
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">상태</label>
          <select v-model="filterStatus" class="filter-select">
            <option value="">전체</option>
            <option value="draft">초안</option>
            <option value="review">검토중</option>
            <option value="done">완료</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">프로젝트</label>
          <select v-model="filterProject" class="filter-select">
            <option value="">전체</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="filter-group search-group">
          <input v-model="searchQuery" class="filter-input" placeholder="처방명, 제형으로 검색...">
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="panel">
      <!-- 총 처방 수 -->
      <div class="list-meta">
        총 <strong>{{ allFiltered.length }}</strong>개 처방
      </div>

      <table class="data-table" v-if="paged.length">
        <thead>
          <tr>
            <th>ID</th>
            <th>처방명</th>
            <th>제형</th>
            <th>성분 수</th>
            <th>상태</th>
            <th>프로젝트</th>
            <th>수정일</th>
            <th style="width:40px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in paged" :key="f.id" @click="$router.push('/formulas/' + f.id)">
            <td class="cell-id">{{ f.id }}</td>
            <td class="cell-title">{{ f.title }}</td>
            <td>{{ f.product_type || '-' }}</td>
            <td class="cell-num">{{ f.formula_data?.ingredients?.length || 0 }}</td>
            <td><StatusChip :status="f.status" /></td>
            <td class="cell-project">{{ getProjectName(f.project_id) }}</td>
            <td class="cell-date">{{ formatDate(f.updated_at) }}</td>
            <td class="cell-del" @click.stop>
              <button class="btn-del" @click="confirmDelete(f)" title="삭제">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else icon="⚗" title="처방이 없습니다" subtitle="새 처방을 작성해보세요">
        <router-link to="/formulas/new" class="btn btn-primary" style="display:inline-block;margin-top:8px">새 처방 작성</router-link>
      </EmptyState>

      <!-- 페이지네이션 -->
      <div v-if="pageCount > 1" class="pagination">
        <button class="pg-btn" :disabled="currentPage === 1" @click="currentPage--">←</button>
        <template v-for="pg in pageNumbers" :key="pg">
          <span v-if="pg === '...'" class="pg-ellipsis">…</span>
          <button
            v-else
            class="pg-btn"
            :class="{ active: pg === currentPage }"
            @click="currentPage = pg"
          >{{ pg }}</button>
        </template>
        <button class="pg-btn" :disabled="currentPage === pageCount" @click="currentPage++">→</button>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal-box">
          <div class="modal-header">
            <span class="modal-title">처방 삭제</span>
            <button class="modal-close" @click="deleteTarget = null">×</button>
          </div>
          <div class="modal-body">
            <div class="del-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#F44336" stroke-width="1.5"/>
                <path d="M12 7v6M12 15.5v.5" stroke="#F44336" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="del-msg">
              <strong>'{{ deleteTarget.title }}'</strong> 처방을 삭제하시겠습니까?
            </p>
            <p class="del-warn">이 작업은 되돌릴 수 없습니다.</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="deleteTarget = null">취소</button>
            <button class="btn-confirm-del" :disabled="isDeleting" @click="doDelete">
              {{ isDeleting ? '삭제 중...' : '삭제' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useProjectStore } from '../stores/projectStore.js'
import { useToast } from '../composables/useToast.js'
import StatusChip from '../components/common/StatusChip.vue'
import EmptyState from '../components/common/EmptyState.vue'

const { searchFormulas, deleteFormula } = useFormulaStore()
const { projects } = useProjectStore()
const { addToast } = useToast()

const filterStatus = ref('')
const filterProject = ref('')
const searchQuery = ref('')

const deleteTarget = ref(null)
const isDeleting = ref(false)

// ── 페이지네이션 ──
const PAGE_SIZE = 20
const currentPage = ref(1)

const allFiltered = computed(() =>
  searchFormulas(searchQuery.value, {
    status: filterStatus.value || undefined,
    project_id: filterProject.value || undefined,
  })
)

const pageCount = computed(() => Math.ceil(allFiltered.value.length / PAGE_SIZE) || 1)

const paged = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return allFiltered.value.slice(start, start + PAGE_SIZE)
})

// 필터 변경 시 1페이지로 리셋
watch([filterStatus, filterProject, searchQuery], () => { currentPage.value = 1 })

// 페이지 번호 배열 (ellipsis 포함)
const pageNumbers = computed(() => {
  const total = pageCount.value
  const cur = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set([1, total, cur])
  for (let d = 1; d <= 2; d++) {
    if (cur - d >= 1) pages.add(cur - d)
    if (cur + d <= total) pages.add(cur + d)
  }
  const sorted = [...pages].sort((a, b) => a - b)

  const result = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('...')
    result.push(sorted[i])
  }
  return result
})

function getProjectName(id) {
  if (!id) return '-'
  const p = projects.value.find(p => p.id === id)
  return p ? p.name : '-'
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function confirmDelete(formula) {
  deleteTarget.value = formula
}

async function doDelete() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    deleteFormula(deleteTarget.value.id)
    addToast('처방이 삭제되었습니다', 'success')
    deleteTarget.value = null
    // 현재 페이지가 비게 되면 이전 페이지로
    if (paged.value.length === 0 && currentPage.value > 1) currentPage.value--
  } catch (e) {
    addToast('삭제 실패: ' + e.message, 'error')
  } finally {
    isDeleting.value = false
  }
}
</script>

<style scoped>
.filter-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
}
.filter-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); }
.filter-select, .filter-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  min-width: 120px;
}
.filter-select:focus, .filter-input:focus { border-color: var(--accent); outline: none; }
.search-group { flex: 1; min-width: 200px; }
.search-group .filter-input { width: 100%; }

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

/* 총 처방 수 */
.list-meta {
  padding: 10px 16px 8px;
  font-size: 12px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
}
.list-meta strong { color: var(--text); font-weight: 600; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  background: var(--bg);
  font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1px;
  color: var(--text-dim); padding: 8px 16px; text-align: left;
}
.data-table td { padding: 10px 16px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
.data-table tbody tr { cursor: pointer; }
.data-table tbody tr:hover { background: var(--bg); }
.cell-id { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
.cell-title { font-weight: 500; }
.cell-num { font-family: var(--font-mono); text-align: center; }
.cell-project { font-size: 12px; color: var(--text-sub); }
.cell-date { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); }

/* 삭제 버튼 */
.cell-del { padding: 0 8px; }
.btn-del {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  padding: 5px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.btn-del:hover { color: #F44336; background: #FFF0EF; }

/* 페이지네이션 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}
.pg-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-sub);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pg-btn:hover:not(:disabled):not(.active) {
  background: var(--bg);
  border-color: var(--accent-dim);
  color: var(--text);
}
.pg-btn.active {
  background: #C8A96E;
  color: #fff;
  border-color: #C8A96E;
  font-weight: 700;
  cursor: default;
}
.pg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.pg-ellipsis {
  color: var(--text-dim);
  font-size: 13px;
  padding: 0 2px;
  user-select: none;
}

/* 모달 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  background: var(--surface);
  border-radius: 12px;
  width: 380px;
  max-width: 92vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}
.modal-title { font-size: 15px; font-weight: 700; color: var(--text); }
.modal-close {
  background: none; border: none; font-size: 20px; cursor: pointer;
  color: var(--text-dim); line-height: 1; padding: 0 4px;
}
.modal-close:hover { color: var(--text); }
.modal-body {
  padding: 24px 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.del-icon { margin-bottom: 4px; }
.del-msg { font-size: 14px; color: var(--text); line-height: 1.6; }
.del-warn { font-size: 12px; color: var(--text-dim); }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border);
}
.btn-cancel {
  height: 36px; padding: 0 18px;
  border: 1.5px solid var(--border); border-radius: 8px;
  background: none; color: var(--text-sub); font-size: 13px; cursor: pointer;
}
.btn-cancel:hover { background: var(--bg); }
.btn-confirm-del {
  height: 36px; padding: 0 22px;
  border: none; border-radius: 8px;
  background: #F44336; color: #fff;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.btn-confirm-del:hover:not(:disabled) { background: #d32f2f; }
.btn-confirm-del:disabled { opacity: 0.6; cursor: not-allowed; }

.btn { padding: 8px 16px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; }
.btn-primary { background: var(--accent); color: #fff; }
</style>
