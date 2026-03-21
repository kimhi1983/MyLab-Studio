<template>
  <div class="ai-guide-page">

    <!-- 탭 헤더 -->
    <div class="tab-header">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'guide' }"
        @click="activeTab = 'guide'"
      >가이드 처방</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'copy' }"
        @click="activeTab = 'copy'"
      >벤치마크</button>
    </div>

    <!-- ─── 가이드 처방 탭 ─── -->
    <template v-if="activeTab === 'guide'">
      <!-- 폼: 로딩 중에는 숨김 -->
      <div v-if="!isGenerating" class="panel">
        <div class="panel-header">
          <div>
            <span class="section-label">REQUEST</span>
            <span class="section-title">처방 요청</span>
          </div>
        </div>
        <div class="form-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">처방명 *</label>
              <input v-model="guide.title" class="form-input" placeholder="예: 고보습 세럼">
            </div>
            <div class="form-group">
              <label class="form-label">제품 유형 *</label>
              <select v-model="guide.productType" class="form-input">
                <option value="">선택하세요</option>
                <optgroup v-for="cat in productCategories" :key="cat.group" :label="cat.group">
                  <option v-for="t in cat.items" :key="t.value" :value="t.value">{{ t.label }}</option>
                </optgroup>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">처방 방향</label>
            <input v-model="guide.requirements" class="form-input" placeholder="예: 보습 강화, 민감 피부용, 약산성">
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-lg" @click="onGuideGenerate">
              ✦ MyLab 처방 생성하기
            </button>
          </div>
        </div>
      </div>

      <!-- 비커 로딩 애니메이션 -->
      <div v-if="isGenerating" class="beaker-loading-panel">
        <FormulaLoadingBeaker :step="loadingStep" />
        <div class="beaker-title">MyLab 처방 생성 중</div>
      </div>

      <!-- 결과 -->
      <div v-if="guideResult" style="margin-top: 16px">
        <AiResultPanel :result="guideResult" @save="onSave" @regenerate="onGuideGenerate" />

        <!-- ── 처방서 / 전성분 탭 패널 ── -->
        <div class="formula-panel" style="margin-top: 14px">
          <div class="formula-panel-header">
            <div class="formula-tabs">
              <button :class="['ftab', { active: formulaTab === 'input' }]" @click="formulaTab = 'input'">
                처방서 <span class="ftab-sub">투입기준</span>
              </button>
              <button :class="['ftab', { active: formulaTab === 'inci' }]" @click="formulaTab = 'inci'">
                전성분 <span class="ftab-sub">표기기준</span>
              </button>
            </div>

            <!-- pH 예상 배너 -->
            <div v-if="phResult" class="ph-banner" :class="phBannerClass">
              예상 pH: {{ phResult.estimated_ph ?? '—' }}
              <span v-if="phResult.conflicts?.length" class="ph-conflict-count">
                · 충돌 {{ phResult.conflicts.length }}건
              </span>
              <span v-if="phResult.recommended_adjuster" class="ph-adjuster">
                → {{ phResult.recommended_adjuster }} 권장
              </span>
            </div>
            <div v-else-if="phLoading" class="ph-banner ph-loading">pH 계산 중...</div>
          </div>

          <!-- pH 충돌 상세 -->
          <div v-if="phResult?.conflicts?.length" class="ph-conflicts">
            <div v-for="c in phResult.conflicts" :key="c.inci_a" class="ph-conflict-row">
              ⚠ {{ c.inci_a }} × {{ c.inci_b }} — {{ c.reason }}
            </div>
          </div>

          <!-- 탭1: 처방서 (투입기준) -->
          <div v-if="formulaTab === 'input'" class="ftab-body">
            <table class="formula-table">
              <thead>
                <tr>
                  <th>원료명 (투입기준)</th>
                  <th>%</th>
                  <th>기능</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ing in guideResult.ingredients" :key="ing.inci_name || ing.name">
                  <td class="cell-ing-name">
                    {{ ing.name || ing.inci_name }}
                    <span v-if="isCompound(ing.name)" class="compound-badge">복합원료 → 전개 예정</span>
                  </td>
                  <td class="cell-pct mono-text">{{ (ing.percentage ?? ing.wt_pct)?.toFixed(2) }}%</td>
                  <td class="cell-fn">{{ ing.function || ing.function_inci || '—' }}</td>
                  <td class="cell-note">{{ ing.type || '—' }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" class="total-row">
                    합계: {{ formulaTotal.toFixed(2) }}%
                    <span v-if="Math.abs(formulaTotal - 100) > 0.1" class="total-warn">⚠ 100% 불일치</span>
                  </td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- 탭2: 전성분 (표기기준, 내림차순) -->
          <div v-if="formulaTab === 'inci'" class="ftab-body">
            <div v-if="inciLoading" class="inci-loading">전성분 전개 중...</div>
            <table v-else class="formula-table">
              <thead>
                <tr>
                  <th>INCI Name (표기기준)</th>
                  <th>wt%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, i) in expandedInci" :key="i">
                  <td class="cell-inci-name">{{ item.inci_name }}</td>
                  <td class="cell-pct mono-text">{{ item.wt_pct?.toFixed(4) }}%</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td class="total-row">합계: {{ inciTotal.toFixed(2) }}%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- 이력 -->
      <div v-if="history.length" class="history-section">
        <div class="section-label" style="margin-bottom: 12px">MYLAB HISTORY · 생성 이력</div>
        <div class="history-grid">
          <div class="history-card" v-for="(h, i) in history" :key="i" @click="guideResult = h">
            <div class="hist-date">{{ formatDate(h.generatedAt) }}</div>
            <div class="hist-title">{{ h._title || '처방' }}</div>
            <div class="hist-type">{{ h._productLabel }}</div>
            <div class="hist-count">성분 {{ h.ingredients?.length || 0 }}개</div>
          </div>
        </div>
      </div>
    </template>

    <!-- ─── 카피 처방 탭 ─── -->
    <template v-if="activeTab === 'copy'">
      <CopyFormulaView />
    </template>

  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIngredientStore } from '../stores/ingredientStore.js'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useAPI } from '../composables/useAPI.js'
