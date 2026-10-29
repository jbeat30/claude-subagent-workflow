// subagent-run 상태 명령과 가드의 PM 게이트 단위 검사, 임시 프로젝트에서 실행
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const claude = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', '.claude');
const runScript = join(claude, 'subagent', 'bin', 'subagent-run.mjs');
const guardScript = join(claude, 'hooks', 'subagent-guard.mjs');
const statePath = (dir) => join(dir, '.claude-subagent-docs', '.guard', 'run-state.json');

const project = () => realpathSync.native(mkdtempSync(join(tmpdir(), 'subagent-run-')));
const run = (dir, ...args) => {
  const r = spawnSync(process.execPath, [runScript, ...args], { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8' });
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
};
const writeAs = (dir, agent, filePath) => {
  const r = spawnSync(process.execPath, [guardScript], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    input: JSON.stringify({ cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Write', agent_type: agent, tool_input: { file_path: filePath } }),
    encoding: 'utf8',
  });
  return { allowed: r.status === 0, stderr: r.stderr };
};
const readState = (dir) => JSON.parse(readFileSync(statePath(dir), 'utf8'));
const addFinalReport = (dir, runId) => {
  const reports = join(dir, '.claude-subagent-docs', 'runs', runId, 'reports');
  mkdirSync(reports, { recursive: true });
  writeFileSync(join(reports, 'qa-final.md'), '# QA\n');
};

test('start: 등급 미정 상태 생성, 다시 호출하면 새 상태로 초기화', () => {
  const dir = project();
  assert.equal(run(dir, 'start').ok, true);
  assert.equal(readState(dir).grade, 'pending');
  run(dir, 'grade', 'L1');
  run(dir, 'start');
  assert.equal(readState(dir).grade, 'pending');
});

test('start: 상태 파일을 쓸 수 없어도 종료 코드 0으로 스킬 호출을 막지 않음', () => {
  const dir = project();
  writeFileSync(join(dir, '.claude-subagent-docs'), 'file blocks the directory');
  const r = run(dir, 'start');
  assert.equal(r.ok, true);
  assert.match(r.stdout, /could not start/);
});

test('grade: 올리기만 가능, 내리거나 잘못된 등급이나 실행 전 호출은 거부', () => {
  const dir = project();
  assert.equal(run(dir, 'grade', 'L1').ok, false);
  run(dir, 'start');
  assert.equal(run(dir, 'grade', 'X').ok, false);
  assert.equal(run(dir, 'grade', 'L1').ok, true);
  assert.equal(run(dir, 'grade', 'L3', 'R1').ok, true);
  assert.equal(readState(dir).runId, 'R1');
  assert.equal(run(dir, 'grade', 'L1').ok, false);
  assert.equal(run(dir, 'grade', 'L3', '../x').ok, false);
});

test('close: Q·L1은 바로 종료, L2·L3는 최종 QA 보고가 있어야 종료, 취소는 --abandon', () => {
  const dir = project();
  run(dir, 'start');
  run(dir, 'grade', 'L1');
  assert.equal(run(dir, 'close').ok, true);
  assert.notEqual(readState(dir).closedAt, null);

  run(dir, 'start');
  run(dir, 'grade', 'L2', 'R1');
  assert.equal(run(dir, 'close').ok, false);
  addFinalReport(dir, 'R1');
  assert.equal(run(dir, 'close').ok, true);

  run(dir, 'start');
  run(dir, 'grade', 'L3', 'R2');
  assert.equal(run(dir, 'close').ok, false);
  assert.equal(run(dir, 'close', '--abandon').ok, true);
});

test('가드: 실행 상태가 없으면 PM 수정은 지금처럼 허용', () => {
  const dir = project();
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, true);
  assert.equal(writeAs(dir, 'pm-agent', 'src/a.js').allowed, true);
});

test('가드: 등급 미정과 Q에서는 PM의 소스 수정 차단, 요청·기획안 문서는 허용', () => {
  const dir = project();
  run(dir, 'start');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, false);
  assert.match(writeAs(dir, 'main', 'src/a.js').stderr, /not classified/);
  assert.equal(writeAs(dir, 'main', '.claude-subagent-docs/runs/R1/request.md').allowed, true);
  run(dir, 'grade', 'Q');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, false);
});

