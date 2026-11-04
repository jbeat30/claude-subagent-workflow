// 플러그인 정적 검사: 역할 정의 frontmatter, 도구 제한, 참조, 문체, hook 등록
// 문구 포함 여부만 확인하며 권한 차단, 위임 정확도의 검증이 아님
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { PM_RULES } from './pm-rules.mjs';
import { BUILTIN_ANALYSTS, BUILTIN_ROLES, BUILTIN_WRITERS, PLUGIN_NAME, roleName } from '../skills/run/scripts/subagent-roles.mjs';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const agentsDir = join(repoRoot, 'agents');
const runDir = join(repoRoot, 'skills', 'run');
const sharedDir = join(repoRoot, 'references');
// 문서 속 플러그인 경로(${CLAUDE_PLUGIN_ROOT}/...)를 실제 파일로 확인
const PLUGIN_REF = /\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9._\/-]+\.(?:md|mjs|json))/g;

// 역할별 허용 도구 상한, pm-agent는 Agent 호출 대상 검사를 별도로 수행
const context7 = ['mcp__context7__resolve-library-id', 'mcp__context7__query-docs', 'mcp__plugin_subagent-workflow_context7__resolve-library-id', 'mcp__plugin_subagent-workflow_context7__query-docs', 'mcp__plugin_subagent-workflow_jina__read_url', 'WebFetch'];
// Figma는 읽기 도구만 허용: 와일드카드는 use_figma, send_code_to_figma 등 사용자의 Figma 파일을 고치는 쓰기 도구까지 열어 줌
const figmaRead = ['get_design_context', 'get_metadata', 'get_screenshot', 'get_variable_defs', 'search_design_system', 'whoami'];
const figma = ['mcp__figma__', 'mcp__figma-desktop__', 'mcp__plugin_figma_figma__'].flatMap((p) => figmaRead.map((t) => p + t));
const toolCeiling = {
  'planner-agent': ['Read', 'Glob', 'Grep', 'Write', ...context7, 'mcp__anymd__*'],
  'architecture-agent': ['Read', 'Glob', 'Grep', 'Write', ...context7],
  'frontend-agent': ['Read', 'Glob', 'Grep', 'Edit', 'Write', ...context7, 'mcp__playwright__*', 'mcp__chrome-devtools__*', 'mcp__shadcn__*', ...figma, 'mcp__anymd__*'],
  'backend-agent': ['Read', 'Glob', 'Grep', 'Edit', 'Write', ...context7],
  'api-agent': ['Read', 'Glob', 'Grep', 'Edit', 'Write', ...context7],
  'test-agent': ['Read', 'Glob', 'Grep', 'Edit', 'Write', ...context7],
  'qa-agent': ['Read', 'Glob', 'Grep', 'Write', ...context7, 'mcp__playwright__*', 'mcp__chrome-devtools__*', ...figma, 'mcp__anymd__*'],
  'planning-lead': ['Read', 'Glob', 'Grep', 'Write'],
  'dev-lead': ['Read', 'Glob', 'Grep', 'Write'],
};
// 리더만 Agent 도구를 가지며 호출 대상은 소속 역할로 한정
const leaderTargets = {
  'planning-lead': ['planner-agent', 'architecture-agent', 'qa-agent'],
  'dev-lead': ['frontend-agent', 'backend-agent', 'api-agent', 'test-agent'],
};
const reportFields = ['status', 'summary', 'changedFiles', 'evidence', 'checks', 'unverified', 'blockers'];
const bannedPhrases = ['입니다', '하고 있습니다', '하는 로직입니다'];
// 설치 시 생성되는 파일은 존재 검사에서 제외
const generatedRefs = new Set(['profile.md', 'roles.local.json', 'manifest.json']);

const errors = [];
const fail = (file, message) => errors.push(`${file}: ${message}`);

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fields, body: text.slice(match[0].length) };
}

// 쉼표 분리 시 Agent(a, b) 괄호 내부 쉼표 보존
function splitTools(value) {
  const tools = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      tools.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) tools.push(current.trim());
  return tools;
}

const agentFiles = existsSync(agentsDir) ? readdirSync(agentsDir).filter((f) => f.endsWith('.md')) : [];
const agentNames = new Set(agentFiles.map((f) => f.replace(/\.md$/, '')));
const expectedRoles = Object.keys(toolCeiling);

for (const role of expectedRoles) {
  if (!agentNames.has(role)) fail(`agents/${role}.md`, '역할 정의 파일 없음');
}

