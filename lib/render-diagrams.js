// Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE.
// dflow render — lifecycle and flow diagrams for analysis.md (PROPOSAL-100).
//
// The tables stay the record. This module only adds a picture above the
// cards of an `### LC-nn` / `### FL-nn` subsection of a file named
// analysis.md, or a one-line note saying why it drew none. Recognition reads
// marked's top-level token list — the same parse the cards come from —
// handed over by the processAllTokens hook renderFile() attaches; the picture
// is inline SVG built here, so pages keep no JavaScript and the package no
// new dependency. Anything the tables do not state for certain is not drawn
// (never half a picture), and no failure in here can fail the render:
// whatever throws while one subsection's tables are read, checked or drawn
// becomes that subsection's note and leaves the rest of the page untouched;
// should finding the subsections itself throw, the page renders as it would
// without this module.
//
// Layout (the p100lay-x1 layout specification): a lifecycle is one column of
// state boxes in the author's order — the transition to the next state
// runs straight down the middle, other forward transitions on the right,
// returns on the left, in lanes beside the boxes (transitions share a lane
// only when the states they span do not overlap) — with the transition
// texts in a separate numbered column on the right. `[*]` in From is a start
// point above the boxes and in To an end point below them (PROPOSAL-110),
// placed and routed by the same rules; a state no transition has is listed
// under the diagram instead of drawn. Rows with the same From and To share
// one line, numbered with every row it stands for, while each row keeps its
// own text in the column (PROPOSAL-116). A flow is a sequence
// diagram: participant columns in first-appearance order, one band per step.
// There are no font metrics in Node, so text width is estimated per
// character class and deliberately wide; the cards below always carry the
// full text. Layout is computed completely (and audited) before any SVG is
// emitted, and the size limits of the run are checked last, so a note can
// say what size would draw the diagram and whether size is all it lacks.
//
// PROPOSAL-112: a table the picture reads that has a row with extra cells
// holding text, or is cut short by a blank line or a comment, is not drawn
// from (that would be half a picture, or values in the wrong columns); the
// note names the table and the source line. The problems come from
// lib/table-checks.js, run on the same token list before anything is
// inserted, and every block is placed by the token it goes before.

const ENTRY_HEADING = /^(LC|FL)-(\d+)(?![\p{L}\p{N}_-])/u;

// The template's placeholder rows, exactly as the shipped analysis.md
// template writes them (both tracks ship the same file; test/render.mjs
// asserts each row below still equals the template's). A row is a
// placeholder only when every listed column holds exactly this raw cell
// text — never by "looks like a {…} placeholder" guessing. When the
// template's placeholder wording changes, keep the old row here as a second
// entry: copies adopters already wrote carry the wording of the template
// they were created from.
const TEMPLATE_PLACEHOLDER_ROWS = {
  flow: [{
    '#': '1',
    from: '{Context A}',
    to: '{Context B}',
    'handed over': '{交出去的是什麼：欄位、識別鍵或事件}',
    'state change': '{造成什麼狀態變化}',
    evidence: '{code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date})'
  }],
  states: [{
    state: '`{狀態值}`',
    means: '{這個狀態允許或擋住接下來的什麼}'
  }],
  transitions: [{
    from: '`{原狀態}`',
    trigger: '{誰做了什麼}',
    to: '`{新狀態}`',
    guard: '{決定它的 BR-ID；沒有規則決定就寫必須成立的條件，都沒有就留空}',
    evidence: '{code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date})'
  }]
};

// Limits. Over any of them a subsection gets a note instead of a picture.
// The three size limits are defaults: one render run may set its own
// (sizeLimits). LC_PRINT_MAX_* only decide what a printed page shows.
const DIAGRAM_LIMITS = Object.freeze({
  LC_MAX_STATES: 12,
  LC_MAX_TRANSITIONS: 20,
  LC_MAX_SIDE_LANES: 4,
  LC_MAX_SIDE_PORTS: 6,
  FL_MAX_PARTICIPANTS: 8,
  FL_PRINT_MAX_PARTICIPANTS: 4,
  FL_MAX_STEPS: 10,
  LC_MAX_WIDTH: 1024,
  LC_MAX_HEIGHT: 1600,
  FL_MAX_HEIGHT: 960,
  LC_PRINT_MAX_WIDTH: 864,
  LC_PRINT_MAX_HEIGHT: 960,
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
});

// The size limits one render run draws under: the defaults, or the
// --diagram-max-height / --diagram-max-width values given for the run (null:
// not given). A height given is the limit of both kinds; a width, of
// lifecycles only (a flow has no width limit). Passed down as a value, never
// kept between runs.
function sizeLimits({ height = null, width = null } = {}) {
  const L = DIAGRAM_LIMITS;
  return {
    lcWidth: width === null ? L.LC_MAX_WIDTH : width,
    lcHeight: height === null ? L.LC_MAX_HEIGHT : height,
    flHeight: height === null ? L.FL_MAX_HEIGHT : height
  };
}

// Layout measurements, in SVG user units (CSS pixels at natural size).
const GEOMETRY = Object.freeze({
  margin: 24,
  stateMinWidth: 160,
  stateTextPadding: 12,
  stateWrapWidth: 184,
  stateRadius: 6,
  stateMinHeight: 48,
  portPitch: 24,
  bandGap: 40,
  laneOffset: 48,
  lanePitch: 28,
  labelGap: 32,
  numberColumn: 28,
  descriptionWidth: 352,
  descriptionGap: 12,
  guardKeyWidth: 64,
  headerWidth: 144,
  headerHeight: 48,
  headerWrapWidth: 120,
  firstParticipantX: 96,
  participantPitch: 184,
  lifelineTop: 72,
  firstBandTop: 88,
  labelClearance: 12,
  selfLoopWidth: 48,
  selfLoopHeight: 24,
  stepSpacing: 20,
  selfLabelWidth: 160,
  maxLabelWidth: 352,
  identitySize: 14,
  identityLine: 20,
  primarySize: 14,
  primaryLine: 20,
  secondarySize: 13,
  secondaryLine: 18,
  smallSize: 12,
  tagWidth: 88,
  tagHeight: 16,
  tagRow: 20,
  tagInset: 6,
  headSize: 8,
  markerSize: 24,
  markerInset: 5
});

// Evidence types (the first word of an Evidence cell) whose arrow is dashed.
const DASHED_EVIDENCE = new Set(['inferred', 'assumed']);

// A From or To cell holding this marks the step that creates the entity
// (From) or removes it for good (To). It is never a state.
const MARKER = '[*]';

const TABLE_NAME = { states: '狀態表', transitions: '轉移表', flow: '流程表' };

// ------------------------------------------------------------ text helpers
// Self-contained on purpose: lib/render.js requires this module, so this
// module must not require it back.

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A numeric reference decodes only when it names a character (U+0001 to
// U+10FFFF, not a surrogate); any other stays as written — decoding it would
// throw or invent a character.
function numericReference(codePoint, written) {
  const isCharacter = codePoint >= 1 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff);
  return isCharacter ? String.fromCodePoint(codePoint) : written;
}

// Numeric references and the handful of named ones marked leaves in text;
// any other named reference stays literal (and is escaped on output). One
// pass, as the page decodes: text a reference decodes to is never decoded
// again (`&#38;#x5b;` shows `&#x5b;`, not `[`). A numeric reference longer
// than marked passes to the page (7 decimal or 6 hex digits) stays as
// written, as the page shows it.
const NAMED_DECODED = { lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', amp: '&' };
const DECODABLE_REFERENCE = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(lt|gt|quot|apos|nbsp|amp));/g;
// Every reference marked passes to the page for it to decode, as marked
// itself tells them apart; any other `&` it escapes, so the page shows it.
const PAGE_REFERENCE = /&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|\w+);/;
function decodeEntities(text) {
  return String(text).replace(DECODABLE_REFERENCE, (m, dec, hex, name) => (dec !== undefined
    ? numericReference(Number(dec), m)
    : hex !== undefined ? numericReference(parseInt(hex, 16), m) : NAMED_DECODED[name]));
}

const BR_TAG = /^<br\s*\/?>$/i;

// An inline token list as plain-text items, split at <br> — the template's
// in-cell item separator. Code span text counts as text; raw inline HTML
// other than <br> contributes nothing; entities in ordinary text are decoded
// (code span text is literal).
function inlineItems(tokens) {
  const items = [''];
  const walk = (list) => {
    for (const token of list || []) {
      if (token.type === 'html') {
        if (BR_TAG.test(String(token.text).trim())) {
          items.push('');
        }
      } else if (token.type === 'br') {
        items.push('');
      } else if (token.type === 'codespan') {
        items[items.length - 1] += token.text;
      } else if (token.tokens && token.tokens.length) {
        walk(token.tokens);
      } else {
        items[items.length - 1] += decodeEntities(token.text || '');
      }
    }
  };
  walk(tokens);
  return items.map((item) => item.replace(/\s+/g, ' ').trim()).filter((item) => item !== '');
}

function isBracePlaceholder(text) {
  return /^\{[\s\S]*\}$/.test(text);
}

// Bidi controls and right-to-left scripts: this layout does not arrange RTL text.
const RTL_RANGES = [[0x61c, 0x61c], [0x200e, 0x200f], [0x202a, 0x202e], [0x2066, 0x2069], [0x590, 0x8ff], [0xfb1d, 0xfdff], [0xfe70, 0xfeff]];

function hasRtl(text) {
  return [...text].some((ch) => RTL_RANGES.some(([lo, hi]) => ch.codePointAt(0) >= lo && ch.codePointAt(0) <= hi));
}

function codepoints(text) {
  return [...text].length;
}

function headerName(cell) {
  return inlineItems(cell.tokens).join(' ').toLowerCase();
}

// Whether an inline token list holds a Markdown link at any depth. Flattening
// a cell to plain text loses this: an unquoted `[*]` that a `[*]:` definition
// elsewhere in the document turns into a link reads as `*`.
function hasLink(tokens) {
  return (tokens || []).some((token) => token.type === 'link' || hasLink(token.tokens));
}

// The first piece of a cell whose shown text the page, not this module,
// decides: raw HTML other than <br> (it can hide text, or hold text the page
// decodes differently), an image, a character reference marked passes to
// the page, or text marked passes to it as written. Code span text is shown
// as written, so it is not searched;
// emphasis and links show their text. Null when the page shows exactly the
// text read here — in a cell with none of these, decodeEntities leaves the
// text as written.
function unreadWriting(tokens) {
  for (const token of tokens || []) {
    if (token.type === 'codespan') {
      continue;
    }
    if (token.type === 'html') {
      if (BR_TAG.test(String(token.text).trim())) {
        continue;
      }
      return { kind: 'html', written: String(token.text).trim() };
    }
    if (token.type === 'image') {
      return { kind: 'image', written: String(token.raw).trim() };
    }
    if (token.tokens && token.tokens.length) {
      const nested = unreadWriting(token.tokens);
      if (nested) {
        return nested;
      }
      continue;
    }
    // Text after a <pre>, <code>, <kbd> or <script> that an earlier cell, row
    // or line opened and has not closed: marked passes it to the page as
    // written, and the page reads it by HTML's rules, not marked's.
    if (token.escaped === true) {
      return { kind: 'raw' };
    }
    const reference = PAGE_REFERENCE.exec(String(token.text || ''));
    if (reference) {
      return { kind: 'reference', written: reference[0] };
    }
  }
  return null;
}

