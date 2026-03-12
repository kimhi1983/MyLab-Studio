<template>
  <div class="formula-card" @click="$emit('click')">
    <div class="card-header">
      <span class="card-id">{{ formula.id }}</span>
      <StatusChip :status="formula.status" />
    </div>
    <div class="card-title">{{ formula.title }}</div>
    <div class="card-type">{{ formula.product_type || '미지정' }}</div>
    <div class="card-divider"></div>
    <div class="card-meta">
      <span>성분 {{ ingredientCount }}개</span>
      <span>{{ formattedDate }}</span>
    </div>
    <div class="card-tags" v-if="formula.tags?.length">
      <span class="tag" v-for="tag in formula.tags" :key="tag">{{ tag }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StatusChip from '../common/StatusChip.vue'

const props = defineProps({ formula: Object })
defineEmits(['click'])

const ingredientCount = computed(() => props.formula.formula_data?.ingredients?.length || 0)
const formattedDate = computed(() => {
  const d = new Date(props.formula.updated_at)
  return `${d.getMonth() + 1}/${d.getDate()}`
})
</script>

<style scoped>
.formula-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: var(--shadow);
}
.formula-card:hover {
  border-color: var(--accent-dim);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.card-id { font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); letter-spacing: 1px; }
.card-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
.card-type { font-size: 11px; color: var(--text-sub); }
.card-divider { height: 1px; background: var(--border); margin: 10px 0; }
.card-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); }
.card-tags { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}
</style>
