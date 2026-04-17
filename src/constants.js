import os from 'os';
import path from 'path';

export const TEMPLATE_VERSION = '2.16';
export const CONFIG_VERSION = '2.0';
export const CONFIG_FILE = '.workspace-config';

export const AI_PROFILE_DIR = path.join(os.homedir(), '.ai-profile');

export const AGENTS = {
  claude:   { pointer: 'CLAUDE.md',       display: 'Claude Code',  inline: false },
  cursor:   { pointer: '.cursorrules',     display: 'Cursor',       inline: true  },
  codex:    { pointer: 'AGENTS.md',        display: 'Codex',        inline: false },
  windsurf: { pointer: '.windsurfrules',   display: 'Windsurf',     inline: true  },
  generic:  { pointer: 'AI_RULES.md',       display: 'Generic',      inline: true  },
};

export const MANAGED_FENCE_START = '<!-- devnexus:managed:start -->';
export const MANAGED_FENCE_END = '<!-- devnexus:managed:end -->';

export const SUPPORTED_AGENTS = Object.keys(AGENTS);

export const GITIGNORE_ENTRIES = ['.ai-rules/', '.cursor/', '.gitnexus', 'AI_RULES.md'];

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