for (const file of agentFiles) {
  const name = file.replace(/\.md$/, '');
  const text = readFileSync(join(agentsDir, file), 'utf8');
  const parsed = parseFrontmatter(text);
  if (!parsed) {
    fail(file, 'frontmatter 없음');
    continue;
  }
  const { fields, body } = parsed;

  if (fields.name !== name) fail(file, `name(${fields.name})과 파일명 불일치`);
  if (!fields.description) fail(file, 'description 없음');
  else if (/[가-힣]/.test(fields.description)) fail(file, 'description은 영어로 작성');
  if (!fields.tools) fail(file, 'tools 명시 필요');
  if (!fields.model) fail(file, 'model 명시 필요');

  const tools = fields.tools ? splitTools(fields.tools) : [];

  if (name === 'pm-agent') {
    fail(file, 'PM은 agents가 아니라 skills/run/SKILL.md, 에이전트로 두면 서브에이전트로 오인되어 호출될 수 있음');
    continue;
  }

  const ceiling = toolCeiling[name];
  if (!ceiling) {
    fail(file, '정의되지 않은 역할, 도구 상한 등록 필요');
    continue;
  }
  const allowedTargets = leaderTargets[name];
  for (const tool of tools) {
    if (tool.startsWith('Agent(')) {
      if (!allowedTargets) fail(file, 'Agent 도구는 리더만 사용');
      else {
        const raw = tool.slice(6, -1).split(',').map((s) => s.trim());
        for (const t of raw) if (!t.startsWith(`${PLUGIN_NAME}:`)) fail(file, `Agent 대상 ${t}에 플러그인 이름 접두사(${PLUGIN_NAME}:) 필요`);
        const targets = raw.map(roleName);
        for (const t of targets) if (!allowedTargets.includes(t)) fail(file, `Agent 대상 ${t}은 소속 역할이 아님`);
        for (const t of allowedTargets) if (!targets.includes(t)) fail(file, `Agent 대상 ${t} 누락`);
      }
    } else if (!ceiling.includes(tool)) fail(file, `허용되지 않은 도구 ${tool}`);
  }
  if (allowedTargets && !tools.some((t) => t.startsWith('Agent('))) fail(file, '리더는 Agent(...) 필요');
  for (const heading of ['## Common rules', '## Report format']) {
    if (!body.includes(heading)) fail(file, `${heading} 구간 없음`);
  }
  for (const field of reportFields) {
    if (!new RegExp(`^${field}:`, 'm').test(body)) fail(file, `보고 필드 ${field} 없음`);
  }
  // 토큰 절약 규칙: 쓰기, 분석 역할은 보고서를 파일에만 전부 쓰고 짧게 반환하며 앞선 조사를 재사용, QA는 재사용하되 직접 확인
  if ([...BUILTIN_WRITERS, ...BUILTIN_ANALYSTS].includes(name)) {
    if (!body.includes('Then return a short message, not the whole report')) fail(file, '보고서 전문을 응답으로 반복하지 않는 규칙 없음');
    if (!body.includes('- Reuse prior findings.')) fail(file, '앞선 조사 재사용 규칙 없음');
    if (!body.includes('so the PM asks the user whether to continue with it unverified')) fail(file, '문서 확인 실패 시 사용자 확인으로 넘기는 규칙 없음');
  }
  if (name === 'qa-agent' && !body.includes('Prior reports are a starting list, not proof')) fail(file, 'QA의 앞선 보고 확인 규칙 없음');
}

// 가드와 설치기가 쓰는 기본 역할 목록이 역할 정의, 리더 호출 대상과 같은지
if (JSON.stringify([...BUILTIN_ROLES].sort()) !== JSON.stringify([...expectedRoles].sort())) fail('subagent/bin/subagent-roles.mjs', '기본 역할 목록이 역할 정의 파일과 다름');
if (JSON.stringify(leaderTargets['dev-lead']) !== JSON.stringify(BUILTIN_WRITERS)) fail('subagent/bin/subagent-roles.mjs', 'dev-lead 호출 대상과 기본 쓰기 역할이 다름');

