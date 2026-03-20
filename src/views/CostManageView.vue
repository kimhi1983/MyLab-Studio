<template>
  <div class="cost-manage-page">
    <div class="page-header">
      <h2 class="page-title">원료 단가 관리</h2>
      <p class="page-desc">성분별 단가를 등록하고 처방 원가 계산에 활용하세요.</p>
    </div>

    <!-- 필터 바 -->
    <div class="filter-bar">
      <input
        v-model="searchQuery"
        class="filter-input"
        placeholder="성분명 검색 (INCI명 또는 한글명)..."
        @input="onSearch"
      />
      <label class="toggle-label">
        <input type="checkbox" v-model="onlyMine" @change="loadPrices" />
        <span>내 단가만 보기</span>
      </label>
    </div>

    <!-- 요약 통계 -->
    <div class="stats-bar" v-if="stats">
      <div class="stat-item">
        <span class="stat-label">내 단가 등록</span>
        <span class="stat-value">{{ stats.my_count }}개</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">평균 단가</span>
        <span class="stat-value">₩{{ stats.avg_price?.toLocaleString() }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">최고 단가</span>
        <span class="stat-value">₩{{ stats.max_price?.toLocaleString() }}</span>
      </div>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="cm-loading">
      <span class="cost-spinner"></span>
      <span>불러오는 중...</span>
    </div>

    <!-- 에러 -->
    <div v-else-if="error" class="cm-error">{{ error }}</div>

    <!-- 테이블 -->
    <div v-else class="cm-table-wrap">
      <table class="cm-table">
        <thead>
          <tr>
            <th>INCI명</th>
            <th>한글명</th>
            <th>추정 단가 (₩/kg)</th>
            <th>내 단가 (₩/kg)</th>
            <th>공급사</th>
            <th>메모</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td colspan="7" class="cm-empty">등록된 단가 정보가 없습니다.</td>
          </tr>
          <tr v-for="row in rows" :key="row.inci_name" class="cm-row" @click="openEdit(row)">
            <td class="cm-inci">{{ row.inci_name }}</td>
            <td class="cm-kr">{{ row.korean_name || '—' }}</td>
            <td class="cm-est">{{ row.price_per_kg_estimated ? '₩' + Number(row.price_per_kg_estimated).toLocaleString() : '—' }}</td>
            <td class="cm-my">
              <span v-if="row.user_price" class="my-price-tag">₩{{ Number(row.user_price).toLocaleString() }}</span>
              <span v-else class="no-price">—</span>
            </td>
            <td class="cm-supplier">{{ row.supplier || '—' }}</td>
            <td class="cm-note">{{ row.note || '—' }}</td>
            <td class="cm-actions" @click.stop>
              <button v-if="row.user_price" class="btn-del" @click="deletePrice(row)" title="삭제">✕</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 페이지네이션 -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" :disabled="page === 1" @click="page--; loadPrices()">‹</button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="page === totalPages" @click="page++; loadPrices()">›</button>
      </div>
    </div>

    <!-- 단가 입력/수정 모달 -->
    <Teleport to="body">
      <div v-if="modalRow" class="price-modal-overlay" @click.self="modalRow = null">
        <div class="price-modal">
          <div class="price-modal-header">
            <span class="price-modal-title">단가 {{ modalRow.user_price ? '수정' : '등록' }}</span>
            <button class="price-modal-close" @click="modalRow = null">×</button>
          </div>
          <div class="price-modal-body">
            <div class="pf-group">
              <label class="pf-label">성분명 (INCI)</label>
              <input class="pf-input pf-readonly" :value="modalRow.inci_name" readonly />
            </div>
            <div class="pf-group">
              <label class="pf-label">단가 (₩/kg) <span class="pf-req">*</span></label>
              <input v-model.number="modalPrice" class="pf-input" type="number" min="0" placeholder="예: 1800000" />
            </div>
            <div class="pf-group">
              <label class="pf-label">공급사 <span class="pf-opt">(선택)</span></label>
              <input v-model="modalSupplier" class="pf-input" placeholder="예: BASF, LG화학" />
            </div>
            <div class="pf-group">
              <label class="pf-label">메모 <span class="pf-opt">(선택)</span></label>
              <input v-model="modalNote" class="pf-input" placeholder="예: 2026년 계약가" />
            </div>
          </div>
          <div class="price-modal-footer">
            <button class="btn-pm-cancel" @click="modalRow = null">취소</button>
            <button class="btn-pm-save" :disabled="!modalPrice" @click="savePrice">저장</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAPI } from '../composables/useAPI.js'

const api = useAPI()
const loading = ref(false)
const error = ref('')
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 30
const searchQuery = ref('')
const onlyMine = ref(false)
const stats = ref(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

let searchTimer = null
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadPrices() }, 300)
}

