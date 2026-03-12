<template>
  <div class="ingredient-table-wrap">
    <div class="table-header">
      <span class="section-label">INGREDIENT TABLE</span>
      <span class="section-title">원료 배합표</span>
      <button v-if="editable" class="btn-add" @click="addRow">+ 원료 추가</button>
    </div>
    <table class="ingredient-table">
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th style="width:60px">Phase</th>
          <th>원료명</th>
          <th>INCI</th>
          <th style="width:80px">%(wt)</th>
          <th>기능</th>
          <th v-if="editable" style="width:40px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(ing, idx) in ingredients" :key="idx" :class="'phase-row-' + (ing.phase || 'none')">
          <td class="cell-num">{{ idx + 1 }}</td>
          <td class="cell-phase">
            <select v-if="editable" v-model="ing.phase" class="phase-select" @change="onPhaseChange"
              :class="'phase-select-' + (ing.phase || '')">
              <option value="">—</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            <span v-else-if="ing.phase" class="phase-chip" :class="'phase-chip-' + ing.phase">{{ ing.phase }}</span>
            <span v-else class="phase-chip phase-chip-none">—</span>
          </td>
          <td class="cell-name-wrap">
            <template v-if="editable">
              <input
                v-model="ing.name"
                class="cell-input"
                placeholder="원료명"
                @input="onSearchInput(idx, 'name', $event.target.value)"
                @focus="onSearchInput(idx, 'name', ing.name)"
                @blur="closeSuggestionsDelayed(idx)"
                @keydown.down.prevent="moveSuggestion(idx, 1)"
                @keydown.up.prevent="moveSuggestion(idx, -1)"
                @keydown.enter.prevent="selectHighlighted(idx, ing)"
                @keydown.escape="closeSuggestions(idx)"
                autocomplete="off"
              >
              <div v-if="suggestions[idx]?.show && suggestions[idx]?.items?.length" class="suggestions-dropdown">
                <div
                  v-for="(s, si) in suggestions[idx].items"
                  :key="s.id || si"
                  class="suggestion-item"
                  :class="{ highlighted: suggestions[idx].highlight === si }"
                  @mousedown.prevent="pickSuggestion(idx, ing, s)"
                >
                  <span class="sug-name">{{ s.korean_name || s.inci_name }}</span>
                  <span class="sug-inci">{{ s.inci_name }}</span>
                  <span v-if="s.ewg_score != null" class="sug-ewg" :class="ewgClass(s.ewg_score)">EWG {{ s.ewg_score }}</span>
                </div>
              </div>
            </template>
            <span v-else>{{ ing.name }}</span>
          </td>
          <td class="cell-inci cell-inci-wrap">
            <template v-if="editable">
              <input
                v-model="ing.inci_name"
                class="cell-input"
                placeholder="INCI"
                @input="onSearchInput(idx, 'inci', $event.target.value)"
                @focus="onSearchInput(idx, 'inci', ing.inci_name)"
                @blur="closeSuggestionsDelayed(idx)"
                @keydown.down.prevent="moveSuggestion(idx, 1)"
                @keydown.up.prevent="moveSuggestion(idx, -1)"
                @keydown.enter.prevent="selectHighlighted(idx, ing)"
                @keydown.escape="closeSuggestions(idx)"
                autocomplete="off"
              >
              <div v-if="suggestions[idx]?.show && suggestions[idx]?.items?.length" class="suggestions-dropdown">
                <div
                  v-for="(s, si) in suggestions[idx].items"
                  :key="s.id || si"
                  class="suggestion-item"
                  :class="{ highlighted: suggestions[idx].highlight === si }"
                  @mousedown.prevent="pickSuggestion(idx, ing, s)"
                >
                  <span class="sug-inci">{{ s.inci_name }}</span>
                  <span class="sug-name">{{ s.korean_name }}</span>
                  <span v-if="s.ewg_score != null" class="sug-ewg" :class="ewgClass(s.ewg_score)">EWG {{ s.ewg_score }}</span>
                </div>
              </div>
            </template>
            <span v-else>{{ ing.inci_name }}</span>
          </td>
          <td class="cell-pct">
            <input v-if="editable" v-model.number="ing.percentage" type="number" step="0.1" class="cell-input pct-input" @input="onPctChange">
            <span v-else>{{ ing.percentage }}</span>
          </td>
          <td>
            <input v-if="editable" v-model="ing.function" class="cell-input" placeholder="기능">
            <span v-else>{{ ing.function }}</span>
          </td>
          <td v-if="editable">
            <button class="btn-del" @click="removeRow(idx)">×</button>
          </td>
        </tr>
        <tr v-if="ingredients.length === 0">
          <td :colspan="editable ? 7 : 6" class="empty-row">원료를 추가해주세요</td>
        </tr>
      </tbody>
      <tfoot v-if="ingredients.length">
        <!-- Phase 소계 -->
        <tr v-for="ps in phaseSummary" :key="'ps-' + ps.phase" class="phase-subtotal-row">
          <td></td>
          <td>
            <span class="phase-chip" :class="'phase-chip-' + ps.phase">{{ ps.phase }}</span>
          </td>
          <td colspan="2" style="font-size:11px; color:var(--text-sub)">Phase {{ ps.phase }} 소계</td>
          <td class="cell-pct" style="font-size:11px; font-weight:600">{{ ps.total.toFixed(1) }}</td>
          <td :colspan="editable ? 2 : 1"></td>
        </tr>
        <!-- 합계 -->
        <tr class="total-row">
          <td></td>
          <td></td>
          <td colspan="2" style="text-align:right; font-weight:600">합계</td>
          <td class="cell-pct total-pct" :class="{ over: totalPct > 100.5, under: totalPct < 99.5 }">
            {{ totalPct.toFixed(1) }}
          </td>
          <td :colspan="editable ? 2 : 1"></td>
        </tr>
      </tfoot>
    </table>
    <!-- 실시간 경고 패널 -->
    <div v-if="editable && (alerts.length || recommendations.length || regViolations.length)" class="alert-panel">
      <div class="alert-panel-header">
        <span class="section-label">SAFETY CHECK</span>
        <span class="section-title">실시간 검증</span>
        <span v-if="isChecking" class="checking-badge">검사 중...</span>
      </div>
      <!-- 규제 위반 -->
      <div v-for="v in regViolations" :key="'reg-' + v.inci_name" class="alert-item alert-forbidden">
        <span class="alert-icon">⛔</span>
        <div class="alert-body">
          <div class="alert-title">규제 한도 초과: {{ v.inci_name }}</div>
          <div class="alert-desc">{{ v.message }}</div>
        </div>
      </div>
      <!-- 규제 경고 (90% 근접) -->
      <div v-for="w in regWarnings" :key="'regw-' + w.inci_name" class="alert-item alert-caution">
        <span class="alert-icon">⚠</span>
        <div class="alert-body">
          <div class="alert-title">규제 한도 근접: {{ w.inci_name }}</div>
          <div class="alert-desc">{{ w.message }}</div>
        </div>
      </div>
      <!-- 호환성 금지 -->
      <div v-for="(a, i) in forbiddenAlerts" :key="'f-' + i" class="alert-item alert-forbidden">
        <span class="alert-icon">⛔</span>
        <div class="alert-body">
          <div class="alert-title">{{ a.ingredientA }} + {{ a.ingredientB }}</div>
          <div class="alert-desc">{{ a.reason }}</div>
        </div>
      </div>
      <!-- 호환성 주의 -->
      <div v-for="(a, i) in cautionAlerts" :key="'c-' + i" class="alert-item alert-caution">
        <span class="alert-icon">⚠</span>
        <div class="alert-body">
          <div class="alert-title">{{ a.ingredientA }} + {{ a.ingredientB }}</div>
          <div class="alert-desc">{{ a.reason }}</div>
        </div>
      </div>
      <!-- 추천 조합 -->
      <div v-for="(r, i) in recommendations" :key="'r-' + i" class="alert-item alert-recommended">
        <span class="alert-icon">✓</span>
        <div class="alert-body">
          <div class="alert-title">{{ r.ingredientA }} + {{ r.ingredientB }}</div>
          <div class="alert-desc">{{ r.reason }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, watch, ref } from 'vue'
