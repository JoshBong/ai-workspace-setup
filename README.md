<div align="center">

# devnexus

**Your agents start every session with amnesia. devnexus fixes that.**

One command. Shared brain across repos, sessions, and engineers. Decisions survive, context compounds, no one re-discovers dead ends.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE) [![LinkedIn](https://img.shields.io/badge/LinkedIn-Joshua%20Huang-0A66C2?logo=linkedin)](https://www.linkedin.com/in/jhuang314/)

</div>

---

## Shared brain for AI agents across sessions and engineers.

When one engineer's agent discovers that approach X doesn't work, that knowledge dies when the session ends. The next engineer — or the same engineer tomorrow — re-discovers the same dead end.

devnexus gives every agent a vault they read before writing any code. Decisions, architecture, and API contracts persist across sessions and engineers. Context compounds instead of resetting.

---

## Quick Start

```bash
npm install -g devnexus

mkdir my-project && cd my-project
devnexus init
```

That's it. devnexus creates an Obsidian vault alongside your repos that acts as the shared brain. Your agents read it before writing any code.

---

## Example Setup

```bash
mkdir example-proj && cd example-proj
devnexus init
```

```
? Do you have an existing project vault? No
? What's your project called? example-proj
? Describe your project: Restaurant booking platform with AI recommendations
? What's your tech stack? Next.js + FastAPI + Supabase (or auto-detected from your repos)
? What's your name? Sarah

? Repo: https://github.com/example/frontend.git
? Repo: https://github.com/example/backend.git
? Repo: (enter)

? Which AI agents do you use?
  ◉ claude
  ◯ cursor
  ◯ codex
  ◯ windsurf
```

Open `example-proj-vault/` in Obsidian and run `devnexus index` to generate the code graph. Start coding.

---

## Vault Sync

The vault needs a git remote to sync across machines and teammates.

1. Create a new repo on GitHub (private recommended)
2. Add it as the vault remote:
   ```bash
   cd your-vault
   git remote add origin https://github.com/you/your-vault.git
   git push -u origin main
   ```
3. Open Obsidian → File → Open Vault → select `your-vault/`
4. Settings → Community Plugins → install "Git" (by Vinzent)

The Git plugin is pre-configured by `devnexus init` — auto-commit and auto-pull every minute, push after commit, pull on startup.

---

## For Teams

One engineer's discovery is every engineer's context — within minutes, not meetings.

```
10:00am  Engineer A's agent tries approach X → fails
10:01am  Agent logs to DECISIONS.md → git push
10:01am  Obsidian Git syncs on Engineer B's machine (~1 min)
10:15am  Engineer B starts a new session → agent already knows X doesn't work
```

**Joining an existing workspace:**

```bash
mkdir my-project && cd my-project
devnexus init
# "Do you have an existing project vault?" → Yes
# Provide the vault git URL or local folder name
# Add your repos, pick your agents — done
```

The vault is cloned (or linked) into your workspace. Nothing in it is modified.

---

## Commands

```
devnexus init                     set up a new AI-augmented workspace
devnexus upgrade                  update devnexus and regenerate workspace rules
devnexus update                   regenerate .ai-rules/ and git hooks with latest templates
devnexus add <repo>               add a repo (HTTPS, SSH, or local folder)
devnexus remove <repo>            remove a repo from workspace tracking
devnexus analyze [target]         run GitNexus analyze (all repos or specific repo)
devnexus index                    build code graph, structural analysis, GRAPH_REPORT.md
devnexus index --force            rebuild even if index is up to date
devnexus status                   workspace health dashboard
devnexus doctor                   deep diagnostic
devnexus doctor --fix             auto-repair common issues
devnexus agent ls                 list agents configured per repo
devnexus agent add <agent>        add an agent (claude, cursor, codex, windsurf)
devnexus agent rm <agent>         remove an agent
devnexus completion install       set up shell tab completion (bash/zsh/fish)
devnexus completion uninstall     remove tab completion
```

---

## Integrations

devnexus works on its own. [GitNexus](https://github.com/abhigyanpatwari/GitNexus) adds deeper code intelligence if you want it — devnexus manages it for you.

| Tool | What it adds | How to use |
|------|-------------|------------|
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus) | Code intelligence — blast radius, execution flows, safe renames via MCP | Prompted during `devnexus init` — auto-installs if you say yes |
| `devnexus analyze` | Runs GitNexus analyze on all repos (or a specific one) | Built-in command |
| `devnexus index` | Builds vault code graph, structural analysis, GRAPH_REPORT.md | Built-in command, no extra install |

For details: [Integrations Guide](docs/INTEGRATIONS.md)

---

## Requirements

| | Required | Purpose |
|-|----------|---------|
| `git` | Yes | Vault sync, repo cloning |
| `node` ≥18 | Yes | Running devnexus |
| [Obsidian](https://obsidian.md/) | Yes | Free markdown editor — browse and sync the vault |
| AI agent (Claude Code, Cursor, Windsurf, Codex) | Yes | At least one |
| [GitNexus](https://github.com/abhigyanpatwari/GitNexus) | No | Code intelligence — see [Integrations](docs/INTEGRATIONS.md) |

---

## FAQ

**Can I use this with one repo?**
Yes. The vault still adds value as persistent memory across sessions.

**Should I edit `.ai-rules/`?**
No — it's managed by devnexus. Your customizations belong in pointer files (`CLAUDE.md`, `.cursorrules`, etc.), which are never overwritten.

**How do I add an agent later?**
`devnexus agent add windsurf`. List: `devnexus agent ls`. Remove: `devnexus agent rm cursor`.

**How do I update?**
`devnexus upgrade`. Updates the package and regenerates `.ai-rules/` and git hooks.

**What is the contract drift check?**
A pre-push hook that blocks pushes when API dirs change without updating `API_CONTRACTS.md`. Bypass with `git push --no-verify`.

**Second project?**
`devnexus init` in a new folder. It reuses your existing `~/.ai-profile/`.

---

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and noncommercial use.

For commercial or enterprise licensing, contact [josh@settled.live](mailto:josh@settled.live).
