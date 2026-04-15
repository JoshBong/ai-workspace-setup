<div align="center">

# 🧠 AI Workspace Setup

**Give your AI agents a shared brain across repos.**

One script sets up a multi-repo workspace where your AI agents share context through an Obsidian vault — so your agents remember decisions, follow conventions, and never suggest approaches you've already rejected. Works with Claude Code, Cursor, Codex, and Windsurf.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)

</div>

---

## Why Use This

- **Save tokens** — stop re-explaining your architecture, auth flow, and conventions every session. The agent reads the vault once and starts working.
- **Cross-repo awareness** — your agent sees how your frontend, backend, and database connect. It won't break one repo while fixing another.
- **Shared memory across engineers** — when one person discovers a dead end, every other engineer's agent knows about it within minutes via auto-syncing Obsidian.
- **Onboard instantly** — new engineers' agents read the vault and have full project context from session one. No weeks of "how does X work?" questions.
- **Never repeat mistakes** — failed approaches are logged automatically in `DECISIONS.md`. No one wastes time re-discovering what doesn't work.
- **Multi-agent support** — choose which agents you use (Claude Code, Cursor, Codex, Windsurf) and get the right config files for each. No manual wiring.

---

## The Problem

AI coding agents start every session with amnesia. They don't know:
- What you tried yesterday that didn't work
- How your repos connect to each other
- What conventions your team follows
- Why you chose approach A over approach B

You end up re-explaining context every session, wasting tokens on the same explanations, and your agents keep suggesting things you've already rejected. Worse — when multiple engineers work in parallel, one person's hard-won knowledge dies when their session ends. Engineer A spends an hour discovering that approach X breaks the payment flow, and an hour later Engineer B tries the exact same thing.

## The Solution

A workspace structure where AI agents automatically read shared documentation before writing any code:

```
~/.ai-profile/               <- Global AI profile (persists across all projects)
├── WORKING_STYLE.md
├── PREFERENCES.md
└── CORRECTIONS.md

your-workspace/
├── .ai-rules/               <- Agent instructions (auto-updated by script)
│   ├── 01-session-start.md
│   ├── 02-vault-rules.md
│   ├── 03-contract-drift.md
│   ├── 04-profile-rules.md
│   └── version.txt
├── .workspace-config         <- Saved config (read by update script)
├── ai-profile/               <- Symlink -> ~/.ai-profile/
├── CLAUDE.md                 <- User-owned pointer (+ your custom notes)
├── your-vault/               <- Obsidian vault (shared brain)
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── GRAPH_REPORT.md
│   ├── API_CONTRACTS.md
│   ├── DECISIONS.md
│   └── SESSION_LOG.md
├── repo-1/
│   ├── .ai-rules/            <- Agent instructions (auto-updated)
│   ├── CLAUDE.md              <- User-owned pointer
│   ├── .cursorrules           <- User-owned pointer
│   └── AGENTS.md              <- User-owned pointer (Codex)
└── repo-2/
    ├── .ai-rules/
    ├── CLAUDE.md
    └── .windsurfrules
```

**The vault is the single source of truth.** Every agent reads it before suggesting code. When someone rejects an approach or makes a non-obvious choice, the agent logs it to `DECISIONS.md` in real time. The next engineer's agent reads that log on session start — no one wastes time re-discovering dead ends.

---

## Quick Start

```bash
npm install -g devnexus

mkdir my-workspace && cd my-workspace
devnexus init
```

Or without a global install:

```bash
mkdir my-workspace && cd my-workspace
npx devnexus init
```

`devnexus init` prompts you for:
1. **Project name** — names the vault and workspace
2. **Repo URLs** — paste as many as you want (git URLs or existing folder names), press Enter when done
3. **Agents** — select which agents you use: Claude Code, Cursor, Codex, Windsurf (generates the right pointer files for each)
4. **Project description** — one line, so the agent understands what you're building
5. **Tech stack** — auto-detected per repo, but you can describe the overall stack
6. **Your name** — for decision log attribution

`devnexus` saves your choices to `.workspace-config` so future updates can regenerate files without re-prompting.

---

## How It Works

### The Split Architecture

Agent instructions are split into two layers:

