const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const { TextDecoder } = require('node:util');

const pkg = require('../package.json');
const doctorChecks = require('./doctor-checks');

const MIN_NODE_VERSION = '22.0.0';
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_ROOT = path.join(PACKAGE_ROOT, 'templates');
const COMMAND_REGISTRY_START = '<!-- dflow-command-registry:start -->';
const COMMAND_REGISTRY_END = '<!-- dflow-command-registry:end -->';
const COMMAND_ADAPTER_GENERATED_MARKER = '<!-- dflow-generated: command-adapter -->';
const SKILL_ADAPTER_GENERATED_MARKER = '<!-- dflow-generated: skill-adapter -->';
const WORKFLOW_BUNDLE_GENERATED_MARKER = '<!-- dflow-generated: workflow-bundle -->';
const CODEX_TRIGGER_SECTION_START = '<!-- dflow-generated: codex-command-triggers START -->';
const CODEX_TRIGGER_SECTION_END = '<!-- dflow-generated: codex-command-triggers END -->';
// PROPOSAL-054: marker pair that wraps the Dflow base shim when it is appended
// into a user-owned root agent file (CLAUDE.md / AGENTS.md / copilot-instructions).
// It is ONLY used for the in-user-file block; a whole-file Dflow shim (freshly
// created, or a pristine 0.8.0/0.9.0 shim) stays marker-free and is recognized by
// the normalized template match (isPristineDflowAgentsShim), so we never have to
// freeze the pre-marker shim template for back-compat.
const AGENT_SHIM_SECTION_START = '<!-- dflow-generated: agent-shim START -->';
const AGENT_SHIM_SECTION_END = '<!-- dflow-generated: agent-shim END -->';
// PROPOSAL-058: the packaged guide templates wrap their Dflow-canonical body in
// this pair; configure-agents refreshes the region in place on upgrade and never
// touches content outside it ("## Project Context" and anything else the user
// keeps there).
const GUIDE_CANONICAL_SECTION_START = '<!-- dflow-generated: guide-canonical START -->';
const GUIDE_CANONICAL_SECTION_END = '<!-- dflow-generated: guide-canonical END -->';
const AI_AGENT_GUIDE_DEST = 'dflow/specs/shared/AI-AGENT-GUIDE.md';
const WORKFLOW_BUNDLE_DEST = 'dflow/specs/shared/dflow-workflows';
const WORKFLOW_BUNDLE_MANIFEST_PATH = `${WORKFLOW_BUNDLE_DEST}/.dflow-bundle-manifest.json`;
const COMMON_SKILL_SOURCE_REL = 'common/skill/SKILL.md';
// Files the common bundle tree (templates/common/) MUST provide. A missing
// common file is a broken package, NOT a retired bundle file: without this guard
// listBundleSourceFiles would return a smaller-but-"valid" set lacking the file,
// and configure-agents stale-removal would then DELETE the already-installed
// copy from the user's project (it diffs as "retired"). PROPOSAL-064 fresh-gate
// finding. Guarded before any stale cleanup / manifest write.
// Frozen because it is exported: an unfrozen array could be emptied by any
// consumer (`REQUIRED_COMMON_BUNDLE_FILES.length = 0`), silently turning the
// completeness guard into a no-op for the rest of the process.
const REQUIRED_COMMON_BUNDLE_FILES = Object.freeze([
  'references/ddd-modeling-guide.md',
  'references/dflow-feedback-flow.md'
]);
const EXPECTED_COMMAND_IDS = [
  'new-feature',
  'modify-existing',
  'bug-fix',
  'new-phase',
  'finish-feature',
  'verify',
  'pr-review',
  'report-dflow-feedback',
  'status',
  'next',
  'cancel'
];
const LEGACY_COMMAND_ADAPTERS = [
  {
    version: '0.5.0',
    agent: 'claude',
    source: 'generated:legacy-claude-command-adapter-v0.5.0',
    pathPattern: '.claude/commands/dflow/dflow-<id>.md',
    fingerprint: 'v0.5.0 buildThinCommandWrapper',
    commands: [
      { id: 'new-feature', label: '/dflow:new-feature', argHint: 'feature request' },
      { id: 'modify-existing', label: '/dflow:modify-existing', argHint: 'change request' },
      { id: 'bug-fix', label: '/dflow:bug-fix', argHint: 'expected vs actual' },
      { id: 'new-phase', label: '/dflow:new-phase', argHint: 'feature id or phase goal' },
      { id: 'finish-feature', label: '/dflow:finish-feature', argHint: 'feature id' },
      { id: 'verify', label: '/dflow:verify', argHint: 'area or feature id' },
      { id: 'pr-review', label: '/dflow:pr-review', argHint: 'change or branch' },
      { id: 'report-dflow-feedback', label: '/dflow:report-dflow-feedback', argHint: 'issue or improvement' },
      { id: 'status', label: '/dflow:status', argHint: '-' },
      { id: 'next', label: '/dflow:next', argHint: '-' },
      { id: 'cancel', label: '/dflow:cancel', argHint: '-' }
    ]
  }
];

const PROSE_LANGUAGE_PATTERN =
  /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|[0-9]{3}))?(?:-(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*$/;

const INVALID_PROSE_LANGUAGE_VALUES = new Set([
  'any',
  'auto',
  'detect',
  'skip',
  'later',
  'same as user',
  'same-as-user',
  'traditional chinese',
  'english',
  'japanese',
  'chinese'
]);

const PROJECT_TYPE_OPTIONS = [
  {
    key: 'greenfield',
    label: 'Greenfield - fresh project adopting Dflow',
    aliases: ['greenfield', 'fresh']
  },
  {
    key: 'brownfield',
    label: 'Brownfield - existing codebase adopting Dflow',
    aliases: ['brownfield', 'existing']
  }
];

const PROSE_LANGUAGE_OPTIONS = [
  {
    key: 'zh-TW',
    label: 'zh-TW - Traditional Chinese',
    aliases: ['zh-tw', 'zh_tw']
  },
  {
    key: 'en',
    label: 'en - English',
    aliases: ['en']
  },
  {
    key: 'ja-JP',
    label: 'ja-JP - Japanese',
    aliases: ['ja-jp', 'ja_jp']
  },
  {
    key: 'custom',
    label: 'Custom BCP-47 tag',
    aliases: ['custom', 'bcp-47', 'bcp47']
  }
];

const OPTIONAL_FILE_OPTIONS = [
  {
    key: 'overview',
    label: '_overview.md - system overview',
    aliases: ['overview', '_overview.md']
  }
];

// Git policy is a mandatory team choice (PROPOSAL-047): both options use feature
// branches; the choice selects the finish-stage merge guidance and drives the
// runtime branch gates / commit checkpoints.
const GIT_POLICY_OPTIONS = [
  {
    key: 'gitflow',
    label: 'Git Flow - long-lived develop/release branches',
    aliases: ['gitflow', 'git flow', 'flow']
  },
  {
    key: 'trunk',
    label: 'Trunk / GitHub Flow - short-lived feature branches (lightest)',
    aliases: ['trunk', 'trunk-based', 'github flow', 'githubflow']
  }
];

// How AI-made commits are marked (PROPOSAL-047). Chosen once at init; the
// runtime does not re-ask. None is the default.
const AI_COMMIT_MARKER_OPTIONS = [
  {
    key: 'none',
    label: 'None - AI commits look like any other commit',
    aliases: ['none', 'off', 'no']
  },
  {
    key: 'co-authored-by',
    label: 'Co-Authored-By trailer (dflow-ai) - filterable / auditable',
    aliases: ['co-authored-by', 'co-author', 'trailer', 'coauthored']
  },
  {
    key: 'prefix',
    label: '[ai-assisted] commit-message prefix - visible at a glance',
    aliases: ['prefix', 'ai-assisted', '[ai-assisted]']
  }
];

const AI_AGENT_OPTIONS = [
  {
    key: 'agents',
    label: 'AGENTS.md - Codex / Copilot coding agent',
    aliases: ['agents', 'agents.md', 'codex', 'copilot agent', 'copilot coding agent']
  },
  {
    key: 'claude',
    label: 'CLAUDE.md - Claude Code',
    aliases: ['claude', 'claude.md']
  },
  {
    key: 'copilot',
    label: '.github/copilot-instructions.md - GitHub Copilot',
    aliases: ['copilot', 'github copilot', 'copilot-instructions', 'copilot-instructions.md']
  }
];

const DEFERRED_COMMON = [
  {
    relativePath: 'dflow/specs/domain/{context}/behavior.md',
    reason: 'Needs a real bounded context; created later by feature completion or baseline capture.'
  },
  {
    relativePath: 'dflow/specs/domain/{context}/models.md',
    reason: 'Needs a real bounded context.'
  },
  {
    relativePath: 'dflow/specs/domain/{context}/rules.md',
    reason: 'Needs a real bounded context.'
  }
];

// ⚠ EDITION-SPECIFIC DEFERRALS, and the reason this list exists is that the
// other one is named COMMON. The ADR row used to sit in DEFERRED_COMMON while
// `dflow/specs/architecture/` is a greenfield-only tree — brownfield records
// architecture decisions under `dflow/specs/migration/` and never creates
// `architecture/` at all. So every brownfield `dflow init` printed a promise to
// create a directory the CLI will never create (`debt20-tut-y5`, confirmed by
// `debt20-tut-y6`). `buildDeferredItems` only ever ADDED to the common list, so
// nothing could subtract a row that did not apply — the fix is to stop putting
// edition-specific rows in the shared list rather than to add a subtraction
// step. Anything that is true for one edition only belongs here.
const DEFERRED_GREENFIELD_ONLY = [
  {
    relativePath: 'dflow/specs/domain/{context}/events.md',
    reason: 'Greenfield only, but still needs a real bounded context.'
  },
  {
    relativePath: 'dflow/specs/architecture/decisions/ADR-*.md',
    reason: 'ADRs are created when a real architecture decision exists.'
  }
];

class InitError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'InitError';
    this.exitCode = exitCode;
  }
}

class UserAbort extends Error {
  constructor(message = 'Dflow init aborted.') {
    super(message);
    this.name = 'UserAbort';
    this.exitCode = 0;
  }
}

class WritePhaseError extends Error {
  constructor(message, result) {
    super(message);
    this.name = 'WritePhaseError';
    this.exitCode = 1;
    this.result = result;
  }
}

async function runInit(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;

  let rl;

  try {
    rl = readline.createInterface({
      input: stdin,
      output: stdout,
      terminal: Boolean(stdin.isTTY && stdout.isTTY)
    });
    rl._dflowOutput = stdout;
    getLinePrompter(rl);

    const preflight = await runPreflight(cwd);
    writeWarnings(stderr, preflight.warnings);

    const detection = await detectProjectSignals(cwd);
    const answers = await promptForAnswers(rl, stdout, stderr, detection);
    // PROPOSAL-074: skill question sits after the AI-agents question and before the
    // preview; asked only when a skill-capable agent was selected, and only on TTY.
    answers.skills = await resolveSkillInstall(
      rl,
      stdout,
      Boolean(stdin.isTTY && stdout.isTTY),
      answers.aiAgents.some((agent) => SKILL_ADAPTER_TARGETS[agent])
    );
    const plan = await buildFilePlan(cwd, answers);
    const warnings = [...preflight.warnings, ...buildDetectionWarnings(answers, detection), ...(plan.warnings || []), ...(plan.bundleWarnings || [])];

    renderPreview(stdout, plan, warnings);
    const confirmed = await askConfirmation(rl, 'Create these files? (y/N) ');

    if (!confirmed) {
      throw new UserAbort();
    }

    rl.close();
    rl = undefined;

    const result = await writeFilePlan(cwd, plan);
    result.warnings.unshift(...warnings);
    result.warnings.push(...collectUnresolvedPlaceholderWarnings(plan, result.created));

    printResultReport(stdout, result, plan.deferred);
    printNextSteps(stdout, answers.skills);
    return 0;
  } catch (error) {
    if (rl) {
      rl.close();
    }

    if (error instanceof UserAbort) {
      stdout.write(`${error.message}\n`);
      return error.exitCode;
    }

    if (error instanceof WritePhaseError) {
      stderr.write(`${error.message}\n`);
      stderr.write('Files already created were kept; clean up partial output manually if needed.\n');
      if (error.result) {
        printResultReport(stdout, error.result, []);
      }
      return error.exitCode;
    }

    if (error instanceof InitError) {
      stderr.write(`${error.message}\n`);
      return error.exitCode;
    }

    stderr.write(`${error && error.message ? error.message : error}\n`);
    return 1;
  }
}

async function runConfigureAgents(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;

  let rl;

  try {
    rl = readline.createInterface({
      input: stdin,
      output: stdout,
      terminal: Boolean(stdin.isTTY && stdout.isTTY)
    });
    rl._dflowOutput = stdout;
    getLinePrompter(rl);

    if (compareVersions(process.versions.node, MIN_NODE_VERSION) < 0) {
      throw new InitError(`Dflow configure-agents requires Node.js ${MIN_NODE_VERSION}+.`, 1);
    }

    await assertWritableProjectRoot(cwd);
    await assertDflowInitialized(cwd);

    const projectContext = await inferProjectContext(cwd, rl, stdout, stderr);
    const detectedAgents = await detectConfiguredAgents(cwd);
    const aiAgents = await askAiAgents(rl, stdout, stderr, detectedAgents);

    if (aiAgents.length === 0) {
      throw new UserAbort('No AI agents selected. Nothing changed.');
    }

    // PROPOSAL-074 (OQ2 branch b): without --skills, a selected agent that has no
    // project-level skill yet gets the same default-yes install contract as init
    // (TTY asks, non-TTY installs without reading stdin). Agents whose skill file
    // already exists — Dflow-generated or user-owned — never re-ask and are NOT
    // regenerated (skillAgents carries only the missing ones); explicit --skills
    // keeps its original regenerate-all meaning.
    let skillAgents = [];
    if (options.skills) {
      skillAgents = aiAgents;
    } else {
      const missingSkillAgents = [];
      for (const agent of aiAgents) {
        const target = SKILL_ADAPTER_TARGETS[agent];
        if (target && !(await pathExists(path.join(cwd, target.relativePath)))) {
          missingSkillAgents.push(agent);
        }
      }
      const install = await resolveSkillInstall(
        rl,
        stdout,
        Boolean(stdin.isTTY && stdout.isTTY),
        missingSkillAgents.length > 0
      );
      if (install) {
        skillAgents = missingSkillAgents;
      }
    }

    // PROPOSAL-058: adoption offers are decided by planning the run twice. The
    // first plan flags what is offer-able (a recognizable pre-marker guide, a
    // guide-referencing agent file Dflow does not manage); an interactive run
    // then asks, and only a granted consent triggers a re-plan. A non-TTY run
    // never asks and never consumes a stdin slot (the PROPOSAL-074 contract:
    // existing piped answer sequences must run unchanged), so it keeps the
    // skip + warn behavior. Deriving the offers from the plan itself keeps the
    // question conditions and the plan branches from ever drifting apart.
    const interactive = Boolean(stdin.isTTY && stdout.isTTY);
    let adoptGuideMarkers = false;
    const adoptShimAgents = [];
    const buildPlan = () => buildConfigureAgentsPlan(cwd, {
      ...projectContext,
      aiAgents,
      commandAdapters: Boolean(options.commandAdapters),
      skills: Boolean(options.skills),
      skillAgents,
      adoptGuideMarkers,
      adoptShimAgents
    });

    let plan = await buildPlan();

    if (interactive) {
      const offersGuide = plan.items.some((item) => item.offerGuideAdoption);
      const shimOffers = dedupe(
        plan.items.filter((item) => item.offerShimAdoption).map((item) => item.offerShimAdoption)
      );
      if (offersGuide) {
        adoptGuideMarkers = await askGuideMarkerAdoption(rl, stdout);
      }
      for (const agent of shimOffers) {
        if (await askShimBlockAdoption(rl, stdout, agent)) {
          adoptShimAgents.push(agent);
        }
      }
      if (adoptGuideMarkers || adoptShimAgents.length > 0) {
        plan = await buildPlan();
      }
    }

    const warnings = plan.warnings || [];
    renderPreview(stdout, plan, warnings);
    const confirmed = await askConfirmation(rl, 'Create these files? (y/N) ');

    if (!confirmed) {
      throw new UserAbort();
    }

    rl.close();
    rl = undefined;

    const result = await writeFilePlan(cwd, plan);
    result.warnings.unshift(...warnings);
    result.warnings.push(...collectUnresolvedPlaceholderWarnings(plan, result.created));

    printResultReport(stdout, result, plan.deferred);
    const usedSnippetFallback = plan.items.some((item) => item.snippetFallback);
    printConfigureAgentsNextSteps(stdout, Boolean(options.commandAdapters), usedSnippetFallback, skillAgents.length > 0);
    return 0;
  } catch (error) {
    if (rl) {
      rl.close();
    }

    if (error instanceof UserAbort) {
      stdout.write(`${error.message}\n`);
      return error.exitCode;
    }

    if (error instanceof WritePhaseError) {
      stderr.write(`${error.message}\n`);
      stderr.write('Files already created were kept; clean up partial output manually if needed.\n');
      if (error.result) {
        printResultReport(stdout, error.result, []);
      }
      return error.exitCode;
    }

    if (error instanceof InitError) {
      stderr.write(`${error.message}\n`);
      return error.exitCode;
    }

    stderr.write(`${error && error.message ? error.message : error}\n`);
    return 1;
  }
}

async function assertDflowInitialized(cwd) {
  const dflowSpecsPath = path.join(cwd, 'dflow', 'specs');

  if (!(await pathExists(dflowSpecsPath)) || !(await containsInitializedContent(dflowSpecsPath))) {
    throw new InitError('Dflow is not initialized in this project. Run `dflow init` first.');
  }
}

async function runPreflight(cwd) {
  const warnings = [];
  const dflowSpecsPath = path.join(cwd, 'dflow', 'specs');

  if (await pathExists(dflowSpecsPath)) {
    if (await containsInitializedContent(dflowSpecsPath)) {
      throw new InitError('Dflow already initialized at dflow/specs/.');
    }

    warnings.push('Found empty dflow/specs/. Continuing because no initialized files were found.');
  }

  await assertWritableProjectRoot(cwd);

  if (compareVersions(process.versions.node, MIN_NODE_VERSION) < 0) {
    throw new InitError(`Dflow init requires Node.js ${MIN_NODE_VERSION}+.`, 1);
  }

  return { warnings };
}

async function assertWritableProjectRoot(cwd) {
  const testPath = path.join(cwd, `.dflow-init-write-test-${process.pid}-${Date.now()}`);

  try {
    await fs.writeFile(testPath, '', { flag: 'wx' });
  } catch {
    throw new InitError(`Project root is not writable: ${cwd}`);
  } finally {
    await fs.unlink(testPath).catch(() => {});
  }
}

async function containsInitializedContent(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (!entry.isDirectory()) {
      return true;
    }
    if (await containsInitializedContent(absolute)) {
      return true;
    }
  }

  return false;
}

async function detectProjectSignals(cwd) {
  const files = await collectProjectFiles(cwd, 4, 5000);
  const baseNames = new Set(files.map((file) => path.basename(file).toLowerCase()));
  const relNames = new Set(files.map((file) => normalizePath(file).toLowerCase()));

  const hasSourceTree =
    (await pathExists(path.join(cwd, 'src'))) ||
    Array.from(baseNames).some((name) =>
      name.endsWith('.sln') ||
      name.endsWith('.csproj') ||
      name === 'program.cs' ||
      name === 'startup.cs' ||
      name === 'package.json' ||
      name === 'pom.xml' ||
      name === 'build.gradle' ||
      name === 'build.gradle.kts' ||
      name === 'pyproject.toml' ||
      name === 'requirements.txt' ||
      name === 'go.mod' ||
      name === 'cargo.toml' ||
      name === 'composer.json' ||
      name === 'gemfile'
    );

  const hasWebFormsFiles = Array.from(baseNames).some((name) =>
    name.endsWith('.aspx') || name.endsWith('.ascx') || name.endsWith('.master')
  );

  const csprojFiles = files.filter((file) => file.toLowerCase().endsWith('.csproj'));
  let coreSignal = false;
  let webFormsSignal = hasWebFormsFiles;

  for (const relativeFile of csprojFiles) {
    const absolute = path.join(cwd, relativeFile);
    const content = await fs.readFile(absolute, 'utf8').catch(() => '');
    if (/Microsoft\.NET\.Sdk\.Web/i.test(content) && /<TargetFramework>\s*net(?:[6-9]|[1-9][0-9])\./i.test(content)) {
      coreSignal = true;
    }
    if (/System\.Web/i.test(content)) {
      webFormsSignal = true;
    }
  }

  let trackHint = null;
  if (coreSignal && !webFormsSignal) {
    trackHint = 'greenfield';
  } else if (webFormsSignal && !coreSignal) {
    trackHint = 'brownfield';
  }

  const stackHints = [];
  if (coreSignal || webFormsSignal || csprojFiles.length > 0) {
    stackHints.push('dotnet');
  }
  if (baseNames.has('pom.xml') || baseNames.has('build.gradle') || baseNames.has('build.gradle.kts')) {
    stackHints.push('java');
  }
  if (baseNames.has('package.json')) {
    stackHints.push('nodejs');
  }
  if (baseNames.has('pyproject.toml') || baseNames.has('requirements.txt')) {
    stackHints.push('python');
  }
  if (baseNames.has('go.mod')) {
    stackHints.push('go');
  }
  if (baseNames.has('cargo.toml')) {
    stackHints.push('rust');
  }
  if (baseNames.has('composer.json')) {
    stackHints.push('php');
  }
  if (baseNames.has('gemfile')) {
    stackHints.push('ruby');
  }

  return {
    hasSourceTree: hasSourceTree || relNames.has('src'),
    trackHint,
    stackHints,
    configuredAgents: await detectConfiguredAgents(cwd)
  };
}

async function detectConfiguredAgents(cwd) {
  // Surface agents this project already has configured so init / configure-agents
  // can default to them instead of re-asking from scratch on every invocation.
  // Order matches AI_AGENT_OPTIONS so the prompt numbering lines up.
  const detected = [];
  if (
    (await pathExists(path.join(cwd, 'AGENTS.md'))) ||
    // PROPOSAL-056 Phase 1: a project-level Codex skill counts as configured so
    // re-runs default to the `agents` target, matching the .claude/skills check
    // below for Claude.
    (await pathExists(path.join(cwd, '.agents/skills/dflow')))
  ) {
    detected.push('agents');
  }
  if (
    (await pathExists(path.join(cwd, 'CLAUDE.md'))) ||
    (await pathExists(path.join(cwd, '.claude/commands/dflow'))) ||
    (await pathExists(path.join(cwd, '.claude/skills/dflow')))
  ) {
    detected.push('claude');
  }
  if (
    (await pathExists(path.join(cwd, '.github/copilot-instructions.md'))) ||
    // A project-level Copilot skill counts as configured too (parity with the
    // .claude/skills and .agents/skills checks above).
    (await pathExists(path.join(cwd, '.github/skills/dflow')))
  ) {
    detected.push('copilot');
  }
  return detected;
}

async function collectProjectFiles(cwd, maxDepth, maxFiles) {
  const results = [];
  const ignored = new Set(['.git', 'node_modules', 'bin', 'obj', 'dflow']);

  async function walk(directory, depth, prefix) {
    if (depth > maxDepth || results.length >= maxFiles) {
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) {
        break;
      }

      if (ignored.has(entry.name)) {
        continue;
      }

      const relative = prefix ? path.join(prefix, entry.name) : entry.name;
      const absolute = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(absolute, depth + 1, relative);
      } else {
        results.push(relative);
      }
    }
  }

  await walk(cwd, 0, '');
  return results;
}

function buildDetectionWarnings(answers, detection) {
  const warnings = [];

  if (answers.projectType === 'greenfield' && detection.hasSourceTree && !detection.trackHint) {
    warnings.push('Note: existing source files were detected (e.g. a src/ directory or a build manifest). This is expected if you just scaffolded a fresh project — Dflow will continue as Greenfield. If this is actually an existing codebase, consider re-running and selecting Brownfield.');
  }

  if (detection.trackHint && answers.projectType !== detection.trackHint) {
    warnings.push(
      `Warning: project signals look like ${formatTrack(detection.trackHint)}, but selected track is ${formatTrack(answers.projectType)}. Continuing with your selected track.`
    );
  }

  return warnings;
}

async function promptForAnswers(rl, stdout, stderr, detection) {
  const projectTypeDefault = detection.hasSourceTree ? null : 'greenfield';
  const projectType = await askSelect(rl, stdout, stderr, {
    id: 'Q1',
    question: 'What kind of project is this?',
    options: PROJECT_TYPE_OPTIONS,
    defaultKey: projectTypeDefault
  });

  const techStackSummary = await askText(rl, stderr, {
    id: 'Q2',
    question: 'Confirm the main tech stack details for placeholders.',
    required: true,
    maxLength: 1000,
    allowUnknown: true
  });

  const migrationContext = await askText(rl, stderr, {
    id: 'Q3',
    question: 'Is there migration or legacy context Dflow should note?',
    required: false,
    maxLength: 1000,
    defaultValue: 'none'
  });

  const proseLanguageSelection = await askSelect(rl, stdout, stderr, {
    id: 'Q4',
    question: 'Project prose language for generated spec content?',
    options: PROSE_LANGUAGE_OPTIONS,
    defaultKey: null
  });

  let proseLanguage = proseLanguageSelection;
  if (proseLanguageSelection === 'custom') {
    proseLanguage = await askCustomProseLanguage(rl, stderr);
  }

  const gitPolicy = await askSelect(rl, stdout, stderr, {
    id: 'Q5',
    question: 'Which Git policy does the team follow? (drives branch gates and finish-stage merge guidance)',
    options: GIT_POLICY_OPTIONS,
    defaultKey: null
  });

  const aiCommitMarker = await askSelect(rl, stdout, stderr, {
    id: 'Q6',
    question: 'How should AI-made commits be marked? (the AI offers to commit at checkpoints; you can always decline)',
    options: AI_COMMIT_MARKER_OPTIONS,
    defaultKey: 'none'
  });

  const optionalFiles = await askOptionalFiles(rl, stdout, stderr);
  const aiAgents = await askAiAgents(rl, stdout, stderr, detection.configuredAgents || []);

  return {
    projectType,
    edition: projectType,
    techStackSummary,
    migrationContext,
    proseLanguage,
    gitPolicy,
    aiCommitMarker,
    optionalFiles,
    aiAgents
  };
}

async function inferProjectContext(cwd, rl, stdout, stderr) {
  let edition = await inferExistingEdition(cwd);

  if (!edition) {
    stderr.write('Could not infer the Dflow track from dflow/specs/. Please choose it explicitly.\n');
    edition = await askSelect(rl, stdout, stderr, {
      id: 'track',
      question: 'Which Dflow track is this project using?',
      options: PROJECT_TYPE_OPTIONS,
      defaultKey: null
    });
  }

  return {
    projectType: edition,
    edition,
    techStackSummary: await inferTechStackSummary(cwd),
    migrationContext: await inferMigrationContext(cwd),
    proseLanguage: await inferProseLanguage(cwd),
    gitPolicy: await inferGitPolicy(cwd),
    aiCommitMarker: await inferAiCommitMarker(cwd),
    optionalFiles: []
  };
}

// The machine-readable line patterns and value parse live in lib/doctor-checks.js
// so the doctor "machine format" findings and this inference can never drift
// apart (PROPOSAL-058).
async function inferGitPolicy(cwd) {
  const conventionsPath = path.join(cwd, 'dflow/specs/shared/_conventions.md');
  const content = await fs.readFile(conventionsPath, 'utf8').catch(() => '');
  return doctorChecks.parseContextLine(content, doctorChecks.GIT_POLICY_LINE_RE);
}

async function inferAiCommitMarker(cwd) {
  const conventionsPath = path.join(cwd, 'dflow/specs/shared/_conventions.md');
  const content = await fs.readFile(conventionsPath, 'utf8').catch(() => '');
  return doctorChecks.parseContextLine(content, doctorChecks.AI_COMMIT_MARKER_LINE_RE);
}

