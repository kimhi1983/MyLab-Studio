<template>
  <div class="notes-page">
    <!-- 좌측 목록 패널 -->
    <aside class="notes-sidebar">
      <div class="sidebar-header">
        <span class="section-label">RESEARCH NOTES</span>
        <button class="btn-new" @click="onNewNote">+ 새 노트</button>
      </div>

      <!-- 태그 필터 -->
      <div class="tag-filter-row">
        <button
          v-for="f in tagFilters"
          :key="f.value"
          class="filter-chip"
          :class="{ active: activeFilter === f.value }"
          :style="activeFilter === f.value ? { background: f.bg, color: f.color, borderColor: f.border } : {}"
          @click="activeFilter = activeFilter === f.value ? '' : f.value"
        >
          {{ f.label }}
        </button>
      </div>

      <!-- 노트 목록 -->
      <div class="note-list">
        <div
          v-for="note in filteredNotes"
          :key="note.id"
          class="note-item"
          :class="{ active: selectedId === note.id }"
          @click="selectNote(note.id)"
        >
          <div class="note-item-top">
            <span class="note-item-title">{{ note.title || '제목 없음' }}</span>
            <span class="note-tag-chip" :style="tagStyle(note.tag)">{{ tagLabel(note.tag) }}</span>
          </div>
          <div class="note-item-date">{{ formatDate(note.updated_at) }}</div>
          <div class="note-item-preview">{{ previewContent(note.content) }}</div>
        </div>
        <EmptyState
          v-if="filteredNotes.length === 0"
          icon="◎"
          title="노트가 없습니다"
          :subtitle="activeFilter ? '해당 태그의 노트가 없습니다' : '새 노트를 작성해 보세요'"
        />
      </div>
    </aside>

    <!-- 우측 편집기 -->
    <main class="notes-editor">
      <!-- 선택된 노트 없음 -->
      <div v-if="!selectedId" class="editor-empty">
        <EmptyState
          icon="◈"
          title="노트를 선택하세요"
          subtitle="좌측 목록에서 노트를 선택하거나 새 노트를 작성하세요"
        />
      </div>

      <!-- 편집기 본체 -->
      <template v-else>
        <div class="editor-top">
          <div class="editor-top-left">
            <span class="section-label">NOTE EDITOR</span>
          </div>
          <div class="editor-top-right">
            <button class="btn-danger" @click="onDelete">삭제</button>
            <button class="btn-save" @click="onSave">저장</button>
          </div>
        </div>

        <!-- 제목 -->
        <div class="editor-field">
          <input
            v-model="form.title"
            class="editor-title-input"
            placeholder="노트 제목을 입력하세요..."
          >
        </div>

        <!-- 태그 선택 -->
        <div class="editor-field editor-tag-row">
          <span class="field-label">태그</span>
          <div class="tag-select-row">
            <button
              v-for="t in tagFilters"
              :key="t.value"
              class="tag-select-btn"
              :class="{ active: form.tag === t.value }"
              :style="form.tag === t.value ? { background: t.bg, color: t.color, borderColor: t.border } : {}"
              @click="form.tag = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- 내용 textarea -->
        <div class="editor-content-wrap">
          <div class="line-numbers" aria-hidden="true">
            <span v-for="n in lineCount" :key="n">{{ n }}</span>
          </div>
          <textarea
            ref="textareaRef"
            v-model="form.content"
            class="editor-textarea"
            placeholder="내용을 입력하세요... (Markdown 형식 지원)"
            spellcheck="false"
            @input="syncScroll"
            @scroll="syncScroll"
          ></textarea>
        </div>

        <!-- 연결된 처방 -->
        <div class="linked-section">
          <div class="linked-header">
            <span class="field-label">연결된 처방</span>
            <div class="formula-link-wrap">
              <button class="btn-link-formula" @click="showFormulaDropdown = !showFormulaDropdown">
                + 처방 연결
              </button>
              <!-- 처방 선택 드롭다운 -->
              <div v-if="showFormulaDropdown" class="formula-dropdown">
                <div class="dropdown-header">처방 선택</div>
                <div
                  v-for="f in availableFormulas"
                  :key="f.id"
                  class="dropdown-item"
                  :class="{ linked: form.formulaIds.includes(f.id) }"
                  @click="toggleFormulaLink(f.id)"
                >
                  <span class="dropdown-check">{{ form.formulaIds.includes(f.id) ? '✓' : '' }}</span>
                  <span class="dropdown-name">{{ f.title }}</span>
                  <span class="dropdown-type">{{ f.product_type || '미지정' }}</span>
                </div>
                <div v-if="availableFormulas.length === 0" class="dropdown-empty">처방이 없습니다</div>
                <button class="dropdown-close" @click="showFormulaDropdown = false">닫기</button>
              </div>
            </div>
          </div>
          <div class="linked-chips">
            <span
              v-for="fid in form.formulaIds"
              :key="fid"
              class="linked-chip"
            >
              {{ formulaTitle(fid) }}
              <button class="chip-del" @click="unlinkFormula(fid)">×</button>
            </span>
            <span v-if="form.formulaIds.length === 0" class="linked-empty">연결된 처방 없음</span>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, nextTick } from 'vue'
