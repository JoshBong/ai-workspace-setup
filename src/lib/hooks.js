import fs from 'fs';
import path from 'path';

const HOOK_MARKER = '# devnexus: contract-drift-hook';

function hookScript(vaultName) {
  return `#!/usr/bin/env bash
${HOOK_MARKER}
# Blocks push when API-related files changed without updating API_CONTRACTS.md
# To skip: git push --no-verify

CONTRACTS_FILE="../${vaultName}/API_CONTRACTS.md"

# Collect changed files across all refs being pushed
CHANGED=""
while read local_ref local_sha remote_ref remote_sha; do
  if [ "$local_sha" = "0000000000000000000000000000000000000000" ]; then
    continue
  fi
  if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
    BASE=$(git merge-base "$local_sha" main 2>/dev/null || git merge-base "$local_sha" master 2>/dev/null || echo "")
    if [ -n "$BASE" ]; then
      CHANGED="$CHANGED $(git diff --name-only "$BASE" "$local_sha" 2>/dev/null)"
    fi
  else
    CHANGED="$CHANGED $(git diff --name-only "$remote_sha" "$local_sha" 2>/dev/null)"
  fi
done

if [ -z "$CHANGED" ]; then
  exit 0
fi

# Check for API-related file changes (directory-based matching)
API_CHANGED=$(echo "$CHANGED" | tr ' ' '\\n' | grep -E "(^|/)(routes?|routers?|api|endpoints?|controllers?|schemas?)(/|$)" | grep -v "^$" | sort -u)

if [ -z "$API_CHANGED" ]; then
  exit 0
fi

# Check if API_CONTRACTS.md was updated in this push
CONTRACTS_UPDATED=$(echo "$CHANGED" | tr ' ' '\\n' | grep -c "API_CONTRACTS\\.md")

if [ "$CONTRACTS_UPDATED" -eq 0 ]; then
  echo ""
  echo "devnexus: contract drift detected — push blocked"
  echo ""
  echo "API-related files changed:"
  echo "$API_CHANGED" | sed 's/^/  /'
  echo ""
  echo "Update $CONTRACTS_FILE then push again."
  echo "If no contract changed: git push --no-verify"
  echo ""
  exit 1
fi

exit 0
`;
}

export function installContractHook(repoAbsDir, vaultName) {
  const gitDir = path.join(repoAbsDir, '.git');
  if (!fs.existsSync(gitDir)) return { installed: false, reason: 'not a git repo' };

  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-push');
  const script = hookScript(vaultName);

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (existing.includes(HOOK_MARKER)) {
      fs.writeFileSync(hookPath, script);
      fs.chmodSync(hookPath, '755');
      return { installed: true, updated: true };
    }
    return { installed: false, reason: 'pre-push hook already exists (not managed by devnexus)' };
  }

  fs.writeFileSync(hookPath, script);
  fs.chmodSync(hookPath, '755');
  return { installed: true, updated: false };
}
