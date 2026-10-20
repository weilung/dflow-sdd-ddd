// Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE.
// Deferred confirmation records (PROPOSAL-115).
//
// Reads the records `references/modify-existing-baseline.md` § Deferred
// confirmation records and § Draft basis and current observations define —
// that file is the contract, and this module implements it: no other syntax.
//
//   - Question: {SPEC-ID}/QNN — target: … — asks: …                 (list item)
//   > Deferred confirmation: {SPEC-ID}/QNN — state: pending — scope: … — assigned to: … — authorized by: … (date)
//   > Provisional: {SPEC-ID}/QNN — answer: … — basis: {kind} - … (date)
//   > Decision: {SPEC-ID}/QNN — outcome: … — answer: … — confirmed by: … (date) — applied to: not-applied with reason: …
//   > Draft basis: {kind} - … (date) — confirmation: [{SPEC-ID}/QNN](…) — observation: {link | same-scenario}   (behavior.md)
//
// A candidate is a paragraph (or a list item's text) with a line that starts,
// leniently, with one of the keywords — any case, a colon or not, after list
// or block-quote markers, indentation or emphasis — and that holds a question
// id outside inline code and HTML comments. Without a question id a line is
// ordinary prose and is never reported. Code blocks, HTML blocks and comments,
// headings and table cells are never candidates. A candidate that is not
// exactly the format — fields, separators, dates, its form, a tab in its line,
// the blank lines around it, its place (its file, its section, after the
// section's table), the record before it, a second definition (every copy is
// reported) — is reported as unreadable and gets no badge. A Draft basis is
// in place only directly under its BR heading: whatever else comes first, the
// scanner does not guess whether it was a scenario.
//
// Input is the page's top-level token list (before anything is inserted into
// it), the line map render builds for the table checks, and the page's file
// name. No page state and no file system. Cell text and record text are never
// part of a problem: a problem names its line, its kind and what is wrong.

const KEYWORDS = ['Question', 'Deferred confirmation', 'Provisional', 'Decision', 'Draft basis'];
// The order the block-quote records of one question follow its Question in.
const GROUP_ORDER = ['Deferred confirmation', 'Provisional', 'Decision'];
const QID_SHAPE = /SPEC-[0-9]{8}-[0-9]{3}\/Q[0-9]{2,}/;
const QID_EXACT = /^SPEC-([0-9]{4})([0-9]{2})([0-9]{2})-[0-9]{3}\/Q[0-9]{2,}$/;
const LEAD = /^[\s>*_+-]*/;
const KEYWORD_LEAD = new RegExp(`^(${KEYWORDS.map((k) => k.replace(' ', '\\s+')).join('|')})(?![A-Za-z])\\s*[:：]?`, 'i');
const KINDS = ['code', 'data', 'document', 'inferred', 'assumed'];
const OUTCOMES = ['unresolved', 'not-applied', 'conflicting'];
const SEP = ' — ';

// Where each kind of question record may sit: the file's name and its `##`
// section. A question about a model sits in any of models.md's sections.
const QUESTION_PLACES = {
  'rules.md': ['Open Questions'],
  'glossary.md': ['Open Questions'],
  'context-map.md': ['Open Questions'],
  'analysis.md': ['Open Questions and Hotspots'],
  'models.md': ['Context', 'Entities', 'Value Objects', 'Domain Services', 'Repository Interfaces', 'Code Mapping Notes'],
  'tech-debt.md': ['Follow-up Notes']
};
// In a section that holds a table, question records go after a table of that
// section. In these sections they always do: a question about a model goes
// after the models.md table that holds the model.
const AFTER_TABLE = {
  'models.md': ['Entities', 'Value Objects', 'Domain Services', 'Repository Interfaces']
};

