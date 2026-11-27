// SDK의 canUseTool 콜백을 결정 엔진에 연결한다.
// AskUserQuestion → 질문마다 카드, ExitPlanMode → 계획 승인 카드, 그 외 도구 → 정책 판정 후 필요하면 권한 카드.
import type { CanUseTool, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { Policy } from '../safety/policy.ts';
import { classifyTool, describeCall } from '../safety/tool-classify.ts';
import type { DecisionEngine } from './engine.ts';
import type { Answer, Card, OptionIn, ScoreContext } from './types.ts';

export interface AdapterOptions {
  engine: DecisionEngine;
  policy: Policy;
  workdir: string;
  jobId?: string | null;
  /** hold: 답이 정해질 때까지 콜백이 기다린다. resume: 세션을 멈추고, 답이 정해지면 러너가 같은 세션을 이어 간다. */
  deliver?: 'hold' | 'resume';
  context?: () => ScoreContext;
  /** resume 방식에서 멈춘 카드들을 러너에게 알린다. */
  onDeferred?: (cards: Card[]) => void;
  /** 판정·결정을 기록한다(작업 기록용). */
  log?: (entry: { tool: string; level: string; reason: string; cardId?: string; outcome: string }) => void;
}

interface AskQuestion { question: string; header?: string; multiSelect?: boolean; options: OptionIn[] }

export function answerText(a: Answer): string {
  return a.kind === 'choice' ? a.label : a.text;
}

/** SDK의 CanUseTool보다 좁은 형식(항상 결과를 돌려줌). CanUseTool 자리에 그대로 넣을 수 있다. */
export type NewaiCanUseTool = (toolName: string, input: Record<string, unknown>, options: Parameters<CanUseTool>[2]) => Promise<PermissionResult>;

export function makeCanUseTool(o: AdapterOptions): NewaiCanUseTool {
  const deliver = o.deliver ?? 'hold';
  const ctx = () => o.context?.() ?? {};
  const log = o.log ?? (() => {});

  const deferred = (cards: Card[], what: string): PermissionResult => {
    o.onDeferred?.(cards);
    return { behavior: 'deny', interrupt: true, message: `${what}: 사용자 결정을 기다리는 중입니다(카드 ${cards.map((c) => c.id).join(', ')}). 결정되면 이 대화로 답을 알려 드립니다.` };
  };

  return async (toolName, input) => {
    if (toolName === 'AskUserQuestion') {
      const questions = (input.questions as AskQuestion[] | undefined) ?? [];
      const cards = await Promise.all(questions.map((q) => o.engine.create({
        jobId: o.jobId, source: 'ask', header: q.header, question: q.question,
        options: q.options.map((x) => ({ label: x.label, description: x.description })),
        level: 'wait', allowPropose: q.options.length < 3, context: ctx(),
      })));
      if (deliver === 'resume') return deferred(cards, '질문');
      const results = await Promise.all(cards.map((c) => o.engine.wait(c.id)));
      const answers: Record<string, string> = {};
      results.forEach((r, i) => { answers[questions[i].question] = answerText(r.answer); });
      results.forEach((r) => log({ tool: toolName, level: 'wait', reason: r.card.question, cardId: r.card.id, outcome: `${r.resolvedBy}: ${answerText(r.answer)}` }));
      return { behavior: 'allow', updatedInput: { ...input, answers } };
    }

    if (toolName === 'ExitPlanMode') {
      const plan = typeof input.plan === 'string' ? input.plan : '';
      const card = await o.engine.create({
        jobId: o.jobId, source: 'plan', header: '계획 승인', question: '이 계획대로 진행할까요?',
        options: [
          { label: '계획 승인', description: '제출된 계획대로 진행한다' },
          { label: '보완 요청', description: '범위·순서·검증 방법을 더 구체화해 다시 제출하게 한다' },
        ],
        level: 'wait', context: { ...ctx(), extra: `제출된 계획:\n${plan.slice(0, 6000)}` },
      });
      if (deliver === 'resume') return deferred([card], '계획 승인');
      const r = await o.engine.wait(card.id);
      log({ tool: toolName, level: 'wait', reason: '계획 승인', cardId: card.id, outcome: `${r.resolvedBy}: ${answerText(r.answer)}` });
      if (r.answer.kind === 'choice' && r.answer.label === '계획 승인') return { behavior: 'allow', updatedInput: input };
      const feedback = r.answer.kind === 'text' ? r.answer.text : '계획을 더 구체화해 주세요. 범위를 요청에 맞게 줄이고, 단계별 검증 방법을 넣어 다시 제출하세요.';
      return { behavior: 'deny', message: `계획 보완 요청: ${feedback}` };
    }

    const v = classifyTool(o.policy, { toolName, input, workdir: o.workdir });
    if (v.level === 'allow') { log({ tool: toolName, level: v.level, reason: v.reason, outcome: 'allow' }); return { behavior: 'allow', updatedInput: input }; }
    if (v.level === 'deny') { log({ tool: toolName, level: v.level, reason: v.reason, outcome: 'deny' }); return { behavior: 'deny', message: `newai 정책으로 거부되었습니다: ${v.reason}. 다른 방법을 찾거나 보고서의 보류 항목에 적으세요.` }; }

    const card = await o.engine.create({
      jobId: o.jobId, source: 'permission', header: v.level === 'human' ? '사람 승인' : '권한 확인',
      question: `${toolName} 실행을 허용할까요?\n${describeCall(toolName, input)}\n이유: ${v.reason}`,
      options: [], level: v.level,
      fixed: [
        { label: '허용', description: '이번 한 번 실행을 허용한다', score: 60, reason: v.level === 'wait' ? '대기 시간이 지나면 진행' : '사람 승인 필요', value: 'allow' },
        { label: '거부', description: '실행하지 않고 다른 방법을 찾게 한다', score: 40, reason: '', value: 'deny' },
      ],
    });
    if (deliver === 'resume') return deferred([card], '권한 확인');
    const r = await o.engine.wait(card.id);
    log({ tool: toolName, level: v.level, reason: v.reason, cardId: card.id, outcome: `${r.resolvedBy}: ${answerText(r.answer)}` });
    if (r.answer.kind === 'choice' && r.answer.value === 'allow') return { behavior: 'allow', updatedInput: input };
    const why = r.answer.kind === 'text' ? r.answer.text : '사용자가 허용하지 않았습니다.';
    return { behavior: 'deny', message: `실행이 거부되었습니다: ${why}` };
  };
}
