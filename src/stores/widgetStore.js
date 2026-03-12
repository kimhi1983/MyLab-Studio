import { computed } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage.js'

// 그리드 설정 상수
export const GRID_COL_NUM = 12
export const GRID_ROW_HEIGHT = 40

// 사용 가능한 위젯 목록 (카탈로그) — 12컬럼 기준
export const WIDGET_CATALOG = [
  { id: 'kpi', label: 'KPI 카드', icon: '⚗', description: '진행중 처방, 완료, 안정성, 규제 현황', minW: 4, minH: 3, defaultW: 8, defaultH: 3 },
  { id: 'recent', label: '최근 처방', icon: '◉', description: '최근 수정된 처방 목록', minW: 3, minH: 3, defaultW: 4, defaultH: 5 },
  { id: 'quick', label: '빠른 작업', icon: '✦', description: 'MyLab 가이드, 새 처방 등 빠른 액션', minW: 3, minH: 3, defaultW: 4, defaultH: 5 },
  { id: 'active', label: '진행중 처방', icon: '◎', description: '현재 진행 중인 처방 테이블', minW: 4, minH: 3, defaultW: 8, defaultH: 5 },
  { id: 'projects', label: '프로젝트 요약', icon: '◈', description: '프로젝트별 진행률 요약', minW: 3, minH: 3, defaultW: 6, defaultH: 5 },
  { id: 'chart', label: '상태 차트', icon: '◐', description: '처방 상태별 도넛 차트', minW: 3, minH: 3, defaultW: 4, defaultH: 3 },
  { id: 'memo', label: '메모장', icon: '✎', description: '자유 메모 (자동 저장)', minW: 3, minH: 3, defaultW: 4, defaultH: 4 },
  { id: 'stability', label: '안정성 현황', icon: '⏱', description: '처방별 안정성 테스트 현황', minW: 4, minH: 4, defaultW: 6, defaultH: 5 },
  { id: 'regulation', label: '규제 모니터링', icon: '⚠', description: '지역별 성분 규제 현황', minW: 4, minH: 4, defaultW: 6, defaultH: 5 },
  { id: 'todaylog', label: '오늘의 업무', icon: '◉', description: '오늘 진행한 업무 타임라인', minW: 4, minH: 4, defaultW: 6, defaultH: 5 },
  { id: 'hlb', label: 'HLB 계산기', icon: '⚖', description: '오일/유화제 HLB 빠른 계산 및 판정', minW: 3, minH: 4, defaultW: 4, defaultH: 5 },
]

// 기본 레이아웃 (첫 방문 시) — 12컬럼, 11개 위젯 전체 표시
const DEFAULT_LAYOUT = [
  // Row 0: 핵심 지표
  { x: 0, y: 0,  w: 8,  h: 3,  i: 'kpi' },        // KPI 카드 (상단 넓게)
  { x: 8, y: 0,  w: 4,  h: 3,  i: 'chart' },       // 상태 차트 (우상단)
  // Row 3: 업무 + 진행현황 + 빠른작업
  { x: 0, y: 3,  w: 5,  h: 5,  i: 'active' },      // 진행중 처방
  { x: 5, y: 3,  w: 4,  h: 5,  i: 'todaylog' },    // 오늘의 업무
  { x: 9, y: 3,  w: 3,  h: 5,  i: 'quick' },       // 빠른 작업
  // Row 8: 안정성 + 규제
  { x: 0, y: 8,  w: 6,  h: 5,  i: 'stability' },   // 안정성 현황
  { x: 6, y: 8,  w: 6,  h: 5,  i: 'regulation' },  // 규제 모니터링
  // Row 13: 최근처방 + 프로젝트 + HLB
  { x: 0, y: 13, w: 4,  h: 5,  i: 'recent' },      // 최근 처방
  { x: 4, y: 13, w: 4,  h: 5,  i: 'projects' },    // 프로젝트 요약
  { x: 8, y: 13, w: 4,  h: 5,  i: 'hlb' },         // HLB 계산기
  // Row 18: 메모
  { x: 0, y: 18, w: 12, h: 3,  i: 'memo' },        // 메모장 (전체 폭)
]

// v3: 11개 위젯 전체 표시 레이아웃 (이전 v2는 8개만 표시)
const savedLayout = useLocalStorage('mylab:dashboard-layout-v3', null)

export function useWidgetStore() {
  // 현재 레이아웃
  const layout = computed({
    get: () => savedLayout.value || JSON.parse(JSON.stringify(DEFAULT_LAYOUT)),
    set: (val) => { savedLayout.value = val },
  })

  // 현재 활성 위젯 ID 목록
  const activeWidgetIds = computed(() => layout.value.map(item => item.i))

  // 추가 가능한 위젯 (현재 레이아웃에 없는 것)
  const availableWidgets = computed(() =>
    WIDGET_CATALOG.filter(w => !activeWidgetIds.value.includes(w.id))
  )

  // 레이아웃 저장
  function saveLayout(newLayout) {
    savedLayout.value = newLayout.map(item => ({
      x: item.x, y: item.y, w: item.w, h: item.h, i: item.i,
    }))
  }

  // 위젯 추가
  function addWidget(widgetId) {
    const catalog = WIDGET_CATALOG.find(w => w.id === widgetId)
    if (!catalog || activeWidgetIds.value.includes(widgetId)) return

    // 빈 위치 찾기: 가장 아래에 추가
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

  // 위젯 제거
  function removeWidget(widgetId) {
    savedLayout.value = layout.value.filter(item => item.i !== widgetId)
  }

  // 기본 레이아웃으로 복원
  function resetLayout() {
    savedLayout.value = JSON.parse(JSON.stringify(DEFAULT_LAYOUT))
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
