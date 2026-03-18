<template>
  <div class="regulation-widget">
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <!-- ── 헤더: 탭 + 검색 + 통계 뱃지 ── -->
    <div class="reg-header">
      <div class="region-tabs">
        <button
          v-for="tab in regionTabs"
          :key="tab.label"
          :class="['region-tab', { active: selectedRegion === tab.label }]"
          @click="selectedRegion = tab.label"
        >
          {{ tab.label }}
          <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>
      <div class="reg-controls">
        <input
          v-model="searchQ"
          class="search-input"
          placeholder="성분명 검색..."
        />
        <div class="stat-badges">
          <span class="stat-badge badge-ban">금지 {{ stats.ban }}</span>
          <span class="stat-badge badge-limit">제한 {{ stats.limit }}</span>
          <span class="stat-badge badge-monitor">모니터링 {{ stats.monitor }}</span>
        </div>
      </div>
    </div>

    <!-- ── 규제 테이블 ── -->
    <div class="reg-table-wrap">
      <table class="reg-table">
        <thead>
          <tr>
            <th class="col-region">지역</th>
            <th class="col-name">성분명</th>
            <th class="col-restrict">제한 내용</th>
            <th class="col-conc">최대 농도</th>
            <th class="col-status">상태</th>
            <th class="col-date">갱신</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in displayData" :key="row.id">
            <tr
              :class="['reg-row', `row-${row.status}`, { 'row-expanded': expandedId === row.id }]"
              @click="toggleExpand(row.id)"
            >
              <td>
                <span :class="['region-chip', getRegionClass(row.region)]">{{ row.region }}</span>
              </td>
              <td class="td-name">
                {{ row.ingredient }}
                <span v-if="row.ingredient_type" class="type-badge">{{ typeLabel(row.ingredient_type) }}</span>
                <span v-if="row.ewg_score" :class="ewgBadgeClass(row.ewg_score)" class="ewg-badge">
                  EWG {{ row.ewg_score }}
                </span>
              </td>
              <td class="td-restrict">
                <span v-if="row.restrictionShort" class="restrict-text">{{ row.restrictionShort }}</span>
                <span v-else class="restrict-empty">—</span>
              </td>
              <td class="td-conc mono">{{ row.limit || '—' }}</td>
              <td>
                <span :class="['status-chip', getStatusClass(row.status)]">
                  {{ getStatusLabel(row.status) }}
                </span>
              </td>
              <td class="td-date mono">{{ row.updatedAt }}</td>
            </tr>
            <!-- 제한 내용 전문 펼침 -->
            <tr v-if="expandedId === row.id" class="expand-row">
              <td colspan="6" class="expand-cell">
                <div class="expand-content">
                  <span v-if="row.restriction" class="expand-label">규제 내용</span>
                  <span v-if="row.restriction">{{ row.restriction }}</span>
                  <span v-if="row.primary_function" class="expand-fn">
                    <span class="expand-label" style="margin-left:12px">기능</span>{{ row.primary_function }}
                  </span>
                  <span v-if="row.ewg_score != null" :class="['ewg-badge', ewgClass(row.ewg_score)]">
                    EWG {{ row.ewg_score }}
                  </span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="!displayData.length && !loading" class="empty">
      {{ errorMessage ? 'API 서버를 먼저 실행하세요' : (searchQ ? `'${searchQ}' 검색 결과가 없습니다` : '해당 지역의 규제 데이터가 없습니다') }}
    </div>
    <div v-if="loading" class="empty">불러오는 중...</div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIngredientStore } from '../../stores/ingredientStore.js'
import { mapRegulationSource, isVisibleSource } from '../../utils/regulationSource.js'

const store = useIngredientStore()
const selectedRegion = ref('한국')
const searchQ = ref('')
const expandedId = ref(null)
const loading = ref(false)
const allData = ref([])
const errorMessage = computed(() => store.error.value ? `규제 데이터 연결 오류: ${store.error.value}` : '')

// ── 지역 순서 고정 (항상 표시, 데이터 없어도) ──
const REGION_ORDER = ['한국', '유럽', '미국', '일본', '중국', '안전성']

// ── 지역별 카운트 ──
const regionCounts = computed(() => {
  const counts = {}
  for (const row of allData.value) {
    counts[row.region] = (counts[row.region] || 0) + 1
  }
  return counts
})

// ── 탭 목록: 항상 고정 순서로 전체 표시 ──
const regionTabs = computed(() => {
  return REGION_ORDER.map(label => ({
    label,
    count: regionCounts.value[label] || 0,
  }))
})

// ── 통계 뱃지 (선택된 지역 기준) ──
const stats = computed(() => {
  const base = allData.value.filter(r => r.region === selectedRegion.value)
  return {
    ban: base.filter(r => r.status === 'ban').length,
    limit: base.filter(r => r.status === 'limit').length,
    monitor: base.filter(r => r.status === 'monitor').length,
  }
})

