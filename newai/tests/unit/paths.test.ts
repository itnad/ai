import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ensureHome, findInstallDir, layout, resolveHome, separationProblems } from '../../src/core/paths.ts';

test('데이터 폴더: NEWAI_HOME > Windows APPDATA > ~/.newai', () => {
  assert.equal(resolveHome({ NEWAI_HOME: '/x/y' }, 'linux', '/home/u'), '/x/y');
  assert.equal(resolveHome({ APPDATA: 'C:\\Users\\u\\AppData\\Roaming' }, 'win32', 'C:\\Users\\u'), 'C:\\Users\\u\\AppData\\Roaming\\newai');
  assert.equal(resolveHome({}, 'win32', 'C:\\Users\\u'), 'C:\\Users\\u\\AppData\\Roaming\\newai');
  assert.equal(resolveHome({}, 'linux', '/home/u'), '/home/u/.newai');
  assert.equal(resolveHome({ NEWAI_HOME: '  ' }, 'darwin', '/Users/u'), '/Users/u/.newai');
});

test('설치 폴더는 코드 위치에서 찾는다(데이터 폴더와 무관)', () => {
  const dir = findInstallDir();
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name, 'newai');
});

test('폴더가 겹치면 경고', () => {
  assert.equal(separationProblems({ installDir: '/opt/newai', home: '/home/u/.newai' }, 'linux').length, 0);
  assert.equal(separationProblems({ installDir: '/opt/newai', home: '/opt/newai/data' }, 'linux').length, 1);
  assert.equal(separationProblems({ installDir: 'C:\\newai', home: 'c:/NEWAI/data' }, 'win32').length, 1);
});

test('ensureHome은 기본 파일을 만들고, 있는 파일은 덮어쓰지 않는다', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'newai-home-'));
  const p = { installDir: findInstallDir(), home };
  const first = ensureHome(p);
  const L = layout(home);
  for (const f of [L.config, L.policy, L.servers, path.join(L.pipelinesDir, 'default.yaml')]) assert.ok(fs.existsSync(f), f);
  assert.ok(first.created.length > 5);
  fs.writeFileSync(L.config, 'language: en\n');
  const second = ensureHome(p);
  assert.equal(second.created.length, 0);
  assert.equal(fs.readFileSync(L.config, 'utf8'), 'language: en\n');
});
