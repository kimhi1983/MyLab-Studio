import { ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * COCHING MyLab API 클라이언트
 * n8n 워크플로우가 수집한 원료/규제/지식베이스 데이터에 접근
 */
export function useAPI() {
  const loading = ref(false)
  const error = ref(null)

  async function fetchJSON(path, options = {}) {
    loading.value = true
    error.value = null
    try {
      const url = `${API_BASE}${path}`
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `API ${res.status}`)
      }
      return await res.json()
    } catch (err) {
      error.value = err.message
      console.error(`[API] ${path}:`, err.message)
      return null
    } finally {
      loading.value = false
    }
  }

  // ─── 통계 ───
  async function getStats() {
    return fetchJSON('/api/stats')
  }

  // ─── 원료 ───
  async function getIngredients({ q, type, limit, offset } = {}) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type) params.set('type', type)
    if (limit) params.set('limit', limit)
    if (offset) params.set('offset', offset)
    return fetchJSON(`/api/ingredients?${params}`)
  }

  async function getIngredient(id) {
    return fetchJSON(`/api/ingredients/${id}`)
  }

  async function getIngredientTypes() {
    return fetchJSON('/api/ingredient-types')
  }

  // ─── 규제 ───
  async function getRegulations({ source, q, limit, offset } = {}) {
    const params = new URLSearchParams()
    if (source) params.set('source', source)
    if (q) params.set('q', q)
    if (limit) params.set('limit', limit)
    if (offset) params.set('offset', offset)
    return fetchJSON(`/api/regulations?${params}`)
  }

  async function getRegulationSources() {
    return fetchJSON('/api/regulation-sources')
  }

  // ─── 지식베이스 ───
  async function getKnowledge({ q, category, limit } = {}) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category) params.set('category', category)
    if (limit) params.set('limit', limit)
    return fetchJSON(`/api/knowledge?${params}`)
  }

  // ─── 제품 (product_master) ───
  async function getProducts({ q, category, limit, offset } = {}) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (category) params.set('category', category)
    if (limit) params.set('limit', limit)
    if (offset) params.set('offset', offset)
    return fetchJSON(`/api/products?${params}`)
  }

  async function getProduct(id) {
    return fetchJSON(`/api/products/${id}`)
  }

  // ─── 워크플로우 로그 ───
  async function getWorkflowLogs({ limit } = {}) {
    const params = new URLSearchParams()
    if (limit) params.set('limit', limit)
    return fetchJSON(`/api/workflow-logs?${params}`)
  }

  // ─── 가이드 처방 생성 ───
  async function generateGuideFormula(productType, requirements = '') {
    return fetchJSON('/api/guide-formula', {
      method: 'POST',
      body: JSON.stringify({ productType, requirements }),
    })
  }

  // ─── 처방 생성 (AI) ───
  async function generateAiFormula(data) {
    return fetchJSON('/api/ai-formula', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ─── 카피 처방 생성 ───
  async function copyFormula(data) {
    return fetchJSON('/api/copy-formula', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ─── 품질 검증 ───
  async function validateFormula(ingredients) {
    return fetchJSON('/api/validate-formula', {
      method: 'POST',
      body: JSON.stringify({ ingredients }),
    })
  }

  // ─── 호환성 검사 ───
  async function checkCompatibility(ingredientNames) {
    return fetchJSON('/api/check-compatibility', {
      method: 'POST',
      body: JSON.stringify({ ingredients: ingredientNames }),
    })
  }

  // ─── 규제 한도 검사 ───
  async function checkRegulationLimits(ingredients) {
    return fetchJSON('/api/check-regulation-limits', {
      method: 'POST',
      body: JSON.stringify({ ingredients }),
    })
  }

  // ─── 유사 제품 검색 ───
  async function searchSimilarProducts(ingredients, limit = 10) {
    return fetchJSON('/api/similar-products', {
      method: 'POST',
      body: JSON.stringify({ ingredients, limit }),
    })
  }

  // ─── 배치 스케일 계산 ───
  async function calcBatchScale(ingredients, currentBatchG, targetBatchG) {
    return fetchJSON('/api/batch-scale', {
      method: 'POST',
      body: JSON.stringify({ ingredients, currentBatchG, targetBatchG }),
    })
  }

  // ─── 수집 상태 ───
  async function getCollectionStatus() {
    return fetchJSON('/api/collection-status')
  }

  // ─── 건강 체크 ───
  async function healthCheck() {
    return fetchJSON('/api/health')
  }

  return {
    loading, error,
    getStats,
    getIngredients, getIngredient, getIngredientTypes,
    getRegulations, getRegulationSources,
    getKnowledge,
    getProducts, getProduct,
    getWorkflowLogs,
    generateGuideFormula,
    generateAiFormula,
    copyFormula,
    validateFormula,
    checkCompatibility,
    checkRegulationLimits,
    searchSimilarProducts,
    calcBatchScale,
    getCollectionStatus,
    healthCheck,
  }
}
