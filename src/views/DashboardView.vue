<template>
  <div class="dashboard">
    <div class="dash-toolbar">
      <div class="toolbar-left">
        <span class="page-label">Dashboard</span>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-ghost" @click="showAddPanel = !showAddPanel">
          위젯 추가
        </button>
        <button class="btn btn-ghost" @click="onReset">
          기본 배치 복구
        </button>
      </div>
    </div>

    <div v-if="showAddPanel" class="add-panel">
      <div class="add-panel-title">사용 가능한 위젯</div>
      <div class="add-grid">
        <button
          v-for="widget in availableWidgets"
          :key="widget.id"
          class="add-card"
          @click="onAddWidget(widget.id)"
        >
          <div class="add-icon">{{ widget.icon }}</div>
          <div class="add-label">{{ widget.label }}</div>
          <div class="add-desc">{{ widget.description }}</div>
        </button>
      </div>
      <div v-if="!availableWidgets.length" class="add-empty">모든 위젯이 표시 중입니다.</div>
    </div>

    <div class="widget-grid">
      <section
        v-for="item in orderedLayout"
        :key="item.i"
        class="widget-item"
        :class="[`widget-${item.i}`]"
        :style="gridStyle(item)"
      >
        <div class="widget-card">
          <div class="widget-header">
            <span class="widget-title">{{ getWidgetLabel(item.i) }}</span>
            <button class="widget-remove" @click="onRemoveWidget(item.i)" title="위젯 제거">×</button>
          </div>
          <div class="widget-body">
            <component :is="widgetComponents[item.i]" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, ref } from 'vue'
import { useWidgetStore } from '../stores/widgetStore.js'

import WidgetKpi from '../components/widgets/WidgetKpi.vue'
import WidgetRecentFormulas from '../components/widgets/WidgetRecentFormulas.vue'
import WidgetQuickActions from '../components/widgets/WidgetQuickActions.vue'
import WidgetActiveFormulas from '../components/widgets/WidgetActiveFormulas.vue'
import WidgetProjectSummary from '../components/widgets/WidgetProjectSummary.vue'
import WidgetStatusChart from '../components/widgets/WidgetStatusChart.vue'
import WidgetMemo from '../components/widgets/WidgetMemo.vue'
import WidgetStability from '../components/widgets/WidgetStability.vue'
import WidgetRegulation from '../components/widgets/WidgetRegulation.vue'
import WidgetTodayLog from '../components/widgets/WidgetTodayLog.vue'
import WidgetHlb from '../components/widgets/WidgetHlb.vue'

const widgetLabels = {
  kpi: 'KPI 카드',
  recent: '최근 처방',
  quick: '빠른 작업',
  active: '진행 중 처방',
  projects: '프로젝트 요약',
  chart: '상태 차트',
  memo: '메모',
  stability: '안정성',
  regulation: '규제 모니터링',
  todaylog: '오늘의 업무',
  hlb: 'HLB 계산기',
}

const widgetComponents = {
  kpi: markRaw(WidgetKpi),
  recent: markRaw(WidgetRecentFormulas),
  quick: markRaw(WidgetQuickActions),
  active: markRaw(WidgetActiveFormulas),
  projects: markRaw(WidgetProjectSummary),
  chart: markRaw(WidgetStatusChart),
  memo: markRaw(WidgetMemo),
  stability: markRaw(WidgetStability),
  regulation: markRaw(WidgetRegulation),
  todaylog: markRaw(WidgetTodayLog),
  hlb: markRaw(WidgetHlb),
}

const { layout, availableWidgets, addWidget, removeWidget, resetLayout } = useWidgetStore()
const showAddPanel = ref(false)

const orderedLayout = computed(() =>
  [...layout.value].sort((a, b) => (a.y - b.y) || (a.x - b.x))
)

function gridStyle(item) {
  return {
    gridColumn: `span ${Math.max(1, Math.min(12, item.w || 1))}`,
    minHeight: `${Math.max(160, (item.h || 1) * 40 + 24)}px`,
  }
}

function onAddWidget(id) {
  addWidget(id)
}

function onRemoveWidget(id) {
  removeWidget(id)
}

function onReset() {
  resetLayout()
}

function getWidgetLabel(id) {
  return widgetLabels[id] || id
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dash-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.page-label {
  font-size: 13px;
  font-family: var(--font-mono);
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-dim);
}

.btn {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-sub);
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}

.btn:hover {
  background: var(--bg);
}

.add-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}

.add-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.add-card {
  border: 1px dashed var(--border-mid);
  border-radius: 10px;
  background: transparent;
  padding: 14px;
  text-align: left;
  cursor: pointer;
}

.add-card:hover {
  border-color: var(--accent);
  background: var(--accent-light);
}

.add-icon {
  font-size: 18px;
  margin-bottom: 6px;
}

.add-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.add-desc {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 4px;
}

.add-empty {
  color: var(--text-dim);
  font-size: 12px;
  margin-top: 10px;
}

.widget-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 14px;
}

.widget-item {
  min-width: 0;
}

.widget-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.widget-title {
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-dim);
}

.widget-remove {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: var(--red-bg);
  color: var(--red);
  cursor: pointer;
}

.widget-body {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

@media (max-width: 1100px) {
  .widget-item {
    grid-column: span 6 !important;
  }
}

@media (max-width: 700px) {
  .dash-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .widget-item {
    grid-column: span 12 !important;
  }
}
</style>