test('가드: L1은 파일 1개만, 같은 파일은 다시 수정 가능, 두 번째 파일은 차단', () => {
  const dir = project();
  run(dir, 'start');
  run(dir, 'grade', 'L1');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, true);
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, true);
  const second = writeAs(dir, 'pm-agent', 'src/b.js');
  assert.equal(second.allowed, false);
  assert.match(second.stderr, /raise the grade/);
});

test('가드: L1에서 L3로 올리면 PM 직접 수정이 모두 차단', () => {
  const dir = project();
  run(dir, 'start');
  run(dir, 'grade', 'L1');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, true);
  run(dir, 'grade', 'L3', 'R1');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, false);
  assert.match(writeAs(dir, 'main', 'src/a.js').stderr, /worker agents/);
});

test('가드: 종료하면 PM 수정이 다시 허용되어 평소 대화에 영향 없음', () => {
  const dir = project();
  run(dir, 'start');
  run(dir, 'grade', 'L2', 'R1');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, false);
  run(dir, 'close', '--abandon');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, true);
});

test('가드: 갱신이 멈춘 지 오래된 상태는 해제된 것으로 취급', () => {
  const dir = project();
  run(dir, 'start');
  const state = readState(dir);
  writeFileSync(statePath(dir), JSON.stringify({ ...state, updatedAt: Date.now() - 5 * 60 * 60 * 1000 }));
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, true);
});

test('가드: 깨진 상태 파일은 무시해 평소 대화를 막지 않음', () => {
  const dir = project();
  mkdirSync(join(dir, '.claude-subagent-docs', '.guard'), { recursive: true });
  writeFileSync(statePath(dir), '{ not json');
  assert.equal(writeAs(dir, 'main', 'src/a.js').allowed, true);
});

test('가드: 서브에이전트 쓰기는 상태와 무관하게 기존 규칙만 적용', () => {
  const dir = project();
  run(dir, 'start');
  assert.equal(writeAs(dir, 'frontend-agent', 'src/a.js').allowed, false);
  assert.match(writeAs(dir, 'frontend-agent', 'src/a.js').stderr, /activated by a call/);
});

