---
name: setup
description: |
  Set up, update, or remove the Claude Subagent Workflow in the current project.
  Surveys the project, asks only what it cannot find, writes the project profile the roles read, and verifies the guard. The roles, the PM, and the guard come from the plugin itself.
  Triggers: set up subagent workflow, install subagent workflow, update subagent workflow, remove subagent workflow, claude subagent workflow setup, 서브에이전트 워크플로 세팅, 설치, 갱신, 제거
argument-hint: "[install | update | remove]"
user-invocable: true
allowed-tools:
  - Read
  - Bash
  - Glob
  - Write
  - AskUserQuestion
---

# Claude Subagent Workflow Setup

`<installer>` = `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scripts/install.mjs"`
If `${CLAUDE_PLUGIN_ROOT}` is empty, find it with `find ~/.claude -path "*subagent-workflow*/skills/setup/scripts/install.mjs" | head -1`.

## Steps

1. Decide the action from the argument or the request: install (default), update, or remove.
2. Read [references/install-guide.md](references/install-guide.md) and follow the matching sections.
   - install: sections 1 to 7
   - update: section 9
   - remove: section 8
3. Save tokens: read only the needed sections, and do not ask what `detect` already tells you.
4. Talk with the user in their language. Installer output is English; show it translated.

## Usage mode

Do not ask for a mode at setup. The workflow starts in Lite. Do not ask for the protection mode either; setup uses advisory mode and strict is only on explicit request. Say in one line that the default mode (Lite or Full), the protection mode, and the MCP servers can be changed later with `/subagent-workflow:setting`, and that a single request can ask for Full ("handle this in Full mode").

## Rules

- Apply the "Rules to always follow" of the setup guide as written. This skill is an entry point and never widens permissions.
- Never change global settings or other plugins; stay inside the current project.
- Report checks you could not run as `unchecked`.
