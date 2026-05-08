import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dflowBin = join(repoRoot, 'bin', 'dflow.js');
const RUN_TIMEOUT_MS = 30000;

const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-smoke-'));

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function runDflow(cwd, input = '', args = ['init']) {
  const result = spawnSync(process.execPath, [dflowBin, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }

  return {
    code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

try {
  const input = [
    '1',
    'ASP.NET Core 9, EF Core 8, MediatR 12, xUnit',
    'none',
    '1',
    '1,2',
    '1,2,3,4',
    'y'
  ].join('\n') + '\n';

  const first = await runDflow(tempRoot, input);
  assert.equal(first.code, 0, `first init failed\nSTDOUT:\n${first.stdout}\nSTDERR:\n${first.stderr}`);

  assert.equal(await exists(join(tempRoot, 'specs')), false, 'root specs/ should not be created');

  const mandatoryPaths = [
    'dflow/specs/features/active/.gitkeep',
    'dflow/specs/features/completed/.gitkeep',
    'dflow/specs/features/backlog/.gitkeep',
    'dflow/specs/shared/_conventions.md',
    'dflow/specs/shared/AI-AGENT-GUIDE.md',
    'dflow/specs/shared/_overview.md',
    'dflow/specs/shared/Git-principles-trunk.md',
    'dflow/specs/domain/glossary.md',
    'dflow/specs/domain/context-map.md',
    'dflow/specs/architecture/tech-debt.md',
    'dflow/specs/architecture/decisions/README.md',
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md'
  ];

  for (const relativePath of mandatoryPaths) {
    assert.equal(
      await exists(join(tempRoot, relativePath)),
      true,
      `${relativePath} should exist\nSTDOUT:\n${first.stdout}\nSTDERR:\n${first.stderr}`
    );
  }

  const conventions = await readFile(join(tempRoot, 'dflow/specs/shared/_conventions.md'), 'utf8');
  assert.equal((conventions.match(/^## Prose Language$/gm) || []).length, 1, 'Prose Language section count');
  assert.match(conventions, /Project prose language: `zh-TW`/);
  assert.match(conventions, /\[Glossary\]\(\.\.\/domain\/glossary\.md\)/);
  assert.match(conventions, /^> Dflow Version: \d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/m, 'Greenfield Dflow Version field present');

  const overview = await readFile(join(tempRoot, 'dflow/specs/shared/_overview.md'), 'utf8');
  assert.match(overview, /\[Tech debt backlog\]\(\.\.\/architecture\/tech-debt\.md\)/);
  assert.doesNotMatch(`${conventions}\n${overview}`, /\]\((?:domain|architecture|migration)\//);

  const aiGuide = await readFile(join(tempRoot, 'dflow/specs/shared/AI-AGENT-GUIDE.md'), 'utf8');
  assert.match(aiGuide, /\| Dflow track \| greenfield \|/);
  assert.match(aiGuide, /\| Prose language \| zh-TW \|/);
  assert.match(aiGuide, /\/dflow:report-dflow-feedback/);

  const agentsGuide = await readFile(join(tempRoot, 'AGENTS.md'), 'utf8');
  const claudeGuide = await readFile(join(tempRoot, 'CLAUDE.md'), 'utf8');
  const geminiGuide = await readFile(join(tempRoot, 'GEMINI.md'), 'utf8');
  const copilotGuide = await readFile(join(tempRoot, '.github/copilot-instructions.md'), 'utf8');
  assert.match(agentsGuide, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
  assert.match(claudeGuide, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
  assert.match(geminiGuide, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
  assert.match(copilotGuide, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);

  const second = await runDflow(tempRoot);
  assert.notEqual(second.code, 0, 'second init should abort');
  assert.match(second.stderr, /Dflow already initialized at dflow\/specs\/\./);

  const cleanDoctor = await runDflow(tempRoot, '', ['doctor']);
  assert.equal(cleanDoctor.code, 0, `doctor on clean V1 init failed\nSTDOUT:\n${cleanDoctor.stdout}\nSTDERR:\n${cleanDoctor.stderr}`);
  assert.match(cleanDoctor.stdout, /^Dflow Doctor /m, 'doctor should print header');
  assert.match(cleanDoctor.stdout, /All checks passed\. No legacy artifacts detected\./);

  const legacyRoot = join(tempRoot, 'legacy-warning');
  await mkdir(join(legacyRoot, 'specs'), { recursive: true });
  await writeFile(join(legacyRoot, 'specs', 'legacy.md'), '# Existing non-Dflow specs\n');

  const legacyInput = [
    '1',
    'ASP.NET Core 9, EF Core 8, MediatR 12, xUnit',
    'none',
    '2',
    'none',
    'none',
    'y'
  ].join('\n') + '\n';

  const legacy = await runDflow(legacyRoot, legacyInput);
  assert.equal(legacy.code, 0, `legacy init failed\nSTDOUT:\n${legacy.stdout}\nSTDERR:\n${legacy.stderr}`);
  assert.match(legacy.stderr, /Detected legacy specs\/\./);
  assert.equal(await exists(join(legacyRoot, 'specs', 'legacy.md')), true, 'legacy specs/ file should remain untouched');
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/_conventions.md')), true, 'legacy run should write dflow/specs/');

  const legacyDoctor = await runDflow(legacyRoot, '', ['doctor']);
  assert.equal(legacyDoctor.code, 0, `doctor on legacy project failed\nSTDOUT:\n${legacyDoctor.stdout}\nSTDERR:\n${legacyDoctor.stderr}`);
  assert.match(legacyDoctor.stdout, /\[warn\] Legacy specs\/ directory at project root/);
  assert.match(legacyDoctor.stdout, /docs\/migrating-to-dflow-v1\.md/);
  assert.match(legacyDoctor.stdout, /Doctor is read-only and does not modify any files\./);
  assert.equal(await exists(join(legacyRoot, 'specs', 'legacy.md')), true, 'doctor should not touch legacy specs/');

  await writeFile(join(legacyRoot, 'AGENTS.md'), '# Existing agent rules\n');
  const configureInput = [
    '1,2,4',
    'y'
  ].join('\n') + '\n';
  const configured = await runDflow(legacyRoot, configureInput, ['configure-agents']);
  assert.equal(configured.code, 0, `configure-agents failed\nSTDOUT:\n${configured.stdout}\nSTDERR:\n${configured.stderr}`);
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/AI-AGENT-GUIDE.md')), true, 'configure should create canonical AI guide');
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/AGENTS-md-snippet.md')), true, 'configure should write merge snippet for existing AGENTS.md');
  assert.equal(await exists(join(legacyRoot, 'CLAUDE.md')), true, 'configure should create selected CLAUDE.md shim');
  assert.equal(await exists(join(legacyRoot, '.github/copilot-instructions.md')), true, 'configure should create selected Copilot shim');
  const existingAgents = await readFile(join(legacyRoot, 'AGENTS.md'), 'utf8');
  assert.match(existingAgents, /^# Existing agent rules/);

  const reconfigured = await runDflow(legacyRoot, '2\ny\n', ['configure-agents']);
  assert.equal(reconfigured.code, 0, `second configure-agents failed\nSTDOUT:\n${reconfigured.stdout}\nSTDERR:\n${reconfigured.stderr}`);
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/CLAUDE-md-snippet.md')), false, 'configured CLAUDE.md should skip instead of creating a duplicate snippet');

  const webformsRoot = join(tempRoot, 'webforms-custom');
  await mkdir(webformsRoot, { recursive: true });

  const webformsInput = [
    '2',
    'ASP.NET WebForms 4.8, .NET Framework 4.8, EF6',
    'Future ASP.NET Core migration',
    '4',
    'fr-CA',
    '1',
    '2',
    'y'
  ].join('\n') + '\n';

  const webforms = await runDflow(webformsRoot, webformsInput);
  assert.equal(webforms.code, 0, `brownfield init failed\nSTDOUT:\n${webforms.stdout}\nSTDERR:\n${webforms.stderr}`);

  const webformsPaths = [
    'dflow/specs/features/active/.gitkeep',
    'dflow/specs/features/completed/.gitkeep',
    'dflow/specs/features/backlog/.gitkeep',
    'dflow/specs/shared/_conventions.md',
    'dflow/specs/shared/AI-AGENT-GUIDE.md',
    'dflow/specs/shared/_overview.md',
    'dflow/specs/domain/glossary.md',
    'dflow/specs/migration/tech-debt.md',
    'CLAUDE.md'
  ];

  for (const relativePath of webformsPaths) {
    assert.equal(await exists(join(webformsRoot, relativePath)), true, `${relativePath} should exist`);
  }

  assert.equal(await exists(join(webformsRoot, 'dflow/specs/domain/context-map.md')), false, 'Brownfield init should not create context-map.md');
  assert.equal(await exists(join(webformsRoot, 'dflow/specs/architecture')), false, 'Brownfield init should not create architecture/');

  const webformsConventions = await readFile(join(webformsRoot, 'dflow/specs/shared/_conventions.md'), 'utf8');
  assert.equal((webformsConventions.match(/^## Prose Language$/gm) || []).length, 1, 'Brownfield Prose Language section count');
  assert.match(webformsConventions, /Project prose language: `fr-CA`/);
  assert.match(webformsConventions, /^> Dflow Version: \d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/m, 'Brownfield Dflow Version field present');

  const webformsOverview = await readFile(join(webformsRoot, 'dflow/specs/shared/_overview.md'), 'utf8');
  assert.match(webformsOverview, /\[Tech debt backlog\]\(\.\.\/migration\/tech-debt\.md\)/);
  assert.doesNotMatch(`${webformsConventions}\n${webformsOverview}`, /\]\((?:domain|architecture|migration)\//);

  const rootClaude = await readFile(join(webformsRoot, 'CLAUDE.md'), 'utf8');
  assert.match(rootClaude, /^# CLAUDE\.md - Dflow Project Instructions/);
  assert.match(rootClaude, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);

  console.log(`Smoke test passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
