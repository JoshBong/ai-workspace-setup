<div align="center">

# 🧠 AI Workspace Setup

**Give your AI agents a shared brain across repos.**

One script sets up a multi-repo workspace where Claude Code and Cursor share context through an Obsidian vault — so your agents remember decisions, follow conventions, and never suggest approaches you've already rejected.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)

</div>

---

## Why Use This

- **Save tokens** — stop re-explaining your architecture, auth flow, and conventions every session. The agent reads the vault once and starts working.
- **Cross-repo awareness** — your agent sees how your frontend, backend, and database connect. It won't break one repo while fixing another.
- **Shared memory across engineers** — when one person discovers a dead end, every other engineer's agent knows about it within minutes via auto-syncing Obsidian.
- **Onboard instantly** — new engineers' agents read the vault and have full project context from session one. No weeks of "how does X work?" questions.
- **Never repeat mistakes** — failed approaches are logged automatically in `DECISIONS.md`. No one wastes time re-discovering what doesn't work.

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
your-workspace/
├── CLAUDE.md              ← Claude Code reads this every session
├── your-vault/            ← Obsidian vault (shared brain)
│   ├── ARCHITECTURE.md    ← How the system works
│   ├── API_CONTRACTS.md   ← Endpoint shapes (single source of truth)
│   └── DECISIONS.md       ← What was tried, what failed, and why
├── repo-1/
│   ├── .cursorrules       ← Cursor reads this, points to vault
│   └── CLAUDE.md          ← Claude Code reads this inside the repo
└── repo-2/
    ├── .cursorrules
    └── CLAUDE.md
```

**The vault is the single source of truth.** Every agent reads it before suggesting code. When someone rejects an approach or makes a non-obvious choice, the agent logs it to `DECISIONS.md` in real time. The next engineer's agent reads that log on session start — no one wastes time re-discovering dead ends.

---

## Quick Start

```bash
mkdir my-workspace && cd my-workspace
curl -sO https://raw.githubusercontent.com/JoshBong/ai-workspace-setup/main/setup-workspace.sh
bash setup-workspace.sh
```

The script prompts you for:
1. **Project name** — names the vault and workspace
2. **Repo URLs** — paste as many as you want (git URLs or existing folder names), press Enter when done
3. **Project description** — one line, so the agent understands what you're building
4. **Tech stack** — auto-detected per repo, but you can describe the overall stack
5. **Your name** — for decision log attribution

---

## How It Works

### The Three Layers

```
┌─────────────────────────────────────────────────────────┐
│  CLAUDE CODE (workspace root)                           │
│  Cross-repo reasoning, vault updates, architecture      │
│  Reads: CLAUDE.md → vault files → understands everything│
├─────────────────────────────────────────────────────────┤
│  CURSOR (individual repo)                               │
│  Focused edits, 1-5 files, fast iteration               │
│  Reads: .cursorrules → checks vault → writes code       │
├─────────────────────────────────────────────────────────┤
│  OBSIDIAN VAULT (shared brain)                          │
│  Architecture, contracts, decisions                     │
│  Auto-commits/pulls every 1 min with author + timestamp │
└─────────────────────────────────────────────────────────┘
```

| Tool | Open from | Best for |
|------|-----------|----------|
| **Claude Code** | Workspace root | Cross-repo reasoning, vault updates, architecture decisions, debugging across boundaries |
| **Cursor** | Individual repo | Focused feature work, UI changes, single-file fixes, fast iteration |
| **Obsidian** | Vault folder | Reading docs, manual edits, graph view of your knowledge base |

### What each agent gets automatically

**Claude Code** (opened from workspace root):
- Reads `CLAUDE.md` → told to read all three vault files before doing anything
- After finishing work, prompted: *"Before we wrap up — API_CONTRACTS.md needs updating because you added an endpoint. Want me to do that now?"*
- When an approach fails mid-session: *"That's worth logging in DECISIONS.md — tried X, failed because Y. Want me to add it now?"*
- Before pushing, runs a contract drift check — if code diverges from `API_CONTRACTS.md`, surfaces the mismatch with three options: update the contract, revert the code, or check impact first

**Cursor** (opened in a single repo):
- Reads `.cursorrules` → knows the tech stack, key patterns, and where the vault is
- Checks `DECISIONS.md` before proposing alternatives
- Logs failed approaches in real time so other engineers don't repeat them
- Before pushing, diffs code against `API_CONTRACTS.md` and surfaces any mismatch

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
| "We're building a booking platform with Next.js frontend and FastAPI backend, they connect through proxy routes at..." (200+ tokens, every session) | Agent reads `ARCHITECTURE.md` once, already knows (0 tokens of re-explanation) |
| "Don't use Redis, we already tried that" (50 tokens, repeated across engineers) | Agent reads `DECISIONS.md`, already knows (0 tokens) |
| "The auth flow works like this..." (300+ tokens explaining patterns) | Agent reads `.cursorrules`, already knows the auth pattern for each role (0 tokens) |
| Agent suggests a change, breaks the other repo, you spend 20 minutes debugging | Agent reads `API_CONTRACTS.md`, knows the exact response shape the other repo expects |

**The vault front-loads context once so you never pay for it again.** Instead of re-explaining your architecture every session, the agent reads 3 markdown files and starts working immediately. Across a team of engineers running multiple sessions per day, this adds up fast.

The cross-repo awareness is where the real savings hit. Without a shared contract document, an agent working in your frontend has no idea what your backend expects. It guesses, gets it wrong, you debug. With `API_CONTRACTS.md`, the agent knows the exact request/response shapes across repo boundaries before writing a single line.

---

## Why This Works for Teams

The vault isn't just documentation — it's a **live shared memory** between every engineer and every agent session on your team.

### Real-time knowledge sharing

When Engineer A discovers something, it's available to Engineer B's agent within minutes:

```
 10:00am  Engineer A's agent tries approach X → fails
 10:01am  Agent prompts: "Log to DECISIONS.md?" → Yes
 10:01am  Agent: git pull → write → commit → push
 10:02am  Obsidian Git syncs on Engineer B's machine
 10:15am  Engineer B starts a new session
 10:15am  Agent reads DECISIONS.md → already knows X doesn't work
 10:15am  Agent suggests approach Y instead → saves an hour of dead-end work