// ------------------------------------------------------------ recognition

// problems: what lib/table-checks.js found about this table (PROPOSAL-112).
function readTable(token, tokenIndex, problems) {
  const headers = token.header.map(headerName);
  const rows = token.rows.map((row) => row.map((cell) => ({
    raw: String(cell.text).trim(),
    items: inlineItems(cell.tokens),
    link: hasLink(cell.tokens),
    unread: unreadWriting(cell.tokens)
  })));
  return { token, tokenIndex, headers, rows, problems: problems.filter((p) => p.table === token) };
}

function hasColumns(table, names) {
  return names.every((name) => table.headers.includes(name));
}

function cellAt(table, rowIndex, name) {
  const i = table.headers.indexOf(name);
  return i === -1 ? null : table.rows[rowIndex][i] || { raw: '', items: [], link: false };
}

function isTemplateRow(table, rowIndex, role) {
  return TEMPLATE_PLACEHOLDER_ROWS[role].some((tpl) =>
    Object.entries(tpl).every(([name, text]) => {
      const cell = cellAt(table, rowIndex, name);
      return cell !== null && cell.raw === text;
    })
  );
}

// Top-level `### LC-nn` / `### FL-nn` subsections: the heading, and the
// index of every top-level table up to the next heading of depth 3 or less.
// Tables nested in lists or quotes are not part of the record's shape and
// are ignored. Only headings are read here; a subsection's tables are read
// with the rest of that subsection's work (readSubsection).
function locateEntrySubsections(tokens) {
  const located = [];
  let current = null;
  tokens.forEach((token, index) => {
    if (token.type === 'heading') {
      if (token.depth <= 3) {
        current = null;
      }
      if (token.depth === 3) {
        const match = ENTRY_HEADING.exec(inlineItems(token.tokens).join(' '));
        if (match) {
          current = { kind: match[1], entryId: `${match[1]}-${match[2]}`, tableIndexes: [] };
          located.push(current);
        }
      }
    } else if (token.type === 'table' && current) {
      current.tableIndexes.push(index);
    }
  });
  return located;
}

function readSubsection(tokens, { kind, entryId, tableIndexes }, problems) {
  return { kind, entryId, tables: tableIndexes.map((index) => readTable(tokens[index], index, problems)) };
}

function findEntrySubsections(tokens, problems = []) {
  return locateEntrySubsections(tokens).map((located) => readSubsection(tokens, located, problems));
}

// ------------------------------------------------------------ table checks
// Each check returns null when the tables pass, or the reason for the note.

function rowIssue(role, rowIndex, message) {
  return `${TABLE_NAME[role]}第 ${rowIndex + 1} 列${message}`;
}

// What a name drawn in the picture may not be: longer than the limit, or
// right-to-left text this layout cannot arrange. Null when it may be drawn.
function drawnNameIssue(value, label) {
  if (codepoints(value) > DIAGRAM_LIMITS.IDENTITY_MAX_CODEPOINTS) {
    return `的 ${label} 有 ${codepoints(value)} 個字元，上限 ${DIAGRAM_LIMITS.IDENTITY_MAX_CODEPOINTS}`;
  }
  if (hasRtl(value)) {
    return `的 ${label} 含有由右到左的文字，這個圖還不會排`;
  }
  return null;
}

// A key cell (a state, an endpoint, a participant) must hold exactly one
// value that is not a {…} placeholder. The whole cell is the value. A name
// that is always drawn is also checked for what drawing needs; a lifecycle
// leaves that to the states it draws, since a state no transition has is
// listed under the picture instead (lifecycleModel).
function keyValue(table, role, rowIndex, name, label, drawn = true) {
  const cell = cellAt(table, rowIndex, name);
  const items = cell ? cell.items : [];
  if (items.length === 0) {
    return { issue: rowIssue(role, rowIndex, `的 ${label} 是空的`) };
  }
  if (items.length > 1) {
    return { issue: rowIssue(role, rowIndex, `的 ${label} 有 ${items.length} 個值，圖上一格只能畫一個`) };
  }
  const value = items[0];
  if (isBracePlaceholder(value)) {
    return { issue: rowIssue(role, rowIndex, `的 ${label} 還是佔位文字（${value}）`) };
  }
  const issue = drawn ? drawnNameIssue(value, label) : null;
  return issue ? { issue: rowIssue(role, rowIndex, issue) } : { value, link: Boolean(cell && cell.link) };
}

// A lifecycle key cell (State, From, To) whose shown value the page decides
// (unreadWriting) is never read or guessed, whatever else the cell holds: the
// note asks for the value the way the template writes it, in backticks.
const UNREAD_WRITING = { html: ' HTML', image: '圖片', reference: '字元參照' };
function unreadIssue(table, role, rowIndex, name, label) {
  const cell = cellAt(table, rowIndex, name);
  const unread = cell ? cell.unread : null;
  if (!unread) {
    return null;
  }
  const where = unread.kind === 'raw'
    ? '在沒關上的 <pre>、<code>、<kbd> 或 <script> 後面'
    : `寫了${UNREAD_WRITING[unread.kind]} ${unread.written}`;
  const fix = unread.kind === 'raw' ? '請關上那個標籤，值照範本寫在反引號裡' : '請照範本把值寫在反引號裡';
  return { issue: rowIssue(role, rowIndex, `的 ${label} ${where}，判斷不了它顯示的是什麼；${fix}`) };
}

function textItems(table, rowIndex, name) {
  const cell = cellAt(table, rowIndex, name);
  return cell ? cell.items : [];
}

// A descriptive cell (Trigger, Guard, Handed over, State change): bounded in
// items and length; `required` ones must not be empty.
function fieldItems(table, role, rowIndex, name, label, required) {
  const items = textItems(table, rowIndex, name);
  if (required && items.length === 0) {
    return { issue: rowIssue(role, rowIndex, `的 ${label} 是空的`) };
  }
  if (items.length > DIAGRAM_LIMITS.FIELD_MAX_ITEMS) {
    return { issue: rowIssue(role, rowIndex, `的 ${label} 有 ${items.length} 個值，上限 ${DIAGRAM_LIMITS.FIELD_MAX_ITEMS}`) };
  }
  const length = items.reduce((sum, item) => sum + codepoints(item), 0);
  if (length > DIAGRAM_LIMITS.FIELD_MAX_CODEPOINTS) {
    return { issue: rowIssue(role, rowIndex, `的 ${label} 有 ${length} 個字元，上限 ${DIAGRAM_LIMITS.FIELD_MAX_CODEPOINTS}`) };
  }
  if (items.some((item) => hasRtl(item))) {
    return { issue: rowIssue(role, rowIndex, `的 ${label} 含有由右到左的文字，這個圖還不會排`) };
  }
  return { items };
}

// The Evidence type is the cell's leading word (`inferred - …`,
// `confirmed by …`); a cell that does not start with a Latin word has none.
function evidenceType(table, rowIndex) {
  const items = textItems(table, rowIndex, 'evidence');
  const word = items.length ? /^[a-z]+/i.exec(items[0]) : null;
  return word ? word[0].toLowerCase() : null;
}

// Placeholder rows, checked on a complete set of tables (a missing or doubled
// table is reported first, even beside an untouched template table): when
// every table holds only template rows the subsection is not content yet;
// a template row left beside real rows makes the table's shape uncertain.
function placeholderIssue(tables) {
  const templateOnly = tables.map(({ table, role }) =>
    table.rows.length > 0 && table.rows.every((row, r) => isTemplateRow(table, r, role))
  );
  if (templateOnly.every(Boolean)) {
    return { skip: true };
  }
  for (let t = 0; t < tables.length; t++) {
    const { table, role } = tables[t];
    if (templateOnly[t]) {
      return { issue: `${TABLE_NAME[role]}還只有範本的佔位列` };
    }
    const r = table.rows.findIndex((row, i) => isTemplateRow(table, i, role));
    if (r !== -1) {
      return { issue: rowIssue(role, r, '還是範本的佔位列') };
    }
  }
  return null;
}

function checkLimit(label, count, limit) {
  return count > limit ? `${label} ${count} 個，超過上限 ${limit}` : null;
}

// PROPOSAL-112 (D): the tables the picture reads, once each is known, are
// checked for what lib/table-checks.js found — in page order, so a table's
// own rows come before the cut after it, and an earlier table before a
// later one. A cut leaves rows unread; extra cells put values in the wrong
// columns, including a column the picture does not read.
function integrityIssue(tables) {
  const ordered = [...tables].sort((a, b) => a.table.tokenIndex - b.table.tokenIndex);
  for (const { table, role } of ordered) {
    const problems = table.problems || [];
    const extra = problems.find((p) => p.kind === 'extra');
    if (extra) {
      return { issue: `${TABLE_NAME[role]}第 ${extra.row} 列比表頭多出格子（原始檔第 ${extra.line} 行），欄位可能錯位` };
    }
    const cut = problems.find((p) => p.kind === 'cut');
    if (cut) {
      return { issue: `${TABLE_NAME[role]}在原始檔第 ${cut.line} 行斷開，後面的列沒有讀到` };
    }
  }
  return null;
}

// When the checks themselves failed on a page, none of its tables was
// checked, so no picture is drawn from them (see diagramBlocks).
const UNCHECKED_ISSUE = '檢查這一頁的表格時發生內部錯誤，畫圖讀的表沒有檢查過';

// ------------------------------------------------------------ models

