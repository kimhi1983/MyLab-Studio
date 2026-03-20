<template>
  <div class="cost-card" :class="{ 'cost-card-compact': compact }">

    <!-- ── compact 모드: 1줄 요약 ── -->
    <template v-if="compact">
      <div v-if="loading" class="cc-loading">
        <span class="cost-spinner"></span>
        <span>원가 계산 중...</span>
      </div>
      <div v-else-if="result" class="cc-summary-line">
        <span class="cc-label">예상 원가</span>
        <span class="cc-value">₩{{ result.total_cost_per_kg.toLocaleString() }}/kg</span>
        <span class="cc-grade" :class="gradeClass">{{ result.price_grade }}</span>
        <span v-if="top2.length" class="cc-sep">|</span>
        <span class="cc-top2">
          <span v-for="(item, i) in top2" :key="item.inci_name">
            <span class="cc-ing-name">{{ shortName(item.inci_name) }}</span>
            <span class="cc-ing-cost"> ₩{{ item.cost_contribution.toLocaleString() }}</span>
            <span v-if="i < top2.length - 1" class="cc-dot"> · </span>
          </span>
        </span>
        <span v-if="myPriceCount > 0" class="cc-my">내 단가 {{ myPriceCount }}개</span>
      </div>
      <div v-else-if="error" class="cc-error-line">원가 계산 실패</div>
    </template>

    <!-- ── full 모드: 테이블 ── -->
    <template v-else>
      <!-- 헤더 -->
      <div class="cost-header">
        <span class="cost-title">예상 원가</span>
        <span v-if="myPriceCount > 0" class="my-price-badge">내 단가 {{ myPriceCount }}개 적용</span>
      </div>

      <!-- 로딩 -->
      <div v-if="loading" class="cost-loading">
        <span class="cost-spinner"></span>
        <span>원가 계산 중...</span>
      </div>

      <!-- 에러 -->
      <div v-else-if="error" class="cost-error">원가 계산 실패: {{ error }}</div>

      <!-- 결과 -->
      <template v-else-if="result">
        <!-- 총액 + 등급 -->
        <div class="cost-summary">
          <div class="cost-amount">
            <span class="cost-label-sm">1kg 기준</span>
            <span class="cost-value">₩{{ result.total_cost_per_kg.toLocaleString() }}</span>
          </div>
          <span class="cost-grade" :class="gradeClass">{{ result.price_grade }}</span>
        </div>

        <!-- 성분별 테이블 -->
        <div class="cost-table-wrap">
          <table class="cost-table">
            <thead>
              <tr>
                <th>성분명</th>
                <th class="th-r">사용량</th>
                <th class="th-r">단가(/kg)</th>
                <th class="th-r">금액</th>
                <th class="th-edit"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in sortedBreakdown" :key="item.inci_name">
                <td class="ct-name">
                  {{ item.inci_name.length > 26 ? item.inci_name.slice(0, 26) + '…' : item.inci_name }}
                  <span v-if="item.price_source === '내 단가'" class="tag-my">내</span>
                </td>
                <td class="ct-r ct-pct">{{ item.percentage.toFixed(2) }}%</td>
                <td class="ct-r ct-price">₩{{ Number(item.price_per_kg).toLocaleString() }}</td>
                <td class="ct-r ct-contrib">₩{{ item.cost_contribution.toLocaleString() }}</td>
                <td class="ct-edit">
                  <button class="btn-edit-price" @click="openModal(item)" title="단가 수정">✎</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 안내 -->
        <div class="cost-note">추정 단가 기준, 실제와 다를 수 있습니다</div>
      </template>

      <!-- 단가 입력 모달 -->
      <Teleport to="body">
        <div v-if="modalItem" class="price-modal-overlay" @click.self="modalItem = null">
          <div class="price-modal">
            <div class="price-modal-header">
              <span class="price-modal-title">단가 입력</span>
              <button class="price-modal-close" @click="modalItem = null">×</button>
            </div>
            <div class="price-modal-body">
              <div class="pf-group">
                <label class="pf-label">성분명 (INCI)</label>
                <input class="pf-input pf-readonly" :value="modalItem.inci_name" readonly />
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
              <button class="btn-pm-cancel" @click="modalItem = null">취소</button>
              <button class="btn-pm-save" :disabled="!modalPrice" @click="savePrice">저장</button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAPI } from '../composables/useAPI.js'

