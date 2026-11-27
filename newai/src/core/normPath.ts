// 경로 비교는 반드시 이 파일의 함수만 쓴다 (요구사항 N3).
// C:/a, C:\a, c:\A\, /c/a(Git Bash 표기)는 Windows에서 모두 같은 폴더다.
import fs from 'node:fs';
import path from 'node:path';

export interface NormOptions {
  /** 판정 기준 운영체제. 기본은 현재 운영체제. 시험에서 Windows 규칙을 확인할 때 'win32'를 넘긴다. */
  platform?: NodeJS.Platform;
  /** 상대 경로의 기준 폴더. 없으면 현재 작업 폴더. */
  cwd?: string;
  /** 실제 파일이 있으면 심볼릭 링크를 풀지 여부. 기본 true(현재 운영체제일 때만 적용). */
  realpath?: boolean;
}

export function normPath(input: string, opts: NormOptions = {}): string {
  const platform = opts.platform ?? process.platform;
  const win = platform === 'win32';
  const P = win ? path.win32 : path.posix;
  let s = input.trim();
  if (win) {
    s = s.replace(/^\\\\\?\\/, '');                       // \\?\C:\a → C:\a
    s = s.replace(/^\/([a-zA-Z])(?=\/|$)/, '$1:');           // /c/a → c:/a (Git Bash)
    s = s.replace(/\//g, '\\');
  }
  const base = opts.cwd ?? (platform === process.platform ? process.cwd() : (win ? 'C:\\' : '/'));
  s = P.resolve(win ? base.replace(/\//g, '\\') : base, s);
  if ((opts.realpath ?? true) && platform === process.platform) {
    try { s = fs.realpathSync.native(s); } catch { /* 없는 경로는 그대로 */ }
  }
  s = s.replace(/\\/g, '/');
  if (win) s = s.toLowerCase();
  if (s.length > 1 && s.endsWith('/') && !/^[a-z]:\/$/i.test(s)) s = s.replace(/\/+$/, '');
  return s;
}

export function samePath(a: string, b: string, opts: NormOptions = {}): boolean {
  return normPath(a, opts) === normPath(b, opts);
}

/** child가 parent와 같거나 그 안에 있으면 true. 'C:/ab'는 'C:/a' 안이 아니다. */
export function isInside(child: string, parent: string, opts: NormOptions = {}): boolean {
  const c = normPath(child, opts);
  const p = normPath(parent, opts);
  if (c === p) return true;
  return c.startsWith(p.endsWith('/') ? p : p + '/');
}
