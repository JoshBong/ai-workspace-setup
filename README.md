<div align="center">

# devnexus

**Give your AI agents a shared brain across repos.**

One command sets up a multi-repo workspace where your agents share context through an Obsidian vault — decisions, architecture, and API contracts — so they never start from scratch.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)

</div>

---

```bash
npm install -g devnexus

mkdir my-workspace && cd my-workspace
devnexus init
```

```
your-workspace/
├── .ai-rules/                    agent instructions — auto-updated by devnexus
├── ai-profile/                   symlink → ~/.ai-profile/ (global, persists across projects)
├── CLAUDE.md                     yours to customize — never overwritten
├── your-vault/                   Obsidian vault — shared brain
│   ├── MOC.md                    entry point, read every session
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── GRAPH_REPORT.md           structural analysis from Graphify
│   ├── API_CONTRACTS.md          endpoint shapes — final authority
│   ├── DECISIONS.md              rejected approaches, non-obvious choices
│   └── SESSION_LOG.md            two-line handoff notes
├── repo-1/
│   ├── .ai-rules/
│   └── CLAUDE.md
└── repo-2/
    ├── .ai-rules/
    └── CLAUDE.md
```

---

## Why

AI agents start every session with amnesia. They don't know what you tried yesterday, how your repos connect, or why you chose approach A over B. You end up re-explaining the same context every session — and when multiple engineers work in parallel, one person's hard-won discovery dies when their session ends.

devnexus gives agents a vault they read before writing any code. When someone rejects an approach, the agent logs it to `DECISIONS.md`. The next engineer's agent reads it on session start. No one wastes time re-discovering dead ends.

**What agents get automatically:**
- **Context from day one** — reads `~/.ai-profile/` (your style, preferences, corrections) + vault files before doing anything
- **Cross-repo awareness** — sees how frontend, backend, and database connect through `API_CONTRACTS.md`
- **Decision history** — reads every rejected approach in `DECISIONS.md` before suggesting anything
- **Contract enforcement** — pre-push git hook blocks pushes when API dirs change without updating `API_CONTRACTS.md`
- **Session continuity** — reads `SESSION_LOG.md` to pick up exactly where the last session left off

---

## Commands

```
devnexus init                     set up a new AI-augmented workspace
devnexus update                   regenerate .ai-rules/ and git hooks with latest templates
devnexus add <repo>               add a repo to an existing workspace
devnexus remove <repo>            remove a repo from workspace tracking
devnexus graphify                 re-run Graphify structural analysis on the workspace
devnexus gitnexus                 run gitnexus analyze on every repo in the workspace
devnexus status                   workspace health dashboard
devnexus doctor                   deep diagnostic
devnexus doctor --fix             auto-repair common issues
devnexus agent ls                 list agents configured per repo
devnexus agent add <agent>        add an agent (claude, cursor, codex, windsurf)
devnexus agent rm <agent>         remove an agent
```

---

## How It Works

### Two-layer agent instructions

**`.ai-rules/`** (script-owned, auto-updated by `devnexus update`):

| File | Purpose |
|------|---------|
| `01-session-start.md` | What to read on session start, vault workflow |
| `02-vault-rules.md` | How to write to and maintain vault files |
| `03-contract-drift.md` | Pre-push contract drift check logic |
| `04-profile-rules.md` | When and how to update `~/.ai-profile/` |
| `version.txt` | Tracks which release generated these rules |

**Pointer files** (yours — never overwritten):

| File | Agent |
|------|-------|
| `CLAUDE.md` | Claude Code |
| `.cursorrules` | Cursor |
| `AGENTS.md` | Codex |
| `.windsurfrules` | Windsurf |

This split means you get updated rules without losing your custom notes.

### Three layers

