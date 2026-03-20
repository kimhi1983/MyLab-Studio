<template>
  <div class="product-db-page">

    <!-- 헤더 -->
    <div class="page-header">
      <div>
        <h2 class="page-title">완제품 DB</h2>
        <p class="page-desc">{{ total.toLocaleString() }}개 제품 수록</p>
      </div>
    </div>

    <!-- 검색 + 필터 -->
    <div class="filter-section">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 20 20" fill="none" width="16" height="16">
          <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8"/>
          <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <input
          v-model="searchQ"
          class="search-input"
          placeholder="브랜드명, 제품명 검색..."
          @input="onSearchInput"
        />
        <button v-if="searchQ" class="search-clear" @click="searchQ = ''; loadProducts(1)">×</button>
      </div>
      <div class="filter-row">
        <select v-model="filterCategory" @change="loadProducts(1)" class="filter-select">
          <option value="">전체 카테고리</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="filterCountry" @change="loadProducts(1)" class="filter-select">
          <option value="">전체 원산지</option>
          <option value="한국">한국</option>
          <option value="일본">일본</option>
          <option value="미국">미국</option>
          <option value="유럽">유럽</option>
          <option value="중국">중국</option>
        </select>
        <select v-model="sortBy" @change="loadProducts(1)" class="filter-select">
          <option value="latest">최신순</option>
          <option value="brand">브랜드순</option>
          <option value="name">제품명순</option>
        </select>
      </div>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="loading-state">
      <span class="spinner"></span>
      <span>불러오는 중...</span>
    </div>

    <!-- 빈 결과 -->
    <div v-else-if="products.length === 0" class="empty-state">
      검색 결과가 없습니다.
    </div>

    <!-- 카드 그리드 -->
    <div v-else class="product-grid">
      <div
        v-for="prod in products"
        :key="prod.id"
        class="product-card"
        @click="openDetail(prod.id)"
      >
        <div class="card-img-wrap">
          <img
            v-if="prod.image_url"
            :src="prod.image_url"
            :alt="prod.product_name"
            class="card-img"
            @error="$event.target.style.display='none'"
          />
          <div v-else class="card-img-placeholder">
            <span class="cat-icon">{{ categoryEmoji(prod.category) }}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="card-brand">{{ prod.brand_name }}</div>
          <div class="card-name">{{ prod.product_name }}</div>
          <div class="card-tags">
            <span v-if="prod.category" class="tag-cat">{{ prod.category }}</span>
            <span v-if="prod.country_of_origin" class="tag-country">{{ prod.country_of_origin }}</span>
          </div>
          <div class="card-meta" v-if="prod.ingredient_count > 0">
            전성분 {{ prod.ingredient_count }}개
          </div>
        </div>
      </div>
    </div>

    <!-- 페이지네이션 -->
    <div class="pagination" v-if="totalPages > 1">
      <button class="page-btn" :disabled="page === 1" @click="loadProducts(page - 1)">‹</button>
      <span
        v-for="p in pageRange"
        :key="p"
        class="page-num"
        :class="{ active: p === page, ellipsis: p === '…' }"
        @click="p !== '…' && loadProducts(p)"
      >{{ p }}</span>
      <button class="page-btn" :disabled="page === totalPages" @click="loadProducts(page + 1)">›</button>
    </div>

  </div>

  <!-- ── 제품 상세 모달 ── -->
  <Teleport to="body">
    <div v-if="detail" class="modal-overlay" @click.self="detail = null">
      <div class="detail-modal">

        <!-- 모달 헤더 -->
        <div class="modal-header">
          <div class="modal-header-img">
            <img v-if="detail.product?.image_url" :src="detail.product.image_url" class="modal-img" />
            <div v-else class="modal-img-placeholder">
              <span>{{ categoryEmoji(detail.product?.category) }}</span>
            </div>
          </div>
          <div class="modal-header-info">
            <div class="modal-brand">{{ detail.product?.brand_name }}</div>
            <div class="modal-name">{{ detail.product?.product_name }}</div>
            <div class="modal-tags">
              <span v-if="detail.product?.category" class="tag-cat">{{ detail.product.category }}</span>
              <span v-if="detail.product?.country_of_origin" class="tag-country">{{ detail.product.country_of_origin }}</span>
            </div>
            <div class="modal-notable" v-if="detail.product?.notable_claims">{{ detail.product.notable_claims }}</div>
          </div>
          <button class="modal-close" @click="detail = null">×</button>
        </div>

        <!-- 모달 바디 -->
        <div class="modal-body">

          <!-- 물성 정보 -->
          <div v-if="detail.product?.ph_value" class="modal-section">
            <div class="modal-section-title">🔬 물성 정보</div>
            <div class="props-row">
              <span class="prop-item" v-if="detail.product.ph_value">
                <span class="prop-label">pH</span>
                <span class="prop-val">{{ detail.product.ph_value }}</span>
              </span>
              <span class="prop-item" v-if="detail.product.country_of_origin">
                <span class="prop-label">원산지</span>
                <span class="prop-val">{{ detail.product.country_of_origin }}</span>
              </span>
            </div>
          </div>

          <!-- 성분 역할 분석 -->
          <div v-if="detail.type_breakdown?.length" class="modal-section">
            <div class="modal-section-title">📊 성분 역할 분석</div>
            <div class="type-bars">
              <div v-for="t in detail.type_breakdown" :key="t.type" class="type-bar-row">
                <span class="type-label">{{ t.type }}</span>
                <div class="type-track">
                  <div class="type-fill" :style="{ width: t.pct + '%' }"></div>
                </div>
                <span class="type-pct">{{ t.pct }}%</span>
                <span class="type-count">{{ t.count }}개</span>
              </div>
            </div>
          </div>

          <!-- 전성분 목록 -->
          <div class="modal-section">
            <div class="modal-section-title">
              📋 전성분
              <span class="ing-count-badge">{{ detail.total_ingredients }}개</span>
              <span class="ing-matched-badge">DB매칭 {{ detail.matched_count }}개</span>
            </div>
            <div v-if="detailLoading" class="detail-loading">
              <span class="spinner"></span> 분석 중...
            </div>
            <div v-else class="ing-list">
              <div
                v-for="ing in detail.ingredients"
                :key="ing.rank"
                class="ing-row"
                :class="{ 'ing-unmatched': !ing.matched }"
              >
                <span class="ing-rank">{{ ing.rank }}</span>
                <div class="ing-info">
                  <span class="ing-inci">{{ ing.inci_name }}</span>
                  <span v-if="ing.korean_name" class="ing-kr">{{ ing.korean_name }}</span>
                  <span v-if="ing.function" class="ing-fn">{{ ing.function }}</span>
                  <span v-if="!ing.matched" class="ing-unregistered">미등록</span>
                </div>
                <span v-if="ing.ewg_score != null" class="ewg-dot" :class="ewgDotClass(ing.ewg_score)">
                  {{ ing.ewg_score }}
                </span>
              </div>
            </div>
          </div>

        </div>

        <!-- 모달 푸터 -->
        <div class="modal-footer">
          <button class="btn-close-modal" @click="detail = null">닫기</button>
          <button class="btn-copy-formula" @click="goCopyFormula(detailProductId)">
            이 제품으로 카피 처방 →
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAPI } from '../composables/useAPI.js'

