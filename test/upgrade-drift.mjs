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
// Section (11) covers PROPOSAL-076: context inference reads the guide's
// "## Project Context" rows (section-scoped) and doctor reports missing rows.
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

const { runInit, runConfigureAgents, runDoctor, writeFilePlan, inferTechStackSummary, inferMigrationContext } = init;

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
  // P-081: the stale-version action links the canonical upgrading guide via a
  // blob/main URL composed from package.json's repository slug, and the linked
  // target must exist in the repo — never freeze a URL that would 404.
  const repoSlug = pkg.repository.url.match(/github\.com[/:]([^/]+\/[^/.]+)/)[1];
  const upgradeGuideUrl = `https://github.com/${repoSlug}/blob/main/docs/upgrading.en.md`;
  assert.ok(agedOut.includes(upgradeGuideUrl), `doctor: stale-version action links the canonical upgrading guide URL (${upgradeGuideUrl})`);
  await readFile(join(repoRoot, 'docs/upgrading.en.md'), 'utf8');
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

  // (9g) Line endings, all three CommonMark forms. `projectContextSectionBounds`
  // slices content it splits itself while locating the section through the
  // fence-aware scan in doctor-checks, so the two must agree about what a line
  // is. They stopped agreeing when the scan learned about a lone CR and the
  // slice did not: a CR-only guide became "recognizable", the offer was made,
  // configure-agents exited 0, and the Project Context it exists to preserve was
  // transplanted EMPTY (`p082-b3-g2` finding 1 — a regression introduced by this
  // batch's own fix to the scan).
  //
  // ⚠ This is a DATA-LOSS path with a zero exit code, so it is pinned
  // end-to-end rather than at the helper: the two arrays going out of sync is
  // the mechanism, but "the user's content survived" is the property.
  for (const [label, eol] of [['LF', '\n'], ['CRLF', '\r\n'], ['CR-only', '\r']]) {
    const eolProj = await newProject('2');
    await writeFile(
      join(eolProj, GUIDE_REL),
      ['# Dflow AI Agent Guide', '', 'Old intro.', '', '## Project Context', '', '| Project | X |', '', `${label}-NOTES KEEPME`].join(eol)
    );
    const eolRun = await runConfigure(eolProj, ['2', 'y', 'y'], { tty: true });
    assert.equal(eolRun.code, 0, `${label} adoption run failed\n${eolRun.all}`);
    assert.ok(eolRun.stdout.includes(GUIDE_QUESTION), `${label} pre-marker guide must be recognized and offered adoption`);
    const eolGuide = await readFile(join(eolProj, GUIDE_REL), 'utf8');
    assert.match(
      eolGuide,
      new RegExp(`${label}-NOTES KEEPME`),
      `${label} adoption must carry the Project Context across — an empty transplant here is silent data loss`
    );
    assert.match(eolGuide, /\| Project \| X \|/, `${label} adoption must keep the Project Context table rows`);
  }

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

  // ---------------------------------------------------------------------------
  // (11) PROPOSAL-076: context inference reads the guide's "## Project Context"
  // rows (the _overview.md rows the pre-076 code looked for never existed in any
  // packaged template). Unit-level through the exported functions: the only
  // write consumer is whole-guide creation when the guide is missing — exactly
  // when the source is absent — so the real-value read has no black-box write
  // to observe.
  // ---------------------------------------------------------------------------
  const infer = await newProject('2');
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'inference must read the init-substituted Tech stack row');
  assert.equal(await inferMigrationContext(infer), 'none', 'inference must read the init-substituted Migration row');
  assert.equal(await inferTechStackSummary(brown), 'Node 20, Express 4, Jest', 'brownfield inference parity');

  const inferGuidePath = join(infer, GUIDE_REL);
  const inferBaseGuide = await readFile(inferGuidePath, 'utf8');
  const TECH_ROW = '| Tech stack | Node 20, Express 4, Jest |';
  const MIGRATION_ROW = '| Migration / legacy context | none |';
  assert.ok(inferBaseGuide.includes(TECH_ROW) && inferBaseGuide.includes(MIGRATION_ROW), 'fixture guide must carry the substituted rows');

  // (11a) user-edited values are picked up — reading the user region is the point.
  await writeFile(inferGuidePath, inferBaseGuide
    .replace(TECH_ROW, '| Tech stack | Deno 2 + Fresh |')
    .replace(MIGRATION_ROW, '| Migration / legacy context | WebForms -> Core rewrite underway |'));
  assert.equal(await inferTechStackSummary(infer), 'Deno 2 + Fresh', 'edited Tech stack value must win');
  assert.equal(await inferMigrationContext(infer), 'WebForms -> Core rewrite underway', 'edited Migration value must win');

  // (11b) <br> cell content (PROPOSAL-072 cell line-break convention) is captured whole.
  await writeFile(inferGuidePath, inferBaseGuide.replace(TECH_ROW, '| Tech stack | Node 20<br>Express 4 |'));
  assert.equal(await inferTechStackSummary(infer), 'Node 20<br>Express 4', '<br> cells must be captured whole');

  // (11c) deleted row / whitespace-only cell / renamed section heading → fallback.
  await writeFile(inferGuidePath, inferBaseGuide.replace(/^\| Tech stack \|.*\n/m, ''));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'deleted row must fall back');
  await writeFile(inferGuidePath, inferBaseGuide.replace(TECH_ROW, '| Tech stack |   |'));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'whitespace-only cell must fall back (parseContextLine null semantics)');
  await writeFile(inferGuidePath, inferBaseGuide.replace('## Project Context', '## Contexto del Proyecto'));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'renamed Project Context heading must fall back');

  // (11c-bis) The Project Context section must END at a CommonMark-valid
  // heading, including one indented 1-3 spaces. It used to require an
  // unindented `## `, so an indented sibling heading did not close the
  // section and rows BELOW it were read as though they were inside Project
  // Context — inference returned a value from the wrong section and doctor
  // exited 0 with nothing to say (`p082-b3-g4` finding 4). This is the same
  // "one predicate is stricter than its neighbour" class as the rest of this
  // batch, in the other module.
  const bounds = await newProject('1');
  const boundsGuide = await readFile(join(bounds, GUIDE_REL), 'utf8');
  await writeFile(
    join(bounds, GUIDE_REL),
    boundsGuide.replace(/^\| Tech stack \|.*$/m, '   ## Other Section\n\n| Tech stack | DECOY STACK |')
  );
  assert.notEqual(
    await inferTechStackSummary(bounds),
    'DECOY STACK',
    'an indented heading ends Project Context — a row below it must not be read as though it were inside'
  );

  // (11d) section-scoping: a same-name row outside "## Project Context" must
  // neither supply nor shadow the value.
  await writeFile(inferGuidePath, `${inferBaseGuide.replace(/^\| Tech stack \|.*\n/m, '')}\n| Tech stack | DECOY-outside-section |\n`);
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'a Tech stack row outside Project Context must not be read');
  await writeFile(inferGuidePath, `${inferBaseGuide}\n| Tech stack | DECOY-outside-section |\n`);
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'the in-section row must win over an out-of-section decoy');

  // (11e) CRLF guide still parses.
  await writeFile(inferGuidePath, inferBaseGuide.replace(/\n/g, '\r\n'));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'CRLF guide must still parse');

  // (11e2) gate G1: a fenced example containing a fake "## Project Context"
  // heading before the real section must not bound the section.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '## Project Context',
    '```md\n## Project Context\n| Tech stack | FENCED-DECOY |\n```\n\n## Project Context'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a fenced fake Project Context heading must not bound the section');

  // (11e3) gate G1: Markdown-escaped pipes in the cell are captured whole and
  // unescaped, not truncated at the first `\|`.
  await writeFile(inferGuidePath, inferBaseGuide.replace(TECH_ROW, '| Tech stack | Node \\| Express |'));
  assert.equal(await inferTechStackSummary(infer), 'Node | Express', 'escaped pipes in the cell must be captured whole and unescaped');

  // (11e4) gate G2: a fenced decoy row INSIDE the Project Context section can
  // neither shadow the real row nor supply a value when the real row is gone.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '| Field | Value |',
    '```md\n| Tech stack | FENCED-INSIDE-DECOY |\n```\n\n| Field | Value |'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a fenced decoy row inside the section must not shadow the real row');
  await writeFile(inferGuidePath, inferBaseGuide
    .replace(/^\| Tech stack \|.*\n/m, '')
    .replace('| Field | Value |', '```md\n| Tech stack | FENCED-INSIDE-DECOY |\n```\n\n| Field | Value |'));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'a fenced decoy row must not supply a value when the real row is gone');

  // (11e4b) gate G4: a four-backtick fence containing a three-backtick line
  // must not close early — the decoy row inside stays fenced.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '| Field | Value |',
    '````md\nnested example:\n```\n| Tech stack | FENCED-4TICK-DECOY |\n```\n````\n\n| Field | Value |'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a longer fence must not close on a shorter inner fence line');

  // (11e4d) gate G6: an info-string fence line (```js) inside an open fence is
  // content, not a close — the decoy after it stays fenced.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '| Field | Value |',
    '```md\nexample with an inner opener:\n```js\n## Project Context\n| Tech stack | FENCED-INFOSTRING-DECOY |\n```\n\n| Field | Value |'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'an info-string fence line inside a fence must not close it');

  // (11e4c) gate G4: a UTF-8 BOM must not defeat recognizability or parsing.
  await writeFile(inferGuidePath, '\uFEFF' + inferBaseGuide);
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a BOM-prefixed guide must still parse');

  // (11e5) gate G2 round-trip: bare `|` in the free-text init answers is
  // table-escaped on write and unescaped on read — no phantom cells, no
  // truncation.
  const pipeDir = join(tempRoot, `p-pipe-${projectCounter += 1}`);
  await mkdir(pipeDir, { recursive: true });
  const pipeStdout = captureStream(false);
  const pipeCode = await runInit({
    cwd: pipeDir,
    stdin: pipeStdin(['1', 'Node | Express, Jest', 'legacy | replatform', '1', '2', '1', '1', '2', 'y']),
    stdout: pipeStdout,
    stderr: captureStream(false)
  });
  assert.equal(pipeCode, 0, `pipe-answer init failed\n${pipeStdout.text}`);
  assert.match(await readFile(join(pipeDir, GUIDE_REL), 'utf8'), /^\| Tech stack \| Node \\\| Express, Jest \|$/m, 'bare pipes in Q2 must be escaped in the guide table cell');
  assert.equal(await inferTechStackSummary(pipeDir), 'Node | Express, Jest', 'pipe-carrying tech stack must round-trip through inference');
  assert.equal(await inferMigrationContext(pipeDir), 'legacy | replatform', 'pipe-carrying migration context must round-trip through inference');

  // (11f) missing guide → fallback (the known-limitation source-equals-target case).
  await unlink(inferGuidePath);
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'missing guide must fall back');
  assert.equal(await inferMigrationContext(infer), 'none', 'missing guide must fall back (migration)');

  // (11g) known limitation, black-box: re-creating the missing guide records the
  // fallback values (the source died with the guide), and the result round-trips.
  const recreatedRun = await runConfigure(infer, ['2', 'y']);
  assert.equal(recreatedRun.code, 0, `guide re-creation run failed\n${recreatedRun.all}`);
  const recreatedGuide = await readFile(inferGuidePath, 'utf8');
  assert.match(recreatedGuide, /^\| Tech stack \| unknown \|$/m, 'known limitation: a re-created guide records the fallback tech stack');
  assert.match(recreatedGuide, /^\| Migration \/ legacy context \| none \|$/m, 'known limitation: a re-created guide records the fallback migration context');
  assert.equal(await inferTechStackSummary(infer), 'unknown', 're-created guide must round-trip through inference');

  // (11h) doctor: a recognizable guide missing a Project Context row gets one
  // info finding naming exactly the missing row(s); fresh projects stay clean
  // (asserted in (6)/(7)); an unrecognizable guide keeps only its own finding.
  const pcDoc = await newProject('2');
  const pcGuidePath = join(pcDoc, GUIDE_REL);
  await writeFile(pcGuidePath, (await readFile(pcGuidePath, 'utf8')).replace(/^\| Tech stack \|.*\n/m, ''));
  const pcDoctor = await runDoctorAt(pcDoc);
  assert.equal(pcDoctor.code, 0, 'doctor must stay exit 0 on a missing Project Context row');
  assert.match(pcDoctor.stdout, /^\[info\] .*"## Project Context" is missing machine-readable row\(s\): Tech stack/m, 'doctor: missing Tech stack row is reported at info level');
  assert.match(pcDoctor.stdout, /1 finding\(s\): 0 warn, 1 info\./, 'doctor: the isolated missing-row case must count as exactly one info finding');
  assert.doesNotMatch(pcDoctor.stdout, /row\(s\): Tech stack, Migration/, 'doctor: the intact Migration row must not be listed');

  await writeFile(pcGuidePath, '\uFEFF' + (await readFile(pcGuidePath, 'utf8')));
  const pcBomDoctor = await runDoctorAt(pcDoc);
  assert.match(pcBomDoctor.stdout, /missing machine-readable row\(s\): Tech stack/, 'doctor: a BOM must not defeat the row check');

  // (11h2) gate G5: a marker-managed guide whose Project Context heading was
  // renamed away still gets a doctor finding — the canonical-state check stays
  // silent (markers are fine) and inference silently falls back otherwise.
  const pcGone = await newProject('2');
  const pcGonePath = join(pcGone, GUIDE_REL);
  await writeFile(pcGonePath, (await readFile(pcGonePath, 'utf8')).replace('## Project Context', '## About This Project'));
  const pcGoneDoctor = await runDoctorAt(pcGone);
  assert.equal(pcGoneDoctor.code, 0, 'doctor must stay exit 0 on a missing Project Context section');
  assert.match(pcGoneDoctor.stdout, /has no "## Project Context" section/, 'doctor: marker-managed guide without the section is reported');
  assert.equal(await inferTechStackSummary(pcGone), 'unknown', 'inference falls back without the Project Context section');

  const pcBrown = await newProject('2', '2');
  const pcBrownGuidePath = join(pcBrown, GUIDE_REL);
  await writeFile(pcBrownGuidePath, (await readFile(pcBrownGuidePath, 'utf8')).replace(/^\| Migration \/ legacy context \|.*\n/m, ''));
  const pcBrownDoctor = await runDoctorAt(pcBrown);
  assert.match(pcBrownDoctor.stdout, /missing machine-readable row\(s\): Migration \/ legacy context/, 'doctor: brownfield missing Migration row is reported (parity)');

  assert.doesNotMatch(foreignDoctor.stdout, /missing machine-readable row/, 'doctor: unrecognizable guide must not get the Project Context row finding');

  // (11j) gate G3: a markerless guide whose ONLY "## Project Context" heading
  // sits inside a fenced example must be unrecognizable — recognizability now
  // implies locatable bounds, so an accepted adoption offer can never hit the
  // transplant internal error.
  const fencedPc = await newProject('2');
  await writeFile(
    join(fencedPc, GUIDE_REL),
    '# Dflow AI Agent Guide\n\nNotes.\n\n```md\n## Project Context\n```\n\nMore notes.\n'
  );
  const fencedPcRun = await runConfigure(fencedPc, ['2', 'y'], { tty: true });
  assert.equal(fencedPcRun.code, 0, `fenced-only-PC guide run failed\n${fencedPcRun.all}`);
  assert.ok(!fencedPcRun.stdout.includes(GUIDE_QUESTION), 'a guide whose only Project Context heading is fenced must not get the adoption offer');
  assert.match(fencedPcRun.all, /not recognizable as a Dflow guide/, 'fenced-only-PC guide must be treated as unrecognizable');
  const fencedPcDoctor = await runDoctorAt(fencedPc);
  assert.match(fencedPcDoctor.stdout, /is not recognizable as a Dflow guide/, 'doctor: fenced-only-PC guide gets the unrecognizable finding');
  assert.doesNotMatch(fencedPcDoctor.stdout, /accept the marker-adoption offer/, 'doctor: fenced-only-PC guide must not be pointed at a non-existent offer');

  // ---------------------------------------------------------------------------
  // (12) PROPOSAL-078 phase 1 — table-formatting convention delivery:
  // (a) doctor reports spec docs that hold tables but lack the convention
  //     comment (info, aggregated, whole-file comment search);
  // (b) scope boundaries: shared/ and features/completed/ are never scanned,
  //     fence-only tables never count (fresh-init cleanliness is locked by
  //     the earlier clean-project assertions);
  // (c) the canonical flow one-liner is delivered identically across BOTH
  //     tracks' references (grep-sync lock, per the P-078 amendment);
  // (d) unit edges of hasTableWithoutConventionComment.
  // ---------------------------------------------------------------------------
  const conv = await newProject('2');
  const strippedGlossary = (await readFile(join(conv, 'dflow/specs/domain/glossary.md'), 'utf8'))
    .split('\n').filter((line) => !line.includes('Formatting convention: keep table cells concise')).join('\n');
  await writeFile(join(conv, 'dflow/specs/domain/glossary.md'), strippedGlossary);
  // mid-file comment still counts as present (whole-file search, amendment #4)
  await writeFile(join(conv, 'dflow/specs/architecture/notes.md'),
    '# Notes\n\nprose first\n\n<!-- Formatting convention: keep table cells concise. -->\n\n| A | B |\n|---|---|\n| x | y |\n');
  // fenced table only -> not a table-bearing doc
  await writeFile(join(conv, 'dflow/specs/architecture/fenced.md'),
    '# Fenced\n\n```\n| A | B |\n|---|---|\n```\n');
  // completed/ archive is out of scope even when it would otherwise hit
  await mkdir(join(conv, 'dflow/specs/features/completed/SPEC-20250101-001-done'), { recursive: true });
  await writeFile(join(conv, 'dflow/specs/features/completed/SPEC-20250101-001-done/_index.md'),
    '# Done\n\n| A | B |\n|---|---|\n| x | y |\n');

  const convDoctor = await runDoctorAt(conv);
  assert.equal(convDoctor.code, 0, 'doctor stays exit 0 on convention-comment findings');
  assert.match(convDoctor.stdout, /1 spec doc\(s\) hold tables but lack the table-formatting convention comment/, 'doctor: aggregated info finding fires');
  assert.match(convDoctor.stdout, /dflow\/specs\/domain\/glossary\.md/, 'doctor: names the stripped doc');
  assert.doesNotMatch(convDoctor.stdout, /architecture\/notes\.md/, 'doctor: mid-file comment satisfies the check');
  assert.doesNotMatch(convDoctor.stdout, /architecture\/fenced\.md/, 'doctor: fence-only tables never count');
  assert.doesNotMatch(convDoctor.stdout, /completed\/SPEC-20250101-001-done/, 'doctor: completed/ is not scanned');
  assert.match(convDoctor.stdout, /Doctor never edits user-authored specs/, 'doctor: read-only stance stated in the action');

  // (12c) canonical one-liner delivered identically in both tracks
  const CANONICAL_LINE = '> **Table-cell formatting**: keep table cells concise — separate multiple short items with `<br>` (never chain them into one line with ；/; separators), and move long narrative detail out of the cell into a document section (full convention: the formatting comment at each spec doc\'s head).';
  const FLOW_SPOTS = {
    'finish-feature-flow.md': 1,
    'modify-existing-flow.md': 1,
    'new-feature-flow.md': 2,
    'new-phase-flow.md': 2,
    'drift-verification.md': 1
  };
  for (const track of ['greenfield', 'brownfield']) {
    for (const [file, expected] of Object.entries(FLOW_SPOTS)) {
      const content = await readFile(join(repoRoot, 'templates', track, 'references', file), 'utf8');
      const count = content.split(CANONICAL_LINE).length - 1;
      assert.equal(count, expected, `${track}/references/${file}: canonical table-cell line must appear exactly ${expected}x (byte-identical for grep-sync)`);
    }
  }

  // (12d) unit edges (regex boundaries per review p078-r1: single-column
  // outer-pipe tables detected, pipe-less multi-column detected, bare ---
  // excluded)
  assert.equal(doctorChecks.hasTableWithoutConventionComment('| A |\n|---|---|\n| x |\n'), true, 'bare table without comment hits');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('| A |\n|---|\n| long wall cell |\n'), true, 'single-column outer-pipe table is still a table');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('A | B\n---|---\nx | y\n'), true, 'pipe-less two-column delimiter is detected');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('<!-- Formatting convention: keep table cells concise ... -->\n| A | B |\n|---|---|\n'), false, 'comment anywhere satisfies');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('# Doc\n\n---\n\nprose\n'), false, 'thematic break is not a table');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('# Doc\n\n --- \n\nprose\n'), false, 'padded thematic break is not a table either');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('```\n|---|---|\n```\n'), false, 'fenced delimiter row is not a table');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('| A | B |\r\n|---|---|\r\n| x | y |\r\n'), true, 'CRLF docs are detected too');

  // ---------------------------------------------------------------------------
  // PROPOSAL-082 G5 / PROPOSAL-083 §4 — `_conventions.md` staleness fingerprints.
  //
  // The predecessor of this check was written, wired, fixture-tested and then
  // REMOVED, because against the projection bug `f382671` later fixed it could
  // only ever report success. So the first thing asserted here is that it is not
  // vacuous: it must be silent on a real fresh project AND fire on each way a
  // section can be wrong — including the one a whole-file grep cannot see.
  // ---------------------------------------------------------------------------
  {
    // The markers are only meaningful if they are actually in the packaged
    // templates, in the section they claim. Re-derived here rather than trusted
    // from the comment beside the table.
    for (const edition of ['greenfield', 'brownfield']) {
      const packaged = await readFile(join(repoRoot, `templates/${edition}/scaffolding/_conventions.md`), 'utf8');
      for (const fp of doctorChecks.CONVENTIONS_FINGERPRINTS) {
        if (fp.editions && !fp.editions.includes(edition)) continue;
        const body = doctorChecks.conventionsSectionBody(packaged, fp.heading);
        assert.ok(body !== null, `${edition} _conventions.md must have a § ${fp.heading} section for fingerprint ${fp.id}`);
        assert.ok(body.includes(fp.marker), `${edition} _conventions.md § ${fp.heading} must carry the ${fp.id} marker`);
      }
      assert.deepEqual(
        doctorChecks.findConventionsDrift(packaged, edition),
        [],
        `the packaged ${edition} _conventions.md must be drift-free — a fingerprint that fires on the template is mis-specified`
      );
    }

    // A real project, freshly created: silent.
    const convFresh = await newProject('1');
    const freshConventions = await readFile(join(convFresh, CONVENTIONS_REL), 'utf8');
    assert.deepEqual(
      doctorChecks.findConventionsDrift(freshConventions, 'greenfield'),
      [],
      'a freshly projected _conventions.md must produce no drift findings'
    );
    const freshDoctor = await runDoctorAt(convFresh);
    assert.doesNotMatch(freshDoctor.stdout, /_conventions\.md § /, 'doctor must not report _conventions drift on a fresh project');

    // stale: the section is there, the rule is not.
    const staleBody = freshConventions.replace('cascade result is a floor', 'cascade result is a starting point');
    const staleDrift = doctorChecks.findConventionsDrift(staleBody, 'greenfield');
    assert.deepEqual(staleDrift.map((d) => `${d.id}:${d.state}`), ['ceremony-escalate-only:stale'], 'removing the escalate-only rule is detected as stale');

    // missing: the whole section is gone (every pre-f382671 project, for SPEC-ID
    // Format — no released version ever projected it).
    const missingBody = freshConventions.replace(/### SPEC-ID Format[\s\S]*?(?=### Slug Conventions)/, '');
    const missingDrift = doctorChecks.findConventionsDrift(missingBody, 'greenfield');
    assert.deepEqual(missingDrift.map((d) => `${d.id}:${d.state}`), ['spec-id-minimal-host:missing'], 'a deleted section is detected as missing, not silently passed');

    // The non-vacuity case: marker present in the FILE but not in its section.
    // A whole-file grep passes this; the section-local read must not.
    const movedBody = freshConventions
      .replace('Minimal (zero-phase) host exception', 'Minimal host note')
      .replace('## Glossary Consistency', '## Glossary Consistency\n\nMinimal (zero-phase) host exception\n');
    const movedDrift = doctorChecks.findConventionsDrift(movedBody, 'greenfield');
    assert.deepEqual(movedDrift.map((d) => `${d.id}:${d.state}`), ['spec-id-minimal-host:stale'], 'a marker in the wrong section is still stale — the check is section-local, not a file grep');

    // Levels: missing is info (content never offered), stale is warn (a live
    // contradiction inside the project's own conventions).
    await writeFile(join(convFresh, CONVENTIONS_REL), staleBody);
    const staleDoctor = await runDoctorAt(convFresh);
    assert.match(staleDoctor.stdout, /\[warn\] dflow\/specs\/shared\/_conventions\.md § Ceremony Scaling \(Project Application\) is missing the escalate-only rule/, 'a stale section warns, and its title names WHICH rule is missing — three fingerprints share this heading, so a heading-only title repeats itself');
    await writeFile(join(convFresh, CONVENTIONS_REL), missingBody);
    const missingDoctor = await runDoctorAt(convFresh);
    assert.match(missingDoctor.stdout, /\[info\] dflow\/specs\/shared\/_conventions\.md has no § SPEC-ID Format section/, 'a never-projected section is info, not warn');

    // Empty input produces no drift findings — but that is only acceptable
    // because the FILE-MISSING case is reported on its own, which is asserted
    // next. The earlier version of this assertion claimed the missing-file case
    // was "reported elsewhere" when nothing reported it at all: every
    // `_conventions` check early-returns on a missing path, so the worst state
    // of the file was the one state doctor was silent about. The parenthetical
    // gave that gap an alibi, which is why the claim is now a test.
    // Empty content has every section missing and now SAYS so. It used to
    // short-circuit to [], which made a whitespace-only file report nothing
    // while a one-character file reported all three — the emptier file getting
    // the cleaner verdict. The caller collapses this into one finding; the pure
    // function must not lie about it.
    assert.deepEqual(
      doctorChecks.findConventionsDrift('', 'greenfield').map((d) => `${d.id}:${d.state}`),
      ['ceremony-escalate-only:missing', 'spec-files-no-br-families:missing', 'spec-id-minimal-host:missing'],
      'empty content reports every section missing, exactly as a one-character file does'
    );
    // ⚠ COUNT THE FINDINGS THE USER ACTUALLY SEES, not just the ones the check
    // under test authored. The previous version of this block asserted only
    // `doesNotMatch(/has no § /)` — true, and useless: the drift block DOES
    // suppress its own three findings for a blank file, but the three OTHER
    // `_conventions` checks each carried on and emitted their own, so the file
    // produced five findings while this assertion certified "one clear finding".
    // A cross-vendor round found it (`p082-b3-g1` finding 1). The defect and the
    // blind spot are the same shape: a check verified in isolation, when the
    // property that matters is a property of the whole report.
    const conventionsFindings = (stdout) => stdout
      .split(/\r?\n/)
      .filter((l) => /^\[(warn|info)\] /.test(l) && l.includes('_conventions.md'));

    // A file that EXISTS but is whitespace-only: one clear finding, no drift spam.
    await writeFile(join(convFresh, CONVENTIONS_REL), '   \n\n');
    const emptyDoctor = await runDoctorAt(convFresh);
    assert.match(emptyDoctor.stdout, /\[warn\] dflow\/specs\/shared\/_conventions\.md is empty/, 'a present-but-empty _conventions.md is reported, not silently accepted');
    assert.doesNotMatch(emptyDoctor.stdout, /has no § /, 'an empty file gets one finding, not one per fingerprint');
    assert.deepEqual(
      conventionsFindings(emptyDoctor.stdout),
      ['[warn] dflow/specs/shared/_conventions.md is empty'],
      'a blank _conventions.md produces exactly ONE finding across ALL FOUR checks that read it — not one per check'
    );

    await rm(join(convFresh, CONVENTIONS_REL));
    const goneDoctor = await runDoctorAt(convFresh);
    assert.match(goneDoctor.stdout, /\[warn\] dflow\/specs\/shared\/_conventions\.md is missing/, 'a missing _conventions.md is reported, not passed over in silence');
    assert.doesNotMatch(goneDoctor.stdout, /All checks passed/, 'doctor must not report a clean bill of health for a project with no _conventions.md');
    assert.doesNotMatch(goneDoctor.stdout, /has no § /, 'the drift scan is skipped when the file itself is gone — three section findings about a missing file is noise');
    assert.deepEqual(
      conventionsFindings(goneDoctor.stdout),
      ['[warn] dflow/specs/shared/_conventions.md is missing'],
      'an absent _conventions.md produces exactly ONE finding across all four checks'
    );

    // The three sibling checks stay silent on absent/blank ONLY because the
    // drift check reports it. That coupling is invisible at each call site, so
    // it is pinned here: if the owner ever stops reporting, the two assertions
    // above go to zero findings and this suite fails loudly instead of doctor
    // going quiet about the worst state the file can be in.
    assert.ok(
      conventionsFindings(goneDoctor.stdout).length > 0 && conventionsFindings(emptyDoctor.stdout).length > 0,
      'the absent/blank report must exist at all — silence here is the failure mode, not a clean bill'
    );

    // A heading indented 1-3 spaces is CommonMark-valid, and the policy-format
    // check used to demand an unindented level-2 heading while the drift check
    // accepted the indent — so one check called the section missing while the
    // other found it and inference read its value fine (`p082-b3-g1` finding 2).
    //
    // ⚠⚠ ONLY HEADINGS THAT DO NOT FOLLOW A LIST ARE INDENTED HERE, and that is
    // CommonMark rather than a workaround. A heading indented to an open list
    // item's content column belongs to THAT ITEM, so `   ## Prose Language`
    // after `- **Length target**: …` / `  (Dflow skill guidance)` is a heading
    // inside the item and not a document-level section. Verified against
    // commonmark@0.31.2: the heading node's parent is `item`, not `document`.
    // Indenting it therefore SHOULD make doctor report that section missing —
    // asserted separately below, because it is a different claim.
    //
    // The previous version of this block indented all three blindly and asserted
    // "not missing". That passed only because the old per-line parser could not
    // see list context at all; once the classification could, the assertion was
    // measuring the parser's blindness rather than the rule it names.
    const indentUnlessInList = (text) => {
      const lines = text.split('\n');
      let indented = 0;
      const out = lines.map((line, i) => {
        if (!/^## (Git Policy|AI Commit Policy|Prose Language)$/.test(line)) return line;
        let j = i - 1;
        while (j >= 0 && !lines[j].trim()) j -= 1;
        const prev = j >= 0 ? lines[j] : '';
        // A list marker, or an indented continuation of one, means a list is
        // still open here and an indented heading would land inside it.
        if (/^ {0,3}(?:[-*+]|\d{1,9}[.)])([ \t]|$)/.test(prev) || /^[ \t]/.test(prev)) return line;
        indented += 1;
        return `   ${line}`;
      }).join('\n');
      // ⚠ Without this the whole assertion below can pass vacuously: if the
      // generated file ever puts all three headings after lists, nothing gets
      // indented and "no section is missing" becomes trivially true while
      // certifying a rule it never exercised.
      assert.ok(indented > 0, 'the indent case must actually indent at least one policy heading');
      return out;
    };
    await writeFile(join(convFresh, CONVENTIONS_REL), indentUnlessInList(freshConventions));
    const indentedDoctor = await runDoctorAt(convFresh);
    assert.doesNotMatch(
      indentedDoctor.stdout,
      /_conventions\.md is missing the ## (Git Policy|AI Commit Policy|Prose Language) section/,
      'a 1-3 space indented policy heading is present, not missing — the locator must agree with doctor-checks.headingAt'
    );
    assert.doesNotMatch(
      indentedDoctor.stdout,
      /line is not machine-readable/,
      'and the policy VALUES are still read from an indented section'
    );

    // The other half of the same rule, and the reason the helper above has to
    // discriminate: a heading indented INTO an open list item is that item's
    // content, so its section really is absent from the document. Doctor says so
    // — loudly, which is the acceptable direction — instead of finding a section
    // that a Markdown renderer would not show as one.
    await writeFile(
      join(convFresh, CONVENTIONS_REL),
      freshConventions.replace(/^## Prose Language$/m, '   ## Prose Language')
    );
    const inListDoctor = await runDoctorAt(convFresh);
    assert.match(
      inListDoctor.stdout,
      /_conventions\.md is missing the ## Prose Language section/,
      'a heading indented into the preceding list item is inside that item, so the section is genuinely absent (commonmark@0.31.2: parent is `item`, not `document`)'
    );
    await writeFile(join(convFresh, CONVENTIONS_REL), freshConventions);

    // Line endings. `_conventions.md` is user-owned and hand-edited on any OS,
    // and this module's splitter has to agree with the `m`-flag regexes in
    // lib/init.js about what a line is. It did not: `/\r?\n/` left a CR-only
    // file as one giant line here while `/^> Dflow Version:/m` still parsed it
    // there, so the two checks described the same file differently
    // (`p082-b3-g1` finding 3). All three forms must give the same answer.
    const lfDrift = doctorChecks.findConventionsDrift(freshConventions, 'greenfield');
    for (const [label, eol] of [['CRLF', '\r\n'], ['CR-only', '\r']]) {
      assert.deepEqual(
        doctorChecks.findConventionsDrift(freshConventions.replace(/\n/g, eol), 'greenfield'),
        lfDrift,
        `${label} line endings must produce the same drift verdict as LF`
      );
    }

    // ATX closing sequences. CommonMark requires a `#` run at the end of a
    // heading to be PRECEDED by whitespace to count as a closing sequence;
    // otherwise it is part of the heading text. Stripping it unconditionally
    // let `## Git Policy#` resolve to `Git Policy`, so the widened policy
    // locator accepted a malformed heading that the old exact `^## X$` test had
    // rejected — the one thing the widening gave up (`p082-b3-g2` finding 2).
    for (const [line, want] of [
      ['## Git Policy', 'Git Policy'],
      ['## Git Policy #', 'Git Policy'],
      ['## Git Policy ###', 'Git Policy'],
      ['## Git Policy#', 'Git Policy#'],
      ['## Git Policy##', 'Git Policy##']
    ]) {
      assert.deepEqual(
        doctorChecks.extractH2Headings(line),
        [want],
        `${JSON.stringify(line)} is the heading ${JSON.stringify(want)}`
      );
    }
    assert.equal(
      doctorChecks.conventionsSectionBodies('## Git Policy#\n\nSelected Git policy: `gitflow`\n', 'Git Policy').length,
      0,
      'a malformed closing sequence must NOT resolve to the canonical section name'
    );

    // ═══════════════════════════════════════════════════════════════════════
    // THE CLASS GUARD. Every defect this module produced across four review
    // rounds had one shape: a block-structure predicate spelling "whitespace"
    // as JS `\s` where CommonMark means a space or a tab. `\s` additionally
    // matches U+00A0, form feed, vertical tab and a dozen Unicode spaces, so
    // such a line landed in a gap — neither the block it looked like nor a
    // paragraph — and a section either ran on past its end (silent pass: a
    // stale file reads as current) or ended early (content loss: the walker
    // pops the line carrying the marker).
    //
    // Four rounds found five instances one at a time. This asserts the class:
    // no block-structure function may contain `\s` at all. It is deliberately a
    // SOURCE-level check, because that is the only form that catches the sixth
    // instance before a reviewer does — and this repo's own note says a review
    // round is an expensive way to run a grep.
    //
    // ⚠ To add a legitimate `\s`, do not weaken this — move that expression out
    // of these functions, or narrow it to `[ \t]`. The functions listed here
    // decide Markdown BLOCK STRUCTURE; content-matching regexes elsewhere in
    // the module (the `Selected Git policy:` line, § reference trimming) use
    // `\s` correctly and are not in scope.
    // ⚠⚠ THE ONE COPY OF "WHAT THE CLASS GUARD COVERS". Two separate checks read
    // this — the source-level whitespace ban immediately below, and the
    // invisible-character pin registry near the end of this test — and they must
    // cover exactly the same set or the guard's coverage claim is two different
    // claims. Declared out here so neither can drift from the other.
    const guardedConstructs = {
      blockFunctions: [
        'isThematicBreak', 'parseAtxHeading', 'stripSpaceTab', 'blankFencedBlocks',
        'htmlBlockStart', 'indentWidth', 'listContentColumn', 'classifyLines',
        'extractHeadings', 'extractH2Headings', 'unclosedHtmlBlockLine',
        'classifiedVisible', 'visibleTextLines', 'maskCodeBlocks'
      ],
      blockConstants: [
        'LINE_SPLIT_RE', 'FENCE_MARKER', 'FENCE_OPEN_RE', 'FENCE_CLOSE_RE',
        'ATX_HEADING_RE', 'TABLE_DELIMITER_ROW_RE', 'HTML_BLOCK_TYPES',
        'HTML_TYPE1_INVISIBLE_TAGS',
        'HTML_BLOCK_TAGS', 'HTML_BLOCK_TYPE6_RE', 'BULLET_MARKER', 'ORDERED_DELIM',
        'ORDERED_MARKER', 'LIST_ITEM_RE', 'EMPTY_LIST_ITEM_RE', 'INTERRUPTING_ITEM_RE',
        'LIST_ITEM_PREFIX_RE', 'BLOCKQUOTE_RE', 'SETEXT_UNDERLINE_RE', 'BLANK_LINE_RE'
      ]
    };

    {
      const source = await readFile(join(repoRoot, 'lib/doctor-checks.js'), 'utf8');

      // A declaration's full text with comments stripped — used for BOTH
      // functions and constants.
      //
      // ⚠ The constant half used to read only the declaration's FIRST LINE
      // (`source.split('\n').find((l) => l.startsWith('const X ='))`). That is a
      // vacuous pass for any multi-line constant, and the debt-12 rewrite added
      // one: `HTML_BLOCK_TYPES` is an array of regex pairs whose first line is
      // just `const HTML_BLOCK_TYPES = [`, so every pattern inside it would have
      // gone unchecked while the guard reported success. Slicing to the next
      // top-level declaration is what the function half already did.
      // `kind` is 'function' or 'decl'; `name` is a plain identifier, so nothing
      // needs escaping.
      //
      // ⚠ Anchored to the START OF A LINE, not `source.indexOf`. The plain
      // indexOf found the FIRST textual occurrence, so one comment line
      // mentioning the declaration above it — `// ref: const X = the rule` —
      // made the guard read the comment and report clean while the real
      // declaration below carried the banned class. Demonstrated by a reviewer,
      // not hypothesised.
      // ⚠ `const|let|var` for the same reason the census below matches all
      // three: pinning on `const` alone let a `let` declaration escape.
      const declRegion = (kind, name) => {
        // ⚠ `\s*=`, not ` =`. Requiring exactly one space let `const NAME=/…/`
        // slip past — a reviewer defeated the guard with it by putting a literal
        // `\s` in a block-structure regex declared that way. Whitespace around
        // `=` is a formatting choice, so a check that depends on it is a check
        // an autoformatter can switch off.
        const pattern = kind === 'function' ? `function ${name}\\(` : `(?:const|let|var) ${name}\\s*=`;
        const m = source.match(new RegExp(`^${pattern}`, 'm'));
        assert.ok(m, `class guard cannot find ${kind} ${name} at the start of a line — renaming means updating its list`);
        const start = m.index;
        const rest = source.slice(start + 1);
        const next = rest.search(/\nfunction |\nconst [A-Za-z_]/);
        // ⚠ Comments must be stripped, and the first version of this guard did
        // not: it read the prose EXPLAINING the rule as a violation of it, and
        // the slice also runs up to the next declaration, so it swallows that
        // declaration's leading comment block. A guard that fires on its own
        // documentation gets weakened or deleted by the next maintainer, which
        // is worse than not having it.
        // The `// ` strip assumes no regex literal here contains a slash-slash
        // followed by a space; asserted below rather than assumed.
        return (next === -1 ? rest : rest.slice(0, next))
          .split('\n')
          .filter((l) => !l.trim().startsWith('//'))
          .map((l) => l.replace(/\/\/ .*$/, ''))
          .join('\n');
      };

      const assertTightWhitespace = (label, body) => {
        assert.ok(
          !body.includes('\\s'),
          `${label} contains \\s. CommonMark means space-or-tab here; \\s also matches U+00A0, form feed and vertical tab, which is the one defect class this module keeps producing. Use [ \\t].`
        );
        // `[^\S\r\n]` is `\s` minus line terminators — still NBSP, form feed and
        // vertical tab, so it reintroduces the exact defect while reading as a
        // deliberate narrowing. A reviewer defeated the first version of this
        // guard with it (`p082-b3-g5` finding 5).
        assert.ok(
          !body.includes('[^\\S'),
          `${label} uses a negated \\S class, which still matches NBSP / form feed / vertical tab — the very characters this guard exists to keep out. Use [ \\t].`
        );
        // ⚠⚠ `.trim()` IS THIS DEFECT CLASS IN A DIFFERENT SPELLING, and the
        // guard was blind to it for a whole round. JS `.trim()` strips exactly
        // the set the two checks above ban — U+00A0, form feed, vertical tab,
        // U+2000-200B, U+FEFF — while containing no `\s` and no `[^\S` for them
        // to match. `classifyLines` tested blankness with `!line.trim()`, so a
        // line holding only a non-breaking space was blank here and a paragraph
        // to CommonMark: the section ran on and a stale file reported `current`.
        // Silent pass. Use `BLANK_LINE_RE` for blankness and `stripSpaceTab`
        // for trimming; both spell the rule as `[ \t]` in one place.
        assert.ok(
          !body.includes('.trim('),
          `${label} calls .trim(), which strips U+00A0 / form feed / vertical tab / U+2000-200B — the same characters \\s does, and the same defect class. Use BLANK_LINE_RE to test blankness or stripSpaceTab to trim.`
        );
        // ⚠⚠ NAMING THE CHARACTERS DIRECTLY IS THE FOURTH SPELLING, and a
        // reviewer defeated the first three bans with it: an escape class
        // `/[ \f\v]+$/` inside `isThematicBreak` contains no `\s`, no
        // `[^\S`, no `.trim(` and no literal invisible character, and it made a
        // `---<NBSP>` line a thematic break — so a section that should have
        // ended ran on and a stale file reported `current`. Silent pass, with
        // the whole suite green.
        //
        // ⚠ Be honest about what this adds. It bans one more SPELLING. The guard
        // is a lint over literal substrings; it cannot see semantics, and a
        // determined edit can still express "treat U+00A0 as whitespace" some
        // way none of these four name. What actually caught that reviewer's
        // earlier drafts was the BEHAVIOURAL pins below, not this block.
        //
        // ⚠⚠ AND THAT WARNING WAS THEN PROVED, TWICE, BY THE NEXT TWO ROUNDS.
        // A fifth reviewer defeated the list with `String.fromCharCode(0xa0)`,
        // and a sixth with the hex escape `\xa0` — one character, no `\s`, no
        // named escape, no literal invisible byte, suite green, silent pass.
        // `\xa0` is added below for the cheaper error message it produces, NOT
        // as the fix: the list is now eight members and a ninth spelling exists
        // (`\u{a0}`, a code-point `Set`, `new RegExp` from parts, a
        // normalisation table). Extending it one member per defeat is a constant
        // rate, not convergence — a reviewer measured exactly that.
        // **The layer that actually holds this class shut is the pin registry
        // near the end of this file**, which requires every construct the guard
        // names to have a block-start invisible-character pin and fails when one
        // does not. A pin does not care how the whitespace test was spelled.
        for (const esc of ['\\u00a0', '\\u00A0', '\\xa0', '\\xA0', '\\f', '\\v', '\\u2007', '\\ufeff', '\\uFEFF']) {
          assert.ok(
            !body.includes(esc),
            `${label} names ${esc} directly. Block structure must not special-case an invisible character: to CommonMark it is ordinary text, and treating it as whitespace is this module's one recurring defect however it is spelled.`
          );
        }
      };

      // Everything that participates in deciding block structure. The function
      // list is far shorter than the five predicates it replaced, because
      // `classifyLines` is now the only thing that decides anything — but the
      // CONSTANT list grew, and a constant carries the defect just as well as a
      // function does.
      // ⚠ Declared in the ENCLOSING scope (`guardedConstructs`), not here. The
      // invisible-character pin registry further down asserts that every name in
      // these two lists is either pinned or explicitly excused, and a second copy
      // of the lists for it to read would be two expressions for one rule — the
      // defect class this whole file exists to hold shut.
      const { blockFunctions, blockConstants } = guardedConstructs;
      for (const name of blockFunctions) assertTightWhitespace(name, declRegion('function', name));
      for (const name of blockConstants) assertTightWhitespace(name, declRegion('decl', name));

      // The other hole the reviewer demonstrated: both lists are hand-written,
      // so a NEW block-structure declaration is simply not checked. Assert that
      // the file's function set and its top-level constant set are each exactly
      // (guarded + a known non-block allowlist), which turns "someone added one"
      // into a failing test rather than an invisible gap.
      //
      // ⚠ The constant half of this is new. Previously only functions were
      // checked for completeness, so a new block CONSTANT carrying `\s` was
      // invisible in two independent ways at once — unlisted, and (if listed)
      // read one line deep.
      {
        const declaredFns = [...source.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map((m) => m[1]);
        const nonBlockFns = [
          'parseContextLine', 'extractSectionRefs', 'normalizeHeading', 'headingResolves',
          'missingTemplateSections', 'matchesTemplateWithPlaceholders', 'escapeRegExp',
          'hasTableWithoutConventionComment', 'headingKey', 'conventionsSectionBodies',
          'conventionsSectionBody', 'normalizeForMarker', 'fingerprintAppliesTo',
          'findConventionsDrift'
        ];
        const strayFns = declaredFns.filter((n) => !blockFunctions.includes(n) && !nonBlockFns.includes(n));
        assert.deepEqual(
          strayFns,
          [],
          `new function(s) in lib/doctor-checks.js are not classified by the class guard: ${strayFns.join(', ')}. If it decides Markdown block structure, add it to blockFunctions; if not, add it to the allowlist. Do not skip this — an unlisted block predicate is exactly how this defect class survived four review rounds.`
        );

        // ⚠ `[A-Za-z_0-9]`, not `[A-Z_0-9]`. SCREAMING_CASE only meant a
        // camelCase top-level declaration was invisible to BOTH the completeness
        // assertion and (being absent from `blockConstants`) the whitespace
        // check. A reviewer defeated the guard with exactly that: a
        // `const isIndentedCode = (line) => /^(\t|\s{4,})/...` arrow function,
        // pointed at by branch 7, reintroducing the class with the suite green.
        // ⚠ `const|let|var`, not `const` alone. A reviewer defeated the census a
        // second way: `let TRAILING_INVISIBLES_RE = /[\s]+$/;` at top level put
        // the banned class literally in the file while being invisible to a
        // `^const` scan — unlisted, so `assertTightWhitespace` was never called
        // on it either. Suite green, silent pass restored.
        // ⚠ `\s*=`, not ` =`. A THIRD defeat came through the same census by
        // dropping the space: `const THEMATIC_SEPARATOR_RE=/^ {0,3}(-[\s]*){3,}$/;`
        // is invisible to a census that requires one — unlisted, so never
        // whitespace-checked, with a literal `\s` sitting in a block-structure
        // regex and the suite green. Three defeats, all of them the census
        // failing to SEE a declaration rather than judging it wrongly: the
        // census's coverage is the load-bearing half, so keep it maximally
        // permissive about spelling.
        const declaredConsts = [...source.matchAll(/^(?:const|let|var) ([A-Za-z_0-9]+)\s*=/gm)].map((m) => m[1]);
        const nonBlockConsts = [
          'GIT_POLICY_LINE_RE', 'AI_COMMIT_MARKER_LINE_RE', 'PROSE_LANGUAGE_LINE_RE',
          'TECH_STACK_ROW_RE', 'MIGRATION_CONTEXT_ROW_RE', 'GIT_POLICY_VALUES',
          'AI_COMMIT_MARKER_VALUES', 'SPEC_FORMATTING_CONVENTION_SNIPPET',
          'CONVENTIONS_FINGERPRINTS', 'CONVENTIONS_RETIRED'
        ];
        const strayConsts = declaredConsts.filter((n) => !blockConstants.includes(n) && !nonBlockConsts.includes(n));
        assert.deepEqual(
          strayConsts,
          [],
          `new top-level constant(s) in lib/doctor-checks.js are not classified by the class guard: ${strayConsts.join(', ')}. If it is read while deciding Markdown block structure, add it to blockConstants; if not, add it to the allowlist.`
        );
      }
      // The comment-stripping assumption above, asserted rather than trusted:
      // if a regex literal in this module ever contains `// `, the strip would
      // silently cut a real expression short and the guard would go blind on
      // the rest of that line — a false all-clear, which is the failure mode
      // this repo has paid for twice.
      for (const line of source.split('\n')) {
        if (line.trim().startsWith('//')) continue;
        assert.ok(
          !/\/[^\n]*\/\/ [^\n]*\//.test(line),
          `a regex literal on this line may contain "// ", which would blind the class guard: ${line.trim()}`
        );
      }

      // No literal invisible character may sit in the module's own source.
      // `lib/doctor-checks.js` used to demonstrate the U+00A0 defect with a REAL
      // U+00A0 inside the comment warning about it — indistinguishable from a
      // space in a diff, and an editor may normalize it away silently. This file
      // builds such characters with `String.fromCharCode` for that reason; the
      // module now has to earn the same claim rather than assert it in prose.
      for (const [i, line] of source.split('\n').entries()) {
        for (const ch of line) {
          const cp = ch.codePointAt(0);
          assert.ok(
            !(cp === 0xa0 || cp === 0x0b || cp === 0x0c || (cp >= 0x2000 && cp <= 0x200b) || cp === 0xfeff),
            `lib/doctor-checks.js:${i + 1} contains a literal U+${cp.toString(16).toUpperCase().padStart(4, '0')}. Write it with String.fromCharCode, or delete it — an invisible character in the source of the module that exists to get invisible characters right is not a joke anyone catches twice.`
          );
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // THE BLOCK CLASSIFICATION PASS (debt 12). What the rewrite made true that
    // was not true before — each of these FAILS against the five-predicate
    // version, which is the only reason to have them.
    {
      const SENT = 'SENTINEL-MARKER-LINE';
      const bodyOf = (lines, heading = 'Target Section') => {
        const doc = ['## Target Section', '', ...lines, '', '## Next Section', ''].join('\n');
        return doctorChecks.conventionsSectionBodies(doc, heading);
      };

      // ⚠⚠ EVERY SHAPE BELOW ENDS `--- / blank / SENTINEL`, AND THE `---` IS THE
      // LOAD-BEARING PART. The first draft of these pins left it out and every
      // one of them PASSED against the pre-rewrite module — they asserted
      // something true of the buggy code and would never have failed. The defect
      // only appears when a setext-capable line follows the block: the old
      // `closesOwnBlock` recognized single-line comments only, so after an
      // unclosed block the `---` was read as a setext underline, the section
      // ended early, and the pop deleted the content line. Verified: each shape
      // here yields `false` on `HEAD:lib/doctor-checks.js` and `true` now.
      // A pin that passes on the code it is meant to indict pins nothing.
      const keepsSentinel = (block) => {
        const bodies = bodyOf([...block, '---', '', SENT]);
        assert.equal(bodies.length, 1, `expected one body for ${JSON.stringify(block)}`);
        return bodies[0].includes(SENT);
      };

      // (a) MULTILINE HTML COMMENTS — `p082-b3-g5` finding 4, the defect that
      // could not be patched per-line and so forced the rewrite. The old code
      // opened an HTML block on any `<!--` but only ever closed a SINGLE-LINE
      // comment, so the walker stopped inside the comment and dropped the line
      // after it: content-loss direction, and `findConventionsDrift` reported
      // `stale` against a file that was current.
      {
        assert.ok(
          keepsSentinel(['<!-- a note that runs', 'across two lines -->', '2. the cascade result is a floor']),
          'a multiline HTML comment must not swallow the content after it'
        );
        const doc = [
          '## Ceremony Scaling (Project Application)', '',
          '<!-- a note that runs', 'across two lines -->',
          '2. the cascade result is a floor', '---', ''
        ].join('\n');
        assert.deepEqual(
          doctorChecks.findConventionsDrift(doc).filter((d) => d.id === 'ceremony-escalate-only'),
          [],
          'the rule is present, so nothing may be reported for it'
        );
      }

      // (c) The other HTML block types, each closing by its OWN rule rather than
      // by the single rule the old code knew. Types 1-5 close on the line
      // matching their end condition; type 6 closes at a blank line.
      for (const [label, block] of [
        ['type 1 script', ['<script>', 'var x = 1;', '</script>']],
        ['type 2 comment', ['<!-- one', 'two -->']],
        ['type 3 processing instruction', ['<?php', '?>']],
        ['type 4 declaration', ['<!DOCTYPE', 'html>']],
        ['type 5 CDATA', ['<![CDATA[', 'x]]>']],
        ['type 6 known tag', ['<div>']]
      ]) {
        assert.ok(keepsSentinel(block), `${label}: the block must end and let the following line through`);
      }

      // (b) REGRESSION GUARD, NOT A BEHAVIOUR PIN — and labelled so nobody
      // counts it as evidence for the rewrite. This passes on the old code too,
      // because the old code had no HTML block state to get wrong. It is here
      // because the FIRST version of `classifyLines` omitted the "end condition
      // is checked on the opening line" rule, so `<!-- Seeded by Dflow. -->` at
      // the head of every packaged template opened a block that never closed and
      // erased every heading in the file.
      assert.deepEqual(
        doctorChecks.extractHeadings('<!-- Seeded by Dflow. -->\n\n## After The Comment\n'),
        ['After The Comment'],
        'a single-line HTML comment closes on its own line'
      );

      // (d) SETEXT HEADING TEXT IS THE WHOLE PARAGRAPH. The old code took
      // `lines[i-1]` as the text and popped exactly one line, so a soft-wrapped
      // setext heading matched under its last line only and left its earlier
      // lines in the previous section's body as if they were content.
      {
        const info = doctorChecks.classifyLines(['Ceremony Scaling', '(Project Application)', '===']);
        assert.deepEqual(
          info[2].heading,
          { level: 1, text: 'Ceremony Scaling (Project Application)', setext: true, start: 0 },
          'a soft-wrapped setext heading carries its whole paragraph as text'
        );
        const doc = ['Ceremony Scaling', '(Project Application)', '---', '', 'body text', '', '## Next', ''].join('\n');
        assert.deepEqual(
          doctorChecks.conventionsSectionBodies(doc, 'Ceremony Scaling (Project Application)'),
          ['\nbody text\n'],
          'and the section is found under the joined text, with no heading line left in the body'
        );
      }

      // (e) EMPTY ATX HEADINGS. `## #` is the empty heading, not the heading
      // `#` — the lazy-capture backtracking divergence that the two-step
      // closing-sequence strip in `parseAtxHeading` fixed. The neighbouring
      // forms are pinned with it because they are what makes the fix a rule
      // rather than a special case.
      for (const [line, want] of [
        ['## #', ''],
        ['##', ''],
        ['## ', ''],
        ['## #####', ''],
        ['## Git Policy #', 'Git Policy'],
        ['## Git Policy#', 'Git Policy#'],
        ['## Git Policy ##', 'Git Policy']
      ]) {
        assert.deepEqual(
          doctorChecks.parseAtxHeading(line),
          { level: 2, text: want, setext: false },
          `${JSON.stringify(line)} is the heading ${JSON.stringify(want)}`
        );
      }
      // ...and an empty heading still resolves no cross-reference, because `''`
      // prefix-matches everything (`p082-b3-g5` finding 1). Making empty
      // headings real is what created that hazard; this is the pin that keeps
      // the two halves together.
      assert.equal(
        doctorChecks.headingResolves('Anything At All', doctorChecks.extractHeadings('## \n')),
        false,
        'an empty heading resolves nothing'
      );

      // (f) SETEXT HEADINGS ARE VISIBLE TO extractHeadings / extractH2Headings.
      // Neither ever saw one before, because each carried its own ATX-only
      // expression — so a `§ Heading` reference to a setext heading was reported
      // dangling and a template section written that way counted as missing.
      assert.deepEqual(
        doctorChecks.extractHeadings('Underlined H1\n===\n\nUnderlined H2\n---\n'),
        ['Underlined H1', 'Underlined H2'],
        'setext headings of both levels are headings'
      );
      assert.deepEqual(
        doctorChecks.extractH2Headings('Underlined H1\n===\n\nUnderlined H2\n---\n'),
        ['Underlined H2'],
        'and only the level-2 one is an H2'
      );

      // (h) LOOSE LISTS — a blank line does not end a list item whose content
      // continues indented. Found by probing the rewrite against the reference
      // BEFORE sending it to review, not by a round: the first version of
      // `classifyLines` closed every document-level block on a blank, so the
      // `---` below became a setext underline, the section ended early and the
      // walker popped the line carrying the rule. Content loss.
      //
      // ⚠ Lists and blockquotes are deliberately NOT symmetric, and the
      // asymmetry is measured, not reasoned: a blockquote really does end at a
      // blank line. Collapsing these two into one rule reintroduces one defect
      // or the other, so both directions are pinned here together.
      for (const [label, block, sectionEnds] of [
        ['list, blank, indented continuation', ['- a bullet', '', '  continuation'], false],
        ['ordered list, blank, indented', ['1. a step', '', '   continuation'], false],
        ['list, blank, deep indent', ['- a bullet', '', '        deep indent'], false],
        ['list, blank, UNindented', ['- a bullet', '', 'unindented'], true],
        ['blockquote, blank, indented', ['> quoted', '', '  continuation'], true],
        ['heading indented INSIDE a list item', ['- a bullet', '  ## Indented Heading'], false]
      ]) {
        assert.equal(
          !keepsSentinel(block),
          sectionEnds,
          `${label}: expected the section ${sectionEnds ? 'to END at the ---' : 'to CONTINUE past the ---'}`
        );
      }

      // (i) BLANKNESS IS SPACES AND TABS ONLY. `.trim()` strips U+00A0, form
      // feed, vertical tab and U+2000-200B, so `!line.trim()` made a line
      // holding only a non-breaking space a BLANK line here and a paragraph to
      // CommonMark. `para` / NBSP / `---` then read `---` as a thematic break
      // instead of a setext underline, the section ran on, and a stale
      // `_conventions.md` reported `current`. SILENT PASS — and invisible to the
      // class guard, because `.trim()` contains no `\s`. The guard now bans
      // `.trim(` in block code for exactly this reason.
      {
        const NBSP = String.fromCharCode(0xa0);
        assert.equal(
          doctorChecks.classifyLines([NBSP])[0].type,
          'paragraph',
          'a line holding only U+00A0 is a paragraph, not a blank line'
        );
        for (const [label, code] of [['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b]]) {
          assert.equal(
            doctorChecks.classifyLines([String.fromCharCode(code)])[0].type,
            'paragraph',
            `a line holding only ${label} is not blank`
          );
        }
        for (const [label, code] of [['space', 0x20], ['tab', 0x09]]) {
          assert.equal(
            doctorChecks.classifyLines([String.fromCharCode(code)])[0].type,
            'blank',
            `a line holding only a ${label} IS blank`
          );
        }
        // End to end, in the direction that matters: the rule is present, in a
        // section an NBSP line used to run past.
        const doc = [
          '## Ceremony Scaling (Project Application)', '',
          'Our project rows are below.', NBSP, '---', '',
          'The cascade result is a floor here.', '',
          '## Filling the Templates', ''
        ].join('\n');
        assert.ok(
          doctorChecks.findConventionsDrift(doc).some((d) => d.id === 'ceremony-escalate-only'),
          'the marker sits in a LATER section, so this file is stale and must be reported — the NBSP line must not merge the two sections'
        );
      }

      // (j) A TABLE HEADER NEED NOT BE ITS PARAGRAPH'S FIRST LINE. Requiring it
      // (`open.start === i - 1`) was a regression against the predicate this
      // pass replaced: one intro sentence above a table made the whole run a
      // single paragraph, so a following `---` became a setext underline and the
      // pop deleted the ENTIRE section body. Total content loss.
      {
        const doc = ['## T', '', 'Our rows:', '| Situation | Tier |', '|---|---|', '| X | T1 |', '---', '', 'ZQZ', '', '## N', ''].join('\n');
        const bodies = doctorChecks.conventionsSectionBodies(doc, 'T');
        assert.equal(bodies.length, 1, 'intro-then-table: expected one body');
        assert.ok(bodies[0].includes('ZQZ'), 'an intro line above a table must not delete the section body');
        assert.equal(
          doctorChecks.hasTableWithoutConventionComment('Intro:\n| a | b |\n|---|---|\n'),
          true,
          'and the table is still detected when a line precedes its header'
        );
        // ⚠ NOT a defect, pinned so it is not "fixed" by a later round: with a
        // BARE `---` there is no delimiter row, so this really is a setext
        // heading. commonmark@0.31.2 and marked (GFM) both agree with us.
        assert.deepEqual(
          doctorChecks.extractH2Headings('Intro:\n| a | b |\n---\n'),
          ['Intro: | a | b |'],
          'a bare --- after pipe-bearing prose is a setext heading in BOTH parsers, not a phantom'
        );

        // ⚠⚠ THE HEADER ROW'S OWN INDENT. Widening the header rule opened a gap
        // the narrow rule had made unreachable: `TABLE_DELIMITER_ROW_RE` limits
        // the DELIMITER row to `^ {0,3}` but the header test was only
        // `.includes('|')`. A 4-column-indented header is indented code to
        // CommonMark and no table at all to GFM, yet we read a table, so the
        // `---` below stopped ending the section — SILENT PASS.
        //
        // ⚠ The pin directly above uses an UNindented header and therefore could
        // not tell the broken version from the fixed one. That was demonstrated,
        // not guessed: the fix passed the suite unchanged. A pin that cannot
        // fail against the defect it names is decoration.
        for (const indent of ['    ', '\t', '   \t', '        ']) {
          assert.ok(
            !keepsSentinel(['Our project rows are below.', `${indent}| Situation | Tier |`, '|---|---|']),
            `a header row indented to column 4+ (${JSON.stringify(indent)}) is indented code, not a table header, so --- still ends the section`
          );
        }
        // ...and the 0-3 space indents that ARE valid header rows still work.
        for (const indent of ['', ' ', '  ', '   ']) {
          assert.ok(
            keepsSentinel(['Our project rows are below.', `${indent}| Situation | Tier |`, '|---|---|', '| X | T1 |']),
            `a header row indented ${indent.length} spaces is still a table header`
          );
        }
      }

      // (l) INDENTED CODE IS DECIDED BY `indentWidth`, NOT A SECOND REGEX.
      // `INDENTED_CODE_RE = /^(\t| {4,})/` and `indentWidth` answered the same
      // question differently: a space then a tab is column 4, because a tab
      // advances to the next multiple of four. Both directions were measured, so
      // both are pinned.
      {
        const TAB = String.fromCharCode(0x09);
        // Direction A — content loss: ` \tprose` is indented code, so `---` is a
        // thematic break and the section continues. Read as a paragraph, `---`
        // became a setext underline and the pop deleted the body.
        assert.ok(
          keepsSentinel([` ${TAB}Our project rows are below.`]),
          'space-then-tab is indented code: the section continues past the ---'
        );
        // Direction B — silent pass: `   \t| a | b |` is indented code, so it is
        // not a table header and the section ends at the ---.
        assert.ok(
          !keepsSentinel([`   ${TAB}| Situation | Tier |`, '|---|---|']),
          'a space-and-tab indented pipe line is indented code, not a table header'
        );
        // The column arithmetic itself, pinned directly.
        for (const [line, want] of [[' \tx', 4], ['  \tx', 4], ['   \tx', 4], [`${TAB}x`, 4], ['   x', 3], ['    x', 4]]) {
          assert.equal(doctorChecks.classifyLines([line])[0].type, want >= 4 ? 'code' : 'paragraph',
            `${JSON.stringify(line)} sits at column ${want}`);
        }
      }

      // (j2) READER-INVISIBLE CONTENT. `classifyLines` decides what KIND a line
      // is; until `p082-b3-k1` no content extractor asked it whether the text it
      // was matching is text a reader ever sees. So a fingerprint marker inside
      // `<!-- … -->` counted as present and a stale file reported `current` —
      // silent pass, from one edit a person actually makes.
      //
      // ⚠ BOTH DIRECTIONS ARE PINNED, and the second is the one that matters:
      // "blank every html line" is the obvious over-reach, and it would delete
      // real convention prose out of a `<pre>` or a `<div>` — content loss. Type
      // 1 is the sharp case because `pre`/`textarea` and `script`/`style` share
      // one start condition and differ in whether their text renders.
      //
      // ⚠ Not an invisible-character pin: no widening of a whitespace class can
      // express "this type does not render", which is why `visibleTextLines` and
      // `HTML_TYPE1_INVISIBLE_TAGS` sit in NO_INVISIBLE_PIN with this block named
      // as what covers them. Each assertion below was verified to FAIL against
      // the module as it stood one commit earlier.
      {
        const RULE = 'cascade result is a floor';
        const visible = (lines) => doctorChecks.visibleTextLines(lines.join('\n')).join('\n');

        for (const [label, lines] of [
          ['a single-line comment', [`<!-- ${RULE} -->`]],
          ['a multi-line comment', ['<!--', RULE, '-->']],
          ['an unclosed comment', ['<!--', RULE]],
          ['a script block', ['<script>', RULE, '</script>']],
          ['a style block', ['<style>', RULE, '</style>']],
          ['a processing instruction', ['<?php', RULE, '?>']],
          ['a CDATA section', ['<![CDATA[', RULE, ']]>']],
          ['a declaration', [`<!DOCTYPE ${RULE}>`]]
        ]) {
          assert.ok(!visible(lines).includes(RULE), `${label} hides its text from a reader`);
        }

        for (const [label, lines] of [
          ['a div block', ['<div>', RULE, '</div>']],
          ['a pre block', ['<pre>', RULE, '</pre>']],
          ['a textarea block', ['<textarea>', RULE, '</textarea>']],
          ['ordinary prose', [RULE]],
          ['a table row', [`| ${RULE} |`]]
        ]) {
          assert.ok(visible(lines).includes(RULE), `${label} shows its text to a reader — blanking it would be content loss`);
        }

        // Blanked, never deleted: three consumers index by line.
        assert.equal(doctorChecks.visibleTextLines('a\n<!-- x -->\nb').length, 3, 'a blanked line is still a line');

        // And the three consumers the defect was reachable through, end to end.
        const doc = (body) => ['## Ceremony Scaling (Project Application)', '', body, '', '## Upstream Reference', ''].join('\n');
        const ceremony = (content) => doctorChecks.findConventionsDrift(content)
          .filter((d) => d.id === 'ceremony-escalate-only').map((d) => d.state);
        assert.deepEqual(ceremony(doc(`The ${RULE}: rows may only escalate.`)), [], 'a live rule is current');
        assert.deepEqual(ceremony(doc(`<!-- The ${RULE}: rows may only escalate. -->`)), ['stale'], 'a commented-out rule is ABSENT, not present');
        assert.equal(
          doctorChecks.parseContextLine('<!-- AI commit marker: `prefix` -->', doctorChecks.AI_COMMIT_MARKER_LINE_RE),
          null, 'a commented-out policy line is not the live setting'
        );
        assert.equal(
          doctorChecks.parseContextLine('AI commit marker: `prefix`', doctorChecks.AI_COMMIT_MARKER_LINE_RE),
          'prefix', 'the live policy line still parses'
        );
        assert.deepEqual(
          doctorChecks.extractSectionRefs('<!-- AI-AGENT-GUIDE.md § Nowhere -->', 'AI-AGENT-GUIDE.md'),
          [], 'a reference inside a comment is not a dangling reference'
        );
        // Routing parseContextLine through the projection would have converted a
        // caller's `undefined` into the text "undefined" and returned null —
        // "policy line absent", a finding about the user's file caused by a bug
        // in ours. It must still throw.
        assert.throws(() => doctorChecks.parseContextLine(undefined, doctorChecks.GIT_POLICY_LINE_RE), TypeError,
          'a non-string stays loud rather than becoming a silent "absent"');

        // ⚠ THE SPAN, NOT THE LINE. An end condition can leave rendered text
        // after it: `<!-- note --> rest` puts `rest` in the output. The first
        // version of the visibility rule blanked whole lines and so lost that
        // text — a retired string after a `-->` stopped being reported one
        // commit later (`p082-b3-k3` finding 2). SILENT PASS.
        assert.equal(
          doctorChecks.visibleTextLines('<!-- note --> tail text')[0].trimStart(), 'tail text',
          'text after a comment close is rendered, so it stays visible'
        );
        assert.equal(
          doctorChecks.visibleTextLines('<!-- note --> tail text')[0].length, '<!-- note --> tail text'.length,
          'the hidden span is masked to spaces, not deleted — extractSectionRefs compares column indices'
        );
        assert.equal(
          doctorChecks.visibleTextLines('<script>\nx\n</script> after')[2].trimStart(), 'after',
          'the same rule on a type-1 close'
        );
        assert.deepEqual(ceremony(doc(`x\n<!-- n --> The ${RULE}: rows may only escalate.`)), [],
          'a rule after a comment close is present, not absent');

        // ⚠ THE WRITE PATH. `configure-agents` finds its managed region by
        // string search and then SLICES the original by that index, so a marker
        // shown inside a fenced example was taken as a region boundary and the
        // user's example was overwritten (`p082-b3-k3` finding 1). USER CONTENT
        // LOSS. The mask must hide it while preserving every offset.
        {
          const S = '<!-- dflow-generated: agent-shim START -->';
          const fenced = ['# Guide', '', '```md', S, 'example KEEPME', '<!-- dflow-generated: agent-shim END -->', '```'].join('\n');
          const real = ['# Guide', '', S, 'generated', '<!-- dflow-generated: agent-shim END -->'].join('\n');
          const maskedFenced = doctorChecks.maskCodeBlocks(fenced);
          assert.ok(!maskedFenced.includes(S), 'a marker inside a fence is not a region boundary');
          assert.equal(maskedFenced.length, fenced.length, 'the mask preserves length, or every sliced index moves');
          const maskedReal = doctorChecks.maskCodeBlocks(real);
          assert.ok(maskedReal.includes(S), 'a real marker is still found');
          assert.equal(maskedReal.indexOf(S), real.indexOf(S), 'and still at the same index');
        }
        assert.equal(
          doctorChecks.extractSectionRefs('AI-AGENT-GUIDE.md § Nowhere', 'AI-AGENT-GUIDE.md').length,
          1, 'a live reference still resolves'
        );
      }

      // (k) ATX and setext heading text obey the SAME trimming rule. They did
      // not: ATX stripped `[ \t]` while setext called `.trim()`, so
      // `isRecognizableDflowGuide` rejected `# Title<NBSP>` and accepted
      // `Title<NBSP>` / `---` — the same title, two answers.
      // ⚠ Over the WHOLE character class, in BOTH positions. This pinned U+00A0
      // trailing only, while `lib/doctor-checks.js` claimed the divergence was
      // pinned "against every character the class covers" — naming one member of
      // a class and calling it the class, which is the same over-claim the
      // sentence it replaced was corrected for.
      {
        for (const [label, code] of [
          ['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b],
          ['en space', 0x2002], ['BOM', 0xfeff]
        ]) {
          const ch = String.fromCharCode(code);
          assert.equal(
            doctorChecks.parseAtxHeading(`## Project Context${ch}`).text,
            doctorChecks.classifyLines([`Project Context${ch}`, '---'])[1].heading.text,
            `the two heading kinds must trim a trailing ${label} identically`
          );
          assert.equal(
            doctorChecks.parseAtxHeading(`## ${ch}Project Context`).text,
            doctorChecks.classifyLines([`${ch}Project Context`, '---'])[1].heading.text,
            `the two heading kinds must trim a leading ${label} identically`
          );
        }
      }

      // (k2) ⚠⚠ THE HEADING-IDENTITY COMPARATOR IS DELIBERATELY TOLERANT, and
      // this pins that it stays so. `normalizeHeading` was once "fixed" to use
      // `stripSpaceTab` on the reasoning that one rule should have one spelling.
      // It is not one rule: `stripSpaceTab` decides what a heading's text IS
      // (block structure, strict, spec-following), while `normalizeHeading`
      // decides whether two heading strings NAME the same section — an identity
      // comparison over text a human retyped or pasted, which already strips
      // ``, `*` and `_` and folds case.
      //
      // What tightening it did, measured: a `_conventions.md` whose heading
      // carried a copy-pasted trailing U+00A0 reported `missing` — doctor
      // warning about a file that carries the rule. `CONVENTIONS_FINGERPRINTS`
      // records the same false `missing` happening once before for case, which
      // is why the comparison folds case; this is the whitespace repeat of it.
      //
      // ⚠ These pins are the reason the tolerance survives the next round. The
      // source-level class guard cannot express "this `.trim()` is correct" —
      // it is a lint over substrings — so without them the only thing standing
      // between a maintainer and re-breaking this is a comment.
      {
        const SECTION = 'Ceremony Scaling (Project Application)';
        for (const [label, code] of [
          ['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b],
          ['en space', 0x2002], ['BOM', 0xfeff]
        ]) {
          const ch = String.fromCharCode(code);
          for (const [position, heading] of [['trailing', `## ${SECTION}${ch}`], ['leading', `## ${ch}${SECTION}`]]) {
            const doc = [heading, '', 'the cascade result is a floor here', '', '## Next', ''].join('\n');
            assert.deepEqual(
              doctorChecks.findConventionsDrift(doc).filter((d) => d.id === 'ceremony-escalate-only'),
              [],
              `a heading carrying a ${position} ${label} still names its section — reporting it missing warns about a file that carries the rule`
            );
          }
        }
        // And the case rule the module states, at all three consumers of the one
        // normaliser rather than at whichever one a round happened to look at.
        const tpl = '## Filling the Templates\n\nbody\n';
        assert.deepEqual(doctorChecks.missingTemplateSections(tpl, '## filling the templates\n\nbody\n'), [],
          'a retyped-in-different-case heading is the same section to missingTemplateSections');
        assert.equal(doctorChecks.headingResolves('filling the templates', ['Filling the Templates']), true,
          '...and to headingResolves');
        assert.equal(doctorChecks.conventionsSectionBodies('## filling the templates\n\nbody\n', 'Filling the Templates').length, 1,
          '...and to conventionsSectionBodies, which is where the rule was already implemented');

        // ⚠ The case fold must be PREFIX-PRESERVING, because `headingResolves`
        // prefix-matches on it. `toLowerCase` is not: Greek capital sigma maps
        // to a final sigma at a word end and a medial one elsewhere, so `ΑΣ`
        // stopped resolving against `ΑΣΒΓ` and doctor reported a dangling
        // reference for one that resolves. The raw strings prefix-match, so
        // this is purely an artefact of the fold.
        const SIGMA = String.fromCharCode(0x391, 0x3a3);           // ΑΣ
        const SIGMA_LONG = String.fromCharCode(0x391, 0x3a3, 0x392, 0x393); // ΑΣΒΓ
        assert.equal(doctorChecks.headingResolves(SIGMA, [SIGMA_LONG]), true,
          'the case fold must preserve prefixes — a Greek capital sigma reference must still resolve');
        assert.equal(doctorChecks.headingResolves('workflow', ['Workflow Transparency']), true,
          '...while still doing the case-insensitive matching it was changed for');

        // ⚠ Counted, not a Set: a template with two H2s folding to one key is
        // not satisfied by one of them appearing. Latent on the packaged
        // template, which is why nothing else would catch it.
        const dupTpl = '## Filling the Templates\n\nb\n\n## FILLING THE TEMPLATES\n\nb\n';
        assert.deepEqual(
          doctorChecks.missingTemplateSections(dupTpl, '## Filling the Templates\n\nb\n'),
          ['FILLING THE TEMPLATES'],
          'one document heading cannot satisfy two template headings that fold to the same key'
        );

        // ⚠⚠ AN HTML BLOCK OPEN AT EOF MUST NOT LET A SECTION SWALLOW THE REST
        // OF THE FILE. This was a HIGH silent pass reachable with no module edit
        // at all: one `<!--` left unclosed mid-edit put every later section
        // inside that block, so `## Ceremony Scaling` reached a quoted copy of
        // the rule in an appendix and a genuinely stale file reported `current`.
        // Measured through the real doctor: closing the comment gave two
        // warnings, leaving it open gave none.
        //
        // All five block types that close only on their end condition, because
        // the first fix attempt would have covered `<!--` alone and this module
        // has been burned four times by fixing the instance a reviewer named
        // instead of the class.
        for (const opener of ['<!-- TODO', '<script>', '<![CDATA[', '<!x', '<?x']) {
          const doc = [
            '## Ceremony Scaling (Project Application)', '',
            opener, '',
            '## Upstream Reference', '',
            '**The cascade result is a floor: rows may only escalate a tier, never lower it.**', ''
          ].join('\n');
          const hit = doctorChecks.findConventionsDrift(doc).find((x) => x.id === 'ceremony-escalate-only');
          assert.equal(
            hit && hit.state, 'stale',
            `an unclosed ${opener} must not let the section reach text below it — the rule is genuinely absent from that section, so this file is stale`
          );
          assert.equal(
            doctorChecks.unclosedHtmlBlockLine(doc), 3,
            `and the user must be told where the unclosed ${opener} starts, or the resulting "stale" is correct and inexplicable`
          );
        }
        // The control: the same document with the block closed is unaffected.
        const closed = [
          '## Ceremony Scaling (Project Application)', '',
          '<!-- TODO -->', '',
          '**The cascade result is a floor: rows may only escalate a tier, never lower it.**', ''
        ].join('\n');
        // ⚠⚠ `indentWidth`'s TAB ARITHMETIC, which no check covered. CommonMark
        // 2.2: a tab advances to the next multiple of four, so `col += 4 - (col
        // % 4)`. A reviewer changed it to `col += 4` — a plausible-looking
        // simplification — and every suite stayed green while the module started
        // reading a 3-space-then-tab continuation as column 7 instead of 4.
        // Consequence: the list keeps consuming, so a section runs on. Silent
        // pass. The invisible-character machinery cannot reach this: there is no
        // character class here to widen, which is exactly why it needed a pin of
        // its own rather than an excuse.
        assert.deepEqual(
          doctorChecks.classifyLines(['-    x', '', '   \tcont']).map((c) => c.type),
          ['list', 'blank', 'code'],
          'a tab advances to the next multiple of four (CommonMark 2.2): 3 spaces then a tab is column 4, which is below this item\'s content column, so the continuation is indented code and not more list'
        );
        assert.deepEqual(
          doctorChecks.classifyLines(['- x', '', ' \tcont']).map((c) => c.type),
          ['list', 'blank', 'list'],
          '...while one space then a tab is also column 4, which IS at this item\'s content column, so it continues the item'
        );

        // ⚠⚠ TYPE 6 IS NOT "UNCLOSED" AT EOF, and the first version of the
        // marking got this wrong in a way nothing pinned. Type 6 has no end
        // condition — it closes on a blank line — so `open.endRe` is null for it.
        // Marking every open `html` block therefore flagged a document ending in
        // `</div>`, but ONLY when the file had no trailing newline, because a
        // trailing newline supplies the blank that closes it. Two files one byte
        // apart, and the shorter one got a spurious warning plus a false `stale`
        // on a section that plainly carries the rule. Content loss, on ordinary
        // hand-written HTML.
        const type6 = '## Ceremony Scaling (Project Application)\n\n<div class="note">\n**The cascade result is a floor: rows may only escalate a tier, never lower it.**\n</div>';
        for (const [label, doc] of [['no trailing newline', type6], ['trailing newline', `${type6}\n`]]) {
          assert.equal(
            doctorChecks.unclosedHtmlBlockLine(doc), -1,
            `a type-6 block closes on a blank line, so it is never "unclosed" at EOF (${label}) — only types 1-5 have an end condition`
          );
          assert.equal(
            doctorChecks.findConventionsDrift(doc).some((x) => x.id === 'ceremony-escalate-only'), false,
            `...and the rule inside it is visible content, so the section is not stale (${label})`
          );
        }

        assert.equal(doctorChecks.unclosedHtmlBlockLine(closed), -1, 'a closed comment is not reported');
        assert.equal(
          doctorChecks.findConventionsDrift(closed).some((x) => x.id === 'ceremony-escalate-only'), false,
          '...and a section that really does carry the rule still reports nothing'
        );
      }

      // (g) PRESERVATION PINS — these pass on the old code as well, and are here
      // because the rewrite replaced `isTableLine`'s backward scan with a
      // forward one that requires a header row. Two behaviours had to survive
      // that: a `---` after a table row is a thematic break, and ordinary prose
      // containing a pipe stays a paragraph (the `line.includes('|')` version of
      // that test ran sections on into the next one — silent success).
      assert.ok(
        keepsSentinel(['| a | b |', '|---|---|', '| c | d |']),
        'a --- after a table row does not close the section'
      );
      assert.ok(
        !keepsSentinel(['The Command | Query split.']),
        'prose containing a pipe is still a paragraph, so --- closes the section'
      );
    }

    // The ATX OPENING sequence, pinned across all three predicates that judge
    // it. CommonMark accepts only a space or tab after the hashes; JS `\s` also
    // matches U+00A0, form feed and vertical tab. While one predicate said `\s`
    // and another said `[ \t]`, such a line was neither a paragraph nor a
    // heading, so a following `---` could not close the section and it ran on —
    // silent pass (`p082-b3-g3`). U+00A0 is the realistic input: copy-paste.
    // ⚠ Separators are built with `String.fromCharCode`, so this source file
    // contains no invisible characters at all: a raw NBSP is indistinguishable
    // from a space in a diff and an editor may normalize it away. The
    // differential harness carries the same shapes and was itself corrupted
    // once by generating them through `sed`, which silently wrote the literal
    // text `00a0` and made the row compare clean against the wrong shape.
    const SENTINEL_ATX = 'SENTINEL-MARKER-LINE';
    for (const [label, code, isHeading] of [
      ['space', 0x20, true],
      ['tab', 0x09, true],
      ['NBSP', 0xa0, false],
      ['form feed', 0x0c, false],
      ['vertical tab', 0x0b, false]
    ]) {
      const line = `####${String.fromCharCode(code)}Heading`;
      const doc = ['## Target Section', '', line, '---', '', SENTINEL_ATX, '', '## Next Section', ''].join('\n');
      const bodies = doctorChecks.conventionsSectionBodies(doc, 'Target Section');
      assert.equal(bodies.length, 1, `ATX opener ${label}: expected one Target Section body`);
      // A real ATX heading is not a paragraph, so the `---` is a thematic break
      // and the section continues. A fake one IS a paragraph, so the `---` is a
      // setext heading and the section ends before the sentinel.
      assert.equal(
        bodies[0].includes(SENTINEL_ATX),
        isHeading,
        `ATX opener ${label}: ${isHeading ? 'is a heading, so the section continues past ---' : 'is NOT a heading, so --- closes the section'}`
      );
    }

    // The same whitespace rule at the other three constructs the class guard
    // covers at source level. These pin what a USER sees, which is the part
    // that matters; the source guard only stops the spelling coming back.
    // All built with `String.fromCharCode` — no invisible characters in this
    // file. (`p082-b3-g4` findings 1, 2 and 5.)
    {
      const NBSP = String.fromCharCode(0xa0);
      const SENT = 'SENTINEL-MARKER-LINE';
      const sectionEnds = (lines) => {
        const doc = ['## Target Section', '', ...lines, '', SENT, '', '## Next Section', ''].join('\n');
        const bodies = doctorChecks.conventionsSectionBodies(doc, 'Target Section');
        assert.equal(bodies.length, 1, `expected one body for ${JSON.stringify(lines)}`);
        return !bodies[0].includes(SENT);
      };

      // A list marker followed by NBSP is not a list item, so the line is a
      // paragraph and the `---` under it IS a setext heading. Reading it as a
      // list kept the section running past its end — silent pass.
      assert.equal(sectionEnds([`-${NBSP}local note`, '---']), true, 'a bullet marker followed by NBSP is prose, so --- closes the section');
      assert.equal(sectionEnds([`1.${NBSP}local note`, '---']), true, 'an ordered marker followed by NBSP is prose, so --- closes the section');
      assert.equal(sectionEnds(['- a real bullet', '---']), false, '...while a real bullet is not prose, so --- is a thematic break');

      // A setext underline may be followed only by spaces or tabs. Accepting
      // NBSP there closed the section early and the walker popped the line
      // carrying the marker — content loss, the opposite direction.
      assert.equal(sectionEnds(['local stale prose', `---${NBSP}`]), false, 'NBSP after an underline means it is not an underline, so the section continues');
      assert.equal(sectionEnds(['local stale prose', '---  ']), true, '...while trailing spaces are allowed, so this one does close it');

      // ⚠⚠ THE THEMATIC BREAK AT A BLOCK START — the hole three separate guard
      // defeats walked through, and the reason all three landed here. Every
      // other construct the source guard names had a behavioural pin at a block
      // start; `isThematicBreak` had one only in the setext-underline position
      // (the two assertions directly above), so a `\s`-tolerant thematic break
      // was invisible to the suite while being visible to a user.
      //
      // `---<NBSP>` at a block start is NOT a thematic break: NBSP is not
      // whitespace to CommonMark, so the line is a paragraph, and the plain
      // `---` beneath it is a setext H2 that ends the section.
      // `commonmark@0.31.2` returns `heading:2` for all three characters and
      // `[thematic_break, thematic_break]` for the control.
      //
      // ⚠ This pin is worth more than another banned substring, and that is the
      // point of it: the bans are a lint over literal spellings, and the space of
      // spellings is unbounded — `String.fromCharCode`, string concatenation,
      // `new RegExp` from parts, a code-point `Set`. Three demonstrated defeats
      // used three different spellings and this one assertion fails for all of
      // them, because it asks what the module DOES rather than how it is
      // written. Do not "simplify" it into the guard block above.
      for (const [label, code] of [['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b]]) {
        const ch = String.fromCharCode(code);
        assert.equal(
          sectionEnds([`---${ch}`, '---']),
          true,
          `a --- line carrying a trailing ${label} is not a thematic break, so the --- under it is a setext H2 and the section ends`
        );
      }
      assert.equal(sectionEnds(['---', '---']), false, '...while two real thematic breaks open no heading, so the section runs on');

      // A backtick fence whose info string contains a backtick does not open a
      // fence, so the heading under it is a real heading and closes the
      // section. Blanking it let a stale section run on.
      const BT = String.fromCharCode(0x60);
      assert.equal(
        sectionEnds([`${BT.repeat(3)}bad${BT}info`, '## Local Notes', BT.repeat(3)]),
        true,
        'a backtick fence with a backtick in its info string does not open a fence, so the heading inside is real'
      );
      assert.equal(
        sectionEnds([`${BT.repeat(3)}js`, '## Not A Heading', BT.repeat(3)]),
        false,
        '...while a valid fence does blank the heading inside it'
      );
    }

    // ⚠⚠ `assertOpenerIndentPartition` — the property that makes branch (7)'s
    // `indentWidth(line) >= 4` safe against every branch above it, pinned rather
    // than left to be re-derived. Branch (7) is cited at its site as depending on
    // this.
    //
    // The property: every raw-prefix opener in `lib/doctor-checks.js` is
    // `^ {0,3}` followed by a character that is neither a space nor a tab. So a
    // line matching any opener has `indentWidth <= 3`, while `indentWidth >= 4`
    // needs four spaces or a tab inside the first four columns — which no
    // `^ {0,3}X` can match. Branches (4) and (7) therefore partition cleanly.
    //
    // ⚠ It is a property of the OTHER expressions, so it breaks from a distance
    // and it breaks silently: widen any opener to `^[ \t]{0,3}` — which reads
    // like a tolerance improvement, not like a boundary change — and branch (7)
    // starts eating lines that opener was meant to claim. Nothing else in this
    // suite would fail. That is the exact shape of defect this batch has spent
    // three rounds on: the fix was right, the reason was not written next to it,
    // and the round after could not tell a safe edit from an unsafe one.
    // ⚠⚠ THE COVERAGE IS DERIVED FROM THE MODULE, NOT TYPED OUT — and the first
    // version of this sweep is why. It carried 13 hand-picked bodies, claimed in
    // its own comment to sweep "every opener", and silently covered five families
    // out of eight. A reviewer widened `FENCE_OPEN_RE`, `SETEXT_UNDERLINE_RE` and
    // HTML types 3/4/5 to `^[ \t]{0,3}` — the exact edit the comment named as the
    // thing it caught — and the suite stayed green for all three, with a real
    // silent pass or content loss behind each. **The pin added to stop "a pin
    // that cannot fail against the defect it names" was that pin.**
    //
    // A hand-written list cannot fix that, because the failure is not a missing
    // entry — it is that nothing relates the list to the module. So the census
    // below reads the module's own `^ {0,3}` sites, attributes each to the
    // declaration that owns it, and fails when an owner has no probe here or
    // when an owner's site COUNT changes. Add a sixth HTML block type, or a new
    // opener, and this test fails until someone says how to exercise it.
    //
    // ⚠ Two families are NOT reachable through `classifyLines` at all, which is
    // the specific reason they were missing: the fence regexes are read only by
    // `blankFencedBlocks`, and `SETEXT_UNDERLINE_RE` needs an open paragraph. So
    // a probe declares its own document and its own verdict vocabulary rather
    // than assuming one shape fits every opener.
    //
    // ⚠ And the deep verdict is NOT always `code`. Where an opener is only
    // reachable with a paragraph open, branch (7) cannot fire — an indented line
    // there is a lazy continuation. `deep: 'paragraph'` is that case, measured,
    // not a weaker assertion.
    {
      const TAB = String.fromCharCode(0x09);
      const BT = String.fromCharCode(0x60).repeat(3);
      const type = (lines, i) => doctorChecks.classifyLines(lines)[i].type;
      const blanked = (lines, i) => doctorChecks.blankFencedBlocks(lines.join('\n'))[i].trim() === '';

      // `sites` = how many `^ {0,3}` occurrences this declaration owns in
      // `lib/doctor-checks.js`. `bodies` must have one entry per site, so a new
      // site forces a new probe rather than hiding behind an existing one.
      const OPENER_PROBES = {
        ATX_HEADING_RE: {
          sites: 1, bodies: ['# H'],
          run: (p, b) => type([p + b], 0), shallow: 'heading', deep: 'code'
        },
        isThematicBreak: {
          sites: 3, bodies: ['---', '***', '___'],
          run: (p, b) => type([p + b], 0), shallow: 'thematic-break', deep: 'code'
        },
        FENCE_OPEN_RE: {
          sites: 1, bodies: [BT],
          run: (p, b) => (blanked(['## A', p + b, '## Hidden', BT], 2) ? 'fence' : 'not-fence'),
          shallow: 'fence', deep: 'not-fence'
        },
        FENCE_CLOSE_RE: {
          // Inverted on purpose: an indented CLOSER fails to close, so the line
          // AFTER the block stays blanked. Probing it with the opener's document
          // would have reported green whatever the closer did.
          sites: 1, bodies: [BT],
          run: (p, b) => (blanked(['## A', BT, '## Hidden', p + b, '## After'], 4) ? 'not-fence' : 'fence'),
          shallow: 'fence', deep: 'not-fence'
        },
        TABLE_DELIMITER_ROW_RE: {
          sites: 1, bodies: ['|---|---|'],
          run: (p, b) => type(['Intro.', '| a | b |', p + b], 2), shallow: 'table', deep: 'paragraph'
        },
        HTML_BLOCK_TYPES: {
          sites: 5, bodies: ['<script>', '<!-- c -->', '<?x', '<!DOCTYPE', '<![CDATA['],
          run: (p, b) => type([p + b], 0), shallow: 'html', deep: 'code'
        },
        HTML_BLOCK_TYPE6_RE: {
          sites: 1, bodies: ['<div>'],
          run: (p, b) => type([p + b], 0), shallow: 'html', deep: 'code'
        },
        LIST_ITEM_RE: {
          sites: 1, bodies: ['- x'],
          run: (p, b) => type([p + b], 0), shallow: 'list', deep: 'code'
        },
        EMPTY_LIST_ITEM_RE: {
          sites: 1, bodies: ['-'],
          run: (p, b) => type([p + b], 0), shallow: 'list', deep: 'code'
        },
        INTERRUPTING_ITEM_RE: {
          sites: 1, bodies: ['- x'],
          run: (p, b) => type(['prose', p + b], 1), shallow: 'list', deep: 'paragraph'
        },
        BLOCKQUOTE_RE: {
          sites: 1, bodies: ['> q'],
          run: (p, b) => type([p + b], 0), shallow: 'blockquote', deep: 'code'
        },
        // ⚠ An EMPTY item, and an UNINDENTED follower — not `- x` with an
        // indented continuation, which was the first attempt and did not
        // discriminate. This constant measures the item's content column, and
        // the defect it carries is `listContentColumn` returning `null`: widen
        // its gap from `[ \t]*` to `[ \t]+` and a bare `-` stops matching, the
        // column becomes null, `indentWidth(line) >= null` is true for every
        // line, and the item swallows the rest of the document. Only a bare
        // marker reaches that; `- x` still matches a `+` gap and moves nothing.
        // Found by diffing the shipped module against the broken one rather
        // than by reasoning about the probe.
        LIST_ITEM_PREFIX_RE: {
          sites: 1, bodies: ['-'],
          run: (p, b) => type([p + b, '', `${p}unindented`], 2), shallow: 'paragraph', deep: 'code'
        },
        SETEXT_UNDERLINE_RE: {
          sites: 1, bodies: ['---'],
          run: (p, b) => type(['prose', p + b], 1), shallow: 'heading', deep: 'paragraph'
        }
      };

      // --- the census: attribute every `^ {0,3}` site to its owner ------------
      // Comments are stripped first, for the reason the guard above states: this
      // block's own prose contains `^ {0,3}` and would otherwise be counted.
      const moduleSource = await readFile(join(repoRoot, 'lib/doctor-checks.js'), 'utf8');
      const code = moduleSource
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .map((l) => l.replace(/\/\/ .*$/, ''));
      const owners = new Map();
      let owner = null;
      for (const line of code) {
        const decl = line.match(/^(?:const|let|var) ([A-Za-z_0-9]+)\s*=/) || line.match(/^function ([A-Za-z_0-9]+)\(/);
        if (decl) owner = decl[1];
        // ⚠⚠ THE INDENT MAY BE WRAPPED IN A GROUP. This matched the bare literal
        // `^ {0,3}` only, so `LIST_ITEM_PREFIX_RE` — which spells it
        // `^( {0,3})`, to capture the indent — was INVISIBLE to the census: no
        // probe demanded, all three completeness assertions silent, and the
        // one-character defect that makes a bare `-` swallow the document still
        // shipped with a green suite.
        // ⚠ The previous commit claimed to have closed this by adding an
        // `indent-group` widening. That is the MUTATION list, a different
        // mechanism entirely — it never feeds the census. A fix applied to the
        // wrong mechanism reads exactly like a fix.
        // Still invisible by construction, and deliberately so rather than
        // silently: `^[ ]{0,3}`, `^ {0, 3}`, `^\x20{0,3}`, or an indent split
        // across source lines. A named constant is safe — the census attributes
        // the site to it and demands a probe.
        const hits = (line.match(/\^(?:\((?:\?:)?)? \{0,3\}/g) || []).length;
        if (hits) owners.set(owner, (owners.get(owner) || 0) + hits);
      }

      const unprobed = [...owners.keys()].filter((n) => !OPENER_PROBES[n]);
      assert.deepEqual(
        unprobed, [],
        `lib/doctor-checks.js has a ^ {0,3} opener with no probe in OPENER_PROBES: ${unprobed.join(', ')}. Add one saying how to exercise it and what it must classify as at 0-3 columns and at 4+. Do not skip this — a sweep that does not reach an opener is the decoration this block replaced.`
      );
      const stale = [...owners.entries()]
        .filter(([n, n_]) => OPENER_PROBES[n].sites !== n_)
        .map(([n, n_]) => `${n}: module has ${n_}, OPENER_PROBES says ${OPENER_PROBES[n].sites}`);
      assert.deepEqual(stale, [], `the ^ {0,3} site count moved: ${stale.join('; ')}`);
      const missing = Object.keys(OPENER_PROBES).filter((n) => !owners.has(n));
      assert.deepEqual(missing, [], `OPENER_PROBES names an opener the module no longer has: ${missing.join(', ')}`);

      // --- the sweep itself ---------------------------------------------------
      const shallow = ['', ' ', '  ', '   '];
      const deep = ['    ', '     ', TAB, ` ${TAB}`, `  ${TAB}`, `   ${TAB}`];
      let checked = 0;
      for (const [name, probe] of Object.entries(OPENER_PROBES)) {
        assert.equal(probe.bodies.length, probe.sites, `${name}: one probe body per ^ {0,3} site`);
        for (const body of probe.bodies) {
          for (const prefix of shallow) {
            assert.equal(
              probe.run(prefix, body), probe.shallow,
              `${name} indented ${prefix.length} columns must still be ${probe.shallow}: ${JSON.stringify(prefix + body)} — if this fails, its ^ {0,3} prefix was widened to admit a space or tab and branch (7) is now stealing its lines`
            );
            checked += 1;
          }
          for (const prefix of deep) {
            assert.equal(
              probe.run(prefix, body), probe.deep,
              `${name} at column 4 or beyond must be ${probe.deep}: ${JSON.stringify(prefix + body)}`
            );
            checked += 1;
          }
        }
      }
      const sites = Object.values(OPENER_PROBES).reduce((n, p) => n + p.bodies.length, 0);
      assert.equal(checked, sites * (shallow.length + deep.length), 'every opener site x every indent form');
    }

    // ⚠⚠ EVERY GUARDED CONSTRUCT MUST HAVE A BLOCK-START INVISIBLE-CHARACTER
    // PIN, OR AN EXPLICIT REASON WHY NOT. This is the second half of the same
    // lesson as the census above, and it comes from a measurement rather than a
    // hunch: five demonstrated guard defeats in a row all landed on the ONE
    // construct that had no such pin, and when that one was pinned the next
    // defeat simply moved to the next unpinned construct. The source-level bans
    // are a lint over literal spellings — `\s`, `[^\S`, `.trim(`, seven named
    // escapes — and the sixth reviewer defeated them with an eighth spelling
    // (`\xa0`) in about a minute. A ninth exists; so does a tenth.
    //
    // Behavioural pins do not have that shape. `---<NBSP>` is `---<NBSP>`
    // however the module chose to spell its whitespace test, so one pin closes
    // every spelling at once. What was missing was not a better pin — it was
    // any relationship between the set of guarded constructs and the set of
    // pinned ones. That relationship is the assertion at the bottom of this
    // block: add a name to `guardedConstructs` and this test fails until you
    // either pin it or write down why it cannot be pinned.
    //
    // ⚠ Every construct below currently PASSES. That is the point — these are
    // regression pins for behaviour that is correct today and was protected by
    // nothing, which is exactly how the previous five defeats were possible.
    {
      const N = String.fromCharCode(0xa0);
      const BT = String.fromCharCode(0x60).repeat(3);
      const type = (lines, i) => doctorChecks.classifyLines(lines)[i].type;

      // Each pin: feed the construct's trigger with an invisible character in
      // the position that would matter, and assert the construct does NOT fire.
      // NBSP, form feed and vertical tab are not whitespace to CommonMark.
      // ⚠⚠ EVERY PIN TAKES THE MODULE AS ITS FIRST ARGUMENT, and that is not a
      // style choice — it is what makes the pins testable. A pin closed over the
      // imported module can only ever be run against the correct module, so
      // nothing can ask the question that matters: *would this pin fail if the
      // construct it names were broken?* The mutation-adequacy block below runs
      // every one of them against a deliberately broken copy, and it exists
      // because a review round found that three of these pins could not fail
      // against their own construct and one of them was a tautology.
      //
      // ⚠ `t(dc, ...)` rather than the outer `type(...)`: the outer helper is
      // bound to the shipped module, and using it here would silently test the
      // shipped module while appearing to test the mutant. That is the same
      // "tests a copy, not the code" trap this project has paid for before.
      const t = (dc, lines, i) => dc.classifyLines(lines)[i].type;
      const INVISIBLE_PINS = {
        ATX_HEADING_RE: (dc, c) => t(dc, [`#${c}H`], 0) !== 'heading' && t(dc, [`${c}# H`], 0) !== 'heading',
        // ⚠ ALL THREE MARKER ALTERNATIVES. This function is three separate
        // regexes, and pinning `-` alone certified it while the `*` and `_`
        // alternatives were free — caught by widening one class at a time.
        isThematicBreak: (dc, c) => ['---', '***', '___'].every((m) => t(dc, [`${m}${c}`], 0) !== 'thematic-break' && t(dc, [`${c}${m}`], 0) !== 'thematic-break'),
        // ⚠ Asks `blankFencedBlocks`, NOT `classifyLines`. The first version of
        // this pin was `classifyLines(...)[0] !== 'fence'` — and `'fence'` is not
        // in that function's vocabulary at all, so the assertion was true for
        // every input and every module state. A tautology, in the block whose
        // subject is checks that cannot fail. It survived because a sibling pin
        // happened to catch the same break.
        FENCE_OPEN_RE: (dc, c) => dc.blankFencedBlocks(['## A', `${c}${BT}`, '## Visible', BT].join('\n'))[2].trim() !== '',
        // ⚠ BOTH of this construct's whitespace classes: the trailing `[ \t]*$`
        // after the marker AND its own `^ {0,3}` indent. Pinning the trailing
        // one alone left the indent free — the mutation-adequacy check below is
        // what said so, which is the whole reason it exists.
        FENCE_CLOSE_RE: (dc, c) => dc.blankFencedBlocks(['## A', BT, '## Hidden', `${BT}${c}`, '## After'].join('\n'))[4].trim() === ''
          && dc.blankFencedBlocks(['## A', BT, '## Hidden', `${c}${BT}`, '## After'].join('\n'))[4].trim() === '',
        // ⚠ EVERY PADDING POSITION, not just the trailing one. This regex has
        // seven `[ 	]*` classes — leading pad, each cell's lead and trail, and
        // the final one — and a pin on the last certified all seven. Widening
        // any single inner pad made `|<NBSP>---|---|` a delimiter row, which
        // opens a table, which stops the `---` below from ending the section:
        // silent pass, suite green.
        TABLE_DELIMITER_ROW_RE: (dc, c) => [
          `|---|---|${c}`, `${c}|---|---|`, `|${c}---|---|`,
          `|---${c}|---|`, `|---|${c}---|`, `|---|---${c}|`
        ].every((row) => t(dc, ['Intro.', '| a | b |', row], 2) !== 'table'),
        // ⚠ The character goes in the TAIL, `([ \t>]|$)`, which is this
        // construct's own whitespace class. Putting it before `<script>` tested
        // the `^ {0,3}` indent instead — a live hole: widening the tail left the
        // suite green while `<script<NBSP>x` opened a type-1 block that closes
        // only at `</script>`, swallowing the rest of the file.
        HTML_BLOCK_TYPES: (dc, c) => t(dc, [`<script${c}x`], 0) !== 'html' && t(dc, [`${c}<script>`], 0) !== 'html',
        HTML_BLOCK_TYPE6_RE: (dc, c) => t(dc, [`<div${c}>`], 0) !== 'html' && t(dc, [`${c}<div>`], 0) !== 'html',
        LIST_ITEM_RE: (dc, c) => t(dc, [`-${c}x`], 0) !== 'list' && t(dc, [`${c}- x`], 0) !== 'list',
        // ⚠ Isolated through the ONE observable this construct owns: an EMPTY
        // list item cannot interrupt a paragraph, a non-empty one can. So
        // `prose` / `-<SP><NBSP>` is a `list` while the item is non-empty, and
        // becomes a `paragraph` the moment the emptiness test starts counting
        // U+00A0 as whitespace. Direction: content loss — a real item stops
        // interrupting, the `---` under it becomes a setext underline, and the
        // section's body is emptied.
        // ⚠ Found by MEASURING which corpus documents move under the widening,
        // not by reasoning. Two earlier spellings of this pin were wrong — one
        // gated by `LIST_ITEM_RE` so it fired on a different construct, and one
        // with the direction inverted, which failed against the pristine module.
        EMPTY_LIST_ITEM_RE: (dc, c) => t(dc, ['prose', `- ${c}`], 1) === 'list',
        INTERRUPTING_ITEM_RE: (dc, c) => t(dc, ['prose', `1.${c}x`], 1) !== 'list',
        BLOCKQUOTE_RE: (dc, c) => t(dc, [`${c}> q`], 0) !== 'blockquote',
        SETEXT_UNDERLINE_RE: (dc, c) => t(dc, ['prose', `---${c}`], 1) !== 'heading' && t(dc, ['prose', `${c}---`], 1) !== 'heading',
        BLANK_LINE_RE: (dc, c) => t(dc, ['para', c, '---'], 1) !== 'blank',
        // ⚠ The invisible character must sit in the GAP AFTER THE MARKER, which
        // is the only part of this regex with a whitespace class. A first draft
        // put it after the indent instead, where the gap class never sees it.
        LIST_ITEM_PREFIX_RE: (dc, c) => t(dc, [`-  ${c}x`, '', '   continuation'], 2) === 'list',
        indentWidth: (dc, c) => t(dc, [`${c}${c}${c}${c}code?`], 0) !== 'code',
        // ⚠ BOTH ends. `stripSpaceTab` is `^[ \t]+|[ \t]+$` — two alternatives,
        // and pinning the trailing one alone left the leading one free.
        stripSpaceTab: (dc, c) => dc.parseAtxHeading(`## Title${c}`).text.endsWith(c) && dc.parseAtxHeading(`## ${c}Title`).text.startsWith(c),
        // ⚠ This function's OWN whitespace class is the closing-sequence
        // stripper `/[ \t]+#+[ \t]*$/` — the opener belongs to ATX_HEADING_RE.
        // `## Title<NBSP>###` must keep its `###` as heading TEXT, because
        // U+00A0 is not the space that introduces a closing sequence. The
        // previous spelling only re-tested the opener, so it survived a widening
        // of the one expression this function actually owns.
        parseAtxHeading: (dc, c) => dc.parseAtxHeading(`##${c}Title`) === null
          && dc.parseAtxHeading(`## Title${c}###`).text.endsWith('###'),
        extractHeadings: (dc, c) => dc.extractHeadings(`#${c}Not A Heading`).length === 0,
        extractH2Headings: (dc, c) => dc.extractH2Headings(`##${c}Not A Heading`).length === 0,
        blankFencedBlocks: (dc, c) => dc.blankFencedBlocks(['## A', `${c}${BT}`, '## Visible', BT].join('\n'))[2].trim() !== '',
        classifyLines: (dc, c) => t(dc, [`${c}# H`], 0) !== 'heading'
      };

      // Excused, each with the reason. A construct is only excusable when an
      // invisible character cannot reach the decision it makes.
      const NO_INVISIBLE_PIN = {
        LINE_SPLIT_RE: 'splits a document on line endings; it never inspects within-line whitespace',
        FENCE_MARKER: 'a fragment with no whitespace class, composed into FENCE_OPEN_RE / FENCE_CLOSE_RE, which are both pinned',
        HTML_BLOCK_TAGS: 'an alternation of literal tag names, composed into HTML_BLOCK_TYPE6_RE, which is pinned',
        BULLET_MARKER: 'a fragment composed into LIST_ITEM_RE / EMPTY_LIST_ITEM_RE / INTERRUPTING_ITEM_RE, all pinned',
        ORDERED_DELIM: 'a fragment ([.)]) composed into ORDERED_MARKER; carries no whitespace class of its own',
        ORDERED_MARKER: 'a fragment composed into the three list regexes, all pinned',
        htmlBlockStart: 'reads HTML_BLOCK_TYPES and HTML_BLOCK_TYPE6_RE and adds no whitespace test; both are pinned',
        listContentColumn: 'measures a column through LIST_ITEM_PREFIX_RE and indentWidth, both pinned',
        unclosedHtmlBlockLine: 'reads the flag classifyLines already set and returns its index; it applies no whitespace test of its own, and the decision it reports is made by HTML_BLOCK_TYPES / HTML_BLOCK_TYPE6_RE, which are pinned',
        maskCodeBlocks: 'masks code lines to same-length spaces so the write path can search without matching a marker shown inside an example; it applies no whitespace test of its own and asks classifyLines for what code is. Pinned behaviourally under "reader-invisible content" in both directions',
        classifiedVisible: 'the single application of the invisibility rule: it returns classifyLines output alongside the lines that flag blanked. Adds no whitespace test of its own; the decision belongs to HTML_BLOCK_TYPES / HTML_TYPE1_INVISIBLE_TAGS, and its BEHAVIOUR is pinned under "reader-invisible content" in both directions',
        visibleTextLines: 'blanks the lines classifyLines marked invisible; it applies no whitespace test of its own. ⚠ Its defect surface is NOT an invisible character — it is WHICH HTML types render text, and a widening cannot express that. Pinned behaviourally instead, both directions, under "reader-invisible content", exactly as indentWidth is pinned for its arithmetic',
        HTML_TYPE1_INVISIBLE_TAGS: 'an alternation of two literal tag names with no whitespace class; which tags it names is pinned behaviourally under "reader-invisible content"'
      };

      const { blockFunctions, blockConstants } = guardedConstructs;
      const guarded = [...blockFunctions, ...blockConstants];
      const accounted = new Set([...Object.keys(INVISIBLE_PINS), ...Object.keys(NO_INVISIBLE_PIN)]);

      const unpinned = guarded.filter((n) => !accounted.has(n));
      assert.deepEqual(
        unpinned, [],
        `the class guard names ${unpinned.join(', ')} but nothing pins its behaviour against an invisible character at a block start. Add a pin, or add it to NO_INVISIBLE_PIN with the reason an invisible character cannot reach its decision. Do not skip this — five consecutive demonstrated defeats of this guard all landed on the one construct that had no such pin.`
      );
      const strayPins = [...accounted].filter((n) => !guarded.includes(n));
      assert.deepEqual(strayPins, [], `pinned or excused but no longer a guarded construct: ${strayPins.join(', ')}`);
      const bothWays = Object.keys(INVISIBLE_PINS).filter((n) => n in NO_INVISIBLE_PIN);
      assert.deepEqual(bothWays, [], `both pinned and excused: ${bothWays.join(', ')}`);

      // The pins themselves, over the whole character class rather than NBSP
      // alone — the ban list's own escape list already covers seven characters,
      // so pinning one would be the same narrowness one level down.
      for (const [label, code] of [['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b]]) {
        const c = String.fromCharCode(code);
        for (const [name, pin] of Object.entries(INVISIBLE_PINS)) {
          assert.equal(pin(doctorChecks, c), true, `${name} treats ${label} as whitespace at a block start — it is not whitespace to CommonMark, and this is the defect class the guard exists to hold shut`);
        }
      }

      // ⚠⚠ MUTATION ADEQUACY — the half that was missing, and the reason five
      // consecutive rounds each defeated this guard.
      //
      // Everything above derives WHICH constructs need a pin. Nothing related a
      // pin's expression to the defect it names, so a pin could be satisfied by
      // a sibling's gate, by a value the function cannot produce, or by putting
      // the character where the construct never looks — and a review round was
      // the only thing that could tell. Three of the pins above were exactly
      // that when they shipped; one asserted `!== 'fence'` against a classifier
      // whose vocabulary contains no `'fence'`, so it was true for every input
      // and every module state.
      //
      // So: break each construct the way this class of defect actually arrives —
      // widen its whitespace class to admit U+00A0 — and require ITS OWN pin to
      // fail. A pin that survives its own construct being broken is decoration,
      // whatever it looks like.
      //
      // ⚠ Two guards on the harness itself, both learned the hard way. A mutant
      // that does not PARSE, and a mutant that parses but changes NOTHING, both
      // read exactly like a pin firing correctly. Every mutant is therefore
      // required to load and to move observable behaviour before its result is
      // believed — and a construct with no live mutant is reported, not skipped.
      {
        const NBSP_ESC = '\\u00a0';
        const moduleSource = await readFile(join(repoRoot, 'lib/doctor-checks.js'), 'utf8');
        // The byte range of a top-level declaration, from its own line to the
        // next top-level declaration. Deliberately NOT the comment-stripped
        // text the class guard uses: a mutant has to be a loadable module, so
        // the region must be spliced back verbatim.
        const declRegionRange = (source, name) => {
          const m = source.match(new RegExp(`^(?:const|let|var) ${name}\\s*=|^function ${name}\\(`, 'm'));
          if (!m) return null;
          const start = m.index;
          const rest = source.slice(start + 1);
          const next = rest.search(/\n(?:function |const |let |var )[A-Za-z_]/);
          return { start, end: next === -1 ? source.length : start + 1 + next };
        };
        const mutantDir = await mkdtemp(join(tmpdir(), 'dflow-mutadq-'));
        // The canary tells us a mutant actually changed something.
        //
        // ⚠ IT MUST CARRY THE INVISIBLE CHARACTER ITSELF. The first version was
        // an all-ASCII corpus, so a widening that only manifests on a U+00A0
        // line changed nothing in it, every mutant was classified "inert", and
        // the adequacy check reported all 21 pins UNTESTED — a harness that
        // silently measures nothing, which is the same shape as the pins it was
        // written to catch.
        const NB = String.fromCharCode(0xa0);
        // ⚠⚠ THIS LIST IS HAND-WRITTEN AND THAT IS EXACTLY THE DEFECT IT KEEPS
        // PRODUCING. `isThematicBreak` has three alternatives — `-`, `*` and `_`
        // — and this list carried `---` and `***` and not `___`. So a mutant
        // widening the underscore alternative changed nothing the canary looked
        // at, was classified INERT, and its pin was never asked: a cross-vendor
        // round weakened the `isThematicBreak` pin so it no longer covered `___`,
        // widened the module's `_` alternative, and the whole suite stayed GREEN
        // while real `doctor` flipped a stale file to `current`
        // (`p082-b3-k2` finding 2). SILENT PASS, in the machinery built to stop
        // silent passes.
        //
        // So the members are DERIVED from the module's own guarded regions
        // instead of remembered. Every punctuation character the block predicates
        // recognise becomes a base line in the three shapes those predicates
        // read: a run of three, a bare marker, and a marker with content. The
        // hand list stays for the shapes that are not single characters (tags,
        // fences, tables, indents), because those cannot be derived this way —
        // but no single-character alternative can go missing again.
        const derivedMarkerChars = (() => {
          const chars = new Set();
          for (const name of [...guardedConstructs.blockFunctions, ...guardedConstructs.blockConstants]) {
            const range = declRegionRange(moduleSource, name);
            if (!range) continue;
            const region = moduleSource.slice(range.start, range.end);
            // Character-class members and the `(X[ \t]*)` run form, which is how
            // a thematic-break alternative is spelled.
            for (const m of region.matchAll(/\[([^\]\n]*)\]|\((\\?.)\[/g)) {
              for (const ch of (m[1] || m[2] || '')) {
                if (/[-*_+.)#`|>=~:]/.test(ch)) chars.add(ch);
              }
            }
          }
          return [...chars].sort();
        })();
        // Watched failing: this is the assertion that would have caught the hole
        // above, and it is stated as the class rather than as `___`.
        for (const ch of ['-', '*', '_']) {
          assert.ok(derivedMarkerChars.includes(ch),
            `the marker-character derivation missed ${JSON.stringify(ch)}, so the canary cannot see a mutant of the alternative that uses it — which is how a decorative pin gets certified`);
        }
        const canaryBases = [
          '# H', '---', '***', '```js', '|---|---|', '<script>', '<!-- c -->', '<?x', '<!D', '<![CDATA[',
          '<div>', '- x', '-', '1. x', '> q', '    code', '\tcode', 'prose', '', ' ', 'a | b',
          ...derivedMarkerChars.flatMap((c) => [c.repeat(3), c, `${c} x`])
        ];
        // ⚠ The character must appear in EVERY position a whitespace class can
        // occupy — leading indent, immediately after the marker, inside the gap,
        // and trailing. A corpus that only prefixes it declared ten constructs
        // inert whose widenings were live; the shapes below are the ones that
        // turned out to matter, each found by measuring rather than by guessing.
        // ⚠⚠ THE CHARACTER GOES IN EVERY POSITION, and this is the only version
        // that works. Two earlier canaries hand-picked a few positions, and each
        // time a mutation that moved real behaviour was classified INERT because
        // no corpus line happened to carry the character where that construct
        // looks — which silently excused the very pin being tested. A
        // decorative pin is indistinguishable from an inert mutant unless
        // something observes the shape the mutation changes, so the corpus stops
        // guessing which shape that is.
        const canaryDocs = [];
        for (const base of canaryBases) {
          const variants = [base];
          for (let i = 0; i <= base.length; i += 1) {
            variants.push(base.slice(0, i) + NB + base.slice(i));
            variants.push(base.slice(0, i) + NB + 'x' + base.slice(i));
          }
          for (const v of variants) {
            canaryDocs.push([v]);
            canaryDocs.push(['prose', v]);
            canaryDocs.push(['| a | b |', v]);
            canaryDocs.push([v, '', '  continuation']);
            canaryDocs.push([v, '', 'unindented']);
            canaryDocs.push([v, '---']);
          }
        }
        // Marker + gap shapes, which is where the list family's own whitespace
        // classes live and where `listContentColumn` reads the content column.
        for (const marker of ['-', '*', '+', '1.', '1)']) {
          for (const gap of ['', ' ', '  ', NB, ' ' + NB, NB + ' ', '\t', ' \t']) {
            canaryDocs.push([marker + gap + 'x']);
            canaryDocs.push(['prose', marker + gap + 'x']);
            canaryDocs.push([marker + gap + 'x', '', '   cont']);
            canaryDocs.push([marker + gap]);
            canaryDocs.push(['prose', marker + gap]);
          }
        }
        const fenceDocs = [];
        for (const pre of ['', ' ', '   ', NB, ' ' + NB]) {
          for (const post of ['', ' ', NB]) {
            fenceDocs.push(['## A', pre + BT + 'js', '## Hidden', BT + post, '## After']);
            fenceDocs.push(['## A', BT, '## Hidden', pre + BT + post, '## After']);
          }
        }
        const canary = (dc) => canaryDocs.map((doc) => {
          try { return dc.classifyLines(doc).map((c) => c.type).join(''); } catch { return 'THREW'; }
        }).join(',') + '|' + [
          `## T${NB}`, `## ${NB}T`, '## T ', `##${NB}T`, `#${NB}T`, `## T${NB}##`
        ].map((h) => {
          try { const r = dc.parseAtxHeading(h); return String(r && r.text); } catch { return 'THREW'; }
        }).join(',') + '|' + fenceDocs.map((d) => {
          try { return dc.blankFencedBlocks(d.join('\n')).join('/'); } catch { return 'THREW'; }
        }).join(',') + '|' + [
          `${NB}# H`, `# H${NB}`, `${NB}## H`
        ].map((l) => {
          try { return dc.extractHeadings(l).join('+') + '/' + dc.extractH2Headings(l).join('+'); } catch { return 'THREW'; }
        }).join(',') + '|' + canaryDocs.map((doc) => {
          // ⚠ The visible-text projection, added because the canary serialised
          // `c.type` ONLY — so the newest user-facing rule in the module sat
          // entirely outside its field of view. Measured: making the type-1
          // opener non-capturing leaves every line still typed `html`, so the
          // canary saw nothing, while `<script>` content became visible again and
          // a stale file flipped to `current` (`p082-b3-k2` finding 3). The
          // direct pins caught that mutant; the ADEQUACY LAYER could not prove
          // they would, which is the difference between a check and a
          // certificate.
          try { return dc.visibleTextLines(doc.join('\n')).join('/'); } catch { return 'THREW'; }
        }).join(',');
        const pristineCanary = canary(doctorChecks);

        const loadMutant = async (source, tag) => {
          const file = join(mutantDir, `m-${tag}.cjs`);
          await writeFile(file, source, 'utf8');
          try { return (await import(`file://${file.replace(/\\/g, '/')}`)).default; } catch { return null; }
        };

        // The widenings, applied only inside the named declaration's own region.
        // They are DERIVED from the text rather than written per construct: any
        // `[ \t]` class gains U+00A0, and a bare `^ {0,3}` indent becomes a class
        // that admits it. A construct whose declaration has neither is reported
        // as having no live mutant rather than quietly passing.
        // ⚠ ANY character class that admits space and tab, not the literal
        // `[ \t]` alone. The first version matched only the exact spelling, so
        // `[ \t>]` — the tail of the HTML type-1 opener — was never widened, its
        // mutant was inert, and a decorative pin for that construct passed the
        // adequacy check. Watched failing: reverting that pin to its old
        // spelling is caught now and was not before.
        // ⚠⚠ ONE CLASS AT A TIME. The first version widened EVERY `[...]` in a
        // declaration at once and required only that the pin fail against that
        // single all-at-once mutant — so a pin exercising ONE of a construct's N
        // whitespace classes was certified adequate. Demonstrated on three
        // constructs with the suite green: `TABLE_DELIMITER_ROW_RE` has seven
        // `[ \t]*` classes and its pin looked at the trailing one;
        // `isThematicBreak` has three regexes and its pin looked at `-` only;
        // `parseAtxHeading`'s closing-sequence stripper has two and the pin
        // looked at one. "A pin that survives its own construct being broken is
        // decoration" is only true if every class it owns gets its own mutant.
        const classPositions = (s) => {
          const out = [];
          const re = /\[[^\]\n]*\]/g;
          let m;
          while ((m = re.exec(s)) !== null) {
            const inner = m[0].slice(1, -1);
            if (inner.includes(' ') && /\\\\?t/.test(inner) && !inner.includes('u00a0')) out.push(m.index);
          }
          return out;
        };
        const widenOneClass = (s, at) => {
          const m = /\[[^\]\n]*\]/y;
          m.lastIndex = at;
          const hit = m.exec(s);
          if (!hit) return s;
          return s.slice(0, at) + `[${hit[0].slice(1, -1)}${NBSP_ESC}]` + s.slice(at + hit[0].length);
        };
        const widenings = (region) => [
          ...classPositions(region).map((at, i) => [`class-${i}`, (s) => widenOneClass(s, at)]),
          ['indent', (s) => s.replace(/\^ \{0,3\}/g, `^[ ${NBSP_ESC}]{0,3}`)],
          ['indent-group', (s) => s.replace(/\^\( \{0,3\}\)/g, `^([ ${NBSP_ESC}]{0,3})`)]
        ];

        // ⚠ A pin can be valuable and still have nothing to mutate. These six
        // constructs own no whitespace CLASS: four are consumers that read
        // another construct's decision, one is gated by a sibling so its own
        // widening is unreachable, and one computes a column by comparing
        // characters rather than by matching a class. Their pins stay — they
        // pin real end-to-end behaviour — but their adequacy comes from the
        // construct named here.
        //
        // ⚠⚠ THIS IS THE "COVERED BY A SIBLING" CLAIM, WRITTEN DOWN AND CHECKED.
        // A review round found a pin resting on exactly this relationship by
        // accident, undeclared — it looked covered because another pin happened
        // to catch the same break. The difference between that and this is that
        // the target below is asserted to exist, to be pinned, and to have live
        // mutants of its own. An accidental overlap cannot survive that.
        const ADEQUACY_VIA = {
          extractHeadings: ['ATX_HEADING_RE', 'a consumer: it filters classifyLines output and adds no whitespace test'],
          extractH2Headings: ['ATX_HEADING_RE', 'a consumer: same, filtered to level 2'],
          blankFencedBlocks: ['FENCE_OPEN_RE', 'reads FENCE_OPEN_RE / FENCE_CLOSE_RE and adds no whitespace test of its own'],
          classifyLines: ['ATX_HEADING_RE', 'the cascade itself: every whitespace class it consults belongs to one of the constructs above']
        };
        // ⚠ A SEPARATE, STRONGER CATEGORY, and splitting it out is a correction.
        // Two entries used to sit in ADEQUACY_VIA claiming cover from a sibling;
        // the relation check below showed the claimed dependency does not exist.
        // The true statement about them is not "someone else catches it" but
        // "this widening cannot express a defect here at all" — and that is
        // machine-checkable as `liveCount === 0`, so it is asserted rather than
        // argued.
        const INERT_BY_CONSTRUCTION = {
          INTERRUPTING_ITEM_RE: 'no widening of it moves behaviour: a line it would newly match is already claimed further up the cascade, so the mutant is observationally identical',
          indentWidth: 'it compares characters to compute a column and owns no character class, so a class-widening cannot reach it. ⚠ Its ARITHMETIC is a separate defect surface and is NOT covered here — it has its own behavioural pin below, added after a reviewer changed `col += 4 - (col % 4)` to `col += 4` with the whole suite green'
        };
        for (const [name, [target]] of Object.entries(ADEQUACY_VIA)) {
          assert.ok(INVISIBLE_PINS[target], `${name} claims its adequacy comes from ${target}, which is not a pinned construct`);
        }
        const doubleClassified = Object.keys(INERT_BY_CONSTRUCTION).filter((n) => n in ADEQUACY_VIA);
        assert.deepEqual(doubleClassified, [], `both excused as inert and as covered by a sibling: ${doubleClassified.join(', ')}`);

        const noLiveMutant = [];
        const survived = [];
        const liveCount = {};
        const liveMutants = {};
        for (const [name, pin] of Object.entries(INVISIBLE_PINS)) {
          const region = declRegionRange(moduleSource, name);
          if (!region) { noLiveMutant.push(`${name} (declaration not found)`); continue; }
          let live = 0;
          const regionText = moduleSource.slice(region.start, region.end);
          for (const [tag, widen] of widenings(regionText)) {
            const mutatedRegion = widen(regionText);
            if (mutatedRegion === regionText) continue;
            const source = moduleSource.slice(0, region.start) + mutatedRegion + moduleSource.slice(region.end);
            const mutant = await loadMutant(source, `${name}-${tag}`);
            if (!mutant) continue;                                  // did not parse
            if (canary(mutant) === pristineCanary) continue;        // parsed, changed nothing
            live += 1;
            liveMutants[name] = liveMutants[name] || [];
            liveMutants[name].push([tag, mutant]);
            if (pin(mutant, String.fromCharCode(0xa0)) === true) {
              survived.push(`${name} (${tag})`);
            }
          }
          liveCount[name] = live;
          if (live === 0 && !ADEQUACY_VIA[name] && !INERT_BY_CONSTRUCTION[name]) noLiveMutant.push(name);
        }

        // A construct that claims cover from a sibling must not itself have live
        // mutants — if it does, the claim is hiding a real, testable defect —
        // and the sibling it names must actually be mutation-tested.
        const badlyExcused = [...Object.keys(ADEQUACY_VIA), ...Object.keys(INERT_BY_CONSTRUCTION)]
          .filter((name) => liveCount[name] > 0)
          .map((name) => `${name} (has ${liveCount[name]} live mutant(s) of its own)`);
        assert.deepEqual(badlyExcused, [], `these constructs claim their adequacy comes from a sibling, but their OWN widening is live and therefore testable: ${badlyExcused.join(', ')}. Remove the ADEQUACY_VIA entry and let the mutation check cover them directly.`);
        const hollowTargets = Object.entries(ADEQUACY_VIA)
          .filter(([, [target]]) => !(liveCount[target] > 0))
          .map(([name, [target]]) => `${name} -> ${target}`);
        assert.deepEqual(hollowTargets, [], `these constructs claim cover from a sibling that is itself untested by mutation, so the claim is empty: ${hollowTargets.join(', ')}`);

        // ⚠⚠ THE DEPENDENCY IS CHECKED, NOT DECLARED. The first version asserted
        // only that the named target exists, is pinned, and has live mutants —
        // which any pinned name satisfies. A reviewer pointed all six entries at
        // `BLOCKQUOTE_RE`, a construct none of them depends on, and the suite
        // stayed green: the comment claimed "an accidental overlap cannot
        // survive that" while the assertion enforced nothing of the kind.
        //
        // The real relation is testable with the mutants already loaded: if X is
        // covered by T, then breaking T must make X's OWN pin fail. If it does
        // not, X is not covered by T — whatever the comment says.
        const unrelated = [];
        for (const [name, [target, reason]] of Object.entries(ADEQUACY_VIA)) {
          const pin = INVISIBLE_PINS[name];
          const caught = (liveMutants[target] || []).some(([, mutant]) => pin(mutant, String.fromCharCode(0xa0)) !== true);
          if (!caught) unrelated.push(`${name} -> ${target} ("${reason}")`);
        }
        assert.deepEqual(
          unrelated, [],
          `these constructs are excused as covered by a sibling, but breaking that sibling does NOT make their own pin fail, so the dependency is not real: ${unrelated.join('; ')}`
        );

        assert.deepEqual(
          survived, [],
          `these pins PASS against a module whose own construct was widened to treat U+00A0 as whitespace, so they cannot fail against the defect they name: ${survived.join(', ')}. Rewrite the pin to ask about the construct's own whitespace class — not the indent it shares with every other opener, and not a value the function never produces.`
        );
        assert.deepEqual(
          noLiveMutant, [],
          `no mutant of these constructs both parsed and changed behaviour, so their pins are UNTESTED: ${noLiveMutant.join(', ')}. Either the widening does not reach them (extend the list) or the construct has no whitespace class of its own (move it to NO_INVISIBLE_PIN with that reason).`
        );
        await rm(mutantDir, { recursive: true, force: true });
      }
    }

    // The 0-3 space indent widening (`p082-b3-g2` finding 2 follow-on). It was
    // first left out of extractHeadings / extractH2Headings as a deliberate
    // asymmetry, then measured to be a plain divergence from the reference.
    // Pinned because it is a behaviour change to the cross-ref and
    // template-shape checks, which `p082-b3-g3` noted nothing covered.
    for (const indent of ['', ' ', '  ', '   ']) {
      assert.deepEqual(doctorChecks.extractH2Headings(`${indent}## Git Policy`), ['Git Policy'], `${indent.length}-space indented H2 is a heading`);
      assert.deepEqual(doctorChecks.extractHeadings(`${indent}#### Deep`), ['Deep'], `${indent.length}-space indented H4 is a heading`);
    }
    assert.deepEqual(doctorChecks.extractH2Headings('    ## Four spaces'), [], 'a 4-space indent is indented code, not a heading');
    assert.deepEqual(doctorChecks.extractHeadings('    #### Four spaces'), [], 'a 4-space indent is indented code, not a heading');

    // The `-` / `=` asymmetry, pinned at the predicate rather than only through
    // the shape matrix: a `-` run of 3+ is a thematic break, while NO `=` run
    // ever is. The old combined `(=+|-+)` pattern erased that and made a bare
    // `===` — ordinary paragraph text — look like a block-starting shape.
    for (const yes of ['---', '----', '***', '___', '- - -', '* * *', '_ _ _', '   ---']) {
      assert.ok(doctorChecks.isThematicBreak(yes), `${JSON.stringify(yes)} is a thematic break`);
    }
    for (const no of ['===', '=', '--', '**', '__', '-', '- a bullet', '    ---']) {
      assert.ok(!doctorChecks.isThematicBreak(no), `${JSON.stringify(no)} is NOT a thematic break`);
    }

    // The edition filter. Every shipped entry has `editions: null`, so this
    // branch is unreachable through findConventionsDrift and a test written
    // through it would prove nothing (`p082-b3-g1` finding 5). Debt 10 — the
    // greenfield DDD-Modeling-Depth fingerprint — is the known first user, so
    // the contract is pinned before it arrives rather than after.
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: null }, 'greenfield'), true, 'a shared entry applies to a resolved edition');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: null }, null), true, 'a shared entry applies when no edition could be resolved');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: ['greenfield'] }, 'greenfield'), true, 'an edition-specific entry applies to its own edition');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: ['greenfield'] }, 'brownfield'), false, 'an edition-specific entry does not apply to another edition');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: ['greenfield'] }, null), false, 'an edition-specific entry is NOT evaluated when the edition is unknown — guessing would report a greenfield rule missing from a brownfield project');
    assert.deepEqual(
      doctorChecks.CONVENTIONS_FINGERPRINTS.concat(doctorChecks.CONVENTIONS_RETIRED).filter((fp) => fp.editions).map((fp) => fp.id),
      [],
      'no shipped entry is edition-specific yet — when the first one lands, add a findConventionsDrift case for it here'
    );

    // Retired strings (P082 G5's second fingerprint kind). Each must be
    // zero-match in the packaged templates AND the tutorial fixtures, or it
    // would fire on every project forever.
    for (const edition of ['greenfield', 'brownfield']) {
      const packaged = await readFile(join(repoRoot, `templates/${edition}/scaffolding/_conventions.md`), 'utf8');
      const fixture = await readFile(join(repoRoot, `tutorial/0${edition === 'greenfield' ? 1 : 2}-${edition}/outputs/dflow/specs/shared/_conventions.md`), 'utf8');
      for (const fp of doctorChecks.CONVENTIONS_RETIRED) {
        if (fp.editions && !fp.editions.includes(edition)) continue;
        assert.ok(!packaged.includes(fp.retired), `${edition} packaged _conventions.md must not contain the retired string for ${fp.id}`);
        assert.ok(!fixture.includes(fp.retired), `${edition} tutorial _conventions.md fixture must not contain the retired string for ${fp.id}`);
      }
      assert.deepEqual(doctorChecks.findConventionsDrift(fixture, edition), [], `the ${edition} tutorial _conventions.md fixture must be drift-free`);
    }

    // A row an adopter migrated CORRECTLY — same situation, escalated tier in the
    // form the current template teaches — must not be called retired. The
    // `ceremony-query-only-t2` anchor covered only the situation cell, so it
    // flagged this and told the developer to overwrite their own decision.
    const ceremonyRow = (row) => freshConventions.replace(
      '| {e.g. New Aggregate}',
      `${row}\n| {e.g. New Aggregate}`
    );
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremonyRow('| Adding a Query only (no write) | T1 (project convention) | We escalate all new reads |'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      [],
      'a correctly-escalated row carrying the same situation text is not reported as retired'
    );
    // ...while the retired row itself, bare tier and placeholder brace intact, is.
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremonyRow('| {e.g. Adding a Query only (no write)} | T2 | No Aggregate state change |'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      ['ceremony-query-only-t2:retired'],
      'the retired template row is still detected'
    );

    const withRetired = freshConventions.replace(
      '| {e.g. EF configuration tweak in Infrastructure} | T1 (project convention)',
      '| {e.g. EF configuration tweak in Infrastructure} | T3 if no Domain change'
    );
    assert.notEqual(withRetired, freshConventions, 'precondition: the retired-row injection applied');
    assert.deepEqual(
      doctorChecks.findConventionsDrift(withRetired, 'greenfield').map((d) => `${d.id}:${d.state}`),
      ['ceremony-ef-tweak-t3:retired'],
      'a retired PROPOSAL-082 row still present in the file is reported'
    );

    // False-positive controls (P082 requires these explicitly): a project that
    // added its OWN rows while keeping the rules must stay silent, and a
    // paraphrase of a rule is NOT the rule — the fingerprint is a substring
    // check and must not be described as understanding the text.
    const customRows = freshConventions.replace(
      '| {e.g. Domain Event payload extension} |',
      '| Our own row: nightly ETL schema touch | T1 (project convention) | We escalate anything the warehouse reads |\n| {e.g. Domain Event payload extension} |'
    );
    assert.notEqual(customRows, freshConventions, 'precondition: the custom-row injection applied');
    assert.deepEqual(doctorChecks.findConventionsDrift(customRows, 'greenfield'), [], 'project-added rows alongside the intact rules do not trigger drift');

    // Section boundaries: a `---` closes a section only where CommonMark says so.
    // Both directions have shipped a defect, so both are pinned here.
    const tail = '\n\n## Filling the Templates\n\nno-BR family variants\n\n### SPEC-ID Format\n\nMinimal (zero-phase) host exception\n';
    const ceremony = (body) => `## Ceremony Scaling (Project Application)\n\n${body}${tail}`;

    // Prose containing a pipe is NOT a table row. Testing `line.includes('|')`
    // made a `---` after such a line stop closing the section, so the body ran
    // on and matched the marker in a LATER section — reporting `current` for a
    // section that does not carry the rule. Silent success.
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremony('We escalate any change to the Command | Query split.\n---\n\nHistorical note: we dropped the wording that the cascade result is a floor.'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      ['ceremony-escalate-only:stale'],
      'a setext underline after pipe-bearing PROSE still closes the section — the body must not run on into the next one'
    );

    // A real table row is not a paragraph, so `---` after one is not setext.
    for (const delimiter of ['|---|---|', '|:---|---:|']) {
      assert.deepEqual(
        doctorChecks.findConventionsDrift(
          ceremony(`| a | b |\n${delimiter}\n| cascade result is a floor | x |\n---`),
          'greenfield'
        ),
        [],
        `a \`---\` after a table row (delimiter ${delimiter}) is a thematic break, not a heading`
      );
    }

    // ---------------------------------------------------------------------
    // The `isParagraphLine` shape matrix.
    //
    // Every exclusion in that predicate was added REACTIVELY, after a review
    // round found the case — which is why two consecutive rounds each produced
    // a defect there, one in each direction. The predicate itself was never the
    // hard part; having no systematic test was. Each row pins one shape in both
    // underline forms, so a new exclusion has to declare its expectation
    // instead of being discovered.
    //
    // ⚠ WHAT THIS DOES **NOT** CLAIM, because an earlier version of this
    // sentence claimed it and was wrong: it does not pin "every shape", and a
    // green run is not evidence that every branch of the predicate is reached.
    // The first version of this matrix said it pinned every shape while no row
    // reached the "another underline" branch at all — and four live divergences
    // were sitting in the shapes nobody had written down. The list is only ever
    // as good as its enumeration; adding a branch means adding rows here AND in
    // the differential.
    //
    // ⚠ The expectations are MEASURED, not reasoned. The arbiter is
    // `commonmark@0.31.2` (the spec's own implementation) via
    // `commonmark-differential.mjs` in the review-records folder, which carries
    // the same shapes. `marked` — this repo's own dependency — is NOT
    // conformant on several of them, and two shipped defects came from
    // settling a shape by argument instead of by measurement. Re-run the
    // differential before changing `isParagraphLine`, `isThematicBreak`,
    // `headingAt`, `blockStartIndex` or `isTableLine`.
    //
    // Method: put <shape> then <underline> inside a section, with a SENTINEL
    // line after. If the underline is a heading the section ended, so SENTINEL
    // is NOT in its body; if it is not a heading, SENTINEL IS.
    // ---------------------------------------------------------------------
    {
      const SENTINEL = 'SENTINEL-MARKER-LINE';
      // ⚠ POSITION MATTERS, and the table states it. Each row's shape is placed
      // at a BLOCK START (immediately after a blank line) unless the row itself
      // supplies the preceding lines — the `wrapped …` rows do exactly that, to
      // pin the continuation position. Several shapes flip between the two
      // positions, which is precisely where the two shipped parser defects
      // lived, so a row asserting only the block-start case would be stating an
      // unconditional expectation it cannot support.
      //
      // [label, shape lines, is a setext heading when followed by an underline]
      const shapes = [
        ['plain paragraph', ['Some ordinary prose.'], true],
        ['prose containing a pipe', ['The Command | Query split.'], true],
        ['prose with 1-3 space indent', ['   indented prose'], true],
        ['single word', ['Heading'], true],
        ['4-space indent (code block)', ['    indented code'], false],
        ['tab indent (code block)', ['\tindented code'], false],
        // Deliberately deeper than the target section: a `##` here would end the
        // section on its own and the case would prove nothing about the
        // underline, which is what this matrix is isolating.
        ['ATX heading (deeper level)', ['#### Some Heading'], false],
        ['bullet list item', ['- a bullet'], false],
        ['star list item', ['* a bullet'], false],
        ['numbered list item', ['1. a step'], false],
        ['blockquote', ['> quoted'], false],
        ['HTML comment', ['<!-- a note -->'], false],
        ['blank line', [''], false],
        ['whitespace-only line', ['   '], false],
        ['table row (pipe delimiter)', ['| a | b |', '|---|---|', '| c | d |'], false],
        ['table row (pipeless delimiter)', ['a | b', '---|---', 'c | d'], false],
        // Continuation lines. Judged by their own shape these look like
        // paragraphs, which is how a wrapped bullet's second line came to end a
        // section early and lose the marker it carried. `marked` lexes
        // `- a\n  b\n---` as `list , hr`.
        ['wrapped bullet (continuation)', ['- a bullet that wraps onto the', '  next line here'], false],
        ['wrapped numbered item', ['1. a step that wraps onto the', '   next line here'], false],
        ['wrapped blockquote', ['> quoted text that wraps onto', '  the next line here'], false],
        // A wrapped ordinary paragraph is still a paragraph, so an underline
        // after it IS a heading — the fix for the above must not swallow this.
        ['wrapped plain paragraph', ['ordinary prose that wraps onto', 'the next line here'], true],
        // Shapes that CANNOT interrupt a paragraph are part of it, so the
        // underline closes the whole thing as a setext heading. Judging these by
        // their own shape made the section run on instead — silent pass.
        // Every expectation below was measured against the CommonMark reference
        // implementation, not reasoned about; see the note on isParagraphLine.
        ['paragraph then 4-space indent', ['ordinary prose', '    indented continuation'], true],
        ['paragraph then tab indent', ['ordinary prose', '\ttabbed continuation'], true],
        ['paragraph then ordered 2.', ['ordinary prose', '2. not starting at one'], true],
        // ...while these DO interrupt, so the paragraph already ended and the
        // underline has no paragraph to close.
        ['paragraph then bullet', ['ordinary prose', '- a bullet'], false],
        ['paragraph then ordered 1.', ['ordinary prose', '1. starting at one'], false],
        ['paragraph then blockquote', ['ordinary prose', '> quoted'], false],
        ['paragraph then HTML comment', ['ordinary prose', '<!-- c -->'], false],
        // Directly under a leaf block that ends on its own line, the shape is at
        // a REAL block start — so the block-start exclusions apply and the
        // underline is not setext. Walking back over such lines treated these as
        // prose continuations, and the identical line one position further down
        // was judged correctly. Every matrix row before these sat after a blank
        // line or after a paragraph/list/blockquote, which is why nothing caught
        // it. `marked` agrees on all four.
        ['ordered 2. directly under a heading', ['#### A Heading', '2. a step'], false],
        ['4-space indent directly under a heading', ['#### A Heading', '    indented code'], false],
        ['ordered 2. directly under a thematic break', ['***', '2. a step'], false],
        ['ordered 2. directly under an HTML comment', ['<!-- n -->', '2. a step'], false],
        // ⚠ EVERY ROW BELOW WAS MISSING, AND FOUR OF THEM WERE LIVE DEFECTS.
        // A cross-vendor round read the claim above and asked which case reaches
        // the predicate's own "another underline" branch. None did — every row
        // above puts prose, a list, a quote or a heading before the underline,
        // never a break or a bare marker. It filed that as a coverage-claim
        // defect; widening the differential turned it into four divergences
        // from the CommonMark reference, one silent-pass and three
        // content-losing. The lesson is the cheap one: an unreached branch is
        // not "merely untested", it is untested AND unmeasured.
        //
        // `-` and `=` are NOT symmetric, which is what the old combined
        // `(=+|-+)` pattern erased: a `-{3,}` run is a thematic break, while
        // ANY `=+` run is ordinary paragraph text that an underline can close.
        ['bare --- (thematic break)', ['---'], false],
        ['bare ---- (thematic break)', ['----'], false],
        ['bare -- (too short for a break, so prose)', ['--'], true],
        ['bare === (prose, NOT a break)', ['==='], true],
        ['bare = (prose)', ['='], true],
        ['bare *** (thematic break)', ['***'], false],
        ['bare ** (too short, so prose)', ['**'], true],
        ['bare ___ (thematic break)', ['___'], false],
        ['bare __ (too short, so prose)', ['__'], true],
        ['spaced - - - (thematic break)', ['- - -'], false],
        ['spaced * * * (thematic break)', ['* * *'], false],
        ['spaced _ _ _ (thematic break)', ['_ _ _'], false],
        // A list marker with nothing after it is an EMPTY list item, not prose.
        // The bullet/ordered tests required whitespace after the marker, so a
        // bare `-` read as a paragraph and the following `---` ended the section
        // early — the pop then deleted the marker line.
        ['bare - (empty list item)', ['-'], false],
        ['bare * (empty list item)', ['*'], false],
        ['bare + (empty list item)', ['+'], false],
        ['bare 1. (empty ordered item)', ['1.'], false],
        ['bare 2. (empty ordered item)', ['2.'], false],
        ['bare 1) (empty ordered item)', ['1)'], false],
        // Blank-line separated so the break/underline sits at a real block
        // start rather than continuing the paragraph.
        ['paragraph, blank, then ===', ['ordinary prose', '', '==='], true],
        ['paragraph, blank, then ***', ['ordinary prose', '', '***'], false],
        ['paragraph, blank, then ---', ['ordinary prose', '', '---'], false],
        // ⚠ These test `blockStartIndex` / `closesOwnBlock`, not a line's own
        // shape, and they are where the SAME defect class turned up a second
        // time. After `isParagraphLine` stopped conflating `=` with `-`, the
        // conflation was still sitting in `closesOwnBlock`, which called any
        // `=+` run block-closing. A bare `===` is paragraph TEXT, so the line
        // after it continues that paragraph and a shape that cannot interrupt
        // a paragraph must not be read as a new block. Two of the rows below
        // were live silent-pass defects when first measured.
        ['=== then ordered 2. (continuation)', ['===', '2. a step'], true],
        ['=== then ordered 2) (continuation)', ['===', '2) a step'], true],
        ['=== then 4-space (continuation)', ['===', '    indented code'], true],
        ['=== then tab (continuation)', ['===', '\tindented code'], true],
        ['=== then prose (continuation)', ['===', 'continuation text'], true],
        ['=== then ordered, twice', ['===', '2. a step', '3. another'], true],
        // ...but shapes that DO interrupt a paragraph end it, so the underline
        // has no paragraph left to close.
        ['=== then bullet (interrupts)', ['===', '- a bullet'], false],
        ['=== then blockquote (interrupts)', ['===', '> quoted'], false],
        ['=== then ATX (interrupts)', ['===', '#### H'], false],
        // A `=+` run is only an underline when something above it is a
        // paragraph. After a heading, a comment or a break it is plain text.
        ['ATX, ===, ordered 2.', ['#### H', '===', '2. a step'], true],
        ['comment, ===, ordered 2.', ['<!-- c -->', '===', '2. a step'], true],
        ['break, ===, ordered 2.', ['***', '===', '2. a step'], true],
        ['para, ===, ordered 2.', ['ordinary prose', '===', '2. a step'], true],
        ['para, blank, ===, ordered 2.', ['ordinary prose', '', '===', '2. a step'], true],
        ['single = then ordered 2.', ['=', '2. a step'], true],
        ['-- then ordered 2.', ['--', '2. a step'], true],
        ['setext h1 then ordered 2.', ['title', '===', '2. a step'], true],
        ['setext h2 then ordered 2.', ['title', '---', '2. a step'], true],
        ['blockquote then 4-space', ['> quoted', '    indented code'], false],
        ['bullet then ordered 2.', ['- a bullet', '2. a step'], false],
        ['nested blockquote, lazy continuation', ['> outer', '> > inner', 'lazy continuation'], false],
        ['list, blank, new paragraph', ['- a bullet', '', 'new paragraph'], true]
      ];

      for (const [label, shapeLines, isHeading] of shapes) {
        for (const underline of ['---', '===']) {
          const doc = [
            '## Target Section',
            '',
            ...shapeLines,
            underline,
            '',
            SENTINEL,
            '',
            '## Next Section',
            ''
          ].join('\n');
          const bodies = doctorChecks.conventionsSectionBodies(doc, 'Target Section');
          assert.equal(bodies.length, 1, `${label} + ${underline}: expected exactly one Target Section body`);
          const sentinelInBody = bodies[0].includes(SENTINEL);
          assert.equal(
            sentinelInBody,
            !isHeading,
            isHeading
              ? `${label} + ${underline}: this IS a setext heading, so the section must end before ${SENTINEL}`
              : `${label} + ${underline}: this is NOT a setext heading, so the section must continue past it and still contain ${SENTINEL}`
          );
        }
      }

      // An underline as the very first line has no preceding line to close.
      assert.equal(
        doctorChecks.conventionsSectionBodies('---\n\n## Target Section\n\nbody text\n', 'Target Section').length,
        1,
        'a leading underline must not crash or swallow the document'
      );
    }

    // Retired anchors must not fire on legitimate adopter prose. Two shorter
    // anchors shipped and both did: `criteria table`, then
    // `for the full criteria table`.
    for (const sentence of [
      'We keep a fuller decision matrix elsewhere; see that document for the full criteria table.',
      'Ask the architecture guild for the full criteria table we agreed on.',
      'Our own criteria table below records the escalations we apply.'
    ]) {
      assert.deepEqual(
        doctorChecks.findConventionsDrift(freshConventions.replace('situations.', `situations. ${sentence}`), 'greenfield'),
        [],
        `adopter prose must not be reported as retired Dflow text: "${sentence}"`
      );
    }
    // ...while the real retired sentence still fires, including soft-wrapped.
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremony('See `AI-AGENT-GUIDE.md` § Ceremony Scaling for the full\ncriteria table.\n\ncascade result is a floor'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      ['ceremony-criteria-table:retired'],
      'the actual retired pointer is still detected across its soft wrap'
    );

    const paraphrased = freshConventions.replace('cascade result is a floor', 'cascade outcome is a lower bound');
    assert.deepEqual(
      doctorChecks.findConventionsDrift(paraphrased, 'greenfield').map((d) => `${d.id}:${d.state}`),
      ['ceremony-escalate-only:stale'],
      'a paraphrase does not satisfy the fingerprint — this is a substring check, and saying so is the point'
    );
  }

  console.log(`PROPOSAL-058 upgrade-drift tests passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
