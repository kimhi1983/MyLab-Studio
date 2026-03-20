<template>
  <div class="ingredient-db-page">
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>
    <!-- 상단 검색바 + 필터 -->
    <div class="search-bar-wrap">
      <div class="search-bar">
        <span class="search-icon">⊕</span>
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="INCI Name 또는 한글명으로 검색..."
          @input="onSearchInput"
        />
        <span v-if="searchQuery" class="search-clear" @click="clearSearch">✕</span>
      </div>
      <div class="search-meta">
        <span class="section-label">INGREDIENT DB</span>
        <span class="meta-count" v-if="totalCount > 0">총 {{ totalCount.toLocaleString() }}건</span>
      </div>
    </div>

    <!-- 필터 바 -->
    <div class="filter-bar">
      <select v-model="selectedType" class="filter-select" @change="onFilterChange">
        <option value="">전체 카테고리</option>
        <option value="emollient_ester">에몰리언트 에스터</option>
        <option value="surfactant">계면활성제</option>
        <option value="emulsifier">유화제</option>
        <option value="peptide">펩타이드</option>
        <option value="humectant_active">보습/활성</option>
        <option value="thickener">점증제</option>
        <option value="preservative">방부제</option>
        <option value="antioxidant">산화방지제</option>
        <option value="polymer_film_former">폴리머</option>
        <option value="silicone">실리콘</option>
        <option value="uv_filter">자외선차단제</option>
        <option value="colorant">색소</option>
        <option value="fragrance">향료</option>
        <option value="plant_oil">식물유</option>
        <option value="mineral_inorganic">무기물</option>
        <option value="chelator_ph">pH조절제</option>
        <option value="biomimetic_active">바이오미메틱</option>
        <option value="amino_acid">아미노산</option>
        <option value="hydrolyzed_protein">가수분해단백</option>
        <option value="vitamin">비타민</option>
        <option value="extract">추출물류</option>
        <option value="solvent">용매</option>
      </select>

      <select v-model="selectedRegStatus" class="filter-select" @change="onFilterChange">
        <option value="">규제 전체</option>
        <option value="allowed">허용</option>
        <option value="restricted">제한</option>
        <option value="prohibited">금지</option>
        <option value="unknown">미확인</option>
      </select>

      <label class="pharma-toggle">
        <input type="checkbox" v-model="showPharma" @change="onFilterChange" />
        <span>금지물질 포함</span>
      </label>
    </div>

    <!-- 메인 레이아웃 -->
    <div class="main-layout">
      <!-- 목록 -->
      <div class="list-panel">
        <div class="panel">
          <!-- 테이블 헤더 -->
          <div class="table-wrap">
            <table class="data-table">
              <colgroup>
                <col class="col-inci" />
                <col class="col-kr" />
                <col class="col-cas" />
                <col class="col-type" />
                <col class="col-func" />
                <col class="col-ewg" />
                <col class="col-reg" />
              </colgroup>
              <thead>
                <tr>
                  <th class="col-inci">INCI Name</th>
                  <th class="col-kr">한글명</th>
                  <th class="col-cas">CAS No</th>
                  <th class="col-type">카테고리</th>
                  <th class="col-func">기능</th>
                  <th class="col-ewg">EWG</th>
                  <th class="col-reg">규제 (KR/EU)</th>
                </tr>
              </thead>
              <tbody v-if="!loading && items.length">
                <tr
                  v-for="(item, idx) in items"
                  :key="idx"
                  class="data-row"
                  :class="{ selected: selectedItem === item, 'row-pharma': item.ingredient_type === 'pharma_prohibited' }"
                  @click="selectItem(item)"
                >
                  <td class="cell-inci">{{ item.inci_name || '-' }}</td>
                  <td class="cell-kr">{{ item.korean_name || '-' }}</td>
                  <td class="cell-cas">
                    <a
                      v-if="item.cas_number && item.cas_number !== 'NOT_FOUND'"
                      :href="`https://pubchem.ncbi.nlm.nih.gov/#query=${item.cas_number}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="cas-link"
                      @click.stop
                    >{{ item.cas_number }}</a>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-type">
                    <span v-if="item.ingredient_type" class="type-chip">{{ ingredientTypeLabel(item.ingredient_type) }}</span>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-func">
                    <template v-if="item.function_inci">
                      <div
                        class="func-cell-wrap"
                        :title="funcList(item.function_inci).length > 2 ? funcList(item.function_inci).join(', ') : ''"
                      >
                        <span v-for="fn in funcList(item.function_inci).slice(0, 2)" :key="fn" class="func-tag">{{ fn }}</span>
                        <span v-if="funcList(item.function_inci).length > 2" class="func-more">+{{ funcList(item.function_inci).length - 2 }}</span>
                      </div>
                    </template>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-ewg">
                    <span v-if="item.ewg_score != null && item.ewg_score > 0" class="ewg-chip" :class="ewgClass(item.ewg_score)">
                      {{ item.ewg_score }}
                    </span>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-reg">
                    <div class="reg-badges">
                      <span v-if="item.regulation_status_kr && item.regulation_status_kr !== 'unknown'" class="reg-badge" :class="regStatusBadgeClass(item.regulation_status_kr)">KR {{ regStatusLabel(item.regulation_status_kr) }}</span>
                      <span v-if="item.regulation_status_eu && item.regulation_status_eu !== 'unknown'" class="reg-badge" :class="regStatusBadgeClass(item.regulation_status_eu)">EU {{ regStatusLabel(item.regulation_status_eu) }}</span>
                      <span v-if="item.regulation_status_kr === 'unknown' || item.regulation_status_eu === 'unknown'" class="reg-badge badge-gray">미확인</span>
                      <span v-if="!item.regulation_status_kr && !item.regulation_status_eu" class="cell-empty">-</span>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tbody v-else-if="loading">
                <tr v-for="n in 8" :key="n">
                  <td colspan="7">
                    <div class="skeleton-row"></div>
                  </td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr>
                  <td colspan="7" class="empty-cell">
                    <div class="empty-state">
                      <div class="empty-icon">◎</div>
                      <div class="empty-title">{{ errorMessage ? 'API 서버에 연결하지 못했습니다' : '검색 결과가 없습니다' }}</div>
                      <div class="empty-sub">{{ errorMessage ? 'scripts\\run-api.cmd 로 API 서버를 먼저 실행하세요' : '다른 키워드로 검색해보세요' }}</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 페이지네이션 -->
          <div v-if="totalPages > 1" class="pagination-wrap">
            <button class="page-btn" :disabled="currentPage <= 1" @click="goToPage(1)" title="첫 페이지">«</button>
            <button class="page-btn" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">‹</button>
            <button
              v-for="p in visiblePages"
              :key="p"
              class="page-btn"
              :class="{ active: p === currentPage }"
              @click="goToPage(p)"
            >{{ p }}</button>
            <button class="page-btn" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">›</button>
            <button class="page-btn" :disabled="currentPage >= totalPages" @click="goToPage(totalPages)" title="마지막 페이지">»</button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- ─── 성분 상세 모달 ─── -->
  <Teleport to="body">
    <div v-if="selectedItem !== null" class="ing-modal-overlay" @click.self="closeDetail">
      <div class="ing-modal">

        <!-- 모달 헤더 -->
        <div class="ing-modal-hd">
          <div class="ing-modal-title-wrap">
            <div class="ing-modal-inci">{{ (detailData || selectedItem).inci_name }}</div>
            <div class="ing-modal-kr">{{ (detailData || selectedItem).korean_name || '-' }}</div>
            <div v-if="detailData?.cas_number && detailData.cas_number !== 'NOT_FOUND'" class="ing-modal-cas mono-text">CAS {{ detailData.cas_number }}</div>
          </div>
          <button class="ing-modal-close" @click="closeDetail">×</button>
        </div>

        <!-- 모달 바디 -->
        <div class="ing-modal-body">

          <!-- 로딩 -->
          <div v-if="detailLoading" class="ing-loading">
            <div class="spinner"></div>
            <span>정보 불러오는 중...</span>
          </div>

          <!-- 상세 데이터 -->
          <div v-else-if="detailData">

            <!-- 5개국 규제 + 배합 가이드 2열 그리드 -->
            <div class="ing-reg-grid">

              <!-- 5개국 규제 카드 -->
              <div
                v-for="cc in countryList"
                :key="cc.code"
                class="ing-country-card"
              >
                <div class="icc-hd">
                  <span class="icc-name">{{ cc.label }}</span>
                  <template v-if="detailData.regulations?.[cc.code]?.length">
                    <span class="reg-status-chip" :class="regChipClass(detailData.regulations[cc.code][0].reg_status)">
                      {{ regStatusIcon(detailData.regulations[cc.code][0].reg_status) }}
                      {{ regStatusLabel(detailData.regulations[cc.code][0].reg_status) || '확인필요' }}
                    </span>
                  </template>
                  <span v-else class="icc-nodata">데이터 없음</span>
                </div>

                <template v-if="detailData.regulations?.[cc.code]?.length">
                  <div
                    v-for="(entry, ei) in detailData.regulations[cc.code]"
                    :key="ei"
                    class="icc-body"
                    :class="{ 'icc-divider': ei > 0 }"
                  >
                    <div v-if="entry.max_concentration" class="icc-row">
                      <span class="icc-label">최대 농도</span>
                      <span class="icc-val mono-text">{{ entry.max_concentration }}</span>
                    </div>
                    <div v-if="entry.annex" class="icc-row">
                      <span class="icc-label">{{ cc.code === 'EU' ? 'Annex' : '참조' }}</span>
                      <span class="icc-val mono-text">{{ entry.annex }}</span>
                    </div>
                    <div v-if="entry.cfr" class="icc-row">
                      <span class="icc-label">CFR</span>
                      <span class="icc-val mono-text">{{ entry.cfr }}</span>
                    </div>
                    <div v-if="entry.concerns && entry.concerns.length" class="icc-row">
                      <span class="icc-label">우려사항</span>
                      <div class="icc-val icc-note-group">
                        <span :class="['icc-note-text', !isExpanded(`m-${cc.code}-${ei}-con`) && entry.concerns.join(', ').length > 100 ? 'text-clamp-3' : '']">{{ entry.concerns.join(', ') }}</span>
                        <button v-if="entry.concerns.join(', ').length > 100" class="btn-expand" @click="toggleExpand(`m-${cc.code}-${ei}-con`)">{{ isExpanded(`m-${cc.code}-${ei}-con`) ? '접기' : '더보기' }}</button>
                      </div>
                    </div>
                    <div v-if="entry.other_restrictions" class="icc-row">
                      <span class="icc-label">제한사항</span>
                      <div class="icc-val icc-note-group">
                        <span :class="['icc-note-text', !isExpanded(`m-${cc.code}-${ei}-oth`) && entry.other_restrictions.length > 100 ? 'text-clamp-3' : '']">{{ entry.other_restrictions }}</span>
                        <button v-if="entry.other_restrictions.length > 100" class="btn-expand" @click="toggleExpand(`m-${cc.code}-${ei}-oth`)">{{ isExpanded(`m-${cc.code}-${ei}-oth`) ? '접기' : '더보기' }}</button>
                      </div>
                    </div>
                    <div v-if="entry.note || entry.restriction_text" class="icc-row">
                      <span class="icc-label">비고</span>
                      <div class="icc-val icc-note-group">
                        <span :class="['icc-note-text', !isExpanded(`m-${cc.code}-${ei}-note`) && (entry.note || entry.restriction_text).length > 100 ? 'text-clamp-3' : '']">{{ entry.note || entry.restriction_text }}</span>
                        <button v-if="(entry.note || entry.restriction_text).length > 100" class="btn-expand" @click="toggleExpand(`m-${cc.code}-${ei}-note`)">{{ isExpanded(`m-${cc.code}-${ei}-note`) ? '접기' : '더보기' }}</button>
                      </div>
                    </div>
                    <div v-if="entry.cir_assessment" class="icc-row">
                      <span class="icc-label">CIR</span>
                      <div class="icc-val icc-note-group">
                        <span :class="['icc-note-text', !isExpanded(`m-${cc.code}-${ei}-cir`) && entry.cir_assessment.length > 100 ? 'text-clamp-3' : '']">{{ entry.cir_assessment }}</span>
                        <button v-if="entry.cir_assessment.length > 100" class="btn-expand" @click="toggleExpand(`m-${cc.code}-${ei}-cir`)">{{ isExpanded(`m-${cc.code}-${ei}-cir`) ? '접기' : '더보기' }}</button>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <!-- 배합 가이드 카드 (6번째 셀) -->
              <div v-if="detailData.formulationGuide && detailData.formulationGuide.length" class="ing-country-card ing-guide-card">
                <div class="icc-hd"><span class="icc-name">배합 가이드</span></div>
                <div class="icc-guide-list">
                  <div v-for="g in detailData.formulationGuide" :key="g.purpose_key + g.role" class="icc-guide-row">
                    <span class="form-role-badge" :class="formRoleClass(g.role)">{{ formRoleLabel(g.role) }}</span>
                    <span class="icc-guide-purpose">{{ g.purpose_key }}</span>
                    <span v-if="g.default_pct_int != null" class="icc-guide-pct mono-text">
                      {{ (g.default_pct_int / 100).toFixed(2) }}%<template v-if="g.max_pct_int != null && g.max_pct_int > g.default_pct_int"> ~ {{ (g.max_pct_int / 100).toFixed(2) }}%</template>
                    </span>
                    <span v-if="g.reason" class="icc-guide-reason">{{ g.reason }}</span>
                  </div>
                  <template v-if="detailData.regulations?.EU?.some(r => r.max_concentration)">
                    <div class="icc-guide-row fg-eu-conc">
                      <span class="form-role-badge role-eu">EU 최대</span>
                      <span class="icc-guide-purpose">규제 허용 농도</span>
                      <span class="icc-guide-pct mono-text">{{ detailData.regulations.EU.find(r => r.max_concentration)?.max_concentration }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- 호환성 -->
            <div v-if="detailData.compatibility && detailData.compatibility.length" class="ing-compat-section">
              <div class="ing-section-title">호환성</div>
              <div class="ing-compat-list">
                <div v-for="c in detailData.compatibility" :key="c.partner + c.severity" class="compat-row">
                  <span class="compat-icon">{{ c.severity === 'forbidden' ? '⚠️' : '💡' }}</span>
                  <span class="compat-partner mono-text">{{ c.partner }}</span>
                  <span class="compat-reason">{{ c.reason }}</span>
                </div>
              </div>
            </div>

            <!-- 푸터 -->
            <div class="ing-modal-footer">
              <span v-if="detailData.updated_at" class="footer-date mono-text">마지막 업데이트: {{ formatDate(detailData.updated_at) }}</span>
              <button class="btn-add-to-formula" @click="addToFormula(detailData)">+ 처방에 추가</button>
            </div>
          </div>

          <!-- 폴백: 상세 데이터 없음 -->
          <div v-else>
            <div class="ing-reg-grid">
              <div v-for="cc in countryList" :key="cc.code" class="ing-country-card">
                <div class="icc-hd">
                  <span class="icc-name">{{ cc.label }}</span>
                  <template v-if="fallbackRegStatus(cc.code)">
                    <span class="reg-status-chip" :class="regChipClass(fallbackRegStatus(cc.code))">
                      {{ regStatusIcon(fallbackRegStatus(cc.code)) }} {{ regStatusLabel(fallbackRegStatus(cc.code)) }}
                    </span>
                  </template>
                  <span v-else class="icc-nodata">데이터 없음</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useIngredientStore } from '../stores/ingredientStore.js'
