import { Command } from 'commander';
import { TEMPLATE_VERSION } from './constants.js';
import { initCommand } from './commands/init.js';
import { updateCommand } from './commands/update.js';
import { statusCommand } from './commands/status.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { agentCommand } from './commands/agent.js';
import { doctorCommand } from './commands/doctor.js';

export function createProgram() {
  const program = new Command();

  program
    .name('devnexus')
    .description('AI-augmented workspace setup and management')
    .version(`1.0.0 (templates v${TEMPLATE_VERSION})`);

  program.addCommand(initCommand());
  program.addCommand(updateCommand());
  program.addCommand(statusCommand());
  program.addCommand(addCommand());
  program.addCommand(removeCommand());
  program.addCommand(agentCommand());
  program.addCommand(doctorCommand());

  return program;
}
