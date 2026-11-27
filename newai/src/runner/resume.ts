// 중단 원인 분류와 이어가기 계획 (F9.1). 상한을 넘으면 사람에게 넘긴다(실패로 끝내지 않음).
import type { Config } from '../core/config.ts';
import { parseDuration } from '../core/config.ts';
import type { TurnResult } from './driver.ts';

export type Cause = 'wall_clock' | 'budget' | 'restart' | 'usage_limit' | 'network';

const USAGE_RE = /usage limit|limit reached|rate limit|rate_limit|사용량 한도|too many requests|429/i;
const NETWORK_RE = /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|fetch failed|network|overloaded|529|5\d\d|connection error|terminated/i;

export function classifyInterruption(r: TurnResult, o: { wallClockHit: boolean }): Cause | null {
  if (r.outcome === 'success' || r.outcome === 'max_turns') return null;
  if (o.wallClockHit && r.outcome === 'aborted') return 'wall_clock';
  if (r.outcome === 'budget') return 'budget';
  const all = [r.apiError ?? '', ...r.errors, r.text].join(' ');
  if (r.apiError === 'rate_limit' || r.resetsAt || USAGE_RE.test(all)) return 'usage_limit';
  if (r.apiError === 'overloaded' || r.apiError === 'server_error' || NETWORK_RE.test(all)) return 'network';
  if (r.outcome === 'aborted') return null; // 사람이 멈춘 것
  return 'network';
}

/** 오류 문구에서 사용량 한도 재설정 시각(ms)을 찾는다. 예: "Claude AI usage limit reached|1764205200" */
export function parseResetsAt(text: string, now: number): number | null {
  const epoch = /\|(\d{10,13})\b/.exec(text);
  if (epoch) { const n = Number(epoch[1]); return n < 1e12 ? n * 1000 : n; }
  const clock = /resets?\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (clock) {
    let h = Number(clock[1]);
    const ap = clock[3]?.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    const d = new Date(now);
    d.setHours(h, Number(clock[2] ?? 0), 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null;
}

export interface ResumeContext {
  config: Config;
  now: number;
  /** 이 작업에서 같은 원인으로 이미 이어간 횟수 */
  attempts: number;
  /** 오늘 사용량 한도로 이어간 횟수(모든 작업) */
  usageToday: number;
  /** 이 작업에서 네트워크 오류로 이미 기다린 시간 합(ms) */
  networkWaitedMs: number;
  /** 오늘 쓴 비용 */
  spentToday: number;
  resetsAt?: number | null;
  errorText?: string;
}

export type ResumePlan = { action: 'resume'; waitMs: number; detail: string } | { action: 'give_up'; detail: string };

const nextMidnight = (now: number) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); };

export function planResume(cause: Cause, c: ResumeContext): ResumePlan {
  const r = c.config.resume;
  switch (cause) {
    case 'wall_clock':
      return c.attempts < r.wall_clock.max_attempts
        ? { action: 'resume', waitMs: 0, detail: `작업 시간 한도(${c.config.runner.wall_clock_limit}) 도달, 바로 이어감(${c.attempts + 1}/${r.wall_clock.max_attempts})` }
        : { action: 'give_up', detail: `작업 시간 한도로 ${r.wall_clock.max_attempts}번 이어갔지만 끝나지 않음` };
    case 'budget':
      if (c.attempts >= 20) return { action: 'give_up', detail: '비용 한도로 20번 이어갔지만 끝나지 않음' };
      if (c.spentToday < c.config.runner.budget_per_day_usd) return { action: 'resume', waitMs: 0, detail: `1회 비용 한도($${c.config.runner.budget_per_run_usd}) 도달, 오늘 쓴 비용 $${c.spentToday.toFixed(2)} → 새 1회분으로 이어감` };
      return { action: 'resume', waitMs: nextMidnight(c.now) - c.now, detail: `일일 비용 한도($${c.config.runner.budget_per_day_usd}) 도달 → 내일 0시까지 대기` };
    case 'usage_limit': {
      if (c.usageToday >= r.usage_limit.max_per_day) return { action: 'give_up', detail: `오늘 사용량 한도로 ${r.usage_limit.max_per_day}번 기다렸음` };
      const grace = parseDuration(r.usage_limit.grace);
      const resetsAt = c.resetsAt ?? parseResetsAt(c.errorText ?? '', c.now) ?? c.now + 30 * 60_000;
      const waitMs = Math.max(0, resetsAt - c.now) + grace;
      return { action: 'resume', waitMs, detail: `사용량 한도 → ${new Date(resetsAt).toISOString()} 재설정 후 이어감${c.resetsAt || c.errorText && parseResetsAt(c.errorText, c.now) ? '' : '(재설정 시각을 몰라 30분 대기)'}` };
    }
    case 'network': {
      const base = parseDuration(r.network.base);
      const max = parseDuration(r.network.max);
      const waitMs = Math.min(max, base * 2 ** c.attempts);
      if (c.attempts >= r.network.max_attempts) return { action: 'give_up', detail: `네트워크 오류로 ${r.network.max_attempts}번 이어갔지만 계속 실패` };
      if (c.networkWaitedMs + waitMs > parseDuration(r.network.max_total)) return { action: 'give_up', detail: `네트워크 오류 대기 시간이 ${r.network.max_total}를 넘음` };
      return { action: 'resume', waitMs, detail: `네트워크 오류 → ${Math.round(waitMs / 1000)}초 뒤 이어감(${c.attempts + 1}/${r.network.max_attempts})` };
    }
    case 'restart':
      return c.attempts < r.restart.max_attempts
        ? { action: 'resume', waitMs: parseDuration(r.restart.delay), detail: `서버 재시작으로 중단 → ${r.restart.delay} 뒤 이어감` }
        : { action: 'give_up', detail: `서버 재시작으로 ${r.restart.max_attempts}번 중단됨` };
  }
}
