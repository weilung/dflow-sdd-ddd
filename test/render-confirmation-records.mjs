// Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE.
// dflow render — deferred confirmation records (PROPOSAL-115, lib/confirmation-records.js).
//
// The format is the one `references/modify-existing-baseline.md` § Deferred
// confirmation records and § Draft basis and current observations define; the
// records below are copied from that contract, not invented here. Covered: each
// record read exactly gets its badge and the page its summary line; a line that
// looks like a record (a keyword, leniently, and a question id) but is not the
// format keeps its text, gets a notice with its source line and the fix, and no
// badge; a line without a question id, and anything in code, HTML comments or
// inline code, is never read; a second definition anywhere in the tree; the fix
// pointing at the local contract or, without the brownfield bundle, the public
// page; stdout; HTML escaping; and the shipped workflow files themselves, whose
// examples must never be read as records.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import render from '../lib/render.js';
import records from '../lib/confirmation-records.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dflowBin = join(repoRoot, 'bin', 'dflow.js');
const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-render-records-'));
const { Marked } = await import('marked');

const page = (fileName, source, opts = {}) => render.convertMarkdown({ MarkedCtor: Marked, source, fileName, tableView: 'cards', records: opts });
const badges = (html) => [...html.matchAll(/<span class="badge (\w+)">([^<]*)<\/span>/g)].map((m) => `${m[1]}:${m[2]}`);
const unescape = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const notices = (html) => [...html.matchAll(/<p class="dflow-rec-notice">([^<]*)<\/p>/g)].map((m) => unescape(m[1]));
const summary = (html) => (/<p class="dflow-rec-summary">([^<]*)<\/p>/.exec(html) || [])[1] || null;

