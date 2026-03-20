import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/register', name: 'register', component: () => import('./views/RegisterView.vue'), meta: { public: true } },

  { path: '/', name: 'dashboard', component: () => import('./views/DashboardView.vue'), meta: { title: '대시보드', requireAuth: true } },
  { path: '/formulas', name: 'formula-list', component: () => import('./views/FormulaListView.vue'), meta: { title: '처방 목록', requireAuth: true } },
  { path: '/formulas/new', name: 'formula-new', component: () => import('./views/FormulaEditView.vue'), meta: { title: '새 처방', requireAuth: true } },
  { path: '/formulas/:id', name: 'formula-edit', component: () => import('./views/FormulaEditView.vue'), meta: { title: '처방 편집', requireAuth: true } },
  { path: '/journal', name: 'journal', component: () => import('./views/JournalView.vue'), meta: { title: '처방 일지', requireAuth: true } },
  { path: '/projects', name: 'projects', component: () => import('./views/ProjectListView.vue'), meta: { title: '프로젝트', requireAuth: true } },
  { path: '/stability', name: 'stability', component: () => import('./views/StabilityView.vue'), meta: { title: '안정성 시험', requireAuth: true } },
  { path: '/ingredients', name: 'ingredient-db', component: () => import('./views/IngredientDbView.vue'), meta: { title: '성분 DB', requireAuth: true } },
  { path: '/notes', name: 'notes', component: () => import('./views/NotesView.vue'), meta: { title: '연구 노트', requireAuth: true } },
  { path: '/validation', name: 'validation', component: () => import('./views/ValidationView.vue'), meta: { title: '품질 검증', requireAuth: true } },
  { path: '/hlb-calc', name: 'hlb-calc', component: () => import('./views/HlbCalcView.vue'), meta: { title: 'HLB 계산기', requireAuth: true } },
  { path: '/verify', name: 'verify', component: () => import('./views/VerifyView.vue'), meta: { title: '처방 검증', requireAuth: true } },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue'), meta: { title: '관리자', requireAuth: true, requireAdmin: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const token = localStorage.getItem('mylab:auth-token')
  const userStr = localStorage.getItem('mylab:auth-user')
  const user = userStr ? JSON.parse(userStr) : null

  if (to.meta.requireAuth && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requireAdmin && user?.role !== 'admin') {
    return { name: 'dashboard' }
  }
  if (to.meta.public && token && (to.name === 'login' || to.name === 'register')) {
    return { name: 'dashboard' }
  }
})

export default router
