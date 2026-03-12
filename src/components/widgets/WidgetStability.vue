<template>
  <div class="stability-widget">
    <!-- 처방명 탭 필터 -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-btn"
        :class="{ active: selectedFormula === tab.value }"
        @click="selectedFormula = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 전체 보기: 요약 테이블 -->
    <template v-if="selectedFormula === '__all__'">
      <div class="table-wrap">
        <table class="mini-table">
          <thead>
            <tr>
              <th>처방명</th>
              <th>조건</th>
              <th>주차</th>
              <th>ΔE</th>
              <th>점도변화</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryRows" :key="row.id + '_' + row.condition">
              <td class="cell-name" :title="row.formulaName">{{ row.formulaName }}</td>
              <td class="cell-cond">{{ row.condition }}</td>
              <td class="cell-week">W{{ row.lastResult.week }}</td>
              <td>
                <span class="delta-val" :class="deltaEClass(row.lastResult.deltaE)">
                  {{ row.lastResult.deltaE.toFixed(1) }}
                </span>
              </td>
              <td class="cell-visc" :class="viscClass(row.lastResult.viscChange)">
                {{ formatVisc(row.lastResult.viscChange) }}
              </td>
              <td>
                <span class="dot" :class="judgeClass(row.lastResult.deltaE, row.lastResult.viscChange)" title="판정">●</span>
              </td>
            </tr>
            <tr v-if="summaryRows.length === 0">
              <td colspan="6" class="empty-cell">데이터 없음</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 처방 선택 보기: 다조건 비교 테이블 -->
    <template v-else>
      <div class="condition-legend">
        <span v-for="cond in selectedConditions" :key="cond" class="cond-chip">{{ cond }}</span>
      </div>
      <div class="table-wrap">
        <table class="mini-table compare-table">
          <thead>
            <tr>
              <th class="th-week">주차</th>
              <template v-for="cond in selectedConditions" :key="cond">
                <th>{{ cond }} ΔE</th>
                <th>{{ cond }} 점도</th>
              </template>
              <th class="th-judge">판정</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="week in mergedWeeks" :key="week">
              <td class="cell-week">W{{ week }}</td>
              <template v-for="cond in selectedConditions" :key="cond">
                <td>
                  <template v-if="getCell(cond, week)">
                    <span class="delta-val" :class="deltaEClass(getCell(cond, week).deltaE)">
                      {{ getCell(cond, week).deltaE.toFixed(1) }}
                    </span>
                  </template>
                  <span v-else class="cell-na">—</span>
                </td>
                <td :class="getCell(cond, week) ? viscClass(getCell(cond, week).viscChange) : ''">
                  <template v-if="getCell(cond, week)">
                    {{ formatVisc(getCell(cond, week).viscChange) }}
                  </template>
                  <span v-else class="cell-na">—</span>
                </td>
              </template>
              <td class="td-judge">
                <span class="dot" :class="rowJudgeClass(week)" title="판정">●</span>
              </td>
            </tr>
            <tr v-if="mergedWeeks.length === 0">
              <td :colspan="2 + selectedConditions.length * 2 + 1" class="empty-cell">데이터 없음</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 처방 개별 결과 요약 -->
      <div class="summary-footer">
        <div v-for="item in selectedItems" :key="item.id" class="summary-card">
          <span class="summary-cond">{{ item.condition }}</span>
          <span class="summary-latest">
            최신(W{{ item.results[item.results.length - 1].week }}) ΔE
            <span :class="deltaEClass(item.results[item.results.length - 1].deltaE)">
              {{ item.results[item.results.length - 1].deltaE.toFixed(1) }}
            </span>
          </span>
          <span class="dot" :class="judgeClass(item.results[item.results.length - 1].deltaE, item.results[item.results.length - 1].viscChange)">●</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLocalStorage } from '../../composables/useLocalStorage.js'

