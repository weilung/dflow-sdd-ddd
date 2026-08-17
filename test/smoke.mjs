import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import init from '../lib/init.js';

const { REQUIRED_COMMON_BUNDLE_FILES } = init;

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
  // PROPOSAL-074 non-TTY sequence invariance: this pre-074 answer sequence (ending
  // with the final confirmation `y`) must keep running UNCHANGED — non-TTY init has
  // no stdin slot for the skill question. What changes is only the output set: the
  // project-level skill now installs by default for the selected agents.
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
    '.github/copilot-instructions.md',
    // PROPOSAL-074: init now installs the project-level skill by default (non-TTY
    // run, all three agents selected -> all three skill paths).
    '.claude/skills/dflow/SKILL.md',
    '.agents/skills/dflow/SKILL.md',
    '.github/skills/dflow/SKILL.md'
  ];

  for (const relativePath of mandatoryPaths) {
    assert.equal(
      await exists(join(tempRoot, relativePath)),
      true,
      `${relativePath} should exist\nSTDOUT:\n${first.stdout}\nSTDERR:\n${first.stderr}`
    );
  }

  // PROPOSAL-074: the default-installed skill is the same marker-stamped thin skill
  // that --skills projects.
  const initSkill = await readFile(join(tempRoot, '.claude/skills/dflow/SKILL.md'), 'utf8');
  assert.match(initSkill, /<!-- dflow-generated: skill-adapter -->/, 'init-installed skill should carry the generated skill marker');
  assert.match(initSkill, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'init-installed skill should point to the canonical guide');
  assert.match(first.stdout, /Dflow-managed derivatives/, 'init next steps should include the skill version-control hint');

  const conventions = await readFile(join(tempRoot, 'dflow/specs/shared/_conventions.md'), 'utf8');
  assert.equal((conventions.match(/^## Prose Language$/gm) || []).length, 1, 'Prose Language section count');
  assert.match(conventions, /Project prose language: `zh-TW`/);
  assert.match(conventions, /\[Glossary\]\(\.\.\/domain\/glossary\.md\)/);
  assert.match(conventions, /^> Dflow Version: \d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/m, 'Greenfield Dflow Version field present');

  // P083: assert the PROJECTION, not the template — the template carried these
  // two sections correctly the whole time and still never delivered them.
  // `ensureProseLanguageSection` strips from `## Prose Language` to the next
  // `## ` heading, and a `### ` subsection sitting after it is swallowed with
  // the prose. Both sections were re-parented under `## Prose Language` by
  // 59e0eb2 (2026-05-01) and were lost from v0.1.0 onward; they now sit under
  // `## Where Specs Live`, ahead of it, which is why they arrive. That ordering
  // is load-bearing — move them back below `## Prose Language` and this fails.
  assert.match(conventions, /^### SPEC-ID Format$/m, 'SPEC-ID Format must survive the Prose Language strip');
  assert.match(conventions, /^### Slug Conventions \(Project-Specific Fill-In\)$/m, 'Slug Conventions must survive the Prose Language strip');
  assert.match(conventions, /Project-specific term list/, 'the slug term-list fill-in must reach the project — it is the blank the developer is asked to complete');

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
  assert.match(claudeGuide, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
  assert.doesNotMatch(claudeGuide, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
  assert.match(copilotGuide, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);

  const second = await runDflow(tempRoot);
  assert.notEqual(second.code, 0, 'second init should abort');
  assert.match(second.stderr, /Dflow already initialized at dflow\/specs\/\./);

  const cleanDoctor = await runDflow(tempRoot, '', ['doctor']);
  assert.equal(cleanDoctor.code, 0, `doctor on clean V1 init failed\nSTDOUT:\n${cleanDoctor.stdout}\nSTDERR:\n${cleanDoctor.stderr}`);
  assert.match(cleanDoctor.stdout, /^Dflow Doctor /m, 'doctor should print header');
  assert.match(cleanDoctor.stdout, /All checks passed\. No Dflow health findings detected\./);

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
  assert.equal(await exists(join(legacyRoot, 'specs', 'legacy.md')), true, 'pre-existing root specs/ file should remain untouched');
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/_conventions.md')), true, 'legacy run should write dflow/specs/');
  // PROPOSAL-074: the skill install is agent-gated — with no agents selected there
  // is no projection target, so no skill path may appear (and no question is asked).
  assert.equal(await exists(join(legacyRoot, '.claude/skills/dflow/SKILL.md')), false, 'no-agent init should not install a Claude skill');
  assert.equal(await exists(join(legacyRoot, '.agents/skills/dflow/SKILL.md')), false, 'no-agent init should not install a Codex skill');
  assert.equal(await exists(join(legacyRoot, '.github/skills/dflow/SKILL.md')), false, 'no-agent init should not install a Copilot skill');

  await writeFile(join(legacyRoot, 'AGENTS.md'), '# Existing agent rules\n');
  const configureInput = [
    '1,2,3',
    'y'
  ].join('\n') + '\n';
  const configured = await runDflow(legacyRoot, configureInput, ['configure-agents']);
  assert.equal(configured.code, 0, `configure-agents failed\nSTDOUT:\n${configured.stdout}\nSTDERR:\n${configured.stderr}`);
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/AI-AGENT-GUIDE.md')), true, 'configure should create canonical AI guide');
  // PROPOSAL-074 (OQ2 branch b): a no-flag non-TTY configure-agents selecting agents
  // that have no project-level skill yet installs it by default — same contract as
  // init, no extra stdin slot consumed (this input still ends with the single `y`).
  assert.equal(await exists(join(legacyRoot, '.claude/skills/dflow/SKILL.md')), true, 'configure-agents should default-install the missing Claude skill');
  assert.equal(await exists(join(legacyRoot, '.agents/skills/dflow/SKILL.md')), true, 'configure-agents should default-install the missing Codex skill');
  assert.equal(await exists(join(legacyRoot, '.github/skills/dflow/SKILL.md')), true, 'configure-agents should default-install the missing Copilot skill');
  assert.match(configured.stdout, /Dflow-managed derivatives/, 'configure-agents next steps should include the skill version-control hint after a default install');
  // PROPOSAL-054: an existing non-guide AGENTS.md is appended in place with a
  // marker-delimited Dflow block, not parked as a side merge snippet.
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/AGENTS-md-snippet.md')), false, 'existing non-guide AGENTS.md should be appended in place, not parked as a snippet');
  assert.equal(await exists(join(legacyRoot, 'CLAUDE.md')), true, 'configure should create selected CLAUDE.md shim');
  assert.equal(await exists(join(legacyRoot, '.github/copilot-instructions.md')), true, 'configure should create selected Copilot shim');
  const existingAgents = await readFile(join(legacyRoot, 'AGENTS.md'), 'utf8');
  assert.match(existingAgents, /^# Existing agent rules/, 'user content stays at the top of AGENTS.md');
  assert.match(existingAgents, /<!-- dflow-generated: agent-shim START -->/, 'PROPOSAL-054: Dflow block appended with the agent-shim marker');
  assert.match(existingAgents, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'appended Dflow block points to the canonical guide');

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

  // PROPOSAL-074 retired the old "only --skills projects a skill" contract: the
  // earlier no-flag configure run above already default-installed the three skills,
  // so this --command-adapters run found nothing missing and changed nothing. The
  // Codex COMMAND adapter must still never exist (unchanged by 074).
  assert.equal(await exists(join(legacyRoot, '.agents/skills/dflow/SKILL.md')), true, 'Codex skill from the earlier default install should survive --command-adapters');
  assert.equal(await exists(join(legacyRoot, '.codex/commands/dflow-new-feature.md')), false, 'Codex command adapter should not be created');
  // PROPOSAL-054: after --command-adapters the Codex triggers live in AGENTS.md as an
  // adjacent marked block (the file already carried the agent-shim block from the prior
  // configure run), not in a side snippet.
  const legacyAgentsWithTriggers = await readFile(join(legacyRoot, 'AGENTS.md'), 'utf8');
  assert.match(legacyAgentsWithTriggers, /## Dflow Text Triggers/, 'Codex triggers should be injected into AGENTS.md');
  assert.match(legacyAgentsWithTriggers, /resend it without the slash, for example\s+`dflow:status`/, 'AGENTS.md trigger block should explain no-slash text fallback');
  assert.match(legacyAgentsWithTriggers, /^# Existing agent rules/, 'user content preserved through --command-adapters');
  assert.equal((legacyAgentsWithTriggers.match(/<!-- dflow-generated: agent-shim START -->/g) || []).length, 1, 'exactly one agent-shim block in AGENTS.md');
  assert.equal((legacyAgentsWithTriggers.match(/codex-command-triggers START/g) || []).length, 1, 'exactly one trigger block in AGENTS.md');
  assert.equal(await exists(join(legacyRoot, 'dflow/specs/shared/AGENTS-md-snippet.md')), false, 'no snippet when AGENTS.md is managed in place');

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

  // PROPOSAL-074 boundary: a flagless run installs ONLY the missing skills — an
  // existing Dflow-generated skill (marker-stamped sentinel below) must NOT be
  // regenerated without --skills, even in the same run that backfills another
  // agent's missing skill.
  const sentinelSkill = '<!-- dflow-generated: skill-adapter -->\n\n# sentinel: locally aged skill\n';
  await writeFile(join(legacyRoot, '.claude/skills/dflow/SKILL.md'), sentinelSkill);
  await rm(join(legacyRoot, '.agents/skills/dflow/SKILL.md'), { force: true });
  const mixedDefault = await runDflow(legacyRoot, '1,2\ny\n', ['configure-agents']);
  assert.equal(mixedDefault.code, 0, `mixed-state flagless configure-agents failed\nSTDOUT:\n${mixedDefault.stdout}\nSTDERR:\n${mixedDefault.stderr}`);
  assert.equal(await exists(join(legacyRoot, '.agents/skills/dflow/SKILL.md')), true, 'flagless run should install the missing Codex skill');
  assert.equal(
    await readFile(join(legacyRoot, '.claude/skills/dflow/SKILL.md'), 'utf8'),
    sentinelSkill,
    'flagless run must NOT regenerate an existing generated skill (only --skills does)'
  );

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
  assert.doesNotMatch(skillContent, /sentinel/, '--skills must regenerate an existing generated skill (regenerate-all semantics)');
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

  // PROPOSAL-056 Phase 1: --skills now ALSO projects a project-level Codex skill
  // to .agents/skills/dflow/SKILL.md (same source, parity with Claude). Use a
  // fresh project that selects only the AGENTS.md (Codex) target.
  const codexSkillRoot = join(tempRoot, 'skills-codex');
  await mkdir(codexSkillRoot, { recursive: true });
  const codexSkillInit = [
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
  const codexSkillInitRun = await runDflow(codexSkillRoot, codexSkillInit, ['init']);
  assert.equal(codexSkillInitRun.code, 0, `codex-skill init failed\nSTDOUT:\n${codexSkillInitRun.stdout}\nSTDERR:\n${codexSkillInitRun.stderr}`);

  const codexSkillPath = join(codexSkillRoot, '.agents/skills/dflow/SKILL.md');
  // Select option 1 (AGENTS.md - Codex / Copilot coding agent) only.
  const codexSkills = await runDflow(codexSkillRoot, '1\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    codexSkills.code,
    0,
    `configure-agents --skills (codex) failed\nSTDOUT:\n${codexSkills.stdout}\nSTDERR:\n${codexSkills.stderr}`
  );
  assert.equal(await exists(codexSkillPath), true, '--skills with Codex (agents) should create the .agents skill adapter');
  const codexSkillContent = await readFile(codexSkillPath, 'utf8');
  assert.match(codexSkillContent, /<!-- dflow-generated: skill-adapter -->/, 'Codex skill adapter should include the generated skill marker');
  assert.match(codexSkillContent, /^name: dflow$/m, 'Codex skill adapter frontmatter should name the skill dflow');
  assert.match(codexSkillContent, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/, 'Codex skill adapter should point to the canonical guide');
  // Same single source as the Claude skill — no content fork.
  assert.equal(codexSkillContent, skillContent, 'Codex skill should be byte-identical to the Claude skill (single source)');
  // Claude was not selected, so no Claude skill should appear in this project.
  assert.equal(await exists(join(codexSkillRoot, '.claude/skills/dflow/SKILL.md')), false, 'Codex-only --skills should not create a Claude skill');

  // Idempotent re-run for the Codex skill.
  const codexSkillsRerun = await runDflow(codexSkillRoot, '1\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    codexSkillsRerun.code,
    0,
    `configure-agents --skills (codex re-run) failed\nSTDOUT:\n${codexSkillsRerun.stdout}\nSTDERR:\n${codexSkillsRerun.stderr}`
  );
  assert.equal(await readFile(codexSkillPath, 'utf8'), codexSkillContent, 're-running --skills should rewrite the same marker-stamped Codex skill');

  // User-modified-file protection for the Codex skill path.
  const userCodexSkill = '# My own dflow skill\n\nHand-written Codex skill, not generated.\n';
  await writeFile(codexSkillPath, userCodexSkill);
  const codexSkillsProtected = await runDflow(codexSkillRoot, '1\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    codexSkillsProtected.code,
    0,
    `configure-agents --skills (codex overwrite protection) failed\nSTDOUT:\n${codexSkillsProtected.stdout}\nSTDERR:\n${codexSkillsProtected.stderr}`
  );
  assert.equal(await readFile(codexSkillPath, 'utf8'), userCodexSkill, 'non-generated Codex skill should be left unchanged');
  assert.match(
    codexSkillsProtected.stdout,
    /Existing \.agents\/skills\/dflow\/SKILL\.md is not a Dflow-generated skill; left unchanged/,
    'overwrite protection should warn about the non-generated Codex skill'
  );

  // #4 (PROPOSAL-056 un-defer): GitHub Copilot skill projection is now NATIVE.
  // Selecting Copilot with --skills creates .github/skills/dflow/SKILL.md (a spike
  // confirmed Copilot discovers + auto-triggers a skill from its own path with the
  // cross-read .claude/.agents paths removed) and must NOT print a deferral note.
  const copilotSkillRoot = join(tempRoot, 'skills-copilot-native');
  await mkdir(copilotSkillRoot, { recursive: true });
  const copilotSkillInitRun = await runDflow(copilotSkillRoot, codexSkillInit, ['init']);
  assert.equal(copilotSkillInitRun.code, 0, `copilot-native init failed\nSTDOUT:\n${copilotSkillInitRun.stdout}\nSTDERR:\n${copilotSkillInitRun.stderr}`);
  // Select option 3 (.github/copilot-instructions.md - GitHub Copilot) only.
  const copilotSkills = await runDflow(copilotSkillRoot, '3\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    copilotSkills.code,
    0,
    `configure-agents --skills (copilot) failed\nSTDOUT:\n${copilotSkills.stdout}\nSTDERR:\n${copilotSkills.stderr}`
  );
  const copilotSkillPath = join(copilotSkillRoot, '.github/skills/dflow/SKILL.md');
  assert.equal(await exists(copilotSkillPath), true, '--skills with Copilot should create the .github skill adapter');
  assert.equal(
    await readFile(copilotSkillPath, 'utf8'),
    skillContent,
    'Copilot skill content should match the shared generated thin skill'
  );
  assert.doesNotMatch(
    copilotSkills.stdout,
    /deferred/,
    '--skills with Copilot should no longer print a deferral note'
  );
  assert.doesNotMatch(
    copilotSkills.stdout,
    /currently supports Claude Code only/,
    'the old Claude-only warning should no longer appear'
  );

  // #4 (PROPOSAL-056 un-defer): co-selecting Copilot WITH Codex now projects BOTH
  // the Codex skill (.agents/skills) AND the Copilot skill (.github/skills); no
  // deferral note. (Copilot also cross-reads .agents/skills, so the same dflow
  // skill may surface from more than one path; here both copies are Dflow-
  // generated and identical — see SKILL_ADAPTER_TARGETS in lib/init.js for the
  // unspiked duplicate-discovery / non-Dflow-skill caveat.)
  const coSelRoot = join(tempRoot, 'skills-codex-plus-copilot');
  await mkdir(coSelRoot, { recursive: true });
  const coSelInitRun = await runDflow(coSelRoot, codexSkillInit, ['init']);
  assert.equal(coSelInitRun.code, 0, `co-select init failed\nSTDOUT:\n${coSelInitRun.stdout}\nSTDERR:\n${coSelInitRun.stderr}`);
  // Select options 1 (AGENTS.md - Codex) AND 3 (GitHub Copilot) together.
  const coSelSkills = await runDflow(coSelRoot, '1,3\ny\n', ['configure-agents', '--skills']);
  assert.equal(
    coSelSkills.code,
    0,
    `configure-agents --skills (codex+copilot) failed\nSTDOUT:\n${coSelSkills.stdout}\nSTDERR:\n${coSelSkills.stderr}`
  );
  assert.equal(await exists(join(coSelRoot, '.agents/skills/dflow/SKILL.md')), true, 'co-selected Codex skill should be projected');
  assert.equal(await exists(join(coSelRoot, '.github/skills/dflow/SKILL.md')), true, 'co-selected Copilot skill should now be projected (native)');
  assert.doesNotMatch(
    coSelSkills.stdout,
    /deferred/,
    'co-selected Copilot should no longer print a deferral note'
  );

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
    'references/modify-existing-follow-up.md',
    'references/modify-existing-post-hoc-hotfix.md',
    'references/finish-feature-flow.md',
    'references/finish-feature-follow-up.md',
    'references/finish-feature-post-hoc-hotfix.md',
    'references/finish-feature-minimal-host.md',
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
    'references/ddd-modeling-guide.md', // PROPOSAL-064: common, projected to both editions
    'references/flow-rationale-registry.md', // PROPOSAL-085: common, projected to both editions
  ];
  for (const bundleFile of expectedBundleFiles) {
    assert.equal(
      await exists(join(bundleDir, bundleFile)),
      true,
      `bundle file should exist: dflow-workflows/${bundleFile}`
    );
  }

  // PROPOSAL-064: greenfield reads the guide from templates/common/ too (same
  // merged scan) — assert the projected content is the common source, so a
  // regression of the read-path (reading templates/{edition}/ instead of the
  // descriptor's root) is caught in BOTH editions.
  const greenfieldGuide = await readFile(join(bundleDir, 'references/ddd-modeling-guide.md'), 'utf8');
  assert.ok(
    greenfieldGuide.includes('Edition note'),
    'PROPOSAL-064: greenfield-projected modeling guide must be the common source (Edition note present)'
  );

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

  // PROPOSAL-064: ddd-modeling-guide.md is now an edition-neutral COMMON bundle
  // reference, projected into BOTH editions (it was greenfield-only before).
  assert.equal(
    await exists(join(webformsBundleDir, 'references/ddd-modeling-guide.md')),
    true,
    'PROPOSAL-064: brownfield bundle should now contain the common ddd-modeling-guide.md'
  );
  // ...and the projected content must be the COMMON source (proves the projector
  // reads from templates/common/, not templates/{edition}/): only the common
  // guide carries the edition-neutral "Edition note".
  const brownfieldGuide = await readFile(join(webformsBundleDir, 'references/ddd-modeling-guide.md'), 'utf8');
  assert.ok(
    brownfieldGuide.includes('Edition note'),
    'PROPOSAL-064: brownfield-projected modeling guide must be the common source (Edition note present)'
  );
  // The manifest must list the common-sourced guide (keyed by sourceRel, so the
  // dest path is edition-neutral).
  assert.ok(
    webformsBundleManifest.files.includes('dflow/specs/shared/dflow-workflows/references/ddd-modeling-guide.md'),
    'PROPOSAL-064: brownfield bundle manifest should list the common ddd-modeling-guide.md'
  );
  // dflow-feedback-flow.md is likewise an edition-neutral COMMON bundle
  // reference (2026-08-10); it was a per-track pair whose copies differed by one
  // example sentence. Same three assertions as the guide above, for the same
  // reason: existence, content proving the COMMON source was read, manifest
  // membership.
  assert.equal(
    await exists(join(webformsBundleDir, 'references/dflow-feedback-flow.md')),
    true,
    'brownfield bundle should contain the common dflow-feedback-flow.md'
  );
  // Assert the source→destination RELATION, not a magic string: compare the
  // projected body against the actual common source. An earlier version pinned
  // the prose example "new internal service", which meant an ordinary copy edit
  // to that sentence failed smoke while source and projection were both correct
  // — a build guard coupled to editable copy.
  const brownfieldFeedback = await readFile(join(webformsBundleDir, 'references/dflow-feedback-flow.md'), 'utf8');
  const commonFeedbackSource = await readFile(
    join(repoRoot, 'templates/common/references/dflow-feedback-flow.md'),
    'utf8'
  );
  // Non-vacuity only: two empty strings compare equal and would prove nothing.
  // Deliberately NOT a size threshold — an earlier `> 1000` imposed an
  // undocumented content-size policy and would have rejected a legitimate short
  // flow whose projection was exactly correct. readFile throws rather than
  // returning a truncated string, so length proves nothing beyond non-emptiness.
  assert.ok(
    commonFeedbackSource.length > 0,
    'common feedback-flow source must be non-empty or the equality below is vacuous'
  );
  // Assert the EXACT transformation instead of deleting evidence before
  // comparing. injectBundleMarker() prepends the marker plus a blank line and
  // changes nothing else, so the projected file is predictable to the byte —
  // including the trailing newline, which a .trim() comparison cannot see.
  //
  // An earlier version filtered out every line containing "dflow-generated:"
  // and compared the remainder. That both HID a projector emitting an extra
  // marker line (stripped, so it passed) and would FALSELY FAIL if the source
  // ever documented the marker itself (stripped from the projection only).
  // Removing evidence before a comparison is not a safe operation — this repo
  // has already paid for that lesson once, in the doctor reader (p084-sol1).
  assert.equal(
    brownfieldFeedback,
    `<!-- dflow-generated: workflow-bundle -->\n\n${commonFeedbackSource}`,
    'brownfield-projected feedback flow must be exactly the common source with the bundle marker prepended'
  );
  assert.ok(
    webformsBundleManifest.files.includes('dflow/specs/shared/dflow-workflows/references/dflow-feedback-flow.md'),
    'brownfield bundle manifest should list the common dflow-feedback-flow.md'
  );

  // aggregate-design.md / events.md TEMPLATES stay greenfield-only (not promoted).
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

  // Fence-integrity guard — exhaustive scan over all Git-principles template source files
  // (catches any content glued to a closing fence, not just `}```; previous narrower guard
  // missed trunk integration-example fences in round-2). Pattern \S``` flags non-whitespace
  // immediately before three backticks at end of line.
  const gitPrinciplesScanList = [
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

  // Same projection assertion as greenfield — see the comment there for why the
  // section order in the template is load-bearing.
  assert.match(webformsConventions, /^### SPEC-ID Format$/m, 'brownfield SPEC-ID Format must survive the Prose Language strip');
  assert.match(webformsConventions, /^### Slug Conventions \(Project-Specific Fill-In\)$/m, 'brownfield Slug Conventions must survive the Prose Language strip');
  assert.match(webformsConventions, /Project-specific term list/, 'brownfield slug term-list fill-in must reach the project');

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
  assert.match(rootClaude, /dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);
  assert.doesNotMatch(rootClaude, /@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md/);

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
  // PROPOSAL-074 (OQ2 branch b): this is the "add another AI tool later" path — the
  // webforms project had only the Claude skill (from its init), so selecting Codex
  // here default-installs the missing .agents skill in the same non-TTY run.
  assert.equal(await exists(join(webformsRoot, '.agents/skills/dflow/SKILL.md')), true, 'adding Codex later should default-install its missing skill');
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

  // PROPOSAL-054 (supersedes PROPOSAL-046's degrade-to-snippet): a guide-configured
  // file the user modified, whose trigger markers are still well-formed, has its
  // self-delimited trigger block refreshed in place (OQ#6c) — no snippet, no "modified"
  // warning, and the base shim is left alone (the file already points to the guide).
  const userEditedTrigger = `# My own notes\n\n${codexAgentsRerun}`.replace('## Dflow Text Triggers', '## Stale Dflow Triggers (edited)');
  await writeFile(codexAgentsPath, userEditedTrigger);
  const codexConfiguredUpdate = await runDflow(codexRoot, '1\ny\n', ['configure-agents', '--command-adapters']);
  assert.equal(codexConfiguredUpdate.code, 0, `codex inject: configured-update run failed\nSTDOUT:\n${codexConfiguredUpdate.stdout}\nSTDERR:\n${codexConfiguredUpdate.stderr}`);
  assert.match(codexConfiguredUpdate.stdout, /AGENTS\.md \| update \|/, 'codex inject: a stale trigger block in a configured file should be refreshed in place');
  assert.doesNotMatch(codexConfiguredUpdate.stdout, /modified after Dflow generated it/, 'codex inject: a configured file with valid trigger markers should not warn about modification');
  assert.equal(await exists(codexSnippetPath), false, 'codex inject: valid trigger markers refresh in place, not parked as a snippet');
  const codexAgentsAfterUpdate = await readFile(codexAgentsPath, 'utf8');
  assert.match(codexAgentsAfterUpdate, /^# My own notes/, 'codex inject: user content must be preserved');
  assert.equal((codexAgentsAfterUpdate.match(/## Dflow Text Triggers/g) || []).length, 1, 'codex inject: trigger block refreshed to canonical heading');
  assert.doesNotMatch(codexAgentsAfterUpdate, /## Stale Dflow Triggers/, 'codex inject: stale trigger body replaced in place');
  assert.doesNotMatch(codexAgentsAfterUpdate, /<!-- dflow-generated: agent-shim START -->/, 'codex inject: base shim is not re-injected into a guide-configured file');

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

  // PROPOSAL-064 fresh-gate regression: a greenfield -> brownfield edition switch
  // must REMOVE the greenfield-only bundle templates (aggregate-design.md,
  // events.md) while PRESERVING the common ddd-modeling-guide.md (it belongs to
  // both editions). This locks the exact silent-deletion class the fresh cold-eye
  // gate caught (a common-sourced file being mis-classified as "retired").
  {
    const swRoot = join(tempRoot, 'edition-switch');
    await mkdir(swRoot, { recursive: true });
    const swInit = await runDflow(swRoot, ['1', 'Node 20, Express 4, Jest', 'none', '1', '2', '1', '1', 'none', 'y'].join('\n') + '\n');
    assert.equal(swInit.code, 0, `edition-switch greenfield init failed\nSTDOUT:\n${swInit.stdout}\nSTDERR:\n${swInit.stderr}`);
    const swBundle = join(swRoot, BUNDLE_REL);
    assert.equal(await exists(join(swBundle, 'templates/aggregate-design.md')), true, 'edition-switch precond: greenfield init has aggregate-design.md');
    assert.equal(await exists(join(swBundle, 'references/ddd-modeling-guide.md')), true, 'edition-switch precond: greenfield init has the common guide');

    // Switch the project to brownfield. configure-agents infers the edition by
    // STRUCTURE (inferExistingEdition): drop the greenfield signals
    // (architecture/, domain/context-map.md) and add the brownfield one
    // (migration/tech-debt.md); keep the manifest edition consistent too.
    await rm(join(swRoot, 'dflow/specs/architecture'), { recursive: true, force: true });
    await rm(join(swRoot, 'dflow/specs/domain/context-map.md'), { force: true });
    await mkdir(join(swRoot, 'dflow/specs/migration'), { recursive: true });
    await writeFile(join(swRoot, 'dflow/specs/migration/tech-debt.md'), '# migration tech debt\n');
    const swManifestPath = join(swBundle, '.dflow-bundle-manifest.json');
    const swM1 = JSON.parse(await readFile(swManifestPath, 'utf8'));
    swM1.edition = 'brownfield';
    await writeFile(swManifestPath, `${JSON.stringify(swM1, null, 2)}\n`);

    const swReproject = await runDflow(swRoot, '1,2,3\ny\n', ['configure-agents']);
    assert.equal(swReproject.code, 0, `edition-switch reprojection failed\nSTDOUT:\n${swReproject.stdout}\nSTDERR:\n${swReproject.stderr}`);
    assert.equal(await exists(join(swBundle, 'references/ddd-modeling-guide.md')), true, 'edition-switch: common ddd-modeling-guide.md must SURVIVE the switch');
    assert.equal(await exists(join(swBundle, 'templates/aggregate-design.md')), false, 'edition-switch: greenfield-only aggregate-design.md must be removed');
    assert.equal(await exists(join(swBundle, 'templates/events.md')), false, 'edition-switch: greenfield-only events.md must be removed');
    const swM2 = JSON.parse(await readFile(swManifestPath, 'utf8'));
    assert.equal(swM2.files.includes(`${BUNDLE_REL}/references/ddd-modeling-guide.md`), true, 'edition-switch: rebuilt manifest still lists the common guide');
    assert.equal(swM2.files.includes(`${BUNDLE_REL}/templates/aggregate-design.md`), false, 'edition-switch: rebuilt manifest drops greenfield-only aggregate-design.md');
  }

  // --- doctor must not print a clean bill of health on a BROKEN INSTALL ---
  //
  // `feedbackcommon-xv6` reproduced this end-to-end: with one required file removed
  // from templates/common/, `doctor` printed `All checks passed` and exited 0 while
  // `configure-agents` hard-failed before writing anything. The cause was a bare
  // `catch { return; }` in checkWorkflowBundleSourceAndOrphans (then still named
  // checkOrphanedWorkflowBundleFiles) swallowing the three source-integrity asserts.
  //
  // ⚠ This has to run against a COPY of the package. The pure guards in
  // test/bundle-guards.mjs cannot reach it — they assert on synthetic descriptor
  // lists, and the defect lives in what doctor DOES with the exception, not in
  // whether the exception is raised. Mutating the real templates/ tree to get here
  // is not an option a test suite should take.
  {
    const brokenPkg = join(tempRoot, 'broken-package');
    await cp(repoRoot, brokenPkg, {
      recursive: true,
      // Copy only what the CLI needs to run. node_modules/.git would make this
      // minutes instead of milliseconds.
      filter: (src) => {
        const rel = relative(repoRoot, src);
        if (rel === '') return true;
        const top = rel.split(/[\\/]/)[0];
        return ['bin', 'lib', 'templates', 'package.json'].includes(top);
      }
    });
    const brokenBin = join(brokenPkg, 'bin', 'dflow.js');

    const bpRoot = join(tempRoot, 'broken-package-project');
    await mkdir(bpRoot, { recursive: true });
    // ⚠ The fixture must be a project doctor calls COMPLETELY clean, and that is
    // load-bearing rather than tidiness. A first attempt answered `none` to the AI
    // agents question; the project then carried an unrelated `[warn] AI-AGENT-GUIDE.md
    // is missing`, which meant `All checks passed` never appeared in EITHER direction
    // and the "must not claim all checks passed" assertion below passed for a reason
    // that had nothing to do with the defect. Selecting the agents is what lets this
    // reproduce the reported symptom instead of merely correlating with it.
    const bpInitAnswers = [
      '1',       // edition: greenfield
      'ASP.NET Core 9, EF Core 8',
      'none',
      '1',       // prose: zh-TW
      '2',       // Git policy: trunk
      '1',       // AI commit marker: none
      '1',       // optional starter files: overview
      '1,2,3',   // AI agents: all — projects AI-AGENT-GUIDE.md
      'y'
    ].join('\n') + '\n';
    const bpInit = await runDflow(bpRoot, bpInitAnswers, ['init']);
    assert.equal(bpInit.code, 0, `broken-package: fixture init failed\nSTDOUT:\n${bpInit.stdout}\nSTDERR:\n${bpInit.stderr}`);
    // ⚠ This first fixture depends on the project HAVING a projected bundle, because
    // it is also the fixture for the ORPHAN SCAN path. The two fixtures below cover
    // what happens when that is not true.
    assert.equal(await exists(join(bpRoot, BUNDLE_REL, 'references')), true, 'broken-package: fixture must have a projected workflow bundle, or this case is vacuous');

    // Second fixture: the SAME initialized project with its workflow bundle removed.
    // `projgate-x1` found that the first version of this fix sat below the
    // bundle-directory early return, so this exact state — a real Dflow project, no
    // projected bundle, broken package — still printed `All checks passed`. The
    // manifest lives inside the bundle, so removing it also forces edition inference
    // down to the structural fallback, which is the path a real user would hit.
    const bpNoBundleRoot = join(tempRoot, 'broken-package-project-no-bundle');
    await cp(bpRoot, bpNoBundleRoot, { recursive: true });
    await rm(join(bpNoBundleRoot, BUNDLE_REL), { recursive: true, force: true });
    assert.equal(await exists(join(bpNoBundleRoot, BUNDLE_REL)), false, 'broken-package/no-bundle: the bundle must actually be gone');
    assert.equal(await exists(join(bpNoBundleRoot, 'dflow/specs/architecture/tech-debt.md')), true, 'broken-package/no-bundle: the structural edition signal must survive, or the check bails for the wrong reason');

    // Third fixture: a Dflow project whose EDITION cannot be inferred at all. This is
    // where `projgate-x2` found the second version of the fix still false-cleaning —
    // the gate had moved from "is a bundle projected" to "is an edition known", and
    // both were guesses at a boundary that turned out not to exist. Strip the
    // manifest (it lives inside the bundle) and every signal `inferExistingEdition`
    // reads. A real project reaches this by damage, not by design, which is exactly
    // when a user runs doctor.
    const bpNoEditionRoot = join(tempRoot, 'broken-package-project-no-edition');
    await cp(bpRoot, bpNoEditionRoot, { recursive: true });
    await rm(join(bpNoEditionRoot, BUNDLE_REL), { recursive: true, force: true });
    await rm(join(bpNoEditionRoot, 'dflow/specs/architecture/tech-debt.md'), { force: true });
    await rm(join(bpNoEditionRoot, 'dflow/specs/migration/tech-debt.md'), { force: true });
    await rm(join(bpNoEditionRoot, 'dflow/specs/domain/context-map.md'), { force: true });
    assert.equal(await exists(join(bpNoEditionRoot, 'dflow/specs/shared/_conventions.md')), true, 'broken-package/no-edition: it must still be recognisably a Dflow project, or the fixture proves nothing');

    const runCopiedDoctor = (cwd = bpRoot) => {
      const result = spawnSync(process.execPath, [brokenBin, 'doctor'], {
        cwd,
        encoding: 'utf8',
        timeout: RUN_TIMEOUT_MS,
        maxBuffer: 1024 * 1024
      });
      if (result.error) throw result.error;
      return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
    };

    // FALSE-REJECTION DIRECTION FIRST. The copy is still intact here, so the new
    // finding must NOT appear — otherwise a green mutation test below would only
    // prove the finding fires always. Run before the mutation so this cannot be
    // an artefact of restoring the file.
    const intactDoctor = runCopiedDoctor();
    assert.equal(intactDoctor.code, 0, `broken-package control: doctor on an INTACT package copy should exit 0\nSTDOUT:\n${intactDoctor.stdout}\nSTDERR:\n${intactDoctor.stderr}`);
    assert.doesNotMatch(intactDoctor.stdout, /installed dflow package looks incomplete/i, 'broken-package control: an intact package must NOT be reported as incomplete');
    // This is what makes the mutation assertion below non-vacuous: the fixture DOES
    // reach `All checks passed` when the package is whole, so losing that line later
    // can only be the deleted file talking.
    assert.match(intactDoctor.stdout, /All checks passed/, 'broken-package control: the fixture must be otherwise clean, or the mutation direction proves nothing');

    // Same control for the no-bundle project: with the package INTACT, a missing
    // workflow bundle must not be reported as a broken install. Without this, the
    // no-bundle assertion below could pass simply because the warning fires whenever
    // the bundle is absent — which would be a new false positive, not a fix.
    const intactNoBundleDoctor = runCopiedDoctor(bpNoBundleRoot);
    assert.equal(intactNoBundleDoctor.code, 0, `broken-package/no-bundle control: doctor should exit 0\nSTDOUT:\n${intactNoBundleDoctor.stdout}\nSTDERR:\n${intactNoBundleDoctor.stderr}`);
    assert.doesNotMatch(intactNoBundleDoctor.stdout, /installed dflow package looks incomplete/i, 'broken-package/no-bundle control: an intact package must NOT be reported as incomplete just because the project has no bundle');
    assert.match(intactNoBundleDoctor.stdout, /All checks passed/, 'broken-package/no-bundle control: this fixture must reach `All checks passed` intact, or its mutation direction proves nothing');

    const intactNoEditionDoctor = runCopiedDoctor(bpNoEditionRoot);
    assert.equal(intactNoEditionDoctor.code, 0, `broken-package/no-edition control: doctor should exit 0\nSTDOUT:\n${intactNoEditionDoctor.stdout}\nSTDERR:\n${intactNoEditionDoctor.stderr}`);
    assert.doesNotMatch(intactNoEditionDoctor.stdout, /installed dflow package looks incomplete/i, 'broken-package/no-edition control: an intact package must NOT be reported as incomplete just because the edition is unknown');
    assert.match(intactNoEditionDoctor.stdout, /All checks passed/, 'broken-package/no-edition control: this fixture must reach `All checks passed` intact, or its mutation direction proves nothing');

    // MUTATION DIRECTION. Derived from the real list, never a hardcoded name: a
    // hardcoded one goes stale the moment the list changes and then silently tests
    // the absence of a file that was never required.
    const [requiredCommonRel] = REQUIRED_COMMON_BUNDLE_FILES;
    assert.ok(requiredCommonRel, 'broken-package: REQUIRED_COMMON_BUNDLE_FILES must be non-empty or this case proves nothing');
    const victim = join(brokenPkg, 'templates', 'common', requiredCommonRel);
    assert.equal(await exists(victim), true, `broken-package: fixture precondition — ${requiredCommonRel} must exist in the copy`);
    await rm(victim, { force: true });

    const brokenDoctor = runCopiedDoctor();
    assert.equal(brokenDoctor.code, 0, `broken-package: doctor must stay read-only and exit 0\nSTDOUT:\n${brokenDoctor.stdout}\nSTDERR:\n${brokenDoctor.stderr}`);
    // The defect itself: this exact line is what shipped over a broken install.
    assert.doesNotMatch(brokenDoctor.stdout, /All checks passed/, 'broken-package: doctor must NOT claim all checks passed on a package whose bundle source is incomplete');
    assert.match(brokenDoctor.stdout, /\[warn\] The installed dflow package looks incomplete/, 'broken-package: doctor must report the broken install as a warn finding');
    // Name the missing file, so the reader can tell a broken install from project drift.
    assert.match(brokenDoctor.stdout, new RegExp(requiredCommonRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'broken-package: the finding must name the missing common file');
    assert.match(brokenDoctor.stdout, /not with anything in your project/, 'broken-package: the action must point at the package, not at project content');

    // ⚠ THE `projgate-x1` CASE. An initialized project with NO projected bundle must
    // reach the same verdict: the package is what is broken, and doctor may not hand
    // out a clean bill of health because one early return happened to fire first.
    const brokenNoBundleDoctor = runCopiedDoctor(bpNoBundleRoot);
    assert.equal(brokenNoBundleDoctor.code, 0, `broken-package/no-bundle: doctor must stay read-only and exit 0\nSTDOUT:\n${brokenNoBundleDoctor.stdout}\nSTDERR:\n${brokenNoBundleDoctor.stderr}`);
    assert.doesNotMatch(brokenNoBundleDoctor.stdout, /All checks passed/, 'broken-package/no-bundle: doctor must NOT claim all checks passed — this is the exact state projgate-x1 reproduced against the first version of the fix');
    assert.match(brokenNoBundleDoctor.stdout, /\[warn\] The installed dflow package looks incomplete/, 'broken-package/no-bundle: the broken install must be reported even with no projected bundle to scan');

    // ⚠ THE `projgate-x2` CASE — the third fixture, and the one that ended the
    // boundary-guessing: no manifest, no structural signal, so no edition at all.
    const brokenNoEditionDoctor = runCopiedDoctor(bpNoEditionRoot);
    assert.equal(brokenNoEditionDoctor.code, 0, `broken-package/no-edition: doctor must stay read-only and exit 0\nSTDOUT:\n${brokenNoEditionDoctor.stdout}\nSTDERR:\n${brokenNoEditionDoctor.stderr}`);
    assert.doesNotMatch(brokenNoEditionDoctor.stdout, /All checks passed/, 'broken-package/no-edition: doctor must NOT claim all checks passed — this is the state projgate-x2 reproduced against the second version of the fix');
    assert.match(brokenNoEditionDoctor.stdout, /\[warn\] The installed dflow package looks incomplete/, 'broken-package/no-edition: the common tree is edition-neutral, so a broken one must be reported without knowing the edition');
    // The consequence clause must NOT appear here: with no edition there was no
    // retired-file scan to lose, and claiming one was lost would be the same class of
    // false operational claim this fix removes.
    assert.doesNotMatch(brokenNoEditionDoctor.stdout, /retired-bundle-file scan did not run/, 'broken-package/no-edition: doctor must not claim it lost a scan that was never going to run');
    // ⚠ The no-bundle project has an edition but nothing projected, so that scan was
    // not going to run either. `projgate-y1` F5 caught the first version claiming it
    // was lost there. The clause needs BOTH conditions.
    assert.doesNotMatch(brokenNoBundleDoctor.stdout, /retired-bundle-file scan did not run/, 'broken-package/no-bundle: with no projected bundle there was no scan to lose either');
    assert.match(brokenDoctor.stdout, /retired-bundle-file scan did not run/, 'broken-package: where an edition IS known AND a bundle IS projected, the lost scan must be disclosed — otherwise the clause is dead code');

    // ⚠ THE `projgate-y1` CASE, and the one that ended three rounds of boundary
    // guessing. A common-tree-only scan reaches only ONE of the three integrity
    // asserts, so a CROSS-TREE COLLISION — the same file name in common and in an
    // edition — was invisible without an inferred edition while `configure-agents`
    // hard-failed on it. That shape is not exotic for this release: single-sourcing
    // MOVED a file between trees, so any install overwritten in place rather than
    // replaced leaves the per-track copy beside the new common one.
    // ⚠ Restore the deleted file FIRST, from the repo's real tree. Otherwise the
    // package carries two defects at once and a pass would not say which one was
    // seen — the collision has to be the only thing wrong for this to measure it.
    await cp(join(repoRoot, 'templates', 'common', requiredCommonRel), victim);
    const collisionVictim = REQUIRED_COMMON_BUNDLE_FILES[0];
    await cp(
      join(repoRoot, 'templates', 'common', collisionVictim),
      join(brokenPkg, 'templates', 'greenfield', collisionVictim)
    );
    const collisionDoctor = runCopiedDoctor(bpNoEditionRoot);
    assert.equal(collisionDoctor.code, 0, `broken-package/collision: doctor must stay read-only and exit 0\nSTDOUT:\n${collisionDoctor.stdout}`);
    assert.doesNotMatch(collisionDoctor.stdout, /All checks passed/, 'broken-package/collision: a cross-tree collision must be reported even when the edition is unknown — this is the state projgate-y1 reproduced against the third version of the fix');
    assert.match(collisionDoctor.stdout, /\[warn\] The installed dflow package looks incomplete/, 'broken-package/collision: the finding must name the broken install');
    assert.match(collisionDoctor.stdout, /exists in both/, 'broken-package/collision: the message must say what is actually wrong, not just that something is');

    // And the pairing that made all of this a defect rather than a cosmetic gap: the
    // two commands must not disagree about whether the package is usable. The copy
    // now carries the collision, so this checks that half of the pair — and it is the
    // half that was still disagreeing one round ago.
    const brokenConfigure = spawnSync(process.execPath, [join(brokenPkg, 'bin', 'dflow.js'), 'configure-agents'], {
      cwd: bpRoot, input: '1,2,3\ny\n', encoding: 'utf8', timeout: RUN_TIMEOUT_MS, maxBuffer: 1024 * 1024
    });
    assert.notEqual(brokenConfigure.status, 0, 'broken-package/collision: configure-agents must hard-fail — if it stops failing, this test is no longer measuring the disagreement it was written for');
    assert.match(`${brokenConfigure.stdout}${brokenConfigure.stderr}`, /exists in both/, 'broken-package/collision: configure-agents must fail for the SAME reason doctor reported, or the two commands still disagree');

    // ⚠ DISCLOSE-NOT-BLOCK (`projgate-x3`, user decision 2026-08-11). A track this
    // project does not use can be damaged while nothing it runs ever fails. That is
    // NOT the false-clean the warn exists for — doctor and configure-agents agree
    // here, and both are right — but a bare `All checks passed` would still imply a
    // completeness that was never checked. It is disclosed at `info`, and raising it
    // to `warn` would re-create the original disagreement in the opposite direction.
    // A separate package copy, so the collision above cannot bleed into this case.
    const otherTrackPkg = join(tempRoot, 'other-track-damaged-package');
    await cp(repoRoot, otherTrackPkg, {
      recursive: true,
      filter: (src) => {
        const rel = relative(repoRoot, src);
        if (rel === '') return true;
        return ['bin', 'lib', 'templates', 'package.json'].includes(rel.split(/[\\/]/)[0]);
      }
    });
    await rm(join(otherTrackPkg, 'templates', 'brownfield', 'references'), { recursive: true, force: true });
    const otherTrackDoctor = spawnSync(process.execPath, [join(otherTrackPkg, 'bin', 'dflow.js'), 'doctor'], {
      cwd: bpRoot, encoding: 'utf8', timeout: RUN_TIMEOUT_MS, maxBuffer: 1024 * 1024
    });
    assert.equal(otherTrackDoctor.status, 0, `other-track-damaged: doctor must exit 0\nSTDOUT:\n${otherTrackDoctor.stdout}`);
    assert.doesNotMatch(otherTrackDoctor.stdout, /All checks passed/, 'other-track-damaged: a bare clean bill implies a completeness that was not checked');
    assert.match(otherTrackDoctor.stdout, /\[info\] The installed dflow package is damaged in the brownfield track/, 'other-track-damaged: must be disclosed at info, naming the track');
    assert.doesNotMatch(otherTrackDoctor.stdout, /\[warn\]/, 'other-track-damaged: must NOT be a warn — warn is for what blocks you, and nothing here does');
    assert.match(otherTrackDoctor.stdout, /Nothing here blocks this project/, 'other-track-damaged: the reader must be told plainly that it does not block them');
    // The half that makes `info` the right level rather than a softer `warn`: the two
    // commands must AGREE here. If configure-agents starts failing, this is a warn.
    const otherTrackConfigure = spawnSync(process.execPath, [join(otherTrackPkg, 'bin', 'dflow.js'), 'configure-agents'], {
      cwd: bpRoot, input: '1,2,3\ny\n', encoding: 'utf8', timeout: RUN_TIMEOUT_MS, maxBuffer: 1024 * 1024
    });
    assert.equal(otherTrackConfigure.status, 0, `other-track-damaged: configure-agents must still SUCCEED — that agreement is what makes info the honest level\nSTDOUT:\n${otherTrackConfigure.stdout}\nSTDERR:\n${otherTrackConfigure.stderr}`);

    // ⚠ RESOLVER MISMATCH (`projgate-sol1` F1). doctor prefers the MANIFEST when
    // deciding which edition a project uses; `configure-agents` resolves by STRUCTURE
    // alone. Where they disagree, the "which this project does not use" claim names a
    // tree configure-agents is about to read and hard-fail on — the original
    // false-clean rebuilt through a different mechanism, and a claim this code only
    // started making one round earlier. Neither the `info` nor the flat
    // "configure-agents will fail" wording may appear here.
    const mismatchPkg = join(tempRoot, 'resolver-mismatch-package');
    await cp(repoRoot, mismatchPkg, {
      recursive: true,
      filter: (src) => {
        const rel = relative(repoRoot, src);
        if (rel === '') return true;
        return ['bin', 'lib', 'templates', 'package.json'].includes(rel.split(/[\\/]/)[0]);
      }
    });
    const mismatchRoot = join(tempRoot, 'resolver-mismatch-project');
    await cp(bpRoot, mismatchRoot, { recursive: true });
    // The project is structurally greenfield; make its manifest claim brownfield.
    const mmManifestPath = join(mismatchRoot, BUNDLE_REL, '.dflow-bundle-manifest.json');
    const mmManifest = JSON.parse(await readFile(mmManifestPath, 'utf8'));
    mmManifest.edition = 'brownfield';
    await writeFile(mmManifestPath, `${JSON.stringify(mmManifest, null, 2)}\n`);
    assert.equal(await exists(join(mismatchRoot, 'dflow/specs/architecture/tech-debt.md')), true, 'resolver-mismatch: the project must still look structurally greenfield, or there is no disagreement to test');
    // Damage the tree STRUCTURE points at — the one configure-agents will read.
    await rm(join(mismatchPkg, 'templates', 'greenfield', 'templates'), { recursive: true, force: true });

    const mismatchDoctor = spawnSync(process.execPath, [join(mismatchPkg, 'bin', 'dflow.js'), 'doctor'], {
      cwd: mismatchRoot, encoding: 'utf8', timeout: RUN_TIMEOUT_MS, maxBuffer: 1024 * 1024
    });
    assert.equal(mismatchDoctor.status, 0, `resolver-mismatch: doctor must exit 0\nSTDOUT:\n${mismatchDoctor.stdout}`);
    assert.doesNotMatch(mismatchDoctor.stdout, /does not use/, 'resolver-mismatch: doctor must NOT call a track unused when the two resolvers disagree about which track this project uses');
    assert.match(mismatchDoctor.stdout, /\[warn\] The installed dflow package looks incomplete/, 'resolver-mismatch: with the resolvers disagreeing, every track counts as depended-on, so this is a warn');
    assert.doesNotMatch(mismatchDoctor.stdout, /will fail on this package too/, 'resolver-mismatch: doctor cannot assert configure-agents will fail when it does not know which track configure-agents will pick');
    assert.match(mismatchDoctor.stdout, /depends on which track it resolves this project to/, 'resolver-mismatch: the conditional wording must be used instead');
    // The half that proves the warn was right: configure-agents does hit the damage.
    const mismatchConfigure = spawnSync(process.execPath, [join(mismatchPkg, 'bin', 'dflow.js'), 'configure-agents'], {
      cwd: mismatchRoot, input: '1,2,3\ny\n', encoding: 'utf8', timeout: RUN_TIMEOUT_MS, maxBuffer: 1024 * 1024
    });
    assert.notEqual(mismatchConfigure.status, 0, 'resolver-mismatch: configure-agents DOES read the structure track and must fail — that is why doctor may not call it unused');
  }

  console.log(`Smoke test passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