function lifecycleModel(sub) {
  const transitionTables = sub.tables.filter((t) => hasColumns(t, ['from', 'trigger', 'to']));
  const stateTables = sub.tables.filter((t) => !transitionTables.includes(t) && hasColumns(t, ['state']));
  if (stateTables.length === 0 && transitionTables.length === 0) {
    return { issue: '找不到狀態表（要有 State 欄）與轉移表（要有 From、Trigger、To 欄）' };
  }
  if (stateTables.length === 0) {
    return { issue: '找不到狀態表（要有 State 欄）' };
  }
  if (transitionTables.length === 0) {
    return { issue: '找不到轉移表（要有 From、Trigger、To 欄）' };
  }
  if (stateTables.length > 1) {
    return { issue: `有 ${stateTables.length} 張狀態表，只能有一張` };
  }
  if (transitionTables.length > 1) {
    return { issue: `有 ${transitionTables.length} 張轉移表，只能有一張` };
  }
  const stateTable = stateTables[0];
  const transitionTable = transitionTables[0];
  const integrity = integrityIssue([
    { table: stateTable, role: 'states' },
    { table: transitionTable, role: 'transitions' }
  ]);
  if (integrity) {
    return integrity;
  }
  const placeholder = placeholderIssue([
    { table: stateTable, role: 'states' },
    { table: transitionTable, role: 'transitions' }
  ]);
  if (placeholder) {
    return placeholder;
  }

  // Every row of the state table is read and checked for what makes it a
  // value — shown as written, one per cell, not a placeholder, not `[*]`,
  // not repeated — whether or not the picture will draw it.
  const values = [];
  const firstRow = new Map();
  for (let r = 0; r < stateTable.rows.length; r++) {
    const unread = unreadIssue(stateTable, 'states', r, 'state', 'State');
    if (unread) {
      return unread;
    }
    const key = keyValue(stateTable, 'states', r, 'state', 'State', false);
    if (key.issue) {
      return key;
    }
    if (key.value === MARKER) {
      return { issue: rowIssue('states', r, `寫了 ${MARKER}；新建、刪除寫在 From、To，真的存了 ${MARKER} 這個字的值在 State 另取一個名字`) };
    }
    if (firstRow.has(key.value)) {
      return { issue: rowIssue('states', r, `的狀態 ${key.value} 重複（第 ${firstRow.get(key.value) + 1} 列已有）`) };
    }
    firstRow.set(key.value, r);
    values.push(key.value);
  }
  if (values.length === 0) {
    return { issue: '狀態表沒有任何一列' };
  }
  if (transitionTable.rows.length === 0) {
    return { issue: '轉移表沒有任何一列' };
  }

  const transitions = [];
  for (let r = 0; r < transitionTable.rows.length; r++) {
    const ends = {};
    for (const [name, label, step] of [['from', 'From', '新建'], ['to', 'To', '刪除']]) {
      const unread = unreadIssue(transitionTable, 'transitions', r, name, label);
      if (unread) {
        return unread;
      }
      const key = keyValue(transitionTable, 'transitions', r, name, label, false);
      if (key.issue) {
        return key;
      }
      // A link that shows `*` or `[*]` may be an unquoted `[*]` that a `[*]:`
      // definition turned into a link, or a value `*`; neither guess is safe.
      if (key.link && (key.value === '*' || key.value === MARKER)) {
        return { issue: rowIssue('transitions', r, `的 ${label} 是一個連結，判斷不了是${step}（寫成 ${MARKER} 加反引號）還是 * 這個值（寫成 * 加反引號）`) };
      }
      if (key.value !== MARKER && !firstRow.has(key.value)) {
        return { issue: rowIssue('transitions', r, `的 ${label}（${key.value}）不在狀態表裡`) };
      }
      ends[name] = key.value;
    }
    if (ends.from === MARKER && ends.to === MARKER) {
      return { issue: rowIssue('transitions', r, `的 From 與 To 都是 ${MARKER}`) };
    }
    const trigger = fieldItems(transitionTable, 'transitions', r, 'trigger', 'Trigger', true);
    if (trigger.issue) {
      return trigger;
    }
    const guard = fieldItems(transitionTable, 'transitions', r, 'guard', 'Guard', false);
    if (guard.issue) {
      return guard;
    }
    transitions.push({
      n: r + 1,
      from: ends.from,
      to: ends.to,
      trigger: trigger.items,
      guard: guard.items,
      evidenceType: evidenceType(transitionTable, r)
    });
  }

  // Drawn: the values some row has in From or To. The rest are listed under
  // the picture, so only the drawn ones count toward the limit and need what
  // drawing a name needs.
  const used = new Set(transitions.flatMap((t) => [t.from, t.to]));
  const states = values.filter((value) => used.has(value));
  const unlisted = values.filter((value) => !used.has(value));
  for (const state of states) {
    const issue = drawnNameIssue(state, 'State');
    if (issue) {
      return { issue: rowIssue('states', firstRow.get(state), issue) };
    }
  }
  const limit =
    checkLimit('狀態', states.length, DIAGRAM_LIMITS.LC_MAX_STATES) ||
    checkLimit('轉移', transitions.length, DIAGRAM_LIMITS.LC_MAX_TRANSITIONS);
  if (limit) {
    return { issue: limit };
  }
  const firstTable = Math.min(stateTable.tokenIndex, transitionTable.tokenIndex);
  return { model: { kind: 'LC', entryId: sub.entryId, states, transitions, unlisted }, insertAt: firstTable };
}

function flowModel(sub) {
  const flowTables = sub.tables.filter((t) => hasColumns(t, ['from', 'to', 'handed over']));
  if (flowTables.length === 0) {
    return { issue: '找不到流程表（要有 From、To、Handed over 欄）' };
  }
  if (flowTables.length > 1) {
    return { issue: `有 ${flowTables.length} 張流程表，只能有一張` };
  }
  const table = flowTables[0];
  const integrity = integrityIssue([{ table, role: 'flow' }]);
  if (integrity) {
    return integrity;
  }
  const placeholder = placeholderIssue([{ table, role: 'flow' }]);
  if (placeholder) {
    return placeholder;
  }
  if (table.rows.length === 0) {
    return { issue: '流程表沒有任何一列' };
  }
  const hasNumber = table.headers.includes('#');
  const participants = [];
  const steps = [];
  for (let r = 0; r < table.rows.length; r++) {
    if (hasNumber) {
      const number = textItems(table, r, '#').join(' ');
      if (!/^\d+$/.test(number) || Number(number) !== r + 1) {
        const written = number ? `「${number}」` : '空的';
        return { issue: rowIssue('flow', r, `的 # 是${written}，照列序應該是 ${r + 1}`) };
      }
    }
    const ends = {};
    for (const [name, label] of [['from', 'From'], ['to', 'To']]) {
      const key = keyValue(table, 'flow', r, name, label);
      if (key.issue) {
        return key;
      }
      if (!participants.includes(key.value)) {
        participants.push(key.value);
      }
      ends[name] = key.value;
    }
    const handedOver = fieldItems(table, 'flow', r, 'handed over', 'Handed over', true);
    if (handedOver.issue) {
      return handedOver;
    }
    const stateChange = fieldItems(table, 'flow', r, 'state change', 'State change', false);
    if (stateChange.issue) {
      return stateChange;
    }
    steps.push({
      n: r + 1,
      from: ends.from,
      to: ends.to,
      handedOver: handedOver.items,
      stateChange: stateChange.items,
      evidenceType: evidenceType(table, r)
    });
  }
  const limit =
    checkLimit('參與者', participants.length, DIAGRAM_LIMITS.FL_MAX_PARTICIPANTS) ||
    checkLimit('步驟', steps.length, DIAGRAM_LIMITS.FL_MAX_STEPS);
  if (limit) {
    return { issue: limit };
  }
  return { model: { kind: 'FL', entryId: sub.entryId, participants, steps }, insertAt: table.tokenIndex };
}

// ------------------------------------------------------------ text measure
// Estimated advance per character class, in hundredths of the font size.
// Widths are deliberately wide: a wrong estimate may only wrap a label early.

