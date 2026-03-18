<template>
  <div class="regulation-widget">
    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

    <!-- ── 헤더: 탭 + 검색 + 통계 ── -->
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
        <input v-model="searchQ" class="search-input" placeholder="성분명 검색..." />
        <div class="stat-badges">
          <span class="stat-badge badge-ban">금지 {{ stats.ban }}</span>
          <span class="stat-badge badge-limit">제한 {{ stats.limit }}</span>
          <span class="stat-badge badge-allowed">허용 {{ stats.allowed }}</span>
          <span class="stat-badge badge-unknown">미확인 {{ stats.unknown }}</span>
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
            <th class="col-category">카테고리</th>
            <th class="col-ewg">EWG</th>
            <th class="col-func">기능</th>
            <th class="col-restrict">제한내용</th>
            <th class="col-conc">최대농도</th>
            <th class="col-status">상태</th>
            <th class="col-date">갱신</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in displayData"
            :key="row.id"
            :class="['reg-row', `row-${row.status}`]"
            @click="openPanel(row)"
          >
            <td>
              <span :class="['region-chip', getRegionClass(row.region)]">{{ row.region }}</span>
            </td>
            <td class="td-name">{{ row.ingredient }}</td>
            <td class="td-category">
              <span v-if="row.ingredient_type" :class="['cat-badge', getCatClass(row.ingredient_type)]">
                {{ typeLabel(row.ingredient_type) }}
              </span>
              <span v-else class="dim">—</span>
            </td>
            <td class="td-ewg">
              <span v-if="row.ewg_score != null" :class="['ewg-num', ewgNumClass(row.ewg_score)]">
                {{ row.ewg_score }}
              </span>
              <span v-else class="dim">—</span>
            </td>
            <td class="td-func">
              <span v-if="row.primary_function" class="func-text">{{ row.primary_function }}</span>
              <span v-else class="dim">—</span>
            </td>
            <td class="td-restrict">
              <span
                v-if="row.restrictionShort"
                class="restrict-text"
                :data-tooltip="row.restriction.length > 40 ? row.restriction : null"
              >{{ row.restrictionShort }}</span>
              <span v-else class="dim">—</span>
            </td>
            <td class="td-conc mono">{{ row.limit || '—' }}</td>
            <td>
              <span :class="['status-chip', getStatusClass(row.status)]">
                {{ getStatusLabel(row.status) }}
              </span>
            </td>
            <td class="td-date mono">{{ row.updatedAt }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!displayData.length && !loading" class="empty">
      {{ errorMessage ? 'API 서버를 먼저 실행하세요' : (searchQ ? `'${searchQ}' 검색 결과가 없습니다` : '해당 지역의 규제 데이터가 없습니다') }}
    </div>
    <div v-if="loading" class="empty">불러오는 중...</div>

    <!-- ── 슬라이드 패널 ── -->
    <transition name="panel-slide">
      <div v-if="panelRow" class="panel-overlay" @click.self="closePanel">
        <div class="detail-panel">
          <button class="panel-close" @click="closePanel">✕</button>

          <!-- 헤더 -->
          <div class="panel-head">
            <div class="panel-title">{{ panelRow.ingredient }}</div>
            <div class="panel-meta">
              <span :class="['region-chip', getRegionClass(panelRow.region)]">{{ panelRow.region }}</span>
              <span :class="['status-chip', getStatusClass(panelRow.status)]">{{ getStatusLabel(panelRow.status) }}</span>
              <span v-if="panelRow.ingredient_type" :class="['cat-badge', getCatClass(panelRow.ingredient_type)]">
                {{ typeLabel(panelRow.ingredient_type) }}
              </span>
            </div>
          </div>

          <!-- 섹션: EWG -->
          <div v-if="panelRow.ewg_score != null" class="panel-section">
            <div class="panel-section-label">EWG 안전성 점수</div>
            <div class="panel-ewg-bar">
              <div class="ewg-bar-bg">
                <div class="ewg-bar-fill" :class="ewgNumClass(panelRow.ewg_score)" :style="{ width: (panelRow.ewg_score / 10 * 100) + '%' }"></div>
              </div>
              <span :class="['ewg-num', ewgNumClass(panelRow.ewg_score)]" style="margin-left:8px">{{ panelRow.ewg_score }} / 10</span>
            </div>
          </div>

          <!-- 섹션: 기능 -->
          <div v-if="panelRow.primary_function" class="panel-section">
            <div class="panel-section-label">기능</div>
            <div class="panel-body-text">{{ panelRow.primary_function }}</div>
          </div>

          <!-- 섹션: 규제 내용 전문 -->
          <div v-if="panelRow.restriction" class="panel-section">
            <div class="panel-section-label">규제 내용</div>
            <div class="panel-body-text">{{ panelRow.restriction }}</div>
          </div>

          <!-- 섹션: 최대 농도 -->
          <div v-if="panelRow.limit" class="panel-section">
            <div class="panel-section-label">최대 허용 농도</div>
            <div class="panel-body-text mono">{{ panelRow.limit }}</div>
          </div>

          <!-- 섹션: 갱신일 -->
          <div class="panel-section">
            <div class="panel-section-label">마지막 갱신</div>
            <div class="panel-body-text mono">{{ panelRow.updatedAt }}</div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIngredientStore } from '../../stores/ingredientStore.js'
