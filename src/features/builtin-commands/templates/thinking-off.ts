/**
 * /thinking-off — Disable extended thinking for all Claude models.
 *
 * Sets `alwaysThinkingEnabled: false` in ~/.config/opencode/opencode.json.
 * OpenCode translates this into `thinking: { type: "disabled" }` at request time.
 *
 * Affected models: All Claude models served via anthropic, google-vertex-anthropic,
 * and github-copilot providers.
 *
 * Undo: Run `/thinking-on` to revert (deletes the key, restoring default: enabled).
 */
export const THINKING_OFF_TEMPLATE = `Disable extended thinking by setting alwaysThinkingEnabled to false in the user's OpenCode config.

## Steps

1. Read the current config:
   \`\`\`
   Bash({ command: "cat ~/.config/opencode/opencode.json 2>/dev/null || echo '{}'" })
   \`\`\`

2. Parse the JSON, set \`alwaysThinkingEnabled\` to \`false\`, and write it back atomically:
   \`\`\`
   Bash({ command: "node -e \\"const fs=require('fs');const p=require('path').join(require('os').homedir(),'.config/opencode/opencode.json');let c={};try{c=JSON.parse(fs.readFileSync(p,'utf8'))}catch{};c.alwaysThinkingEnabled=false;fs.mkdirSync(require('path').dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(c,null,2)+'\\\\n')\\"" })
   \`\`\`

3. Confirm to the user:
   - "Extended thinking has been **disabled**."
   - "Setting: \`alwaysThinkingEnabled: false\` in \`~/.config/opencode/opencode.json\`"
   - "This takes effect on the next message (config hot-reload)."
   - "To re-enable: run \`/thinking-on\`"

## Important

- Do NOT restart OpenCode — config hot-reloads automatically.
- Do NOT modify any other keys in the config file.
- If the config file or directory doesn't exist, create them.`
