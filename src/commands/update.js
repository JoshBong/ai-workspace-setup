import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { log, createSpinner } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { detectStack } from '../lib/detect-stack.js';
import { ensureDir, writeFile, migrateExistingPointer, concatenateRules, extractGitNexusBlock, writeManagedPointer } from '../lib/fs-helpers.js';
import { getPointerFilename, getAgentDisplay, isInlineAgent } from '../lib/agents.js';
import * as pointerTemplates from '../templates/pointers.js';
import { TEMPLATE_VERSION } from '../constants.js';
import { installContractHook, installGitNexusHook, installGitNexusPostMergeHook } from '../lib/hooks.js';
import * as workspaceRules from '../templates/workspace-rules.js';
import * as repoRules from '../templates/repo-rules.js';

export function updateCommand() {
  const cmd = new Command('update')
    .description('Regenerate .ai-rules/ with the latest templates')
    .option('--repo <name>', 'Update only a specific repo')
    .option('--force', 'Skip version check')
    .option('--dry-run', 'Show what would change without changing it')
    .action(async (opts) => {
      try {
        await runUpdate(opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runUpdate(opts) {
  log.header('AI Workspace Update');

  const config = requireConfig();
  const { projectName, vaultName, repos = [], agents = [] } = config;

  log.success(`Project: ${projectName}`);
  log.success(`Vault: ${vaultName}`);
  log.success(`Repos: ${repos.join(', ') || '(none)'}`);
  log.success(`Agents: ${agents.join(', ')}`);
  console.log('');

  // Version check
  const currentVersion = getCurrentVersion();
  if (currentVersion === TEMPLATE_VERSION && !opts.force) {
    log.warn(`Agent rules are already at v${TEMPLATE_VERSION}.`);
    log.warn("Use --force to regenerate anyway.");
    return;
  }

  const targetRepos = opts.repo ? [opts.repo] : repos;

  if (opts.dryRun) {
    log.bold('Dry run — nothing will be changed:\n');
    if (!opts.repo) log.plain('Would update: .ai-rules/ (workspace)');
    for (const repo of targetRepos) {
      log.plain(`Would update: ${repo}/.ai-rules/`);
    }
    log.plain(`\nFrom v${currentVersion || '?'} -> v${TEMPLATE_VERSION}`);
    return;
  }

  console.log('');
  const updated = [];

  if (!opts.repo) {
    let s = createSpinner('Updating workspace rules...').start();
    updateWorkspaceRules(vaultName);
    syncInlinePointers(path.resolve('.'), agents);
    s.succeed('Updating workspace rules...');
    updated.push('.ai-rules/ (workspace)');
  }

  for (const repoDir of targetRepos) {
    const absDir = path.resolve(repoDir);
    if (!fs.existsSync(absDir)) {
      log.warn(`Skipping ${repoDir} (not found)`);
      continue;
    }

    const s = createSpinner(`Updating ${repoDir}...`).start();
    const repoStack = detectStack(absDir);
    updateRepoRules(absDir, { projectName, vaultName, repoStack, agents });
    syncInlinePointers(absDir, agents);
    s.succeed(`Updating ${repoDir}...`);
    updated.push(`${repoDir}/.ai-rules/`);
  }

  const s = createSpinner('Saving config...').start();
  config.templateVersion = TEMPLATE_VERSION;
  writeConfig(config);
  s.succeed('Saving config...');

  console.log('');
  console.log(chalk.green.bold(`  ✔ Updated to v${TEMPLATE_VERSION}`));
  console.log('');
  for (const item of updated) {
    console.log(`    ${item}`);
  }
  const inlineAgents = agents.filter(a => isInlineAgent(a));
  if (inlineAgents.length > 0) {
    for (const agent of inlineAgents) {
      console.log(`    ${getPointerFilename(agent)} (${getAgentDisplay(agent)}) — synced`);
    }
  }
  console.log('');
}

function getCurrentVersion() {
  const versionFile = path.resolve('.ai-rules', 'version.txt');
  if (fs.existsSync(versionFile)) {
    return fs.readFileSync(versionFile, 'utf-8').trim();
  }
  return null;
}

function updateWorkspaceRules(vaultName) {
  const rulesDir = path.resolve('.ai-rules');
  const existingRules = preserveExistingRules(rulesDir);

  if (fs.existsSync(rulesDir)) {
    fs.rmSync(rulesDir, { recursive: true });
  }
  ensureDir(rulesDir);

  if (existingRules) writeFile(path.join(rulesDir, '00-existing-rules.md'), existingRules);
  writeFile(path.join(rulesDir, '01-session-start.md'), workspaceRules.sessionStart({ vaultName }));
  writeFile(path.join(rulesDir, '02-vault-rules.md'), workspaceRules.vaultRules({ vaultName }));
  writeFile(path.join(rulesDir, '03-contract-drift.md'), workspaceRules.contractDrift({ vaultName }));
  writeFile(path.join(rulesDir, '04-profile-rules.md'), workspaceRules.profileRules());
  writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');
}

function updateRepoRules(absRepoDir, { projectName, vaultName, repoStack, agents }) {
  const rulesDir = path.join(absRepoDir, '.ai-rules');
  const existingRules = preserveExistingRules(rulesDir);

  if (fs.existsSync(rulesDir)) {
    fs.rmSync(rulesDir, { recursive: true });
  }
  ensureDir(rulesDir);

  // Migrate pointer files that don't reference .ai-rules/
  for (const agent of agents) {
    const filename = getPointerFilename(agent);
    const filePath = path.join(absRepoDir, filename);
    if (migrateExistingPointer(filePath, rulesDir)) {
      const content = pointerTemplates.repoPointer({ repoDir: path.basename(absRepoDir), repoStack });
      writeFile(filePath, content);
    }
  }

  if (existingRules && !fs.existsSync(path.join(rulesDir, '00-existing-rules.md'))) {
    writeFile(path.join(rulesDir, '00-existing-rules.md'), existingRules);
  }
  writeFile(path.join(rulesDir, '00-gate.md'), repoRules.gate());
  writeFile(path.join(rulesDir, '01-source-of-truth.md'), repoRules.sourceOfTruth({ projectName, repoStack, vaultName }));
  writeFile(path.join(rulesDir, '02-decision-logic.md'), repoRules.decisionLogic({ vaultName }));
  writeFile(path.join(rulesDir, '03-contract-drift.md'), repoRules.contractDrift({ vaultName }));
  writeFile(path.join(rulesDir, '04-operator-profile.md'), repoRules.operatorProfile());
  writeFile(path.join(rulesDir, '05-code-intelligence.md'), repoRules.codeIntelligence());
  writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');

  installContractHook(absRepoDir, vaultName);
  installGitNexusHook(absRepoDir);
  installGitNexusPostMergeHook(absRepoDir);
}

function syncInlinePointers(dir, agents) {
  const rulesDir = path.join(dir, '.ai-rules');
  const rules = concatenateRules(rulesDir);

  // Mirror GitNexus block from CLAUDE.md if it exists
  const gnBlock = extractGitNexusBlock(path.join(dir, 'CLAUDE.md'));
  const fullContent = gnBlock ? `${rules}\n\n${gnBlock}` : rules;

  for (const agent of agents) {
    if (!isInlineAgent(agent)) continue;
    const filename = getPointerFilename(agent);
    const filePath = path.join(dir, filename);
    writeManagedPointer(filePath, fullContent);
  }
}

function preserveExistingRules(rulesDir) {
  const existingPath = path.join(rulesDir, '00-existing-rules.md');
  if (fs.existsSync(existingPath)) {
    return fs.readFileSync(existingPath, 'utf-8');
  }
  return null;
}