function runRenderCli(cwd, args) {
  const result = spawnSync(process.execPath, [dflowBin, 'render', ...args], { cwd, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}
async function put(root, rel, text) {
  const p = join(root, ...rel.split('/'));
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, text, 'utf8');
}

const Q = 'SPEC-20261016-001/Q01';
const QUESTION = `- Question: ${Q} — target: domain/billing/rules.md BR-003 — asks: Is an invoice number required on every save?`;
const DEFERRED = `> Deferred confirmation: ${Q} — state: pending — scope: Business rules — assigned to: Finance lead — authorized by: Dev lead (2026-10-16)`;
const PROVISIONAL = `> Provisional: ${Q} — answer: Yes, on Create and Edit — basis: code - ReceiptsController.Create and Edit (2026-10-16)`;
const DECISION = `> Decision: ${Q} — outcome: unresolved — answer: cannot confirm yet; the auditor decides — confirmed by: Finance lead (2026-10-17) — applied to: not-applied with reason: ask the auditor, then apply`;
const rulesPage = (...blocks) => `# Business Rules\n\n## Rule Index\n\nIndex text.\n\n## Open Questions\n\n${blocks.join('\n\n')}\n`;
const BASIS = `> Draft basis: inferred - Review.cshtml shows Submit only for draft; Submit handler has no status guard (2026-10-16) — confirmation: [${Q}](./rules.md#open-questions) — observation: [Submission entry observation](#submission-entry-observation)`;
const behaviorPage = (...blocks) => `# Billing — Behavior\n\n## Receipts\n\n### BR-003: Invoice number\n\n${blocks.join('\n\n')}\n\nGiven a receipt\nWhen it is saved\nThen it has an invoice number\n\n### Submission entry observation\n\nThe page shows Submit only for draft.\n`;

// --- the contract's own examples parse: the format here is the canonical one --
{
  const contract = await readFile(join(repoRoot, 'templates/brownfield/references/modify-existing-baseline.md'), 'utf8');
  for (const line of [QUESTION, DEFERRED, PROVISIONAL, DECISION, BASIS]) {
    const keyword = /^[-> ]*([A-Z][a-z]+(?: [a-z]+)?):/.exec(line)[1];
    assert.ok(contract.includes(records.FORMATS[keyword]), `the renderer's expected format for ${keyword} is the contract's own line`);
  }
}

// --- records read exactly: badges, the summary, nothing else ------------------
{
  const p = page('rules.md', rulesPage(QUESTION, DEFERRED, PROVISIONAL, DECISION));
  assert.deepEqual(badges(p.html), ['info:待確認題目', 'warn:待確認', 'warn:AI 暫定・不是確認', 'warn:答覆已記錄・尚未套用（unresolved）'], 'one badge per record, none green');
  assert.deepEqual(notices(p.html), [], 'a record read exactly gets no notice');
  assert.match(summary(p.html), /^確認紀錄：待確認題目 1 題（其中 AI 暫定 1 筆、答覆已記錄但尚未套用 1 筆）、draft 依據 0 條。/);
  assert.match(summary(p.html), /標示只代表讀到這個格式，不代表角色、授權、程式或規則已經查證；沒有標示，也不代表沒有待確認的事。$/, 'the summary says what a badge does not prove');
  assert.ok(p.html.includes('Yes, on Create and Edit'), 'the record text stays as written');
  assert.equal(p.records.length, 4);
  assert.deepEqual(p.recordProblems, []);
}
{
  const p = page('behavior.md', behaviorPage(BASIS));
  assert.deepEqual(badges(p.html), ['neutral:draft 依據・未確認'], 'a Draft basis gets its badge');
  assert.ok(p.html.includes('<a href="./rules.html#open-questions">SPEC-20261016-001/Q01</a>'), 'the confirmation link is still a link, rewritten like any .md link');
  assert.ok(p.html.includes('<a href="#submission-entry-observation">Submission entry observation</a>'), 'the observation link is kept');
}
// Every place a question record may sit.
const MODEL_TABLE = '| Entity | Description |\n|---|---|\n| Invoice | A bill for one period |';
const HS_TABLE = '| ID | Hotspot | Evidence |\n|---|---|---|\n| HS-01 | Invoice totals | code - InvoiceService (2026-10-16) |';
for (const [fileName, heading, before] of [
  ['glossary.md', 'Open Questions'], ['context-map.md', 'Open Questions'], ['analysis.md', 'Open Questions and Hotspots'],
  ['analysis.md', 'Open Questions and Hotspots', HS_TABLE], ['models.md', 'Entities', MODEL_TABLE],
  ['models.md', 'Context', 'Invoice is billed once a month.'], ['models.md', 'Code Mapping Notes'], ['tech-debt.md', 'Follow-up Notes']
]) {
  const p = page(fileName, `# Doc\n\n## ${heading}\n\n${before ? `${before}\n\n` : ''}${QUESTION}\n\n${DEFERRED}\n`);
  assert.deepEqual(p.recordProblems, [], `${fileName} § ${heading} holds question records`);
  assert.equal(p.records.length, 2);
}
// After the table: in a section that holds one, and in models.md's four table sections always.
for (const [fileName, source, why] of [
  ['analysis.md', `# A\n\n## Open Questions and Hotspots\n\n${QUESTION}\n\n${DEFERRED}\n\n${HS_TABLE}\n`, 'before the section\'s question table'],
  ['models.md', `# M\n\n## Entities\n\n${QUESTION}\n\n${DEFERRED}\n\n${MODEL_TABLE}\n`, 'before the table that holds the model'],
  ['models.md', `# M\n\n## Entities\n\n${MODEL_TABLE}\n\n## Value Objects\n\n${QUESTION}\n\n${DEFERRED}\n`, 'in a table section with no table of its own']
]) {
  const p = page(fileName, source);
  assert.deepEqual(p.recordProblems.map((x) => x.reason), ['table', 'table'], `${fileName}: ${why}`);
  assert.deepEqual(badges(p.html), [], `${fileName}: ${why} gets no badge`);
  assert.ok(notices(p.html)[0].includes('這一筆要放在表格之後'), 'the notice says where the record goes');
}

// --- a page with no record renders exactly as before --------------------------
{
  const plain = rulesPage('- {需要 domain expert 確認的規則}', 'Decision: whether invoices may be cancelled is still an open question.', 'Provisional: the team thinks yes.');
  assert.equal(page('rules.md', plain).html, page('rules.md', plain, { check: false }).html, 'no question id: byte-identical to a render without the scan');
  assert.equal(summary(page('rules.md', plain).html), null, 'no summary line without a record');
}

// --- not read: no question id, code, comments, inline code --------------------
{
  const p = page('rules.md', rulesPage(
    'Decision: whether invoices may be cancelled is still an open question.',
    'Provisional: maybe, see the 2026 audit.',
    '```text\n> Decision: SPEC-20261016-001/Q09 — outcome: wrong\n```',
    '    > Provisional: SPEC-20261016-001/Q09 — answer: indented code',
    '<!-- > Decision: SPEC-20261016-001/Q09 — outcome: commented out -->',
    '`> Decision: SPEC-20261016-001/Q09 — outcome: x` is how a Decision looks.',
    'Decision: see `SPEC-20261016-001/Q09` for the example.',
    '- Question: <!-- SPEC-20261016-001/Q09 --> — target: domain/x — asks: is this a comment?'
  ));
  assert.deepEqual(p.recordProblems, [], `none of these is a candidate: ${JSON.stringify(p.recordProblems.map((x) => x.line))}`);
  assert.deepEqual(badges(p.html), []);
}

// --- near misses with a question id: always reported, never a badge -----------
const reportedAs = (fileName, source, reason) => {
  const p = page(fileName, source);
  assert.equal(p.recordProblems.length, 1, `${reason}: one problem (got ${JSON.stringify(p.recordProblems.map((x) => x.reason))})`);
  assert.equal(p.recordProblems[0].reason, reason);
  assert.equal(badges(p.html).length, p.records.length, 'only the records read exactly get a badge: the unreadable line gets none');
  assert.match(summary(p.html), /1 行確認紀錄格式讀不準，列為未判定/, 'the summary lists it as undetermined');
  assert.equal(notices(p.html).length, 1);
  return p;
};
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('Deferred confirmation:', 'deferred confirmation:')), 'keyword');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('Deferred confirmation:', 'Deferred confirmation')), 'keyword');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('> Deferred', '> **Deferred').replace('confirmation:', 'confirmation:**')), 'keyword');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace(' — assigned to:', ' - assigned to:')), 'fields');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace(' — scope: Business rules', '')), 'fields');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('assigned to: Finance lead', 'assigned to: ')), 'fields');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('(2026-10-16)', '(2026-02-30)')), 'date');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('(2026-10-16)', '2026-10-16')), 'date');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('state: pending', 'state: done')), 'state');
reportedAs('rules.md', rulesPage(QUESTION, PROVISIONAL.replace('basis: code', 'basis: guess')), 'kind');
reportedAs('rules.md', rulesPage(QUESTION, DECISION.replace('outcome: unresolved', 'outcome: applied')), 'outcome');
reportedAs('rules.md', rulesPage(QUESTION, DECISION.replace('not-applied with reason: ', 'pending: ')), 'applied');
reportedAs('rules.md', rulesPage(QUESTION.replace(Q, 'SPEC-20261316-001/Q01')), 'qid');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace(`${Q} —`, 'SPEC-20261016-001/Q1 — SPEC-20261016-001/Q01 —')), 'qid');
// Form: a Question that is not a top-level `- ` item, a record that is not a top-level block quote.
reportedAs('rules.md', rulesPage(QUESTION.replace('- Question', '> Question')), 'form');
reportedAs('rules.md', rulesPage(QUESTION.replace('- Question', '* Question')), 'form');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('> Deferred', '- Deferred')), 'form');
// A record indented under the Question's item: both lines are out of form.
assert.deepEqual(page('rules.md', rulesPage(`${QUESTION}\n\n  ${DEFERRED}`)).recordProblems.map((x) => [x.keyword, x.reason]),
  [['Question', 'form'], ['Deferred confirmation', 'form']]);
