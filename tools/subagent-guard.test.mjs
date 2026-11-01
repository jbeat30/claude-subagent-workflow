// subagent-guard hook 단위 검사, 임시 프로젝트에서 실행
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, realpathSync, utimesSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'run', 'scripts', 'subagent-guard.mjs');
const RUN = 'R1';

function plan(status, rows) {
  const table = rows.map(([file, who]) => `| 1 | \`${file}\` | 아니오 | modify | ${who} |`).join('\n');
  return `# Plan\n\n- runId: ${RUN}\n- Status: ${status}\n\n## 6. 변경 계획\n\n| Order | File | New file | Work | Owner |\n| --- | --- | --- | --- | --- |\n${table}\n\n- 금지 영역:\n\n## 7. 완료 기준\n`;
}

function project({ status = 'confirmed', rows = [['src/a.js', 'backend-agent'], ['test/a.test.js', 'test-agent'], ['src/*.js', 'backend-agent']] } = {}) {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'subagent-guard-')));
  const runDir = join(dir, '.claude-subagent-docs', 'runs', RUN);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, 'request.md'), '요청\n');
  writeFileSync(join(runDir, 'plan.md'), plan(status, rows));
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

function guard(dir, input) {
  const result = spawnSync(process.execPath, [script], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    input: typeof input === 'string' ? input : JSON.stringify({ cwd: dir, ...input }),
    encoding: 'utf8',
  });
  return { allowed: result.status === 0, status: result.status, stderr: result.stderr };
}

const write = (dir, agent, filePath) =>
  guard(dir, { hook_event_name: 'PreToolUse', tool_name: 'Write', agent_type: agent, tool_input: { file_path: filePath } });
const card = (extra = '') => `# 작업 카드\n\n- runId: ${RUN}\n${extra}`;
const call = (dir, caller, target, prompt = card(), toolUseId = 'toolu_1', background = false) =>
  guard(dir, { hook_event_name: 'PreToolUse', tool_name: 'Agent', agent_type: caller, tool_use_id: toolUseId, tool_input: { subagent_type: target, prompt, run_in_background: background } });
const post = (dir, target, toolUseId = 'toolu_1') =>
  guard(dir, { hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: toolUseId, tool_input: { subagent_type: target } });
const reports = (name) => join('.claude-subagent-docs', 'runs', RUN, 'reports', name);

test('PM: 일반 파일과 요청·기획안은 허용, 보고·검사 기록·정책·git·가드는 거부', () => {
  const dir = project();
  assert.equal(write(dir, 'pm-agent', 'src/new.js').allowed, true);
  assert.equal(write(dir, undefined, 'src/new.js').allowed, true);
  assert.equal(write(dir, 'pm-agent', '.claude-subagent-docs/runs/R1/plan.md').allowed, true);
  assert.equal(write(dir, 'pm-agent', '.claude/subagent/profile.md').allowed, true);
  for (const p of [reports('planner-agent-01.md'), '.claude-subagent-docs/runs/R1/checks/01/record.json', '.claude/agents/pm-agent.md', '.claude/subagent/roles.local.json', '.claude/settings.json', '.git/config', '.claude-subagent-docs/.guard/writer.lock.json']) {
    assert.equal(write(dir, 'pm-agent', p).allowed, false, p);
  }
});

test('.claude/ 아래 사용자 규칙은 PM도 수정 가능하고 워크플로 설정 파일, settings, 역할 정의만 거부', () => {
  const dir = project();
  for (const p of ['.claude/rules/style.md', '.claude/commands/mine.md', '.claude/agents/mine.md', '.claude/skills/mine/SKILL.md', '.claude/hooks/mine.mjs']) {
    assert.equal(write(dir, 'pm-agent', p).allowed, true, p);
    assert.equal(write(dir, undefined, p).allowed, true, p);
  }
  for (const p of ['.claude/subagent/roles.local.json', '.claude/subagent/manifest.json', '.claude/settings.json', '.claude/settings.local.json', '.claude/agents/qa-agent.md']) {
    assert.equal(write(dir, 'pm-agent', p).allowed, false, p);
    assert.equal(write(dir, undefined, p).allowed, false, p);
  }
});

test('.claude/ 아래 사용자 규칙은 계획에 배정되지 않은 워크플로 역할이 수정할 수 없음', () => {
  const dir = project();
  assert.equal(write(dir, 'analyst-not-a-role', '.claude/rules/style.md').allowed, true);
  for (const role of ['planner-agent', 'qa-agent', 'backend-agent']) {
    assert.equal(write(dir, role, '.claude/rules/style.md').allowed, false, role);
  }
});

