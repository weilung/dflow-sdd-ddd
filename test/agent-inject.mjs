// PROPOSAL-054 — existing-agent-file Dflow shim auto-inject.
//
// Covers the runtime behavior that replaces the old "park a side merge snippet"
// default with an auto-injected, marker-delimited Dflow block shown in the
// confirmation preview, across the three agent targets (AGENTS.md / CLAUDE.md /
// .github/copilot-instructions.md) and both entry points (init / configure-agents):
//
//   - append the marked block into a user-owned non-guide file (init + configure)
//   - idempotent re-run (replace the block in place, never duplicate)
//   - regenerate a pristine / whole-file Dflow shim without duplicating it
//   - malformed Dflow markers -> previewed snippet fallback + warning, file untouched
//   - a guide-configured file the user wrote -> skip (no duplicate guide pointer)
//   - Codex AGENTS.md + --command-adapters -> base + trigger as two adjacent marked
//     blocks assembled into ONE plan item (single write)
//   - CRLF user file -> injected block uses the file's CRLF
//   - the write-phase raw-equality guard (changed-after-preview -> skip + warn)
//
// Style mirrors test/smoke.mjs: drive the real CLI through bin/dflow.js, plus one
// unit-level test of the exported writeFilePlan guard (it cannot be reached through
// the CLI because preview and write happen in a single process).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import init from '../lib/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dflowBin = join(repoRoot, 'bin', 'dflow.js');
const RUN_TIMEOUT_MS = 30000;

const AGENT_SHIM_START = '<!-- dflow-generated: agent-shim START -->';
const AGENT_SHIM_END = '<!-- dflow-generated: agent-shim END -->';
const TRIGGER_START = '<!-- dflow-generated: codex-command-triggers START -->';
const TRIGGER_END = '<!-- dflow-generated: codex-command-triggers END -->';

const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-agent-inject-'));
let projectCounter = 0;

