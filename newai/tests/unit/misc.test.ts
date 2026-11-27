import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { detectExplicitLanguage, koreanRatio, resolveLanguage } from '../../src/core/lang.ts';
import { computeCodeVersion } from '../../src/core/version.ts';
import { listTables, openDb } from '../../src/db/db.ts';

const tmp = (p: string) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const BIN = path.join(import.meta.dirname, '../../bin/harness.js');

test('언어 우선순위: 사용자 명시 > 프로젝트 > 전역 > 한국어', () => {
  assert.equal(resolveLanguage({}), 'ko');
  assert.equal(resolveLanguage({ config: 'ko', project: 'en' }), 'en');
  assert.equal(resolveLanguage({ explicit: 'ja', config: 'ko', project: 'en' }), 'ja');
  assert.equal(detectExplicitLanguage('보고서는 영어로 써 줘'), 'en');
  assert.equal(detectExplicitLanguage('Please answer in Korean'), 'ko');
  assert.equal(detectExplicitLanguage('할 일 앱 만들어 줘'), null);
});

test('한글 비율은 코드 블록과 주소를 빼고 센다', () => {
  assert.ok(koreanRatio('실행 방법: 아래 명령을 실행합니다.\n```bash\nnpm install && npm run dev -- --port 3000\n```') > 0.9);
  assert.ok(koreanRatio('Done. Run npm start to launch.') < 0.1);
});

test('데이터베이스: 표 생성, 다시 열어도 그대로', () => {
  const f = path.join(tmp('newai-db-'), 'newai.db');
  const db = openDb(f);
  const tables = listTables(db);
  for (const t of ['projects', 'jobs', 'sessions', 'events', 'decisions', 'interruptions', 'rules', 'project_history', 'schedules', 'kv']) assert.ok(tables.includes(t), t);
  db.prepare("INSERT INTO jobs(id, kind, request, status, created_at) VALUES ('j1','chat','테스트','queued','2026-11-27')").run();
  db.close();
  const db2 = openDb(f);
  assert.equal((db2.prepare('SELECT count(*) AS n FROM jobs').get() as { n: number }).n, 1);
  assert.equal((db2.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 1);
  assert.throws(() => db2.prepare("INSERT INTO jobs(id, kind, request, status, created_at) VALUES ('j2','chat','x','이상한상태','t')").run());
  db2.close();
});

test('코드 버전은 내용이 바뀌면 바뀐다', () => {
  const d = tmp('newai-ver-');
  fs.mkdirSync(path.join(d, 'src'));
  fs.writeFileSync(path.join(d, 'package.json'), '{"name":"newai"}');
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;');
  const v1 = computeCodeVersion(d);
  assert.equal(computeCodeVersion(d), v1);
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 2;');
  assert.notEqual(computeCodeVersion(d), v1);
});

test('CLI: policy check 종료 코드와 config set', () => {
  const home = tmp('newai-cli-');
  const run = (...a: string[]) => spawnSync(process.execPath, [BIN, ...a, '--home', home], { encoding: 'utf8' });
  let r = run('policy', 'check', 'git push origin main');
  assert.equal(r.status, 12);
  assert.match(r.stdout, /판정: deny \(거부\)/);
  assert.equal(r.stderr, '', '경고가 섞이면 안 됨');
  assert.equal(run('policy', 'check', 'git status').status, 0);
  assert.equal(run('policy', 'check', 'npm install x').status, 10);
  assert.equal(run('policy', 'check', 'git reset --hard').status, 11);
  assert.equal(run('policy', 'check', '--url', 'http://localhost:3000').status, 0);
  assert.equal(run('policy', 'check', '--option', '원격 저장소에 푸시').status, 11);
  r = run('config', 'set', 'decision.timeout', '30s');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /중 하나여야/);
  assert.equal(run('config', 'set', 'decision.timeout', '20s').status, 0);
  r = run('config', 'get', 'decision.timeout');
  assert.equal(r.stdout.trim(), '20s');
  assert.equal(run('없는명령').status, 2);
});
