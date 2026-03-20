<template>
  <div class="stability-page">

    <!-- 헤더 -->
    <div class="panel">
      <div class="panel-header">
        <div>
          <span class="section-label">STABILITY TEST</span>
          <span class="section-title">안정성 시험</span>
        </div>
        <button class="btn btn-primary" @click="showAddModal = true">+ 새 시험 등록</button>
      </div>

      <!-- 요약 카드 -->
      <div class="summary-cards">
        <div class="s-card">
          <div class="s-val">{{ totalTests }}</div>
          <div class="s-label">전체 시험</div>
        </div>
        <div class="s-card s-pass">
          <div class="s-val">{{ passCount }}</div>
          <div class="s-label">적합</div>
        </div>
        <div class="s-card s-warning">
          <div class="s-val">{{ warningCount }}</div>
          <div class="s-label">주의</div>
        </div>
        <div class="s-card s-fail">
          <div class="s-val">{{ failCount }}</div>
          <div class="s-label">부적합</div>
        </div>
      </div>
    </div>

    <!-- 처방별 탭 필터 -->
    <div class="panel">
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

      <!-- 전체 요약 테이블 -->
      <div v-if="selectedFormula === '__all__'" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>처방명</th>
              <th>조건</th>
              <th>측정 횟수</th>
              <th>최신 주차</th>
              <th>ΔE</th>
              <th>점도변화</th>
              <th>pH</th>
              <th>외관</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryRows" :key="row.id" @click="selectFormula(row.formulaName)">
              <td class="cell-name">{{ row.formulaName }}</td>
              <td class="cell-cond">{{ row.condition }}</td>
              <td class="cell-count">{{ row.totalResults }}회</td>
              <td class="cell-week">W{{ row.lastResult.week }}</td>
              <td>
                <span class="delta-badge" :class="deltaEClass(row.lastResult.deltaE)">
                  {{ row.lastResult.deltaE.toFixed(1) }}
                </span>
              </td>
              <td :class="viscClass(row.lastResult.viscChange)">
                {{ formatVisc(row.lastResult.viscChange) }}
              </td>
              <td class="cell-ph">{{ row.lastResult.ph ?? '-' }}</td>
              <td class="cell-appear">{{ row.lastResult.appearance ?? '-' }}</td>
              <td>
                <span class="judge-chip" :class="judgeChipClass(row.lastResult.deltaE, row.lastResult.viscChange)">
                  {{ judgeLabel(row.lastResult.deltaE, row.lastResult.viscChange) }}
                </span>
              </td>
            </tr>
            <tr v-if="!summaryRows.length">
              <td colspan="9" class="empty-cell">등록된 안정성 시험이 없습니다</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 처방 선택 시: 상세 비교 -->
      <template v-else>
        <div class="detail-header">
          <h3 class="detail-title">{{ selectedFormula }}</h3>
          <div class="cond-chips">
            <span v-for="cond in selectedConditions" :key="cond" class="cond-chip">{{ cond }}</span>
          </div>
        </div>

        <!-- 주차별 비교 테이블 -->
        <div class="table-wrap">
          <table class="data-table compare-table">
            <thead>
              <tr>
                <th>주차</th>
                <template v-for="cond in selectedConditions" :key="cond">
                  <th>{{ cond }} ΔE</th>
                  <th>{{ cond }} 점도</th>
                  <th>{{ cond }} pH</th>
                </template>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="week in mergedWeeks" :key="week">
                <td class="cell-week">W{{ week }}</td>
                <template v-for="cond in selectedConditions" :key="cond">
                  <td class="cell-center">
                    <template v-if="getCell(cond, week)">
                      <span class="delta-badge" :class="deltaEClass(getCell(cond, week).deltaE)">
                        {{ getCell(cond, week).deltaE.toFixed(1) }}
                      </span>
                    </template>
                    <span v-else class="cell-na">—</span>
                  </td>
                  <td class="cell-center" :class="getCell(cond, week) ? viscClass(getCell(cond, week).viscChange) : ''">
                    <template v-if="getCell(cond, week)">{{ formatVisc(getCell(cond, week).viscChange) }}</template>
                    <span v-else class="cell-na">—</span>
                  </td>
                  <td class="cell-center cell-ph">
                    <template v-if="getCell(cond, week)">{{ getCell(cond, week).ph ?? '-' }}</template>
                    <span v-else class="cell-na">—</span>
                  </td>
                </template>
                <td class="cell-center">
                  <span class="judge-chip" :class="rowJudgeChipClass(week)">
                    {{ rowJudgeLabel(week) }}
                  </span>
                </td>
              </tr>
              <tr v-if="!mergedWeeks.length">
                <td :colspan="1 + selectedConditions.length * 3 + 1" class="empty-cell">데이터 없음</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 조건별 요약 카드 -->
        <div class="condition-summary">
          <div v-for="item in selectedItems" :key="item.id" class="cond-card">
            <div class="cond-card-header">
              <span class="cond-card-title">{{ item.condition }}</span>
              <span class="judge-chip" :class="judgeChipClass(item.results[item.results.length - 1].deltaE, item.results[item.results.length - 1].viscChange)">
                {{ judgeLabel(item.results[item.results.length - 1].deltaE, item.results[item.results.length - 1].viscChange) }}
              </span>
            </div>
            <div class="cond-card-body">
              <div class="cond-stat">
                <span class="cond-stat-label">최신 주차</span>
                <span class="cond-stat-val">W{{ item.results[item.results.length - 1].week }}</span>
              </div>
              <div class="cond-stat">
                <span class="cond-stat-label">ΔE</span>
                <span class="cond-stat-val" :class="deltaEClass(item.results[item.results.length - 1].deltaE)">
                  {{ item.results[item.results.length - 1].deltaE.toFixed(1) }}
                </span>
              </div>
              <div class="cond-stat">
                <span class="cond-stat-label">점도변화</span>
                <span class="cond-stat-val">{{ formatVisc(item.results[item.results.length - 1].viscChange) }}</span>
              </div>
              <div class="cond-stat">
                <span class="cond-stat-label">pH</span>
                <span class="cond-stat-val">{{ item.results[item.results.length - 1].ph ?? '-' }}</span>
              </div>
              <div class="cond-stat">
                <span class="cond-stat-label">외관</span>
                <span class="cond-stat-val">{{ item.results[item.results.length - 1].appearance ?? '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- QA 검증 연동 -->
    <div class="panel qa-link-panel">
      <div class="panel-header">
        <div>
          <span class="section-label">QA LINK</span>
          <span class="section-title">품질 검증 연동</span>
        </div>
        <router-link to="/validation" class="btn-link">품질 검증 →</router-link>
      </div>
      <div class="qa-link-body">
        <div v-for="name in formulaNames" :key="name" class="qa-row">
          <span class="qa-formula-name">{{ name }}</span>
          <div class="qa-progress-wrap">
            <div class="qa-progress-bar">
              <div class="qa-progress-fill" :style="{ width: getQaProgress(name) + '%' }"></div>
            </div>
            <span class="qa-progress-text">{{ getQaProgress(name) }}%</span>
          </div>
          <span class="qa-status-chip" :class="getQaStatusClass(name)">{{ getQaStatusLabel(name) }}</span>
        </div>
        <div v-if="!formulaNames.length" class="qa-empty">등록된 처방이 없습니다</div>
      </div>
    </div>

    <!-- 판정 기준 안내 -->
    <div class="panel criteria-panel">
      <div class="panel-header">
        <span class="section-label">CRITERIA</span>
        <span class="section-title">판정 기준</span>
      </div>
      <div class="criteria-grid">
        <div class="criteria-item">
          <span class="judge-chip chip-pass">적합</span>
          <span class="criteria-desc">ΔE &lt; 1.0 AND 점도변화 &lt; ±10%</span>
        </div>
        <div class="criteria-item">
          <span class="judge-chip chip-warning">주의</span>
          <span class="criteria-desc">ΔE 1.0~2.0 OR 점도변화 ±10~15%</span>
        </div>
        <div class="criteria-item">
          <span class="judge-chip chip-fail">부적합</span>
          <span class="criteria-desc">ΔE &gt; 2.0 OR 점도변화 &gt; ±15%</span>
        </div>
      </div>
    </div>

    <!-- 새 시험 등록 모달 -->
    <Teleport to="body">
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal-box">
          <div class="modal-header">
            <h3>새 안정성 시험 등록</h3>
            <button class="modal-close" @click="showAddModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">처방명 *</label>
              <input v-model="newTest.formulaName" class="form-input" placeholder="예. 수분 크림 v2">
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label class="form-label">보관 조건 *</label>
                <select v-model="newTest.condition" class="form-input">
                  <option value="">선택</option>
                  <option value="4°C">4°C (냉장)</option>
                  <option value="RT(25°C)">RT(25°C)</option>
                  <option value="37°C">37°C</option>
                  <option value="45°C">45°C</option>
                  <option value="50°C">50°C</option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label class="form-label">초기 pH</label>
                <input v-model.number="newTest.ph" type="number" step="0.1" class="form-input" placeholder="5.5">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">외관 메모</label>
              <input v-model="newTest.appearance" class="form-input" placeholder="양호">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showAddModal = false">취소</button>
            <button class="btn btn-primary" @click="addTest" :disabled="!newTest.formulaName || !newTest.condition">등록</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage.js'

// ── 시드 데이터 (위젯과 동일 소스) ──
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

const stabilityData = useLocalStorage('mylab:stability', SEED_STABILITY)

// ── 탭/필터 ──
const selectedFormula = ref('__all__')

const formulaNames = computed(() => [...new Set(stabilityData.value.map(d => d.formulaName))])

const tabs = computed(() => [
  { value: '__all__', label: '전체' },
  ...formulaNames.value.map(n => ({ value: n, label: n })),
])

function selectFormula(name) {
  selectedFormula.value = name
}

// ── 요약 통계 ──
const totalTests = computed(() => stabilityData.value.length)

function autoJudge(deltaE, viscChange) {
  const absVisc = Math.abs(viscChange)
  if (deltaE > 2.0 || absVisc > 15) return 'fail'
  if (deltaE >= 1.0 || absVisc >= 10) return 'warning'
  return 'pass'
}

const passCount = computed(() => stabilityData.value.filter(d => {
  const last = d.results[d.results.length - 1]
  return autoJudge(last.deltaE, last.viscChange) === 'pass'
}).length)

const warningCount = computed(() => stabilityData.value.filter(d => {
  const last = d.results[d.results.length - 1]
  return autoJudge(last.deltaE, last.viscChange) === 'warning'
}).length)

const failCount = computed(() => stabilityData.value.filter(d => {
  const last = d.results[d.results.length - 1]
  return autoJudge(last.deltaE, last.viscChange) === 'fail'
}).length)

// ── 전체 요약 ──
const summaryRows = computed(() =>
  stabilityData.value.map(item => ({
    id: item.id,
    formulaName: item.formulaName,
    condition: item.condition,
    totalResults: item.results.length,
    lastResult: item.results[item.results.length - 1],
  }))
)

// ── 처방 상세 비교 ──
const selectedItems = computed(() =>
  stabilityData.value.filter(d => d.formulaName === selectedFormula.value)
)

const selectedConditions = computed(() =>
  selectedItems.value.map(d => d.condition)
)

const mergedWeeks = computed(() => {
  const weekSet = new Set()
  selectedItems.value.forEach(item => item.results.forEach(r => weekSet.add(r.week)))
  return [...weekSet].sort((a, b) => a - b)
})

function getCell(condition, week) {
  const item = selectedItems.value.find(d => d.condition === condition)
  return item?.results.find(r => r.week === week) ?? null
}

function rowJudge(week) {
  let worst = 'pass'
  for (const cond of selectedConditions.value) {
    const cell = getCell(cond, week)
    if (!cell) continue
    const j = autoJudge(cell.deltaE, cell.viscChange)
    if (j === 'fail') return 'fail'
    if (j === 'warning') worst = 'warning'
  }
  return worst
}

// ── 스타일 헬퍼 ──
function deltaEClass(val) {
  if (val > 2.0) return 'de-red'
  if (val >= 1.0) return 'de-amber'
  return 'de-green'
}

function viscClass(val) {
  const abs = Math.abs(val)
  if (abs > 15) return 'vc-red'
  if (abs >= 10) return 'vc-amber'
  return 'vc-dim'
}

function formatVisc(val) {
  return (val > 0 ? '+' : '') + val.toFixed(1) + '%'
}

function judgeLabel(deltaE, viscChange) {
  const j = autoJudge(deltaE, viscChange)
  if (j === 'fail') return '부적합'
  if (j === 'warning') return '주의'
  return '적합'
}

function judgeChipClass(deltaE, viscChange) {
  const j = autoJudge(deltaE, viscChange)
  return 'chip-' + j
}

function rowJudgeLabel(week) {
  const j = rowJudge(week)
  if (j === 'fail') return '부적합'
  if (j === 'warning') return '주의'
  return '적합'
}

function rowJudgeChipClass(week) {
  return 'chip-' + rowJudge(week)
}

// ── QA 검증 연동 ──
function getQaProgress(formulaName) {
  // formulaStore에서 ID 찾기 → 해당 체크리스트 로드
  const key = findChecklistKey(formulaName)
  if (!key) return 0
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return 0
    const parsed = JSON.parse(saved)
    const checked = parsed.filter(i => i.checked).length
    return Math.round((checked / 8) * 100)
  } catch { return 0 }
}

function findChecklistKey(formulaName) {
  // formulaStore에서 title로 매칭
  try {
    const raw = localStorage.getItem('mylab:formulas')
    if (!raw) return null
    const formulas = JSON.parse(raw)
    const match = formulas.find(f => f.title === formulaName)
    return match ? `mylab:checklist:${match.id}` : null
  } catch { return null }
}

function getQaStatusClass(formulaName) {
  const pct = getQaProgress(formulaName)
  if (pct >= 100) return 'qa-done'
  if (pct > 0) return 'qa-progress'
  return 'qa-none'
}

function getQaStatusLabel(formulaName) {
  const pct = getQaProgress(formulaName)
  if (pct >= 100) return '완료'
  if (pct > 0) return '진행중'
  return '미시작'
}

// ── 새 시험 등록 ──
const showAddModal = ref(false)
const newTest = ref({ formulaName: '', condition: '', ph: null, appearance: '양호' })

function addTest() {
  const nextId = Math.max(0, ...stabilityData.value.map(d => d.id)) + 1
  stabilityData.value.push({
    id: nextId,
    formulaName: newTest.value.formulaName,
    condition: newTest.value.condition,
    results: [{
      week: 0,
      deltaE: 0,
      viscChange: 0,
      ph: newTest.value.ph || null,
      appearance: newTest.value.appearance || '양호',
      result: 'pass',
    }],
  })
  newTest.value = { formulaName: '', condition: '', ph: null, appearance: '양호' }
  showAddModal.value = false
}
</script>

<style scoped>
.stability-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 패널 ── */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-right: 8px;
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

/* ── 요약 카드 ── */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.s-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  text-align: center;
}

