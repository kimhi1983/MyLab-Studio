import { computed } from 'vue'
import { useLocalStorage } from '../composables/useLocalStorage.js'

const notes = useLocalStorage('mylab:notes', [])

function generateId() {
  return 'note-' + String(Date.now()).slice(-8) + Math.random().toString(36).slice(2, 5)
}

const SEED_NOTES = [
  {
    id: generateId(),
    title: 'Bakuchiol 안정성 메모',
    content: '## 성분 관찰 기록\n\n- Bakuchiol 0.5% 농도에서 pH 6 조건 안정적\n- 레티놀 대비 자극 지수 낮음 (패치테스트 결과)\n- 혼합 금지: 강산성 환경 (pH < 4) → 변색 가능성\n- 권장 보관: 차광, 15~25°C\n\n추가 테스트 필요: 열 안정성 50°C 4주 결과 확인 예정',
    tag: 'ingredient',
    formulaIds: [],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: generateId(),
    title: '선크림 규제 요약 — EU/국내',
    content: '## 자외선 차단제 규제 비교\n\n### 국내 (식약처)\n- Titanium Dioxide: 최대 25%\n- Zinc Oxide: 최대 25%\n- Ethylhexyl Methoxycinnamate: 최대 7.5%\n\n### EU (Annex VI)\n- Titanium Dioxide (나노): 나노형 별도 고시 필요\n- Zinc Oxide (나노): 최대 25%, 단 스프레이 사용 불가\n\n### 주의사항\n- 나노 원료 표기: INCI명 뒤에 [nano] 병기\n- 2025년 개정 고시 확인 필요',
    tag: 'regulation',
    formulaIds: [],
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
  },
]

function seedNotes() {
  if (notes.value.length === 0) {
    notes.value = [...SEED_NOTES]
  }
}

seedNotes()

export function useNoteStore() {
  const allNotes = computed(() =>
    [...notes.value].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  )

  function getById(id) {
    return notes.value.find(n => n.id === id) || null
  }

  function notesByFormula(formulaId) {
    return notes.value.filter(n => n.formulaIds && n.formulaIds.includes(formulaId))
  }

  function addNote(data = {}) {
    const now = new Date().toISOString()
    const note = {
      id: generateId(),
      title: data.title || '새 노트',
      content: data.content || '',
      tag: data.tag || 'general',
      formulaIds: data.formulaIds || [],
      created_at: now,
      updated_at: now,
    }
    notes.value = [note, ...notes.value]
    return note
  }

  function updateNote(id, data) {
    const idx = notes.value.findIndex(n => n.id === id)
    if (idx === -1) return null
    const updated = {
      ...notes.value[idx],
      ...data,
      id: notes.value[idx].id,
      created_at: notes.value[idx].created_at,
      updated_at: new Date().toISOString(),
    }
    const next = [...notes.value]
    next[idx] = updated
    notes.value = next
    return updated
  }

  function deleteNote(id) {
    notes.value = notes.value.filter(n => n.id !== id)
  }

  return {
    notes,
    allNotes,
    getById,
    notesByFormula,
    addNote,
    updateNote,
    deleteNote,
  }
}
