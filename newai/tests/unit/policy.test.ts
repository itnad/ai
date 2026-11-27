import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { Policy, PolicyError, type Level } from '../../src/safety/policy.ts';

const TEMPLATE = fs.readFileSync(path.join(import.meta.dirname, '../../templates/policy.yaml'), 'utf8');
const linux = Policy.parse(TEMPLATE, { installDir: '/opt/newai', home: '/home/u/.newai', platform: 'linux' });
const win = Policy.parse(TEMPLATE, { installDir: 'C:\\tools\\newai', home: 'C:\\Users\\u\\AppData\\Roaming\\newai', platform: 'win32' });

const BASH: [string, Level][] = [
  ['git status', 'allow'],
  ['npm test', 'allow'],
  ['node server.js', 'allow'],
  ['rm -rf node_modules', 'allow'],
  ['rm -rf dist build', 'allow'],
  ['git push', 'deny'],
  ['git push origin main', 'deny'],
  ['git -C sub push --force', 'deny'],
  ['ls && git push origin HEAD', 'deny'],
  ["bash -c 'git push'", 'deny'],
  ['gh pr create --fill', 'deny'],
  ['npm publish', 'deny'],
  ['vercel --prod', 'deny'],
  ['git reset --hard HEAD~3', 'human'],
  ['git clean -fdx', 'human'],
  ['git rebase -i main', 'human'],
  ['git branch -D feature', 'human'],
  ['rm -rf /', 'human'],
  ['rm -rf ~/projects', 'human'],
  ['rm -rf ../other', 'human'],
  ['rm -rf *', 'human'],
  ['find . -name "*.log" -delete', 'human'],
  ['Remove-Item -Recurse -Force C:\\data', 'human'],
  ['psql -c "DROP TABLE users"', 'human'],
  ['sqlite3 app.db "delete from users;"', 'human'],
  ['sqlite3 app.db "delete from users where id=3"', 'allow'],
  ['npx prisma migrate reset', 'human'],
  ['setx PATH foo', 'human'],
  ['curl https://example.com', 'wait'],
  ['curl -s http://localhost:3000/health', 'allow'],
  ['curl http://127.0.0.1:5173 && curl https://evil.example', 'wait'],
  ['ssh deploy@server', 'wait'],
  ['npm install express', 'wait'],
  ['git clone https://github.com/x/y', 'wait'],
  ['env -u GIT_CONFIG_COUNT git status', 'human'],
  ['unset GIT_CONFIG_COUNT', 'human'],
  ['export GIT_CONFIG_COUNT=0', 'human'],
  ['git -c url.x.pushInsteadOf= fetch', 'human'],
  ['cat .env', 'human'],
  ['cp .env.example .env.local', 'human'],
  ['cat .env.example', 'allow'],
  ['cat ~/.ssh/id_rsa', 'human'],
  ['cat ~/.ssh/id_rsa.pub', 'allow'],
  ['echo hi > /opt/newai/src/x.ts', 'human'],
  ['sed -i s/a/b/ /home/u/.newai/policy.yaml', 'human'],
];

for (const [cmd, expected] of BASH) {
  test(`Bash 판정: ${cmd} → ${expected}`, () => {
    const v = linux.classifyBash(cmd);
    assert.equal(v.level, expected, `${cmd}: ${v.level} (${v.reason})`);
  });
}

test('Windows: 보호 경로는 표기가 달라도 잡힌다', () => {
  assert.equal(win.classifyBash('echo x > c:/TOOLS/newai/src/a.ts').level, 'human');
  assert.equal(win.classifyBash('copy a.txt C:\\Tools\\NewAI\\src\\').level, 'human');
  assert.equal(win.classifyWrite('C:/Users/u/AppData/Roaming/newai/policy.yaml', 'C:\\proj').level, 'human');
});

