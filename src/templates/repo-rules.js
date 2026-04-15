export function sourceOfTruth({ projectName, repoStack, vaultName }) {
  return `# Source of Truth

You are an expert engineer working on ${projectName}. This is ${repoStack}.

The Obsidian vault at \`../${vaultName}/\` is the single source of truth for architecture, API contracts, and decisions. Always check there first before writing code.

- **Architecture:** \`../${vaultName}/ARCHITECTURE_OVERVIEW.md\`
- **API contracts:** \`../${vaultName}/API_CONTRACTS.md\` — the final authority on endpoint shapes
- **Decisions:** \`../${vaultName}/DECISIONS.md\` — rejected approaches and why
`;
}

export function decisionLogic({ vaultName }) {
  return `# Decision Logic

- Before writing any code, consult \`../${vaultName}/API_CONTRACTS.md\` to ensure compatibility.
- Before proposing an alternative approach, check \`../${vaultName}/DECISIONS.md\` — it logs rejected approaches and why they were ruled out.
- If a requirement is unclear, check the vault for more context before asking.
- **Live decision capture:** When an approach fails, is abandoned, or a non-obvious choice is made mid-session, immediately suggest logging it to \`../${vaultName}/DECISIONS.md\`. Before writing, run \`cd ../${vaultName} && git pull\`. Format: \`## YYYY-MM-DD — Title (by [engineer name])\` followed by two sentences. After writing, run \`cd ../${vaultName} && git add DECISIONS.md && git commit -m "decision: [title]" && git push\`.
`;
}

export function contractDrift({ vaultName }) {
  return `# Contract Drift Check

Before pushing code, diff your changes against \`../${vaultName}/API_CONTRACTS.md\`. If any route, request/response shape, field, status code, or auth pattern has changed and the contract doesn't reflect it, stop and say:

> *"I found a contract drift: [describe the specific difference]. What would you like to do?"*
> 1. **Update the contract** — I'll update \`API_CONTRACTS.md\` to match the code
> 2. **Revert the code** — the contract is correct, I'll roll back the change
> 3. **Check impact first** — I'll analyze what depends on this before deciding

Do not silently update the contract or push without surfacing the mismatch.
`;
}

export function operatorProfile() {
  return `# Operator Profile

Read \`../ai-profile/\` before starting work — it contains the user's working style, code preferences, and past corrections. If you notice a behavioral pattern or the user corrects you, ask to update the profile. Never repeat a correction logged in \`../ai-profile/CORRECTIONS.md\`.
`;
}