import { productTypes, productCategories } from '../tokens.js'
import AiResultPanel from '../components/formula/AiResultPanel.vue'
import FormulaLoadingBeaker from '../components/formula/FormulaLoadingBeaker.vue'
import CopyFormulaView from './CopyFormulaView.vue'

const router = useRouter()
const ingredientStore = useIngredientStore()
const { addFormula } = useFormulaStore()
const api = useAPI()

// ─── 탭 ───
const activeTab = ref('guide')

// ─── 가이드 처방 ───
const isGenerating = ref(false)
const loadingStep = ref(1)       // 1~4: 비커 단계
const progress = ref('')
const guide = reactive({ title: '', productType: '', requirements: '' })
const guideResult = ref(null)
const history = ref([])

// ─── 처방서/전성분 탭 ───
const formulaTab = ref('input')
const expandedInci = ref([])
const inciLoading = ref(false)
const phResult = ref(null)
const phLoading = ref(false)
const compoundNames = ref(new Set())  // compound_master 상품명 목록

const formulaTotal = computed(() => {
  if (!guideResult.value?.ingredients) return 0
  return guideResult.value.ingredients.reduce((s, i) => s + (i.percentage ?? i.wt_pct ?? 0), 0)
})

const inciTotal = computed(() =>
  expandedInci.value.reduce((s, i) => s + (i.wt_pct ?? 0), 0)
)

const phBannerClass = computed(() => {
  const ph = phResult.value?.estimated_ph
  if (ph == null) return ''
  if (ph >= 4.5 && ph <= 7.5) return 'ph-safe'
  if (ph >= 3.5 && ph <= 8.5) return 'ph-warn'
  return 'ph-danger'
})

function isCompound(name) {
  if (!name) return false
  return compoundNames.value.has(name.toLowerCase())
}

