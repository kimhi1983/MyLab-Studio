<template>
  <div class="validation-page">

    <!-- 처방 선택 + 검증 실행 -->
    <div class="panel">
      <div class="panel-header">
        <div>
          <span class="section-label">QA VALIDATION</span>
          <span class="section-title">품질 검증</span>
        </div>
      </div>
      <div class="form-body">
        <div class="select-row">
          <div class="form-group flex-1">
            <label class="form-label">처방 선택</label>
            <select v-model="selectedFormulaId" class="form-input">
              <option value="">검증할 처방을 선택하세요</option>
              <option v-for="f in formulaList" :key="f.id" :value="f.id">
                {{ f.title }} ({{ f.product_type }})
              </option>
            </select>
          </div>
          <div class="form-group btn-group">
            <label class="form-label">&nbsp;</label>
            <button
              class="btn btn-primary"
              @click="runValidation"
              :disabled="!selectedFormulaId || isValidating"
            >
              {{ isValidating ? '검증 중...' : '검증 실행' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 검증 중 로딩 -->
    <div v-if="isValidating" class="loading-panel">
      <div class="spinner"></div>
      <div class="loading-text">품질 검증 항목 확인 중...</div>
    </div>

    <!-- 자동 검증 결과 -->
    <div v-if="validationResult" class="result-section">

      <!-- 전체 통과 여부 배너 -->
      <div class="overall-banner" :class="overallClass">
        <span class="overall-icon">{{ overallIcon }}</span>
        <div>
          <div class="overall-title">{{ overallTitle }}</div>
          <div class="overall-sub">
            통과 {{ passCount }}건 · 경고 {{ warnCount }}건 · 실패 {{ failCount }}건
          </div>
        </div>
      </div>

      <!-- 검증 항목 카드 목록 -->
      <div class="checks-grid">
        <div
          v-for="check in validationResult.checks"
          :key="check.name"
          class="check-card"
          :class="`check-${check.status}`"
        >
          <div class="check-icon">{{ statusIcon(check.status) }}</div>
          <div class="check-body">
            <div class="check-name">{{ check.name }}</div>
            <div class="check-message">{{ check.message }}</div>
            <div v-if="check.detail" class="check-detail">{{ check.detail }}</div>
          </div>
          <div class="check-badge" :class="`badge-${check.status}`">
            {{ statusLabel(check.status) }}
          </div>
        </div>
      </div>
    </div>

    <!-- API 미연결 안내 -->
    <div v-if="apiError" class="api-notice">
      <span class="notice-icon">!</span>
      <div>
        <div class="notice-title">API 서버 미연결</div>
        <div class="notice-sub">localhost:3001에 연결되지 않았습니다. 검증 결과는 더미 데이터로 표시됩니다.</div>
      </div>
    </div>

    <!-- 수동 체크리스트 -->
    <div class="panel checklist-panel">
      <div class="panel-header">
        <div>
          <span class="section-label">MANUAL CHECKLIST</span>
          <span class="section-title">수동 체크리스트</span>
        </div>
        <div class="progress-info">
          <span class="progress-text">{{ checkedCount }}/{{ checklist.length }} 완료</span>
          <button class="btn-reset" @click="resetChecklist" title="초기화">초기화</button>
        </div>
      </div>

      <!-- 진행률 바 -->
      <div class="progress-bar-wrap">
        <div class="progress-bar" :style="{ width: progressPct + '%' }"></div>
      </div>

      <div class="checklist-body">
        <label
          v-for="item in checklist"
          :key="item.id"
          class="checklist-item"
          :class="{ done: item.checked }"
        >
          <input
            type="checkbox"
            class="check-input"
            v-model="item.checked"
            @change="saveChecklist"
          />
          <span class="check-label">{{ item.label }}</span>
          <span v-if="item.checked" class="done-mark">완료</span>
        </label>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useAPI } from '../composables/useAPI.js'

const { formulas } = useFormulaStore()
const api = useAPI()

const formulaList = computed(() => [...formulas.value].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))

const selectedFormulaId = ref('')
const isValidating = ref(false)
const validationResult = ref(null)
const apiError = ref(false)

// ─── 자동 검증 ───
async function runValidation() {
  if (!selectedFormulaId.value) return
  isValidating.value = true
  validationResult.value = null
  apiError.value = false

  // 선택된 처방의 원료 목록을 서버에 전달
  const formula = formulas.value.find(f => f.id === selectedFormulaId.value)
  const ingredients = (formula?.formula_data?.ingredients || formula?.ingredients || []).map(i => ({
    inci_name: i.inci_name || i.name,
    percentage: i.percentage,
    phase: i.phase || '',
  }))
  const res = await api.validateFormula(ingredients)
  isValidating.value = false

  if (res && res.success !== false) {
    // 서버 응답: { success, data: { checks, passed, ... } }
    validationResult.value = res.data || res
  } else {
    // API 미연결 시 더미 결과 표시
    apiError.value = true
    validationResult.value = makeDummyResult()
  }

  loadChecklist()
}

