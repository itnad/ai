// 비용 기록: SDK는 이어진 세션의 비용을 누적 합계로 준다. 직전 값과의 차이만 더한다(요구사항 N5).
import type { DatabaseSync } from 'node:sqlite';

export function recordCost(db: DatabaseSync, o: { jobId: string; sessionId: string | null; role: string; model: string; totalCostUsd: number; now?: Date }): number {
  if (!o.sessionId || !(o.totalCostUsd >= 0)) return 0;
  const row = db.prepare('SELECT last_total_cost_usd FROM sessions WHERE id = ?').get(o.sessionId) as { last_total_cost_usd: number } | undefined;
  let delta: number;
  if (!row) {
    delta = o.totalCostUsd;
    db.prepare('INSERT INTO sessions(id, job_id, model, last_total_cost_usd) VALUES (?, ?, ?, ?)').run(o.sessionId, o.jobId, o.model, o.totalCostUsd);
  } else {
    // 합계가 줄었다면(대화 지우기 등으로 초기화) 새 합계 전체가 이번 비용이다.
    delta = o.totalCostUsd >= row.last_total_cost_usd ? o.totalCostUsd - row.last_total_cost_usd : o.totalCostUsd;
    db.prepare('UPDATE sessions SET last_total_cost_usd = ? WHERE id = ?').run(o.totalCostUsd, o.sessionId);
  }
  if (delta > 0) {
    db.prepare('UPDATE jobs SET cost_usd = cost_usd + ? WHERE id = ?').run(delta, o.jobId);
    db.prepare('INSERT INTO events(job_id, ts, type, payload) VALUES (?, ?, ?, ?)')
      .run(o.jobId, (o.now ?? new Date()).toISOString(), 'cost', JSON.stringify({ delta, role: o.role, sessionId: o.sessionId }));
  }
  return delta;
}

/** since 이후 쓴 비용 합계(일일 상한 판단용) */
export function spentSince(db: DatabaseSync, since: Date): number {
  const rows = db.prepare("SELECT payload FROM events WHERE type = 'cost' AND ts >= ?").all(since.toISOString()) as { payload: string }[];
  return rows.reduce((s, r) => s + (JSON.parse(r.payload).delta as number), 0);
}

export function costByRole(db: DatabaseSync, jobId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of db.prepare("SELECT payload FROM events WHERE type = 'cost' AND job_id = ?").all(jobId) as { payload: string }[]) {
    const p = JSON.parse(r.payload) as { delta: number; role: string };
    out[p.role] = (out[p.role] ?? 0) + p.delta;
  }
  return out;
}
