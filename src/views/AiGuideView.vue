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
      >카피 처방</button>
    </div>

    <!-- ─── 가이드 처방 탭 ─── -->
    <template v-if="activeTab === 'guide'">
      <div class="panel">
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
            <button class="btn btn-primary btn-lg" @click="onGuideGenerate" :disabled="isGenerating">
              {{ isGenerating ? '생성 중...' : '✦ MyLab 처방 생성하기' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 로딩 -->
      <div v-if="isGenerating" class="loading-panel">
        <div class="loading-box">
          <div class="spinner"></div>
          <div class="loading-title">MyLab 처방 생성 중...</div>
          <div class="loading-step">{{ progress }}</div>
        </div>
      </div>

      <!-- 결과 -->
      <div v-if="guideResult" style="margin-top: 16px">
        <AiResultPanel :result="guideResult" @save="onSave" @regenerate="onGuideGenerate" />
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
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useIngredientStore } from '../stores/ingredientStore.js'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useAPI } from '../composables/useAPI.js'
import { productTypes, productCategories } from '../tokens.js'
import AiResultPanel from '../components/formula/AiResultPanel.vue'
import CopyFormulaView from './CopyFormulaView.vue'

const router = useRouter()
const ingredientStore = useIngredientStore()
const { addFormula } = useFormulaStore()
const api = useAPI()

// ─── 탭 ───
const activeTab = ref('guide')

// ─── 가이드 처방 ───
const isGenerating = ref(false)
const progress = ref('')
const guide = reactive({ title: '', productType: '', requirements: '' })
const guideResult = ref(null)
const history = ref([])

async function onGuideGenerate() {
  if (!guide.title.trim() || !guide.productType) {
    alert('처방명과 제품 유형을 입력하세요')
    return
  }
  isGenerating.value = true
  const steps = ['원료 검색 중...', '규제 정보 확인 중...', '배합비 최적화 중...', '최종 처방 생성 중...']
  for (const step of steps) {
    progress.value = step
    await new Promise(r => setTimeout(r, 500 + Math.random() * 400))
  }

  // /api/ai-formula 우선 시도, 실패 시 기존 generateFormula 폴백
  let res = await api.generateAiFormula({
    title: guide.title,
    productType: guide.productType,
    requirements: guide.requirements,
  })
  if (!res) {
    res = await ingredientStore.generateFormula(guide.productType, guide.requirements)
  }

  isGenerating.value = false
  progress.value = ''

  if (res) {
    guideResult.value = res
    const typeLabel = productTypes.find(t => t.value === guide.productType)?.label || guide.productType
    history.value.unshift({ ...res, _title: guide.title, _productLabel: typeLabel })
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

/* ─── 로딩 ─── */
.loading-panel {
  margin-top: 16px;
  background: var(--accent-light);
  border: 1px solid var(--accent-dim);
  border-radius: var(--radius);
  padding: 40px 20px;
  text-align: center;
}
.loading-box { display: inline-block; }
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--accent-dim);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-title { font-size: 14px; font-weight: 600; color: var(--accent); margin-bottom: 4px; }
.loading-step { font-size: 13px; color: var(--text-sub); }

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
