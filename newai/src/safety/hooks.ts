// PreToolUse 훅: 권한 콜백과 독립된 두 번째 겹.
// 프로젝트 설정의 허용 규칙이나 권한 모드 때문에 canUseTool이 불리지 않아도 여기서 막는다.
import type { HookCallback } from '@anthropic-ai/claude-agent-sdk';
import type { Policy, Verdict } from './policy.ts';
import { classifyTool, QUESTION_TOOLS, type ToolCall } from './tool-classify.ts';

export function makePreToolUseHook(o: { policy: Policy; workdir: string; log?: (e: { tool: string; level: string; reason: string }) => void; extraCheck?: (call: ToolCall) => Verdict | null; writable?: string[] }): HookCallback {
  return async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {};
    const toolName = input.tool_name;
    if (QUESTION_TOOLS.has(toolName)) return {};
    const call = { toolName, input: (input.tool_input ?? {}) as Record<string, unknown>, workdir: input.cwd || o.workdir, writable: o.writable };
    const v = o.extraCheck?.(call) ?? classifyTool(o.policy, call);
    if (v.level === 'allow') return {};
    o.log?.({ tool: toolName, level: v.level, reason: v.reason });
    if (v.level === 'deny') {
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `newai 정책으로 거부되었습니다: ${v.reason}` } };
    }
    // wait·human은 권한 확인으로 보내 결정 카드를 거치게 한다.
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `newai 확인 필요: ${v.reason}` } };
  };
}
