<template>
  <header class="app-header">
    <div class="header-brand">
      <span class="brand-label">COCHING</span>
      <span class="brand-title">MyLab Studio</span>
    </div>
    <div class="header-center">
      <span class="header-date">{{ formattedDate }}</span>
      <span class="header-divider">·</span>
      <h1 class="header-page">{{ currentTitle }}</h1>
    </div>
    <div class="header-actions">
      <div class="user-chip">
        <span class="user-avatar">R</span>
        <span class="user-name">연구원</span>
      </div>
      <router-link to="/formulas/new" class="btn btn-primary">+ 새 처방 생성</router-link>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const formattedDate = computed(() => {
  const d = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
})

const currentTitle = computed(() => route.meta?.title || 'MyLab')
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 36px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  min-height: 56px;
}

.header-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}
.brand-label {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  letter-spacing: 3px;
  font-weight: 600;
}
.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.header-center {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.header-date {
  font-size: 11px;
  color: var(--text-dim);
}
.header-divider {
  color: var(--border-mid);
  font-size: 14px;
}
.header-page {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg);
}
.user-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  font-size: 11px;
}
.user-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-sub);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 8px rgba(184, 147, 90, 0.3);
}
.btn-primary:hover { background: #a68350; }

@media (max-width: 1199px) {
  .header-center { display: none; }
  .app-header { padding: 12px 20px; }
}
@media (max-width: 767px) {
  .app-header { padding: 10px 16px; }
  .brand-title { font-size: 14px; }
  .user-name { display: none; }
}
</style>