// ── 표시 데이터 (지역 + 검색 필터, 최대 50행) ──
const displayData = computed(() => {
  let data = allData.value.filter(r => r.region === selectedRegion.value)
  if (searchQ.value.trim()) {
    const q = searchQ.value.trim().toLowerCase()
    data = data.filter(r => r.ingredient.toLowerCase().includes(q))
  }
  return data.slice(0, 50)
})

onMounted(async () => {
  loading.value = true
  try {
    await store.init()
  } catch { /* store init 실패해도 직접 조회 시도 */ }
  await loadData()
  loading.value = false
})

async function loadData() {
  try {
    // 충분히 가져와서 클라이언트에서 지역·검색 필터링
    const data = await store.searchRegulations({ limit: 300 })
    if (!data?.items) return

    allData.value = data.items
      .filter(r => {
        if (!(r.displayable ?? true)) return false
        if (!(r.ingredient || r.inci_name)) return false
        if (!isVisibleSource(r.source)) return false
        // pharma_prohibited, extract 제외
        if (r.ingredient_type === 'pharma_prohibited' || r.ingredient_type === 'extract') return false
        return true
      })
      .map((r, i) => {
        const region = mapRegulationSource(r.source)
        const restriction = r.restriction || ''
        const ewgTag = r.ewg_score != null ? `EWG ${r.ewg_score}` : ''
        const concernTag = r.concerns?.length ? r.concerns.slice(0, 1).join('') : ''
        const displayRestriction = restriction || [ewgTag, concernTag].filter(Boolean).join(' · ')
        return {
          id: i,
          region,
          ingredient: r.ingredient || r.inci_name,
          ingredient_type: r.ingredient_type || '',
          restriction: displayRestriction,
          restrictionShort: displayRestriction.length > 40 ? displayRestriction.slice(0, 40) + '…' : displayRestriction,
          status: getRegulationStatus(r),
          limit: r.max_concentration || '',
          ewg_score: r.ewg_score ?? null,
          primary_function: r.primary_function || '',
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString().slice(2, 7).replace('-', '/') : '—',
        }
      })
      .filter(r => r.region !== '기타')
      .sort((a, b) => {
        // ingredient_type 우선 정렬, 그 다음 성분명 알파벳 순
        if (a.ingredient_type && b.ingredient_type && a.ingredient_type !== b.ingredient_type) {
          return a.ingredient_type.localeCompare(b.ingredient_type)
        }
        return a.ingredient.localeCompare(b.ingredient)
      })
  } catch (err) {
    console.error('[WidgetRegulation] 데이터 로드 실패:', err.message)
  }
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function getRegulationStatus(r) {
  // 1순위: 워크플로우팀 배치 산출 display_status (가장 정확)
  if (r.display_status === 'ban') return 'ban'
  if (r.display_status === 'limit') return 'limit'
  if (r.display_status === 'monitor') return 'monitor'

  // 2순위: reg_status 구조화 값 — allowed이면 텍스트 파싱 없이 바로 monitor
  if (r.reg_status === 'allowed') return 'monitor'
  if (r.reg_status === 'banned') return 'ban'
  if (r.reg_status === 'restricted') return 'limit'

  // 3순위: 텍스트 기반 — 부정 표현("없음", "not in") 포함 시 텍스트 금지 판정 제외
  const restriction = (r.restriction || '').toLowerCase()
  const maxConc = (r.max_concentration || '').toLowerCase()
  const isNegated = /없음|not in|목록에 없|not prohibited|not restricted/.test(restriction)
  if (!isNegated && (restriction.includes('금지') || restriction.includes('ban') || restriction.includes('prohibit'))) return 'ban'
  if (maxConc && maxConc !== '-') return 'limit'

  // EWG 점수는 안전성 등급이지 규제 금지 여부가 아님 — 참고용으로만 사용
  // (display_status 없을 때만 폴백)
  return 'monitor'
}

function getRegionClass(region) {
  const map = { '한국': 'region-kr', '유럽': 'region-eu', '미국': 'region-us', '일본': 'region-jp', '중국': 'region-cn', '아세안': 'region-asean', '안전성': 'region-safety' }
  return map[region] || ''
}

function getStatusClass(status) {
  return { ban: 'chip-red', limit: 'chip-amber', monitor: 'chip-purple' }[status] || ''
}

function getStatusLabel(status) {
  return { ban: '금지', limit: '제한', monitor: '모니터링' }[status] || status
}

const INGREDIENT_TYPE_LABELS = {
  preservative: '방부제', uv_filter: '자외선차단', surfactant: '계면활성제',
  silicone: '실리콘', peptide: '펩타이드', colorant: '색소', fragrance: '향료',
  emulsifier: '유화제', thickener: '점증제', humectant_active: '보습/활성',
  emollient_ester: '에몰리언트', antioxidant: '산화방지제', polymer_film_former: '폴리머',
  plant_oil: '식물유', mineral_inorganic: '무기물', solvent: '용매',
  chelator_ph: 'pH조절', biomimetic_active: '바이오미메틱', amino_acid: '아미노산',
  hair_colorant: '모발색소', hydrolyzed_protein: '가수분해단백', vitamin: '비타민',
}

function typeLabel(type) {
  if (!type) return ''
  return INGREDIENT_TYPE_LABELS[type] || type
}

function ewgClass(score) {
  if (score >= 7) return 'ewg-high'
  if (score >= 4) return 'ewg-mid'
  return 'ewg-low'
}

function ewgBadgeClass(score) {
  if (score <= 2) return 'ewg-low'
  if (score <= 6) return 'ewg-moderate'
  return 'ewg-high'
}
</script>

<style scoped>
.regulation-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  container-type: inline-size;
}

