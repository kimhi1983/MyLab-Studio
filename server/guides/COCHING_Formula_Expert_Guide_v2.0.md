# COCHING 처방 전문가 가이드 v2.0
## 화장품 제형별 배합 규칙 (Gemini 프롬프트 삽입용)
## 전문 연구원 2인 검증 통합본 (2026-03-19)

> 이 가이드는 Gemini 처방 생성 프롬프트에 제형별 전문가 규칙으로 삽입됩니다.
> 두 명의 화장품 처방 전문 연구원의 검증을 통합한 실무 기반 가이드입니다.

---

## ⚠️ AI 처방 생성 필수 원칙 (모든 제형 공통)

1. **성분 퍼센트만 맞추면 제품이 되는 것이 아님** — 원료 grade, 입도, 표면처리, 분산공정, pH, 전해질 내성, 포장재까지 고려해야 함
2. **국가별 규제를 먼저 나누고 처방을 설계할 것** — 미국 OTC vs EU vs 아시아 필터 전략 분리
3. **같은 INCI라도 grade/표면처리/분자량/용매형에 따라 결과가 다름**
4. **민감피부 콘셉트에서는 향료/에센셜오일/고알코올을 자동 배제**
5. **K-뷰티 2025-2026 트렌드: 고함량 과시보다 장벽 양립성, 사용감, 루틴 단순화**
6. **점증제(Carbomer 등)와 고농도 전해질 혼합 금지** — 점도 붕괴 위험
7. **pH 기반 방부 안정성** — 유기산 계열 방부제는 pH 5.5 이하에서만 유효
8. **HLB 매칭** — 유상 Phase 오일들의 필요 HLB 가중 평균을 계산하여 유화제 자동 매칭
9. **Carbomer 중화제로 TEA(Triethanolamine) 사용 금지** — 발암물질 논란, Arginine 또는 Tromethamine으로 대체
10. **SPF/PA는 계산값이 아니라 최종 시험값으로 확정** — AI 생성값은 출발점일 뿐
11. **출시형 처방은 원가 목표를 반드시 동시에 입력할 것** — 고가 활성 성분 과다 사용 방지
12. **기능성 주장과 일반 보습성분 사용을 구분할 것** — MFDS 기능성 고시 기준 (Adenosine 0.04%, Niacinamide 2~5% 등 고시 범위 준수)
13. **립 제품은 '화장품에 쓸 수 있는가'가 아니라 '립 제품에 쓸 수 있는가'를 따로 확인** — 섭취 경로 고려, EU 립 전용 색소 리스트 별도 확인 필수

---

## 1. 썬크림 (선크림 / 자외선 차단)

### 기본 구조
- **정제수(Aqua):** 30~60% (제형 타입별 차이)
  - 하이브리드 O/W: 40~60%
  - 무기자차 O/W: 45~65%
  - W/Si 또는 W/O: 25~45%
- **총 자외선차단제:** SPF50 기준 18~35%

### 자외선차단제 배합 가이드 (SPF50 PA++++ 기준)
- **Titanium Dioxide:** 2~12% (나노/논나노 분산액 기준)
- **Zinc Oxide:** 8~20% (PA++++ 핵심. 무기자차 단독 시 15% 이상 필수)
- **화학적 차단제 합계:** 10~28% (조합에 따라 유동적)
- **총 차단제 합계:** 18~35%

### 물리적 차단제
- **Titanium Dioxide:** UVB+UVA2 차단, 백탁 주의, 표면처리된 등급 선택 필수
- **Zinc Oxide:** 광범위 UVA+UVB, PA++++ 핵심. pH 6.5~7.5 유지 필수 (산성 시 아연 이온 해리 → 뭉침/점도 붕괴)

