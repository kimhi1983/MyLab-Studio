<template>
  <div class="app-layout">
    <AppHeader />
    <AppNavBar>
      <template #tools>
        <slot name="nav-tools" />
      </template>
    </AppNavBar>
    <main class="app-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import AppHeader from './components/layout/AppHeader.vue'
import AppNavBar from './components/layout/AppNavBar.vue'
</script>

<style>
:root {
  --bg: #f8f7f5;
  --surface: #ffffff;
  --sidebar: #fafaf8;
  --border: #ece9e3;
  --border-mid: #d8d4cc;
  --accent: #b8935a;
  --accent-light: #f0e8d8;
  --accent-dim: #e8dece;
  --text: #1a1814;
  --text-sub: #6b6560;
  --text-dim: #aba59d;
  --green: #3a9068;
  --green-bg: #f0f8f4;
  --red: #c44e4e;
  --red-bg: #fdf2f2;
  --amber: #b07820;
  --amber-bg: #fdf8f0;
  --blue: #3a6fa8;
  --blue-bg: #f0f4fb;
  --purple: #7c5cbf;
  --purple-bg: #f6f2fd;
  --radius: 10px;
  --radius-lg: 16px;
  --shadow: 0 1px 4px rgba(0,0,0,0.04);
  --font: 'Inter', 'Pretendard Variable', -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
}

.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

.app-content {
  flex: 1;
  padding: 24px 36px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 1199px) {
  .app-content { padding: 20px 20px; }
}

@media (max-width: 767px) {
  .app-content { padding: 16px; }
}
</style>
