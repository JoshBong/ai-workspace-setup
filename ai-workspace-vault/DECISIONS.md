# Decisions Log

> Reverse-chronological. Rejected approaches, non-obvious choices, dead ends.
> Format: ## YYYY-MM-DD — Title (by [name]) followed by two sentences.

---

## 2026-04-15 — Team onboarding is broken, needs a join flow (by Josh + Claude Code)

`devnexus init` assumes everyone either starts fresh or already has `.workspace-config`. No path for a teammate cloning an existing workspace. If config is gitignored they're stuck — can't init (overwrites vault), can't add/update (no config). Vault file writes use `writeFile()` not `writeFileIfNotExists()`, so a bad init nukes team knowledge. Need a join command or smart init that detects existing vaults. Designing options before building.

---

## 2026-04-14 — Adopted gitnexus/graphify/obsidian as standard coding schema (by Josh)

Every coding project scaffolded by devnexus now includes the full three-layer schema: Obsidian vault (shared brain), Graphify for structural graph analysis (GRAPH_REPORT.md), and GitNexus for live per-repo code graph with MCP tools. Vault-map.json registration is automated so the vault-encoder hook injects context at session start.

## 2026-04-14 — PolyForm Noncommercial license (by Josh)

Chose PolyForm Noncommercial over MIT to allow free personal use while requiring a commercial license for companies. Protects the ability to monetize team/enterprise use cases down the line without restricting the open-source community.