### 화학적 차단제 (주요 필터)
- **Diethylamino Hydroxybenzoyl Hexyl Benzoate (Uvinul A Plus):** 1~5% — UVA
- **Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine (Tinosorb S):** 2~5% — UVA+UVB 광안정제
- **Ethylhexyl Methoxycinnamate (Octinoxate):** 5~10% — UVB (Avobenzone과 병용 금지)
- **Ethylhexyl Triazone (Uvinul T150):** 1~5% — UVB 광안정
- **Octocrylene:** 2~10% — UVB + Avobenzone 안정화
- **Ethylhexyl Salicylate:** 3~5% — UVB 보조
- **Homosalate:** 5~10% — UVB 보조

### 필수 보조 성분
- **실리콘 베이스:** Cyclopentasiloxane 10~20%, Dimethicone 2~5%, Trimethylsiloxysilicate 0.5~4%
  - 클린뷰티 대체: C12-15 Alkyl Benzoate, Butyloctyl Salicylate 등 경량 에스터 오일
- **분산제:** Polyhydroxystearic Acid, Triethoxycaprylylsilane, Alumina (무기 필터 사전 분산 필수)
- **피막형성제 (내수성):** Acrylates/Octylacrylamide Copolymer, Trimethylsiloxysilicate, VP/Eicosene Copolymer
- **유화제:** PEG-10 Dimethicone (W/S), Cetyl PEG/PPG-10/1 Dimethicone, Lauryl PEG-9 Polydimethylsiloxyethyl Dimethicone
- **기타:** Silica, Disodium EDTA(금속이온봉쇄), Tocopherol(항산화), 점증제(Xanthan Gum, Acrylates Crosspolymer)

### Phase 구성
- **Phase A (수상 70~75°C):** 정제수 + 보습제 + 수용성 성분 (열민감 활성 제외)
- **Phase B (유상 70~75°C):** 실리콘 + 유화제 + 오일 + 무기필터(호모믹서로 사전 완벽 분산)
- **⚠️ 무기 필터(TiO2/ZnO)는 Phase B에 투입하여 호모믹서로 사전 분산(Pre-dispersion)** — 공정 후반부 투입 금지 (뭉침/Agglomeration 발생)
- **Phase D (≤45°C):** 방부제 + 향료 + 열민감 추출물 + pH 보정

### 금지/주의
- **Avobenzone + Ethylhexyl Methoxycinnamate 병용 금지** — 광안정성 급격 저하
- **Avobenzone + 고알칼리 시스템 금지** — 안정성 저하
- **코팅 안 된 순수 무기 분체 + Avobenzone 금지** — 산화 촉진
- **무기 필터 고함량 + 분산제 부족** — SPF 미달, 발림성 저하
- **ZnO 사용 시 산성 pH 금지** — pH 6.5~7.5 중성 유지 필수
- **정제수 65% 초과 (무기자차):** SPF 목표 달성 어려움

### K-뷰티 트렌드 반영
- 데일리 사용 편의성 > 단순 고SPF
- 장벽 친화 + 스킨케어 겸용 메시지
- 사용감(얇고 가벼운 도포) 중시

---

## 2. 보습크림 (수분크림 / 크림)

### 기본 구조
- **정제수(Aqua):** 45~82% (젤크림은 70%+, 리치 크림은 낮아짐)
- **보습제 합계:** 10~20%
- **유화 시스템:** O/W (PEG-free 선호 트렌드)

### 필수 보습 성분 (최소 3종)
- **Glycerin:** 3~10% — 기본 humectant
- **Butylene Glycol 또는 Propanediol:** 2~6% — 용매 + 보습감 개선
- **Betaine:** 1~5% — 끈적임 줄이면서 보습감
- **Sodium Hyaluronate:** 0.05~0.3% (1% 수용액 기준 0.5~5%) — 체감 보습
- **Ceramide NP complex:** 0.1~1% — 장벽 강화 (Cholesterol + Fatty Acid 함께 설계)

### 유화 시스템 (PEG-free 선호)
- **Glyceryl Stearate Citrate:** 1~2.5% — 안정성 + 범용성
- **Cetearyl Alcohol + Cetearyl Glucoside:** 1~3% — 크림감 형성
- **Cetearyl Olivate + Sorbitan Olivate (Olivem 1000):** 1.5~4% — 자연 유래 이미지
- **보조:** Glyceryl Stearate / PEG-100 Stearate 1~2%

