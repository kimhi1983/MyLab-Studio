<template>
  <div class="verify-page">
    <div class="page-header">
      <h1 class="page-title">처방 검증</h1>
      <p class="page-desc">연구원의 기존 처방을 업로드하여 규제·배합비·물성·안정성 등 6항목을 자동 검증합니다.</p>
    </div>

    <!-- 탭 -->
    <div class="verify-tabs">
      <button :class="['tab-btn', { active: tab === 'input' }]" @click="tab = 'input'">처방 입력</button>
      <button :class="['tab-btn', { active: tab === 'history' }]" @click="tab = 'history'; loadHistory()">검증 이력</button>
    </div>

    <!-- ─── 처방 입력 탭 ─── -->
    <div v-if="tab === 'input'" class="tab-content">
      <div class="input-layout">
        <!-- 좌: 처방 입력 폼 -->
        <div class="panel input-panel">
          <div class="panel-header">
            <span class="panel-title">처방 정보</span>
          </div>
          <div class="panel-body">
            <div class="form-row">
              <label class="form-label">제품명 *</label>
              <input v-model="form.product_name" class="form-input" placeholder="예: 히알루론산 보습 크림" />
            </div>
            <div class="meta-row">
              <div class="form-row">
                <label class="form-label">카테고리</label>
                <select v-model="form.category_code" class="form-input">
                  <option value="">선택</option>
                  <option value="skincare">스킨케어</option>
                  <option value="suncare">선케어</option>
                  <option value="cleansing">세정</option>
                  <option value="haircare">헤어</option>
                  <option value="makeup">색조</option>
                </select>
              </div>
              <div class="form-row">
                <label class="form-label">목표 pH</label>
                <input v-model.number="form.target_ph" type="number" step="0.1" min="0" max="14" class="form-input" placeholder="5.5" />
              </div>
              <div class="form-row">
                <label class="form-label">목표 점도 (cP)</label>
                <input v-model.number="form.target_viscosity" type="number" step="100" min="0" class="form-input" placeholder="25000" />
              </div>
            </div>

            <!-- 성분 테이블 -->
            <div class="ing-section">
              <div class="ing-header">
                <span class="ing-title">성분 목록</span>
                <div class="ing-actions">
                  <button class="btn-sm" @click="addRow">+ 행 추가</button>
                  <button class="btn-sm btn-outline" @click="pasteFromClipboard">붙여넣기</button>
                  <button class="btn-sm btn-outline" @click="loadSample">샘플 로드</button>
                </div>
              </div>
              <table class="ing-table">
                <thead>
                  <tr>
                    <th class="col-no">#</th>
                    <th class="col-name">성분명 (INCI)</th>
                    <th class="col-kr">한글명</th>
                    <th class="col-pct">wt%</th>
                    <th class="col-phase">Phase</th>
                    <th class="col-role">역할</th>
                    <th class="col-del"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in form.ingredients" :key="idx">
                    <td class="col-no">{{ idx + 1 }}</td>
                    <td class="col-name"><input v-model="row.inci_name" class="form-input" placeholder="INCI Name" /></td>
                    <td class="col-kr"><input v-model="row.name" class="form-input" placeholder="한글명" /></td>
                    <td class="col-pct"><input v-model.number="row.wt_pct" type="number" step="0.01" min="0" max="100" class="form-input pct-input" placeholder="0.00" /></td>
                    <td class="col-phase">
                      <select v-model="row.phase" class="form-input phase-sel">
                        <option value="">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </td>
                    <td class="col-role"><input v-model="row.role" class="form-input" placeholder="역할" /></td>
                    <td class="col-del"><button class="btn-del" @click="form.ingredients.splice(idx, 1)">×</button></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td></td>
                    <td colspan="2" class="total-label">합계</td>
                    <td :class="['total-pct', { 'pct-ok': Math.abs(totalPct - 100) <= 0.05, 'pct-err': Math.abs(totalPct - 100) > 0.05 }]">
                      {{ totalPct.toFixed(2) }}%
                    </td>
                    <td colspan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div class="panel-footer">
            <button class="btn-primary" @click="runVerification" :disabled="verifying || !form.product_name || form.ingredients.length < 2">
              {{ verifying ? '검증 중...' : '검증 실행' }}
            </button>
            <button class="btn-outline" @click="resetForm">초기화</button>
          </div>
        </div>

        <!-- 우: 검증 리포트 -->
        <div v-if="report" class="panel report-panel">
          <div class="panel-header">
            <span class="panel-title">검증 리포트</span>
            <span :class="['status-chip', `status-${report.summary.overall_status.toLowerCase()}`]">
              {{ statusLabel(report.summary.overall_status) }}
            </span>
          </div>
          <div class="panel-body">
            <!-- 종합 결과 -->
            <div class="summary-box">
              <div class="summary-stats">
                <div class="stat-item critical" v-if="report.summary.critical_count > 0">
                  <span class="stat-num">{{ report.summary.critical_count }}</span>
                  <span class="stat-label">위험</span>
                </div>
                <div class="stat-item warning" v-if="report.summary.warning_count > 0">
                  <span class="stat-num">{{ report.summary.warning_count }}</span>
                  <span class="stat-label">주의</span>
                </div>
                <div class="stat-item pass">
                  <span class="stat-num">{{ report.summary.pass_count }}</span>
                  <span class="stat-label">통과</span>
                </div>
              </div>
            </div>

            <!-- 각 검증 항목 -->
            <div v-for="(val, key) in report.validations" :key="key" class="validation-item">
              <div class="val-header" @click="toggleExpand(key)">
                <span :class="['val-icon', `icon-${val.status.toLowerCase()}`]">{{ statusIcon(val.status) }}</span>
                <span class="val-title">{{ val.title }}</span>
                <span class="val-status">{{ statusLabel(val.status) }}</span>
                <span class="val-toggle">{{ expanded[key] ? '▾' : '▸' }}</span>
              </div>
              <div v-if="expanded[key]" class="val-body">
                <!-- 검증 체크 목록 -->
                <div v-for="(chk, ci) in val.checks" :key="ci" :class="['check-row', `check-${(chk.severity || 'info').toLowerCase()}`]">
                  <span class="check-icon">{{ severityIcon(chk.severity) }}</span>
                  <div class="check-content">
                    <div class="check-msg">{{ chk.message }}</div>
                    <div v-if="chk.action" class="check-action">→ {{ chk.action }}</div>
                  </div>
                </div>
                <div v-if="!val.checks?.length && !val.synergies?.length" class="check-empty">검증 항목 없음</div>

                <!-- 시너지 (충돌 항목) -->
                <div v-if="val.synergies?.length" class="synergy-section">
                  <div class="synergy-title">시너지 조합</div>
                  <div v-for="(syn, si) in val.synergies" :key="si" class="synergy-row">
                    💡 {{ syn.message }}
                  </div>
                </div>

                <!-- 물성 예측 (physical) -->
                <div v-if="val.predicted" class="predicted-section">
                  <div class="pred-title">예측값</div>
                  <div class="pred-grid">
                    <div v-if="val.predicted.ph" class="pred-card">
                      <div class="pred-label">pH</div>
                      <div class="pred-value">{{ val.predicted.ph.value }}</div>
                      <div class="pred-conf">{{ val.predicted.ph.confidence }}</div>
                    </div>
                    <div v-if="val.predicted.hlb" class="pred-card">
                      <div class="pred-label">HLB</div>
                      <div class="pred-value">{{ val.predicted.hlb.value }}</div>
                    </div>
                    <div v-if="val.predicted.viscosity" class="pred-card">
                      <div class="pred-label">점도</div>
                      <div class="pred-value">{{ val.predicted.viscosity.value?.toLocaleString() }} cP</div>
                      <div class="pred-conf">{{ val.predicted.viscosity.confidence }}</div>
                    </div>
                  </div>
                </div>

                <!-- 원가 (cost) -->
                <div v-if="val.total_cost_per_kg !== undefined" class="cost-section">
                  <div class="cost-summary">
                    <span class="cost-total">{{ val.total_cost_per_kg?.toLocaleString() }}원/kg</span>
                    <span :class="['cost-tier', `tier-${val.tier}`]">{{ val.tier }}</span>
                  </div>
                  <div v-if="val.breakdown?.length" class="cost-breakdown">
                    <div v-for="(item, bi) in val.breakdown" :key="bi" class="cost-row">
                      <span>{{ item.ingredient }} ({{ item.pct }}%)</span>
                      <span>{{ item.contribution?.toLocaleString() }}원</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ⑦⑧ AI 심화 분석 버튼 -->
          <div class="ai-panel-footer">
            <button class="btn-ai" @click="suggestAlternatives" :disabled="loadingAlt">
              {{ loadingAlt ? '분석 중...' : '⑦ 대체 성분 제안 (AI)' }}
            </button>
            <button class="btn-ai btn-ai-process" @click="runProcessReview" :disabled="loadingProcess">
              {{ loadingProcess ? '분석 중...' : '⑧ 공정 리뷰 (AI)' }}
            </button>
          </div>
        </div>

        <!-- ⑦ 대체 성분 제안 결과 패널 -->
        <div v-if="altSuggestions" class="panel ai-result-panel">
          <div class="panel-header">
            <span class="panel-title">⑦ 대체 성분 제안</span>
            <button class="btn-del" @click="altSuggestions = null">×</button>
          </div>
          <div class="panel-body">
            <div v-if="altSuggestions.summary" class="ai-summary">{{ altSuggestions.summary }}</div>
            <div v-for="(alt, ai) in altSuggestions.alternatives" :key="ai" class="alt-item">
              <div class="alt-original">
                <span class="alt-label">원래</span>
                <strong>{{ alt.original_inci }}</strong>
                <span class="alt-func">({{ alt.original_function }})</span>
              </div>
              <div v-for="(sug, si) in alt.suggestions" :key="si" class="alt-suggestion">
                <div class="sug-name">→ {{ sug.inci }} <span class="sug-kr">{{ sug.korean_name }}</span></div>
                <div class="sug-meta">
                  <span class="sug-tag">{{ sug.usage_range }}</span>
                  <span class="sug-reason">{{ sug.reason }}</span>
                </div>
                <div class="sug-benefit">{{ sug.benefit }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ⑧ 공정 리뷰 결과 패널 -->
        <div v-if="processReview" class="panel ai-result-panel">
          <div class="panel-header">
            <span class="panel-title">⑧ 공정 리뷰</span>
            <button class="btn-del" @click="processReview = null">×</button>
          </div>
          <div class="panel-body">
            <div v-if="processReview.summary" class="ai-summary">{{ processReview.summary }}</div>
            <!-- 공정 단계 -->
            <div v-if="processReview.process_steps?.length" class="proc-section">
              <div class="proc-title">공정 단계</div>
              <div v-for="(step, si) in processReview.process_steps" :key="si" class="proc-step">
                <div class="step-header">
                  <span class="step-num">Step {{ step.step }}</span>
                  <span class="step-phase">{{ step.phase }}</span>
                  <span v-if="step.temperature" class="step-temp">{{ step.temperature }}</span>
                </div>
                <div class="step-desc">{{ step.description }}</div>
                <div v-if="step.notes" class="step-notes">⚠ {{ step.notes }}</div>
              </div>
            </div>
            <!-- 핵심 포인트 -->
            <div v-if="processReview.critical_points?.length" class="proc-section">
              <div class="proc-title">핵심 관리 포인트</div>
              <div v-for="(cp, ci) in processReview.critical_points" :key="ci" class="crit-row">
                <div class="crit-point">{{ cp.point }}</div>
                <div class="crit-control">→ {{ cp.control }}</div>
              </div>
            </div>
            <!-- 품질 확인 -->
            <div v-if="processReview.quality_checks?.length" class="proc-section">
              <div class="proc-title">품질 확인 항목</div>
              <div v-for="(qc, qi) in processReview.quality_checks" :key="qi" class="qc-row">✓ {{ qc }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── 검증 이력 탭 ─── -->
    <div v-if="tab === 'history'" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">검증 이력 ({{ history.total }}건)</span>
        </div>
        <div class="panel-body">
          <div v-if="!history.items.length" class="empty-state">검증 이력이 없습니다.</div>
          <table v-else class="history-table">
            <thead>
              <tr>
                <th>제품명</th>
                <th>성분 수</th>
                <th>합계</th>
                <th>상태</th>
                <th>위험</th>
                <th>주의</th>
                <th>pH</th>
                <th>원가</th>
                <th>일시</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in history.items" :key="item.id" class="history-row" @click="loadReport(item.id)">
                <td class="td-name">{{ item.product_name }}</td>
                <td>{{ item.ingredient_count }}</td>
                <td>{{ item.total_pct }}%</td>
                <td><span :class="['status-chip', `status-${(item.overall_status || 'none').toLowerCase()}`]">{{ statusLabel(item.overall_status) }}</span></td>
                <td class="td-critical">{{ item.critical_count || 0 }}</td>
                <td class="td-warning">{{ item.warning_count || 0 }}</td>
                <td>{{ item.predicted_ph || '-' }}</td>
                <td>{{ item.cost_estimate ? `${Number(item.cost_estimate).toLocaleString()}원` : '-' }}</td>
                <td class="td-date">{{ formatDate(item.created_at) }}</td>
                <td><button class="btn-del" @click.stop="deleteItem(item.id)">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 상세 리포트 팝업 -->
      <div v-if="detailReport" class="detail-overlay" @click.self="detailReport = null">
        <div class="detail-modal">
          <div class="detail-header">
            <h2>{{ detailReport.product_name }}</h2>
            <button class="btn-del" @click="detailReport = null">×</button>
          </div>
          <div class="detail-body" v-if="detailReport.report_data">
            <div v-for="(val, key) in detailReport.report_data.validations" :key="key" class="validation-item">
              <div class="val-header">
                <span :class="['val-icon', `icon-${val.status.toLowerCase()}`]">{{ statusIcon(val.status) }}</span>
                <span class="val-title">{{ val.title }}</span>
                <span class="val-status">{{ statusLabel(val.status) }}</span>
              </div>
              <div class="val-body">
                <div v-for="(chk, ci) in val.checks" :key="ci" :class="['check-row', `check-${(chk.severity || 'info').toLowerCase()}`]">
                  <span class="check-icon">{{ severityIcon(chk.severity) }}</span>
                  <div class="check-content">
                    <div class="check-msg">{{ chk.message }}</div>
                    <div v-if="chk.action" class="check-action">→ {{ chk.action }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const tab = ref('input')
const verifying = ref(false)
const report = ref(null)
const expanded = reactive({})
const history = ref({ items: [], total: 0 })
const detailReport = ref(null)
const altSuggestions = ref(null)
const processReview = ref(null)
const loadingAlt = ref(false)
const loadingProcess = ref(false)

function emptyRow() {
  return { inci_name: '', name: '', wt_pct: null, phase: '', role: '' }
}

const form = reactive({
  product_name: '',
  category_code: '',
  target_ph: null,
  target_viscosity: null,
  ingredients: Array.from({ length: 5 }, emptyRow),
})

const totalPct = computed(() => {
  const ints = form.ingredients.map(i => Math.round((parseFloat(i.wt_pct) || 0) * 100))
  return ints.reduce((s, v) => s + v, 0) / 100
})

function addRow() { form.ingredients.push(emptyRow()) }

function resetForm() {
  form.product_name = ''
  form.category_code = ''
  form.target_ph = null
  form.target_viscosity = null
  form.ingredients = Array.from({ length: 5 }, emptyRow)
  report.value = null
}

function loadSample() {
  form.product_name = '히알루론산 보습 크림'
  form.category_code = 'skincare'
  form.target_ph = 5.5
  form.ingredients = [
    { inci_name: 'Water', name: '정제수', wt_pct: 65.20, phase: 'A', role: '용매' },
    { inci_name: 'Glycerin', name: '글리세린', wt_pct: 5.00, phase: 'A', role: '보습제' },
    { inci_name: 'Butylene Glycol', name: '부틸렌글라이콜', wt_pct: 3.00, phase: 'A', role: '보습제' },
    { inci_name: 'Niacinamide', name: '나이아신아마이드', wt_pct: 2.00, phase: 'A', role: '미백' },
    { inci_name: 'Sodium Hyaluronate', name: '히알루론산나트륨', wt_pct: 0.10, phase: 'A', role: '보습' },
    { inci_name: 'Cetearyl Alcohol', name: '세테아릴알코올', wt_pct: 3.50, phase: 'B', role: '유화안정' },
    { inci_name: 'Ceteareth-20', name: '세테아레스-20', wt_pct: 2.00, phase: 'B', role: '유화제' },
    { inci_name: 'Dimethicone', name: '디메치콘', wt_pct: 2.00, phase: 'B', role: '피부보호' },
    { inci_name: 'Caprylic/Capric Triglyceride', name: '카프릴릭/카프릭트리글리세라이드', wt_pct: 5.00, phase: 'B', role: '유연제' },
    { inci_name: 'Carbomer', name: '카보머', wt_pct: 0.20, phase: 'C', role: '증점제' },
    { inci_name: 'Tocopheryl Acetate', name: '토코페릴아세테이트', wt_pct: 0.50, phase: 'C', role: '항산화' },
    { inci_name: 'Phenoxyethanol', name: '페녹시에탄올', wt_pct: 0.80, phase: 'C', role: '방부제' },
    { inci_name: 'Ethylhexylglycerin', name: '에틸헥실글리세린', wt_pct: 0.20, phase: 'C', role: '방부보조' },
    { inci_name: 'Disodium EDTA', name: '디소듐이디티에이', wt_pct: 0.05, phase: 'C', role: '킬레이트' },
    { inci_name: 'Fragrance', name: '향료', wt_pct: 0.15, phase: 'D', role: '부향' },
  ]
  // 밸런스 맞추기: 정제수 조정
  const nonWater = form.ingredients.filter(i => i.inci_name !== 'Water')
  const nonWaterSum = nonWater.reduce((s, i) => s + Math.round((i.wt_pct || 0) * 100), 0)
  form.ingredients[0].wt_pct = (10000 - nonWaterSum) / 100
}

async function runVerification() {
  const valid = form.ingredients.filter(i => (i.inci_name || i.name) && i.wt_pct > 0)
  if (valid.length < 2) return
  verifying.value = true
  report.value = null
  try {
    const metadata = {}
    if (form.target_ph) metadata.target_ph = form.target_ph
    if (form.target_viscosity) metadata.target_viscosity = form.target_viscosity

    const resp = await fetch(`${API}/api/verify/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: form.product_name,
        ingredients: valid,
        metadata,
        category_code: form.category_code || undefined,
      }),
    })
    const data = await resp.json()
    if (data.success) {
      report.value = data.report
      // 기본 펼침: 문제가 있는 항목
      for (const [key, val] of Object.entries(data.report.validations)) {
        expanded[key] = val.status !== 'PASS' && val.status !== 'INFO'
      }
    } else {
      alert(data.error || '검증 실패')
    }
  } catch (err) {
    alert('서버 연결 오류: ' + err.message)
  } finally {
    verifying.value = false
  }
}

async function loadHistory() {
  try {
    const resp = await fetch(`${API}/api/verify/list?limit=50`)
    history.value = await resp.json()
  } catch { history.value = { items: [], total: 0 } }
}

async function loadReport(id) {
  try {
    const resp = await fetch(`${API}/api/verify/report/${id}`)
    detailReport.value = await resp.json()
  } catch { /* skip */ }
}

async function deleteItem(id) {
  if (!confirm('이 검증 기록을 삭제하시겠습니까?')) return
  try {
    await fetch(`${API}/api/verify/${id}`, { method: 'DELETE' })
    loadHistory()
  } catch { /* skip */ }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    const lines = text.split('\n').filter(l => l.trim())
    const newRows = []
    for (const line of lines) {
      const cols = line.split('\t')
      if (cols.length >= 2) {
        const pct = parseFloat(cols[cols.length - 1].replace('%', '').trim())
        if (!isNaN(pct)) {
          newRows.push({
            inci_name: cols[0].trim(),
            name: cols.length >= 3 ? cols[1].trim() : '',
            wt_pct: pct,
            phase: '',
            role: '',
          })
        }
      }
    }
    if (newRows.length) {
      form.ingredients = newRows
    }
  } catch { alert('클립보드 접근 권한이 필요합니다.') }
}

async function suggestAlternatives() {
  const valid = form.ingredients.filter(i => (i.inci_name || i.name) && i.wt_pct > 0)
  if (!valid.length) return
  loadingAlt.value = true
  altSuggestions.value = null
  try {
    const resp = await fetch(`${API}/api/verify/suggest-alternatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: valid,
        category: form.category_code || '',
        concern: '',
      }),
    })
    const data = await resp.json()
    if (data.error) throw new Error(data.error)
    altSuggestions.value = data
  } catch (err) {
    alert('대체 성분 제안 오류: ' + err.message)
  } finally {
    loadingAlt.value = false
  }
}

