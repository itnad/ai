// harness 관리 명령. 이번 단계: doctor, init, policy check, config get/set
import '../core/quiet.ts';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigError, getConfigValue, loadConfig, setConfigValue, TIMEOUTS } from '../core/config.ts';
import { detectEnv, summarizeEnv } from '../core/env-detect.ts';
import { ensureHome, getPaths, layout, separationProblems, type Paths } from '../core/paths.ts';
import { computeCodeVersion } from '../core/version.ts';
import { listTables, openDb, SCHEMA_VERSION } from '../db/db.ts';
import { LEVEL_KO, Policy, PolicyError, type Level, type Verdict } from '../safety/policy.ts';
import { createJob } from '../queue/jobs.ts';
import { createProject, getProject, registerExisting } from '../queue/projects.ts';
import { createRuntime } from '../runtime.ts';

/** policy check 종료 코드: 스크립트에서 판정을 쓸 수 있게 단계마다 다르게 둔다. */
export const POLICY_EXIT: Record<Level, number> = { allow: 0, wait: 10, human: 11, deny: 12 };

const HELP = `사용법: harness <명령> [옵션]

명령
  doctor                         설치 폴더·데이터 폴더·설정·정책·DB·실행 환경 점검
  init                           데이터 폴더와 기본 설정 만들기(있는 파일은 그대로)
  policy check "<명령>"          Bash 명령의 정책 판정
  policy check --write <경로> [--workdir <폴더>]
  policy check --read <경로> [--workdir <폴더>]
  policy check --url <주소>
  policy check --option "<선택지 문구>"
  config get <키>                예: config get decision.timeout
  config set <키> <값>           예: config set decision.timeout 5m
  run "<요청>" [--project <이름> | --workdir <폴더>] [--model <모델>]
                                 요청 하나를 이 창에서 끝까지 실행(서버 없이). 결정 카드는 대기 시간 후 자동 선택
  help                           이 도움말

공통 옵션
  --home <폴더>                  데이터 폴더 지정(NEWAI_HOME보다 우선)

policy check 종료 코드: 0 즉시 허용, 10 대기 필수, 11 사람 승인, 12 거부, 2 사용법 오류`;

interface Args { _: string[]; opts: Record<string, string | true> }
function parseArgs(argv: string[]): Args {
  const a: Args = { _: [], opts: {} };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { a.opts[key] = next; i++; } else a.opts[key] = true;
    } else a._.push(t);
  }
  return a;
}

const out = (s = '') => process.stdout.write(s + '\n');
const err = (s: string) => process.stderr.write(s + '\n');

function paths(a: Args): Paths {
  return getPaths({ home: typeof a.opts.home === 'string' ? a.opts.home : undefined });
}

function printVerdict(title: string, v: Verdict): number {
  out(`대상: ${title}`);
  out(`판정: ${v.level} (${LEVEL_KO[v.level]})`);
  out(`이유: ${v.reason}`);
  if (v.matches.length > 1) {
    out('맞은 규칙:');
    for (const m of v.matches) out(`  - ${m.level} ${m.source}: ${m.reason}`);
  }
  return POLICY_EXIT[v.level];
}

async function doctor(a: Args): Promise<number> {
  const p = paths(a);
  const L = layout(p.home);
  let problems = 0;
  const ok = (label: string, value: string) => out(`  [정상] ${label}: ${value}`);
  const bad = (label: string, value: string) => { problems++; out(`  [문제] ${label}: ${value}`); };

  out('newai 점검');
  ok('설치 폴더', p.installDir);
  ok('데이터 폴더', p.home);
  const sep = separationProblems(p);
  if (sep.length) sep.forEach((s) => bad('폴더 분리', s)); else ok('폴더 분리', '설치 폴더와 데이터 폴더가 겹치지 않음');
  const { created } = ensureHome(p);
  if (created.length) ok('처음 만든 항목', `${created.length}개`);
  ok('코드 버전', computeCodeVersion(p.installDir));

  const [maj, min] = process.versions.node.split('.').map(Number);
  if (maj > 22 || (maj === 22 && min >= 18)) ok('Node.js', process.version); else bad('Node.js', `${process.version} (22.18 이상 필요)`);

  try { const c = loadConfig(L.config); ok('config.yaml', `대기 시간 ${c.decision.timeout}, 작업 모델 ${c.runner.model}`); }
  catch (e) { bad('config.yaml', (e as Error).message); }
  try { const pol = Policy.load(L.policy, p); ok('policy.yaml', `Bash 규칙 ${pol.file.bash.length}개`); }
  catch (e) { bad('policy.yaml', (e as Error).message); }
  try {
    const db = openDb(L.db);
    ok('데이터베이스', `스키마 v${SCHEMA_VERSION}, 표 ${listTables(db).length}개`);
    db.close();
  } catch (e) { bad('데이터베이스', (e as Error).message); }

  if (!a.opts['skip-env']) {
    const env = await detectEnv();
    out('실행 환경');
    for (const line of summarizeEnv(env).split('\n')) out(`  ${line}`);
    if (!env.tools.find((t) => t.name === 'claude')?.found) bad('Claude Code', 'claude 명령을 찾지 못했습니다');
    if (!env.tools.find((t) => t.name === 'git')?.found) bad('Git', 'git 명령을 찾지 못했습니다');
  }
  out(problems ? `결과: 문제 ${problems}개` : '결과: 문제 없음');
  return problems ? 1 : 0;
}