**`.ai-rules/` directory** (script-owned, auto-updated):
Contains the actual rules as modular files. When you pull a new release and run `devnexus update`, these files get regenerated with the latest instructions. You never need to edit these.

| File | Purpose |
|------|---------|
| `01-session-start.md` | What to read on session start, vault workflow |
| `02-vault-rules.md` | How to write to and maintain the vault |
| `03-contract-drift.md` | Pre-push contract drift check logic |
| `04-profile-rules.md` | AI profile usage and update rules |
| `version.txt` | Tracks which release generated these rules |

**Pointer files** (user-owned, never overwritten):
Short files that tell the agent to read `.ai-rules/`. Created once during setup, then yours to customize. Add project-specific instructions, repo-specific notes, or anything else — the script will never touch them after initial creation.

| File | Read by | Created when |
|------|---------|-------------|
| `CLAUDE.md` | Claude Code | Agent "claude" selected |
| `.cursorrules` | Cursor | Agent "cursor" selected |
| `AGENTS.md` | Codex | Agent "codex" selected |
| `.windsurfrules` | Windsurf | Agent "windsurf" selected |

This split means you get updated rules without losing your custom notes.

### The Three Layers

```
┌─────────────────────────────────────────────────────────┐
│  AI PROFILE (~/.ai-profile/)                            │
│  Global — persists across all projects                  │
│  Working style, preferences, corrections                │
│  Starts empty, fills in through corrections over time   │
├─────────────────────────────────────────────────────────┤
│  AGENT (workspace root or individual repo)              │
│  Reads pointer file -> .ai-rules/ -> vault -> profile   │
│  Cross-repo reasoning from root, focused edits in repo  │
├─────────────────────────────────────────────────────────┤
│  OBSIDIAN VAULT (shared brain)                          │
│  Architecture, contracts, decisions, session log        │
│  Auto-commits/pulls every 1 min with author + timestamp │
└─────────────────────────────────────────────────────────┘
```

### Where to work from

**Workspace root** — use this for cross-repo work. Your agent reads the workspace-level pointer file (e.g., `CLAUDE.md`), which loads `.ai-rules/` and the vault. Open your terminal here when you need to reason across repos, update architecture, or do anything that touches multiple parts of the system.

**Inside a single repo** — use this for focused work. Your agent reads the repo-level pointer file, which loads the repo's `.ai-rules/` and the vault. Open your editor here when you're building a feature, fixing a bug, or working within one codebase.

### What each agent gets automatically

All agents, regardless of which one you use, get the same core behaviors through `.ai-rules/`:
- Reads `~/.ai-profile/` — knows your working style, preferences, and past corrections
- Reads the vault files and session log before doing anything
- After finishing work, prompted to update `API_CONTRACTS.md` if endpoints changed
- When an approach fails mid-session, prompted to log it in `DECISIONS.md`
- Before pushing, runs a contract drift check — if code diverges from `API_CONTRACTS.md`, surfaces the mismatch with options to update the contract, revert the code, or check impact first
- When you correct its behavior, asks to log it in `CORRECTIONS.md` so it never repeats the mistake
- At session end, offers to write a handoff note in `SESSION_LOG.md`

### The decision log

`DECISIONS.md` is the most important file. It's a reverse-chronological log that captures:

```markdown
## 2024-03-15 — Rejected Redis for caching (by Sarah)

Evaluated Redis for API response caching. Rejected because our Supabase plan includes
edge caching and adding Redis doubles infrastructure cost for marginal latency improvement.

## 2024-03-14 — Auth uses httpOnly cookies, not localStorage (by Mike)

Considered storing JWT in localStorage for simplicity. Chose httpOnly cookies because
localStorage is vulnerable to XSS and our app handles payment data.
```

Every agent reads this on session start. When Sarah's agent suggests Redis next week, it already knows why that was rejected. When a new engineer joins, their agent has the full history of architectural decisions from day one.

**Entries are auto-prompted** — you don't need to remember to write them. The agent detects when you say "that didn't work", "scrap that", "let's try something else" and offers to log it.

---

## Why This Saves Tokens

Every AI session starts by burning tokens on context. Without a shared vault, you're paying for the same context over and over:

| Without vault | With vault |
|--------------|------------|
| "We're building a booking platform with Next.js frontend and FastAPI backend, they connect through proxy routes at..." (200+ tokens, every session) | Agent reads `ARCHITECTURE_OVERVIEW.md` once, already knows (0 tokens of re-explanation) |
| "Don't use Redis, we already tried that" (50 tokens, repeated across engineers) | Agent reads `DECISIONS.md`, already knows (0 tokens) |
| "The auth flow works like this..." (300+ tokens explaining patterns) | Agent reads `.ai-rules/`, already knows the auth pattern for each role (0 tokens) |
| Agent suggests a change, breaks the other repo, you spend 20 minutes debugging | Agent reads `API_CONTRACTS.md`, knows the exact response shape the other repo expects |

**The vault front-loads context once so you never pay for it again.** Instead of re-explaining your architecture every session, the agent reads the vault and starts working immediately. Across a team of engineers running multiple sessions per day, this adds up fast.

The cross-repo awareness is where the real savings hit. Without a shared contract document, an agent working in your frontend has no idea what your backend expects. It guesses, gets it wrong, you debug. With `API_CONTRACTS.md`, the agent knows the exact request/response shapes across repo boundaries before writing a single line.

---

## Why This Works for Teams

The vault isn't just documentation — it's a **live shared memory** between every engineer and every agent session on your team.

### Real-time knowledge sharing

When Engineer A discovers something, it's available to Engineer B's agent within minutes:

```
 10:00am  Engineer A's agent tries approach X -> fails
 10:01am  Agent prompts: "Log to DECISIONS.md?" -> Yes
 10:01am  Agent: git pull -> write -> commit -> push
 10:01am  Obsidian Git syncs on Engineer B's machine (~1 min)
 10:15am  Engineer B starts a new session
 10:15am  Agent reads profile -> vault -> SESSION_LOG.md
 10:15am  Already knows X doesn't work, picks up where A left off
```

This compounds. After a few weeks, `DECISIONS.md` contains dozens of dead ends that no one on the team will ever waste time on again. New engineers get the full institutional knowledge on their first session — their agent reads the same vault and makes the same informed decisions as the most senior person on the team.

### Cross-repo safety net

Most teams break things at repo boundaries. Your frontend engineer changes a response shape, your backend engineer doesn't know, and the integration breaks silently.

The vault prevents this because `API_CONTRACTS.md` is the single source of truth for how repos talk to each other. When an agent runs from the workspace root, it sees **all repos at once** and can:

- Verify that a frontend change matches what the backend actually returns
- Warn when an API contract change needs a corresponding update in the other repo
- Trace data flow from one repo through the proxy layer into another

Agents scoped to a single repo still get cross-repo awareness through the vault — they read `API_CONTRACTS.md` to understand what the other repo expects without needing to open it.

### The multiplier effect

| Team size | Without vault | With vault |
|-----------|--------------|------------|
| 1 engineer | Re-explain context every session | Context loaded automatically |
| 2 engineers | Same mistakes made twice, integration breaks silently | Decisions shared in real-time, contracts enforced |
| 5 engineers | Knowledge silos, constant "how does X work?" questions | Every agent has full team knowledge from day one |
| New hire | Weeks of onboarding, asking the same questions | Agent reads vault, productive on first session |

---

## What the Script Creates

### `.ai-rules/` directory

Created at the workspace root and inside each repo. Contains modular rule files that agents read via their pointer files. These are regenerated by `devnexus update` and should not be hand-edited.

| File | Purpose |
|------|---------|
| `01-session-start.md` | Session startup sequence — read vault, check session log, understand context |
| `02-vault-rules.md` | Rules for writing to and maintaining vault files |
| `03-contract-drift.md` | Pre-push check that diffs code against `API_CONTRACTS.md` |
| `04-profile-rules.md` | When and how to update `~/.ai-profile/` files |
| `version.txt` | Version tag so `devnexus update` knows what to regenerate |

### Vault files

| File | Purpose | When to update |
|------|---------|----------------|
| `ARCHITECTURE_OVERVIEW.md` | How your system works — repos, data flow, key structures | When you add a service, change how repos connect, or discover a structural gap |
| `GRAPH_REPORT.md` | Structural analysis from Graphify — god nodes, communities, bridges | After running Graphify on the codebase |
| `API_CONTRACTS.md` | Every endpoint shape — request, response, errors | When any endpoint changes. This file is the final authority. |
| `DECISIONS.md` | Rejected approaches and non-obvious choices | Automatically prompted by agents mid-session |
| `SESSION_LOG.md` | Two-line session handoff notes | At the end of each session, so the next one picks up where you left off |