test('경로 이탈·절대 경로·UNC·symlink는 거부', () => {
  const dir = project();
  const outside = realpathSync.native(mkdtempSync(join(tmpdir(), 'outside-')));
  assert.equal(write(dir, 'pm-agent', '../x.txt').allowed, false);
  assert.equal(write(dir, 'pm-agent', join(outside, 'x.txt')).allowed, false);
  assert.equal(write(dir, 'pm-agent', '\\\\server\\share\\x.txt').allowed, false);
  symlinkSync(outside, join(dir, 'link'), 'junction');
  assert.equal(write(dir, 'pm-agent', 'link/x.txt').allowed, false);
});

test('분석·QA·리더는 자신의 보고·산출물에만 쓰기', () => {
  const dir = project();
  assert.equal(write(dir, 'planner-agent', reports('planner-agent-01.md')).allowed, true);
  assert.equal(write(dir, 'architecture-agent', reports('architecture-agent-02.md')).allowed, true);
  assert.equal(write(dir, 'planner-agent', reports('architecture-agent-01.md')).allowed, false);
  assert.equal(write(dir, 'planner-agent', 'src/a.js').allowed, false);
  assert.equal(write(dir, 'qa-agent', reports('qa-final.md')).allowed, true);
  assert.equal(write(dir, 'qa-agent', reports('qa-plan.md')).allowed, true);
  assert.equal(write(dir, 'qa-agent', reports('qa-final-01.md')).allowed, true, '재검증 순번');
  assert.equal(write(dir, 'qa-agent', reports('qa-extra.md')).allowed, false);
  assert.equal(write(dir, 'qa-agent', 'src/a.js').allowed, false);
  assert.equal(write(dir, 'planning-lead', '.claude-subagent-docs/runs/R1/plan.md').allowed, true);
  assert.equal(write(dir, 'planning-lead', 'src/a.js').allowed, false);
  assert.equal(write(dir, 'dev-lead', reports('dev-lead.md')).allowed, true);
  assert.equal(write(dir, 'dev-lead', '.claude-subagent-docs/runs/R1/plan.md').allowed, false);
  assert.equal(write(dir, 'planner-agent', '.claude-subagent-docs/runs/NOPE/reports/planner-agent-01.md').allowed, false);
});

test('보고서 이름이 틀리면 거부하고 메시지가 기대하는 이름을 알려 줌', () => {
  const dir = project();
  const wrong = write(dir, 'architecture-agent', reports('architecture-01.md'));
  assert.equal(wrong.allowed, false);
  assert.match(wrong.stderr, /reports\/architecture-agent-NN\.md/);
  assert.match(wrong.stderr, /architecture-01\.md/);
  assert.equal(write(dir, 'architecture-agent', reports('architecture-agent-01.md')).allowed, true);
  assert.match(write(dir, 'qa-agent', reports('qa-extra.md')).stderr, /qa-plan\.md or reports\/qa-final\.md/);
});

test('실무 에이전트: 잠금·confirmed·배정 파일이 모두 맞을 때만 소스 쓰기', () => {
  const dir = project();
  assert.equal(write(dir, 'backend-agent', 'src/a.js').allowed, false, '잠금 없음');
  assert.equal(call(dir, 'pm-agent', 'backend-agent').allowed, true);
  assert.equal(write(dir, 'backend-agent', 'src/a.js').allowed, true);
  if (process.platform === 'win32') assert.equal(write(dir, 'backend-agent', 'src\\a.js').allowed, true, '역슬래시 경로');
  assert.equal(write(dir, 'backend-agent', 'test/a.test.js').allowed, false, '다른 역할 배정');
  assert.equal(write(dir, 'backend-agent', 'src/b.js').allowed, false, '미배정 파일');
  assert.equal(write(dir, 'backend-agent', 'src/other.js').allowed, false, 'glob 배정은 무효');
  assert.equal(write(dir, 'backend-agent', reports('backend-agent-01.md')).allowed, true, '자신의 보고');
  assert.equal(write(dir, 'frontend-agent', 'src/a.js').allowed, false, '다른 타입의 잠금');
});

test('기획안이 confirmed가 아니면 개발 호출과 소스 쓰기 거부', () => {
  const dir = project({ status: 'draft' });
  assert.equal(call(dir, 'pm-agent', 'backend-agent').allowed, false);
  assert.equal(call(dir, 'pm-agent', 'dev-lead').allowed, false);
  assert.equal(call(dir, 'pm-agent', 'planner-agent').allowed, true);
  const dir2 = project();
  call(dir2, 'pm-agent', 'backend-agent');
  writeFileSync(join(dir2, '.claude-subagent-docs', 'runs', RUN, 'plan.md'), plan('draft', [['src/a.js', 'backend-agent']]));
  assert.equal(write(dir2, 'backend-agent', 'src/a.js').allowed, false);
});