function policyCheck(a: Args): number {
  const p = paths(a);
  ensureHome(p);
  const pol = Policy.load(layout(p.home).policy, p);
  const workdir = typeof a.opts.workdir === 'string' ? a.opts.workdir : process.cwd();
  if (typeof a.opts.write === 'string') return printVerdict(`파일 쓰기 ${a.opts.write} (작업 폴더 ${workdir})`, pol.classifyWrite(a.opts.write, workdir));
  if (typeof a.opts.read === 'string') return printVerdict(`파일 읽기 ${a.opts.read}`, pol.classifyRead(a.opts.read, workdir));
  if (typeof a.opts.url === 'string') return printVerdict(`주소 ${a.opts.url}`, pol.classifyUrl(a.opts.url));
  if (typeof a.opts.option === 'string') {
    const ex = pol.isAutoSelectExcluded(a.opts.option);
    out(`선택지: ${a.opts.option}`);
    out(ex ? '자동 선택: 제외(사람이 골라야 함)' : '자동 선택: 가능');
    return ex ? POLICY_EXIT.human : 0;
  }
  const cmd = a._.slice(2).join(' ');
  if (!cmd) { err('판정할 명령을 주세요. 예: harness policy check "git push"'); return 2; }
  return printVerdict(`명령 ${cmd}`, pol.classifyBash(cmd));
}

async function config(a: Args): Promise<number> {
  const p = paths(a);
  ensureHome(p);
  const file = layout(p.home).config;
  const [, sub, key, value] = a._;
  if (sub === 'get' && key) {
    const v = getConfigValue(loadConfig(file), key);
    if (v === undefined) { err(`없는 키입니다: ${key}`); return 2; }
    out(typeof v === 'object' ? JSON.stringify(v) : String(v));
    return 0;
  }
  if (sub === 'set' && key && value !== undefined) {
    await setConfigValue(file, key, value);
    out(`저장했습니다: ${key} = ${value}`);
    if (key === 'decision.timeout') out(`(가능한 값: ${TIMEOUTS.join(', ')})`);
    return 0;
  }
  err('사용법: harness config get <키> | harness config set <키> <값>');
  return 2;
}

const STATUS_KO: Record<string, string> = { done: '완료', needs_human: '사람 확인 필요', failed: '실패', cancelled: '취소' };

async function run(a: Args): Promise<number> {
  const request = a._.slice(1).join(' ').trim();
  if (!request) { err('요청을 주세요. 예: harness run "인사말을 출력하는 hello.js 만들기" --project hello'); return 2; }
  const t0 = Date.now();
  const ts = () => `[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}초]`;
  const rt = await createRuntime({
    home: typeof a.opts.home === 'string' ? a.opts.home : undefined,
    modelOverride: typeof a.opts.model === 'string' ? a.opts.model : undefined,
    onEvent: (e) => out(`${ts()} ${e.role ? `[${e.role}] ` : ''}${e.text.replace(/\n/g, ' ')}`),
  });
  rt.engine.on('created', (c) => {
    out(`${ts()} 결정 카드: ${c.question.split('\n')[0]}`);
    c.candidates.forEach((x, i) => out(`         ${i + 1}. ${x.label} (${x.score}점${x.autoSelectable ? '' : ', 자동 선택 안 함'}) ${x.reason}`));
    out(c.deadlineAt ? `         ${Math.round((c.deadlineAt - Date.now()) / 1000)}초 뒤 1순위로 진행합니다.` : '         사람 승인이 필요합니다.');
  });
  rt.engine.on('resolved', (r) => out(`${ts()} 결정: ${r.answer.kind === 'choice' ? r.answer.label : r.answer.text} (${r.resolvedBy === 'auto' ? '자동' : r.resolvedBy})`));
  let project;
  if (typeof a.opts.workdir === 'string') project = registerExisting(rt.db, path.resolve(a.opts.workdir));
  else {
    const name = typeof a.opts.project === 'string' ? a.opts.project : `p-${new Date().toISOString().slice(0, 10)}`;
    project = getProject(rt.db, name) ?? createProject(rt.db, rt.L.projects, name);
  }
  const job = createJob(rt.db, { projectId: project.id, request });
  out(`작업 ${job.id} 시작 (프로젝트 ${project.name}: ${project.path})`);
  const r = await rt.runner.run(job.id);
  out('');
  out(`결과: ${STATUS_KO[r.status] ?? r.status}, 비용 $${r.costUsd.toFixed(4)}, 중단 후 이어가기 ${r.interruptions.length}번`);
  if (r.humanItems.length) { out('사람이 확인할 항목:'); r.humanItems.forEach((h) => out(`  - ${h}`)); }
  out(`보고서: ${r.reportPath}`);
  rt.db.close();
  return r.status === 'done' ? 0 : 1;
}

export async function main(argv: string[]): Promise<number> {
  const a = parseArgs(argv);
  const [cmd, sub] = a._;
  try {
    switch (cmd) {
      case 'doctor': return await doctor(a);
      case 'init': {
        const p = paths(a);
        const { created } = ensureHome(p);
        out(`데이터 폴더: ${p.home}`);
        out(created.length ? `새로 만든 항목 ${created.length}개:\n` + created.map((c) => `  ${path.relative(p.home, c) || '.'}`).join('\n') : '이미 준비되어 있습니다.');
        return 0;
      }
      case 'policy': if (sub === 'check') return policyCheck(a); break;
      case 'config': return await config(a);
      case 'run': return await run(a);
      case undefined: case 'help': case '--help': out(HELP); return 0;
    }
    err(`알 수 없는 명령입니다: ${a._.join(' ')}\n`);
    out(HELP);
    return 2;
  } catch (e) {
    if (e instanceof ConfigError || e instanceof PolicyError) { err(e.message); return 1; }
    throw e;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]).replace(/\\/g, '/').endsWith('src/cli/harness.ts')) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
