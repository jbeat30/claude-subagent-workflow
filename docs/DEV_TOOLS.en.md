# Development tools guide

Roles, install scope, startup, and maintenance of the tools used in the owner's environment for developing this repository.
Plugin users and contributors do not need it. For `npm test` and contribution rules, see `.github/CONTRIBUTING.md`.
Confirmed facts were checked directly in the verification environment (2026-11-02, Windows, Claude Code 2.1.316, Git Bash, zsh). Recommended practice is marked separately.

## 1. Purpose and roles

| Tool | Kind | Role |
| --- | --- | --- |
| jbeat-conventions v2.0.1 | Claude Code plugin (2 skills) | Applies the project coding conventions |
| Ponytail | Claude Code plugin (with hooks) | Reduces needless work by favoring reuse and simple implementations |
| Graphify | Separate CLI plus project skill and hooks | Narrows related code paths with a code knowledge graph to reduce repeated exploration |
| Headroom | Separate CLI (local proxy) plus MCP | Reduces the size of compressible input in Claude requests |

- Not all of these are skills. The skills are jbeat-conventions and the project copy of Graphify, and Headroom is a proxy.
- Savings, added working time, and fewer errors are not guaranteed. Measure them yourself with the methods in section 6 if needed.

## 2. Scope and automation

| Tool | Verified version and source | Install scope | Applied automatically when | Not handled automatically | Needs explicit call or refresh |
| --- | --- | --- | --- | --- | --- |
| jbeat-conventions | v2.0.1 (tag commit 0908dc0), <https://github.com/jbeat30/jbeat-conventions> | This project (project scope) | In a new session after install, when the connection block in `CLAUDE.local.md` is loaded, the skill is suggested for relevant work | Installing alone does not apply it to every response, and compliance is not guaranteed | Call directly with `/jbeat-conventions:jbeat-apply`, connect with `/jbeat-conventions:jbeat-setup` |
| Ponytail | Plugin 5.3.3, <https://github.com/DietrichGebert/ponytail> | This project (project scope) | A session start hook injects the mode, and the confirmed mode is full | Does not replace project conventions and does not permit skipping requirements or verification | Change mode with `/ponytail lite\|full\|ultra\|off` |
| Graphify | CLI 0.9.100, <https://github.com/Graphify-Labs/graphify> | CLI is user-global, hooks and skill live in this project's `.claude/` | Hooks add a graph usage hint before Bash, Grep, Read, and Glob calls | Does not run queries or refresh the graph (hooks only advise) | Refresh with `graphify update .`, query on request |
| Headroom | CLI 0.42.0, <https://github.com/headroomlabs-ai/headroom> | CLI is user-global, proxy routing only for sessions started through the wrapper | Starting with `headroom wrap claude` points `ANTHROPIC_BASE_URL` at the local proxy | A plain `claude` run bypasses the proxy, and not all input is compressed | Must start through the wrapper |

## 3. jbeat-conventions v2.0.1

### Install, update, call

```text
/plugin marketplace add jbeat30/jbeat-plugins
/plugin install jbeat-conventions@jbeat-plugins
/jbeat-conventions:jbeat-setup
```

- Update: run `claude plugin marketplace update jbeat-plugins` and then `claude plugin update jbeat-conventions@jbeat-plugins` in a shell.
- This project's connection block is in `CLAUDE.local.md` (excluded from Git). It is not in the shared `AGENTS.md` because contributors do not have to install the plugin.
- Check the connection with `/jbeat-conventions:jbeat-setup status` and remove it with `/jbeat-conventions:jbeat-setup remove`.
- Example request: `Fix the login error and check the related failure paths.` Direct call: `/jbeat-conventions:jbeat-apply Review this change.`
- The old call `/jbeat-apply` is no longer used. The repository guidance was updated to the new name.

### Priority with Ponytail

1. The project's explicit coding rules
2. jbeat-conventions v2.0.1
3. Ponytail (supporting guideline)

- If project rules and jbeat-conventions conflict, ask the user to choose, as jbeat-conventions defines. Do not decide silently when it is unclear.
- The same content is recorded once, in the "Development tool priority" section of `AGENTS.md`.

### Revert

- Disconnect only: `/jbeat-conventions:jbeat-setup remove`, or delete `CLAUDE.local.md`.
- Disable the plugin from `/plugin`.
- To restore the old version, see `~/.claude/backups/patch-0.6.1-20261102/user/installed_plugins.json`.

## 4. Starting Claude Code

Run it from the project folder so that `.claude/` settings, project-scope plugins, and the graph apply together.

```sh
# Keep permission prompts (recommended default)
headroom wrap claude --code-memory none

# Skip permission prompts (optional)
headroom wrap claude --code-memory none --dangerously-skip-permissions
```

