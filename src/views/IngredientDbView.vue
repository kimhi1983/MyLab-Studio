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
    <div class="main-layout" :class="{ 'panel-open': selectedItem !== null }">
      <!-- 좌측: 목록 -->
      <div class="list-panel">
        <div class="panel">
          <!-- 테이블 헤더 -->
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-inci">INCI Name</th>
                  <th class="col-kr">한글명</th>
                  <th class="col-type">카테고리</th>
                  <th class="col-func">기능</th>
                  <th class="col-ewg">EWG</th>
                  <th class="col-ph">pH 범위</th>
                  <th class="col-usage">사용농도</th>
                  <th class="col-reg">규제 (KR/EU)</th>
                  <th class="col-conc">최대 농도</th>
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
                  <td class="cell-type">
                    <span v-if="item.ingredient_type" class="type-chip">{{ ingredientTypeLabel(item.ingredient_type) }}</span>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-func">
                    <template v-if="item.function_inci">
                      <span v-for="fn in funcList(item.function_inci).slice(0, 2)" :key="fn" class="func-tag">{{ fn }}</span>
                      <span v-if="funcList(item.function_inci).length > 2" class="func-more">+{{ funcList(item.function_inci).length - 2 }}</span>
                    </template>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-ewg">
                    <span v-if="item.ewg_score != null && item.ewg_score > 0" class="ewg-chip" :class="ewgClass(item.ewg_score)">
                      {{ item.ewg_score }}
                    </span>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-ph mono-text">
                    <span v-if="item.ph_min != null || item.ph_max != null">
                      {{ item.ph_min ?? '?' }} ~ {{ item.ph_max ?? '?' }}
                    </span>
                    <span v-else class="cell-empty">-</span>
                  </td>
                  <td class="cell-usage mono-text">
                    <span v-if="item.usage_level_min != null || item.usage_level_max != null">
                      {{ item.usage_level_min ?? '0' }}~{{ item.usage_level_max ?? '?' }}%
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
                  <td class="cell-conc">
                    <span v-if="item.max_concentration_kr || item.max_concentration_eu" class="mono-text">
                      {{ item.max_concentration_kr || item.max_concentration_eu }}
                    </span>
                    <span v-else class="cell-empty">-</span>
                  </td>
                </tr>
              </tbody>
              <tbody v-else-if="loading">
                <tr v-for="n in 8" :key="n">
                  <td colspan="8">
                    <div class="skeleton-row"></div>
                  </td>
                </tr>
              </tbody>
              <tbody v-else>
                <tr>
                  <td colspan="8" class="empty-cell">
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

      <!-- 우측: 상세 패널 -->
      <transition name="slide-panel">
        <div v-if="selectedItem !== null" class="detail-panel">
          <div class="panel detail-card">
            <!-- 닫기 버튼 -->
            <div class="detail-header">
              <div class="detail-header-info">
                <span class="section-label">INGREDIENT DETAIL</span>
              </div>
              <button class="btn-close" @click="closeDetail" title="닫기">✕</button>
            </div>

            <!-- 로딩 중 -->
            <div v-if="detailLoading" class="detail-loading">
              <div class="spinner"></div>
              <span>정보 불러오는 중...</span>
            </div>

            <!-- 상세 내용 -->
            <div v-else-if="detailData" class="detail-body">
              <!-- 원료명 -->
              <div class="detail-name-block">
                <div class="detail-inci">{{ detailData.inci_name || selectedItem.inci_name }}</div>
                <div class="detail-kr">{{ detailData.korean_name || selectedItem.korean_name || '-' }}</div>
              </div>

              <!-- 원료 유형 -->
              <div class="detail-section" v-if="ingredientTypeLabel(detailData.ingredient_type || selectedItem.ingredient_type)">
                <div class="section-label">원료 유형</div>
                <div class="detail-value">{{ ingredientTypeLabel(detailData.ingredient_type || selectedItem.ingredient_type) }}</div>
              </div>

              <!-- EWG 점수 -->
              <div class="detail-ewg-block" v-if="selectedItem.ewg_score != null && selectedItem.ewg_score > 0">
                <div class="ewg-score-label section-label">EWG 안전 등급</div>
                <div class="ewg-score-display" :class="ewgClass(selectedItem.ewg_score)">
                  <span class="ewg-number">{{ selectedItem.ewg_score }}</span>
                  <span class="ewg-desc">{{ ewgDesc(selectedItem.ewg_score) }}</span>
                </div>
              </div>

              <!-- 규제 정보 -->
              <div class="detail-section">
                <div class="section-label">KR 규제 정보</div>
                <div class="detail-value" :class="{ 'value-empty': !selectedItem.kr_regulation }">
                  {{ selectedItem.kr_regulation || '규제 정보 없음' }}
                </div>
              </div>

              <div class="detail-section">
                <div class="section-label">EU 규제 정보</div>
                <div class="detail-value" :class="{ 'value-empty': !selectedItem.eu_regulation }">
                  {{ selectedItem.eu_regulation || '규제 정보 없음' }}
                </div>
              </div>

              <!-- 물성 정보 -->
              <div class="detail-section" v-if="selectedItem.ph_min != null || selectedItem.ph_max != null || selectedItem.usage_level_min != null">
                <div class="section-label">물성</div>
                <div class="detail-props-grid">
                  <template v-if="selectedItem.ph_min != null || selectedItem.ph_max != null">
                    <span class="prop-label">pH 범위</span>
                    <span class="prop-val mono-text">{{ selectedItem.ph_min ?? '?' }} ~ {{ selectedItem.ph_max ?? '?' }}</span>
                  </template>
                  <template v-if="selectedItem.usage_level_min != null || selectedItem.usage_level_max != null">
                    <span class="prop-label">사용농도</span>
                    <span class="prop-val mono-text">{{ selectedItem.usage_level_min ?? 0 }} ~ {{ selectedItem.usage_level_max ?? '?' }}%</span>
                  </template>
                  <template v-if="selectedItem.comedogenic_rating != null">
                    <span class="prop-label">코메도제닉</span>
                    <span class="prop-val mono-text">{{ selectedItem.comedogenic_rating }} / 5</span>
                  </template>
                </div>
              </div>

              <!-- 기능 -->
              <div class="detail-section" v-if="selectedItem.function_inci">
                <div class="section-label">INCI 기능</div>
                <div class="func-tags-wrap">
                  <span v-for="fn in funcList(selectedItem.function_inci)" :key="fn" class="func-tag">{{ fn }}</span>
                </div>
              </div>

              <!-- 피부타입 -->
              <div class="detail-section" v-if="selectedItem.skin_type_suitability?.length">
                <div class="section-label">적합 피부타입</div>
                <div class="detail-value">{{ Array.isArray(selectedItem.skin_type_suitability) ? selectedItem.skin_type_suitability.join(', ') : selectedItem.skin_type_suitability }}</div>
              </div>

              <!-- 규제 정보 -->
              <div class="detail-section" v-if="selectedItem.regulation_status_kr || selectedItem.regulation_status_eu">
                <div class="section-label">규제 정보</div>
                <div class="detail-props-grid">
                  <template v-if="selectedItem.regulation_status_kr">
                    <span class="prop-label">한국 (KR)</span>
                    <span class="prop-val reg-badge" :class="regStatusBadgeClass(selectedItem.regulation_status_kr)">{{ regStatusLabel(selectedItem.regulation_status_kr) }}</span>
                  </template>
                  <template v-if="selectedItem.regulation_status_eu">
                    <span class="prop-label">유럽 (EU)</span>
                    <span class="prop-val reg-badge" :class="regStatusBadgeClass(selectedItem.regulation_status_eu)">{{ regStatusLabel(selectedItem.regulation_status_eu) }}</span>
                  </template>
                  <template v-if="selectedItem.max_concentration_kr">
                    <span class="prop-label">KR 최대 농도</span>
                    <span class="prop-val mono-text">{{ selectedItem.max_concentration_kr }}</span>
                  </template>
                  <template v-if="selectedItem.max_concentration_eu">
                    <span class="prop-label">EU 최대 농도</span>
                    <span class="prop-val mono-text">{{ selectedItem.max_concentration_eu }}</span>
                  </template>
                </div>
              </div>

              <!-- 안전 노트 -->
              <div class="detail-section" v-if="selectedItem.safety_notes">
                <div class="section-label">안전 노트</div>
                <div class="detail-value safety-note">{{ selectedItem.safety_notes }}</div>
              </div>

              <!-- 최종 갱신 -->
              <div class="detail-section" v-if="selectedItem.updated_at">
                <div class="section-label">데이터 갱신</div>
                <div class="detail-value mono-text small-text">{{ formatDate(selectedItem.updated_at) }}</div>
              </div>

              <!-- 관련 규제 목록 -->
              <div v-if="detailData.regulations && detailData.regulations.length" class="detail-section">
                <div class="section-label">관련 규제 목록</div>
                <div class="regulations-list">
                  <div
                    v-for="(reg, idx) in detailData.regulations"
                    :key="idx"
                    class="regulation-item"
                  >
                    <div class="reg-item-header">
                      <span class="reg-source-badge">{{ mapRegulationSource(reg.source) }}</span>
                      <span class="reg-inci mono-text">{{ reg.inci_name || reg.ingredient }}</span>
                    </div>
                    <div v-if="reg.restriction" class="reg-restriction">{{ reg.restriction }}</div>
                    <div v-if="reg.max_concentration" class="reg-max-conc">
                      <span class="section-label" style="font-size:10px;">최대 농도</span>
                      <span class="mono-text">{{ reg.max_concentration }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 상세 데이터 없을 때 목록 데이터로 표시 -->
            <div v-else class="detail-body">
              <div class="detail-name-block">
                <div class="detail-inci">{{ selectedItem.inci_name }}</div>
                <div class="detail-kr">{{ selectedItem.korean_name || '-' }}</div>
              </div>
              <div class="detail-section" v-if="ingredientTypeLabel(selectedItem.ingredient_type)">
                <div class="section-label">원료 유형</div>
                <div class="detail-value">{{ ingredientTypeLabel(selectedItem.ingredient_type) }}</div>
              </div>
              <div class="detail-section" v-if="selectedItem.ewg_score != null && selectedItem.ewg_score > 0">
                <div class="section-label">EWG 안전 등급</div>
                <div class="ewg-score-display" :class="ewgClass(selectedItem.ewg_score)">
                  <span class="ewg-number">{{ selectedItem.ewg_score }}</span>
                  <span class="ewg-desc">{{ ewgDesc(selectedItem.ewg_score) }}</span>
                </div>
              </div>
              <div class="detail-section">
                <div class="section-label">KR 규제 정보</div>
                <div class="detail-value" :class="{ 'value-empty': !selectedItem.kr_regulation }">
                  {{ selectedItem.kr_regulation || '규제 정보 없음' }}
                </div>
              </div>
              <div class="detail-section">
                <div class="section-label">EU 규제 정보</div>
                <div class="detail-value" :class="{ 'value-empty': !selectedItem.eu_regulation }">
                  {{ selectedItem.eu_regulation || '규제 정보 없음' }}
                </div>
              </div>
              <div class="detail-section" v-if="selectedItem.max_concentration">
                <div class="section-label">최대 허용 농도</div>
                <div class="detail-value mono-text concentration-val">{{ selectedItem.max_concentration }}</div>
              </div>
              <div class="detail-section" v-if="selectedItem.safety_notes">
                <div class="section-label">안전 노트</div>
                <div class="detail-value safety-note">{{ selectedItem.safety_notes }}</div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIngredientStore } from '../stores/ingredientStore.js'
