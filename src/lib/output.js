import chalk from 'chalk';

export const log = {
  info:    (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(`  ${msg}`)),
  warn:    (msg) => console.log(chalk.yellow(`  ${msg}`)),
  error:   (msg) => console.log(chalk.red(`  ${msg}`)),
  bold:    (msg) => console.log(chalk.bold(msg)),
  dim:     (msg) => console.log(chalk.dim(`  ${msg}`)),
  plain:   (msg) => console.log(`  ${msg}`),

  step(label, msg) {
    console.log(chalk.blue(`${label}: ${msg}`));
  },

  header(msg) {
    console.log('');
    console.log(chalk.bold('============================================'));
    console.log(chalk.bold(`   ${msg}`));
    console.log(chalk.bold('============================================'));
    console.log('');
  },

  table(rows) {
    for (const row of rows) {
      console.log(`  ${row}`);
    }
  },

  pass:  (msg) => console.log(chalk.green(`  [pass] ${msg}`)),
  fail:  (msg) => console.log(chalk.red(`  [fail] ${msg}`)),
  warnCheck: (msg) => console.log(chalk.yellow(`  [warn] ${msg}`)),
  fix:   (msg) => console.log(chalk.dim(`         Fix: ${msg}`)),
};