function charWidth(cp) {
  if (cp === 0x20) {
    return 35;
  }
  if (cp < 0x80) {
    if (cp === 0x4d || cp === 0x57 || cp === 0x6d || cp === 0x77) {
      return 95; // M W m w
    }
    if ((cp >= 0x30 && cp <= 0x39) || (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) {
      return 70;
    }
    return cp === 0x40 || cp === 0x23 || cp === 0x25 || cp === 0x26 ? 95 : 50; // @ # % & | punctuation
  }
  return cp >= 0x1f000 && cp <= 0x1faff ? 220 : 110;
}

// Combining marks, variation selectors, emoji modifiers and ZWJ add nothing
// and stay with the character before them.
function isExtender(cp) {
  return (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x1ab0 && cp <= 0x1aff) || (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) || (cp >= 0xfe20 && cp <= 0xfe2f) || (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0xe0100 && cp <= 0xe01ef) || (cp >= 0x1f3fb && cp <= 0x1f3ff) || cp === 0x200d;
}

function isRegionalIndicator(cp) {
  return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

// Fixed clusters (not platform Unicode segmentation): a base with its
// extenders, a ZWJ sequence, a regional-indicator pair.
function clusters(text) {
  const out = [];
  let joinNext = false;
  let openFlag = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const last = out[out.length - 1];
    if (last && (isExtender(cp) || joinNext || (openFlag && isRegionalIndicator(cp)))) {
      last.text += ch;
      joinNext = cp === 0x200d;
      openFlag = false;
      continue;
    }
    out.push({ text: ch, width: charWidth(cp) });
    joinNext = false;
    openFlag = isRegionalIndicator(cp);
  }
  return out;
}

function textWidth(text, size) {
  return clusters(text).reduce((sum, c) => sum + c.width, 0) * size / 100;
}

// ------------------------------------------------------------ wrapping

const OPENERS = new Set([...'（【《〈「『〔［｛']);
const CLOSERS = new Set([...'，。、；：？！）】》〉」』〕］｝／']);

// One item -> units a line may break between. An ASCII graphic run is one
// unit (keeps `ExpenseReport.Submit()` whole); every other cluster is its
// own unit (CJK breaks between characters); an opening mark joins the unit
// after it and a closing mark the unit before it; a space is a break
// opportunity that is dropped at a line boundary.
function lineUnits(text) {
  const raw = [];
  for (const c of clusters(text)) {
    const cp = c.text.codePointAt(0);
    const prev = raw[raw.length - 1];
    if (cp === 0x20) {
      raw.push({ kind: 'space' });
    } else if (cp > 0x20 && cp < 0x7f) {
      if (prev && prev.kind === 'ascii') {
        prev.text += c.text;
      } else {
        raw.push({ kind: 'ascii', text: c.text });
      }
    } else {
      raw.push({ kind: OPENERS.has(c.text) ? 'open' : CLOSERS.has(c.text) ? 'close' : 'char', text: c.text });
    }
  }
  const units = [];
  let spaceBefore = false;
  for (const u of raw) {
    const prev = units[units.length - 1];
    if (u.kind === 'space') {
      spaceBefore = true;
      continue;
    }
    if (u.kind === 'close' && prev && !spaceBefore) {
      prev.text += u.text;
    } else if (prev && prev.open && !spaceBefore) {
      prev.text += u.text;
      prev.open = u.kind === 'open';
    } else {
      units.push({ text: u.text, spaceBefore, open: u.kind === 'open' });
    }
    spaceBefore = false;
  }
  return units;
}

// A unit wider than the line: break after . / :: _ - first, then between clusters.
function splitWide(text, maxWidth, size) {
  const pieces = [];
  for (const part of text.split(/(?<=\.|\/|::|_|-)/)) {
    if (textWidth(part, size) <= maxWidth) {
      pieces.push(part);
      continue;
    }
    let line = '';
    for (const c of clusters(part)) {
      if (line && textWidth(line + c.text, size) > maxWidth) {
        pieces.push(line);
        line = '';
      }
      line += c.text;
    }
    if (line) {
      pieces.push(line);
    }
  }
  return pieces;
}

// Greedy fill of one item into lines no wider than maxWidth.
function wrapItem(text, maxWidth, size) {
  const space = textWidth(' ', size);
  const lines = [];
  let line = '';
  let width = 0;
  for (const unit of lineUnits(text)) {
    const w = textWidth(unit.text, size);
    const pieces = w > maxWidth ? splitWide(unit.text, maxWidth, size) : [unit.text];
    pieces.forEach((piece, k) => {
      const pw = textWidth(piece, size);
      const gap = line && k === 0 && unit.spaceBefore ? space : 0;
      if (line && width + gap + pw > maxWidth) {
        lines.push(line);
        line = '';
        width = 0;
      }
      if (line) {
        line += (gap ? ' ' : '') + piece;
        width += gap + pw;
      } else {
        line = piece;
        width = pw;
      }
    });
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

// A descriptive field: items are hard line breaks; past maxLines the third
// line ends in an ellipsis and the field counts as truncated. `total` is
// the number of lines the whole field takes, so a note can say how far over
// it is.
function wrapField(items, maxWidth, size, maxLines) {
  const lines = items.flatMap((item) => wrapItem(item, maxWidth, size));
  if (lines.length <= maxLines) {
    return { lines, truncated: false, total: lines.length };
  }
  const kept = lines.slice(0, maxLines);
  const last = clusters(kept[maxLines - 1]);
  const ellipsis = textWidth('…', size);
  while (last.length && last.reduce((sum, c) => sum + c.width, 0) * size / 100 + ellipsis > maxWidth) {
    last.pop();
  }
  kept[maxLines - 1] = `${last.map((c) => c.text).join('').replace(/ +$/, '')}…`;
  return { lines: kept, truncated: true, total: lines.length };
}

// More fields cut short than a picture may carry: the note names each one —
// row, column and the lines it would take — in row order, then column order.
function truncationIssue(role, cut) {
  const L = DIAGRAM_LIMITS;
  const cells = cut.map((c, k) => `${k === 0 ? TABLE_NAME[role] : ''}第 ${c.row} 列的 ${c.column}（${c.lines} 行）`);
  return `${cells.join('、')}要節略才放得下，上限 ${L.MAX_TRUNCATED_FIELDS} 格、每格 ${L.PRIMARY_MAX_LINES} 行`;
}

// ------------------------------------------------------------ geometry

const roundUp8 = (value) => Math.ceil(value / 8) * 8;

// Text rectangle used by the overlap audit: font size above the baseline,
// about a third below. anchor is where x is: the start (default), the
// middle or the end of the text, as the SVG text element states it.
function textRect(x, baseline, text, size, anchor) {
  const w = textWidth(text, size);
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { x: left, y: baseline - size, w, h: size + Math.round(size * 0.3) };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// An orthogonal segment as a thin rectangle (half the stroke on each side).
function segmentRect(a, b) {
  const x = Math.min(a[0], b[0]);
  const y = Math.min(a[1], b[1]);
  return { x: x - 0.75, y: y - 0.75, w: Math.abs(a[0] - b[0]) + 1.5, h: Math.abs(a[1] - b[1]) + 1.5 };
}

// The arrowhead's box: an 8 x 8 triangle whose tip is the route's end point.
function headRect(points) {
  const [x1, y1] = points[points.length - 2];
  const [x2, y2] = points[points.length - 1];
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  const s = GEOMETRY.headSize;
  const bx = x2 - dx * s;
  const by = y2 - dy * s;
  const xs = [x2, bx - dy * (s / 2), bx + dy * (s / 2)];
  const ys = [y2, by - dx * (s / 2), by + dx * (s / 2)];
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function segments(points) {
  return points.slice(1).map((p, k) => [points[k], p]);
}

// Shared audit: text never overlaps text, a box it does not belong to, a
// line or an arrowhead; everything sits inside the viewBox.
function auditLayout({ width, height, boxes, texts, routes, lifelines = [] }) {
  const inside = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height;
  for (let i = 0; i < boxes.length; i++) {
    if (!inside(boxes[i])) {
      return false;
    }
    for (let j = i + 1; j < boxes.length; j++) {
      if (rectsOverlap(boxes[i], boxes[j])) {
        return false;
      }
    }
  }
  const lineRects = [
    ...routes.flatMap((r) => r.pieces.flatMap((piece) => segments(piece).map(([a, b]) => segmentRect(a, b)))),
    ...routes.map((r) => headRect(r.pieces[r.pieces.length - 1])),
    ...lifelines.map(([a, b]) => segmentRect(a, b))
  ];
  if (!lineRects.every(inside)) {
    return false;
  }
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!inside(t.rect)) {
      return false;
    }
    for (let j = i + 1; j < texts.length; j++) {
      if (rectsOverlap(t.rect, texts[j].rect)) {
        return false;
      }
    }
    if (boxes.some((box, k) => k !== t.box && rectsOverlap(t.rect, box))) {
      return false;
    }
    if (lineRects.some((r) => rectsOverlap(t.rect, r))) {
      return false;
    }
  }
  return true;
}

// ------------------------------------------------------------ lifecycle layout

function layoutLifecycle(model, limits = sizeLimits()) {
  const G = GEOMETRY;
  const L = DIAGRAM_LIMITS;
  // The column, top to bottom: the start point when a row creates the
  // entity, the drawn states in state-table order, the end point when a row
  // removes it. Everything below works on these positions, so the two points
  // take the box rules; being first and last, their arrows run down the
  // middle or on the right. Start and end are two nodes, never one.
  const hasStart = model.transitions.some((t) => t.from === MARKER);
  const hasEnd = model.transitions.some((t) => t.to === MARKER);
  const nodes = [
    ...(hasStart ? [{ marker: 'start' }] : []),
    ...model.states.map((state) => ({ state })),
    ...(hasEnd ? [{ marker: 'end' }] : [])
  ];
  const position = new Map(model.states.map((state, i) => [state, i + (hasStart ? 1 : 0)]));
  const fromPosition = (value) => (value === MARKER ? 0 : position.get(value));
  const toPosition = (value) => (value === MARKER ? nodes.length - 1 : position.get(value));
  const owner = (node) => (node.marker === 'start' ? '起點' : node.marker === 'end' ? '終點' : `狀態 ${node.state} `);

  const nodeLines = [];
  for (const node of nodes) {
    const lines = node.marker ? [] : wrapItem(node.state, G.stateWrapWidth, G.identitySize);
    if (lines.length > L.IDENTITY_MAX_LINES) {
      return { issue: `狀態 ${node.state} 的名稱要排成 ${lines.length} 行，上限 ${L.IDENTITY_MAX_LINES} 行` };
    }
    nodeLines.push(lines);
  }
  // One per row of the transition table: its two positions and the text the
  // column shows for it.
  const cut = [];
  const rows = model.transitions.map((t) => {
    const trigger = wrapField(t.trigger, G.descriptionWidth, G.primarySize, L.PRIMARY_MAX_LINES);
    const guard = wrapField(t.guard, G.descriptionWidth - G.guardKeyWidth, G.secondarySize, L.SECONDARY_MAX_LINES);
    if (trigger.truncated) {
      cut.push({ row: t.n, column: 'Trigger', lines: trigger.total });
    }
    if (guard.truncated) {
      cut.push({ row: t.n, column: 'Guard', lines: guard.total });
    }
    const tag = DASHED_EVIDENCE.has(t.evidenceType) ? t.evidenceType : null;
    return { t, from: fromPosition(t.from), to: toPosition(t.to), trigger: trigger.lines, guard: guard.lines, tag };
  });
  if (cut.length > L.MAX_TRUNCATED_FIELDS) {
    return { issue: truncationIssue('transitions', cut) };
  }

  // Lines (PROPOSAL-116): the rows with the same From and To after reading —
  // the same two positions — share one line, numbered with all of them in
  // row order; it is dashed when any of them has a tag. A line is ordered and
  // tie-broken by its first row. Routes, lanes, ports and crossings count
  // lines; the column keeps one entry per row.
  const byPair = new Map();
  const edges = [];
  for (const row of rows) {
    if (!byPair.has(row.from)) {
      byPair.set(row.from, new Map());
    }
    const targets = byPair.get(row.from);
    if (!targets.has(row.to)) {
      const edge = { from: row.from, to: row.to, rows: [] };
      targets.set(row.to, edge);
      edges.push(edge);
    }
    targets.get(row.to).rows.push(row);
  }
  for (const e of edges) {
    e.n = e.rows[0].t.n;
    e.label = e.rows.map((row) => row.t.n).join('、');
    e.dashed = e.rows.some((row) => row.tag);
  }

  // Routes: the line to the next position runs down the middle (one pair has
  // one line, so a position has at most one); other forward lines and
  // self-transitions on the right, returns on the left.
  for (const e of edges) {
    e.side = e.to === e.from + 1 ? 'direct' : e.to < e.from ? 'left' : 'right';
  }

  // Lanes: shortest spans nearest the boxes; a shared state index overlaps.
  const laneCount = {};
  for (const side of ['left', 'right']) {
    const spans = edges
      .filter((e) => e.side === side)
      .map((e) => ({ e, lo: Math.min(e.from, e.to), hi: Math.max(e.from, e.to) }))
      .sort((a, b) => (a.hi - a.lo) - (b.hi - b.lo) || a.lo - b.lo || a.hi - b.hi || a.e.n - b.e.n);
    const lanes = [];
    for (const span of spans) {
      let k = 0;
      while (lanes[k] && lanes[k].some((o) => o.lo <= span.hi && span.lo <= o.hi)) {
        k += 1;
      }
      (lanes[k] = lanes[k] || []).push(span);
      span.e.lane = k;
    }
    laneCount[side] = lanes.length;
  }
  for (const [side, label] of [['right', '右'], ['left', '左']]) {
    if (laneCount[side] > L.LC_MAX_SIDE_LANES) {
      return { issue: `${label}側需要 ${laneCount[side]} 條分道，上限 ${L.LC_MAX_SIDE_LANES}` };
    }
  }

  // Ports on each box side, top to bottom: ends whose other state is above
  // (inner lane first), a self-transition's source then target, ends whose
  // other state is below (outer lane first) — so nested brackets never cross.
  const ports = nodes.map(() => ({ left: [], right: [] }));
  for (const e of edges) {
    if (e.side === 'direct') {
      continue;
    }
    if (e.from === e.to) {
      ports[e.from][e.side].push({ e, end: 'from', cat: 2 }, { e, end: 'to', cat: 3 });
    } else {
      ports[e.from][e.side].push({ e, end: 'from', cat: e.to < e.from ? 1 : 4 });
      ports[e.to][e.side].push({ e, end: 'to', cat: e.from < e.to ? 1 : 4 });
    }
  }
  const portOrder = (a, b) => a.cat - b.cat ||
    (a.cat === 1 || a.cat === 3 ? a.e.lane - b.e.lane : b.e.lane - a.e.lane) ||
    a.e.n - b.e.n;
  for (let i = 0; i < ports.length; i++) {
    for (const [side, label] of [['right', '右'], ['left', '左']]) {
      ports[i][side].sort(portOrder);
      if (ports[i][side].length > L.LC_MAX_SIDE_PORTS) {
        return { issue: `${owner(nodes[i])}的${label}側需要 ${ports[i][side].length} 個接點，上限 ${L.LC_MAX_SIDE_PORTS}` };
      }
    }
  }

  // Sizes and positions. A point is 24 wide on the column's centre line;
  // with more than one port on a side it stretches by 24 a port into a
  // capsule whose straight sides hold the ports at the box pitch (a box adds
  // a pitch above and below its ports; the capsule's round ends are that).
  const widest = Math.max(...nodeLines.flat().map((line) => textWidth(line, G.identitySize)));
  const nodeWidth = Math.max(G.stateMinWidth, roundUp8(widest + 2 * G.stateTextPadding));
  const nodeHeights = nodes.map((node, i) => {
    const portCount = Math.max(ports[i].left.length, ports[i].right.length);
    return node.marker ? G.markerSize * Math.max(1, portCount) : roundUp8(Math.max(
      G.stateMinHeight,
      G.identityLine * nodeLines[i].length + 16,
      G.portPitch * (portCount + 1)
    ));
  });
  // A line standing for several rows carries all their numbers, beside its
  // source end: after it on the right, ending at it on the left, so they
  // never run into the box. On a side with such a line the first lane moves
  // out to clear the widest of those numbers by 8; a side without keeps its
  // offset. The column starts right of the outermost lane, and right of the
  // numbers on a line down the middle.
  const numbersWidth = (e) => textWidth(e.label, G.smallSize);
  const laneOffset = {};
  for (const side of ['left', 'right']) {
    const shared = edges.filter((e) => e.side === side && e.rows.length > 1).map(numbersWidth);
    laneOffset[side] = shared.length ? Math.max(G.laneOffset, Math.ceil(Math.max(...shared) + 16)) : G.laneOffset;
  }
  const nodeX = G.margin + (laneCount.left === 0 ? 0 : laneOffset.left + G.lanePitch * (laneCount.left - 1));
  const nodeRight = nodeX + nodeWidth;
  const nodeCenter = nodeX + nodeWidth / 2;
  const sideX = (i, side) => (nodes[i].marker
    ? nodeCenter + (side === 'left' ? -1 : 1) * G.markerSize / 2
    : (side === 'left' ? nodeX : nodeRight));
  const laneX = (side, k) => (side === 'left'
    ? nodeX - laneOffset.left - G.lanePitch * k
    : nodeRight + laneOffset.right + G.lanePitch * k);
  const middleNumbers = edges.filter((e) => e.side === 'direct' && e.rows.length > 1)
    .map((e) => Math.ceil(nodeCenter + 12 + numbersWidth(e)));
  const graphRight = Math.max(laneCount.right === 0 ? nodeRight : laneX('right', laneCount.right - 1), ...middleNumbers);
  const numberX = graphRight + G.labelGap;
  const textX = numberX + G.numberColumn;
  const width = textX + G.descriptionWidth + G.margin;

  const describe = (row) => G.primaryLine * row.trigger.length + G.secondaryLine * row.guard.length + (row.tag ? G.tagRow : 0);
  const bySource = nodes.map((node, i) => rows.filter((row) => row.from === i).sort((a, b) => a.t.n - b.t.n));
  const tops = [];
  const bands = [];
  let top = G.margin;
  for (let i = 0; i < nodes.length; i++) {
    const list = bySource[i];
    const text = list.reduce((sum, row) => sum + describe(row), 0) + G.descriptionGap * Math.max(0, list.length - 1);
    tops.push(top);
    bands.push(Math.max(nodeHeights[i], text));
    top += bands[i] + G.bandGap;
  }
  const height = tops[tops.length - 1] + bands[bands.length - 1] + G.margin;

  const boxes = nodes.map((node, i) => (node.marker
    ? { x: nodeCenter - G.markerSize / 2, y: tops[i], w: G.markerSize, h: nodeHeights[i] }
    : { x: nodeX, y: tops[i], w: nodeWidth, h: nodeHeights[i] }));
  const texts = [];
  const nodeTexts = nodes.map((node, i) => {
    const cy = tops[i] + nodeHeights[i] / 2;
    return nodeLines[i].map((line, k) => {
      const y = cy + 5 - (G.identityLine / 2) * (nodeLines[i].length - 1) + G.identityLine * k;
      texts.push({ rect: textRect(nodeCenter, y, line, G.identitySize, 'middle'), box: i });
      return { x: nodeCenter, y, text: line };
    });
  });

  const portY = (i, side, e, end) => {
    const list = ports[i][side];
    const j = list.findIndex((p) => p.e === e && p.end === end);
    return tops[i] + nodeHeights[i] / 2 + G.portPitch * (j - (list.length - 1) / 2);
  };
  for (const e of edges) {
    if (e.side === 'direct') {
      const sy = tops[e.from] + nodeHeights[e.from];
      const ty = tops[e.to];
      e.points = [[nodeCenter, sy], [nodeCenter, ty]];
      e.number = { x: nodeCenter + 12, y: (sy + ty) / 2 - 6 };
    } else {
      const sx = sideX(e.from, e.side);
      const lx = laneX(e.side, e.lane);
      const sy = portY(e.from, e.side, e, 'from');
      const ty = portY(e.to, e.side, e, 'to');
      e.points = [[sx, sy], [lx, sy], [lx, ty], [sideX(e.to, e.side), ty]];
      if (e.rows.length === 1) {
        e.number = { x: e.side === 'left' ? sx - 32 : sx + 8, y: sy - 6 };
      } else {
        e.number = e.side === 'left' ? { x: sx - 8, y: sy - 6, anchor: 'end' } : { x: sx + 8, y: sy - 6 };
      }
    }
    texts.push({ rect: textRect(e.number.x, e.number.y, e.label, G.smallSize, e.number.anchor) });
  }

  // Every check the size limits have no part in is done before they are
  // compared: a note can then tell a diagram that only needs more room from
  // one no size would draw.
  const crossing = crossRoutes(edges);
  let geometryIssue = crossing.issue || null;
  const descriptions = [];
  if (!geometryIssue) {
    for (let i = 0; i < nodes.length; i++) {
      let descTop = tops[i];
      for (const row of bySource[i]) {
        const d = { row, number: { x: numberX, y: descTop + 14 }, trigger: [], guard: [], tag: null };
        texts.push({ rect: textRect(numberX, descTop + 14, String(row.t.n), G.smallSize) });
        row.trigger.forEach((line, k) => {
          const y = descTop + 14 + G.primaryLine * k;
          d.trigger.push({ x: textX, y, text: line });
          texts.push({ rect: textRect(textX, y, line, G.primarySize) });
        });
        const guardTop = descTop + G.primaryLine * row.trigger.length;
        row.guard.forEach((line, k) => {
          const y = guardTop + 13 + G.secondaryLine * k;
          d.guard.push({ x: textX + G.guardKeyWidth, y, text: line });
          texts.push({ rect: textRect(textX + G.guardKeyWidth, y, line, G.secondarySize) });
        });
        if (row.guard.length) {
          d.guardKey = { x: textX, y: guardTop + 13 };
          texts.push({ rect: textRect(textX, guardTop + 13, 'Guard:', G.smallSize) });
        }
        if (row.tag) {
          const tagY = guardTop + G.secondaryLine * row.guard.length;
          d.tag = { x: textX, y: tagY, text: row.tag };
          texts.push({ rect: { x: textX, y: tagY, w: G.tagWidth, h: G.tagHeight } });
        }
        descriptions.push(d);
        descTop += describe(row) + G.descriptionGap;
      }
    }
    const routes = edges.map((e) => ({ pieces: e.pieces }));
    if (!auditLayout({ width, height, boxes, texts, routes })) {
      geometryIssue = '圖上的文字或線條會互相重疊';
    }
  }
  if (width > limits.lcWidth || height > limits.lcHeight) {
    const name = (node) => (node.marker === 'start' ? '起點' : node.marker === 'end' ? '終點' : `狀態 ${node.state}`);
    return {
      oversize: {
        width: Math.ceil(width),
        height: Math.ceil(height),
        bands: nodes.map((node, i) => ({ name: name(node), rows: bySource[i].map((row) => row.t.n), height: bands[i] }))
      },
      geometryIssue
    };
  }
  if (geometryIssue) {
    return { issue: geometryIssue };
  }
  const placed = nodes.map((node, i) => ({
    ...node,
    box: boxes[i],
    lines: nodeTexts[i],
    attached: edges.filter((e) => e.from === i || e.to === i).length
  }));
  return {
    layout: {
      width,
      height,
      nodeRadius: G.stateRadius,
      states: placed.filter((node) => !node.marker),
      markers: placed.filter((node) => node.marker),
      edges,
      descriptions
    },
    truncated: cut.length > 0
  };
}

// Crossings of the lifecycle's orthogonal routes: shared segments and
// touching are refused; a proper crossing stays only when few, far from
// every endpoint and apart from the next one, and is drawn as a gap in the
// vertical segment (the horizontal one stays whole). Sets e.pieces.
function crossRoutes(edges) {
  const L = DIAGRAM_LIMITS;
  const segs = edges.flatMap((e, ei) => segments(e.points).map(([a, b], k) => ({ ei, k, a, b, vertical: a[0] === b[0] })));
  const within = (v, p, q) => v >= Math.min(p, q) && v <= Math.max(p, q);
  const strictly = (v, p, q) => v > Math.min(p, q) && v < Math.max(p, q);
  const crossings = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i];
      const t = segs[j];
      if (s.ei === t.ei) {
        continue;
      }
      if (s.vertical === t.vertical) {
        const axis = s.vertical ? 0 : 1;
        const along = s.vertical ? 1 : 0;
        if (s.a[axis] === t.a[axis] &&
          Math.max(Math.min(s.a[along], s.b[along]), Math.min(t.a[along], t.b[along])) <=
          Math.min(Math.max(s.a[along], s.b[along]), Math.max(t.a[along], t.b[along]))) {
          return { issue: '有兩支箭頭的線段重疊' };
        }
        continue;
      }
      const v = s.vertical ? s : t;
      const h = s.vertical ? t : s;
      const x = v.a[0];
      const y = h.a[1];
      if (!within(x, h.a[0], h.b[0]) || !within(y, v.a[1], v.b[1])) {
        continue;
      }
      if (!strictly(x, h.a[0], h.b[0]) || !strictly(y, v.a[1], v.b[1])) {
        return { issue: '有兩支箭頭在端點相碰' };
      }
      const clearance = Math.min(Math.abs(x - h.a[0]), Math.abs(x - h.b[0]), Math.abs(y - v.a[1]), Math.abs(y - v.b[1]));
      if (clearance < L.CROSSING_ENDPOINT_CLEARANCE) {
        return { issue: '箭頭交叉的地方離轉角太近' };
      }
      crossings.push({ v, h, x, y });
    }
  }
  if (crossings.length > L.LC_MAX_CROSSINGS) {
    return { issue: `箭頭交叉 ${crossings.length} 處，上限 ${L.LC_MAX_CROSSINGS}` };
  }
  // Distance along a route to a point on one of its segments.
  const along = (e, k, point) => {
    let d = 0;
    for (let m = 0; m < k; m++) {
      d += Math.abs(e.points[m + 1][0] - e.points[m][0]) + Math.abs(e.points[m + 1][1] - e.points[m][1]);
    }
    return d + Math.abs(point[0] - e.points[k][0]) + Math.abs(point[1] - e.points[k][1]);
  };
  // A line is named by its row, or by every row it stands for.
  const lineName = (e) => (e.rows.length > 1 ? `轉移表第 ${e.label} 列共用的線` : `第 ${e.n} 條轉移`);
  for (let ei = 0; ei < edges.length; ei++) {
    const mine = crossings
      .flatMap((c) => [c.v, c.h].filter((s) => s.ei === ei).map((s) => along(edges[ei], s.k, [c.x, c.y])))
      .sort((a, b) => a - b);
    if (mine.length > L.LC_MAX_CROSSINGS_PER_EDGE) {
      return { issue: `${lineName(edges[ei])}交叉 ${mine.length} 處，上限 ${L.LC_MAX_CROSSINGS_PER_EDGE}` };
    }
    if (mine.some((d, m) => m > 0 && d - mine[m - 1] < L.CROSSING_SEPARATION)) {
      return { issue: `${lineName(edges[ei])}的兩個交叉點太近` };
    }
  }
  // Cut the vertical segment around each crossing.
  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei];
    const cuts = crossings.filter((c) => c.v.ei === ei);
    const pieces = [[e.points[0]]];
    for (let k = 1; k < e.points.length; k++) {
      const [a, b] = [e.points[k - 1], e.points[k]];
      const here = cuts.filter((c) => c.v.k === k - 1).map((c) => c.y)
        .sort((p, q) => (b[1] > a[1] ? p - q : q - p));
      for (const y of here) {
        const dir = Math.sign(b[1] - a[1]);
        pieces[pieces.length - 1].push([a[0], y - dir * L.CROSSING_HALF_GAP]);
        pieces.push([[a[0], y + dir * L.CROSSING_HALF_GAP]]);
      }
      pieces[pieces.length - 1].push(b);
    }
    e.pieces = pieces;
  }
  return {};
}

