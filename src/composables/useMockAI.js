import { ref } from 'vue'

const TEMPLATES = {
  'moisturizing-serum': {
    description: '히알루론산과 글리세린을 핵심으로 한 고보습 세럼입니다. 피부 장벽 강화와 수분 유지에 최적화되어 있습니다.',
    ingredients: [
      { name: '정제수', inci_name: 'Water', percentage: 72, function: '용매' },
      { name: '글리세린', inci_name: 'Glycerin', percentage: 8, function: '보습' },
      { name: '부틸렌글라이콜', inci_name: 'Butylene Glycol', percentage: 5, function: '보습/용제' },
      { name: '히알루론산나트륨', inci_name: 'Sodium Hyaluronate', percentage: 2, function: '보습' },
      { name: '나이아신아마이드', inci_name: 'Niacinamide', percentage: 5, function: '미백/보습' },
      { name: '판테놀', inci_name: 'Panthenol', percentage: 2, function: '진정' },
      { name: '알란토인', inci_name: 'Allantoin', percentage: 0.5, function: '진정' },
      { name: '잔탄검', inci_name: 'Xanthan Gum', percentage: 0.3, function: '증점' },
      { name: '카보머', inci_name: 'Carbomer', percentage: 0.2, function: '증점' },
      { name: '트리에탄올아민', inci_name: 'Triethanolamine', percentage: 0.1, function: 'pH조절' },
      { name: '1,2-헥산디올', inci_name: '1,2-Hexanediol', percentage: 2, function: '방부' },
      { name: 'EDTA-2Na', inci_name: 'Disodium EDTA', percentage: 0.02, function: '킬레이트' },
      { name: '세라마이드NP', inci_name: 'Ceramide NP', percentage: 0.1, function: '장벽강화' },
      { name: '향료', inci_name: 'Fragrance', percentage: 0.08, function: '향' },
    ],
    phases: [
      { phase: 'A', name: '수상', temp: '75°C', items: ['정제수', '글리세린', '부틸렌글라이콜'] },
      { phase: 'B', name: '증점', temp: '상온', items: ['잔탄검', '카보머'] },
      { phase: 'C', name: '활성', temp: '40°C 이하', items: ['히알루론산나트륨', '나이아신아마이드', '판테놀', '세라마이드NP'] },
    ],
    process: [
      { step: 1, phase: 'A', desc: '수상 원료 투입 후 가열', temp: '75°C', time: '10분', note: '교반 300rpm' },
      { step: 2, phase: 'B', desc: '증점제 서서히 투입', temp: '75°C', time: '15분', note: '덩어리 방지' },
      { step: 3, phase: '-', desc: '냉각', temp: '40°C', time: '20분', note: '교반 유지' },
      { step: 4, phase: 'C', desc: '활성 성분 투입', temp: '40°C 이하', time: '10분', note: '저속 교반' },
      { step: 5, phase: '-', desc: 'pH 조절', temp: '상온', time: '5분', note: 'pH 5.0~6.0' },
      { step: 6, phase: '-', desc: '방부제 투입', temp: '상온', time: '5분', note: '' },
      { step: 7, phase: '-', desc: '충전', temp: '상온', time: '-', note: '기포 제거 후' },
    ],
  },
  'brightening-cream': {
    description: '나이아신아마이드 5%와 알부틴을 조합한 미백 기능성 크림입니다. O/W 유화 타입으로 가벼운 사용감을 제공합니다.',
    ingredients: [
      { name: '정제수', inci_name: 'Water', percentage: 58, function: '용매' },
      { name: '글리세린', inci_name: 'Glycerin', percentage: 5, function: '보습' },
      { name: '나이아신아마이드', inci_name: 'Niacinamide', percentage: 5, function: '미백' },
      { name: '알파알부틴', inci_name: 'Alpha-Arbutin', percentage: 2, function: '미백' },
      { name: '세틸알코올', inci_name: 'Cetyl Alcohol', percentage: 3, function: '유화안정' },
      { name: '스쿠알란', inci_name: 'Squalane', percentage: 8, function: '에몰리언트' },
      { name: '시어버터', inci_name: 'Shea Butter', percentage: 4, function: '에몰리언트' },
      { name: '세테아릴올리베이트', inci_name: 'Cetearyl Olivate', percentage: 3, function: '유화제' },
      { name: '소르비탄올리베이트', inci_name: 'Sorbitan Olivate', percentage: 2, function: '유화제' },
      { name: '토코페롤', inci_name: 'Tocopherol', percentage: 0.5, function: '항산화' },
      { name: '카보머', inci_name: 'Carbomer', percentage: 0.2, function: '증점' },
      { name: '페녹시에탄올', inci_name: 'Phenoxyethanol', percentage: 0.8, function: '방부' },
      { name: '향료', inci_name: 'Fragrance', percentage: 0.1, function: '향' },
    ],
    phases: [
      { phase: 'A', name: '수상', temp: '75°C', items: ['정제수', '글리세린', '나이아신아마이드'] },
      { phase: 'B', name: '유상', temp: '75°C', items: ['스쿠알란', '시어버터', '세틸알코올', '유화제'] },
      { phase: 'C', name: '활성', temp: '40°C 이하', items: ['알파알부틴', '토코페롤'] },
    ],
    process: [
      { step: 1, phase: 'A', desc: '수상 원료 가열', temp: '75°C', time: '10분', note: '' },
      { step: 2, phase: 'B', desc: '유상 원료 용해', temp: '75°C', time: '10분', note: '' },
      { step: 3, phase: '-', desc: 'B→A 투입 유화', temp: '75°C', time: '15분', note: '호모믹서 5000rpm' },
      { step: 4, phase: '-', desc: '냉각', temp: '40°C', time: '20분', note: '교반 유지' },
      { step: 5, phase: 'C', desc: '활성 성분 투입', temp: '40°C 이하', time: '10분', note: '' },
      { step: 6, phase: '-', desc: '충전', temp: '상온', time: '-', note: '' },
    ],
  },
  'sunscreen-spf50': {
    description: 'SPF50+ PA++++ 고자외선 차단 선크림입니다. 이산화티타늄과 징크옥사이드를 조합한 물리적 차단 제형입니다.',
    ingredients: [
      { name: '정제수', inci_name: 'Water', percentage: 40, function: '용매' },
      { name: '사이클로펜타실록산', inci_name: 'Cyclopentasiloxane', percentage: 15, function: '에몰리언트' },
      { name: '이산화티타늄', inci_name: 'Titanium Dioxide', percentage: 12, function: 'UV차단' },
      { name: '징크옥사이드', inci_name: 'Zinc Oxide', percentage: 8, function: 'UV차단' },
      { name: '글리세린', inci_name: 'Glycerin', percentage: 5, function: '보습' },
      { name: '디메치콘', inci_name: 'Dimethicone', percentage: 5, function: '피막형성' },
      { name: '부틸렌글라이콜', inci_name: 'Butylene Glycol', percentage: 3, function: '보습' },
      { name: '세틸PEG/PPG-10/1디메치콘', inci_name: 'Cetyl PEG/PPG-10/1 Dimethicone', percentage: 3, function: 'W/Si유화제' },
      { name: '나일론-12', inci_name: 'Nylon-12', percentage: 2, function: '촉감개선' },
      { name: '황산마그네슘', inci_name: 'Magnesium Sulfate', percentage: 1, function: '안정화' },
      { name: '페녹시에탄올', inci_name: 'Phenoxyethanol', percentage: 0.8, function: '방부' },
      { name: '토코페롤', inci_name: 'Tocopherol', percentage: 0.3, function: '항산화' },
    ],
    phases: [
      { phase: 'A', name: '실리콘상', temp: '상온', items: ['사이클로펜타실록산', '디메치콘', '유화제'] },
      { phase: 'B', name: '분체', temp: '상온', items: ['이산화티타늄', '징크옥사이드', '나일론-12'] },
      { phase: 'C', name: '수상', temp: '상온', items: ['정제수', '글리세린', '부틸렌글라이콜'] },
    ],
    process: [
      { step: 1, phase: 'A', desc: '실리콘 원료 혼합', temp: '상온', time: '5분', note: '' },
      { step: 2, phase: 'B', desc: 'A에 분체 분산', temp: '상온', time: '20분', note: '비드밀 또는 호모믹서' },
      { step: 3, phase: 'C', desc: '수상 원료 혼합', temp: '상온', time: '5분', note: '' },
      { step: 4, phase: '-', desc: 'C→AB 투입 유화', temp: '상온', time: '15분', note: '호모믹서 3000rpm' },
      { step: 5, phase: '-', desc: '탈포 및 충전', temp: '상온', time: '-', note: '진공 탈포' },
    ],
  },
  'cleansing-foam': {
    description: '약산성 아미노산 계면활성제 기반의 순한 클렌징 폼입니다. 피부 자극을 최소화하면서 세정력을 확보했습니다.',
    ingredients: [
      { name: '정제수', inci_name: 'Water', percentage: 50, function: '용매' },
      { name: '코코일글리시네이트K', inci_name: 'Potassium Cocoyl Glycinate', percentage: 18, function: '계면활성제' },
      { name: '글리세린', inci_name: 'Glycerin', percentage: 8, function: '보습' },
      { name: '코카미도프로필베타인', inci_name: 'Cocamidopropyl Betaine', percentage: 6, function: '보조계면활성제' },
      { name: '미리스트산', inci_name: 'Myristic Acid', percentage: 5, function: '거품형성' },
      { name: '수산화칼륨', inci_name: 'Potassium Hydroxide', percentage: 2, function: '비누화' },
      { name: '소르비톨', inci_name: 'Sorbitol', percentage: 3, function: '보습' },
      { name: '폴리쿼터늄-7', inci_name: 'Polyquaternium-7', percentage: 0.5, function: '컨디셔닝' },
      { name: '시트르산', inci_name: 'Citric Acid', percentage: 0.3, function: 'pH조절' },
      { name: '페녹시에탄올', inci_name: 'Phenoxyethanol', percentage: 0.8, function: '방부' },
      { name: '향료', inci_name: 'Fragrance', percentage: 0.2, function: '향' },
    ],
    phases: [
      { phase: 'A', name: '수상', temp: '70°C', items: ['정제수', '글리세린', '소르비톨'] },
      { phase: 'B', name: '계면활성', temp: '70°C', items: ['코코일글리시네이트K', '코카미도프로필베타인', '미리스트산', 'KOH'] },
    ],
    process: [
      { step: 1, phase: 'A', desc: '수상 가열', temp: '70°C', time: '10분', note: '' },
      { step: 2, phase: 'B', desc: '계면활성제 투입', temp: '70°C', time: '15분', note: '거품 방지 저속교반' },
      { step: 3, phase: '-', desc: '냉각 후 pH 조절', temp: '상온', time: '10분', note: 'pH 5.5~6.5' },
      { step: 4, phase: '-', desc: '충전', temp: '상온', time: '-', note: '' },
    ],
  },
  'anti-aging-serum': {
    description: '레티놀과 펩타이드를 핵심으로 한 안티에이징 세럼입니다. 주름 개선과 탄력 회복에 초점을 맞추었습니다.',
    ingredients: [
      { name: '정제수', inci_name: 'Water', percentage: 68, function: '용매' },
      { name: '부틸렌글라이콜', inci_name: 'Butylene Glycol', percentage: 6, function: '보습/용제' },
      { name: '글리세린', inci_name: 'Glycerin', percentage: 5, function: '보습' },
      { name: '나이아신아마이드', inci_name: 'Niacinamide', percentage: 4, function: '주름개선' },
      { name: '레티놀', inci_name: 'Retinol', percentage: 0.1, function: '주름개선' },
      { name: '아세틸헥사펩타이드-8', inci_name: 'Acetyl Hexapeptide-8', percentage: 0.05, function: '주름개선' },
      { name: '아데노신', inci_name: 'Adenosine', percentage: 0.04, function: '주름개선' },
      { name: '히알루론산나트륨', inci_name: 'Sodium Hyaluronate', percentage: 1, function: '보습' },
      { name: '스쿠알란', inci_name: 'Squalane', percentage: 3, function: '에몰리언트' },
      { name: '폴리소르베이트20', inci_name: 'Polysorbate 20', percentage: 1, function: '가용화' },
      { name: '잔탄검', inci_name: 'Xanthan Gum', percentage: 0.2, function: '증점' },
      { name: '토코페롤', inci_name: 'Tocopherol', percentage: 0.5, function: '항산화' },
      { name: '1,2-헥산디올', inci_name: '1,2-Hexanediol', percentage: 2, function: '방부' },
      { name: 'EDTA-2Na', inci_name: 'Disodium EDTA', percentage: 0.02, function: '킬레이트' },
    ],
    phases: [
      { phase: 'A', name: '수상', temp: '75°C', items: ['정제수', '글리세린', '부틸렌글라이콜'] },
      { phase: 'B', name: '유상', temp: '75°C', items: ['스쿠알란', '폴리소르베이트20'] },
      { phase: 'C', name: '활성', temp: '35°C 이하', items: ['레티놀', '펩타이드', '아데노신'] },
    ],
    process: [
      { step: 1, phase: 'A', desc: '수상 가열', temp: '75°C', time: '10분', note: '' },
      { step: 2, phase: 'B', desc: '유상 가열 후 수상 투입', temp: '75°C', time: '15분', note: '' },
      { step: 3, phase: '-', desc: '냉각', temp: '35°C', time: '20분', note: '레티놀 열분해 방지' },
      { step: 4, phase: 'C', desc: '활성 성분 투입', temp: '35°C 이하', time: '10분', note: '차광 교반' },
      { step: 5, phase: '-', desc: '충전', temp: '상온', time: '-', note: '차광 용기' },
    ],
  },
}