const router = useRouter()
const api = useAPI()

// ── 상태 ──
const products = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const categories = ref([])

const searchQ = ref('')
const filterCategory = ref('')
const filterCountry = ref('')
const sortBy = ref('latest')

const PAGE_SIZE = 12

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const pageRange = computed(() => {
  const p = page.value, t = totalPages.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages = [1]
  if (p > 3) pages.push('…')
  for (let i = Math.max(2, p - 1); i <= Math.min(t - 1, p + 1); i++) pages.push(i)
  if (p < t - 2) pages.push('…')
  pages.push(t)
  return pages
})

// ── 검색 디바운스 ──
let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadProducts(1), 350)
}

// ── 카테고리 이모지 ──
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

// ── EWG 뱃지 ──
function ewgDotClass(score) {
  if (score <= 2) return 'ewg-low'
  if (score <= 6) return 'ewg-mid'
  return 'ewg-high'
}

// ── 제품 목록 로드 ──
async function loadProducts(p = 1) {
  page.value = p
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: p,
      limit: PAGE_SIZE,
      search: searchQ.value,
      category: filterCategory.value,
      country: filterCountry.value,
      sort: sortBy.value,
    })
    const res = await api.fetchJSON(`/api/products/list?${params}`)
    products.value = res?.items || []
    total.value = res?.total || 0
  } finally {
    loading.value = false
  }
}

// ── 카테고리 목록 ──
async function loadCategories() {
  const res = await api.fetchJSON('/api/products/categories')
  categories.value = Array.isArray(res) ? res : []
}

// ── 제품 상세 ──
const detail = ref(null)
const detailLoading = ref(false)
const detailProductId = ref(null)

