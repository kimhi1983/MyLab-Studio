<template>
  <div class="copy-formula-page">

    <!-- STEP 1: 제품 검색 -->
    <div class="step-card">
      <div class="step-badge">1</div>
      <div class="step-content">
        <div class="step-header">
          <h3 class="step-title">제품 검색</h3>
          <p class="step-desc">카피할 제품을 검색하세요. 브랜드명, 제품명으로 찾을 수 있습니다.</p>
        </div>

        <div class="search-wrap">
          <div class="search-box" :class="{ focused: searchFocused }">
            <svg class="search-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              class="search-input"
              placeholder="예: CeraVe, La Roche-Posay, 수분크림..."
              @input="onSearchInput"
              @focus="searchFocused = true"
              @blur="searchFocused = false"
              autocomplete="off"
            >
            <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''; searchResults = []">
              <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <!-- 초기 상태 안내 -->
        <div v-if="!searchQuery && !selectedProduct" class="search-hint">
          브랜드명 또는 제품명을 입력하세요
        </div>

        <!-- 검색 로딩 -->
        <div v-if="isSearching" class="search-loading">
          <span class="spinner-sm"></span>
          <span>검색 중...</span>
        </div>

        <!-- 검색 결과 없음 -->
        <div v-else-if="searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && !selectedProduct" class="search-empty">
          검색 결과가 없습니다. 다른 키워드로 검색해보세요.
        </div>

        <!-- 검색 결과 카드 그리드 -->
        <div v-else-if="searchResults.length > 0 && !selectedProduct" class="search-results-grid">
          <div
            v-for="prod in searchResults"
            :key="prod.id"
            class="result-card"
            @click="onSelectProduct(prod)"
          >
            <div class="rc-img-wrap">
              <img
                v-if="prod.image_url"
                :src="prod.image_url"
                :alt="prod.product_name"
                class="rc-img"
                @error="$event.target.style.display='none'"
              >
              <div v-else class="rc-img-placeholder">
                <span>{{ categoryEmoji(prod.category) }}</span>
              </div>
            </div>
            <div class="rc-body">
              <div class="rc-brand">{{ prod.brand_name }}</div>
              <div class="rc-name">{{ prod.product_name }}</div>
              <div class="rc-meta">
                <span v-if="prod.category" class="rc-tag-cat">{{ prod.category }}</span>
                <span v-if="prod.country_of_origin" class="rc-tag-country">{{ prod.country_of_origin }}</span>
              </div>
              <div v-if="prod.ingredient_count > 0" class="rc-count">전성분 {{ prod.ingredient_count }}개</div>
            </div>
          </div>
        </div>

        <!-- 선택된 제품 카드 -->
        <transition name="card-fade">
          <div v-if="selectedProduct" class="product-card">
            <div class="product-card-top">
              <div class="product-thumb">
                <img v-if="selectedProduct.image_url" :src="selectedProduct.image_url" :alt="selectedProduct.product_name" class="product-img">
                <div v-else class="product-initial" :style="{ background: getAvatarColor(selectedProduct.brand_name) }">
                  {{ getInitials(selectedProduct.brand_name) }}
                </div>
              </div>
              <div class="product-detail">
                <div class="product-brand">{{ selectedProduct.brand_name }}</div>
                <div class="product-name">{{ selectedProduct.product_name }}</div>
                <div class="product-chips">
                  <span v-if="selectedProduct.category" class="chip chip-gold">{{ selectedProduct.category }}</span>
                  <span v-if="selectedProduct.product_type" class="chip">{{ selectedProduct.product_type }}</span>
                  <span v-if="selectedProduct.data_quality_grade" class="chip chip-grade" :class="'g-' + selectedProduct.data_quality_grade">
                    {{ selectedProduct.data_quality_grade }}등급
                  </span>
                </div>
                <div class="product-tags">
                  <span v-if="selectedProduct.ph_value" class="ptag">pH {{ selectedProduct.ph_value }}</span>
                  <span v-if="selectedProduct.country_of_origin" class="ptag">원산지: {{ selectedProduct.country_of_origin }}</span>
                  <span v-if="selectedProduct.target_skin_type" class="ptag">{{ selectedProduct.target_skin_type }}</span>
                </div>
              </div>
              <button class="btn-remove" @click="clearProduct" title="선택 해제">
                <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
            </div>

            <!-- 전성분 -->
            <div v-if="selectedProduct.full_ingredients" class="ingredients-box">
              <div class="ingredients-header">
                <span class="ingredients-label">전성분 ({{ ingredientCount }}개)</span>
              </div>
              <div class="ingredients-scroll">{{ selectedProduct.full_ingredients }}</div>
            </div>

            <!-- 전성분 없음 → 직접 입력 -->
            <div v-else class="ingredients-box no-inci-box">
              <div class="no-inci-warn">
                <svg viewBox="0 0 20 20" width="15" height="15" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M10 6v5M10 13.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                전성분 정보가 없는 제품입니다. 직접 입력하면 처방을 진행할 수 있습니다.
              </div>
              <textarea
                v-model="manualIngredients"
                class="manual-inci-input"
                placeholder="Water, Glycerin, Niacinamide, Butylene Glycol, ..."
                rows="3"
              ></textarea>
            </div>

            <!-- 카피 처방 진행 버튼 -->
            <div class="proceed-section">
              <button
                class="btn-proceed"
                :disabled="!selectedProduct.full_ingredients && !manualIngredients.trim()"
                @click="showStep2 = true"
              >
                이 제품으로 카피 처방 진행
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </transition>

        <div v-if="loadingProduct" class="loading-inline">
          <span class="spinner-sm"></span>
          <span>제품 정보 불러오는 중...</span>
        </div>
      </div>
    </div>

    <!-- STEP 2: 역처방 옵션 -->
    <div v-if="showStep2" class="step-card">
      <div class="step-badge">2</div>
      <div class="step-content">
        <div class="step-header">
          <h3 class="step-title">역처방 옵션</h3>
          <p class="step-desc">{{ selectedProduct ? '시장과 추가 요구사항을 설정하세요.' : '먼저 제품을 선택하세요.' }}</p>
        </div>

        <div class="options-grid">
          <div class="option-group">
            <label class="option-label">타겟 시장</label>
            <div class="market-btns">
              <button
                v-for="m in markets"
                :key="m.value"
                class="market-btn"
                :class="{ active: selectedMarket === m.value }"
                @click="selectedMarket = m.value"
                :disabled="!selectedProduct"
              >
                <span class="market-flag">{{ m.flag }}</span>
                <span class="market-name">{{ m.name }}</span>
                <span class="market-code">{{ m.value }}</span>
              </button>
            </div>
          </div>

          <div class="option-group">
            <label class="option-label">추가 요구사항 <span class="label-opt">(선택)</span></label>
            <textarea
              v-model="requirements"
              class="option-textarea"
              placeholder="예: 비건 성분으로 대체, 방부제 프리, 민감성 피부 최적화..."
              rows="2"
              :disabled="!selectedProduct"
            ></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- 생성 버튼 -->
    <div v-if="showStep2" class="generate-section">
      <button
        class="btn-generate"
        :disabled="!selectedProduct || isGenerating"
        @click="onGenerate"
      >
        <template v-if="isGenerating">
          <span class="spinner-btn"></span>
          <span>{{ generateStep }}</span>
        </template>
        <template v-else>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
            <path d="M10 2l2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <span>카피 처방 생성하기</span>
        </template>
      </button>
    </div>

    <!-- STEP 3: 결과 — 3개 후보안 카드 -->
    <transition name="card-fade">
      <div v-if="generateResult" class="step-card step-result">
        <div class="step-badge step-badge-done">3</div>
        <div class="step-content">
          <div class="result-header">
            <div>
              <h3 class="step-title">역처방 후보안</h3>
              <p class="step-desc">
                시판 제품의 공개 정보를 기반으로 생성된 연구용 역설계 후보안입니다.
                <span v-if="elapsed" class="elapsed-badge">{{ elapsed }}s</span>
              </p>
            </div>
            <button class="btn-regen" @click="onGenerate" :disabled="isGenerating">
              <svg viewBox="0 0 18 18" width="14" height="14" fill="none">
                <path d="M1 9A8 8 0 1 0 3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                <path d="M1 3.5V9h5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              재생성
            </button>
          </div>

          <!-- 분석 요약 (있는 경우) -->
          <div v-if="generateResult.analysis?.key_purposes?.length" class="analysis-row">
            <span class="analysis-label">핵심 목적</span>
            <span v-for="p in generateResult.analysis.key_purposes" :key="p" class="analysis-tag">{{ p }}</span>
            <span v-if="generateResult.analysis.detected_type" class="analysis-type">{{ generateResult.analysis.detected_type }}</span>
          </div>

          <!-- 3열 후보안 카드 -->
          <div class="candidates-grid">
            <div
              v-for="(cand, idx) in generateResult.candidates"
              :key="idx"
              class="cand-card"
              :class="{ 'cand-selected': selectedCandIdx === idx, 'cand-recommended': cand.recommended }"
              @click="selectedCandIdx = idx"
            >
              <div v-if="cand.recommended" class="cand-rec-badge">추천</div>
              <div class="cand-label">{{ cand.label }}</div>
              <div class="cand-score-row">
                <span class="cand-score" :class="scoreClass(cand.score)">{{ cand.score ?? '—' }}</span>
                <span class="cand-score-max">/100</span>
              </div>
              <div class="cand-stats">
                <div class="cand-stat">
                  <span class="cand-stat-val">{{ cand.formula?.ingredients?.length ?? 0 }}</span>
                  <span class="cand-stat-key">성분</span>
                </div>
                <div class="cand-stat-sep"></div>
                <div class="cand-stat">
                  <span class="cand-stat-val">{{ cand.detected_type || cand.formula?.type || '—' }}</span>
                  <span class="cand-stat-key">제형</span>
                </div>
              </div>
              <div class="cand-select-indicator">
                <span v-if="selectedCandIdx === idx">✓ 선택됨</span>
                <span v-else>클릭하여 보기</span>
              </div>
            </div>
          </div>

          <!-- 선택된 후보안 상세 -->
          <div v-if="selectedCandIdx !== null && generateResult.candidates[selectedCandIdx]" class="cand-detail">
            <div class="cand-detail-header">
              <span class="cand-detail-title">{{ generateResult.candidates[selectedCandIdx].label }}</span>
              <span v-if="generateResult.candidates[selectedCandIdx].retried" class="retried-badge">재검증 완료</span>
            </div>

            <!-- 성분표 -->
            <div class="detail-table-wrap">
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Phase</th>
                    <th>원료명</th>
                    <th>INCI Name</th>
                    <th>wt%</th>
                    <th>기능</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(ing, i) in generateResult.candidates[selectedCandIdx].formula?.ingredients" :key="i">
                    <td class="td-num">{{ i + 1 }}</td>
                    <td><span class="phase-badge">{{ ing.phase || 'A' }}</span></td>
                    <td>{{ ing.name || '—' }}</td>
                    <td class="td-inci">{{ ing.inci_name || '—' }}</td>
                    <td class="td-pct">{{ ing.percentage != null ? ing.percentage : '—' }}</td>
                    <td class="td-fn">{{ ing.function || '—' }}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="4" class="td-total-label">합계</td>
                    <td class="td-pct">{{ calcTotal(generateResult.candidates[selectedCandIdx].formula?.ingredients) }}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 공정 메모 -->
            <div v-if="generateResult.candidates[selectedCandIdx].formula?.notes || generateResult.candidates[selectedCandIdx].process_text" class="process-box">
              <div class="process-label">공정 메모</div>
              <div class="process-text">{{ generateResult.candidates[selectedCandIdx].formula?.notes || generateResult.candidates[selectedCandIdx].process_text }}</div>
            </div>

            <!-- 원가 분석 -->
            <CostAnalysisCard
              v-if="generateResult.candidates[selectedCandIdx].formula?.ingredients?.length"
              :ingredients="generateResult.candidates[selectedCandIdx].formula.ingredients"
              style="margin-top: 16px"
            />

            <!-- 채택 버튼 -->
            <div class="adopt-section">
              <button class="btn-adopt" @click="onSaveFormula">
                <svg viewBox="0 0 18 18" width="15" height="15" fill="none">
                  <path d="M9 2v10M4 7l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M2 14h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                이 후보안 채택 → 처방 편집
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 에러 -->
    <transition name="card-fade">
      <div v-if="generateError" class="error-bar">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 6v5M10 13.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>{{ generateError }}</span>
        <button class="error-close" @click="generateError = ''">
          <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useAPI } from '../composables/useAPI.js'
