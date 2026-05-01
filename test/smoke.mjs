import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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

function runDflow(cwd, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [dflowBin, 'init'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, RUN_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`dflow init timed out after ${RUN_TIMEOUT_MS}ms\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
        return;
      }
      resolve({ code, stdout, stderr });
    });

    if (!input) {
      child.stdin.end();
      return;
    }

    let inputSent = false;
    const sendInput = () => {
      if (inputSent) {
        return;
      }
      inputSent = true;
      child.stdin.end(input);
    };

    child.stdout.once('data', sendInput);
    child.stderr.once('data', sendInput);
  });
}

try {
  const input = [
    '1',
    '1',
    'ASP.NET Core 9, EF Core 8, MediatR 12, xUnit',
    'none',
    '1',
    '1,2',
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
    'dflow/specs/shared/_overview.md',
    'dflow/specs/shared/Git-principles-trunk.md',
    'dflow/specs/domain/glossary.md',
    'dflow/specs/domain/context-map.md',
    'dflow/specs/architecture/tech-debt.md',
    'dflow/specs/architecture/decisions/README.md'
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

  const overview = await readFile(join(tempRoot, 'dflow/specs/shared/_overview.md'), 'utf8');
  assert.match(overview, /\[Tech debt backlog\]\(\.\.\/architecture\/tech-debt\.md\)/);
  assert.doesNotMatch(`${conventions}\n${overview}`, /\]\((?:domain|architecture|migration)\//);

  const second = await runDflow(tempRoot);
  assert.notEqual(second.code, 0, 'second init should abort');
  assert.match(second.stderr, /Dflow already initialized at dflow\/specs\/\./);

  const legacyRoot = join(tempRoot, 'legacy-warning');
  await mkdir(join(legacyRoot, 'specs'), { recursive: true });
  await writeFile(join(legacyRoot, 'specs', 'legacy.md'), '# Existing non-Dflow specs\n');

  const legacyInput = [
    '1',
    '1',
    'ASP.NET Core 9, EF Core 8, MediatR 12, xUnit',
    'none',
    '2',
    'none',
    'y'
  ].join('\n') + '\n';

  const legacy = await runDflow(legacyRoot, legacyInput);
  assert.equal(legacy.code, 0, `legacy init failed\nSTDOUT:\n${legacy.stdout}\nSTDERR:\n${legacy.stderr}`);
  assert.match(legacy.stderr, /Detected legacy specs\/\./);
  assert.equal(await exists(join(legacyRoot, 'specs', 'legacy.md')), true, 'legacy specs/ file should remain untouched');
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/_conventions.md')), true, 'legacy run should write dflow/specs/');

  const webformsRoot = join(tempRoot, 'webforms-custom');
  await mkdir(webformsRoot, { recursive: true });

  const webformsInput = [
    '1',
    '2',
    'ASP.NET WebForms 4.8, .NET Framework 4.8, EF6',
    'Future ASP.NET Core migration',
    '4',
    'fr-CA',
    '1,4',
    'y'
  ].join('\n') + '\n';

  const webforms = await runDflow(webformsRoot, webformsInput);
  assert.equal(webforms.code, 0, `webforms init failed\nSTDOUT:\n${webforms.stdout}\nSTDERR:\n${webforms.stderr}`);

  const webformsPaths = [
    'dflow/specs/features/active/.gitkeep',
    'dflow/specs/features/completed/.gitkeep',
    'dflow/specs/features/backlog/.gitkeep',
    'dflow/specs/shared/_conventions.md',
    'dflow/specs/shared/_overview.md',
    'dflow/specs/domain/glossary.md',
    'dflow/specs/migration/tech-debt.md',
    'CLAUDE.md'
  ];

  for (const relativePath of webformsPaths) {
    assert.equal(await exists(join(webformsRoot, relativePath)), true, `${relativePath} should exist`);
  }

  assert.equal(await exists(join(webformsRoot, 'dflow/specs/domain/context-map.md')), false, 'WebForms init should not create context-map.md');
  assert.equal(await exists(join(webformsRoot, 'dflow/specs/architecture')), false, 'WebForms init should not create architecture/');

  const webformsConventions = await readFile(join(webformsRoot, 'dflow/specs/shared/_conventions.md'), 'utf8');
  assert.equal((webformsConventions.match(/^## Prose Language$/gm) || []).length, 1, 'WebForms Prose Language section count');
  assert.match(webformsConventions, /Project prose language: `fr-CA`/);

  const webformsOverview = await readFile(join(webformsRoot, 'dflow/specs/shared/_overview.md'), 'utf8');
  assert.match(webformsOverview, /\[Tech debt backlog\]\(\.\.\/migration\/tech-debt\.md\)/);
  assert.doesNotMatch(`${webformsConventions}\n${webformsOverview}`, /\]\((?:domain|architecture|migration)\//);

  const rootClaude = await readFile(join(webformsRoot, 'CLAUDE.md'), 'utf8');
  assert.match(rootClaude, /^# Project:/);
  assert.doesNotMatch(rootClaude, /## Snippet to merge into `CLAUDE\.md`/);
  assert.doesNotMatch(rootClaude, /## Merge Guidance/);

  console.log(`Smoke test passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
