#!/usr/bin/env node
// 권고, 엄격 모드 가드: PreToolUse, PostToolUse hook, 역할별 쓰기 경로와 에이전트 호출 대상, 순서 검사
// 차단은 exit 2와 stderr 메시지, 오류, 파싱 실패도 차단(fail closed)
// 보안 경계가 아닌 실수 방지 장치: 메인 세션의 Bash, 사용자, hook 설정 변경은 방어하지 않음
// 전제: 에이전트 호출 인계에 `runId: <id>`, 기획안 상태는 `- Status: confirmed`, 변경 계획 6장 표의 담당은 역할 이름
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { strictMode, verifyRegistration, verifyWrite } from '../subagent/bin/subagent-policy.mjs';
import { isActive, readState, writeState } from '../subagent/bin/subagent-state.mjs';

const DOCS = '.claude-subagent-docs';
const WRITERS = ['frontend-agent', 'backend-agent', 'api-agent', 'test-agent'];
const ANALYSTS = ['planner-agent', 'architecture-agent'];
const ROLES = ['pm-agent', 'planning-lead', 'dev-lead', ...ANALYSTS, ...WRITERS, 'qa-agent'];
const SUBAGENT_ROLES = ROLES.filter((r) => r !== 'pm-agent');
// 서브에이전트 정의는 Agent 호출 대상 제한을 강제하지 않으므로 이 표로 검사
const CALL_TARGETS = {
  'planning-lead': ['planner-agent', 'architecture-agent', 'qa-agent'],
  'dev-lead': WRITERS,
};
const LOCK_TTL_MS = 30 * 60 * 1000;
const CASE_SENSITIVE = process.platform === 'linux';

const norm = (value) => (CASE_SENSITIVE ? value : value.toLowerCase());
const deny = (message) => {
  process.stderr.write(`subagent-guard: ${message}\n`);
  process.exit(2);
};

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return deny('cannot parse hook input');
  }
}

function projectRoot(input) {
  const base = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  // Windows의 8.3 단축 경로(RUNNER~1 등)를 풀어 symlink 검사와 같은 기준으로 비교
  return realpathSync.native(base);
}

// 프로젝트 내부의 일반 경로만 허용: 밖으로 나가는 경로, UNC, 다른 드라이브, symlink, junction 거부
function toRelative(root, filePath) {
  if (typeof filePath !== 'string' || !filePath) return deny('file path missing');
  if (filePath.startsWith('\\\\') || filePath.startsWith('//')) return deny(`UNC paths are not supported: ${filePath}`);
  const abs = resolve(root, filePath);
  const rel = relative(root, abs);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return deny(`path outside the project: ${filePath}`);
  let ancestor = abs;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) return deny(`path resolution failed: ${filePath}`);
    ancestor = parent;
  }
  const expected = join(root, relative(root, ancestor));
  if (norm(realpathSync.native(ancestor)) !== norm(expected)) return deny(`symlink and junction paths are not supported: ${filePath}`);
  return rel.split(sep).join('/');
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|').replace(/^`+|`+$/g, '').trim());
}

function runPaths(root, runId) {
  const dir = join(root, DOCS, 'runs', runId);
  return { dir, request: join(dir, 'request.md'), plan: join(dir, 'plan.md') };
}

function validRunId(runId) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId ?? '');
}

function planConfirmed(root, runId) {
  const text = readText(runPaths(root, runId).plan);
  if (text === null) return false;
  const match = text.match(/^- Status:\s*([A-Za-z-]+)/m);
  return match?.[1] === 'confirmed';
}

// L3 기획은 개발 호출 전에 architecture-agent 보고가 있어야 함(위험도는 기획안 `- Risk:` 줄)
function needsArchitectureReport(root, runId) {
  const risk = readText(runPaths(root, runId).plan)?.match(/^- Risk:\s*(L[123])/m)?.[1];
  if (risk !== 'L3') return false;
  const dir = join(runPaths(root, runId).dir, 'reports');
  return !(existsSync(dir) && readdirSync(dir).some((name) => /^architecture-agent-\d{2}\.md$/.test(name)));
}

