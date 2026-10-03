// PROPOSAL-073: tests for the `dflow render` subcommand (lib/render.js).
//
// Covers the proposal's verification plan: CLI surface (help / unknown option /
// missing src), the bidirectional src/out overlap guard (incl. linked roots
// and linked ancestors), out-path usability (a file where a directory is
// needed), the output-directory ownership + manifest contract (first-run
// stamp, stale cleanup incl. removed
// subdirectories with empty-parent pruning scoped to this run's own unlinks,
// root index.html accounting, non-empty-without-manifest and
// malformed/schema-invalid refusals that delete nothing, output-internal
// symlink/junction/hardlink refusal, marker-based mutation proof against
// forged manifests and unmarked files, reserved-tmp self-proof, reserved-name
// directory refusals before mutation, source projection-collision refusal
// incl. reserved root names), rendering semantics
// ported from the prototype (all-table cards, in-cell <br>, CJK heading
// anchors + .md#anchor link rewriting, autolink rules, gherkin highlighting,
// raw-HTML passthrough, paragraph-adjacent task lists under marked),
// long-field readability (PROPOSAL-077 A1: threshold locks, wide cards,
// prose spacing, CSS clamp toggle with document-unique ids, verbatim cell
// content, title/short-field exemptions, print expansion CSS), completed/
// year pagination (PROPOSAL-079: root stub with year links, physical
// per-year pages with newest-first units and sibling nav, other-bucket,
// reserved-output collisions, emptied-year stale cleanup, grouping units),
// the grouped root index (PROPOSAL-101: specs-root recognition, reachability
// through resolved links, grouping, fixed order, role labels, collapsed
// structure, special names, features/ without active/ or backlog/, year-page
// note, content independence, and the unrecognised side staying the pre-P101
// tree apart from href encoding), lifecycle / flow diagrams in analysis.md
// (PROPOSAL-100: template-row lock, every not-drawn note, containment of a
// subsection that throws, placement, untouched cards and pages, unique ids
// on a page with several pictures, stdout line, determinism, and the layout's
// invariants — label overlap included — read back from the SVG), Windows
// long-path output, and the dynamic import('marked') loading-path lock.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, rm, rmdir, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, toNamespacedPath } from 'node:path';
import { fileURLToPath } from 'node:url';

import render from '../lib/render.js';
import diagrams from '../lib/render-diagrams.js';

const { parseManifest, staleEntries, pathContains, findUnsafeEntry, findProjectionCollision, GENERATED_MARK, LONG_FIELD_CHARS, CLAMP_FIELD_CHARS } = render;

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dflowBin = join(repoRoot, 'bin', 'dflow.js');
const MANIFEST_NAME = '.dflow-render-manifest.json';
const RUN_TIMEOUT_MS = 30000;

const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-render-'));

