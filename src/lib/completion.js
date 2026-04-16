import { createRequire } from 'module';
import { log } from './output.js';

const require = createRequire(import.meta.url);

export async function installCompletion() {
  try {
    const tabtab = require('tabtab');
    await tabtab.install({ name: 'devnexus', completer: 'devnexus' });
    log.success('Shell tab completion installed (restart terminal to activate)');
  } catch {
    // Non-critical — don't block init
  }
}
