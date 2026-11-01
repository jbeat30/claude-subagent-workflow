// 역할 목록: 기본 역할과 사용자가 추가한 역할(.claude/subagent/roles.local.json)을 합쳐 가드, 정책, 설치기가 같은 기준으로 판정
// 추가 역할은 writer 또는 analyst만 가능, 형식이 틀리거나 정의 파일이 없는 항목은 무시(워크플로 역할로 인정하지 않음)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROLES_LOCAL = '.claude/subagent/roles.local.json';
export const BUILTIN_WRITERS = ['frontend-agent', 'backend-agent', 'api-agent', 'test-agent'];
export const BUILTIN_ANALYSTS = ['planner-agent', 'architecture-agent'];
export const BUILTIN_ROLES = ['planning-lead', 'dev-lead', ...BUILTIN_ANALYSTS, ...BUILTIN_WRITERS, 'qa-agent'];
export const CUSTOM_KINDS = ['writer', 'analyst'];
// 추가 역할의 도구 상한: writer는 셸 없이 읽기와 쓰기, analyst는 자기 보고서 쓰기만(가드가 경로를 다시 제한)
const CONTEXT7 = ['mcp__context7__resolve-library-id', 'mcp__context7__query-docs'];
export const KIND_TOOLS = {
  writer: ['Read', 'Glob', 'Grep', 'Edit', 'Write', ...CONTEXT7],
  analyst: ['Read', 'Glob', 'Grep', 'Write', ...CONTEXT7],
};

// 플러그인 역할은 `subagent-workflow:backend-agent`처럼 플러그인 이름이 붙어 들어오므로 떼고 비교
export const PLUGIN_NAME = 'subagent-workflow';
export function roleName(value) {
  if (typeof value !== 'string') return value;
  return value.startsWith(`${PLUGIN_NAME}:`) ? value.slice(PLUGIN_NAME.length + 1) : value;
}

export function validRoleName(name) {
  return typeof name === 'string' && /^[a-z][a-z0-9-]{1,40}-agent$/.test(name) && !BUILTIN_ROLES.includes(name) && name !== 'pm-agent';
}

// 추가 역할 목록 읽기, 파일이 없거나 깨졌으면 빈 목록
export function customRoles(root) {
  const file = join(root, ROLES_LOCAL);
  if (!existsSync(file)) return [];
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  const seen = new Set();
  return (Array.isArray(data?.roles) ? data.roles : []).filter((r) => {
    const ok = validRoleName(r?.name) && CUSTOM_KINDS.includes(r?.kind) && !seen.has(r.name) && existsSync(join(root, '.claude', 'agents', `${r.name}.md`));
    if (ok) seen.add(r.name);
    return ok;
  }).map((r) => ({ name: r.name, kind: r.kind }));
}

export function loadRoles(root) {
  const custom = customRoles(root);
  const writers = [...BUILTIN_WRITERS, ...custom.filter((r) => r.kind === 'writer').map((r) => r.name)];
  const analysts = [...BUILTIN_ANALYSTS, ...custom.filter((r) => r.kind === 'analyst').map((r) => r.name)];
  return { writers, analysts, custom, all: ['planning-lead', 'dev-lead', ...analysts, ...writers, 'qa-agent'] };
}
