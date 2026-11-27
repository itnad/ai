// 판단 모델: 빈 중립 폴더에서, 설정·메모리·도구 없이 선택지를 점수화한다 (요구사항 N6).
import fs from 'node:fs';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { clamp10, type Scorer, type ScoreInput, type ScoreResult } from './scorer.ts';
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

export interface ClaudeScorerOptions { model: string; sandboxDir: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }

export class ClaudeScorer implements Scorer {
  private readonly o: ClaudeScorerOptions;
  lastCostUsd = 0;
  constructor(o: ClaudeScorerOptions) { this.o = o; }

  async score(input: ScoreInput): Promise<ScoreResult> {
    fs.mkdirSync(this.o.sandboxDir, { recursive: true });
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.o.timeoutMs ?? 90_000);
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.o.env ?? process.env)) if (v !== undefined) env[k] = v;
    env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
    const options: Options = {
      cwd: this.o.sandboxDir, settingSources: [], tools: [], model: this.o.model, maxTurns: 3,
      systemPrompt: SYSTEM, persistSession: false, env, abortController: abort,
      outputFormat: { type: 'json_schema', schema: JSON_SCHEMA },
    };
    try {
      for await (const m of query({ prompt: buildScorerPrompt(input), options })) {
        if (m.type !== 'result') continue;
        this.lastCostUsd = m.total_cost_usd;
        if (m.subtype !== 'success') throw new Error(`판단 모델 실패: ${m.subtype}`);
        const parsed = OutSchema.parse(m.structured_output ?? JSON.parse(m.result));
        return {
          options: parsed.options.map((x) => ({
            label: x.label, description: x.description, proposed: x.proposed, reason: x.reason,
            breakdown: Object.fromEntries(CRITERIA.map((k) => [k, clamp10(x.breakdown[k])])) as ScoreResult['options'][number]['breakdown'],
          })),
        };
      }
      throw new Error('판단 모델이 결과를 내지 않았습니다.');
    } finally {
      clearTimeout(timer);
    }
  }
}
