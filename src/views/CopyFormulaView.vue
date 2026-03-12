<template>
  <div class="copy-formula-page">
    <!-- STEP 1: 제품 검색 -->
    <div class="panel">
      <div class="panel-header">
        <span class="section-label">STEP 1</span>
        <span class="section-title">제품 검색</span>
      </div>
      <div class="search-body">
        <div class="form-group">
          <label class="form-label">제품명 또는 브랜드 검색</label>
          <div class="search-input-wrap">
            <span class="search-icon">&#128269;</span>
            <input
              v-model="searchQuery"
              class="form-input search-input"
              placeholder="예: CeraVe, La Roche-Posay, 수분크림..."
              @input="onSearchInput"
              @focus="showDropdown = true"
              @blur="onSearchBlur"
              autocomplete="off"
            >
          </div>

          <!-- 검색 결과 드롭다운 -->
          <div v-if="showDropdown && (searchResults.length > 0 || isSearching)" class="search-dropdown">
            <div v-if="isSearching" class="dropdown-loading">
              <span class="loading-dot"></span>검색 중...
            </div>
            <template v-else>
              <div
                v-for="prod in searchResults"
                :key="prod.id"
                class="dropdown-item"
                @mousedown.prevent="onSelectProduct(prod)"
              >
                <div class="dropdown-avatar" :style="{ background: getAvatarColor(prod.brand_name) }">
                  {{ getInitials(prod.brand_name) }}
                </div>
                <div class="dropdown-info">
                  <div class="dropdown-name">{{ prod.product_name }}</div>
                  <div class="dropdown-meta">{{ prod.brand_name }} · {{ prod.category || '미지정' }} · {{ prod.data_quality_grade || '' }}등급</div>
                </div>
              </div>
              <div v-if="searchResults.length === 0 && searchQuery.length >= 2" class="dropdown-empty">
                검색 결과가 없습니다
              </div>
            </template>
          </div>
        </div>

        <!-- 선택된 제품 카드 -->
        <div v-if="selectedProduct" class="product-card">
          <div class="product-card-inner">
            <div class="product-avatar-wrap">
              <img
                v-if="selectedProduct.image_url"
                :src="selectedProduct.image_url"
                :alt="selectedProduct.product_name"
                class="product-image"
              >
              <div
                v-else
                class="product-avatar"
                :style="{ background: getAvatarColor(selectedProduct.brand_name) }"
              >
                {{ getInitials(selectedProduct.brand_name) }}
              </div>
            </div>
            <div class="product-info">
              <div class="product-brand">{{ selectedProduct.brand_name }}</div>
              <div class="product-name">{{ selectedProduct.product_name }}</div>
              <div class="product-meta-row">
                <span class="meta-chip">{{ selectedProduct.category || '미지정' }}</span>
                <span class="meta-chip">{{ selectedProduct.product_type || '' }}</span>
                <span v-if="selectedProduct.data_quality_grade" class="grade-badge" :class="'grade-' + selectedProduct.data_quality_grade">
                  {{ selectedProduct.data_quality_grade }}등급
                </span>
              </div>
              <div class="product-props">
                <span v-if="selectedProduct.ph" class="prop-tag">pH {{ selectedProduct.ph }}</span>
                <span v-if="selectedProduct.skin_type" class="prop-tag">{{ selectedProduct.skin_type }}</span>
                <span v-if="selectedProduct.claims" class="prop-tag">{{ selectedProduct.claims }}</span>
              </div>
            </div>
          </div>

          <!-- 전성분 미리보기 -->
          <div v-if="selectedProduct.full_ingredients" class="ingredients-preview">
            <div class="ingredients-label">전성분 미리보기</div>
            <div class="ingredients-text" :class="{ expanded: ingredientsExpanded }">
              {{ selectedProduct.full_ingredients }}
            </div>
            <div class="ingredients-footer">
              <span class="ingredient-count">총 {{ ingredientCount }}개 성분</span>
              <button class="btn-toggle-ing" @click="ingredientsExpanded = !ingredientsExpanded">
                {{ ingredientsExpanded ? '접기' : '전체 보기' }}
              </button>
            </div>
          </div>

          <div class="product-card-footer">
            <button class="btn-deselect" @click="clearProduct">선택 해제</button>
          </div>
        </div>

        <div v-if="loadingProduct" class="product-loading">
          <span class="ai-spinner"></span> 제품 정보 불러오는 중...
        </div>
      </div>
    </div>

    <!-- STEP 2: 역처방 옵션 -->
    <div class="panel" :class="{ disabled: !selectedProduct }">
      <div class="panel-header">
        <span class="section-label">STEP 2</span>
        <span class="section-title">역처방 옵션</span>
        <span v-if="!selectedProduct" class="step-hint">제품을 먼저 선택하세요</span>
      </div>
      <div class="options-body">
        <div class="form-group">
          <label class="form-label">시장 선택</label>
          <div class="market-opts">
            <label
              v-for="m in markets"
              :key="m.value"
              class="market-opt"
              :class="{ active: selectedMarket === m.value }"
            >
              <input
                type="radio"
                name="market"
                :value="m.value"
                v-model="selectedMarket"
                class="market-radio"
              >
              <span class="market-flag">{{ m.flag }}</span>
              <span class="market-label">{{ m.label }}</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">추가 요구사항 (선택)</label>
          <input
            v-model="requirements"
            class="form-input"
            placeholder="예: 비건 성분으로 대체, 방부제 프리, 민감성 피부 최적화"
            :disabled="!selectedProduct"
          >
        </div>

        <div class="generate-wrap">
          <button
            class="btn btn-primary btn-lg btn-generate"
            :disabled="!selectedProduct || isGenerating"
            @click="onGenerate"
          >
            <span v-if="isGenerating" class="ai-spinner"></span>
            <span v-else class="btn-star">&#10022;</span>
            {{ isGenerating ? generateStep : '카피 처방 생성하기' }}
          </button>
        </div>
      </div>
    </div>

    <!-- STEP 3: 결과 -->
    <div v-if="generateResult" style="margin-top: 16px">
      <AiResultPanel
        :result="generateResult"
        :elapsed="elapsed"
        @regenerate="onGenerate"
        @save="onSaveFormula"
      />
    </div>

    <!-- 에러 메시지 -->
    <div v-if="generateError" class="error-panel">
      <span class="error-icon">&#9888;</span>
      <span>{{ generateError }}</span>
      <button class="btn-dismiss" @click="generateError = ''">닫기</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useAPI } from '../composables/useAPI.js'
