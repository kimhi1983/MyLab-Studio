<template>
  <span class="status-chip" :style="chipStyle" @click="$emit('click')">
    {{ statusLabel }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { statusStyles } from '../../tokens.js'

const props = defineProps({
  status: { type: String, default: 'draft' },
})
defineEmits(['click'])

const styleObj = computed(() => statusStyles[props.status] || statusStyles.draft)
const statusLabel = computed(() => styleObj.value.label)
const chipStyle = computed(() => ({
  color: styleObj.value.color,
  background: styleObj.value.bg,
  border: `1px solid ${styleObj.value.border}`,
}))
</script>

<style scoped>
.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.5px;
  cursor: default;
}
</style>
