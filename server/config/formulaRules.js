// server/config/formulaRules.js
// ─── 처방 템플릿 + 제형 베이스 규칙 ─────────────────────────────────────────

// ── FORMULA_TEMPLATES (guide-formula 전통 처방 생성용) ──
export const FORMULA_TEMPLATES = {
  '크림': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 500 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '세테아릴알코올', inci: 'Cetearyl Alcohol', phase: 'B', type: 'EMULSIFIER', fn: '유화안정제', pct_int: 300 },
    { name: '스테아릭애씨드', inci: 'Stearic Acid', phase: 'B', type: 'EMULSIFIER', fn: '유화보조제', pct_int: 150 },
    { name: '호호바오일', inci: 'Simmondsia Chinensis (Jojoba) Seed Oil', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 500 },
    { name: '시어버터', inci: 'Butyrospermum Parkii (Shea) Butter', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 300 },
    { name: '디메치콘', inci: 'Dimethicone', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트/피막형성', pct_int: 200 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 300 },
    { name: '판테놀', inci: 'Panthenol', phase: 'C', type: 'ACTIVE', fn: '진정/보습', pct_int: 100 },
    { name: '잔탄검', inci: 'Xanthan Gum', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 20 },
    { name: '카보머', inci: 'Carbomer', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 15 },
    { name: '트리에탄올아민', inci: 'Triethanolamine', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제(카보머 중화)', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '토코페릴아세테이트', inci: 'Tocopheryl Acetate', phase: 'D', type: 'ANTIOXIDANT', fn: '항산화제', pct_int: 30 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 80 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 10 },
  ],
  '로션': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 400 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '세테아릴알코올', inci: 'Cetearyl Alcohol', phase: 'B', type: 'EMULSIFIER', fn: '유화안정제', pct_int: 200 },
    { name: '폴리소르베이트60', inci: 'Polysorbate 60', phase: 'B', type: 'EMULSIFIER', fn: 'O/W 유화제', pct_int: 150 },
    { name: '스쿠알란', inci: 'Squalane', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 400 },
    { name: '카프릴릭/카프릭트리글리세라이드', inci: 'Caprylic/Capric Triglyceride', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 300 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 200 },
    { name: '히알루론산', inci: 'Sodium Hyaluronate', phase: 'C', type: 'HUMECTANT', fn: '보습제', pct_int: 1 },
    { name: '알란토인', inci: 'Allantoin', phase: 'C', type: 'ACTIVE', fn: '진정/보습', pct_int: 10 },
    { name: '잔탄검', inci: 'Xanthan Gum', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 15 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 10 },
  ],
  '토너': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 500 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 500 },
    { name: '디프로필렌글라이콜', inci: 'Dipropylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 200 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 200 },
    { name: '히알루론산', inci: 'Sodium Hyaluronate', phase: 'C', type: 'HUMECTANT', fn: '보습제', pct_int: 1 },
    { name: '병풀추출물', inci: 'Centella Asiatica Extract', phase: 'C', type: 'ACTIVE', fn: '진정/피부보호', pct_int: 10 },
    { name: '알란토인', inci: 'Allantoin', phase: 'C', type: 'ACTIVE', fn: '진정', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '시트릭애씨드', inci: 'Citric Acid', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '1,2-헥산다이올', inci: '1,2-Hexanediol', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제/보습', pct_int: 100 },
  ],
  '세럼': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 500 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 400 },
    { name: '프로판다이올', inci: 'Propanediol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '나이아신아마이드', inci: 'Niacinamide', phase: 'C', type: 'ACTIVE', fn: '미백/장벽강화', pct_int: 500 },
    { name: '아데노신', inci: 'Adenosine', phase: 'C', type: 'ACTIVE', fn: '주름개선', pct_int: 4 },
    { name: '히알루론산', inci: 'Sodium Hyaluronate', phase: 'C', type: 'HUMECTANT', fn: '보습제', pct_int: 1 },
    { name: '카보머', inci: 'Carbomer', phase: 'C', type: 'THICKENER', fn: '증점제', pct_int: 20 },
    { name: '트리에탄올아민', inci: 'Triethanolamine', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
  ],
  '선크림': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '부틸렌글라이콜', inci: 'Butylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제/용매', pct_int: 300 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 300 },
    { name: '디프로필렌글라이콜', inci: 'Dipropylene Glycol', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 200 },
    { name: '잔탄검', inci: 'Xanthan Gum', phase: 'A', type: 'THICKENER', fn: '수상 점증제', pct_int: 20 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'A', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '사이클로펜타실록세인', inci: 'Cyclopentasiloxane', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트/발림성', pct_int: 1200 },
    { name: '디메치콘', inci: 'Dimethicone', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트/피막형성', pct_int: 300 },
    { name: '세틸PEG/PPG-10/1디메치콘', inci: 'Cetyl PEG/PPG-10/1 Dimethicone', phase: 'B', type: 'EMULSIFIER', fn: 'W/S 유화제', pct_int: 300 },
    { name: '아이소노닐아이소노나노에이트', inci: 'Isononyl Isononanoate', phase: 'B', type: 'EMOLLIENT', fn: '에몰리언트', pct_int: 400 },
    { name: '폴리하이드록시스테아릭애씨드', inci: 'Polyhydroxystearic Acid', phase: 'B', type: 'EMULSIFIER', fn: '분산제(무기자차)', pct_int: 150 },
    { name: '소르비탄아이소스테아레이트', inci: 'Sorbitan Isostearate', phase: 'B', type: 'EMULSIFIER', fn: '보조 유화제', pct_int: 100 },
    { name: '징크옥사이드', inci: 'Zinc Oxide', phase: 'C', type: 'UV_FILTER', fn: 'UVA+UVB 차단', pct_int: 1500 },
    { name: '티타늄디옥사이드', inci: 'Titanium Dioxide', phase: 'C', type: 'UV_FILTER', fn: 'UVB+UVA2 차단', pct_int: 700 },
    { name: '병풀추출물', inci: 'Centella Asiatica Extract', phase: 'D', type: 'ACTIVE', fn: '진정/피부보호', pct_int: 100 },
    { name: '1,2-헥산다이올', inci: '1,2-Hexanediol', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제/보습', pct_int: 100 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '염화나트륨', inci: 'Sodium Chloride', phase: 'D', type: 'OTHER', fn: '유화안정/점증', pct_int: 80 },
    { name: '하이드로젠디메치콘', inci: 'Hydrogen Dimethicone', phase: 'D', type: 'EMOLLIENT', fn: '발수성 부여', pct_int: 150 },
    { name: '알루미늄하이드록사이드', inci: 'Aluminum Hydroxide', phase: 'D', type: 'OTHER', fn: '자차 코팅/안정화', pct_int: 50 },
    { name: '스테아릭애씨드', inci: 'Stearic Acid', phase: 'D', type: 'EMULSIFIER', fn: '안정화/점도조절', pct_int: 50 },
    { name: '토코페릴아세테이트', inci: 'Tocopheryl Acetate', phase: 'D', type: 'ANTIOXIDANT', fn: '항산화제', pct_int: 30 },
    { name: '카프릴릴글라이콜', inci: 'Caprylyl Glycol', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제/보습', pct_int: 30 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '알란토인', inci: 'Allantoin', phase: 'D', type: 'ACTIVE', fn: '진정/피부보호', pct_int: 10 },
    { name: '비사볼올', inci: 'Bisabolol', phase: 'D', type: 'ACTIVE', fn: '진정/항자극', pct_int: 10 },
  ],
  '클렌징': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 300 },
    { name: '코카미도프로필베타인', inci: 'Cocamidopropyl Betaine', phase: 'A', type: 'SURFACTANT', fn: '양쪽성 계면활성제', pct_int: 800 },
    { name: '소듐라우레스설페이트', inci: 'Sodium Laureth Sulfate', phase: 'A', type: 'SURFACTANT', fn: '음이온 계면활성제', pct_int: 600 },
    { name: '소듐코코일이세치오네이트', inci: 'Sodium Cocoyl Isethionate', phase: 'A', type: 'SURFACTANT', fn: '마일드 계면활성제', pct_int: 300 },
    { name: '라우릭애씨드', inci: 'Lauric Acid', phase: 'B', type: 'SURFACTANT', fn: '지방산', pct_int: 200 },
    { name: '미리스틱애씨드', inci: 'Myristic Acid', phase: 'B', type: 'SURFACTANT', fn: '지방산', pct_int: 200 },
    { name: '수산화칼륨', inci: 'Potassium Hydroxide', phase: 'C', type: 'PH_ADJUSTER', fn: '비누화/pH조절', pct_int: 100 },
    { name: '병풀추출물', inci: 'Centella Asiatica Extract', phase: 'C', type: 'ACTIVE', fn: '진정', pct_int: 10 },
    { name: '디소듐이디티에이', inci: 'Disodium EDTA', phase: 'C', type: 'CHELATING', fn: '킬레이트제', pct_int: 5 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 80 },
    { name: '에틸헥실글리세린', inci: 'Ethylhexylglycerin', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 10 },
  ],
  '샴푸': [
    { name: '정제수', inci: 'Water (Aqua)', phase: 'A', type: 'SOLVENT', fn: '용매 (밸런스)', pct_int: 0 },
    { name: '소듐라우레스설페이트', inci: 'Sodium Laureth Sulfate', phase: 'A', type: 'SURFACTANT', fn: '1차 계면활성제', pct_int: 1200 },
    { name: '코카미도프로필베타인', inci: 'Cocamidopropyl Betaine', phase: 'A', type: 'SURFACTANT', fn: '양쪽성 계면활성제', pct_int: 500 },
    { name: '글리세린', inci: 'Glycerin', phase: 'A', type: 'HUMECTANT', fn: '보습제', pct_int: 200 },
    { name: '소듐클로라이드', inci: 'Sodium Chloride', phase: 'C', type: 'THICKENER', fn: '점도조절', pct_int: 150 },
    { name: '판테놀', inci: 'Panthenol', phase: 'C', type: 'ACTIVE', fn: '컨디셔닝/보습', pct_int: 50 },
    { name: '시트릭애씨드', inci: 'Citric Acid', phase: 'C', type: 'PH_ADJUSTER', fn: 'pH조절제', pct_int: 10 },
    { name: '페녹시에탄올', inci: 'Phenoxyethanol', phase: 'D', type: 'PRESERVATIVE', fn: '방부제', pct_int: 85 },
    { name: '소듐벤조에이트', inci: 'Sodium Benzoate', phase: 'D', type: 'PRESERVATIVE', fn: '보존보조제', pct_int: 30 },
    { name: '향료', inci: 'Fragrance', phase: 'D', type: 'FRAGRANCE', fn: '향료', pct_int: 30 },
  ],
}

