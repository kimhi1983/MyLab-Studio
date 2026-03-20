<template>
  <div class="beaker-wrap">
    <svg viewBox="0 0 200 230" width="200" height="230" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- 비커 내부 클립 (물이 비커 밖으로 넘치지 않도록) -->
        <clipPath id="beaker-inner-clip">
          <path d="M 44 57 L 44 207 Q 44 214 51 214 L 149 214 Q 156 214 156 207 L 156 57 Z" />
        </clipPath>

        <!-- 물 그라디언트 (골드/베이지 계열) -->
        <linearGradient id="water-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e8d07a" stop-opacity="0.92" />
          <stop offset="100%" stop-color="#b8920a" stop-opacity="0.78" />
        </linearGradient>

        <!-- 물 반짝임 오버레이 -->
        <linearGradient id="water-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.06" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.18" />
        </linearGradient>
      </defs>

      <!-- ─── 물 (비커 내부 클립 적용) ─── -->
      <g clip-path="url(#beaker-inner-clip)">
        <!-- 웨이브 그룹: 세로 위치(transition) + 가로 물결(animation) 분리 -->
        <g class="wave-vert" :style="waveGroupStyle">
          <g class="wave-horiz">
            <!--
              웨이브 경로: x=-80 ~ x=280 (주기 40px)
              y=10 기준 상하 8px 진동, 하단은 y=220 까지 채움
            -->
            <path
              d="M -80 10
                 C -65 2  -55 18  -40 10
                 C -25 2  -15 18    0 10
                 C  15 2   25 18   40 10
                 C  55 2   65 18   80 10
                 C  95 2  105 18  120 10
                 C 135 2  145 18  160 10
                 C 175 2  185 18  200 10
                 C 215 2  225 18  240 10
                 L 240 220 L -80 220 Z"
              fill="url(#water-gradient)"
            />
            <!-- 반짝임 오버레이 -->
            <rect x="-80" y="10" width="320" height="210" fill="url(#water-sheen)" />
          </g>
        </g>

        <!-- ─── 공기방울 ─── -->
        <!-- cx: 비커 내부 좌우(55~148), cy: 하단 근처 -->
        <circle class="bubble b1" cx="72"  cy="208" r="3"   fill="#D4ECFC" />
        <circle class="bubble b2" cx="110" cy="210" r="5"   fill="white"   />
        <circle class="bubble b3" cx="90"  cy="206" r="2"   fill="#D4ECFC" />
        <circle class="bubble b4" cx="133" cy="209" r="4"   fill="white"   />
        <circle class="bubble b5" cx="60"  cy="211" r="3.5" fill="#D4ECFC" />
      </g>

      <!-- ─── 비커 외곽선 (물 위에 그려서 테두리가 선명하게) ─── -->
      <!-- 비커 몸통 양쪽 + 둥근 바닥 -->
      <path
        d="M 44 57 L 44 207 Q 44 214 51 214 L 149 214 Q 156 214 156 207 L 156 57"
        stroke="var(--accent, #c4a030)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- 상단 림 -->
      <line x1="39" y1="57" x2="161" y2="57"
        stroke="var(--accent, #c4a030)" stroke-width="2.5" stroke-linecap="round" />
      <!-- 주둥이(spout) -->
      <path d="M 39 57 L 27 44 L 39 44"
        fill="none"
        stroke="var(--accent, #c4a030)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- ─── 눈금 마크 (오른쪽, 4단계 = 25/50/75/100%) ─── -->
      <g stroke="var(--accent, #c4a030)" stroke-width="1.5" opacity="0.55">
        <!-- 25% = y≈174, 50% = y≈135, 75% = y≈96, 100% = y≈57 -->
        <line x1="156" y1="174" x2="166" y2="174" />
        <line x1="156" y1="135" x2="166" y2="135" />
        <line x1="156" y1="96"  x2="166" y2="96"  />
      </g>

      <!-- ─── 비커 내부 반사광 (왼쪽 세로선) ─── -->
      <line x1="56" y1="65" x2="56" y2="205"
        stroke="white" stroke-width="2" stroke-opacity="0.18" stroke-linecap="round" />

      <!-- ─── % 텍스트 (물 안에 표시) ─── -->
      <text
        x="100"
        :y="pctTextY"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pct-text"
        :style="pctTextStyle"
      >{{ pct }}%</text>
    </svg>

    <!-- 단계 텍스트 -->
    <div class="step-label">{{ stepLabel }}</div>

    <!-- 진행 점 -->
    <div class="step-dots">
      <span
        v-for="i in 4"
        :key="i"
        class="dot"
        :class="{ active: i <= step, current: i === step }"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  step: { type: Number, default: 1 }, // 1 ~ 4
})