async function inferExistingEdition(cwd) {
  if (await pathExists(path.join(cwd, 'dflow/specs/architecture/tech-debt.md'))) {
    return 'greenfield';
  }
  if (await pathExists(path.join(cwd, 'dflow/specs/migration/tech-debt.md'))) {
    return 'brownfield';
  }
  if (await pathExists(path.join(cwd, 'dflow/specs/domain/context-map.md'))) {
    return 'greenfield';
  }
  return null;
}

async function inferProseLanguage(cwd) {
  const conventionsPath = path.join(cwd, 'dflow/specs/shared/_conventions.md');
  const content = await fs.readFile(conventionsPath, 'utf8').catch(() => '');
  return doctorChecks.parseContextLine(content, doctorChecks.PROSE_LANGUAGE_LINE_RE) ?? 'unknown';
}

// PROPOSAL-076: the machine-readable record of the init Q2/Q3 answers is the
// guide's "## Project Context" table — init substitutes them into the
// `| Tech stack |` / `| Migration / legacy context |` rows there. (The
// pre-076 code looked for those rows in _overview.md, which never carried
// them in any packaged template, so inference always fell back.) Only the
// Project Context section is parsed: it is the contractual user region
// (PROPOSAL-058), so a same-name row anywhere else in the guide can never
// shadow it.
async function inferTechStackSummary(cwd) {
  return (await inferGuideProjectContextValue(cwd, doctorChecks.TECH_STACK_ROW_RE)) ?? 'unknown';
}

async function inferMigrationContext(cwd) {
  return (await inferGuideProjectContextValue(cwd, doctorChecks.MIGRATION_CONTEXT_ROW_RE)) ?? 'none';
}

async function inferGuideProjectContextValue(cwd, re) {
  const guidePath = path.join(cwd, AI_AGENT_GUIDE_DEST);
  const content = await fs.readFile(guidePath, 'utf8').catch(() => '');
  const slice = projectContextParseSlice(toLf(content));
  return slice === null ? null : doctorChecks.parseContextLine(slice, re);
}

// The parseable slice of the "## Project Context" section: fenced examples
// inside the section are blanked so a decoy row in a fence can neither supply
// nor shadow a value (PROPOSAL-076 gate G2) — fence state is clean at the
// heading because the fence-aware bounds scan would not have matched a heading
// inside a fence. Inference and the doctor row check must both parse through
// this slice so they can never disagree.
function projectContextParseSlice(lfContent) {
  const bounds = projectContextSectionBounds(lfContent);
  if (!bounds) return null;
  const section = bounds.lines.slice(bounds.start, bounds.end).join('\n');
  return doctorChecks.blankFencedBlocks(section).join('\n');
}

async function askSelect(rl, stdout, stderr, config) {
  let failedAttempts = 0;

  while (true) {
    stdout.write(`\n${config.question}\n`);
    config.options.forEach((option, index) => {
      const defaultMarker = option.key === config.defaultKey ? ' (default)' : '';
      stdout.write(`  ${index + 1}. ${option.label}${defaultMarker}\n`);
    });

    const answer = await askLine(rl, `Enter choice [1-${config.options.length}]${config.defaultKey ? ` (default: ${displayOptionNumber(config.options, config.defaultKey)})` : ''}: `);
    const selected = parseSelectAnswer(answer, config.options, config.defaultKey);

    if (selected) {
      return selected;
    }

    failedAttempts += 1;
    if (failedAttempts >= 3) {
      throw new InitError(`Too many invalid attempts for ${config.id}. Dflow init aborted.`);
    }
    stderr.write(`Invalid selection. Choose one of the listed options. (${3 - failedAttempts} attempts left)\n`);
  }
}

async function askText(rl, stderr, config) {
  let failedAttempts = 0;

  while (true) {
    const suffix = config.defaultValue ? ` (default: ${config.defaultValue})` : '';
    const answer = (await askLine(rl, `\n${config.question}${suffix}\n> `)).trim();
    const value = answer || config.defaultValue || '';

    if (config.required && !value) {
      failedAttempts += 1;
      if (failedAttempts >= 3) {
        throw new InitError(`Too many invalid attempts for ${config.id}. Dflow init aborted.`);
      }
      stderr.write(`This answer is required. (${3 - failedAttempts} attempts left)\n`);
      continue;
    }

    if (config.maxLength && value.length > config.maxLength) {
      failedAttempts += 1;
      if (failedAttempts >= 3) {
        throw new InitError(`Too many invalid attempts for ${config.id}. Dflow init aborted.`);
      }
      stderr.write(`Answer is too long. Use ${config.maxLength} characters or fewer. (${3 - failedAttempts} attempts left)\n`);
      continue;
    }

    if (config.allowUnknown && value.toLowerCase() === 'unknown') {
      return 'unknown';
    }

    return value || 'none';
  }
}

async function askCustomProseLanguage(rl, stderr) {
  let failedAttempts = 0;

  while (true) {
    const value = (await askLine(rl, '\nEnter the explicit BCP-47 language tag for project prose.\n> ')).trim();
    const validation = validateProseLanguage(value);

    if (validation.valid) {
      return value;
    }

    failedAttempts += 1;
    if (failedAttempts >= 3) {
      throw new InitError('Too many invalid attempts for Q4a. Dflow init aborted.');
    }
    stderr.write(`${validation.message} (${3 - failedAttempts} attempts left)\n`);
  }
}

async function askOptionalFiles(rl, stdout, stderr) {
  let failedAttempts = 0;

  while (true) {
    stdout.write('\nWhich optional starter files should Dflow seed?\n');
    OPTIONAL_FILE_OPTIONS.forEach((option, index) => {
      const defaultMarker = option.key === 'overview' ? ' (recommended)' : '';
      stdout.write(`  ${index + 1}. ${option.label}${defaultMarker}\n`);
    });

    const answer = await askLine(rl, 'Enter comma-separated choices, "none", or press Enter for recommended [1]: ');
    const parsed = parseMultiselectAnswer(answer, OPTIONAL_FILE_OPTIONS, ['overview']);

    if (!parsed.valid) {
      failedAttempts += 1;
      if (failedAttempts >= 3) {
        throw new InitError('Too many invalid attempts for Q7. Dflow init aborted.');
      }
      stderr.write(`${parsed.message} (${3 - failedAttempts} attempts left)\n`);
      continue;
    }

    return parsed.values;
  }
}

async function askAiAgents(rl, stdout, stderr, defaultKeys = []) {
  let failedAttempts = 0;
  const validDefaults = AI_AGENT_OPTIONS
    .filter((option) => defaultKeys.includes(option.key))
    .map((option) => option.key);

  while (true) {
    stdout.write('\nWhich AI coding agents should Dflow configure?\n');
    AI_AGENT_OPTIONS.forEach((option, index) => {
      const marker = validDefaults.includes(option.key) ? '  (currently configured)' : '';
      stdout.write(`  ${index + 1}. ${option.label}${marker}\n`);
    });

    const defaultHint = validDefaults.length > 0
      ? validDefaults.map((key) => AI_AGENT_OPTIONS.findIndex((option) => option.key === key) + 1).join(',')
      : 'none';
    const answer = await askLine(rl, `Enter comma-separated choices or "none" (default: ${defaultHint}): `);
    const parsed = parseMultiselectAnswer(answer, AI_AGENT_OPTIONS, validDefaults);

    if (!parsed.valid) {
      failedAttempts += 1;
      if (failedAttempts >= 3) {
        throw new InitError('Too many invalid attempts for Q8. Dflow init aborted.');
      }
      stderr.write(`${parsed.message} (${3 - failedAttempts} attempts left)\n`);
      continue;
    }

    return parsed.values;
  }
}

function askLine(rl, prompt) {
  return getLinePrompter(rl).ask(prompt);
}

function getLinePrompter(rl) {
  if (!rl._dflowPrompter) {
    rl._dflowPrompter = new LinePrompter(rl);
  }
  return rl._dflowPrompter;
}

class LinePrompter {
  constructor(rl) {
    this.rl = rl;
    this.queue = [];
    this.waiting = [];
    this.closed = false;

    if (rl.input && typeof rl.input.resume === 'function') {
      rl.input.resume();
    }

    rl.on('line', (line) => {
      const waiter = this.waiting.shift();
      if (waiter) {
        waiter.resolve(line);
      } else {
        this.queue.push(line);
      }
    });

    rl.on('close', () => {
      this.closed = true;
      while (this.waiting.length > 0) {
        this.waiting.shift().reject(new UserAbort());
      }
    });

    rl.on('SIGINT', () => {
      while (this.waiting.length > 0) {
        this.waiting.shift().reject(new UserAbort());
      }
    });
  }

  ask(prompt) {
    if (prompt) {
      this.rl._dflowOutput.write(prompt);
    }

    if (this.queue.length > 0) {
      return Promise.resolve(this.queue.shift());
    }

    if (this.closed) {
      return Promise.reject(new UserAbort());
    }

    return new Promise((resolve, reject) => {
      const keepAlive = setInterval(() => {}, 2147483647);
      this.waiting.push({
        resolve: (line) => {
          clearInterval(keepAlive);
          resolve(line);
        },
        reject: (error) => {
          clearInterval(keepAlive);
          reject(error);
        }
      });
    });
  }
}

async function askConfirmation(rl, prompt) {
  const answer = (await askLine(rl, prompt)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

// PROPOSAL-074: dedicated default-yes contract for the skill-install question.
// askConfirmation treats blank as false (final-confirmation semantics), so reusing
// it under a `(Y/n)` prompt would invert the advertised default.
async function askYesNoDefaultYes(rl, prompt) {
  const answer = (await askLine(rl, prompt)).trim().toLowerCase();
  return answer === '' || answer === 'y' || answer === 'yes';
}

// PROPOSAL-074: the project-level skill installs by default. Ask only on an
// interactive terminal; a non-TTY run never consumes a stdin slot — existing piped
// answer sequences end with the final confirmation `y`, and a new question before
// it would swallow that `y` and turn the run into a silent no-op abort — so
// non-TTY installs by default without reading stdin.
async function resolveSkillInstall(rl, stdout, interactive, hasSkillTargets) {
  if (!hasSkillTargets) {
    return false;
  }

  if (!interactive) {
    return true;
  }

  const install = await askYesNoDefaultYes(
    rl,
    '\nInstall the project-level Dflow skill for natural-language auto-trigger? (Y/n) '
  );
  if (!install) {
    stdout.write('Skipped the project-level skill; add it later with `dflow configure-agents --skills`.\n');
  }
  return install;
}

function parseSelectAnswer(answer, options, defaultKey) {
  const trimmed = answer.trim();
  if (!trimmed && defaultKey) {
    return defaultKey;
  }

  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= options.length) {
    return options[numeric - 1].key;
  }

  const normalized = normalizeAnswer(trimmed);
  for (const option of options) {
    if (
      normalizeAnswer(option.key) === normalized ||
      normalizeAnswer(option.label) === normalized ||
      option.aliases.some((alias) => normalizeAnswer(alias) === normalized)
    ) {
      return option.key;
    }
  }

  return null;
}

function parseMultiselectAnswer(answer, options, defaultKeys) {
  const trimmed = answer.trim();
  if (!trimmed) {
    return { valid: true, values: [...defaultKeys] };
  }

  if (normalizeAnswer(trimmed) === 'none') {
    return { valid: true, values: [] };
  }

  const tokens = trimmed.includes(',') ? trimmed.split(',') : trimmed.split(/\s+/);
  const selected = [];

  for (const token of tokens) {
    const selectedKey = parseSelectAnswer(token, options, null);
    if (!selectedKey) {
      return { valid: false, message: `Invalid selection: ${token}` };
    }
    if (!selected.includes(selectedKey)) {
      selected.push(selectedKey);
    }
  }

  return { valid: true, values: selected };
}

function validateProseLanguage(value) {
  const trimmed = String(value || '').trim();
  const normalized = normalizeAnswer(trimmed);

  if (!trimmed) {
    return { valid: false, message: 'Prose language is required.' };
  }

  if (INVALID_PROSE_LANGUAGE_VALUES.has(normalized)) {
    return { valid: false, message: `Prose language must be an explicit BCP-47 tag, not "${trimmed}".` };
  }

  if (!PROSE_LANGUAGE_PATTERN.test(trimmed)) {
    return { valid: false, message: `Invalid BCP-47 language tag: ${trimmed}` };
  }

  return { valid: true };
}

async function buildFilePlan(cwd, answers) {
  const substitution = buildSubstitutionMap(cwd, answers);
  const items = [];

  const addGenerated = (relativePath, notes) => {
    items.push({
      relativePath,
      source: 'generated empty file',
      notes,
      content: ''
    });
  };

  const addTemplate = async (relativePath, sourceRel, notes, options = {}) => {
    let content = await readPackagedTemplate(answers.edition, sourceRel);
    content = substitutePlaceholders(content, substitution);
    if (options.injectProseLanguage) {
      content = ensureProseLanguageSection(content, answers.proseLanguage);
      content = ensureConventionPolicySections(content, answers);
    }
    items.push({
      relativePath,
      source: `packaged:${answers.edition}/${sourceRel}`,
      notes,
      content
    });
  };

  addGenerated('dflow/specs/features/active/.gitkeep', 'mandatory');
  addGenerated('dflow/specs/features/completed/.gitkeep', 'mandatory');
  addGenerated('dflow/specs/features/backlog/.gitkeep', 'mandatory');

  await addTemplate('dflow/specs/shared/_conventions.md', 'scaffolding/_conventions.md', 'mandatory, includes Prose Language', {
    injectProseLanguage: true
  });
  await addTemplate('dflow/specs/domain/glossary.md', 'templates/glossary.md', 'mandatory');

  if (answers.edition === 'greenfield') {
    await addTemplate('dflow/specs/domain/context-map.md', 'templates/context-map.md', 'mandatory');
    await addTemplate('dflow/specs/architecture/tech-debt.md', 'templates/tech-debt.md', 'mandatory');
    await addTemplate(
      'dflow/specs/architecture/decisions/README.md',
      'scaffolding/architecture-decisions-README.md',
      'mandatory'
    );
  } else {
    await addTemplate('dflow/specs/migration/tech-debt.md', 'templates/tech-debt.md', 'mandatory');
  }

  if (answers.optionalFiles.includes('overview')) {
    await addTemplate('dflow/specs/shared/_overview.md', 'scaffolding/_overview.md', 'selected');
  }

  // PROPOSAL-047: the selected Git policy is mandatory — always project exactly
  // the matching Git-principles file so the runtime branch gates have a policy.
  if (answers.gitPolicy === 'gitflow') {
    await addTemplate('dflow/specs/shared/Git-principles-gitflow.md', 'scaffolding/Git-principles-gitflow.md', 'mandatory, selected Git policy');
  } else {
    await addTemplate('dflow/specs/shared/Git-principles-trunk.md', 'scaffolding/Git-principles-trunk.md', 'mandatory, selected Git policy');
  }

  // PROPOSAL-054: agent-shim auto-inject can emit fallback warnings (marker
  // conflict). init previously never plumbed these — buildConfigureAgentsPlan had
  // a warnings accumulator but buildFilePlan did not — so a fallback during init
  // was silent. Collect them here and surface them in runInit alongside the
  // preflight / detection / bundle warnings.
  const warnings = [];
  if (answers.aiAgents.length > 0) {
    await addTemplate('dflow/specs/shared/AI-AGENT-GUIDE.md', 'scaffolding/AI-AGENT-GUIDE.md', 'selected, canonical AI agent guide');
    for (const agent of answers.aiAgents) {
      await addAiAgentShim(cwd, items, agent, substitution, { warnings });
    }
  }

  await finalizePlanItems(cwd, items);

  // PROPOSAL-074: init projects the project-level skill by default; answers.skills
  // carries the Q-flow / non-TTY resolution from runInit (absent = false, which
  // keeps buildFilePlan backward-compatible for direct callers).
  await addSkillAdapterItems(cwd, items, answers.aiAgents, answers.skills, warnings);

  // Always project the workflow bundle (required for /dflow:* workflows to be reachable).
  const bundleWarnings = [];
  await addWorkflowBundleItems(cwd, items, bundleWarnings, answers.edition);

  return {
    items,
    deferred: buildDeferredItems(answers.edition),
    bundleWarnings,
    warnings,
    unresolvedInitPlaceholders: Array.from(substitution.entries())
      .filter(([placeholder, value]) => placeholder === value)
      .map(([placeholder]) => placeholder)
  };
}

async function buildConfigureAgentsPlan(cwd, answers) {
  const substitution = buildSubstitutionMap(cwd, {
    ...answers,
    optionalFiles: answers.optionalFiles || []
  });
  const items = [];
  const warnings = [];

  let packagedGuide = await readPackagedTemplate(answers.edition, 'scaffolding/AI-AGENT-GUIDE.md');
  packagedGuide = substitutePlaceholders(packagedGuide, substitution);
  await addCanonicalGuideItem(cwd, items, warnings, packagedGuide, answers);

  const commandRegistry = answers.commandAdapters ? parseDflowCommandRegistry(packagedGuide) : [];

  for (const agent of answers.aiAgents) {
    await addAiAgentShim(cwd, items, agent, substitution, {
      commandRegistry,
      warnings,
      adoptShimAgents: answers.adoptShimAgents || []
    });
  }

  if (answers.commandAdapters) {
    addCommandAdapterItems(items, answers.aiAgents, commandRegistry);
  }

  await finalizePlanItems(cwd, items);

  if (answers.commandAdapters) {
    await addLegacyCommandAdapterCleanupItems(cwd, items, answers.aiAgents, warnings);
  }

  // PROPOSAL-074: skillAgents is the projection subset — all selected agents under
  // --skills, only the missing ones on a flagless default install (existing skills
  // are never regenerated without the flag).
  const skillAgents = answers.skillAgents || (answers.skills ? answers.aiAgents : []);
  await addSkillAdapterItems(cwd, items, skillAgents, skillAgents.length > 0, warnings);

  // Project the workflow bundle on configure-agents too, so pre-039 projects (no bundle)
  // and edition-switch repairs get the runtime references/templates reachable. The function
  // is idempotent: it skips fresh bundle files, updates Dflow-generated ones, and warns
  // (without overwriting) on user-modified bundle files.
  const bundleWarnings = [];
  await addWorkflowBundleItems(cwd, items, bundleWarnings, answers.edition);
  warnings.push(...bundleWarnings);

  // Last plan item on purpose: the write phase runs in plan order and aborts on
  // the first failure, so the last-reconciled version line only advances when
  // everything this run re-projects was written. Guarded skips do not abort the
  // write phase, so the item additionally carries requiresFullApply — the write
  // phase drops it (with a warning) when any earlier planned change was skipped
  // unexpectedly (changed after preview, vanished target, unexpected existing
  // target).
  await addConventionsVersionReconcileItem(cwd, items);

  return {
    items,
    deferred: [],
    warnings,
    unresolvedInitPlaceholders: Array.from(substitution.entries())
      .filter(([placeholder, value]) => placeholder === value)
      .map(([placeholder]) => placeholder)
  };
}

async function finalizePlanItems(cwd, items) {
  for (const item of items) {
    // PROPOSAL-054: items whose action was already decided at plan time from the
    // existing file content (root agent-file append / replace / skip / fallback)
    // must not be re-derived from overwrite+existence here — that would discard
    // the marked-region decision. Just make sure size is populated.
    if (item.action) {
      if (item.size === undefined) {
        item.size = Buffer.byteLength(item.content || '', 'utf8');
      }
      continue;
    }
    const absolute = path.join(cwd, item.relativePath);
    const targetExists = await pathExists(absolute);
    item.action = targetExists ? (item.overwrite ? 'update' : 'skip') : 'create';
    if (item.action === 'skip') {
      item.notes = item.notes ? `${item.notes}, already exists` : 'already exists';
    }
    item.size = Buffer.byteLength(item.content, 'utf8');
  }
}

// A workflow bundle file name must be unique across the common and edition
// source trees, so the merged dest path / manifest entry never collide or
// shadow each other. Pure (no I/O) so it is unit-testable on a synthetic list.
function assertNoBundleCollision(files) {
  // Keyed case-INSENSITIVELY. The merged set is projected onto the adopter's
  // filesystem, where Windows and default macOS treat `Foo.md` and `foo.md` as
  // one path: two source trees differing only in case would ship two logical
  // files that overwrite each other there, while an exact-match key reports no
  // collision at all. A case-sensitive dev checkout or CI can create that pair,
  // so the guard cannot rely on the authoring filesystem to prevent it.
  // Case-folded and NFC-normalised. ⚠ The guard's two halves have DIFFERENT
  // reach, and collapsing them into one sentence has produced a wrong comment
  // twice — once claiming adopters are protected everywhere, once claiming the
  // guard is silent everywhere. Both were generalised from a probe that only
  // covered one half. Measured on a case-insensitive (Windows) host:
  //
  //   * CROSS-ROOT pair (templates/common/… vs templates/{edition}/…) — the two
  //     files sit in DIFFERENT directories, so both spellings exist on any
  //     filesystem. readdir yields a descriptor from each root and this guard
  //     throws before anything is projected. Probe: common/x.md + greenfield/X.md
  //     both present, guard fires. Real runtime protection, Windows included,
  //     and the case this guard mainly exists for.
  //   * SAME-TREE pair (two spellings in ONE directory) — reach depends on WHICH
  //     axis differs, because the key folds two of them and filesystems do not
  //     treat them alike:
  //
  //       axis \ host   | Linux (case-sens, norm-sens) | Windows (case-INsens, norm-SENS) | macOS default (both INsens)
  //       case pair     | coexists -> canary           | collapses -> silent              | collapses -> silent
  //       NFD/NFC pair  | coexists -> canary           | COEXISTS -> guard fires          | collapses -> silent
  //
  //     Probes on Windows: `Foo.md` then `foo.md` leaves readdir count=1 (and
  //     the FIRST name survives carrying the SECOND write's content); an
  //     NFD/NFC pair leaves count=2 and this guard throws. NTFS is
  //     case-insensitive but normalization-SENSITIVE — so the normalisation is
  //     not defensive dressing, it is the one axis with runtime reach here.
  //     ⚠ The macOS column is inference from documented APFS/HFS+ behaviour,
  //     not measured; the other two columns are measured on this host.
  //
  // Guarding the source filenames themselves — OS-special forms such as a
  // Windows ADS `name.md:stream` — is a wider job, filed as
  // `bundle-name-validity` in planning/opt-in-backlog.md.
  //
  // The real key set is ASCII today, which is exactly why the normalisation has
  // to be written here rather than assumed.
  const seenBy = new Map();
  for (const f of files) {
    const key = f.sourceRel.normalize('NFC').toLowerCase();
    const prior = seenBy.get(key);
    // Two spellings collide REGARDLESS of which tree they came from. Keying on
    // sourceRoot alone would miss the same hazard inside one tree — two files
    // in templates/common/ differing only in case are equally one path on the
    // adopter's filesystem, and would project two manifest entries onto it.
    if (prior && (prior.sourceRoot !== f.sourceRoot || prior.sourceRel !== f.sourceRel)) {
      const where = prior.sourceRoot === f.sourceRoot
        ? `twice in templates/${f.sourceRoot}/ (as "${prior.sourceRel}" and "${f.sourceRel}")`
        : prior.sourceRel === f.sourceRel
          ? `in both templates/${prior.sourceRoot}/ and templates/${f.sourceRoot}/`
          : `in both templates/${prior.sourceRoot}/ (as "${prior.sourceRel}") and templates/${f.sourceRoot}/ (as "${f.sourceRel}")`;
      throw new InitError(
        `Internal error: workflow bundle file "${f.sourceRel}" exists ${where}. A bundle file name must be unique across the common and edition source trees — compared case-insensitively, because the projected destination lands on filesystems that treat "Foo.md" and "foo.md" as one path.`
      );
    }
    seenBy.set(key, f);
  }
}

// R3-02 (sharpened for the PROPOSAL-064 common merge): the EDITION tree itself
// must contribute both the flow docs (references/) and the blank templates
// (templates/) — the common tree must NOT mask a broken edition (a vanished
// templates/{edition}/references/ would otherwise be hidden by common's
// non-empty references/). Enforced in the scanner (not only the projector) so
// BOTH callers are covered: the projector hard-fails, and doctor skips the orphan
// scan rather than mis-reporting every projected flow file as orphaned.
// ⚠ That skip is no longer SILENT, and this sentence used to read as permission for
// it to be: doctor now also emits a `warn` naming the broken install
// (see checkWorkflowBundleSourceAndOrphans). A maintainer who restores a bare
// `catch { return; }` on the strength of "degrades gracefully" reintroduces the
// exact false-clean this repo spent four review rounds closing. Pure (no I/O) so it
// is unit-testable on a synthetic list.
function assertEditionBundleComplete(files, edition) {
  const hasEditionRefs = files.some((f) => f.sourceRoot === edition && f.dir === 'references');
  const hasEditionTemplates = files.some((f) => f.sourceRoot === edition && f.dir === 'templates');
  if (!hasEditionRefs || !hasEditionTemplates) {
    throw new InitError(
      `Internal error: incomplete workflow bundle source for edition "${edition}" (expected files under both templates/${edition}/references/ and templates/${edition}/templates/). The installed dflow package looks incomplete.`
    );
  }
}

// Companion to assertEditionBundleComplete for the common tree: every file the
// common bundle MUST provide has to be present. A common file silently missing
// (broken package / tarball) would otherwise slip through as a smaller-but-valid
// set and, on re-projection, be DELETED from the user's project by stale-removal
// (the manifest diff would classify the still-installed copy as "retired").
// Hard-fail here, before stale cleanup / manifest write. Pure (no I/O) so it is
// unit-testable on a synthetic list.
function assertCommonBundleComplete(files) {
  const present = new Set(files.filter((f) => f.sourceRoot === 'common').map((f) => f.sourceRel));
  for (const required of REQUIRED_COMMON_BUNDLE_FILES) {
    if (!present.has(required)) {
      throw new InitError(
        `Internal error: missing required common workflow bundle file templates/common/${required}. The installed dflow package looks incomplete.`
      );
    }
  }
}

// Bundle source files come from two trees, merged: the edition-neutral common
// tree (templates/common/, PROPOSAL-064) and the per-edition tree
// (templates/{edition}/). Each descriptor carries its sourceRoot so the reader
// (readPackagedBundleFile) loads content from the right tree; the projected dest
// path and the manifest stay keyed on sourceRel, so a common-sourced file lands
// at the same dflow/.../references/<name> path in every edition. The scanner
// validates the merged set (collision + complete-edition guards) before
// returning, so both callers (projector, doctor) get a trustworthy list.
async function scanBundleSourceRoot(sourceRoot) {
  const files = [];
  for (const dir of ['references', 'templates']) {
    const sourceDir = path.join(TEMPLATE_ROOT, sourceRoot, dir);
    let entries;
    try {
      entries = await fs.readdir(sourceDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry);
      const stat = await fs.stat(sourcePath);
      if (stat.isFile()) {
        files.push({ sourceRel: `${dir}/${entry}`, dir, name: entry, sourceRoot });
      }
    }
  }
  return files;
}

async function listBundleSourceFiles(edition) {
  // Order is preserved from when this was one nested loop over
  // ['common', edition] x ['references', 'templates'] — the extraction is
  // mechanical, and callers that key on array order see no change.
  const files = [
    ...(await scanBundleSourceRoot('common')),
    ...(await scanBundleSourceRoot(edition))
  ];

  assertNoBundleCollision(files);
  assertEditionBundleComplete(files, edition);
  assertCommonBundleComplete(files);
  return files;
}

const BUNDLE_EDITIONS = Object.freeze(['greenfield', 'brownfield']);

// Reads the per-project workflow bundle manifest, distinguishing "absent"
// (normal: fresh init / first projection) from "corrupt" (unreadable or invalid
// shape). A corrupt manifest must NOT be treated as absent: that would silently
// disable stale cleanup and then overwrite the (recoverable) record. Callers
// degrade on corrupt — skip cleanup, skip the manifest write, still project —
// rather than hard-fail, because a corrupt project manifest is a user-project
// state, not a broken package. An empty `files: []` is a valid manifest.
async function readCurrentBundleManifest(cwd) {
  const manifestPath = path.join(cwd, WORKFLOW_BUNDLE_MANIFEST_PATH);
  let raw;
  try {
    raw = await fs.readFile(manifestPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { kind: 'absent' };
    }
    return { kind: 'corrupt', reason: `cannot read manifest (${error.code || error.message})` };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt', reason: 'manifest is not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'corrupt', reason: 'manifest is not a JSON object' };
  }
  if (!Array.isArray(parsed.files) || !parsed.files.every((entry) => typeof entry === 'string')) {
    return { kind: 'corrupt', reason: 'manifest "files" is not an array of strings' };
  }
  return { kind: 'ok', manifest: parsed };
}