### Global AI profile (`~/.ai-profile/`)

| File | Purpose | When to update |
|------|---------|----------------|
| `WORKING_STYLE.md` | How you prefer to work — communication, pacing, decision-making | Agents ask to add entries when they notice patterns |
| `PREFERENCES.md` | Code taste, commit style, response format, autonomy level | When you state a preference or an agent detects one |
| `CORRECTIONS.md` | Behavioral corrections log — mistakes to never repeat | Automatically when you correct an agent's behavior |

The profile starts empty and fills in organically. No setup questions — agents learn by working with you. It's symlinked into the workspace as `./ai-profile/` so all agents (including Cursor, which can't follow paths outside the project) can read and write to it.

### Pointer files (per-repo)

| File | Read by | Content |
|------|---------|---------|
| `CLAUDE.md` | Claude Code | Short pointer to `.ai-rules/` + space for your custom notes |
| `.cursorrules` | Cursor | Short pointer to `.ai-rules/` + space for your custom notes |
| `AGENTS.md` | Codex | Short pointer to `.ai-rules/` + space for your custom notes |
| `.windsurfrules` | Windsurf | Short pointer to `.ai-rules/` + space for your custom notes |

Only the pointer files for agents you selected during setup are created. You can add more later by re-running setup or creating them manually — just point them to `.ai-rules/`.

### `.workspace-config`

Saved during setup and read by `devnexus update`. Contains your project name, vault name, repo list, and selected agents. This file lets the update script regenerate `.ai-rules/` without re-prompting you for setup details.

### Auto-detected tech stacks

The script reads your repo files and tailors the rules to the right framework:

| Detected via | Identified as |
|-------------|---------------|
| `package.json` with `next` | Next.js (TypeScript, React) |
| `package.json` with `react` | React |
| `package.json` with `vue` | Vue.js |
| `package.json` with `svelte` | SvelteKit |
| `requirements.txt` with `fastapi` | FastAPI (Python) |
| `requirements.txt` with `django` | Django (Python) |
| `requirements.txt` with `flask` | Flask (Python) |
| `go.mod` | Go |
| `Cargo.toml` | Rust |

---

## Updating Your Workspace

When a new version of `devnexus` is released, run:

```bash
npm update -g devnexus
cd my-workspace
devnexus update
```

This regenerates all `.ai-rules/` directories and reinstalls git hooks using the latest templates. It reads `.workspace-config` to know your project structure.

**What gets updated:**
- `.ai-rules/` contents in workspace root and all repos
- `version.txt` inside each `.ai-rules/`
- Contract drift pre-push hook in each repo's `.git/hooks/`

