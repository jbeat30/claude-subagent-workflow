#!/usr/bin/env node
// 검사 실행기: 승인된 기획안의 검사 명령만 실행하고 원본 출력, exit code, 시각, 해시를 가공 없이 기록
// 프로젝트 루트에서 실행, 기록을 생성하는 주체는 이 스크립트이며 메인이 기록을 위조하는 경우까지는 방어하지 않음
// 종료 코드: 0 기록 생성 또는 검증 통과, 1 검증 실패, 2 거부, 오류 (검사 명령의 exit code는 record.json에 기록)
//
// 사용법
//   node <plugin>/skills/run/scripts/subagent-check.mjs run <runId> "<검사 명령>" [--allow-side-effects]
//   node <plugin>/skills/run/scripts/subagent-check.mjs verify <runId>
//   node <plugin>/skills/run/scripts/subagent-check.mjs diff <runId> [--base <ref>]
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';


const VERSION = '0.5.0';
const MAX_BUFFER = 256 * 1024 * 1024;
const root = realpathSync.native(process.cwd());

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const die = (message) => {
  console.error(`subagent-check: ${message}`);
  process.exit(2);
};

function runDir(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId ?? '')) die(`invalid runId format: ${runId}`);
  const dir = join(root, '.claude-subagent-docs', 'runs', runId);
  if (!existsSync(dir)) die(`run directory not found: ${dir}`);
  return dir;
}

function readPlan(dir) {
  const planPath = join(dir, 'plan.md');
  if (!existsSync(planPath)) die('plan.md not found');
  const buffer = readFileSync(planPath);
  return { text: buffer.toString('utf8'), hash: sha256(buffer) };
}