### 건성 vs 지성 피부
- **건성:** 오일 12~28%, Shea Butter, Squalane, Macadamia Seed Oil, Hydrogenated Polydecene (보습막 무거운 에몰리언트)
- **지성:** 오일 3~12%, C12-15 Alkyl Benzoate, Coco-Caprylate/Caprate, Hemisqualane, Dicaprylyl Carbonate (모공 비폐쇄, dry-touch)

### 점증제
- **Carbomer:** 0.1~0.5% (중화제: Arginine 또는 Tromethamine. TEA 사용 금지)
- **비율:** Carbomer 1g당 중화제 0.4~1.2g (pH 6.0 타겟)
- **Xanthan Gum:** 0.1~0.3%
- **Acrylates/C10-30 Alkyl Acrylate Crosspolymer:** 0.1~0.3%

### 금지/주의
- **Carbomer + 고농도 전해질(NaCl, 미네랄해양수, 순수 비타민C) 병용 금지** — 점도 완전 붕괴
- **고농도 산성 활성 성분 + pH 민감 장벽 성분 무리한 병용** — 장벽 손상
- **과도한 지방알코올/왁스:** 밀림 유발
- **Glycerin 10% 초과:** 끈적임 사용감 저하

### 트렌드
- 세라마이드 사용 시 Cholesterol + Fatty Acid 조합 필수
- 보습 = Humectant + Occlusive + Emollient 3요소 균형
- 장벽, 진정, 저자극, PDRN, Peptide 중심

---

## 3. 쿠션 (BB크림 / 파운데이션 / 색조)

### 기본 구조
- **정제수(Aqua):** 20~55%
- **실리콘 베이스:** 10~30%
- **색소 합계:** 5~18%
- **체질 안료:** 2~12% (생략 불가)

### 필수 색소
- **Titanium Dioxide (CI 77891):** 3~15% — 밝기 + 커버력 핵심
- **Iron Oxide Yellow (CI 77492):** 0.5~3% — 한국 시장 뉴트럴-옐로우 베이스 핵심
- **Iron Oxide Red (CI 77491):** 0.1~0.8%
- **Iron Oxide Black (CI 77499):** 0.01~0.5% — 명도 조절
- **Mica (CI 77019):** 1~8% — 광감 + 펴발림 (과하면 뜨는 느낌)

### 색상 호수별 비율
- **21호 (라이트):** Red 0.15~0.30%, Yellow 0.80~1.40%, Black 0.05~0.12%
- **23호 (미디엄):** Red 0.20~0.40%, Yellow 1.20~2.00%, Black 0.08~0.18%

### 체질 안료 (필수 — 생략 시 발림감/마무리감 급락)
- **Silica:** 1~5% — 오일 흡수, 소프트 포커스
- **Nylon-12 / PMMA:** 1~3% — 블러 효과
- **Boron Nitride:** 0.5~2% — 실키 터치
- **Talc:** 기피 (석면 이슈) — Silica로 대체

### 실리콘 베이스
- **Cyclopentasiloxane:** 5~18% (→ 도포 후 가볍게 휘발)
- **Dimethicone:** 1~6%
- **Phenyl Trimethicone:** 1~5% — 고광택
- **Trimethylsiloxysilicate:** 0.5~4% — 밀착력/지속력
- **Silicone Elastomer:** 0.5~3% — 모공 블러

### 유화 (W/Si 주류)
- **Cetyl PEG/PPG-10/1 Dimethicone:** 2~4%
- **Lauryl PEG-9 Polydimethylsiloxyethyl Dimethicone**
- **Disteardimonium Hectorite:** 보조

### 금지/주의
- **Iron Oxide 미포함:** 쿠션은 색소 필수
- **체질 안료 미포함:** 발림감/마무리감 급락
- **정제수 60% 초과:** 커버력 저하
- **안료는 반드시 pre-dispersion 품질 관리**
- **LOT 편차에 따른 색차 관리 필요**

