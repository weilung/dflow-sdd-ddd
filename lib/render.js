// dflow render — specs Markdown -> human-readable static HTML (PROPOSAL-073).
//
// Markdown stays the AI-facing source of truth; this command projects it into
// a mirrored .html tree plus a root index.html for human reading.
// Every run is a full rebuild (the index and in-tree autolinks depend on
// the whole file set, so partial rebuilds would leave stale links).
//
// Rendering parity baseline: the retired dev prototype
// (prototypes/md-html/render_html.py at its 2026-07-09 converged shape),
// user-acceptance-tested per feature: all-table cardification, frontmatter
// title card + status pill, phase badges / fill-timing chips, gherkin keyword
// highlighting, .md link rewriting with GFM-style heading ids (CJK-safe), and
// in-tree autolinking of inline-code .md mentions.
//
// PROPOSAL-077 A1 extends that baseline with long-field readability: cards
// holding a long field span the full grid row, long fields get prose spacing,
// and wall-length fields are clamped behind a pure-CSS expand toggle (print
// always fully expands). Layout-only — cell content is never split or
// reworded, and the page stays JavaScript-free.
//
// PROPOSAL-079: features/completed/ (append-only archive) is not inlined in
// the root index — it renders as one physical index page per year (grouped
// by the SPEC-YYYYMMDD directory-name prefix; non-conforming entries in an
// 'other' bucket), with the root tree carrying year links only. Every
// generated index page is a reserved output in the projection-collision
// guard.
//
// PROPOSAL-100: in a file named analysis.md, each filled `### LC-nn` /
// `### FL-nn` subsection also gets its lifecycle or flow drawn as inline SVG
// above its unchanged cards, or a one-line note saying why not
// (lib/render-diagrams.js). Every other page, and every analysis.md whose
// LC/FL tables are still the template's (placeholder rows only), renders
// exactly as before.
//
// PROPOSAL-108: every multi-column table is emitted twice — the unchanged
// cards and a table view (short columns never wrap, long cells clamp, wide
// tables leave the text column) — behind a per-table pair of radios, pure
// CSS; --table-view picks which form every table starts in (default cards),
// and nothing remembers a reader's switch. A table with an author-written
// id or name in a cell is emitted in its starting form only, so that id is
// on the page once.
//
// PROPOSAL-101: on a recognised specs root (shared/_conventions.md is
// present) the root index is a grouped directory instead of the file tree —
// Features, Domain, architecture and migration, shared, everything else —
// each group a native <details> closed on first open (a lone group opens),
// with a purpose line, a collapsed reading guide and a few path-scoped role
// labels; year pages gain one orientation line and list each feature
// directory as a row (the same rows active/ gets). Any other --src keeps the
// file tree. On both sides, index and year-page hrefs percent-encode `%`,
// `#` and `?`. Mirror pages are untouched, and the page stays
// JavaScript-free.
//
// PROPOSAL-112: every page's top-level tables are checked for two ways a
// Markdown table goes wrong without an error (lib/table-checks.js): a blank
// line or comment that cuts the table short, and a row whose extra cells
// hold text marked drops. Each problem gets a one-line notice above the
// table or the cut-off lines and a line on stdout with the source file's own
// line number; a diagram whose table has either problem is not drawn. The
// table and its text are never changed, and a page with no problem renders
// exactly as before.
//
// marked ships as ESM-only and `require(esm)` is not on by default until Node
// 22.12 (engines allows >=22.0.0), so this CommonJS module MUST load it via
// dynamic import('marked') — never via a require() call.

const fs = require('node:fs/promises');
const path = require('node:path');

const diagrams = require('./render-diagrams.js');
const tableChecks = require('./table-checks.js');

const DEFAULT_SRC = 'dflow/specs';
const DEFAULT_OUT = 'dflow-specs-html';
const DEFAULT_TITLE = 'dflow specs';

// Ownership + stale-cleanup ledger for the output directory. The manifest
// lists every file the previous run generated (mirror .html tree + root
// index.html; never the manifest itself). Its presence marks the directory as
// render-owned; its file list is the ONLY set stale cleanup may ever delete.
const MANIFEST_NAME = '.dflow-render-manifest.json';
const MANIFEST_TMP_NAME = `${MANIFEST_NAME}.tmp`;
const MANIFEST_VERSION = 1;
// Per-file ownership proof, embedded in every rendered page. The manifest
// alone is a weak proof for mutations — it is an ordinary JSON file that can
// be copied or hand-written into a directory full of foreign files (cold-eye
// gate G3 F1) — so deletes and overwrites additionally require this marker
// in the target file itself. Keep the text stable across versions: outputs
// of older dflow renders must stay recognized by newer ones.
const GENERATED_MARK = '<!-- generated by dflow render -->';

const PHASE_MARK_STYLE = {
  ADDED: ['ok', '新增'],
  MODIFIED: ['warn', '修改'],
  REMOVED: ['del', '移除'],
  RENAMED: ['info', '改名']
};

const STATUS_PILL = {
  'in-progress': 'warn',
  completed: 'ok',
  done: 'ok',
  open: 'info',
  draft: 'neutral'
};

// Gherkin keyword highlighting reaches three contexts: ```gherkin/feature
// fences, untagged fences that LOOK like scenario blocks, and plain prose
// paragraphs whose lines are all keyword-led (the dominant OBTS behavior.md
// style — steps as ordinary text with two-space line breaks). The prose and
// untagged-fence paths require >= 2 keyword-led lines: a lone English prose
// paragraph starting with "When the …" must never light up.
const GHERKIN_KW_SRC = '(Scenario(?: Outline)?:|Background:|Examples:|Given|When|Then|And|But)';
const GHERKIN_KEYWORDS = new RegExp(`^(\\s*)${GHERKIN_KW_SRC}(?=[ \\t]|$)`, 'gm');
const GHERKIN_PROSE_LINE = new RegExp(`^(\\s*)${GHERKIN_KW_SRC}(?=[ \\t])`);
// Step keywords carry per-keyword classes (Given=setup, When=action,
// Then=assertion, And/But=continuation); block headers share kw-s.
const GHERKIN_KW_CLASS = { Given: 'kw-g', When: 'kw-w', Then: 'kw-t', And: 'kw-a', But: 'kw-a' };

function gherkinKwSpan(kw) {
  const cls = kw.endsWith(':') ? 'kw-s' : GHERKIN_KW_CLASS[kw];
  return `<span class="kw ${cls}">${kw}</span>`;
}

function highlightGherkin(escapedText) {
  return escapedText.replace(GHERKIN_KEYWORDS, (m, lead, kw) => `${lead}${gherkinKwSpan(kw)}`);
}

// >= 2 keyword-led lines -> treat an untagged fence as a scenario block.
function looksLikeGherkin(text) {
  const hits = String(text).match(GHERKIN_KEYWORDS);
  return hits !== null && hits.length >= 2;
}

// Raw inline HTML can carry a newline or a literal <br> inside an attribute
// value, and the string-level line split below would then inject a keyword
// span into the middle of a tag (review visual-r1 F1). Any html token in
// the paragraph's inline tree disqualifies it from prose highlighting —
// codespans, links, and em/strong stay eligible (their rendered tags can
// never begin a split line without also failing the keyword-led test).
function hasRawHtmlToken(tokens) {
  for (const token of tokens || []) {
    if (token.type === 'html' || (token.tokens && hasRawHtmlToken(token.tokens))) {
      return true;
    }
  }
  return false;
}