// One record per paragraph: two lines with no blank line between them.
reportedAs('rules.md', rulesPage(QUESTION, `${DEFERRED}\n${PROVISIONAL}`), 'lines');
// A tab anywhere in a record line, also where Markdown turns it into the one space the format has
// (here, after a separator inside the list item).
reportedAs('rules.md', rulesPage(QUESTION.replace(' — target:', ' —\ttarget:')), 'tab');
reportedAs('rules.md', rulesPage(QUESTION.replace('asks: Is an', 'asks: Is\tan')), 'tab');
reportedAs('rules.md', rulesPage(QUESTION, DEFERRED.replace('scope: Business', 'scope:\tBusiness')), 'tab');
assert.deepEqual(page('rules.md', rulesPage(`${QUESTION}   `)).recordProblems, [], 'spaces at the end of a Question line are not part of it');
// A line before it in the same list item that Markdown rewrote (a tab): the notice still names the record's line.
assert.equal(reportedAs('rules.md', rulesPage(`- Intro:\tfoo\n  ${DECISION.slice(2)}`), 'lines').recordProblems[0].line, 10,
  'the line of the Decision, not of the rewritten line before it');
// Place: outside the section, in a document that holds none, a Draft basis out of its BR section.
reportedAs('rules.md', `# Business Rules\n\n## Rule Index\n\n${QUESTION}\n`, 'place');
reportedAs('behavior.md', behaviorPage(BASIS).replace('## Receipts', `## Receipts\n\n${QUESTION}`), 'place');
reportedAs('_index.md', `# Feature\n\n## Goals & Scope\n\n${QUESTION}\n`, 'place');
reportedAs('behavior.md', behaviorPage().replace('Then it has an invoice number', `Then it has an invoice number\n\n${BASIS}`), 'place');
reportedAs('behavior.md', `# B\n\n## Area\n\n${BASIS}\n`, 'place');
// A second Draft basis in one BR section: every copy is unreadable, none keeps a badge.
{
  const p = page('behavior.md', behaviorPage(BASIS, BASIS));
  assert.deepEqual(p.recordProblems.map((x) => x.reason), ['duplicate', 'duplicate']);
  assert.deepEqual(badges(p.html), []);
}
// A Draft basis sits directly under its BR heading: after any other block of the section it is out of
// place, whatever that block is — the scanner does not guess whether it was a scenario.
for (const before of ['**Given** a receipt', 'A receipt needs an invoice number.', '- Given a receipt', '假設 一張收據']) {
  reportedAs('behavior.md', behaviorPage().replace('### BR-003: Invoice number\n\n', `### BR-003: Invoice number\n\n${before}\n\n${BASIS}\n\n`), 'place');
}
assert.deepEqual(page('behavior.md', behaviorPage('<!-- note -->', BASIS)).recordProblems, [], 'an HTML comment before it is not content of the section');
// Draft basis: its confirmation must be a link labelled with the question id; observation a link or same-scenario.
reportedAs('behavior.md', behaviorPage(BASIS.replace(`[${Q}](./rules.md#open-questions)`, Q)), 'confirmation');
reportedAs('behavior.md', behaviorPage(BASIS.replace('[Submission entry observation](#submission-entry-observation)', 'see below')), 'observation');
// The record before it: no Question, another question's, the wrong order, a gap.
reportedAs('rules.md', rulesPage(DEFERRED), 'orphan');
reportedAs('rules.md', rulesPage(QUESTION, DECISION, PROVISIONAL), 'orphan');
reportedAs('rules.md', rulesPage(QUESTION, 'An ordinary paragraph.', DEFERRED), 'orphan');
reportedAs('rules.md', rulesPage(QUESTION.replace('Q01', 'Q02'), DEFERRED), 'orphan');
assert.deepEqual(page('rules.md', rulesPage(`${QUESTION}\n- another bullet`, DEFERRED)).recordProblems.map((x) => x.reason), ['blank', 'orphan']);
// Blank lines around every record: items of a tight list, a record on the line after its Question.
{
  const tight = page('rules.md', rulesPage(`${QUESTION}\n${QUESTION.replace('Q01', 'Q02')}`));
  assert.deepEqual(tight.recordProblems.map((x) => x.reason), ['blank', 'blank'], 'two records on adjacent lines');
  assert.deepEqual(badges(tight.html), []);
  assert.deepEqual(page('rules.md', rulesPage(`${QUESTION}\n${DEFERRED}`)).recordProblems.map((x) => x.reason), ['blank', 'blank']);
  assert.deepEqual(page('rules.md', `# R\n\n## Open Questions\n${QUESTION}\n`).recordProblems.map((x) => x.reason), ['blank'], 'directly under a heading');
  const loose = page('rules.md', rulesPage(`${QUESTION}\n\n${QUESTION.replace('Q01', 'Q02')}`));
  assert.deepEqual(loose.recordProblems, [], 'items of one list separated by a blank line are two records');
  assert.equal(loose.records.length, 2);
}
// A second record of the same kind after the first, in one question's group: both copies are reported.
{
  const p = page('rules.md', rulesPage(QUESTION, DEFERRED, DEFERRED));
  assert.deepEqual(p.recordProblems.map((x) => [x.keyword, x.reason]), [['Deferred confirmation', 'duplicate'], ['Deferred confirmation', 'duplicate']]);
  assert.deepEqual(badges(p.html), ['info:待確認題目']);
  const later = page('rules.md', rulesPage(QUESTION, DEFERRED, PROVISIONAL, PROVISIONAL.replace('Yes, on', 'No, on')));
  assert.deepEqual(later.recordProblems.map((x) => x.reason), ['duplicate', 'duplicate']);
  assert.deepEqual(badges(later.html), ['info:待確認題目', 'warn:待確認']);
}
// Each record is looked up at its own place: the same text earlier in the list is not where it is.
{
  const intro = QUESTION.replace('- Question:', '- Intro: Question:');
  const tight = page('rules.md', rulesPage(`${intro}\n\n${QUESTION}\n- ordinary item`));
  assert.deepEqual(tight.recordProblems.map((x) => x.reason), ['blank'], 'the Question itself has no blank line after it');
  assert.deepEqual(badges(tight.html), []);
  const separated = page('rules.md', rulesPage(`${intro}\n- ordinary item`, QUESTION));
  assert.deepEqual(separated.recordProblems, [], 'a Question with its blank lines is read, though the same text sits in a tight item above');
  const twice = page('rules.md', rulesPage(QUESTION, QUESTION));
  const lines = twice.recordProblems.map((x) => x.line);
  assert.equal(new Set(lines).size, 2, `each copy names its own line: ${lines}`);
}
// A paragraph of several quoted lines that holds the same text earlier does not
// take a later record's place: the notice names the record's own line. A keyword
// with its question id on another line of the paragraph is ordinary text.
{
  const quoted = page('rules.md', rulesPage(`> Intro: ${DECISION.slice(2)}\n> another line\n>\n${DECISION}`));
  assert.deepEqual(quoted.recordProblems.map((x) => [x.keyword, x.reason, x.line]), [['Decision', 'form', 12]],
    'the record in the second paragraph of the quote is reported on its own line');
  const apart = page('rules.md', rulesPage(`Decision: ordinary prose.\nSee ${Q} for context.`));
  assert.deepEqual(apart.recordProblems, [], 'a keyword and a question id on different lines of a paragraph are ordinary text');
  const wrapped = page('rules.md', rulesPage(DECISION.replace(' — answer:', '\n> — answer:')));
  assert.deepEqual(wrapped.recordProblems.map((x) => [x.reason, x.line]), [['lines', 9]], 'a record whose own line holds the id is still read when it wraps');
  // Three levels of quote markers in front of 150 lines: a record's line is
  // counted, not taken from an offset in text with its markers removed.
  const deep = [...Array(150).fill('> > > x'), `> > > Intro: ${DECISION.slice(2)}`, '> > > another line', '> > >', `> > ${DECISION}`].join('\n');
  assert.deepEqual(page('rules.md', rulesPage(deep)).recordProblems.map((x) => [x.keyword, x.reason, x.line]), [['Decision', 'form', 162]],
    'the record after a long nested quote is reported on its own line');
}
// Escaped backticks or an escaped comment opener are text: the question id behind them is read.
for (const [name, line] of [
  ['escaped backticks', DECISION.replace(`${Q} —`, `\\\`${Q}\\\` —`)],
  ['escaped comment', DECISION.replace(`${Q} —`, `\\<!-- ${Q} --> —`)]
]) {
  const p = page('rules.md', rulesPage(QUESTION, line));
  assert.deepEqual(p.recordProblems.map((x) => [x.keyword, x.reason]), [['Decision', 'qid']], name);
}
// Real code and comments inside emphasis or with a backtick inside the span stay unread.
assert.deepEqual(page('rules.md', rulesPage(`Decision: see **\`${Q}\`** here.`, `Decision: see \`\`a \` ${Q}\`\` here.`)).recordProblems, []);
// The line reported is the record's own line, not the first line of its paragraph.
{
  const source = `---\nstatus: draft\n---\n${rulesPage(`Ordinary intro.\n${DECISION.slice(2)}`)}`;
  const p = page('rules.md', source);
  assert.deepEqual(p.recordProblems.map((x) => [x.reason, x.line]), [['lines', source.split('\n').findIndex((l) => l.startsWith('Decision:')) + 1]]);
}
// A Draft basis is read only in behavior.md; elsewhere a Draft basis line is ordinary text.
assert.deepEqual(page('rules.md', rulesPage(BASIS)).recordProblems, [], 'a Draft basis outside behavior.md is not a candidate');
// A Draft basis without a question id is ordinary text even in behavior.md.
assert.deepEqual(page('behavior.md', behaviorPage('> Draft basis: we think so.')).recordProblems, []);

