import fs from 'fs';
import path from 'path';
import {
  queryCommunities,
  querySymbolMembership,
  querySymbolEdges,
  queryCrossCommunityEdges,
  queryCallEdges,
  hasIndex,
} from './gitnexus-query.js';
import {
  GOD_NODE_MAX,
  GOD_NODE_MIN_EDGES,
  GOD_NODE_MIN_COMMUNITIES,
  COMMUNITY_HUB_COUNT,
  INDEX_MARKER_START,
  INDEX_MARKER_END,
  NODES_DIR,
  NODE_INDEX_FILE,
} from '../constants.js';
import { ensureDir, writeFile } from './fs-helpers.js';

/**
 * Build the full index for a workspace.
 * Queries GitNexus for each repo, computes tiers, writes vault files.
 */
export function buildIndex(workspaceDir, vaultName, repos) {
  const vaultDir = path.join(workspaceDir, vaultName);
  const nodesDir = path.join(vaultDir, NODES_DIR);

  // Collect data from all repos
  const repoData = [];
  for (const repo of repos) {
    const repoDir = path.join(workspaceDir, repo);
    if (!hasIndex(repoDir)) {
      throw new Error(`${repo} has no GitNexus index. Run: cd ${repo} && npx gitnexus analyze`);
    }
    repoData.push({ repo, ...queryRepoGraph(repo) });
  }

  // Merge cross-repo data
  const merged = mergeRepoData(repoData);

  // Compute tiers
  const godNodes = computeGodNodes(merged);
  const communities = computeCommunities(merged);

  // Wipe and regenerate nodes/
  if (fs.existsSync(nodesDir)) {
    fs.rmSync(nodesDir, { recursive: true });
  }

  // Write vault files
  writeCommunityDirs(nodesDir, communities, merged);
  writeNodeIndex(vaultDir, godNodes, communities, merged);
  injectArchitectureOverview(vaultDir, godNodes, communities, merged);

  return {
    godNodes: godNodes.length,
    communities: communities.length,
    totalSymbols: merged.symbols.length,
  };
}

/**
 * Query all graph data for a single repo via GitNexus cypher.
 */
function queryRepoGraph(repoName) {
  const communities = queryCommunities(repoName);
  const membership = querySymbolMembership(repoName);
  const edges = querySymbolEdges(repoName);
  const crossEdges = queryCrossCommunityEdges(repoName);
  const calls = queryCallEdges(repoName);

  return { communities, membership, edges, crossEdges, calls };
}

/**
 * Merge data from multiple repos into a single graph view.
 * Namespaces symbols by repo to avoid collisions.
 */
function mergeRepoData(repoData) {
  const allSymbols = [];
  const allCommunities = [];
  const allCalls = [];
  const edgeMap = new Map();      // symbol key -> edge count
  const crossMap = new Map();     // symbol key -> cross-community count
  const membershipMap = new Map(); // symbol key -> { communityId, communityLabel, repo }

  for (const { repo, communities, membership, edges, crossEdges, calls } of repoData) {
    // Communities — namespace by repo
    for (const c of communities) {
      allCommunities.push({ ...c, repo });
    }

    // Membership
    for (const m of membership) {
      const key = `${repo}::${m.name}`;
      membershipMap.set(key, { ...m, repo });
    }

    // Edges
    for (const e of edges) {
      const key = `${repo}::${e.name}`;
      edgeMap.set(key, (edgeMap.get(key) || 0) + e.edges);
      // Also build symbol list
      allSymbols.push({
        name: e.name,
        filePath: e.filePath,
        repo,
        edges: e.edges,
      });
    }

    // Cross-community edges
    for (const c of crossEdges) {
      const key = `${repo}::${c.name}`;
      crossMap.set(key, (crossMap.get(key) || 0) + c.crossCommunities);
    }

    // Calls
    for (const c of calls) {
      allCalls.push({ ...c, repo });
    }
  }

  // Deduplicate symbols (same name+repo can appear from edges query)
  const symbolMap = new Map();
  for (const s of allSymbols) {
    const key = `${s.repo}::${s.name}`;
    if (!symbolMap.has(key) || s.edges > symbolMap.get(key).edges) {
      symbolMap.set(key, s);
    }
  }

  return {
    symbols: Array.from(symbolMap.values()),
    communities: allCommunities,
    calls: allCalls,
    edgeMap,
    crossMap,
    membershipMap,
  };
}

/**
 * Compute god nodes: top N symbols by cross-community reach + edge count.
 * A god node bridges communities — changing it ripples further than it looks.
 */
