#!/bin/bash
# ============================================================================
# AI-Augmented Workspace Update
# ============================================================================
# Regenerates .ai-rules/ directories with the latest agent instruction
# templates. Does NOT touch user-owned files (CLAUDE.md, .cursorrules,
# AGENTS.md, .windsurfrules) or vault content.
#
# Usage: bash update-workspace.sh
#
# Requires: .workspace-config (created by setup-workspace.sh)
# ============================================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

TEMPLATE_VERSION="1.0"

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}   AI Workspace Update${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

WORKSPACE_DIR=$(pwd)

# ============================================================================
# Load workspace config
# ============================================================================

if [ ! -f ".workspace-config" ]; then
  echo -e "${RED}Error: .workspace-config not found.${NC}"
  echo "Run setup-workspace.sh first, or make sure you're in the workspace root."
  exit 1
fi

source .workspace-config

echo -e "${GREEN}  Project: ${PROJECT_NAME}${NC}"
echo -e "${GREEN}  Vault: ${VAULT_NAME}${NC}"
echo -e "${GREEN}  Repos: ${REPO_DIRS[*]}${NC}"
echo -e "${GREEN}  Agents: ${AGENTS[*]}${NC}"
echo ""

# Check current version
CURRENT_VERSION=""
if [ -f ".ai-rules/version.txt" ]; then
  CURRENT_VERSION=$(cat .ai-rules/version.txt)
fi

if [ "$CURRENT_VERSION" = "$TEMPLATE_VERSION" ]; then
  echo -e "${YELLOW}  Agent rules are already at version ${TEMPLATE_VERSION}.${NC}"
  read -p "  Regenerate anyway? (y/N): " FORCE_UPDATE
  if [[ ! "$FORCE_UPDATE" =~ ^[Yy]$ ]]; then
    echo "  Skipping update."
    exit 0
  fi
fi

echo -e "${BLUE}Updating workspace .ai-rules/...${NC}"

# ============================================================================
# Regenerate workspace .ai-rules/
# ============================================================================

rm -rf .ai-rules
mkdir -p .ai-rules

cat > .ai-rules/01-session-start.md << RULESEOF
# Session Start

## Read Your Operator

Before reading the vault, read these files to understand who you're working with:

1. \`~/.ai-profile/WORKING_STYLE.md\` — how this person works and communicates
2. \`~/.ai-profile/PREFERENCES.md\` — code taste, commit style, autonomy level
3. \`~/.ai-profile/CORRECTIONS.md\` — past behavioral corrections; never repeat these

## Then Read the Vault

Read these vault files before doing anything else:

1. \`./${VAULT_NAME}/ARCHITECTURE.md\` — system design and how repos connect
2. \`./${VAULT_NAME}/API_CONTRACTS.md\` — endpoint shapes (the final authority)
3. \`./${VAULT_NAME}/DECISIONS.md\` — rejected approaches and why; check before proposing alternatives
4. \`./${VAULT_NAME}/SESSION_LOG.md\` — where the last session left off

Do not suggest code changes until you have read all of the above.
RULESEOF

cat > .ai-rules/02-vault-rules.md << RULESEOF
# Vault Update Rules

After completing work, check whether the vault needs updating before ending the session.

## Always update \`API_CONTRACTS.md\` when:
- An endpoint's request or response shape changed
- A new endpoint was added or removed

## Always update \`ARCHITECTURE.md\` when:
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

**Before writing:** Run \`cd ${VAULT_NAME} && git pull\` to get the latest version.

**Format:**
\`\`\`markdown
## YYYY-MM-DD — Short title (by [engineer name])

What was considered and why it was rejected/chosen. Two sentences max.
\`\`\`

**After writing:** Run \`cd ${VAULT_NAME} && git add DECISIONS.md && git commit -m "decision: [short title]" && git push\`

## Natural triggers — check the vault after:
- A feature is complete and ready to commit
- The user says anything like "done", "ship it", "commit", "that's it for now"
- A bug fix revealed something undocumented about how the system works

## How to update
When a trigger fires, proactively say: *"Before we wrap up — [specific file] needs updating because [reason]. Want me to do that now?"*

Do not silently skip it. Do not update the vault without confirming with the user first.
RULESEOF

cat > .ai-rules/03-contract-drift.md << RULESEOF
# Contract Drift Check — Before Every Push

Before pushing code, compare your changes against \`./${VAULT_NAME}/API_CONTRACTS.md\`:

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
RULESEOF

cat > .ai-rules/04-profile-rules.md << RULESEOF
# Profile & Session Update Rules

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
RULESEOF

echo "$TEMPLATE_VERSION" > .ai-rules/version.txt

echo -e "${GREEN}  Updated workspace .ai-rules/ → v${TEMPLATE_VERSION}${NC}"

# ============================================================================
# Regenerate repo .ai-rules/
# ============================================================================

for repo_dir in "${REPO_DIRS[@]}"; do
  if [ ! -d "$repo_dir" ]; then
    echo -e "${YELLOW}  Skipping $repo_dir (not found)${NC}"
    continue
  fi

  echo -e "${BLUE}Updating ${repo_dir}/.ai-rules/...${NC}"

  # Detect tech stack
  REPO_STACK="a software project"
  if [ -f "$repo_dir/package.json" ]; then
    if grep -q "next" "$repo_dir/package.json" 2>/dev/null; then
      REPO_STACK="a Next.js project (TypeScript, React)"
    elif grep -q "react" "$repo_dir/package.json" 2>/dev/null; then
      REPO_STACK="a React project (TypeScript)"
    elif grep -q "vue" "$repo_dir/package.json" 2>/dev/null; then
      REPO_STACK="a Vue.js project"
    elif grep -q "svelte" "$repo_dir/package.json" 2>/dev/null; then
      REPO_STACK="a SvelteKit project"
    else
      REPO_STACK="a Node.js project"
    fi
  elif [ -f "$repo_dir/requirements.txt" ] || [ -f "$repo_dir/pyproject.toml" ]; then
    if grep -q "fastapi\|FastAPI" "$repo_dir/requirements.txt" 2>/dev/null; then
      REPO_STACK="a FastAPI backend (Python)"
    elif grep -q "django\|Django" "$repo_dir/requirements.txt" 2>/dev/null; then
      REPO_STACK="a Django project (Python)"
    elif grep -q "flask\|Flask" "$repo_dir/requirements.txt" 2>/dev/null; then
      REPO_STACK="a Flask project (Python)"
    else
      REPO_STACK="a Python project"
    fi
  elif [ -f "$repo_dir/go.mod" ]; then
    REPO_STACK="a Go project"
  elif [ -f "$repo_dir/Cargo.toml" ]; then
    REPO_STACK="a Rust project"
  fi

  rm -rf "$repo_dir/.ai-rules"
  mkdir -p "$repo_dir/.ai-rules"

  cat > "$repo_dir/.ai-rules/01-source-of-truth.md" << REPORULESEOF
# Source of Truth

You are an expert engineer working on ${PROJECT_NAME}. This is ${REPO_STACK}.

The Obsidian vault at \`../${VAULT_NAME}/\` is the single source of truth for architecture, API contracts, and decisions. Always check there first before writing code.

- **Architecture:** \`../${VAULT_NAME}/ARCHITECTURE.md\`
- **API contracts:** \`../${VAULT_NAME}/API_CONTRACTS.md\` — the final authority on endpoint shapes
- **Decisions:** \`../${VAULT_NAME}/DECISIONS.md\` — rejected approaches and why
REPORULESEOF

  cat > "$repo_dir/.ai-rules/02-decision-logic.md" << REPORULESEOF
# Decision Logic

- Before writing any code, consult \`../${VAULT_NAME}/API_CONTRACTS.md\` to ensure compatibility.
- Before proposing an alternative approach, check \`../${VAULT_NAME}/DECISIONS.md\` — it logs rejected approaches and why they were ruled out.
- If a requirement is unclear, check the vault for more context before asking.
- **Live decision capture:** When an approach fails, is abandoned, or a non-obvious choice is made mid-session, immediately suggest logging it to \`../${VAULT_NAME}/DECISIONS.md\`. Before writing, run \`cd ../${VAULT_NAME} && git pull\`. Format: \`## YYYY-MM-DD — Title (by [engineer name])\` followed by two sentences. After writing, run \`cd ../${VAULT_NAME} && git add DECISIONS.md && git commit -m "decision: [title]" && git push\`.
REPORULESEOF

  cat > "$repo_dir/.ai-rules/03-contract-drift.md" << REPORULESEOF
# Contract Drift Check

Before pushing code, diff your changes against \`../${VAULT_NAME}/API_CONTRACTS.md\`. If any route, request/response shape, field, status code, or auth pattern has changed and the contract doesn't reflect it, stop and say:

> *"I found a contract drift: [describe the specific difference]. What would you like to do?"*
> 1. **Update the contract** — I'll update \`API_CONTRACTS.md\` to match the code
> 2. **Revert the code** — the contract is correct, I'll roll back the change
> 3. **Check impact first** — I'll analyze what depends on this before deciding

Do not silently update the contract or push without surfacing the mismatch.
REPORULESEOF

  cat > "$repo_dir/.ai-rules/04-operator-profile.md" << REPORULESEOF
# Operator Profile

Read \`../ai-profile/\` before starting work — it contains the user's working style, code preferences, and past corrections. If you notice a behavioral pattern or the user corrects you, ask to update the profile. Never repeat a correction logged in \`../ai-profile/CORRECTIONS.md\`.
REPORULESEOF

  echo "$TEMPLATE_VERSION" > "$repo_dir/.ai-rules/version.txt"

  echo -e "${GREEN}  Updated ${repo_dir}/.ai-rules/ → v${TEMPLATE_VERSION}${NC}"
done

# Update version in config
sed -i '' "s/TEMPLATE_VERSION=.*/TEMPLATE_VERSION=\"${TEMPLATE_VERSION}\"/" .workspace-config 2>/dev/null || true

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}   Update Complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo "Updated:"
echo "  ✓ .ai-rules/ (workspace)"
for repo_dir in "${REPO_DIRS[@]}"; do
  if [ -d "$repo_dir" ]; then
    echo "  ✓ ${repo_dir}/.ai-rules/"
  fi
done
echo ""
echo "Not touched:"
echo "  • Your pointer files (CLAUDE.md, .cursorrules, etc.)"
echo "  • Your vault content (ARCHITECTURE.md, DECISIONS.md, etc.)"
echo "  • Your AI profile (~/.ai-profile/)"
echo ""