import { mapRegulationSource } from '../utils/regulationSource.js'

const router = useRouter()

const store = useIngredientStore()
const { loading, error } = store

const searchQuery = ref('')
const selectedType = ref('')
const selectedRegStatus = ref('')
const showPharma = ref(false)
const items = ref([])
const totalCount = ref(0)
const currentPage = ref(1)
const PAGE_SIZE = 50

const selectedItem = ref(null)
const detailData = ref(null)
const detailLoading = ref(false)

let debounceTimer = null

const totalPages = computed(() => Math.ceil(totalCount.value / PAGE_SIZE))
const errorMessage = computed(() => error.value ? `API 연결 오류: ${error.value}` : '')

// 표시할 페이지 번호 목록 (최대 7개)
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 6, 7]
  if (current >= total - 3) return Array.from({ length: 7 }, (_, i) => total - 6 + i)
  return [current - 3, current - 2, current - 1, current, current + 1, current + 2, current + 3]
})

// 초기 로드
onMounted(async () => {
  await loadIngredients()
})

async function loadIngredients() {
  // pharma_prohibited 포함 여부에 따라 타입 파라미터 처리
  const type = showPharma.value
    ? (selectedType.value || undefined)
    : selectedType.value === 'pharma_prohibited'
      ? undefined
      : selectedType.value || undefined

  const data = await store.searchIngredientsDb({
    page: currentPage.value,
    limit: PAGE_SIZE,
    type,
    search: searchQuery.value || undefined,
  })
  if (data) {
    let rows = data.items || []
    // pharma_prohibited 필터
    if (!showPharma.value) {
      rows = rows.filter(r => r.ingredient_type !== 'pharma_prohibited')
    }
    // 규제 상태 필터 (클라이언트)
    if (selectedRegStatus.value) {
      rows = rows.filter(r =>
        r.regulation_status_kr === selectedRegStatus.value ||
        r.regulation_status_eu === selectedRegStatus.value
      )
    }
    items.value = rows
    totalCount.value = data.total || 0
  }
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  currentPage.value = page
  loadIngredients()
  // 스크롤 최상단
  document.querySelector('.table-wrap')?.scrollTo(0, 0)
}

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadIngredients()
    selectedItem.value = null
    detailData.value = null
  }, 300)
}

