// 결정 엔진: 질문을 카드로 만들고, 대기 시간이 지나면 1순위(자동 선택 가능한 안)를 적용한다 (F1).
// 사람은 언제든 고르기·골라 두기·직접 입력·타이머 멈춤을 할 수 있다.
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { realClock, type Clock } from './clock.ts';
import { RuleScorer, weightedScore, type Scorer } from './scorer.ts';
import type { DecisionStore } from './store.ts';
import type { Answer, Candidate, Card, DecisionRequest, ResolvedBy, Resolution, Weights } from './types.ts';

export interface EngineOptions {
  scorer: Scorer;
  weights: Weights;
  timeoutMs: number;
  /** 선택지 문구가 자동 선택 제외 대상인지(정책의 auto_select_exclude) */
  isExcluded: (text: string) => boolean;
  clock?: Clock;
  store?: DecisionStore;
  fallbackScorer?: Scorer;
  idGen?: () => string;
}

export interface EngineEvents {
  created: [Card];
  updated: [Card];
  resolved: [Resolution];
  needs_human: [Card];
}

export class EngineError extends Error {}

export class DecisionEngine extends EventEmitter<EngineEvents> {
  private readonly clock: Clock;
  private readonly fallback: Scorer;
  private timeoutMs: number;
  private cards = new Map<string, Card>();
  private timers = new Map<string, unknown>();
  private waiters = new Map<string, ((r: Resolution) => void)[]>();

  private readonly o: EngineOptions;

  constructor(o: EngineOptions) {
    super();
    this.o = o;
    this.clock = o.clock ?? realClock;
    this.fallback = o.fallbackScorer ?? new RuleScorer();
    this.timeoutMs = o.timeoutMs;
  }

  get currentTimeoutMs(): number { return this.timeoutMs; }

  private newId(): string { return this.o.idGen ? this.o.idGen() : `dc_${randomUUID().slice(0, 8)}`; }

  private async buildCandidates(req: DecisionRequest): Promise<{ candidates: Candidate[]; scoredBy: Card['scoredBy'] }> {
    const autoOk = (label: string, description?: string, flag?: boolean) =>
      req.level === 'wait' && flag !== false && !this.o.isExcluded(`${label} ${description ?? ''}`);
    if (req.fixed) {
      const c = req.fixed.map((f) => ({ ...f, autoSelectable: autoOk(f.label, f.description, f.autoSelectable) }));
      return { candidates: this.rank(c), scoredBy: 'fixed' };
    }
    const input = { question: req.question, header: req.header, options: req.options, context: req.context ?? {}, allowPropose: !!req.allowPropose && req.options.length < 3 };
    let scoredBy: Card['scoredBy'] = 'model';
    let result;
    try {
      result = await this.o.scorer.score(input);
    } catch {
      scoredBy = 'rule';
      result = await this.fallback.score(input);
    }
    // 원래 선택지가 빠지면 규칙 점수로 채운다. 원래 선택지에 없는 라벨은 제안으로만 허용.
    const byLabel = new Map(result.options.map((s) => [s.label, s]));
    const fallback = await this.fallback.score(input);
    const merged = req.options.map((o, i) => byLabel.get(o.label) ?? fallback.options[i]);
    const proposals = input.allowPropose ? result.options.filter((s) => s.proposed && !req.options.some((o) => o.label === s.label)).slice(0, 1) : [];
    const candidates = [...merged, ...proposals].map((s) => ({
      label: s.label, description: s.description, breakdown: s.breakdown, reason: s.reason, proposed: s.proposed || undefined,
      score: weightedScore(s.breakdown, this.o.weights), autoSelectable: autoOk(s.label, s.description),
    }));
    return { candidates: this.rank(candidates), scoredBy };
  }

  private rank(c: Candidate[]): Candidate[] {
    return c.map((x, i) => ({ x, i })).sort((a, b) => b.x.score - a.x.score || a.i - b.i).map((e) => e.x).slice(0, 3);
  }