import CostAnalysisCard from '../components/CostAnalysisCard.vue'

const router = useRouter()
const route = useRoute()
const { addFormula } = useFormulaStore()
const api = useAPI()

// ── 검색 ──
const searchInputRef = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const searchFocused = ref(false)
let searchTimer = null

// ── 선택 ──
const selectedProduct = ref(null)
const loadingProduct = ref(false)
const ingredientsExpanded = ref(false)
const showStep2 = ref(false)
const manualIngredients = ref('')

// ── 옵션 ──
const markets = [
  { value: 'KR', name: '한국', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
  { value: 'EU', name: '유럽', flag: '\uD83C\uDDEA\uD83C\uDDFA' },
  { value: 'US', name: '미국', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { value: 'JP', name: '일본', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { value: 'CN', name: '중국', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
]
const selectedMarket = ref('KR')
const requirements = ref('')

// ── 생성 ──
const isGenerating = ref(false)
const generateStep = ref('')
const generateResult = ref(null)
const generateError = ref('')
const elapsed = ref(0)
const selectedCandIdx = ref(null)
let elapsedTimer = null

// ── computed ──
const ingredientCount = computed(() => {
  if (!selectedProduct.value?.full_ingredients) return 0
  return selectedProduct.value.full_ingredients.split(',').map(s => s.trim()).filter(Boolean).length
})

// ── 유틸 ──
const COLORS = ['#4a7c59','#6b5a7e','#5a7296','#8a6a4a','#5a8a7a','#7a5a6b','#6a8a5a','#5a6b8a','#8a5a7a','#7a8a5a']
function getAvatarColor(name = '') { return COLORS[name.charCodeAt(0) % COLORS.length] }
function getInitials(name = '') { return name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() }

function categoryEmoji(cat) {
  if (!cat) return '🧴'
  const c = cat.toLowerCase()
  if (c.includes('스킨') || c.includes('토너')) return '💧'
  if (c.includes('크림') || c.includes('로션')) return '🧴'
  if (c.includes('세럼') || c.includes('에센스') || c.includes('앰플')) return '💊'
  if (c.includes('클렌') || c.includes('폼') || c.includes('세정')) return '🫧'
  if (c.includes('선') || c.includes('자외선')) return '🌤'
  if (c.includes('마스크') || c.includes('팩')) return '🎭'
  if (c.includes('립') || c.includes('틴트')) return '💄'
  if (c.includes('파운데이션') || c.includes('쿠션') || c.includes('색조')) return '✨'
  if (c.includes('샴푸') || c.includes('헤어') || c.includes('모발')) return '💆'
  if (c.includes('바디')) return '🛁'
  return '🧪'
}

// ── 검색 로직 ──
function onSearchInput() {
  clearTimeout(searchTimer)
  if (searchQuery.value.length < 2) { searchResults.value = []; return }
  searchTimer = setTimeout(doSearch, 350)
}

async function doSearch() {
  if (searchQuery.value.length < 2) return
  isSearching.value = true
  try {
    const res = await api.fetchJSON(`/api/products/list?search=${encodeURIComponent(searchQuery.value)}&limit=12`)
    searchResults.value = res?.items || []
  } catch { searchResults.value = [] }
  finally { isSearching.value = false }
}

async function onSelectProduct(prod) {
  searchResults.value = []
  searchQuery.value = prod.product_name || ''
  showStep2.value = false
  manualIngredients.value = ''
  loadingProduct.value = true
  try {
    const detail = await api.fetchJSON(`/api/products/${prod.id}/detail`)
    selectedProduct.value = detail?.data || detail || prod
  } catch {
    try {
      const fallback = await api.getProduct(prod.id)
      selectedProduct.value = fallback?.data || fallback || prod
    } catch { selectedProduct.value = prod }
  }
  finally { loadingProduct.value = false; ingredientsExpanded.value = false }
}

function clearProduct() {
  selectedProduct.value = null
  searchQuery.value = ''
  searchResults.value = []
  generateResult.value = null
  generateError.value = ''
  ingredientsExpanded.value = false
  showStep2.value = false
  manualIngredients.value = ''
}

// ?productId=xxx 쿼리로 진입 시 자동 선택
onMounted(async () => {
  const pid = route.query.productId
  if (!pid) return
  loadingProduct.value = true
  try {
    const detail = await api.fetchJSON(`/api/products/${pid}/detail`)
    const prod = detail?.data || detail
    if (prod?.id) {
      selectedProduct.value = prod
      searchQuery.value = prod.product_name || ''
      showStep2.value = true
    }
  } catch { /* 조용히 실패 */ }
  finally { loadingProduct.value = false }
})

// ── 처방 생성 ──
async function onGenerate() {
  if (!selectedProduct.value || isGenerating.value) return
  generateError.value = ''
  generateResult.value = null
  selectedCandIdx.value = null
  isGenerating.value = true
  generateStep.value = '전성분 분석 중...'
  elapsed.value = 0
  elapsedTimer = setInterval(() => { elapsed.value++ }, 1000)

  const steps = [
    { delay: 3000,  msg: '성분 DB 조회 중...' },
    { delay: 8000,  msg: '규제 적합성 검토 중...' },
    { delay: 15000, msg: '배합비 역산 중...' },
    { delay: 30000, msg: '후보 A 처방 생성 중...' },
    { delay: 60000, msg: '후보 B 처방 생성 중...' },
    { delay: 90000, msg: '최적 조합 도출 중...' },
    { delay: 110000, msg: '안전성 검증 중...' },
  ]
  let idx = 0
  function tick() {
    if (idx < steps.length && isGenerating.value) {
      const s = steps[idx++]
      setTimeout(() => { if (isGenerating.value) { generateStep.value = s.msg; tick() } }, s.delay)
    }
  }
  tick()

  try {
    const res = await api.copyFormula({
      productId: selectedProduct.value.id,
      productName: selectedProduct.value.product_name,
      brandName: selectedProduct.value.brand_name,
      category: selectedProduct.value.category,
      fullIngredients: selectedProduct.value.full_ingredients || manualIngredients.value,
      market: selectedMarket.value,
      requirements: requirements.value,
    })
    if (res?.success && res.data?.candidates?.length) {
      generateResult.value = res.data
      // 추천 후보안 자동 선택
      const recIdx = res.data.candidates.findIndex(c => c.recommended)
      selectedCandIdx.value = recIdx >= 0 ? recIdx : 0
    } else if (res?.ingredients) {
      // 구 응답 포맷 호환
      generateResult.value = {
        candidates: [{ label: '처방 결과', formula: { ingredients: res.ingredients, notes: res.notes }, score: null, recommended: true }],
        analysis: null,
      }
      selectedCandIdx.value = 0
    } else {
      generateError.value = res?.error || '처방 생성에 실패했습니다.'
    }
  } catch (e) {
    generateError.value = e.message || '네트워크 오류가 발생했습니다.'
  } finally {
    isGenerating.value = false
    clearInterval(elapsedTimer)
  }
}

// ── 저장 ──
function onSaveFormula() {
  if (!generateResult.value || selectedCandIdx.value === null) return
  const prod = selectedProduct.value
  const cand = generateResult.value.candidates[selectedCandIdx.value]
  const raw = cand?.formula?.ingredients || []
  const ingredients = raw.map(ing => ({
    name: ing.name || ing.inci_name || '',
    inci_name: ing.inci_name || '',
    percentage: ing.percentage || 0,
    function: ing.function || '',
    phase: ing.phase || 'A',
    note: '',
  }))
  const candLabel = cand?.label ? ` [${cand.label}]` : ''
  const newFormula = addFormula({
    title: `[카피] ${prod?.product_name || '처방'} - ${selectedMarket.value}${candLabel}`,
    product_type: prod?.category || '',
    status: 'draft',
    tags: ['카피처방', selectedMarket.value],
    memo: `원본: ${prod?.brand_name || ''} ${prod?.product_name || ''}\n시장: ${selectedMarket.value}\n후보안: ${cand?.label || ''}\n${new Date().toLocaleString('ko-KR')}`,
    formula_data: {
      ingredients,
      notes: cand?.formula?.notes || cand?.process_text || '',
      total_percentage: ingredients.reduce((s, i) => s + (Number(i.percentage) || 0), 0),
    },
  })
  router.push('/formulas/' + newFormula.id)
}

// ── 유틸 ──
function calcTotal(ingredients) {
  if (!ingredients?.length) return '0.00'
  return (ingredients.reduce((s, i) => s + (Number(i.percentage) || 0), 0)).toFixed(2)
}

function scoreClass(score) {
  if (score == null) return ''
  if (score >= 95) return 'score-high'
  if (score >= 80) return 'score-mid'
  return 'score-low'
}
</script>

<style scoped>
.copy-formula-page {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ─── Step Card ─── */
.step-card {
  display: flex;
  gap: 16px;
  padding: 24px 0;
  border-bottom: 1px solid var(--border);
  position: relative;
}

.step-card:last-child { border-bottom: none; }

.step-result { border-bottom: none; padding-top: 8px; }

.step-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-badge-done {
  background: var(--green);
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-header {
  margin-bottom: 16px;
}

.step-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 4px;
}

.step-desc {
  font-size: 13px;
  color: var(--text-dim);
  margin: 0;
}

.step-disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* ─── Search ─── */
.search-wrap {
  margin-bottom: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 44px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-box.focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(184, 147, 90, 0.1);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--text);
  background: transparent;
  font-family: var(--font);
}

.search-input::placeholder { color: var(--text-dim); }

.search-clear {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim);
  padding: 2px;
  display: flex;
  border-radius: 4px;
}

.search-clear:hover { color: var(--text); background: var(--bg); }

/* ─── Search States ─── */
.search-hint {
  font-size: 13px;
  color: var(--text-dim);
  text-align: center;
  padding: 28px 0 12px;
}

.search-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim);
  padding: 20px 0 8px;
}

.search-empty {
  font-size: 13px;
  color: var(--text-dim);
  text-align: center;
  padding: 24px 0 12px;
}

/* ─── Search Result Grid ─── */
.search-results-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 4px;
}