const props = defineProps({
  ingredients: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
})

const api = useAPI()
const loading = ref(false)
const error = ref('')
const result = ref(null)

const modalItem = ref(null)
const modalPrice = ref(null)
const modalSupplier = ref('')
const modalNote = ref('')

const myPriceCount = computed(() => result.value?.my_price_count || 0)

// 금액 높은 순 정렬
const sortedBreakdown = computed(() => {
  if (!result.value?.cost_breakdown) return []
  return [...result.value.cost_breakdown].sort((a, b) => b.cost_contribution - a.cost_contribution)
})

// compact용 상위 2개
const top2 = computed(() => sortedBreakdown.value.slice(0, 2))

function shortName(name) {
  return name.length > 18 ? name.slice(0, 18) + '…' : name
}

const gradeClass = computed(() => {
  const g = result.value?.price_grade
  if (g === '고가') return 'grade-high'
  if (g === '중상') return 'grade-mid-high'
  if (g === '중') return 'grade-mid'
  if (g === '중저') return 'grade-mid-low'
  return 'grade-low'
})

async function fetchCost() {
  if (!props.ingredients?.length) return
  loading.value = true
  error.value = ''
  try {
    const res = await api.fetchJSON('/api/formula/cost-analysis', {
      method: 'POST',
      body: JSON.stringify({ ingredients: props.ingredients }),
    })
    if (res) {
      result.value = res
    } else {
      error.value = api.error.value || '원가 계산 실패'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openModal(item) {
  modalItem.value = item
  modalPrice.value = item.price_per_kg || null
  modalSupplier.value = ''
  modalNote.value = ''
}

async function savePrice() {
  if (!modalPrice.value) return
  try {
    await api.fetchJSON('/api/ingredients/price', {
      method: 'PUT',
      body: JSON.stringify({
        inci_name: modalItem.value.inci_name,
        price_per_kg: modalPrice.value,
        supplier: modalSupplier.value,
        note: modalNote.value,
      }),
    })
    modalItem.value = null
    await fetchCost()
  } catch (e) {
    alert('단가 저장 실패: ' + e.message)
  }
}

watch(() => props.ingredients, (v) => { if (v?.length) fetchCost() }, { deep: true })
onMounted(() => { if (props.ingredients?.length) fetchCost() })
</script>

<style scoped>
/* ── compact 1줄 ── */
.cost-card-compact {
  border: 1px solid #E8E0D4;
  border-radius: 8px;
  padding: 10px 16px;
  background: var(--surface, #fff);
  margin-top: 12px;
}

.cc-loading {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-dim, #999);
}

.cc-summary-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}

.cc-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.cc-value {
  font-weight: 700;
  color: var(--text, #222);
  flex-shrink: 0;
}

.cc-grade {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}

.cc-sep { color: #ddd; flex-shrink: 0; }

.cc-top2 {
  font-size: 12px;
  color: var(--text-sub, #666);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
}

.cc-ing-name { font-weight: 500; }
.cc-ing-cost { color: #C8A96E; font-weight: 600; }
.cc-dot { color: #ccc; margin: 0 2px; }

.cc-my {
  font-size: 10px;
  padding: 1px 7px;
  background: #EBF2FB;
  color: #4A7EC7;
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
}

.cc-error-line { font-size: 12px; color: #c0392b; }

/* ── full 모드 ── */
.cost-card {
  border: 1px solid #E8E0D4;
  border-radius: 10px;
  padding: 18px 20px;
  background: var(--surface, #fff);
  margin-top: 16px;
}

.cost-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.cost-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-sub, #666);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.my-price-badge {
  font-size: 11px;
  padding: 2px 10px;
  background: #EBF2FB;
  color: #4A7EC7;
  border-radius: 10px;
  font-weight: 600;
}

.cost-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim, #999);
  padding: 8px 0;
}

.cost-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #E8E0D4;
  border-top-color: #C8A96E;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.cost-error { font-size: 13px; color: #c0392b; }

.cost-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.cost-label-sm {
  font-size: 11px;
  color: var(--text-dim, #999);
  display: block;
  margin-bottom: 2px;
}

.cost-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text, #222);
  letter-spacing: -0.5px;
}

.cost-grade {
  font-size: 13px;
  font-weight: 700;
  padding: 4px 14px;
  border-radius: 12px;
}

.grade-high    { background: #FDE8E8; color: #C0392B; }
.grade-mid-high{ background: #FDF3E8; color: #B8730A; }
.grade-mid     { background: #FFF9E6; color: #8A6A00; }
.grade-mid-low { background: #EAF5EA; color: #2A7A2A; }
.grade-low     { background: #EBF5FB; color: #2471A3; }

/* 성분 테이블 */
.cost-table-wrap {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #F0EDE8;
  border-radius: 8px;
  margin-bottom: 12px;
}

.cost-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.cost-table thead th {
  background: #FAF8F4;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-dim, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 6px 10px;
  position: sticky;
  top: 0;
  text-align: left;
  border-bottom: 1px solid #F0EDE8;
}

.th-r { text-align: right; }
.th-edit { width: 28px; }

.cost-table tbody tr:hover { background: #FAF8F4; }
.cost-table tbody td {
  padding: 6px 10px;
  border-bottom: 1px solid #F5F2EE;
  color: var(--text, #222);
}
.cost-table tbody tr:last-child td { border-bottom: none; }

.ct-name { max-width: 160px; }
.ct-r { text-align: right; font-family: var(--font-mono, monospace); }
.ct-pct { color: var(--text-sub, #666); }
.ct-price { color: var(--text-sub, #666); }
.ct-contrib { font-weight: 600; color: #C8A96E; }
.ct-edit { width: 28px; text-align: center; }

.tag-my {
  font-size: 9px;
  padding: 0px 5px;
  background: #EBF2FB;
  color: #4A7EC7;
  border-radius: 6px;
  font-weight: 600;
  margin-left: 4px;
}

.btn-edit-price {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim, #bbb);
  font-size: 12px;
  padding: 1px 3px;
  border-radius: 3px;
}
.btn-edit-price:hover { color: #C8A96E; background: #F5F0E8; }

.cost-note {
  font-size: 11px;
  color: var(--text-dim, #999);
  text-align: center;
  padding-top: 4px;
  border-top: 1px solid #F5F0E8;
  margin-top: 4px;
}

/* 모달 */
.price-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
}
.price-modal {
  background: var(--surface, #fff);
  border-radius: 12px; width: 380px; max-width: 92vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.price-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 14px; border-bottom: 1px solid #E8E0D4;
}
.price-modal-title { font-size: 15px; font-weight: 700; color: var(--text, #222); }
.price-modal-close {
  background: none; border: none; font-size: 20px; cursor: pointer;
  color: var(--text-dim, #999); line-height: 1; padding: 0 4px;
}
.price-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
.pf-group { display: flex; flex-direction: column; gap: 5px; }
.pf-label { font-size: 12px; font-weight: 600; color: var(--text-sub, #555); }
.pf-req { color: #e74c3c; }
.pf-opt { color: var(--text-dim, #999); font-weight: 400; }
.pf-input {
  height: 38px; border: 1.5px solid #E8E0D4; border-radius: 8px;
  padding: 0 12px; font-size: 14px; color: var(--text, #222);
  background: var(--bg, #fafaf8); outline: none; transition: border-color 0.2s;
}
.pf-input:focus { border-color: #C8A96E; }
.pf-readonly { background: #F5F0E8; color: var(--text-sub, #555); cursor: default; }
.price-modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 20px 18px; border-top: 1px solid #E8E0D4;
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
.btn-pm-save:hover { background: #a87d4a; }
.btn-pm-save:disabled { background: #E8E0D4; cursor: not-allowed; }
</style>
