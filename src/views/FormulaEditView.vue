<template>
  <div class="formula-edit-page">
    <div class="page-top">
      <router-link to="/formulas" class="back-link">← 목록으로</router-link>
      <div class="page-title-row">
        <div>
          <h2 class="page-title">{{ isNew ? '새 처방 작성' : formula.title }}</h2>
          <div class="page-sub" v-if="!isNew">{{ formula.id }} · {{ formula.product_type || '미지정' }}</div>
        </div>
        <div class="title-actions">
          <!-- 버전 배지 -->
          <span v-if="!isNew" class="version-badge">
            v{{ currentVersion }}
          </span>

          <!-- 버전 히스토리 드롭다운 -->
          <div v-if="!isNew && versionHistory.length > 0" class="version-dropdown-wrap">
            <button class="btn-version-history" @click="toggleVersionPanel">
              히스토리 ({{ versionHistory.length }}) ▾
            </button>
            <div v-if="showVersionPanel" class="version-panel">
              <div class="version-panel-header">
                <span class="version-panel-title">버전 히스토리</span>
                <button class="version-panel-close" @click="showVersionPanel = false">×</button>
              </div>
              <div class="version-list">
                <div
                  v-for="(snap, i) in [...versionHistory].reverse()"
                  :key="i"
                  class="version-item"
                >
                  <div class="version-item-info">
                    <span class="version-item-num">v{{ snap.version }}</span>
                    <span class="version-item-title">{{ snap.title }}</span>
                    <span class="version-item-date">{{ formatDate(snap.saved_at) }}</span>
                  </div>
                  <button
                    class="btn-compare"
                    @click="onCompareVersion(snap)"
                  >비교</button>
                  <button
                    class="btn-restore"
                    @click="onRestoreVersion(versionHistory.length - 1 - i)"
                  >복원</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 버전 저장 버튼 -->
          <button v-if="!isNew" class="btn-save-version" @click="onSaveVersion">
            버전 저장
          </button>

          <StatusChip v-if="!isNew" :status="formula.status" />
          <button v-if="!isNew" class="btn-export" @click="onExportCsv" title="CSV 파일로 다운로드">CSV 내보내기</button>
          <button v-if="!isNew" class="btn-export" @click="onExportPdf" title="인쇄용 PDF 미리보기">PDF 인쇄</button>
          <button v-if="!isNew" class="btn-danger" @click="onDelete">삭제</button>
        </div>
      </div>
    </div>

    <!-- Basic Info -->
    <div class="form-grid">
      <div class="panel">
        <div class="panel-header">
          <span class="section-label">FORMULA INFO</span>
          <span class="section-title">기본 정보</span>
        </div>
        <div class="form-body">
          <div class="form-group">
            <label class="form-label">처방명 *</label>
            <input v-model="form.title" class="form-input" placeholder="처방명을 입력하세요">
          </div>
          <div class="form-group">
            <label class="form-label">제품 유형</label>
            <input
              v-model="form.product_type"
              list="product-type-list"
              class="form-input"
              placeholder="선택 또는 직접 입력"
            >
            <datalist id="product-type-list">
              <option v-for="t in allProductOptions" :key="t.value" :value="t.label">{{ t.group }} — {{ t.label }}</option>
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">프로젝트</label>
            <select v-model="form.project_id" class="form-input">
              <option value="">없음</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <!-- 전성분 자동 채우기 -->
          <div class="form-group ai-fill-group">
            <label class="form-label">추가 요구사항 (선택)</label>
            <input v-model="aiRequirements" class="form-input" placeholder="예: 고보습, 민감성 피부, 비건">
            <button
              class="btn-ai-fill"
              :disabled="!form.product_type || isAiFilling"
              @click="onAiFill"
            >
              <span v-if="isAiFilling" class="ai-spinner"></span>
              {{ isAiFilling ? aiFillStep : '전성분 자동 채우기' }}
            </button>
            <div v-if="!form.product_type" class="ai-hint">제품 유형을 먼저 선택하세요</div>
          </div>
        </div>
      </div>

      <!-- 물성 / 안정성 스펙 패널 (항상 표시, 편집 가능) -->
      <div class="panel">
        <div class="panel-header">
          <span class="section-label">PHYSICAL SPEC</span>
          <span class="section-title">물성 · 안정성</span>
          <span v-if="!form.product_type" class="props-hint">제품 유형을 선택하면 기본값이 채워집니다</span>
        </div>
        <div class="props-body">
          <div class="props-grid">
            <div class="prop-item" v-for="p in physicalPropsFields" :key="p.key">
              <span class="prop-label">{{ p.label }}</span>
              <input
                v-model="physicalProps[p.key]"
                class="prop-input"
                :placeholder="p.placeholder || '—'"
              >
            </div>
          </div>
          <div class="props-section">
            <div class="props-section-title">안정성 시험 조건</div>
            <div class="stability-item" v-for="(st, i) in physicalProps.stability" :key="i">
              <span class="stab-cond">{{ st.condition }}</span>
              <input v-model="st.period" class="stab-input" placeholder="기간">
              <button
                class="stab-toggle"
                :class="st.expected === 'pass' ? 'pass' : 'warn'"
                @click="st.expected = st.expected === 'pass' ? 'warn' : 'pass'"
                :title="st.expected === 'pass' ? '적합 → 관찰로 변경' : '관찰 → 적합으로 변경'"
              >{{ st.expected === 'pass' ? '적합' : '관찰' }}</button>
            </div>
          </div>
          <div class="props-section">
            <div class="props-section-title">미생물 한도</div>
            <input v-model="physicalProps.micro" class="micro-input" placeholder="예: 총 호기성 생균수 ≤ 500 CFU/g">
          </div>
        </div>
      </div>

      <!-- Status (기존 처방) -->
      <div class="panel" v-if="!isNew">
        <div class="panel-header">
          <span class="section-label">STATUS</span>
          <span class="section-title">상태 변경</span>
        </div>
        <div class="status-stepper">
          <button v-for="s in statuses" :key="s.value" class="step-btn"
            :class="{ active: form.status === s.value }"
            :style="form.status === s.value ? { background: s.bg, color: s.color, borderColor: s.border } : {}"
            @click="form.status = s.value">
            {{ s.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Ingredient Table -->
    <div style="margin-top: 16px">
      <IngredientTable :ingredients="form.formula_data.ingredients" :editable="true"
        @update:ingredients="val => form.formula_data.ingredients = val" />
    </div>

    <!-- pH 예측 + 방부제 효력 -->
    <div v-if="form.formula_data.ingredients.length >= 2" class="panel" style="margin-top: 16px">
      <div class="panel-header">
        <span class="section-label">PH PREDICTION</span>
        <span class="section-title">pH 예측 · 방부제 효력</span>
      </div>
      <div class="ph-body">
        <!-- pH 예측 바 -->
        <div class="ph-bar-wrap">
          <div class="ph-bar">
            <div class="ph-range" :style="phRangeStyle"></div>
            <div class="ph-marker" v-for="n in 15" :key="n" :style="{ left: ((n-1)/14*100) + '%' }">
              <span class="ph-mark-num">{{ n - 1 }}</span>
            </div>
          </div>
          <div class="ph-result">
            예상 pH: <strong>{{ phPrediction.minPh.toFixed(1) }} ~ {{ phPrediction.maxPh.toFixed(1) }}</strong>
          </div>
          <div class="ph-notes" v-for="note in phPrediction.notes" :key="note">{{ note }}</div>
        </div>

        <!-- 방부제 효력 -->
        <div v-if="preservativeResults.length" class="preserv-section">
          <div class="preserv-title">방부제 pH 적합성</div>
          <div v-for="p in preservativeResults" :key="p.inci" class="preserv-item" :class="'preserv-' + p.status">
            <span class="preserv-icon">{{ p.status === 'ok' ? '✓' : p.status === 'warning' ? '⚠' : '⛔' }}</span>
            <div class="preserv-info">
              <span class="preserv-name">{{ p.name }} (유효 pH {{ p.phRange }})</span>
              <span class="preserv-msg">{{ p.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 유사 제품 검색 -->
    <div v-if="form.formula_data.ingredients.length >= 2" class="panel" style="margin-top: 16px">
      <div class="panel-header">
        <span class="section-label">SIMILAR PRODUCTS</span>
        <span class="section-title">유사 제품 검색</span>
        <button class="btn-search-similar" @click="onSearchSimilar" :disabled="isSearchingSimilar">
          {{ isSearchingSimilar ? '검색 중...' : '유사 제품 찾기' }}
        </button>
      </div>
      <div class="similar-body">
        <div v-if="!similarProducts.length && !isSearchingSimilar" class="similar-empty">
          현재 처방의 INCI 성분을 기준으로 DB에서 유사 제품을 검색합니다.
        </div>
        <div v-if="similarProducts.length" class="similar-list">
          <div v-for="(prod, idx) in similarProducts" :key="prod.id || idx" class="similar-item">
            <div class="similar-rank">{{ idx + 1 }}</div>
            <div class="similar-info">
              <span class="similar-name">{{ prod.product_name || prod.name }}</span>
              <span class="similar-brand" v-if="prod.brand">{{ prod.brand }}</span>
              <span class="similar-category" v-if="prod.category">{{ prod.category }}</span>
            </div>
            <div class="similar-match">
              <span class="similar-match-count">{{ prod.matchCount || prod.match_count || 0 }}개 일치</span>
              <span class="similar-match-bar">
                <span class="similar-match-fill" :style="{ width: similarMatchPct(prod) + '%' }"></span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 배치 스케일러 -->
    <div v-if="form.formula_data.ingredients.length >= 1" class="panel" style="margin-top: 16px">
      <div class="panel-header">
        <span class="section-label">BATCH SCALER</span>
        <span class="section-title">배치 스케일 계산</span>
      </div>
      <div class="batch-body">
        <div class="batch-inputs">
          <div class="batch-field">
            <label class="batch-label">현재 배치 (g)</label>
            <input v-model.number="batchCurrentG" class="form-input batch-input" type="number" placeholder="100">
          </div>
          <span class="batch-arrow">→</span>
          <div class="batch-field">
            <label class="batch-label">목표 배치 (g)</label>
            <input v-model.number="batchTargetG" class="form-input batch-input" type="number" placeholder="1000">
          </div>
          <button class="btn-batch-calc" @click="onCalcBatch" :disabled="!batchCurrentG || !batchTargetG">
            계산
          </button>
        </div>
        <div v-if="batchResult.length" class="batch-table-wrap">
          <div class="batch-scale-info">
            스케일 팩터: <strong>×{{ batchScaleFactor }}</strong>
          </div>
          <table class="batch-table">
            <thead>
              <tr>
                <th>원료명</th>
                <th>배합비 (%)</th>
                <th>{{ batchCurrentG }}g 배치</th>
                <th>{{ batchTargetG }}g 배치</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in batchResult" :key="idx">
                <td class="batch-name">{{ row.name }}</td>
                <td class="batch-pct">{{ row.percentage }}%</td>
                <td class="batch-g">{{ row.currentGrams }}g</td>
                <td class="batch-g batch-target">{{ row.targetGrams }}g</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td class="batch-name"><strong>합계</strong></td>
                <td class="batch-pct"><strong>{{ batchTotalPct }}%</strong></td>
                <td class="batch-g"><strong>{{ batchTotalCurrentG }}g</strong></td>
                <td class="batch-g batch-target"><strong>{{ batchTotalTargetG }}g</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Memo -->
    <div class="panel" style="margin-top: 16px">
      <div class="panel-header">
        <span class="section-label">MEMO</span>
        <span class="section-title">메모</span>
        <button v-if="form.memo" class="btn-memo-expand" @click="showMemoModal = true" title="메모 확대 보기">확대 ↗</button>
      </div>
      <div class="memo-body">
        <textarea v-model="form.memo" class="memo-textarea" placeholder="메모를 입력하세요..." rows="8"></textarea>
      </div>
    </div>

    <!-- Diff 모달 -->
    <Teleport to="body">
      <div v-if="showDiffModal" class="memo-modal-overlay" @click.self="showDiffModal = false">
        <div class="memo-modal diff-modal">
          <div class="memo-modal-header">
            <span class="memo-modal-title">
              버전 비교: v{{ diffData.oldVersion }} → 현재 (v{{ currentVersion }})
            </span>
            <button class="memo-modal-close" @click="showDiffModal = false">×</button>
          </div>
          <div class="memo-modal-body diff-body">

            <!-- 기본 정보 변경 -->
            <div class="diff-section">
              <div class="diff-section-title">기본 정보 변경</div>
              <div v-if="diffData.meta.length === 0" class="diff-empty">변경 없음</div>
              <div v-for="m in diffData.meta" :key="m.field" class="diff-meta-row">
                <span class="diff-field">{{ m.field }}</span>
                <span class="diff-old">{{ m.old || '(없음)' }}</span>
                <span class="diff-arrow">→</span>
                <span class="diff-new">{{ m.new || '(없음)' }}</span>
              </div>
            </div>

            <!-- 원료 변경 -->
            <div class="diff-section">
              <div class="diff-section-title">원료 변경</div>

              <!-- 추가된 원료 -->
              <template v-if="diffData.added.length > 0">
                <div class="diff-group-label diff-label-add">추가된 원료 ({{ diffData.added.length }})</div>
                <div v-for="ing in diffData.added" :key="'add-' + (ing.inci_name || ing.name)" class="diff-row diff-row-add">
                  <span class="diff-sign">+</span>
                  <span class="diff-ing-name">{{ ing.name }}</span>
                  <span class="diff-ing-inci">{{ ing.inci_name }}</span>
                  <span class="diff-ing-pct">{{ diffTotal(ing.percentage) }}%</span>
                  <span class="diff-ing-fn">{{ ing.function }}</span>
                  <span v-if="ing.phase" class="diff-ing-phase">{{ ing.phase }}</span>
                </div>
              </template>

              <!-- 삭제된 원료 -->
              <template v-if="diffData.removed.length > 0">
                <div class="diff-group-label diff-label-remove">삭제된 원료 ({{ diffData.removed.length }})</div>
                <div v-for="ing in diffData.removed" :key="'rem-' + (ing.inci_name || ing.name)" class="diff-row diff-row-remove">
                  <span class="diff-sign">-</span>
                  <span class="diff-ing-name">{{ ing.name }}</span>
                  <span class="diff-ing-inci">{{ ing.inci_name }}</span>
                  <span class="diff-ing-pct">{{ diffTotal(ing.percentage) }}%</span>
                  <span class="diff-ing-fn">{{ ing.function }}</span>
                  <span v-if="ing.phase" class="diff-ing-phase">{{ ing.phase }}</span>
                </div>
              </template>

              <!-- 변경된 원료 -->
              <template v-if="diffData.changed.length > 0">
                <div class="diff-group-label diff-label-change">변경된 원료 ({{ diffData.changed.length }})</div>
                <div v-for="c in diffData.changed" :key="'chg-' + (c.new.inci_name || c.new.name)" class="diff-row diff-row-change">
                  <span class="diff-sign">~</span>
                  <span class="diff-ing-name">{{ c.new.name }}</span>
                  <span class="diff-ing-inci">{{ c.new.inci_name }}</span>
                  <span class="diff-ing-pct">
                    <span class="diff-pct-old">{{ diffTotal(c.old.percentage) }}%</span>
                    <span class="diff-arrow-sm">→</span>
                    <span class="diff-pct-new">{{ diffTotal(c.new.percentage) }}%</span>
                    <span v-if="Number(c.old.percentage) !== Number(c.new.percentage)" class="diff-delta">
                      ({{ diffDelta(c.old.percentage, c.new.percentage) }}%)
                    </span>
                  </span>
                  <span v-if="c.old.phase !== c.new.phase" class="diff-phase-change">
                    Phase: {{ c.old.phase || '-' }} → {{ c.new.phase || '-' }}
                  </span>
                </div>
              </template>

              <!-- 변경 없는 원료 -->
              <template v-if="diffData.unchanged.length > 0">
                <div class="diff-group-label diff-label-unchanged">변경 없는 원료 ({{ diffData.unchanged.length }})</div>
                <div v-for="ing in diffData.unchanged" :key="'unc-' + (ing.inci_name || ing.name)" class="diff-row diff-row-unchanged">
                  <span class="diff-sign">=</span>
                  <span class="diff-ing-name">{{ ing.name }}</span>
                  <span class="diff-ing-inci">{{ ing.inci_name }}</span>
                  <span class="diff-ing-pct">{{ diffTotal(ing.percentage) }}%</span>
                </div>
              </template>

              <div v-if="diffData.added.length === 0 && diffData.removed.length === 0 && diffData.changed.length === 0" class="diff-empty">원료 변경 없음</div>
            </div>

            <!-- 총 배합비 -->
            <div class="diff-total-row">
              총 배합비:
              <span class="diff-pct-old">{{ diffTotal(diffData.oldTotal) }}%</span>
              <span class="diff-arrow">→</span>
              <span class="diff-pct-new">{{ diffTotal(diffData.newTotal) }}%</span>
              <span class="diff-delta">({{ diffDelta(diffData.oldTotal, diffData.newTotal) }}%)</span>
            </div>

          </div>
        </div>
      </div>
    </Teleport>

    <!-- 메모 확대 모달 -->
    <Teleport to="body">
      <div v-if="showMemoModal" class="memo-modal-overlay" @click.self="showMemoModal = false">
        <div class="memo-modal">
          <div class="memo-modal-header">
            <span class="memo-modal-title">메모 상세</span>
            <button class="memo-modal-close" @click="showMemoModal = false">×</button>
          </div>
          <div class="memo-modal-body">
            <textarea v-model="form.memo" class="memo-modal-textarea"></textarea>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Actions -->
    <div class="form-actions">
      <router-link to="/formulas" class="btn btn-ghost">취소</router-link>
      <button class="btn btn-primary" @click="onSave">{{ isNew ? '초안으로 저장' : '저장' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useProjectStore } from '../stores/projectStore.js'
import { useAPI } from '../composables/useAPI.js'
import { productCategories, statusStyles } from '../tokens.js'
import { useExport } from '../composables/useExport.js'
import StatusChip from '../components/common/StatusChip.vue'
import IngredientTable from '../components/formula/IngredientTable.vue'

const route = useRoute()
const router = useRouter()
const { getById, addFormula, updateFormula, deleteFormula, saveVersion, restoreVersion } = useFormulaStore()
const { projects } = useProjectStore()
const { exportFormulaCsv, exportFormulaPdf } = useExport()
const api = useAPI()

const allProductOptions = computed(() =>
  productCategories.flatMap(cat => cat.items.map(t => ({ ...t, group: cat.group })))
)
const isNew = computed(() => route.name === 'formula-new')
const formula = ref({})
const newTag = ref('')
const showVersionPanel = ref(false)

// AI 자동 채우기
const aiRequirements = ref('')
const isAiFilling = ref(false)
const aiFillStep = ref('')

// 메모 모달
const showMemoModal = ref(false)

// Diff 모달
const showDiffModal = ref(false)
const diffData = ref({ meta: [], added: [], removed: [], changed: [], unchanged: [], oldVersion: null, oldTotal: 0, newTotal: 0 })

function computeDiff(oldSnap, currentForm) {
  const result = { meta: [], added: [], removed: [], changed: [], unchanged: [], oldVersion: oldSnap.version, oldTotal: 0, newTotal: 0 }

  // 기본 정보 비교
  if (oldSnap.title !== currentForm.title)
    result.meta.push({ field: '처방명', old: oldSnap.title, new: currentForm.title })
  if (oldSnap.product_type !== currentForm.product_type)
    result.meta.push({ field: '제품유형', old: oldSnap.product_type, new: currentForm.product_type })
  if (oldSnap.status !== currentForm.status)
    result.meta.push({ field: '상태', old: oldSnap.status, new: currentForm.status })

  // 원료 비교
  const oldIngs = oldSnap.formula_data?.ingredients || []
  const newIngs = currentForm.formula_data?.ingredients || []

  result.oldTotal = oldIngs.reduce((s, i) => s + (Number(i.percentage) || 0), 0)
  result.newTotal = newIngs.reduce((s, i) => s + (Number(i.percentage) || 0), 0)

  const oldMap = new Map(oldIngs.map(i => [i.inci_name || i.name, i]))
  const newMap = new Map(newIngs.map(i => [i.inci_name || i.name, i]))

  for (const [key, newIng] of newMap) {
    if (!oldMap.has(key)) {
      result.added.push(newIng)
    } else {
      const oldIng = oldMap.get(key)
      if (Number(oldIng.percentage) !== Number(newIng.percentage) || oldIng.phase !== newIng.phase) {
        result.changed.push({ old: oldIng, new: newIng })
      } else {
        result.unchanged.push(newIng)
      }
    }
  }
  for (const [key, oldIng] of oldMap) {
    if (!newMap.has(key)) result.removed.push(oldIng)
  }

  return result
}

function onCompareVersion(snap) {
  diffData.value = computeDiff(snap, form)
  showDiffModal.value = true
}

function diffTotal(val) {
  return Number(val).toFixed(1)
}

function diffDelta(oldVal, newVal) {
  const delta = Number(newVal) - Number(oldVal)
  return (delta >= 0 ? '+' : '') + delta.toFixed(1)
}

// 물성·안정성
const physicalProps = reactive({
  ph: '', viscosity: '', hardness: '', specificGravity: '',
  color: '', odor: '', appearance: '', spreadability: '',
  shelfLife: '', storage: '', micro: '',
  stability: [
    { condition: '고온 (45±2℃)', period: '8주', expected: 'pass' },
    { condition: '실온 (25±2℃)', period: '12주', expected: 'pass' },
    { condition: '저온 (4±2℃)', period: '8주', expected: 'pass' },
    { condition: '냉동-해동 반복 (-15℃↔25℃)', period: '3 cycle', expected: 'warn' },
    { condition: '광안정성 (UV 조사)', period: '4주', expected: 'pass' },
  ],
})
const physicalPropsFields = [
  { key: 'ph', label: 'pH', placeholder: '5.5 ~ 7.0' },
  { key: 'viscosity', label: '점도 (cps)', placeholder: '5,000 ~ 50,000' },
  { key: 'hardness', label: '경도', placeholder: '—' },
  { key: 'specificGravity', label: '비중', placeholder: '0.98 ~ 1.05' },
  { key: 'appearance', label: '외관', placeholder: '크림/로션' },
  { key: 'color', label: '색상', placeholder: '백색~미색' },
  { key: 'odor', label: '향', placeholder: '고유의 향' },
  { key: 'spreadability', label: '도포성', placeholder: '양호' },
  { key: 'shelfLife', label: '유통기한', placeholder: '제조일로부터 30개월' },
  { key: 'storage', label: '보관조건', placeholder: '직사광선 차단, 상온(15~25℃)' },
]

// 버전 관련 computed
const currentVersion = computed(() => formula.value.version || 1)
const versionHistory = computed(() => formula.value.version_history || [])

const form = reactive({
  title: '',
  product_type: '',
  project_id: '',
  status: 'draft',
  formula_data: { ingredients: [], total_percentage: 0, notes: '' },
  memo: '',
  tags: [],
})

const statuses = [
  { value: 'draft', label: '초안', ...statusStyles.draft },
  { value: 'review', label: '검토중', ...statusStyles.review },
  { value: 'done', label: '완료', ...statusStyles.done },
]

// 제품 유형 변경 시 물성 기본값 자동 채움
watch(() => form.product_type, (newType) => {
  if (newType) generatePhysicalProps(newType)
})

onMounted(() => {
  if (!isNew.value && route.params.id) {
    const f = getById(route.params.id)
    if (f) {
      formula.value = f
      loadForm(f)
    }
  }
})

function loadForm(f) {
  Object.assign(form, {
    title: f.title,
    product_type: f.product_type,
    project_id: f.project_id,
    status: f.status,
    formula_data: JSON.parse(JSON.stringify(f.formula_data || { ingredients: [], total_percentage: 0, notes: '' })),
    memo: f.memo,
    tags: [...(f.tags || [])],
  })
  // ingredients에 phase 필드가 없는 기존 데이터 호환성 보장
  form.formula_data.ingredients = form.formula_data.ingredients.map(ing => ({
    phase: '',
    ...ing,
  }))
}

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !form.tags.includes(tag)) {
    form.tags.push(tag)
    newTag.value = ''
  }
}

function onSave() {
  if (!form.title.trim()) {
    alert('처방명을 입력하세요')
    return
  }
  form.formula_data.total_percentage = form.formula_data.ingredients.reduce((s, i) => s + (Number(i.percentage) || 0), 0)

  if (isNew.value) {
    const created = addFormula({ ...form })
    router.push('/formulas/' + created.id)
  } else {
    const updated = updateFormula(route.params.id, { ...form })
    if (updated) formula.value = updated
    router.push('/formulas')
  }
}

function onDelete() {
  if (confirm('이 처방을 삭제하시겠습니까?')) {
    deleteFormula(route.params.id)
    router.push('/formulas')
  }
}

function onSaveVersion() {
  if (!route.params.id) return
  const updated = saveVersion(route.params.id)
  if (updated) {
    formula.value = updated
    alert(`v${updated.version - 1} 버전이 저장되었습니다. 현재 버전: v${updated.version}`)
  }
}

function onRestoreVersion(versionIndex) {
  if (!confirm('이 버전으로 복원하시겠습니까? 현재 편집 중인 내용은 덮어씌워집니다.')) return
  const updated = restoreVersion(route.params.id, versionIndex)
  if (updated) {
    formula.value = updated
    loadForm(updated)
    showVersionPanel.value = false
  }
}

function toggleVersionPanel() {
  showVersionPanel.value = !showVersionPanel.value
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function onExportCsv() {
  if (!formula.value?.id) return
  exportFormulaCsv(formula.value)
}

function onExportPdf() {
  if (!formula.value?.id) return
  exportFormulaPdf(formula.value)
}

function getProcessByType(productType) {
  const processes = {
    '토너': [
      '1. Phase A: 정제수에 수용성 원료(글리세린, 히알루론산 등) 투입 → 상온 교반',
      '2. Phase C: 활성성분(나이아신아마이드 등) 투입 → 저속 교반',
      '3. Phase D: 방부제, 향료 투입 → 균일 혼합',
      '4. pH 확인 (5.0~6.5) → 필요시 pH 조절제로 보정',
      '5. 여과 → 충진',
    ],
    '로션': [
      '1. Phase A(수상): 정제수 + 수용성 원료 → 75°C 가열 용해',
      '2. Phase B(유상): 오일 + 유화제 + 왁스류 → 별도 용기 75°C 가열 용해',
      '3. 유화: B상을 A상에 서서히 투입 → 호모믹서 5,000rpm, 5분',
      '4. 냉각: 교반하며 40°C까지 냉각',
      '5. Phase C: 활성성분 투입 → 저속 교반',
      '6. Phase D: 방부제, 향료 투입 → 균일 혼합',
      '7. pH 확인 → 탈포 → 충진',
    ],
    '크림': [
      '1. Phase A(수상): 정제수 + 수용성 원료 → 75~80°C 가열 용해',
      '2. Phase B(유상): 오일 + 유화제 + 버터/왁스 → 별도 용기 75~80°C 가열 용해',
      '3. 유화: B상을 A상에 서서히 투입 → 호모믹서 6,000rpm, 10분',
      '4. 냉각: 패들 교반하며 45°C까지 서서히 냉각',
      '5. Phase C: 활성성분, 증점제 투입 → 저속 교반 5분',
      '6. Phase D: 방부제, 향료 투입 → 균일 혼합',
      '7. pH 확인 (5.5~7.0) → 점도 확인 → 탈포 → 충진',
    ],
    '세럼': [
      '1. Phase A: 정제수에 수용성 고분자(카보머 등) 분산 → 상온 팽윤 30분',
      '2. 가열: 70°C까지 승온 → 글리세린, BG 등 투입',
      '3. 냉각: 40°C까지 냉각',
      '4. Phase C: 활성성분(펩타이드, 비타민 등) 투입 → 저속 교반',
      '5. 중화: TEA 또는 NaOH로 pH 보정 → 겔화 확인',
      '6. Phase D: 방부제, 향료 투입 → 탈포 → 충진',
    ],
    '클렌징': [
      '1. Phase A: 정제수 + 계면활성제 → 50°C 가열 용해',
      '2. Phase B: 오일상 원료 투입 → 교반 혼합',
      '3. 냉각: 상온까지 교반하며 냉각',
      '4. Phase D: 방부제, 향료 투입 → 균일 혼합',
      '5. pH 확인 → 점도 확인 → 충진',
    ],
    '선크림': [
      '1. Phase A(수상): 정제수 + 수용성 원료 → 75°C 가열',
      '2. Phase B(유상): 오일 + UV 필터(유기자차) + 유화제 → 75°C 가열',
      '3. 분산: 무기자차(TiO2, ZnO)를 B상에 3-roll mill 또는 비드밀로 분산',
      '4. 유화: B상을 A상에 투입 → 호모믹서 7,000rpm, 10분',
      '5. 냉각: 40°C까지 냉각 → Phase C/D 투입',
      '6. SPF 측정용 시료 채취 → pH 확인 → 충진',
    ],
    '샴푸': [
      '1. Phase A: 정제수를 60°C로 가열',
      '2. 계면활성제(SLES, 코카미도프로필베타인 등) 순차 투입 → 저속 교반',
      '3. 증점: 소금(NaCl) 또는 증점제로 점도 조절',
      '4. 냉각: 40°C까지 냉각',
      '5. Phase C/D: 컨디셔닝제, 방부제, 향료 투입',
      '6. pH 확인 (5.0~7.0) → 충진',
    ],
  }

  // 부분 매칭
  const pt = productType || ''
  for (const [key, steps] of Object.entries(processes)) {
    if (pt.includes(key) || key.includes(pt)) return steps
  }
  // 에멀전/로션 계열 기본
  if (pt.includes('에멀') || pt.includes('바디')) return processes['로션']
  if (pt.includes('에센스') || pt.includes('앰플')) return processes['세럼']
  if (pt.includes('자외선') || pt.includes('선')) return processes['선크림']
  if (pt.includes('폼') || pt.includes('워터') || pt.includes('오일')) return processes['클렌징']

  // 범용 크림/로션 공정
  return processes['크림']
}

function buildAiMemo(source, data, existingMemo) {
  const lines = []
  lines.push(`[${source} 자동 생성] ${data.description || ''}`)
  lines.push('')

  // 복합원료만 기록
  const ings = data.ingredients || []
  const compounds = ings.filter(i => i.is_compound)

  if (compounds.length > 0) {
    lines.push('━━ 사용 복합원료 ━━')
    for (const ing of compounds) {
      const name = ing.compound_name || ing.korean_name || ing.name || ''
      const inci = ing.inci_name || ''
      const pct = ing.percentage ?? '—'
      lines.push(`▸ ${name} (${pct}%)`)
      lines.push(`  INCI: ${inci}`)
      lines.push('')
    }
  }

  // 간략 제조방법
  const productType = data._productType || ''
  const steps = getProcessByType(productType)
  lines.push('━━ 제조방법 (Lab 시험용) ━━')
  for (const step of steps) {
    lines.push(step)
  }
  lines.push('')

  lines.push(`---`)
  lines.push(`총 ${ings.length}종 | ${new Date(data.generatedAt || Date.now()).toLocaleString('ko-KR')}`)

  if (existingMemo) {
    lines.push('')
    lines.push('--- 이전 메모 ---')
    lines.push(existingMemo)
  }

  return lines.join('\n')
}

function generatePhysicalProps(productType) {
  // 제품 유형별 기본 물성 스펙
  const specs = {
    '토너/스킨':     { ph: '5.0 ~ 6.5', viscosity: '5 ~ 50', hardness: '—', appearance: '투명~반투명 액상', spreadability: '우수' },
    '로션/에멀전':    { ph: '5.5 ~ 7.0', viscosity: '3,000 ~ 10,000', hardness: '—', appearance: '유백색 에멀전', spreadability: '양호' },
    '크림':          { ph: '5.5 ~ 7.0', viscosity: '15,000 ~ 80,000', hardness: '중간', appearance: '유백색~백색 크림', spreadability: '보통' },
    '세럼/에센스/앰플': { ph: '5.0 ~ 6.5', viscosity: '500 ~ 5,000', hardness: '—', appearance: '투명~반투명 겔', spreadability: '우수' },
    '아이크림':       { ph: '5.5 ~ 7.0', viscosity: '20,000 ~ 60,000', hardness: '중간~높음', appearance: '백색 크림', spreadability: '보통' },
    '마스크/팩':      { ph: '5.0 ~ 7.0', viscosity: '10,000 ~ 50,000', hardness: '—', appearance: '겔~크림 타입', spreadability: '양호' },
    '미스트':         { ph: '5.0 ~ 6.5', viscosity: '1 ~ 10', hardness: '—', appearance: '투명 액상', spreadability: '우수' },
    '클렌징 폼':      { ph: '6.0 ~ 8.0', viscosity: '5,000 ~ 30,000', hardness: '—', appearance: '백색 페이스트', spreadability: '양호' },
    '클렌징 오일/밤':  { ph: '—', viscosity: '50 ~ 500', hardness: '—', appearance: '투명 오일', spreadability: '우수' },
    '샴푸':          { ph: '5.0 ~ 7.0', viscosity: '3,000 ~ 15,000', hardness: '—', appearance: '투명~반투명 액상', spreadability: '우수' },
    '자외선 차단':    { ph: '6.0 ~ 8.0', viscosity: '10,000 ~ 50,000', hardness: '—', appearance: '백색 크림/로션', spreadability: '양호' },
    '파운데이션/베이스': { ph: '6.0 ~ 8.0', viscosity: '10,000 ~ 50,000', hardness: '—', appearance: '피부색 에멀전', spreadability: '양호' },
    '바디로션/크림':   { ph: '5.5 ~ 7.0', viscosity: '5,000 ~ 30,000', hardness: '—', appearance: '유백색 에멀전', spreadability: '양호' },
    '쿠션':          { ph: '5.5 ~ 7.0', viscosity: '5,000 ~ 50,000', hardness: '—', appearance: '크림/로션', spreadability: '양호' },
    '립':            { ph: '—', viscosity: '—', hardness: '높음', appearance: '고체/반고체', spreadability: '양호' },
  }

  // 매칭 시도 (부분 일치)
  let matched = null
  for (const [key, val] of Object.entries(specs)) {
    if (productType.includes(key) || key.includes(productType)) {
      matched = val
      break
    }
  }
  // 추가 매칭
  if (!matched) {
    if (productType.includes('에멀') || productType.includes('바디')) matched = specs['로션/에멀전']
    else if (productType.includes('에센스') || productType.includes('앰플')) matched = specs['세럼/에센스/앰플']
    else if (productType.includes('선') || productType.includes('자외선')) matched = specs['자외선 차단']
    else matched = { ph: '5.5 ~ 7.0', viscosity: '5,000 ~ 50,000', hardness: '—', appearance: '크림/로션', spreadability: '양호' }
  }

  // 기본값 채움 (기존 사용자 입력이 있으면 유지)
  const defaults = {
    ph: matched.ph,
    viscosity: matched.viscosity,
    hardness: matched.hardness,
    specificGravity: '0.98 ~ 1.05',
    color: '백색~미색',
    odor: '고유의 향',
    appearance: matched.appearance,
    spreadability: matched.spreadability,
    shelfLife: '제조일로부터 30개월',
    storage: '직사광선 차단, 상온(15~25℃)',
    micro: '총 호기성 생균수 ≤ 500 CFU/g, 대장균·녹농균·황색포도상구균 불검출',
  }
  for (const [key, val] of Object.entries(defaults)) {
    physicalProps[key] = val
  }
}

// ───────────────────────────────────────────────
// pH 예측 + 방부제 효력
// ───────────────────────────────────────────────

const PH_INFLUENCE_DB = {
  'Glycolic Acid':        { type: 'acid',    strength: 'strong',  typicalPh: [2.5, 3.5] },
  'Lactic Acid':          { type: 'acid',    strength: 'medium',  typicalPh: [3.0, 4.0] },
  'Salicylic Acid':       { type: 'acid',    strength: 'medium',  typicalPh: [3.0, 4.0] },
  'Citric Acid':          { type: 'acid',    strength: 'medium',  typicalPh: [2.5, 3.5] },
  'Ascorbic Acid':        { type: 'acid',    strength: 'medium',  typicalPh: [2.5, 3.5] },
  'Mandelic Acid':        { type: 'acid',    strength: 'medium',  typicalPh: [3.0, 4.0] },
  'Hyaluronic Acid':      { type: 'neutral', strength: 'none',    typicalPh: [5.0, 7.0] },
  'Triethanolamine':      { type: 'base',    strength: 'strong',  typicalPh: [8.5, 10.5] },
  'Sodium Hydroxide':     { type: 'base',    strength: 'strong',  typicalPh: [12.0, 14.0] },
  'Potassium Hydroxide':  { type: 'base',    strength: 'strong',  typicalPh: [12.0, 14.0] },
  'Arginine':             { type: 'base',    strength: 'weak',    typicalPh: [8.0, 10.0] },
  'Aminomethyl Propanol': { type: 'base',    strength: 'medium',  typicalPh: [9.0, 11.0] },
  'Niacinamide':          { type: 'neutral', strength: 'none',    typicalPh: [5.0, 7.0] },
  'Glycerin':             { type: 'neutral', strength: 'none',    typicalPh: [5.0, 7.0] },
  'Water':                { type: 'neutral', strength: 'none',    typicalPh: [5.5, 7.0] },
  'Aqua':                 { type: 'neutral', strength: 'none',    typicalPh: [5.5, 7.0] },
}

const PRESERVATIVE_PH = {
  'Phenoxyethanol':        { minPh: 3.0, maxPh: 8.0, optimal: [4.0, 6.0], name: '페녹시에탄올' },
  'Methylparaben':         { minPh: 3.0, maxPh: 8.0, optimal: [4.0, 8.0], name: '메틸파라벤' },
  'Ethylhexylglycerin':    { minPh: 3.0, maxPh: 8.0, optimal: [4.0, 6.0], name: '에틸헥실글리세린' },
  'Sodium Benzoate':       { minPh: 2.0, maxPh: 5.0, optimal: [2.5, 4.5], name: '소듐벤조에이트' },
  'Potassium Sorbate':     { minPh: 2.0, maxPh: 5.5, optimal: [3.0, 5.0], name: '포타슘소르베이트' },
  'Benzisothiazolinone':   { minPh: 2.0, maxPh: 9.0, optimal: [3.0, 8.0], name: 'BIT' },
  'Caprylyl Glycol':       { minPh: 3.0, maxPh: 8.0, optimal: [4.0, 6.0], name: '카프릴릴글라이콜' },
  '1,2-Hexanediol':        { minPh: 3.0, maxPh: 8.0, optimal: [4.0, 7.0], name: '1,2-헥산다이올' },
  'DMDM Hydantoin':        { minPh: 3.5, maxPh: 7.5, optimal: [4.0, 6.5], name: 'DMDM 하이단토인' },
  'Chlorphenesin':         { minPh: 3.0, maxPh: 8.0, optimal: [4.0, 6.0], name: '클로르페네신' },
}

function predictPH(ingredients) {
  let strongAcidPct = 0, medAcidPct = 0, basePct = 0
  let acidNames = [], baseNames = []

  for (const ing of ingredients) {
    const key = ing.inci_name || ing.name || ''
    const match = Object.entries(PH_INFLUENCE_DB).find(([k]) =>
      key.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(key.toLowerCase())
    )
    if (match) {
      const [name, data] = match
      if (data.type === 'acid' && data.strength !== 'none') {
        acidNames.push(name)
        if (data.strength === 'strong') strongAcidPct += ing.percentage || 0
        else medAcidPct += ing.percentage || 0
      } else if (data.type === 'base') {
        baseNames.push(name)
        basePct += ing.percentage || 0
      }
    }
  }

  let minPh, maxPh, notes = []
  if (strongAcidPct > 5)               { minPh = 2.5; maxPh = 3.5; notes.push('강산 고농도 — 매우 낮은 pH') }
  else if (strongAcidPct > 0 || medAcidPct > 2) { minPh = 3.0; maxPh = 4.5; notes.push(`산성 원료: ${acidNames.join(', ')}`) }
  else if (medAcidPct > 0)             { minPh = 4.0; maxPh = 5.5; notes.push(`약산성 원료: ${acidNames.join(', ')}`) }
  else if (basePct > 1)                { minPh = 7.5; maxPh = 9.0; notes.push(`알칼리 원료: ${baseNames.join(', ')}`) }
  else if (baseNames.length > 0)       { minPh = 6.5; maxPh = 8.0; notes.push(`약알칼리 원료: ${baseNames.join(', ')}`) }
  else                                  { minPh = 5.0; maxPh = 7.0; notes.push('중성~약산성 범위 (일반 화장품)') }

  return { minPh, maxPh, acidNames, baseNames, notes }
}

function checkPreservativeEfficacy(ingredients, predictedPh) {
  const results = []
  for (const ing of ingredients) {
    const key = ing.inci_name || ing.name || ''
    const match = Object.entries(PRESERVATIVE_PH).find(([k]) =>
      key.toLowerCase().includes(k.toLowerCase())
    )
    if (match) {
      const [inci, data] = match
      const midPh = (predictedPh.minPh + predictedPh.maxPh) / 2
      let status, message
      if (midPh < data.minPh || midPh > data.maxPh) {
        status = 'danger'
        message = `${data.name}은 pH ${data.minPh}~${data.maxPh}에서만 유효. 현재 예상 pH ${predictedPh.minPh.toFixed(1)}~${predictedPh.maxPh.toFixed(1)}에서 방부력 상실 위험`
      } else if (midPh < data.optimal[0] || midPh > data.optimal[1]) {
        status = 'warning'
        message = `${data.name} 최적 pH ${data.optimal[0]}~${data.optimal[1]}. 현재 예상 범위에서 효력 감소 가능`
      } else {
        status = 'ok'
        message = `${data.name} pH 적합 (최적 ${data.optimal[0]}~${data.optimal[1]})`
      }
      results.push({ name: data.name, inci, status, message, phRange: `${data.minPh}~${data.maxPh}` })
    }
  }
  return results
}

const phPrediction = computed(() => predictPH(form.formula_data.ingredients))

const preservativeResults = computed(() =>
  checkPreservativeEfficacy(form.formula_data.ingredients, phPrediction.value)
)

const phRangeStyle = computed(() => {
  const min = phPrediction.value.minPh
  const max = phPrediction.value.maxPh
  const left = (min / 14) * 100
  const width = ((max - min) / 14) * 100
  return { left: left + '%', width: Math.max(width, 2) + '%' }
})

// ───────────────────────────────────────────────
// 유사 제품 검색
// ───────────────────────────────────────────────
const isSearchingSimilar = ref(false)
const similarProducts = ref([])

async function onSearchSimilar() {
  const ings = form.formula_data.ingredients
  if (ings.length < 2) return
  isSearchingSimilar.value = true
  try {
    const inciNames = ings.map(i => i.inci_name || i.name).filter(Boolean)
    const res = await api.searchSimilarProducts(inciNames, 10)
    if (res?.success && res.data) {
      similarProducts.value = res.data
    } else {
      similarProducts.value = []
    }
  } catch (e) {
    console.error('[SimilarProducts]', e)
    similarProducts.value = []
  } finally {
    isSearchingSimilar.value = false
  }
}

function similarMatchPct(prod) {
  const totalIngs = form.formula_data.ingredients.length
  if (!totalIngs) return 0
  const matchCount = prod.matchCount || prod.match_count || 0
  return Math.min((matchCount / totalIngs) * 100, 100)
}

// ───────────────────────────────────────────────
// 배치 스케일러
// ───────────────────────────────────────────────
const batchCurrentG = ref(100)
const batchTargetG = ref(1000)
const batchResult = ref([])

const batchScaleFactor = computed(() => {
  if (!batchCurrentG.value || !batchTargetG.value) return '—'
  return (batchTargetG.value / batchCurrentG.value).toFixed(2)
})

const batchTotalPct = computed(() =>
  batchResult.value.reduce((s, r) => s + Number(r.percentage || 0), 0).toFixed(1)
)
const batchTotalCurrentG = computed(() =>
  batchResult.value.reduce((s, r) => s + Number(r.currentGrams || 0), 0).toFixed(1)
)
const batchTotalTargetG = computed(() =>
  batchResult.value.reduce((s, r) => s + Number(r.targetGrams || 0), 0).toFixed(1)
)

function onCalcBatch() {
  const ings = form.formula_data.ingredients
  if (!ings.length || !batchCurrentG.value || !batchTargetG.value) return
  const current = batchCurrentG.value
  const target = batchTargetG.value
  batchResult.value = ings.map(ing => {
    const pct = Number(ing.percentage) || 0
    const currentGrams = ((pct / 100) * current).toFixed(2)
    const targetGrams = ((pct / 100) * target).toFixed(2)
    return { name: ing.name || ing.inci_name || '', percentage: pct.toFixed(1), currentGrams, targetGrams }
  })
}

// ───────────────────────────────────────────────

async function onAiFill() {
  if (!form.product_type || isAiFilling.value) return

  const hasIngredients = form.formula_data.ingredients.length > 0
  if (hasIngredients && !confirm('기존 원료 배합표를 덮어씌웁니다. 계속하시겠습니까?')) return

  isAiFilling.value = true
  aiFillStep.value = '원료 검색 중...'

  try {
    aiFillStep.value = '처방 생성 중...'
    // 물성 조건을 AI에 전달
    const specEntries = physicalPropsFields
      .filter(f => physicalProps[f.key])
      .map(f => `${f.label}: ${physicalProps[f.key]}`)
    const res = await api.generateAiFormula({
      productType: form.product_type,
      requirements: aiRequirements.value || form.product_type,
      physicalSpecs: specEntries.length ? specEntries : undefined,
    })

    if (res?.success && res.data?.ingredients) {
      aiFillStep.value = '배합표 적용 중...'
      form.formula_data.ingredients = res.data.ingredients.map(ing => ({
        name: ing.korean_name || ing.name || '',
        inci_name: ing.inci_name || '',
        percentage: ing.percentage || 0,
        function: ing.function || '',
        phase: ing.phase || '',
      }))
      form.formula_data.total_percentage = res.data.totalPercentage || 100

      // 처방명이 비어있으면 자동 설정
      if (!form.title.trim()) {
        form.title = `${form.product_type} 처방`
      }
      // 태그 추가
      if (!form.tags.includes('자동처방')) form.tags.push('자동처방')
      // 메모에 복합원료 + 제조방법 생성
      const source = res.data.source?.includes('gemini') ? 'Gemini' : res.data.source?.includes('openai') ? 'LLM' : 'DB'
      res.data._productType = form.product_type
      form.memo = buildAiMemo(source, res.data, form.memo)

    } else {
      alert('처방 생성에 실패했습니다. 다시 시도해주세요.')
    }
  } catch (err) {
    alert('서버 연결 오류: ' + (err.message || '알 수 없는 오류'))
  } finally {
    isAiFilling.value = false
    aiFillStep.value = ''
  }
}
</script>

<style scoped>
.page-top { margin-bottom: 16px; }
.back-link { font-size: 12px; color: var(--text-sub); text-decoration: none; }
.back-link:hover { color: var(--accent); }
.page-title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 4px; }
.page-title { font-size: 20px; font-weight: 700; color: var(--text); }
.page-sub { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.title-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* 버전 배지 */
.version-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  background: rgba(184,147,90,0.15);
  color: var(--amber, #b8935a);
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
}

/* 버전 저장 버튼 */
.btn-save-version {
  padding: 5px 12px;
  border: 1px solid var(--border-mid, var(--border));
  border-radius: 4px;
  background: transparent;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-save-version:hover {
  background: var(--bg);
  border-color: var(--amber, #b8935a);
  color: var(--amber, #b8935a);
}

/* 버전 히스토리 드롭다운 */
.version-dropdown-wrap {
  position: relative;
}
.btn-version-history {
  padding: 5px 12px;
  border: 1px solid var(--border-mid, var(--border));
  border-radius: 4px;
  background: transparent;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font-mono);
}
.btn-version-history:hover { background: var(--bg); }

.version-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 320px;
  background: var(--surface);
  border: 1px solid var(--border-mid, var(--border));
  border-radius: var(--radius);
  box-shadow: var(--shadow, 0 4px 16px rgba(0,0,0,0.3));
  z-index: 100;
}
.version-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.version-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.version-panel-close {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
}
.version-list {
  max-height: 280px;
  overflow-y: auto;
}
.version-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  gap: 8px;
}
.version-item:last-child { border-bottom: none; }
.version-item-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.version-item-num {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--amber, #b8935a);
  flex-shrink: 0;
}
.version-item-title {
  font-size: 12px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.version-item-date {
  font-size: 10px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.btn-restore {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: transparent;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-restore:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.panel-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
}
.section-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-dim); }
.section-title { font-size: 13px; font-weight: 600; color: var(--text); margin-left: 8px; }

.form-body { padding: 16px 20px; }
.form-group { margin-bottom: 12px; }
.form-label { font-size: 12px; color: var(--text-sub); margin-bottom: 4px; display: block; font-weight: 600; }
.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
}
.form-input:focus { border-color: var(--accent); outline: none; }

.status-stepper {
  padding: 16px 20px;
  display: flex;
  gap: 8px;
}
.step-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.step-btn:hover { background: var(--bg); }

.tags-body { padding: 16px 20px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 3px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}
.tag-del { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 13px; padding: 0; }
.tag-input-wrap { display: flex; gap: 4px; }
.tag-input {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  width: 120px;
}
.tag-input:focus { border-color: var(--accent); outline: none; }
.btn-add-tag {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: var(--accent-light);
  color: var(--accent);
  cursor: pointer;
  font-weight: 700;
}

.memo-body { padding: 16px 20px; }
.memo-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  resize: vertical;
  line-height: 1.5;
  font-family: var(--font);
}
.memo-textarea:focus { border-color: var(--accent); outline: none; }

.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn {
  padding: 10px 20px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}
.btn-primary { background: var(--accent); color: #fff; box-shadow: 0 2px 8px rgba(184,147,90,0.3); }
.btn-primary:hover { background: #a68350; }
.btn-ghost { border: 1px solid var(--border); background: transparent; color: var(--text-sub); }
.btn-ghost:hover { background: var(--bg); }
.btn-export { padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px; background: transparent; color: var(--text-sub); font-size: 12px; font-weight: 600; cursor: pointer; }
.btn-export:hover { background: var(--bg); border-color: var(--accent); color: var(--accent); }
.btn-danger { padding: 6px 12px; border: 1px solid var(--red); border-radius: 4px; background: transparent; color: var(--red); font-size: 12px; cursor: pointer; }
.btn-danger:hover { background: var(--red-bg); }

/* AI 자동 채우기 */
.ai-fill-group {
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.btn-ai-fill {
  margin-top: 8px;
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: linear-gradient(135deg, var(--accent-light) 0%, var(--surface) 100%);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-ai-fill:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 12px rgba(184,147,90,0.35);
}
.btn-ai-fill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  border-color: var(--border);
  color: var(--text-dim);
  background: var(--bg);
}
.ai-spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--accent-dim, rgba(184,147,90,0.3));
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes ai-spin { to { transform: rotate(360deg); } }
.ai-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-dim);
}

/* 메모 확대 버튼 */
.btn-memo-expand {
  margin-left: auto;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-memo-expand:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

/* 메모 모달 */
.memo-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
.memo-modal {
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  background: var(--surface, #fff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.memo-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
}
.memo-modal-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.memo-modal-close {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.memo-modal-close:hover { color: var(--text); }
.memo-modal-body {
  flex: 1;
  padding: 20px 24px;
  overflow: auto;
}
.memo-modal-textarea {
  width: 100%;
  min-height: 60vh;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
  font-family: var(--font-mono, monospace);
  resize: vertical;
  background: var(--bg, #f8f7f5);
}
.memo-modal-textarea:focus { border-color: var(--accent); outline: none; }

/* 물성·안정성 패널 */
.props-body {
  padding: 14px 20px;
}
.props-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.prop-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg, #f8f7f5);
}
.prop-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  white-space: nowrap;
}
.prop-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  font-family: var(--font-mono, monospace);
  text-align: right;
  background: transparent;
  transition: border-color 0.15s;
}
.prop-input:hover { border-color: var(--border); }
.prop-input:focus { border-color: var(--accent); outline: none; background: var(--surface); }
.prop-input::placeholder { color: var(--text-dim); font-weight: 400; }
.props-hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-dim);
  font-style: italic;
}
.props-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.props-section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.stability-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}
.stab-cond {
  flex: 1;
  color: var(--text);
}
.stab-period {
  color: var(--text-sub);
  font-family: var(--font-mono);
  font-size: 11px;
}
.stab-input {
  width: 80px;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-sub);
  text-align: center;
  background: transparent;
}
.stab-input:hover { border-color: var(--border); }
.stab-input:focus { border-color: var(--accent); outline: none; }
.stab-toggle {
  padding: 1px 8px;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.stab-toggle.pass {
  background: var(--green-bg, #f0f8f4);
  color: var(--green, #3a9068);
}
.stab-toggle.warn {
  background: var(--amber-bg, #fdf8f0);
  color: var(--amber, #b07820);
}
.stab-toggle:hover { opacity: 0.8; }
.micro-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text);
  line-height: 1.5;
  background: transparent;
}
.micro-input:hover { border-color: var(--border); }
.micro-input:focus { border-color: var(--accent); outline: none; background: var(--surface); }

@media (max-width: 1199px) { .form-grid { grid-template-columns: 1fr; } }

/* 비교 버튼 */
.btn-compare {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: transparent;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-compare:hover {
  border-color: var(--amber, #b8935a);
  color: var(--amber, #b8935a);
}

/* Diff 모달 */
.diff-modal { max-width: 700px; }
.diff-body { display: flex; flex-direction: column; gap: 16px; }

.diff-section {
  border: 1px solid var(--border);
  border-radius: var(--radius, 8px);
  overflow: hidden;
}
.diff-section-title {
  padding: 8px 14px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 1px;
  background: var(--bg, #f8f7f5);
  border-bottom: 1px solid var(--border);
}
.diff-empty {
  padding: 10px 14px;
  font-size: 12px;
  color: var(--text-dim);
}

/* 기본 정보 diff */
.diff-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
}
.diff-meta-row:last-child { border-bottom: none; }
.diff-field {
  font-weight: 700;
  color: var(--text-sub);
  min-width: 60px;
  flex-shrink: 0;
}
.diff-old {
  color: var(--red, #c0392b);
  text-decoration: line-through;
  font-family: var(--font-mono, monospace);
}
.diff-new {
  color: var(--green, #3a9068);
  font-family: var(--font-mono, monospace);
}
.diff-arrow {
  color: var(--text-dim);
  flex-shrink: 0;
}

/* 원료 그룹 레이블 */
.diff-group-label {
  padding: 5px 14px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.diff-label-add    { background: var(--green-bg, #f0f8f4); color: var(--green, #3a9068); }
.diff-label-remove { background: var(--red-bg, #fdf0f0);   color: var(--red, #c0392b);   }
.diff-label-change { background: var(--amber-bg, #fdf8f0); color: var(--amber, #b07820); }
.diff-label-unchanged { background: var(--bg, #f8f7f5); color: var(--text-dim); }

/* 원료 diff 행 */
.diff-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 14px;
  font-size: 12px;
  border-top: 1px solid rgba(0,0,0,0.04);
}
.diff-row-add     { background: var(--green-bg, #f0f8f4); }
.diff-row-remove  { background: var(--red-bg, #fdf0f0);   }
.diff-row-change  { background: var(--amber-bg, #fdf8f0); }
.diff-row-unchanged { background: transparent; opacity: 0.6; }

.diff-sign {
  font-weight: 900;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  width: 14px;
  flex-shrink: 0;
}
.diff-row-add    .diff-sign { color: var(--green, #3a9068); }
.diff-row-remove .diff-sign { color: var(--red, #c0392b);   }
.diff-row-change .diff-sign { color: var(--amber, #b07820); }
.diff-row-unchanged .diff-sign { color: var(--text-dim); }

.diff-ing-name {
  font-weight: 600;
  color: var(--text);
  min-width: 100px;
}
.diff-ing-inci {
  color: var(--text-dim);
  font-size: 11px;
  flex: 1;
  font-style: italic;
}
.diff-ing-pct {
  font-family: var(--font-mono, monospace);
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
}
.diff-ing-fn {
  font-size: 11px;
  color: var(--text-sub);
  flex-shrink: 0;
}
.diff-ing-phase {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(0,0,0,0.06);
  color: var(--text-dim);
  flex-shrink: 0;
}

.diff-pct-old {
  color: var(--red, #c0392b);
  text-decoration: line-through;
  font-family: var(--font-mono, monospace);
}
.diff-pct-new {
  color: var(--green, #3a9068);
  font-family: var(--font-mono, monospace);
}
.diff-arrow-sm { color: var(--text-dim); font-size: 11px; }
.diff-delta {
  font-size: 11px;
  color: var(--amber, #b07820);
  font-family: var(--font-mono, monospace);
}
.diff-phase-change {
  font-size: 11px;
  color: var(--amber, #b07820);
  flex-shrink: 0;
}

/* 총 배합비 */
.diff-total-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg, #f8f7f5);
  border: 1px solid var(--border);
  border-radius: var(--radius, 8px);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
}

/* pH 예측 패널 */
.ph-body { padding: 14px 20px; }
.ph-bar-wrap { margin-bottom: 12px; }
.ph-bar {
  position: relative;
  height: 24px;
  background: linear-gradient(to right,
    #c44e4e 0%, #c44e4e 21%,
    #b07820 21%, #b07820 35%,
    #3a9068 35%, #3a9068 50%,
    #3a6fa8 50%, #3a6fa8 64%,
    #7c5cbf 64%, #7c5cbf 100%
  );
  border-radius: 4px;
  margin-bottom: 4px;
}
.ph-range {
  position: absolute;
  top: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.5);
  border: 2px solid var(--accent);
  border-radius: 3px;
  z-index: 2;
}
.ph-marker {
  position: absolute;
  top: 100%;
}
.ph-mark-num {
  font-size: 8px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  transform: translateX(-50%);
  display: block;
  margin-top: 2px;
}
.ph-result {
  font-size: 13px;
  color: var(--text);
  margin-top: 10px;
}
.ph-result strong {
  color: var(--accent);
  font-family: var(--font-mono);
}
.ph-notes {
  font-size: 11px;
  color: var(--text-sub);
  margin-top: 2px;
}
.preserv-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.preserv-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.preserv-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}
.preserv-ok      { background: var(--green-bg); }
.preserv-warning { background: var(--amber-bg); }
.preserv-danger  { background: var(--red-bg); }
.preserv-icon { flex-shrink: 0; font-size: 13px; }
.preserv-ok .preserv-icon      { color: var(--green); }
.preserv-warning .preserv-icon { color: var(--amber); }
.preserv-danger .preserv-icon  { color: var(--red); }
.preserv-info { flex: 1; min-width: 0; }
.preserv-name { font-weight: 600; color: var(--text); display: block; }
.preserv-msg  { color: var(--text-sub); font-size: 11px; }

/* ── 유사 제품 검색 ── */
.btn-search-similar {
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid var(--border-mid, var(--border));
  border-radius: 4px;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-search-similar:hover { background: var(--bg); }
.btn-search-similar:disabled { opacity: 0.5; cursor: not-allowed; }

.similar-body { padding: 16px 20px; }
.similar-empty { color: var(--text-dim); font-size: 12px; }
.similar-list { display: flex; flex-direction: column; gap: 8px; }
.similar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: 6px;
  border: 1px solid var(--border);
}
.similar-rank {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: var(--surface);
  font-size: 11px; font-weight: 700;
  flex-shrink: 0;
}
.similar-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.similar-name { font-size: 13px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.similar-brand { font-size: 11px; color: var(--text-sub); }
.similar-category { font-size: 10px; color: var(--text-dim); }
.similar-match { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; min-width: 80px; }
.similar-match-count { font-size: 11px; font-weight: 600; color: var(--accent); font-family: var(--font-mono); }
.similar-match-bar { width: 60px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.similar-match-fill { display: block; height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }

/* ── 배치 스케일러 ── */
.batch-body { padding: 16px 20px; }
.batch-inputs { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.batch-field { display: flex; flex-direction: column; gap: 4px; }
.batch-label { font-size: 11px; font-weight: 600; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.5px; }
.batch-input { width: 120px; text-align: right; font-family: var(--font-mono); }
.batch-arrow { font-size: 18px; color: var(--text-dim); padding-bottom: 4px; }
.btn-batch-calc {
  padding: 6px 16px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--accent);
  color: var(--surface);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-batch-calc:hover { opacity: 0.85; }
.btn-batch-calc:disabled { opacity: 0.4; cursor: not-allowed; }

.batch-table-wrap { margin-top: 16px; }
.batch-scale-info {
  font-size: 12px;
  color: var(--text-sub);
  margin-bottom: 8px;
  font-family: var(--font-mono);
}
.batch-scale-info strong { color: var(--accent); }
.batch-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.batch-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 2px solid var(--border);
  color: var(--text-sub);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.batch-table td {
  padding: 5px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.batch-table tfoot td {
  border-top: 2px solid var(--border);
  border-bottom: none;
}
.batch-name { min-width: 120px; }
.batch-pct, .batch-g { text-align: right; font-family: var(--font-mono); }
.batch-target { color: var(--accent); font-weight: 600; }
</style>