function onFilterChange() {
  currentPage.value = 1
  loadIngredients()
  selectedItem.value = null
  detailData.value = null
}

function clearSearch() {
  searchQuery.value = ''
  currentPage.value = 1
  loadIngredients()
  selectedItem.value = null
  detailData.value = null
}

async function selectItem(item) {
  selectedItem.value = item
  detailData.value = null
  if (!item.id) return
  detailLoading.value = true
  try {
    const data = await store.getIngredientDetailFull(item.id)
    detailData.value = data
  } catch (e) {
    console.error('[IngredientDb] detail load failed:', e)
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  selectedItem.value = null
  detailData.value = null
}

// 폴백 뷰용: selectedItem에서 국가별 규제 상태 반환
function fallbackRegStatus(code) {
  if (!selectedItem.value) return null
  if (code === 'KR') return selectedItem.value.regulation_status_kr || null
  if (code === 'EU') return selectedItem.value.regulation_status_eu || null
  return null
}

// 국가별 규제 카드 설정
const countryList = [
  { code: 'KR', flag: '🇰🇷', label: '한국' },
  { code: 'EU', flag: '🇪🇺', label: 'EU' },
  { code: 'US', flag: '🇺🇸', label: '미국' },
  { code: 'JP', flag: '🇯🇵', label: '일본' },
  { code: 'CN', flag: '🇨🇳', label: '중국' },
]

// 규제 국가 국기 (레거시 호환)
function countryFlag(country) {
  if (country === 'KR') return '🇰🇷'
  if (country === 'EU') return '🇪🇺'
  if (country === 'US') return '🇺🇸'
  if (country === 'JP') return '🇯🇵'
  if (country === 'CN') return '🇨🇳'
  return '🌐'
}

// 규제 상태 칩 클래스
function regChipClass(status) {
  if (!status) return 'chip-gray'
  const s = status.toLowerCase()
  if (s === 'prohibited' || s === 'banned' || s === '금지') return 'chip-red'
  if (s === 'restricted' || s === '제한') return 'chip-amber'
  if (s === 'allowed' || s === '허용') return 'chip-green'
  return 'chip-gray'
}

// 규제 상태 아이콘
function regStatusIcon(status) {
  if (!status) return '📭'
  const s = status.toLowerCase()
  if (s === 'prohibited' || s === 'banned' || s === '금지') return '❌'
  if (s === 'restricted' || s === '제한') return '⚠️'
  if (s === 'allowed' || s === '허용') return '✅'
  return '📋'
}

// 배합 가이드 role 클래스
function formRoleClass(role) {
  if (role === 'REQUIRED') return 'role-required'
  if (role === 'RECOMMENDED') return 'role-recommended'
  if (role === 'ALLOWED') return 'role-allowed'
  if (role === 'FORBIDDEN') return 'role-forbidden'
  return 'role-default'
}

// 배합 가이드 role 한글 라벨
function formRoleLabel(role) {
  if (role === 'REQUIRED') return '필수'
  if (role === 'RECOMMENDED') return '권장'
  if (role === 'FORBIDDEN') return '금지'
  if (role === 'ALLOWED') return '허용'
  return role
}

// 규제 비고 텍스트 더보기 토글
const expandedMap = ref({})
function isExpanded(key) { return !!expandedMap.value[key] }
function toggleExpand(key) { expandedMap.value = { ...expandedMap.value, [key]: !expandedMap.value[key] } }

// AI 안정성 데이터 수집 요청 (스텁)
function requestStabilityData(data) {
  alert(`🔬 안정성 데이터 수집 요청: ${data.inci_name}\n(기능 준비 중)`)
}

// EWG 등급 CSS 클래스
function funcList(functionInci) {
  if (!functionInci) return []
  return functionInci.split(',').map(s => s.trim()).filter(Boolean)
}

function ewgClass(score) {
  const n = Number(score)
  if (n <= 2) return 'ewg-green'
  if (n <= 6) return 'ewg-amber'
  return 'ewg-red'
}

// EWG 설명 텍스트
function ewgDesc(score) {
  const n = Number(score)
  if (n <= 2) return '안전'
  if (n <= 6) return '보통'
  return '위험'
}

// 규제 상태 배지 클래스 (prohibited/restricted/allowed/unknown 및 한글 동시 처리)
function regStatusBadgeClass(status) {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s === 'prohibited' || s === '금지') return 'badge-red'
  if (s === 'restricted' || s === '제한') return 'badge-amber'
  if (s === 'allowed' || s === '허용') return 'badge-green'
  if (s === 'unknown' || s === '미확인') return 'badge-gray'
  return ''
}