import { mapRegulationSource, isVisibleSource } from '../../utils/regulationSource.js'

const store = useIngredientStore()
const selectedRegion = ref('한국')
const searchQ = ref('')
const loading = ref(false)
const allData = ref([])
const panelRow = ref(null)
const errorMessage = computed(() => store.error?.value ? `규제 데이터 연결 오류: ${store.error.value}` : '')

const REGION_ORDER = ['한국', '유럽', '미국', '일본', '중국']

const regionCounts = computed(() => {
  const counts = {}
  for (const row of allData.value) {
    counts[row.region] = (counts[row.region] || 0) + 1
  }
  return counts
})

const regionTabs = computed(() =>
  REGION_ORDER.map(label => ({ label, count: regionCounts.value[label] || 0 }))
)

const stats = computed(() => {
  const base = allData.value.filter(r => r.region === selectedRegion.value)
  return {
    ban:     base.filter(r => r.status === 'ban').length,
    limit:   base.filter(r => r.status === 'limit').length,
    allowed: base.filter(r => r.status === 'allowed').length,
    unknown: base.filter(r => r.status === 'unknown').length,
  }
})

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
  try { await store.init() } catch { /* ignore */ }
  await loadData()
  loading.value = false
})

async function loadData() {
  try {
    const data = await store.searchRegulations({ limit: 300 })
    if (!data?.items) return

    allData.value = data.items
      .filter(r => {
        if (!(r.displayable ?? true)) return false
        if (!(r.ingredient || r.inci_name)) return false
        if (!isVisibleSource(r.source)) return false
        if (r.ingredient_type === 'pharma_prohibited' || r.ingredient_type === 'extract') return false
        return true
      })
      .map((r, i) => {
        const region = mapRegulationSource(r.source)
        const restriction = r.restriction || ''
        const restrictionShort = restriction.length > 40 ? restriction.slice(0, 40) + '…' : restriction
        return {
          id: i,
          region,
          ingredient: r.ingredient || r.inci_name,
          ingredient_type: r.ingredient_type || '',
          restriction,
          restrictionShort,
          status: getRegulationStatus(r),
          limit: r.max_concentration || '',
          ewg_score: r.ewg_score ?? null,
          primary_function: r.primary_function || '',
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString().slice(2, 7).replace('-', '/') : '—',
        }
      })
      .filter(r => r.region !== '기타')
      .sort((a, b) => {
        if (a.ingredient_type && b.ingredient_type && a.ingredient_type !== b.ingredient_type) {
          return a.ingredient_type.localeCompare(b.ingredient_type)
        }
        return a.ingredient.localeCompare(b.ingredient)
      })
  } catch (err) {
    console.error('[WidgetRegulation] 로드 실패:', err.message)
  }
}

function openPanel(row) { panelRow.value = row }
function closePanel() { panelRow.value = null }