// ── 내부 상수 ──
const INNER_TOP = 57   // 비커 내부 상단 y
const INNER_BOT = 214  // 비커 내부 하단 y
const INNER_H = INNER_BOT - INNER_TOP // 157px

// ── 단계별 값 ──
const pct = computed(() => props.step * 25)

// 물 표면 y 좌표 (step 1=25% → 하단에서 25% 올라온 위치)
const waterY = computed(() =>
  INNER_BOT - (props.step / 4) * INNER_H
)

// 웨이브 그룹 transform: 물 표면보다 10px 위에 위치
const waveGroupStyle = computed(() => ({
  transform: `translateY(${waterY.value - 10}px)`,
  transition: 'transform 0.85s cubic-bezier(0.4, 0, 0.2, 1)',
}))

// % 텍스트 y: 물 중앙
const pctTextY = computed(() => {
  const mid = waterY.value + (INNER_BOT - waterY.value) / 2
  return Math.round(mid)
})

const pctTextStyle = computed(() => ({
  transition: 'y 0.85s ease',
  opacity: props.step >= 1 ? 1 : 0,
}))

// 단계 레이블
const LABELS = ['성분 분석 중', '배합비 계산 중', '처방 설계 중', '최종 검증 중']
const stepLabel = computed(() => LABELS[props.step - 1] ?? '')
</script>

<style scoped>
.beaker-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 200px;
  user-select: none;
}

/* ─── 웨이브 애니메이션 ─── */
/* 세로 위치는 Vue style binding (transition)으로 처리 */
.wave-vert {
  /* Vue :style 에서 transform + transition 담당 */
}

/* 가로 물결 애니메이션 */
.wave-horiz {
  animation: wave-move 2.2s linear infinite;
}

@keyframes wave-move {
  from { transform: translateX(0); }
  to   { transform: translateX(-40px); }
}

/* ─── 공기방울 ─── */
.bubble {
  opacity: 0;
  animation: bubble-rise linear infinite;
}

@keyframes bubble-rise {
  0%   { transform: translateY(0);      opacity: 0;   }
  10%  { opacity: 0.5; }
  80%  { opacity: 0.35; }
  100% { transform: translateY(-165px); opacity: 0;   }
}

.b1 { animation-duration: 2.2s; animation-delay: 0s;    opacity: 0; }
.b2 { animation-duration: 2.8s; animation-delay: 0.7s;  opacity: 0; }
.b3 { animation-duration: 1.7s; animation-delay: 1.3s;  opacity: 0; }
.b4 { animation-duration: 3.0s; animation-delay: 0.3s;  opacity: 0; }
.b5 { animation-duration: 2.4s; animation-delay: 1.8s;  opacity: 0; }

/* ─── % 텍스트 ─── */
.pct-text {
  font-size: 26px;
  font-weight: 800;
  font-family: var(--font-mono, 'Courier New', monospace);
  fill: #7a5810;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 4px;
}

/* ─── 단계 텍스트 ─── */
.step-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub, #8a7050);
  letter-spacing: 0.2px;
  min-height: 18px;
  transition: opacity 0.4s;
}

/* ─── 진행 점 ─── */
.step-dots {
  display: flex;
  gap: 7px;
  margin-top: 2px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border, #ddd);
  transition: background 0.35s, transform 0.35s;
}

.dot.active {
  background: var(--accent, #c4a030);
}

.dot.current {
  transform: scale(1.4);
}
</style>
