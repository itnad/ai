// 결정 카드를 SQLite에 저장해 서버를 재시작해도 이어지게 한다.
import type { DatabaseSync } from 'node:sqlite';
import type { Card } from './types.ts';

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const ms = (s: unknown) => (typeof s === 'string' ? Date.parse(s) : null);

export interface DecisionStore {
  save(card: Card): void;
  loadOpen(): Card[];
  get(id: string): Card | null;
}

export class SqliteDecisionStore implements DecisionStore {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }

  save(c: Card): void {
    this.db.prepare(`INSERT INTO decisions (id, job_id, source, question, candidates, policy_level, status, preselected, resolved_by, answer, created_at, deadline_at, paused_ms, paused_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, preselected=excluded.preselected, resolved_by=excluded.resolved_by, answer=excluded.answer,
        deadline_at=excluded.deadline_at, paused_ms=excluded.paused_ms, paused_at=excluded.paused_at, resolved_at=excluded.resolved_at`).run(
      c.id, c.jobId, c.source, JSON.stringify({ question: c.question, header: c.header, scoredBy: c.scoredBy }), JSON.stringify(c.candidates), c.level, c.status,
      c.preselected === null ? null : String(c.preselected), c.resolvedBy, c.answer ? JSON.stringify(c.answer) : null,
      iso(c.createdAt), iso(c.deadlineAt), c.pausedMs, iso(c.pausedAt), iso(c.resolvedAt),
    );
  }

  private row(r: Record<string, unknown>): Card {
    const q = JSON.parse(String(r.question)) as { question: string; header?: string; scoredBy: Card['scoredBy'] };
    return {
      id: String(r.id), jobId: (r.job_id as string | null) ?? null, source: r.source as Card['source'],
      question: q.question, header: q.header, scoredBy: q.scoredBy,
      candidates: JSON.parse(String(r.candidates)), level: r.policy_level as Card['level'], status: r.status as Card['status'],
      preselected: r.preselected === null ? null : Number(r.preselected), resolvedBy: (r.resolved_by as Card['resolvedBy']) ?? null,
      answer: r.answer ? JSON.parse(String(r.answer)) : null,
      createdAt: ms(r.created_at) ?? 0, deadlineAt: ms(r.deadline_at), pausedMs: Number(r.paused_ms), pausedAt: ms(r.paused_at), resolvedAt: ms(r.resolved_at),
    };
  }

  loadOpen(): Card[] {
    return (this.db.prepare("SELECT * FROM decisions WHERE status IN ('pending','paused') ORDER BY created_at").all() as Record<string, unknown>[]).map((r) => this.row(r));
  }

  get(id: string): Card | null {
    const r = this.db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return r ? this.row(r) : null;
  }
}

export class MemoryDecisionStore implements DecisionStore {
  cards = new Map<string, Card>();
  save(c: Card): void { this.cards.set(c.id, structuredClone(c)); }
  loadOpen(): Card[] { return [...this.cards.values()].filter((c) => c.status === 'pending' || c.status === 'paused').map((c) => structuredClone(c)); }
  get(id: string): Card | null { const c = this.cards.get(id); return c ? structuredClone(c) : null; }
}
