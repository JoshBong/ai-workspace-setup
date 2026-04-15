import { Command } from 'commander';
import { log } from '../lib/output.js';
import { requireConfig } from '../lib/config.js';
import { promptAndRunGraphify } from '../lib/graphify.js';

export function graphifyCommand() {
  const cmd = new Command('graphify')
    .description('Run Graphify structural analysis on the workspace')
    .action(async () => {
      try {
        const config = requireConfig();
        const workspaceDir = process.cwd();
        await promptAndRunGraphify(workspaceDir, config.vaultName, config.agents || []);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