// --- a link is read as a token: a separator or parentheses inside it do not split a field --
{
  const p = page('rules.md', rulesPage(QUESTION.replace('asks: Is', 'asks: See [rule — text (v2)](./x.md#a) — is')));
  assert.equal(p.recordProblems.length, 1, 'a bare separator outside the link still splits');
  const ok = page('rules.md', rulesPage(QUESTION.replace('asks: Is', 'asks: See [rule — text (v2)](./x.md#a); is')));
  assert.deepEqual(ok.recordProblems, [], 'a separator inside a link does not split the field');
}

// --- HTML characters stay text; the scan changes nothing but the badge and the summary --
{
  const source = rulesPage(QUESTION.replace('Is an invoice', 'Is a < b & c, and an invoice'), DEFERRED);
  const p = page('rules.md', source);
  assert.ok(p.html.includes('Is a &lt; b &amp; c, and an invoice'), 'text characters are escaped as on any page');
  const stripped = p.html.replace(/<span class="badge \w+">[^<]*<\/span> /g, '').replace(/<p class="dflow-rec-summary">[^<]*<\/p>\n/, '');
  assert.equal(stripped, page('rules.md', source, { check: false }).html, 'without its badges and summary the page is the one rendered without the scan');
  const bad = page('rules.md', rulesPage(QUESTION, DEFERRED.replace('state: pending', 'state: <b>x</b>')));
  assert.equal(bad.recordProblems.length, 1);
  assert.ok(!notices(bad.html)[0].includes('<b>') && !notices(bad.html)[0].includes('&lt;b&gt;'), "a notice never carries the line's text");
}