import AiResultPanel from '../components/formula/AiResultPanel.vue'

const router = useRouter()
const { addFormula } = useFormulaStore()
const api = useAPI()

// ── 검색 상태 ──
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const showDropdown = ref(false)
let searchTimer = null

// ── 선택 상태 ──
const selectedProduct = ref(null)
const loadingProduct = ref(false)
const ingredientsExpanded = ref(false)

// ── 옵션 ──
const markets = [
  { value: 'KR', label: '한국 (KR)', flag: '&#127472;&#127479;' },
  { value: 'EU', label: '유럽 (EU)', flag: '&#127466;&#127482;' },
  { value: 'US', label: '미국 (US)', flag: '&#127482;&#127480;' },
]
const selectedMarket = ref('KR')
const requirements = ref('')

// ── 생성 상태 ──
const isGenerating = ref(false)
const generateStep = ref('')
const generateResult = ref(null)
const generateError = ref('')
const elapsed = ref(0)
let elapsedTimer = null

// ── 전성분 카운트 ──
const ingredientCount = computed(() => {
  if (!selectedProduct.value?.full_ingredients) return 0
  return selectedProduct.value.full_ingredients
    .split(',')
    .map(s => s.trim())
    .filter(Boolean).length
})

// ── 아바타 유틸 ──
const AVATAR_COLORS = [
  '#4a7c59', '#6b5a7e', '#5a7296', '#8a6a4a', '#5a8a7a',
  '#7a5a6b', '#6a8a5a', '#5a6b8a', '#8a5a7a', '#7a8a5a',
]

function getAvatarColor(name = '') {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase()
}

// ── 검색 ──
function onSearchInput() {
  clearTimeout(searchTimer)
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  if (searchQuery.value.length < 2) return
  isSearching.value = true
  try {
    const res = await api.fetchJSON(
      '/api/products/autocomplete?q=' +
        encodeURIComponent(searchQuery.value) +
        '&limit=10'
    )
    if (res?.data) {
      searchResults.value = res.data
    } else if (Array.isArray(res)) {
      searchResults.value = res
    } else {
      // fallback: 일반 제품 검색 엔드포인트 사용
      const fallback = await api.getProducts({ q: searchQuery.value, limit: 10 })
      searchResults.value = fallback?.data || []
    }
  } catch {
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

function onSearchBlur() {
  // 드롭다운 클릭 이벤트가 blur보다 먼저 처리되도록 약간 지연
  setTimeout(() => { showDropdown.value = false }, 150)
}

async function onSelectProduct(prod) {
  showDropdown.value = false
  searchQuery.value = prod.product_name || ''
  loadingProduct.value = true
  try {
    // full_ingredients 포함 상세 조회
    const detail = await api.getProduct(prod.id)
    selectedProduct.value = detail?.data || detail || prod
  } catch {
    selectedProduct.value = prod
  } finally {
    loadingProduct.value = false
    ingredientsExpanded.value = false
  }
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
    { delay: 3600, msg: '처방 생성 중...' },
    { delay: 5000, msg: '안전성 검증 중...' },
  ]
  let stepIdx = 0
  function nextStep() {
    if (stepIdx < steps.length && isGenerating.value) {
      const s = steps[stepIdx++]
      setTimeout(() => { generateStep.value = s.msg; nextStep() }, s.delay)
    }
  }
  nextStep()

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

    if (res?.success && res.data) {
      generateResult.value = res.data
    } else if (res?.ingredients) {
      generateResult.value = res
    } else {
      generateError.value = res?.error || '처방 생성에 실패했습니다. 잠시 후 다시 시도하세요.'
    }
  } catch (e) {
    generateError.value = e.message || '네트워크 오류가 발생했습니다.'
  } finally {
    isGenerating.value = false
    clearInterval(elapsedTimer)
  }
}

