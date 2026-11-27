// 읽기 전용 역할(테스트, 리뷰어, 릴리스 정리) 제한. 정책보다 먼저 적용한다.
// 하네스가 만든 임시 폴더(writable) 안의 쓰기는 허용한다(확인용 스크립트 등).
import { isInside } from '../core/normPath.ts';
import { writeTargets, type Verdict } from './policy.ts';
import type { ToolCall } from './tool-classify.ts';

const WRITE_TOOLS: Record<string, string> = { Write: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
const REPO_MUTATING = /\bgit\s+(commit|add|checkout|switch|reset|restore|stash|merge|rebase|apply|cherry-pick|revert|tag|branch\s+-[dDmM]|rm|mv|clean|init)\b|\bsed\s+(-\S*\s+)*-i|\bperl\s+-\S*i|\b(npm|pnpm|yarn|bun)\s+(install|i|add|ci|remove|uninstall|update|init)\b|\bpip3?\s+(install|uninstall)\b/;
const PS_MUTATING = /\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|Rename-Item)\b/i;
/** 경로 인자를 받는 파일 변경 명령: 인자가 모두 임시 폴더 안이면 허용 */
const FILE_CMD = /^(rm|mv|cp|mkdir|rmdir|touch|chmod|chown|ln|truncate|dd)$/;

const deny = (reason: string): Verdict => ({ level: 'deny', reason, matches: [{ level: 'deny', reason, source: 'role' }] });

function inWritable(p: string, call: ToolCall): boolean {
  return (call.writable ?? []).some((d) => isInside(p, d, { cwd: call.workdir, realpath: false }));
}

export function readOnlyGuard(call: ToolCall): Verdict | null {
  if (call.toolName in WRITE_TOOLS) {
    const p = call.input[WRITE_TOOLS[call.toolName]];
    if (typeof p === 'string' && inWritable(p, call)) return null;
    return deny('읽기 전용 역할이라 파일을 고칠 수 없습니다(확인용 파일은 임시 폴더에 쓰세요)');
  }
  if (call.toolName === 'Bash' || call.toolName === 'PowerShell') {
    const cmd = typeof call.input.command === 'string' ? call.input.command : '';
    const bad = writeTargets(cmd).filter((t) => !inWritable(t, call));
    if (bad.length) return deny(`읽기 전용 역할이라 파일(${bad.join(', ')})에 쓸 수 없습니다(확인용 파일은 임시 폴더에 쓰세요)`);
    if (REPO_MUTATING.test(cmd) || PS_MUTATING.test(cmd)) return deny('읽기 전용 역할이라 파일이나 저장소를 바꾸는 명령을 쓸 수 없습니다');
    for (const seg of cmd.split(/&&|\|\||;|\||\n/)) {
      const words = seg.trim().split(/\s+/).filter(Boolean);
      if (!words.length || !FILE_CMD.test(words[0])) continue;
      const args = words.slice(1).filter((w) => !w.startsWith('-')).map((w) => w.replace(/^['"]|['"]$/g, ''));
      if (!args.length || args.some((a) => !inWritable(a, call))) return deny(`읽기 전용 역할이라 ${words[0]} 명령은 임시 폴더 안에서만 쓸 수 있습니다`);
    }
  }
  return null;
}
