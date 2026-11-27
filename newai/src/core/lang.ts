// 보고 언어 우선순위: 사용자가 요청에 명시 > 프로젝트 설정 > 전역 설정 > 한국어 (요구사항 N7).
// 완료 검사와 판단 모델은 반드시 이 함수의 결과 하나만 쓴다.
export function resolveLanguage(o: { explicit?: string | null; project?: string | null; config?: string | null }): string {
  return o.explicit || o.project || o.config || 'ko';
}

const EXPLICIT: [RegExp, string][] = [
  [/(영어로|영문으로|\bin english\b|\benglish please\b)/i, 'en'],
  [/(한국어로|한글로|\bin korean\b)/i, 'ko'],
  [/(일본어로|\bin japanese\b)/i, 'ja'],
  [/(중국어로|\bin chinese\b)/i, 'zh'],
];

/** 요청 문장에 언어 지정이 있으면 그 언어 코드를, 없으면 null. */
export function detectExplicitLanguage(text: string): string | null {
  for (const [re, code] of EXPLICIT) if (re.test(text)) return code;
  return null;
}

/** 코드 블록과 인라인 코드를 뺀 본문에서 한글 글자 비율(한글 / (한글 + 라틴 문자)). */
export function koreanRatio(text: string): number {
  const body = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  const hangul = (body.match(/[가-힣]/g) ?? []).length;
  const latin = (body.match(/[A-Za-z]/g) ?? []).length;
  return hangul + latin === 0 ? 0 : hangul / (hangul + latin);
}
