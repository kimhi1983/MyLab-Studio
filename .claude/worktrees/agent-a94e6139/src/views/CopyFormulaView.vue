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
              @focus="searchFocused = true; showDropdown = true"
              @blur="onSearchBlur"
              autocomplete="off"
            >
            <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''; searchResults = []">
              <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>

          <!-- 검색 결과 드롭다운 -->
          <div v-if="showDropdown && (searchResults.length > 0 || isSearching)" class="dropdown">
            <div v-if="isSearching" class="dropdown-loading">
              <span class="dot-pulse"></span>
              <span>검색 중...</span>
            </div>
            <template v-else>
              <div
                v-for="prod in searchResults"
                :key="prod.id"
                class="dropdown-item"
                @mousedown.prevent="onSelectProduct(prod)"
              >
                <div class="dropdown-thumb">
                  <img v-if="prod.image_url" :src="prod.image_url" :alt="prod.product_name" class="dropdown-img">
                  <div v-else class="dropdown-initial" :style="{ background: getAvatarColor(prod.brand_name) }">
                    {{ getInitials(prod.brand_name) }}
                  </div>
                </div>
                <div class="dropdown-body">
                  <div class="dropdown-name">{{ prod.product_name }}</div>
                  <div class="dropdown-meta">
                    <span>{{ prod.brand_name }}</span>
                    <span class="dot-sep"></span>
                    <span>{{ prod.category || '미분류' }}</span>
                    <span v-if="prod.data_quality_grade" class="dropdown-grade" :class="'g-' + prod.data_quality_grade">
                      {{ prod.data_quality_grade }}
                    </span>
                  </div>
                </div>
                <svg class="dropdown-arrow" viewBox="0 0 16 16" width="14" height="14">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
              </div>
            </template>
            <div v-if="!isSearching && searchResults.length === 0 && searchQuery.length >= 2" class="dropdown-empty">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
                <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>검색 결과가 없습니다</span>
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
                  <span class="chip">{{ selectedProduct.category || '미분류' }}</span>
                  <span v-if="selectedProduct.product_type" class="chip">{{ selectedProduct.product_type }}</span>
                  <span v-if="selectedProduct.data_quality_grade" class="chip chip-grade" :class="'g-' + selectedProduct.data_quality_grade">
                    {{ selectedProduct.data_quality_grade }}등급
                  </span>
                </div>
                <div class="product-tags">
                  <span v-if="selectedProduct.ph" class="ptag">pH {{ selectedProduct.ph }}</span>
                  <span v-if="selectedProduct.skin_type" class="ptag">{{ selectedProduct.skin_type }}</span>
                  <span v-if="selectedProduct.claims" class="ptag">{{ selectedProduct.claims }}</span>
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
                <button class="btn-expand" @click="ingredientsExpanded = !ingredientsExpanded">
                  {{ ingredientsExpanded ? '접기' : '펼치기' }}
                  <svg :class="{ rotated: ingredientsExpanded }" viewBox="0 0 16 16" width="12" height="12">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  </svg>
                </button>
              </div>
              <div class="ingredients-text" :class="{ expanded: ingredientsExpanded }">
                {{ selectedProduct.full_ingredients }}
              </div>
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
    <div class="step-card" :class="{ 'step-disabled': !selectedProduct }">
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
    <div class="generate-section">
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

    <!-- STEP 3: 결과 -->
    <transition name="card-fade">
      <div v-if="generateResult" class="step-card step-result">
        <div class="step-badge step-badge-done">3</div>
        <div class="step-content">
          <AiResultPanel
            :result="generateResult"
            :elapsed="elapsed"
            @regenerate="onGenerate"
            @save="onSaveFormula"
          />
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useAPI } from '../composables/useAPI.js'
import AiResultPanel from '../components/formula/AiResultPanel.vue'

const router = useRouter()
const { addFormula } = useFormulaStore()
const api = useAPI()

// ── 검색 ──
const searchInputRef = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const showDropdown = ref(false)
const searchFocused = ref(false)
let searchTimer = null

// ── 선택 ──
const selectedProduct = ref(null)
const loadingProduct = ref(false)
const ingredientsExpanded = ref(false)

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
let elapsedTimer = null

// ── computed ──
const ingredientCount = computed(() => {
  if (!selectedProduct.value?.full_ingredients) return 0
  return selectedProduct.value.full_ingredients.split(',').map(s => s.trim()).filter(Boolean).length
})

// ── 유틸 ──
const COLORS = ['#4a7c59','#6b5a7e','#5a7296','#8a6a4a','#5a8a7a','#7a5a6b','#6a8a5a','#5a6b8a','#8a5a7a','#7a8a5a']

function getAvatarColor(name = '') {
  return COLORS[name.charCodeAt(0) % COLORS.length]
}

function getInitials(name = '') {
  return name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
}

// ── 검색 로직 ──
function onSearchInput() {
  clearTimeout(searchTimer)
  if (searchQuery.value.length < 2) { searchResults.value = []; return }
  searchTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  if (searchQuery.value.length < 2) return
  isSearching.value = true
  try {
    const res = await api.fetchJSON('/api/products/autocomplete?q=' + encodeURIComponent(searchQuery.value) + '&limit=10')
    if (res?.items) searchResults.value = res.items
    else if (res?.data) searchResults.value = res.data
    else if (Array.isArray(res)) searchResults.value = res
    else {
      const fallback = await api.getProducts({ q: searchQuery.value, limit: 10 })
      searchResults.value = fallback?.items || fallback?.data || []
    }
  } catch { searchResults.value = [] }
  finally { isSearching.value = false }
}