### 트렌드
- 두꺼운 고커버 < 얇고 정돈된 피부 표현
- 피부결 표현 + 광채 밸런스
- 지속력: 필름포머 + 실리콘 네트워크 설계

---

## 4. 샴푸 (두피케어 / 세정)

### 기본 구조
- **정제수(Aqua):** 50~70%
- **계면활성제 합계:** 15~25%

### pH 범위 (제형별)
- **일반 샴푸:** pH 5.5~6.5
- **손상모용:** pH 4.5~5.5 (큐티클 수축)
- **두피케어:** pH 5.0~6.0

### 필수 계면활성제 (최소 2종)
- **주 세정제:** SLES 6~15% 또는 Sodium C14-16 Olefin Sulfonate 4~12%
- **보조 세정제:** Cocamidopropyl Betaine 3~8%
- **기타:** Disodium Laureth Sulfosuccinate, Sodium Lauroyl Sarcosinate, Decyl Glucoside

### 마일드 샴푸 (아미노산계)
- **Sodium Cocoyl Isethionate (SCI):** 5~10%
- **Potassium Cocoyl Glycinate 또는 Sodium Lauroyl Methyl Isethionate (SLMI):** 3~8%
- **Sodium Cocoyl Glycinate, Sodium Lauroyl Glutamate** 등

### 점도 조절
- **NaCl:** 0.5~1.5% (Sulfate 계열 시. salt curve는 계면활성제 조합에 따라 다름 — 계면활성제 확정 후 점증 전략 선택)
- **PEG-120 Methyl Glucose Dioleate:** 아미노산계 필수 (소금만으로 점증 안 됨)
- **Polyquaternium-10:** 컨디셔닝 + 점증 보조
- **PEG-150 Distearate / Crothix:** 점증 보조 (계면활성제 배합에 적합)
- **Acrylates Copolymer:** 투명 겔 점증 (중화 필요)

### 비듬 방지
- **Piroctone Olamine:** 0.1~0.5% (가장 안전한 대체제, 선호)
- **Climbazole:** 0.2~0.5% (Piroctone Olamine과 함께 대안 — 곰팡이 억제 우수)
- **Zinc Pyrithione:** 0.5~1% (EU Annex II 항목으로 화장품 사용 제한 명확 — 글로벌 제품은 사용 금지 권장)
- **Salicylic Acid:** 0.5~2%

### Phase 구성
- **Phase A:** 정제수 가열 (70°C) + 수용성 성분
- **Phase B:** 계면활성제 혼합 (저속 교반 — 거품 방지)
- **Phase C:** 첨가제 + 향료 + 방부제 (≤45°C)

### 금지/주의
- **SLS(Sodium Lauryl Sulfate) 단독:** 자극 강함, SLES 사용
- **pH 7 이상:** 두피 자극, 모발 손상

### 트렌드
- 실리콘 프리 대응: Polyquaternium-10 + Argan Kernel Oil 등 식물성 오일
  - 실리콘 프리 컨디셔닝 대체: **Brassicyl Isoleucinate Esylate**, **Cationic Cellulose**, **Hydrolyzed Protein** (식물성 컨디셔닝 대안)
- 두피 자극 완화 > 단순 강세정
- 두피 스킨케어화 (PDRN, peptide, scalp treatment)

---

## 5. 립스틱 (립틴트 / 립글로스)

### 립스틱 (고체형 — 무수 제형)
- **정제수:** 0% (무수 필수. 수분 포함 시 미생물 번식 위험)
- **왁스 합계:** 10~25%
- **오일/에스터:** 30~50%
- **색소:** 5~15%

### 필수 왁스 (최소 2종)
- **Candelilla Wax:** 3~8% — 경도 + 윤기
- **Carnauba Wax:** 1~5% — 내열성 (한여름 부러짐 방지)
- **Microcrystalline Wax:** 3~8% — 오일 바인딩 + 유연성
- **Beeswax:** 2~5%

