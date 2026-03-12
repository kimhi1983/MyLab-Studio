<template>
  <div class="todaylog-widget">
    <!-- 날짜 헤더 -->
    <div class="log-header">
      <span class="log-date">{{ todayLabel }}</span>
      <span class="log-count">{{ logs.length }}건</span>
    </div>

    <!-- 타임라인 -->
    <div class="timeline">
      <div
        class="timeline-item"
        v-for="log in logs"
        :key="log.id"
      >
        <!-- 시간 -->
        <div class="timeline-time">{{ log.time }}</div>

        <!-- 라인 + 점 -->
        <div class="timeline-line">
          <div class="timeline-dot" :style="{ background: getTypeColor(log.type) }"></div>
          <div class="timeline-bar"></div>
        </div>

        <!-- 내용 -->
        <div class="timeline-content">
          <div class="content-top">
            <span class="type-chip" :style="{ color: getTypeColor(log.type), background: getTypeBg(log.type) }">
              {{ getTypeLabel(log.type) }}
            </span>
            <span class="status-chip" :class="getStatusClass(log.status)">
              {{ getStatusLabel(log.status) }}
            </span>
          </div>
          <div class="content-title">{{ log.title }}</div>
          <div v-if="log.detail" class="content-detail">{{ log.detail }}</div>
        </div>
      </div>
    </div>

    <div v-if="!logs.length" class="empty">오늘의 업무 기록이 없습니다</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const typeConfig = {
  formula: { label: '처방', color: '#b8935a', bg: 'rgba(184,147,90,0.12)' },
  test: { label: '테스트', color: '#3a6fa8', bg: 'rgba(58,111,168,0.12)' },
  reg: { label: '규제', color: '#c44e4e', bg: 'rgba(196,78,78,0.12)' },
  idea: { label: '아이디어', color: '#7c5cbf', bg: 'rgba(124,92,191,0.12)' },
}

const statusConfig = {
  ongoing: { label: '진행중', cls: 'status-ongoing' },
  done: { label: '완료', cls: 'status-done' },
  review: { label: '검토중', cls: 'status-review' },
  memo: { label: '메모', cls: 'status-memo' },
}

const logs = [
  {
    id: 1,
    time: '09:30',
    type: 'formula',
    title: '쿠션 파운데이션 21호 v3.2 배합 수정',
    detail: 'Cyclopentasiloxane 함량 30% → 28% 조정',
    status: 'done',
  },
  {
    id: 2,
    time: '11:00',
    type: 'test',
    title: '선스틱 SPF50+ 4주 안정성 결과 확인',
    detail: 'ΔE 2.4 — FAIL 판정, 재처방 필요',
    status: 'review',
  },
  {
    id: 3,
    time: '14:15',
    type: 'reg',
    title: 'EU Titanium Dioxide 흡입 규제 모니터링',
    detail: '분말형 제품 적용 여부 검토 중',
    status: 'ongoing',
  },
  {
    id: 4,
    time: '16:00',
    type: 'idea',
    title: '바쿠치올 세럼 — 리포솜 캡슐화 검토',
    detail: '안정성 개선 가능성, 다음 버전 반영 예정',
    status: 'memo',
  },
]

const todayLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1}월 ${now.getDate()}일`
})

function getTypeColor(type) {
  return typeConfig[type]?.color || '#888'
}

function getTypeBg(type) {
  return typeConfig[type]?.bg || 'rgba(136,136,136,0.1)'
}

function getTypeLabel(type) {
  return typeConfig[type]?.label || type
}

function getStatusClass(status) {
  return statusConfig[status]?.cls || ''
}

function getStatusLabel(status) {
  return statusConfig[status]?.label || status
}
</script>

<style scoped>
.todaylog-widget {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  overflow: hidden;
}

/* 날짜 헤더 */
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: clamp(6px, 2cqi, 10px);
  flex-shrink: 0;
}

.log-date {
  font-size: clamp(9px, 2.5cqi, 11px);
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--text-sub);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.log-count {
  font-size: clamp(9px, 2.5cqi, 11px);
  font-family: var(--font-mono);
  color: var(--text-dim);
  background: var(--bg);
  border: 1px solid var(--border);
  padding: clamp(1px, 0.5cqi, 2px) clamp(4px, 1.5cqi, 7px);
  border-radius: 10px;
}

/* 타임라인 */
.timeline {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: grid;
  grid-template-columns: clamp(28px, 8cqi, 36px) 20px 1fr;
  gap: 0 clamp(3px, 1.5cqi, 6px);
  position: relative;
}

/* 시간 */
.timeline-time {
  font-size: clamp(9px, 2.5cqi, 11px);
  font-family: var(--font-mono);
  color: var(--text-dim);
  padding-top: 4px;
  text-align: right;
  white-space: nowrap;
}

/* 점 + 세로선 */
.timeline-line {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-dot {
  width: clamp(6px, 2cqi, 8px);
  height: clamp(6px, 2cqi, 8px);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

.timeline-bar {
  width: 1px;
  flex: 1;
  background: var(--border);
  min-height: 12px;
}

.timeline-item:last-child .timeline-bar {
  display: none;
}

/* 내용 */
.timeline-content {
  padding-bottom: clamp(6px, 2.5cqi, 12px);
}

.content-top {
  display: flex;
  align-items: center;
  gap: clamp(3px, 1cqi, 5px);
  margin-bottom: 3px;
}

/* 타입 칩 */
.type-chip {
  display: inline-block;
  padding: clamp(1px, 0.5cqi, 2px) clamp(4px, 1.5cqi, 7px);
  border-radius: 3px;
  font-size: clamp(9px, 2.5cqi, 11px);
  font-weight: 600;
}

/* 상태 칩 */
.status-chip {
  display: inline-block;
  padding: clamp(1px, 0.5cqi, 2px) clamp(4px, 1.5cqi, 7px);
  border-radius: 3px;
  font-size: clamp(9px, 2.5cqi, 11px);
  font-weight: 600;
}

.status-ongoing {
  background: rgba(58, 111, 168, 0.12);
  color: var(--blue);
}

.status-done {
  background: rgba(58, 144, 104, 0.12);
  color: var(--green);
}

.status-review {
  background: rgba(184, 147, 90, 0.12);
  color: var(--amber);
}

.status-memo {
  background: rgba(124, 92, 191, 0.12);
  color: var(--purple);
}

.content-title {
  font-size: clamp(10px, 2.8cqi, 12px);
  font-weight: 500;
  color: var(--text);
  line-height: 1.4;
}

.content-detail {
  font-size: clamp(9px, 2.5cqi, 11px);
  color: var(--text-dim);
  margin-top: 2px;
  line-height: 1.4;
}

.empty {
  text-align: center;
  color: var(--text-dim);
  font-size: clamp(10px, 2.8cqi, 12px);
  padding: clamp(12px, 5cqi, 24px);
}
</style>
