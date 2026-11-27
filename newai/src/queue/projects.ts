// 프로젝트: 새 프로젝트는 NEWAI_HOME/_projects/<이름>에 독립 Git 저장소로 만든다(커밋 기본 안 함).
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { normPath } from '../core/normPath.ts';

export interface Project { id: string; name: string; path: string; kind: 'new' | 'existing'; commitEnabled: boolean; language: string | null }

const row = (r: Record<string, unknown>): Project => ({
  id: String(r.id), name: String(r.name), path: String(r.path), kind: r.kind as Project['kind'], commitEnabled: !!r.commit_enabled, language: (r.language as string | null) ?? null,
});

export function validProjectName(name: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,63}$/u.test(name) && !name.includes('..');
}

export function getProject(db: DatabaseSync, idOrName: string): Project | null {
  const r = db.prepare('SELECT * FROM projects WHERE id = ? OR name = ?').get(idOrName, idOrName) as Record<string, unknown> | undefined;
  return r ? row(r) : null;
}

export function listProjects(db: DatabaseSync): Project[] {
  return (db.prepare('SELECT * FROM projects ORDER BY created_at').all() as Record<string, unknown>[]).map(row);
}

export function createProject(db: DatabaseSync, projectsDir: string, name: string, o: { commitEnabled?: boolean } = {}): Project {
  if (!validProjectName(name)) throw new Error(`프로젝트 이름은 글자·숫자로 시작하고 글자·숫자·.·_·-만 쓸 수 있습니다: ${name}`);
  if (getProject(db, name)) throw new Error(`이미 있는 프로젝트입니다: ${name}`);
  const dir = path.join(projectsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(path.join(dir, '.git'))) spawnSync('git', ['init', '-q'], { cwd: dir });
  const p: Project = { id: `p_${randomUUID().slice(0, 8)}`, name, path: normPath(dir), kind: 'new', commitEnabled: !!o.commitEnabled, language: null };
  db.prepare('INSERT INTO projects(id, name, path, kind, commit_enabled, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, p.name, p.path, p.kind, p.commitEnabled ? 1 : 0, null, new Date().toISOString());
  return p;
}

/** 이미 있는 폴더를 프로젝트로 등록한다(같은 경로면 기존 것을 돌려줌). */
export function registerExisting(db: DatabaseSync, dir: string, name?: string): Project {
  const n = normPath(dir);
  const found = db.prepare('SELECT * FROM projects WHERE path = ?').get(n) as Record<string, unknown> | undefined;
  if (found) return row(found);
  const base = name ?? path.basename(n);
  let finalName = base;
  for (let i = 2; getProject(db, finalName); i++) finalName = `${base}-${i}`;
  const p: Project = { id: `p_${randomUUID().slice(0, 8)}`, name: finalName, path: n, kind: 'existing', commitEnabled: false, language: null };
  db.prepare('INSERT INTO projects(id, name, path, kind, commit_enabled, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, p.name, p.path, p.kind, 0, null, new Date().toISOString());
  return p;
}
