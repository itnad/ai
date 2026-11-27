// 보고 검사: 완료 검사(F4.3), 보고 끝 글 질문(F4.4), 테스트 판정, 리뷰 지적, 민감한 변경
import { koreanRatio } from '../core/lang.ts';

export function completionCheck(text: string, o: { language: string; ranCommands: number }): string[] {
  const missing: string[] = [];
  if (!text.trim()) return ['보고 전체(마지막 보고가 비어 있음)'];
  if (o.language === 'ko' && koreanRatio(text) < 0.5) missing.push('한국어 보고(지금 보고는 대부분 한국어가 아님)');
  if (!/실행\s*방법|실행하려면|사용\s*방법|how to run|usage/i.test(text)) missing.push('"실행 방법"(사용자가 따라 할 명령)');
  if (o.ranCommands === 0) missing.push('실제 실행 확인(이번 작업에서 명령을 한 번도 실행하지 않음)');
  else if (!/실제로\s*확인|확인한\s*것|실행\s*결과|검증|verified|tested/i.test(text)) missing.push('"실제로 확인한 것"(직접 실행한 명령과 결과)');
  if (!/보류|남은\s*일|확인하지\s*못한|pending|not done/i.test(text)) missing.push('"보류 항목"(없으면 "없음"이라고 적기)');
  return missing;
}

const TAIL_RE = /(\?|？)\s*$|할까요|하시겠어요|하실래요|원하시면|원하시나요|알려\s*주(세요|시면)|말씀해\s*주|선택해\s*주|골라\s*주|진행해도\s*될까|shall i|would you like|let me know/i;

/** 마지막 문단이 사용자에게 묻는 글이면 그 문단을 돌려준다. */
export function detectTailQuestion(text: string): string | null {
  const paras = text.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const last = paras.at(-1);
  if (!last || last.startsWith('```')) return null;
  const tail = last.slice(-300);
  return TAIL_RE.test(tail) ? last : null;
}

export interface Verdicts { criteria: { name: string; pass: boolean }[]; overall: 'pass' | 'fail' | 'none' }

export function parseVerdicts(text: string): Verdicts {
  const criteria: Verdicts['criteria'] = [];
  let name = '';
  let overall: 'pass' | 'fail' | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s>*\-#|]+/, '').replace(/\*\*/g, '').trim();
    let m;
    if ((m = /^기준\s*[:：]\s*(.+)$/.exec(line))) name = m[1].trim();
    else if ((m = /^종합\s*판정\s*[:：]\s*(통과|실패)/.exec(line))) overall = m[1] === '통과' ? 'pass' : 'fail';
    else if ((m = /^판정\s*[:：]\s*(통과|실패)/.exec(line))) { criteria.push({ name: name || `기준 ${criteria.length + 1}`, pass: m[1] === '통과' }); name = ''; }
  }
  if (!criteria.length && overall === null) return { criteria, overall: 'none' };
  const anyFail = criteria.some((c) => !c.pass) || overall === 'fail';
  return { criteria, overall: anyFail ? 'fail' : 'pass' };
}

export interface Finding { severity: '높음' | '중간' | '낮음'; category: string; location: string; content: string }

export function parseFindings(text: string): Finding[] {
  const out: Finding[] = [];
  let cur: Partial<Finding> | null = null;
  const push = () => { if (cur?.severity) out.push({ severity: cur.severity, category: cur.category ?? '', location: cur.location ?? '', content: cur.content ?? '' }); };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s>*\-#|]+/, '').replace(/\*\*/g, '').trim();
    let m;
    if ((m = /^심각도\s*[:：]\s*(높음|중간|낮음)/.exec(line))) { push(); cur = { severity: m[1] as Finding['severity'] }; }
    else if (cur && (m = /^분류\s*[:：]\s*(.+)$/.exec(line))) cur.category = m[1].trim();
    else if (cur && (m = /^위치\s*[:：]\s*(.+)$/.exec(line))) cur.location = m[1].trim();
    else if (cur && (m = /^내용\s*[:：]\s*(.+)$/.exec(line))) cur.content = m[1].trim();
  }
  push();
  return out;
}

const SENSITIVE_FILES: [RegExp, string][] = [
  [/(^|\/)(package\.json|requirements[^/]*\.txt|pyproject\.toml|Cargo\.toml|go\.mod|Gemfile|pom\.xml|build\.gradle[^/]*)$/i, '의존성 목록 변경'],
  [/auth|login|session|password|secret|token|credential|permission/i, '인증·권한 관련 파일'],
];
const SENSITIVE_CONTENT: [RegExp, string][] = [
  [/\b(child_process|subprocess|exec(Sync|File)?\s*\(|spawn(Sync)?\s*\(|os\.system|Runtime\.getRuntime)/, '셸 실행'],
  [/\beval\s*\(|new Function\s*\(/, 'eval 사용'],
  [/\b(SELECT|INSERT|UPDATE|DELETE)\b[^;\n]*(\+\s*\w|\$\{|%s|f["'])/i, 'SQL 문 조립'],
  [/\b(fetch|axios|requests\.(get|post)|http\.request|urllib)\s*\(/, '외부 통신'],
  [/\b(password|secret|api[_-]?key|token)\b\s*[:=]/i, '비밀 값 처리'],
  [/\b(readFile|writeFile|createReadStream|open\s*\()[^\n]*(req\.|params|query|input)/, '사용자 입력으로 파일 경로 사용'],
];

/** 바뀐 파일 이름과 추가된 줄로 민감한 변경인지 판정한다(규칙 기반). */
export function sensitiveReasons(files: string[], diff: string): string[] {
  const reasons = new Set<string>();
  for (const f of files) for (const [re, why] of SENSITIVE_FILES) if (re.test(f)) reasons.add(why);
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  for (const [re, why] of SENSITIVE_CONTENT) if (re.test(added)) reasons.add(why);
  return [...reasons];
}

/** 보고에서 "보류 항목" 부분을 뽑는다. */
export function extractPending(text: string): string | null {
  const m = /보류\s*항목[^\n]*\n?([\s\S]*?)(\n\s*\n#|\n#{1,6}\s|$)/.exec(text);
  if (!m) return null;
  const body = (m[1] || '').trim() || (/보류\s*항목\s*[:：]\s*(.+)/.exec(text)?.[1] ?? '').trim();
  if (!body || /^([-*]\s*)?(없음|없습니다|none)(?=$|[\s.,:;)])/i.test(body)) return null;
  return body.slice(0, 1000);
}
