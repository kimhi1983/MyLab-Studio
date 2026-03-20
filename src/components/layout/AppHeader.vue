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
      <div class="user-chip" @click="toggleDropdown" ref="chipRef">
        <span class="user-avatar">{{ userInitial }}</span>
        <span class="user-name">{{ userName }}</span>
        <span class="dropdown-arrow" :class="{ open: dropdownOpen }">▾</span>
      </div>

      <Teleport to="body">
        <div v-if="dropdownOpen" class="user-dropdown" :style="dropdownStyle" @click.stop>
          <div class="dropdown-header">
            <div class="dropdown-avatar">{{ userInitial }}</div>
            <div class="dropdown-info">
              <div class="dropdown-name">{{ userName }}</div>
              <div class="dropdown-email">{{ userEmail }}</div>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" @click="goProfile">
            <span class="item-icon">◈</span> 내 정보
          </button>
          <button class="dropdown-item logout" @click="handleLogout">
            <span class="item-icon">⏻</span> 로그아웃
          </button>
        </div>
      </Teleport>

      <router-link to="/formulas/new" class="btn btn-primary">+ 새 처방 생성</router-link>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'

const route = useRoute()
const router = useRouter()
const { user, logout } = useAuthStore()

const formattedDate = computed(() => {
  const d = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
})

const currentTitle = computed(() => route.meta?.title || 'MyLab')
const userName = computed(() => user.value?.name || '연구원')
const userInitial = computed(() => (user.value?.name || 'R')[0].toUpperCase())
const userEmail = computed(() => user.value?.email || '')

// 드롭다운
const dropdownOpen = ref(false)
const chipRef = ref(null)
const dropdownStyle = ref({})

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
  if (dropdownOpen.value) {
    const rect = chipRef.value?.getBoundingClientRect()
    if (rect) {
      dropdownStyle.value = {
        position: 'fixed',
        top: rect.bottom + 6 + 'px',
        right: window.innerWidth - rect.right + 'px',
        zIndex: 9999,
      }
    }
  }
}

function closeDropdown(e) {
  if (chipRef.value && !chipRef.value.contains(e.target)) {
    dropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', closeDropdown))
onUnmounted(() => document.removeEventListener('click', closeDropdown))

function goProfile() {
  dropdownOpen.value = false
  router.push('/request')
}

function handleLogout() {
  dropdownOpen.value = false
  logout()
}
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
  position: relative;
  z-index: 100;
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
  padding: 4px 8px 4px 4px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s, background 0.15s;
}
.user-chip:hover {
  border-color: var(--accent);
  background: var(--accent-light);
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
.dropdown-arrow {
  font-size: 10px;
  color: var(--text-dim);
  transition: transform 0.15s;
  line-height: 1;
}
.dropdown-arrow.open {
  transform: rotate(180deg);
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

<style>
/* Teleport 대상이므로 전역 스타일 */
.user-dropdown {
  min-width: 200px;
  background: #ffffff;
  border: 1px solid #E8E0D4;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: dropdown-in 0.12s ease;
}

@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.user-dropdown .dropdown-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 12px;
}
.user-dropdown .dropdown-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: #f0e8d8;
  color: #b8935a;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.user-dropdown .dropdown-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1814;
}
.user-dropdown .dropdown-email {
  font-size: 11px;
  color: #aba59d;
  margin-top: 2px;
}
.user-dropdown .dropdown-divider {
  height: 1px;
  background: #E8E0D4;
  margin: 0;
}
.user-dropdown .dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  font-size: 13px;
  color: #6b6560;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.user-dropdown .dropdown-item:hover {
  background: #f8f7f5;
  color: #1a1814;
}
.user-dropdown .dropdown-item.logout:hover {
  background: #fdf2f2;
  color: #c44e4e;
}
.user-dropdown .item-icon {
  font-size: 12px;
  width: 16px;
  text-align: center;
}
</style>
