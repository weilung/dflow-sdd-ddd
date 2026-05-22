import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

function legacyV050Wrapper(id, label, argHint) {
  const argHintLine = argHint === '-'
    ? 'Argument hint: none.'
    : `Argument hint: ${argHint}.`;

  return `# /dflow-${id}

Execute the canonical \`${label}\` Dflow workflow or control command.

Definition: \`dflow/specs/shared/AI-AGENT-GUIDE.md\`

${argHintLine}
`;
}

function toCrlf(content) {
  return content.replace(/\n/g, '\r\n');
}

try {
  const input = [
    '1',
    'ASP.NET Core 9, EF Core 8, MediatR 12, xUnit',
    'none',
    '1',
    '1,2',
    '1,2,3',
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
  assert.match(aiGuide, /\/dflow:status/);
  assert.match(aiGuide, /\/dflow:next/);
  assert.match(aiGuide, /\/dflow:cancel/);

  const agentsGuide = await readFile(join(tempRoot, 'AGENTS.md'), 'utf8');
  const claudeGuide = await readFile(join(tempRoot, 'CLAUDE.md'), 'utf8');
  const copilotGuide = await readFile(join(tempRoot, '.github/copilot-instructions.md'), 'utf8');
  assert.match(agentsGuide, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
  assert.match(claudeGuide, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
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
    '1,2,3',
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

  const adapterConfigured = await runDflow(legacyRoot, configureInput, ['configure-agents', '--command-adapters']);
  assert.equal(
    adapterConfigured.code,
    0,
    `configure-agents --command-adapters failed\nSTDOUT:\n${adapterConfigured.stdout}\nSTDERR:\n${adapterConfigured.stderr}`
  );

  const claudeCommandFiles = (await readdir(join(legacyRoot, '.claude/commands/dflow'))).sort();
  assert.equal(claudeCommandFiles.length, 11, 'Claude command adapter count');
  assert.deepEqual(
    claudeCommandFiles.slice(0, 3),
    ['bug-fix.md', 'cancel.md', 'finish-feature.md'],
    'Claude command adapter file names should use Claude namespace IDs'
  );
  assert.equal(claudeCommandFiles.includes('new-feature.md'), true, 'Claude new-feature command adapter should exist');
  assert.equal(claudeCommandFiles.includes('status.md'), true, 'Claude status command adapter should exist');
  assert.equal(claudeCommandFiles.includes('dflow-new-feature.md'), false, 'Claude adapter should not keep the old double-prefix filename');
  assert.equal(claudeCommandFiles.includes('dflow-status.md'), false, 'Claude adapter should not keep the old double-prefix status filename');
  assert.equal(
    claudeCommandFiles.every((file) => !/^dflow-.*\.md$/.test(file)),
    true,
    'Claude command adapters should not use dflow- prefixed file names'
  );

  const copilotPromptFiles = (await readdir(join(legacyRoot, '.github/prompts'))).sort();
  assert.equal(copilotPromptFiles.length, 11, 'Copilot prompt adapter count');
  assert.equal(
    copilotPromptFiles.includes('dflow-new-feature.prompt.md'),
    true,
    'Copilot new-feature prompt adapter should exist'
  );
  assert.equal(copilotPromptFiles.includes('dflow-next.prompt.md'), true, 'Copilot next prompt adapter should exist');

  const claudeWrapper = await readFile(join(legacyRoot, '.claude/commands/dflow/new-feature.md'), 'utf8');
  const copilotWrapper = await readFile(join(legacyRoot, '.github/prompts/dflow-new-feature.prompt.md'), 'utf8');
  assert.match(claudeWrapper, /^# \/dflow:new-feature$/m, 'Claude wrapper should use Claude command namespace name');
  assert.match(copilotWrapper, /^# \/dflow-new-feature$/m, 'Copilot wrapper should use prompt menu name');
  for (const [name, content] of Object.entries({ claudeWrapper, copilotWrapper })) {
    assert.match(content, /<!-- dflow-generated: command-adapter -->/, `${name} should include generated adapter marker`);
    assert.match(content, /Execute the canonical `\/dflow:new-feature` Dflow workflow or control command\./);
    assert.match(content, /Definition: `dflow\/specs\/shared\/AI-AGENT-GUIDE\.md`/);
    assert.match(content, /Argument hint: feature request\./);
    assert.doesNotMatch(content, /Do not jump|Status \/ Control Commands|Source of Truth|Spec before code|Step Gate/);
  }

  assert.equal(await exists(join(legacyRoot, '.agents/skills/dflow/SKILL.md')), false, 'Codex skill adapter should not be created');
  assert.equal(await exists(join(legacyRoot, '.codex/commands/dflow-new-feature.md')), false, 'Codex command adapter should not be created');
  const existingAgentsSnippet = await readFile(join(legacyRoot, 'dflow/specs/shared/AGENTS-md-snippet.md'), 'utf8');
  assert.match(existingAgentsSnippet, /## Dflow Text Triggers/, 'Codex merge snippet should include text trigger guidance');
  assert.match(existingAgentsSnippet, /resend it without the slash, for example\s+`dflow:status`/, 'Codex merge snippet should explain no-slash text fallback');

  await mkdir(join(legacyRoot, '.claude/commands/dflow'), { recursive: true });
  await mkdir(join(legacyRoot, '.claude/commands/other'), { recursive: true });
  const legacyStatusPath = join(legacyRoot, '.claude/commands/dflow/dflow-status.md');
  const legacyNextPath = join(legacyRoot, '.claude/commands/dflow/dflow-next.md');
  const customizedLegacyCancelPath = join(legacyRoot, '.claude/commands/dflow/dflow-cancel.md');
  const nonRegistryDflowPath = join(legacyRoot, '.claude/commands/dflow/dflow-local.md');
  const nonDflowPath = join(legacyRoot, '.claude/commands/other/foo.md');
  await writeFile(legacyStatusPath, legacyV050Wrapper('status', '/dflow:status', '-'));
  await writeFile(legacyNextPath, toCrlf(legacyV050Wrapper('next', '/dflow:next', '-')));
  await writeFile(
    customizedLegacyCancelPath,
    `${legacyV050Wrapper('cancel', '/dflow:cancel', '-')}\nCustom local note.\n`
  );
  await writeFile(nonRegistryDflowPath, '# /dflow-local\n\nLocal project command.\n');
  await writeFile(nonDflowPath, '# /other:foo\n\nOutside Dflow command namespace.\n');

  const staleCleanup = await runDflow(legacyRoot, '2\ny\n', ['configure-agents', '--command-adapters']);
  assert.equal(
    staleCleanup.code,
    0,
    `stale cleanup configure-agents failed\nSTDOUT:\n${staleCleanup.stdout}\nSTDERR:\n${staleCleanup.stderr}`
  );
  assert.match(staleCleanup.stdout, /\.claude\/commands\/dflow\/dflow-status\.md \| remove \|/, 'LF v0.5.0 stale adapter should be listed for removal');
  assert.match(staleCleanup.stdout, /\.claude\/commands\/dflow\/dflow-next\.md \| remove \|/, 'CRLF v0.5.0 stale adapter should be listed for removal');
  assert.match(staleCleanup.stdout, /Found legacy Dflow command adapter with non-generated content; not removed: \.claude\/commands\/dflow\/dflow-cancel\.md/, 'customized legacy adapter should warn and remain');
  assert.doesNotMatch(staleCleanup.stdout, /\.claude\/commands\/dflow\/dflow-local\.md \| remove \|/, 'non-registry dflow-local adapter should not be removed');
  assert.equal(await exists(legacyStatusPath), false, 'exact LF v0.5.0 stale adapter should be removed');
  assert.equal(await exists(legacyNextPath), false, 'exact CRLF v0.5.0 stale adapter should be removed');
  assert.equal(await exists(customizedLegacyCancelPath), true, 'customized legacy adapter should remain');
  assert.equal(await exists(nonRegistryDflowPath), true, 'same-namespace non-registry adapter should remain');
  assert.equal(await exists(nonDflowPath), true, 'non-dflow command file should remain untouched');

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

  const codexAdapterConfigured = await runDflow(webformsRoot, '1\ny\n', ['configure-agents', '--command-adapters']);
  assert.equal(
    codexAdapterConfigured.code,
    0,
    `Codex configure-agents --command-adapters failed\nSTDOUT:\n${codexAdapterConfigured.stdout}\nSTDERR:\n${codexAdapterConfigured.stderr}`
  );
  const webformsAgents = await readFile(join(webformsRoot, 'AGENTS.md'), 'utf8');
  assert.match(webformsAgents, /## Dflow Text Triggers/);
  assert.match(webformsAgents, /`\/dflow:new-feature` as text/);
  assert.match(webformsAgents, /`\/dflow:cancel` as text/);
  assert.match(webformsAgents, /resend it without the slash, for example\s+`dflow:status`/, 'Codex AGENTS shim should explain no-slash text fallback');
  assert.equal(await exists(join(webformsRoot, '.agents/skills/dflow/SKILL.md')), false, 'Codex skill adapter should not be created for Codex-only configuration');
  assert.equal(await exists(join(webformsRoot, '.claude/commands/dflow/new-feature.md')), false, 'Codex-only command-adapters should not create Claude files');

  // Non-.NET init e2e — Java/Spring Boot greenfield project.
  // Verifies that:
  // - extractTechStackPlaceholders recognizes non-.NET stack version strings
  // - generated _overview.md / AI-AGENT-GUIDE.md / CLAUDE.md do not leak .NET-specific literals
  // - canonical placeholders (Framework version / ORM / persistence / Test framework) resolve correctly
  const javaRoot = join(tempRoot, 'java-spring');
  await mkdir(javaRoot, { recursive: true });

  const javaInput = [
    '1',
    'Java 21, Spring Boot 3.3, Spring Data JPA, JUnit 5',
    'none',
    '2',
    '1,2',
    '1,2,3',
    'y'
  ].join('\n') + '\n';

  const java = await runDflow(javaRoot, javaInput);
  assert.equal(java.code, 0, `non-.NET init failed\nSTDOUT:\n${java.stdout}\nSTDERR:\n${java.stderr}`);

  const javaOverview = await readFile(join(javaRoot, 'dflow/specs/shared/_overview.md'), 'utf8');
  const javaAiGuide = await readFile(join(javaRoot, 'dflow/specs/shared/AI-AGENT-GUIDE.md'), 'utf8');
  const javaConventions = await readFile(join(javaRoot, 'dflow/specs/shared/_conventions.md'), 'utf8');
  const javaClaude = await readFile(join(javaRoot, 'CLAUDE.md'), 'utf8');
  const javaAgents = await readFile(join(javaRoot, 'AGENTS.md'), 'utf8');

  for (const [name, content] of Object.entries({ javaOverview, javaAiGuide, javaConventions, javaClaude, javaAgents })) {
    assert.doesNotMatch(content, /\{ASP\.NET Core version\}/, `${name} should not contain unresolved {ASP.NET Core version}`);
    assert.doesNotMatch(content, /\{EF Core version\}/, `${name} should not contain unresolved {EF Core version}`);
    assert.doesNotMatch(content, /\{MediatR version\}/, `${name} should not contain unresolved {MediatR version}`);
    assert.doesNotMatch(content, /\{Framework version\}/, `${name} should not contain unresolved {Framework version}`);
    assert.doesNotMatch(content, /\{ORM version\}/, `${name} should not contain unresolved {ORM version}`);
    assert.doesNotMatch(content, /\{Test framework\}/, `${name} should not contain unresolved {Test framework}`);
  }

  // tech-stack-summary should be preserved verbatim somewhere (sanity check for substitution)
  assert.match(javaAiGuide, /Spring Boot 3\.3/, 'AI guide should retain Java/Spring Boot tech-stack-summary');

  // unresolvedInitPlaceholders warning should not fire for canonical placeholder fallbacks
  // (Codex review note: "unresolved fallback 要保留原 token，否則 warning 會誤導")
  assert.doesNotMatch(java.stdout, /Unresolved placeholders remain.*\{ASP\.NET Core version\}/);

  console.log(`Smoke test passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