.error-banner {
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid #e8b8b8;
  border-radius: 8px;
  background: var(--red-bg);
  color: var(--red);
  font-size: 11px;
  line-height: 1.5;
}

/* ── 헤더 ── */
.reg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.region-tabs {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.region-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.region-tab:hover { border-color: var(--accent); color: var(--accent); }
.region-tab.active { background: var(--accent); border-color: var(--accent); color: #fff; }

.tab-count {
  font-size: 9px;
  font-weight: 700;
  opacity: 0.75;
}

/* ── 검색 + 통계 ── */
.reg-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.search-input {
  padding: 4px 10px;
  font-size: 11px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 5px;
  outline: none;
  width: 150px;
}
.search-input:focus { border-color: var(--accent); }

.stat-badges {
  display: flex;
  gap: 4px;
}

.stat-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}
.badge-ban    { background: rgba(196,78,78,0.12);   color: var(--red); }
.badge-limit  { background: rgba(184,147,90,0.12);  color: var(--amber); }
.badge-monitor{ background: rgba(124,92,191,0.12);  color: var(--purple); }

/* ── 테이블 ── */
.reg-table-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.reg-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.reg-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 5px 8px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-dim);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.col-region   { width: 52px; }
.col-name     { width: 22%; }
.col-restrict { /* flex */ }
.col-conc     { width: 88px; }
.col-status   { width: 72px; }
.col-date     { width: 54px; }

.reg-row {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s;
}
.reg-row:hover { background: var(--bg); }
.reg-row.row-expanded { background: var(--bg); }
.reg-row.row-ban td { border-left: 2px solid var(--red); }
.reg-row.row-ban td:first-child { border-left: none; }

.reg-row td {
  padding: 6px 8px;
  vertical-align: middle;
}

/* 지역 칩 */
.region-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 20px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.region-kr     { background: rgba(58,111,168,0.15);  color: var(--blue); }
.region-eu     { background: rgba(124,92,191,0.15);  color: var(--purple); }
.region-us     { background: rgba(58,144,104,0.15);  color: var(--green); }
.region-jp     { background: rgba(196,78,78,0.12);   color: #c44e4e; }
.region-cn     { background: rgba(196,130,50,0.15);  color: #c48232; }
.region-asean  { background: rgba(58,144,104,0.15);  color: var(--green); }
.region-safety { background: rgba(184,147,90,0.15);  color: var(--amber); }

/* 성분명 */
.td-name {
  font-weight: 600;
  color: var(--text);
  max-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 제한 내용 */
.td-restrict {
  color: var(--text-sub);
  max-width: 0;
  overflow: hidden;
}
.restrict-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10.5px;
}
.restrict-empty { color: var(--text-dim); }

/* 농도 */
.td-conc.mono {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text);
  white-space: nowrap;
}

/* 상태 칩 */
.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.chip-red    { background: rgba(196,78,78,0.15);   color: var(--red); }
.chip-amber  { background: rgba(184,147,90,0.15);  color: var(--amber); }
.chip-purple { background: rgba(124,92,191,0.15);  color: var(--purple); }

/* 갱신일 */
.td-date.mono {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  white-space: nowrap;
}

/* 펼침 행 */
.expand-row {
  background: var(--bg);
}
.expand-cell {
  padding: 6px 16px 10px;
  border-bottom: 1px solid var(--border);
}
.expand-content {
  font-size: 11px;
  color: var(--text-sub);
  line-height: 1.6;
}
.expand-label {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 8px;
  vertical-align: middle;
}

/* EWG 점수 뱃지 */
.ewg-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  margin-left: 10px;
  vertical-align: middle;
  letter-spacing: 0.3px;
}
.ewg-low  { background: rgba(58,144,104,0.15); color: var(--green); }
.ewg-mid  { background: rgba(184,147,90,0.15);  color: var(--amber); }
.ewg-high { background: rgba(196,78,78,0.15);   color: var(--red); }

/* 메인 행 EWG 배지 (ewgBadgeClass 전용) */
.ewg-moderate { background: #fff3cd; color: #856404; }

/* 기능 표시 */
.expand-fn { color: var(--text-sub); }

/* 원료 타입 배지 */
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  margin-left: 6px;
  vertical-align: middle;
  letter-spacing: 0.2px;
}

/* 빈 상태 */
.empty {
  text-align: center;
  color: var(--text-dim);
  font-size: 11px;
  padding: 20px;
}

/* 좁은 위젯 대응 */
@container (max-width: 600px) {
  .col-restrict, .td-restrict { display: none; }
  .col-date, .td-date { display: none; }
  .search-input { width: 110px; }
  .stat-badges { display: none; }
}
</style>
