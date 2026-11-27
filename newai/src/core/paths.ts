// 설치 폴더(코드)와 데이터 폴더(설정·DB·프로젝트)를 분리한다 (요구사항 N4).
// 두 값은 이 파일에서만 만들고, 서로에게서 계산하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isInside } from './normPath.ts';

export interface Paths {
  installDir: string;
  home: string;
}

export interface HomeLayout {
  home: string;
  config: string;
  policy: string;
  roles: string;
  bin: string;
  servers: string;
  secrets: string;
  pipelinesDir: string;
  db: string;
  portFile: string;
  tokenFile: string;
  logs: string;
  reports: string;
  screenshots: string;
  projects: string;
  worktrees: string;
  judgeSandbox: string;
}

/** 실행 중인 코드 위치에서 위로 올라가며 name이 newai인 package.json을 찾는다. */
export function findInstallDir(fromUrl: string = import.meta.url): string {
  let dir = path.dirname(fileURLToPath(fromUrl));
  for (;;) {
    const pj = path.join(dir, 'package.json');
    if (fs.existsSync(pj)) {
      try {
        if (JSON.parse(fs.readFileSync(pj, 'utf8')).name === 'newai') return dir;
      } catch { /* 다른 package.json */ }
    }
    const up = path.dirname(dir);
    if (up === dir) throw new Error('newai 설치 폴더(package.json)를 찾지 못했습니다.');
    dir = up;
  }
}

/** 데이터 폴더: NEWAI_HOME > Windows %APPDATA%\newai > ~/.newai */
export function resolveHome(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homedir: string = os.homedir(),
): string {
  const P = platform === 'win32' ? path.win32 : path.posix;
  if (env.NEWAI_HOME && env.NEWAI_HOME.trim()) return P.resolve(env.NEWAI_HOME.trim());
  if (platform === 'win32') return P.join(env.APPDATA || P.join(homedir, 'AppData', 'Roaming'), 'newai');
  return P.join(homedir, '.newai');
}

export function getPaths(opts: { home?: string; env?: NodeJS.ProcessEnv } = {}): Paths {
  const installDir = findInstallDir();
  const home = opts.home ? path.resolve(opts.home) : resolveHome(opts.env ?? process.env);
  return { installDir, home };
}

export function layout(home: string): HomeLayout {
  const j = (...p: string[]) => path.join(home, ...p);
  return {
    home,
    config: j('config.yaml'),
    policy: j('policy.yaml'),
    roles: j('roles.yaml'),
    bin: j('bin'),
    servers: j('servers.yaml'),
    secrets: j('secrets.yaml'),
    pipelinesDir: j('pipelines'),
    db: j('newai.db'),
    portFile: j('server.port'),
    tokenFile: j('server.token'),
    logs: j('logs'),
    reports: j('reports'),
    screenshots: j('screenshots'),
    projects: j('_projects'),
    worktrees: j('worktrees'),
    judgeSandbox: j('judge-sandbox'),
  };
}

/** 두 폴더가 겹치면 경로·버전 계산이 꼬인다. 겹침을 경고로 돌려준다. */
export function separationProblems(p: Paths, platform: NodeJS.Platform = process.platform): string[] {
  const out: string[] = [];
  if (isInside(p.home, p.installDir, { platform })) out.push(`데이터 폴더(${p.home})가 설치 폴더(${p.installDir}) 안에 있습니다. NEWAI_HOME을 다른 곳으로 지정하세요.`);
  else if (isInside(p.installDir, p.home, { platform })) out.push(`설치 폴더(${p.installDir})가 데이터 폴더(${p.home}) 안에 있습니다.`);
  return out;
}

/** 데이터 폴더를 만들고, 없는 설정 파일만 templates/에서 복사한다(덮어쓰지 않음). */
export function ensureHome(p: Paths): { created: string[] } {
  const L = layout(p.home);
  const created: string[] = [];
  for (const d of [L.home, L.bin, L.pipelinesDir, L.logs, L.reports, L.screenshots, L.projects, L.worktrees, L.judgeSandbox]) {
    if (!fs.existsSync(d)) { fs.mkdirSync(d, { recursive: true }); created.push(d); }
  }
  const tpl = path.join(p.installDir, 'templates');
  const copies: [string, string][] = [
    [path.join(tpl, 'config.yaml'), L.config],
    [path.join(tpl, 'policy.yaml'), L.policy],
    [path.join(tpl, 'roles.yaml'), L.roles],
    [path.join(tpl, 'servers.yaml'), L.servers],
  ];
  for (const f of fs.readdirSync(path.join(tpl, 'pipelines'))) copies.push([path.join(tpl, 'pipelines', f), path.join(L.pipelinesDir, f)]);
  for (const [src, dst] of copies) {
    if (!fs.existsSync(dst)) { fs.copyFileSync(src, dst); created.push(dst); }
  }
  return { created };
}
