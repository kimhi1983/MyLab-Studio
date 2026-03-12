<template>
  <div class="formula-list-page">
    <!-- Filters -->
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">상태</label>
          <select v-model="filterStatus" class="filter-select">
            <option value="">전체</option>
            <option value="draft">초안</option>
            <option value="review">검토중</option>
            <option value="done">완료</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">프로젝트</label>
          <select v-model="filterProject" class="filter-select">
            <option value="">전체</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="filter-group search-group">
          <input v-model="searchQuery" class="filter-input" placeholder="처방명, 제형으로 검색..." @input="onSearch">
        </div>
        <div class="filter-group">
          <button class="btn-ghost-sm" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">테이블</button>
          <button class="btn-ghost-sm" :class="{ active: viewMode === 'card' }" @click="viewMode = 'card'">카드</button>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <div v-if="viewMode === 'table'" class="panel">
      <table class="data-table" v-if="filtered.length">
        <thead>
          <tr>
            <th>ID</th>
            <th>처방명</th>
            <th>제형</th>
            <th>성분 수</th>
            <th>상태</th>
            <th>프로젝트</th>
            <th>수정일</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in filtered" :key="f.id" @click="$router.push('/formulas/' + f.id)">
            <td class="cell-id">{{ f.id }}</td>
            <td class="cell-title">{{ f.title }}</td>
            <td>{{ f.product_type || '-' }}</td>
            <td class="cell-num">{{ f.formula_data?.ingredients?.length || 0 }}</td>
            <td><StatusChip :status="f.status" /></td>
            <td class="cell-project">{{ getProjectName(f.project_id) }}</td>
            <td class="cell-date">{{ formatDate(f.updated_at) }}</td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else icon="⚗" title="처방이 없습니다" subtitle="새 처방을 작성하거나 MyLab 가이드를 이용해보세요">
        <router-link to="/formulas/new" class="btn btn-primary" style="display:inline-block;margin-top:8px">새 처방 작성</router-link>
      </EmptyState>
    </div>

    <!-- Card View -->
    <div v-else class="card-grid">
      <FormulaCard v-for="f in filtered" :key="f.id" :formula="f" @click="$router.push('/formulas/' + f.id)" />
      <EmptyState v-if="!filtered.length" icon="⚗" title="처방이 없습니다" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFormulaStore } from '../stores/formulaStore.js'
import { useProjectStore } from '../stores/projectStore.js'
import StatusChip from '../components/common/StatusChip.vue'
import EmptyState from '../components/common/EmptyState.vue'
import FormulaCard from '../components/formula/FormulaCard.vue'

const { searchFormulas } = useFormulaStore()
const { projects } = useProjectStore()

const filterStatus = ref('')
const filterProject = ref('')
const searchQuery = ref('')
const viewMode = ref('table')

const filtered = computed(() =>
  searchFormulas(searchQuery.value, {
    status: filterStatus.value || undefined,
    project_id: filterProject.value || undefined,
  })
)

function getProjectName(id) {
  if (!id) return '-'
  const p = projects.value.find(p => p.id === id)
  return p ? p.name : '-'
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function onSearch() {}
</script>

<style scoped>
.filter-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 20px;
  margin-bottom: 16px;
  box-shadow: var(--shadow);
}
.filter-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); }
.filter-select, .filter-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  min-width: 120px;
}
.filter-select:focus, .filter-input:focus { border-color: var(--accent); outline: none; }
.search-group { flex: 1; min-width: 200px; }
.search-group .filter-input { width: 100%; }

.btn-ghost-sm {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-sub);
  font-size: 12px;
  cursor: pointer;
}
.btn-ghost-sm.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent-dim); }

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.data-table { width: 100%; border-collapse: collapse; }
.data-table th {
  background: var(--bg);
  font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1px;
  color: var(--text-dim); padding: 8px 16px; text-align: left;
}
.data-table td { padding: 10px 16px; font-size: 12.5px; border-bottom: 1px solid var(--border); }
.data-table tbody tr { cursor: pointer; }
.data-table tbody tr:hover { background: var(--bg); }
.cell-id { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
.cell-title { font-weight: 500; }
.cell-num { font-family: var(--font-mono); text-align: center; }
.cell-project { font-size: 12px; color: var(--text-sub); }
.cell-date { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); }

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.btn { padding: 8px 16px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; }
.btn-primary { background: var(--accent); color: #fff; }

@media (max-width: 1199px) { .card-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 767px) { .card-grid { grid-template-columns: 1fr; } }
</style>