const FORMATS = {
  Question: '- Question: {SPEC-ID}/QNN — target: {document path and BR-ID / entry ID / term / model / debt Item} — asks: {one question}',
  'Deferred confirmation': '> Deferred confirmation: {SPEC-ID}/QNN — state: pending — scope: {6.2 subject explicitly deferred} — assigned to: {role} — authorized by: {role} ({YYYY-MM-DD})',
  Provisional: '> Provisional: {SPEC-ID}/QNN — answer: {AI\'s provisional answer} — basis: {kind} - {what to open to re-check} ({YYYY-MM-DD})',
  Decision: '> Decision: {SPEC-ID}/QNN — outcome: {unresolved | not-applied | conflicting} — answer: {answer and what remains pending} — confirmed by: {role} ({YYYY-MM-DD}) — applied to: not-applied with reason: {reason and next action}',
  'Draft basis': '> Draft basis: {kind} - {what to open to re-check} ({YYYY-MM-DD}) — confirmation: {question link labelled with SPEC-ID/QNN} — observation: {observation link | same-scenario}'
};

// The section of the contract each kind is defined in.
const CONTRACT_SECTION = {
  'Draft basis': 'Draft basis and current observations'
};
const contractSection = (keyword) => CONTRACT_SECTION[keyword] || 'Deferred confirmation records';

function validDate(y, m, d) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1) return false;
  const days = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function validQid(text) {
  const m = QID_EXACT.exec(text);
  return Boolean(m) && validDate(m[1], m[2], m[3]);
}

// `{payload} ({YYYY-MM-DD})` with a valid date and a non-empty payload.
function datedPayload(text) {
  const m = /^(.*\S) \(([0-9]{4})-([0-9]{2})-([0-9]{2})\)$/.exec(text);
  if (!m) return null;
  return validDate(m[2], m[3], m[4]) ? m[1] : null;
}

// `{kind} - {what} ({date})`.
function basisValue(text) {
  const m = /^([a-z]+) - (.+)$/.exec(text);
  if (!m || !KINDS.includes(m[1])) return 'kind';
  return datedPayload(m[2]) === null ? 'date' : null;
}

// HTML comments and inline code spans blanked out (line breaks kept), so a
// question id or a keyword inside them is not read.
function withoutCodeSpans(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text.replace(/<!--[\s\S]*?-->/g, blank).replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, blank);
}

// A record is its own paragraph: the line before it and the line after it
// are blank, or the edge of the text. `at` is an offset inside its line.
function blankAround(text, at) {
  const blank = (s) => /^[ \t\r]*$/.test(s);
  const start = text.lastIndexOf('\n', at - 1) + 1;
  const newline = text.indexOf('\n', at);
  const end = newline === -1 ? text.length : newline;
  if (start > 0 && !blank(text.slice(text.lastIndexOf('\n', start - 2) + 1, start - 1))) return false;
  if (end < text.length) {
    const next = text.indexOf('\n', end + 1);
    if (!blank(text.slice(end + 1, next === -1 ? text.length : next))) return false;
  }
  return true;
}

// The leaf's text with the ranges a field split must not cut: links, inline
// code, raw HTML. Returns null when the inline tokens do not add up to the
// text (then nothing is protected).
function protectedRanges(leaf) {
  const ranges = [];
  let at = 0;
  for (const t of leaf.tokens || []) {
    const raw = String(t.raw ?? '');
    if (t.type === 'link' || t.type === 'codespan' || t.type === 'html' || t.type === 'image') {
      ranges.push({ start: at, end: at + raw.length, link: t.type === 'link' ? t : null });
    }
    at += raw.length;
  }
  return at === String(leaf.text ?? '').length ? ranges : [];
}

// The text after the keyword's `: ` split on ` — ` outside protected ranges.
function splitFields(text, offset, ranges) {
  const parts = [];
  let from = 0;
  let i = text.indexOf(SEP);
  while (i !== -1) {
    const abs = offset + i;
    const inside = ranges.some((r) => abs < r.end && abs + SEP.length > r.start);
    if (!inside) {
      parts.push({ text: text.slice(from, i), start: offset + from });
      from = i + SEP.length;
    }
    i = text.indexOf(SEP, i + 1);
  }
  parts.push({ text: text.slice(from), start: offset + from });
  return parts;
}

// One labelled field: `{label}: {payload}`, the payload not empty.
function labelled(part, label) {
  const prefix = `${label}: `;
  if (!part.text.startsWith(prefix)) return null;
  const payload = part.text.slice(prefix.length);
  return payload.trim() === '' ? null : { text: payload, start: part.start + prefix.length };
}