```

This compounds. After a few weeks, `DECISIONS.md` contains dozens of dead ends that no one on the team will ever waste time on again. New engineers get the full institutional knowledge on their first session — their agent reads the same vault and makes the same informed decisions as the most senior person on the team.

### Cross-repo safety net

Most teams break things at repo boundaries. Your frontend engineer changes a response shape, your backend engineer doesn't know, and the integration breaks silently.

The vault prevents this because `API_CONTRACTS.md` is the single source of truth for how repos talk to each other. When Claude Code runs from the workspace root, it sees **all repos at once** and can:

- Verify that a frontend change matches what the backend actually returns
- Warn when an API contract change needs a corresponding update in the other repo
- Trace data flow from one repo through the proxy layer into another

Cursor, scoped to a single repo, still gets cross-repo awareness through the vault — it reads `API_CONTRACTS.md` to understand what the other repo expects without needing to open it.

### The multiplier effect

| Team size | Without vault | With vault |
|-----------|--------------|------------|
| 1 engineer | Re-explain context every session | Context loaded automatically |
| 2 engineers | Same mistakes made twice, integration breaks silently | Decisions shared in real-time, contracts enforced |
| 5 engineers | Knowledge silos, constant "how does X work?" questions | Every agent has full team knowledge from day one |
| New hire | Weeks of onboarding, asking the same questions | Agent reads vault, productive on first session |

---

## What the Script Creates

### Vault files

| File | Purpose | When to update |
|------|---------|----------------|
| `ARCHITECTURE.md` | How your system works — repos, data flow, key structures | When you add a service, change how repos connect, or discover a structural gap |
| `API_CONTRACTS.md` | Every endpoint shape — request, response, errors | When any endpoint changes. This file is the final authority. |
| `DECISIONS.md` | Rejected approaches and non-obvious choices | Automatically prompted by agents mid-session |

### Per-repo agent files

| File | Read by | Purpose |
|------|---------|---------|
| `.cursorrules` | Cursor | Tech stack context, vault pointers, coding patterns |
| `CLAUDE.md` | Claude Code | Vault pointer + any repo-specific agent instructions |

### Auto-detected tech stacks

The script reads your repo files and tailors `.cursorrules` to the right framework:

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

## Obsidian Setup

The vault is designed to be opened in [Obsidian](https://obsidian.md/) (free). After running the setup script:

1. **Open Obsidian** → File → Open Vault → select `your-vault/`
2. **Install the Obsidian Git plugin** → Settings → Community Plugins → Browse → search "Obsidian Git" → Install → Enable
3. **Config is pre-set** — the setup script creates the plugin config automatically

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
3. Enables Obsidian Git with the settings above

The vault syncs via git. When one engineer logs a decision, every other engineer's agent sees it within 1 minute (or immediately if the agent does `git pull` before reading, which the setup configures).

---

## For Teams

### How multi-engineer workflows work

```
Engineer A (Cursor, settled-web)          Engineer B (Cursor, settled-api)
         │                                          │
         ├─ Tries approach X                        │
         ├─ It fails                                │
         ├─ Agent: "Log to DECISIONS.md?"           │
         ├─ Yes → git pull, write, commit, push     │
         │                                          │
         │         ┌──── vault syncs ────┐          │
         │         │                     │          │
         │         ▼                     ▼          │
         │    DECISIONS.md now has:                 │
         │    "Tried X, failed because Y"           │
         │                                          │
         │                     Engineer B starts new session
         │                     Agent reads DECISIONS.md
         │                     Already knows not to try X
