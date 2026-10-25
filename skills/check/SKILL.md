---
name: check
description: |
  Check the Claude Subagent Workflow installation in the current project without calling Claude (no token cost).
  Runs the bundled static verify and reports pass, fail, and unchecked items.
  Triggers: check subagent workflow, verify subagent workflow installation, check agent team, claude subagent workflow check, 워크플로 설치 확인, 점검
argument-hint: "(no argument needed)"
user-invocable: true
allowed-tools:
  - Bash
---

# Claude Subagent Workflow Check

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs" verify --target .` without `--live` (no Claude call).
2. Summarize `fail`, `unverified`, and `update` from the result in the user's language. An `update` item (`team version`) means the project's installed workflow files are older than this plugin: tell the user to run `/subagent-workflow:setup update`, and that a newer plugin version itself is fetched with `claude plugin marketplace update jbeat-plugins` then `claude plugin update subagent-workflow@jbeat-plugins`. If nothing is installed, point to `/subagent-workflow:setup`.
3. Checking that the guard really fires needs `--live`, which calls Claude once. Say so and run it only when the user asks.