// True when a manifest `files` entry is a canonical, in-bundle, traversal-free
// relative path. Manifest entries are produced canonically; a non-canonical
// entry (hand-edited / corrupt manifest, e.g. one containing "..") is NOT acted
// on, because (a) it cannot be reliably string-matched against the current
// bundle set — so a path that *resolves* to a current file would otherwise be
// scheduled for removal — and (b) it drives an unlink. Verifying canonical form
// up front both blocks traversal and makes the newRelPaths string compare
// reliable.
function isCanonicalBundlePath(relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) return false;
  if (relPath.includes('\\')) return false;
  if (path.posix.normalize(relPath) !== relPath) return false;
  const prefix = `${WORKFLOW_BUNDLE_DEST}/`;
  return relPath.startsWith(prefix) && relPath.length > prefix.length;
}

function buildBundleManifest(edition, version, files) {
  return {
    edition,
    version,
    generatedBy: 'dflow-sdd-ddd',
    files: files.map((f) => `${WORKFLOW_BUNDLE_DEST}/${f.sourceRel}`)
  };
}

function injectBundleMarker(content) {
  return `${WORKFLOW_BUNDLE_GENERATED_MARKER}\n\n${content}`;
}

async function addWorkflowBundleItems(cwd, items, warnings, edition) {
  // listBundleSourceFiles merges templates/common/ + templates/{edition}/ and
  // validates the merged set (collision + complete-edition guards) before
  // returning, so the projector can trust a complete set here. A broken package
  // throws (InitError) before any stale removal or manifest write.
  const bundleFiles = await listBundleSourceFiles(edition);

  const newRelPaths = new Set(bundleFiles.map((f) => `${WORKFLOW_BUNDLE_DEST}/${f.sourceRel}`));

  // Read the previous manifest to drive stale cleanup. Distinguish absent
  // (normal) from corrupt (degrade): on corrupt, skip cleanup AND skip the
  // manifest write below — never hard-fail, since a corrupt project manifest is
  // a user-project state (the package may be healthy and the user may be running
  // configure-agents precisely to repair / update).
  const manifestResult = await readCurrentBundleManifest(cwd);
  const manifestCorrupt = manifestResult.kind === 'corrupt';
  if (manifestCorrupt) {
    warnings.push(
      `Workflow bundle manifest is unreadable (${manifestResult.reason}); skipped stale cleanup and left the manifest untouched. Delete ${WORKFLOW_BUNDLE_MANIFEST_PATH} and re-run to rebuild it.`
    );
  }
  const existingManifest = manifestResult.kind === 'ok' ? manifestResult.manifest : null;

  // Stale removal (generalized from edition-change-only to a manifest diff):
  // remove any path the previous manifest recorded but the current bundle source
  // no longer includes. Edition change is just the case where the whole old set
  // differs; a same-edition file-set shrink (e.g. a retired bundle file) is
  // handled identically. The marker check (here) + content re-check (apply
  // phase) still guard against deleting user-modified files.
  if (existingManifest) {
    const previousEdition = existingManifest.edition;
    const editionChanged = Boolean(previousEdition) && previousEdition !== edition;
    for (const staleRelPath of existingManifest.files) {
      // Act only on canonical, in-bundle, traversal-free entries. A
      // non-canonical entry (hand-edited / corrupt manifest) is skipped: acting
      // on it would make the newRelPaths string compare unreliable (a path that
      // resolves to a current bundle file could be scheduled for removal) and it
      // drives an unlink. Checked FIRST so the membership compare below is sound.
      if (!isCanonicalBundlePath(staleRelPath)) {
        warnings.push(
          `Ignored non-canonical workflow bundle manifest path: ${staleRelPath}`
        );
        continue;
      }
      // Still a current bundle file → it will be updated, not removed.
      if (newRelPaths.has(staleRelPath)) {
        continue;
      }
      const staleAbsPath = path.join(cwd, staleRelPath);
      let staleStat = null;
      try {
        staleStat = await fs.stat(staleAbsPath);
      } catch {
        staleStat = null;
      }
      if (!staleStat) {
        continue;
      }
      // A non-file entry (e.g. a directory path in a hand-edited / corrupt
      // manifest) must degrade gracefully, not crash readFile with EISDIR.
      if (!staleStat.isFile()) {
        warnings.push(`Ignored non-file workflow bundle manifest entry: ${staleRelPath}`);
        continue;
      }
      const staleContent = await fs.readFile(staleAbsPath, 'utf8');
      if (!staleContent.includes(WORKFLOW_BUNDLE_GENERATED_MARKER)) {
        warnings.push(
          `Retired workflow bundle file is user-modified; left unchanged: ${staleRelPath}`
        );
        continue;
      }
      items.push({
        relativePath: staleRelPath,
        source: editionChanged ? `stale-bundle:${previousEdition}` : 'stale-bundle:retired',
        notes: editionChanged
          ? `stale workflow bundle file from ${previousEdition} edition`
          : 'retired workflow bundle file no longer in the package source',
        action: 'remove',
        size: Buffer.byteLength(staleContent, 'utf8'),
        expectedContent: staleContent
      });
    }
  }

  // Build items for current edition bundle files.
  for (const { sourceRel, sourceRoot } of bundleFiles) {
    const relativePath = `${WORKFLOW_BUNDLE_DEST}/${sourceRel}`;
    const absolutePath = path.join(cwd, relativePath);
    const sourceContent = await readPackagedBundleFile(sourceRoot, sourceRel);
    const content = injectBundleMarker(sourceContent);

    let action;
    let notes = 'workflow bundle';
    const targetExists = await pathExists(absolutePath);

    if (targetExists) {
      const existingContent = await fs.readFile(absolutePath, 'utf8');
      if (existingContent.includes(WORKFLOW_BUNDLE_GENERATED_MARKER)) {
        action = 'update';
      } else {
        action = 'skip';
        notes = 'workflow bundle, user-modified — skipped; remove or rename to let Dflow manage';
        warnings.push(
          `Existing ${relativePath} is not a Dflow-generated bundle file; left unchanged. Remove or rename it to let Dflow manage this file.`
        );
      }
    } else {
      action = 'create';
    }

    items.push({
      relativePath,
      source: `packaged-bundle:${sourceRoot}/${sourceRel}`,
      notes,
      content,
      action,
      overwrite: action === 'update',
      size: Buffer.byteLength(content, 'utf8')
    });
  }

  // Add the manifest file — unless the existing manifest is corrupt, in which
  // case leave it untouched (overwriting would destroy the only recoverable
  // record and silently recreate the manifest-orphan problem).
  if (!manifestCorrupt) {
    const manifestContent = JSON.stringify(
      buildBundleManifest(edition, pkg.version, bundleFiles),
      null,
      2
    ) + '\n';
    const manifestExists = await pathExists(path.join(cwd, WORKFLOW_BUNDLE_MANIFEST_PATH));

    items.push({
      relativePath: WORKFLOW_BUNDLE_MANIFEST_PATH,
      source: `generated:workflow-bundle-manifest`,
      notes: 'workflow bundle manifest',
      content: manifestContent,
      action: manifestExists ? 'update' : 'create',
      overwrite: true,
      size: Buffer.byteLength(manifestContent, 'utf8')
    });
  }
}

// Reads one bundle file's content from its source tree. sourceRoot is the
// descriptor's tree ('common' or an edition) so a common-sourced file is read
// from templates/common/, not templates/{edition}/ (PROPOSAL-064). The traversal
// guard is re-rooted at templates/${sourceRoot}/ accordingly.
async function readPackagedBundleFile(sourceRoot, sourceRel) {
  const filePath = path.join(TEMPLATE_ROOT, sourceRoot, sourceRel);
  const normalizedRoot = path.resolve(TEMPLATE_ROOT, sourceRoot);
  const normalizedFilePath = path.resolve(filePath);

  if (!normalizedFilePath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new InitError(`Internal error: packaged bundle file not found: templates/${sourceRoot}/${sourceRel}`);
  }

  let buffer;
  try {
    buffer = await fs.readFile(normalizedFilePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new InitError(`Internal error: packaged bundle file not found: templates/${sourceRoot}/${sourceRel}`);
    }
    throw new InitError(`Internal error: cannot read packaged bundle file: templates/${sourceRoot}/${sourceRel}`);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new InitError(`Internal error: invalid UTF-8 packaged bundle file: templates/${sourceRoot}/${sourceRel}`);
  }
}

// PROPOSAL-058: the canonical AI agent guide is user-owned (it embeds the
// project's "## Project Context"), but most of its body is Dflow-canonical
// content that upgrades must be able to refresh — a guide frozen at its init
// version leaves the re-projected workflow bundle § referencing sections the
// guide does not have. The packaged template wraps the canonical body in
// guide-canonical START/END markers. Decision table for an existing guide
// (user decision 2026-06-08: skip + warn + offer; never rewrite unasked):
//   - well-formed markers        -> replace the marked region in place (idempotent)
//   - no markers, recognizable   -> skip + warn, and flag the item so an
//     interactive run can offer marker adoption. Adoption replaces everything
//     outside "## Project Context" with this version's canonical guide content;
//     it is consent-gated because historical canonical text cannot be verified
//     against the current package — only the user knows whether they customized
//     sections outside Project Context.
//   - no markers, unrecognizable -> skip + warn
//   - malformed marker pair      -> skip + warn (never guess)
async function addCanonicalGuideItem(cwd, items, warnings, packagedGuide, answers) {
  const source = `packaged:${answers.edition}/scaffolding/AI-AGENT-GUIDE.md`;
  const guidePath = path.join(cwd, AI_AGENT_GUIDE_DEST);

  if (!(await pathExists(guidePath))) {
    items.push({
      relativePath: AI_AGENT_GUIDE_DEST,
      source,
      notes: 'canonical AI agent guide',
      content: packagedGuide
    });
    return;
  }

  const packagedRegion = classifyMarkedRegion(
    packagedGuide,
    GUIDE_CANONICAL_SECTION_START,
    GUIDE_CANONICAL_SECTION_END
  );
  if (packagedRegion.state !== 'present') {
    throw new InitError('Internal error: packaged AI-AGENT-GUIDE.md has no well-formed guide-canonical markers.');
  }

  const existingContent = await fs.readFile(guidePath, 'utf8');
  const eol = detectDominantEol(existingContent);
  const lf = toLf(existingContent);
  const region = classifyMarkedRegion(lf, GUIDE_CANONICAL_SECTION_START, GUIDE_CANONICAL_SECTION_END);

  const skipItem = (notes) => {
    items.push({
      relativePath: AI_AGENT_GUIDE_DEST,
      source,
      notes,
      content: packagedGuide,
      action: 'skip',
      intentionalSkip: true,
      size: Buffer.byteLength(packagedGuide, 'utf8')
    });
  };

  if (region.state === 'present') {
    const refreshed =
      lf.slice(0, region.startIdx) +
      packagedGuide.slice(packagedRegion.startIdx, packagedRegion.endIdx) +
      lf.slice(region.endIdx);
    pushRootInjectItem(items, {
      relativePath: AI_AGENT_GUIDE_DEST,
      source,
      notes: 'refreshed Dflow-canonical guide content (content outside the markers kept)',
      content: applyEol(refreshed, eol),
      expectedContent: existingContent
    });
    return;
  }

  if (region.state === 'malformed') {
    warnings.push(
      `Existing ${AI_AGENT_GUIDE_DEST} contains malformed guide-canonical markers; left it untouched. Repair or remove the stray markers and re-run so Dflow can refresh the canonical content.`
    );
    skipItem('canonical AI agent guide, malformed guide-canonical markers; left untouched');
    return;
  }

  if (isRecognizableDflowGuide(lf)) {
    if (answers.adoptGuideMarkers) {
      pushRootInjectItem(items, {
        relativePath: AI_AGENT_GUIDE_DEST,
        source,
        notes: 'adopted guide-canonical markers (kept your "## Project Context" section)',
        content: applyEol(transplantProjectContext(packagedGuide, lf), eol),
        expectedContent: existingContent
      });
      return;
    }
    warnings.push(
      `${AI_AGENT_GUIDE_DEST} predates Dflow's guide-canonical markers, so its canonical sections stay at the Dflow version that wrote them. Re-run \`dflow configure-agents\` on an interactive terminal and accept the marker-adoption offer, or reconcile manually against a fresh \`dflow init\`.`
    );
    const item = 'canonical AI agent guide, no guide-canonical markers; left untouched';
    skipItem(item);
    items[items.length - 1].offerGuideAdoption = true;
    return;
  }

  warnings.push(
    `Existing ${AI_AGENT_GUIDE_DEST} is not recognizable as a Dflow guide; left it untouched.`
  );
  skipItem('canonical AI agent guide, not recognizable as a Dflow guide; left untouched');
}

// Fence-aware, and deliberately the same predicate transplantProjectContext
// relies on: recognizability must imply locatable Project Context bounds, or
// an accepted adoption offer would abort on the internal error below
// (PROPOSAL-076 gate G3 — a guide whose only "## Project Context" heading sat
// inside a fenced example was offered adoption and then crashed the run).
// \u26A0 The title test compares the heading TEXT the shared classification produces,
// rather than matching the raw line. That closes the last hand-rolled heading
// rule outside `doctor-checks.js`, and it moves the behaviour twice, in opposite
// directions \u2014 both deliberate, both pinned:
//   - WIDER: a 0-3 space indent is a heading to CommonMark, and this line now
//     accepts one. The old `^#` refused it while `projectContextSectionBounds`
//     one function below already allowed it, so a guide indented by one space
//     had a locatable Project Context and an unrecognizable title \u2014 the two
//     halves of this very expression disagreeing.
//   - NARROWER: the old `\s*$` also tolerated a trailing U+00A0 / form feed /
//     vertical tab. CommonMark strips only spaces and tabs, so such a title is
//     genuinely a different heading, and it is now reported as unrecognizable
//     instead of being silently accepted. That direction is safe by
//     construction: the caller's response to "not recognizable" is a warning
//     plus leaving the user's file untouched, which is a loud, actionable
//     failure rather than a silent rewrite of a file we misread.
function isRecognizableDflowGuide(lfContent) {
  const content = lfContent.replace(/^\uFEFF/, ''); // a BOM must not defeat the title line (gate G4)
  const scan = doctorChecks.blankFencedBlocks(content);
  const titled = doctorChecks.classifyLines(scan)
    .some((c) => c.heading && c.heading.level === 1 && c.heading.text === 'Dflow AI Agent Guide');
  return titled && projectContextSectionBounds(content) !== null;
}

// Bounds of the "## Project Context" section in LF content: the heading line up
// to (exclusive) the next "## " heading, the guide-canonical START marker, or EOF.
// Fence-aware (PROPOSAL-076 gate G1): headings or markers inside ``` / ~~~
// examples are content, not structure — the boundary scan runs on a
// fence-blanked shadow while the returned lines stay the real content.
// \u26A0 Heading detection here goes through `doctorChecks.classifyLines`, and that
// is the point rather than a tidy-up. This function used to hand-roll its own
// ATX rules, which made it a FOURTH place deciding what a heading is; `g5`
// finding 2 caught it a patch behind its siblings \u2014 it had taken the 0-3 space
// indent but not the "space or tab after the hashes" rule, so a bare `##` did
// not end the section and a `| Tech stack |` row below it was read as though it
// were still inside Project Context. Routing it through the classification is
// what makes that class of lag impossible rather than merely fixed once.
//
// Two consequences of using the shared rules, both verified against the
// packaged guides in `test/upgrade-drift.mjs`:
//   - the section now also ends at a LEVEL-1 heading, not only an H2. Both
//     packaged guides carry exactly one H1 and it is line 1, above Project
//     Context, so nothing packaged moves; an adopter's guide with an H1 further
//     down now ends the section there, which is what CommonMark says.
//   - `## Project Context ##` and a setext-underlined `Project Context` are now
//     found, where the old literal test saw neither.
function projectContextSectionBounds(lfContent) {
  const stripped = lfContent.replace(/^\uFEFF/, ''); // keep BOM out of the line-0 heading match (gate G4)
  const lines = stripped.split('\n');
  const scan = doctorChecks.blankFencedBlocks(stripped);
  const info = doctorChecks.classifyLines(scan);
  // ⚠⚠ `heading.start`, NOT the array index. `classifyLines` reports a SETEXT
  // heading at its UNDERLINE line, and carries the real first line in
  // `heading.start`. Using the index here — while this function had just been
  // widened to recognize setext headings at all — meant the returned slice began
  // at the underline: `transplantProjectContext` then dropped the heading text
  // `Project Context`, swallowed the NEXT section's heading text into the kept
  // region, and wrote the result to the user's guide. Re-parsing that output
  // returns null, so the guide becomes permanently unrecognizable and
  // `configure-agents` refuses to touch it again — all behind an interactive
  // offer whose text promises "your Project Context section is kept".
  // CONTENT LOSS, on disk. `conventionsSectionBodies` had this right; this
  // function was widened without taking the same field with it.
  const at = info.findIndex((c) => c.heading && c.heading.level === 2 && c.heading.text === 'Project Context');
  if (at < 0) return null;
  const start = info[at].heading.start;
  let end = scan.length;
  for (let i = at + 1; i < scan.length; i += 1) {
    if (info[i].heading && info[i].heading.level <= 2) {
      end = info[i].heading.start;
      break;
    }
    if (scan[i].startsWith(GUIDE_CANONICAL_SECTION_START)) {
      end = i;
      break;
    }
  }
  return { lines, start, end };
}

// PROPOSAL-058 bootstrap: rebuild the guide from the packaged template, carrying
// over the project's own "## Project Context" section (trailing blank lines normalized; the only
// user-specific region by contract). Everything else — including any prose the
// user kept outside Project Context — is replaced; the interactive offer says so
// and defaults to No.
function transplantProjectContext(packagedGuide, existingLf) {
  const existing = projectContextSectionBounds(existingLf);
  const packaged = projectContextSectionBounds(packagedGuide);
  if (!existing || !packaged) {
    throw new InitError('Internal error: cannot locate "## Project Context" while adopting guide markers.');
  }
  const existingSection = existing.lines.slice(existing.start, existing.end);
  // ⚠ `BLANK_LINE_RE` and not `.trim()`: a line holding only a U+00A0 is NOT
  // blank to CommonMark, and `.trim()` would pop it off the end of a section
  // this function is about to write back to a user-owned file.
  // ⚠ Imported rather than written inline. The first fix here spelled
  // `/^[ \t]*$/` by hand, which made it a THIRD copy of the rule while the
  // commit message claimed there were only two — the same "two expressions, one
  // rule" shape the whole rewrite exists to remove.
  while (existingSection.length > 0
    && doctorChecks.BLANK_LINE_RE.test(existingSection[existingSection.length - 1])) {
    existingSection.pop();
  }
  return [
    ...packaged.lines.slice(0, packaged.start),
    ...existingSection,
    '',
    ...packaged.lines.slice(packaged.end)
  ].join('\n');
}

// PROPOSAL-058: the interactive adoption questions. Only a TTY run ever asks
// (the PROPOSAL-074 non-TTY contract: never consume a stdin slot); blank answers
// mean No because both offers rewrite a user-owned file.
async function askGuideMarkerAdoption(rl, stdout) {
  stdout.write(
    `\nYour ${AI_AGENT_GUIDE_DEST} predates Dflow's managed canonical markers, so\n` +
    'upgrades cannot refresh its canonical sections in place. Adopting the markers\n' +
    'replaces everything OUTSIDE "## Project Context" with this Dflow version\'s\n' +
    'canonical guide content (your Project Context section is kept).\n' +
    'Answer N if you customized any other guide section.\n'
  );
  return askConfirmation(rl, 'Adopt the managed guide markers now? (y/N) ');
}

async function askShimBlockAdoption(rl, stdout, agent) {
  const relativePath = getAiAgentTarget(agent).relativePath;
  stdout.write(
    `\n${relativePath} references the Dflow guide but is not Dflow-managed (no markers),\n` +
    'so upgrades cannot refresh any Dflow wording inside it. Dflow can append its\n' +
    'managed, marker-delimited block at the end of the file; afterwards remove any\n' +
    'older Dflow wording you keep above the block.\n'
  );
  return askConfirmation(rl, `Append the managed Dflow block to ${relativePath}? (y/N) `);
}

// PROPOSAL-058 (user decision 2026-06-08, OQ2): `> Dflow Version:` in
// _conventions.md means "the Dflow version this project last reconciled with",
// so a successful configure-agents run must advance it — before this it froze at
// the init version, which was a bug, not a design. Narrow single-line rewrite of
// a user-owned file: previewed like every plan item, guarded by the rootInject
// raw-equality check, and never *added* when the line is absent (doctor reports
// that case instead).
async function addConventionsVersionReconcileItem(cwd, items) {
  const relativePath = 'dflow/specs/shared/_conventions.md';
  const absolute = path.join(cwd, relativePath);
  if (!(await pathExists(absolute))) return;
  const existingContent = await fs.readFile(absolute, 'utf8');
  const lf = toLf(existingContent);
  const match = lf.match(/^> Dflow Version:[ \t]*(.*)$/m);
  if (!match || match[1].trim() === pkg.version) return;
  const eol = detectDominantEol(existingContent);
  const updated = lf.replace(/^> Dflow Version:[ \t]*.*$/m, `> Dflow Version: ${pkg.version}`);
  pushRootInjectItem(items, {
    relativePath,
    source: 'generated:dflow-version-reconcile',
    notes: `update Dflow Version line to ${pkg.version} (last reconciled)`,
    content: applyEol(updated, eol),
    expectedContent: existingContent
  });
  // See the call-site comment: never advance the line over a guarded skip.
  items[items.length - 1].requiresFullApply = true;
}

// PROPOSAL-054: configure a tool's root agent file. A non-guide existing file used
// to be parked as a side merge snippet ("hand-merge this yourself"); it is now an
// auto-injected, marker-delimited Dflow block shown in the confirmation preview.
// The snippet + warning survive only as a genuine-conflict fallback. Decision table
// (read existing file content, then branch):
//   1.  not exists                         -> create marker-free whole-file shim
//   2a. pristine / prior whole-file shim   -> regenerate in place (idempotent / migrate)
//   2b. one well-formed agent-shim block   -> replace that block (idempotent re-run)
//   2c. malformed Dflow markers            -> snippet fallback + warning (file untouched)
//   2d. references guide, not 2a/2b/2c     -> skip base shim (Codex: still upsert trigger, OQ#6c)
//   2e. user-owned, non-guide existing     -> append the marked block(s)  <- core change
// For Codex + --command-adapters the base-shim block and the trigger block are two
// adjacent, independently-marked regions assembled into ONE plan item (per-item
// writes are whole-file, so two items for one path would clobber each other).
async function addAiAgentShim(cwd, items, agent, substitution, options = {}) {
  const target = getAiAgentTarget(agent);
  const targetPath = path.join(cwd, target.relativePath);
  const commandRegistry = options.commandRegistry || [];
  const warnings = options.warnings;
  const isCodex = target.relativePath === 'AGENTS.md';
  const wantsTrigger = isCodex && commandRegistry.length > 0;
  const source = `generated:${agent}-shim`;

  // Marker-free whole-file forms. `fullShim` is what a freshly created or regenerated
  // file contains (for Codex + --command-adapters it already embeds the trigger).
  // `baseShimBody` is the trigger-free shim wrapped in agent-shim markers when
  // appended into a user-owned file.
  const baseShimBody = substitutePlaceholders(buildAiAgentShim(target.relativePath), substitution);
  const fullShim = substitutePlaceholders(buildAiAgentShim(target.relativePath, commandRegistry), substitution);
  const agentShimBlock = wrapAgentShimBlock(baseShimBody);
  const triggerBlock = wantsTrigger
    ? substitutePlaceholders(buildCodexCommandTriggerSection(commandRegistry), substitution).trim()
    : '';

  // Case 1 — create the marker-free whole-file shim. A re-run recognizes it through
  // the normalized template match (case 2a), so it needs no marker of its own.
  if (!(await pathExists(targetPath))) {
    items.push({
      relativePath: target.relativePath,
      source,
      notes: 'selected, tool-specific shim',
      content: fullShim,
      action: 'create',
      size: Buffer.byteLength(fullShim, 'utf8')
    });
    return;
  }

  const existingContent = await fs.readFile(targetPath, 'utf8');
  const eol = detectDominantEol(existingContent);
  const lf = toLf(existingContent);
  const agentRegion = classifyMarkedRegion(lf, AGENT_SHIM_SECTION_START, AGENT_SHIM_SECTION_END);
  // Classify the Codex trigger region on EVERY AGENTS.md run (not only when we are
  // about to manage the trigger): even a non---command-adapters run replaces the
  // agent-shim region, and a trigger region that overlaps it would be corrupted by
  // that slice. We only need the region for the safety gate below; trigger writes
  // still happen only when wantsTrigger.
  const triggerRegion = isCodex
    ? classifyMarkedRegion(lf, CODEX_TRIGGER_SECTION_START, CODEX_TRIGGER_SECTION_END)
    : { state: 'absent' };

  // Case 2c — Dflow markers cannot be edited safely; fall back to a previewed merge
  // snippet + warning and leave the file untouched. Three unsafe shapes:
  //   - the agent-shim marker pair is malformed (can't locate the block to manage);
  //   - we are managing the trigger (--command-adapters) and the trigger pair is
  //     malformed (can't locate the block to update);
  //   - the agent-shim and trigger regions overlap / interleave, which the independent
  //     region slices below would corrupt. This is checked on EVERY AGENTS.md run,
  //     adapter or not, because case 2b slices the agent-shim region regardless.
  // A malformed trigger on a NON-adapter run is deliberately NOT a blanket fallback: we
  // never touch the trigger there. But slicing the agent-shim block IS unsafe when
  // trigger markers straddle its boundary (some inside, some outside) — removing the
  // inside one(s) can promote the remaining outside markers into a new well-formed
  // trigger region wrapping the regenerated block. `triggerStraddlesAgent` catches that
  // on every AGENTS.md run (a fully-inside set is cleaned with the block, a fully-
  // outside set is untouched — both safe). The fallback ALWAYS warns (also closing the
  // R2-02 asymmetry). When only the trigger pair is malformed in a guide-configured file
  // under --command-adapters (no agent/overlap/straddle issue), the base shim is already
  // present, so the fallback is the trigger-only snippet (OQ#6c).
  const regionsOverlap = agentRegion.state === 'present' && triggerRegion.state === 'present' &&
    agentRegion.startIdx < triggerRegion.endIdx && triggerRegion.startIdx < agentRegion.endIdx;
  const triggerStraddlesAgent = isCodex && agentRegion.state === 'present' &&
    codexTriggerMarkersStraddle(lf, agentRegion.startIdx, agentRegion.endIdx);
  if (agentRegion.state === 'malformed' || (wantsTrigger && triggerRegion.state === 'malformed') ||
      regionsOverlap || triggerStraddlesAgent) {
    const triggerOnlyFallback = wantsTrigger && triggerRegion.state === 'malformed' &&
      agentRegion.state !== 'malformed' && !regionsOverlap && !triggerStraddlesAgent &&
      contentReferencesAiAgentGuide(existingContent);
    const snippetPath = triggerOnlyFallback
      ? 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md'
      : target.snippetPath;
    const snippetContent = triggerOnlyFallback
      ? substitutePlaceholders(buildCodexCommandTriggerSection(commandRegistry), substitution)
      : fullShim;
    if (warnings) {
      warnings.push(
        `Existing ${target.relativePath} contains malformed Dflow markers; left it untouched and wrote ${snippetPath} for manual merge. Remove the stray Dflow markers and re-run to let Dflow manage the block.`
      );
    }
    items.push({
      relativePath: snippetPath,
      source,
      notes: `selected, ${target.relativePath} has conflicting Dflow markers; merge this snippet manually`,
      content: snippetContent,
      overwrite: true,
      snippetFallback: true
    });
    return;
  }

  // Case 2b — exactly one well-formed agent-shim block: replace it in place. For
  // Codex + --command-adapters also (re)place the adjacent trigger block in the SAME
  // item.
  if (agentRegion.state === 'present') {
    let updated = lf.slice(0, agentRegion.startIdx) + agentShimBlock + lf.slice(agentRegion.endIdx);
    if (wantsTrigger) {
      updated = upsertCodexTriggerBlock(updated, triggerBlock);
    }
    pushRootInjectItem(items, {
      relativePath: target.relativePath,
      source,
      notes: `selected, updated Dflow block in existing ${target.relativePath}`,
      content: applyEol(updated, eol),
      expectedContent: existingContent
    });
    return;
  }

  // No agent-shim marker below.

  // Case 2a — the whole file is a shim Dflow itself would generate (a pristine
  // 0.8/0.9 shim, or an earlier whole-file injection): regenerate it (idempotent +
  // migrate an older template forward), preserving the file's dominant EOL. When this
  // run is not (re)generating a trigger, keep any trigger block the file already has.
  if (isPristineDflowAgentsShim(existingContent, baseShimBody, target.relativePath)) {
    let newWhole = fullShim;
    if (!wantsTrigger && isCodex) {
      const existingTrigger = extractCodexTriggerBlock(lf);
      if (existingTrigger) {
        newWhole = `${baseShimBody.replace(/\n+$/, '')}\n\n${existingTrigger.trim()}\n`;
      }
    }
    pushRootInjectItem(items, {
      relativePath: target.relativePath,
      source,
      notes: `selected, regenerated Dflow ${target.relativePath} shim`,
      content: applyEol(newWhole, eol),
      expectedContent: existingContent
    });
    return;
  }

  // Case 2d — the file already references the guide but is neither pristine nor
  // marker-managed (a guide-configured file the user wrote / heavily edited). Keep
  // the base shim skipped so we never duplicate their guide pointer. Under Codex
  // --command-adapters still install / update the self-delimited trigger block (OQ#6c).
  // PROPOSAL-058: any Dflow wording inside such a file is frozen (old canonical
  // prose and user prose cannot be told apart mechanically), so an interactive run
  // offers to append the managed block instead — with consent the file becomes
  // marker-managed (future runs refresh it via case 2b) and the user removes their
  // older Dflow wording; without consent (or non-TTY) the 2d behavior is unchanged.
  if (contentReferencesAiAgentGuide(existingContent)) {
    const adoptShimAgents = options.adoptShimAgents || [];
    if (adoptShimAgents.includes(agent)) {
      let updated = appendBlockLf(lf, agentShimBlock);
      if (wantsTrigger) {
        updated = upsertCodexTriggerBlock(updated, triggerBlock);
      }
      if (warnings) {
        warnings.push(
          `Appended the managed Dflow block to ${target.relativePath}; future upgrades refresh it in place. Review the file and remove any older Dflow wording outside the marked block.`
        );
      }
      pushRootInjectItem(items, {
        relativePath: target.relativePath,
        source,
        notes: `selected, appended managed Dflow block to existing ${target.relativePath}`,
        content: applyEol(updated, eol),
        expectedContent: existingContent
      });
      return;
    }
    // No consent (declined, or a non-interactive run): keep the 2d skip, but say
    // so — the docs promise "skip and warn", and the frozen Dflow wording is
    // exactly the drift this proposal makes visible.
    if (warnings) {
      warnings.push(
        `${target.relativePath} references the Dflow guide but is not marker-managed; Dflow wording inside it stays frozen on upgrade. Re-run \`dflow configure-agents\` on an interactive terminal to accept the managed-block offer, or keep maintaining the file yourself (\`dflow doctor\` reports this state).`
      );
    }
    if (wantsTrigger) {
      pushRootInjectItem(items, {
        relativePath: target.relativePath,
        source,
        notes: `selected, installed Dflow command triggers into existing ${target.relativePath}`,
        content: applyEol(upsertCodexTriggerBlock(lf, triggerBlock), eol),
        expectedContent: existingContent
      });
      items[items.length - 1].offerShimAdoption = agent;
    } else {
      items.push({
        relativePath: target.relativePath,
        source,
        notes: `selected, ${target.relativePath} already points to AI-AGENT-GUIDE.md`,
        content: fullShim,
        action: 'skip',
        intentionalSkip: true,
        offerShimAdoption: agent,
        size: Buffer.byteLength(fullShim, 'utf8')
      });
    }
    return;
  }

  // Case 2e — user-owned, non-guide existing file: append the marked Dflow block(s)
  // at end of file (the core new behavior; replaces the old snippet-park). Append-only,
  // previewed, reversible (delete the block to revert), idempotent on re-run (case 2b).
  const blocks = wantsTrigger ? [agentShimBlock, triggerBlock] : [agentShimBlock];
  pushRootInjectItem(items, {
    relativePath: target.relativePath,
    source,
    notes: `selected, appended Dflow block to existing ${target.relativePath}`,
    content: appendDflowBlocks(existingContent, blocks, eol),
    expectedContent: existingContent
  });
}

