const http = require('http');

const TEST_CASES = [
  { id: 'A1', name: '고보습 수분크림', req: '세라마이드 필수 포함, 히알루론산 0.1% 이상, 민감성 피부',
    check: (r) => { const i = getInci(r); return { 'ceramide': /ceramide/i.test(i), 'hyaluronate': /hyaluronic|hyaluronate/i.test(i) }; }},
  { id: 'C1', name: '쿠션 파운데이션', req: '커버력 좋은, 21호, 지속력',
    check: (r) => { const i = getInci(r); return { '색소': /ci 77891|ci 77492|ci 77491|ci 77499|iron oxide/i.test(i), '자외선차단제': /zinc oxide|titanium dioxide/i.test(i) }; }},
  { id: 'D1', name: '멀티밤', req: '입술+볼+눈가 다용도, 보습, 휴대용',
    check: (r) => { const a = getAquaPct(r); const i = getInci(r); return { '무수(Aqua≤5%)': a <= 5, '왁스베이스': /wax|candelilla|carnauba|beeswax|ceresin|ozokerite/i.test(i) }; }},
  { id: 'F1', name: '임산부용 보습크림', req: '레티놀 제외, 살리실산 제외, 무향, 저자극, EWG 그린, 세라마이드 포함',
    check: (r) => { const i = getInci(r); return { 'retinol없음': !/retinol|retinyl/i.test(i), 'salicylic없음': !/salicylic/i.test(i), 'fragrance없음': !/fragrance|parfum/i.test(i), 'ceramide': /ceramide/i.test(i) }; }},
  { id: 'A3', name: '시카 진정 에센스', req: '민감성 피부, 무향, 무알코올, 판테놀 포함',
    check: (r) => { const i = getInci(r); return { 'centella': /centella/i.test(i), 'panthenol': /panthenol/i.test(i), 'fragrance없음': !/fragrance|parfum/i.test(i), 'alcohol없음': !/alcohol denat|ethanol|sd alcohol/i.test(i) }; }},
];

function getInci(r) {
  return (r.ingredients||r.formula||[]).map(i=>(i.inci_name||i.name||'')).join(' ').toLowerCase();
}
function getAquaPct(r) {
  const list = r.ingredients||r.formula||[];
  const aqua = list.find(i => /^(aqua|water|정제수)/i.test(i.inci_name||i.name||''));
  return aqua ? parseFloat(aqua.percentage||aqua.pct||0) : 0;
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
  console.log('  병렬 Pro 조합 테스트  |  5개 제형');
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
      console.log(`${ok?'✅':'❌'} ${sec}s  score=${data.purpose_score??'-'}  retried=${data.retried??false}  ${str}`);
    } catch(e) {
      const sec=((Date.now()-t0)/1000).toFixed(1); total+=parseFloat(sec);
      results.push({id:tc.id,name:tc.name,sec,ok:false,str:'ERROR:'+e.message,score:'-'});
      console.log(`💥 ${sec}s  ${e.message}`);
    }
  }
  console.log('\n'+'='.repeat(70));
  console.log(`  통과: ${pass}/${TEST_CASES.length}  |  총 ${total.toFixed(1)}s  |  평균 ${(total/TEST_CASES.length).toFixed(1)}s`);
  console.log('='.repeat(70));
  for(const r of results)
    console.log(`${r.ok?'✅':'❌'} ${r.id}  ${r.name.padEnd(18)} ${r.sec}s  score=${String(r.score).padEnd(4)}  ${r.str}`);
}
run().catch(console.error);
