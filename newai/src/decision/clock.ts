// 타이머를 시험에서 빨리 감을 수 있도록 시계를 주입한다.
export interface Clock {
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  // unref하지 않는다: 이어가기 대기나 결정 카드 마감 중에 프로세스가 끝나 버리면 안 된다.
  setTimer: (fn, ms) => setTimeout(fn, Math.max(0, ms)),
  clearTimer: (h) => clearTimeout(h as NodeJS.Timeout),
};

export class FakeClock implements Clock {
  private t: number;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  constructor(start = Date.UTC(2026, 10, 27, 1, 0, 0)) { this.t = start; }
  now(): number { return this.t; }
  setTimer(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + Math.max(0, ms), fn });
    return id;
  }
  clearTimer(h: unknown): void { this.timers.delete(h as number); }
  pending(): number { return this.timers.size; }
  /** ms만큼 시간을 보내며 그 사이 타이머를 순서대로 실행한다. 사이사이 비동기 작업이 끝나게 기다린다. */
  async advance(ms: number): Promise<void> {
    const end = this.t + ms;
    for (;;) {
      await flush();
      let next: [number, { at: number; fn: () => void }] | undefined;
      for (const e of this.timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = Math.max(this.t, next[1].at);
      next[1].fn();
    }
    this.t = end;
    await flush();
  }
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise<void>((r) => setImmediate(r));
}
