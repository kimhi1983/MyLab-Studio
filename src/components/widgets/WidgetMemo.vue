<template>
  <div class="memo-widget">
    <textarea v-model="memoText" class="memo-area" placeholder="메모를 자유롭게 작성하세요...&#10;&#10;이 메모는 자동 저장됩니다."></textarea>
    <div class="memo-footer">
      <span class="memo-saved" v-if="saved">저장됨 ✓</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useLocalStorage } from '../../composables/useLocalStorage.js'

const memoData = useLocalStorage('mylab:dashboard-memo', '')
const memoText = ref(memoData.value)
const saved = ref(false)

let timeout
watch(memoText, (val) => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    memoData.value = val
    saved.value = true
    setTimeout(() => saved.value = false, 1500)
  }, 500)
})
</script>

<style scoped>
.memo-widget { display: flex; flex-direction: column; height: 100%; }
.memo-area {
  flex: 1; width: 100%; border: none; resize: none; padding: 10px 12px;
  font-size: 12px; line-height: 1.6; color: var(--text); font-family: inherit;
  background: transparent; outline: none;
}
.memo-area::placeholder { color: var(--text-dim); }
.memo-footer { padding: 4px 12px; text-align: right; }
.memo-saved { font-size: 10px; color: var(--green); font-family: var(--font-mono); }
</style>