// ------------------------------------------------------------ flow layout

function layoutFlow(model, limits = sizeLimits()) {
  const G = GEOMETRY;
  const L = DIAGRAM_LIMITS;
  const centerOf = new Map(model.participants.map((p, j) => [p, G.firstParticipantX + G.participantPitch * j]));

  const headers = [];
  const texts = [];
  const boxes = [];
  for (const [j, participant] of model.participants.entries()) {
    const lines = wrapItem(participant, G.headerWrapWidth, G.identitySize);
    if (lines.length > L.IDENTITY_MAX_LINES) {
      return { issue: `參與者 ${participant} 的名稱要排成 ${lines.length} 行，上限 ${L.IDENTITY_MAX_LINES} 行` };
    }
    const cx = centerOf.get(participant);
    const box = { x: cx - G.headerWidth / 2, y: G.margin, w: G.headerWidth, h: G.headerHeight };
    const cy = box.y + box.h / 2;
    const placed = lines.map((line, k) => {
      const y = cy + 5 - (G.identityLine / 2) * (lines.length - 1) + G.identityLine * k;
      texts.push({ rect: textRect(cx, y, line, G.identitySize, 'middle'), box: j });
      return { x: cx, y, text: line };
    });
    boxes.push(box);
    headers.push({ participant, box, lines: placed });
  }

  const cut = [];
  let bandTop = G.firstBandTop;
  const steps = [];
  const exclusions = model.participants.map(() => []);
  for (const s of model.steps) {
    const fromX = centerOf.get(s.from);
    const toX = centerOf.get(s.to);
    const self = s.from === s.to;
    const labelX = self ? fromX + 12 : Math.min(fromX, toX) + 12;
    const labelWidth = self ? G.selfLabelWidth : Math.min(G.maxLabelWidth, Math.abs(toX - fromX) - 24);
    const main = wrapField(s.handedOver, labelWidth, G.primarySize, L.PRIMARY_MAX_LINES);
    const change = wrapField(s.stateChange, labelWidth, G.secondarySize, L.SECONDARY_MAX_LINES);
    if (main.truncated) {
      cut.push({ row: s.n, column: 'Handed over', lines: main.total });
    }
    if (change.truncated) {
      cut.push({ row: s.n, column: 'State change', lines: change.total });
    }
    const tag = DASHED_EVIDENCE.has(s.evidenceType) ? s.evidenceType : null;

    const step = { s, number: { x: G.margin, y: bandTop + 14 }, main: [], change: [], tag: null };
    const own = [];
    texts.push({ rect: textRect(G.margin, bandTop + 14, String(s.n), G.smallSize) });
    main.lines.forEach((line, k) => {
      const y = bandTop + 14 + G.primaryLine * k;
      step.main.push({ x: labelX, y, text: line });
      own.push(textRect(labelX, y, line, G.primarySize));
    });
    const tagTop = bandTop + G.primaryLine * main.lines.length;
    if (tag) {
      step.tag = { x: labelX, y: tagTop, text: tag };
      own.push({ x: labelX, y: tagTop, w: G.tagWidth, h: G.tagHeight });
    }
    const arrowY = tagTop + (tag ? G.tagRow : 0) + G.labelClearance;
    const loop = self ? G.selfLoopHeight : 0;
    step.points = self
      ? [[fromX, arrowY], [fromX + G.selfLoopWidth, arrowY], [fromX + G.selfLoopWidth, arrowY + loop], [fromX, arrowY + loop]]
      : [[fromX, arrowY], [toX, arrowY]];
    step.pieces = [step.points];
    const changeTop = arrowY + loop + G.labelClearance;
    change.lines.forEach((line, k) => {
      const y = changeTop + 13 + G.secondaryLine * k;
      step.change.push({ x: labelX, y, text: line });
      own.push(textRect(labelX, y, line, G.secondarySize));
    });
    texts.push(...own.map((rect) => ({ rect })));
    // A label spanning intermediate lifelines cuts them, never the arrow.
    const lo = Math.min(fromX, toX);
    const hi = Math.max(fromX, toX);
    model.participants.forEach((p, j) => {
      const x = centerOf.get(p);
      if (x > lo && x < hi) {
        for (const r of own) {
          if (r.x < x && x < r.x + r.w) {
            exclusions[j].push([r.y - 4, r.y + r.h + 4]);
          }
        }
      }
    });
    steps.push(step);
    bandTop = changeTop + G.secondaryLine * change.lines.length + G.stepSpacing;
  }
  if (cut.length > L.MAX_TRUNCATED_FIELDS) {
    return { issue: truncationIssue('flow', cut) };
  }

  const lifelineEnd = bandTop;
  const lifelines = model.participants.map((p, j) => {
    const x = centerOf.get(p);
    const cuts = exclusions[j].sort((a, b) => a[0] - b[0]);
    const pieces = [];
    let y = G.lifelineTop;
    for (const [a, b] of cuts) {
      if (a > y) {
        pieces.push([[x, y], [x, a]]);
      }
      y = Math.max(y, b);
    }
    if (y < lifelineEnd) {
      pieces.push([[x, y], [x, lifelineEnd]]);
    }
    return pieces;
  });
  // No width cap here: the participant cap bounds it, and a flow wider than
  // the page scrolls sideways on screen (and is replaced by a note in print).
  const lastCenter = G.firstParticipantX + G.participantPitch * (model.participants.length - 1);
  const width = Math.max(lastCenter + 96, ...model.steps.filter((s) => s.from === s.to).map((s) => centerOf.get(s.from) + 196));
  const height = lifelineEnd + G.margin;
  // The audit runs before the height is compared, as for a lifecycle.
  const routes = steps.map((step) => ({ pieces: step.pieces }));
  const geometryIssue = auditLayout({ width, height, boxes, texts, routes, lifelines: lifelines.flat() })
    ? null
    : '圖上的文字或線條會互相重疊';
  if (height > limits.flHeight) {
    return { oversize: { width: Math.ceil(width), height: Math.ceil(height) }, geometryIssue };
  }
  if (geometryIssue) {
    return { issue: geometryIssue };
  }
  return { layout: { width, height, headers, lifelines, steps }, truncated: cut.length > 0 };
}