// ── 처방 저장 ──
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
    memo: `원본 제품: ${prod?.brand_name || ''} ${prod?.product_name || ''}\n시장: ${selectedMarket.value}\n생성 시각: ${new Date().toLocaleString('ko-KR')}`,
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
  gap: 16px;
}

/* ── 검색 ── */
.search-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-input-wrap {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--text-dim);
  pointer-events: none;
}

.search-input {
  padding-left: 34px;
}

/* ── 드롭다운 ── */
.search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  z-index: 100;
  max-height: 280px;
  overflow-y: auto;
}

.dropdown-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-dim);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--border);
}

.dropdown-item:last-child { border-bottom: none; }

.dropdown-item:hover { background: var(--bg); }

.dropdown-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.dropdown-info { flex: 1; min-width: 0; }

.dropdown-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-meta {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.dropdown-empty {
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-dim);
  text-align: center;
}

/* ── 제품 카드 ── */
.product-card {
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.product-card-inner {
  display: flex;
  gap: 16px;
  padding: 16px;
}

.product-avatar-wrap { flex-shrink: 0; }

.product-image {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--border);
}

.product-avatar {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  font-weight: 700;
}

.product-info { flex: 1; min-width: 0; }

.product-brand {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.product-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 6px;
  line-height: 1.3;
}

.product-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.meta-chip {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-sub);
}

.grade-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.grade-A { background: #e6f4ea; color: #2e7d32; border: 1px solid #a5d6a7; }
.grade-B { background: #e8f5e9; color: #388e3c; border: 1px solid #c8e6c9; }
.grade-C { background: #fff8e1; color: #f57f17; border: 1px solid #ffe082; }
.grade-D { background: #fce4ec; color: #c62828; border: 1px solid #ef9a9a; }

.product-props {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.prop-tag {
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 8px;
  border-radius: 10px;
}

/* ── 전성분 미리보기 ── */
.ingredients-preview {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

.ingredients-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.ingredients-text {
  font-size: 12px;
  color: var(--text);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-family: var(--font-mono);
  transition: all 0.2s;
}

.ingredients-text.expanded {
  display: block;
  -webkit-line-clamp: unset;
}

.ingredients-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.ingredient-count {
  font-size: 11px;
  color: var(--text-dim);
}

.btn-toggle-ing {
  font-size: 11px;
  color: var(--accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-weight: 600;
}

.btn-toggle-ing:hover { text-decoration: underline; }

.product-card-footer {
  display: flex;
  justify-content: flex-end;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
}

.btn-deselect {
  font-size: 12px;
  color: var(--text-dim);
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-deselect:hover { color: var(--text-sub); border-color: var(--text-dim); }

.product-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 13px;
  padding: 8px 0;
}

/* ── 옵션 ── */
.options-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.step-hint {
  font-size: 12px;
  color: var(--text-dim);
  margin-left: auto;
}

/* ── 시장 선택 ── */
.market-opts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.market-opt {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  background: var(--surface);
}

.market-opt:hover {
  border-color: var(--accent);
  background: var(--accent-light);
}

.market-opt.active {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}

.market-radio { display: none; }

.market-flag {
  font-size: 16px;
  line-height: 1;
}

.market-label {
  font-size: 13px;
  font-weight: 500;
}

/* ── 생성 버튼 ── */
.generate-wrap {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.btn-generate {
  min-width: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  padding: 12px 28px;
}

.btn-star {
  font-size: 16px;
}

/* ── 에러 패널 ── */
.error-panel {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fce4ec;
  border: 1px solid #ef9a9a;
  border-radius: var(--radius);
  font-size: 13px;
  color: #c62828;
}

.error-icon { font-size: 16px; }

.btn-dismiss {
  margin-left: auto;
  font-size: 12px;
  padding: 3px 10px;
  background: none;
  border: 1px solid #ef9a9a;
  border-radius: 4px;
  color: #c62828;
  cursor: pointer;
}

/* ── 로딩 도트 ── */
.loading-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
}

/* ── AI 스피너 (부모에서 정의된 클래스 재사용) ── */
.ai-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── form-group 로컬 보완 (부모 없이도 동작) ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

@media (max-width: 600px) {
  .product-card-inner { flex-direction: column; }
  .product-avatar { width: 56px; height: 56px; font-size: 16px; }
  .product-image { width: 56px; height: 56px; }
  .market-opts { flex-direction: column; }
  .btn-generate { width: 100%; }
}
</style>
