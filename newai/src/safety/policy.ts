// policy.yaml을 읽어 명령·파일·주소를 allow | wait | human | deny 로 판정한다.
// 코드에 박힌 기본 규칙(BUILTIN_BASH)은 정책 파일로 끌 수 없다.
import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { formatIssues } from '../core/config.ts';
import { isInside, normPath } from '../core/normPath.ts';

z.config(z.locales.ko());

export const LEVELS = ['allow', 'wait', 'human', 'deny'] as const;
export type Level = (typeof LEVELS)[number];
const RANK: Record<Level, number> = { allow: 0, wait: 1, human: 2, deny: 3 };
export const LEVEL_KO: Record<Level, string> = { allow: '즉시 허용', wait: '대기 필수', human: '사람 승인', deny: '거부' };

const level = z.enum(LEVELS);
const PolicySchema = z.object({
  version: z.literal(1),
  protected_paths: z.array(z.string()).default([]),
  secret_files: z.array(z.string()).default([]),
  secret_files_exclude: z.array(z.string()).default([]),
  bash: z.array(z.object({
    level,
    match: z.string().min(1),
    reason: z.string().default(''),
    except_local: z.boolean().default(false),
  }).strict()).default([]),
  files: z.object({
    write_outside_workdir: level.default('wait'),
    write_protected: level.default('human'),
    write_secret_file: level.default('human'),
    read_secret_file: level.default('human'),
  }).strict().prefault({}),
  web: z.object({ local_hosts: level.default('allow'), other: level.default('wait') }).strict().prefault({}),
  auto_select_exclude: z.array(z.string()).default([]),
}).strict();
type PolicyFile = z.infer<typeof PolicySchema>;

export interface Match { level: Level; reason: string; source: string }
export interface Verdict { level: Level; reason: string; matches: Match[] }

/** push 차단을 우회하려는 시도. 정책 파일과 무관하게 항상 적용한다. */
const BUILTIN_BASH: { level: Level; re: RegExp; reason: string }[] = [
  { level: 'human', re: /\bGIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS|GLOBAL|SYSTEM|NOSYSTEM)\b/, reason: 'push 차단용 git 환경 변수를 건드림' },
  { level: 'human', re: /\bpushInsteadOf\b/i, reason: 'push 차단 설정을 건드림' },
  { level: 'human', re: /\benv\s+(-\S+\s+)*-u\b|\bunset\s+GIT_|\benv\s+-i\b/, reason: '환경 변수를 지워 안전장치를 우회할 수 있음' },
  { level: 'human', re: /\bgit\s+(-c\s+url\.|--config-env)/, reason: 'git 설정을 명령에서 덮어씀' },
  { level: 'human', re: /\bgit-remote-newai-blocked\b/, reason: 'push 차단 안내 스크립트를 건드림' },
];

export class PolicyError extends Error {
  readonly problems: string[];
  constructor(file: string, problems: string[]) {
    super(`${file} 정책에 문제가 있습니다:\n` + problems.map((p) => `  - ${p}`).join('\n'));
    this.problems = problems;
  }
}

function compile(pattern: string): RegExp {
  let flags = '';
  let src = pattern;
  if (src.includes('(?i)')) { flags = 'i'; src = src.replaceAll('(?i)', ''); }
  return new RegExp(src, flags);
}

