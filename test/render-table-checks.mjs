// PROPOSAL-112: tests for the table checks of `dflow render`
// (lib/table-checks.js, wired in by lib/render.js and lib/render-diagrams.js).
//
// Numbered as the proposal's § 測試與實作階段審查要的檢查: (1) cuts with the
// source file's line numbers on stdout and the page, (2) what is not a cut,
// (3) extra cells, (4) the cell count against marked's own, (5) the line map
// through frontmatter, the three preprocess edits and CRLF, (6) both problems
// on one table, (7) diagrams not drawn from a table with a problem, (8) the
// stdout block, (9) a page with no problem unchanged, (10) no cell text in any
// notice, (11) nested tables not checked, (12) the dev-side gate: the public
// and shipped Markdown has no problem, (13) --help and the docs pair, (14)
// notices outside the card/table switch and in print, (15) the fix the cut
// notice describes, (16) a table raw ending in a newline, (17) tabs and
// indentation, (18) cuts not reported, (19) diagram table selection unchanged,
// (20) a check that throws: render completes, nothing is drawn from the
// unchecked tables, and the gate of (12) fails.
//
// npm test runs this file (package.json's test script); run it on its own
// while iterating.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Lexer, Marked } from 'marked';

import render from '../lib/render.js';
import tableChecks from '../lib/table-checks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dflowBin = join(repoRoot, 'bin', 'dflow.js');
const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-tables-'));

