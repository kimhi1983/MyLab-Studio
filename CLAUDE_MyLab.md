# COCHING MyLab-Studio — Claude Code 프로젝트 가이드 (터미널 2 전담)

> **버전:** v2.0 (2026-03-20)
> **관할:** 터미널 2 전담 — 프론트엔드 + 백엔드 + AI 처방 전체
> **리포지토리:** /mnt/e/MyLab-Studio → github.com/kimhi1983/MyLab-Studio.git

## 프로젝트 개요
화장품 R&D 연구소 플랫폼. 연구원이 AI로 처방을 생성하고, 기존 처방을 검증하고, 성분 DB를 탐색하는 시스템.

## 기술 스택
- Frontend: Vue 3 + Vite (Composition API, `<script setup>`)
- Backend: Node.js (Express) — server/index.js (포트 3001)
- DB: PostgreSQL (Windows: 172.21.144.1:5432, DB: coching_db, User: postgres)
- AI: Claude Code Max (처방 생성) + Gemini API (웹 리서치, Flash=의도분석, Pro=처방생성)
- 프로세스: pm2 (mylab-api)
- 빌드: npm run build → dist/

## 주요 디렉토리
```
/mnt/e/MyLab-Studio/
├── server/
│   ├── index.js          # Express API 서버 (모든 엔드포인트)
│   ├── db.js             # PostgreSQL 연결 풀
│   ├── guides/           # 전문가 가이드 파일
│   └── .env              # DB_HOST, GEMINI_API_KEY 등
├── src/
│   ├── views/            # Vue 페이지 컴포넌트
│   │   ├── FormulaEditView.vue    # +생성 (처방 작성)
│   │   ├── IngredientDbView.vue   # 성분 DB
│   │   ├── FormulaListView.vue    # 처방 목록
│   │   ├── DashboardView.vue      # 대시보드
│   │   └── ...
│   ├── composables/
│   │   └── useAPI.js     # API 호출 함수 모음
│   ├── stores/           # Pinia 스토어
│   ├── components/       # 공통 컴포넌트 (Widget*, *Card 등)
│   ├── router/           # Vue Router
│   └── assets/           # CSS/이미지
├── dist/                 # 빌드 결과물 (pm2가 서빙)
└── scripts/              # 유틸리티 스크립트
```

## 주요 DB 테이블
```
ingredient_master       — 성분 마스터 (26,078건)
  ├── inci_name, korean_name, cas_number
  ├── ingredient_type (카테고리: 보습제/유화제/증점제 등)
  ├── function_inci (기능: Skin Conditioning Agent 등)
  ├── ph_min, ph_max, usage_level_min, usage_level_max
  └── ewg_score

regulation_cache        — 규제 데이터 (32,992건)
  ├── source (GEMINI_SAFETY_KR/EU/US/JP/CN, COSING_EU 등)
  ├── ingredient, inci_name
  └── restriction, max_concentration

purpose_ingredient_map  — 목적별 성분 매핑 (76,975건)
  ├── purpose_key (보습/미백/진정/안티에이징/자외선차단/세정/색조 등)
  ├── role (REQUIRED/RECOMMENDED/FORBIDDEN)
  └── default_pct_int, max_pct_int, reason

product_categories      — 제품 카테고리 (45건)
category_purpose_link   — 카테고리↔목적 연결
formulation_purposes    — 14개 처방 목적
compatibility_rules     — 성분 호환성 규칙 (32건)
```

## API 엔드포인트
```
GET  /api/ingredients/db          — 성분 목록 (필터/검색/페이지네이션)
GET  /api/ingredients/:id/detail  — 성분 상세 (규제+배합가이드+호환성)
POST /api/purpose-gate/detect     — 제품명 → 카테고리/목적 자동 감지
GET  /api/purpose-gate/ingredients— 목적별 성분 풀 조회
POST /api/purpose-gate/validate   — 처방 FORBIDDEN/REQUIRED 검증
POST /api/formula/generate        — AI 처방 생성
POST /api/formula/generate-idea   — 제품유형 베이스 + Gemini Flash 의도분석
```

---

## 에이전트팀 운영 규칙

### 작업 파이프라인 (5단계)

모든 코드 작업은 아래 5단계 파이프라인을 따른다:

```
[Step 1: 분석] → [Step 2: 설계] → [Step 3: 구현] → [Step 4: 검증] → [Step 5: 배포]
```

#### Step 1: 분석 (Analyzer)
- 작업 요청을 받으면 먼저 관련 파일과 DB 구조를 조사
- 현재 코드에서 수정이 필요한 부분을 정확히 식별
- 영향받는 다른 파일/API 목록 작성
- **절대 분석 없이 바로 코드 수정하지 말 것**

