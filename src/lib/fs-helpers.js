import fs from 'fs';
import path from 'path';
import { MANAGED_FENCE_START, MANAGED_FENCE_END } from '../constants.js';

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function createSymlink(target, linkPath) {
  if (!fs.existsSync(linkPath)) {
    fs.symlinkSync(target, linkPath);
    return true;
  }
  return false;
}

export function addToGitignore(repoDir, entries) {
  const gitignorePath = path.join(repoDir, '.gitignore');
  let content = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf-8')
    : '';
  const added = [];

  for (const entry of entries) {
    if (!content.includes(entry)) {
      content += content.endsWith('\n') ? `${entry}\n` : `\n${entry}\n`;
      added.push(entry);
    }
  }

  if (added.length > 0) {
    fs.writeFileSync(gitignorePath, content);
  }
  return added;
}

export function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

export function writeFileIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) {
    writeFile(filePath, content);
    return true;
  }
  return false;
}

export function migrateExistingPointer(filePath, rulesDir) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content || content.includes('.ai-rules/')) return false;
  const dest = path.join(rulesDir, '00-existing-rules.md');
  ensureDir(rulesDir);
  fs.writeFileSync(dest, content + '\n');
  return true;
}

/**
 * Read all .ai-rules/*.md files in order and concatenate them.
 */
export function concatenateRules(rulesDir) {
  if (!fs.existsSync(rulesDir)) return '';
  const files = fs.readdirSync(rulesDir)
    .filter(f => f.endsWith('.md'))
    .sort();
  return files
    .map(f => fs.readFileSync(path.join(rulesDir, f), 'utf8'))
    .join('\n\n---\n\n');
}

/**
 * Read the <!-- gitnexus:start --> block from a file, if present.
 */
export function extractGitNexusBlock(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  const start = content.indexOf('<!-- gitnexus:start -->');
  const end = content.indexOf('<!-- gitnexus:end -->');
  if (start === -1 || end === -1) return '';
  return content.slice(start, end + '<!-- gitnexus:end -->'.length);
}

/**
 * Write managed content into an inline agent file (Cursor, Windsurf).
 * Preserves anything outside the managed fences.
 * On first run (no fences), existing content becomes the user section.
 */
export function writeManagedPointer(filePath, managedContent) {
  if (!fs.existsSync(filePath)) {
    // Fresh file — just the managed block
    const content = `${MANAGED_FENCE_START}\n${managedContent}\n${MANAGED_FENCE_END}\n`;
    writeFile(filePath, content);
    return;
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(MANAGED_FENCE_START);
  const endIdx = existing.indexOf(MANAGED_FENCE_END);

  if (startIdx !== -1 && endIdx !== -1) {
    // Fences exist — replace between them
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + MANAGED_FENCE_END.length);
    const updated = `${before}${MANAGED_FENCE_START}\n${managedContent}\n${MANAGED_FENCE_END}${after}`;
    fs.writeFileSync(filePath, updated);
  } else {
    // No fences — preserve existing as user content, append managed block
    const userContent = existing.trimEnd();
    const updated = `${userContent}\n\n${MANAGED_FENCE_START}\n${managedContent}\n${MANAGED_FENCE_END}\n`;
    fs.writeFileSync(filePath, updated);
  }
}
