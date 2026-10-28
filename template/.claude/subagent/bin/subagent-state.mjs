// 실행 상태 파일 공유 모듈: 가드(읽기·갱신)와 subagent-run.mjs(생성·등급·종료)가 같은 형식을 사용
// 상태 파일은 /subagent 호출 때 만들어지며, 종료 기록이 있거나 갱신이 멈춘 지 STATE_TTL_MS가 지나면 해제된 것으로 취급
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const DOCS = '.claude-subagent-docs';
export const GRADES = ['Q', 'L1', 'L2', 'L3'];
export const STATE_TTL_MS = 4 * 60 * 60 * 1000;

export const statePath = (root) => join(root, DOCS, '.guard', 'run-state.json');

// 등급은 올리기만 가능: 미정 < Q < L1 < L2 < L3
export const gradeRank = (grade) => ['pending', ...GRADES].indexOf(grade);

export function readState(root) {
  try {
    const state = JSON.parse(readFileSync(statePath(root), 'utf8'));
    return state && typeof state === 'object' && gradeRank(state.grade) >= 0 ? state : null;
  } catch {
    return null;
  }
}

export function writeState(root, state) {
  mkdirSync(dirname(statePath(root)), { recursive: true });
  writeFileSync(statePath(root), JSON.stringify(state, null, 2));
}

export function isActive(state, now = Date.now()) {
  return Boolean(state) && !state.closedAt && now - (state.updatedAt ?? 0) < STATE_TTL_MS;
}

export function newState(now = Date.now()) {
  return { startedAt: now, updatedAt: now, grade: 'pending', runId: null, l1Files: [], closedAt: null };
}