test('쓰기 에이전트 동시 호출 차단, 종료 후 해제, 오래된 잠금 대체', () => {
  const dir = project();
  assert.equal(call(dir, 'pm-agent', 'backend-agent', card(), 't1').allowed, true);
  const second = call(dir, 'pm-agent', 'test-agent', card(), 't2');
  assert.equal(second.allowed, false);
  assert.match(second.stderr, /is running/);
  assert.equal(post(dir, 'backend-agent', 'other').allowed, true);
  assert.equal(call(dir, 'pm-agent', 'test-agent', card(), 't3').allowed, false, '다른 tool_use_id의 Post는 해제하지 않음');
  assert.equal(post(dir, 'backend-agent', 't1').allowed, true);
  assert.equal(call(dir, 'pm-agent', 'test-agent', card(), 't4').allowed, true);

  const lock = join(dir, '.claude-subagent-docs', '.guard', 'writer.lock.json');
  const old = JSON.parse(readFileSync(lock, 'utf8'));
  writeFileSync(lock, JSON.stringify({ ...old, startedAt: Date.now() - 31 * 60 * 1000 }));
  assert.equal(call(dir, 'pm-agent', 'api-agent', card(), 't5').allowed, true, '오래된 잠금은 대체');
});

test('호출 인계 검사: runId·실행 단위 필수', () => {
  const dir = project();
  assert.equal(call(dir, 'pm-agent', 'planner-agent', '인계 없음').allowed, false);
  assert.equal(call(dir, 'pm-agent', 'planner-agent', '모드: final. runId R1. 작업 경로 x').allowed, true, '콜론 없는 표기');
  assert.equal(call(dir, 'pm-agent', 'planner-agent', 'runId=R1').allowed, true);
  assert.equal(call(dir, 'pm-agent', 'planner-agent', 'runId 가 없습니다').allowed, false);
  assert.equal(call(dir, 'pm-agent', 'planner-agent', '- runId: NOPE').allowed, false);
  assert.equal(call(dir, 'pm-agent', 'planner-agent').allowed, true);
});

test('리더의 호출 대상 제한과 final QA는 PM만', () => {
  const dir = project();
  assert.equal(call(dir, 'planning-lead', 'planner-agent').allowed, true);
  assert.equal(call(dir, 'planning-lead', 'qa-agent', card('- Mode: plan')).allowed, true);
  assert.equal(call(dir, 'planning-lead', 'qa-agent', card('- Mode: final')).allowed, false);
  assert.equal(call(dir, 'planning-lead', 'dev-lead').allowed, false);
  assert.equal(call(dir, 'planning-lead', 'backend-agent').allowed, false);
  assert.equal(call(dir, 'dev-lead', 'qa-agent').allowed, false);
  assert.equal(call(dir, 'dev-lead', 'planner-agent').allowed, false);
  assert.equal(call(dir, 'dev-lead', 'frontend-agent', card(), 't9').allowed, true);
  assert.equal(call(dir, 'planner-agent', 'backend-agent').allowed, false);
  assert.equal(call(dir, 'pm-agent', 'qa-agent', card('- Mode: final')).allowed, true);
});

test('이 워크플로 외의 에이전트는 워크플로 정책 파일만 보호하고 나머지는 간섭하지 않음', () => {
  const dir = project();
  assert.equal(write(dir, 'my-own-agent', 'src/anything.js').allowed, true);
  assert.equal(write(dir, 'my-own-agent', '.claude/agents/mine.md').allowed, true);
  assert.equal(write(dir, 'my-own-agent', '.claude/subagent/roles.local.json').allowed, false);
  assert.equal(write(dir, 'my-own-agent', '.claude/agents/pm-agent.md').allowed, false);
  assert.equal(call(dir, 'my-own-agent', 'some-other-agent', '인계 없음').allowed, true);
});

test('오류와 잘못된 입력은 차단(fail closed)', () => {
  const dir = project();
  assert.equal(guard(dir, '{not json').status, 2);
  assert.equal(guard(dir, { hook_event_name: 'PreToolUse', tool_name: 'Write', agent_type: 'pm-agent', tool_input: {} }).status, 2);
  assert.equal(existsSync(join(dir, '.claude-subagent-docs', '.guard', 'writer.lock.json')), false);
  const missingRoot = spawnSync(process.execPath, [script], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: join(dir, 'nope') }, input: '{}', encoding: 'utf8' });
  assert.equal(missingRoot.status, 2);
});

