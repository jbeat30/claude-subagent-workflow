// 질문 정책 확인용 2턴 실행: 모호한 요청 -> 사용자 답변 -> 결과
const { spawnSync } = require('node:child_process');
const { cpSync, mkdtempSync, writeFileSync, realpathSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const repo = process.argv[2];
const prompt1 = process.argv[3];
const answer = process.argv[4];
const out = process.argv[5];
const CLAUDE = 'C:/Users/light/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe';

const work = realpathSync.native(mkdtempSync(join(tmpdir(), 'qcheck-')));
cpSync(join(repo, 'tools/eval/hard/fixture'), work, { recursive: true });
const sh = (c, a, o = {}) => spawnSync(c, a, { cwd: work, encoding: 'utf8', ...o });
sh('git', ['init', '-q']); sh('git', ['add', '-A']); sh('git', ['-c', 'user.name=e', '-c', 'user.email=e@e', 'commit', '-qm', 'base']);

const answers = join(work, '..', `answers-${Date.now()}.json`);
writeFileSync(answers, JSON.stringify({
  profile: 'lite', executionMode: 'relay', context7: false, designTools: [], gitignore: true, pdca: 'off', guardMode: 'advisory',
  stack: [{ item: 'Node.js', value: 'node:test, ES modules', evidence: 'package.json' }],
  checks: [{ purpose: 'Test', command: 'npm test', cwd: '.', sideEffect: 'none' }],
  conventions: [], forbidden: [{ path: 'dist/', reason: 'generated file' }, { path: 'config/', reason: 'production config' }],
}));
const inst = (a) => spawnSync(process.execPath, [join(repo, 'scripts', 'install.mjs'), ...a], { encoding: 'utf8' });
const plan = JSON.parse(inst(['plan', '--target', work, '--answers', answers]).stdout);
const ap = inst(['apply', '--target', work, '--answers', answers, '--plan-hash', plan.hash]);
if (ap.status !== 0) throw new Error(ap.stderr + ap.stdout);
sh('git', ['add', '-A']); sh('git', ['-c', 'user.name=e', '-c', 'user.email=e@e', 'commit', '-qm', 'init']);

const common = ['--output-format', 'json', '--model', 'sonnet', '--permission-mode', 'acceptEdits', '--max-budget-usd', '1',
  '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', 'project',
  '--allowedTools', 'Bash(npm test)', 'Bash(node .claude/subagent/bin/*)', 'Bash(git diff:*)', 'Bash(git status:*)'];
const parse = (r) => { try { return JSON.parse(r.stdout); } catch { return { result: r.stdout + r.stderr }; } };

const r1 = parse(sh(CLAUDE, ['-p', '/subagent ' + prompt1, ...common], { input: '', timeout: 15 * 60 * 1000 }));
const r2 = answer ? parse(sh(CLAUDE, ['-p', answer, '--resume', r1.session_id, ...common], { input: '', timeout: 15 * 60 * 1000 })) : null;
const diff = sh('git', ['diff', '--stat']).stdout;
const result = { work, turn1: { text: r1.result, cost: r1.total_cost_usd, session: r1.session_id }, turn2: r2 && { text: r2.result, cost: r2.total_cost_usd }, diff };
writeFileSync(out, JSON.stringify(result, null, 2));
console.log('saved', out, 'cost', (r1.total_cost_usd ?? 0) + (r2?.total_cost_usd ?? 0));
