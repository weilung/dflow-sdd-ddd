const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const { TextDecoder } = require('node:util');

const MIN_NODE_VERSION = '22.0.0';
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_ROOT = path.join(PACKAGE_ROOT, 'templates');

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

const EDITION_OPTIONS = [
  {
    key: 'core',
    label: 'ASP.NET Core - Clean Architecture + DDD',
    aliases: ['core', 'asp.net core', 'aspnet core']
  },
  {
    key: 'webforms',
    label: 'ASP.NET WebForms - progressive domain extraction',
    aliases: ['webforms', 'asp.net webforms', 'aspnet webforms']
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
  },
  {
    key: 'git-trunk',
    label: 'Git principles - trunk-based',
    aliases: ['git principles - trunk-based', 'trunk', 'trunk-based']
  },
  {
    key: 'git-flow',
    label: 'Git principles - Git Flow',
    aliases: ['git principles - git flow', 'git flow', 'gitflow']
  },
  {
    key: 'claude',
    label: 'CLAUDE.md snippet / project AI guide',
    aliases: ['claude', 'claude.md']
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
    const warnings = [...preflight.warnings, ...buildDetectionWarnings(answers, detection)];
    const plan = await buildFilePlan(cwd, answers);

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
      'Detected legacy specs/. Dflow V1 will not migrate or modify it; new files will be created under dflow/specs/.'
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
      name === 'package.json'
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

  let editionHint = null;
  if (coreSignal && !webFormsSignal) {
    editionHint = 'core';
  } else if (webFormsSignal && !coreSignal) {
    editionHint = 'webforms';
  }

  return {
    hasSourceTree: hasSourceTree || relNames.has('src'),
    editionHint
  };
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

  if (answers.projectType === 'greenfield' && detection.hasSourceTree) {
    warnings.push('Warning: source-tree signals already exist, but project type is Greenfield. Continuing with your selected project type.');
  }

  if (detection.editionHint && answers.edition !== detection.editionHint) {
    warnings.push(
      `Warning: project signals look like ${formatEdition(detection.editionHint)}, but selected edition is ${formatEdition(answers.edition)}. Continuing with your selected edition.`
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

  const edition = await askSelect(rl, stdout, stderr, {
    id: 'Q2',
    question: 'Which Dflow edition should initialize this project?',
    options: EDITION_OPTIONS,
    defaultKey: detection.editionHint
  });

  const techStackSummary = await askText(rl, stderr, {
    id: 'Q3',
    question: 'Confirm the main tech stack details for placeholders.',
    required: true,
    maxLength: 1000,
    allowUnknown: true
  });

  const migrationContext = await askText(rl, stderr, {
    id: 'Q4',
    question: 'Is there migration or legacy context Dflow should note?',
    required: false,
    maxLength: 1000,
    defaultValue: 'none'
  });

  const proseLanguageSelection = await askSelect(rl, stdout, stderr, {
    id: 'Q5',
    question: 'Project prose language for generated spec content?',
    options: PROSE_LANGUAGE_OPTIONS,
    defaultKey: null
  });

  let proseLanguage = proseLanguageSelection;
  if (proseLanguageSelection === 'custom') {
    proseLanguage = await askCustomProseLanguage(rl, stderr);
  }

  const optionalFiles = await askOptionalFiles(rl, stdout, stderr);

  return {
    projectType,
    edition,
    techStackSummary,
    migrationContext,
    proseLanguage,
    optionalFiles
  };
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
      throw new InitError('Too many invalid attempts for Q5a. Dflow init aborted.');
    }
    stderr.write(`${validation.message} (${3 - failedAttempts} attempts left)\n`);
  }
}

async function askOptionalFiles(rl, stdout, stderr) {
  let failedAttempts = 0;

  while (true) {
    stdout.write('\nWhich optional starter files should Dflow seed?\n');
    OPTIONAL_FILE_OPTIONS.forEach((option, index) => {
      const defaultMarker = option.key === 'overview' || option.key === 'git-trunk' ? ' (recommended)' : '';
      stdout.write(`  ${index + 1}. ${option.label}${defaultMarker}\n`);
    });

    const answer = await askLine(rl, 'Enter comma-separated choices, "none", or press Enter for recommended [1,2]: ');
    const parsed = parseMultiselectAnswer(answer, OPTIONAL_FILE_OPTIONS, ['overview', 'git-trunk']);

    if (!parsed.valid) {
      failedAttempts += 1;
      if (failedAttempts >= 3) {
        throw new InitError('Too many invalid attempts for Q6. Dflow init aborted.');
      }
      stderr.write(`${parsed.message} (${3 - failedAttempts} attempts left)\n`);
      continue;
    }

    if (parsed.values.includes('git-trunk') && parsed.values.includes('git-flow')) {
      const keepBoth = await askConfirmation(
        rl,
        'You selected both Git principles templates. Most projects choose one. Keep both? (y/N) '
      );
      if (!keepBoth) {
        failedAttempts = 0;
        continue;
      }
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
      return { valid: false, message: `Invalid optional file selection: ${token}` };
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
    if (options.extractClaudeSnippetBody) {
      content = extractClaudeSnippetBody(content, sourceRel);
    }
    content = substitutePlaceholders(content, substitution);
    if (options.injectProseLanguage) {
      content = ensureProseLanguageSection(content, answers.proseLanguage);
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

  if (answers.edition === 'core') {
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
  if (answers.optionalFiles.includes('git-trunk')) {
    await addTemplate('dflow/specs/shared/Git-principles-trunk.md', 'scaffolding/Git-principles-trunk.md', 'selected');
  }
  if (answers.optionalFiles.includes('git-flow')) {
    await addTemplate('dflow/specs/shared/Git-principles-gitflow.md', 'scaffolding/Git-principles-gitflow.md', 'selected');
  }
  if (answers.optionalFiles.includes('claude')) {
    const rootClaudePath = path.join(cwd, 'CLAUDE.md');
    if (await pathExists(rootClaudePath)) {
      await addTemplate('dflow/specs/shared/CLAUDE-md-snippet.md', 'scaffolding/CLAUDE-md-snippet.md', 'selected, root CLAUDE.md already exists');
    } else {
      await addTemplate('CLAUDE.md', 'scaffolding/CLAUDE-md-snippet.md', 'selected, snippet body only', {
        extractClaudeSnippetBody: true
      });
    }
  }

  for (const item of items) {
    const absolute = path.join(cwd, item.relativePath);
    item.action = (await pathExists(absolute)) ? 'skip' : 'create';
    if (item.action === 'skip') {
      item.notes = item.notes ? `${item.notes}, already exists` : 'already exists';
    }
    item.size = Buffer.byteLength(item.content, 'utf8');
  }

  return {
    items,
    deferred: buildDeferredItems(answers.edition),
    unresolvedInitPlaceholders: Array.from(substitution.entries())
      .filter(([placeholder, value]) => placeholder === value)
      .map(([placeholder]) => placeholder)
  };
}

function buildDeferredItems(edition) {
  const deferred = [...DEFERRED_COMMON];
  if (edition === 'core') {
    deferred.splice(3, 0, {
      relativePath: 'dflow/specs/domain/{context}/events.md',
      reason: 'Core only, but still needs a real bounded context.'
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

function buildSubstitutionMap(cwd, answers) {
  const extracted = extractTechStackPlaceholders(answers.techStackSummary);
  const gitSelection = answers.optionalFiles.filter((key) => key === 'git-trunk' || key === 'git-flow');
  const gitStyle = gitSelection.length === 1 ? (gitSelection[0] === 'git-trunk' ? 'trunk' : 'gitflow') : null;
  const systemName = path.basename(cwd);

  return new Map([
    ['{YYYY-MM-DD}', currentLocalDate()],
    ['{System Name}', systemName],
    ['{系統名稱}', systemName],
    ['{project-type}', answers.projectType],
    ['{edition}', answers.edition],
    ['{tech-stack-summary}', answers.techStackSummary],
    ['{migration-context}', answers.migrationContext],
    ['{prose-language}', answers.proseLanguage],
    ['{ASP.NET Core version}', extracted.aspNetCoreVersion || '{ASP.NET Core version}'],
    ['{EF Core version}', extracted.efCoreVersion || '{EF Core version}'],
    ['{MediatR version}', extracted.mediatRVersion || '{MediatR version}'],
    ['{Test framework}', extracted.testFramework || '{Test framework}'],
    ['{ASP.NET WebForms version}', extracted.webFormsVersion || '{ASP.NET WebForms version}'],
    ['{.NET Framework version}', extracted.dotNetFrameworkVersion || '{.NET Framework version}'],
    ['{ORM / Data Access}', extracted.ormDataAccess || '{ORM / Data Access}'],
    ['{gitflow|trunk}', gitStyle || '{gitflow|trunk}']
  ]);
}

function substitutePlaceholders(content, substitution) {
  let result = content;
  for (const [placeholder, value] of substitution.entries()) {
    result = result.split(placeholder).join(value);
  }
  return result;
}

function extractTechStackPlaceholders(text) {
  if (!text || text.toLowerCase() === 'unknown') {
    return {};
  }

  return {
    aspNetCoreVersion: firstMatch(text, /\bASP\.?NET\s+Core\s*[0-9]+(?:\.[0-9]+)?\b/i),
    efCoreVersion: firstMatch(text, /\b(?:EF\s+Core|Entity\s+Framework\s+Core)\s*[0-9]+(?:\.[0-9]+)?\b/i),
    mediatRVersion: firstMatch(text, /\bMediatR\s*[0-9]+(?:\.[0-9]+)?\b/i),
    testFramework: extractTestFramework(text),
    webFormsVersion: firstMatch(text, /\b(?:ASP\.?NET\s+WebForms|WebForms)(?:\s*[0-9]+(?:\.[0-9]+)?)?\b/i),
    dotNetFrameworkVersion: firstMatch(text, /\b\.NET\s+Framework\s*[0-9]+(?:\.[0-9]+)?\b/i),
    ormDataAccess: firstMatch(text, /\b(?:EF6|Entity\s+Framework\s+6|Dapper|ADO\.NET)\b/i)
  };
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[0] : null;
}

function extractTestFramework(text) {
  if (/\bxUnit\b/i.test(text)) {
    return 'xUnit';
  }
  if (/\bNUnit\b/i.test(text)) {
    return 'NUnit';
  }
  if (/\bMSTest\b/i.test(text)) {
    return 'MSTest';
  }
  return null;
}

function extractClaudeSnippetBody(content, sourceRel) {
  const match = content.match(/## Snippet to merge into `CLAUDE\.md`[\s\S]*?```markdown\r?\n([\s\S]*?)\r?\n```/);
  if (!match) {
    throw new InitError(`Internal error: CLAUDE.md snippet body not found in packaged template: ${sourceRel}`);
  }
  return `${match[1].trimEnd()}\n`;
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
    skipped: [],
    warnings: []
  };

  for (const item of plan.items) {
    const targetPath = path.join(cwd, item.relativePath);

    try {
      if (await pathExists(targetPath)) {
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

      const message = error.code === 'ENOTDIR' || error.code === 'EEXIST'
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

  for (const item of plan.items) {
    if (!createdSet.has(item.relativePath)) {
      continue;
    }
    const matches = item.content.match(/{[^{}\n]+}/g) || [];
    matches
      .filter((match) => unresolvedInitPlaceholders.has(match))
      .forEach((match) => placeholders.add(match));
  }

  if (placeholders.size === 0) {
    return [];
  }

  const sorted = Array.from(placeholders).sort();
  const shown = sorted.slice(0, 25).join(', ');
  const suffix = sorted.length > 25 ? `, and ${sorted.length - 25} more` : '';
  return [`Unresolved placeholders remain for later SDD workflows: ${shown}${suffix}.`];
}

function printResultReport(stdout, result, deferred) {
  stdout.write('\nCreated:\n');
  printList(stdout, result.created);

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
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatEdition(edition) {
  return edition === 'core' ? 'ASP.NET Core' : 'ASP.NET WebForms';
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function dedupe(values) {
  return Array.from(new Set(values));
}

module.exports = {
  runInit,
  validateProseLanguage,
  ensureProseLanguageSection,
  buildFilePlan
};
