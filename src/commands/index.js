import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { log, createSpinner } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { buildIndex } from '../lib/index-builder.js';
import { hasIndex } from '../lib/gitnexus-query.js';

export function indexCommand() {
  const cmd = new Command('index')
    .description('Build navigable code graph in the vault from GitNexus data')
    .option('-f, --force', 'rebuild even if index is up to date')
    .action(async (opts) => {
      try {
        runIndex(opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

function isIndexFresh(config, repos, workspaceDir) {
  if (!config.lastIndexed) return false;

  const lastIndexed = new Date(config.lastIndexed).getTime();

  for (const repo of repos) {
    const metaPath = path.join(workspaceDir, repo, '.gitnexus', 'meta.json');
    if (!fs.existsSync(metaPath)) return false;
    const mtime = fs.statSync(metaPath).mtimeMs;
    if (mtime > lastIndexed) return false;
  }

  return true;
}

function runIndex({ force = false } = {}) {
  const config = requireConfig();
  const { vaultName, repos = [] } = config;
  const workspaceDir = process.cwd();

  if (repos.length === 0) {
    log.error('No repos configured. Run: devnexus add <repo>');
    process.exit(1);
  }

  const missing = repos.filter(r => !hasIndex(path.join(workspaceDir, r)));
  if (missing.length > 0) {
    log.error(`Missing GitNexus index for: ${missing.join(', ')}`);
    log.plain('Run for each repo: cd <repo> && npx gitnexus analyze');
    process.exit(1);
  }

  if (!force && isIndexFresh(config, repos, workspaceDir)) {
    log.success('Index is up to date. Use --force to rebuild.');
    return;
  }

  console.log('');
  const s = createSpinner(`Building index from ${repos.length} repo(s)...`).start();

  const prevSnapshot = config.indexSnapshot || null;
  const result = buildIndex(workspaceDir, vaultName, repos, prevSnapshot);

  config.lastIndexed = new Date().toISOString();
  config.indexStats = {
    symbols: result.totalSymbols,
    communities: result.communities,
    godNodes: result.godNodes,
    bridges: result.bridges,
    gaps: result.gaps,
  };
  config.indexSnapshot = result.snapshot;
  writeConfig(config);

  s.succeed(`Index built — ${result.totalSymbols} symbols, ${result.communities} communities, ${result.godNodes} god nodes`);

  if (result.bridges > 0) log.dim(`${result.bridges} bridge edges detected`);
  if (result.gaps > 0) log.warn(`${result.gaps} knowledge gaps found — see GRAPH_REPORT.md`);
  if (result.decisions > 0) log.dim(`${result.decisions} decision${result.decisions === 1 ? '' : 's'} linked (${result.staleDecisions} stale)`);
  if (result.hasDiff) log.dim('Graph diff computed from previous index');
  console.log('');
}
