// Issue-form map guard (PROPOSAL-113 (E)).
//
// The feedback flow (templates/common/references/dflow-feedback-flow.md) carries
// a bundled snapshot of the upstream issue forms, one `### {name} — title
// `{prefix}`` section per form, so it can draft offline. This test keeps the
// cheapest drift out of that snapshot: every form in .github/ISSUE_TEMPLATE/
// (config.yml aside) has a section whose name and title prefix match the
// form's, and every section still has its form. A name or a section that
// appears twice is reported too, never folded away by a set.
//
// Deliberately not checked: the fields themselves. That would need a YAML
// parser, and the map's notes summarise the forms in their own words on
// purpose; field-level resync stays the rule in MAINTAINERS.md § Upstream
// Issue-Form Snapshot, and review.
//
// A form's name and title are read by a small reader for the one-line
// spellings YAML allows them: plain, single-quoted or double-quoted (with
// YAML's escapes), each with or without a trailing comment, followed only by
// blank lines and comments until the next top-level line. Any other spelling
// — a block scalar, a value continued on a later line, a flow collection, an
// anchor, alias or tag, a plain value YAML may read as null, a boolean, a
// number or a date — fails with a message saying so, instead of being read
// wrong.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const FORMS_REL = ['.github', 'ISSUE_TEMPLATE'];
const FLOW_REL = ['templates', 'common', 'references', 'dflow-feedback-flow.md'];
const MAP_HEADING = '## Upstream Issue Forms';

// --- reading a form's top-level name and title ---