// --- the notice: source line, the fix, the local contract or the public page ----
{
  const source = `---\nstatus: draft\n---\n${rulesPage(QUESTION, DEFERRED.replace('(2026-10-16)', '(2026-13-01)'))}`;
  const local = page('rules.md', source, { localContract: 'dflow/specs/shared/dflow-workflows/references/modify-existing-baseline.md' });
  const line = source.split('\n').findIndex((l) => l.startsWith('> Deferred')) + 1;
  assert.equal(local.recordProblems[0].line, line, 'the line counts from the file\'s first line, frontmatter included');
  const text = notices(local.html)[0];
  assert.ok(text.startsWith(`原始檔第 ${line} 行：確認紀錄格式讀不準：`), text);
  assert.ok(text.includes('對照 dflow/specs/shared/dflow-workflows/references/modify-existing-baseline.md § Deferred confirmation records'), 'the local contract and its section');
  assert.ok(text.includes('保留答案與證據，改寫為標準格式；若只是普通散文，移除題號或開頭的關鍵字。處理前不要依此判定已確認。'), 'the fix');
  assert.ok(text.includes(`預期格式：${records.FORMATS['Deferred confirmation']}`), 'the expected format of that record');
  const remote = notices(page('rules.md', source, { localContract: null }).html)[0];
  assert.ok(remote.includes(`對照公開說明頁 ${records.PUBLIC_PAGE}`), 'without the brownfield bundle: the public page');
  assert.ok(!remote.includes('dflow-workflows/references'), 'no pointer at a local file that is not there');
  const basisNotice = notices(page('behavior.md', behaviorPage(BASIS, BASIS), { localContract: 'dflow/specs/shared/dflow-workflows/references/modify-existing-baseline.md' }).html)[0];
  assert.ok(basisNotice.includes('§ Draft basis and current observations'), 'a Draft basis points at its own section');
}

