import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { log } from '../lib/output.js';
import { requireConfig, writeConfig } from '../lib/config.js';
import { getPointerFilename, getAgentDisplay } from '../lib/agents.js';
import { isGitRepo, gitHasRemote } from '../lib/git.js';
import { ensureDir, createSymlink, addToGitignore, writeFile, writeFileIfNotExists } from '../lib/fs-helpers.js';
import { detectStack } from '../lib/detect-stack.js';
import { TEMPLATE_VERSION, AI_PROFILE_DIR, GITIGNORE_ENTRIES } from '../constants.js';
import * as profileTemplates from '../templates/profile.js';
import * as repoRules from '../templates/repo-rules.js';
import * as pointerTemplates from '../templates/pointers.js';

export function doctorCommand() {
  const cmd = new Command('doctor')
    .description('Diagnose workspace problems')
    .option('--fix', 'Auto-fix problems that have safe solutions')
    .action(async (opts) => {
      try {
        runDoctor(opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

function runDoctor(opts) {
  log.header('Workspace Doctor');

  const config = requireConfig();
  const { projectName, vaultName, repos = [], agents = [] } = config;

  let passes = 0;
  let warns = 0;
  let fails = 0;
  const fixes = [];

  function pass(msg) { log.pass(msg); passes++; }
  function warn(msg, fix) { log.warnCheck(msg); if (fix) log.fix(fix); warns++; }
  function fail(msg, fix, fixFn) {
    log.fail(msg);
    if (fix) log.fix(fix);
    fails++;
    if (fixFn) fixes.push({ msg, fn: fixFn });
  }

  // 1. Config
  console.log('');
  if (config.version) {
    pass('.workspace-config found and valid (JSON format)');
  } else if (config.migrated) {
    warn('.workspace-config is in legacy bash format', 'aiws doctor --fix will migrate it to JSON');
    fixes.push({
      msg: 'Migrate config to JSON',
      fn: () => {
        delete config.migrated;
        writeConfig(config);
      },
    });
  }

  // 2. AI Profile
  if (fs.existsSync(AI_PROFILE_DIR)) {
    const files = ['WORKING_STYLE.md', 'PREFERENCES.md', 'CORRECTIONS.md'];
    const missing = files.filter(f => !fs.existsSync(path.join(AI_PROFILE_DIR, f)));
    if (missing.length === 0) {
      pass('AI profile exists with all files');
    } else {
      fail(`AI profile missing: ${missing.join(', ')}`, 'aiws doctor --fix', () => {
        const map = {
          'WORKING_STYLE.md': profileTemplates.workingStyle,
          'PREFERENCES.md': profileTemplates.preferences,
          'CORRECTIONS.md': profileTemplates.corrections,
        };
        for (const f of missing) {
          writeFile(path.join(AI_PROFILE_DIR, f), map[f]());
        }
      });
    }
  } else {
    fail('AI profile (~/.ai-profile/) not found', 'aiws init');
  }

  // 3. Profile symlink
  const profileLink = path.resolve('ai-profile');
  if (fs.existsSync(profileLink)) {
    try {
      const target = fs.readlinkSync(profileLink);
      if (fs.existsSync(target) || fs.existsSync(AI_PROFILE_DIR)) {
        pass('AI profile symlink valid');
      } else {
        fail('AI profile symlink points to missing target', 'aiws doctor --fix', () => {
          fs.unlinkSync(profileLink);
          createSymlink(AI_PROFILE_DIR, profileLink);
        });
      }
    } catch {
      warn('ai-profile exists but is not a symlink');
    }
  } else {
    fail('AI profile symlink missing in workspace', 'aiws doctor --fix', () => {
      createSymlink(AI_PROFILE_DIR, profileLink);
    });
  }

  // 4. Vault
  const vaultDir = path.resolve(vaultName);
  if (fs.existsSync(vaultDir)) {
    // Support both old (ARCHITECTURE.md) and new (ARCHITECTURE_OVERVIEW.md + MOC.md) layouts
    const hasNewLayout = fs.existsSync(path.join(vaultDir, 'MOC.md'));
    const expectedFiles = hasNewLayout
      ? ['MOC.md', 'ARCHITECTURE_OVERVIEW.md', 'API_CONTRACTS.md', 'DECISIONS.md', 'SESSION_LOG.md', 'GRAPH_REPORT.md']
      : ['ARCHITECTURE.md', 'API_CONTRACTS.md', 'DECISIONS.md', 'SESSION_LOG.md'];
    const missingVault = expectedFiles.filter(f => !fs.existsSync(path.join(vaultDir, f)));

    if (missingVault.length === 0) {
      pass('Vault exists with all expected files');
    } else {
      warn(`Vault missing: ${missingVault.join(', ')}`);
    }

    if (isGitRepo(vaultDir)) {
      if (gitHasRemote(vaultDir)) {
        pass('Vault has git remote configured');
      } else {
        warn('Vault has no git remote (sync will not work)', `cd ${vaultName} && git remote add origin <url>`);
      }
    } else {
      warn('Vault is not a git repository', `cd ${vaultName} && git init`);
    }
  } else {
    fail(`Vault directory '${vaultName}' not found`, 'aiws init');
  }

  // 5. Workspace .ai-rules/
  const wsRulesDir = path.resolve('.ai-rules');
  if (fs.existsSync(wsRulesDir)) {
    const versionFile = path.join(wsRulesDir, 'version.txt');
    const version = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf-8').trim() : null;

    if (version === TEMPLATE_VERSION) {
      pass(`Workspace .ai-rules/ at v${TEMPLATE_VERSION}`);
    } else {
      fail(
        `.ai-rules/ at v${version || '?'} (latest: v${TEMPLATE_VERSION})`,
        'aiws update'
      );
    }

    // Check expected files
    const expectedRules = ['01-session-start.md', '02-vault-rules.md', '03-contract-drift.md', '04-profile-rules.md'];
    const missingRules = expectedRules.filter(f => !fs.existsSync(path.join(wsRulesDir, f)));
    if (missingRules.length > 0) {
      fail(`Workspace .ai-rules/ missing: ${missingRules.join(', ')}`, 'aiws update');
    }
  } else {
    fail('Workspace .ai-rules/ not found', 'aiws update');
  }

  // 6. Workspace pointer files
  for (const agent of agents) {
    const filename = getPointerFilename(agent);
    const filePath = path.resolve(filename);
    if (fs.existsSync(filePath)) {
      pass(`${filename} exists (${getAgentDisplay(agent)})`);
    } else {
      fail(`${filename} missing (${getAgentDisplay(agent)})`, `aiws agent add ${agent}`, () => {
        const content = pointerTemplates.workspacePointer({ projectName, vaultName, repos });
        writeFileIfNotExists(filePath, content);
      });
    }
  }

  // 7. Each repo
  for (const repoDir of repos) {
    const absDir = path.resolve(repoDir);
    console.log('');
    log.bold(`  ${repoDir}/`);

    if (!fs.existsSync(absDir)) {
      fail(`Directory not found`, `aiws remove ${repoDir}`);
      continue;
    }

    // .ai-rules/
    const repoRulesDir = path.join(absDir, '.ai-rules');
    if (fs.existsSync(repoRulesDir)) {
      const vFile = path.join(repoRulesDir, 'version.txt');
      const v = fs.existsSync(vFile) ? fs.readFileSync(vFile, 'utf-8').trim() : null;
      if (v === TEMPLATE_VERSION) {
        pass(`.ai-rules/ at v${TEMPLATE_VERSION}`);
      } else {
        fail(`.ai-rules/ at v${v || '?'} (latest: v${TEMPLATE_VERSION})`, 'aiws update');
      }
    } else {
      fail('.ai-rules/ not found', `aiws update --repo ${repoDir}`, () => {
        const repoStack = detectStack(absDir);
        ensureDir(repoRulesDir);
        writeFile(path.join(repoRulesDir, '01-source-of-truth.md'), repoRules.sourceOfTruth({ projectName, repoStack, vaultName }));
        writeFile(path.join(repoRulesDir, '02-decision-logic.md'), repoRules.decisionLogic({ vaultName }));
        writeFile(path.join(repoRulesDir, '03-contract-drift.md'), repoRules.contractDrift({ vaultName }));
        writeFile(path.join(repoRulesDir, '04-operator-profile.md'), repoRules.operatorProfile());
        writeFile(path.join(repoRulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');
      });
    }

    // Pointer files
    for (const agent of agents) {
      const filename = getPointerFilename(agent);
      const filePath = path.join(absDir, filename);
      if (fs.existsSync(filePath)) {
        pass(`${filename} exists`);
      } else {
        const repoStack = detectStack(absDir);
        fail(`${filename} missing`, `aiws agent add ${agent} --repo ${repoDir}`, () => {
          const content = pointerTemplates.repoPointer({ repoDir, repoStack });
          writeFileIfNotExists(filePath, content);
        });
      }
    }

    // .gitignore entries
    if (fs.existsSync(path.join(absDir, '.gitignore'))) {
      const gitignore = fs.readFileSync(path.join(absDir, '.gitignore'), 'utf-8');
      const missingEntries = GITIGNORE_ENTRIES.filter(e => !gitignore.includes(e));
      if (missingEntries.length === 0) {
        pass('.gitignore has all required entries');
      } else {
        warn(`.gitignore missing: ${missingEntries.join(', ')}`, 'aiws doctor --fix');
        fixes.push({
          msg: `Add ${missingEntries.join(', ')} to ${repoDir}/.gitignore`,
          fn: () => {
            addToGitignore(absDir, missingEntries);
          },
        });
      }
    }

    // GitNexus index
    const gitNexusDir = path.join(absDir, '.gitnexus');
    const gitNexusMeta = path.join(gitNexusDir, 'meta.json');
    if (fs.existsSync(gitNexusMeta)) {
      try {
        const meta = JSON.parse(fs.readFileSync(gitNexusMeta, 'utf-8'));
        const { nodes = 0, relationships = 0 } = meta.stats || {};
        pass(`GitNexus index: ${nodes} nodes, ${relationships} edges`);
      } catch {
        warn('GitNexus index exists but meta.json is unreadable', `cd ${repoDir} && npx gitnexus analyze`);
      }
    } else {
      warn('No GitNexus index — agents lack blast-radius analysis', `cd ${repoDir} && npx gitnexus analyze`);
    }
  }

  // Vault-map.json registration
  console.log('');
  log.bold('  vault-map.json');
  const vaultMapPath = path.join(os.homedir(), '.claude', 'vault-map.json');
  if (fs.existsSync(vaultMapPath)) {
    try {
      const vaultMap = JSON.parse(fs.readFileSync(vaultMapPath, 'utf-8'));
      if (vaultMap[vaultName]) {
        pass(`${vaultName} registered in ~/.claude/vault-map.json`);
      } else {
        warn(`${vaultName} not in vault-map.json — vault-encoder hook won't inject context`, `Add to ~/.claude/vault-map.json: "${vaultName}": "${path.resolve(vaultName)}"`);
      }
    } catch {
      warn('vault-map.json exists but is not valid JSON');
    }
  } else {
    warn('~/.claude/vault-map.json not found — vault-encoder hook disabled');
  }

  // Summary
  console.log('');
  console.log(chalk.bold('Summary:'));
  console.log(`  ${chalk.green(passes + ' passed')}  ${chalk.yellow(warns + ' warnings')}  ${chalk.red(fails + ' failures')}`);

  // Auto-fix
  if (opts.fix && fixes.length > 0) {
    console.log('');
    log.bold('  Applying fixes...');
    for (const { msg, fn } of fixes) {
      try {
        fn();
        log.success(`Fixed: ${msg}`);
      } catch (err) {
        log.error(`Failed to fix: ${msg} — ${err.message}`);
      }
    }
  } else if (fixes.length > 0) {
    console.log('');
    log.plain(`${fixes.length} issue(s) can be auto-fixed. Run: aiws doctor --fix`);
  }

  console.log('');
}
