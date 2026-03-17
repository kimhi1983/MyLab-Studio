<template>
  <div class="dashboard">
    <div class="dash-toolbar">
      <div class="toolbar-left">
        <span class="page-label">Dashboard</span>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-ghost" :class="{ active: showAddPanel }" @click="showAddPanel = !showAddPanel">
          위젯 설정
        </button>
        <button class="btn btn-ghost" @click="onReset">
          기본 배치 복구
        </button>
      </div>
    </div>

    <div v-if="showAddPanel" class="add-panel">
      <div class="add-panel-header">
        <div class="add-panel-title">위젯 설정</div>
        <div class="add-panel-summary">{{ activeWidgetIds.length }} / {{ WIDGET_CATALOG.length }} 활성화</div>
      </div>
      <div class="add-grid">
        <button
          v-for="widget in WIDGET_CATALOG"
          :key="widget.id"
          class="add-card"
          :class="{ active: activeWidgetIds.includes(widget.id) }"
          @click="onToggleWidget(widget.id)"
        >
          <div class="add-icon">{{ widget.icon }}</div>
          <div class="add-label">{{ widget.label }}</div>
          <div class="add-desc">{{ widget.description }}</div>
          <div class="add-toggle">
            <span class="toggle-dot" :class="{ on: activeWidgetIds.includes(widget.id) }"></span>
            <span class="toggle-text">{{ activeWidgetIds.includes(widget.id) ? 'ON' : 'OFF' }}</span>
          </div>
        </button>
      </div>
    </div>

    <GridLayout
      v-if="mounted"
      v-model:layout="localLayout"
      :col-num="12"
      :row-height="40"
      :is-draggable="true"
      :is-resizable="true"
      :margin="[14, 14]"
      :use-css-transforms="true"
      @layout-updated="onLayoutUpdated"
    >
      <GridItem
        v-for="item in localLayout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        :min-w="getMinW(item.i)"
        :min-h="getMinH(item.i)"
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
      </GridItem>
    </GridLayout>
  </div>
</template>

<script setup>
import { markRaw, ref, watch, onMounted } from 'vue'
import { GridLayout, GridItem } from 'grid-layout-plus'
import { useWidgetStore, WIDGET_CATALOG } from '../stores/widgetStore.js'

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

const { layout, activeWidgetIds, addWidget, removeWidget, resetLayout, saveLayout } = useWidgetStore()
const showAddPanel = ref(false)
const mounted = ref(false)
const localLayout = ref(layout.value.map((item) => ({ ...item })))

onMounted(() => { mounted.value = true })

// 스토어 외부 변경(추가/제거/리셋) 시 localLayout 동기화
watch(layout, (val) => {
  localLayout.value = val.map((item) => ({ ...item }))
}, { deep: true })

function onLayoutUpdated(newLayout) {
  saveLayout(newLayout)
}

function onToggleWidget(id) {
  if (activeWidgetIds.value.includes(id)) {
    removeWidget(id)
  } else {
    addWidget(id)
  }
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

function getMinW(id) {
  return WIDGET_CATALOG.find((w) => w.id === id)?.minW ?? 2
}

function getMinH(id) {
  return WIDGET_CATALOG.find((w) => w.id === id)?.minH ?? 2
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

.btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

/* 위젯 설정 패널 */
.add-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}

.add-panel-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}

.add-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.add-panel-summary {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.add-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  padding: 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.add-card:hover {
  border-color: var(--accent);
  background: var(--accent-light);
}

.add-card.active {
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

.add-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
}

.toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-mid);
  flex-shrink: 0;
}

.toggle-dot.on {
  background: var(--accent);
}

.toggle-text {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  letter-spacing: 0.5px;
}

.add-card.active .toggle-text {
  color: var(--accent);
}

/* 위젯 카드 */
.widget-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  container-type: inline-size;
  container-name: widget;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  cursor: grab;
}

.widget-header:active {
  cursor: grabbing;
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
  flex-shrink: 0;
}

.widget-body {
  flex: 1;
  overflow: auto;
  padding: 8px;
  min-height: 0;
}

/* 드래그 플레이스홀더 (ghost) 스타일 재정의 */
:deep(.vgl-item--placeholder) {
  background: var(--accent-light) !important;
  border: 1.5px dashed var(--accent) !important;
  border-radius: var(--radius) !important;
  opacity: 0.6 !important;
  z-index: 2 !important;
}

/* 드래그 중인 위젯 */
:deep(.vgl-item--dragging) .widget-card {
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  opacity: 0.85;
}

:deep(.vgl-item--resizing) .widget-card {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

/* 리사이즈 핸들 스타일 */
:deep(.vgl-item__resizer) {
  width: 16px !important;
  height: 16px !important;
  border-right: 2px solid var(--accent) !important;
  border-bottom: 2px solid var(--accent) !important;
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 0 0 var(--radius) 0;
}

:deep(.vgl-item:hover .vgl-item__resizer) {
  opacity: 0.6;
}

:deep(.vgl-item--resizing .vgl-item__resizer) {
  opacity: 1;
}

@media (max-width: 700px) {
  .dash-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

<!-- 전역 컨테이너 쿼리: 위젯 크기에 따라 내부 폰트 자동 조정 -->
<style>
/* widget 컨테이너 기준 폰트 스케일링 */
@container widget (max-width: 280px) {
  .widget-body table,
  .widget-body .mini-table { font-size: 10px; }
  .widget-body td, .widget-body th { padding: 3px 4px; }
  .widget-body .kpi-value { font-size: 18px; }
  .widget-body .kpi-label { font-size: 9px; }
  .widget-body .recent-title { font-size: 11px; }
  .widget-body .timeline-content { font-size: 10px; }
  .widget-body .proj-name { font-size: 11px; }
}

@container widget (min-width: 281px) and (max-width: 480px) {
  .widget-body table,
  .widget-body .mini-table { font-size: 11px; }
  .widget-body td, .widget-body th { padding: 4px 6px; }
  .widget-body .kpi-value { font-size: 22px; }
  .widget-body .kpi-label { font-size: 10px; }
  .widget-body .recent-title { font-size: 12px; }
  .widget-body .timeline-content { font-size: 11px; }
  .widget-body .proj-name { font-size: 12px; }
}

@container widget (min-width: 481px) {
  .widget-body table,
  .widget-body .mini-table { font-size: 12px; }
  .widget-body td, .widget-body th { padding: 5px 8px; }
  .widget-body .kpi-value { font-size: 26px; }
  .widget-body .kpi-label { font-size: 11px; }
  .widget-body .recent-title { font-size: 13px; }
  .widget-body .timeline-content { font-size: 12px; }
  .widget-body .proj-name { font-size: 13px; }
}
</style>
