import { ref, computed } from 'vue'
import { useAPI } from '../composables/useAPI.js'

const api = useAPI()
const stats = ref(null)
const ingredients = ref([])
const ingredientTypes = ref([])
const totalIngredients = ref(0)
const regulationSources = ref([])
const isReady = ref(false)

/**
 * n8n 워크플로우 수집 데이터 기반 원료 Store
 * coching_db의 ingredient_master, regulation_cache, coching_knowledge_base 연동
 */
export function useIngredientStore() {
  // 초기 로딩 (통계 + 타입 목록)
  async function init() {
    if (isReady.value) return
    const [statsData, typesData, sourcesData] = await Promise.all([
      api.getStats(),
      api.getIngredientTypes(),
      api.getRegulationSources(),
    ])
    if (statsData) stats.value = statsData
    if (typesData) ingredientTypes.value = typesData
    if (sourcesData) regulationSources.value = sourcesData
    isReady.value = true
  }

  // 원료 검색
  async function searchIngredients({ q, type, limit = 50, offset = 0 } = {}) {
    const data = await api.getIngredients({ q, type, limit, offset })
    if (data) {
      ingredients.value = data.items
      totalIngredients.value = data.total
    }
    return data
  }

  // 원료 상세
  async function getIngredientDetail(id) {
    return api.getIngredient(id)
  }

  // 규제 검색
  async function searchRegulations({ source, q, limit = 50, offset = 0 } = {}) {
    return api.getRegulations({ source, q, limit, offset })
  }

  // 지식베이스 검색
  async function searchKnowledge({ q, limit = 20 } = {}) {
    return api.getKnowledge({ q, limit })
  }

  // 가이드 처방 생성 (실제 DB 기반)
  async function generateFormula(productType, requirements) {
    return api.generateGuideFormula(productType, requirements)
  }

  // 처방 생성 (AI 처방 엔진)
  async function generateAiFormula(data) {
    return api.generateAiFormula(data)
  }

  // 제품 검색 (product_master)
  async function searchProducts({ q, category, limit = 50, offset = 0 } = {}) {
    return api.getProducts({ q, category, limit, offset })
  }

  // 제품 상세
  async function getProductDetail(id) {
    return api.getProduct(id)
  }

  // 수집 상태
  async function getCollectionStatus() {
    return api.getCollectionStatus()
  }

  // 워크플로우 로그
  async function getWorkflowLogs({ limit = 20 } = {}) {
    return api.getWorkflowLogs({ limit })
  }

  return {
    stats,
    ingredients,
    ingredientTypes,
    totalIngredients,
    regulationSources,
    isReady,
    loading: api.loading,
    error: api.error,
    init,
    searchIngredients,
    getIngredientDetail,
    searchRegulations,
    searchKnowledge,
    searchProducts,
    getProductDetail,
    getCollectionStatus,
    getWorkflowLogs,
    generateFormula,
    generateAiFormula,
  }
}
