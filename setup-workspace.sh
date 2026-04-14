#!/bin/bash
# ============================================================================
# AI-Augmented Workspace Setup
# ============================================================================
# Sets up a multi-repo workspace with an Obsidian vault as the shared brain
# for AI coding agents (Claude Code + Cursor).
#
# What this creates:
#   your-workspace/
#   ├── CLAUDE.md           ← Claude Code reads this on every session start
#   ├── your-vault/         ← Obsidian vault (shared source of truth)
#   │   ├── ARCHITECTURE.md ← How the system works
#   │   ├── API_CONTRACTS.md← Endpoint shapes (if applicable)
#   │   ├── DECISIONS.md    ← What was tried and why it failed/worked
#   │   └── .obsidian/      ← Obsidian config (auto-created)
#   ├── repo-1/             ← Your first repo (cloned or existing)
#   │   ├── .cursorrules    ← Cursor reads this, points to vault
#   │   └── CLAUDE.md       ← Claude Code reads this when inside the repo
#   └── repo-2/             ← Your second repo (optional)
#       ├── .cursorrules
#       └── CLAUDE.md
#
# Usage:
#   1. Create an empty folder for your workspace
#   2. Put this script in that folder
#   3. Run: bash setup-workspace.sh
#   4. Follow the prompts
#
# Requirements: git, node (optional, for GitNexus)
# ============================================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}   AI-Augmented Workspace Setup${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

WORKSPACE_DIR=$(pwd)

# ============================================================================
# Step 1: Get project info
# ============================================================================

echo -e "${BLUE}Step 1: Project Info${NC}"
echo ""

read -p "What's your project called? (e.g., my-app, acme-platform): " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-my-project}

VAULT_NAME="${PROJECT_NAME}-vault"

echo ""
echo -e "${BLUE}Step 2: Add your repos${NC}"
echo ""
echo "You can add repos by git URL (will clone them) or by name if they"
echo "already exist as folders in this directory."
echo ""
echo "Enter repo URLs or folder names, one per line."
echo "Press Enter on an empty line when done."
echo ""

REPOS=()
while true; do
  read -p "Repo (or empty to finish): " repo_input
  [[ -z "$repo_input" ]] && break
  REPOS+=("$repo_input")
done