// Split rendered inline HTML into [line, delim, line, …] at hard-break
// <br> tags and soft-break newlines that sit OUTSIDE any tag. Markdown
// link/image titles may span lines, so a newline can legally live inside
// a rendered title="…" attribute — splitting there would let the keyword
// wrapper inject a span mid-tag (review visual-r2 F1). Marked-rendered
// attributes are entity-escaped, so tag extents are exactly the unescaped
// '<'…'>' pairs; raw html tokens (where that guarantee fails) are already
// excluded by hasRawHtmlToken before this runs.
function splitProseLines(innerHtml) {
  const html = String(innerHtml);
  const parts = [];
  let cur = '';
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i];
    if (inTag) {
      cur += ch;
      if (ch === '>') {
        inTag = false;
      }
      continue;
    }
    if (ch === '<') {
      const br = /^<br\s*\/?>/i.exec(html.slice(i));
      if (br) {
        parts.push(cur, br[0]);
        cur = '';
        i += br[0].length - 1;
      } else {
        inTag = true;
        cur += ch;
      }
      continue;
    }
    if (ch === '\n') {
      parts.push(cur, '\n');
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

// Prose steps: a paragraph qualifies when it holds >= 2 non-empty lines
// (tag-aware split, see above) and EVERY one starts with a step/header
// keyword; then each line's keyword is wrapped — always at tag depth zero,
// because every segment starts outside a tag by construction. The
// every-line rule keeps hard-wrapped ordinary prose (where one wrapped
// line may start with "When …") from ever qualifying.
function highlightProseSteps(innerHtml) {
  const parts = splitProseLines(innerHtml);
  const lines = parts.filter((p, i) => i % 2 === 0 && p.trim() !== '');
  if (lines.length < 2 || !lines.every((line) => GHERKIN_PROSE_LINE.test(line))) {
    return innerHtml;
  }
  return parts
    .map((p, i) => (i % 2 === 0 ? p.replace(GHERKIN_PROSE_LINE, (m, lead, kw) => `${lead}${gherkinKwSpan(kw)}`) : p))
    .join('');
}

// All multi-column tables render as cards (user decision 2026-07-09 after two
// prototype demo rounds; no per-table heuristic) — and, since PROPOSAL-108,
// as a table too, behind a per-table switch. Degenerate single-column
// tables keep the plain-table rendering. Columns named here are per-record
// classifiers -> prominent chips under the card title.
const CAT_HEADERS = new Set([
  'root entity', 'bounded context', 'aggregate', '所屬 aggregate',
  'status', 'subdomain type', 'layer', 'severity', 'owner / team', 'producer'
]);

// PROPOSAL-077 A1 long-field thresholds, in plain-text code points of the
// cell (tags stripped; CJK counts 1 per character). LONG promotes the card
// to a full grid row plus prose line spacing — at ~24 CJK chars per line in
// a 330px card, 200 chars is 8+ rendered lines, beyond any convention-
// compliant summary. CLAMP additionally caps the field at CLAMP_LINES with
// a CSS-only expand toggle; 400 chars still exceeds CLAMP_LINES at full
// content width (~59 CJK chars per line), so the toggle only appears where
// clipping is near-certain. Latin text runs narrower per char, so a wide
// latin field can show a toggle whose expansion reveals little — accepted
// noise; thresholds are not script-aware by design. The row title and chip
// columns are exempt: titles are names by design, chips are ≤40 chars.
const LONG_FIELD_CHARS = 200;
const CLAMP_FIELD_CHARS = 400;
const CLAMP_LINES = 6;

// PROPOSAL-108 table view, values set by the user in the visual iteration
// (2026-10-09). Widths are display columns of the plain text (tags
// stripped): a CJK or fullwidth character counts 2, anything else 1.
// SHORT_COLUMN_WIDTH: a column whose every body cell is at most this wide
// never wraps (IDs, dates, statuses). TABLE_CLAMP_CHARS counts code points,
// like the P-077 thresholds: a table cell this long is clamped behind the
// same expand toggle — lower than CLAMP_FIELD_CHARS because a table column
// is narrower than a card. WIDE_TABLE_WIDTH: a table whose estimated natural
// width (each column's widest cell or header, capped at WIDE_COLUMN_CAP,
// plus TABLE_CELL_PADDING) exceeds it leaves the 54rem text column.
// PRINT_MIN_SHARE (percent): in print no column gets less of the paper than
// one full-width character and its 0.4em padding on each side (1.8em) on an
// A4 portrait page, about 50em at the table view's font.
const TABLE_VIEWS = new Set(['cards', 'table']);
const SHORT_COLUMN_WIDTH = 24;
const TABLE_CLAMP_CHARS = 200;
const WIDE_COLUMN_CAP = 40;
const TABLE_CELL_PADDING = 3;
const WIDE_TABLE_WIDTH = 120;
const PRINT_MIN_SHARE = 3.6;

const CSS = `
:root {
  --bg:#f6f8f9; --surface:#ffffff; --frame:#eef2f4; --deep:#e7edef;
  --ink:#1c2733; --soft:#5a6b79; --faint:#8a99a6; --line:#dbe4e9;
  --accent:#0e6e63; --accent-soft:#e0f0ed; --accent-line:#b8dcd6;
  --ok-fg:#1e6b34; --ok-bg:#e2f2e6; --ok-line:#bfe0c7;
  --warn-fg:#8a5600; --warn-bg:#f7ecd7; --warn-line:#e8d5ac;
  --del-fg:#9c3838; --del-bg:#f9e9e9; --del-line:#e8c4c4;
  --head-strong:#0a4f47; --kw-then:#6d4fc2;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#10161c; --surface:#171f27; --frame:#0c1217; --deep:#0a0f14;
    --ink:#d9e2ea; --soft:#93a4b1; --faint:#6b7c89; --line:#2a3641;
    --accent:#4cc2b4; --accent-soft:#11302c; --accent-line:#1e4f48;
    --ok-fg:#7bd397; --ok-bg:#142d1b; --ok-line:#235c33;
    --warn-fg:#e2b269; --warn-bg:#2f2510; --warn-line:#59461d;
    --del-fg:#e08f8f; --del-bg:#331a1a; --del-line:#5c2727;
    --head-strong:#7fd8ca; --kw-then:#b6a0f0;
  }
}
* { box-sizing: border-box; }
body {
  background: var(--bg); color: var(--ink); margin: 0;
  font-family: "Segoe UI","Noto Sans TC","Microsoft JhengHei","PingFang TC",
    "Helvetica Neue",Arial,sans-serif;
  font-size: 15.5px; line-height: 1.78; padding: 2.5rem 1.25rem 4rem;
}
main { max-width: 54rem; margin: 0 auto; }
a { color: var(--accent); }
code, pre { font-family: "Cascadia Code","Cascadia Mono",Consolas,monospace; }
code {
  background: var(--frame); border: 1px solid var(--line);
  border-radius: 4px; padding: 0.05em 0.35em; font-size: 0.86em;
}
pre {
  background: var(--deep); border: 1px solid var(--line); border-radius: 8px;
  padding: 0.85rem 1.1rem; overflow-x: auto; font-size: 12.8px; line-height: 1.85;
}
pre code { background: none; border: none; padding: 0; font-size: inherit; }
h1 { font-size: 25px; line-height: 1.35; margin: 0.2rem 0 1rem; color: var(--head-strong); }
h2 {
  font-size: 19px; margin: 2.2rem 0 0.6rem; padding-top: 1.2rem;
  border-top: 1px solid var(--line); color: var(--head-strong);
}
h3 { font-size: 16.5px; margin: 1.6rem 0 0.4rem; color: var(--accent); }
h4 { font-size: 15px; margin: 1.2rem 0 0.3rem; color: var(--accent); }
blockquote {
  margin: 0.8rem 0; padding: 0.55rem 1rem;
  background: var(--accent-soft); border-left: 3px solid var(--accent);
  border-radius: 0 8px 8px 0; color: var(--soft); font-size: 14px;
}
blockquote p { margin: 0.2rem 0; }
hr { border: none; border-top: 1px solid var(--line); margin: 2rem 0; }
.tblwrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 0.6rem 0 1rem; }
th {
  text-align: left; font-size: 11.5px; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--soft); font-weight: 600;
  padding: 0.45rem 0.9rem 0.45rem 0; border-bottom: 1.5px solid var(--line);
  white-space: nowrap;
}
td { padding: 0.55rem 0.9rem 0.55rem 0; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: none; }
.badge {
  display: inline-block; font-size: 11.5px; font-weight: 600; line-height: 1;
  padding: 3px 9px; border-radius: 999px; border: 1px solid; white-space: nowrap;
  vertical-align: 0.15em;
}
.badge.ok { color: var(--ok-fg); background: var(--ok-bg); border-color: var(--ok-line); }
.badge.warn { color: var(--warn-fg); background: var(--warn-bg); border-color: var(--warn-line); }
.badge.del { color: var(--del-fg); background: var(--del-bg); border-color: var(--del-line); }
.badge.info, .badge.neutral { color: var(--accent); background: var(--accent-soft); border-color: var(--accent-line); }
.chip {
  display: inline-block; font-size: 11px; font-weight: 600; color: var(--soft);
  background: var(--frame); border: 1px solid var(--line); border-radius: 999px;
  padding: 2px 8px; vertical-align: 0.2em;
}
.cb {
  display: inline-block; width: 14px; height: 14px; border-radius: 4px;
  border: 1.5px solid var(--faint); vertical-align: -0.12em; margin-right: 0.15em;
}
.cb.on { background: var(--accent); border-color: var(--accent); position: relative; }
.cb.on::after {
  content: ""; position: absolute; left: 4px; top: 1px; width: 3px; height: 7px;
  border: solid var(--bg); border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.kw { font-weight: 700; }
.kw-s { color: var(--accent); }
.kw-g { color: var(--ok-fg); }
.kw-w { color: var(--warn-fg); }
.kw-t { color: var(--kw-then); }
.kw-a { color: var(--soft); }
.cards {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 0.9rem; align-items: start; margin: 0.8rem 0 1.4rem;
}
.card {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 10px; overflow: hidden;
}
.card-title {
  background: var(--accent-soft); color: var(--accent);
  border-bottom: 1px solid var(--accent-line);
  font-size: 15px; font-weight: 700; padding: 0.55rem 0.95rem;
}
.card-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.55rem 0.95rem 0; }
.chip.cat {
  color: var(--accent); background: transparent; border-color: var(--accent-line);
  font-size: 11.5px; vertical-align: baseline;
}
.card-fields { padding: 0.15rem 0 0.55rem; }
.fld { padding: 0.45rem 0.95rem 0.05rem; }
.fld-k {
  display: block; font-size: 11px; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--accent); font-weight: 650;
  margin-bottom: 0.05rem;
}
.fld-v { font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
.card.wide { grid-column: 1 / -1; }
.fld-v.prose { line-height: 1.85; position: relative; }
.fxt { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
.fxc { max-height: calc(${CLAMP_LINES} * 1.85em); overflow: hidden; position: relative; }
.fxc::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2.4em;
  background: linear-gradient(to bottom, transparent, var(--surface));
}
.fxt:checked ~ .fxc { max-height: none; }
.fxt:checked ~ .fxc::after { display: none; }
.fxl {
  display: inline-block; margin: 0.35rem 0 0.1rem; padding: 2px 10px;
  font-size: 11.5px; font-weight: 600; color: var(--accent);
  background: var(--accent-soft); border: 1px solid var(--accent-line);
  border-radius: 999px; cursor: pointer; user-select: none;
}
.fxl .fxs { display: none; }
.fxt:checked ~ .fxl .fxm { display: none; }
.fxt:checked ~ .fxl .fxs { display: inline; }
.fxt:focus-visible ~ .fxl { outline: 2px solid var(--accent); outline-offset: 2px; }
@media print {
  .fxc { max-height: none; }
  .fxc::after, .fxl, .fxt { display: none; }
}
.crumb { font-size: 12px; color: var(--faint); font-family: Consolas, monospace; margin: 0 0 1rem; }
.crumb a { color: var(--faint); }
.meta-card {
  background: var(--frame); border: 1px solid var(--line); border-radius: 10px;
  padding: 1rem 1.2rem; margin: 0 0 1.6rem;
}
.meta-title { display: flex; flex-wrap: wrap; align-items: center; gap: 0.7rem;
  font-size: 18px; font-weight: 650; margin: 0 0 0.5rem; }
.meta-grid { display: flex; flex-wrap: wrap; gap: 0.3rem 1.4rem; font-size: 12.8px; color: var(--soft); }
.meta-grid .k { color: var(--faint); margin-right: 0.35em; }
.foot {
  margin-top: 3rem; padding-top: 0.9rem; border-top: 1px solid var(--line);
  color: var(--faint); font-size: 12px; font-family: Consolas, monospace;
}
ul.tree, ul.tree ul { list-style: none; line-height: 2; font-size: 13.5px; }
ul.tree { padding-left: 0; }
ul.tree ul { padding-left: 1.35rem; margin: 0; }
ul.tree .dir { color: var(--faint); font-weight: 600; }
ul.tree .years { font-size: 13px; color: var(--faint); }
ul.tree .years a { font-weight: 600; }
.yearnav { font-size: 13.5px; color: var(--faint); margin: -0.3rem 0 1.1rem; font-family: Consolas, monospace; }
.yearnav a { text-decoration: none; font-weight: 600; }
.yearnav strong { color: var(--ink); }
ul.tree a { text-decoration: none; font-family: Consolas, monospace; }
ul.tree a:hover { text-decoration: underline; }
ul.tree li { position: relative; }
ul.tree ul li::before {
  content: ""; position: absolute; left: -0.85rem; top: 0; height: 100%;
  border-left: 1px solid var(--line);
}
ul.tree ul li:last-child::before { height: 1em; }
ul.tree ul li::after {
  content: ""; position: absolute; left: -0.85rem; top: 1em; width: 0.6rem;
  border-top: 1px solid var(--line);
}
ul.tree .dir::before, ul.tree li > a::before {
  content: ""; display: inline-block; width: 15px; height: 15px;
  margin-right: 0.45em; vertical-align: -0.2em; background: currentColor;
}
ul.tree .dir::before {
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M1.5 4A1.5 1.5 0 0 1 3 2.5h3.1l1.6 2H13A1.5 1.5 0 0 1 14.5 6v6.5A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5z'/%3E%3C/svg%3E") center/contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M1.5 4A1.5 1.5 0 0 1 3 2.5h3.1l1.6 2H13A1.5 1.5 0 0 1 14.5 6v6.5A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5z'/%3E%3C/svg%3E") center/contain no-repeat;
}
ul.tree li > a::before {
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M4 1.5h5.4L13.5 5.6V13A1.5 1.5 0 0 1 12 14.5H4A1.5 1.5 0 0 1 2.5 13V3A1.5 1.5 0 0 1 4 1.5zm5.4 0v4.1h4.1z'/%3E%3C/svg%3E") center/contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M4 1.5h5.4L13.5 5.6V13A1.5 1.5 0 0 1 12 14.5H4A1.5 1.5 0 0 1 2.5 13V3A1.5 1.5 0 0 1 4 1.5zm5.4 0v4.1h4.1z'/%3E%3C/svg%3E") center/contain no-repeat;
}
`;

// ------------------------------------------------------------------ file IO
// Windows MAX_PATH is 260 chars; dflow spec directories (SPEC-YYYYMMDD-NNN-slug)
// plus long spec filenames overflow it easily. path.toNamespacedPath() opts
// absolute paths into \\?\ extended-length form on win32 (no-op elsewhere).

function ioPath(p) {
  return path.toNamespacedPath(p);
}

async function readText(p) {
  return fs.readFile(ioPath(p), 'utf8');
}

// First `bytes` of a file as utf8. The ownership-proof check only needs the
// head (GENERATED_MARK sits on line 2 of every rendered page), and a forged
// manifest may list an arbitrarily large foreign file — never slurp it whole.
async function readHead(p, bytes) {
  const handle = await fs.open(ioPath(p), 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return buf.toString('utf8', 0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function writeText(p, text) {
  await fs.mkdir(ioPath(path.dirname(p)), { recursive: true });
  await fs.writeFile(ioPath(p), text, 'utf8');
}

// -------------------------------------------------------------- html helpers

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only used on our own rendered fragments (for slugs and card classification),
// so covering numeric references plus the five entities escapeHtml/marked emit
// is sufficient — this is not a general-purpose HTML entity decoder. A
// numeric reference that names no character stays as written, by the rule
// lib/render-diagrams.js applies (decoding it would throw and fail the run),
// unless the caller passes its own decoder (headingSlug does).
function unescapeHtml(text, ref = diagrams.numericReference) {
  return String(text)
    .replace(/&#(\d+);/g, (m, dec) => ref(Number(dec), m))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (m, hex) => ref(parseInt(hex, 16), m))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(fragment) {
  return unescapeHtml(String(fragment).replace(/<[^>]+>/g, '')).trim();
}

// ------------------------------------------------------------ preprocessing

// Parse a leading flat `key: value` frontmatter block, if present.
function splitFrontmatter(text) {
  if (!text.startsWith('---')) {
    return { meta: {}, body: text };
  }
  const lines = text.split('\n');
  const meta = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      return { meta, body: lines.slice(i + 1).join('\n') };
    }
    const colon = line.indexOf(':');
    if (colon !== -1 && !line.trimStart().startsWith('#')) {
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).replace(/\s+#.*$/, '').trim();
      meta[key] = value;
    }
  }
  return { meta: {}, body: text }; // no closing fence -> treat as content
}

// PROPOSAL-112 (E): a text that can tell, for any offset in it, the offset
// that character came from in the source file, so a line of the parse can be
// told in the file's own lines. Each edit goes through replaceTracked, which
// returns exactly what text.replace(regex, replacer) returns and keeps the
// list of what it replaced; a replacement's characters all come from where
// the replaced text began. Offsets are only worked out when asked for.
function trackedText(text, startOffset) {
  return { text, originOf: (offset) => startOffset + offset };
}

function replaceTracked(tracked, regex, replacer) {
  const edits = []; // [start, end] in the new text, [start, end] in the old
  let shift = 0;
  const text = tracked.text.replace(regex, (...args) => {
    const match = args[0];
    const offset = args.find((arg, i) => i > 0 && typeof arg === 'number');
    const replacement = replacer(...args);
    edits.push([offset + shift, offset + shift + replacement.length, offset, offset + match.length]);
    shift += replacement.length - match.length;
    return replacement;
  });
  if (edits.length === 0) {
    return { text, originOf: tracked.originOf };
  }
  return {
    text,
    originOf(offset) {
      let lo = 0;
      let hi = edits.length - 1;
      let last = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (edits[mid][0] <= offset) {
          last = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (last === -1) {
        return tracked.originOf(offset);
      }
      const [, newEnd, oldStart, oldEnd] = edits[last];
      return tracked.originOf(offset < newEnd ? oldStart : oldEnd + (offset - newEnd));
    }
  };
}

// Rewrite AI-facing markers into human-facing spans before conversion.
// (Task-list checkboxes need no preprocessing here: marked's GFM parser
// tokenizes them natively and the checkbox renderer below restyles them.)
// Takes and returns a tracked text (PROPOSAL-112), so the line map follows
// the edits actually made: a section marker takes the blank lines after it
// along, and one at the end of a line joins it to the next.
function preprocess(source) {
  // structural section markers: drop
  let tracked = replaceTracked(source, /<!--\s*dflow:section[^>]*-->\s*\n?/g, () => '');

  // phase change markers -> badges
  tracked = replaceTracked(
    tracked,
    /<!--\s*phase-(\d+)\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s*-->/g,
    (match, phase, kind) => {
      const [cls, zh] = PHASE_MARK_STYLE[kind];
      return `<span class="badge ${cls}">phase-${phase} ${zh}</span>`;
    }
  );

  // heading fill-timing comments -> chips
  tracked = replaceTracked(
    tracked,
    /^(#{1,6} .*?)\s*<!--\s*Fill timing:\s*(.*?)\s*-->/gm,
    (match, headingText, timing) => `${headingText} <span class="chip">${escapeHtml(timing)}</span>`
  );

  return tracked;
}

// PROPOSAL-112 (E): the line map the table checks read — the text marked
// lexes (it turns CRLF and a lone CR into LF before anything else) and, for
// an offset in it, the line of the source file that character came from,
// counting from the file's first line, frontmatter included. Built when
// first read: a page without a table never reads it.
function lineMapOf(source, preprocessed) {
  let lexed = null;
  let lineStarts = null;
  const lex = () => lexed || (lexed = replaceTracked(preprocessed, /\r\n|\r/g, () => '\n'));
  return {
    get text() {
      return lex().text;
    },
    lineOf(offset) {
      if (lineStarts === null) {
        lineStarts = [0];
        for (const m of source.matchAll(/\r\n|\r|\n/g)) {
          lineStarts.push(m.index + m[0].length);
        }
      }
      const origin = lex().originOf(offset);
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= origin) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      return lo + 1;
    }
  };
}

// ------------------------------------------------------------ marked renderer

const CHIP_SPAN = /<span class="chip[^"]*">[\s\S]*?<\/span>/g;
const ANY_TAG = /<[^>]+>/g;

// GitHub-style heading slug so `#anchor` links resolve in the HTML. CJK trap:
// JavaScript \w is ASCII-only (unlike Python \w), so the character class must
// use Unicode properties — [\p{L}\p{N}_\- ] with the u flag — or every 中文
// heading would slug to the empty string.
//
// The slug decodes a numeric reference to its code point as it always did —
// U+0000 and lone surrogates included, so two references can still form one
// character — and only one beyond U+10FFFF, which used to throw and fail the
// run, becomes U+0000, which the filter below removes: every heading the
// pre-PROPOSAL-108 renderer could slug keeps its id.
function slugCodePoint(codePoint) {
  return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\u0000';
}

function headingSlug(innerHtml, seen) {
  const text = String(innerHtml).replace(CHIP_SPAN, '').replace(ANY_TAG, '');
  let slug = unescapeHtml(text, slugCodePoint).trim().toLowerCase();
  slug = slug.replace(/[^\p{L}\p{N}_\- ]/gu, '');
  slug = slug.replace(/ +/g, '-');
  if (!slug) {
    return null;
  }
  const n = seen.get(slug) || 0;
  seen.set(slug, n + 1);
  return n ? `${slug}-${n}` : slug;
}

function plainTableHtml(headerCells, rows) {
  const head = headerCells.map((cell) => `<th>${cell}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('\n');
  return `<div class="tblwrap"><table>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table></div>\n`;
}

// Card anatomy (prototype-converged shape): first column -> accent title bar;
// classifier columns (CAT_HEADERS) -> chips under the title (status reuses the
// pill styling); remaining columns -> stacked label+value fields, with in-cell
// <br> line breaks preserved verbatim. Empty cells are omitted. Degenerate
// single-column tables keep the plain-table rendering.
//
// Long fields (PROPOSAL-077 A1): a field at LONG_FIELD_CHARS+ makes its card
// span the full grid row and gets prose spacing; at CLAMP_FIELD_CHARS+ the
// field is additionally clamped behind a checkbox-driven CSS toggle (the
// checkbox stays focusable for keyboard use; print CSS removes the clamp).
// The field's HTML is emitted unmodified inside the clamp wrapper — never
// split, reflowed, or reworded. nextToggleId mints document-unique ids for
// the checkbox/label pairs.
function cardsHtml(headerCells, rows, nextToggleId) {
  const cards = rows.map((cells) => {
    const plains = cells.map(stripTags);
    const title = plains[0] ? cells[0] : `${hasAuthorId(cells[0]) ? cells[0] : ''}（未命名）`;
    const chips = [];
    const fields = [];
    let hasLongField = false;
    for (let i = 1; i < headerCells.length; i++) {
      const cell = cells[i] ?? '';
      const text = plains[i] ?? '';
      if (!text && !hasAuthorId(cell)) {
        continue;
      }
      const headerKey = stripTags(headerCells[i]).toLowerCase();
      if (CAT_HEADERS.has(headerKey) && [...text].length <= 40) {
        if (headerKey === 'status') {
          const pill = STATUS_PILL[text] || 'neutral';
          chips.push(`<span class="badge ${pill}">${cell}</span>`);
        } else {
          chips.push(`<span class="chip cat">${headerCells[i]}: ${cell}</span>`);
        }
      } else {
        const chars = [...text].length;
        let valueHtml = cell;
        let valueClass = 'fld-v';
        if (chars >= LONG_FIELD_CHARS) {
          hasLongField = true;
          valueClass = 'fld-v prose';
          if (chars >= CLAMP_FIELD_CHARS) {
            const id = nextToggleId();
            valueHtml =
              `<input type="checkbox" class="fxt" id="${id}">` +
              `<div class="fxc">${cell}</div>` +
              `<label class="fxl" for="${id}">` +
              '<span class="fxm">展開全文 ▾</span><span class="fxs">收合 ▴</span></label>';
          }
        }
        fields.push(
          `<div class="fld"><span class="fld-k">${headerCells[i]}</span>` +
          `<div class="${valueClass}">${valueHtml}</div></div>`
        );
      }
    }
    const chipsHtml = chips.length ? `<div class="card-chips">${chips.join('')}</div>` : '';
    return `<article class="card${hasLongField ? ' wide' : ''}"><div class="card-title">${title}</div>` +
      `${chipsHtml}<div class="card-fields">${fields.join('')}</div></article>`;
  });
  return `<div class="cards">${cards.join('')}</div>\n`;
}

// East Asian wide and fullwidth ranges (plus emoji): two display columns.
function isWideChar(codePoint) {
  return (codePoint >= 0x1100 && codePoint <= 0x115f) || (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) || (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) || (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd);
}

function displayWidth(text) {
  let width = 0;
  for (const ch of text) {
    width += isWideChar(ch.codePointAt(0)) ? 2 : 1;
  }
  return width;
}

// PROPOSAL-108 (A): a cell holding an element with its own id or name would
// put that id on the page twice if both forms were emitted (a link to it
// could land in the hidden copy), so such a table gets its starting form
// only. The cards keep a body cell's id once (an otherwise empty cell
// holding one is kept, not omitted); a header cell's id is repeated as each
// card's label, as it always was — the table view holds the header once. Tags are matched with their quoted attribute values, so a `>` inside
// a value does not end the tag early; text and code spans are already
// escaped by marked and never match.
const HTML_TAG = /<[a-zA-Z][^\s\/>]*((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const HTML_ATTR_NAME = /\s+([^\s"'>\/=]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

function hasAuthorId(cellHtml) {
  for (const tag of String(cellHtml).matchAll(HTML_TAG)) {
    for (const attr of tag[1].matchAll(HTML_ATTR_NAME)) {
      const name = attr[1].toLowerCase();
      if (name === 'id' || name === 'name') {
        return true;
      }
    }
  }
  return false;
}

// PROPOSAL-108 (E) print widths, in percent of the paper: each column's share
// of the natural width, but never under PRINT_MIN_SHARE — a narrower column
// pushes its text into the next one — with the difference taken from the
// wider columns in proportion. A table with too many columns for every one
// to get that much shares the paper equally, and may still crowd in print.
function printShares(widths) {
  const floored = widths.map(() => false);
  for (;;) {
    const room = 100 - PRINT_MIN_SHARE * floored.filter(Boolean).length;
    const free = widths.reduce((sum, w, c) => sum + (floored[c] ? 0 : w), 0);
    if (room <= 0 || free === 0) return widths.map(() => 100 / widths.length);
    const shares = widths.map((w, c) => (floored[c] ? PRINT_MIN_SHARE : (w / free) * room));
    const under = shares.map((s, c) => !floored[c] && s < PRINT_MIN_SHARE);
    if (!under.some(Boolean)) return shares;
    under.forEach((u, c) => { if (u) floored[c] = true; });
  }
}

// PROPOSAL-108 (C) table view: the same cells as the Markdown table, laid
// out as a table. A column whose every body cell is short never wraps
// (class nw; any other column gets class wc and a minimum width); a long
// cell is clamped behind the P-077 toggle with ids from nextClampId (its own
// sequence, so the card ids do not move); a short status cell gets a colored
// dot from a class on the cell; a table whose estimated natural width
// overflows the text column is reported wide. Cell HTML is emitted
// unmodified, empty cells included.
function tableViewHtml(headerCells, rows, nextClampId) {
  const headerPlains = headerCells.map(stripTags);
  const plains = rows.map((cells) => cells.map(stripTags));
  const shortColumn = [];
  const columnWidths = [];
  for (let c = 0; c < headerCells.length; c++) {
    let widest = 0;
    for (const row of plains) {
      widest = Math.max(widest, displayWidth(row[c] ?? ''));
    }
    shortColumn.push(widest <= SHORT_COLUMN_WIDTH);
    columnWidths.push(Math.min(Math.max(widest, displayWidth(headerPlains[c])), WIDE_COLUMN_CAP) + TABLE_CELL_PADDING);
  }
  const naturalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
  // print lays the table out fixed at these shares (--w), so any number of
  // columns fits the paper; the screen ignores them
  const cols = printShares(columnWidths).map((s) => `<col style="--w:${s.toFixed(2)}%">`).join('');
  const statusColumn = headerPlains.findIndex((h) => h.toLowerCase() === 'status');
  const head = headerCells
    .map((cell, c) => `<th class="${shortColumn[c] ? 'nw' : 'wc'}">${cell}</th>`)
    .join('');
  const body = rows.map((cells, r) => {
    const tds = [];
    for (let c = 0; c < headerCells.length; c++) {
      const cell = cells[c] ?? '';
      const text = plains[r][c] ?? '';
      const classes = [shortColumn[c] ? 'nw' : 'wc'];
      let cellHtml = cell;
      if ([...text].length >= TABLE_CLAMP_CHARS) {
        const id = nextClampId();
        classes.push('lc');
        cellHtml =
          `<input type="checkbox" class="fxt" id="${id}">` +
          `<div class="fxc">${cell}</div>` +
          `<label class="fxl" for="${id}">` +
          '<span class="fxm">展開全文 ▾</span><span class="fxs">收合 ▴</span></label>';
      }
      if (c === statusColumn && text && [...text].length <= 40) {
        classes.push('st', STATUS_PILL[text] || 'neutral');
      }
      tds.push(`<td class="${classes.join(' ')}">${cellHtml}</td>`);
    }
    return `<tr>${tds.join('')}</tr>`;
  }).join('\n');
  return {
    wide: naturalWidth > WIDE_TABLE_WIDTH,
    html: `<div class="tblwrap"><table>\n<colgroup>${cols}</colgroup>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table></div>\n`
  };
}

// PROPOSAL-108 (A): the card/table switch, one per table — two radios
// (named 卡片 and 表格 by their labels, one tab stop, arrow keys switch)
// placed before both forms so sibling selectors show the checked one.
// Pure CSS, no script. Only on pages that hold a switch or a table view.
// A wide table leaves the text column only at the top level of the page
// (its 50% is then the text column; inside a list item or a block quote it
// would not be) — nested, it scrolls in its own container. Print shows the
// form on screen, without the switch, every clamp open, no nowrap, no
// minimum widths, no widening, a long word (a header included) breaking
// anywhere, and a fixed layout at each column's print share (printShares())
// with a 0.4em side padding, so every column fits the paper and, unless the
// table has too many columns for printShares() to floor, holds at least one
// character — with nothing in a cell wider than the cell (a phase badge
// wraps, an image scales).
const TABLE_VIEW_CSS = `
.tv { margin: 0.8rem 0 1.4rem; }
.tv > .tv-cards > .cards { margin: 0.45rem 0 0; }
.tvr { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
.tvs {
  display: inline-flex; border: 1px solid var(--accent-line); border-radius: 999px;
  overflow: hidden; font-size: 11.5px; font-weight: 600; line-height: 1.6; user-select: none;
}
.tvs label { padding: 1px 11px; color: var(--soft); cursor: pointer; }
.tvc:checked ~ .tvs .tvl-c, .tvt:checked ~ .tvs .tvl-t { color: var(--accent); background: var(--accent-soft); }
.tvc:focus-visible ~ .tvs .tvl-c, .tvt:focus-visible ~ .tvs .tvl-t { outline: 2px solid var(--accent); outline-offset: -2px; }
.tv > .tv-cards, .tv > .tv-table { display: none; }
.tvc:checked ~ .tv-cards, .tvt:checked ~ .tv-table { display: block; }
.tv-table .tblwrap {
  background: var(--surface); border: 1px solid var(--line); border-radius: 10px; margin: 0.45rem 0 0;
}
.tv-table table { margin: 0; font-size: 13.5px; }
.tv-table th {
  white-space: normal; background: var(--frame); vertical-align: bottom;
  padding: 0.5rem 0.75rem; border-bottom: 1.5px solid var(--line);
}
.tv-table td { padding: 0.5rem 0.75rem; line-height: 1.7; overflow-wrap: anywhere; }
.tv-table td:first-child { font-weight: 650; color: var(--accent); }
.tv-table td.nw { white-space: nowrap; overflow-wrap: normal; }
.tv-table .wc { min-width: 11em; }
.tv-table td.lc { position: relative; min-width: 16em; }
.tv-table td.st { font-weight: 600; }
.tv-table td.st::before {
  content: ""; display: inline-block; width: 0.55em; height: 0.55em; border-radius: 50%;
  background: currentColor; margin-right: 0.4em; vertical-align: 0.08em;
}
.tv-table td.st.ok { color: var(--ok-fg); }
.tv-table td.st.warn { color: var(--warn-fg); }
.tv-table td.st.del { color: var(--del-fg); }
.tv-table td.st.info, .tv-table td.st.neutral { color: var(--accent); }
.tv-table .fxc { max-height: calc(${CLAMP_LINES} * 1.7em); }
main > .tv > .tv-table.wide, main > .tv-table.wide {
  width: min(calc(100vw - 4rem), 90rem);
  margin-left: calc(50% - min(calc(50vw - 2rem), 45rem));
}
@media print {
  .tvs { display: none; }
  .tv-table .fxc { max-height: none; }
  .tv-table th, .tv-table td.nw { white-space: normal; overflow-wrap: anywhere; }
  .tv-table table { table-layout: fixed; }
  .tv-table col { width: var(--w); }
  .tv-table th, .tv-table td { padding-left: 0.4em; padding-right: 0.4em; }
  .tv-table td *, .tv-table th * { max-width: 100%; }
  .tv-table .badge { white-space: normal; overflow-wrap: anywhere; }
  .tv-table img { height: auto; }
  .tv-table .wc, .tv-table td.lc { min-width: 0; }
  .tv-table .tblwrap { overflow: visible; }
  main > .tv > .tv-table.wide, main > .tv-table.wide { width: auto; margin-left: 0; }
}
`;

// Per-file renderer overrides. `seen` carries the per-document heading slug
// dedup state, so a fresh renderer is built for every file. toggleSeq mints
// the per-document ids for long-field clamp toggles; the `fldx-` prefix
// keeps them out of the heading-slug namespace (slugs never contain a
// hyphenated `fldx-N` unless a heading literally says so). PROPOSAL-108:
// the card/table switches (`tvx-N`) and the table view's clamp toggles
// (`tfx-N`) count on their own sequences, for the same reason and so that
// the card ids stay what they were; tableView is the starting form, and
// usage.tableView records that the page needs TABLE_VIEW_CSS.
function buildRenderer(seen, tableView, usage) {
  let toggleSeq = 0;
  let viewSeq = 0;
  let tableClampSeq = 0;
  return {
    heading(token) {
      const inner = this.parser.parseInline(token.tokens);
      const slug = headingSlug(inner, seen);
      const id = slug ? ` id="${slug}"` : '';
      return `<h${token.depth}${id}>${inner}</h${token.depth}>\n`;
    },

    // Point relative .md links at the mirrored .html files (anchors kept).
    // Only scheme-less hrefs are candidates: a scheme-qualified link
    // (https:, mailto:, file:, …) is not a mirrored tree file, and the
    // proposal scopes rewriting to relative .md links (cold-eye gate G7).
    link(token) {
      const inner = this.parser.parseInline(token.tokens);
      let href = token.href || '';
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) && !href.startsWith('#')) {
        href = href.replace(/^(.*?)\.md(#.*)?$/, (m, base, anchor) => `${base}.html${anchor || ''}`);
      }
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
      return `<a href="${escapeHtml(href)}"${title}>${inner}</a>`;
    },

    // Fenced code; gherkin/feature blocks get keyword highlighting, and an
    // untagged fence that reads as a scenario block (>= 2 keyword-led lines)
    // is highlighted the same way — other-language fences never are.
    code(token) {
      const lang = String(token.lang || '').trim().split(/\s+/)[0];
      let escaped = escapeHtml(token.text);
      if (lang === 'gherkin' || lang === 'feature' || (!lang && looksLikeGherkin(token.text))) {
        escaped = highlightGherkin(escaped);
      }
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      return `<pre><code${cls}>${escaped}\n</code></pre>\n`;
    },

    // Prose scenario steps (keyword-led <br>-separated lines) get the same
    // keyword colors; ordinary paragraphs pass through marked's default
    // shape, and paragraphs holding raw inline HTML are never rewritten.
    paragraph(token) {
      const inner = this.parser.parseInline(token.tokens);
      return `<p>${hasRawHtmlToken(token.tokens) ? inner : highlightProseSteps(inner)}</p>\n`;
    },

    // Task-list checkboxes -> styled spans (same look as the prototype; the
    // trailing space restores the gap marked v18 no longer inserts itself).
    checkbox(token) {
      return `<span class="cb${token.checked ? ' on' : ''}"></span> `;
    },

    // Single-column (degenerate) and body-less tables keep plain-table
    // rendering, wrapped for horizontal overflow. Every other table
    // (PROPOSAL-108) is emitted as both forms behind a card/table switch
    // that starts on tableView: the P-073 cards (cardsHtml, unchanged) and
    // the table view. A table with an author-written id or name in a cell
    // gets its starting form only.
    table(token) {
      const headerCells = token.header.map((cell) => this.parser.parseInline(cell.tokens));
      const rows = token.rows.map((row) => row.map((cell) => this.parser.parseInline(cell.tokens)));
      if (headerCells.length < 2 || rows.length === 0) {
        return plainTableHtml(headerCells, rows);
      }
      const cards = () => cardsHtml(headerCells, rows, () => `fldx-${toggleSeq++}`);
      const view = () => tableViewHtml(headerCells, rows, () => `tfx-${tableClampSeq++}`);
      // Both forms are built even when one is emitted, so the clamp ids of
      // every later table do not depend on the starting form.
      const cardForm = cards();
      const tableForm = view();
      if ([...headerCells, ...rows.flat()].some(hasAuthorId)) {
        if (tableView === 'cards') {
          return cardForm;
        }
        usage.tableView = true;
        return `<div class="tv-table${tableForm.wide ? ' wide' : ''}">${tableForm.html}</div>\n`;
      }
      usage.tableView = true;
      const id = `tvx-${viewSeq++}`;
      return '<div class="tv">' +
        `<input type="radio" class="tvr tvc" name="${id}" id="${id}-c"${tableView === 'cards' ? ' checked' : ''}>` +
        `<input type="radio" class="tvr tvt" name="${id}" id="${id}-t"${tableView === 'table' ? ' checked' : ''}>` +
        `<div class="tvs"><label class="tvl-c" for="${id}-c">卡片</label><label class="tvl-t" for="${id}-t">表格</label></div>` +
        `<div class="tv-cards">${cardForm}</div>` +
        `<div class="tv-table${tableForm.wide ? ' wide' : ''}">${tableForm.html}</div>` +
        '</div>\n';
    }
  };
}

// ----------------------------------------------------------- postprocessing

const CODE_MENTION = /<code>([^<>]+?\.md(?:#[^<>]*)?)<\/code>/g;

function splitOnce(text, sep) {
  const i = text.indexOf(sep);
  return i === -1 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

// Pure posix relpath (no cwd involvement, unlike path.posix.relative).
function posixRelative(fromDir, toPath) {
  const from = fromDir === '.' || fromDir === '' ? [] : fromDir.split('/');
  const to = toPath.split('/');
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) {
    common += 1;
  }
  const up = new Array(from.length - common).fill('..');
  return [...up, ...to.slice(common)].join('/') || '.';
}

// Link inline-code mentions of .md files to their rendered pages.
//
// Only mentions that resolve inside the rendered tree become links; anything
// else (external files, ambiguous bare names) is left untouched. Mentions
// inside <pre> blocks (directory trees, command examples) and existing <a>
// links are skipped. Accepted forms: tree-relative or `dflow/specs/`-prefixed
// paths, page-relative paths, and bare filenames (same directory first, then
// a unique match anywhere in the tree).
function autolinkCodeMentions(htmlText, relPosix, tree, basenames) {
  const dir = path.posix.dirname(relPosix);
  const curDir = dir === '.' ? '' : dir;

  function resolveMention(pathPart) {
    let p = unescapeHtml(pathPart);
    if (p.startsWith('./')) {
      p = p.slice(2);
    }
    const candidates = [];
    if (p.includes('/')) {
      for (const prefix of ['dflow/specs/', 'specs/']) {
        if (p.startsWith(prefix)) {
          candidates.push(p.slice(prefix.length));
        }
      }
      candidates.push(p);
      candidates.push(curDir ? path.posix.join(curDir, p) : p);
    } else {
      candidates.push(curDir ? path.posix.join(curDir, p) : p);
      const hits = basenames.get(p) || [];
      if (hits.length === 1) {
        candidates.push(hits[0]);
      }
    }
    for (const candidate of candidates) {
      const normalized = path.posix.normalize(candidate);
      if (tree.has(normalized)) {
        return normalized;
      }
    }
    return null;
  }

  const parts = htmlText.split(/(<pre>[\s\S]*?<\/pre>|<a\b[^>]*>[\s\S]*?<\/a>)/);
  return parts
    .map((part) => {
      if (part.startsWith('<pre') || part.startsWith('<a')) {
        return part;
      }
      return part.replace(CODE_MENTION, (mention, inner) => {
        const [mentionPath, anchor] = splitOnce(inner, '#');
        const target = resolveMention(mentionPath);
        if (target === null) {
          return mention;
        }
        let href = posixRelative(curDir || '.', `${target.slice(0, -'.md'.length)}.html`);
        if (anchor) {
          href += `#${anchor}`;
        }
        return `<a href="${escapeHtml(href)}">${mention}</a>`;
      });
    })
    .join('');
}

