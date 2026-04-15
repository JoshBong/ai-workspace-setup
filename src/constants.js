import os from 'os';
import path from 'path';

export const TEMPLATE_VERSION = '2.4';
export const CONFIG_VERSION = '2.0';
export const CONFIG_FILE = '.workspace-config';

export const AI_PROFILE_DIR = path.join(os.homedir(), '.ai-profile');

export const AGENTS = {
  claude:   { pointer: 'CLAUDE.md',       display: 'Claude Code' },
  cursor:   { pointer: '.cursorrules',     display: 'Cursor' },
  codex:    { pointer: 'AGENTS.md',        display: 'Codex' },
  windsurf: { pointer: '.windsurfrules',   display: 'Windsurf' },
};

export const SUPPORTED_AGENTS = Object.keys(AGENTS);

export const GITIGNORE_ENTRIES = ['.ai-rules/', '.cursor/', '.gitnexus'];
