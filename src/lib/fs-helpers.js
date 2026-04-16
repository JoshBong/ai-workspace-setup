import fs from 'fs';
import path from 'path';

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