import { useNoteStore } from '../stores/noteStore.js'
import { useFormulaStore } from '../stores/formulaStore.js'
import EmptyState from '../components/common/EmptyState.vue'

const { allNotes, addNote, updateNote, deleteNote } = useNoteStore()
const { formulas } = useFormulaStore()

// --- 태그 정의 ---
const tagFilters = [
  { value: 'ingredient',   label: '원료',   color: '#3a6fa8', bg: '#f0f4fb', border: '#b8cce8' },
  { value: 'regulation',   label: '규제',   color: '#b07820', bg: '#fdf8f0', border: '#e8d4a0' },
  { value: 'formulation',  label: '처방',   color: '#3a9068', bg: '#f0f8f4', border: '#b8dece' },
  { value: 'general',      label: '일반',   color: '#7c5cbf', bg: '#f6f2fd', border: '#d0c0f0' },
]

const TAG_MAP = Object.fromEntries(tagFilters.map(t => [t.value, t]))

function tagLabel(tag) {
  return TAG_MAP[tag]?.label || tag || '일반'
}
function tagStyle(tag) {
  const t = TAG_MAP[tag]
  if (!t) return {}
  return { background: t.bg, color: t.color, borderColor: t.border }
}

// --- 상태 ---
const activeFilter = ref('')
const selectedId = ref(null)
const showFormulaDropdown = ref(false)
const textareaRef = ref(null)
const lineNumbersRef = ref(null)

const form = reactive({
  title: '',
  content: '',
  tag: 'general',
  formulaIds: [],
})

// --- 필터링된 목록 ---
const filteredNotes = computed(() => {
  if (!activeFilter.value) return allNotes.value
  return allNotes.value.filter(n => n.tag === activeFilter.value)
})

// --- 처방 목록 ---
const availableFormulas = computed(() => formulas.value)

// --- 줄 번호 ---
const lineCount = computed(() => {
  const lines = (form.content || '').split('\n').length
  return Math.max(lines, 10)
})

// --- 노트 선택 ---
function selectNote(id) {
  const note = allNotes.value.find(n => n.id === id)
  if (!note) return
  selectedId.value = id
  form.title = note.title
  form.content = note.content
  form.tag = note.tag
  form.formulaIds = [...(note.formulaIds || [])]
  showFormulaDropdown.value = false
}

// --- 새 노트 ---
function onNewNote() {
  const note = addNote({ title: '새 노트', content: '', tag: 'general', formulaIds: [] })
  nextTick(() => selectNote(note.id))
}

// --- 저장 ---
function onSave() {
  if (!selectedId.value) return
  updateNote(selectedId.value, {
    title: form.title,
    content: form.content,
    tag: form.tag,
    formulaIds: [...form.formulaIds],
  })
}

// --- 삭제 ---
function onDelete() {
  if (!selectedId.value) return
  if (!confirm('이 노트를 삭제하시겠습니까?')) return
  deleteNote(selectedId.value)
  selectedId.value = null
}

// --- 처방 연결/해제 ---
function toggleFormulaLink(fid) {
  const idx = form.formulaIds.indexOf(fid)
  if (idx === -1) {
    form.formulaIds.push(fid)
  } else {
    form.formulaIds.splice(idx, 1)
  }
}

function unlinkFormula(fid) {
  const idx = form.formulaIds.indexOf(fid)
  if (idx !== -1) form.formulaIds.splice(idx, 1)
}

function formulaTitle(fid) {
  const f = formulas.value.find(f => f.id === fid)
  return f ? f.title : fid
}

