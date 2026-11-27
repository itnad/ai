import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { readFileRetry, writeFileAtomic } from '../../src/core/atomicFile.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'newai-atomic-'));

test('쓰는 중에 읽어도 반쯤 쓴 내용이 보이지 않는다', async () => {
  const f = path.join(tmp(), 'server.port');
  await writeFileAtomic(f, '00000');
  const big = (n: number) => String(n).repeat(20000);
  let stop = false;
  const seen = new Set<string>();
  const reader = (async () => {
    while (!stop) { seen.add((await readFileRetry(f)).slice(0, 1) + ':' + (await readFileRetry(f)).length); }
  })();
  for (let i = 1; i <= 9; i++) await writeFileAtomic(f, big(i));
  stop = true;
  await reader;
  for (const s of seen) {
    const len = Number(s.split(':')[1]);
    assert.ok(len === 5 || len === 20000, `부분 내용 발견: ${s}`);
  }
  assert.equal(fs.readdirSync(path.dirname(f)).filter((x) => x.endsWith('.tmp')).length, 0, '임시 파일이 남으면 안 됨');
});

test('EBUSY는 재시도하고, ENOENT는 바로 실패', async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
    return '47321';
  };
  assert.equal(await readFileRetry('x', { readFn: flaky, firstDelayMs: 5 }), '47321');
  assert.equal(calls, 3);
  await assert.rejects(readFileRetry(path.join(tmp(), 'none')), { code: 'ENOENT' });
});

test('EBUSY가 계속되면 시간 상한 후 실패', async () => {
  const always = async (): Promise<string> => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }); };
  const t0 = Date.now();
  await assert.rejects(readFileRetry('x', { readFn: always, timeoutMs: 150, firstDelayMs: 10 }), { code: 'EBUSY' });
  assert.ok(Date.now() - t0 < 1000);
});