// ── matchTemplate (FORMULA_TEMPLATES 키 반환) ──
export function matchTemplate(productType) {
  const pt = (productType || '').toLowerCase()
  if (pt.includes('선크림') || pt.includes('썬크림') || pt.includes('자외선') || pt.includes('sun') || pt.includes('spf')) return { key: '선크림', tmpl: FORMULA_TEMPLATES['선크림'] }
  if (pt.includes('클렌') || pt.includes('폼') || pt.includes('워시')) return { key: '클렌징', tmpl: FORMULA_TEMPLATES['클렌징'] }
  if (pt.includes('샴푸') || pt.includes('shampoo')) return { key: '샴푸', tmpl: FORMULA_TEMPLATES['샴푸'] }
  if (pt.includes('세럼') || pt.includes('에센스') || pt.includes('앰플')) return { key: '세럼', tmpl: FORMULA_TEMPLATES['세럼'] }
  if (pt.includes('토너') || pt.includes('스킨') || pt.includes('미스트')) return { key: '토너', tmpl: FORMULA_TEMPLATES['토너'] }
  if (pt.includes('로션') || pt.includes('에멀') || pt.includes('바디')) return { key: '로션', tmpl: FORMULA_TEMPLATES['로션'] }
  if (pt.includes('크림') || pt.includes('cream')) return { key: '크림', tmpl: FORMULA_TEMPLATES['크림'] }
  return { key: '크림', tmpl: FORMULA_TEMPLATES['크림'] }
}

