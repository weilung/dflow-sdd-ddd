// Markdown table integrity checks (PROPOSAL-112).
//
// Two ways a GFM table goes wrong without an error, checked on the tables at
// the top level of one page (not inside a list item or a block quote):
//
//   cut    a blank line or an HTML comment between rows ends the table, and
//          the rows after it become a paragraph. Reported when the paragraph
//          right after a table (only blank lines or comments between) starts
//          with a line written like the table's rows: a | followed by a space
//          or tab (at most three spaces before it), a space or tab before the
//          last |, and as many cells as the header. The next paragraph after
//          that one is compared with the same table, so a table cut into
//          several pieces gets one problem per cut.
//   extra  a body row with more cells than the header, where the extra cells
//          hold text: marked drops them, so the page silently loses that text
//          and the cells before it may be in the wrong columns. A row with
//          fewer cells, or with extra cells that are all empty, renders the
//          same as one with those cells written empty, and is not reported.
//
// Input is the page's top-level token list — the same parse the page is drawn
// from, before anything is inserted into it — and a line map for the text that
// parse read: { text, lineOf(offset) }, lineOf giving the line in the source
// file. Output is a list of problems tied to the token objects themselves, in
// line order. No page state and no file system: render builds its notices and
// the diagrams' decisions from the list, and doctor can call it later with the
// same preprocessing and line map. Cell text is never part of a problem.

// A line that opens and closes like a table row: | then a space or tab, at
// most three spaces before it; a space or tab before the last |.
const ROW_START = /^ {0,3}\|[ \t]/;
const ROW_END = /[ \t]\|$/;
// An html token that is only comments: a comment between rows ends a table
// the same way a blank line does. A comment ends at its first -->.
const COMMENTS_ONLY = /^(?:\s*<!--(?:(?!-->)[\s\S])*-->)+\s*$/;
// A paragraph line that still reads as a cut-off row: it starts with |.
const PIPE_LED = /^[ \t]*\|/;

// The cells of one table line, counted the way marked 18.0.5's splitCells
// counts them when it is given no column count (it truncates and pads only
// when given one): every | after an even number of backslashes splits —
// inside backticks, links and HTML too; &#124; is text, not a split; one blank
// piece is dropped at each end, so `| | y | z |` is three cells. Returns the
// cells trimmed, with \| read as |, as marked returns them.
function splitCells(line) {
  const marked = String(line).replace(/\|/g, (pipe, offset, text) => {
    let escaped = false;
    for (let i = offset - 1; i >= 0 && text[i] === '\\'; i--) {
      escaped = !escaped;
    }
    return escaped ? '|' : ' |';
  });
  const cells = marked.split(/ \|/);
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells[cells.length - 1].trim()) {
    cells.pop();
  }
  return cells.map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function writtenLikeRow(line, headerCells) {
  const trimmed = line.replace(/[ \t]+$/, '');
  return ROW_START.test(trimmed) && ROW_END.test(trimmed) && splitCells(trimmed).length === headerCells;
}

function isGap(token) {
  return token.type === 'space' || (token.type === 'html' && COMMENTS_ONLY.test(String(token.raw)));
}

// Where each top-level token starts in the text marked read. The raws of the
// list add up to that text, except where marked drops a token outright (a
// second definition of a link label is read and left out, and the newline
// after it joins the token before): a raw not found where the last one ended
// is searched for further on — tables and paragraphs are always verbatim.
function tokenStarts(tokens, text) {
  const starts = new Map();
  let cursor = 0;
  for (const token of tokens) {
    const raw = String(token.raw ?? '');
    let at = text.startsWith(raw, cursor) ? cursor : -1;
    if (at === -1 && token.type !== 'space') {
      at = text.indexOf(raw, cursor);
    }
    if (at !== -1) {
      starts.set(token, at);
      cursor = at + raw.length;
    }
  }
  return starts;
}

