export const tokens = {
  bg: '#f8f7f5',
  surface: '#ffffff',
  sidebar: '#fafaf8',
  border: '#ece9e3',
  borderMid: '#d8d4cc',
  accent: '#b8935a',
  accentLight: '#f0e8d8',
  accentDim: '#e8dece',
  text: '#1a1814',
  textSub: '#6b6560',
  textDim: '#aba59d',
  green: '#3a9068',
  greenBg: '#f0f8f4',
  red: '#c44e4e',
  redBg: '#fdf2f2',
  amber: '#b07820',
  amberBg: '#fdf8f0',
  blue: '#3a6fa8',
  blueBg: '#f0f4fb',
  purple: '#7c5cbf',
  purpleBg: '#f6f2fd',
  radius: '10px',
  radiusLg: '16px',
  shadow: '0 1px 4px rgba(0,0,0,0.04)',
  fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
  fontMono: "'JetBrains Mono', 'Courier New', monospace",
}

export const statusStyles = {
  draft: { color: tokens.amber, bg: tokens.amberBg, border: '#e8d4a0', label: '초안' },
  review: { color: tokens.blue, bg: tokens.blueBg, border: '#b8cce8', label: '검토중' },
  done: { color: tokens.green, bg: tokens.greenBg, border: '#b8dece', label: '완료' },
}

export const productCategories = [
  {
    group: '기초 제품',
    items: [
      { value: 'skincare-toner', label: '토너/스킨' },
      { value: 'skincare-lotion', label: '로션/에멀전' },
      { value: 'skincare-cream', label: '크림' },
      { value: 'skincare-serum', label: '세럼/에센스/앰플' },
      { value: 'skincare-eye', label: '아이크림' },
      { value: 'skincare-mask', label: '마스크/팩' },
      { value: 'skincare-mist', label: '미스트' },
      { value: 'skincare-oil', label: '페이셜 오일' },
    ],
  },
  {
    group: '기능성 제품',
    items: [
      { value: 'func-whitening', label: '미백' },
      { value: 'func-wrinkle', label: '주름개선' },
      { value: 'func-sunscreen', label: '자외선 차단' },
      { value: 'func-acne', label: '여드름/트러블' },
      { value: 'func-sensitive', label: '민감성/진정' },
    ],
  },
  {
    group: '색조 제품',
    items: [
      { value: 'makeup-foundation', label: '파운데이션/베이스' },
      { value: 'makeup-cushion', label: '쿠션' },
      { value: 'makeup-lip', label: '립스틱/립틴트' },
      { value: 'makeup-eye', label: '아이섀도/아이라이너' },
      { value: 'makeup-mascara', label: '마스카라' },
      { value: 'makeup-blusher', label: '블러셔/하이라이터' },
    ],
  },
  {
    group: '세정 제품',
    items: [
      { value: 'cleansing-foam', label: '클렌징 폼' },
      { value: 'cleansing-oil', label: '클렌징 오일/밤' },
      { value: 'cleansing-water', label: '클렌징 워터' },
      { value: 'cleansing-scrub', label: '스크럽/필링' },
    ],
  },
  {
    group: '바디/헤어',
    items: [
      { value: 'body-lotion', label: '바디로션/크림' },
      { value: 'body-wash', label: '바디워시' },
      { value: 'body-oil', label: '바디오일' },
      { value: 'hair-shampoo', label: '샴푸' },
      { value: 'hair-treatment', label: '트리트먼트/컨디셔너' },
      { value: 'hair-essence', label: '헤어에센스/오일' },
    ],
  },
  {
    group: '특수 제품',
    items: [
      { value: 'special-perfume', label: '향수/바디미스트' },
      { value: 'special-nail', label: '네일' },
      { value: 'special-baby', label: '베이비/키즈' },
      { value: 'special-mens', label: '남성용' },
      { value: 'special-pet', label: '반려동물' },
    ],
  },
]

// flat 리스트 (기존 호환)
export const productTypes = productCategories.flatMap(cat => cat.items)
