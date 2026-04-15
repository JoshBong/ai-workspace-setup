import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { log } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { detectStack } from '../lib/detect-stack.js';
import { getPointerFilename, getAgentDisplay } from '../lib/agents.js';
import { gitClone } from '../lib/git.js';
import { ensureDir, addToGitignore, writeFile, writeFileIfNotExists } from '../lib/fs-helpers.js';
import { TEMPLATE_VERSION, GITIGNORE_ENTRIES } from '../constants.js';
import { installContractHook } from '../lib/hooks.js';
import * as repoRules from '../templates/repo-rules.js';
import * as pointerTemplates from '../templates/pointers.js';

export function addCommand() {
  const cmd = new Command('add')
    .description('Add repo(s) to an existing workspace')
    .argument('<repos...>', 'Repo URLs or folder names to add')
    .option('--no-clone', 'Skip git clone, just configure existing directories')
    .action(async (repos, opts) => {
      try {
        await runAdd(repos, opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runAdd(repos, opts) {
  const config = requireConfig();
  const { projectName, vaultName, agents = [], repos: existingRepos = [] } = config;
  const workspaceDir = process.cwd();
  let added = 0;

  for (const repo of repos) {
    const isUrl = repo.startsWith('http') || repo.startsWith('git@');
    const dirName = isUrl ? path.basename(repo, '.git') : repo;

    // Check if already tracked
    if (existingRepos.includes(dirName)) {
      log.warn(`${dirName} is already in the workspace config — skipping`);
      continue;
    }

    // Clone if URL
    if (isUrl && opts.clone !== false) {
      const targetPath = path.join(workspaceDir, dirName);
      if (fs.existsSync(targetPath)) {
        log.warn(`${dirName} directory already exists, skipping clone`);
      } else {
        try {
          log.plain(`Cloning ${repo}...`);
          gitClone(repo, workspaceDir);
        } catch (err) {
          log.error(`Failed to clone ${repo}: ${err.message}`);
          continue;
        }
      }
    }

    // Validate directory exists
    const absDir = path.join(workspaceDir, dirName);
    if (!fs.existsSync(absDir)) {
      log.error(`Directory '${dirName}' not found — skipping`);
      continue;
    }

    // Detect stack
    const repoStack = detectStack(absDir);
    log.success(`Detected: ${repoStack}`);

    // Create .ai-rules/
    const rulesDir = path.join(absDir, '.ai-rules');
    ensureDir(rulesDir);
    writeFile(path.join(rulesDir, '01-source-of-truth.md'), repoRules.sourceOfTruth({ projectName, repoStack, vaultName }));
    writeFile(path.join(rulesDir, '02-decision-logic.md'), repoRules.decisionLogic({ vaultName }));
    writeFile(path.join(rulesDir, '03-contract-drift.md'), repoRules.contractDrift({ vaultName }));
    writeFile(path.join(rulesDir, '04-operator-profile.md'), repoRules.operatorProfile());
    writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');
    log.success(`Created ${dirName}/.ai-rules/`);

    // Install contract drift pre-push hook
    const hookResult = installContractHook(absDir, vaultName);
    if (hookResult.installed) {
      log.success('Installed contract drift pre-push hook');
    } else {
      log.warn(`Pre-push hook: ${hookResult.reason}`);
    }

    // Create pointer files
    for (const agent of agents) {
      const filename = getPointerFilename(agent);
      const filePath = path.join(absDir, filename);
      const content = pointerTemplates.repoPointer({ repoDir: dirName, repoStack });

      if (writeFileIfNotExists(filePath, content)) {
        log.success(`Created ${filename} (${getAgentDisplay(agent)})`);
      }
    }

    // Update .gitignore
    const gitignoreAdded = addToGitignore(absDir, GITIGNORE_ENTRIES);
    for (const entry of gitignoreAdded) {
      log.success(`Added ${entry} to .gitignore`);
    }

    // Add to config
    existingRepos.push(dirName);
    added++;
    log.success(`Added ${dirName} to workspace\n`);
  }

  // Save updated config
  if (added > 0) {
    config.repos = existingRepos;
    writeConfig(config);
    log.success(`Updated .workspace-config (${existingRepos.length} repos total)`);
  }
}
