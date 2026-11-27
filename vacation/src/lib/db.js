import pg from 'pg';
import { cache } from 'react';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// date 는 'YYYY-MM-DD' 문자열, numeric 은 숫자로 받습니다.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

const ON_WORKERS = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

// ── Cloudflare Workers ───────────────────────────────
// Workers 는 요청이 끝나면 연결을 다음 요청에 넘겨줄 수 없습니다.
// 그래서 요청마다 새 풀을 만들고(maxUses: 1 로 연결 재사용 금지), 실제 연결 유지는 Hyperdrive 가 맡습니다.
// Hyperdrive 가 Supabase 까지의 TLS 와 풀링을 처리하므로 여기서는 SSL 설정이 필요 없습니다.
const workersPool = cache(() => {
  const { env } = getCloudflareContext();
  if (!env.HYPERDRIVE) throw new Error('wrangler.jsonc 에 HYPERDRIVE 바인딩이 설정되지 않았습니다.');
  return new pg.Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 5, maxUses: 1 });
});

// ── Node.js (next dev, next start, 스크립트) ─────────
function nodePool() {
  if (!globalThis.__vacationPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    globalThis.__vacationPool = new pg.Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 10_000,
      // Supabase 등 외부 DB는 SSL 필수. 인증서 체인은 호스팅 환경마다 달라 검증은 생략합니다.
      ssl: local || /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalThis.__vacationPool;
}

function pool() {
  return ON_WORKERS ? workersPool() : nodePool();
}

export async function query(text, params = []) {
  const res = await pool().query(text, params);
  return res.rows;
}

export async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

export async function transaction(fn) {
  const client = await pool().connect();
  try {
    await client.query('begin');
    const result = await fn({
      query: async (text, params = []) => (await client.query(text, params)).rows,
    });
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
