import log from './core/logger.js';
import { applyCmd } from './apply/apply-cmd.js';
import { addCmd, removeIncrementalCmd } from './cmd/add-remove.js';
import { inventoryCmd } from './cmd/inventory.js';
import { forkCmd } from './cmd/fork.js';
import { statusCmd } from './cmd/status.js';
import { doctorCmd } from './cmd/doctor.js';
import { scanCmd } from './cmd/scan-cmd.js';
import { upgradeCmd } from './cmd/upgrade.js';
import { hooksCmd } from './hooks/index.js';
import { customizeCmd } from './cmd/customize.js';
import { depsCmd } from './deps/index.js';

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
  log.info('  customize Customize bundle contents (add/exclude items)');
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
    case 'customize':
      await customizeCmd(rest);
      break;
    default:
      log.err(`Unknown command: ${cmd}`);
      log.dim('Run "ecc-tailor help" for usage.');
      process.exit(2);
  }
}