// ------------------------------------------------------------ svg output

function pathData(points) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let k = 1; k < points.length; k++) {
    const [px, py] = points[k - 1];
    const [x, y] = points[k];
    d += x === px ? `V${y}` : y === py ? `H${x}` : `L${x} ${y}`;
  }
  return d;
}

// anchor 'end': x is where the text ends (textRect measures it the same way).
function textEl(cls, { x, y, text, anchor }) {
  return `<text class="${cls}" x="${x}" y="${y}"${anchor === 'end' ? ' text-anchor="end"' : ''}>${escapeXml(text)}</text>`;
}

function routeEls(pieces, dashed, markerId) {
  const cls = dashed ? 'dg-route dg-uncertain' : 'dg-route';
  return pieces.map((piece, k) => {
    const marker = k === pieces.length - 1 ? ` marker-end="url(#${markerId})"` : '';
    return `<path class="${cls}" d="${pathData(piece)}"${marker}/>`;
  }).join('');
}

function tagEls(tag) {
  const G = GEOMETRY;
  return `<rect class="dg-evidence-box" x="${tag.x}" y="${tag.y}" width="${G.tagWidth}" height="${G.tagHeight}" rx="3"/>` +
    textEl('dg-evidence-text', { x: tag.x + G.tagInset, y: tag.y + 12, text: tag.text });
}