// 기획안 8장 표에서 승인된 검사 명령을 추출, 셀 안의 \| 는 | 로 복원
function parseAllowedChecks(planText) {
  const start = planText.search(/^## 8\./m);
  if (start < 0) die('plan section 8 (check commands) not found');
  const rest = planText.slice(start).split(/\r?\n/).slice(1);
  const rows = [];
  for (const line of rest) {
    if (/^## /.test(line)) break;
    if (!line.trim().startsWith('|') || /^\|\s*-/.test(line.trim())) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/)
      .map((c) => c.trim().replace(/\\\|/g, '|'));
    const command = (cells[0] ?? '').replace(/^`+|`+$/g, '').trim();
    if (!command || command === 'Command') continue;
    rows.push({ command, cwd: cells[1] ?? '', sideEffect: cells[2] ?? '' });
  }
  return rows;
}

function resolveCwd(cell) {
  const value = cell.replace(/^`+|`+$/g, '').trim();
  if (!value || value === '.' || value === 'project root') return root;
  if (isAbsolute(value)) die(`working directory must be a relative path inside the project: ${value}`);
  const full = resolve(root, value);
  const rel = relative(root, full);
  if (rel.startsWith('..') || isAbsolute(rel)) die(`working directory is outside the project: ${value}`);
  if (!existsSync(full)) die(`working directory not found: ${value}`);
  return full;
}

function nextIndex(checksDir) {
  if (!existsSync(checksDir)) return 1;
  const used = readdirSync(checksDir).filter((n) => /^\d+$/.test(n)).map(Number);
  return used.length ? Math.max(...used) + 1 : 1;
}

function cmdRun(args) {
  const allowSideEffects = args.includes('--allow-side-effects');
  const positional = args.filter((a) => a !== '--allow-side-effects');
  const [runId, ...commandParts] = positional;
  const command = commandParts.join(' ').trim();
  if (!command) die('check command required');
  const dir = runDir(runId);
  const plan = readPlan(dir);
  const entry = parseAllowedChecks(plan.text).find((row) => row.command === command);
  if (!entry) die(`commands not in plan section 8 are not run: ${command}`);
  const clean = /^none/.test(entry.sideEffect);
  if (!clean && !allowSideEffects) {
    die(`side-effect class is not 'none' for command(${entry.sideEffect || 'unclassified'}); rerun with --allow-side-effects after user approval`);
  }
  const cwd = resolveCwd(entry.cwd);

  const checksDir = join(dir, 'checks');
  const outDir = join(checksDir, String(nextIndex(checksDir)).padStart(2, '0'));
  mkdirSync(outDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const result = spawnSync(command, { cwd, shell: true, maxBuffer: MAX_BUFFER });
  const endedAt = new Date().toISOString();

  const stdout = result.stdout ?? Buffer.alloc(0);
  const stderr = result.stderr ?? Buffer.alloc(0);
  writeFileSync(join(outDir, 'stdout.txt'), stdout);
  writeFileSync(join(outDir, 'stderr.txt'), stderr);
  const record = {
    command,
    cwd: relative(root, cwd) || '.',
    startedAt,
    endedAt,
    exitCode: result.status,
    signal: result.signal,
    spawnError: result.error ? String(result.error.message) : null,
    sideEffectsApproved: !clean && allowSideEffects,
    planSha256: plan.hash,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    runner: `subagent-check ${VERSION}`,
    nodeVersion: process.version,
    source: 'check record source: run by the main session with the runner',
  };
  writeFileSync(join(outDir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify({ recordDir: relative(root, outDir), exitCode: record.exitCode, signal: record.signal }));
}

function cmdVerify(args) {
  const [runId] = args;
  const dir = runDir(runId);
  const planHash = readPlan(dir).hash;
  const checksDir = join(dir, 'checks');
  const indices = existsSync(checksDir) ? readdirSync(checksDir).filter((n) => /^\d+$/.test(n)).sort() : [];
  if (!indices.length) {
    console.log(JSON.stringify({ ok: false, reason: 'no check record' }));
    process.exit(1);
  }
  const problems = [];
  const superseded = [];
  // 계획이 바뀌기 전에 만든 기록은 같은 명령을 현재 계획으로 다시 돌린 뒤 기록이 있으면 대체된 것으로 보고 실패로 세지 않음
  const loaded = new Map();
  for (const index of indices) {
    const recordPath = join(checksDir, index, 'record.json');
    if (existsSync(recordPath)) loaded.set(index, JSON.parse(readFileSync(recordPath, 'utf8')));
  }
  const isSuperseded = (index) => {
    const record = loaded.get(index);
    return indices.some((later) => Number(later) > Number(index) && loaded.get(later)?.command === record.command && loaded.get(later)?.planSha256 === planHash);
  };
  for (const index of indices) {
    const base = join(checksDir, index);
    const recordPath = join(base, 'record.json');
    if (!existsSync(recordPath)) {
      problems.push(`${index}: record.json not found`);
      continue;
    }
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    for (const [file, key] of [['stdout.txt', 'stdoutSha256'], ['stderr.txt', 'stderrSha256']]) {
      const path = join(base, file);
      if (!existsSync(path)) problems.push(`${index}: ${file} not found`);
      else if (sha256(readFileSync(path)) !== record[key]) problems.push(`${index}: ${file} hash mismatch`);
    }
    if (record.planSha256 !== planHash) {
      if (isSuperseded(index)) superseded.push(index);
      else problems.push(`${index}: the plan changed after the record`);
    }
  }
  console.log(JSON.stringify({ ok: problems.length === 0, records: indices.length, superseded, problems }));
  process.exit(problems.length ? 1 : 0);
}

function git(args, options = {}) {
  return spawnSync('git', args, { cwd: root, maxBuffer: MAX_BUFFER, ...options });
}

// 추적 파일 diff와 미추적 파일의 신규 diff를 원문 그대로 저장, 실행 산출물 디렉터리는 제외
function cmdDiff(args) {
  const baseIndex = args.indexOf('--base');
  const base = baseIndex >= 0 ? args[baseIndex + 1] : 'HEAD';
  const positional = baseIndex >= 0 ? args.filter((_, i) => i !== baseIndex && i !== baseIndex + 1) : args;
  const runId = positional[0];
  const dir = runDir(runId);
  if (git(['rev-parse', '--is-inside-work-tree']).status !== 0) die('not a git repository');
  if (git(['rev-parse', '--verify', `${base}^{commit}`]).status !== 0) die(`base commit not found: ${base}`);

  const exclude = ':(exclude).claude-subagent-docs/runs';
  const tracked = git(['diff', '--no-color', '--no-ext-diff', base, '--', '.', exclude]);
  if (tracked.status !== 0) die(`git diff failed: ${tracked.stderr}`);
  const listed = git(['ls-files', '--others', '--exclude-standard', '-z', '--', '.', exclude]);
  const untracked = listed.stdout.toString('utf8').split('\0').filter(Boolean);

  const chunks = [tracked.stdout];
  for (const file of untracked) {
    const added = git(['diff', '--no-color', '--no-index', '--', '/dev/null', file]);
    if (added.status !== 0 && added.status !== 1) die(`new file diff failed (${file}): ${added.stderr}`);
    chunks.push(added.stdout);
  }
  const patch = Buffer.concat(chunks);
  const patchPath = join(dir, 'changes.patch');
  writeFileSync(patchPath, patch);
  const changed = git(['diff', '--name-only', base, '--', '.', exclude]).stdout.toString('utf8').split('\n').filter(Boolean);
  console.log(
    JSON.stringify({
      patch: relative(root, patchPath),
      bytes: patch.length,
      sha256: sha256(patch),
      trackedFiles: changed,
      untrackedFiles: untracked,
    }),
  );
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'run') cmdRun(rest);
else if (command === 'verify') cmdVerify(rest);
else if (command === 'diff') cmdDiff(rest);
else die('usage: run <runId> "<command>" | verify <runId> | diff <runId> [--base <ref>]');
