import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { log } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { detectStack } from '../lib/detect-stack.js';
import { ensureDir, writeFile } from '../lib/fs-helpers.js';
import { TEMPLATE_VERSION } from '../constants.js';
import { installContractHook, installGitNexusHook } from '../lib/hooks.js';
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

  // Update workspace .ai-rules/ (unless targeting a specific repo)
  if (!opts.repo) {
    log.info('Updating workspace .ai-rules/...');
    updateWorkspaceRules(vaultName);
    log.success(`Updated workspace .ai-rules/ -> v${TEMPLATE_VERSION}`);
  }

  // Update repo .ai-rules/
  for (const repoDir of targetRepos) {
    const absDir = path.resolve(repoDir);
    if (!fs.existsSync(absDir)) {
      log.warn(`Skipping ${repoDir} (not found)`);
      continue;
    }

    log.info(`Updating ${repoDir}/.ai-rules/...`);
    const repoStack = detectStack(absDir);
    updateRepoRules(absDir, { projectName, vaultName, repoStack });
    log.success(`Updated ${repoDir}/.ai-rules/ -> v${TEMPLATE_VERSION}`);
  }

  // Update config version
  config.templateVersion = TEMPLATE_VERSION;
  writeConfig(config);

  log.header('Update Complete!');

  console.log('Updated:');
  if (!opts.repo) console.log('  * .ai-rules/ (workspace)');
  for (const repo of targetRepos) {
    if (fs.existsSync(path.resolve(repo))) {
      console.log(`  * ${repo}/.ai-rules/`);
    }
  }

  console.log('\nNot touched:');
  console.log('  - Your pointer files (CLAUDE.md, .cursorrules, etc.)');
  console.log('  - Your vault content (ARCHITECTURE.md, DECISIONS.md, etc.)');
  console.log('  - Your AI profile (~/.ai-profile/)\n');
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

  // Clean and recreate
  if (fs.existsSync(rulesDir)) {
    fs.rmSync(rulesDir, { recursive: true });
  }
  ensureDir(rulesDir);

  writeFile(path.join(rulesDir, '01-session-start.md'), workspaceRules.sessionStart({ vaultName }));
  writeFile(path.join(rulesDir, '02-vault-rules.md'), workspaceRules.vaultRules({ vaultName }));
  writeFile(path.join(rulesDir, '03-contract-drift.md'), workspaceRules.contractDrift({ vaultName }));
  writeFile(path.join(rulesDir, '04-profile-rules.md'), workspaceRules.profileRules());
  writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');
}

function updateRepoRules(absRepoDir, { projectName, vaultName, repoStack }) {
  const rulesDir = path.join(absRepoDir, '.ai-rules');

  if (fs.existsSync(rulesDir)) {
    fs.rmSync(rulesDir, { recursive: true });
  }
  ensureDir(rulesDir);

  writeFile(path.join(rulesDir, '01-source-of-truth.md'), repoRules.sourceOfTruth({ projectName, repoStack, vaultName }));
  writeFile(path.join(rulesDir, '02-decision-logic.md'), repoRules.decisionLogic({ vaultName }));
  writeFile(path.join(rulesDir, '03-contract-drift.md'), repoRules.contractDrift({ vaultName }));
  writeFile(path.join(rulesDir, '04-operator-profile.md'), repoRules.operatorProfile());
  writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');

  const hookResult = installContractHook(absRepoDir, vaultName);
  if (hookResult.installed) {
    log.success(`${path.basename(absRepoDir)}: contract drift hook ${hookResult.updated ? 'updated' : 'installed'}`);
  }

  const gnHookResult = installGitNexusHook(absRepoDir);
  if (gnHookResult.installed) {
    log.success(`${path.basename(absRepoDir)}: GitNexus hook ${gnHookResult.updated ? 'updated' : 'installed'}`);
  }
}
