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
  DECISIONS_DIR,
  DECISION_INDEX_FILE,
} from '../constants.js';
import { ensureDir, writeFile } from './fs-helpers.js';

/**
 * Build the full index for a workspace.
 * Queries GitNexus for each repo, computes tiers, writes vault files.
 */
export function buildIndex(workspaceDir, vaultName, repos, prevSnapshot = null) {
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

  // Compute betweenness centrality on full call graph
  const bcScores = computeBetweennessCentrality(merged);

  // Compute tiers (now using BC scores)
  const godNodes = computeGodNodes(merged, bcScores);
  const communities = computeCommunities(merged);

  // Detect bridges between communities
  const bridges = detectBridges(merged, communities);

  // Detect knowledge gaps
  const gaps = detectKnowledgeGaps(communities, merged);

  // Compute graph diff from previous snapshot
  const diff = prevSnapshot ? computeGraphDiff(prevSnapshot, { godNodes, communities, symbols: merged.symbols }) : null;

  // Wipe and regenerate nodes/
  if (fs.existsSync(nodesDir)) {
    fs.rmSync(nodesDir, { recursive: true });
  }

  // Parse decisions and build ref map
  const decisions = parseDecisions(vaultDir);
  const decisionRefMap = matchDecisionRefs(decisions, merged);

  // Write vault files
  writeCommunityDirs(nodesDir, communities, merged, decisionRefMap);
  writeNodeIndex(vaultDir, godNodes, communities, merged, bcScores);
  injectArchitectureOverview(vaultDir, godNodes, communities, merged);
  writeGraphReport(vaultDir, godNodes, communities, merged, bcScores, bridges, gaps, diff);
  writeDecisionIndex(vaultDir, decisions);

  // Build snapshot for future diffs
  const snapshot = {
    timestamp: new Date().toISOString(),
    godNodes: godNodes.map(g => ({ name: g.name, repo: g.repo, totalEdges: g.totalEdges, bc: bcScores.get(`${g.repo}::${g.name}`) || 0 })),
    communities: communities.map(c => ({ name: c.name, repo: c.repo, symbolCount: c.symbolCount })),
    symbolCount: merged.symbols.length,
  };

  return {
    godNodes: godNodes.length,
    communities: communities.length,
    totalSymbols: merged.symbols.length,
    bridges: bridges.length,
    gaps: gaps.length,
    decisions: decisions.length,
    staleDecisions: decisions.filter(d => d.status === 'STALE').length,
    hasDiff: !!diff,
    snapshot,
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
      allSymbols.push({
        name: e.name,
        filePath: e.filePath,
        repo,
        edges: e.edges,
      });
    }

    // Include membership symbols not captured by the edges query (zero-edge interfaces, enums, etc.)
    const edgeNames = new Set(edges.map(e => `${repo}::${e.name}`));
    for (const m of membership) {
      const key = `${repo}::${m.name}`;
      if (!edgeNames.has(key)) {
        allSymbols.push({ name: m.name, filePath: m.filePath, repo, edges: 0 });
      }
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
 * Brandes' algorithm for betweenness centrality.
 * O(V·E) — fine for codebases under 10k symbols.
 * Returns Map<symbolKey, bcScore> normalized to [0, 1].
 */
function computeBetweennessCentrality(merged) {
  const { symbols, calls } = merged;

  // Build adjacency list from call graph
  const adj = new Map();
  const allNodes = new Set();

  for (const s of symbols) {
    const key = `${s.repo}::${s.name}`;
    allNodes.add(key);
    if (!adj.has(key)) adj.set(key, []);
  }

  for (const c of calls) {
    const callerKey = `${c.repo}::${c.caller}`;
    const calleeKey = `${c.repo}::${c.callee}`;
    allNodes.add(callerKey);
    allNodes.add(calleeKey);
    if (!adj.has(callerKey)) adj.set(callerKey, []);
    if (!adj.has(calleeKey)) adj.set(calleeKey, []);
    adj.get(callerKey).push(calleeKey);
  }

  const nodes = Array.from(allNodes);
  const bc = new Map();
  for (const n of nodes) bc.set(n, 0);

  for (const s of nodes) {
    const stack = [];
    const pred = new Map();
    const sigma = new Map();
    const dist = new Map();
    const delta = new Map();

    for (const t of nodes) {
      pred.set(t, []);
      sigma.set(t, 0);
      dist.set(t, -1);
      delta.set(t, 0);
    }

    sigma.set(s, 1);
    dist.set(s, 0);
    const queue = [s];

    while (queue.length > 0) {
      const v = queue.shift();
      stack.push(v);
      const neighbors = adj.get(v) || [];
      for (const w of neighbors) {
        if (dist.get(w) < 0) {
          queue.push(w);
          dist.set(w, dist.get(v) + 1);
        }
        if (dist.get(w) === dist.get(v) + 1) {
          sigma.set(w, sigma.get(w) + sigma.get(v));
          pred.get(w).push(v);
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop();
      for (const v of pred.get(w)) {
        const d = (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w));
        delta.set(v, delta.get(v) + d);
      }
      if (w !== s) {
        bc.set(w, bc.get(w) + delta.get(w));
      }
    }
  }

  // Normalize to [0, 1]
  const n = nodes.length;
  const norm = n > 2 ? (n - 1) * (n - 2) : 1;
  for (const [k, v] of bc.entries()) {
    bc.set(k, v / norm);
  }

  return bc;
}

/**
 * Compute god nodes using betweenness centrality as primary signal.
 * BC catches bottleneck nodes that edge count misses.
 */
function computeGodNodes(merged, bcScores) {
  const { symbols, crossMap, edgeMap, membershipMap } = merged;

  const candidates = symbols
    .map(s => {
      const key = `${s.repo}::${s.name}`;
      const cross = crossMap.get(key) || 0;
      const edges = edgeMap.get(key) || s.edges;
      const bc = bcScores.get(key) || 0;
      const membership = membershipMap.get(key);
      return {
        ...s,
        crossCommunities: cross,
        totalEdges: edges,
        bc,
        communityId: membership?.communityId,
        communityLabel: membership?.communityLabel,
      };
    })
    .filter(s => s.totalEdges >= GOD_NODE_MIN_EDGES || s.crossCommunities >= GOD_NODE_MIN_COMMUNITIES || s.bc > 0.05)
    .sort((a, b) => {
      // Primary: betweenness centrality. Secondary: cross-community. Tertiary: edges.
      if (Math.abs(b.bc - a.bc) > 0.001) return b.bc - a.bc;
      if (b.crossCommunities !== a.crossCommunities) return b.crossCommunities - a.crossCommunities;
      if (b.totalEdges !== a.totalEdges) return b.totalEdges - a.totalEdges;
      return a.name.localeCompare(b.name);
    })
    .slice(0, GOD_NODE_MAX);

  return candidates;
}

/**
 * Detect bridge edges — call relationships that are the sole link between two communities.
 * If this edge breaks, those communities lose their connection.
 */
function detectBridges(merged, communities) {
  const { calls, membershipMap } = merged;
  const bridges = [];

  // Build map: community pair -> edges connecting them
  const pairEdges = new Map();

  for (const c of calls) {
    const callerKey = `${c.repo}::${c.caller}`;
    const calleeKey = `${c.repo}::${c.callee}`;
    const callerMem = membershipMap.get(callerKey);
    const calleeMem = membershipMap.get(calleeKey);
    if (!callerMem || !calleeMem) continue;
    if (callerMem.communityId === calleeMem.communityId) continue;

    const pairKey = [callerMem.communityId, calleeMem.communityId].sort().join('::');
    if (!pairEdges.has(pairKey)) pairEdges.set(pairKey, []);
    pairEdges.get(pairKey).push({
      caller: c.caller,
      callee: c.callee,
      repo: c.repo,
      callerCommunity: callerMem.communityId,
      calleeCommunity: calleeMem.communityId,
    });
  }

  // Bridges = community pairs connected by only 1 edge
  for (const [, edges] of pairEdges) {
    if (edges.length === 1) {
      bridges.push(edges[0]);
    }
  }

  return bridges;
}

/**
 * Detect knowledge gaps — communities with structural warning signs.
 */
function detectKnowledgeGaps(communities, merged) {
  const gaps = [];

  for (const c of communities) {
    if (c.id === 'uncategorized') continue;

    // Thin community: too few symbols, might be dead code or undocumented entry points
    if (c.symbolCount <= 2) {
      gaps.push({ type: 'thin', community: c.name, repo: c.repo, detail: `${c.symbolCount} symbols — possible dead code or undocumented entry point` });
    }

    // Low cohesion: symbols are loosely connected internally
    if (c.cohesion < 0.2 && c.symbolCount > 3) {
      gaps.push({ type: 'low-cohesion', community: c.name, repo: c.repo, detail: `cohesion ${c.cohesion.toFixed(2)} — symbols may not belong together` });
    }

    // Oversized community: taking on too much responsibility
    if (c.symbolCount > 50) {
      gaps.push({ type: 'oversized', community: c.name, repo: c.repo, detail: `${c.symbolCount} symbols — likely needs splitting` });
    }

    // No hub nodes with significant edges
    const maxHubEdges = Math.max(0, ...c.hubs.map(h => h.edges));
    if (maxHubEdges < 3 && c.symbolCount > 5) {
      gaps.push({ type: 'flat', community: c.name, repo: c.repo, detail: 'no clear hub — flat structure, hard to find entry points' });
    }
  }

  return gaps;
}

/**
 * Diff current index against a previous snapshot.
 */
function computeGraphDiff(prev, current) {
  const diff = { newGodNodes: [], removedGodNodes: [], communityChanges: [], symbolDelta: 0 };

  const prevGodSet = new Set(prev.godNodes.map(g => `${g.repo}::${g.name}`));
  const currGodSet = new Set(current.godNodes.map(g => `${g.repo}::${g.name}`));

  for (const g of current.godNodes) {
    if (!prevGodSet.has(`${g.repo}::${g.name}`)) {
      diff.newGodNodes.push(g);
    }
  }
  for (const g of prev.godNodes) {
    if (!currGodSet.has(`${g.repo}::${g.name}`)) {
      diff.removedGodNodes.push(g);
    }
  }

  const prevComm = new Map(prev.communities.map(c => [`${c.repo}::${c.name}`, c.symbolCount]));
  for (const c of current.communities) {
    const key = `${c.repo}::${c.name}`;
    const prevCount = prevComm.get(key);
    if (prevCount === undefined) {
      diff.communityChanges.push({ name: c.name, repo: c.repo, change: 'new', count: c.symbolCount });
    } else {
      const delta = c.symbolCount - prevCount;
      if (Math.abs(delta) >= 3) {
        diff.communityChanges.push({ name: c.name, repo: c.repo, change: delta > 0 ? 'grew' : 'shrank', delta, count: c.symbolCount });
      }
    }
  }
  for (const c of prev.communities) {
    const key = `${c.repo}::${c.name}`;
    if (!current.communities.find(cc => `${cc.repo}::${cc.name}` === key)) {
      diff.communityChanges.push({ name: c.name, repo: c.repo, change: 'removed' });
    }
  }

  diff.symbolDelta = current.symbols.length - prev.symbolCount;

  return diff;
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

  // Sort by symbol count descending, then name for stability
  result.sort((a, b) => b.symbolCount - a.symbolCount || a.name.localeCompare(b.name));

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
function writeCommunityDirs(nodesDir, communities, merged, decisionRefMap) {
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
      const symbolDecisions = decisionRefMap.get(symbol.name) || [];
      const symbolMd = generateSymbolFile(symbol, community, merged, symbolDecisions);
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
 * Write NODE_INDEX.md — flat table of all symbols with tier, community, edges, BC.
 */
function writeNodeIndex(vaultDir, godNodes, communities, merged, bcScores) {
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
  md += `| Symbol | File | BC | Edges | Communities | Repo |\n`;
  md += `|--------|------|----|-------|-------------|------|\n`;
  for (const g of godNodes) {
    md += `| [[${escapeWikilink(g.name)}]] | \`${g.filePath || ''}\` | ${g.bc.toFixed(3)} | ${g.totalEdges} | ${g.crossCommunities} | ${g.repo} |\n`;
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
  md += `| Symbol | Tier | Community | BC | Edges | File | Repo |\n`;
  md += `|--------|------|-----------|-----|-------|------|------|\n`;

  const sortedSymbols = [...merged.symbols].sort((a, b) => b.edges - a.edges || a.name.localeCompare(b.name));
  for (const s of sortedSymbols) {
    const key = `${s.repo}::${s.name}`;
    let tier = 'regular';
    if (godSet.has(key)) tier = 'god';
    else if (hubSet.has(key)) tier = 'hub';

    const membership = merged.membershipMap.get(key);
    const communityName = membership ? findCommunityName(communities, membership.repo, membership.communityId) : '';
    const bc = bcScores.get(key) || 0;

    md += `| [[${escapeWikilink(s.name)}]] | ${tier} | ${communityName} | ${bc.toFixed(3)} | ${s.edges} | \`${s.filePath || ''}\` | ${s.repo} |\n`;
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

/**
 * Write GRAPH_REPORT.md — structural analysis with BC, bridges, gaps, and diff.
 */
function writeGraphReport(vaultDir, godNodes, communities, merged, bcScores, bridges, gaps, diff) {
  const date = new Date().toISOString().split('T')[0];
  let md = `# Graph Report\n\n`;
  md += `> Auto-generated by \`devnexus index\`. Do not edit manually.\n`;
  md += `> ${date} · ${merged.symbols.length} symbols · ${communities.length} communities · ${godNodes.length} god nodes\n\n`;

  // Graph diff
  if (diff) {
    md += `## Changes Since Last Index\n\n`;
    if (diff.symbolDelta !== 0) {
      md += `- Symbols: ${diff.symbolDelta > 0 ? '+' : ''}${diff.symbolDelta} (${merged.symbols.length} total)\n`;
    }
    if (diff.newGodNodes.length > 0) {
      md += `- New god nodes: ${diff.newGodNodes.map(g => `**${g.name}**`).join(', ')}\n`;
    }
    if (diff.removedGodNodes.length > 0) {
      md += `- Removed god nodes: ${diff.removedGodNodes.map(g => `~~${g.name}~~`).join(', ')}\n`;
    }
    for (const c of diff.communityChanges) {
      if (c.change === 'new') md += `- New community: **${c.name}** (${c.count} symbols)\n`;
      else if (c.change === 'removed') md += `- Removed community: ~~${c.name}~~\n`;
      else md += `- **${c.name}** ${c.change} by ${Math.abs(c.delta)} → ${c.count} symbols\n`;
    }
    if (diff.newGodNodes.length === 0 && diff.removedGodNodes.length === 0 && diff.communityChanges.length === 0 && diff.symbolDelta === 0) {
      md += `No structural changes detected.\n`;
    }
    md += `\n`;
  }

  // God nodes by betweenness centrality
  md += `## God Nodes (by betweenness centrality)\n\n`;
  md += `> High BC = bottleneck. Many shortest paths route through this node. Always audit before editing.\n\n`;
  md += `| Rank | Symbol | BC | Edges | Cross-Community | File | Repo |\n`;
  md += `|------|--------|----|-------|-----------------|------|------|\n`;
  godNodes.forEach((g, i) => {
    md += `| ${i + 1} | **${g.name}** | ${g.bc.toFixed(3)} | ${g.totalEdges} | ${g.crossCommunities} | \`${g.filePath || ''}\` | ${g.repo} |\n`;
  });

  // Bridges
  md += `\n## Bridges\n\n`;
  md += `> Sole call edge between two communities. If this breaks, those communities disconnect.\n\n`;
  if (bridges.length > 0) {
    md += `| Caller | Callee | Repo |\n`;
    md += `|--------|--------|------|\n`;
    for (const b of bridges) {
      md += `| \`${b.caller}\` | \`${b.callee}\` | ${b.repo} |\n`;
    }
  } else {
    md += `No single-edge bridges detected. All community pairs have redundant connections.\n`;
  }

  // Knowledge gaps
  md += `\n## Knowledge Gaps\n\n`;
  if (gaps.length > 0) {
    md += `| Type | Community | Repo | Detail |\n`;
    md += `|------|-----------|------|--------|\n`;
    for (const g of gaps) {
      md += `| ${g.type} | ${g.community} | ${g.repo} | ${g.detail} |\n`;
    }
  } else {
    md += `No structural warnings detected.\n`;
  }

  // Communities overview
  md += `\n## Communities\n\n`;
  md += `| Community | Symbols | Cohesion | Hubs | Repo |\n`;
  md += `|-----------|---------|----------|------|------|\n`;
  for (const c of communities) {
    const hubNames = c.hubs.map(h => h.name).join(', ');
    md += `| ${c.name} | ${c.symbolCount} | ${c.cohesion.toFixed(2)} | ${hubNames} | ${c.repo} |\n`;
  }

  md += `\n`;
  writeFile(path.join(vaultDir, 'GRAPH_REPORT.md'), md);
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

function generateSymbolFile(symbol, community, merged, decisions = []) {
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

  // Decisions
  if (decisions.length > 0) {
    md += `## Decisions\n\n`;
    for (const d of decisions) {
      md += `- [[decisions/${d.filename}|${d.title}]] — ${d.status}\n`;
    }
    md += `\n`;
  }

  return md;
}

// --- Decision functions ---

function parseDecisions(vaultDir) {
  const decisionsDir = path.join(vaultDir, DECISIONS_DIR);
  if (!fs.existsSync(decisionsDir)) return [];

  const files = fs.readdirSync(decisionsDir)
    .filter(f => f.endsWith('.md') && f !== DECISION_INDEX_FILE && f !== 'README.md');

  const decisions = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(decisionsDir, file), 'utf-8');
    const lines = content.split('\n');

    const decision = { filename: file.replace('.md', ''), title: '', date: '', author: '', status: 'ACTIVE', refs: [], depends: '' };

    // Title from first heading
    const titleLine = lines.find(l => l.startsWith('# '));
    if (titleLine) decision.title = titleLine.slice(2).trim();

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Date:')) decision.date = trimmed.slice(5).trim();
      else if (trimmed.startsWith('Author:')) decision.author = trimmed.slice(7).trim();
      else if (trimmed.startsWith('Status:')) decision.status = trimmed.slice(7).trim();
      else if (trimmed.startsWith('Depends:')) decision.depends = trimmed.slice(8).trim();
      else if (trimmed.startsWith('Refs:')) {
        const refMatches = trimmed.matchAll(/\[\[([^\]]+)\]\]/g);
        for (const match of refMatches) {
          decision.refs.push(match[1]);
        }
      }
    }

    decisions.push(decision);
  }

  return decisions.sort((a, b) => b.date.localeCompare(a.date));
}

function matchDecisionRefs(decisions, merged) {
  const symbolNames = new Set(merged.symbols.map(s => s.name));
  const refMap = new Map(); // symbolName → [decision, ...]

  for (const decision of decisions) {
    let anyRefFound = false;
    for (const ref of decision.refs) {
      if (symbolNames.has(ref)) {
        anyRefFound = true;
        if (!refMap.has(ref)) refMap.set(ref, []);
        refMap.get(ref).push(decision);
      }
    }
    // Mark stale if ALL refs are missing from graph
    if (decision.refs.length > 0 && !anyRefFound && decision.status === 'ACTIVE') {
      decision.status = 'STALE';
    }
  }

  return refMap;
}

function writeDecisionIndex(vaultDir, decisions) {
  const decisionsDir = path.join(vaultDir, DECISIONS_DIR);
  if (!fs.existsSync(decisionsDir)) return;
  if (decisions.length === 0) return;

  // Write back any stale status changes
  for (const d of decisions) {
    if (d.status === 'STALE') {
      const filePath = path.join(decisionsDir, d.filename + '.md');
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');
        content = content.replace(/^Status:\s*ACTIVE$/m, 'Status: STALE');
        fs.writeFileSync(filePath, content);
      }
    }
  }

  let md = `# Decision Index\n\n`;
  md += `> Auto-generated by \`devnexus index\`. Do not edit.\n`;
  md += `> ${decisions.length} decision${decisions.length === 1 ? '' : 's'}\n\n`;
  md += `| Date | Decision | Status | Symbols |\n`;
  md += `|------|----------|--------|---------|\n`;

  for (const d of decisions) {
    const refs = d.refs.length > 0
      ? d.refs.map(r => `[[${escapeWikilink(r)}]]`).join(', ')
      : '—';
    md += `| ${d.date} | [[decisions/${d.filename}|${d.title}]] | ${d.status} | ${refs} |\n`;
  }

  md += `\n`;
  writeFile(path.join(decisionsDir, DECISION_INDEX_FILE), md);
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

