#!/bin/bash
# ============================================================================
# AI-Augmented Workspace Setup
# ============================================================================
# Sets up a multi-repo workspace with an Obsidian vault as the shared brain
# for AI coding agents (Claude Code, Cursor, Codex, Windsurf, etc.).
#
# What this creates:
#   ~/.ai-profile/              ← Global AI profile (persists across projects)
#   │   ├── WORKING_STYLE.md
#   │   ├── PREFERENCES.md
#   │   └── CORRECTIONS.md
#
#   your-workspace/
#   ├── .ai-rules/              ← Agent instructions (script-owned, updatable)
#   ├── .workspace-config       ← Saved config for updates
#   ├── ai-profile/             ← Symlink → ~/.ai-profile/
#   ├── CLAUDE.md               ← Claude Code pointer (user-owned)
#   ├── your-vault/             ← Obsidian vault (shared source of truth)
#   │   ├── ARCHITECTURE.md
#   │   ├── API_CONTRACTS.md
#   │   ├── DECISIONS.md
#   │   ├── SESSION_LOG.md
#   │   └── .obsidian/
#   ├── repo-1/
#   │   ├── .ai-rules/          ← Agent instructions (script-owned)
#   │   ├── CLAUDE.md           ← Pointer (user-owned)
#   │   └── .cursorrules        ← Pointer (user-owned)
#   └── repo-2/
#       ├── .ai-rules/
#       ├── CLAUDE.md
#       └── .cursorrules
#
# Usage:
#   1. Create an empty folder for your workspace
#   2. Put this script in that folder
#   3. Run: bash setup-workspace.sh
#   4. Follow the prompts
#
# To update agent rules after a new release:
#   bash update-workspace.sh
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

TEMPLATE_VERSION="1.0"

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}   AI-Augmented Workspace Setup${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""

WORKSPACE_DIR=$(pwd)

# ============================================================================
# Step 0: Create global AI profile (once, ever)
# ============================================================================

AI_PROFILE_DIR="$HOME/.ai-profile"

if [ ! -d "$AI_PROFILE_DIR" ]; then
  echo -e "${BLUE}Setting up your global AI profile...${NC}"
  echo ""
  mkdir -p "$AI_PROFILE_DIR"

  cat > "$AI_PROFILE_DIR/WORKING_STYLE.md" << 'PROFILEEOF'
# Working Style

> How you prefer to work with AI agents. This file is empty on purpose —
> it fills in over time as agents learn your patterns.
> When an agent notices a preference, it will ask to log it here.

(No entries yet. Your agents will learn as you work together.)
PROFILEEOF

  cat > "$AI_PROFILE_DIR/PREFERENCES.md" << 'PROFILEEOF'
# Preferences

> Code taste, commit style, response format, autonomy level.
> Starts empty — agents will ask to add entries when they notice patterns
> or when you correct their behavior.

(No entries yet. Your agents will learn as you work together.)
PROFILEEOF

  cat > "$AI_PROFILE_DIR/CORRECTIONS.md" << 'PROFILEEOF'
# Corrections Log

> Reverse-chronological log of behavioral corrections.
> When you tell an agent "don't do that" or "actually I want it this way,"
> it logs the correction here and updates the relevant profile file.
> Format: ## YYYY-MM-DD — Short description

(No entries yet.)
PROFILEEOF

  echo -e "${GREEN}  Created ~/.ai-profile/ — starts empty, fills in as you work${NC}"
  echo ""
else
  echo -e "${GREEN}  Found existing AI profile at ~/.ai-profile/ — keeping it${NC}"
  echo ""
fi

# Symlink profile into workspace so all agents can write to it
if [ ! -L "ai-profile" ]; then
  ln -sf "$AI_PROFILE_DIR" ./ai-profile
  echo -e "${GREEN}  Linked ./ai-profile → ~/.ai-profile/${NC}"
  echo ""
fi

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
# Step 2: Describe your project
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
# Step 3: Agent selection
# ============================================================================

echo ""
echo -e "${BLUE}Step 4: Which AI agents do you use?${NC}"
echo ""
echo "Supported: claude, cursor, codex, windsurf"
echo "Enter space-separated (e.g., 'claude cursor')"
echo "Default: claude"
echo ""
read -p "Agents: " AGENTS_INPUT
AGENTS_INPUT=${AGENTS_INPUT:-claude}

AGENTS=()
for agent in $AGENTS_INPUT; do
  agent_lower=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  case "$agent_lower" in
    claude|cursor|codex|windsurf)
      AGENTS+=("$agent_lower")
      ;;
    *)
      echo -e "${YELLOW}  Unknown agent '$agent' — skipping${NC}"
      ;;
  esac
done

