# Changing settings

[Back to README](../../README.en.md)

## Changing settings

```text
/subagent-workflow:setting
```

A skill to view and change the workflow settings after install.

- **See the current settings**: the optional MCP servers the workflow can use with whether each is selected (with its purpose and caution). This list differs from Claude Code's `/mcp`: `/mcp` shows every connected server, while this shows only the servers the workflow uses.
- The default mode (Lite, Full) and protection mode (advisory, strict) choices were removed in v0.7.0. The workflow has one path and the guard is always on.
- **Add or remove an MCP server**: add one you did not select at install (anymd, Playwright, Chrome DevTools, shadcn/ui, Figma) and it is registered in `.mcp.json`; design tools can also be removed, and the Figma connection can be switched (Context7 and Jina ship with the plugin and are not chosen here; turn them off in `/mcp`). Entries the workflow did not create, or that you changed after install, are left alone. Start a new Claude Code session for it to take effect.
- It shows a preview first and applies only after you confirm, and backs up the files it changes.
- An MCP server that already has a different setting is not overwritten; it is reported as a conflict.