**What is never touched:**
- Pointer files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.windsurfrules`) — your custom notes are safe
- Vault contents (`ARCHITECTURE_OVERVIEW.md`, `API_CONTRACTS.md`, `DECISIONS.md`, `SESSION_LOG.md`)
- AI profile (`~/.ai-profile/`)
- `.workspace-config`

`devnexus update` is idempotent — safe to run as often as you want.

---

## Starting a New Project

When you start a new project, run `devnexus init` in a new folder:

```bash
mkdir new-project && cd new-project
devnexus init
```

The script detects your existing AI profile at `~/.ai-profile/` and skips creation. Your new workspace gets a fresh vault (new architecture, new decisions, new contracts) but your agent already knows how you work — your preferences, working style, and past corrections carry over automatically.

Each workspace is independent. You can have as many as you want:

```
~/.ai-profile/              <- shared across everything
~/project-alpha/             <- workspace with its own vault
~/project-beta/              <- separate workspace, separate vault, same you
~/freelance-client/          <- another workspace, agent still knows your style
```

---

## Obsidian Setup

The vault is designed to be opened in [Obsidian](https://obsidian.md/) (free). After running the setup script:

1. **Open Obsidian** -> File -> Open Vault -> select `your-vault/`
2. **Obsidian Git plugin is pre-configured** — the setup script creates the plugin config automatically. Just enable Community Plugins in Obsidian settings and enable "Obsidian Git".

### Pre-configured Obsidian Git settings

| Setting | Value | Why |
|---------|-------|-----|
| Auto-commit interval | 1 minute | Keeps vault synced without manual commits |
| Auto-pull interval | 1 minute | Gets other engineers' changes immediately |
| Pull on startup | Enabled | Always start with latest vault |
| Push after commit | Enabled | Changes are shared automatically |
| Commit message format | `vault: {{date}} by {{author}}` | Attribution + timestamp in git history |
| List changed files | Enabled | See what was touched in each commit |

### For teams

Each engineer:
1. Clones the vault repo
2. Opens it in Obsidian
3. Enables Obsidian Git (config is already set by the setup script)

The vault syncs via git. When one engineer logs a decision, every other engineer's agent sees it within 1 minute (or immediately if the agent does `git pull` before reading, which the setup configures).

---

## For Teams

### How multi-engineer workflows work

```
Engineer A (Cursor, settled-web)          Engineer B (Claude Code, settled-api)
         |                                          |
         +- Tries approach X                        |
         +- It fails                                |
         +- Agent: "Log to DECISIONS.md?"           |
         +- Yes -> git pull, write, commit, push    |
         |                                          |
         |         +---- vault syncs ----+          |
         |         |                     |          |
         |         v                     v          |
         |    DECISIONS.md now has:                  |
         |    "Tried X, failed because Y"           |
         |                                          |
         |                     Engineer B starts new session
         |                     Agent reads DECISIONS.md
         |                     Already knows not to try X
```

### What each engineer needs

1. Run `devnexus init` with the same repo URLs and select their agents
2. Open the vault in Obsidian with Obsidian Git enabled
3. Use their preferred agent for the task at hand
4. That's it — agents handle the rest

### Decision log attribution

Every entry includes who made the decision and when:

```markdown
## 2024-03-15 — Title of decision (by Engineer Name)
```

The agent auto-fills the date and prompts for the name.

---

## Advanced: Graphify (Large Codebases)

For codebases over ~200 files, consider adding [Graphify](https://pypi.org/project/graphifyy/) for structural analysis. Graphify maps your entire codebase into a graph of nodes (functions, classes, schemas) and edges (calls, imports, dependencies), then detects:

- **God Nodes** — data structures where a single change ripples through dozens of files
- **Communities** — clusters of tightly coupled code that should be understood together
- **Bridge nodes** — types that connect otherwise separate parts of the system
- **Knowledge gaps** — isolated functions, thin clusters, and undocumented dependencies

### Setup

```bash
# Create a dedicated venv (keep separate from your project venvs)
python3 -m venv .venv-graphify
source .venv-graphify/bin/activate
pip install graphifyy
```

### Run an audit

```bash
# From workspace root, with the graphify venv activated
graphify ./ --output ./your-vault/GRAPH_REPORT.md
```

This generates a full report in the vault with God Nodes, communities, bridges, and gaps. The output goes into Obsidian where you and your agents can reference it.

### When to run

| Trigger | Why |
|---------|-----|
| Weekly (or start of sprint) | Catch architectural drift before it compounds |
| Before touching a God Node | See the blast radius before you start |
| After a major refactor | Verify community boundaries didn't break |

### Cost note

Graphify uses Claude tokens for semantic extraction. For cost-conscious runs, use `--no-semantic` for AST-only analysis (faster, free, but misses semantic relationships).

---

## Advanced: GitNexus (Code Intelligence)

[GitNexus](https://github.com/abhigyanpatwari/GitNexus) indexes your codebase into a knowledge graph and exposes it to AI agents via MCP. It gives your agents blast radius analysis, execution flow tracing, and safe multi-file renames.

### Setup

```bash
npm install -g gitnexus