```

### What each engineer needs

1. Run `bash setup-workspace.sh` with the same repo URLs
2. Open the vault in Obsidian with Obsidian Git enabled
3. Use Cursor for focused edits, Claude Code for cross-repo work
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

[GitNexus](https://github.com/abhigyanpatwari/GitNexus) indexes your codebase into a knowledge graph and exposes it to AI agents via MCP. It gives Cursor and Claude Code blast radius analysis, execution flow tracing, and safe multi-file renames.

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
| `bash` | Yes | Running the setup script |
| [Obsidian](https://obsidian.md/) | Yes | Opening and editing the vault |
| [Claude Code](https://claude.ai/claude-code) | Recommended | Cross-repo AI reasoning |
| [Cursor](https://cursor.com/) | Recommended | Focused AI-assisted editing |
| `npm` | Optional | For GitNexus code indexing |
| `python3` | Optional | For Graphify structural analysis |

---

## FAQ

**Can I use this with just one repo?**
Yes. The vault still adds value as a persistent memory layer — decisions, architecture notes, and API contracts survive between sessions.

**Does this work with editors other than Cursor?**
The vault and `CLAUDE.md` work with any tool that reads markdown. `.cursorrules` is Cursor-specific, but the same content could be adapted to Windsurf (`.windsurfrules`) or other AI editors.

**How big can DECISIONS.md get?**
At ~100 entries (2-3 months of active development), rotate it: move the current file to `archive/DECISIONS-2024-Q1.md` and start fresh. Agents only read the current file on session start.

**What if two engineers update DECISIONS.md at the same time?**
The setup configures agents to `git pull` before writing and `git push` immediately after. If a conflict still happens, it's a simple text merge — entries are independent blocks.

**Can I add non-code docs to the vault?**
Keep the vault lean. It should contain only files that help agents write better code. Business docs, pitch decks, and partner lists belong elsewhere — they dilute the signal agents read on every session start.

---

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and noncommercial use. Companies need a commercial license. Contact [Joshua Huang](https://github.com/JoshBong) for commercial licensing.
