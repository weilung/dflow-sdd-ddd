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
// content, title/short-field exemptions, print expansion CSS), Windows
// long-path output, and the dynamic import('marked') loading-path lock.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, rm, rmdir, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, toNamespacedPath } from 'node:path';
import { fileURLToPath } from 'node:url';

import render from '../lib/render.js';

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