```
┌─────────────────────────────────────────────────────────┐
│  AI PROFILE (~/.ai-profile/)                            │
│  Global — persists across all projects                  │
│  Working style, preferences, corrections                │
├─────────────────────────────────────────────────────────┤
│  AGENT (workspace root or individual repo)              │
│  Reads pointer → .ai-rules/ → vault → profile           │
├─────────────────────────────────────────────────────────┤
│  OBSIDIAN VAULT (shared brain)                          │
│  Architecture, contracts, decisions, session log        │
│  Auto-commits/pulls every 1 min via Obsidian Git        │
└─────────────────────────────────────────────────────────┘
```

### Where to work from

**Workspace root** — cross-repo work. Agent reads workspace-level pointer, loads `.ai-rules/` + vault. Use this for anything that touches multiple repos.

**Inside a repo** — focused work. Agent reads repo-level pointer, still reads the vault. Use this for features and bug fixes within one codebase.

### The decision log

`DECISIONS.md` is a reverse-chronological log of rejected approaches and non-obvious choices:

```markdown
## 2024-03-15 — Rejected Redis for caching (by Sarah)

Evaluated Redis for API response caching. Rejected because our Supabase plan
includes edge caching and adding Redis doubles infrastructure cost for marginal
latency improvement.
```

Agents read this on session start. When Sarah's agent suggests Redis next week, it already knows why that was rejected. Entries are auto-prompted — you don't need to remember to write them.

---

## What Gets Created

### Vault files

| File | Purpose | When to update |
|------|---------|----------------|
| `MOC.md` | Entry point — read this first every session | Automatically on `devnexus add` |
| `ARCHITECTURE_OVERVIEW.md` | How your system works | When you add a service or change how repos connect |
| `GRAPH_REPORT.md` | Structural analysis — god nodes, communities, bridges | After running Graphify |
| `API_CONTRACTS.md` | Every endpoint shape — final authority | When any endpoint changes |
| `DECISIONS.md` | Rejected approaches and non-obvious choices | Auto-prompted by agents mid-session |
| `SESSION_LOG.md` | Two-line session handoff notes | End of each session |

### Global AI profile (`~/.ai-profile/`)

