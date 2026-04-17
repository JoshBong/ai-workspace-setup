import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { log } from '../lib/output.js';
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

  // Update workspace .ai-rules/ (unless targeting a specific repo)
  if (!opts.repo) {
    log.info('Updating workspace .ai-rules/...');
    updateWorkspaceRules(vaultName);
    log.success(`Updated workspace .ai-rules/ -> v${TEMPLATE_VERSION}`);

    // Sync inline agent pointers at workspace level
    syncInlinePointers(path.resolve('.'), agents);
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
    updateRepoRules(absDir, { projectName, vaultName, repoStack, agents });
    syncInlinePointers(absDir, agents);
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

  // Show which inline pointers were synced
  const inlineAgents = agents.filter(a => isInlineAgent(a));
  if (inlineAgents.length > 0) {
    console.log('\nSynced inline rules:');
    for (const agent of inlineAgents) {
      console.log(`  * ${getPointerFilename(agent)} (${getAgentDisplay(agent)})`);
    }
  }

  console.log('\nNot touched:');
  const nonInline = agents.filter(a => !isInlineAgent(a));
  if (nonInline.length > 0) {
    console.log(`  - ${nonInline.map(a => getPointerFilename(a)).join(', ')} (yours to customize)`);
  }
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
      log.success(`Migrated existing ${filename} → .ai-rules/00-existing-rules.md`);
    }
  }

  if (existingRules && !fs.existsSync(path.join(rulesDir, '00-existing-rules.md'))) {
    writeFile(path.join(rulesDir, '00-existing-rules.md'), existingRules);
  }
  writeFile(path.join(rulesDir, '01-source-of-truth.md'), repoRules.sourceOfTruth({ projectName, repoStack, vaultName }));
  writeFile(path.join(rulesDir, '02-decision-logic.md'), repoRules.decisionLogic({ vaultName }));
  writeFile(path.join(rulesDir, '03-contract-drift.md'), repoRules.contractDrift({ vaultName }));
  writeFile(path.join(rulesDir, '04-operator-profile.md'), repoRules.operatorProfile());
  writeFile(path.join(rulesDir, '05-code-intelligence.md'), repoRules.codeIntelligence());
  writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');

  const hookResult = installContractHook(absRepoDir, vaultName);
  if (hookResult.installed) {
    log.success(`${path.basename(absRepoDir)}: contract drift hook ${hookResult.updated ? 'updated' : 'installed'}`);
  }

  const gnHookResult = installGitNexusHook(absRepoDir);
  if (gnHookResult.installed) {
    log.success(`${path.basename(absRepoDir)}: GitNexus post-commit hook ${gnHookResult.updated ? 'updated' : 'installed'}`);
  }

  const gnMergeResult = installGitNexusPostMergeHook(absRepoDir);
  if (gnMergeResult.installed) {
    log.success(`${path.basename(absRepoDir)}: GitNexus post-merge hook ${gnMergeResult.updated ? 'updated' : 'installed'}`);
  }
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
    log.success(`Synced ${filename} (${getAgentDisplay(agent)}) — inline rules`);
  }
}

function preserveExistingRules(rulesDir) {
  const existingPath = path.join(rulesDir, '00-existing-rules.md');
  if (fs.existsSync(existingPath)) {
    return fs.readFileSync(existingPath, 'utf-8');
  }
  return null;
}