// Default fallback
for (const type of ['toner', 'essence', 'eye-cream', 'body-lotion', 'lip-balm']) {
  TEMPLATES[type] = TEMPLATES['moisturizing-serum']
}

function randomVariation(val, range = 2) {
  const delta = (Math.random() - 0.5) * 2 * range
  return Math.round((val + delta) * 100) / 100
}

export function useMockAI() {
  const isGenerating = ref(false)
  const progress = ref('')

  async function generateGuideFormula(productType, requirements = '') {
    isGenerating.value = true
    const steps = ['성분 DB 검색 중...', '배합비 최적화 중...', '규제 검증 중...', '최종 처방 생성 중...']

    for (const step of steps) {
      progress.value = step
      await new Promise(r => setTimeout(r, 800 + Math.random() * 700))
    }

    const template = TEMPLATES[productType] || TEMPLATES['moisturizing-serum']
    const ingredients = template.ingredients.map(ing => ({
      ...ing,
      percentage: ing.name === '정제수'
        ? ing.percentage
        : Math.max(0.01, randomVariation(ing.percentage, ing.percentage * 0.1)),
    }))

    // Adjust water to make total 100%
    const nonWaterTotal = ingredients.filter(i => i.name !== '정제수').reduce((s, i) => s + i.percentage, 0)
    const waterIdx = ingredients.findIndex(i => i.name === '정제수')
    if (waterIdx >= 0) {
      ingredients[waterIdx].percentage = Math.round((100 - nonWaterTotal) * 100) / 100
    }

    isGenerating.value = false
    progress.value = ''

    return {
      description: template.description + (requirements ? `\n\n사용자 요청: ${requirements}` : ''),
      ingredients,
      phases: template.phases,
      process: template.process,
      totalPercentage: 100,
      generatedAt: new Date().toISOString(),
    }
  }

  return { isGenerating, progress, generateGuideFormula }
}
