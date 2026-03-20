import { computed } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage.js'
import { getSettings, saveSettings } from '../lib/userDataApi.js'

export const GRID_COL_NUM = 12
export const GRID_ROW_HEIGHT = 40

export const WIDGET_CATALOG = [
  { id: 'kpi', label: 'KPI 카드', icon: 'K', description: '처방 현황 요약', minW: 4, minH: 3, defaultW: 8, defaultH: 3 },
  { id: 'recent', label: '최근 처방', icon: 'R', description: '최근 작업한 처방', minW: 3, minH: 3, defaultW: 4, defaultH: 5 },
  { id: 'quick', label: '빠른 작업', icon: 'Q', description: '바로 가기 액션', minW: 3, minH: 3, defaultW: 4, defaultH: 5 },
  { id: 'active', label: '진행 중 처방', icon: 'A', description: '현재 진행 상태', minW: 4, minH: 3, defaultW: 8, defaultH: 5 },
  { id: 'projects', label: '프로젝트 요약', icon: 'P', description: '프로젝트 진행 현황', minW: 3, minH: 3, defaultW: 6, defaultH: 5 },
  { id: 'chart', label: '상태 차트', icon: 'C', description: '처방 상태 분포', minW: 3, minH: 3, defaultW: 4, defaultH: 3 },
  { id: 'memo', label: '메모', icon: 'M', description: '자유 메모', minW: 3, minH: 3, defaultW: 12, defaultH: 3 },
  { id: 'stability', label: '안정성', icon: 'S', description: '안정성 모니터링', minW: 4, minH: 4, defaultW: 6, defaultH: 5 },
  { id: 'todaylog', label: '오늘의 업무', icon: 'T', description: '오늘 진행 내역', minW: 4, minH: 4, defaultW: 6, defaultH: 5 },
  { id: 'hlb', label: 'HLB 계산기', icon: 'H', description: '빠른 HLB 계산', minW: 3, minH: 4, defaultW: 6, defaultH: 5 },
]

const DEFAULT_LAYOUT = [
  { x: 0, y: 0, w: 8, h: 3, i: 'kpi' },
  { x: 8, y: 0, w: 4, h: 3, i: 'chart' },
  { x: 0, y: 3, w: 5, h: 5, i: 'active' },
  { x: 5, y: 3, w: 4, h: 5, i: 'todaylog' },
  { x: 9, y: 3, w: 3, h: 5, i: 'quick' },
  { x: 0, y: 8, w: 6, h: 5, i: 'stability' },
  { x: 6, y: 8, w: 6, h: 5, i: 'recent' },
  { x: 0, y: 20, w: 6, h: 5, i: 'projects' },
  { x: 6, y: 20, w: 6, h: 5, i: 'hlb' },
  { x: 0, y: 25, w: 12, h: 3, i: 'memo' },
]

const savedLayout = useLocalStorage('mylab:dashboard-layout-v4', null)

export async function loadWidgetSettingsFromServer() {
  const settings = await getSettings()
  if (settings?.widget_layout) {
    savedLayout.value = settings.widget_layout
  }
}

if (typeof window !== 'undefined') {
  const url = new URL(window.location.href)
  if (url.searchParams.get('reset-dashboard') === '1') {
    localStorage.removeItem('mylab:dashboard-layout-v4')
    savedLayout.value = null
    url.searchParams.delete('reset-dashboard')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }
}

function cloneDefaultLayout() {
  return DEFAULT_LAYOUT.map((item) => ({ ...item }))
}

function isValidLayoutItem(item) {
  return item &&
    typeof item === 'object' &&
    typeof item.i === 'string' &&
    Number.isFinite(item.x) &&
    Number.isFinite(item.y) &&
    Number.isFinite(item.w) &&
    Number.isFinite(item.h)
}

function sanitizeLayout(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return cloneDefaultLayout()
  }

  const knownIds = new Set(WIDGET_CATALOG.map((widget) => widget.id))
  const seenIds = new Set()

  const cleaned = value
    .filter((item) => isValidLayoutItem(item) && knownIds.has(item.i) && !seenIds.has(item.i))
    .map((item) => {
      seenIds.add(item.i)
      return {
        x: Math.max(0, Number(item.x) || 0),
        y: Math.max(0, Number(item.y) || 0),
        w: Math.min(GRID_COL_NUM, Math.max(1, Number(item.w) || 1)),
        h: Math.max(1, Number(item.h) || 1),
        i: item.i,
      }
    })

  return cleaned.length ? cleaned : cloneDefaultLayout()
}

export function useWidgetStore() {
  const layout = computed({
    get: () => sanitizeLayout(savedLayout.value),
    set: (val) => {
      savedLayout.value = sanitizeLayout(val)
    },
  })

  const activeWidgetIds = computed(() => layout.value.map((item) => item.i))

  const availableWidgets = computed(() =>
    WIDGET_CATALOG.filter((widget) => !activeWidgetIds.value.includes(widget.id))
  )

  function saveLayout(newLayout) {
    savedLayout.value = sanitizeLayout(newLayout)
    saveSettings({ widget_layout: savedLayout.value })
  }

  function addWidget(widgetId) {
    const catalog = WIDGET_CATALOG.find((widget) => widget.id === widgetId)
    if (!catalog || activeWidgetIds.value.includes(widgetId)) return

    const maxY = layout.value.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    const newItem = {
      x: 0,
      y: maxY,
      w: catalog.defaultW,
      h: catalog.defaultH,
      i: widgetId,
    }

    savedLayout.value = [...layout.value, newItem]
  }

  function removeWidget(widgetId) {
    const nextLayout = layout.value.filter((item) => item.i !== widgetId)
    savedLayout.value = nextLayout.length ? nextLayout : cloneDefaultLayout()
  }

  function resetLayout() {
    savedLayout.value = cloneDefaultLayout()
  }

  return {
    layout,
    activeWidgetIds,
    availableWidgets,
    saveLayout,
    addWidget,
    removeWidget,
    resetLayout,
  }
}
