export function sessionStart({ vaultName }) {
  return `# Session Start

## Read Your Operator

Before reading the vault, read these files to understand who you're working with:

1. \`~/.ai-profile/WORKING_STYLE.md\` — how this person works and communicates
2. \`~/.ai-profile/PREFERENCES.md\` — code taste, commit style, autonomy level
3. \`~/.ai-profile/CORRECTIONS.md\` — past behavioral corrections; never repeat these

## Then Read the Vault

Read these vault files before doing anything else:

1. \`./${vaultName}/MOC.md\` — map of content, entry point, session start sequence
2. \`./${vaultName}/DECISIONS.md\` — rejected approaches and why; check before proposing alternatives
3. \`./${vaultName}/SESSION_LOG.md\` — where the last session left off
4. \`./${vaultName}/ARCHITECTURE_OVERVIEW.md\` — system design and how repos connect (read on demand)

Do not suggest code changes until you have read all of the above.

## Code Intelligence (GitNexus)

If any repo in this workspace has a \`.gitnexus/\` directory, the GitNexus MCP server is available for that repo. Use it — it prevents breaking changes.

### Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run \`gitnexus_impact({target: "symbolName", direction: "upstream"})\` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST run \`gitnexus_detect_changes({scope: "staged"})\` before committing** to verify your changes only affect expected symbols and execution flows.
- For full context on a symbol — callers, callees, execution flows — use \`gitnexus_context({name: "symbolName"})\`.
- To find code by concept instead of grepping: \`gitnexus_query({query: "concept"})\`.

### Never Do

- NEVER edit a function, class, or method without first running \`gitnexus_impact\` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use \`gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})\` which understands the call graph.
- NEVER commit without running \`gitnexus_detect_changes()\` to confirm scope.

### Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |
`;
}

export function vaultRules({ vaultName }) {
  return `# Vault Update Rules

After completing work, check whether the vault needs updating before ending the session.

## Always update \`API_CONTRACTS.md\` when:
- An endpoint's request or response shape changed
- A new endpoint was added or removed

## Always update \`ARCHITECTURE_OVERVIEW.md\` when:
- A key data structure was added or changed
- A new repo or service was added
- A known gap was resolved or a new one discovered

## Always add to \`DECISIONS.md\` when:
- An approach was tried and rejected (two sentences: what and why)
- A non-obvious architectural choice was made
- A library or pattern was considered and ruled out

## Live decision capture (do this DURING the session, not just at the end):
When any of these happen mid-session, immediately say: *"That's worth logging in DECISIONS.md — [one-line summary]. Want me to add it now?"*

- An approach was attempted and failed or was abandoned
- The user says "that didn't work", "let's try something else", "scrap that", "go back"
- A workaround was chosen over a cleaner solution (and why)
- A bug was caused by a non-obvious interaction
- A library or tool was evaluated and rejected
- You discover the current approach contradicts something already in DECISIONS.md

Do NOT wait until the end of the session. Log it as it happens.

## How to write a DECISIONS.md entry:

**Before writing:** Run \`cd ${vaultName} && git pull\` to get the latest version.

**Format:**
\`\`\`markdown
## YYYY-MM-DD — Short title (by [engineer name])

What was considered and why it was rejected/chosen. Two sentences max.
\`\`\`

**After writing:** Run \`cd ${vaultName} && git add DECISIONS.md && git commit -m "decision: [short title]" && git push\`

## Suggest running \`devnexus graphify\` when:
- \`ARCHITECTURE_OVERVIEW.md\` describes things that don't match the actual code
- \`GRAPH_REPORT.md\` seems outdated after many files have changed
- The user asks about blast radius, god nodes, or structural dependencies and the report is stale
- After a major refactor that reorganized significant parts of the codebase

## Natural triggers — check the vault after:
- A feature is complete and ready to commit
- The user says anything like "done", "ship it", "commit", "that's it for now"
- A bug fix revealed something undocumented about how the system works

## How to update
When a trigger fires, proactively say: *"Before we wrap up — [specific file] needs updating because [reason]. Want me to do that now?"*

Do not silently skip it. Do not update the vault without confirming with the user first.
`;
}

export function contractDrift({ vaultName }) {
  return `# Contract Drift Check — Before Every Push

Before pushing code, compare your changes against \`./${vaultName}/API_CONTRACTS.md\`:

1. Review the diff: which routes, request/response shapes, fields, status codes, or auth patterns changed?
2. Read \`API_CONTRACTS.md\` and check whether it still matches the code you're about to push.

**If you find a mismatch**, stop and say:

> *"I found a contract drift: [describe the specific difference]. What would you like to do?"*
> 1. **Update the contract** — I'll update \`API_CONTRACTS.md\` to match the code changes
> 2. **Revert the code** — the contract is correct, I'll roll back the change
> 3. **Check impact first** — I'll analyze what depends on this endpoint before deciding

Do NOT silently update the contract. Do NOT silently push. Surface it, present the three options, and wait for a decision.

**What counts as drift:**
- A new endpoint exists in code but not in \`API_CONTRACTS.md\`
- A documented endpoint was removed or renamed
- Request or response fields were added, removed, or changed type
- Status codes or error responses changed
- Auth requirements for an endpoint changed
`;
}

export function profileRules() {
  return `# Profile & Session Update Rules

## Update \`~/.ai-profile/CORRECTIONS.md\` when:
- The user corrects your behavior (e.g., "stop doing X", "don't do that", "I told you already")
- Format: \`## YYYY-MM-DD — Short description\` followed by one sentence
- Then update the relevant profile file (\`WORKING_STYLE.md\` or \`PREFERENCES.md\`) to reflect the correction

## Update \`~/.ai-profile/WORKING_STYLE.md\` or \`PREFERENCES.md\` when:
- You notice a consistent pattern (e.g., user always discusses before coding)
- The user states a preference explicitly (e.g., "I like conventional commits")
- A correction changes a previously recorded preference
- Always ask first: *"I noticed [pattern]. Want me to add that to your profile?"*

## Update \`SESSION_LOG.md\` at session end:
- When the user says "done", "that's it", "ship it", or ends the session
- Say: *"Want me to log a session handoff note so the next session knows where we left off?"*
- Format: \`## YYYY-MM-DD — Summary (by [name])\` followed by two lines max
`;
}
