import { execSync } from 'child_process';
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

export async function promptAndRunGraphify(repoDir, absRepoDir, vaultName) {
  console.log('');

  if (!isGraphifyAvailable()) {
    log.warn(`Graphify not found — install it to generate GRAPH_REPORT.md for ${repoDir}:`);
    log.plain('  python3 -m venv .venv-graphify && source .venv-graphify/bin/activate');
    log.plain('  pip install graphifyy');
    log.plain(`  graphify ./ --no-semantic --output ../${vaultName}/GRAPH_REPORT.md`);
    return;
  }

  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: `Run Graphify on ${repoDir}?`,
    choices: [
      { name: 'AST-only — fast, free (recommended for first run)', value: 'ast' },
      { name: 'Full semantic — uses Claude tokens, richer output', value: 'semantic' },
      { name: 'Skip for now', value: 'skip' },
    ],
  }]);

  if (mode === 'skip') {
    log.plain(`  Skipped. Run manually: graphify ./ --no-semantic --output ../${vaultName}/GRAPH_REPORT.md`);
    return;
  }

  const outputPath = path.join('..', vaultName, 'GRAPH_REPORT.md');
  const cmd = mode === 'ast'
    ? `graphify ./ --no-semantic --output ${outputPath}`
    : `graphify ./ --output ${outputPath}`;

  log.plain(`  Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: absRepoDir, stdio: 'inherit', timeout: 300000 });
    log.success(`GRAPH_REPORT.md updated in ${vaultName}/`);
  } catch {
    log.warn(`Graphify failed — run manually from ${repoDir}/: ${cmd}`);
  }
}
