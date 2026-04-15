import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { log } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { getPointerFilename } from '../lib/agents.js';
import { confirm } from '../lib/prompts.js';

export function removeCommand() {
  const cmd = new Command('remove')
    .description('Remove a repo from workspace tracking')
    .argument('<repo>', 'Repo folder name to remove')
    .option('--clean', 'Also remove .ai-rules/ and pointer files from the repo')
    .option('--yes', 'Skip confirmation')
    .action(async (repo, opts) => {
      try {
        await runRemove(repo, opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runRemove(repo, opts) {
  const config = requireConfig();
  const { repos = [], agents = [] } = config;

  if (!repos.includes(repo)) {
    log.error(`'${repo}' is not in the workspace config.`);
    log.plain(`Tracked repos: ${repos.join(', ') || '(none)'}`);
    process.exit(1);
  }

  if (!opts.yes) {
    const ok = await confirm(`Remove '${repo}' from workspace tracking?`);
    if (!ok) {
      log.plain('Cancelled.');
      return;
    }
  }

  // Remove from config
  config.repos = repos.filter(r => r !== repo);
  writeConfig(config);
  log.success(`Removed '${repo}' from .workspace-config`);

  // Clean up files if requested
  if (opts.clean) {
    const absDir = path.resolve(repo);

    // Remove .ai-rules/
    const rulesDir = path.join(absDir, '.ai-rules');
    if (fs.existsSync(rulesDir)) {
      fs.rmSync(rulesDir, { recursive: true });
      log.success(`Removed ${repo}/.ai-rules/`);
    }

    // Remove pointer files
    for (const agent of agents) {
      const filename = getPointerFilename(agent);
      const filePath = path.join(absDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        log.success(`Removed ${repo}/${filename}`);
      }
    }
  }

  log.plain('');
  log.plain(`Note: The '${repo}/' directory itself was not deleted.`);
  if (!opts.clean) {
    log.plain('Use --clean to also remove .ai-rules/ and pointer files from the repo.');
  }
}
