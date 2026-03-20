#!/usr/bin/env python3
import urllib.request, json, time, re

API = 'http://localhost:3001'

def login():
    req = urllib.request.Request(
        f'{API}/api/auth/login',
        data=json.dumps({'email':'test@test.com','password':'test1234!'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST'
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())['token']

TOKEN = login()
H = {'Content-Type':'application/json', 'Authorization': f'Bearer {TOKEN}'}

def call(name, req_str=''):
    body = json.dumps({'formula_name': name, 'requirements': req_str}).encode()
    req = urllib.request.Request(f'{API}/api/formula/generate-idea', data=body, headers=H, method='POST')
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=210) as r:
        elapsed = time.time() - t0
        return json.loads(r.read()), elapsed

TESTS = [
    ('주름개선 멀티밤 + 미백기능 추가', '무수 제형, 왁스 베이스, 주름+미백 기능성'),
    ('산뜻한 썬크림 + spf50 ++++',      '산뜻한 사용감, SPF50++, 비나노 무기자차'),
    ('촉촉 선세럼 + 민감성',             '세럼 텍스처, UV 차단, 진정'),
    ('PDRN 앰플 + 재생',                 '피부 재생, 고기능 세럼'),
    ('두피 쿨링 토닉 + 탈모방지',        '두피 진정, 멘톨 쿨링, 탈모 예방'),
]

CHECKS = {
    '주름개선 멀티밤 + 미백기능 추가': {
        'no_aqua': True,
        'has': [r'niacinamide|arbutin', r'adenosine|retinol|peptide|palmitoyl'],
        'label': '무수+주름+미백'
    },
    '산뜻한 썬크림 + spf50 ++++': {
        'zno_min': 8, 'tio2_min': 3, 'label': 'ZnO≥8% TiO2≥3%'
    },
    '촉촉 선세럼 + 민감성': {
        'has': [r'zinc oxide|titanium dioxide', r'centella|panthenol|allantoin'],
        'label': 'UV차단+진정'
    },
    'PDRN 앰플 + 재생': {
        'has': [r'pdrn|hydrolyzed dna|salmon dna'],
        'label': 'PDRN 포함'
    },
    '두피 쿨링 토닉 + 탈모방지': {
        'has': [r'menthol|peppermint', r'biotin|capixyl|caffeine|adenosine'],
        'label': '멘톨+탈모방지'
    },
}

print(f"\n{'='*68}")
print('  처방 의도 분석 테스트  |  5개 제형')
print(f"{'='*68}\n")

for name, req in TESTS:
    print(f"▶ {name}")
    print(f"  요청: {req}")
    try:
        data, elapsed = call(name, req)
    except Exception as e:
        print(f"  ✗ 실패: {e}\n"); continue

    ings = data.get('data', {}).get('ingredients', [])
    total = sum(float(i.get('percentage',0)) for i in ings)
    aqua = sum(float(i.get('percentage',0)) for i in ings if re.search(r'^aqua$', i.get('inci_name',''), re.I))
    zno = sum(float(i.get('percentage',0)) for i in ings if re.search(r'zinc oxide', i.get('inci_name',''), re.I))
    tio2 = sum(float(i.get('percentage',0)) for i in ings if re.search(r'titanium dioxide', i.get('inci_name',''), re.I))

    print(f"  시간: {elapsed:.1f}s  |  성분: {len(ings)}종  |  합계: {total:.2f}%  |  Aqua: {aqua:.1f}%  |  ZnO: {zno:.1f}%  |  TiO2: {tio2:.1f}%")

    chk = CHECKS.get(name, {})
    results = []

    if chk.get('no_aqua'):
        ok = aqua == 0
        results.append(('무수(Aqua=0%)', ok, f'Aqua={aqua:.1f}%'))

    if 'zno_min' in chk:
        ok = zno >= chk['zno_min']
        results.append((f'ZnO≥{chk["zno_min"]}%', ok, f'{zno:.1f}%'))
    if 'tio2_min' in chk:
        ok = tio2 >= chk['tio2_min']
        results.append((f'TiO2≥{chk["tio2_min"]}%', ok, f'{tio2:.1f}%'))

    for pattern in chk.get('has', []):
        found = next((i.get('inci_name','') for i in ings if re.search(pattern, i.get('inci_name',''), re.I)), None)
        ok = found is not None
        results.append((pattern[:30], ok, found or '없음'))

    ok_count = sum(1 for _, ok, _ in results if ok)
    total_checks = len(results)
    print(f"  검증 [{ok_count}/{total_checks}]:", end=' ')
    for label, ok, val in results:
        icon = '✅' if ok else '❌'
        print(f"{icon}{label}({val})", end='  ')
    print()

    # 주요 성분 출력
    top5 = sorted(ings, key=lambda i: float(i.get('percentage',0)), reverse=True)[:5]
    tops = ', '.join(f"{i.get('inci_name','?')}({float(i.get('percentage',0)):.1f}%)" for i in top5)
    print(f"  주요5: {tops}")
    print()

print(f"{'='*68}\n")
