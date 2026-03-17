<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-brand">
      <div class="brand-label">COCHING</div>
      <div v-if="!collapsed" class="brand-title">MyLab Studio</div>
      <div v-if="!collapsed" class="brand-sub">Cosmetic R&D</div>
    </div>

    <nav class="sidebar-nav">
      <template v-for="(item, idx) in navItems" :key="item.to || 'sep-' + idx">
        <div v-if="item.sep" class="sidebar-sep"></div>
        <router-link v-else :to="item.to" class="nav-item" active-class="active">
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </template>
    </nav>

    <div class="sidebar-footer">
      <button class="toggle-btn" @click="$emit('toggle')" :title="collapsed ? '펼치기' : '접기'">
        {{ collapsed ? '▶' : '◀' }}
      </button>
      <div v-if="!collapsed" class="user-info">
        <div class="user-avatar">{{ userInitial }}</div>
        <div class="user-meta">
          <div class="user-name">{{ userName }}</div>
          <div class="user-role">Cosmetic R&D</div>
        </div>
        <button class="logout-btn" @click="logout" title="로그아웃">⏻</button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/authStore.js'

defineProps({ collapsed: Boolean })
defineEmits(['toggle'])

const { user, logout } = useAuthStore()
const userName = computed(() => user.value?.name || '연구원')
const userInitial = computed(() => (user.value?.name || 'R')[0].toUpperCase())
const isAdmin = computed(() => user.value?.role === 'admin')

const navItems = computed(() => [
  { to: '/', icon: '◈', label: '대시보드' },
  { to: '/formulas', icon: '⚗', label: '처방 목록' },
  { to: '/formulas/new', icon: '+', label: '처방 생성' },
  { to: '/projects', icon: '◎', label: '프로젝트' },
  { sep: true },
  { to: '/ingredients', icon: '◇', label: '성분 DB' },
  { to: '/hlb-calc', icon: '⊘', label: 'HLB 계산기' },
  { sep: true },
  { to: '/validation', icon: '✓', label: '품질 검증' },
  { to: '/verify', icon: '⬡', label: '처방 검증' },
  { to: '/stability', icon: '◉', label: '안정성' },
  { sep: true },
  { to: '/journal', icon: '▤', label: '일지' },
  { to: '/notes', icon: '▧', label: '연구 노트' },
  ...(isAdmin.value ? [{ sep: true }, { to: '/admin', icon: '⚙', label: '관리자' }] : []),
])
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0; left: 0;
  width: 210px;
  height: 100vh;
  background: var(--sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 100;
}
.sidebar.collapsed { width: 60px; }

.sidebar-brand {
  padding: 20px 16px 12px;
  border-bottom: 1px solid var(--border);
}
.brand-label {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--accent);
  letter-spacing: 3px;
  font-weight: 600;
}
.brand-title { font-size: 17px; font-weight: 700; color: var(--text); margin-top: 2px; }
.brand-sub { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); letter-spacing: 1px; }

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  border-radius: 6px;
  color: var(--text-sub);
  text-decoration: none;
  font-size: 13px;
  transition: all 0.15s;
}
.nav-item:hover { background: var(--bg); }
.nav-item.active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}
.nav-icon {
  width: 18px;
  text-align: center;
  font-size: 14px;
  flex-shrink: 0;
}
.sidebar-sep {
  height: 1px;
  background: var(--border);
  margin: 6px 12px;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}
.toggle-btn {
  width: 100%;
  padding: 4px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 10px;
  margin-bottom: 8px;
}
.toggle-btn:hover { background: var(--bg); }
.user-info { display: flex; align-items: center; gap: 8px; }
.user-meta { flex: 1; min-width: 0; }
.logout-btn {
  flex-shrink: 0;
  width: 26px; height: 26px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.logout-btn:hover { background: var(--red-bg); color: var(--red); border-color: var(--red); }
.user-avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  font-size: 13px;
}
.user-name { font-size: 12px; font-weight: 600; color: var(--text); }
.user-role { font-size: 11px; color: var(--text-dim); }

@media (max-width: 1199px) {
  .sidebar { width: 60px; }
  .sidebar .nav-label, .sidebar .brand-title, .sidebar .brand-sub, .sidebar .user-info { display: none; }
}
@media (max-width: 767px) {
  .sidebar { display: none; }
}
</style>
