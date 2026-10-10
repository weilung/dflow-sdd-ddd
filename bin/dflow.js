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
  dflow check-closeout    Gate a closeout commit (for a pre-commit hook or CI)
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
  dflow render [--src <dir>] [--out <dir>] [--title <text>] [--table-view <cards|table>]

Renders the Markdown specs tree into a mirrored static HTML tree for human
reading (record tables read as cards or as a table, with a switch on each
table; AI markers become badges; the filled lifecycle and flow tables in
analysis.md are also drawn as diagrams), plus an index.html at the output
root: a grouped directory of the specs (each group collapsed until you open
it; a lone group starts open) when --src is a Dflow specs root (it holds
shared/_conventions.md), or a plain file tree otherwise. Open index.html
directly in a browser; file:// works, no server needed.

Markdown stays the AI-facing source of truth. Re-run this command whenever
the sources change; every run is a full rebuild.

Options:
  --src <dir>     Specs root to render (default: dflow/specs)
  --out <dir>     Output directory (default: dflow-specs-html)
  --title <text>  index.html page title (default: "dflow specs")
  --table-view <cards|table>
                  Which form every table of two or more columns with rows
                  starts in (default: cards). Each such table has its own
                  cards/table switch either way, and the page does not
                  remember a reader's choice. A table with an id or name
                  attribute written inside a cell is rendered in the
                  starting form only, without a switch.

Tables: render checks each table at the top level of a page for two ways a
Markdown table goes wrong without an error, and lists what it finds;
rendering still completes and the exit code is unchanged.
  cut short  a blank line or an HTML comment between rows ends the table,
             and the rows after it show as a paragraph of text. Reported
             when the paragraph right after a table (only blank lines or
             comments between) starts with a line written like the table's
             rows: a | followed by a space or tab (at most three spaces
             before it), a space or tab before the last |, and as many
             cells as the header.
  extra      a row with more cells than the header, where the extra cells
             hold text: that text is dropped, and the cells before it may
             be in the wrong columns. The usual cause is a | inside a cell,
             also inside backticks, not written as \\|. Cells are counted the
             way the Markdown parser splits them. A row with fewer cells,
             or with extra cells that are all empty, is not reported: the
             page shows it the same as a row with those cells written empty.
Each one gets a one-line notice on its page, above the table or the lines,
and a line on stdout under a tables line with its file, its line in the
source file and how to fix it. A lifecycle or flow whose table has either
problem is not drawn. Not checked: a table inside a list item or a block
quote, a table that never forms (a missing or malformed |---| row), rows cut
off whose first line is not written like the table's rows (a diagram may
then still be drawn from the rows before the cut), and the other cases
listed at
https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/render-table-checks.en.md

Diagrams: a ### LC-nn subsection in an analysis.md is drawn from its one
state table (a State column) and one transition table (From, Trigger, To);
a ### FL-nn subsection from its one flow table (From, To, Handed over), one
row per step. A table inside a list item or a block quote is not read, as
if it were not there. A subsection whose tables are filled in but cannot be
drawn gets a one-line note on its page instead, and stdout lists it under
the diagrams line with its file, entry id and reason; so does a subsection
that keeps a placeholder row from the template beside rows you filled in.
A subsection with no table, or left exactly as the template has it, is
skipped without a note. What can be drawn:
  lifecycle  at most 12 states and 20 transitions, 864 wide and 960 tall;
             each State cell holds one value, and no two rows hold the
             same one; each From and To cell holds one value: a row of the
             state table, or [*] for the entity not existing yet (From) or
             any more (To), drawn as a start and an end point that count
             toward the height but not as states; Trigger is not empty; a
             state that no transition has in From or To is listed under
             the diagram instead of drawn, and does not count toward the
             state or height limits; the other states are placed in
             state-table order, and the arrows must fit: at most 4 routing
             lanes on either side, 6 arrow ends on one side of a state or
             point, 4 crossings in all and 2 on one arrow
  flow       at most 8 participants and 10 steps, 960 tall (no width
             limit: a wide flow scrolls sideways on screen, and the print
             version draws a flow of at most 4 participants); each From and
             To cell holds one value; Handed over is not empty; a # column,
             when there is one, counts 1, 2, 3 in row order
  both       a name drawn in the diagram (a state or a participant) at
             most 64 characters on 2 lines; Trigger, Guard, Handed over and
             State change each at most 8 values and 256 characters, and one
             that takes more than 3 lines is cut short, which at most 2 of
             them may be (when more would be, the note names each one and
             the lines it takes); no right-to-left text in any of these. A
             state listed under the diagram has none of these limits. Means
             and Evidence have no limit, and Means is not drawn; an
             Evidence whose first word is inferred or assumed makes the
             arrow dashed and adds a one-row tag with that word, which
             counts toward the height

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
  - workflow bundle orphans, a bundle projected by an older Dflow, and a
    bundle manifest that is present but unreadable
  - a partly installed set of /dflow:* command files, or ones still using
    the Dflow 0.5.0 filename
  - a Dflow-generated SKILL.md that has fallen behind this CLI

