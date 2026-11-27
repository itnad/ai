// 판단 모델 호출 공통부: 빈 중립 폴더, 설정·메모리·도구 없이, 구조화 출력으로 (요구사항 N6).
import fs from 'node:fs';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import type { z } from 'zod';

export interface JudgeOptions { model: string; sandboxDir: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }

export async function runJudge<T>(o: JudgeOptions, system: string, prompt: string, jsonSchema: Record<string, unknown>, schema: z.ZodType<T>): Promise<{ value: T; costUsd: number }> {
  fs.mkdirSync(o.sandboxDir, { recursive: true });
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), o.timeoutMs ?? 90_000);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.env ?? process.env)) if (v !== undefined) env[k] = v;
  env.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
  const options: Options = {
    cwd: o.sandboxDir, settingSources: [], tools: [], model: o.model, maxTurns: 3,
    systemPrompt: system, persistSession: false, env, abortController: abort,
    outputFormat: { type: 'json_schema', schema: jsonSchema },
  };
  try {
    for await (const m of query({ prompt, options })) {
      if (m.type !== 'result') continue;
      if (m.subtype !== 'success') throw new Error(`판단 모델 실패: ${m.subtype}`);
      return { value: schema.parse(m.structured_output ?? JSON.parse(m.result)), costUsd: m.total_cost_usd };
    }
    throw new Error('판단 모델이 결과를 내지 않았습니다.');
  } finally {
    clearTimeout(timer);
  }
}