function globToRegExp(glob: string, ci: boolean): RegExp {
  const src = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${src}$`, ci ? 'i' : '');
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(h);
}

function strictest(matches: Match[]): Verdict {
  if (!matches.length) return { level: 'allow', reason: '해당 규칙 없음', matches };
  let best = matches[0];
  for (const m of matches) if (RANK[m.level] > RANK[best.level]) best = m;
  return { level: best.level, reason: best.reason, matches };
}

export interface PolicyContext { installDir: string; home: string; platform?: NodeJS.Platform }

export class Policy {
  readonly file: PolicyFile;
  private readonly platform: NodeJS.Platform;
  private readonly bash: { level: Level; re: RegExp; reason: string; exceptLocal: boolean; idx: number }[];
  private readonly protectedPaths: string[];
  private readonly secretRes: RegExp[];
  private readonly secretExcludeRes: RegExp[];

  constructor(file: PolicyFile, ctx: PolicyContext, source = 'policy.yaml') {
    this.file = file;
    this.platform = ctx.platform ?? process.platform;
    const problems: string[] = [];
    this.bash = file.bash.flatMap((r, idx) => {
      try { return [{ level: r.level, re: compile(r.match), reason: r.reason, exceptLocal: r.except_local, idx }]; }
      catch (e) { problems.push(`bash.${idx}.match: 정규식 오류 (${(e as Error).message})`); return []; }
    });
    const vars: Record<string, string> = { INSTALL_DIR: ctx.installDir, NEWAI_HOME: ctx.home, HOME: process.env.HOME ?? process.env.USERPROFILE ?? '' };
    this.protectedPaths = file.protected_paths.flatMap((p, idx) => {
      let bad = '';
      const v = p.replace(/\$\{(\w+)\}/g, (_, k: string) => { if (!(k in vars)) bad = k; return vars[k] ?? ''; });
      if (bad) { problems.push(`protected_paths.${idx}: 알 수 없는 변수 \${${bad}}`); return []; }
      return [normPath(v, { platform: this.platform })];
    });
    const ci = this.platform === 'win32';
    this.secretRes = file.secret_files.map((g) => globToRegExp(g, ci));
    this.secretExcludeRes = file.secret_files_exclude.map((g) => globToRegExp(g, ci));
    if (problems.length) throw new PolicyError(source, problems);
  }

  static parse(text: string, ctx: PolicyContext, source = 'policy.yaml'): Policy {
    const doc = parseDocument(text);
    if (doc.errors.length) throw new PolicyError(source, doc.errors.map((e) => `YAML 문법 오류(${e.linePos?.[0]?.line ?? '?'}번째 줄): ${e.code}`));
    const r = PolicySchema.safeParse(doc.toJS() ?? {});
    if (!r.success) throw new PolicyError(source, formatIssues(r.error.issues));
    return new Policy(r.data, ctx, source);
  }

  static load(file: string, ctx: PolicyContext): Policy {
    return Policy.parse(fs.readFileSync(file, 'utf8'), ctx, file);
  }

  private norm(p: string, cwd?: string): string {
    return normPath(p, { platform: this.platform, cwd });
  }

  isSecretName(p: string): boolean {
    const base = p.split(/[\\/]/).pop() ?? p;
    if (!base) return false;
    if (this.secretExcludeRes.some((r) => r.test(base))) return false;
    return this.secretRes.some((r) => r.test(base));
  }

  isProtected(p: string, cwd?: string): boolean {
    const n = this.norm(p, cwd);
    return this.protectedPaths.some((pp) => isInside(n, pp, { platform: this.platform, realpath: false }));
  }

  classifyBash(cmd: string): Verdict {
    const matches: Match[] = [];
    for (const b of BUILTIN_BASH) if (b.re.test(cmd)) matches.push({ level: b.level, reason: b.reason, source: '기본 규칙' });
    const urls = cmd.match(/\bhttps?:\/\/[^\s'"`<>|]+/gi) ?? [];
    const allLocal = urls.length > 0 && urls.every((u) => { try { return isLocalHost(new URL(u).hostname); } catch { return false; } });
    for (const r of this.bash) {
      if (!r.re.test(cmd)) continue;
      if (r.exceptLocal && allLocal) continue;
      matches.push({ level: r.level, reason: r.reason, source: `bash.${r.idx}` });
    }
    // 명령 안에 보호 경로나 비밀 파일 이름이 있으면 사람 승인
    const flat = cmd.replace(/\\/g, '/');
    const hay = this.platform === 'win32' ? flat.toLowerCase() : flat;
    for (const pp of this.protectedPaths) {
      if (hay.includes(pp)) { matches.push({ level: this.file.files.write_protected, reason: `보호 경로(${pp})가 명령에 들어 있음`, source: 'protected_paths' }); break; }
    }
    for (const tok of cmd.split(/[\s;&|<>()'"`=]+/)) {
      if (tok && this.isSecretName(tok)) { matches.push({ level: this.file.files.read_secret_file, reason: `비밀 파일(${tok}) 접근`, source: 'secret_files' }); break; }
    }
    return strictest(matches);
  }

  /** Bash 명령 + 명령이 쓰는 파일(>, >>, tee)의 경로 판정을 합친다. cd로 폴더를 바꾸면 상대 경로는 정확하지 않다. */
  classifyBashIn(cmd: string, workdir: string, writable: string[] = []): Verdict {
    const base = this.classifyBash(cmd);
    const matches = [...base.matches];
    for (const t of writeTargets(cmd)) {
      const v = this.classifyWrite(t, workdir, writable);
      if (v.level !== 'allow') matches.push(...v.matches.map((m) => ({ ...m, reason: `${m.reason}(${t})` })));
    }
    return strictest(matches);
  }

  /** writable: 하네스가 만든 임시 폴더처럼 작업 폴더 밖이어도 대기 없이 쓸 수 있는 곳 */
  classifyWrite(file: string, workdir: string, writable: string[] = []): Verdict {
    const matches: Match[] = [];
    const n = this.norm(file, workdir);
    if (this.isProtected(n)) matches.push({ level: this.file.files.write_protected, reason: '하네스 코드·정책 보호 경로', source: 'files.write_protected' });
    if (this.isSecretName(n)) matches.push({ level: this.file.files.write_secret_file, reason: '비밀 파일 쓰기', source: 'files.write_secret_file' });
    const inside = (d: string) => isInside(n, this.norm(d), { platform: this.platform, realpath: false });
    if (!inside(workdir) && !writable.some(inside)) {
      matches.push({ level: this.file.files.write_outside_workdir, reason: '작업 폴더 밖 쓰기', source: 'files.write_outside_workdir' });
    }
    return strictest(matches);
  }

  classifyRead(file: string, workdir: string): Verdict {
    const n = this.norm(file, workdir);
    if (this.isSecretName(n)) return strictest([{ level: this.file.files.read_secret_file, reason: '비밀 파일 읽기', source: 'files.read_secret_file' }]);
    return strictest([]);
  }

  classifyUrl(url: string): Verdict {
    let host = '';
    try {
      const u = new URL(url);
      if (u.protocol === 'http:' || u.protocol === 'https:') host = u.hostname;
    } catch { /* 형식 오류는 외부로 취급 */ }
    if (host && isLocalHost(host)) return strictest([{ level: this.file.web.local_hosts, reason: '이 PC 안의 주소', source: 'web.local_hosts' }]);
    return strictest([{ level: this.file.web.other, reason: '외부 주소', source: 'web.other' }]);
  }

  /** 선택지 문구에 push·배포 같은 말이 있으면 자동 선택에서 뺀다. */
  isAutoSelectExcluded(text: string): boolean {
    const t = text.toLowerCase();
    return this.file.auto_select_exclude.some((w) => t.includes(w.toLowerCase()));
  }
}