function svgOpen(label, width, height, markerId) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="dg-svg" role="img" aria-label="${escapeXml(label)}" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet">\n` +
    `<defs aria-hidden="true"><marker id="${markerId}" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" ` +
    'markerUnits="userSpaceOnUse" orient="auto"><path class="dg-head" d="M0 0L8 4L0 8Z"/></marker></defs>\n' +
    `<g aria-hidden="true">\n<rect class="dg-canvas" x="0" y="0" width="${width}" height="${height}"/>\n`;
}

// The legend lists only the arrow styles this diagram uses and states the
// Evidence type; it never ranks the types or calls a solid line verified.
// solid: some line is solid; types: the dashed types some row has. A
// lifecycle's line stands for its rows (PROPOSAL-116), so its two sentences
// say so, and one more says what the numbers on a shared line are. A
// lifecycle adds a line for each point it draws, one when a point holds
// several lines (crowded), and one listing the states no transition has — a
// fact about the table, not about the system.
function legendHtml({ kind, solid, types, truncated, shared = false, start = false, end = false, crowded = false, unlisted = [] }) {
  const key = (dashed) =>
    `<svg class="dg-key" aria-hidden="true" viewBox="0 0 28 8"><path class="dg-route${dashed ? ' dg-uncertain' : ''}" d="M0 4H28"/></svg>`;
  const pointKey = (shape) => `<svg class="dg-key dg-key-point" aria-hidden="true" viewBox="0 0 28 12">${shape}</svg>`;
  const lc = kind === 'LC';
  const spans = [];
  if (solid) {
    spans.push(`<span>${key(false)}${lc
      ? '實線：這條線代表的各列，Evidence 類型都不是 inferred 或 assumed。'
      : '實線：這一條的 Evidence 類型不是 inferred 或 assumed。'}</span>`);
  }
  if (types.length) {
    spans.push(`<span>${key(true)}${lc
      ? '虛線：這條線代表的列中，至少一列的 Evidence 類型是 inferred 或 assumed；各列類型見旁邊的標籤與下方表格。'
      : '虛線：這一條的 Evidence 類型是 inferred 或 assumed。'}本圖類型：${types.join('、')}。</span>`);
  }
  if (shared) {
    spans.push('<span>同一條線上的多個編號是轉移表的列號；相同 From、To 共用線路，各列動作與條件仍分開。</span>');
  }
  if (start) {
    spans.push(`<span>${pointKey('<circle class="dg-start-dot" cx="14" cy="6" r="6"/>')}實心圓：建立之前（From 寫 <code>${MARKER}</code>）。</span>`);
  }
  if (end) {
    spans.push(`<span>${pointKey('<circle class="dg-end-ring" cx="14" cy="6" r="5.25"/><circle class="dg-end-dot" cx="14" cy="6" r="3"/>')}` +
      `圈中點：刪除之後（To 寫 <code>${MARKER}</code>）。</span>`);
  }
  if (crowded) {
    spans.push('<span>同一記號上的多條線代表不同轉移，不是多個起點或終點。</span>');
  }
  if (unlisted.length) {
    spans.push(`<span>轉移表沒有寫到的狀態：${unlisted.map((value) => `<code dir="auto">${escapeXml(value)}</code>`).join('、')}。</span>`);
  }
  if (truncated) {
    spans.push('<span>…：文字已節略，完整內容見下方的卡片或表格。</span>');
  }
  return `<figcaption class="dg-legend">${spans.join('')}</figcaption>\n`;
}

// A point: a filled circle (start) or a ringed one (end); taller than wide
// when it holds more than one port, as a capsule (layoutLifecycle).
function pointEls(point) {
  const { x, y, w, h } = point.box;
  const r = w / 2;
  if (point.marker === 'start') {
    return `<g class="dg-marker dg-start" data-marker="start"><rect class="dg-start-dot" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></g>\n`;
  }
  const inset = GEOMETRY.markerInset;
  return `<g class="dg-marker dg-end" data-marker="end"><rect class="dg-end-ring" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>` +
    `<rect class="dg-end-dot" x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${r - inset}"/></g>\n`;
}

function evidenceAttr(type) {
  return type ? ` data-evidence="${escapeXml(type)}"` : '';
}

function lifecycleSvg(model, result, ordinal) {
  const L = DIAGRAM_LIMITS;
  const { layout } = result;
  const markerId = `dflow.dg.${ordinal}.arrow`;
  const unlisted = model.unlisted || [];
  // States drawn, rows of the transition table, lines drawn for them.
  const label = `${model.entryId}：${model.states.length} 個狀態、${model.transitions.length} 列轉移、${layout.edges.length} 條線` +
    `${unlisted.length ? `，另有 ${unlisted.length} 個狀態沒有轉移、列在圖下` : ''}；細節見下方的卡片或表格`;
  // Larger than a printed page holds legibly: drawn on screen, replaced by a
  // one-line note in print. The run's size limits do not move this.
  const large = layout.width > L.LC_PRINT_MAX_WIDTH || layout.height > L.LC_PRINT_MAX_HEIGHT;
  let out = `<figure class="dflow-dg dg-lc${large ? ' dg-large' : ''}" data-entry="${escapeXml(model.entryId)}">\n`;
  if (large) {
    out += `<p class="dg-print-note">${escapeXml(model.entryId)} 的圖寬 ${layout.width}、高 ${layout.height}；` +
      `列印版只印寬 ${L.LC_PRINT_MAX_WIDTH}、高 ${L.LC_PRINT_MAX_HEIGHT} 以內的生命週期圖；內容見下方的卡片或表格。</p>\n`;
  }
  out += '<div class="dg-scroll" tabindex="0">\n';
  out += svgOpen(label, layout.width, layout.height, markerId);
  for (const s of layout.states) {
    out += `<g class="dg-state" data-state="${escapeXml(s.state)}"><rect class="dg-box" x="${s.box.x}" y="${s.box.y}" ` +
      `width="${s.box.w}" height="${s.box.h}" rx="${layout.nodeRadius}"/>${s.lines.map((line) => textEl('dg-state-label', line)).join('')}</g>\n`;
  }
  for (const point of layout.markers) {
    out += pointEls(point);
  }
  // A line for one row is that row (data-n, data-evidence); a shared line
  // lists its rows (data-rows) and claims no single Evidence type.
  for (const e of layout.edges) {
    const first = e.rows[0].t;
    const rowsAttr = e.rows.length > 1 ? `data-rows="${e.rows.map((row) => row.t.n).join(',')}"` : `data-n="${e.n}"`;
    out += `<g class="dg-edge" ${rowsAttr} data-from="${escapeXml(first.from)}" data-to="${escapeXml(first.to)}"` +
      `${e.rows.length > 1 ? '' : evidenceAttr(first.evidenceType)}>` +
      `${routeEls(e.pieces, e.dashed, markerId)}${textEl('dg-number', { ...e.number, text: e.label })}</g>\n`;
  }
  for (const d of layout.descriptions) {
    out += `<g class="dg-label" data-n="${d.row.t.n}">${textEl('dg-number', { ...d.number, text: String(d.row.t.n) })}` +
      d.trigger.map((line) => textEl('dg-primary', line)).join('') +
      (d.guardKey ? textEl('dg-guard-key', { ...d.guardKey, text: 'Guard:' }) : '') +
      d.guard.map((line) => textEl('dg-secondary', line)).join('') +
      (d.tag ? tagEls(d.tag) : '') + '</g>\n';
  }
  out += '</g>\n</svg>\n</div>\n';
  out += legendHtml({
    kind: 'LC',
    solid: layout.edges.some((e) => !e.dashed),
    types: ['inferred', 'assumed'].filter((type) => layout.descriptions.some((d) => d.row.tag === type)),
    truncated: result.truncated,
    shared: layout.edges.some((e) => e.rows.length > 1),
    start: layout.markers.some((point) => point.marker === 'start'),
    end: layout.markers.some((point) => point.marker === 'end'),
    crowded: layout.markers.some((point) => point.attached > 1),
    unlisted
  });
  return `${out}</figure>\n`;
}

function flowSvg(model, result, ordinal) {
  const { layout } = result;
  const markerId = `dflow.dg.${ordinal}.arrow`;
  const label = `${model.entryId}：${model.participants.length} 個參與者、${model.steps.length} 個步驟；細節見下方的卡片或表格`;
  // More participants than a printed page holds legibly: drawn on screen
  // (scrolling sideways), replaced by a one-line note in print.
  const wide = model.participants.length > DIAGRAM_LIMITS.FL_PRINT_MAX_PARTICIPANTS;
  let out = `<figure class="dflow-dg dg-fl${wide ? ' dg-wide' : ''}" data-entry="${escapeXml(model.entryId)}">\n`;
  if (wide) {
    out += `<p class="dg-print-note">${escapeXml(model.entryId)} 有 ${model.participants.length} 個參與者，` +
      `列印版只印 ${DIAGRAM_LIMITS.FL_PRINT_MAX_PARTICIPANTS} 個以內的流程圖；內容見下方的卡片或表格。</p>\n`;
  }
  out += '<div class="dg-scroll" tabindex="0">\n';
  out += svgOpen(label, layout.width, layout.height, markerId);
  for (const pieces of layout.lifelines) {
    out += pieces.map((piece) => `<path class="dg-lifeline" d="${pathData(piece)}"/>`).join('') + '\n';
  }
  for (const h of layout.headers) {
    out += `<g class="dg-participant" data-participant="${escapeXml(h.participant)}"><rect class="dg-box" x="${h.box.x}" ` +
      `y="${h.box.y}" width="${h.box.w}" height="${h.box.h}" rx="${GEOMETRY.stateRadius}"/>` +
      `${h.lines.map((line) => textEl('dg-participant-label', line)).join('')}</g>\n`;
  }
  for (const step of layout.steps) {
    const s = step.s;
    out += `<g class="dg-step" data-n="${s.n}" data-from="${escapeXml(s.from)}" data-to="${escapeXml(s.to)}"${evidenceAttr(s.evidenceType)}>` +
      routeEls(step.pieces, Boolean(step.tag), markerId) +
      textEl('dg-number', { ...step.number, text: String(s.n) }) +
      step.main.map((line) => textEl('dg-primary', line)).join('') +
      (step.tag ? tagEls(step.tag) : '') +
      step.change.map((line) => textEl('dg-secondary', line)).join('') + '</g>\n';
  }
  out += '</g>\n</svg>\n</div>\n';
  out += legendHtml({
    kind: 'FL',
    solid: layout.steps.some((step) => !step.tag),
    types: ['inferred', 'assumed'].filter((type) => layout.steps.some((step) => step.tag && step.tag.text === type)),
    truncated: result.truncated
  });
  return `${out}</figure>\n`;
}

// Said after a refusal the size limits have no part in.
const SIZE_DOES_NOT_HELP = '提高尺寸上限不會解除這項限制；請保留完整表格，改看下方的卡片或表格';

