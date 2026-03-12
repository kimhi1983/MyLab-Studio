/**
 * useExport — 처방 내보내기 (CSV / PDF 인쇄)
 */
export function useExport() {
  /**
   * CSV 내보내기 (BOM 포함, 한글 깨짐 방지)
   * @param {Object} formula - formulaStore의 formula 객체
   */
  function exportFormulaCsv(formula) {
    const ingredients = formula.formula_data?.ingredients || []

    const headers = ['INCI Name', '한글명', 'Phase', '기능', 'wt%', '비고']

    const rows = ingredients.map(ing => [
      ing.inci || ing.name || '',
      ing.name || '',
      ing.phase || '',
      ing.function || '',
      ing.percentage != null ? String(ing.percentage) : '',
      ing.note || '',
    ])

    const total = ingredients.reduce((s, i) => s + (Number(i.percentage) || 0), 0)

    const allRows = [
      headers,
      ...rows,
      [],
      ['합계', '', '', '', String(Math.round(total * 100) / 100), ''],
      [],
      ['처방명', formula.title || ''],
      ['제품 유형', formula.product_type || ''],
      ['상태', labelStatus(formula.status)],
      ['메모', formula.memo || ''],
      ['작성일', formula.created_at ? formatDateShort(formula.created_at) : ''],
      ['수정일', formula.updated_at ? formatDateShort(formula.updated_at) : ''],
    ]

    const csvContent = allRows
      .map(row =>
        row.map(cell => {
          const val = String(cell ?? '').replace(/"/g, '""')
          return /[,"\n\r]/.test(val) ? `"${val}"` : val
        }).join(',')
      )
      .join('\r\n')

    // BOM + UTF-8
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitizeFilename(formula.title || 'formula')}_${dateSuffix()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  /**
   * PDF 인쇄 (새 창 HTML → window.print())
   * @param {Object} formula - formulaStore의 formula 객체
   */
  function exportFormulaPdf(formula) {
    const ingredients = formula.formula_data?.ingredients || []
    const total = ingredients.reduce((s, i) => s + (Number(i.percentage) || 0), 0)

    const rows = ingredients.map((ing, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escHtml(ing.inci || ing.name || '')}</td>
        <td>${escHtml(ing.name || '')}</td>
        <td>${escHtml(ing.phase || '')}</td>
        <td>${escHtml(ing.function || '')}</td>
        <td class="num">${ing.percentage != null ? ing.percentage : ''}</td>
        <td>${escHtml(ing.note || '')}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${escHtml(formula.title || '처방')} — MyLab</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      font-size: 11pt;
      color: #1a1814;
      padding: 20mm 18mm;
      background: #fff;
    }
    .header { border-bottom: 2px solid #1a1814; padding-bottom: 10px; margin-bottom: 16px; }
    .brand { font-size: 9pt; color: #6b6560; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .title { font-size: 18pt; font-weight: 700; }
    .meta-row { display: flex; gap: 24px; margin-top: 8px; flex-wrap: wrap; }
    .meta-item { font-size: 9pt; color: #6b6560; }
    .meta-item strong { color: #1a1814; }
    .section { margin-top: 20px; }
    .section-label {
      font-size: 8pt;
      font-family: 'Courier New', monospace;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #aba59d;
      margin-bottom: 6px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    th {
      background: #f8f7f5;
      border: 1px solid #ece9e3;
      padding: 6px 8px;
      text-align: left;
      font-size: 8.5pt;
      font-weight: 600;
      color: #6b6560;
    }
    td {
      border: 1px solid #ece9e3;
      padding: 5px 8px;
      vertical-align: middle;
    }
    td.num { text-align: right; font-family: 'Courier New', monospace; }
    tr:nth-child(even) td { background: #fafaf8; }
    .total-row td {
      font-weight: 700;
      background: #f0e8d8 !important;
      border-top: 2px solid #b8935a;
    }
    .total-row td.num { color: #b8935a; }
    .memo-box {
      border: 1px solid #ece9e3;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 10pt;
      line-height: 1.6;
      white-space: pre-wrap;
      color: #3a3530;
    }
    .footer {
      margin-top: 28px;
      padding-top: 10px;
      border-top: 1px solid #ece9e3;
      font-size: 8pt;
      color: #aba59d;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 15mm 14mm; }
      @page { size: A4; margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="padding:12px;background:#f0f4fb;margin-bottom:16px;border-radius:6px;font-size:11pt;">
    <button onclick="window.print()" style="padding:8px 20px;background:#3a6fa8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11pt;">인쇄 / PDF 저장</button>
    <button onclick="window.close()" style="padding:8px 16px;margin-left:8px;background:transparent;border:1px solid #d8d4cc;border-radius:4px;cursor:pointer;font-size:11pt;">닫기</button>
  </div>

  <div class="header">
    <div class="brand">MyLab · Formula Sheet</div>
    <div class="title">${escHtml(formula.title || '처방')}</div>
    <div class="meta-row">
      <div class="meta-item"><strong>제품 유형</strong> ${escHtml(formula.product_type || '미지정')}</div>
      <div class="meta-item"><strong>상태</strong> ${escHtml(labelStatus(formula.status))}</div>
      <div class="meta-item"><strong>ID</strong> ${escHtml(formula.id || '')}</div>
      <div class="meta-item"><strong>수정일</strong> ${formula.updated_at ? formatDateShort(formula.updated_at) : ''}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Ingredient Table</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>INCI Name</th>
          <th>한글명</th>
          <th>Phase</th>
          <th>기능</th>
          <th>wt%</th>
          <th>비고</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="5" style="text-align:right">합계</td>
          <td class="num">${Math.round(total * 100) / 100}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${formula.formula_data?.notes ? `
  <div class="section">
    <div class="section-label">제조 메모</div>
    <div class="memo-box">${escHtml(formula.formula_data.notes)}</div>
  </div>
  ` : ''}

  ${formula.memo ? `
  <div class="section">
    <div class="section-label">처방 메모</div>
    <div class="memo-box">${escHtml(formula.memo)}</div>
  </div>
  ` : ''}

  <div class="footer">
    <span>MyLab Prototype</span>
    <span>출력일: ${formatDateShort(new Date().toISOString())}</span>
  </div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  // --- 유틸 ---
  function labelStatus(status) {
    const map = { draft: '초안', review: '검토중', done: '완료' }
    return map[status] || status || ''
  }

  function formatDateShort(isoStr) {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  function dateSuffix() {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  }

  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  return { exportFormulaCsv, exportFormulaPdf }
}
