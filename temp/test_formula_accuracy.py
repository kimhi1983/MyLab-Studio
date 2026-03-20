#!/usr/bin/env python3
"""
처방 생성 정확도 전수 테스트 — 10개 제형 × 10점 채점
"""
import urllib.request, json, time, re, sys

API = 'http://localhost:3001'

# ── 인증 ───────────────────────────────────────────────────────────────────────
def login():
    req = urllib.request.Request(
        f'{API}/api/auth/login',
        data=json.dumps({'email':'test@test.com','password':'test1234!'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST'
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())['token']

TOKEN = login()
HEADERS = {'Content-Type':'application/json', 'Authorization': f'Bearer {TOKEN}'}

# ── 테스트 케이스 ──────────────────────────────────────────────────────────────
CASES = [
    {'id':1,  'name':'산뜻한 썬크림 + spf50 ++++', 'req':'산뜻한 사용감, SPF50++, 비나노 무기자차', 'key':'선크림'},
    {'id':2,  'name':'고보습 수분크림 + 민감성 피부', 'req':'민감성 피부용, 고보습, 저자극', 'key':'크림'},
    {'id':3,  'name':'매트 립스틱 + 레드 컬러',     'req':'매트 무광, 레드 컬러, 무수(anhydrous)', 'key':'립스틱'},
    {'id':4,  'name':'커버력 쿠션 + 21호',           'req':'중고커버, 21호 베이지, W/Si 에멀전', 'key':'쿠션'},
    {'id':5,  'name':'두피케어 샴푸 + 비듬방지',    'req':'비듬방지, 두피진정, 저자극', 'key':'샴푸'},
    {'id':6,  'name':'미백 세럼 + 나이아신아마이드', 'req':'미백기능성, 나이아신아마이드 집중', 'key':'세럼'},
    {'id':7,  'name':'수분 토너 + 저자극',           'req':'수분공급, 무향, 저자극, 민감성', 'key':'토너'},
    {'id':8,  'name':'진정 마스크팩 + 시카',         'req':'시카/센텔라, 진정, 보습', 'key':'마스크팩'},
    {'id':9,  'name':'보습 바디로션 + 건성피부',     'req':'건성피부, 고보습, 논그리지', 'key':'바디로션'},
    {'id':10, 'name':'약산성 폼클렌저 + 민감성',    'req':'약산성 pH5~6, 민감성, 저자극 계면활성제', 'key':'클렌저'},
]

# ── DB 성분명 세트 (샘플링, 실제 DB 조회) ────────────────────────────────────
def load_db_incis():
    try:
        req = urllib.request.Request(
            f'{API}/api/ingredients/db?page=1&limit=200',
            headers=HEADERS
        )
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
            items = data.get('items', [])
            return set(i['inci_name'].lower() for i in items if i.get('inci_name'))
    except:
        return set()

print("DB 성분 목록 로딩...", end=' ', flush=True)
DB_INCIS = load_db_incis()
print(f"{len(DB_INCIS)}종 로드됨")

# ── 채점 함수 ──────────────────────────────────────────────────────────────────
def score_formula(case, ingredients, elapsed):
    key = case['key']
    scores = {}
    notes = []

    ings = ingredients or []
    total_pct = sum(float(i.get('percentage', 0)) for i in ings)
    n_ings = len(ings)

    def find(pattern):
        rx = re.compile(pattern, re.I)
        return [i for i in ings if rx.search(i.get('inci_name','') or i.get('name',''))]

    def find_pct(pattern):
        hits = find(pattern)
        return sum(float(h.get('percentage',0)) for h in hits)

    # ── A. 기본 정합성 (3점) ──────────────────────────────────────────────────
    # A1: 배합비 합계 100% (±2%)
    a1 = 1 if abs(total_pct - 100) <= 2 else 0
    scores['A1_합계'] = a1
    if not a1: notes.append(f'합계={total_pct:.1f}%')

    # A2: 성분 수 15~30종
    a2 = 1 if 15 <= n_ings <= 30 else 0
    scores['A2_성분수'] = a2
    if not a2: notes.append(f'성분수={n_ings}')

    # A3: Phase 구분 (A/B/C/Oil/Water 등이 존재)
    phases = set(i.get('phase','') for i in ings if i.get('phase','').strip())
    a3 = 1 if len(phases) >= 2 else 0
    scores['A3_Phase'] = a3
    if not a3: notes.append(f'Phase={phases}')

    # ── B. 전문가 가이드 준수 (4점) ───────────────────────────────────────────
    # B1: 정제수 범위
    aqua_pct = find_pct(r'aqua|water')
    if key == '선크림':   b1 = 1 if 30 <= aqua_pct <= 70 else 0
    elif key == '크림':   b1 = 1 if 55 <= aqua_pct <= 80 else 0
    elif key == '립스틱': b1 = 1 if aqua_pct == 0 else 0
    elif key == '쿠션':   b1 = 1 if 30 <= aqua_pct <= 60 else 0
    elif key == '샴푸':   b1 = 1 if 50 <= aqua_pct <= 80 else 0
    elif key == '세럼':   b1 = 1 if 60 <= aqua_pct <= 90 else 0
    elif key == '토너':   b1 = 1 if aqua_pct >= 70 else 0
    elif key == '마스크팩': b1 = 1 if 50 <= aqua_pct <= 85 else 0
    elif key == '바디로션': b1 = 1 if 55 <= aqua_pct <= 88 else 0
    elif key == '클렌저': b1 = 1 if 40 <= aqua_pct <= 75 else 0
    else:                 b1 = 1
    scores['B1_정제수'] = b1
    if not b1: notes.append(f'Aqua={aqua_pct:.1f}%')

    # B2: 필수 성분
    if key == '선크림':
        zno = find_pct(r'zinc oxide')
        tio2 = find_pct(r'titanium dioxide')
        b2 = 1 if zno >= 8 and tio2 >= 3 else 0
        if not b2: notes.append(f'ZnO={zno:.1f}% TiO2={tio2:.1f}%')
    elif key == '크림':
        has_glyc = bool(find(r'glycerin|glycerol'))
        has_cera = bool(find(r'ceramide'))
        b2 = 1 if has_glyc and has_cera else 0
        if not b2: notes.append(f'Glycerin={has_glyc} Ceramide={has_cera}')
    elif key == '립스틱':
        no_aqua = aqua_pct == 0
        has_iron = bool(find(r'iron oxide|CI 77'))
        waxes = find(r'wax|cera|candelilla|carnauba|ozokerite|paraffin|ceresin')
        b2 = 1 if no_aqua and has_iron and len(waxes) >= 2 else 0
        if not b2: notes.append(f'Aqua={aqua_pct} Iron={has_iron} Wax={len(waxes)}')
    elif key == '쿠션':
        red = bool(find(r'CI 77491|iron oxide.*red'))
        yel = bool(find(r'CI 77492|iron oxide.*yel'))
        blk = bool(find(r'CI 77499|iron oxide.*blk|iron oxide.*black'))
        mica = bool(find(r'mica'))
        b2 = 1 if (red or yel or blk) and mica else 0
        if not b2: notes.append(f'IronOxide=R{int(red)}Y{int(yel)}B{int(blk)} Mica={mica}')
    elif key == '샴푸':
        surf = bool(find(r'SLES|sodium laureth|cocoyl isethionate|SCI|lauryl|decyl glucoside'))
        bet = bool(find(r'betaine|cocamidopropyl'))
        b2 = 1 if surf and bet else 0
        if not b2: notes.append(f'Surfactant={surf} Betaine={bet}')
    elif key == '세럼':
        nia_pct = find_pct(r'niacinamide')
        b2 = 1 if 2 <= nia_pct <= 5 else 0
        if not b2: notes.append(f'Niacinamide={nia_pct:.1f}%')
    elif key == '토너':
        b2 = 1 if aqua_pct >= 70 else 0
        if not b2: notes.append(f'Aqua={aqua_pct:.1f}%<70%')
    elif key == '마스크팩':
        pan = bool(find(r'panthenol'))
        cent = bool(find(r'centella|asiaticoside|madecassoside|cica'))
        b2 = 1 if pan and cent else 0
        if not b2: notes.append(f'Panthenol={pan} Centella={cent}')
    elif key == '바디로션':
        b2 = 1 if 55 <= aqua_pct <= 88 else 0
        if not b2: notes.append(f'Aqua={aqua_pct:.1f}%')
    elif key == '클렌저':
        surf = bool(find(r'isethionate|glucoside|betaine|lauryl|sodium cocoyl'))
        b2 = 1 if surf else 0
        if not b2: notes.append(f'Surfactant={surf}')
    else:
        b2 = 0
    scores['B2_필수성분'] = b2

    # B3: 금지 성분 미포함
    tea = find(r'\bTEA\b|triethanolamine')
    paraben = find(r'paraben')
    avo_oct = find(r'avobenzone') and find(r'octinoxate|ethylhexyl methoxycinnamate')
    b3 = 1 if not tea and not paraben and not avo_oct else 0
    scores['B3_금지성분'] = b3
    if not b3:
        if tea: notes.append('TEA포함')
        if paraben: notes.append('파라벤포함')

    # B4: 방부 시스템 (페녹시에탄올, 에탄올헥사글리세린, 소르빈산 등)
    has_pres = bool(find(r'phenoxyethanol|ethylhexylglycerin|sodium benzoate|potassium sorbate|benzyl alcohol'))
    # 립스틱은 무수이므로 방부제 없어도 OK
    if key == '립스틱':
        b4 = 1
    else:
        b4 = 1 if has_pres else 0
        if not b4: notes.append('방부제없음')
    scores['B4_방부'] = b4

    # ── C. 실용성 (3점) ───────────────────────────────────────────────────────
    # C1: DB 매칭률 ≥ 50%
    if n_ings > 0:
        matched = sum(1 for i in ings
                      if (i.get('inci_name','') or '').lower() in DB_INCIS)
        match_rate = matched / n_ings
    else:
        match_rate = 0
    c1 = 1 if match_rate >= 0.5 else 0
    scores['C1_DB매칭'] = c1
    notes.append(f'DB={match_rate*100:.0f}%')

    # C2: 배합비 현실성 (최고 성분이 95% 미만, 최저가 0% 초과)
    pcts = [float(i.get('percentage',0)) for i in ings]
    c2 = 1 if pcts and max(pcts) < 95 and min(pcts) > 0 else 0
    scores['C2_현실성'] = c2
    if not c2:
        if pcts: notes.append(f'max={max(pcts):.1f}% min={min(pcts):.1f}%')

    # C3: 응답 시간 60초 이내
    c3 = 1 if elapsed <= 60 else 0
    scores['C3_응답시간'] = c3
    if not c3: notes.append(f'{elapsed:.0f}s>60s')

    total = sum(scores.values())
    return total, scores, notes

# ── API 호출 + 채점 ────────────────────────────────────────────────────────────
def run_test(case):
    body = json.dumps({
        'formula_name': case['name'],
        'requirements': case['req']
    }).encode()
    req = urllib.request.Request(
        f'{API}/api/formula/generate-idea',
        data=body, headers=HEADERS, method='POST'
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            elapsed = time.time() - t0
            data = json.loads(r.read())
    except Exception as e:
        elapsed = time.time() - t0
        print(f"  ✗ 오류: {e}")
        return None, None, elapsed, str(e)

    # 응답 구조 파악
    ings = None
    if isinstance(data, dict):
        if data.get('success') and data.get('data'):
            d = data['data']
            ings = d.get('ingredients') or d.get('formula_data', {}).get('ingredients')
        elif data.get('ingredients'):
            ings = data['ingredients']
        elif data.get('formula_data'):
            ings = data['formula_data'].get('ingredients')

    return data, ings, elapsed, None

# ── 실행 ──────────────────────────────────────────────────────────────────────
print(f"\n{'='*72}")
print(f"  처방 생성 정확도 전수 테스트  |  {len(CASES)}개 제형")
print(f"{'='*72}\n")

results = []
for case in CASES:
    print(f"[{case['id']:02d}/10] {case['name']}")
    print(f"       요청 중...", end='', flush=True)
    data, ings, elapsed, err = run_test(case)

    if err or ings is None:
        print(f" ✗ 실패 ({elapsed:.1f}s) — {err or '성분 파싱 불가'}")
        # 0점 처리
        scores = {k:0 for k in ['A1_합계','A2_성분수','A3_Phase','B1_정제수','B2_필수성분','B3_금지성분','B4_방부','C1_DB매칭','C2_현실성','C3_응답시간']}
        results.append({'case':case,'total':0,'scores':scores,'notes':[err or '파싱실패'],'elapsed':elapsed,'ings':[]})
        continue

    total, scores, notes = score_formula(case, ings, elapsed)
    print(f" ✓ {elapsed:.1f}s | {len(ings)}종 | 합계={sum(float(i.get('percentage',0)) for i in ings):.1f}% | 점수={total}/10")
    if notes:
        print(f"       ⚠ {' | '.join(notes)}")
    results.append({'case':case,'total':total,'scores':scores,'notes':notes,'elapsed':elapsed,'ings':ings})
    time.sleep(1)  # rate-limit 방지

# ── 결과 테이블 ───────────────────────────────────────────────────────────────
SCORE_KEYS = ['A1_합계','A2_성분수','A3_Phase','B1_정제수','B2_필수성분','B3_금지성분','B4_방부','C1_DB매칭','C2_현실성','C3_응답시간']
SHORT = ['A1','A2','A3','B1','B2','B3','B4','C1','C2','C3']

print(f"\n{'='*72}")
print("  스코어카드")
print(f"{'='*72}")

# 헤더
header = f"{'#':>2}  {'제형':18}  " + "  ".join(f'{s:>2}' for s in SHORT) + f"  {'합계':>4}  {'시간':>5}"
print(header)
print("-" * len(header))

totals_by_col = {k:0 for k in SCORE_KEYS}
for r in results:
    row = f"{r['case']['id']:>2}  {r['case']['name'][:18]:18}  "
    row += "  ".join(f"{'○' if r['scores'][k] else '✗':>2}" for k in SCORE_KEYS)
    row += f"  {r['total']:>4}/10  {r['elapsed']:>4.0f}s"
    print(row)
    for k in SCORE_KEYS:
        totals_by_col[k] += r['scores'][k]

print("-" * len(header))

# 컬럼별 합계
col_row = "     " + " " * 18 + "  " + "  ".join(f'{totals_by_col[k]:>2}' for k in SCORE_KEYS)
total_sum = sum(r['total'] for r in results)
avg = total_sum / len(results)
print(col_row + f"  {total_sum:>4}/{len(results)*10}  (avg)")

print(f"\n  총점: {total_sum}/{len(results)*10}  |  평균: {avg:.1f}/10")

# 순위
sorted_r = sorted(results, key=lambda x: x['total'], reverse=True)
print(f"\n  ─ 최고 제형: [{sorted_r[0]['case']['id']}] {sorted_r[0]['case']['name']}  ({sorted_r[0]['total']}/10)")
print(f"  ─ 최저 제형: [{sorted_r[-1]['case']['id']}] {sorted_r[-1]['case']['name']}  ({sorted_r[-1]['total']}/10)")

# ── 문제 항목 요약 ────────────────────────────────────────────────────────────
print(f"\n{'='*72}")
print("  항목별 통과율")
print(f"{'='*72}")
for k, short in zip(SCORE_KEYS, SHORT):
    passed = totals_by_col[k]
    bar = '█' * passed + '░' * (len(results) - passed)
    label = {'A1':'배합비 합계','A2':'성분 수','A3':'Phase 구분',
             'B1':'정제수 범위','B2':'필수성분','B3':'금지성분',
             'B4':'방부시스템','C1':'DB 매칭률','C2':'현실성','C3':'응답시간'}[short]
    print(f"  {short} {label:12}  {bar}  {passed}/{len(results)}")

print(f"\n  ─ 개선 필요 항목(50% 미만):")
weak = [(k, short, totals_by_col[k]) for k, short in zip(SCORE_KEYS, SHORT) if totals_by_col[k] < len(results)*0.5]
if weak:
    for k, short, cnt in sorted(weak, key=lambda x: x[2]):
        print(f"    · {short} {k}: {cnt}/{len(results)} ({cnt/len(results)*100:.0f}%)")
else:
    print("    · 없음 (전 항목 50% 이상 통과)")

print(f"\n{'='*72}\n")
