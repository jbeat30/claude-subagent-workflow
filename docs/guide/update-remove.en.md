# Getting a new version, update and removal

[Back to README](../../README.en.md)

## Getting a new version

The roles, the PM instructions, and the guard live in the plugin, so updating the plugin updates every project. Auto-update is off by default for a self-hosted marketplace.

```text
claude plugin marketplace update jbeat-plugins
claude plugin update subagent-workflow@jbeat-plugins
```

After updating, start a new session or run `/reload-plugins`.

- Update inside a session: `/plugin` → Marketplaces tab → `jbeat-plugins` → Update marketplace
- Turn on auto-update (optional): `/plugin` → Marketplaces tab → `jbeat-plugins` → Enable auto-update

## Moving from v0.5.x or earlier

Up to v0.5.x the roles, PM instructions, and guard were copied into the project's `.claude/`. From v0.6.0 the plugin provides them. After updating the plugin, run this once per project:

```text
/subagent-workflow:setup update
```

- It cleans up the files copied earlier (the 9 built-in roles in `.claude/agents/`, `.claude/skills/subagent/`, `.claude/hooks/subagent-guard.mjs`, `.claude/subagent/bin/`, and so on) and the old guard hook in `.claude/settings.json`. **Files you edited are not deleted**; they are listed for you.
- It shows the changes as a plan and applies them after you confirm.
- The task command changed from `/subagent` to `/subagent-workflow:run`.
- `/subagent-workflow:check` tells you whether cleanup is needed: a `workflow version` or `settings hooks` item with status `update` means old files remain.
- Task records from an older version may not be readable by the new version; finish them before updating.

## Removal

```text
/subagent-workflow:setup remove
```

- It shows a preview, asks for confirmation, and reverts only what setup created (the project profile, MCP entries, the `.gitignore` block). Files you edited stay.
- Task records (`.claude-subagent-docs`) and backups are not deleted.
- To turn the workflow off completely, also uninstall the plugin: `/plugin` → Installed tab