// Push one plan item that edits a user-owned root agent file. The write phase
// (writeFilePlan rootInject branch) re-reads the file and requires raw-byte equality
// with `expectedContent` before writing, so a file changed between preview and write
// is never clobbered. When the computed content already equals the file, record a
// quiet idempotent skip instead of a no-op write.
function pushRootInjectItem(items, { relativePath, source, notes, content, expectedContent }) {
  const size = Buffer.byteLength(content, 'utf8');
  if (content === expectedContent) {
    items.push({
      relativePath,
      source,
      notes: `${notes}; already current`,
      content,
      action: 'skip',
      intentionalSkip: true,
      size
    });
    return;
  }
  items.push({
    relativePath,
    source,
    notes,
    content,
    expectedContent,
    action: 'update',
    overwrite: true,
    rootInject: true,
    size
  });
}

function contentReferencesAiAgentGuide(content) {
  return content.includes('dflow/specs/shared/AI-AGENT-GUIDE.md') ||
    content.includes('dflow\\specs\\shared\\AI-AGENT-GUIDE.md');
}

function wrapAgentShimBlock(shimBody) {
  const body = shimBody.replace(/\n+$/, '');
  return `${AGENT_SHIM_SECTION_START}\n${body}\n${AGENT_SHIM_SECTION_END}`;
}

// Append `block` (LF) at end of `lfContent` (LF) with a one-blank-line separator,
// preserving the existing content and its final-newline convention exactly — trailing
// whitespace is never stripped. Returns LF.
function appendBlockLf(lfContent, block) {
  if (lfContent === '') {
    return `${block}\n`;
  }
  if (lfContent.endsWith('\n\n')) {
    return `${lfContent}${block}\n`;
  }
  if (lfContent.endsWith('\n')) {
    return `${lfContent}\n${block}\n`;
  }
  return `${lfContent}\n\n${block}\n`;
}

// Append Dflow blocks at end of an existing user file. The user's content is kept in
// full (never stripped or reordered) and the final-newline convention is preserved —
// only a one-blank-line separator is added. The whole result is emitted in the file's
// dominant EOL (the approved EOL policy), so a pure LF / pure CRLF user prefix
// round-trips byte-for-byte. `blocks` are LF strings.
function appendDflowBlocks(existingContent, blocks, eol) {
  const lf = toLf(existingContent);
  return applyEol(appendBlockLf(lf, blocks.join('\n\n')), eol);
}

// Replace an existing well-formed Codex trigger block, or append one at EOF preserving
// the existing content + final-newline convention (no stripping). Assumes the trigger
// markers are absent or a single well-formed pair (malformed is handled upstream as a
// snippet fallback). `lfContent` / `triggerBlock` are LF strings.
function upsertCodexTriggerBlock(lfContent, triggerBlock) {
  const region = classifyMarkedRegion(lfContent, CODEX_TRIGGER_SECTION_START, CODEX_TRIGGER_SECTION_END);
  if (region.state === 'present') {
    return lfContent.slice(0, region.startIdx) + triggerBlock + lfContent.slice(region.endIdx);
  }
  return appendBlockLf(lfContent, triggerBlock);
}

function extractCodexTriggerBlock(content) {
  const region = classifyMarkedRegion(content, CODEX_TRIGGER_SECTION_START, CODEX_TRIGGER_SECTION_END);
  return region.state === 'present' ? content.slice(region.startIdx, region.endIdx) : null;
}

// Classify a START/END marker pair in `content`:
//   'absent'    neither marker appears
//   'present'   exactly one START and one END, in order (startIdx/endIdx returned)
//   'malformed' any other shape (partial / duplicated / nested / reversed)
// The markers are single-line HTML comments, so classification is identical on raw or
// LF-normalized content; callers slice on whichever string they passed in.
function classifyMarkedRegion(content, startMarker, endMarker) {
  // ⚠ SEARCH THE MASK, SLICE THE ORIGINAL. A marker shown inside a fenced or
  // indented code example is documentation, not a region boundary — treating it
  // as one overwrote a user's own example with generated content, silently
  // (`p082-b3-k3` finding 1). `maskCodeBlocks` preserves every offset, so the
  // indices returned here still address `content`.
  // ⚠ This is the same defect class as the one the conventions checks had: a
  // consumer deciding a structural question by not asking the classifier. It is
  // fixed here by asking.
  const searchable = doctorChecks.maskCodeBlocks(content);
  const startCount = countOccurrences(searchable, startMarker);
  const endCount = countOccurrences(searchable, endMarker);
  if (startCount === 0 && endCount === 0) {
    return { state: 'absent' };
  }
  if (startCount === 1 && endCount === 1) {
    const startIdx = searchable.indexOf(startMarker);
    const endInner = searchable.indexOf(endMarker);
    if (startIdx < endInner) {
      return { state: 'present', startIdx, endIdx: endInner + endMarker.length };
    }
  }
  return { state: 'malformed' };
}

