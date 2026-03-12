<template>
  <div class="ai-result-panel">
    <div class="panel-header">
      <div>
        <span class="section-label">MYLAB RESULT</span>
        <span class="section-title">생성 결과</span>
      </div>
      <div class="header-actions">
        <span class="gen-time">처리시간: {{ elapsed }}초</span>
        <button class="btn-ghost" @click="$emit('regenerate')">재생성</button>
      </div>
    </div>

    <div class="result-body">
      <div class="result-desc">{{ result.description }}</div>

      <!-- DB 통계 배지 -->
      <div v-if="result.totalDbIngredients" class="db-badges">
        <span class="db-badge">DB 원료 {{ result.totalDbIngredients }}종</span>
        <span class="db-badge">규제 확인 {{ result.regulationsChecked }}건</span>
        <span class="db-badge">총 {{ result.ingredients?.length || 0 }}성분</span>
      </div>

      <!-- 원료 배합 테이블 -->
      <div class="section-label" style="margin-bottom:8px">FORMULA INGREDIENTS · 배합표</div>
      <table class="phase-table">
        <thead>
          <tr><th>INCI Name</th><th>한글명</th><th>%</th><th>기능</th><th>타입</th><th>규제</th></tr>
        </thead>
        <tbody>
          <tr v-for="ing in result.ingredients" :key="ing.inci_name">
            <td class="cell-inci">{{ ing.inci_name }}</td>
            <td>{{ ing.name }}</td>
            <td class="cell-pct">{{ ing.percentage?.toFixed(2) }}</td>
            <td class="cell-fn">{{ ing.function }}</td>
            <td><span class="type-chip">{{ ing.type }}</span></td>
            <td>
              <span v-if="ing.safety?.ewg_score" class="ewg-chip" :class="getEwgClass(ing.safety.ewg_score)">
                EWG {{ ing.safety.ewg_score }}
              </span>
              <span v-if="ing.regulations?.length" class="reg-count">{{ ing.regulations.length }}건</span>
              <span v-else class="no-reg">-</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 안전/규제 상세 (safety 있는 성분만) -->
      <div v-if="safetyIngredients.length" class="safety-section">
        <div class="section-label" style="margin-bottom:8px">SAFETY & REGULATION · 안전/규제 정보</div>
        <div class="safety-card" v-for="ing in safetyIngredients" :key="ing.inci_name">
          <div class="safety-header">
            <span class="safety-name">{{ ing.name }} ({{ ing.inci_name }})</span>
            <span v-if="ing.safety?.ewg_score" class="ewg-chip" :class="getEwgClass(ing.safety.ewg_score)">
              EWG {{ ing.safety.ewg_score }}
            </span>
          </div>
          <div v-if="ing.safety?.kr_regulation" class="safety-row">
            <span class="safety-label">KR</span>
            <span>{{ ing.safety.kr_regulation }}</span>
          </div>
          <div v-if="ing.safety?.eu_regulation" class="safety-row">
            <span class="safety-label">EU</span>
            <span>{{ ing.safety.eu_regulation }}</span>
          </div>
          <div v-if="ing.safety?.max_concentration" class="safety-row">
            <span class="safety-label">한도</span>
            <span>{{ ing.safety.max_concentration }}</span>
          </div>
          <div v-if="ing.safety?.safety_notes" class="safety-notes">{{ ing.safety.safety_notes }}</div>
        </div>
      </div>

      <!-- Phases (있을 경우) -->
      <template v-if="result.phases">
      <div v-for="phase in result.phases" :key="phase.phase" class="phase-section">
        <div class="phase-title">Phase {{ phase.phase }} — {{ phase.name }} ({{ phase.temp }})</div>
        <table class="phase-table">
          <thead>
            <tr><th>성분명</th><th>%</th><th>기능</th></tr>
          </thead>
          <tbody>
            <tr v-for="ingName in phase.items" :key="ingName">
              <td>{{ ingName }}</td>
              <td class="cell-pct">{{ getIngPct(ingName) }}</td>
              <td class="cell-fn">{{ getIngFn(ingName) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </template>

      <!-- Process (있을 경우) -->
      <div v-if="result.process" class="process-section">
        <div class="section-label" style="margin-bottom:8px">MANUFACTURING PROCESS · 제조 과정</div>
        <table class="process-table">
          <thead>
            <tr><th>단계</th><th>상</th><th>설명</th><th>온도</th><th>시간</th><th>참고</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in result.process" :key="s.step">
              <td class="cell-num">{{ s.step }}</td>
              <td>{{ s.phase }}</td>
              <td>{{ s.desc }}</td>
              <td>{{ s.temp }}</td>
              <td>{{ s.time }}</td>
              <td class="cell-note">{{ s.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel-footer">
      <button class="btn-ghost" @click="$emit('regenerate')">재생성</button>
      <button class="btn-primary" @click="$emit('save')">처방으로 저장</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ result: Object })
defineEmits(['save', 'regenerate'])

const elapsed = computed(() => {
  if (!props.result?.generatedAt) return '-'
  return ((Date.now() - new Date(props.result.generatedAt).getTime()) / 1000).toFixed(1)
})

const safetyIngredients = computed(() =>
  (props.result?.ingredients || []).filter(i => i.safety)
)

function getIngPct(name) {
  const ing = props.result.ingredients?.find(i => i.name === name)
  return ing ? ing.percentage.toFixed(1) : '-'
}
function getIngFn(name) {
  const ing = props.result.ingredients?.find(i => i.name === name)
  return ing?.function || ''
}
function getEwgClass(score) {
  if (score <= 2) return 'ewg-low'
  if (score <= 6) return 'ewg-mid'
  return 'ewg-high'
}
</script>

<style scoped>
.ai-result-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.panel-header {
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}
.section-label { font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-dim); }
.section-title { font-size: 13px; font-weight: 600; color: var(--text); margin-left: 8px; }
.header-actions { display: flex; align-items: center; gap: 12px; }
.gen-time { font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); }

