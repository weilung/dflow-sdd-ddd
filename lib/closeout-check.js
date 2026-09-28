'use strict';

// PROPOSAL-105 — `dflow check-closeout`, the closeout gate a pre-commit hook or a
// CI job runs (dist issue #5). It answers one question with its exit code: did
// this change archive a feature directory into `features/completed/` in a state
// the record contradicts — the directory moved while the `_index.md` inside it
// still said `in-progress`, a copy left behind in `active/`, no closeout row?
//
// ⚠ Why this is not a `dflow doctor` check: doctor exits 0 by design (it reports
// by exception, and projects already run it in CI), and it reads the working
// tree — the one side #5's symptom does not show on. There the working tree was
// right and the index was stale. So this reads git objects: the index for
// `--staged`, `<head>`'s tree for `--range`. The working tree is read once, by
// check 5, and nothing is ever written.
//
// ⚠ What it does NOT check is stated in `dflow check-closeout --help` and in
// `docs/closeout-check.md` / `.en.md`: the rest of finish-feature Step 4's
// post-commit verification needs the closeout baseline and judgement, and stays
// with the AI and pr-review. Passing here does not mean the closeout is clean.
//
// A pre-commit hook runs this on every closeout commit, so the number of git
// processes is kept down on purpose (each costs tens of milliseconds on Windows):
// one `rev-parse` for the project, one listing per tree, one `cat-file --batch`
// for every file read, one `git status` for every archived directory.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const pkg = require('../package.json');
const doctorChecks = require('./doctor-checks');
const { readDocShapesRegistry, WORKFLOW_BUNDLE_GENERATED_MARKER } = require('./init');

const FEATURES_REL = 'dflow/specs/features';

// A mutable `blob/main` pointer, like doctor's uncertainty page, so the page
// inherits PROPOSAL-081's evergreen contract (MAINTAINERS.md § README Language
// Strategy): it must stay usable by every published CLI that prints this line.
const CLOSEOUT_CHECK_DOC_URL = 'https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/closeout-check.en.md';

// Built from its code point: a literal byte-order mark in source is invisible in
// a diff and an editor may drop it.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

class GateError extends Error {}

// Which files in a host are specs, derived rather than listed: a template
// registered under `features/active/*/` whose skeleton carries a `status` field.
// Today that is the lightweight spec (`lightweight-*.md`, `BUG-*.md`) and the
// phase spec; greenfield's `aggregate-design.md` has no `status`, so it is not
// one. `_index.md` is left to check 1, which says more about it. A doc a project
// adds to a host is not a spec, whether or not it carries `status:` — the
// measured case is a project doc whose `status:` is `ready…`.
// ⚠ Any registered shape counts, not only the newest: if a later shape drops the
// field, a spec without it reads as uncertain here instead of going unchecked.
// ⚠ The registry is read, and trusted, by doctor's own rules (`readDocShapesRegistry`
// in `lib/init.js`): valid JSON is not enough — a registry that lost one template's
// entry still parses, and would drop that template's specs out of check 3. A
// damaged package stops the gate; passing without check 3 would be a silent pass.
// ⚠ Read when the gate runs, never when this module loads: `bin/dflow.js` loads
// this module only for `check-closeout`, and `dflow doctor` has to start on a
// damaged package and report it (PROPOSAL-092).
let specFileGlobCache = null;
async function specFileGlobs() {
  if (specFileGlobCache) return specFileGlobCache;
  const damaged = (why) => new GateError(`The installed dflow package looks incomplete: ${why}. The gate cannot tell which files in a host are specs. Reinstall dflow (e.g. \`npm install -g dflow-sdd-ddd@latest\`, or re-link your local checkout); this is a problem with the installed package, not with your project.`);
  const { registry, packageDamage } = await readDocShapesRegistry();
  if (!registry) throw damaged(packageDamage.join('; '));
  const globs = new Set();
  for (const entry of Object.values(registry.templates)) {
    const carriesStatus = entry.shapes.some((shape) => shape.skeleton.some(
      (item) => item[0] === 'field' && item[1] === 'status' && item.length === 2
    ));
    if (!carriesStatus) continue;
    for (const pattern of entry.paths) {
      const match = /^features\/active\/\*\/([^/]+)$/.exec(pattern);
      if (match && match[1] !== '_index.md') globs.add(match[1]);
    }
  }
  if (globs.size === 0) throw damaged('`lib/doc-shapes.json` names no template under `features/active/*/` that carries a `status` field');
  specFileGlobCache = [...globs].sort();
  return specFileGlobCache;
}