import { useAPI } from '../../composables/useAPI.js'

const api = useAPI()

const props = defineProps({
  ingredients: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
const emit = defineEmits(['update:ingredients'])

const PHASES = ['A', 'B', 'C', 'D']

// ─── 자동완성 ───
const suggestions = reactive({}) // { [rowIdx]: { show, items, highlight, timer } }
let searchTimers = {}

function onSearchInput(idx, field, val) {
  const q = (val || '').trim()
  if (q.length < 1) {
    closeSuggestions(idx)
    return
  }
  // 디바운스 300ms
  clearTimeout(searchTimers[idx])
  searchTimers[idx] = setTimeout(() => fetchSuggestions(idx, q), 300)
}

async function fetchSuggestions(idx, q) {
  const data = await api.getIngredients({ q, limit: 8 })
  if (data?.items?.length) {
    suggestions[idx] = { show: true, items: data.items, highlight: -1 }
  } else {
    closeSuggestions(idx)
  }
}

function pickSuggestion(idx, ing, s) {
  ing.name = s.korean_name || s.inci_name || ''
  ing.inci_name = s.inci_name || ''
  if (s.max_concentration) {
    const match = s.max_concentration.match(/([\d.]+)/)
    if (match && !ing.percentage) ing.percentage = parseFloat(match[1])
  }
  closeSuggestions(idx)
  emit('update:ingredients', [...props.ingredients])
}

function moveSuggestion(idx, dir) {
  const s = suggestions[idx]
  if (!s?.items?.length) return
  let next = (s.highlight || 0) + dir
  if (next < 0) next = s.items.length - 1
  if (next >= s.items.length) next = 0
  s.highlight = next
}

function selectHighlighted(idx, ing) {
  const s = suggestions[idx]
  if (s?.show && s.highlight >= 0 && s.items[s.highlight]) {
    pickSuggestion(idx, ing, s.items[s.highlight])
  }
}

function closeSuggestions(idx) {
  if (suggestions[idx]) suggestions[idx].show = false
}

function closeSuggestionsDelayed(idx) {
  setTimeout(() => closeSuggestions(idx), 200)
}

function ewgClass(score) {
  if (score <= 2) return 'ewg-low'
  if (score <= 6) return 'ewg-mid'
  return 'ewg-high'
}

// ─── 실시간 호환성 + 규제 검사 ───
const alerts = ref([])
const recommendations = ref([])
const regViolations = ref([])
const regWarnings = ref([])
const isChecking = ref(false)
let checkTimer = null

const forbiddenAlerts = computed(() => alerts.value.filter(a => a.severity === 'forbidden'))
const cautionAlerts = computed(() => alerts.value.filter(a => a.severity === 'caution'))

watch(() => props.ingredients, (ings) => {
  if (!props.editable || ings.length < 2) {
    alerts.value = []
    recommendations.value = []
    regViolations.value = []
    regWarnings.value = []
    return
  }
  clearTimeout(checkTimer)
  checkTimer = setTimeout(() => runSafetyCheck(ings), 800)
}, { deep: true })

async function runSafetyCheck(ings) {
  const names = ings
    .map(i => i.inci_name || i.name || '')
    .filter(n => n.length > 1)
  if (names.length < 2) return

  isChecking.value = true
  try {
    const [compatRes, regRes] = await Promise.all([
      api.checkCompatibility(names),
      api.checkRegulationLimits(
        ings.filter(i => (i.inci_name || i.name) && i.percentage > 0)
          .map(i => ({ inci_name: i.inci_name || i.name, percentage: i.percentage }))
      ),
    ])
    if (compatRes?.data) {
      alerts.value = compatRes.data.alerts || []
      recommendations.value = compatRes.data.recommendations || []
    }
    if (regRes?.data) {
      regViolations.value = regRes.data.violations || []
      regWarnings.value = regRes.data.warnings || []
    }
  } catch (e) {
    // 실패해도 조용히 무시
  } finally {
    isChecking.value = false
  }
}

const totalPct = computed(() =>
  props.ingredients.reduce((s, i) => s + (Number(i.percentage) || 0), 0)
)

const phaseSummary = computed(() => {
  return PHASES.map(phase => ({
    phase,
    total: props.ingredients
      .filter(i => i.phase === phase)
      .reduce((s, i) => s + (Number(i.percentage) || 0), 0),
  })).filter(ps => ps.total > 0)
})

function addRow() {
  const updated = [...props.ingredients, { name: '', inci_name: '', percentage: 0, function: '', supplier: '', phase: '' }]
  emit('update:ingredients', updated)
}

function removeRow(idx) {
  const updated = props.ingredients.filter((_, i) => i !== idx)
  emit('update:ingredients', updated)
}

function onPctChange() {
  emit('update:ingredients', [...props.ingredients])
}

function onPhaseChange() {
  emit('update:ingredients', [...props.ingredients])
}
</script>

<style scoped>
.ingredient-table-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.table-header {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
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
}
.btn-add {
  margin-left: auto;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.btn-add:hover { background: var(--accent-dim); }

.ingredient-table {
  width: 100%;
  border-collapse: collapse;
}
.ingredient-table th {
  background: var(--bg);
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
}
.ingredient-table td {
  padding: 8px 12px;
  font-size: 12.5px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.ingredient-table tbody tr:hover { background: var(--bg); }

/* Phase 행 배경 — 미세한 컬러 힌트 */
.phase-row-A { background: rgba(58,111,168,0.04); }
.phase-row-B { background: rgba(58,144,104,0.04); }
.phase-row-C { background: rgba(124,92,191,0.04); }
.phase-row-D { background: rgba(184,147,90,0.04); }

/* Phase 칩 */
.cell-phase { text-align: center; }
.phase-chip {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
}
.phase-chip-A {
  background: rgba(58,111,168,0.12);
  color: var(--blue, #3a6fa8);
}
.phase-chip-B {
  background: rgba(58,144,104,0.12);
  color: var(--green, #3a9068);
}
.phase-chip-C {
  background: rgba(124,92,191,0.12);
  color: var(--purple, #7c5cbf);
}
.phase-chip-D {
  background: rgba(184,147,90,0.12);
  color: var(--amber, #b8935a);
}
.phase-chip-none {
  background: transparent;
  color: var(--text-dim);
}

/* Phase 선택 드롭다운 */
.phase-select {
  width: 52px;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  background: transparent;
  cursor: pointer;
  text-align: center;
}
.phase-select:focus { border-color: var(--accent); outline: none; background: var(--surface); }
.phase-select-A { color: var(--blue, #3a6fa8); }
.phase-select-B { color: var(--green, #3a9068); }
.phase-select-C { color: var(--purple, #7c5cbf); }
.phase-select-D { color: var(--amber, #b8935a); }

.cell-num { font-family: var(--font-mono); color: var(--text-dim); font-size: 10px; }
.cell-inci { font-size: 11px; color: var(--text-sub); }
.cell-pct { font-family: var(--font-mono); font-weight: 700; font-size: 13px; text-align: right; }
.cell-input {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  padding: 2px 4px;
  font-size: 12px;
  border-radius: 3px;
  color: var(--text);
}
.cell-input:focus { border-color: var(--accent); outline: none; background: var(--surface); }
.pct-input { text-align: right; width: 60px; }
.btn-del {
  background: none; border: none; color: var(--red); cursor: pointer; font-size: 16px; padding: 0 4px;
}

/* Phase 소계 행 */
.phase-subtotal-row td {
  border-bottom: none;
  padding: 4px 12px;
  font-size: 11px;
  opacity: 0.8;
}
.phase-subtotal-row .cell-pct {
  font-size: 11px;
}

.total-row td { border-top: 2px solid var(--border-mid); font-weight: 600; }
.total-pct.over { color: var(--red); }
.total-pct.under { color: var(--amber); }
.empty-row { text-align: center; color: var(--text-dim); padding: 24px !important; font-size: 12px; }

/* 자동완성 */
.cell-name-wrap, .cell-inci-wrap { position: relative; }
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  min-width: 280px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border-mid, var(--border));
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  z-index: 200;
}
.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
}
.suggestion-item:hover, .suggestion-item.highlighted {
  background: var(--accent-light, rgba(184,147,90,0.08));
}
.sug-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sug-inci {
  font-size: 11px;
  color: var(--text-sub);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sug-ewg {
  font-size: 9px;
  font-weight: 700;
  font-family: var(--font-mono);
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}
.ewg-low { background: rgba(58,144,104,0.12); color: var(--green, #3a9068); }
.ewg-mid { background: rgba(184,147,90,0.12); color: var(--amber, #b8935a); }
.ewg-high { background: rgba(196,78,78,0.12); color: var(--red, #c44e4e); }

/* 실시간 경고 패널 */
.alert-panel {
  border-top: 1px solid var(--border);
  padding: 12px 16px;
}
.alert-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.checking-badge {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  animation: pulse-check 1.2s ease-in-out infinite;
}
@keyframes pulse-check { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 6px;
}
.alert-item:last-child { margin-bottom: 0; }
.alert-forbidden {
  background: var(--red-bg, #fdf2f2);
  border: 1px solid rgba(196,78,78,0.2);
}
.alert-caution {
  background: var(--amber-bg, #fdf8f0);
  border: 1px solid rgba(176,120,32,0.2);
}
.alert-recommended {
  background: var(--green-bg, #f0f8f4);
  border: 1px solid rgba(58,144,104,0.2);
}
.alert-icon {
  font-size: 14px;
  flex-shrink: 0;
  line-height: 1.4;
}
.alert-forbidden .alert-icon { color: var(--red, #c44e4e); }
.alert-caution .alert-icon { color: var(--amber, #b07820); }
.alert-recommended .alert-icon { color: var(--green, #3a9068); }
.alert-body { flex: 1; min-width: 0; }
.alert-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}
.alert-desc {
  font-size: 11px;
  color: var(--text-sub);
  margin-top: 2px;
  line-height: 1.4;
}
</style>
