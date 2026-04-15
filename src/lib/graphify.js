import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './output.js';

const SKILL_URL = 'https://raw.githubusercontent.com/safishamsi/graphify/v1/skills/graphify/skill.md';

function fetchSkill() {
  return new Promise((resolve, reject) => {
    https.get(SKILL_URL, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (res2) => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => resolve(data));
          res2.on('error', reject);
        }).on('error', reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function installForAgent(agent, skillContent, workspaceDir) {
  try {
    if (agent === 'claude') {
      const skillPath = path.join(os.homedir(), '.claude', 'skills', 'graphify', 'SKILL.md');
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, skillContent, 'utf-8');
      return true;
    }

    if (agent === 'cursor') {
      const rulesDir = path.join(workspaceDir, '.cursor', 'rules');
      fs.mkdirSync(rulesDir, { recursive: true });
      const mdc = `---\ndescription: Graphify — knowledge graph skill\nglobs:\nalwaysApply: false\n---\n\n${skillContent}`;
      fs.writeFileSync(path.join(rulesDir, 'graphify.mdc'), mdc, 'utf-8');
      return true;
    }

    if (agent === 'codex') {
      const agentsPath = path.join(workspaceDir, 'AGENTS.md');
      if (fs.existsSync(agentsPath)) {
        const current = fs.readFileSync(agentsPath, 'utf-8');
        if (!current.includes('graphify')) {
          fs.appendFileSync(agentsPath, `\n\n## Graphify — Structural Analysis\n\n${skillContent}`, 'utf-8');
          return true;
        }
        return false; // already installed
      }
    }

    return false;
  } catch {
    return false;
  }
}

function agentInstructions(agent) {
  switch (agent) {
    case 'claude':   return 'Claude Code → type: /graphify .';
    case 'cursor':   return 'Cursor → ask: "run graphify on this workspace"';
    case 'codex':    return 'Codex → ask: "run graphify on this workspace"';
    case 'windsurf': return null; // not supported
    default:         return null;
  }
}

export async function promptAndRunGraphify(workspaceDir, vaultName, agents = []) {
  console.log('');
  log.plain('  Installing Graphify skill...');

  let skillContent;
  try {
    skillContent = await fetchSkill();
  } catch (err) {
    log.warn(`Could not fetch Graphify skill: ${err.message}`);
    log.plain('  Install manually: https://github.com/safishamsi/graphify');
    return;
  }

  const installed = [];

  for (const agent of (agents.length ? agents : ['claude'])) {
    if (agent === 'windsurf') {
      log.warn('Graphify: Windsurf not supported — GRAPH_REPORT.md in vault is your interface');
      continue;
    }
    if (installForAgent(agent, skillContent, workspaceDir)) {
      log.success(`Graphify skill installed for ${agent}`);
      installed.push(agent);
    }
  }

  if (installed.length === 0) return;

  console.log('');
  log.plain(`  To generate ${vaultName}/GRAPH_REPORT.md:`);
  for (const agent of installed) {
    const instr = agentInstructions(agent);
    if (instr) log.plain(`    ${instr}`);
  }
  log.plain('  All agents read GRAPH_REPORT.md from the vault automatically.');
}