function runRenderCli(cwd, args) {
  const result = spawnSync(process.execPath, [dflowBin, 'render', ...args], {
    cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024
  });
  if (result.error) {
    throw result.error;
  }
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function writeFixture(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

const md = (...lines) => lines.join('\n');
const convertRaw = (source, fileName = 'page.md', extra = {}) =>
  render.convertMarkdown({ MarkedCtor: Marked, source, fileName, tableView: 'cards', ...extra });
// A check that threw leaves no problems, so "nothing found" must not pass on
// it: convert fails instead. (12)'s gate and (20) read the failure themselves.
const convert = (source, fileName = 'page.md', extra = {}) => {
  const page = convertRaw(source, fileName, extra);
  assert.equal(page.tableCheckFailed, null, `the table check threw on ${fileName}`);
  return page;
};
// Each problem as one short line: what the checks found, with its lines.
const found = (source, fileName) => convert(source, fileName).tableProblems.map((p) => (p.kind === 'cut'
  ? `cut ${p.gap.from}-${p.gap.to} -> ${p.lines.from}-${p.lines.to}`
  : `extra row ${p.row} line ${p.line} +${p.extra}`));
const noticesOf = (html) => [...html.matchAll(/<p class="dflow-tbl-notice">([^<]*)<\/p>\n/g)].map((m) => m[1]);
const withoutNotices = (html) => html.replace(/<p class="dflow-tbl-notice">[^<]*<\/p>\n/g, '');
const unstamp = (html) => html.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g, 'STAMP');

// The wording of § 措辭, written out here so a changed string fails.
const range = (from, to) => (from === to ? `第 ${from} 行` : `第 ${from}–${to} 行`);
const cutMessage = (s, t, a, b) => `表格在${range(s, t)}斷開（中間有空行或註解）：${range(a, b)}沒有排進上面那張表，頁面上顯示成一段文字。` +
  '這幾行屬於上面那張表，就刪掉中間的空行、把註解移到表格上方或下方。' +
  `它們是另一張表時，先看第 ${a} 行是不是那張表的表頭：是的話，看下一行——那是寫錯的分隔列，就把它改對（每一格只有 -，可加 :，格數跟表頭一樣）；` +
  `那是一列資料，就在第 ${a} 行後面插入一行分隔列，原本的列一列都不要改掉。第 ${a} 行不是表頭的話，在它前面補上表頭與分隔列，兩列的格數一樣。`;
const extraMessage = (k, n) => `表格第 ${k} 列比表頭多 ${n} 格：多出來的格子裡的字不會顯示，這一列後面的欄可能錯位。` +
  '格子裡的 | 要寫成 \\|（反引號裡也一樣）；如果是表頭少了一欄，就在表頭與分隔列都補上那一欄。';
const cutNotice = (s, t, a, b) => `下面這段沒有排進表格：上面那張表在原始檔${range(s, t)}斷開（中間有空行或註解），${range(a, b)}顯示成一段文字。`;
const extraNotice = (k, line) => `這張表的第 ${k} 列（原始檔第 ${line} 行）比表頭多出格子：多出來的格子裡的字沒有顯示，這一列後面的欄可能錯位。`;
const extraNoticeRows = (rows, lines) => `這張表有 ${rows.length} 列比表頭多出格子：第 ${rows.join('、')} 列（原始檔第 ${lines.join('、')} 行）。` +
  '多出來的格子裡的字沒有顯示，這幾列後面的欄可能錯位。';

// A drawable lifecycle, the shape the diagram tests use.
const LC_OK = ['| State | Means |', '|---|---|', '| `A` | a |', '| `B` | b |', '', '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `B` |'];

try {
  // --- (1) a table cut short: stdout and the page, in the source's lines ---
  {
    const proj = join(tempRoot, 'cut');
    const debt = md(
      '---', 'title: Debt', '---', '# Debt', '', // 1-5
      '<!-- dflow:section debt -->', // 6
      '| ID | Item | Status |', '|---|---|---|', '| D-1 | a | open |', '', // 7-10
      '| D-2 | b | open |', '| D-3 | c | open |', '', // 11-13
      '| D-4 | d | open |', '', // 14-15
      '| D-5 | e | open |', '', 'After the table.', '' // 16-18
    );
    await writeFixture(join(proj, 'dflow/specs/debt.md'), debt);
    const run = runRenderCli(proj, []);
    assert.equal(run.code, 0, `render with cut tables exits 0\n${run.stderr}`);
    const lines = run.stdout.split('\n');
    const tablesAt = lines.indexOf('tables: 3 problems');
    assert.ok(tablesAt > 0, `a tables line counts the three cuts\n${run.stdout}`);
    assert.deepEqual(lines.slice(tablesAt + 1, tablesAt + 4), [
      `  problem: debt.md:10 — ${cutMessage(10, 10, 11, 12)}`,
      `  problem: debt.md:13 — ${cutMessage(13, 13, 14, 14)}`,
      `  problem: debt.md:15 — ${cutMessage(15, 15, 16, 16)}`
    ], 'one line per cut, with the line numbers of the source file (frontmatter and the section marker counted)');

    const page = await readFile(join(proj, 'dflow-specs-html/debt.html'), 'utf8');
    assert.deepEqual(noticesOf(page), [cutNotice(10, 10, 11, 12), cutNotice(13, 13, 14, 14), cutNotice(15, 15, 16, 16)]);
    for (const first of ['D-2', 'D-4', 'D-5']) {
      assert.match(page, new RegExp(`<p class="dflow-tbl-notice">[^<]*</p>\\n<p>\\| ${first} \\|`), `a notice right above the paragraph ${first} starts`);
    }
    assert.ok(page.includes('.dflow-tbl-notice {'), 'a page with a notice carries its CSS');
    const plain = convert(debt, 'debt.md', { checkTables: false }).html;
    assert.equal(withoutNotices(convert(debt, 'debt.md').html), plain, 'apart from the notices the page is what it was without the checks');

    // two blank lines in a row are one cut, reported as a range; a comment
    // line between rows cuts the table too
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '', '', '| 3 | 4 |')), ['cut 4-5 -> 6-6']);
    assert.equal(convert(md('| A | B |', '|---|---|', '| 1 | 2 |', '', '', '| 3 | 4 |')).tableProblems[0].line, 4, 'a cut is reported at its first line');
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '<!-- note -->', '| 3 | 4 |')), ['cut 4-4 -> 5-5']);
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '', '<!-- a -->', '<!-- b --> <!-- c -->', '', '| 3 | 4 |')), ['cut 4-7 -> 8-8'],
      'blank lines and comment-only lines together are one gap');
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '<!-- a --> text <!-- b -->', '', '| 3 | 4 |')), [],
      'a line with text between two comments is not a gap');
  }

  // --- (2) what is not a cut ---
  {
    const head = ['| A | B | C |', '|---|---|---|', '| 1 | 2 | 3 |', ''];
    for (const line of ['|amount| 不得超過上限', '|x| = |y|', '|x|', '| a | b |', '| a | b | c | d |']) {
      assert.deepEqual(found(md(...head, line)), [], `not a cut after a table: ${line}`);
      assert.deepEqual(found(md('# Alone', '', line)), [], `not reported as a paragraph of its own: ${line}`);
    }
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '', '|x| = |y|')), [],
      'an absolute value is not a row: no space beside its bars, whatever its cell count');
    // a cut-off row glued to the next line of text: reported, the range only
    // as far as the lines that start with |
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '', '| 3 | 4 |', '| 5 | 6 |', 'Evidence: code - x', '| 7 | 8 |')),
      ['cut 4-4 -> 5-6']);
    // a heading between: the next subsection's text is not this table's
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '', '### Next', '', '| 3 | 4 |')), []);
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '', 'Some text.', '', '| 3 | 4 |')), [],
      'only the paragraph right after the table is compared');
    // a table cut into pieces: each next piece compared with the same table
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '', '| 3 | 4 |', 'Evidence: x', '', '| 5 | 6 |', '', '| 7 | 8 | 9 |')),
      ['cut 4-4 -> 5-5', 'cut 7-7 -> 8-8']);
  }

  // --- (3) extra cells ---
  {
    const two = (row) => md('| A | B |', '|---|---|', row);
    for (const [row, note] of [
      ['| a | `x | y` |', 'a | inside backticks splits'],
      ['| a | [x | y](u.md) |', 'a | inside a link splits'],
      ['| a | <span title="x | y">z</span> |', 'a | inside HTML splits'],
      ['| a | b \\\\| c |', 'a | after two backslashes splits'],
      ['| | y | z |', 'one blank piece is dropped at each end: three cells'],
      ['a | b | c', 'a row without the outer bars, counted by the same rule']
    ]) {
      assert.deepEqual(found(two(row)), ['extra row 1 line 3 +1'], `reported: ${note}`);
    }
    for (const [row, note] of [
      ['| a | `x \\| y` |', '\\| is not a split'],
      ['| a | b &#124; c |', '&#124; is not a split'],
      ['| s | t | |', 'the extra cell is empty'],
      ['| s | t |  |   |', 'the extra cells are all empty'],
      ['| a |', 'one cell fewer'],
      ['a | b', 'no outer bars, as many cells']
    ]) {
      assert.deepEqual(found(two(row)), [], `not reported: ${note}`);
    }
    // fewer cells render exactly as the same cells written empty
    const three = (row) => md('| A | B | C |', '|---|---|---|', row);
    assert.deepEqual(found(three('| a |')), []);
    assert.deepEqual(found(three('| a | b |')), []);
    assert.equal(convert(three('| a |')).html, convert(three('| a |  |  |')).html, 'one cell short: the page is byte-identical to the cells written empty');
    assert.equal(convert(three('| a | b |')).html, convert(three('| a | b |  |')).html, 'two cells short: byte-identical too');

    // two rows of one table: two problems (two stdout lines), one notice
    const twice = md('# T', '', '| A | B |', '|---|---|', '| a | b | c |', '| d | e |', '| f | g | h | i |');
    assert.deepEqual(found(twice), ['extra row 1 line 5 +1', 'extra row 3 line 7 +2']);
    assert.deepEqual(noticesOf(convert(twice).html), [extraNoticeRows([1, 3], [5, 7])]);
    assert.deepEqual(noticesOf(convert(md('| A | B |', '|---|---|', '| a | b |', '| c | d | e |')).html), [extraNotice(2, 4)]);

    // the notice sits above any table: one column (plain table), an author id
    // (starting form only), and the card/table switch
    for (const [source, form] of [
      [md('| Only |', '|---|', '| a | b |'), '<div class="tblwrap"><table>'],
      [md('| Key | Value |', '|---|---|', '| <a id="k"></a>k | v | x |'), '<div class="cards">'],
      [md('| Key | Value |', '|---|---|', '| k | v | x |'), '<div class="tv">']
    ]) {
      const html = convert(source).html;
      assert.ok(html.startsWith(`<p class="dflow-tbl-notice">${extraNotice(1, 3)}</p>\n${form}`), `the notice is right above the table: ${form}`);
    }
  }

  // --- (4) the cell count is marked's own ---
  {
    // marked's splitCells counts a header line without truncating or
    // padding, and a table forms only when the delimiter row has as many
    // cells: the count marked gives a line is the delimiter width that makes
    // it a table header
    const markedCount = (line) => {
      for (let n = 1; n <= 12; n++) {
        const [token] = new Lexer({ gfm: true }).lex(`${line}\n|${'---|'.repeat(n)}`);
        if (token && token.type === 'table') {
          assert.equal(token.header.length, n);
          return n;
        }
      }
      return 0;
    };
    const samples = [
      '| a | `x | y` |', '| a | [x | y](u.md) |', '| a | <span title="x | y">z</span> |', '| a | `x \\| y` |',
      '| a | b \\\\| c |', '| a | b \\\\\\| c |', '| a | b &#124; c |', '| | y | z |', '| s | t | |', '| s | t |  |   |',
      '| a |', '| a | b |', 'a | b | c', 'a | b', '| a | b', 'a | b |', '|a|b|c|', '   | x | y |', '|\tx\t|\ty\t|',
      '| a | b |   ', '| \\| | b |', '| a || b |'
    ];
    for (const line of samples) {
      assert.equal(tableChecks.splitCells(line).length, markedCount(line), `cell count of ${JSON.stringify(line)} matches marked`);
    }
  }

  // --- (5) line numbers: frontmatter, the three preprocess edits, CRLF ---
  {
    const lines = [
      '---', 'title: Map', '---', '## Section', '<!-- Fill timing: phase 1 -->', '', // 1-6
      '| ID | Value | Note |', '|---|---|---|', // 7-8
      '| same | same | same | x |', '| same | same | same | x |', // 9-10: identical rows
      '| p <!-- phase-2 ADDED --> | v | n | extra |', // 11: a phase marker in the row
      '| j | k | l | m | <!-- dflow:section joined -->', '| tail |', // 12-13: joined into one row
      '', '<!-- dflow:section after -->', '', // 14-16: the marker takes the blank line after it along
      '| r | s | t |', '' // 17
    ];
    const expected = ['extra row 1 line 9 +1', 'extra row 2 line 10 +1', 'extra row 3 line 11 +1', 'extra row 4 line 12 +3', 'cut 14-16 -> 17-17'];
    assert.deepEqual(found(lines.join('\n')), expected, 'LF: every line is the source line');
    assert.deepEqual(found(lines.join('\r\n')), expected, 'CRLF: the same lines');
    assert.deepEqual(found(lines.join('\r')), expected, 'a lone CR: the same lines');
    // a section marker right under the last row takes the blank line after it
    // along: the page shows one table, so nothing is reported (limitation 6)
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 |', '<!-- dflow:section x -->', '', '| 3 | 4 |')), []);
    const joined = new Lexer({ gfm: true }).lex(md('| A | B |', '|---|---|', '| 1 | 2 |', '| 3 | 4 |'));
    assert.equal(joined[0].rows.length, 2, 'that is the table render draws');
    // a second definition of a link label is read and dropped by marked; the
    // lines after it are still right
    assert.deepEqual(found(md('[a]: x.md', '', '[a]: y.md', 'text', '', '| A | B |', '|---|---|', '| 1 | 2 | 3 |')), ['extra row 1 line 8 +1']);
  }

  // --- (6) one table, both problems: two notices ---
  {
    const both = md('| A | B |', '|---|---|', '| 1 | 2 | 3 |', '', '| 4 | 5 |');
    assert.deepEqual(found(both), ['extra row 1 line 3 +1', 'cut 4-4 -> 5-5']);
    const html = convert(both).html;
    assert.deepEqual(noticesOf(html), [extraNotice(1, 3), cutNotice(4, 4, 5, 5)]);
    assert.ok(html.startsWith('<p class="dflow-tbl-notice">'), 'one above the table');
    assert.match(html, /<p class="dflow-tbl-notice">[^<]*<\/p>\n<p>\| 4 \| 5 \|<\/p>/, 'one above the paragraph');
  }

  // --- (7) diagrams: a table the picture reads, with a problem, is not drawn ---
  {
    const diagramsOf = (source) => {
      const page = convert(source, 'analysis.md');
      return { ...page.diagramPage, notices: noticesOf(page.html), html: page.html };
    };
    const lcCut = diagramsOf(md('### LC-01: cut', '', '| State | Means |', '|---|---|', '| `A` | a |', '| `B` | b |', '| `C` | c |', '',
      '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `B` |', '', '| `B` | u | `C` |'));
    assert.deepEqual({ drawn: lcCut.drawn, notDrawn: lcCut.notDrawn }, { drawn: 0, notDrawn: 1 }, 'a transition table cut by a blank line is not drawn from');
    assert.deepEqual(lcCut.notes, [{ entryId: 'LC-01', reason: '轉移表在原始檔第 12 行斷開，後面的列沒有讀到' }]);
    assert.ok(lcCut.html.includes('<p class="dflow-dg-notice">LC-01 沒有畫成圖：轉移表在原始檔第 12 行斷開，後面的列沒有讀到。</p>'));
    assert.deepEqual(lcCut.notices, [cutNotice(12, 12, 13, 13)], 'the table notice is placed as well');

    const flGlued = diagramsOf(md('### FL-01: glued', '', '| # | From | To | Handed over |', '|---|---|---|---|', '| 1 | A | B | x |', '',
      '| 2 | B | C | y |', 'Evidence: code - z'));
    assert.deepEqual(flGlued.notes, [{ entryId: 'FL-01', reason: '流程表在原始檔第 6 行斷開，後面的列沒有讀到' }],
      'a flow row glued to an Evidence line is not drawn as a one-step flow');
    const flComment = diagramsOf(md('### FL-01: comment', '', '| # | From | To | Handed over |', '|---|---|---|---|', '| 1 | A | B | x |',
      '<!-- second step -->', '| 2 | B | C | y |'));
    assert.deepEqual(flComment.notes, [{ entryId: 'FL-01', reason: '流程表在原始檔第 6 行斷開，後面的列沒有讀到' }]);

    const lcExtra = diagramsOf(md('### LC-01: extra', '', '| State | Means |', '|---|---|', '| `A` | a | extra |', '| `B` | b |', '',
      '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `B` |'));
    assert.deepEqual(lcExtra.notes, [{ entryId: 'LC-01', reason: '狀態表第 1 列比表頭多出格子（原始檔第 5 行），欄位可能錯位' }],
      'extra cells holding text, even beside a column the picture does not read, stop the picture');
    assert.deepEqual(lcExtra.notices, [extraNotice(1, 5)]);
    const lcBlank = diagramsOf(md('### LC-01: blank extra', '', '| State | Means |', '|---|---|', '| `A` | a |  |', '| `B` | b |', '',
      '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `B` |'));
    assert.deepEqual({ drawn: lcBlank.drawn, notDrawn: lcBlank.notDrawn }, { drawn: 1, notDrawn: 0 }, 'extra cells that are all empty: drawn');

    const otherTable = diagramsOf(md('### LC-01: other', '', ...LC_OK, '', '| Note | Detail |', '|---|---|', '| n | d | lost |'));
    assert.deepEqual({ drawn: otherTable.drawn, notDrawn: otherTable.notDrawn }, { drawn: 1, notDrawn: 0 },
      'a table of the subsection the picture does not read: the picture is drawn');
    assert.deepEqual(otherTable.notices, [extraNotice(1, 14)], 'and that table gets its notice');

    const nextSection = diagramsOf(md('### LC-01: ok', '', ...LC_OK, '', '### LC-02: next', '', '| `B` | u | `C` |'));
    assert.deepEqual({ drawn: nextSection.drawn, notDrawn: nextSection.notDrawn, notices: nextSection.notices }, { drawn: 1, notDrawn: 0, notices: [] },
      'rows in the next subsection are not counted against the table');

    // a drawable lifecycle and a broken table elsewhere on the same page: the
    // picture before its first table, the notice before the broken table, and
    // neither insertion moves the other
    const mixed = diagramsOf(md('# Analysis', '', '| Term | Meaning |', '|---|---|', '| t | m | x |', '', '### LC-01: ok', '', ...LC_OK));
    assert.deepEqual({ drawn: mixed.drawn, notDrawn: mixed.notDrawn }, { drawn: 1, notDrawn: 0 });
    assert.deepEqual(mixed.notices, [extraNotice(1, 5)]);
    const notice = mixed.html.indexOf('dflow-tbl-notice');
    const term = mixed.html.indexOf('<div class="tv">');
    const heading = mixed.html.indexOf('<h3');
    const figure = mixed.html.indexOf('<figure class="dflow-dg');
    const stateTable = mixed.html.indexOf('<div class="tv">', figure);
    assert.ok(notice < term && term < heading && heading < figure && figure < stateTable,
      'notice, its table, the heading, the picture, the state table — in that order');

    // stdout names the subsection under the diagrams line as well
    const proj = join(tempRoot, 'diagrams');
    await writeFixture(join(proj, 'dflow/specs/analysis.md'), md('# A', '', '### FL-01: glued', '', '| # | From | To | Handed over |', '|---|---|---|---|',
      '| 1 | A | B | x |', '', '| 2 | B | C | y |', 'Evidence: code - z', ''));
    const run = runRenderCli(proj, []);
    assert.equal(run.code, 0);
    assert.ok(run.stdout.includes('diagrams: 0 drawn, 1 not drawn\n  not drawn: analysis.md FL-01 — 流程表在原始檔第 8 行斷開，後面的列沒有讀到\n'), run.stdout);
  }

  // --- (8) stdout: the tables block after diagrams and before open ---
  {
    const proj = join(tempRoot, 'stdout');
    await writeFixture(join(proj, 'dflow/specs/a.md'), md('# A', '', '| A | B |', '|---|---|', '| 1 | 2 | 3 |', '| 4 | 5 | 6 |', ''));
    await writeFixture(join(proj, 'dflow/specs/analysis.md'), md('# Analysis', '', '### LC-01: ok', '', ...LC_OK, ''));
    await writeFixture(join(proj, 'dflow/specs/b/c.md'), md('# C', '', '| A | B |', '|---|---|', '| 1 | 2 |', '', '| 3 | 4 |', ''));
    const run = runRenderCli(proj, []);
    assert.equal(run.code, 0, 'problems do not change the exit code');
    const lines = run.stdout.split('\n');
    assert.match(lines[0], /^rendered 3 md files -> \S/);
    assert.deepEqual(lines.slice(1, 7), [
      'diagrams: 1 drawn, 0 not drawn',
      'tables: 3 problems',
      `  problem: a.md:5 — ${extraMessage(1, 1)}`,
      `  problem: a.md:6 — ${extraMessage(2, 1)}`,
      `  problem: b/c.md:6 — ${cutMessage(6, 6, 7, 7)}`,
      lines[6]
    ], 'files in render order, lines in line order, one line per row');
    assert.match(lines[6], /^open: .*index\.html$/);
    assert.deepEqual(lines.slice(7), [''], 'open is the last line');

    const clean = join(tempRoot, 'stdout-clean');
    await writeFixture(join(clean, 'dflow/specs/a.md'), md('# A', '', '| A | B |', '|---|---|', '| 1 | 2 |', ''));
    const cleanRun = runRenderCli(clean, []);
    assert.equal(cleanRun.code, 0);
    assert.match(cleanRun.stdout, /^rendered 1 md files -> \S[^\n]*\nopen: [^\n]*index\.html\n$/, 'no problem: no tables line, the output as it was');
    const one = join(tempRoot, 'stdout-one');
    await writeFixture(join(one, 'dflow/specs/a.md'), md('| A | B |', '|---|---|', '| 1 | 2 | 3 |', ''));
    assert.ok(runRenderCli(one, []).stdout.includes('\ntables: 1 problem\n'), 'one problem');
  }

  // --- (9) a page with no problem renders as before ---
  {
    // the same page with the checks off is what render produced before
    // PROPOSAL-112 (analysis.md alone hooked); every shape that comes near a
    // check, and every shipped file in (12) below
    const near = md(
      '---', 'title: Near', 'status: draft', '---', '# Near', '', '<!-- dflow:section x -->', '',
      '## Rules <!-- Fill timing: phase 1 -->', '',
      '| ID | Rule | Status |', '|---|---|---|', '| R-1 | `a \\| b` <!-- phase-1 ADDED --> | draft |', '| R-2 | x |  |', '| R-3 | y | z |  |', '',
      '|amount| 不得超過上限', '', '|x| = |y|', '', '| a | b |', '', '<!-- note -->', '',
      '|a|b|c|', '', '- item', '', '  | K | V |', '  |---|---|', '  | k | v | x |', '', '  | k2 | v2 |', '',
      '> | P | Q |', '> |---|---|', '> | p | q | r |', '', 'Done.', ''
    );
    for (const [source, fileName] of [[near, 'near.md'], [near.replace(/\n/g, '\r\n'), 'near.md'], [md('# A', '', '### LC-01: ok', '', ...LC_OK, ''), 'analysis.md']]) {
      const checked = convert(source, fileName);
      assert.deepEqual(checked.tableProblems, [], `no problem in ${fileName}`);
      const plain = convert(source, fileName, { checkTables: false });
      assert.equal(checked.html, plain.html, `${fileName}: byte-identical to the page without the checks`);
      assert.deepEqual(checked.usage, plain.usage);
    }
    const proj = join(tempRoot, 'clean-page');
    await writeFixture(join(proj, 'dflow/specs/near.md'), near);
    assert.equal(runRenderCli(proj, []).code, 0);
    const page = await readFile(join(proj, 'dflow-specs-html/near.html'), 'utf8');
    assert.ok(!page.includes('dflow-tbl-notice'), 'no notice and no notice CSS on a page with no problem');
  }

  // --- (10) no cell or paragraph text in a notice or on stdout ---
  {
    const proj = join(tempRoot, 'no-content');
    await writeFixture(join(proj, 'dflow/specs/a.md'), md('# A', '', '| SECRET-H1 | SECRET-H2 |', '|---|---|',
      '| SECRET-1 | `SECRET-2 | SECRET-3` |', '', '| SECRET-4 | SECRET-5 |', 'SECRET-6', ''));
    const run = runRenderCli(proj, []);
    assert.ok(run.stdout.includes('tables: 2 problems'), run.stdout);
    assert.ok(!run.stdout.includes('SECRET'), 'stdout carries file names, numbers and fixed wording only');
    const page = await readFile(join(proj, 'dflow-specs-html/a.html'), 'utf8');
    const notices = noticesOf(page);
    assert.deepEqual(notices, [extraNotice(1, 5), cutNotice(6, 6, 7, 7)]);
    assert.ok(notices.every((n) => !n.includes('SECRET')));
  }

  // --- (11) tables in a list item or a block quote are not checked ---
  {
    const nested = md(
      '- item', '', '  | A | B |', '  |---|---|', '  | 1 | 2 | 3 |', '', '  | 4 | 5 |', '',
      '> | A | B |', '> |---|---|', '> | 1 | 2 | 3 |', '>', '> | 4 | 5 |', ''
    );
    const tokens = new Lexer({ gfm: true }).lex(nested);
    assert.equal(tokens.find((t) => t.type === 'list').items[0].tokens.filter((t) => t.type === 'table').length, 1, 'the list item holds a table');
    assert.equal(tokens.find((t) => t.type === 'blockquote').tokens.filter((t) => t.type === 'table').length, 1, 'the quote holds a table');
    assert.deepEqual(found(nested), [], 'neither the cut nor the extra cells inside them is reported (limitation 1)');
  }

  // --- (12) dev-side gate: the public and shipped Markdown has no problem ---
  // On the path render takes (convertMarkdown: frontmatter, preprocess, the
  // line map, the same checks). In the dev repo the files are the .md under
  // scripts/export-dist.sh's include set; in the dist repo, whose root holds
  // exactly that set, they are everything under the root but node_modules.
  {
    const exportScript = join(repoRoot, 'scripts', 'export-dist.sh');
    let roots;
    if (existsSync(exportScript)) {
      const set = /^include_paths=\(\r?\n([\s\S]*?)\r?\n\)/m.exec(await readFile(exportScript, 'utf8'));
      assert.ok(set, 'include_paths found in scripts/export-dist.sh');
      roots = set[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    } else {
      roots = (await readdir(repoRoot)).filter((name) => name !== 'node_modules' && (!name.startsWith('.') || name === '.github'));
    }
    const files = [];
    for (const root of roots) {
      const full = join(repoRoot, root);
      if (!existsSync(full)) {
        continue;
      }
      if ((await stat(full)).isDirectory()) {
        for (const entry of await readdir(full, { recursive: true, withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            files.push(relative(repoRoot, join(entry.parentPath, entry.name)).split(sep).join('/'));
          }
        }
      } else if (root.endsWith('.md')) {
        files.push(root);
      }
    }
    files.sort();
    for (const required of ['README.md', 'README.en.md', 'CHANGELOG.md', 'docs/render-table-checks.md', 'docs/render-table-checks.en.md']) {
      assert.ok(files.includes(required), `the gate reads ${required}`);
    }
    for (const dir of ['templates/', 'tutorial/', 'docs/']) {
      assert.ok(files.some((f) => f.startsWith(dir)), `the gate reads ${dir}`);
    }

    const gate = (entries) => {
      const problems = [];
      for (const { rel, source } of entries) {
        const page = convertRaw(source, rel.split('/').pop());
        if (page.tableCheckFailed) {
          problems.push(`${rel} — the table check threw ${page.tableCheckFailed}`);
        }
        for (const p of page.tableProblems) {
          problems.push(`${rel}:${p.line} — ${p.kind === 'cut' ? 'table cut short' : `row ${p.row} has ${p.extra} extra cell(s) holding text`}`);
        }
      }
      return problems;
    };
    const entries = await Promise.all(files.map(async (rel) => ({ rel, source: await readFile(join(repoRoot, rel), 'utf8') })));
    const problems = gate(entries);
    assert.deepEqual(problems, [], `the public and shipped Markdown has a broken table — fix each (see docs/render-table-checks.md):\n  ${problems.join('\n  ')}`);
    // (9) on every one of them: the page is the one render made before
    for (const { rel, source } of entries) {
      const fileName = rel.split('/').pop();
      assert.equal(convert(source, fileName).html, convert(source, fileName, { checkTables: false }).html, `${rel}: unchanged by the checks`);
    }

    // the tutorial row this proposal fixed, written back the old way: red,
    // naming the file and the line
    const walkthrough = 'tutorial/02-brownfield/walkthrough-07-baseline-minimal-host.md';
    const fixed = entries.find((e) => e.rel === walkthrough).source;
    assert.ok(fixed.includes('`implementation \\| committed`'), 'the tutorial row is written with \\|');
    const broken = fixed.replace('`implementation \\| committed`', '`implementation | committed`');
    const reverted = gate([{ rel: walkthrough, source: broken }]);
    assert.deepEqual(reverted, [`${walkthrough}:24 — row 3 has 1 extra cell(s) holding text`]);
    // (20) the same broken file with a check that throws: still red, naming
    // the file — a failed check is not "no problem"
    const original = tableChecks.checkTables;
    tableChecks.checkTables = () => { throw new TypeError('boom'); };
    try {
      assert.deepEqual(gate([{ rel: walkthrough, source: broken }]), [`${walkthrough} — the table check threw TypeError`]);
    } finally {
      tableChecks.checkTables = original;
    }
  }

  // --- (13) --help and the docs pair ---
  {
    const help = spawnSync(process.execPath, [dflowBin, 'render', '--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0);
    const tables = [
      'Tables: render checks each table at the top level of a page for two ways a',
      'Markdown table goes wrong without an error, and lists what it finds;',
      'rendering still completes and the exit code is unchanged.',
      '  cut short  a blank line or an HTML comment between rows ends the table,',
      '             and the rows after it show as a paragraph of text. Reported',
      '             when the paragraph right after a table (only blank lines or',
      '             comments between) starts with a line written like the table\'s',
      '             rows: a | followed by a space or tab (at most three spaces',
      '             before it), a space or tab before the last |, and as many',
      '             cells as the header.',
      '  extra      a row with more cells than the header, where the extra cells',
      '             hold text: that text is dropped, and the cells before it may',
      '             be in the wrong columns. The usual cause is a | inside a cell,',
      '             also inside backticks, not written as \\|. Cells are counted the',
      '             way the Markdown parser splits them. A row with fewer cells,',
      '             or with extra cells that are all empty, is not reported: the',
      '             page shows it the same as a row with those cells written empty.',
      'Each one gets a one-line notice on its page, above the table or the lines,',
      'and a line on stdout under a tables line with its file, its line in the',
      'source file and how to fix it. A lifecycle or flow whose table has either',
      'problem is not drawn. Not checked: a table inside a list item or a block',
      'quote, a table that never forms (a missing or malformed |---| row), rows cut',
      'off whose first line is not written like the table\'s rows (a diagram may',
      'then still be drawn from the rows before the cut), and the other cases',
      'listed at',
      'https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/render-table-checks.en.md',
      '',
      'Diagrams: '
    ].join('\n');
    assert.ok(help.stdout.includes(tables), 'render --help carries the Tables paragraph of § 措辭, right before Diagrams');

    // the pair says the same things: the same headings, the same bullets
    // under each, and the nine limitations numbered alike, each with its
    // three sub-items (why not prevented, who bears it, reconsider)
    const outline = (text) => text.split(/\r?\n/).map((line) => {
      const heading = /^(#{1,4}) /.exec(line);
      const numbered = /^(\d+)\. \*\*/.exec(line);
      const bullet = /^( *)- /.exec(line);
      return heading ? heading[1] : numbered ? `${numbered[1]}.` : bullet ? `${bullet[1]}-` : null;
    }).filter(Boolean);
    const zh = await readFile(join(repoRoot, 'docs/render-table-checks.md'), 'utf8');
    const en = await readFile(join(repoRoot, 'docs/render-table-checks.en.md'), 'utf8');
    assert.deepEqual(outline(zh), outline(en), 'the two docs pages have the same outline');
    assert.deepEqual(outline(en).filter((h) => /^\d/.test(h)), ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.'], 'the nine known limitations');
    const limitations = outline(en).slice(outline(en).indexOf('1.'));
    assert.equal(limitations.filter((h) => h === '   -').length, 27, 'each limitation has its three sub-items');
    assert.ok(zh.startsWith('# ') && zh.includes('[English](render-table-checks.en.md)'), 'the zh-TW page links to the English one');
    assert.ok(en.includes('[繁體中文](render-table-checks.md)'), 'the English page links to the zh-TW one');
    for (const [readme, page] of [['README.md', 'docs/render-table-checks.md'], ['README.en.md', 'docs/render-table-checks.en.md']]) {
      assert.ok((await readFile(join(repoRoot, readme), 'utf8')).includes(`](${page})`), `${readme} links to ${page}`);
    }
  }

  // --- (14) the notice is outside the card/table switch, and prints ---
  {
    const proj = join(tempRoot, 'views');
    await writeFixture(join(proj, 'dflow/specs/a.md'), md('# A', '', '| A | B |', '|---|---|', '| 1 | 2 | 3 |', ''));
    for (const view of ['cards', 'table']) {
      assert.equal(runRenderCli(proj, ['--out', `html-${view}`, '--table-view', view]).code, 0);
      const page = await readFile(join(proj, `html-${view}`, 'a.html'), 'utf8');
      assert.ok(page.includes(`<p class="dflow-tbl-notice">${extraNotice(1, 5)}</p>\n<div class="tv">`),
        `--table-view ${view}: the notice stands before the switch, so both forms show it`);
      const css = /<style>([\s\S]*?)<\/style>/.exec(page)[1];
      const printBlocks = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
      assert.ok(printBlocks.length > 0 && printBlocks.every((block) => !block.includes('dflow-tbl-notice')), 'no print rule hides the notice');
      assert.match(css, /\.dflow-tbl-notice \{[^}]*border-left: 3px solid var\(--warn-fg\);/, 'a warning-coloured line on its left');
    }
  }

  // --- (15) the fix the cut notice describes ---
  {
    const good = ['| A | B |', '|---|---|', '| 1 | 2 |', ''];
    // a second table with a malformed delimiter row
    const malformed = md(...good, '| C | D |', '|---|-x-|', '| u | v |');
    assert.deepEqual(found(malformed), ['cut 4-4 -> 5-7']);
    assert.ok(convert(malformed).tableProblems.length === 1);
    assert.ok(cutMessage(4, 4, 5, 7).includes('先看第 5 行是不是那張表的表頭'));
    const repaired = md(...good, '| C | D |', '|---|---|', '| u | v |');
    assert.deepEqual(found(repaired), [], 'with the delimiter row written right: two tables, no problem');
    // a second table missing its delimiter row
    const missing = md(...good, '| C | D |', '| u | v |');
    assert.deepEqual(found(missing), ['cut 4-4 -> 5-6']);
    const inserted = md(...good, '| C | D |', '|---|---|', '| u | v |');
    assert.deepEqual(found(inserted), [], 'with a delimiter row inserted after line 5: no problem');
    const tables = new Lexer({ gfm: true }).lex(inserted).filter((t) => t.type === 'table');
    assert.deepEqual(tables[1].rows.map((row) => row.map((cell) => cell.text)), [['u', 'v']], 'and the second table keeps its data row');
  }

  // --- (16) a table raw that ends in a newline adds no row ---
  {
    const tokens = new Lexer({ gfm: true }).lex(md('| A | B |', '|---|---|', '| 1 | 2 | 3 |', '<!-- note -->', '| 4 | 5 |'));
    assert.ok(tokens[0].raw.endsWith('\n'), 'the table raw ends in a newline when a comment follows it');
    assert.deepEqual(found(md('| A | B |', '|---|---|', '| 1 | 2 | 3 |', '<!-- note -->', '| 4 | 5 |')), ['extra row 1 line 3 +1', 'cut 4-4 -> 5-5'],
      'the last row is still the table\'s last line: the gap is the comment line');
  }

  // --- (17) tabs and indentation, as --help states them ---
  {
    const head = ['| A | B |', '|---|---|', '| 1 | 2 |', ''];
    for (const line of ['|\t3 | 4\t|', ' | 3 | 4 |', '   | 3 | 4 |', '   |\t3\t|\t4\t|', '| 3 | 4 |   ', '| 3 | 4 |\t']) {
      assert.deepEqual(found(md(...head, line)), ['cut 4-4 -> 5-5'], `reported: ${JSON.stringify(line)}`);
    }
    for (const line of ['    | 3 | 4 |', '|3 | 4 |', '| 3 | 4|', '| 3 | 4 \\|']) {
      assert.deepEqual(found(md(...head, line)), [], `not reported: ${JSON.stringify(line)}`);
    }
  }

  // --- (18) cuts that are not reported (limitation 2) ---
  {
    const head = ['| A | B |', '|---|---|', '| 1 | 2 |', ''];
    assert.deepEqual(found(md(...head, '|3|4|')), [], 'a compact row: no space beside its bars');
    assert.deepEqual(found(md(...head, '| 3 | 4 | 5 |', '| 6 | 7 |')), [], 'a first line with an extra cell');
    const page = convert(md('### LC-01: compact cut', '', '| State | Means |', '|---|---|', '| `A` | a |', '| `B` | b |', '| `C` | c |', '',
      '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `B` |', '', '|`B`|u|`C`|'), 'analysis.md');
    assert.deepEqual({ drawn: page.diagramPage.drawn, notDrawn: page.diagramPage.notDrawn, problems: page.tableProblems.length },
      { drawn: 1, notDrawn: 0, problems: 0 }, 'a diagram table cut that way is still drawn from the rows before the cut');
  }

  // --- (19) the diagram's table selection is unchanged ---
  {
    const notesOf = (source) => convert(source, 'analysis.md').diagramPage.notes.map((n) => n.reason);
    // a transition table with a State column is the transition table, not a
    // state table: its extra cells are named as the transition table's
    assert.deepEqual(notesOf(md('### LC-01: x', '', '| State | Means |', '|---|---|', '| `A` | a |', '| `B` | b |', '',
      '| From | Trigger | To | State |', '|---|---|---|---|', '| `A` | t | `B` | s | lost |')),
    ['轉移表第 1 列比表頭多出格子（原始檔第 10 行），欄位可能錯位']);
    // two state-table candidates: still not drawn for that reason first
    assert.deepEqual(notesOf(md('### LC-01: x', '', '| State |', '|---|', '| `A` | lost |', '', '| State |', '|---|', '| `B` |', '',
      '| From | Trigger | To |', '|---|---|---|', '| `A` | t | `B` |')),
    ['有 2 張狀態表，只能有一張']);
    // a row's extra cells do not change which table is which
    assert.deepEqual(notesOf(md('### FL-01: x', '', '| # | From | To | Handed over |', '|---|---|---|---|', '| 1 | A | B | x | Handed over |')),
      ['流程表第 1 列比表頭多出格子（原始檔第 5 行），欄位可能錯位']);
  }

  // --- (20) a check that throws does not fail the render, and draws nothing ---
  {
    // LC-01 drawable, FL-01 cut after its first step: checked, LC-01 is drawn
    // and FL-01 is not (the cut)
    const analysis = md('# A', '', '### LC-01: ok', '', ...LC_OK, '', '### FL-01: cut', '', '| # | From | To | Handed over |', '|---|---|---|---|',
      '| 1 | A | B | x |', '', '| 2 | B | C | y |', '');
    const checkedPage = convert(analysis, 'analysis.md').diagramPage;
    assert.deepEqual({ drawn: checkedPage.drawn, notDrawn: checkedPage.notDrawn }, { drawn: 1, notDrawn: 1 });
    const unchecked = '檢查這一頁的表格時發生內部錯誤，畫圖讀的表沒有檢查過';
    const failedLine = (file) => `  problem: ${file} — 檢查這一頁的表格時發生內部錯誤（TypeError），這一頁沒有表格提醒；請回報這個錯誤\n`;
    const runOn = async (name, files) => {
      const src = join(tempRoot, `${name}-src`);
      for (const [file, content] of Object.entries(files)) {
        await writeFixture(join(src, file), content);
      }
      let out = '';
      const code = await render.runRender({
        cwd: tempRoot, args: ['--src', src, '--out', join(tempRoot, `${name}-out`)],
        stdout: { write: (text) => { out += text; } }, stderr: { write: () => {} }
      });
      return { code, out };
    };
    const original = tableChecks.checkTables;
    tableChecks.checkTables = () => { throw new TypeError('boom SECRET'); };
    try {
      const page = convertRaw(md('| a | b |', '|---|---|', '| x | y |', '', '| p | q |'));
      assert.deepEqual(page.tableProblems, [], 'a throwing check leaves no problems');
      assert.equal(page.tableCheckFailed, 'TypeError', 'the failure is kept by the error name only');
      assert.equal(noticesOf(page.html).length, 0, 'a throwing check puts no notice on the page');
      const run = await runOn('throw', { 'page.md': md('| a | b |', '|---|---|', '| x | y |') });
      assert.equal(run.code, 0, 'render still completes when the check throws');
      assert.ok(run.out.includes(`\ntables: 1 problem\n${failedLine('page.md')}`), run.out);
      assert.doesNotMatch(run.out, /SECRET|boom/, 'the error message never reaches stdout');

      // analysis.md: no picture from tables nobody checked — not the cut one,
      // and not the sound one either; each would-be picture gets a note
      const diagramPage = convertRaw(analysis, 'analysis.md');
      assert.deepEqual(diagramPage.diagramPage.notes, [{ entryId: 'LC-01', reason: unchecked }, { entryId: 'FL-01', reason: unchecked }]);
      assert.deepEqual({ drawn: diagramPage.diagramPage.drawn, notDrawn: diagramPage.diagramPage.notDrawn }, { drawn: 0, notDrawn: 2 });
      assert.ok(!diagramPage.html.includes('<figure class="dflow-dg'), 'no picture on the page');
      assert.ok(diagramPage.html.includes(`<p class="dflow-dg-notice">FL-01 沒有畫成圖：${unchecked}。</p>`));
      assert.equal(noticesOf(diagramPage.html).length, 0, 'and no table notice');
      const diagramRun = await runOn('throw-analysis', { 'analysis.md': analysis });
      assert.equal(diagramRun.code, 0);
      assert.ok(diagramRun.out.includes(`\ndiagrams: 0 drawn, 2 not drawn\n  not drawn: analysis.md LC-01 — ${unchecked}\n` +
        `  not drawn: analysis.md FL-01 — ${unchecked}\ntables: 1 problem\n${failedLine('analysis.md')}`), diagramRun.out);
      assert.doesNotMatch(diagramRun.out, /SECRET|boom/);
    } finally {
      tableChecks.checkTables = original;
    }
  }

  console.log('PROPOSAL-112 render table-check tests passed');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
