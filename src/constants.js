import os from 'os';
import path from 'path';

export const TEMPLATE_VERSION = '2.10';
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

// Index constants
export const NODES_DIR = 'nodes';
export const NODE_INDEX_FILE = 'NODE_INDEX.md';
export const INDEX_MARKER_START = '<!-- devnexus:index:start -->';
export const INDEX_MARKER_END = '<!-- devnexus:index:end -->';

// Thresholds
export const GOD_NODE_MAX = 15;           // max god nodes to surface
export const GOD_NODE_MIN_EDGES = 10;     // minimum edges to qualify as god node
export const GOD_NODE_MIN_COMMUNITIES = 3; // minimum cross-community reach for god nodes
export const COMMUNITY_HUB_COUNT = 3;     // top N symbols per community as hubs
export const DRIFT_DAYS_THRESHOLD = 14;    // days before index is considered stale
