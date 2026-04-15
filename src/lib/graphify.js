import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { log } from './output.js';

function getGraphifyBin(workspaceDir) {
  // Check local venv first
  const venvBin = path.join(workspaceDir, '.venv-graphify', 'bin', 'graphify');
  if (fs.existsSync(venvBin)) return venvBin;

  // Fall back to global
  try {
    execSync('graphify --version', { stdio: 'pipe', timeout: 5000 });
    return 'graphify';
  } catch {
    return null;
  }
}

function autoInstall(workspaceDir) {
  log.plain('  Graphify not found — installing into .venv-graphify/...');
  try {
    execSync('python3 -m venv .venv-graphify', { cwd: workspaceDir, stdio: 'pipe' });
    execSync('.venv-graphify/bin/pip install graphifyy --quiet', { cwd: workspaceDir, stdio: 'pipe' });
    log.success('Graphify installed in .venv-graphify/');
    return path.join(workspaceDir, '.venv-graphify', 'bin', 'graphify');
  } catch (err) {
    log.warn(`Auto-install failed: ${err.message}`);
    log.plain('  Install manually:');
    log.plain('    python3 -m venv .venv-graphify && source .venv-graphify/bin/activate');
    log.plain('    pip install graphifyy');
    return null;
  }
}

function writeGraphifyIgnore(workspaceDir, vaultName) {
  const content = [
    '# devnexus — generated files, not source code',
    `${vaultName}/`,
    '.ai-rules/',
    'ai-profile/',
    'CLAUDE.md',
    'AGENTS.md',
    '.cursorrules',
    '.windsurfrules',
    '.workspace-config',
    '.graphifyignore',
    'node_modules/',
    '.git/',
    '.venv-graphify/',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(workspaceDir, '.graphifyignore'), content, 'utf-8');
}

export async function promptAndRunGraphify(workspaceDir, vaultName) {
  console.log('');

  let bin = getGraphifyBin(workspaceDir);
  if (!bin) {
    bin = autoInstall(workspaceDir);
    if (!bin) return;
  }

  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: 'Run Graphify on workspace?',
    choices: [
      { name: 'AST-only — fast, free (recommended for first run)', value: 'ast' },
      { name: 'Full semantic — uses Claude tokens, richer output', value: 'semantic' },
      { name: 'Skip for now', value: 'skip' },
    ],
  }]);

  if (mode === 'skip') {
    log.plain(`  Skipped. Run anytime: devnexus graphify`);
    return;
  }

  writeGraphifyIgnore(workspaceDir, vaultName);

  const outputPath = path.join(vaultName, 'GRAPH_REPORT.md');
  const cmd = mode === 'ast'
    ? `${bin} ./ --no-semantic --output ${outputPath}`
    : `${bin} ./ --output ${outputPath}`;

  log.plain(`  Running: graphify ./ ${mode === 'ast' ? '--no-semantic ' : ''}--output ${outputPath}`);
  try {
    execSync(cmd, { cwd: workspaceDir, stdio: 'inherit', timeout: 300000 });
    log.success(`GRAPH_REPORT.md updated in ${vaultName}/`);
  } catch {
    log.warn(`Graphify failed — run manually: devnexus graphify`);
  }
}
