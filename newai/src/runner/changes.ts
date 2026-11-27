// 작업 폴더의 변경 내용(리뷰어용). 커밋이 없어도, 새 파일만 있어도 동작한다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = (cwd: string, args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

export interface Changes { files: string[]; diff: string }

export function headCommit(cwd: string): string | null {
  const r = git(cwd, ['rev-parse', '--verify', '-q', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}

export function collectChanges(cwd: string, base: string | null, maxChars = 80_000): Changes {
  if (git(cwd, ['rev-parse', '--git-dir']).status !== 0) return { files: [], diff: '' };
  const tracked = base ? git(cwd, ['diff', '--name-only', base]).stdout : git(cwd, ['diff', '--cached', '--name-only']).stdout;
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard']).stdout;
  const files = [...new Set([...tracked.split('\n'), ...untracked.split('\n')].map((s) => s.trim()).filter(Boolean))];
  let diff = base ? git(cwd, ['diff', base]).stdout : git(cwd, ['diff', '--cached']).stdout;
  for (const f of untracked.split('\n').map((s) => s.trim()).filter(Boolean)) {
    if (diff.length > maxChars) break;
    try {
      const p = path.join(cwd, f);
      if (fs.statSync(p).size > 200_000) continue;
      const body = fs.readFileSync(p, 'utf8');
      if (body.includes('\u0000')) continue;
      diff += `\n--- /dev/null\n+++ b/${f}\n` + body.split('\n').map((l) => `+${l}`).join('\n');
    } catch { /* 읽을 수 없는 파일 */ }
  }
  return { files, diff: diff.slice(0, maxChars) };
}