.result-card {
  border: 1px solid #E8E0D4;
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s, transform 0.15s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.result-card:hover {
  border-color: #C8A96E;
  box-shadow: 0 4px 16px rgba(200,169,110,0.18);
  transform: translateY(-2px);
}

.rc-img-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #FAF8F4;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rc-img {
  width: 100%; height: 100%;
  object-fit: cover;
}

.rc-img-placeholder {
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FAF8F4, #F0EDE6);
  font-size: 36px;
}

.rc-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rc-brand {
  font-size: 10px;
  font-weight: 700;
  color: #C8A96E;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rc-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.rc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.rc-tag-cat {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 10px;
  background: #C8A96E;
  color: #fff;
}

.rc-tag-country {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 10px;
  background: #F0EDE8;
  color: #888;
}

.rc-count {
  font-size: 10px;
  color: var(--text-dim);
  margin-top: 2px;
}

/* ─── Product Card ─── */
.product-card {
  border: 1.5px solid var(--accent);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}

.product-card-top {
  display: flex;
  gap: 16px;
  padding: 16px;
  align-items: flex-start;
}

.product-thumb { flex-shrink: 0; }

.product-img {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid var(--border);
}

.product-initial {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
}

.product-detail { flex: 1; min-width: 0; }

.product-brand {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.product-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
  margin-bottom: 8px;
}