function getRegulationStatus(r) {
  // 1. 명시적 override
  if (r.display_status === 'ban')     return 'ban'
  if (r.display_status === 'limit')   return 'limit'
  if (r.display_status === 'allowed') return 'allowed'
  if (r.display_status === 'monitor') return 'unknown'

  // 2. reg_status 영문 표준값
  if (r.reg_status === 'prohibited') return 'ban'
  if (r.reg_status === 'restricted') return 'limit'
  if (r.reg_status === 'allowed')    return 'allowed'

  const restriction = (r.restriction || '')
  const maxConc = (r.max_concentration || '').toLowerCase()

  // 3. EU Annex 코드 (coching_legacy: II/xxx=금지, III/xxx=제한, V/xxx=보존제제한)
  if (/^II\//.test(restriction))  return 'ban'
  if (/^III\//.test(restriction)) return 'limit'
  if (/^V\//.test(restriction))   return 'limit'
  if (/^CMR/.test(restriction))   return 'ban'
  if (/^Annex\s*II[^I]/i.test(restriction) && !/화장품 등급|cosmetic grade|조건부 허용/.test(restriction)) return 'ban'
  if (/^Annex\s*III/i.test(restriction)) return 'limit'
  if (/^Annex\s*V/i.test(restriction))   return 'limit'

  // 4. GEMINI_SAFETY JSON restriction
  if (restriction.startsWith('{')) {
    try {
      const parsed = JSON.parse(restriction)
      if (parsed?.status === 'prohibited') return 'ban'
      if (parsed?.status === 'restricted') return 'limit'
      if (parsed?.status === 'allowed')    return 'allowed'
    } catch { /* ignore parse error */ }
  }

  // 5. 자유 텍스트 — 전면 금지 표현만 'ban' (부분 금지 표현은 'limit')
  const isFullyProhibited = /사용할\s*수\s*없는\s*원료|전면\s*금지|완전히\s*금지|prohibited substance/.test(restriction)
  if (isFullyProhibited) return 'ban'

  // 6. 제한 판단: 농도 한도 or 배합 한도 명시
  if (maxConc && maxConc !== '-') return 'limit'
  if (/배합\s*한도|사용\s*한도|최대\s*농도|Max\.|max\s+\d|Annex\s*(III|V)/i.test(restriction)) return 'limit'

  // 7. 규제 없음 명시
  if (/규제\s*없음|제한\s*없음|No\s*restrictions?/i.test(restriction)) return 'allowed'

  return 'unknown'
}

function getRegionClass(region) {
  return { '한국': 'region-kr', '유럽': 'region-eu', '미국': 'region-us', '일본': 'region-jp', '중국': 'region-cn', '아세안': 'region-asean', '안전성': 'region-safety' }[region] || ''
}

function getStatusClass(status) {
  return { ban: 'chip-red', limit: 'chip-amber', allowed: 'chip-green', unknown: 'chip-gray' }[status] || ''
}

function getStatusLabel(status) {
  return { ban: '금지', limit: '제한', allowed: '허용', unknown: '미확인' }[status] || status
}

function ewgNumClass(score) {
  if (score <= 2) return 'ewg-green'
  if (score <= 6) return 'ewg-yellow'
  return 'ewg-red'
}

const CAT_COLORS = {
  preservative: 'cat-preservative', uv_filter: 'cat-uv', surfactant: 'cat-surfactant',
  silicone: 'cat-silicone', peptide: 'cat-peptide', colorant: 'cat-colorant',
  fragrance: 'cat-fragrance', emulsifier: 'cat-emulsifier', thickener: 'cat-thickener',
  humectant_active: 'cat-humectant', emollient_ester: 'cat-emollient',
  antioxidant: 'cat-antioxidant', polymer_film_former: 'cat-polymer',
  plant_oil: 'cat-plant', mineral_inorganic: 'cat-mineral', solvent: 'cat-solvent',
  chelator_ph: 'cat-chelator', vitamin: 'cat-vitamin',
}

function getCatClass(type) {
  return CAT_COLORS[type] || 'cat-default'
}

const INGREDIENT_TYPE_LABELS = {
  preservative: '방부제', uv_filter: '자외선차단', surfactant: '계면활성제',
  silicone: '실리콘', peptide: '펩타이드', colorant: '색소', fragrance: '향료',
  emulsifier: '유화제', thickener: '점증제', humectant_active: '보습활성',
  emollient_ester: '에몰리언트', antioxidant: '산화방지제', polymer_film_former: '폴리머',
  plant_oil: '식물유', mineral_inorganic: '무기물', solvent: '용매',
  chelator_ph: 'pH조절', biomimetic_active: '바이오미메틱', amino_acid: '아미노산',
  hair_colorant: '모발색소', hydrolyzed_protein: '가수분해단백', vitamin: '비타민',
}

function typeLabel(type) {
  return INGREDIENT_TYPE_LABELS[type] || type
}
</script>

<style scoped>
.regulation-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  container-type: inline-size;
  position: relative;
}

.error-banner {
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid #e8b8b8;
  border-radius: 8px;
  background: var(--red-bg);
  color: var(--red);
  font-size: 11px;
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

.region-tabs { display: flex; gap: 3px; flex-wrap: wrap; }

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
.tab-count { font-size: 9px; font-weight: 700; opacity: 0.75; }

.reg-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

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

.stat-badges { display: flex; gap: 4px; }
.stat-badge { padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; white-space: nowrap; }
.badge-ban     { background: rgba(196,78,78,0.12);   color: var(--red); }
.badge-limit   { background: rgba(184,147,90,0.12);  color: var(--amber); }
.badge-allowed { background: rgba(58,144,104,0.12);  color: var(--green); }
.badge-unknown { background: rgba(128,128,128,0.12); color: var(--text-dim); }

/* ── 테이블 ── */
.reg-table-wrap { flex: 1; overflow-y: auto; overflow-x: auto; }

.reg-table { width: 100%; border-collapse: collapse; font-size: 11px; }

.reg-table thead th {
  position: sticky; top: 0; z-index: 1;
  padding: 5px 8px;
  text-align: left;
  font-size: 10px; font-weight: 700;
  color: var(--text-dim);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  text-transform: uppercase; letter-spacing: 0.04em;
  white-space: nowrap;
}

.col-region   { width: 50px; }
.col-name     { width: 180px; min-width: 120px; }
.col-category { width: 90px; }
.col-ewg      { width: 50px; text-align: center; }
.col-func     { width: 120px; }
.col-restrict { width: 200px; }
.col-conc     { width: 80px; }
.col-status   { width: 70px; }
.col-date     { width: 50px; }

.reg-row {
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s;
}
.reg-row:hover { background: var(--bg); }


.reg-row td { padding: 6px 8px; vertical-align: middle; }

/* 지역 칩 */
.region-chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 20px; padding: 0 4px;
  border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; white-space: nowrap;
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
  font-weight: 600; color: var(--text);
  max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* 카테고리 배지 */
.td-category { white-space: nowrap; }
.cat-badge {
  display: inline-flex; align-items: center;
  padding: 1px 6px; border-radius: 3px;
  font-size: 9px; font-weight: 600;
  white-space: nowrap; letter-spacing: 0.2px;
}
.cat-preservative { background: rgba(196,78,78,0.12);   color: #c44e4e; }
.cat-uv           { background: rgba(58,111,168,0.15);  color: var(--blue); }
.cat-surfactant   { background: rgba(58,144,104,0.15);  color: var(--green); }
.cat-silicone     { background: rgba(124,92,191,0.12);  color: var(--purple); }
.cat-peptide      { background: rgba(184,147,90,0.12);  color: var(--amber); }
.cat-colorant     { background: rgba(196,78,78,0.10);   color: #c44e4e; }
.cat-fragrance    { background: rgba(124,92,191,0.10);  color: var(--purple); }
.cat-emulsifier   { background: rgba(58,144,104,0.12);  color: var(--green); }
.cat-thickener    { background: rgba(58,111,168,0.12);  color: var(--blue); }
.cat-humectant    { background: rgba(58,144,104,0.10);  color: var(--green); }
.cat-emollient    { background: rgba(184,147,90,0.10);  color: var(--amber); }
.cat-antioxidant  { background: rgba(58,144,104,0.14);  color: var(--green); }
.cat-polymer      { background: rgba(124,92,191,0.10);  color: var(--purple); }
.cat-plant        { background: rgba(58,144,104,0.12);  color: var(--green); }
.cat-mineral      { background: rgba(58,111,168,0.10);  color: var(--blue); }
.cat-solvent      { background: rgba(184,147,90,0.08);  color: var(--amber); }
.cat-chelator     { background: rgba(58,111,168,0.08);  color: var(--blue); }
.cat-vitamin      { background: rgba(58,144,104,0.16);  color: var(--green); }
.cat-default      { background: var(--border);          color: var(--text-dim); }

/* EWG */
.td-ewg { text-align: center; }
.ewg-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 20px;
  border-radius: 3px; font-size: 10px; font-weight: 700;
}
.ewg-green  { background: rgba(58,144,104,0.15); color: var(--green); }
.ewg-yellow { background: rgba(184,147,90,0.15); color: var(--amber); }
.ewg-red    { background: rgba(196,78,78,0.15);  color: var(--red); }

/* 기능 */
.td-func {
  color: var(--text-sub); font-size: 10.5px;
  max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.func-text { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 제한내용 */
.td-restrict {
  color: var(--text-sub); max-width: 200px; overflow: hidden; position: relative;
}
.restrict-text {
  display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10.5px;
  cursor: help;
}
/* CSS 툴팁 */
.restrict-text[data-tooltip] { position: relative; }
.restrict-text[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  z-index: 100;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 6px 10px;
  font-size: 10.5px;
  color: var(--text);
  white-space: normal;
  max-width: 300px;
  min-width: 160px;
  line-height: 1.5;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  pointer-events: none;
}

/* 농도 */
.td-conc.mono { font-family: var(--font-mono); font-size: 10.5px; white-space: nowrap; }

/* 상태 칩 */
.status-chip {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 2px 7px; border-radius: 3px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.3px; white-space: nowrap;
}
.chip-red   { background: rgba(196,78,78,0.15);   color: var(--red); }
.chip-amber { background: rgba(184,147,90,0.15);  color: var(--amber); }
.chip-green { background: rgba(58,144,104,0.15);  color: var(--green); }
.chip-gray  { background: rgba(128,128,128,0.12); color: var(--text-dim); }

/* 갱신일 */
.td-date.mono { font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); white-space: nowrap; }

/* 공통 dim */
.dim { color: var(--text-dim); }

/* ── 슬라이드 패널 ── */
.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(0,0,0,0.25);
  display: flex;
  justify-content: flex-end;
}

.detail-panel {
  width: 320px;
  max-width: 90%;
  height: 100%;
  background: var(--surface);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

.panel-close {
  position: absolute;
  top: 12px; right: 12px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: background 0.1s;
}
.panel-close:hover { background: var(--border); color: var(--text); }

.panel-head { margin-bottom: 16px; padding-right: 24px; }

.panel-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
  line-height: 1.4;
  word-break: break-all;
}

.panel-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.panel-section {
  border-top: 1px solid var(--border);
  padding: 12px 0;
}

.panel-section-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  margin-bottom: 6px;
}

.panel-body-text {
  font-size: 11.5px;
  color: var(--text-sub);
  line-height: 1.6;
  word-break: break-word;
}
.panel-body-text.mono { font-family: var(--font-mono); }

/* EWG 바 */
.panel-ewg-bar { display: flex; align-items: center; }
.ewg-bar-bg {
  flex: 1;
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.ewg-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.ewg-bar-fill.ewg-green  { background: var(--green); }
.ewg-bar-fill.ewg-yellow { background: var(--amber); }
.ewg-bar-fill.ewg-red    { background: var(--red); }

/* 슬라이드 트랜지션 */
.panel-slide-enter-active,
.panel-slide-leave-active { transition: opacity 0.2s ease; }
.panel-slide-enter-active .detail-panel,
.panel-slide-leave-active .detail-panel { transition: transform 0.25s ease; }
.panel-slide-enter-from { opacity: 0; }
.panel-slide-enter-from .detail-panel { transform: translateX(100%); }
.panel-slide-leave-to { opacity: 0; }
.panel-slide-leave-to .detail-panel { transform: translateX(100%); }

/* 빈 상태 */
.empty { text-align: center; color: var(--text-dim); font-size: 11px; padding: 20px; }

/* 좁은 위젯 */
@container (max-width: 700px) {
  .col-func, .td-func { display: none; }
  .col-restrict, .td-restrict { display: none; }
  .col-date, .td-date { display: none; }
  .search-input { width: 110px; }
  .stat-badges { display: none; }
}
@container (max-width: 500px) {
  .col-category, .td-category { display: none; }
  .col-ewg, .td-ewg { display: none; }
}
</style>
