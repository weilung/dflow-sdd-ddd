// Registry-parity guard (PROPOSAL-053 / F-02).
//
// The 11 /dflow:* commands are hand-duplicated across several surfaces. The
// runtime parser (lib/init.js) already enforces each edition's registry id-set
// against EXPECTED_COMMAND_IDS; this test guards what the runtime does NOT:
// cross-edition and cross-surface consistency of the command lists.
//
// Deliberately self-contained: it ships its own tiny Markdown-table parser
// instead of importing lib/init.js, so (a) it needs no runtime export and keeps
// F-02 a zero-lib-change addition, and (b) a parser bug cannot hide itself by
// being the same code under test. This test reads templates/, the single
// content source (PROPOSAL-075).

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const EDITIONS = ['greenfield', 'brownfield'];
const REGISTRY_START = '<!-- dflow-command-registry:start -->';
const REGISTRY_END = '<!-- dflow-command-registry:end -->';

function splitRow(line) {
  const inner = line.trim().slice(1, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') {
      cur += '|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function isTableLine(line) {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|');
}

function stripCode(value) {
  const t = String(value).trim();
  return t.startsWith('`') && t.endsWith('`') && t.length >= 2 ? t.slice(1, -1) : t;
}

function commandId(labelCell) {
  const label = stripCode(labelCell);
  const match = label.match(/^\/dflow:([a-z][a-z0-9-]*)$/);
  assert.ok(match, `expected a /dflow:<id> label, got: ${labelCell}`);
  return match[1];
}

// Data rows (header + delimiter dropped) of the first table whose header cells
// equal `header` (case-insensitive).
function tableByHeader(content, header) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!isTableLine(lines[i])) continue;
    const cells = splitRow(lines[i]).map((c) => c.toLowerCase());
    if (cells.length !== header.length || !header.every((h, idx) => cells[idx] === h)) {
      continue;
    }
    const rows = [];
    for (let j = i + 2; j < lines.length && isTableLine(lines[j]); j += 1) {
      const cells = splitRow(lines[j]);
      assert.equal(
        cells.length,
        header.length,
        `table ${JSON.stringify(header)} has a ${cells.length}-cell row (expected ${header.length}): ${lines[j].trim()}`
      );
      rows.push(cells);
    }
    return rows;
  }
  throw new Error(`table with header ${JSON.stringify(header)} not found`);
}

// Machine command-registry rows from between the registry markers.
function registryRows(content) {
  const start = content.indexOf(REGISTRY_START);
  const end = content.indexOf(REGISTRY_END);
  assert.ok(start !== -1 && end !== -1 && end > start, 'command-registry markers must be present');
  const block = content.slice(start + REGISTRY_START.length, end);
  const lines = block.split(/\r?\n/).filter(isTableLine);
  return lines.slice(2).map((line) => {
    const c = splitRow(line);
    assert.equal(c.length, 5, `command-registry row must have 5 cells: ${line}`);
    return {
      id: stripCode(c[0]),
      label: stripCode(c[1]),
      description: stripCode(c[2]),
      argHint: stripCode(c[3]),
      scope: stripCode(c[4])
    };
  });
}

const guide = {};
for (const ed of EDITIONS) {
  guide[ed] = await readFile(join(repoRoot, 'templates', ed, 'scaffolding', 'AI-AGENT-GUIDE.md'), 'utf8');
}
const skill = await readFile(join(repoRoot, 'templates', 'common', 'skill', 'SKILL.md'), 'utf8');

// (1) Machine registry: GF deep-equals BF, including row order and every field.
const registry = Object.fromEntries(EDITIONS.map((ed) => [ed, registryRows(guide[ed])]));
assert.ok(registry.greenfield.length >= 1, 'registry must not be empty');
assert.deepEqual(
  registry.greenfield,
  registry.brownfield,
  'machine command-registry must be identical across editions (order + all fields)'
);

// Canonical sets derived from the (now-proven-identical) registry.
const canonical = registry.greenfield;
const registryLabels = new Set(canonical.map((r) => r.label));
const workflowIds = new Set(canonical.filter((r) => r.scope === 'workflow').map((r) => r.id));

// (2) Human "Workflow | Use when" table: in-edition labels match the registry,
//     and full row content matches across editions (order-insensitive).
const humanMap = {};
for (const ed of EDITIONS) {
  const rows = tableByHeader(guide[ed], ['workflow', 'use when']);
  const labels = new Set(rows.map((r) => stripCode(r[0])));
  assert.equal(rows.length, labels.size, `[${ed}] human table has duplicate command rows`);
  assert.deepEqual(labels, registryLabels, `[${ed}] human table labels must equal the registry labels`);
  humanMap[ed] = Object.fromEntries(rows.map((r) => [commandId(r[0]), r[1]]));
}
assert.deepEqual(
  humanMap.greenfield,
  humanMap.brownfield,
  'human "Workflow | Use when" content must match across editions'
);

// (3) Routing "Command | Flow file" table: in-edition commands equal the
//     workflow-scoped registry ids, and content matches across editions.
const routingMap = {};
for (const ed of EDITIONS) {
  const rows = tableByHeader(guide[ed], ['command', 'flow file']);
  routingMap[ed] = Object.fromEntries(rows.map((r) => [commandId(r[0]), r[1]]));
  assert.equal(rows.length, Object.keys(routingMap[ed]).length, `[${ed}] routing table has duplicate command rows`);
  const ids = new Set(Object.keys(routingMap[ed]));
  assert.deepEqual(ids, workflowIds, `[${ed}] routing commands must equal the workflow-scoped registry ids`);
}
assert.deepEqual(
  routingMap.greenfield,
  routingMap.brownfield,
  'routing "Command | Flow file" content must match across editions'
);

// (4) SKILL.md frontmatter lists exactly the registry command labels (set parity;
//     order is not asserted — the frontmatter prose order is not load-bearing).
const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
assert.ok(frontmatter, 'SKILL.md must have YAML frontmatter');
const skillLabels = new Set([...frontmatter[1].matchAll(/\/dflow:[a-z][a-z0-9-]*/g)].map((m) => m[0]));
assert.deepEqual(
  skillLabels,
  registryLabels,
  'SKILL.md frontmatter must list exactly the registry command labels'
);

// (5) SKILL.md description must stay within the agentskills.io / Codex limit of
//     1024 characters. Codex SKIPS a skill whose description exceeds it (Claude
//     Code does not enforce this, so the cross-tool common layer is gated by the
//     stricter Codex limit). Compute the folded (parsed) value: dedent the
//     `description: >` block (the last frontmatter key) and join lines the way a
//     YAML folded scalar does (one separator char per line break).
const descLines = frontmatter[1].split(/\r?\n/);
const descStart = descLines.findIndex((line) => line.startsWith('description:'));
assert.ok(descStart !== -1, 'SKILL.md frontmatter must have a description');
const foldedDescription = descLines
  .slice(descStart + 1)
  .map((line) => line.replace(/^  /, ''))
  .join(' ')
  .trim();
assert.ok(
  foldedDescription.length <= 1024,
  `SKILL.md description folds to ${foldedDescription.length} chars; must be <= 1024 (Codex skips longer descriptions)`
);

console.log('registry-parity: all checks passed');
