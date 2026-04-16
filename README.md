<div align="center">

# devnexus

**Your agents start every session with amnesia. devnexus fixes that.**

One command. Shared brain across repos, sessions, and engineers. Decisions survive, context compounds, no one re-discovers dead ends.

Multi-dev AI engineering made easy.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE) [![LinkedIn](https://img.shields.io/badge/LinkedIn-Joshua%20Huang-0A66C2?logo=linkedin)](https://www.linkedin.com/in/jhuang314/)

</div>

---

```bash
npm install -g devnexus

mkdir my-workspace && cd my-workspace
devnexus init
```

That's it. Everything below is created automatically.

```
your-workspace/
├── .ai-rules/                    agent instructions — auto-updated by devnexus
├── ai-profile/                   symlink → ~/.ai-profile/ (global, persists across projects)
├── CLAUDE.md                     yours to customize — never overwritten
├── your-vault/                   Obsidian vault — shared brain
│   ├── MOC.md                    entry point, read every session
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── GRAPH_REPORT.md           structural analysis from Graphify
│   ├── NODE_INDEX.md             navigable code graph — god nodes, communities
│   ├── nodes/                    per-community symbol files (from devnexus index)
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

When one engineer's agent discovers that approach X doesn't work, that knowledge dies when the session ends. The next engineer — or the same engineer tomorrow — wastes time re-discovering the same dead end.

devnexus gives every agent a vault they read before writing any code. Decisions, architecture, and API contracts persist across sessions and engineers. Context compounds instead of resetting.

**What agents get automatically:**
- **Shared memory** — decisions, architecture, and contracts survive across sessions and engineers
- **Cross-repo awareness** — sees how frontend, backend, and database connect through `API_CONTRACTS.md`
- **Decision history** — reads every rejected approach in `DECISIONS.md` before suggesting anything
- **Code graph** — navigable god nodes, communities, and symbol files in the vault via `devnexus index`
- **Contract enforcement** — pre-push git hook blocks pushes when API dirs change without updating `API_CONTRACTS.md`
- **Session continuity** — reads `SESSION_LOG.md` to pick up exactly where the last session left off
- **Personal profile** — reads `~/.ai-profile/` for your style, preferences, and past corrections

---

## Commands

```
devnexus init                     set up a new AI-augmented workspace
devnexus update                   regenerate .ai-rules/ and git hooks with latest templates
devnexus add <repo>               add a repo to an existing workspace
devnexus remove <repo>            remove a repo from workspace tracking
devnexus graphify                 re-run Graphify structural analysis on the workspace
devnexus gitnexus                 run gitnexus analyze on every repo in the workspace
devnexus index                    build navigable code graph in the vault
devnexus status                   workspace health dashboard
devnexus doctor                   deep diagnostic
devnexus doctor --fix             auto-repair common issues
devnexus agent ls                 list agents configured per repo
devnexus agent add <agent>        add an agent (claude, cursor, codex, windsurf)
devnexus agent rm <agent>         remove an agent
```

---

## How It Works

devnexus sets up two things: a **vault** (shared brain) and **agent rules** (instructions that tell your agents how to use it).

**On `devnexus init`:**
1. Creates an Obsidian vault with structured files for architecture, API contracts, decisions, and session handoffs
2. Generates `.ai-rules/` in each repo — agent instructions that are auto-updated by `devnexus update` (you never edit these)
3. Creates pointer files (`CLAUDE.md`, `.cursorrules`, etc.) for each configured agent — yours to customize, never overwritten
4. Installs git hooks for contract drift detection
5. Indexes repos with GitNexus (if installed) for code intelligence

**On every agent session:**
1. Agent reads pointer file → loads `.ai-rules/` → reads vault
2. Knows the architecture, API contracts, and rejected approaches before writing any code
3. Picks up where the last session left off via `SESSION_LOG.md`

**The decision log** is the core loop. When an agent rejects an approach or makes a non-obvious choice, it logs to `DECISIONS.md`. The next session — yours or a teammate's — already knows. No re-discovery.

### What's yours vs. what's managed

| | Yours — edit freely | Managed — don't touch |
|-|--------------------|-----------------------|
| Agent config | Pointer files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `.windsurfrules`) | `.ai-rules/` (regenerated by `devnexus update`) |
| Vault | All vault files — architecture, contracts, decisions | — |
| Git hooks | — | `.git/hooks/pre-push` (reinstalled by `devnexus update`) |

---

## What Gets Created

### Vault files

| File | Purpose | When to update |
|------|---------|----------------|
| `MOC.md` | Entry point — read this first every session | Automatically on `devnexus add` |
| `ARCHITECTURE_OVERVIEW.md` | How your system works | When you add a service or change how repos connect |
| `GRAPH_REPORT.md` | Structural analysis — god nodes, communities, bridges | After running Graphify |
| `NODE_INDEX.md` | Navigable code graph — god nodes, communities, symbol table | After running `devnexus index` |
| `nodes/` | Per-community directories with symbol files and call graphs | After running `devnexus index` |
| `API_CONTRACTS.md` | Every endpoint shape — final authority | When any endpoint changes |
| `DECISIONS.md` | Rejected approaches and non-obvious choices | Auto-prompted by agents mid-session |
| `SESSION_LOG.md` | Two-line session handoff notes | End of each session |

### Global AI profile (`~/.ai-profile/`)

Starts empty, fills in organically as agents learn how you work. Symlinked into the workspace so agents that can't follow paths outside the project can read and write to it.

| File | Purpose |
|------|---------|
| `WORKING_STYLE.md` | How you prefer to work |
| `PREFERENCES.md` | Code taste, commit style, response format |
| `CORRECTIONS.md` | Behavioral corrections — mistakes to never repeat |

---

## Without devnexus vs. with devnexus

| Without | With |
|---------|------|
| Re-explain architecture every session | Agent reads `ARCHITECTURE_OVERVIEW.md` — 0 re-explanation |
| "Don't use Redis, we tried that" — repeated every session | Agent reads `DECISIONS.md`, already knows |
| Agent guesses API shape, gets it wrong, you debug | Agent reads `API_CONTRACTS.md`, knows exact shapes |
| New teammate's agent has no context | Agent reads vault, productive immediately |

---

## For Teams

One engineer's discovery is every engineer's context — within minutes, not meetings.

```
10:00am  Engineer A's agent tries approach X → fails
10:01am  Agent logs to DECISIONS.md → git push
10:01am  Obsidian Git syncs on Engineer B's machine (~1 min)
10:15am  Engineer B starts a new session → agent already knows X doesn't work
```

| Team size | Without devnexus | With devnexus |
|-----------|-----------------|---------------|
| 1 engineer | Re-explain context every session | Context compounds automatically |
| 2-5 engineers | Same mistakes made twice, knowledge silos | Decisions shared in real-time |
| New hire | Weeks of onboarding | Agent reads vault, productive on day one |

**Joining an existing workspace:**

```bash
devnexus init
# "Do you have an existing project vault?" → Yes
# Provide the vault git URL or folder name
# Add your repos, pick your agents — done
```

The vault is never modified during join. Your team's decisions and architecture stay intact.

---

## Optional Integrations

devnexus works on its own. These tools add deeper code intelligence if you want it — devnexus manages them for you.

| Tool | What it adds | How to use |
|------|-------------|------------|
| [Graphify](https://github.com/safishamsi/graphify) | Structural analysis — god nodes, communities, bridges → `GRAPH_REPORT.md` | `devnexus graphify` (fetches + runs automatically) |
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus) | Code intelligence — blast radius, execution flows, safe renames via MCP | Prompted during `devnexus init` — auto-installs if you say yes |
| `devnexus index` | Writes the GitNexus graph into the vault as browsable Obsidian files | Built-in command, no extra install |

None of these are required to get started. For details on each: [Integrations Guide](docs/INTEGRATIONS.md)

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
| [Obsidian](https://obsidian.md/) | Yes | Free markdown editor — used to browse and sync the vault |
| AI agent (Claude Code, Cursor, Windsurf, Codex) | Yes | At least one |
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus) | No | Code intelligence — see [Integrations](docs/INTEGRATIONS.md) |

---

## FAQ

**Do I need to install GitNexus or Graphify separately?**
No. `devnexus init` prompts to install GitNexus for you, and Graphify is fetched automatically. `npm install -g devnexus` + [Obsidian](https://obsidian.md/) are the only setup steps.

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

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and noncommercial use. Contact [Joshua Huang](https://www.linkedin.com/in/jhuang314/) for commercial licensing.