// ── PRODUCT_BASE (generate-idea 베이스 강제 적용용) ── 43제형 전체
export const PRODUCT_BASE = {
  '립스틱': {
    aqua_max: 5,
    balance_key: 'Ricinus Communis Seed Oil',
    base_ingredients: [
      { inci: 'Ricinus Communis Seed Oil', korean: '피마자오일',                    pct: 35.0, function: '베이스오일',    phase: 'A' },
      { inci: 'Carnauba Wax',              korean: '카르나우바왁스',                pct: 15.0, function: '경도조절',      phase: 'A' },
      { inci: 'Candelilla Wax',            korean: '칸델리라왁스',                  pct: 10.0, function: '경도조절',      phase: 'A' },
      { inci: 'Ozokerite',                 korean: '오조케라이트',                   pct:  8.0, function: '경도조절',      phase: 'A' },
      { inci: 'Caprylic/Capric Triglyceride', korean: '카프릴릭트리글리세라이드', pct: 10.0, function: '에몰리언트',     phase: 'A' },
      { inci: 'Isononyl Isononanoate',     korean: '이소노닐이소노나노에이트',     pct:  8.0, function: '에몰리언트',     phase: 'A' },
      { inci: 'Mica',                      korean: '마이카',                         pct:  5.0, function: '광택',          phase: 'B' },
      { inci: 'Tocopherol',               korean: '토코페롤',                       pct:  0.5, function: '산화방지',      phase: 'B' },
      { inci: 'Flavor',                    korean: '향료',                            pct:  0.5, function: '향',            phase: 'B' },
    ],
  },
  '립글로스': {
    aqua_max: 5,
    balance_key: 'Ricinus Communis Seed Oil',
    base_ingredients: [
      { inci: 'Ricinus Communis Seed Oil', korean: '피마자오일',                 pct: 50.0, function: '베이스오일',  phase: 'A' },
      { inci: 'Polybutene',               korean: '폴리부텐',                    pct: 20.0, function: '광택/점도',  phase: 'A' },
      { inci: 'Caprylic/Capric Triglyceride', korean: '카프릴릭트리글리세라이드', pct: 15.0, function: '에몰리언트', phase: 'A' },
      { inci: 'Candelilla Wax',           korean: '칸델리라왁스',                pct:  5.0, function: '경도조절',  phase: 'A' },
      { inci: 'Mica',                     korean: '마이카',                       pct:  5.0, function: '광택',      phase: 'B' },
      { inci: 'Tocopherol',              korean: '토코페롤',                    pct:  0.5, function: '산화방지',  phase: 'B' },
      { inci: 'Flavor',                   korean: '향료',                         pct:  0.5, function: '향',        phase: 'B' },
    ],
  },
  '립틴트': {
    aqua_max: 50,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',                pct: 45.0, function: '용매',    phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',              pct: 10.0, function: '보습제',  phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',       pct:  5.0, function: '보습제',  phase: 'A' },
      { inci: 'Hydroxyethylcellulose',  korean: '하이드록시에틸셀룰로오스', pct: 1.0, function: '점도조절', phase: 'A' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',          pct:  0.5, function: '방부제',  phase: 'D' },
    ],
  },
  '수분크림': {
    aqua_max: 80,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 72.0, function: '용매',    phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  5.0, function: '보습제',  phase: 'A' },
      { inci: 'Butylene Glycol',  korean: '부틸렌글라이콜',  pct:  3.0, function: '보습제',  phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  2.0, function: '유화안정제', phase: 'B' },
      { inci: 'Glyceryl Stearate', korean: '글리세릴스테아레이트', pct: 1.5, function: '유화제', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  1.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Carbomer',         korean: '카보머',           pct:  0.3, function: '점도조절', phase: 'A' },
      { inci: 'Triethanolamine',  korean: '트리에탄올아민',  pct:  0.2, function: 'pH조절',  phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.5, function: '방부제',  phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조', phase: 'D' },
    ],
  },
  '선크림': {
    aqua_max: 70,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',           pct: 55.0, function: '용매',      phase: 'A' },
      { inci: 'Zinc Oxide',       korean: '징크옥사이드',     pct: 10.0, function: 'UV차단',    phase: 'B' },
      { inci: 'Titanium Dioxide', korean: '티타늄디옥사이드', pct:  5.0, function: 'UV차단',    phase: 'B' },
      { inci: 'Glycerin',         korean: '글리세린',          pct:  5.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',   pct:  2.0, function: '유화안정제', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',          pct:  2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',     pct:  0.5, function: '방부제',    phase: 'D' },
    ],
  },
  '에센스': {
    aqua_max: 90,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',            pct: 82.0, function: '용매',    phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',           pct:  5.0, function: '보습제',  phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',    pct:  3.0, function: '보습제',  phase: 'A' },
      { inci: 'Sodium Hyaluronate',     korean: '히알루론산나트륨',  pct:  0.5, function: '보습제',  phase: 'C' },
      { inci: 'Hydroxyethylcellulose',  korean: '하이드록시에틸셀룰로오스', pct: 0.2, function: '점도조절', phase: 'A' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',      pct:  0.5, function: '방부제',  phase: 'D' },
    ],
  },
  '토너': {
    aqua_max: 95,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',             korean: '정제수',           pct: 88.0, function: '용매',   phase: 'A' },
      { inci: 'Glycerin',        korean: '글리세린',          pct:  5.0, function: '보습제', phase: 'A' },
      { inci: 'Butylene Glycol', korean: '부틸렌글라이콜',   pct:  3.0, function: '보습제', phase: 'A' },
      { inci: 'Niacinamide',     korean: '나이아신아마이드',  pct:  2.0, function: '기능성', phase: 'C' },
      { inci: 'Phenoxyethanol',  korean: '페녹시에탄올',     pct:  0.5, function: '방부제', phase: 'D' },
    ],
  },
  '샴푸': {
    aqua_max: 80,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                    korean: '정제수',              pct: 65.0, function: '용매',       phase: 'A' },
      { inci: 'Sodium Laureth Sulfate',  korean: '소듐라우레스설페이트', pct: 12.0, function: '계면활성제', phase: 'A' },
      { inci: 'Cocamidopropyl Betaine',  korean: '코카미도프로필베타인', pct:  5.0, function: '계면활성제', phase: 'A' },
      { inci: 'Glycerin',                korean: '글리세린',             pct:  2.0, function: '보습제',     phase: 'A' },
      { inci: 'Phenoxyethanol',          korean: '페녹시에탄올',         pct:  0.5, function: '방부제',     phase: 'D' },
    ],
  },
  // ── 신규 35개 제형 ──
  '로션': {
    aqua_max: 82,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 75.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  4.0, function: '보습제',    phase: 'A' },
      { inci: 'Butylene Glycol',  korean: '부틸렌글라이콜',  pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  1.5, function: '유화안정제', phase: 'B' },
      { inci: 'Polysorbate 60',   korean: '폴리소르베이트60', pct:  1.0, function: '유화제',    phase: 'B' },
      { inci: 'Squalane',         korean: '스쿠알란',         pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Caprylic/Capric Triglyceride', korean: '카프릴릭/카프릭트리글리세라이드', pct: 2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Niacinamide',      korean: '나이아신아마이드', pct:  2.0, function: '기능성',    phase: 'C' },
      { inci: 'Xanthan Gum',      korean: '잔탄검',           pct:  0.2, function: '점도조절',  phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '나이트크림': {
    aqua_max: 75,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',            pct: 62.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',           pct:  5.0, function: '보습제',    phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',    pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol',       korean: '세테아릴알코올',    pct:  2.5, function: '유화안정제', phase: 'B' },
      { inci: 'Glyceryl Stearate',      korean: '글리세릴스테아레이트', pct: 2.0, function: '유화제', phase: 'B' },
      { inci: 'Shea Butter',            korean: '시어버터',           pct:  5.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Squalane',               korean: '스쿠알란',           pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',            korean: '디메티콘',           pct:  2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Niacinamide',            korean: '나이아신아마이드',  pct:  3.0, function: '기능성',    phase: 'C' },
      { inci: 'Sodium Hyaluronate',     korean: '히알루론산나트륨',  pct:  0.5, function: '보습제',    phase: 'C' },
      { inci: 'Adenosine',              korean: '아데노신',           pct:  0.04, function: '주름개선', phase: 'C' },
      { inci: 'Carbomer',               korean: '카보머',             pct:  0.2, function: '점도조절',  phase: 'C' },
      { inci: 'Triethanolamine',        korean: '트리에탄올아민',    pct:  0.15, function: 'pH조절',   phase: 'C' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',      pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',         korean: '1,2-헥산다이올',    pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '아이크림': {
    aqua_max: 78,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',            pct: 68.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',           pct:  5.0, function: '보습제',    phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',    pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol',       korean: '세테아릴알코올',    pct:  2.0, function: '유화안정제', phase: 'B' },
      { inci: 'Glyceryl Stearate',      korean: '글리세릴스테아레이트', pct: 1.5, function: '유화제', phase: 'B' },
      { inci: 'Squalane',               korean: '스쿠알란',           pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',            korean: '디메티콘',           pct:  2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Caffeine',               korean: '카페인',             pct:  1.0, function: '눈가부기완화', phase: 'C' },
      { inci: 'Sodium Hyaluronate',     korean: '히알루론산나트륨',  pct:  0.5, function: '보습제',    phase: 'C' },
      { inci: 'Peptide Complex',        korean: '펩타이드복합체',    pct:  1.0, function: '탄력/주름', phase: 'C' },
      { inci: 'Carbomer',               korean: '카보머',             pct:  0.2, function: '점도조절',  phase: 'C' },
      { inci: 'Triethanolamine',        korean: '트리에탄올아민',    pct:  0.15, function: 'pH조절',   phase: 'C' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',      pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',         korean: '1,2-헥산다이올',    pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  'BB크림': {
    aqua_max: 65,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 55.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  4.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  2.0, function: '유화안정제', phase: 'B' },
      { inci: 'Glyceryl Stearate', korean: '글리세릴스테아레이트', pct: 1.5, function: '유화제', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Titanium Dioxide', korean: '티타늄디옥사이드', pct: 8.0, function: '커버력/UV차단', phase: 'B' },
      { inci: 'Iron Oxides',      korean: '철산화물',         pct:  2.0, function: '색소',      phase: 'B' },
      { inci: 'Niacinamide',      korean: '나이아신아마이드', pct:  2.0, function: '기능성',    phase: 'C' },
      { inci: 'Carbomer',         korean: '카보머',           pct:  0.2, function: '점도조절',  phase: 'C' },
      { inci: 'Triethanolamine',  korean: '트리에탄올아민',  pct:  0.15, function: 'pH조절',   phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  'CC크림': {
    aqua_max: 65,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 55.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  4.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  2.0, function: '유화안정제', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Zinc Oxide',       korean: '징크옥사이드',     pct:  5.0, function: 'UV차단',    phase: 'B' },
      { inci: 'Titanium Dioxide', korean: '티타늄디옥사이드', pct: 4.0, function: 'UV차단/커버력', phase: 'B' },
      { inci: 'Iron Oxides',      korean: '철산화물',         pct:  1.5, function: '색보정',    phase: 'B' },
      { inci: 'Niacinamide',      korean: '나이아신아마이드', pct:  3.0, function: '기능성',    phase: 'C' },
      { inci: 'Sodium Hyaluronate', korean: '히알루론산나트륨', pct: 0.3, function: '보습제',  phase: 'C' },
      { inci: 'Carbomer',         korean: '카보머',           pct:  0.2, function: '점도조절',  phase: 'C' },
      { inci: 'Triethanolamine',  korean: '트리에탄올아민',  pct:  0.15, function: 'pH조절',   phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '파운데이션': {
    aqua_max: 60,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 45.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cyclopentasiloxane', korean: '사이클로펜타실록세인', pct: 8.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Cetyl PEG/PPG-10/1 Dimethicone', korean: '세틸PEG/PPG-10/1디메치콘', pct: 2.0, function: 'W/S 유화제', phase: 'B' },
      { inci: 'Titanium Dioxide', korean: '티타늄디옥사이드', pct: 10.0, function: '커버력/UV차단', phase: 'B' },
      { inci: 'Iron Oxides',      korean: '철산화물',         pct:  3.0, function: '색소',      phase: 'B' },
      { inci: 'Niacinamide',      korean: '나이아신아마이드', pct:  2.0, function: '기능성',    phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '쿠션': {
    aqua_max: 65,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 50.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cyclopentasiloxane', korean: '사이클로펜타실록세인', pct: 5.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Titanium Dioxide', korean: '티타늄디옥사이드', pct: 8.0, function: 'UV차단/커버력', phase: 'B' },
      { inci: 'Zinc Oxide',       korean: '징크옥사이드',     pct:  3.0, function: 'UV차단',    phase: 'B' },
      { inci: 'Iron Oxides',      korean: '철산화물',         pct:  2.0, function: '색소',      phase: 'B' },
      { inci: 'Niacinamide',      korean: '나이아신아마이드', pct:  2.0, function: '기능성',    phase: 'C' },
      { inci: 'Sodium Hyaluronate', korean: '히알루론산나트륨', pct: 0.3, function: '보습제',  phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '프라이머': {
    aqua_max: 70,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 58.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cyclopentasiloxane', korean: '사이클로펜타실록세인', pct: 8.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  5.0, function: '피막형성',  phase: 'B' },
      { inci: 'Dimethicone Crosspolymer', korean: '디메티콘크로스폴리머', pct: 3.0, function: '피부결채움', phase: 'B' },
      { inci: 'Silica',           korean: '실리카',           pct:  3.0, function: '피지흡수',  phase: 'B' },
      { inci: 'Niacinamide',      korean: '나이아신아마이드', pct:  2.0, function: '기능성',    phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '컨실러': {
    aqua_max: 50,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 35.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cyclopentasiloxane', korean: '사이클로펜타실록세인', pct: 5.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  2.0, function: '유화안정제', phase: 'B' },
      { inci: 'Titanium Dioxide', korean: '티타늄디옥사이드', pct: 15.0, function: '커버력',   phase: 'B' },
      { inci: 'Iron Oxides',      korean: '철산화물',         pct:  5.0, function: '색소',      phase: 'B' },
      { inci: 'Kaolin',           korean: '카올린',           pct:  5.0, function: '커버력/피지흡수', phase: 'B' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '클렌징폼': {
    aqua_max: 70,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                    korean: '정제수',              pct: 55.0, function: '용매',       phase: 'A' },
      { inci: 'Glycerin',                korean: '글리세린',             pct:  5.0, function: '보습제',     phase: 'A' },
      { inci: 'Cocamidopropyl Betaine',  korean: '코카미도프로필베타인', pct:  8.0, function: '양쪽성계면활성제', phase: 'A' },
      { inci: 'Sodium Cocoyl Isethionate', korean: '소듐코코일이세치오네이트', pct: 6.0, function: '마일드계면활성제', phase: 'A' },
      { inci: 'Lauric Acid',             korean: '라우릭애씨드',         pct:  5.0, function: '지방산',     phase: 'B' },
      { inci: 'Myristic Acid',           korean: '미리스틱애씨드',       pct:  3.0, function: '지방산',     phase: 'B' },
      { inci: 'Potassium Hydroxide',     korean: '수산화칼륨',           pct:  1.5, function: 'pH조절/비누화', phase: 'C' },
      { inci: 'Allantoin',               korean: '알란토인',             pct:  0.2, function: '진정',       phase: 'C' },
      { inci: 'Phenoxyethanol',          korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
      { inci: '1,2-Hexanediol',          korean: '1,2-헥산다이올',       pct:  1.0, function: '방부보조',   phase: 'D' },
    ],
  },
  '클렌징오일': {
    aqua_max: 2,
    balance_key: 'Caprylic/Capric Triglyceride',
    base_ingredients: [
      { inci: 'Caprylic/Capric Triglyceride', korean: '카프릴릭/카프릭트리글리세라이드', pct: 50.0, function: '베이스오일', phase: 'A' },
      { inci: 'Simmondsia Chinensis (Jojoba) Seed Oil', korean: '호호바오일', pct: 15.0, function: '에몰리언트', phase: 'A' },
      { inci: 'Helianthus Annuus (Sunflower) Seed Oil', korean: '해바라기씨오일', pct: 10.0, function: '에몰리언트', phase: 'A' },
      { inci: 'PEG-20 Glyceryl Triisostearate', korean: 'PEG-20글리세릴트리이소스테아레이트', pct: 8.0, function: '계면활성제/유화제', phase: 'A' },
      { inci: 'Polysorbate 80',          korean: '폴리소르베이트80',      pct:  5.0, function: '유화제',     phase: 'A' },
      { inci: 'Tocopherol',              korean: '토코페롤',              pct:  0.5, function: '항산화제',   phase: 'B' },
      { inci: 'Fragrance',               korean: '향료',                   pct:  0.5, function: '향',         phase: 'B' },
    ],
  },
  '클렌징워터': {
    aqua_max: 95,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 88.0, function: '용매',       phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',              pct:  3.0, function: '보습제',     phase: 'A' },
      { inci: 'Propanediol',            korean: '프로판다이올',          pct:  3.0, function: '보습제/용매', phase: 'A' },
      { inci: 'Polysorbate 20',         korean: '폴리소르베이트20',      pct:  1.5, function: '계면활성제',  phase: 'A' },
      { inci: 'Cucumis Sativus (Cucumber) Fruit Extract', korean: '오이추출물', pct: 0.5, function: '진정', phase: 'C' },
      { inci: 'Allantoin',              korean: '알란토인',              pct:  0.1, function: '진정',       phase: 'C' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',         pct:  0.5, function: '방부제',     phase: 'D' },
    ],
  },
  '마스크팩': {
    aqua_max: 88,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 80.0, function: '용매',       phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',              pct:  5.0, function: '보습제',     phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',       pct:  3.0, function: '보습제',     phase: 'A' },
      { inci: 'Niacinamide',            korean: '나이아신아마이드',     pct:  2.0, function: '기능성',     phase: 'C' },
      { inci: 'Sodium Hyaluronate',     korean: '히알루론산나트륨',     pct:  0.5, function: '보습제',     phase: 'C' },
      { inci: 'Centella Asiatica Extract', korean: '병풀추출물',        pct:  0.5, function: '진정',       phase: 'C' },
      { inci: 'Allantoin',              korean: '알란토인',              pct:  0.2, function: '진정',       phase: 'C' },
      { inci: 'Hydroxyethylcellulose',  korean: '하이드록시에틸셀룰로오스', pct: 0.3, function: '점도조절', phase: 'A' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
      { inci: '1,2-Hexanediol',         korean: '1,2-헥산다이올',       pct:  1.0, function: '방부보조',   phase: 'D' },
    ],
  },
  '필링젤': {
    aqua_max: 85,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 75.0, function: '용매',       phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',              pct:  5.0, function: '보습제',     phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',       pct:  3.0, function: '보습제',     phase: 'A' },
      { inci: 'Polyquaternium-10',      korean: '폴리쿼터늄-10',        pct:  1.0, function: '피막형성/각질뭉침', phase: 'A' },
      { inci: 'Carbomer',               korean: '카보머',                pct:  0.5, function: '점도조절',   phase: 'A' },
      { inci: 'Cellulose',              korean: '셀룰로오스',            pct:  2.0, function: '물리적각질제거', phase: 'B' },
      { inci: 'Lactic Acid',            korean: '락틱애씨드',            pct:  3.0, function: 'AHA 각질제거', phase: 'C' },
      { inci: 'Sodium Hydroxide',       korean: '수산화나트륨',          pct:  0.5, function: 'pH조절',     phase: 'C' },
      { inci: 'Allantoin',              korean: '알란토인',              pct:  0.2, function: '진정',       phase: 'C' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
    ],
  },
  '앰플': {
    aqua_max: 90,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 80.0, function: '용매',       phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',              pct:  5.0, function: '보습제',     phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',       pct:  3.0, function: '보습제',     phase: 'A' },
      { inci: 'Propanediol',            korean: '프로판다이올',          pct:  2.0, function: '보습제/용매', phase: 'A' },
      { inci: 'Niacinamide',            korean: '나이아신아마이드',     pct:  5.0, function: '기능성',     phase: 'C' },
      { inci: 'Sodium Hyaluronate',     korean: '히알루론산나트륨',     pct:  0.5, function: '보습제',     phase: 'C' },
      { inci: 'Adenosine',              korean: '아데노신',              pct:  0.04, function: '주름개선',  phase: 'C' },
      { inci: 'Carbomer',               korean: '카보머',                pct:  0.2, function: '점도조절',   phase: 'C' },
      { inci: 'Triethanolamine',        korean: '트리에탄올아민',       pct:  0.15, function: 'pH조절',    phase: 'C' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
      { inci: '1,2-Hexanediol',         korean: '1,2-헥산다이올',       pct:  1.0, function: '방부보조',   phase: 'D' },
    ],
  },
  '미스트': {
    aqua_max: 95,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 90.0, function: '용매',       phase: 'A' },
      { inci: 'Glycerin',               korean: '글리세린',              pct:  3.0, function: '보습제',     phase: 'A' },
      { inci: 'Butylene Glycol',        korean: '부틸렌글라이콜',       pct:  2.0, function: '보습제',     phase: 'A' },
      { inci: 'Sodium Hyaluronate',     korean: '히알루론산나트륨',     pct:  0.3, function: '보습제',     phase: 'C' },
      { inci: 'Allantoin',              korean: '알란토인',              pct:  0.1, function: '진정',       phase: 'C' },
      { inci: 'Disodium EDTA',          korean: '디소듐이디티에이',     pct:  0.05, function: '킬레이트제', phase: 'C' },
      { inci: 'Phenoxyethanol',         korean: '페녹시에탄올',         pct:  0.5, function: '방부제',     phase: 'D' },
    ],
  },
  '페이스오일': {
    aqua_max: 3,
    balance_key: 'Jojoba Oil',
    base_ingredients: [
      { inci: 'Simmondsia Chinensis (Jojoba) Seed Oil', korean: '호호바오일', pct: 40.0, function: '베이스오일', phase: 'A' },
      { inci: 'Rosa Canina (Rosehip) Fruit Oil',        korean: '로즈힙오일',  pct: 20.0, function: '피부재생',  phase: 'A' },
      { inci: 'Squalane',              korean: '스쿠알란',              pct: 15.0, function: '에몰리언트',  phase: 'A' },
      { inci: 'Caprylic/Capric Triglyceride', korean: '카프릴릭/카프릭트리글리세라이드', pct: 10.0, function: '에몰리언트', phase: 'A' },
      { inci: 'Marula Oil',            korean: '마루라오일',            pct:  5.0, function: '에몰리언트',  phase: 'A' },
      { inci: 'Tocopherol',            korean: '토코페롤',              pct:  1.0, function: '항산화제',    phase: 'B' },
      { inci: 'Retinol',               korean: '레티놀',                pct:  0.05, function: '안티에이징', phase: 'B' },
      { inci: 'Fragrance',             korean: '향료',                   pct:  0.3, function: '향',          phase: 'B' },
    ],
  },
  '립밤': {
    aqua_max: 2,
    balance_key: 'Beeswax',
    base_ingredients: [
      { inci: 'Beeswax',               korean: '비즈왁스',              pct: 25.0, function: '경도조절',   phase: 'A' },
      { inci: 'Carnauba Wax',          korean: '카르나우바왁스',        pct: 10.0, function: '경도조절',   phase: 'A' },
      { inci: 'Ricinus Communis Seed Oil', korean: '피마자오일',        pct: 30.0, function: '베이스오일', phase: 'A' },
      { inci: 'Cocoa Butter',          korean: '코코아버터',            pct: 10.0, function: '에몰리언트', phase: 'A' },
      { inci: 'Caprylic/Capric Triglyceride', korean: '카프릴릭/카프릭트리글리세라이드', pct: 10.0, function: '에몰리언트', phase: 'A' },
      { inci: 'Shea Butter',           korean: '시어버터',              pct:  5.0, function: '에몰리언트', phase: 'A' },
      { inci: 'Tocopherol',            korean: '토코페롤',              pct:  0.5, function: '항산화제',   phase: 'B' },
      { inci: 'Flavor',                korean: '향료',                   pct:  0.5, function: '향',          phase: 'B' },
    ],
  },
  '아이섀도우': {
    aqua_max: 5,
    balance_key: 'Mica',
    base_ingredients: [
      { inci: 'Mica',                   korean: '마이카',                pct: 50.0, function: '광택/체질안료', phase: 'A' },
      { inci: 'Talc',                   korean: '탈크',                   pct: 15.0, function: '체질안료',   phase: 'A' },
      { inci: 'Iron Oxides (CI 77491)', korean: '철산화물(CI77491)',     pct:  5.0, function: '색소',        phase: 'A' },
      { inci: 'Iron Oxides (CI 77492)', korean: '철산화물(CI77492)',     pct:  3.0, function: '색소',        phase: 'A' },
      { inci: 'Iron Oxides (CI 77499)', korean: '철산화물(CI77499)',     pct:  2.0, function: '색소',        phase: 'A' },
      { inci: 'Stearic Acid',           korean: '스테아릭애씨드',        pct:  3.0, function: '결합제',      phase: 'B' },
      { inci: 'Magnesium Stearate',     korean: '마그네슘스테아레이트',  pct:  2.0, function: '성형보조',    phase: 'B' },
      { inci: 'Dimethicone',            korean: '디메티콘',              pct:  1.0, function: '발림성',      phase: 'B' },
    ],
  },
  '마스카라': {
    aqua_max: 30,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 25.0, function: '용매',        phase: 'A' },
      { inci: 'Beeswax',               korean: '비즈왁스',              pct: 12.0, function: '경도/필름형성', phase: 'B' },
      { inci: 'Carnauba Wax',          korean: '카르나우바왁스',        pct:  8.0, function: '경도조절',    phase: 'B' },
      { inci: 'Ozokerite',             korean: '오조케라이트',          pct:  5.0, function: '경도조절',    phase: 'B' },
      { inci: 'Triethanolamine',       korean: '트리에탄올아민',       pct:  2.0, function: '유화/pH조절', phase: 'B' },
      { inci: 'Stearic Acid',          korean: '스테아릭애씨드',       pct:  3.0, function: '유화보조',    phase: 'B' },
      { inci: 'Black Iron Oxide (CI 77266)', korean: '카본블랙(CI77266)', pct: 10.0, function: '색소',      phase: 'B' },
      { inci: 'Nylon-6',               korean: '나이론-6',              pct:  5.0, function: '볼륨/길이연장', phase: 'C' },
      { inci: 'Phenoxyethanol',        korean: '페녹시에탄올',         pct:  0.8, function: '방부제',      phase: 'D' },
    ],
  },
  '아이라이너': {
    aqua_max: 60,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 50.0, function: '용매',        phase: 'A' },
      { inci: 'Acrylates Copolymer',   korean: '아크릴레이트코폴리머', pct: 15.0, function: '피막형성제', phase: 'A' },
      { inci: 'Glycerin',              korean: '글리세린',             pct:  3.0, function: '보습제',      phase: 'A' },
      { inci: 'Black Iron Oxide (CI 77266)', korean: '카본블랙(CI77266)', pct: 12.0, function: '색소',      phase: 'B' },
      { inci: 'Propylene Glycol',      korean: '프로필렌글라이콜',     pct:  3.0, function: '용매/보습',   phase: 'A' },
      { inci: 'Triethanolamine',       korean: '트리에탄올아민',       pct:  1.0, function: 'pH조절',      phase: 'C' },
      { inci: 'Phenoxyethanol',        korean: '페녹시에탄올',         pct:  0.8, function: '방부제',      phase: 'D' },
      { inci: '1,2-Hexanediol',        korean: '1,2-헥산다이올',       pct:  1.0, function: '방부보조',    phase: 'D' },
    ],
  },
  '아이브로우': {
    aqua_max: 40,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                   korean: '정제수',               pct: 30.0, function: '용매',        phase: 'A' },
      { inci: 'Acrylates Copolymer',   korean: '아크릴레이트코폴리머', pct: 10.0, function: '피막형성제', phase: 'A' },
      { inci: 'Iron Oxides (CI 77491)', korean: '철산화물(CI77491)',    pct: 10.0, function: '색소(갈색)',  phase: 'B' },
      { inci: 'Iron Oxides (CI 77499)', korean: '철산화물(CI77499)',    pct:  5.0, function: '색소(흑색)',  phase: 'B' },
      { inci: 'Glycerin',              korean: '글리세린',             pct:  3.0, function: '보습제',      phase: 'A' },
      { inci: 'Beeswax',              korean: '비즈왁스',              pct:  5.0, function: '경도조절',    phase: 'B' },
      { inci: 'Phenoxyethanol',        korean: '페녹시에탄올',         pct:  0.8, function: '방부제',      phase: 'D' },
    ],
  },
  '블러셔': {
    aqua_max: 5,
    balance_key: 'Mica',
    base_ingredients: [
      { inci: 'Mica',                   korean: '마이카',                pct: 55.0, function: '광택/체질안료', phase: 'A' },
      { inci: 'Talc',                   korean: '탈크',                   pct: 20.0, function: '체질안료',   phase: 'A' },
      { inci: 'Iron Oxides (CI 77491)', korean: '철산화물(CI77491)',     pct:  8.0, function: '색소(적색)', phase: 'A' },
      { inci: 'Iron Oxides (CI 77492)', korean: '철산화물(CI77492)',     pct:  2.0, function: '색소(황색)', phase: 'A' },
      { inci: 'Magnesium Stearate',     korean: '마그네슘스테아레이트',  pct:  2.0, function: '성형보조',   phase: 'B' },
      { inci: 'Dimethicone',            korean: '디메티콘',              pct:  1.0, function: '발림성',     phase: 'B' },
    ],
  },
  '하이라이터': {
    aqua_max: 5,
    balance_key: 'Mica',
    base_ingredients: [
      { inci: 'Mica',                   korean: '마이카',                pct: 65.0, function: '광택/반짝임', phase: 'A' },
      { inci: 'Talc',                   korean: '탈크',                   pct: 15.0, function: '체질안료',   phase: 'A' },
      { inci: 'Titanium Dioxide',       korean: '티타늄디옥사이드',      pct:  5.0, function: '화이트광택', phase: 'A' },
      { inci: 'Magnesium Stearate',     korean: '마그네슘스테아레이트',  pct:  2.0, function: '성형보조',   phase: 'B' },
      { inci: 'Dimethicone',            korean: '디메티콘',              pct:  1.0, function: '발림성',     phase: 'B' },
    ],
  },
  '파우더': {
    aqua_max: 2,
    balance_key: 'Talc',
    base_ingredients: [
      { inci: 'Talc',                   korean: '탈크',                   pct: 55.0, function: '체질안료',   phase: 'A' },
      { inci: 'Mica',                   korean: '마이카',                 pct: 20.0, function: '광택',       phase: 'A' },
      { inci: 'Nylon-12',              korean: '나이론-12',              pct:  8.0, function: '피부밀착/발림성', phase: 'A' },
      { inci: 'Magnesium Stearate',     korean: '마그네슘스테아레이트',  pct:  3.0, function: '성형보조',   phase: 'B' },
      { inci: 'Silica',                korean: '실리카',                 pct:  3.0, function: '피지흡수',   phase: 'B' },
      { inci: 'Dimethicone',           korean: '디메티콘',              pct:  1.0, function: '발림성',     phase: 'B' },
    ],
  },
  '바디로션': {
    aqua_max: 85,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 78.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  4.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  2.0, function: '유화안정제', phase: 'B' },
      { inci: 'Polysorbate 60',   korean: '폴리소르베이트60', pct:  1.5, function: '유화제',    phase: 'B' },
      { inci: 'Glyceryl Stearate', korean: '글리세릴스테아레이트', pct: 1.5, function: '유화제', phase: 'B' },
      { inci: 'Squalane',         korean: '스쿠알란',         pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  1.5, function: '에몰리언트', phase: 'B' },
      { inci: 'Allantoin',        korean: '알란토인',         pct:  0.2, function: '진정',      phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
      { inci: 'Fragrance',        korean: '향료',              pct:  0.3, function: '향',        phase: 'D' },
    ],
  },
  '바디크림': {
    aqua_max: 75,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 65.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  4.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  3.0, function: '유화안정제', phase: 'B' },
      { inci: 'Glyceryl Stearate', korean: '글리세릴스테아레이트', pct: 2.0, function: '유화제', phase: 'B' },
      { inci: 'Shea Butter',      korean: '시어버터',         pct:  5.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Squalane',         korean: '스쿠알란',         pct:  4.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Dimethicone',      korean: '디메티콘',         pct:  2.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Niacinamide',      korean: '나이아신아마이드', pct:  1.0, function: '기능성',    phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
      { inci: 'Fragrance',        korean: '향료',              pct:  0.3, function: '향',        phase: 'D' },
    ],
  },
  '바디워시': {
    aqua_max: 80,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                    korean: '정제수',              pct: 65.0, function: '용매',       phase: 'A' },
      { inci: 'Sodium Laureth Sulfate',  korean: '소듐라우레스설페이트', pct: 10.0, function: '계면활성제', phase: 'A' },
      { inci: 'Cocamidopropyl Betaine',  korean: '코카미도프로필베타인', pct:  5.0, function: '양쪽성계면활성제', phase: 'A' },
      { inci: 'Glycerin',                korean: '글리세린',             pct:  3.0, function: '보습제',     phase: 'A' },
      { inci: 'Sodium Chloride',         korean: '소듐클로라이드',       pct:  1.5, function: '점도조절',   phase: 'C' },
      { inci: 'Citric Acid',             korean: '시트릭애씨드',         pct:  0.1, function: 'pH조절',     phase: 'C' },
      { inci: 'Phenoxyethanol',          korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
      { inci: 'Fragrance',               korean: '향료',                  pct:  0.5, function: '향',         phase: 'D' },
    ],
  },
  '핸드크림': {
    aqua_max: 70,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 60.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  5.0, function: '보습제',    phase: 'A' },
      { inci: 'Butylene Glycol',  korean: '부틸렌글라이콜',  pct:  3.0, function: '보습제',    phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  2.5, function: '유화안정제', phase: 'B' },
      { inci: 'Glyceryl Stearate', korean: '글리세릴스테아레이트', pct: 2.0, function: '유화제', phase: 'B' },
      { inci: 'Shea Butter',      korean: '시어버터',         pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Squalane',         korean: '스쿠알란',         pct:  3.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Allantoin',        korean: '알란토인',         pct:  0.5, function: '진정',      phase: 'C' },
      { inci: 'Panthenol',        korean: '판테놀',           pct:  0.5, function: '보습',      phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '풋크림': {
    aqua_max: 65,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',              korean: '정제수',          pct: 55.0, function: '용매',      phase: 'A' },
      { inci: 'Glycerin',         korean: '글리세린',         pct:  5.0, function: '보습제',    phase: 'A' },
      { inci: 'Urea',             korean: '우레아',           pct:  5.0, function: '각질연화/보습', phase: 'A' },
      { inci: 'Cetearyl Alcohol', korean: '세테아릴알코올',  pct:  2.5, function: '유화안정제', phase: 'B' },
      { inci: 'Glyceryl Stearate', korean: '글리세릴스테아레이트', pct: 2.0, function: '유화제', phase: 'B' },
      { inci: 'Shea Butter',      korean: '시어버터',         pct:  5.0, function: '에몰리언트', phase: 'B' },
      { inci: 'Peppermint Oil',   korean: '페퍼민트오일',     pct:  0.5, function: '청량감',    phase: 'D' },
      { inci: 'Allantoin',        korean: '알란토인',         pct:  0.5, function: '진정',      phase: 'C' },
      { inci: 'Phenoxyethanol',   korean: '페녹시에탄올',    pct:  0.8, function: '방부제',    phase: 'D' },
      { inci: '1,2-Hexanediol',   korean: '1,2-헥산다이올',  pct:  1.0, function: '방부보조',  phase: 'D' },
    ],
  },
  '린스': {
    aqua_max: 88,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                        korean: '정제수',              pct: 80.0, function: '용매',       phase: 'A' },
      { inci: 'Cetrimonium Chloride',        korean: '세트리모늄클로라이드', pct:  3.0, function: '컨디셔닝',   phase: 'B' },
      { inci: 'Cetearyl Alcohol',            korean: '세테아릴알코올',      pct:  3.0, function: '유화안정제', phase: 'B' },
      { inci: 'Dimethicone',                 korean: '디메티콘',             pct:  2.0, function: '모발컨디셔닝', phase: 'B' },
      { inci: 'Glycerin',                    korean: '글리세린',             pct:  2.0, function: '보습제',     phase: 'A' },
      { inci: 'Panthenol',                   korean: '판테놀',               pct:  0.5, function: '모발보습',   phase: 'C' },
      { inci: 'Citric Acid',                 korean: '시트릭애씨드',         pct:  0.1, function: 'pH조절',     phase: 'C' },
      { inci: 'Phenoxyethanol',              korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
      { inci: 'Fragrance',                   korean: '향료',                  pct:  0.3, function: '향',         phase: 'D' },
    ],
  },
  '트리트먼트': {
    aqua_max: 80,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                        korean: '정제수',              pct: 70.0, function: '용매',       phase: 'A' },
      { inci: 'Cetrimonium Chloride',        korean: '세트리모늄클로라이드', pct:  3.0, function: '컨디셔닝',   phase: 'B' },
      { inci: 'Cetearyl Alcohol',            korean: '세테아릴알코올',      pct:  3.0, function: '유화안정제', phase: 'B' },
      { inci: 'Behentrimonium Chloride',     korean: '베헨트리모늄클로라이드', pct: 2.0, function: '양이온컨디셔닝', phase: 'B' },
      { inci: 'Dimethicone',                 korean: '디메티콘',             pct:  3.0, function: '모발코팅',   phase: 'B' },
      { inci: 'Glycerin',                    korean: '글리세린',             pct:  2.0, function: '보습제',     phase: 'A' },
      { inci: 'Hydrolyzed Keratin',          korean: '가수분해케라틴',       pct:  1.0, function: '모발강화',   phase: 'C' },
      { inci: 'Panthenol',                   korean: '판테놀',               pct:  0.5, function: '보습/컨디셔닝', phase: 'C' },
      { inci: 'Citric Acid',                 korean: '시트릭애씨드',         pct:  0.1, function: 'pH조절',     phase: 'C' },
      { inci: 'Phenoxyethanol',              korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
      { inci: 'Fragrance',                   korean: '향료',                  pct:  0.3, function: '향',         phase: 'D' },
    ],
  },
  '헤어팩': {
    aqua_max: 75,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                        korean: '정제수',              pct: 65.0, function: '용매',       phase: 'A' },
      { inci: 'Cetrimonium Chloride',        korean: '세트리모늄클로라이드', pct:  2.0, function: '컨디셔닝',   phase: 'B' },
      { inci: 'Cetearyl Alcohol',            korean: '세테아릴알코올',      pct:  4.0, function: '유화안정제', phase: 'B' },
      { inci: 'Behentrimonium Chloride',     korean: '베헨트리모늄클로라이드', pct: 2.0, function: '양이온컨디셔닝', phase: 'B' },
      { inci: 'Argan Oil',                   korean: '아르간오일',           pct:  3.0, function: '영양/광택',  phase: 'B' },
      { inci: 'Dimethicone',                 korean: '디메티콘',             pct:  2.0, function: '모발코팅',   phase: 'B' },
      { inci: 'Hydrolyzed Keratin',          korean: '가수분해케라틴',       pct:  2.0, function: '모발강화',   phase: 'C' },
      { inci: 'Panthenol',                   korean: '판테놀',               pct:  1.0, function: '보습/컨디셔닝', phase: 'C' },
      { inci: 'Citric Acid',                 korean: '시트릭애씨드',         pct:  0.1, function: 'pH조절',     phase: 'C' },
      { inci: 'Phenoxyethanol',              korean: '페녹시에탄올',         pct:  0.8, function: '방부제',     phase: 'D' },
      { inci: 'Fragrance',                   korean: '향료',                  pct:  0.3, function: '향',         phase: 'D' },
    ],
  },
  '헤어오일': {
    aqua_max: 3,
    balance_key: 'Cyclopentasiloxane',
    base_ingredients: [
      { inci: 'Cyclopentasiloxane',          korean: '사이클로펜타실록세인', pct: 50.0, function: '실리콘베이스', phase: 'A' },
      { inci: 'Dimethicone',                 korean: '디메티콘',             pct: 20.0, function: '모발코팅',    phase: 'A' },
      { inci: 'Argan Oil',                   korean: '아르간오일',           pct: 10.0, function: '영양/광택',   phase: 'A' },
      { inci: 'Camellia Sinensis Seed Oil',  korean: '동백오일',             pct:  8.0, function: '에몰리언트',  phase: 'A' },
      { inci: 'Tocopherol',                  korean: '토코페롤',             pct:  0.5, function: '항산화제',    phase: 'B' },
      { inci: 'Fragrance',                   korean: '향료',                  pct:  0.5, function: '향',          phase: 'B' },
    ],
  },
  '헤어미스트': {
    aqua_max: 92,
    balance_key: 'Aqua',
    base_ingredients: [
      { inci: 'Aqua',                        korean: '정제수',               pct: 87.0, function: '용매',       phase: 'A' },
      { inci: 'Glycerin',                    korean: '글리세린',             pct:  2.0, function: '보습제',     phase: 'A' },
      { inci: 'Propanediol',                 korean: '프로판다이올',         pct:  2.0, function: '용매/보습',   phase: 'A' },
      { inci: 'Panthenol',                   korean: '판테놀',               pct:  0.5, function: '모발보습',   phase: 'C' },
      { inci: 'Hydrolyzed Silk',             korean: '가수분해실크',         pct:  0.5, function: '모발광택',   phase: 'C' },
      { inci: 'Dimethicone',                 korean: '디메티콘',             pct:  1.0, function: '모발코팅',   phase: 'B' },
      { inci: 'Phenoxyethanol',              korean: '페녹시에탄올',         pct:  0.5, function: '방부제',     phase: 'D' },
      { inci: 'Fragrance',                   korean: '향료',                  pct:  0.3, function: '향',         phase: 'D' },
    ],
  },
}

