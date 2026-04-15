import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './output.js';

const SKILL_URL = 'https://raw.githubusercontent.com/safishamsi/graphify/v1/skills/graphify/skill.md';
const SKILL_PATH = path.join(os.homedir(), '.claude', 'skills', 'graphify', 'SKILL.md');

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

export async function promptAndRunGraphify(workspaceDir, vaultName) {
  console.log('');
  log.plain('  Installing Graphify skill...');

  try {
    const content = await fetchSkill();
    fs.mkdirSync(path.dirname(SKILL_PATH), { recursive: true });
    fs.writeFileSync(SKILL_PATH, content, 'utf-8');
    log.success('Graphify skill installed (~/.claude/skills/graphify/SKILL.md)');
  } catch (err) {
    log.warn(`Could not fetch Graphify skill: ${err.message}`);
    log.plain('  Install manually: https://github.com/safishamsi/graphify');
  }

  console.log('');
  log.plain('  To generate GRAPH_REPORT.md, open Claude Code in your workspace and type:');
  log.plain('');
  log.plain('    /graphify .');
  log.plain('');
  log.plain(`  Claude will write the report to ${vaultName}/GRAPH_REPORT.md`);
  log.plain('  All agents read this file from the vault automatically.');
}