#### Step 2: 설계 (Architect)
- 수정 계획을 먼저 세움 (어떤 파일의 어떤 함수를 어떻게 변경)
- 기존 기능을 깨뜨리지 않는 방법 확인
- DB 스키마 변경이 필요하면 ALTER TABLE 미리 계획
- API 추가 시 기존 엔드포인트와 충돌 없는지 확인

#### Step 3: 구현 (Developer)
- 설계에 따라 코드 수정
- 서버 코드(server/index.js) 수정 시: 기존 API 동작 확인
- 프론트 코드(src/views/) 수정 시: 기존 UI 깨뜨리지 않기
- 새 API 추가 시: 기존 라우트보다 앞에 배치 (:id 파라미터 충돌 방지)

#### Step 4: 검증 (QA Validator)
- 서버 수정 후: pm2 restart mylab-api → 에러 로그 확인 (pm2 logs mylab-api --lines 20)
- API 수정 후: curl로 테스트 (최소 3개 케이스)
- 프론트 수정 후: npm run build → 빌드 에러 확인
- DB 수정 후: SELECT 쿼리로 결과 확인
- **기존 기능이 깨지지 않았는지 반드시 확인**

#### Step 5: 배포 (Deployer)
- 서버 변경 시: pm2 restart mylab-api
- 프론트 변경 시: npm run build
- 양쪽 모두 변경 시: pm2 restart → npm run build (순서 중요)
- git add + commit + push:
  ```bash
  cd /mnt/e/MyLab-Studio
  git add -A
  git commit -m "설명"
  powershell.exe -Command "cd 'E:\MyLab-Studio'; git push origin main"
  ```

---

## 절대 규칙 (Hard Rules)

### 코드 수정 규칙
1. **기존 기능을 깨뜨리지 마라** — 새 기능 추가 시 기존 API/UI가 정상 동작하는지 반드시 확인
2. **DB 컬럼 존재 확인 후 쿼리 작성** — `\d 테이블명`으로 실제 컬럼 확인 후 SELECT/WHERE 작성
3. **server/index.js에서 :id 라우트는 맨 뒤에** — /api/ingredients/search는 /api/ingredients/:id보다 앞에
4. **프론트 수정 후 반드시 npm run build** — dist/가 갱신되어야 브라우저에 반영
5. **pm2 restart 후 에러 로그 확인** — 즉시 crash 나면 pm2 logs로 확인

### DB 규칙
1. **ALTER TABLE 전 백업** — 컬럼 추가는 OK, 삭제/변경은 신중히
2. **regulation_cache 쿼리 시 source 필터 사용** — 전체 32,992건을 풀스캔하지 말 것
3. **ingredient_master의 inci_name은 ILIKE로 매칭** — 대소문자/공백 차이 대응
4. **배합비 계산은 정수 연산** — wt% × 100 → 정수로 합산 → 밸런스 역산 → 100으로 나누기

### Git 규칙
1. **작업 완료 후 항상 git commit + push**
2. **커밋 메시지는 한글로, 변경 내용 요약** — 프리픽스: feat:/fix:/style:/refactor:
3. **리포지토리: /mnt/e/MyLab-Studio → github.com/kimhi1983/MyLab-Studio.git**
4. **push 실패 시 powershell.exe로 Windows 환경에서 실행**

### 처방 생성 규칙
1. **Purpose Gate 필수 적용** — 처방 생성 전 목적 감지 → 성분 풀 제한
2. **FORBIDDEN 성분 절대 포함 금지**
3. **REQUIRED 성분 최소 2개 포함**
4. **배합비 합계 = 정확히 100.00%**
5. **밸런스(정제수)는 역산으로만 계산 — 직접 입력 금지**
6. **analyzeFormulaIntent() — Gemini Flash 1차 분석 우선, 키워드 매칭 폴백**

---

## 7-Agent 웹 개발팀

이 터미널은 프론트엔드 + 백엔드 + DB를 모두 관할한다.
각 에이전트는 전문 영역을 담당하며, 순서대로 작업하되 필요 시 이전 단계로 피드백한다.

```
[요청] → PM → Designer → Frontend → Backend → DB전문가 → QA → DevOps → [배포]
          │                                                    │
          └──────────── 불합격 시 피드백 루프 ─────────────────┘
```

### Agent 1: 🎯 PM (프로젝트 매니저)
- 요구사항 분석, 작업 분배, 우선순위 관리
- "무엇을 만들고, 왜 만들고, 어떤 기준으로 완료인지" 3가지 확인
- 모호한 요구사항은 질문으로 명확화 (추측하지 않음)

### Agent 2: 🎨 UI/UX 디자이너
- 컴포넌트 레이아웃, 색상, 간격, 애니메이션
- 상태별 UI 반드시 설계 (로딩/성공/에러/빈 상태)

