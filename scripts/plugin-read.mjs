#!/usr/bin/env node
// 플러그인 자체 파일 읽기 허용 hook(PreToolUse: Read, Glob, Grep)
// PM과 역할은 플러그인 폴더의 양식, 규칙 문서를 읽어야 하는데 플러그인 폴더는 사용자 프로젝트 밖이라 읽을 때마다 권한 확인이 필요함
// 대상 경로의 실제 위치가 이 플러그인 폴더 안이면 allow를 돌려주고, 그 밖은 아무 결정도 하지 않음(원래 권한 흐름 그대로)
// 차단(exit 2)은 하지 않으며 입력 오류도 결정 없이 통과, 사용자의 deny 규칙은 Claude Code가 계속 적용
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = realpathSync.native(join(dirname(fileURLToPath(import.meta.url)), '..'));
const CASE_INSENSITIVE = process.platform !== 'linux';

// 존재하는 가장 가까운 상위까지 실제 경로로 풀어 바로가기로 플러그인 밖을 가리키는 경우를 걸러냄
function realPath(path) {
  let current = path;
  const rest = [];
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return null;
    rest.unshift(current.slice(parent.length).replace(/^[\\/]+/, ''));
    current = parent;
  }
  return join(realpathSync.native(current), ...rest);
}

export function insidePlugin(target, root = PLUGIN_ROOT) {
  const real = realPath(target);
  if (!real) return false;
  const rel = relative(CASE_INSENSITIVE ? root.toLowerCase() : root, CASE_INSENSITIVE ? real.toLowerCase() : real);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('..'));
}

export function decide(input, root = PLUGIN_ROOT) {
  const raw = input?.tool_input?.file_path ?? input?.tool_input?.path;
  if (typeof raw !== 'string' || raw === '' || /^(\\\\|\/\/)/.test(raw)) return null;
  const target = isAbsolute(raw) ? raw : resolve(input.cwd || process.cwd(), raw);
  if (!insidePlugin(target, root)) return null;
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'reading a file of the subagent-workflow plugin itself' } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync.native(process.argv[1])) {
  try {
    const result = decide(JSON.parse(readFileSync(0, 'utf8')));
    if (result) process.stdout.write(JSON.stringify(result));
  } catch {
    // 결정 없이 통과
  }
  process.exit(0);
}
