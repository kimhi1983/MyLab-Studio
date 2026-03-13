<template>
  <div class="regulation-widget">
    <!-- 지역 필터 탭 -->
    <div class="region-tabs">
      <button
        v-for="tab in regionTabs"
        :key="tab.value"
        class="region-tab"
        :class="{ active: selectedSource === tab.value }"
        @click="selectedSource = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 규제 리스트 -->
    <div class="reg-list">
      <div v-for="row in filteredData" :key="row.id" class="reg-row">
        <span class="region-chip" :class="getRegionClass(row.region)">{{ row.region }}</span>
        <div class="reg-info">
          <span class="reg-name">{{ row.ingredient }}</span>
          <span class="reg-limit">{{ row.limit || '-' }}</span>
        </div>
        <span class="status-chip" :class="getStatusClass(row.status)">
          {{ getStatusLabel(row.status) }}
        </span>
      </div>
    </div>

    <div v-if="!filteredData.length" class="empty">
      해당 지역의 규제 데이터가 없습니다
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useIngredientStore } from '../../stores/ingredientStore.js'
import { mapRegulationSource, isVisibleSource, HIDDEN_SOURCES } from '../../utils/regulationSource.js'

const store = useIngredientStore()
const selectedSource = ref('ALL')
const regulations = ref([])
const totalCount = ref(0)
const sources = ref([])


const regionTabs = computed(() => {
  const tabs = [{ value: 'ALL', label: '전체' }]
  for (const s of sources.value) {
    if (!isVisibleSource(s.source)) continue
    const label = mapRegulationSource(s.source)
    if (label === '기타') continue
    if (!tabs.find(t => t.label === label)) {
      tabs.push({ value: s.source, label, count: s.count })
    }
  }
  return tabs
})

const filteredData = computed(() => regulations.value)

onMounted(async () => {
  await store.init()
  sources.value = store.regulationSources.value || []
  await loadData()
})

async function loadData() {
  const source = selectedSource.value === 'ALL' ? undefined : selectedSource.value
  const data = await store.searchRegulations({ source, limit: 50 })
  if (data) {
    regulations.value = data.items
      .filter(r => (r.ingredient || r.inci_name) && isVisibleSource(r.source))
      .slice(0, 20)
      .map((r, i) => ({
        id: i,
        region: mapRegulationSource(r.source),
        ingredient: r.ingredient || r.inci_name,
        status: getRegulationStatus(r),
        limit: r.max_concentration || '-',
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 7) : '-',
      }))
    totalCount.value = data.total
  }
}


watch(selectedSource, loadData)

function getRegulationStatus(r) {
  const restriction = (r.restriction || '').toLowerCase()
  const maxConc = (r.max_concentration || '').toLowerCase()
  if (restriction.includes('금지') || restriction.includes('ban')) return 'ban'
  if (maxConc && maxConc !== '-') return 'limit'
  return 'monitor'
}

function getRegionClass(region) {
  if (region === '한국') return 'region-kr'
  if (region === '유럽') return 'region-eu'
  if (region === '미국') return 'region-us'
  if (region === '일본') return 'region-jp'
  if (region === '중국') return 'region-cn'
  if (region === '아세안') return 'region-asean'
  if (region === '안전성') return 'region-safety'
  return ''
}

function getStatusClass(status) {
  if (status === 'limit') return 'chip-amber'
  if (status === 'ban') return 'chip-red'
  if (status === 'monitor') return 'chip-purple'
  return ''
}

function getStatusLabel(status) {
  if (status === 'limit') return '제한'
  if (status === 'ban') return '금지'
  if (status === 'monitor') return '모니터링'
  return status
}
</script>

<style scoped>
.regulation-widget {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  overflow: hidden;
}

/* 지역 필터 탭 */
.region-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.region-tab {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
}

.region-tab:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.region-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* 규제 리스트 */
.reg-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 4px;
  transition: background 0.1s;
}

.reg-row:hover {
  background: var(--bg);
}

/* 지역 칩 */
.region-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 20px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  font-family: var(--font-mono);
  flex-shrink: 0;
  letter-spacing: 0.3px;
}

.region-kr {
  background: rgba(58, 111, 168, 0.15);
  color: var(--blue);
}

.region-eu {
  background: rgba(124, 92, 191, 0.15);
  color: var(--purple);
}

.region-us {
  background: rgba(58, 144, 104, 0.15);
  color: var(--green);
}

.region-jp {
  background: rgba(196, 78, 78, 0.12);
  color: #c44e4e;
}

.region-cn {
  background: rgba(196, 130, 50, 0.15);
  color: #c48232;
}

.region-asean {
  background: rgba(58, 144, 104, 0.15);
  color: var(--green);
}

.region-safety {
  background: rgba(184, 147, 90, 0.15);
  color: var(--amber);
  width: 38px;
}

/* 성분 정보 */
.reg-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.reg-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reg-limit {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 상태 칩 */
.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
  letter-spacing: 0.3px;
}

.chip-amber {
  background: rgba(184, 147, 90, 0.15);
  color: var(--amber);
}

.chip-red {
  background: rgba(196, 78, 78, 0.15);
  color: var(--red);
}

.chip-purple {
  background: rgba(124, 92, 191, 0.15);
  color: var(--purple);
}

.empty {
  text-align: center;
  color: var(--text-dim);
  font-size: 11px;
  padding: 16px;
}
</style>
