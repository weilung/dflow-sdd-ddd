// PROPOSAL-092 — template shape markers.
//
//   (1) the registry guards (D6): every covered template carries exactly one
//       marker naming itself; its skeleton matches the registered one for that
//       number; a published number is not rewritten (digest); numbers run 1..N
//       and the marker names the highest; every change list matches the skeleton
//       difference it describes; nothing outside the covered set carries a
//       marker; the frontmatter rule agrees with `dflow render`'s.
//   (2) doctor (D4 / D5 / D7): a fresh init is silent, and stays silent with
//       every projected template placed where a flow puts it; then each state a
//       marker can be in. An OLDER number only exists once a template has a
//       second shape, so that state runs against a package copy carrying a
//       synthetic shape 2.
//
// ⚠ Each guard is also shown to go red on the defect it names — the `mutation`
// blocks — not only green on the shipped tree. A guard that has never failed has
// not been shown to guard anything (planning/review-policy.md § 6, guard tier).
//
// Adding a shape number, for the maintainer who got here from a red (1a):
//   1. bump the number on the template's marker line;
//   2. append a shape to that template in lib/doc-shapes.json with the skeleton
//      and digest the failure printed, and a change list saying what moved
//      (`added` / `removed` / `renamed` / `moved` / `split`; `reworded` for a
//      note or comment whose text changed in its section; `reordered` with the
//      `parent` whose headings changed order — `null` for the `##` list);
//   3. never edit a published shape — (1a) recomputes every digest.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';

import init from '../lib/init.js';
import doctorChecks from '../lib/doctor-checks.js';
import render from '../lib/render.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const REGISTRY_REL = 'lib/doc-shapes.json';
const registry = JSON.parse(await readFile(join(repoRoot, REGISTRY_REL), 'utf8'));
const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-doc-shapes-'));
const BUNDLE_MARKER = '<!-- dflow-generated: workflow-bundle -->';

const j = JSON.stringify;
const noDifference = (d) => d.added.length === 0 && d.removed.length === 0;

// What a change list claims, as the multiset difference and the reorderings it
// implies. Compared with the real difference of the two shapes (D6 item 6):
// every item the newer shape has and the older lacks is either `added` or the
// target of a rename / move / split / rewording, every item the older had is
// either `removed` or a source, and the parents whose shared headings changed
// order are exactly the ones marked `reordered`.
function changeListMismatch(prev, next, changes) {
  const added = [];
  const removed = [];
  const reordered = [];
  for (const c of changes) {
    if (c.kind === 'added') added.push(c.item);
    else if (c.kind === 'removed') removed.push(c.item);
    else if (c.kind === 'renamed' || c.kind === 'moved' || c.kind === 'reworded') { removed.push(c.from); added.push(c.to); }
    else if (c.kind === 'split') { removed.push(c.from); added.push(...c.to); }
    else if (c.kind === 'reordered') reordered.push(c.parent);
    else return `unknown change kind ${j(c.kind)}`;
  }
  const strayReword = changes.find((c) => c.kind === 'reworded'
    && !(doctorChecks.isShapeTextItem(c.from) && j(c.from.slice(0, 3)) === j(c.to.slice(0, 3))));
  if (strayReword) return `\`reworded\` is for a note or comment whose text changed in its own section: ${j(strayReword)}`;
  const real = doctorChecks.skeletonDifference(prev, next);
  const claimedAdded = doctorChecks.skeletonDifference(real.added, added);
  const claimedRemoved = doctorChecks.skeletonDifference(real.removed, removed);
  const realOrder = doctorChecks.shapeOrderChanges(prev, next);
  const orderMatches = j(realOrder.map(j).sort()) === j(reordered.map(j).sort());
  const problems = [];
  if (!(noDifference(claimedAdded) && noDifference(claimedRemoved))) {
    problems.push(`the change list does not match the shapes. Items the new shape gained but the list does not account for: ${j(claimedAdded.removed)}; listed as gained but not gained: ${j(claimedAdded.added)}; lost but not accounted for: ${j(claimedRemoved.removed)}; listed as lost but not lost: ${j(claimedRemoved.added)}`);
  }
  if (!orderMatches) problems.push(`the headings changed order under ${j(realOrder)} (null is the \`##\` list), and the change list marks ${j(reordered)} as \`reordered\``);
  return problems.length === 0 ? null : problems.join('; ');
}

// Sibling sections that share a name — `## A` twice, or `### B` twice under one
// `## A`. A shape keys its sections by name, so two of them could swap places,
// or trade notes, without any item changing: the registry guard rejects them.
function sharedSectionNames(items) {
  const seen = new Set();
  const shared = [];
  for (const item of items) {
    if (item[0] !== 'h2' && item[0] !== 'h3') continue;
    const key = j(item);
    if (seen.has(key)) shared.push(item);
    seen.add(key);
  }
  return shared;
}
// Asserting and counting in one call: the count is what proves this guard still
// runs on every registered template, so the two must not be separable.
function assertNoSharedSiblings(skeleton, rel) {
  assert.deepEqual(
    sharedSectionNames(skeleton), [],
    `${rel}: sibling sections share a name. A shape keys its sections by name, so their order and their notes and comments cannot be told apart — give each its own name.`
  );
  return 1;
}
assert.deepEqual(sharedSectionNames(doctorChecks.extractShapeSkeleton('## Repeat\n\n## End\n\n## Repeat\n')), [['h2', 'Repeat']], 'vacuity guard: two `##` sections with one name are found');
// WARNING Two mutations have to be caught, and each needs its own assertion. The
// counter after the loop catches deleting the call site; this catches gutting the
// helper while leaving `return 1`, which kept the counter satisfied and the suite green.
assert.throws(
  () => assertNoSharedSiblings(doctorChecks.extractShapeSkeleton('## Repeat\n\n## End\n\n## Repeat\n'), 'fixture'),
  /sibling sections share a name/,
  'vacuity guard: assertNoSharedSiblings must itself reject a duplicate. If it does not, every per-template call through it is vacuous and the counter proves nothing'
);
// A second fixture, at the other heading level. With only the `##` case above, a guard
// narrowed to ignore `###` siblings would keep the whole suite green.
assert.throws(
  () => assertNoSharedSiblings(doctorChecks.extractShapeSkeleton('## A\n\n### B\n\n### B\n'), 'fixture'),
  /sibling sections share a name/,
  'vacuity guard: two `###` sections with one name under the same `##` must be rejected too'
);
assert.deepEqual(sharedSectionNames(doctorChecks.extractShapeSkeleton('## A\n\n### B\n\n## C\n\n### B\n')), [], 'the same `###` name under two different `##` is two sections');

// --- (1a) every registered template -------------------------------------------
// `siblingChecked` pins the sibling-name guard to its CALL SITE in this loop.
// The synthetic assertions above prove `sharedSectionNames` works; they cannot
// prove the loop still calls it, and every registered template currently has
// unique sibling names, so deleting the call would leave the suite green.
let siblingChecked = 0;
for (const [key, entry] of Object.entries(registry.templates)) {
  const [track, name] = key.split('/');
  const rel = `templates/${track}/${entry.source}`;
  const text = await readFile(join(repoRoot, rel), 'utf8');
  assert.equal(basename(entry.source), name, `${key}: the template name in the key must be the source file's name (${rel})`);

  const marker = doctorChecks.readShapeMarker(text);
  assert.equal(marker.state, 'ok', `${rel} must carry exactly one well-formed shape marker (got ${j(marker)})`);
  assert.equal(`${marker.track}/${marker.template}`, key, `${rel}: its marker names ${marker.track}/${marker.template}, not itself (${key})`);

  const numbers = entry.shapes.map((s) => s.number);
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1), `${key}: shape numbers must run 1, 2, 3… with none skipped or repeated (got ${j(numbers)})`);
  const highest = numbers[numbers.length - 1];
  assert.equal(
    marker.number, highest,
    marker.number > highest
      ? `${key}: the template's marker says ${marker.number} but the registry stops at ${highest}. Register shape ${marker.number} in ${REGISTRY_REL}.`
      : `${key}: the template's marker says ${marker.number} but the registry already has ${highest}. A number never goes down: docs stamped with ${highest} would read as newer than the CLI and be told to upgrade it.`
  );

  for (const shape of entry.shapes) {
    assert.equal(
      doctorChecks.shapeDigest(shape.skeleton), shape.digest,
      `${key} shape ${shape.number}: the registered skeleton no longer matches its digest. A published number must not be rewritten — docs in the field were stamped against it. (Only a number that has never been published may change, and then the digest changes in the same commit, where review sees it.)`
    );
  }
  assert.deepEqual(entry.shapes[0].changes, [], `${key}: shape 1 has no predecessor, so it lists no change`);
  for (let i = 1; i < entry.shapes.length; i += 1) {
    const mismatch = changeListMismatch(entry.shapes[i - 1].skeleton, entry.shapes[i].skeleton, entry.shapes[i].changes);
    assert.equal(mismatch, null, `${key} shape ${entry.shapes[i].number}: ${mismatch}`);
  }

  const extracted = doctorChecks.extractShapeSkeleton(text, { variable: entry.variable });
  siblingChecked += assertNoSharedSiblings(extracted, rel);
  const drift = doctorChecks.skeletonDifference(entry.shapes[highest - 1].skeleton, extracted);
  assert.ok(
    noDifference(drift),
    `${rel}: the template's shape changed but its shape number did not — its skeleton, or its \`>\` notes or HTML comments. Add shape ${highest + 1} (steps at the top of test/doc-shapes.mjs).\n  gained: ${j(drift.added)}\n  lost: ${j(drift.removed)}\n  new skeleton: ${j(extracted)}\n  its digest: ${doctorChecks.shapeDigest(extracted)}`
  );
  const reordered = doctorChecks.shapeOrderChanges(entry.shapes[highest - 1].skeleton, extracted);
  assert.deepEqual(
    reordered, [],
    `${rel}: the order of its sections changed but its shape number did not (under ${j(reordered)}; null is the \`##\` list). Add shape ${highest + 1} with a \`reordered\` change (steps at the top of test/doc-shapes.mjs).\n  new skeleton: ${j(extracted)}\n  its digest: ${doctorChecks.shapeDigest(extracted)}`
  );

  assert.ok(Array.isArray(entry.paths) && entry.paths.length > 0, `${key}: needs at least one path a flow creates the doc at (D7)`);
  const unfiltered = doctorChecks.extractShapeSkeleton(text);
  for (const v of entry.variable) {
    const want = v.length === 1 ? j(['h2', v[0]]) : j(['h3', v[0], v[1]]);
    assert.ok(unfiltered.some((item) => j(item) === want), `${key}: variable section ${j(v)} is not in the template — a stale entry would hide nothing and say something false`);
  }
  for (const field of entry.conditionalFields) {
    assert.ok(extracted.some((item) => item[0] === 'field' && item[1] === field), `${key}: conditional field ${field} is not in the template's frontmatter`);
  }
}
assert.equal(
  siblingChecked, Object.keys(registry.templates).length,
  `the sibling-name guard ran on ${siblingChecked} of ${Object.keys(registry.templates).length} registered templates. `
  + 'Every registered template must go through it: the guard is what stops two same-named sibling '
  + 'sections from swapping places, or trading notes, without any shape item changing.'
);

