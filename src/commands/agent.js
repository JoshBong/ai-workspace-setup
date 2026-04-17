import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { log } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { validateAgents, getPointerFilename, getAgentDisplay, pointerExists } from '../lib/agents.js';
import { writeFileIfNotExists } from '../lib/fs-helpers.js';
import { SUPPORTED_AGENTS } from '../constants.js';
import * as pointerTemplates from '../templates/pointers.js';
import { detectStack } from '../lib/detect-stack.js';
import inquirer from 'inquirer';
import { confirm, promptAgents } from '../lib/prompts.js';

export function agentCommand() {
  const cmd = new Command('agent')
    .description('Manage AI agents. Run with no subcommand for an interactive picker.')
    .action(async () => {
      try {
        await runAgentInteractive();
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command('ls')
    .description('List configured agents and their status per repo')
    .action(() => {
      try {
        runAgentLs();
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command('add')
    .description('Add an agent to the workspace')
    .argument('[agent]', `Agent to add (${SUPPORTED_AGENTS.join(', ')})`)
    .option('--repo <name>', 'Only add to a specific repo')
    .action(async (agent, opts) => {
      try {
        if (!agent) {
          const config = requireConfig();
          const current = config.agents ?? [];
          const available = SUPPORTED_AGENTS.filter(a => !current.includes(a));
          if (available.length === 0) {
            log.plain('All agents are already configured.');
            return;
          }
          const { picked } = await inquirer.prompt([{
            type: 'list',
            name: 'picked',
            message: 'Which agent to add?',
            choices: available,
          }]);
          agent = picked;
        }
        await runAgentAdd(agent, opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  cmd
    .command('rm')
    .description('Remove an agent from the workspace')
    .argument('[agent]', 'Agent to remove')
    .option('--repo <name>', 'Only remove from a specific repo')
    .option('--yes', 'Skip confirmation')
    .action(async (agent, opts) => {
      try {
        if (!agent) {
          const config = requireConfig();
          const current = config.agents ?? [];
          if (current.length === 0) {
            log.plain('No agents configured.');
            return;
          }
          const { picked } = await inquirer.prompt([{
            type: 'list',
            name: 'picked',
            message: 'Which agent to remove?',
            choices: current,
          }]);
          agent = picked;
        }
        await runAgentRm(agent, opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

function runAgentLs() {
  const config = requireConfig();
  const { agents = [], repos = [] } = config;

  console.log('');
  console.log(chalk.bold('Configured agents: ') + agents.join(', '));
  console.log('');

  // Header row
  const nameCol = 22;
  let header = '  ' + 'Repo'.padEnd(nameCol);
  for (const agent of SUPPORTED_AGENTS) {
    header += agent.padEnd(16);
  }
  console.log(chalk.dim(header));
  console.log(chalk.dim('  ' + '-'.repeat(nameCol + SUPPORTED_AGENTS.length * 16)));

  // Workspace root
  let row = '  ' + '(workspace root)'.padEnd(nameCol);
  for (const agent of SUPPORTED_AGENTS) {
    if (!agents.includes(agent)) {
      row += chalk.dim('-'.padEnd(16));
    } else if (pointerExists(process.cwd(), agent)) {
      row += chalk.green(getPointerFilename(agent).padEnd(16));
    } else {
      row += chalk.red('[missing]'.padEnd(16));
    }
  }
  console.log(row);

  // Each repo
  for (const repoDir of repos) {
    const absDir = path.resolve(repoDir);
    row = '  ' + repoDir.padEnd(nameCol);

    if (!fs.existsSync(absDir)) {
      row += chalk.red('(directory not found)');
      console.log(row);
      continue;
    }

    for (const agent of SUPPORTED_AGENTS) {
      if (!agents.includes(agent)) {
        row += chalk.dim('-'.padEnd(16));
      } else if (pointerExists(absDir, agent)) {
        row += chalk.green(getPointerFilename(agent).padEnd(16));
      } else {
        row += chalk.red('[missing]'.padEnd(16));
      }
    }
    console.log(row);
  }

  console.log('');
}

function suggestAgent(input) {
  const lower = input.toLowerCase();
  for (const agent of SUPPORTED_AGENTS) {
    if (agent.startsWith(lower) || lower.startsWith(agent.slice(0, 3))) return agent;
  }
  return null;
}

async function runAgentAdd(agentName, opts) {
  const { valid, invalid } = validateAgents([agentName]);
  if (valid.length === 0) {
    const suggestion = suggestAgent(agentName);
    const hint = suggestion ? ` Did you mean '${suggestion}'?` : '';
    log.error(`Unknown agent '${agentName}'.${hint}\n\nAvailable: ${SUPPORTED_AGENTS.join(', ')}`);
    process.exit(1);
  }

  const agent = valid[0];
  const config = requireConfig();
  const { projectName, vaultName, repos = [], agents = [] } = config;

  // Add to config if not present
  if (!agents.includes(agent)) {
    agents.push(agent);
    config.agents = agents;
    writeConfig(config);
    log.success(`Added ${getAgentDisplay(agent)} to workspace config`);
  }

  const filename = getPointerFilename(agent);
  const targetRepos = opts.repo ? [opts.repo] : repos;

  // Create workspace-level pointer (unless targeting specific repo)
  if (!opts.repo) {
    const wsPointerPath = path.resolve(filename);
    const content = pointerTemplates.workspacePointer({ projectName, vaultName, repos });
    if (writeFileIfNotExists(wsPointerPath, content)) {
      log.success(`Created ${filename} (workspace root)`);
    } else {
      log.warn(`${filename} already exists at workspace root — keeping it`);
    }
  }

  // Create repo-level pointers
  for (const repoDir of targetRepos) {
    const absDir = path.resolve(repoDir);
    if (!fs.existsSync(absDir)) {
      log.warn(`${repoDir}/ not found — skipping`);
      continue;
    }

    const repoStack = detectStack(absDir);
    const filePath = path.join(absDir, filename);
    const content = pointerTemplates.repoPointer({ repoDir, repoStack });

    if (writeFileIfNotExists(filePath, content)) {
      log.success(`Created ${repoDir}/${filename}`);
    } else {
      log.warn(`${repoDir}/${filename} already exists — keeping it`);
    }
  }
}

async function runAgentRm(agentName, opts) {
  const { valid } = validateAgents([agentName]);
  if (valid.length === 0) {
    const suggestion = suggestAgent(agentName);
    const hint = suggestion ? ` Did you mean '${suggestion}'?` : '';
    log.error(`Unknown agent '${agentName}'.${hint}\n\nAvailable: ${SUPPORTED_AGENTS.join(', ')}`);
    process.exit(1);
  }

  const agent = valid[0];
  const config = requireConfig();
  const { repos = [], agents = [] } = config;

  if (!agents.includes(agent)) {
    log.warn(`${getAgentDisplay(agent)} is not in the workspace config.`);
    return;
  }

  if (!opts.yes) {
    const ok = await confirm(`Remove ${getAgentDisplay(agent)} and delete its pointer files?`);
    if (!ok) {
      log.plain('Cancelled.');
      return;
    }
  }

  const filename = getPointerFilename(agent);
  const targetRepos = opts.repo ? [opts.repo] : repos;

  // Remove workspace-level pointer (unless targeting specific repo)
  if (!opts.repo) {
    const wsPath = path.resolve(filename);
    if (fs.existsSync(wsPath)) {
      fs.unlinkSync(wsPath);
      log.success(`Removed ${filename} (workspace root)`);
    }

    // Remove from config
    config.agents = agents.filter(a => a !== agent);
    writeConfig(config);
    log.success(`Removed ${getAgentDisplay(agent)} from workspace config`);
  }

  // Remove repo-level pointers
  for (const repoDir of targetRepos) {
    const filePath = path.join(path.resolve(repoDir), filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log.success(`Removed ${repoDir}/${filename}`);
    }
  }
}

async function runAgentInteractive() {
  const config = requireConfig();
  const current = config.agents ?? [];

  console.log('');
  console.log(chalk.bold('Configured agents: ') + (current.length ? current.join(', ') : chalk.dim('none')));
  console.log('');

  const choices = [
    { name: 'Add an agent', value: 'add' },
    { name: 'Remove an agent', value: 'rm' },
  ];

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What do you want to do?',
    choices,
  }]);

  if (action === 'add') {
    const available = SUPPORTED_AGENTS.filter(a => !current.includes(a));
    if (available.length === 0) {
      log.plain('All agents are already configured.');
      return;
    }
    const { picked } = await inquirer.prompt([{
      type: 'list',
      name: 'picked',
      message: 'Which agent to add?',
      choices: available,
    }]);
    await runAgentAdd(picked, {});
  } else if (action === 'rm') {
    if (current.length === 0) {
      log.plain('No agents configured.');
      return;
    }
    const { picked } = await inquirer.prompt([{
      type: 'list',
      name: 'picked',
      message: 'Which agent to remove?',
      choices: current,
    }]);
    await runAgentRm(picked, {});
  }
}
