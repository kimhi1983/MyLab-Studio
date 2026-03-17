/**
 * 규제 소스명 → 사용자 표시 레이블 변환
 * 기술 명칭(Gemini, Qwen, LLM 등)을 화면에 노출하지 않도록 처리
 */

const SOURCE_MAP = {
  // 규제 데이터 (지역별)
  MFDS_SEED: '한국', GEMINI_KR: '한국', KR: '한국',
  GEMINI_EU: '유럽', EU: '유럽',
  GEMINI_US: '미국', FDA_SEED: '미국', REG_MONITOR_US: '미국', US: '미국',
  GEMINI_JP: '일본', JP: '일본',
  GEMINI_CN: '중국', CN: '중국',
  GEMINI_ASEAN: '아세안',
  GEMINI_SAFETY: '안전성', INI_SAFETY: '안전성',
  // 안전성 평가 데이터 (워크플로우팀 신규 — EWG/CIR 기반)
  GEMINI_SAFETY_KR: '한국', GEMINI_SAFETY_EU: '유럽',
  GEMINI_SAFETY_US: '미국', GEMINI_SAFETY_JP: '일본',
  GEMINI_SAFETY_CN: '중국', GEMINI_SAFETY_ASEAN: '아세안',
}

// 화면에 노출하면 안 되는 기술 명칭 패턴
const HIDDEN_PATTERN = /gemini|qwen|llm|openai|claude|chatgpt|gpt/i

// 완전히 숨겨야 하는 소스 (데이터 행 자체 제외)
export const HIDDEN_SOURCES = [
  'coching_legacy', 'gem2_kb', 'gemini_kb', 'UNKNOWN', 'REG_MONITOR_ERROR',
  'REG_MONITOR_US', 'REG_MONITOR_KR',  // 내부 배치용 미정제 데이터
]

/**
 * 소스 코드 → 사용자 레이블 (기술 명칭 노출 없음)
 */
export function mapRegulationSource(src) {
  if (!src) return '기타'
  if (HIDDEN_PATTERN.test(src)) return SOURCE_MAP[src] || '기타'
  return SOURCE_MAP[src] || src
}

/**
 * 해당 소스의 데이터 행을 표시해도 되는지 여부
 */
export function isVisibleSource(src) {
  if (!src) return false
  if (HIDDEN_SOURCES.includes(src)) return false
  return true
}