const ESCAPES = {
  '0': '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b',
  ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\x85', _: '\xa0', L: '\u2028', P: '\u2029'
};
const HEX_DIGITS = { x: 2, u: 4, U: 8 };
// What may follow a closing quote: nothing, or blanks and then a comment.
const AFTER_QUOTE = /^(?:[ \t]+(?:#.*)?)?$/;

function readScalar(raw, where) {
  const fail = (why, how = 'write it on one line, plain or in quotes') => assert.fail(`${where}: ${why}; ${how}`);
  if (raw.startsWith('"')) {
    let out = '';
    for (let i = 1; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === '"') {
        return AFTER_QUOTE.test(raw.slice(i + 1)) ? out : fail('text after the closing quote');
      }
      if (ch !== '\\') {
        out += ch;
        continue;
      }
      const e = raw[i + 1];
      if (e !== undefined && Object.hasOwn(HEX_DIGITS, e)) {
        const hex = raw.slice(i + 2, i + 2 + HEX_DIGITS[e]);
        if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== HEX_DIGITS[e]) {
          fail(`an escape \\${e} without ${HEX_DIGITS[e]} hex digits`);
        }
        out += String.fromCodePoint(parseInt(hex, 16));
        i += 1 + HEX_DIGITS[e];
      } else if (e !== undefined && Object.hasOwn(ESCAPES, e)) {
        out += ESCAPES[e];
        i += 1;
      } else {
        fail(e === undefined ? 'a quoted value continued on the next line' : `an unknown escape \\${e}`);
      }
    }
    return fail('a quoted value continued on the next line');
  }
  if (raw.startsWith("'")) {
    let out = '';
    for (let i = 1; i < raw.length; i += 1) {
      if (raw[i] !== "'") {
        out += raw[i];
      } else if (raw[i + 1] === "'") {
        out += "'";
        i += 1;
      } else {
        return AFTER_QUOTE.test(raw.slice(i + 1)) ? out : fail('text after the closing quote');
      }
    }
    return fail('a quoted value continued on the next line');
  }
  const value = raw.startsWith('#') ? '' : raw.replace(/[ \t]+#.*$/, '').trim();
  if (value === '') {
    fail('an empty value');
  }
  if (/^[|>]/.test(value)) {
    fail('a block scalar');
  }
  if (/^[[\]{},&*!%@`]/.test(value) || /^[-?:](?:[ \t]|$)/.test(value)) {
    fail('a flow collection, anchor, alias, tag or indicator');
  }
  if (/:(?:[ \t]|$)/.test(value)) {
    fail('": " inside a plain value');
  }
  if (/^(?:~|null|true|false|yes|no|on|off|y|n)$/i.test(value) || /^[-+.]?[0-9]/.test(value)) {
    fail('a plain value YAML may read as null, a boolean, a number or a date', 'put it in quotes');
  }
  return value;
}

const keyLine = (key) => new RegExp(`^${key}[ \\t]*:(?:[ \\t]|$)`);

function topLevelScalar(text, key, file) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const at = lines.flatMap((line, i) => (keyLine(key).test(line) ? [i] : []));
  assert.ok(at.length > 0, `${file}: no top-level ${key}:`);
  assert.equal(at.length, 1, `${file}: top-level ${key}: appears ${at.length} times`);
  const raw = lines[at[0]].replace(/^[^:]*:/, '').trim();
  const value = readScalar(raw, `${file} ${key}:`);
  // The value ends on its own line: until the next line at the left margin,
  // only blank lines and comments may follow. An indented line there would
  // continue a plain value (blank lines in between or not), or break the YAML.
  for (let j = at[0] + 1; j < lines.length && !/^[^ \t#]/.test(lines[j]); j += 1) {
    if (/^[ \t]+[^ \t#]/.test(lines[j])) {
      assert.fail(`${file} ${key}: a value continued on a later line; write it on one line, plain or in quotes`);
    }
  }
  return value;
}

// [{ file, name, prefix }] for the given form files' contents.
function readForms(entries) {
  return entries.map(({ file, text }) => ({
    file,
    name: topLevelScalar(text, 'name', file),
    prefix: topLevelScalar(text, 'title', file)
  }));
}

// --- reading the field map ---

// [{ name, prefix, line }] for the field map's sections. Every `### ` heading
// inside the map must have the section shape; one that does not is a problem,
// so a malformed heading cannot drop out of the comparison unseen.
function readSections(flowText) {
  const lines = flowText.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(MAP_HEADING));
  assert.ok(start >= 0, `the feedback flow has no "${MAP_HEADING}" section`);
  const sections = [];
  const malformed = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    if (!lines[i].startsWith('### ')) {
      continue;
    }
    const m = /^### (.+?) — title `([^`]*)`\s*$/.exec(lines[i]);
    if (m) {
      sections.push({ name: m[1], prefix: m[2], line: i + 1 });
    } else {
      malformed.push(`field map line ${i + 1}: heading "${lines[i]}" is not "### {form name} — title \`{prefix}\`"`);
    }
  }
  return { sections, malformed };
}

function compare(forms, { sections, malformed }) {
  const problems = [...malformed];
  const count = (list, name) => list.filter((x) => x.name === name).length;
  for (const name of new Set(forms.map((f) => f.name))) {
    if (count(forms, name) > 1) {
      problems.push(`form "${name}" appears ${count(forms, name)} times (${forms.filter((f) => f.name === name).map((f) => f.file).join(', ')})`);
    }
  }
  for (const name of new Set(sections.map((s) => s.name))) {
    if (count(sections, name) > 1) {
      problems.push(`field map section "${name}" appears ${count(sections, name)} times (lines ${sections.filter((s) => s.name === name).map((s) => s.line).join(', ')})`);
    }
  }
  for (const form of forms) {
    const section = sections.find((s) => s.name === form.name);
    if (!section) {
      problems.push(`form "${form.name}" (${form.file}) has no section in the field map`);
    } else if (section.prefix !== form.prefix) {
      problems.push(`form "${form.name}" (${form.file}): title prefix ${JSON.stringify(form.prefix)}, field map line ${section.line} says ${JSON.stringify(section.prefix)}`);
    }
  }
  for (const section of sections) {
    if (!forms.some((f) => f.name === section.name)) {
      problems.push(`field map section "${section.name}" (line ${section.line}) has no form in .github/ISSUE_TEMPLATE`);
    }
  }
  return problems;
}

// --- a tree on disk: the forms and the flow, read the way the guard reads them ---

async function readTree(root) {
  const dir = join(root, ...FORMS_REL);
  const files = (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f) && f !== 'config.yml').sort();
  const entries = await Promise.all(files.map(async (file) => ({ file, text: await readFile(join(dir, file), 'utf8') })));
  return { entries, flowText: await readFile(join(root, ...FLOW_REL), 'utf8') };
}
const check = ({ entries, flowText }) => compare(readForms(entries), readSections(flowText));

const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-issue-form-map-'));
let probes = 0;
// Write a tree to disk and check it from the files, as the guard does.
async function checkWritten(tree) {
  probes += 1;
  const root = join(tempRoot, `tree-${probes}`);
  await mkdir(join(root, ...FORMS_REL), { recursive: true });
  await mkdir(dirname(join(root, ...FLOW_REL)), { recursive: true });
  for (const { file, text } of tree.entries) {
    await writeFile(join(root, ...FORMS_REL, file), text);
  }
  await writeFile(join(root, ...FLOW_REL), tree.flowText);
  return check(await readTree(root));
}

// The same value in other YAML spellings, built from the value, not from how
// the repository happens to spell it.
const hexEscape = (s) => [...s].map((c) => {
  const cp = c.codePointAt(0);
  return cp > 0xffff ? `\\U${cp.toString(16).padStart(8, '0')}` : `\\u${cp.toString(16).padStart(4, '0')}`;
}).join('');
const spell = {
  single: (v) => `'${v.replace(/'/g, "''")}'`,
  double: (v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
  escaped: (v) => `"${hexEscape(v)}"`,
  firstByHex: (v) => `"\\x${v.codePointAt(0).toString(16).padStart(2, '0')}${v.slice(1).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
};
// Replace the top-level line of `key` (found by its key, whatever its spelling).
function respell(text, key, line) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const i = lines.findIndex((l) => keyLine(key).test(l));
  assert.ok(i >= 0, `no ${key}: line to respell`);
  lines[i] = line;
  return lines.join('\n');
}

try {
  // --- the repository: every form has its section and every section its form ---
  const repo = await readTree(repoRoot);
  const forms = readForms(repo.entries);
  for (const name of ['Bug report', 'Workflow change request', 'Documentation feedback', 'Question', 'Usage report']) {
    assert.ok(forms.some((f) => f.name === name), `the guard reads the form "${name}"`);
  }
  assert.deepEqual(check(repo), [], 'the issue forms and the feedback flow\'s field map agree');

  // --- equivalent spellings of every form's name and title are accepted ---
  // The repository's forms, plus three complete ones copied from a real form
  // whose names hold what makes YAML spellings differ — " #", ": ", a quote, a
  // backslash — each with its section in the map.
  const base = repo.entries[0];
  // Names and files that cannot clash with the repository's own forms.
  const unclashed = (value, taken, suffix) => (taken.includes(value) ? unclashed(`${value}${suffix}`, taken, suffix) : value);
  const synthetic = [
    { file: 'field-notes.yml', name: 'Field notes', prefix: 'Notes' },
    { file: 'retro-hash.yml', name: 'Retrospective #1', prefix: '[Retro]: ' },
    { file: 'follow-up.yml', name: 'Usage report: follow-up', prefix: '[Follow-up]: ' },
    { file: 'odd.yml', name: 'It\'s #1 \\ "odd"', prefix: '[Odd #1]: ' }
  ].map((s) => ({
    ...s,
    file: unclashed(s.file, repo.entries.map((e) => e.file), '.probe.yml'),
    name: unclashed(s.name, forms.map((f) => f.name), ' (probe)')
  }));
  // The synthetic sections go at the end of the map, found the way readSections finds it.
  const mapLines = repo.flowText.split(/\r?\n/);
  const mapStart = mapLines.findIndex((l) => l.startsWith(MAP_HEADING));
  const mapEnd = mapLines.findIndex((l, i) => i > mapStart && l.startsWith('## '));
  const at = mapEnd < 0 ? mapLines.length : mapEnd;
  const all = {
    entries: [...repo.entries, ...synthetic.map((s) => ({
      file: s.file,
      text: respell(respell(base.text, 'name', `name: ${spell.double(s.name)}`), 'title', `title: ${spell.double(s.prefix)}`)
    }))],
    flowText: [...mapLines.slice(0, at), ...synthetic.flatMap((s) => [`### ${s.name} — title \`${s.prefix}\``, '']), ...mapLines.slice(at)].join('\n')
  };
  assert.deepEqual(await checkWritten(all), [], 'the synthetic forms agree with their sections');
  const allForms = readForms(all.entries);
  // A plain spelling only where plain YAML keeps the value as it is.
  const plainKeeps = (v) => v !== '' && v === v.trim() && !/^[-?:,[\]{}#&*!|>'"%@`]/.test(v) && !/:(?:[ \t]|$)|[ \t]#/.test(v) &&
    !/^(?:~|null|true|false|yes|no|on|off|y|n)$/i.test(v) && !/^[-+.]?[0-9]/.test(v);
  for (const key of ['name', 'prefix']) {
    assert.ok(synthetic.some((s) => plainKeeps(s[key])) && synthetic.some((s) => !plainKeeps(s[key])),
      `the plain spelling of a ${key} is both used and skipped`);
  }
  const respelled = (nameLine, titleLine) => ({
    ...all,
    entries: all.entries.map((e) => {
      const form = allForms.find((f) => f.file === e.file);
      return { ...e, text: respell(respell(e.text, 'name', nameLine(form.name)), 'title', titleLine(form.prefix)) };
    })
  });
  const variants = {
    'single quotes with comments': respelled((n) => `name: ${spell.single(n)} # the form's name`, (p) => `title: ${spell.single(p)} # prefix`),
    'double quotes, every character escaped': respelled((n) => `name: ${spell.escaped(n)}`, (p) => `title: ${spell.escaped(p)}`),
    'a \\x escape and a comment': respelled((n) => `name: ${spell.firstByHex(n)}  # c`, (p) => `title: ${spell.firstByHex(p)}\t# c`),
    'plain where plain keeps the value, with a comment; a space before the colon': respelled(
      (n) => `name: ${plainKeeps(n) ? n : spell.double(n)} # c`, (p) => `title : ${plainKeeps(p) ? p : spell.double(p)}`),
    'blank lines and comments after the values': respelled(
      (n) => `name: ${spell.double(n)}\n\n# a comment\n`, (p) => `title: ${spell.single(p)}\n  # an indented comment`)
  };
  for (const [label, tree] of Object.entries(variants)) {
    assert.deepEqual(await checkWritten(tree), [], `accepted: ${label}`);
  }
  const bomCrlf = { ...variants['single quotes with comments'] };
  bomCrlf.entries = bomCrlf.entries.map((e) => ({ ...e, text: `\uFEFF${e.text.replace(/\n/g, '\r\n')}` }));
  bomCrlf.flowText = all.flowText.replace(/\r?\n/g, '\r\n');
  assert.deepEqual(await checkWritten(bomCrlf), [], 'accepted: a byte-order mark and CRLF');

  // --- each way the two drift is reported, naming the form or section ---
  const usage = repo.entries.find((e) => forms.find((f) => f.file === e.file).name === 'Usage report');
  const usageSection = readSections(repo.flowText).sections.find((s) => s.name === 'Usage report');
  const flowLines = repo.flowText.split(/\r?\n/);
  const withLine = (index, replacement) => [...flowLines.slice(0, index), ...replacement, ...flowLines.slice(index + 1)].join('\n');
  const headingIndex = usageSection.line - 1;
  const form = `form "Usage report" (${usage.file})`;

  // a section removed from the map (the form stays)
  assert.deepEqual(await checkWritten({ ...repo, flowText: withLine(headingIndex, []) }), [`${form} has no section in the field map`]);
  // a new form added without its section
  const takenFiles = repo.entries.map((e) => e.file);
  const added = { file: unclashed('retro.yml', takenFiles, '.probe.yml'), name: unclashed('Retrospective', forms.map((f) => f.name), ' (probe)') };
  assert.deepEqual(await checkWritten({ ...repo, entries: [...repo.entries, { file: added.file, text: `name: ${spell.double(added.name)}\ntitle: "[Retro]: "\nbody: []\n` }] }),
    [`form "${added.name}" (${added.file}) has no section in the field map`]);
  // a prefix that differs, however the title is spelled
  for (const titleLine of ['title: "[Use]: "', "title: '[Use]: ' # renamed", 'title: "\\x5bUse]: "']) {
    const renamed = { ...usage, text: respell(usage.text, 'title', titleLine) };
    assert.deepEqual(await checkWritten({ ...repo, entries: repo.entries.map((e) => (e === usage ? renamed : e)) }),
      [`${form}: title prefix "[Use]: ", field map line ${usageSection.line} says "${usageSection.prefix}"`]);
  }
  // a section whose form was removed
  assert.deepEqual(await checkWritten({ ...repo, entries: repo.entries.filter((e) => e !== usage) }),
    [`field map section "Usage report" (line ${usageSection.line}) has no form in .github/ISSUE_TEMPLATE`]);
  // the same form twice, and the same section twice: not folded into one
  const copy = unclashed('usage_copy.yml', takenFiles, '.probe.yml');
  assert.deepEqual(await checkWritten({ ...repo, entries: [...repo.entries, { ...usage, file: copy }] }),
    [`form "Usage report" appears 2 times (${[usage.file, copy].sort().join(', ')})`]);
  assert.deepEqual(await checkWritten({ ...repo, flowText: withLine(headingIndex, [flowLines[headingIndex], '', flowLines[headingIndex]]) }),
    [`field map section "Usage report" appears 2 times (lines ${usageSection.line}, ${usageSection.line + 2})`]);
  // a heading inside the map that lost its shape
  assert.deepEqual(await checkWritten({ ...repo, flowText: withLine(headingIndex, ['### Usage report']) }), [
    `field map line ${usageSection.line}: heading "### Usage report" is not "### {form name} — title \`{prefix}\`"`,
    `${form} has no section in the field map`
  ]);

  // --- spellings the reader does not read fail with a message, never misread ---
  const unreadable = [
    ['a block scalar', 'title', 'title: >-\n  [Usage]: '],
    ['a value continued on a later line', 'title', 'title: Usage\n  report'],
    ['a value continued on a later line', 'name', 'name: Usage report\n\n  extended'],
    ['a value continued on a later line', 'name', 'name: Usage report\n# a comment\n  extended'],
    ['a quoted value continued on the next line', 'title', 'title: "[Usage]:\n  "'],
    ['text after the closing quote', 'title', 'title: "[Usage]: "x'],
    ['a flow collection, anchor, alias, tag or indicator', 'title', 'title: &prefix "[Usage]: "'],
    ['null, a boolean, a number or a date', 'name', 'name: yes'],
    ['null, a boolean, a number or a date', 'name', 'name: 2024-10-10'],
    ['appears 2 times', 'title', 'title: "[Usage]: "\ntitle: "[Usage]: "']
  ];
  for (const [why, key, text] of unreadable) {
    const odd = { ...usage, text: respell(usage.text, key, text) };
    await assert.rejects(checkWritten({ ...repo, entries: repo.entries.map((e) => (e === usage ? odd : e)) }),
      (error) => error.message.includes(usage.file) && error.message.includes(why), `refused with a message: ${why} (${JSON.stringify(text)})`);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log('issue-form-map: all checks passed');