// --- a second definition anywhere in the tree: every copy is unreadable ---------
{
  const dup = new Set([records.recordKey({ qid: Q, keyword: 'Deferred confirmation' })]);
  const p = page('rules.md', rulesPage(QUESTION, DEFERRED), { duplicates: dup });
  assert.deepEqual(p.recordProblems.map((x) => x.reason), ['duplicate']);
  assert.deepEqual(badges(p.html), ['info:待確認題目'], 'the duplicated record loses its badge; its Question keeps one');
}

// --- end to end: stdout, the tree-wide count, and a page without records ----------
{
  const proj = join(tempRoot, 'e2e');
  await put(proj, 'specs/domain/billing/rules.md', rulesPage(QUESTION, DEFERRED, PROVISIONAL));
  await put(proj, 'specs/domain/billing/analysis.md', `# A\n\n## Open Questions and Hotspots\n\n${QUESTION}\n`);
  await put(proj, 'specs/domain/billing/behavior.md', behaviorPage(BASIS));
  await put(proj, 'specs/domain/other/rules.md', '# R\n\n## Open Questions\n\n- nothing pending\n');
  const run = runRenderCli(proj, ['--src', 'specs', '--out', 'out']);
  assert.equal(run.code, 0, 'unreadable records never change the exit code');
  const lines = run.stdout.split('\n');
  const head = lines.findIndex((l) => l.startsWith('confirmation records:'));
  assert.equal(lines[head], 'confirmation records: 0 pending questions (1 with an AI provisional answer, 0 with an answer not applied yet), 1 draft basis, 2 unreadable');
  assert.match(lines[head + 1], /^ {2}unreadable: domain\/billing\/analysis\.md:5 — 確認紀錄格式讀不準：同一題（SPEC-20261016-001\/Q01）的 Question 不只一筆。/);
  assert.match(lines[head + 2], /^ {2}unreadable: domain\/billing\/rules\.md:\d+ — 確認紀錄格式讀不準：同一題/);
  assert.ok(lines[head + 2].includes(records.PUBLIC_PAGE), 'no brownfield bundle under --src: the public page');
  const other = await readFile(join(proj, 'out/domain/other/rules.html'), 'utf8');
  assert.ok(!other.includes('dflow-rec-'), 'a page with no record gets no summary, notice or record CSS');
  // With the brownfield bundle under a --src of the reader's own, the fix names the contract under that --src.
  await put(proj, 'specs/shared/dflow-workflows/references/modify-existing-baseline.md', '# Baseline\n');
  const bundled = runRenderCli(proj, ['--src', 'specs', '--out', 'out2']).stdout;
  assert.ok(bundled.includes('對照 specs/shared/dflow-workflows/references/modify-existing-baseline.md § Deferred confirmation records'), bundled);
  assert.ok(!bundled.includes('dflow/specs/'), 'no path the reader does not have');
  const quiet = join(tempRoot, 'quiet');
  await put(quiet, 'specs/domain/other/rules.md', '# R\n\n## Open Questions\n\n- nothing pending\n');
  assert.ok(!runRenderCli(quiet, ['--src', 'specs', '--out', 'out']).stdout.includes('confirmation records'), 'no record anywhere: no stdout line');
}

