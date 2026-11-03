# Work card

Common form for internal handoff between agents, never used in conversation with the user.
Pass it as the prompt body of a call.
Use file paths as the single source of truth, not summaries. If the card and the files differ, the receiver stops and reports the difference.

- runId:
- Request source path: `.claude-subagent-docs/runs/<runId>/request.md`
- Plan path and hash: `.claude-subagent-docs/runs/<runId>/plan.md`, hash
- Mode: if applicable plan | final
- Goal:
- Allowed files (exact paths): source files from plan section 6 only, comma separated, no notes. For read-only roles (planner, architecture, qa, analyst roles) write `none`; their report path goes in Output path
- Forbidden files and areas:
- Assigned requirements and completion criteria IDs:
- Order and dependencies: prior work and output paths
- Output path: if applicable. A report file is `reports/<plain role name>-NN.md`, never with the `subagent-workflow:` prefix (for example `reports/architecture-agent-01.md`, `reports/qa-plan.md`, `reports/qa-final.md`); the guard rejects any other name
- Evidence paths: if applicable, prior reports, check records, diff paths
- On rework: failed items and round number (limit 3)

## Request source

> Paste the exact content of request.md here (copy it, do not retype or reformat it)