// PM 스킬: 사용자가 부를 때만 켜지는 /subagent, 호출 대상 제한과 필수 절 확인
const skillPath = join(runDir, 'SKILL.md');
if (!existsSync(skillPath)) fail('skills/run/SKILL.md', 'PM 스킬 파일 없음');
else {
  const skill = parseFrontmatter(readFileSync(skillPath, 'utf8'));
  if (!skill) fail('skills/run/SKILL.md', 'frontmatter 없음');
  else {
    const { fields, body } = skill;
    if (fields.name !== 'run') fail('skills/run/SKILL.md', 'name은 run(/subagent-workflow:run)');
    if (!fields.description) fail('skills/run/SKILL.md', 'description 없음');
    else {
      if (/[가-힣]/.test(fields.description)) fail('skills/run/SKILL.md', 'description은 영어로 작성');
      if (!/explicitly/.test(fields.description)) fail('skills/run/SKILL.md', 'description에 사용자가 명시적으로 요청할 때만 쓴다는 조건 필요');
    }
    if (fields['disable-model-invocation'] === 'true') fail('skills/run/SKILL.md', '말로 부르는 호출을 막으면 안 됨');
    const agentTool = splitTools(fields['allowed-tools'] ?? '').find((x) => x.startsWith('Agent('));
    if (!agentTool) fail('skills/run/SKILL.md', 'Agent 호출 대상 제한(Agent(...)) 필요');
    else {
      for (const target of agentTool.slice(6, -1).split(',').map((s) => s.trim())) {
        if (!target.startsWith(`${PLUGIN_NAME}:`)) fail('skills/run/SKILL.md', `Agent 대상 ${target}에 플러그인 이름 접두사 필요`);
        if (!agentNames.has(roleName(target))) fail('skills/run/SKILL.md', `Agent 대상 ${target}의 정의 파일 없음`);
      }
    }
    for (const needle of ['# Request source integrity']) {
      if (!body.includes(needle)) fail('skills/run/SKILL.md', `${needle} 없음`);
    }
  }
}

// PM 지침의 필수 규칙: 분리된 참조 파일까지 합친 본문에서 확인
const pmText = ['skills/run/SKILL.md', 'references/design-tools.md', 'references/rule-priority.md', 'references/ui-verification.md', 'skills/run/references/questions.md']
  .map((p) => (existsSync(join(repoRoot, p)) ? readFileSync(join(repoRoot, p), 'utf8') : ''))
  .join('\n');
for (const [label, re] of PM_RULES) {
  if (!re.test(pmText)) fail('pm-agent 규칙', `필수 규칙 없음: ${label}`);
}

// UI 검증 방식 문서를 UI 검증 역할이 참조하는지 확인
for (const role of ['planner-agent', 'frontend-agent', 'qa-agent']) {
  const p = join(agentsDir, `${role}.md`);
  if (existsSync(p) && !readFileSync(p, 'utf8').includes('${CLAUDE_PLUGIN_ROOT}/references/ui-verification.md')) fail(`agents/${role}.md`, 'ui-verification.md 참조 없음');
}

// 문체와 참조 검사
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const promptFiles = [agentsDir, sharedDir, join(repoRoot, 'skills')].flatMap(walk).filter((p) => p.endsWith('.md'));
for (const path of promptFiles) {
  const text = readFileSync(path, 'utf8');
  const rel = path.slice(repoRoot.length + 1).split('\\').join('/');
  // 프롬프트(역할, 양식)는 영어 기본, 한글이 섞이면 토큰 효율과 검사 라벨 일관성이 깨지므로 거부
  // 설치, 설정, 점검, 역할 추가 스킬의 description에는 한국어 호출 문구가 의도적으로 있음
  if (/[가-힣]/.test(text) && !/^skills\/(setup|setting|check|add-role)\//.test(rel)) fail(rel, '프롬프트는 영어로 작성(한글 포함)');
  for (const phrase of bannedPhrases) {
    if (text.includes(phrase)) fail(rel, `지양 문구 "${phrase}" 포함`);
  }
  for (const m of text.matchAll(PLUGIN_REF)) {
    if (!existsSync(join(repoRoot, m[1]))) fail(rel, `참조 파일 ${m[1]} 없음`);
  }
  // 프로젝트 쪽 경로는 설치 때 생기는 파일만 허용(옛 복사 경로가 남지 않게)
  for (const m of text.matchAll(/\.claude\/subagent\/([A-Za-z0-9._\/-]+\.(?:md|mjs|json))/g)) {
    if (!generatedRefs.has(m[1])) fail(rel, `프로젝트에 없는 옛 경로 .claude/subagent/${m[1]}`);
  }
}

// 플러그인 hook: 가드 등록 확인(플러그인을 켠 모든 세션에서 실행되므로 가드는 워크플로 프로젝트에서만 판정)
const hooksPath = join(repoRoot, 'hooks', 'hooks.json');
if (!existsSync(hooksPath)) fail('hooks/hooks.json', '파일 없음');
else {
  const hooks = JSON.parse(readFileSync(hooksPath, 'utf8')).hooks ?? {};
  const pre = (hooks.PreToolUse ?? []).flatMap((g) => g.hooks.map((h) => ({ ...h, matcher: g.matcher })));
  const guard = pre.find((h) => /subagent-guard\.mjs/.test(h.command));
  if (!guard) fail('hooks/hooks.json', 'PreToolUse에 subagent-guard 없음');
  else {
    for (const tool of ['Write', 'Edit', 'Agent']) {
      if (!guard.matcher.split('|').includes(tool)) fail('hooks/hooks.json', `PreToolUse matcher에 ${tool} 없음`);
    }
    const script = guard.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+\.mjs)/)?.[1];
    if (!script || !existsSync(join(repoRoot, script))) fail('hooks/hooks.json', 'hook 스크립트 파일 없음');
  }
  if (!JSON.stringify(hooks.PostToolUse ?? []).includes('subagent-guard')) fail('hooks/hooks.json', 'PostToolUse에 subagent-guard 없음');
  // 플러그인 폴더는 프로젝트 밖이라 PM과 역할이 양식, 규칙 문서를 읽을 때마다 권한 확인에 걸림, 매 턴과 서브에이전트에 적용되는 hook으로 자기 파일 읽기만 허용
  const reader = pre.find((h) => /plugin-read\.mjs/.test(h.command));
  if (!reader) fail('hooks/hooks.json', 'PreToolUse에 plugin-read(플러그인 파일 읽기 허용) 없음');
  else {
    if (!reader.matcher.split('|').includes('Read')) fail('hooks/hooks.json', 'plugin-read matcher에 Read 없음');
    const script = reader.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+\.mjs)/)?.[1];
    if (!script || !existsSync(join(repoRoot, script))) fail('hooks/hooks.json', 'plugin-read 스크립트 파일 없음');
  }
}

