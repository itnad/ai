// 세션 실행기: 실제 SDK(SdkDriver)와 시험용 각본(FakeDriver)을 같은 형식으로 다룬다.
import { query, type AgentDefinition, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { NewaiCanUseTool } from '../decision/adapters.ts';
import type { RoleName } from './roles.ts';

export interface DriverEvent { role: RoleName; type: 'init' | 'tool_use' | 'text' | 'rate_limit' | 'result'; sessionId?: string; name?: string; input?: unknown; text?: string }

export interface TurnRequest {
  role: RoleName;
  prompt: string;
  resume?: string | null;
  cwd: string;
  model: string;
  systemAppend: string;
  tools?: string[];
  agents?: Record<string, AgentDefinition>;
  maxTurns?: number;
  maxBudgetUsd?: number;
  canUseTool: NewaiCanUseTool;
  hooks?: Options['hooks'];
  env: Record<string, string>;
  signal: AbortSignal;
  onEvent: (e: DriverEvent) => void;
}

export type TurnOutcome = 'success' | 'budget' | 'max_turns' | 'error' | 'aborted';

export interface TurnResult {
  sessionId: string | null;
  outcome: TurnOutcome;
  text: string;
  /** SDK가 주는 값 그대로(이어진 세션은 누적 합계). 기록은 cost.ts가 차이로 한다. */
  totalCostUsd: number;
  errors: string[];
  /** 응답 오류 유형(rate_limit, overloaded, server_error 등) */
  apiError?: string;
  /** 사용량 한도 재설정 시각(ms) */
  resetsAt?: number | null;
  toolUses: string[];
}

export interface SessionDriver { run(req: TurnRequest): Promise<TurnResult> }

const toMs = (n: number) => (n < 1e12 ? n * 1000 : n);

export class SdkDriver implements SessionDriver {
  async run(req: TurnRequest): Promise<TurnResult> {
    const abort = new AbortController();
    const onAbort = () => abort.abort();
    req.signal.addEventListener('abort', onAbort);
    const r: TurnResult = { sessionId: req.resume ?? null, outcome: 'error', text: '', totalCostUsd: 0, errors: [], toolUses: [] };
    const options: Options = {
      cwd: req.cwd, model: req.model, resume: req.resume ?? undefined, settingSources: ['project'], permissionMode: 'default',
      systemPrompt: { type: 'preset', preset: 'claude_code', append: req.systemAppend },
      tools: req.tools, agents: req.agents, maxTurns: req.maxTurns, maxBudgetUsd: req.maxBudgetUsd,
      canUseTool: req.canUseTool, hooks: req.hooks, env: req.env, abortController: abort,
    };
    let gotResult = false;
    try {
      for await (const m of query({ prompt: req.prompt, options })) {
        if ('session_id' in m && typeof m.session_id === 'string' && m.session_id) r.sessionId = m.session_id;
        if (m.type === 'system' && m.subtype === 'init') req.onEvent({ role: req.role, type: 'init', sessionId: m.session_id });
        if (m.type === 'rate_limit_event') {
          const info = m.rate_limit_info;
          if (info.status === 'rejected' && info.resetsAt) r.resetsAt = toMs(info.resetsAt);
          req.onEvent({ role: req.role, type: 'rate_limit', text: `${info.status} ${info.rateLimitType ?? ''}` });
        }
        if (m.type === 'assistant') {
          if (m.error) r.apiError = m.error;
          for (const b of m.message.content) {
            if (b.type === 'tool_use') { r.toolUses.push(b.name); req.onEvent({ role: req.role, type: 'tool_use', name: b.name, input: b.input }); }
            if (b.type === 'text' && b.text.trim()) req.onEvent({ role: req.role, type: 'text', text: b.text });
          }
        }
        if (m.type === 'result') {
          gotResult = true;
          r.totalCostUsd = m.total_cost_usd;
          if (m.subtype === 'success') { r.outcome = 'success'; r.text = m.result; }
          else {
            r.outcome = m.subtype === 'error_max_budget_usd' ? 'budget' : m.subtype === 'error_max_turns' ? 'max_turns' : 'error';
            r.errors = m.errors ?? [];
          }
          req.onEvent({ role: req.role, type: 'result', text: r.outcome });
        }
      }
    } catch (e) {
      r.errors.push((e as Error).message ?? String(e));
      if (abort.signal.aborted) r.outcome = 'aborted';
      else if (!gotResult) r.outcome = 'error';
    } finally {
      req.signal.removeEventListener('abort', onAbort);
    }
    if (!gotResult && abort.signal.aborted) r.outcome = 'aborted';
    return r;
  }
}

export type FakeStep = (req: TurnRequest, call: number) => Partial<TurnResult> | Promise<Partial<TurnResult>>;

/** 시험용: 미리 정한 각본대로 결과를 낸다. 세션 ID는 역할별로 s1, s2...를 매기고 resume이면 그대로 쓴다. */
export class FakeDriver implements SessionDriver {
  requests: TurnRequest[] = [];
  private n = 0;
  private readonly steps: FakeStep[];
  constructor(steps: FakeStep[]) { this.steps = steps; }
  async run(req: TurnRequest): Promise<TurnResult> {
    this.requests.push(req);
    const call = this.requests.length - 1;
    const step = this.steps[call];
    if (!step) throw new Error(`각본에 없는 호출입니다(${call + 1}번째, 역할 ${req.role})`);
    const sessionId = req.resume ?? `s${++this.n}`;
    req.onEvent({ role: req.role, type: 'init', sessionId });
    const part = await step(req, call);
    const r: TurnResult = { sessionId, outcome: 'success', text: '', totalCostUsd: 0, errors: [], toolUses: [], ...part };
    for (const t of r.toolUses) req.onEvent({ role: req.role, type: 'tool_use', name: t });
    return r;
  }
}

/** 시험용: 중단 신호가 올 때까지 기다렸다가 aborted로 끝나는 단계 */
export function untilAborted(extra: Partial<TurnResult> = {}): FakeStep {
  return (req) => new Promise((resolve) => {
    if (req.signal.aborted) return resolve({ outcome: 'aborted', ...extra });
    req.signal.addEventListener('abort', () => resolve({ outcome: 'aborted', ...extra }), { once: true });
  });
}
