// 에이전트에게 주는 문구. 언어는 resolveLanguage 결과 하나만 쓴다(요구사항 N7).
import type { Cause } from './resume.ts';
import type { RoleName } from './roles.ts';

const LANG_NAME: Record<string, string> = { ko: '한국어', en: '영어(English)', ja: '일본어', zh: '중국어' };
export const langName = (code: string) => LANG_NAME[code] ?? code;

export interface PromptContext {
  language: string;
  rules: string[];
  history: { summary: string; pendingItems: string | null }[];
  cancelled: string[];
  env: string;
  /** 확인용 임시 파일을 대기 없이 쓸 수 있는 폴더 */
  scratch?: string;
}

export function systemAppend(role: RoleName, c: PromptContext): string {
  const lines = [
    '# newai 하네스 안에서 일합니다',
    `- 보고와 질문은 ${langName(c.language)}로 씁니다. 한자는 쓰지 않습니다. 코드·명령·파일 이름은 원문 그대로 씁니다.`,
    '- 사용자에게 선택을 물어야 하면 글로 묻지 말고 AskUserQuestion 도구를 씁니다. 보고 끝에 "~할까요?"처럼 다음 단계를 글로 제안하지 않습니다.',
    '- 사용자가 자리에 없어도 하네스가 합리적인 답을 골라 줍니다. 추천이 분명하면 묻지 말고 진행합니다.',
    '- git push, 배포, 공개, 전역 설정 변경은 하지 않습니다. 막히면 우회하지 말고 보고서의 보류 항목에 적습니다.',
  ];
  if (role === 'implementer' || role === 'debugger') {
    lines.push(
      '- 끝낼 때 보고에 다음 세 부분을 반드시 넣습니다: "실행 방법"(사용자가 따라 할 명령), "실제로 확인한 것"(직접 실행한 명령과 결과), "보류 항목"(못 한 것과 이유, 없으면 "없음").',
      '- 웹 화면을 만들었으면 서버를 띄우고 브라우저로 실제 확인합니다.',
      '- 조사가 많이 필요하면 researcher 하위 에이전트에게 맡겨 요약만 받습니다.',
    );
  }
  if (role === 'tester' || role === 'reviewer' || role === 'releaser') {
    lines.push('- 당신은 읽기 전용 역할입니다. 파일을 고치거나 커밋하지 않습니다. 확인을 위한 실행(테스트, 빌드 확인, 서버 실행, 읽기 명령)만 합니다.');
  }
  if (c.scratch) lines.push(`- 확인용 임시 파일(시험 스크립트, 스크린샷)은 이 폴더에 씁니다(대기 없이 허용, 이미 있음): ${c.scratch}`);
  if (c.rules.length) lines.push('', '# 지켜야 할 규칙', ...c.rules.map((r) => `- ${r}`));
  if (c.history.length) {
    lines.push('', '# 이 프로젝트의 이전 작업');
    for (const h of c.history) lines.push(`- ${h.summary}${h.pendingItems ? ` (보류: ${h.pendingItems})` : ''}`);
  }
  if (c.cancelled.length) lines.push('', '# 답 없이 취소된 이전 요청(참고만, 다시 하라는 뜻은 아님)', ...c.cancelled.map((r) => `- ${r}`));
  if (c.env) lines.push('', '# 이 PC의 실행 환경', c.env);
  return lines.join('\n');
}

export function testerPrompt(request: string, implReport: string): string {
  return [
    '다음 요청에 대한 구현이 끝났습니다. 독립적으로 검증하세요.',
    '', '## 사용자 요청', request,
    '', '## 구현 담당의 보고(그대로 믿지 말고 직접 확인)', implReport.slice(0, 8000),
    '', '## 할 일',
    '1. 요청에서 인수 기준 2~5개를 뽑습니다.',
    '2. 기준마다 실제로 실행해 확인합니다(테스트, 실행, 출력 확인, 웹이면 브라우저 확인).',
    '3. 파일은 고치지 않습니다.',
    '', '## 출력 형식(마지막 보고에 그대로)',
    '기준: <기준 내용>', '판정: 통과 또는 실패', '근거: <실행한 명령과 결과>',
    '(기준마다 반복)', '종합 판정: 통과 또는 실패',
  ].join('\n');
}

export function debuggerPrompt(request: string, testReport: string, implReport: string): string {
  return [
    '독립 테스트에서 실패한 기준이 있습니다. 원인을 찾아 고치고, 고친 뒤 실패한 기준을 직접 다시 확인하세요.',
    '', '## 사용자 요청', request,
    '', '## 테스트 담당 보고', testReport.slice(0, 8000),
    '', '## 처음 구현 담당 보고', implReport.slice(0, 4000),
  ].join('\n');
}

export function reviewerPrompt(diff: string, reasons: string[]): string {
  return [
    '바뀐 코드를 품질과 보안 관점에서 검토하세요. 파일은 고치지 않습니다.',
    `검토하는 이유: ${reasons.join(', ')}`,
    '', '## 점검표',
    '- 보안: 비밀 값 노출, 명령·SQL 조립(주입), 경로 조작, 입력 검증 누락, 위험한 eval·exec, 인증·권한 누락, 안전하지 않은 외부 통신, 의존성 추가',
    '- 품질: 명백한 버그, 오류 처리 누락, 경쟁 상태, 자원 누수, 요청 범위를 넘는 변경',
    '', '## 바뀐 코드', '```diff', diff.slice(0, 60000), '```',
    '', '## 출력 형식(지적마다 반복, 없으면 "지적 없음" 한 줄)',
    '심각도: 높음 또는 중간 또는 낮음', '분류: 보안 또는 품질', '위치: 파일:줄', '내용: <문제와 고치는 방법>',
  ].join('\n');
}

export function followupPrompt(missing: string[]): string {
  return `보고에 다음이 빠져 있습니다. 빠진 부분을 채우고(필요하면 실제로 실행해서) 보고를 다시 써 주세요.\n${missing.map((m) => `- ${m}`).join('\n')}`;
}

export function tailAnswerPrompt(question: string, answer: string): string {
  return `앞의 질문("${question.slice(0, 200)}")에 대한 사용자 답: ${answer}\n이 답대로 이어서 진행하세요.`;
}

export function deferredAnswerPrompt(pairs: { question: string; answer: string }[]): string {
  return `앞서 물은 질문의 답이 정해졌습니다.\n${pairs.map((p) => `- ${p.question.split('\n')[0]} → ${p.answer}`).join('\n')}\n이 답대로 이어서 진행하세요.`;
}

export function fixFindingsPrompt(findings: string): string {
  return `품질·보안 리뷰에서 다음 지적이 나왔습니다. 높음·중간 지적을 고치고, 고친 뒤 직접 확인한 결과를 보고하세요.\n${findings.slice(0, 8000)}`;
}

const CAUSE_KO: Record<Cause, string> = {
  wall_clock: '작업 시간 한도', budget: '1회 비용 한도', restart: '서버 재시작', usage_limit: '사용량 한도', network: '네트워크 오류',
};
export const causeKo = (c: Cause) => CAUSE_KO[c];

export function resumePrompt(cause: Cause): string {
  return `작업이 중단되었다가 이어집니다(원인: ${CAUSE_KO[cause]}). 지금까지 한 일과 파일 상태를 짧게 확인한 뒤, 남은 일을 이어서 진행하세요. 이미 끝난 일을 처음부터 다시 하지 마세요.`;
}
