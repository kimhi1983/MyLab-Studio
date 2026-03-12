<template>
  <div class="kpi-widget">
    <div class="kpi-grid">
      <div class="kpi-item" v-for="kpi in kpis" :key="kpi.label">
        <div class="kpi-top">
          <span class="kpi-label">{{ kpi.label }}</span>
          <span class="kpi-icon" :style="{ background: kpi.iconBg, color: kpi.iconColor }">{{ kpi.icon }}</span>
        </div>
        <div class="kpi-value" :style="{ color: kpi.iconColor }">
          {{ kpi.value }} <span class="kpi-unit">{{ kpi.unit }}</span>
        </div>
        <div class="kpi-sub">{{ kpi.sub }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useFormulaStore } from '../../stores/formulaStore.js'
import { useIngredientStore } from '../../stores/ingredientStore.js'

const { draftCount, reviewCount, doneCount, formulas } = useFormulaStore()
const store = useIngredientStore()

onMounted(() => store.init())

// 진행중 처방 (draft + review 합계)
const activeCount = computed(() => draftCount.value + reviewCount.value)

// DB 원료 수 (ingredient_master)
const dbIngredients = computed(() => store.stats.value?.totalIngredients || 0)

// DB 규제 수
const dbRegulations = computed(() => store.stats.value?.totalRegulations || 0)

// DB 지식 베이스 수
const dbKnowledge = computed(() => store.stats.value?.totalKnowledge || 0)

// DB 제품 수
const dbProducts = computed(() => store.stats.value?.totalProducts || 0)

// DB 복합성분 수
const dbCompounds = computed(() => store.stats.value?.totalCompounds || 0)

// 규제 소스 요약
const regSources = computed(() => {
  const sources = store.stats.value?.regulationsBySource || []
  return sources.map(s => s.source).join('/')
})

// 숫자 포맷 (천 단위 콤마)
function fmtNum(n) {
  return n >= 1000 ? n.toLocaleString('ko-KR') : String(n)
}

const kpis = computed(() => [
  {
    label: 'DB 원료',
    value: fmtNum(dbIngredients.value),
    unit: '종',
    icon: '◎',
    iconColor: '#b8935a',
    iconBg: '#f0e8d8',
    sub: `복합원료 ${dbCompounds.value}종 포함`,
  },
  {
    label: '규제 정보',
    value: fmtNum(dbRegulations.value),
    unit: '건',
    icon: '⚠',
    iconColor: '#7c5cbf',
    iconBg: '#f4f0fb',
    sub: regSources.value || 'KR/EU 규제 스캔',
  },
  {
    label: '진행중 처방',
    value: activeCount.value,
    unit: '건',
    icon: '✓',
    iconColor: '#3a9068',
    iconBg: '#f0f8f4',
    sub: `초안 ${draftCount.value} · 검토 ${reviewCount.value}`,
  },
  {
    label: '참조 제품',
    value: fmtNum(dbProducts.value),
    unit: '종',
    icon: '◈',
    iconColor: '#3a6fa8',
    iconBg: '#f0f4fb',
    sub: `지식베이스 ${dbKnowledge.value}건`,
  },
])
</script>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  height: 100%;
}
.kpi-item {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  min-height: 0;
}
.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.kpi-label {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  color: var(--text-dim);
  letter-spacing: 0.6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kpi-icon {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}
.kpi-value {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.1;
}
.kpi-unit {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
  margin-left: 2px;
}
.kpi-sub {
  display: none;
}

/* 좁은 위젯: 1열, 더 작은 폰트 */
@container widget (max-width: 280px) {
  .kpi-grid { grid-template-columns: 1fr; gap: 6px; }
  .kpi-item { padding: 8px 10px; }
  .kpi-value { font-size: 11px; }
  .kpi-icon { width: 18px; height: 18px; font-size: 10px; }
}
/* 넓은 위젯: 4열 */
@container widget (min-width: 600px) {
  .kpi-grid { grid-template-columns: repeat(4, 1fr); }
  .kpi-value { font-size: 14px; }
  .kpi-icon { width: 26px; height: 26px; font-size: 14px; }
}
</style>