.product-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.chip {
  font-size: 11px;
  padding: 2px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-sub);
  font-weight: 500;
}

.chip-grade {
  font-weight: 700;
  border: none;
}

.chip-gold {
  background: #C8A96E;
  color: #fff;
  border-color: #C8A96E;
  font-weight: 600;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ptag {
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.btn-remove {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  color: var(--text-dim);
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn-remove:hover {
  color: var(--red);
  border-color: var(--red);
  background: var(--red-bg);
}

/* ─── Ingredients ─── */
.ingredients-box {
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  background: var(--bg);
}

.ingredients-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ingredients-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-expand {
  font-size: 11px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-expand:hover { text-decoration: underline; }

.btn-expand svg {
  transition: transform 0.2s;
}

.btn-expand svg.rotated {
  transform: rotate(180deg);
}

.ingredients-text {
  font-size: 12px;
  color: var(--text-sub);
  line-height: 1.7;
  font-family: var(--font-mono);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: all 0.3s;
}

.ingredients-text.expanded {
  display: block;
  -webkit-line-clamp: unset;
}

.ingredients-scroll {
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.7;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  background: #FAF8F5;
  border-radius: 8px;
  padding: 10px 12px;
  max-height: 150px;
  overflow-y: auto;
  word-break: break-word;
}

.no-inci-box { background: #FFFAF5; }

.no-inci-warn {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: #B87333;
  margin-bottom: 10px;
  line-height: 1.5;
}

.manual-inci-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  color: var(--text);
  background: var(--surface);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.manual-inci-input:focus { border-color: var(--accent); }

.proceed-section {
  border-top: 1px solid var(--border);
  padding: 14px 16px;
  display: flex;
  justify-content: flex-end;
  background: var(--surface);
}

.btn-proceed {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.btn-proceed:hover { background: #a87d4a; }
.btn-proceed:active { transform: scale(0.98); }
.btn-proceed:disabled { background: var(--border); cursor: not-allowed; color: var(--text-dim); }

/* ─── Loading ─── */
.loading-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-dim);
  padding: 8px 0;
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ─── Options ─── */
.options-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-sub);
}

.label-opt {
  font-weight: 400;
  color: var(--text-dim);
}

.market-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.market-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.15s;
  min-width: 110px;
}

.market-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-light);
}

.market-btn.active {
  border-color: var(--accent);
  background: var(--accent-light);
  box-shadow: 0 0 0 3px rgba(184, 147, 90, 0.1);
}

.market-btn:disabled {
  cursor: not-allowed;
}

.market-flag {
  font-size: 20px;
  line-height: 1;
}

.market-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.market-code {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.option-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  resize: vertical;
  font-family: var(--font);
  line-height: 1.5;
  transition: border-color 0.2s;
}

.option-textarea:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 3px rgba(184, 147, 90, 0.1);
}