async function openDetail(id) {
  detailProductId.value = id
  detail.value = { product: null, ingredients: [], type_breakdown: [], total_ingredients: 0, matched_count: 0 }
  detailLoading.value = true
  const res = await api.fetchJSON(`/api/products/${id}/ingredients-analysis`)
  if (res) detail.value = res
  detailLoading.value = false
}

function goCopyFormula(id) {
  detail.value = null
  router.push(`/formulas/new?tab=copy&productId=${id}`)
}

onMounted(() => {
  loadCategories()
  loadProducts(1)
})
</script>

<style scoped>
.product-db-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px;
}

/* ── 헤더 ── */
.page-header { margin-bottom: 24px; }
.page-title { font-size: 22px; font-weight: 700; color: var(--text, #222); margin: 0 0 4px; }
.page-desc  { font-size: 13px; color: var(--text-dim, #999); margin: 0; }

/* ── 검색 + 필터 ── */
.filter-section { margin-bottom: 24px; display: flex; flex-direction: column; gap: 12px; }

.search-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface, #fff);
  border: 1.5px solid #E8E0D4;
  border-radius: 10px;
  padding: 0 14px;
  transition: border-color 0.2s;
}
.search-wrap:focus-within { border-color: #C8A96E; }
.search-icon { color: #999; flex-shrink: 0; }
.search-input {
  flex: 1;
  height: 44px;
  border: none;
  outline: none;
  font-size: 14px;
  background: transparent;
  color: var(--text, #222);
}
.search-input::placeholder { color: #bbb; }
.search-clear { background: none; border: none; cursor: pointer; color: #999; font-size: 18px; padding: 0 4px; }

.filter-row { display: flex; gap: 10px; flex-wrap: wrap; }
.filter-select {
  height: 38px;
  border: 1.5px solid #E8E0D4;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  background: var(--surface, #fff);
  color: var(--text, #333);
  cursor: pointer;
  outline: none;
}
.filter-select:focus { border-color: #C8A96E; }

/* ── 로딩 / 빈 상태 ── */
.loading-state, .empty-state {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-dim, #999);
  font-size: 14px;
  padding: 60px 0;
  justify-content: center;
}
.spinner {
  width: 16px; height: 16px;
  border: 2px solid #E8E0D4;
  border-top-color: #C8A96E;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── 카드 그리드 ── */
.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}
@media (max-width: 900px) { .product-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .product-grid { grid-template-columns: 1fr; } }

.product-card {
  border: 1px solid #E8E0D4;
  border-radius: 10px;
  background: var(--surface, #fff);
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.product-card:hover {
  box-shadow: 0 6px 24px rgba(200,169,110,0.18);
  transform: translateY(-2px);
}

.card-img-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #FAF8F4;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-img {
  width: 100%; height: 100%;
  object-fit: cover;
}
.card-img-placeholder {
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FAF8F4, #F0EDE6);
}
.cat-icon { font-size: 48px; }

.card-body { padding: 14px 16px 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
.card-brand { font-size: 11px; font-weight: 700; color: #C8A96E; text-transform: uppercase; letter-spacing: 0.5px; }
.card-name {
  font-size: 13px; font-weight: 600; color: var(--text, #222);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  line-height: 1.4;
}
.card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.card-meta { font-size: 11px; color: var(--text-dim, #aaa); margin-top: 2px; }

/* ── 태그 ── */
.tag-cat {
  font-size: 10px; font-weight: 600;
  padding: 2px 9px; border-radius: 12px;
  background: #C8A96E; color: #fff;
}
.tag-country {
  font-size: 10px; font-weight: 500;
  padding: 2px 8px; border-radius: 12px;
  background: #F0EDE8; color: #888;
}

/* ── 페이지네이션 ── */
.pagination {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 8px 0 16px;
}
.page-btn {
  width: 34px; height: 34px;
  border: 1.5px solid #E8E0D4; border-radius: 8px;
  background: none; cursor: pointer; font-size: 16px;
  color: var(--text-sub, #555);
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.15s;
}
.page-btn:disabled { opacity: 0.35; cursor: default; }
.page-btn:not(:disabled):hover { border-color: #C8A96E; color: #C8A96E; }
.page-num {
  min-width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; cursor: pointer; border-radius: 8px;
  color: var(--text-sub, #555);
  transition: background 0.15s;
}
.page-num:not(.ellipsis):hover { background: #F5F0E8; }
.page-num.active { background: #C8A96E; color: #fff; font-weight: 700; cursor: default; }
.page-num.ellipsis { cursor: default; }

/* ── 모달 오버레이 ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 9000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

.detail-modal {
  background: var(--surface, #fff);
  border-radius: 12px;
  width: 100%; max-width: 800px;
  max-height: 88vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  overflow: hidden;
}

/* ── 모달 헤더 ── */
.modal-header {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 24px 24px 20px;
  border-bottom: 1px solid #E8E0D4;
  position: relative;
}
.modal-header-img {
  width: 80px; height: 80px; flex-shrink: 0;
  border-radius: 10px; overflow: hidden;
  background: #FAF8F4;
  display: flex; align-items: center; justify-content: center;
}
.modal-img { width: 100%; height: 100%; object-fit: cover; }
.modal-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 36px; }
.modal-header-info { flex: 1; min-width: 0; }
.modal-brand { font-size: 11px; font-weight: 700; color: #C8A96E; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.modal-name { font-size: 17px; font-weight: 700; color: var(--text, #222); line-height: 1.3; margin-bottom: 8px; }
.modal-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.modal-notable { font-size: 12px; color: var(--text-dim, #999); line-height: 1.4; }
.modal-close {
  position: absolute; top: 16px; right: 16px;
  background: none; border: none; font-size: 24px; cursor: pointer;
  color: #bbb; line-height: 1; padding: 0 4px;
}
.modal-close:hover { color: #666; }

/* ── 모달 바디 ── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex; flex-direction: column; gap: 20px;
}

.modal-section-title {
  font-size: 13px; font-weight: 700; color: var(--text, #333);
  margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
}

/* 물성 */
.props-row { display: flex; gap: 20px; flex-wrap: wrap; }
.prop-item { display: flex; flex-direction: column; gap: 2px; }
.prop-label { font-size: 10px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
.prop-val { font-size: 14px; font-weight: 600; color: var(--text, #222); }

/* 성분 역할 분석 */
.type-bars { display: flex; flex-direction: column; gap: 7px; }
.type-bar-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.type-label { width: 80px; flex-shrink: 0; color: var(--text-sub, #555); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type-track { flex: 1; height: 8px; background: #F5F0E8; border-radius: 4px; overflow: hidden; }
.type-fill { height: 100%; background: #C8A96E; border-radius: 4px; transition: width 0.4s; }
.type-pct { width: 32px; text-align: right; color: #C8A96E; font-weight: 600; font-size: 11px; }
.type-count { width: 32px; color: var(--text-dim, #bbb); font-size: 10px; }

/* 전성분 목록 */
.ing-count-badge {
  font-size: 11px; padding: 1px 8px; background: #F5F0E8; color: #C8A96E; border-radius: 10px; font-weight: 600;
}
.ing-matched-badge {
  font-size: 11px; padding: 1px 8px; background: #E8F5E9; color: #388E3C; border-radius: 10px; font-weight: 600;
}
.detail-loading { display: flex; align-items: center; gap: 8px; color: #999; font-size: 13px; padding: 20px 0; }

.ing-list {
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid #E8E0D4;
  border-radius: 8px;
  font-size: 12px;
}
.ing-row {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid #F5F0E8;
  transition: background 0.1s;
}
.ing-row:last-child { border-bottom: none; }
.ing-row:hover { background: #FAFAF7; }
.ing-unmatched { opacity: 0.65; }

.ing-rank {
  width: 22px; flex-shrink: 0;
  font-size: 10px; color: #C8A96E; font-weight: 700; text-align: right;
  font-family: monospace;
}
.ing-info { flex: 1; min-width: 0; display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
.ing-inci { font-weight: 500; color: var(--text, #222); }
.ing-kr { font-size: 11px; color: #888; }
.ing-fn {
  font-size: 10px; padding: 1px 6px; background: #F0EDE8;
  color: #888; border-radius: 6px; white-space: nowrap;
}
.ing-unregistered {
  font-size: 10px; padding: 1px 6px; background: #F5F5F5;
  color: #bbb; border-radius: 6px;
}

.ewg-dot {
  width: 24px; height: 24px; flex-shrink: 0;
  border-radius: 50%; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.ewg-low  { background: #E8F5E9; color: #2E7D32; }
.ewg-mid  { background: #FFF3E0; color: #E65100; }
.ewg-high { background: #FFEBEE; color: #C62828; }

/* ── 모달 푸터 ── */
.modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid #E8E0D4;
}
.btn-close-modal {
  height: 38px; padding: 0 20px; border: 1.5px solid #E8E0D4; border-radius: 8px;
  background: none; color: var(--text-sub, #555); font-size: 13px; cursor: pointer;
}
.btn-close-modal:hover { background: #F5F0E8; }
.btn-copy-formula {
  height: 38px; padding: 0 20px; border: none; border-radius: 8px;
  background: #C8A96E; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.btn-copy-formula:hover { background: #a87d4a; }
</style>
