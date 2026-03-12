<template>
  <div class="progress-wrap">
    <div class="progress-bar" :style="{ width: value + '%', background: barColor }"></div>
  </div>
  <span v-if="showLabel" class="progress-label" :style="{ color: barColor }">{{ value }}%</span>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  value: { type: Number, default: 0 },
  color: { type: String, default: '' },
  showLabel: { type: Boolean, default: true },
})
const barColor = computed(() => {
  if (props.color) return props.color
  if (props.value >= 100) return 'var(--green)'
  if (props.value >= 60) return 'var(--blue)'
  return 'var(--amber)'
})
</script>

<style scoped>
.progress-wrap {
  width: 100%;
  height: 3px;
  background: var(--border);
  border-radius: 99px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  border-radius: 99px;
  transition: width 0.3s ease;
}
.progress-label {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
}
</style>
