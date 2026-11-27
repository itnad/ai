// 설치된 언어·도구·브라우저를 감지해 추천과 지시에 반영한다 (F4.2).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ToolInfo { name: string; found: boolean; version?: string; command?: string }
export interface EnvInfo {
  os: { platform: NodeJS.Platform; release: string; arch: string };
  tools: ToolInfo[];
  browsers: { name: string; path: string }[];
}

interface Probe { name: string; commands: string[][]; parse?: (out: string) => string }

// JAVA_TOOL_OPTIONS가 있으면 java가 'Picked up ...' 줄을 먼저 찍는다.
const firstLine = (s: string) => s.trim().split(/\r?\n/).find((l) => l.trim() && !/^Picked up /.test(l))?.trim() ?? '';
const PROBES: Probe[] = [
  { name: 'node', commands: [['node', '--version']] },
  { name: 'npm', commands: [['npm', '--version']] },
  { name: 'python', commands: [['python3', '--version'], ['python', '--version'], ['py', '--version']] },
  { name: 'git', commands: [['git', '--version']] },
  { name: 'gh', commands: [['gh', '--version']] },
  { name: 'java', commands: [['java', '-version']] },
  { name: 'go', commands: [['go', 'version']] },
  { name: 'rust', commands: [['rustc', '--version']] },
  { name: 'dotnet', commands: [['dotnet', '--version']] },
  { name: 'docker', commands: [['docker', '--version']] },
  { name: 'claude', commands: [['claude', '--version']] },
];

function run(cmd: string[], timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd[0], cmd.slice(1), { timeout: timeoutMs, windowsHide: true, shell: process.platform === 'win32' }, (err, stdout, stderr) => {
      if (err) return resolve(null);
      resolve(firstLine(stdout || stderr));
    });
  });
}

async function probe(p: Probe, timeoutMs: number): Promise<ToolInfo> {
  for (const cmd of p.commands) {
    const out = await run(cmd, timeoutMs);
    if (out !== null) return { name: p.name, found: true, version: p.parse ? p.parse(out) : out, command: cmd[0] };
  }
  return { name: p.name, found: false };
}

function browserCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): { name: string; path: string }[] {
  const c: { name: string; path: string }[] = [];
  const pw = env.PLAYWRIGHT_BROWSERS_PATH || (platform === 'win32' ? path.join(env.LOCALAPPDATA ?? '', 'ms-playwright') : platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright') : path.join(os.homedir(), '.cache/ms-playwright'));
  for (const base of [pw, '/opt/pw-browsers']) {
    try {
      for (const d of fs.readdirSync(base)) if (/^chromium-\d+$/.test(d)) c.push({ name: 'playwright-chromium', path: path.join(base, d) });
    } catch { /* 없음 */ }
  }
  if (platform === 'win32') {
    for (const root of [env['ProgramFiles'], env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean) as string[]) {
      c.push({ name: 'chrome', path: path.join(root, 'Google/Chrome/Application/chrome.exe') });
      c.push({ name: 'edge', path: path.join(root, 'Microsoft/Edge/Application/msedge.exe') });
    }
  } else if (platform === 'darwin') {
    c.push({ name: 'chrome', path: '/Applications/Google Chrome.app' }, { name: 'edge', path: '/Applications/Microsoft Edge.app' });
  } else {
    for (const b of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge']) c.push({ name: path.basename(b), path: b });
  }
  return c.filter((b) => fs.existsSync(b.path));
}

export async function detectEnv(opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}): Promise<EnvInfo> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const tools = await Promise.all(PROBES.map((p) => probe(p, timeoutMs)));
  return {
    os: { platform: process.platform, release: os.release(), arch: process.arch },
    tools,
    browsers: browserCandidates(process.platform, opts.env ?? process.env),
  };
}

/** 프롬프트와 판단 모델에 넣는 한 줄 요약. */
export function summarizeEnv(e: EnvInfo): string {
  const found = e.tools.filter((t) => t.found).map((t) => `${t.name}(${t.version})`);
  const missing = e.tools.filter((t) => !t.found).map((t) => t.name);
  const browsers = [...new Set(e.browsers.map((b) => b.name))];
  return [
    `운영체제: ${e.os.platform} ${e.os.release} ${e.os.arch}`,
    `설치됨: ${found.join(', ') || '없음'}`,
    `없음: ${missing.join(', ') || '없음'}`,
    `브라우저: ${browsers.join(', ') || '없음'}`,
  ].join('\n');
}
