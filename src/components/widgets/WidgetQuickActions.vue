<template>
  <div class="quick-widget">
    <router-link to="/ai-guide" class="action-btn primary">
      <span class="action-icon">✦</span>
      <div>
        <div class="action-label">MyLab 가이드 처방</div>
        <div class="action-desc">최적 처방을 자동 생성</div>
      </div>
    </router-link>
    <router-link to="/formulas/new" class="action-btn secondary">
      <span class="action-icon">+</span>
      <div>
        <div class="action-label">새 처방 작성</div>
        <div class="action-desc">직접 원료를 선택하여 처방</div>
      </div>
    </router-link>
    <router-link to="/formulas" class="action-btn ghost">
      <span class="action-icon">⚗</span>
      <div class="action-label">처방 목록</div>
    </router-link>
    <router-link to="/projects" class="action-btn ghost">
      <span class="action-icon">◎</span>
      <div class="action-label">프로젝트</div>
    </router-link>
  </div>
</template>

<style scoped>
.quick-widget { display: flex; flex-direction: column; gap: clamp(3px, 1.2cqi, 6px); }
.action-btn {
  display: flex; align-items: center; gap: clamp(6px, 2cqi, 10px); padding: clamp(6px, 2cqi, 10px) clamp(8px, 2.5cqi, 14px);
  border-radius: 7px; text-decoration: none; transition: all 0.15s;
}
.action-btn.primary { background: var(--accent); color: #fff; box-shadow: 0 2px 6px rgba(184,147,90,0.25); }
.action-btn.primary:hover { background: #a68350; }
.action-btn.primary .action-desc { color: rgba(255,255,255,0.8); }
.action-btn.secondary { background: var(--accent-light); color: var(--accent); border: 1px solid var(--accent-dim); }
.action-btn.secondary .action-desc { color: var(--text-sub); }
.action-btn.ghost { border: 1px solid var(--border); color: var(--text-sub); background: transparent; }
.action-btn.ghost:hover { background: var(--bg); }
.action-icon { font-size: clamp(11px, 3cqi, 14px); width: clamp(14px, 4cqi, 18px); text-align: center; flex-shrink: 0; }
.action-label { font-size: clamp(10px, 2.8cqi, 12px); font-weight: 600; }
.action-desc { font-size: clamp(8px, 2cqi, 10px); margin-top: 1px; }
</style>
