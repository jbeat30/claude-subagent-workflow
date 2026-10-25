# Getting a new version, update and removal

[Back to README](../../README.en.md)

## Getting a new version

An installed plugin does not update by itself. Auto-update is off by default for a self-made marketplace, and updating the plugin does not change the workflow files already installed in a project, so two steps are needed.

1. Update the plugin (terminal)

```text
claude plugin marketplace update jbeat-plugins
claude plugin update subagent-workflow@jbeat-plugins
```

2. Start a new session or run `/reload-plugins`
3. Update the workflow files in the project: `/subagent-workflow:setup update`

- To see whether an update is needed, run `/subagent-workflow:check`; a `workflow version` item with status `update` means the project's workflow files are older than the plugin
- Inside a session: `/plugin` → Marketplaces tab → `jbeat-plugins` → Update marketplace (also updates the installed plugins)
- Optional auto-update: `/plugin` → Marketplaces tab → `jbeat-plugins` → Enable auto-update. It updates only the plugin; step 3 is still run by you

## Update and removal

```text
/subagent-workflow:setup update
/subagent-workflow:setup remove
```

- Update: **fully replaces** the installed workflow files with the new version. It shows the changes as a plan and applies them after confirmation. Files you edited after install are never overwritten automatically; you choose skip or replace with backup.
- Updating from v0.2.x or earlier releases the `agent=pm-agent` setting that version added, so the main session is no longer pinned to the PM, and deletes the unmodified legacy PM agent file (settings and files you changed are kept).
- Removal: shows a preview and, after confirmation, reverts only what was installed. Files you edited are kept, and task records (`.claude-subagent-docs`) and backups are not deleted.
- From v0.2.0 prompts and record labels are English, so runs left in progress by an older version are not read by the new one. Finish them before updating.