// 기획안 6장 표에서 역할에 배정된 구체적 파일 경로 추출, glob은 제외
function assignedFiles(root, runId, role) {
  const text = readText(runPaths(root, runId).plan);
  if (text === null) return [];
  const start = text.search(/^## 6\./m);
  if (start < 0) return [];
  const files = [];
  for (const line of text.slice(start).split(/\r?\n/).slice(1)) {
    if (/^## /.test(line)) break;
    if (!line.trim().startsWith('|') || /^\|\s*-/.test(line.trim())) continue;
    const cells = splitRow(line);
    const file = (cells[1] ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!file || file === 'File' || /[*?[\]]/.test(file) || file.startsWith('/') || file.split('/').includes('..')) continue;
    if (cells[4] === role) files.push(norm(file));
  }
  return files;
}

const lockPath = (root) => join(root, DOCS, '.guard', 'writer.lock.json');

function readLock(root) {
  const text = readText(lockPath(root));
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function acquireLock(root, entry) {
  mkdirSync(dirname(lockPath(root)), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockPath(root), JSON.stringify(entry), { flag: 'wx' });
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const current = readLock(root);
      const stale = !current || Date.now() - (current.startedAt ?? 0) > LOCK_TTL_MS;
      if (!stale) return deny(`another writing agent (${current.subagentType}) is running; call writers one at a time`);
      unlinkSync(lockPath(root));
    }
  }
  return deny('failed to acquire the write lock');
}

// 모든 호출자에게 거부하는 보호 경로
function isProtectedFor(role, rl) {
  if (rl === '.git' || rl.startsWith('.git/')) return true;
  if (rl === `${DOCS}/.guard` || rl.startsWith(`${DOCS}/.guard/`)) return true;
  if (new RegExp(`^${DOCS}/runs/[^/]+/checks(/|$)`).test(rl)) return true;
  // .claude/ 전체가 아닌 워크플로 정책 파일만 보호: 사용자가 .claude/ 아래에 둔 자기 규칙, 명령, 에이전트는 수정 가능
  // 워크플로 역할의 쓰기는 이어지는 계획 배정 검사로 다시 제한됨
  return (
    rl.startsWith('.claude/hooks/') ||
    rl.startsWith('.claude/subagent/') ||
    rl.startsWith('.claude/skills/subagent/') ||
    /^\.claude\/settings(\.local)?\.json$/.test(rl) ||
    ROLES.some((r) => rl === `.claude/agents/${r}.md`)
  );
}

function ownReportRunId(role, rel) {
  const m = rel.match(new RegExp(`^${DOCS}/runs/([^/]+)/(reports/(.+)|plan\\.md|request\\.md)$`));
  if (!m) return null;
  const [, runId, , reportFile] = m;
  const name = reportFile ?? m[2];
  if ([...ANALYSTS, ...WRITERS].includes(role) && new RegExp(`^${role}-\\d{2}\\.md$`).test(reportFile ?? '')) return runId;
  if (role === 'qa-agent' && /^qa-(plan|final)(-\d{2})?\.md$/.test(reportFile ?? '')) return runId;
  if (role === 'dev-lead' && reportFile === 'dev-lead.md') return runId;
  if (role === 'planning-lead' && name === 'plan.md') return runId;
  return null;
}

// /subagent 실행 중 PM의 소스 수정 제한: 등급 미정·Q는 차단, L1은 파일 1개, L2·L3는 서브에이전트만 수정
// 실행 상태는 스킬 로드 때 생성되고 종료 기록이나 갱신 중단 시 해제되어 평소 대화에는 적용되지 않음
function pmRunGate(root, rel) {
  const state = readState(root);
  if (!isActive(state)) return;
  const run = 'node .claude/subagent/bin/subagent-run.mjs';
  if (state.grade === 'pending') return deny(`a /subagent run is active and the request is not classified yet, so the PM cannot edit ${rel}; classify first with \`${run} grade <Q|L1|L2|L3> [runId]\`. If the /subagent work is already finished, run \`${run} close\``);
  if (state.grade === 'Q') return deny(`the request is classified Q (no file changes); raise the grade with \`${run} grade L1|L2|L3\` if edits are needed`);
  if (state.grade !== 'L1') return deny(`${state.grade} edits are made by worker agents on the confirmed plan, not by the PM directly; follow G1 to G4 of the skill`);
  const files = state.l1Files ?? [];
  const key = norm(rel);
  if (!files.includes(key)) {
    if (files.length >= 1) return deny(`L1 allows one file (already edited ${files[0]}); editing a second file means callers or shared files may be affected, so raise the grade with \`${run} grade L2|L3 <runId>\` and follow the L2 and L3 procedure`);
    files.push(key);
  }
  try {
    writeState(root, { ...state, l1Files: files, updatedAt: Date.now() });
  } catch {
    // 상태 갱신 실패로 사용자 작업을 막지 않음
  }
}

function decideWrite(root, input) {
  const role = input.agent_type || 'main';
  const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  const rel = toRelative(root, filePath);
  const rl = rel.toLowerCase();

  const isPm = role === 'main' || role === 'pm-agent';
  // 권고 모드의 프로필 수정은 사용자 요청을 받은 PM에게만 허용
  const strict = strictMode(root);
  if (strict && input.permission_mode !== 'default') return deny('strict mode allows only the default permission mode; do not downgrade automatically');
  const pmProfile = !strict && isPm && rl === '.claude/subagent/profile.md';
  if (!pmProfile && isProtectedFor(role, rl)) return deny(`protected path cannot be modified: ${rel}`);

  if (isPm) {
    if (new RegExp(`^${DOCS}/runs/[^/]+/reports/`).test(rl)) return deny('only the owning agent may write a report file (the PM must not rewrite or re-save it)');
    if (!pmProfile && !rl.startsWith(`${DOCS}/runs/`)) pmRunGate(root, rel);
    if (strict && !rl.startsWith(`${DOCS}/runs/`)) verifyWrite(root, rel, 'pm-agent');
    return;
  }

  if (!SUBAGENT_ROLES.includes(role)) {
    if (strict) return deny('strict mode rejects file edits by unregistered roles');
    return; // 권고 모드에서는 이 워크플로 외의 에이전트에 간섭하지 않음
  }

  // runId는 대소문자를 구분하는 파일시스템에서 실제 폴더명과 일치해야 하므로 원래 경로(rel)에서 추출
  const reportRun = ownReportRunId(role, rel);
  if (reportRun !== null) {
    if (!validRunId(reportRun) || !existsSync(runPaths(root, reportRun).request)) return deny(`run unit (request.md) not found: ${reportRun}`);
    return;
  }
  if (!WRITERS.includes(role)) return deny(`${role} may write only its own report file: ${rel}`);

  const lock = readLock(root);
  if (!lock || lock.subagentType !== role) return deny(`${role} may write only when activated by a call from the PM or dev-lead`);
  if (strict) verifyWrite(root, rel, role, lock.runId);
  if (!planConfirmed(root, lock.runId)) return deny('the plan is not in confirmed status, so source and config writes cannot start');
  if (!assignedFiles(root, lock.runId, role).includes(norm(rel))) return deny(`file not assigned to ${role} in the plan's change table (section 6): ${rel}. Write | inside a table cell as \\| and put only the role name in the Owner column`);
}

// 프로필의 실행 모드가 relay이면 리더는 하위 에이전트를 직접 호출하지 않고 카드만 반환
function relayMode(root) {
  const text = readText(join(root, '.claude/subagent/profile.md'));
  return text !== null && /^- Execution mode:\s*relay\b/m.test(text);
}

function decideAgent(root, input) {
  const caller = input.agent_type || 'main';
  const target = input.tool_input?.subagent_type;
  const prompt = input.tool_input?.prompt ?? '';
  if (!ROLES.includes(target)) {
    if (strictMode(root)) return deny('strict mode rejects calls to unregistered roles');
    return; // 권고 모드에서는 이 워크플로 외의 호출에 간섭하지 않음
  }

  // 백그라운드 호출은 즉시 반환되어 쓰기 잠금이 풀리고 가드가 서브에이전트의 쓰기를 추적하지 못하므로 포그라운드만 허용
  if (input.tool_input?.run_in_background !== false) return deny('call subagents in the foreground: set run_in_background to false (a background call returns at once, so the guard cannot track its writes)');

  if (SUBAGENT_ROLES.includes(caller)) {
    if (relayMode(root)) return deny(`in relay mode ${caller} must not call sub-agents; return call cards for the PM to call`);
    const allowed = CALL_TARGETS[caller] ?? [];
    if (!allowed.includes(target)) return deny(`${caller} cannot call ${target}`);
    if (target === 'qa-agent' && /Mode:\s*final/.test(prompt)) return deny('the PM must call final verification directly');
  }

  // `runId: <id>`가 표준 형식이며 `runId <id>`, `runId=<id>`도 허용
  // 문장 끝의 마침표, 하이픈은 runId에서 제외
  const runId = prompt.match(/runId[\s:=]+([A-Za-z0-9][A-Za-z0-9._-]*)/)?.[1]?.replace(/[._-]+$/, '');
  if (!runId) return deny('the call handoff needs a `- runId: <id>` line');
  if (!existsSync(runPaths(root, runId).request)) return deny(`run unit (request.md) not found: ${runId}`);

  if (target === 'dev-lead' || WRITERS.includes(target)) {
    if (!planConfirmed(root, runId)) return deny('the plan is not in confirmed status, so development calls cannot start');
    if (needsArchitectureReport(root, runId)) return deny('an L3 plan needs an architecture-agent report in reports/ before development calls; call architecture-agent first');
    if (strictMode(root)) {
      if (input.permission_mode !== 'default') return deny('strict mode allows only the default permission mode; do not downgrade automatically');
      verifyRegistration(root, runId);
    }
  }
  if (WRITERS.includes(target)) {
    acquireLock(root, { runId, subagentType: target, toolUseId: input.tool_use_id, startedAt: Date.now() });
  }
}

function releaseLock(root, input) {
  const target = input.tool_input?.subagent_type;
  if (!WRITERS.includes(target)) return;
  const lock = readLock(root);
  if (lock && lock.toolUseId === input.tool_use_id) unlinkSync(lockPath(root));
}

try {
  const input = readInput();
  const root = projectRoot(input);
  const tool = input.tool_name;
  if (input.hook_event_name === 'PreToolUse') {
    if (tool === 'Agent' || tool === 'Task') decideAgent(root, input);
    else decideWrite(root, input);
  } else if (input.hook_event_name === 'PostToolUse' || input.hook_event_name === 'PostToolUseFailure') {
    if (tool === 'Agent' || tool === 'Task') releaseLock(root, input);
  }
  process.exit(0);
} catch (error) {
  deny(`guard error: ${error.message}`);
}
