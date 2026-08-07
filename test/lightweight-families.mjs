// No-BR six-family lightweight-spec contract (PROPOSAL-082 / G1, G9, G21, G32).
//
// A change can reach T2 carrying no BR delta at all — cross-page copy sweeps,
// non-breaking contract changes, security work, performance work,
// implementation defects, planned interaction changes. The families describe
// how to write a spec the cascade has ALREADY placed at T2; none of them makes
// a change T2, and none overrides an earlier cascade step (a Download-PDF
// button is step 0 new-feature, not family (f)). Both
// lightweight-spec templates therefore define one legal shape per family, so an
// AI is never pushed into inventing a BR-NN or writing a fake root cause; the
// completion and pr-review checklists verify each family's own evidence instead
// of vacuously passing the BR / Domain items on an empty delta set.
//
// Nothing in lib/ parses spec bodies, and nothing should — the shipped contract
// is prose, and adopter-authored specs are never machine-gated. So this test
// pins two things instead:
//
//   1. contract vs. surfaces — every family's BR line, evidence sections and
//      inline labels appear in both track templates and on all four reader
//      surfaces, driven from the FAMILIES table below so no surface can quietly
//      drop a family or rename a field.
//   2. the contract discriminates — a pure validator built from the same table
//      accepts one well-formed fixture per family (plus the classic BR-delta
//      form and the older single-`BR:` bug form, which stay legal and are never
//      migrated) and rejects malformed ones. Without the negative fixtures the
//      first layer would only prove the strings exist somewhere.
//
// Then the two tutorial BUG specs are run through the same validator, so the
// shipped fixtures and the contract cannot drift apart.
//
// Surface checks compare whitespace-normalized text: the checklists are
// hard-wrapped, so `**SLA / resource context**` really does span two lines in
// pr-review-checklist.md and a raw substring check would miss it.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const EDITIONS = ['greenfield', 'brownfield'];

// The contract. `specSections` are the H2s a spec of that family must carry;
// `labels` are the inline bold labels inside them; `surfaceTokens` are what a
// reader surface must name so a reviewer knows what to look for.
const FAMILIES = [
  {
    key: 'a',
    brSuffix: 'presentation',
    specSections: ['Output Footprint'],
    labels: [],
    surfaceTokens: ['Output Footprint'],
  },
  {
    key: 'b',
    brSuffix: 'contract change',
    specSections: ['Contract Delta'],
    labels: ['**Downstream consumers**'],
    surfaceTokens: ['Contract Delta', '**Downstream consumers**'],
  },
  {
    key: 'c',
    brSuffix: 'operational',
    specSections: ['Operational Rationale'],
    labels: ['**Trace**'],
    surfaceTokens: ['Operational Rationale', '**Trace**'],
  },
  {
    key: 'd',
    brSuffix: 'performance',
    specSections: ['Performance Delta'],
    labels: ['**SLA / resource context**'],
    surfaceTokens: ['Performance Delta', '**SLA / resource context**'],
  },
  {
    key: 'e',
    brSuffix: 'implementation defect',
    // The one family that keeps Root Cause: the rule is unchanged, the
    // implementation was wrong, so the defect still needs a cause and a
    // regression check — and the rules it sits under stay traceable.
    splitBrField: true,
    governingField: 'Governing BR-IDs:',
    specSections: ['Problem', 'Root Cause', 'Fix Approach'],
    labels: [],
    requiresRegression: true,
    surfaceTokens: ['Governing BR-IDs'],
  },
  {
    key: 'f',
    brSuffix: 'intentional change',
    specSections: ['Change Rationale'],
    labels: ['**Before**', '**After**', '**Regression**'],
    surfaceTokens: ['Change Rationale', '**Before**', '**After**', '**Regression**'],
  },
];

const familyByKey = (key) => FAMILIES.find((f) => f.key === key);
const brLineOf = (family) => (family.splitBrField
  ? `BR Delta: none — ${family.brSuffix}`
  : `BR: none — ${family.brSuffix}`);

const squash = (text) => text.replace(/\s+/g, ' ');

// --- pure validator -------------------------------------------------------