function metaCardHtml(meta, fallbackTitle) {
  const keys = Object.keys(meta);
  if (keys.length === 0) {
    return '';
  }
  const title = meta.title !== undefined ? meta.title : fallbackTitle;
  const status = meta.status || '';
  const pill = status
    ? `<span class="badge ${STATUS_PILL[status] || 'neutral'}">${escapeHtml(status)}</span>`
    : '';
  const rows = keys
    .filter((key) => key !== 'title' && key !== 'status' && meta[key])
    .map((key) => `<span><span class="k">${escapeHtml(key)}</span>${escapeHtml(meta[key])}</span>`)
    .join('');
  return (
    '<div class="meta-card">' +
    `<p class="meta-title">${escapeHtml(title)} ${pill}</p>` +
    `<div class="meta-grid">${rows}</div></div>`
  );
}

// ----------------------------------------------------------------- rendering

function pageHtml({ title, crumb, metaCard, body, footer, extraCss = '' }) {
  return `<!DOCTYPE html>
${GENERATED_MARK}
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}${extraCss}</style>
</head>
<body>
<main>
<p class="crumb">${crumb}</p>
${metaCard}
${body}
<p class="foot">${footer}</p>
</main>
</body>
</html>
`;
}

// ------------------------------------------------------------ table problems
// PROPOSAL-112 (B)(C): what stdout and the page say about each problem
// lib/table-checks.js finds — file names, line numbers and counts in fixed
// wording, never the text of a cell or a paragraph (G). A range of one line
// is written as that line.

