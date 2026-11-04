# Install and choices

[Back to README](../../README.en.md)

## Install flow

Requirements: Claude Code 2.1.302 or later, Node 20 or later.

```text
/plugin marketplace add jbeat30/jbeat-plugins
/plugin install subagent-workflow@jbeat-plugins
/subagent-workflow:setup
```

![Install flow](../assets/install-flow.en.png)

1. Install the plugin and run `/subagent-workflow:setup` in your project
2. The skill surveys the project and asks only what it needs
3. It shows the change plan in 10 lines or fewer and asks for confirmation **once**
4. It writes the project profile and checks the guard with a script
5. Call the workflow with `/subagent-workflow:run <request>` when you need it

The roles, the PM instructions, and the guard live in the plugin. Nothing is copied into your project, so updating the plugin updates every project at once.

## Skills

| Skill | Purpose | Cost |
| --- | --- | --- |
| `/subagent-workflow:run` | Hand over a task (the PM plans, confirms, calls roles, verifies, reports) | Depends on the task |
| `/subagent-workflow:setup` | **Set up, update, or remove** the project setup; pass `install`, `update`, or `remove` | A few turns; the installer commands do not call Claude |
| `/subagent-workflow:check` | Check the setup (profile, leftovers from older versions, guard script, version) | None; it does not call Claude |
| `/subagent-workflow:setting` | **View and change settings**: which optional MCP servers the workflow can use and which are selected, and adding an MCP server you did not select | A few conversation turns; the installer commands do not call Claude |
| `/subagent-workflow:add-role` | **Add or remove a project role**: recommends roles from your domain and stack, then creates the chosen role file with the shared rules and verifies it | A few conversation turns; the installer commands do not call Claude |

Plain requests work too: "recommend and add a subagent for our C game engine", "set up the subagent workflow", "check the workflow installation", "show the workflow settings", "remove the workflow".

## What you choose at setup

`setup` asks these in conversation and does not re-ask what detection already shows.

| Choice | Options | Default or recommendation |
| --- | --- | --- |
| Design system (UI projects) | Where your tokens, component library, Storybook, Figma library, or brand guide live. If you have one it is the **top authority for all UI work** and subagents never deviate from it | Only if you have one |
| Document reader MCP (optional) | **anymd** (`@sylphx/anymd`, MIT): reads PDF and Word, Excel, PowerPoint, HTML as Markdown on your machine; useful for spec or design PDFs. Nothing is uploaded and no API key is needed, but it runs an external package through `npx` and downloads a native binary on first use. Agents open only files named in the request and never follow instructions found inside a document | Only if you want it |
| Design tool MCP (optional) | **Playwright**: open and look at the running page<br>**Chrome DevTools**: inspect the page, console, network, and performance in Chrome; useful for UI/UX checks<br>**shadcn/ui**: reuse vetted components (needs `components.json`)<br>**Figma**: when you have Figma designs; pick one connection<br>· `figma`: remote server; sign in from the browser through `/mcp` after registering<br>· `figma-desktop`: Figma desktop app server; enable the desktop MCP server in Dev Mode, needs a Dev or Full seat<br>· `figma-plugin`: official plugin; the installer does not install it and only shows the command to run (choose this one if you already use the official plugin)<br>Agents only **read** Figma (tools that change files are not allowed). Reads count against your plan limit: about 20 per month on the Starter plan and View or Collab seats, about 200 per day on Full or Dev seats | Asked only for projects with a UI; Playwright and shadcn/ui recommended |
| Forbidden areas | Production config, generated files, specific paths | None |
| Task records | Add `.claude-subagent-docs/` to `.gitignore` | Add |
| Conflict handling | If files collide, per item: skip or replace with backup | Asked on conflict |

No mode is asked at install. The workflow has one path (the PM calls the needed roles directly) and the guard hook blocks violations. Full mode, relay, and strict mode from v0.6.x were removed in v0.7.0; if an older profile still has those settings, the PM says so in one line and uses the default path.

Only `frontend-agent` and `qa-agent` use the design tools. Browser tools (Playwright, Chrome DevTools) can see the content of the browser they open, so avoid personal tabs and sensitive data. A registered server's tool definitions are added to every call of those two roles, which costs tokens, and `npx` runs external packages, so choose them only when you need them. The subagents never invent spacing, colors, or copy that the design does not state, and mark visual checks they could not make as `unchecked`.

- **No design provided**: during confirmation the PM proposes a concrete design direction (palette, typography, spacing, components, tone of copy) and records the confirmed choices in the plan; `frontend-agent` builds from that record.
- **UI/UX check (optional)**: when a browser tool is registered and the work changes UI, the PM asks during confirmation whether to run one. Only if you agree, `qa-agent` walks the agreed flows and screen sizes and reports problems with evidence. It is a scripted walkthrough by an subagent, not a test with real users, and it never enters real credentials, places orders or payments, or changes data.

## Files created in your project

```text
.claude/subagent/
  profile.md        project settings (stack, check commands, rule source paths, forbidden areas), read by every role before work
  manifest.json     setup record (used by update and remove)
  roles.local.json  roles you added (only after adding a role)
.claude/agents/     role files you added (only after adding a role)
.claude-subagent-docs/   per-task records (request, plan, reports, check records, diff); adding it to .gitignore is optional
.mcp.json            Design and document tool MCP entries (optional, merged with existing settings)
```