  /** 카드를 만들고 바로 돌려준다. 결과는 wait(id) 또는 'resolved' 이벤트로 받는다. */
  async create(req: DecisionRequest): Promise<Card> {
    if (!req.fixed && req.options.length === 0) throw new EngineError('선택지가 없는 질문은 카드로 만들 수 없습니다.');
    const { candidates, scoredBy } = await this.buildCandidates(req);
    const now = this.clock.now();
    const card: Card = {
      id: this.newId(), jobId: req.jobId ?? null, source: req.source, header: req.header, question: req.question,
      candidates, level: req.level, status: 'pending', preselected: null, resolvedBy: null, answer: null,
      createdAt: now, deadlineAt: req.level === 'wait' ? now + this.timeoutMs : null, pausedMs: 0, pausedAt: null, resolvedAt: null, scoredBy,
    };
    this.cards.set(card.id, card);
    this.o.store?.save(card);
    this.schedule(card);
    this.emit('created', structuredClone(card));
    if (card.level === 'human') this.emit('needs_human', structuredClone(card));
    return structuredClone(card);
  }

  /** 카드를 만들고 결정될 때까지 기다린다. */
  async request(req: DecisionRequest): Promise<Resolution> {
    const card = await this.create(req);
    return this.wait(card.id);
  }

  wait(id: string): Promise<Resolution> {
    const c = this.cards.get(id);
    if (!c) return Promise.reject(new EngineError(`없는 카드입니다: ${id}`));
    if (c.status === 'resolved' && c.answer && c.resolvedBy) return Promise.resolve({ card: structuredClone(c), answer: c.answer, resolvedBy: c.resolvedBy });
    return new Promise((resolve) => {
      const list = this.waiters.get(id) ?? [];
      list.push(resolve);
      this.waiters.set(id, list);
    });
  }

  get(id: string): Card | undefined { const c = this.cards.get(id); return c && structuredClone(c); }
  open(): Card[] { return [...this.cards.values()].filter((c) => c.status === 'pending' || c.status === 'paused').map((c) => structuredClone(c)); }

  private must(id: string): Card {
    const c = this.cards.get(id);
    if (!c) throw new EngineError(`없는 카드입니다: ${id}`);
    if (c.status === 'resolved' || c.status === 'cancelled') throw new EngineError(`이미 끝난 카드입니다: ${id}`);
    return c;
  }

  private schedule(c: Card): void {
    const old = this.timers.get(c.id);
    if (old !== undefined) { this.clock.clearTimer(old); this.timers.delete(c.id); }
    if (c.status !== 'pending' || c.deadlineAt === null) return;
    this.timers.set(c.id, this.clock.setTimer(() => this.onDeadline(c.id), c.deadlineAt - this.clock.now()));
  }

  private onDeadline(id: string): void {
    this.timers.delete(id);
    const c = this.cards.get(id);
    if (!c || c.status !== 'pending') return;
    if (c.preselected !== null) return this.resolve(c, this.choiceAnswer(c, c.preselected), 'preselect');
    const idx = c.candidates.findIndex((x) => x.autoSelectable);
    if (idx >= 0) return this.resolve(c, this.choiceAnswer(c, idx), 'auto');
    // 자동 선택 가능한 안이 없으면 사람을 기다린다(타이머 없음).
    c.deadlineAt = null;
    this.o.store?.save(c);
    this.emit('updated', structuredClone(c));
    this.emit('needs_human', structuredClone(c));
  }

  private choiceAnswer(c: Card, index: number): Answer {
    const cand = c.candidates[index];
    if (!cand) throw new EngineError(`없는 추천안 번호입니다: ${index + 1}`);
    return { kind: 'choice', index, label: cand.label, value: cand.value };
  }

