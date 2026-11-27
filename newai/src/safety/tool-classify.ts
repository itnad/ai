// Claude Code 도구 호출 하나를 정책으로 판정한다. 권한 콜백(canUseTool), PreToolUse 훅, 브리지가 함께 쓴다.
import type { Level, Policy, Verdict } from './policy.ts';

const READ_ONLY = new Set(['Glob', 'Grep', 'LS', 'TodoWrite', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'ToolSearch', 'Skill', 'Agent', 'Task', 'EnterPlanMode', 'BashOutput', 'KillShell', 'TaskStop', 'Monitor']);
const WRITE_TOOLS: Record<string, string> = { Write: 'file_path', Edit: 'file_path', MultiEdit: 'file_path', NotebookEdit: 'notebook_path' };
/** 결정 엔진이 질문 카드로 따로 다루는 도구 */
export const QUESTION_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const verdict = (level: Level, reason: string, source: string): Verdict => ({ level, reason, matches: [{ level, reason, source }] });

export interface ToolCall { toolName: string; input: Record<string, unknown>; workdir: string }

export function classifyTool(policy: Policy, call: ToolCall): Verdict {
  const { toolName, input, workdir } = call;
  if (QUESTION_TOOLS.has(toolName)) return verdict('allow', '질문 도구(결정 엔진이 처리)', 'question');
  if (toolName === 'Bash' || toolName === 'PowerShell') return policy.classifyBashIn(str(input.command), workdir);
  if (toolName in WRITE_TOOLS) {
    const p = str(input[WRITE_TOOLS[toolName]]);
    return p ? policy.classifyWrite(p, workdir) : verdict('wait', '쓰기 경로가 없음', 'tool');
  }
  if (toolName === 'Read') return policy.classifyRead(str(input.file_path), workdir);
  if (toolName === 'Grep' || toolName === 'Glob') {
    const p = str(input.path);
    if (p && policy.isSecretName(p)) return policy.classifyRead(p, workdir);
    return verdict('allow', '읽기 전용 검색', 'tool');
  }
  if (toolName === 'WebFetch') return policy.classifyUrl(str(input.url));
  if (toolName === 'WebSearch') return verdict(policy.file.web.other, '웹 검색(외부 통신)', 'web.other');
  if (toolName.startsWith('mcp__')) return verdict('wait', '외부 도구 서버(MCP) 호출', 'mcp');
  if (READ_ONLY.has(toolName)) return verdict('allow', '읽기·작업 관리 도구', 'tool');
  return verdict('wait', `알 수 없는 도구(${toolName})`, 'tool');
}

/** 카드에 보여 줄 짧은 설명 */
export function describeCall(toolName: string, input: Record<string, unknown>): string {
  if (toolName === 'Bash' || toolName === 'PowerShell') return str(input.command).slice(0, 300);
  if (toolName in WRITE_TOOLS) return str(input[WRITE_TOOLS[toolName]]);
  if (toolName === 'Read') return str(input.file_path);
  if (toolName === 'WebFetch') return str(input.url);
  if (toolName === 'WebSearch') return str(input.query);
  return JSON.stringify(input).slice(0, 300);
}