function parseArgs(args) {
  let mode = null;
  let range = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--staged') {
      if (mode === 'range') throw new GateError('--staged and --range cannot be combined.');
      mode = 'staged';
      continue;
    }
    if (arg === '--range' || arg.startsWith('--range=')) {
      if (mode === 'staged') throw new GateError('--staged and --range cannot be combined.');
      if (mode === 'range') throw new GateError('--range can be given only once.');
      let value;
      if (arg === '--range') {
        i += 1;
        value = i < args.length ? args[i] : '';
      } else {
        value = arg.slice('--range='.length);
      }
      // `A..B` only. `A...B` would mean the same here (the range is always taken
      // from the merge base), but accepting it means documenting two spellings of
      // one thing; refusing it costs the caller one character.
      const match = /^([^.].*?)\.\.([^.].*)$/.exec(value);
      if (!match || match[1].endsWith('.') || match[2].includes('..')) {
        throw new GateError(`--range needs <base>..<head> (two commits joined by two dots), got ${JSON.stringify(value)}.`);
      }
      mode = 'range';
      range = { base: match[1], head: match[2] };
      continue;
    }
    throw new GateError(`Unsupported check-closeout option: ${arg}`);
  }
  return mode === 'range' ? { mode, ...range } : { mode: 'staged' };
}