.s-val {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
}

.s-label {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.s-pass .s-val { color: var(--green); }
.s-warning .s-val { color: var(--amber); }
.s-fail .s-val { color: var(--red); }

/* ── 탭 ── */
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}

.tab-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-sub);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  transition: all 0.15s;
}

.tab-btn:hover { background: var(--bg); color: var(--text); }

.tab-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* ── 테이블 ── */
.table-wrap { overflow-x: auto; }

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: var(--bg);
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.3px;
  color: var(--text-dim);
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.data-table td {
  padding: 9px 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.data-table tbody tr { cursor: pointer; transition: background 0.1s; }
.data-table tbody tr:hover { background: var(--bg); }

.compare-table tbody tr { cursor: default; }
.compare-table th, .compare-table td { text-align: center; }
.compare-table th:first-child, .compare-table td:first-child { text-align: left; }

.cell-name { font-weight: 600; white-space: nowrap; }
.cell-cond { font-size: 12px; color: var(--text-sub); font-family: var(--font-mono); }
.cell-count { font-family: var(--font-mono); color: var(--text-dim); }
.cell-week { font-family: var(--font-mono); color: var(--text-dim); }
.cell-ph { font-family: var(--font-mono); color: var(--text-sub); }
.cell-appear { font-size: 12px; color: var(--text-sub); }
.cell-center { text-align: center; }
.cell-na { color: var(--text-dim); opacity: 0.4; }
.empty-cell { text-align: center; color: var(--text-dim); padding: 24px; }

/* ── ΔE 뱃지 ── */
.delta-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
}