function sectionBody(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

function headingsOf(text) {
  return text.split(/\r?\n/)
    .filter((line) => /^##\s/.test(line))
    .map((line) => line.replace(/^##\s+/, '').trim());
}

// Which shape is this spec written in? Returns one of:
//   { form: 'no-BR', family }            — a declared no-BR family
//   { form: 'no-BR', family: null, declared } — claims a family that doesn't exist
//   { form: 'classic' }                  — BR-delta entries (still native)
//   { form: 'legacy-single-br' }         — the older single `BR:` line bug form
//   { form: 'no-behavior-delta' | 'unknown' }
function classify(text) {
  const delta = sectionBody(text, 'Behavior Delta');
  if (delta === null) return { form: 'no-behavior-delta' };

  if (/^BR Delta:/m.test(delta)) {
    const m = delta.match(/^BR Delta:\s*none\s*—\s*(.+?)\s*$/m);
    const family = m ? FAMILIES.find((f) => f.splitBrField && f.brSuffix === m[1]) : null;
    return family ? { form: 'no-BR', family } : { form: 'no-BR', family: null, declared: m ? m[1] : '(unparsed)' };
  }

  const declared = delta.match(/^BR:\s*none\s*—\s*(.+?)\s*$/m);
  if (declared) {
    const family = FAMILIES.find((f) => !f.splitBrField && f.brSuffix === declared[1]);
    return family ? { form: 'no-BR', family } : { form: 'no-BR', family: null, declared: declared[1] };
  }

  // A bare `BR:` line with no family suffix is the legacy bug form: accepted as
  // written, never migrated.
  if (/^BR:\s*\S/m.test(delta)) return { form: 'legacy-single-br' };

  if (/Rule:\s*BR-/.test(delta) || /^###\s+(ADDED|MODIFIED|REMOVED|RENAMED|UNCHANGED)\b/m.test(delta)) {
    return { form: 'classic' };
  }
  return { form: 'unknown' };
}

// "regression" appearing anywhere is not a regression check — a spec can say
// "no regression test needed" and satisfy a bare token search. Require an
// actionable item: a task checkbox or a `**Regression**:` label, and reject the
// line if it reads as a disclaimer or a deferral rather than a check.
//
// Honest limit: this pins the shape, not the substance. A line that claims a
// regression check in good-faith wording but describes nothing real still
// passes — judging whether the check is adequate is the completion checklist's
// job, where a person or an agent actually reads it. The point here is that a
// spec cannot satisfy the family (e) contract with the word alone.
// Deliberately does NOT include a bare "needed": "regression test needed for
// the half-surrogate input" is evidence, "no regression test needed" is not —
// and the negations below already catch the second.
const REGRESSION_NON_EVIDENCE = /\b(no|not|n\/a|none|skip(ped)?|unnecessary|defer(red)?|later|follow-up|follow up|pending|todo|tbd)\b/i;

function hasRegressionEvidence(text) {
  return text.split(/\r?\n/).some((line) => {
    if (!/regression/i.test(line)) return false;
    const actionable = /^\s*[-*]\s*\[[ xX]?\]/.test(line) || /\*\*Regression\*\*\s*:/.test(line);
    if (!actionable) return false;
    return !REGRESSION_NON_EVIDENCE.test(line);
  });
}

function validate(text) {
  const problems = [];
  const verdict = classify(text);

  if (verdict.form === 'classic' || verdict.form === 'legacy-single-br') return problems;

  if (verdict.form !== 'no-BR') {
    problems.push(`unrecognised lightweight-spec form: ${verdict.form}`);
    return problems;
  }
  if (!verdict.family) {
    problems.push(`declares an unknown no-BR family: "${verdict.declared}"`);
    return problems;
  }

  const family = verdict.family;
  const headings = headingsOf(text);
  const delta = sectionBody(text, 'Behavior Delta') ?? '';

  for (const section of family.specSections) {
    if (!headings.includes(section)) {
      problems.push(`family (${family.key}) is missing the "${section}" section`);
      continue;
    }
    // A heading with nothing under it is not evidence. Strip the labels the
    // contract already requires separately, and demand something is left.
    let body = sectionBody(text, section) ?? '';
    for (const label of family.labels) body = body.split(label).join(' ');
    if (body.replace(/[\s>*_`:—-]/g, '').length < 12) {
      problems.push(`family (${family.key})'s "${section}" section is empty or has no substance beyond its labels`);
    }
  }
  // Labels count only inside the family's own evidence section. A `**Trace**`
  // that happens to appear somewhere else in the document is not evidence for
  // this family, and matching it anywhere would let an empty section pass.
  if (family.labels.length) {
    const evidence = sectionBody(text, family.specSections[0]);
    for (const label of family.labels) {
      if (evidence === null || !squash(evidence).includes(label)) {
        problems.push(`family (${family.key}) is missing the ${label} line inside "${family.specSections[0]}"`);
      }
    }
  }
  if (family.governingField) {
    const m = delta.match(new RegExp(`^${family.governingField}\\s*(.*)$`, 'm'));
    if (!m) problems.push(`family (${family.key}) is missing the ${family.governingField} field`);
    else if (!m[1].trim()) {
      // An empty field erases the traceability the split field exists for:
      // a genuinely uncatalogued defect records `none`, not nothing.
      problems.push(`family (${family.key}) leaves ${family.governingField} empty — record the BR-IDs, or \`none\``);
    }
  }
  if (family.requiresRegression && !hasRegressionEvidence(text)) {
    problems.push(`family (${family.key}) records no actionable regression check`);
  }
  // A no-BR spec still carrying a `Rule: BR-NN` delta entry invented one to fill
  // the template. Family (e) is included, not exempt: it points at its governing
  // rules through `Governing BR-IDs:`, never through a delta heading — and that
  // heading is exactly the shape the tutorial BUG fixtures were converted away
  // from, so the guard must catch a revert to it.
  // Scoped to Behavior Delta: prose elsewhere may legitimately name a rule ("the
  // handler diverged from Rule: BR-007") without claiming a delta. And a bare
  // ADDED/MODIFIED block counts too — that is the same fabrication with the
  // `Rule:` label filed off.
  // Scoping to the delta section fixed one false positive and opened a hole: a
  // `#### Rule: BR-NN` heading parked under the evidence section passed. A *heading*
  // is fabrication wherever it sits, so it is checked document-wide; a bare
  // ADDED/MODIFIED block (the same thing with the label filed off) is checked in the
  // delta section. Prose that merely names a rule stays legitimate either way.
  if (/^#{1,6}\s.*Rule:\s*BR-\d/m.test(text) || /^#{3,4}\s+(ADDED|MODIFIED|REMOVED|RENAMED)\b/m.test(delta)) {
    problems.push(`family (${family.key}) carries a fabricated BR-NN delta entry`);
  }
  return problems;
}

// --- fixtures -------------------------------------------------------------

const frontmatter = [
  '---',
  'title: fixture',
  'status: in-progress',
  'bounded-context: none',
  'created: 2026-07-23',
  'branch: feature/SPEC-20260723-001-fixture',
  '---',
  '',
  '# fixture',
  '',
].join('\n');

const spec = (deltaBody, sections) => `${frontmatter}## Behavior Delta\n\n${deltaBody}\n\n${sections}\n`;

const POSITIVE = {
  a: spec('BR: none — presentation',
    '## Output Footprint\n\nSettings, Profile and Billing screens; the shared `accountLabel` key renders on all three.'),
  b: spec('BR: none — contract change',
    '## Contract Delta\n\nAdds the optional `tenant_id` field to the `order.settled` export row.\n\n**Downstream consumers**: the finance warehouse loader and the partner reconciliation job.'),
  c: spec('BR: none — operational',
    '## Operational Rationale\n\nBumps the session library past a session-fixation advisory; auth behavior is unchanged.\n\n**Trace**: GHSA-xxxx-yyyy-zzzz, reviewed 2026-07-20.'),
  d: spec('BR: none — performance',
    '## Performance Delta\n\nNightly settlement batch drops from 51 to 12 minutes; no output changes.\n\n**SLA / resource context**: keeps the batch inside the 02:00–04:00 window and frees ~3 GB of peak heap.'),
  e: spec('BR Delta: none — implementation defect\nGoverning BR-IDs: BR-007',
    '## Problem\n\nA valid reject reason is refused.\n\n## Root Cause\n\nThe form truncates inside a surrogate pair.\n\n## Fix Approach\n\nGrapheme-aware truncation.\n\n## Implementation Tasks\n\n- [ ] TEST-1: regression test for the half-surrogate input'),
  f: spec('BR: none — intentional change',
    '## Change Rationale\n\n**Before**: checkout returns the customer to the home page.\n**After**: checkout returns the customer to the order details page.\n\nSupport asked for it; no rule about where checkout lands.\n\n**Regression**: covered by the checkout redirect end-to-end test.'),
  classic: spec('### MODIFIED - behavior modified in this fix\n#### Rule: BR-007 Reject reason\n**Before**: at least 10 characters\n**After**: at least 5 CJK characters or 10 alphanumerics\n**Reason**: bilingual input',
    '## Root Cause\n\nThe threshold was written for one script only.'),
  // The older single-`BR:` bug form, written before the BR Delta / Governing
  // BR-IDs split. Still legal; adopters are never asked to migrate.
  legacy: spec('BR: BR-007 (wording unchanged)',
    '## Root Cause\n\nThe form truncates inside a surrogate pair.'),
};

// Substantive family (e) sections, so a negative fixture built on them fails only
// for the one rule it targets.
const EDEFECT_SECTIONS = '## Problem\n\nA valid reject reason is refused.\n\n## Root Cause\n\nTruncation splits a surrogate pair.\n\n## Fix Approach\n\nGrapheme-aware truncation.';

const NEGATIVE = {
  // Isolated on purpose: everything else family (e) needs is present, so this
  // fixture can only go red for the missing governing field.
  'family (e) without Governing BR-IDs': spec('BR Delta: none — implementation defect',
    '## Problem\n\nThe reject reason is refused.\n\n## Root Cause\n\nTruncation splits a surrogate pair.\n\n## Fix Approach\n\nGrapheme-aware truncation.\n\n## Implementation Tasks\n\n- [ ] TEST-1: regression test for the half-surrogate input'),
  'family (e) with an empty Governing BR-IDs': spec('BR Delta: none — implementation defect\nGoverning BR-IDs:',
    '## Problem\n\nThe reject reason is refused.\n\n## Root Cause\n\nTruncation splits a surrogate pair.\n\n## Fix Approach\n\nGrapheme-aware truncation.\n\n## Implementation Tasks\n\n- [ ] TEST-1: regression test for the half-surrogate input'),
  // The gate's case: a heading and a bare label, no actual content.
  'family (b) whose evidence section is only its label': spec('BR: none — contract change',
    '## Contract Delta\n\n**Downstream consumers**:'),
  // These three are isolated on the regression rule: every other family (e)
  // requirement is satisfied with substantive sections, so each can only go red
  // for its own reason.
  'family (e) without a regression check': spec('BR Delta: none — implementation defect\nGoverning BR-IDs: none',
    `${EDEFECT_SECTIONS}`),
  'family (e) whose only regression mention is a disclaimer': spec('BR Delta: none — implementation defect\nGoverning BR-IDs: none',
    `${EDEFECT_SECTIONS}\n\n## Implementation Tasks\n\n- [ ] TEST-1: no regression test needed here`),
  'family (e) whose regression item is a deferral': spec('BR Delta: none — implementation defect\nGoverning BR-IDs: none',
    `${EDEFECT_SECTIONS}\n\n## Implementation Tasks\n\n- [ ] TEST-1: defer regression coverage to a follow-up`),
  'family (c) whose Trace sits outside the evidence section': spec('BR: none — operational',
    '## Operational Rationale\n\nBumped past an advisory.\n\n## Notes\n\n**Trace**: GHSA-xxxx.'),
  'family (b) without downstream consumers': spec('BR: none — contract change',
    '## Contract Delta\n\nAdds an optional export field.'),
  'family (d) without SLA context': spec('BR: none — performance',
    '## Performance Delta\n\nThe batch got faster.'),
  'family (f) without a regression line': spec('BR: none — intentional change',
    '## Change Rationale\n\n**Before**: home page.\n**After**: order details.'),
  'family (a) with a fabricated BR entry': spec('BR: none — presentation\n\n#### Rule: BR-042 Copy consistency',
    '## Output Footprint\n\nSettings, Profile and Billing screens.'),
  // A Rule heading parked outside Behavior Delta is still a fabricated delta.
  'family (a) hiding a Rule heading under its evidence section': spec('BR: none — presentation',
    '## Output Footprint\n\nSettings, Profile and Billing screens.\n\n#### Rule: BR-042 Copy consistency'),
  // The same fabrication with the `Rule:` label removed.
  'family (a) with a headless MODIFIED delta block': spec('BR: none — presentation\n\n### MODIFIED - behavior modified\n**Before**: the screen said x\n**After**: it says y',
    '## Output Footprint\n\nSettings, Profile and Billing screens.'),
  // The pre-P082 shape both tutorial BUG fixtures were converted away from.
  'family (e) still carrying a Rule: BR-NN delta entry': spec('BR Delta: none — implementation defect\nGoverning BR-IDs: BR-007\n\n### MODIFIED - behavior modified\n#### Rule: BR-007 Reject reason',
    `${EDEFECT_SECTIONS}\n\n## Implementation Tasks\n\n- [ ] TEST-1: regression test for the half-surrogate input`),
  'family (a) with the evidence section missing': spec('BR: none — presentation',
    '## Root Cause\n\nSomeone wrote the wrong word three times.'),
  'a family nobody defined': spec('BR: none — vibes',
    '## Output Footprint\n\nThree screens.'),
};

// --- 1. contract vs. surfaces ---------------------------------------------

const templates = {};
for (const edition of EDITIONS) {
  templates[edition] = await readFile(join(repoRoot, `templates/${edition}/templates/lightweight-spec.md`), 'utf8');
}

// Each family's entry in the template runs from its "(x)" marker to the next
// one. Checking tokens against the whole flattened file would let the (b) and
// (c) mappings be swapped in both templates and still pass.
function familyEntry(templateText, key) {
  const flat = squash(templateText);
  const start = flat.indexOf(`(${key}) `);
  if (start === -1) return null;
  const nextKey = String.fromCharCode(key.charCodeAt(0) + 1);
  const end = flat.indexOf(`(${nextKey}) `, start);
  return flat.slice(start, end === -1 ? flat.indexOf('Family (e) keeps two fields', start) : end);
}

for (const edition of EDITIONS) {
  const flat = squash(templates[edition]);
  for (const family of FAMILIES) {
    const entry = familyEntry(templates[edition], family.key);
    assert.ok(entry, `${edition} lightweight-spec must have a "(${family.key})" family entry`);
    // The BR line, sections and labels must sit in THIS family's entry — that
    // is what binds the declaration to its evidence.
    assert.ok(entry.includes(brLineOf(family)),
      `${edition} family (${family.key}) entry must carry its own BR line: ${brLineOf(family)}`);
    for (const section of family.specSections) {
      // No "or anywhere in the file" fallback: that escape hatch would let the
      // (a) and (d) evidence mappings be swapped in both templates and pass.
      assert.ok(entry.includes(section),
        `${edition} family (${family.key}) entry must name its own "${section}" section`);
    }
    for (const label of family.labels) {
      assert.ok(entry.includes(label),
        `${edition} family (${family.key}) entry must name its own ${label} label`);
    }
    if (family.governingField) {
      assert.ok(entry.includes(family.governingField),
        `${edition} family (${family.key}) entry must document the ${family.governingField} field`);
    }
  }
  // Multi-family changes must not silently drop the other family's evidence.
  assert.ok(flat.includes('More than one family can fit'),
    `${edition} lightweight-spec must state what to do when several families match`);
  // G32: both older shapes stay legal, and the template says so.
  assert.ok(flat.includes('Legacy shapes are accepted, never migrated'),
    `${edition} lightweight-spec must state that legacy shapes are accepted, not migrated`);
  assert.ok(flat.includes('before the `BR Delta:` / `Governing BR-IDs:` split'),
    `${edition} lightweight-spec must name the pre-split single \`BR:\` bug form as legal`);
  // G9: the variant must not be written as copy/appearance-only.
  assert.ok(flat.includes('Do NOT invent a BR-NN'),
    `${edition} lightweight-spec must forbid inventing a BR-NN`);
}

// The block itself is dual-track verbatim — the families must not diverge by
// edition, only the delta example and the layer tags do.
// The end marker is the heading of the next Template-note block. P-083 2B
// reworded it "finalizing" -> "drafting" deliberately: 2A names a "Finalize +
// close" sub-step that runs AFTER checkpoint 1, while the row this list tells
// you to add must be written BEFORE it, so the old wording pointed at the wrong
// moment. Anchor on the stable half of the line rather than the verb, so the
// slice boundary survives the next rewording of the same sentence.
const blockOf = (text) => {
  const start = text.indexOf('  No-BR variants (');
  const end = text.search(/^ {2}After \w+ this lightweight-spec, AI must:$/m);
  assert.ok(start !== -1 && end > start, 'lightweight-spec must carry the No-BR variants block before the finalize list');
  return text.slice(start, end);
};
assert.equal(blockOf(templates.greenfield), blockOf(templates.brownfield),
  'the No-BR variants block must be verbatim identical across greenfield and brownfield');

// Reader surfaces: completion checklist + pr-review Spec Compliance, both tracks.
const READER_SURFACES = EDITIONS.flatMap((edition) => [
  `templates/${edition}/references/modify-existing-flow.md`,
  `templates/${edition}/references/pr-review-checklist.md`,
]);

// A reader surface lists the families inline as "(a) … ; (b) … ; …". Slice each
// family's clause so its evidence is bound to its own letter here too — checking
// that every token exists somewhere would pass with (a) and (d) swapped.
function surfaceClause(flat, key) {
  const start = flat.indexOf(`(${key}) \``);
  if (start === -1) return null;
  const nextKey = String.fromCharCode(key.charCodeAt(0) + 1);
  const end = flat.indexOf(`(${nextKey}) \``, start);
  return flat.slice(start, end === -1 ? start + 400 : end);
}

for (const rel of READER_SURFACES) {
  const flat = squash(await readFile(join(repoRoot, rel), 'utf8'));
  for (const family of FAMILIES) {
    const clause = surfaceClause(flat, family.key);
    assert.ok(clause, `${rel} must list family (${family.key}) in its evidence dispatch`);
    for (const token of family.surfaceTokens) {
      assert.ok(clause.includes(token),
        `${rel} family (${family.key}) clause must name its own evidence: ${token}`);
    }
  }
  // G35: the BR / Domain items must be recorded N/A, not passed on an empty set.
  assert.ok(flat.includes('are **N/A**'),
    `${rel} must mark the BR / Domain items N/A for no-BR specs`);
  assert.ok(/never (add|fabricate) a BR|don't fabricate a BR/.test(flat),
    `${rel} must forbid fabricating a BR to make an item pass`);
  // G32: legacy tolerance on the reader side too.
  assert.ok(flat.includes('older single `BR:` line'),
    `${rel} must accept the older single \`BR:\` line bug form`);
  assert.ok(flat.includes('accepted as-is'),
    `${rel} must accept the classic and legacy forms as-is`);
}

// --- 2. the contract discriminates ----------------------------------------

for (const [name, text] of Object.entries(POSITIVE)) {
  assert.deepEqual(validate(text), [], `positive fixture "${name}" must validate clean`);
}
// The disclaimer filter must not swallow a legitimately-worded check.
assert.ok(hasRegressionEvidence('- [ ] TEST-1: regression test needed for half-surrogate input'),
  '"regression test needed for X" is evidence, not a disclaimer');
assert.ok(!hasRegressionEvidence('- [ ] TEST-1: no regression test needed here'),
  '"no regression test needed" is a disclaimer');
assert.equal(classify(POSITIVE.classic).form, 'classic', 'the classic BR-delta form must classify as classic');
assert.equal(classify(POSITIVE.legacy).form, 'legacy-single-br', 'the single-`BR:` bug form must classify as legacy');
for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
  assert.equal(classify(POSITIVE[key]).family, familyByKey(key), `fixture ${key} must classify as family (${key})`);
}

for (const [name, text] of Object.entries(NEGATIVE)) {
  assert.notEqual(validate(text).length, 0, `negative fixture "${name}" must be rejected`);
}
// …and rejected for the intended reason: a fixture that trips a different rule
// would keep passing if the rule it targets were deleted.
const rejectsWith = (name, re) => assert.ok(validate(NEGATIVE[name]).some((p) => re.test(p)),
  `negative fixture "${name}" must be rejected by its own rule, got: ${validate(NEGATIVE[name]).join(' | ')}`);
rejectsWith('family (e) without a regression check', /regression/i);
rejectsWith('family (e) whose only regression mention is a disclaimer', /regression/i);
rejectsWith('family (e) whose regression item is a deferral', /regression/i);
rejectsWith('family (e) without Governing BR-IDs', /Governing BR-IDs/);
rejectsWith('family (e) with an empty Governing BR-IDs', /empty/);
rejectsWith('family (b) whose evidence section is only its label', /no substance/);
rejectsWith('family (a) with a fabricated BR entry', /fabricated/);
rejectsWith('family (a) with a headless MODIFIED delta block', /fabricated/);
rejectsWith('family (a) hiding a Rule heading under its evidence section', /fabricated/);
// Prose naming a rule outside Behavior Delta is not a fabricated delta.
assert.deepEqual(validate(POSITIVE.e.replace('Truncation splits a surrogate pair.', 'The handler diverged from Rule: BR-007.')), [],
  'a rule named in Root Cause prose must not read as a fabricated delta entry');
rejectsWith('family (e) still carrying a Rule: BR-NN delta entry', /fabricated/);
rejectsWith('a family nobody defined', /unknown no-BR family/);

// --- 3. shipped tutorial fixtures -----------------------------------------

// **Discovered, not enumerated.** These were two hardcoded paths until
// PROPOSAL-083 group 2D added a third BUG spec and a set of minimal hosts — and
// this whole block went on passing without ever reading any of them. A guard
// keyed on a list only ever checks the files its author already knew about,
// which is the defect it exists to catch, wearing a rule's clothes.
//
// What the rule actually is: **every shipped fixture satisfies the contract of
// the form it declares.** So run `validate()` over all of them, and assert the
// family (e) *shape* only where the spec itself declares a no-BR family.
// Globbing BUG-*.md and demanding family (e) from each would reject a
// legitimate classic BR-delta bug spec — a fixture the process permits and this
// check would refuse.
const { readdir } = await import('node:fs/promises');

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(join(repoRoot, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await walk(rel));
    else out.push(rel);
  }
  return out;
}

const tutorialFiles = await walk('tutorial');
// All three lifecycle states, not just the two a completed fixture happens to
// use today: a fixture parked in `backlog/` is still shipped, and "every
// shipped fixture satisfies its declared contract" has to mean that.
const tutorialSpecs = tutorialFiles.filter((p) =>
  /\/dflow\/specs\/features\/(active|backlog|completed)\/[^/]+\/(lightweight-|BUG-)[^/]*\.md$/.test(p));

assert.ok(tutorialSpecs.length >= 3,
  `expected the tutorial to ship several lightweight/BUG fixtures (found ${tutorialSpecs.length}) — ` +
  'if this drops, the discovery above stopped matching rather than the fixtures disappearing');

for (const rel of tutorialSpecs) {
  const text = await readFile(join(repoRoot, rel), 'utf8');
  assert.deepEqual(validate(text), [],
    `${rel} must satisfy the contract of the form it declares`);
  const { form, family } = classify(text);
  if (form === 'no-BR') {
    assert.ok(family, `${rel} declares a no-BR form but no recognised family`);
  }
}

// **Discovery does not replace this pin, it sits beside it.**
// The contract loop above asks "does each fixture satisfy the form it declares",
// which a fixture reverted to the pre-P082 `### MODIFIED` / `#### Rule: BR-NN`
// shape passes trivially: `classify()` calls that `classic`, and `validate()`
// returns early for classic with no problems. So the loop alone cannot notice a
// revert — and catching that revert is exactly what the fabrication guard above
// (see the `### MODIFIED` heading note) exists for.
//
// This list is therefore NOT the enumeration this block was rewritten to remove.
// That one listed "the fixtures that exist" and silently skipped new ones. This
// lists **the fixtures whose walkthroughs teach them as family (e)** — a set of
// deliberate promises, which is finite, known, and should fail loudly when one
// is broken. Adding a fixture does not belong here; converting one away from
// family (e) does.
const EXPECTED_FAMILY_E = [
  'tutorial/01-greenfield/outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md',
  'tutorial/02-brownfield/outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md',
  'tutorial/01-greenfield/outputs/dflow/specs/features/completed/SPEC-20260512-001-reject-not-persisted/BUG-002-reject-not-persisted.md',
];
for (const rel of EXPECTED_FAMILY_E) {
  assert.ok(tutorialSpecs.includes(rel),
    `${rel} is pinned as a family (e) fixture but discovery did not find it — ` +
    'the file moved or the selector above narrowed');
  const text = await readFile(join(repoRoot, rel), 'utf8');
  assert.equal(classify(text).family, familyByKey('e'),
    `${rel} must stay in the family (e) shape — its walkthrough teaches it as the ` +
    'evidence for "the rule was fine, the implementation was not"');
}

// A completed host holds no unfinished spec: finish-feature's own mechanical
// checks require it, so the fixtures must not model the opposite.
//
// Hosts are discovered from the **feature directories**, not from the
// `_index.md` files inside them. Deriving them from `_index.md` would make the
// "must hold an _index.md" assertion below tautological — every member would
// satisfy it by construction, which is how the previous `>= 3` replacement
// managed to be unfailable.
const HOSTS = [...new Set(tutorialFiles
  .filter((p) => /\/dflow\/specs\/features\/completed\/[^/]+\/[^/]+$/.test(p))
  .map((p) => p.slice(0, p.lastIndexOf('/')))
  .filter((d) => !d.endsWith('/completed')))].sort();

assert.ok(HOSTS.length >= 2, `expected several completed host fixtures (found ${HOSTS.length})`);

const frontmatterField = (text, field) => {
  const m = text.match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm'));
  return m ? m[1] : null;
};

for (const host of HOSTS) {
  const files = await readdir(join(repoRoot, host));
  const specs = files.filter((f) => /^(_index|phase-spec-|lightweight-|BUG-).*\.md$/.test(f));
  assert.ok(specs.includes('_index.md'), `${host} must hold an _index.md (found ${specs.join(', ')})`);

  // **No host-shape assertion here, deliberately — and this is the third
  // attempt, which is the point.**
  //
  // The original `specs.length >= 3` was wrong: it assumed a phase-bearing host
  // and rejected every minimal host the flow defines. Its replacement was
  // vacuous. Its replacement branched on host shape by parsing the Phase Specs
  // and Lightweight Changes tables out of `_index.md` — and review found *that*
  // parser wrong too (marker-vs-heading splitting, which silently swept
  // Checkpoint Log rows into the Lightweight Changes count and passed an empty
  // table).
  //
  // Three consecutive rounds finding a new defect in one check is a design
  // signal, not three implementation bugs. What that parser was really doing was
  // re-implementing closeout's own minimal-host selector inside a unit test,
  // against Markdown, with no access to the git state the real check reads. It
  // will keep being subtly wrong.
  //
  // **Stated boundary:** this block asserts what it can read reliably — the host
  // has an `_index.md`, every spec under it is `status: completed`, and every
  // spec's `branch:` matches the host's. Host *shape* (zero-phase vs
  // phase-bearing, empty-host rejection) is `finish-feature-flow.md` Step 1's
  // job, where the flow reads commits and the working tree; it is verified by
  // the 2D end-to-end harness, not here. Do not reintroduce a shape check in
  // this file without solving the parsing problem first.

  const hostBranch = frontmatterField(await readFile(join(repoRoot, host, '_index.md'), 'utf8'), 'branch');
  assert.ok(hostBranch, `${host}/_index.md must declare a branch`);

  for (const file of specs) {
    const text = await readFile(join(repoRoot, host, file), 'utf8');
    assert.equal(frontmatterField(text, 'status'), 'completed',
      `${host}/${file} sits under a completed host and must be status: completed`);
    if (file === '_index.md') continue;
    // Hosted specs take the host's branch — the `_index.md` field is
    // authoritative, including for a bug picked up by a still-active host.
    // ⚠ Unconditional on purpose. This was `if (branch !== null)`, which could
    // only ever hide a defect: every file this loop reaches (`_index.md` is
    // skipped above; the rest are `phase-spec-*` / `lightweight-*` / `BUG-*`)
    // carries a mandatory, uncommented `branch:` in its shipped template, so
    // `null` is unreachable for a correct fixture and reachable only for a
    // broken one. Deleting the `branch:` line from a fixture left the suite
    // green while the fixture violated its own template and gave
    // `finish-feature-flow.md`'s branch check nothing to read. The `status`
    // assertion four lines up is unconditional and catches that mutation class.
    const branch = frontmatterField(text, 'branch');
    assert.notEqual(branch, null,
      `${host}/${file} must carry a branch: field — its shipped template requires one`);
    assert.equal(branch, hostBranch,
      `${host}/${file} branch must equal the host _index.md branch`);
  }
}

console.log('PROPOSAL-082 no-BR six-family lightweight-spec tests passed');
