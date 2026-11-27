// roles.yaml 읽기·검증
import fs from 'node:fs';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { ConfigError, formatIssues } from '../core/config.ts';

z.config(z.locales.ko());

export const ROLE_NAMES = ['implementer', 'researcher', 'tester', 'debugger', 'reviewer', 'releaser'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];
export const ROLE_KO: Record<RoleName, string> = { implementer: '구현', researcher: '조사', tester: '테스트', debugger: '디버거', reviewer: '품질·보안 리뷰어', releaser: '릴리스 정리' };

const Role = z.object({
  model: z.string().optional(),
  tools: z.array(z.string()).optional(),
  read_only: z.boolean().default(false),
  max_turns: z.number().int().positive().optional(),
  max_retries: z.number().int().min(0).max(5).optional(),
}).strict();

const RolesSchema = z.object({
  roles: z.object({
    implementer: Role.prefault({}), researcher: Role.prefault({}), tester: Role.prefault({}),
    debugger: Role.prefault({}), reviewer: Role.prefault({}), releaser: Role.prefault({}),
  }).strict().prefault({}),
  routing: z.object({
    small: z.array(z.enum(['implementer', 'tester'])).default(['implementer', 'tester']),
    medium: z.array(z.enum(['implementer', 'tester'])).default(['implementer', 'tester']),
    large: z.array(z.enum(['implementer', 'tester'])).default(['implementer', 'tester']),
    on_test_fail: z.enum(['debugger', 'none']).default('debugger'),
    review: z.enum(['sensitive', 'always', 'never']).default('sensitive'),
  }).strict().prefault({}),
}).strict();

export type RoleDef = z.infer<typeof Role>;
export type RolesFile = z.infer<typeof RolesSchema>;

export function parseRoles(text: string, file = 'roles.yaml'): RolesFile {
  const doc = parseDocument(text);
  if (doc.errors.length) throw new ConfigError(file, doc.errors.map((e) => `YAML 문법 오류(${e.linePos?.[0]?.line ?? '?'}번째 줄): ${e.code}`));
  const r = RolesSchema.safeParse(doc.toJS() ?? {});
  if (!r.success) throw new ConfigError(file, formatIssues(r.error.issues));
  return r.data;
}

export function loadRoles(file: string): RolesFile {
  return parseRoles(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', file);
}