// 기획안 양식의 12개 구성 번호 확인
const planPath = join(runDir, 'references', 'plan-template.md');
if (existsSync(planPath)) {
  const plan = readFileSync(planPath, 'utf8');
  for (let i = 1; i <= 12; i++) {
    if (!new RegExp(`^## ${i}\\. `, 'm').test(plan)) fail('skills/run/references/plan-template.md', `구성 ${i}번 없음`);
  }
} else fail('skills/run/references/plan-template.md', '파일 없음');

// 플러그인 배포: 이름은 저장소명과 일치, 제작자 jbeat, 마켓플레이스는 jbeat-plugins(별도 저장소)에서 등록
const pluginDir = join(repoRoot, '.claude-plugin');
const pluginPath = join(pluginDir, 'plugin.json');
let plugin = null;
try {
  plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
} catch {
  fail('.claude-plugin/plugin.json', '파일 없음 또는 JSON 오류');
}
if (plugin) {
  if (plugin.name !== 'subagent-workflow') fail('plugin.json', 'name은 subagent-workflow(claude- 접두사는 서드파티 예약어라 사용 불가)');
  if (plugin.author?.name !== 'jbeat') fail('plugin.json', 'author.name은 jbeat');
  // 원격 MCP 묶음: Node 없이 동작하도록 http 원격 서버만, 키 헤더 없이
  const bundled = { context7: 'https://mcp.context7.com/mcp', jina: 'https://mcp.jina.ai/v1?include_tags=read' };
  const servers = plugin.mcpServers ?? {};
  if (Object.keys(servers).sort().join() !== Object.keys(bundled).sort().join()) fail('plugin.json', `mcpServers는 ${Object.keys(bundled).join(', ')}만`);
  for (const [name, url] of Object.entries(bundled)) {
    const s = servers[name];
    if (s && (s.type !== 'http' || s.url !== url || s.headers)) fail('plugin.json', `mcpServers.${name}은 type http, url ${url}, headers 없음`);
  }
}
const skillsDir = join(repoRoot, 'skills');
const skillNames = existsSync(skillsDir) ? readdirSync(skillsDir) : [];
for (const required of ['run', 'setup', 'check']) {
  if (!skillNames.includes(required)) fail('skills', `${required} 스킬 없음`);
}
for (const name of skillNames) {
  const rel = `skills/${name}/SKILL.md`;
  const skillPath = join(skillsDir, name, 'SKILL.md');
  if (!existsSync(skillPath)) {
    fail(rel, '파일 없음');
    continue;
  }
  const fm = parseFrontmatter(readFileSync(skillPath, 'utf8'));
  if (!fm || fm.fields.name !== name) fail(rel, 'frontmatter name이 폴더명과 같아야 함');
}

if (errors.length) {
  console.error(`실패 ${errors.length}건`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`통과: 역할 정의 ${agentFiles.length}종, 프롬프트 ${promptFiles.length}종 정적 검사 (문구·참조 확인이며 동작 검증 아님)`);
