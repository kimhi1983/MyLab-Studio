<template>
  <nav class="nav-bar">
    <div class="nav-tabs">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-tab"
        active-class="active"
        :exact="item.exact"
      >
        <span class="tab-label">{{ item.label }}</span>
      </router-link>
      <div class="nav-tools">
        <slot name="tools" />
      </div>
    </div>
  </nav>
</template>

<script setup>
const navItems = [
  { to: '/', label: '대시보드', exact: true },
  { to: '/formulas', label: '처방 목록', exact: false },
  { to: '/formulas/new', label: '+ 생성', exact: true },
  { to: '/journal', label: '일지', exact: true },
  { to: '/projects', label: '프로젝트', exact: true },
  { to: '/ai-guide', label: 'MyLab 가이드', exact: true },
  { to: '/ingredients', label: '성분 DB', exact: true },
  { to: '/notes', label: '연구 노트', exact: true },
  { to: '/validation', label: '품질 검증', exact: true },
  { to: '/hlb-calc', label: 'HLB 계산기', exact: true },
]
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