// --- the tutorial's branch (walkthrough 07): every document excerpt is the format --
{
  const text = await readFile(join(repoRoot, 'tutorial/02-brownfield/walkthrough-07-baseline-minimal-host.md'), 'utf8');
  const branch = text.slice(text.indexOf('## 支線：'), text.indexOf('## 本步驟的文件地圖'));
  const excerpts = [...branch.matchAll(/`([A-Za-z/._-]+\.md)`[^\n]*（節錄）：\n\n```markdown\n([\s\S]*?)\n```/g)];
  assert.deepEqual(excerpts.map((m) => m[1]), ['Shipment/rules.md', 'Shipment/behavior.md', 'migration/tech-debt.md'], 'the branch shows the three documents');
  const counts = excerpts.map(([, file, body]) => {
    const p = page(file.split('/').pop(), body);
    assert.deepEqual(p.recordProblems, [], `${file}: the tutorial's records are the format`);
    return p.records.map((r) => r.keyword).join(',');
  });
  assert.deepEqual(counts, [
    'Question,Deferred confirmation,Question,Deferred confirmation,Provisional',
    'Draft basis,Draft basis',
    'Question,Deferred confirmation'
  ]);
}

// --- render --help says what a badge proves and where the format is defined ------
{
  const help = runRenderCli(repoRoot, ['--help']).stdout.replace(/\s+/g, ' ');
  for (const phrase of [
    'Confirmation records: render reads the records a brownfield baseline capture writes for questions still waiting for an answer, in the format the workflow bundle\'s references/modify-existing-baseline.md defines.',
    'A badge says only that the format was read: roles, authorizations, code and rules are not checked, and nothing is shown as confirmed.',
    'No badge does not mean nothing is pending: an answered question leaves no record, and a question written in free text is not read.',
    'A line with no question id is ordinary text.',
    'rendering still completes and the exit code is unchanged',
    'https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/baseline-deferred-confirmation.en.md'
  ]) {
    assert.ok(help.includes(phrase), `render --help: ${phrase}`);
  }
}

// --- the shipped workflow files: their examples are never read as records --------
for (const tree of ['templates/brownfield', 'templates/greenfield', 'templates/common']) {
  const run = runRenderCli(repoRoot, ['--src', tree, '--out', join(tempRoot, tree.replace(/\//g, '-'))]);
  assert.equal(run.code, 0, `${tree} renders`);
  assert.ok(!run.stdout.includes('confirmation records'), `${tree}: no example is read as a record\n${run.stdout}`);
}

await rm(tempRoot, { recursive: true, force: true });
console.log('render-confirmation-records: all assertions passed');
