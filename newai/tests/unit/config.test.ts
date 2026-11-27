import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ConfigError, loadConfig, parseConfigText, parseDuration, setConfigValue } from '../../src/core/config.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'newai-cfg-'));

test('파일이 없으면 기본값', () => {
  const c = loadConfig(path.join(tmp(), 'none.yaml'));
  assert.equal(c.decision.timeout, '1m');
  assert.equal(c.server.port, 47321);
  assert.equal(c.projects.commit_default, false);
  assert.equal(c.scoring.weights.goal, 30);
});

test('템플릿 config.yaml이 검증을 통과한다', () => {
  const c = loadConfig(path.join(import.meta.dirname, '../../templates/config.yaml'));
  assert.equal(c.language, 'ko');
});

test('잘못된 대기 시간과 오타 키는 한국어 오류', () => {
  try {
    parseConfigText('decision:\n  timeout: 30s\n  timout: 1m\n');
    assert.fail('오류가 나야 함');
  } catch (e) {
    assert.ok(e instanceof ConfigError);
    const msg = e.message;
    assert.match(msg, /decision\.timeout/);
    assert.match(msg, /중 하나여야/);
    assert.match(msg, /인식할 수 없는 키/);
  }
});

test('YAML 문법 오류는 줄 번호와 함께', () => {
  assert.throws(() => parseConfigText('decision:\n  timeout: [1m\n'), /YAML 문법 오류/);
});

test('setConfigValue는 주석을 지키고, 잘못된 값이면 파일을 건드리지 않는다', async () => {
  const f = path.join(tmp(), 'config.yaml');
  fs.copyFileSync(path.join(import.meta.dirname, '../../templates/config.yaml'), f);
  const c = await setConfigValue(f, 'decision.timeout', '5m');
  assert.equal(c.decision.timeout, '5m');
  const text = fs.readFileSync(f, 'utf8');
  assert.match(text, /timeout: 5m/);
  assert.match(text, /사람이 고르지 않을 때 기다리는 시간/);
  await assert.rejects(setConfigValue(f, 'decision.timeout', '30s'), ConfigError);
  assert.equal(fs.readFileSync(f, 'utf8'), text);
  await setConfigValue(f, 'runner.max_concurrent', '3');
  assert.equal(loadConfig(f).runner.max_concurrent, 3);
});

test('parseDuration', () => {
  assert.equal(parseDuration('20s'), 20_000);
  assert.equal(parseDuration('10m'), 600_000);
  assert.equal(parseDuration('2h'), 7_200_000);
  assert.throws(() => parseDuration('1d'));
});
