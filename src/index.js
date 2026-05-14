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

const SUBCOMMAND_HELP = {
  apply:     'Usage: ecc-tailor apply [--dry-run]',
  status:    'Usage: ecc-tailor status',
  doctor:    'Usage: ecc-tailor doctor',
  add:       'Usage: ecc-tailor add <type> <name>[,name] [--to global] [--no-apply]\n<type>: skill, agent, bundle, rule, command, context, mcp',
  remove:    'Usage: ecc-tailor remove <type> <name>[,name] [--from global] [--no-apply]\n       ecc-tailor remove --project <path> | --global | --all',
  inventory: 'Usage: ecc-tailor inventory [--type <type>] [--state <state>] [--filter <regex>] [--detail <name>]\n<type>: skill, agent, rule, command, context, mcp, bundle\n<state>: selected, unselected, ignored',
  fork:      'Usage: ecc-tailor fork <path>',
  scan:      'Usage: ecc-tailor scan attach [path]\n       ecc-tailor scan detach [path]',
  upgrade:   'Usage: ecc-tailor upgrade',
  hooks:     'Usage: ecc-tailor hooks status\n       ecc-tailor hooks set-profile <minimal|standard|strict>\n       ecc-tailor hooks disable <hook-id>\n       ecc-tailor hooks enable <hook-id>\n       ecc-tailor hooks claude-mem-compat <on|off>',
  deps:      'Usage: ecc-tailor deps',
  customize: 'Usage: ecc-tailor customize <bundle>\n       ecc-tailor customize <bundle> add <type> <name>[,name]\n       ecc-tailor customize <bundle> exclude <type> <name>[,name]\n       ecc-tailor customize <bundle> reset\n<type>: agents (agent), skills (skill), mcp',
};

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

  if (rest.includes('--help') || rest.includes('-h')) {
    const help = SUBCOMMAND_HELP[cmd];
    if (help) {
      log.info(help);
      return;
    }
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
