import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { log } from '../lib/output.js';
import { writeConfig, readConfig } from '../lib/config.js';
import { detectStack } from '../lib/detect-stack.js';
import { validateAgents, getPointerFilename, getAgentDisplay } from '../lib/agents.js';
import { gitClone, gitInit, gitAddAll, gitCommit, isGitRepo } from '../lib/git.js';
import { ensureDir, createSymlink, addToGitignore, writeFile, writeFileIfNotExists } from '../lib/fs-helpers.js';
import { promptProjectInfo, promptRepos, promptAgents } from '../lib/prompts.js';
import { TEMPLATE_VERSION, AI_PROFILE_DIR, GITIGNORE_ENTRIES } from '../constants.js';
import * as profileTemplates from '../templates/profile.js';
import * as vaultTemplates from '../templates/vault.js';
import * as obsidianTemplates from '../templates/obsidian.js';
import * as workspaceRules from '../templates/workspace-rules.js';
import * as repoRules from '../templates/repo-rules.js';
import * as pointers from '../templates/pointers.js';
import { installContractHook } from '../lib/hooks.js';

export function initCommand() {
  const cmd = new Command('init')
    .description('Set up a new AI-augmented workspace')
    .option('--name <name>', 'Project name')
    .option('--repos <repos...>', 'Repo URLs or folder names')
    .option('--agents <agents...>', 'AI agents to configure (claude, cursor, codex, windsurf)')
    .option('--desc <description>', 'Project description')
    .option('--stack <stack>', 'Tech stack description')
    .option('--author <name>', 'Your name (for attribution)')
    .option('--no-clone', 'Skip git clone, just configure existing directories')
    .option('--dry-run', 'Show what would be created without creating it')
    .action(async (opts) => {
      try {
        await runInit(opts);
      } catch (err) {
        log.error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

async function runInit(opts) {
  log.header('AI-Augmented Workspace Setup');

  const existing = readConfig();
  if (existing) {
    log.warn('This directory already has a .workspace-config.');
    log.warn("Use 'aiws update' to refresh rules, or 'aiws add' to add repos.");
    process.exit(1);
  }

  // Gather config — from flags or interactive prompts
  let projectName, description, techStack, author, repoInputs, agents;

  const isInteractive = !opts.name;

  if (isInteractive) {
    const info = await promptProjectInfo();
    projectName = info.projectName;
    description = info.description;
    techStack = info.techStack;
    author = info.author;

    repoInputs = await promptRepos();
    agents = await promptAgents();
  } else {
    projectName = opts.name;
    description = opts.desc || 'A software project.';
    techStack = opts.stack || 'Not specified';
    author = opts.author || 'Engineer';
    repoInputs = opts.repos || [];

    const agentInput = opts.agents || ['claude'];
    const { valid, invalid } = validateAgents(agentInput);
    for (const inv of invalid) log.warn(`Unknown agent '${inv}' — skipping`);
    agents = valid.length > 0 ? valid : ['claude'];
  }

  const vaultName = `${projectName}-vault`;
  const workspaceDir = process.cwd();
  const date = new Date().toISOString().split('T')[0];

  if (opts.dryRun) {
    printDryRun({ projectName, vaultName, repoInputs, agents, workspaceDir });
    return;
  }

  // Step 1: Global AI profile
  log.step('Step 1', 'Global AI profile');
  setupProfile();

  // Symlink profile into workspace
  const profileLink = path.join(workspaceDir, 'ai-profile');
  if (createSymlink(AI_PROFILE_DIR, profileLink)) {
    log.success(`Linked ./ai-profile → ~/.ai-profile/`);
  } else {
    log.success('AI profile symlink already exists');
  }

  // Step 2: Clone/validate repos
  log.step('Step 2', 'Setting up repos');
  const repoDirs = [];
  for (const repo of repoInputs) {
    const dir = await setupRepo(repo, workspaceDir, opts.clone);
    if (dir) repoDirs.push(dir);
  }

  if (repoDirs.length === 0 && repoInputs.length > 0) {
    log.warn('No repos were set up successfully.');
  }

  // Step 3: Create Obsidian vault
  log.step('Step 3', `Creating Obsidian vault (${vaultName})`);
  createVault({ vaultName, projectName, description, techStack, author, date, workspaceDir });

  // Step 4: Create workspace .ai-rules/
  log.step('Step 4', 'Creating workspace agent rules');
  createWorkspaceRules(vaultName, workspaceDir);

  // Step 5: Create workspace pointer files
  log.step('Step 5', 'Creating workspace pointer files');
  createWorkspacePointers({ projectName, vaultName, repoDirs, agents, workspaceDir });

  // Step 6: Set up each repo
  log.step('Step 6', 'Setting up agent files in repos');
  for (const repoDir of repoDirs) {
    setupRepoFiles({
      repoDir, projectName, vaultName, agents, workspaceDir,
    });
  }

  // Step 7: Save config
  log.step('Step 7', 'Saving workspace config');
  writeConfig({
    projectName,
    vaultName,
    repos: repoDirs,
    agents,
    techStack,
    description,
    author,
    templateVersion: TEMPLATE_VERSION,
  });
  log.success('Saved .workspace-config');

  // Step 8: GitNexus (optional — per repo code graph)
  checkGitNexus(repoDirs, workspaceDir);

  // Step 9: Register vault in vault-map.json (for vault-encoder hook)
  registerVaultMap(vaultName, path.join(workspaceDir, vaultName));

  // Step 10: Graphify instructions
  printGraphifyInstructions(vaultName);

  // Done!
  printSummary({ projectName, vaultName, repoDirs, agents, workspaceDir });
}

function setupProfile() {
  if (!fs.existsSync(AI_PROFILE_DIR)) {
    ensureDir(AI_PROFILE_DIR);
    writeFile(path.join(AI_PROFILE_DIR, 'WORKING_STYLE.md'), profileTemplates.workingStyle());
    writeFile(path.join(AI_PROFILE_DIR, 'PREFERENCES.md'), profileTemplates.preferences());
    writeFile(path.join(AI_PROFILE_DIR, 'CORRECTIONS.md'), profileTemplates.corrections());
    log.success('Created ~/.ai-profile/ — starts empty, fills in as you work');
  } else {
    log.success('Found existing AI profile at ~/.ai-profile/ — keeping it');
  }
}

async function setupRepo(repo, workspaceDir, shouldClone) {
  const isUrl = repo.startsWith('http') || repo.startsWith('git@');

  if (isUrl && shouldClone !== false) {
    const dirName = path.basename(repo, '.git');
    const targetPath = path.join(workspaceDir, dirName);

    if (fs.existsSync(targetPath)) {
      log.warn(`${dirName} already exists, skipping clone`);
      return dirName;
    }

    try {
      log.plain(`Cloning ${repo}...`);
      gitClone(repo, workspaceDir);
      return dirName;
    } catch (err) {
      log.error(`Failed to clone ${repo}: ${err.message}`);
      return null;
    }
  } else {
    const dirName = isUrl ? path.basename(repo, '.git') : repo;
    if (fs.existsSync(path.join(workspaceDir, dirName))) {
      log.success(`Found existing folder: ${dirName}`);
      return dirName;
    } else {
      log.error(`Folder '${dirName}' not found — skipping`);
      return null;
    }
  }
}

function createVault({ vaultName, projectName, description, techStack, author, date, workspaceDir }) {
  const vaultDir = path.join(workspaceDir, vaultName);

  ensureDir(vaultDir);
  ensureDir(path.join(vaultDir, '.obsidian'));
  ensureDir(path.join(vaultDir, '.obsidian', 'plugins', 'obsidian-git'));
  ensureDir(path.join(vaultDir, 'archive'));

  // Obsidian config
  writeFile(path.join(vaultDir, '.obsidian', 'app.json'), obsidianTemplates.appJson());
  writeFile(path.join(vaultDir, '.obsidian', 'core-plugins.json'), obsidianTemplates.corePlugins());
  writeFile(path.join(vaultDir, '.obsidian', 'community-plugins.json'), obsidianTemplates.communityPlugins());
  writeFile(path.join(vaultDir, '.obsidian', 'plugins', 'obsidian-git', 'data.json'), obsidianTemplates.gitPluginData());
  writeFile(path.join(vaultDir, '.obsidian', 'appearance.json'), obsidianTemplates.appearance());
  writeFile(path.join(vaultDir, '.gitignore'), obsidianTemplates.vaultGitignore());

  // Vault content
  const repos = []; // populated later — MOC updated post-clone
  writeFile(path.join(vaultDir, 'MOC.md'), vaultTemplates.moc({ projectName, vaultName, repos, date }));
  writeFile(path.join(vaultDir, 'ARCHITECTURE_OVERVIEW.md'), vaultTemplates.architecture({ projectName, description, techStack, date }));
  writeFile(path.join(vaultDir, 'API_CONTRACTS.md'), vaultTemplates.apiContracts({ date }));
  writeFile(path.join(vaultDir, 'DECISIONS.md'), vaultTemplates.decisions({ date, author }));
  writeFile(path.join(vaultDir, 'SESSION_LOG.md'), vaultTemplates.sessionLog());
  writeFile(path.join(vaultDir, 'GRAPH_REPORT.md'), vaultTemplates.graphReport({ projectName, date }));

  log.success(`Created ${vaultName}/ with MOC.md, ARCHITECTURE_OVERVIEW.md, GRAPH_REPORT.md, API_CONTRACTS.md, DECISIONS.md, SESSION_LOG.md`);

  // Init git in vault
  if (!isGitRepo(vaultDir)) {
    gitInit(vaultDir);
    gitAddAll(vaultDir);
    try {
      gitCommit(vaultDir, 'vault: initial setup');
      log.success('Initialized git in vault');
    } catch {
      log.warn('Git init succeeded but initial commit failed (check your git signing config)');
      log.warn('You can commit manually: cd ' + vaultName + ' && git commit -m "vault: initial setup"');
    }
    log.warn(`Add a remote: cd ${vaultName} && git remote add origin <your-vault-repo-url> && git push -u origin main`);
  } else {
    log.success('Vault already has git initialized');
  }
}

function createWorkspaceRules(vaultName, workspaceDir) {
  const rulesDir = path.join(workspaceDir, '.ai-rules');
  ensureDir(rulesDir);

  writeFile(path.join(rulesDir, '01-session-start.md'), workspaceRules.sessionStart({ vaultName }));
  writeFile(path.join(rulesDir, '02-vault-rules.md'), workspaceRules.vaultRules({ vaultName }));
  writeFile(path.join(rulesDir, '03-contract-drift.md'), workspaceRules.contractDrift({ vaultName }));
  writeFile(path.join(rulesDir, '04-profile-rules.md'), workspaceRules.profileRules());
  writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');

  log.success('Created .ai-rules/ with agent instructions');
}

function createWorkspacePointers({ projectName, vaultName, repoDirs, agents, workspaceDir }) {
  for (const agent of agents) {
    const filename = getPointerFilename(agent);
    const filePath = path.join(workspaceDir, filename);
    const content = pointers.workspacePointer({ projectName, vaultName, repos: repoDirs });

    if (writeFileIfNotExists(filePath, content)) {
      log.success(`Created ${filename} (${getAgentDisplay(agent)})`);
    } else {
      log.warn(`${filename} already exists — keeping it`);
    }
  }
}

function setupRepoFiles({ repoDir, projectName, vaultName, agents, workspaceDir }) {
  const absRepoDir = path.join(workspaceDir, repoDir);
  if (!fs.existsSync(absRepoDir)) return;

  console.log('');
  log.bold(`  ${repoDir}/`);

  const repoStack = detectStack(absRepoDir);

  // Create .ai-rules/
  const rulesDir = path.join(absRepoDir, '.ai-rules');
  ensureDir(rulesDir);

  writeFile(path.join(rulesDir, '01-source-of-truth.md'), repoRules.sourceOfTruth({ projectName, repoStack, vaultName }));
  writeFile(path.join(rulesDir, '02-decision-logic.md'), repoRules.decisionLogic({ vaultName }));
  writeFile(path.join(rulesDir, '03-contract-drift.md'), repoRules.contractDrift({ vaultName }));
  writeFile(path.join(rulesDir, '04-operator-profile.md'), repoRules.operatorProfile());
  writeFile(path.join(rulesDir, 'version.txt'), TEMPLATE_VERSION + '\n');

  log.success('Created .ai-rules/');

  // Install contract drift pre-push hook
  const hookResult = installContractHook(absRepoDir, vaultName);
  if (hookResult.installed) {
    log.success('Installed contract drift pre-push hook');
  } else {
    log.warn(`Pre-push hook: ${hookResult.reason}`);
  }

  // Create pointer files
  for (const agent of agents) {
    const filename = getPointerFilename(agent);
    const filePath = path.join(absRepoDir, filename);
    const content = pointers.repoPointer({ repoDir, repoStack });

    if (writeFileIfNotExists(filePath, content)) {
      log.success(`Created ${filename} (${getAgentDisplay(agent)})`);
    } else {
      log.warn(`${filename} already exists — keeping it`);
    }
  }

  // Update .gitignore
  const added = addToGitignore(absRepoDir, GITIGNORE_ENTRIES);
  for (const entry of added) {
    log.success(`Added ${entry} to .gitignore`);
  }
}

function checkGitNexus(repoDirs, workspaceDir) {
  console.log('');
  let hasGitNexus = false;
  try {
    execSync('npx gitnexus --version', { stdio: 'pipe', timeout: 10000 });
    hasGitNexus = true;
  } catch { /* not available */ }

  if (hasGitNexus) {
    log.step('Step 8', 'Indexing repos with GitNexus');
    for (const repoDir of repoDirs) {
      const abs = path.join(workspaceDir, repoDir);
      if (fs.existsSync(abs)) {
        log.plain(`  Indexing ${repoDir}...`);
        try {
          execSync('npx gitnexus analyze', { cwd: abs, stdio: 'pipe', timeout: 120000 });
          log.success(`GitNexus index built for ${repoDir}`);
        } catch { log.warn(`GitNexus indexing failed for ${repoDir} — run manually: npx gitnexus analyze`); }
      }
    }
  } else {
    log.step('Step 8', 'GitNexus (skipped — not installed)');
    log.warn('GitNexus gives agents blast-radius analysis and safe renames.');
    log.warn('Install: npm install -g gitnexus  then run: npx gitnexus analyze');
  }
}

function registerVaultMap(vaultName, vaultAbsPath) {
  const vaultMapPath = path.join(os.homedir(), '.claude', 'vault-map.json');
  let map = {};
  try {
    map = JSON.parse(fs.readFileSync(vaultMapPath, 'utf-8'));
  } catch { /* create fresh */ }

  if (map[vaultName]) {
    log.success(`Vault already registered in vault-map.json`);
    return;
  }

  map[vaultName] = vaultAbsPath;
  try {
    fs.mkdirSync(path.dirname(vaultMapPath), { recursive: true });
    fs.writeFileSync(vaultMapPath, JSON.stringify(map, null, 2) + '\n');
    log.success(`Registered ${vaultName} in ~/.claude/vault-map.json`);
    log.plain('  Vault-encoder hook will now inject vault context into every session.');
  } catch (err) {
    log.warn(`Could not write vault-map.json: ${err.message}`);
  }
}

function printGraphifyInstructions(vaultName) {
  console.log('');
  log.step('Step 10', 'Graphify — structural codebase analysis (optional)');
  log.plain('  Graphify maps your entire codebase into a graph (nodes, edges, communities)');
  log.plain('  and outputs GRAPH_REPORT.md to your vault. Run it once on large codebases.');
  console.log('');
  log.plain('  Quick start (AST-only, free):');
  log.plain('    python3 -m venv .venv-graphify');
  log.plain('    source .venv-graphify/bin/activate');
  log.plain('    pip install graphifyy');
  log.plain(`    graphify ./ --no-semantic --output ./${vaultName}/GRAPH_REPORT.md`);
  console.log('');
  log.plain('  Full semantic run (uses Claude tokens, richer output):');
  log.plain(`    graphify ./ --output ./${vaultName}/GRAPH_REPORT.md`);
}

function printDryRun({ projectName, vaultName, repoInputs, agents, workspaceDir }) {
  log.bold('Dry run — nothing will be created:\n');
  log.plain(`Project:    ${projectName}`);
  log.plain(`Vault:      ${vaultName}/`);
  log.plain(`Repos:      ${repoInputs.length > 0 ? repoInputs.join(', ') : '(none)'}`);
  log.plain(`Agents:     ${agents.join(', ')}`);
  log.plain(`Directory:  ${workspaceDir}`);
  console.log('');
  log.plain('Would create:');
  log.plain('  ~/.ai-profile/ (if not exists)');
  log.plain(`  ${vaultName}/ (Obsidian vault)`);
  log.plain('  .ai-rules/ (workspace rules)');
  log.plain('  .workspace-config');
  for (const agent of agents) {
    log.plain(`  ${getPointerFilename(agent)}`);
  }
  for (const repo of repoInputs) {
    const dir = path.basename(repo, '.git');
    log.plain(`  ${dir}/.ai-rules/`);
    for (const agent of agents) {
      log.plain(`  ${dir}/${getPointerFilename(agent)}`);
    }
  }
}

function printSummary({ projectName, vaultName, repoDirs, agents, workspaceDir }) {
  log.header('Setup Complete!');

  console.log('Your workspace:\n');
  console.log('  ~/.ai-profile/               <- Global AI profile (learns over time)');
  console.log('');
  console.log(`  ${workspaceDir}/`);
  console.log('  |-- .ai-rules/               <- Agent instructions (auto-updated)');
  console.log('  |-- ai-profile/              <- Symlink -> ~/.ai-profile/');

  for (const agent of agents) {
    const f = getPointerFilename(agent);
    console.log(`  |-- ${f.padEnd(25)} <- ${getAgentDisplay(agent)} pointer (yours to customize)`);
  }

  console.log(`  |-- ${vaultName}/`);
  console.log('  |   |-- MOC.md               <- Entry point — read this first each session');
  console.log('  |   |-- ARCHITECTURE_OVERVIEW.md  <- How your system works');
  console.log('  |   |-- GRAPH_REPORT.md      <- Structural analysis (populate with Graphify)');
  console.log('  |   |-- API_CONTRACTS.md     <- Endpoint shapes');
  console.log('  |   |-- DECISIONS.md         <- What was tried and why');
  console.log('  |   |-- SESSION_LOG.md       <- Session handoff notes');

  for (const repoDir of repoDirs) {
    console.log(`  |-- ${repoDir}/`);
    console.log('  |   |-- .ai-rules/           <- Agent instructions');
    console.log('  |   |-- .gitnexus/           <- Code knowledge graph (GitNexus)');
  }

  console.log('\nNext steps:\n');
  console.log(`  1. Open ${vaultName}/ in Obsidian, install the 'Obsidian Git' community plugin`);
  console.log(`  2. Add a remote to the vault: cd ${vaultName} && git remote add origin <url>`);
  console.log('  3. Fill in ARCHITECTURE_OVERVIEW.md with how your project works');
  console.log('  4. Run Graphify to generate GRAPH_REPORT.md (see Step 10 output above)');
  console.log('  5. Start coding — your agents will read .ai-rules/ + GitNexus automatically');
  console.log("  6. To update rules after a new release: aiws update\n");
}