function lineRange(from, to) {
  return from === to ? `第 ${from} 行` : `第 ${from}–${to} 行`;
}

function tableProblemMessage(problem) {
  if (problem.kind === 'extra') {
    return `表格第 ${problem.row} 列比表頭多 ${problem.extra} 格：多出來的格子裡的字不會顯示，這一列後面的欄可能錯位。` +
      '格子裡的 | 要寫成 \\|（反引號裡也一樣）；如果是表頭少了一欄，就在表頭與分隔列都補上那一欄。';
  }
  const a = problem.lines.from;
  return `表格在${lineRange(problem.gap.from, problem.gap.to)}斷開（中間有空行或註解）：` +
    `${lineRange(a, problem.lines.to)}沒有排進上面那張表，頁面上顯示成一段文字。` +
    '這幾行屬於上面那張表，就刪掉中間的空行、把註解移到表格上方或下方。' +
    `它們是另一張表時，先看第 ${a} 行是不是那張表的表頭：是的話，看下一行——` +
    '那是寫錯的分隔列，就把它改對（每一格只有 -，可加 :，格數跟表頭一樣）；' +
    `那是一列資料，就在第 ${a} 行後面插入一行分隔列，原本的列一列都不要改掉。` +
    `第 ${a} 行不是表頭的話，在它前面補上表頭與分隔列，兩列的格數一樣。`;
}

function tableNoticeHtml(text) {
  return `<p class="dflow-tbl-notice">${escapeHtml(text)}</p>\n`;
}

// One notice above the paragraph of each cut; one notice above a table for
// all of its rows with extra cells, naming each row as it reads on the page
// and its source line.
function tableNoticeBlocks(problems) {
  const blocks = [];
  const extraRows = new Map();
  for (const problem of problems) {
    if (problem.kind === 'cut') {
      blocks.push({
        before: problem.token,
        html: tableNoticeHtml(`下面這段沒有排進表格：上面那張表在原始檔${lineRange(problem.gap.from, problem.gap.to)}斷開` +
          `（中間有空行或註解），${lineRange(problem.lines.from, problem.lines.to)}顯示成一段文字。`)
      });
    } else {
      if (!extraRows.has(problem.table)) {
        extraRows.set(problem.table, []);
      }
      extraRows.get(problem.table).push(problem);
    }
  }
  for (const [table, rows] of extraRows) {
    const text = rows.length === 1
      ? `這張表的第 ${rows[0].row} 列（原始檔第 ${rows[0].line} 行）比表頭多出格子：多出來的格子裡的字沒有顯示，這一列後面的欄可能錯位。`
      : `這張表有 ${rows.length} 列比表頭多出格子：第 ${rows.map((p) => p.row).join('、')} 列` +
        `（原始檔第 ${rows.map((p) => p.line).join('、')} 行）。多出來的格子裡的字沒有顯示，這幾列後面的欄可能錯位。`;
    blocks.push({ before: table, html: tableNoticeHtml(text) });
  }
  return blocks;
}

// Appended only to pages that carry a table notice. A warning-coloured line
// on the left sets it apart from a diagram note: that one says a picture was
// not drawn, this one says the page's content is wrong. It prints as shown.
const TABLE_NOTICE_CSS = `
.dflow-tbl-notice {
  margin: 0.8rem 0; padding: 0.15rem 0 0.15rem 0.8rem;
  border-left: 3px solid var(--warn-fg); color: var(--ink); font-size: 14px;
}
`;

// One source file -> its page body (PROPOSAL-112 splits this out of
// renderFile so tests run the same path). The processAllTokens hook runs on
// every page, in this order, on the token list marked parsed:
//   1. the table checks read the list before anything is inserted into it;
//   2. on analysis.md the diagrams decide (PROPOSAL-100: each filled LC-/FL-
//      subsection gets a picture or a note before its first recognised
//      table), not drawing from a table with a problem, nor from any table
//      when the checks failed;
//   3. every block — pictures, notes, table notices — is inserted at once,
//      each placed before the token it belongs to, so the cards are built
//      exactly as on any page and no insertion moves another.
// checkTables: false skips the checks and hooks analysis.md only, as render
// did before PROPOSAL-112 (tests compare the two on pages with no problem).
function convertMarkdown({ MarkedCtor, source, fileName, tableView, checkTables = true }) {
  const { meta, body } = splitFrontmatter(source);
  const preprocessed = preprocess(trackedText(body, source.length - body.length));
  const usage = {};
  const diagramPage = fileName === 'analysis.md' ? diagrams.newPageState() : null;
  const page = { meta, usage, diagramPage, tableProblems: [], tableCheckFailed: null };
  const options = { gfm: true, renderer: buildRenderer(new Map(), tableView, usage) };
  if (checkTables || diagramPage) {
    options.hooks = {
      processAllTokens: (tokens) => {
        if (checkTables) {
          // Rendering still completes when the check itself throws: the page
          // gets no table notices, no picture is drawn from its unchecked
          // tables (each would-be picture gets a note), and stdout says the
          // check failed. Only the error's name is kept, never its message
          // (no spec text on stdout).
          try {
            page.tableProblems = tableChecks.checkTables(tokens, lineMapOf(source, preprocessed));
          } catch (error) {
            page.tableCheckFailed = (error && error.name) || 'Error';
          }
        }
        const checked = page.tableCheckFailed ? null : page.tableProblems;
        const blocks = diagramPage ? diagrams.diagramBlocks(tokens, diagramPage, checked) : [];
        return diagrams.insertBlocks(tokens, [...blocks, ...tableNoticeBlocks(page.tableProblems)]);
      }
    };
  }
  page.html = new MarkedCtor(options).parse(preprocessed.text);
  return page;
}