// ── 시드 데이터 ──────────────────────────────────────────
const SEED_STABILITY = [
  { id: 1, formulaName: '쿠션 파운데이션 21호', condition: '50°C', results: [
    { week: 0, deltaE: 0,   viscChange: 0,    ph: 5.8, appearance: '양호',     result: 'pass' },
    { week: 2, deltaE: 0.3, viscChange: -1.2, ph: 5.8, appearance: '양호',     result: 'pass' },
    { week: 4, deltaE: 0.5, viscChange: -2.1, ph: 5.7, appearance: '양호',     result: 'pass' },
    { week: 8, deltaE: 0.8, viscChange: -3.2, ph: 5.7, appearance: '양호',     result: 'pass' },
  ]},
  { id: 2, formulaName: '쿠션 파운데이션 21호', condition: 'RT(25°C)', results: [
    { week: 0, deltaE: 0,   viscChange: 0,    ph: 5.8, appearance: '양호', result: 'pass' },
    { week: 4, deltaE: 0.1, viscChange: -0.3, ph: 5.8, appearance: '양호', result: 'pass' },
    { week: 8, deltaE: 0.3, viscChange: -0.5, ph: 5.8, appearance: '양호', result: 'pass' },
  ]},
  { id: 3, formulaName: '쿠션 파운데이션 21호', condition: '4°C', results: [
    { week: 0, deltaE: 0,   viscChange: 0,   ph: 5.8, appearance: '양호', result: 'pass' },
    { week: 4, deltaE: 0.1, viscChange: 0.2, ph: 5.8, appearance: '양호', result: 'pass' },
    { week: 8, deltaE: 0.2, viscChange: 0.1, ph: 5.8, appearance: '양호', result: 'pass' },
  ]},
  { id: 4, formulaName: '선스틱 SPF50+', condition: '45°C', results: [
    { week: 0, deltaE: 0,   viscChange: 0,     ph: 6.1, appearance: '양호',      result: 'pass' },
    { week: 2, deltaE: 1.2, viscChange: -5.3,  ph: 6.0, appearance: '미세 변색', result: 'warning' },
    { week: 4, deltaE: 2.4, viscChange: -12.1, ph: 5.8, appearance: '변색 관찰', result: 'fail' },
  ]},
  { id: 5, formulaName: '선스틱 SPF50+', condition: 'RT(25°C)', results: [
    { week: 0, deltaE: 0,   viscChange: 0,    ph: 6.1, appearance: '양호', result: 'pass' },
    { week: 4, deltaE: 0.4, viscChange: -1.1, ph: 6.1, appearance: '양호', result: 'pass' },
  ]},
  { id: 6, formulaName: '세럼 바쿠치올', condition: '50°C', results: [
    { week: 0, deltaE: 0,   viscChange: 0,    ph: 6.0, appearance: '양호', result: 'pass' },
    { week: 2, deltaE: 1.1, viscChange: -1.8, ph: 5.9, appearance: '양호', result: 'warning' },
  ]},
]

// ── 로컬스토리지 연동 ────────────────────────────────────
const stabilityData = useLocalStorage('mylab:stability', SEED_STABILITY)

// ── 탭 구성 ──────────────────────────────────────────────
const selectedFormula = ref('__all__')

const formulaNames = computed(() => {
  const names = [...new Set(stabilityData.value.map(d => d.formulaName))]
  return names
})

const tabs = computed(() => [
  { value: '__all__', label: '전체' },
  ...formulaNames.value.map(n => ({ value: n, label: n })),
])

// ── 전체 요약 뷰 ─────────────────────────────────────────
// 각 처방×조건의 최신(마지막) 측정값만 표시
const summaryRows = computed(() => {
  return stabilityData.value.map(item => ({
    id: item.id,
    formulaName: item.formulaName,
    condition: item.condition,
    lastResult: item.results[item.results.length - 1],
  }))
})

// ── 처방 선택 비교 뷰 ────────────────────────────────────
const selectedItems = computed(() =>
  stabilityData.value.filter(d => d.formulaName === selectedFormula.value)
)

const selectedConditions = computed(() =>
  selectedItems.value.map(d => d.condition)
)

// 선택 처방의 모든 주차를 정렬하여 병합
const mergedWeeks = computed(() => {
  const weekSet = new Set()
  selectedItems.value.forEach(item => {
    item.results.forEach(r => weekSet.add(r.week))
  })
  return [...weekSet].sort((a, b) => a - b)
})

// 특정 조건×주차 셀 데이터 조회
function getCell(condition, week) {
  const item = selectedItems.value.find(d => d.condition === condition)
  if (!item) return null
  return item.results.find(r => r.week === week) ?? null
}

// 해당 주차의 모든 조건 중 가장 나쁜 판정
function rowJudgeClass(week) {
  let worst = 'pass'
  for (const cond of selectedConditions.value) {
    const cell = getCell(cond, week)
    if (!cell) continue
    const j = autoJudge(cell.deltaE, cell.viscChange)
    if (j === 'fail') return 'dot-fail'
    if (j === 'warning') worst = 'warning'
  }
  return worst === 'warning' ? 'dot-warning' : 'dot-pass'
}

// ── 판정 로직 ─────────────────────────────────────────────
function autoJudge(deltaE, viscChange) {
  const absVisc = Math.abs(viscChange)
  if (deltaE > 2.0 || absVisc > 15) return 'fail'
  if (deltaE >= 1.0 || absVisc >= 10) return 'warning'
  return 'pass'
}

function judgeClass(deltaE, viscChange) {
  const j = autoJudge(deltaE, viscChange)
  if (j === 'fail') return 'dot-fail'
  if (j === 'warning') return 'dot-warning'
  return 'dot-pass'
}

// ── ΔE 색상 ──────────────────────────────────────────────
function deltaEClass(val) {
  if (val > 2.0) return 'de-red'
  if (val >= 1.0) return 'de-amber'
  return 'de-green'
}

// ── 점도변화 색상 ─────────────────────────────────────────
function viscClass(val) {
  const abs = Math.abs(val)
  if (abs > 15) return 'vc-red'
  if (abs >= 10) return 'vc-amber'
  return 'vc-dim'
}

