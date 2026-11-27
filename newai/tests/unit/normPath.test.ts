import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isInside, normPath, samePath } from '../../src/core/normPath.ts';

const win = { platform: 'win32' as const };
const posix = { platform: 'linux' as const, realpath: false };

test('Windows: 슬래시 방향·대소문자·끝 슬래시가 달라도 같은 폴더', () => {
  assert.equal(normPath('C:/a', win), 'c:/a');
  assert.ok(samePath('C:/a', 'C:\\a', win));
  assert.ok(samePath('c:\\A\\', 'C:/a', win));
  assert.ok(samePath('C:\\Users\\Kim\\proj', 'c:/users/kim/proj/', win));
});

test('Windows: Git Bash 표기(/c/a)와 \\\\?\\ 접두사', () => {
  assert.ok(samePath('/c/Users/x', 'C:\\Users\\x', win));
  assert.ok(samePath('\\\\?\\C:\\a', 'C:/a', win));
});

test('Windows: 드라이브 루트는 슬래시를 유지', () => {
  assert.equal(normPath('C:\\', win), 'c:/');
});

test('Windows: 상대 경로는 기준 폴더에서', () => {
  assert.equal(normPath('src\\x.ts', { ...win, cwd: 'C:\\proj' }), 'c:/proj/src/x.ts');
  assert.equal(normPath('..\\other', { ...win, cwd: 'C:/proj' }), 'c:/other');
});

test('isInside: 접두사가 같아도 다른 폴더는 밖', () => {
  assert.ok(isInside('C:\\a\\b.txt', 'C:/a', win));
  assert.ok(isInside('C:/a', 'c:\\A\\', win));
  assert.ok(!isInside('C:/ab', 'C:/a', win));
  assert.ok(!isInside('D:/a/x', 'C:/a', win));
  assert.ok(isInside('/home/u/p/x', '/home/u/p', posix));
  assert.ok(!isInside('/home/u/p2', '/home/u/p', posix));
  assert.ok(isInside('anything', '/', posix));
});

test('Linux: 대소문자는 구분하고 끝 슬래시는 무시', () => {
  assert.ok(!samePath('/a/B', '/a/b', posix));
  assert.ok(samePath('/a/b/', '/a/b', posix));
  assert.equal(normPath('/a/./b/../c', posix), '/a/c');
});
