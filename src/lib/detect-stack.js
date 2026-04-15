import fs from 'fs';
import path from 'path';

export function detectStack(repoDir) {
  const abs = path.resolve(repoDir);

  // Node.js / JavaScript
  const pkgPath = path.join(abs, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = fs.readFileSync(pkgPath, 'utf-8');
      if (pkg.includes('"next"'))    return 'a Next.js project (TypeScript, React)';
      if (pkg.includes('"react"'))   return 'a React project (TypeScript)';
      if (pkg.includes('"vue"'))     return 'a Vue.js project';
      if (pkg.includes('"svelte"'))  return 'a SvelteKit project';
      return 'a Node.js project';
    } catch {
      return 'a Node.js project';
    }
  }

  // Python
  const reqPath = path.join(abs, 'requirements.txt');
  const pyprojectPath = path.join(abs, 'pyproject.toml');
  if (fs.existsSync(reqPath)) {
    try {
      const req = fs.readFileSync(reqPath, 'utf-8');
      if (/fastapi/i.test(req)) return 'a FastAPI backend (Python)';
      if (/django/i.test(req))  return 'a Django project (Python)';
      if (/flask/i.test(req))   return 'a Flask project (Python)';
      return 'a Python project';
    } catch {
      return 'a Python project';
    }
  }
  if (fs.existsSync(pyprojectPath)) return 'a Python project';

  // Go
  if (fs.existsSync(path.join(abs, 'go.mod'))) return 'a Go project';

  // Rust
  if (fs.existsSync(path.join(abs, 'Cargo.toml'))) return 'a Rust project';

  return 'a software project';
}