// Every git call goes through here.
// ⚠ `GIT_LITERAL_PATHSPECS`: a host directory name is user text, and `[`, `*` or
// `:(` in it must not turn a path into a pattern.
// ⚠ `GIT_OPTIONAL_LOCKS=0`: inside a pre-commit hook `git commit` holds the index
// lock, and `git status` would otherwise try to refresh the index it is reading.
// ⚠ Output stays bytes and is decoded as UTF-8 by the callers: with `-z` git
// prints path names raw, and a host name can be Chinese.
// The index a hook sees is `GIT_INDEX_FILE`, which `git commit` sets (to a path
// relative to the repository root on a plain commit — git resolves it after
// moving to the root, so running from anywhere inside the repository is safe);
// it reaches these calls because the environment is passed through.
function runGit(cwd, args, input) {
  const result = spawnSync('git', args, {
    cwd,
    input,
    env: { ...process.env, GIT_LITERAL_PATHSPECS: '1', GIT_OPTIONAL_LOCKS: '0' },
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) {
    if (result.error.code === 'ENOENT') throw new GateError('git was not found on PATH; dflow check-closeout reads the repository through it.');
    throw result.error;
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr.toString('utf8').trim() };
}

function gitOut(cwd, args, input) {
  const result = runGit(cwd, args, input);
  if (result.status !== 0) {
    throw new GateError(`git ${args.join(' ')} failed${result.stderr ? `: ${result.stderr}` : '.'}`);
  }
  return result.stdout;
}

function zRecords(buffer) {
  return buffer.toString('utf8').split('\0').filter((record) => record !== '');
}

function firstLine(buffer) {
  return buffer.toString('utf8').replace(/\r?\n[\s\S]*$/, '');
}

async function locateProject(cwd) {
  let stat = null;
  try {
    stat = await fs.stat(path.join(cwd, 'dflow', 'specs'));
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
  }
  if (!stat || !stat.isDirectory()) {
    throw new GateError(`No dflow/specs/ directory in ${cwd}. Run dflow check-closeout from the directory that holds dflow/specs/ — when the Dflow project is not at the repository root, cd into it first.`);
  }
  const located = runGit(cwd, ['rev-parse', '--show-toplevel', '--show-prefix']);
  if (located.status !== 0) {
    throw new GateError(`${cwd} is not inside a git work tree${located.stderr ? ` (${located.stderr})` : ''}. dflow check-closeout reads the commit being made, so it needs the repository.`);
  }
  // The project can sit below the repository root (a monorepo); every path below
  // is repository-relative, so the project's own position is the prefix. An
  // empty second line is a project at the root.
  const [toplevel, prefix = ''] = located.stdout.toString('utf8').split('\n');
  return { toplevel, projectPrefix: prefix, featuresRel: `${prefix}${FEATURES_REL}` };
}

function resolveCommit(ctx, rev, label) {
  const result = runGit(ctx.toplevel, ['rev-parse', '--verify', '-q', '--end-of-options', `${rev}^{commit}`]);
  if (result.status !== 0) {
    throw new GateError(`${label} ${JSON.stringify(rev)} is not a commit in this repository. In CI this is usually a shallow clone: fetch the full history (GitLab: GIT_DEPTH: 0; GitHub Actions: fetch-depth: 0).`);
  }
  return firstLine(result.stdout);
}

// `path -> blob id` for every file under `features/` in a commit, keyed relative
// to `features/` (`completed/<host>/_index.md`). A commit with no `features/`
// tree gives an empty map, so the first archive in a project is still in scope.
// ⚠ Only a MISSING path reads as empty. The commit is listed from its root with
// the path as a filter: a path the commit does not have prints nothing and
// succeeds, while a tree git cannot read fails. (Listing `<commit>:<path>` fails
// in both cases, and a probe of that path cannot tell a missing path from a
// missing object either — an empty map standing in for a tree git could not read
// takes every host out of scope and passes.)
function commitFeatures(ctx, commit) {
  const files = new Map();
  if (!commit) return files;
  const lead = `${ctx.featuresRel}/`;
  for (const record of zRecords(gitOut(ctx.toplevel, ['ls-tree', '-r', '-z', commit, '--', lead]))) {
    const tab = record.indexOf('\t');
    const [, kind, oid] = record.slice(0, tab).split(' ');
    const file = record.slice(tab + 1);
    if (kind === 'blob' && file.startsWith(lead)) files.set(file.slice(lead.length), oid);
  }
  return files;
}

// The same map for the index: what `git commit` is about to record. Only stage-0
// entries — git refuses to commit while a path is unmerged, so there is nothing
// to judge until the conflict is resolved.
function indexFeatures(ctx) {
  const files = new Map();
  const lead = `${ctx.featuresRel}/`;
  for (const record of zRecords(gitOut(ctx.toplevel, ['ls-files', '--stage', '-z', '--', lead]))) {
    const tab = record.indexOf('\t');
    const [, oid, stage] = record.slice(0, tab).split(' ');
    const file = record.slice(tab + 1);
    if (stage === '0' && file.startsWith(lead)) files.set(file.slice(lead.length), oid);
  }
  return files;
}

// Directory names under `completed/` (or `active/`) that hold at least one file.
// A file directly under `completed/` — the `.gitkeep` `dflow init` writes — is
// not a host.
function hostDirs(files, area) {
  const dirs = new Set();
  const lead = `${area}/`;
  for (const file of files) {
    if (!file.startsWith(lead)) continue;
    const slash = file.indexOf('/', lead.length);
    if (slash > lead.length) dirs.add(file.slice(lead.length, slash));
  }
  return dirs;
}

// D1's scope: a directory with files under `completed/` after the change and
// none before. Only whether the directory has files on either side counts, never
// whether git pairs its files as `R` or as `D` + `A` — git pairs a rename by
// content similarity, so a small file edited heavily comes out as `D` + `A`.
//   1. the host was in `active/` under the same name -> newly archived: check it.
//      "Was in" is `wasActive`: the `active/` directories of the before side,
//      plus, for a range, every one a commit in the range touched.
//   2. otherwise -> uncertain. The flow moves a host out of `active/` without
//      renaming it, so a directory renamed on the way, one created directly in
//      `completed/`, and an archived host renamed inside `completed/` all land
//      here: the gate does not guess which of these it is, and a person confirms.
function newArchives(before, after, wasActive) {
  const beforeCompleted = hostDirs(before.keys(), 'completed');
  const appeared = [...hostDirs(after.keys(), 'completed')].filter((dir) => !beforeCompleted.has(dir)).sort();
  return {
    archived: appeared.filter((dir) => wasActive.has(dir)),
    unplaced: appeared.filter((dir) => !wasActive.has(dir))
  };
}

// `--staged`: after = the index; before = HEAD, or the empty tree before the
// first commit. ⚠ The hosts HEAD itself archived are in scope too, judged by
// rule 1 alone against HEAD's parent. A pre-commit hook cannot tell `git commit
// --amend` from a new commit, and a minimal host repairs its closeout commit
// exactly by re-adding and amending (finish-feature Step 4); compared with HEAD
// alone, a host already in HEAD would never be checked on that amend. The cost:
// the commit after a closeout checks that host once more, and passes when it is
// still consistent. Not for a merge commit — a host someone else archived and
// merged in would block your next commit.
function stagedScope(ctx) {
  const after = indexFeatures(ctx);
  let head = null;
  let parent = null;
  const revs = runGit(ctx.toplevel, ['rev-list', '--parents', '-n', '1', 'HEAD', '--']);
  if (revs.status === 0) {
    const [commit, ...parents] = firstLine(revs.stdout).split(' ');
    head = commit;
    if (parents.length === 1) parent = parents[0];
  } else if (runGit(ctx.toplevel, ['rev-parse', '--verify', '-q', 'HEAD']).status === 0) {
    throw new GateError(`git rev-list --parents -n 1 HEAD failed${revs.stderr ? `: ${revs.stderr}` : '.'}`);
  }
  const headFiles = commitFeatures(ctx, head);
  const current = newArchives(headFiles, after, hostDirs(headFiles.keys(), 'active'));
  const stillArchived = hostDirs(after.keys(), 'completed');
  let amended = [];
  if (parent) {
    const parentFiles = commitFeatures(ctx, parent);
    amended = newArchives(parentFiles, headFiles, hostDirs(parentFiles.keys(), 'active'))
      .archived.filter((dir) => stillArchived.has(dir));
  }
  return {
    after,
    archived: [...new Set([...current.archived, ...amended])].sort(),
    unplaced: current.unplaced
  };
}

// `--range <base>..<head>`: after = `<head>`'s tree; before = the merge base.
// The FINAL state of `<head>`, not each commit on the way: a phase-bearing host
// whose closeout failed verification may be repaired by a later commit
// (finish-feature Step 4), and checking commit by commit would block a closeout
// that is already fixed.
// ⚠ Rule 1 cannot look at the merge base alone. A feature branch usually opens
// its host AND archives it, so at the merge base `active/<host>/` does not exist
// yet, and every ordinary merge request would read as uncertain. So a host counts
// as moved from `active/` when it was there at the merge base or when any commit
// in the range touched a path under `active/<host>/` — which it can only do while
// the directory has files. `--full-history`, so that a host opened on a side
// branch merged into this one is still seen.
function rangeScope(ctx, options) {
  const base = resolveCommit(ctx, options.base, '--range base');
  const head = resolveCommit(ctx, options.head, '--range head');
  const mergeBaseRun = runGit(ctx.toplevel, ['merge-base', base, head]);
  if (mergeBaseRun.status !== 0) {
    throw new GateError(`${options.base} and ${options.head} have no merge base. In CI this is usually a shallow clone: fetch the full history (GitLab: GIT_DEPTH: 0; GitHub Actions: fetch-depth: 0).`);
  }
  const mergeBase = firstLine(mergeBaseRun.stdout);
  const before = commitFeatures(ctx, mergeBase);
  const after = commitFeatures(ctx, head);
  const lead = `${ctx.featuresRel}/`;
  const touched = zRecords(gitOut(ctx.toplevel, ['log', '--full-history', '--format=', '--name-only', '-z', `${mergeBase}..${head}`, '--', `${lead}active/`]))
    .map((file) => file.replace(/^\n+/, ''))
    .filter((file) => file.startsWith(lead))
    .map((file) => file.slice(lead.length));
  const wasActive = new Set([...hostDirs(before.keys(), 'active'), ...hostDirs(touched, 'active')]);
  const { archived, unplaced } = newArchives(before, after, wasActive);
  return { after, archived, unplaced, head, mergeBase };
}

// Every blob the checks read, in one `git cat-file --batch`. A missing object
// maps to null, which the checks report as unreadable rather than passing.
function readBlobs(ctx, oids) {
  const texts = new Map();
  const wanted = [...new Set(oids)];
  if (wanted.length === 0) return texts;
  const out = gitOut(ctx.toplevel, ['cat-file', '--batch'], `${wanted.join('\n')}\n`);
  let at = 0;
  for (const oid of wanted) {
    const eol = out.indexOf(0x0a, at);
    const header = out.subarray(at, eol).toString('utf8').split(' ');
    at = eol + 1;
    if (header[1] !== 'blob') {
      texts.set(oid, null);
      if (header[1] !== 'missing' && header[2] !== undefined) at += Number(header[2]) + 1;
      continue;
    }
    const size = Number(header[2]);
    let text = out.subarray(at, at + size).toString('utf8');
    at += size + 1;
    // A byte-order mark is a standard shape here, not an unreadable one.
    if (text.startsWith(BYTE_ORDER_MARK)) text = text.slice(1);
    texts.set(oid, text);
  }
  return texts;
}

// The frontmatter's `status` value, read by the rule `dflow render` and doctor
// use (the document's first line starts with `---`, the block ends at the next
// line that is `---` once trimmed; a field is the text before a line's first
// `:`, on a line not starting with `#`), with the value's trailing ` # comment`
// and surrounding quotes dropped. CRLF lines read the same as LF (the caller has
// already dropped a leading byte-order mark). Anything else is a shape this gate
// will not guess about.
function frontmatterStatus(text) {
  const lines = text.split('\n');
  const count = doctorChecks.frontmatterLineCount(lines);
  if (count === 0) return { state: 'no-frontmatter' };
  const values = [];
  for (const raw of lines.slice(1, count - 1)) {
    const line = raw.replace(/\r$/, '');
    if (line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1 || line.slice(0, colon).trim() !== 'status') continue;
    const value = line.slice(colon + 1).replace(/\s+#.*$/, '').trim();
    const quoted = /^"(.*)"$/.exec(value) || /^'(.*)'$/.exec(value);
    values.push(quoted ? quoted[1] : value);
  }
  if (values.length === 1) return { state: 'ok', value: values[0] };
  return { state: values.length === 0 ? 'no-status' : 'many-status', count: values.length };
}

function tableCells(line) {
  let row = line.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

// The table under `## Checkpoint Log`, found with doctor's own block classifier
// so that a table-shaped line inside a `>` note, an HTML comment or a fenced
// example is not mistaken for the log — the template's notes quote
// `closeout | committed` in exactly such places.
function checkpointLog(text) {
  const lines = text.split('\n');
  const body = doctorChecks.blankFencedBlocks(lines.slice(doctorChecks.frontmatterLineCount(lines)).join('\n'));
  const classes = doctorChecks.classifyLines(body);
  let sections = 0;
  let inside = false;
  let table = null;
  for (let i = 0; i < body.length; i += 1) {
    const c = classes[i];
    if (c.heading && c.heading.level <= 2) {
      inside = c.heading.level === 2 && c.heading.text.replace(/\s+/g, ' ').trim().toLowerCase() === 'checkpoint log';
      if (inside) sections += 1;
      continue;
    }
    if (!inside || table || c.type !== 'table') continue;
    let end = i;
    while (end + 1 < body.length && classes[end + 1].type === 'table') end += 1;
    table = { header: tableCells(body[i]), rows: body.slice(i + 2, end + 1).map(tableCells) };
    i = end;
  }
  return { sections, table };
}

function relFile(host, name) {
  return `${FEATURES_REL}/completed/${host}/${name}`;
}

function finding(level, title, detail, action) {
  return { level, title, detail, action };
}

const CONFIRM_BY_HAND = 'If you read it and it is right, see the docs page below for letting a checked commit through.';

function statusFindings(host, name, text, what) {
  const file = relFile(host, name);
  if (text === null) {
    return [finding('uncertain', `${file} could not be read from git.`,
      'The gate will not report a file it could not read as passing.',
      `Check that ${file} is a regular file, then run the check again.`)];
  }
  const status = frontmatterStatus(text);
  if (status.state === 'ok') {
    if (status.value === 'completed') return [];
    return [finding('fail', `${file} says \`status: ${status.value}\` — ${what} must say \`completed\` when the host is archived.`,
      name === '_index.md'
        ? 'The directory moved to completed/, but the record inside it does not say the feature is done (finish-feature Step 2 flips it).'
        : 'finish-feature Step 1 requires every spec in the host to read `status: completed` before the host is archived.',
      `Set \`status: completed\` in that file and stage it (git add ${file}). If your working tree already says \`completed\`, the edit simply is not staged.`)];
  }
  // A document copied whole from a template's projected copy starts with the
  // bundle's own line, and the frontmatter under it is not frontmatter — to
  // `dflow render` and doctor either. The cause and the repair are known, so it is
  // a failure with its fix, not a shape left for someone to confirm; and after
  // archiving nothing reads the document again, so this is the last place to
  // catch it.
  if (status.state === 'no-frontmatter' && text.split('\n')[0].replace(/\r$/, '').trim() === WORKFLOW_BUNDLE_GENERATED_MARKER) {
    return [finding('fail', `${file}: line 1 is \`${WORKFLOW_BUNDLE_GENERATED_MARKER}\`, copied from the template's projected copy, so the frontmatter under it — \`status\` included — is not read as frontmatter.`,
      'The projected templates under dflow/specs/shared/dflow-workflows/templates/ carry that line; a document created from one must not. `dflow render` and `dflow doctor` do not read frontmatter under it either.',
      `Delete that line and the blank line after it, then stage the file (git add ${file}).`)];
  }
  const shape = status.state === 'no-frontmatter'
    ? 'it has no frontmatter block (a first line `---`, closed by another `---` line)'
    : status.state === 'no-status'
      ? 'its frontmatter has no `status:` field'
      : `its frontmatter has ${status.count} \`status:\` fields`;
  return [finding('uncertain', `${file}: cannot read its status — ${shape}.`,
    `The gate reads \`status\` only from the template's frontmatter shape, and will not guess where else ${what} might say it.`,
    `Confirm by hand that ${file} says the work is completed, and restore the template's \`status: completed\` frontmatter line so the next run can read it. ${CONFIRM_BY_HAND}`)];
}

function closeoutRowFindings(host, text) {
  const file = relFile(host, '_index.md');
  const log = checkpointLog(text);
  const confirm = `Confirm by hand that the Checkpoint Log in ${file} records the closeout as \`committed\` (the AI commits) or \`skipped\` (you commit yourself).`;
  if (log.sections !== 1) {
    return [finding('uncertain',
      log.sections === 0 ? `${file} has no \`## Checkpoint Log\` section.` : `${file} has ${log.sections} \`## Checkpoint Log\` sections.`,
      'The closeout row is read only from the one `## Checkpoint Log` table the template carries.',
      `${confirm} ${CONFIRM_BY_HAND}`)];
  }
  const header = log.table ? log.table.header.map((cell) => cell.toLowerCase()) : [];
  const col = { checkpoint: header.indexOf('checkpoint'), result: header.indexOf('result'), timestamp: header.indexOf('timestamp') };
  if (!log.table || col.checkpoint === -1 || col.result === -1) {
    return [finding('uncertain', `${file}: the \`## Checkpoint Log\` section has no table with \`Checkpoint\` and \`Result\` columns.`,
      'The closeout row is read only from the template\'s table shape.',
      `${confirm} ${CONFIRM_BY_HAND}`)];
  }
  const real = [];
  const odd = [];
  for (const row of log.table.rows) {
    const checkpoint = row[col.checkpoint] || '';
    const result = (row[col.result] || '').replace(/\s+/g, ' ');
    const timestamp = col.timestamp === -1 ? '' : (row[col.timestamp] || '');
    if (checkpoint === 'closeout') {
      // The template carries a placeholder closeout row of its own. Without this
      // exclusion that row alone would satisfy the check on every host.
      if (/^\{[^}]*\}$/.test(timestamp) || result === 'committed / skipped / failed') continue;
      real.push(result);
    } else if (/closeout/i.test(checkpoint)) {
      odd.push(checkpoint);
    }
  }
  if (real.length === 0) {
    if (odd.length > 0) {
      return [finding('uncertain', `${file}: a Checkpoint Log row mentions closeout, but not in the template's shape (Checkpoint cell ${JSON.stringify(odd[0])}).`,
        'The gate reads a row whose Checkpoint cell is exactly `closeout`. An older way of writing it — the explanation and the checkpoint in one cell — is not one it will guess about.',
        `Rewrite the row as Checkpoint \`closeout\` with Result \`committed\` or \`skipped\`, keeping any explanation out of those two cells, and stage ${file}. ${CONFIRM_BY_HAND}`)];
    }
    return [finding('fail', `${file}: the Checkpoint Log has no closeout row.`,
      'finish-feature Step 4 instruction 1 writes it before the closeout commit. The template\'s own placeholder row (`{YYYY-MM-DD HH:MM}` / `committed / skipped / failed`) does not count.',
      `Add a row with Checkpoint \`closeout\` and Result \`committed\` (the AI commits) or \`skipped\` (you commit yourself), then stage ${file}.`)];
  }
  if (real.includes('failed')) {
    return [finding('fail', `${file}: the closeout row says \`failed\`, in the commit it describes.`,
      'This usually means an earlier attempt was refused by a hook and finish-feature Step 4 instruction 3 flipped the row to `failed`. The commit you are making now would record that its own commit failed.',
      `Change the Result back to \`committed\` (the AI commits) or \`skipped\` (you commit yourself), then stage ${file}.`)];
  }
  const unknown = real.find((result) => result !== 'committed' && result !== 'skipped');
  if (unknown !== undefined) {
    return [finding('uncertain', `${file}: the closeout row's Result is ${JSON.stringify(unknown)}, not \`committed\` or \`skipped\`.`,
      'The closeout row carries no commit hash (finish-feature Step 4 instruction 1), and the gate reads only those two values.',
      `Write \`committed\` (the AI commits) or \`skipped\` (you commit yourself) and stage ${file}. ${CONFIRM_BY_HAND}`)];
  }
  return [];
}

// Check 5, `--staged` only: nothing under an archived directory left out of the
// commit — a tracked file modified or deleted without being staged (#5's `RM`
// signal), or a new file not yet added and not ignored. The same condition as
// Step 4's post-commit "working tree clean", taken before the commit instead.
// One `git status` for all the hosts; its entries are sorted back to each host.
function unstagedByHost(ctx, hosts) {
  const byHost = new Map(hosts.map((host) => [host, []]));
  if (hosts.length === 0) return byHost;
  const lead = `${ctx.featuresRel}/completed/`;
  const records = zRecords(gitOut(ctx.toplevel, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...hosts.map((host) => `${lead}${host}/`)]));
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const code = record.slice(0, 2);
    const file = record.slice(3);
    // A rename or copy entry is followed by its source path as the next record.
    if (/[RC]/.test(code)) i += 1;
    if (code[1] === ' ' || !file.startsWith(lead)) continue;
    const host = file.slice(lead.length, file.indexOf('/', lead.length));
    if (byHost.has(host)) byHost.get(host).push(`${code === '??' ? 'untracked' : 'not staged'}: ${file.slice(ctx.projectPrefix.length)}`);
  }
  return byHost;
}

