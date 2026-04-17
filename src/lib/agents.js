import fs from 'fs';
import path from 'path';
import { AGENTS, SUPPORTED_AGENTS } from '../constants.js';

export function validateAgents(agentList) {
  const valid = [];
  const invalid = [];
  for (const agent of agentList) {
    const lower = agent.toLowerCase().trim();
    if (SUPPORTED_AGENTS.includes(lower)) {
      valid.push(lower);
    } else if (lower) {
      invalid.push(agent);
    }
  }
  return { valid, invalid };
}

export function getPointerFilename(agent) {
  return AGENTS[agent]?.pointer;
}

export function getAgentDisplay(agent) {
  return AGENTS[agent]?.display || agent;
}

export function pointerExists(dir, agent) {
  const filename = getPointerFilename(agent);
  return filename && fs.existsSync(path.join(dir, filename));
}

export function isInlineAgent(agent) {
  return AGENTS[agent]?.inline === true;
}
