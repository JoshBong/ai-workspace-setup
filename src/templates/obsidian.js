export function appJson() {
  return JSON.stringify({
    alwaysUpdateLinks: true,
    newFileLocation: 'current',
    attachmentFolderPath: './',
  }, null, 2) + '\n';
}

export function corePlugins() {
  return JSON.stringify([
    'file-explorer', 'global-search', 'switcher', 'graph', 'backlink',
    'outgoing-link', 'tag-pane', 'page-preview', 'daily-notes', 'templates',
    'note-composer', 'command-palette', 'editor-status', 'bookmarks',
    'outline', 'word-count', 'file-recovery',
  ]) + '\n';
}

export function communityPlugins() {
  return JSON.stringify(['obsidian-git']) + '\n';
}

export function gitPluginData() {
  return JSON.stringify({
    autoSaveInterval: 1,
    autoPullInterval: 1,
    autoPullOnBoot: true,
    autoPushAfterCommit: true,
    commitMessage: 'vault: {{date}} by {{author}}',
    autoCommitMessage: 'vault: {{date}} by {{author}}',
    commitDateFormat: 'YYYY-MM-DD HH:mm',
    listChangedFilesInMessageBody: true,
  }, null, 2) + '\n';
}

export function appearance() {
  return JSON.stringify({ accentColor: '' }, null, 2) + '\n';
}

export function vaultGitignore() {
  return `.DS_Store
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/graph.json
.obsidian/cache/
.obsidian/plugins/**/data.json
`;
}
