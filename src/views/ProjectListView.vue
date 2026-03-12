<template>
  <div class="project-page">
    <!-- New Project Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-box">
        <h3 class="modal-title">새 프로젝트</h3>
        <div class="form-group">
          <label class="form-label">프로젝트명 *</label>
          <input v-model="newProject.name" class="form-input" placeholder="프로젝트명">
        </div>
        <div class="form-group">
          <label class="form-label">설명</label>
          <input v-model="newProject.description" class="form-input" placeholder="프로젝트 설명">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showModal = false">취소</button>
          <button class="btn btn-primary" @click="onCreate">생성</button>
        </div>
      </div>
    </div>

    <!-- Project Cards -->
    <div class="project-grid" v-if="projectList.length">
      <div class="project-card" v-for="p in projectList" :key="p.id" @click="goToProject(p.id)">
        <div class="card-top">
          <div class="card-name">{{ p.name }}</div>
          <button class="btn-del" @click.stop="onDelete(p.id)" title="삭제">×</button>
        </div>
        <div class="card-desc" v-if="p.description">{{ p.description }}</div>
        <div class="card-divider"></div>
        <div class="card-stats">
          <div class="stat-row"><span class="stat-key">처방 수</span><span class="stat-val">{{ p.formulaCount }}</span></div>
          <div class="stat-row"><span class="stat-key">진행중</span><span class="stat-val">{{ p.reviewCount }}</span></div>
          <div class="stat-row"><span class="stat-key">완료</span><span class="stat-val">{{ p.doneCount }}</span></div>
          <div class="stat-row"><span class="stat-key">초안</span><span class="stat-val">{{ p.draftCount }}</span></div>
        </div>
        <div style="padding: 0 20px 4px">
          <ProgressBar :value="p.progress" color="var(--green)" />
        </div>
        <div class="card-footer">
          최근: {{ formatDate(p.lastUpdated) }}
        </div>
      </div>
    </div>
    <EmptyState v-else icon="◎" title="프로젝트가 없습니다" subtitle="프로젝트를 만들어 처방을 그룹으로 관리하세요">
      <button class="btn btn-primary" @click="showModal = true" style="margin-top:8px">새 프로젝트 만들기</button>
    </EmptyState>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../stores/projectStore.js'
import ProgressBar from '../components/common/ProgressBar.vue'
import EmptyState from '../components/common/EmptyState.vue'

const router = useRouter()
const { allProjects, addProject, deleteProject } = useProjectStore()

const showModal = ref(false)
const newProject = reactive({ name: '', description: '' })

const projectList = computed(() => allProjects())

function onCreate() {
  if (!newProject.name.trim()) { alert('프로젝트명을 입력하세요'); return }
  addProject({ ...newProject })
  newProject.name = ''
  newProject.description = ''
  showModal.value = false
}

function onDelete(id) {
  if (confirm('이 프로젝트를 삭제하시겠습니까?')) deleteProject(id)
}

function goToProject(id) {
  router.push({ path: '/formulas', query: { project: id } })
}

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()}`
}
</script>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.project-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.15s;
}
.project-card:hover { border-color: var(--accent-dim); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.card-top { padding: 18px 20px 8px; display: flex; justify-content: space-between; align-items: flex-start; }
.card-name { font-size: 15px; font-weight: 600; color: var(--text); }
.card-desc { padding: 0 20px; font-size: 12px; color: var(--text-sub); }
.card-divider { height: 1px; background: var(--border); margin: 10px 20px; }
.card-stats { padding: 0 20px 8px; }
.stat-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
.stat-key { color: var(--text-dim); }
.stat-val { font-weight: 600; color: var(--text); font-family: var(--font-mono); }
.card-footer {
  padding: 10px 20px;
  font-size: 11px;
  color: var(--text-dim);
  border-top: 1px solid var(--border);
}
.btn-del { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 16px; }
.btn-del:hover { color: var(--red); }

.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.modal-box {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 380px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.modal-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: var(--text); }
.form-group { margin-bottom: 12px; }
.form-label { font-size: 12px; color: var(--text-sub); margin-bottom: 4px; display: block; font-weight: 600; }
.form-input {
  width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; color: var(--text); background: var(--surface);
}
.form-input:focus { border-color: var(--accent); outline: none; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.btn { padding: 8px 16px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-ghost { border: 1px solid var(--border); background: transparent; color: var(--text-sub); }

@media (max-width: 1199px) { .project-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 767px) { .project-grid { grid-template-columns: 1fr; } }
</style>