.option-textarea:disabled {
  background: var(--bg);
}

/* ─── Generate Button ─── */
.generate-section {
  display: flex;
  justify-content: center;
  padding: 8px 0 24px;
}

.btn-generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 36px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 12px rgba(184, 147, 90, 0.3);
  min-width: 240px;
}

.btn-generate:hover:not(:disabled) {
  background: #a68350;
  box-shadow: 0 4px 16px rgba(184, 147, 90, 0.4);
  transform: translateY(-1px);
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.spinner-btn {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ─── Error ─── */
.error-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--red-bg);
  border: 1px solid #f5c6cb;
  border-radius: 10px;
  font-size: 13px;
  color: var(--red);
  margin-top: 8px;
}

.error-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--red);
  cursor: pointer;
  padding: 2px;
  display: flex;
}

/* ─── Dot Pulse ─── */
.dot-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1s ease-in-out infinite;
}

/* ─── Animations ─── */
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
}

.card-fade-enter-active { animation: cardIn 0.3s ease; }
.card-fade-leave-active { animation: cardIn 0.2s ease reverse; }
@keyframes cardIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ─── Result Header ─── */
.result-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.elapsed-badge {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 8px;
  border-radius: 8px;
  font-family: var(--font-mono);
}

.btn-regen {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
}
.btn-regen:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
.btn-regen:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Analysis Row ─── */
.analysis-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: 8px;
}