function linkAt(ranges, start, length) {
  const r = ranges.find((x) => x.link && x.start === start && x.end === start + length);
  return r ? r.link : null;
}

// Parse the fields of one exactly-keyworded, one-line leaf. Returns
// { qid, outcome? } or { reason }.
function parseFields(keyword, leaf) {
  const text = String(leaf.text);
  const head = `${keyword}: `;
  const ranges = protectedRanges(leaf);
  const parts = splitFields(text.slice(head.length), head.length, ranges);
  const fail = (reason) => ({ reason });
  const fields = (labels) => {
    if (parts.length !== labels.length + 1) return null;
    const out = [];
    for (let k = 0; k < labels.length; k++) {
      const f = labelled(parts[k + 1], labels[k]);
      if (!f) return null;
      out.push(f);
    }
    return out;
  };
  if (keyword === 'Draft basis') {
    const f = fields(['confirmation', 'observation']);
    if (!f || parts[0].text.trim() === '') return fail('fields');
    const basis = basisValue(parts[0].text);
    if (basis) return fail(basis === 'kind' ? 'kind' : 'date');
    const link = linkAt(ranges, f[0].start, f[0].text.length);
    const label = link ? String(link.text ?? '') : '';
    if (!link || !validQid(label)) return fail('confirmation');
    const obs = f[1].text;
    if (obs !== 'same-scenario' && !linkAt(ranges, f[1].start, obs.length)) return fail('observation');
    return { qid: label };
  }
  const qid = parts[0].text;
  if (!validQid(qid)) return fail('qid');
  if (keyword === 'Question') {
    return fields(['target', 'asks']) ? { qid } : fail('fields');
  }
  if (keyword === 'Deferred confirmation') {
    const f = fields(['state', 'scope', 'assigned to', 'authorized by']);
    if (!f) return fail('fields');
    if (f[0].text !== 'pending') return fail('state');
    return datedPayload(f[3].text) === null ? fail('date') : { qid };
  }
  if (keyword === 'Provisional') {
    const f = fields(['answer', 'basis']);
    if (!f) return fail('fields');
    const basis = basisValue(f[1].text);
    return basis ? fail(basis === 'kind' ? 'kind' : 'date') : { qid };
  }
  // Decision
  const f = fields(['outcome', 'answer', 'confirmed by', 'applied to']);
  if (!f) return fail('fields');
  if (!OUTCOMES.includes(f[0].text)) return fail('outcome');
  if (datedPayload(f[2].text) === null) return fail('date');
  const applied = /^not-applied with reason: (.*)$/.exec(f[3].text);
  if (!applied || applied[1].trim() === '') return fail('applied');
  return { qid, outcome: f[0].text };
}

// The keyword a line leads with, leniently (case, colon, markers,
// indentation, emphasis), or null.
function leadKeyword(line) {
  const m = KEYWORD_LEAD.exec(line.replace(LEAD, ''));
  if (!m) return null;
  const said = m[1].replace(/\s+/g, ' ').toLowerCase();
  return KEYWORDS.find((k) => k.toLowerCase() === said) || null;
}

// Where each top-level token starts in the text marked read (the same walk
// lib/table-checks.js does).
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

