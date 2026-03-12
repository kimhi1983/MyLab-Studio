<template>
  <div class="hlb-calc-page">
    <div class="page-header">
      <h1 class="page-title">HLB 계산기</h1>
      <p class="page-desc">오일상 Required HLB와 유화제 혼합 HLB를 계산하여 유화 안정성을 평가합니다.</p>
    </div>

    <div class="calc-layout">
      <!-- 오일상 섹션 -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">오일상 Required HLB</span>
          <span class="section-badge">Σ(HLBi × %i) / Σ(%i)</span>
        </div>
        <div class="panel-body">
          <!-- 오일 테이블 -->
          <table class="oil-table">
            <thead>
              <tr>
                <th class="col-name">오일명</th>
                <th class="col-hlb">HLB</th>
                <th class="col-pct">배합비 (%)</th>
                <th class="col-contrib">기여도</th>
                <th class="col-action"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(oil, idx) in oils" :key="oil.id">
                <td class="col-name">
                  <div class="name-cell">
                    <input
                      v-model="oil.name"
                      list="oil-datalist"
                      class="form-input name-input"
                      placeholder="오일명 입력 또는 선택"
                      @change="onOilNameChange(idx)"
                    />
                  </div>
                </td>
                <td class="col-hlb">
                  <input
                    v-model.number="oil.hlb"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    class="form-input hlb-input"
                    placeholder="HLB"
                  />
                </td>
                <td class="col-pct">
                  <input
                    v-model.number="oil.percentage"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    class="form-input pct-input"
                    placeholder="0.0"
                  />
                </td>
                <td class="col-contrib">
                  <span class="contrib-value">{{ calcContrib(oil) }}</span>
                </td>
                <td class="col-action">
                  <button class="remove-btn" @click="removeOil(idx)" title="제거">×</button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- datalist -->
          <datalist id="oil-datalist">
            <option v-for="o in OIL_HLB_DB" :key="o.name" :value="o.name" />
          </datalist>

          <button class="add-row-btn" @click="addOil">+ 오일 추가</button>

          <!-- Required HLB 결과 -->
          <div class="result-row">
            <span class="result-label">Required HLB</span>
            <span class="result-formula">
              Σ(HLBi × %i) / Σ(%i)
            </span>
            <span class="result-value accent">{{ requiredHLB.toFixed(2) }}</span>
          </div>
          <div class="total-pct-row" :class="{ 'pct-warn': Math.abs(totalOilPct - 100) > 0.1 && totalOilPct > 0 }">
            <span class="total-label">합계 배합비</span>
            <span class="total-val">{{ totalOilPct.toFixed(1) }}%</span>
            <span v-if="Math.abs(totalOilPct - 100) > 0.1 && totalOilPct > 0" class="total-hint">
              (100%로 맞추면 정확한 가중평균)
            </span>
          </div>
        </div>
      </div>

      <!-- 유화제 섹션 -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">유화제 혼합 HLB</span>
          <span class="section-badge">(HLB_A × A% + HLB_B × B%) / 100</span>
        </div>
        <div class="panel-body">
          <div class="emul-grid">
            <!-- 유화제 A -->
            <div class="emul-card emul-a">
              <div class="emul-card-header">
                <span class="emul-label">유화제 A</span>
                <span class="emul-hlb-badge">HLB {{ emulA.hlb.toFixed(1) }}</span>
              </div>
              <select v-model="emulA.name" class="form-input emul-select" @change="onEmulAChange">
                <option value="">유화제 선택</option>
                <option v-for="e in EMULSIFIER_DB" :key="e.name" :value="e.name">
                  {{ e.name }}
                </option>
              </select>
            </div>

            <!-- 유화제 B -->
            <div class="emul-card emul-b">
              <div class="emul-card-header">
                <span class="emul-label">유화제 B</span>
                <span class="emul-hlb-badge">HLB {{ emulB.hlb.toFixed(1) }}</span>
              </div>
              <select v-model="emulB.name" class="form-input emul-select" @change="onEmulBChange">
                <option value="">유화제 선택</option>
                <option v-for="e in EMULSIFIER_DB" :key="e.name" :value="e.name">
                  {{ e.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- 비율 슬라이더 -->
          <div class="slider-section">
            <div class="ratio-labels">
              <span class="ratio-a">A: {{ ratioA }}%</span>
              <span class="ratio-b">B: {{ 100 - ratioA }}%</span>
            </div>
            <div class="slider-wrap">
              <span class="slider-end-label">A 100%</span>
              <input
                v-model.number="ratioA"
                type="range"
                min="0"
                max="100"
                step="1"
                class="ratio-slider"
              />
              <span class="slider-end-label">B 100%</span>
            </div>
            <div class="ratio-tick-row">
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>

          <!-- 혼합 HLB 결과 -->
          <div class="mixed-result-box">
            <div class="mixed-row">
              <span class="mixed-label">혼합 HLB</span>
              <span class="mixed-formula">
                ({{ emulA.hlb.toFixed(1) }} × {{ ratioA }} + {{ emulB.hlb.toFixed(1) }} × {{ 100 - ratioA }}) / 100
              </span>
              <span class="mixed-value">{{ mixedHLB.toFixed(2) }}</span>
            </div>
            <div class="compare-row">
              <div class="compare-item">
                <span class="compare-label">Required</span>
                <span class="compare-val">{{ requiredHLB.toFixed(2) }}</span>
              </div>
              <div class="compare-sep">|</div>
              <div class="compare-item">
                <span class="compare-label">차이</span>
                <span class="compare-val" :class="diffColorClass">{{ hlbDiff.toFixed(2) }}</span>
              </div>
            </div>
            <div v-if="oils.some(o => o.percentage > 0) && emulA.name && emulB.name" class="diff-bar-wrap">
              <div class="diff-bar-bg">
                <div
                  class="diff-bar-fill"
                  :class="diffBarClass"
                  :style="{ width: Math.min(100, (hlbDiff / 3) * 100) + '%' }"
                ></div>
              </div>
              <span class="diff-bar-label" :class="diffColorClass">{{ diffStatusText }}</span>
            </div>
          </div>

          <!-- 추천 비율 -->
          <div v-if="emulA.name && emulB.name && emulA.name !== emulB.name" class="recommend-box">
            <span class="recommend-label">추천 비율</span>
            <span class="recommend-formula">
              A:B = {{ optimalRatioA.toFixed(0) }}:{{ (100 - optimalRatioA).toFixed(0) }}
            </span>
            <span class="recommend-arrow">→</span>
            <span class="recommend-result">혼합 HLB {{ calcMixedHLB(emulA.hlb, emulB.hlb, optimalRatioA).toFixed(2) }}</span>
            <button class="apply-btn" @click="applyOptimal" title="추천 비율 적용">적용</button>
          </div>
        </div>
      </div>

      <!-- 판정 섹션 -->
      <div class="panel verdict-panel" :class="verdictPanelClass">
        <div class="panel-header">
          <span class="panel-title">판정</span>
        </div>
        <div class="panel-body verdict-body">
          <div v-if="!emulA.name || !emulB.name || oils.length === 0" class="verdict-empty">
            오일과 유화제 A·B를 모두 선택하면 판정이 표시됩니다.
          </div>
          <template v-else>
            <div class="verdict-badge" :class="verdictClass">
              <span class="verdict-icon">{{ verdictIcon }}</span>
              <span class="verdict-text">{{ verdictText }}</span>
            </div>
            <div class="verdict-detail">
              <div class="verdict-row">
                <span class="vr-label">Required HLB</span>
                <span class="vr-val">{{ requiredHLB.toFixed(2) }}</span>
              </div>
              <div class="verdict-row">
                <span class="vr-label">혼합 HLB</span>
                <span class="vr-val">{{ mixedHLB.toFixed(2) }}</span>
              </div>
              <div class="verdict-row">
                <span class="vr-label">절대 차이</span>
                <span class="vr-val" :class="diffColorClass">{{ hlbDiff.toFixed(2) }}</span>
              </div>
            </div>
            <div v-if="verdictLevel !== 'pass'" class="verdict-recommend">
              <span class="vr-hint">추천: A:B = {{ optimalRatioA.toFixed(0) }}:{{ (100 - optimalRatioA).toFixed(0) }} 적용 시
                혼합 HLB {{ calcMixedHLB(emulA.hlb, emulB.hlb, optimalRatioA).toFixed(2) }} (차이 ≈ 0.00)</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

// ─── 데이터베이스 상수 ────────────────────────────────────────────────────
const EMULSIFIER_DB = [
  // 비이온 계면활성제 (친수성, HLB 높음)
  { name: 'Polysorbate 20 (Tween 20)', hlb: 16.7 },
  { name: 'Polysorbate 60 (Tween 60)', hlb: 14.9 },
  { name: 'Polysorbate 80 (Tween 80)', hlb: 15.0 },
  { name: 'PEG-40 Stearate', hlb: 16.9 },
  { name: 'PEG-100 Stearate', hlb: 18.8 },
  { name: 'Ceteareth-20', hlb: 15.7 },
  { name: 'Steareth-21', hlb: 15.5 },
  { name: 'Ceteth-20', hlb: 15.7 },
  { name: 'Laureth-23', hlb: 16.9 },
  // 비이온 계면활성제 (친유성, HLB 낮음)
  { name: 'Sorbitan Monostearate (Span 60)', hlb: 4.7 },
  { name: 'Sorbitan Monooleate (Span 80)', hlb: 4.3 },
  { name: 'Sorbitan Monopalmitate (Span 40)', hlb: 6.7 },
  { name: 'Sorbitan Tristearate (Span 65)', hlb: 2.1 },
  { name: 'Glyceryl Monostearate (GMS)', hlb: 3.8 },
  { name: 'Cetearyl Alcohol', hlb: 3.6 },
  { name: 'Cetyl Alcohol', hlb: 3.8 },
  { name: 'Stearyl Alcohol', hlb: 1.0 },
  // 실리콘 유화제
  { name: 'PEG-10 Dimethicone', hlb: 7.0 },
  { name: 'Cetyl PEG/PPG-10/1 Dimethicone', hlb: 3.0 },
  { name: 'Dimethicone Copolyol', hlb: 12.0 },
  // 기타
  { name: 'Lecithin', hlb: 4.0 },
  { name: 'Sucrose Stearate', hlb: 11.0 },
  { name: 'Polyglyceryl-3 Methylglucose Distearate', hlb: 12.0 },
]

const OIL_HLB_DB = [
  { name: '미네랄오일 (Mineral Oil)', hlb: 10.5 },
  { name: '시어버터 (Shea Butter)', hlb: 8.0 },
  { name: '코코넛오일 (Coconut Oil)', hlb: 6.0 },
  { name: '올리브오일 (Olive Oil)', hlb: 7.0 },
  { name: '호호바오일 (Jojoba Oil)', hlb: 6.5 },
  { name: '스쿠알란 (Squalane)', hlb: 5.0 },
  { name: '세틸에틸헥사노에이트 (Cetyl Ethylhexanoate)', hlb: 10.0 },
  { name: '아이소프로필미리스테이트 (IPM)', hlb: 11.5 },
  { name: '카프릴릭/카프릭 트리글리세라이드 (MCT)', hlb: 5.0 },
  { name: '밀랍 (Beeswax)', hlb: 12.0 },
  { name: '세테아릴알코올 (Cetearyl Alcohol)', hlb: 3.6 },
  { name: '스테아릭애씨드 (Stearic Acid)', hlb: 15.0 },
  { name: '해바라기씨오일 (Sunflower Seed Oil)', hlb: 7.0 },
  { name: '아르간오일 (Argan Oil)', hlb: 7.0 },
  { name: '아보카도오일 (Avocado Oil)', hlb: 7.0 },
]

// ─── 상태 ────────────────────────────────────────────────────────────────
let oilIdCounter = 0

function makeOil(name = '', hlb = 0, percentage = 0) {
  return { id: ++oilIdCounter, name, hlb, percentage }
}

const oils = ref([
  makeOil('미네랄오일 (Mineral Oil)', 10.5, 15.0),
  makeOil('시어버터 (Shea Butter)', 8.0, 5.0),
])

const emulA = reactive({ name: 'Polysorbate 60 (Tween 60)', hlb: 14.9 })
const emulB = reactive({ name: 'Sorbitan Monostearate (Span 60)', hlb: 4.7 })
const ratioA = ref(40)

// ─── 계산 로직 ────────────────────────────────────────────────────────────
function calcRequiredHLB(oilList) {
  const totalPct = oilList.reduce((s, o) => s + (o.percentage || 0), 0)
  if (totalPct === 0) return 0
  return oilList.reduce((s, o) => s + (o.hlb || 0) * (o.percentage || 0), 0) / totalPct
}

function calcMixedHLB(hlbA, hlbB, rA) {
  return (hlbA * rA + hlbB * (100 - rA)) / 100
}

function calcOptimalRatio(reqHLB, hlbA, hlbB) {
  if (hlbA === hlbB) return 50
  return Math.max(0, Math.min(100, ((reqHLB - hlbB) / (hlbA - hlbB)) * 100))
}

// ─── Computed ─────────────────────────────────────────────────────────────
const totalOilPct = computed(() => oils.value.reduce((s, o) => s + (o.percentage || 0), 0))

const requiredHLB = computed(() => calcRequiredHLB(oils.value))

const mixedHLB = computed(() => calcMixedHLB(emulA.hlb, emulB.hlb, ratioA.value))

const hlbDiff = computed(() => Math.abs(mixedHLB.value - requiredHLB.value))

const optimalRatioA = computed(() => calcOptimalRatio(requiredHLB.value, emulA.hlb, emulB.hlb))

// 판정 레벨: pass / ok / warn
const verdictLevel = computed(() => {
  if (!emulA.name || !emulB.name) return 'none'
  if (hlbDiff.value <= 0.5) return 'pass'
  if (hlbDiff.value <= 1.0) return 'ok'
  return 'warn'
})

const verdictClass = computed(() => ({
  'verdict-pass': verdictLevel.value === 'pass',
  'verdict-ok': verdictLevel.value === 'ok',
  'verdict-warn': verdictLevel.value === 'warn',
}))

const verdictPanelClass = computed(() => ({
  'verdict-panel-pass': verdictLevel.value === 'pass',
  'verdict-panel-ok': verdictLevel.value === 'ok',
  'verdict-panel-warn': verdictLevel.value === 'warn',
}))

const verdictIcon = computed(() => {
  if (verdictLevel.value === 'pass') return '●'
  if (verdictLevel.value === 'ok') return '◐'
  return '⚠'
})

const verdictText = computed(() => {
  if (verdictLevel.value === 'pass') return 'PASS — 유화 안정성 양호 (차이 ≤ 0.5)'
  if (verdictLevel.value === 'ok') return 'OK — 허용 범위 내 (차이 0.5 ~ 1.0)'
  return '주의 — 유화 안정성 불안정 (차이 > 1.0)'
})

const diffColorClass = computed(() => {
  if (verdictLevel.value === 'pass') return 'color-green'
  if (verdictLevel.value === 'ok') return 'color-amber'
  return 'color-red'
})

const diffBarClass = computed(() => {
  if (verdictLevel.value === 'pass') return 'bar-green'
  if (verdictLevel.value === 'ok') return 'bar-amber'
  return 'bar-red'
})

const diffStatusText = computed(() => {
  if (verdictLevel.value === 'pass') return '양호'
  if (verdictLevel.value === 'ok') return '허용'
  return '주의'
})

// ─── 메서드 ───────────────────────────────────────────────────────────────
function addOil() {
  oils.value.push(makeOil())
}

function removeOil(idx) {
  oils.value.splice(idx, 1)
}

function onOilNameChange(idx) {
  const found = OIL_HLB_DB.find(o => o.name === oils.value[idx].name)
  if (found) {
    oils.value[idx].hlb = found.hlb
  }
}

function onEmulAChange() {
  const found = EMULSIFIER_DB.find(e => e.name === emulA.name)
  if (found) emulA.hlb = found.hlb
}

function onEmulBChange() {
  const found = EMULSIFIER_DB.find(e => e.name === emulB.name)
  if (found) emulB.hlb = found.hlb
}

function applyOptimal() {
  ratioA.value = Math.round(optimalRatioA.value)
}

function calcContrib(oil) {
  const totalPct = oils.value.reduce((s, o) => s + (o.percentage || 0), 0)
  if (totalPct === 0 || !oil.percentage) return '—'
  return ((oil.hlb * oil.percentage) / totalPct).toFixed(2)
}
</script>

<style scoped>
/* ── 페이지 레이아웃 ─────────────────────────────────────────────────── */
.hlb-calc-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  margin-bottom: 4px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}

.page-desc {
  font-size: 13px;
  color: var(--text-sub);
  margin: 0;
}

.calc-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 패널 공통 ───────────────────────────────────────────────────────── */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.panel-title {
  font-size: 12px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  font-weight: 600;
}

.section-badge {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--accent-dim);
  letter-spacing: 0;
}

.panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── 오일 테이블 ────────────────────────────────────────────────────── */
.oil-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.oil-table th {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-dim);
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  font-weight: 600;
}

.oil-table td {
  padding: 5px 6px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.oil-table tbody tr:last-child td {
  border-bottom: none;
}

.oil-table tbody tr:hover td {
  background: var(--bg);
}

.col-name { width: 40%; }
.col-hlb { width: 14%; }
.col-pct { width: 18%; }
.col-contrib { width: 18%; text-align: right; }
.col-action { width: 10%; text-align: center; }

.name-cell { width: 100%; }

/* ── 폼 입력 ────────────────────────────────────────────────────────── */
.form-input {
  width: 100%;
  padding: 5px 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(184, 147, 90, 0.15);
}

.name-input { min-width: 180px; }
.hlb-input { text-align: center; }
.pct-input { text-align: center; }

.contrib-value {
  display: block;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-sub);
  padding-right: 4px;
}

.remove-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: var(--red-bg);
  color: var(--red);
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  line-height: 1;
}

.remove-btn:hover {
  background: var(--red);
  color: #fff;
}

/* ── 오일 추가 버튼 ──────────────────────────────────────────────────── */
.add-row-btn {
  align-self: flex-start;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px dashed var(--border-mid);
  border-radius: 5px;
  background: transparent;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.15s;
}