### 색소 (선명한 레드 기준)
- **CI 15850:1 (Red 7 Lake):** 3~6% — 트루 레드 베이스
- **CI 77491 (Iron Oxide Red):** 0.5~1.5% — 깊이감
- **CI 77891 (TiO2):** 1~5% — 백색 베이스
- **Mica:** 3~8% — 펄/광택

### 립틴트 (수성 — 완전히 다른 제형)
- **정제수:** 50~80%
- **주요 성분:** Glycerin, 수용성 점증제, 용해제
- **색소 차이:** 수용성 염료(Dye, Red 33 등) 사용 — 립스틱의 불용성 레이크와 다름

### Phase 구성 (립스틱)
- **Phase A:** 왁스 + 오일 가열 (80~85°C) → 완전 용해
- **Phase B:** 색소 분산 (롤밀링 또는 프리믹스)
- **Phase C:** 산화방지제 + 향료 (≤60°C)
- **몰딩:** 80~85°C 주입 → 실온에서 1차 안정화 후 저온 냉각. 급랭(-5~5°C) 시 수축/스웨팅/크랙 위험 — 주의

### 금지/주의
- **립스틱에 정제수 포함 금지** — 미생물 위험
- **파라벤 금지** — 섭취 우려
- **공업용 색소 사용 금지**
- **EU 규제 특정 염료 확인 필수**

---

## 6. 세럼 (에센스 / 앰플)

### 기본 구조
- **정제수(Aqua):** 50~95% (오일세럼/에멀전세럼 포함 — 제형 타입별 차이)
- **활성 성분:** 5~15%
- **점도:** 500~8,000 cps (스포이드 기준)

### 미백 세럼
- **Niacinamide:** 2~5% (식약처 고시)
- **Alpha-Arbutin:** 1~2%
- **Ascorbic Acid (순수 비타민C):** 5~20% (pH 2.8~3.5 필수)
- **Tranexamic Acid:** 2~5% (기존 2~3%에서 상향 — 전문가 권장)

### 안티에이징 세럼
- **Retinol:** 0.01~0.3% (야간 전용. 초보자 0.01%, 전문가 권장 최대 0.3%)
- **Bakuchiol:** 0.2~1% (레티놀 대체 — 식물성, 저자극, 주/야간 모두 사용 가능)
- **Peptide Complex:** 원료 단위 1~5%
- **Adenosine:** 0.04% (한국 기능성 고시)
- **PDRN:** 최신 K-뷰티 트렌드 핵심

### 비타민C 세럼 pH
- **순수 Ascorbic Acid:** pH 2.8~3.5
- **Ascorbyl Glucoside:** pH 5.0~7.0

### 점증제
- **Xanthan Gum, Hydroxyethylcellulose, Carbomer**
- **Ammonium Acryloyldimethyltaurate/VP Copolymer** — 실키 텍스처

### 금지/주의
- **Vitamin C + Niacinamide 고농도 병용:** 낮은 pH에서 나이아신 변환 → 홍조/따가움 (분리 권장)
- **Retinol + AHA/BHA 고함량:** 과자극, 심각한 장벽 손상
- **Copper peptide + 저pH 산성계:** 주의 필요
- **세럼에 오일 과다:** 경량 수성 제형 유지

### 트렌드
- PDRN, Peptide, Barrier repair, Regenerative
- 자극적이지만 강한 제품 < 오래 써도 편안한 기능성
- 레티놀/비타민C/펩타이드는 pH와 포장재까지 검토

---

## 7. 토너 (스킨 / 화장수)

### 기본 구조
- **정제수(Aqua):** 70~98%
- **보습제:** 3~8%

### pH 범위
- **AHA 토너:** pH 3.0~4.0
- **BHA 토너:** pH 3.2~4.2
- **일반 보습 토너:** pH 4.8~6.2

