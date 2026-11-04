---
name: setting
description: |
  Show and change the Claude Subagent Workflow settings of the current project: which optional MCP servers the workflow uses. Offers to add, switch, or remove an MCP server (including the Figma connection type).
  Triggers: workflow settings, which mcp, add mcp, claude subagent workflow setting, 워크플로 설정, mcp 추가, mcp 선택
argument-hint: "[mcp]"
user-invocable: true
allowed-tools:
  - Read
  - Bash
  - PowerShell
  - AskUserQuestion
---

# Claude Subagent Workflow Setting

`<installer>` = `node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scripts/install.mjs"`
If `${CLAUDE_PLUGIN_ROOT}` is empty, find it with `find ~/.claude -path "*subagent-workflow*/skills/setup/scripts/install.mjs" | head -1`.
This skill changes only the workflow's own files of the current project (`.claude/subagent/profile.md`, `.mcp.json`, the manifest). It never changes global settings or other plugins. The setup skill installs, updates, and removes; this skill adjusts what is installed.

## Steps

1. Run `<installer> config --target .` and show the result in the user's language:
   - **Bundled servers**: Context7 (versioned library docs) and Jina (web page and PDF reader) ship with the plugin and are not listed or chosen here; the user can turn them off in `/mcp`.
   - **MCP servers**: a table with each server's name, what it is for, who uses it, whether it is selected (`selected`) and registered in `.mcp.json` (`registered`), and its note. Mark a server with `differs: true` as "a different setting of yours exists, left unchanged". Figma has three connection types (`figma` remote server, `figma-desktop` desktop app server, `figma-plugin` official plugin); say that only one can be selected, and that `figma-plugin` is not installed by this tool (it has an `install_command` the user runs).
2. If the argument or the request names what to change, go straight to it. Otherwise ask with AskUserQuestion what to change: adding or removing an MCP server, switching the Figma connection, or nothing.
3. Before applying, run the same command with `--add-mcp <name[,name]>` and/or `--remove-mcp <name[,name]>` (design and document tools only) **without** `--yes`. To switch the Figma connection, pass the old one in `--remove-mcp` and the new one in `--add-mcp` in the same call. It prints a preview. Show the preview, any `warnings`, and any `conflicts`, and ask for one confirmation. If `conflicts` is not empty, nothing is applied even with `--yes`; report the conflicts and stop.
4. After confirmation run it again with `--yes`. Report what changed and the backup folder.
5. After adding an MCP server, say that a new Claude Code session is needed to load it, that Claude asks once to approve project MCP servers, and show every item of `next` (the sign-in or setup steps, for example the Figma `/mcp` Authenticate step, the Figma desktop app setting, or the plugin install command the user runs) and the server's note (for example the browser-content warning). Say that a successful registration does not mean the connection works: it is unchecked until the user signs in and sees the server connected in `/mcp` (or `/plugin`). After removing a server, say that a registered entry the workflow did not create, or one changed after install, is left in `.mcp.json`.
6. Run `<installer> verify --target .` and report only failures. If nothing is installed, point to `/subagent-workflow:setup`.

## Plain explanations to give when asked

| Term | One-line explanation |
| --- | --- |
| Guard protection | The guard hook blocks a rule violation (a write outside the plan, a wrong call). It is a safety net against mistakes, not a security boundary. |
| Guard hook | A small script Claude Code runs before every file write and agent call in this project. It checks the confirmed plan, assigned files, and who may call whom, and blocks the call when a rule is broken. |

## Rules

- Full mode, relay, and strict protection were removed in v0.7.0. If the user asks for them, say so in one line; the workflow always uses its default path.

- Never apply a change without the user's confirmation in this conversation. A preview is not approval.
- Add only the servers named in `config`'s list. Never invent other servers or commands. `anymd` (a document reader) is listed with `kind: document`; present it as optional and mention that it runs an external package through npx. Never run a plugin install command yourself; show it to the user.
- Never edit `.mcp.json` or the profile by hand; use the installer so the manifest hashes stay consistent.
- Report what could not be done (conflicts, unparseable `.mcp.json`) as it is. Do not work around it.