function onSearchBlur() {
  searchFocused.value = false
  setTimeout(() => { showDropdown.value = false }, 150)
}

async function onSelectProduct(prod) {
  showDropdown.value = false
  searchQuery.value = prod.product_name || ''
  loadingProduct.value = true
  try {
    const detail = await api.getProduct(prod.id)
    selectedProduct.value = detail?.data || detail || prod
  } catch { selectedProduct.value = prod }
  finally { loadingProduct.value = false; ingredientsExpanded.value = false }
}

function clearProduct() {
  selectedProduct.value = null
  searchQuery.value = ''
  searchResults.value = []
  generateResult.value = null
  generateError.value = ''
  ingredientsExpanded.value = false
}

// ── 처방 생성 ──
async function onGenerate() {
  if (!selectedProduct.value || isGenerating.value) return
  generateError.value = ''
  generateResult.value = null
  isGenerating.value = true
  generateStep.value = '전성분 분석 중...'
  elapsed.value = 0
  elapsedTimer = setInterval(() => { elapsed.value++ }, 1000)

  const steps = [
    { delay: 1200, msg: '성분 DB 조회 중...' },
    { delay: 2400, msg: '규제 적합성 검토 중...' },
    { delay: 3600, msg: '배합비 역산 중...' },
    { delay: 5000, msg: '안전성 검증 중...' },
  ]
  let idx = 0
  function tick() {
    if (idx < steps.length && isGenerating.value) {
      const s = steps[idx++]
      setTimeout(() => { generateStep.value = s.msg; tick() }, s.delay)
    }
  }
  tick()

  try {
    const res = await api.copyFormula({
      productId: selectedProduct.value.id,
      productName: selectedProduct.value.product_name,
      brandName: selectedProduct.value.brand_name,
      category: selectedProduct.value.category,
      fullIngredients: selectedProduct.value.full_ingredients,
      market: selectedMarket.value,
      requirements: requirements.value,
    })
    if (res?.success && res.data) generateResult.value = res.data
    else if (res?.ingredients) generateResult.value = res
    else generateError.value = res?.error || '처방 생성에 실패했습니다.'
  } catch (e) {
    generateError.value = e.message || '네트워크 오류가 발생했습니다.'
  } finally {
    isGenerating.value = false
    clearInterval(elapsedTimer)
  }
}

// ── 저장 ──
function onSaveFormula() {
  if (!generateResult.value) return
  const prod = selectedProduct.value
  const ingredients = (generateResult.value.ingredients || []).map(ing => ({
    name: ing.name || ing.inci_name || '',
    inci_name: ing.inci_name || '',
    percentage: ing.percentage || 0,
    function: ing.function || '',
    type: ing.type || '',
    note: '',
  }))
  const newFormula = addFormula({
    title: `[카피] ${prod?.product_name || '처방'} - ${selectedMarket.value}`,
    product_type: prod?.category || '',
    status: 'draft',
    tags: ['카피처방', selectedMarket.value],
    memo: `원본: ${prod?.brand_name || ''} ${prod?.product_name || ''}\n시장: ${selectedMarket.value}\n${new Date().toLocaleString('ko-KR')}`,
    formula_data: {
      ingredients,
      total_percentage: ingredients.reduce((s, i) => s + (Number(i.percentage) || 0), 0),
    },
  })
  router.push('/formulas/' + newFormula.id)
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
  position: relative;
  margin-bottom: 16px;
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

/* ─── Dropdown ─── */
.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  z-index: 100;
  max-height: 320px;
  overflow-y: auto;
}

.dropdown-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  font-size: 13px;
  color: var(--text-dim);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.dropdown-item:hover { background: var(--bg); }

.dropdown-item + .dropdown-item { border-top: 1px solid var(--border); }

.dropdown-thumb { flex-shrink: 0; }

.dropdown-img {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--border);
}

.dropdown-initial {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.dropdown-body { flex: 1; min-width: 0; }

.dropdown-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-meta {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot-sep {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-dim);
}

.dropdown-grade {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  margin-left: 4px;
}

.g-A { background: #e6f4ea; color: #2e7d32; }
.g-B { background: #e8f5e9; color: #388e3c; }
.g-C { background: #fff8e1; color: #f57f17; }
.g-D { background: #fce4ec; color: #c62828; }

.dropdown-arrow {
  color: var(--text-dim);
  flex-shrink: 0;
}

.dropdown-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 16px;
  font-size: 13px;
  color: var(--text-dim);
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

/* ─── Responsive ─── */
@media (max-width: 600px) {
  .step-card { flex-direction: column; gap: 12px; }
  .step-badge { align-self: flex-start; }
  .product-card-top { flex-direction: column; }
  .product-img, .product-initial { width: 60px; height: 60px; }
  .market-btns { flex-direction: column; }
  .market-btn { min-width: unset; }
  .btn-generate { width: 100%; min-width: unset; }
}
</style>
