# Decision System

devnexus splits decisions into two tiers based on whether they reference specific code symbols.

## Symbol-Linked Decisions

When a decision involves specific functions, classes, or types, create an atomic file in `decisions/`:

```markdown
# DealState god node split rejected

Date: 2026-04-16
Author: Josh
Status: ACTIVE
Refs: [[DealState]], [[updateDealStatus]]
Depends: 2026-04-14-dealstate-schema-design.md

---

Considered splitting DealState into separate read/write models. Rejected because
the 39-edge god node bridges 3 communities — splitting it would create 6 new
cross-community edges without reducing betweenness centrality.
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `Date` | Yes | When the decision was made |
| `Author` | Yes | Who made it |
| `Status` | Yes | `ACTIVE`, `SUPERSEDED`, or `STALE` |
| `Refs` | Yes | Wikilinks to symbols in the code graph — triggers backlink injection |
| `Depends` | No | Filename of a prior decision this builds on, reverses, or supersedes |

### File naming

`YYYY-MM-DD-short-slug.md` — e.g., `2026-04-16-dealstate-split-rejected.md`

### What happens on `devnexus index`

1. All files in `decisions/` are parsed
2. `DECISION_INDEX.md` is auto-generated as a table (do not edit)
3. For each `Refs:` symbol found in the graph, a `## Decisions` section is injected into that symbol's node file
4. If all ref'd symbols no longer exist in the graph, the decision is flagged as `STALE` and the file is updated

After index, a symbol's node file looks like:

```markdown
# DealState

> `src/models/deal.ts` · 39 edges · community: lib-dealFlow

## Called By
- [[updateDealStatus]]
- [[getDealById]]

## Calls
- [[validateDeal]]

## Decisions
- [[decisions/2026-04-16-dealstate-split-rejected|DealState god node split rejected]] — ACTIVE
```

Agents see past decisions before they edit. Before they repeat a mistake.

## Project-Level Decisions

Decisions that don't reference specific code symbols — license choices, tooling picks, infra decisions, team process changes — go in `DECISIONS.md` as before:

```markdown
## 2026-04-14 — PolyForm Noncommercial license (by Josh)

Chose PolyForm Noncommercial over MIT to allow free personal use while requiring
a commercial license for companies.
```

Append-only, reverse-chronological. No graph linking.

## When to use which

| Decision is about... | Where it goes |
|----------------------|---------------|
| A specific function, class, type, or module | `decisions/YYYY-MM-DD-slug.md` |
| License, tooling, infra, process | Append to `DECISIONS.md` |
| Not sure | `DECISIONS.md` — you can always move it later |

## Migration

When upgrading from a pre-2.0 workspace, `devnexus update` will:

1. Create the `decisions/` directory with a README
2. Scan existing `DECISIONS.md` entries for code symbol references (camelCase/PascalCase identifiers)
3. Split matching entries into individual files with best-effort `Refs:` extraction
4. Leave project-level entries in `DECISIONS.md`

Review the migrated files — the heuristic is conservative but not perfect. Adjust `Refs:` fields manually if needed.

## Decision chains

The `Depends:` field creates a chain between related decisions. When a later decision reverses or supersedes an earlier one, reference it:

```markdown
Depends: 2026-04-14-dealstate-schema-design.md
```

This is append-only — never edit old decisions. Write new ones that reference them. The chain is human-readable; `devnexus index` does not currently traverse it.