- The owner ran this command in zsh on Windows and confirmed an interactive session works. During verification, both commands also passed their arguments through to `claude` and exited with code 0 when `--version` was forwarded.
- The syntax is the same in Git Bash and PowerShell, but it was not verified there.
- `--code-memory none`: skips registering Headroom's code-memory MCP (Serena by default). It is separate from routing through the compression proxy.
- `--dangerously-skip-permissions`: an optional Claude Code flag that skips permission prompts. It is not required for the tool integration, so use it only in repositories you trust.
- `/remote-control` (`/rc`) is disabled in wrapper sessions (a `headroom doctor` warning). Use plain `claude` when you need it.

## 5. Everyday work and graph refresh

Ordinary request: `Remove duplicated wording in the question policy document.`
Path lookup request: `Use graphify to find the file with the plugin read allow logic first.`
Refresh request: `I changed the structure, so refresh the graph with graphify update.`

- Manual refresh: `graphify update .` at the repository root. It is local AST analysis and needs no model call or API key.
- Manual query: `graphify query "<question>" --budget 1000`, `graphify explain "<concept>"`, `graphify path "A" "B"`.
- Refresh after adding, removing, or renaming files, functions, or modules. It is unnecessary for docs-only changes and small in-place edits.
- There is no automatic refresh. The hooks only advise and do not run queries or refreshes, and the git hooks (`graphify hook install`) are not installed.
- Local analysis and model-backed analysis differ. Reflecting doc and image changes (`/graphify --update`) and naming communities (`graphify label`) may need model calls. This setup adds no API key.
- If results are thin, raise `--budget`, pick a start node with `--seed`, or run `graphify update .` and read the file directly.
- The graph summarizes code and document structure, so confirm exact behavior against the source files and tests.

## 6. Status checks and maintenance

| Check | How |
| --- | --- |
| Plugin loading | `claude plugin list` (jbeat-conventions 2.0.1 and ponytail enabled, no `failed to load`) |
| Skill callable | `/jbeat-conventions:jbeat-setup status` in a new session |
| Headroom proxy | `headroom doctor`, and `echo $ANTHROPIC_BASE_URL` in a wrapper session |
| Request pass-through and compression stats | `headroom savings`, `headroom dashboard` |
| Graphify | `graphify query "<question>"` returns nodes with exit code 0 |

- Install success, configuration, a successful real request, and confirmed compression are separate stages. A running proxy alone does not prove compression.
- Compression statistics cover input handled by the proxy. They are not a savings rate for the whole task or subscription usage, and other factors such as cache savings are mixed in.
- The `tool_search_deferred_orphan` warning is a Headroom proxy log warning meaning it did not recognize deferred-loading tools and skipped tool schema handling (confirmed in the Headroom source). It is not a request failure, and requests still passed in the verification session.
- `command not found`: check that `~/.local/bin` is on PATH, restart the terminal, and confirm the install with `uv tool list`.
- Restart the terminal or Claude after installing or updating a plugin, and after changing `CLAUDE.local.md` or `.claude/settings.json`.
- A plain `claude` run bypasses the proxy. Plugins, hooks, and instructions load the same way, and only Headroom compression is missing.

### Shared and local-only files

| Group | Files |
| --- | --- |
| Shared (committed) | `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.graphifyignore`, this document |
| Local only (excluded from Git) | `.claude/` (hooks, plugin activation, Graphify skill copy), `CLAUDE.local.md`, `graphify-out/` |

- `graphify-out/` is not committed. It can be regenerated with `graphify update .`, it contains a local absolute path (`.graphify_root`) and a session cache, and the whole `graph.json` changes on every refresh.
- `.claude/` is not shared with contributors because its hooks can fail where `graphify` is not installed.
- Graphify applies `.gitignore` and `.git/info/exclude` together. `.graphifyignore` stays in Git and excludes secret files, build outputs, and local tool settings from analysis. Its overlap with `.gitignore` is intentional, as a guard when running with `--no-gitignore`.

### New development environment

1. Install Claude Code and clone the project.
2. Install Headroom and Graphify following each official repository, and confirm versions with `uv tool list` (the verification environment used uv tool).
3. Run `/plugin marketplace add jbeat30/jbeat-plugins`, `/plugin install jbeat-conventions@jbeat-plugins --scope project`, `/plugin marketplace add DietrichGebert/ponytail`, and `/plugin install ponytail@ponytail`.
4. Register the hooks with `graphify claude install`, then run `graphify update .`.
5. Connect with `/jbeat-conventions:jbeat-setup` (choose `CLAUDE.local.md` as the target).
6. Start with `headroom wrap claude --code-memory none`.

### Update and disable

- jbeat-conventions: see section 3. Ponytail: `/ponytail off`, or disable it from `/plugin`.
- Remove the Graphify hooks with `graphify claude uninstall` (removes the graphify section of CLAUDE.md and the hooks). For Headroom, start with plain `claude`.
- Keep backups made before settings changes outside the repository (`~/.claude/backups/`), never inside an active skill directory.

### Known limits

- Right after installing, the session's skill list may not refresh, so check again after a restart.
- Wrapper sessions cannot use `/remote-control`.
- Only Graphify's code analysis is local. Semantic extraction of docs and images may need model calls.
- Ponytail's mode text is guidance for brevity, and no verification may be skipped because of it.