// Every paragraph-like leaf under one top-level token, with how it is held:
// 'item' (an item of this top-level list), 'quote' (this top-level block
// quote's only paragraph), 'top' (a top-level paragraph) or 'nested'; and
// `line`, the line of the top-level token's raw text where the leaf's own
// block starts, so that its source line is looked up from there and never
// found in an earlier block that holds the same text.
function leavesOf(top) {
  const out = [];
  const NESTED = { kind: 'nested' };
  // The line each child starts on, counted from the top-level token's first
  // line. Taking a container's quote markers or item indentation off keeps
  // its lines one for one, so a line holds at every depth where an offset
  // would not. A child's raw text is searched from its own line on; where it
  // is not found (a paragraph of several quoted lines, say), its line is
  // counted from the children before it.
  const placed = (parentRaw, parentLine, children) => {
    const parent = String(parentRaw);
    const lineStarts = [0];
    for (let i = 0; i < parent.length; i++) if (parent[i] === '\n') lineStarts.push(i + 1);
    let cursor = 0;
    let line = 0;
    return children.map((child) => {
      const raw = String(child.raw ?? '');
      const own = Math.max(cursor, lineStarts[Math.min(line, lineStarts.length - 1)]);
      line += (raw.match(/\n/g) || []).length;
      const at = raw ? parent.indexOf(raw, own) : -1;
      const start = at === -1 ? own : at;
      cursor = at === -1 ? own : at + raw.length;
      return parentLine + (parent.slice(0, start).match(/\n/g) || []).length;
    });
  };
  const visit = (token, holder, line) => {
    if (token.type === 'paragraph' || token.type === 'text') {
      out.push({ leaf: token, holder, line });
      return;
    }
    if (token.type === 'list') {
      const itemLines = placed(token.raw, line, token.items);
      token.items.forEach((item, i) => {
        const blocks = item.tokens.filter((t) => t.type !== 'space');
        const own = token === top && blocks.length === 1 ? { kind: 'item', item, list: token } : NESTED;
        const childLines = placed(item.raw, itemLines[i], item.tokens);
        item.tokens.forEach((t, j) => visit(t, t === blocks[0] ? own : NESTED, childLines[j]));
      });
      return;
    }
    if (token.type === 'blockquote') {
      const blocks = token.tokens.filter((t) => t.type !== 'space');
      const own = token === top && blocks.length === 1 ? { kind: 'quote', quote: token } : NESTED;
      const childLines = placed(token.raw, line, token.tokens);
      token.tokens.forEach((t, j) => visit(t, t === blocks[0] ? own : NESTED, childLines[j]));
    }
    // code, html, table, heading, hr: never a candidate
  };
  visit(top, { kind: 'top' }, 0);
  return out;
}

// The leaf's text with inline code spans and HTML comments blanked out (line
// breaks kept), taken from the inline tokens Markdown actually produced: an
// escaped backtick or `\<!--` is text, not code or a comment. When the
// tokens do not add up to the text, the text is masked by pattern instead.
function maskedText(leaf) {
  const text = String(leaf.text ?? '');
  const ranges = [];
  const walk = (tokens, base) => {
    let at = base;
    for (const t of tokens || []) {
      const raw = String(t.raw ?? '');
      if (t.type === 'codespan' || (t.type === 'html' && /^<!--/.test(raw))) {
        ranges.push([at, at + raw.length]);
      } else if (Array.isArray(t.tokens) && t.tokens.length > 0) {
        let cursor = 0;
        for (const child of t.tokens) {
          const childRaw = String(child.raw ?? '');
          const i = childRaw ? raw.indexOf(childRaw, cursor) : -1;
          if (i === -1) continue;
          walk([child], at + i);
          cursor = i + childRaw.length;
        }
      }
      at += raw.length;
    }
    return at;
  };
  const end = walk(leaf.tokens, 0);
  if (!Array.isArray(leaf.tokens) || end !== text.length) return withoutCodeSpans(text);
  let out = text;
  for (const [a, b] of ranges) out = out.slice(0, a) + out.slice(a, b).replace(/[^\n]/g, ' ') + out.slice(b);
  return out;
}

// A block that holds only an HTML comment: it does not count as content of a
// BR section.
function isCommentBlock(token) {
  return token.type === 'html' && /^\s*<!--[\s\S]*-->\s*$/.test(String(token.raw ?? ''));
}

// The key a second definition of the same record shares with the first.
const recordKey = (record) => `${record.qid} ${record.keyword}`;