.add-row-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

/* ── Required HLB 결과 ───────────────────────────────────────────────── */
.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--accent-light);
  border: 1px solid var(--accent-dim);
  border-radius: 7px;
}

.result-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.result-formula {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  flex: 1;
}

.result-value {
  font-size: 20px;
  font-weight: 800;
  font-family: var(--font-mono);
  letter-spacing: -0.5px;
}

.result-value.accent { color: var(--accent); }

.total-pct-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-dim);
}

.total-label { color: var(--text-dim); }
.total-val { font-family: var(--font-mono); font-weight: 600; }
.pct-warn .total-val { color: var(--amber); }

.total-hint {
  font-size: 10px;
  color: var(--amber);
}

/* ── 유화제 카드 ─────────────────────────────────────────────────────── */
.emul-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.emul-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emul-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.emul-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-sub);
  font-family: var(--font-mono);
}

.emul-a { border-left: 3px solid var(--accent); }
.emul-b { border-left: 3px solid var(--blue); }

.emul-hlb-badge {
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--accent-dim);
}

.emul-select {
  padding: 6px 8px;
  font-size: 12px;
}

/* ── 슬라이더 ───────────────────────────────────────────────────────── */
.slider-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.ratio-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-mono);
}

.ratio-a { color: var(--accent); }
.ratio-b { color: var(--blue); }

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-end-label {
  font-size: 10px;
  color: var(--text-dim);
  white-space: nowrap;
  font-family: var(--font-mono);
}