.de-green { color: var(--green); background: rgba(58,144,104,0.10); }
.de-amber { color: var(--amber); background: rgba(196,140,40,0.12); }
.de-red   { color: var(--red);   background: rgba(196,78,78,0.12); }

/* ── 점도 ── */
.vc-dim   { color: var(--text-sub); font-family: var(--font-mono); }
.vc-amber { color: var(--amber); font-weight: 600; font-family: var(--font-mono); }
.vc-red   { color: var(--red);   font-weight: 600; font-family: var(--font-mono); }

/* ── 판정 칩 ── */
.judge-chip {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.chip-pass    { color: var(--green); background: rgba(58,144,104,0.12); }
.chip-warning { color: var(--amber); background: rgba(196,140,40,0.12); }
.chip-fail    { color: var(--red);   background: rgba(196,78,78,0.12); }

/* ── 상세 헤더 ── */
.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}

.cond-chips { display: flex; gap: 6px; }

.cond-chip {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  color: var(--text-sub);
}

/* ── 조건별 요약 카드 ── */
.condition-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.cond-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
}

.cond-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cond-card-title {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.cond-card-body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.cond-stat { display: flex; flex-direction: column; gap: 1px; }

.cond-stat-label {
  font-size: 10px;
  color: var(--text-dim);
}

.cond-stat-val {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono);
}