.result-body { padding: 20px; }
.result-desc {
  font-size: 13px;
  color: var(--text-sub);
  line-height: 1.6;
  padding: 12px 16px;
  background: var(--accent-light);
  border: 1px solid var(--accent-dim);
  border-radius: 6px;
  margin-bottom: 20px;
  white-space: pre-line;
}

.phase-section { margin-bottom: 16px; }
.phase-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 6px;
  padding: 4px 8px;
  background: var(--accent-light);
  border-radius: 4px;
  display: inline-block;
}
.phase-table, .process-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.phase-table th, .process-table th {
  background: var(--bg);
  font-size: 11px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-dim);
  padding: 6px 10px;
  text-align: left;
}
.phase-table td, .process-table td {
  padding: 6px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.cell-pct { font-family: var(--font-mono); font-weight: 700; text-align: right; }
.cell-fn { font-size: 11px; color: var(--text-sub); }
.cell-num { font-family: var(--font-mono); color: var(--text-dim); font-size: 10px; }
.cell-note { font-size: 11px; color: var(--text-dim); }

.process-section { margin-top: 20px; }

.panel-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-primary {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(184,147,90,0.3);
}
.btn-primary:hover { background: #a68350; }
.btn-ghost {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-sub);
  font-size: 13px;
  cursor: pointer;
}
.btn-ghost:hover { background: var(--bg); }

/* DB 배지 */
.db-badges { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.db-badge {
  font-size: 11px; font-family: var(--font-mono); font-weight: 600;
  padding: 3px 10px; border-radius: 4px; letter-spacing: 0.3px;
  background: var(--bg); border: 1px solid var(--border); color: var(--text-sub);
}

/* INCI / 타입 칩 */
.cell-inci { font-family: var(--font-mono); font-size: 11px; color: var(--text); }
.type-chip {
  font-size: 10px; font-family: var(--font-mono); font-weight: 600;
  padding: 1px 6px; border-radius: 3px; letter-spacing: 0.3px;
  background: var(--bg); color: var(--text-dim); white-space: nowrap;
}

/* EWG 칩 */
.ewg-chip {
  display: inline-block; font-size: 10px; font-family: var(--font-mono); font-weight: 700;
  padding: 1px 6px; border-radius: 3px; white-space: nowrap;
}
.ewg-low { background: rgba(58,144,104,0.12); color: var(--green); }
.ewg-mid { background: rgba(184,147,90,0.12); color: var(--amber); }
.ewg-high { background: rgba(196,78,78,0.12); color: var(--red); }
.reg-count { font-size: 10px; font-family: var(--font-mono); color: var(--blue); margin-left: 4px; }
.no-reg { font-size: 10px; color: var(--text-dim); }

/* 안전/규제 상세 */
.safety-section { margin-top: 20px; }
.safety-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 10px 14px; margin-bottom: 8px;
}
.safety-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.safety-name { font-size: 12px; font-weight: 600; color: var(--text); }
.safety-row { display: flex; gap: 8px; font-size: 11px; color: var(--text-sub); margin-bottom: 2px; }
.safety-label {
  font-size: 10px; font-family: var(--font-mono); font-weight: 700;
  color: var(--accent); min-width: 24px; flex-shrink: 0;
}
.safety-notes { font-size: 11px; color: var(--text-dim); margin-top: 4px; font-style: italic; }
</style>