.ratio-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--accent) var(--ratio-a, 40%), var(--blue) var(--ratio-a, 40%));
  outline: none;
  cursor: pointer;
}

.ratio-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--accent);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  cursor: pointer;
  transition: border-color 0.15s;
}

.ratio-slider::-webkit-slider-thumb:hover {
  border-color: #a07030;
}

.ratio-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--accent);
  cursor: pointer;
}

.ratio-tick-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  padding: 0 2px;
}

/* ── 혼합 HLB 결과 박스 ─────────────────────────────────────────────── */
.mixed-result-box {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mixed-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mixed-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.mixed-formula {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  flex: 1;
}

.mixed-value {
  font-size: 20px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: var(--blue);
  letter-spacing: -0.5px;
}

.compare-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.compare-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.compare-label {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.compare-val {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-sub);
}

.compare-sep {
  color: var(--border-mid);
}

.diff-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-bar-bg {
  flex: 1;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.diff-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.bar-green { background: var(--green); }
.bar-amber { background: var(--amber); }
.bar-red { background: var(--red); }

.diff-bar-label {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  white-space: nowrap;
}

/* ── 추천 비율 ──────────────────────────────────────────────────────── */
.recommend-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--blue-bg);
  border: 1px solid #c5d8f0;
  border-radius: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}