async function runProcessReview() {
  const valid = form.ingredients.filter(i => (i.inci_name || i.name) && i.wt_pct > 0)
  if (!valid.length) return
  loadingProcess.value = true
  processReview.value = null
  try {
    const resp = await fetch(`${API}/api/verify/process-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: valid,
        category: form.category_code || '',
        process_notes: '',
      }),
    })
    const data = await resp.json()
    if (data.error) throw new Error(data.error)
    processReview.value = data
  } catch (err) {
    alert('공정 리뷰 오류: ' + err.message)
  } finally {
    loadingProcess.value = false
  }
}

function toggleExpand(key) { expanded[key] = !expanded[key] }
function statusIcon(s) { return s === 'FAIL' ? '✕' : s === 'WARNING' ? '!' : s === 'INFO' ? 'i' : '✓' }
function statusLabel(s) { return s === 'FAIL' ? '위험' : s === 'WARNING' ? '주의' : s === 'PASS' ? '통과' : s === 'INFO' ? '참고' : '미검증' }
function severityIcon(s) { return s === 'CRITICAL' ? '✕' : s === 'WARNING' ? '!' : s === 'PASS' ? '✓' : 'i' }
function formatDate(d) { if (!d) return '-'; const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}` }
</script>

<style scoped>
.verify-page { padding: 0 0 40px; }
.page-header { margin-bottom: 20px; }
.page-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 0; }
.page-desc { font-size: 12px; color: var(--text-dim); margin: 4px 0 0; }

/* 탭 */
.verify-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.tab-btn {
  padding: 8px 20px; font-size: 13px; font-weight: 500; color: var(--text-dim);
  background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s;
}
.tab-btn:hover { color: var(--text-sub); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

/* 레이아웃 */
.input-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 1199px) { .input-layout { grid-template-columns: 1fr; } }

/* 패널 */
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border);
}
.panel-title { font-size: 13px; font-weight: 600; color: var(--text); }
.panel-body { padding: 16px; }
.panel-footer { padding: 12px 16px; border-top: 1px solid var(--border); display: flex; gap: 8px; }