function makeDummyResult() {
  return {
    checks: [
      { name: '배합비 합계', status: 'pass', message: '총 배합비가 100% 이내입니다.', detail: null },
      { name: '보존제 농도', status: 'pass', message: '보존제 사용 기준 이내입니다.', detail: null },
      { name: '자외선 차단제 한도', status: 'warn', message: '일부 성분의 EU 한도를 확인하세요.', detail: 'Titanium Dioxide EU 한도: 25%' },
      { name: '색소 사용 기준', status: 'pass', message: '허가 색소 사용 확인됨.', detail: null },
      { name: 'pH 적합성', status: 'warn', message: '최종 pH 측정이 필요합니다.', detail: '목표 pH: 5.0~7.0' },
      { name: '금지 성분 검토', status: 'pass', message: '금지 성분 미검출.', detail: null },
    ],
  }
}

const passCount = computed(() => (validationResult.value?.checks || []).filter(c => c.status === 'pass').length)
const warnCount = computed(() => (validationResult.value?.checks || []).filter(c => c.status === 'warn').length)
const failCount = computed(() => (validationResult.value?.checks || []).filter(c => c.status === 'fail').length)

const overallClass = computed(() => {
  if (failCount.value > 0) return 'overall-fail'
  if (warnCount.value > 0) return 'overall-warn'
  return 'overall-pass'
})
const overallIcon = computed(() => {
  if (failCount.value > 0) return '✕'
  if (warnCount.value > 0) return '⚠'
  return '✓'
})
const overallTitle = computed(() => {
  if (failCount.value > 0) return '검증 실패 — 수정이 필요합니다'
  if (warnCount.value > 0) return '경고 항목 확인 필요'
  return '전체 항목 통과'
})

function statusIcon(status) {
  if (status === 'pass') return '✓'
  if (status === 'warn') return '⚠'
  return '✕'
}
function statusLabel(status) {
  if (status === 'pass') return '통과'
  if (status === 'warn') return '경고'
  return '실패'
}

// ─── 수동 체크리스트 ───
const DEFAULT_CHECKLIST = [
  { id: 1, label: '미생물 시험 (총 호기성 생균수)', checked: false },
  { id: 2, label: 'pH 측정 (기준: 5.0~7.0)', checked: false },
  { id: 3, label: '점도 측정 (기준치 이내)', checked: false },
  { id: 4, label: '색상/향 관능 검사', checked: false },
  { id: 5, label: '안정성 시험 시작 (50°C/RT)', checked: false },
  { id: 6, label: '포장 적합성 확인', checked: false },
  { id: 7, label: '라벨 전성분 표기 확인', checked: false },
  { id: 8, label: '규제 서류 준비 (CPNP/식약처)', checked: false },
]

const checklist = ref(DEFAULT_CHECKLIST.map(i => ({ ...i })))

function storageKey(formulaId) {
  return `mylab:checklist:${formulaId || 'global'}`
}

function loadChecklist() {
  const key = storageKey(selectedFormulaId.value)
  const saved = localStorage.getItem(key)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      checklist.value = DEFAULT_CHECKLIST.map(def => ({
        ...def,
        checked: parsed.find(p => p.id === def.id)?.checked ?? false,
      }))
    } catch {
      checklist.value = DEFAULT_CHECKLIST.map(i => ({ ...i }))
    }
  } else {
    checklist.value = DEFAULT_CHECKLIST.map(i => ({ ...i }))
  }
}

function saveChecklist() {
  const key = storageKey(selectedFormulaId.value)
  localStorage.setItem(key, JSON.stringify(checklist.value.map(({ id, checked }) => ({ id, checked }))))
}

function resetChecklist() {
  checklist.value = DEFAULT_CHECKLIST.map(i => ({ ...i }))
  saveChecklist()
}

watch(selectedFormulaId, () => {
  validationResult.value = null
  apiError.value = false
  loadChecklist()
})

const checkedCount = computed(() => checklist.value.filter(i => i.checked).length)
const progressPct = computed(() => Math.round((checkedCount.value / checklist.value.length) * 100))

// 초기 전역 체크리스트 로드
loadChecklist()
</script>

<style scoped>
/* ─── 레이아웃 ─── */
.validation-page { display: flex; flex-direction: column; gap: 16px; }

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.panel-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-label {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-left: 8px;
}

