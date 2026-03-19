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

    <!-- DB 자동 검증 패널 -->
    <div v-if="autoChecks.length || autoChecksLoading" class="panel db-auto-panel">
      <div class="panel-header">
        <div>
          <span class="section-label">DB AUTO-CHECK</span>
          <span class="section-title">DB 자동 검증 (8항목)</span>
        </div>
        <span v-if="autoChecksLoading" class="auto-loading-badge">분석 중...</span>
        <span v-else class="auto-done-badge">
          🟢 {{ autoPassCount }} &nbsp; 🟡 {{ autoWarnCount }} &nbsp; 🔴 {{ autoFailCount }}
        </span>
      </div>
      <div class="auto-checks-grid">
        <div v-if="autoChecksLoading" v-for="n in 8" :key="n" class="auto-check-row skeleton">
          <div class="auto-icon">·</div>
          <div class="auto-body"><div class="auto-name skeleton-line"></div></div>
        </div>
        <div
          v-for="chk in autoChecks"
          :key="chk.name"
          class="auto-check-row"
          :class="`acheck-${chk.status}`"
        >
          <div class="auto-icon">{{ autoIcon(chk.status) }}</div>
          <div class="auto-body">
            <div class="auto-name">{{ chk.name }}</div>
            <div class="auto-msg">{{ chk.message }}</div>
            <div v-if="chk.detail" class="auto-detail">{{ chk.detail }}</div>
          </div>
          <div class="auto-badge" :class="`abadge-${chk.status}`">{{ autoLabel(chk.status) }}</div>
        </div>
      </div>
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

    <!-- 안정성 시험 연동 -->
    <div v-if="stabilityStatus" class="panel stability-link-panel">
      <div class="panel-header">
        <div>
          <span class="section-label">STABILITY LINK</span>
          <span class="section-title">안정성 시험 현황</span>
        </div>
        <router-link to="/stability" class="btn-link">안정성 시험 →</router-link>
      </div>
      <div class="stability-link-body">
        <div class="stab-summary-cards">
          <div class="stab-mini-card">
            <div class="stab-mini-val">{{ stabilityStatus.total }}</div>
            <div class="stab-mini-label">등록 시험</div>
          </div>
          <div class="stab-mini-card stab-pass">
            <div class="stab-mini-val">{{ stabilityStatus.pass }}</div>
            <div class="stab-mini-label">적합</div>
          </div>
          <div class="stab-mini-card stab-warning">
            <div class="stab-mini-val">{{ stabilityStatus.warning }}</div>
            <div class="stab-mini-label">주의</div>
          </div>
          <div class="stab-mini-card stab-fail">
            <div class="stab-mini-val">{{ stabilityStatus.fail }}</div>
            <div class="stab-mini-label">부적합</div>
          </div>
        </div>
        <div v-if="stabilityStatus.items.length" class="stab-detail-list">
          <div v-for="item in stabilityStatus.items" :key="item.condition" class="stab-detail-row">
            <span class="stab-cond">{{ item.condition }}</span>
            <span class="stab-week">W{{ item.lastWeek }}</span>
            <span class="stab-de" :class="item.deClass">ΔE {{ item.deltaE }}</span>
            <span class="stab-judge" :class="'judge-' + item.judge">{{ item.judgeLabel }}</span>
          </div>
        </div>
        <div v-else class="stab-empty">이 처방에 등록된 안정성 시험이 없습니다</div>
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
function getAuthHeader() {
  const token = localStorage.getItem('mylab:auth-token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const { formulas } = useFormulaStore()
const api = useAPI()

const formulaList = computed(() => [...formulas.value].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)))

const selectedFormulaId = ref('')
const isValidating = ref(false)
const validationResult = ref(null)
const apiError = ref(false)
const stabilityStatus = ref(null)

// ─── DB 자동 검증 ───
const autoChecks = ref([])
const autoChecksLoading = ref(false)
const autoPassCount = computed(() => autoChecks.value.filter(c => c.status === 'pass').length)
const autoWarnCount = computed(() => autoChecks.value.filter(c => c.status === 'warn').length)
const autoFailCount = computed(() => autoChecks.value.filter(c => c.status === 'fail').length)

function autoIcon(status) {
  if (status === 'pass') return '🟢'
  if (status === 'warn') return '🟡'
  return '🔴'
}
function autoLabel(status) {
  if (status === 'pass') return '통과'
  if (status === 'warn') return '주의'
  return '오류'
}