test('기획안 표의 이스케이프하지 않은 파이프는 배정을 어긋나게 해 거부하고 안내', () => {
  const bad = project({ rows: [['src/<a|b>.js', 'backend-agent']] });
  call(bad, 'pm-agent', 'backend-agent');
  const denied = write(bad, 'backend-agent', 'src/<a|b>.js');
  assert.equal(denied.allowed, false);
  assert.match(denied.stderr, /section 6/);
  const good = project({ rows: [['src/<x>.js', 'backend-agent']] });
  call(good, 'pm-agent', 'backend-agent');
  assert.equal(write(good, 'backend-agent', 'src/<x>.js').allowed, true);
});

test('배정 파일의 대소문자는 파일시스템 기준으로 비교', () => {
  const dir = project({ rows: [['src/MixedCase.js', 'backend-agent']] });
  assert.equal(call(dir, 'pm-agent', 'backend-agent').allowed, true);
  assert.equal(write(dir, 'backend-agent', 'src/MixedCase.js').allowed, true);
  assert.equal(write(dir, 'backend-agent', 'src/mixedcase.js').allowed, process.platform !== 'linux');
  assert.equal(write(dir, 'backend-agent', reports('backend-agent-01.md')).allowed, true, '대문자 실행 ID R1 보존');
});

test('relay 모드: 리더의 하위 에이전트 호출 거부, nested 모드·PM 직접 호출은 허용', () => {
  const dir = project();
  const profile = (mode) => {
    mkdirSync(join(dir, '.claude', 'subagent'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'subagent', 'profile.md'), `## 워크플로 설정\n\n- Execution profile: full\n- Execution mode: ${mode}\n`);
  };
  profile('relay');
  const denied = call(dir, 'dev-lead', 'backend-agent');
  assert.equal(denied.allowed, false);
  assert.match(denied.stderr, /relay mode/);
  assert.equal(call(dir, 'planning-lead', 'planner-agent').allowed, false);
  assert.equal(call(dir, undefined, 'backend-agent', card(), 'toolu_r').allowed, true, 'PM 직접 호출은 유지');
  post(dir, 'backend-agent', 'toolu_r');
  profile('nested');
  assert.equal(call(dir, 'dev-lead', 'backend-agent', card(), 'toolu_n').allowed, true);
});

test('백그라운드 호출은 거부하고 포그라운드(run_in_background false)만 허용', () => {
  const dir = project();
  const denied = call(dir, 'pm-agent', 'backend-agent', card(), 'toolu_bg', true);
  assert.equal(denied.allowed, false);
  assert.match(denied.stderr, /foreground/);
  const unset = guard(dir, { hook_event_name: 'PreToolUse', tool_name: 'Agent', agent_type: 'pm-agent', tool_use_id: 'toolu_u', tool_input: { subagent_type: 'backend-agent', prompt: card() } });
  assert.equal(unset.allowed, false);
  assert.equal(call(dir, 'pm-agent', 'backend-agent', card(), 'toolu_fg', false).allowed, true);
});

test('L3 기획은 architecture-agent 보고가 있어야 개발 호출을 허용', () => {
  const dir = project();
  const planPath = join(dir, '.claude-subagent-docs', 'runs', RUN, 'plan.md');
  writeFileSync(planPath, readFileSync(planPath, 'utf8').replace('- Status: confirmed', '- Risk: L3\n- Status: confirmed'));
  const denied = call(dir, 'pm-agent', 'backend-agent');
  assert.equal(denied.allowed, false);
  assert.match(denied.stderr, /architecture-agent/);
  mkdirSync(join(dir, '.claude-subagent-docs', 'runs', RUN, 'reports'), { recursive: true });
  writeFileSync(join(dir, '.claude-subagent-docs', 'runs', RUN, 'reports', 'architecture-agent-01.md'), 'status: done\n');
  assert.equal(call(dir, 'pm-agent', 'backend-agent', card(), 'toolu_l3').allowed, true);
});

test('L2 기획은 architecture-agent 보고 없이도 개발 호출 허용', () => {
  const dir = project();
  const planPath = join(dir, '.claude-subagent-docs', 'runs', RUN, 'plan.md');
  writeFileSync(planPath, readFileSync(planPath, 'utf8').replace('- Status: confirmed', '- Risk: L2\n- Status: confirmed'));
  assert.equal(call(dir, 'pm-agent', 'backend-agent').allowed, true);
});

