import { ref } from 'vue'
import * as XLSX from 'xlsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ──────────────────────────────────────────────
// 파일 → 텍스트 추출
// ──────────────────────────────────────────────
function extractTextFromExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // 2D 배열로 변환 후 탭 구분 텍스트로 직렬화
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  return rows.map(row => row.join('\t')).join('\n')
}

async function extractTextFromPDF(buffer) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).href

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let text = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    // 각 아이템의 x 좌표로 탭 정렬 시도
    let lastX = null
    for (const item of content.items) {
      if (lastX !== null && item.transform[4] - lastX > 50) text += '\t'
      else if (lastX !== null) text += ' '
      text += item.str
      lastX = item.transform[4] + (item.width || 0)
    }
    text += '\n'
  }
  return text
}

// ──────────────────────────────────────────────
// 서버 AI 파싱 호출
// ──────────────────────────────────────────────
async function aiParseText(text, filename) {
  const resp = await fetch(`${API}/api/verify/parse-formula-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, filename }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }))
    throw new Error(err.error || 'AI 파싱 오류')
  }
  return resp.json()
}

// ──────────────────────────────────────────────
// DB 매칭
// ──────────────────────────────────────────────
async function matchWithDB(rows) {
  const results = []
  for (const row of rows) {
    const query = row.inci_name || row.name
    if (!query) {
      results.push({ ...row, match: null, matchStatus: 'empty' })
      continue
    }
    try {
      const resp = await fetch(`${API}/api/ingredients?q=${encodeURIComponent(query)}&limit=3`)
      const data = await resp.json()
      const items = data.items || data.data || []

      const exact = items.find(
        (d) => d.inci_name?.toLowerCase() === query.toLowerCase() ||
               d.korean_name?.toLowerCase() === query.toLowerCase()
      )
      const best = exact || items[0] || null

      results.push({
        ...row,
        match: best,
        matchStatus: best ? (exact ? 'exact' : 'fuzzy') : 'unmatched',
        inci_name: best?.inci_name || row.inci_name,
        name: best?.korean_name || row.name,
      })
    } catch {
      results.push({ ...row, match: null, matchStatus: 'unmatched' })
    }
  }
  return results
}

// ──────────────────────────────────────────────
// composable export
// ──────────────────────────────────────────────
export function useFormulaImport() {
  const importing = ref(false)
  const importStatus = ref('')   // 상태 메시지
  const importRows = ref([])
  const importProductName = ref('')
  const showPreview = ref(false)
  const dragOver = ref(false)
  const importError = ref('')

  async function handleFile(file) {
    importing.value = true
    importError.value = ''
    importRows.value = []
    importProductName.value = ''

    try {
      const buffer = await file.arrayBuffer()
      let rawText = ''

      // 1단계: 파일 → 텍스트
      importStatus.value = '파일 읽는 중…'
      if (file.name.match(/\.xlsx?$/i)) {
        rawText = extractTextFromExcel(new Uint8Array(buffer))
      } else if (file.name.match(/\.pdf$/i)) {
        rawText = await extractTextFromPDF(new Uint8Array(buffer))
      } else {
        importError.value = '.xlsx, .xls, .pdf 파일만 지원합니다.'
        return
      }

      if (!rawText.trim()) {
        importError.value = '텍스트를 추출하지 못했습니다. 스캔 PDF는 지원하지 않습니다.'
        return
      }

      // 2단계: AI 파싱
      importStatus.value = 'AI 성분 분석 중…'
      const parsed = await aiParseText(rawText, file.name)

      if (!parsed.ingredients?.length) {
        importError.value = 'AI가 성분 데이터를 찾지 못했습니다. 파일 형식을 확인해주세요.'
        return
      }

      importProductName.value = parsed.product_name || ''

      // 3단계: DB 매칭
      importStatus.value = `${parsed.ingredients.length}개 성분 DB 매칭 중…`
      importRows.value = await matchWithDB(parsed.ingredients)
      showPreview.value = true
    } catch (err) {
      importError.value = err.message
    } finally {
      importing.value = false
      importStatus.value = ''
    }
  }

  function onDrop(e) {
    dragOver.value = false
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  function onFileInput(e) {
    const file = e.target?.files?.[0]
    if (file) handleFile(file)
  }

  function closePreview() {
    showPreview.value = false
    importRows.value = []
    importProductName.value = ''
  }

  return {
    importing,
    importStatus,
    importRows,
    importProductName,
    showPreview,
    dragOver,
    importError,
    handleFile,
    onDrop,
    onFileInput,
    closePreview,
  }
}
