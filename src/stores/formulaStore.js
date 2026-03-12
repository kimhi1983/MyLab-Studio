import { reactive, computed } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage.js'

const formulas = useLocalStorage('mylab:formulas', [])

function generateId() {
  return 'F-' + String(Date.now()).slice(-6) + Math.random().toString(36).slice(2, 5)
}

// 처음 방문 시 자동 생성되는 데모 처방 데이터
const SEED_FORMULAS = [
  {
    title: '쿠션 파운데이션 21호',
    product_type: 'W/Si 에멀전',
    status: 'review',
    tags: ['쿠션', '파운데이션'],
    memo: 'v3.2 — pH 5.8, 점도 3,200 cps',
    formula_data: {
      ingredients: [
        { name: 'Cyclopentasiloxane', inci: 'Cyclopentasiloxane', percentage: 30.0, function: '용매/텍스처', phase: 'B' },
        { name: 'Titanium Dioxide', inci: 'Titanium Dioxide', percentage: 15.0, function: '자외선 차단/커버', phase: 'C' },
        { name: 'Glycerin', inci: 'Glycerin', percentage: 5.0, function: '보습', phase: 'A' },
        { name: 'Niacinamide', inci: 'Niacinamide', percentage: 2.0, function: '미백/진정', phase: 'C' },
        { name: 'PEG-10 Dimethicone', inci: 'PEG-10 Dimethicone', percentage: 3.0, function: '유화제', phase: 'B' },
      ],
      total_percentage: 55.0,
      notes: '3차 안정성 테스트 진행 중. 50°C 8주 결과 양호.',
    },
  },
  {
    title: '선스틱 SPF50+',
    product_type: '오일스틱',
    status: 'review',
    tags: ['선케어'],
    memo: 'pH 6.1',
    formula_data: {
      ingredients: [
        { name: 'Titanium Dioxide', inci: 'Titanium Dioxide', percentage: 20.0, function: '자외선 차단', phase: 'C' },
        { name: 'Zinc Oxide', inci: 'Zinc Oxide', percentage: 10.0, function: '자외선 차단', phase: 'C' },
        { name: 'Caprylic/Capric Triglyceride', inci: 'Caprylic/Capric Triglyceride', percentage: 25.0, function: '기제', phase: 'B' },
        { name: 'Beeswax', inci: 'Cera Alba', percentage: 12.0, function: '굳힘제', phase: 'B' },
      ],
      total_percentage: 67.0,
      notes: 'SPF 실측값 확인 필요. 사용감 개선 검토 중.',
    },
  },
  {
    title: '클렌징 폼 약산성',
    product_type: 'O/W 폼',
    status: 'done',
    tags: ['클렌징'],
    memo: 'v5.4 — pH 5.5, 점도 12,000 cps',
    formula_data: {
      ingredients: [
        { name: 'Sodium Cocoyl Isethionate', inci: 'Sodium Cocoyl Isethionate', percentage: 18.0, function: '계면활성제', phase: 'B' },
        { name: 'Glycerin', inci: 'Glycerin', percentage: 8.0, function: '보습', phase: 'A' },
        { name: 'Niacinamide', inci: 'Niacinamide', percentage: 2.0, function: '미백/진정', phase: 'C' },
        { name: 'Lactic Acid', inci: 'Lactic Acid', percentage: 0.5, function: 'pH 조정', phase: 'C' },
        { name: 'Water', inci: 'Aqua', percentage: 69.5, function: '정제수', phase: 'A' },
      ],
      total_percentage: 98.0,
      notes: '최종 승인 완료. 양산 이관 예정.',
    },
  },
  {
    title: '세럼 — 바쿠치올 라인',
    product_type: '수용성 세럼',
    status: 'draft',
    tags: ['안티에이징'],
    memo: 'v1.1 — pH 6, 점도 4,500 cps',
    formula_data: {
      ingredients: [
        { name: 'Bakuchiol', inci: 'Bakuchiol', percentage: 0.5, function: '레티놀 대체/안티에이징', phase: 'C' },
        { name: 'Niacinamide', inci: 'Niacinamide', percentage: 5.0, function: '미백/진정', phase: 'C' },
        { name: 'Glycerin', inci: 'Glycerin', percentage: 7.0, function: '보습', phase: 'A' },
        { name: 'Hyaluronic Acid', inci: 'Sodium Hyaluronate', percentage: 0.5, function: '보습/탄력', phase: 'A' },
        { name: 'Water', inci: 'Aqua', percentage: 85.0, function: '정제수', phase: 'A' },
      ],
      total_percentage: 98.0,
      notes: '초기 처방 단계. 원료 소싱 확인 중.',
    },
  },
]

