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
    '1',       // prose: zh-TW
    '2',       // Git policy: trunk
    '1',       // AI commit marker: none
    '1',       // optional starter files: overview
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

  // PROPOSAL-047: mandatory Git policy + AI commit marker recorded in _conventions.md
  assert.equal((conventions.match(/^## Git Policy$/gm) || []).length, 1, 'Git Policy section count');
  assert.match(conventions, /Selected Git policy: `trunk`/, 'greenfield Git policy recorded');
  assert.equal((conventions.match(/^## AI Commit Policy$/gm) || []).length, 1, 'AI Commit Policy section count');
  assert.match(conventions, /AI commit marker: `none`/, 'greenfield AI commit marker recorded');

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
    '2',       // prose
    '2',       // Git policy: trunk
    '1',       // AI commit marker: none
    'none',    // optional starter files
    'none',    // AI agents
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
    assert.match(content, /Registry and rules: `dflow\/specs\/shared\/AI-AGENT-GUIDE\.md`/);
    assert.match(content, /Workflow steps: `dflow\/specs\/shared\/dflow-workflows\/`/);
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

  // PROPOSAL-038: --skills thin Claude skill adapter
  const skillPath = join(legacyRoot, '.claude/skills/dflow/SKILL.md');
  const skillsConfigured = await runDflow(legacyRoot, '2\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    skillsConfigured.code,
    0,
    `configure-agents --skills failed\nSTDOUT:\n${skillsConfigured.stdout}\nSTDERR:\n${skillsConfigured.stderr}`
  );
  assert.equal(await exists(skillPath), true, '--skills with Claude should create the skill adapter');
  const skillContent = await readFile(skillPath, 'utf8');
  assert.match(skillContent, /<!-- dflow-generated: skill-adapter -->/, 'skill adapter should include the generated skill marker');
  assert.match(skillContent, /^name: dflow$/m, 'skill adapter frontmatter should name the skill dflow');
  assert.match(skillContent, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'skill adapter should point to the canonical guide');

  // Idempotent re-run: marker-stamped skill is rewritten cleanly.
  const skillsRerun = await runDflow(legacyRoot, '2\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    skillsRerun.code,
    0,
    `configure-agents --skills re-run failed\nSTDOUT:\n${skillsRerun.stdout}\nSTDERR:\n${skillsRerun.stderr}`
  );
  assert.equal(await readFile(skillPath, 'utf8'), skillContent, 're-running --skills should rewrite the same marker-stamped skill');

  // Overwrite protection: a user's own non-generated skill is left unchanged + warned.
  const userSkill = '# My own dflow skill\n\nHand-written, not generated.\n';
  await writeFile(skillPath, userSkill);
  const skillsProtected = await runDflow(legacyRoot, '2\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    skillsProtected.code,
    0,
    `configure-agents --skills (overwrite protection) failed\nSTDOUT:\n${skillsProtected.stdout}\nSTDERR:\n${skillsProtected.stderr}`
  );
  assert.equal(await readFile(skillPath, 'utf8'), userSkill, 'non-generated skill should be left unchanged');
  assert.match(
    skillsProtected.stdout,
    /Existing \.claude\/skills\/dflow\/SKILL\.md is not a Dflow-generated skill; left unchanged/,
    'overwrite protection should warn about the non-generated skill'
  );
  assert.doesNotMatch(
    skillsProtected.stdout,
    /\.claude\/skills\/dflow\/SKILL\.md \| (create|update) \|/,
    'non-generated skill should not be in the created/updated set'
  );

  // --skills without Claude selected: warn + no skill file (use a fresh project).
  const noClaudeRoot = join(tempRoot, 'skills-no-claude');
  await mkdir(noClaudeRoot, { recursive: true });
  const noClaudeInit = [
    '1',
    'ASP.NET Core 9, EF Core 8',
    'none',
    '1',       // prose
    '2',       // Git policy: trunk
    '1',       // AI commit marker: none
    '1',       // optional: overview
    'none',    // AI agents
    'y'
  ].join('\n') + '\n';
  const noClaudeInitRun = await runDflow(noClaudeRoot, noClaudeInit, ['init']);
  assert.equal(noClaudeInitRun.code, 0, `no-claude init failed\nSTDOUT:\n${noClaudeInitRun.stdout}\nSTDERR:\n${noClaudeInitRun.stderr}`);
  const noClaudeSkills = await runDflow(noClaudeRoot, '1\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    noClaudeSkills.code,
    0,
    `configure-agents --skills (no claude) failed\nSTDOUT:\n${noClaudeSkills.stdout}\nSTDERR:\n${noClaudeSkills.stderr}`
  );
  assert.match(
    noClaudeSkills.stdout,
    /--skills flag currently supports Claude Code only/,
    '--skills without Claude should warn'
  );
  assert.equal(await exists(join(noClaudeRoot, '.claude/skills/dflow/SKILL.md')), false, '--skills without Claude should not create a skill file');

  // PROPOSAL-039: workflow bundle projection
  // Use the tempRoot (greenfield init already ran there); bundle should have been projected by init.
  const bundleDir = join(tempRoot, 'dflow/specs/shared/dflow-workflows');
  const bundleManifestPath = join(bundleDir, '.dflow-bundle-manifest.json');

  // (i) bundle directory projected
  assert.equal(await exists(bundleDir), true, 'workflow bundle directory should exist after init');

  // (ii) key bundle files present
  const expectedBundleFiles = [
    'references/new-feature-flow.md',
    'references/modify-existing-flow.md',
    'references/finish-feature-flow.md',
    'references/new-phase-flow.md',
    'references/drift-verification.md',
    'references/pr-review-checklist.md',
    'references/dflow-feedback-flow.md',
    'references/git-integration.md',
    'references/init-project-flow.md',
    'templates/glossary.md',
    'templates/phase-spec.md',
    'templates/_index.md',
    'templates/rules.md',
    'templates/behavior.md',
    'templates/aggregate-design.md', // greenfield-only
    'templates/events.md',           // greenfield-only
    'references/ddd-modeling-guide.md', // greenfield-only
  ];
  for (const bundleFile of expectedBundleFiles) {
    assert.equal(
      await exists(join(bundleDir, bundleFile)),
      true,
      `bundle file should exist: dflow-workflows/${bundleFile}`
    );
  }

  // PROPOSAL-051: templates/CLAUDE.md retired — must NOT be projected into the bundle.
  assert.equal(
    await exists(join(bundleDir, 'templates/CLAUDE.md')),
    false,
    'PROPOSAL-051: retired templates/CLAUDE.md must not be projected into the workflow bundle'
  );

  // (iii) bundle files carry the generated marker
  const newFeatureFlow = await readFile(join(bundleDir, 'references/new-feature-flow.md'), 'utf8');
  assert.match(newFeatureFlow, /<!-- dflow-generated: workflow-bundle -->/, 'bundle flow file should carry the generated marker');

  // PROPOSAL-048: feedback flow renders field-by-field for the upstream issue form
  const feedbackFlow = await readFile(join(bundleDir, 'references/dflow-feedback-flow.md'), 'utf8');
  assert.match(feedbackFlow, /issues\/new\/choose/, 'feedback flow should point at the upstream issue chooser');
  assert.match(feedbackFlow, /Upstream Issue Forms/, 'feedback flow should embed the upstream issue-form field map');

  // PROPOSAL-047: the feature _index.md template carries the Checkpoint Log section marker.
  const indexTemplate = await readFile(join(bundleDir, 'templates/_index.md'), 'utf8');
  assert.match(indexTemplate, /<!-- dflow:section checkpoint-log -->/, 'PROPOSAL-047: _index.md template should carry the Checkpoint Log section marker');
  assert.match(indexTemplate, /^## Checkpoint Log$/m, 'PROPOSAL-047: _index.md template should include the Checkpoint Log section');

  // PROPOSAL-047 (review fixes): branch gate precedes the first commit checkpoint;
  // closeout requires a committed (clean) tree; new-phase never recreates a branch.
  const nfFlow = await readFile(join(bundleDir, 'references/new-feature-flow.md'), 'utf8');
  assert.ok(
    nfFlow.includes('Branch gate (policy-aware)') &&
      nfFlow.indexOf('Branch gate (policy-aware)') < nfFlow.indexOf('milestone 1 of 3'),
    'PROPOSAL-047: spec-baseline commit checkpoint must come after the branch gate'
  );
  const ffFlow = await readFile(join(bundleDir, 'references/finish-feature-flow.md'), 'utf8');
  assert.match(ffFlow, /only when the closeout is committed/, 'PROPOSAL-047: Local-closeout requires a committed (clean) tree');
  assert.doesNotMatch(ffFlow, /clean or intentionally staged/, 'PROPOSAL-047: Local-closeout must not accept merely-staged changes');
  const npFlow = await readFile(join(bundleDir, 'references/new-phase-flow.md'), 'utf8');
  assert.match(npFlow, /Never create a new feature branch here/, 'PROPOSAL-047: new-phase must not recreate a feature branch');

  // (iv) manifest present with correct edition and version
  assert.equal(await exists(bundleManifestPath), true, 'bundle manifest should exist');
  const manifestContent = JSON.parse(await readFile(bundleManifestPath, 'utf8'));
  assert.equal(manifestContent.edition, 'greenfield', 'bundle manifest edition should be greenfield');
  assert.match(manifestContent.version, /^\d+\.\d+\.\d+/, 'bundle manifest should record a semver version');
  assert.ok(Array.isArray(manifestContent.files) && manifestContent.files.length > 0, 'bundle manifest should list files');

  // (v) guide references project-local flow paths
  const initedAiGuide = await readFile(join(tempRoot, 'dflow/specs/shared/AI-AGENT-GUIDE.md'), 'utf8');
  assert.match(initedAiGuide, /dflow\/specs\/shared\/dflow-workflows\/references\/new-feature-flow\.md/, 'guide should reference project-local bundle path');

  // (vi) no unreachable source paths in the guide or projected bundle
  assert.doesNotMatch(initedAiGuide, /sdd-ddd-greenfield-skill|sdd-ddd-brownfield-skill/, 'guide should not contain source repo skill paths');

  // (vii) legacyRoot was also initialized as greenfield; verify its bundle.
  const legacyBundleDir = join(legacyRoot, 'dflow/specs/shared/dflow-workflows');
  assert.equal(await exists(legacyBundleDir), true, 'workflow bundle should exist in legacyRoot project');
  const legacyManifest = JSON.parse(await readFile(join(legacyBundleDir, '.dflow-bundle-manifest.json'), 'utf8'));
  assert.equal(legacyManifest.edition, 'greenfield', 'legacyRoot bundle manifest edition should be greenfield');

  // (viii) the webformsRoot (brownfield) will be checked after it is initialized below.
  // We defer brownfield-specific checks to the webforms block.

  // (ix) overwrite protection: manually write a non-generated file into the bundle dir;
  // running init again on a fresh project and then verifying the bundle is safe.
  // (We test the protection via the warning output from addWorkflowBundleItems.)
  // This is implicitly covered: the legacyRoot brownfield init project's bundle
  // files carry the marker, so re-running would update them (not skip).

  // PROPOSAL-041 C0: configure-agents should idempotently re-project a missing bundle
  // (simulates a pre-039 project upgrading to a post-041 dflow without re-init).
  const c0RepairRoot = join(tempRoot, 'c0-repair');
  await mkdir(c0RepairRoot, { recursive: true });
  const c0InitInput = [
    '1',
    'ASP.NET Core 9, EF Core 8, MediatR 12, xUnit',
    'none',
    '1',       // prose
    '2',       // Git policy: trunk
    '1',       // AI commit marker: none
    '1',       // optional: overview
    '1,2,3',
    'y'
  ].join('\n') + '\n';
  const c0Init = await runDflow(c0RepairRoot, c0InitInput);
  assert.equal(c0Init.code, 0, `C0 repair: greenfield init failed\nSTDOUT:\n${c0Init.stdout}\nSTDERR:\n${c0Init.stderr}`);

  const c0BundleDir = join(c0RepairRoot, 'dflow/specs/shared/dflow-workflows');
  assert.equal(await exists(c0BundleDir), true, `C0 repair: bundle should exist right after init\nSTDOUT:\n${c0Init.stdout}`);

  // Simulate a pre-039 project: rip out the entire bundle dir.
  await rm(c0BundleDir, { recursive: true, force: true });
  assert.equal(await exists(c0BundleDir), false, 'C0 repair: bundle should be gone after manual removal');

  // configure-agents should now re-project the bundle (the PROPOSAL-041 C0 fix).
  const c0Repair = await runDflow(c0RepairRoot, '1,2,3\ny\n', ['configure-agents']);
  assert.equal(c0Repair.code, 0, `C0 repair: configure-agents failed\nSTDOUT:\n${c0Repair.stdout}\nSTDERR:\n${c0Repair.stderr}`);
  assert.equal(await exists(c0BundleDir), true, 'C0 repair: configure-agents should re-project the bundle');
  assert.equal(await exists(join(c0BundleDir, '.dflow-bundle-manifest.json')), true, 'C0 repair: manifest should be back');
  assert.equal(await exists(join(c0BundleDir, 'references/new-feature-flow.md')), true, 'C0 repair: key flow file should be back');

  // Second run is a true idempotency check: bundle stays valid, no error.
  const c0Idempotent = await runDflow(c0RepairRoot, '1,2,3\ny\n', ['configure-agents']);
  assert.equal(c0Idempotent.code, 0, `C0 repair: idempotent re-run failed\nSTDOUT:\n${c0Idempotent.stdout}\nSTDERR:\n${c0Idempotent.stderr}`);
  assert.equal(await exists(c0BundleDir), true, 'C0 repair: bundle still present after idempotent re-run');

  const webformsRoot = join(tempRoot, 'webforms-custom');
  await mkdir(webformsRoot, { recursive: true });

  const webformsInput = [
    '2',
    'ASP.NET WebForms 4.8, .NET Framework 4.8, EF6',
    'Future ASP.NET Core migration',
    '4',
    'fr-CA',
    '1',       // Git policy: gitflow (covers the gitflow projection branch)
    '3',       // AI commit marker: prefix (covers the prefix mode)
    '1',       // optional: overview
    '2',       // AI agents: Claude
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

  // PROPOSAL-039: brownfield bundle checks
  const webformsBundleDir = join(webformsRoot, 'dflow/specs/shared/dflow-workflows');
  assert.equal(await exists(webformsBundleDir), true, 'brownfield: workflow bundle dir should exist');
  const webformsBundleManifest = JSON.parse(await readFile(join(webformsBundleDir, '.dflow-bundle-manifest.json'), 'utf8'));
  assert.equal(webformsBundleManifest.edition, 'brownfield', 'brownfield bundle manifest edition should be brownfield');

  // Brownfield bundle should NOT include greenfield-only files
  assert.equal(
    await exists(join(webformsBundleDir, 'references/ddd-modeling-guide.md')),
    false,
    'brownfield bundle should not contain greenfield-only ddd-modeling-guide.md'
  );
  assert.equal(
    await exists(join(webformsBundleDir, 'templates/aggregate-design.md')),
    false,
    'brownfield bundle should not contain greenfield-only aggregate-design.md'
  );
  assert.equal(
    await exists(join(webformsBundleDir, 'templates/events.md')),
    false,
    'brownfield bundle should not contain greenfield-only events.md'
  );

  // PROPOSAL-051: templates/CLAUDE.md retired — must NOT be projected into the brownfield bundle either.
  assert.equal(
    await exists(join(webformsBundleDir, 'templates/CLAUDE.md')),
    false,
    'PROPOSAL-051: retired templates/CLAUDE.md must not be projected into the brownfield workflow bundle'
  );

  // Brownfield bundle should include common flow files
  assert.equal(await exists(join(webformsBundleDir, 'references/new-feature-flow.md')), true, 'brownfield bundle should have new-feature-flow.md');
  assert.equal(await exists(join(webformsBundleDir, 'references/finish-feature-flow.md')), true, 'brownfield bundle should have finish-feature-flow.md');
  assert.equal(await exists(join(webformsBundleDir, 'templates/phase-spec.md')), true, 'brownfield bundle should have phase-spec.md template');

  // Bundle flow files carry the generated marker
  const brownfieldFlowContent = await readFile(join(webformsBundleDir, 'references/new-feature-flow.md'), 'utf8');
  assert.match(brownfieldFlowContent, /<!-- dflow-generated: workflow-bundle -->/, 'brownfield bundle flow file should carry the generated marker');

  // PROPOSAL-047 (review fixes) — brownfield parity with the greenfield textual / order guards.
  assert.ok(
    brownfieldFlowContent.includes('Branch gate (policy-aware)') &&
      brownfieldFlowContent.indexOf('Branch gate (policy-aware)') < brownfieldFlowContent.indexOf('milestone 1 of 3'),
    'PROPOSAL-047 (brownfield parity): spec-baseline commit checkpoint must come after the branch gate'
  );
  const brownfieldFinishFlow = await readFile(join(webformsBundleDir, 'references/finish-feature-flow.md'), 'utf8');
  assert.match(brownfieldFinishFlow, /only when the closeout is committed/, 'PROPOSAL-047 (brownfield parity): Local-closeout requires a committed (clean) tree');
  assert.doesNotMatch(brownfieldFinishFlow, /clean or intentionally staged/, 'PROPOSAL-047 (brownfield parity): Local-closeout must not accept merely-staged changes');
  const brownfieldNewPhase = await readFile(join(webformsBundleDir, 'references/new-phase-flow.md'), 'utf8');
  assert.match(brownfieldNewPhase, /Never create a new feature branch here/, 'PROPOSAL-047 (brownfield parity): new-phase must not recreate a feature branch');

  // Fence-integrity guard — exhaustive scan over all Git-principles source + mirror files
  // (catches any content glued to a closing fence, not just `}```; previous narrower guard
  // missed trunk integration-example fences in round-2). Pattern \S``` flags non-whitespace
  // immediately before three backticks at end of line.
  const gitPrinciplesScanList = [
    'sdd-ddd-greenfield-skill/scaffolding/Git-principles-trunk.md',
    'sdd-ddd-greenfield-skill/scaffolding/Git-principles-gitflow.md',
    'sdd-ddd-brownfield-skill/scaffolding/Git-principles-trunk.md',
    'sdd-ddd-brownfield-skill/scaffolding/Git-principles-gitflow.md',
    'templates/greenfield/scaffolding/Git-principles-trunk.md',
    'templates/greenfield/scaffolding/Git-principles-gitflow.md',
    'templates/brownfield/scaffolding/Git-principles-trunk.md',
    'templates/brownfield/scaffolding/Git-principles-gitflow.md',
  ];
  for (const rel of gitPrinciplesScanList) {
    const content = await readFile(join(repoRoot, rel), 'utf8');
    assert.doesNotMatch(
      content,
      /\S```/,
      `${rel}: closing code fence must be on its own line (no content glued to \`\`\`)`
    );
  }

  // Guide should reference workflow bundle (not source paths)
  const webformsGuide = await readFile(join(webformsRoot, 'dflow/specs/shared/AI-AGENT-GUIDE.md'), 'utf8');
  assert.match(webformsGuide, /dflow\/specs\/shared\/dflow-workflows\/references\/new-feature-flow\.md/, 'brownfield guide should reference project-local bundle path');
  assert.doesNotMatch(webformsGuide, /sdd-ddd-brownfield-skill|sdd-ddd-greenfield-skill/, 'brownfield guide should not contain source repo skill paths');

  const webformsConventions = await readFile(join(webformsRoot, 'dflow/specs/shared/_conventions.md'), 'utf8');
  assert.equal((webformsConventions.match(/^## Prose Language$/gm) || []).length, 1, 'Brownfield Prose Language section count');
  assert.match(webformsConventions, /Project prose language: `fr-CA`/);
  assert.match(webformsConventions, /^> Dflow Version: \d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/m, 'Brownfield Dflow Version field present');

  // PROPOSAL-047: gitflow policy projects the gitflow principles file (and not trunk).
  assert.match(webformsConventions, /Selected Git policy: `gitflow`/, 'brownfield Git policy recorded');
  assert.match(webformsConventions, /AI commit marker: `prefix`/, 'brownfield AI commit marker recorded (prefix mode)');
  assert.equal(await exists(join(webformsRoot, 'dflow/specs/shared/Git-principles-gitflow.md')), true, 'gitflow policy should project the gitflow principles file');
  assert.equal(await exists(join(webformsRoot, 'dflow/specs/shared/Git-principles-trunk.md')), false, 'gitflow policy should not project the trunk principles file');

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

  // PROPOSAL-046: Codex command-trigger injection into a Dflow-generated AGENTS.md.
  // Happy path — init selects Codex (AGENTS.md shim), then configure-agents
  // --command-adapters injects the trigger section directly (zero manual merge).
  const codexRoot = join(tempRoot, 'codex-inject');
  await mkdir(codexRoot, { recursive: true });
  const codexInitInput = [
    '1',                                          // greenfield
    'ASP.NET Core 9, EF Core 8, MediatR 12, xUnit',
    'none',
    '1',                                          // prose language
    '2',                                          // Git policy: trunk
    '1',                                          // AI commit marker: none
    '1',                                          // optional starter files: overview
    '1',                                          // AI agents: Codex (AGENTS.md) only
    'y'
  ].join('\n') + '\n';
  const codexInit = await runDflow(codexRoot, codexInitInput);
  assert.equal(codexInit.code, 0, `codex inject: init failed\nSTDOUT:\n${codexInit.stdout}\nSTDERR:\n${codexInit.stderr}`);

  const codexAgentsPath = join(codexRoot, 'AGENTS.md');
  const codexSnippetPath = join(codexRoot, 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md');
  assert.equal(await exists(codexAgentsPath), true, 'codex inject: init should create AGENTS.md shim');
  const codexAgentsAfterInit = await readFile(codexAgentsPath, 'utf8');
  assert.doesNotMatch(codexAgentsAfterInit, /## Dflow Text Triggers/, 'codex inject: init shim should not yet carry triggers');

  // configure-agents --command-adapters should inject into the pristine shim.
  const codexInject = await runDflow(codexRoot, '1\ny\n', ['configure-agents', '--command-adapters']);
  assert.equal(codexInject.code, 0, `codex inject: configure failed\nSTDOUT:\n${codexInject.stdout}\nSTDERR:\n${codexInject.stderr}`);
  assert.match(codexInject.stdout, /AGENTS\.md \| update \|/, 'codex inject: AGENTS.md should be updated in place, not parked as a snippet');
  const codexAgentsInjected = await readFile(codexAgentsPath, 'utf8');
  assert.match(codexAgentsInjected, /## Dflow Text Triggers/, 'codex inject: trigger section should be injected into AGENTS.md');
  assert.match(codexAgentsInjected, /dflow-generated: codex-command-triggers START/, 'codex inject: trigger block should be marker-wrapped');
  assert.equal(await exists(codexSnippetPath), false, 'codex inject: no command-adapters snippet should be written for a pristine shim');

  // Idempotent re-run: the trigger section is re-projected, not duplicated.
  const codexRerun = await runDflow(codexRoot, '1\ny\n', ['configure-agents', '--command-adapters']);
  assert.equal(codexRerun.code, 0, `codex inject: idempotent re-run failed\nSTDOUT:\n${codexRerun.stdout}\nSTDERR:\n${codexRerun.stderr}`);
  const codexAgentsRerun = await readFile(codexAgentsPath, 'utf8');
  assert.equal((codexAgentsRerun.match(/## Dflow Text Triggers/g) || []).length, 1, 'codex inject: re-run should keep exactly one trigger section');
  assert.equal((codexAgentsRerun.match(/codex-command-triggers START/g) || []).length, 1, 'codex inject: re-run should keep exactly one trigger block marker');

  // User-modified shim degrades safely to the side snippet + warning; AGENTS.md untouched.
  await writeFile(codexAgentsPath, `# My own notes\n\n${codexAgentsRerun}`);
  const codexDegrade = await runDflow(codexRoot, '1\ny\n', ['configure-agents', '--command-adapters']);
  assert.equal(codexDegrade.code, 0, `codex inject: degrade run failed\nSTDOUT:\n${codexDegrade.stdout}\nSTDERR:\n${codexDegrade.stderr}`);
  assert.match(codexDegrade.stdout, /modified after Dflow generated it/, 'codex inject: a modified shim should warn');
  assert.equal(await exists(codexSnippetPath), true, 'codex inject: user-modified AGENTS.md should degrade to a command-adapters snippet');
  const codexCommandAdaptersSnippet = await readFile(codexSnippetPath, 'utf8');
  assert.match(codexCommandAdaptersSnippet, /## Dflow Text Triggers/, 'codex inject: command-adapters snippet should contain the trigger section');
  assert.doesNotMatch(codexCommandAdaptersSnippet, /Dflow Project Instructions/, 'codex inject: command-adapters snippet should be trigger-only, not the full shim (the configured AGENTS.md already has the title + guide pointers)');
  const codexAgentsAfterDegrade = await readFile(codexAgentsPath, 'utf8');
  assert.match(codexAgentsAfterDegrade, /^# My own notes/, 'codex inject: user-modified AGENTS.md must be left untouched');

  // CRLF / trailing-whitespace reformat of a pristine shim still injects
  // (normalized template match, not a raw hash that an editor reformat would break).
  const codexReformatRoot = join(tempRoot, 'codex-reformat');
  await mkdir(codexReformatRoot, { recursive: true });
  const codexReformatInit = await runDflow(codexReformatRoot, codexInitInput);
  assert.equal(codexReformatInit.code, 0, `codex reformat: init failed\nSTDOUT:\n${codexReformatInit.stdout}\nSTDERR:\n${codexReformatInit.stderr}`);
  const codexReformatAgentsPath = join(codexReformatRoot, 'AGENTS.md');
  const pristineShim = await readFile(codexReformatAgentsPath, 'utf8');
  await writeFile(codexReformatAgentsPath, pristineShim.replace(/\n/g, '  \r\n')); // editor: CRLF + trailing spaces
  const codexReformatInject = await runDflow(codexReformatRoot, '1\ny\n', ['configure-agents', '--command-adapters']);
  assert.equal(codexReformatInject.code, 0, `codex reformat: configure failed\nSTDOUT:\n${codexReformatInject.stdout}\nSTDERR:\n${codexReformatInject.stderr}`);
  assert.match(await readFile(codexReformatAgentsPath, 'utf8'), /## Dflow Text Triggers/, 'codex reformat: a reformatted pristine shim should still be injected');
  assert.equal(await exists(join(codexReformatRoot, 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md')), false, 'codex reformat: reformatted pristine shim should not degrade to a snippet');

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
    '2',       // prose
    '2',       // Git policy: trunk
    '2',       // AI commit marker: co-authored-by (covers the trailer mode)
    '1',       // optional: overview
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
  assert.match(javaConventions, /AI commit marker: `co-authored-by`/, 'co-authored-by marker mode recorded in _conventions.md');

  // unresolvedInitPlaceholders warning should not fire for canonical placeholder fallbacks
  // (Codex review note: "unresolved fallback 要保留原 token，否則 warning 會誤導")
  assert.doesNotMatch(java.stdout, /Unresolved placeholders remain.*\{ASP\.NET Core version\}/);

  // PROPOSAL-052: generalized same-edition stale-removal (manifest-diff),
  // R3-03 corrupt-manifest degrade, and (c) doctor orphan scan. Verified for
  // BOTH editions (the 051 lesson: a GF-only guard missed BF).
  const BUNDLE_REL = 'dflow/specs/shared/dflow-workflows';
  const BUNDLE_MARKER = '<!-- dflow-generated: workflow-bundle -->';
  for (const [edition, editionChoice] of [['greenfield', '1'], ['brownfield', '2']]) {
    const sRoot = join(tempRoot, `shrink-${edition}`);
    await mkdir(sRoot, { recursive: true });
    const sInput = [editionChoice, 'Node 20, Express 4, Jest', 'none', '1', '2', '1', '1', 'none', 'y'].join('\n') + '\n';
    const sInit = await runDflow(sRoot, sInput);
    assert.equal(sInit.code, 0, `[${edition}] shrink init failed\nSTDOUT:\n${sInit.stdout}\nSTDERR:\n${sInit.stderr}`);

    // Guarantee configure-agents can infer the edition by structure (independent
    // of the manifest, which the corrupt-manifest case below destroys).
    const inferFile = edition === 'greenfield'
      ? join(sRoot, 'dflow/specs/architecture/tech-debt.md')
      : join(sRoot, 'dflow/specs/migration/tech-debt.md');
    await mkdir(dirname(inferFile), { recursive: true });
    if (!(await exists(inferFile))) await writeFile(inferFile, '# tech debt\n');

    const manifestPath = join(sRoot, BUNDLE_REL, '.dflow-bundle-manifest.json');
    const retiredRel = `${BUNDLE_REL}/references/retired-052.md`;
    const userRel = `${BUNDLE_REL}/references/retired-052-user.md`;
    await writeFile(join(sRoot, retiredRel), `${BUNDLE_MARKER}\n\n# Retired flow\n`);
    await writeFile(join(sRoot, userRel), '# Hand-edited retired flow, marker stripped\n');
    const m1 = JSON.parse(await readFile(manifestPath, 'utf8'));
    m1.files.push(retiredRel, userRel);
    await writeFile(manifestPath, `${JSON.stringify(m1, null, 2)}\n`);

    // Same-edition re-projection: manifest-diff removes the marker-carrying
    // retired file, preserves the marker-stripped (user-modified) one.
    const sReproject = await runDflow(sRoot, '1,2,3\ny\n', ['configure-agents']);
    assert.equal(sReproject.code, 0, `[${edition}] same-edition reprojection failed\nSTDOUT:\n${sReproject.stdout}\nSTDERR:\n${sReproject.stderr}`);
    assert.match(sReproject.stdout, /retired-052\.md \| remove \|/, `[${edition}] retired marker-carrying bundle file should be listed for removal`);
    assert.equal(await exists(join(sRoot, retiredRel)), false, `[${edition}] retired marker-carrying file should be removed on same-edition re-projection`);
    assert.equal(await exists(join(sRoot, userRel)), true, `[${edition}] marker-stripped (user-modified) retired file should be preserved`);
    assert.match(sReproject.stdout, /user-modified; left unchanged: [^\n]*retired-052-user\.md/, `[${edition}] user-modified retired file should warn`);
    const m2 = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(m2.files.includes(retiredRel), false, `[${edition}] rebuilt manifest should not list the removed retired file`);

    // A non-normalized manifest entry must NOT be acted on — it must not schedule
    // removal of the current bundle file it resolves to (canonical-path guard;
    // regression test for the round-1 implementation-review finding).
    const currentBundleFile = m2.files.find((f) => f.includes(`${BUNDLE_REL}/references/`));
    assert.ok(currentBundleFile, `[${edition}] expected a current references bundle file in the manifest`);
    const traversalEntry = currentBundleFile.replace(`${BUNDLE_REL}/references/`, `${BUNDLE_REL}/references/../references/`);
    const m3 = JSON.parse(await readFile(manifestPath, 'utf8'));
    m3.files.push(traversalEntry);
    await writeFile(manifestPath, `${JSON.stringify(m3, null, 2)}\n`);
    const sTraversal = await runDflow(sRoot, '1,2,3\ny\n', ['configure-agents']);
    assert.equal(sTraversal.code, 0, `[${edition}] non-canonical-entry run failed\nSTDOUT:\n${sTraversal.stdout}\nSTDERR:\n${sTraversal.stderr}`);
    assert.match(`${sTraversal.stdout}${sTraversal.stderr}`, /non-canonical workflow bundle manifest path/i, `[${edition}] non-canonical manifest entry should warn`);
    assert.equal(await exists(join(sRoot, currentBundleFile)), true, `[${edition}] a current bundle file must NOT be removed via a non-normalized manifest entry`);

    // A canonical-but-directory manifest entry must degrade gracefully (warn +
    // skip), not crash on readFile/EISDIR (round-2 implementation-review finding).
    const m4 = JSON.parse(await readFile(manifestPath, 'utf8'));
    m4.files.push(`${BUNDLE_REL}/references`);
    await writeFile(manifestPath, `${JSON.stringify(m4, null, 2)}\n`);
    const sDirEntry = await runDflow(sRoot, '1,2,3\ny\n', ['configure-agents']);
    assert.equal(sDirEntry.code, 0, `[${edition}] directory-entry run failed\nSTDOUT:\n${sDirEntry.stdout}\nSTDERR:\n${sDirEntry.stderr}`);
    assert.match(`${sDirEntry.stdout}${sDirEntry.stderr}`, /non-file workflow bundle manifest entry/i, `[${edition}] directory manifest entry should warn (non-file) and not crash`);
    assert.equal(await exists(join(sRoot, BUNDLE_REL, 'references')), true, `[${edition}] references/ directory must survive a directory manifest entry`);

    // R3-03: a corrupt manifest degrades — warn, skip cleanup, do NOT overwrite
    // the manifest, still project. An orphan the manifest does not list (true
    // Case B) is left in place.
    const orphanRel = `${BUNDLE_REL}/references/orphan-052.md`;
    await writeFile(join(sRoot, orphanRel), `${BUNDLE_MARKER}\n\n# Orphan flow\n`);
    const corruptText = '{ not valid json';
    await writeFile(manifestPath, corruptText);
    const sDegrade = await runDflow(sRoot, '1,2,3\ny\n', ['configure-agents']);
    assert.equal(sDegrade.code, 0, `[${edition}] degrade run failed\nSTDOUT:\n${sDegrade.stdout}\nSTDERR:\n${sDegrade.stderr}`);
    assert.match(`${sDegrade.stdout}${sDegrade.stderr}`, /manifest is unreadable/i, `[${edition}] corrupt manifest should warn`);
    assert.equal(await exists(join(sRoot, orphanRel)), true, `[${edition}] corrupt manifest should skip cleanup (orphan preserved)`);
    assert.equal(await readFile(manifestPath, 'utf8'), corruptText, `[${edition}] corrupt manifest should be left untouched (not overwritten)`);
    assert.equal(await exists(join(sRoot, BUNDLE_REL, 'references')), true, `[${edition}] bundle should still be projected during degrade`);

    // R3-03 schema variant: a parseable-but-invalid manifest (files not an array)
    // also degrades — warn, skip cleanup, do NOT overwrite, still project.
    const invalidSchema = `${JSON.stringify({ edition, version: '0.0.0-test', generatedBy: 'dflow-sdd-ddd', files: 'not-an-array' })}\n`;
    await writeFile(manifestPath, invalidSchema);
    const sInvalid = await runDflow(sRoot, '1,2,3\ny\n', ['configure-agents']);
    assert.equal(sInvalid.code, 0, `[${edition}] invalid-schema run failed\nSTDOUT:\n${sInvalid.stdout}\nSTDERR:\n${sInvalid.stderr}`);
    assert.match(`${sInvalid.stdout}${sInvalid.stderr}`, /manifest is unreadable/i, `[${edition}] invalid-schema manifest should warn (degrade)`);
    assert.equal(await readFile(manifestPath, 'utf8'), invalidSchema, `[${edition}] invalid-schema manifest should be left untouched`);
    assert.equal(await exists(join(sRoot, orphanRel)), true, `[${edition}] invalid-schema degrade should skip cleanup (orphan preserved)`);

    // (c) doctor: read-only scan reports the manifest-orphan file. Restore a
    // valid manifest (files:[] — does not list the orphan) so edition inference
    // is clean; doctor must still detect the orphan by scanning.
    await writeFile(manifestPath, `${JSON.stringify({ edition, version: '0.0.0-test', generatedBy: 'dflow-sdd-ddd', files: [] }, null, 2)}\n`);
    const sDoctor = await runDflow(sRoot, '', ['doctor']);
    assert.equal(sDoctor.code, 0, `[${edition}] doctor failed\nSTDOUT:\n${sDoctor.stdout}\nSTDERR:\n${sDoctor.stderr}`);
    assert.match(sDoctor.stdout, /Retired workflow bundle file: [^\n]*orphan-052\.md/, `[${edition}] doctor should report the manifest-orphan retired file`);
    assert.doesNotMatch(sDoctor.stdout, /Retired workflow bundle file: [^\n]*retired-052-user\.md/, `[${edition}] doctor must NOT report a marker-stripped (user) file`);
    assert.doesNotMatch(sDoctor.stdout, new RegExp(`Retired workflow bundle file: [^\\n]*${currentBundleFile.split('/').pop().replace(/\./g, '\\.')}`), `[${edition}] doctor must NOT report a current bundle file`);
    assert.equal(await exists(join(sRoot, orphanRel)), true, `[${edition}] doctor is read-only — orphan must not be deleted`);
  }

  console.log(`Smoke test passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