// --- 줄 번호 스크롤 동기화 ---
function syncScroll() {
  const ta = textareaRef.value
  const ln = document.querySelector('.line-numbers')
  if (ta && ln) ln.scrollTop = ta.scrollTop
}

// --- 유틸 ---
function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '방금 전'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function previewContent(content) {
  if (!content) return ''
  const plain = content.replace(/[#*`>\-_\[\]]/g, '').trim()
  return plain.slice(0, 60) + (plain.length > 60 ? '…' : '')
}
</script>

<style scoped>
.notes-page {
  display: flex;
  height: calc(100vh - 80px);
  overflow: hidden;
  gap: 0;
}

/* 좌측 사이드바 */
.notes-sidebar {
  width: 280px;
  min-width: 220px;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.section-label {
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
}

.btn-new {
  padding: 5px 10px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-new:hover { background: var(--accent); color: #fff; }

/* 태그 필터 */
.tag-filter-row {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.filter-chip {
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: transparent;
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.filter-chip:hover { color: var(--text-sub); }
.filter-chip.active { font-weight: 700; }

/* 노트 목록 */
.note-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.note-item {
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.note-item:hover { background: var(--bg); }
.note-item.active { background: var(--accent-light); border-left: 3px solid var(--accent); padding-left: 11px; }

.note-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
}

.note-item-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.note-tag-chip {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  font-size: 9px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
}

.note-item-date {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 3px;
}

.note-item-preview {
  font-size: 11px;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 우측 편집기 */
.notes-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.editor-top-right { display: flex; gap: 8px; align-items: center; }

.btn-save {
  padding: 6px 16px;
  border: none;
  border-radius: 5px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.btn-save:hover { background: #a68350; }

.btn-danger {
  padding: 5px 10px;
  border: 1px solid var(--red);
  border-radius: 4px;
  background: transparent;
  color: var(--red);
  font-size: 12px;
  cursor: pointer;
}
.btn-danger:hover { background: var(--red-bg); }

/* 에디터 필드 */
.editor-field {
  padding: 10px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.editor-title-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  padding: 0;
}
.editor-title-input::placeholder { color: var(--text-dim); }

.editor-tag-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  white-space: nowrap;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tag-select-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-select-btn {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.tag-select-btn:hover { background: var(--bg); }
.tag-select-btn.active { font-weight: 700; }

/* 내용 에디터 (줄 번호 포함) */
.editor-content-wrap {
  flex: 1;
  display: flex;
  overflow: hidden;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.line-numbers {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 16px 8px 16px 16px;
  background: var(--bg);
  border-right: 1px solid var(--border);
  user-select: none;
  overflow: hidden;
  min-width: 44px;
  line-height: 22px;
}

.line-numbers span {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-dim);
  height: 22px;
  display: block;
}

.editor-textarea {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  padding: 16px;
  font-size: 13px;
  font-family: var(--font-mono);
  color: var(--text);
  background: var(--surface);
  line-height: 22px;
  overflow-y: auto;
}
.editor-textarea::placeholder { color: var(--text-dim); }

/* 연결된 처방 */
.linked-section {
  padding: 12px 20px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.linked-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.formula-link-wrap { position: relative; }

.btn-link-formula {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.btn-link-formula:hover { background: var(--bg); color: var(--text); }

/* 드롭다운 */
.formula-dropdown {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  min-width: 260px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  z-index: 100;
  overflow: hidden;
}

.dropdown-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--border);
}
.dropdown-item:last-of-type { border-bottom: none; }
.dropdown-item:hover { background: var(--bg); }
.dropdown-item.linked { background: var(--accent-light); }

.dropdown-check {
  width: 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  flex-shrink: 0;
}

.dropdown-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-type {
  font-size: 10px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.dropdown-empty {
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
}

.dropdown-close {
  width: 100%;
  padding: 7px;
  border: none;
  border-top: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
}
.dropdown-close:hover { color: var(--text-sub); }

/* 연결된 처방 칩 */
.linked-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.linked-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--accent-dim);
}

.chip-del {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  line-height: 1;
}
.chip-del:hover { color: var(--red); }

.linked-empty {
  font-size: 11px;
  color: var(--text-dim);
}

/* 반응형 */
@media (max-width: 767px) {
  .notes-page {
    flex-direction: column;
    height: auto;
  }
  .notes-sidebar {
    width: 100%;
    max-width: none;
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 40vh;
  }
  .notes-editor {
    min-height: 60vh;
  }
}
</style>
