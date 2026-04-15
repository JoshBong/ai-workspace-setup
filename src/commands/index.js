import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { log } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { buildIndex } from '../lib/index-builder.js';
import { hasIndex } from '../lib/gitnexus-query.js';

export function indexCommand() {
  const cmd = new Command('index')
    .description('Build navigable code graph in the vault from GitNexus data')
    .action(async () => {
      try {
        runIndex();
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

function runIndex() {
  const config = requireConfig();
  const { vaultName, repos = [] } = config;
  const workspaceDir = process.cwd();

  if (repos.length === 0) {
    log.error('No repos configured. Run: devnexus add <repo>');
    process.exit(1);
  }

  // Check GitNexus indexes exist for all repos
  const missing = repos.filter(r => !hasIndex(path.join(workspaceDir, r)));
  if (missing.length > 0) {
    log.error(`Missing GitNexus index for: ${missing.join(', ')}`);
    log.plain('Run for each repo: cd <repo> && npx gitnexus analyze');
    process.exit(1);
  }

  log.header('devnexus index');
  console.log(chalk.dim(`  Querying GitNexus for ${repos.length} repo(s)...\n`));

  const result = buildIndex(workspaceDir, vaultName, repos);

  // Update config with last indexed timestamp
  config.lastIndexed = new Date().toISOString();
  config.indexStats = {
    symbols: result.totalSymbols,
    communities: result.communities,
    godNodes: result.godNodes,
  };
  writeConfig(config);

  console.log('');
  log.success(`${result.totalSymbols} symbols indexed`);
  log.success(`${result.communities} communities detected`);
  log.success(`${result.godNodes} god nodes surfaced`);
  console.log('');
  log.plain(`Vault files written:`);
  log.plain(`  ${vaultName}/NODE_INDEX.md — full symbol table`);
  log.plain(`  ${vaultName}/nodes/ — community directories with symbol files`);
  log.plain(`  ${vaultName}/ARCHITECTURE_OVERVIEW.md — god node summary injected`);
  console.log('');
}