import { mapRegulationSource } from '../utils/regulationSource.js'

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
    const data = await store.getIngredientDetail(item.id)
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

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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

/* ─── 메인 레이아웃 (좌우 분할) ─── */
.main-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  transition: grid-template-columns 0.25s ease;
}
.main-layout.panel-open {
  grid-template-columns: 70% 30%;
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
  min-width: 560px;
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

.col-inci  { width: 22%; }
.col-kr    { width: 14%; }
.col-type  { width: 9%; }
.col-func  { width: 14%; }
.col-ewg   { width: 6%; text-align: center; }
.col-ph    { width: 9%; }
.col-usage { width: 9%; }
.col-reg   { width: 16%; }
.col-conc  { width: 14%; }

.cell-inci {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
  word-break: break-word;
}
.cell-kr {
  font-size: 12.5px;
  color: var(--text-sub);
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

.cell-func { vertical-align: middle; }
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
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-name-block {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.detail-inci {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
  word-break: break-word;
}
.detail-kr {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-sub);
  margin-top: 4px;
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
@media (max-width: 1100px) {
  .main-layout.panel-open {
    grid-template-columns: 60% 40%;
  }
}

@media (max-width: 800px) {
  .main-layout.panel-open {
    grid-template-columns: 1fr;
  }
  .detail-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(380px, 100vw);
    max-height: 100vh;
    z-index: 100;
    box-shadow: -4px 0 24px rgba(0,0,0,0.12);
  }
  .detail-card {
    border-radius: 0;
    border-right: none;
  }
}

@media (max-width: 900px) {
  .col-ph, .cell-ph, .col-usage, .cell-usage { display: none; }
}
@media (max-width: 700px) {
  .col-type, .cell-type, .col-conc, .cell-conc { display: none; }
}
@media (max-width: 600px) {
  .search-bar-wrap { flex-direction: column; align-items: stretch; }
  .search-meta { justify-content: flex-end; }
  .filter-bar { flex-direction: column; align-items: stretch; }
}
</style>