function runRenderCli(cwd, args) {
  const result = spawnSync(process.execPath, [dflowBin, 'render', ...args], {
    cwd,
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
    await stat(toNamespacedPath(path));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function writeFixture(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function readOut(path) {
  return readFile(toNamespacedPath(path), 'utf8');
}

async function readManifest(outDir) {
  return JSON.parse(await readFile(join(outDir, MANIFEST_NAME), 'utf8'));
}

try {
  // --- loading-path lock: marked is ESM-only; require(esm) is not on by
  // default until Node 22.12, so lib/render.js must use dynamic import().
  const renderSource = await readFile(join(repoRoot, 'lib', 'render.js'), 'utf8');
  assert.match(renderSource, /import\('marked'\)/, 'lib/render.js must load marked via dynamic import()');
  assert.doesNotMatch(renderSource, /require\(\s*['"]marked['"]\s*\)/, 'lib/render.js must not require(esm) marked');

  // --- dependency policy lock: marked stays exact-pinned (the lockfile does
  // not constrain CLI installers; only an exact range does).
  const pkg = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
  assert.match(pkg.dependencies.marked, /^\d/, 'marked must be exact-pinned (no ^ / ~ range)');

  // --- CLI surface ---
  {
    const help = runRenderCli(tempRoot, ['--help']);
    assert.equal(help.code, 0, 'render --help exits 0');
    assert.match(help.stdout, /dflow render \[--src <dir>\] \[--out <dir>\] \[--title <text>\]/);
    assert.match(help.stdout, /full rebuild/, 'help states the full-rebuild model');
    // The diagram limits the help states are the ones the renderer enforces:
    // a limit changed in lib/render-diagrams.js without the help fails here.
    const L = diagrams.DIAGRAM_LIMITS;
    const helpText = help.stdout.replace(/\s+/g, ' ');
    for (const phrase of [
      `at most ${L.LC_MAX_STATES} states and ${L.LC_MAX_TRANSITIONS} transitions, ${L.DIAGRAM_MAX_WIDTH} wide and ${L.DIAGRAM_MAX_HEIGHT} tall`,
      `at most ${L.LC_MAX_SIDE_LANES} routing lanes on either side, ${L.LC_MAX_SIDE_PORTS} arrow ends on one side of a state, ${L.LC_MAX_CROSSINGS} crossings in all and ${L.LC_MAX_CROSSINGS_PER_EDGE} on one arrow`,
      `at most ${L.FL_MAX_PARTICIPANTS} participants and ${L.FL_MAX_STEPS} steps, ${L.DIAGRAM_MAX_HEIGHT} tall (no width limit`,
      `a flow of at most ${L.FL_PRINT_MAX_PARTICIPANTS} participants`,
      `at most ${L.IDENTITY_MAX_CODEPOINTS} characters on ${L.IDENTITY_MAX_LINES} lines`,
      `Trigger, Guard, Handed over and State change each at most ${L.FIELD_MAX_ITEMS} values and ${L.FIELD_MAX_CODEPOINTS} characters`,
      `more than ${L.PRIMARY_MAX_LINES} lines is cut short, which at most ${L.MAX_TRUNCATED_FIELDS} of them may be`,
      'Means and Evidence have no limit, and Means is not drawn',
      'an Evidence whose first word is inferred or assumed makes the arrow dashed and adds a one-row tag with that word, which counts toward the height'
    ]) {
      assert.ok(helpText.includes(phrase), `render --help states the renderer's limit: "${phrase}"`);
    }
    assert.equal(L.PRIMARY_MAX_LINES, L.SECONDARY_MAX_LINES, 'the help states one line limit for every other cell');

    const unknown = runRenderCli(tempRoot, ['--bogus']);
    assert.equal(unknown.code, 1, 'unknown option exits 1');
    assert.match(unknown.stderr, /Unsupported render option: --bogus/);

    const missingValue = runRenderCli(tempRoot, ['--src']);
    assert.equal(missingValue.code, 1, 'missing option value exits 1');
    assert.match(missingValue.stderr, /Missing value for render option: --src/);

    const missingSrc = runRenderCli(tempRoot, ['--src', 'no-such-dir', '--out', join(tempRoot, 'never')]);
    assert.equal(missingSrc.code, 1, 'missing src exits 1');
    assert.match(missingSrc.stderr, /src not found/);
    assert.equal(await exists(join(tempRoot, 'never')), false, 'no output dir is created when src is missing');
  }

  // --- overlap guard, both directions ---
  {
    const proj = join(tempRoot, 'overlap');
    await writeFixture(join(proj, 'dflow/specs/a.md'), '# A\n');

    const outInSrc = runRenderCli(proj, ['--out', 'dflow/specs/html']);
    assert.equal(outInSrc.code, 1, 'out inside src exits 1');
    assert.match(outInSrc.stderr, /--out must not be inside --src/);

    const outEqualsSrc = runRenderCli(proj, ['--src', 'dflow/specs', '--out', 'dflow/specs']);
    assert.equal(outEqualsSrc.code, 1, 'out == src exits 1');
    assert.match(outEqualsSrc.stderr, /--out must not be inside --src/);

    const srcInOut = runRenderCli(proj, ['--src', 'dflow/specs', '--out', '.']);
    assert.equal(srcInOut.code, 1, 'src inside out exits 1');
    assert.match(srcInOut.stderr, /--src must not be inside --out/);
    assert.equal(await exists(join(proj, MANIFEST_NAME)), false, 'refused overlap run writes nothing');

    // The guard must compare physical paths: a junction/symlink --out that
    // points inside --src (impl review R1 F1), and the reverse direction
    // with a linked --src inside --out, must both refuse.
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    await mkdir(join(proj, 'dflow/specs/rendered'), { recursive: true });
    await symlink(join(proj, 'dflow/specs/rendered'), join(proj, 'html-link'), linkType);
    const linkedOut = runRenderCli(proj, ['--out', 'html-link']);
    assert.equal(linkedOut.code, 1, 'linked --out physically inside --src exits 1');
    assert.match(linkedOut.stderr, /--out must not be inside --src/);
    assert.equal(await exists(join(proj, 'dflow/specs/rendered/index.html')), false, 'nothing written through the link');

    // Parent-chain shape: the link sits above --out and the tail does not
    // exist yet, so realpathDeep must resolve the deepest existing ancestor
    // and still refuse (impl review R2 missing check).
    const linkedParent = runRenderCli(proj, ['--out', 'html-link/nested/html']);
    assert.equal(linkedParent.code, 1, '--out under a linked ancestor physically inside --src exits 1');
    assert.match(linkedParent.stderr, /--out must not be inside --src/);
    assert.equal(await exists(join(proj, 'dflow/specs/rendered/nested')), false, 'nothing created through the linked ancestor');

    await mkdir(join(proj, 'outdir/real-src'), { recursive: true });
    await writeFixture(join(proj, 'outdir/real-src/a.md'), '# A\n');
    await symlink(join(proj, 'outdir/real-src'), join(proj, 'src-link'), linkType);
    const linkedSrc = runRenderCli(proj, ['--src', 'src-link', '--out', 'outdir']);
    assert.equal(linkedSrc.code, 1, 'linked --src physically inside --out exits 1');
    assert.match(linkedSrc.stderr, /--src must not be inside --out/);
  }

  // --- out-path usability: a file where a directory is needed refuses cleanly ---
  {
    const proj = join(tempRoot, 'outfile');
    await writeFixture(join(proj, 'dflow/specs/a.md'), '# A\n');
    await writeFixture(join(proj, 'notadir'), 'a file, not a directory\n');

    // --out itself is a file: readdir reports ENOTDIR on every platform
    const direct = runRenderCli(proj, ['--out', 'notadir']);
    assert.equal(direct.code, 1, 'file at --out exits 1');
    assert.match(direct.stderr, /out is not a directory \(a file is in the way\)/);

    // a file ancestor: Windows readdir says ENOENT for file/child, so this
    // shape used to escape as a raw mkdir ENOTDIR crash (impl review R2 F1)
    const nested = runRenderCli(proj, ['--out', 'notadir/child']);
    assert.equal(nested.code, 1, 'file ancestor in --out exits 1');
    assert.match(nested.stderr, /out is not a directory \(a file is in the way\)/);
    assert.doesNotMatch(nested.stderr, /ENOTDIR/, 'no raw fs error leaks to the user');
    assert.equal(await readFile(join(proj, 'notadir'), 'utf8'), 'a file, not a directory\n', 'blocking file untouched');
  }

  // --- rendering semantics on a synthetic corpus ---
  {
    const proj = join(tempRoot, 'semantics');
    const src = join(proj, 'dflow/specs');
    await writeFixture(join(src, 'models.md'), `---
title: Domain Models
status: in-progress
owner: team-a
---
<!-- dflow:section models -->

# 員工提交費用單 MVP

## Aggregates <!-- Fill timing: Activity 2 -->

<!-- phase-2 ADDED -->

| Aggregate | Root Entity | Status | Invariants | Empty |
|---|---|---|---|---|
| ExpenseReport | ExpenseReport | in-progress | one<br>two | |
| Draft | ReallyLongRootEntityNameThatExceedsTheFortyCharacterChipLimit | draft | three | |

| Single |
|---|
| plain row |

段落貼鄰清單：
- [x] done item
- [ ] open item

Raw <b>bold</b> passthrough and a break<br>here.

Given 已有一張草稿報支單
When 員工按下送出
Then 系統建立簽核鏈
And 通知第一位簽核人

When the employee submits it alone, this English sentence stays plain.

Given 步驟含 \`SelectedValue\` 代碼段
Then 代碼段不影響上色資格

Given <b>raw html</b> 出現在段落
When 屬性可能藏換行
Then 整段保守跳過不上色

Given [連結](https://example.com "標題第一行
When 標題內假行") 步驟一
Then 步驟二

\`\`\`
Scenario: untagged but gherkin-looking
Given inside an untagged fence
Then it still lights up
\`\`\`

\`\`\`
SELECT * FROM T WHERE Given = 1
ORDER BY id
\`\`\`

See [行為](./behavior.md#中文-heading) and [\`behavior.md\`](behavior.md).

Mentions: \`notes.md\` and \`dup.md\` and \`outside.md\`.

Scheme links: [m](mailto:someone@example.md) and [f](file:notes.md).

\`\`\`gherkin
Scenario: submit expense
  Given a draft report referencing notes.md
  When the employee submits it
  Then the report is submitted
\`\`\`
`);
    await writeFixture(join(src, 'behavior.md'), '# Behavior\n\n## 中文 Heading\n\ncontent\n');
    await writeFixture(join(src, 'notes.md'), '# Notes\n');
    await writeFixture(join(src, 'x/dup.md'), '# dup x\n');
    await writeFixture(join(src, 'y/dup.md'), '# dup y\n');

    const first = runRenderCli(proj, ['--title', '我的 specs']);
    assert.equal(first.code, 0, `default render failed\nSTDERR:\n${first.stderr}`);
    assert.match(first.stdout, /rendered 5 md files/);

    const outDir = join(proj, 'dflow-specs-html');
    const models = await readOut(join(outDir, 'models.html'));

    // frontmatter -> meta card + status pill + page title
    assert.match(models, /<title>Domain Models<\/title>/);
    assert.match(models, /class="meta-card"/);
    assert.match(models, /class="badge warn">in-progress</);
    assert.match(models, /<span class="k">owner<\/span>team-a/);

    // AI markers -> human spans; structural marker dropped
    assert.doesNotMatch(models, /dflow:section/);
    assert.match(models, /<span class="badge ok">phase-2 新增<\/span>/);
    assert.match(models, /<h2 id="aggregates">Aggregates <span class="chip">Activity 2<\/span><\/h2>/);

    // CJK heading anchor (JS \w has no CJK; Unicode-property slug required)
    assert.match(models, /<h1 id="員工提交費用單-mvp">/);

    // multi-column table -> one card per row; classifier chips; status pill;
    // in-cell <br> preserved; empty cells omitted; >40-char classifier
    // demotes to a stacked field
    assert.match(models, /<div class="cards">/);
    assert.match(models, /<div class="card-title">ExpenseReport<\/div>/);
    assert.match(models, /<span class="chip cat">Root Entity: ExpenseReport<\/span>/);
    assert.match(models, /<span class="badge warn">in-progress<\/span>/);
    assert.match(models, /<div class="fld-v">one<br>two<\/div>/);
    assert.doesNotMatch(models, /<span class="fld-k">Empty<\/span>/, 'empty cells are omitted from cards');
    assert.match(
      models,
      /<div class="fld"><span class="fld-k">Root Entity<\/span><div class="fld-v">ReallyLongRootEntityName/,
      'over-40-char classifier value renders as a field, not a chip'
    );

    // single-column table keeps plain-table rendering (wrapped for overflow)
    assert.match(models, /<div class="tblwrap"><table>/);
    assert.match(models, /<td>plain row<\/td>/);

    // paragraph-adjacent task list expands as a real list under marked (the
    // prototype's GFM shim is intentionally not ported — this locks the claim)
    assert.match(models, /<li><span class="cb on"><\/span> done item<\/li>/);
    assert.match(models, /<li><span class="cb"><\/span> open item<\/li>/);
    assert.doesNotMatch(models, /<p>段落貼鄰清單：\s*- \[/, 'list must not glue into the paragraph');

    // raw inline HTML passthrough (trusted-source stance)
    assert.match(models, /Raw <b>bold<\/b> passthrough and a break<br>here\./);

    // relative .md links -> .html, anchors (incl. CJK) preserved, and the
    // anchor actually resolves in the target page
    assert.match(models, /<a href="\.\/behavior\.html#中文-heading">行為<\/a>/);
    const behavior = await readOut(join(outDir, 'behavior.html'));
    assert.match(behavior, /<h2 id="中文-heading">中文 Heading<\/h2>/, 'target CJK heading id exists');

    // code-mention autolinks: unique in-tree name links; codespan inside an
    // existing markdown link is not re-wrapped; ambiguous / out-of-tree names
    // stay plain
    assert.match(models, /<a href="notes\.html"><code>notes\.md<\/code><\/a>/);
    assert.match(models, /<a href="behavior\.html"><code>behavior\.md<\/code><\/a>/, 'markdown link with code label rewrites to .html');
    assert.doesNotMatch(models, /<a[^>]*><a/, 'no nested anchors from autolinking inside links');
    assert.doesNotMatch(models, /<a href="[^"]*dup\.html"/, 'ambiguous bare filename is not autolinked');
    assert.doesNotMatch(models, /<a href="[^"]*outside\.html"/, 'out-of-tree mention is not autolinked');

    // scheme-qualified links are never rewritten to .html — the proposal
    // scopes rewriting to relative .md links (cold-eye gate G7)
    assert.match(models, /<a href="mailto:someone@example\.md">m<\/a>/, 'mailto: .md href stays untouched');
    assert.match(models, /<a href="file:notes\.md">f<\/a>/, 'file: .md href stays untouched');

    // gherkin keyword highlighting inside the fenced block (per-keyword
    // color classes); the block's content stays link-free even though it
    // mentions an in-tree filename
    const gherkinBlock = models.match(/<pre><code class="language-gherkin">[^]*?<\/code><\/pre>/);
    assert.ok(gherkinBlock, 'gherkin block rendered as <pre>');
    assert.match(gherkinBlock[0], /<span class="kw kw-s">Scenario:<\/span> submit expense/);
    assert.match(gherkinBlock[0], /<span class="kw kw-g">Given<\/span> a draft report referencing notes\.md/);
    assert.match(gherkinBlock[0], /<span class="kw kw-w">When<\/span> the employee submits it/);
    assert.match(gherkinBlock[0], /<span class="kw kw-t">Then<\/span> the report is submitted/);
    assert.doesNotMatch(gherkinBlock[0], /<a /, 'no links injected into <pre> content');

    // prose scenario steps (OBTS behavior.md style): every line keyword-led
    // -> per-keyword coloring inside the paragraph
    assert.match(models, /<span class="kw kw-g">Given<\/span> 已有一張草稿報支單/);
    assert.match(models, /<span class="kw kw-w">When<\/span> 員工按下送出/);
    assert.match(models, /<span class="kw kw-t">Then<\/span> 系統建立簽核鏈/);
    assert.match(models, /<span class="kw kw-a">And<\/span> 通知第一位簽核人/);
    // …but a lone English sentence starting with a keyword must stay plain
    assert.match(models, /When the employee submits it alone, this English sentence stays plain\./);
    assert.doesNotMatch(models, /kw-w">When<\/span> the employee submits it alone/, 'single prose line never lights up');

    // codespans keep a step paragraph eligible (the dominant real-world
    // shape: steps referencing identifiers)…
    assert.match(models, /<span class="kw kw-g">Given<\/span> 步驟含 <code>SelectedValue<\/code> 代碼段/);
    // …but raw inline HTML disqualifies the whole paragraph (review
    // visual-r1: a newline inside an attribute could otherwise get a span
    // injected mid-tag) — content passes through untouched
    assert.match(models, /<p>Given <b>raw html<\/b> 出現在段落/, 'raw-html paragraph passes through');
    assert.doesNotMatch(models, /kw-g">Given<\/span> <b>raw html/, 'raw-html paragraph is never highlighted');
    // multiline link titles: the newline lives inside title="…", so the
    // tag-aware splitter must not treat it as a step line (review
    // visual-r2) — the paragraph still highlights on its REAL lines and
    // the attribute stays untouched
    assert.match(models, /title="標題第一行\nWhen 標題內假行"/, 'multiline link title survives verbatim');
    assert.doesNotMatch(models, /title="[^"]*<span/, 'no span ever lands inside an attribute');
    assert.match(models, /<span class="kw kw-g">Given<\/span> <a href="https:\/\/example\.com"[^>]*>連結<\/a> 步驟一/, 'link-title paragraph still highlights its real lines');
    assert.match(models, /<span class="kw kw-t">Then<\/span> 步驟二/);

    // untagged fence heuristic: scenario-looking blocks highlight, other
    // untagged code (keyword only mid-line) stays plain
    assert.match(models, /<pre><code><span class="kw kw-s">Scenario:<\/span> untagged but gherkin-looking/);
    assert.match(models, /<span class="kw kw-g">Given<\/span> inside an untagged fence/);
    assert.match(models, /<pre><code>SELECT \* FROM T WHERE Given = 1/, 'non-gherkin untagged fence stays plain');

    // heading hierarchy colors + keyword palette present in the stylesheet
    assert.match(models, /h1 \{[^}]*color: var\(--head-strong\)/);
    assert.match(models, /h2 \{[^}]*color: var\(--head-strong\)/);
    assert.match(models, /h3 \{[^}]*color: var\(--accent\)/);
    assert.match(models, /\.kw-t \{ color: var\(--kw-then\); \}/);

    // index page: custom title + tree links + dir labels
    const index = await readOut(join(outDir, 'index.html'));
    assert.match(index, /<h1>我的 specs<\/h1>/);
    assert.match(index, /<a href="models\.html">models\.md<\/a>/);
    assert.match(index, /<span class="dir">x\/<\/span>/);
    assert.match(index, /<a href="x\/dup\.html">dup\.md<\/a>/);

    // index tree chrome (OBTS dogfooding feedback 2026-07-15): CSS-only
    // guide lines with a └ stop on the last sibling, plus folder/file icons
    // as currentColor mask SVGs — no markup change, links stay plain <a>
    assert.match(index, /ul\.tree ul li::after \{[^}]*border-top: 1px solid/, 'tree connector lines present');
    assert.match(index, /ul\.tree ul li:last-child::before \{ height: 1em; \}/, 'vertical guide stops at the last sibling');
    assert.match(index, /ul\.tree \.dir::before, ul\.tree li > a::before \{[^}]*background: currentColor/, 'icons paint via currentColor (theme-aware)');
    // each icon block must carry BOTH the -webkit-mask and unprefixed mask
    // declarations (review idxtree-r1: locking only the prefixed one lets
    // the standard declaration silently vanish)
    assert.match(index, /ul\.tree \.dir::before \{\s*-webkit-mask: url\("data:image\/svg\+xml/, 'folder icon -webkit-mask present');
    assert.match(index, /ul\.tree \.dir::before \{[^}]*\n\s+mask: url\("data:image\/svg\+xml/, 'folder icon unprefixed mask present');
    assert.match(index, /ul\.tree li > a::before \{\s*-webkit-mask: url\("data:image\/svg\+xml/, 'file icon -webkit-mask present');
    assert.match(index, /ul\.tree li > a::before \{[^}]*\n\s+mask: url\("data:image\/svg\+xml/, 'file icon unprefixed mask present');

    // manifest: root index.html accounted, manifest itself never listed
    const manifest = await readManifest(outDir);
    assert.equal(manifest['dflow-render'], 1);
    assert.ok(manifest.files.includes('index.html'), 'root index.html is in the manifest ledger');
    assert.ok(manifest.files.includes('models.html'));
    assert.ok(!manifest.files.includes(MANIFEST_NAME), 'manifest never lists itself');
  }

  // --- PROPOSAL-077 A1: long-field readability ---
  // Layout-only contract: a LONG field widens its card and gets prose
  // spacing; a CLAMP field additionally sits behind a pure-CSS toggle with a
  // document-unique id. Cell HTML is emitted verbatim (run-on ； chains and
  // existing <br> untouched — A1 never splits content), autolinking still
  // reaches clamped content, titles and sub-threshold fields are exempt, and
  // print CSS removes the clamp.
  {
    const proj = join(tempRoot, 'longfield');
    const src = join(proj, 'dflow/specs');

    // documented thresholds are load-bearing for every fixture below
    assert.equal(LONG_FIELD_CHARS, 200, 'LONG threshold locked as documented in the proposal amendment');
    assert.equal(CLAMP_FIELD_CHARS, 400, 'CLAMP threshold locked as documented in the proposal amendment');

    const prose210 = '長'.repeat(210); // >= LONG, < CLAMP: prose + wide, no toggle
    const wallA = `${'甲'.repeat(200)}；${'乙'.repeat(200)}<br>尾段 \`notes.md\``; // ~412 plain chars >= CLAMP
    const wallB = '丙'.repeat(410); // second toggle -> id uniqueness
    const under199 = '丁'.repeat(199); // one below LONG: must stay a plain field
    const longTitle = '題'.repeat(250); // title column is exempt by design
    const proseOnly = '戊'.repeat(210); // LONG-only row: widening must not depend on a clamp field (review r1 minor)

    await writeFixture(join(src, 'rules.md'), `# Rules

| BR-ID | Rule | Source | Status |
|---|---|---|---|
| BR-001 | ${wallA} | ${prose210} | active |
| BR-002 | ${wallB} | 短摘要 | active |
| ${longTitle} | 短規則 | 短 | active |
| BR-004 | 短規則 | ${under199} | active |
| BR-005 | ${proseOnly} | 短 | active |
`);
    await writeFixture(join(src, 'notes.md'), '# Notes\n');

    const run = runRenderCli(proj, []);
    assert.equal(run.code, 0, `longfield render failed\nSTDERR:\n${run.stderr}`);
    const outDir = join(proj, 'dflow-specs-html');
    const page = await readOut(join(outDir, 'rules.html'));

    // LONG field: prose class on the value, wide card, no toggle for it
    assert.ok(page.includes(`<div class="fld-v prose">${prose210}</div>`), 'LONG field renders prose spacing without a toggle');
    assert.equal((page.match(/<article class="card wide">/g) || []).length, 3, 'the two wall rows and the LONG-only row widen');
    // widening must trigger from a LONG-only field, independent of any clamp
    // field in the row (review r1 minor: false-pass gap when every wide row
    // also carried a >= CLAMP field)
    assert.ok(
      page.includes(`<article class="card wide"><div class="card-title">BR-005</div>`),
      'a 200–399 char field alone widens its card'
    );
    assert.ok(page.includes(`<div class="fld-v prose">${proseOnly}</div>`), 'LONG-only field renders prose without a toggle wrapper');

    // CLAMP field: checkbox + clamp wrapper + label, ids unique per document
    assert.ok(
      page.includes('<div class="fld-v prose"><input type="checkbox" class="fxt" id="fldx-0"><div class="fxc">甲'),
      'first wall field clamps behind toggle fldx-0'
    );
    assert.match(page, /<label class="fxl" for="fldx-0"><span class="fxm">展開全文 ▾<\/span><span class="fxs">收合 ▴<\/span><\/label>/);
    assert.ok(page.includes('id="fldx-1"') && page.includes('for="fldx-1"'), 'second wall field gets the next document-unique id');
    assert.equal((page.match(/class="fxt"/g) || []).length, 2, 'only wall-length fields get toggles');

    // verbatim content: the ； run-on chain and the authored <br> survive
    // unmodified inside the clamp (no layout-driven splitting), and code-
    // mention autolinking still applies within clamped content
    assert.ok(page.includes(`${'甲'.repeat(200)}；${'乙'.repeat(200)}<br>尾段 `), 'run-on ；chain and existing <br> emitted verbatim');
    assert.match(page, /<div class="fxc">甲[^]*?<a href="notes\.html"><code>notes\.md<\/code><\/a><\/div>/, 'autolink reaches clamped content');

    // exemptions: a long title alone neither widens nor clamps; one char
    // below LONG stays a plain field (threshold is >=)
    assert.ok(page.includes(`<article class="card"><div class="card-title">${longTitle}</div>`), 'long title alone keeps a plain card');
    assert.ok(page.includes(`<div class="fld-v">${under199}</div>`), '199-char field stays plain (threshold is >= 200)');

    // stylesheet carries the layout contract: full-row span, 6-line clamp,
    // and print always fully expands with the toggle chrome hidden
    assert.match(page, /\.card\.wide \{ grid-column: 1 \/ -1; \}/);
    assert.match(page, /\.fxc \{ max-height: calc\(6 \* 1\.85em\); overflow: hidden;/);
    assert.match(page, /@media print \{\s*\.fxc \{ max-height: none; \}\s*\.fxc::after, \.fxl, \.fxt \{ display: none; \}\s*\}/);
  }

  // --- PROPOSAL-079: completed/ year pagination ---
  // features/completed/ never inlines into the root index: the root carries
  // a completed/ stub with per-year links (newest year first, non-conforming
  // entries in a 未分年 bucket), each year is a REAL generated page under
  // features/completed/, every generated page is a reserved output in the
  // projection-collision guard, and an emptied year's page is stale-cleaned
  // by the ledger diff like any other output.
  {
    const proj = join(tempRoot, 'yearpage');
    const src = join(proj, 'dflow/specs');
    await writeFixture(join(src, 'domain/glossary.md'), '# G\n');
    await writeFixture(join(src, 'features/active/SPEC-20260701-001-wip/_index.md'), '# WIP\n');
    await writeFixture(join(src, 'features/completed/SPEC-20250103-001-old/_index.md'), '# Old\n');
    await writeFixture(join(src, 'features/completed/SPEC-20260611-001-mid/_index.md'), '# Mid\n');
    await writeFixture(join(src, 'features/completed/SPEC-20260702-001-new/_index.md'), '# New\n');
    await writeFixture(join(src, 'features/completed/SPEC-20260702-001-new/phase-spec.md'), '# P\n');
    await writeFixture(join(src, 'features/completed/loose-note.md'), '# Loose\n');

    const run = runRenderCli(proj, []);
    assert.equal(run.code, 0, `yearpage render failed\nSTDERR:\n${run.stderr}`);
    const outDir = join(proj, 'dflow-specs-html');
    const index = await readOut(join(outDir, 'index.html'));

    // root: stub line with year links, newest first, unit counts; completed
    // spec files are NOT inlined; active stays inline
    assert.match(
      index,
      /<span class="dir">completed\/<\/span> <span class="years"><a href="features\/completed\/index-2026\.html">2026 \(2\)<\/a> · <a href="features\/completed\/index-2025\.html">2025 \(1\)<\/a> · <a href="features\/completed\/index-other\.html">未分年 \(1\)<\/a><\/span>/,
      'root completed stub carries year links'
    );
    assert.doesNotMatch(index, /SPEC-20260702-001-new\/_index\.html/, 'root no longer inlines completed spec files');
    assert.match(index, /<a href="features\/active\/SPEC-20260701-001-wip\/_index\.html">/, 'active stays inline');

    // year page: heading, sibling nav, newest-first units, page-relative
    // links, crumb back to root
    const y2026 = await readOut(join(outDir, 'features/completed/index-2026.html'));
    assert.match(y2026, /<h1>completed \/ 2026<\/h1>/);
    assert.match(y2026, /<p class="yearnav"><strong>2026<\/strong> · <a href="index-2025\.html">2025<\/a> · <a href="index-other\.html">未分年<\/a><\/p>/);
    const posNew = y2026.indexOf('SPEC-20260702-001-new');
    const posMid = y2026.indexOf('SPEC-20260611-001-mid');
    assert.ok(posNew !== -1 && posMid !== -1 && posNew < posMid, 'year page lists SPEC dirs newest-first');
    assert.match(y2026, /<a href="SPEC-20260702-001-new\/_index\.html">_index\.md<\/a>/, 'year-page links are page-relative');
    assert.match(y2026, /<a href="\.\.\/\.\.\/index\.html">specs<\/a> \/ features \/ completed \/ 2026/, 'crumb walks back to the root index');

    // other bucket lists non-conforming entries
    const other = await readOut(join(outDir, 'features/completed/index-other.html'));
    assert.match(other, /<a href="loose-note\.html">loose-note\.md<\/a>/);

    // ledger accounts the generated pages
    const manifest = await readManifest(outDir);
    assert.ok(manifest.files.includes('features/completed/index-2026.html'));
    assert.ok(manifest.files.includes('features/completed/index-other.html'));

    // emptied year: page stale-cleaned, root links updated
    await rm(join(src, 'features/completed/SPEC-20250103-001-old'), { recursive: true });
    assert.equal(runRenderCli(proj, []).code, 0, 'rerun after emptying a year');
    assert.equal(await exists(join(outDir, 'features/completed/index-2025.html')), false, 'emptied year page is stale-cleaned');
    assert.doesNotMatch(await readOut(join(outDir, 'index.html')), /index-2025\.html/, 'root year links drop the emptied year');

    // collision: a source at a reserved year-index path refuses before any
    // output mutation
    const proj2 = join(tempRoot, 'yearpage-collide');
    await writeFixture(join(proj2, 'dflow/specs/features/completed/SPEC-20260101-001-x/_index.md'), '# X\n');
    await writeFixture(join(proj2, 'dflow/specs/features/completed/index-2026.md'), '# fake\n');
    const collided = runRenderCli(proj2, []);
    assert.equal(collided.code, 1, 'reserved year-index name collision exits 1');
    assert.match(collided.stderr, /features\/completed\/index-2026\.md and the generated completed index for 2026 would both produce features\/completed\/index-2026\.html/);
    assert.equal(await exists(join(proj2, 'dflow-specs-html')), false, 'refusal precedes creating the output directory');

    // unit: grouping edges — year from the SPEC dir prefix, loose files
    // (even SPEC-named ones: only DIRECTORIES group by year) and
    // non-conforming dirs bucket to 'other', empty grouping is null
    const groups = render.groupCompletedByYear([
      'features/completed/SPEC-20260702-001-a/_index.md',
      'features/completed/SPEC-20260611-002-b/_index.md',
      'features/completed/notes.md',
      'features/completed/SPEC-20260101-x.md',
      'features/completed/legacy-dir/file.md',
      'features/active/SPEC-20260701-001-c/_index.md',
      'domain/glossary.md'
    ]);
    assert.deepEqual([...groups.keys()].sort(), ['2026', 'other']);
    assert.equal(groups.get('2026').units.size, 2);
    assert.deepEqual([...groups.get('other').units].sort(), ['SPEC-20260101-x.md', 'legacy-dir', 'notes.md'],
      'a loose SPEC-named FILE buckets to other, never to a year');
    assert.equal(render.groupCompletedByYear(['domain/x.md']), null, 'no completed entries -> no pagination');

    // unit: reserved-page collision variants (review p079-r1) — case
    // variant, source-directory shape, and the other-bucket name
    const reserved = [
      { out: 'index.html', what: 'the generated file tree' },
      { out: 'features/completed/index-2026.html', what: 'the generated completed index for 2026' },
      { out: 'features/completed/index-other.html', what: 'the generated completed index for 未分年' }
    ];
    assert.match(
      findProjectionCollision(['features/completed/INDEX-2026.md'], reserved),
      /INDEX-2026\.md and the generated completed index for 2026/,
      'reserved-page collision is case-insensitive'
    );
    assert.match(
      findProjectionCollision(['features/completed/index-2026.html/x.md'], reserved),
      /needs features\/completed\/index-2026\.html\/ as a directory, but render generates features\/completed\/index-2026\.html there/,
      'source directory squatting on a reserved year-index path refuses'
    );
    assert.match(
      findProjectionCollision(['features/completed/index-other.md'], reserved),
      /index-other\.md and the generated completed index for 未分年/,
      'the other-bucket page name is reserved too'
    );
  }

  // --- PROPOSAL-101: grouped root index on a recognised specs root ---
  // shared/_conventions.md marks a Dflow specs root; only then does the root
  // index group by top-level path (native <details>, closed on first open
  // unless there is only one) with purpose lines, collapsed reading guides
  // and path-scoped role labels, and do year pages gain their orientation
  // line. Any other --src keeps the pre-P101 tree and year pages, changed
  // only by encoding `%`, `#` and `?` in their hrefs — which applies on both
  // sides.
  {
    const unescapeAttr = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const hrefsOf = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => unescapeAttr(m[1]));
    // Resolve an href the way a browser does (WHATWG URL against the page's
    // own URL) and map the result back to an out-relative file path — the
    // target, not the href string, is what has to be right.
    const resolveHref = (pageRel, href) => {
      const url = new URL(href, `file:///out/${pageRel}`);
      assert.equal(url.protocol, 'file:', `${pageRel}: ${href} must stay a relative file link`);
      assert.ok(url.pathname.startsWith('/out/'), `${pageRel}: ${href} must stay inside the output`);
      try {
        return {
          rel: decodeURIComponent(url.pathname.slice('/out/'.length)),
          hash: url.hash ? decodeURIComponent(url.hash.slice(1)) : ''
        };
      } catch (error) {
        return assert.fail(`${pageRel}: ${href} resolves to an undecodable path ${url.pathname}${url.hash}`);
      }
    };
    const unstamped = (html) => html.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g, 'STAMP');
    const mainOf = (html) => unstamped(html.match(/<main>[^]*<\/main>/)[0]);
    const styleOf = (html) => html.match(/<style>[^]*<\/style>/)[0];
    const isGeneratedIndex = (rel) => rel === 'index.html' || /^features\/completed\/index-[^/]+\.html$/.test(rel);

    // Follow every link from index.html through the generated pages it
    // reaches. Each link must land on a file this run wrote (or on an id of
    // the same page), and every <details> on the way opens with a summary.
    async function crawl(outDir) {
      const manifest = await readManifest(outDir);
      const written = new Set(manifest.files);
      const reached = new Set();
      const queue = ['index.html'];
      const visited = new Set(queue);
      while (queue.length) {
        const page = queue.shift();
        const html = await readOut(join(outDir, ...page.split('/')));
        assert.equal(
          (html.match(/<details[^>]*>/g) || []).length,
          (html.match(/<details[^>]*><summary>/g) || []).length,
          `${page}: every <details> opens with a <summary>`
        );
        for (const href of hrefsOf(html)) {
          const { rel, hash } = resolveHref(page, href);
          if (rel === page && hash) {
            assert.ok(html.includes(` id="${hash}"`), `${page}: in-page link #${hash} has a target`);
            continue;
          }
          assert.ok(written.has(rel), `${page}: ${href} resolves to ${rel}, which this run did not write`);
          reached.add(rel);
          if (isGeneratedIndex(rel) && !visited.has(rel)) {
            visited.add(rel);
            queue.push(rel);
          }
        }
      }
      return { manifest, reached };
    }

    // `?` cannot be a Windows filename character; the pure-function checks
    // below cover it on every platform.
    const posix = process.platform !== 'win32';
    const proj = join(tempRoot, 'grouped');
    const src = join(proj, 'dflow/specs');
    const docs = [
      'shared/_conventions.md', 'shared/_overview.md', 'shared/AI-AGENT-GUIDE.md',
      'shared/dflow-workflows/templates/analysis.md', 'shared/dflow-workflows/references/new-feature-flow.md',
      'domain/zeta-notes.md', 'domain/analysis.md', 'domain/glossary.md', 'domain/context-map.md',
      'domain/Two/rules.md', 'domain/Two/behavior.md',
      'domain/Six/events.md', 'domain/Six/behavior.md', 'domain/Six/rules.md', 'domain/Six/models.md',
      'domain/Six/analysis.md', 'domain/Six/context-definition.md', 'domain/Six/aggregates/Order.md',
      'domain/Odd/zz.md', 'domain/Odd/notes.md',
      'domain/C#1/a&b.md', 'domain/C#1/100%.md',
      'features/README.md', 'features/custom/plan.md',
      'features/backlog/idea.md', 'features/backlog/中文 空格.md',
      'features/active/loose-active.md',
      'features/active/SPEC-20260701-001-a/notes.md', 'features/active/SPEC-20260701-001-a/phase-spec-2026-07-03-c.md',
      'features/active/SPEC-20260701-001-a/BUG-001-d.md', 'features/active/SPEC-20260701-001-a/lightweight-2026-07-02-b.md',
      'features/active/SPEC-20260701-001-a/_index.md', 'features/active/SPEC-20260701-001-a/phase-spec-2026-07-01-x.md',
      'features/active/SPEC-20260702-001-noindex/phase-spec.md', 'features/active/SPEC-20260702-001-noindex/lightweight-2026-07-05-y.md',
      'features/completed/SPEC-20260611-001-mid/_index.md', 'features/completed/SPEC-20260611-001-mid/BUG-002-z.md',
      'features/completed/SPEC-20260611-001-mid/phase-spec-2026-06-12-q.md', 'features/completed/SPEC-20260611-001-mid/phase-spec-2026-06-11-p.md',
      'features/completed/SPEC-20260611-001-mid/notes/n.md', 'features/completed/SPEC-20260612-001-p%41/_index.md',
      'features/completed/SPEC-20250103-001-old/_index.md', 'features/completed/loose-note.md',
      'architecture/tech-debt.md', 'architecture/decisions/ADR-0001.md', 'migration/tech-debt.md',
      'README.md', 'notes/meeting.md', 'notes/deep/x.md',
      ...(posix ? ['domain/Q?/x?.md', 'features/completed/SPEC-20260613-001-q?/_index.md'] : [])
    ];
    for (const rel of docs) {
      await writeFixture(join(src, ...rel.split('/')), `# ${rel}\n\nbody\n`);
    }
    const run = runRenderCli(proj, []);
    assert.equal(run.code, 0, `grouped render failed\nSTDERR:\n${run.stderr}`);
    const outDir = join(proj, 'dflow-specs-html');
    const index = await readOut(join(outDir, 'index.html'));
    const segments = index.split('<details class="ix-group" ');
    const group = (id) => segments.find((s) => s.startsWith(`id="g-${id}"`)) || '';
    const inOrder = (html, hrefs, message) => {
      const at = hrefs.map((href) => html.indexOf(`href="${href}"`));
      assert.ok(at.every((pos, i) => pos !== -1 && (i === 0 || pos > at[i - 1])), `${message}: ${hrefs.join(' < ')}`);
    };

    // reachable: every document from the index — completed ones through
    // their year page — with links resolved to the file itself
    const { manifest, reached } = await crawl(outDir);
    const mirrors = docs.map((rel) => `${rel.slice(0, -'.md'.length)}.html`);
    for (const page of mirrors) {
      assert.ok(reached.has(page), `${page} is reachable from the index`);
    }
    // output contract: the same file set as before P101 — mirrors, the root
    // index and the year pages; no new page, script or style file
    assert.deepEqual(
      [...manifest.files].sort(),
      [...mirrors, 'index.html', 'features/completed/index-2025.html', 'features/completed/index-2026.html', 'features/completed/index-other.html'].sort()
    );

    // grouping: each document in its group; only the start link repeats one
    for (const [id, hrefs] of Object.entries({
      features: ['features/README.html', 'features/custom/plan.html', 'features/active/loose-active.html', 'features/backlog/idea.html'],
      domain: ['domain/analysis.html', 'domain/Six/analysis.html', 'domain/Six/aggregates/Order.html', 'domain/Odd/zz.html'],
      arch: ['architecture/decisions/ADR-0001.html', 'migration/tech-debt.html'],
      shared: ['shared/dflow-workflows/templates/analysis.html', 'shared/_conventions.html'],
      other: ['README.html', 'notes/meeting.html', 'notes/deep/x.html']
    })) {
      for (const href of hrefs) {
        assert.ok(group(id).includes(`href="${href}"`), `${href} is listed in the ${id} group`);
      }
    }
    const seenHrefs = new Map();
    for (const href of hrefsOf(index)) {
      seenHrefs.set(href, (seenHrefs.get(href) || 0) + 1);
    }
    for (const [href, n] of seenHrefs) {
      assert.equal(n, href === 'shared/_overview.html' ? 2 : 1, `${href} is linked ${n} time(s) from the index`);
    }
    assert.ok(index.includes(`<p class="ix-head">共 ${docs.length} 份文件 · 從這裡開始：<a href="shared/_overview.html">shared/_overview.md</a></p>`));

    // role labels: exact path shapes only
    assert.ok(group('domain').includes('<a href="domain/analysis.html">analysis.md</a> <span class="ix-role">跨 context 分析</span>'));
    assert.ok(group('domain').includes('<a href="domain/Six/analysis.html">analysis.md</a> <span class="ix-role">context 分析</span>'));
    assert.ok(group('features').includes('<a href="features/active/SPEC-20260701-001-a/_index.html">_index.md</a> <span class="ix-role">feature 總覽</span>'));
    assert.ok(group('shared').includes('<a href="shared/dflow-workflows/templates/analysis.html">analysis.md</a></li>'), 'a template analysis.md gets no role label');
    assert.equal((index.match(/class="ix-role"/g) || []).length, 4, 'three document labels plus the dflow-workflows/ one');

    // fixed order: domain's own files first (known names, then by name),
    // then one row per directory by name, known files first in each row
    inOrder(group('domain'), [
      'domain/context-map.html', 'domain/glossary.html', 'domain/analysis.html', 'domain/zeta-notes.html',
      'domain/C%231/100%25.html', 'domain/C%231/a&amp;b.html',
      'domain/Odd/notes.html', 'domain/Odd/zz.html',
      'domain/Six/context-definition.html', 'domain/Six/analysis.html', 'domain/Six/models.html', 'domain/Six/rules.html',
      'domain/Six/behavior.html', 'domain/Six/events.html', 'domain/Six/aggregates/Order.html',
      'domain/Two/rules.html', 'domain/Two/behavior.html'
    ], 'domain order');
    assert.ok(group('domain').includes('<details class="ix-sub"><summary><span class="ix-dname">aggregates/</span> <span class="ix-count">1 份</span></summary>'), 'a deeper directory is a named disclosure with its count');
    // shuffled input, same page
    const completedOf = (rels) => render.groupCompletedByYear(rels);
    const sortedHtml = render.groupedIndexHtml({ relFiles: [...docs].sort(), title: 't', completedGroups: completedOf(docs) });
    for (const variant of [[...docs].reverse(), [...docs.slice(9), ...docs.slice(0, 9)]]) {
      assert.equal(render.groupedIndexHtml({ relFiles: variant, title: 't', completedGroups: completedOf(variant) }), sortedHtml, 'input order never changes the index');
    }

    // uneven sets: nothing dropped, nothing invented, no gaps or hints
    assert.ok(group('domain').includes('<div class="ix-rowname path">Two/</div><div class="ix-docs"><span><a href="domain/Two/rules.html">rules.md</a></span><span><a href="domain/Two/behavior.html">behavior.md</a></span></div>'));
    assert.ok(group('domain').includes('<div class="ix-rowname path">Odd/</div><div class="ix-docs"><span><a href="domain/Odd/notes.html">notes.md</a></span><span><a href="domain/Odd/zz.html">zz.md</a></span></div>'));
    assert.doesNotMatch(index, /class="badge|缺|missing/, 'no status badges and no missing-document hints');

    // features: one row per feature directory, one file per line —
    // _index.md first, then the files whose name carries a date by that
    // date, then the rest by name; loose and custom paths stay
    const featureA = 'features/active/SPEC-20260701-001-a/';
    assert.ok(group('features').includes(
      `<div class="ix-rowname path">SPEC-20260701-001-a/</div><div class="ix-docs stack"><ul class="ix-list"><li><a href="${featureA}_index.html">_index.md</a> <span class="ix-role">feature 總覽</span></li>` +
      ['phase-spec-2026-07-01-x', 'lightweight-2026-07-02-b', 'phase-spec-2026-07-03-c', 'BUG-001-d', 'notes']
        .map((stem) => `<li><a href="${featureA}${stem}.html">${stem}.md</a></li>`).join('') + '</ul></div></div>'
    ), 'feature row: _index.md, then by the date in the name, then by name');
    assert.ok(group('features').includes(
      '<div class="ix-rowname path">SPEC-20260702-001-noindex/</div><div class="ix-docs stack"><ul class="ix-list">' +
      '<li><a href="features/active/SPEC-20260702-001-noindex/lightweight-2026-07-05-y.html">lightweight-2026-07-05-y.md</a></li>' +
      '<li><a href="features/active/SPEC-20260702-001-noindex/phase-spec.html">phase-spec.md</a></li></ul></div></div>'
    ), 'a feature without _index.md lists every file the same way');
    assert.doesNotMatch(group('features'), /其餘/, 'no file of a feature row hides behind a disclosure');
    assert.ok(group('features').includes('<details class="ix-sub"><summary><span class="ix-dname">custom/</span> <span class="ix-count">1 份</span></summary>'));
    inOrder(group('features'), ['features/README.html', 'features/active/loose-active.html', 'features/active/SPEC-20260701-001-a/_index.html',
      'features/backlog/idea.html', 'features/completed/index-2026.html', 'features/custom/plan.html'], 'features order');
    assert.ok(group('features').includes(
      `<h3>completed/</h3><p class="ix-years"><span class="years"><a href="features/completed/index-2026.html">2026 (${posix ? 3 : 2})</a> · ` +
      '<a href="features/completed/index-2025.html">2025 (1)</a> · <a href="features/completed/index-other.html">未分年 (1)</a></span></p>'
    ), 'completed/ keeps its year links and unit counts');

    // collapsed structure: all groups closed, counts in every summary,
    // guides in their own closed disclosure with no navigation links
    const groupTags = index.match(/<details class="ix-group"[^>]*>/g);
    assert.deepEqual(groupTags.map((tag) => tag.match(/id="g-([a-z]+)"/)[1]), ['features', 'domain', 'arch', 'shared', 'other']);
    assert.ok(groupTags.every((tag) => !tag.includes(' open')), 'no group starts open');
    const countOf = (re) => docs.filter((rel) => re.test(rel)).length;
    for (const [id, n] of Object.entries({
      features: countOf(/^features\//),
      domain: countOf(/^domain\//),
      arch: countOf(/^(architecture|migration)\//),
      shared: countOf(/^shared\//),
      other: countOf(/^(?!(features|domain|architecture|migration|shared)\/)/)
    })) {
      assert.match(group(id), new RegExp(`^[^]*?<span class="ix-count">${n} 份</span> <span class="ix-purpose">`), `${id} summary counts ${n}`);
    }
    assert.equal((index.match(/<p class="ix-jump">跳到：/g) || []).length, 1);
    const guides = index.match(/<details class="ix-guide"[^>]*>[^]*?<\/details>/g);
    assert.equal(guides.length, 4, 'every group but the catch-all carries a guide');
    assert.ok(guides.every((guide) => guide.startsWith('<details class="ix-guide"><summary>') && !guide.includes('<a ')), 'guides are closed and hold no links');
    const solo = render.groupedIndexHtml({ relFiles: ['shared/_conventions.md', 'shared/notes.md'], title: 't', completedGroups: null });
    assert.ok(solo.includes('<details class="ix-group" id="g-shared" open>'), 'an only group opens');
    assert.ok(!solo.includes('ix-jump'), 'no jump links for an only group');

    // features/ without active/, without backlog/, or with neither: every
    // document of the parts that exist is listed, and nothing is said about
    // the part that does not
    for (const [label, relFiles] of Object.entries({
      'no active/': ['shared/_conventions.md', 'features/README.md', 'features/backlog/idea.md'],
      'no backlog/': ['shared/_conventions.md', 'features/active/SPEC-20260701-001-a/_index.md', 'features/active/loose.md'],
      'neither': ['shared/_conventions.md', 'features/completed/SPEC-20260102-001-x/_index.md']
    })) {
      let html = '';
      assert.doesNotThrow(() => {
        html = render.groupedIndexHtml({ relFiles, title: 't', completedGroups: render.groupCompletedByYear(relFiles) });
      }, `${label}: the grouped index renders`);
      const features = html.split('<details class="ix-group" ').find((s) => s.startsWith('id="g-features"')) || '';
      for (const rel of relFiles.filter((r) => /^features\/(?!completed\/)/.test(r))) {
        assert.ok(features.includes(`href="${rel.slice(0, -'.md'.length)}.html"`), `${label}: ${rel} is listed`);
      }
      for (const part of ['active', 'backlog']) {
        assert.equal(features.includes(`${part}/`), relFiles.some((r) => r.startsWith(`features/${part}/`)),
          `${label}: ${part}/ is mentioned only when it exists`);
      }
      assert.equal(features.includes('<a href="features/completed/index-2026.html">2026 (1)</a>'), label === 'neither',
        `${label}: completed/ gets its year link exactly when it exists`);
    }

    // names: Unicode, spaces, &, #, % (and ? where the platform allows it)
    // show as-is, escape in text and attributes, and link to the right file
    assert.ok(group('domain').includes('<div class="ix-rowname path">C#1/</div>'));
    assert.ok(group('domain').includes('<a href="domain/C%231/a&amp;b.html">a&amp;b.md</a>'));
    assert.ok(group('domain').includes('<a href="domain/C%231/100%25.html">100%.md</a>'));
    assert.ok(group('features').includes('<a href="features/backlog/中文 空格.html">中文 空格.md</a>'));
    if (posix) {
      assert.ok(group('domain').includes('<a href="domain/Q%3F/x%3F.html">x?.md</a>'));
    }
    const qHtml = render.groupedIndexHtml({ relFiles: ['shared/_conventions.md', 'domain/Q?/x?.md', 'odd?/y.md'], title: 't', completedGroups: null });
    assert.ok(qHtml.includes('<a href="domain/Q%3F/x%3F.html">x?.md</a>') && qHtml.includes('<a href="odd%3F/y.html">y.md</a>'), '? is encoded on every platform');

    // year page on a recognised root: the orientation line, the index CSS
    // and the same feature rows (no tree); PROPOSAL-079's grouping,
    // newest-first directory order, nav, crumb and relative links unchanged
    const y2026 = await readOut(join(outDir, 'features/completed/index-2026.html'));
    assert.match(y2026, /<p class="yearnav"><strong>2026<\/strong> · <a href="index-2025\.html">2025<\/a> · <a href="index-other\.html">未分年<\/a><\/p><p class="ix-note">這一頁是已完成 feature 的歷史紀錄/);
    assert.match(styleOf(y2026), /\.ix-note \{/);
    assert.doesNotMatch(y2026, /<ul class="tree">/, 'no file tree on a recognised year page');
    assert.ok(y2026.includes('<a href="SPEC-20260612-001-p%2541/_index.html">_index.md</a>'), 'year-page links encode % too');
    inOrder(y2026, [
      ...(posix ? ['SPEC-20260613-001-q%3F/_index.html'] : []),
      'SPEC-20260612-001-p%2541/_index.html', 'SPEC-20260611-001-mid/_index.html'
    ], 'year page lists SPEC dirs newest-first');
    assert.ok(y2026.includes(
      '<div class="ix-rowname path">SPEC-20260611-001-mid/</div><div class="ix-docs stack"><ul class="ix-list">' +
      ['_index', 'phase-spec-2026-06-11-p', 'phase-spec-2026-06-12-q', 'BUG-002-z']
        .map((stem) => `<li><a href="SPEC-20260611-001-mid/${stem}.html">${stem}.md</a></li>`).join('') +
      '</ul><details class="ix-sub"><summary><span class="ix-dname">notes/</span> <span class="ix-count">1 份</span></summary>' +
      '<ul class="ix-list"><li><a href="SPEC-20260611-001-mid/notes/n.html">n.md</a></li></ul></details></div></div>'
    ), 'year-page rows use the feature file order; a deeper directory is a disclosure');
    assert.ok(!y2026.includes('class="ix-role"'), 'no role labels on a year page');
    const yOther = await readOut(join(outDir, 'features/completed/index-other.html'));
    assert.ok(yOther.includes('<div class="ix-year"><ul class="ix-list"><li><a href="loose-note.html">loose-note.md</a></li></ul></div>'), 'loose archive files list after the rows');
    assert.match(y2026, /<a href="\.\.\/\.\.\/index\.html">specs<\/a> \/ features \/ completed \/ 2026/);
    for (const page of ['index.html', 'features/completed/index-2026.html', 'features/completed/index-other.html']) {
      const html = await readOut(join(outDir, ...page.split('/')));
      assert.doesNotMatch(html, /<script|\son[a-z]+=/i, `${page} carries no script and no event attribute`);
    }
    // mirror pages never get the index CSS or any guide text
    assert.doesNotMatch(await readOut(join(outDir, 'domain/Six/rules.html')), /ix-|怎麼讀這些文件/);

    // content never matters: new titles, first paragraphs and status fields
    // with every path unchanged leave the index and year pages as they were
    const beforeEdits = [index, y2026].map(unstamped);
    await writeFixture(join(src, 'domain/Six/rules.md'), '---\ntitle: 全新的標題\nstatus: deprecated\n---\n# Changed\n\nA different first paragraph.\n');
    await writeFixture(join(src, 'features/backlog/idea.md'), '> Superseded: do not use.\n\n# Idea v2\n');
    await writeFixture(join(src, 'features/completed/SPEC-20260611-001-mid/_index.md'), '---\nstatus: completed\n---\n# Mid, retitled\n');
    assert.equal(runRenderCli(proj, []).code, 0, 'rerun after content-only edits');
    assert.deepEqual(
      [await readOut(join(outDir, 'index.html')), await readOut(join(outDir, 'features/completed/index-2026.html'))].map(unstamped),
      beforeEdits,
      'content-only edits leave the index and the year page unchanged'
    );

    // an emptied year still disappears on a recognised root
    await rm(join(src, 'features/completed/SPEC-20250103-001-old'), { recursive: true });
    assert.equal(runRenderCli(proj, []).code, 0, 'rerun after emptying a year');
    assert.equal(await exists(join(outDir, 'features/completed/index-2025.html')), false, 'emptied year page is stale-cleaned');
    assert.doesNotMatch(await readOut(join(outDir, 'index.html')), /index-2025\.html/, 'the Features group drops the emptied year');

    // not a specs root (no shared/_conventions.md) — even with features/ and
    // shared/ at the top: the pre-P101 tree and year page, byte for byte,
    // apart from the three encoded characters; no index CSS
    const plainProj = join(tempRoot, 'grouped-unrecognised');
    for (const rel of [
      'features/active/SPEC-20260701-001-wip/_index.md', 'features/completed/SPEC-20260102-002-h#x/_index.md',
      'features/completed/loose.md', 'shared/notes.md', 'domain/glossary.md', 'd#1/f.md', '100%.md', 'a b&c.md'
    ]) {
      await writeFixture(join(plainProj, 'dflow/specs', ...rel.split('/')), `# ${rel}\n`);
    }
    assert.equal(runRenderCli(plainProj, []).code, 0, 'unrecognised render');
    const plainOut = join(plainProj, 'dflow-specs-html');
    const plainIndex = await readOut(join(plainOut, 'index.html'));
    assert.equal(mainOf(plainIndex), '<main>\n<p class="crumb">specs /</p>\n\n' +
      '<h1>dflow specs</h1><ul class="tree"><li><span class="dir">d#1/</span><ul class="tree"><li><a href="d%231/f.html">f.md</a></li></ul></li>' +
      '<li><span class="dir">domain/</span><ul class="tree"><li><a href="domain/glossary.html">glossary.md</a></li></ul></li>' +
      '<li><span class="dir">features/</span><ul class="tree"><li><span class="dir">active/</span><ul class="tree"><li><span class="dir">SPEC-20260701-001-wip/</span>' +
      '<ul class="tree"><li><a href="features/active/SPEC-20260701-001-wip/_index.html">_index.md</a></li></ul></li></ul></li>' +
      '<li><span class="dir">completed/</span> <span class="years"><a href="features/completed/index-2026.html">2026 (1)</a> · ' +
      '<a href="features/completed/index-other.html">未分年 (1)</a></span></li></ul></li>' +
      '<li><span class="dir">shared/</span><ul class="tree"><li><a href="shared/notes.html">notes.md</a></li></ul></li>' +
      '<li><a href="100%25.html">100%.md</a></li><li><a href="a b&amp;c.html">a b&amp;c.md</a></li></ul>\n' +
      '<p class="foot">共 8 份文件 · STAMP · 來源檔較新時請重新執行 dflow render</p>\n</main>');
    const plainYear = await readOut(join(plainOut, 'features/completed/index-2026.html'));
    assert.equal(mainOf(plainYear), '<main>\n<p class="crumb"><a href="../../index.html">specs</a> / features / completed / 2026</p>\n\n' +
      '<h1>completed / 2026</h1><p class="yearnav"><strong>2026</strong> · <a href="index-other.html">未分年</a></p>' +
      '<ul class="tree"><li><span class="dir">SPEC-20260102-002-h#x/</span><ul class="tree"><li><a href="SPEC-20260102-002-h%23x/_index.html">_index.md</a></li></ul></li></ul>\n' +
      '<p class="foot">completed 2026 · 共 1 項 · STAMP · 來源檔較新時請重新執行 dflow render</p>\n</main>');
    const plainMirrorStyle = styleOf(await readOut(join(plainOut, 'shared/notes.html')));
    assert.equal(styleOf(plainIndex), plainMirrorStyle, 'no index CSS on an unrecognised root');
    assert.equal(styleOf(plainYear), plainMirrorStyle, 'no index CSS on its year pages either');
    const plainCrawl = await crawl(plainOut);
    for (const rel of plainCrawl.manifest.files.filter((f) => !isGeneratedIndex(f))) {
      assert.ok(plainCrawl.reached.has(rel), `${rel} is reachable from the unrecognised index`);
    }
  }

  // --- PROPOSAL-100: lifecycle / flow diagrams in analysis.md ---
  // Recognition and the "not drawn" cases: the placeholder-row lock against
  // the shipped template, one fixture per note, references that name no
  // character, containment of a subsection that throws, placement right
  // before the subsection's first recognised table, cards and other pages
  // untouched, unique ids on a page with several pictures, the stdout line,
  // and determinism.
  {
    const { Marked } = await import('marked');
    const lex = (md) => new Marked({ gfm: true }).lexer(md);

    // the placeholder rows compared against are the shipped template's, in both tracks
    const rowMap = (table) => table.rows.map((row) => Object.fromEntries(table.headers.map((h, i) => [h, row[i].raw])));
    for (const edition of ['greenfield', 'brownfield']) {
      const template = await readFile(join(repoRoot, 'templates', edition, 'templates', 'analysis.md'), 'utf8');
      const subs = diagrams.findEntrySubsections(lex(template));
      assert.deepEqual(subs.map((sub) => sub.entryId), ['FL-01', 'LC-01'], `${edition}: template subsections`);
      const [fl, lc] = subs;
      assert.deepEqual(rowMap(fl.tables[0]), [diagrams.TEMPLATE_PLACEHOLDER_ROWS.flow[0]], `${edition}: FL placeholder row`);
      assert.deepEqual(rowMap(lc.tables[0]), [diagrams.TEMPLATE_PLACEHOLDER_ROWS.states[0]], `${edition}: LC state placeholder row`);
      assert.deepEqual(rowMap(lc.tables[1]), [diagrams.TEMPLATE_PLACEHOLDER_ROWS.transitions[0]], `${edition}: LC transition placeholder row`);
      assert.deepEqual(diagrams.flowModel(fl), { skip: true }, `${edition}: template FL draws nothing`);
      assert.deepEqual(diagrams.lifecycleModel(lc), { skip: true }, `${edition}: template LC draws nothing`);
    }

    const fixture = [
      '# Domain Analysis',
      '',
      '## Cross-Context Flows',
      '',
      '### FL-01: 送出到核准',
      '',
      '交手順序如下。',
      '',
      '| # | From | To | Handed over | State change | Evidence |',
      '|---|---|---|---|---|---|',
      '| 1 | Expense | Approval | `ExpenseReportSubmitted` | Draft → Submitted | code - Submit() (2026-05-07) |',
      '| 2 | Approval | Expense | `ApprovalDecision` | Submitted → Approved | inferred - Approve() (2026-05-07) |',
      '',
      '### FL-02: 編號跳號',
      '',
      '| # | From | To | Handed over |',
      '|---|---|---|---|',
      '| 1 | A | B | x |',
      '| 3 | B | A | y |',
      '',
      '### FL-03: {流程名稱}',
      '',
      '| # | From | To | Handed over | State change | Evidence |',
      '|---|---|---|---|---|---|',
      '| 1 | {Context A} | {Context B} | {交出去的是什麼：欄位、識別鍵或事件} | {造成什麼狀態變化} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |',
      '',
      '### FL-04: 兩張流程表',
      '',
      '| # | From | To | Handed over |',
      '|---|---|---|---|',
      '| 1 | A | B | x |',
      '',
      '| # | From | To | Handed over |',
      '|---|---|---|---|',
      '| 1 | B | A | y |',
      '',
      // references that name no character stay as written (they used to throw
      // and take every picture and note on the page with them); seven digits
      // or six hex digits only in a header-only table, which render's own
      // card code does not decode
      '### FL-05: 表頭裡的字元參照',
      '',
      '| # | From | To | Handed over &#1114112; | State change &#x110000; |',
      '|---|---|---|---|---|',
      '',
      // a doubled table is reported even when both copies hold only template rows
      '### FL-06: 兩張只有範本列的流程表',
      '',
      '| # | From | To | Handed over | State change | Evidence |',
      '|---|---|---|---|---|---|',
      '| 1 | {Context A} | {Context B} | {交出去的是什麼：欄位、識別鍵或事件} | {造成什麼狀態變化} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |',
      '',
      '| # | From | To | Handed over | State change | Evidence |',
      '|---|---|---|---|---|---|',
      '| 1 | {Context A} | {Context B} | {交出去的是什麼：欄位、識別鍵或事件} | {造成什麼狀態變化} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |',
      '',
      '## Lifecycles',
      '',
      '### LC-01: Report.Status（`Reports.Status`）',
      '',
      '| State | Means |',
      '|---|---|',
      '| `Draft` | 還在填 |',
      '| `Submitted` | 等審 |',
      '| `Approved` | 已核准 |',
      '',
      '| From | Trigger | To | Guard | Evidence |',
      '|---|---|---|---|---|',
      '| `Draft` | 送出（`Submit()`） | `Submitted` | BR-001 | code - Submit() (2026-05-07) |',
      '| `Submitted` | 核准 | `Approved` | BR-002<br>BR-003 | assumed - 待確認 (2026-05-07) |',
      '',
      '- 清單裡的表格不屬於這個小節的紀錄形狀：',
      '',
      '  | From | Trigger | To |',
      '  |---|---|---|',
      '  | x | y | z |',
      '',
      '### LC-02: {狀態欄位名稱}（`{存放位置：資料表.欄位，或 Aggregate 屬性}`）',
      '',
      '| State | Means |',
      '|---|---|',
      '| `{狀態值}` | {這個狀態允許或擋住接下來的什麼} |',
      '',
      '| From | Trigger | To | Guard | Evidence |',
      '|---|---|---|---|---|',
      '| `{原狀態}` | {誰做了什麼} | `{新狀態}` | {決定它的 BR-ID；沒有規則決定就寫必須成立的條件，都沒有就留空} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |',
      '',
      '### LC-03: 範本列還留著',
      '',
      '| State | Means |',
      '|---|---|',
      '| `{狀態值}` | {這個狀態允許或擋住接下來的什麼} |',
      '| `Open` | 開著 |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `Open` | 重開 | `Open` |',
      '',
      '### LC-04: 終點不在狀態表',
      '',
      '| State | Means |',
      '|---|---|',
      '| `Open` | 開著 |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `Open` | 關 | `Closed` |',
      '',
      '### LC-05: 狀態重複',
      '',
      '| State | Means |',
      '|---|---|',
      '| `Open` | 開著 |',
      '| `Open` | 又開著 |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `Open` | 重開 | `Open` |',
      '',
      '### LC-06: 只有狀態表',
      '',
      '| State | Means |',
      '|---|---|',
      '| `Open` | 開著 |',
      '',
      '### LC-07: 關鍵欄位還是佔位',
      '',
      '| State | Means |',
      '|---|---|',
      '| `Open` | 開著 |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `{原狀態}` | 重開 | `Open` |',
      '',
      '### LC-08: 一格兩個值',
      '',
      '| State | Means |',
      '|---|---|',
      '| `A` | a |',
      '| `B` | b |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `A`<br>`B` | 合併 | `B` |',
      '',
      '### LC-09: 寫在別處',
      '',
      '這個生命週期記在 `models.md` 的 State Machine，這裡不重抄。',
      '',
      '### LC-10: 太多狀態',
      '',
      '| State | Means |',
      '|---|---|',
      ...Array.from({ length: 17 }, (_, i) => `| \`S${i + 1}\` | s |`),
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `S1` | 下一步 | `S2` |',
      '',
      '### LC-11: 讀不成表格的表',
      '',
      '| From | Trigger | To',
      'x | y | z',
      '',
      '### LC-12: 轉義',
      '',
      '| State | Means |',
      '|---|---|',
      '| `Open` | 開著 |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `Open` | 關 | `A<B&"C"` |',
      '',
      // a table missing beside an untouched template table is reported, not skipped
      '### LC-13: 只有範本的狀態表',
      '',
      '| State | Means |',
      '|---|---|',
      '| `{狀態值}` | {這個狀態允許或擋住接下來的什麼} |',
      '',
      '### LC-14: 只有範本的轉移表',
      '',
      '| From | Trigger | To | Guard | Evidence |',
      '|---|---|---|---|---|',
      '| `{原狀態}` | {誰做了什麼} | `{新狀態}` | {決定它的 BR-ID；沒有規則決定就寫必須成立的條件，都沒有就留空} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |',
      '',
      '### LC-15: 兩張狀態表',
      '',
      '| State |',
      '|---|',
      '| `Open` |',
      '',
      '| State |',
      '|---|',
      '| `Closed` |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `Open` | 關 | `Closed` |',
      '',
      '### LC-16: 不是字元的字元參照',
      '',
      '| State | Means |',
      '|---|---|',
      '| `A` | 超出範圍 &#999999999999999; |',
      '| B &#99999999; | 八位數 |',
      '',
      '| From | Trigger | To |',
      '|---|---|---|',
      '| `A` | 送出 &#88888888; | B &#99999999; |',
      ''
    ].join('\n');

    const proj = join(tempRoot, 'diagrams');
    const src = join(proj, 'dflow/specs');
    await writeFixture(join(src, 'domain/analysis.md'), fixture);
    await writeFixture(join(src, 'domain/analysis-copy.md'), fixture);

    const run = runRenderCli(proj, []);
    assert.equal(run.code, 0, `diagram render failed\nSTDERR:\n${run.stderr}`);
    assert.match(run.stdout, /^rendered 2 md files -> .*\ndiagrams: 3 drawn, 15 not drawn\n(?: {2}not drawn: .*\n){15}open: /m,
      'stdout carries the diagram line, then one line per note, between the two existing lines');

    const outDir = join(proj, 'dflow-specs-html');
    const page = await readOut(join(outDir, 'domain/analysis.html'));
    const copy = await readOut(join(outDir, 'domain/analysis-copy.html'));

    const notes = [...page.matchAll(/<p class="dflow-dg-notice">(.*)<\/p>/g)].map((m) => m[1]);
    assert.deepEqual(notes, [
      'FL-02 沒有畫成圖：流程表第 2 列的 # 是「3」，照列序應該是 2。',
      'FL-04 沒有畫成圖：有 2 張流程表，只能有一張。',
      'FL-05 沒有畫成圖：找不到流程表（要有 From、To、Handed over 欄）。',
      'FL-06 沒有畫成圖：有 2 張流程表，只能有一張。',
      'LC-03 沒有畫成圖：狀態表第 1 列還是範本的佔位列。',
      'LC-04 沒有畫成圖：轉移表第 1 列的 To（Closed）不在狀態表裡。',
      'LC-05 沒有畫成圖：狀態表第 2 列的狀態 Open 重複（第 1 列已有）。',
      'LC-06 沒有畫成圖：找不到轉移表（要有 From、Trigger、To 欄）。',
      'LC-07 沒有畫成圖：轉移表第 1 列的 From 還是佔位文字（{原狀態}）。',
      'LC-08 沒有畫成圖：轉移表第 1 列的 From 有 2 個值，圖上一格只能畫一個。',
      'LC-10 沒有畫成圖：狀態 17 個，超過上限 12。',
      'LC-12 沒有畫成圖：轉移表第 1 列的 To（A&lt;B&amp;&quot;C&quot;）不在狀態表裡。',
      'LC-13 沒有畫成圖：找不到轉移表（要有 From、Trigger、To 欄）。',
      'LC-14 沒有畫成圖：找不到狀態表（要有 State 欄）。',
      'LC-15 沒有畫成圖：有 2 張狀態表，只能有一張。'
    ], 'one note per undrawable subsection, in page order, values escaped');
    // stdout names the same notes, in the same order, with the file each is
    // in and the reason unescaped — the copy not named analysis.md has none.
    const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    const listed = [...run.stdout.matchAll(/^ {2}not drawn: (.*)$/gm)].map((m) => m[1]);
    assert.deepEqual(listed, notes.map((note) => {
      const [, id, reason] = /^([A-Z]{2}-\d+) 沒有畫成圖：(.*)。$/.exec(note);
      return `domain/analysis.md ${id} — ${unescape(reason)}`;
    }), 'one stdout line per page note: file, entry id and reason');
    const figures = [...page.matchAll(/<figure class="dflow-dg dg-(lc|fl)" data-entry="([^"]+)">/g)].map((m) => m[2]);
    assert.deepEqual(figures, ['FL-01', 'LC-01', 'LC-16'], 'only the filled, well-formed subsections are drawn');
    assert.ok(page.includes('>B &amp;#99999999;</text>') && page.includes('>送出 &amp;#88888888;</text>'),
      'a reference that names no character reaches the picture as written');

    // several pictures on one page: every id on the page is unique, and each
    // picture's arrows point only at the marker defined inside that picture
    const pageIds = [...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(pageIds).size, pageIds.length, 'no id repeats on a page with several pictures');
    for (const html of page.match(/<figure class="dflow-dg [\s\S]*?<\/figure>\n/g)) {
      const own = /<marker id="([^"]+)"/.exec(html)[1];
      const refs = [...html.matchAll(/marker-end="url\(#([^)]+)\)"/g)].map((m) => m[1]);
      assert.ok(refs.length > 0 && refs.every((ref) => ref === own), `${own}: arrows use their own picture's marker`);
    }

    // placement: after the heading and its prose, right before the first recognised table
    assert.match(page, /<p>交手順序如下。<\/p>\n<figure class="dflow-dg dg-fl"[\s\S]*?<\/figure>\n<div class="cards">/);
    assert.match(page, /LC-06: 只有狀態表<\/h3>\n<p class="dflow-dg-notice">LC-06 [^<]*<\/p>\n<div class="cards">/);
    assert.match(page, /LC-01: Report\.Status（<code>Reports\.Status<\/code>）<\/h3>\n<figure class="dflow-dg dg-lc"/);

    // nothing for: template rows only (FL-03, LC-02), no table (LC-09), a table marked cannot read (LC-11)
    for (const id of ['FL-03', 'LC-02', 'LC-09', 'LC-11']) {
      assert.doesNotMatch(page, new RegExp(`(data-entry="${id}"|>${id} 沒有畫成圖)`), `${id} gets neither a picture nor a note`);
    }

    // the same tables in a file not named analysis.md are not drawn, and the
    // cards on the diagram page are byte-identical to that page's
    const styleOf = (html) => html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>'));
    const bodyOf = (html) => html.slice(html.indexOf('<main>'), html.indexOf('<p class="foot">')).replace(/<p class="crumb">.*<\/p>\n/, '');
    const withoutDiagrams = (html) => html.replace(/<figure class="dflow-dg [\s\S]*?<\/figure>\n/g, '').replace(/<p class="dflow-dg-notice">.*<\/p>\n/g, '');
    assert.doesNotMatch(copy, /dflow-dg/, 'a non-analysis.md page gets no diagrams');
    assert.equal(styleOf(page), styleOf(copy) + diagrams.DIAGRAM_CSS, 'diagram CSS is appended only to the page that has diagrams');
    assert.equal(withoutDiagrams(bodyOf(page)), bodyOf(copy), 'the cards around the diagrams are byte-identical');
    assert.doesNotMatch(page, /<script/i, 'the diagram page carries no script');

    // determinism: the same input renders the same page
    const again = runRenderCli(proj, ['--out', 'again']);
    assert.equal(again.code, 0);
    const unstamp = (html) => html.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g, 'STAMP');
    assert.equal(unstamp(await readOut(join(proj, 'again/domain/analysis.html'))), unstamp(page), 'diagram output is deterministic');

    // a copy holding only the template's rows renders as before: no picture, no note, no CSS, no stdout line
    const plain = join(tempRoot, 'diagrams-template');
    const template = await readFile(join(repoRoot, 'templates', 'greenfield', 'templates', 'analysis.md'), 'utf8');
    await writeFixture(join(plain, 'dflow/specs/domain/analysis.md'), template);
    await writeFixture(join(plain, 'dflow/specs/domain/other.md'), template);
    const plainRun = runRenderCli(plain, []);
    assert.equal(plainRun.code, 0);
    assert.doesNotMatch(plainRun.stdout, /diagrams:/, 'no diagram line when no subsection was drawn or noted');
    const plainPage = await readOut(join(plain, 'dflow-specs-html/domain/analysis.html'));
    const otherPage = await readOut(join(plain, 'dflow-specs-html/domain/other.html'));
    assert.equal(styleOf(plainPage), styleOf(otherPage), 'template-only analysis.md gets no diagram CSS');
    assert.equal(bodyOf(plainPage), bodyOf(otherPage), 'template-only analysis.md renders like any other page');

    // unit: the models the layouts receive
    const subs = diagrams.findEntrySubsections(lex(fixture));
    const lc01 = diagrams.lifecycleModel(subs.find((sub) => sub.entryId === 'LC-01'));
    assert.deepEqual(lc01.model, {
      kind: 'LC',
      entryId: 'LC-01',
      states: ['Draft', 'Submitted', 'Approved'],
      transitions: [
        { n: 1, from: 'Draft', to: 'Submitted', trigger: ['送出（Submit()）'], guard: ['BR-001'], evidenceType: 'code' },
        { n: 2, from: 'Submitted', to: 'Approved', trigger: ['核准'], guard: ['BR-002', 'BR-003'], evidenceType: 'assumed' }
      ]
    }, 'a value written as one code span is the span; <br> splits items');
    const fl01 = diagrams.flowModel(subs.find((sub) => sub.entryId === 'FL-01'));
    assert.deepEqual(fl01.model.participants, ['Expense', 'Approval'], 'participants in first-appearance order');
    assert.deepEqual(fl01.model.steps.map((s) => [s.n, s.from, s.to, s.handedOver, s.stateChange, s.evidenceType]), [
      [1, 'Expense', 'Approval', ['ExpenseReportSubmitted'], ['Draft → Submitted'], 'code'],
      [2, 'Approval', 'Expense', ['ApprovalDecision'], ['Submitted → Approved'], 'inferred']
    ]);
    assert.deepEqual([...diagrams.DASHED_EVIDENCE].sort(), ['assumed', 'inferred'], 'only these two evidence types are dashed');
    assert.deepEqual({ ...diagrams.DIAGRAM_LIMITS }, {
      LC_MAX_STATES: 12,
      LC_MAX_TRANSITIONS: 20,
      LC_MAX_SIDE_LANES: 4,
      LC_MAX_SIDE_PORTS: 6,
      FL_MAX_PARTICIPANTS: 8,
      FL_PRINT_MAX_PARTICIPANTS: 4,
      FL_MAX_STEPS: 10,
      DIAGRAM_MAX_WIDTH: 864,
      DIAGRAM_MAX_HEIGHT: 960,
      IDENTITY_MAX_CODEPOINTS: 64,
      FIELD_MAX_CODEPOINTS: 256,
      FIELD_MAX_ITEMS: 8,
      IDENTITY_MAX_LINES: 2,
      PRIMARY_MAX_LINES: 3,
      SECONDARY_MAX_LINES: 3,
      MAX_TRUNCATED_FIELDS: 2,
      LC_MAX_CROSSINGS: 4,
      LC_MAX_CROSSINGS_PER_EDGE: 2,
      CROSSING_ENDPOINT_CLEARANCE: 12,
      CROSSING_SEPARATION: 16,
      CROSSING_HALF_GAP: 5
    }, 'diagram limits are locked');
    assert.deepEqual(Object.keys(pkg.dependencies), ['marked'], 'diagrams add no runtime dependency');

    // a numeric reference decodes only when it names a character; any other
    // stays as written instead of throwing
    assert.deepEqual(diagrams.inlineItems(lex('a &#65;&#x42; &#1114112; &#x110000; &#999999999999999; &#0; &#xD800;')[0].tokens),
      ['a AB &#1114112; &#x110000; &#999999999999999; &#0; &#xD800;']);

    // containment: whatever throws while one subsection's tables are read
    // becomes that subsection's note, and every other subsection keeps its
    // picture or note; a throw while finding the subsections leaves the page
    // as it would be without diagrams
    const containMd = [
      '### LC-01: a', '', '| State |', '|---|', '| `A` |', '| `B` |', '', '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `B` |', '',
      '### LC-02: b', '', '| State |', '|---|', '| `A` |', '', '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `A` |', '',
      '### FL-01: c', '', '| From | To | Handed over |', '|---|---|---|', '| P | Q | x |', '',
      '### FL-02: d', '', '| Step |', '|---|', '| x |', ''
    ].join('\n');
    const inserted = (tokens) => tokens.filter((t) => t.type === 'html' && t.raw === '').map((t) => t.text);
    const broken = lex(containMd);
    const lc02 = broken.findIndex((t) => t.type === 'heading' && t.text.startsWith('LC-02'));
    broken.find((t, i) => i > lc02 && t.type === 'table').rows = null;
    const containPage = diagrams.newPageState();
    let contained = [];
    assert.doesNotThrow(() => {
      contained = inserted(diagrams.insertDiagrams(broken, containPage));
    }, 'a subsection that throws does not fail the page');
    assert.deepEqual({ drawn: containPage.drawn, notDrawn: containPage.notDrawn }, { drawn: 2, notDrawn: 2 }, 'the throwing subsection is counted as one note');
    assert.deepEqual(containPage.notes.map((n) => n.entryId), ['LC-02', 'FL-02'], 'the page state names each note, in page order');
    assert.deepEqual(contained.map((html) => (/data-entry="([^"]+)"/.exec(html) || /notice">([A-Z]{2}-\d+)/.exec(html))[1]),
      ['LC-01', 'LC-02', 'FL-01', 'FL-02'], 'every other subsection keeps its picture or note');
    assert.match(contained[1], /^<p class="dflow-dg-notice">LC-02 沒有畫成圖：畫圖時發生內部錯誤（[^）]+）。<\/p>\n$/);
    const unreadable = lex(containMd);
    unreadable[0].tokens = [{ type: 'text', get text() { throw new Error('unreadable heading'); } }];
    const untouchedPage = diagrams.newPageState();
    let untouched = null;
    assert.doesNotThrow(() => {
      untouched = inserted(diagrams.insertDiagrams(unreadable, untouchedPage));
    }, 'a throw while finding subsections does not fail the page');
    assert.equal(untouched.length, 0, 'nothing is inserted when finding subsections throws');
    assert.deepEqual({ ...untouchedPage }, { drawn: 0, notDrawn: 0, notes: [] });

    // The scope of three `--help` claims, pinned on behaviour: a flow has no
    // width limit (only a lifecycle does), Means / Evidence are not limited,
    // and an inferred or assumed Evidence adds a tag row that counts toward
    // the height. A help sentence that widens any of them fails the phrase
    // checks above; a renderer that starts limiting either cell, or stops
    // counting the tag, fails here.
    const DL = diagrams.DIAGRAM_LIMITS;
    const wideFlow = ['### FL-01: wide', '', '| From | To | Handed over |', '|---|---|---|',
      ...Array.from({ length: DL.FL_MAX_PARTICIPANTS - 1 }, (_, i) => `| P${i + 1} | P${i + 2} | x |`), ''].join('\n');
    const widePage = diagrams.newPageState();
    const wideHtml = inserted(diagrams.insertDiagrams(lex(wideFlow), widePage));
    assert.equal(widePage.drawn, 1, `a ${DL.FL_MAX_PARTICIPANTS}-participant flow is drawn`);
    const wideWidth = Number(/<svg[^>]*\swidth="(\d+)"/.exec(wideHtml[0])[1]);
    assert.ok(wideWidth > DL.DIAGRAM_MAX_WIDTH, `a flow is drawn wider than ${DL.DIAGRAM_MAX_WIDTH} (got ${wideWidth}): the width limit is a lifecycle limit`);
    const longCell = 'x'.repeat(DL.FIELD_MAX_CODEPOINTS + 44);
    const longLc = ['### LC-01: long cells', '', '| State | Means |', '|---|---|', `| \`A\` | ${longCell} |`, `| \`B\` | ${longCell} |`, '',
      '| From | Trigger | To | Guard | Evidence |', '|---|---|---|---|---|', `| \`A\` | t | \`B\` |  | code - ${longCell} |`, ''].join('\n');
    const longPage = diagrams.newPageState();
    inserted(diagrams.insertDiagrams(lex(longLc), longPage));
    assert.deepEqual({ drawn: longPage.drawn, notDrawn: longPage.notDrawn }, { drawn: 1, notDrawn: 0 },
      'Means and Evidence cells longer than the cell limit do not stop a lifecycle from being drawn');
    const flowHeight = (evidence) => {
      const md = ['### FL-01: tag row', '', '| # | From | To | Handed over | State change | Evidence |', '|---|---|---|---|---|---|',
        ...Array.from({ length: 4 }, (_, i) => `| ${i + 1} | ${i % 2 ? 'B' : 'A'} | ${i % 2 ? 'A' : 'B'} | x |  | ${evidence} - c |`), ''].join('\n');
      const page = diagrams.newPageState();
      const html = inserted(diagrams.insertDiagrams(lex(md), page));
      assert.equal(page.drawn, 1, `a four-step flow with ${evidence} Evidence is drawn`);
      return Number(/<svg[^>]*\sheight="(\d+)"/.exec(html[0])[1]);
    };
    for (const type of diagrams.DASHED_EVIDENCE) {
      assert.ok(flowHeight(type) > flowHeight('code'), `an ${type} Evidence's tag row makes the drawing taller than a code Evidence`);
    }
  }

  // --- PROPOSAL-100: diagram layout and SVG ---
  // The expected geometry below is copied from the layout specification's
  // worked examples (p100lay-x1), which were computed by hand, not by this
  // implementation: Expense LC-01 (real), OBTS StatusVerifyExp (transcribed),
  // a constructed nine-state lifecycle, a constructed five-step flow. Then
  // the emitted SVG is parsed and checked for the layout's invariants — on
  // those samples and on a fixed-seed random corpus.
  {
    const { Marked } = await import('marked');
    const lex = (md) => new Marked({ gfm: true }).lexer(md);
    const pathPoints = (d) => {
      const points = [];
      let x = 0;
      let y = 0;
      for (const [, cmd, a, b] of d.matchAll(/([MVHL])(-?\d+(?:\.\d+)?)(?: (-?\d+(?:\.\d+)?))?/g)) {
        if (cmd === 'M' || cmd === 'L') { x = Number(a); y = Number(b); } else if (cmd === 'V') { y = Number(a); } else { x = Number(a); }
        points.push([x, y]);
      }
      return points;
    };
    const textsOf = (html) => [...html.matchAll(/<text class="([^"]+)" x="(-?\d+)" y="(-?\d+)">([^<]*)<\/text>/g)]
      .map((m) => ({ cls: m[1], x: Number(m[2]), y: Number(m[3]), text: m[4] }));
    const parse = (html) => {
      const svg = /<svg [^>]*>/.exec(html)[0];
      const attr = (name) => new RegExp(`\\s${name}="([^"]*)"`).exec(svg)[1];
      return {
        width: Number(attr('width')),
        height: Number(attr('height')),
        viewBox: attr('viewBox'),
        label: attr('aria-label'),
        marker: /<marker id="([^"]+)"/.exec(html)[1],
        boxes: [...html.matchAll(/<g class="dg-(?:state|participant)" data-(?:state|participant)="([^"]*)"><rect class="dg-box" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)]
          .map((m) => ({ name: m[1], x: Number(m[2]), y: Number(m[3]), w: Number(m[4]), h: Number(m[5]) })),
        edges: [...html.matchAll(/<g class="dg-(?:edge|step)" data-n="(\d+)" data-from="([^"]*)" data-to="([^"]*)"(?: data-evidence="([^"]*)")?>([\s\S]*?)<\/g>/g)]
          .map((m) => ({
            n: Number(m[1]),
            from: m[2],
            to: m[3],
            evidence: m[4] || null,
            paths: [...m[5].matchAll(/<path class="([^"]+)" d="([^"]+)"(?: marker-end="url\(#([^)]+)\)")?\/>/g)]
              .map((p) => ({ cls: p[1], d: p[2], points: pathPoints(p[2]), marker: p[3] || null })),
            texts: textsOf(m[5])
          })),
        lifelines: [...html.matchAll(/<path class="dg-lifeline" d="([^"]+)"\/>/g)].map((m) => m[1]),
        texts: textsOf(html),
        legend: /<figcaption class="dg-legend">([\s\S]*?)<\/figcaption>/.exec(html)[1]
      };
    };
    // A text class's font size and anchor, as the diagram CSS sets them — what
    // a reader's browser applies to the SVG.
    const textStyle = (cls) => {
      const rule = new RegExp(`\\.${cls}\\b[^{]*\\{([^}]*)\\}`).exec(diagrams.DIAGRAM_CSS)[1];
      return { size: Number(/font-size: (\d+)px/.exec(rule)[1]), middle: /text-anchor: middle/.test(rule) };
    };
    const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    // Every label's box read back from the SVG: a text's width by the
    // module's own estimate (textWidth), its height the font size above the
    // baseline and about a third below; an Evidence tag is its drawn box,
    // which holds its text.
    const labelBoxes = (html, texts) => [
      ...texts.filter((t) => t.cls !== 'dg-evidence-text').map((t) => {
        const { size, middle } = textStyle(t.cls);
        const w = diagrams.textWidth(unescapeXml(t.text), size);
        return { name: t.text, x: middle ? t.x - w / 2 : t.x, y: t.y - size, w, h: size + Math.round(size * 0.3) };
      }),
      ...[...html.matchAll(/<rect class="dg-evidence-box" x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
        .map((m) => ({ name: 'Evidence tag', x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }))
    ];
    const onBorder = ([x, y], b) =>
      ((x === b.x || x === b.x + b.w) && y >= b.y && y <= b.y + b.h) ||
      ((y === b.y || y === b.y + b.h) && x >= b.x && x <= b.x + b.w);
    const entersBox = ([a, b], box) => {
      const [x1, x2] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
      const [y1, y2] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
      return x1 < box.x + box.w && x2 > box.x && y1 < box.y + box.h && y2 > box.y &&
        !(x1 === x2 && (x1 <= box.x || x1 >= box.x + box.w)) && !(y1 === y2 && (y1 <= box.y || y1 >= box.y + box.h));
    };
    // What the layout promises, read back from the SVG a reader's browser gets.
    const checkInvariants = (html, kind, why) => {
      const p = parse(html);
      assert.equal(p.viewBox, `0 0 ${p.width} ${p.height}`, `${why}: viewBox matches the natural size`);
      for (let i = 0; i < p.boxes.length; i++) {
        for (let j = i + 1; j < p.boxes.length; j++) {
          const [a, b] = [p.boxes[i], p.boxes[j]];
          assert.ok(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h, `${why}: boxes ${a.name} and ${b.name} overlap`);
        }
      }
      const box = new Map(p.boxes.map((b) => [b.name, b]));
      for (const e of p.edges) {
        const all = e.paths.flatMap((path) => path.points);
        assert.ok(all.every(([x, y]) => x >= 0 && y >= 0 && x <= p.width && y <= p.height), `${why}: edge ${e.n} leaves the viewBox`);
        assert.deepEqual(e.paths.map((path) => path.marker), [...e.paths.slice(1).map(() => null), p.marker],
          `${why}: edge ${e.n} carries exactly one arrowhead, on its final piece, from its own diagram's marker`);
        const first = e.paths[0].points[0];
        const lastPath = e.paths[e.paths.length - 1].points;
        const [prev, tip] = lastPath.slice(-2);
        if (kind === 'lc') {
          assert.ok(onBorder(first, box.get(e.from)), `${why}: edge ${e.n} starts on ${e.from}'s border`);
          assert.ok(onBorder(tip, box.get(e.to)), `${why}: edge ${e.n} ends on ${e.to}'s border`);
          const target = box.get(e.to);
          const inward = tip[0] === target.x ? [1, 0] : tip[0] === target.x + target.w ? [-1, 0] : tip[1] === target.y ? [0, 1] : [0, -1];
          assert.deepEqual([Math.sign(tip[0] - prev[0]), Math.sign(tip[1] - prev[1])], inward, `${why}: edge ${e.n}'s head points into ${e.to}`);
          for (const path of e.paths) {
            for (let k = 1; k < path.points.length; k++) {
              for (const b of p.boxes) {
                assert.ok(!entersBox([path.points[k - 1], path.points[k]], b), `${why}: edge ${e.n} crosses box ${b.name}`);
              }
            }
          }
        } else {
          const cx = (name) => box.get(name).x + box.get(name).w / 2;
          assert.equal(first[0], cx(e.from), `${why}: step ${e.n} starts on ${e.from}'s lifeline`);
          assert.equal(tip[0], cx(e.to), `${why}: step ${e.n} ends on ${e.to}'s lifeline`);
          if (e.from === e.to) {
            assert.equal(tip[1], first[1] + 24, `${why}: self-step ${e.n} returns 24 lower`);
            assert.equal(Math.sign(tip[0] - prev[0]), -1, `${why}: self-step ${e.n} points back at its lifeline`);
          } else {
            assert.equal(Math.sign(tip[0] - prev[0]), Math.sign(cx(e.to) - cx(e.from)), `${why}: step ${e.n} points at ${e.to}`);
          }
        }
        const dashed = e.evidence === 'inferred' || e.evidence === 'assumed';
        assert.ok(e.paths.every((path) => path.cls === (dashed ? 'dg-route dg-uncertain' : 'dg-route')), `${why}: edge ${e.n} dash style follows its Evidence type`);
      }
      assert.equal(p.texts.length, (html.match(/<text /g) || []).length, `${why}: every text element is read back`);
      assert.ok(p.texts.every((t) => t.x >= 0 && t.y > 0 && t.y <= p.height), `${why}: text inside the viewBox`);
      const labels = labelBoxes(html, p.texts);
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const [a, b] = [labels[i], labels[j]];
          assert.ok(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h,
            `${why}: labels "${a.name}" and "${b.name}" overlap`);
        }
      }
      assert.doesNotMatch(html, /<script|href=|foreignObject|xlink/i, `${why}: no script, link or foreign content in the SVG`);
      return p;
    };
    const lcModel = (states, rows) => ({
      kind: 'LC', entryId: 'LC-01', states,
      transitions: rows.map(([from, to, trigger, guard = [], evidenceType = 'code'], i) => ({ n: i + 1, from, to, trigger: [trigger], guard, evidenceType }))
    });

    // (a) Expense LC-01, read from the shipped tutorial through the same recognition path
    const expenseMd = await readFile(join(repoRoot, 'tutorial/01-greenfield/outputs/dflow/specs/domain/Expense/analysis.md'), 'utf8');
    const expenseSub = diagrams.findEntrySubsections(lex(expenseMd)).find((sub) => sub.entryId === 'LC-01');
    const expense = checkInvariants(diagrams.drawDiagram(diagrams.lifecycleModel(expenseSub).model, 0).html, 'lc', 'Expense');
    assert.deepEqual([expense.width, expense.height], [716, 464]);
    assert.equal(expense.label, 'LC-01：4 個狀態、4 條轉移；細節見下方卡片');
    assert.equal(expense.marker, 'dflow.dg.0.arrow');
    assert.deepEqual(expense.boxes.map((b) => [b.name, b.x, b.y, b.w, b.h]), [
      ['Draft', 72, 24, 160, 48], ['Submitted', 72, 112, 160, 48], ['Approved', 72, 294, 160, 48], ['Rejected', 72, 382, 160, 48]
    ]);
    assert.deepEqual(expense.edges.map((e) => [e.n, e.from, e.to, e.paths.map((p) => p.d).join(' | ')]), [
      [1, 'Draft', 'Submitted', 'M152 72V112'],
      [2, 'Submitted', 'Approved', 'M152 160V294'],
      [3, 'Submitted', 'Rejected', 'M232 136H280V406H232'],
      [4, 'Rejected', 'Draft', 'M72 406H24V48H72']
    ], 'direct arrows down the middle, the forward skip on the right, the return on the left');
    assert.deepEqual(expense.edges.map((e) => e.texts.map((t) => [t.x, t.y, t.text])), [
      [[164, 86, '1']], [[164, 221, '2']], [[240, 130, '3']], [[40, 400, '4']]
    ], 'route numbers beside their source connector');
    const shown = (p, cls) => p.texts.filter((t) => t.cls === cls).map((t) => [t.x, t.y, t.text]);
    assert.deepEqual(shown(expense, 'dg-primary'), [
      [340, 38, '員工送出（ExpenseReport.Submit()）'],
      [340, 126, '主管核准（ExpenseReport.Approve()）'],
      [340, 194, '主管退回（ExpenseReport.Reject()）'],
      [340, 396, '員工第一次重編（AddItem()／'],
      [340, 416, 'RemoveItem()／ModifyItem()）']
    ], 'triggers in the label column; a closing mark stays with the unit before it');
    assert.deepEqual(shown(expense, 'dg-secondary'), [
      [404, 57, 'BR-001'], [404, 145, 'BR-005'], [404, 163, 'BR-006'],
      [404, 213, 'BR-005'], [404, 231, 'BR-006'], [404, 249, 'BR-007'], [404, 435, 'BR-002']
    ], 'guard items stay hard line breaks');
    assert.deepEqual(shown(expense, 'dg-guard-key').map(([x, y]) => [x, y]), [[340, 57], [340, 145], [340, 213], [340, 435]]);
    assert.match(expense.legend, /^<span><svg class="dg-key" aria-hidden="true" viewBox="0 0 28 8"><path class="dg-route" d="M0 4H28"\/><\/svg>實線：這一條的 Evidence 類型不是 inferred 或 assumed。<\/span>$/,
      'an all-solid diagram lists only the solid style, and never calls it verified');

    // (b) OBTS StatusVerifyExp, transcribed
    const obts = checkInvariants(diagrams.drawDiagram(lcModel(['NotYet', 'Submitted', 'Reviewed'], [
      ['NotYet', 'Submitted', '送出（P3034 ButAgree）', ['BR-EA-001', 'BR-EA-002'], 'document'],
      ['Submitted', 'NotYet', '退回（P3035 SendBack）', [], 'document'],
      ['Submitted', 'Reviewed', '核准（P3035）', [], 'document']
    ]), 0).html, 'lc', 'OBTS');
    assert.deepEqual([obts.width, obts.height], [668, 284]);
    assert.deepEqual(obts.edges.map((e) => e.paths.map((p) => p.d).join(' | ')), ['M152 72V120', 'M72 144H24V48H72', 'M152 168V212']);
    assert.deepEqual(shown(obts, 'dg-primary').map(([x, y]) => [x, y]), [[292, 38], [292, 134], [292, 166]]);

    // (c) nine states: a long return, a self-transition, a same-pair duplicate, three into one state
    const nine = ['Draft', 'Queued', 'Review', 'Ready', 'Running', 'Done', 'Settled', 'Closed', 'Archived'];
    const nineRows = [
      ['Draft', 'Queued', 'Queue'], ['Queued', 'Review', 'Review'], ['Review', 'Ready', 'Ready'], ['Ready', 'Running', 'Start'],
      ['Running', 'Done', 'Finish'], ['Done', 'Settled', 'Settle'], ['Settled', 'Closed', 'Close'], ['Closed', 'Archived', 'Archive'],
      ['Settled', 'Queued', 'Requeue'], ['Running', 'Running', 'Progress'], ['Queued', 'Review', 'AutoReview'],
      ['Draft', 'Ready', 'FastTrack'], ['Queued', 'Ready', 'SkipReview']
    ].map(([from, to, trigger]) => [from, to, trigger, [], 'document']);
    const nineDrawn = checkInvariants(diagrams.drawDiagram(lcModel(nine, nineRows), 0).html, 'lc', 'nine states');
    assert.deepEqual([nineDrawn.width, nineDrawn.height], [772, 892]);
    assert.deepEqual(nineDrawn.edges.map((e) => e.paths.map((p) => p.d).join(' | ')), [
      'M152 72V116', 'M152 188V240', 'M152 288V328', 'M152 400V440', 'M152 512V552', 'M152 600V640', 'M152 688V732', 'M152 780V820',
      'M72 664H24V152H72', 'M232 464H280V488H232', 'M232 164H280V264H232', 'M232 48H336V376H232', 'M232 140H308V352H232'
    ], 'lanes: shortest spans nearest the boxes; disjoint spans share a lane; nested brackets never cross');

    // (d) a five-step flow with a self-step and an inferred step
    const flowMd = [
      '### FL-01: 送審到付款',
      '',
      '| # | From | To | Handed over | State change | Evidence |',
      '|---|---|---|---|---|---|',
      '| 1 | Expense | Approval | 送審資料 | Draft → Submitted | document - x (2026-09-24) |',
      '| 2 | Approval | Approval | 檢查額度 | 審核中 | document - x (2026-09-24) |',
      '| 3 | Approval | Expense | 核准結果 | Submitted → Approved | document - x (2026-09-24) |',
      '| 4 | Expense | Finance | 付款請求 | 待付款 | inferred - x (2026-09-24) |',
      '| 5 | Finance | Expense | 付款完成 | 已付款 | document - x (2026-09-24) |'
    ].join('\n');
    const flowModel = diagrams.flowModel(diagrams.findEntrySubsections(lex(flowMd))[0]).model;
    const flow = checkInvariants(diagrams.drawDiagram(flowModel, 1).html, 'fl', 'flow');
    assert.deepEqual([flow.width, flow.height], [560, 584]);
    assert.equal(flow.label, 'FL-01：3 個參與者、5 個步驟；細節見下方卡片');
    assert.equal(flow.marker, 'dflow.dg.1.arrow');
    assert.deepEqual(flow.boxes.map((b) => [b.name, b.x, b.y, b.w, b.h]), [
      ['Expense', 24, 24, 144, 48], ['Approval', 208, 24, 144, 48], ['Finance', 392, 24, 144, 48]
    ]);
    assert.deepEqual(flow.lifelines, ['M96 72V560', 'M280 72V560', 'M464 72V560']);
    assert.deepEqual(flow.edges.map((e) => [e.n, e.paths.map((p) => p.d).join(' | '), e.paths[0].cls]), [
      [1, 'M96 120H280', 'dg-route'],
      [2, 'M280 202H328V226H280', 'dg-route'],
      [3, 'M280 308H96', 'dg-route'],
      [4, 'M96 428H464', 'dg-route dg-uncertain'],
      [5, 'M464 510H96', 'dg-route']
    ]);
    assert.deepEqual(shown(flow, 'dg-primary'), [
      [108, 102, '送審資料'], [292, 184, '檢查額度'], [108, 290, '核准結果'], [108, 390, '付款請求'], [108, 492, '付款完成']
    ]);
    assert.deepEqual(shown(flow, 'dg-secondary'), [
      [108, 145, 'Draft → Submitted'], [292, 251, '審核中'], [108, 333, 'Submitted →'], [108, 351, 'Approved'], [108, 453, '待付款'], [108, 535, '已付款']
    ]);
    assert.deepEqual(shown(flow, 'dg-evidence-text'), [[114, 408, 'inferred']], 'the dashed step names its actual Evidence type');
    const flowHtml = diagrams.drawDiagram(flowModel, 1).html;
    assert.match(flowHtml, /<rect class="dg-evidence-box" x="108" y="396" width="88" height="16" rx="3"\/>/);
    assert.match(flow.legend, /實線：這一條的 Evidence 類型不是 inferred 或 assumed。/);
    assert.match(flow.legend, /虛線：這一條的 Evidence 類型是 inferred 或 assumed。本圖類型：inferred。/,
      'the legend states the types present, without ranking them');
    assert.doesNotMatch(flow.legend, /驗證|可疑|較弱/, 'the legend makes no verification or strength claim');

    // escaping: user text reaches the SVG only as escaped plain text
    const risky = diagrams.drawDiagram(lcModel(['A<B', '"Q"&\'R\'', '草稿'], [
      ['A<B', '"Q"&\'R\'', '<script>x</script>'], ['"Q"&\'R\'', '草稿', 'a & b']
    ]), 0).html;
    checkInvariants(risky, 'lc', 'escaping');
    assert.match(risky, /data-state="A&lt;B"/);
    assert.match(risky, />&quot;Q&quot;&amp;&#39;R&#39;<\/text>/);
    assert.match(risky, />&lt;script&gt;x&lt;\/script&gt;<\/text>/);
    assert.doesNotMatch(risky, /<script>/);

    // a flow wider than a printed page: drawn for the screen, replaced by a note in print
    const participants = (k) => ({
      kind: 'FL', entryId: 'FL-09', participants: Array.from({ length: k }, (_, i) => `P${i + 1}`),
      steps: Array.from({ length: k - 1 }, (_, i) => ({ n: i + 1, from: `P${i + 1}`, to: `P${i + 2}`, handedOver: ['x'], stateChange: [], evidenceType: 'code' }))
    });
    const four = diagrams.drawDiagram(participants(4), 0).html;
    assert.doesNotMatch(four, /dg-wide|dg-print-note/, 'four participants print as drawn');
    const six = diagrams.drawDiagram(participants(6), 0).html;
    checkInvariants(six, 'fl', 'six participants');
    assert.match(six, /^<figure class="dflow-dg dg-fl dg-wide" data-entry="FL-09">\n<p class="dg-print-note">FL-09 有 6 個參與者，列印版只印 4 個以內的流程圖；內容見下方卡片。<\/p>/);
    assert.match(diagrams.DIAGRAM_CSS, /\.dflow-dg \.dg-print-note \{ display: none; \}/);
    assert.match(diagrams.DIAGRAM_CSS, /@media print \{[\s\S]*\.dflow-dg\.dg-wide \.dg-scroll, \.dflow-dg\.dg-wide \.dg-legend \{ display: none; \}[\s\S]*\.dflow-dg\.dg-wide \.dg-print-note \{ display: block;/);
    assert.equal(diagrams.drawDiagram(participants(8), 0).html.includes('dg-wide'), true, 'eight participants still draw');

    // print: a picture that moves to the next page takes its subsection heading with it
    assert.match(diagrams.DIAGRAM_CSS, /@media print \{\s*h2, h3, h4 \{ break-after: avoid; page-break-after: avoid; \}/);
    assert.match(diagrams.DIAGRAM_CSS, /@media print \{[\s\S]*\.dflow-dg \{[^}]*break-before: avoid;[^}]*break-inside: avoid;/);

    // truncation: past three lines a field ends in an ellipsis; more than two such fields refuse
    const long = '這是一段很長的觸發條件，'.repeat(8);
    const cut = diagrams.drawDiagram(lcModel(['A', 'B'], [['A', 'B', long]]), 0).html;
    const cutLines = textsOf(cut).filter((t) => t.cls === 'dg-primary');
    assert.equal(cutLines.length, 3);
    assert.match(cutLines[2].text, /…$/);
    assert.match(parse(cut).legend, /…：文字已節略，完整內容見下方卡片。/);
    assert.equal(diagrams.drawDiagram(lcModel(['A', 'B'], [['A', 'B', long], ['B', 'A', long], ['A', 'A', long]]), 0).issue,
      '有 3 格文字要節略才放得下，上限 2 格');

    // right-to-left text and oversize cells refuse with a note naming the cell
    const rtlSub = diagrams.findEntrySubsections(lex([
      '### LC-01: x', '', '| State | Means |', '|---|---|', '| `A` | a |', '| `שלום` | b |', '',
      '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `A` |'
    ].join('\n')))[0];
    assert.deepEqual(diagrams.lifecycleModel(rtlSub), { issue: '狀態表第 2 列的 State 含有由右到左的文字，這個圖還不會排' });
    const wideSub = diagrams.findEntrySubsections(lex([
      '### LC-01: x', '', '| State |', '|---|', '| `A` |', '',
      '| From | Trigger | To |', '|---|---|---|', `| \`A\` | ${'x'.repeat(257)} | \`A\` |`
    ].join('\n')))[0];
    assert.deepEqual(diagrams.lifecycleModel(wideSub), { issue: '轉移表第 1 列的 Trigger 有 257 個字元，上限 256' });

    // fixed-seed random corpus: every accepted diagram keeps every invariant; rejections name a reason
    let seed = 20260924;
    const rand = (k) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k; };
    const words = ['送出', '核准', 'Submit()', 'ExpenseReport.Reject()', '退回重編', 'a', '檢查 BR-001', 'Close'];
    let drawn = 0;
    for (let c = 0; c < 150; c++) {
      const states = Array.from({ length: 2 + rand(9) }, (_, i) => (rand(4) === 0 ? `狀態${i}` : `S${i}`));
      const rows = Array.from({ length: 1 + rand(12) }, () => [
        states[rand(states.length)], states[rand(states.length)], words[rand(words.length)],
        rand(3) ? [] : ['BR-001', 'BR-002'].slice(0, 1 + rand(2)), ['code', 'inferred', 'assumed', null][rand(4)]
      ]);
      const result = diagrams.drawDiagram(lcModel(states, rows), 0);
      if (result.html) {
        drawn += 1;
        checkInvariants(result.html, 'lc', `random lifecycle ${c}`);
      } else {
        assert.ok(typeof result.issue === 'string' && result.issue.length > 0, `random lifecycle ${c}: a refusal names its reason`);
      }
    }
    for (let c = 0; c < 80; c++) {
      const people = Array.from({ length: 2 + rand(7) }, (_, i) => `C${i}`);
      const steps = Array.from({ length: 1 + rand(10) }, (_, i) => ({
        n: i + 1, from: people[rand(people.length)], to: people[rand(people.length)],
        handedOver: [words[rand(words.length)]], stateChange: rand(2) ? [] : ['Draft → Submitted'], evidenceType: ['code', 'inferred', null][rand(3)]
      }));
      const used = people.filter((p) => steps.some((s) => s.from === p || s.to === p));
      const ordered = [];
      for (const s of steps) {
        for (const p of [s.from, s.to]) {
          if (!ordered.includes(p)) ordered.push(p);
        }
      }
      assert.equal(ordered.length, used.length);
      const result = diagrams.drawDiagram({ kind: 'FL', entryId: 'FL-01', participants: ordered, steps }, 0);
      if (result.html) {
        drawn += 1;
        checkInvariants(result.html, 'fl', `random flow ${c}`);
      } else {
        assert.ok(typeof result.issue === 'string' && result.issue.length > 0, `random flow ${c}: a refusal names its reason`);
      }
    }
    assert.ok(drawn >= 150, `the random corpus mostly draws (${drawn} of 230) rather than refusing`);
  }

  // --- mirror consistency: deleted / renamed sources -> stale cleanup ---
  {
    const proj = join(tempRoot, 'mirror');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    await writeFixture(join(src, 'a.md'), '# A\n');
    await writeFixture(join(src, 'sub/deep/b.md'), '# B\n');

    assert.equal(runRenderCli(proj, []).code, 0);
    assert.equal(await exists(join(outDir, 'sub/deep/b.html')), true);

    // rename a.md and remove the whole sub/ directory, then re-run
    await rm(join(src, 'a.md'));
    await writeFixture(join(src, 'a2.md'), '# A2\n');
    await rm(join(src, 'sub'), { recursive: true });

    const second = runRenderCli(proj, []);
    assert.equal(second.code, 0);
    assert.equal(await exists(join(outDir, 'a.html')), false, 'stale a.html removed after rename');
    assert.equal(await exists(join(outDir, 'a2.html')), true);
    assert.equal(await exists(join(outDir, 'sub/deep/b.html')), false, 'stale file inside removed subdirectory is cleaned');
    assert.equal(await exists(join(outDir, 'sub')), false, 'emptied mirror subdirectory is pruned');

    const manifest = await readManifest(outDir);
    assert.deepEqual([...manifest.files].sort(), ['a2.html', 'index.html']);
  }

  // --- stale-prune scope: only directories this run itself emptied ---
  // staleEntries diffs ledgers, not the filesystem: a listed stale file may
  // already be gone (unlink ENOENT). Pruning its parents in that case would
  // rmdir an empty directory render cannot prove it made — e.g. one a user
  // recreated at an old mirror path (cold-eye gate G6 F1). Empty-parent
  // pruning must follow only an actual unlink by this run.
  {
    const proj = join(tempRoot, 'prunescope');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    await writeFixture(join(src, 'a.md'), '# A\n');
    await writeFixture(join(src, 'sub/deep/b.md'), '# B\n');
    assert.equal(runRenderCli(proj, []).code, 0, 'healthy run establishes ownership');

    // Remove the source AND its mirror file by hand, then recreate the
    // directory chain empty — as a user might for their own purposes.
    await rm(join(src, 'sub'), { recursive: true });
    await unlink(join(outDir, 'sub/deep/b.html'));
    await rmdir(join(outDir, 'sub/deep'));
    await rmdir(join(outDir, 'sub'));
    await mkdir(join(outDir, 'sub/deep'), { recursive: true });

    const rerun = runRenderCli(proj, []);
    assert.equal(rerun.code, 0, `stale entry with missing file reruns fine\nSTDERR:\n${rerun.stderr}`);
    assert.equal(await exists(join(outDir, 'sub/deep')), true, 'foreign empty directory at the old mirror path survives (this run unlinked nothing there)');
  }

  // --- ownership refusals: never touch a directory render does not own ---
  {
    const proj = join(tempRoot, 'ownership');
    await writeFixture(join(proj, 'dflow/specs/a.md'), '# A\n');
    await writeFixture(join(proj, 'someone-elses/notes.txt'), 'precious\n');

    const refused = runRenderCli(proj, ['--out', 'someone-elses']);
    assert.equal(refused.code, 1, 'non-empty dir without manifest is refused');
    assert.match(refused.stderr, /refusing to write into non-empty directory without \.dflow-render-manifest\.json/);
    assert.equal(await readFile(join(proj, 'someone-elses/notes.txt'), 'utf8'), 'precious\n', 'foreign files untouched');
    assert.equal(await exists(join(proj, 'someone-elses/index.html')), false, 'nothing rendered into a refused dir');
  }

  // --- output-internal links: refuse before writing or deleting anything ---
  // Writes, stale unlinks, and prunes all follow links in the path below the
  // realpath'd --out root, so a link planted inside the owned tree would
  // redirect them outside --out (cold-eye gate G1 F1, reproduced with
  // junctions on Windows). The run must refuse at the link instead.
  {
    const proj = join(tempRoot, 'intlink');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    const outside = join(proj, 'outside');
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    await writeFixture(join(src, 'a.md'), '# A\n');
    await writeFixture(join(src, 'sub/c.md'), '# C\n');
    await writeFixture(join(outside, 'victim.html'), 'precious\n');

    assert.equal(runRenderCli(proj, []).code, 0, 'healthy run establishes ownership');

    // A linked dir below the accepted tree pointing outside, plus both escape
    // pressures: a same-named source subdir (write-through) and a manifest
    // entry under the link (stale-delete-through). Refusal must come first.
    await symlink(outside, join(outDir, 'sub/linked'), linkType);
    await writeFixture(join(src, 'sub/linked/b.md'), '# B\n');
    const owned = await readManifest(outDir);
    owned.files.push('sub/linked/victim.html');
    await writeFile(join(outDir, MANIFEST_NAME), JSON.stringify(owned), 'utf8');

    const linkedDir = runRenderCli(proj, []);
    assert.equal(linkedDir.code, 1, 'internal linked dir refuses the run');
    assert.match(linkedDir.stderr, /refusing to run: sub\/linked inside the output directory is a symlink or junction/);
    assert.equal(await readFile(join(outside, 'victim.html'), 'utf8'), 'precious\n', 'outside file not deleted through the link');
    assert.equal(await exists(join(outside, 'b.html')), false, 'nothing written through the link');
    assert.deepEqual((await readManifest(outDir)).files, owned.files, 'manifest not rewritten by the refused run');

    // Removing the link unblocks the next run; the dangling manifest entry
    // now resolves inside the real tree (ENOENT) and is skipped, not followed.
    if (process.platform === 'win32') {
      await rmdir(join(outDir, 'sub/linked'));
    } else {
      await unlink(join(outDir, 'sub/linked'));
    }
    const recovered = runRenderCli(proj, []);
    assert.equal(recovered.code, 0, `link removal recovers the directory\nSTDERR:\n${recovered.stderr}`);
    assert.equal(await readFile(join(outside, 'victim.html'), 'utf8'), 'precious\n', 'outside stays intact through recovery');
    assert.equal(await exists(join(outDir, 'sub/linked/b.html')), true, 'recovered run renders the real subdir normally');

    // The final component being a FILE symlink must refuse the same way:
    // fs.writeFile follows it, so rendering a.html would overwrite the target.
    // Unprivileged Windows cannot create file symlinks — skip the sub-case
    // there (the scan treats every link dirent alike, locked above).
    let fileLink = true;
    try {
      await unlink(join(outDir, 'a.html'));
      await symlink(join(outside, 'victim.html'), join(outDir, 'a.html'), 'file');
    } catch (error) {
      if (error.code !== 'EPERM') {
        throw error;
      }
      fileLink = false;
    }
    if (fileLink) {
      const linkedFile = runRenderCli(proj, []);
      assert.equal(linkedFile.code, 1, 'file symlink as an output target refuses the run');
      assert.match(linkedFile.stderr, /refusing to run: a\.html inside the output directory is a symlink or junction/);
      assert.equal(await readFile(join(outside, 'victim.html'), 'utf8'), 'precious\n', 'link target not overwritten');
      await unlink(join(outDir, 'a.html'));
      assert.equal(runRenderCli(proj, []).code, 0, 'file-link removal recovers the directory');
      assert.equal(await exists(join(outDir, 'a.html')), true, 'a.html re-rendered as a real file');
    }

    // A hardlink is the same escape without a link dirent: the entry reports
    // as a regular file, but the full-rebuild rewrite would truncate the
    // shared inode and change the file's other name outside --out (cold-eye
    // gate G2 F1, reproduced on Windows). Same-volume fs.link needs no
    // privileges on NTFS or POSIX.
    await writeFixture(join(outside, 'victim2.html'), 'PRECIOUS\n');
    if (await exists(join(outDir, 'a.html'))) {
      await unlink(join(outDir, 'a.html'));
    }
    await link(join(outside, 'victim2.html'), join(outDir, 'a.html'));

    const hardlinked = runRenderCli(proj, []);
    assert.equal(hardlinked.code, 1, 'hardlinked output file refuses the run');
    assert.match(hardlinked.stderr, /refusing to run: a\.html inside the output directory is a regular file with multiple hard links/);
    assert.equal(await readFile(join(outside, 'victim2.html'), 'utf8'), 'PRECIOUS\n', 'hardlink target content not overwritten');

    // scanner-level: the scan itself classifies the hardlinked file as
    // unsafe before any write starts
    assert.deepEqual(
      await findUnsafeEntry(join(proj, 'dflow-specs-html')),
      { rel: 'a.html', what: 'a regular file with multiple hard links' },
      'unsafe-entry scan reports the hardlinked file'
    );

    // Removing the extra name recovers; the outside name keeps its inode
    // and content through refusal, removal, and the healthy rebuild.
    await unlink(join(outDir, 'a.html'));
    assert.equal(runRenderCli(proj, []).code, 0, 'hardlink removal recovers the directory');
    assert.equal(await readFile(join(outside, 'victim2.html'), 'utf8'), 'PRECIOUS\n', 'outside name keeps its content after recovery');
    assert.equal(await exists(join(outDir, 'a.html')), true, 'a.html re-rendered as a real single-name file');
  }

  // --- ownership proof: a manifest alone must not authorize mutations ---
  // The manifest is an ordinary JSON file — copyable, hand-writable — so a
  // schema-valid one in a foreign directory must not be enough to delete or
  // overwrite files render never generated (cold-eye gate G3 F1). The proof
  // is the GENERATED_MARK embedded in every rendered page.
  {
    const proj = join(tempRoot, 'proof');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    await writeFixture(join(src, 'a.md'), '# A\n');

    // Forged/copied schema-valid manifest listing a foreign file: the stale
    // pass previously deleted it (G3 F1 probe 1).
    await writeFixture(join(outDir, 'precious.txt'), 'precious\n');
    await writeFixture(join(outDir, MANIFEST_NAME), `${JSON.stringify({ 'dflow-render': 1, files: ['precious.txt'] })}\n`);
    const forged = runRenderCli(proj, []);
    assert.equal(forged.code, 1, 'forged manifest refuses the run');
    assert.match(forged.stderr, /refusing to run: precious\.txt in the output directory is listed in the manifest but was not generated by dflow render/);
    assert.equal(await readFile(join(outDir, 'precious.txt'), 'utf8'), 'precious\n', 'foreign listed file intact');
    assert.equal(await exists(join(outDir, 'a.html')), false, 'refused run rendered nothing');

    // Unlisted regular file sitting at a planned output path: overwriting it
    // would destroy a file render cannot prove it made (G3 F1 probe 2).
    await rm(toNamespacedPath(outDir), { recursive: true, force: true });
    assert.equal(runRenderCli(proj, []).code, 0, 'healthy run establishes ownership');
    await writeFixture(join(outDir, 'b.html'), 'my own page\n');
    await writeFixture(join(src, 'b.md'), '# B\n');
    const unmarked = runRenderCli(proj, []);
    assert.equal(unmarked.code, 1, 'unmarked file at a planned output path refuses the run');
    assert.match(unmarked.stderr, /refusing to run: b\.html in the output directory was not generated by dflow render/);
    assert.equal(await readFile(join(outDir, 'b.html'), 'utf8'), 'my own page\n', 'unmarked file intact');

    // The same shape WITH the marker is a crashed render's own output: the
    // rerun must converge over it, or crash recovery would be impossible.
    await writeFile(join(outDir, 'b.html'), `<!DOCTYPE html>\n${GENERATED_MARK}\n<p>partial</p>\n`, 'utf8');
    const converged = runRenderCli(proj, []);
    assert.equal(converged.code, 0, `marker-bearing partial output converges\nSTDERR:\n${converged.stderr}`);
    const rerendered = await readOut(join(outDir, 'b.html'));
    assert.match(rerendered, /<h1 id="b">B<\/h1>/, 'partial output re-rendered from source');
    assert.doesNotMatch(rerendered, /<p>partial<\/p>/, 'crashed-run content fully replaced');

    // Rendered pages actually carry the marker every proof above relies on.
    assert.ok((await readOut(join(outDir, 'a.html'))).includes(GENERATED_MARK), 'rendered page embeds the generated marker');
  }

  // --- manifest tmp: the reserved name alone is no ownership proof ---
  // A crash between writeManifest's tmp write and its rename leaves
  // .dflow-render-manifest.json.tmp behind; recovery must not turn into a
  // rule that anything at that name may be deleted or claimed (G4 F1).
  {
    const proj = join(tempRoot, 'tmpproof');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    const TMP_NAME = `${MANIFEST_NAME}.tmp`;
    await writeFixture(join(src, 'a.md'), '# A\n');

    // Foreign file at the reserved tmp name in a manifest-less directory:
    // previously deleted and the directory claimed (the G4 bypass). A torn
    // first-run tmp (crash mid-write, unparseable content) is the same
    // refused shape — a documented fail-closed residual: the refusal names
    // the file and manual removal recovers (cold-eye gate G7 F1 decision).
    await writeFixture(join(outDir, TMP_NAME), 'someone elses data\n');
    const foreignTmp = runRenderCli(proj, []);
    assert.equal(foreignTmp.code, 1, 'unproven tmp refuses the run');
    assert.match(foreignTmp.stderr, /cannot be proven to be dflow render's own crash residue/);
    assert.equal(await readFile(join(outDir, TMP_NAME), 'utf8'), 'someone elses data\n', 'foreign tmp intact');
    assert.equal(await exists(join(outDir, 'index.html')), false, 'directory was not claimed');

    // A tmp that proves itself (single-name regular file parsing as a valid
    // manifest) is our own interrupted stamp: the rerun converges over it.
    await writeFile(join(outDir, TMP_NAME), `${JSON.stringify({ 'dflow-render': 1, files: [] })}\n`, 'utf8');
    const crashResidue = runRenderCli(proj, []);
    assert.equal(crashResidue.code, 0, `proven tmp converges\nSTDERR:\n${crashResidue.stderr}`);
    assert.equal(await exists(join(outDir, TMP_NAME)), false, 'residue consumed by the healthy rewrite');
    assert.equal(await exists(join(outDir, 'a.html')), true);

    // In an owned directory a leftover tmp must survive every refusal gate
    // untouched (it was previously unlinked before the scan/proof ran).
    await writeFixture(join(outDir, 'foreign.html'), 'no marker\n');
    await writeFixture(join(src, 'foreign.md'), '# F\n');
    await writeFile(join(outDir, TMP_NAME), 'torn or foreign residue', 'utf8');
    const gated = runRenderCli(proj, []);
    assert.equal(gated.code, 1, 'proof refusal still fires with a leftover tmp present');
    assert.match(gated.stderr, /foreign\.html in the output directory was not generated by dflow render/);
    assert.equal(await readFile(join(outDir, TMP_NAME), 'utf8'), 'torn or foreign residue', 'tmp untouched by the refused run');

    // Once the refusal trigger is gone, the healthy run consumes the
    // reserved bookkeeping name in its owned directory (documented path).
    await unlink(join(outDir, 'foreign.html'));
    await rm(join(src, 'foreign.md'));
    const healthy = runRenderCli(proj, []);
    assert.equal(healthy.code, 0, `owned dir with leftover tmp converges\nSTDERR:\n${healthy.stderr}`);
    assert.equal(await exists(join(outDir, TMP_NAME)), false, 'reserved-name residue consumed at the end of a healthy run');
  }

  // --- reserved manifest-tmp name as a DIRECTORY: refuse before mutation ---
  // In an owned directory a real directory squatting on the reserved tmp
  // name passes the type whitelist, is on no planned/listed path, and the
  // run only died at the end-of-run manifest write (raw EISDIR) — after
  // outputs were written and stale mirrors deleted (cold-eye gate G5 F1).
  // The scan must refuse it up front, before any write or delete.
  {
    const proj = join(tempRoot, 'tmpdir');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    const TMP_NAME = `${MANIFEST_NAME}.tmp`;
    await writeFixture(join(src, 'a.md'), '# A\n');
    await writeFixture(join(src, 'gone.md'), '# Gone\n');
    assert.equal(runRenderCli(proj, []).code, 0, 'healthy run establishes ownership');

    // Both mutation pressures at once: a new source (write-shaped) and a
    // removed source whose marker-proven mirror is now stale (delete-shaped).
    // The refusal must precede both.
    await rm(join(src, 'gone.md'));
    await writeFixture(join(src, 'b.md'), '# B\n');
    const manifestBefore = await readFile(join(outDir, MANIFEST_NAME), 'utf8');
    await mkdir(join(outDir, TMP_NAME));

    const refused = runRenderCli(proj, []);
    assert.equal(refused.code, 1, 'tmp-name directory refuses the run');
    assert.match(refused.stderr, /refusing to run: \.dflow-render-manifest\.json\.tmp inside the output directory is a directory at the reserved manifest-tmp name/);
    assert.doesNotMatch(refused.stderr, /EISDIR/, 'no raw fs error leaks to the user');
    assert.equal(await exists(join(outDir, 'b.html')), false, 'no new output written before the refusal');
    assert.equal(await exists(join(outDir, 'gone.html')), true, 'stale cleanup did not run before the refusal');
    assert.equal(await readFile(join(outDir, MANIFEST_NAME), 'utf8'), manifestBefore, 'manifest untouched by the refused run');
    assert.equal(await exists(join(outDir, TMP_NAME)), true, 'the squatting directory itself is untouched');

    // Removing the squatting directory recovers the owned directory.
    await rmdir(join(outDir, TMP_NAME));
    const recovered = runRenderCli(proj, []);
    assert.equal(recovered.code, 0, `removal recovers the directory\nSTDERR:\n${recovered.stderr}`);
    assert.equal(await exists(join(outDir, 'b.html')), true, 'recovered run renders the new source');
    assert.equal(await exists(join(outDir, 'gone.html')), false, 'recovered run cleans the stale mirror');

    // Scanner-level, case variant: reserved-name comparison is
    // case-insensitive like the ledger's (on a case-insensitive filesystem
    // the variant collides with the same end-of-run write).
    await mkdir(join(outDir, '.DFLOW-RENDER-MANIFEST.JSON.TMP'));
    assert.deepEqual(
      await findUnsafeEntry(outDir),
      { rel: '.DFLOW-RENDER-MANIFEST.JSON.TMP', what: 'a directory at the reserved manifest-tmp name' },
      'unsafe-entry scan reports the case-variant reserved-name directory'
    );
    await rmdir(join(outDir, '.DFLOW-RENDER-MANIFEST.JSON.TMP'));

    // A deeper directory with the same basename is not the reserved root
    // path and must keep rendering normally.
    await writeFixture(join(src, `sub/${TMP_NAME}/c.md`), '# C\n');
    const deep = runRenderCli(proj, []);
    assert.equal(deep.code, 0, `deep same-named directory renders normally\nSTDERR:\n${deep.stderr}`);
    assert.equal(await exists(join(outDir, `sub/${TMP_NAME}/c.html`)), true, 'deep same-named mirror path written');
  }

  // --- manifest name as a DIRECTORY: clean refusal, not a raw EISDIR read ---
  {
    const proj = join(tempRoot, 'manifestdir');
    await writeFixture(join(proj, 'dflow/specs/a.md'), '# A\n');
    await mkdir(join(proj, 'out', MANIFEST_NAME), { recursive: true });
    await writeFixture(join(proj, 'out/keep.txt'), 'keep\n');

    const refused = runRenderCli(proj, ['--out', 'out']);
    assert.equal(refused.code, 1, 'manifest-name directory refuses the run');
    assert.match(refused.stderr, /refusing to run: \.dflow-render-manifest\.json in .+ is not a regular file; no files were deleted/);
    assert.doesNotMatch(refused.stderr, /EISDIR/, 'no raw fs error leaks to the user');
    assert.equal(await readFile(join(proj, 'out/keep.txt'), 'utf8'), 'keep\n', 'foreign file untouched');
    assert.equal(await exists(join(proj, 'out/index.html')), false, 'nothing rendered into the refused dir');
  }

  // --- projection collisions refuse before any output mutation ---
  // foo.md and foo.html/bar.md are both legal sources but project to one
  // path needed as file and directory at once; previously this died on a raw
  // EISDIR after the ownership stamp (cold-eye gate G3 F2).
  {
    const proj = join(tempRoot, 'collide');
    const src = join(proj, 'dflow/specs');
    await writeFixture(join(src, 'foo.md'), '# F\n');
    await writeFixture(join(src, 'foo.html/bar.md'), '# B\n');
    const collided = runRenderCli(proj, []);
    assert.equal(collided.code, 1, 'file/dir projection collision exits 1');
    assert.match(collided.stderr, /refusing to run: foo\.md would produce foo\.html as a file, but foo\.html\/bar\.md needs foo\.html\/ as a directory/);
    assert.equal(await exists(join(proj, 'dflow-specs-html')), false, 'refusal precedes creating or stamping the output directory');

    const proj2 = join(tempRoot, 'collide-index');
    await writeFixture(join(proj2, 'dflow/specs/index.md'), '# I\n');
    const reserved = runRenderCli(proj2, []);
    assert.equal(reserved.code, 1, 'root index.md collides with the generated file tree');
    assert.match(reserved.stderr, /index\.md and the generated file tree would both produce index\.html/);
    assert.equal(await exists(join(proj2, 'dflow-specs-html')), false, 'reserved-index refusal also precedes output mutation');
  }

  // --- manifest resilience: malformed / schema-invalid -> refuse, delete nothing ---
  {
    const proj = join(tempRoot, 'resilience');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    await writeFixture(join(src, 'a.md'), '# A\n');
    await writeFixture(join(src, 'gone.md'), '# Gone\n');
    assert.equal(runRenderCli(proj, []).code, 0);

    // gone.md's source disappears, so a healthy re-run WOULD delete gone.html;
    // with a corrupted manifest the run must refuse and delete nothing.
    await rm(join(src, 'gone.md'));
    await writeFile(join(outDir, MANIFEST_NAME), 'not json at all', 'utf8');
    const malformed = runRenderCli(proj, []);
    assert.equal(malformed.code, 1, 'malformed manifest refuses the run');
    assert.match(malformed.stderr, /is invalid \(not valid JSON\); no files were deleted/);
    assert.equal(await exists(join(outDir, 'gone.html')), true, 'malformed manifest: nothing deleted');

    await writeFile(join(outDir, MANIFEST_NAME), JSON.stringify({ 'dflow-render': 1, files: 'nope' }), 'utf8');
    const badSchema = runRenderCli(proj, []);
    assert.equal(badSchema.code, 1, 'schema-invalid manifest refuses the run');
    assert.match(badSchema.stderr, /"files" is not an array/);
    assert.equal(await exists(join(outDir, 'gone.html')), true, 'schema-invalid manifest: nothing deleted');
  }

  // --- manifest resilience: interrupted first run converges instead of locking out ---
  {
    const proj = join(tempRoot, 'firstrun');
    const src = join(proj, 'dflow/specs');
    const outDir = join(proj, 'dflow-specs-html');
    await writeFixture(join(src, 'a.md'), '# A\n');

    // Simulate a first run that crashed after the ownership stamp and one
    // partial output whose source was then deleted before the re-run.
    await writeFixture(join(outDir, MANIFEST_NAME), `${JSON.stringify({ 'dflow-render': 1, files: [] })}\n`);
    await writeFixture(join(outDir, 'partial.html'), '<!-- partial from crashed run -->\n');

    const rerun = runRenderCli(proj, []);
    assert.equal(rerun.code, 0, `interrupted first run must converge, not refuse\nSTDERR:\n${rerun.stderr}`);
    assert.equal(await exists(join(outDir, 'a.html')), true);
    // The crashed run's file was never in any ledger: it stays (accepted
    // residual — never delete an unlisted file).
    assert.equal(await exists(join(outDir, 'partial.html')), true, 'unlisted residual is never deleted');
    const manifest = await readManifest(outDir);
    assert.deepEqual([...manifest.files].sort(), ['a.html', 'index.html']);
  }

  // --- Windows long paths: SPEC-style dirs + long filenames overflow MAX_PATH ---
  {
    const proj = join(tempRoot, 'longpath');
    const seg = `SPEC-20260428-001-${'a'.repeat(50)}`;
    const relDir = ['features', 'active', seg, seg].join('/');
    const longName = `phase-spec-2026-04-28-${'b'.repeat(80)}.md`;
    await writeFixture(join(proj, 'dflow/specs', relDir, longName), '# Long\n\ncontent\n');
    const outDir = join(proj, 'dflow-specs-html');
    assert.ok(join(outDir, relDir, longName).length > 260, 'fixture must overflow the legacy MAX_PATH limit');

    const result = runRenderCli(proj, []);
    assert.equal(result.code, 0, `long-path render failed\nSTDERR:\n${result.stderr}`);
    assert.equal(
      await exists(join(outDir, relDir, longName.replace(/\.md$/, '.html'))),
      true,
      'mirrored .html exists at the long path'
    );
  }

  // --- unit level: the data-safety core as pure functions ---
  {
    assert.deepEqual(
      staleEntries(['A.html', 'b.html', MANIFEST_NAME], ['a.html', 'index.html']),
      ['b.html'],
      'stale diff is case-insensitive (case-only rename must not delete the fresh file) and never yields the manifest'
    );
    assert.deepEqual(staleEntries([], ['a.html']), [], 'first run has no stale entries');

    assert.equal(parseManifest('not json').ok, false);
    assert.equal(parseManifest('[]').ok, false, 'array root is not a valid manifest');
    assert.equal(parseManifest('{"files": []}').ok, false, 'missing schema version field refuses');
    assert.equal(parseManifest('{"dflow-render": 999, "files": []}').ok, false, 'unknown schema version refuses');
    assert.equal(parseManifest('{"dflow-render": 1, "files": "x"}').ok, false, 'files must be an array');
    assert.equal(parseManifest('{"dflow-render": 1, "files": [42]}').ok, false, 'non-string entry refuses');
    assert.equal(parseManifest('{"dflow-render": 1, "files": ["../escape.html"]}').ok, false, 'path escaping the out dir refuses');
    assert.equal(parseManifest('{"dflow-render": 1, "files": ["/abs.html"]}').ok, false, 'absolute path refuses');
    assert.equal(parseManifest('{"dflow-render": 1, "files": ["ok/a.html"]}').ok, true, 'valid manifest parses');

    assert.equal(pathContains(join(tempRoot, 'p'), join(tempRoot, 'p')), true, 'a path contains itself');
    assert.equal(pathContains(join(tempRoot, 'p'), join(tempRoot, 'p', 'child')), true);
    assert.equal(pathContains(join(tempRoot, 'p'), join(tempRoot, 'p-sibling')), false, 'prefix-named sibling is not contained');
    assert.equal(pathContains(join(tempRoot, 'p'), join(tempRoot, 'p', '..foo')), true, 'child literally named ..foo is contained');

    assert.equal(findProjectionCollision(['a.md', 'sub/b.md', 'sub/index.md']), null, 'clean projection (incl. nested index.md) has no collision');
    assert.match(findProjectionCollision(['x.md', 'X.md']), /X\.md and x\.md would both produce X\.html/, 'case-only distinct sources collide (matches the case-insensitive ledger)');
    assert.match(findProjectionCollision(['foo.html/bar.md', 'foo.md']), /foo\.md would produce foo\.html as a file, but foo\.html\/bar\.md needs foo\.html\/ as a directory/);
    assert.match(findProjectionCollision(['index.md']), /index\.md and the generated file tree would both produce index\.html/);
    assert.match(findProjectionCollision(['index.html/x.md']), /needs index\.html\/ as a directory, but render generates index\.html there/);
    assert.match(
      findProjectionCollision([`${MANIFEST_NAME}.tmp/x.md`]),
      /render reserves that name for its ownership manifest/,
      'a root source directory at the reserved tmp name collides with the manifest write'
    );
    assert.match(
      findProjectionCollision(['.DFLOW-RENDER-MANIFEST.JSON/x.md']),
      /render reserves that name for its ownership manifest/,
      'reserved-name collision is case-insensitive (matches the ledger)'
    );
    assert.equal(
      findProjectionCollision([`sub/${MANIFEST_NAME}.tmp/x.md`]),
      null,
      'the reserved names only apply at the output root'
    );
    assert.match(
      findProjectionCollision(['a\\b.md']),
      /cannot be represented in the render manifest/,
      'a backslash-bearing source name would lock the directory out via its own manifest'
    );
    assert.match(
      findProjectionCollision(['C:strange.md']),
      /cannot be represented in the render manifest/,
      'a drive-letter-like source name is refused the same way'
    );
  }

  console.log('PROPOSAL-073 render tests passed');
} finally {
  await rm(toNamespacedPath(tempRoot), { recursive: true, force: true });
}
