// 추천안 점수화. 판단 모델(ClaudeScorer)이 실패하면 규칙 점수(RuleScorer)로 대체한다.
import { CRITERIA, type Breakdown, type OptionIn, type ScoreContext, type Weights } from './types.ts';

export interface ScoreInput {
  question: string;
  header?: string;
  options: OptionIn[];
  context: ScoreContext;
  allowPropose: boolean;
}

export interface ScoredOption { label: string; description?: string; breakdown: Breakdown; reason: string; proposed?: boolean }
export interface ScoreResult { options: ScoredOption[] }

export interface Scorer { score(input: ScoreInput): Promise<ScoreResult> }

export function clamp10(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(10, v));
}

/** 기준별 0~10점을 가중치로 합쳐 0~100점으로 */
export function weightedScore(b: Breakdown, w: Weights): number {
  let sum = 0;
  let wsum = 0;
  for (const k of CRITERIA) { sum += clamp10(b[k]) * w[k]; wsum += w[k]; }
  return wsum === 0 ? 0 : Math.round((sum / wsum) * 10);
}

const flat = (n: number): Breakdown => ({ goal: n, reversible: n, scope: n, env: n, rules: n, cost: n });

/** 판단 모델 없이: 원래 선택지 순서를 존중(앞쪽일수록 높게). */
export class RuleScorer implements Scorer {
  async score(input: ScoreInput): Promise<ScoreResult> {
    return {
      options: input.options.map((o, i) => ({
        label: o.label, description: o.description, breakdown: flat(Math.max(1, 7 - i)),
        reason: '판단 모델 없이 원래 선택지 순서로 점수를 매김',
      })),
    };
  }
}

/** 시험용: 라벨별 점수를 미리 정해 둔다. 없으면 순서대로 8, 6, 4... */
export class FakeScorer implements Scorer {
  calls: ScoreInput[] = [];
  private readonly table: Record<string, number>;
  private readonly propose?: OptionIn;
  private readonly fail: boolean;
  constructor(table: Record<string, number> = {}, propose?: OptionIn, fail = false) {
    this.table = table;
    this.propose = propose;
    this.fail = fail;
  }
  async score(input: ScoreInput): Promise<ScoreResult> {
    this.calls.push(input);
    if (this.fail) throw new Error('가짜 판단 모델 실패');
    const options: ScoredOption[] = input.options.map((o, i) => ({
      label: o.label, description: o.description, breakdown: flat(this.table[o.label] ?? Math.max(0, 8 - i * 2)), reason: `가짜 점수(${o.label})`,
    }));
    if (this.propose && input.allowPropose) options.push({ ...this.propose, breakdown: flat(this.table[this.propose.label] ?? 5), reason: '가짜 제안', proposed: true });
    return { options };
  }
}