function countOccurrences(haystack, needle) {
  if (!needle) {
    return 0;
  }
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function markerPositions(content, marker) {
  const positions = [];
  let index = content.indexOf(marker);
  while (index !== -1) {
    positions.push(index);
    index = content.indexOf(marker, index + marker.length);
  }
  return positions;
}

// True when Codex trigger markers cross the [start, end) boundary — at least one inside
// and at least one outside. Slicing [start, end) (the case-2b agent-shim replace) is
// then unsafe: removing the inside marker(s) can leave the outside marker(s) forming a
// new well-formed trigger region wrapping the regenerated block. All-inside (removed
// with the block) and all-outside (untouched) are both safe; only a boundary cross is.
function codexTriggerMarkersStraddle(content, start, end) {
  const positions = [
    ...markerPositions(content, CODEX_TRIGGER_SECTION_START),
    ...markerPositions(content, CODEX_TRIGGER_SECTION_END)
  ];
  const inside = positions.some((position) => position >= start && position < end);
  const outside = positions.some((position) => position < start || position >= end);
  return inside && outside;
}

// Dominant line ending of a user file, so injected blocks match it (Windows projects
// may be CRLF). The repo's own LF policy (.gitattributes) governs repo files only, not
// an adopter's project files.
// Normalize any line ending to LF — CRLF **and a lone CR**, CommonMark's third
// form. The lone-CR half is not pedantry. `lfContent` / `existingLf` are threaded
// through the guide pipeline as a PROMISE that the content is LF, and
// `projectContextSectionBounds` splits it on newline while its fence-aware scan
// goes through `blankFencedBlocks`. While both sides ignored a lone CR they were
// wrong together and therefore harmless — such a guide simply was not
// recognized. Fixing only the scan side (`p082-b3-g1` finding 3) made them
// DISAGREE: a CR-only guide became "recognizable", its Project Context sliced to
// nothing, and `configure-agents` exited 0 having transplanted an EMPTY section
// — silently discarding the one region that whole path exists to preserve.
// Caught by `p082-b3-g2` finding 1, a regression this batch introduced.
//
// The lesson is the one this batch keeps paying for: a normalization is a
// contract between everyone who reads the value, so it needs ONE definition.
// Six call sites had each spelled the CRLF replacement out by hand, so "is this
// LF now?" had six answers that agreed only by luck.
//
// ⚠ Consequence worth knowing: a CR-only file is rewritten with LF endings.
// `detectDominantEol` only distinguishes CRLF from LF and already returned LF
// for such a file, so this makes existing behaviour honest rather than new.
function toLf(content) {
  return String(content).replace(/\r\n|\r/g, '\n');
}

function detectDominantEol(content) {
  const crlf = (content.match(/\r\n/g) || []).length;
  const lfOnly = (content.match(/\n/g) || []).length - crlf;
  return crlf > lfOnly ? '\r\n' : '\n';
}

function applyEol(content, eol) {
  const normalized = toLf(content);
  return eol === '\r\n' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

function getAiAgentTarget(agent) {
  const targets = {
    agents: {
      relativePath: 'AGENTS.md',
      snippetPath: 'dflow/specs/shared/AGENTS-md-snippet.md'
    },
    claude: {
      relativePath: 'CLAUDE.md',
      snippetPath: 'dflow/specs/shared/CLAUDE-md-snippet.md'
    },
    copilot: {
      relativePath: '.github/copilot-instructions.md',
      snippetPath: 'dflow/specs/shared/copilot-instructions-snippet.md'
    }
  };

  return targets[agent];
}

function shimTitle(targetPath) {
  return targetPath === '.github/copilot-instructions.md'
    ? 'GitHub Copilot Repository Instructions'
    : `${targetPath} - Dflow Project Instructions`;
}

function buildAiAgentShim(targetPath, commandRegistry = []) {
  const title = shimTitle(targetPath);

  const commandTriggerHint = targetPath === 'AGENTS.md' && commandRegistry.length > 0
    ? buildCodexCommandTriggerSection(commandRegistry)
    : '';

  return `# ${title}

This project uses Dflow for spec-first AI-assisted development.

For spec-impacting work — a new feature, a change to product, user-facing, or
domain behavior, a new requirement, or a bug-fix workflow — read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\` — command registry, routing rules, and project context.
- \`dflow/specs/shared/dflow-workflows/\` — vendored workflow bundle with executable step definitions.

For routine work (refactors, renames, chores, formatting, routine dependency
bumps, or general code questions), proceed normally; you need not read the guide
first. **Routine is narrower than it sounds** — it excludes anything a product
audience perceives (UI, email, exports, public docs such as a product README or
API reference, and operator surfaces like dashboard labels and alerts), where
**size is not the test**: a single-element wording or appearance change still
counts. It also excludes anything touching architecture, data structure, a
machine-consumed contract, a BR-ID, operational semantics (security / CVE,
safety, resilience, compliance, payment), or deliberate performance / resource /
SLA work. When unsure, read the guide's § Ceremony Scaling —
it decides, not this page.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.${commandTriggerHint}
`;
}

// ⚠⚠ READ BEFORE EDITING ANY VERSION NUMBER BELOW. The version→body map has now
// been corrected in three consecutive review rounds, each time in a new way:
// first the whole oldest body was missing; then the range was written as
// starting at v0.1.0 (it starts at v0.1.1); then the handover to the next body
// was pinned to v0.9.0 (it is 0.8.0). Per this repo's rule that a thing rewritten
// three times is a design question rather than a fourth patch, the cause is
// named here instead of the numbers being nudged again:
//
//   **`git tag` is NOT the list of releases.** 0.8.0 shipped to npm and has no
//   tag — `git tag` jumps v0.7.0 → v0.9.0 — so any range re-derived from tags
//   alone will silently skip it.
//
//   ⚠ `CHANGELOG.md` is not the list either, and an earlier version of this note
//   sent people there: it has no `## 0.13.0` heading — that entry was folded
//   away by the 0.14.0 release prep — so the same kind of hole reappears one
//   version along. Nor does `-S'"version": "0.X.0"'` enumerate: it can only
//   confirm a version you already suspect, and `X` is the unknown.
//
//   **The one command that actually enumerates** (15 bumps, including untagged
//   0.8.0 and CHANGELOG-less 0.13.0):
//
//       git log -G'"version": "0\.' --oneline -- package.json
//
//   Then read `buildAiAgentShim` at that release commit — not at the nearest tag.
//
// Nothing in the runtime depends on these numbers: `.some()` short-circuits over
// the builders and no two shipped bodies normalize equal. They exist so a
// maintainer can tell whether the list reaches all the way back — which is
// exactly why being wrong about them has cost three rounds.
//
// Frozen pre-bundle shim body: the oldest body `buildAiAgentShim` ever
// generated, carried by v0.1.1 through v0.7.0. One guide bullet, no
// workflow-bundle bullet, and a "The Dflow guide above is the single source of
// truth" tail. Introduced by `eabee5c` (earliest release tag v0.1.1) and
// replaced by `5498120` (PROPOSAL-039, vendored workflow bundle), which first
// shipped in **0.8.0** (release commit `66681d6`, untagged).
//
// ⚠ NOT "the first body Dflow ever shipped", and the range does not reach
// v0.1.0. At v0.1.0 `lib/init.js` did not reference the guide at all — it wrote
// CLAUDE.md from the packaged `CLAUDE-md-snippet.md` via a different code path,
// producing a two-H2 `System Context` / `Development Workflow` document with
// per-project values substituted in. That body is deliberately NOT in this list
// and cannot be: a frozen builder matches a fixed string, and a
// placeholder-substituted document has no fixed form to match. A v0.1.0 project
// therefore degrades to the not-marker-managed branch, which is correct
// behaviour for a file whose content is partly the developer's.
//
// It was missing from the frozen set until 2026-08-03, and the omission was
// live: a project still carrying this body failed the match, fell to the
// "not marker-managed" branch and kept the v0.1-v0.7 wording permanently.
// Confirmed by planting it in a real project and running `configure-agents`.
// The list comment said "oldest first" while starting at the second-oldest.
function buildPreBundleAgentShimBody(targetPath) {
  const title = shimTitle(targetPath);

  return `# ${title}

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\`

Keep tool-specific instruction files small. The Dflow guide above is the
single source of truth for project workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
`;
}

// Frozen pre-scoping shim body: shipped in **0.8.0 and v0.9.0** (and the
// Phase-2 @import-removal interim) — "Before planning or editing code ...".
// Its old wording is INTENTIONAL — this function exists to recognize it. See
// FROZEN_SHIM_BODY_BUILDERS below for why, and the ⚠⚠ note above
// buildPreBundleAgentShimBody before touching the version numbers.
function buildLegacyAgentShimBody(targetPath) {
  const title = shimTitle(targetPath);

  return `# ${title}

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\` — command registry, routing rules, and project context.
- \`dflow/specs/shared/dflow-workflows/\` — vendored workflow bundle with executable step definitions.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
`;
}

// Frozen unqualified-routine shim body (shipped 0.10.0 through 0.14.0): the
// scoped wording before PROPOSAL-082 narrowed "routine". Its routine paragraph
// waved through the classes the cascade calls tracked — a security dep bump, an
// operational-axis refactor, a Domain rename — and told the agent not to read
// the guide, so the shim contradicted the guide it points at.
function buildUnqualifiedRoutineShimBody(targetPath) {
  const title = shimTitle(targetPath);

  return `# ${title}

This project uses Dflow for spec-first AI-assisted development.

For spec-impacting work — a new feature, a change to product, user-facing, or
domain behavior, a new requirement, or a bug-fix workflow — read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\` — command registry, routing rules, and project context.
- \`dflow/specs/shared/dflow-workflows/\` — vendored workflow bundle with executable step definitions.

For routine work (refactors, renames, chores, formatting, dependency bumps, or
general code questions), proceed normally; you need not read the guide first.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
`;
}

// Every shim body Dflow has shipped, oldest first. Used ONLY by
// isPristineDflowAgentsShim, so an adopter carrying any previously-generated
// whole-file shim is still recognized as Dflow-generated and regenerated to the
// current wording.
//
// ⚠ CHANGING buildAiAgentShim's BODY MEANS APPENDING THE OUTGOING BODY HERE, in
// the same commit. Miss it and every adopter on the previous release is stranded
// on the guide-reference skip path: their shim stops matching, degrades to the
// "not marker-managed" branch, and keeps the superseded body forever — plus, for
// CLAUDE.md, the legacy @import. The failure is silent on the maintainer's box,
// because a freshly-generated shim always matches the body it was just built
// from; only an upgrade from a real older project shows it.
//
// The rule has exactly one exception, and it follows from that failure mode: an
// outgoing body that **never appeared in a release** has no adopters to strand,
// so it does not go in the list. ⚠ Establish that from the version-bump history
// (the enumerating command in the ⚠⚠ note above), NOT from `git tag --contains`
// — that note says why `git tag` is not the list of releases, and a body
// introduced and replaced *between* two releases is exactly where the tag test
// and the truth diverge. Taking the exception is not free: a project scaffolded
// from this repo while the orphan body was current carries it, and
// `configure-agents` then refuses to regenerate that file in place — loudly,
// via the "not marker-managed" warning, leaving the file untouched.
//
// This is a list rather than a single fallback because the one-body form had to
// be edited correctly at exactly the moment a body changed, which is the moment
// attention is on the new wording. `test/agent-inject.mjs` carries one upgrade
// case per entry (§3b / §3e / §3f, plus §3g for the AGENTS.md+trigger
// composition) — NOT upgrade-drift.mjs, which has no
// shim-body case at all.
//
// ⚠ Adding a builder here means adding its case there in the same commit. That
// pairing is not machine-enforced; the list can grow without a test.
//
// The v0.1-v0.7 entry was missing from the first version of this list, so the
// list shipped one release while contradicting its own "oldest first" label and
// stranding the very adopters it names. Order is documentation only —
// `.some()` short-circuits and no two shipped bodies normalize equal — but the
// label has to be true, because it is what tells the next maintainer whether
// the list reaches all the way back.
const FROZEN_SHIM_BODY_BUILDERS = [
  buildPreBundleAgentShimBody,
  buildLegacyAgentShimBody,
  buildUnqualifiedRoutineShimBody
];

function addCommandAdapterItems(items, aiAgents, commandRegistry) {
  if (aiAgents.includes('claude')) {
    for (const command of commandRegistry) {
      items.push({
        relativePath: `.claude/commands/dflow/${command.id}.md`,
        source: 'generated:claude-command-adapter',
        notes: 'command adapter, derived from dflow command registry',
        content: buildThinCommandWrapper(command, `/dflow:${command.id}`),
        overwrite: true
      });
    }
  }

  if (aiAgents.includes('copilot')) {
    for (const command of commandRegistry) {
      items.push({
        relativePath: `.github/prompts/dflow-${command.id}.prompt.md`,
        source: 'generated:copilot-command-adapter',
        notes: 'command adapter, derived from dflow command registry',
        content: buildThinCommandWrapper(command, `/dflow-${command.id}`),
        overwrite: true
      });
    }
  }
}

async function addLegacyCommandAdapterCleanupItems(cwd, items, aiAgents, warnings) {
  for (const legacy of LEGACY_COMMAND_ADAPTERS) {
    if (!aiAgents.includes(legacy.agent)) {
      continue;
    }

    for (const command of legacy.commands) {
      const relativePath = legacy.pathPattern.replace('<id>', command.id);
      const targetPath = path.join(cwd, relativePath);
      let stats;

      try {
        stats = await fs.stat(targetPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue;
        }
        throw error;
      }

      if (!stats.isFile()) {
        warnings.push(`Found legacy Dflow command adapter path but it is not a file; not removed: ${relativePath}`);
        continue;
      }

      const content = await fs.readFile(targetPath, 'utf8');
      const expectedContent = buildLegacyCommandAdapterFingerprint(legacy, command);
      if (normalizeCommandAdapterFingerprint(content) !== normalizeCommandAdapterFingerprint(expectedContent)) {
        warnings.push(`Found legacy Dflow command adapter with non-generated content; not removed: ${relativePath}. Inspect it manually before deleting.`);
        continue;
      }

      items.push({
        relativePath,
        source: legacy.source,
        notes: `stale dflow adapter generated by Dflow ${legacy.version}`,
        action: 'remove',
        size: Buffer.byteLength(content, 'utf8'),
        expectedContent
      });
    }
  }
}

// Edition-agnostic thin shell: a single canonical source at
// templates/common/skill/SKILL.md (PROPOSAL-041 C1). Returns the file
// verbatim — frontmatter, marker, and body all live in the source file so
// the skill content can be edited without touching JS.
async function buildDflowSkillAdapter() {
  const sourcePath = path.join(TEMPLATE_ROOT, COMMON_SKILL_SOURCE_REL);
  return fs.readFile(sourcePath, 'utf8');
}

// Project-level skill paths per AI agent. Claude, Codex (the `agents` key,
// labeled "Codex / Copilot coding agent"), and GitHub Copilot each get the SAME
// edition-neutral thin skill projected to their own canonical skill path.
// PROPOSAL-056 generalized this; the Copilot native projection (`.github/skills`)
// was un-deferred after a spike confirmed Copilot discovers and auto-triggers a
// skill from its own path with the cross-read `.claude`/`.agents` paths removed.
// Note: Copilot also cross-reads `.claude/skills` and `.agents/skills`, so a
// project that selects Copilot alongside Claude/Codex may surface the same
// `dflow` skill from more than one path. The copies Dflow *generates* are
// byte-identical (same name, body, and marker), so duplicate generated copies
// carry identical behavior — but this duplicate-discovery case is not spiked,
// and a pre-existing non-Dflow skill at a cross-read path is left unchanged by
// the overwrite guard below and could differ. Remove/rename such a file to
// avoid a divergent same-name duplicate.
const SKILL_ADAPTER_TARGETS = {
  claude: { relativePath: '.claude/skills/dflow/SKILL.md', source: 'generated:claude-skill-adapter' },
  agents: { relativePath: '.agents/skills/dflow/SKILL.md', source: 'generated:agents-skill-adapter' },
  copilot: { relativePath: '.github/skills/dflow/SKILL.md', source: 'generated:copilot-skill-adapter' }
};

async function addSkillAdapterItems(cwd, items, aiAgents, skills, warnings) {
  if (!skills) {
    return;
  }

  const skillTargets = aiAgents
    .filter((agent) => SKILL_ADAPTER_TARGETS[agent])
    .map((agent) => SKILL_ADAPTER_TARGETS[agent]);

  if (skillTargets.length === 0) {
    // No skill-capable agent was selected at all. Nothing to project.
    warnings.push(
      'The --skills flag projects a project-level skill for Claude Code, Codex, and GitHub Copilot; no skill adapter was generated because none was a selected target.'
    );
    return;
  }

  // The thin skill is edition-neutral (it only points to the per-edition guide),
  // so there is nothing edition-specific to go stale — re-running just rewrites
  // the same marker-guarded file (idempotent). No LEGACY skill set exists yet
  // (skills are new in PROPOSAL-038); future skill cleanup would extend the same
  // LEGACY_* / addLegacyCommandAdapterCleanupItems marker-fingerprint pattern.
  const skillContent = await buildDflowSkillAdapter();

  for (const target of skillTargets) {
    const targetPath = path.join(cwd, target.relativePath);

    let existingContent;
    try {
      existingContent = await fs.readFile(targetPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      existingContent = undefined;
    }

    if (existingContent !== undefined && !existingContent.includes(SKILL_ADAPTER_GENERATED_MARKER)) {
      warnings.push(
        `Existing ${target.relativePath} is not a Dflow-generated skill; left unchanged. Remove or rename it to let Dflow manage this skill.`
      );
      continue;
    }

    // addSkillAdapterItems runs AFTER finalizePlanItems, so these items never pass
    // through that pass — set `action` explicitly here (the preview table and the
    // result report read item.action directly). `overwrite: true` keeps the write
    // phase rewriting an existing marker-stamped skill.
    items.push({
      relativePath: target.relativePath,
      source: target.source,
      notes: 'skill adapter, thin skill pointing to AI-AGENT-GUIDE.md',
      content: skillContent,
      size: Buffer.byteLength(skillContent, 'utf8'),
      overwrite: true,
      action: existingContent === undefined ? 'create' : 'update'
    });
  }
}

function buildLegacyCommandAdapterFingerprint(legacy, command) {
  if (legacy.version === '0.5.0' && legacy.fingerprint === 'v0.5.0 buildThinCommandWrapper') {
    return buildLegacyV050ThinCommandWrapper(command);
  }

  throw new InitError(`Internal error: unsupported legacy command adapter fingerprint: ${legacy.version}`);
}

function buildLegacyV050ThinCommandWrapper(command) {
  const argHint = command.argHint === '-'
    ? 'Argument hint: none.'
    : `Argument hint: ${command.argHint}.`;

  return `# /dflow-${command.id}

Execute the canonical \`${command.label}\` Dflow workflow or control command.

Definition: \`dflow/specs/shared/AI-AGENT-GUIDE.md\`

${argHint}
`;
}

function normalizeCommandAdapterFingerprint(content) {
  return toLf(content);
}

function normalizeShimForMatch(content) {
  return toLf(content)
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripCodexTriggerBlock(content) {
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\n*${escape(CODEX_TRIGGER_SECTION_START)}[\\s\\S]*?${escape(CODEX_TRIGGER_SECTION_END)}\\n*`
  );
  return content.replace(re, '\n');
}

// Removes the pre-Phase-2 Markdown `@import` block that old CLAUDE.md shims
// appended after the shim body. Operates on already-normalized content (LF, no
// trailing whitespace, blank runs collapsed, trimmed — see normalizeShimForMatch),
// so editor-added trailing spaces, CRLF, or an extra blank line in an old file
// do not defeat the match.
function stripLegacyImportSuffix(normalizedContent) {
  return normalizedContent.replace(
    /\n+If your tool supports Markdown imports, the canonical guide is imported below:\n+@dflow\/specs\/shared\/AI-AGENT-GUIDE\.md$/,
    ''
  );
}

// A CLAUDE.md / AGENTS.md is a safely-injectable Dflow shim when, after removing
// any previously-injected trigger block, it matches the shim Dflow itself
// generates. This covers a pristine 0.8.0/0.9.0 shim (no marker, normalized
// template match) and a shim Dflow already injected into (idempotent
// re-projection). For CLAUDE.md ONLY, a pre-Phase-2 shim that still carries the
// legacy `@import` also counts and is regenerated WITHOUT it, so the
// progressive-disclosure fix reaches existing projects. The import was only ever
// generated into CLAUDE.md, so scoping the strip there avoids clobbering a
// user-added import block in a hand-edited AGENTS.md / Copilot shim. A
// user-edited shim otherwise fails the match and degrades to a snippet.
function isPristineDflowAgentsShim(existingContent, baseShim, relativePath) {
  const target = normalizeShimForMatch(baseShim);
  let existing = normalizeShimForMatch(stripCodexTriggerBlock(existingContent));
  if (relativePath === 'CLAUDE.md') {
    existing = stripLegacyImportSuffix(existing);
  }
  if (existing === target) {
    return true;
  }
  // Back-compat: every shim body Dflow has previously shipped counts as pristine,
  // so configure-agents regenerates it to the current wording (and, for CLAUDE.md,
  // drops the legacy @import already stripped above). Without this, each body
  // reword would strand the previous release's shims on the skip path.
  return FROZEN_SHIM_BODY_BUILDERS.some(
    (buildFrozenBody) => existing === normalizeShimForMatch(buildFrozenBody(relativePath))
  );
}

function buildCodexCommandTriggerSection(commandRegistry) {
  const triggers = commandRegistry
    .map((command) => {
      const commandKind = command.scope === 'control' ? 'command' : 'workflow';
      return `- \`${command.label}\` as text, or "Run the Dflow ${command.label} ${commandKind}."`;
    })
    .join('\n');

  return `

${CODEX_TRIGGER_SECTION_START}

## Dflow Text Triggers

Codex does not install Dflow command files. When the developer asks for a
canonical Dflow command, treat it as a text trigger, read the canonical guide,
and execute the matching workflow or control command.

If the CLI intercepts a slash-prefixed Dflow name such as \`/dflow:status\` as
an unknown command, the developer may resend it without the slash, for example
\`dflow:status\`. Treat that as the same Dflow text trigger, read the guide,
and execute it.

Recognized canonical triggers:

${triggers}

${CODEX_TRIGGER_SECTION_END}
`;
}

function buildThinCommandWrapper(command, displayName = command.label) {
  const argHint = command.argHint === '-'
    ? 'Argument hint: none.'
    : `Argument hint: ${command.argHint}.`;

  return `# ${displayName}

${COMMAND_ADAPTER_GENERATED_MARKER}

Execute the canonical \`${command.label}\` Dflow workflow or control command.

Registry and rules: \`dflow/specs/shared/AI-AGENT-GUIDE.md\`
Workflow steps: \`dflow/specs/shared/dflow-workflows/\`

${argHint}
`;
}

function parseDflowCommandRegistry(content) {
  const start = content.indexOf(COMMAND_REGISTRY_START);
  const end = content.indexOf(COMMAND_REGISTRY_END);

  if (start === -1 || end === -1 || end <= start) {
    throw new InitError('Internal error: dflow command registry markers not found in packaged AI-AGENT-GUIDE.md.');
  }

  const registryContent = content.slice(start + COMMAND_REGISTRY_START.length, end);
  const tableLines = registryContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'));

  if (tableLines.length < 3) {
    throw new InitError('Internal error: dflow command registry table is empty.');
  }

  const header = parseMarkdownTableRow(tableLines[0]).map((cell) => cell.toLowerCase());
  const expectedHeader = ['id', 'label', 'description', 'arg-hint', 'scope'];
  if (header.length !== expectedHeader.length || !expectedHeader.every((cell, index) => header[index] === cell)) {
    throw new InitError('Internal error: dflow command registry header must be: id, label, description, arg-hint, scope.');
  }

  const delimiter = parseMarkdownTableRow(tableLines[1]);
  if (delimiter.length !== expectedHeader.length || !delimiter.every((cell) => /^:?-{3,}:?$/.test(cell))) {
    throw new InitError('Internal error: dflow command registry delimiter row is invalid.');
  }

  const commands = [];
  const seen = new Set();

  for (const line of tableLines.slice(2)) {
    const cells = parseMarkdownTableRow(line);
    if (cells.length !== expectedHeader.length) {
      throw new InitError(`Internal error: invalid dflow command registry row: ${line}`);
    }

    const command = {
      id: stripInlineCode(cells[0]),
      label: stripInlineCode(cells[1]),
      description: stripInlineCode(cells[2]),
      argHint: stripInlineCode(cells[3]),
      scope: stripInlineCode(cells[4])
    };

    validateDflowCommandRegistryRow(command, seen);
    commands.push(command);
  }

  const actualIds = commands.map((command) => command.id);
  const missingIds = EXPECTED_COMMAND_IDS.filter((id) => !actualIds.includes(id));
  const extraIds = actualIds.filter((id) => !EXPECTED_COMMAND_IDS.includes(id));
  if (missingIds.length > 0 || extraIds.length > 0 || commands.length !== EXPECTED_COMMAND_IDS.length) {
    throw new InitError(
      `Internal error: dflow command registry must contain exactly these command ids: ${EXPECTED_COMMAND_IDS.join(', ')}.`
    );
  }

  return commands;
}

function parseMarkdownTableRow(line) {
  const trimmed = line.trim();
  const inner = trimmed.slice(1, -1);
  const cells = [];
  let current = '';

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    const next = inner[index + 1];

    if (char === '\\' && next === '|') {
      current += '|';
      index += 1;
      continue;
    }

    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function stripInlineCode(value) {
  const trimmed = String(value || '').trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function validateDflowCommandRegistryRow(command, seen) {
  if (!/^[a-z][a-z0-9-]*$/.test(command.id)) {
    throw new InitError(`Internal error: invalid dflow command id: ${command.id}`);
  }
  if (seen.has(command.id)) {
    throw new InitError(`Internal error: duplicate dflow command id: ${command.id}`);
  }
  seen.add(command.id);

  if (command.label !== `/dflow:${command.id}`) {
    throw new InitError(`Internal error: dflow command label must be /dflow:${command.id}.`);
  }
  if (!command.description) {
    throw new InitError(`Internal error: dflow command ${command.id} is missing a description.`);
  }
  if (!command.argHint) {
    throw new InitError(`Internal error: dflow command ${command.id} is missing an arg-hint.`);
  }
  if (!command.scope) {
    throw new InitError(`Internal error: dflow command ${command.id} is missing a scope.`);
  }
}

// Greenfield: the three common rows then `events.md` and the ADR row — the same
// five paths, in the same order, that the splice produced. Brownfield: the three
// common rows only.
function buildDeferredItems(edition) {
  const deferred = [...DEFERRED_COMMON];
  if (edition === 'greenfield') {
    deferred.push(...DEFERRED_GREENFIELD_ONLY);
  }
  return deferred;
}

async function readPackagedTemplate(edition, sourceRel) {
  const templatePath = path.join(TEMPLATE_ROOT, edition, sourceRel);
  const normalizedTemplateRoot = path.resolve(TEMPLATE_ROOT, edition);
  const normalizedTemplatePath = path.resolve(templatePath);

  if (!normalizedTemplatePath.startsWith(`${normalizedTemplateRoot}${path.sep}`)) {
    throw new InitError(`Internal error: packaged template not found: templates/${edition}/${sourceRel}`);
  }

  let buffer;
  try {
    buffer = await fs.readFile(normalizedTemplatePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new InitError(`Internal error: packaged template not found: templates/${edition}/${sourceRel}`);
    }
    throw new InitError(`Internal error: cannot read packaged template: templates/${edition}/${sourceRel}`);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new InitError(`Internal error: invalid UTF-8 packaged template: templates/${edition}/${sourceRel}`);
  }
}

const PLACEHOLDER_ALIASES = {
  '{Framework version}': ['{ASP.NET Core version}', '{ASP.NET WebForms version}', '{.NET Framework version}'],
  '{ORM / persistence}': ['{ORM / Data Access}'],
  '{ORM version}': ['{EF Core version}'],
  '{Mediator}': ['{MediatR version}']
};

function buildSubstitutionMap(cwd, answers) {
  const extracted = extractTechStackPlaceholders(answers.techStackSummary);
  const gitStyle = answers.gitPolicy === 'gitflow' ? 'gitflow' : (answers.gitPolicy === 'trunk' ? 'trunk' : null);
  const systemName = path.basename(cwd);

  const map = new Map([
    ['{YYYY-MM-DD}', currentLocalDate()],
    ['{System Name}', systemName],
    ['{系統名稱}', systemName],
    ['{project-type}', answers.projectType],
    ['{edition}', answers.edition],
    // These two land in the guide's "## Project Context" table cells (their
    // only template use), so bare `|` in the free-text answers must be escaped
    // or the row gains phantom cells and inference later truncates the value —
    // escapeTableCell is the exact inverse of parseContextLine's unescape
    // (PROPOSAL-076 gate G2 round-trip fix).
    ['{tech-stack-summary}', escapeTableCell(answers.techStackSummary)],
    ['{migration-context}', escapeTableCell(answers.migrationContext)],
    ['{prose-language}', answers.proseLanguage],
    ['{dflow-version}', pkg.version],
    ['{Language}', extracted.language || '{Language}'],
    ['{Framework}', extracted.framework || '{Framework}'],
    ['{Framework version}', extracted.frameworkVersion || '{Framework version}'],
    ['{ORM / persistence}', extracted.ormPersistence || '{ORM / persistence}'],
    ['{ORM version}', extracted.ormVersion || '{ORM version}'],
    ['{Mediator}', extracted.mediator || '{Mediator}'],
    ['{Test framework}', extracted.testFramework || '{Test framework}'],
    ['{gitflow|trunk}', gitStyle || '{gitflow|trunk}']
  ]);

  for (const [canonical, aliases] of Object.entries(PLACEHOLDER_ALIASES)) {
    const value = map.get(canonical);
    if (value === undefined) continue;
    const canonicalResolved = value !== canonical;
    for (const alias of aliases) {
      map.set(alias, canonicalResolved ? value : alias);
    }
  }

  return map;
}

function substitutePlaceholders(content, substitution) {
  let result = content;
  for (const [placeholder, value] of substitution.entries()) {
    result = result.split(placeholder).join(value);
  }
  return result;
}

const LANGUAGE_PATTERNS = [
  /\bC#\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bC#\b/,
  /\bTypeScript\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bTypeScript\b/i,
  /\bJavaScript\b/i,
  /\bKotlin\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bKotlin\b/i,
  /\bJava\s*[0-9]+\b/i,
  /\bJava\b/i,
  /\bPython\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bPython\b/i,
  /\bGolang\b/i,
  /\bGo\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bPHP\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bPHP\b/i,
  /\bRuby\b/i
];

const FRAMEWORK_VERSION_PATTERNS = [
  /\bASP\.?NET\s+Core\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\b(?:ASP\.?NET\s+WebForms|WebForms)(?:\s+[0-9]+(?:\.[0-9]+)?)?\b/i,
  /\b\.NET\s+Framework\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bSpring\s+Boot\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bSpring\s+MVC\b/i,
  /\bNestJS\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bFastify\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bExpress(?:\.js)?\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bDjango\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bFastAPI\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bFlask\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bGin\s+v?[0-9]+(?:\.[0-9]+)?\b/i,
  /\bEcho\s+v?[0-9]+(?:\.[0-9]+)?\b/i,
  /\bLaravel\s*[0-9]+(?:\.[0-9]+)?\b/i
];

const FRAMEWORK_PATTERNS = [
  /\bASP\.?NET\s+Core\b/i,
  /\b(?:ASP\.?NET\s+WebForms|WebForms)\b/i,
  /\b\.NET\s+Framework\b/i,
  /\bSpring\s+Boot\b/i,
  /\bSpring\s+MVC\b/i,
  /\bNestJS\b/i,
  /\bFastify\b/i,
  /\bExpress(?:\.js)?\b/i,
  /\bDjango\b/i,
  /\bFastAPI\b/i,
  /\bFlask\b/i,
  /\bGin\b/i,
  /\bEcho\b/i,
  /\bLaravel\b/i
];

const ORM_VERSION_PATTERNS = [
  /\b(?:EF\s+Core|Entity\s+Framework\s+Core)\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\b(?:EF6|Entity\s+Framework\s+6)\b/i,
  /\bHibernate\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bSpring\s+Data\s+JPA\b/i,
  /\bJPA\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bSQLAlchemy\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bPrisma\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bTypeORM\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bMikro-?ORM\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bGORM\s+v?[0-9]+(?:\.[0-9]+)?\b/i,
  /\bEloquent\s*[0-9]+(?:\.[0-9]+)?\b/i,
  /\bDoctrine\s*[0-9]+(?:\.[0-9]+)?\b/i
];

const ORM_PERSISTENCE_PATTERNS = [
  /\b(?:EF\s+Core|Entity\s+Framework\s+Core)\b/i,
  /\b(?:EF6|Entity\s+Framework\s+6|Dapper|ADO\.NET)\b/i,
  /\bHibernate\b/i,
  /\bSpring\s+Data\s+JPA\b/i,
  /\bJPA\b/i,
  /\bSQLAlchemy\b/i,
  /\bSQLModel\b/i,
  /\bPrisma\b/i,
  /\bTypeORM\b/i,
  /\bMikro-?ORM\b/i,
  /\bGORM\b/i,
  /\bsqlx\b/i,
  /\bEloquent\b/i,
  /\bDoctrine\b/i
];

function extractTechStackPlaceholders(text) {
  if (!text || text.toLowerCase() === 'unknown') {
    return {};
  }

  return {
    language: firstPatternMatch(text, LANGUAGE_PATTERNS),
    framework: firstPatternMatch(text, FRAMEWORK_PATTERNS),
    frameworkVersion: firstPatternMatch(text, FRAMEWORK_VERSION_PATTERNS),
    ormPersistence: firstPatternMatch(text, ORM_PERSISTENCE_PATTERNS),
    ormVersion: firstPatternMatch(text, ORM_VERSION_PATTERNS),
    mediator: firstMatch(text, /\bMediatR\s*[0-9]+(?:\.[0-9]+)?\b/i),
    testFramework: extractTestFramework(text)
  };
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[0] : null;
}

function firstPatternMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

function extractTestFramework(text) {
  const patterns = [
    [/\bxUnit\b/i, 'xUnit'],
    [/\bNUnit\b/i, 'NUnit'],
    [/\bMSTest\b/i, 'MSTest'],
    [/\bJUnit\s*[0-9]+\b/i, null],
    [/\bJUnit\b/i, 'JUnit'],
    [/\bVitest\b/i, 'Vitest'],
    [/\bJest\b/i, 'Jest'],
    [/\bMocha\b/i, 'Mocha'],
    [/\bpytest\b/i, 'pytest'],
    [/\bunittest\b/i, 'unittest'],
    [/\bgo\s+test\b/i, 'go test'],
    [/\bPHPUnit\b/i, 'PHPUnit'],
    [/\bPest\b/i, 'Pest']
  ];

  for (const [pattern, name] of patterns) {
    const match = text.match(pattern);
    if (match) {
      return name || match[0];
    }
  }
  return null;
}

// ⚠ THIS FAMILY DELIBERATELY DOES NOT GO THROUGH `doctorChecks.classifyLines`,
// and the boundary is worth stating because the rest of this file just moved the
// other way (see `projectContextSectionBounds`). `ensureProseLanguageSection`,
// `stripProseLanguageSections` and `stripNamedSections` only ever see content
// this process generated moments earlier — `readPackagedTemplate` followed by
// `substitutePlaceholders`, at the single call site in `addTemplate` — so the
// heading shapes they must handle are the ones the packaged templates contain,
// not the ones an adopter might type. They also fail LOUDLY on a mis-parse: the
// `count !== 1` assertion below throws rather than writing a wrong file.
//
// The functions that DID move are the ones that read USER-OWNED files and ask
// the same questions doctor asks. That is the line: parse a file someone else
// wrote, use the shared classification; reshape a string you just rendered
// yourself, a literal match is honest and the assertion covers it.
function ensureProseLanguageSection(content, proseLanguage) {
  const section = buildProseLanguageSection(proseLanguage);
  let stripped = stripProseLanguageSections(content);
  stripped = stripped.replace(/\n{3,}/g, '\n\n');

  const markerMatch = stripped.match(/^## Filling the Templates/m);
  let result;

  if (markerMatch && typeof markerMatch.index === 'number') {
    const before = stripped.slice(0, markerMatch.index).replace(/\s*$/, '\n\n');
    const after = stripped.slice(markerMatch.index).replace(/^\s*/, '');
    result = `${before}${section}\n\n${after}`;
  } else {
    result = `${stripped.replace(/\s*$/, '\n\n')}${section}\n`;
  }

  const count = (result.match(/^## Prose Language$/gm) || []).length;
  if (count !== 1) {
    throw new InitError('Internal error: failed to inject exactly one Prose Language section.');
  }

  return result;
}

function stripProseLanguageSections(content) {
  const lines = content.split(/\r?\n/);
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    if (/^## Prose Language\s*$/.test(line)) {
      skipping = true;
      continue;
    }

    if (skipping && /^## /.test(line)) {
      skipping = false;
    }

    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join('\n');
}

function stripNamedSections(content, headings) {
  const set = new Set(headings.map((heading) => `## ${heading}`));
  const kept = [];
  let skipping = false;

  for (const line of content.split(/\r?\n/)) {
    if (set.has(line.trim())) {
      skipping = true;
      continue;
    }
    if (skipping && /^## /.test(line)) {
      skipping = false;
    }
    if (!skipping) {
      kept.push(line);
    }
  }

  return kept.join('\n');
}

function buildGitPolicySection(gitPolicy) {
  const policy = gitPolicy === 'gitflow' ? 'gitflow' : 'trunk';
  return `## Git Policy

Selected Git policy: \`${policy}\`

Dflow runtime branch gates and finish-feature guidance follow this policy. Both
policies use feature branches; the policy selects the finish-stage merge
guidance — \`gitflow\` introduces merge-commit / release+develop flow, while
\`trunk\` (GitHub Flow) favors squash or fast-forward back to the main branch
with small, frequent merges.`;
}

function buildAiCommitPolicySection(aiCommitMarker) {
  const marker = ['none', 'co-authored-by', 'prefix'].includes(aiCommitMarker) ? aiCommitMarker : 'none';
  return `## AI Commit Policy

AI commit marker: \`${marker}\`

At lifecycle checkpoints the AI may offer to commit using your Git identity; you
can always decline (Y / N). Completed and skipped checkpoints are recorded in
each feature's Checkpoint Log. Marker modes:

- \`none\`: AI-made commits carry no extra marker.
- \`co-authored-by\`: append a \`Co-Authored-By: dflow-ai <noreply@dflow.local>\`
  trailer (teams may customize the name/email).
- \`prefix\`: prefix the commit subject with \`[ai-assisted]\`.`;
}

function ensureConventionPolicySections(content, answers) {
  const stripped = stripNamedSections(content, ['Git Policy', 'AI Commit Policy']).replace(/\n{3,}/g, '\n\n');
  const sections = `${buildGitPolicySection(answers.gitPolicy)}\n\n${buildAiCommitPolicySection(answers.aiCommitMarker)}`;
  const markerMatch = stripped.match(/^## Filling the Templates/m);

  if (markerMatch && typeof markerMatch.index === 'number') {
    const before = stripped.slice(0, markerMatch.index).replace(/\s*$/, '\n\n');
    const after = stripped.slice(markerMatch.index).replace(/^\s*/, '');
    return `${before}${sections}\n\n${after}`;
  }

  return `${stripped.replace(/\s*$/, '\n\n')}${sections}\n`;
}

function buildProseLanguageSection(proseLanguage) {
  return `## Prose Language

Project prose language: \`${proseLanguage}\`

Dflow templates keep canonical English structural language: headings,
table headers, fixed labels, placeholders, IDs, anchors, and code-facing
terms remain English.

Free prose written inside those sections should follow the project prose
language:

- \`en\`: write free prose in English.
- \`zh-TW\`: write free prose in Traditional Chinese.
- \`{xx-XX}\`: write free prose in that explicit BCP-47 language.

Do not translate code identifiers, DDD pattern names, BR IDs, SPEC IDs,
file paths, branch names, anchors, or inline code only to satisfy the
prose-language setting.`;
}

function renderPreview(stdout, plan, warnings) {
  stdout.write('\nFile plan:\n\n');
  if (warnings.length > 0) {
    stdout.write('Warnings:\n');
    warnings.forEach((warning) => stdout.write(`- ${warning}\n`));
    stdout.write('\n');
  }

  stdout.write('| Path | Action | Source | Size | Notes |\n');
  stdout.write('|---|---|---|---:|---|\n');
  plan.items.forEach((item) => {
    stdout.write(
      `| ${escapeTableCell(item.relativePath)} | ${item.action} | ${escapeTableCell(item.source)} | ${formatBytes(item.size)} | ${escapeTableCell(item.notes || '')} |\n`
    );
  });

  stdout.write('\nWill defer:\n\n');
  stdout.write('| Path | Action | Source | Size | Notes |\n');
  stdout.write('|---|---|---|---:|---|\n');
  plan.deferred.forEach((item) => {
    stdout.write(
      `| ${escapeTableCell(item.relativePath)} | defer | generated later | 0 B | ${escapeTableCell(item.reason)} |\n`
    );
  });
  stdout.write('\n');
}

async function writeFilePlan(cwd, plan) {
  const result = {
    created: [],
    updated: [],
    removed: [],
    skipped: [],
    warnings: []
  };

  // PROPOSAL-058: an item flagged requiresFullApply (the `> Dflow Version:`
  // last-reconciled advance) may only run when every previewed change actually
  // applied. Guarded skips — changed-after-preview, vanished / non-file
  // targets, unexpected existing targets — mean the previewed reconciliation
  // is incomplete, so the flagged item is skipped with a warning instead of
  // overstating the reconciled version. Intentional skips (already current /
  // already configured) do not block it, and neither does removing a stale
  // file that is already gone (the desired end state holds).
  let unexpectedSkip = false;

  for (const item of plan.items) {
    const targetPath = path.join(cwd, item.relativePath);

    try {
      if (item.requiresFullApply && unexpectedSkip) {
        result.skipped.push(item.relativePath);
        result.warnings.push(
          `Skipped the Dflow Version update in ${item.relativePath} because earlier planned changes were skipped after the preview; re-run \`dflow configure-agents\`.`
        );
        continue;
      }

      if (item.action === 'remove') {
        let stats;
        try {
          stats = await fs.stat(targetPath);
        } catch (error) {
          if (error.code === 'ENOENT') {
            result.skipped.push(item.relativePath);
            result.warnings.push(`Skipped missing stale file: ${item.relativePath}`);
            continue;
          }
          throw error;
        }

        if (!stats.isFile()) {
          unexpectedSkip = true;
          result.skipped.push(item.relativePath);
          result.warnings.push(`Skipped stale removal because target is not a file: ${item.relativePath}`);
          continue;
        }

        const currentContent = await fs.readFile(targetPath, 'utf8');
        if (normalizeCommandAdapterFingerprint(currentContent) !== normalizeCommandAdapterFingerprint(item.expectedContent || '')) {
          unexpectedSkip = true;
          result.skipped.push(item.relativePath);
          result.warnings.push(`Skipped stale removal because content changed after preview: ${item.relativePath}`);
          continue;
        }

        await fs.unlink(targetPath);
        result.removed.push(item.relativePath);
        continue;
      }

      // PROPOSAL-054: a user-owned root agent file edit (append / replace / regenerate).
      // Re-read and require RAW-byte equality with the previewed content before writing,
      // so a file the user changed (or deleted, or replaced with a non-file) between the
      // preview and the write is never clobbered — skip + warn + ask them to re-run. Raw
      // equality is intentionally stricter than the normalized compare used for stale
      // removal: any whitespace / EOL change counts as "changed after preview".
      if (item.rootInject) {
        let stats;
        try {
          stats = await fs.stat(targetPath);
        } catch (error) {
          if (error.code === 'ENOENT') {
            unexpectedSkip = true;
            result.skipped.push(item.relativePath);
            result.warnings.push(`Skipped Dflow block update because ${item.relativePath} no longer exists; re-run to inject the Dflow block.`);
            continue;
          }
          throw error;
        }
        if (!stats.isFile()) {
          unexpectedSkip = true;
          result.skipped.push(item.relativePath);
          result.warnings.push(`Skipped Dflow block update because ${item.relativePath} is no longer a regular file; re-run to inject the Dflow block.`);
          continue;
        }
        const currentRaw = await fs.readFile(targetPath, 'utf8');
        if (currentRaw !== item.expectedContent) {
          unexpectedSkip = true;
          result.skipped.push(item.relativePath);
          result.warnings.push(`Skipped Dflow block update because ${item.relativePath} changed after the preview; re-run to inject the Dflow block.`);
          continue;
        }
        if (item.content === currentRaw) {
          result.skipped.push(item.relativePath);
          continue;
        }
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, item.content);
        result.updated.push(item.relativePath);
        continue;
      }

      if (await pathExists(targetPath)) {
        if (item.overwrite) {
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, item.content);
          result.updated.push(item.relativePath);
          continue;
        }

        result.skipped.push(item.relativePath);
        // PROPOSAL-054: an intentional skip (an already-configured agent file, or an
        // already-current Dflow block) is expected, not a problem — don't emit the
        // generic "skipped existing target" warning for it.
        if (!item.intentionalSkip) {
          unexpectedSkip = true;
          result.warnings.push(`Skipped existing target: ${item.relativePath}`);
        }
        if (item.relativePath === 'dflow/specs/shared/_conventions.md') {
          result.warnings.push(
            'Prose language was not written because dflow/specs/shared/_conventions.md already exists. Ensure it contains exactly one ## Prose Language section before running prose-generating flows.'
          );
        }
        continue;
      }

      // PROPOSAL-054: a plan item previewed as "skip" (an already-configured agent
      // file, or an already-current Dflow block) must never write. If its target
      // vanished between preview and write, do nothing — do NOT silently create a
      // file the preview said would be left alone.
      if (item.action === 'skip') {
        result.skipped.push(item.relativePath);
        continue;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, item.content, { flag: 'wx' });

      if (item.relativePath === 'dflow/specs/shared/_conventions.md') {
        const written = await fs.readFile(targetPath, 'utf8');
        const count = (written.match(/^## Prose Language$/gm) || []).length;
        if (count !== 1) {
          throw new Error('written _conventions.md does not contain exactly one ## Prose Language section');
        }
      }

      result.created.push(item.relativePath);
    } catch (error) {
      if (error.code === 'EEXIST') {
        let targetExists = false;
        try {
          targetExists = await pathExists(targetPath);
        } catch {
          targetExists = false;
        }

        if (targetExists) {
          // A previewed create raced against a concurrent creation — the
          // previewed change did not apply, so it blocks requiresFullApply
          // items exactly like the pre-write guard skips above.
          unexpectedSkip = true;
          result.skipped.push(item.relativePath);
          result.warnings.push(`Skipped existing target: ${item.relativePath}`);
          continue;
        }

        throw new WritePhaseError(
          `Cannot create parent directory for ${item.relativePath}: a parent path is a file.`,
          result
        );
      }

      const message = item.action === 'remove'
        ? `Write failed while removing ${item.relativePath}: ${error.message}`
        : error.code === 'ENOTDIR' || error.code === 'EEXIST'
          ? `Cannot create parent directory for ${item.relativePath}: a parent path is a file.`
          : `Write failed while creating ${item.relativePath}: ${error.message}`;
      throw new WritePhaseError(message, result);
    }
  }

  return result;
}

function collectUnresolvedPlaceholderWarnings(plan, createdPaths) {
  const createdSet = new Set(createdPaths);
  const unresolvedInitPlaceholders = new Set(plan.unresolvedInitPlaceholders || []);
  const placeholders = new Set();

  if (unresolvedInitPlaceholders.size === 0) {
    return [];
  }

  const placeholderFiles = new Set();
  for (const item of plan.items) {
    if (!createdSet.has(item.relativePath)) {
      continue;
    }
    const matches = item.content.match(/{[^{}\n]+}/g) || [];
    const hits = matches.filter((match) => unresolvedInitPlaceholders.has(match));
    hits.forEach((match) => placeholders.add(match));
    if (hits.length > 0) {
      placeholderFiles.add(item.relativePath);
    }
  }

  if (placeholders.size === 0) {
    return [];
  }

  const sorted = Array.from(placeholders).sort();
  const shown = sorted.slice(0, 25).join(', ');
  const suffix = sorted.length > 25 ? `, and ${sorted.length - 25} more` : '';
  const files = Array.from(placeholderFiles).sort();
  const filesShown = files.slice(0, 10).join(', ');
  const filesSuffix = files.length > 10 ? `, and ${files.length - 10} more` : '';
  return [`Unresolved placeholders remain for later SDD workflows: ${shown}${suffix}. Fill them in (or leave for the workflow to resolve) in: ${filesShown}${filesSuffix}.`];
}

function printResultReport(stdout, result, deferred) {
  stdout.write('\nCreated:\n');
  printList(stdout, result.created);

  stdout.write('\nUpdated:\n');
  printList(stdout, result.updated);

  stdout.write('\nRemoved:\n');
  printList(stdout, result.removed);

  stdout.write('\nSkipped:\n');
  printList(stdout, result.skipped);

  stdout.write('\nWarnings:\n');
  printList(stdout, dedupe(result.warnings));

  if (deferred.length > 0) {
    stdout.write('\nDeferred:\n');
    deferred.forEach((item) => stdout.write(`- ${item.relativePath} - ${item.reason}\n`));
  }
}

// PROPOSAL-074 / PROPOSAL-037: generated skill files are Dflow-managed derivatives;
// the recommended default is gitignore + re-project after clone.
const SKILL_VERSION_CONTROL_STEP = '- Project-level skill files (.claude/skills/, .agents/skills/, .github/skills/) are Dflow-managed derivatives: the recommended default is to gitignore them and re-run `dflow configure-agents --skills` after cloning; committing them also works if the team prefers.\n';

function printNextSteps(stdout, skillsInstalled = false) {
  const skillStep = skillsInstalled ? SKILL_VERSION_CONTROL_STEP : '';
  stdout.write(`
Dflow init complete.

Recommended next steps:
- For a new feature, use the Dflow new-feature workflow when it becomes available as a CLI command.
- For brownfield changes, use the Dflow modify-existing workflow when it becomes available as a CLI command.
- Before generating more specs, make sure dflow/specs/shared/_conventions.md has the correct Prose Language section.
- For stack-specific examples (.NET, Java/Spring, Node/TypeScript, Python, Go, PHP/Laravel), see docs/examples-by-stack.md in the Dflow repo.
${skillStep}`);
}

function printConfigureAgentsNextSteps(stdout, commandAdapters = false, snippetFallback = false, skillsInstalled = false) {
  const commandAdapterStep = commandAdapters
    ? '- Command adapters use tool-specific invocation names: Claude Code `/dflow:<id>`; GitHub Copilot prompt menu `/dflow-<id>` or canonical `/dflow:<id>` as text; Codex CLI plain text without a slash, such as `dflow:status`. Canonical `/dflow:*` names remain defined in dflow/specs/shared/AI-AGENT-GUIDE.md. If upgrading from Dflow 0.5.0, stale `.claude/commands/dflow/dflow-*.md` files generated by 0.5.0 are detected and listed for removal in the confirmation preview, so Claude Code does not show both old and new command names; edited or non-Dflow files are kept with a warning.\n'
    : '';

  // PROPOSAL-054: Dflow now auto-injects the marker-delimited block into existing
  // agent files, so the merge-snippet step is shown only when a genuine-conflict
  // fallback snippet was actually written this run.
  const snippetStep = snippetFallback
    ? '- A merge snippet was written because an existing agent file had conflicting Dflow markers; review it, fix or remove the stray markers, then merge the Dflow block into that file (or re-run to let Dflow manage it).\n'
    : '';

  const skillStep = skillsInstalled ? SKILL_VERSION_CONTROL_STEP : '';

  stdout.write(`
Dflow AI agent configuration complete.

Recommended next steps:
- Keep AI-agent-specific root files small.
- Put durable workflow changes in dflow/specs/shared/AI-AGENT-GUIDE.md.
${snippetStep}${skillStep}${commandAdapterStep}`);
}

function printList(stdout, values) {
  if (!values || values.length === 0) {
    stdout.write('- (none)\n');
    return;
  }
  values.forEach((value) => stdout.write(`- ${value}\n`));
}

function writeWarnings(stderr, warnings) {
  warnings.forEach((warning) => stderr.write(`${warning}\n`));
}

async function pathExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function currentLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compareVersions(actual, minimum) {
  const actualParts = actual.split('.').map(Number);
  const minimumParts = minimum.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    const actualPart = actualParts[index] || 0;
    const minimumPart = minimumParts[index] || 0;
    if (actualPart > minimumPart) {
      return 1;
    }
    if (actualPart < minimumPart) {
      return -1;
    }
  }

  return 0;
}

function displayOptionNumber(options, key) {
  const index = options.findIndex((option) => option.key === key);
  return index === -1 ? '?' : String(index + 1);
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTrack(track) {
  return track === 'greenfield' ? 'Greenfield' : 'Brownfield';
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function dedupe(values) {
  return Array.from(new Set(values));
}

async function runDoctor(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;

  try {
    if (compareVersions(process.versions.node, MIN_NODE_VERSION) < 0) {
      throw new InitError(`Dflow doctor requires Node.js ${MIN_NODE_VERSION}+.`, 1);
    }

    const findings = [];
    await checkConventionsParserUncertainty(cwd, findings);
    await checkConventionsDflowVersion(cwd, findings);
    await checkConventionsVersionReconciled(cwd, findings);
    await checkConventionsPolicyFormat(cwd, findings);
    await checkGuideCanonicalState(cwd, findings);
    await checkGuideProjectContextFormat(cwd, findings);
    await checkGuideSectionRefs(cwd, findings);
    await checkInitOnlyStarters(cwd, findings);
    await checkFeatureIndexShape(cwd, findings);
    await checkSpecTableConventionComment(cwd, findings);
    await checkRootAgentShims(cwd, findings);
    await checkWorkflowBundleSourceAndOrphans(cwd, findings);
    await checkBundleManifestVersion(cwd, findings);

    printDoctorReport(stdout, cwd, findings);
    return 0;
  } catch (error) {
    if (error instanceof InitError) {
      stderr.write(`${error.message}\n`);
      return error.exitCode;
    }
    stderr.write(`${error && error.message ? error.message : error}\n`);
    return 1;
  }
}

// FOUR doctor checks read `dflow/specs/shared/_conventions.md`, and each used to
// decide separately what an unusable file was. They agreed about ABSENT (all
// early-returned) and disagreed about BLANK: the drift check in
// `checkInitOnlyStarters` deliberately collapses a blank file to one finding —
// its comment says three fingerprint findings about a file with no content is
// noise — while these three carried on and emitted four more. So the
// suppression was defeated by its own siblings and a blank file produced five
// findings, which `p082-b3-g1` finding 1 caught.
//
// ⚠ THE COUPLING THIS CREATES IS THE THING TO WATCH. Returning null here means
// these three checks say NOTHING about an absent or blank file, and that is only
// safe because `checkInitOnlyStarters` always runs and always reports it. Both
// facts are load-bearing: `runDoctor` calls it unconditionally, and its
// `conventionsAbsent || !conventions.trim()` branch has no early return in front
// of it. Break either and the worst state of the file becomes silent everywhere
// — the exact failure this subsystem exists to prevent. `test/upgrade-drift.mjs`
// pins the count for absent and blank so the coupling cannot rot quietly.
async function readConventionsForCheck(cwd) {
  const conventionsPath = path.join(cwd, 'dflow', 'specs', 'shared', '_conventions.md');
  if (!(await pathExists(conventionsPath))) return null;
  const content = await fs.readFile(conventionsPath, 'utf8').catch(() => '');
  return content.trim() ? content : null;
}

// PROPOSAL-084. Two `affects` sets, split because the gaps fail through two
// different mechanisms and merging them would overstate one of them.
//
// VISIBILITY gaps change which TEXT counts as live, so everything that reads the
// file through `visibleTextLines` is affected.
const CONVENTIONS_VISIBILITY_AFFECTS = [
  'the `_conventions.md` convention-drift fingerprints',
  'whether the `## Git Policy` / `## AI Commit Policy` / `## Prose Language` sections are present, and the policy values read from them',
  // ⚠ ADDED after `p084-y1` finding 4 measured it: the starter checks are DOWNSTREAM
  // of the policy value, not a sibling of it. `We use trunk here <!-- Selected Git
  // policy: `gitflow` -->` makes `parseContextLine` return `gitflow`, which passes
  // the value check, and `checkInitOnlyStarters` then reports on
  // `Git-principles-gitflow.md` while saying nothing about the file the project
  // actually uses. Naming the value but not what the value drives understates the
  // blast radius, and this list is printed to users as measured fact.
  'the `Git-principles-*.md` starter checks, which are driven off the Git policy value',
  'dangling `§` references from `_conventions.md` into `AI-AGENT-GUIDE.md`'
];
// BOUNDARY gaps move where a SECTION ends. The policy VALUES are read line-wise
// by `parseContextLine` and do not depend on section extent, so they are named as
// unaffected rather than quietly folded in — an `affects` list is read as
// measured, and padding it is the same false-precision this state exists to stop.
const CONVENTIONS_BOUNDARY_AFFECTS = [
  'the `_conventions.md` convention-drift fingerprints',
  'whether the `## Git Policy` / `## AI Commit Policy` / `## Prose Language` sections are present (the policy VALUES are read line-wise and this shape does not affect them)'
];

// ⚠ SCOPE: the two files whose CONTENT doctor makes claims about —
// `_conventions.md` and `AI-AGENT-GUIDE.md` — and the boundary is measured rather
// than cautious. Running these over the packaged tree finds the inline-comment
// shape in both tracks' `phase-spec.md` templates, where `## Problem Description
// <!-- Fill timing: ... -->` is a deliberate authoring convention, so widening the
// scan to every spec file would make every project report uncertain forever —
// which is how a disclosure becomes noise the user learns to skip. The two scanned
// files are clean in every PACKAGED copy, so a fresh init is silent
// (invariant 4).
//
// ⚠ The guide was EXCLUDED in the first draft, on the stated ground that its
// false-positive cost "has not been measured". `p084-y1` finding 8 measured it —
// 0 hits across all seven guides in this tree, for all four detectors — and
// demonstrated the silent pass the exclusion was leaving open: a commented-out
// value in the `## Project Context` table makes `parseContextLine` return the
// comment text itself as the live value, `configure-agents` writes that into
// generated prose, and a reader sees an empty cell. Once the reason for a boundary
// is falsified the boundary goes, rather than the reason being rewritten to fit.
const GUIDE_UNCERTAINTY_AFFECTS = [
  'the `## Project Context` values (`Tech stack`, `Migration / legacy context`) that `dflow configure-agents` reads back when it regenerates guide prose',
  'whether the `## Project Context` section is found at all, and the drift report about its rows',
  // ⚠ ADDED after `p084-xv1` measured the omission. The dangling-`§` check resolves
  // workflow-bundle references against THIS file's headings, via
  // `extractHeadings` -> the same classification a shape can disturb. Listing only
  // the Project Context concerns told the user the rest of the guide's checks were
  // still trustworthy, which is the precise false reassurance an `affects` list
  // exists to prevent.
  'whether `AI-AGENT-GUIDE.md § ...` references from the workflow bundle resolve, since that check reads this file\'s headings'
];
// ⚠⚠ THE `<textarea>` MITIGATION, SPELLED ONCE AND PREFIXED TO BOTH COMMENT IDS.
// A `<textarea>` comment is reported deliberately (see the block comment above
// `THERE IS NO TEXTAREA EXEMPTION HERE` in `doctor-checks` — grep that phrase — for
// why the exemption was removed rather than patched a fourth time), so the *only* thing standing between the user and an edit
// that hides their visible text is this sentence.
// ⚠ It has to be on BOTH ids, and putting it on one was a real defect
// (`p084-xv11` finding 1): `<textarea><!-- rule --></textarea>` on ONE line does not
// start its line's content, so the partition correctly calls it `inline-html-comment`
// — and that id's action says "move the comment to a line of its own at column 0",
// which is exactly the edit that turns displayed raw text into a hidden comment.
// The multi-line form routes to `comment-inside-container` and was safe. One shape,
// two ids, one of them unprotected.
// ⚠ Spelled once and shared, not copied into both strings: two copies of a rule is
// this codebase's oldest defect class, and this rule has already been rewritten
// three times. The first-hit warning matters because each detector emits at most one
// finding per file: a harmless textarea hit can shadow a later, genuinely hidden hit.
const TEXTAREA_LEAVE_IT_ALONE = '⚠ FIRST, if the cited comment sits inside a `<textarea>`: leave that line alone. A `<textarea>` holds raw text, so moving it out would hide text the reader can already see. But do NOT ignore the overall uncertainty result or treat the affected checks as trusted: Dflow reports only the first occurrence of each shape in a file, so this harmless line can precede and shadow a genuinely hidden comment with the same id. Inspect the rest of the cited file for other apparent comment openers before treating those checks as reliable. For a non-`<textarea>` occurrence: ';
// ⚠ This scope is part of the repair contract. The markerless continuation case
// deliberately follows the renderer Dflow ships; CommonMark-family renderers can
// expose the apparent opener instead, so universal "the reader sees nothing" prose
// would send some users to edit content their actual publishing path displays.
const MARKED_COMMENT_CALIBRATION = '⚠ A markerless continuation of list-owned raw HTML is calibrated to the renderer Dflow ships (`dflow render`, powered by Marked). Another Markdown renderer may expose an escaped apparent opener there; if you publish through a different renderer, inspect its rendered output before applying this repair. ';
const CONVENTIONS_UNCERTAINTY_DETECTORS = [
  {
    id: 'inline-html-comment',
    title: 'an HTML comment begins part-way through a line',
    locate: (content) => doctorChecks.inlineHtmlCommentLine(content),
    detail: 'Dflow classifies Markdown one line at a time, so a comment that opens mid-line is not a block to it and its contents are counted as live document text — while `dflow render` normally shows no comment text there. A rule, policy value or heading word sitting inside such a comment therefore reads as still present after it has been switched off.',
    // ⚠⚠ THIS ACTION USED TO SEND THE USER INTO AN UNDISCLOSED SILENT PASS
    // (`p084-y1` finding 1). It said "move the comment onto a line of its own",
    // full stop — and the natural way to do that inside a list item is to indent
    // it under the item, where NOTHING fires and the text is still read. The
    // column matters, so the column is now what the sentence says.
    action: TEXTAREA_LEAVE_IT_ALONE + MARKED_COMMENT_CALIBRATION + 'move the comment to a line of its own that starts at column 0, outside any CONTAINER — a list item, a block quote, or an HTML block such as `<details>`. There it opens a real HTML block of its own and its contents stop being read. Deleting it works too. ⚠ Indenting it under a list item is NOT enough: it stays inside the item, where Dflow still reads it. ⚠ And if the comment is inside an HTML block, column 0 alone is NOT enough either — you are still inside the block, and `comment-inside-container` will report it on the next run. The explainer page section for that id has the per-tag rule for leaving an HTML block.',
    affects: CONVENTIONS_VISIBILITY_AFFECTS
  },
  {
    id: 'comment-inside-container',
    title: 'an HTML comment sits inside a container whose interior Dflow does not parse, where its text is still read',
    // ⚠ REPLACES `unclosed-html-in-container`, which asked the wrong question.
    // That one fired on an UNTERMINATED comment the document-level scan had
    // missed; measured, any later `-->` in the file silenced it — including the
    // one `unclosed-html-block`'s own action tells the user to add — while the
    // hidden rule stayed hidden. Termination was never the issue: a properly
    // closed comment inside a list item hides its text from a reader just as
    // completely, and Dflow reads it either way.
    locate: (content) => doctorChecks.containerHtmlCommentLine(content),
    detail: 'Dflow does not parse the interior of a container as its own sequence of blocks — a list item and a block quote are the common cases, and an HTML block such as `<details>` behaves the same way. A comment opened inside one therefore never opens an HTML block as far as Dflow is concerned: `dflow render` normally shows no comment text there, while Dflow goes on counting the comment\'s contents as live document text. This holds whether or not the comment is closed, and whatever the container turns out to be.',
    // ⚠⚠ THE HTML-BLOCK HALF NAMES THE TAG, and a blanket rule here was wrong for
    // two of them (`p084-xv3`). "A blank line ends the block, a closing tag does
    // not" is CommonMark's TYPE-6 rule. `<pre>` and `<textarea>` are type 1: they
    // end at their own closing tag, and they reach this id — measured, a comment
    // inside `<pre>` reports, adding the blank line the old sentence prescribed
    // does NOT clear it, and moving below `</pre>` (which the old sentence said
    // would not work) does. So the shipped repair was exactly backwards for them.
    // `<script>` and `<style>` are type 1 too but never reach here — their
    // interiors are already invisible, so nothing is hidden from a reader that was
    // not hidden anyway — which is why they are not named.
    // ⚠⚠ `<textarea>` WAS named here as a repair case for one round and that was
    // wrong twice over (`p084-xv4` finding 1): it holds raw text, so the comment is
    // displayed and there is nothing to disclose, and the advice given for it —
    // move below the closing tag — is the one edit that would genuinely hide it.
    // ⚠⚠⚠ EVERY `<textarea>` COMMENT IS NOW REPORTED, and the leading clause in the
    // action is the whole mitigation. Three rounds were spent suppressing that false
    // positive and each attempt produced a SILENT PASS instead (`p084-xv5`, `xv9`,
    // `xv10`); the exemption was removed rather than patched a fourth time. The full
    // account is under `THERE IS NO TEXTAREA EXEMPTION HERE` in `doctor-checks`.
    // Reporting is the NOISY direction, which the maintainer twice chose in this same
    // area (2026-08-09). **Do not "tidy" the `<textarea>` clause away** — without it
    // the finding sends a user to make the one edit that genuinely hides their text.
    // ⚠ The outermost-container sentence is not decoration either: with a `<pre>`
    // inside a list item, applying only the `<pre>` rule leaves the comment in the
    // list item and the finding fires again on the next run.
    // ⚠ Concatenation, not a template literal: this string carries backticked code
    // spans (`<pre>`, `>`), which end a template literal on the spot.
    action: TEXTAREA_LEAVE_IT_ALONE + MARKED_COMMENT_CALIBRATION + 'move the comment out of the enclosing container — or delete it. Leaving the container is the whole repair. ⚠ When the comment sits inside MORE THAN ONE container — a `<pre>` inside a list item, a `<details>` inside a block quote — the OUTERMOST one is the one you have to leave: repair only the inner one and the finding comes back unchanged. For a list item or block quote, put the comment on a line of its own at column 0 with no list marker or `>` before it. For an HTML block the rule depends on the tag — `<pre>` ends at its own `</pre>`, so move the comment below that; every other block (`<details>`, `<div>`, …) ends at a BLANK LINE and not at a closing tag, so put a blank line between the block and the comment, or move the comment above the block entirely. Re-indenting the COMMENT inside the container never helps. (One thing that does help, and only for the fenced-example case the explainer page describes: un-indenting the FENCE itself to three spaces or fewer.)',
    affects: CONVENTIONS_VISIBILITY_AFFECTS
  },
  {
    id: 'html-block-type-7',
    title: 'a bare custom tag stands at the start of a block, directly above a `---` or `===` line',
    locate: (content) => doctorChecks.htmlBlockType7Line(content),
    detail: 'A complete tag whose name is not one of CommonMark\'s known block tags, alone on a line, is HTML block type 7 — the only type that cannot interrupt a paragraph, and the only one that needs a real tag parser to recognise. Dflow does not implement it, so where this shape meets a following underline it ends the section earlier than a renderer does. This one is usually loud — it reports drift that is not there — but it is NOT only loud: ending the section early also drops the tail of it, so a retired row below the shape stops being seen and its finding disappears. Treat results about that section as unknown in both directions.',
    action: 'Put a blank line between the tag and the underline, or fence the tag as an example if it is being shown rather than used.',
    affects: CONVENTIONS_BOUNDARY_AFFECTS
  }
];

// ⚠⚠ `table-delimiter-cell-count` USED TO BE THE FIFTH ENTRY HERE, AND ITS REMOVAL
// IS A DECISION, NOT AN OVERSIGHT (user, 2026-08-12). It reported a table whose
// delimiter row carried a different number of cells from its header, on the
// grounds that Dflow and the renderer can then disagree about where the section
// ends. That harm is real and is still real — it is recorded, with owner and
// gate, as `doctor-section-boundary-arbiter` in `planning/opt-in-backlog.md`.
// What could not be made to work was the DETECTOR. Six consecutive review rounds
// each found a document it stayed silent on, and silence here is the direction
// that prints `All checks passed` over a drifted file:
//   `x7` bare pair, `y3` multi-line dash, `y4` equals family, `x13`/`y5`
//   underline-shaped first prose line, `x14`/`y6` indented first prose line,
//   `y7` single-hyphen delimiter row.
// Narrowing it to measured shapes failed five times; widening it back to every
// mismatch failed on the sixth, because the remaining enumeration had moved into
// the delimiter-row recogniser. And `y6` measured the same silent false clean
// with a delimiter row whose cell count was CORRECT — so this detector's scope
// was a strict subset of the harm and no version of it could close it.
// ⚠ The durable fix is a different instrument, not a better shape list: `marked`
// is already a runtime dependency, so the section boundary can be taken FROM the
// renderer instead of guessed alongside it. That is a design change with its own
// review, which is why this ships as a stated gap instead of a sixth repair.
// Both explainer pages name it under "shapes that are known and deliberately not
// reported", beside the table-indent gap it now sits next to.


// The document-level unclosed block is a condition on the whole file rather than
// one of the narrower shape detectors. It still runs through the same two-file
// target loop: both `_conventions.md` and `AI-AGENT-GUIDE.md` feed the classifier.
const UNCLOSED_HTML_BLOCK_ID = 'unclosed-html-block';

function unclosedHtmlBlockUncertainty(rel, line, affects) {
  return uncertainFinding({
    id: UNCLOSED_HTML_BLOCK_ID,
    title: `${rel} has an unclosed HTML block at line ${line}`,
    // BOTH DIRECTIONS: text below the opener can produce artefact findings, and
    // genuine drift can disappear because the checks no longer see that text.
    detail: `Everything from that line to the end of the file is inside that block, so it is not ordinary document content and Dflow cannot assess results below it. This cuts both ways: a finding below this one may be caused by the unclosed block rather than by real drift, AND a rule that genuinely has drifted below it can go unreported entirely, because the block hides the text the check would have read. Treat every result about content below this line as unknown — not as passing.`,
    affects,
    action: 'Close the block (for an HTML comment, add `-->`), then re-run `dflow doctor`.'
  });
}

// ⚠ Every id doctor can print, in one place, because each one is a PROMISE that
// `docs/doctor-uncertainty.md` / `.en.md` carries a section explaining that
// shape. A shipped message pointing at a page section that does not exist is
// precisely the failure this proposal was created to retire — the durable fix was
// moving the per-container explanation onto a page that can be revised, and that
// only works while the id and the section agree. `test/upgrade-drift.mjs` asserts
// the correspondence in both directions against both languages.
const DOCTOR_UNCERTAINTY_IDS = [
  UNCLOSED_HTML_BLOCK_ID,
  ...CONVENTIONS_UNCERTAINTY_DETECTORS.map((d) => d.id)
];

// PROPOSAL-084: report the shapes this module is known to read unreliably, so a
// project containing one never receives the same `All checks passed` a genuinely
// clean project gets. Reads the same guarded content the sibling checks read, so
// an absent or blank file stays the drift check's single finding rather than
// picking up four more (the coupling described above `readConventionsForCheck`).
async function checkConventionsParserUncertainty(cwd, findings) {
  // ⚠⚠ PUSH ORDER HERE DOES NOT DECIDE PRINT ORDER, and two review rounds reached
  // OPPOSITE conclusions about that, so the measurement is recorded rather than
  // the argument. `unclosed-html-block` moved into this loop, and the comment that
  // moved with it claimed the finding had to be emitted BEFORE the drift findings
  // "because it changes what they mean". `p084gate-y5` read the relocation as
  // having reversed a deliberate contract and filed it as a must-fix regression;
  // `p084gate-y4` had already called the same deletion a correction.
  // Measured 2026-08-12 on a project carrying BOTH a retired rule row and an
  // unclosed block, run through the real CLI on this tree and on the tree before
  // this batch: **identical output order in both** — `[warn]` first, `[uncertain]`
  // fourth lines later. `runDoctor` groups by category and prints assessed before
  // uncertain regardless of the order anything is pushed here, and did so before
  // this batch too. So the contract the old comment stated was never honoured by
  // the printer, the relocation changed nothing about it, and there is no
  // regression to repair. If you want that ordering, it has to be implemented in
  // the printer — a comment here cannot buy it.
  //
  // ⚠ Same detectors, two files, DIFFERENT `affects` — the shape is a property of
  // the Markdown, but which checks it blinds is a property of the file. Sharing
  // one list across both would put a claim about `_conventions.md`'s drift
  // fingerprints into a finding about the guide.
  const targets = [
    {
      rel: 'dflow/specs/shared/_conventions.md',
      content: await readConventionsForCheck(cwd),
      affects: null // per-detector; the conventions lists distinguish visibility from boundary
    },
    {
      rel: AI_AGENT_GUIDE_DEST,
      content: (await fs.readFile(path.join(cwd, AI_AGENT_GUIDE_DEST), 'utf8').catch(() => '')) || null,
      affects: GUIDE_UNCERTAINTY_AFFECTS
    }
  ];
  for (const target of targets) {
    if (target.content === null || !target.content.trim()) continue;
    const unclosedAt = doctorChecks.unclosedHtmlBlockLine(target.content);
    if (unclosedAt !== -1) {
      findings.push(unclosedHtmlBlockUncertainty(
        target.rel,
        unclosedAt,
        target.affects || CONVENTIONS_VISIBILITY_AFFECTS
      ));
    }
    for (const detector of CONVENTIONS_UNCERTAINTY_DETECTORS) {
      const line = detector.locate(target.content);
      if (line === -1) continue;
      findings.push(uncertainFinding({
        id: detector.id,
        title: `${target.rel}, line ${line}: ${detector.title}`,
        detail: detector.detail,
        affects: target.affects || detector.affects,
        action: detector.action
      }));
    }
  }
}

async function checkConventionsDflowVersion(cwd, findings) {
  const content = await readConventionsForCheck(cwd);
  if (content === null) return;
  if (!/^> Dflow Version:/m.test(content)) {
    findings.push({
      level: 'info',
      title: 'dflow/specs/shared/_conventions.md missing Dflow Version line',
      detail: 'V1 init writes a `> Dflow Version: <x.y.z>` line in the front matter automatically. This project predates that convention.',
      action: 'Optionally add the line manually so future migration / review can identify the spec convention version.'
    });
  }
}

// PROPOSAL-058 (user decision 2026-06-08, OQ2): `> Dflow Version:` records the
// Dflow version this project last reconciled with (`dflow configure-agents`
// advances it). Behind the CLI means the Dflow-managed layers may be stale and
// the user-owned layers unreviewed since the upgrade.
async function checkConventionsVersionReconciled(cwd, findings) {
  const content = await readConventionsForCheck(cwd);
  if (content === null) return;
  const match = content.match(/^> Dflow Version:[ \t]*(.*)$/m);
  if (!match) return; // absence is checkConventionsDflowVersion's finding
  const recorded = match[1].trim();
  // Prerelease suffixes are valid package versions (the smoke test's own
  // Dflow-Version assertion allows them), so they must not read as "not a
  // version" noise on a fresh init of a prerelease build.
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(recorded)) {
    findings.push({
      level: 'info',
      title: `_conventions.md Dflow Version line is not a plain x.y.z version: \`${recorded}\``,
      detail: 'The line records which Dflow version the project last reconciled with; doctor cannot compare this value against the CLI.',
      action: `Set it to the Dflow version the project is actually aligned to; \`dflow configure-agents\` keeps it current from then on (CLI is ${pkg.version}).`
    });
    return;
  }
  if (recorded === pkg.version) return;
  if (compareVersions(recorded, pkg.version) < 0) {
    findings.push({
      level: 'info',
      title: `Project last reconciled with Dflow ${recorded}; this CLI is ${pkg.version}`,
      detail: 'Dflow-managed layers (workflow bundle, guide canonical content, adapters) may be stale, and user-owned layers may need review against the newer version.',
      action: 'Run `dflow configure-agents` to re-project the Dflow-managed layers and update the line, then review the upgrade guide for user-owned surfaces: https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/upgrading.en.md (offline copy: docs/upgrading.en.md in the installed package).'
    });
  } else {
    findings.push({
      level: 'info',
      title: `Project was reconciled with Dflow ${recorded}, newer than this CLI (${pkg.version})`,
      detail: 'Running an older CLI against a newer project layout can re-project older content over newer files.',
      action: 'Upgrade the dflow package before re-running `dflow init` / `dflow configure-agents` here.'
    });
  }
}

// PROPOSAL-058 direction 2 (b): the policy sections are machine-read — context
// inference for configure-agents parses the exact line formats in
// lib/doctor-checks.js. A section that drifted from the canonical format makes
// inference return null, and code paths that need a policy default a null to
// `trunk` / `none`, so drift here risks a silent policy flip on any future
// re-projection that writes these sections.
async function checkConventionsPolicyFormat(cwd, findings) {
  const content = await readConventionsForCheck(cwd);
  if (content === null) return;

  const sections = [
    {
      heading: '## Git Policy',
      key: 'Git Policy',
      re: doctorChecks.GIT_POLICY_LINE_RE,
      values: doctorChecks.GIT_POLICY_VALUES,
      example: 'Selected Git policy: `gitflow`',
      nullEffect: 'a null Git policy defaults to `trunk` wherever a policy value is required'
    },
    {
      heading: '## AI Commit Policy',
      key: 'AI Commit Policy',
      re: doctorChecks.AI_COMMIT_MARKER_LINE_RE,
      values: doctorChecks.AI_COMMIT_MARKER_VALUES,
      example: 'AI commit marker: `none`',
      nullEffect: 'an unrecognized marker value falls back to `none`'
    },
    {
      heading: '## Prose Language',
      key: 'Prose Language',
      re: doctorChecks.PROSE_LANGUAGE_LINE_RE,
      values: null,
      example: 'Project prose language: `en`',
      nullEffect: 'prose-generating flows lose the project language setting'
    }
  ];

  // Locate the section through the SAME recognizer the drift check uses, not a
  // bespoke `^## X$`. That regex demanded an unindented heading of exactly
  // level 2, while `doctor-checks.headingAt` follows CommonMark and accepts a
  // 1-3 space indent — so `   ## Git Policy` was reported missing by this check
  // and found by the other, on a file whose policy line `parseContextLine` read
  // perfectly well (`p082-b3-g1` finding 2).
  //
  // ⚠ This deliberately WIDENS what counts as present, including to other
  // heading levels, and that is not a loosening of the contract being enforced:
  // inference (`parseContextLine`) is a whole-file match that never looks at the
  // heading at all. The heading test is only a locator for "is this section
  // here", so demanding a level and an indent was stricter than the thing it
  // protects — it produced false "missing" reports, not extra safety.
  for (const section of sections) {
    if (doctorChecks.conventionsSectionBodies(content, section.key).length === 0) {
      findings.push({
        level: 'warn',
        title: `_conventions.md is missing the ${section.heading} section`,
        detail: 'Newer Dflow init projects always carry it; existing projects are not auto-migrated (user-owned file).',
        action: `Copy the section from a fresh \`dflow init\` project and set your value (canonical line: \`${section.example}\`).`
      });
      continue;
    }
    const value = doctorChecks.parseContextLine(content, section.re);
    if (value === null || (section.values && !section.values.has(value))) {
      findings.push({
        level: 'warn',
        title: `_conventions.md ${section.heading} line is not machine-readable`,
        detail: `Dflow parses a \`${section.example}\`-style line to infer project context; as written, inference returns null and ${section.nullEffect}.`,
        action: `Restore the canonical line format, e.g. \`${section.example}\`.`
      });
    }
  }
}

// PROPOSAL-058 direction 2 (a): guide manageability + canonical staleness. The
// canonical region is substitution-free by design (a test guards that), so a
// current projection equals the packaged region byte-for-byte after LF
// normalization.
async function checkGuideCanonicalState(cwd, findings) {
  const guidePath = path.join(cwd, AI_AGENT_GUIDE_DEST);
  if (!(await pathExists(guidePath))) {
    if (await pathExists(path.join(cwd, WORKFLOW_BUNDLE_DEST))) {
      findings.push({
        level: 'warn',
        title: `${AI_AGENT_GUIDE_DEST} is missing but the workflow bundle is projected`,
        detail: 'Bundle flow files § reference the guide; without it agents lose routing, ceremony, and transparency rules.',
        action: 'Run `dflow configure-agents` to project the guide.'
      });
    }
    return;
  }
  const content = toLf(await fs.readFile(guidePath, 'utf8').catch(() => ''));
  const region = classifyMarkedRegion(content, GUIDE_CANONICAL_SECTION_START, GUIDE_CANONICAL_SECTION_END);
  if (region.state === 'malformed') {
    findings.push({
      level: 'warn',
      title: `${AI_AGENT_GUIDE_DEST} has malformed guide-canonical markers`,
      detail: '`dflow configure-agents` cannot locate the canonical region and will not refresh it.',
      action: 'Repair or remove the stray `<!-- dflow-generated: guide-canonical ... -->` markers, then re-run `dflow configure-agents`.'
    });
    return;
  }
  if (region.state === 'absent') {
    // Mirror the configure-agents bootstrap split: the adoption offer only
    // exists for a recognizable Dflow guide, so pointing an unrecognizable file
    // at the offer would be impossible advice.
    if (isRecognizableDflowGuide(content)) {
      findings.push({
        level: 'info',
        title: `${AI_AGENT_GUIDE_DEST} predates managed guide-canonical markers`,
        detail: 'Its canonical sections stay at the Dflow version that wrote them; upgrades cannot refresh them in place.',
        action: 'Re-run `dflow configure-agents` on an interactive terminal and accept the marker-adoption offer (your "## Project Context" is kept), or reconcile manually against a fresh `dflow init`.'
      });
    } else {
      findings.push({
        level: 'info',
        title: `${AI_AGENT_GUIDE_DEST} is not recognizable as a Dflow guide`,
        detail: 'It has no guide-canonical markers and lacks the Dflow guide shape (`# Dflow AI Agent Guide` title plus `## Project Context`), so `configure-agents` will not offer marker adoption and workflow-bundle § references may dangle.',
        action: 'If it should be Dflow-managed, rebuild it from a fresh `dflow init` comparison (carry your project notes over), or keep maintaining it yourself.'
      });
    }
    return;
  }
  const edition = await inferProjectBundleEdition(cwd);
  if (!edition) return;
  let packaged;
  try {
    packaged = await readPackagedTemplate(edition, 'scaffolding/AI-AGENT-GUIDE.md');
  } catch {
    return;
  }
  const packagedRegion = classifyMarkedRegion(packaged, GUIDE_CANONICAL_SECTION_START, GUIDE_CANONICAL_SECTION_END);
  if (packagedRegion.state !== 'present') return;
  if (content.slice(region.startIdx, region.endIdx) !== packaged.slice(packagedRegion.startIdx, packagedRegion.endIdx)) {
    findings.push({
      level: 'info',
      title: `${AI_AGENT_GUIDE_DEST} canonical content differs from this CLI version`,
      detail: 'The marker-guarded canonical region does not match what this Dflow version projects.',
      action: 'Run `dflow configure-agents` to refresh the canonical region in place (content outside the markers is kept).'
    });
  }
}

// PROPOSAL-076: the guide's "## Project Context" rows are the machine-readable
// source context inference reads (tech stack / migration context). Unlike the
// _overview.md rows the pre-076 inference looked for — which never existed in
// any packaged template, so their absence is canonical — these rows have
// shipped in every projected guide, so a missing or unparseable row here IS
// drift worth reporting. Info-level only: the inference fallback
// ('unknown'/'none') is benign, and rewriting Project Context is the user's
// designed freedom (PROPOSAL-058 boundary).
async function checkGuideProjectContextFormat(cwd, findings) {
  const guidePath = path.join(cwd, AI_AGENT_GUIDE_DEST);
  if (!(await pathExists(guidePath))) return; // missing guide is checkGuideCanonicalState's finding
  const content = toLf(await fs.readFile(guidePath, 'utf8').catch(() => ''));
  // Judge marker-managed guides and recognizable pre-marker guides. Anything
  // else already gets its own unrecognizable / malformed finding, where
  // row-level advice would be impossible advice. Deliberately NOT only the
  // adoption predicate: a marker-managed guide whose "## Project Context" was
  // deleted has fine markers and fails recognizability, yet inference just
  // lost its source — that is a finding, not a skip (gate G5).
  const markers = classifyMarkedRegion(content, GUIDE_CANONICAL_SECTION_START, GUIDE_CANONICAL_SECTION_END);
  if (markers.state !== 'present' && !isRecognizableDflowGuide(content)) return;
  const section = projectContextParseSlice(content);
  if (section === null) {
    // ⚠ REPORT THE CAUSE WHEN THERE IS ONE (`p082-b3-k3` gap G). An unclosed
    // `<!--` above the heading puts it inside an HTML block, so `classifyLines`
    // does not see a heading and the section reads as absent — while it is
    // sitting right there in the file. `_conventions.md` already names this
    // cause and gives the line number; the guide gave the opaque message below
    // instead, whose action ("restore the section") is impossible advice for a
    // file that already has one, and whose "ignore this if you removed it on
    // purpose" invites dismissing a real malformation. Same cause, same
    // reporting.
    // ⚠⚠ WHY THE PREDICATE IS THE SYMPTOM AND NOT `unclosedHtmlBlockLine`,
    // measured on a real init'd guide before this was written. The obvious
    // version — reuse the `_conventions.md` unclosed-block reporting, which is
    // what the review recommended — almost never fires here: `## Project
    // Context` sits ABOVE the guide-canonical markers, and those marker lines
    // contain `-->`, so a `<!--` left open above the heading is CLOSED by the
    // marker below it. The block is well-formed at EOF, `unclosedHtmlBlockLine`
    // returns -1, and the heading is still inside that block, still invisible to
    // `classifyLines`, still reported by the opaque message below. A cause check
    // that cannot fire in the shipped file's own shape is worse than none: it
    // reports nothing while looking like coverage.
    // So ask the question that actually distinguishes the two states: is the
    // heading IN the file while the parser cannot see it? Fenced examples are
    // blanked first, so a heading inside a ```md block does not count as the
    // section — this branch deliberately names no block for it.
    // ⚠ It does NOT follow that such a file returned earlier. `debt212223-y3`
    // finding 2 measured the opposite: the early return above is a CONJUNCTION,
    // `markers.state !== 'present' && !isRecognizableDflowGuide(content)`, so any
    // guide written by a current `dflow init` — markers present — runs through here
    // however unrecognizable its body is, and lands on the generic finding below.
    // The decision was right; the reason written under it was not, and in a module
    // where these comments are the contract that is the expensive kind of wrong.
    const scan = doctorChecks.blankFencedBlocks(content.replace(/^\uFEFF/, ''));
    const classified = doctorChecks.classifyLines(scan);
    // ⚠⚠ ASK `parseAtxHeading`, DO NOT WRITE A FIFTH ATX RULE (`debt212223-y1`
    // finding 1). The first version tested `/^ {0,3}##[ \t]+Project Context[ \t]*#*[ \t]*$/`,
    // which accepts `## Project Context###` — CommonMark strips a closing sequence
    // only when a space precedes it, so `parseAtxHeading` reads that line's text as
    // `Project Context###` and the file does NOT have the heading. The finding
    // claimed it did, and the repair it suggested provably did not clear it.
    // `projectContextSectionBounds`, two functions above, carries a ⚠ recording that
    // it was moved OFF hand-rolled ATX rules for exactly this: it had become a
    // fourth place deciding what a heading is, a patch behind its siblings. This
    // was the fifth. There is now one rule and it lives in `doctor-checks`.
    // ⚠ BOUNDARY, stated rather than left to be discovered: this recognises the
    // **ATX** form only. A setext-underlined `Project Context` that is hidden by an
    // HTML block falls through to the generic finding below, whose action covers the
    // hidden case in words rather than by naming the block.
    const rawHeadingAt = scan.findIndex((line) => {
      const parsed = doctorChecks.parseAtxHeading(line);
      return parsed !== null && parsed.level === 2 && parsed.text === 'Project Context';
    });
    if (rawHeadingAt !== -1 && classified[rawHeadingAt] && classified[rawHeadingAt].type === 'html') {
      // ⚠⚠ THE OPENING LINE COMES FROM THE CLASSIFIER, NOT FROM A SCAN OF OUR OWN.
      // Three consecutive review rounds each defeated a reverse-scan version of this
      // (`debt212223-xv1` F2 → `xv2` F1 → `xv3` F1): walking back over contiguous
      // `html` lines crossed into the block above; requiring a line-start `<!--`
      // still named comment- or tag-shaped lines that sit INSIDE an open block
      // (`prose <!-- y`, `<p>x</p>`), because "can this line open a block" is not a
      // property of the line — it depends on cross-line state only `classifyLines`
      // holds. Three rounds on one predicate is this repo's signal to change the
      // shape rather than add a fourth patch, so `classifyLines` now carries
      // `blockStart` and this reads it. The fallback is only for a classifier that
      // did not supply it; it cannot be reached through `type === 'html'` today.
      const openerAt = typeof classified[rawHeadingAt].blockStart === 'number'
        ? classified[rawHeadingAt].blockStart
        : rawHeadingAt;
      const openerLine = scan[openerAt].trim();
      const shownOpener = openerLine.length > 60 ? `${openerLine.slice(0, 60)}…` : openerLine;
      // ⚠⚠ ONE DECISION POINT, AND IT IS THE LINE-START RULE — not `includes('<!--')`
      // (`debt212223-xv4` finding 1). `<details><!-- note` opens a **type-6 tag**
      // block that merely contains a comment marker; advising `-->` there is advice
      // that does not work, and the reviewer confirmed by running it that the
      // heading stays inside the `<details>` afterwards and doctor repeats the same
      // finding. This is the SECOND site of this same rule in this change — the
      // opener scan was corrected for it one round earlier and this branch was left
      // behind, which is exactly the "fixed one member of the class" failure this
      // repo keeps paying for. Whoever touches either site greps for both.
      const openerIsComment = /^ {0,3}<!--/.test(scan[openerAt]);
      // ⚠⚠ IT REPORTS THE SHAPE, NOT A DIAGNOSIS, and the level matches that
      // (`debt212223-xv1` finding 1). The first version said "the section is
      // present in the file … do not add a second one" at `warn` — which is a
      // claim doctor cannot support: the same shape is produced by a comment left
      // open by accident (a live section is being swallowed) AND by a section the
      // adopter commented out on purpose (there is nothing to repair, and telling
      // them not to re-add it is telling them not to undo their own edit). It also
      // said "an HTML comment opens with `<!--` and runs until `-->`" on a block
      // that may be a `<details>`, sending `-->` advice about a tag that has none.
      // So: name the block that is actually there, quote its opening line, and let
      // the reader say which situation it is.
      findings.push({
        level: 'info',
        title: `${AI_AGENT_GUIDE_DEST} has a "## Project Context" heading at line ${rawHeadingAt + 1} that is inside an HTML block, so Dflow reads no Project Context section`,
        detail: `The block opens at line ${openerAt + 1} (\`${shownOpener}\`) and the heading sits inside it, so the heading is block content rather than a heading — \`dflow configure-agents\` falls back to \`unknown\` / \`none\` for tech stack and migration context. Two different situations produce exactly this shape and doctor cannot tell them apart: a block left open by accident is swallowing a live section, or the section was commented out deliberately.`,
        // ⚠⚠ THREE BRANCHES, BECAUSE "CLOSE IT" IS NOT ONE INSTRUCTION
        // (`debt212223-y4` finding 1). The previous version had two and told every
        // non-comment opener to "close it" — which is right for `<script>` / `<?` /
        // `<![CDATA[` and **provably useless for `<details>` and `<div>`**: a type-6
        // block ends at a BLANK LINE, so writing `</details>` above the heading
        // leaves the finding exactly as it was, with nothing telling the adopter
        // their repair was wrong. Measured both ways. And type 6 is precisely the
        // class this branch exists to serve, so it was the same "fixed one member of
        // the class" failure that `debt212223-xv4` had just closed one branch over.
        // ⚠ The deciding fact comes from `classifyLines` (`blockEndsOnBlank`), not
        // from re-inspecting the opener text here — that re-derivation is what cost
        // three earlier rounds.
        action: openerIsComment
          ? `If the comment at line ${openerAt + 1} was left open mid-edit, close it with \`-->\` above the heading and re-run \`dflow doctor\`. If the section is commented out on purpose, nothing is broken — inference will keep falling back.`
          : classified[rawHeadingAt].blockEndsOnBlank === true
            ? `A \`<details>\` / \`<div>\`-style block ends at a BLANK LINE, not at a closing tag — writing \`</...>\` above the heading will not free it. If the block at line ${openerAt + 1} is not meant to contain the heading, put a blank line between them, or move the section above the block; then re-run \`dflow doctor\`. If the heading belongs inside it, nothing is broken — inference will keep falling back.`
            : `Close the block opened at line ${openerAt + 1} with its own end marker (\`</script>\`, \`</style>\`, \`?>\`, \`]]>\`, \`>\`) above the heading, or move the section above the block; then re-run \`dflow doctor\`. If the heading belongs inside it, nothing is broken — inference will keep falling back.`
      });
      return;
    }
    findings.push({
      level: 'info',
      title: `${AI_AGENT_GUIDE_DEST} has no "## Project Context" section`,
      // ⚠ THE ACTION MUST NOT BE IMPOSSIBLE ADVICE (`debt212223-y1` finding 2). The
      // branch above names the HTML block for an ATX heading; a setext-underlined
      // `Project Context` hidden the same way reaches HERE, and telling that adopter
      // to "restore a section" they can see in their own file is the defect this
      // whole item exists to remove. So this message carries the possibility in
      // words: it costs a sentence and covers every heading syntax, including ones
      // added later.
      // ⚠ THE DETAIL STATES THE SHAPE; THE ACTION ENUMERATES (`debt212223-y4`
      // finding 2). It used to lead with "an HTML block above it — most often an
      // `<!--` left open" — a cause the branch above now takes for every ATX
      // heading, so the only file that can reach this line with that cause is one
      // with a setext-underlined heading. Naming it here pointed most readers at
      // the one thing that is not their problem.
      detail: '`dflow configure-agents` infers project context (tech stack, migration context) from that section\'s table rows; without it, inference falls back to `unknown` / `none`. Ignore this if you removed the section on purpose. ⚠ If the section IS in the file, then something is keeping that line from being read as a document-level heading — see the causes below.',
      // ⚠ NON-EXHAUSTIVE ON PURPOSE (`debt212223-xv7`). The first version said "two
      // things hide it" and named an HTML block or the heading line itself — but any
      // container the heading ends up inside does it too: an unclosed fence, a
      // blockquote, a list item, an indented code line, all reproduced. A closed
      // enumeration in adopter-facing advice is the same defect as a closed
      // enumeration in a rule: the reader who is in the (N+1)th case concludes the
      // advice does not apply to them. State the shape and give examples.
      action: 'If the section is not in the file, restore a "## Project Context" section above the guide-canonical markers, including the `| Tech stack | ... |` and `| Migration / legacy context | ... |` rows. If it IS there, then something is stopping that line from being a document-level `##` heading. Common causes: a container around it (an HTML block, an unclosed ``` fence, a blockquote, a list item, or a 4-space indent), or the heading line itself — a closing `###` with no space before it, a level other than `##`, or an invisible character in the text are all part of the heading and make it a different one.'
    });
    return;
  }
  const rows = [
    { label: 'Tech stack', re: doctorChecks.TECH_STACK_ROW_RE, example: '| Tech stack | ASP.NET Core 9, EF Core, xUnit |', fallback: '`unknown`' },
    { label: 'Migration / legacy context', re: doctorChecks.MIGRATION_CONTEXT_ROW_RE, example: '| Migration / legacy context | none |', fallback: '`none`' }
  ];
  const missing = rows.filter((row) => doctorChecks.parseContextLine(section, row.re) === null);
  if (missing.length === 0) return;
  findings.push({
    level: 'info',
    title: `${AI_AGENT_GUIDE_DEST} "## Project Context" is missing machine-readable row(s): ${missing.map((row) => row.label).join(', ')}`,
    detail: `\`dflow configure-agents\` infers project context from these table rows; as written, inference falls back to ${missing.map((row) => row.fallback).join(' / ')}. Ignore this if you rewrote the section on purpose.`,
    action: `Restore the table row format inside "## Project Context", e.g. \`${missing[0].example}\`.`
  });
}

// PROPOSAL-058 direction 2 (a): dangling `AI-AGENT-GUIDE.md § Heading`
// references — the drift class that motivated this proposal: a frozen guide plus
// a refreshed workflow bundle leaves flow files pointing at guide sections that
// do not exist.
async function checkGuideSectionRefs(cwd, findings) {
  const guidePath = path.join(cwd, AI_AGENT_GUIDE_DEST);
  if (!(await pathExists(guidePath))) return; // missing guide reported above
  const guideHeadings = doctorChecks.extractHeadings(await fs.readFile(guidePath, 'utf8').catch(() => ''));
  if (guideHeadings.length === 0) return;

  const scanFiles = [{ rel: 'dflow/specs/shared/_conventions.md', abs: path.join(cwd, 'dflow', 'specs', 'shared', '_conventions.md') }];
  for (const dir of ['references', 'templates']) {
    const absoluteDir = path.join(cwd, WORKFLOW_BUNDLE_DEST, dir);
    let entries = [];
    try {
      entries = await fs.readdir(absoluteDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        scanFiles.push({ rel: `${WORKFLOW_BUNDLE_DEST}/${dir}/${entry}`, abs: path.join(absoluteDir, entry) });
      }
    }
  }

  const dangling = [];
  for (const file of scanFiles) {
    const content = await fs.readFile(file.abs, 'utf8').catch(() => null);
    if (content === null) continue;
    for (const ref of doctorChecks.extractSectionRefs(content, 'AI-AGENT-GUIDE.md')) {
      if (!doctorChecks.headingResolves(ref.headingText, guideHeadings)) {
        dangling.push(`${file.rel}:${ref.line} § "${ref.headingText}"`);
      }
    }
  }
  if (dangling.length === 0) return;
  const shown = dangling.slice(0, 8);
  const more = dangling.length - shown.length;
  findings.push({
    level: 'warn',
    title: `Dangling AI-AGENT-GUIDE.md § reference(s): ${dangling.length}`,
    detail: `${shown.join('; ')}${more > 0 ? `; +${more} more` : ''} — the guide has no matching heading, usually because it is frozen at an older Dflow version than the workflow bundle.`,
    action: 'Refresh the guide canonical content with `dflow configure-agents` (accept marker adoption if offered), or align the guide manually.'
  });
}

// PROPOSAL-058 direction 2 (d), user decision 2026-06-08 OQ5: init-only starters
// are user-owned and never re-projected — doctor only reports, never rewrites.
async function checkInitOnlyStarters(cwd, findings) {
  const conventions = await fs.readFile(path.join(cwd, 'dflow', 'specs', 'shared', '_conventions.md'), 'utf8').catch(() => '');
  const parsedPolicy = doctorChecks.parseContextLine(conventions, doctorChecks.GIT_POLICY_LINE_RE);
  const policy = parsedPolicy && doctorChecks.GIT_POLICY_VALUES.has(parsedPolicy) ? parsedPolicy : null;
  const edition = await inferProjectBundleEdition(cwd);

  if (policy) {
    const relativePath = `dflow/specs/shared/Git-principles-${policy}.md`;
    const absolute = path.join(cwd, relativePath);
    if (!(await pathExists(absolute))) {
      findings.push({
        level: 'warn',
        title: `${relativePath} is missing`,
        detail: `The selected Git policy (\`${policy}\`) names this principles file; runtime branch gates and finish-feature guidance read it.`,
        action: 'Recover it from a fresh `dflow init` in a scratch directory (init-only starter; `dflow configure-agents` does not re-project it).'
      });
    } else if (edition) {
      let template = null;
      try {
        template = await readPackagedTemplate(edition, `scaffolding/Git-principles-${policy}.md`);
      } catch {
        template = null;
      }
      if (template) {
        const projected = await fs.readFile(absolute, 'utf8').catch(() => '');
        if (!doctorChecks.matchesTemplateWithPlaceholders(projected, template)) {
          findings.push({
            level: 'info',
            title: `${relativePath} differs from the current packaged starter`,
            detail: 'It is user-owned, so this may be your own edits — or an older Dflow starter shape.',
            action: 'If you never customized it, compare against a fresh `dflow init` and update manually; Dflow never rewrites it.'
          });
        }
      }
    }
  }

  // PROPOSAL-082 G5 / PROPOSAL-083 §4 — report a `_conventions.md` whose
  // sections predate the current contracts. User-owned: report only, never edit.
  //
  // `missing` and `stale` are reported at different levels on purpose.
  // `### SPEC-ID Format` and `### Slug Conventions` were re-parented by `59e0eb2`
  // on 2026-05-01 and no released version has ever projected them, so EVERY
  // existing project is `missing` for that one — it is content the developer was
  // never offered, not a health problem, and `info` says so without crying wolf.
  // `stale` means the section IS there and states a rule the shipped flows no
  // longer follow, which is a live contradiction inside their own conventions,
  // so it warns.
  // The file being GONE is the worst state of all, and it was the one state
  // doctor said nothing about: every `_conventions` check early-returns on a
  // missing path, and findConventionsDrift returns [] for empty input. Silence
  // on the worst case is the "reports success" failure this check exists to
  // avoid, so it is reported first and the drift scan is skipped (three
  // fingerprint findings about a file that does not exist is noise).
  // Present-but-empty is handled with absent, not with drift: a whitespace-only
  // file would otherwise emit one finding per fingerprint, which is noise about
  // a file that has no content at all. It must not fall through silently
  // either — that was the gap, and it made an emptier file look healthier than
  // a one-character one.
  const conventionsPath = path.join(cwd, 'dflow', 'specs', 'shared', '_conventions.md');
  const conventionsAbsent = !(await pathExists(conventionsPath));
  if (conventionsAbsent || !conventions.trim()) {
    findings.push({
      level: 'warn',
      title: conventionsAbsent
        ? 'dflow/specs/shared/_conventions.md is missing'
        : 'dflow/specs/shared/_conventions.md is empty',
      detail: 'It records this project\'s spec-writing conventions, Git policy and AI commit marker, and Dflow reads it to answer those questions. Without it, doctor cannot check any of them.',
      action: 'Recover it from a fresh `dflow init` in a scratch directory and re-apply your project-specific answers; it is user-owned, so `dflow configure-agents` does not re-project it.'
    });
  } else {
    const conventionsDrift = doctorChecks.findConventionsDrift(conventions, edition);
    for (const drift of conventionsDrift) {
      const missing = drift.state === 'missing';
      // Say only what is known. A section can be absent because the project
      // predates it OR because the heading was renamed, and doctor cannot tell
      // which — an earlier version asserted the first, which is a false
      // statement to show someone who merely retitled a heading.
      const neverShipped = missing && drift.neverProjected
        ? ' No released version before this one projected this section, so a project created earlier will not have it.'
        : '';
      const detail = {
        missing: `Nothing under a heading matching "${drift.heading}" was found, so ${drift.rule} is not recorded. Either the section is absent or its heading was renamed.${neverShipped}`,
        stale: `The section is present but does not carry ${drift.rule}. ${drift.consequence}`,
        retired: `The section still carries ${drift.rule}, which PROPOSAL-082 retired. ${drift.consequence}`
      }[drift.state];
      // Titles must differ per finding: three retired fingerprints share the
      // "Ceremony Scaling (Project Application)" heading, so a heading-only
      // title printed the same line several times with only `detail` differing.
      const title = {
        missing: `dflow/specs/shared/_conventions.md has no § ${drift.heading} section`,
        stale: `dflow/specs/shared/_conventions.md § ${drift.heading} is missing ${drift.rule}`,
        retired: `dflow/specs/shared/_conventions.md § ${drift.heading} still carries ${drift.rule}`
      }[drift.state];
      findings.push({
        level: drift.level,
        title,
        detail,
        action: 'Compare against a fresh `dflow init` in a scratch directory and copy the section across; `_conventions.md` is yours and Dflow never rewrites it. See `docs/upgrading.md`.'
      });
    }
  }

  // No _overview.md machine-format check: no packaged _overview template has
  // ever carried `| Tech stack |` / `| Migration / legacy context |` rows, so
  // their absence there is the canonical state, not drift. The machine-readable
  // home of those two context values is the guide's "## Project Context" table
  // — inference reads it and checkGuideProjectContextFormat reports drift
  // (PROPOSAL-076).
}

// PROPOSAL-058 direction 2 (e): template-shape drift for filled feature
// dashboards. Detection + pointers only — migrating a filled document needs
// judgment (old content into new sections), so the migration itself is
// AI-assisted, and completed/ features are deliberately not scanned (they keep
// their historical shape — BUG-001 decision).
async function checkFeatureIndexShape(cwd, findings) {
  const edition = await inferProjectBundleEdition(cwd);
  if (!edition) return;
  let template;
  try {
    template = await readPackagedTemplate(edition, 'templates/_index.md');
  } catch {
    return;
  }
  const activeDir = path.join(cwd, 'dflow', 'specs', 'features', 'active');
  let entries = [];
  try {
    entries = await fs.readdir(activeDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const relativePath = `dflow/specs/features/active/${entry.name}/_index.md`;
    const content = await fs.readFile(path.join(activeDir, entry.name, '_index.md'), 'utf8').catch(() => null);
    if (content === null) continue;
    const missing = doctorChecks.missingTemplateSections(template, content);
    if (missing.length === 0) continue;
    findings.push({
      level: 'info',
      title: `${relativePath} looks like an older _index.md template shape`,
      detail: `Missing section(s) vs the current template: ${missing.join(', ')}. Ignore this if you removed them on purpose.`,
      action: 'Migrate with AI assistance: give your assistant this file plus the current template (`dflow/specs/shared/dflow-workflows/templates/_index.md` after re-projecting) and merge the existing content into the new shape. Completed features can stay as-is.'
    });
  }
}

// PROPOSAL-078 phase 1: delivery-gap detection for the table-cell formatting
// convention (P-072). Scans user-authored spec surfaces — domain/,
// architecture/, migration/, features/active/ + backlog/, and loose root
// docs — and skips shared/ (Dflow-managed bundle, guide, conventions
// machinery) plus features/completed/ (archived shape stays — same boundary
// as checkFeatureIndexShape). Emits ONE aggregated info finding; doctor
// never edits user-authored specs (the `_conventions.md` version-line
// advance stays configure-agents' only exception, per MAINTAINERS).
async function checkSpecTableConventionComment(cwd, findings) {
  const specsRoot = path.join(cwd, 'dflow', 'specs');
  const hits = [];
  async function walk(dir, relParts) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = [...relParts, entry.name];
      if (entry.isDirectory()) {
        if (relParts.length === 0 && entry.name === 'shared') continue;
        if (relParts.length === 1 && relParts[0] === 'features' && entry.name === 'completed') continue;
        await walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(path.join(dir, entry.name), 'utf8').catch(() => null);
        if (content === null) continue;
        if (doctorChecks.hasTableWithoutConventionComment(content)) {
          hits.push(`dflow/specs/${rel.join('/')}`);
        }
      }
    }
  }
  await walk(specsRoot, []);
  if (hits.length === 0) return;
  hits.sort();
  const shown = hits.slice(0, 5).join(', ');
  const more = hits.length > 5 ? ` (and ${hits.length - 5} more)` : '';
  findings.push({
    level: 'info',
    title: `${hits.length} spec doc(s) hold tables but lack the table-formatting convention comment`,
    detail: `${shown}${more}. Docs seeded before Dflow 0.13 (or written from scratch) miss the in-file reminder to keep table cells concise (\`<br>\` between short items, long narrative out of cells), so their tables tend to grow hard-to-read walls.`,
    action: 'With AI assistance, copy the `<!-- Formatting convention: keep table cells concise ... -->` comment from any current template head (`dflow/specs/shared/dflow-workflows/templates/`) into each listed doc, near the top. Doctor never edits user-authored specs.'
  });
}

// PROPOSAL-058: root agent shim manageability. Only existing files are
// classified — which agents a project uses is not recorded, so an absent file is
// not a finding; a file with no Dflow content at all is the user's own business.
async function checkRootAgentShims(cwd, findings) {
  for (const agent of ['agents', 'claude', 'copilot']) {
    const target = getAiAgentTarget(agent);
    const raw = await fs.readFile(path.join(cwd, target.relativePath), 'utf8').catch(() => null);
    if (raw === null) continue;
    const lf = toLf(raw);
    // AGENTS.md can carry a second managed pair (the Codex command-trigger
    // block); a malformed trigger pair blocks `--command-adapters` trigger
    // management (snippet fallback) even when the agent-shim block is healthy.
    if (agent === 'agents') {
      const triggerRegion = classifyMarkedRegion(lf, CODEX_TRIGGER_SECTION_START, CODEX_TRIGGER_SECTION_END);
      if (triggerRegion.state === 'malformed') {
        findings.push({
          level: 'warn',
          title: `${target.relativePath} has malformed Dflow command-trigger markers`,
          detail: '`dflow configure-agents --command-adapters` cannot manage the trigger block and falls back to a merge snippet.',
          action: 'Remove the stray `<!-- dflow-generated: codex-command-triggers ... -->` markers, then re-run `dflow configure-agents --command-adapters`.'
        });
      }
    }
    const region = classifyMarkedRegion(lf, AGENT_SHIM_SECTION_START, AGENT_SHIM_SECTION_END);
    if (region.state === 'malformed') {
      findings.push({
        level: 'warn',
        title: `${target.relativePath} has malformed Dflow markers`,
        detail: '`dflow configure-agents` cannot manage the Dflow block and falls back to a merge snippet.',
        action: 'Remove the stray Dflow markers, then re-run `dflow configure-agents`.'
      });
      continue;
    }
    if (region.state === 'present') continue; // marker-managed: refreshed in place
    const baseShim = buildAiAgentShim(target.relativePath);
    if (isPristineDflowAgentsShim(raw, baseShim, target.relativePath)) continue; // regenerated in place
    if (contentReferencesAiAgentGuide(raw)) {
      findings.push({
        level: 'info',
        title: `${target.relativePath} references the Dflow guide but is not Dflow-managed`,
        detail: 'Dflow wording inside it stays frozen on upgrade (no markers, and not a pristine Dflow shim).',
        action: 'Re-run `dflow configure-agents` on an interactive terminal and accept the managed-block offer, then remove any older Dflow wording you keep outside the block.'
      });
    }
  }
}

// PROPOSAL-058 direction 2 (c) companion: the bundle manifest records which
// Dflow version last projected the workflow bundle.
async function checkBundleManifestVersion(cwd, findings) {
  const manifestResult = await readCurrentBundleManifest(cwd);
  if (manifestResult.kind !== 'ok') return;
  const version = manifestResult.manifest.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version) || version === pkg.version) return;
  if (compareVersions(version, pkg.version) < 0) {
    findings.push({
      level: 'info',
      title: `Workflow bundle was projected by Dflow ${version}; this CLI is ${pkg.version}`,
      detail: 'The references/ and templates/ files under dflow-workflows/ are from the older version.',
      action: 'Run `dflow configure-agents` to re-project the bundle.'
    });
  }
}

// PROPOSAL-052 (c): read-only mop-up for the manifest-orphan edge. A
// Dflow-generated bundle file that is no longer in the current package source
// can linger if it was retired before generalized stale-removal shipped, or the
// project was projected from a pre-release / non-registry source whose manifest
// later forgot it. configure-agents only auto-removes files the manifest still
// lists; a manifest-orphaned file (the manifest no longer lists it) must be
// deleted by hand. Doctor detects and reports such files read-only (never
// deletes). Detection requires a directory scan because, by definition, the
// manifest no longer lists the orphan — but a read-only scan is safe here.
async function checkWorkflowBundleSourceAndOrphans(cwd, findings) {
  // ⚠ NOTHING GATES THE PACKAGE CHECK, and EVERY shipped edition is checked. Four
  // repairs guessed at a boundary here before it was accepted that there isn't one —
  // see the comment on the `for (const e of dependedOn)` loop below for what each
  // guess let through. The last guess was the subtlest: checking only the project's
  // OWN edition, which is exactly enough to answer "will this block me" and not
  // enough to answer "is my install damaged". Those are different questions and the
  // report now answers both.
  const edition = await inferProjectBundleEdition(cwd);
  // Needed before the catch, not after: the "your retired-file scan was lost" clause
  // may only be said where that scan was actually going to run (`projgate-y1` F5).
  const bundleDir = path.join(cwd, WORKFLOW_BUNDLE_DEST);
  const bundleExists = await pathExists(bundleDir);

  // ⚠⚠ TWO RESOLVERS, AND THEY DO NOT AGREE. `inferProjectBundleEdition` prefers the
  // manifest (authoritative for what was PROJECTED, which is what the orphan scan
  // below compares against). `configure-agents` resolves by STRUCTURE alone. On a
  // project where they disagree — manifest says brownfield, the tree looks greenfield
  // — doctor would name a track as unused while `configure-agents` was about to read
  // exactly that track and hard-fail on it. `projgate-sol1` executed it: doctor said
  // "does not use", configure exited 1 on the same damage. That is the original
  // false-clean rebuilt through a different mechanism, and it is a claim this file
  // only started making an hour earlier.
  // So the project is treated as depending on ONE edition only when BOTH resolvers
  // name the same one. Anything else — disagreement, or either resolver silent — and
  // every edition counts as depended-upon. Conservative, and the cost is only that a
  // damaged unused track reads as `warn` instead of `info` on an already-inconsistent
  // project.
  const structureEdition = await inferExistingEdition(cwd);
  const resolvedEdition = edition && edition === structureEdition ? edition : null;
  const dependedOn = resolvedEdition ? [resolvedEdition] : [...BUNDLE_EDITIONS];
  const unused = BUNDLE_EDITIONS.filter((e) => !dependedOn.includes(e));

  let sourceFiles;
  try {
  // ⚠⚠ THIS LOOP IS THE PACKAGE INTEGRITY CHECK, and the comment below is the only
  // record of why it has the shape it has. It used to live on a named function that a
  // later repair left unreachable; `projgate-y2r` caught that the pointer above landed
  // on dead code a routine sweep would delete. Keep it attached to code that RUNS.
  //
  // ⚠⚠ THE HISTORY MATTERS, because three separate repairs each moved this boundary
  // instead of removing it, and each one was reported as a fix. `projgate-x1`: the
  // check sat behind "is a bundle projected". `projgate-x2`: behind "is an edition
  // inferable". `projgate-y1`: a common-tree-only scan, which reached exactly ONE of
  // the three integrity asserts — `assertEditionBundleComplete` never ran, and
  // `assertNoBundleCollision` over one tree is close to a no-op, since `references/x`
  // and `templates/x` cannot key-collide and one readdir cannot return two same-case
  // names. So a cross-tree collision or a gutted edition tree still produced
  // `All checks passed` beside a `configure-agents` that hard-failed on the same
  // package. There is nothing to infer: the edition set is CLOSED and both trees
  // always ship, so when the project cannot tell us, check them all.
  //
  // ⚠⚠ ONE PER EDITION, NEVER BOTH IN ONE LIST — and this is the part that looks like
  // a style choice and is not. `assertNoBundleCollision` keys on `sourceRel` and
  // deliberately NOT on `sourceRoot`, because its job is to catch one destination path
  // claimed twice. Merging greenfield and brownfield into a single list therefore
  // reports every same-named per-track file as a collision, which on the real tree is
  // every flow reference there is. Measured on the healthy tree: the merged form
  // throws on `references/drift-verification.md` — a FALSE POSITIVE shipped to every
  // adopter, strictly worse than the defect it was meant to fix. `projgate-y1` found
  // the gap correctly and prescribed exactly that merge; the prescription was checked
  // before it was applied, which is the only reason it is not in this file.
    for (const e of dependedOn) {
      const files = await listBundleSourceFiles(e);
      if (e === edition) sourceFiles = files;
    }
  } catch (error) {
    // ⚠⚠ This catch used to be bare (`catch { return; }`) and it was a false-clean
    // generator: the three source-integrity asserts inside listBundleSourceFiles
    // (collision, complete edition tree, complete common tree) fire on a broken
    // INSTALL, and swallowing them skipped the orphan scan in silence — so `doctor`
    // printed `All checks passed` and exited 0 on a package whose `configure-agents`
    // hard-fails before writing a byte. Reproduced end-to-end by `feedbackcommon-xv6`
    // (2026-08-10): delete one required common file and the two commands disagree
    // completely. Pre-existing, not introduced by the common-tree single-sourcing.
    //
    // ⚠⚠ THE FIRST VERSION OF THIS FIX SAT BELOW THE BUNDLE-DIRECTORY CHECK AND
    // LEFT HALF THE DEFECT IN PLACE (`projgate-x1`, 2026-08-11). The reasoning then
    // was: `All checks passed` is a claim about the PROJECT, so a directory with no
    // projected bundle has abandoned no claim and deserves no warning. That
    // conflated two different states — a bare directory that is not a Dflow project
    // at all, and an INITIALIZED project whose bundle is missing. The second is a
    // Dflow project, doctor does make a claim about it, and the reviewer reproduced
    // exactly that: delete the project's bundle directory, break the package, and
    // the old order printed `All checks passed` again. The repair then moved the
    // gate to "can an edition be inferred" — and `projgate-x2` reached THAT state
    // too (strip the manifest plus every structural signal). Two wrong guesses at
    // the same boundary is the signal this repo records as a design question rather
    // than a third patch — and the third guess (a common-tree-only scan) was wrong
    // too, for a reason only the other model family saw — see the comment on the
    // `for (const e of dependedOn)` loop above. The packaged source is now validated
    // unconditionally, every edition of it.
    //
    // ⚠ Level is `warn`, not PROPOSAL-084 `uncertain`. Nothing here is uncertain: a
    // named assert fired and the remedy is unambiguous. `warn` already suppresses
    // `All checks passed` (see printDoctorReport), so `uncertain` would buy no extra
    // honesty while putting a broken install onto an explainer page written for
    // unreadable PROJECT shapes — and would drag in the id + affects + bilingual
    // page contract for a state the reader cannot act on differently.
    //
    // ⚠ Nothing is rethrown. An unexpected read error must not turn a read-only
    // health check into a non-zero exit, but it must not vanish either — that is
    // the same silent-skip class, just with a different trigger.
    // ⚠ The "and therefore the scan did not run" clause may only be said where that
    // scan was actually going to run: it needs BOTH an inferred edition and a
    // projected bundle to compare against. A doctor message that reports a loss which
    // did not occur is the same class of false operational claim this whole fix
    // exists to remove — one notch smaller, which is why the first version got the
    // edition half right and the bundle half wrong (`projgate-y1` F5).
    const scanLost = edition && bundleExists
      ? ' The retired-bundle-file scan did not run, so this report cannot say whether your project holds retired bundle files.'
      : '';
    if (error instanceof InitError) {
      // ⚠ "configure-agents will fail on this package too" is only TRUE when we know
      // which edition THAT command will resolve to. Two rounds narrowed this: with no
      // edition at all the damage may sit in a tree the project never reads
      // (`projgate-x3`), and with the two resolvers disagreeing we do not know which
      // tree it will read (`projgate-sol1`). Both collapse into the same test — say
      // it flatly only when the resolvers agree. Say what is known, not what sounds
      // decisive.
      const alsoFails = resolvedEdition
        ? '`dflow configure-agents` will fail on this package too.'
        : 'Whether `dflow configure-agents` also fails depends on which track it resolves this project to.';
      findings.push({
        level: 'warn',
        title: 'The installed dflow package looks incomplete',
        detail: `An integrity check on its packaged workflow bundle source failed: ${error.message}${scanLost}`,
        action: `Reinstall dflow (e.g. \`npm install -g dflow-sdd-ddd@latest\`, or re-link your local checkout). This is a problem with the installed package, not with anything in your project — ${alsoFails}`
      });
    } else {
      findings.push({
        level: 'warn',
        title: 'Could not read the packaged workflow bundle source',
        detail: `Reading it failed: ${error && error.message ? error.message : error}.${scanLost}`,
        action: 'Check that the installed dflow package is readable (permissions, an interrupted install), then re-run `dflow doctor`.'
      });
    }
    return;
  }

  // ⚠ DISCLOSE, DO NOT BLOCK (user decision, 2026-08-11). A track this project does
  // not use can be damaged without anything here ever failing — `projgate-x3`
  // measured it: a greenfield project on a package with a gutted brownfield tree has
  // `doctor` and `configure-agents` BOTH succeeding, and both are right, because that
  // project never reads that tree. So this is not the false-clean the `warn` above
  // exists for; the two commands agree. What was wrong was only that the report
  // implied a completeness it had not checked.
  // The honest answer is a different question with a different level: "will this
  // block you" is `warn`, "is your install damaged" is `info`. Raising this to `warn`
  // would re-create the original disagreement in the opposite direction — doctor
  // saying broken while `configure-agents` runs fine — which trades one false claim
  // for another rather than removing it.
  // ⚠ Reached only when the loop above did NOT throw: if the track you depend on is
  // broken, "reinstall" already covers everything and a second finding is noise.
  for (const other of unused) {
    try {
      await listBundleSourceFiles(other);
    } catch (error) {
      findings.push({
        level: 'info',
        title: `The installed dflow package is damaged in the ${other} track, which this project does not use`,
        detail: `${error && error.message ? error.message : error}`,
        // ⚠ `resolvedEdition`, not `edition`: this sentence is only reachable when both
        // resolvers agreed, and naming the manifest's answer here when they had not
        // would be the same false claim one line further down.
        // ⚠ The install is shared. A global `dflow` serves every project on this
        // machine, so "does not block THIS project" is not "harmless" — said without
        // the second sentence it invites a reader to leave a damaged install in place
        // for a sibling project that does use that track (`projgate-sol1` ITEM 2.1).
        action: `Nothing here blocks this project — it uses the ${resolvedEdition} track, and neither \`dflow init\` nor \`dflow configure-agents\` reads the ${other} source tree for it. But this install is shared: any other project on this machine that uses the ${other} track will hit it. Reinstall dflow to clear it — and do so before you switch this project to the ${other} track.`
      });
    }
  }

  // Everything below is the ORPHAN SCAN, and it is the only part that needs both an
  // edition (to know the full source set) and a projected bundle (to have something
  // to compare against). Package integrity was settled above, independent of both.
  if (!edition || !bundleExists) return;

  const sourceRel = new Set(sourceFiles.map((f) => `${WORKFLOW_BUNDLE_DEST}/${f.sourceRel}`));

  for (const dir of ['references', 'templates']) {
    const projectedDir = path.join(bundleDir, dir);
    let entries;
    try {
      entries = await fs.readdir(projectedDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const rel = `${WORKFLOW_BUNDLE_DEST}/${dir}/${entry}`;
      if (sourceRel.has(rel)) continue;
      const abs = path.join(projectedDir, entry);
      const fileStat = await fs.stat(abs).catch(() => null);
      if (!fileStat || !fileStat.isFile()) continue;
      const content = await fs.readFile(abs, 'utf8').catch(() => '');
      if (!content.includes(WORKFLOW_BUNDLE_GENERATED_MARKER)) continue;
      findings.push({
        level: 'info',
        title: `Retired workflow bundle file: ${rel}`,
        detail: 'A Dflow-generated bundle file that is no longer part of the package source for this edition (a retired file left behind).',
        action: 'Delete it manually to remove it. (Re-running `dflow configure-agents` only auto-removes files the manifest still lists; a manifest-orphaned file must be deleted by hand.)'
      });
    }
  }
}

// Infers the project's bundle edition for read-only checks: prefer the manifest
// (authoritative for what was projected), fall back to project structure.
async function inferProjectBundleEdition(cwd) {
  const manifestResult = await readCurrentBundleManifest(cwd);
  if (
    manifestResult.kind === 'ok' &&
    (manifestResult.manifest.edition === 'greenfield' || manifestResult.manifest.edition === 'brownfield')
  ) {
    return manifestResult.manifest.edition;
  }
  return inferExistingEdition(cwd);
}

// PROPOSAL-084. The page is a mutable `blob/main` pointer, so it inherits
// PROPOSAL-081's evergreen contract (MAINTAINERS.md § README Language Strategy):
// it must stay usable by every published CLI that prints this line. The English
// page is the runtime target and the zh page is one language-switch away, which
// is the precedent `docs/upgrading.en.md` already set.
const DOCTOR_UNCERTAINTY_DOC_URL = 'https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/doctor-uncertainty.en.md';

// PROPOSAL-084: the only way to build an `uncertain` finding. It exists so the
// two fields the state MEANS cannot be dropped by a future caller copying the
// bare `findings.push({ level, title, detail, action })` shape used everywhere
// else in this file — the stable id (invariant 3) and the checks whose silence
// must not be read as a pass (invariant 2). Omitting either throws here, in our
// code, instead of rendering `undefined` into a user's health report. A crash
// over a silently wrong answer is this subsystem's standing trade (see
// `parseContextLine`'s type check for the same call).
function uncertainFinding({ id, title, detail, affects, action }) {
  if (!id || !Array.isArray(affects) || affects.length === 0) {
    throw new Error(`PROPOSAL-084: an uncertain finding needs a stable id and a non-empty affects list (got id=${JSON.stringify(id)}, affects=${JSON.stringify(affects)})`);
  }
  return { level: 'uncertain', id, title, detail, affects, action };
}

function printDoctorReport(stdout, cwd, findings) {
  stdout.write(`Dflow Doctor ${pkg.version}\n`);
  stdout.write(`Project: ${cwd}\n\n`);

  const uncertain = findings.filter((f) => f.level === 'uncertain');
  const assessed = findings.filter((f) => f.level !== 'uncertain');

  // ⚠⚠ PROPOSAL-084 INVARIANT 1 — this branch is the whole proposal.
  // `All checks passed` is a claim about the WHOLE project. An uncertain finding
  // says a part of it could not be read at all, so the claim is not available —
  // not "available with a caveat printed underneath". The reviewer that was asked
  // to argue AGAINST this proposal made that the condition of its worth: a
  // disclosure the user can skim past just moves the silent pass from a wrong
  // `current` to an unread warning.
  //
  // ⚠ BE EXACT ABOUT WHAT THIS SPELLING BUYS, because the first version of this
  // comment overclaimed and the probe caught it. Against the ORIGINAL
  // `findings.length === 0` the guard is not stronger — it is logically the same
  // test, since `findings` is the union of the two arrays, and no fixture can
  // separate them. What it defends is the refactor this very function just made
  // tempting: now that `assessed` exists and reads like "the real findings", the
  // natural shorthand here is `assessed.length === 0`, and THAT would print a
  // clean bill of health over a project whose only finding is uncertain — the
  // precise false claim this proposal exists to delete. `test/upgrade-drift.mjs`
  // pins it with a fixture whose findings are uncertain and nothing else, which
  // is the case that distinguishes those two, and the pin was verified to go red
  // against the `assessed.length === 0` mutation rather than assumed to.
  if (uncertain.length === 0 && assessed.length === 0) {
    stdout.write('All checks passed. No Dflow health findings detected.\n');
    return;
  }

  for (const finding of assessed) {
    stdout.write(`[${finding.level}] ${finding.title}\n`);
    stdout.write(`        ${finding.detail}\n`);
    stdout.write(`        ${finding.action}\n\n`);
  }

  for (const finding of uncertain) {
    stdout.write(`[uncertain] ${finding.title} (${finding.id})\n`);
    stdout.write(`        ${finding.detail}\n`);
    // ⚠ INVARIANT 2, and it is doing more work than it looks like. Doctor reports
    // by exception: a check that emits nothing reads as "that part is current".
    // For the checks below, that silence is precisely what has stopped being
    // trustworthy, so naming them converts an absence the user would have
    // misread into a statement they can act on. Without this line the feature
    // degrades into "something somewhere may be wrong".
    // ⚠⚠ "Not evaluated" WAS A FALSE STATEMENT (`p084-xv6` finding 1). The affected
    // checks still run — a user can see a `[warn]` from a check this very report
    // called unevaluated, which is a contradiction printed at the exact boundary
    // this feature exists to be honest about. What is true is weaker and is what
    // this now says: they ran, and neither their silence nor their output can be
    // trusted while the shape is present.
    stdout.write(`        Ran, but cannot be trusted while this shape is present — their silence is NOT a pass, and anything they DO report may be an artefact of the shape: ${finding.affects.join('; ')}.\n`);
    stdout.write(`        ${finding.action}\n\n`);
  }

  const counts = { warn: 0, info: 0 };
  for (const f of findings) counts[f.level] = (counts[f.level] || 0) + 1;
  const uncertainTally = counts.uncertain ? `, ${counts.uncertain} uncertain` : '';
  stdout.write(`${findings.length} finding(s): ${counts.warn} warn, ${counts.info} info${uncertainTally}.\n`);
  if (uncertain.length > 0) {
    stdout.write(`\nThis report is INCOMPLETE. Dflow found ${uncertain.length} shape(s) it is known to read unreliably, so the results of the checks named above — including their silence — cannot be trusted.\n`);
    stdout.write(`What each id means, and how to rewrite around it: ${DOCTOR_UNCERTAINTY_DOC_URL} (offline copy: docs/doctor-uncertainty.en.md in the installed package).\n`);
  }
  stdout.write('Doctor is read-only and does not modify any files.\n');
}

module.exports = {
  runConfigureAgents,
  runDoctor,
  runInit,
  validateProseLanguage,
  ensureProseLanguageSection,
  buildFilePlan,
  // Exported for tests: the write phase enforces the PROPOSAL-054 raw-equality guard
  // for user-owned root agent files (changed-after-preview -> skip), which cannot be
  // exercised through the CLI because preview and write happen in one process.
  writeFilePlan,
  // Exported for tests (PROPOSAL-064): pure bundle-source guards, unit-tested on
  // synthetic descriptor lists without touching the packaged templates/ tree.
  // REQUIRED_COMMON_BUNDLE_FILES rides along so the tests can derive their
  // fixtures from the real list instead of restating it: a hardcoded copy goes
  // stale the moment a file joins the list, and it fails as a confusing
  // assertion error in the *positive* case rather than as missing coverage.
  REQUIRED_COMMON_BUNDLE_FILES,
  assertNoBundleCollision,
  assertEditionBundleComplete,
  assertCommonBundleComplete,
  // Exported for tests (PROPOSAL-076): context inference reads the guide's
  // Project Context rows, but its only write consumer is whole-guide creation
  // when the guide is missing — the real-value read has no black-box write to
  // observe, so tests call these directly.
  inferTechStackSummary,
  inferMigrationContext,
  // Exported for tests (PROPOSAL-084): the id set is the contract between a
  // shipped `[uncertain]` line and the explainer page it sends the reader to.
  // Derived from the detector registry rather than retyped, so a new detector
  // cannot be added without the docs guard noticing it.
  DOCTOR_UNCERTAINTY_IDS
};
