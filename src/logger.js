const isTTY = process.stdout.isTTY;

const c = {
  reset:  isTTY ? '\x1b[0m'  : '',
  bold:   isTTY ? '\x1b[1m'  : '',
  dim:    isTTY ? '\x1b[2m'  : '',
  green:  isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  red:    isTTY ? '\x1b[31m' : '',
};

const log = {
  info(...args) { console.log(...args); },
  ok(...args)   { console.log(`${c.green}✓${c.reset}`, ...args); },
  warn(...args) { console.warn(`${c.yellow}!${c.reset}`, ...args); },
  err(...args)  { console.error(`${c.red}✗${c.reset}`, ...args); },
  dim(...args)  { console.log(`${c.dim}${args.join(' ')}${c.reset}`); },
  h1(...args)   { console.log(`${c.bold}${args.join(' ')}${c.reset}`); },
};

export default log;