function computeGodNodes(merged) {
  const { symbols, crossMap, edgeMap, membershipMap } = merged;

  const candidates = symbols
    .map(s => {
      const key = `${s.repo}::${s.name}`;
      const cross = crossMap.get(key) || 0;
      const edges = edgeMap.get(key) || s.edges;
      const membership = membershipMap.get(key);
      return {
        ...s,
        crossCommunities: cross,
        totalEdges: edges,
        communityId: membership?.communityId,
        communityLabel: membership?.communityLabel,
      };
    })
    .filter(s => s.totalEdges >= GOD_NODE_MIN_EDGES || s.crossCommunities >= GOD_NODE_MIN_COMMUNITIES)
    .sort((a, b) => {
      // Primary: cross-community reach. Secondary: total edges. Tertiary: name (stable).
      if (b.crossCommunities !== a.crossCommunities) return b.crossCommunities - a.crossCommunities;
      if (b.totalEdges !== a.totalEdges) return b.totalEdges - a.totalEdges;
      return a.name.localeCompare(b.name);
    })
    .slice(0, GOD_NODE_MAX);

  return candidates;
}

/**
 * Compute communities with file-path-based naming and hub nodes.
 * GitNexus community labels are often useless — derive names from file paths.
 */
function computeCommunities(merged) {
  const { communities: rawCommunities, symbols, membershipMap, edgeMap } = merged;

  // Group symbols by community
  const communitySymbols = new Map(); // "repo::communityId" -> symbols[]

  for (const [key, membership] of membershipMap.entries()) {
    const communityKey = `${membership.repo}::${membership.communityId}`;
    if (!communitySymbols.has(communityKey)) {
      communitySymbols.set(communityKey, []);
    }
    const sepIdx = key.indexOf('::');
    const repo = key.slice(0, sepIdx);
    const name = key.slice(sepIdx + 2);
    const symbol = symbols.find(s => s.repo === repo && s.name === name);
    if (symbol) {
      communitySymbols.get(communityKey).push(symbol);
    }
  }

  const result = [];

  for (const [communityKey, members] of communitySymbols.entries()) {
    const sepIdx2 = communityKey.indexOf('::');
    const repo = communityKey.slice(0, sepIdx2);
    const communityId = communityKey.slice(sepIdx2 + 2);
    const raw = rawCommunities.find(c => c.repo === repo && String(c.id) === String(communityId));

    // Derive name from file path prefixes
    const derivedName = deriveCommunityName(members);

    // Find hub nodes: top N by edge count within this community
    const hubs = [...members]
      .sort((a, b) => b.edges - a.edges || a.name.localeCompare(b.name))
      .slice(0, COMMUNITY_HUB_COUNT);

    result.push({
      id: communityId,
      repo,
      name: derivedName,
      originalLabel: raw?.label || raw?.heuristicLabel || '',
      cohesion: raw?.cohesion || 0,
      symbolCount: members.length,
      hubs,
      members,
    });
  }

  // Sort by symbol count descending
  result.sort((a, b) => b.symbolCount - a.symbolCount);

  // Collect orphan symbols — have edges but no community membership
  const assignedSymbols = new Set();
  for (const c of result) {
    for (const m of c.members) {
      assignedSymbols.add(`${m.repo}::${m.name}`);
    }
  }
  const orphans = merged.symbols.filter(s => !assignedSymbols.has(`${s.repo}::${s.name}`));
  if (orphans.length > 0) {
    // Group orphans by repo
    const byRepo = new Map();
    for (const o of orphans) {
      if (!byRepo.has(o.repo)) byRepo.set(o.repo, []);
      byRepo.get(o.repo).push(o);
    }
    for (const [repo, members] of byRepo.entries()) {
      const hubs = [...members].sort((a, b) => b.edges - a.edges || a.name.localeCompare(b.name)).slice(0, COMMUNITY_HUB_COUNT);
      result.push({
        id: 'uncategorized',
        repo,
        name: byRepo.size > 1 ? `uncategorized-${repo}` : 'uncategorized',
        originalLabel: '',
        cohesion: 0,
        symbolCount: members.length,
        hubs,
        members,
      });
    }
  }

  // Disambiguate colliding names by appending top hub name
  const nameCounts = new Map();
  for (const c of result) {
    nameCounts.set(c.name, (nameCounts.get(c.name) || 0) + 1);
  }
  for (const [name, count] of nameCounts.entries()) {
    if (count <= 1) continue;
    const collisions = result.filter(c => c.name === name);
    for (const c of collisions) {
      const hubName = c.hubs[0]?.name || c.id;
      c.name = `${name}-${hubName}`;
    }
  }

  return result;
}

/**
 * Derive a community name from the file paths of its members.
 * Uses the most common directory prefix.
 */
