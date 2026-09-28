// PROPOSAL-105 — `dflow check-closeout`, the closeout gate (dist issue #5).
//
// Every fixture is a real temporary git repository, and every archived file in
// it is built FROM THE SHIPPED TEMPLATES (`templates/{edition}/templates/`), not
// from a copy kept here. The builders assert the shape they edit is still there
// — the `status: in-progress` line, the `## Checkpoint Log` table and its
// placeholder `closeout` row — so a template change that the gate would have to
// follow turns this suite red instead of leaving it green on a stale copy.
//
//   (1) the readers, on the standard shapes and on the ones that must read
//       uncertain;
//   (2) `--staged`: most cases are hosts of ONE staged closeout, checked in one
//       run — which also exercises the gate sorting findings back to each host;
//       the cases that need their own history (the #5 reproduction, renames,
//       amend, merge, a monorepo, a project below the root) get their own
//       repository;
//   (3) `--range`;
//   (4) the pre-commit hook template in `docs/closeout-check.md` / `.en.md`, run
//       by git itself — reported as NOT RUN where this machine cannot run hooks.
//
// ⚠ The failing cases assert WHICH finding fired, not only the exit code. Every
// problem exits 1, so an exit-code-only assertion stays green when the gate
// blocks for the wrong reason — for example, the template's placeholder
// `closeout` row read as a real row with an unknown Result is `[uncertain]`,
// which exits 1 too, and would hide a gate that stopped excluding it.
//
// The gate runs in this process (`runCheckCloseout`) except where the point is
// the CLI itself: starting Node once per case made this suite several times
// slower on Windows, where each process costs a few hundred milliseconds.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import closeout from '../lib/closeout-check.js';
import init from '../lib/init.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dflowBin = join(repoRoot, 'bin', 'dflow.js');
const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-closeout-'));
const gitConfig = join(tempRoot, 'fixture.gitconfig');
const gitTemplate = join(tempRoot, 'git-template');
await mkdir(gitTemplate);
// Throwaway repositories: no fsync, no automatic gc — both only cost time here.
await writeFile(gitConfig, '[core]\n\tautocrlf = false\n\tfsync = none\n[gc]\n\tauto = 0\n[maintenance]\n\tauto = false\n');

// Isolated from this machine's git configuration — a global `core.hooksPath`,
// `commit.gpgsign` or `core.autocrlf` would change what these fixtures commit —
// and set on this process, because the gate runs in it and passes its own
// environment to git. The ceiling keeps the not-a-repository case from finding
// a repository above the temporary directory.
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: gitConfig,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CEILING_DIRECTORIES: tempRoot,
  GIT_AUTHOR_NAME: 'Dflow Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Dflow Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid'
});

const FEATURES = 'dflow/specs/features';
let repoCount = 0;
let checked = 0;

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.error) throw r.error;
  assert.equal(r.status, 0, `git ${args.join(' ')} failed in ${cwd}:\n${r.stderr}`);
  return r.stdout;
}

async function runCheck(cwd, args = []) {
  let out = '';
  let err = '';
  const code = await closeout.runCheckCloseout({
    cwd,
    args,
    stdout: { write: (text) => { out += text; } },
    stderr: { write: (text) => { err += text; } }
  });
  return { code, out, err };
}