/* 폼 */
.form-row { margin-bottom: 12px; }
.form-label { display: block; font-size: 11px; font-weight: 600; color: var(--text-sub); margin-bottom: 4px; }
.form-input {
  width: 100%; padding: 6px 10px; font-size: 13px; background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 5px; outline: none; box-sizing: border-box;
}
.form-input:focus { border-color: var(--accent); }
.meta-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

/* 성분 테이블 */
.ing-section { margin-top: 16px; }
.ing-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ing-title { font-size: 12px; font-weight: 600; color: var(--text); }
.ing-actions { display: flex; gap: 4px; }
.btn-sm {
  padding: 4px 10px; font-size: 11px; background: var(--accent); color: #fff;
  border: none; border-radius: 4px; cursor: pointer;
}
.btn-sm.btn-outline { background: none; color: var(--accent); border: 1px solid var(--accent); }
.btn-sm:hover { opacity: 0.85; }

.ing-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ing-table th {
  text-align: left; padding: 6px 6px; font-size: 10px; font-weight: 600;
  color: var(--text-dim); border-bottom: 1px solid var(--border); text-transform: uppercase;
}
.ing-table td { padding: 3px 4px; }
.ing-table .form-input { padding: 4px 6px; font-size: 12px; }
.col-no { width: 30px; text-align: center; color: var(--text-dim); font-size: 10px; }
.col-name { min-width: 140px; }
.col-kr { min-width: 100px; }
.col-pct { width: 70px; }
.col-phase { width: 55px; }
.col-role { width: 80px; }
.col-del { width: 28px; }
.pct-input { text-align: right; }
.phase-sel { padding: 4px 2px; font-size: 12px; }
.btn-del { width: 22px; height: 22px; padding: 0; background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--text-dim); cursor: pointer; font-size: 12px; }
.btn-del:hover { background: #fee; color: #c00; border-color: #c00; }
.total-label { text-align: right; font-weight: 600; color: var(--text-sub); font-size: 12px; padding: 6px; }
.total-pct { text-align: right; font-weight: 700; font-size: 13px; padding: 6px; }
.pct-ok { color: var(--accent); }
.pct-err { color: #e04040; }

/* 버튼 */
.btn-primary {
  padding: 8px 24px; font-size: 13px; font-weight: 600; background: var(--accent); color: #fff;
  border: none; border-radius: 6px; cursor: pointer;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline {
  padding: 8px 16px; font-size: 13px; background: none; color: var(--text-sub);
  border: 1px solid var(--border); border-radius: 6px; cursor: pointer;
}
.btn-outline:hover { background: var(--bg); }

/* 상태 칩 */
.status-chip {
  display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
}
.status-fail { background: #fee; color: #c00; }
.status-warning { background: #fff8e6; color: #b87000; }
.status-pass { background: #e6f9ed; color: #0a7; }
.status-info { background: #eef; color: #66a; }
.status-none { background: var(--bg); color: var(--text-dim); }

/* 종합 결과 */
.summary-box { margin-bottom: 16px; padding: 12px; background: var(--bg); border-radius: 6px; }
.summary-stats { display: flex; gap: 16px; }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 22px; font-weight: 700; }
.stat-label { font-size: 10px; color: var(--text-dim); }
.stat-item.critical .stat-num { color: #c00; }
.stat-item.warning .stat-num { color: #b87000; }
.stat-item.pass .stat-num { color: #0a7; }

/* 검증 항목 */
.validation-item { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
.val-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer;
  background: var(--surface); transition: background 0.15s;
}
.val-header:hover { background: var(--bg); }
.val-icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
.icon-fail { background: #fee; color: #c00; }
.icon-warning { background: #fff8e6; color: #b87000; }
.icon-pass { background: #e6f9ed; color: #0a7; }
.icon-info { background: #eef; color: #66a; }
.val-title { flex: 1; font-size: 13px; font-weight: 500; color: var(--text); }
.val-status { font-size: 11px; color: var(--text-dim); }
.val-toggle { color: var(--text-dim); font-size: 10px; }

.val-body { padding: 8px 12px; background: var(--bg); border-top: 1px solid var(--border); }

/* 체크 행 */
.check-row { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; }
.check-row + .check-row { border-top: 1px solid var(--border); }
.check-icon { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
.check-critical .check-icon { background: #fee; color: #c00; }
.check-warning .check-icon { background: #fff8e6; color: #b87000; }
.check-pass .check-icon { background: #e6f9ed; color: #0a7; }
.check-info .check-icon { background: #eef; color: #66a; }
.check-msg { font-size: 12px; color: var(--text); }
.check-action { font-size: 11px; color: var(--accent); margin-top: 2px; }
.check-empty { font-size: 12px; color: var(--text-dim); padding: 8px 0; }

/* 시너지 */
.synergy-section { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
.synergy-title { font-size: 11px; font-weight: 600; color: var(--text-sub); margin-bottom: 4px; }
.synergy-row { font-size: 12px; color: var(--text); padding: 3px 0; }

/* 물성 예측 */
.predicted-section { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); }
.pred-title { font-size: 11px; font-weight: 600; color: var(--text-sub); margin-bottom: 6px; }
.pred-grid { display: flex; gap: 12px; }
.pred-card { padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; text-align: center; min-width: 70px; }
.pred-label { font-size: 10px; font-weight: 600; color: var(--text-dim); }
.pred-value { font-size: 16px; font-weight: 700; color: var(--accent); }
.pred-conf { font-size: 9px; color: var(--text-dim); }

/* 원가 */
.cost-section { margin-top: 8px; }
.cost-summary { display: flex; align-items: center; gap: 8px; }
.cost-total { font-size: 14px; font-weight: 700; color: var(--text); }
.cost-tier { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.tier-저가 { background: #e6f9ed; color: #0a7; }
.tier-중가 { background: #eef; color: #66a; }
.tier-고가 { background: #fff8e6; color: #b87000; }
.tier-프리미엄 { background: #fee; color: #c00; }
.cost-breakdown { margin-top: 8px; }
.cost-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-sub); padding: 2px 0; }

/* 이력 테이블 */
.history-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.history-table th {
  text-align: left; padding: 8px 8px; font-size: 10px; font-weight: 600;
  color: var(--text-dim); border-bottom: 1px solid var(--border);
}
.history-table td { padding: 8px; border-bottom: 1px solid var(--border); }
.history-row { cursor: pointer; transition: background 0.15s; }
.history-row:hover { background: var(--bg); }
.td-name { font-weight: 500; color: var(--text); }
.td-critical { color: #c00; font-weight: 600; }
.td-warning { color: #b87000; font-weight: 600; }
.td-date { color: var(--text-dim); font-size: 11px; }
.empty-state { text-align: center; padding: 40px; color: var(--text-dim); font-size: 13px; }

/* AI 심화 분석 버튼 */
.ai-panel-footer {
  padding: 12px 16px; border-top: 1px solid var(--border);
  display: flex; gap: 8px; flex-wrap: wrap;
}
.btn-ai {
  padding: 7px 16px; font-size: 12px; font-weight: 600;
  background: linear-gradient(135deg, var(--accent), #7c5cfc);
  color: #fff; border: none; border-radius: 6px; cursor: pointer;
}
.btn-ai:hover { opacity: 0.9; }
.btn-ai:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ai-process { background: linear-gradient(135deg, #0e9f6e, #059669); }

/* AI 결과 패널 */
.ai-result-panel { margin-top: 12px; }
.ai-summary {
  padding: 10px 12px; background: var(--bg); border-radius: 6px;
  font-size: 12px; color: var(--text-sub); line-height: 1.6; margin-bottom: 12px;
}

/* 대체 성분 */
.alt-item { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
.alt-original {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.alt-label {
  font-size: 10px; font-weight: 600; color: var(--text-dim);
  background: var(--bg); padding: 1px 6px; border-radius: 10px;
}
.alt-func { font-size: 11px; color: var(--text-dim); }
.alt-suggestion {
  padding: 8px 12px; background: var(--bg); border-bottom: 1px solid var(--border);
}
.alt-suggestion:last-child { border-bottom: none; }
.sug-name { font-size: 12px; font-weight: 600; color: var(--accent); margin-bottom: 4px; }
.sug-kr { font-weight: 400; color: var(--text-sub); font-size: 11px; }
.sug-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.sug-tag { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: #eef; color: #66a; }
.sug-reason { font-size: 11px; color: var(--text-sub); }
.sug-benefit { font-size: 11px; color: #0a7; }

/* 공정 리뷰 */
.proc-section { margin-bottom: 14px; }
.proc-title {
  font-size: 11px; font-weight: 600; color: var(--text-sub);
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;
}
.proc-step {
  border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px;
  margin-bottom: 6px; background: var(--surface);
}
.step-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.step-num { font-size: 10px; font-weight: 700; color: var(--accent); }
.step-phase {
  font-size: 11px; font-weight: 600; background: var(--accent);
  color: #fff; padding: 1px 7px; border-radius: 10px;
}
.step-temp { font-size: 11px; color: #b87000; font-weight: 600; }
.step-desc { font-size: 12px; color: var(--text); line-height: 1.5; }
.step-notes { font-size: 11px; color: #b87000; margin-top: 4px; }
.crit-row { padding: 6px 8px; border-left: 3px solid #e04040; margin-bottom: 4px; background: #fff5f5; border-radius: 0 4px 4px 0; }
.crit-point { font-size: 12px; font-weight: 600; color: var(--text); }
.crit-control { font-size: 11px; color: var(--accent); margin-top: 2px; }
.qc-row { font-size: 12px; color: var(--text); padding: 3px 0; }

/* 상세 모달 */
.detail-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.detail-modal {
  width: 700px; max-height: 80vh; background: var(--surface); border-radius: 10px;
  overflow: hidden; display: flex; flex-direction: column;
}
.detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.detail-header h2 { font-size: 16px; font-weight: 700; color: var(--text); margin: 0; }
.detail-body { padding: 16px 20px; overflow-y: auto; }

@media (max-width: 767px) {
  .meta-row { grid-template-columns: 1fr; }
  .detail-modal { width: 95vw; }
}
</style>
