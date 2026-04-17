# Hot Cache

> Current focus. Read this first. Keep it under 500 words.

## Currently Working On

Evolving the tool to incorporate the full gitnexus/graphify/obsidian schema as the standard for all coding projects.

## What Exists

- `bin/devnexus.js` + `src/` — full Node.js CLI (merged via PR #1)
- Commands: `init`, `update`, `add`, `remove`, `status`, `doctor`, `agent`
- `setup-workspace.sh` + `update-workspace.sh` — legacy bash scripts (kept for reference)
- `README.md` — full product description, use cases, FAQ

## Schema (the three-layer system)

Every coding workspace should have:

1. **Obsidian vault** — shared brain. Files: MOC.md, ARCHITECTURE_OVERVIEW.md, GRAPH_REPORT.md, API_CONTRACTS.md, DECISIONS.md, SESSION_LOG.md
2. **Graphify** (`graphifyy` PyPI) — generates GRAPH_REPORT.md with structural analysis (communities, god nodes, bridges). Run once on large codebases.
3. **GitNexus** (`npm install -g gitnexus`) — live per-repo code graph. MCP server + hooks for blast-radius analysis, search augmentation, safe renames.

Vault-encoder hook (`~/.claude/hooks/vault-encoder/`) injects vault CLAUDE.md context at session start via vault-map.json.

## What Was Just Done

- Added MOC.md + GRAPH_REPORT.md to vault template (`src/templates/vault.js`)
- ARCHITECTURE.md renamed to ARCHITECTURE_OVERVIEW.md with Graphify corpus header
- `devnexus init` now: runs GitNexus analyze per repo, registers vault in vault-map.json, prints Graphify instructions
- `devnexus doctor` now: checks GitNexus index per repo, checks vault-map.json registration

## What's Next

- Update README to document the full three-layer schema (gitnexus + graphify + obsidian)
- Add `devnexus init --graphify` flag to actually run Graphify during init (if Python available)
- Update `src/templates/workspace-rules.js` to reference MOC.md instead of ARCHITECTURE.md in session-start rules
- Update `.ai-rules/` session start to mention GitNexus tools
- Decide: bump version to 2.0.0 for schema changes?
- Test end-to-end `devnexus init` flow

## Open Questions

- Should `devnexus init` check for Python and attempt to run Graphify automatically?
- Distribution: npm publish under `devnexus` package name
