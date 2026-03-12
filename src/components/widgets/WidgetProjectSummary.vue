<template>
  <div class="project-widget">
    <div v-if="projectList.length" class="project-list">
      <div class="proj-item" v-for="p in projectList" :key="p.id">
        <div class="proj-top">
          <span class="proj-name">{{ p.name }}</span>
          <span class="proj-count">{{ p.formulaCount }}건</span>
        </div>
        <div class="proj-bar-wrap">
          <div class="proj-bar" :style="{ width: p.progress + '%' }"></div>
        </div>
        <div class="proj-stats">
          <span>완료 {{ p.doneCount }}</span>
          <span>진행 {{ p.reviewCount }}</span>
          <span>초안 {{ p.draftCount }}</span>
        </div>
      </div>
    </div>
    <div v-else class="empty">프로젝트가 없습니다</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useProjectStore } from '../../stores/projectStore.js'

const { allProjects } = useProjectStore()
const projectList = computed(() => allProjects().slice(0, 5))
</script>

<style scoped>
.project-list { overflow-y: auto; max-height: 100%; }
.proj-item { padding: clamp(6px, 2cqi, 10px) clamp(6px, 2.5cqi, 12px); border-bottom: 1px solid var(--border); }
.proj-item:last-child { border-bottom: none; }
.proj-top { display: flex; justify-content: space-between; margin-bottom: clamp(3px, 1.2cqi, 6px); }
.proj-name { font-size: clamp(10px, 2.8cqi, 12px); font-weight: 600; color: var(--text); }
.proj-count { font-size: clamp(8px, 2cqi, 10px); font-family: var(--font-mono); color: var(--text-dim); }
.proj-bar-wrap { height: clamp(2px, 0.8cqi, 3px); background: var(--border); border-radius: 99px; overflow: hidden; margin-bottom: clamp(2px, 0.8cqi, 4px); }
.proj-bar { height: 100%; background: var(--green); border-radius: 99px; transition: width 0.3s; }
.proj-stats { display: flex; gap: clamp(5px, 2cqi, 10px); font-size: clamp(9px, 2.2cqi, 11px); color: var(--text-dim); }
.empty { text-align: center; color: var(--text-dim); font-size: clamp(10px, 2.8cqi, 12px); padding: clamp(12px, 5cqi, 24px); }
</style>
