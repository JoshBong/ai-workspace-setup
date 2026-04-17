import chalk from 'chalk';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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

export function createSpinner(text) {
  let frame = 0;
  let interval = null;
  const isTTY = process.stderr.isTTY;

  return {
    start() {
      if (!isTTY) {
        process.stderr.write(`  ${text}\n`);
        return this;
      }
      interval = setInterval(() => {
        const spinner = chalk.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
        process.stderr.write(`\r  ${spinner} ${text}`);
        frame++;
      }, 80);
      return this;
    },
    succeed(msg) {
      if (interval) clearInterval(interval);
      if (isTTY) process.stderr.write('\r\x1b[K');
      console.log(chalk.green(`  ✔ ${msg || text}`));
      return this;
    },
    fail(msg) {
      if (interval) clearInterval(interval);
      if (isTTY) process.stderr.write('\r\x1b[K');
      console.log(chalk.red(`  ✘ ${msg || text}`));
      return this;
    },
    update(newText) {
      text = newText;
      return this;
    },
  };
}
