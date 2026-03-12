<template>
  <div class="stat-card">
    <div class="stat-top">
      <span class="stat-label">{{ label }}</span>
      <span class="stat-icon" :style="{ background: iconBg, color: iconColor }">{{ icon }}</span>
    </div>
    <div class="stat-value" :style="{ color: iconColor }">
      {{ value }} <span class="stat-unit">{{ unit }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [Number, String],
  unit: { type: String, default: '건' },
  icon: { type: String, default: '⚗' },
  iconColor: { type: String, default: '#b8935a' },
  iconBg: { type: String, default: '#f0e8d8' },
})
</script>

<style scoped>
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
  box-shadow: var(--shadow);
}
.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.stat-label {
  font-size: 10px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  color: var(--text-dim);
  letter-spacing: 1px;
}
.stat-icon {
  width: 28px; height: 28px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin-top: 12px;
}
.stat-unit {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
}
</style>