// One page: { records, problems, keys }. records: [{ keyword, qid, outcome?,
// line, leaf, top }]; problems: [{ keyword, qid?, line, top, reason }], in
// line order; keys: the key of every Question, Deferred confirmation,
// Provisional and Decision line whose fields read exactly, wherever it sits,
// for counting second definitions. fileName decides where question records
// may sit and whether a Draft basis is read at all (behavior.md only).
function scanRecords(tokens, lineMap, fileName) {
  const records = [];
  const problems = [];
  const keys = [];
  if (!QID_SHAPE.test(lineMap.text)) {
    return { records, problems, keys };
  }
  const starts = tokenStarts(tokens, lineMap.text);
  const isBehavior = fileName === 'behavior.md';
  const places = QUESTION_PLACES[fileName] || [];
  const afterTable = AFTER_TABLE[fileName] || [];
  // The sections (by their `#` or `##` heading; null before the first) that
  // hold a top-level table.
  const withTable = new Set();
  let current = null;
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth <= 2) current = token;
    else if (token.type === 'table') withTable.add(current);
  }
  let section = null;
  let sectionKey = null;
  let tableSeen = false; // a table of this section came before this block
  // Inside a ### BR-… section: how many blocks came before this one, and its
  // Draft basis record. A Draft basis is in place only as the section's first block.
  let brSection = null;
  let group = null; // { qid, next, seen } — the question the next block quote may belong to
  // The source line of the leaf's line `k`, and an offset inside that line,
  // searched from the line the leaf's own block starts on (leavesOf's `line`).
  const locate = (top, leaf, k, leafLine) => {
    let base = starts.has(top) ? starts.get(top) : 0;
    for (let n = 0; n < leafLine; n++) {
      const newline = lineMap.text.indexOf('\n', base);
      if (newline === -1) break;
      base = newline + 1;
    }
    const raw = String(leaf.raw ?? leaf.text ?? '').split('\n');
    // Each line of the leaf is a line of the source, looked for from the start
    // of the line after the one before it. A line Markdown rewrote (inside a
    // list item a tab becomes spaces) is not found as written: it still takes
    // up its own line, and the next one is looked for after it.
    let lineAt = base;
    let at = base;
    for (let i = 0; i <= k && i < raw.length && lineAt !== -1; i++) {
      const piece = raw[i].trim();
      const found = piece ? lineMap.text.indexOf(piece, lineAt) : -1;
      at = found === -1 ? lineAt : found;
      const newline = lineMap.text.indexOf('\n', at);
      lineAt = newline === -1 ? -1 : newline + 1;
    }
    return { line: lineMap.lineOf(at), at };
  };
  const unrecord = (record) => {
    const i = records.indexOf(record);
    if (i === -1) return;
    records.splice(i, 1);
    problems.push({ keyword: record.keyword, qid: record.qid, line: record.line, top: record.top, reason: 'duplicate' });
  };

  for (const top of tokens) {
    if (top.type === 'space') continue;
    if (top.type === 'heading') {
      if (top.depth <= 2) {
        section = top.depth === 2 ? String(top.text).trim() : null;
        sectionKey = top;
        tableSeen = false;
        brSection = null;
      } else if (top.depth === 3) {
        brSection = /^BR-[0-9]+(?![0-9])/.test(String(top.text).trim()) ? { blocks: 0, basis: null } : null;
      } else if (brSection) {
        brSection.blocks += 1;
      }
      group = null;
      continue;
    }
    if (top.type === 'table') tableSeen = true;
    let groupKept = false;
    for (const { leaf, holder, line: leafLine } of leavesOf(top)) {
      const text = String(leaf.text ?? '');
      const masked = maskedText(leaf);
      const lines = masked.split('\n');
      // A candidate is a line that starts with a keyword and holds a question
      // id itself: an id on another line of the same paragraph does not count.
      const keywordLines = lines.map(leadKeyword);
      const counts = (k, i) => k && (k !== 'Draft basis' || isBehavior) && QID_SHAPE.test(lines[i]);
      const keywordLine = keywordLines.findIndex(counts);
      if (keywordLine === -1) continue;
      const keyword = keywordLines[keywordLine];
      const { line, at } = locate(top, leaf, keywordLine, leafLine);
      const problem = (reason, qid) => problems.push({ keyword, qid, line, top, reason });
      if (lines.length > 1) { problem('lines'); continue; }
      if (!text.startsWith(`${keyword}: `)) { problem('keyword'); continue; }
      const parsed = parseFields(keyword, leaf);
      if (!parsed.reason && keyword !== 'Draft basis') keys.push(recordKey({ qid: parsed.qid, keyword }));
      if (holder.kind !== (keyword === 'Question' ? 'item' : 'quote')) { problem('form'); continue; }
      const quoteOfGroup = keyword !== 'Question' && keyword !== 'Draft basis';
      // The line as written, not as Markdown hands it over: inside a list item
      // a tab becomes spaces, so a tab where the format has a space would read
      // as the format. A record line holds no tab.
      const written = String(keyword === 'Question' ? holder.item.raw : holder.quote.raw).split('\n')[0];
      if (written.includes('\t')) { problem('tab'); if (quoteOfGroup) groupKept = true; continue; }
      if (!written.startsWith(keyword === 'Question' ? '- Question: ' : '> ')) { problem('form'); continue; }
      if (!blankAround(lineMap.text, at)) { problem('blank'); if (quoteOfGroup) groupKept = true; continue; }
      if (parsed.reason) { problem(parsed.reason); if (quoteOfGroup) groupKept = true; continue; }
      const { qid } = parsed;
      if (keyword === 'Draft basis') {
        if (brSection && brSection.basis) { unrecord(brSection.basis); problem('duplicate', qid); continue; }
        if (!brSection || brSection.blocks > 0) { problem('place', qid); continue; }
        brSection.basis = { keyword, qid, line, leaf, top };
        records.push(brSection.basis);
        continue;
      }
      if (!places.includes(section)) { problem('place', qid); continue; }
      if ((afterTable.includes(section) || withTable.has(sectionKey)) && !tableSeen) { problem('table', qid); continue; }
      if (keyword === 'Question') {
        records.push({ keyword, qid, line, leaf, top });
        const items = holder.list.items;
        if (holder.item === items[items.length - 1]) {
          group = { qid, next: 0, seen: new Set() };
          groupKept = true;
        }
        continue;
      }
      const order = GROUP_ORDER.indexOf(keyword);
      if (group && group.qid === qid && group.seen.has(keyword)) { problem('duplicate', qid); groupKept = true; continue; }
      if (!group || group.qid !== qid || order < group.next) { problem('orphan', qid); continue; }
      group.next = order + 1;
      group.seen.add(keyword);
      groupKept = true;
      records.push({ keyword, qid, outcome: parsed.outcome, line, leaf, top });
    }
    if (brSection && !isCommentBlock(top)) {
      brSection.blocks += 1;
    }
    if (!groupKept) {
      group = null;
    }
  }
  problems.sort((a, b) => a.line - b.line);
  return { records, problems, keys };
}