// --- (1b) coverage: the covered set, and nothing outside it -------------------
{
  const sources = new Set(Object.entries(registry.templates).map(([key, e]) => `templates/${key.split('/')[0]}/${e.source}`));
  for (const track of ['greenfield', 'brownfield']) {
    for (const file of await readdir(join(repoRoot, 'templates', track, 'templates'))) {
      if (!file.endsWith('.md')) continue;
      assert.ok(sources.has(`templates/${track}/templates/${file}`), `templates/${track}/templates/${file} is a spec template with no entry in ${REGISTRY_REL} (PROPOSAL-092 D3 covers every one)`);
    }
    assert.ok(sources.has(`templates/${track}/scaffolding/_overview.md`), `${track} _overview.md must be covered (D3)`);
  }
  const markedFiles = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.md') && doctorChecks.findShapeMarkerLines(await readFile(full, 'utf8')).length > 0) {
        markedFiles.push(relative(repoRoot, full).split('\\').join('/'));
      }
    }
  }
  await walk(join(repoRoot, 'templates'));
  for (const file of markedFiles) {
    assert.ok(sources.has(file), `${file} carries a shape marker but is not a covered template — a doc created from it would be read against a registry entry that does not exist (D3: _conventions.md, Git-principles-*, the guide, the snippet and the ADR README carry none)`);
  }
  assert.equal(markedFiles.length, sources.size, 'every covered template carries a marker (the count must match)');
}

// --- (1c) the frontmatter rule is `dflow render`'s ---------------------------
{
  const files = Object.entries(registry.templates).map(([key, e]) => `templates/${key.split('/')[0]}/${e.source}`);
  let withFrontmatter = 0;
  for (const rel of files) {
    const text = await readFile(join(repoRoot, rel), 'utf8');
    const lines = text.split('\n');
    const count = doctorChecks.frontmatterLineCount(lines);
    if (count > 0) withFrontmatter += 1;
    assert.equal(count === 0 ? text : lines.slice(count).join('\n'), render.splitFrontmatter(text).body, `${rel}: doctor and dflow render disagree about where its frontmatter ends`);
    // D2: with frontmatter the marker is the first body line, so render's meta card survives.
    if (count > 0) assert.match(lines[count], /^<!-- dflow-shape:/, `${rel}: the marker must sit on the line after the frontmatter's closing ---`);
    else assert.match(lines[0], /^<!-- dflow-shape:/, `${rel}: the marker must be the first line`);
  }
  assert.ok(withFrontmatter >= 9, 'the frontmatter templates must be among the files checked (vacuity guard)');
  for (const text of ['---\na: 1\n', 'x\n---\na: 1\n---\n', '---\na: 1\n---\nbody\n', '--- \n# c: d\n --- \nbody\n', '---\ra: 1\r---\r## T\r', '---\r\na: 1\r\n---\r\n## T\r\n', '\uFEFF---\na: 1\n---\nbody\n']) {
    const lines = text.split('\n');
    const count = doctorChecks.frontmatterLineCount(lines);
    assert.equal(count === 0 ? text : lines.slice(count).join('\n'), render.splitFrontmatter(text).body, `frontmatter edge case disagrees with render: ${j(text)}`);
  }
}

// --- (1c') the frontmatter's field names are the keys `dflow render` reads ------
{
  const fieldNames = (text) => [...new Set(doctorChecks.extractShapeSkeleton(text)
    .filter((item) => item[0] === 'field' && item.length === 2).map((item) => item[1]))].sort();
  const renderKeys = (text) => Object.keys(render.splitFrontmatter(text).meta).sort();
  for (const [key, e] of Object.entries(registry.templates)) {
    const rel = `templates/${key.split('/')[0]}/${e.source}`;
    const text = await readFile(join(repoRoot, rel), 'utf8');
    assert.deepEqual(fieldNames(text), renderKeys(text), `${rel}: the skeleton's frontmatter fields differ from the keys dflow render reads`);
  }
  for (const text of [
    '---\n"review-owner": Team A\nreview.owner: x\n# c: d\nplain line\nid: 1    # note\n---\nbody\n',
    '---\n  indented: 1\n- listed: 2\nurl: http://x\n---\n## T\n'
  ]) {
    assert.deepEqual(fieldNames(text), renderKeys(text), `frontmatter field names disagree with render: ${j(text)}`);
  }
  // A field the template carries commented out is in the shape however it is
  // indented or spelled; a comment that is prose is not.
  const optionalFields = (text) => doctorChecks.extractShapeSkeleton(text)
    .filter((item) => item[0] === 'field' && item[2] === 'optional').map((item) => item[1]);
  for (const [line, name] of [['# review-owner: TBD', 'review-owner'], ['  # review-owner: TBD', 'review-owner'], ['\t#review-owner: TBD', 'review-owner'], ['# "review owner": TBD', '"review owner"'], ['# review.owner: TBD', 'review.owner']]) {
    assert.deepEqual(optionalFields(`---\nid: X\n${line}\n---\n## A\n`), [name], `commented field ${j(line)} must be in the shape`);
  }
  assert.deepEqual(optionalFields('---\nid: X\n# a note about the id: keep it short\n---\n## A\n'), [], 'a comment that is prose is not a field');
  // The guard reacts: a field render shows, added in any key spelling, is a shape change.
  const base = '---\nid: X\n---\n<!-- dflow-shape: greenfield/x.md 1 — keep this line: dflow doctor reads it -->\n## A\n';
  for (const added of ['"review-owner": Team A', 'review.owner: Team A', "'review owner': x"]) {
    const diff = doctorChecks.skeletonDifference(doctorChecks.extractShapeSkeleton(base), doctorChecks.extractShapeSkeleton(base.replace('id: X\n', `id: X\n${added}\n`)));
    assert.equal(diff.added.length, 1, `adding ${j(added)} to the frontmatter must change the skeleton`);
  }
}

// --- (1d) the change-list check itself fails for the right reasons -----------
{
  const prev = [['h2', 'A'], ['h2', 'B'], ['column', 'A', '', 1, 'x']];
  const next = [['h2', 'A'], ['h2', 'C'], ['column', 'A', '', 1, 'x'], ['column', 'A', '', 1, 'y'], ['field', 'z']];
  const right = [
    { kind: 'renamed', from: ['h2', 'B'], to: ['h2', 'C'] },
    { kind: 'added', item: ['column', 'A', '', 1, 'y'] },
    { kind: 'added', item: ['field', 'z'] }
  ];
  assert.equal(changeListMismatch(prev, next, right), null, 'a complete change list must pass');
  assert.notEqual(changeListMismatch(prev, next, right.slice(1)), null, 'mutation: a rename left out must fail');
  assert.notEqual(changeListMismatch(prev, next, right.slice(0, 2)), null, 'mutation: an addition left out must fail');
  assert.notEqual(changeListMismatch(prev, next, [...right, { kind: 'removed', item: ['h2', 'A'] }]), null, 'mutation: a removal that did not happen must fail');
  assert.notEqual(changeListMismatch(prev, next, [{ kind: 'added', item: ['h2', 'C'] }, ...right.slice(1)]), null, 'mutation: a rename listed as a bare addition must fail — the old heading is unaccounted for');
  assert.equal(changeListMismatch(prev, [['h2', 'A'], ['h2', 'B1'], ['h2', 'B2'], ['column', 'A', '', 1, 'x']], [{ kind: 'split', from: ['h2', 'B'], to: [['h2', 'B1'], ['h2', 'B2']] }]), null, 'a split must pass');

  // Notes, comments and heading order.
  const before = [['h2', 'A'], ['h2', 'B'], ['note', 'A', '', 'n1']];
  const after = [['h2', 'B'], ['h2', 'A'], ['note', 'A', '', 'n2']];
  const listed = [
    { kind: 'reworded', from: ['note', 'A', '', 'n1'], to: ['note', 'A', '', 'n2'] },
    { kind: 'reordered', parent: null }
  ];
  assert.equal(changeListMismatch(before, after, listed), null, 'a reworded note and a reordering must pass');
  assert.notEqual(changeListMismatch(before, after, listed.slice(0, 1)), null, 'mutation: a reordering left out must fail');
  assert.notEqual(changeListMismatch(before, after, listed.slice(1)), null, 'mutation: a reworded note left out must fail');
  assert.notEqual(changeListMismatch(before, after, [...listed, { kind: 'reordered', parent: 'A' }]), null, 'mutation: a reordering that did not happen must fail');
  assert.notEqual(
    changeListMismatch(before, [['h2', 'A'], ['h2', 'B'], ['note', 'B', '', 'n1']], [{ kind: 'reworded', from: ['note', 'A', '', 'n1'], to: ['note', 'B', '', 'n1'] }]), null,
    'mutation: `reworded` across sections must fail — a note that moved is `moved`'
  );
  const inserted = [['h2', 'A'], ['h2', 'X'], ['h2', 'B']];
  assert.equal(changeListMismatch([['h2', 'A'], ['h2', 'B']], inserted, [{ kind: 'added', item: ['h2', 'X'] }]), null, 'a section inserted between two others is an addition only');
  assert.notEqual(changeListMismatch([['h2', 'A'], ['h2', 'B']], inserted, [{ kind: 'added', item: ['h2', 'X'] }, { kind: 'reordered', parent: null }]), null, 'mutation: an insertion is not a reordering');
}

