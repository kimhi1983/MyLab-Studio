import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { title: '대시보드' } },
  { path: '/formulas', name: 'formula-list', component: () => import('./views/FormulaListView.vue'), meta: { title: '처방 목록' } },
  { path: '/formulas/new', name: 'formula-new', component: () => import('./views/FormulaEditView.vue'), meta: { title: '새 처방' } },
  { path: '/formulas/:id', name: 'formula-edit', component: () => import('./views/FormulaEditView.vue'), meta: { title: '처방 편집' } },
  { path: '/journal', name: 'journal', component: () => import('./views/JournalView.vue'), meta: { title: '처방 일지' } },
  { path: '/projects', name: 'projects', component: () => import('./views/ProjectListView.vue'), meta: { title: '프로젝트' } },
  { path: '/ai-guide', name: 'ai-guide', component: () => import('./views/AiGuideView.vue'), meta: { title: 'MyLab 가이드 처방' } },
  { path: '/ingredients', name: 'ingredient-db', component: () => import('./views/IngredientDbView.vue'), meta: { title: '성분 DB' } },
  { path: '/notes', name: 'notes', component: () => import('./views/NotesView.vue'), meta: { title: '연구 노트' } },
  { path: '/validation', name: 'validation', component: () => import('./views/ValidationView.vue'), meta: { title: '품질 검증' } },
  { path: '/hlb-calc', name: 'hlb-calc', component: () => import('./views/HlbCalcView.vue'), meta: { title: 'HLB 계산기' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
