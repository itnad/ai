#!/usr/bin/env node
// Node 22.18 이상은 TypeScript를 빌드 없이 실행한다.
import { main } from '../src/cli/harness.ts';
main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e); process.exit(70); });