test('파일 쓰기: 작업 폴더 안 허용, 밖 대기, 보호·비밀 사람 승인', () => {
  assert.equal(linux.classifyWrite('src/app.ts', '/work/p').level, 'allow');
  assert.equal(linux.classifyWrite('/work/p/README.md', '/work/p').level, 'allow');
  assert.equal(linux.classifyWrite('../other/x', '/work/p').level, 'wait');
  assert.equal(linux.classifyWrite('/work/p2/x', '/work/p').level, 'wait');
  assert.equal(linux.classifyWrite('/opt/newai/src/core/paths.ts', '/work/p').level, 'human');
  assert.equal(linux.classifyWrite('/home/u/.newai/config.yaml', '/work/p').level, 'human');
  assert.equal(linux.classifyWrite('.env', '/work/p').level, 'human');
  assert.equal(win.classifyWrite('C:\\proj\\src\\a.ts', 'c:/PROJ').level, 'allow');
  assert.equal(win.classifyWrite('D:\\x', 'C:\\proj').level, 'wait');
});

test('파일 읽기: 비밀 파일만 사람 승인', () => {
  assert.equal(linux.classifyRead('.env.production', '/work/p').level, 'human');
  assert.equal(linux.classifyRead('src/env.ts', '/work/p').level, 'allow');
  assert.equal(linux.classifyRead('/home/u/.newai/secrets.yaml', '/work/p').level, 'human');
});

test('주소: 이 PC 안은 허용, 밖은 대기', () => {
  assert.equal(linux.classifyUrl('http://localhost:5173/').level, 'allow');
  assert.equal(linux.classifyUrl('http://127.0.0.1:47321/api').level, 'allow');
  assert.equal(linux.classifyUrl('http://[::1]:3000').level, 'allow');
  assert.equal(linux.classifyUrl('http://app.localhost').level, 'allow');
  assert.equal(linux.classifyUrl('https://example.com').level, 'wait');
  assert.equal(linux.classifyUrl('file:///etc/passwd').level, 'wait');
  assert.equal(linux.classifyUrl('아무거나').level, 'wait');
});

test('자동 선택 제외 문구', () => {
  assert.ok(linux.isAutoSelectExcluded('원격에 푸시'));
  assert.ok(linux.isAutoSelectExcluded('Push to origin'));
  assert.ok(linux.isAutoSelectExcluded('프로덕션 배포'));
  assert.ok(!linux.isAutoSelectExcluded('로컬 커밋만'));
  assert.ok(!linux.isAutoSelectExcluded('웹 화면'));
});

test('정책 파일 오류는 한국어로 위치를 알려 준다', () => {
  assert.throws(() => Policy.parse('version: 1\nbash:\n  - { level: maybe, match: x }\n', { installDir: '/a', home: '/b' }), (e: unknown) => e instanceof PolicyError && /bash\.0\.level/.test(e.message));
  assert.throws(() => Policy.parse('version: 1\nbash:\n  - { level: deny, match: "(" }\n', { installDir: '/a', home: '/b' }), /정규식 오류/);
  assert.throws(() => Policy.parse('version: 1\nprotected_paths: ["${NOPE}/x"]\n', { installDir: '/a', home: '/b' }), /알 수 없는 변수/);
});

test('정책 파일로 기본 규칙(push 차단 우회 감지)을 끌 수 없다', () => {
  const empty = Policy.parse('version: 1\n', { installDir: '/a', home: '/b', platform: 'linux' });
  assert.equal(empty.classifyBash('git status').level, 'allow');
  assert.equal(empty.classifyBash('unset GIT_CONFIG_COUNT').level, 'human');
});

test('명령 이름이 파일·폴더 이름 일부일 때는 잡지 않는다', () => {
  assert.equal(linux.classifyBash('ls ~/.ssh').level, 'allow');
  assert.equal(linux.classifyBash('cat notes/curl.txt').level, 'allow');
  assert.equal(linux.classifyBash('git commit -m "push 버튼 문구 수정"').level, 'allow');
  assert.equal(linux.classifyBash('cd app && ssh host').level, 'wait');
});
