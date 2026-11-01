# Safeguards, feature maturity, roadmap

[Back to README](../../README.en.md)

## Safeguards and limits

- **Guard hook (advisory mode)**: checks per-role write paths, source writes only after the plan is confirmed, edits only to assigned files, leaders' call targets, and sequential writing subagents, and blocks on error.
- **A mistake-prevention aid, not a security boundary**: it does not stop main-session shell commands or changes to user and hook settings.
- Check records are results the main session ran through the runner and are not fully tamper-proof; the QA report states the source.
- Right after install the guard is checked with a real Claude call; if that is not confirmed, treat it as `no protection`.
- Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md).

### What are the protection mode and the guard hook?

- **Guard hook**: a small script Claude Code runs right before it writes a file or calls another subagent in this project. It blocks actions that break the rules, such as editing a file that is not in the confirmed plan or calling an subagent that should not be called.
- **Advisory mode (default)**: the guard blocks rule violations. It is a safety net against mistakes, not a security boundary.
- **Strict mode (optional)**: adds approval records on top of advisory mode. You approve the allowed paths and commands directly. It is experimental and applies to every edit of the main session.

### Feature maturity

| Level | Features | Default install |
| --- | --- | --- |
| Stable (covered by the v1.0.0 promise) | Skill install, update, and removal, Lite, role files, advisory-mode guard, check runner | On |
| Experimental or optional (outside the promise) | Full, relay execution mode, strict mode (direct approval tracking), requirement-preservation trace check (`subagent-check.mjs trace`) | Off; choose with `/subagent-workflow:setting` or in a request |

- Strict mode applies to every edit of the main session, so it can affect ordinary conversations where the workflow was not called. Limiting it to workflow runs is still to be done.
- Experimental features are not verified in a real Claude environment, and there is no comparison yet showing they beat handling tasks directly.
- **The guard blocks the PM from editing directly during a `/subagent-workflow:run` run, but classification and impact analysis rest on the prompt**: loading the skill creates a run state, and edits are blocked before the PM records a grade and for Q. L1 allows comment and document edits in any number of files, while other edits are limited to one file and the second such file requires raising the grade. The guard reads the line to be edited to decide whether it is a comment, and treats it as not a comment when it cannot tell. For L2 and L3 the PM cannot edit directly; only subagents edit after the plan is confirmed. The state is released once a close record exists or after 4 hours without updates, so it does not apply to ordinary conversation. The blocking scene itself was not observed in real Claude. Edits made through shell commands are not blocked, and a PM that fails to find a caller and edits only one file is still possible. Behavior in interactive use has not been checked.
- The v0.6.0 plugin-native layout (the plugin provides the roles, instructions, and guard) was checked with unit tests and `claude plugin validate`. Real Claude checks are listed in the roadmap below. Interactive screens (the skill permission prompt, the trust screen), macOS/Linux, and updating between releases are not checked yet.

- There is no guarantee that the workflow structure improves quality over handling tasks directly.

## Roadmap

| Item | Status |
| --- | --- |
| Plugin install and `/subagent-workflow:run` call | Switched to the plugin-native layout in v0.6.0; interactive screens to be checked |
| English prompts and user-language replies | Implemented; delegation evaluation planned |
| Hard-task comparison (direct, Lite, Full, repeated runs) | One run published; repeated runs not done |
| Context slimming (shorter PM instructions) | First pass done (PM instructions about 18% smaller, a rule-list check prevents omissions); more planned |
| Design tool MCP choice at setup (Playwright, shadcn/ui, three Figma connection types) | Implemented; real Claude and server connection check planned |
| bkit PDCA integration | Postponed until after v1.0.0 (outside the 1.0 scope) |
