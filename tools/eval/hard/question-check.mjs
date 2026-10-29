// 질문 정책 반복 확인 도구: 요청(1턴)과 사용자 답변(2턴)을 --resume으로 이어 보내 질문 방식을 코드로 기록
// 사용법: REPO=<저장소 경로> BUDGET=1.5 CLAUDE_BIN=<claude 실행 파일> node question-check.mjs <s1|s2|s3> <rep> <출력 폴더>
// 판정 기준은 docs/verification/results/question-policy.md의 사전 고정 기준을 따름, 사람이 읽고 판정하는 항목은 응답 원문만 저장
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tasks } from './tasks.mjs';

export const INTERNAL_TERMS = /\bL[123]\b|\bG[0-5]\b|\b(planner|architecture|backend|frontend|api|test|qa)-agent\b|needs-input|\brunId\b/g;

// 내부 용어 탐지: 응답에 남아 있는 등급, 게이트, 역할 이름, 내부 상태 값
export function findInternalTerms(text) {
  return [...new Set((text.match(INTERNAL_TERMS) ?? []))];
}

// 기본값 목록과 "추천대로" 안내 존재 여부(문구 확인이며 내용의 적절성은 사람이 판정)
export function questionMarkers(text) {
  return {
    defaultsList: /기본값|이대로 진행|바꾸라고 하지 않으면|그대로 진행/.test(text),
    followRecommendation: /추천대로/.test(text),
    questionMarks: (text.match(/\?|까요|세요\?|주세요/g) ?? []).length,
  };
}

// 기존 테스트 약화 탐지: 테스트 폴더 diff에서 삭제된 줄 중 import 줄이 아닌 것(덧붙임과 import 줄 변경은 허용)
export function weakenedTestLines(diffText) {
  return diffText.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---') && !/^-\s*import\b/.test(l) && l.slice(1).trim() !== '');
}

export const SCENARIOS = {
  s1: { prompt: '/subagent 주문 합계에 할인이 들어가게 해줘', answer: '정률 10퍼센트로 해줘. 나머지는 네가 추천하는 걸로 해줘.', task: null },
  s2: { prompt: '/subagent ' + tasks.m1.prompt, answer: '추천대로 진행해줘.', task: 'm1' },
  s3: { prompt: '/subagent ' + tasks.l2.prompt, answer: '추천대로 진행해줘.', task: 'l2' },
};