async function loadFormulaExtras(ingredients) {
  // 1) compound_master 목록 로드 (캐시)
  if (compoundNames.value.size === 0) {
    const compounds = await api.getCompoundsList()
    if (compounds) {
      compoundNames.value = new Set(compounds.map(c => c.trade_name?.toLowerCase()))
    }
  }

  // 2) pH 체크
  phLoading.value = true
  const phIngredients = ingredients.map(i => ({
    inci_name: i.inci_name || i.name,
    wt_pct: i.percentage ?? i.wt_pct ?? 0,
  }))
  const phRes = await api.phCheck(phIngredients)
  phResult.value = phRes
  phLoading.value = false

  // 3) 전성분 전개
  inciLoading.value = true
  const expandIngredients = ingredients.map(i => ({
    name: i.name || i.inci_name,
    wt_pct: i.percentage ?? i.wt_pct ?? 0,
    is_compound: isCompound(i.name),
  }))
  const expanded = await api.expandInci(expandIngredients)
  expandedInci.value = expanded?.formula_inci || []
  inciLoading.value = false
}

async function onGuideGenerate() {
  if (!guide.title.trim() || !guide.productType) {
    alert('처방명과 제품 유형을 입력하세요')
    return
  }

  // ── 비커 로딩 시작 ──
  isGenerating.value = true
  loadingStep.value = 1

  // API 실행 중 단계 1→2→3 자동 전환 (각 1.4s 간격)
  const stepTimer = setInterval(() => {
    if (loadingStep.value < 3) loadingStep.value++
  }, 1400)

  // API 호출: /api/ai-formula 우선, 실패 시 guide-formula 폴백
  let res = await api.generateAiFormula({
    title: guide.title,
    productType: guide.productType,
    requirements: guide.requirements,
  })
  if (!res) {
    res = await ingredientStore.generateFormula(guide.productType, guide.requirements)
  }

  clearInterval(stepTimer)

  // 단계 4 (완성!) 표시 후 0.6s 대기
  loadingStep.value = 4
  await new Promise(r => setTimeout(r, 600))

  isGenerating.value = false
  loadingStep.value = 1

  if (res) {
    guideResult.value = res
    formulaTab.value = 'input'
    expandedInci.value = []
    phResult.value = null
    const typeLabel = productTypes.find(t => t.value === guide.productType)?.label || guide.productType
    history.value.unshift({ ...res, _title: guide.title, _productLabel: typeLabel })
    if (res.ingredients?.length) {
      loadFormulaExtras(res.ingredients)
    }
  } else {
    alert('처방 생성 실패: API 서버 연결을 확인하세요 (localhost:3001)')
  }
}

function onSave() {
  if (!guideResult.value) return
  const typeLabel = productTypes.find(t => t.value === guide.productType)?.label || guide.productType
  const created = addFormula({
    title: guide.title || 'MyLab 생성 처방',
    product_type: typeLabel,
    formula_data: {
      ingredients: guideResult.value.ingredients.map(i => ({
        name: i.name, inci_name: i.inci_name, percentage: i.percentage, function: i.function,
      })),
      total_percentage: guideResult.value.totalPercentage,
      notes: guideResult.value.description,
    },
    memo: `원료 ${guideResult.value.totalDbIngredients ?? '-'}종 · 규제확인 ${guideResult.value.regulationsChecked ?? '-'}건\n${guideResult.value.description || ''}`,
    tags: ['스마트처방'],
  })
  router.push('/formulas/' + created.id)
}

// ─── 카피 처방은 CopyFormulaView 컴포넌트로 위임 ───

// ─── 공통 ───
function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
/* ─── 탭 헤더 ─── */
.tab-header {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius) var(--radius) 0 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius) var(--radius) 0 0;
  width: fit-content;
}
.tab-btn {
  padding: 10px 24px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-right: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 0;
}
.tab-btn:last-child { border-right: none; }
.tab-btn:hover { color: var(--text-sub); background: var(--bg); }
.tab-btn.active {
  color: var(--accent);
  font-weight: 600;
  background: var(--accent-light);
}

/* ─── 패널 ─── */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 var(--radius) var(--radius) var(--radius);
  box-shadow: var(--shadow);
}
.panel-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.section-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-dim); }
.section-title { font-size: 13px; font-weight: 600; color: var(--text); margin-left: 8px; }