/* ── 판정 기준 ── */
.criteria-panel { background: var(--bg); }

.criteria-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.criteria-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.criteria-desc {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-sub);
}

/* ── 버튼 ── */
.btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: #a68350; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text-sub); }
.btn-ghost:hover { background: var(--bg); }

/* ── 모달 ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 { margin: 0; font-size: 14px; }

.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-dim);
  padding: 0 4px;
}

.modal-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-footer {
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-row { display: flex; gap: 12px; }
.flex-1 { flex: 1; }

.form-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
}

.form-input {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}

.form-input:focus { border-color: var(--accent); }

/* ── QA 연동 ── */
.qa-link-body { padding: 12px 20px; display: flex; flex-direction: column; gap: 8px; }
.btn-link {
  font-size: 12px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.15s;
}
.btn-link:hover { opacity: 0.7; }
.qa-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--bg);
  border-radius: 6px;
}
.qa-formula-name { font-size: 13px; font-weight: 600; color: var(--text); min-width: 160px; }
.qa-progress-wrap { flex: 1; display: flex; align-items: center; gap: 8px; }
.qa-progress-bar {
  flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;
}
.qa-progress-fill {
  height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.3s;
}
.qa-progress-text {
  font-size: 11px; font-family: var(--font-mono); font-weight: 600; color: var(--text-sub); min-width: 32px; text-align: right;
}
.qa-status-chip {
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; white-space: nowrap;
}
.qa-done { color: var(--green); background: rgba(58,144,104,0.12); }
.qa-progress { color: var(--amber); background: rgba(176,120,32,0.12); }
.qa-none { color: var(--text-dim); background: var(--bg); border: 1px solid var(--border); }
.qa-empty { font-size: 12px; color: var(--text-dim); text-align: center; padding: 12px; }

@media (max-width: 640px) {
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
  .condition-summary { grid-template-columns: 1fr; }
  .form-row { flex-direction: column; }
}
</style>
