<template>
  <Teleport to="body">
    <div class="toast-container">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast-${t.type}`"
        @click="removeToast(t.id)"
      >
        <span class="toast-icon">{{ iconFor(t.type) }}</span>
        <span class="toast-msg">{{ t.message }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../../composables/useToast.js'

const { toasts, removeToast } = useToast()

function iconFor(type) {
  if (type === 'success') return '✓'
  if (type === 'error') return '✗'
  return '⚠'
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: toast-slide-in 0.2s ease;
  min-width: 220px;
  max-width: 360px;
}

.toast-success { background: var(--green); color: #fff; }
.toast-error   { background: var(--red); color: #fff; }
.toast-warning { background: var(--amber); color: #fff; }

@keyframes toast-slide-in {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

.toast-icon { font-size: 14px; flex-shrink: 0; }
.toast-msg  { line-height: 1.4; word-break: break-all; }
</style>
