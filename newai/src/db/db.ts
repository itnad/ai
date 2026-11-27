import '../core/quiet.ts';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// node:sqlite는 불러오는 순간 실험 기능 경고를 낸다. quiet.ts가 먼저 적용되도록 처음 쓸 때 불러온다.
const require = createRequire(import.meta.url);
let sqlite: typeof import('node:sqlite') | undefined;
function Sqlite(): typeof import('node:sqlite') {
  return (sqlite ??= require('node:sqlite') as typeof import('node:sqlite'));
}

export const SCHEMA_VERSION = 1;
const SCHEMA_FILE = fileURLToPath(new URL('./schema.sql', import.meta.url));

export function openDb(file: string): DatabaseSync {
  const db = new (Sqlite().DatabaseSync)(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const current = row.user_version;
  if (current > SCHEMA_VERSION) throw new Error(`데이터베이스 버전(${current})이 코드(${SCHEMA_VERSION})보다 새롭습니다. newai를 업데이트하세요.`);
  if (current < 1) {
    db.exec('BEGIN');
    try {
      db.exec(fs.readFileSync(SCHEMA_FILE, 'utf8'));
      db.exec('PRAGMA user_version = 1');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return SCHEMA_VERSION;
}

export function listTables(db: DatabaseSync): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((r) => r.name);
}
