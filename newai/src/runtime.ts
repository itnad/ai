// 실행에 필요한 것들을 한곳에서 조립한다(CLI·E2E·서버가 함께 씀).
// modelOverride는 메모리에서만 바꾼다. 실제 설정 파일은 건드리지 않는다.
import './core/quiet.ts';
import type { DatabaseSync } from 'node:sqlite';
import { loadConfig, parseDuration, type Config } from './core/config.ts';
import { detectEnv, summarizeEnv } from './core/env-detect.ts';
import { ensureHome, getPaths, layout, type HomeLayout, type Paths } from './core/paths.ts';
import { openDb } from './db/db.ts';
import { ClaudeScorer } from './decision/claudeScorer.ts';
import { DecisionEngine } from './decision/engine.ts';
import type { Scorer } from './decision/scorer.ts';
import { SqliteDecisionStore } from './decision/store.ts';
import { buildAgentEnv, ensureBlockerScripts } from './safety/git-env.ts';
import { Policy } from './safety/policy.ts';
import { SdkDriver, type SessionDriver } from './runner/driver.ts';
import { loadRoles, ROLE_NAMES, type RolesFile } from './runner/roles.ts';
import { Runner, type RunnerEvent } from './runner/runner.ts';
import { ClaudeSizer, type Sizer } from './runner/sizer.ts';
import { ClaudeTail, type TailConverter } from './runner/tail.ts';

export interface Runtime {
  paths: Paths;
  L: HomeLayout;
  config: Config;
  roles: RolesFile;
  policy: Policy;
  db: DatabaseSync;
  engine: DecisionEngine;
  runner: Runner;
  envSummary: string;
}

export interface RuntimeOptions {
  home?: string;
  /** 시험용: 모든 역할·판단 모델을 이 모델로(설정 파일은 그대로) */
  modelOverride?: string;
  driver?: SessionDriver;
  scorer?: Scorer;
  sizer?: Sizer;
  tail?: TailConverter;
  onEvent?: (e: RunnerEvent) => void;
  skipEnvDetect?: boolean;
}

export async function createRuntime(o: RuntimeOptions = {}): Promise<Runtime> {
  const paths = getPaths({ home: o.home });
  ensureHome(paths);
  const L = layout(paths.home);
  const config = loadConfig(L.config);
  const roles = loadRoles(L.roles);
  if (o.modelOverride) {
    config.runner.model = o.modelOverride;
    config.scoring.model = o.modelOverride;
    for (const n of ROLE_NAMES) roles.roles[n].model = o.modelOverride;
  }
  const policy = Policy.load(L.policy, paths);
  const db = openDb(L.db);
  const judge = { model: config.scoring.model, sandboxDir: L.judgeSandbox };
  const engine = new DecisionEngine({
    scorer: o.scorer ?? new ClaudeScorer(judge),
    weights: config.scoring.weights,
    timeoutMs: parseDuration(config.decision.timeout),
    isExcluded: (t) => policy.isAutoSelectExcluded(t),
    store: new SqliteDecisionStore(db),
  });
  engine.restore();
  ensureBlockerScripts(L.bin);
  const envSummary = o.skipEnvDetect ? '' : summarizeEnv(await detectEnv());
  const runner = new Runner({
    db, config, roles, policy, paths, engine,
    driver: o.driver ?? new SdkDriver(),
    sizer: o.sizer ?? new ClaudeSizer(judge),
    tail: o.tail ?? new ClaudeTail(judge),
    agentEnv: buildAgentEnv(process.env, { binDir: L.bin }),
    envSummary,
    onEvent: o.onEvent,
  });
  return { paths, L, config, roles, policy, db, engine, runner, envSummary };
}