// --- (1e) the shape guard reacts to shape, notes, comments and order ----------
// ... and ignores other prose and re-wrapping. A fixture of its own, not a
// shipped template: a harmless edit to a template (a re-wrapped note) must not
// break this block, and (1a) already holds every template to its registered shape.
{
  const text = [
    '<!-- dflow-shape: greenfield/x.md 1 — keep this line: dflow doctor reads it -->',
    '<!-- Seeded by Dflow. -->',
    '<!-- Formatting convention: keep table cells concise. -->',
    '',
    '# Business Rules',
    '',
    '> Declarative BR-ID index for one bounded context.',
    '>',
    '> > Keep this text together.',
    '',
    '## Rule Index',
    '',
    '| BR-ID | Rule summary | Status |',
    '|---|---|---|',
    '| BR-01 | {summary} | active |',
    '',
    '- One row per rule.',
    '',
    '## Status Legend',
    '',
    '| Status | Meaning |',
    '|---|---|',
    '| active | in force |',
    '',
    '## Open Questions',
    '',
    '- {question}',
    ''
  ].join('\n');
  const base = doctorChecks.extractShapeSkeleton(text);
  const diff = (t) => doctorChecks.skeletonDifference(base, doctorChecks.extractShapeSkeleton(t));
  const reordered = (t) => doctorChecks.shapeOrderChanges(base, doctorChecks.extractShapeSkeleton(t));
  const note = '> Declarative BR-ID index for one bounded context.';
  const shapeEdits = {
    'a new column': text.replace('| BR-ID | Rule summary | Status |', '| BR-ID | Owner | Rule summary | Status |').replace('|---|---|---|', '|---|---|---|---|'),
    'a new H2': `${text}\n## Glossary Links\n`,
    'a new H3': text.replace('## Open Questions', '## Open Questions\n\n### Parked'),
    'a renamed H2': text.replace('## Open Questions', '## Questions'),
    'two columns swapped': text.replace('| BR-ID | Rule summary | Status |', '| Rule summary | BR-ID | Status |'),
    'a reworded note': text.replace(note, `${note.slice(0, -1)}, one row per rule.`),
    'a new note': text.replace('## Open Questions', '## Open Questions\n\n> Park anything unresolved here.'),
    'a reworded comment': text.replace('<!-- Seeded by Dflow. -->', '<!-- Seeded by Dflow; edit freely. -->'),
    'a comment in a heading': text.replace('## Open Questions', '## Open Questions <!-- Fill timing: later -->'),
    'a comment under a list item': text.replace('- One row per rule.', '- One row per rule.\n  <!-- For AI: never two rows for one rule. -->'),
    'a list item that is a comment': text.replace('- {question}', '- {question}\n- <!-- For AI: one question per item. -->'),
    'a table after a `####` placeholder': `${text}\n#### {Example}\n\nAn example.\n\n| a | b |\n|---|---|\n`,
    'a table inside a comment': `${text}\n<!--\n| a | b |\n|---|---|\n-->\n`,
    'a table inside a blockquote': `${text}\n> | a | b |\n> |---|---|\n`
  };
  for (const [label, edited] of Object.entries(shapeEdits)) {
    assert.notEqual(edited, text, `probe for ${label} did not change the text`);
    assert.ok(!noDifference(diff(edited)), `mutation: ${label} must change the shape`);
  }
  const legend = text.slice(text.indexOf('## Status Legend'), text.indexOf('## Open Questions'));
  const swapped = text.replace(legend, '').replace('## Rule Index', `${legend}## Rule Index`);
  assert.ok(legend.length > 0 && swapped !== text, 'fixture: the Status Legend section was moved');
  assert.ok(noDifference(diff(swapped)), 'moving a section keeps every item');
  assert.deepEqual(reordered(swapped), [null], 'mutation: two `##` sections swapped must be a change of order');
  const proseEdits = {
    'a prose line': text.replace('## Open Questions', 'A note someone added.\n\n## Open Questions'),
    'a placeholder heading and its table': `${text}\n## {Area}\n\n> An example note.\n\n| a | b |\n|---|---|\n`,
    'an H4': `${text}\n#### Detail\n`,
    'a table inside a fence': `${text}\n\`\`\`\n| a | b |\n|---|---|\n\`\`\`\n`,
    'a re-wrapped note': text.replace(note, '> Declarative BR-ID index\n> for one bounded context.'),
    'a re-wrapped nested note': text.replace('> > Keep this text together.', '> > Keep this text\n> > together.'),
    'a re-wrapped comment': text.replace('<!-- Formatting convention: keep', '<!-- Formatting convention:\n     keep'),
    'prose after a comment on its line': text.replace('<!-- Seeded by Dflow. -->', '<!-- Seeded by Dflow. --> Edit freely.'),
    'a comment inside a line of prose': text.replace('- One row per rule.', '- One row per rule. <!-- an aside -->')
  };
  for (const [label, edited] of Object.entries(proseEdits)) {
    assert.notEqual(edited, text, `probe for ${label} did not change the text`);
    assert.ok(noDifference(diff(edited)) && reordered(edited).length === 0, `${label} must not change the shape: ${j(diff(edited))}`);
  }
}

// --- (1f) extractor details ---------------------------------------------------
{
  const sk = doctorChecks.extractShapeSkeleton([
    '---',
    'id: X    # only sometimes',
    '# hotfix-branch: y    # optional',
    '# just a comment',
    '---',
    '<!-- dflow-shape: greenfield/x.md 1 — keep this line: dflow doctor reads it -->',
    '# Title',
    '',
    '| top | table |',
    '|---|---|',
    '',
    '## Main <!-- note -->',
    '',
    '### Sub',
    '',
    '> A note',
    '> on two lines.',
    '',
    '#### Deep',
    '',
    '| c1 | c2 \\| escaped |',
    '|---|---|',
    '',
    '## Replaceable',
    '',
    '> Replaced with the section, so not recorded.',
    '',
    '| gone |',
    '|---|',
    '',
    '## {Example}',
    '',
    '<!-- under a placeholder: not recorded -->',
    '',
    '### Under example',
    '',
    '## After',
    '',
    '<!--',
    'a comment on',
    'three lines -->'
  ].join('\n'), { variable: [['Replaceable']] });
  assert.deepEqual(sk.filter((item) => !doctorChecks.isShapeTextItem(item)), [
    ['field', 'id'],
    ['field', 'hotfix-branch', 'optional'],
    ['column', '', '', 1, 1, 'top'],
    ['column', '', '', 1, 2, 'table'],
    ['h2', 'Main'],
    ['h3', 'Main', 'Sub'],
    ['column', 'Main', 'Sub', 1, 1, 'c1'],
    ['column', 'Main', 'Sub', 1, 2, 'c2 \\| escaped'],
    ['h2', 'After']
  ]);
  // Notes and comments, by section: the heading's comment, the two-line note, the
  // three-line comment. The marker line is not a comment of the shape; the
  // variable and placeholder sections record none.
  assert.deepEqual(sk.filter(doctorChecks.isShapeTextItem).map((item) => item.slice(0, 3)), [
    ['comment', 'Main', ''],
    ['note', 'Main', 'Sub'],
    ['comment', 'After', '']
  ]);
  const noteOf = (t) => doctorChecks.extractShapeSkeleton(t).find((item) => item[0] === 'note');
  assert.deepEqual(noteOf('## S\n\n> a b\n> c\n'), noteOf('## S\n\n>   a\n> b c\n'), 're-wrapping a note is not a change');
  assert.notDeepEqual(noteOf('## S\n\n> a b c\n'), noteOf('## S\n\n> a b d\n'), 'rewording a note is');
  // A `|` inside a comment in a header row is not a column boundary.
  assert.deepEqual(doctorChecks.extractShapeSkeleton('## S\n\n| A <!-- note | comment --> | B |\n|---|---|\n'), [['h2', 'S'], ['column', 'S', '', 1, 1, 'A'], ['column', 'S', '', 1, 2, 'B']], 'a comment in a header cell must not split it');
  // Frontmatter is cut the way render cuts it: a lone-CR file has none.
  assert.deepEqual(doctorChecks.extractShapeSkeleton('---\rid: x\r---\r## T\r'), [['h2', 'id: x'], ['h2', 'T']], 'lone CR: no frontmatter (render agrees), so `id: x` over `---` is a setext H2, as a renderer shows it');
  assert.deepEqual(doctorChecks.extractShapeSkeleton('---\r\nid: x\r\n---\r\n## T\r\n'), [['field', 'id'], ['h2', 'T']], 'CRLF: same as LF');
}

// --- (1g) reading a marker (D2) -----------------------------------------------
// Read from one line only — line 1, or the line after the frontmatter. A line that
// mentions `dflow-shape:` anywhere else is "cannot tell", never "absent" and never
// "ok": doctor does not decide whether it is live.
{
  const read = (t) => doctorChecks.readShapeMarker(t);
  const good = '<!-- dflow-shape: greenfield/rules.md 3 — keep this line: dflow doctor reads it -->';
  assert.deepEqual(read('# x\n'), { state: 'absent' });
  assert.deepEqual(read(`${good}\n# x\n`), { state: 'ok', track: 'greenfield', template: 'rules.md', number: 3, line: 1 });
  assert.equal(read('<!-- dflow-shape: brownfield/rules.md 2 -->\n').state, 'ok', 'the note after the number is optional');
  assert.equal(read('<!-- dflow-shape: brownfield/rules.md 2 — any note someone rewrote -->\n').state, 'ok', 'the note is not validated');
  assert.deepEqual(read(`---\nid: X\n---\n${good}\n## A\n`), { state: 'ok', track: 'greenfield', template: 'rules.md', number: 3, line: 4 }, 'with frontmatter, the line after its closing ---');
  assert.equal(read(`\uFEFF${good}\n`).state, 'ok', 'a byte-order mark is not part of the first line');
  assert.deepEqual(
    read(`\uFEFF---\nid: X\n---\n${good}\n## A\n`),
    { state: 'unreadable', reason: 'misplaced', lines: [4], standard: 1, bomHidesFrontmatter: true },
    'a BOM in front of `---` hides the frontmatter from render, so the marker under it is not on its line'
  );
  assert.equal(read(`${good}\r\n# x\r\n`).state, 'ok', 'CRLF');
  for (const bad of ['greenfield/rules.md 0', 'greenfield/rules.md 01', 'greenfield/rules.md -1', 'greenfield/rules.md two', 'greenfield rules.md 1', 'Greenfield/rules.md 1', 'greenfield/rules 1']) {
    assert.deepEqual(read(`<!-- dflow-shape: ${bad} -->\n`), { state: 'unreadable', reason: 'malformed', lines: [1] }, `malformed: ${bad}`);
  }
  for (const [label, t] of [['indented', `   ${good}\n`], ['indented code', `    ${good}\n`], ['in a quote', `> ${good}\n`], ['in a list item', `- ${good}\n`]]) {
    assert.deepEqual(read(t), { state: 'unreadable', reason: 'malformed', lines: [1] }, `${label} on the standard line is not the form a marker takes`);
  }
  const misplaced = (t, line, standard, label) => assert.deepEqual(read(t), { state: 'unreadable', reason: 'misplaced', lines: [line], standard }, `misplaced (${label})`);
  misplaced(`# x\n${good}\n`, 2, 1, 'below the first line');
  misplaced(`\`\`\`\n${good}\n\`\`\`\n`, 2, 1, 'quoted in a fence');
  misplaced(`<!--\n${good}\n-->\n`, 2, 1, 'inside a comment opened earlier');
  misplaced(`<details>\n${good}\n</details>\n`, 2, 1, 'inside an HTML block');
  misplaced(`- item\n  <!--\n  ${good}\n  -->\n`, 3, 1, "inside a list item's multi-line comment");
  misplaced(`---\nid: X\n---\n\n${good}\n`, 5, 4, 'a blank line after the frontmatter');
  misplaced(`# x\n---\nid: X\n---\n${good}\n`, 5, 1, 'after `---` lines that are not frontmatter');
  misplaced('# Notes\n\nOur process mentions dflow-shape: in passing.\n', 3, 1, 'a prose mention');
  assert.deepEqual(read(`${good}\ntext\n${good}\n`), { state: 'unreadable', reason: 'multiple', lines: [1, 3] }, 'two valid lines are unreadable, not "the first one"');
  assert.deepEqual(read(`${good}\n<!-- dflow-shape: broken -->\n`), { state: 'unreadable', reason: 'multiple', lines: [1, 2] }, 'one valid plus one broken is not "exactly one"');
  assert.deepEqual(read(`${good}\n<!--\n${good.replace(' 3 ', ' 4 ')}\n-->\n`), { state: 'unreadable', reason: 'multiple', lines: [1, 3] }, 'a switched-off copy is not skipped: doctor does not judge which line is live');
  assert.equal(read('<!-- dflow-shape: broken -->\n').state, 'unreadable', 'a document whose only marker is broken is not unmarked');
  assert.deepEqual(
    read('<!-- dflow-shape: greenfield/rules.md 1 -->\r<!-- dflow-shape: greenfield/rules.md 9 -->\r'),
    { state: 'unreadable', reason: 'malformed', lines: [1] },
    'lone-CR line breaks: the note after the number stops at a CR, so a second marker cannot hide in it'
  );
}

