<template>
  <div class="hlb-widget">
    <!-- 미니 계산 영역 -->
    <div class="widget-calc">
      <div class="calc-row">
        <span class="calc-label">Required HLB</span>
        <span class="calc-val accent">{{ requiredHLB.toFixed(2) }}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">혼합 HLB</span>
        <span class="calc-val blue">{{ mixedHLB.toFixed(2) }}</span>
      </div>
      <div class="calc-row">
        <span class="calc-label">차이</span>
        <span class="calc-val" :class="diffClass">{{ hlbDiff.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 판정 표시 -->
    <div class="verdict-row" :class="verdictBgClass">
      <span class="verdict-dot" :class="dotClass">●</span>
      <span class="verdict-text" :class="verdictTextClass">{{ verdictText }}</span>
    </div>

    <!-- 빠른 입력 (슬라이더) -->
    <div class="quick-slider">
      <div class="slider-labels">
        <span class="sl-a">A {{ ratioA }}%</span>
        <span class="sl-b">B {{ 100 - ratioA }}%</span>
      </div>
      <input
        v-model.number="ratioA"
        type="range"
        min="0"
        max="100"
        step="1"
        class="mini-slider"
      />
    </div>

    <!-- 열기 버튼 -->
    <router-link to="/hlb-calc" class="open-btn">
      HLB 계산기 열기 →
    </router-link>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// 기본값으로 초기화된 간단한 상태 (위젯 전용)
const ratioA = ref(40)

// 고정 예시값 (미네랄오일 + 시어버터 기준 Required HLB)
const requiredHLB = computed(() => 9.83)

// Polysorbate 60 (14.9) + Span 60 (4.7)
const HLB_A = 14.9
const HLB_B = 4.7

const mixedHLB = computed(() => (HLB_A * ratioA.value + HLB_B * (100 - ratioA.value)) / 100)

const hlbDiff = computed(() => Math.abs(mixedHLB.value - requiredHLB.value))

const verdictLevel = computed(() => {
  if (hlbDiff.value <= 0.5) return 'pass'
  if (hlbDiff.value <= 1.0) return 'ok'
  return 'warn'
})

const verdictText = computed(() => {
  if (verdictLevel.value === 'pass') return 'PASS — 안정'
  if (verdictLevel.value === 'ok') return 'OK — 허용'
  return '주의 — 불안정'
})

const diffClass = computed(() => {
  if (verdictLevel.value === 'pass') return 'green'
  if (verdictLevel.value === 'ok') return 'amber'
  return 'red'
})

const dotClass = computed(() => diffClass.value)

const verdictBgClass = computed(() => `verdict-${verdictLevel.value}`)

const verdictTextClass = computed(() => diffClass.value)
</script>

<style scoped>
.hlb-widget {
  display: flex;
  flex-direction: column;
  gap: clamp(5px, 1.5cqi, 10px);
  height: 100%;
}

/* ── 계산 요약 ──────────────────────────────────────────────────────── */
.widget-calc {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: clamp(6px, 1.5cqi, 10px);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 7px;
}

.calc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calc-label {
  font-size: clamp(9px, 2.2cqi, 11px);
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.calc-val {
  font-size: clamp(11px, 2.8cqi, 14px);
  font-weight: 700;
  font-family: var(--font-mono);
}

.calc-val.accent { color: var(--accent); }
.calc-val.blue { color: var(--blue); }
.calc-val.green { color: var(--green); }
.calc-val.amber { color: var(--amber); }
.calc-val.red { color: var(--red); }

/* ── 판정 ───────────────────────────────────────────────────────────── */
.verdict-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: clamp(4px, 1.2cqi, 7px) clamp(6px, 1.5cqi, 10px);
  border-radius: 5px;
  border: 1px solid transparent;
}

.verdict-pass {
  background: var(--green-bg);
  border-color: #a8d8c0;
}

.verdict-ok {
  background: var(--amber-bg);
  border-color: #e0c070;
}

.verdict-warn {
  background: var(--red-bg);
  border-color: #e0a8a8;
}

.verdict-dot {
  font-size: clamp(8px, 2cqi, 11px);
  line-height: 1;
}

.verdict-text {
  font-size: clamp(9px, 2.2cqi, 12px);
  font-weight: 700;
}

.verdict-dot.green,
.verdict-text.green { color: var(--green); }
.verdict-dot.amber,
.verdict-text.amber { color: var(--amber); }
.verdict-dot.red,
.verdict-text.red { color: var(--red); }

/* ── 미니 슬라이더 ───────────────────────────────────────────────────── */
.quick-slider {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: clamp(9px, 2cqi, 11px);
  font-family: var(--font-mono);
  font-weight: 600;
}

.sl-a { color: var(--accent); }
.sl-b { color: var(--blue); }

.mini-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 5px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--accent) 0%, var(--accent) v-bind("ratioA + '%'"), var(--blue) v-bind("ratioA + '%'"), var(--blue) 100%);
  outline: none;
  cursor: pointer;
}

.mini-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--accent);
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  cursor: pointer;
}

.mini-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--accent);
  cursor: pointer;
}

/* ── 열기 버튼 ──────────────────────────────────────────────────────── */
.open-btn {
  display: block;
  text-align: center;
  padding: clamp(5px, 1.3cqi, 8px);
  font-size: clamp(10px, 2.4cqi, 12px);
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  border: 1px solid var(--accent-dim);
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s;
  margin-top: auto;
}

.open-btn:hover {
  background: var(--accent);
  color: #fff;
}
</style>
