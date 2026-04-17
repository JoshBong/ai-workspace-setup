# Git Hooks Reference

devnexus installs three git hooks per tracked repo. They enforce contract consistency and keep the code graph fresh.

## Installed Hooks

| Hook | Trigger | What It Does |
|------|---------|-------------|
| **pre-push** | `git push` | Blocks push if API files changed but `API_CONTRACTS.md` wasn't updated |
| **post-commit** | `git commit` | Runs `gitnexus analyze` to rebuild the code graph |
| **post-merge** | `git pull`, `git merge` | Runs `gitnexus analyze` and warns if symbol count shifted significantly |

## Pre-Push: Contract Drift Detection

### How It Works

1. Diffs the commits being pushed against the remote
2. Checks if any files in API-related directories were modified:
   - `routes/`, `routers/`, `api/`, `endpoints/`, `controllers/`, `schemas/`
3. Checks if `API_CONTRACTS.md` was also modified in the same push
4. If API files changed but the contract didn't → **blocks the push**

### What You See

```
 devnexus: contract drift detected

 API-related files changed:
   - src/routes/users.ts
   - src/schemas/user.ts

 But API_CONTRACTS.md was not updated.

 Options:
   1. Update API_CONTRACTS.md to reflect the changes
   2. Revert the API changes
   3. Skip with: git push --no-verify (not recommended)
```

### Overriding

```bash
git push --no-verify
```

This skips all pre-push hooks. Use when you're certain the API change doesn't affect the contract (e.g., internal refactoring that doesn't change the external shape).

## Post-Commit: Code Graph Refresh

### How It Works

After every commit, runs:

```bash
npx gitnexus analyze
```

This rebuilds the GitNexus knowledge graph for the repo, keeping the index fresh with the latest code changes. Runs silently in the background.

### Requirements

- GitNexus must be installed (`npm install -g gitnexus`)
- If GitNexus isn't available, the hook exits silently without error

## Post-Merge: Symbol Delta Warning

### How It Works

After a pull or merge:

1. Records the symbol count before the merge
2. Runs `npx gitnexus analyze` to rebuild the graph
3. Compares the new symbol count to the previous one
4. If the delta exceeds 10% of the previous count (or >20 symbols) → **warns the user**

### What You See

```
 gitnexus: symbol count changed significantly after merge
   Before: 245 symbols
   After: 289 symbols (+44)

 Consider running: devnexus index
 This refreshes NODE_INDEX.md and vault docs with the latest graph.
```

This is a warning, not a block. The merge already completed. It's telling you that the vault's code graph documentation may be stale and should be refreshed.

## Hook Installation

Hooks are installed automatically by:
- `devnexus init` — during workspace setup
- `devnexus add` — when adding a new repo
- `devnexus update` — when refreshing templates

Hooks are installed to `.git/hooks/` in each tracked repo. They don't conflict with other hooks — devnexus checks for existing hooks and appends rather than overwriting.

## Next Steps

- **How contract enforcement works conceptually** → [Contract Enforcement](../concepts/contract-enforcement.md)
- **Full command reference** → [Commands](commands.md)
- **Workspace configuration** → [Config](config.md)