### 필수 성분
- **Glycerin:** 2~5%
- **Butylene Glycol 또는 Propanediol:** 2~5%
- **Betaine:** 1~3%
- **Panthenol:** 0.5~2%
- **Allantoin:** 0.1~0.5%
- **Centella Asiatica Extract (CICA):** 0.1~1%

### 금지/주의
- **무거운 오일/왁스:** 가용화 한계 초과 시 즉각 층분리
- **향료/에탄올 과량:** 민감도 증가
- **불필요한 다중 추출물 과잉:** 장기 안정성 미검증

### 트렌드
- 닦토 < 수분 레이어링 토너
- 저자극 + 장벽 친화
- 간결한 루틴 (스킵케어)

---

## 8. 마스크팩 (시트마스크 에센스)

### 기본 구조
- **정제수(Aqua):** 85~95%
- **점도:** 200~3,000 cps

### 점증제 (시트 흡착용)
- **Xanthan Gum, Hydroxyethylcellulose**
- **Sclerotium Gum, Biosaccharide Gum-1**
- **소량 Carbomer**

### 진정 마스크팩 필수 성분
- **Panthenol, Allantoin, Beta-Glucan**
- **Centella Asiatica / Madecassoside**
- **Sodium Hyaluronate, Trehalose**

### 금지/주의 (장시간 밀봉 접촉)
- **고농도 AHA/BHA:** 밀봉 효과로 자극 증폭
- **Retinol:** 밀봉 시 자극 증가
- **멘톨 과량, 자극성 향료 과량**
- **고함량 에탄올**

### 트렌드
- 시트 적합성 + 흡액률 관리
- 점도보다 적하성, 방출성, 촉촉한 사용감
- 저자극 우선 설계

---

## 9. 바디로션 (바디크림 / 바디밀크)

### 기본 구조
- **정제수(Aqua):** 55~88%
- **유연제:** 8~20%
- **보습제:** 5~10%

### 페이스 vs 바디 차이점
- **사용량:** 전신 도포 → 1회 사용량 압도적으로 많음
- **원가:** 대용량 → g당 원가 압박, 고가 활성 성분 비중 낮춤
- **성분:** 퍼짐성(Spreadability) 좋은 에몰리언트 비중 높음
- **향료:** 바디는 잔향이 중요한 구매 요소

### 유연제
- **Caprylic/Capric Triglyceride, C12-15 Alkyl Benzoate**
- **Mineral Oil, Shea Butter, Sunflower Seed Oil**
- **Dicaprylyl Carbonate**

### 건성 피부용 추가
- **Urea:** 2~10% (각질 연화 + 강력 보습)
- **Shea Butter:** 2~10%
- **Petrolatum:** 2~10%
- **Ceramide complex**

### 향료
- **일반 보습 바디:** 0.1~0.8%
- **퍼퓸드 바디:** 0.8~1.5% (주의)

### 트렌드
- 바디도 장벽, 재생, 플럼프 스킨 개념 확장
- 보습 지속시간 + 대면적 발림성 균형
- 얼굴 → 바디 → 두피까지 스킨케어화

---

## 10. 클렌저 (폼클렌저 / 클렌징밀크 / 클렌징오일)

### 폼클렌저 (비누화 타입)
- **정제수:** 40~60%
- **지방산:** Myristic Acid 5~20%, Stearic Acid 3~20%, Lauric Acid 2~10%
- **KOH:** 2~8% (지방산별 산가 계산하여 정밀 투입)
- **Glycerin:** 5~15%
- **pH:** 5.5~10.0 (비누화 결과 알칼리성)

### 아미노산 클렌저 (저자극)
- **Sodium Cocoyl Glycinate, Sodium Lauroyl Glutamate**
- **Disodium Cocoyl Glutamate, Sodium Cocoyl Alaninate**
- **pH:** 5.0~6.5

### 클렌징밀크
- **정제수:** 50~80%
- **오일상:** 10~30%
- **유화제:** O/W 일반 유화제
- **pH:** 5.0~7.0