function unstagedFindings(host, dirty) {
  if (dirty.length === 0) return [];
  const rel = `${FEATURES_REL}/completed/${host}`;
  return [finding('fail', `${rel}/ has changes this commit would leave behind (${dirty.length}): ${dirty.join('; ')}.`,
    'git mv stages the move with the last committed content, so every edit made to the moved files afterwards stays out of the commit until it is added — finish-feature Step 4 instruction 2.',
    `Stage the archived directory (git add ${rel}), or remove what does not belong in it, then commit again.`)];
}

// The top-level files of an archived host the checks read: `_index.md` and the
// specs.
function hostFiles(host, after, globs) {
  const inHost = `completed/${host}/`;
  const names = [...after.keys()].filter((file) => file.startsWith(inHost)).map((file) => file.slice(inHost.length));
  return {
    names,
    specs: names.filter((name) => !name.includes('/') && globs.some((glob) => doctorChecks.shapePathMatches(glob, name)))
  };
}

function checkHost(host, after, globs, texts, dirty) {
  const findings = [];
  const inHost = `completed/${host}/`;
  const { names, specs } = hostFiles(host, after, globs);

  // 1. `_index.md` exists and says `completed`; 4. its closeout row.
  if (!names.includes('_index.md')) {
    findings.push(finding('fail', `${relFile(host, '_index.md')} is missing.`,
      'An archived host keeps its `_index.md`: it is the record the move archives.',
      'Restore it — archive the whole directory with git mv (finish-feature Step 4).'));
  } else {
    const text = texts.get(after.get(`${inHost}_index.md`));
    findings.push(...statusFindings(host, '_index.md', text, '`_index.md`'));
    if (text !== null) findings.push(...closeoutRowFindings(host, text));
  }

  // 2. moved, not copied.
  const leftover = [...after.keys()].filter((file) => file.startsWith(`active/${host}/`));
  if (leftover.length > 0) {
    const activeDir = `${FEATURES_REL}/active/${host}`;
    findings.push(finding('fail', `${activeDir}/ still has ${leftover.length} file(s) — the host was copied to completed/, not moved.`,
      'Archiving is a git mv: the host leaves active/ in the same commit that adds it to completed/.',
      `Remove the copy left in active/ (git rm -r -- ${activeDir}) after checking it holds nothing the archive lacks.`));
  }

  // 3. every spec says `completed`.
  for (const name of specs) {
    findings.push(...statusFindings(host, name, texts.get(after.get(`${inHost}${name}`)), 'a spec'));
  }

  // 5. `--staged` only (`dirty` is null for a range).
  if (dirty) findings.push(...unstagedFindings(host, dirty));
  return findings;
}

