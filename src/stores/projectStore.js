import { computed } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage.js'
import { useFormulaStore } from './formulaStore.js'

const projects = useLocalStorage('mylab:projects', [])

function generateId() {
  return 'P-' + String(Date.now()).slice(-6) + Math.random().toString(36).slice(2, 5)
}

const SEED_PROJECTS = [
  { name: '2025 S/S 쿠션 라인', description: '파운데이션 + 컨실러', color: '#b8935a' },
  { name: '선케어 리뉴얼', description: 'SPF50+ 라인 업그레이드', color: '#3a6fa8' },
]

function seedProjects() {
  if (projects.value.length === 0) {
    const now = new Date()
    SEED_PROJECTS.forEach((data, idx) => {
      projects.value.push({
        id: generateId(),
        name: data.name,
        description: data.description,
        color: data.color,
        created_at: new Date(now.getTime() - idx * 3600000 * 24 * 3).toISOString(),
      })
    })
  }
}

// 앱 초기화 시 seed 실행
seedProjects()

export function useProjectStore() {
  const { formulas } = useFormulaStore()

  function allProjects() {
    return projects.value.map(p => {
      const pFormulas = formulas.value.filter(f => f.project_id === p.id)
      return {
        ...p,
        formulaCount: pFormulas.length,
        draftCount: pFormulas.filter(f => f.status === 'draft').length,
        reviewCount: pFormulas.filter(f => f.status === 'review').length,
        doneCount: pFormulas.filter(f => f.status === 'done').length,
        progress: pFormulas.length ? Math.round((pFormulas.filter(f => f.status === 'done').length / pFormulas.length) * 100) : 0,
        lastUpdated: pFormulas.length
          ? pFormulas.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0].updated_at
          : p.created_at,
      }
    })
  }

  function addProject(data) {
    const project = {
      id: generateId(),
      name: data.name,
      description: data.description || '',
      color: data.color || '#b8935a',
      created_at: new Date().toISOString(),
    }
    projects.value.push(project)
    return project
  }

  function deleteProject(id) {
    projects.value = projects.value.filter(p => p.id !== id)
  }

  function updateProject(id, data) {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx === -1) return null
    projects.value[idx] = { ...projects.value[idx], ...data }
    projects.value = [...projects.value]
    return projects.value[idx]
  }

  return { projects, allProjects, addProject, deleteProject, updateProject }
}
