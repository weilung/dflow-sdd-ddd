// PROPOSAL-058: pure, shippable drift-detection helpers for `dflow doctor`.
//
// The dev-only cross-ref resolver (scripts/check-cross-refs.mjs, PROPOSAL-055)
// is not part of the npm package, so the runtime checks reimplement the narrow
// subset doctor needs: fence-aware heading extraction, "<file> § Heading"
// reference extraction with soft-wrap joining, tolerant heading matching, and
// template-shape comparison. Everything here is I/O-free — callers read the
// files and pass contents — which keeps the checks unit-testable.

'use strict';

// Machine-readable context lines. Shared with lib/init.js inference so the
// doctor "machine format" checks can never drift from what inference actually
// parses: inferGitPolicy / inferAiCommitMarker / inferProseLanguage read
// _conventions.md; inferTechStackSummary / inferMigrationContext read the
// `| Tech stack |` / `| Migration / legacy context |` rows of the guide's
// "## Project Context" table (PROPOSAL-076 — no packaged _overview.md template
// ever carried those rows).
const GIT_POLICY_LINE_RE = /Selected Git policy:\s*`([^`]+)`/;
const AI_COMMIT_MARKER_LINE_RE = /AI commit marker:\s*`([^`]+)`/;
const PROSE_LANGUAGE_LINE_RE = /Project prose language:\s*`([^`]+)`/;
// The row values accept Markdown-escaped pipes (`\|`) so a cell like
// `Node \| Express` is captured whole; parseContextLine unescapes them
// (PROPOSAL-076 gate G1 — a bare `[^|\n]` capture silently truncated at the
// escaped pipe while doctor still called the row machine-readable).
const TECH_STACK_ROW_RE = /\|\s*Tech stack\s*\|\s*((?:\\\||[^|\n])+?)\s*\|/i;
const MIGRATION_CONTEXT_ROW_RE = /\|\s*Migration \/ legacy context\s*\|\s*((?:\\\||[^|\n])+?)\s*\|/i;

const GIT_POLICY_VALUES = new Set(['gitflow', 'trunk']);
const AI_COMMIT_MARKER_VALUES = new Set(['none', 'co-authored-by', 'prefix']);

// Trimmed capture of a machine-readable context line, or null when the line is
// absent or its value is whitespace-only. Inference and the doctor checks must
// both parse through this helper: a value doctor accepts has to be the exact
// value configure-agents consumes (e.g. a stray space inside the backticks
// would otherwise pass doctor's trimmed validation yet miss strict comparisons
// like buildSubstitutionMap's `gitflow` check downstream).
function parseContextLine(content, re) {
  // ⚠ Read only text a reader can see. A commented-out
  // `<!-- AI commit marker: `prefix` -->` was parsed as though it were the live
  // setting, so doctor reported the policy satisfied by a line the user had
  // deliberately switched off — silent pass (`p082-b3-k1`). Callers pass whole
  // files and single rows alike; a row with no HTML block in it is unchanged.
  //
  // ⚠⚠ THE TYPE CHECK IS PART OF THAT FIX, NOT TIDINESS. This function used to
  // reach `content.match(re)` directly, so a caller handing it `undefined` got a
  // loud TypeError. Routing through the projection would have swallowed that:
  // `classifiedVisible` calls `String(content)`, turning `undefined` into the
  // four-character text "undefined", which matches nothing and returns null —
  // and null here means "the policy line is absent", a finding about the user's
  // file caused by a bug in ours. Trading a crash for a silent wrong answer is
  // the exact direction this module exists to avoid, so the crash is kept.
  if (typeof content !== 'string') {
    throw new TypeError(`parseContextLine expects a string, got ${typeof content}`);
  }
  const match = visibleTextLines(content).join('\n').match(re);
  if (!match) return null;
  // Unescape Markdown-escaped pipes captured by the table-row patterns; the
  // backtick context lines never contain `\|`, so this is a no-op for them.
  const value = match[1].replace(/\\\|/g, '|').trim();
  return value === '' ? null : value;
}

// CommonMark's line-ending definition, and the reason it is a named constant:
// every splitter in this file must use the SAME one. `/\r?\n/` handled LF and
// CRLF but not a lone CR, while the sibling checks in `lib/init.js` match with
// the `m` flag — and JS's `m` treats a lone `\r` as a line terminator. So a
// CR-only file was one giant line to this module and a normal file to them, and
// the two reported different things about it (`p082-b3-g1` finding 3).
const LINE_SPLIT_RE = /\r\n|\r|\n/;

// A thematic break: three or more `-`, `_` or `*`, optionally separated by
// spaces or tabs.
//
// ⚠ `-` is a thematic break at 3+ and a setext underline at ANY length, so the
// two roles overlap and callers must not treat this as "is an underline".
// `=` is NOT here on purpose: a lone `=+` run is not a thematic break at all —
// at a block start it is ordinary paragraph text, which is exactly the
// asymmetry the old combined `(=+|-+)` pattern erased.
//
// ⚠ WHICH of the two roles wins is not decided here, and that is the shape of
// the whole rewrite. `classifyLines` decides it from block context, in one
// place: when a document-level paragraph is open the setext reading wins
// (CommonMark 4.3); otherwise this one does. Two predicates each answering that
// question from a line's own shape is what produced this module's defect class.
//
// An ATX heading's opening sequence is 1-6 hashes followed by a space or tab.
// `[ \t]` and NOT `\s`: CommonMark accepts only a space or tab there, while JS
// `\s` also matches U+00A0, form feed and vertical tab. A line sitting in that
// gap was neither a paragraph nor a heading, so a following `---` could not
// close the section and it ran on — silent pass (`p082-b3-g3`, `p082-b3-g4`).
// U+00A0 is the realistic input: it arrives by copy-paste from a web page or a
// word processor.
//
// ⚠ There is no literal U+00A0 anywhere in this file. The paragraph above used
// to demonstrate the defect with a real one, which is indistinguishable from a
// space in a diff and which an editor may silently normalize away.
// `test/upgrade-drift.mjs` builds these characters with `String.fromCharCode`
// for precisely that reason, and this file had been ignoring its own advice.
// `test/upgrade-drift.mjs` now asserts the absence rather than trusting this
// sentence.
//
// ⚠ There is exactly ONE ATX expression in this module now, and that is a
// deliberate outcome of the debt-12 rewrite. There used to be FOUR — this
// constant plus a full-line copy inside `headingAt`, `extractHeadings` and
// `extractH2Headings` — and three separate review rounds found them disagreeing
// with each other. A shared constant that only two of the four copies read is
// not a single source of truth.
const ATX_HEADING_RE = /^ {0,3}(#{1,6})([ \t].*)?$/;

// The `{ level, text }` of an ATX heading line, or null.
//
// ⚠ The closing sequence is stripped in a SECOND step rather than by an
// optional group in the same expression, and that is a correctness fix, not a
// style preference. The old one-expression form
// `(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$` gave `## #` the text `#`: the lazy
// capture backtracks into the closing sequence, so the group meant to absorb it
// never gets the chance. CommonMark says that heading's content is EMPTY. Two
// steps cannot express the ambiguity, so they simply get it right — while still
// keeping `## Git Policy#` as the text `Git Policy#`, because the closing
// sequence must be PRECEDED by whitespace (`p082-b3-g2` finding 2 paid for
// that, and `test/upgrade-drift.mjs` pins both).
//
// An EMPTY heading (`#`, `## `, `## #`) is a real heading and really does end a
// section, so it is reported as one. `headingResolves` must go on refusing to
// resolve a reference against it — `''` prefix-matches every reference, which
// silently satisfied every cross-ref in the guide (`p082-b3-g5` finding 1).
function parseAtxHeading(line) {
  const m = line.match(ATX_HEADING_RE);
  if (!m) return null;
  const rest = (m[2] || '').replace(/[ \t]+#+[ \t]*$/, '');
  // Through `stripSpaceTab`, not a second copy of the same expression: this used
  // to spell the rule inline while the setext branch used `.trim()`, and the two
  // heading kinds then disagreed about a trailing U+00A0.
  return { level: m[1].length, text: stripSpaceTab(rest), setext: false };
}

function isThematicBreak(line) {
  return /^ {0,3}(-[ \t]*){3,}$/.test(line)
    || /^ {0,3}(\*[ \t]*){3,}$/.test(line)
    || /^ {0,3}(_[ \t]*){3,}$/.test(line);
}

// A fenced-code marker: three or more backticks, or three or more tildes.
const FENCE_MARKER = '(```+|~~~+)';
const FENCE_OPEN_RE = new RegExp(`^ {0,3}${FENCE_MARKER}(.*)$`);
const FENCE_CLOSE_RE = new RegExp(`^ {0,3}${FENCE_MARKER}[ \\t]*$`);

// Blank out fenced code blocks (``` / ~~~) line-by-line so headings and § refs
// inside examples are never extracted. Line positions are preserved. CommonMark
// close rules (PROPOSAL-076 gates G4/G6): a block closes only on the same fence
// character repeated at least the opening length, indented at most three
// spaces, with nothing but whitespace after — so a three-backtick line inside a
// four-backtick example, or an info-string line like ```js inside an open
// fence, is content and does not end the block early.
//
// This is the module's ONLY line splitter; everything downstream works on its
// output, which is what makes `LINE_SPLIT_RE` a single point of control.
//
// ⚠ The fence marker is spelled ONCE, in `FENCE_MARKER`. The open and close
// tests are genuinely different rules — a close must have nothing after it,
// while an open takes an info string — but they must agree about what a fence
// LOOKS like, and two literals cannot be relied on to. Same reason as
// `ATX_HEADING_RE` and `BULLET_MARKER`.
function blankFencedBlocks(content) {
  const lines = content.split(LINE_SPLIT_RE);
  const out = [];
  let fenceChar = null;
  let fenceLen = 0;
  for (const line of lines) {
    if (fenceChar) {
      out.push('');
      const close = line.match(FENCE_CLOSE_RE);
      if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
        fenceChar = null;
        fenceLen = 0;
      }
      continue;
    }
    // CommonMark: at most three SPACES of indent (a tab is four columns, so a
    // tab-indented fence is indented code, not a fence), and a BACKTICK fence's
    // info string may not contain a backtick. Accepting either opened a
    // pseudo-fence that blanked real headings, so a stale section ran on past
    // its own end - silent pass (`p082-b3-g4` finding 2).
    const open = line.match(FENCE_OPEN_RE);
    if (open && open[1][0] === '`' && open[2].includes('`')) {
      out.push(line);
      continue;
    }
    if (open) {
      fenceChar = open[1][0];
      fenceLen = open[1].length;
      out.push('');
      continue;
    }
    out.push(line);
  }
  return out;
}

// All Markdown heading texts (any level), fence-aware.
//
// ⚠ These two used to carry their own full-line ATX expression — two of the four
// copies that disagreed with each other. They read the classification now, which
// means three behaviours arrived here for free rather than being argued about
// one at a time:
//   - the 0-3 space indent, which was first left out here on the argument that
//     packaged inputs are generated and never indented, and which measuring
//     against the reference retired;
//   - SETEXT headings, which neither of these ever saw. A `§ Heading` reference
//     to one was reported dangling and a template section written that way
//     counted as missing — both false positives, both invisible to the pins,
//     because the pins only ever fed these functions ATX;
//   - the empty-heading and closing-sequence rules, which now cannot drift from
//     what the section walker uses, because there is nothing left to drift from.
function extractHeadings(content) {
  const lines = blankFencedBlocks(content);
  return classifyLines(lines).filter((c) => c.heading).map((c) => c.heading.text);
}

// H2 heading texts only, fence-aware — the section shape of a template.
// Level 2 covers both `## X` and a `---`-underlined setext heading.
function extractH2Headings(content) {
  const lines = blankFencedBlocks(content);
  return classifyLines(lines).filter((c) => c.heading && c.heading.level === 2).map((c) => c.heading.text);
}


// `<file>.md § Heading` references whose file basename is `targetBasename`.
// A soft-wrapped heading name is captured by joining the next line; a match
// anchored beyond the current line is left to that line's own iteration.
function extractSectionRefs(content, targetBasename) {
  // ⚠ `visibleTextLines`, not `blankFencedBlocks`: a `<file>.md § Heading`
  // written inside an HTML comment was reported as a dangling reference, and the
  // captured heading text carried the trailing `-->` into the message.
  const lines = visibleTextLines(content);
  const refs = [];
  lines.forEach((line, i) => {
    const firstLen = line.replace(/\s+$/, '').length;
    const joined = line.replace(/\s+$/, '') + ' ' + (lines[i + 1] || '').replace(/^\s+/, '');
    for (const m of joined.matchAll(/`?([A-Za-z0-9._/-]+\.md)`?\s*§\s*"?([^."`)\n]+)/g)) {
      if (m.index > firstLen) continue;
      const base = m[1].split('/').pop();
      if (base !== targetBasename) continue;
      refs.push({ line: i + 1, headingText: m[2].trim() });
    }
  });
  return refs;
}

// ⚠⚠ `.trim()` HERE IS DELIBERATE, AND IT IS NOT THE `.trim()` DEFECT CLASS.
// This was briefly "fixed" to `stripSpaceTab` on the reasoning that one rule
// should have one spelling, and that broke real files — the measurement is in
// the pins below `normalizeHeading` in `test/upgrade-drift.mjs`. Two different
// questions were being read as one:
//
//   `stripSpaceTab` answers **what the heading text IS** — block structure,
//   spec-following, deliberately strict, because a U+00A0 is not whitespace to
//   CommonMark and a section boundary must not move because of one.
//
//   `normalizeHeading` answers **whether two heading strings NAME the same
//   section** — an identity comparison over text a human retyped or pasted. It
//   is tolerant BY CONSTRUCTION and already does three things CommonMark would
//   never do: it strips ``, `*` and `_`, and (through `headingKey`) it folds
//   case. Tightening it to the block-structure rule aligned the wrong function.
//
// What tightening it actually did: `## Ceremony Scaling (Project Application)`
// with a copy-pasted trailing U+00A0 stopped matching the fingerprint, so doctor
// reported `missing` on a file that carries the rule — and `missingTemplateSections`
// reported a section absent that was present. Loud, not silent, but wrong, and
// `CONVENTIONS_FINGERPRINTS` already records this exact false `missing` happening
// once before, for case rather than for whitespace. Reproduces for U+00A0, form
// feed, vertical tab, U+2002 and U+FEFF, leading and trailing.
//
// ⚠ `extractSectionRefs` also calls `.trim()` on the *reference* side of the
// `headingResolves` comparison. That is the same rule on both sides, which is
// the property to keep: tightening one side only is what made `§ Workflow_`
// stop resolving.
function normalizeHeading(text) {
  return text.replace(/[`*_]/g, '').trim();
}

// Tolerant heading resolution: a reference resolves when it prefix-matches a
// real heading in either direction (covers soft wraps like "§ Workflow" for
// "Workflow Transparency" and shorthand references).
// ⚠ `headingKey`, not `normalizeHeading` — the difference is case folding, and
// this consumer used to be the odd one out. `CONVENTIONS_FINGERPRINTS` states
// the rule ("a heading an adopter retyped in different case is the same
// section") and `conventionsSectionBodies` implemented it, while this function
// and `missingTemplateSections` did not: `## filling the templates` was found by
// one and reported missing by the other, from the same document. One normaliser
// with three consumers, two of which skipped half of it.
function headingResolves(referenceText, headings) {
  const want = headingKey(referenceText);
  if (!want) return true;
  return headings.some((heading) => {
    const have = headingKey(heading);
    // An EMPTY heading resolves nothing. Making empty ATX headings real (so they
    // close a section, which CommonMark says they do) put `''` into this list,
    // and `want.startsWith('')` is true for every reference — so one stray `## `
    // in a guide silently satisfied every `<file> § Heading` cross-reference and
    // doctor stopped reporting dangling ones (`p082-b3-g5` finding 1). A fix in
    // one consumer of a shared list has to be checked against the others.
    if (!have) return false;
    return have.startsWith(want) || want.startsWith(have);
  });
}

// Which of the template's H2 sections are missing from a filled document — the
// "created from an older template shape" signal.
function missingTemplateSections(templateContent, documentContent) {
  // ⚠ `headingKey`, not `normalizeHeading`: same case-folding rule as
  // `headingResolves` above and `conventionsSectionBodies` below. This one is
  // user-facing — a case difference here produced doctor's "looks like an older
  // `_index.md` template shape" on a document that has the section.
  //
  // ⚠⚠ A COUNTED multiset, not a `Set`. With a `Set`, a template carrying two
  // H2s that fold to the same key — `## Filling the Templates` and
  // `## FILLING THE TEMPLATES` — was fully satisfied by ONE of them appearing in
  // the document, so a genuinely missing section went unreported. Silent, and it
  // arrived with the case folding: before folding, the two keys were distinct.
  // The packaged `_index.md` has no colliding pair today, so this is latent —
  // which is exactly why it needs to be code and not a comment.
  const have = new Map();
  for (const heading of extractH2Headings(documentContent)) {
    const key = headingKey(heading);
    have.set(key, (have.get(key) || 0) + 1);
  }
  return extractH2Headings(templateContent).filter((heading) => {
    const key = headingKey(heading);
    const left = have.get(key) || 0;
    if (left === 0) return true;
    have.set(key, left - 1);
    return false;
  });
}

// True when `content` matches `templateContent` up to placeholder substitution:
// every single-line `{...}` placeholder in the template may match any text.
// Distinguishes "pristine current starter" from "edited or older starter"
// without knowing the values init substituted.
function matchesTemplateWithPlaceholders(content, templateContent) {
  // Split/join through the module's single line-ending definition rather than
  // a second hand-rolled CRLF replacement: a lone CR left the template and the
  // document normalized differently, so a pristine starter compared as edited.
  const normalize = (s) => String(s).split(LINE_SPLIT_RE).join('\n').replace(/\s+$/, '');
  const parts = normalize(templateContent).split(/\{[^}\n]*\}/);
  const pattern = `^${parts.map(escapeRegExp).join('[\\s\\S]*?')}$`;
  try {
    return new RegExp(pattern).test(normalize(content));
  } catch {
    return false;
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// PROPOSAL-078 phase 1: the table-cell formatting convention (P-072) ships
// as an HTML comment at every template head, so docs seeded before 0.13 —
// or written from scratch — hold tables with no in-file reminder and tend
// to grow run-on cell walls. Detection is info-only; doctor never edits
// user-authored specs. The snippet is matched anywhere in the file (the
// _index.md template places it mid-file, after its usage comment), and a
// table counts only outside code fences. The delimiter-row regex accepts
// any row with an internal pipe (`|---|---|`, `---|---`) plus the
// single-column form with BOTH outer pipes (`|---|`); a bare `---` is a
// thematic break / frontmatter fence and never matches — the one shape
// deliberately missed is a single-column delimiter written without outer
// pipes, which is indistinguishable from a thematic break anyway (the
// check is a nudge, not a gate).
const SPEC_FORMATTING_CONVENTION_SNIPPET = 'Formatting convention: keep table cells concise';
const TABLE_DELIMITER_ROW_RE = /^ {0,3}(?:\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)+\|?|\|[ \t]*:?-{2,}:?[ \t]*\|)[ \t]*$/;

// ⚠ This asks the classification for a table rather than grepping for a
// delimiter row, so it now agrees with the section walker about what a table is.
// The two used to answer differently: a delimiter row with no header line above
// it counted as a table HERE while the walker treated it as a thematic break or
// prose. Neither shape occurs in a packaged template — `test/upgrade-drift.mjs`
// pins the packaged verdicts — but "two places in this file decide the same
// question with different code" is the defect class, and it does not stop being
// the defect class because the current inputs happen not to hit it.
function hasTableWithoutConventionComment(content) {
  if (String(content).includes(SPEC_FORMATTING_CONVENTION_SNIPPET)) {
    return false;
  }
  const lines = blankFencedBlocks(String(content));
  return classifyLines(lines).some((c) => c.type === 'table');
}

// --- PROPOSAL-082 G5 / PROPOSAL-083 §4: `_conventions.md` staleness -----------
//
// `_conventions.md` is user-owned. `dflow init` writes it once and neither init
// nor `configure-agents` ever rewrites it, so a project keeps the shape it was
// created with forever. Doctor reporting is the ONLY way an adopter learns their
// copy predates a contract change — which is why this reports and never edits.
//
// Every fingerprint is SECTION-LOCAL. A whole-file grep would pass the moment
// the phrase appeared anywhere in the document, including inside a section the
// adopter pasted in from somewhere else; the claim being checked is "THIS
// section carries this rule", so that is what gets read.
//
// Three states, and the middle one is the whole point:
//
//   missing  — the section is not in the file at all. Reported, never silently
//              passed: MAINTAINERS § Cross-Model Review (P083 batch 2, g16) —
//              "a gate that silently accepts absence is worse than no gate: it
//              reports success". The previous attempt at this check was pulled
//              for exactly that, because against the then-broken projection it
//              could only ever report success.
//   stale    — section present, rule absent. This is the actionable one: the
//              project's own conventions state something the shipped flows no
//              longer do.
//   current  — section present, rule present.
// Heading detection has to cover more than `^#{1,6} `, because every shape it
// misses becomes a section that never ends — and an over-running body reports
// the WRONG section as current, which is the silent-success direction:
//   - ATX indented 1-3 spaces is still a heading (CommonMark).
//   - A setext heading (text line + `===` / `---` underline) is a heading, and
//     missing it let a body run on into every following section. `---` is only
//     setext when it directly follows a non-blank, non-heading line; otherwise
//     it is a thematic break, which `_conventions.md` uses.
// Comparison is case-insensitive: a heading an adopter retyped in different
// case is the same section, and treating it as absent produced a false
// `missing` on a file that had the rule.
// A setext underline may only close a PARAGRAPH (CommonMark 4.3). After a list
// item, a table row, a blockquote or another heading it is not a heading at all
// — `- foo` / `---` is a list plus a thematic break. Treating those as headings
// ended sections early and, worse, made the caller pop a real content line out
// of the body: a marker sitting on the last list item or table row vanished and
// the section reported `stale`. That is the same false-warn-on-an-ordinary-edit
// class the soft-wrap fix removed.
//
// ⚠ A `---` directly after a plain paragraph line IS a setext heading, and the
// section really does end there — that is CommonMark, not a quirk of this
// parser. An adopter who wants a horizontal rule needs a blank line before it.
// ---------------------------------------------------------------------------
// THE BLOCK CLASSIFICATION PASS — PROPOSAL-082/083 debt 12.
//
// WHAT THIS REPLACED, AND WHY IT IS NOT A FIFTH PATCH. Five predicates used to
// live here — `isTableLine`, `closesOwnBlock`, `blockStartIndex`,
// `isParagraphLine` and `headingAt` — and each re-derived Markdown block
// structure from one line's shape, using backward scans and mutual recursion in
// place of the state a block parser keeps. But what a line IS depends on which
// block it sits inside, which a per-line predicate cannot see, so the five
// disagreed with one another. Six consecutive review rounds each found one more
// place where they did, and THREE of those rounds found a disagreement that the
// previous round's fix had introduced. Every widening of the arbiter's shape set
// found more: 30 -> 51 -> 57 -> 73 -> 79 shapes, each stage having measured
// clean at the stage before.
//
// So: one forward pass labels every line exactly once, and the former predicates
// become lookups into that label. CommonMark block parsing IS a forward pass;
// the backward scans existed only to reconstruct state that had been thrown
// away. A consequence worth having — the old `isParagraphLine` /
// `closesOwnBlock` mutual recursion was explicitly NOT linear (its own comment
// said so, and warned callers off large documents). This is O(lines).
//
// ⚠ THE RULE THAT REPLACES "do not add a fifth predicate": exactly one function
// decides block structure and this is it. Callers read labels. If you find
// yourself writing a regex against a raw line ANYWHERE else in order to decide
// what kind of line it is, that is this defect class growing back, and
// `test/upgrade-drift.mjs`'s class guard is meant to fail on it.
//
// ⚠ WHAT THIS DELIBERATELY DOES NOT IMPLEMENT — stated so the gaps are known
// rather than discovered by the next round:
//   - HTML block type 7 (a complete tag whose name is not in the type-6 list,
//     alone on a line). It is the only type that cannot interrupt a paragraph
//     and recognizing it needs a real tag parser.
//     `commonmark-differential.mjs` carries a row for it, so the divergence is
//     MEASURED rather than assumed harmless.
//   - GFM's rule that a delimiter row must have the same cell count as its
//     header row. `test/upgrade-drift.mjs` pins `| A |` + `|---|---|` as a
//     table, which is the looser reading, and tightening it would also move the
//     P-078 formatting-convention check.
//   - Nested container CONTENT. A blockquote or list item's interior is not
//     parsed as its own block sequence. Knowing the document-level block is not
//     a paragraph is enough for every question this module asks, and
//     `_conventions.md` is a small hand-written file.
//   - ⚠⚠ INLINE HTML COMMENTS — the one gap here whose direction is SILENT PASS,
//     so it is the one that matters. This pass is LINE-level: a line that STARTS
//     with `<!--` opens an HTML block and its text is correctly treated as unseen
//     by a reader. A comment that begins part-way through a line is not a block
//     at all — it is an inline span — and every consumer therefore counts its
//     contents as live document text. Measured, with controls, on 2026-08-05:
//
//       `prose <!-- cascade result is a floor -->`  -> doctor reports `current`
//       `- item <!-- ... -->` / `> quote <!-- ... -->` -> same
//       `<!-- a --> <!-- cascade result is a floor -->` -> same (only the FIRST
//       span is masked; the tail is never re-scanned)
//
//     So a rule a user commented out mid-line still reads as present, which is
//     the exact question `doctor` exists to answer. PRE-EXISTING — it was true
//     before the visibility rule was added and the rule did not touch it; what
//     the rule closed was the line-level half.
//
//     ⚠ NOT fixed here on purpose (maintainer decision, 2026-08-05). Hiding
//     spans needs an inline layer in a module that is deliberately line-level,
//     and the obvious version is WRONG in the content-loss direction: a comment
//     inside a CODE SPAN — `` `<!-- example -->` `` — is rendered and a reader
//     DOES see it, so "mask everything between the delimiters" deletes visible
//     content. That is a span tokenizer, with generated cases, as its own piece
//     of work — not a fourth patch on a boundary predicate, which is how this
//     module earned every defect it has. `p082-b3-k4` recommended exactly that.
//     PROPOSAL-084 carries it as a detectable shape in the meantime: "this file
//     contains an inline HTML comment" needs none of the boundary logic that
//     could be wrong, which is what makes it warnable.
// ---------------------------------------------------------------------------

// HTML blocks (CommonMark 4.6). Types 1-5 pair a start with an end condition and
// close ON the line matching it — that line belongs to the block. Type 6 closes
// at the next blank line, which does NOT belong to it.
//
// ⚠ Type 2 is the one that forced this rewrite. The old code opened an HTML
// block on any `<!--` line but only ever closed a SINGLE-LINE `<!-- ... -->`, so
// a comment spanning two lines never closed: the section walker stopped inside
// it, dropped the list item that followed, and `findConventionsDrift` reported
// `ceremony-escalate-only:stale` against a file that was current — the
// content-loss direction (`p082-b3-g5` finding 4). It could not be patched
// per-line, because an HTML block's extent is cross-line state. That is the
// whole argument for this pass in one example.
const HTML_BLOCK_TYPES = [
  [/^ {0,3}<(script|pre|style|textarea)([ \t>]|$)/i, /<\/(script|pre|style|textarea)>/i],
  [/^ {0,3}<!--/, /-->/],
  [/^ {0,3}<\?/, /\?>/],
  [/^ {0,3}<![A-Za-z]/, />/],
  [/^ {0,3}<!\[CDATA\[/, /\]\]>/]
];

// Type 6's tag list, verbatim from the spec. Order inside the alternation does
// not matter because the tail anchors on a delimiter, so `p` cannot swallow the
// `param` case.
const HTML_BLOCK_TAGS = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
const HTML_BLOCK_TYPE6_RE = new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_TAGS})(?:[ \\t]|/?>|$)`, 'i');

// Leaf-block openers. Spelled `[ \t]` throughout, never `\s`, for the reason
// given at `ATX_HEADING_RE`.
//
// ⚠ `\d{1,9}`: CommonMark caps an ordered marker at nine digits, so a ten-digit
// run is paragraph text and NOT a list (`p082-b3-g5` finding 3).
// ⚠ `([ \t]|$)` and not `[ \t]`: a marker with nothing after it is an EMPTY list
// item, not prose (`p082-b3-g1` finding 6).
// ⚠ The two marker shapes are spelled ONCE and the three predicates are built
// from them. The first draft of this block wrote `[-*+]` twice and
// `\d{1,9}[.)]` twice across four separate literals, which is the module's own
// defect class — change the digit cap in one and the "is this an empty item"
// test silently keeps the old one. Same reason `ATX_HEADING_RE` is a constant.
const BULLET_MARKER = '[-*+]';
// The delimiter set is its own fragment because THREE expressions need it and
// one of them used to hand-write it: `INTERRUPTING_ITEM_RE` spelled `1[.)]`
// while claiming to be derived, so widening `ORDERED_MARKER` would have left the
// paragraph-interrupt rule silently on the old set. Unbroken at the time, and
// load-bearing — which is the only reason it is worth fixing before it breaks.
const ORDERED_DELIM = '[.)]';
const ORDERED_MARKER = `\\d{1,9}${ORDERED_DELIM}`;
// Opens a list wherever it appears, including an EMPTY item.
const LIST_ITEM_RE = new RegExp(`^ {0,3}(?:${BULLET_MARKER}|${ORDERED_MARKER})([ \\t]|$)`);
// An item with nothing after the marker. CommonMark 5.2: a list may interrupt a
// paragraph only if its first line is non-blank, so this shape may not.
const EMPTY_LIST_ITEM_RE = new RegExp(`^ {0,3}(?:${BULLET_MARKER}|${ORDERED_MARKER})[ \\t]*$`);
// The markers that CAN interrupt a paragraph: any bullet, or an ordered marker
// starting at 1. Any other ordered marker is paragraph text.
const INTERRUPTING_ITEM_RE = new RegExp(`^ {0,3}(?:${BULLET_MARKER}|1${ORDERED_DELIM})([ \\t]|$)`);

// A BLANK LINE — spaces and tabs only (CommonMark 2.1).
//
// ⚠⚠ THIS EXISTS BECAUSE `.trim()` IS THE GUARDED DEFECT CLASS IN A DIFFERENT
// SPELLING, and the guard was blind to it. `\s` was swept out of every block
// predicate; `line.trim()` was not, and `.trim()` strips the SAME set — U+00A0,
// form feed, vertical tab, U+2000-200B, U+FEFF — while containing no `\s` for
// the guard to find. A line holding only a non-breaking space was therefore a
// blank line here and a paragraph to CommonMark, so `para` / NBSP / `---` made
// `---` a thematic break instead of a setext underline, the section ran on, and
// a stale `_conventions.md` reported `current`. SILENT PASS, the worst
// direction, measured. Four more shapes flipped the other way.
//
// The guard now bans `.trim(` in block-structure code for this reason. Strip
// with `stripSpaceTab` where a value needs trimming.
const BLANK_LINE_RE = /^[ \t]*$/;

// Strip leading and trailing SPACES AND TABS only — the CommonMark rule for
// heading content, and the same rule `parseAtxHeading` applies. The setext
// branch used to call `.trim()` here, so the two heading kinds disagreed about
// a trailing U+00A0: `## Title<NBSP>` kept it and `Title<NBSP>` / `---` did not,
// which made `isRecognizableDflowGuide` reject one form and accept the other.
//
// ⚠ This DIVERGES from commonmark.js, which calls JS `.trim()` in its inline
// parser and so strips U+00A0 too. The spec says spaces and tabs; the reference
// implementation is broader. We follow the spec.
//
// ⚠⚠ BE PRECISE ABOUT WHICH HALF IS IN THIS REPO. An earlier version of this
// comment said the divergence "is carried as a named row in
// `atx-differential.mjs`" — a file that **does not exist anywhere under this
// repo**. It lives in the maintainer's repo-external review folder, so a reader
// following that sentence finds nothing, and nothing in the tree re-derives the
// claim. The divergence is pinned HERE instead, in `test/upgrade-drift.mjs`
// pin (k).
//
// ⚠⚠ AND BE PRECISE ABOUT WHAT (k) COVERS, because the sentence that replaced
// the bad one was itself an over-claim: it said the pins ran "against every
// character the class covers" while (k) pinned **U+00A0 trailing, alone**. Form
// feed and vertical tab were pinned at the ATX *opener*, not at heading-text
// trimming, and no consumer consequence was pinned at all. Two corrections in a
// row, both widening a claim past what the tree checks — so what (k) covers
// today is stated exactly: five characters (U+00A0, form feed, vertical tab,
// U+2002, U+FEFF), both leading and trailing, on both heading kinds. Widen the
// claim only by widening the loop.
function stripSpaceTab(text) {
  return text.replace(/^[ \t]+|[ \t]+$/g, '');
}
// Split for measuring a list item's CONTENT COLUMN: indent, marker, gap.
const LIST_ITEM_PREFIX_RE = new RegExp(`^( {0,3})(${BULLET_MARKER}|${ORDERED_MARKER})([ \\t]*)`);
const BLOCKQUOTE_RE = /^ {0,3}>/;
// (`INDENTED_CODE_RE` was deleted rather than fixed. It was the only raw-line
// spelling of a question `indentWidth` already answers correctly, and keeping a
// corrected copy would have left two expressions for one rule — the shape this
// module keeps paying for.)
const SETEXT_UNDERLINE_RE = /^ {0,3}(=+|-+)[ \t]*$/;

// Columns of leading whitespace, a tab advancing to the next multiple of four
// (CommonMark 2.2). Spaces and tabs only — anything else ends the indent, which
// is the `[ \t]`-not-`\s` rule in yet another place.
function indentWidth(line) {
  let col = 0;
  for (const ch of line) {
    if (ch === ' ') col += 1;
    else if (ch === '\t') col += 4 - (col % 4);
    else break;
  }
  return col;
}

// The column a list item's CONTENT starts at — the indent, the marker, and the
// gap after it. CommonMark 5.2: a gap of 1-4 spaces sets the content column
// directly; an empty item, or a gap of five or more (which would start indented
// code), puts the content one column after the marker.
//
// ⚠ This exists because a blank line does NOT end a list. A line indented to at
// least this column after a blank is still the item's content, and reading it as
// a document-level paragraph made `- a` / blank / `  b` / `---` end the section
// where CommonMark reads a thematic break — content loss, the pop deleting the
// line that carries the rule. Measured against the reference; the first version
// of this pass closed every block on a blank line and got it wrong.
function listContentColumn(line) {
  const m = line.match(LIST_ITEM_PREFIX_RE);
  if (!m) return null;
  const markerEnd = m[1].length + m[2].length;
  let gap = 0;
  for (const ch of m[3]) gap += ch === '\t' ? 4 - ((markerEnd + gap) % 4) : 1;
  return gap === 0 || gap > 4 ? markerEnd + 1 : markerEnd + gap;
}

// `{ endRe }` when the line opens an HTML block, else null. `endRe: null` means
// type 6 — closed by a blank line rather than by a pattern.
// ⚠ `invisible` answers a DIFFERENT question from the rest of this function, and
// keeping them apart matters: `endRe` is about where the block ENDS (block
// structure), `invisible` is about whether a reader ever SEES the text inside it
// (content). The module got the first right and never asked the second, so a
// rule commented out with `<!-- … -->` counted as present and a stale file
// reported `current` — silent pass, reachable by one edit a person actually
// makes (`p082-b3-k1`).
//
// Which types a reader cannot see, and why each:
//   type 2 `<!-- -->`      a comment. Never rendered.
//   type 3 `<? ?>`         a processing instruction. Never rendered.
//   type 4 `<!DOCTYPE>`    a declaration. Never rendered.
//   type 5 `<![CDATA[ ]]>` ignored by HTML parsers.
//   type 1                 ONLY `script` and `style`. ⚠ `pre` and `textarea`
//                          share type 1's start condition but their text IS
//                          shown — treating all four alike would delete real
//                          convention prose out of a `<pre>` block, which is
//                          the content-loss direction.
//   type 6 / type 7        ordinary tags; the text between them renders.
// The list is spelled here and nowhere else, for the same reason `ORDERED_DELIM`
// is: two copies of a rule is this module's defect class.
const HTML_TYPE1_INVISIBLE_TAGS = /^(script|style)$/i;
function htmlBlockStart(line) {
  for (let t = 0; t < HTML_BLOCK_TYPES.length; t += 1) {
    const [startRe, endRe] = HTML_BLOCK_TYPES[t];
    const m = startRe.exec(line);
    if (m) {
      const invisible = t === 0 ? HTML_TYPE1_INVISIBLE_TAGS.test(m[1]) : true;
      return { endRe, invisible };
    }
  }
  if (HTML_BLOCK_TYPE6_RE.test(line)) return { endRe: null, invisible: false };
  return null;
}

// One label per line, in one pass.
//
// Each entry is `{ type, heading }`. `type` is one of `blank`, `heading`,
// `thematic-break`, `paragraph`, `list`, `blockquote`, `code`, `html`, `table`.
// `heading` is null except on a heading line, where it is
// `{ level, text, setext, start }` — `start` being the first line of the
// underlined paragraph for a setext heading, and the heading's own index for an
// ATX one. Callers that pop a setext heading's text out of a body need `start`,
// and getting it from the classification is why a soft-wrapped setext heading
// now works: the old code assumed the text was exactly one line.
//
// ⚠ Fenced code is already gone by the time this runs — `blankFencedBlocks` has
// replaced those lines with empty ones, preserving positions. That is why there
// is no fence state here. Keep calling this on that function's output; handing
// it raw content would read headings out of fenced examples, which is the
// PROPOSAL-076 G1 defect.
function classifyLines(lines) {
  const out = new Array(lines.length);
  let open = null; // { kind, start, endRe } — the open DOCUMENT-LEVEL block

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // (1) Inside an HTML block. Its extent is exactly the cross-line state the
    //     old per-line predicates could not hold.
    if (open && open.kind === 'html') {
      if (open.endRe) {
        // ⚠ `visibleFrom`: an end condition can leave text AFTER it on the same
        // line, and that text is rendered. `<!-- note --> rest of the line` puts
        // `rest of the line` in the output, so blanking the whole line loses
        // real content — measured as a SILENT PASS one commit after the
        // visibility rule landed (`p082-b3-k3` finding 2): a retired string
        // sitting after a `-->` stopped being reported.
        const end = open.endRe.exec(line);
        out[i] = { type: 'html', heading: null, invisible: open.invisible };
        if (end) {
          if (open.invisible) out[i].visibleFrom = end.index + end[0].length;
          open = null;
        }
        continue;
      }
      if (BLANK_LINE_RE.test(line)) { out[i] = { type: 'blank', heading: null }; open = null; continue; }
      out[i] = { type: 'html', heading: null, invisible: open.invisible };
      continue;
    }

    // (2) A blank line closes every document-level block — EXCEPT a list, whose
    //     item can continue after it (a "loose" list). Measured: closing the
    //     list here made `- a` / blank / `  b` / `---` end the section, while
    //     CommonMark keeps the item open and reads `---` as a thematic break.
    //     Content-loss direction — the walker pops the line carrying the rule.
    //     A BLOCKQUOTE really does close, which is not symmetry but measurement:
    //     `> q` / blank / `  more` ends the section in the reference too.
    if (BLANK_LINE_RE.test(line)) {
      out[i] = { type: 'blank', heading: null };
      if (open && open.kind === 'list') open.blankSeen = true;
      else open = null;
      continue;
    }

    // (2.5) A line indented to the open list item's content column belongs to
    //       that item — including a heading, which is then a heading INSIDE the
    //       list and not a document-level one. This is checked before every
    //       block-start test below, because otherwise `  ## Heading` inside an
    //       item would end the section.
    if (open && open.kind === 'list') {
      if (indentWidth(line) >= open.contentCol) {
        out[i] = { type: 'list', heading: null };
        open.blankSeen = false;
        continue;
      }
      // Not indented into the item, and a blank line intervened: the list ended
      // at that blank and this line starts something new.
      if (open.blankSeen) open = null;
    }

    const paraOpen = open !== null && open.kind === 'paragraph';

    // (3) A setext underline — but ONLY when there is a paragraph to underline.
    //     This single test is the arbitration the old code spread across
    //     `closesOwnBlock`, `blockStartIndex` and `isParagraphLine`, which is
    //     why they could contradict each other about the same line.
    //     ⚠ It is tested BEFORE the thematic break on purpose: CommonMark 4.3
    //     gives the setext heading precedence where both readings are possible,
    //     so `para` + `---` is a heading while a bare `---` is a break.
    if (paraOpen && SETEXT_UNDERLINE_RE.test(line)) {
      const marker = line.match(SETEXT_UNDERLINE_RE)[1];
      const text = stripSpaceTab(lines.slice(open.start, i).map(stripSpaceTab).join(' '));
      out[i] = {
        type: 'heading',
        heading: { level: marker[0] === '=' ? 1 : 2, text, setext: true, start: open.start }
      };
      open = null;
      continue;
    }

    // (4) Shapes that open their own block wherever they appear.
    const atx = parseAtxHeading(line);
    if (atx) {
      out[i] = { type: 'heading', heading: { ...atx, start: i } };
      open = null;
      continue;
    }

    if (isThematicBreak(line)) {
      out[i] = { type: 'thematic-break', heading: null };
      open = null;
      continue;
    }

    // HTML blocks of types 1-6 can all interrupt a paragraph, so this sits
    // above the continuation logic rather than inside the block-start branch.
    const html = htmlBlockStart(line);
    if (html) {
      out[i] = { type: 'html', heading: null, invisible: html.invisible };
      // ⚠ The end condition is checked on the OPENING line too (CommonMark 4.6:
      // "the block ends at the first line matching the end condition", which
      // includes the line that started it). Leaving it out meant a single-line
      // `<!-- Seeded by Dflow. -->` — the comment at the head of every packaged
      // template — opened a block that never closed, and every heading in the
      // file after it disappeared. The existing pins caught it immediately,
      // which is the argument for having run them before widening anything.
      // Same rule on the opening line, which may also be the closing one:
      // `<!-- a --> b` renders ` b`.
      const selfEnd = html.endRe && html.endRe.exec(line);
      if (selfEnd) {
        if (html.invisible) out[i].visibleFrom = selfEnd.index + selfEnd[0].length;
        open = null;
      } else {
        open = { kind: 'html', start: i, endRe: html.endRe, invisible: html.invisible };
      }
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      out[i] = { type: 'blockquote', heading: null };
      open = { kind: 'blockquote', start: open && open.kind === 'blockquote' ? open.start : i };
      continue;
    }

    // A list interrupts an open paragraph only when it is a bullet, or an
    // ordered marker starting at 1, AND its first line is non-blank
    // (CommonMark 5.2). Any other ordered marker — and an empty item — is
    // paragraph text. Reading those as block starts is the divergence `g1` found
    // by widening the arbiter, in the silent-pass direction.
    if (LIST_ITEM_RE.test(line)) {
      const canInterrupt = INTERRUPTING_ITEM_RE.test(line) && !EMPTY_LIST_ITEM_RE.test(line);
      if (!paraOpen || canInterrupt) {
        out[i] = { type: 'list', heading: null };
        // ⚠ `listContentColumn` cannot return null here, and the reason is worth
        // stating because the consequence if it ever did is severe:
        // `indentWidth(line) >= null` is `>= 0`, true for EVERY line, so the
        // whole rest of the document would be swallowed as list content —
        // silent pass. It cannot happen because `LIST_ITEM_PREFIX_RE` is built
        // from the same two marker fragments as `LIST_ITEM_RE` and is strictly
        // more permissive (its trailing `[ \t]*` matches empty where
        // `LIST_ITEM_RE` requires `[ \t]` or end of line), so anything this
        // branch accepts, it matches. Sharing the fragments is what makes that
        // an invariant rather than a hope — this module has broken exactly this
        // kind of unwritten relationship between two expressions five times.
        open = {
          kind: 'list',
          start: open && open.kind === 'list' ? open.start : i,
          // Each item sets the column its own content continues at.
          contentCol: listContentColumn(line),
          blankSeen: false
        };
        continue;
      }
      // else: falls through to the paragraph continuation below.
    }

    // (5) Continuation of an open container. Inside a list item or a blockquote
    //     the document-level block is the container, not a paragraph, so no
    //     setext underline can close anything here — which is precisely what
    //     `blockStartIndex` used to walk backwards to work out.
    if (open && (open.kind === 'list' || open.kind === 'blockquote')) {
      out[i] = { type: open.kind, heading: null };
      continue;
    }

    // (6) A table runs until a line that is not a row.
    // ⚠ NAMED GAP, DELIBERATELY NOT "FIXED": this branch has no indent test,
    // while (8) — which OPENS the table — now requires the header row to sit at
    // `indentWidth < 4`. So `| a | b |` / `|---|---|` / `<4SP>| c | d |` keeps
    // the third line in the table for us, where GFM ends the table and starts an
    // indented code block. The symmetric-looking change (adding an indent test
    // here) is NOT made, because **no reference available to this repo can say
    // which answer is right**, and shipping a change on an unarbitrated hunch is
    // how this module's boundary logic got into trouble in the first place:
    //   - `commonmark@0.31.2` has no tables, so it never enters this state at
    //     all and reads the whole run as one paragraph. It agrees with us here
    //     for a reason that has nothing to do with the question.
    //   - `marked`'s GFM lexer does answer, but it is measurably non-conformant
    //     on exactly this boundary — for `prose` / `<4SP>prose` / `===` the spec
    //     and `commonmark` both say setext H1 (an indented line cannot interrupt
    //     a paragraph, so it is a lazy continuation) while `marked` says
    //     paragraph. A reference that is wrong on the control cannot settle the
    //     case.
    // Direction if GFM turns out to be right: content loss, the loud one.
    // Closing this needs a third reference (cmark-gfm), not more reasoning.
    if (open && open.kind === 'table') {
      if (line.includes('|')) { out[i] = { type: 'table', heading: null }; continue; }
      out[i] = { type: 'paragraph', heading: null };
      open = { kind: 'paragraph', start: i };
      continue;
    }

    // (7) Indented code — which cannot interrupt a paragraph. After one, an
    //     indented line is a lazy continuation and the paragraph stays open.
    // ⚠ `indentWidth(...) >= 4`, NOT a raw-line regex. This branch used
    // `INDENTED_CODE_RE = /^(\t| {4,})/`, which decides the SAME question as
    // `indentWidth` with different code — and they disagreed: a space followed
    // by a tab is column 4 (a tab advances to the next multiple of four), so
    // `indentWidth(' \tx') === 4` while the regex said false. Both directions
    // measured: `<SP><TAB>prose` became a paragraph, so a following `---` was a
    // setext underline and the pop deleted the body (content loss); and
    // `<SP><SP><SP><TAB>| a | b |` became a table header, so the section ran on
    // (silent pass). This module's own rule names it — a regex against a raw
    // line, anywhere else, to decide what kind of line it is.
    //
    // ⚠⚠ WHY WIDENING THIS BRANCH STOLE NOTHING FROM THE BRANCHES ABOVE IT, and
    // this is the part that was missing rather than wrong. `indentWidth >= 4` is
    // strictly wider than the regex it replaced, so it can only take lines that
    // used to reach branches further down — unless it also overlaps branch (4).
    // It cannot, and the reason is a property of every opener in this module,
    // not of this line: **every raw-prefix opener is `^ {0,3}` followed by a
    // character that is neither a space nor a tab**, which bounds any line one
    // of them matches at `indentWidth <= 3`; while `indentWidth >= 4` requires
    // four spaces, or a tab, inside the first four columns, which no `^ {0,3}X`
    // can match. So (4) and (7) partition cleanly.
    // ⚠ That is a property of the OTHER expressions, so it can be broken from a
    // distance: admit a tab into any `^ {0,3}` prefix — write `^[ \t]{0,3}`,
    // which looks like a tolerance improvement — and this branch starts eating
    // lines that opener was meant to claim, silently. `assertOpenerIndentPartition`
    // in `test/upgrade-drift.mjs` sweeps every opener against every indent form
    // so the break is a test failure and not a review round.
    if (!paraOpen && indentWidth(line) >= 4) {
      out[i] = { type: 'code', heading: null };
      open = { kind: 'code', start: open && open.kind === 'code' ? open.start : i };
      continue;
    }

    // (8) A GFM table opens when a delimiter row sits directly under a
    //     pipe-bearing paragraph line. Requiring the header is what keeps
    //     ordinary prose containing a pipe — "the Command | Query split" — from
    //     being read as a table, which an earlier `line.includes('|')` test got
    //     wrong in the silent-success direction.
    // ⚠ The header row is the line DIRECTLY ABOVE the delimiter row, wherever
    // that line sits in the paragraph. Requiring it to be the paragraph's first
    // line (`open.start === i - 1`) was a regression against the predicate this
    // pass replaced, whose backward scan had no such restriction: one intro
    // sentence above a table — `Our rows:` / `| a | b |` / `|---|---|` — made the
    // whole run one paragraph, so a following `---` became a setext underline
    // and the pop deleted the ENTIRE section body. Total content loss for that
    // section, on input a hand-edited `_conventions.md` produces immediately.
    // Any earlier lines of the paragraph stay a paragraph; only the header row
    // and the delimiter row become the table.
    // ⚠⚠ THE HEADER ROW'S OWN INDENT IS CHECKED, and leaving it out was a
    // silent-pass defect this very branch introduced. `TABLE_DELIMITER_ROW_RE`
    // constrains the DELIMITER row to `^ {0,3}`, but the header test is only
    // `.includes('|')`. While the header had to be the paragraph's first line
    // that gap was unreachable — an indented line can only be a paragraph
    // CONTINUATION, since indented code cannot interrupt a paragraph — so
    // widening the rule opened it. A 4-column-indented header is indented code
    // to CommonMark and no table at all to GFM (`marked` emits no table token),
    // yet we read one, the `---` below stopped ending the section, and a stale
    // file reported `current`. Measured: five rows where both references
    // disagreed with us and neither with each other.
    // `i > 0` is deliberately gone: `paraOpen` cannot be true at i === 0 (`open`
    // starts null and is only assigned in the loop), so it never guarded
    // anything while reading like the bounds check that made this branch safe.
    // ⚠⚠ RELABELLING `out[i - 1]` RESTS ON AN INVARIANT NOTHING ELSE STATES:
    // when `paraOpen` is true at `i`, `out[i - 1]` is necessarily `'paragraph'`.
    // It holds because the only branches that leave `open.kind === 'paragraph'`
    // are (9) and (6)'s else-path, and both write `'paragraph'` to their own
    // line. So the overwrite below always replaces a label this loop just wrote
    // for the header row — never a `code`, `list` or `heading` line.
    // ⚠ A future branch that labels its line something else while leaving a
    // paragraph open would have that label silently overwritten as `table`, and
    // nothing here would notice. If you add such a branch, this line is the one
    // that breaks — and it breaks quietly, which is why the invariant is written
    // down instead of being left to be re-derived.
    if (paraOpen && indentWidth(lines[i - 1]) < 4 && lines[i - 1].includes('|') && TABLE_DELIMITER_ROW_RE.test(line)) {
      out[i - 1] = { type: 'table', heading: null };
      out[i] = { type: 'table', heading: null };
      open = { kind: 'table', start: i - 1 };
      continue;
    }

    // (9) Paragraph: a continuation of the open one, or a new one.
    out[i] = { type: 'paragraph', heading: null };
    if (!paraOpen) open = { kind: 'paragraph', start: i };
  }

  // ⚠⚠ AN HTML BLOCK STILL OPEN AT EOF IS MARKED, and this is not a parsing
  // nicety — it was a HIGH silent pass reachable on a file nobody had to
  // construct. HTML block types 1-5 close only on their end condition, so an
  // adopter who leaves one `<!--` unclosed mid-edit puts the ENTIRE REST OF THE
  // FILE inside that block. The parse is right; what was wrong was that
  // `conventionsSectionBodies` kept pushing those lines into the open section's
  // body, so the section swallowed every later section, reached a quoted copy
  // of the rule in an appendix, and a genuinely stale file reported `current`.
  // Measured through the real `doctor`: closing the comment produced two
  // warnings, leaving it open produced none.
  //
  // ⚠ Only HTML. A paragraph, list or code block open at EOF is ordinary — the
  // document simply ended. Fenced blocks never reach here because
  // `blankFencedBlocks` has already emptied them, and that immunity is
  // accidental rather than designed, which is exactly why this needed marking
  // rather than another special case.
  //
  // The flag is additive: every existing consumer reads `.type` and `.heading`.
  // ⚠⚠ `open.endRe` IS THE WHOLE POINT, and leaving it out was a regression this
  // very block introduced. Only types 1-5 close on an end condition; **type 6
  // closes on a blank line**, and `endRe` is null for it. A document ending in a
  // type-6 block therefore looked "never closed" — but a file that ends with a
  // newline supplies a trailing blank through the splitter, so the block closes
  // normally, while a file WITHOUT a trailing newline did not. Two files one
  // byte apart, and the shorter one got a spurious "unclosed HTML block"
  // warning plus a false `stale` on a section that plainly carries the rule.
  // Content loss, on `<div>…</div>` — ordinary hand-written HTML.
  // The comment above already said types 1-5; the code did not agree with it.
  if (open && open.kind === 'html' && open.endRe) {
    for (let i = open.start; i < out.length; i += 1) out[i].unclosed = true;
  }

  return out;
}

// ⚠ `toUpperCase`, not `toLowerCase`, and the difference is not cosmetic:
// `headingResolves` PREFIX-matches on this key, and lowercasing is not
// prefix-preserving. Greek capital sigma lowercases to a FINAL sigma at a word
// end and a medial one elsewhere, so `ΑΣ` becomes `ας` while `ΑΣΒΓ` becomes
// `ασβγ` — and `"ασβγ".startsWith("ας")` is false although the raw strings do
// prefix-match. A `<file>.md § ΑΣ` reference to a heading `ΑΣΒΓ` was reported as
// dangling. Uppercasing has no context-sensitive mapping in the default
// case-conversion tables, so it preserves prefixes; `ß` → `SS` changes length
// but preserves them too.
// ⚠ Any fold works for the exact and Set comparisons; only the prefix consumer
// constrains the choice. Keep ONE fold for all three rather than a
// prefix-preserving one here and a convenient one there — that split is how the
// three consumers of this normaliser drifted apart before.
function headingKey(text) {
  return normalizeHeading(text).toUpperCase();
}

// ALL bodies whose heading matches — `_conventions.md` is hand-edited and a
// duplicated heading is ordinary. Taking only the first made a file that
// carried the rule in its second copy report `stale`.
function conventionsSectionBodies(content, heading) {
  // Blanked by the same expression `visibleTextLines` returns — see
  // `classifiedVisible`. Text a reader never sees is not this section's content.
  const { info, lines } = classifiedVisible(content);
  const target = headingKey(heading);
  const bodies = [];
  let level = 0;
  let body = null;
  for (let i = 0; i < lines.length; i += 1) {
    const h = info[i].heading;
    if (h) {
      // A setext heading's TEXT lines were already pushed into the open body —
      // take them back out. `h.start` is where the underlined paragraph began,
      // so this pops all of them.
      //
      // ⚠ The old version popped exactly ONE line and guarded it with
      // `body[body.length - 1].trim() === h.text`, because it assumed a setext
      // heading's text was a single line. A soft-wrapped one therefore left its
      // earlier lines sitting in the body as though they were content, and
      // reported the heading under only its last line — so a section titled
      // `Ceremony Scaling` / `(Project Application)` / `===` did not match the
      // fingerprint that names it. The classification knows the paragraph's
      // extent, so both halves are now right for free.
      if (body && h.setext) {
        for (let k = h.start; k < i && body.length > 0; k += 1) body.pop();
      }
      if (body && h.level <= level) {
        bodies.push(body.join('\n'));
        body = null;
        level = 0;
      }
      if (!body && headingKey(h.text) === target) {
        level = h.level;
        body = [];
      }
      continue;
    }
    // ⚠ A line inside an HTML block that never closed is NOT this section's
    // content — it is the interior of a block that swallowed the rest of the
    // file. Pushing it let a section reach text from a later section and report
    // `current` on a file that had genuinely lost the rule: silent pass, the
    // worst direction, and reachable from one unclosed `<!--`.
    // Stopping here is the conservative half of the fix — we only trust content
    // we can attribute to the section. The other half is telling the user why,
    // which `findConventionsDrift` does, because otherwise the resulting `stale`
    // is correct and inexplicable.
    if (info[i].unclosed) break;
    if (body) body.push(lines[i]);
  }
  if (body) bodies.push(body.join('\n'));
  return bodies;
}

// The file's lines with everything a reader cannot see blanked out: fenced code
// (already blanked on the way in) and the interior of an HTML block that renders
// no text — a comment, a processing instruction, a declaration, CDATA, a
// `<script>` or a `<style>`.
//
// ⚠⚠ WHY THIS EXISTS AS A FUNCTION RATHER THAN A TEST AT EACH CONSUMER. The
// rewrite made `classifyLines` the single authority on *what kind of line this
// is* — and then every CONTENT extractor went on reading the raw text without
// asking. So three consumers each decided independently, by not deciding:
// `findConventionsDrift` matched a fingerprint marker inside `<!-- … -->` and
// certified a stale file as `current`; `parseContextLine` read a commented-out
// machine-readable policy value as though it were live; `extractSectionRefs`
// reported a reference inside a comment as a dangling link, with the `-->`
// captured into the heading text (`p082-b3-k1`, all three reproduced).
//
// ⚠ The module was already INCONSISTENT about this, which is the tell that it
// was never decided: a retired string below an *unclosed* comment was correctly
// ignored (the section body stops there), while the same string inside a *closed*
// comment counted. Same question, two answers, depending on whether the user
// typed `-->`.
//
// BLANK, do not delete: `extractSectionRefs` reports 1-based line numbers and
// `conventionsSectionBodies` pops setext text by index. This is the same
// convention `blankFencedBlocks` established, for the same reason.
//
// ⚠ This is a real semantic decision, not a bug fix with an obvious answer:
// it says a commented-out rule is ABSENT. `commonmark` agrees a reader never
// sees it, and the section differential's whole question is "does a reader see
// the marker in this section" — so the arbiter this module already trusts was
// answering one question while the implementation answered another.
// ⚠⚠ ONE APPLICATION OF THE RULE, not two. The first draft of this fix had
// `visibleTextLines` blank the lines and `conventionsSectionBodies` repeat the
// test inline (`info[i].invisible ? '' : line`) because it needed `info` anyway.
// Both read the same flag, so the DECISION was single-sourced — but the two
// expressions could still drift, and "one rule, two expressions" is the defect
// class this module exists to hold shut. It was caught by measurement, not by
// review: breaking the projection left the `conventionsSectionBodies` pins
// green, which is precisely the "my pin cannot fail against the thing it names"
// shape the mutation harness was built for.
// ⚠ SPACES, not deletion, and the span rather than the line. Two reasons, both
// paid for: `extractSectionRefs` compares a match's index against the line's
// length, so shortening a line moves every column it reads; and an end condition
// can leave rendered text after it on the same line (`visibleFrom`), which
// whole-line blanking silently dropped.
function classifiedVisible(content) {
  const lines = blankFencedBlocks(String(content));
  const info = classifyLines(lines);
  return {
    info,
    lines: lines.map((line, i) => {
      if (!info[i] || !info[i].invisible) return line;
      const from = info[i].visibleFrom;
      const hidden = from === undefined ? line.length : Math.min(from, line.length);
      return ' '.repeat(hidden) + line.slice(hidden);
    })
  };
}

function visibleTextLines(content) {
  return classifiedVisible(content).lines;
}

// The same content with every CODE line masked to spaces — same length, same
// line count, so an index into the result is an index into the original.
//
// ⚠⚠ WHY A MASK AND NOT THE LINE ARRAY. `configure-agents` finds its managed
// region with `indexOf` over the raw file and then SLICES the original by that
// index, so anything that shortens a line moves the cut and corrupts the write.
// A mask keeps every offset while removing the text that must not match.
//
// It exists because the write path — the only path in this tool that modifies a
// user's file — decided a structural question by not asking: a user documenting
// Dflow in their own `AGENTS.md`, with the marker comments shown inside a fenced
// example, had that example treated as the managed region and OVERWRITTEN.
// `runConfigureAgents` exited 0 and `doctor` then reported all clean
// (`p082-b3-k3` finding 1). USER CONTENT LOSS, which is the worst thing this
// codebase can do.
//
// ⚠ Fenced and indented code only. A marker inside a `<pre>` block is still
// taken as a region boundary — `pre` renders its text, so it is not code to this
// module, and closing that case needs a decision about what `<pre>` MEANS here
// rather than another line in this function. Stated so the gap is known rather
// than discovered.
function maskCodeBlocks(content) {
  const s = String(content);
  const raw = s.split('\n');
  const blanked = blankFencedBlocks(s);
  const info = classifyLines(blanked);
  return raw.map((line, i) => {
    const isCode = blanked[i] !== line || (info[i] && info[i].type === 'code');
    return isCode ? ' '.repeat(line.length) : line;
  }).join('\n');
}

// Where an HTML block that never closes begins, or -1. Reads the SAME
// classification every other consumer reads rather than re-deciding it — the
// module's one rule about not spelling a question twice.
function unclosedHtmlBlockLine(content) {
  const lines = blankFencedBlocks(String(content));
  const info = classifyLines(lines);
  const at = info.findIndex((c) => c && c.unclosed);
  return at === -1 ? -1 : at + 1; // 1-based, for a message a human reads
}

// Kept for callers that only need the first match.
function conventionsSectionBody(content, heading) {
  const bodies = conventionsSectionBodies(content, heading);
  return bodies.length === 0 ? null : bodies[0];
}

// Each `marker` is verified present in BOTH packaged templates (or, where the
// section is edition-specific, in the edition that has it).
// `test/upgrade-drift.mjs` re-derives that from the packaged templates rather
// than trusting this comment.
//
// ⚠ BE PRECISE ABOUT WHICH HALF IS MECHANICAL. This sentence used to also claim
// each marker is "absent from the pre-P082 shape", with the same
// "re-derives that" clause covering both halves. Only the presence half is
// re-derived; nothing in the tree checks the absence half (`p082-b3-g1`
// finding 4). The risk it leaves is real and worth naming: a marker phrase that
// ALREADY existed in the old text would make an un-migrated file report
// `current` — silence about a stale file, the false-negative direction.
// It is not mechanized because the only source for the old shape is git
// history, and a test that shells out to git cannot run from the published
// tarball, where there is no `.git`. So it stays a review obligation: when you
// add a marker, check it against the pre-P082 text yourself.
// `missingLevel` is per-fingerprint on purpose. `### SPEC-ID Format` was
// re-parented by 59e0eb2 and no released version ever projected it, so EVERY
// existing project is legitimately `missing` there — info. The other two
// sections HAVE always shipped, so their absence means the file was edited or
// predates them, which is worth a warn. A blanket info also mis-reported a
// merely RENAMED heading as "projects created before this section shipped do
// not have it at all", which is a false statement about a file that has it.
const CONVENTIONS_FINGERPRINTS = [
  {
    id: 'ceremony-escalate-only',
    heading: 'Ceremony Scaling (Project Application)',
    marker: 'cascade result is a floor',
    editions: null,
    missingLevel: 'warn',
    rule: 'the escalate-only rule (project rows may raise a tier, never lower it)',
    consequence: 'Without it the table reads as a free re-classification surface, so a project row can lower a tier the cascade raised — the drift PROPOSAL-082 closed.'
  },
  {
    id: 'spec-files-no-br-families',
    heading: 'Filling the Templates',
    marker: 'no-BR family variants',
    editions: null,
    missingLevel: 'warn',
    rule: 'the no-BR family variants of `lightweight-spec.md`',
    consequence: 'Without them the table implies a T2 always carries a BR delta, so a presentation / contract / operational / performance change gets a fabricated BR-ID to satisfy a rule that no longer exists.'
  },
  {
    id: 'spec-id-minimal-host',
    heading: 'SPEC-ID Format',
    marker: 'Minimal (zero-phase) host exception',
    editions: null,
    missingLevel: 'info',
    neverProjected: true,
    rule: 'the minimal (zero-phase) host exception',
    consequence: 'Without it the section still says the SPEC-ID appears in the first phase-spec filename and the branch name, which a zero-phase host has no way to satisfy — and a functional-bug host carries a BUG-NUMBER branch instead.'
  }
];

// The second fingerprint kind: strings PROPOSAL-082 retired, which must not
// still be sitting in an adopter's file. These need no new upstream contract —
// the evidence is that batch 1 deleted them from both packaged templates — so
// unlike the gf DDD-Modeling-Depth fingerprint (which has no marker to pin and
// is recorded as debt 10), there is nothing blocking them.
//
// Every string below is verified zero-match in both packaged templates AND both
// tutorial fixtures; `test/upgrade-drift.mjs` re-derives that rather than
// trusting this comment. A retired string that still matched the current
// template would fire on every project forever.
const CONVENTIONS_RETIRED = [
  {
    id: 'ceremony-ef-tweak-t3',
    heading: 'Ceremony Scaling (Project Application)',
    retired: 'T3 if no Domain change',
    editions: null,
    rule: 'the retired "EF configuration tweak → T3 if no Domain change" example row',
    consequence: 'Under the ordered cascade an Infrastructure mapping tweak is not automatically T3 — the packaged template now uses that row to show a project ESCALATING it, and the old row teaches the opposite.'
  },
  {
    id: 'ceremony-query-only-t2',
    heading: 'Ceremony Scaling (Project Application)',
    // Anchored through the TIER cell, not just the situation. The situation
    // alone flagged `| Adding a Query only (no write) | T1 (project convention) |
    // We escalate all new reads |` — a row an adopter migrated CORRECTLY into
    // the form the current template teaches — and then told them to overwrite it.
    // The claim is about a row that restates a bare tier, so the anchor has to
    // include the bare tier. Sibling `ceremony-ef-tweak-t3` never had this
    // problem because its anchor was already the tier cell.
    retired: 'Adding a Query only (no write)} | T2',
    editions: null,
    rule: 'the retired "Adding a Query only (no write) → T2" example row',
    consequence: 'The cascade decides this now; the row restated a tier instead of recording a project decision, which is the drift the escalate-only rule was added to stop.'
  },
  {
    id: 'ceremony-criteria-table',
    heading: 'Ceremony Scaling (Project Application)',
    // Anchored on enough of the retired sentence to be implausible as adopter
    // prose. Two shorter anchors were tried and both trip on legitimate text:
    // `criteria table` matches "Our own criteria table below records the
    // escalations we apply", and `for the full criteria table` still matches
    // "see that document for the full criteria table" — a generic five-word
    // English construction. The retired text was "See `AI-AGENT-GUIDE.md`
    // § Ceremony Scaling for the full criteria table.", soft-wrapped between
    // "full" and "criteria"; `normalizeForMarker` collapses that, so including
    // the § name costs nothing and no longer matches ordinary sentences.
    retired: 'Ceremony Scaling for the full criteria table',
    editions: null,
    rule: 'the retired pointer to a "criteria table" in AI-AGENT-GUIDE.md',
    consequence: 'That table was replaced by the ordered cascade. A file still pointing at it sends the reader to a section that no longer exists under that name.'
  },
  {
    id: 'spec-files-br-delta-equation',
    heading: 'Filling the Templates',
    retired: 'bug fix / small tweak with BR Delta',
    editions: null,
    rule: 'the retired "T2 Light — bug fix / small tweak with BR Delta" row',
    consequence: 'It equates T2 with carrying a BR Delta, which the no-BR families retired — the same equation that made people fabricate BR-IDs.'
  }
];

// Markers are matched against whitespace-normalized text. `_conventions.md` is
// user-owned and reflowing a paragraph is an ordinary edit; matching raw made a
// soft-wrap inside the marker report a false `stale`.
function normalizeForMarker(text) {
  return String(text).replace(/\s+/g, ' ');
}

// ⚠ INHERENT LIMIT, stated rather than papered over: these are heuristic
// substring checks (PROPOSAL-082 specifies them as such — 字串偵測, following
// the P058 starter-drift precedent). A substring cannot tell a rule from a
// sentence ABOUT the rule, so text like "we removed the old rule that the
// cascade result is a floor" satisfies the fingerprint and reports `current`.
// That is a false negative on a deliberately-worded file, not on drift, and no
// amount of matching harder fixes it — deciding it needs to read meaning.
// Do not describe this check as proving a project's conventions are correct;
// it detects the shapes that arise from a file predating a contract change.
//
// ⚠ The `retired` kind fails in the OPPOSITE direction, and the two must not be
// conflated. A `marker` that is too short yields a false NEGATIVE (silence); a
// `retired` string that is too short yields a false POSITIVE — doctor telling a
// developer their own sentence is retired Dflow text. So a retired entry must
// be anchored on enough of the original sentence to be implausible as adopter
// prose, and `test/upgrade-drift.mjs` asserts each is zero-match against both
// packaged templates and both tutorial fixtures.
//
// Returns one entry per fingerprint that is not `current`. `edition` selects
// edition-specific fingerprints; pass null to evaluate only the shared ones.
// Whether an entry applies to the edition being checked. `editions: null` means
// "shared, applies everywhere"; a list means the entry is only meaningful for
// those editions and a caller that did not resolve an edition must not see it.
//
// Extracted from the two identical inline conditions below because every shipped
// entry currently has `editions: null`, which makes the non-null path dead and
// therefore unproven (`p082-b3-g1` finding 5). It is NOT speculative — debt 10
// (the greenfield DDD-Modeling-Depth fingerprint) is a known future
// edition-specific entry, blocked only on an upstream marker to pin. So the
// branch is kept and tested here instead of being deleted and rewritten
// untested at the moment someone is busy thinking about something else.
function fingerprintAppliesTo(fp, edition) {
  if (!fp.editions) return true;
  return Boolean(edition) && fp.editions.includes(edition);
}

function findConventionsDrift(content, edition = null) {
  // No early return for empty input. It used to short-circuit to `[]`, which
  // made a whitespace-only file report NOTHING while a one-character file
  // reported all three sections missing — the emptier file getting the cleaner
  // verdict, and the gate silently accepting absence, which is the exact thing
  // this module says it exists to prevent. Empty content genuinely has every
  // section missing, so it says so; the caller collapses that into one finding.
  const text = String(content || '');
  const drift = [];
  for (const fp of CONVENTIONS_FINGERPRINTS) {
    if (!fingerprintAppliesTo(fp, edition)) continue;
    const bodies = conventionsSectionBodies(text, fp.heading);
    const base = {
      id: fp.id,
      heading: fp.heading,
      rule: fp.rule,
      consequence: fp.consequence,
      neverProjected: Boolean(fp.neverProjected)
    };
    if (bodies.length === 0) {
      drift.push({ ...base, state: 'missing', level: fp.missingLevel || 'warn' });
      continue;
    }
    const marker = normalizeForMarker(fp.marker);
    // Any copy of the section carrying the rule is enough.
    if (!bodies.some((body) => normalizeForMarker(body).includes(marker))) {
      drift.push({ ...base, state: 'stale', level: 'warn' });
    }
  }
  for (const fp of CONVENTIONS_RETIRED) {
    if (!fingerprintAppliesTo(fp, edition)) continue;
    const bodies = conventionsSectionBodies(text, fp.heading);
    // A section that is absent cannot carry a retired string. Its absence is
    // already reported by the `requires` fingerprint on the same heading, so
    // saying nothing here is not silence about an unchecked state.
    if (bodies.length === 0) continue;
    const retired = normalizeForMarker(fp.retired);
    if (bodies.some((body) => normalizeForMarker(body).includes(retired))) {
      drift.push({
        id: fp.id,
        state: 'retired',
        level: 'warn',
        heading: fp.heading,
        rule: fp.rule,
        consequence: fp.consequence,
        neverProjected: false
      });
    }
  }
  return drift;
}

module.exports = {
  GIT_POLICY_LINE_RE,
  AI_COMMIT_MARKER_LINE_RE,
  PROSE_LANGUAGE_LINE_RE,
  TECH_STACK_ROW_RE,
  MIGRATION_CONTEXT_ROW_RE,
  GIT_POLICY_VALUES,
  AI_COMMIT_MARKER_VALUES,
  parseContextLine,
  blankFencedBlocks,
  extractHeadings,
  extractH2Headings,
  extractSectionRefs,
  headingResolves,
  missingTemplateSections,
  matchesTemplateWithPlaceholders,
  SPEC_FORMATTING_CONVENTION_SNIPPET,
  hasTableWithoutConventionComment,
  conventionsSectionBody,
  conventionsSectionBodies,
  CONVENTIONS_FINGERPRINTS,
  CONVENTIONS_RETIRED,
  // Exported so the edition filter can be tested directly. Every shipped entry
  // has `editions: null`, so `findConventionsDrift` alone can never exercise the
  // non-null path — a test written through it would prove nothing.
  fingerprintAppliesTo,
  isThematicBreak,
  // The single block-structure decision point (debt 12). Exported so
  // `lib/init.js` can locate headings through it instead of hand-rolling a
  // fourth ATX expression, and so `test/upgrade-drift.mjs` can assert labels
  // directly rather than only through what a section body happens to contain.
  parseAtxHeading,
  classifyLines,
  visibleTextLines,
  maskCodeBlocks,
  unclosedHtmlBlockLine,
  // Exported so `lib/init.js` reads the rule instead of writing a third copy of
  // `/^[ \t]*$/` inline. The commit that introduced this constant claimed it and
  // `stripSpaceTab` were "the only two spellings now"; they were not, because
  // neither was reachable from the other file.
  BLANK_LINE_RE,
  stripSpaceTab,
  findConventionsDrift
};