// ── 점도변화 포맷 ─────────────────────────────────────────
function formatVisc(val) {
  return (val > 0 ? '+' : '') + val.toFixed(1) + '%'
}
</script>

<style scoped>
/* ── 레이아웃 ─────────────────────────────────────────── */
.stability-widget {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 1.2cqi, 8px);
  overflow: hidden;
  max-height: 100%;
}

.table-wrap {
  overflow: auto;
  flex: 1;
  min-height: 0;
}

/* ── 탭 바 ───────────────────────────────────────────── */
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: clamp(4px, 1cqi, 6px);
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius, 4px);
  color: var(--text-sub);
  cursor: pointer;
  font-size: clamp(9px, 2cqi, 11px);
  font-family: var(--font-mono);
  padding: clamp(2px, 0.6cqi, 4px) clamp(6px, 1.5cqi, 10px);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tab-btn:hover {
  background: var(--bg);
  color: var(--text);
}

.tab-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* ── 조건 레전드 칩 ──────────────────────────────────── */
.condition-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cond-chip {
  font-family: var(--font-mono);
  font-size: clamp(8px, 1.8cqi, 10px);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px clamp(4px, 1cqi, 7px);
  color: var(--text-sub);
}

/* ── 테이블 공통 ─────────────────────────────────────── */
.mini-table {
  width: 100%;
  border-collapse: collapse;
}

.mini-table th {
  background: var(--bg);
  font-size: clamp(9px, 2cqi, 11px);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-dim);
  padding: clamp(3px, 0.9cqi, 6px) clamp(4px, 1.2cqi, 9px);
  text-align: left;
  position: sticky;
  top: 0;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
  z-index: 1;
}

.mini-table td {
  padding: clamp(4px, 1cqi, 7px) clamp(4px, 1.2cqi, 9px);
  font-size: clamp(10px, 2.2cqi, 12px);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  font-family: var(--font-mono);
}

.mini-table tbody tr:hover {
  background: var(--bg);
}

/* 비교 테이블은 숫자 가운데 정렬 */
.compare-table th:not(.th-week):not(.th-judge),
.compare-table td:not(.cell-week):not(.td-judge) {
  text-align: center;
}

.th-judge,
.td-judge {
  text-align: center;
}

/* ── 셀 타입 ─────────────────────────────────────────── */
.cell-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: clamp(60px, 18cqi, 130px);
  font-family: inherit;
}

.cell-cond {
  font-size: clamp(9px, 1.8cqi, 11px);
  color: var(--text-sub);
}

.cell-week {
  font-size: clamp(9px, 1.8cqi, 11px);
  color: var(--text-dim);
  white-space: nowrap;
}

.cell-na {
  color: var(--text-dim);
  opacity: 0.4;
}

.empty-cell {
  text-align: center;
  color: var(--text-dim);
  padding: 16px;
  font-family: inherit;
}

/* ── ΔE 값 ───────────────────────────────────────────── */
.delta-val {
  display: inline-block;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: clamp(10px, 2.2cqi, 12px);
  padding: 1px 4px;
  border-radius: 3px;
}

.de-green { color: var(--green); background: var(--green-bg, rgba(58,144,104,0.10)); }
.de-amber { color: var(--amber); background: var(--amber-bg, rgba(196,140,40,0.12)); }
.de-red   { color: var(--red);   background: var(--red-bg,   rgba(196,78,78,0.12)); }

/* ── 점도변화 ─────────────────────────────────────────── */
.vc-dim   { color: var(--text-sub); }
.vc-amber { color: var(--amber); font-weight: 600; }
.vc-red   { color: var(--red);   font-weight: 600; }

/* ── 판정 점 ─────────────────────────────────────────── */
.dot {
  font-size: clamp(12px, 3cqi, 16px);
  line-height: 1;
}

.dot-pass    { color: var(--green); }
.dot-warning { color: var(--amber); }
.dot-fail    { color: var(--red); }

/* ── 요약 푸터 (처방 선택 시 하단) ───────────────────── */
.summary-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: clamp(4px, 1cqi, 6px);
  border-top: 1px solid var(--border);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius, 4px);
  padding: clamp(2px, 0.6cqi, 4px) clamp(6px, 1.5cqi, 10px);
  font-size: clamp(9px, 1.9cqi, 11px);
  font-family: var(--font-mono);
}

.summary-cond {
  color: var(--text-sub);
  font-weight: 600;
}

.summary-latest {
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 3px;
}

/* ── @container 반응형 ───────────────────────────────── */
@container widget (max-width: 300px) {
  .tab-btn { font-size: 9px; padding: 2px 5px; }
  .mini-table th { font-size: 8px; padding: 2px 4px; }
  .mini-table td { font-size: 9px; padding: 3px 4px; }
  .summary-card { font-size: 9px; }
  .condition-legend { display: none; }
}

@container widget (min-width: 500px) {
  .tab-btn { font-size: 11px; }
  .mini-table th { font-size: 11px; }
  .mini-table td { font-size: 12px; }
}
</style>
