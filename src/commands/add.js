import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { log } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { detectStack } from '../lib/detect-stack.js';
import { getPointerFilename, getAgentDisplay } from '../lib/agents.js';
import { gitClone } from '../lib/git.js';
import { ensureDir, addToGitignore, writeFile, writeFileIfNotExists } from '../lib/fs-helpers.js';
import { TEMPLATE_VERSION, GITIGNORE_ENTRIES } from '../constants.js';
import { installContractHook, installGitNexusHook } from '../lib/hooks.js';
import { promptAndRunGraphify } from '../lib/graphify.js';
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

  // Warn early if vault is missing
  const vaultDir = path.join(workspaceDir, vaultName);
  if (!fs.existsSync(vaultDir)) {
    log.warn(`Vault '${vaultName}' not found — MOC.md and SESSION_LOG.md will not be updated.`);
    log.warn(`Run 'devnexus init' first if this is a new workspace.`);
  }

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
    writeFile(path.join(rulesDir, '05-code-intelligence.md'), repoRules.codeIntelligence());
    writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');
    log.success(`Created ${dirName}/.ai-rules/`);

    // Install contract drift pre-push hook
    const hookResult = installContractHook(absDir, vaultName);
    if (hookResult.installed) {
      log.success('Installed contract drift pre-push hook');
    } else {
      log.warn(`Pre-push hook: ${hookResult.reason}`);
    }

    // Install GitNexus post-commit hook
    const gnHookResult = installGitNexusHook(absDir);
    if (gnHookResult.installed) {
      log.success('Installed GitNexus post-commit hook');
    } else {
      log.warn(`GitNexus hook: ${gnHookResult.reason}`);
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

    // Run GitNexus if available
    try {
      execSync('npx gitnexus --version', { stdio: 'pipe', timeout: 5000 });
      log.plain(`  Indexing ${dirName} with GitNexus...`);
      try {
        execSync('npx gitnexus analyze', { cwd: absDir, stdio: 'pipe', timeout: 120000 });
        log.success(`GitNexus index built for ${dirName}`);
      } catch {
        log.warn(`GitNexus indexing failed — run manually: npx gitnexus analyze`);
      }
    } catch { /* not installed, skip silently */ }

    // Update MOC.md
    const mocPath = path.join(workspaceDir, vaultName, 'MOC.md');
    if (fs.existsSync(mocPath)) {
      let moc = fs.readFileSync(mocPath, 'utf-8');
      const newRow = `| [[${dirName}]] | Active | |`;
      if (moc.includes('| (add repos) | Active | |')) {
        moc = moc.replace('| (add repos) | Active | |', `${newRow}\n| (add repos) | Active | |`);
      } else {
        // Append after table header separator line
        moc = moc.replace(/(## Active Repos[\s\S]*?\|[-| ]+\|)\n/, `$1\n${newRow}\n`);
      }
      fs.writeFileSync(mocPath, moc, 'utf-8');
      log.success(`Updated MOC.md`);
    }

    // Update SESSION_LOG.md
    const sessionLogPath = path.join(workspaceDir, vaultName, 'SESSION_LOG.md');
    if (fs.existsSync(sessionLogPath)) {
      const date = new Date().toISOString().split('T')[0];
      const entry = `\n## ${date} — Added repo: ${dirName}\n\nAdded ${dirName} to workspace. Configured .ai-rules/, contract drift hook, and agent pointer files.\n`;
      let sessionLog = fs.readFileSync(sessionLogPath, 'utf-8');
      sessionLog = sessionLog.replace('\n(No sessions logged yet.)', '');
      fs.writeFileSync(sessionLogPath, sessionLog.trimEnd() + '\n' + entry, 'utf-8');
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

  // Graphify — once after all repos are processed
  if (added > 0) {
    await promptAndRunGraphify(workspaceDir, vaultName, agents);
  }
}
