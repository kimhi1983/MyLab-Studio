<template>
  <div class="dashboard">
    <div class="dash-toolbar">
      <div class="toolbar-left">
        <span class="page-label">Dashboard</span>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-ghost" :class="{ active: showAddPanel }" @click="togglePanel">
          위젯 설정
        </button>
        <button class="btn btn-ghost" @click="onReset">
          기본 배치 복구
        </button>
      </div>
    </div>

    <!-- 위젯 설정 패널 -->
    <div v-if="showAddPanel" class="add-panel">
      <div class="add-panel-header">
        <div class="add-panel-title">위젯 설정</div>
        <div class="add-panel-summary">{{ sortedLayout.length }} / {{ WIDGET_CATALOG.length }} 활성화</div>
      </div>

      <!-- 활성 위젯: 드래그 순서 변경 + 크기 조절 -->
      <div class="section-label">활성 위젯 <span class="hint">드래그로 순서 변경</span></div>
      <div ref="sortableRef" class="sortable-list">
        <div
          v-for="item in sortedLayout"
          :key="item.i"
          :data-id="item.i"
          class="sortable-item"
        >
          <span class="drag-handle">⠿</span>
          <span class="item-name">{{ getWidgetLabel(item.i) }}</span>
          <div class="size-btns">
            <button
              v-for="s in SIZES"
              :key="s.w"
              class="size-btn"
              :class="{ active: item.w === s.w }"
              @click="setSize(item.i, s.w)"
            >{{ s.label }}</button>
          </div>
          <button class="remove-btn" @click="onRemoveWidget(item.i)">×</button>
        </div>
      </div>

      <!-- 비활성 위젯: 추가 -->
      <div v-if="inactiveWidgets.length" class="section-label" style="margin-top:16px">
        비활성 위젯 <span class="hint">클릭으로 추가</span>
      </div>
      <div v-if="inactiveWidgets.length" class="add-grid">
        <button
          v-for="widget in inactiveWidgets"
          :key="widget.id"
          class="add-card"
          @click="onAddWidget(widget.id)"
        >
          <div class="add-icon">{{ widget.icon }}</div>
          <div class="add-label">{{ widget.label }}</div>
          <div class="add-desc">{{ widget.description }}</div>
        </button>
      </div>
    </div>

    <!-- CSS Grid 위젯 레이아웃 -->
    <div class="widget-grid">
      <div
        v-for="item in sortedLayout"
        :key="item.i"
        class="widget-card"
        :style="getWidgetStyle(item)"
      >
        <div class="widget-header">
          <span class="widget-title">{{ getWidgetLabel(item.i) }}</span>
          <button class="widget-remove hidden-remove" @click="onRemoveWidget(item.i)" title="위젯 제거">×</button>
        </div>
        <div class="widget-body">
          <component :is="widgetComponents[item.i]" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { markRaw, ref, computed, watch, nextTick } from 'vue'
import Sortable from 'sortablejs'
import { useWidgetStore, WIDGET_CATALOG } from '../stores/widgetStore.js'

import WidgetKpi from '../components/widgets/WidgetKpi.vue'
import WidgetRecentFormulas from '../components/widgets/WidgetRecentFormulas.vue'
import WidgetQuickActions from '../components/widgets/WidgetQuickActions.vue'
import WidgetActiveFormulas from '../components/widgets/WidgetActiveFormulas.vue'
import WidgetProjectSummary from '../components/widgets/WidgetProjectSummary.vue'
import WidgetStatusChart from '../components/widgets/WidgetStatusChart.vue'
import WidgetMemo from '../components/widgets/WidgetMemo.vue'
import WidgetStability from '../components/widgets/WidgetStability.vue'
import WidgetTodayLog from '../components/widgets/WidgetTodayLog.vue'
import WidgetHlb from '../components/widgets/WidgetHlb.vue'

const SIZES = [
  { label: '1/4', w: 3 },
  { label: '2/4', w: 6 },
  { label: '3/4', w: 9 },
  { label: '전체', w: 12 },
]

const widgetLabels = {
  kpi: 'KPI 카드', recent: '최근 처방', quick: '빠른 작업',
  active: '진행 중 처방', projects: '프로젝트 요약', chart: '상태 차트',
  memo: '메모', stability: '안정성',
  todaylog: '오늘의 업무', hlb: 'HLB 계산기',
}

const widgetComponents = {
  kpi: markRaw(WidgetKpi), recent: markRaw(WidgetRecentFormulas),
  quick: markRaw(WidgetQuickActions), active: markRaw(WidgetActiveFormulas),
  projects: markRaw(WidgetProjectSummary), chart: markRaw(WidgetStatusChart),
  memo: markRaw(WidgetMemo), stability: markRaw(WidgetStability),
  todaylog: markRaw(WidgetTodayLog),
  hlb: markRaw(WidgetHlb),
}

const { layout, addWidget, removeWidget, resetLayout, saveLayout } = useWidgetStore()
const showAddPanel = ref(false)
const sortableRef = ref(null)
let sortableInstance = null

const sortedLayout = computed(() =>
  [...layout.value].sort((a, b) => a.y - b.y || a.x - b.x)
)

const inactiveWidgets = computed(() => {
  const activeIds = sortedLayout.value.map(i => i.i)
  return WIDGET_CATALOG.filter(w => !activeIds.includes(w.id))
})

function getWidgetStyle(item) {
  return {
    gridColumn: `span ${item.w}`,
    minHeight: `${item.h * 44}px`,
  }
}

