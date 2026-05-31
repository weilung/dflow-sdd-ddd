const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const { TextDecoder } = require('node:util');

const pkg = require('../package.json');

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
const WORKFLOW_BUNDLE_DEST = 'dflow/specs/shared/dflow-workflows';
const WORKFLOW_BUNDLE_MANIFEST_PATH = `${WORKFLOW_BUNDLE_DEST}/.dflow-bundle-manifest.json`;
const COMMON_SKILL_SOURCE_REL = 'common/skill/SKILL.md';
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
    const plan = await buildFilePlan(cwd, answers);
    const warnings = [...preflight.warnings, ...buildDetectionWarnings(answers, detection), ...(plan.bundleWarnings || [])];

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
    printNextSteps(stdout);
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

    const plan = await buildConfigureAgentsPlan(cwd, {
      ...projectContext,
      aiAgents,
      commandAdapters: Boolean(options.commandAdapters),
      skills: Boolean(options.skills)
    });

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
    printConfigureAgentsNextSteps(stdout, Boolean(options.commandAdapters));
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

  const legacySpecsPath = path.join(cwd, 'specs');
  if ((await pathExists(legacySpecsPath)) && (await containsInitializedContent(legacySpecsPath))) {
    warnings.push(
      'Detected legacy specs/. Dflow V1 will not migrate or modify it; new files will be created under dflow/specs/. See docs/migrating-to-dflow-v1.md for the manual migration checklist.'
    );
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
  if (await pathExists(path.join(cwd, 'AGENTS.md'))) {
    detected.push('agents');
  }
  if (
    (await pathExists(path.join(cwd, 'CLAUDE.md'))) ||
    (await pathExists(path.join(cwd, '.claude/commands/dflow'))) ||
    (await pathExists(path.join(cwd, '.claude/skills/dflow')))
  ) {
    detected.push('claude');
  }
  if (await pathExists(path.join(cwd, '.github/copilot-instructions.md'))) {
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

async function inferGitPolicy(cwd) {
  const conventionsPath = path.join(cwd, 'dflow/specs/shared/_conventions.md');
  const content = await fs.readFile(conventionsPath, 'utf8').catch(() => '');
  const match = content.match(/Selected Git policy:\s*`([^`]+)`/);
  return match ? match[1] : null;
}

async function inferAiCommitMarker(cwd) {
  const conventionsPath = path.join(cwd, 'dflow/specs/shared/_conventions.md');
  const content = await fs.readFile(conventionsPath, 'utf8').catch(() => '');
  const match = content.match(/AI commit marker:\s*`([^`]+)`/);
  return match ? match[1] : null;
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
  const match = content.match(/Project prose language:\s*`([^`]+)`/);
  return match ? match[1] : 'unknown';
}

async function inferTechStackSummary(cwd) {
  const overviewPath = path.join(cwd, 'dflow/specs/shared/_overview.md');
  const content = await fs.readFile(overviewPath, 'utf8').catch(() => '');
  const match = content.match(/\|\s*Tech stack\s*\|\s*([^|\n]+?)\s*\|/i);
  return match ? match[1].trim() : 'unknown';
}

async function inferMigrationContext(cwd) {
  const overviewPath = path.join(cwd, 'dflow/specs/shared/_overview.md');
  const content = await fs.readFile(overviewPath, 'utf8').catch(() => '');
  const match = content.match(/\|\s*Migration \/ legacy context\s*\|\s*([^|\n]+?)\s*\|/i);
  return match ? match[1].trim() : 'none';
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

  if (answers.aiAgents.length > 0) {
    await addTemplate('dflow/specs/shared/AI-AGENT-GUIDE.md', 'scaffolding/AI-AGENT-GUIDE.md', 'selected, canonical AI agent guide');
    for (const agent of answers.aiAgents) {
      await addAiAgentShim(cwd, items, agent, substitution);
    }
  }

  await finalizePlanItems(cwd, items);

  // Always project the workflow bundle (required for /dflow:* workflows to be reachable).
  const bundleWarnings = [];
  await addWorkflowBundleItems(cwd, items, bundleWarnings, answers.edition);

  return {
    items,
    deferred: buildDeferredItems(answers.edition),
    bundleWarnings,
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

  let content = await readPackagedTemplate(answers.edition, 'scaffolding/AI-AGENT-GUIDE.md');
  content = substitutePlaceholders(content, substitution);
  items.push({
    relativePath: 'dflow/specs/shared/AI-AGENT-GUIDE.md',
    source: `packaged:${answers.edition}/scaffolding/AI-AGENT-GUIDE.md`,
    notes: 'canonical AI agent guide',
    content
  });

  const commandRegistry = answers.commandAdapters ? parseDflowCommandRegistry(content) : [];

  for (const agent of answers.aiAgents) {
    await addAiAgentShim(cwd, items, agent, substitution, { commandRegistry, warnings });
  }

  if (answers.commandAdapters) {
    addCommandAdapterItems(items, answers.aiAgents, commandRegistry);
  }

  await finalizePlanItems(cwd, items);

  if (answers.commandAdapters) {
    await addLegacyCommandAdapterCleanupItems(cwd, items, answers.aiAgents, warnings);
  }

  await addSkillAdapterItems(cwd, items, answers.aiAgents, answers.skills, warnings);

  // Project the workflow bundle on configure-agents too, so pre-039 projects (no bundle)
  // and edition-switch repairs get the runtime references/templates reachable. The function
  // is idempotent: it skips fresh bundle files, updates Dflow-generated ones, and warns
  // (without overwriting) on user-modified bundle files.
  const bundleWarnings = [];
  await addWorkflowBundleItems(cwd, items, bundleWarnings, answers.edition);
  warnings.push(...bundleWarnings);

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
    const absolute = path.join(cwd, item.relativePath);
    const targetExists = await pathExists(absolute);
    item.action = targetExists ? (item.overwrite ? 'update' : 'skip') : 'create';
    if (item.action === 'skip') {
      item.notes = item.notes ? `${item.notes}, already exists` : 'already exists';
    }
    item.size = Buffer.byteLength(item.content, 'utf8');
  }
}

async function listBundleSourceFiles(edition) {
  const bundleDirs = ['references', 'templates'];
  const files = [];

  for (const dir of bundleDirs) {
    const sourceDir = path.join(TEMPLATE_ROOT, edition, dir);
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
      const sourceRel = `${dir}/${entry}`;
      const sourcePath = path.join(sourceDir, entry);
      const stat = await fs.stat(sourcePath);
      if (stat.isFile()) {
        files.push({ sourceRel, dir, name: entry });
      }
    }
  }

  return files;
}

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
  const bundleFiles = await listBundleSourceFiles(edition);

  // R3-02: a healthy edition's bundle source is never empty. An empty scan means
  // a broken installed package — hard-fail BEFORE scheduling any removal or
  // writing the manifest, so we never overwrite the manifest with files:[]
  // (which would orphan every projected file and ship a workflow-less project).
  if (bundleFiles.length === 0) {
    throw new InitError(
      `Internal error: no workflow bundle source files found for edition "${edition}" (expected files under templates/${edition}/references/ and templates/${edition}/templates/). The installed dflow package looks incomplete.`
    );
  }

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
  for (const { sourceRel } of bundleFiles) {
    const relativePath = `${WORKFLOW_BUNDLE_DEST}/${sourceRel}`;
    const absolutePath = path.join(cwd, relativePath);
    const sourceContent = await readPackagedBundleFile(edition, sourceRel);
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
      source: `packaged-bundle:${edition}/${sourceRel}`,
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

async function readPackagedBundleFile(edition, sourceRel) {
  const filePath = path.join(TEMPLATE_ROOT, edition, sourceRel);
  const normalizedRoot = path.resolve(TEMPLATE_ROOT, edition);
  const normalizedFilePath = path.resolve(filePath);

  if (!normalizedFilePath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new InitError(`Internal error: packaged bundle file not found: templates/${edition}/${sourceRel}`);
  }

  let buffer;
  try {
    buffer = await fs.readFile(normalizedFilePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new InitError(`Internal error: packaged bundle file not found: templates/${edition}/${sourceRel}`);
    }
    throw new InitError(`Internal error: cannot read packaged bundle file: templates/${edition}/${sourceRel}`);
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new InitError(`Internal error: invalid UTF-8 packaged bundle file: templates/${edition}/${sourceRel}`);
  }
}

async function addAiAgentShim(cwd, items, agent, substitution, options = {}) {
  const target = getAiAgentTarget(agent);
  const targetPath = path.join(cwd, target.relativePath);
  const targetExists = await pathExists(targetPath);
  const targetConfigured = targetExists && await fileReferencesAiAgentGuide(targetPath);
  const commandRegistry = options.commandRegistry || [];
  const warnings = options.warnings;
  const codexCommandAdapterSnippet = target.relativePath === 'AGENTS.md' && commandRegistry.length > 0 && targetExists;
  const content = substitutePlaceholders(buildAiAgentShim(target.relativePath, options.commandRegistry), substitution);
  const source = `generated:${agent}-shim`;

  // PROPOSAL-046: when adding Codex command triggers and the existing AGENTS.md
  // is an unmodified Dflow shim, inject the marked trigger section directly
  // (zero manual merge) instead of parking a side snippet. A user-modified shim
  // still degrades safely to the snippet + warning.
  if (codexCommandAdapterSnippet && targetConfigured) {
    const existingContent = await fs.readFile(targetPath, 'utf8');
    const baseShim = substitutePlaceholders(buildAiAgentShim(target.relativePath), substitution);
    if (isPristineDflowAgentsShim(existingContent, baseShim)) {
      items.push({
        relativePath: target.relativePath,
        source,
        notes: `selected, injected command trigger section into Dflow-generated ${target.relativePath}`,
        content,
        overwrite: true
      });
      return;
    }
    if (warnings) {
      warnings.push(
        `Existing ${target.relativePath} was modified after Dflow generated it; wrote the command trigger section to dflow/specs/shared/AGENTS-md-command-adapters-snippet.md for manual merge.`
      );
    }
    items.push({
      relativePath: 'dflow/specs/shared/AGENTS-md-command-adapters-snippet.md',
      source,
      notes: `selected, ${target.relativePath} was modified after Dflow generated it; merge this command trigger snippet manually`,
      // PROPOSAL-046: this AGENTS.md already points to the guide (targetConfigured),
      // so the manual-merge snippet is the trigger section only — not the full shim
      // (which would duplicate the title + guide pointers on merge).
      content: substitutePlaceholders(buildCodexCommandTriggerSection(commandRegistry), substitution),
      overwrite: true
    });
    return;
  }

  const relativePath = codexCommandAdapterSnippet
    ? target.snippetPath
    : (targetExists && !targetConfigured ? target.snippetPath : target.relativePath);
  let notes = 'selected, tool-specific shim';
  if (codexCommandAdapterSnippet) {
    notes = `selected, ${target.relativePath} already exists; merge this command trigger snippet manually`;
  } else if (targetConfigured) {
    notes = `selected, ${target.relativePath} already points to AI-AGENT-GUIDE.md`;
  } else if (targetExists) {
    notes = `selected, ${target.relativePath} already exists; merge this snippet manually`;
  }

  items.push({
    relativePath,
    source,
    notes,
    content,
    overwrite: codexCommandAdapterSnippet
  });
}

async function fileReferencesAiAgentGuide(targetPath) {
  try {
    const content = await fs.readFile(targetPath, 'utf8');
    return content.includes('dflow/specs/shared/AI-AGENT-GUIDE.md') ||
      content.includes('dflow\\specs\\shared\\AI-AGENT-GUIDE.md');
  } catch {
    return false;
  }
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

function buildAiAgentShim(targetPath, commandRegistry = []) {
  const title = targetPath === '.github/copilot-instructions.md'
    ? 'GitHub Copilot Repository Instructions'
    : `${targetPath} - Dflow Project Instructions`;

  const commandTriggerHint = targetPath === 'AGENTS.md' && commandRegistry.length > 0
    ? buildCodexCommandTriggerSection(commandRegistry)
    : '';

  const importHint = targetPath === 'CLAUDE.md'
    ? '\nIf your tool supports Markdown imports, the canonical guide is imported below:\n\n@dflow/specs/shared/AI-AGENT-GUIDE.md\n'
    : '';

  return `# ${title}

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- \`dflow/specs/shared/AI-AGENT-GUIDE.md\` — command registry, routing rules, and project context.
- \`dflow/specs/shared/dflow-workflows/\` — vendored workflow bundle with executable step definitions.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.${commandTriggerHint}${importHint}
`;
}

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

async function addSkillAdapterItems(cwd, items, aiAgents, skills, warnings) {
  if (!skills) {
    return;
  }

  if (!aiAgents.includes('claude')) {
    warnings.push(
      'The --skills flag currently supports Claude Code only; no skill adapter was generated because Claude Code was not a selected target.'
    );
    return;
  }

  const relativePath = '.claude/skills/dflow/SKILL.md';
  const targetPath = path.join(cwd, relativePath);

  // The thin skill is edition-neutral (it only points to the per-edition guide),
  // so there is nothing edition-specific to go stale — re-running just rewrites
  // the same marker-guarded file (idempotent). No LEGACY skill set exists yet
  // (skills are new in PROPOSAL-038); future skill cleanup would extend the same
  // LEGACY_* / addLegacyCommandAdapterCleanupItems marker-fingerprint pattern.
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
      'Existing .claude/skills/dflow/SKILL.md is not a Dflow-generated skill; left unchanged. Remove or rename it to let Dflow manage this skill.'
    );
    return;
  }

  const skillContent = await buildDflowSkillAdapter();
  items.push({
    relativePath,
    source: 'generated:claude-skill-adapter',
    notes: 'skill adapter, thin skill pointing to AI-AGENT-GUIDE.md',
    content: skillContent,
    size: Buffer.byteLength(skillContent, 'utf8'),
    overwrite: true
  });
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
  return String(content).replace(/\r\n/g, '\n');
}