// 사용자가 추가한 역할: roles.local.json에 등록되고 정의 파일이 있어야 워크플로 역할로 인정
function withCustomRoles(dir, roles) {
  mkdirSync(join(dir, '.claude', 'subagent'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'subagent', 'roles.local.json'), JSON.stringify({ roles }));
  for (const r of roles) writeFileSync(join(dir, '.claude', 'agents', `${r.name}.md`), `---\nname: ${r.name}\n---\n`);
  return dir;
}

test('추가 역할 writer: 기본 쓰기 역할과 같은 잠금, confirmed, 배정 파일 규칙', () => {
  const dir = withCustomRoles(project({ rows: [['src/engine.c', 'engine-agent'], ['src/a.js', 'backend-agent']] }), [{ name: 'engine-agent', kind: 'writer' }]);
  assert.equal(write(dir, 'engine-agent', 'src/engine.c').allowed, false, '잠금 없음');
  assert.equal(call(dir, 'pm-agent', 'engine-agent').allowed, true);
  assert.equal(write(dir, 'engine-agent', 'src/engine.c').allowed, true);
  assert.equal(write(dir, 'engine-agent', 'src/a.js').allowed, false, '다른 역할 배정');
  assert.equal(write(dir, 'engine-agent', reports('engine-agent-01.md')).allowed, true, '자신의 보고');
  assert.equal(write(dir, 'engine-agent', '.claude/agents/engine-agent.md').allowed, false, '자기 정의 파일은 보호');
});

test('추가 역할 analyst: 자기 보고서만 쓰기, 개발 호출 조건 없이 호출 가능', () => {
  const dir = withCustomRoles(project({ status: 'draft' }), [{ name: 'perf-agent', kind: 'analyst' }]);
  assert.equal(call(dir, 'pm-agent', 'perf-agent').allowed, true);
  assert.equal(write(dir, 'perf-agent', reports('perf-agent-01.md')).allowed, true);
  assert.equal(write(dir, 'perf-agent', 'src/a.js').allowed, false);
});

test('추가 역할 등록이 잘못되면 워크플로 역할로 인정하지 않음(기본 역할 이름, 잘못된 종류, 정의 파일 없음)', () => {
  const dir = withCustomRoles(project(), [{ name: 'qa-agent', kind: 'writer' }, { name: 'lead-agent', kind: 'lead' }]);
  writeFileSync(join(dir, '.claude', 'subagent', 'roles.local.json'), JSON.stringify({ roles: [{ name: 'qa-agent', kind: 'writer' }, { name: 'lead-agent', kind: 'lead' }, { name: 'ghost-agent', kind: 'writer' }] }));
  assert.equal(write(dir, 'qa-agent', 'src/a.js').allowed, false, '기본 qa는 여전히 보고서만');
  // 인정되지 않은 이름은 권고 모드에서 이 워크플로 밖 에이전트로 취급(호출에 간섭하지 않음)
  assert.equal(call(dir, 'pm-agent', 'ghost-agent', 'no run id').allowed, true);
  assert.equal(call(dir, 'pm-agent', 'lead-agent', 'no run id').allowed, true);
});

test('플러그인 hook: 워크플로를 설정하지 않은 프로젝트에는 간섭하지 않음', () => {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'not-a-workflow-')));
  assert.equal(write(dir, undefined, '.git/config').allowed, true);
  assert.equal(write(dir, 'backend-agent', 'src/a.js').allowed, true);
  assert.equal(call(dir, 'main', 'subagent-workflow:backend-agent', 'no run id').allowed, true);
});

test('플러그인 역할 이름(subagent-workflow: 접두사)은 기본 역할과 같은 규칙으로 판정', () => {
  const dir = project();
  assert.equal(write(dir, 'subagent-workflow:backend-agent', 'src/a.js').allowed, false, '잠금 없음');
  assert.equal(call(dir, 'main', 'subagent-workflow:backend-agent').allowed, true);
  assert.equal(write(dir, 'subagent-workflow:backend-agent', 'src/a.js').allowed, true);
  assert.equal(write(dir, 'subagent-workflow:backend-agent', 'test/a.test.js').allowed, false, '다른 역할 배정');
  assert.equal(write(dir, 'subagent-workflow:planner-agent', reports('planner-agent-01.md')).allowed, true);
  assert.equal(call(dir, 'subagent-workflow:dev-lead', 'subagent-workflow:qa-agent').allowed, false, 'dev-lead는 qa를 부를 수 없음');
  assert.equal(call(dir, 'main', 'subagent-workflow:backend-agent', '인계 없음', 'toolu_2').allowed, false, 'runId 없는 호출 거부');
});