async function runAutoChecks(ingredients) {
  autoChecksLoading.value = true
  autoChecks.value = []
  const checks = []

  // API 호출: expand-inci, ph-check, regulation-limits 병렬 실행
  // expand-inci는 name/wt_pct 형식으로 변환
  const inciIngredients = ingredients.map(i => ({
    name: i.inci_name,
    wt_pct: parseFloat(i.percentage) || 0,
  }))
  const phIngredients = ingredients.map(i => ({
    inci_name: i.inci_name,
    wt_pct: parseFloat(i.percentage) || 0,
  }))

  const [inciRes, phRes, regRes] = await Promise.all([
    api.expandInci(inciIngredients).catch(() => null),
    api.phCheck(phIngredients).catch(() => null),
    api.checkRegulationLimits(ingredients).catch(() => null),
  ])

  // ① COMPOUND-EXPANSION: 복합원료 전개 여부
  if (inciRes && !inciRes.error) {
    const expanded = (inciRes.formula_inci || []).filter(r => r.source_trade_name)
    const compounds = [...new Set(expanded.map(r => r.source_trade_name))].filter(Boolean)
    if (compounds.length > 0) {
      checks.push({
        name: '① 복합원료 전개',
        status: 'warn',
        message: `${compounds.length}개 복합원료 포함 — INCI 전개 완료`,
        detail: compounds.join(', '),
      })
    } else {
      checks.push({
        name: '① 복합원료 전개',
        status: 'pass',
        message: '복합원료 없음 — 단일 원료로만 구성',
        detail: null,
      })
    }
  } else {
    checks.push({ name: '① 복합원료 전개', status: 'warn', message: 'compound_master 조회 불가', detail: null })
  }

  // ② PRECISION-ARITHMETIC: 배합비 합산 정밀도
  const total = ingredients.reduce((s, i) => s + (parseFloat(i.percentage) || 0), 0)
  const totalR = Math.round(total * 1000) / 1000
  if (inciRes?.validation?.total_wt !== undefined) {
    const serverTotal = inciRes.validation.total_wt
    const diff = Math.abs(serverTotal - 100)
    if (serverTotal > 100.01) {
      checks.push({ name: '② 배합비 정밀도', status: 'fail', message: `합산 ${serverTotal}% — 100% 초과`, detail: null })
    } else if (diff > 0.5) {
      checks.push({ name: '② 배합비 정밀도', status: 'warn', message: `합산 ${serverTotal}% — 100%에 미달`, detail: null })
    } else {
      checks.push({ name: '② 배합비 정밀도', status: 'pass', message: `합산 ${serverTotal}% — 정상`, detail: null })
    }
  } else {
    if (totalR > 100.01) {
      checks.push({ name: '② 배합비 정밀도', status: 'fail', message: `합산 ${totalR.toFixed(3)}% — 100% 초과`, detail: null })
    } else if (totalR < 99.0) {
      checks.push({ name: '② 배합비 정밀도', status: 'warn', message: `합산 ${totalR.toFixed(3)}% — 미달`, detail: null })
    } else {
      checks.push({ name: '② 배합비 정밀도', status: 'pass', message: `합산 ${totalR.toFixed(3)}% — 정상`, detail: null })
    }
  }

  // ③ 사용농도 적정: 규제 한도 경고 항목 확인
  if (regRes?.success && regRes.data) {
    const warnings = regRes.data.warnings || []
    if (warnings.length > 0) {
      checks.push({
        name: '③ 사용농도 적정',
        status: 'warn',
        message: `${warnings.length}개 성분 한도 근접`,
        detail: warnings.slice(0, 2).map(w => `${w.inci_name} ${w.percentage}% (한도 ${w.max_allowed}%)`).join(' / '),
      })
    } else {
      checks.push({ name: '③ 사용농도 적정', status: 'pass', message: '전 성분 사용 농도 기준 이내', detail: null })
    }
  } else {
    checks.push({ name: '③ 사용농도 적정', status: 'warn', message: '사용농도 DB 조회 불가', detail: null })
  }

  // ④ pH 충돌 감지
  if (phRes && !phRes.error) {
    const conflicts = phRes.conflicts || []
    if (conflicts.length > 0) {
      checks.push({
        name: '④ pH 충돌 감지',
        status: 'fail',
        message: `${conflicts.length}건 pH 범위 충돌 검출`,
        detail: conflicts.slice(0, 2).map(c => `${c.inci_a} ↔ ${c.inci_b}`).join(' / '),
      })
    } else if (phRes.estimated_ph !== null) {
      const ph = phRes.estimated_ph
      const inRange = ph >= 3.5 && ph <= 8.5
      checks.push({
        name: '④ pH 충돌 감지',
        status: inRange ? 'pass' : 'warn',
        message: `추정 pH ${ph} — ${inRange ? '정상 범위' : '범위 외 확인 필요'}`,
        detail: inRange ? null : `권장 pH 3.5~8.5 / 조정제: ${phRes.recommended_adjuster || '확인 필요'}`,
      })
    } else {
      checks.push({ name: '④ pH 충돌 감지', status: 'pass', message: 'pH 데이터 없음 (직접 측정 필요)', detail: null })
    }
  } else {
    checks.push({ name: '④ pH 충돌 감지', status: 'warn', message: 'pH 데이터 조회 불가', detail: null })
  }

  // ⑤ 규제 위반
  if (regRes?.success && regRes.data) {
    const violations = regRes.data.violations || []
    if (violations.length > 0) {
      checks.push({
        name: '⑤ 규제 한도 위반',
        status: 'fail',
        message: `${violations.length}건 규제 한도 초과`,
        detail: violations.slice(0, 2).map(v => `${v.inci_name} ${v.percentage}% (한도 ${v.max_allowed}%, ${v.source})`).join(' / '),
      })
    } else {
      checks.push({ name: '⑤ 규제 한도 위반', status: 'pass', message: '규제 위반 없음', detail: null })
    }
  } else {
    checks.push({ name: '⑤ 규제 한도 위반', status: 'warn', message: '규제 DB 조회 불가', detail: null })
  }

  // ⑥ 피부타입 부적합: skin_type_suitability 기반 — 직접 검사 불가 시 pass
  // (현재 batch API 없음 → 개별 조회 비용 높아 warn 처리)
  checks.push({
    name: '⑥ 피부타입 적합성',
    status: 'warn',
    message: '성분별 skin_type_suitability 확인 권장',
    detail: '원료DB 페이지에서 개별 성분 상세 확인',
  })

  // ⑦ 금지원료 포함: pharma_prohibited 타입 INCI명 매칭
  // expand-inci 결과에서 확인하거나 별도 조회 없이 규제 제한 항목에서 유추
  const pharmaViolations = (regRes?.data?.violations || []).filter(v =>
    v.message && v.message.includes('금지')
  )
  // regulation_cache의 restriction에 '금지' 포함인 성분 중 현재 처방에 포함된 것 확인
  // (checkRegulationLimits는 농도 기반이라 금지성분 직접 검출 어려움 → warn 처리)
  if (pharmaViolations.length > 0) {
    checks.push({
      name: '⑦ 금지원료 포함',
      status: 'fail',
      message: `${pharmaViolations.length}건 금지 성분 포함`,
      detail: pharmaViolations.map(v => v.inci_name).join(', '),
    })
  } else {
    checks.push({
      name: '⑦ 금지원료 포함',
      status: 'warn',
      message: '금지원료 자동 검출 불완전 — 규제위반 ⑤ 항목 참조',
      detail: '원료DB → 금지물질 필터로 처방 원료 수동 확인 권장',
    })
  }

  // ⑧ 배합비 100% 합산 검증 (최종 확인)
  if (totalR > 100.01) {
    checks.push({ name: '⑧ 배합비 합계 100%', status: 'fail', message: `총합 ${totalR.toFixed(3)}% — 100% 초과`, detail: '성분 비율을 재조정하세요.' })
  } else if (totalR < 99.5) {
    checks.push({ name: '⑧ 배합비 합계 100%', status: 'warn', message: `총합 ${totalR.toFixed(3)}% — 미달 (정제수 등으로 보충)`, detail: null })
  } else {
    checks.push({ name: '⑧ 배합비 합계 100%', status: 'pass', message: `총합 ${totalR.toFixed(3)}% — 유효`, detail: null })
  }

  autoChecks.value = checks
  autoChecksLoading.value = false
}

