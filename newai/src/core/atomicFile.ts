// Windows에서 다른 프로세스가 쓰는 중인 파일을 읽으면 EBUSY/EPERM이 난다.
// 쓰기는 임시 파일 + rename(원자적), 읽기는 짧게 재시도한다.
import { randomBytes } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

const RETRY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'EAGAIN']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && RETRY_CODES.has((e as NodeJS.ErrnoException).code ?? '');
}

export interface RetryOptions {
  /** 전체 재시도 시간 상한(ms). 기본 2000. */
  timeoutMs?: number;
  /** 첫 대기(ms). 매번 2배, 최대 400ms. 기본 50. */
  firstDelayMs?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const deadline = Date.now() + (opts.timeoutMs ?? 2000);
  let delay = opts.firstDelayMs ?? 50;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (!isRetryable(e) || Date.now() + delay > deadline) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 400);
    }
  }
}

export async function writeFileAtomic(file: string, data: string | Uint8Array, opts: RetryOptions & { mode?: number } = {}): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  const fh = await fsp.open(tmp, 'w', opts.mode);
  try {
    await fh.writeFile(data);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await withRetry(() => fsp.rename(tmp, file), opts);
  } catch (e) {
    await fsp.rm(tmp, { force: true });
    throw e;
  }
}

export type ReadFn = (file: string) => Promise<string>;

export async function readFileRetry(file: string, opts: RetryOptions & { readFn?: ReadFn } = {}): Promise<string> {
  const read = opts.readFn ?? ((f: string) => fsp.readFile(f, 'utf8'));
  return withRetry(() => read(file), opts);
}
