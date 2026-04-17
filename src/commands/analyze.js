import { Command } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { log, createSpinner } from '../lib/output.js';
import { requireConfig } from '../lib/config.js';

function runAnalyze(repoDir, workspaceDir) {
  const absDir = path.join(workspaceDir, repoDir);
  if (!fs.existsSync(absDir)) {
    log.warn(`${repoDir} not found — skipping`);
    return;
  }
  const s = createSpinner(`Analyzing ${repoDir}...`).start();
  try {
    execSync('npx gitnexus analyze', { cwd: absDir, stdio: 'pipe', timeout: 120000 });
    s.succeed(`Analyzed ${repoDir}`);
  } catch {
    s.fail(`Failed — run manually: cd ${repoDir} && npx gitnexus analyze`);
  }
}

export function analyzeCommand() {
  const cmd = new Command('analyze')
    .description('Run GitNexus analyze on workspace repos')
    .argument('[target]', 'repo name or "all" (default: all)')
    .action((target) => {
      try {
        const config = requireConfig();
        const { repos = [], vaultName } = config;
        const workspaceDir = process.cwd();

        try {
          execSync('npx gitnexus --version', { stdio: 'pipe', timeout: 5000 });
        } catch {
          log.error('GitNexus not found. Install: npm install -g gitnexus');
          process.exit(1);
        }

        if (repos.length === 0) {
          log.warn('No repos in .workspace-config');
          return;
        }

        const reposToAnalyze = repos.filter(r => r !== vaultName);

        if (!target || target === 'all') {
          for (const repoDir of reposToAnalyze) {
            runAnalyze(repoDir, workspaceDir);
          }
        } else {
          const match = reposToAnalyze.find(r => r === target);
          if (!match) {
            log.error(`"${target}" is not a repo in this workspace. Available: ${reposToAnalyze.join(', ')}`);
            process.exit(1);
          }
          runAnalyze(match, workspaceDir);
        }
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