function unplacedFinding(host) {
  const dir = `${FEATURES_REL}/completed/${host}/`;
  return finding('uncertain', `${dir} is new, but was never in ${FEATURES_REL}/active/${host}/.`,
    'finish-feature moves a host out of active/ with git mv and never renames it, so this directory did not come from a closeout under its own name: it was renamed on the way, created directly in completed/, or it is an archived host renamed. The gate does not guess which.',
    `Confirm by hand. If it is an archived host you renamed, check that the rename changed nothing else. Otherwise check what the five checks would: _index.md says \`status: completed\`; nothing for this host is left under active/; every spec in it says \`status: completed\`; the Checkpoint Log has a \`closeout\` row reading \`committed\` or \`skipped\`; nothing in the directory is left unstaged. ${CONFIRM_BY_HAND}`);
}

function writeFindings(stdout, list) {
  for (const f of list) {
    stdout.write(`  [${f.level}] ${f.title}\n`);
    stdout.write(`      ${f.detail}\n`);
    stdout.write(`      ${f.action}\n`);
  }
}

async function runCheckCloseout({ cwd, args = [], stdout, stderr }) {
  try {
    const options = parseArgs(args);
    const globs = await specFileGlobs();
    const ctx = await locateProject(path.resolve(cwd));
    const staged = options.mode === 'staged';
    const scope = staged ? stagedScope(ctx) : rangeScope(ctx, options);

    stdout.write(`Dflow check-closeout ${pkg.version}\n`);
    stdout.write(staged
      ? 'Checking the index (what this commit will record) for feature directories newly archived to completed/.\n\n'
      : `Checking ${options.head} (${scope.head.slice(0, 12)}) against its merge base with ${options.base} (${scope.mergeBase.slice(0, 12)}) for feature directories newly archived to completed/.\n\n`);

    if (scope.archived.length === 0 && scope.unplaced.length === 0) {
      stdout.write('No feature directory is newly archived here — nothing to check.\n');
      return 0;
    }

    const oids = [];
    for (const host of scope.archived) {
      const { names, specs } = hostFiles(host, scope.after, globs);
      for (const name of names.includes('_index.md') ? ['_index.md', ...specs] : specs) oids.push(scope.after.get(`completed/${host}/${name}`));
    }
    const texts = readBlobs(ctx, oids);
    const dirty = staged ? unstagedByHost(ctx, scope.archived) : null;

    let blocked = 0;
    let problems = 0;
    for (const host of scope.archived) {
      const findings = checkHost(host, scope.after, globs, texts, dirty ? dirty.get(host) : null);
      if (findings.length === 0) {
        stdout.write(`[pass] ${FEATURES_REL}/completed/${host}/\n`);
        continue;
      }
      blocked += 1;
      problems += findings.length;
      stdout.write(`[blocked] ${FEATURES_REL}/completed/${host}/\n`);
      writeFindings(stdout, findings);
    }
    for (const host of scope.unplaced) {
      blocked += 1;
      problems += 1;
      stdout.write(`[blocked] ${FEATURES_REL}/completed/${host}/\n`);
      writeFindings(stdout, [unplacedFinding(host)]);
    }

    const total = scope.archived.length + scope.unplaced.length;
    stdout.write('\n');
    if (blocked === 0) {
      stdout.write(`All ${total} newly archived feature director${total === 1 ? 'y' : 'ies'} passed.\n`);
      stdout.write('This gate covers only what a machine can judge; the rest of finish-feature Step 4\'s verification and pr-review still apply (see dflow check-closeout --help).\n');
      return 0;
    }
    stdout.write(`BLOCKED: ${blocked} of ${total} newly archived feature director${total === 1 ? 'y' : 'ies'}, ${problems} problem(s).\n`);
    stdout.write('A [fail] names what is wrong and how to fix it. An [uncertain] blocks too: the gate will not report a shape it cannot read as passing.\n');
    stdout.write(`What each result means, and how to proceed: ${CLOSEOUT_CHECK_DOC_URL} (offline copy: docs/closeout-check.en.md in the installed package).\n`);
    return 1;
  } catch (error) {
    if (error instanceof GateError) {
      stderr.write(`dflow check-closeout: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

module.exports = {
  runCheckCloseout,
  // Exported for `--help`, which names the same page the report does.
  CLOSEOUT_CHECK_DOC_URL,
  // Exported for `--help` and the tests: the spec set is derived, so the help
  // text and the fixtures read the same derivation instead of a copy.
  specFileGlobs,
  // Exported for tests: the frontmatter and Checkpoint Log readers are pinned
  // directly on the standard shapes and on the ones that must read uncertain.
  frontmatterStatus,
  checkpointLog
};
