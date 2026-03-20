#!/usr/bin/env python3
import urllib.request, json, time, re

API = 'http://localhost:3001'
def login():
    req = urllib.request.Request(f'{API}/api/auth/login',
        data=json.dumps({'email':'test@test.com','password':'test1234!'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(req) as r: return json.loads(r.read())['token']

TOKEN = login()
H = {'Content-Type':'application/json', 'Authorization': f'Bearer {TOKEN}'}

def call(name, req_str=''):
    body = json.dumps({'formula_name': name, 'requirements': req_str}).encode()
    req = urllib.request.Request(f'{API}/api/formula/generate-idea', data=body, headers=H, method='POST')
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read()), time.time()-t0

TESTS = [
    ('쿠션 파운데이션 21호', '커버력, 자외선차단',
     {'has': [r'CI 77891|titanium dioxide|zinc oxide', r'CI 77491|CI 77492|CI 77499|iron oxide']}),
    ('미백 세럼', '나이아신아마이드 3% 이상, 알부틴',
     {'nia_min': 3.0, 'has': [r'niacinamide', r'arbutin|alpha.arbutin']}),
    ('진정 크림', '무향, 비건, 민감성',
     {'no': [r'^fragrance$|^parfum$', r'lanolin|beeswax|carmine']}),
    ('멀티밤', '무수 제형, 왁스 베이스',
     {'no_aqua': True}),
    ('보습크림', '임산부용, 레티놀 제외, 고보습',
     {'no': [r'^retinol$|retinyl palmitate']}),
]

print(f"\n{'='*68}")
print('  Purpose Gate 통합 테스트  |  5개 제형')
print(f"{'='*68}\n")

pass_cnt = 0
for name, req, checks in TESTS:
    print(f"▶ {name}  [{req}]")
    try:
        data, elapsed = call(name, req)
    except Exception as e:
        print(f"  ✗ 실패: {e}\n"); continue

    d = data.get('data', {})
    ings = d.get('ingredients', [])
    total = sum(float(i.get('percentage',0)) for i in ings)
    aqua = sum(float(i.get('percentage',0)) for i in ings if re.search(r'^aqua$', i.get('inci_name',''), re.I))
    score = d.get('purpose_score')
    retried = d.get('retried', False)
    violations = d.get('purpose_violations', [])

    nia = next((float(i.get('percentage',0)) for i in ings if re.search(r'niacinamide', i.get('inci_name',''), re.I)), 0)

    print(f"  {elapsed:.1f}s | {len(ings)}종 | 합계={total:.2f}% | Aqua={aqua:.1f}% | Nia={nia:.1f}% | score={score} | retried={retried}")
    if violations: print(f"  violations: {violations}")

    results = []
    if checks.get('no_aqua'):
        ok = aqua == 0
        results.append(('무수(Aqua=0%)', ok, f'{aqua:.1f}%'))
    if 'nia_min' in checks:
        ok = nia >= checks['nia_min']
        results.append((f'Nia≥{checks["nia_min"]}%', ok, f'{nia:.1f}%'))
    for pat in checks.get('has', []):
        found = next((i.get('inci_name','') for i in ings if re.search(pat, i.get('inci_name',''), re.I)), None)
        results.append((pat[:25], bool(found), found or '없음'))
    for pat in checks.get('no', []):
        found = next((i.get('inci_name','') for i in ings if re.search(pat, i.get('inci_name',''), re.I)), None)
        results.append((f'NO {pat[:20]}', not bool(found), found or '없음(OK)'))

    ok_cnt = sum(1 for _,ok,_ in results if ok)
    total_chk = len(results)
    if ok_cnt == total_chk: pass_cnt += 1

    print(f"  검증 [{ok_cnt}/{total_chk}]:", end=' ')
    for label, ok, val in results:
        print(f"{'✅' if ok else '❌'}{label}({val})", end='  ')
    print('\n')

print(f"{'='*68}")
print(f"  최종: {pass_cnt}/5 통과")
print(f"{'='*68}\n")
