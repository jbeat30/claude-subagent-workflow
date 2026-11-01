@./AGENTS.md

# Development entry guide

This file is the development entry point for the claude-subagent-workflow repository itself.

1. Read `README.md` for the purpose and usage flow.
2. Read `.github/BRANCH_STRATEGY.md` for branch and commit rules.
3. Read `AGENTS.md` for conventions, repository structure, and verification commands.

The repository root is the plugin itself (`agents/`, `skills/`, `hooks/`, `references/`). It is separate from this repository's own `.claude/` settings.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists and you do not yet know where relevant code lives, run `graphify query "<question>"` before broad grep or search. Skip it when the target file is already known (single-file edit, docs-only change), and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After code changes that add, remove or rename files, functions or modules, run `graphify update .` (AST-only, no API cost). Docs-only or small in-place edits do not need it.
- graphify-out/ is local only (listed in .gitignore) and regenerated with `graphify update .`, so it never appears in a pull request.