const editAs = (dir, filePath, oldString, newString, extra = {}) => {
  const r = spawnSync(process.execPath, [guardScript], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    input: JSON.stringify({ cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Edit', agent_type: 'main', tool_input: { file_path: filePath, old_string: oldString, new_string: newString, ...extra } }),
    encoding: 'utf8',
  });
  return { allowed: r.status === 0, stderr: r.stderr };
};
const seed = (dir, name, content) => {
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', name), content);
};
const l1 = () => {
  const dir = project();
  run(dir, 'start');
  run(dir, 'grade', 'L1');
  return dir;
};

test('가드 L1: 주석 한 줄씩 여러 파일을 고치는 것은 파일 수와 무관하게 허용', () => {
  const dir = l1();
  seed(dir, 'a.js', '// retrun a\nexport const a = 1;\n');
  seed(dir, 'b.js', '// calulate b\nexport const b = 2;\n');
  seed(dir, 'c.py', '# teh c\nc = 3\n');
  assert.equal(editAs(dir, 'src/a.js', 'retrun', 'return').allowed, true);
  assert.equal(editAs(dir, 'src/b.js', 'calulate', 'calculate').allowed, true);
  assert.equal(editAs(dir, 'src/c.py', 'teh', 'the').allowed, true);
});

test('가드 L1: 문서 파일은 여러 개 고쳐도 허용', () => {
  const dir = l1();
  seed(dir, 'a.md', 'recieve a\n');
  seed(dir, 'b.md', 'recieve b\n');
  assert.equal(editAs(dir, 'src/a.md', 'recieve', 'receive').allowed, true);
  assert.equal(editAs(dir, 'src/b.md', 'recieve', 'receive').allowed, true);
});

test('가드 L1: 주석 밖의 수정은 파일 1개까지만, 그 외에 주석 수정은 계속 허용', () => {
  const dir = l1();
  seed(dir, 'a.js', 'export const a = "helo";\n');
  seed(dir, 'b.js', 'export const b = "wrold";\n');
  seed(dir, 'c.js', '// typpo\nexport const c = 1;\n');
  assert.equal(editAs(dir, 'src/a.js', 'helo', 'hello').allowed, true);
  const second = editAs(dir, 'src/b.js', 'wrold', 'world');
  assert.equal(second.allowed, false);
  assert.match(second.stderr, /beyond comments and documents/);
  assert.equal(editAs(dir, 'src/c.js', 'typpo', 'typo').allowed, true);
});

test('가드 L1: 코드 줄 끝에 붙은 주석, 주석을 코드로 바꾸는 수정, 전체 치환은 주석 수정으로 보지 않음', () => {
  const dir = l1();
  seed(dir, 'a.js', 'export const a = 1;\n');
  seed(dir, 'b.js', 'export const b = 2; // retrun\n');
  seed(dir, 'c.js', '// call()\n');
  seed(dir, 'd.js', '// word word\n');
  assert.equal(editAs(dir, 'src/a.js', '1', '2').allowed, true);
  assert.equal(editAs(dir, 'src/b.js', 'retrun', 'return').allowed, false);
  assert.equal(editAs(dir, 'src/c.js', '// call()', 'call()').allowed, false);
  assert.equal(editAs(dir, 'src/d.js', 'word', 'text', { replace_all: true }).allowed, false);
});

test('가드 L1: 대상 줄을 찾을 수 없거나 여러 곳에 있으면 주석 수정으로 보지 않음', () => {
  const dir = l1();
  seed(dir, 'a.js', 'export const a = 1;\n');
  seed(dir, 'b.js', '// dup\n// dup\n');
  seed(dir, 'c.js', '// ok\n');
  assert.equal(editAs(dir, 'src/a.js', '1', '2').allowed, true);
  assert.equal(editAs(dir, 'src/b.js', 'dup', 'dup2').allowed, false);
  assert.equal(editAs(dir, 'src/c.js', 'missing', 'x').allowed, false);
});

test('가드 L1: 블록 주석 줄은 주석으로 보고 L2 이상은 주석 수정도 PM이 직접 못 함', () => {
  const dir = l1();
  seed(dir, 'a.js', '/**\n * retrun a\n */\nexport const a = 1;\n');
  seed(dir, 'b.js', 'export const b = 1;\n');
  assert.equal(editAs(dir, 'src/b.js', '1', '2').allowed, true);
  assert.equal(editAs(dir, 'src/a.js', 'retrun', 'return').allowed, true);
  run(dir, 'grade', 'L2', 'R1');
  assert.equal(editAs(dir, 'src/a.js', ' * retrun a', ' * return a').allowed, false);
});

test('grade: L2와 L3는 질문 정책을 출력하고 Q와 L1은 출력하지 않음', () => {
  const dir = project();
  mkdirSync(join(dir, '.claude', 'subagent'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'subagent', 'questions.md'), '# Question policy, Look before asking');
  run(dir, 'start');
  assert.doesNotMatch(run(dir, 'grade', 'L1').stdout, /Look before asking/);
  const l2 = run(dir, 'grade', 'L2', 'R1');
  assert.match(l2.stdout, /Look before asking/);
  assert.match(l2.stdout, /grade L2, runId R1/);
  assert.match(run(dir, 'grade', 'L3', 'R1').stdout, /Look before asking/);
});

test('grade: 질문 정책 파일이 없어도 등급 기록은 성공하고 대체 안내를 출력', () => {
  const dir = project();
  run(dir, 'start');
  const r = run(dir, 'grade', 'L2', 'R1');
  assert.equal(r.ok, true);
  assert.match(r.stdout, /questions.md is missing/);
});