function deriveCommunityName(members) {
  if (members.length === 0) return 'unknown';

  // Count directory prefixes
  const dirCounts = new Map();
  for (const m of members) {
    if (!m.filePath) continue;
    // Get the meaningful part: e.g., "src/commands" from "src/commands/init.js"
    const dir = path.dirname(m.filePath);
    const parts = dir.split('/').filter(p => p && p !== '.' && p !== 'src');
    const prefix = parts.length > 0 ? parts.join('-') : 'root';
    dirCounts.set(prefix, (dirCounts.get(prefix) || 0) + 1);
  }

  if (dirCounts.size === 0) return 'root';

  // Pick the most common prefix
  const sorted = Array.from(dirCounts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

/**
 * Write community directories and node files.
 * nodes/{community-name}/_COMMUNITY.md + individual symbol files.
 */
function writeCommunityDirs(nodesDir, communities, merged) {
  for (const community of communities) {
    const dirName = sanitizeDirName(community.name);
    const communityDir = path.join(nodesDir, dirName);
    ensureDir(communityDir);

    // Write _COMMUNITY.md
    const communityMd = generateCommunityFile(community, merged);
    writeFile(path.join(communityDir, '_COMMUNITY.md'), communityMd);

    // Write individual node files — detect filename collisions
    const usedFilenames = new Set(['_COMMUNITY']);
    for (const symbol of community.members) {
      const symbolMd = generateSymbolFile(symbol, community, merged);
      let base = sanitizeFilename(symbol.name);
      if (usedFilenames.has(base)) {
        let counter = 2;
        while (usedFilenames.has(`${base}_${counter}`)) counter++;
        base = `${base}_${counter}`;
      }
      usedFilenames.add(base);
      writeFile(path.join(communityDir, base + '.md'), symbolMd);
    }
  }
}

/**
 * Write NODE_INDEX.md — flat table of all symbols with tier, community, edges.
 */
function writeNodeIndex(vaultDir, godNodes, communities, merged) {
  const godSet = new Set(godNodes.map(g => `${g.repo}::${g.name}`));
  const hubSet = new Set();
  for (const c of communities) {
    for (const h of c.hubs) {
      hubSet.add(`${h.repo}::${h.name}`);
    }
  }

  let md = `# Node Index\n\n`;
  md += `> Auto-generated by \`devnexus index\`. Do not edit.\n`;
  md += `> ${merged.symbols.length} symbols · ${communities.length} communities · ${godNodes.length} god nodes\n\n`;

  // God nodes section
  md += `## God Nodes\n\n`;
  md += `> High edge count + cross-community reach. Always read before editing.\n\n`;
  md += `| Symbol | File | Edges | Communities | Repo |\n`;
  md += `|--------|------|-------|-------------|------|\n`;
  for (const g of godNodes) {
    md += `| [[${escapeWikilink(g.name)}]] | \`${g.filePath || ''}\` | ${g.totalEdges} | ${g.crossCommunities} | ${g.repo} |\n`;
  }

  // Communities section
  md += `\n## Communities\n\n`;
  md += `| Community | Symbols | Hubs | Cohesion | Repo |\n`;
  md += `|-----------|---------|------|----------|------|\n`;
  for (const c of communities) {
    const hubNames = c.hubs.map(h => h.name).join(', ');
    md += `| [[${sanitizeDirName(c.name)}/_COMMUNITY]] | ${c.symbolCount} | ${hubNames} | ${c.cohesion.toFixed(2)} | ${c.repo} |\n`;
  }

  // Full symbol table
  md += `\n## All Symbols\n\n`;
  md += `| Symbol | Tier | Community | Edges | File | Repo |\n`;
  md += `|--------|------|-----------|-------|------|------|\n`;

  const sortedSymbols = [...merged.symbols].sort((a, b) => b.edges - a.edges || a.name.localeCompare(b.name));
  for (const s of sortedSymbols) {
    const key = `${s.repo}::${s.name}`;
    let tier = 'regular';
    if (godSet.has(key)) tier = 'god';
    else if (hubSet.has(key)) tier = 'hub';

    const membership = merged.membershipMap.get(key);
    const communityName = membership ? findCommunityName(communities, membership.repo, membership.communityId) : '';

    md += `| [[${escapeWikilink(s.name)}]] | ${tier} | ${communityName} | ${s.edges} | \`${s.filePath || ''}\` | ${s.repo} |\n`;
  }

  writeFile(path.join(vaultDir, NODE_INDEX_FILE), md);
}

/**
 * Inject god node summary into ARCHITECTURE_OVERVIEW.md between markers.
 */
function injectArchitectureOverview(vaultDir, godNodes, communities, merged) {
  const archPath = path.join(vaultDir, 'ARCHITECTURE_OVERVIEW.md');
  if (!fs.existsSync(archPath)) return;

  let content = fs.readFileSync(archPath, 'utf-8');

  // Build the injection block
  let block = `${INDEX_MARKER_START}\n`;
  block += `## Code Graph Summary\n\n`;
  block += `> Auto-generated by \`devnexus index\`. See [[${NODE_INDEX_FILE.replace('.md', '')}]] for full details.\n`;
  block += `> ${merged.symbols.length} symbols · ${communities.length} communities · ${godNodes.length} god nodes\n\n`;

  if (godNodes.length > 0) {
    block += `### God Nodes — Always Read Before Editing\n\n`;
    block += `| Symbol | Edges | Cross-Community | File |\n`;
    block += `|--------|-------|-----------------|------|\n`;
    for (const g of godNodes) {
      block += `| **${g.name}** | ${g.totalEdges} | ${g.crossCommunities} | \`${g.filePath || ''}\` |\n`;
    }
    block += `\n`;
  }

  if (communities.length > 0) {
    block += `### Communities\n\n`;
    for (const c of communities) {
      const hubNames = c.hubs.map(h => `\`${h.name}\``).join(', ');
      block += `- **${c.name}** (${c.symbolCount} symbols) — hubs: ${hubNames}\n`;
    }
    block += `\n`;
  }

  block += `${INDEX_MARKER_END}`;

  // Replace existing block or append
  if (content.includes(INDEX_MARKER_START)) {
    const regex = new RegExp(
      escapeRegex(INDEX_MARKER_START) + '[\\s\\S]*?' + escapeRegex(INDEX_MARKER_END),
      'g'
    );
    content = content.replace(regex, block);
  } else {
    // Append before "## Known Gaps" if it exists, otherwise at the end
    const gapsIndex = content.indexOf('## Known Gaps');
    if (gapsIndex !== -1) {
      content = content.slice(0, gapsIndex) + block + '\n\n' + content.slice(gapsIndex);
    } else {
      content += '\n\n' + block;
    }
  }

  fs.writeFileSync(archPath, content);
}

// --- File generation helpers ---

function generateCommunityFile(community, merged) {
  let md = `# ${community.name}\n\n`;
  md += `> Community in \`${community.repo}\` · ${community.symbolCount} symbols · cohesion: ${community.cohesion.toFixed(2)}\n\n`;

  md += `## Hub Nodes\n\n`;
  for (const hub of community.hubs) {
    md += `- **[[${escapeWikilink(hub.name)}]]** — ${hub.edges} edges · \`${hub.filePath || ''}\`\n`;
  }

  md += `\n## All Symbols\n\n`;
  md += `| Symbol | Edges | File |\n`;
  md += `|--------|-------|------|\n`;
  for (const s of [...community.members].sort((a, b) => b.edges - a.edges || a.name.localeCompare(b.name))) {
    md += `| [[${escapeWikilink(s.name)}]] | ${s.edges} | \`${s.filePath || ''}\` |\n`;
  }

  // Internal call edges
  const memberNames = new Set(community.members.map(m => m.name));
  const internalCalls = merged.calls.filter(
    c => c.repo === community.repo && memberNames.has(c.caller) && memberNames.has(c.callee)
  );
  if (internalCalls.length > 0) {
    md += `\n## Internal Call Graph\n\n`;
    for (const c of internalCalls) {
      md += `- \`${c.caller}\` → \`${c.callee}\`\n`;
    }
  }

  return md;
}

function generateSymbolFile(symbol, community, merged) {
  let md = `# ${symbol.name}\n\n`;
  md += `> \`${symbol.filePath || ''}\` · ${symbol.edges} edges · community: [[${sanitizeDirName(community.name)}/_COMMUNITY|${community.name}]]\n\n`;

  // Callers
  const callers = merged.calls.filter(c => c.callee === symbol.name && c.repo === symbol.repo);
  if (callers.length > 0) {
    md += `## Called By\n\n`;
    for (const c of callers) {
      md += `- [[${escapeWikilink(c.caller)}]]\n`;
    }
    md += `\n`;
  }

  // Callees
  const callees = merged.calls.filter(c => c.caller === symbol.name && c.repo === symbol.repo);
  if (callees.length > 0) {
    md += `## Calls\n\n`;
    for (const c of callees) {
      md += `- [[${escapeWikilink(c.callee)}]]\n`;
    }
    md += `\n`;
  }

  return md;
}

// --- Utilities ---

function sanitizeDirName(name) {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return sanitized || 'unnamed';
}

function sanitizeFilename(name) {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return sanitized || 'unnamed';
}

function escapeWikilink(name) {
  // Obsidian wikilinks break on | [ ] characters
  return name.replace(/[|\[\]]/g, '_');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findCommunityName(communities, repo, communityId) {
  const match = communities.find(cm => cm.repo === repo && String(cm.id) === String(communityId));
  return match ? match.name : '';
}

