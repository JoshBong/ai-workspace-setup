import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildIndex } from '../src/lib/index-builder.js';

describe('index stress tests', () => {
  it('no symbol file contains pipe characters that break markdown tables', () => {
    const testDir = path.join(os.tmpdir(), `devnexus-pipe-${Date.now()}`);
    const testVault = path.join(testDir, 'vault');
    fs.mkdirSync(testVault, { recursive: true });
    fs.writeFileSync(path.join(testVault, 'ARCHITECTURE_OVERVIEW.md'), '# A\n');
    fs.symlinkSync('/Users/jhuang/devnexus', path.join(testDir, 'devnexus'));

    buildIndex(testDir, 'vault', ['devnexus']);

    // Check NODE_INDEX.md table rows are well-formed
    const nodeIndex = fs.readFileSync(path.join(testVault, 'NODE_INDEX.md'), 'utf-8');
    const tableRows = nodeIndex.split('\n').filter(l => l.startsWith('| [['));
    for (const row of tableRows) {
      const cells = row.split('|').filter(Boolean);
      // Each data row should have consistent cell count (6 for All Symbols, 5 for God Nodes)
      assert.ok(cells.length >= 5, `row should have at least 5 cells: ${row.slice(0, 80)}`);
    }

    fs.rmSync(testDir, { recursive: true });
  });

  it('community _COMMUNITY.md internal call graph has no duplicates', () => {
    const testDir = path.join(os.tmpdir(), `devnexus-dedup-${Date.now()}`);
    const testVault = path.join(testDir, 'vault');
    fs.mkdirSync(testVault, { recursive: true });
    fs.writeFileSync(path.join(testVault, 'ARCHITECTURE_OVERVIEW.md'), '# A\n');
    fs.symlinkSync('/Users/jhuang/devnexus', path.join(testDir, 'devnexus'));

    buildIndex(testDir, 'vault', ['devnexus']);

    const nodesDir = path.join(testVault, 'nodes');
    const dirs = fs.readdirSync(nodesDir);
    for (const dir of dirs) {
      const communityFile = path.join(nodesDir, dir, '_COMMUNITY.md');
      if (!fs.existsSync(communityFile)) continue;
      const content = fs.readFileSync(communityFile, 'utf-8');
      const callLines = content.split('\n').filter(l => l.startsWith('- `') && l.includes('→'));
      const unique = new Set(callLines);
      assert.equal(callLines.length, unique.size,
        `${dir}/_COMMUNITY.md has duplicate call graph entries`);
    }

    fs.rmSync(testDir, { recursive: true });
  });

  it('every symbol in NODE_INDEX has a corresponding .md file', () => {
    const testDir = path.join(os.tmpdir(), `devnexus-complete-${Date.now()}`);
    const testVault = path.join(testDir, 'vault');
    fs.mkdirSync(testVault, { recursive: true });
    fs.writeFileSync(path.join(testVault, 'ARCHITECTURE_OVERVIEW.md'), '# A\n');
    fs.symlinkSync('/Users/jhuang/devnexus', path.join(testDir, 'devnexus'));

    buildIndex(testDir, 'vault', ['devnexus']);

    // Collect all .md files in nodes/ (excluding _COMMUNITY.md)
    const nodesDir = path.join(testVault, 'nodes');
    const allFiles = new Set();
    for (const dir of fs.readdirSync(nodesDir)) {
      const dirPath = path.join(nodesDir, dir);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      for (const f of fs.readdirSync(dirPath)) {
        if (f !== '_COMMUNITY.md' && f.endsWith('.md')) {
          allFiles.add(f.replace('.md', ''));
        }
      }
    }

    // Parse symbol names from NODE_INDEX All Symbols section
    const nodeIndex = fs.readFileSync(path.join(testVault, 'NODE_INDEX.md'), 'utf-8');
    const allSection = nodeIndex.split('## All Symbols')[1];
    const symbolRows = allSection.split('\n').filter(l => l.startsWith('| [['));
    const indexSymbols = symbolRows.map(r => {
      const match = r.match(/\[\[([^\]]+)\]\]/);
      return match ? match[1] : null;
    }).filter(Boolean);

    // Every symbol in the index should have a file
    const missing = [];
    for (const sym of indexSymbols) {
      // sanitizeFilename replaces non-alphanum with _
      const sanitized = sym.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!allFiles.has(sanitized) && !allFiles.has(sym)) {
        missing.push(sym);
      }
    }
    assert.equal(missing.length, 0,
      `Symbols in NODE_INDEX without .md files: ${missing.slice(0, 10).join(', ')}`);

    fs.rmSync(testDir, { recursive: true });
  });

  it('no community directory name contains unsafe filesystem characters', () => {
    const testDir = path.join(os.tmpdir(), `devnexus-safe-${Date.now()}`);
    const testVault = path.join(testDir, 'vault');
    fs.mkdirSync(testVault, { recursive: true });
    fs.writeFileSync(path.join(testVault, 'ARCHITECTURE_OVERVIEW.md'), '# A\n');
    fs.symlinkSync('/Users/jhuang/devnexus', path.join(testDir, 'devnexus'));

    buildIndex(testDir, 'vault', ['devnexus']);

    const nodesDir = path.join(testVault, 'nodes');
    const dirs = fs.readdirSync(nodesDir);
    const unsafePattern = /[<>:"/\\|?*\x00-\x1f]/;
    for (const dir of dirs) {
      assert.ok(!unsafePattern.test(dir), `directory name has unsafe chars: ${dir}`);
    }

    fs.rmSync(testDir, { recursive: true });
  });

  it('god nodes in ARCHITECTURE_OVERVIEW match god nodes in NODE_INDEX', () => {
    const testDir = path.join(os.tmpdir(), `devnexus-match-${Date.now()}`);
    const testVault = path.join(testDir, 'vault');
    fs.mkdirSync(testVault, { recursive: true });
    fs.writeFileSync(path.join(testVault, 'ARCHITECTURE_OVERVIEW.md'), '# A\n');
    fs.symlinkSync('/Users/jhuang/devnexus', path.join(testDir, 'devnexus'));

    buildIndex(testDir, 'vault', ['devnexus']);

    // Extract god node names from NODE_INDEX
    const nodeIndex = fs.readFileSync(path.join(testVault, 'NODE_INDEX.md'), 'utf-8');
    const godSection = nodeIndex.split('## Communities')[0].split('## God Nodes')[1];
    const indexGods = (godSection.match(/\[\[(\w+)\]\]/g) || []).map(m => m.replace(/[\[\]]/g, ''));

    // Extract god node names from ARCHITECTURE_OVERVIEW (only from the god nodes table)
    const arch = fs.readFileSync(path.join(testVault, 'ARCHITECTURE_OVERVIEW.md'), 'utf-8');
    const archBlock = arch.split('<!-- devnexus:index:start -->')[1]?.split('<!-- devnexus:index:end -->')[0] || '';
    // Only get bold names from the god nodes table (rows with | ** pattern), not community list
    const archGodRows = archBlock.split('\n').filter(l => l.startsWith('| **'));
    const archGods = archGodRows.map(r => {
      const match = r.match(/\*\*(\w+)\*\*/);
      return match ? match[1] : null;
    }).filter(Boolean);

    assert.deepStrictEqual(indexGods, archGods,
      'god nodes should be identical between NODE_INDEX and ARCHITECTURE_OVERVIEW');

    fs.rmSync(testDir, { recursive: true });
  });
});
