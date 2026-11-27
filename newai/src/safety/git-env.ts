// 에이전트 프로세스 환경: 스크립트 안의 git push까지 막는다(pushInsteadOf), push용 토큰을 지운다.
// SDK의 env 옵션은 기존 환경과 합쳐지지 않고 통째로 바뀌므로, 기존 환경을 복사한 뒤 더한다.
import fs from 'node:fs';
import path from 'node:path';

export const BLOCKED_SCHEME = 'newai-blocked';
const TOKEN_VARS = ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GITLAB_TOKEN', 'NPM_TOKEN', 'NODE_AUTH_TOKEN', 'VERCEL_TOKEN', 'NETLIFY_AUTH_TOKEN', 'CLOUDFLARE_API_TOKEN', 'SSH_AUTH_SOCK'];

export function pushBlockPrefixes(platform: NodeJS.Platform): string[] {
  const p = ['/', '.', 'https://', 'http://', 'ssh://', 'git://', 'git@', 'file://'];
  if (platform === 'win32') {
    p.push('\\\\');
    for (let c = 65; c <= 90; c++) p.push(`${String.fromCharCode(c)}:`, `${String.fromCharCode(c + 32)}:`);
  }
  return p;
}

const MESSAGE = 'newai: 이 작업 환경에서는 git push가 막혀 있습니다. push는 대시보드의 릴리스 화면에서 사람이 합니다.';

/** git이 push 주소를 newai-blocked://로 바꾸면 이 스크립트를 찾는다. 안내 문구를 내고 실패한다. */
export function ensureBlockerScripts(binDir: string): void {
  fs.mkdirSync(binDir, { recursive: true });
  const sh = path.join(binDir, `git-remote-${BLOCKED_SCHEME}`);
  const shBody = `#!/bin/sh\necho "${MESSAGE}" >&2\nexit 1\n`;
  if (!fs.existsSync(sh) || fs.readFileSync(sh, 'utf8') !== shBody) fs.writeFileSync(sh, shBody, { mode: 0o755 });
  fs.chmodSync(sh, 0o755);
  if (process.platform === 'win32') {
    const cmd = `${sh}.cmd`;
    const cmdBody = `@echo off\r\necho ${MESSAGE} 1>&2\r\nexit /b 1\r\n`;
    if (!fs.existsSync(cmd) || fs.readFileSync(cmd, 'utf8') !== cmdBody) fs.writeFileSync(cmd, cmdBody);
  }
}

export function buildAgentEnv(base: NodeJS.ProcessEnv, o: { binDir: string; platform?: NodeJS.Platform }): Record<string, string> {
  const platform = o.platform ?? process.platform;
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined) env[k] = v;
  for (const k of TOKEN_VARS) delete env[k];
  let n = Number.parseInt(env.GIT_CONFIG_COUNT ?? '0', 10);
  if (!Number.isFinite(n) || n < 0) n = 0;
  for (const prefix of pushBlockPrefixes(platform)) {
    env[`GIT_CONFIG_KEY_${n}`] = `url.${BLOCKED_SCHEME}://.pushInsteadOf`;
    env[`GIT_CONFIG_VALUE_${n}`] = prefix;
    n++;
  }
  env.GIT_CONFIG_COUNT = String(n);
  env.GIT_TERMINAL_PROMPT = '0';
  env.GCM_INTERACTIVE = 'never';
  env.NEWAI_AGENT = '1';
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  env[pathKey] = [o.binDir, env[pathKey]].filter(Boolean).join(platform === 'win32' ? ';' : ':');
  return env;
}