// ─── 안정성 시험 데이터 연동 ───
function getStabilityData() {
  try {
    const raw = localStorage.getItem('mylab:stability')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function autoJudgeStability(deltaE, viscChange) {
  const absVisc = Math.abs(viscChange)
  if (deltaE > 2.0 || absVisc > 15) return 'fail'
  if (deltaE >= 1.0 || absVisc >= 10) return 'warning'
  return 'pass'
}

function loadStabilityStatus(formulaTitle) {
  if (!formulaTitle) { stabilityStatus.value = null; return }
  const allStab = getStabilityData()
  // formula_id 우선 매칭, 없으면 title로 폴백 (하위 호환)
  const matched = allStab.filter(d =>
    (selectedFormulaId.value && d.formulaId === selectedFormulaId.value) ||
    d.formulaName === formulaTitle
  )
  if (!matched.length) {
    stabilityStatus.value = { total: 0, pass: 0, warning: 0, fail: 0, items: [] }
    return
  }
  let pass = 0, warning = 0, fail = 0
  const items = matched.map(d => {
    const last = d.results[d.results.length - 1]
    const judge = autoJudgeStability(last.deltaE, last.viscChange)
    if (judge === 'pass') pass++
    else if (judge === 'warning') warning++
    else fail++
    return {
      condition: d.condition,
      lastWeek: last.week,
      deltaE: last.deltaE.toFixed(1),
      deClass: last.deltaE > 2 ? 'de-red' : last.deltaE >= 1 ? 'de-amber' : 'de-green',
      judge,
      judgeLabel: judge === 'pass' ? '적합' : judge === 'warning' ? '주의' : '부적합',
    }
  })
  stabilityStatus.value = { total: matched.length, pass, warning, fail, items }
}

// ─── 자동 검증 ───
async function runValidation() {
  if (!selectedFormulaId.value) return
  isValidating.value = true
  validationResult.value = null
  apiError.value = false
  autoChecks.value = []

  // 선택된 처방의 원료 목록을 서버에 전달
  const formula = formulas.value.find(f => f.id === selectedFormulaId.value)
  const ingredients = (formula?.formula_data?.ingredients || formula?.ingredients || []).map(i => ({
    inci_name: i.inci_name || i.name,
    percentage: i.percentage,
    phase: i.phase || '',
  }))

  // DB 자동 검증 병렬 실행 (서버 검증과 동시)
  const autoPromise = runAutoChecks(ingredients)

  const res = await api.validateFormula(ingredients)
  isValidating.value = false

  if (res && res.success !== false) {
    validationResult.value = res.data || res
  } else {
    apiError.value = true
    validationResult.value = makeDummyResult()
  }

  // 안정성 시험 연동: 해당 처방의 안정성 결과를 검증 항목에 추가
  loadStabilityStatus(formula?.title)
  if (stabilityStatus.value && validationResult.value?.checks) {
    const stab = stabilityStatus.value
    if (stab.total === 0) {
      validationResult.value.checks.push({
        name: '안정성 시험',
        status: 'warn',
        message: '등록된 안정성 시험이 없습니다.',
        detail: '안정성 페이지에서 시험을 등록하세요.',
      })
    } else if (stab.fail > 0) {
      validationResult.value.checks.push({
        name: '안정성 시험',
        status: 'fail',
        message: `${stab.total}건 중 ${stab.fail}건 부적합`,
        detail: stab.items.filter(i => i.judge === 'fail').map(i => `${i.condition}: ΔE ${i.deltaE}`).join(', '),
      })
    } else if (stab.warning > 0) {
      validationResult.value.checks.push({
        name: '안정성 시험',
        status: 'warn',
        message: `${stab.total}건 중 ${stab.warning}건 주의`,
        detail: stab.items.filter(i => i.judge === 'warning').map(i => `${i.condition}: ΔE ${i.deltaE}`).join(', '),
      })
    } else {
      validationResult.value.checks.push({
        name: '안정성 시험',
        status: 'pass',
        message: `${stab.total}건 전체 적합`,
        detail: null,
      })
    }
  }

  // 안정성 시험 등록 여부로 체크리스트 자동 업데이트
  loadChecklist()
  if (stabilityStatus.value && stabilityStatus.value.total > 0) {
    const stabItem = checklist.value.find(c => c.id === 5)
    if (stabItem && !stabItem.checked) {
      stabItem.checked = true
      saveChecklist()
    }
  }
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

async function loadChecklist() {
  const formulaId = selectedFormulaId.value
  const key = storageKey(formulaId)

  // 1. 서버에서 우선 로드 시도
  if (formulaId) {
    try {
      const res = await fetch(`${API_BASE}/api/user/checklists`, {
        headers: { ...getAuthHeader() },
      })
      if (res.ok) {
        const all = await res.json()
        const serverRecord = all.find(r => r.id === formulaId || r.formula_id === formulaId)
        if (serverRecord?.items) {
          checklist.value = DEFAULT_CHECKLIST.map(def => ({
            ...def,
            checked: serverRecord.items.find(p => p.id === def.id)?.checked ?? false,
          }))
          // localStorage도 업데이트
          localStorage.setItem(key, JSON.stringify(serverRecord.items))
          return
        }
      }
    } catch { /* 서버 실패 시 localStorage 폴백 */ }
  }

  // 2. localStorage 폴백
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
  const items = checklist.value.map(({ id, checked }) => ({ id, checked }))
  localStorage.setItem(key, JSON.stringify(items))
  // 서버 동기화 (formulaId를 record id로 사용)
  if (selectedFormulaId.value) {
    const formulaId = selectedFormulaId.value
    fetch(`${API_BASE}/api/user/checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ id: formulaId, formula_id: formulaId, items }),
    }).catch(e => console.warn('[Checklist] 서버 동기화 실패:', e.message))
  }
}

function resetChecklist() {
  checklist.value = DEFAULT_CHECKLIST.map(i => ({ ...i }))
  saveChecklist()
}

watch(selectedFormulaId, () => {
  validationResult.value = null
  apiError.value = false
  stabilityStatus.value = null
  autoChecks.value = []
  autoChecksLoading.value = false
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

/* ─── DB 자동 검증 패널 ─── */
.db-auto-panel { }
.auto-loading-badge {
  font-size: 11px; font-family: var(--font-mono); color: var(--text-dim);
  background: var(--bg); border: 1px solid var(--border);
  padding: 3px 10px; border-radius: 20px; animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
.auto-done-badge {
  font-size: 12px; font-family: var(--font-mono); font-weight: 600;
  background: var(--bg); border: 1px solid var(--border);
  padding: 3px 12px; border-radius: 20px;
}
.auto-checks-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  padding: 8px 12px 12px;
}
.auto-check-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 6px;
  transition: background 0.1s;
}
.auto-check-row:hover { background: var(--bg); }
.acheck-pass { }
.acheck-warn { }
.acheck-fail { }
.auto-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; line-height: 1.3; }
.auto-body { flex: 1; min-width: 0; }
.auto-name { font-size: 12px; font-weight: 600; color: var(--text); }
.auto-msg { font-size: 11px; color: var(--text-sub); margin-top: 2px; }
.auto-detail { font-size: 10px; color: var(--text-dim); margin-top: 3px; font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.auto-badge {
  font-size: 9px; font-family: var(--font-mono); font-weight: 700;
  padding: 2px 7px; border-radius: 4px; flex-shrink: 0; align-self: flex-start; margin-top: 2px;
}
.abadge-pass { background: rgba(58,144,104,0.12); color: var(--green); }
.abadge-warn { background: rgba(176,120,32,0.12); color: var(--amber); }
.abadge-fail { background: rgba(196,78,78,0.12); color: var(--red); }
.skeleton .auto-name.skeleton-line {
  height: 12px; background: var(--border); border-radius: 4px; width: 60%; margin: 4px 0;
}
@media (max-width: 1199px) {
  .auto-checks-grid { grid-template-columns: 1fr; }
}

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

/* ─── 안정성 시험 연동 ─── */
.stability-link-panel { }
.stability-link-body { padding: 16px 20px; }
.btn-link {
  font-size: 12px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.15s;
}
.btn-link:hover { opacity: 0.7; }
.stab-summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stab-mini-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}
.stab-mini-val {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text);
}
.stab-mini-label { font-size: 10px; color: var(--text-dim); margin-top: 1px; }
.stab-pass .stab-mini-val { color: var(--green); }
.stab-warning .stab-mini-val { color: var(--amber); }
.stab-fail .stab-mini-val { color: var(--red); }
.stab-detail-list { display: flex; flex-direction: column; gap: 4px; }
.stab-detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  background: var(--bg);
  border-radius: 4px;
  font-size: 12px;
}
.stab-cond { font-family: var(--font-mono); font-weight: 600; color: var(--text-sub); min-width: 80px; }
.stab-week { font-family: var(--font-mono); color: var(--text-dim); min-width: 30px; }
.stab-de { font-family: var(--font-mono); font-weight: 600; min-width: 50px; }
.de-green { color: var(--green); }
.de-amber { color: var(--amber); }
.de-red { color: var(--red); }
.stab-judge {
  font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 4px; margin-left: auto;
}
.judge-pass { color: var(--green); background: rgba(58,144,104,0.12); }
.judge-warning { color: var(--amber); background: rgba(176,120,32,0.12); }
.judge-fail { color: var(--red); background: rgba(196,78,78,0.12); }
.stab-empty { font-size: 12px; color: var(--text-dim); text-align: center; padding: 12px; }

@media (max-width: 1199px) {
  .checks-grid { grid-template-columns: 1fr; }
}
@media (max-width: 767px) {
  .select-row { flex-direction: column; }
  .btn-group { width: 100%; }
  .btn-group .btn { width: 100%; }
}
</style>