// 규제 상태 한글 라벨
function regStatusLabel(status) {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s === 'prohibited' || s === '금지') return '금지'
  if (s === 'restricted' || s === '제한') return '제한'
  if (s === 'allowed' || s === '허용') return '허용'
  if (s === 'unknown' || s === '미확인') return '미확인'
  return status
}

// 규제 상태 칩 (레거시 호환)
function regStatusClass(status) {
  if (status === 'banned' || status === 'prohibited') return 'status-banned'
  if (status === 'restricted') return 'status-restricted'
  if (status === 'allowed') return 'status-allowed'
  return ''
}

function validPh(val) {
  const n = parseFloat(val)
  return !isNaN(n) && n >= 0 && n <= 14
}

function ingredientTypeLabel(type) {
  if (!type) return null
  const map = {
    // 소문자 44-type 분류
    emollient_ester: '에몰리언트', surfactant: '계면활성제', emulsifier: '유화제',
    peptide: '펩타이드', colorant: '색소', humectant_active: '보습/활성',
    thickener: '점증제', antioxidant: '산화방지제', preservative: '방부제',
    polymer_film_former: '폴리머', chelator_ph: 'pH조절제', biomimetic_active: '바이오미메틱',
    hydrolyzed_protein: '가수분해단백', uv_filter: '자외선차단제', plant_oil: '식물유',
    mineral_inorganic: '무기물', solvent: '용매', amino_acid: '아미노산',
    fragrance: '향료', silicone: '실리콘', extract: '추출물', vitamin: '비타민',
    hair_colorant: '모발색소', propellant: '추진제', wax: '왁스',
    protein: '단백질', botanical_water: '식물수', ferment: '발효물',
    carrier_oil: '캐리어오일', essential_oil: '에센셜오일', clay: '클레이',
    exfoliant: '각질제거', film_former: '피막제', opacifier: '불투명제',
    plasticizer: '가소제', oral_care: '구강케어', sunscreen_booster: '선스크린보조',
    single: '미분류', ACTIVE: '활성성분', pharma_prohibited: '금지물질',
    // 대문자 레거시
    EMOLLIENT: '에몰리언트', HUMECTANT: '보습제', EMULSIFIER: '유화제',
    SURFACTANT: '계면활성제', PRESERVATIVE: '방부제', PH_ADJUSTER: 'pH조절제',
    UV_FILTER_ORGANIC: '유기자차', UV_FILTER_INORGANIC: '무기자차',
    COLORANT: '착색제', FRAGRANCE: '향료', THICKENER: '점증제',
    ANTIOXIDANT: '산화방지제', SOLVENT: '용매', OTHER: '기타',
  }
  return map[type] || type
}

