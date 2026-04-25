import log from './logger.js';
import { applyCmd } from './apply-cmd.js';
import { addCmd, removeIncrementalCmd } from './add-remove.js';
import { inventoryCmd } from './inventory.js';
import { forkCmd } from './fork.js';
import { statusCmd } from './status.js';
import { doctorCmd } from './doctor.js';
import { scanCmd } from './scan-cmd.js';
import { upgradeCmd } from './upgrade.js';
import { hooksCmd } from './hooks-cmd.js';
import { depsCmd } from './deps-cmd.js';

function printHelp() {
  log.h1('ecc-tailor');
  log.info('');
  log.info('Usage: ecc-tailor <command> [options]');
  log.info('');
  log.info('Commands:');
  log.info('  apply     Apply the tailor manifest to the target environment');
  log.info('  upgrade   Fetch ECC updates and review new skills/agents');
  log.info('  status    Show current tailor status');
  log.info('  doctor    Run health checks on the installation');
  log.info('  scan      Attach/detach ephemeral evaluation bundle');
  log.info('  hooks     Manage hook profile and disabled list');
  log.info('  deps      Generate docs/DEPENDENCIES.md from ECC content');
  log.info('  help      Show this help message');
  log.info('');
  log.info('Options:');
  log.info('  -h, --help  Show help');
}

async function cmdApply(argv) {
  await applyCmd(argv);
}

async function cmdStatus(_argv) {
  statusCmd();
}

async function cmdDoctor(_argv) {
  await doctorCmd();
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
    case 'doctor':
      await cmdDoctor(rest);
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
    case 'fork':
      await forkCmd(rest);
      break;
    case 'scan':
      await scanCmd(rest);
      break;
    case 'upgrade':
      await upgradeCmd(rest);
      break;
    case 'hooks':
      await hooksCmd(rest);
      break;
    case 'deps':
      await depsCmd(rest);
      break;
    default:
      log.err(`Unknown command: ${cmd}`);
      log.dim('Run "ecc-tailor help" for usage.');
      process.exit(2);
  }
}