/* ─── 처방 선택 폼 ─── */
.form-body { padding: 20px; }
.select-row { display: flex; gap: 12px; align-items: flex-end; }
.flex-1 { flex: 1; }
.btn-group { flex-shrink: 0; }
.form-group { display: flex; flex-direction: column; }
.form-label { font-size: 12px; color: var(--text-sub); margin-bottom: 4px; font-weight: 600; }
.form-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  height: 36px;
}
.form-input:focus { border-color: var(--accent); outline: none; }
.btn {
  height: 36px;
  padding: 0 20px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-primary { background: var(--accent); color: #fff; box-shadow: 0 2px 8px rgba(184,147,90,0.3); }
.btn-primary:hover:not(:disabled) { background: #a68350; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── 로딩 ─── */
.loading-panel {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  background: var(--accent-light);
  border: 1px solid var(--accent-dim);
  border-radius: var(--radius);
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--accent-dim);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 13px; color: var(--accent); font-weight: 500; }

/* ─── 전체 통과 배너 ─── */
.overall-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-radius: var(--radius);
  border: 1px solid;
}
.overall-pass { background: var(--green-bg); border-color: rgba(58,144,104,0.25); }
.overall-warn { background: var(--amber-bg); border-color: rgba(176,120,32,0.25); }
.overall-fail { background: var(--red-bg); border-color: rgba(196,78,78,0.25); }
.overall-icon {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}
.overall-pass .overall-icon { color: var(--green); }
.overall-warn .overall-icon { color: var(--amber); }
.overall-fail .overall-icon { color: var(--red); }
.overall-title { font-size: 16px; font-weight: 700; color: var(--text); }
.overall-sub { font-size: 12px; color: var(--text-sub); margin-top: 2px; font-family: var(--font-mono); }

/* ─── 검증 항목 카드 ─── */
.result-section { display: flex; flex-direction: column; gap: 12px; }
.checks-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.check-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
}
.check-pass { border-left: 3px solid var(--green); }
.check-warn { border-left: 3px solid var(--amber); }
.check-fail { border-left: 3px solid var(--red); }
.check-icon {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 1px;
}
.check-pass .check-icon { color: var(--green); }
.check-warn .check-icon { color: var(--amber); }
.check-fail .check-icon { color: var(--red); }
.check-body { flex: 1; min-width: 0; }
.check-name { font-size: 13px; font-weight: 600; color: var(--text); }
.check-message { font-size: 12px; color: var(--text-sub); margin-top: 2px; }
.check-detail { font-size: 11px; color: var(--text-dim); margin-top: 4px; font-family: var(--font-mono); }
.check-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
  align-self: flex-start;
}
.badge-pass { background: rgba(58,144,104,0.12); color: var(--green); }
.badge-warn { background: rgba(176,120,32,0.12); color: var(--amber); }
.badge-fail { background: rgba(196,78,78,0.12); color: var(--red); }

/* ─── API 안내 ─── */
.api-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  background: var(--blue-bg);
  border: 1px solid rgba(58,111,168,0.2);
  border-radius: var(--radius);
}
.notice-icon {
  width: 20px; height: 20px;
  background: var(--blue);
  color: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  flex-shrink: 0;
  line-height: 1;
}
.notice-title { font-size: 12px; font-weight: 600; color: var(--blue); }
.notice-sub { font-size: 11px; color: var(--text-sub); margin-top: 2px; }

/* ─── 수동 체크리스트 ─── */
.checklist-panel { }
.progress-info { display: flex; align-items: center; gap: 12px; }
.progress-text { font-size: 12px; font-family: var(--font-mono); color: var(--text-sub); font-weight: 600; }
.btn-reset {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}
.btn-reset:hover { background: var(--bg); color: var(--text-sub); }
.progress-bar-wrap {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.checklist-body { padding: 8px 20px 16px; display: flex; flex-direction: column; gap: 2px; }
.checklist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}
.checklist-item:hover { background: var(--bg); }
.check-input {
  width: 16px; height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}
.check-label {
  font-size: 13px;
  color: var(--text);
  flex: 1;
  transition: all 0.15s;
}
.checklist-item.done .check-label {
  text-decoration: line-through;
  color: var(--text-dim);
}
.done-mark {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--green);
  background: rgba(58,144,104,0.10);
  padding: 2px 7px;
  border-radius: 4px;
  flex-shrink: 0;
}

@media (max-width: 1199px) {
  .checks-grid { grid-template-columns: 1fr; }
}
@media (max-width: 767px) {
  .select-row { flex-direction: column; }
  .btn-group { width: 100%; }
  .btn-group .btn { width: 100%; }
}
</style>