// 최대 농도 첫 번째 퍼센트 범위만 추출 (테이블 셀용)
function truncateConc(val) {
  if (!val) return null
  const m = val.match(/[\d.]+[-~]?[\d.]*%/)
  if (m) return m[0]
  return val.length > 10 ? val.slice(0, 10) + '…' : val
}

// 규제 데이터 유무 확인
const hasRegData = computed(() => {
  const regs = detailData.value?.regulations
  if (!regs) return false
  return Object.values(regs).some(entries => Array.isArray(entries) && entries.length > 0)
})

// 상세 패널용 최대 농도 전체 텍스트
const detailMaxConc = computed(() => {
  const regs = detailData.value?.regulations || {}
  for (const country of ['KR', 'EU', 'US']) {
    const entries = regs[country]
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (e.max_concentration) return e.max_concentration
      }
    }
  }
  return null
})

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function addToFormula(data) {
  const inci = data.inci_name || selectedItem.value?.inci_name || ''
  if (!inci) return
  closeDetail()
  router.push({ path: '/formulas/new', query: { addIngredient: inci } })
}
</script>

<style scoped>
/* ─── 페이지 레이아웃 ─── */
.ingredient-db-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.error-banner {
  padding: 10px 14px;
  border: 1px solid #e8b8b8;
  border-radius: 8px;
  background: var(--red-bg);
  color: var(--red);
  font-size: 12px;
  line-height: 1.5;
}

/* ─── 필터 바 ─── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-select {
  padding: 6px 10px;
  font-size: 12px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  outline: none;
  cursor: pointer;
  min-width: 120px;
}
.filter-select:focus { border-color: var(--accent); }

.pharma-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-sub);
  cursor: pointer;
  user-select: none;
}
.pharma-toggle input { cursor: pointer; }

/* ─── 검색바 ─── */
.search-bar-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.search-bar {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 14px;
  box-shadow: var(--shadow);
  transition: border-color 0.15s;
}
.search-bar:focus-within {
  border-color: var(--accent);
}
.search-icon {
  font-size: 14px;
  color: var(--text-dim);
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--text);
  background: transparent;
  font-family: var(--font-mono);
}
.search-input::placeholder {
  color: var(--text-dim);
  font-family: var(--font-family);
}
.search-clear {
  font-size: 11px;
  color: var(--text-dim);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}
.search-clear:hover { color: var(--text); }