async function renderFile({ MarkedCtor, srcRoot, outRoot, relPosix, stamp, tree, basenames, diagramStats, tableStats, tableView }) {
  const relHtml = `${relPosix.slice(0, -'.md'.length)}.html`;
  const mdPath = path.join(srcRoot, ...relPosix.split('/'));
  const outPath = path.join(outRoot, ...relHtml.split('/'));
  const parts = relPosix.split('/');

  const { meta, usage, diagramPage, tableProblems, tableCheckFailed, html } = convertMarkdown({
    MarkedCtor, source: await readText(mdPath), fileName: parts[parts.length - 1], tableView
  });
  const bodyHtml = autolinkCodeMentions(html, relPosix, tree, basenames);
  for (const problem of tableProblems) {
    tableStats.push({ file: relPosix, line: problem.line, message: tableProblemMessage(problem) });
  }
  if (tableCheckFailed) {
    tableStats.push({ file: relPosix, line: null, message: `檢查這一頁的表格時發生內部錯誤（${tableCheckFailed}），這一頁沒有表格提醒；請回報這個錯誤` });
  }

  const hasDiagramBlock = diagramPage !== null && diagramPage.drawn + diagramPage.notDrawn > 0;
  if (hasDiagramBlock) {
    diagramStats.drawn += diagramPage.drawn;
    diagramStats.notDrawn += diagramPage.notDrawn;
    for (const note of diagramPage.notes) {
      diagramStats.notes.push({ file: relPosix, ...note });
    }
  }

  const stem = parts[parts.length - 1].slice(0, -'.md'.length);
  const indexHref = '../'.repeat(parts.length - 1) + 'index.html';
  const crumb = `<a href="${indexHref}">specs</a> / ` + parts.map(escapeHtml).join(' / ');
  const footer = `由 ${escapeHtml(relPosix)} 生成 · ${stamp} · 來源檔較新時請重新執行 dflow render`;

  await writeText(outPath, pageHtml({
    title: escapeHtml(meta.title !== undefined ? meta.title : stem),
    crumb,
    metaCard: metaCardHtml(meta, stem),
    body: bodyHtml,
    footer,
    extraCss: (usage.tableView ? TABLE_VIEW_CSS : '') + (hasDiagramBlock ? diagrams.DIAGRAM_CSS : '') +
      (tableProblems.length > 0 ? TABLE_NOTICE_CSS : '')
  }));
  return relHtml;
}

// PROPOSAL-079: features/completed/ is a monotonically growing archive, so
// the root index must not inline it. Entries under the prefix group by the
// year in their SPEC directory name; anything non-conforming lands in the
// 'other' bucket (still reachable, never dropped). Grouping is mechanical —
// directory names only, no frontmatter parsing. Returns null when the tree
// holds nothing under the prefix (then no pagination happens at all).
const COMPLETED_PREFIX = 'features/completed/';
const SPEC_YEAR_RE = /^SPEC-(\d{4})\d{4,}-/;

function completedIndexRel(key) {
  return `${COMPLETED_PREFIX}index-${key}.html`;
}

function completedKeyLabel(key) {
  return key === 'other' ? '未分年' : key;
}

// Sort keys: years newest-first, the 'other' bucket always last.
function completedKeyOrder(keys) {
  return [...keys].sort((a, b) => {
    if (a === 'other') return 1;
    if (b === 'other') return -1;
    return b.localeCompare(a);
  });
}

function groupCompletedByYear(relFiles) {
  const groups = new Map(); // key -> { files: [rel…], units: Set<top-level name> }
  for (const rel of relFiles) {
    if (!rel.startsWith(COMPLETED_PREFIX)) {
      continue;
    }
    const rest = rel.slice(COMPLETED_PREFIX.length);
    const top = rest.split('/')[0];
    const match = rest.includes('/') ? SPEC_YEAR_RE.exec(top) : null;
    const key = match ? match[1] : 'other';
    if (!groups.has(key)) {
      groups.set(key, { files: [], units: new Set() });
    }
    groups.get(key).files.push(rel);
    groups.get(key).units.add(top);
  }
  return groups.size ? groups : null;
}

// PROPOSAL-101: every href on the root index and the year pages goes
// through here. Inside a relative path only `%` (escape), `#` (fragment)
// and `?` (query) change what a browser resolves — `a#b.html` points at
// `a` — so those three are percent-encoded; everything else (CJK, spaces,
// `&`) stays literal, and a path holding none of the three comes out
// byte-identical. Callers still escapeHtml() the result for the attribute.
const HREF_ESCAPES = { '%': '%25', '#': '%23', '?': '%3F' };

