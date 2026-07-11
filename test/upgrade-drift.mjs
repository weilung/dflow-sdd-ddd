// PROPOSAL-058 — upgrade-time user-owned / shim drift:
//   (1) the packaged guide projects with guide-canonical markers, and the marked
//       region is substitution-free (byte-stable across projections);
//   (2) configure-agents refreshes the marked region in place, preserves
//       everything outside it, and is idempotent;
//   (3) the 5-state bootstrap table for a pre-marker guide (well-formed /
//       recognizable+offer / declined / malformed / unrecognizable);
//   (4) consent-gated managed-block adoption for a guide-referencing agent file
//       (case 2d), including the "now marker-managed" follow-up run;
//   (5) the `> Dflow Version:` last-reconciled line advances on configure-agents;
//   (6) doctor reports the drift matrix read-only and stays clean elsewhere.
//
// Same conventions as test/skill-default.mjs: runInit / runConfigureAgents /
// runDoctor are driven in-process; TTY halves use PassThrough streams faking
// isTTY; non-TTY halves use plain PassThroughs. Every scripted stdin is end()ed
// so a mis-consumed answer EOF-aborts instead of hanging.

import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdir, mkdtemp, readFile, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import init from '../lib/init.js';
import doctorChecks from '../lib/doctor-checks.js';

const { runInit, runConfigureAgents, runDoctor, writeFilePlan } = init;

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));

const GUIDE_REL = 'dflow/specs/shared/AI-AGENT-GUIDE.md';
const CONVENTIONS_REL = 'dflow/specs/shared/_conventions.md';
const START = '<!-- dflow-generated: guide-canonical START -->';
const END = '<!-- dflow-generated: guide-canonical END -->';
const GUIDE_QUESTION = 'Adopt the managed guide markers now?';
const SHIM_QUESTION = 'Append the managed Dflow block to';

const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-upgrade-drift-'));
let projectCounter = 0;

function pipeStdin(lines) {
  const stream = new PassThrough();
  stream.end(lines.join('\n') + '\n');
  return stream;
}

function ttyStdin(lines) {
  const stream = pipeStdin(lines);
  stream.isTTY = true;
  return stream;
}

function captureStream(tty) {
  const stream = new PassThrough();
  if (tty) stream.isTTY = true;
  stream.setEncoding('utf8');
  stream.text = '';
  stream.on('data', (chunk) => {
    stream.text += chunk;
  });
  return stream;
}

// init prompt order: project type, tech stack, migration, prose, git policy,
// AI commit marker, optional starter files, AI agents, confirm. Non-TTY runs
// never ask the skill question and install the skill by default.
function initAnswers(agents, projectType = '1') {
  return [projectType, 'Node 20, Express 4, Jest', 'none', '1', '2', '1', '1', agents, 'y'];
}

async function newProject(agents, projectType = '1') {
  projectCounter += 1;
  const dir = join(tempRoot, `p${projectCounter}`);
  await mkdir(dir, { recursive: true });
  const stdout = captureStream(false);
  const stderr = captureStream(false);
  const code = await runInit({ cwd: dir, stdin: pipeStdin(initAnswers(agents, projectType)), stdout, stderr });
  assert.equal(code, 0, `init failed in ${dir}\nSTDOUT:\n${stdout.text}\nSTDERR:\n${stderr.text}`);
  return dir;
}

async function runConfigure(cwd, answers, { tty = false, commandAdapters = false, skills = false } = {}) {
  const stdout = captureStream(tty);
  const stderr = captureStream(false);
  const code = await runConfigureAgents({
    cwd,
    stdin: tty ? ttyStdin(answers) : pipeStdin(answers),
    stdout,
    stderr,
    commandAdapters,
    skills
  });
  return { code, stdout: stdout.text, stderr: stderr.text, all: stdout.text + stderr.text };
}

async function runDoctorAt(cwd) {
  const stdout = captureStream(false);
  const stderr = captureStream(false);
  const code = await runDoctor({ cwd, stdout, stderr });
  return { code, stdout: stdout.text, stderr: stderr.text };
}

function canonicalRegion(content, context) {
  const lf = content.replace(/\r\n/g, '\n');
  const startIdx = lf.indexOf(START);
  const endIdx = lf.indexOf(END);
  assert.ok(startIdx >= 0 && endIdx > startIdx, `${context}: guide-canonical markers should be present and ordered`);
  return lf.slice(startIdx, endIdx + END.length);
}

function stripGuideMarkers(content) {
  return content
    .split('\n')
    .filter((line) => !line.includes('dflow-generated: guide-canonical'))
    .join('\n');
}

const packagedGuide = await readFile(join(repoRoot, 'templates/greenfield/scaffolding/AI-AGENT-GUIDE.md'), 'utf8');
const packagedRegion = canonicalRegion(packagedGuide, 'packaged template');

