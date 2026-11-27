// 사용법: DATABASE_URL=... npm run db:init
// db/schema.sql 과 db/holidays.sql 을 순서대로 실행합니다. 여러 번 실행해도 안전합니다.
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL 환경변수가 필요합니다.');
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: local || /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false },
});

await client.connect();
for (const file of ['schema.sql', 'holidays.sql']) {
  const sql = await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8');
  await client.query(sql);
  console.log(`✔ ${file}`);
}
await client.end();
