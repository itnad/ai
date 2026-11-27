// 서버가 옛 코드로 계속 도는 것을 막기 위한 코드 버전(설치 폴더 내용의 해시).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const INCLUDE = ['src', 'bin', 'templates', 'package.json'];

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
}

export function computeCodeVersion(installDir: string): string {
  const files: string[] = [];
  for (const name of INCLUDE) {
    const p = path.join(installDir, name);
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) walk(p, files); else files.push(p);
  }
  const h = createHash('sha256');
  for (const f of files.map((f) => path.relative(installDir, f).replace(/\\/g, '/')).sort()) {
    h.update(f).update('\0').update(fs.readFileSync(path.join(installDir, f))).update('\0');
  }
  return h.digest('hex').slice(0, 12);
}