Doctor reports only on command and skill files that are already present:
whether this project should have them is intent, which nothing records.

Doctor never modifies files.
`);
}

function printCheckCloseoutHelp(specGlobs, docUrl) {
  process.stdout.write(`Usage:
  dflow check-closeout [--staged]
  dflow check-closeout --range <base>..<head>

A gate for the closeout commit of /dflow:finish-feature: it checks the
feature directories newly archived to dflow/specs/features/completed/ and
exits 1 when one is inconsistent, so a pre-commit hook or a CI job can stop
the commit or the merge request. It reads git only and never modifies
anything. Run it from the directory that holds dflow/specs/ (the project may
sit below the repository root).

Modes:
  --staged (default)       Check the index (what git commit will record),
                           for a pre-commit hook. A host the HEAD commit
                           itself archived is checked too unless HEAD is a
                           merge, so amending a closeout commit is checked;
                           the commit after a closeout re-checks that host.
  --range <base>..<head>   Check the final state of <head> against its merge
                           base with <base>, for CI on a merge request or
                           pull request. Needs the full history.

In scope: a directory under completed/ that has files after the change and
had none before. One that was in active/ under the same name (for --range:
at the merge base or in any commit of the range) is checked. Any other —
renamed on the way, created directly in completed/, or an archived host
renamed — is reported as uncertain, for a person to confirm. Hosts that were
already in completed/ are not read again, except the ones --staged re-checks
because the HEAD commit archived them.

Checked for each newly archived host:
  1. _index.md exists and its frontmatter says status: completed
  2. nothing is left under features/active/<host>/ (moved, not copied)
  3. every spec file (${specGlobs.join(', ')}) says status: completed
  4. the Checkpoint Log has a closeout row (not the template's placeholder)
     whose Result is committed or skipped
  5. --staged only: nothing under the archived directory is left unstaged
     or untracked in the working tree

Not checked, and still up to the AI's Step 4 verification and pr-review: the
file-by-file comparison with the closeout baseline, that the commit carries
only the paths closeout may write, the identity of hosted Commit cells, and a
minimal host's hash evidence and exactly-two-commits rule. Passing does not
mean the closeout is clean.

Exit status: 0 when no host is in scope or every one passes; 1 when a check
fails, a shape cannot be read with confidence ([uncertain]), or the check
cannot run (not a git repository, no dflow/specs/ here, bad arguments).

Hook and CI templates, and how to handle [uncertain]:
${docUrl}
(offline: docs/closeout-check.en.md in the installed package; Traditional
Chinese: docs/closeout-check.md)
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

  if (args[0] === 'check-closeout') {
    // Loaded only for this subcommand. It reads lib/doc-shapes.json when it runs,
    // never when it loads, so a damaged registry cannot stop `dflow doctor` from
    // starting and reporting it; here a damaged registry is an error.
    const closeoutCheck = require('../lib/closeout-check');
    if (args.length > 1 && (args[1] === '--help' || args[1] === '-h')) {
      printCheckCloseoutHelp(await closeoutCheck.specFileGlobs(), closeoutCheck.CLOSEOUT_CHECK_DOC_URL);
      return 0;
    }

    return await closeoutCheck.runCheckCloseout({
      cwd: process.cwd(),
      args: args.slice(1),
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