function getWidgetLabel(id) {
  return widgetLabels[id] || id
}

// 패널 열기/닫기 — SortableJS 초기화
async function togglePanel() {
  showAddPanel.value = !showAddPanel.value
  if (showAddPanel.value) {
    await nextTick()
    initSortable()
  } else {
    sortableInstance?.destroy()
    sortableInstance = null
  }
}

function initSortable() {
  if (!sortableRef.value) return
  sortableInstance?.destroy()
  sortableInstance = Sortable.create(sortableRef.value, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd(evt) {
      if (evt.oldIndex === evt.newIndex) return
      const current = [...sortedLayout.value]
      const [moved] = current.splice(evt.oldIndex, 1)
      current.splice(evt.newIndex, 0, moved)
      // y 값을 순서 기반으로 재계산하여 저장
      const updated = current.map((item, idx) => ({ ...item, y: idx, x: 0 }))
      saveLayout(updated)
    },
  })
}

// 비활성 위젯이 추가될 때 SortableJS 재초기화
watch(sortedLayout, async () => {
  if (showAddPanel.value) {
    await nextTick()
    initSortable()
  }
})

function setSize(id, w) {
  const updated = layout.value.map(item =>
    item.i === id ? { ...item, w } : item
  )
  saveLayout(updated)
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

.toolbar-right { display: flex; gap: 8px; flex-wrap: wrap; }

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
.btn:hover { background: var(--bg); }
.btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }

/* 설정 패널 */
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
.add-panel-title { font-size: 14px; font-weight: 600; color: var(--text); }
.add-panel-summary { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.hint {
  font-size: 10px;
  font-weight: 400;
  color: var(--text-dim);
  text-transform: none;
  letter-spacing: 0;
  margin-left: 6px;
}

/* 정렬 가능한 위젯 리스트 */
.sortable-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sortable-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: box-shadow 0.15s;
}

.sortable-item:hover { border-color: var(--border-mid); }

.drag-handle {
  font-size: 16px;
  color: var(--text-dim);
  cursor: grab;
  flex-shrink: 0;
  user-select: none;
  line-height: 1;
}
.drag-handle:active { cursor: grabbing; }

.item-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  flex: 1;
  min-width: 80px;
}

.size-btns {
  display: flex;
  gap: 4px;
}

.size-btn {
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface);
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.1s;
}
.size-btn:hover { border-color: var(--accent); color: var(--accent); }
.size-btn.active { border-color: var(--accent); background: var(--accent-light); color: var(--accent); font-weight: 600; }

.remove-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: var(--red-bg);
  color: var(--red);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 14px;
}

/* 드래그 중 ghost */
:global(.sortable-ghost) {
  opacity: 0.4;
  background: var(--accent-light) !important;
  border-color: var(--accent) !important;
}

/* 비활성 위젯 추가 그리드 */
.add-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.add-card {
  border: 1px dashed var(--border);
  border-radius: 10px;
  background: var(--bg);
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.add-card:hover { border-color: var(--accent); background: var(--accent-light); border-style: solid; }

.add-icon { font-size: 16px; margin-bottom: 4px; }
.add-label { font-size: 12px; font-weight: 600; color: var(--text); }
.add-desc { font-size: 10px; color: var(--text-dim); margin-top: 2px; }

/* CSS Grid 레이아웃 */
.widget-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 14px;
}

.widget-card {
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

.hidden-remove {
  opacity: 0;
  transition: opacity 0.15s;
}
.widget-card:hover .hidden-remove { opacity: 1; }

.widget-body {
  flex: 1;
  overflow: auto;
  padding: 8px;
  min-height: 0;
}

@media (max-width: 900px) {
  .widget-grid { grid-template-columns: repeat(6, 1fr); }
  .sortable-item { flex-wrap: wrap; }
}

@media (max-width: 600px) {
  .widget-grid { grid-template-columns: 1fr; }
  .widget-card { grid-column: span 1 !important; }
  .dash-toolbar { flex-direction: column; align-items: stretch; }
}
</style>

<style>
@container widget (max-width: 280px) {
  .widget-body table, .widget-body .mini-table { font-size: 10px; }
  .widget-body td, .widget-body th { padding: 3px 4px; }
  .widget-body .kpi-value { font-size: 18px; }
  .widget-body .kpi-label { font-size: 9px; }
  .widget-body .recent-title { font-size: 11px; }
  .widget-body .timeline-content { font-size: 10px; }
  .widget-body .proj-name { font-size: 11px; }
}
@container widget (min-width: 281px) and (max-width: 480px) {
  .widget-body table, .widget-body .mini-table { font-size: 11px; }
  .widget-body td, .widget-body th { padding: 4px 6px; }
  .widget-body .kpi-value { font-size: 22px; }
  .widget-body .kpi-label { font-size: 10px; }
  .widget-body .recent-title { font-size: 12px; }
  .widget-body .timeline-content { font-size: 11px; }
  .widget-body .proj-name { font-size: 12px; }
}
@container widget (min-width: 481px) {
  .widget-body table, .widget-body .mini-table { font-size: 12px; }
  .widget-body td, .widget-body th { padding: 5px 8px; }
  .widget-body .kpi-value { font-size: 26px; }
  .widget-body .kpi-label { font-size: 11px; }
  .widget-body .recent-title { font-size: 13px; }
  .widget-body .timeline-content { font-size: 12px; }
  .widget-body .proj-name { font-size: 13px; }
}
</style>