const NULL_DEVICES = new Set(['/dev/null', 'nul', '$null', '/dev/stdout', '/dev/stderr']);

/** 명령이 쓰는 파일 경로(리다이렉트 >, >>, tee 대상)를 뽑는다. */
/** 따옴표로 묶인 인자를 빈 자리로 바꾼다. 단 > 바로 뒤의 따옴표(리다이렉트 대상)는 남긴다. */
function stripQuotedArgs(cmd: string): string {
  return cmd.replace(/(>{1,2}\s*)?('[^']*'|"(?:[^"\\]|\\.)*")/g, (all, redir: string | undefined) => (redir ? all : ' '));
}

export function writeTargets(cmd: string): string[] {
  const out: string[] = [];
  const unq = (s: string) => s.replace(/^['"]|['"]$/g, '');
  // 따옴표 안의 > 는 리다이렉트가 아니다(예: node -e "() => {}"). 리다이렉트 대상 자체가 따옴표면 남긴다.
  const bare = stripQuotedArgs(cmd);
  const target = String.raw`("[^"]*"|'[^']*'|[^\s;&|<>()"']+)`;
  for (const m of bare.matchAll(new RegExp(String.raw`(?:^|[^<>&\d=-])>{1,2}\|?\s*` + target, 'g'))) out.push(unq(m[1]));
  // tee 대상은 따옴표로 묶여도 파일이므로 원래 명령에서 찾는다.
  for (const m of cmd.matchAll(new RegExp(String.raw`\btee\s+((?:-\S+\s+)*)` + target, 'g'))) out.push(unq(m[2]));
  return out.filter((t) => t && !t.startsWith('&') && !t.startsWith('-') && !NULL_DEVICES.has(t.toLowerCase()));
}

export function policyPath(home: string): string {
  return path.join(home, 'policy.yaml');
}
