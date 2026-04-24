/**
 * /thinking-on — Re-enable extended thinking (revert /thinking-off).
 *
 * Deletes `alwaysThinkingEnabled` from ~/.config/opencode/opencode.json,
 * reverting to the default behavior (thinking enabled).
 * Does NOT set it to `true` — omission is the canonical default.
 *
 * Affected models: All Claude models served via anthropic, google-vertex-anthropic,
 * and github-copilot providers.
 *
 * Undo: Run `/thinking-off` to disable again.
 */
export const THINKING_ON_TEMPLATE = `Re-enable extended thinking by removing the alwaysThinkingEnabled key from the user's OpenCode config.

## Steps

1. Read the current config:
   \`\`\`
   Bash({ command: "cat ~/.config/opencode/opencode.json 2>/dev/null || echo '{}'" })
   \`\`\`

2. Parse the JSON, **delete** the \`alwaysThinkingEnabled\` key (do NOT set it to true), and write back:
   \`\`\`
   Bash({ command: "node -e \\"const fs=require('fs');const p=require('path').join(require('os').homedir(),'.config/opencode/opencode.json');let c={};try{c=JSON.parse(fs.readFileSync(p,'utf8'))}catch{};delete c.alwaysThinkingEnabled;fs.writeFileSync(p,JSON.stringify(c,null,2)+'\\\\n')\\"" })
   \`\`\`

3. Confirm to the user:
   - "Extended thinking has been **re-enabled** (default)."
   - "Removed \`alwaysThinkingEnabled\` from \`~/.config/opencode/opencode.json\`"
   - "This takes effect on the next message (config hot-reload)."
   - "To disable again: run \`/thinking-off\`"

## Important

- Do NOT restart OpenCode — config hot-reloads automatically.
- Do NOT set \`alwaysThinkingEnabled: true\` — the default is omission of the key.
- Do NOT modify any other keys in the config file.
- If the config file doesn't exist, inform the user that thinking is already enabled by default.`
