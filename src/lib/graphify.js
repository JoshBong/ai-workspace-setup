import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { log } from './output.js';

function getGraphifyBin(workspaceDir) {
  const venvBin = path.join(workspaceDir, '.venv-graphify', 'bin', 'graphify');
  if (fs.existsSync(venvBin)) return venvBin;

  try {
    execSync('graphify --help', { stdio: 'pipe', timeout: 5000 });
    return 'graphify';
  } catch {
    return null;
  }
}

function autoInstall(workspaceDir) {
  log.plain('  Installing Graphify into .venv-graphify/...');
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

export async function promptAndRunGraphify(workspaceDir, vaultName) {
  console.log('');

  let bin = getGraphifyBin(workspaceDir);
  if (!bin) {
    bin = autoInstall(workspaceDir);
    if (!bin) return;
  }

  // Install the skill into Claude Code's global skills dir
  try {
    execSync(`${bin} install --platform claude`, { cwd: workspaceDir, stdio: 'pipe' });
    log.success('Graphify skill installed for Claude Code');
  } catch {
    // Non-fatal — skill install is optional
  }

  log.plain('');
  log.plain('  Graphify is a Claude Code skill. To generate GRAPH_REPORT.md:');
  log.plain(`  1. Open Claude Code in your workspace`);
  log.plain(`  2. Type: /graphify .`);
  log.plain(`  3. Claude will write the report to ${vaultName}/GRAPH_REPORT.md`);
}
