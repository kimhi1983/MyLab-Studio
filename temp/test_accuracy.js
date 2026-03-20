const http = require('http');

const TEST_CASES = [
  { id: 'A1', name: '고보습 수분크림', req: '세라마이드 필수 포함, 히알루론산 0.1% 이상, 민감성 피부',
    check: (r) => { const i = getInci(r); return { 'ceramide포함': /ceramide/i.test(i), 'hyaluronic포함': /hyaluronic|hyaluronate/i.test(i) }; }},
  { id: 'A2', name: '미백 톤업 세럼', req: '나이아신아마이드 3%, 알파알부틴 1%, EWG 그린 등급',
    check: (r) => { const i = getInci(r); return { 'niacinamide포함': /niacinamide/i.test(i), 'arbutin포함': /arbutin/i.test(i) }; }},
  { id: 'A3', name: '시카 진정 에센스', req: '민감성 피부, 무향, 무알코올, 판테놀 포함',
    check: (r) => { const i = getInci(r); return { 'centella포함': /centella/i.test(i), 'panthenol포함': /panthenol/i.test(i), 'fragrance없음': !/fragrance|parfum/i.test(i), 'alcohol없음': !/alcohol denat|ethanol|sd alcohol/i.test(i) }; }},
  { id: 'A4', name: '레티놀 안티에이징 크림', req: '레티놀 0.05%, 펩타이드 포함, 50대 여성 타겟',
    check: (r) => { const i = getInci(r); return { 'retinol포함': /retinol/i.test(i), 'peptide포함': /peptide/i.test(i) }; }},
  { id: 'A5', name: 'PDRN 재생 앰플', req: '고농축, 저자극, 무색소',
    check: (r) => { const i = getInci(r); return { 'PDRN포함': /pdrn|hydrolyzed dna|polydeoxyribonucleotide/i.test(i), 'CI색소없음': !/\bci \d/i.test(i) }; }},
  { id: 'A6', name: '수분 토너', req: '가볍고 산뜻한 사용감, 지성피부, 비건',
    check: (r) => { const i = getInci(r); return { '동물유래없음': !/\blanolin\b|beeswax|carmine/i.test(i) }; }},
  { id: 'B1', name: '산뜻한 데일리 선크림', req: 'SPF50+ PA++++, 무기자차, 백탁 최소화',
    check: (r) => { const i = getInci(r); return { 'ZnO또는TiO2': /zinc oxide|titanium dioxide/i.test(i) }; }},
  { id: 'B2', name: '톤업 선세럼', req: 'SPF30, 톤업 효과, 보습',
    check: (r) => { const i = getInci(r); return { '자외선차단제포함': /zinc oxide|titanium dioxide|octinoxate|avobenzone/i.test(i) }; }},
  { id: 'C1', name: '쿠션 파운데이션', req: '커버력 좋은, 21호, 지속력',
    check: (r) => { const i = getInci(r); return { '색소포함': /ci 77891|ci 77492|ci 77491|ci 77499|iron oxide/i.test(i), '자외선차단제포함': /zinc oxide|titanium dioxide/i.test(i) }; }},
  { id: 'C2', name: '매트 립스틱', req: '고발색, MLBB 컬러, 장시간 지속',
    check: (r) => { const i = getInci(r); const a = getAquaPct(r); return { '무수제형(Aqua≤5%)': a <= 5, '색소포함': /ci \d|iron oxide|red 7/i.test(i), '왁스포함': /wax|candelilla|carnauba|beeswax|ceresin/i.test(i) }; }},
  { id: 'D1', name: '멀티밤', req: '입술+볼+눈가 다용도, 보습, 휴대용',
    check: (r) => { const i = getInci(r); const a = getAquaPct(r); return { '무수제형(Aqua≤5%)': a <= 5, '왁스베이스': /wax|candelilla|carnauba|beeswax|ceresin|ozokerite/i.test(i) }; }},
  { id: 'E1', name: '탈모방지 샴푸', req: '비오틴 포함, 두피 자극 최소, 약산성',
    check: (r) => { const i = getInci(r); return { 'biotin포함': /biotin|capixyl/i.test(i), '계면활성제포함': /lauryl|laureth|cocamido|betaine/i.test(i) }; }},
  { id: 'E2', name: '보습 바디로션', req: '시어버터 포함, 대용량, 온가족용',
    check: (r) => { const i = getInci(r); return { 'shea_butter포함': /shea butter|butyrospermum parkii/i.test(i) }; }},
  { id: 'F1', name: '임산부용 보습크림', req: '레티놀 제외, 살리실산 제외, 무향, 저자극, EWG 그린, 세라마이드 포함',
    check: (r) => { const i = getInci(r); return { 'retinol없음': !/retinol|retinyl/i.test(i), 'salicylic없음': !/salicylic/i.test(i), 'fragrance없음': !/fragrance|parfum/i.test(i), 'ceramide포함': /ceramide/i.test(i) }; }},
  { id: 'F2', name: '아토피 유아용 로션', req: '무향, 무색소, 무알코올, 약산성 pH 5.5, 최소 성분 구성',
    check: (r) => { const i = getInci(r); const cnt = (r.ingredients||r.formula||[]).length; return { 'fragrance없음': !/fragrance|parfum/i.test(i), 'alcohol없음': !/alcohol denat|ethanol/i.test(i), '성분수≤20': cnt <= 20 }; }},
];

