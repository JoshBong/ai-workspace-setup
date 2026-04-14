# AI-Augmented Workspace Setup

A one-script setup for multi-repo workspaces with an Obsidian vault as a shared brain for AI coding agents (Claude Code + Cursor).

## What it does

Creates a workspace where your AI agents share context across repos and remember decisions between sessions:

```
your-workspace/
├── CLAUDE.md              ← Claude Code reads this every session
├── your-vault/            ← Obsidian vault (shared source of truth)
│   ├── ARCHITECTURE.md    ← How the system works
│   ├── API_CONTRACTS.md   ← Endpoint shapes
│   └── DECISIONS.md       ← What was tried, what failed, and why
├── repo-1/
│   ├── .cursorrules       ← Cursor reads this, points to vault
│   └── CLAUDE.md          ← Claude Code reads this inside the repo
└── repo-2/
    ├── .cursorrules
    └── CLAUDE.md
```

## Quick start

```bash
mkdir my-workspace && cd my-workspace
curl -sO https://raw.githubusercontent.com/JoshBong/ai-workspace-setup/main/setup-workspace.sh
bash setup-workspace.sh
```

Or clone this repo and run the script:

```bash
git clone https://github.com/JoshBong/ai-workspace-setup.git
cd ai-workspace-setup
bash setup-workspace.sh
```

The script will prompt you for:
- Project name
- Repo URLs (paste as many as you want, press Enter when done)
- Project description and tech stack
- Your name (for decision log attribution)

## How it works

### The vault (Obsidian)

The vault is the single source of truth. AI agents read it before writing any code.

- **ARCHITECTURE.md** — how your system is designed, how repos connect, key data structures
- **API_CONTRACTS.md** — every endpoint shape. If code and docs disagree, this file wins.
- **DECISIONS.md** — reverse-chronological log of rejected approaches and non-obvious choices. Agents check this before suggesting alternatives you've already tried.

Open the vault in [Obsidian](https://obsidian.md/) and install the **Obsidian Git** community plugin for auto-sync.

### Claude Code (cross-repo reasoning)

Open Claude Code from the workspace root. It reads `CLAUDE.md` on session start which tells it to:

1. Read all three vault files before suggesting anything
2. Prompt you to update the vault when you finish a feature or make a non-obvious decision
3. Capture failed approaches in real-time ("That's worth logging in DECISIONS.md — want me to add it now?")

### Cursor (focused edits)

Open Cursor in a single repo. `.cursorrules` points it to the vault for context and tells it to:

1. Check API contracts before writing code
2. Check DECISIONS.md before proposing alternatives
3. Log failed approaches mid-session

### The split

| Tool | Open from | Use for |
|------|-----------|---------|
| Claude Code | Workspace root | Cross-repo reasoning, vault updates, architecture decisions |
| Cursor | Individual repo | Focused 1-5 file edits, feature implementation |
| Obsidian | Vault folder | Reading/writing docs, auto-syncs via Git plugin |

## What the script auto-detects

The setup script detects your tech stack per repo and tailors `.cursorrules` accordingly:

- **Next.js** / React / Vue / Svelte (from `package.json`)
- **FastAPI** / Django / Flask (from `requirements.txt`)
- **Go** (from `go.mod`)
- **Rust** (from `Cargo.toml`)

## Requirements

- `git`
- `bash`
- [Obsidian](https://obsidian.md/) (free, for the vault)
- [Claude Code](https://claude.ai/claude-code) and/or [Cursor](https://cursor.com/) (for AI agents)
- `npm` (optional, for [GitNexus](https://www.npmjs.com/package/gitnexus) code indexing)

## After setup

1. **Fill in ARCHITECTURE.md** — describe how your system works. This is the most important file.
2. **Add a git remote to the vault** — so it syncs across your team:
   ```bash
   cd your-vault && git remote add origin <url> && git push -u origin main
   ```
3. **Install Obsidian Git plugin** — Settings → Community Plugins → Browse → "Obsidian Git" → Enable. This auto-commits every 5 minutes.
4. **Start coding** — the agents handle the rest.

## For teams

Each engineer runs the setup script with the same repo URLs and vault remote. The vault syncs via git. When one engineer logs a failed approach in DECISIONS.md, every other engineer's agent sees it on their next session start.

## License

MIT
