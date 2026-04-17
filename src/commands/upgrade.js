import { Command } from 'commander';
import { execSync } from 'child_process';
import { log } from '../lib/output.js';

export function upgradeCommand() {
  const cmd = new Command('upgrade')
    .description('Update devnexus to latest version and regenerate workspace rules')
    .option('--skip-rules', 'Only update the package, skip rule regeneration')
    .action(async (opts) => {
      try {
        await runUpgrade(opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runUpgrade(opts) {
  log.info('Updating devnexus...');

  try {
    const output = execSync('npm update -g devnexus', { encoding: 'utf-8', stdio: 'pipe' });
    if (output.trim()) console.log(output.trim());
    log.success('Package updated.');
  } catch (err) {
    log.error('Failed to update package. Try running: npm update -g devnexus');
    throw err;
  }

  if (opts.skipRules) {
    log.info('Skipping rule regeneration (--skip-rules).');
    return;
  }

  // Run devnexus update if inside a workspace
  const { readConfig } = await import('../lib/config.js');
  const config = readConfig();
  if (!config) {
    log.info('Not inside a workspace — package updated, no rules to regenerate.');
    return;
  }

  log.info('Regenerating workspace rules...');
  const { updateCommand } = await import('./update.js');
  const updateCmd = updateCommand();
  await updateCmd.parseAsync(['node', 'devnexus', 'update', '--force'], { from: 'user' });
}
