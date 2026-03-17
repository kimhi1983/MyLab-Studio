<template>
  <nav class="nav-bar">
    <div class="nav-tabs">
      <template v-for="(item, idx) in navItems" :key="item.to || 'sep-' + idx">
        <div v-if="item.sep" class="nav-sep"></div>
        <router-link
          v-else
          :to="item.to"
          class="nav-tab"
          active-class="active"
          :exact="item.exact"
        >
          <span class="tab-label">{{ item.label }}</span>
        </router-link>
      </template>
      <div class="nav-tools">
        <slot name="tools" />
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/authStore.js'

const { user } = useAuthStore()
const isAdmin = computed(() => user.value?.role === 'admin')

const navItems = computed(() => [
  { to: '/', label: '대시보드', exact: true },
  { to: '/formulas', label: '처방 목록', exact: false },
  { to: '/formulas/new', label: '+ 생성', exact: true },
  { to: '/projects', label: '프로젝트', exact: true },
  { sep: true },
  { to: '/ingredients', label: '성분 DB', exact: true },
  { to: '/hlb-calc', label: 'HLB 계산기', exact: true },
  { sep: true },
  { to: '/validation', label: '품질 검증', exact: true },
  { to: '/verify', label: '처방 검증', exact: true },
  { to: '/stability', label: '안정성', exact: true },
  { sep: true },
  { to: '/journal', label: '일지', exact: true },
  { to: '/notes', label: '연구 노트', exact: true },
  ...(isAdmin.value ? [{ sep: true }, { to: '/admin', label: '⚙ 관리자', exact: true }] : []),
])
</script>

<style scoped>
.nav-bar {
  display: flex;
  justify-content: center;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  min-height: 38px;
}

.nav-tabs {
  display: flex;
  align-items: flex-end;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.nav-tabs::-webkit-scrollbar { display: none; }

.nav-tab {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-dim);
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.15s;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  margin-bottom: -1px;
  background: transparent;
}

.nav-tab:hover {
  color: var(--text-sub);
  background: var(--bg);
}

.nav-tab.active {
  color: var(--accent);
  font-weight: 600;
  background: var(--bg);
  border-color: var(--border);
  border-bottom: 1px solid var(--bg);
}

.nav-sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 4px;
  align-self: center;
  flex-shrink: 0;
}

.nav-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
}

.tab-label {
  font-size: 12px;
  letter-spacing: 0.2px;
}

.nav-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 8px;
  margin-left: 4px;
  border-left: 1px solid var(--border);
  align-self: center;
  padding: 4px 0 4px 12px;
}

@media (max-width: 767px) {
  .nav-bar { justify-content: flex-start; overflow-x: auto; }
  .nav-tab { padding: 8px 14px; }
  .tab-label { font-size: 11px; }
}
</style>
