// 보고 끝 글 질문을 결정 카드용 질문·선택지로 바꾼다(F4.4). "여기서 마무리"는 항상 포함한다.
import { z } from 'zod';
import { runJudge, type JudgeOptions } from '../decision/judge.ts';
import type { OptionIn } from '../decision/types.ts';

export const STOP_LABEL = '여기서 마무리';
const STOP: OptionIn = { label: STOP_LABEL, description: '더 진행하지 않고 지금 상태로 작업을 끝낸다' };

export interface TailCard { question: string; options: OptionIn[] }
export interface TailConverter { convert(tail: string, request: string): Promise<TailCard> }

function withStop(c: TailCard): TailCard {
  const opts = c.options.filter((o) => o.label !== STOP_LABEL).slice(0, 2);
  return { question: c.question, options: [...opts, STOP] };
}

export class RuleTail implements TailConverter {
  async convert(tail: string): Promise<TailCard> {
    return withStop({ question: tail.slice(0, 300), options: [{ label: '제안대로 진행', description: '보고 끝에서 제안한 다음 단계를 진행한다' }] });
  }
}

const Out = z.object({ question: z.string(), options: z.array(z.object({ label: z.string(), description: z.string().optional() })).min(1).max(3) });
const SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    options: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'object', properties: { label: { type: 'string' }, description: { type: 'string' } }, required: ['label'] } },
  },
  required: ['question', 'options'],
};

export class ClaudeTail implements TailConverter {
  private readonly o: JudgeOptions;
  private readonly fallback = new RuleTail();
  constructor(o: JudgeOptions) { this.o = o; }
  async convert(tail: string, request: string): Promise<TailCard> {
    try {
      const prompt = `개발 에이전트가 보고 끝에 사용자에게 글로 물었습니다. 이것을 짧은 질문 하나와 선택지 1~2개로 바꾸세요. 선택지 label은 5단어 이내, description은 한 문장. push·배포 선택지는 만들지 않습니다. "${STOP_LABEL}" 선택지는 하네스가 따로 붙이므로 넣지 않습니다.\n\n사용자 원래 요청: ${request.slice(0, 1000)}\n\n보고 끝:\n${tail.slice(0, 2000)}`;
      const { value } = await runJudge(this.o, '당신은 글로 된 질문을 선택지 카드로 바꾸는 도우미입니다. 한국어로 JSON만 냅니다.', prompt, SCHEMA, Out);
      return withStop(value);
    } catch {
      return this.fallback.convert(tail);
    }
  }
}