/* ─── 폼 ─── */
.form-body { padding: 20px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { margin-bottom: 12px; }
.form-label { font-size: 12px; color: var(--text-sub); margin-bottom: 4px; display: block; font-weight: 600; }
.form-input {
  width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; color: var(--text); background: var(--surface);
  box-sizing: border-box;
}
.form-input:focus { border-color: var(--accent); outline: none; }
.form-textarea { resize: vertical; min-height: 72px; line-height: 1.5; }

/* ─── 버튼 ─── */
.form-actions { margin-top: 8px; display: flex; justify-content: center; }
.btn { padding: 10px 20px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-primary { background: var(--accent); color: #fff; box-shadow: 0 2px 8px rgba(184,147,90,0.3); }
.btn-primary:hover:not(:disabled) { background: #a68350; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-lg { padding: 14px 32px; font-size: 14px; }

/* ─── 비커 로딩 ─── */
.beaker-loading-panel {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.beaker-title {
  font-size: 13px;
  font-family: var(--font-mono, monospace);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--text-dim);
}
.loading-title { font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 4px; }
.loading-step { font-size: 13px; color: var(--text-sub); }

/* ─── 처방서/전성분 탭 패널 ─── */
.formula-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.formula-panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-wrap: wrap;
}

.formula-tabs {
  display: flex;
  gap: 4px;
}

.ftab {
  padding: 6px 16px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ftab:hover { border-color: var(--accent); color: var(--accent); }
.ftab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.ftab-sub { font-size: 10px; font-weight: 400; opacity: 0.8; }

/* pH 배너 */
.ph-banner {
  flex: 1;
  padding: 5px 12px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.ph-safe    { background: var(--green-bg); color: var(--green); border-color: #b8dece; }
.ph-warn    { background: var(--amber-bg); color: var(--amber); border-color: #e8d4a0; }
.ph-danger  { background: var(--red-bg);   color: var(--red);   border-color: #e8b8b8; }
.ph-loading { background: var(--bg); color: var(--text-dim); border-color: var(--border); }
.ph-conflict-count { margin-left: 8px; font-weight: 700; }
.ph-adjuster { margin-left: 8px; font-weight: 400; }

.ph-conflicts {
  padding: 6px 16px;
  border-bottom: 1px solid var(--border);
  background: rgba(196,78,78,0.04);
}
.ph-conflict-row {
  font-size: 11.5px;
  color: var(--red);
  padding: 2px 0;
}

.ftab-body {
  padding: 0;
  overflow-x: auto;
}

.formula-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.formula-table th {
  padding: 8px 14px;
  background: var(--bg);
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}
.formula-table td {
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.formula-table tbody tr:hover { background: var(--bg); }
.formula-table tbody tr:last-child td { border-bottom: none; }

.cell-ing-name { font-weight: 500; color: var(--text); }
.cell-inci-name { font-family: var(--font-mono); font-size: 11.5px; color: var(--text); }
.cell-pct { font-family: var(--font-mono); font-size: 12px; font-weight: 600; white-space: nowrap; }
.cell-fn  { font-size: 11.5px; color: var(--text-sub); }
.cell-note { font-size: 11px; color: var(--text-dim); }

.total-row {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
}
.total-warn { color: var(--red); margin-left: 8px; font-weight: 600; }

/* 복합원료 배지 */
.compound-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  background: rgba(184,147,90,0.15);
  color: var(--amber);
  border: 1px solid rgba(184,147,90,0.35);
  margin-left: 7px;
  vertical-align: middle;
}

.inci-loading {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
}

/* ─── 이력 ─── */
.history-section { margin-top: 24px; }
.history-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.history-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 16px; cursor: pointer; transition: all 0.15s;
}
.history-card:hover { border-color: var(--accent-dim); }
.hist-date { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); }
.hist-title { font-size: 14px; font-weight: 600; margin-top: 4px; color: var(--text); }
.hist-type { font-size: 12px; color: var(--text-sub); }
.hist-count { font-size: 11px; color: var(--text-dim); margin-top: 4px; }

@media (max-width: 1199px) {
  .form-row { grid-template-columns: 1fr; }
  .history-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 767px) {
  .history-grid { grid-template-columns: 1fr; }
  .market-options { flex-wrap: wrap; }
}
</style>
