# Integrations

Optional tools that add deeper code intelligence to your devnexus workspace. None are required — devnexus works on its own.

---

## Graphify — Structural Analysis

[Graphify](https://github.com/safishamsi/graphify) is an agent skill that maps your workspace into a graph — god nodes, communities, bridges, knowledge gaps — and writes `GRAPH_REPORT.md` to the vault.

`devnexus graphify` fetches the Graphify skill and installs it for each configured agent. It analyzes the workspace and writes `GRAPH_REPORT.md` to your vault. Rerun anytime to refresh the report after major changes.

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

`devnexus init` and `devnexus add` run this automatically if GitNexus is installed, and install a post-commit hook in each repo that keeps the index fresh after every commit. See the [GitNexus docs](https://github.com/abhigyanpatwari/GitNexus) for manual MCP setup per agent.

---

## devnexus index — The Code Graph in Your Vault

Graphify tells you what your codebase looks like structurally — god nodes, communities, bridges. GitNexus lets agents query individual symbols on demand. But neither gives agents a way to *browse* the architecture the way a human browses a codebase.

`devnexus index` closes that gap. It reads the GitNexus graph for every repo in your workspace and writes it into the vault as navigable Obsidian files.

```bash
devnexus index
```

**What gets written:**

- `NODE_INDEX.md` — every symbol in the workspace, sorted by importance. God nodes at the top, then communities, then a full symbol table with tier labels, edge counts, and file paths.
- `nodes/{community}/` — one directory per functional area. Each has a `_COMMUNITY.md` (hub nodes, all members, internal call graph) and individual `.md` files per symbol (callers, callees, cross-references).
- `ARCHITECTURE_OVERVIEW.md` — god node summary and community list injected between markers.

**Why this matters:**

Before `devnexus index`, an agent starting a session could read the vault and know the architecture *as described by humans*. Now it can also see the architecture *as it actually exists in the code* — which symbols are god nodes, which functions call which, how the codebase clusters into functional areas.

When your agent opens a symbol file and sees 14 callers across 3 communities, it knows not to refactor that function without checking the blast radius. When it reads a community's `_COMMUNITY.md` and sees the internal call graph, it understands the module before touching it. That context was always in the code — now it's in the vault where agents already look.

The index wipes and regenerates on every run. Run it after major changes, or whenever `devnexus doctor` tells you it's stale.