// [offset, line] of each line of a token's raw, without the blank lines it
// may end with (a table's raw ends with a newline when a comment follows it).
function rawLines(token, start) {
  const lines = [];
  let offset = start;
  for (const line of String(token.raw).split('\n')) {
    lines.push([offset, line]);
    offset += line.length + 1;
  }
  while (lines.length > 0 && lines[lines.length - 1][1].trim() === '') {
    lines.pop();
  }
  return lines;
}

// The offset of the last character of a token's last non-blank line.
function lastCharOffset(lines) {
  const [offset, line] = lines[lines.length - 1];
  return offset + Math.max(line.length - 1, 0);
}

// Rows with more cells than the header, the extra cells holding text. A row
// is numbered from 1 among the body rows (not the header), as it reads on the
// page; its line is the source line it starts on.
function extraCells(table, lines, lineMap) {
  const header = table.header.length;
  const problems = [];
  lines.slice(2).forEach(([offset, line], i) => {
    const cells = splitCells(line);
    if (cells.length > header && cells.slice(header).some((cell) => cell !== '')) {
      problems.push({
        kind: 'extra', table, token: table, line: lineMap.lineOf(offset),
        row: i + 1, cells: cells.length, headerCells: header, extra: cells.length - header
      });
    }
  });
  return problems;
}

// Cuts after one table: the paragraph after it, and each next paragraph after
// that one, separated only by blank lines and comments and starting with a
// line written like the table's rows. A heading or any other block ends the
// search, so text in the next subsection is never counted against this table.
// gap: the source lines between the previous piece and the paragraph (blank
// lines, comments, and markers render drops before parsing); lines: the
// paragraph's leading lines that start with |.
function cuts(tokens, index, table, starts, lineMap) {
  const problems = [];
  const header = table.header.length;
  let prevEnd = lastCharOffset(rawLines(table, starts.get(table)));
  let i = index + 1;
  for (;;) {
    let gaps = 0;
    while (i < tokens.length && isGap(tokens[i])) {
      i += 1;
      gaps += 1;
    }
    const token = tokens[i];
    if (gaps === 0 || !token || token.type !== 'paragraph' || !starts.has(token)) {
      return problems;
    }
    const lines = rawLines(token, starts.get(token));
    if (lines.length === 0 || !writtenLikeRow(lines[0][1], header)) {
      return problems;
    }
    let led = 1;
    while (led < lines.length && PIPE_LED.test(lines[led][1])) {
      led += 1;
    }
    const s = lineMap.lineOf(prevEnd) + 1;
    const t = lineMap.lineOf(lines[0][0]) - 1;
    problems.push({
      kind: 'cut', table, token, line: s,
      gap: { from: s, to: Math.max(s, t) },
      lines: { from: lineMap.lineOf(lines[0][0]), to: lineMap.lineOf(lastCharOffset(lines.slice(0, led))) },
      headerCells: header
    });
    prevEnd = lastCharOffset(lines);
    i += 1;
  }
}

// The two checks on one page's top-level tokens. Each problem names its kind,
// the table it concerns (`table`), the token a notice goes above (`token`: the
// table, or the paragraph the cut-off rows became), its source line, and the
// row and cell counts or the line ranges.
function checkTables(tokens, lineMap) {
  if (!tokens.some((token) => token.type === 'table')) {
    return [];
  }
  const starts = tokenStarts(tokens, lineMap.text);
  const problems = [];
  tokens.forEach((token, index) => {
    if (token.type !== 'table' || !starts.has(token)) {
      return;
    }
    problems.push(...extraCells(token, rawLines(token, starts.get(token)), lineMap));
    problems.push(...cuts(tokens, index, token, starts, lineMap));
  });
  return problems.sort((a, b) => a.line - b.line);
}

module.exports = {
  checkTables,
  // Exported for tests: the cell count is compared with marked's own.
  splitCells
};