// ── getBaseKey (product_type → PRODUCT_BASE 키 반환) ── 43제형 커버
export function getBaseKey(product_type) {
  const pt = (product_type || '').toLowerCase()
  // 립 제품 (구체적인 것 먼저)
  if (pt.includes('립스틱') || pt.includes('lipstick')) return '립스틱'
  if (pt.includes('립글로스') || pt.includes('lipgloss') || pt.includes('lip gloss')) return '립글로스'
  if (pt.includes('립틴트') || pt.includes('lip tint') || pt.includes('틴트')) return '립틴트'
  if (pt.includes('립밤') || pt.includes('lip balm') || pt.includes('lipbalm')) return '립밤'
  // 선케어
  if (pt.includes('선크림') || pt.includes('선스크린') || pt.includes('sunscreen') || pt.includes('sunblock') || pt.includes('spf')) return '선크림'
  // 베이스 메이크업
  if (pt.includes('파운데이션') || pt.includes('foundation')) return '파운데이션'
  if (pt.includes('쿠션') || pt.includes('cushion')) return '쿠션'
  if (pt.includes('bb크림') || pt.includes('bb cream')) return 'BB크림'
  if (pt.includes('cc크림') || pt.includes('cc cream')) return 'CC크림'
  if (pt.includes('프라이머') || pt.includes('primer')) return '프라이머'
  if (pt.includes('컨실러') || pt.includes('concealer')) return '컨실러'
  // 아이 메이크업
  if (pt.includes('아이섀도') || pt.includes('eye shadow') || pt.includes('eyeshadow')) return '아이섀도우'
  if (pt.includes('마스카라') || pt.includes('mascara')) return '마스카라'
  if (pt.includes('아이라이너') || pt.includes('eyeliner') || pt.includes('eye liner')) return '아이라이너'
  if (pt.includes('아이브로우') || pt.includes('eyebrow') || pt.includes('eye brow')) return '아이브로우'
  // 치크/파우더
  if (pt.includes('블러셔') || pt.includes('blusher') || pt.includes('블러시') || pt.includes('cheek')) return '블러셔'
  if (pt.includes('하이라이터') || pt.includes('highlighter')) return '하이라이터'
  if (pt.includes('파우더') || pt.includes('powder')) return '파우더'
  // 클렌징 (구체적인 것 먼저)
  if (pt.includes('클렌징오일') || pt.includes('cleansing oil')) return '클렌징오일'
  if (pt.includes('클렌징워터') || pt.includes('cleansing water') || pt.includes('micellar')) return '클렌징워터'
  if (pt.includes('클렌징폼') || pt.includes('cleansing foam') || pt.includes('폼클렌') || pt.includes('foam cleanser')) return '클렌징폼'
  // 스킨케어 집중 처방
  if (pt.includes('마스크팩') || pt.includes('마스크') || pt.includes('mask pack') || pt.includes('sheet mask')) return '마스크팩'
  if (pt.includes('필링젤') || pt.includes('peeling gel') || pt.includes('필링')) return '필링젤'
  if (pt.includes('앰플') || pt.includes('ampoule')) return '앰플'
  if (pt.includes('미스트') || pt.includes('mist') || pt.includes('스프레이')) return '미스트'
  if (pt.includes('페이스오일') || pt.includes('face oil') || pt.includes('페이셜오일')) return '페이스오일'
  // 페이스 크림/로션류
  if (pt.includes('아이크림') || pt.includes('eye cream')) return '아이크림'
  if (pt.includes('나이트크림') || pt.includes('night cream')) return '나이트크림'
  if (pt.includes('수분크림') || pt.includes('모이스처') || pt.includes('moisture cream')) return '수분크림'
  if (pt.includes('에센스') || pt.includes('세럼') || pt.includes('essence') || pt.includes('serum')) return '에센스'
  if (pt.includes('토너') || pt.includes('스킨') || pt.includes('toner')) return '토너'
  // 바디케어
  if (pt.includes('바디워시') || pt.includes('body wash')) return '바디워시'
  if (pt.includes('바디로션') || pt.includes('body lotion')) return '바디로션'
  if (pt.includes('바디크림') || pt.includes('body cream')) return '바디크림'
  if (pt.includes('핸드크림') || pt.includes('hand cream')) return '핸드크림'
  if (pt.includes('풋크림') || pt.includes('foot cream')) return '풋크림'
  // 헤어케어
  if (pt.includes('헤어오일') || pt.includes('hair oil')) return '헤어오일'
  if (pt.includes('헤어미스트') || pt.includes('hair mist')) return '헤어미스트'
  if (pt.includes('헤어팩') || pt.includes('hair pack') || pt.includes('hair mask')) return '헤어팩'
  if (pt.includes('트리트먼트') || pt.includes('treatment')) return '트리트먼트'
  if (pt.includes('린스') || pt.includes('rinse') || pt.includes('컨디셔너') || pt.includes('conditioner')) return '린스'
  if (pt.includes('샴푸') || pt.includes('shampoo')) return '샴푸'
  // 일반 크림/로션
  if (pt.includes('로션') || pt.includes('lotion') || pt.includes('에멀')) return '로션'
  if (pt.includes('크림') || pt.includes('cream')) return '수분크림'
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// ── FORMULA_RULES (generate-idea 서버사이드 검증용 — 필수원료 강제 규칙) ──
// ═══════════════════════════════════════════════════════════════════════════
export const FORMULA_RULES = {
  '립스틱': {
    aqua_max: 5,
    must_include: ['색소', 'CI', 'Iron Oxide', 'Pigment', 'Carmine', 'Mica'],
    must_include_msg: '색소/안료 (CI번호 또는 Iron Oxides 또는 Mica) 반드시 포함',
    base_type: '왁스/오일',
    key_categories: ['wax', 'plant_oil', 'emollient_ester', 'colorant'],
    typical_structure: '왁스류 30-40% + 오일류 40-50% + 색소 5-15%',
  },
  '립글로스': {
    aqua_max: 5,
    must_include: ['색소', 'CI', 'Mica', 'Polybutene', 'Polyisobutene'],
    must_include_msg: '색소 + 광택제(Polybutene 또는 Mica) 반드시 포함',
    base_type: '오일/폴리머',
    key_categories: ['plant_oil', 'colorant', 'polymer_film_former'],
    typical_structure: '점성오일 50-60% + 광택제 20-30% + 색소 5-10%',
  },
  '립밤': {
    aqua_max: 2,
    must_include: ['Wax', 'Beeswax', 'Carnauba', 'Candelilla', 'Ozokerite'],
    must_include_msg: '왁스류 (Beeswax/Carnauba/Candelilla) 반드시 포함',
    base_type: '왁스/오일',
    key_categories: ['wax', 'plant_oil', 'emollient_ester'],
    typical_structure: '왁스류 20-35% + 오일류 50-65% + 기능성 1-5%',
  },
  '립틴트': {
    aqua_max: 50,
    must_include: ['색소', 'CI', 'Glycerin'],
    must_include_msg: '색소 + 보습제 반드시 포함',
    base_type: '수성',
    key_categories: ['humectant_active', 'colorant', 'polymer_film_former'],
    typical_structure: 'Aqua 40-50% + 보습제 10-20% + 색소 3-8%',
  },
  '수분크림': {
    aqua_max: 80,
    must_include: ['유화제', 'Cetearyl', 'Glyceryl Stearate', 'Polysorbate', 'Emulsifier'],
    must_include_msg: '유화제 (Cetearyl Alcohol 또는 Glyceryl Stearate 등) 반드시 포함',
    base_type: 'O/W 에멀전',
    key_categories: ['emulsifier', 'humectant_active', 'emollient_ester'],
    typical_structure: 'Aqua 65-75% + 유화제 3-8% + 오일상 10-20%',
  },
  '로션': {
    aqua_max: 85,
    must_include: ['유화제', 'Cetearyl', 'Polysorbate', 'Emulsifier', 'Glyceryl'],
    must_include_msg: '유화제 반드시 포함',
    base_type: 'O/W 에멀전',
    key_categories: ['emulsifier', 'humectant_active'],
    typical_structure: 'Aqua 70-80% + 유화제 2-5% + 오일상 5-15%',
  },
  '선크림': {
    aqua_max: 70,
    must_include: ['Zinc Oxide', 'Titanium Dioxide', 'Ethylhexyl', 'Octinoxate', 'Octocrylene', 'Avobenzone'],
    must_include_msg: 'UV 필터 반드시 포함 (Zinc Oxide 또는 유기 UV필터)',
    base_type: 'O/W 에멀전',
    key_categories: ['uv_filter', 'emulsifier'],
    typical_structure: 'Aqua 50-65% + UV필터 15-25% + 유화제 3-8%',
  },
  '에센스': {
    aqua_max: 92,
    must_include: ['Niacinamide', 'Peptide', 'Extract', 'Hyaluronate', 'Adenosine', 'Vitamin'],
    must_include_msg: '기능성 원료 (나이아신아마이드/펩타이드/히알루론산 등) 반드시 포함',
    base_type: '수성',
    key_categories: ['humectant_active', 'peptide', 'biomimetic_active'],
    typical_structure: 'Aqua 80-90% + 보습제 5-10% + 기능성 1-5%',
  },
  '세럼': {
    aqua_max: 90,
    must_include: ['Peptide', 'Vitamin', 'Extract', 'Niacinamide', 'Retinol', 'Hyaluronate'],
    must_include_msg: '기능성 원료 (펩타이드/비타민/추출물) 반드시 포함',
    base_type: '수성/오일',
    key_categories: ['peptide', 'biomimetic_active', 'vitamin'],
    typical_structure: 'Aqua 70-85% + 기능성 3-10% + 보습제 5-10%',
  },
  '토너': {
    aqua_max: 96,
    must_include: ['Glycerin', 'Butylene Glycol', 'Propanediol', 'Niacinamide', 'Hyaluronate'],
    must_include_msg: '보습제 (글리세린/부틸렌글라이콜 등) 반드시 포함',
    base_type: '수성',
    key_categories: ['humectant_active', 'polyol'],
    typical_structure: 'Aqua 85-93% + 보습제 5-10% + 기능성 0.5-3%',
  },
  '샴푸': {
    aqua_max: 80,
    must_include: ['Sulfate', 'Surfactant', 'Cocamide', 'Sodium Laureth', 'Betaine', 'Cocoyl'],
    must_include_msg: '세정용 계면활성제 (SLES/Betaine/Cocoyl 등) 반드시 포함',
    base_type: '계면활성제',
    key_categories: ['surfactant', 'foam_booster'],
    typical_structure: 'Aqua 60-70% + 계면활성제 15-25% + 컨디셔너 2-5%',
  },
  '트리트먼트': {
    aqua_max: 70,
    must_include: ['Cetearyl', 'BTMS', 'Behentrimonium', 'Quaternium', 'Amodimethicone'],
    must_include_msg: '양이온 컨디셔너 (BTMS/Behentrimonium 등) 반드시 포함',
    base_type: '양이온 에멀전',
    key_categories: ['hair_conditioner_quat', 'emulsifier'],
    typical_structure: 'Aqua 60-70% + 양이온제 3-8% + 에몰리언트 5-15%',
  },
  '파운데이션': {
    aqua_max: 50,
    must_include: ['Iron Oxide', 'Titanium Dioxide', 'CI 77', 'Mica', '색소'],
    must_include_msg: '안료/색소 (Iron Oxide + Titanium Dioxide) 반드시 포함',
    base_type: 'W/O 또는 O/W 에멀전',
    key_categories: ['colorant', 'emulsifier', 'uv_filter'],
    typical_structure: '안료 10-20% + 에멀전 베이스 + UV필터 선택',
  },
  '바디로션': {
    aqua_max: 82,
    must_include: ['Cetearyl', 'Glyceryl Stearate', 'Polysorbate', 'Shea', 'Butter', 'Emulsifier'],
    must_include_msg: '유화제 + 에몰리언트 반드시 포함',
    base_type: 'O/W 에멀전',
    key_categories: ['emulsifier', 'emollient_ester', 'plant_oil'],
    typical_structure: 'Aqua 70-80% + 에몰리언트 10-20% + 유화제 3-8%',
  },
  '클렌징폼': {
    aqua_max: 70,
    must_include: ['Surfactant', 'Amino', 'Cocoyl', 'Lauryl', 'Betaine', 'Cocamide'],
    must_include_msg: '세정용 계면활성제 (아미노산계/베타인계 등) 반드시 포함',
    base_type: '계면활성제',
    key_categories: ['surfactant', 'foam_booster'],
    typical_structure: 'Aqua 55-65% + 계면활성제 20-30% + 보습제 3-8%',
  },
}

// ── getFormulaRules (product_type → FORMULA_RULES 검증규칙 반환) ──
export function getFormulaRules(product_type) {
  const pt = (product_type || '').toLowerCase()
  // 립 제품
  if (pt.includes('립스틱') || pt.includes('lipstick')) return FORMULA_RULES['립스틱']
  if (pt.includes('립글로스') || pt.includes('lipgloss') || pt.includes('lip gloss')) return FORMULA_RULES['립글로스']
  if (pt.includes('립밤') || pt.includes('lip balm') || pt.includes('lipbalm')) return FORMULA_RULES['립밤']
  if (pt.includes('립틴트') || pt.includes('lip tint') || pt.includes('틴트')) return FORMULA_RULES['립틴트']
  // 선케어
  if (pt.includes('선크림') || pt.includes('선스크린') || pt.includes('sunscreen') || pt.includes('spf')) return FORMULA_RULES['선크림']
  // 베이스 메이크업
  if (pt.includes('파운데이션') || pt.includes('foundation') || pt.includes('bb크림') || pt.includes('cc크림')) return FORMULA_RULES['파운데이션']
  // 헤어
  if (pt.includes('트리트먼트') || pt.includes('헤어팩') || pt.includes('treatment')) return FORMULA_RULES['트리트먼트']
  if (pt.includes('샴푸') || pt.includes('shampoo')) return FORMULA_RULES['샴푸']
  // 클렌징
  if (pt.includes('클렌징') || pt.includes('폼클렌') || pt.includes('foam cleanser') || pt.includes('cleansing foam')) return FORMULA_RULES['클렌징폼']
  // 스킨케어
  if (pt.includes('에센스') || pt.includes('앰플') || pt.includes('essence') || pt.includes('ampoule')) return FORMULA_RULES['에센스']
  if (pt.includes('세럼') || pt.includes('serum')) return FORMULA_RULES['세럼']
  if (pt.includes('토너') || pt.includes('스킨') || pt.includes('toner')) return FORMULA_RULES['토너']
  if (pt.includes('바디로션') || pt.includes('바디크림') || pt.includes('body lotion') || pt.includes('body cream')) return FORMULA_RULES['바디로션']
  if (pt.includes('수분크림') || pt.includes('아이크림') || pt.includes('나이트크림') || pt.includes('moisture cream')) return FORMULA_RULES['수분크림']
  if (pt.includes('로션') || pt.includes('lotion')) return FORMULA_RULES['로션']
  if (pt.includes('크림') || pt.includes('cream')) return FORMULA_RULES['수분크림']
  return null
}
