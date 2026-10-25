# Changing settings

[Back to README](../../README.en.md)

## Changing settings

```text
/subagent-workflow:setting
```

A skill to view and change the workflow settings after install.

- **See the current settings**: the default mode (Lite/Full), the protection mode, and the MCP servers the workflow can use with whether each is selected (with its purpose and caution). This list differs from Claude Code's `/mcp`: `/mcp` shows every connected server, while this shows only the servers the workflow uses.
- **Change the default mode** between Lite and Full. To change it for one request only, say "handle this in Full mode".
- **Change the protection mode** between advisory and strict. Strict takes effect immediately and blocks ordinary edits by the main session until you register an approval, so you are told this first and asked to confirm once more. You can switch back to advisory at any time.
- **Add or remove an MCP server**: add one you did not select at install (Context7, anymd, Playwright, Chrome DevTools, shadcn/ui, Figma) and it is registered in `.mcp.json`; design tools can also be removed, and the Figma connection can be switched (Context7 cannot be removed). Entries the workflow did not create, or that you changed after install, are left alone. Start a new Claude Code session for it to take effect.
- It shows a preview first and applies only after you confirm, and backs up the files it changes.
- An MCP server that already has a different setting is not overwritten; it is reported as a conflict.