function getInci(r) {
  return (r.ingredients||r.formula||[]).map(i => (i.inci_name||i.name||'')).join(' ').toLowerCase();
}
function getAquaPct(r) {
  const list = r.ingredients||r.formula||[];
  const aqua = list.find(i => /^(aqua|water|정제수)/i.test(i.inci_name||i.name||''));
  return aqua ? parseFloat(aqua.percentage||aqua.pct||aqua.wt_pct||0) : 0;
}
function apiCall(path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname:'localhost', port:3001, path, method:'POST',
      headers:{'Content-Type':'application/json'}, timeout:300000 }, (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d))}catch{resolve({raw:d})} });
    });
    req.on('error',reject); req.on('timeout',()=>{req.destroy();reject(new Error('TIMEOUT'))});
    req.write(JSON.stringify(body)); req.end();
  });
}

async function run() {
  console.log('='.repeat(70));
  console.log('  처방 생성 정확도/속도 종합 테스트  |  ' + TEST_CASES.length + '개');
  console.log('='.repeat(70));
  const results = []; let pass=0, total=0;
  for (const tc of TEST_CASES) {
    process.stdout.write(`\n[${tc.id}] ${tc.name} ... `);
    const t0 = Date.now();
    try {
      const res = await apiCall('/api/formula/generate-idea', { formula_name:tc.name, requirements:tc.req, product_type:'' });
      const sec = ((Date.now()-t0)/1000).toFixed(1); total+=parseFloat(sec);
      const data = res.data||res;
      const chk = tc.check(data);
      const ok = Object.values(chk).every(v=>v);
      if(ok) pass++;
      const str = Object.entries(chk).map(([k,v])=>`${v?'✅':'❌'}${k}`).join(' ');
      results.push({id:tc.id,name:tc.name,sec,ok,str,score:data.purpose_score??'-',retried:data.retried??false});
      console.log(`${ok?'✅':'❌'} ${sec}s score=${data.purpose_score??'-'} ${str}`);
    } catch(e) {
      const sec=((Date.now()-t0)/1000).toFixed(1); total+=parseFloat(sec);
      results.push({id:tc.id,name:tc.name,sec,ok:false,str:'ERROR:'+e.message,score:'-'});
      console.log(`💥 ${sec}s ${e.message}`);
    }
  }
  console.log('\n'+'='.repeat(70));
  console.log(`  통과: ${pass}/${TEST_CASES.length} (${(pass/TEST_CASES.length*100).toFixed(0)}%)`);
  console.log(`  총 시간: ${total.toFixed(1)}s | 평균: ${(total/TEST_CASES.length).toFixed(1)}s`);
  console.log('='.repeat(70));
  for(const r of results) console.log(`${r.ok?'✅':'❌'} ${r.id} ${r.name.padEnd(18)} ${r.sec}s score=${String(r.score).padEnd(4)} ${r.str}`);
}
run().catch(console.error);