# Index each repo
cd your-repo && npx gitnexus analyze
```

The setup script will attempt this automatically if GitNexus is installed.

### What it adds

| Capability | What it does |
|-----------|--------------|
| **Blast radius** | Before editing a function, see every caller and downstream dependency |
| **Execution flows** | Trace how a request flows through your codebase step by step |
| **Safe renames** | Rename a symbol across all files using the call graph, not find-and-replace |
| **Change detection** | Before committing, verify your changes only affect expected files |

### MCP configuration

GitNexus runs as an MCP server that AI agents connect to:

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

**Claude Code:**
```bash
claude mcp add gitnexus -- npx -y gitnexus@latest mcp
```

---

## Requirements

| Requirement | Required? | Purpose |
|------------|-----------|---------|
| `git` | Yes | Vault sync, repo cloning |
| `bash` | Yes | Running setup and update scripts |
| [Obsidian](https://obsidian.md/) | Yes | Opening and editing the vault |
| [Claude Code](https://claude.ai/claude-code) | Optional | Cross-repo AI reasoning |
| [Cursor](https://cursor.com/) | Optional | Focused AI-assisted editing |
| [Codex](https://openai.com/codex) | Optional | AI coding agent |
| [Windsurf](https://codeium.com/windsurf) | Optional | AI coding agent |
| `npm` | Yes | Installing and running `devnexus` |
| `python3` | Optional | For Graphify structural analysis |

---

## FAQ

**Can I use this with just one repo?**
Yes. The vault still adds value as a persistent memory layer — decisions, architecture notes, and API contracts survive between sessions.

**Which agents are supported?**
Claude Code, Cursor, Codex, and Windsurf. The setup script asks which ones you use and generates the right pointer files. You can select any combination.

**What is `.ai-rules/` and should I edit it?**
It's a directory of modular rule files that your agents read on every session start. It's managed by the setup and update scripts — don't hand-edit it. Your customizations belong in the pointer files (`CLAUDE.md`, `.cursorrules`, etc.), which are never overwritten.

**How do I add a new agent later?**
Run `devnexus agent add windsurf` (or `cursor`, `codex`). To see what's installed: `devnexus agent ls`. To remove: `devnexus agent rm cursor`. The rules themselves are agent-agnostic — pointer files are just thin wrappers that point to `.ai-rules/`.

**How do I get updated rules?**
Run `npm update -g devnexus` then `devnexus update` from your workspace root. This regenerates all `.ai-rules/` directories and git hooks without touching your pointer files, vault, or profile.

**What is `.workspace-config`?**
A file saved during setup that stores your project name, vault name, repo list, and selected agents. The update script reads it so it can regenerate `.ai-rules/` without re-prompting you.

**How big can DECISIONS.md get?**
At ~100 entries (2-3 months of active development), rotate it: move the current file to `archive/DECISIONS-2024-Q1.md` and start fresh. Agents only read the current file on session start.

**What if two engineers update DECISIONS.md at the same time?**
The setup configures agents to `git pull` before writing and `git push` immediately after. If a conflict still happens, it's a simple text merge — entries are independent blocks.

**What is the AI profile?**
A global directory at `~/.ai-profile/` that stores how you work — your preferences, working style, and behavioral corrections. It starts empty and fills in over time as agents learn your patterns. Unlike the vault (which is project-specific), the profile follows you across all projects.

**Do I need to fill in the profile manually?**
No. It starts blank. As you work with agents and correct their behavior, they'll ask to log those corrections and preferences. After a few sessions, the profile reflects how you actually work — not how you think you work.

**Does the profile sync between machines?**
Not by default — it's just a local directory. You can make it a git repo if you want to sync it, but it's personal (not shared with a team), so local-only is fine for most people.

**How do I start a second project?**
Run the script in a new folder. It detects your existing `~/.ai-profile/` and reuses it — your agent already knows your preferences from day one. The vault is fresh for the new project.

**What is the contract drift check?**
Two layers of enforcement. First, a git pre-push hook installed by `devnexus init` in each repo's `.git/hooks/` — it runs on every push automatically, scans for changes to API-related directories (`routes/`, `api/`, `controllers/`, etc.), and blocks the push if `API_CONTRACTS.md` wasn't updated. Second, `.ai-rules/03-contract-drift.md` tells agents to surface mismatches with options to fix before pushing. The hook fires regardless of which editor or agent you're using. To bypass consciously: `git push --no-verify`.

**Can I add non-code docs to the vault?**
Keep the vault lean. It should contain only files that help agents write better code. Business docs, pitch decks, and partner lists belong elsewhere — they dilute the signal agents read on every session start.

---

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and noncommercial use. Companies need a commercial license. Contact [Joshua Huang](https://github.com/JoshBong) for commercial licensing.