function seedFormulas() {
  if (formulas.value.length === 0) {
    const now = new Date()
    SEED_FORMULAS.forEach((data, idx) => {
      const updatedAt = new Date(now.getTime() - idx * 3600000 * 12).toISOString()
      const createdAt = new Date(now.getTime() - idx * 3600000 * 24 * 7).toISOString()
      formulas.value.push({
        id: generateId(),
        user_id: 'local-user',
        title: data.title,
        product_type: data.product_type,
        status: data.status,
        formula_data: data.formula_data,
        memo: data.memo,
        tags: data.tags,
        project_id: '',
        created_at: createdAt,
        updated_at: updatedAt,
        version: 1,
        version_history: [],
      })
    })
  }
}

// 앱 초기화 시 seed 실행
seedFormulas()

export function useFormulaStore() {
  const totalCount = computed(() => formulas.value.length)
  const draftCount = computed(() => formulas.value.filter(f => f.status === 'draft').length)
  const reviewCount = computed(() => formulas.value.filter(f => f.status === 'review').length)
  const doneCount = computed(() => formulas.value.filter(f => f.status === 'done').length)

  function recentFormulas(n = 5) {
    return [...formulas.value].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, n)
  }

  function byProject(projectId) {
    return formulas.value.filter(f => f.project_id === projectId)
  }

  function byStatus(status) {
    return formulas.value.filter(f => f.status === status)
  }

  function getById(id) {
    return formulas.value.find(f => f.id === id)
  }

  function addFormula(data) {
    const now = new Date().toISOString()
    const formula = {
      id: generateId(),
      user_id: 'local-user',
      title: data.title || '새 처방',
      product_type: data.product_type || '',
      status: 'draft',
      formula_data: data.formula_data || { ingredients: [], total_percentage: 0, notes: '' },
      memo: data.memo || '',
      tags: data.tags || [],
      project_id: data.project_id || '',
      created_at: now,
      updated_at: now,
      version: 1,
      version_history: [],
    }
    formulas.value.push(formula)
    return formula
  }

  function updateFormula(id, data) {
    const idx = formulas.value.findIndex(f => f.id === id)
    if (idx === -1) return null
    const updated = { ...formulas.value[idx], ...data, updated_at: new Date().toISOString() }
    formulas.value[idx] = updated
    // Trigger reactivity
    formulas.value = [...formulas.value]
    return updated
  }

  function deleteFormula(id) {
    formulas.value = formulas.value.filter(f => f.id !== id)
  }

  function changeStatus(id, status) {
    return updateFormula(id, { status })
  }

  // 현재 상태를 version_history에 스냅샷으로 저장하고 version 번호를 올린다
  function saveVersion(id) {
    const idx = formulas.value.findIndex(f => f.id === id)
    if (idx === -1) return null
    const f = formulas.value[idx]
    const currentVersion = f.version || 1
    const snapshot = {
      version: currentVersion,
      saved_at: new Date().toISOString(),
      title: f.title,
      product_type: f.product_type,
      status: f.status,
      formula_data: JSON.parse(JSON.stringify(f.formula_data)),
      memo: f.memo,
      tags: [...(f.tags || [])],
    }
    const history = [...(f.version_history || []), snapshot]
    const updated = {
      ...f,
      version: currentVersion + 1,
      version_history: history,
      updated_at: new Date().toISOString(),
    }
    formulas.value[idx] = updated
    formulas.value = [...formulas.value]
    return updated
  }

  // 특정 버전 인덱스로 처방 데이터를 복원한다
  function restoreVersion(id, versionIndex) {
    const idx = formulas.value.findIndex(f => f.id === id)
    if (idx === -1) return null
    const f = formulas.value[idx]
    const history = f.version_history || []
    if (versionIndex < 0 || versionIndex >= history.length) return null
    const snap = history[versionIndex]
    const updated = {
      ...f,
      title: snap.title,
      product_type: snap.product_type,
      status: snap.status,
      formula_data: JSON.parse(JSON.stringify(snap.formula_data)),
      memo: snap.memo,
      tags: [...(snap.tags || [])],
      updated_at: new Date().toISOString(),
    }
    formulas.value[idx] = updated
    formulas.value = [...formulas.value]
    return updated
  }

  // 버전 히스토리 반환
  function getVersionHistory(id) {
    const f = formulas.value.find(f => f.id === id)
    if (!f) return []
    return f.version_history || []
  }

  function searchFormulas(query, filters = {}) {
    let result = [...formulas.value]
    if (query) {
      const q = query.toLowerCase()
      result = result.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.product_type.toLowerCase().includes(q) ||
        f.memo.toLowerCase().includes(q)
      )
    }
    if (filters.status) result = result.filter(f => f.status === filters.status)
    if (filters.project_id) result = result.filter(f => f.project_id === filters.project_id)
    return result.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  }

  return {
    formulas,
    totalCount, draftCount, reviewCount, doneCount,
    recentFormulas, byProject, byStatus, getById,
    addFormula, updateFormula, deleteFormula, changeStatus,
    saveVersion, restoreVersion, getVersionHistory,
    searchFormulas,
  }
}