// Records defined more than once move to problems: a second definition makes
// every copy unreadable. `duplicates` is the set of keys counted over the
// whole tree; the page's own keys are counted here as well.
function withDuplicates(result, duplicates) {
  const own = new Map();
  for (const key of result.keys || []) own.set(key, (own.get(key) || 0) + 1);
  const twice = (key) => (duplicates && duplicates.has(key)) || (own.get(key) || 0) > 1;
  const records = [];
  const problems = [...result.problems];
  for (const r of result.records) {
    if (r.keyword !== 'Draft basis' && twice(recordKey(r))) {
      problems.push({ keyword: r.keyword, qid: r.qid, line: r.line, top: r.top, reason: 'duplicate' });
    } else {
      records.push(r);
    }
  }
  problems.sort((a, b) => a.line - b.line);
  return { records, problems, keys: result.keys || [] };
}

const REASONS = {
  lines: '一筆紀錄要自成一段、只有一行，前後各空一行：這一段有不只一行（常見原因是兩筆紀錄之間少了空行）',
  blank: '一筆紀錄要自成一段，前後各空一行：這一行的上一行或下一行不是空行（例如兩筆紀錄寫在相鄰的兩行，或緊貼著標題、表格或別的段落）',
  keyword: '開頭的關鍵字要照格式寫：大小寫一樣、後面接冒號與一個空格，前面不加縮排、粗體或其他符號',
  form: null, // by keyword
  qid: '題號要寫成 SPEC-YYYYMMDD-NNN/QNN：日期有效、題號至少兩位',
  fields: '欄位不對：欄位名稱、順序與分隔符「 — 」都要照格式，每一欄都不能空，欄位內容裡也不能有「 — 」',
  date: '日期要寫成有效的 (YYYY-MM-DD)，放在那一欄的最後',
  kind: '依據的種類只能是 code、data、document、inferred、assumed 其中之一，後面接「 - 」',
  state: 'state 只能是 pending：這種紀錄只在題目還沒答完時存在',
  outcome: 'outcome 只能是 unresolved、not-applied、conflicting 其中之一',
  applied: 'applied to 要寫成「not-applied with reason: 」再接原因與下一步',
  confirmation: 'confirmation 要是一個連結，連結文字就是題號（SPEC-YYYYMMDD-NNN/QNN）',
  observation: 'observation 要是一個連結，或寫 same-scenario',
  orphan: '要直接接在同一題的 Question（清單最後一項）或同一題前一筆紀錄後面，中間只能有空行，依 Deferred confirmation、Provisional、Decision 的順序，每種最多一筆',
  tab: '紀錄那一行不能有 Tab：冒號後面、分隔符「 — 」前後與欄位內容都用一般空格（清單裡的 Tab 會被 Markdown 換成空格，讀到的就跟原文不同）',
  table: '這一筆要放在表格之後：有題目表格的段落（例如 analysis.md 的 HS 表格），紀錄接在表格後面；models.md 的 Entities、Value Objects、Domain Services、Repository Interfaces，題目放在那個模型所在的表格後面',
  duplicate: null, // by keyword
  place: null // by keyword
};

