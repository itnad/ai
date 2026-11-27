// 새 대화에 넣을 프로젝트 이전 작업 기록, 답 없이 취소된 요청, 규칙 (F6)
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface HistoryItem { jobId: string; summary: string; pendingItems: string | null; createdAt: string }

export function addHistory(db: DatabaseSync, projectId: string, jobId: string, summary: string, pendingItems: string | null): void {
  db.prepare('INSERT INTO project_history(project_id, job_id, summary, pending_items, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(projectId, jobId, summary, pendingItems, new Date().toISOString());
}

export function recentHistory(db: DatabaseSync, projectId: string, n: number): HistoryItem[] {
  return (db.prepare('SELECT job_id, summary, pending_items, created_at FROM project_history WHERE project_id = ? ORDER BY id DESC LIMIT ?').all(projectId, n) as Record<string, string | null>[])
    .reverse().map((r) => ({ jobId: String(r.job_id), summary: String(r.summary), pendingItems: r.pending_items, createdAt: String(r.created_at) }));
}

/** 시작하지 못했거나 결정 카드에 답이 없는 채로 취소된 요청 */
export function cancelledUnanswered(db: DatabaseSync, projectId: string, n = 5): string[] {
  return (db.prepare(`SELECT request FROM jobs WHERE project_id = ? AND status = 'cancelled'
      AND (started_at IS NULL OR id IN (SELECT job_id FROM decisions WHERE status = 'cancelled'))
      ORDER BY created_at DESC LIMIT ?`).all(projectId, n) as { request: string }[]).map((r) => r.request).reverse();
}

export type RuleScope = 'project' | 'global';
export interface Rule { id: string; scope: RuleScope; projectId: string | null; text: string; origin: 'auto' | 'manual'; status: 'active' | 'proposed' | 'disabled' }

/** 자동 저장은 그 프로젝트에만(활성). 전역 규칙은 사람이 승인해야 활성(N8). */
export function addRule(db: DatabaseSync, r: { scope: RuleScope; projectId?: string | null; text: string; origin: 'auto' | 'manual' }): Rule {
  if (r.scope === 'project' && !r.projectId) throw new Error('프로젝트 규칙에는 프로젝트가 필요합니다.');
  const status = r.scope === 'global' && r.origin === 'auto' ? 'proposed' : 'active';
  const rule: Rule = { id: `r_${randomUUID().slice(0, 8)}`, scope: r.scope, projectId: r.scope === 'project' ? r.projectId ?? null : null, text: r.text.trim(), origin: r.origin, status };
  db.prepare('INSERT INTO rules(id, scope, project_id, text, origin, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(rule.id, rule.scope, rule.projectId, rule.text, rule.origin, rule.status, new Date().toISOString());
  return rule;
}

export function activeRules(db: DatabaseSync, projectId: string | null): string[] {
  return (db.prepare(`SELECT text FROM rules WHERE status = 'active' AND (scope = 'global' OR (scope = 'project' AND project_id = ?)) ORDER BY scope DESC, created_at`)
    .all(projectId) as { text: string }[]).map((r) => r.text);
}
