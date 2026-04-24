/**
 * /effort-xhigh — Set session-default effort variant to "xhigh" (Opus 4.7 only).
 *
 * Sets `agents.build.variant: "xhigh"` in the OMO config
 * (~/.config/opencode/oh-my-openagent.jsonc or oh-my-opencode.jsonc).
 * The anthropic-effort hook translates this into `effort: xhigh` at request time.
 *
 * Affected models: Claude Opus 4.7 only. On non-Opus-4.7 models, shows a warning
 * and makes no changes.
 *
 * Undo: Remove the `variant` key from `agents.build` in your OMO config,
 * or set it to a different value (e.g., "high", "max").
 */
export const EFFORT_XHIGH_TEMPLATE = `Set the session-default effort variant to "xhigh" for the primary (build) agent.

## Pre-flight: Model Check

Before modifying any config, determine the current model. The xhigh effort level is ONLY supported on Claude Opus 4.7.

1. Check the current model by reading the OpenCode config to see what model is active:
   \`\`\`
   Bash({ command: "cat ~/.config/opencode/opencode.json 2>/dev/null || echo '{}'" })
   \`\`\`

2. Look for the model ID in the config output. If the model ID does NOT match the pattern \`claude.*opus.*4[-.]7\` (case-insensitive), then:
   - Output a **warning**: "⚠️ /effort-xhigh requires Claude Opus 4.7. Current model does not appear to be Opus 4.7. No changes made."
   - Suggest: "Switch to Claude Opus 4.7 first, then re-run /effort-xhigh."
   - **STOP** — do NOT modify any config.

   Note: If you cannot determine the model from config (e.g., it's set via UI or environment), warn the user but proceed with the config change since the anthropic-effort hook will clamp the variant at runtime anyway.

## Steps (only if model check passes)

1. Find the OMO config file. Check these paths in order:
   \`\`\`
   Bash({ command: "cat ~/.config/opencode/oh-my-openagent.jsonc 2>/dev/null || cat ~/.config/opencode/oh-my-opencode.jsonc 2>/dev/null || cat ~/.config/opencode/oh-my-openagent.json 2>/dev/null || cat ~/.config/opencode/oh-my-opencode.json 2>/dev/null || echo '{}'" })
   \`\`\`

2. Determine which config file exists (prefer oh-my-openagent.jsonc):
   \`\`\`
   Bash({ command: "for f in ~/.config/opencode/oh-my-openagent.jsonc ~/.config/opencode/oh-my-opencode.jsonc ~/.config/opencode/oh-my-openagent.json ~/.config/opencode/oh-my-opencode.json; do [ -f \\"$f\\" ] && echo \\"$f\\" && break; done || echo ~/.config/opencode/oh-my-openagent.jsonc" })
   \`\`\`

3. Parse the config (strip JSONC comments if needed), set \`agents.build.variant\` to \`"xhigh"\`, and write back atomically:
   \`\`\`
   Bash({ command: "node -e \\"const fs=require('fs');const p=process.argv[1];let raw='{}';try{raw=fs.readFileSync(p,'utf8')}catch{};const clean=raw.replace(/\\\\/\\\\/.*$/gm,'').replace(/\\\\/\\\\*[\\\\s\\\\S]*?\\\\*\\\\//g,'');let c;try{c=JSON.parse(clean)}catch{c={}};if(!c.agents)c.agents={};if(!c.agents.build)c.agents.build={};c.agents.build.variant='xhigh';fs.mkdirSync(require('path').dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(c,null,2)+'\\\\n')\\" CONFIG_PATH_HERE" })
   \`\`\`
   Replace CONFIG_PATH_HERE with the actual path found in step 2.

4. Confirm to the user:
   - "Effort variant set to **xhigh** for the build agent."
   - "Setting: \`agents.build.variant: \\"xhigh\\"\` in \`CONFIG_PATH\`"
   - "This takes effect on the next message (config hot-reload)."
   - "The anthropic-effort hook will apply \`effort: xhigh\` to Opus 4.7 requests."
   - "To undo: remove \`variant\` from \`agents.build\` in your OMO config, or set a different value."

## Important

- Do NOT restart OpenCode — config hot-reloads automatically.
- Do NOT apply xhigh to non-Opus-4.7 models — show warning and stop.
- Do NOT modify any other keys in the config file.
- The anthropic-effort hook will clamp xhigh to a lower level at runtime if the model changes away from Opus 4.7.`
