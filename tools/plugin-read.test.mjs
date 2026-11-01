// 플러그인 파일 읽기 허용 hook 단위 검사: 플러그인 폴더 안만 allow, 밖은 결정 없음, 차단하지 않음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from '../skills/run/scripts/plugin-read.mjs';

const repo = realpathSync.native(join(dirname(fileURLToPath(import.meta.url)), '..'));
const script = join(repo, 'skills', 'run', 'scripts', 'plugin-read.mjs');
const run = (input) => spawnSync(process.execPath, [script], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8' });

test('플러그인 폴더 안의 파일 읽기는 allow를 돌려줌(절대 경로, 상대 경로, Glob과 Grep의 path)', () => {
  for (const input of [
    { tool_name: 'Read', tool_input: { file_path: join(repo, 'skills', 'run', 'references', 'plan-template.md') } },
    { tool_name: 'Read', cwd: join(repo, 'skills'), tool_input: { file_path: 'run/references/questions.md' } },
    { tool_name: 'Grep', tool_input: { pattern: 'x', path: join(repo, 'references') } },
  ]) {
    const r = run(input);
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'allow', JSON.stringify(input));
  }
});

test('플러그인 폴더 밖, 상위 경로 이탈, 입력 오류는 결정하지 않고 통과(차단하지 않음)', () => {
  const outside = realpathSync.native(mkdtempSync(join(tmpdir(), 'outside-')));
  for (const input of [
    { tool_name: 'Read', tool_input: { file_path: join(outside, 'secret.txt') } },
    { tool_name: 'Read', tool_input: { file_path: join(repo, 'skills', '..', '..', 'outside.txt') } },
    { tool_name: 'Read', tool_input: {} },
    '{not json',
  ]) {
    const r = run(input);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '', JSON.stringify(input));
  }
});

test('플러그인 폴더 안의 바로가기가 밖을 가리키면 허용하지 않음', (t) => {
  const plugin = realpathSync.native(mkdtempSync(join(tmpdir(), 'plugin-')));
  const outside = realpathSync.native(mkdtempSync(join(tmpdir(), 'outside-')));
  writeFileSync(join(outside, 'secret.txt'), 'x');
  mkdirSync(join(plugin, 'references'));
  writeFileSync(join(plugin, 'references', 'ok.md'), 'x');
  try {
    symlinkSync(outside, join(plugin, 'link'), 'junction');
  } catch {
    t.skip('이 환경에서는 바로가기를 만들 수 없음');
    return;
  }
  assert.equal(decide({ tool_input: { file_path: join(plugin, 'references', 'ok.md') } }, plugin).hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(decide({ tool_input: { file_path: join(plugin, 'link', 'secret.txt') } }, plugin), null);
});