Starts empty, fills in organically as agents learn how you work. Symlinked into the workspace so Cursor (which can't follow paths outside the project) can read and write to it.

| File | Purpose |
|------|---------|
| `WORKING_STYLE.md` | How you prefer to work |
| `PREFERENCES.md` | Code taste, commit style, response format |
| `CORRECTIONS.md` | Behavioral corrections — mistakes to never repeat |

---

## Token Savings

| Without vault | With vault |
|--------------|------------|
| Re-explain architecture every session (200+ tokens) | Agent reads `ARCHITECTURE_OVERVIEW.md` once, 0 re-explanation |
| "Don't use Redis, we tried that" (50 tokens, repeated) | Agent reads `DECISIONS.md`, already knows |
| Agent guesses API shape, gets it wrong, you debug | Agent reads `API_CONTRACTS.md`, knows exact response shapes |

---

## For Teams

When Engineer A discovers something, it's available to Engineer B's agent within minutes:

```
10:00am  Engineer A's agent tries approach X → fails
10:01am  Agent: "Log to DECISIONS.md?" → Yes → git push
10:01am  Obsidian Git syncs on Engineer B's machine (~1 min)
10:15am  Engineer B starts a new session
10:15am  Agent reads vault → already knows X doesn't work
```

| Team size | Without vault | With vault |
|-----------|--------------|------------|
| 1 engineer | Re-explain context every session | Context loaded automatically |
| 2 engineers | Same mistakes made twice | Decisions shared in real-time |
| 5 engineers | Knowledge silos, constant "how does X work?" | Every agent has full team knowledge |
| New hire | Weeks of onboarding | Agent reads vault, productive on day one |

---

## Graphify — Structural Analysis

[Graphify](https://github.com/safishamsi/graphify) is a Claude Code skill that maps your workspace into a graph — god nodes, communities, bridges, knowledge gaps — and writes `GRAPH_REPORT.md` to the vault.

`devnexus graphify` installs Graphify and wires the skill into Claude Code. Then generate the report from inside Claude Code:

```
/graphify .
```

Claude will analyze the workspace and write `GRAPH_REPORT.md` to your vault. Rerun anytime with `/graphify .` to refresh the report after major changes.

**What you get:**
- **God nodes** — data structures where a single change ripples through dozens of files
- **Communities** — clusters of tightly coupled code to understand together
- **Bridge nodes** — types that connect otherwise separate parts of the system
- **Knowledge gaps** — isolated functions, thin clusters, undocumented dependencies

| Trigger | Why |
|---------|-----|
| After `devnexus init` or `devnexus add` | Prompted automatically |
| Weekly or start of sprint | Catch architectural drift |
| Before touching a god node | See the blast radius |
| After a major refactor | Verify community boundaries |

---

## GitNexus — Code Intelligence

[GitNexus](https://github.com/abhigyanpatwari/GitNexus) indexes each repo into a knowledge graph and exposes it via MCP. Gives agents blast radius analysis, execution flow tracing, and safe multi-file renames.

```bash
npm install -g gitnexus

# Index a repo manually
cd your-repo && npx gitnexus analyze
```

`devnexus init` and `devnexus add` run this automatically if GitNexus is installed, and install a post-commit hook in each repo that keeps the index fresh after every commit.

**Claude Code:**
```bash
claude mcp add gitnexus -- npx -y gitnexus@latest mcp
```

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "gitnexus": { "command": "npx", "args": ["-y", "gitnexus@latest", "mcp"] }
  }
}
```

---

## Updating

```bash
npm update -g devnexus
cd my-workspace
devnexus update
```

Regenerates all `.ai-rules/` and reinstalls git hooks. Never touches pointer files, vault contents, AI profile, or `.workspace-config`.

---

## Obsidian Setup

1. Open Obsidian → File → Open Vault → select `your-vault/`
2. Settings → Community Plugins → enable "Obsidian Git"

The plugin is pre-configured by `devnexus init` — auto-commit and auto-pull every minute, push after commit, pull on startup.

---

## Requirements

| | Required | Purpose |
|-|----------|---------|
| `git` | Yes | Vault sync, repo cloning |
| `node` ≥18 | Yes | Running devnexus |
| [Obsidian](https://obsidian.md/) | Yes | Opening the vault |
| `python3` | Optional | Graphify structural analysis |
| [Claude Code](https://claude.ai/claude-code) | Optional | AI agent |
| [Cursor](https://cursor.com/) | Optional | AI agent |
| [Windsurf](https://codeium.com/windsurf) | Optional | AI agent |

---

## FAQ

**Can I use this with one repo?**
Yes. The vault still adds value as persistent memory — decisions, architecture, and contracts survive between sessions.

**Should I edit `.ai-rules/`?**
No — it's managed by devnexus. Your customizations belong in pointer files (`CLAUDE.md`, `.cursorrules`, etc.), which are never overwritten.

**How do I add an agent later?**
`devnexus agent add windsurf`. See what's installed: `devnexus agent ls`. Remove: `devnexus agent rm cursor`.

**How do I get updated rules?**
`npm update -g devnexus` then `devnexus update`. Regenerates `.ai-rules/` and git hooks without touching anything else.

**What is the contract drift check?**
A git pre-push hook installed in each repo's `.git/hooks/`. On every push, it checks whether API-related directories changed without `API_CONTRACTS.md` being updated — if so, it blocks the push. Bypass consciously with `git push --no-verify`.

**How big can DECISIONS.md get?**
At ~100 entries, rotate it: move to `archive/DECISIONS-2024-Q1.md` and start fresh.

**What if two engineers write to DECISIONS.md simultaneously?**
Agents `git pull` before writing and push immediately after. If a conflict still happens, it's a simple text merge — entries are independent blocks.

**How do I start a second project?**
`devnexus init` in a new folder. It reuses your existing `~/.ai-profile/` — your agent already knows your preferences from day one.

---

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and noncommercial use. Contact [Joshua Huang](https://github.com/JoshBong) for commercial licensing.
