// PROPOSAL-074 — default project-level skill install: the TTY halves of the contract.
//
// test/smoke.mjs drives the CLI through spawned processes whose stdio are pipes
// (never a TTY), which exercises the non-TTY halves of PROPOSAL-074 (install by
// default, never consume a stdin slot, old answer sequences unchanged). The TTY
// halves — the (Y/n) question itself, blank-defaults-to-yes, the n-path skip hint,
// the agent gate, and configure-agents' "already has a skill -> not asked" rule —
// cannot be reached through pipes, so this file drives runInit / runConfigureAgents
// in-process with PassThrough streams faking isTTY.
//
// Hang safety: every scripted input stream is end()ed after the answers, so a
// regression that consumes an extra answer hits EOF -> readline close -> UserAbort
// instead of waiting forever on a prompt; the assertions then fail fast on the
// missing files / output.

import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import init from '../lib/init.js';

const { runInit, runConfigureAgents } = init;

const SKILL_QUESTION = 'Install the project-level Dflow skill for natural-language auto-trigger?';
const SKILL_SKIP_HINT = 'Skipped the project-level skill; add it later with `dflow configure-agents --skills`.';

const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-skill-default-'));
let projectCounter = 0;

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

function ttyStdin(lines) {
  const stream = new PassThrough();
  stream.isTTY = true;
  stream.end(lines.join('\n') + '\n');
  return stream;
}

function ttyStdout() {
  const stream = new PassThrough();
  stream.isTTY = true;
  stream.setEncoding('utf8');
  stream.text = '';
  stream.on('data', (chunk) => {
    stream.text += chunk;
  });
  return stream;
}

function captureStderr() {
  const stream = new PassThrough();
  stream.setEncoding('utf8');
  stream.text = '';
  stream.on('data', (chunk) => {
    stream.text += chunk;
  });
  return stream;
}

// init prompt order: project type, tech stack, migration, prose, git policy,
// AI commit marker, optional starter files, AI agents[, skill question], confirm.
function initAnswers(agents, extra = []) {
  return ['1', 'Node 20, Express 4, Jest', 'none', '1', '2', '1', '1', agents, ...extra, 'y'];
}

