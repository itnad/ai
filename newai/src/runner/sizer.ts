// 작업 크기 판정(작음·보통·큼). 판단 모델이 실패하면 규칙으로 정한다.
import fs from 'node:fs';
import { z } from 'zod';
import { runJudge, type JudgeOptions } from '../decision/judge.ts';

export type Size = 'small' | 'medium' | 'large';
export interface SizeInput { request: string; kind: string; projectFiles: number }
export interface SizeResult { size: Size; reason: string; by: 'model' | 'rule' }
export interface Sizer { size(i: SizeInput): Promise<SizeResult> }

const SMALL = /(문구|오타|글자|색(상|깔)?|이름\s*(을|를)?\s*바꿔|한\s*줄|간단히|버튼\s*텍스트|typo|rename|README)/i;

export class RuleSizer implements Sizer {
  async size(i: SizeInput): Promise<SizeResult> {
    if (i.kind === 'pipeline') return { size: 'large', reason: '/p 파이프라인 요청', by: 'rule' };
    if (i.projectFiles === 0) return { size: 'large', reason: '빈 프로젝트에서 새로 만드는 작업', by: 'rule' };
    if (i.request.length <= 120 && SMALL.test(i.request)) return { size: 'small', reason: '짧은 수정 요청', by: 'rule' };
    return { size: 'medium', reason: '일반 기능 요청', by: 'rule' };
  }
}

const Out = z.object({ size: z.enum(['small', 'medium', 'large']), reason: z.string() });
const SCHEMA = { type: 'object', properties: { size: { type: 'string', enum: ['small', 'medium', 'large'] }, reason: { type: 'string' } }, required: ['size', 'reason'] };

export class ClaudeSizer implements Sizer {
  private readonly o: JudgeOptions;
  private readonly fallback = new RuleSizer();
  constructor(o: JudgeOptions) { this.o = o; }
  async size(i: SizeInput): Promise<SizeResult> {
    if (i.kind === 'pipeline' || i.projectFiles === 0) return this.fallback.size(i);
    try {
      const prompt = `다음 개발 요청의 작업 크기를 정하세요.\n- small: 문구·스타일·한두 줄 수정처럼 파일 1~2개, 금방 끝남\n- medium: 기능·화면 하나 추가처럼 여러 파일\n- large: 새 프로그램, 구조 변경, 여러 기능\n\n프로젝트 파일 수: ${i.projectFiles}\n요청: ${i.request}\n\nreason은 한국어 한 문장.`;
      const { value } = await runJudge(this.o, '당신은 개발 작업 크기를 분류하는 도우미입니다. 주어진 정보만으로 JSON으로 답합니다.', prompt, SCHEMA, Out);
      return { ...value, by: 'model' };
    } catch {
      return this.fallback.size(i);
    }
  }
}

/** .git, node_modules를 뺀 파일 수(최대 limit까지만 셈) */
export function countProjectFiles(dir: string, limit = 500): number {
  let n = 0;
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (n >= limit) return;
      if (e.name === '.git' || e.name === 'node_modules') continue;
      if (e.isDirectory()) walk(`${d}/${e.name}`); else n++;
    }
  };
  walk(dir);
  return n;
}
