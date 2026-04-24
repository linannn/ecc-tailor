import log from './logger.js';
import { applyCmd } from './apply-cmd.js';
import { addCmd, removeIncrementalCmd } from './add-remove.js';
import { inventoryCmd } from './inventory.js';

function printHelp() {
  log.h1('ecc-tailor');
  log.info('');
  log.info('Usage: ecc-tailor <command> [options]');
  log.info('');
  log.info('Commands:');
  log.info('  apply     Apply the tailor manifest to the target environment');
  log.info('  status    Show current tailor status');
  log.info('  help      Show this help message');
  log.info('');
  log.info('Options:');
  log.info('  -h, --help  Show help');
}

async function cmdApply(argv) {
  await applyCmd(argv);
}

async function cmdStatus(_argv) {
  log.info('status: not yet implemented');
}

export async function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  switch (cmd) {
    case 'apply':
      await cmdApply(rest);
      break;
    case 'status':
      await cmdStatus(rest);
      break;
    case 'add':
      await addCmd(rest);
      break;
    case 'remove':
      await removeIncrementalCmd(rest);
      break;
    case 'inventory':
      await inventoryCmd(rest);
      break;
    default:
      log.err(`Unknown command: ${cmd}`);
      log.dim('Run "ecc-tailor help" for usage.');
      process.exit(2);
  }
}
