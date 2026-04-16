#!/usr/bin/env node

import { handleCompletion } from '../src/commands/completion.js';
import { createProgram } from '../src/index.js';

if (!handleCompletion()) {
  const program = createProgram();
  program.parse();
}
