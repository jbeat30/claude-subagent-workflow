# Safeguards, feature maturity, roadmap

[Back to README](../../README.en.md)

## Safeguards and limits

- **Guard hook (advisory mode)**: checks per-role write paths, source writes only after the plan is confirmed, edits only to assigned files, leaders' call targets, and sequential writing agents, and blocks on error.
- **A mistake-prevention aid, not a security boundary**: it does not stop main-session shell commands or changes to user and hook settings.
- Check records are results the main session ran through the runner and are not fully tamper-proof; the QA report states the source.
- Right after install the guard is checked with a real Claude call; if that is not confirmed, treat it as `no protection`.
- Report vulnerabilities privately through [SECURITY.md](../../SECURITY.md).

### What are the protection mode and the guard hook?

- **Guard hook**: a small script Claude Code runs right before it writes a file or calls another agent in this project. It blocks actions that break the rules, such as editing a file that is not in the confirmed plan or calling an agent that should not be called.
- **Advisory mode (default)**: the guard blocks rule violations. It is a safety net against mistakes, not a security boundary.
- **Strict mode (optional)**: adds approval records on top of advisory mode. You approve the allowed paths and commands directly. It is experimental and applies to every edit of the main session.

### Feature maturity

| Level | Features |
| --- | --- |
| Core | Skill install, update, and removal, Lite, role files, advisory-mode guard, check runner |
| Experimental or optional | Full, relay execution mode, strict mode (direct approval tracking), requirement-preservation trace check (`subagent-check.mjs trace`) |

- Strict mode applies to every edit of the main session, so it can affect ordinary conversations where the workflow was not called. Limiting it to workflow runs is still to be done.
- Experimental features are not verified in a real Claude environment, and there is no comparison yet showing they beat handling tasks directly.
- **Following the L3 procedure depends on the prompt alone and is not enforced**: in the v0.2.0 evaluation the PM classified a request as L3 and still edited directly without a plan, impact analysis, or user confirmation. That may have been caused by the direct path of that version; this version removed it but did not measure again. Behavior in interactive use has not been checked.
- Marketplace install and the `/subagent` call were checked in real Claude. Interactive screens (the skill permission prompt, the trust screen), macOS/Linux, and updating between releases are not checked yet.

![Cost, time, and tokens by mode](../verification/assets/mode-compare.en.svg)

- [Small fixture run record](../verification/2026-10-19-small-fixture.md) (Korean), 14 runs, one each, non-interactive, with Korean prompts before the English switch: Lite cost about 12x and took 30x+ longer than direct handling on L2/L3 tasks, so Lite is the default and Full is opt-in for large work.
- [v0.3.7 check results](../verification/EVAL_RESULTS_v0.3.7.md) (Korean): one check each of five situations for deciding the UI verification method per target from the project's own rules. Not a utility evaluation.
- [v0.3.6 check results](../verification/EVAL_RESULTS_v0.3.6.md) (Korean): one check each of the Figma connection types, rule priority, and the guard's `.claude/` protection scope; not a usefulness evaluation.
- [v0.3.3 check results](../verification/EVAL_RESULTS_v0.3.3.md) (Korean): one check of switching the protection mode (advisory/strict) and of edits being blocked and released; not a usefulness evaluation
- [v0.3.2 check results](../verification/EVAL_RESULTS_v0.3.2.md) (Korean): one check each of switching the mode after install and the `setting` skill; not a usefulness evaluation
- [v0.3.0 check results](../verification/EVAL_RESULTS_v0.3.0.md) (Korean): a check of how `/subagent` is called and one run of the hard task l1; not a usefulness evaluation
- [v0.2.0 evaluation results](../verification/EVAL_RESULTS_v0.2.0.md) (Korean; 8 tasks, one run each, one model, raw JSON included): the workflow's value can only be judged on the hard tasks (hidden callers l1, implicit requirements m1), which have few measurements and one run each, so they cannot be judged against the design criteria. Easy tasks are not requests anyone would hand to the workflow, so their cost figures are not used as evidence of the workflow's usefulness.
- There is no guarantee that the workflow structure improves quality over handling tasks directly.

## Roadmap

| Item | Status |
| --- | --- |
| Skill (plugin) install and `/subagent` call | Implemented; marketplace install and `/subagent` checked once each in real Claude; interactive screens still to be checked |
| English prompts and user-language replies | Implemented; delegation evaluation planned |
| Hard-task comparison (direct, Lite, Full, repeated runs) | One run published; repeated runs not done |
| Context slimming (shorter PM instructions) | First pass done (PM instructions about 18% smaller, a rule-list check prevents omissions); more planned |
| Design tool MCP choice at setup (Playwright, shadcn/ui, three Figma connection types) | Implemented; real Claude and server connection check planned |
| bkit PDCA integration | Planned for v0.4.0 |