### 클렌징오일
- **정제수:** 0~10%
- **오일상:** 70~95%
- **유화제:** PEG-20 Glyceryl Triisostearate, Polyglyceryl-10 Oleate, Sorbitan Sesquioleate (물에 잘 씻기는 가용화제)

### 금지/주의
- **SLS 단독:** 과도한 탈지, 장벽 손상
- **pH 10 초과:** 자극 과다

### 트렌드
- 세정력 < 세안 후 당김 최소화
- 피부 장벽 보전
- 저자극 계면활성제 조합 + 잔여감 최소화

---

## 공통: 방부 시스템 (2025-2026)

### 선호 조합 (전문가 합의)
- **조합 1:** 1,2-Hexanediol + Hydroxyacetophenone + Ethylhexylglycerin (광범위 항균)
- **조합 2:** Phenoxyethanol + Ethylhexylglycerin (클래식)
- **조합 3:** 1,2-Hexanediol + Caprylyl Glycol + Ethylhexylglycerin
- **조합 4:** pH 적합 시 Organic acid system

### 배합량 (제형별)
- **수성 제형 (토너/세럼/마스크팩):** 총 0.7~1.2%
- **유화 제형 (크림/로션):** 총 1.0~1.5%
- **무수 제형 (립스틱):** 0.1~0.5% (또는 항산화제 위주로 대체)
- **고수분 세정 제형 (샴푸/클렌저):** 총 0.5~1.0%
- **1,2-Hexanediol:** 1.0~2.0%
- **Phenoxyethanol:** 0.5% 이하 (보조적)
- **Ethylhexylglycerin:** 0.05~0.1%
- **Caprylyl Glycol:** 0.2~0.5%

### 규칙
- **Paraben:** 시장 기피 → 사용하지 않음
- **TEA(Triethanolamine):** 발암 논란 → Arginine 또는 Tromethamine으로 대체
- **무방부 마케팅은 가능하나, challenge test 통과가 실무상 필수**
- **pH 기반 방부:** 유기산 계열은 pH 5.5 이하에서만 유효

---

## 공통: 배합비 철칙

1. **합계 = 정확히 100.00%** (정수연산: wt%×100 → 합계 10000)
2. **정제수 = 밸런스 역산** (10000 - 비정제수 합계)
3. **규제 최대 농도 절대 초과 금지**
4. **동일 INCI 중복 시 전성분 합산**
5. **향료(Fragrance) = 전개 안 함**

---

## 공통: Phase 규칙

- **Phase A (수상):** 70~75°C — 정제수 + 수용성 성분 (열민감 활성 제외)
- **Phase B (유상):** 70~75°C — 오일 + 왁스 + 유화제 + 무기 분체 사전 분산
- **Phase C (첨가):** ≤45°C — 열민감 활성 성분, pH 보정
- **Phase D (방부):** ≤40°C — 방부제 + 향료

---

## 향후 추가 예정 제형 (v2.1)

- 아이크림, 선스틱, 선쿠션, 클렌징오일(상세)
- 헤어트리트먼트, 바디워시, 핸드크림
- 톤업크림, 틴티드 모이스처라이저, 두피 세럼

---

## 프롬프트 삽입 방법

base_key에 따라 해당 섹션만 선택 삽입 + "공통" 섹션 항상 포함:

```
'선크림' → 1. 썬크림
'크림','수분크림' → 2. 보습크림
'쿠션','BB크림','파운데이션' → 3. 쿠션
'샴푸' → 4. 샴푸
'립스틱','립틴트','립글로스' → 5. 립스틱
'세럼','에센스','앰플' → 6. 세럼
'토너','스킨' → 7. 토너
'마스크팩','시트마스크' → 8. 마스크팩
'바디로션','바디크림' → 9. 바디로션
'클렌저','폼클렌저' → 10. 클렌저
```

---

**버전:** v2.0 (2026-03-19, 전문가 설문 2차 누락분 반영)
**검증:** 전문 연구원 2인 설문 통합 (1차 + 2차 누락분)
**다음 단계:** 연구원 추가 검토 → v2.1 (추가 제형 + 세부 조정)