**디자인 토큰:**
- Primary: #C8A96E (골드), Sub: #8b7355 (브라운)
- Background: #FAF8F5 (크림), Card: #fff, Border: #E8E0D4
- Text: #2C2C2C, Sub: #666, Muted: #999
- Success: #4CAF50, Warning: #FF9800, Danger: #F44336
- 폰트: Playfair Display (제목), Noto Sans KR (본문), JetBrains Mono (코드/숫자)
- 코너: 10px (카드), 8px (버튼/인풋), 간격: 4px 단위

### Agent 3: 💻 프론트엔드 개발자
- Vue 3 `<script setup>` + Pinia + Vue Router
- API 호출은 반드시 useAPI.js 사용 (직접 fetch 금지)
- 파일명: views/XxxView.vue, components/XxxWidget.vue, composables/useXxx.js
- 수정 후 npm run build 필수

### Agent 4: ⚙️ 백엔드 개발자
- Express API (server/index.js), DB 쿼리 최적화
- SQL 인젝션 방지: 파라미터 바인딩($1, $2) 필수
- 응답 형식: { success: true, data: ... } 또는 { error: "메시지" }
- 수정 후 pm2 restart mylab-api 필수

### Agent 5: 🗃️ DB 전문가
- 스키마 설계, 인덱스, 마이그레이션
- ALTER TABLE 전 \d로 현재 스키마 확인
- 대량 UPDATE는 배치로 (1,000건씩)

### Agent 6: 🧪 QA 테스터
- API curl 테스트 (최소 3케이스), pm2 logs 에러 확인
- npm run build 성공 필수, 콘솔 에러 0
- 기존 기능 회귀 테스트

### Agent 7: 🚀 DevOps 배포자
- 배포 순서: pm2 restart → npm run build → git commit → git push
- pm2 status로 프로세스 정상 확인

### 에이전트팀 활성화 키워드
```
"팀 모드로 작업해줘" → 7-Agent 전체 파이프라인 실행
"빠르게 수정해줘"   → 구현 + 검증 + 배포만
"설계부터 해줘"     → 분석 + 설계 먼저, 승인 후 구현
"테스트만 해줘"     → QA만 실행
```

---

## 현재 페이지 현황 (12개)
| 페이지 | 경로 | 주요 기능 |
|--------|------|----------|
| 대시보드 | /dashboard | KPI 위젯, 통계, 퀵링크 |
| 처방 목록 | /formulas | 처방 리스트, 검색, 필터 |
| 처방 편집 | /formulas/:id | AI 생성, 직접 작성, 버전 관리 |
| 프로젝트 | /projects | 프로젝트 관리, 처방 그룹핑 |
| 성분 DB | /ingredients | 26,372건 검색, 상세 모달 |
| HLB 계산기 | /hlb-calc | HLB 값 계산 (독립) |
| 품질 검증 | /validation | pH/규제/배합비 검증 |
| 처방 검증 | /verify | 8항목 검증 |
| 안정성 | /stability | 안정성 시험 기록 |
| 일지 | /journal | 실험 일지 |
| 연구 노트 | /notes | 자유 메모 |
| 관리자 | /admin | 사용자 CRUD |

---

## 자주 쓰는 명령어

```bash
# 서버 관리
pm2 restart mylab-api          # 서버 재시작
pm2 logs mylab-api --lines 30  # 로그 확인
pm2 status                     # 프로세스 상태

# 프론트 빌드
cd /mnt/e/MyLab-Studio && npm run build

# DB 접속
powershell.exe -Command "& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -U postgres -d coching_db"

# API 테스트
curl -s http://localhost:3001/api/ingredients/db?page=1&limit=5 | python3 -m json.tool
curl -s -X POST http://localhost:3001/api/purpose-gate/detect -H "Content-Type: application/json" -d '{"product_name":"보습크림"}'

# Git (배포)
cd /mnt/e/MyLab-Studio && git add -A && git commit -m "메시지"
powershell.exe -Command "cd 'E:\MyLab-Studio'; git push origin main"
```

---

## 터미널 1과의 관계

**터미널 1 = Workflows-COCHING-DB 팀** (별도 리포지토리)
- /mnt/e/COCHING-WORKFLOW → github.com/kimhi1983/Workflows-COCHING-DB.git
- n8n 워크플로우, Python 배치 스크립트, 미니PC 백업, DB 수집
- **이 리포지토리(MyLab-Studio)를 절대 수정하지 않음**

**터미널 2 = MyLab-Studio 팀** (이 파일)
- /mnt/e/MyLab-Studio → github.com/kimhi1983/MyLab-Studio.git
- 프론트엔드 + 백엔드 + 처방 AI 전부
- **Workflows-COCHING-DB 리포지토리를 절대 수정하지 않음**

→ **리포지토리 단위 분리로 git 충돌 원천 차단**