.search-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.meta-count {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-sub);
}

/* ─── 메인 레이아웃 ─── */
.main-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

/* ─── 목록 패널 ─── */
.list-panel {
  min-width: 0;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

/* ─── 테이블 ─── */
.table-wrap {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
  table-layout: fixed;
}
.data-table th {
  background: var(--bg);
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dim);
  padding: 9px 14px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.data-table td {
  padding: 10px 14px;
  font-size: 12.5px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.data-table tbody tr:last-child td {
  border-bottom: none;
}
.data-row {
  cursor: pointer;
  transition: background 0.1s;
}
.data-row:hover { background: var(--bg); }
.data-row.selected {
  background: var(--accent-light);
}

.col-inci  { width: 220px; max-width: 220px; }
.col-kr    { width: 150px; max-width: 150px; }
.col-cas   { width: 100px; max-width: 100px; }
.col-type  { width: 90px; }
.col-func  { width: 240px; max-width: 240px; }
.col-ewg   { width: 55px; text-align: center; }
.col-reg   { width: 160px; }

.cell-inci {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-kr {
  font-size: 12.5px;
  color: var(--text-sub);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-cas {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cas-link {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  text-decoration: none;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cas-link:hover {
  text-decoration: underline;
  color: var(--accent);
}
.cell-ewg { text-align: center; }
.cell-type { }
.cell-ph, .cell-usage {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-sub);
  white-space: nowrap;
}
.cell-conc {
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
}
.conc-short {
  display: inline-block;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-empty {
  color: var(--text-dim);
  font-size: 12px;
}
.mono-text {
  font-family: var(--font-mono);
  font-size: 12px;
}

/* ─── 타입 칩 ─── */
.type-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  white-space: nowrap;
}

.cell-func {
  vertical-align: middle;
  max-width: 240px;
  overflow: hidden;
}
.func-cell-wrap {
  display: flex;
  flex-wrap: nowrap;
  gap: 3px;
  overflow: hidden;
  max-width: 100%;
}
.func-tags-wrap { display: flex; flex-wrap: wrap; gap: 3px; }
.func-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  background: rgba(58,144,104,0.10);
  color: var(--green);
  white-space: nowrap;
}
.func-more {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  background: var(--border);
  color: var(--text-dim);
}

/* pharma_prohibited 행 강조 */
.row-pharma td:first-child {
  border-left: 2px solid var(--red);
}

/* ─── EWG 칩 ─── */
.ewg-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
}
.ewg-green { background: var(--green-bg); color: var(--green); border-color: #b8dece; }
.ewg-amber { background: var(--amber-bg); color: var(--amber); border-color: #e8d4a0; }
.ewg-red   { background: var(--red-bg);   color: var(--red);   border-color: #e8b8b8; }

/* ─── 규제 배지 ─── */
.reg-badges {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}
.reg-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.5px;
  border: 1px solid transparent;
}
.badge-green { background: var(--green-bg); color: var(--green); border-color: #b8dece; }
.badge-amber { background: var(--amber-bg); color: var(--amber); border-color: #e8d4a0; }
.badge-red   { background: var(--red-bg);   color: var(--red);   border-color: #e8b8b8; }
.badge-gray  { background: var(--border);   color: var(--text-dim); border-color: var(--border); }

/* ─── 스켈레톤 로딩 ─── */
.skeleton-row {
  height: 18px;
  background: linear-gradient(90deg, var(--bg) 25%, var(--border) 50%, var(--bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 4px;
  margin: 4px 0;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── 빈 상태 ─── */
.empty-cell { padding: 40px 16px; }
.empty-state { text-align: center; }
.empty-icon { font-size: 28px; color: var(--text-dim); margin-bottom: 8px; }
.empty-title { font-size: 14px; font-weight: 600; color: var(--text-sub); margin-bottom: 4px; }
.empty-sub { font-size: 12px; color: var(--text-dim); }

/* ─── 페이지네이션 ─── */
.pagination-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-sub);
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.page-btn:hover:not(:disabled):not(.active) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}
.page-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.page-info {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  margin-left: 8px;
}

/* ─── 규제 상태 칩 ─── */
.reg-status-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
}
.status-banned { background: var(--red-bg); color: var(--red); }
.status-restricted { background: var(--amber-bg); color: var(--amber); }
.status-allowed { background: var(--green-bg); color: var(--green); }

/* ─── 상세 패널 트랜지션 ─── */
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

/* ─── 상세 패널 내용 ─── */
.detail-panel {
  min-width: 0;
  position: sticky;
  top: 0;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.detail-card {
  height: 100%;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 1;
}
.detail-header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.btn-close {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.btn-close:hover {
  border-color: var(--red);
  color: var(--red);
  background: var(--red-bg);
}

/* ─── 상세 본문 ─── */
.detail-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  color: var(--text-sub);
  font-size: 13px;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.detail-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-name-block {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.detail-inci {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
  word-break: break-word;
}
.detail-kr {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-sub);
  margin-top: 3px;
}
.detail-cas {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 3px;
}

.detail-ewg-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ewg-score-display {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  width: fit-content;
}
.ewg-score-display.ewg-green { background: var(--green-bg); border-color: #b8dece; }
.ewg-score-display.ewg-amber { background: var(--amber-bg); border-color: #e8d4a0; }
.ewg-score-display.ewg-red   { background: var(--red-bg);   border-color: #e8b8b8; }

.ewg-number {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.ewg-score-display.ewg-green .ewg-number { color: var(--green); }
.ewg-score-display.ewg-amber .ewg-number { color: var(--amber); }
.ewg-score-display.ewg-red   .ewg-number { color: var(--red); }

.ewg-desc {
  font-size: 12px;
  font-weight: 600;
}
.ewg-score-display.ewg-green .ewg-desc { color: var(--green); }
.ewg-score-display.ewg-amber .ewg-desc { color: var(--amber); }
.ewg-score-display.ewg-red   .ewg-desc { color: var(--red); }

/* ─── 새 상세 패널 섹션 카드 ─── */
.detail-section-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.dsc-title {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8b7355;
  padding: 6px 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

/* 규제 상태 행 */
.reg-country-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12.5px;
}
.reg-country-row:last-child { border-bottom: none; }
.country-flag { font-size: 14px; flex-shrink: 0; line-height: 1.4; }
.country-name {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  min-width: 24px;
  line-height: 1.6;
  flex-shrink: 0;
}
.reg-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
  flex-wrap: wrap;
}
.reg-status-chip.chip-green { background: var(--green-bg); color: var(--green); border-color: #b8dece; }
.reg-status-chip.chip-amber { background: var(--amber-bg); color: var(--amber); border-color: #e8d4a0; }
.reg-status-chip.chip-red   { background: var(--red-bg);   color: var(--red);   border-color: #e8b8b8; }
.reg-status-chip.chip-gray  { background: var(--bg); color: var(--text-sub); border-color: var(--border); }
.reg-conc-inline { font-family: var(--font-mono); font-weight: 400; font-size: 10px; }
.reg-no-data {
  font-size: 11px;
  color: var(--text-dim);
  font-style: italic;
}

/* 빈 섹션 */
.empty-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  flex-wrap: wrap;
}
.empty-icon { font-size: 14px; }
.empty-text { font-size: 12px; color: var(--text-dim); font-style: italic; }
.btn-ai-request {
  margin-left: auto;
  padding: 3px 10px;
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-ai-request:hover { background: var(--accent); color: white; }

/* 배합 가이드 행 */
.formulation-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.formulation-row:last-child { border-bottom: none; }
.form-role-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  flex-shrink: 0;
}
.role-required   { background: var(--green-bg);  color: var(--green);  border: 1px solid #b8dece; }
.role-recommended{ background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent-dim); }
.role-allowed    { background: var(--bg); color: var(--text-sub); border: 1px solid var(--border); }
.role-forbidden  { background: var(--red-bg); color: var(--red); border: 1px solid #e8b8b8; }
.role-default    { background: var(--bg); color: var(--text-dim); border: 1px solid var(--border); }
.form-purpose { font-weight: 600; color: var(--text); }
.form-pct { font-family: var(--font-mono); color: var(--accent); font-size: 11px; }
.form-reason { color: var(--text-sub); font-size: 11px; width: 100%; padding-left: 0; }

/* 호환성 행 */
.compat-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.compat-row:last-child { border-bottom: none; }
.compat-icon { font-size: 14px; flex-shrink: 0; }
.compat-partner { font-weight: 600; color: var(--text); font-size: 11px; }
.compat-reason { color: var(--text-sub); font-size: 11px; width: 100%; }

/* EWG 인라인 */
.ewg-inline {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}
.ewg-inline.ewg-green { background: var(--green-bg); color: var(--green); border-color: #b8dece; }
.ewg-inline.ewg-amber { background: var(--amber-bg); color: var(--amber); border-color: #e8d4a0; }
.ewg-inline.ewg-red   { background: var(--red-bg);   color: var(--red);   border-color: #e8b8b8; }

/* 푸터 */
.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 4px 2px;
  gap: 8px;
  flex-wrap: wrap;
}
.footer-source, .footer-date {
  font-size: 10px;
  color: var(--text-dim);
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.detail-value {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
  word-break: break-word;
}
.value-empty {
  color: var(--text-dim);
  font-style: italic;
  font-size: 12px;
}
.concentration-val {
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
}
.safety-note {
  font-size: 12.5px;
  color: var(--text-sub);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  line-height: 1.6;
}
.small-text {
  font-size: 11px;
  color: var(--text-dim);
}

/* ─── 관련 규제 목록 ─── */
.regulations-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.regulation-item {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.reg-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.reg-source-badge {
  display: inline-flex;
  padding: 2px 7px;
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  border-radius: 3px;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.reg-inci {
  font-size: 11px;
  color: var(--text-sub);
  word-break: break-word;
}
.reg-restriction {
  font-size: 12px;
  color: var(--text);
  line-height: 1.4;
}
.reg-max-conc {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

/* ─── detail props grid ─── */
.detail-props-grid {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 4px 12px;
  font-size: 12.5px;
}
.prop-label {
  color: var(--text-dim);
  font-size: 11px;
  display: flex;
  align-items: center;
}
.prop-val {
  color: var(--text);
}

/* ─── section-label 공통 ─── */
.section-label {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
}

/* ─── 반응형 ─── */
@media (max-width: 800px) {
  .col-cas, .cell-cas { display: none; }
}
@media (max-width: 700px) {
  .col-type, .cell-type { display: none; }
}
@media (max-width: 600px) {
  .search-bar-wrap { flex-direction: column; align-items: stretch; }
  .search-meta { justify-content: flex-end; }
  .filter-bar { flex-direction: column; align-items: stretch; }
}

/* 최대 농도 전체 텍스트 (상세 패널) */
.detail-conc-full {
  padding: 10px 12px;
  font-size: 12.5px;
  color: var(--text);
  line-height: 1.6;
  word-break: break-word;
}

/* 데이터 없음 노트 (컴팩트 모드) */
.detail-no-data-note {
  font-size: 12px;
  color: var(--text-dim);
  font-style: italic;
  padding: 2px 4px;
  text-align: center;
}

/* ─── 국가별 규제 카드 ─── */
.country-reg-card {
  border-bottom: 1px solid var(--border);
}
.country-reg-card:last-child { border-bottom: none; }

.crc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg);
  flex-wrap: wrap;
}
.country-reg-has-data .crc-header {
  background: transparent;
}
.crc-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-sub);
  min-width: 32px;
  flex-shrink: 0;
}
.crc-no-data {
  font-size: 11px;
  color: var(--text-dim);
  font-style: italic;
}

.crc-body {
  padding: 6px 12px 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.crc-body-divider {
  border-top: 1px dashed var(--border);
  padding-top: 8px;
  margin-top: 2px;
}
.crc-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
}
.crc-row-note { align-items: flex-start; }
.crc-row-source {
  margin-top: 2px;
}
.crc-label {
  flex-shrink: 0;
  width: 60px;
  font-size: 10px;
  color: var(--text-dim);
  padding-top: 1px;
}
.crc-val {
  color: var(--text);
  flex: 1;
  word-break: break-word;
  line-height: 1.5;
}
.crc-note-text {
  font-size: 11.5px;
  color: var(--text-sub);
  line-height: 1.6;
}
.crc-source-badge {
  display: inline-block;
  padding: 1px 6px;
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid var(--accent-dim);
  border-radius: 3px;
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.3px;
}

/* 더보기 텍스트 클램프 */
.text-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.crc-note-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}
.btn-expand {
  align-self: flex-start;
  padding: 1px 7px;
  font-size: 10px;
  color: var(--accent);
  background: transparent;
  border: 1px solid var(--accent-dim);
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.8;
}
.btn-expand:hover { background: var(--accent-light); }

/* EU 최대 농도 행 */
.fg-eu-conc { background: var(--bg); border-top: 1px dashed var(--border); }
.role-eu {
  background: #f0f4ff;
  color: #4466bb;
  border: 1px solid #c8d8f0;
  font-family: var(--font-mono);
  font-size: 9px;
}

/* ─── 성분 상세 모달 ─── */
.ing-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ing-modal {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.20);
  max-width: 700px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ing-modal-hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid #ece6d8;
  background: #faf8f4;
  flex-shrink: 0;
  gap: 12px;
}
.ing-modal-title-wrap { flex: 1; min-width: 0; }
.ing-modal-inci {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
  word-break: break-word;
}
.ing-modal-kr { font-size: 14px; color: var(--text-sub); margin-top: 3px; }
.ing-modal-cas { font-size: 11px; color: var(--text-dim); margin-top: 3px; }
.ing-modal-close {
  width: 28px;
  height: 28px;
  border: 1px solid #ece6d8;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.ing-modal-close:hover { border-color: var(--red); color: var(--red); background: var(--red-bg); }
.ing-modal-body {
  overflow-y: auto;
  padding: 14px 16px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ing-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-sub);
  font-size: 13px;
}

/* ─── 5개국 규제 카드 2열 그리드 ─── */
.ing-reg-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.ing-country-card {
  background: #faf8f4;
  border: 1px solid #ece6d8;
  border-radius: 8px;
  overflow: hidden;
}
.icc-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  background: #f2ede4;
  border-bottom: 1px solid #ece6d8;
  flex-wrap: wrap;
}
.icc-name { font-size: 12px; font-weight: 700; color: var(--text-sub); min-width: 28px; }
.icc-nodata { font-size: 11px; color: var(--text-dim); font-style: italic; }
.icc-body { padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
.icc-divider { border-top: 1px dashed #ece6d8; padding-top: 8px; margin-top: 2px; }
.icc-row { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; }
.icc-label { flex-shrink: 0; width: 54px; font-size: 10px; color: var(--text-dim); padding-top: 1px; }
.icc-val { color: var(--text); flex: 1; word-break: break-word; line-height: 1.5; font-size: 12px; }
.icc-note-group { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.icc-note-text { font-size: 11px; color: var(--text-sub); line-height: 1.5; }
.icc-source-row { margin-top: 2px; }

/* ─── 배합 가이드 카드 ─── */
.icc-guide-list { padding: 0; }
.icc-guide-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  flex-wrap: wrap;
  padding: 6px 12px;
  border-bottom: 1px solid #ece6d8;
  font-size: 12px;
}
.icc-guide-row:last-child { border-bottom: none; }
.icc-guide-purpose { font-weight: 600; color: var(--text); flex: 1; }
.icc-guide-pct { font-family: var(--font-mono); color: var(--accent); font-size: 11px; }
.icc-guide-reason { color: var(--text-sub); font-size: 11px; width: 100%; }

/* ─── 호환성 섹션 ─── */
.ing-compat-section {
  border: 1px solid #ece6d8;
  border-radius: 8px;
  overflow: hidden;
}
.ing-section-title {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8b7355;
  padding: 6px 12px;
  background: #f2ede4;
  border-bottom: 1px solid #ece6d8;
}
.ing-compat-list { padding: 4px 0; }

/* ─── 모달 푸터 ─── */
.ing-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #ece6d8;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-add-to-formula {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-add-to-formula:hover { opacity: 0.88; }

/* ─── 반응형 ─── */
@media (max-width: 600px) {
  .ing-reg-grid { grid-template-columns: 1fr; }
  .ing-modal { max-height: 90vh; }
  .ing-modal-overlay { padding: 12px; }
}
</style>
