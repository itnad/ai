// 판단 모델: 빈 중립 폴더에서, 설정·메모리·도구 없이 선택지를 점수화한다 (요구사항 N6).
import { z } from 'zod';
import { clamp10, type Scorer, type ScoreInput, type ScoreResult } from './scorer.ts';
import { runJudge, type JudgeOptions } from './judge.ts';
import { CRITERIA, CRITERIA_KO } from './types.ts';

const OutSchema = z.object({
  options: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
    proposed: z.boolean().optional(),
    breakdown: z.object(Object.fromEntries(CRITERIA.map((k) => [k, z.number()])) as Record<(typeof CRITERIA)[number], z.ZodNumber>),
    reason: z.string(),
  })),
});

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          proposed: { type: 'boolean' },
          breakdown: { type: 'object', properties: Object.fromEntries(CRITERIA.map((k) => [k, { type: 'number', minimum: 0, maximum: 10 }])), required: [...CRITERIA] },
          reason: { type: 'string' },
        },
        required: ['label', 'breakdown', 'reason'],
      },
    },
  },
  required: ['options'],
};

const SYSTEM = '당신은 개발 작업 중 생긴 선택지를 점수화하는 판단 도우미입니다. 주어진 정보만으로 판단하고, 파일을 읽거나 도구를 쓰지 않습니다. 결과는 지정된 JSON 형식으로만 냅니다.';

export function buildScorerPrompt(input: ScoreInput): string {
  const c = input.context;
  const lang = c.language ?? 'ko';
  const lines = [
    `## 질문${input.header ? ` (${input.header})` : ''}`,
    input.question,
    '',
    '## 선택지',
    ...input.options.map((o, i) => `${i + 1}. ${o.label}${o.description ? ` - ${o.description}` : ''}`),
    '',
    '## 맥락',
    c.request ? `사용자 요청: ${c.request}` : '',
    c.project ? `프로젝트: ${c.project}` : '',
    c.rules?.length ? `지켜야 할 규칙:\n${c.rules.map((r) => `- ${r}`).join('\n')}` : '',
    c.env ? `실행 환경:\n${c.env}` : '',
    c.extra ?? '',
    '',
    '## 점수 기준(각 0~10점)',
    ...CRITERIA.map((k) => `- ${k}: ${CRITERIA_KO[k]}`),
    '- 요청 범위를 넘는 기능을 만드는 선택지는 scope 점수를 낮게 준다.',
    '- push, 배포, 공개, 되돌리기 어려운 선택지는 reversible 점수를 낮게 준다.',
    '',
    '## 출력',
    `- 모든 선택지를 label 그대로 포함하고, reason은 ${lang === 'ko' ? '한국어' : lang} 한 문장으로 쓴다.`,
    input.allowPropose
      ? '- 선택지가 부족하면, 더 나은 안 하나를 proposed: true로 추가할 수 있다(push·배포 안은 제안하지 않는다).'
      : '- 새 선택지를 추가하지 않는다.',
  ];
  return lines.filter((l) => l !== '').join('\n');
}

export type ClaudeScorerOptions = JudgeOptions;

export class ClaudeScorer implements Scorer {
  private readonly o: ClaudeScorerOptions;
  lastCostUsd = 0;
  constructor(o: ClaudeScorerOptions) { this.o = o; }

  async score(input: ScoreInput): Promise<ScoreResult> {
    const { value, costUsd } = await runJudge(this.o, SYSTEM, buildScorerPrompt(input), JSON_SCHEMA, OutSchema);
    this.lastCostUsd = costUsd;
    return {
      options: value.options.map((x) => ({
        label: x.label, description: x.description, proposed: x.proposed, reason: x.reason,
        breakdown: Object.fromEntries(CRITERIA.map((k) => [k, clamp10(x.breakdown[k])])) as ScoreResult['options'][number]['breakdown'],
      })),
    };
  }
}