// --- (1h) the registry's paths are where the flows create docs from it (D6, D7) -
// ⚠ Checked against the SHIPPED TEXT, never against the registry itself: a path
// the flows do not use hides every unmarked doc at the real path, and a test that
// places files at the registry's own paths would pass with any typo in them.
// ⚠ A path must be tied to THAT template, not merely named somewhere: pointing
// one template at another template's path would otherwise pass, and the doc the
// first template really creates would drop out of every finding.
{
  const TRACKS = ['greenfield', 'brownfield'];
  const normalize = (p) => p.replace(/\{[^}]*\}/g, '*').replace(/\*(?:-\*)+/g, '*');
  // Per track: every `dflow/specs/…` path the text names, and every path named on
  // one line with a `templates/…` or `scaffolding/…` file. `common` files ship to
  // both tracks and name either track's paths: they can confirm a registry path
  // but cannot demand one.
  const evidence = Object.fromEntries([...TRACKS, 'common'].map((t) => [t, { named: new Set(), pairs: [] }]));
  async function collect(dir, t) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { await collect(full, t); continue; }
      if (!entry.name.endsWith('.md')) continue;
      for (const line of (await readFile(full, 'utf8')).split('\n')) {
        const paths = [...line.matchAll(/dflow\/specs\/([A-Za-z0-9_{}.\/*-]+\.md)/g)].map((m) => normalize(m[1]));
        const names = [...line.matchAll(/(?<![\w/-])(?:templates|scaffolding)\/([A-Za-z0-9_.-]+\.md)/g)].map((m) => m[1]);
        for (const p of paths) {
          evidence[t].named.add(p);
          for (const name of names) evidence[t].pairs.push([name, p]);
        }
      }
    }
  }
  await collect(join(repoRoot, 'templates/common'), 'common');
  for (const t of TRACKS) await collect(join(repoRoot, 'templates', t), t);
  // The covered templates, from the package's own directories — not the registry.
  const packaged = {};
  for (const t of TRACKS) {
    packaged[t] = new Set([...(await readdir(join(repoRoot, 'templates', t, 'templates'))).filter((n) => n.endsWith('.md')), '_overview.md']);
  }
  // A doc named differently from its template, where no line names both: the
  // sentence that says where it goes is pinned — keyed by template AND path, so a
  // pin confirms that one pairing and nothing else.
  const pinned = [
    ['greenfield', 'aggregate-design.md', 'features/active/*/aggregate-design.md', 'templates/greenfield/references/new-feature-flow.md', '`aggregate-design.md` worksheet in the feature directory'],
    ['brownfield', 'context-definition.md', 'domain/*/context.md', 'templates/brownfield/references/new-feature-flow.md', 'Create `dflow/specs/domain/{new-context}/context.md` using the context-definition template'],
    ...TRACKS.flatMap((t) => [
      [t, 'phase-spec.md', 'features/active/*/phase-spec-*.md', `templates/${t}/references/new-phase-flow.md`, 'phase-spec-{YYYY-MM-DD}-{phase-slug}.md\n```\n\nUse the `templates/phase-spec.md` template'],
      [t, 'lightweight-spec.md', 'features/active/*/lightweight-*.md', `templates/${t}/templates/lightweight-spec.md`, 'dflow/specs/features/active/{SPEC-ID}-{slug}/lightweight-{YYYY-MM-DD}-{slug}.md'],
      [t, 'lightweight-spec.md', 'features/active/*/BUG-*.md', `templates/${t}/templates/lightweight-spec.md`, 'dflow/specs/features/active/{SPEC-ID}-{slug}/BUG-{NUMBER}-{slug}.md']
    ])
  ];
  for (const [t, name, pattern, file, words] of pinned) {
    assert.ok((await readFile(join(repoRoot, file), 'utf8')).includes(words), `${file} no longer says ${j(words)}, which pins ${t}/${name} → ${pattern}. Point the pin at the sentence that now says where that doc goes.`);
  }
  // What the shipped text ties together: [template, path] from a shared line, from
  // a doc named after a packaged template, and from the pins.
  function tied(track, { withCommon }) {
    const out = [];
    for (const ev of withCommon ? [evidence[track], evidence.common] : [evidence[track]]) {
      out.push(...ev.pairs);
      for (const p of ev.named) {
        const name = p.split('/').pop();
        if (packaged[track].has(name)) out.push([name, p]);
      }
    }
    for (const [t, name, pattern] of pinned) if (t === track) out.push([name, pattern]);
    return out;
  }
  const inScope = (p) => /^(domain|architecture|migration)\//.test(p) || p.startsWith('features/active/') || p === 'shared/_overview.md';
  // Each track's text names the OTHER track's tech-debt path only to rule it out
  // (`init-project-flow.md`: "… (not `dflow/specs/migration/tech-debt.md`)") or in
  // the guide's either/or table. Listed by name, not by a rule.
  const otherTrackMentions = { greenfield: ['migration/tech-debt.md'], brownfield: ['architecture/tech-debt.md'] };
  const covers = (patterns, p) => patterns.some((pattern) => pattern === p || doctorChecks.shapePathMatches(pattern, p));
  function flowPathProblems(reg) {
    const problems = [];
    for (const [key, entry] of Object.entries(reg.templates)) {
      const [track, name] = key.split('/');
      const confirmed = tied(track, { withCommon: true }).filter(([n]) => n === name).map(([, p]) => p);
      for (const pattern of entry.paths) {
        if (!confirmed.some((p) => p === pattern || doctorChecks.shapePathMatches(pattern, p))) {
          problems.push(`${key}: ${pattern} is not a path the shipped text ties to ${name}`);
        }
      }
    }
    // The other direction looks templates up by their PACKAGED names: filtering
    // through the registry's own paths would let a wrong path hide the right one.
    for (const track of TRACKS) {
      for (const [name, p] of tied(track, { withCommon: false })) {
        if (!packaged[track].has(name) || !inScope(p) || otherTrackMentions[track].includes(p)) continue;
        const entry = reg.templates[`${track}/${name}`];
        if (!entry || !Array.isArray(entry.paths) || !covers(entry.paths, p)) {
          problems.push(`${track}: the shipped text creates ${p} from ${name}, and the registry does not list that path under ${track}/${name}`);
        }
      }
    }
    return [...new Set(problems)];
  }
  assert.deepEqual(flowPathProblems(registry), [], 'every registry path is one the shipped text ties to that template, and every doc it ties to a covered template is registered under it');
  const mutate = (key, paths) => {
    const r = JSON.parse(JSON.stringify(registry));
    r.templates[key].paths = paths;
    return r;
  };
  assert.notEqual(flowPathProblems(mutate('greenfield/events.md', ['domain/*/eventz.md'])).length, 0, 'mutation: a registry path no flow uses must fail');
  assert.notEqual(flowPathProblems(mutate('brownfield/analysis.md', ['domain/analysis.md'])).length, 0, 'mutation: a flow path the registry dropped must fail');
  assert.notEqual(flowPathProblems(mutate('greenfield/events.md', ['domain/*/models.md'])).length, 0, "mutation: a template pointed at another template's path must fail");
  assert.notEqual(flowPathProblems(mutate('greenfield/phase-spec.md', ['features/active/*/aggregate-design.md'])).length, 0, "mutation: a pin confirms only its own template's path");
  assert.notEqual(flowPathProblems(mutate('brownfield/lightweight-spec.md', ['features/active/*/lightweight-*.md'])).length, 0, 'mutation: a pinned path the registry dropped must fail');
}

// --- (1i) no table in a template that the skeleton cannot read ----------------
// `dflow render` (marked) draws a table inside a list item, and the skeleton
// reads top-level tables only: such a table's header could change without a new
// number. The guard is on the templates, where the table would be added.
// A `>` block is left out on purpose: a table in one is part of the note's text,
// which the shape records as a note (D6) — the `_index.md` note's Lightweight
// Changes row is such an example.
{
  const { Marked } = await import('marked');
  const lexer = new Marked();
  const nestedTables = (text) => {
    const found = [];
    const walk = (tokens, inside) => {
      for (const t of tokens || []) {
        if (t.type === 'blockquote') continue;
        if (t.type === 'table' && inside) found.push(String(t.raw).split('\n')[0].trim());
        const nested = inside || t.type === 'list_item';
        walk(t.items, nested || t.type === 'list');
        walk(t.tokens, nested);
      }
    };
    walk(lexer.lexer(render.splitFrontmatter(text).body), false);
    return found;
  };
  assert.equal(nestedTables('- item\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |\n').length, 1, 'vacuity guard: a table in a list item is found');
  assert.equal(nestedTables('1. step\n\n   | a | b |\n   |---|---|\n   | 1 | 2 |\n').length, 1, 'vacuity guard: a table in an ordered list item is found');
  assert.equal(nestedTables('> | a | b |\n> |---|---|\n> | 1 | 2 |\n').length, 0, 'a table in a note is an example, by the rule above');
  assert.equal(nestedTables('| a | b |\n|---|---|\n| 1 | 2 |\n').length, 0, 'a top-level table is not nested');
  for (const [key, e] of Object.entries(registry.templates)) {
    const rel = `templates/${key.split('/')[0]}/${e.source}`;
    const text = await readFile(join(repoRoot, rel), 'utf8');
    assert.deepEqual(nestedTables(text), [], `${rel}: dflow render draws a table inside a list item here, and the shape skeleton cannot read it — move the table to the top level, or teach extractShapeSkeleton to read it`);
  }
}

// --- (1j) the shape reads a template the way `dflow render` does -------------
// What the skeleton takes from a template — its sections, tables and comments —
// is held against render's parser (marked) on every registered template: a
// table or a comment render shows, in a section the shape keeps, must be in the
// shape. Review kept finding one more form the extractor did not read (a
// comment under a list item, a table after a `####` placeholder, a note inside
// a list item); comparing the two readings closes that class instead of
// listing its forms. The section rules are the shape's own (D6): `##` and `###`
// make sections, a `{…}` placeholder at those levels or a variable section
// drops what is under it, and a `>` block is one note — whatever it holds —
// wherever render finds it.
{
  const { Marked } = await import('marked');
  const lexer = new Marked();
  const fold = (x) => String(x).replace(/\s+/g, ' ').trim();
  const sorted = (list) => list.map(j).sort();
  function renderReading(text, variable = []) {
    const keys = new Set(variable.map(j));
    const out = { headings: [], tables: [], comments: [], notes: [] };
    let h2 = '';
    let h3 = '';
    let placeholder = 0;
    let skipped = false;
    const inside = (tokens) => {
      for (const t of tokens || []) {
        if (t.type === 'blockquote') { out.notes.push([h2, h3]); continue; }
        if (t.type === 'table') out.tables.push([h2, h3, t.header.length]);
        if (t.type === 'html' && t.block) {
          for (const span of doctorChecks.shapeCommentSpans(t.raw)) out.comments.push([h2, h3, fold(span)]);
        }
        inside(t.items);
        inside(t.tokens);
      }
    };
    for (const t of lexer.lexer(render.splitFrontmatter(text).body)) {
      if (t.type === 'heading') {
        const heading = doctorChecks.shapeHeadingText(t.text);
        if (placeholder && t.depth <= placeholder) placeholder = 0;
        if (placeholder) continue;
        if ((t.depth === 2 || t.depth === 3) && /\{[^}\n]*\}/.test(heading)) { placeholder = t.depth; continue; }
        if (t.depth === 1) { h2 = ''; h3 = ''; skipped = false; }
        else if (t.depth === 2) { h2 = heading; h3 = ''; skipped = keys.has(j([h2])); if (!skipped) out.headings.push(['h2', h2]); }
        else if (t.depth === 3) { h3 = heading; skipped = keys.has(j([h2])) || keys.has(j([h2, h3])); if (!skipped) out.headings.push(['h3', h2, h3]); }
        if (!skipped) for (const span of doctorChecks.shapeCommentSpans(t.raw)) out.comments.push([h2, h3, fold(span)]);
        continue;
      }
      if (placeholder || skipped) continue;
      inside([t]);
    }
    return out;
  }
  function shapeReading(text, variable = []) {
    const { items, sections } = doctorChecks.extractShapeSections(text, { variable });
    const cells = new Map();
    for (const item of items) {
      if (item[0] !== 'column') continue;
      const key = j(item.slice(1, 4));
      cells.set(key, (cells.get(key) || 0) + 1);
    }
    return {
      headings: items.filter((item) => item[0] === 'h2' || item[0] === 'h3'),
      tables: [...cells].map(([key, n]) => [...JSON.parse(key).slice(0, 2), n]),
      comments: sections.flatMap((section) => section.comment.map((c) => [section.h2, section.h3, fold(c)])),
      notes: sections.flatMap((section) => section.note.map(() => [section.h2, section.h3]))
    };
  }
  const readingMismatch = (fromRender, fromShape) => {
    const problems = [];
    if (j(fromRender.headings) !== j(fromShape.headings)) problems.push(`sections — render: ${j(fromRender.headings)}; shape: ${j(fromShape.headings)}`);
    if (j(sorted(fromRender.tables)) !== j(sorted(fromShape.tables))) problems.push(`tables (section, header cells) — render: ${j(fromRender.tables)}; shape: ${j(fromShape.tables)}`);
    if (j(sorted(fromRender.comments)) !== j(sorted(fromShape.comments))) problems.push(`comments — render: ${j(fromRender.comments)}; shape: ${j(fromShape.comments)}`);
    if (j(sorted(fromRender.notes)) !== j(sorted(fromShape.notes))) problems.push(`notes (by section) — render: ${j(fromRender.notes)}; shape: ${j(fromShape.notes)}`);
    return problems;
  };

  const sample = [
    '# T', '',
    '## A <!-- a heading comment -->', '',
    '- item', '  <!-- under the item -->', '- <!-- an item that is a comment -->', '',
    '<!-- Seeded --> and prose', '',
    'Text <!-- inline, so prose --> text.', '',
    '> a note <!-- part of the note -->', '',
    '### B', '',
    '#### {Example}', '',
    'Example text.', '',
    '| x | y |', '|---|---|', '',
    '## {Area}', '',
    '<!-- under a placeholder -->', '',
    '| p | q |', '|---|---|', ''
  ].join('\n');
  const seen = renderReading(sample);
  assert.deepEqual(
    sorted(seen.comments),
    sorted([['A', '', '<!-- a heading comment -->'], ['A', '', '<!-- under the item -->'], ['A', '', '<!-- an item that is a comment -->'], ['A', '', '<!-- Seeded -->']]),
    "vacuity guard: render's reading finds the comments a shape counts, and only those"
  );
  assert.deepEqual(seen.tables, [['A', 'B', 2]], 'vacuity guard: a table after a `####` placeholder belongs to the section above it');
  assert.deepEqual(seen.notes, [['A', '']], 'vacuity guard: the note is found, once, with the comment inside it part of it');
  assert.deepEqual(readingMismatch(seen, shapeReading(sample)), [], 'the shape reads the sample the way render does');
  assert.notDeepEqual(readingMismatch(seen, shapeReading(sample.replace('  <!-- under the item -->\n', ''))), [], 'mutation: a comment the shape does not see is a mismatch');
  assert.notDeepEqual(readingMismatch(seen, shapeReading(sample.replace('| x | y |\n|---|---|\n', ''))), [], 'mutation: a table the shape does not see is a mismatch');
  assert.notDeepEqual(readingMismatch(seen, shapeReading(sample.replace('### B', '### C'))), [], 'mutation: a section the shape names differently is a mismatch');
  // A note inside a list item: render shows it, the shape does not read it, so
  // the comparison rejects it — the guard for a template that adds one.
  const nested = sample.replace('- <!-- an item that is a comment -->', '- <!-- an item that is a comment -->\n- > New guidance for the AI.');
  assert.deepEqual(renderReading(nested).notes, [['A', ''], ['A', '']], 'vacuity guard: render finds the note in the list item');
  assert.notDeepEqual(readingMismatch(renderReading(nested), shapeReading(nested)), [], 'mutation: a note inside a list item is a mismatch, so a template cannot carry one unread');

  let comments = 0;
  let tables = 0;
  let notes = 0;
  for (const [key, e] of Object.entries(registry.templates)) {
    const rel = `templates/${key.split('/')[0]}/${e.source}`;
    const text = await readFile(join(repoRoot, rel), 'utf8');
    const fromRender = renderReading(text, e.variable);
    comments += fromRender.comments.length;
    tables += fromRender.tables.length;
    notes += fromRender.notes.length;
    assert.deepEqual(
      readingMismatch(fromRender, shapeReading(text, e.variable)), [],
      `${rel}: the shape and dflow render read this template differently, so a change render shows could leave the shape number where it is. Move what the shape does not read to a form it reads (a top-level table or \`>\` note; a comment on a line of its own), or teach extractShapeSections to read it.`
    );
  }
  assert.ok(comments >= 26 && tables >= 26 && notes >= 26, `vacuity guard: the templates' comments, tables and notes were compared (${comments} comments, ${tables} tables, ${notes} notes)`);
}

// --- (2) doctor ------------------------------------------------------------------
let projectCounter = 0;

function pipeStdin(lines) {
  const stream = new PassThrough();
  stream.end(lines.join('\n') + '\n');
  return stream;
}

function captureStream() {
  const stream = new PassThrough();
  stream.setEncoding('utf8');
  stream.text = '';
  stream.on('data', (chunk) => { stream.text += chunk; });
  return stream;
}

// '1' = greenfield, '2' = brownfield (init's first question).
async function newProject(edition) {
  projectCounter += 1;
  const dir = join(tempRoot, `p${projectCounter}`);
  await mkdir(dir, { recursive: true });
  const stdout = captureStream();
  const stderr = captureStream();
  const answers = [edition, 'Node 20, Express 4, Jest', 'none', '1', '2', '1', '1', '1', 'y'];
  const code = await init.runInit({ cwd: dir, stdin: pipeStdin(answers), stdout, stderr });
  assert.equal(code, 0, `init failed in ${dir}\n${stdout.text}\n${stderr.text}`);
  return dir;
}

async function doctorAt(cwd) {
  const stdout = captureStream();
  const stderr = captureStream();
  const code = await init.runDoctor({ cwd, stdout, stderr });
  assert.equal(code, 0, `doctor exited ${code}\n${stderr.text}`);
  return stdout.text;
}

const CLEAN = /All checks passed/;
const specs = (dir, rel) => join(dir, 'dflow/specs', rel);
async function put(dir, rel, text) {
  await mkdir(join(specs(dir, rel), '..'), { recursive: true });
  await writeFile(specs(dir, rel), text);
}
async function projectedTemplate(dir, name) {
  const text = await readFile(specs(dir, `shared/dflow-workflows/templates/${name}`), 'utf8');
  assert.ok(text.startsWith(`${BUNDLE_MARKER}\n\n`), `projected ${name} no longer starts with the bundle marker; this fixture strips exactly that`);
  return text.slice(BUNDLE_MARKER.length + 2);
}
const markerOf = (text) => doctorChecks.findShapeMarkerLines(text)[0].text;
// A feature `_index.md` whose `## Phase Specs` table has no row — a zero-phase
// host (D5) — made by structure, not by matching the template's example row:
// rows are not part of a shape, so a harmless edit to that row must not break it.
function withoutPhaseSpecRows(text) {
  const lines = text.split('\n');
  const heading = lines.findIndex((l) => /^## Phase Specs\b/.test(l));
  assert.ok(heading >= 0, 'fixture: the _index.md template has a `## Phase Specs` section');
  let header = heading + 1;
  while (header < lines.length && !lines[header].startsWith('|')) header += 1;
  let end = header + 2;
  while (end < lines.length && lines[end].startsWith('|')) end += 1;
  const out = [...lines.slice(0, header + 2), ...lines.slice(end)].join('\n');
  assert.notEqual(doctorChecks.sectionTableRowCount(text, 'Phase Specs'), 0, 'fixture: the Phase Specs table had a row to remove');
  assert.equal(doctorChecks.sectionTableRowCount(out, 'Phase Specs'), 0, 'fixture: the Phase Specs table has no row left');
  return out;
}
const withoutMarker = (text) => text.split('\n').filter((l) => !l.startsWith('<!-- dflow-shape:')).join('\n');

// D6 item 5: a fresh init is silent, and so is every projected template placed
// where a flow puts it — the doctor half of "a doc created from a template".
for (const [edition, track] of [['1', 'greenfield'], ['2', 'brownfield']]) {
  const p = await newProject(edition);
  assert.match(await doctorAt(p), CLEAN, `${track}: a fresh init must be silent`);
  let placed = 0;
  for (const [key, entry] of Object.entries(registry.templates)) {
    if (!key.startsWith(`${track}/`) || !entry.source.startsWith('templates/')) continue;
    const text = await projectedTemplate(p, basename(entry.source));
    for (const pattern of entry.paths) {
      await put(p, pattern.replace(/\*/g, 'sample'), text);
      placed += 1;
    }
  }
  assert.ok(placed >= 12, `${track}: vacuity guard — only ${placed} templates were placed`);
  const out = await doctorAt(p);
  assert.match(out, CLEAN, `${track}: every projected template placed at its flow path must leave doctor silent\n${out}`);
}

// The states, on one greenfield project each so no finding hides another.
{
  // No marker, at a mapped path → one aggregated info (D5); unmapped → not counted.
  const p = await newProject('1');
  await writeFile(specs(p, 'domain/glossary.md'), withoutMarker(await readFile(specs(p, 'domain/glossary.md'), 'utf8')));
  await put(p, 'domain/ordering/rules.md', withoutMarker(await projectedTemplate(p, 'rules.md')));
  await put(p, 'domain/notes.md', '# Notes\n\nNot created from any template.\n');
  await put(p, 'domain/ordering/rules-old.md', withoutMarker(await projectedTemplate(p, 'rules.md')));
  const out = await doctorAt(p);
  assert.match(out, /\[info\] 2 spec doc\(s\) have no shape marker/, `unmarked docs at flow paths are counted, once\n${out}`);
  assert.match(out, /dflow\/specs\/domain\/glossary\.md/);
  assert.doesNotMatch(out, /notes\.md|rules-old\.md/, 'docs at no flow path are not counted (D7: renamed or moved docs are a disclosed gap)');
  assert.match(out, /upgrading\.en\.md#shape-markers/, 'the finding points at the one-time procedure');
  assert.doesNotMatch(out, /For every other doc:/, 'no host is listed apart, so the action has no exception to state');
  assert.doesNotMatch(out, CLEAN);
}
{
  // Every unjudged doc is named — the one-time procedure works from this list.
  const p = await newProject('1');
  const rules = withoutMarker(await projectedTemplate(p, 'rules.md'));
  for (let i = 1; i <= 12; i += 1) await put(p, `domain/ctx${String(i).padStart(2, '0')}/rules.md`, rules);
  const out = await doctorAt(p);
  assert.match(out, /\[info\] 12 spec doc\(s\) have no shape marker/, out);
  for (let i = 1; i <= 12; i += 1) assert.match(out, new RegExp(`domain/ctx${String(i).padStart(2, '0')}/rules\\.md`), `doc ${i} of 12 must be named`);
  assert.doesNotMatch(out, /and \d+ more/, 'no truncated list');
}
{
  // A path doctor cannot read is named as unjudged — never a clean report.
  const fsp = createRequire(import.meta.url)('node:fs/promises');
  const { readFile: realReadFile, readdir: realReaddir } = fsp;
  const p = await newProject('1');
  const denied = (code) => Object.assign(new Error(`${code}: denied`), { code });
  fsp.readFile = function (file, ...rest) {
    if (String(file).replace(/\\/g, '/').endsWith('dflow/specs/domain/glossary.md')) return Promise.reject(denied('EACCES'));
    return realReadFile.call(this, file, ...rest);
  };
  await put(p, 'domain/locked/rules.md', '# x\n');
  fsp.readdir = function (dir, ...rest) {
    if (String(dir).replace(/\\/g, '/').endsWith('dflow/specs/domain/locked')) return Promise.reject(denied('EPERM'));
    return realReaddir.call(this, dir, ...rest);
  };
  let out;
  try {
    out = await doctorAt(p);
  } finally {
    fsp.readFile = realReadFile;
    fsp.readdir = realReaddir;
  }
  assert.match(out, /\[warn\] 2 path\(s\) under dflow\/specs\/ could not be read/, out);
  assert.match(out, /dflow\/specs\/domain\/glossary\.md \(EACCES\)/);
  assert.match(out, /dflow\/specs\/domain\/locked\/ \(EPERM\)/);
  assert.doesNotMatch(out, CLEAN);
}
{
  // `shared/_overview.md` is looked up with a stat of its own: an error other
  // than "not there" names it as unjudged instead of aborting the whole doctor run.
  const fsp = createRequire(import.meta.url)('node:fs/promises');
  const { lstat: realLstat } = fsp;
  const p = await newProject('1');
  fsp.lstat = function (file, ...rest) {
    if (String(file).replace(/\\/g, '/').endsWith('dflow/specs/shared/_overview.md')) {
      return Promise.reject(Object.assign(new Error('EACCES: denied'), { code: 'EACCES' }));
    }
    return realLstat.call(this, file, ...rest);
  };
  let out;
  try {
    out = await doctorAt(p);
  } finally {
    fsp.lstat = realLstat;
  }
  assert.match(out, /\[warn\] 1 path\(s\) under dflow\/specs\/ could not be read/, out);
  assert.match(out, /dflow\/specs\/shared\/_overview\.md \(EACCES\)/);
  assert.doesNotMatch(out, CLEAN);
}
{
  // A symbolic link is taken for what it points at, and one that cannot be
  // followed is named — never a doc that silently drops out of the report.
  const p = await newProject('1');
  const outside = join(tempRoot, `outside-${projectCounter}`);
  await mkdir(join(outside, 'ctx'), { recursive: true });
  const glossary = specs(p, 'domain/glossary.md');
  await writeFile(join(outside, 'glossary.md'), withoutMarker(await readFile(glossary, 'utf8')));
  await writeFile(join(outside, 'ctx', 'rules.md'), withoutMarker(await projectedTemplate(p, 'rules.md')));
  await unlink(glossary);
  // A file link needs a privilege on Windows without Developer Mode; a junction
  // (the directory cases) does not, so those always run.
  let fileLinks = true;
  try {
    await symlink(join(outside, 'glossary.md'), glossary, 'file');
    await symlink(join(outside, 'missing.md'), specs(p, 'domain/gone.md'), 'file');
  } catch (error) {
    if (error.code !== 'EPERM') throw error;
    fileLinks = false;
    console.log('doc-shapes: file symlinks need a privilege on this host; the file-link cases were skipped (the directory cases ran)');
  }
  await symlink(join(outside, 'ctx'), specs(p, 'domain/linked'), 'junction');
  await symlink(specs(p, 'domain'), specs(p, 'domain/loop'), 'junction');
  // The same directory reached first under a path no flow uses (`aaa/` sorts
  // before `domain/`), then through a link at a flow path: judged at the second.
  await put(p, 'aaa/rules.md', withoutMarker(await projectedTemplate(p, 'rules.md')));
  await symlink(specs(p, 'aaa'), specs(p, 'domain/aliased'), 'junction');
  if (fileLinks) {
    await unlink(specs(p, 'shared/_overview.md'));
    await symlink(join(outside, 'no-overview.md'), specs(p, 'shared/_overview.md'), 'file');
  }
  const out = await doctorAt(p);
  assert.match(out, /dflow\/specs\/domain\/linked\/rules\.md/, `a doc under a linked directory is judged\n${out}`);
  assert.match(out, /dflow\/specs\/domain\/aliased\/rules\.md/, 'an alias of a directory already walked elsewhere is judged under its own path');
  assert.doesNotMatch(out, /domain\/loop\//, 'a link back to an ancestor is not walked again');
  if (fileLinks) {
    assert.match(out, /dflow\/specs\/domain\/glossary\.md[,.]/, 'a linked doc is judged');
    assert.match(out, /dflow\/specs\/domain\/gone\.md \(ENOENT\)/, 'a link that cannot be followed is named as unread');
    assert.match(out, /dflow\/specs\/shared\/_overview\.md \(ENOENT\)/, 'an `_overview.md` that links nowhere is named as unread, not taken as absent');
  }
  assert.doesNotMatch(out, CLEAN);
}
{
  // Newer than this CLI → warn.
  const p = await newProject('1');
  const f = specs(p, 'shared/_overview.md');
  await writeFile(f, (await readFile(f, 'utf8')).replace('greenfield/_overview.md 1', 'greenfield/_overview.md 9'));
  const out = await doctorAt(p);
  assert.match(out, /\[warn\] 1 spec doc\(s\) carry a shape number newer than this CLI knows/, out);
  assert.match(out, /greenfield\/_overview\.md` 9; this CLI: 1/);
}
{
  // Unreadable → uncertain, under its own id, and the report is not clean (PROPOSAL-084).
  const p = await newProject('1');
  const rules = await projectedTemplate(p, 'rules.md');
  await put(p, 'domain/a/rules.md', rules.replace(/greenfield\/rules\.md 1 —/, 'greenfield/rules.md one —'));
  await put(p, 'domain/b/rules.md', `${rules}\n${markerOf(rules)}\n`);
  await put(p, 'domain/c/rules.md', rules.replace('greenfield/rules.md', 'greenfield/nope.md'));
  await put(p, 'domain/d/rules.md', rules.replace('greenfield/rules.md', 'brownfield/events.md'));
  // No marker on the first line, one inside a list item's multi-line comment:
  // doctor does not decide whether that one is live (D2).
  await put(p, 'domain/e/rules.md', `${withoutMarker(rules)}\n- a list item\n  <!--\n  ${markerOf(rules)}\n  -->\n`);
  // Copied whole from the projected copy: the bundle's own first line pushes the
  // marker down — the one cause doctor can name.
  await put(p, 'domain/f/rules.md', `${BUNDLE_MARKER}\n\n${rules}`);
  // Frontmatter behind a byte-order mark: render does not see it either — the
  // other cause doctor can name.
  await put(p, 'domain/g/context.md', `\uFEFF${await projectedTemplate(p, 'context-definition.md')}`);
  const out = await doctorAt(p);
  assert.match(out, /\[uncertain\] 7 spec doc\(s\) have a shape marker doctor cannot read \(unreadable-shape-marker\)/, out);
  assert.match(out, /g\/context\.md \(line \d+ mentions `dflow-shape:`, but a marker is read only from line 1; the file starts with a byte-order mark \(BOM\), which hides its frontmatter from `dflow render` too — save it as UTF-8 without a BOM\)/);
  assert.match(out, /f\/rules\.md \(line 3 mentions `dflow-shape:`, but a marker is read only from line 1; line 1 is `<!-- dflow-generated: workflow-bundle -->`, copied from the template's projected copy — delete it and the blank line after it\)/);
  assert.match(out, /a\/rules\.md \(line 1 is not a well-formed marker\)/);
  assert.match(out, /b\/rules\.md \(marker lines at 1, \d+\)/);
  assert.match(out, /names `greenfield\/nope\.md`, which this CLI does not ship/);
  assert.match(out, /names `brownfield\/events\.md`, which this CLI does not ship/, 'a template the OTHER track lacks is unknown too');
  assert.match(out, /e\/rules\.md \(line \d+ mentions `dflow-shape:`, but a marker is read only from line 1\)/);
  assert.match(out, /reword it so it no longer contains `dflow-shape:`/, 'the action covers a marker quoted or commented out elsewhere');
  assert.match(out, /This report is INCOMPLETE/);
  assert.doesNotMatch(out, CLEAN);
}
{
  // Out of scope: completed and backlog features, and Dflow-managed shared/.
  const p = await newProject('1');
  const broken = '<!-- dflow-shape: broken -->\n# x\n';
  await put(p, 'features/completed/SPEC-20250101-001-done/_index.md', broken);
  await put(p, 'features/backlog/idea.md', broken);
  await put(p, 'features/stray.md', broken);
  await put(p, 'shared/notes.md', broken);
  assert.match(await doctorAt(p), CLEAN, 'completed/, backlog/, a file directly under features/, and shared/ (other than _overview.md) are not scanned');
}
{
  // An open zero-phase host is listed apart; a phase-bearing one is not.
  const p = await newProject('1');
  const index = await projectedTemplate(p, '_index.md');
  const zeroPhase = withoutPhaseSpecRows(withoutMarker(index));
  await put(p, 'features/active/SPEC-20260101-001-host/_index.md', zeroPhase);
  await put(p, 'features/active/SPEC-20260101-001-host/lightweight-2026-01-01-fix.md', withoutMarker(await projectedTemplate(p, 'lightweight-spec.md')));
  await put(p, 'features/active/SPEC-20260101-002-big/_index.md', withoutMarker(index));
  const out = await doctorAt(p);
  assert.match(out, /\[info\] 3 spec doc\(s\) have no shape marker/, out);
  const [listed, host] = out.split('Not yet closed out');
  assert.ok(host, `the open minimal host must be listed apart\n${out}`);
  assert.match(listed, /SPEC-20260101-002-big\/_index\.md/, 'a phase-bearing host is in the main list');
  assert.doesNotMatch(listed.split('[info] 3')[1], /SPEC-20260101-001-host/, 'the open minimal host is not in the main list');
  assert.match(host, /SPEC-20260101-001-host\/_index\.md/);
  assert.match(host, /SPEC-20260101-001-host\/lightweight-2026-01-01-fix\.md/);
  assert.match(out, /Leave the docs listed as not yet closed out alone: at closeout they drop out of this check\. For every other doc: Add the markers once/, 'the action leaves the open host out, as the detail says');
}
{
  // An empty Phase Specs table beside a phase spec: doctor cannot place the host,
  // so its docs are listed apart, with both ways out (D5).
  const p = await newProject('1');
  const index = await projectedTemplate(p, '_index.md');
  const zeroPhase = withoutPhaseSpecRows(withoutMarker(index));
  await put(p, 'features/active/SPEC-20260101-004-odd/_index.md', zeroPhase);
  await put(p, 'features/active/SPEC-20260101-004-odd/phase-spec-2026-01-01-first.md', withoutMarker(await projectedTemplate(p, 'phase-spec.md')));
  await put(p, 'features/active/SPEC-20260101-005-big/_index.md', withoutMarker(index));
  const out = await doctorAt(p);
  assert.match(out, /\[info\] 3 spec doc\(s\) have no shape marker/, out);
  const [listed, unclear] = out.split('Doctor cannot tell whether these belong to a minimal host that is still open');
  assert.ok(unclear, `the undecidable host must be listed apart\n${out}`);
  assert.match(listed, /SPEC-20260101-005-big\/_index\.md/, 'a phase-bearing host is in the main list');
  assert.doesNotMatch(listed.split('[info] 3')[1], /SPEC-20260101-004-odd/, 'the undecidable host is not in the main list');
  assert.match(unclear, /SPEC-20260101-004-odd\/_index\.md/);
  assert.match(unclear, /SPEC-20260101-004-odd\/phase-spec-2026-01-01-first\.md/);
  assert.match(unclear, /If the feature is a minimal host, leave them alone until closeout, like an open host; if it is not, handle them like the rest/);
  assert.doesNotMatch(out, /Not yet closed out/, 'nor is it called an open minimal host');
  assert.match(out, /For the docs whose feature doctor cannot place, first decide whether the feature is a minimal host; if it is, leave them alone too\. For every other doc: Add the markers once/, 'the action asks for that decision first');
}
{
  // A marked `_index.md` is the shape check's; checkFeatureIndexShape stays out of it.
  const p = await newProject('1');
  const index = await projectedTemplate(p, '_index.md');
  const thin = `${markerOf(index)}\n# Thin\n\n## Goals & Scope\n\nOnly this section, on purpose.\n`;
  await put(p, 'features/active/SPEC-20260101-003-thin/_index.md', thin);
  assert.match(await doctorAt(p), CLEAN, 'a marked _index.md at the current number is not compared section by section');
  await put(p, 'features/active/SPEC-20260101-003-thin/_index.md', withoutMarker(thin));
  assert.match(await doctorAt(p), /looks like an older _index\.md template shape/, 'control: without a marker the section comparison still runs');
}
{
  // Edition unknown: unmarked docs are still counted, and the finding says to confirm the track.
  const p = await newProject('1');
  await unlink(join(p, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json'));
  for (const dir of ['architecture', 'migration', 'domain']) await rm(specs(p, dir), { recursive: true, force: true });
  assert.equal(await init.inferProjectBundleEdition(p), null, 'fixture: the edition must be uninferable');
  await put(p, 'domain/glossary.md', '# Glossary\n');
  const out = await doctorAt(p);
  assert.match(out, /does not say which track it uses/, out);
}
{
  // A bundle newer than the CLI: no shape judgment at all, one warn.
  const p = await newProject('1');
  const manifestPath = join(p, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: '99.0.0' }, null, 2));
  await writeFile(specs(p, 'domain/glossary.md'), withoutMarker(await readFile(specs(p, 'domain/glossary.md'), 'utf8')));
  const out = await doctorAt(p);
  assert.match(out, /workflow bundle comes from Dflow 99\.0\.0, newer than this CLI/, out);
  assert.doesNotMatch(out, /have no shape marker/, 'with a newer bundle the shape check does not judge anything');
}
{
  // A prerelease bundle version is ordered by its numeric core: a newer core is
  // a newer bundle, so nothing is judged against this CLI's older templates.
  const p = await newProject('1');
  const manifestPath = join(p, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: '99.0.0-beta.1' }, null, 2));
  await writeFile(specs(p, 'domain/glossary.md'), withoutMarker(await readFile(specs(p, 'domain/glossary.md'), 'utf8')));
  const out = await doctorAt(p);
  assert.match(out, /workflow bundle comes from Dflow 99\.0\.0-beta\.1, newer than this CLI/, out);
  assert.doesNotMatch(out, /have no shape marker/, 'a newer prerelease bundle is not judged either');
  assert.doesNotMatch(out, CLEAN);
  // The suffix on the patch: the next patch's prerelease is still newer than this CLI.
  const cli = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')).version.split('.').map(Number);
  const nextPatchRc = `${cli[0]}.${cli[1]}.${cli[2] + 1}-rc.1`;
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: nextPatchRc }, null, 2));
  const rcOut = await doctorAt(p);
  assert.match(rcOut, new RegExp(`workflow bundle comes from Dflow ${nextPatchRc.split('.').join('[.]')}, newer than this CLI`), rcOut);
  assert.doesNotMatch(rcOut, /have no shape marker/);
}
{
  // A newer bundle also stops the section comparison of an unmarked `_index.md`:
  // this CLI's template is the older one, so "older shape" would be backwards.
  const p = await newProject('1');
  const index = await projectedTemplate(p, '_index.md');
  await put(p, 'features/active/SPEC-20260101-003-thin/_index.md', withoutMarker(`${markerOf(index)}\n# Thin\n\n## Goals & Scope\n\nOnly this section.\n`));
  assert.match(await doctorAt(p), /looks like an older _index\.md template shape/, 'control: at the same bundle version the comparison runs');
  const manifestPath = join(p, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: '99.0.0' }, null, 2));
  const out = await doctorAt(p);
  assert.match(out, /workflow bundle comes from Dflow 99\.0\.0, newer than this CLI/, out);
  assert.doesNotMatch(out, /looks like an older _index\.md template shape/, 'with a newer bundle the dashboard is not compared against this CLI\'s older template');
}
{
  // P-078's action must not send anyone to copy a template head (it carries the marker).
  const p = await newProject('1');
  await put(p, 'domain/ordering/notes.md', '# Notes\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
  const out = await doctorAt(p);
  assert.match(out, /copy only the one-line `<!-- Formatting convention/, out);
}

// An OLDER number: a package copy whose greenfield rules.md has a shape 2.
{
  const pkg = join(tempRoot, 'package-shape-2');
  for (const dir of ['bin', 'lib', 'templates', 'node_modules']) {
    await cp(join(repoRoot, dir), join(pkg, dir), { recursive: true });
  }
  await cp(join(repoRoot, 'package.json'), join(pkg, 'package.json'));
  const templatePath = join(pkg, 'templates/greenfield/templates/rules.md');
  const original = await readFile(templatePath, 'utf8');
  // The note is reworded by position — the first `>` line, the one at the top —
  // not by its wording, so a harmless edit to that note does not break this.
  let shape2 = original
    .replace('greenfield/rules.md 1 —', 'greenfield/rules.md 2 —')
    .replace(/(\| BR-ID \| Rule summary \|[^\n]*\| Last updated \|)\n(\|[-:| ]+\|)/, '$1 Owner |\n$2---|')
    .replace('## Open Questions', '## Questions')
    .replace(/^> .*$/m, (line) => `${line} One row per rule.`);
  const legend = shape2.slice(shape2.indexOf('## Status Legend'), shape2.indexOf('## Questions'));
  shape2 = shape2.replace(legend, '').replace('## Rule Index', `${legend}## Rule Index`);
  const shape2Items = doctorChecks.extractShapeSkeleton(shape2);
  assert.ok(shape2Items.some((item) => j(item) === j(['column', 'Rule Index', '', 1, 7, 'Owner'])), 'fixture: the Owner column was added at position 7 of the Rule Index table');
  assert.ok(shape2.indexOf('## Status Legend') < shape2.indexOf('## Rule Index') && shape2.indexOf(' One row per rule.') < shape2.indexOf('\n## '), 'fixture: the top note was reworded and Status Legend moved first');
  await writeFile(templatePath, shape2);
  const reg = JSON.parse(await readFile(join(pkg, REGISTRY_REL), 'utf8'));
  const entry = reg.templates['greenfield/rules.md'];
  const skeleton = doctorChecks.extractShapeSkeleton(shape2, { variable: entry.variable });
  const noteOf = (sk) => sk.find((item) => item[0] === 'note' && item[1] === '' && item[2] === '');
  const changes = [
    { kind: 'added', item: ['column', 'Rule Index', '', 1, 7, 'Owner'] },
    { kind: 'renamed', from: ['h2', 'Open Questions'], to: ['h2', 'Questions'] },
    { kind: 'reworded', from: noteOf(entry.shapes[0].skeleton), to: noteOf(skeleton) },
    { kind: 'reordered', parent: null }
  ];
  assert.equal(changeListMismatch(entry.shapes[0].skeleton, skeleton, changes), null, 'fixture: the synthetic shape 2 must itself pass the registry guard');
  entry.shapes.push({ number: 2, digest: doctorChecks.shapeDigest(skeleton), changes, skeleton });
  await writeFile(join(pkg, REGISTRY_REL), JSON.stringify(reg, null, 2));
  const pkgDoctor = (cwd) => {
    const r = spawnSync(process.execPath, [join(pkg, 'bin', 'dflow.js'), 'doctor'], { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };

  const p = await newProject('1');
  await put(p, 'domain/ordering/rules.md', await projectedTemplate(p, 'rules.md'));
  const out = await pkgDoctor(p);
  assert.match(out, /\[info\] 1 spec doc\(s\) were written against an older template shape/, out);
  assert.match(out, /`greenfield\/rules\.md 1 → 2` \(dflow\/specs\/domain\/ordering\/rules\.md\)/);
  assert.match(out, /added — column `Owner` \(position 7\) in table 1 under `## Rule Index`/, 'additions are listed as something the adopter can add');
  assert.match(out, /renamed, split, moved or removed — `## Open Questions` renamed to `## Questions`/, 'a rename is reported, never listed as an addition');
  assert.match(out, /notes, comments and section order, which do not change the doc's structure — the `>` notes at the top of the document changed; the order of the `##` sections changed/, 'notes and order are their own class');
  assert.match(out, /compare them with the current template and decide, with your AI assistant, whether to bring the doc in line/, 'with a way to handle them');
  assert.doesNotMatch(out, /Run `dflow configure-agents` first/, 'the bundle is not older than this CLI here');

  const manifestPath = join(p, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(manifestPath, JSON.stringify({ ...manifest, version: '0.0.1' }, null, 2));
  assert.match(await pkgDoctor(p), /Run `dflow configure-agents` first/, 'an older bundle means the AI cannot see the current template yet');

  // An older doc on a host doctor cannot place stays in its group — if the
  // feature is not a minimal host, the change list is what the adopter needs —
  // and the host note names it again. Needs a feature template with a shape 2.
  {
    const indexPath = join(pkg, 'templates/greenfield/templates/_index.md');
    const index1 = await readFile(indexPath, 'utf8');
    const registry1 = await readFile(join(pkg, REGISTRY_REL), 'utf8');
    // The first `>` line under `## Phase Specs`, found by position, not by wording.
    const phaseAt = index1.indexOf('\n## Phase Specs');
    const noteAt = index1.indexOf('\n>', phaseAt + 1);
    assert.ok(phaseAt >= 0 && noteAt > phaseAt && noteAt < index1.indexOf('\n## ', phaseAt + 1), 'fixture: `## Phase Specs` opens with a `>` note');
    const noteEnd = index1.indexOf('\n', noteAt + 1);
    const index2 = `${index1.slice(0, noteEnd)} (reworded)${index1.slice(noteEnd)}`.replace('greenfield/_index.md 1 —', 'greenfield/_index.md 2 —');
    assert.ok(index2.includes('_index.md 2 —') && index2.includes(' (reworded)'), 'fixture: the _index.md marker went to 2 and a Phase Specs note was reworded');
    const r = JSON.parse(registry1);
    const e = r.templates['greenfield/_index.md'];
    const sk2 = doctorChecks.extractShapeSkeleton(index2, { variable: e.variable });
    const phaseNote = (sk) => sk.find((item) => item[0] === 'note' && item[1] === 'Phase Specs');
    const indexChanges = [{ kind: 'reworded', from: phaseNote(e.shapes[0].skeleton), to: phaseNote(sk2) }];
    assert.equal(changeListMismatch(e.shapes[0].skeleton, sk2, indexChanges), null, 'fixture: the synthetic _index.md shape 2 passes the registry guard');
    e.shapes.push({ number: 2, digest: doctorChecks.shapeDigest(sk2), changes: indexChanges, skeleton: sk2 });
    await writeFile(indexPath, index2);
    await writeFile(join(pkg, REGISTRY_REL), JSON.stringify(r, null, 2));
    let qOut;
    try {
      const q = await newProject('1');
      const zeroPhase = withoutPhaseSpecRows(await projectedTemplate(q, '_index.md'));
      await put(q, 'features/active/SPEC-20260101-006-odd/_index.md', zeroPhase);
      await put(q, 'features/active/SPEC-20260101-006-odd/phase-spec-2026-01-01-first.md', await projectedTemplate(q, 'phase-spec.md'));
      qOut = await pkgDoctor(q);
    } finally {
      await writeFile(indexPath, index1);
      await writeFile(join(pkg, REGISTRY_REL), registry1);
    }
    assert.match(qOut, /`greenfield\/_index\.md 1 → 2` \(dflow\/specs\/features\/active\/SPEC-20260101-006-odd\/_index\.md\): notes, comments and section order, which do not change the doc's structure — the `>` notes under `## Phase Specs` changed/, qOut);
    assert.match(qOut, /Doctor cannot tell whether these belong to a minimal host that is still open[^\n]*SPEC-20260101-006-odd\/_index\.md[^\n]*\(they are listed with the rest above\)/);
    assert.doesNotMatch(qOut, /Not yet closed out/, 'not called an open minimal host');
  }

  // A damaged registry entry is a damaged package — never a doc that silently
  // drops out of scope, and never a crash.
  const intact = await readFile(join(pkg, REGISTRY_REL), 'utf8');
  await writeFile(specs(p, 'domain/glossary.md'), withoutMarker(await readFile(specs(p, 'domain/glossary.md'), 'utf8')));
  for (const [label, damage, expect] of [
    ['empty paths', (r) => { r.templates['greenfield/glossary.md'].paths = []; }, /entry `greenfield\/glossary\.md` has no usable paths/],
    ['paths deleted', (r) => { delete r.templates['greenfield/glossary.md'].paths; }, /entry `greenfield\/glossary\.md` has no usable paths/],
    ['entry deleted', (r) => { delete r.templates['greenfield/glossary.md']; }, /greenfield\/templates\/glossary\.md` is a template the shape check covers, but `lib\/doc-shapes\.json` has no entry for it/]
  ]) {
    const r = JSON.parse(intact);
    damage(r);
    await writeFile(join(pkg, REGISTRY_REL), JSON.stringify(r));
    const damagedOut = await pkgDoctor(p);
    assert.match(damagedOut, /The installed dflow package looks incomplete/, `${label}: must be reported as a damaged package\n${damagedOut}`);
    assert.match(damagedOut, expect, `${label}: the finding names what is wrong`);
    assert.doesNotMatch(damagedOut, CLEAN, `${label}: never a clean report`);
  }
  await writeFile(join(pkg, REGISTRY_REL), intact);

  // A template that lost its marker and its entry together: found by the covered
  // set's own rule (D3), not by the marker it no longer has.
  {
    const glossaryPath = join(pkg, 'templates', 'greenfield', 'templates', 'glossary.md');
    const glossaryText = await readFile(glossaryPath, 'utf8');
    const r = JSON.parse(intact);
    delete r.templates['greenfield/glossary.md'];
    let bothOut;
    try {
      await writeFile(join(pkg, REGISTRY_REL), JSON.stringify(r));
      await writeFile(glossaryPath, withoutMarker(glossaryText));
      bothOut = await pkgDoctor(p);
    } finally {
      await writeFile(glossaryPath, glossaryText);
      await writeFile(join(pkg, REGISTRY_REL), intact);
    }
    assert.match(bothOut, /The installed dflow package looks incomplete/, bothOut);
    assert.match(bothOut, /greenfield\/templates\/glossary\.md` is a template the shape check covers, but `lib\/doc-shapes\.json` has no entry for it/);
    assert.doesNotMatch(bothOut, CLEAN);
  }

  // A packaged template whose marker is not its registry entry's last shape is a
  // damaged package as well: never an invented "1 → 2" with advice to renumber.
  const glossaryTemplate = join(pkg, 'templates', 'greenfield', 'templates', 'glossary.md');
  const glossaryIntact = await readFile(glossaryTemplate, 'utf8');
  await writeFile(specs(p, 'domain/glossary.md'), await projectedTemplate(p, 'glossary.md'));
  assert.ok(/<!-- dflow-shape: greenfield\/glossary\.md 1 /.test(glossaryIntact), 'fixture: the packaged glossary is at shape 1');
  await writeFile(glossaryTemplate, glossaryIntact.replace('<!-- dflow-shape: greenfield/glossary.md 1 ', '<!-- dflow-shape: greenfield/glossary.md 2 '));
  let aheadOut;
  try {
    aheadOut = await pkgDoctor(p);
  } finally {
    await writeFile(glossaryTemplate, glossaryIntact);
  }
  assert.match(aheadOut, /The installed dflow package looks incomplete/, aheadOut);
  assert.match(aheadOut, /carries shape 2, but `lib\/doc-shapes\.json` lists 1 shape\(s\) for `greenfield\/glossary\.md`/);
  assert.match(aheadOut, /Not judged because of it: dflow\/specs\/domain\/glossary\.md\./, 'the doc the damage leaves unjudged is named');
  assert.doesNotMatch(aheadOut, /glossary\.md 1 → 2/, 'no transition the registry cannot describe');
  assert.doesNotMatch(aheadOut, CLEAN);

  // A damaged package is reported, not read as "everything is current".
  await unlink(join(pkg, REGISTRY_REL));
  const damaged = await pkgDoctor(p);
  assert.match(damaged, /The installed dflow package looks incomplete/, damaged);
  assert.match(damaged, /lib\/doc-shapes\.json` could not be read/);
}

await rm(tempRoot, { recursive: true, force: true });
console.log('doc-shapes: all assertions passed');