  private resolve(c: Card, answer: Answer, by: ResolvedBy): void {
    const t = this.timers.get(c.id);
    if (t !== undefined) { this.clock.clearTimer(t); this.timers.delete(c.id); }
    c.status = 'resolved';
    c.answer = answer;
    c.resolvedBy = by;
    c.resolvedAt = this.clock.now();
    this.o.store?.save(c);
    const res: Resolution = { card: structuredClone(c), answer, resolvedBy: by };
    for (const w of this.waiters.get(c.id) ?? []) w(res);
    this.waiters.delete(c.id);
    this.emit('resolved', res);
  }

  /** 사람이 지금 고른다(번호는 0부터) 또는 직접 입력한다. */
  answer(id: string, a: { index: number } | { text: string }): Resolution {
    const c = this.must(id);
    const ans: Answer = 'text' in a ? { kind: 'text', text: a.text.trim() } : this.choiceAnswer(c, a.index);
    if (ans.kind === 'text' && !ans.text) throw new EngineError('직접 입력한 답이 비어 있습니다.');
    this.resolve(c, ans, 'human');
    return { card: structuredClone(c), answer: ans, resolvedBy: 'human' };
  }

  /** 골라 두기: 마감 때 이 답을 적용한다. 사람 승인 카드는 마감이 없으므로 바로 적용한다. */
  preselect(id: string, index: number | null): Card {
    const c = this.must(id);
    if (index !== null) this.choiceAnswer(c, index);
    if (c.level === 'human' && index !== null) { this.resolve(c, this.choiceAnswer(c, index), 'human'); return structuredClone(c); }
    c.preselected = index;
    this.o.store?.save(c);
    this.emit('updated', structuredClone(c));
    return structuredClone(c);
  }

  pause(id: string): Card {
    const c = this.must(id);
    if (c.status === 'paused') return structuredClone(c);
    c.status = 'paused';
    c.pausedAt = this.clock.now();
    this.schedule(c);
    this.o.store?.save(c);
    this.emit('updated', structuredClone(c));
    return structuredClone(c);
  }

  resume(id: string): Card {
    const c = this.must(id);
    if (c.status !== 'paused') return structuredClone(c);
    const pausedFor = this.clock.now() - (c.pausedAt ?? this.clock.now());
    c.pausedMs += pausedFor;
    c.pausedAt = null;
    c.status = 'pending';
    if (c.deadlineAt !== null) c.deadlineAt = c.createdAt + this.timeoutMs + c.pausedMs;
    this.schedule(c);
    this.o.store?.save(c);
    this.emit('updated', structuredClone(c));
    return structuredClone(c);
  }

  /** 대기 시간 변경: 이미 떠 있는 카드의 마감도 다시 계산한다 (F1.5). */
  setTimeoutMs(ms: number): void {
    this.timeoutMs = ms;
    for (const c of this.cards.values()) {
      if (c.level !== 'wait' || (c.status !== 'pending' && c.status !== 'paused') || c.deadlineAt === null) continue;
      c.deadlineAt = c.createdAt + ms + c.pausedMs + (c.status === 'paused' ? this.clock.now() - (c.pausedAt ?? this.clock.now()) : 0);
      this.o.store?.save(c);
      this.schedule(c);
      this.emit('updated', structuredClone(c));
    }
  }

  cancel(id: string): void {
    const c = this.cards.get(id);
    if (!c || c.status === 'resolved' || c.status === 'cancelled') return;
    const t = this.timers.get(id);
    if (t !== undefined) { this.clock.clearTimer(t); this.timers.delete(id); }
    c.status = 'cancelled';
    c.resolvedAt = this.clock.now();
    this.o.store?.save(c);
    this.waiters.delete(id);
    this.emit('updated', structuredClone(c));
  }

  /** 서버 재시작 후 저장된 열린 카드를 되살린다. 마감이 지난 카드는 바로 처리한다. */
  restore(): Card[] {
    if (!this.o.store) return [];
    const restored = this.o.store.loadOpen();
    for (const c of restored) {
      this.cards.set(c.id, c);
      if (c.status === 'pending' && c.deadlineAt !== null && c.deadlineAt <= this.clock.now()) this.onDeadline(c.id);
      else this.schedule(c);
    }
    return restored.map((c) => structuredClone(c));
  }
}