.analysis-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  margin-right: 4px;
}

.analysis-tag {
  font-size: 11px;
  padding: 2px 9px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 10px;
  font-weight: 500;
}

.analysis-type {
  font-size: 11px;
  padding: 2px 9px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-sub);
  border-radius: 10px;
  margin-left: auto;
  font-family: var(--font-mono);
}

/* ─── Candidates Grid ─── */
.candidates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.cand-card {
  position: relative;
  padding: 18px 16px 14px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cand-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 12px rgba(184,147,90,0.12);
}

.cand-card.cand-selected {
  border-color: var(--accent);
  background: var(--accent-light);
  box-shadow: 0 0 0 3px rgba(184,147,90,0.15);
}

.cand-card.cand-recommended {
  border-color: #C8A96E;
  border-width: 2px;
}

.cand-rec-badge {
  position: absolute;
  top: -1px;
  right: 12px;
  background: #C8A96E;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 0 0 8px 8px;
  letter-spacing: 0.5px;
}

.cand-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.3;
  margin-top: 6px;
}

.cand-score-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.cand-score {
  font-size: 28px;
  font-weight: 800;
  font-family: var(--font-mono);
  line-height: 1;
}

.cand-score.score-high { color: #2e7d32; }
.cand-score.score-mid  { color: #B8935A; }
.cand-score.score-low  { color: #c62828; }

.cand-score-max {
  font-size: 12px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.cand-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg);
  border-radius: 8px;
  padding: 8px 10px;
}

.cand-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.cand-stat-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.cand-stat-key {
  font-size: 10px;
  color: var(--text-dim);
}

.cand-stat-sep {
  width: 1px;
  height: 28px;
  background: var(--border);
}

.cand-select-indicator {
  font-size: 11px;
  text-align: center;
  color: var(--text-dim);
  font-weight: 500;
}

.cand-card.cand-selected .cand-select-indicator {
  color: var(--accent);
  font-weight: 600;
}

/* ─── Candidate Detail ─── */
.cand-detail {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}

.cand-detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.cand-detail-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.retried-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: #e8f5e9;
  color: #2e7d32;
  border-radius: 6px;
  font-weight: 600;
}

/* ─── Detail Table ─── */
.detail-table-wrap {
  overflow-x: auto;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.detail-table th {
  padding: 8px 10px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.detail-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.detail-table tr:last-child td { border-bottom: none; }
.detail-table tr:hover td { background: var(--bg); }

.td-num { color: var(--text-dim); font-size: 11px; text-align: center; width: 28px; }
.td-inci { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-sub); }
.td-pct { text-align: right; font-family: var(--font-mono); font-weight: 600; }
.td-fn { font-size: 11px; color: var(--text-sub); }
.td-total-label { text-align: right; font-weight: 600; color: var(--text-sub); }

.phase-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 700;
  font-family: var(--font-mono);
}

.total-row td {
  background: var(--accent-light) !important;
  font-weight: 700;
}

/* ─── Process Box ─── */
.process-box {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

.process-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-dim);
  font-family: var(--font-mono);
  margin-bottom: 6px;
}

.process-text {
  font-size: 12.5px;
  color: var(--text-sub);
  line-height: 1.7;
  white-space: pre-wrap;
}

/* ─── Adopt Button ─── */
.adopt-section {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  background: var(--surface);
}

.btn-adopt {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 24px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  box-shadow: 0 2px 10px rgba(184,147,90,0.25);
}

.btn-adopt:hover { background: #a87d4a; transform: translateY(-1px); }
.btn-adopt:active { transform: scale(0.98); }

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .candidates-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .step-card { flex-direction: column; gap: 12px; }
  .step-badge { align-self: flex-start; }
  .product-card-top { flex-direction: column; }
  .product-img, .product-initial { width: 60px; height: 60px; }
  .market-btns { flex-direction: column; }
  .market-btn { min-width: unset; }
  .btn-generate { width: 100%; min-width: unset; }
  .candidates-grid { grid-template-columns: 1fr; }
  .result-header { flex-direction: column; }
}
</style>