if [ ${#AGENTS[@]} -eq 0 ]; then
  AGENTS=("claude")
fi

echo -e "${GREEN}  Selected agents: ${AGENTS[*]}${NC}"

# ============================================================================
# Step 4: Clone repos
# ============================================================================

echo ""
echo -e "${BLUE}Step 5: Setting up repos...${NC}"
echo ""

REPO_DIRS=()
for repo in "${REPOS[@]}"; do
  if [[ "$repo" == http* ]] || [[ "$repo" == git@* ]]; then
    repo_dir=$(basename "$repo" .git)
    if [ -d "$repo_dir" ]; then
      echo -e "${YELLOW}  $repo_dir already exists, skipping clone${NC}"
    else
      echo "  Cloning $repo..."
      git clone "$repo" 2>&1 | tail -1
    fi
    REPO_DIRS+=("$repo_dir")
  else
    if [ -d "$repo" ]; then
      echo -e "${GREEN}  Found existing folder: $repo${NC}"
      REPO_DIRS+=("$repo")
    else
      echo -e "${RED}  Folder '$repo' not found — skipping${NC}"
    fi
  fi
done

# ============================================================================
# Step 5: Create the Obsidian vault
# ============================================================================

echo ""
echo -e "${BLUE}Step 6: Creating Obsidian vault (${VAULT_NAME})...${NC}"
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

Set up AI-augmented workspace with Obsidian vault as shared brain, CLAUDE.md for session context, and .ai-rules per repo. Vault is the single source of truth — agents read it before writing code.
EOF

# SESSION_LOG.md
cat > "$VAULT_NAME/SESSION_LOG.md" << 'EOF'
# Session Log

> Two-line handoff notes at the end of each session.
> Helps the next session pick up where the last one left off.
> Format: ## YYYY-MM-DD — Session summary (by [name])
> Line 1: What was done. Line 2: Where things left off / what's next.

(No sessions logged yet.)
EOF

echo -e "${GREEN}  Created ${VAULT_NAME}/ with ARCHITECTURE.md, API_CONTRACTS.md, DECISIONS.md, SESSION_LOG.md${NC}"

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
# Step 6: Create workspace .ai-rules/ and agent pointer files
# ============================================================================

echo ""
echo -e "${BLUE}Step 7: Creating workspace agent rules...${NC}"
echo ""

# --- Generate workspace .ai-rules/ (always regenerated) ---

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

echo -e "${GREEN}  Created .ai-rules/ with agent instructions${NC}"

# --- Generate workspace agent pointer files (only if they don't exist) ---

# Build repo directory table
REPO_TABLE=""
for repo_dir in "${REPO_DIRS[@]}"; do
  REPO_TABLE="${REPO_TABLE}| \`./${repo_dir}/\` | Repository |\n"
done

# Function to create a workspace-level pointer file
create_workspace_pointer() {
  local file_path="$1"
  local agent_name="$2"

  if [ ! -f "$file_path" ]; then
    cat > "$file_path" << POINTEREOF
# ${PROJECT_NAME} Workspace

Read and follow all instructions in \`./.ai-rules/\` before starting work.

## Directory Map

| Directory | What it is |
|-----------|------------|
| \`./${VAULT_NAME}/\` | Obsidian vault — source of truth for all agents |
| \`./ai-profile/\` | Symlink to ~/.ai-profile/ (your operator profile) |
$(echo -e "$REPO_TABLE")

## Project-Specific Notes

(Add any custom instructions below. This file is yours — it won't be overwritten by updates.)
POINTEREOF
    echo -e "    ${GREEN}Created ${file_path} (${agent_name})${NC}"
  else
    echo -e "    ${YELLOW}${file_path} already exists — keeping it${NC}"
  fi
}

for agent in "${AGENTS[@]}"; do
  case "$agent" in
    claude)   create_workspace_pointer "CLAUDE.md" "Claude Code" ;;
    cursor)   create_workspace_pointer ".cursorrules" "Cursor" ;;
    codex)    create_workspace_pointer "AGENTS.md" "Codex" ;;
    windsurf) create_workspace_pointer ".windsurfrules" "Windsurf" ;;
  esac
done

# ============================================================================
# Step 7: Add .ai-rules/ and agent pointer files to each repo
# ============================================================================

echo ""
echo -e "${BLUE}Step 8: Setting up agent files in repos...${NC}"
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

  # --- Generate repo .ai-rules/ (always regenerated) ---

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

  echo -e "    ${GREEN}Created .ai-rules/${NC}"

  # --- Generate repo agent pointer files (only if they don't exist) ---

  create_repo_pointer() {
    local file_path="$1"
    local agent_name="$2"

    if [ ! -f "$file_path" ]; then
      cat > "$file_path" << REPOPOINTEREOF
# ${repo_dir}

Read and follow all instructions in \`./.ai-rules/\` before starting work.
This is ${REPO_STACK}.

(Add any custom instructions below. This file is yours — it won't be overwritten by updates.)
REPOPOINTEREOF
      echo -e "    ${GREEN}Created $(basename $file_path) (${agent_name})${NC}"
    else
      echo -e "    ${YELLOW}$(basename $file_path) already exists — keeping it${NC}"
    fi
  }

  for agent in "${AGENTS[@]}"; do
    case "$agent" in
      claude)   create_repo_pointer "$repo_dir/CLAUDE.md" "Claude Code" ;;
      cursor)   create_repo_pointer "$repo_dir/.cursorrules" "Cursor" ;;
      codex)    create_repo_pointer "$repo_dir/AGENTS.md" "Codex" ;;
      windsurf) create_repo_pointer "$repo_dir/.windsurfrules" "Windsurf" ;;
    esac
  done

  # Add .ai-rules/, .cursor/, and .gitnexus to .gitignore if not already there
  if [ -f "$repo_dir/.gitignore" ]; then
    if ! grep -q "\.ai-rules/" "$repo_dir/.gitignore" 2>/dev/null; then
      echo ".ai-rules/" >> "$repo_dir/.gitignore"
      echo -e "    ${GREEN}Added .ai-rules/ to .gitignore${NC}"
    fi
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
# Step 8: Save workspace config (for update-workspace.sh)
# ============================================================================

cat > .workspace-config << CONFIGEOF
# Auto-generated by setup-workspace.sh — used by update-workspace.sh
PROJECT_NAME="${PROJECT_NAME}"
VAULT_NAME="${VAULT_NAME}"
REPO_DIRS=($(printf '"%s" ' "${REPO_DIRS[@]}"))
AGENTS=($(printf '"%s" ' "${AGENTS[@]}"))
TECH_STACK="${TECH_STACK}"
TEMPLATE_VERSION="${TEMPLATE_VERSION}"
CONFIGEOF

echo -e "${GREEN}  Saved workspace config to .workspace-config${NC}"

# ============================================================================
# Step 9: GitNexus indexing (optional)
# ============================================================================

echo ""
echo -e "${BLUE}Step 9: GitNexus indexing (optional)...${NC}"
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
echo "  ~/.ai-profile/               ← Global AI profile (learns over time)"
echo "  │   ├── WORKING_STYLE.md   ← How you work"
echo "  │   ├── PREFERENCES.md     ← Code taste and settings"
echo "  │   └── CORRECTIONS.md     ← Behavioral corrections log"
echo ""
echo "  $(pwd)/"
echo "  ├── .ai-rules/             ← Agent instructions (auto-updated)"
echo "  ├── ai-profile/            ← Symlink → ~/.ai-profile/"
for agent in "${AGENTS[@]}"; do
  case "$agent" in
    claude)   echo "  ├── CLAUDE.md              ← Claude Code pointer (yours to customize)" ;;
    cursor)   echo "  ├── .cursorrules           ← Cursor pointer (yours to customize)" ;;
    codex)    echo "  ├── AGENTS.md              ← Codex pointer (yours to customize)" ;;
    windsurf) echo "  ├── .windsurfrules         ← Windsurf pointer (yours to customize)" ;;
  esac
done
echo "  ├── ${VAULT_NAME}/"
echo "  │   ├── ARCHITECTURE.md    ← How your system works"
echo "  │   ├── API_CONTRACTS.md   ← Endpoint shapes"
echo "  │   ├── DECISIONS.md       ← What was tried and why"
echo "  │   └── SESSION_LOG.md     ← Session handoff notes"
for repo_dir in "${REPO_DIRS[@]}"; do
echo "  ├── ${repo_dir}/"
echo "  │   ├── .ai-rules/         ← Agent instructions (auto-updated)"
for agent in "${AGENTS[@]}"; do
  case "$agent" in
    claude)   echo "  │   ├── CLAUDE.md          ← Claude Code pointer" ;;
    cursor)   echo "  │   ├── .cursorrules       ← Cursor pointer" ;;
    codex)    echo "  │   ├── AGENTS.md          ← Codex pointer" ;;
    windsurf) echo "  │   ├── .windsurfrules     ← Windsurf pointer" ;;
  esac
done
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
echo "  4. Start coding — your agents will read .ai-rules/ automatically"
echo ""
echo "  5. To update agent rules after a new release:"
echo "     bash update-workspace.sh"
echo ""
echo -e "${BOLD}How it works:${NC}"
echo ""
echo "  AI Profile   → ~/.ai-profile/ — agents learn your style over time"
echo "  .ai-rules/   → agent instructions — auto-updated, never edit manually"
echo "  Pointer files → CLAUDE.md, .cursorrules, etc. — yours to customize"
echo "  Vault         → shared project memory between all engineers and agents"
echo "  Obsidian      → auto-commits/pulls every 1 min with author + timestamp"
echo ""
