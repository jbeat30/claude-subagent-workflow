<p align="center">
  <img src="docs/assets/hero.en.png" alt="claude-subagent-workflow" width="100%">
</p>

<p align="center">
  <a href="https://github.com/jbeat30/claude-subagent-workflow/actions/workflows/ci.yml"><img src="https://github.com/jbeat30/claude-subagent-workflow/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/release-v0.5.0-blue" alt="release: v0.5.0">
  <img src="https://img.shields.io/badge/Claude%20Code-%E2%89%A5%202.1.302-5A67D8" alt="Claude Code 2.1.302 or later">
  <img src="https://img.shields.io/badge/Node-%E2%89%A5%2020-339933" alt="Node 20 or later">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT"></a>
</p>

<p align="center"><a href="README.md">한국어</a></p>
# claude-subagent-workflow

**A plugin that installs, with one skill, a Claude Code workflow in which the main session acts as the PM, hands work to role subagents, and an independent QA verifies it**

## What problem does it solve

It is for Claude Code users who worry about these things on larger changes:

- Unstated requirements (validation, error handling) get dropped
- Hidden callers are missed, such as function references or names in config files
- Files outside the assignment get edited
- Unchecked work is reported as done

When you call the workflow, a request goes through intake, plan, confirm, build, and independent QA. Every role reads the original request and the plan file itself, no source is edited before confirmation, only assigned files are edited, and anything not verified stays marked `unchecked`. Your project's existing rules (`CLAUDE.md`, `AGENTS.md`, lint config, and so on) always win. Installing does not change normal Claude conversations; the workflow runs only when you call it with `/subagent`.

## When to use it and when to ask directly

| Call the workflow | Just ask directly |
| --- | --- |
| Changing a function's return shape or an API contract with many callers to fix | Code explanations, questions |
| Adding a feature where unstated requirements are easy to miss | Typos, comments, wording fixes |
| Changes to data structures, permissions, or security where impact must be traced first | Small edits to a single file |

When you call `/subagent`, the main session (the PM) first sorts the request into four grades. Subagents are called only for L2 and L3.

| Grade | What kind of request | Handling |
| --- | --- | --- |
| Q | Question, explanation, or research (no file changes) | The PM answers directly |
| L1 | A comment, typo, or wording fix with no behavior change | The PM edits directly |
| L2 | A behavior change that keeps the existing contract | Plan, confirm, build, independent QA |
| L3 | A wide-impact change: the signature of a function or API other files use, data structures, permissions, security | L2 plus impact analysis, and the user is always asked to confirm |

If you call `/subagent` for a simple request, the PM handles it directly and no subagent cost is incurred. Classifying still has a cost, so for small tasks asking directly is faster and cheaper. See [Extra cost and verification level](#extra-cost-and-limits) below first.

## Quick start

Requirements: Claude Code 2.1.302 or later, Node 20 or later

```text
/plugin marketplace add jbeat30/jbeat-plugins
/plugin install subagent-workflow@jbeat-plugins
/subagent-workflow:setup
```

![Install flow](docs/assets/install-flow.en.png)

The setup skill inspects the project, asks only what it must, shows the change plan, and asks for confirmation once. It does not overwrite existing files and does not touch global settings or feature code. After install, call it like this:

```text
/subagent Add a show/hide password toggle to the existing login screen. Follow the current UI rules.
```

Saying "solve this with the subagent workflow: ..." also works, but the model decides, so it can occasionally miss; use `/subagent` then. Fetching the repository directly is covered in the [install guide](docs/guide/install.en.md).

## Extra cost and limits

- **Cost**: L2 and L3 call the planning, development, and verification roles several times, so they cost several times more and take longer than handling the task directly. After install, the guard check makes one Claude call, and registering MCP servers adds their tool definitions to every call, which raises tokens. Questions (Q) and trivial edits (L1) call no subagents.
- **Verification level**: the static checks and unit tests in `npm test` check the guard and installer behavior, but they do not prove delegation accuracy or prompt quality. There is no guarantee that the workflow improves quality over direct handling.
- **Scope of the bypass block**: during a `/subagent` run the guard blocks the PM from editing directly. Before classification and for questions (Q) no edits are allowed, L1 allows comment and document edits in any number of files and other edits in one file, and for L2 and L3 only subagents edit. Classification itself is still the PM's judgment and whether the impact analysis is thorough rests on instructions.
- **Experimental**: Full mode, relay execution, and strict mode are not well verified in a real Claude environment.
- **Limits of protection**: the guard hook is a safety net against mistakes, not a security boundary. It cannot stop shell commands in the main session or changes to user and hook settings. Strict mode applies to edits in ordinary conversations where `/subagent` was not called.
- **Not checked**: interactive screens such as the skill permission prompt, macOS and Linux, and updating between releases.

Details: [Safeguards and feature maturity](docs/guide/safety-and-maturity.en.md)

## Guides

| Document | Content |
| --- | --- |
| [Install and choices](docs/guide/install.en.md) | The four skills (setup, check, setting, add-role), what you choose at setup (Context7, document reading, design tool MCP, protection mode, conflict handling), installed files |
| [Using it after install](docs/guide/usage.en.md) | Calling `/subagent`, usage examples, when to call it |
| [How it works](docs/guide/how-it-works.en.md) | Lite and Full structure, roles, task grade flow, project rule priority, against hallucination and unrequested edits, token efficiency |
| [Changing settings](docs/guide/settings.en.md) | Default mode, protection mode, adding and removing MCP servers |
| [Getting a new version, update and removal](docs/guide/update-remove.en.md) | Plugin update, project file update, removal |
| [Safeguards, feature maturity, roadmap](docs/guide/safety-and-maturity.en.md) | Guard hook and protection mode, feature maturity, evaluation records, roadmap |
| [Prompt design principles](docs/PROMPT_DESIGN.en.md) | Rules kept by prompt alone versus rules enforced by hooks and the check runner |

## Contributing

Issues and fork PRs are welcome. Only the owner has write access, and every change is merged after the owner reviews and approves it.

- Bug reports and feature ideas: [Issues](https://github.com/jbeat30/claude-subagent-workflow/issues/new/choose)
- Proposing changes: fork, then open a PR against the `feature/vX.Y.Z` branch the owner names.
- `main`, `release`, and `feature` require PRs and forbid force pushes; outside contributors cannot push or merge directly.
- Fork PR workflows from outside contributors need the owner's approval to run, regardless of contribution history.
- Development needs Node 20 or later; `npm test` runs static checks and unit tests.
- Details: [Contributing](.github/CONTRIBUTING.md), [Branch strategy](.github/BRANCH_STRATEGY.md), [Development rules](AGENTS.md)
- Report security vulnerabilities privately, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) · Copyright (c) 2026 jbeat