function normalizeShimForMatch(content) {
  return String(content)
    .replace(/\r\n/g, '\n')
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

// An AGENTS.md is a safely-injectable Dflow shim when, after removing any
// previously-injected trigger block, it matches the shim Dflow itself
// generates. This covers both a pristine 0.8.0/0.9.0 shim (no marker, normalized
// exact-template match) and a shim Dflow already injected into (idempotent
// re-projection). A user-edited shim fails the match and degrades to a snippet.
// (A future shim could carry its own generated-marker for a cheaper check, but
// that would require freezing this pre-marker template for back-compat matching;
// the normalized template match works for both eras without that.)
function isPristineDflowAgentsShim(existingContent, baseShim) {
  return normalizeShimForMatch(stripCodexTriggerBlock(existingContent)) === normalizeShimForMatch(baseShim);
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

function buildDeferredItems(edition) {
  const deferred = [...DEFERRED_COMMON];
  if (edition === 'greenfield') {
    deferred.splice(3, 0, {
      relativePath: 'dflow/specs/domain/{context}/events.md',
      reason: 'Greenfield only, but still needs a real bounded context.'
    });
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
    ['{tech-stack-summary}', answers.techStackSummary],
    ['{migration-context}', answers.migrationContext],
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

  for (const item of plan.items) {
    const targetPath = path.join(cwd, item.relativePath);

    try {
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
          result.skipped.push(item.relativePath);
          result.warnings.push(`Skipped stale removal because target is not a file: ${item.relativePath}`);
          continue;
        }

        const currentContent = await fs.readFile(targetPath, 'utf8');
        if (normalizeCommandAdapterFingerprint(currentContent) !== normalizeCommandAdapterFingerprint(item.expectedContent || '')) {
          result.skipped.push(item.relativePath);
          result.warnings.push(`Skipped stale removal because content changed after preview: ${item.relativePath}`);
          continue;
        }

        await fs.unlink(targetPath);
        result.removed.push(item.relativePath);
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
        result.warnings.push(`Skipped existing target: ${item.relativePath}`);
        if (item.relativePath === 'dflow/specs/shared/_conventions.md') {
          result.warnings.push(
            'Prose language was not written because dflow/specs/shared/_conventions.md already exists. Ensure it contains exactly one ## Prose Language section before running prose-generating flows.'
          );
        }
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

function printNextSteps(stdout) {
  stdout.write(`
Dflow init complete.

Recommended next steps:
- For a new feature, use the Dflow new-feature workflow when it becomes available as a CLI command.
- For brownfield changes, use the Dflow modify-existing workflow when it becomes available as a CLI command.
- Before generating more specs, make sure dflow/specs/shared/_conventions.md has the correct Prose Language section.
- For stack-specific examples (.NET, Java/Spring, Node/TypeScript, Python, Go, PHP/Laravel), see docs/examples-by-stack.md in the Dflow repo.
`);
}

function printConfigureAgentsNextSteps(stdout, commandAdapters = false) {
  const commandAdapterStep = commandAdapters
    ? '- Command adapters use tool-specific invocation names: Claude Code `/dflow:<id>`; GitHub Copilot prompt menu `/dflow-<id>` or canonical `/dflow:<id>` as text; Codex CLI plain text without a slash, such as `dflow:status`. Canonical `/dflow:*` names remain defined in dflow/specs/shared/AI-AGENT-GUIDE.md. If upgrading from Dflow 0.5.0, stale `.claude/commands/dflow/dflow-*.md` files generated by 0.5.0 are detected and listed for removal in the confirmation preview, so Claude Code does not show both old and new command names; edited or non-Dflow files are kept with a warning.\n'
    : '';

  stdout.write(`
Dflow AI agent configuration complete.

Recommended next steps:
- Keep AI-agent-specific root files small.
- Put durable workflow changes in dflow/specs/shared/AI-AGENT-GUIDE.md.
- If a merge snippet was created, review it and merge the pointer into the existing tool instruction file.
${commandAdapterStep}
`);
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
    await checkLegacyRootSpecsDir(cwd, findings);
    await checkLegacySharedDir(cwd, findings);
    await checkConventionsDflowVersion(cwd, findings);
    await checkOrphanedWorkflowBundleFiles(cwd, findings);

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

async function checkLegacyRootSpecsDir(cwd, findings) {
  const legacyPath = path.join(cwd, 'specs');
  if ((await pathExists(legacyPath)) && (await containsInitializedContent(legacyPath))) {
    findings.push({
      level: 'warn',
      title: 'Legacy specs/ directory at project root',
      detail: 'V1 layout uses dflow/specs/ instead. The CLI does not modify root specs/.',
      action: 'See docs/migrating-to-dflow-v1.md (Step 1) for the manual migration steps.'
    });
  }
}

async function checkLegacySharedDir(cwd, findings) {
  const candidates = [
    path.join(cwd, 'dflow', 'specs', '_共用'),
    path.join(cwd, 'specs', '_共用')
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      const rel = normalizePath(path.relative(cwd, candidate));
      findings.push({
        level: 'warn',
        title: `Legacy ${rel}/ directory`,
        detail: 'V1 layout uses shared/ (canonical English directory name).',
        action: 'See docs/migrating-to-dflow-v1.md (Step 2) for the rename steps.'
      });
    }
  }
}

async function checkConventionsDflowVersion(cwd, findings) {
  const conventionsPath = path.join(cwd, 'dflow', 'specs', 'shared', '_conventions.md');
  if (!(await pathExists(conventionsPath))) return;
  const content = await fs.readFile(conventionsPath, 'utf8').catch(() => '');
  if (!/^> Dflow Version:/m.test(content)) {
    findings.push({
      level: 'info',
      title: 'dflow/specs/shared/_conventions.md missing Dflow Version line',
      detail: 'V1 init writes a `> Dflow Version: <x.y.z>` line in the front matter automatically. This project predates that convention.',
      action: 'Optionally add the line manually so future migration / review can identify the spec convention version.'
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
async function checkOrphanedWorkflowBundleFiles(cwd, findings) {
  const bundleDir = path.join(cwd, WORKFLOW_BUNDLE_DEST);
  if (!(await pathExists(bundleDir))) return;

  const edition = await inferProjectBundleEdition(cwd);
  if (!edition) return;

  let sourceFiles;
  try {
    sourceFiles = await listBundleSourceFiles(edition);
  } catch {
    return;
  }
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

function printDoctorReport(stdout, cwd, findings) {
  stdout.write(`Dflow Doctor ${pkg.version}\n`);
  stdout.write(`Project: ${cwd}\n\n`);

  if (findings.length === 0) {
    stdout.write('All checks passed. No legacy artifacts detected.\n');
    return;
  }

  for (const finding of findings) {
    stdout.write(`[${finding.level}] ${finding.title}\n`);
    stdout.write(`        ${finding.detail}\n`);
    stdout.write(`        ${finding.action}\n\n`);
  }

  const counts = { warn: 0, info: 0 };
  for (const f of findings) counts[f.level] = (counts[f.level] || 0) + 1;
  stdout.write(`${findings.length} finding(s): ${counts.warn} warn, ${counts.info} info.\n`);
  stdout.write('Doctor is read-only and does not modify any files.\n');
}

module.exports = {
  runConfigureAgents,
  runDoctor,
  runInit,
  validateProseLanguage,
  ensureProseLanguageSection,
  buildFilePlan
};
