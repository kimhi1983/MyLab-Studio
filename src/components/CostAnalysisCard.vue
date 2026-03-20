<template>
  <div class="cost-card">
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

      <!-- TOP3 고가 성분 -->
      <div v-if="result.top3_expensive?.length" class="cost-top3">
        <div class="cost-section-label">고가 성분 TOP 3</div>
        <div class="cost-top3-list">
          <div v-for="(item, i) in result.top3_expensive" :key="item.inci_name" class="cost-top3-row">
            <span class="top3-rank">{{ i + 1 }}</span>
            <span class="top3-name">{{ item.inci_name }}</span>
            <span class="top3-pct">{{ item.percentage.toFixed(2) }}%</span>
            <span class="top3-contrib">₩{{ item.cost_contribution.toLocaleString() }}</span>
            <span v-if="item.price_source === '내 단가'" class="tag-my">내 단가</span>
          </div>
        </div>
      </div>

      <!-- 원가 구성 바 (상위 5개) -->
      <div v-if="top5.length" class="cost-bar-section">
        <div class="cost-section-label">원가 구성</div>
        <div class="cost-bars">
          <div v-for="item in top5" :key="item.inci_name" class="cost-bar-row">
            <span class="bar-name">{{ item.inci_name.length > 22 ? item.inci_name.slice(0, 22) + '…' : item.inci_name }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(item) + '%', background: barColor(item.price_source) }"></div>
            </div>
            <span class="bar-pct">{{ barPct(item) }}%</span>
            <button class="btn-edit-price" @click="openModal(item)" title="단가 수정">✎</button>
          </div>
        </div>
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAPI } from '../composables/useAPI.js'

const props = defineProps({
  ingredients: { type: Array, default: () => [] },
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

const top5 = computed(() => {
  if (!result.value?.cost_breakdown) return []
  return [...result.value.cost_breakdown]
    .sort((a, b) => b.cost_contribution - a.cost_contribution)
    .slice(0, 5)
})

const maxContrib = computed(() => Math.max(...(top5.value.map(i => i.cost_contribution)), 1))

function barWidth(item) {
  return Math.round((item.cost_contribution / maxContrib.value) * 100)
}
function barPct(item) {
  const total = result.value?.total_cost_per_kg || 1
  return ((item.cost_contribution / total) * 100).toFixed(1)
}
function barColor(source) {
  return source === '내 단가' ? '#4A7EC7' : '#C8A96E'
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
      // fetchJSON이 null 반환 = API 실패. api.error.value에 메시지 있음
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
}

@keyframes spin { to { transform: rotate(360deg); } }

.cost-error { font-size: 13px; color: #c0392b; }

.cost-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cost-label-sm {
  font-size: 11px;
  color: var(--text-dim, #999);
  display: block;
  margin-bottom: 2px;
}

.cost-value {
  font-size: 24px;
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

.cost-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

/* TOP 3 */
.cost-top3 { margin-bottom: 16px; }

.cost-top3-list { display: flex; flex-direction: column; gap: 5px; }

.cost-top3-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.top3-rank {
  width: 20px;
  height: 20px;
  background: #F5F0E8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #C8A96E;
  flex-shrink: 0;
}

.top3-name { flex: 1; color: var(--text, #222); font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top3-pct  { color: var(--text-dim, #999); font-size: 12px; flex-shrink: 0; }
.top3-contrib { color: var(--accent, #C8A96E); font-weight: 600; flex-shrink: 0; }

.tag-my {
  font-size: 10px;
  padding: 1px 7px;
  background: #EBF2FB;
  color: #4A7EC7;
  border-radius: 8px;
  font-weight: 600;
  flex-shrink: 0;
}

/* 바 차트 */
.cost-bar-section { margin-bottom: 14px; }
.cost-bars { display: flex; flex-direction: column; gap: 7px; }

.cost-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.bar-name { width: 130px; flex-shrink: 0; color: var(--text, #222); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; height: 8px; background: #F5F0E8; border-radius: 4px; overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 4px; transition: width 0.4s; }
.bar-pct   { width: 36px; text-align: right; color: var(--text-dim, #999); flex-shrink: 0; }

.btn-edit-price {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim, #999);
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  flex-shrink: 0;
}
.btn-edit-price:hover { color: var(--accent, #C8A96E); background: #F5F0E8; }

.cost-note {
  font-size: 11px;
  color: var(--text-dim, #999);
  text-align: center;
  padding-top: 4px;
  border-top: 1px solid #F5F0E8;
  margin-top: 10px;
}

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