function indexHref(relPath) {
  return relPath.replace(/[%#?]/g, (ch) => HREF_ESCAPES[ch]);
}

// Root-index year links for the completed/ stub line. Hrefs are root-
// relative; the surrounding <span> keeps them out of the `li > a` file-icon
// selector.
function completedYearLinksHtml(groups) {
  const links = completedKeyOrder(groups.keys()).map((key) => {
    const g = groups.get(key);
    return `<a href="${escapeHtml(indexHref(completedIndexRel(key)))}">${escapeHtml(completedKeyLabel(key))} (${g.units.size})</a>`;
  });
  return `<span class="years">${links.join(' · ')}</span>`;
}

// Nested <ul> file tree with links to the mirrored .html files.
// opts.stubs: [{ dirParts, html }] — pseudo-directory lines injected among
// a node's subdirectories (used for the completed/ year-links line; the
// node is created even when no other file implies it). opts.topDirsDesc:
// sort depth-0 directories newest-first (completed year pages).
function buildTreeHtml(relFiles, opts = {}) {
  const stubs = opts.stubs || [];
  const root = { dirs: new Map(), files: [], stubs: new Map() };
  const ensure = (node, part) => {
    if (!node.dirs.has(part)) {
      node.dirs.set(part, { dirs: new Map(), files: [], stubs: new Map() });
    }
    return node.dirs.get(part);
  };
  for (const rel of [...relFiles].sort()) {
    const parts = rel.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      node = ensure(node, part);
    }
    node.files.push(rel);
  }
  for (const stub of stubs) {
    let node = root;
    for (const part of stub.dirParts.slice(0, -1)) {
      node = ensure(node, part);
    }
    node.stubs.set(stub.dirParts[stub.dirParts.length - 1], stub.html);
  }

  function emit(node, depth) {
    let out = '<ul class="tree">';
    const names = [...new Set([...node.dirs.keys(), ...node.stubs.keys()])].sort();
    if (depth === 0 && opts.topDirsDesc) {
      names.reverse();
    }
    for (const name of names) {
      if (node.stubs.has(name)) {
        out += `<li><span class="dir">${escapeHtml(name)}/</span> ${node.stubs.get(name)}</li>`;
      } else {
        out += `<li><span class="dir">${escapeHtml(name)}/</span>${emit(node.dirs.get(name), depth + 1)}</li>`;
      }
    }
    for (const rel of node.files) {
      const href = indexHref(`${rel.slice(0, -'.md'.length)}.html`);
      const name = rel.split('/').pop();
      out += `<li><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></li>`;
    }
    return `${out}</ul>`;
  }

  return emit(root, 0);
}

// ---------------------------------------------------------- grouped index
// PROPOSAL-101: when --src is recognisably a Dflow specs root — it holds
// shared/_conventions.md, which dflow init always creates; presence only,
// the content is never read — the root index becomes a grouped directory:
// a header, jump links, and one native <details> per group, all closed on
// first open (an only group opens). Grouping, order, role labels and guide
// text come from paths alone, never from document content, and all live in
// the registry below. Any other --src keeps the pre-P101 file tree and year
// pages, changed only by indexHref(): a top-level directory that merely
// happens to be called `features` or `shared` is no evidence that Dflow's
// conventions hold there.
const SPECS_ROOT_MARKER = 'shared/_conventions.md';
const OVERVIEW_REL = 'shared/_overview.md';

// The groups, in page order. `dirs: null` collects root files and every
// top-level directory no other group claims. A guide line with a `when`
// test shows only when that test finds what the line talks about.
const hasFile = (target) => (rels) => rels.includes(target);
const hasMatch = (re) => (rels) => rels.some((rel) => re.test(rel));

const INDEX_GROUPS = [
  {
    id: 'features',
    name: 'Features',
    dirs: ['features'],
    purpose: '每一次變更的規格與紀錄：進行中、backlog 與已完成',
    guide: [
      { html: '一個目錄是一個 feature：<code>_index.md</code> 是它的總覽（目標、範圍、各階段規格與目前的業務規則快照），<code>phase-spec-*.md</code> 是一個階段的完整規格，<code>lightweight-*.md</code> 與 <code>BUG-*.md</code> 是小改動的規格。', when: hasMatch(/^features\/(active|completed)\/[^/]+\//) },
      { html: '<code>active/</code> 慣例上放還在進行的 feature。', when: hasMatch(/^features\/active\//) },
      { html: '<code>backlog/</code> 放先記下來的想法或筆記；放在這裡不代表已經排定或核准，要打開看內容才知道還適不適用。', when: hasMatch(/^features\/backlog\//) },
      { html: '<code>completed/</code> 是已完成 feature 的歷史紀錄，依年份分頁；現行的業務規則與已記錄的程式觀察以 Domain 那一組的文件為準。', when: hasMatch(/^features\/completed\//) }
    ]
  },
  {
    id: 'domain',
    name: 'Domain',
    dirs: ['domain'],
    purpose: '系統知識：各 context 的模型、規則、行為與分析',
    guide: [
      { html: '「跨 context」那一列是 <code>domain/</code> 直接底下的文件：<code>context-map.md</code> 看各 context 的分工與關係，<code>glossary.md</code> 看用語的定義，<code>analysis.md</code> 記跨 context 的流程、功能與角色的對照，以及不只屬於一個 context 的機制。', when: hasMatch(/^domain\/[^/]+$/) },
      { html: '其後每一列是 <code>domain/</code> 底下的一個目錄，慣例上一個目錄是一個 bounded context：<code>context-definition.md</code>（或 <code>context.md</code>）講它負責什麼、不負責什麼，<code>models.md</code> 列它的模型，<code>rules.md</code> 是業務規則與已記錄偏離的索引（BR-ID），<code>behavior.md</code> 用情境寫出規則，並在有已知偏離時另列程式觀察，<code>events.md</code> 列領域事件，<code>analysis.md</code> 記這個 context 自己的狀態怎麼流轉、數字怎麼算、機制怎麼運作。', when: hasMatch(/^domain\/[^/]+\//) }
    ]
  },
  {
    id: 'arch',
    name: '架構與遷移',
    dirs: ['architecture', 'migration'],
    purpose: '技術債、架構決策與遷移的紀錄',
    guide: [
      { html: '<code>tech-debt.md</code> 記開發途中發現、留待之後處理的技術債。', when: hasMatch(/^(architecture|migration)\/tech-debt\.md$/) },
      { html: '<code>migration/</code> 底下記的是往目標架構遷移的事。', when: hasMatch(/^migration\//) },
      { html: '<code>architecture/decisions/</code> 放架構決策紀錄（ADR），一份文件記一個決定。', when: hasMatch(/^architecture\/decisions\//) }
    ]
  },
  {
    id: 'shared',
    name: '共用文件',
    dirs: ['shared'],
    purpose: '專案層級的總覽、撰寫慣例與 AI 協作指引',
    guide: [
      { html: '<code>_overview.md</code> 是這個系統的總覽，第一次讀從它開始。', when: hasFile('shared/_overview.md') },
      { html: '<code>_conventions.md</code> 記這個專案寫規格的慣例。', when: hasFile('shared/_conventions.md') },
      { html: '<code>Git-principles-*.md</code> 記這個專案的 Git 分支與提交慣例。', when: hasMatch(/^shared\/Git-principles-[^/]*\.md$/) },
      { html: '<code>AI-AGENT-GUIDE.md</code> 是給 AI 助手的工作指引。', when: hasFile('shared/AI-AGENT-GUIDE.md') },
      { html: '<code>dflow-workflows/</code> 是 Dflow 放進來的流程文件與空白範本，由 Dflow 更新，不是這個專案自己寫的文件。', when: hasMatch(/^shared\/dflow-workflows\//) }
    ]
  },
  {
    id: 'other',
    name: '其他',
    dirs: null,
    purpose: '根目錄的文件與其他頂層目錄，照目錄層級列出',
    guide: null
  }
];

// Recognised filenames list first, in this order; every other file follows
// by name. Absent files leave no gap and no hint.
const DOMAIN_ROOT_ORDER = ['context-map.md', 'glossary.md', 'analysis.md'];
const CONTEXT_ORDER = [
  'context-definition.md', 'context.md', 'analysis.md', 'models.md', 'rules.md', 'behavior.md', 'events.md'
];

// Role labels by exact path shape (`*` = any one segment). A path matching
// no shape shows its filename alone — the index never guesses, so a
// template analysis.md under shared/ is never labelled as this project's.
const ROLE_LABELS = [
  { shape: ['domain', 'analysis.md'], label: '跨 context 分析' },
  { shape: ['domain', '*', 'analysis.md'], label: 'context 分析' },
  { shape: ['features', 'active', '*', '_index.md'], label: 'feature 總覽' }
];
// Same idea for a directory's disclosure summary.
const DIR_LABELS = [
  { shape: ['shared', 'dflow-workflows'], label: 'Dflow 放進來的流程文件與範本' }
];

const INDEX_CSS = `
.ix-head { color: var(--soft); font-size: 14px; margin: -0.4rem 0 0.7rem; }
.ix-jump { color: var(--faint); font-size: 14px; margin: 0 0 1.2rem; }
.ix-jump a { font-weight: 600; text-decoration: none; }
.ix-group {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 10px; margin: 0 0 0.7rem;
}
.ix-group > summary { cursor: pointer; padding: 0.6rem 1rem; line-height: 1.55; }
.ix-group[open] > summary { border-bottom: 1px solid var(--line); }
.ix-name { font-size: 17px; font-weight: 700; color: var(--head-strong); }
.ix-dirs { font-family: Consolas, monospace; font-size: 12.5px; color: var(--faint); margin-left: 0.25em; }
.ix-count { font-size: 12.5px; color: var(--soft); margin-left: 0.25em; white-space: nowrap; }
.ix-purpose { display: block; font-size: 13.5px; color: var(--soft); }
.ix-body { padding: 0.55rem 1rem 0.85rem; }
.ix-body, .ix-year { font-size: 13.5px; }
.ix-body a, .ix-head a, .ix-year a { font-family: Consolas, monospace; text-decoration: none; overflow-wrap: anywhere; }
.ix-body a:hover, .ix-head a:hover, .ix-year a:hover { text-decoration: underline; }
.ix-guide {
  background: var(--accent-soft); border: 1px solid var(--accent-line);
  border-radius: 8px; padding: 0.3rem 0.8rem; margin: 0 0 0.7rem;
}
.ix-guide > summary { cursor: pointer; color: var(--accent); font-weight: 600; }
.ix-guide ul { margin: 0.35rem 0 0.3rem; padding-left: 1.2rem; }
.ix-body h3 {
  font-family: Consolas, monospace; font-size: 13.5px; color: var(--soft);
  margin: 0.9rem 0 0.2rem;
}
.ix-list { list-style: none; padding-left: 0; margin: 0.15rem 0 0.3rem; line-height: 1.9; }
.ix-rows { border-top: 1px solid var(--line); margin: 0.3rem 0; }
.ix-row {
  display: grid; grid-template-columns: minmax(7rem, 15rem) 1fr; gap: 0.1rem 1rem;
  padding: 0.4rem 0; border-bottom: 1px solid var(--line);
}
.ix-rowname { font-weight: 600; overflow-wrap: anywhere; }
.ix-rowname.path { font-family: Consolas, monospace; }
.ix-docs { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.1rem 1.1rem; }
.ix-docs > details { flex-basis: 100%; }
.ix-docs.stack { display: block; }
.ix-docs.stack > .ix-list { margin: 0; line-height: 1.75; }
.ix-role {
  font-size: 11px; color: var(--soft); border: 1px solid var(--line);
  border-radius: 999px; padding: 0 0.45em; margin-left: 0.1em; white-space: nowrap;
}
.ix-sub { margin: 0.1rem 0; }
.ix-sub > summary { cursor: pointer; }
.ix-sub > :not(summary) { margin-left: 1.2rem; }
.ix-dname { font-family: Consolas, monospace; font-weight: 600; color: var(--soft); }
.ix-years a { font-weight: 600; }
.ix-note { font-size: 13.5px; color: var(--soft); margin: -0.4rem 0 1rem; }
.ix-year .ix-row { grid-template-columns: minmax(7rem, 20rem) 1fr; }
@media (max-width: 40rem) {
  .ix-row, .ix-year .ix-row { grid-template-columns: 1fr; }
}
`;

function matchesShape(parts, shape) {
  return shape.length === parts.length && shape.every((seg, i) => seg === '*' || seg === parts[i]);
}

function pathLabel(table, parts) {
  const hit = table.find(({ shape }) => matchesShape(parts, shape));
  return hit ? hit.label : null;
}

// A directory node: `path` is its slash-terminated tree path ('' = root).
function buildDirTree(relFiles) {
  const root = { path: '', dirs: new Map(), files: [] };
  for (const rel of relFiles) {
    const parts = rel.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.dirs.has(part)) {
        node.dirs.set(part, { path: `${node.path}${part}/`, dirs: new Map(), files: [] });
      }
      node = node.dirs.get(part);
    }
    node.files.push(rel);
  }
  return root;
}

function countDocs(node) {
  let n = node.files.length;
  for (const child of node.dirs.values()) {
    n += countDocs(child);
  }
  return n;
}

function sortedDirNames(node, skip = []) {
  return [...node.dirs.keys()].filter((name) => !skip.includes(name)).sort();
}

function orderedFiles(files, fixedOrder = []) {
  const base = (rel) => rel.split('/').pop();
  const fixed = fixedOrder.flatMap((name) => files.filter((rel) => base(rel) === name));
  const rest = files.filter((rel) => !fixedOrder.includes(base(rel))).sort();
  return [...fixed, ...rest];
}

// A feature directory's files: _index.md first, then every file whose name
// carries a date — Dflow names phase specs and lightweight specs
// `{kind}-YYYY-MM-DD-{slug}.md` on the day they are created, so date order
// is roughly phase order — by that date, then the rest (BUG-{NUMBER}-*,
// anything the project named itself) by name. Names only: file contents
// and filesystem times never decide the order.
const FILE_DATE_RE = /(?:^|[-_])(\d{4}-\d{2}-\d{2})(?=[-_.])/;

function featureFileOrder(files) {
  const base = (rel) => rel.split('/').pop();
  const dateOf = (rel) => {
    const match = FILE_DATE_RE.exec(base(rel));
    return match ? match[1] : null;
  };
  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const rest = files.filter((rel) => base(rel) !== '_index.md');
  return [
    ...files.filter((rel) => base(rel) === '_index.md'),
    ...rest.filter((rel) => dateOf(rel)).sort((a, b) => byName(dateOf(a), dateOf(b)) || byName(a, b)),
    ...rest.filter((rel) => !dateOf(rel)).sort()
  ];
}

// `base` is the directory the page itself sits in: hrefs are relative to
// it, while labels always read the full path.
function docLinkHtml(rel, base = '') {
  const href = indexHref(`${rel.slice(base.length, -'.md'.length)}.html`);
  const role = pathLabel(ROLE_LABELS, rel.split('/'));
  const roleHtml = role ? ` <span class="ix-role">${escapeHtml(role)}</span>` : '';
  return `<a href="${escapeHtml(href)}">${escapeHtml(rel.split('/').pop())}</a>${roleHtml}`;
}

function docListHtml(files, base = '') {
  return files.length ? `<ul class="ix-list">${files.map((rel) => `<li>${docLinkHtml(rel, base)}</li>`).join('')}</ul>` : '';
}

function docInlineHtml(files) {
  return files.map((rel) => `<span>${docLinkHtml(rel)}</span>`).join('');
}

// The generic listing every part without a layout of its own uses: files
// first by name, then each subdirectory as a named disclosure with its
// document count, recursively — every document keeps its own link.
function dirListingHtml(node, base = '') {
  return docListHtml(orderedFiles(node.files), base) +
    sortedDirNames(node).map((name) => subdirHtml(name, node.dirs.get(name), base)).join('');
}

function subdirHtml(name, node, base = '') {
  const label = pathLabel(DIR_LABELS, node.path.slice(0, -1).split('/'));
  return `<details class="ix-sub"><summary><span class="ix-dname">${escapeHtml(name)}/</span> ` +
    `<span class="ix-count">${countDocs(node)} 份</span>${label ? ` <span class="ix-role">${escapeHtml(label)}</span>` : ''}` +
    `</summary>${dirListingHtml(node, base)}</details>`;
}

// A row's documents sit side by side (`stacked` false: short conventional
// names, as in Domain) or one per line (feature rows: long names whose
// order matters).
function rowHtml(name, isPath, docsHtml, stacked = false) {
  return `<div class="ix-row"><div class="ix-rowname${isPath ? ' path' : ''}">${name}</div>` +
    `<div class="ix-docs${stacked ? ' stack' : ''}">${docsHtml}</div></div>`;
}

// (D) One feature directory as a row: its files one per line in
// featureFileOrder, deeper directories as disclosures after them.
function featureRowHtml(name, node, base = '') {
  return rowHtml(`${escapeHtml(name)}/`, true, docListHtml(featureFileOrder(node.files), base) +
    sortedDirNames(node).map((sub) => subdirHtml(sub, node.dirs.get(sub), base)).join(''), true);
}

// (B) One row for domain/'s own files, then one per subdirectory: its
// direct files inline, deeper directories as disclosures.
function domainBodyHtml(node) {
  const rows = [];
  if (node.files.length) {
    rows.push(rowHtml('跨 context', false, docInlineHtml(orderedFiles(node.files, DOMAIN_ROOT_ORDER))));
  }
  for (const name of sortedDirNames(node)) {
    const dir = node.dirs.get(name);
    const nested = sortedDirNames(dir).map((sub) => subdirHtml(sub, dir.dirs.get(sub))).join('');
    rows.push(rowHtml(`${escapeHtml(name)}/`, true, docInlineHtml(orderedFiles(dir.files, CONTEXT_ORDER)) + nested));
  }
  return rows.length ? `<div class="ix-rows">${rows.join('')}</div>` : '';
}

// (D) active/: one feature row per directory. backlog/ lists generically;
// completed/ keeps the PROPOSAL-079 year links (its year pages use the same
// feature rows, completedRowsHtml).
function featuresBodyHtml(node, completedGroups) {
  let out = docListHtml(orderedFiles(node.files));
  const active = node.dirs.get('active');
  if (active) {
    const rows = sortedDirNames(active).map((name) => featureRowHtml(name, active.dirs.get(name)));
    out += '<h3>active/</h3>' + docListHtml(orderedFiles(active.files)) +
      (rows.length ? `<div class="ix-rows">${rows.join('')}</div>` : '');
  }
  const backlog = node.dirs.get('backlog');
  if (backlog) {
    out += `<h3>backlog/</h3>${dirListingHtml(backlog)}`;
  }
  if (completedGroups) {
    out += `<h3>completed/</h3><p class="ix-years">${completedYearLinksHtml(completedGroups)}</p>`;
  }
  return out + sortedDirNames(node, ['active', 'backlog', 'completed'])
    .map((name) => subdirHtml(name, node.dirs.get(name))).join('');
}

// Everything without a layout of its own: root files first, then one small
// heading per top-level directory.
function topLevelBodyHtml(rootFiles, dirEntries) {
  return docListHtml(orderedFiles(rootFiles)) +
    dirEntries.map(([name, node]) => `<h3>${escapeHtml(name)}/</h3>${dirListingHtml(node)}`).join('');
}

// The grouped index's <h1>..groups body. Pure, and every listing sorts at
// output, so the same relFiles in any order give the same HTML.
function groupedIndexHtml({ relFiles, title, completedGroups }) {
  const tree = buildDirTree(relFiles);
  const claimed = INDEX_GROUPS.flatMap((group) => group.dirs || []);
  const groups = [];
  for (const group of INDEX_GROUPS) {
    const rootFiles = group.dirs === null ? tree.files : [];
    const dirEntries = (group.dirs || sortedDirNames(tree, claimed))
      .filter((name) => tree.dirs.has(name))
      .map((name) => [name, tree.dirs.get(name)]);
    const count = rootFiles.length + dirEntries.reduce((n, [, node]) => n + countDocs(node), 0);
    if (count === 0) {
      continue;
    }
    let body;
    if (group.id === 'features') {
      body = featuresBodyHtml(dirEntries[0][1], completedGroups);
    } else if (group.id === 'domain') {
      body = domainBodyHtml(dirEntries[0][1]);
    } else {
      body = topLevelBodyHtml(rootFiles, dirEntries);
    }
    const guideLines = (group.guide || []).filter((line) => !line.when || line.when(relFiles));
    const guide = guideLines.length
      ? `<details class="ix-guide"><summary>怎麼讀這些文件</summary><ul>${guideLines.map((line) => `<li>${line.html}</li>`).join('')}</ul></details>`
      : '';
    const dirs = [...(rootFiles.length ? ['根目錄'] : []), ...dirEntries.map(([name]) => `${escapeHtml(name)}/`)];
    groups.push({
      group,
      html: (open) => `<details class="ix-group" id="g-${group.id}"${open ? ' open' : ''}><summary>` +
        `<span class="ix-name">${escapeHtml(group.name)}</span> <span class="ix-dirs">${dirs.join(' · ')}</span> ` +
        `<span class="ix-count">${count} 份</span> <span class="ix-purpose">${escapeHtml(group.purpose)}</span>` +
        `</summary><div class="ix-body">${guide}${body}</div></details>`
    });
  }
  const start = relFiles.includes(OVERVIEW_REL)
    ? ` · 從這裡開始：<a href="${escapeHtml(indexHref(`${OVERVIEW_REL.slice(0, -'.md'.length)}.html`))}">${escapeHtml(OVERVIEW_REL)}</a>`
    : '';
  const jump = groups.length > 1
    ? `<p class="ix-jump">跳到：${groups.map(({ group }) => `<a href="#g-${group.id}">${escapeHtml(group.name)}</a>`).join(' · ')}</p>`
    : '';
  return `<h1>${escapeHtml(title)}</h1><p class="ix-head">共 ${relFiles.length} 份文件${start}</p>${jump}` +
    groups.map(({ html }) => html(groups.length === 1)).join('');
}

// (D) A year page on a recognised specs root: one feature row per
// directory, newest-first as the PROPOSAL-079 tree lists them, then the
// loose files. Hrefs stay relative to the year page.
function completedRowsHtml(files) {
  const node = buildDirTree(files).dirs.get('features').dirs.get('completed');
  const rows = sortedDirNames(node).reverse()
    .map((name) => featureRowHtml(name, node.dirs.get(name), COMPLETED_PREFIX));
  return '<div class="ix-year">' + (rows.length ? `<div class="ix-rows">${rows.join('')}</div>` : '') +
    docListHtml(orderedFiles(node.files), COMPLETED_PREFIX) + '</div>';
}

// Year-page orientation line (E): only on a recognised specs root.
const COMPLETED_NOTE =
  '這一頁是已完成 feature 的歷史紀錄，依目錄名 SPEC 編號裡的年份分頁，認不出年份的放在「未分年」；' +
  '現行的業務規則與已記錄的程式觀察以 <code>domain/</code> 底下的文件為準。';

async function renderIndex({ outRoot, relFiles, title, stamp, completedGroups, specsRoot }) {
  let body;
  if (specsRoot) {
    body = groupedIndexHtml({ relFiles, title, completedGroups });
  } else {
    let tree;
    if (completedGroups) {
      const mainFiles = relFiles.filter((rel) => !rel.startsWith(COMPLETED_PREFIX));
      tree = buildTreeHtml(mainFiles, {
        stubs: [{ dirParts: ['features', 'completed'], html: completedYearLinksHtml(completedGroups) }]
      });
    } else {
      tree = buildTreeHtml(relFiles);
    }
    body = `<h1>${escapeHtml(title)}</h1>${tree}`;
  }
  const footer = `共 ${relFiles.length} 份文件 · ${stamp} · 來源檔較新時請重新執行 dflow render`;
  await writeText(path.join(outRoot, 'index.html'), pageHtml({
    title: escapeHtml(title),
    crumb: 'specs /',
    metaCard: '',
    body,
    footer,
    extraCss: specsRoot ? INDEX_CSS : ''
  }));
  return 'index.html';
}

// PROPOSAL-079: one physical page per completed year (user requirement:
// real files, not visual collapsing — ten years of archive must not pile
// into one page). SPEC directories list newest-first inside the page.
async function renderCompletedIndex({ outRoot, key, groups, title, stamp, specsRoot }) {
  const relHtml = completedIndexRel(key);
  const group = groups.get(key);
  const stripped = group.files.map((rel) => rel.slice(COMPLETED_PREFIX.length));
  const label = completedKeyLabel(key);
  const nav = completedKeyOrder(groups.keys())
    .map((k) => (k === key
      ? `<strong>${escapeHtml(completedKeyLabel(k))}</strong>`
      : `<a href="${escapeHtml(indexHref(`index-${k}.html`))}">${escapeHtml(completedKeyLabel(k))}</a>`))
    .join(' · ');
  const body =
    `<h1>completed / ${escapeHtml(label)}</h1>` +
    `<p class="yearnav">${nav}</p>` +
    (specsRoot
      ? `<p class="ix-note">${COMPLETED_NOTE}</p>${completedRowsHtml(group.files)}`
      : buildTreeHtml(stripped, { topDirsDesc: true }));
  const crumb = '<a href="../../index.html">specs</a> / features / completed / ' + escapeHtml(label);
  const footer = `completed ${escapeHtml(label)} · 共 ${group.units.size} 項 · ${stamp} · 來源檔較新時請重新執行 dflow render`;
  await writeText(path.join(outRoot, ...relHtml.split('/')), pageHtml({
    title: escapeHtml(`${title} · completed ${label}`),
    crumb,
    metaCard: '',
    body,
    footer,
    extraCss: specsRoot ? INDEX_CSS : ''
  }));
  return relHtml;
}

// ----------------------------------------------------- output-dir ownership

// Validate a parsed-or-raw manifest. Returns { ok: true, files } or
// { ok: false, reason }. Anything that fails here means "refuse to run and
// delete nothing" — presence alone never grants ownership.
function parseManifest(rawText) {
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (error) {
    return { ok: false, reason: 'not valid JSON' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'not a JSON object' };
  }
  if (!('dflow-render' in data)) {
    return { ok: false, reason: 'missing "dflow-render" schema version field' };
  }
  if (data['dflow-render'] !== MANIFEST_VERSION) {
    return { ok: false, reason: `unsupported "dflow-render" schema version: ${JSON.stringify(data['dflow-render'])}` };
  }
  if (!Array.isArray(data.files)) {
    return { ok: false, reason: '"files" is not an array' };
  }
  for (const entry of data.files) {
    if (typeof entry !== 'string' || entry === '') {
      return { ok: false, reason: '"files" contains a non-string or empty entry' };
    }
    if (entry.includes('\\') || /^[A-Za-z]:/.test(entry) || entry.startsWith('/')) {
      return { ok: false, reason: `"files" entry is not a relative posix path: ${entry}` };
    }
    const segments = entry.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
      return { ok: false, reason: `"files" entry escapes the output directory: ${entry}` };
    }
  }
  return { ok: true, files: data.files };
}

// Stale = previous ledger minus this run's outputs. Comparison is
// case-insensitive: on case-insensitive filesystems (Windows, default macOS) a
// case-only rename would otherwise delete the freshly written file through its
// old-case name. On case-sensitive filesystems this can leave a stale
// odd-case file behind — accepted residual, never-misdelete beats never-leak.
// The manifest itself (and its tmp name) is never a deletion candidate.
function staleEntries(oldFiles, newFiles) {
  const current = new Set(newFiles.map((file) => file.toLowerCase()));
  return oldFiles.filter(
    (file) =>
      file !== MANIFEST_NAME &&
      file !== MANIFEST_TMP_NAME &&
      !current.has(file.toLowerCase())
  );
}

// Atomic manifest write (tmp + rename): a crash mid-write must never leave a
// torn manifest, or the next run would refuse the directory it owns.
async function writeManifest(outRoot, files) {
  const body = `${JSON.stringify({ 'dflow-render': MANIFEST_VERSION, files }, null, 2)}\n`;
  const tmpPath = path.join(outRoot, MANIFEST_TMP_NAME);
  await fs.writeFile(ioPath(tmpPath), body, 'utf8');
  await fs.rename(ioPath(tmpPath), ioPath(path.join(outRoot, MANIFEST_NAME)));
}

// Physical path for the overlap guard: resolve symlinks/junctions in the
// deepest EXISTING ancestor (--out may not exist yet), then re-append the
// not-yet-existing tail. Without this the guard is lexical only, and a
// junction --out physically inside --src would pass it (impl review R1 F1).
// Deliberately not ioPath()-wrapped: realpath must return the plain form the
// guard compares, and these are user-supplied roots, not deep tree paths.
async function realpathDeep(p) {
  let base = p;
  const tail = [];
  for (;;) {
    try {
      const real = await fs.realpath(base);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw error;
      }
      const parent = path.dirname(base);
      if (parent === base) {
        return p; // nothing on this root exists — fall back to the lexical path
      }
      tail.push(path.basename(base));
      base = parent;
    }
  }
}

// True when `parent` contains (or equals) `child`. path.relative handles
// case-insensitive drives on win32.
function pathContains(parent, child) {
  const rel = path.relative(parent, child);
  if (rel === '') {
    return true;
  }
  if (path.isAbsolute(rel)) {
    return false;
  }
  return rel.split(path.sep)[0] !== '..';
}

// Source→output projection collisions (cold-eye gate G3 F2): distinct
// sources can map to one output path (a.md vs A.md under the case-insensitive
// comparison the ledger already uses; a root index.md vs the generated file
// tree), and a source directory literally named *.html can need the same
// path a sibling source file produces. A root source directory named after
// the manifest (or its tmp name) needs that reserved path as a directory,
// which the ownership stamp and the end-of-run manifest write need as a file
// (the source-side door of cold-eye gate G5 F1). Undetected, the run dies on
// a raw EISDIR/ENOTDIR mid-write — after the ownership stamp — so this is
// checked before any output mutation. Returns null, or a human-readable
// description of the first collision found.
//
// reservedPages lists every generated (non-mirror) page THIS run will write
// — the root file tree plus any completed year indexes (PROPOSAL-079). Each
// is checked against mirror outputs AND against source directories needing
// the same path. Defaults to the root index alone so unit callers predate
// pagination unchanged.
function findProjectionCollision(relFiles, reservedPages = [{ out: 'index.html', what: 'the generated file tree' }]) {
  const toOut = (rel) => `${rel.slice(0, -'.md'.length)}.html`;
  for (const rel of relFiles) {
    // The ledger stores out-relative posix paths and parseManifest rejects
    // anything else. A source name a POSIX filesystem allows but the schema
    // cannot represent (a backslash inside a segment, a drive-letter-like
    // prefix) would be written into this run's own manifest and lock the
    // directory out at the next run's parse (cold-eye gate G7) — refuse
    // before mutating anything instead.
    if (rel.includes('\\') || /^[A-Za-z]:/.test(rel)) {
      return `source path ${rel} cannot be represented in the render manifest`;
    }
  }
  const byOut = new Map(reservedPages.map(({ out, what }) => [out.toLowerCase(), what]));
  for (const rel of relFiles) {
    const out = toOut(rel);
    const prior = byOut.get(out.toLowerCase());
    if (prior) {
      return `${rel} and ${prior} would both produce ${out}`;
    }
    byOut.set(out.toLowerCase(), rel);
  }
  const neededDirs = new Map();
  for (const rel of relFiles) {
    const parts = toOut(rel).split('/');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      if (!neededDirs.has(prefix.toLowerCase())) {
        neededDirs.set(prefix.toLowerCase(), { prefix, source: rel });
      }
    }
  }
  for (const { out } of reservedPages) {
    const hit = neededDirs.get(out.toLowerCase());
    if (hit) {
      return `${hit.source} needs ${hit.prefix}/ as a directory, but render generates ${out} there`;
    }
  }
  for (const reserved of [MANIFEST_NAME, MANIFEST_TMP_NAME]) {
    const hit = neededDirs.get(reserved);
    if (hit) {
      return `${hit.source} needs ${hit.prefix}/ as a directory, but render reserves that name for its ownership manifest`;
    }
  }
  for (const rel of relFiles) {
    const out = toOut(rel);
    const hit = neededDirs.get(out.toLowerCase());
    if (hit) {
      return `${rel} would produce ${out} as a file, but ${hit.source} needs ${hit.prefix}/ as a directory`;
    }
  }
  return null;
}

// The owned output tree must contain only what render itself could have
// created — real directories and regular files with a single name — before
// render touches it. Writes, stale unlinks, and prunes below outRoot all
// follow symlinks/junctions in the path (and fs.writeFile follows a link in
// the final component), so a link planted inside the owned tree would
// redirect them outside --out even though the root was realpath'd (cold-eye
// gate G1 F1). A hardlinked regular file is the same escape without a link
// dirent: it reports as an ordinary file, but the full-rebuild rewrite
// truncates the shared inode, changing the file's other name outside --out
// (cold-eye gate G2 F1). A real directory squatting on the reserved
// manifest-tmp name at the tree root is the one all-regular-entries shape
// render still cannot survive: it passes the type whitelist, but the
// end-of-run manifest write opens that exact path as a file and would die
// EISDIR only after outputs were written and stale files deleted (cold-eye
// gate G5 F1) — so it is refused here, before any mutation. render never
// creates any of these, nor special files, so all of them are foreign:
// report and refuse rather than write or delete through them. Dirents
// classify junctions as symlinks, and links are never recursed into, so a
// link cycle cannot hang the walk. Returns { rel, what } for the first
// unsafe entry (out-relative posix path + refusal phrase), or null for a
// tree that is safe to rebuild.
async function findUnsafeEntry(root) {
  async function walk(dir, relParts) {
    const entries = await fs.readdir(ioPath(dir), { withFileTypes: true });
    for (const entry of entries) {
      const rel = [...relParts, entry.name].join('/');
      if (entry.isSymbolicLink()) {
        return { rel, what: 'a symlink or junction' };
      }
      // Reserved-name comparison is case-insensitive like every ledger
      // comparison: on case-insensitive filesystems a case variant collides
      // with the same end-of-run write.
      if (relParts.length === 0 && entry.isDirectory() && entry.name.toLowerCase() === MANIFEST_TMP_NAME) {
        return { rel, what: 'a directory at the reserved manifest-tmp name' };
      }
      if (entry.isDirectory()) {
        const found = await walk(path.join(dir, entry.name), [...relParts, entry.name]);
        if (found) {
          return found;
        }
      } else if (entry.isFile()) {
        const stats = await fs.lstat(ioPath(path.join(dir, entry.name)));
        if (stats.nlink > 1) {
          return { rel, what: 'a regular file with multiple hard links' };
        }
      } else {
        return { rel, what: 'not a regular file or directory' };
      }
    }
    return null;
  }
  return walk(root, []);
}

// Mutation proof (cold-eye gate G3 F1): a valid manifest plus a link-free
// tree still does not prove any particular file is render's own work — the
// manifest is copyable and can list files render never wrote. Every existing
// regular file at a path this run will write (planned mirror outputs) or may
// delete (ledger entries) must carry GENERATED_MARK in its head, or the run
// refuses before mutating anything. The in-content marker survives an
// interrupted run whose deferred ledger rewrite never happened, so crash
// convergence stays possible while foreign or hand-replaced files fail
// closed. Directory/file mismatches at planned paths are refused here too —
// they would otherwise die as a raw EISDIR/ENOTDIR mid-write, after
// ownership state changed (the output-side sibling of G3 F2). Runs after
// findUnsafeEntry, so every path probed here is a real file or directory.
// Returns { rel, problem } for the first unproven target, or null.
async function findUnprovenTarget({ outRoot, plannedRels, listedRels }) {
  async function lstatRel(rel) {
    try {
      return await fs.lstat(ioPath(path.join(outRoot, ...rel.split('/'))));
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw error;
      }
      return null;
    }
  }
  async function bearsMark(rel) {
    const head = await readHead(path.join(outRoot, ...rel.split('/')), 4096);
    return head.includes(GENERATED_MARK);
  }

  const neededDirs = new Set();
  for (const rel of plannedRels) {
    const parts = rel.split('/');
    for (let i = 1; i < parts.length; i++) {
      neededDirs.add(parts.slice(0, i).join('/'));
    }
  }
  for (const rel of neededDirs) {
    const stats = await lstatRel(rel);
    if (stats && !stats.isDirectory()) {
      return { rel, problem: 'is a file, but this run needs it as a directory' };
    }
  }

  const proven = new Set();
  for (const rel of plannedRels) {
    const stats = await lstatRel(rel);
    if (stats === null) {
      continue;
    }
    if (stats.isDirectory()) {
      return { rel, problem: 'is a directory, but this run writes a file there' };
    }
    if (!(await bearsMark(rel))) {
      return { rel, problem: 'was not generated by dflow render' };
    }
    proven.add(rel.toLowerCase());
  }

  for (const rel of listedRels) {
    if (proven.has(rel.toLowerCase())) {
      continue;
    }
    const stats = await lstatRel(rel);
    if (stats === null) {
      continue;
    }
    if (stats.isDirectory()) {
      return { rel, problem: 'is listed in the manifest but is a directory' };
    }
    if (!(await bearsMark(rel))) {
      return { rel, problem: 'is listed in the manifest but was not generated by dflow render' };
    }
  }
  return null;
}

async function collectMdFiles(srcRoot) {
  const files = [];
  async function walk(dir, relParts) {
    const entries = await fs.readdir(ioPath(dir), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), [...relParts, entry.name]);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push([...relParts, entry.name].join('/'));
      }
    }
  }
  await walk(srcRoot, []);
  return files.sort();
}

// After stale deletion, prune directories that became empty (deepest first)
// — but only parents of files THIS run actually unlinked. Those directories
// held a marker-proven render output until a moment ago, so an empty
// leftover is render's own mirror structure. A stale ledger entry whose file
// was already gone proves nothing about the directory chain above it: the
// ledger lists files, not directories, and an empty directory there may be
// foreign (e.g. user-recreated at an old mirror path) — pruning on the
// ENOENT path would delete a directory render cannot prove it made
// (cold-eye gate G6 F1). fs.rmdir refuses non-empty directories, so this
// can never remove a directory that still holds anything.
async function pruneEmptyDirs(outRoot, unlinkedRels) {
  const dirs = new Set();
  for (const rel of unlinkedRels) {
    let dir = path.posix.dirname(rel);
    while (dir && dir !== '.') {
      dirs.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  const deepestFirst = [...dirs].sort((a, b) => b.split('/').length - a.split('/').length);
  for (const rel of deepestFirst) {
    try {
      await fs.rmdir(ioPath(path.join(outRoot, ...rel.split('/'))));
    } catch (error) {
      // Not empty or already gone — either way, leave it.
    }
  }
}

// ------------------------------------------------------------------ CLI face

function parseRenderArgs(args) {
  const options = { src: DEFAULT_SRC, out: DEFAULT_OUT, title: DEFAULT_TITLE, tableView: 'cards' };
  const valueFlags = { '--src': 'src', '--out': 'out', '--title': 'title', '--table-view': 'tableView' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (!Object.prototype.hasOwnProperty.call(valueFlags, name)) {
      throw new Error(`Unsupported render option: ${arg}`);
    }
    let value;
    if (eq !== -1) {
      value = arg.slice(eq + 1);
    } else {
      i += 1;
      value = i < args.length ? args[i] : '';
    }
    if (!value) {
      throw new Error(`Missing value for render option: ${name}`);
    }
    if (name === '--table-view' && !TABLE_VIEWS.has(value)) {
      throw new Error(`Invalid value for --table-view: ${value} (expected cards or table)`);
    }
    options[valueFlags[name]] = value;
  }
  return options;
}

async function runRender({ cwd, args = [], stdout, stderr }) {
  let options;
  try {
    options = parseRenderArgs(args);
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }

  let srcRoot = path.resolve(cwd, options.src);

  let srcStat = null;
  try {
    srcStat = await fs.stat(ioPath(srcRoot));
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
      throw error;
    }
  }
  if (!srcStat || !srcStat.isDirectory()) {
    stderr.write(`src not found: ${srcRoot}\n`);
    return 1;
  }

  // Physical paths from here on: both the overlap guard and every later write
  // / cleanup must see through symlinks and junctions, or a linked --out
  // pointing inside --src would bypass the guard (impl review R1 F1).
  srcRoot = await realpathDeep(srcRoot);
  const outRoot = await realpathDeep(path.resolve(cwd, options.out));

  // Overlap guard, both directions: --out inside --src would pollute the specs
  // tree (and get rescanned as source next run); --src inside --out would put
  // the source tree inside the directory render owns and cleans.
  if (pathContains(srcRoot, outRoot)) {
    stderr.write(`--out must not be inside --src (or equal to it): ${outRoot}\n`);
    return 1;
  }
  if (pathContains(outRoot, srcRoot)) {
    stderr.write(`--src must not be inside --out: ${srcRoot}\n`);
    return 1;
  }

  // Collect and sanity-check the source projection before touching --out at
  // all: a colliding projection must refuse cleanly here, not die on a raw
  // fs error mid-write after the ownership stamp (cold-eye gate G3 F2).
  const relMdFiles = await collectMdFiles(srcRoot);
  const completedGroups = groupCompletedByYear(relMdFiles);
  const reservedPages = [{ out: 'index.html', what: 'the generated file tree' }];
  if (completedGroups) {
    for (const key of completedKeyOrder(completedGroups.keys())) {
      reservedPages.push({
        out: completedIndexRel(key),
        what: `the generated completed index for ${completedKeyLabel(key)}`
      });
    }
  }
  const collision = findProjectionCollision(relMdFiles, reservedPages);
  if (collision) {
    stderr.write(
      `refusing to run: ${collision}; nothing was written.\n` +
      'Rename the colliding source files, or render a narrower --src.\n'
    );
    return 1;
  }

  // Output-directory ownership (crash-safe order):
  //   (0) first run (missing/empty --out): stamp ownership with a files:[]
  //       manifest BEFORE writing anything else;
  //   (1) render and write every output of this run;
  //   (2) delete stale files (previous manifest minus this run — only files
  //       the ledger listed, never anything else);
  //   (3) rewrite the full manifest last.
  // A crash at any point leaves a manifest in place (initial stamp or the
  // previous complete one), so the next run recognizes its own directory and
  // converges by re-rendering everything.
  let previousFiles = [];
  let outEntries = null;
  try {
    outEntries = await fs.readdir(ioPath(outRoot));
  } catch (error) {
    if (error.code === 'ENOTDIR') {
      stderr.write(`out is not a directory (a file is in the way): ${outRoot}\n`);
      return 1;
    }
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (outEntries === null) {
    try {
      await fs.mkdir(ioPath(outRoot), { recursive: true });
    } catch (error) {
      // Windows reports ENOENT (not POSIX's ENOTDIR) from the readdir above
      // when an ancestor of --out is a file, so that case first surfaces here
      // as mkdir ENOTDIR; EEXIST covers outRoot itself having become a file
      // since the readdir (impl review R2 F1).
      if (error.code !== 'ENOTDIR' && error.code !== 'EEXIST') {
        throw error;
      }
      stderr.write(`out is not a directory (a file is in the way): ${outRoot}\n`);
      return 1;
    }
    await writeManifest(outRoot, []);
  } else {
    // A leftover manifest tmp (crash residue of writeManifest's
    // write-tmp-then-rename) never counts toward "someone else's directory",
    // but the reserved NAME alone is no ownership proof (cold-eye gate G4
    // F1): in a directory with no manifest, the tmp must prove itself — a
    // single-name regular file whose content parses as a valid manifest — or
    // the run refuses without touching it. It is never deleted up front in
    // any branch; the end-of-run writeManifest overwrites the reserved name
    // in place, and the unsafe-entry scan below vets a leftover tmp in an
    // owned directory first — link / hardlink / special-file shapes and a
    // directory squatting on the reserved name (cold-eye gate G5 F1) are all
    // refused there before anything is written or deleted.
    const meaningful = outEntries.filter((name) => name !== MANIFEST_TMP_NAME);
    if (meaningful.length === 0) {
      if (outEntries.includes(MANIFEST_TMP_NAME)) {
        const tmpPath = path.join(outRoot, MANIFEST_TMP_NAME);
        let tmpStats = null;
        try {
          tmpStats = await fs.lstat(ioPath(tmpPath));
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
        // Size cap before reading: a genuine stamp residue is a small JSON
        // file; never slurp an arbitrarily large foreign file to disprove it.
        const provenOurs =
          tmpStats !== null &&
          tmpStats.isFile() &&
          tmpStats.nlink === 1 &&
          tmpStats.size <= 64 * 1024 * 1024 &&
          parseManifest(await readText(tmpPath)).ok;
        if (tmpStats !== null && !provenOurs) {
          stderr.write(
            `refusing to run: ${MANIFEST_TMP_NAME} in ${outRoot} cannot be proven to be dflow render's own crash residue; your files were not touched.\n` +
            'Remove it yourself, or pick a different --out.\n'
          );
          return 1;
        }
      }
      await writeManifest(outRoot, []);
    } else if (!meaningful.includes(MANIFEST_NAME)) {
      stderr.write(
        `refusing to write into non-empty directory without ${MANIFEST_NAME}: ${outRoot}\n` +
        'dflow render owns its output directory; pick a new or empty --out.\n'
      );
      return 1;
    } else {
      // lstat before reading: a directory (or link) squatting on the exact
      // manifest name would otherwise surface as a raw EISDIR from the read
      // — and a planted link would be read through before the tree scan
      // below could refuse it.
      const manifestStats = await fs.lstat(ioPath(path.join(outRoot, MANIFEST_NAME)));
      if (!manifestStats.isFile()) {
        stderr.write(
          `refusing to run: ${MANIFEST_NAME} in ${outRoot} is not a regular file; no files were deleted.\n` +
          'Remove the output directory yourself, or pick a different --out.\n'
        );
        return 1;
      }
      const parsed = parseManifest(await readText(path.join(outRoot, MANIFEST_NAME)));
      if (!parsed.ok) {
        stderr.write(
          `refusing to run: ${MANIFEST_NAME} in ${outRoot} is invalid (${parsed.reason}); no files were deleted.\n` +
          'Remove the output directory yourself, or pick a different --out.\n'
        );
        return 1;
      }
      previousFiles = parsed.files;
    }
  }

  // Ownership alone is not enough: every write and delete below outRoot
  // follows links in the path, and rewriting a hardlinked file writes its
  // shared inode — the accepted tree must hold nothing render could not have
  // created itself.
  const unsafe = await findUnsafeEntry(outRoot);
  if (unsafe) {
    stderr.write(
      `refusing to run: ${unsafe.rel} inside the output directory is ${unsafe.what}; your files were not touched.\n` +
      'dflow render only creates regular files and directories, and will not write or delete through anything else — remove it, or pick a different --out.\n'
    );
    return 1;
  }

  // Ownership (manifest) + entry types (scan) still do not prove a given
  // file is render's own work; the generated marker inside the file does.
  const plannedRels = [
    ...relMdFiles.map((rel) => `${rel.slice(0, -'.md'.length)}.html`),
    ...reservedPages.map(({ out }) => out)
  ];
  const unproven = await findUnprovenTarget({ outRoot, plannedRels, listedRels: previousFiles });
  if (unproven) {
    stderr.write(
      `refusing to run: ${unproven.rel} in the output directory ${unproven.problem}; your files were not touched.\n` +
      'Remove it (and any manifest entry naming it), or pick a different --out.\n'
    );
    return 1;
  }

  const tree = new Set(relMdFiles);
  const basenames = new Map();
  for (const rel of relMdFiles) {
    const name = rel.split('/').pop();
    if (!basenames.has(name)) {
      basenames.set(name, []);
    }
    basenames.get(name).push(rel);
  }

  // marked is ESM-only: dynamic import is the one loading path that works on
  // every Node >=22.0.0 from CommonJS. Do not convert this to a require() call.
  const { Marked } = await import('marked');

  const stamp = nowStamp();
  const written = [];
  const diagramStats = { drawn: 0, notDrawn: 0, notes: [] };
  const tableStats = [];
  for (const relPosix of relMdFiles) {
    written.push(await renderFile({ MarkedCtor: Marked, srcRoot, outRoot, relPosix, stamp, tree, basenames, diagramStats, tableStats, tableView: options.tableView }));
  }
  // PROPOSAL-101: the grouped index, its guide text and the year-page note
  // only on a recognised specs root.
  const specsRoot = tree.has(SPECS_ROOT_MARKER);
  if (completedGroups) {
    for (const key of completedKeyOrder(completedGroups.keys())) {
      written.push(await renderCompletedIndex({ outRoot, key, groups: completedGroups, title: options.title, stamp, specsRoot }));
    }
  }
  written.push(await renderIndex({ outRoot, relFiles: relMdFiles, title: options.title, stamp, completedGroups, specsRoot }));

  const stale = staleEntries(previousFiles, written);
  const unlinked = [];
  for (const rel of stale) {
    try {
      await fs.unlink(ioPath(path.join(outRoot, ...rel.split('/'))));
      unlinked.push(rel);
    } catch (error) {
      // ENOENT: already gone. ENOTDIR: the listed path's parent chain no
      // longer holds directories, so no file of ours can exist there.
      // Either way this run deleted nothing, so the entry earns no
      // empty-parent pruning below.
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        throw error;
      }
    }
  }
  await pruneEmptyDirs(outRoot, unlinked);

  await writeManifest(outRoot, written);

  stdout.write(`rendered ${relMdFiles.length} md files -> ${outRoot}\n`);
  // PROPOSAL-100: only when some LC-/FL- subsection got a picture or a note.
  // Each note also gets a line naming its file, entry and reason: the count
  // alone sends the reader to open every page to find which one and why.
  if (diagramStats.drawn + diagramStats.notDrawn > 0) {
    stdout.write(`diagrams: ${diagramStats.drawn} drawn, ${diagramStats.notDrawn} not drawn\n`);
    for (const note of diagramStats.notes) {
      stdout.write(`  not drawn: ${note.file} ${note.entryId} — ${note.reason}\n`);
    }
  }
  // PROPOSAL-112 (B): only when some table has a problem — one line each, in
  // the order the files were rendered and by line within a file. Rendering
  // still completed and the exit code stays 0.
  if (tableStats.length > 0) {
    stdout.write(`tables: ${tableStats.length} ${tableStats.length === 1 ? 'problem' : 'problems'}\n`);
    for (const problem of tableStats) {
      stdout.write(`  problem: ${problem.file}${problem.line === null ? '' : `:${problem.line}`} — ${problem.message}\n`);
    }
  }
  stdout.write(`open: ${path.join(outRoot, 'index.html')}\n`);
  return 0;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

module.exports = {
  runRender,
  // Exported for tests: the data-safety core (manifest schema refusals, the
  // never-delete-unlisted stale diff, the unsafe-entry output scan, the
  // marker-based mutation proof, projection-collision detection) and the
  // overlap guard are tested directly in addition to the end-to-end CLI tests.
  parseManifest,
  staleEntries,
  pathContains,
  findUnsafeEntry,
  findUnprovenTarget,
  findProjectionCollision,
  GENERATED_MARK,
  splitFrontmatter,
  headingSlug,
  // PROPOSAL-077 A1: exported so tests lock the documented thresholds.
  LONG_FIELD_CHARS,
  CLAMP_FIELD_CHARS,
  // PROPOSAL-108: the table view's thresholds, locked by tests like P-077's,
  // and the two helpers the tests feed directly.
  SHORT_COLUMN_WIDTH,
  TABLE_CLAMP_CHARS,
  WIDE_COLUMN_CAP,
  TABLE_CELL_PADDING,
  WIDE_TABLE_WIDTH,
  PRINT_MIN_SHARE,
  printShares,
  displayWidth,
  hasAuthorId,
  // PROPOSAL-079: exported for grouping-edge unit tests.
  groupCompletedByYear,
  // PROPOSAL-101: exported so tests can feed shuffled and non-Windows paths.
  groupedIndexHtml,
  // PROPOSAL-112: the page conversion render runs on every file, so tests and
  // the dev-side gate over the shipped Markdown check tables on the same path.
  convertMarkdown
};