if [ ${#REPOS[@]} -eq 0 ]; then
  echo ""
  echo -e "${YELLOW}No repos added. You can add them later by cloning into this folder${NC}"
  echo -e "${YELLOW}and re-running the script.${NC}"
  echo ""
fi

# ============================================================================
# Step 2: Describe your project (for CLAUDE.md context)
# ============================================================================

echo ""
echo -e "${BLUE}Step 3: Describe your project${NC}"
echo ""
echo "Write a 1-2 sentence description of what you're building."
echo "This helps the AI understand your project on every session start."
echo ""
read -p "Description: " PROJECT_DESC
PROJECT_DESC=${PROJECT_DESC:-A software project.}

echo ""
echo "What's your tech stack? (e.g., 'Next.js + FastAPI + Postgres')"
read -p "Stack: " TECH_STACK
TECH_STACK=${TECH_STACK:-Not specified}

echo ""
echo "What's your name? (for decision log attribution)"
read -p "Name: " ENGINEER_NAME
ENGINEER_NAME=${ENGINEER_NAME:-Engineer}

# ============================================================================
# Step 3: Clone repos
# ============================================================================

echo ""
echo -e "${BLUE}Step 4: Setting up repos...${NC}"
echo ""

REPO_DIRS=()
for repo in "${REPOS[@]}"; do
  if [[ "$repo" == http* ]] || [[ "$repo" == git@* ]]; then
    # It's a URL — clone it
    repo_dir=$(basename "$repo" .git)
    if [ -d "$repo_dir" ]; then
      echo -e "${YELLOW}  $repo_dir already exists, skipping clone${NC}"
    else
      echo "  Cloning $repo..."
      git clone "$repo" 2>&1 | tail -1
    fi
    REPO_DIRS+=("$repo_dir")
  else
    # It's a folder name
    if [ -d "$repo" ]; then
      echo -e "${GREEN}  Found existing folder: $repo${NC}"
      REPO_DIRS+=("$repo")
    else
      echo -e "${RED}  Folder '$repo' not found — skipping${NC}"
    fi
  fi
done

# ============================================================================
# Step 4: Create the Obsidian vault
# ============================================================================

echo ""
echo -e "${BLUE}Step 5: Creating Obsidian vault (${VAULT_NAME})...${NC}"
echo ""

mkdir -p "$VAULT_NAME"
mkdir -p "$VAULT_NAME/.obsidian"
mkdir -p "$VAULT_NAME/archive"

# Obsidian core config
cat > "$VAULT_NAME/.obsidian/app.json" << 'EOF'
{
  "alwaysUpdateLinks": true,
  "newFileLocation": "current",
  "attachmentFolderPath": "./"
}
EOF

cat > "$VAULT_NAME/.obsidian/core-plugins.json" << 'EOF'
["file-explorer","global-search","switcher","graph","backlink","outgoing-link","tag-pane","page-preview","daily-notes","templates","note-composer","command-palette","editor-status","bookmarks","outline","word-count","file-recovery"]
EOF

cat > "$VAULT_NAME/.obsidian/community-plugins.json" << 'EOF'
["obsidian-git"]
EOF

# Obsidian Git plugin config
mkdir -p "$VAULT_NAME/.obsidian/plugins/obsidian-git"
cat > "$VAULT_NAME/.obsidian/plugins/obsidian-git/data.json" << 'EOF'
{
  "autoSaveInterval": 1,
  "autoPullInterval": 1,
  "autoPullOnBoot": true,
  "autoPushAfterCommit": true,
  "commitMessage": "vault: {{date}} by {{author}}",
  "autoCommitMessage": "vault: {{date}} by {{author}}",
  "commitDateFormat": "YYYY-MM-DD HH:mm",
  "listChangedFilesInMessageBody": true
}
EOF

cat > "$VAULT_NAME/.obsidian/appearance.json" << 'EOF'
{
  "accentColor": ""
}
EOF

# .gitignore for vault
cat > "$VAULT_NAME/.gitignore" << 'EOF'
.DS_Store
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/graph.json
.obsidian/cache/
.obsidian/plugins/**/data.json
EOF

# ARCHITECTURE.md
cat > "$VAULT_NAME/ARCHITECTURE.md" << EOF
# ${PROJECT_NAME} — Architecture Overview

> **Last updated:** $(date +%Y-%m-%d)

## What This Is

${PROJECT_DESC}

## Tech Stack

${TECH_STACK}

## How the Repos Connect

<!-- Describe how your repos talk to each other. Examples: -->
<!-- - Frontend calls backend API at /api/* -->
<!-- - Backend reads/writes to the database -->
<!-- - Shared types between repos -->

(Fill this in as you build.)

## Key Data Structures

<!-- List the most important models/schemas/types in your project. -->
<!-- These are the ones where a change ripples through multiple files. -->

(Fill this in as you build.)

## Known Gaps

<!-- Things that are stored but not used, missing features, tech debt. -->

(Fill this in as you discover them.)
EOF

# API_CONTRACTS.md
cat > "$VAULT_NAME/API_CONTRACTS.md" << EOF
# API Contracts

> **Last updated:** $(date +%Y-%m-%d)
> If code and docs disagree, update the code. This file is the final authority.

## Endpoints

<!-- Document your API endpoints here. Example: -->
<!--
### POST /api/users
Creates a new user.
Request: { "email": "string", "name": "string" }
Response: { "id": "string", "email": "string", "name": "string" }
Errors: 400 (validation), 409 (duplicate email)
-->

(Add endpoints as you build them.)
EOF

# DECISIONS.md
cat > "$VAULT_NAME/DECISIONS.md" << EOF
# Decisions Log

> Reverse-chronological log of non-obvious decisions, rejected approaches, and dead ends.
> When you reject an approach or make a choice that isn't self-evident from the code, add an entry.
> Format: ## YYYY-MM-DD — Title (by [name]) followed by two sentences.
> Agents read this before suggesting alternatives you've already ruled out.

---

## $(date +%Y-%m-%d) — Workspace setup (by ${ENGINEER_NAME})

Set up AI-augmented workspace with Obsidian vault as shared brain, CLAUDE.md for session context, and .cursorrules per repo. Vault is the single source of truth — agents read it before writing code.
EOF

echo -e "${GREEN}  Created ${VAULT_NAME}/ with ARCHITECTURE.md, API_CONTRACTS.md, DECISIONS.md${NC}"

# Init git in vault
cd "$VAULT_NAME"
if [ ! -d ".git" ]; then
  git init -q
  git add -A
  git commit -q -m "vault: initial setup"
  echo -e "${GREEN}  Initialized git in vault${NC}"
  echo -e "${YELLOW}  >> Add a remote: cd ${VAULT_NAME} && git remote add origin <your-vault-repo-url> && git push -u origin main${NC}"
else
  echo -e "${GREEN}  Vault already has git initialized${NC}"
fi
cd "$WORKSPACE_DIR"

# ============================================================================
# Step 5: Create workspace CLAUDE.md
# ============================================================================

echo ""
echo -e "${BLUE}Step 6: Creating workspace CLAUDE.md...${NC}"
echo ""

# Build repo directory table
REPO_TABLE=""
for repo_dir in "${REPO_DIRS[@]}"; do
  REPO_TABLE="${REPO_TABLE}| \`./${repo_dir}/\` | Repository |\n"
done

cat > CLAUDE.md << CLAUDEEOF
# ${PROJECT_NAME} Workspace

## On Session Start — Read These First

Before doing anything else, read these vault files in order:

1. \`./${VAULT_NAME}/ARCHITECTURE.md\` — system design and how repos connect
2. \`./${VAULT_NAME}/API_CONTRACTS.md\` — endpoint shapes (the final authority)
3. \`./${VAULT_NAME}/DECISIONS.md\` — rejected approaches and why; check before proposing alternatives

Do not suggest code changes until you have read all three.

---

## Vault Update Rules

After completing work, check whether the vault needs updating before ending the session.

### Always update \`API_CONTRACTS.md\` when:
- An endpoint's request or response shape changed
- A new endpoint was added or removed

### Always update \`ARCHITECTURE.md\` when:
- A key data structure was added or changed
- A new repo or service was added
- A known gap was resolved or a new one discovered

### Always add to \`DECISIONS.md\` when:
- An approach was tried and rejected (two sentences: what and why)
- A non-obvious architectural choice was made
- A library or pattern was considered and ruled out

### Live decision capture (do this DURING the session, not just at the end):
When any of these happen mid-session, immediately say: *"That's worth logging in DECISIONS.md — [one-line summary]. Want me to add it now?"*

- An approach was attempted and failed or was abandoned
- The user says "that didn't work", "let's try something else", "scrap that", "go back"
- A workaround was chosen over a cleaner solution (and why)
- A bug was caused by a non-obvious interaction
- A library or tool was evaluated and rejected
- You discover the current approach contradicts something already in DECISIONS.md

Do NOT wait until the end of the session. Log it as it happens.

### How to write a DECISIONS.md entry:

**Before writing:** Run \`cd ${VAULT_NAME} && git pull\` to get the latest version.

**Format:**
\`\`\`markdown
## YYYY-MM-DD — Short title (by [engineer name])

What was considered and why it was rejected/chosen. Two sentences max.
\`\`\`

**After writing:** Run \`cd ${VAULT_NAME} && git add DECISIONS.md && git commit -m "decision: [short title]" && git push\`

---

## Contract Drift Check — Before Every Push

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

---

### Natural triggers — check the vault after:
- A feature is complete and ready to commit
- The user says anything like "done", "ship it", "commit", "that's it for now"
- A bug fix revealed something undocumented about how the system works

### How to update
When a trigger fires, proactively say: *"Before we wrap up — [specific file] needs updating because [reason]. Want me to do that now?"*

Do not silently skip it. Do not update the vault without confirming with the user first.

---

## Directory Map

| Directory | What it is |
|-----------|------------|
| \`./${VAULT_NAME}/\` | Obsidian vault — source of truth for all agents |
$(echo -e "$REPO_TABLE")
CLAUDEEOF

echo -e "${GREEN}  Created CLAUDE.md at workspace root${NC}"

# ============================================================================
# Step 6: Add .cursorrules and CLAUDE.md to each repo
# ============================================================================

echo ""
echo -e "${BLUE}Step 7: Setting up agent files in repos...${NC}"
echo ""

for repo_dir in "${REPO_DIRS[@]}"; do
  if [ ! -d "$repo_dir" ]; then
    echo -e "${RED}  Skipping $repo_dir (not found)${NC}"
    continue
  fi

  echo -e "  ${BOLD}${repo_dir}/${NC}"

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

  # Create .cursorrules if missing
  if [ ! -f "$repo_dir/.cursorrules" ]; then
    cat > "$repo_dir/.cursorrules" << CURSOREOF
# ${repo_dir} — Cursor Rules

You are an expert engineer working on ${PROJECT_NAME}. This is ${REPO_STACK}.

## 1. Source of Truth

The Obsidian vault at \`../${VAULT_NAME}/\` is the single source of truth for architecture, API contracts, and decisions. Always check there first before writing code.

- **Architecture:** \`../${VAULT_NAME}/ARCHITECTURE.md\`
- **API contracts:** \`../${VAULT_NAME}/API_CONTRACTS.md\` — the final authority on endpoint shapes
- **Decisions:** \`../${VAULT_NAME}/DECISIONS.md\` — rejected approaches and why

## 2. Decision Logic

- Before writing any code, consult \`../${VAULT_NAME}/API_CONTRACTS.md\` to ensure compatibility.
- Before proposing an alternative approach, check \`../${VAULT_NAME}/DECISIONS.md\` — it logs rejected approaches and why they were ruled out.
- If a requirement is unclear, check the vault for more context before asking.
- **Live decision capture:** When an approach fails, is abandoned, or a non-obvious choice is made mid-session, immediately suggest logging it to \`../${VAULT_NAME}/DECISIONS.md\`. Before writing, run \`cd ../${VAULT_NAME} && git pull\`. Format: \`## YYYY-MM-DD — Title (by [engineer name])\` followed by two sentences. After writing, run \`cd ../${VAULT_NAME} && git add DECISIONS.md && git commit -m "decision: [title]" && git push\`.

## 3. Contract Drift Check

Before pushing code, diff your changes against \`../${VAULT_NAME}/API_CONTRACTS.md\`. If any route, request/response shape, field, status code, or auth pattern has changed and the contract doesn't reflect it, stop and say:

> *"I found a contract drift: [describe the specific difference]. What would you like to do?"*
> 1. **Update the contract** — I'll update \`API_CONTRACTS.md\` to match the code
> 2. **Revert the code** — the contract is correct, I'll roll back the change
> 3. **Check impact first** — I'll analyze what depends on this before deciding

Do not silently update the contract or push without surfacing the mismatch.
CURSOREOF
    echo -e "    ${GREEN}Created .cursorrules${NC}"
  else
    echo -e "    ${YELLOW}.cursorrules already exists — skipping${NC}"
  fi

  # Create CLAUDE.md if missing
  if [ ! -f "$repo_dir/CLAUDE.md" ]; then
    cat > "$repo_dir/CLAUDE.md" << REPOCLAUDEEOF
# ${repo_dir}

> Architecture, API contracts, and decisions live in \`../${VAULT_NAME}/\`.
> Check there before writing code. \`API_CONTRACTS.md\` is the final authority on endpoint shapes.
> Before pushing, diff code changes against \`API_CONTRACTS.md\` — if they diverge, surface the mismatch and ask before proceeding.
> This is ${REPO_STACK}.
REPOCLAUDEEOF
    echo -e "    ${GREEN}Created CLAUDE.md${NC}"
  else
    echo -e "    ${YELLOW}CLAUDE.md already exists — skipping${NC}"
  fi

  # Add .cursor/ and .gitnexus to .gitignore if not already there
  if [ -f "$repo_dir/.gitignore" ]; then
    if ! grep -q "\.cursor/" "$repo_dir/.gitignore" 2>/dev/null; then
      echo ".cursor/" >> "$repo_dir/.gitignore"
      echo -e "    ${GREEN}Added .cursor/ to .gitignore${NC}"
    fi
    if ! grep -q "\.gitnexus" "$repo_dir/.gitignore" 2>/dev/null; then
      echo ".gitnexus" >> "$repo_dir/.gitignore"
      echo -e "    ${GREEN}Added .gitnexus to .gitignore${NC}"
    fi
  fi

done

# ============================================================================
# Step 7: GitNexus indexing (optional)
# ============================================================================

echo ""
echo -e "${BLUE}Step 8: GitNexus indexing (optional)...${NC}"
echo ""

if command -v gitnexus &> /dev/null; then
  for repo_dir in "${REPO_DIRS[@]}"; do
    if [ -d "$repo_dir" ]; then
      echo "  Indexing $repo_dir..."
      cd "$repo_dir" && npx gitnexus analyze 2>&1 | tail -3 && cd "$WORKSPACE_DIR"
    fi
  done
else
  echo -e "${YELLOW}  GitNexus not installed. This is optional but recommended.${NC}"
  echo -e "${YELLOW}  Install: npm install -g gitnexus${NC}"
  echo -e "${YELLOW}  Then run in each repo: npx gitnexus analyze${NC}"
fi

# ============================================================================
# Done
# ============================================================================

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}   Setup Complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo "Your workspace:"
echo ""
echo "  $(pwd)/"
echo "  ├── CLAUDE.md              ← Claude Code reads this every session"
echo "  ├── ${VAULT_NAME}/"
echo "  │   ├── ARCHITECTURE.md    ← How your system works"
echo "  │   ├── API_CONTRACTS.md   ← Endpoint shapes"
echo "  │   └── DECISIONS.md       ← What was tried and why"
for repo_dir in "${REPO_DIRS[@]}"; do
echo "  ├── ${repo_dir}/"
echo "  │   ├── .cursorrules       ← Cursor reads this"
echo "  │   └── CLAUDE.md          ← Claude Code reads this"
done
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo "  1. Open ${VAULT_NAME}/ in Obsidian (File → Open Vault)"
echo "     Then install the 'Obsidian Git' community plugin (config is pre-set)"
echo ""
echo "  2. Add a git remote to the vault so it syncs:"
echo "     cd ${VAULT_NAME} && git remote add origin <your-vault-repo-url> && git push -u origin main"
echo ""
echo "  3. Fill in ARCHITECTURE.md with how your project works"
echo ""
echo "  4. Start coding:"
echo "     - Use Cursor opened in a single repo for focused edits"
echo "     - Use Claude Code opened at the workspace root for cross-repo work"
echo ""
echo "  5. When something doesn't work or you make a non-obvious choice,"
echo "     the AI will prompt you to log it in DECISIONS.md automatically"
echo ""
echo -e "${BOLD}How it works:${NC}"
echo ""
echo "  Claude Code → reads CLAUDE.md → reads vault → understands your project"
echo "  Cursor      → reads .cursorrules → checks vault → writes code correctly"
echo "  Obsidian    → auto-commits/pulls every 1 min with author + timestamp (Git plugin)"
echo "  DECISIONS.md → shared memory between all engineers and agents"
echo ""
