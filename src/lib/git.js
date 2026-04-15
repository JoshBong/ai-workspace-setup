import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function gitClone(url, cwd = process.cwd()) {
  execSync(`git clone "${url}"`, { cwd, stdio: 'pipe' });
  return path.basename(url, '.git');
}

export function gitInit(dir) {
  execSync('git init -q', { cwd: dir, stdio: 'pipe' });
}

export function gitAddAll(dir) {
  execSync('git add -A', { cwd: dir, stdio: 'pipe' });
}

export function gitCommit(dir, message) {
  execSync(`git commit -q -m "${message}"`, { cwd: dir, stdio: 'pipe' });
}

export function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

export function gitStatus(dir) {
  try {
    const output = execSync('git status --porcelain', { cwd: dir, encoding: 'utf-8' });
    return output.trim() === '' ? 'clean' : 'dirty';
  } catch {
    return 'error';
  }
}

export function gitHasRemote(dir) {
  try {
    const output = execSync('git remote -v', { cwd: dir, encoding: 'utf-8' });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

export function gitLastCommitTime(dir) {
  try {
    const output = execSync('git log -1 --format=%cr', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return output.trim();
  } catch {
    return null;
  }
}