try {
  // ---------------------------------------------------------------------------
  // (1) Fresh init projects a marker-carrying guide whose canonical region is
  // byte-identical to the packaged template region — i.e. substitution-free.
  // This guards refresh idempotence and doctor's byte comparison: a future edit
  // that drags a substituted placeholder (e.g. `{YYYY-MM-DD}`) into the region
  // fails here.
  // ---------------------------------------------------------------------------
  const base = await newProject('2');
  const freshGuide = await readFile(join(base, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(freshGuide, 'fresh init'), packagedRegion, 'projected canonical region must byte-match the packaged template region');

  // ---------------------------------------------------------------------------
  // (2) Marker-guarded refresh: stale canonical content is restored, content
  // outside the markers (Project Context additions) is preserved, and a second
  // run is byte-idempotent.
  // ---------------------------------------------------------------------------
  const staleGuide = freshGuide
    .replace('\n' + START, '\nMY PROJECT NOTES KEEPME\n\n' + START)
    .replace('## Ceremony Scaling', '## Ceremony Scaling OLD');
  await writeFile(join(base, GUIDE_REL), staleGuide);

  const refresh = await runConfigure(base, ['2', 'y']);
  assert.equal(refresh.code, 0, `refresh run failed\n${refresh.all}`);
  const refreshed = await readFile(join(base, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(refreshed, 'after refresh'), packagedRegion, 'canonical region must be refreshed to the packaged content');
  assert.match(refreshed, /MY PROJECT NOTES KEEPME/, 'content outside the markers must be preserved');
  assert.doesNotMatch(refreshed, /Ceremony Scaling OLD/, 'stale canonical content must be gone');

  const again = await runConfigure(base, ['2', 'y']);
  assert.equal(again.code, 0, `idempotent run failed\n${again.all}`);
  assert.equal(await readFile(join(base, GUIDE_REL), 'utf8'), refreshed, 'second refresh run must be byte-idempotent');

  // ---------------------------------------------------------------------------
  // (5) `> Dflow Version:` advances to the CLI version on configure-agents
  // (last-reconciled semantics); an absent line is never added.
  // ---------------------------------------------------------------------------
  const conventionsPath = join(base, CONVENTIONS_REL);
  const conventions = await readFile(conventionsPath, 'utf8');
  await writeFile(conventionsPath, conventions.replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0'));
  const reconcile = await runConfigure(base, ['2', 'y']);
  assert.equal(reconcile.code, 0, `reconcile run failed\n${reconcile.all}`);
  assert.match(await readFile(conventionsPath, 'utf8'), new RegExp(`^> Dflow Version: ${pkg.version.replace(/\./g, '\\.')}$`, 'm'), 'configure-agents must advance the last-reconciled version line');

  const noLine = (await readFile(conventionsPath, 'utf8')).replace(/^> Dflow Version: .+\n/m, '');
  await writeFile(conventionsPath, noLine);
  const noLineRun = await runConfigure(base, ['2', 'y']);
  assert.equal(noLineRun.code, 0, `absent-line run failed\n${noLineRun.all}`);
  assert.doesNotMatch(await readFile(conventionsPath, 'utf8'), /^> Dflow Version:/m, 'configure-agents must not add an absent Dflow Version line (doctor reports it instead)');
  await writeFile(conventionsPath, await readFile(conventionsPath, 'utf8')); // no-op; keep project usable

  // ---------------------------------------------------------------------------
  // (3) Bootstrap table for a pre-marker guide.
  // ---------------------------------------------------------------------------
  // (3a) non-TTY: recognizable but marker-less -> untouched + warn (never asks).
  const boot = await newProject('2');
  const bootGuide = await readFile(join(boot, GUIDE_REL), 'utf8');
  const preMarker = stripGuideMarkers(
    bootGuide.replace('\n' + START, '\nMY PROJECT NOTES KEEPME\n\n' + START)
  );
  await writeFile(join(boot, GUIDE_REL), preMarker);

  const nonTty = await runConfigure(boot, ['2', 'y']);
  assert.equal(nonTty.code, 0, `non-TTY pre-marker run failed\n${nonTty.all}`);
  assert.equal(await readFile(join(boot, GUIDE_REL), 'utf8'), preMarker, 'non-TTY run must not touch a pre-marker guide');
  assert.match(nonTty.all, /predates Dflow's guide-canonical markers/, 'non-TTY run must warn about the frozen guide');
  assert.ok(!nonTty.all.includes(GUIDE_QUESTION), 'non-TTY run must never ask the adoption question');

  // (3b) TTY + blank answer -> default No, untouched.
  const declined = await runConfigure(boot, ['2', '', 'y'], { tty: true });
  assert.equal(declined.code, 0, `declined adoption run failed\n${declined.all}`);
  assert.ok(declined.stdout.includes(GUIDE_QUESTION), 'TTY run must offer marker adoption for a recognizable pre-marker guide');
  assert.equal(await readFile(join(boot, GUIDE_REL), 'utf8'), preMarker, 'blank answer must default to No (guide untouched)');

  // (3c) TTY + y -> adopted: markers present, canonical current, Project Context
  // (including the custom line) carried over.
  const adopted = await runConfigure(boot, ['2', 'y', 'y'], { tty: true });
  assert.equal(adopted.code, 0, `adoption run failed\n${adopted.all}`);
  assert.ok(adopted.stdout.includes(GUIDE_QUESTION), 'TTY adoption run must ask the question');
  const adoptedGuide = await readFile(join(boot, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(adoptedGuide, 'after adoption'), packagedRegion, 'adopted guide must carry the current canonical region');
  assert.match(adoptedGuide, /MY PROJECT NOTES KEEPME/, 'adoption must keep the Project Context section');
  const followUp = await runConfigure(boot, ['2', 'y'], { tty: true });
  assert.equal(followUp.code, 0, `post-adoption run failed\n${followUp.all}`);
  assert.ok(!followUp.stdout.includes(GUIDE_QUESTION), 'an adopted guide must not be re-asked');

  // (3d) malformed markers -> untouched + warn (TTY run must not even offer).
  const malformed = await newProject('2');
  const malformedGuide = (await readFile(join(malformed, GUIDE_REL), 'utf8')).replace(END, `${END}\n${START}`);
  await writeFile(join(malformed, GUIDE_REL), malformedGuide);
  const malformedRun = await runConfigure(malformed, ['2', 'y'], { tty: true });
  assert.equal(malformedRun.code, 0, `malformed-marker run failed\n${malformedRun.all}`);
  assert.equal(await readFile(join(malformed, GUIDE_REL), 'utf8'), malformedGuide, 'malformed markers must leave the guide untouched');
  assert.match(malformedRun.all, /malformed guide-canonical markers/, 'malformed markers must warn');
  assert.ok(!malformedRun.stdout.includes(GUIDE_QUESTION), 'malformed markers must not trigger the adoption offer');

  // (3e) unrecognizable file -> untouched + warn.
  const foreign = await newProject('2');
  await writeFile(join(foreign, GUIDE_REL), '# Our own agent notes\n\nNothing Dflow-shaped here.\n');
  const foreignRun = await runConfigure(foreign, ['2', 'y'], { tty: true });
  assert.equal(foreignRun.code, 0, `unrecognizable-guide run failed\n${foreignRun.all}`);
  assert.equal(await readFile(join(foreign, GUIDE_REL), 'utf8'), '# Our own agent notes\n\nNothing Dflow-shaped here.\n', 'unrecognizable guide must stay untouched');
  assert.match(foreignRun.all, /not recognizable as a Dflow guide/, 'unrecognizable guide must warn');
  assert.ok(!foreignRun.stdout.includes(GUIDE_QUESTION), 'unrecognizable guide must not trigger the adoption offer');

  // ---------------------------------------------------------------------------
  // (4) Case-2d shim adoption: consent appends the managed block (keeping the
  // user's content), the file is marker-managed afterwards, and declining keeps
  // the original skip behavior.
  // ---------------------------------------------------------------------------
  const shim = await newProject('none');
  const userAgents = '# Team agents file\n\nRead dflow/specs/shared/AI-AGENT-GUIDE.md before big changes.\n\nMY CUSTOM RULES KEEPME\n';
  await writeFile(join(shim, 'AGENTS.md'), userAgents);
  // Slots: agent select, skill question (missing -> n), shim adoption (guide is
  // freshly created so no guide offer), final confirm.
  const adoptShim = await runConfigure(shim, ['1', 'n', 'y', 'y'], { tty: true });
  assert.equal(adoptShim.code, 0, `shim adoption run failed\n${adoptShim.all}`);
  assert.ok(adoptShim.stdout.includes(SHIM_QUESTION), 'TTY run must offer the managed-block adoption for a 2d agent file');
  const adoptedAgents = await readFile(join(shim, 'AGENTS.md'), 'utf8');
  assert.match(adoptedAgents, /<!-- dflow-generated: agent-shim START -->/, 'consent must append the marked Dflow block');
  assert.match(adoptedAgents, /MY CUSTOM RULES KEEPME/, 'the user content must be preserved');
  assert.ok(adoptedAgents.startsWith('# Team agents file'), 'the user file head must be preserved');
  assert.match(adoptShim.all, /remove any older Dflow wording outside the marked block/, 'adoption must remind the user to clean older Dflow wording');

  const shimAgain = await runConfigure(shim, ['1', 'n', 'y'], { tty: true });
  assert.equal(shimAgain.code, 0, `post-adoption shim run failed\n${shimAgain.all}`);
  assert.ok(!shimAgain.stdout.includes(SHIM_QUESTION), 'a marker-managed agent file must not be re-offered');
  assert.equal(await readFile(join(shim, 'AGENTS.md'), 'utf8'), adoptedAgents, 'the marker-managed agent file must be byte-idempotent');

  const shimNo = await newProject('none');
  await writeFile(join(shimNo, 'AGENTS.md'), userAgents);
  const declineShim = await runConfigure(shimNo, ['1', 'n', 'n', 'y'], { tty: true });
  assert.equal(declineShim.code, 0, `shim decline run failed\n${declineShim.all}`);
  assert.ok(declineShim.stdout.includes(SHIM_QUESTION), 'decline run must have been offered');
  assert.equal(await readFile(join(shimNo, 'AGENTS.md'), 'utf8'), userAgents, 'declining must leave the agent file untouched');

  // ---------------------------------------------------------------------------
  // (6) Doctor drift matrix — read-only, exit 0, and each detector fires.
  // ---------------------------------------------------------------------------
  // Project A: stale version line, non-machine AI-commit line, pre-marker guide
  // with a renamed heading (dangling § from the bundle), unmanaged CLAUDE.md,
  // older bundle manifest, old-shape active _index.md (completed/ ignored),
  // edited Git-principles starter.
  const aged = await newProject('2');
  const agedConventionsPath = join(aged, CONVENTIONS_REL);
  let agedConventions = await readFile(agedConventionsPath, 'utf8');
  agedConventions = agedConventions
    .replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0')
    .replace(/^AI commit marker: `none`$/m, 'AI commit marker: none');
  await writeFile(agedConventionsPath, agedConventions);

  const agedGuidePath = join(aged, GUIDE_REL);
  const agedGuide = stripGuideMarkers((await readFile(agedGuidePath, 'utf8')).replace('## Ceremony Scaling', '## Old Scaling'));
  await writeFile(agedGuidePath, agedGuide);

  await writeFile(join(aged, 'CLAUDE.md'), (await readFile(join(aged, 'CLAUDE.md'), 'utf8')) + '\nEXTRA TEAM RULES\n');

  const manifestPath = join(aged, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = '0.8.0';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const oldIndex = '---\nspec-id: SPEC-20260101-001\nstatus: in-progress\n---\n\n# Old Feature\n\n## Goals & Scope\n\nx\n\n## Phase Specs\n\nnone yet\n';
  await mkdir(join(aged, 'dflow/specs/features/active/SPEC-20260101-001-old'), { recursive: true });
  await writeFile(join(aged, 'dflow/specs/features/active/SPEC-20260101-001-old/_index.md'), oldIndex);
  await mkdir(join(aged, 'dflow/specs/features/completed/SPEC-20250101-001-done'), { recursive: true });
  await writeFile(join(aged, 'dflow/specs/features/completed/SPEC-20250101-001-done/_index.md'), oldIndex);

  const principlesPath = join(aged, 'dflow/specs/shared/Git-principles-trunk.md');
  await writeFile(principlesPath, (await readFile(principlesPath, 'utf8')) + '\nLOCAL TWEAK\n');

  const agedDoctor = await runDoctorAt(aged);
  assert.equal(agedDoctor.code, 0, `doctor must stay exit 0 on drift\n${agedDoctor.stdout}${agedDoctor.stderr}`);
  const agedOut = agedDoctor.stdout;
  assert.match(agedOut, /last reconciled with Dflow 0\.8\.0/, 'doctor: stale last-reconciled version');
  assert.match(agedOut, /## AI Commit Policy line is not machine-readable/, 'doctor: non-machine policy line');
  assert.match(agedOut, /predates managed guide-canonical markers/, 'doctor: pre-marker guide');
  assert.match(agedOut, /Dangling AI-AGENT-GUIDE\.md § reference/, 'doctor: dangling guide § refs');
  assert.match(agedOut, /CLAUDE\.md references the Dflow guide but is not Dflow-managed/, 'doctor: unmanaged shim');
  assert.match(agedOut, /Workflow bundle was projected by Dflow 0\.8\.0/, 'doctor: old bundle manifest');
  assert.match(agedOut, /active\/SPEC-20260101-001-old\/_index\.md looks like an older _index\.md template shape/, 'doctor: old-shape active _index');
  assert.match(agedOut, /Checkpoint Log/, 'doctor: missing section list names Checkpoint Log');
  assert.doesNotMatch(agedOut, /completed\/SPEC-20250101-001-done/, 'doctor: completed/ features are not scanned');
  assert.match(agedOut, /Git-principles-trunk\.md differs from the current packaged starter/, 'doctor: edited init-only starter');
  assert.doesNotMatch(agedOut, /_conventions\.md is missing the ## Git Policy section/, 'doctor: intact Git Policy section must not warn');

  // Project B: markers intact but canonical region tampered; Git Policy section
  // removed; Git-principles file missing; malformed guide markers on a second
  // pass.
  const tampered = await newProject('2');
  const tamperedGuidePath = join(tampered, GUIDE_REL);
  await writeFile(tamperedGuidePath, (await readFile(tamperedGuidePath, 'utf8')).replace('## Ceremony Scaling', '## Ceremony Scaling Tweaked'));
  const tamperedConventionsPath = join(tampered, CONVENTIONS_REL);
  const tamperedConventions = (await readFile(tamperedConventionsPath, 'utf8')).replace(/^## Git Policy$/m, '## Team Git Rules');
  await writeFile(tamperedConventionsPath, tamperedConventions);
  await unlink(join(tampered, 'dflow/specs/shared/Git-principles-trunk.md'));

  const tamperedDoctor = await runDoctorAt(tampered);
  assert.equal(tamperedDoctor.code, 0, 'doctor must stay exit 0');
  assert.match(tamperedDoctor.stdout, /canonical content differs from this CLI version/, 'doctor: tampered canonical region behind markers');
  assert.match(tamperedDoctor.stdout, /_conventions\.md is missing the ## Git Policy section/, 'doctor: missing policy section');
  // The `Selected Git policy:` line itself is still machine-readable (inference
  // greps the whole file, not the heading), so the deleted principles file is
  // still attributed to the selected policy.
  assert.match(tamperedDoctor.stdout, /Git-principles-trunk\.md is missing/, 'doctor: missing principles file for the still-parseable policy');

  const malformedDoctorGuide = (await readFile(tamperedGuidePath, 'utf8')).replace(END, `${END}\n${START}`);
  await writeFile(tamperedGuidePath, malformedDoctorGuide);
  const malformedDoctor = await runDoctorAt(tampered);
  assert.match(malformedDoctor.stdout, /has malformed guide-canonical markers/, 'doctor: malformed guide markers');

  // Project C: valid policy but the selected principles file deleted -> warn.
  const missingStarter = await newProject('2');
  await unlink(join(missingStarter, 'dflow/specs/shared/Git-principles-trunk.md'));
  const missingStarterDoctor = await runDoctorAt(missingStarter);
  assert.match(missingStarterDoctor.stdout, /Git-principles-trunk\.md is missing/, 'doctor: missing selected principles file');

  // Fresh project: doctor stays clean (also asserted by test/smoke.mjs; guarded
  // here against the new checks regressing into fresh-init noise).
  const clean = await newProject('2');
  const cleanDoctor = await runDoctorAt(clean);
  assert.match(cleanDoctor.stdout, /All checks passed\. No Dflow health findings detected\./, 'doctor must stay clean on a fresh init');

  // ---------------------------------------------------------------------------
  // (7) Brownfield parity for (1): the brownfield template's canonical region is
  // substitution-free and projects byte-identically too.
  // ---------------------------------------------------------------------------
  const brownPackaged = await readFile(join(repoRoot, 'templates/brownfield/scaffolding/AI-AGENT-GUIDE.md'), 'utf8');
  const brownRegion = canonicalRegion(brownPackaged, 'brownfield packaged template');
  const brown = await newProject('2', '2');
  const brownGuide = await readFile(join(brown, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(brownGuide, 'brownfield fresh init'), brownRegion, 'brownfield projected canonical region must byte-match the packaged template region');
  const brownDoctor = await runDoctorAt(brown);
  assert.match(brownDoctor.stdout, /All checks passed\. No Dflow health findings detected\./, 'doctor must stay clean on a fresh brownfield init');

  // ---------------------------------------------------------------------------
  // (8) requiresFullApply guard (implementation-review R1 finding): the version
  // line must NOT advance when an earlier planned change was skipped by a write
  // guard. Driven through the exported writeFilePlan with synthetic plans, the
  // documented way to exercise between-preview-and-write races.
  // ---------------------------------------------------------------------------
  const race = await newProject('2');
  const raceConventionsPath = join(race, CONVENTIONS_REL);
  const raceConventionsOld = (await readFile(raceConventionsPath, 'utf8')).replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0');
  await writeFile(raceConventionsPath, raceConventionsOld);
  const raceGuide = await readFile(join(race, GUIDE_REL), 'utf8');
  const versionItem = () => ({
    relativePath: CONVENTIONS_REL,
    source: 'generated:dflow-version-reconcile',
    notes: 'update Dflow Version line (last reconciled)',
    content: raceConventionsOld.replace(/^> Dflow Version: .+$/m, `> Dflow Version: ${pkg.version}`),
    expectedContent: raceConventionsOld,
    action: 'update',
    overwrite: true,
    rootInject: true,
    requiresFullApply: true,
    size: 1
  });

  // (8a) rootInject guard skip (guide changed after preview) blocks the version item.
  const blocked = await writeFilePlan(race, {
    items: [
      {
        relativePath: GUIDE_REL,
        source: 'test',
        notes: 'guide refresh',
        content: `${raceGuide}refreshed\n`,
        expectedContent: `${raceGuide}changed-after-preview\n`,
        action: 'update',
        overwrite: true,
        rootInject: true,
        size: 1
      },
      versionItem()
    ]
  });
  assert.equal(blocked.updated.length, 0, 'guarded skip must not write anything');
  assert.ok(blocked.warnings.some((w) => w.includes('changed after the preview')), 'guide guard skip must warn');
  assert.ok(blocked.warnings.some((w) => w.includes('Skipped the Dflow Version update')), 'version item must be dropped after a guarded skip');
  assert.match(await readFile(raceConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'version line must not advance over a guarded skip');

  // (8b) stale-removal guard skip blocks it too.
  await writeFile(join(race, 'stale-adapter.md'), 'user replaced this content\n');
  const removeBlocked = await writeFilePlan(race, {
    items: [
      {
        relativePath: 'stale-adapter.md',
        source: 'test',
        notes: 'legacy cleanup',
        content: '',
        expectedContent: 'what dflow generated back then\n',
        action: 'remove'
      },
      versionItem()
    ]
  });
  assert.ok(removeBlocked.warnings.some((w) => w.includes('content changed after preview')), 'removal guard skip must warn');
  assert.match(await readFile(raceConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'version line must not advance over a removal guard skip');

  // (8c) a previewed create that lands on an unexpectedly existing target (the
  // pre-write pathExists branch; the deeper EEXIST TOCTOU catch mirrors the
  // same flag and is unreachable deterministically without fs interception)
  // blocks the version item too.
  await writeFile(join(race, 'appeared-later.md'), 'someone else wrote this\n');
  const createBlocked = await writeFilePlan(race, {
    items: [
      {
        relativePath: 'appeared-later.md',
        source: 'test',
        notes: 'new adapter',
        content: 'dflow content\n',
        action: 'create',
        size: 1
      },
      versionItem()
    ]
  });
  assert.ok(createBlocked.warnings.some((w) => w.includes('Skipped existing target')), 'raced create must warn');
  assert.match(await readFile(raceConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'version line must not advance over a raced create');

  // (8d) control: with no guarded skip the same version item advances the line.
  const advanced = await writeFilePlan(race, { items: [versionItem()] });
  assert.equal(advanced.updated.length, 1, 'control version item must write');
  assert.match(await readFile(raceConventionsPath, 'utf8'), new RegExp(`^> Dflow Version: ${pkg.version.replace(/\./g, '\\.')}$`, 'm'), 'control: version line advances when everything applied');

  // ---------------------------------------------------------------------------
  // (9) Cold-eye gate additions.
  // ---------------------------------------------------------------------------
  // (9a) Declining the final confirmation must not advance the version line.
  const abortProj = await newProject('2');
  const abortConventionsPath = join(abortProj, CONVENTIONS_REL);
  await writeFile(abortConventionsPath, (await readFile(abortConventionsPath, 'utf8')).replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0'));
  const aborted = await runConfigure(abortProj, ['2', 'n']);
  assert.match(await readFile(abortConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'declined final confirm must not advance the version line');

  // (9b) CRLF guide: refresh keeps the dominant EOL and preserves user content
  // after the END marker.
  const crlfProj = await newProject('2');
  const crlfGuidePath = join(crlfProj, GUIDE_REL);
  let crlfGuide = (await readFile(crlfGuidePath, 'utf8'))
    .replace('## Ceremony Scaling', '## Ceremony Scaling STALE');
  crlfGuide = `${crlfGuide}\nAFTER-MARKER NOTES KEEPME\n`.replace(/\n/g, '\r\n');
  await writeFile(crlfGuidePath, crlfGuide);
  const crlfRun = await runConfigure(crlfProj, ['2', 'y']);
  assert.equal(crlfRun.code, 0, `CRLF refresh run failed\n${crlfRun.all}`);
  const crlfRefreshed = await readFile(crlfGuidePath, 'utf8');
  assert.equal(canonicalRegion(crlfRefreshed, 'CRLF refresh'), packagedRegion, 'CRLF guide canonical region must refresh');
  assert.match(crlfRefreshed, /AFTER-MARKER NOTES KEEPME/, 'content after the END marker must be preserved');
  const crlfCount = (crlfRefreshed.match(/\r\n/g) || []).length;
  const bareLfCount = (crlfRefreshed.match(/\n/g) || []).length - crlfCount;
  assert.equal(bareLfCount, 0, 'refreshed CRLF guide must stay CRLF throughout');

  // (9c) Non-TTY run on a 2d agent file: no adoption question, file untouched,
  // but the skip is voiced ("skip and warn" — cold-eye gate G2 finding).
  const silent = await runConfigure(shimNo, ['1', 'y']);
  assert.equal(silent.code, 0, `non-TTY 2d run failed\n${silent.all}`);
  assert.ok(!silent.all.includes(SHIM_QUESTION), 'non-TTY run must not ask the shim adoption question');
  assert.equal(await readFile(join(shimNo, 'AGENTS.md'), 'utf8'), userAgents, 'non-TTY run must leave the 2d agent file untouched');
  assert.match(silent.all, /AGENTS\.md references the Dflow guide but is not marker-managed/, 'non-TTY 2d skip must warn');

  // (9d) doctor flags malformed Codex command-trigger markers in AGENTS.md.
  await writeFile(
    join(shimNo, 'AGENTS.md'),
    `${userAgents}\n<!-- dflow-generated: codex-command-triggers START -->\n`
  );
  const triggerDoctor = await runDoctorAt(shimNo);
  assert.match(triggerDoctor.stdout, /AGENTS\.md has malformed Dflow command-trigger markers/, 'doctor: dangling trigger marker must warn');

  // (9e) One TTY run carrying BOTH offers: slots = agents selection, skill
  // question (agents-skill missing -> n), guide adoption, shim adoption, confirm.
  const both = await newProject('2');
  const bothGuide = await readFile(join(both, GUIDE_REL), 'utf8');
  await writeFile(join(both, GUIDE_REL), stripGuideMarkers(bothGuide));
  await writeFile(join(both, 'AGENTS.md'), userAgents);
  const bothRun = await runConfigure(both, ['1,2', 'n', 'y', 'y', 'y'], { tty: true });
  assert.equal(bothRun.code, 0, `combined adoption run failed\n${bothRun.all}`);
  assert.ok(bothRun.stdout.includes(GUIDE_QUESTION), 'combined run must ask the guide question');
  assert.ok(bothRun.stdout.includes(SHIM_QUESTION), 'combined run must ask the shim question');
  assert.equal(canonicalRegion(await readFile(join(both, GUIDE_REL), 'utf8'), 'combined adoption'), packagedRegion, 'combined run must adopt the guide markers');
  assert.match(await readFile(join(both, 'AGENTS.md'), 'utf8'), /<!-- dflow-generated: agent-shim START -->/, 'combined run must adopt the shim block');

  // (9g) doctor on an unrecognizable markerless guide must not point at the
  // adoption offer configure-agents would never make (cold-eye gate G4).
  const foreignDoctor = await runDoctorAt(foreign);
  assert.equal(foreignDoctor.code, 0, 'doctor must stay exit 0 on a foreign guide');
  assert.match(foreignDoctor.stdout, /is not recognizable as a Dflow guide/, 'doctor: unrecognizable guide gets its own finding');
  assert.doesNotMatch(foreignDoctor.stdout, /accept the marker-adoption offer/, 'doctor: unrecognizable guide must not be told to accept a non-existent offer');

  // (9h) Non-TTY --command-adapters on a 2d AGENTS.md: trigger block upserts,
  // base shim stays skipped, no extra stdin slots consumed, 2d warning voiced.
  const trig = await newProject('none');
  await writeFile(join(trig, 'AGENTS.md'), userAgents);
  const trigRun = await runConfigure(trig, ['1', 'y'], { commandAdapters: true });
  assert.equal(trigRun.code, 0, `non-TTY --command-adapters 2d run failed\n${trigRun.all}`);
  assert.ok(!trigRun.all.includes(SHIM_QUESTION) && !trigRun.all.includes(GUIDE_QUESTION), 'non-TTY adapters run must ask no adoption questions');
  const trigAgents = await readFile(join(trig, 'AGENTS.md'), 'utf8');
  assert.match(trigAgents, /<!-- dflow-generated: codex-command-triggers START -->/, '2d file must gain the trigger block under --command-adapters');
  assert.doesNotMatch(trigAgents, /<!-- dflow-generated: agent-shim START -->/, '2d file must not gain the base shim block without consent');
  assert.ok(trigAgents.startsWith('# Team agents file'), 'user content must be preserved');
  assert.match(trigRun.all, /references the Dflow guide but is not marker-managed/, '2d skip warning must still be voiced under --command-adapters');

  // (9i) Corrupt bundle manifest: doctor degrades read-only with exit 0.
  const corrupt = await newProject('2');
  await writeFile(join(corrupt, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json'), '{not json');
  const corruptDoctor = await runDoctorAt(corrupt);
  assert.equal(corruptDoctor.code, 0, 'doctor must stay exit 0 on a corrupt bundle manifest');

  // (9f) Adoption when "## Project Context" is the LAST section of the old guide
  // (bounds edge: no following heading).
  const eofProj = await newProject('2');
  await writeFile(
    join(eofProj, GUIDE_REL),
    '# Dflow AI Agent Guide\n\nOld intro.\n\n## Project Context\n\n| Project | X |\n\nEOF-NOTES KEEPME'
  );
  const eofRun = await runConfigure(eofProj, ['2', 'y', 'y'], { tty: true });
  assert.equal(eofRun.code, 0, `PC-at-EOF adoption run failed\n${eofRun.all}`);
  const eofGuide = await readFile(join(eofProj, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(eofGuide, 'PC-at-EOF adoption'), packagedRegion, 'PC-at-EOF adoption must carry the current canonical region');
  assert.match(eofGuide, /EOF-NOTES KEEPME/, 'PC section content up to EOF must be carried over');

  // ---------------------------------------------------------------------------
  // (10) Doctor/configure whitespace agreement (cold-eye gate G5): a context
  // value doctor's machine-format check accepts must be the exact value
  // inference hands to strict consumers (buildSubstitutionMap compares
  // `gitflow`/`trunk` byte-for-byte; the guide's Project Context table takes
  // {prose-language} verbatim). Both sides parse via parseContextLine, so
  // whitespace inside the backticks trims identically — and a whitespace-only
  // value is rejected identically on both sides.
  // ---------------------------------------------------------------------------
  assert.equal(doctorChecks.parseContextLine('Selected Git policy: `gitflow `', doctorChecks.GIT_POLICY_LINE_RE), 'gitflow', 'padded policy value must parse trimmed');
  assert.equal(doctorChecks.parseContextLine('AI commit marker: ` none`', doctorChecks.AI_COMMIT_MARKER_LINE_RE), 'none', 'padded marker value must parse trimmed');
  assert.equal(doctorChecks.parseContextLine('Selected Git policy: ` `', doctorChecks.GIT_POLICY_LINE_RE), null, 'whitespace-only value must parse to null');
  assert.equal(doctorChecks.parseContextLine('no such line', doctorChecks.GIT_POLICY_LINE_RE), null, 'absent line must parse to null');

  const spaced = await newProject('2');
  const spacedConventionsPath = join(spaced, CONVENTIONS_REL);
  const spacedConventions = (await readFile(spacedConventionsPath, 'utf8'))
    .replace(/^Selected Git policy: `trunk`$/m, 'Selected Git policy: `trunk `')
    .replace(/^AI commit marker: `none`$/m, 'AI commit marker: ` none`')
    .replace(/^Project prose language: `zh-TW`$/m, 'Project prose language: `zh-TW `');
  assert.match(spacedConventions, /`trunk `/, 'fixture must carry the padded policy value');
  assert.match(spacedConventions, /` none`/, 'fixture must carry the padded marker value');
  assert.match(spacedConventions, /`zh-TW `/, 'fixture must carry the padded prose value');
  await writeFile(spacedConventionsPath, spacedConventions);

  const spacedDoctor = await runDoctorAt(spaced);
  assert.equal(spacedDoctor.code, 0, `doctor failed on padded values\n${spacedDoctor.stdout}${spacedDoctor.stderr}`);
  assert.doesNotMatch(spacedDoctor.stdout, /is not machine-readable/, 'doctor must accept padded-but-valid context values');

  await unlink(join(spaced, GUIDE_REL));
  const spacedRun = await runConfigure(spaced, ['2', 'y']);
  assert.equal(spacedRun.code, 0, `configure failed on padded values\n${spacedRun.all}`);
  const spacedGuide = await readFile(join(spaced, GUIDE_REL), 'utf8');
  assert.match(spacedGuide, /^\| Prose language \| zh-TW \|$/m, 'inference must hand the substitution map the trimmed prose value');

  // Reject direction: a whitespace-only value is null on both sides — doctor
  // flags the line instead of passing a value inference would refuse.
  await writeFile(spacedConventionsPath, spacedConventions.replace('Selected Git policy: `trunk `', 'Selected Git policy: ` `'));
  const blankDoctor = await runDoctorAt(spaced);
  assert.equal(blankDoctor.code, 0, 'doctor must stay exit 0 on a whitespace-only policy value');
  assert.match(blankDoctor.stdout, /## Git Policy line is not machine-readable/, 'doctor must flag a whitespace-only policy value');

  console.log(`PROPOSAL-058 upgrade-drift tests passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
