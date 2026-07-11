// PROPOSAL-058: pure, shippable drift-detection helpers for `dflow doctor`.
//
// The dev-only cross-ref resolver (scripts/check-cross-refs.mjs, PROPOSAL-055)
// is not part of the npm package, so the runtime checks reimplement the narrow
// subset doctor needs: fence-aware heading extraction, "<file> § Heading"
// reference extraction with soft-wrap joining, tolerant heading matching, and
// template-shape comparison. Everything here is I/O-free — callers read the
// files and pass contents — which keeps the checks unit-testable.

'use strict';

// Machine-readable context lines. Shared with lib/init.js inference
// (inferGitPolicy / inferAiCommitMarker / inferProseLanguage /
// inferTechStackSummary / inferMigrationContext) so the doctor "machine format"
// check can never drift from what inference actually parses.
const GIT_POLICY_LINE_RE = /Selected Git policy:\s*`([^`]+)`/;
const AI_COMMIT_MARKER_LINE_RE = /AI commit marker:\s*`([^`]+)`/;
const PROSE_LANGUAGE_LINE_RE = /Project prose language:\s*`([^`]+)`/;
const TECH_STACK_ROW_RE = /\|\s*Tech stack\s*\|\s*([^|\n]+?)\s*\|/i;
const MIGRATION_CONTEXT_ROW_RE = /\|\s*Migration \/ legacy context\s*\|\s*([^|\n]+?)\s*\|/i;

const GIT_POLICY_VALUES = new Set(['gitflow', 'trunk']);
const AI_COMMIT_MARKER_VALUES = new Set(['none', 'co-authored-by', 'prefix']);

// Trimmed capture of a machine-readable context line, or null when the line is
// absent or its value is whitespace-only. Inference and the doctor checks must
// both parse through this helper: a value doctor accepts has to be the exact
// value configure-agents consumes (e.g. a stray space inside the backticks
// would otherwise pass doctor's trimmed validation yet miss strict comparisons
// like buildSubstitutionMap's `gitflow` check downstream).
function parseContextLine(content, re) {
  const match = content.match(re);
  if (!match) return null;
  const value = match[1].trim();
  return value === '' ? null : value;
}

// Blank out fenced code blocks (``` / ~~~) line-by-line so headings and § refs
// inside examples are never extracted. Line positions are preserved.
function blankFencedBlocks(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let fence = null;
  for (const line of lines) {
    const m = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      out.push('');
      if (m && line.trim().startsWith(fence)) fence = null;
      continue;
    }
    if (m) {
      fence = m[1].slice(0, 3) === '```' ? '```' : '~~~';
      out.push('');
      continue;
    }
    out.push(line);
  }
  return out;
}

// All Markdown heading texts (any level), fence-aware.
function extractHeadings(content) {
  const headings = [];
  for (const line of blankFencedBlocks(content)) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) headings.push(m[1].trim());
  }
  return headings;
}

// H2 ("## ") heading texts only, fence-aware — the section shape of a template.
function extractH2Headings(content) {
  const headings = [];
  for (const line of blankFencedBlocks(content)) {
    const m = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (m) headings.push(m[1].trim());
  }
  return headings;
}

// `<file>.md § Heading` references whose file basename is `targetBasename`.
// A soft-wrapped heading name is captured by joining the next line; a match
// anchored beyond the current line is left to that line's own iteration.
function extractSectionRefs(content, targetBasename) {
  const lines = blankFencedBlocks(content);
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

function normalizeHeading(text) {
  return text.replace(/[`*_]/g, '').trim();
}

// Tolerant heading resolution: a reference resolves when it prefix-matches a
// real heading in either direction (covers soft wraps like "§ Workflow" for
// "Workflow Transparency" and shorthand references).
function headingResolves(referenceText, headings) {
  const want = normalizeHeading(referenceText);
  if (!want) return true;
  return headings.some((heading) => {
    const have = normalizeHeading(heading);
    return have.startsWith(want) || want.startsWith(have);
  });
}

// Which of the template's H2 sections are missing from a filled document — the
// "created from an older template shape" signal.
function missingTemplateSections(templateContent, documentContent) {
  const have = new Set(extractH2Headings(documentContent).map(normalizeHeading));
  return extractH2Headings(templateContent).filter((heading) => !have.has(normalizeHeading(heading)));
}

// True when `content` matches `templateContent` up to placeholder substitution:
// every single-line `{...}` placeholder in the template may match any text.
// Distinguishes "pristine current starter" from "edited or older starter"
// without knowing the values init substituted.
function matchesTemplateWithPlaceholders(content, templateContent) {
  const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
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

module.exports = {
  GIT_POLICY_LINE_RE,
  AI_COMMIT_MARKER_LINE_RE,
  PROSE_LANGUAGE_LINE_RE,
  TECH_STACK_ROW_RE,
  MIGRATION_CONTEXT_ROW_RE,
  GIT_POLICY_VALUES,
  AI_COMMIT_MARKER_VALUES,
  parseContextLine,
  extractHeadings,
  extractH2Headings,
  extractSectionRefs,
  headingResolves,
  missingTemplateSections,
  matchesTemplateWithPlaceholders
};