// The note for a diagram over the run's size limits, with its natural size.
// Size alone: the options and values that draw it, in the order width then
// height. The height asked for is never below either kind's current limit —
// the option sets both — so following it stops no other diagram of the run
// from being drawn; a lifecycle over in height also gets the three tallest
// bands. With another problem too: that size alone will not draw it.
function oversizeIssue(lc, result, limits) {
  const { width, height, bands } = result.oversize;
  const need = `排版需要寬 ${width}、高 ${height}`;
  const current = lc ? `目前上限為寬 ${limits.lcWidth}、高 ${limits.lcHeight}` : `目前高度上限為 ${limits.flHeight}，流程圖沒有寬度上限`;
  if (result.geometryIssue) {
    return `${need}；${current}；另有${result.geometryIssue}。單獨提高尺寸上限仍無法畫出；請保留完整表格，改看下方的卡片或表格`;
  }
  const options = [];
  if (lc && width > limits.lcWidth) {
    options.push(`--diagram-max-width ${width}`);
  }
  const overHeight = height > (lc ? limits.lcHeight : limits.flHeight);
  const asked = Math.max(height, limits.lcHeight, limits.flHeight);
  if (overHeight) {
    options.push(`--diagram-max-height ${asked}`);
  }
  let text = `${need}；${current}。請保留原本的來源與輸出選項，加上 ${options.join(' ')} 後重新執行 dflow render`;
  if (overHeight && asked > height) {
    text += `（這個選項同時管${lc ? '流程圖' : '生命週期圖'}，${asked} 是它們目前的上限；取較大的值，已經畫得出來的圖才不會變成不畫）`;
  }
  if (lc && overHeight) {
    const tallest = bands.map((band, i) => ({ ...band, i })).sort((a, b) => b.height - a.height || a.i - b.i).slice(0, 3);
    text += `；段高較大的位置：${tallest.map((band) =>
      `${band.name}（${band.rows.length ? `轉移表第 ${band.rows.join('、')} 列` : '沒有出發轉移'}，段高 ${band.height}）`).join('、')}。` +
      '段高取記號或方框與逐列說明中較高者；請保留完整表格';
  }
  return text;
}

// A model -> { html } or { issue }. ordinal numbers the page's diagrams;
// limits are the run's size limits (sizeLimits).
function drawDiagram(model, ordinal, limits = sizeLimits()) {
  const lc = model.kind === 'LC';
  const result = lc ? layoutLifecycle(model, limits) : layoutFlow(model, limits);
  if (result.oversize) {
    return { issue: oversizeIssue(lc, result, limits) };
  }
  if (result.issue) {
    return { issue: `${result.issue}。${SIZE_DOES_NOT_HELP}` };
  }
  return { html: lc ? lifecycleSvg(model, result, ordinal) : flowSvg(model, result, ordinal) };
}

// ------------------------------------------------------------ page glue

function noteHtml(entryId, reason) {
  return `<p class="dflow-dg-notice">${escapeXml(entryId)} 沒有畫成圖：${escapeXml(reason)}。</p>\n`;
}

// One located subsection -> { before, html } to insert before the token
// `before`, or null when the subsection gets nothing (no table at all, or
// its tables are still the template's, holding only placeholder rows).
// Reading its tables, checking them and drawing all run inside one try, so
// whatever throws becomes this subsection's note. unchecked: the table checks
// failed on this page, so a subsection that would get a picture gets a note.
// limits: the run's size limits.
function subsectionBlock(tokens, located, page, problems, unchecked, limits) {
  if (located.tableIndexes.length === 0) {
    return null;
  }
  const firstTable = tokens[located.tableIndexes[0]];
  let result;
  try {
    const sub = readSubsection(tokens, located, problems);
    result = sub.kind === 'LC' ? lifecycleModel(sub) : flowModel(sub);
    if (result.skip) {
      return null;
    }
    if (result.model) {
      const drawn = unchecked ? { issue: UNCHECKED_ISSUE } : drawDiagram(result.model, page.drawn, limits);
      if (drawn.html) {
        page.drawn += 1;
        return { before: tokens[result.insertAt], html: drawn.html };
      }
      result = drawn;
    }
  } catch (error) {
    result = { issue: `畫圖時發生內部錯誤（${error && error.message ? error.message : error}）` };
  }
  page.notDrawn += 1;
  page.notes.push({ entryId: located.entryId, reason: result.issue });
  return { before: firstTable, html: noteHtml(located.entryId, result.issue) };
}

// `notes` holds one { entryId, reason } per subsection that got a note, in
// page order, so the CLI can say which diagram was not drawn and why.
function newPageState() {
  return { drawn: 0, notDrawn: 0, notes: [] };
}

// Each subsection's picture or note, as { before, html }: placed right before
// the subsection's first recognised table. problems: what lib/table-checks.js
// found on this token list (PROPOSAL-112), read before anything is inserted;
// null when the checks failed, and then no picture is drawn on the page.
// limits: the run's size limits (sizeLimits; the defaults when not given).
function diagramBlocks(tokens, page, problems = [], limits = sizeLimits()) {
  // Locating subsections reads headings only. Should marked's token shape
  // ever change under it (marked is exact-pinned, and the template-row test
  // parses through the same path), the page renders exactly as before rather
  // than failing the run. Each subsection's own work is isolated in
  // subsectionBlock.
  let located;
  try {
    located = locateEntrySubsections(tokens);
  } catch (error) {
    return [];
  }
  const unchecked = problems === null;
  return located.map((sub) => subsectionBlock(tokens, sub, page, unchecked ? [] : problems, unchecked, limits)).filter(Boolean);
}

// Insert every block as its own html block token right before the token it
// names, found by identity, so no insertion moves another; blocks before the
// same token keep their order. The list is changed in place (it carries
// marked's link definitions as a property), and left as is with no block.
function insertBlocks(tokens, blocks) {
  if (blocks.length === 0) {
    return tokens;
  }
  const before = new Map();
  for (const block of blocks) {
    if (!before.has(block.before)) {
      before.set(block.before, []);
    }
    before.get(block.before).push({ type: 'html', block: true, pre: false, raw: '', text: block.html });
  }
  const placed = tokens.flatMap((token) => [...(before.get(token) || []), token]);
  tokens.length = 0;
  for (const token of placed) {
    tokens.push(token);
  }
  return tokens;
}

// marked's processAllTokens hook body on its own: each subsection's picture
// or note inserted before its first recognised table.
function insertDiagrams(tokens, page, problems = [], limits = sizeLimits()) {
  return insertBlocks(tokens, diagramBlocks(tokens, page, problems, limits));
}

// Appended only to pages that carry a diagram or a note. Colours come from
// the page's own custom properties, so dark mode and print follow the page.
// In print a picture never splits, so one that does not fit moves to the
// next page; the heading rules keep its subsection heading moving with it
// instead of being left alone at the foot of the previous page.
const DIAGRAM_CSS = `
.dflow-dg { margin: 16px 0 24px; }
.dflow-dg .dg-scroll {
  max-width: 100%; overflow-x: auto; border: 1px solid var(--line);
  border-radius: 8px; background: var(--surface);
}
.dflow-dg .dg-scroll:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.dflow-dg .dg-svg { display: block; max-width: none; font-family: inherit; }
.dflow-dg text { fill: var(--ink); font-family: inherit; font-weight: 400; letter-spacing: 0; }
.dflow-dg .dg-canvas { fill: var(--surface); }
.dflow-dg .dg-box { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 1.5; }
.dflow-dg .dg-state-label, .dflow-dg .dg-participant-label { font-size: 14px; font-weight: 600; text-anchor: middle; }
.dflow-dg .dg-route { fill: none; stroke: var(--ink); stroke-width: 1.5; stroke-linecap: butt; stroke-linejoin: round; }
.dflow-dg .dg-uncertain { stroke-dasharray: 6 4; }
.dflow-dg .dg-head { fill: var(--ink); stroke: none; stroke-dasharray: none; }
.dflow-dg .dg-start-dot, .dflow-dg .dg-end-dot { fill: var(--ink); stroke: none; }
.dflow-dg .dg-end-ring { fill: var(--surface); stroke: var(--ink); stroke-width: 1.5; }
.dflow-dg .dg-lifeline { fill: none; stroke: var(--soft); stroke-width: 1; }
.dflow-dg .dg-primary { font-size: 14px; }
.dflow-dg .dg-secondary { font-size: 13px; fill: var(--soft); }
.dflow-dg .dg-guard-key { font-size: 12px; fill: var(--soft); }
.dflow-dg .dg-number { font-size: 12px; font-weight: 600; fill: var(--accent); }
.dflow-dg .dg-evidence-box { fill: var(--frame); stroke: var(--line); stroke-width: 1; }
.dflow-dg .dg-evidence-text { font-size: 12px; fill: var(--soft); }
.dflow-dg .dg-legend { margin: 8px 0 0; color: var(--soft); font-size: 12px; line-height: 1.6; }
.dflow-dg .dg-legend > span { display: block; }
.dflow-dg .dg-key { width: 28px; height: 8px; margin-right: 6px; vertical-align: middle; }
.dflow-dg .dg-key-point { height: 12px; }
.dflow-dg .dg-legend code { font-size: 12px; }
.dflow-dg-notice { margin: 12px 0; color: var(--soft); font-size: 14px; }
.dflow-dg .dg-print-note { display: none; }
@media print {
  h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
  .dflow-dg { margin: 8px 0 16px; break-before: avoid; page-break-before: avoid; break-inside: avoid; page-break-inside: avoid; }
  .dflow-dg .dg-scroll { overflow: visible; border: 0; border-radius: 0; }
  .dflow-dg .dg-svg { width: 100%; height: auto; max-width: 100%; max-height: 210mm; }
  .dflow-dg.dg-wide .dg-scroll, .dflow-dg.dg-wide .dg-legend { display: none; }
  .dflow-dg.dg-wide .dg-print-note { display: block; margin: 0; color: var(--soft); font-size: 14px; }
  .dflow-dg.dg-large .dg-scroll, .dflow-dg.dg-large .dg-legend { display: none; }
  .dflow-dg.dg-large .dg-print-note { display: block; margin: 0; color: var(--soft); font-size: 14px; }
}
`;

module.exports = {
  newPageState,
  sizeLimits,
  diagramBlocks,
  insertBlocks,
  insertDiagrams,
  DIAGRAM_CSS,
  // lib/render.js decodes numeric references by the same rule.
  numericReference,
  // Exported for tests: the placeholder rows are locked against the shipped
  // template, the limits and measurements by value, recognition runs on
  // marked tokens, and the geometry is checked on its own.
  TEMPLATE_PLACEHOLDER_ROWS,
  DIAGRAM_LIMITS,
  GEOMETRY,
  DASHED_EVIDENCE,
  findEntrySubsections,
  lifecycleModel,
  flowModel,
  inlineItems,
  textWidth,
  wrapItem,
  wrapField,
  layoutLifecycle,
  layoutFlow,
  drawDiagram
};
