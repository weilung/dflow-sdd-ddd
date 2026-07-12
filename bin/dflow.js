#!/usr/bin/env node

const { runConfigureAgents, runDoctor, runInit } = require('../lib/init');
const { runRender } = require('../lib/render');
const pkg = require('../package.json');

const args = process.argv.slice(2);

function printHelp() {
  process.stdout.write(`Dflow CLI ${pkg.version}

Usage:
  dflow init              Initialize Dflow specs in the current project
  dflow configure-agents  Add or update AI agent instruction shims
  dflow doctor            Read-only project health check
  dflow render            Render the specs Markdown tree to browsable HTML
  dflow --help            Show this help
  dflow --version         Show the CLI version
`);
}

function printInitHelp() {
  process.stdout.write(`Usage:
  dflow init

Initializes Dflow project specs under dflow/specs/.
The command prompts for project type, tech stack, migration context, prose
language, Git policy, AI commit marker, optional starter files, and AI coding
agents, then — when agents were selected on an interactive terminal — whether
to install the project-level Dflow skill (default yes), before showing a full
file preview. Non-interactive runs never read an extra stdin answer for the
skill question: existing scripted answer sequences run unchanged, and the
skill is installed by default for the selected agents.
`);
}

function printConfigureAgentsHelp() {
  process.stdout.write(`Usage:
  dflow configure-agents [--command-adapters] [--skills]

Adds AI agent instruction files to an existing Dflow project.
The command can create AGENTS.md, CLAUDE.md, and
.github/copilot-instructions.md shims that point to the canonical
dflow/specs/shared/AI-AGENT-GUIDE.md file.

Options:
  --command-adapters  Also generate tool-native thin wrappers for supported tools.
  --skills            Regenerate project-level skill adapters for all selected supported tools (Claude Code, Codex, and GitHub Copilot), restoring natural-language auto-trigger.

Without --skills, selecting an agent that has no project-level skill yet
prompts to install it (default yes) on an interactive terminal; non-interactive
runs install it by default without reading an extra stdin answer. Agents whose
skill file already exists are not re-asked and not regenerated.

On upgrade re-runs the command also refreshes the marker-guarded canonical
region of dflow/specs/shared/AI-AGENT-GUIDE.md (content outside the markers,
including "## Project Context", is kept) and advances the "> Dflow Version:"
last-reconciled line in _conventions.md. A pre-marker guide, or an agent file
you edited yourself, is never rewritten silently: interactive runs offer
marker adoption (default No); non-interactive runs skip and warn. (A pristine,
unedited Dflow shim is still regenerated in place, as before.)
`);
}

function printRenderHelp() {
  process.stdout.write(`Usage:
  dflow render [--src <dir>] [--out <dir>] [--title <text>]

Renders the Markdown specs tree into a mirrored static HTML tree for human
reading (record tables become cards, AI markers become badges), plus an
index.html file tree at the output root. Open index.html directly in a
browser; file:// works, no server needed.

Markdown stays the AI-facing source of truth. Re-run this command whenever
the sources change; every run is a full rebuild.

Options:
  --src <dir>     Specs root to render (default: dflow/specs)
  --out <dir>     Output directory (default: dflow-specs-html)
  --title <text>  index.html page title (default: "dflow specs")

The output directory is owned by dflow render: every rendered file embeds a
generated-by marker, and a .dflow-render-manifest.json ledger tracks the
mirror. Files whose sources were deleted or renamed are cleaned up on the
next run — a file is deleted only when it is both ledger-listed and
marker-verified, and an existing file at a path being rendered is
overwritten only when it is marker-verified (that is how the partial
outputs of an interrupted run converge on the next run). render refuses a
non-empty directory without a ledger, anything it never creates (symlinks,
junctions, hardlinked files), unrecognized files at paths it must write,
and source trees whose outputs would collide. render only writes --out; it
never modifies --src.
`);
}

function printDoctorHelp() {
  process.stdout.write(`Usage:
  dflow doctor

Read-only health check for the current project. Reports findings such as:

  - dflow/specs/shared/_conventions.md missing the Dflow Version
    front-matter line, or recording an older last-reconciled version
  - policy sections (Git Policy / AI Commit Policy / Prose Language)
    missing or no longer machine-readable
  - AI-AGENT-GUIDE.md frozen at an older Dflow version (missing or
    malformed guide-canonical markers, stale canonical content) and
    dangling "AI-AGENT-GUIDE.md § ..." references from the workflow bundle
  - AI-AGENT-GUIDE.md "## Project Context" missing the machine-readable
    Tech stack / Migration rows that context inference reads
  - init-only starters drifted (missing or edited Git-principles file
    for the selected policy)
  - active feature _index.md files created from an older template shape
  - root agent files (AGENTS.md / CLAUDE.md / copilot-instructions.md)
    with malformed Dflow markers or unmanaged Dflow wording
  - workflow bundle orphans and a bundle projected by an older Dflow

Doctor never modifies files.
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

  if (args[0] === 'configure-agents') {
    if (args.length > 1 && (args[1] === '--help' || args[1] === '-h')) {
      printConfigureAgentsHelp();
      return 0;
    }

    const configureOptions = args.slice(1);
    const unsupportedConfigureOptions = configureOptions.filter(
      (arg) => arg !== '--command-adapters' && arg !== '--skills'
    );
    if (unsupportedConfigureOptions.length > 0) {
      process.stderr.write(`Unsupported configure-agents option: ${unsupportedConfigureOptions.join(' ')}\n`);
      return 1;
    }

    return await runConfigureAgents({
      cwd: process.cwd(),
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      commandAdapters: configureOptions.includes('--command-adapters'),
      skills: configureOptions.includes('--skills')
    });
  }

  if (args[0] === 'render') {
    if (args.length > 1 && (args[1] === '--help' || args[1] === '-h')) {
      printRenderHelp();
      return 0;
    }

    return await runRender({
      cwd: process.cwd(),
      args: args.slice(1),
      stdout: process.stdout,
      stderr: process.stderr
    });
  }

  if (args[0] === 'doctor') {
    if (args.length > 1 && (args[1] === '--help' || args[1] === '-h')) {
      printDoctorHelp();
      return 0;
    }

    if (args.length > 1) {
      process.stderr.write(`Unsupported doctor option: ${args.slice(1).join(' ')}\n`);
      return 1;
    }

    return await runDoctor({
      cwd: process.cwd(),
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
