#!/usr/bin/env node
// /subagent 실행 상태 관리: start(스킬 로드 때 자동 실행), grade(PM이 분류 기록), close(최종 보고 뒤 종료)
// start는 스킬 호출을 막지 않도록 실패해도 종료 코드 0, 나머지는 거부 사유와 함께 종료 코드 1
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS, GRADES, gradeRank, isActive, newState, readState, writeState } from './subagent-state.mjs';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const [command, ...args] = process.argv.slice(2);
const validRunId = (value) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value ?? '');
const fail = (message) => {
  process.stderr.write(`subagent-run: ${message}\n`);
  process.exit(1);
};

function finalReportExists(runId) {
  const dir = join(root, DOCS, 'runs', runId, 'reports');
  return existsSync(dir) && readdirSync(dir).some((name) => /^qa-final(-\d{2})?\.md$/.test(name));
}

if (command === 'start') {
  try {
    writeState(root, newState());
    console.log('Run state: started, grade pending. Classify the request and record it with `node .claude/subagent/bin/subagent-run.mjs grade <Q|L1|L2|L3> [runId]`; the guard blocks the PM from editing source until then.');
  } catch (error) {
    console.log(`Run state: could not start (${error.message}). PM source-edit limits are not active for this run.`);
  }
} else if (command === 'grade') {
  const [grade, runId] = args;
  if (!GRADES.includes(grade)) fail(`grade must be one of ${GRADES.join(', ')}`);
  if (runId !== undefined && !validRunId(runId)) fail(`invalid runId: ${runId}`);
  const state = readState(root);
  if (!isActive(state)) fail('no active run; the /subagent skill starts one when it loads');
  if (gradeRank(grade) < gradeRank(state.grade)) fail(`cannot lower the grade from ${state.grade} to ${grade}; raise it only`);
  writeState(root, { ...state, grade, runId: runId ?? state.runId, updatedAt: Date.now() });
  console.log(`Run state: grade ${grade}${runId ? `, runId ${runId}` : ''}`);
} else if (command === 'close') {
  const state = readState(root);
  if (!isActive(state)) {
    console.log('Run state: nothing to close');
  } else {
    // L2·L3는 최종 QA 보고가 있어야 종료, 사용자가 작업을 취소한 경우만 --abandon
    if (!args.includes('--abandon') && ['L2', 'L3'].includes(state.grade) && !(state.runId && finalReportExists(state.runId))) {
      fail(`${state.grade} run cannot close without the final QA report (reports/qa-final*.md) of its runId; finish verification, or use --abandon only if the user cancelled the work`);
    }
    writeState(root, { ...state, closedAt: Date.now(), updatedAt: Date.now() });
    console.log('Run state: closed');
  }
} else {
  fail('usage: subagent-run.mjs start | grade <Q|L1|L2|L3> [runId] | close [--abandon]');
}
