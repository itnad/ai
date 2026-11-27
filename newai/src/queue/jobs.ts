import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export type JobStatus = 'queued' | 'running' | 'waiting_decision' | 'suspended' | 'done' | 'needs_human' | 'failed' | 'cancelled';
export interface Job {
  id: string; projectId: string | null; kind: 'chat' | 'pipeline' | 'server-check' | 'batch'; request: string; status: JobStatus;
  sessionId: string | null; attempt: number; costUsd: number; createdAt: string; startedAt: string | null; finishedAt: string | null;
}

const row = (r: Record<string, unknown>): Job => ({
  id: String(r.id), projectId: (r.project_id as string | null) ?? null, kind: r.kind as Job['kind'], request: String(r.request), status: r.status as JobStatus,
  sessionId: (r.session_id as string | null) ?? null, attempt: Number(r.attempt), costUsd: Number(r.cost_usd),
  createdAt: String(r.created_at), startedAt: (r.started_at as string | null) ?? null, finishedAt: (r.finished_at as string | null) ?? null,
});

export function createJob(db: DatabaseSync, o: { projectId: string; request: string; kind?: Job['kind']; afterJobId?: string | null }): Job {
  const id = `job_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${randomUUID().slice(0, 6)}`;
  db.prepare('INSERT INTO jobs(id, project_id, kind, request, status, after_job_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, o.projectId, o.kind ?? 'chat', o.request, 'queued', o.afterJobId ?? null, new Date().toISOString());
  return getJob(db, id)!;
}

export function getJob(db: DatabaseSync, id: string): Job | null {
  const r = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return r ? row(r) : null;
}

export function setJobStatus(db: DatabaseSync, id: string, status: JobStatus, extra: { sessionId?: string | null } = {}): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE jobs SET status = ?,
      started_at = CASE WHEN ? = 'running' AND started_at IS NULL THEN ? ELSE started_at END,
      finished_at = CASE WHEN ? IN ('done','needs_human','failed','cancelled') THEN ? ELSE finished_at END,
      session_id = COALESCE(?, session_id)
    WHERE id = ?`).run(status, status, now, status, now, extra.sessionId ?? null, id);
}

export function logEvent(db: DatabaseSync, jobId: string, type: string, payload: unknown, now = new Date()): void {
  db.prepare('INSERT INTO events(job_id, ts, type, payload) VALUES (?, ?, ?, ?)').run(jobId, now.toISOString(), type, JSON.stringify(payload));
}

export function jobsInStatus(db: DatabaseSync, statuses: JobStatus[]): Job[] {
  return (db.prepare(`SELECT * FROM jobs WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY created_at`).all(...statuses) as Record<string, unknown>[]).map(row);
}