// 세션 기록에서 질문 정책 문서를 열었는지 확인(Read 도구 또는 셸 cat 모두 계산)
export function readQuestionsDoc(workdir) {
  const dir = join(homedir(), '.claude', 'projects', workdir.replace(/[^A-Za-z0-9]/g, '-'));
  if (!existsSync(dir)) return { found: false, opened: null };
  let opened = 0;
  let shown = 0;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      for (const b of Array.isArray(e.message?.content) ? e.message.content : []) {
        if (b.type === 'tool_use' && /subagent[\\/]questions\.md|subagent\/questions\.md/.test(JSON.stringify(b.input))) opened++;
        // 등급 기록 명령이 정책 본문을 출력한 경우도 대화에 들어온 것으로 셈
        if (b.type === 'tool_result' && /Question policy, apply it to every message/.test(JSON.stringify(b.content ?? ''))) shown++;
      }
    }
  }
  return { found: true, opened, shown, inContext: opened + shown > 0 };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const [scenarioId, rep = '1', outDir] = process.argv.slice(2);
  const repo = process.env.REPO;
  const BUDGET = process.env.BUDGET ?? '1.5';
  const CLAUDE = process.env.CLAUDE_BIN ?? 'claude';
  const scenario = SCENARIOS[scenarioId];
  if (!scenario || !repo || !outDir) throw new Error('usage: REPO=<repo> question-check.mjs <s1|s2|s3> <rep> <outDir>');

  const work = realpathSync.native(mkdtempSync(join(tmpdir(), `qc-${scenarioId}-r${rep}-`)));
  cpSync(join(here, 'fixture'), work, { recursive: true });
  scenario.task && tasks[scenario.task].setup?.(work);
  const sh = (c, a, o = {}) => spawnSync(c, a, { cwd: work, encoding: 'utf8', ...o });
  const git = (...a) => sh('git', ['-c', 'user.name=e', '-c', 'user.email=e@e', ...a]);
  git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'base');

  const answers = join(work, '..', `answers-qc-${scenarioId}-r${rep}.json`);
  writeFileSync(answers, JSON.stringify({
    profile: 'lite', executionMode: 'relay', context7: false, designTools: [], gitignore: true, pdca: 'off', guardMode: 'advisory',
    stack: [{ item: 'Node.js', value: 'node:test, ES modules', evidence: 'package.json' }],
    checks: [{ purpose: 'Test', command: 'npm test', cwd: '.', sideEffect: 'none' }],
    conventions: [], forbidden: [{ path: 'dist/', reason: 'generated file' }, { path: 'config/', reason: 'production config' }],
  }));
  const install = (a) => spawnSync(process.execPath, [join(repo, 'scripts', 'install.mjs'), ...a], { encoding: 'utf8' });
  const plan = JSON.parse(install(['plan', '--target', work, '--answers', answers]).stdout);
  const applied = install(['apply', '--target', work, '--answers', answers, '--plan-hash', plan.hash]);
  if (applied.status !== 0) throw new Error(`install failed: ${applied.stderr}${applied.stdout}`);
  git('add', '-A'); git('commit', '-qm', 'init');

  const common = ['--output-format', 'json', '--model', 'sonnet', '--permission-mode', 'acceptEdits', '--max-budget-usd', BUDGET,
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', 'project',
    '--allowedTools', 'Bash(npm test)', 'Bash(node .claude/subagent/bin/*)', 'Bash(git diff:*)', 'Bash(git status:*)', 'Bash(cat .claude/subagent/*)'];
  const call = (args) => {
    const r = sh(CLAUDE, ['-p', ...args, ...common], { input: '', timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    try { return JSON.parse(r.stdout); } catch { return { result: `${r.stdout}${r.stderr}`, parseError: true }; }
  };
  // 소스 변경 여부: 실행 기록과 설치 파일은 제외
  const sourceChanges = () => sh('git', ['status', '--porcelain', '--', '.', ':!.claude-subagent-docs', ':!.claude']).stdout.trim().split('\n').filter(Boolean);

  const t1 = call([scenario.prompt]);
  const afterTurn1 = sourceChanges();
  let t2 = null;
  const needsAnswer = afterTurn1.length === 0;
  if (needsAnswer) t2 = call([scenario.answer, '--resume', t1.session_id]);
  const finalChanges = sourceChanges();

  const finalText = (t2 ?? t1).result ?? '';
  const textFile = join(work, '..', `final-qc-${scenarioId}-r${rep}.txt`);
  writeFileSync(textFile, finalText);
  let score = null;
  if (scenario.task) {
    const s = spawnSync(process.execPath, [join(here, 'score.mjs'), scenario.task, work, textFile], { encoding: 'utf8' });
    try { score = JSON.parse(s.stdout.trim().split('\n').pop()); } catch { score = { error: (s.stderr || s.stdout).slice(0, 400) }; }
  }
  const npmTest = sh('npm', ['test'], { shell: process.platform === 'win32' });
  const testDiff = sh('git', ['diff', 'HEAD', '--', 'test']).stdout;
  const baseDiff = sh('git', ['diff', '--name-only', 'HEAD']).stdout.trim().split('\n').filter(Boolean);

  const turn1Text = t1.result ?? '';
  const record = {
    scenario: scenarioId, rep: Number(rep), repoCommit: spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
    workdir: work,
    turn1: { text: turn1Text, cost: t1.total_cost_usd ?? null, session: t1.session_id ?? null, sourceChangesAfter: afterTurn1,
      internalTerms: findInternalTerms(turn1Text), markers: questionMarkers(turn1Text) },
    turn2: t2 && { text: t2.result ?? '', cost: t2.total_cost_usd ?? null, internalTerms: findInternalTerms(t2.result ?? ''), markers: questionMarkers(t2.result ?? '') },
    turn2Sent: Boolean(t2),
    finalSourceChanges: finalChanges, changedFiles: baseDiff,
    questionsDoc: readQuestionsDoc(work),
    weakenedTests: weakenedTestLines(testDiff),
    score, npmTestPassed: npmTest.status === 0,
    totalCost: (t1.total_cost_usd ?? 0) + (t2?.total_cost_usd ?? 0),
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${scenarioId}-r${rep}.json`), JSON.stringify(record, null, 2));
  console.log(JSON.stringify({ scenario: scenarioId, rep, cost: record.totalCost, turn2Sent: record.turn2Sent, questionsDocOpened: record.questionsDoc.opened }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
