import { Command } from 'commander';
import { createRequire } from 'module';
import { readConfig } from '../lib/config.js';
import { SUPPORTED_AGENTS } from '../constants.js';

const require = createRequire(import.meta.url);
const tabtab = require('tabtab');

const COMMANDS = ['init', 'update', 'status', 'add', 'remove', 'agent', 'analyze', 'index', 'doctor', 'completion'];

export function completionCommand() {
  const cmd = new Command('completion')
    .description('Set up shell tab completion')
    .argument('[action]', 'install or uninstall')
    .action(async (action) => {
      if (action === 'install') {
        await tabtab.install({ name: 'devnexus', completer: 'devnexus' });
      } else if (action === 'uninstall') {
        await tabtab.uninstall({ name: 'devnexus' });
      } else {
        console.log('Usage: devnexus completion install');
        console.log('       devnexus completion uninstall');
      }
    });

  return cmd;
}

export function handleCompletion() {
  const env = tabtab.parseEnv(process.env);
  if (!env.complete) return false;

  const config = readConfig() || {};
  const repos = (config.repos || []).filter(r => r !== config.vaultName);

  if (env.prev === 'devnexus') {
    tabtab.log(COMMANDS);
  } else if (env.prev === 'analyze') {
    tabtab.log(['all', ...repos]);
  } else if (env.prev === 'add') {
    tabtab.log(['--no-clone']);
  } else if (env.prev === 'remove') {
    tabtab.log(config.repos || []);
  } else if (env.prev === 'agent') {
    tabtab.log(['add', 'rm', 'ls']);
  } else if (env.prev === 'add' && env.words > 2) {
    tabtab.log(SUPPORTED_AGENTS);
  } else if (env.prev === 'rm') {
    tabtab.log(config.agents || []);
  } else if (env.prev === 'index') {
    tabtab.log(['--force']);
  } else if (env.prev === 'doctor') {
    tabtab.log(['--fix']);
  } else {
    tabtab.log([]);
  }

  return true;
}
