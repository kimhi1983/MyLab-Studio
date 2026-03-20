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
        data = json.loads(r.read())
    ings = data.get('data', {}).get('ingredients', [])
    return ings, elapsed

TESTS = [
    ('산뜻한 썬크림 + spf50 ++++', '산뜻한 사용감, SPF50++, 비나노 무기자차'),
    ('고보습 수분크림 + 민감성 피부',  '민감성 피부용, 고보습, 저자극'),
    ('매트 립스틱 + 레드 컬러',       '매트 무광, 레드 컬러, 무수(anhydrous)'),
]

print()
for name, req in TESTS:
    print(f"▶ {name}")
    try:
        ings, elapsed = call(name, req)
    except Exception as e:
        print(f"  ✗ 실패: {e}\n")
        continue

    total = sum(float(i.get('percentage',0)) for i in ings)
    aqua_pct = sum(float(i.get('percentage',0)) for i in ings if re.search(r'aqua', i.get('inci_name',''), re.I))
    zno = sum(float(i.get('percentage',0)) for i in ings if re.search(r'zinc oxide', i.get('inci_name',''), re.I))
    tio2 = sum(float(i.get('percentage',0)) for i in ings if re.search(r'titanium dioxide', i.get('inci_name',''), re.I))
    matched = sum(1 for i in ings if i.get('db_matched'))
    match_rate = matched / len(ings) * 100 if ings else 0

    print(f"  시간: {elapsed:.1f}s  |  성분: {len(ings)}종  |  합계: {total:.2f}%")
    print(f"  Aqua: {aqua_pct:.1f}%  |  ZnO: {zno:.1f}%  |  TiO2: {tio2:.1f}%")
    print(f"  DB매칭: {matched}/{len(ings)} ({match_rate:.0f}%)")

    # 합계 검증
    status = "✅" if abs(total-100) < 0.1 else "⚠️"
    print(f"  배합비 합계: {status} {total:.2f}%")

    # DB 매칭 성분 샘플 (최대 5개)
    db_matched = [(i.get('inci_name',''), i.get('korean_name','')) for i in ings if i.get('db_matched')]
    if db_matched:
        samples = ', '.join(f"{e[0]}({e[1]})" for e in db_matched[:5])
        print(f"  DB매칭 샘플: {samples}")
    db_unmatched = [i.get('inci_name','') for i in ings if not i.get('db_matched')]
    if db_unmatched:
        print(f"  미매칭: {', '.join(db_unmatched[:5])}")
    print()