function reasonText(problem) {
  const k = problem.keyword;
  if (problem.reason === 'form') {
    return k === 'Question'
      ? 'Question 要寫成最外層清單的一項（- Question: …），那一項底下不再接別的區塊'
      : `${k} 要寫成最外層的引用段落（> ${k}: …），那一段只有這一行`;
  }
  if (problem.reason === 'duplicate') {
    return k === 'Draft basis'
      ? '一個 BR 只放一行 Draft basis'
      : `同一題（${problem.qid}）的 ${k} 不只一筆`;
  }
  if (problem.reason === 'place') {
    return k === 'Draft basis'
      ? 'Draft basis 只放在 behavior.md 的 ### BR-NNN 標題正下方：標題與它之間只有空行，它在那個 BR 段落的其他內容（包括第一個 Given/When/Then）之前'
      : '這個檔或這一節不放待確認紀錄：它們放在 rules.md、glossary.md、context-map.md 的 ## Open Questions，analysis.md 的 ## Open Questions and Hotspots，models.md 的各節，tech-debt.md 的 ## Follow-up Notes';
  }
  return REASONS[problem.reason];
}

const PUBLIC_PAGE = 'https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/baseline-deferred-confirmation.md';
const LOCAL_CONTRACT = 'shared/dflow-workflows/references/modify-existing-baseline.md';

// The whole message for one problem: what is wrong, the expected format, and
// how to handle it — pointing at the local contract when the specs tree has
// the brownfield workflow bundle (localContract: its path as the reader finds
// it, under the --src they gave), at the public page otherwise.
function problemMessage(problem, localContract) {
  const k = problem.keyword;
  const where = localContract
    ? `對照 ${localContract} § ${contractSection(k)}`
    : `對照公開說明頁 ${PUBLIC_PAGE}（這份 specs 裡沒有 brownfield 的 baseline 分支檔）`;
  return `確認紀錄格式讀不準：${reasonText(problem)}。預期格式：${FORMATS[k]}。` +
    `處理方式：開啟此行及相鄰問題，${where}；保留答案與證據，改寫為標準格式；` +
    '若只是普通散文，移除題號或開頭的關鍵字。處理前不要依此判定已確認。';
}

module.exports = {
  scanRecords,
  withDuplicates,
  recordKey,
  problemMessage,
  LOCAL_CONTRACT,
  PUBLIC_PAGE,
  // Exported for tests.
  FORMATS,
  validQid
};
