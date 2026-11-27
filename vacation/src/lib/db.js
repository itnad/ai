import pg from 'pg';

// date 는 'YYYY-MM-DD' 문자열, numeric 은 숫자로 받습니다.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 환경변수가 설정되지 않았습니다.');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return new pg.Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    // Supabase 등 외부 DB는 SSL 필수. 인증서 체인은 호스팅 환경마다 달라 검증은 생략합니다.
    ssl: local || /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false },
  });
}

function pool() {
  globalThis.__vacationPool ??= createPool();
  return globalThis.__vacationPool;
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