function runDflow(cwd, input, args) {
  const result = spawnSync(process.execPath, [dflowBin, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: 1024 * 1024
  });
  if (result.error) {
    throw result.error;
  }
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// init prompt order: project type, tech stack, migration, prose, git policy,
// AI commit marker, optional starter files, AI agents, confirm.
function initInput(agents) {
  return ['1', 'ASP.NET Core 9, EF Core 8', 'none', '1', '2', '1', '1', agents, 'y'].join('\n') + '\n';
}

async function newProject(agents) {
  const root = join(tempRoot, `p${projectCounter += 1}`);
  await mkdir(root, { recursive: true });
  const run = runDflow(root, initInput(agents), ['init']);
  assert.equal(run.code, 0, `init failed (agents=${agents})\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
  return root;
}

function configure(root, agents, flags = []) {
  return runDflow(root, `${agents}\ny\n`, ['configure-agents', ...flags]);
}

const TARGETS = [
  { key: 'agents', select: '1', file: 'AGENTS.md', snippet: 'dflow/specs/shared/AGENTS-md-snippet.md' },
  { key: 'claude', select: '2', file: 'CLAUDE.md', snippet: 'dflow/specs/shared/CLAUDE-md-snippet.md' },
  { key: 'copilot', select: '3', file: '.github/copilot-instructions.md', snippet: 'dflow/specs/shared/copilot-instructions-snippet.md' }
];

try {
  // ---------------------------------------------------------------------------
  // 1. configure-agents appends the marked block into existing user files, and is
  //    idempotent on re-run (replace in place, never duplicate). All three targets.
  // ---------------------------------------------------------------------------
  for (const target of TARGETS) {
    const root = await newProject('none');
    const filePath = join(root, target.file);
    if (target.file.includes('/')) {
      await mkdir(dirname(filePath), { recursive: true });
    }
    const userContent = `# ${target.key} house rules\n\nProject-specific guidance the team wrote.\n`;
    await writeFile(filePath, userContent);

    const first = configure(root, target.select);
    assert.equal(first.code, 0, `[${target.key}] configure append failed\nSTDOUT:\n${first.stdout}\nSTDERR:\n${first.stderr}`);
    assert.match(first.stdout, new RegExp(`\\| ${target.file.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} \\| update \\|`), `[${target.key}] existing file should be updated in place`);

    const afterFirst = await readFile(filePath, 'utf8');
    assert.match(afterFirst, /^# /, `[${target.key}] user content stays at the top`);
    assert.ok(afterFirst.startsWith(userContent.trimEnd()), `[${target.key}] original user content preserved verbatim at the top`);
    assert.equal(count(afterFirst, AGENT_SHIM_START), 1, `[${target.key}] exactly one agent-shim block appended`);
    assert.equal(count(afterFirst, AGENT_SHIM_END), 1, `[${target.key}] exactly one agent-shim END marker`);
    assert.match(afterFirst, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, `[${target.key}] block points to the canonical guide`);
    assert.equal(await exists(join(root, target.snippet)), false, `[${target.key}] no merge snippet when injecting in place`);

    // Idempotent re-run: the block is replaced in place, not appended again.
    const second = configure(root, target.select);
    assert.equal(second.code, 0, `[${target.key}] idempotent re-run failed\nSTDOUT:\n${second.stdout}\nSTDERR:\n${second.stderr}`);
    const afterSecond = await readFile(filePath, 'utf8');
    assert.equal(afterSecond, afterFirst, `[${target.key}] re-run leaves the file byte-identical`);
    assert.equal(count(afterSecond, AGENT_SHIM_START), 1, `[${target.key}] still exactly one agent-shim block after re-run`);
    assert.match(second.stdout, new RegExp(`\\| ${target.file.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} \\| skip \\|`), `[${target.key}] idempotent re-run reports a skip (already current)`);
  }

  // ---------------------------------------------------------------------------
  // 2. init appends into pre-existing user files (all three at once) and plumbs the
  //    fallback warning path (previously init never carried agent-shim warnings).
  // ---------------------------------------------------------------------------
  {
    const root = join(tempRoot, `p${projectCounter += 1}`);
    await mkdir(join(root, '.github'), { recursive: true });
    await writeFile(join(root, 'AGENTS.md'), '# Existing AGENTS rules\n');
    await writeFile(join(root, 'CLAUDE.md'), '# Existing CLAUDE rules\n');
    await writeFile(join(root, '.github/copilot-instructions.md'), '# Existing Copilot rules\n');

    const run = runDflow(root, initInput('1,2,3'), ['init']);
    assert.equal(run.code, 0, `init append failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    for (const target of TARGETS) {
      const content = await readFile(join(root, target.file), 'utf8');
      assert.match(content, /^# Existing /, `[init ${target.key}] user content preserved`);
      assert.equal(count(content, AGENT_SHIM_START), 1, `[init ${target.key}] one agent-shim block appended by init`);
      assert.equal(await exists(join(root, target.snippet)), false, `[init ${target.key}] init injects in place, no snippet`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. A pristine / whole-file Dflow shim (created by init) is regenerated by a later
  //    configure-agents run without being duplicated or parked as a snippet.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');
    for (const target of TARGETS) {
      const before = await readFile(join(root, target.file), 'utf8');
      assert.equal(count(before, AGENT_SHIM_START), 0, `[pristine ${target.key}] a freshly created whole-file shim carries no agent-shim marker`);
    }
    const reconfigure = configure(root, '1,2,3');
    assert.equal(reconfigure.code, 0, `pristine reconfigure failed\nSTDOUT:\n${reconfigure.stdout}\nSTDERR:\n${reconfigure.stderr}`);
    for (const target of TARGETS) {
      const after = await readFile(join(root, target.file), 'utf8');
      const titleNeedle = target.file === '.github/copilot-instructions.md'
        ? '# GitHub Copilot Repository Instructions'
        : `# ${target.file} - Dflow Project Instructions`;
      assert.equal(count(after, titleNeedle), 1, `[pristine ${target.key}] regenerated shim is not duplicated`);
      assert.equal(count(after, AGENT_SHIM_START), 0, `[pristine ${target.key}] regenerated whole-file shim stays marker-free`);
      assert.equal(await exists(join(root, target.snippet)), false, `[pristine ${target.key}] no snippet for a pristine shim`);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Malformed Dflow markers -> previewed snippet fallback + warning, file untouched.
  //    The warning must be visible in BOTH the preview and the final report, and the
  //    init entry point must surface it (init warning plumbing).
  // ---------------------------------------------------------------------------
  {
    // 4a. configure-agents path.
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    const malformed = `# Mine\n\n${AGENT_SHIM_START}\nhalf a block, no END marker\n`;
    await writeFile(filePath, malformed);
    const run = configure(root, '1');
    assert.equal(run.code, 0, `malformed-marker configure failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    assert.equal(await exists(join(root, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'malformed markers -> snippet fallback written');
    assert.equal(await readFile(filePath, 'utf8'), malformed, 'malformed-marker file left byte-untouched');
    assert.ok(count(run.stdout, 'malformed Dflow markers') >= 2, 'fallback warning visible in BOTH the preview and the final report');

    // 4b. init path (proves init now plumbs the agent-shim warning).
    const initRoot = join(tempRoot, `p${projectCounter += 1}`);
    await mkdir(initRoot, { recursive: true });
    await writeFile(join(initRoot, 'AGENTS.md'), `# Mine\n\n${AGENT_SHIM_START}\nstray start only\n`);
    const initRun = runDflow(initRoot, initInput('1'), ['init']);
    assert.equal(initRun.code, 0, `malformed-marker init failed\nSTDOUT:\n${initRun.stdout}\nSTDERR:\n${initRun.stderr}`);
    assert.match(initRun.stdout, /malformed Dflow markers/, 'init surfaces the agent-shim fallback warning');
    assert.equal(await exists(join(initRoot, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'init writes the fallback snippet');
  }

  // ---------------------------------------------------------------------------
  // 5. A guide-configured file the user wrote themselves is skipped (no duplicate
  //    guide pointer, no marker injected, untouched).
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const filePath = join(root, 'CLAUDE.md');
    const userGuideFile = '# My rules\n\nAlways read dflow/specs/shared/AI-AGENT-GUIDE.md before coding.\n';
    await writeFile(filePath, userGuideFile);
    const run = configure(root, '2');
    assert.equal(run.code, 0, `guide-configured skip failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    assert.match(run.stdout, /\| CLAUDE\.md \| skip \|/, 'a user-written guide-configured file is skipped');
    assert.equal(await readFile(filePath, 'utf8'), userGuideFile, 'guide-configured file left untouched');
    assert.equal(count(await readFile(filePath, 'utf8'), AGENT_SHIM_START), 0, 'no agent-shim block added to a guide-configured file');
    assert.equal(await exists(join(root, 'dflow/specs/shared/CLAUDE-md-snippet.md')), false, 'no snippet for a guide-configured file');
  }

  // ---------------------------------------------------------------------------
  // 6. Codex AGENTS.md + --command-adapters: base shim block + trigger block as two
  //    adjacent marked regions assembled into ONE plan item (one preview row, one
  //    write), idempotent on re-run.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    await writeFile(filePath, '# Team AGENTS rules\n');
    const run = configure(root, '1', ['--command-adapters']);
    assert.equal(run.code, 0, `codex base+trigger failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);

    const agentsRows = (run.stdout.match(/^\| AGENTS\.md \|/gm) || []).length;
    assert.equal(agentsRows, 1, 'AGENTS.md is a single plan item (base + trigger combined, not two clobbering items)');

    const content = await readFile(filePath, 'utf8');
    assert.match(content, /^# Team AGENTS rules/, 'user content preserved');
    assert.equal(count(content, AGENT_SHIM_START), 1, 'one base-shim block');
    assert.equal(count(content, TRIGGER_START), 1, 'one trigger block, adjacent to the base-shim block');
    assert.match(content, /## Dflow Text Triggers/, 'trigger block content present');
    assert.ok(content.indexOf(AGENT_SHIM_START) < content.indexOf(TRIGGER_START), 'base-shim block precedes the trigger block (adjacent, not nested)');
    assert.equal(await exists(join(root, 'dflow/specs/shared/AGENTS-md-snippet.md')), false, 'no snippet when injecting in place');

    const rerun = configure(root, '1', ['--command-adapters']);
    assert.equal(rerun.code, 0, `codex base+trigger re-run failed\nSTDOUT:\n${rerun.stdout}\nSTDERR:\n${rerun.stderr}`);
    const rerunContent = await readFile(filePath, 'utf8');
    assert.equal(count(rerunContent, AGENT_SHIM_START), 1, 'still one base-shim block after re-run');
    assert.equal(count(rerunContent, TRIGGER_START), 1, 'still one trigger block after re-run');
    assert.equal(rerunContent, content, 're-run leaves AGENTS.md byte-identical');
  }

  // ---------------------------------------------------------------------------
  // 7. A CRLF user file keeps CRLF: the injected block uses the file's dominant EOL.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    await writeFile(filePath, '# CRLF rules\r\nsecond line\r\n');
    const run = configure(root, '1');
    assert.equal(run.code, 0, `CRLF preservation failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    const raw = await readFile(filePath, 'utf8');
    assert.ok(raw.includes(`${AGENT_SHIM_START}\r\n`), 'injected markers use the file CRLF');
    assert.equal(/(?<!\r)\n/.test(raw), false, 'no bare LF remains in a CRLF file');
    assert.ok(raw.endsWith('\r\n'), 'file keeps a CRLF final newline');
    assert.match(raw, /^# CRLF rules/, 'CRLF user content preserved');
  }

  // ---------------------------------------------------------------------------
  // 8. Write-phase raw-equality guard (unit): a user-owned root agent file changed
  //    (or removed, or replaced by a non-file) between preview and write is never
  //    clobbered; an unchanged file is written.
  // ---------------------------------------------------------------------------
  {
    const root = join(tempRoot, `p${projectCounter += 1}`);
    await mkdir(root, { recursive: true });
    const target = join(root, 'AGENTS.md');
    const expected = '# Original\n';
    const planItem = () => ({
      relativePath: 'AGENTS.md',
      source: 'generated:agents-shim',
      notes: 'test',
      action: 'update',
      overwrite: true,
      rootInject: true,
      expectedContent: expected,
      content: '# Original\n\nINJECTED\n',
      size: 1
    });

    // Changed after preview -> skip + warn, user content kept.
    await writeFile(target, '# User edited after preview\n');
    const changed = await init.writeFilePlan(root, { items: [planItem()] });
    assert.deepEqual(changed.updated, [], 'changed-after-preview is not written');
    assert.deepEqual(changed.skipped, ['AGENTS.md'], 'changed-after-preview is skipped');
    assert.ok(changed.warnings.some((w) => w.includes('changed after the preview')), 'changed-after-preview warns to re-run');
    assert.equal(await readFile(target, 'utf8'), '# User edited after preview\n', 'changed file is left untouched');

    // Unchanged -> written.
    await writeFile(target, expected);
    const written = await init.writeFilePlan(root, { items: [planItem()] });
    assert.deepEqual(written.updated, ['AGENTS.md'], 'unchanged file is written');
    assert.equal(await readFile(target, 'utf8'), '# Original\n\nINJECTED\n', 'unchanged file receives the injected content');

    // Removed after preview -> skip + warn.
    await rm(target);
    const removed = await init.writeFilePlan(root, { items: [planItem()] });
    assert.deepEqual(removed.skipped, ['AGENTS.md'], 'removed-after-preview is skipped');
    assert.ok(removed.warnings.some((w) => w.includes('no longer exists')), 'removed-after-preview warns to re-run');

    // Replaced by a non-file (directory) after preview -> skip + warn, not clobbered.
    await mkdir(target, { recursive: true });
    const nonFile = await init.writeFilePlan(root, { items: [planItem()] });
    assert.deepEqual(nonFile.updated, [], 'non-file target is not written');
    assert.deepEqual(nonFile.skipped, ['AGENTS.md'], 'non-file target is skipped');
    assert.ok(nonFile.warnings.some((w) => w.includes('regular file')), 'non-file target warns to re-run');
    assert.ok((await stat(target)).isDirectory(), 'non-file target left as-is');
    await rm(target, { recursive: true });

    // A "skip" plan item must never write — even if its target vanished after preview.
    const skipItem = {
      relativePath: 'AGENTS.md',
      source: 'generated:agents-shim',
      notes: 'already configured',
      action: 'skip',
      intentionalSkip: true,
      content: '# SHOULD NOT BE WRITTEN\n',
      size: 1
    };
    const skipMissing = await init.writeFilePlan(root, { items: [skipItem] });
    assert.deepEqual(skipMissing.created, [], 'a skip item never creates its target');
    assert.deepEqual(skipMissing.skipped, ['AGENTS.md'], 'a vanished skip target is recorded as skipped');
    assert.equal(await exists(target), false, 'a skip item must not materialize a file the preview said it would leave alone');
  }

  // ---------------------------------------------------------------------------
  // 9. User content is preserved: a file with no final newline keeps its exact bytes
  //    as the prefix, and trailing blank lines are not stripped (only a one-blank-line
  //    separator is added before the block).
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const noNewline = join(root, 'AGENTS.md');
    const noNewlineContent = '# No trailing newline';
    await writeFile(noNewline, noNewlineContent);
    const run = configure(root, '1');
    assert.equal(run.code, 0, `byte-preservation (no newline) failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    assert.ok((await readFile(noNewline, 'utf8')).startsWith(`${noNewlineContent}\n\n${AGENT_SHIM_START}`), 'no-final-newline content preserved verbatim, one blank-line separator');

    const root2 = await newProject('none');
    const trailing = join(root2, 'AGENTS.md');
    const trailingContent = '# Trailing blanks\n\n\n';
    await writeFile(trailing, trailingContent);
    const run2 = configure(root2, '1');
    assert.equal(run2.code, 0, `byte-preservation (trailing blanks) failed\nSTDOUT:\n${run2.stdout}\nSTDERR:\n${run2.stderr}`);
    assert.ok((await readFile(trailing, 'utf8')).startsWith(trailingContent), 'trailing blank lines preserved, not stripped');
  }

  // ---------------------------------------------------------------------------
  // 10. Other unsafe marker shapes fall back to a snippet and leave the file alone:
  //     duplicated markers, reversed order, and cross-type agent/trigger interleave.
  // ---------------------------------------------------------------------------
  {
    const dup = `# Mine\n\n${AGENT_SHIM_START}\nblock A\n${AGENT_SHIM_END}\n\n${AGENT_SHIM_START}\nblock B\n${AGENT_SHIM_END}\n`;
    const root = await newProject('none');
    await writeFile(join(root, 'AGENTS.md'), dup);
    const run = configure(root, '1');
    assert.equal(run.code, 0, `duplicate-marker fallback failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    assert.equal(await readFile(join(root, 'AGENTS.md'), 'utf8'), dup, 'duplicate markers leave the file untouched');
    assert.equal(await exists(join(root, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'duplicate markers fall back to a snippet');

    const reversed = `# Mine\n\n${AGENT_SHIM_END}\nbody\n${AGENT_SHIM_START}\n`;
    const root2 = await newProject('none');
    await writeFile(join(root2, 'AGENTS.md'), reversed);
    const run2 = configure(root2, '1');
    assert.equal(run2.code, 0, `reversed-marker fallback failed\nSTDOUT:\n${run2.stdout}\nSTDERR:\n${run2.stderr}`);
    assert.equal(await readFile(join(root2, 'AGENTS.md'), 'utf8'), reversed, 'reversed markers leave the file untouched');
    assert.equal(await exists(join(root2, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'reversed markers fall back to a snippet');

    // Cross-type interleave: agent START, trigger START, agent END, trigger END. Each
    // pair looks well-formed alone, but the regions overlap and cannot be sliced safely.
    const interleaved = `# Mine\n\n${AGENT_SHIM_START}\n${TRIGGER_START}\n${AGENT_SHIM_END}\n${TRIGGER_END}\n`;
    const root3 = await newProject('none');
    await writeFile(join(root3, 'AGENTS.md'), interleaved);
    const run3 = configure(root3, '1', ['--command-adapters']);
    assert.equal(run3.code, 0, `cross-type interleave fallback failed\nSTDOUT:\n${run3.stdout}\nSTDERR:\n${run3.stderr}`);
    assert.equal(await readFile(join(root3, 'AGENTS.md'), 'utf8'), interleaved, 'cross-type interleaved markers leave the file untouched');
    assert.equal(await exists(join(root3, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'cross-type interleave falls back to a snippet');

    // Same interleave on a NON-(--command-adapters) run must also fall back: case 2b
    // would otherwise slice the agent-shim region and delete the overlapping trigger
    // markers. The trigger region is classified for safety even without the flag.
    const root4 = await newProject('none');
    await writeFile(join(root4, 'AGENTS.md'), interleaved);
    const run4 = configure(root4, '1');
    assert.equal(run4.code, 0, `cross-type interleave (no adapters) fallback failed\nSTDOUT:\n${run4.stdout}\nSTDERR:\n${run4.stderr}`);
    assert.equal(await readFile(join(root4, 'AGENTS.md'), 'utf8'), interleaved, 'cross-type interleave (no adapters) leaves the file untouched');
    assert.equal(await exists(join(root4, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'cross-type interleave (no adapters) falls back to a snippet');

    // Malformed trigger markers STRADDLING a well-formed agent-shim block on a
    // non-adapter run: a trigger START outside before the block, a duplicate trigger
    // START inside it, and a trigger END outside after it. Slicing the agent block
    // would delete the inside START and leave the outside START/END wrapping the
    // refreshed block — must fall back, not rewrite.
    const straddle = `# Mine\n\n${TRIGGER_START}\n${AGENT_SHIM_START}\nagent body\n${TRIGGER_START}\n${AGENT_SHIM_END}\n${TRIGGER_END}\n`;
    const root5 = await newProject('none');
    await writeFile(join(root5, 'AGENTS.md'), straddle);
    const run5 = configure(root5, '1');
    assert.equal(run5.code, 0, `straddling-trigger fallback failed\nSTDOUT:\n${run5.stdout}\nSTDERR:\n${run5.stderr}`);
    assert.equal(await readFile(join(root5, 'AGENTS.md'), 'utf8'), straddle, 'trigger markers straddling the agent block leave the file untouched (non-adapter)');
    assert.equal(await exists(join(root5, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'straddling trigger markers fall back to a snippet');

    // Reverse straddle (trigger END inside, trigger START outside-after) is the same
    // boundary cross and must also fall back.
    const reverseStraddle = `# Mine\n\n${AGENT_SHIM_START}\nagent body\n${TRIGGER_END}\n${AGENT_SHIM_END}\n${TRIGGER_START}\n`;
    const root6 = await newProject('none');
    await writeFile(join(root6, 'AGENTS.md'), reverseStraddle);
    const run6 = configure(root6, '1');
    assert.equal(run6.code, 0, `reverse-straddle fallback failed\nSTDOUT:\n${run6.stdout}\nSTDERR:\n${run6.stderr}`);
    assert.equal(await readFile(join(root6, 'AGENTS.md'), 'utf8'), reverseStraddle, 'reverse straddle leaves the file untouched');
    assert.equal(await exists(join(root6, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'reverse straddle falls back to a snippet');

    // The straddle guard runs on the LF-normalized content; a CRLF straddle file must
    // fall back identically and stay byte-for-byte CRLF.
    const crlfStraddle = straddle.replace(/\n/g, '\r\n');
    const root7 = await newProject('none');
    await writeFile(join(root7, 'AGENTS.md'), crlfStraddle);
    const run7 = configure(root7, '1');
    assert.equal(run7.code, 0, `CRLF-straddle fallback failed\nSTDOUT:\n${run7.stdout}\nSTDERR:\n${run7.stderr}`);
    assert.equal(await readFile(join(root7, 'AGENTS.md'), 'utf8'), crlfStraddle, 'CRLF straddle leaves the file byte-for-byte untouched');
    assert.equal(await exists(join(root7, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'CRLF straddle falls back to a snippet');
  }

  // ---------------------------------------------------------------------------
  // 11. A guide-configured Codex file whose trigger markers are malformed falls back
  //     to the trigger-ONLY snippet (the base shim is already present; OQ#6c).
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    const content = `# My AGENTS\n\nRead dflow/specs/shared/AI-AGENT-GUIDE.md first.\n\n${TRIGGER_START}\ndangling trigger start, no end\n`;
    await writeFile(filePath, content);
    const run = configure(root, '1', ['--command-adapters']);
    assert.equal(run.code, 0, `guide-configured malformed-trigger fallback failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    assert.equal(await readFile(filePath, 'utf8'), content, 'file left untouched on malformed trigger markers');
    const triggerSnippet = join(root, 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md');
    assert.equal(await exists(triggerSnippet), true, 'falls back to the trigger-only snippet');
    assert.equal(await exists(join(root, 'dflow/specs/shared/AGENTS-md-snippet.md')), false, 'the full-shim snippet is not used for a guide-configured file');
    assert.match(run.stdout, /AGENTS-md-command-adapters-snippet\.md/, 'fallback warning names the trigger-only snippet path');
    const snippetContent = await readFile(triggerSnippet, 'utf8');
    assert.match(snippetContent, /## Dflow Text Triggers/, 'trigger-only snippet contains the trigger section');
    assert.doesNotMatch(snippetContent, /Dflow Project Instructions/, 'trigger-only snippet does not duplicate the base shim');
  }

  // ---------------------------------------------------------------------------
  // 11b. The same malformed-trigger Codex file but WITHOUT a guide reference (and with
  //      no agent-shim block at all) cannot take the trigger-only path: the base shim
  //      is not present, so the fallback is the FULL-shim snippet, which under
  //      --command-adapters embeds the trigger section (base title + trigger together).
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    const content = `# My AGENTS\n\nTeam rules, no guide pointer.\n\n${TRIGGER_START}\ndangling trigger start, no end\n`;
    await writeFile(filePath, content);
    const run = configure(root, '1', ['--command-adapters']);
    assert.equal(run.code, 0, `no-guide malformed-trigger full-shim fallback failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    assert.equal(await readFile(filePath, 'utf8'), content, 'file left byte-untouched on malformed trigger markers');
    const fullSnippet = join(root, 'dflow/specs/shared/AGENTS-md-snippet.md');
    assert.equal(await exists(fullSnippet), true, 'falls back to the full-shim snippet (no base shim present to take the trigger-only path)');
    assert.equal(await exists(join(root, 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md')), false, 'the trigger-only snippet is not used when the base shim is missing');
    assert.match(run.stdout, /AGENTS-md-snippet\.md/, 'fallback warning names the full-shim snippet path');
    const snippetContent = await readFile(fullSnippet, 'utf8');
    assert.match(snippetContent, /Dflow Project Instructions/, 'full-shim snippet carries the base shim title');
    assert.match(snippetContent, /## Dflow Text Triggers/, 'full-shim snippet embeds the trigger section under --command-adapters');
  }

  // ---------------------------------------------------------------------------
  // 12. A CRLF user file stays CRLF and is idempotent across re-runs.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    await writeFile(filePath, '# CRLF project\r\nrule one\r\n');
    const first = configure(root, '1');
    assert.equal(first.code, 0, `CRLF idempotent first run failed\nSTDOUT:\n${first.stdout}\nSTDERR:\n${first.stderr}`);
    const afterFirst = await readFile(filePath, 'utf8');
    assert.equal(/(?<!\r)\n/.test(afterFirst), false, 'first run keeps the file all-CRLF');
    assert.ok(afterFirst.startsWith('# CRLF project\r\nrule one\r\n'), 'CRLF user content preserved verbatim');
    const second = configure(root, '1');
    assert.equal(second.code, 0, `CRLF idempotent re-run failed\nSTDOUT:\n${second.stdout}\nSTDERR:\n${second.stderr}`);
    assert.equal(await readFile(filePath, 'utf8'), afterFirst, 'CRLF re-run is byte-identical (idempotent)');
    assert.equal(count(afterFirst, AGENT_SHIM_START), 1, 'CRLF re-run keeps exactly one block');
    assert.match(second.stdout, /\| AGENTS\.md \| skip \|/, 'CRLF re-run is a no-op skip');
  }

  // ---------------------------------------------------------------------------
  // 13. OQ#6c trigger install into a guide-configured file with NO trigger block keeps
  //     the user's trailing whitespace (the trigger-upsert append must not strip).
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    const content = '# My AGENTS\n\nRead dflow/specs/shared/AI-AGENT-GUIDE.md first.\n\n\n';
    await writeFile(filePath, content);
    const run = configure(root, '1', ['--command-adapters']);
    assert.equal(run.code, 0, `OQ#6c trigger install (trailing blanks) failed\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    const after = await readFile(filePath, 'utf8');
    assert.ok(after.startsWith(content), 'guide-configured prefix + trailing blank lines preserved when installing triggers');
    assert.match(after, /## Dflow Text Triggers/, 'trigger block installed into the guide-configured file');
    assert.equal(count(after, TRIGGER_START), 1, 'exactly one trigger block');
    assert.equal(count(after, AGENT_SHIM_START), 0, 'base shim not re-injected into a guide-configured file');
    assert.equal(await exists(join(root, 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md')), false, 'no snippet when the trigger installs in place');
  }

  // ---------------------------------------------------------------------------
  // 14. Trigger region is classified on every AGENTS.md run for safety, but that must
  //     not over-trigger fallbacks on a non-adapter run.
  // ---------------------------------------------------------------------------
  {
    // 14a. A file carrying BOTH blocks (adjacent, from a prior --command-adapters run)
    //      is refreshed-in-place, not bailed out, on a later non-adapter run.
    const root = await newProject('none');
    const filePath = join(root, 'AGENTS.md');
    await writeFile(filePath, '# Team rules\n');
    const adapters = configure(root, '1', ['--command-adapters']);
    assert.equal(adapters.code, 0, `both-blocks setup failed\nSTDOUT:\n${adapters.stdout}\nSTDERR:\n${adapters.stderr}`);
    const withBoth = await readFile(filePath, 'utf8');
    assert.equal(count(withBoth, AGENT_SHIM_START), 1, 'setup has one base-shim block');
    assert.equal(count(withBoth, TRIGGER_START), 1, 'setup has one trigger block');
    const plain = configure(root, '1');
    assert.equal(plain.code, 0, `both-blocks non-adapter re-run failed\nSTDOUT:\n${plain.stdout}\nSTDERR:\n${plain.stderr}`);
    assert.equal(await readFile(filePath, 'utf8'), withBoth, 'non-adapter re-run preserves both adjacent blocks byte-identically');
    assert.equal(await exists(join(root, 'dflow/specs/shared/AGENTS-md-snippet.md')), false, 'adjacent both-blocks file does not fall back on a non-adapter run');
    assert.match(plain.stdout, /\| AGENTS\.md \| skip \|/, 'a current both-blocks file is a no-op skip on a non-adapter run');

    // 14b. A guide-configured file with a malformed trigger marker on a NON-adapter run
    //      is skipped (we never manage the trigger there), not bailed to a base snippet.
    const root2 = await newProject('none');
    const filePath2 = join(root2, 'AGENTS.md');
    const guideOrphan = `# Mine\n\nRead dflow/specs/shared/AI-AGENT-GUIDE.md.\n\n${TRIGGER_START}\norphan trigger\n`;
    await writeFile(filePath2, guideOrphan);
    const plain2 = configure(root2, '1');
    assert.equal(plain2.code, 0, `guide-configured orphan-trigger non-adapter run failed\nSTDOUT:\n${plain2.stdout}\nSTDERR:\n${plain2.stderr}`);
    assert.match(plain2.stdout, /\| AGENTS\.md \| skip \|/, 'a guide-configured file is skipped on a non-adapter run despite trigger junk');
    assert.equal(await readFile(filePath2, 'utf8'), guideOrphan, 'the file is left untouched');
    assert.equal(await exists(join(root2, 'dflow/specs/shared/AGENTS-md-snippet.md')), false, 'a non-adapter run does not write a pointless base snippet for a configured file');
    assert.equal(await exists(join(root2, 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md')), false, 'a non-adapter run never writes the trigger-only snippet');
  }

  await rm(tempRoot, { recursive: true, force: true });
  console.log('PROPOSAL-054 agent-inject tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
