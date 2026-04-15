import { Command } from 'commander';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { log } from '../lib/output.js';
import { requireConfig } from '../lib/config.js';

export function gitnexusCommand() {
  const cmd = new Command('gitnexus')
    .description('Run gitnexus analyze on every repo in the workspace')
    .action(() => {
      try {
        const config = requireConfig();
        const { repos = [] } = config;
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

        for (const repoDir of repos) {
          const absDir = path.join(workspaceDir, repoDir);
          if (!fs.existsSync(absDir)) {
            log.warn(`${repoDir} not found — skipping`);
            continue;
          }
          log.plain(`  Indexing ${repoDir}...`);
          try {
            execSync('npx gitnexus analyze', { cwd: absDir, stdio: 'inherit', timeout: 120000 });
            log.success(`GitNexus index built for ${repoDir}`);
          } catch {
            log.warn(`Failed — run manually: cd ${repoDir} && npx gitnexus analyze`);
          }
        }
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