async function newProjectDir() {
  projectCounter += 1;
  const dir = join(tempRoot, `p${projectCounter}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function runInitTty(cwd, answers) {
  const stdout = ttyStdout();
  const stderr = captureStderr();
  const code = await runInit({ cwd, stdin: ttyStdin(answers), stdout, stderr });
  return { code, stdout: stdout.text, stderr: stderr.text };
}

async function runConfigureTty(cwd, answers, options = {}) {
  const stdout = ttyStdout();
  const stderr = captureStderr();
  const code = await runConfigureAgents({
    cwd,
    stdin: ttyStdin(answers),
    stdout,
    stderr,
    commandAdapters: Boolean(options.commandAdapters),
    skills: Boolean(options.skills)
  });
  return { code, stdout: stdout.text, stderr: stderr.text };
}

try {
  // (1) TTY + blank answer -> default yes: skill installed.
  const blankRoot = await newProjectDir();
  const blankRun = await runInitTty(blankRoot, initAnswers('2', ['']));
  assert.equal(blankRun.code, 0, `blank-default init failed\nSTDOUT:\n${blankRun.stdout}\nSTDERR:\n${blankRun.stderr}`);
  assert.match(blankRun.stdout, new RegExp(SKILL_QUESTION.replace(/[?()]/g, '\\$&')), 'TTY init should ask the skill question');
  assert.equal(await exists(join(blankRoot, '.claude/skills/dflow/SKILL.md')), true, 'blank answer should default to installing the skill');
  const blankSkill = await readFile(join(blankRoot, '.claude/skills/dflow/SKILL.md'), 'utf8');
  assert.match(blankSkill, /<!-- dflow-generated: skill-adapter -->/, 'installed skill should carry the generated marker');
  assert.match(blankRun.stdout, /Dflow-managed derivatives/, 'init next steps should carry the version-control hint when the skill installed');

  // (2) TTY + explicit y -> installed.
  const yesRoot = await newProjectDir();
  const yesRun = await runInitTty(yesRoot, initAnswers('2', ['y']));
  assert.equal(yesRun.code, 0, `explicit-y init failed\nSTDOUT:\n${yesRun.stdout}\nSTDERR:\n${yesRun.stderr}`);
  assert.equal(await exists(join(yesRoot, '.claude/skills/dflow/SKILL.md')), true, 'explicit y should install the skill');

  // (3) TTY + n -> not installed, mandatory skip hint, rest of the plan written.
  const noRoot = await newProjectDir();
  const noRun = await runInitTty(noRoot, initAnswers('2', ['n']));
  assert.equal(noRun.code, 0, `n-path init failed\nSTDOUT:\n${noRun.stdout}\nSTDERR:\n${noRun.stderr}`);
  assert.equal(await exists(join(noRoot, '.claude/skills/dflow/SKILL.md')), false, 'answering n should skip the skill install');
  assert.equal(await exists(join(noRoot, 'CLAUDE.md')), true, 'answering n must not abort the rest of the init plan');
  assert.ok(noRun.stdout.includes(SKILL_SKIP_HINT), 'n path must print the configure-agents --skills hint');
  assert.doesNotMatch(noRun.stdout, /Dflow-managed derivatives/, 'no version-control hint when the skill was skipped');

  // (4) TTY + no agents selected -> question not asked, no skill, no stdin slot
  // consumed (the y after "none" must reach the final confirmation, or the plan
  // would EOF-abort and write nothing).
  const noneRoot = await newProjectDir();
  const noneRun = await runInitTty(noneRoot, initAnswers('none'));
  assert.equal(noneRun.code, 0, `no-agent init failed\nSTDOUT:\n${noneRun.stdout}\nSTDERR:\n${noneRun.stderr}`);
  assert.ok(!noneRun.stdout.includes(SKILL_QUESTION), 'no-agent init must not ask the skill question');
  assert.equal(await exists(join(noneRoot, 'dflow/specs/shared/_conventions.md')), true, 'no-agent init must still write the plan (question would have eaten the confirm y)');
  assert.equal(await exists(join(noneRoot, '.claude/skills/dflow/SKILL.md')), false, 'no-agent init must not install any skill');

  // (5) configure-agents TTY, selected agent missing its skill -> asked; blank installs.
  const cfgRoot = await newProjectDir();
  const cfgInit = await runInitTty(cfgRoot, initAnswers('none'));
  assert.equal(cfgInit.code, 0, `cfg base init failed\nSTDOUT:\n${cfgInit.stdout}\nSTDERR:\n${cfgInit.stderr}`);
  const cfgAsk = await runConfigureTty(cfgRoot, ['2', '', 'y']);
  assert.equal(cfgAsk.code, 0, `configure-agents ask failed\nSTDOUT:\n${cfgAsk.stdout}\nSTDERR:\n${cfgAsk.stderr}`);
  assert.ok(cfgAsk.stdout.includes(SKILL_QUESTION), 'configure-agents must ask when a selected agent has no skill yet');
  assert.equal(await exists(join(cfgRoot, '.claude/skills/dflow/SKILL.md')), true, 'blank answer should default-install the missing skill');
  assert.match(cfgAsk.stdout, /Dflow-managed derivatives/, 'configure-agents next steps should carry the version-control hint');

  // (6) configure-agents TTY, agent already has the skill -> NOT asked, plan still
  // completes (the y after the agent selection must reach the final confirmation).
  const cfgAgain = await runConfigureTty(cfgRoot, ['2', 'y']);
  assert.equal(cfgAgain.code, 0, `configure-agents re-run failed\nSTDOUT:\n${cfgAgain.stdout}\nSTDERR:\n${cfgAgain.stderr}`);
  assert.ok(!cfgAgain.stdout.includes(SKILL_QUESTION), 'an agent that already has a skill must not be re-asked');
  assert.match(cfgAgain.stdout, /AI agent configuration complete/, 're-run must reach the write phase (no stdin slot misalignment)');

  // (7) configure-agents TTY, missing skill + n -> skip hint, shims written, no skill.
  const nRoot = await newProjectDir();
  const nInit = await runInitTty(nRoot, initAnswers('none'));
  assert.equal(nInit.code, 0, `n-path base init failed\nSTDOUT:\n${nInit.stdout}\nSTDERR:\n${nInit.stderr}`);
  const cfgNo = await runConfigureTty(nRoot, ['3', 'n', 'y']);
  assert.equal(cfgNo.code, 0, `configure-agents n-path failed\nSTDOUT:\n${cfgNo.stdout}\nSTDERR:\n${cfgNo.stderr}`);
  assert.ok(cfgNo.stdout.includes(SKILL_SKIP_HINT), 'configure-agents n path must print the --skills hint');
  assert.equal(await exists(join(nRoot, '.github/skills/dflow/SKILL.md')), false, 'answering n should skip the Copilot skill');
  assert.equal(await exists(join(nRoot, '.github/copilot-instructions.md')), true, 'answering n must not abort the shim projection');

  // (8) explicit --skills flag -> no question (flag short-circuits), skill projected.
  const flagRoot = await newProjectDir();
  const flagInit = await runInitTty(flagRoot, initAnswers('none'));
  assert.equal(flagInit.code, 0, `flag base init failed\nSTDOUT:\n${flagInit.stdout}\nSTDERR:\n${flagInit.stderr}`);
  const flagRun = await runConfigureTty(flagRoot, ['2', 'y'], { skills: true });
  assert.equal(flagRun.code, 0, `configure-agents --skills failed\nSTDOUT:\n${flagRun.stdout}\nSTDERR:\n${flagRun.stderr}`);
  assert.ok(!flagRun.stdout.includes(SKILL_QUESTION), '--skills must not ask the question');
  assert.equal(await exists(join(flagRoot, '.claude/skills/dflow/SKILL.md')), true, '--skills should project the skill as before');

  console.log(`skill-default test passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