.recommend-label {
  font-weight: 700;
  color: var(--blue);
  font-family: var(--font-mono);
}

.recommend-formula {
  font-family: var(--font-mono);
  color: var(--text-sub);
  font-weight: 600;
}

.recommend-arrow {
  color: var(--text-dim);
}

.recommend-result {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--blue);
}

.apply-btn {
  margin-left: auto;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid var(--blue);
  border-radius: 4px;
  background: var(--blue-bg);
  color: var(--blue);
  cursor: pointer;
  transition: all 0.15s;
}

.apply-btn:hover {
  background: var(--blue);
  color: #fff;
}

/* ── 색상 유틸 ──────────────────────────────────────────────────────── */
.color-green { color: var(--green) !important; }
.color-amber { color: var(--amber) !important; }
.color-red { color: var(--red) !important; }

/* ── 판정 패널 ──────────────────────────────────────────────────────── */
.verdict-panel {
  border-width: 1px;
  transition: border-color 0.3s;
}

.verdict-panel-pass { border-color: #a8d8c0; }
.verdict-panel-ok { border-color: #e0c070; }
.verdict-panel-warn { border-color: #e0a8a8; }

.verdict-body {
  min-height: 80px;
}

.verdict-empty {
  text-align: center;
  padding: 20px;
  font-size: 13px;
  color: var(--text-dim);
}

.verdict-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 7px;
  font-weight: 700;
  font-size: 14px;
}

.verdict-pass {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid #a8d8c0;
}

.verdict-ok {
  background: var(--amber-bg);
  color: var(--amber);
  border: 1px solid #e0c070;
}

.verdict-warn {
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid #e0a8a8;
}

.verdict-icon {
  font-size: 16px;
}

.verdict-text {
  font-size: 13px;
}

.verdict-detail {
  display: flex;
  gap: 20px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.verdict-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vr-label {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.vr-val {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-sub);
}

.verdict-recommend {
  padding: 8px 12px;
  background: var(--accent-light);
  border: 1px solid var(--accent-dim);
  border-radius: 6px;
  font-size: 12px;
}

.vr-hint {
  color: var(--accent);
  font-family: var(--font-mono);
}

/* ── 반응형 ─────────────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .emul-grid {
    grid-template-columns: 1fr;
  }

  .col-name { width: 35%; }
  .result-formula { display: none; }
  .mixed-formula { display: none; }
  .recommend-box { flex-direction: column; align-items: flex-start; }
  .apply-btn { margin-left: 0; }
  .verdict-detail { flex-direction: column; gap: 8px; }
}

@media (max-width: 480px) {
  .oil-table .col-contrib { display: none; }
  .oil-table .col-hlb { width: 20%; }
  .oil-table .col-pct { width: 22%; }
}
</style>
