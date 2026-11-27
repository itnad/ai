// config.yaml 읽기·검증·수정. 잘못된 값은 시작할 때 한국어로 알려 준다.
// 대기 시간 같은 전역 설정은 이 파일 하나가 원본이다(주석을 지우지 않고 고친다).
import fs from 'node:fs';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { writeFileAtomic } from './atomicFile.ts';

z.config(z.locales.ko());

export const TIMEOUTS = ['20s', '1m', '5m', '10m', '20m'] as const;
export type DecisionTimeout = (typeof TIMEOUTS)[number];

const duration = z.string().regex(/^\d+(ms|s|m|h)$/, { message: '기간은 30s, 5m, 2h처럼 숫자와 단위(ms, s, m, h)로 씁니다' });
const usd = z.number().positive();
const model = z.string().min(1);

export const ConfigSchema = z.object({
  language: z.string().min(2).default('ko'),
  server: z.object({
    port: z.number().int().min(1024).max(65535).default(47321),
    host: z.enum(['127.0.0.1', 'localhost', '::1']).default('127.0.0.1'),
  }).strict().prefault({}),
  decision: z.object({
    timeout: z.enum(TIMEOUTS).default('1m'),
    deliver: z.enum(['hold', 'resume']).default('hold'),
  }).strict().prefault({}),
  scoring: z.object({
    model: model.default('claude-haiku-5-5'),
    weights: z.object({
      goal: z.number().min(0).default(30),
      reversible: z.number().min(0).default(20),
      scope: z.number().min(0).default(15),
      env: z.number().min(0).default(15),
      rules: z.number().min(0).default(10),
      cost: z.number().min(0).default(10),
    }).strict().prefault({}),
  }).strict().prefault({}),
  runner: z.object({
    model: model.default('claude-opus-5-5'),
    max_concurrent: z.number().int().min(1).max(16).default(2),
    wall_clock_limit: duration.default('90m'),
    budget_per_run_usd: usd.default(5),
    budget_per_day_usd: usd.default(50),
    completion_followups: z.number().int().min(0).max(5).default(2),
    tail_question_max: z.number().int().min(0).max(10).default(3),
  }).strict().prefault({}),
  resume: z.object({
    usage_limit: z.object({ max_per_day: z.number().int().min(0).default(6), grace: duration.default('2m') }).strict().prefault({}),
    network: z.object({
      base: duration.default('30s'), max: duration.default('10m'),
      max_attempts: z.number().int().min(0).default(6), max_total: duration.default('2h'),
    }).strict().prefault({}),
    restart: z.object({ delay: duration.default('30s'), max_attempts: z.number().int().min(0).default(3) }).strict().prefault({}),
    wall_clock: z.object({ max_attempts: z.number().int().min(0).default(3) }).strict().prefault({}),
  }).strict().prefault({}),
  projects: z.object({
    commit_default: z.boolean().default(false),
    history_items: z.number().int().min(0).max(50).default(5),
  }).strict().prefault({}),
  notify: z.object({
    desktop: z.boolean().default(true),
    telegram: z.boolean().default(false),
    slack: z.boolean().default(false),
  }).strict().prefault({}),
  web_check: z.object({
    allow_hosts: z.array(z.string()).default(['localhost', '127.0.0.1', '::1']),
  }).strict().prefault({}),
}).strict();

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  readonly problems: string[];
  constructor(file: string, problems: string[]) {
    super(`${file} 설정에 문제가 있습니다:\n` + problems.map((p) => `  - ${p}`).join('\n'));
    this.problems = problems;
  }
}

export function formatIssues(issues: z.core.$ZodIssue[]): string[] {
  return issues.map((i) => {
    const where = i.path.length ? i.path.join('.') : '(최상위)';
    return `${where}: ${i.message}`;
  });
}

export function parseConfigText(text: string, file = 'config.yaml'): Config {
  const doc = parseDocument(text);
  if (doc.errors.length) {
    throw new ConfigError(file, doc.errors.map((e) => `YAML 문법 오류(${e.linePos?.[0] ? `${e.linePos[0].line}번째 줄` : '위치 모름'}): ${e.code}`));
  }
  const raw = doc.toJS() ?? {};
  const r = ConfigSchema.safeParse(raw);
  if (!r.success) throw new ConfigError(file, formatIssues(r.error.issues));
  return r.data;
}

export function loadConfig(file: string): Config {
  if (!fs.existsSync(file)) return ConfigSchema.parse({});
  return parseConfigText(fs.readFileSync(file, 'utf8'), file);
}

function coerce(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/** 점으로 구분한 키(예: decision.timeout)의 값을 바꾼다. 검증에 실패하면 파일을 건드리지 않는다. */
export async function setConfigValue(file: string, key: string, rawValue: string): Promise<Config> {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const doc = parseDocument(text);
  const keys = key.split('.').filter(Boolean);
  if (!keys.length) throw new ConfigError(file, ['키가 비어 있습니다.']);
  doc.setIn(keys, coerce(rawValue));
  const r = ConfigSchema.safeParse(doc.toJS() ?? {});
  if (!r.success) throw new ConfigError(file, formatIssues(r.error.issues));
  await writeFileAtomic(file, doc.toString());
  return r.data;
}

export function getConfigValue(cfg: Config, key: string): unknown {
  let cur: unknown = cfg;
  for (const k of key.split('.').filter(Boolean)) {
    if (cur === null || typeof cur !== 'object' || !(k in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export function parseDuration(s: string): number {
  const m = /^(\d+)(ms|s|m|h)$/.exec(s);
  if (!m) throw new Error(`기간 형식이 잘못되었습니다: ${s}`);
  const n = Number(m[1]);
  return n * { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2] as 'ms' | 's' | 'm' | 'h'];
}
