// Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE.
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

function runDflow(cwd, input, args, env = process.env) {
  const result = spawnSync(process.execPath, [dflowBin, ...args], {
    cwd,
    input,
    env,
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
  // 3b. A v0.9.0-era whole-file Claude shim (old "Before planning or editing
  //     code" wording + the legacy Markdown @import) is recognized as pristine
  //     and regenerated to the CURRENT scoped wording without the import, so the
  //     progressive-disclosure upgrade reaches existing projects.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');
    const claudePath = join(root, 'CLAUDE.md');
    const freshShim = await readFile(claudePath, 'utf8');
    const legacyV090 = `# CLAUDE.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\` — command registry, routing rules, and project context.
- \`dflow/specs/shared/dflow-workflows/\` — vendored workflow bundle with executable step definitions.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
If your tool supports Markdown imports, the canonical guide is imported below:

@dflow/specs/shared/AI-AGENT-GUIDE.md
`;
    await writeFile(claudePath, legacyV090);

    const upgrade = configure(root, '1,2,3');
    assert.equal(upgrade.code, 0, `legacy v0.9.0 upgrade failed\nSTDOUT:\n${upgrade.stdout}\nSTDERR:\n${upgrade.stderr}`);
    const upgraded = await readFile(claudePath, 'utf8');
    assert.doesNotMatch(upgraded, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'legacy @import is removed on upgrade');
    assert.doesNotMatch(upgraded, /Before planning or editing code/, 'old eager-read wording is replaced');
    assert.match(upgraded, /For spec-impacting work/, 'regenerated to the current scoped wording');
    assert.match(upgraded, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'upgraded shim still points to the canonical guide');
    assert.equal(count(upgraded, AGENT_SHIM_START), 0, 'regenerated whole-file shim stays marker-free');
    assert.equal(await exists(join(root, 'dflow/specs/shared/CLAUDE-md-snippet.md')), false, 'legacy shim regenerated in place, not parked as a snippet');
    // The invariant, stated as equality rather than as phrases. A phrase pin has
    // to be re-chosen every time the body changes and silently keeps passing when
    // it is not: this file asserted `/proceed normally/`, which matched both the
    // pre-P082 body and the one that replaced it, so it could not see the reword
    // it was standing guard over.
    assert.equal(upgraded, freshShim, 'a recognized legacy shim is regenerated to exactly what a fresh init writes today');
  }

  // ---------------------------------------------------------------------------
  // 3c. The legacy-import upgrade tolerates CRLF and editor-added trailing
  //     whitespace in the old @import block (normalize-then-strip).
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');
    const claudePath = join(root, 'CLAUDE.md');
    const fresh = await readFile(claudePath, 'utf8');
    const messyImport = '\nIf your tool supports Markdown imports, the canonical guide is imported below:  \n   \n@dflow/specs/shared/AI-AGENT-GUIDE.md  \n';
    const messy = `${fresh.replace(/\n+$/, '')}${messyImport}`.replace(/\n/g, '\r\n');
    await writeFile(claudePath, messy);

    const upgrade = configure(root, '1,2,3');
    assert.equal(upgrade.code, 0, `messy legacy-import upgrade failed\nSTDOUT:\n${upgrade.stdout}\nSTDERR:\n${upgrade.stderr}`);
    const upgraded = await readFile(claudePath, 'utf8');
    assert.doesNotMatch(upgraded, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'legacy @import removed despite CRLF + trailing whitespace');
    assert.match(upgraded, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'upgraded messy shim still points to the canonical guide');
  }

  // ---------------------------------------------------------------------------
  // 3d. The legacy-import strip is scoped to CLAUDE.md. A user-added exact
  //     @import block in an AGENTS.md is NOT treated as pristine, so the user
  //     edit is preserved (skipped), not silently regenerated away.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');
    const agentsPath = join(root, 'AGENTS.md');
    const fresh = await readFile(agentsPath, 'utf8');
    const userImport = '\nIf your tool supports Markdown imports, the canonical guide is imported below:\n\n@dflow/specs/shared/AI-AGENT-GUIDE.md\n';
    const edited = `${fresh.replace(/\n+$/, '')}${userImport}`;
    await writeFile(agentsPath, edited);

    const reconfigure = configure(root, '1,2,3');
    assert.equal(reconfigure.code, 0, `agents scoping reconfigure failed\nSTDOUT:\n${reconfigure.stdout}\nSTDERR:\n${reconfigure.stderr}`);
    const after = await readFile(agentsPath, 'utf8');
    assert.match(after, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'user-added @import in a non-Claude shim is preserved (legacy strip is Claude-scoped)');
    assert.equal(after, edited, 'AGENTS.md with a user-added import is left byte-identical (skipped, not regenerated)');
  }

  // ---------------------------------------------------------------------------
  // 3e. PROPOSAL-082 batch 3 — the 0.10.0–0.14.0 whole-file shim (scoped wording,
  //     but the unqualified "routine work" paragraph) is recognized as pristine
  //     and regenerated to the narrowed wording. This is the upgrade every
  //     existing adopter takes, and it is the case a body change breaks: miss the
  //     frozen-set entry and the shim stops matching, degrades to the
  //     "not marker-managed" branch, and keeps the superseded body forever.
  //
  //     One case per FROZEN_SHIM_BODY_BUILDERS entry — 3b covers the v0.9.0 body,
  //     this covers 0.10–0.14. Adding a body means adding a case here.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');
    const claudePath = join(root, 'CLAUDE.md');
    const freshShim = await readFile(claudePath, 'utf8');
    const unqualifiedRoutine = `# CLAUDE.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

For spec-impacting work — a new feature, a change to product, user-facing, or
domain behavior, a new requirement, or a bug-fix workflow — read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\` — command registry, routing rules, and project context.
- \`dflow/specs/shared/dflow-workflows/\` — vendored workflow bundle with executable step definitions.

For routine work (refactors, renames, chores, formatting, dependency bumps, or
general code questions), proceed normally; you need not read the guide first.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
`;
    await writeFile(claudePath, unqualifiedRoutine);

    const upgrade = configure(root, '1,2,3');
    assert.equal(upgrade.code, 0, `0.14 shim upgrade failed\nSTDOUT:\n${upgrade.stdout}\nSTDERR:\n${upgrade.stderr}`);
    const upgraded = await readFile(claudePath, 'utf8');
    assert.equal(upgraded, freshShim, 'a 0.10–0.14 shim is regenerated to exactly what a fresh init writes today');
    assert.notEqual(upgraded, unqualifiedRoutine, 'the upgrade actually rewrote the body — a no-op here would mean the shim was skipped, not regenerated');
    assert.equal(count(upgraded, AGENT_SHIM_START), 0, 'regenerated whole-file shim stays marker-free');
    assert.equal(await exists(join(root, 'dflow/specs/shared/CLAUDE-md-snippet.md')), false, '0.14 shim regenerated in place, not parked as a snippet');
    assert.doesNotMatch(upgrade.all ?? `${upgrade.stdout}${upgrade.stderr}`, /stays frozen on upgrade/, 'a recognized shim must not fall through to the frozen-wording warning');
  }

  // ---------------------------------------------------------------------------
  // 3f. The v0.1.1–v0.7.0 whole-file shim (one guide bullet, no workflow-bundle
  //     bullet, "The Dflow guide above is the single source of truth") is
  //     recognized and regenerated.
  //
  //     This body was MISSING from the frozen set when the list was introduced,
  //     while the list's own comment said "oldest first". Seven released
  //     versions' worth of projects were stranded, and no test could see it
  //     because every case used a newer body.
  //
  //     The range starts at v0.1.1, not v0.1.0: at v0.1.0 init wrote CLAUDE.md
  //     from the packaged snippet through a different path, with per-project
  //     substitutions, so there is no fixed body to freeze. See the ⚠ note on
  //     buildPreBundleAgentShimBody.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');
    const claudePath = join(root, 'CLAUDE.md');
    const freshShim = await readFile(claudePath, 'utf8');
    const preBundle = `# CLAUDE.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\`

Keep tool-specific instruction files small. The Dflow guide above is the
single source of truth for project workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
`;
    await writeFile(claudePath, preBundle);

    const upgrade = configure(root, '1,2,3');
    assert.equal(upgrade.code, 0, `v0.1-v0.7 shim upgrade failed\nSTDOUT:\n${upgrade.stdout}\nSTDERR:\n${upgrade.stderr}`);
    const upgraded = await readFile(claudePath, 'utf8');
    assert.equal(upgraded, freshShim, 'a v0.1-v0.7 shim is regenerated to exactly what a fresh init writes today');
    assert.doesNotMatch(upgraded, /single source of truth/, 'the pre-bundle wording is gone');
    assert.doesNotMatch(`${upgrade.stdout}${upgrade.stderr}`, /stays frozen on upgrade/, 'a recognized pre-bundle shim must not fall through to the frozen-wording warning');
  }

  // ---------------------------------------------------------------------------
  // 3g. The composition case: AGENTS.md carrying a codex trigger block. This is
  //     the only path where stripCodexTriggerBlock participates in the frozen
  //     match, and every other frozen-body case is CLAUDE.md-only. The body must
  //     upgrade while the trigger region survives.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');
    const agentsPath = join(root, 'AGENTS.md');
    const withTriggers = configure(root, '1,2,3', ['--command-adapters']);
    assert.equal(withTriggers.code, 0, `trigger install failed\nSTDOUT:\n${withTriggers.stdout}\nSTDERR:\n${withTriggers.stderr}`);
    const freshWithTriggers = await readFile(agentsPath, 'utf8');
    assert.ok(freshWithTriggers.includes(TRIGGER_START), 'precondition: AGENTS.md carries a trigger block');

    // Rewind just the body to the 0.10–0.14 wording, keeping the trigger block.
    const staleBody = freshWithTriggers.replace(
      // ⚠ BOTH anchors are whitespace-tolerant on purpose: they are literals on a
      // paragraph that gets re-wrapped whenever a clause is added, and a rewrap
      // that moves a line break silently turns this replace into a no-op. The
      // `notEqual` precondition below still proves the rewind happened, so
      // widening the match cannot produce a false pass. (The tail was relaxed
      // first and the head left alone — which put the identical latent break one
      // clause over, since the head also ends exactly at a line boundary.
      // Relaxing one literal and not its twin is this repo's recurring shape.)
      /For\s+routine\s+work\s+\(refactors,\s+renames,\s+chores,\s+formatting,\s+routine\s+dependency[\s\S]*?it\s+decides,\s+not\s+this\s+page\./,
      'For routine work (refactors, renames, chores, formatting, dependency bumps, or\ngeneral code questions), proceed normally; you need not read the guide first.'
    );
    assert.notEqual(staleBody, freshWithTriggers, 'precondition: the body was actually rewound');
    await writeFile(agentsPath, staleBody);

    const upgrade = configure(root, '1,2,3', ['--command-adapters']);
    assert.equal(upgrade.code, 0, `AGENTS.md trigger-variant upgrade failed\nSTDOUT:\n${upgrade.stdout}\nSTDERR:\n${upgrade.stderr}`);
    const upgraded = await readFile(agentsPath, 'utf8');
    assert.equal(upgraded, freshWithTriggers, 'an AGENTS.md with a trigger block upgrades its body and keeps the trigger region');
    assert.equal(count(upgraded, TRIGGER_START), 1, 'the trigger block is neither dropped nor duplicated');
    assert.doesNotMatch(`${upgrade.stdout}${upgrade.stderr}`, /stays frozen on upgrade/, 'the trigger block must not defeat the frozen match');
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

    // A re-run over the same file writes the snippet again although its content
    // has not changed: the warning says the snippet is written this run, so it
    // is an `update` and is reported as written, never an already-current skip.
    const rerun = configure(root, '1');
    assert.equal(rerun.code, 0, `malformed-marker re-run failed\nSTDOUT:\n${rerun.stdout}\nSTDERR:\n${rerun.stderr}`);
    assert.match(rerun.stdout, /\| dflow\/specs\/shared\/AGENTS-md-snippet\.md \| update \|/, 're-run previews the unchanged fallback snippet as update');
    assert.doesNotMatch(rerun.stdout, /AGENTS-md-snippet\.md \| skip \|/, 're-run never previews the fallback snippet as an already-current skip');
    assert.match(rerun.stdout, /^Updated:\n(?:- .*\n)*- dflow\/specs\/shared\/AGENTS-md-snippet\.md$/m, 're-run reports the fallback snippet as written');
    assert.equal(await readFile(filePath, 'utf8'), malformed, 'malformed-marker file still left byte-untouched on re-run');

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

  // ---------------------------------------------------------------------------
  // 15. PROPOSAL-082 batch 3 — the six docs/using-with-*.md each quote the shim
  //     for their own agent verbatim inside a ```markdown fence, introduced by a
  //     sentence saying this is what `dflow init` writes. Nothing verified that
  //     claim and it went false: on 2026-08-01 all six docs narrowed the routine
  //     paragraph while lib/init.js kept emitting the old one, so for two days the
  //     docs described output the CLI did not produce. Byte equality, so it breaks
  //     whichever side drifts.
  // ---------------------------------------------------------------------------
  {
    const firstMarkdownFence = (content, context) => {
      const lines = content.replace(/\r\n/g, '\n').split('\n');
      const start = lines.indexOf('```markdown');
      assert.ok(start >= 0, `${context}: expected a \`\`\`markdown fence quoting the generated shim`);
      const end = lines.indexOf('```', start + 1);
      assert.ok(end > start, `${context}: the \`\`\`markdown fence is unterminated`);
      return lines.slice(start + 1, end).join('\n').trimEnd();
    };

    const root = await newProject('1,2,3');
    const quotedBy = [
      ['docs/using-with-codex.md', 'AGENTS.md'],
      ['docs/using-with-codex.en.md', 'AGENTS.md'],
      ['docs/using-with-claude-code.md', 'CLAUDE.md'],
      ['docs/using-with-claude-code.en.md', 'CLAUDE.md'],
      ['docs/using-with-github-copilot.md', '.github/copilot-instructions.md'],
      ['docs/using-with-github-copilot.en.md', '.github/copilot-instructions.md']
    ];

    for (const [docRel, shimRel] of quotedBy) {
      const doc = await readFile(join(repoRoot, docRel), 'utf8');
      const quoted = firstMarkdownFence(doc, docRel);
      const generated = (await readFile(join(root, shimRel), 'utf8')).replace(/\r\n/g, '\n').trimEnd();
      assert.equal(quoted, generated, `${docRel} quotes the ${shimRel} shim; it must byte-match what dflow init writes`);
    }
  }

  // ---------------------------------------------------------------------------
  // 16. PROPOSAL-082 batch 3 — the tutorial shim / skill fixtures are verbatim
  //     projections, so they are checkable rather than curated. They went stale
  //     the same way the docs did: templates/common/skill/SKILL.md was rewritten
  //     on 2026-08-01 and all four skill fixtures kept the superseded
  //     description, with nothing to say so.
  //
  //     Scope note: this covers ONLY the fixtures that are verbatim projections.
  //     Other tutorial outputs are deliberately abridged walkthrough evidence
  //     (cf. the `_conventions` fixtures, marked abridged by user decision in
  //     cf0ef17) and must NOT be pulled into a byte-equality rule.
  // ---------------------------------------------------------------------------
  {
    const root = await newProject('1,2,3');

    const shimFixtures = [
      ['tutorial/01-greenfield/outputs/AGENTS.md', 'AGENTS.md'],
      ['tutorial/01-greenfield/outputs/CLAUDE.md', 'CLAUDE.md'],
      ['tutorial/01-greenfield/outputs/.github/copilot-instructions.md', '.github/copilot-instructions.md'],
      ['tutorial/02-brownfield/outputs/CLAUDE.md', 'CLAUDE.md']
    ];
    for (const [fixtureRel, shimRel] of shimFixtures) {
      const fixture = (await readFile(join(repoRoot, fixtureRel), 'utf8')).replace(/\r\n/g, '\n').trimEnd();
      const generated = (await readFile(join(root, shimRel), 'utf8')).replace(/\r\n/g, '\n').trimEnd();
      assert.equal(fixture, generated, `${fixtureRel} is a verbatim shim projection; it must match what dflow init writes`);
    }

    const skillSource = (await readFile(join(repoRoot, 'templates/common/skill/SKILL.md'), 'utf8')).replace(/\r\n/g, '\n').trimEnd();
    const skillFixtures = [
      'tutorial/01-greenfield/outputs/.agents/skills/dflow/SKILL.md',
      'tutorial/01-greenfield/outputs/.claude/skills/dflow/SKILL.md',
      'tutorial/01-greenfield/outputs/.github/skills/dflow/SKILL.md',
      'tutorial/02-brownfield/outputs/.claude/skills/dflow/SKILL.md'
    ];
    for (const fixtureRel of skillFixtures) {
      const fixture = (await readFile(join(repoRoot, fixtureRel), 'utf8')).replace(/\r\n/g, '\n').trimEnd();
      assert.equal(fixture, skillSource, `${fixtureRel} is a verbatim projection of templates/common/skill/SKILL.md`);
    }

    // The architecture-decisions README is projected verbatim too — no
    // placeholders — so it belongs in the byte-pinned class. It was found
    // carrying a superseded seed comment (`Template maintained by Dflow …`
    // instead of `Seeded by Dflow.`) precisely because nothing compared it.
    const readmeFixture = 'tutorial/01-greenfield/outputs/dflow/specs/architecture/decisions/README.md';
    assert.equal(
      (await readFile(join(repoRoot, readmeFixture), 'utf8')).replace(/\r\n/g, '\n').trimEnd(),
      (await readFile(join(repoRoot, 'templates/greenfield/scaffolding/architecture-decisions-README.md'), 'utf8')).replace(/\r\n/g, '\n').trimEnd(),
      `${readmeFixture} is a verbatim projection of its scaffolding template`
    );

    // ⚠ SCOPE, stated precisely because the first version of this block claimed
    // more than it enforced. This rule governs the fixtures projected VERBATIM —
    // no placeholder substitution — which is the shim / skill / decisions-README
    // set below. It does NOT govern filled scaffolding (`_overview.md`,
    // `_conventions.md`, `Git-principles-*.md`) or the walkthrough's domain
    // documents: the tutorial legitimately fills those in, so byte-equality is
    // the wrong rule for them and asserting it would be noise, not a guard.
    //
    // Those filled fixtures consequently have NO drift guard at all. That is a
    // real gap, not a covered case — 12 of them still carry a seed comment
    // retired long ago, which is how it was found. Recorded as debt 11 in
    // `planning/p082-p083-implementation-handoff.md` rather than left implied.
    const pinned = new Set([...shimFixtures.map(([f]) => f), ...skillFixtures, readmeFixture]);
    // `_conventions.md` and `AI-AGENT-GUIDE.md` stay on this list even though
    // they are NOT byte-pinned: they are the files the abridgement arm exists
    // for. Narrowing the list to the pinned basenames made every candidate a
    // member of `pinned`, so the `continue` fired every time and the
    // abridgement branch became unreachable — a check that cannot execute,
    // while its comment still cited those very fixtures as the case it governs.
    const projectedNames = ['SKILL.md', 'CLAUDE.md', 'AGENTS.md', 'copilot-instructions.md', '_conventions.md', 'AI-AGENT-GUIDE.md'];
    const abridgementMarkers = ['節錄版', 'abridged'];
    // git ls-files, not a glob: the skill fixtures live under `.claude/`,
    // `.agents/` and `.github/`, and a default glob skips dot-directories —
    // which silently dropped exactly the fixtures this rule is about.
    const listed = spawnSync('git', ['ls-files', 'tutorial'], { cwd: repoRoot, encoding: 'utf8' });
    assert.equal(listed.status, 0, `git ls-files failed: ${listed.stderr}`);
    const candidates = listed.stdout.split('\n')
      .map((p) => p.trim().replace(/\\/g, '/'))
      .filter((p) => /^tutorial\/[^/]+\/outputs\//.test(p) && projectedNames.includes(p.split('/').pop()));
    // Membership, not a count. Comparing sizes left the guard satisfied when a
    // pinned fixture was renamed away, because some other file kept the total up.
    for (const rel of pinned) {
      if (rel === readmeFixture) continue; // asserted directly above, different basename set
      assert.ok(candidates.includes(rel), `pinned fixture ${rel} is no longer listed by git — it was renamed or deleted without updating this section`);
    }
    // The abridgement arm must actually run. It silently became unreachable once
    // already, when every candidate was also pinned — the check reported success
    // by never executing, which is the shape this whole section is against.
    const unpinned = candidates.filter((rel) => !pinned.has(rel));
    assert.ok(
      unpinned.length > 0,
      'the abridgement arm has no candidates left to check — every projected-artifact fixture is byte-pinned, so this branch is dead code. Either it is genuinely obsolete (delete it) or projectedNames was narrowed too far.'
    );
    for (const rel of unpinned) {
      const body = await readFile(join(repoRoot, rel), 'utf8');
      const abridged = abridgementMarkers.some((marker) => body.includes(marker));
      assert.ok(
        abridged,
        `${rel} is a tutorial copy of a projected artifact but is neither byte-pinned in this section nor marked abridged. Add it to the lists above, or give it an in-file abridgement note saying what it omits.`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 17. dist #22 — an agent file that git ignores is not versioned on the current
  //     branch, so the preview warns where Dflow first brings its wording into it:
  //     an existing ignored file it appends to (init and configure-agents), and
  //     an ignored path it creates (inside an ignored directory too). The warning
  //     comes before the confirmation and adds no question. Silent: a re-run on
  //     files that already carry Dflow wording, a tracked file that an ignore
  //     pattern also matches, a repository that ignores nothing, and a directory
  //     outside any git work tree (with or without git). Inside a work tree, a git
  //     that is missing, fails or does not answer in time gives a note that Dflow
  //     could not tell — and without git the plan and the written file are the same.
  //     Every git and CLI run here uses `isolatedGit`: the developer's own global
  //     or system git configuration (a global excludes file that ignores
  //     CLAUDE.md, say) and a repository above the temporary directory must not
  //     decide what these assertions see.
  // ---------------------------------------------------------------------------
  {
    const gitHome = join(tempRoot, 'git-home');
    await mkdir(gitHome, { recursive: true });
    const emptyGitConfig = join(gitHome, 'gitconfig');
    await writeFile(emptyGitConfig, '');
    const isolatedGit = {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: emptyGitConfig,
      HOME: gitHome,
      XDG_CONFIG_HOME: gitHome,
      GIT_CEILING_DIRECTORIES: tempRoot
    };
    // Windows keeps the variable as `Path`: drop every spelling before setting it.
    const withPath = (pathValue) => ({
      ...Object.fromEntries(Object.entries(isolatedGit).filter(([key]) => key.toUpperCase() !== 'PATH')),
      PATH: pathValue
    });
    const git = (cwd, args) => {
      const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: isolatedGit });
      assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
    };
    const newRepo = async (dir, files) => {
      const root = join(tempRoot, dir);
      await mkdir(root, { recursive: true });
      git(root, ['init', '-q']);
      for (const [rel, content] of Object.entries(files)) {
        await mkdir(dirname(join(root, rel)), { recursive: true });
        await writeFile(join(root, rel), content);
      }
      return root;
    };
    const init = (root, agents, env = isolatedGit) => {
      const run = runDflow(root, initInput(agents), ['init'], env);
      assert.equal(run.code, 0, `[#22] init failed in ${root}\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
      return run;
    };
    const planRows = (stdout) => stdout.split('\n').filter((line) => /^\| .+ \| (create|update|skip) \|/.test(line));
    const IGNORED = /is ignored by git/;
    const IGNORED_FILES = { '.gitignore': 'CLAUDE.md\nAGENTS.md\n', 'CLAUDE.md': '# My Claude rules\n' };

    // Append to an ignored existing file, create an ignored path; same basename
    // as the no-git twin below, so the two plans are comparable row by row.
    const root = await newRepo('i22-with-git/proj', IGNORED_FILES);
    const run = init(root, '1,2');
    const appendWarning = /CLAUDE\.md is ignored by git, so the Dflow block added to it is not versioned on this branch/;
    assert.match(run.stdout, appendWarning, '[#22] appending to an ignored existing file warns');
    assert.match(run.stdout, /AGENTS\.md is ignored by git, so the AGENTS\.md Dflow creates is not versioned on this branch/, '[#22] creating an ignored file warns');
    assert.ok(run.stdout.search(appendWarning) < run.stdout.indexOf('Create these files?'), '[#22] the warning is in the preview, before the confirmation');
    assert.match(run.stdout, /if the branch you switch to tracks CLAUDE\.md — replaces it with that branch's version without asking, and your own changes to it are lost/, '[#22] the warning says a branch that tracks the file replaces it');
    assert.match(run.stdout, /stop ignoring CLAUDE\.md and commit it on your main branch before adding Dflow/, '[#22] the warning says how to keep Dflow on one branch');
    assert.match(run.stdout, /save your own changes first if the branch you switch to tracks CLAUDE\.md/, '[#22] the advice protects the developer\'s own changes');
    const claude = await readFile(join(root, 'CLAUDE.md'), 'utf8');
    assert.ok(claude.startsWith('# My Claude rules'), '[#22] user content preserved');
    assert.equal(count(claude, AGENT_SHIM_START), 1, '[#22] the block is still appended — the warning adds no question');
    assert.equal(await exists(join(root, 'AGENTS.md')), true, '[#22] the ignored AGENTS.md is still created');

    const rerun = runDflow(root, '1,2\ny\n', ['configure-agents'], isolatedGit);
    assert.equal(rerun.code, 0, `[#22] configure-agents re-run failed\nSTDOUT:\n${rerun.stdout}\nSTDERR:\n${rerun.stderr}`);
    assert.doesNotMatch(rerun.stdout, IGNORED, '[#22] files that already carry Dflow wording stay silent on a re-run');

    // No git on PATH inside a git work tree: same plan, same file, and a note
    // that the check could not run — never silence that reads as "not ignored".
    const emptyBin = join(tempRoot, 'empty-bin');
    await mkdir(emptyBin, { recursive: true });
    const twin = await newRepo('i22-no-git/proj', IGNORED_FILES);
    const noGitRun = init(twin, '1,2', withPath(emptyBin));
    assert.doesNotMatch(noGitRun.stdout, IGNORED, '[#22] without git there is no "ignored" answer');
    assert.match(noGitRun.stdout, /Dflow could not tell whether git ignores CLAUDE\.md \(git is not on PATH\); to check, run `git check-ignore CLAUDE\.md`/, '[#22] no git on PATH inside a work tree says the check could not run');
    assert.match(noGitRun.stdout, /If git ignores it, the Dflow block added to it is not versioned on this branch/, '[#22] the could-not-tell note carries the same guidance');
    assert.deepEqual(planRows(noGitRun.stdout), planRows(run.stdout), '[#22] the plan does not depend on git');
    assert.equal(await readFile(join(twin, 'CLAUDE.md'), 'utf8'), claude, '[#22] the written file does not depend on git');

    // A git that fails inside a work tree (a `.git` file that points nowhere).
    const broken = await newRepo('i22-broken', IGNORED_FILES);
    await rm(join(broken, '.git'), { recursive: true, force: true });
    await writeFile(join(broken, '.git'), 'gitdir: does-not-exist\n');
    assert.match(init(broken, '1,2').stdout, /Dflow could not tell whether git ignores CLAUDE\.md \(git exited with code \d+\)/, '[#22] a failing git inside a work tree says the check could not run');

    // A work tree that the environment names (GIT_DIR), with no `.git` above the
    // project: git uses it, so an unanswered check still says it could not tell.
    const envRepo = await newRepo('i22-env-repo', {});
    const envWork = join(tempRoot, 'i22-env-work');
    await mkdir(envWork, { recursive: true });
    await writeFile(join(envWork, 'CLAUDE.md'), '# My Claude rules\n');
    const envRun = init(envWork, '1,2', { ...withPath(emptyBin), GIT_DIR: join(envRepo, '.git'), GIT_WORK_TREE: envWork });
    assert.match(envRun.stdout, /Dflow could not tell whether git ignores CLAUDE\.md \(git is not on PATH\)/, '[#22] a work tree named by GIT_DIR counts as a work tree');

    // A negated rule: git answers "not ignored", so Dflow stays silent — and the
    // command the could-not-tell note gives prints nothing for it, but prints the
    // path for a file that is ignored.
    const negated = await newRepo('i22-negated', { '.gitignore': '*.md\n!CLAUDE.md\n', 'CLAUDE.md': '# My Claude rules\n' });
    assert.doesNotMatch(init(negated, '2').stdout, IGNORED, '[#22] a file a negated rule un-ignores gets no warning');
    const manualCheck = (cwd) => spawnSync('git', ['check-ignore', 'CLAUDE.md'], { cwd, encoding: 'utf8', env: isolatedGit });
    const negatedCheck = manualCheck(negated);
    assert.equal(negatedCheck.status, 1, '[#22] the suggested check answers "not ignored" for a negated rule');
    assert.equal(negatedCheck.stdout.trim(), '', '[#22] the suggested check prints nothing for a file that is not ignored');
    const ignoredCheck = manualCheck(root);
    assert.equal(ignoredCheck.status, 0, '[#22] the suggested check answers "ignored" for an ignored file');
    assert.equal(ignoredCheck.stdout.trim(), 'CLAUDE.md', '[#22] the suggested check prints the path of an ignored file');

    // configure-agents bringing Dflow into an ignored file for the first time.
    const later = await newRepo('i22-later', { '.gitignore': 'CLAUDE.md\n' });
    init(later, 'none');
    await writeFile(join(later, 'CLAUDE.md'), '# Rules written after init\n');
    const laterRun = runDflow(later, '2\ny\n', ['configure-agents'], isolatedGit);
    assert.equal(laterRun.code, 0, `[#22] configure-agents (first insertion) failed\nSTDOUT:\n${laterRun.stdout}\nSTDERR:\n${laterRun.stderr}`);
    assert.match(laterRun.stdout, appendWarning, '[#22] configure-agents warns when it first appends to an ignored file');

    // A path inside an ignored directory.
    const ghIgnored = await newRepo('i22-github', { '.gitignore': '.github/\n' });
    const ghRun = init(ghIgnored, '3');
    assert.match(ghRun.stdout, /\.github\/copilot-instructions\.md is ignored by git, so the \.github\/copilot-instructions\.md Dflow creates/, '[#22] a file inside an ignored directory warns');

    // Silent cases.
    const trackedIgnored = await newRepo('i22-tracked', { '.gitignore': 'CLAUDE.md\n', 'CLAUDE.md': '# Tracked rules\n' });
    git(trackedIgnored, ['add', '-f', 'CLAUDE.md']);
    assert.doesNotMatch(init(trackedIgnored, '2').stdout, IGNORED, '[#22] a tracked file is versioned even when an ignore pattern matches it');
    const plain = await newRepo('i22-plain', { 'CLAUDE.md': '# My Claude rules\n' });
    assert.doesNotMatch(init(plain, '1,2').stdout, IGNORED, '[#22] a repository that ignores nothing stays silent');
    const COULD_NOT_TELL = /Dflow could not tell whether git ignores/;
    const noRepo = join(tempRoot, 'i22-no-repo');
    await mkdir(noRepo, { recursive: true });
    await writeFile(join(noRepo, 'CLAUDE.md'), '# My Claude rules\n');
    const noRepoRun = init(noRepo, '1,2');
    assert.doesNotMatch(noRepoRun.stdout, IGNORED, '[#22] a directory that is no git repository stays silent');
    assert.doesNotMatch(noRepoRun.stdout, COULD_NOT_TELL, '[#22] outside any work tree there is nothing to be unsure about');
    const noRepoNoGit = join(tempRoot, 'i22-no-repo-no-git');
    await mkdir(noRepoNoGit, { recursive: true });
    await writeFile(join(noRepoNoGit, 'CLAUDE.md'), '# My Claude rules\n');
    const noRepoNoGitRun = init(noRepoNoGit, '1,2', withPath(emptyBin));
    assert.doesNotMatch(noRepoNoGitRun.stdout, COULD_NOT_TELL, '[#22] no git and no work tree stays silent');

    // A git that does not answer: each check gives up within its time limit, so
    // init finishes well inside RUN_TIMEOUT_MS and says the check could not run.
    // Windows is skipped: Node resolves `git` through PATH without a shell, so a
    // stand-in there has to be an .exe; the time limit is the same code on every
    // platform.
    if (process.platform !== 'win32') {
      const slowBin = join(tempRoot, 'slow-git-bin');
      await mkdir(slowBin, { recursive: true });
      await writeFile(join(slowBin, 'git'), '#!/bin/sh\nsleep 60\n', { mode: 0o755 });
      const slow = await newRepo('i22-slow-git', IGNORED_FILES);
      const slowRun = init(slow, '1,2', withPath(`${slowBin}:/usr/bin:/bin`));
      assert.match(slowRun.stdout, /Dflow could not tell whether git ignores CLAUDE\.md \(git did not answer within 5 seconds\)/, '[#22] a git that does not answer in time says the check could not run');
    }
  }

  await rm(tempRoot, { recursive: true, force: true });
  console.log('PROPOSAL-054 agent-inject tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
