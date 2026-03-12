<template>
  <div class="journal-page">
    <div v-if="groupedDates.length">
      <div class="journal-day" v-for="group in groupedDates" :key="group.date">
        <div class="day-header">
          <div class="day-dot"></div>
          <div class="day-label">{{ group.label }}</div>
          <div class="day-count">{{ group.formulas.length }}건</div>
        </div>
        <div class="day-items">
          <div class="journal-item" v-for="f in group.formulas" :key="f.id" @click="$router.push('/formulas/' + f.id)">
            <div class="item-time">{{ formatTime(f.updated_at) }}</div>
            <div class="item-body">
              <div class="item-top">
                <StatusChip :status="f.status" />
                <span class="item-title">{{ f.title }}</span>
              </div>
              <div class="item-sub">{{ f.product_type || '미지정' }} · 성분 {{ f.formula_data?.ingredients?.length || 0 }}개</div>
              <div class="item-memo" v-if="f.memo">{{ f.memo.slice(0, 80) }}{{ f.memo.length > 80 ? '...' : '' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <EmptyState v-else icon="◉" title="처방 일지가 비어있습니다" subtitle="처방을 작성하면 날짜별로 기록됩니다">
      <router-link to="/formulas/new" class="btn btn-primary" style="display:inline-block;margin-top:8px">첫 처방 만들기</router-link>
    </EmptyState>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFormulaStore } from '../stores/formulaStore.js'
import StatusChip from '../components/common/StatusChip.vue'
import EmptyState from '../components/common/EmptyState.vue'

const { formulas } = useFormulaStore()

const groupedDates = computed(() => {
  const groups = {}
  const sorted = [...formulas.value].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  sorted.forEach(f => {
    const d = new Date(f.updated_at)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (!groups[key]) groups[key] = { date: key, label: formatDateLabel(d), formulas: [] }
    groups[key].formulas.push(f)
  })
  return Object.values(groups)
})

function formatDateLabel(d) {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const prefix = isToday ? '오늘 · ' : isYesterday ? '어제 · ' : ''
  return `${prefix}${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
}

function formatTime(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.journal-day { margin-bottom: 24px; position: relative; }
.journal-day::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 24px;
  bottom: 0;
  width: 2px;
  background: var(--border);
}
.day-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
}
.day-dot {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid var(--surface);
  box-shadow: 0 0 0 1px var(--accent);
}
.day-label { font-size: 14px; font-weight: 600; color: var(--text); }
.day-count { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); }

.day-items { padding-left: 38px; }
.journal-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: var(--shadow);
}
.journal-item:hover { border-color: var(--accent-dim); }
.item-time { font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); padding-top: 2px; min-width: 40px; }
.item-top { display: flex; align-items: center; gap: 8px; }
.item-title { font-size: 13px; font-weight: 500; color: var(--text); }
.item-sub { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.item-memo {
  font-size: 12px;
  color: var(--text-sub);
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--bg);
  border-radius: 4px;
}

.btn { padding: 8px 16px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; }
.btn-primary { background: var(--accent); color: #fff; }
</style>
