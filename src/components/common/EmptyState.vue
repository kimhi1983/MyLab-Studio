<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="subtitle" class="empty-subtitle">{{ subtitle }}</div>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '⚗' },
  title: { type: String, default: '데이터가 없습니다' },
  subtitle: String,
})
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 40px 20px;
}
.empty-icon { font-size: 40px; color: var(--text-dim); margin-bottom: 12px; }
.empty-title { font-size: 14px; color: var(--text-sub); margin-bottom: 4px; }
.empty-subtitle { font-size: 11px; color: var(--text-dim); margin-bottom: 16px; }
</style>