async function loadPrices() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: page.value,
      limit: pageSize,
      search: searchQuery.value,
      myOnly: onlyMine.value ? 'true' : 'false',
    })
    const res = await api.fetchJSON(`/api/ingredients/prices?${params}`)
    rows.value = res.items || []
    total.value = res.total || 0
    if (res.my_count != null) {
      const prices = rows.value.filter(r => r.user_price).map(r => Number(r.user_price))
      stats.value = {
        my_count: res.my_count,
        avg_price: prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : null,
        max_price: prices.length ? Math.max(...prices) : null,
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

// 수정 모달
const modalRow = ref(null)
const modalPrice = ref(null)
const modalSupplier = ref('')
const modalNote = ref('')

function openEdit(row) {
  modalRow.value = row
  modalPrice.value = row.user_price || null
  modalSupplier.value = row.supplier || ''
  modalNote.value = row.note || ''
}

async function savePrice() {
  if (!modalPrice.value) return
  try {
    await api.fetchJSON('/api/ingredients/price', {
      method: 'PUT',
      body: JSON.stringify({
        inci_name: modalRow.value.inci_name,
        price_per_kg: modalPrice.value,
        supplier: modalSupplier.value,
        note: modalNote.value,
      }),
    })
    modalRow.value = null
    await loadPrices()
  } catch (e) {
    alert('저장 실패: ' + e.message)
  }
}

async function deletePrice(row) {
  if (!confirm(`"${row.inci_name}" 내 단가를 삭제하시겠습니까?`)) return
  try {
    await api.fetchJSON(`/api/ingredients/price/${encodeURIComponent(row.inci_name)}`, { method: 'DELETE' })
    await loadPrices()
  } catch (e) {
    alert('삭제 실패: ' + e.message)
  }
}

onMounted(loadPrices)
</script>

<style scoped>
.cost-manage-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px;
}

.page-header { margin-bottom: 24px; }
.page-title { font-size: 22px; font-weight: 700; color: var(--text, #222); margin: 0 0 4px; }
.page-desc  { font-size: 13px; color: var(--text-dim, #999); margin: 0; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.filter-input {
  flex: 1;
  max-width: 400px;
  height: 40px;
  border: 1.5px solid #E8E0D4;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--text, #222);
  background: var(--bg, #fafaf8);
  outline: none;
}
.filter-input:focus { border-color: #C8A96E; }

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-sub, #555);
  cursor: pointer;
  user-select: none;
}

.stats-bar {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: #F9F5EE;
  border-radius: 8px;
  margin-bottom: 16px;
}

.stat-item { display: flex; flex-direction: column; gap: 2px; }
.stat-label { font-size: 11px; color: var(--text-dim, #999); font-weight: 600; text-transform: uppercase; }
.stat-value { font-size: 16px; font-weight: 700; color: var(--text, #222); }

.cm-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim, #999);
  font-size: 14px;
  padding: 40px 0;
}

.cost-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #E8E0D4;
  border-top-color: #C8A96E;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.cm-error { color: #c0392b; font-size: 14px; padding: 20px 0; }

.cm-table-wrap { overflow-x: auto; }

.cm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.cm-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim, #999);
  text-transform: uppercase;
  border-bottom: 2px solid #E8E0D4;
  white-space: nowrap;
}

.cm-row {
  cursor: pointer;
  transition: background 0.15s;
}
.cm-row:hover { background: #FBF8F3; }
.cm-row td {
  padding: 10px 12px;
  border-bottom: 1px solid #F5F0E8;
  color: var(--text, #222);
  vertical-align: middle;
}

.cm-inci { font-weight: 500; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-kr   { color: var(--text-sub, #555); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cm-est  { color: var(--text-dim, #999); }
.cm-note { color: var(--text-dim, #999); max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.my-price-tag {
  display: inline-block;
  padding: 2px 10px;
  background: #EBF2FB;
  color: #4A7EC7;
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
}
.no-price { color: var(--text-dim, #ccc); }

.btn-del {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim, #bbb);
  font-size: 12px;
  padding: 3px 6px;
  border-radius: 4px;
}
.btn-del:hover { color: #c0392b; background: #FDE8E8; }

.cm-empty {
  text-align: center;
  padding: 40px;
  color: var(--text-dim, #999);
  font-size: 14px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 0;
}

.page-btn {
  width: 32px; height: 32px;
  border: 1.5px solid #E8E0D4;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--text-sub, #555);
  display: flex; align-items: center; justify-content: center;
}
.page-btn:disabled { opacity: 0.4; cursor: default; }
.page-btn:not(:disabled):hover { border-color: #C8A96E; color: #C8A96E; }

.page-info { font-size: 13px; color: var(--text-sub, #555); }

/* 모달 */
.price-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.price-modal {
  background: var(--surface, #fff);
  border-radius: 12px;
  width: 380px;
  max-width: 92vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

.price-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid #E8E0D4;
}

.price-modal-title { font-size: 15px; font-weight: 700; color: var(--text, #222); }
.price-modal-close {
  background: none; border: none; font-size: 20px; cursor: pointer;
  color: var(--text-dim, #999); line-height: 1; padding: 0 4px;
}

.price-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }

.pf-group { display: flex; flex-direction: column; gap: 5px; }
.pf-label { font-size: 12px; font-weight: 600; color: var(--text-sub, #555); }
.pf-req   { color: #e74c3c; }
.pf-opt   { color: var(--text-dim, #999); font-weight: 400; }

.pf-input {
  height: 38px;
  border: 1.5px solid #E8E0D4;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--text, #222);
  background: var(--bg, #fafaf8);
  outline: none;
  transition: border-color 0.2s;
}
.pf-input:focus  { border-color: #C8A96E; }
.pf-readonly     { background: #F5F0E8; color: var(--text-sub, #555); cursor: default; }

.price-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px 18px;
  border-top: 1px solid #E8E0D4;
}

.btn-pm-cancel {
  height: 36px; padding: 0 18px; border: 1.5px solid #E8E0D4; border-radius: 8px;
  background: none; color: var(--text-sub, #555); font-size: 13px; cursor: pointer;
}
.btn-pm-cancel:hover { background: #F5F0E8; }

.btn-pm-save {
  height: 36px; padding: 0 22px; border: none; border-radius: 8px;
  background: #C8A96E; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
}
.btn-pm-save:hover  { background: #a87d4a; }
.btn-pm-save:disabled { background: #E8E0D4; cursor: not-allowed; }
</style>
