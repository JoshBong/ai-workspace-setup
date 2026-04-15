import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { log } from './output.js';

function isGraphifyAvailable() {
  try {
    execSync('graphify --version', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
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

  if (!isGraphifyAvailable()) {
    log.warn('Graphify not found — install it to generate GRAPH_REPORT.md:');
    log.plain('  python3 -m venv .venv-graphify && source .venv-graphify/bin/activate');
    log.plain('  pip install graphifyy');
    log.plain(`  graphify ./ --no-semantic --output ./${vaultName}/GRAPH_REPORT.md`);
    return;
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
    log.plain(`  Skipped. Run manually: graphify ./ --no-semantic --output ./${vaultName}/GRAPH_REPORT.md`);
    return;
  }

  writeGraphifyIgnore(workspaceDir, vaultName);

  const outputPath = path.join(vaultName, 'GRAPH_REPORT.md');
  const cmd = mode === 'ast'
    ? `graphify ./ --no-semantic --output ${outputPath}`
    : `graphify ./ --output ${outputPath}`;

  log.plain(`  Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: workspaceDir, stdio: 'inherit', timeout: 300000 });
    log.success(`GRAPH_REPORT.md updated in ${vaultName}/`);
  } catch {
    log.warn(`Graphify failed — run manually from workspace root: ${cmd}`);
  }
}
