#!/usr/bin/env node

const { runInit } = require('../lib/init');
const pkg = require('../package.json');

const args = process.argv.slice(2);

function printHelp() {
  process.stdout.write(`Dflow CLI ${pkg.version}

Usage:
  dflow init       Initialize Dflow specs in the current project
  dflow --help     Show this help
  dflow --version  Show the CLI version

Only the init subcommand is implemented in this version.
`);
}

function printInitHelp() {
  process.stdout.write(`Usage:
  dflow init

Initializes Dflow project specs under dflow/specs/.
The command prompts for project type, edition, tech stack, prose language,
and optional starter files before showing a full file preview.
`);
}

async function main() {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return 0;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }

  if (args[0] === 'init') {
    if (args.length > 1 && (args[1] === '--help' || args[1] === '-h')) {
      printInitHelp();
      return 0;
    }

    if (args.length > 1) {
      process.stderr.write(`Unsupported init option: ${args.slice(1).join(' ')}\n`);
      return 1;
    }

    return await runInit({
      cwd: process.cwd(),
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr
    });
  }

  process.stderr.write(`Unsupported subcommand: ${args[0]}\n\n`);
  printHelp();
  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`${error && error.message ? error.message : error}\n`);
    process.exitCode = 1;
  });