function runCli(cwd, args = [], env = process.env) {
  const r = spawnSync(process.execPath, [dflowBin, 'check-closeout', ...args], { cwd, env, encoding: 'utf8', timeout: 120000 });
  if (r.error) throw r.error;
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One host's block of the report: its `[pass]` / `[blocked]` line and the
// finding lines under it.
function section(out, host) {
  const lines = out.split('\n');
  const start = lines.findIndex((line) => /^\[(pass|blocked)\] /.test(line) && line.endsWith(` ${FEATURES}/completed/${host}/`));
  assert.ok(start !== -1, `the report must list ${host}\n${out}`);
  let end = start + 1;
  while (end < lines.length && lines[end].startsWith('  ')) end += 1;
  return lines.slice(start, end).join('\n');
}

function expectHost(out, host, expected, label) {
  const block = section(out, host);
  if (expected === 'pass') {
    assert.ok(block.startsWith('[pass] '), `${label}: ${host} must pass\n${block}`);
  } else {
    assert.ok(block.startsWith('[blocked] '), `${label}: ${host} must be blocked\n${block}`);
    for (const pattern of expected) assert.match(block, pattern, `${label}: ${host}: expected ${pattern}\n${block}`);
    const findings = block.split('\n').filter((line) => /^ {2}\[(fail|uncertain)\] /.test(line)).length;
    assert.equal(findings, expected.length, `${label}: ${host} must report exactly the expected findings, no others\n${block}`);
  }
  checked += 1;
}

function expectPass(result, label, hosts) {
  assert.equal(result.code, 0, `${label}: expected exit 0\n${result.out}${result.err}`);
  for (const host of hosts) expectHost(result.out, host, 'pass', label);
}

function expectNothing(result, label) {
  assert.equal(result.code, 0, `${label}: expected exit 0\n${result.out}${result.err}`);
  assert.match(result.out, /No feature directory is newly archived here/, `${label}: nothing may be in scope\n${result.out}`);
  checked += 1;
}

function expectBlocked(result, label, host, patterns) {
  assert.equal(result.code, 1, `${label}: expected exit 1\n${result.out}${result.err}`);
  assert.match(result.out, /^BLOCKED: /m, `${label}: the report must end in BLOCKED\n${result.out}`);
  expectHost(result.out, host, patterns, label);
}

// The one finding a new directory in completed/ gets when it did not come from
// active/ under its own name.
function unplacedPattern(dir) {
  const name = dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\[uncertain\\] .*${name}/ is new, but was never in dflow/specs/features/active/${name}/\\.`);
}

// --- template-derived fixtures ------------------------------------------------

const templateCache = new Map();
async function template(edition, name) {
  const key = `${edition}/${name}`;
  if (!templateCache.has(key)) templateCache.set(key, await readFile(join(repoRoot, 'templates', edition, 'templates', name), 'utf8'));
  return templateCache.get(key);
}

// The flip finish-feature Step 2 makes (for `_index.md`) and modify-existing
// Step 5.3 or a phase completing makes (for a spec): the template's own
// `status:` line, value only. Its trailing `# in-progress | completed` comment
// stays — that is the standard shape the gate has to read.
function flipped(text, label) {
  const out = text.replace(/^status: in-progress(?=[ \t\r]|$)/m, 'status: completed');
  assert.notEqual(out, text, `${label}: the template no longer has a \`status: in-progress\` line. The gate reads status from that line; update lib/closeout-check.js and this fixture together.`);
  return out;
}

// Appends a row after the Checkpoint Log table's last row — the row finish-feature
// Step 4 instruction 1 writes. The template's placeholder rows stay where they are.
function withLogRow(text, row, label) {
  const lines = text.split('\n');
  const heading = lines.findIndex((line) => line.replace(/\r$/, '') === '## Checkpoint Log');
  assert.ok(heading !== -1, `${label}: no \`## Checkpoint Log\` heading in the template`);
  let first = heading + 1;
  while (first < lines.length && !lines[first].startsWith('|')) first += 1;
  assert.ok(first < lines.length, `${label}: no table under \`## Checkpoint Log\``);
  let last = first;
  while (last + 1 < lines.length && lines[last + 1].startsWith('|')) last += 1;
  lines.splice(last + 1, 0, `${row}${lines[last].endsWith('\r') ? '\r' : ''}`);
  return lines.join('\n');
}

function withoutFrontmatter(text) {
  const lines = text.split('\n');
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  assert.ok(lines[0].startsWith('---') && close > 0, 'the template has frontmatter');
  return lines.slice(close + 1).join('\n');
}

const crlf = (text) => text.replace(/\r?\n/g, '\r\n');
// Built from its code point: a literal byte-order mark in source is invisible in
// a diff and an editor may drop it.
const bom = (text) => `${String.fromCharCode(0xfeff)}${text}`;

async function newRepo(label, prefix = '') {
  repoCount += 1;
  const dir = join(tempRoot, `r${repoCount}-${label}`);
  await mkdir(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main', `--template=${gitTemplate}`);
  const project = prefix ? join(dir, prefix) : dir;
  for (const area of ['active', 'completed']) {
    await mkdir(join(project, FEATURES, area), { recursive: true });
    await writeFile(join(project, FEATURES, area, '.gitkeep'), '');
  }
  await writeFile(join(dir, 'README.md'), 'fixture\n');
  return { dir, project };
}

// A host in `active/`, the way the flows leave it before closeout: `_index.md`
// still in-progress (Step 2 flips it at closeout), the specs already completed
// (Step 1 blocks otherwise). `transform` rewrites every file (CRLF, BOM); `files`
// adds or replaces files by name. Not committed — the caller commits once for
// every host it opens.
async function writeHost(repo, host, { edition = 'greenfield', specStatus = 'completed', transform = (t) => t, files = {} } = {}) {
  const dir = join(repo.project, FEATURES, 'active', host);
  await mkdir(dir, { recursive: true });
  const spec = async (name) => {
    const text = await template(edition, name);
    return specStatus === 'completed' ? flipped(text, `${edition}/${name}`) : text;
  };
  const content = {
    '_index.md': await template(edition, '_index.md'),
    'lightweight-2026-09-28-fix-rounding.md': await spec('lightweight-spec.md'),
    'BUG-042-rounding.md': await spec('lightweight-spec.md'),
    'phase-spec-2026-09-28-first.md': await spec('phase-spec.md'),
    ...files
  };
  for (const [name, text] of Object.entries(content)) await writeFile(join(dir, name), transform(text));
}

function commitAll(repo, message) {
  git(repo.dir, 'add', '-A');
  git(repo.dir, 'commit', '-q', '-m', message);
}

// finish-feature Step 2: flip `_index.md` in `active/`.
async function flipIndex(dir) {
  const file = join(dir, '_index.md');
  await writeFile(file, flipped(await readFile(file, 'utf8'), file));
}

// finish-feature Step 4 instruction 1: the closeout row, in the archived copy.
async function writeRow(dir, row, edit = (t) => t) {
  const file = join(dir, '_index.md');
  let text = await readFile(file, 'utf8');
  if (row) text = withLogRow(text, row, file);
  await writeFile(file, edit(text));
}

const ROW = '| 2026-09-28 17:00 | closeout | committed |';

// The whole closeout of one host, step by step; each step can be bent to
// reproduce one failure.
async function closeOut(repo, host, { flip = true, target = host, row = ROW, stage = true, edit } = {}) {
  if (flip) await flipIndex(join(repo.project, FEATURES, 'active', host));
  git(repo.project, 'mv', `${FEATURES}/active/${host}`, `${FEATURES}/completed/${target}`);
  await writeRow(join(repo.project, FEATURES, 'completed', target), row, edit);
  if (stage) git(repo.project, 'add', '--', `${FEATURES}/completed/${target}`);
}

// --- (1) readers --------------------------------------------------------------

{
  const { frontmatterStatus, checkpointLog, specFileGlobs } = closeout;
  for (const edition of ['greenfield', 'brownfield']) {
    const index = await template(edition, '_index.md');
    assert.deepEqual(frontmatterStatus(index), { state: 'ok', value: 'in-progress' }, `${edition}: the template's own status line reads, trailing comment and all`);
    assert.deepEqual(frontmatterStatus(flipped(index, edition)), { state: 'ok', value: 'completed' }, `${edition}: the flipped line reads completed`);
    assert.deepEqual(frontmatterStatus(crlf(flipped(index, edition))), { state: 'ok', value: 'completed' }, `${edition}: CRLF reads the same`);
    const log = checkpointLog(index);
    assert.equal(log.sections, 1, `${edition}: one Checkpoint Log section`);
    assert.ok(log.table && log.table.header.includes('Checkpoint') && log.table.header.includes('Result'), `${edition}: the log table has Checkpoint and Result columns`);
    assert.ok(log.table.rows.some((row) => row.includes('closeout') && row.includes('committed / skipped / failed')),
      `${edition}: the template carries a placeholder closeout row — the gate's exclusion of it is what the placeholder cases below test`);
  }
  assert.deepEqual(frontmatterStatus('---\nstatus: "completed"\n---\n'), { state: 'ok', value: 'completed' });
  assert.deepEqual(frontmatterStatus("---\nstatus: 'completed' # done\n---\n"), { state: 'ok', value: 'completed' });
  assert.deepEqual(frontmatterStatus('---\n# status: in-progress\nstatus: completed\n---\n'), { state: 'ok', value: 'completed' }, 'a commented-out field is not a field');
  assert.deepEqual(frontmatterStatus('# no frontmatter\n\nstatus: completed\n'), { state: 'no-frontmatter' });
  assert.deepEqual(frontmatterStatus('---\ntitle: x\n---\n'), { state: 'no-status', count: 0 });
  assert.deepEqual(frontmatterStatus('---\nstatus: completed\nstatus: in-progress\n---\n'), { state: 'many-status', count: 2 });
  assert.deepEqual(frontmatterStatus('---\nstatus: completed\n'), { state: 'no-frontmatter' }, 'an unclosed block is not frontmatter');

  const globs = await specFileGlobs();
  assert.ok(globs.includes('lightweight-*.md') && globs.includes('phase-spec-*.md') && globs.includes('BUG-*.md'),
    `the spec set derived from lib/doc-shapes.json must hold the lightweight and phase specs (got ${JSON.stringify(globs)})`);
  assert.ok(!globs.includes('_index.md') && !globs.includes('aggregate-design.md'), `_index.md has its own check and aggregate-design.md carries no status (got ${JSON.stringify(globs)})`);
  const help = spawnSync(process.execPath, [dflowBin, 'check-closeout', '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.ok(help.stdout.includes(globs.join(', ')), '--help lists the derived spec set, not a copy of it');
  const main = spawnSync(process.execPath, [dflowBin, '--help'], { encoding: 'utf8' });
  assert.match(main.stdout, /dflow check-closeout/, 'dflow --help lists the subcommand');
}

// --- (2) --staged ---------------------------------------------------------------

// dist issue #5 itself: `git mv`, then the edits, and no `git add` — the `RM`
// state. The index still holds the pre-flip `_index.md` and no closeout row.
// Through the CLI, so the exit code is the process's. Then staged: it passes.
{
  const host = 'SPEC-20260928-001-demo';
  const repo = await newRepo('issue5');
  await writeHost(repo, host);
  commitAll(repo, `open ${host}`);
  await closeOut(repo, host, { stage: false });
  assert.match(git(repo.dir, 'status', '--short'), /^RM /m, 'fixture: this is the RM state #5 reported');
  expectBlocked(runCli(repo.project), '#5 RM state', host, [
    /\[fail\] .*_index\.md says `status: in-progress`/,
    /\[fail\] .*the Checkpoint Log has no closeout row/,
    /\[fail\] .*has changes this commit would leave behind \(1\): not staged: dflow\/specs\/features\/completed\/SPEC-20260928-001-demo\/_index\.md/
  ]);
  git(repo.project, 'add', '--', `${FEATURES}/completed/${host}`);
  expectPass(runCli(repo.project), '#5, staged', [host]);
  expectPass(runCli(repo.project, ['--staged']), '--staged is the default', [host]);
}

// The copy of `_index.md` that `dflow init` projects into a project — the file a
// flow creates a host from. Taken from a real init run, so the fixture is what the
// projection writes, not what this file assumes it writes.
async function projectedIndexTemplate() {
  const dir = join(tempRoot, 'projected');
  await mkdir(dir, { recursive: true });
  const r = spawnSync(process.execPath, [dflowBin, 'init'], { cwd: dir, input: '1\nNode 20, Express 4, Jest\nnone\n1\n2\n1\n1\n1\ny\n', encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, `dflow init failed\n${r.stdout}${r.stderr}`);
  return readFile(join(dir, 'dflow', 'specs', 'shared', 'dflow-workflows', 'templates', '_index.md'), 'utf8');
}
const projected = await projectedIndexTemplate();
const projectedClean = projected.replace(`${init.WORKFLOW_BUNDLE_GENERATED_MARKER}\n\n`, '');
assert.ok(projected.startsWith(`${init.WORKFLOW_BUNDLE_GENERATED_MARKER}\n`) && projectedClean.startsWith('---'),
  'fixture: the projected _index.md starts with the bundle line, and frontmatter follows once it is removed');

// One staged change archiving many hosts, each carrying one case.
{
  const repo = await newRepo('matrix');
  const cases = [
    // Standard shapes: pass.
    { host: 'SPEC-20260928-101-greenfield', expect: 'pass' },
    { host: 'SPEC-20260928-102-brownfield', edition: 'brownfield', expect: 'pass' },
    { host: 'SPEC-20260928-103-skipped', row: '| 2026-09-28 17:00 | closeout | skipped |', expect: 'pass' },
    { host: 'SPEC-20260928-104-crlf', transform: crlf, expect: 'pass' },
    { host: 'SPEC-20260928-105-bom', transform: bom, expect: 'pass' },
    { host: 'SPEC-20260928-106-匯率換算', expect: 'pass' },
    { host: 'SPEC-20260928-107-quoted', edit: (t) => t.replace(/^status: completed/m, 'status: "completed"'), expect: 'pass' },
    // A project's own doc in the host, with a `status:` of its own: not a spec.
    { host: 'SPEC-20260928-108-project-doc', files: { 'review-notes.md': '---\ntitle: review notes\nstatus: ready-for-review\n---\n\nnotes\n' }, expect: 'pass' },
    // A host created from the projected copy with the bundle's own line removed.
    { host: 'SPEC-20260928-109-projected-clean', files: { '_index.md': projectedClean }, expect: 'pass' },
    // ...and with that line left in: the frontmatter under it is not frontmatter,
    // and the failure names the line and the repair.
    { host: 'SPEC-20260928-110-projected', files: { '_index.md': projected },
      expect: [/\[fail\] .*_index\.md: line 1 is `<!-- dflow-generated: workflow-bundle -->`, copied from the template's projected copy/] },
    // Checks 1–5 failing.
    { host: 'SPEC-20260928-111-spec-unflipped', specStatus: 'in-progress', expect: [
      /\[fail\] .*BUG-042-rounding\.md says `status: in-progress` — a spec must say `completed`/,
      /\[fail\] .*lightweight-2026-09-28-fix-rounding\.md says `status: in-progress`/,
      /\[fail\] .*phase-spec-2026-09-28-first\.md says `status: in-progress`/
    ] },
    // Only the template's own placeholder closeout row; and a row still carrying
    // the placeholder timestamp — neither is a closeout that happened.
    { host: 'SPEC-20260928-112-placeholder-only', row: null, expect: [/\[fail\] .*the Checkpoint Log has no closeout row/] },
    { host: 'SPEC-20260928-113-placeholder-time', row: '| {YYYY-MM-DD HH:MM} | closeout | committed |', expect: [/\[fail\] .*the Checkpoint Log has no closeout row/] },
    // What finish-feature Step 4 instruction 3 leaves after a hook refused.
    { host: 'SPEC-20260928-114-failed', row: '| 2026-09-28 17:00 | closeout | failed |', expect: [/\[fail\] .*the closeout row says `failed`/] },
    { host: 'SPEC-20260928-115-copied', copy: true, expect: [/\[fail\] dflow\/specs\/features\/active\/SPEC-20260928-115-copied\/ still has 4 file\(s\) — the host was copied/] },
    { host: 'SPEC-20260928-116-unstaged', afterStage: async (dir) => writeFile(join(dir, 'phase-spec-2026-09-28-first.md'), `${await readFile(join(dir, 'phase-spec-2026-09-28-first.md'), 'utf8')}\nedited after git add\n`),
      expect: [/\[fail\] .*has changes this commit would leave behind \(1\): not staged: dflow\/specs\/features\/completed\/SPEC-20260928-116-unstaged\/phase-spec-2026-09-28-first\.md/] },
    { host: 'SPEC-20260928-117-untracked', afterStage: (dir) => writeFile(join(dir, '筆記.md'), 'left behind\n'),
      expect: [/\(1\): untracked: dflow\/specs\/features\/completed\/SPEC-20260928-117-untracked\/筆記\.md/] },
    // Shapes the gate will not guess about.
    { host: 'SPEC-20260928-121-no-frontmatter', files: { '_index.md': withoutFrontmatter(await template('greenfield', '_index.md')) }, flip: false,
      expect: [/\[uncertain\] .*_index\.md: cannot read its status — it has no frontmatter block/] },
    { host: 'SPEC-20260928-122-two-status', edit: (t) => t.replace(/^status: completed.*$/m, (line) => `${line}\nstatus: completed`),
      expect: [/\[uncertain\] .*_index\.md: cannot read its status — its frontmatter has 2 `status:` fields/] },
    { host: 'SPEC-20260928-123-old-row', row: '| 2026-07-01 10:00 | closeout（/dflow:finish-feature）：status→completed、git mv | committed |',
      expect: [/\[uncertain\] .*a Checkpoint Log row mentions closeout, but not in the template's shape/] },
    { host: 'SPEC-20260928-124-no-log', edit: (t) => t.replace(/^## Checkpoint Log/m, '## Checkpoints'),
      expect: [/\[uncertain\] .*has no `## Checkpoint Log` section/] },
    // Moved and renamed at once: not the flow's shape, so a person confirms it.
    { host: 'SPEC-20260928-125-renamed', target: 'SPEC-20260928-125-renamed-final',
      expect: [unplacedPattern('SPEC-20260928-125-renamed-final')] }
  ];
  for (const c of cases) await writeHost(repo, c.host, c);
  commitAll(repo, 'open every host');
  const active = (c) => join(repo.project, FEATURES, 'active', c.host);
  const archived = (c) => join(repo.project, FEATURES, 'completed', c.target || c.host);
  for (const c of cases) if (c.flip !== false) await flipIndex(active(c));
  const plainMoves = cases.filter((c) => !c.copy && !c.target).map((c) => `${FEATURES}/active/${c.host}`);
  git(repo.project, 'mv', ...plainMoves, `${FEATURES}/completed/`);
  for (const c of cases.filter((c) => c.target)) git(repo.project, 'mv', `${FEATURES}/active/${c.host}`, `${FEATURES}/completed/${c.target}`);
  for (const c of cases.filter((c) => c.copy)) await cp(active(c), archived(c), { recursive: true });
  for (const c of cases) await writeRow(archived(c), c.row === undefined ? ROW : c.row, c.edit);
  git(repo.project, 'add', '--', `${FEATURES}/completed/`);
  for (const c of cases) if (c.afterStage) await c.afterStage(archived(c));

  const result = await runCheck(repo.project);
  assert.equal(result.code, 1, `the matrix holds failing hosts\n${result.out}${result.err}`);
  for (const c of cases) expectHost(result.out, c.target || c.host, c.expect, 'matrix');
  const failing = cases.filter((c) => c.expect !== 'pass').length;
  assert.match(result.out, new RegExp(`^BLOCKED: ${failing} of ${cases.length} newly archived feature directories`, 'm'), `the summary counts the blocked hosts\n${result.out}`);
  assert.doesNotMatch(section(result.out, 'SPEC-20260928-112-placeholder-only'), /\[uncertain\]/, 'the placeholder row is excluded, not read as a row with an unknown Result');
  const cli = runCli(repo.project);
  assert.equal(cli.code, 1, 'the CLI exits 1 on the same tree');
  assert.equal(cli.out, result.out, 'the CLI prints what the in-process run printed');
}

// Out of scope: an edit to an already archived host — even an inconsistent one.
// A rename inside completed/ is not an edit: the new name was never in active/,
// so it is uncertain for a person to confirm, whether git pairs it as R or as D + A.
{
  const host = 'SPEC-20260928-201-archived';
  const repo = await newRepo('already-archived');
  await writeHost(repo, host);
  commitAll(repo, `open ${host}`);
  await closeOut(repo, host, { flip: false });
  git(repo.dir, 'commit', '-q', '-m', 'an inconsistent closeout, committed without the gate');
  await writeFile(join(repo.dir, 'README.md'), 'later\n');
  git(repo.dir, 'commit', '-q', '-am', 'a later commit');
  const index = join(repo.project, FEATURES, 'completed', host, '_index.md');
  await writeFile(index, `${await readFile(index, 'utf8')}\n## Follow-up Tracking\n\n| Follow-up |\n|---|\n| SPEC-20261001-001 |\n`);
  git(repo.dir, 'add', '-A');
  expectNothing(await runCheck(repo.project), 'an edit to an already archived host');
  git(repo.dir, 'commit', '-q', '-m', 'follow-up tracking');
  git(repo.project, 'mv', `${FEATURES}/completed/${host}`, `${FEATURES}/completed/${host}-renamed`);
  expectBlocked(await runCheck(repo.project), 'a rename inside completed/ (R)', `${host}-renamed`, [unplacedPattern(`${host}-renamed`)]);
  git(repo.dir, 'reset', '-q', '--hard');
  git(repo.project, 'rm', '-q', '-r', '--cached', `${FEATURES}/completed/${host}`);
  await rm(join(repo.project, FEATURES, 'completed', host), { recursive: true });
  await mkdir(join(repo.project, FEATURES, 'completed', `${host}-v2`), { recursive: true });
  await writeFile(join(repo.project, FEATURES, 'completed', `${host}-v2`, '_index.md'), 'rewritten beyond rename detection\n');
  git(repo.dir, 'add', '-A');
  assert.match(git(repo.dir, 'status', '--short'), /^A {2}.*-v2\/_index\.md$/m, 'fixture: git pairs this one as D + A, not R');
  expectBlocked(await runCheck(repo.project), 'a rename inside completed/ (D + A)', `${host}-v2`, [unplacedPattern(`${host}-v2`)]);
}

// No arrival is read as a rename. A host moved from `active/` and renamed on the
// way, or a directory created directly in `completed/`, is uncertain even when the
// same change deletes or renames an unrelated archive — exactly the change a
// rename rule would wave through. A normal closeout beside a rename is still
// checked on its own.
{
  const old = 'SPEC-20260101-001-old';
  const moved = 'SPEC-20260928-251-moved';
  const other = 'SPEC-20260928-252-other';
  const direct = 'SPEC-20260928-254-direct';
  const repo = await newRepo('no-rename-rule');
  await writeHost(repo, moved);
  await writeHost(repo, other);
  const archive = join(repo.project, FEATURES, 'completed', old);
  await mkdir(archive, { recursive: true });
  await writeFile(join(archive, '_index.md'), withLogRow(flipped(await template('greenfield', '_index.md'), 'old'), ROW, 'old'));
  commitAll(repo, 'an old archive and two open hosts');
  git(repo.project, 'mv', `${FEATURES}/active/${moved}`, `${FEATURES}/completed/${moved}-renamed`);
  git(repo.project, 'rm', '-q', '-r', '--', `${FEATURES}/completed/${old}`);
  expectBlocked(await runCheck(repo.project), 'moved and renamed, beside an unrelated deletion', `${moved}-renamed`, [unplacedPattern(`${moved}-renamed`)]);
  git(repo.dir, 'reset', '-q', '--hard');
  // One for one: an unrelated archive deleted, and an in-progress host created
  // directly in completed/.
  git(repo.project, 'rm', '-q', '-r', '--', `${FEATURES}/completed/${old}`);
  const directDir = join(repo.project, FEATURES, 'completed', direct);
  await mkdir(directDir, { recursive: true });
  await writeFile(join(directDir, '_index.md'), await template('greenfield', '_index.md'));
  git(repo.dir, 'add', '-A');
  expectBlocked(await runCheck(repo.project), 'created directly in completed/, beside an unrelated deletion', direct, [unplacedPattern(direct)]);
  git(repo.dir, 'reset', '-q', '--hard');
  await rm(directDir, { recursive: true, force: true });
  // An archive renamed beside a normal closeout: the closeout passes on its own,
  // and the renamed archive is asked about.
  git(repo.project, 'mv', `${FEATURES}/completed/${old}`, `${FEATURES}/completed/${old}-renamed`);
  await closeOut(repo, other);
  const beside = await runCheck(repo.project);
  assert.equal(beside.code, 1, `an archive rename beside a normal closeout: expected exit 1\n${beside.out}${beside.err}`);
  expectHost(beside.out, other, 'pass', 'an archive rename beside a normal closeout');
  expectHost(beside.out, `${old}-renamed`, [unplacedPattern(`${old}-renamed`)], 'an archive rename beside a normal closeout');
}
{
  const old = 'SPEC-20260101-001-old';
  const moved = 'SPEC-20260928-253-moved';
  const direct = 'SPEC-20260928-255-direct';
  const repo = await newRepo('no-rename-rule-range');
  const archive = join(repo.project, FEATURES, 'completed', old);
  await mkdir(archive, { recursive: true });
  await writeFile(join(archive, '_index.md'), withLogRow(flipped(await template('greenfield', '_index.md'), 'old'), ROW, 'old'));
  commitAll(repo, 'an old archive');
  git(repo.dir, 'switch', '-q', '-c', 'feature');
  await writeHost(repo, moved);
  commitAll(repo, `open ${moved}`);
  git(repo.project, 'mv', `${FEATURES}/active/${moved}`, `${FEATURES}/completed/${moved}-renamed`);
  git(repo.project, 'rm', '-q', '-r', '--', `${FEATURES}/completed/${old}`);
  git(repo.dir, 'commit', '-q', '-m', 'moved and renamed, and an old archive deleted');
  expectBlocked(await runCheck(repo.project, ['--range', 'main..feature']), '--range, moved and renamed beside an unrelated deletion', `${moved}-renamed`, [unplacedPattern(`${moved}-renamed`)]);
  // One for one in a range: another branch deletes the old archive and creates an
  // in-progress host directly in completed/.
  git(repo.dir, 'switch', '-q', '-c', 'direct', 'main');
  git(repo.project, 'rm', '-q', '-r', '--', `${FEATURES}/completed/${old}`);
  const directDir = join(repo.project, FEATURES, 'completed', direct);
  await mkdir(directDir, { recursive: true });
  await writeFile(join(directDir, '_index.md'), await template('greenfield', '_index.md'));
  commitAll(repo, 'an old archive deleted, a host created directly in completed/');
  expectBlocked(await runCheck(repo.project, ['--range', 'main..direct']), '--range, created directly in completed/ beside an unrelated deletion', direct, [unplacedPattern(direct)]);
}

// Amending the closeout commit: the host HEAD itself archived stays in scope
// with nothing staged, so a message-only amend is checked — a consistent one
// passes, an inconsistent one committed without the gate is caught. A host an
// EARLIER commit archived is not re-checked.
{
  const first = 'SPEC-20260928-301-first';
  const second = 'SPEC-20260928-302-second';
  const repo = await newRepo('amend');
  await writeHost(repo, first);
  await writeHost(repo, second);
  commitAll(repo, 'open two hosts');
  await closeOut(repo, first);
  git(repo.dir, 'commit', '-q', '-m', `closeout ${first}`);
  expectPass(await runCheck(repo.project), 'a message-only amend of a consistent closeout', [first]);
  await closeOut(repo, second, { row: '| 2026-09-28 17:00 | closeout | failed |' });
  git(repo.dir, 'commit', '-q', '-m', `closeout ${second}, committed without the gate`);
  const amend = await runCheck(repo.project);
  expectBlocked(amend, 'a message-only amend of an inconsistent closeout', second, [/\[fail\] .*the closeout row says `failed`/]);
  assert.ok(!amend.out.includes(`completed/${first}/`), `a host an earlier commit archived is out of scope\n${amend.out}`);
}

// HEAD is a merge commit: the hosts it brought in are not re-checked, so someone
// else's archive does not block your next commit.
// ⚠ The host is opened on main, so main's side of the merge still has it in
// `active/`. That is what makes this case able to fail: judged against the
// merge's FIRST parent, the host reads as archived by HEAD and comes into scope.
// Opened on the branch instead, it would be out of scope against either parent,
// and a gate that forgot the merge rule would still pass here.
{
  const host = 'SPEC-20260928-401-merged';
  const repo = await newRepo('merge');
  await writeHost(repo, host);
  commitAll(repo, `open ${host} on main`);
  git(repo.dir, 'switch', '-q', '-c', 'feature');
  await closeOut(repo, host, { flip: false });
  git(repo.dir, 'commit', '-q', '-m', 'an inconsistent closeout on a branch');
  git(repo.dir, 'switch', '-q', 'main');
  await writeFile(join(repo.dir, 'README.md'), 'main moved on\n');
  git(repo.dir, 'commit', '-q', '-am', 'main');
  git(repo.dir, 'merge', '-q', '--no-ff', '-m', 'merge feature', 'feature');
  expectNothing(await runCheck(repo.project), 'HEAD is a merge commit');
}

// A Dflow project below the repository root (a monorepo).
{
  const host = 'SPEC-20260928-501-mono';
  const repo = await newRepo('monorepo', 'apps/web');
  await writeHost(repo, host);
  commitAll(repo, `open ${host}`);
  await closeOut(repo, host, { stage: false });
  expectBlocked(await runCheck(repo.project), 'monorepo, RM state', host, [
    /\[fail\] dflow\/specs\/features\/completed\/SPEC-20260928-501-mono\/_index\.md says `status: in-progress`/,
    /\[fail\] .*the Checkpoint Log has no closeout row/,
    /\(1\): not staged: dflow\/specs\/features\/completed\/SPEC-20260928-501-mono\/_index\.md/
  ]);
  git(repo.project, 'add', '--', `${FEATURES}/completed/${host}`);
  expectPass(await runCheck(repo.project), 'monorepo, staged', [host]);
}

// The first commit of a repository: no HEAD, so the empty tree is "before", and
// a host that never was in `active/` reads as uncertain rather than passing.
{
  const repo = await newRepo('unborn');
  const dir = join(repo.project, FEATURES, 'completed', 'SPEC-20260928-601-first');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, '_index.md'), withLogRow(flipped(await template('greenfield', '_index.md'), 'unborn'), ROW, 'unborn'));
  git(repo.dir, 'add', '-A');
  expectBlocked(await runCheck(repo.project), 'no commit yet', 'SPEC-20260928-601-first', [/\[uncertain\] .*is new, but was never in /]);
}

// Cannot run: exit 1, on stderr.
{
  const repo = await newRepo('cannot-run');
  commitAll(repo, 'init');
  const cases = [
    [['--bogus'], /Unsupported check-closeout option: --bogus/],
    [['--range', 'main'], /--range needs <base>\.\.<head>/],
    [['--range'], /--range needs <base>\.\.<head>/],
    [['--staged', '--range', 'main..main'], /cannot be combined/],
    [['--range', 'main..main', '--range', 'main..main'], /only once/],
    [['--range', 'main...main'], /--range needs <base>\.\.<head>/],
    [['--range', 'main..no-such-branch'], /"no-such-branch" is not a commit in this repository/]
  ];
  for (const [args, pattern] of cases) {
    const r = await runCheck(repo.dir, args);
    assert.equal(r.code, 1, `${args.join(' ')} must exit 1`);
    assert.match(r.err, pattern, `${args.join(' ')}: ${r.err}`);
  }
  await mkdir(join(repo.dir, 'elsewhere'), { recursive: true });
  const noSpecs = runCli(join(repo.dir, 'elsewhere'));
  assert.equal(noSpecs.code, 1, 'no dflow/specs/ here: the CLI exits 1');
  assert.match(noSpecs.err, /No dflow\/specs\/ directory in /);
  const plain = join(tempRoot, 'not-a-repo');
  await mkdir(join(plain, 'dflow', 'specs'), { recursive: true });
  const noRepo = await runCheck(plain);
  assert.equal(noRepo.code, 1);
  assert.match(noRepo.err, /is not inside a git work tree/);

  // A package whose spec registry is damaged — missing, empty, or missing only some
  // templates' entries, which still parses — stops the gate rather than pass
  // without check 3. The registry is judged by doctor's own integrity rules. (And
  // `dflow doctor` still starts on such a package: `test/doc-shapes.mjs` deletes the
  // registry and asserts it.)
  const shipped = JSON.parse(await readFile(join(repoRoot, 'lib', 'doc-shapes.json'), 'utf8'));
  const withoutPhaseSpecs = { ...shipped, templates: Object.fromEntries(Object.entries(shipped.templates).filter(([key]) => !key.endsWith('/phase-spec.md'))) };
  assert.ok(Object.keys(withoutPhaseSpecs.templates).length === Object.keys(shipped.templates).length - 2, 'fixture: both tracks\' phase-spec entries removed');
  for (const [label, registry, pattern] of [
    ['package-no-registry', null, /The installed dflow package looks incomplete: `lib\/doc-shapes\.json` could not be read/],
    ['package-empty-registry', '{"templates":{}}', /The installed dflow package looks incomplete: .*`templates\/greenfield\/templates\/_index\.md` is a template the shape check covers, but `lib\/doc-shapes\.json` has no entry for it/],
    ['package-partial-registry', JSON.stringify(withoutPhaseSpecs), /The installed dflow package looks incomplete: .*`templates\/greenfield\/templates\/phase-spec\.md` is a template the shape check covers, but `lib\/doc-shapes\.json` has no entry for it/]
  ]) {
    const pkg = join(tempRoot, label);
    await cp(join(repoRoot, 'lib'), join(pkg, 'lib'), { recursive: true });
    await cp(join(repoRoot, 'templates'), join(pkg, 'templates'), { recursive: true });
    await cp(join(repoRoot, 'package.json'), join(pkg, 'package.json'));
    if (registry === null) await rm(join(pkg, 'lib', 'doc-shapes.json'));
    else await writeFile(join(pkg, 'lib', 'doc-shapes.json'), registry);
    const damaged = createRequire(import.meta.url)(join(pkg, 'lib', 'closeout-check.js'));
    let err = '';
    const code = await damaged.runCheckCloseout({ cwd: repo.dir, args: [], stdout: { write() {} }, stderr: { write: (text) => { err += text; } } });
    assert.equal(code, 1, `${label}: exit 1`);
    assert.match(err, pattern, `${label}: ${err}`);
  }
  checked += 1;
}

// A commit whose `features/` tree git cannot read is an error, never an empty
// `features/` that takes every host out of scope and passes.
{
  const host = 'SPEC-20260928-651-tree';
  const repo = await newRepo('missing-tree');
  await writeHost(repo, host);
  commitAll(repo, `open ${host}`);
  await closeOut(repo, host);
  const tree = git(repo.dir, 'rev-parse', `HEAD:${FEATURES}`).trim();
  const object = join(repo.dir, '.git', 'objects', tree.slice(0, 2), tree.slice(2));
  assert.ok(existsSync(object), 'fixture: the tree is a loose object');
  await chmod(object, 0o666);
  await rm(object);
  const r = await runCheck(repo.project);
  assert.equal(r.code, 1, `an unreadable tree must exit 1\n${r.out}${r.err}`);
  assert.match(r.err, /git ls-tree -r -z \S+ -- dflow\/specs\/features\/ failed/, r.err);
  checked += 1;
}

// --- (3) --range ----------------------------------------------------------------

// The final state of <head> is what counts: a closeout repaired by a later commit
// on the branch passes, while the range ending at the broken commit does not.
// The branch opens its host too, so at the merge base there is no
// `active/<host>/` — the ordinary merge request — and it is still recognised as
// moved. A directory that was never in `active/` is not.
{
  const host = 'SPEC-20260928-701-range';
  const repo = await newRepo('range');
  commitAll(repo, 'init');
  git(repo.dir, 'switch', '-q', '-c', 'feature');
  await writeHost(repo, host);
  commitAll(repo, `open ${host}`);
  await closeOut(repo, host, { flip: false });
  git(repo.dir, 'commit', '-q', '-m', 'closeout with the status flip missed');
  const broken = git(repo.dir, 'rev-parse', 'HEAD').trim();
  const index = join(repo.project, FEATURES, 'completed', host, '_index.md');
  await writeFile(index, flipped(await readFile(index, 'utf8'), 'range fix'));
  git(repo.dir, 'commit', '-q', '-am', 'fix the closeout');
  assert.notEqual(spawnSync('git', ['cat-file', '-e', `main:${FEATURES}/active/${host}`], { cwd: repo.dir }).status, 0, 'fixture: the merge base has no active/ host');
  expectBlocked(await runCheck(repo.project, ['--range', `main..${broken}`]), '--range ending at the broken closeout', host, [/\[fail\] .*_index\.md says `status: in-progress`/]);
  expectPass(runCli(repo.project, ['--range', 'main..feature']), '--range, repaired by a later commit', [host]);
  expectPass(await runCheck(repo.project, ['--range=main..feature']), '--range=<value>', [host]);
  expectNothing(await runCheck(repo.project, ['--range', 'feature..feature']), '--range with nothing new');
  // No working-tree check in a range: an untracked leftover is not part of <head>.
  await writeFile(join(repo.project, FEATURES, 'completed', host, 'scratch.md'), 'local only\n');
  expectPass(await runCheck(repo.project, ['--range', 'main..feature']), '--range ignores the working tree', [host]);
  await rm(join(repo.project, FEATURES, 'completed', host, 'scratch.md'));
  const direct = join(repo.project, FEATURES, 'completed', 'SPEC-20260928-702-direct');
  await mkdir(direct, { recursive: true });
  await writeFile(join(direct, '_index.md'), withLogRow(flipped(await template('greenfield', '_index.md'), 'direct'), ROW, 'direct'));
  commitAll(repo, 'a host created directly in completed/');
  expectBlocked(await runCheck(repo.project, ['--range', 'main..feature']), '--range, a directory never in active/', 'SPEC-20260928-702-direct', [/\[uncertain\] .*SPEC-20260928-702-direct\/ is new, but was never in /]);
}

// --- (4) the pre-commit hook template ---------------------------------------------

// The script is read out of the docs, so what is tested is what adopters copy.
// Both languages must carry the same script.
async function hookScript(file) {
  const text = await readFile(join(repoRoot, 'docs', file), 'utf8');
  const blocks = [...text.matchAll(/```sh\n(#!\/bin\/sh\n# dflow check-closeout pre-commit hook[\s\S]*?)```/g)];
  assert.equal(blocks.length, 1, `docs/${file} must carry exactly one pre-commit hook template`);
  return blocks[0][1];
}
const hook = await hookScript('closeout-check.en.md');
assert.equal(await hookScript('closeout-check.md'), hook, 'docs/closeout-check.md and docs/closeout-check.en.md must carry the same hook script');

// A `dflow` stand-in on PATH that records each call and then runs this CLI.
const shimDir = join(tempRoot, 'shim');
await mkdir(shimDir, { recursive: true });
const callLog = join(tempRoot, 'dflow-calls.log');
const posix = (p) => p.replace(/\\/g, '/');
await writeFile(join(shimDir, 'dflow'), `#!/bin/sh\necho "$*" >> "${posix(callLog)}"\nexec "${posix(process.execPath)}" "${posix(dflowBin)}" "$@"\n`);
await chmod(join(shimDir, 'dflow'), 0o755);
const withShim = { ...process.env, PATH: `${shimDir}${delimiter}${process.env.PATH}` };
const calls = async () => (await readFile(callLog, 'utf8').catch(() => '')).split('\n').filter(Boolean).length;

function commit(cwd, env, ...args) {
  return spawnSync('git', ['commit', '-q', ...args], { cwd, env, encoding: 'utf8' });
}

async function installHook(repo, script) {
  await mkdir(join(repo.dir, '.git', 'hooks'), { recursive: true });
  const file = join(repo.dir, '.git', 'hooks', 'pre-commit');
  await writeFile(file, script);
  await chmod(file, 0o755);
}

// Can this machine run a git hook at all? Probe with a hook that only writes a
// file. If it cannot, the hook tests are reported as NOT RUN — never as passed.
const probe = await newRepo('hook-probe');
await installHook(probe, '#!/bin/sh\necho ran > .git/hook-probe\n');
commit(probe.dir, withShim, '--allow-empty', '-m', 'probe');
const hooksRun = await readFile(join(probe.dir, '.git', 'hook-probe'), 'utf8').then(() => true, () => false);

if (!hooksRun) {
  process.stdout.write('closeout-check: NOT RUN — the pre-commit hook template tests (git could not run a hook on this machine). They are not counted as passed.\n');
} else {
  const host = 'SPEC-20260928-801-hook';
  const repo = await newRepo('hook');
  commitAll(repo, 'init');
  await installHook(repo, hook);
  await writeFile(callLog, '');

  // An ordinary commit does not start the CLI.
  await writeHost(repo, host);
  git(repo.dir, 'add', '-A');
  assert.equal(commit(repo.dir, withShim, '-m', `open ${host}`).status, 0);
  assert.equal(await calls(), 0, 'an ordinary commit must not start the CLI');

  // #5's RM state: the hook calls the CLI, and the commit is refused.
  await closeOut(repo, host, { stage: false });
  const refused = commit(repo.dir, withShim, '-m', 'closeout');
  assert.notEqual(refused.status, 0, `the hook must refuse #5's RM state\n${refused.stdout}${refused.stderr}`);
  assert.match(`${refused.stdout}${refused.stderr}`, /BLOCKED: /);
  assert.equal(await calls(), 1, 'the closeout commit starts the CLI');

  // Staged properly: the commit goes through.
  git(repo.project, 'add', '--', `${FEATURES}/completed/${host}`);
  const accepted = commit(repo.dir, withShim, '-m', 'closeout');
  assert.equal(accepted.status, 0, `a standard closeout commits\n${accepted.stdout}${accepted.stderr}`);
  assert.equal(await calls(), 2);

  // A message-only amend still reaches the gate.
  assert.equal(commit(repo.dir, withShim, '--amend', '-m', 'closeout, reworded').status, 0);
  assert.equal(await calls(), 3, 'a message-only amend of the closeout commit must still start the CLI');

  // The documented cost: the commit after a closeout starts it once more; the
  // one after that does not.
  await writeFile(join(repo.dir, 'README.md'), 'after closeout\n');
  assert.equal(commit(repo.dir, withShim, '-am', 'after').status, 0);
  assert.equal(await calls(), 4, 'the commit after a closeout re-checks the host');
  await writeFile(join(repo.dir, 'README.md'), 'later still\n');
  assert.equal(commit(repo.dir, withShim, '-am', 'later').status, 0);
  assert.equal(await calls(), 4, 'the commit after that does not');

  // The first commit of a repository takes the empty tree as "before".
  const first = await newRepo('hook-first-commit');
  await installHook(first, hook);
  const early = join(first.project, FEATURES, 'completed', 'SPEC-20260928-802-early');
  await mkdir(early, { recursive: true });
  await writeFile(join(early, '_index.md'), 'no frontmatter\n');
  git(first.dir, 'add', '-A');
  const firstCommit = commit(first.dir, withShim, '-m', 'first');
  assert.notEqual(firstCommit.status, 0, `the first commit is checked too\n${firstCommit.stdout}${firstCommit.stderr}`);
  assert.equal(await calls(), 5);

  // A project below the repository root: the template's `cd` line, uncommented.
  const mono = await newRepo('hook-monorepo', 'apps/web');
  commitAll(mono, 'init');
  const cdLine = /^# cd path\/to\/project \|\| exit 1$/m;
  assert.match(hook, cdLine, 'the template carries the commented cd line for a project below the root');
  await installHook(mono, hook.replace(cdLine, 'cd apps/web || exit 1'));
  const monoHost = 'SPEC-20260928-803-mono';
  await writeHost(mono, monoHost);
  git(mono.dir, 'add', '-A');
  assert.equal(commit(mono.dir, withShim, '-m', `open ${monoHost}`).status, 0);
  assert.equal(await calls(), 5, 'monorepo: an ordinary commit does not start the CLI');
  await closeOut(mono, monoHost, { stage: false });
  assert.notEqual(commit(mono.dir, withShim, '-m', 'closeout').status, 0, 'monorepo: the RM state is refused');
  git(mono.project, 'add', '--', `${FEATURES}/completed/${monoHost}`);
  assert.equal(commit(mono.dir, withShim, '-m', 'closeout').status, 0, 'monorepo: the staged closeout commits');
  assert.equal(await calls(), 7);
  checked += 1;

  // No `dflow` on PATH: one line, and the commit goes through. A maintainer's
  // PATH usually has a real `dflow`, so the directories holding one are taken off
  // for this case; if one is still found, the case is reported as NOT RUN and is
  // not counted.
  const dflowNames = ['dflow', 'dflow.cmd', 'dflow.ps1', 'dflow.exe'];
  const noDflowPath = process.env.PATH.split(delimiter).filter((dir) => dir && !dflowNames.some((name) => existsSync(join(dir, name)))).join(delimiter);
  const noDflow = { ...process.env, PATH: noDflowPath };
  const found = spawnSync('sh', ['-c', 'command -v dflow'], { env: noDflow, encoding: 'utf8' });
  if (found.error || found.status === 0) {
    process.stdout.write('closeout-check: NOT RUN — the "no dflow on PATH" hook case (a dflow CLI could not be taken off PATH here). It is not counted as passed.\n');
  } else {
    const bare = await newRepo('hook-no-cli');
    commitAll(bare, 'init');
    await installHook(bare, hook);
    const bareHost = 'SPEC-20260928-804-bare';
    await writeHost(bare, bareHost);
    commitAll(bare, `open ${bareHost}`);
    await closeOut(bare, bareHost, { stage: false });
    const noCli = commit(bare.dir, noDflow, '-m', 'closeout');
    assert.equal(noCli.status, 0, `with no dflow on PATH the hook lets the commit through\n${noCli.stdout}${noCli.stderr}`);
    assert.match(noCli.stderr, /dflow check-closeout skipped/, 'and says so');
    checked += 1;
  }
}

await rm(tempRoot, { recursive: true, force: true });
process.stdout.write(`closeout-check: ${checked} cases passed across ${repoCount} temporary repositories.\n`);
