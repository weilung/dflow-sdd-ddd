// PROPOSAL-058 — upgrade-time user-owned / shim drift:
//   (1) the packaged guide projects with guide-canonical markers, and the marked
//       region is substitution-free (byte-stable across projections);
//   (2) configure-agents refreshes the marked region in place, preserves
//       everything outside it, and is idempotent;
//   (3) the 5-state bootstrap table for a pre-marker guide (well-formed /
//       recognizable+offer / declined / malformed / unrecognizable);
//   (4) consent-gated managed-block adoption for a guide-referencing agent file
//       (case 2d), including the "now marker-managed" follow-up run;
//   (5) the `> Dflow Version:` last-reconciled line advances on configure-agents;
//   (6) doctor reports the drift matrix read-only and stays clean elsewhere.
// Section (11) covers PROPOSAL-076: context inference reads the guide's
// "## Project Context" rows (section-scoped) and doctor reports missing rows.
//
// Same conventions as test/skill-default.mjs: runInit / runConfigureAgents /
// runDoctor are driven in-process; TTY halves use PassThrough streams faking
// isTTY; non-TTY halves use plain PassThroughs. Every scripted stdin is end()ed
// so a mis-consumed answer EOF-aborts instead of hanging.

import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import init from '../lib/init.js';
import doctorChecks from '../lib/doctor-checks.js';

const { runInit, runConfigureAgents, runDoctor, writeFilePlan, inferTechStackSummary, inferMigrationContext, placeholderTokens } = init;

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));

const GUIDE_REL = 'dflow/specs/shared/AI-AGENT-GUIDE.md';
const CONVENTIONS_REL = 'dflow/specs/shared/_conventions.md';
const START = '<!-- dflow-generated: guide-canonical START -->';
const END = '<!-- dflow-generated: guide-canonical END -->';
const GUIDE_QUESTION = 'Adopt the managed guide markers now?';
const SHIM_QUESTION = 'Append the managed Dflow block to';
const GP_QUESTION = 'Adopt the managed Git principles markers now?';
const GP_START = '<!-- dflow-generated: git-principles-canonical START -->';
const GP_END = '<!-- dflow-generated: git-principles-canonical END -->';

const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-upgrade-drift-'));
let projectCounter = 0;

function pipeStdin(lines) {
  const stream = new PassThrough();
  stream.end(lines.join('\n') + '\n');
  return stream;
}

function ttyStdin(lines) {
  const stream = pipeStdin(lines);
  stream.isTTY = true;
  return stream;
}

function captureStream(tty) {
  const stream = new PassThrough();
  if (tty) stream.isTTY = true;
  stream.setEncoding('utf8');
  stream.text = '';
  stream.on('data', (chunk) => {
    stream.text += chunk;
  });
  return stream;
}

// init prompt order: project type, tech stack, migration, prose, git policy,
// AI commit marker, optional starter files, AI agents, confirm. Non-TTY runs
// never ask the skill question and install the skill by default.
// ⚠ Q5 (Git policy) is a parameter because the two policies ship DIFFERENT
// starter bodies, and a defect can live in one and not the other — see (1b).
// '1' = gitflow, '2' = trunk (GIT_POLICY_OPTIONS order).
function initAnswers(agents, projectType = '1', gitPolicy = '2') {
  return [projectType, 'Node 20, Express 4, Jest', 'none', '1', gitPolicy, '1', '1', agents, 'y'];
}

async function newProject(agents, projectType = '1', gitPolicy = '2') {
  projectCounter += 1;
  const dir = join(tempRoot, `p${projectCounter}`);
  await mkdir(dir, { recursive: true });
  const stdout = captureStream(false);
  const stderr = captureStream(false);
  const code = await runInit({ cwd: dir, stdin: pipeStdin(initAnswers(agents, projectType, gitPolicy)), stdout, stderr });
  assert.equal(code, 0, `init failed in ${dir}\nSTDOUT:\n${stdout.text}\nSTDERR:\n${stderr.text}`);
  return dir;
}

async function runConfigure(cwd, answers, { tty = false, commandAdapters = false, skills = false } = {}) {
  const stdout = captureStream(tty);
  const stderr = captureStream(false);
  const code = await runConfigureAgents({
    cwd,
    stdin: tty ? ttyStdin(answers) : pipeStdin(answers),
    stdout,
    stderr,
    commandAdapters,
    skills
  });
  return { code, stdout: stdout.text, stderr: stderr.text, all: stdout.text + stderr.text };
}

async function runDoctorAt(cwd) {
  const stdout = captureStream(false);
  const stderr = captureStream(false);
  const code = await runDoctor({ cwd, stdout, stderr });
  return { code, stdout: stdout.text, stderr: stderr.text };
}

function canonicalRegion(content, context) {
  const lf = content.replace(/\r\n/g, '\n');
  const startIdx = lf.indexOf(START);
  const endIdx = lf.indexOf(END);
  assert.ok(startIdx >= 0 && endIdx > startIdx, `${context}: guide-canonical markers should be present and ordered`);
  return lf.slice(startIdx, endIdx + END.length);
}

function stripGuideMarkers(content) {
  return content
    .split('\n')
    .filter((line) => !line.includes('dflow-generated: guide-canonical'))
    .join('\n');
}

const packagedGuide = await readFile(join(repoRoot, 'templates/greenfield/scaffolding/AI-AGENT-GUIDE.md'), 'utf8');
const packagedRegion = canonicalRegion(packagedGuide, 'packaged template');

try {
  // ---------------------------------------------------------------------------
  // (1) Fresh init projects a marker-carrying guide whose canonical region is
  // byte-identical to the packaged template region — i.e. substitution-free.
  // This guards refresh idempotence and doctor's byte comparison: a future edit
  // that drags a substituted placeholder (e.g. `{YYYY-MM-DD}`) into the region
  // fails here.
  // ---------------------------------------------------------------------------
  const base = await newProject('2');
  const freshGuide = await readFile(join(base, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(freshGuide, 'fresh init'), packagedRegion, 'projected canonical region must byte-match the packaged template region');

  // ---------------------------------------------------------------------------
  // (1b) ⚠⚠ THE SAME PROPERTY FOR ALL FOUR Git-principles STARTERS, and this one
  // was missing while the guide's was not — which is exactly why it shipped
  // broken. `p090-b3-x1r` reproduced it: `## [1.2.3] — {YYYY-MM-DD}` sat INSIDE
  // the gitflow canonical region, so `init` substituted the date, `doctor` then
  // compared post-substitution project bytes against raw packaged bytes and
  // reported drift on a project created five seconds earlier — and
  // `configure-agents` "refreshed" the adopter's real date back into the raw
  // `{YYYY-MM-DD}` placeholder.
  //
  // ⚠ The region is compared and rewritten as RAW PACKAGED BYTES. That is the
  // whole contract, and it holds only while the region is substitution-free.
  // Two `{YYYY-MM-DD}` occurrences existed in these files and only one was ever
  // reasoned about (the `> Created:` header, deliberately left outside); the
  // second was noted for a different reason entirely — that it must not be used
  // as a heading anchor — and nobody joined the two facts.
  //
  // ⚠ Asserting byte-equality against a freshly-projected file is deliberately
  // stronger than grepping today's placeholder list: it catches any future
  // substitution mechanism, not just the keys `buildSubstitutionMap` happens to
  // carry now. All four combinations, because the defect was in gitflow only
  // and a trunk-only guard would have passed over it.
  // ---------------------------------------------------------------------------
  for (const [projectType, edition] of [['1', 'greenfield'], ['2', 'brownfield']]) {
    for (const [policyAnswer, policy] of [['1', 'gitflow'], ['2', 'trunk']]) {
      const gp = await newProject('2', projectType, policyAnswer);
      const gpRel = `dflow/specs/shared/Git-principles-${policy}.md`;
      const projected = (await readFile(join(gp, gpRel), 'utf8')).replace(/\r\n/g, '\n');
      const packagedStarter = (
        await readFile(join(repoRoot, `templates/${edition}/scaffolding/Git-principles-${policy}.md`), 'utf8')
      ).replace(/\r\n/g, '\n');
      const slice = (s, what) => {
        const a = s.indexOf(GP_START);
        const b = s.indexOf(GP_END);
        assert.ok(a >= 0 && b > a, `${edition}/${policy} ${what}: git-principles-canonical markers must be present and ordered`);
        return s.slice(a, b + GP_END.length);
      };
      assert.equal(
        slice(projected, 'projected'),
        slice(packagedStarter, 'packaged'),
        `${edition}/${policy}: the projected canonical region must byte-match the packaged one — a substituted placeholder inside the region makes doctor report drift on a fresh project and makes configure-agents rewrite the substituted value back to its placeholder`
      );
      // ⚠⚠ AND THE ANSWER-INDEPENDENT HALF, which the byte-comparison above
      // cannot provide. `p090-b3-y1` proved the gap by injecting
      // `{ORM / persistence}` into a canonical region: with these fixed init
      // answers naming no ORM, that key maps to ITSELF, so the projected bytes
      // equalled the packaged bytes and the assertion above passed over it —
      // while an adopter who does name an ORM would get exactly the defect this
      // guard exists to stop. The byte-comparison proves "these answers do not
      // substitute inside the region"; only the token scan proves "NO answers
      // can". Both are needed, and the token list comes from the substitution
      // map itself so it cannot go stale.
      for (const token of placeholderTokens()) {
        assert.ok(
          !slice(packagedStarter, 'packaged').includes(token),
          `${edition}/${policy}: the canonical region must contain no substitutable placeholder — found ${token}, which some adopter's answers will replace, making their fresh project differ from its own packaged source`
        );
      }
      // ⚠⚠ AND NO ADOPTER-FILL PROMPTS EITHER. A substitution token is not the
      // only way user-owned content lands inside a region Dflow overwrites —
      // `p090-b3-y3` found the trunk starters inviting the adopter to choose a
      // merge strategy and a Conventional-Commits policy INSIDE the canonical
      // span, one of them under a heading literally titled
      // "Merge Strategy (Project Chooses)". Filling those in and running
      // `configure-agents` silently restored the blank prompt: adopter content
      // destroyed by the very mechanism written to protect it.
      //
      // The boundary is not "which section number" — it is **Dflow's rules are
      // canonical, the project's choices are not**. This asserts that, so the
      // distinction survives future template edits.
      // ⚠ Masked, because a brace pair inside a fenced example is documentation
      // (`{type}({scope})`, `{SPEC-ID}`) — the same reason `classifyMarkedRegion`
      // searches the mask. And only braces carrying a CHOICE separator count;
      // a lone `{placeholder}` is the token scan's business, not this one.
      const fillPrompts = [
        [/\{[^}\n]*\s\/\s[^}\n]*\}/, 'a "{a / b}" choice'],
        [/\{[^}\n]*\s\|\s[^}\n]*\}/, 'a "{a | b}" choice'],
        [/fill in/i, 'the phrase "fill in"'],
        [/delete the (two )?unused/i, 'a "delete the unused options" instruction']
      ];
      const maskedRegion = doctorChecks.maskCodeBlocks(slice(packagedStarter, 'packaged'));
      for (const [pattern, what] of fillPrompts) {
        const hit = maskedRegion.match(pattern);
        assert.ok(
          !hit,
          `${edition}/${policy}: the canonical region invites the adopter to edit it — found ${what} (${hit && hit[0]}). Dflow overwrites this span on every refresh, so a choice offered here is a choice destroyed on upgrade. Move it below "## 6. AI Collaboration Rules (Project Policy)" and leave the trade-offs in place.`
        );
      }
      // ⚠⚠ THE MARKER'S POSITION IS PART OF THE CONTRACT, not just its presence.
      // `p090-b3-z1` moved START below "## 1. Branch Structure" — which drops §1
      // out of the refreshed span — and the whole suite stayed green. A one-line
      // marker move is enough to ship adopter-content deletion (or to silently
      // stop refreshing a section), so the boundary is pinned to the two heading
      // anchors the design names, not merely to "a well-formed pair exists".
      {
        const lf = packagedStarter;
        const before = lf.slice(0, lf.indexOf(GP_START));
        const between = lf.slice(lf.indexOf(GP_START) + GP_START.length, lf.indexOf(GP_END));
        const after = lf.slice(lf.indexOf(GP_END) + GP_END.length);
        assert.ok(
          !before.includes('## 1. Branch Structure'),
          `${edition}/${policy}: START must sit ABOVE "## 1. Branch Structure" — it is below it, so section 1 is no longer refreshed`
        );
        assert.ok(
          between.includes('## 1. Branch Structure'),
          `${edition}/${policy}: "## 1. Branch Structure" must be inside the canonical region`
        );
        assert.ok(
          !between.includes('## 6. AI Collaboration Rules (Project Policy)'),
          `${edition}/${policy}: "## 6. AI Collaboration Rules (Project Policy)" must be OUTSIDE the canonical region — it is the adopter's section and the region is overwritten on every refresh`
        );
        assert.ok(
          after.includes('## 6. AI Collaboration Rules (Project Policy)'),
          `${edition}/${policy}: "## 6. AI Collaboration Rules (Project Policy)" must follow the END marker`
        );
      }
      // The header placeholder IS substituted, and must be: it is outside the
      // region on purpose. Asserting it here keeps the test above honest — if
      // substitution stopped happening altogether the equality would pass for
      // the wrong reason.
      assert.match(
        projected,
        /^> Created: \d{4}-\d{2}-\d{2}$/m,
        `${edition}/${policy}: the header date outside the region must still be substituted`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // (1c) ⚠⚠ THE TUTORIAL FIXTURES ARE SHIPPED EVIDENCE, SO THEY DRIFT LIKE ANY
  // OTHER SHIPPED FILE — and nothing was watching them. `p090-b3-z1` caught the
  // greenfield/trunk output still carrying `{Yes / No / Default — fill in}`
  // three commits after those prompts were deleted from the starter: the fixture
  // was refreshed once, the starter changed again, and the two silently parted.
  // Same session, three commits, no test red.
  // `tutorial/` is in `export-dist.sh` `include_paths`, so a stale fixture ships
  // a contradiction to every reader who compares it against a real `init`.
  // ---------------------------------------------------------------------------
  for (const [fixtureRel, packagedRel, label] of [
    ['tutorial/01-greenfield/outputs/dflow/specs/shared/Git-principles-trunk.md',
     'templates/greenfield/scaffolding/Git-principles-trunk.md', 'greenfield/trunk'],
    ['tutorial/02-brownfield/outputs/dflow/specs/shared/Git-principles-gitflow.md',
     'templates/brownfield/scaffolding/Git-principles-gitflow.md', 'brownfield/gitflow']
  ]) {
    const fixture = (await readFile(join(repoRoot, fixtureRel), 'utf8')).replace(/\r\n/g, '\n');
    const packaged = (await readFile(join(repoRoot, packagedRel), 'utf8')).replace(/\r\n/g, '\n');
    const region = (s, what) => {
      const a = s.indexOf(GP_START);
      const b = s.indexOf(GP_END);
      assert.ok(a >= 0 && b > a, `${label} ${what}: git-principles-canonical markers must be present and ordered`);
      return s.slice(a, b + GP_END.length);
    };
    assert.equal(
      region(fixture, 'tutorial output'),
      region(packaged, 'packaged starter'),
      `${label} (${fixtureRel}): the tutorial output's canonical region must byte-match the packaged starter — it is evidence of what \`dflow init\` produces, and tutorial/ ships`
    );
    // ⚠ And its own half must stay its own: the fixture carries a tutorial-filled
    // header date and tutorial CI/CD content. Asserting that here stops a future
    // "just re-copy the packaged file" fix from flattening the sample.
    assert.match(fixture, /^> Created: \d{4}-\d{2}-\d{2}$/m, `${label} (${fixtureRel}): the tutorial output keeps its own filled-in header date`);
    // ⚠⚠ AND ITS §6+ MUST STAY ITS OWN. The header check above passes even when
    // everything from "## 6." down has been replaced by the packaged generic
    // tail — `p090-b3-y4` mutated exactly that and this block stayed green,
    // while its own comment claimed to stop a "just re-copy the packaged file"
    // fix from flattening the sample. Assert the property the comment promises.
    {
      const H6 = '## 6. AI Collaboration Rules (Project Policy)';
      assert.notEqual(
        fixture.slice(fixture.indexOf(H6)),
        packaged.slice(packaged.indexOf(H6)),
        `${label} (${fixtureRel}): the tutorial output's "## 6." section must stay tutorial-owned — it is byte-identical to the packaged starter, so the sample has been flattened`
      );
    }
  }


  // ---------------------------------------------------------------------------
  // (2) Marker-guarded refresh: stale canonical content is restored, content
  // outside the markers (Project Context additions) is preserved, and a second
  // run is byte-idempotent.
  // ---------------------------------------------------------------------------
  const staleGuide = freshGuide
    .replace('\n' + START, '\nMY PROJECT NOTES KEEPME\n\n' + START)
    .replace('## Ceremony Scaling', '## Ceremony Scaling OLD');
  await writeFile(join(base, GUIDE_REL), staleGuide);

  const refresh = await runConfigure(base, ['2', 'y']);
  assert.equal(refresh.code, 0, `refresh run failed\n${refresh.all}`);
  const refreshed = await readFile(join(base, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(refreshed, 'after refresh'), packagedRegion, 'canonical region must be refreshed to the packaged content');
  assert.match(refreshed, /MY PROJECT NOTES KEEPME/, 'content outside the markers must be preserved');
  assert.doesNotMatch(refreshed, /Ceremony Scaling OLD/, 'stale canonical content must be gone');

  const again = await runConfigure(base, ['2', 'y']);
  assert.equal(again.code, 0, `idempotent run failed\n${again.all}`);
  assert.equal(await readFile(join(base, GUIDE_REL), 'utf8'), refreshed, 'second refresh run must be byte-idempotent');

  // ---------------------------------------------------------------------------
  // (5) `> Dflow Version:` advances to the CLI version on configure-agents
  // (last-reconciled semantics); an absent line is never added.
  // ---------------------------------------------------------------------------
  const conventionsPath = join(base, CONVENTIONS_REL);
  const conventions = await readFile(conventionsPath, 'utf8');
  await writeFile(conventionsPath, conventions.replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0'));
  const reconcile = await runConfigure(base, ['2', 'y']);
  assert.equal(reconcile.code, 0, `reconcile run failed\n${reconcile.all}`);
  assert.match(await readFile(conventionsPath, 'utf8'), new RegExp(`^> Dflow Version: ${pkg.version.replace(/\./g, '\\.')}$`, 'm'), 'configure-agents must advance the last-reconciled version line');

  const noLine = (await readFile(conventionsPath, 'utf8')).replace(/^> Dflow Version: .+\n/m, '');
  await writeFile(conventionsPath, noLine);
  const noLineRun = await runConfigure(base, ['2', 'y']);
  assert.equal(noLineRun.code, 0, `absent-line run failed\n${noLineRun.all}`);
  assert.doesNotMatch(await readFile(conventionsPath, 'utf8'), /^> Dflow Version:/m, 'configure-agents must not add an absent Dflow Version line (doctor reports it instead)');
  await writeFile(conventionsPath, await readFile(conventionsPath, 'utf8')); // no-op; keep project usable

  // ---------------------------------------------------------------------------
  // (3) Bootstrap table for a pre-marker guide.
  // ---------------------------------------------------------------------------
  // (3a) non-TTY: recognizable but marker-less -> untouched + warn (never asks).
  const boot = await newProject('2');
  const bootGuide = await readFile(join(boot, GUIDE_REL), 'utf8');
  const preMarker = stripGuideMarkers(
    bootGuide.replace('\n' + START, '\nMY PROJECT NOTES KEEPME\n\n' + START)
  );
  await writeFile(join(boot, GUIDE_REL), preMarker);

  const nonTty = await runConfigure(boot, ['2', 'y']);
  assert.equal(nonTty.code, 0, `non-TTY pre-marker run failed\n${nonTty.all}`);
  assert.equal(await readFile(join(boot, GUIDE_REL), 'utf8'), preMarker, 'non-TTY run must not touch a pre-marker guide');
  assert.match(nonTty.all, /predates Dflow's guide-canonical markers/, 'non-TTY run must warn about the frozen guide');
  assert.ok(!nonTty.all.includes(GUIDE_QUESTION), 'non-TTY run must never ask the adoption question');

  // (3b) TTY + blank answer -> default No, untouched.
  const declined = await runConfigure(boot, ['2', '', 'y'], { tty: true });
  assert.equal(declined.code, 0, `declined adoption run failed\n${declined.all}`);
  assert.ok(declined.stdout.includes(GUIDE_QUESTION), 'TTY run must offer marker adoption for a recognizable pre-marker guide');
  assert.equal(await readFile(join(boot, GUIDE_REL), 'utf8'), preMarker, 'blank answer must default to No (guide untouched)');

  // (3c) TTY + y -> adopted: markers present, canonical current, Project Context
  // (including the custom line) carried over.
  const adopted = await runConfigure(boot, ['2', 'y', 'y'], { tty: true });
  assert.equal(adopted.code, 0, `adoption run failed\n${adopted.all}`);
  assert.ok(adopted.stdout.includes(GUIDE_QUESTION), 'TTY adoption run must ask the question');
  const adoptedGuide = await readFile(join(boot, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(adoptedGuide, 'after adoption'), packagedRegion, 'adopted guide must carry the current canonical region');
  assert.match(adoptedGuide, /MY PROJECT NOTES KEEPME/, 'adoption must keep the Project Context section');
  const followUp = await runConfigure(boot, ['2', 'y'], { tty: true });
  assert.equal(followUp.code, 0, `post-adoption run failed\n${followUp.all}`);
  assert.ok(!followUp.stdout.includes(GUIDE_QUESTION), 'an adopted guide must not be re-asked');

  // (3d) malformed markers -> untouched + warn (TTY run must not even offer).
  const malformed = await newProject('2');
  const malformedGuide = (await readFile(join(malformed, GUIDE_REL), 'utf8')).replace(END, `${END}\n${START}`);
  await writeFile(join(malformed, GUIDE_REL), malformedGuide);
  const malformedRun = await runConfigure(malformed, ['2', 'y'], { tty: true });
  assert.equal(malformedRun.code, 0, `malformed-marker run failed\n${malformedRun.all}`);
  assert.equal(await readFile(join(malformed, GUIDE_REL), 'utf8'), malformedGuide, 'malformed markers must leave the guide untouched');
  assert.match(malformedRun.all, /malformed guide-canonical markers/, 'malformed markers must warn');
  assert.ok(!malformedRun.stdout.includes(GUIDE_QUESTION), 'malformed markers must not trigger the adoption offer');

  // (3e) unrecognizable file -> untouched + warn.
  const foreign = await newProject('2');
  await writeFile(join(foreign, GUIDE_REL), '# Our own agent notes\n\nNothing Dflow-shaped here.\n');
  const foreignRun = await runConfigure(foreign, ['2', 'y'], { tty: true });
  assert.equal(foreignRun.code, 0, `unrecognizable-guide run failed\n${foreignRun.all}`);
  assert.equal(await readFile(join(foreign, GUIDE_REL), 'utf8'), '# Our own agent notes\n\nNothing Dflow-shaped here.\n', 'unrecognizable guide must stay untouched');
  assert.match(foreignRun.all, /not recognizable as a Dflow guide/, 'unrecognizable guide must warn');
  assert.ok(!foreignRun.stdout.includes(GUIDE_QUESTION), 'unrecognizable guide must not trigger the adoption offer');

  // ---------------------------------------------------------------------------
  // (4) Case-2d shim adoption: consent appends the managed block (keeping the
  // user's content), the file is marker-managed afterwards, and declining keeps
  // the original skip behavior.
  // ---------------------------------------------------------------------------
  const shim = await newProject('none');
  const userAgents = '# Team agents file\n\nRead dflow/specs/shared/AI-AGENT-GUIDE.md before big changes.\n\nMY CUSTOM RULES KEEPME\n';
  await writeFile(join(shim, 'AGENTS.md'), userAgents);
  // Slots: agent select, skill question (missing -> n), shim adoption (guide is
  // freshly created so no guide offer), final confirm.
  const adoptShim = await runConfigure(shim, ['1', 'n', 'y', 'y'], { tty: true });
  assert.equal(adoptShim.code, 0, `shim adoption run failed\n${adoptShim.all}`);
  assert.ok(adoptShim.stdout.includes(SHIM_QUESTION), 'TTY run must offer the managed-block adoption for a 2d agent file');
  const adoptedAgents = await readFile(join(shim, 'AGENTS.md'), 'utf8');
  assert.match(adoptedAgents, /<!-- dflow-generated: agent-shim START -->/, 'consent must append the marked Dflow block');
  assert.match(adoptedAgents, /MY CUSTOM RULES KEEPME/, 'the user content must be preserved');
  assert.ok(adoptedAgents.startsWith('# Team agents file'), 'the user file head must be preserved');
  assert.match(adoptShim.all, /remove any older Dflow wording outside the marked block/, 'adoption must remind the user to clean older Dflow wording');

  const shimAgain = await runConfigure(shim, ['1', 'n', 'y'], { tty: true });
  assert.equal(shimAgain.code, 0, `post-adoption shim run failed\n${shimAgain.all}`);
  assert.ok(!shimAgain.stdout.includes(SHIM_QUESTION), 'a marker-managed agent file must not be re-offered');
  assert.equal(await readFile(join(shim, 'AGENTS.md'), 'utf8'), adoptedAgents, 'the marker-managed agent file must be byte-idempotent');

  const shimNo = await newProject('none');
  await writeFile(join(shimNo, 'AGENTS.md'), userAgents);
  const declineShim = await runConfigure(shimNo, ['1', 'n', 'n', 'y'], { tty: true });
  assert.equal(declineShim.code, 0, `shim decline run failed\n${declineShim.all}`);
  assert.ok(declineShim.stdout.includes(SHIM_QUESTION), 'decline run must have been offered');
  assert.equal(await readFile(join(shimNo, 'AGENTS.md'), 'utf8'), userAgents, 'declining must leave the agent file untouched');

  // ---------------------------------------------------------------------------
  // (6) Doctor drift matrix — read-only, exit 0, and each detector fires.
  // ---------------------------------------------------------------------------
  // Project A: stale version line, non-machine AI-commit line, pre-marker guide
  // with a renamed heading (dangling § from the bundle), unmanaged CLAUDE.md,
  // older bundle manifest, old-shape active _index.md (completed/ ignored),
  // edited Git-principles starter.
  const aged = await newProject('2');
  const agedConventionsPath = join(aged, CONVENTIONS_REL);
  let agedConventions = await readFile(agedConventionsPath, 'utf8');
  agedConventions = agedConventions
    .replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0')
    .replace(/^AI commit marker: `none`$/m, 'AI commit marker: none');
  await writeFile(agedConventionsPath, agedConventions);

  const agedGuidePath = join(aged, GUIDE_REL);
  const agedGuide = stripGuideMarkers((await readFile(agedGuidePath, 'utf8')).replace('## Ceremony Scaling', '## Old Scaling'));
  await writeFile(agedGuidePath, agedGuide);

  await writeFile(join(aged, 'CLAUDE.md'), (await readFile(join(aged, 'CLAUDE.md'), 'utf8')) + '\nEXTRA TEAM RULES\n');

  const manifestPath = join(aged, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = '0.8.0';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const oldIndex = '---\nspec-id: SPEC-20260101-001\nstatus: in-progress\n---\n\n# Old Feature\n\n## Goals & Scope\n\nx\n\n## Phase Specs\n\nnone yet\n';
  await mkdir(join(aged, 'dflow/specs/features/active/SPEC-20260101-001-old'), { recursive: true });
  await writeFile(join(aged, 'dflow/specs/features/active/SPEC-20260101-001-old/_index.md'), oldIndex);
  await mkdir(join(aged, 'dflow/specs/features/completed/SPEC-20250101-001-done'), { recursive: true });
  await writeFile(join(aged, 'dflow/specs/features/completed/SPEC-20250101-001-done/_index.md'), oldIndex);

  // PROPOSAL-090 route B3 — the Git principles starter is half Dflow-canonical
  // (sections 1-5, marker-delimited, refreshed in place) and half the project's
  // (header, "## 6. AI Collaboration Rules" down). The drift check must prove
  // BOTH directions, because a guard that only fires is as broken as one that
  // never does:
  //   - false rejection: an edit OUTSIDE the region must NOT be reported. This
  //     is the ordinary state of every real project (they fill in CI / CD), and
  //     reporting it is what made the old whole-file comparison unreadable.
  //   - mutation: an edit INSIDE the region MUST be reported.
  const principlesPath = join(aged, 'dflow/specs/shared/Git-principles-trunk.md');
  const principlesSeeded = await readFile(principlesPath, 'utf8');
  assert.ok(
    principlesSeeded.includes('<!-- dflow-generated: git-principles-canonical START -->'),
    'fixture: a freshly seeded starter carries the canonical markers'
  );
  await writeFile(principlesPath, principlesSeeded + '\nLOCAL TWEAK\n');

  const agedDoctor = await runDoctorAt(aged);
  assert.equal(agedDoctor.code, 0, `doctor must stay exit 0 on drift\n${agedDoctor.stdout}${agedDoctor.stderr}`);
  const agedOut = agedDoctor.stdout;
  assert.match(agedOut, /last reconciled with Dflow 0\.8\.0/, 'doctor: stale last-reconciled version');
  // P-081: the stale-version action links the canonical upgrading guide via a
  // blob/main URL composed from package.json's repository slug, and the linked
  // target must exist in the repo — never freeze a URL that would 404.
  const repoSlug = pkg.repository.url.match(/github\.com[/:]([^/]+\/[^/.]+)/)[1];
  const upgradeGuideUrl = `https://github.com/${repoSlug}/blob/main/docs/upgrading.en.md`;
  assert.ok(agedOut.includes(upgradeGuideUrl), `doctor: stale-version action links the canonical upgrading guide URL (${upgradeGuideUrl})`);
  await readFile(join(repoRoot, 'docs/upgrading.en.md'), 'utf8');
  assert.match(agedOut, /## AI Commit Policy line is not machine-readable/, 'doctor: non-machine policy line');
  assert.match(agedOut, /predates managed guide-canonical markers/, 'doctor: pre-marker guide');
  assert.match(agedOut, /Dangling AI-AGENT-GUIDE\.md § reference/, 'doctor: dangling guide § refs');
  assert.match(agedOut, /CLAUDE\.md references the Dflow guide but is not Dflow-managed/, 'doctor: unmanaged shim');
  assert.match(agedOut, /Workflow bundle was projected by Dflow 0\.8\.0/, 'doctor: old bundle manifest');
  assert.match(agedOut, /active\/SPEC-20260101-001-old\/_index\.md looks like an older _index\.md template shape/, 'doctor: old-shape active _index');
  assert.match(agedOut, /Checkpoint Log/, 'doctor: missing section list names Checkpoint Log');
  assert.doesNotMatch(agedOut, /completed\/SPEC-20250101-001-done/, 'doctor: completed/ features are not scanned');
  // FALSE REJECTION direction: `LOCAL TWEAK` sits after the END marker, i.e. in
  // the project's own half. It must not be reported at all.
  assert.doesNotMatch(
    agedOut,
    /Git-principles-trunk\.md canonical sections differ/,
    'doctor: an edit OUTSIDE the canonical region must not be reported as drift'
  );
  assert.doesNotMatch(
    agedOut,
    /Git-principles-trunk\.md predates managed git-principles-canonical markers/,
    'doctor: a marker-carrying starter must not be reported as pre-marker'
  );

  // MUTATION direction, run on a copy so the assertions above keep their tree:
  // put the defect inside the managed region and watch it go red, naming the
  // file and the check.
  const inRegion = join(tempRoot, 'gp-inRegion');
  await cp(aged, inRegion, { recursive: true });
  const inRegionPath = join(inRegion, 'dflow/specs/shared/Git-principles-trunk.md');
  await writeFile(
    inRegionPath,
    (await readFile(inRegionPath, 'utf8')).replace(
      '<!-- dflow-generated: git-principles-canonical START -->',
      '<!-- dflow-generated: git-principles-canonical START -->\nEDITED INSIDE THE MANAGED REGION\n'
    )
  );
  const inRegionOut = (await runDoctorAt(inRegion)).stdout;
  assert.match(
    inRegionOut,
    /Git-principles-trunk\.md canonical sections differ from the current packaged starter/,
    'doctor: an edit INSIDE the canonical region must be reported'
  );

  // A starter that predates the markers is its own state, and must NOT be
  // folded into the drift finding — the two have different actions.
  const gpPreMarker = join(tempRoot, 'gp-gpPreMarker');
  await cp(aged, gpPreMarker, { recursive: true });
  const gpPreMarkerPath = join(gpPreMarker, 'dflow/specs/shared/Git-principles-trunk.md');
  await writeFile(
    gpPreMarkerPath,
    (await readFile(gpPreMarkerPath, 'utf8'))
      .replace('<!-- dflow-generated: git-principles-canonical START -->\n', '')
      .replace('<!-- dflow-generated: git-principles-canonical END -->\n', '')
  );
  const gpPreMarkerOut = (await runDoctorAt(gpPreMarker)).stdout;
  assert.match(
    gpPreMarkerOut,
    /Git-principles-trunk\.md predates managed git-principles-canonical markers/,
    'doctor: a pre-marker starter is reported as pre-marker'
  );

  // ⚠ Malformed markers must be their OWN finding, never folded into
  // "predates": otherwise a file broken by an edit reads as one that never had
  // markers, and the adoption offer would rewrite sections nobody reviewed.
  const brokenMarkers = join(tempRoot, 'gp-brokenMarkers');
  await cp(aged, brokenMarkers, { recursive: true });
  const brokenPath = join(brokenMarkers, 'dflow/specs/shared/Git-principles-trunk.md');
  await writeFile(
    brokenPath,
    (await readFile(brokenPath, 'utf8')).replace(
      '<!-- dflow-generated: git-principles-canonical END -->\n',
      ''
    )
  );
  const brokenOut = (await runDoctorAt(brokenMarkers)).stdout;
  assert.match(
    brokenOut,
    /Git-principles-trunk\.md has malformed git-principles-canonical markers/,
    'doctor: a half-marked starter is reported as malformed'
  );
  assert.doesNotMatch(
    brokenOut,
    /Git-principles-trunk\.md predates managed git-principles-canonical markers/,
    'doctor: malformed must not be folded into predates'
  );

  // ⚠⚠ DOCTOR MAY ONLY PROMISE AN OFFER THAT WILL ACTUALLY BE MADE.
  // `configure-agents` offers marker adoption only for a file it can still
  // recognise (both heading anchors, exactly once). `p090-b3-z1` renamed
  // "## 1. Branch Structure" and doctor still said "accept the marker-adoption
  // offer" while configure-agents never asked — a false claim about another
  // command, which is the defect class this whole route exists to remove.
  const unrec = join(tempRoot, 'gp-unrecognizable');
  await cp(aged, unrec, { recursive: true });
  const unrecPath = join(unrec, 'dflow/specs/shared/Git-principles-trunk.md');
  await writeFile(
    unrecPath,
    (await readFile(unrecPath, 'utf8'))
      .replace(`${GP_START}\n\n`, '')
      .replace(`\n${GP_END}\n`, '')
      .replace('## 1. Branch Structure', '## 1. Branching')
  );
  const unrecOut = (await runDoctorAt(unrec)).stdout;
  assert.doesNotMatch(
    unrecOut,
    /accept the marker-adoption offer; it keeps your file header/,
    'doctor: a starter whose heading anchors are gone gets no adoption offer, so doctor must not tell the reader to accept one'
  );
  assert.match(
    unrecOut,
    /Git-principles-trunk\.md is not recognizable as a Dflow Git principles starter/,
    'doctor: it must say what is actually wrong instead'
  );
  // FALSE-REJECTION SIDE: a genuine pre-marker file (anchors intact) still gets
  // the advice — otherwise the assertion above is satisfied by never advising.
  const preOk = join(tempRoot, 'gp-preMarkerOk');
  await cp(aged, preOk, { recursive: true });
  const preOkPath = join(preOk, 'dflow/specs/shared/Git-principles-trunk.md');
  await writeFile(
    preOkPath,
    (await readFile(preOkPath, 'utf8')).replace(`${GP_START}\n\n`, '').replace(`\n${GP_END}\n`, '')
  );
  assert.match(
    (await runDoctorAt(preOk)).stdout,
    /accept the marker-adoption offer; it keeps your file header/,
    'doctor: a recognizable pre-marker starter must still be told about the offer'
  );

  // ⚠⚠ PRESERVATION guard — the highest invariant on this surface, and the one
  // the first version of these tests did NOT protect. Review round `p090-b3-x1`
  // mutated `addGitPrinciplesItem` to overwrite the whole file and this suite
  // still passed, which is a guard that fires in neither direction on the thing
  // that actually matters: `MAINTAINERS.md` § Upgrade model says user-authored
  // content is never auto-overwritten.
  //
  // Two properties, asserted on the real `configure-agents` path:
  //   (a) a marked starter keeps the project's header and everything from
  //       "## 6." down, content-identical (see the EOL note on the mixed-ending
  //       case below: whole-file line endings are normalized to the dominant one,
  //       which is pre-existing shared behaviour, so "byte for byte" is only true
  //       for a file that was already consistent);
  //   (b) adoption of a PRE-marker starter does the same — and does not glue
  //       the END marker onto the `## 6.` heading, which is the critical defect
  //       `p090-b3-x1` reproduced.
  const preserve = join(tempRoot, 'gp-preserve');
  await cp(aged, preserve, { recursive: true });
  const preservePath = join(preserve, 'dflow/specs/shared/Git-principles-trunk.md');
  const seeded = await readFile(preservePath, 'utf8');
  const OWN_MARK = 'PROJECT-OWNED SENTINEL DO NOT TOUCH';
  const createdLine = seeded.split(String.fromCharCode(10)).find((l) => l.startsWith('> Created:'));
  assert.ok(createdLine, 'fixture: the seeded starter carries a project-filled `> Created:` line');
  const withOwnEdits = seeded
    .replace(
      '## 6. AI Collaboration Rules (Project Policy)',
      `## 6. AI Collaboration Rules (Project Policy)\n\n${OWN_MARK}`
    );
  await writeFile(preservePath, withOwnEdits);
  const ownTail = withOwnEdits.slice(withOwnEdits.indexOf('## 6. AI Collaboration Rules'));
  await runConfigure(preserve, ['2', 'y']);
  const afterRefresh = await readFile(preservePath, 'utf8');
  assert.ok(
    afterRefresh.includes(createdLine),
    'configure-agents: the project-filled `> Created:` header line survives a canonical refresh'
  );
  assert.ok(
    afterRefresh.endsWith(ownTail),
    'configure-agents: everything from "## 6." down survives a canonical refresh unchanged (this fixture is uniform-LF, so byte equality is the right assertion here)'
  );

  // ⚠⚠ (b) THE ADOPTION PATH — the half the first version of this suite left
  // unwritten, and the one that matters most: review round `p090-b3-x1` found a
  // CRITICAL boundary defect here (the END marker glued onto the `## 6.`
  // heading) and until now nothing but the fix itself was guarding it.
  //
  // ⚠ The pinned TTY answer sequence is load-bearing, and the reason the guard
  // was owed rather than merely missing. `configure-agents` reads its answers
  // positionally, so a sequence that never reaches the adoption question leaves
  // every assertion below passing on an UNTOUCHED file — a guard that is green
  // for the wrong reason, which is worse than no guard. Two things pin it:
  //   - the fixture is a FRESH project, not `aged`. A fresh init leaves the
  //     guide marker-managed and the agent shim Dflow-managed, so neither the
  //     guide-adoption nor the shim question is offered and nothing else can
  //     eat a slot. (`aged` offers both; that is what defeated the first
  //     attempt at this guard.) The skill file exists after init, so
  //     `resolveSkillInstall` returns without asking too.
  //   - the run asserts it SAW the question. Without that assertion the
  //     sequence could silently drift back out of alignment on any future
  //     prompt change and this whole block would go quietly vacuous.
  const adopt = await newProject('2');
  const adoptPath = join(adopt, 'dflow/specs/shared/Git-principles-trunk.md');
  const adoptSeeded = await readFile(adoptPath, 'utf8');
  const adoptCreated = adoptSeeded.split(String.fromCharCode(10)).find((l) => l.startsWith('> Created:'));
  assert.ok(adoptCreated, 'fixture: the seeded starter carries a project-filled `> Created:` line');
  const gpPackagedCanonical = (() => {
    const lf = adoptSeeded.replace(/\r\n/g, '\n');
    const s = lf.indexOf(GP_START);
    const e = lf.indexOf(GP_END);
    assert.ok(s >= 0 && e > s, 'fixture: the seeded starter carries ordered git-principles-canonical markers');
    return lf.slice(s, e + GP_END.length);
  })();
  // Strip the markers WITH the whitespace they brought, so the fixture is the
  // shape a genuinely pre-marker project has (one blank line between `---` and
  // `## 1.`), not a marker-stripped file with a spare blank line. A fixture that
  // is not the real state proves things about a state nobody is in.
  const adoptPre = adoptSeeded
    .replace(`${GP_START}\n\n`, '')
    .replace(`\n${GP_END}\n`, '')
    .replace(
      '## 6. AI Collaboration Rules (Project Policy)',
      `## 6. AI Collaboration Rules (Project Policy)\n\n${OWN_MARK}`
    );
  assert.ok(!adoptPre.includes(GP_START) && !adoptPre.includes(GP_END), 'fixture: the pre-marker starter must carry neither marker');
  await writeFile(adoptPath, adoptPre);
  const adoptTail = adoptPre.slice(adoptPre.indexOf('## 6. AI Collaboration Rules'));

  // FALSE-REJECTION direction first, twice: a non-TTY run and a declined TTY run
  // must both leave the file byte-identical. Run before the adoption so a passing
  // preservation assertion below cannot be an artefact of nothing having happened.
  const adoptNonTty = await runConfigure(adopt, ['2', 'y']);
  assert.equal(adoptNonTty.code, 0, `pre-marker non-TTY run failed\n${adoptNonTty.all}`);
  assert.equal(await readFile(adoptPath, 'utf8'), adoptPre, 'non-TTY run must not touch a pre-marker Git principles starter');
  assert.ok(!adoptNonTty.all.includes(GP_QUESTION), 'non-TTY run must never ask the Git principles adoption question');
  assert.match(adoptNonTty.all, /predates Dflow's git-principles-canonical markers/, 'non-TTY run must warn about the frozen starter');

  const adoptDeclined = await runConfigure(adopt, ['2', '', 'y'], { tty: true });
  assert.equal(adoptDeclined.code, 0, `declined adoption run failed\n${adoptDeclined.all}`);
  assert.ok(adoptDeclined.stdout.includes(GP_QUESTION), 'TTY run must offer marker adoption for a recognizable pre-marker starter');
  assert.equal(await readFile(adoptPath, 'utf8'), adoptPre, 'a blank answer must default to No (starter untouched)');

  const gpAdopted = await runConfigure(adopt, ['2', 'y', 'y'], { tty: true });
  assert.equal(gpAdopted.code, 0, `adoption run failed\n${gpAdopted.all}`);
  assert.ok(gpAdopted.stdout.includes(GP_QUESTION), 'the adoption run must actually reach the question — otherwise every assertion below is vacuous');
  const afterAdopt = await readFile(adoptPath, 'utf8');
  assert.notEqual(afterAdopt, adoptPre, 'the adoption run must actually rewrite the file');

  // PRESERVATION — the promise this path makes in its own prompt text.
  assert.ok(
    afterAdopt.includes(adoptCreated),
    'adoption: the project-filled `> Created:` header line survives'
  );
  assert.ok(
    afterAdopt.endsWith(adoptTail),
    'adoption: everything from "## 6." down survives unchanged (uniform-LF fixture, so byte equality holds)'
  );

  // ⚠⚠ THE MIXED-ENDING CONTRACT, written down because the docs used to claim
  // more than the code delivers. `p090-b3-y1` built a Git-principles file whose
  // §6+ was CRLF while the rest was LF, made the canonical region stale so a
  // refresh actually happened, and measured the outside-region bytes: 130 CRLFs
  // became 0. `configure-agents` normalizes the WHOLE file to its dominant
  // ending (`detectDominantEol` + `applyEol`) — shared, pre-existing behaviour
  // the guide half has always had, not something this route introduced.
  //
  // So the promise is **content** preservation, not byte equality, and that is
  // what this asserts. Byte equality is still asserted for the uniform-ending
  // fixtures above, which is where it is actually true. An earlier version of
  // this suite asserted byte equality only on uniform files and let the docs
  // generalise it to all files — the gap between what a test proves and what
  // the prose claims is exactly where an overclaim survives.
  const mixedEol = join(tempRoot, 'gp-mixedEol');
  await cp(aged, mixedEol, { recursive: true });
  const mixedPath = join(mixedEol, 'dflow/specs/shared/Git-principles-trunk.md');
  const mixedSeed = await readFile(mixedPath, 'utf8');
  const mixedH6 = mixedSeed.indexOf('## 6. AI Collaboration Rules (Project Policy)');
  assert.ok(mixedH6 > 0, 'fixture: the seeded starter has a "## 6." heading to make CRLF from');
  // Stale INSIDE the region, so a write really happens; CRLF only OUTSIDE it.
  const mixedContent = mixedSeed
      .replace(GP_START, `${GP_START}\nSTALE INSIDE THE REGION`)
      .replace(/\n/g, (m, offset) => (offset > mixedH6 ? '\r\n' : m));
  await writeFile(mixedPath, mixedContent);
  const mixedTailBefore = mixedContent.slice(mixedContent.indexOf('## 6. AI Collaboration Rules'));
  assert.ok(mixedTailBefore.includes('\r\n'), 'fixture: §6+ must really carry CRLF, or this case is vacuous');

  const mixedRun = await runConfigure(mixedEol, ['2', 'y']);
  assert.equal(mixedRun.code, 0, `mixed-EOL run failed\n${mixedRun.all}`);
  const mixedAfter = await readFile(mixedPath, 'utf8');
  assert.notEqual(mixedAfter, mixedContent, 'mixed-EOL: the stale canonical region must actually have been refreshed, or this proves nothing');
  const mixedTailAfter = mixedAfter.slice(mixedAfter.indexOf('## 6. AI Collaboration Rules'));
  // CONTENT survives ...
  assert.equal(
    mixedTailAfter.replace(/\r\n/g, '\n'),
    mixedTailBefore.replace(/\r\n/g, '\n'),
    'mixed-EOL: everything from "## 6." down survives as CONTENT — this is the promise the docs may make'
  );
  // ... and the endings are unified, which is why the promise is not byte equality.
  assert.notEqual(
    mixedTailAfter,
    mixedTailBefore,
    'mixed-EOL: if the bytes DID survive intact, the docs may claim byte-for-byte again — update them together with this assertion'
  );
  // ⚠ THE `p090-b3-x1` CRITICAL, asserted as its own symptom. The three-way
  // concat used to inherit its separators from the slices instead of rebuilding
  // them, producing `<!-- ... END -->## 6. AI Collaboration Rules` on one line —
  // a silent restructuring of the section this path promises to keep. The
  // `endsWith` above already fails on it, but naming the symptom is what tells
  // the next reader which defect went red.
  assert.ok(
    !afterAdopt.includes(`${GP_END}## 6.`),
    'adoption: the END marker must never be glued onto the "## 6." heading'
  );
  assert.ok(
    afterAdopt.includes(`${GP_END}\n\n## 6. AI Collaboration Rules (Project Policy)`),
    'adoption: the END marker and "## 6." keep exactly the blank line the packaged starter has'
  );
  // And it must have actually adopted: markers well-formed, canonical region
  // equal to this version's packaged one.
  const adoptedLf = afterAdopt.replace(/\r\n/g, '\n');
  assert.equal(
    adoptedLf.slice(adoptedLf.indexOf(GP_START), adoptedLf.indexOf(GP_END) + GP_END.length),
    gpPackagedCanonical,
    'adoption: the adopted file carries this version\'s canonical region'
  );
  const adoptedDoctor = (await runDoctorAt(adopt)).stdout;
  assert.doesNotMatch(
    adoptedDoctor,
    /Git-principles-trunk\.md (predates managed|has malformed)/,
    'adoption: doctor must see an adopted starter as neither pre-marker nor malformed'
  );
  const adoptAgain = await runConfigure(adopt, ['2', 'y'], { tty: true });
  assert.equal(adoptAgain.code, 0, `post-adoption run failed\n${adoptAgain.all}`);
  assert.ok(!adoptAgain.stdout.includes(GP_QUESTION), 'an adopted starter must not be re-asked');

  assert.doesNotMatch(agedOut, /_conventions\.md is missing the ## Git Policy section/, 'doctor: intact Git Policy section must not warn');

  // Project B: markers intact but canonical region tampered; Git Policy section
  // removed; Git-principles file missing; malformed guide markers on a second
  // pass.
  const tampered = await newProject('2');
  const tamperedGuidePath = join(tampered, GUIDE_REL);
  await writeFile(tamperedGuidePath, (await readFile(tamperedGuidePath, 'utf8')).replace('## Ceremony Scaling', '## Ceremony Scaling Tweaked'));
  const tamperedConventionsPath = join(tampered, CONVENTIONS_REL);
  const tamperedConventions = (await readFile(tamperedConventionsPath, 'utf8')).replace(/^## Git Policy$/m, '## Team Git Rules');
  await writeFile(tamperedConventionsPath, tamperedConventions);
  await unlink(join(tampered, 'dflow/specs/shared/Git-principles-trunk.md'));

  const tamperedDoctor = await runDoctorAt(tampered);
  assert.equal(tamperedDoctor.code, 0, 'doctor must stay exit 0');
  assert.match(tamperedDoctor.stdout, /canonical content differs from this CLI version/, 'doctor: tampered canonical region behind markers');
  assert.match(tamperedDoctor.stdout, /_conventions\.md is missing the ## Git Policy section/, 'doctor: missing policy section');
  // The `Selected Git policy:` line itself is still machine-readable (inference
  // greps the whole file, not the heading), so the deleted principles file is
  // still attributed to the selected policy.
  assert.match(tamperedDoctor.stdout, /Git-principles-trunk\.md is missing/, 'doctor: missing principles file for the still-parseable policy');

  const malformedDoctorGuide = (await readFile(tamperedGuidePath, 'utf8')).replace(END, `${END}\n${START}`);
  await writeFile(tamperedGuidePath, malformedDoctorGuide);
  const malformedDoctor = await runDoctorAt(tampered);
  assert.match(malformedDoctor.stdout, /has malformed guide-canonical markers/, 'doctor: malformed guide markers');

  // Project C: valid policy but the selected principles file deleted -> warn.
  const missingStarter = await newProject('2');
  await unlink(join(missingStarter, 'dflow/specs/shared/Git-principles-trunk.md'));
  const missingStarterDoctor = await runDoctorAt(missingStarter);
  assert.match(missingStarterDoctor.stdout, /Git-principles-trunk\.md is missing/, 'doctor: missing selected principles file');

  // Fresh project: doctor stays clean (also asserted by test/smoke.mjs; guarded
  // here against the new checks regressing into fresh-init noise).
  const clean = await newProject('2');
  const cleanDoctor = await runDoctorAt(clean);
  assert.match(cleanDoctor.stdout, /All checks passed\. No Dflow health findings detected\./, 'doctor must stay clean on a fresh init');

  // ---------------------------------------------------------------------------
  // (7) Brownfield parity for (1): the brownfield template's canonical region is
  // substitution-free and projects byte-identically too.
  // ---------------------------------------------------------------------------
  const brownPackaged = await readFile(join(repoRoot, 'templates/brownfield/scaffolding/AI-AGENT-GUIDE.md'), 'utf8');
  const brownRegion = canonicalRegion(brownPackaged, 'brownfield packaged template');
  const brown = await newProject('2', '2');
  const brownGuide = await readFile(join(brown, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(brownGuide, 'brownfield fresh init'), brownRegion, 'brownfield projected canonical region must byte-match the packaged template region');
  const brownDoctor = await runDoctorAt(brown);
  assert.match(brownDoctor.stdout, /All checks passed\. No Dflow health findings detected\./, 'doctor must stay clean on a fresh brownfield init');

  // ---------------------------------------------------------------------------
  // (8) requiresFullApply guard (implementation-review R1 finding): the version
  // line must NOT advance when an earlier planned change was skipped by a write
  // guard. Driven through the exported writeFilePlan with synthetic plans, the
  // documented way to exercise between-preview-and-write races.
  // ---------------------------------------------------------------------------
  const race = await newProject('2');
  const raceConventionsPath = join(race, CONVENTIONS_REL);
  const raceConventionsOld = (await readFile(raceConventionsPath, 'utf8')).replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0');
  await writeFile(raceConventionsPath, raceConventionsOld);
  const raceGuide = await readFile(join(race, GUIDE_REL), 'utf8');
  const versionItem = () => ({
    relativePath: CONVENTIONS_REL,
    source: 'generated:dflow-version-reconcile',
    notes: 'update Dflow Version line (last reconciled)',
    content: raceConventionsOld.replace(/^> Dflow Version: .+$/m, `> Dflow Version: ${pkg.version}`),
    expectedContent: raceConventionsOld,
    action: 'update',
    overwrite: true,
    rootInject: true,
    requiresFullApply: true,
    size: 1
  });

  // (8a) rootInject guard skip (guide changed after preview) blocks the version item.
  const blocked = await writeFilePlan(race, {
    items: [
      {
        relativePath: GUIDE_REL,
        source: 'test',
        notes: 'guide refresh',
        content: `${raceGuide}refreshed\n`,
        expectedContent: `${raceGuide}changed-after-preview\n`,
        action: 'update',
        overwrite: true,
        rootInject: true,
        size: 1
      },
      versionItem()
    ]
  });
  assert.equal(blocked.updated.length, 0, 'guarded skip must not write anything');
  assert.ok(blocked.warnings.some((w) => w.includes('changed after the preview')), 'guide guard skip must warn');
  assert.ok(blocked.warnings.some((w) => w.includes('Skipped the Dflow Version update')), 'version item must be dropped after a guarded skip');
  assert.match(await readFile(raceConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'version line must not advance over a guarded skip');

  // (8b) stale-removal guard skip blocks it too.
  await writeFile(join(race, 'stale-adapter.md'), 'user replaced this content\n');
  const removeBlocked = await writeFilePlan(race, {
    items: [
      {
        relativePath: 'stale-adapter.md',
        source: 'test',
        notes: 'legacy cleanup',
        content: '',
        expectedContent: 'what dflow generated back then\n',
        action: 'remove'
      },
      versionItem()
    ]
  });
  assert.ok(removeBlocked.warnings.some((w) => w.includes('content changed after preview')), 'removal guard skip must warn');
  assert.match(await readFile(raceConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'version line must not advance over a removal guard skip');

  // (8c) a previewed create that lands on an unexpectedly existing target (the
  // pre-write pathExists branch; the deeper EEXIST TOCTOU catch mirrors the
  // same flag and is unreachable deterministically without fs interception)
  // blocks the version item too.
  await writeFile(join(race, 'appeared-later.md'), 'someone else wrote this\n');
  const createBlocked = await writeFilePlan(race, {
    items: [
      {
        relativePath: 'appeared-later.md',
        source: 'test',
        notes: 'new adapter',
        content: 'dflow content\n',
        action: 'create',
        size: 1
      },
      versionItem()
    ]
  });
  assert.ok(createBlocked.warnings.some((w) => w.includes('Skipped existing target')), 'raced create must warn');
  assert.match(await readFile(raceConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'version line must not advance over a raced create');

  // (8d) control: with no guarded skip the same version item advances the line.
  const advanced = await writeFilePlan(race, { items: [versionItem()] });
  assert.equal(advanced.updated.length, 1, 'control version item must write');
  assert.match(await readFile(raceConventionsPath, 'utf8'), new RegExp(`^> Dflow Version: ${pkg.version.replace(/\./g, '\\.')}$`, 'm'), 'control: version line advances when everything applied');

  // ---------------------------------------------------------------------------
  // (9) Cold-eye gate additions.
  // ---------------------------------------------------------------------------
  // (9a) Declining the final confirmation must not advance the version line.
  const abortProj = await newProject('2');
  const abortConventionsPath = join(abortProj, CONVENTIONS_REL);
  await writeFile(abortConventionsPath, (await readFile(abortConventionsPath, 'utf8')).replace(/^> Dflow Version: .+$/m, '> Dflow Version: 0.8.0'));
  const aborted = await runConfigure(abortProj, ['2', 'n']);
  assert.match(await readFile(abortConventionsPath, 'utf8'), /^> Dflow Version: 0\.8\.0$/m, 'declined final confirm must not advance the version line');

  // (9b) CRLF guide: refresh keeps the dominant EOL and preserves user content
  // after the END marker.
  const crlfProj = await newProject('2');
  const crlfGuidePath = join(crlfProj, GUIDE_REL);
  let crlfGuide = (await readFile(crlfGuidePath, 'utf8'))
    .replace('## Ceremony Scaling', '## Ceremony Scaling STALE');
  crlfGuide = `${crlfGuide}\nAFTER-MARKER NOTES KEEPME\n`.replace(/\n/g, '\r\n');
  await writeFile(crlfGuidePath, crlfGuide);
  const crlfRun = await runConfigure(crlfProj, ['2', 'y']);
  assert.equal(crlfRun.code, 0, `CRLF refresh run failed\n${crlfRun.all}`);
  const crlfRefreshed = await readFile(crlfGuidePath, 'utf8');
  assert.equal(canonicalRegion(crlfRefreshed, 'CRLF refresh'), packagedRegion, 'CRLF guide canonical region must refresh');
  assert.match(crlfRefreshed, /AFTER-MARKER NOTES KEEPME/, 'content after the END marker must be preserved');
  const crlfCount = (crlfRefreshed.match(/\r\n/g) || []).length;
  const bareLfCount = (crlfRefreshed.match(/\n/g) || []).length - crlfCount;
  assert.equal(bareLfCount, 0, 'refreshed CRLF guide must stay CRLF throughout');

  // (9c) Non-TTY run on a 2d agent file: no adoption question, file untouched,
  // but the skip is voiced ("skip and warn" — cold-eye gate G2 finding).
  const silent = await runConfigure(shimNo, ['1', 'y']);
  assert.equal(silent.code, 0, `non-TTY 2d run failed\n${silent.all}`);
  assert.ok(!silent.all.includes(SHIM_QUESTION), 'non-TTY run must not ask the shim adoption question');
  assert.equal(await readFile(join(shimNo, 'AGENTS.md'), 'utf8'), userAgents, 'non-TTY run must leave the 2d agent file untouched');
  assert.match(silent.all, /AGENTS\.md references the Dflow guide but is not marker-managed/, 'non-TTY 2d skip must warn');

  // (9d) doctor flags malformed Codex command-trigger markers in AGENTS.md.
  await writeFile(
    join(shimNo, 'AGENTS.md'),
    `${userAgents}\n<!-- dflow-generated: codex-command-triggers START -->\n`
  );
  const triggerDoctor = await runDoctorAt(shimNo);
  assert.match(triggerDoctor.stdout, /AGENTS\.md has malformed Dflow command-trigger markers/, 'doctor: dangling trigger marker must warn');

  // (9e) One TTY run carrying BOTH offers: slots = agents selection, skill
  // question (agents-skill missing -> n), guide adoption, shim adoption, confirm.
  const both = await newProject('2');
  const bothGuide = await readFile(join(both, GUIDE_REL), 'utf8');
  await writeFile(join(both, GUIDE_REL), stripGuideMarkers(bothGuide));
  await writeFile(join(both, 'AGENTS.md'), userAgents);
  const bothRun = await runConfigure(both, ['1,2', 'n', 'y', 'y', 'y'], { tty: true });
  assert.equal(bothRun.code, 0, `combined adoption run failed\n${bothRun.all}`);
  assert.ok(bothRun.stdout.includes(GUIDE_QUESTION), 'combined run must ask the guide question');
  assert.ok(bothRun.stdout.includes(SHIM_QUESTION), 'combined run must ask the shim question');
  assert.equal(canonicalRegion(await readFile(join(both, GUIDE_REL), 'utf8'), 'combined adoption'), packagedRegion, 'combined run must adopt the guide markers');
  assert.match(await readFile(join(both, 'AGENTS.md'), 'utf8'), /<!-- dflow-generated: agent-shim START -->/, 'combined run must adopt the shim block');

  // (9g) doctor on an unrecognizable markerless guide must not point at the
  // adoption offer configure-agents would never make (cold-eye gate G4).
  const foreignDoctor = await runDoctorAt(foreign);
  assert.equal(foreignDoctor.code, 0, 'doctor must stay exit 0 on a foreign guide');
  assert.match(foreignDoctor.stdout, /is not recognizable as a Dflow guide/, 'doctor: unrecognizable guide gets its own finding');
  assert.doesNotMatch(foreignDoctor.stdout, /accept the marker-adoption offer/, 'doctor: unrecognizable guide must not be told to accept a non-existent offer');

  // (9h) Non-TTY --command-adapters on a 2d AGENTS.md: trigger block upserts,
  // base shim stays skipped, no extra stdin slots consumed, 2d warning voiced.
  const trig = await newProject('none');
  await writeFile(join(trig, 'AGENTS.md'), userAgents);
  const trigRun = await runConfigure(trig, ['1', 'y'], { commandAdapters: true });
  assert.equal(trigRun.code, 0, `non-TTY --command-adapters 2d run failed\n${trigRun.all}`);
  assert.ok(!trigRun.all.includes(SHIM_QUESTION) && !trigRun.all.includes(GUIDE_QUESTION), 'non-TTY adapters run must ask no adoption questions');
  const trigAgents = await readFile(join(trig, 'AGENTS.md'), 'utf8');
  assert.match(trigAgents, /<!-- dflow-generated: codex-command-triggers START -->/, '2d file must gain the trigger block under --command-adapters');
  assert.doesNotMatch(trigAgents, /<!-- dflow-generated: agent-shim START -->/, '2d file must not gain the base shim block without consent');
  assert.ok(trigAgents.startsWith('# Team agents file'), 'user content must be preserved');
  assert.match(trigRun.all, /references the Dflow guide but is not marker-managed/, '2d skip warning must still be voiced under --command-adapters');

  // (9i) Corrupt bundle manifest: doctor degrades read-only with exit 0.
  const corrupt = await newProject('2');
  await writeFile(join(corrupt, 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json'), '{not json');
  const corruptDoctor = await runDoctorAt(corrupt);
  assert.equal(corruptDoctor.code, 0, 'doctor must stay exit 0 on a corrupt bundle manifest');

  // (9f) Adoption when "## Project Context" is the LAST section of the old guide
  // (bounds edge: no following heading).
  const eofProj = await newProject('2');
  await writeFile(
    join(eofProj, GUIDE_REL),
    '# Dflow AI Agent Guide\n\nOld intro.\n\n## Project Context\n\n| Project | X |\n\nEOF-NOTES KEEPME'
  );
  const eofRun = await runConfigure(eofProj, ['2', 'y', 'y'], { tty: true });
  assert.equal(eofRun.code, 0, `PC-at-EOF adoption run failed\n${eofRun.all}`);
  const eofGuide = await readFile(join(eofProj, GUIDE_REL), 'utf8');
  assert.equal(canonicalRegion(eofGuide, 'PC-at-EOF adoption'), packagedRegion, 'PC-at-EOF adoption must carry the current canonical region');
  assert.match(eofGuide, /EOF-NOTES KEEPME/, 'PC section content up to EOF must be carried over');

  // (9g) Line endings, all three CommonMark forms. `projectContextSectionBounds`
  // slices content it splits itself while locating the section through the
  // fence-aware scan in doctor-checks, so the two must agree about what a line
  // is. They stopped agreeing when the scan learned about a lone CR and the
  // slice did not: a CR-only guide became "recognizable", the offer was made,
  // configure-agents exited 0, and the Project Context it exists to preserve was
  // transplanted EMPTY (`p082-b3-g2` finding 1 — a regression introduced by this
  // batch's own fix to the scan).
  //
  // ⚠ This is a DATA-LOSS path with a zero exit code, so it is pinned
  // end-to-end rather than at the helper: the two arrays going out of sync is
  // the mechanism, but "the user's content survived" is the property.
  for (const [label, eol] of [['LF', '\n'], ['CRLF', '\r\n'], ['CR-only', '\r']]) {
    const eolProj = await newProject('2');
    await writeFile(
      join(eolProj, GUIDE_REL),
      ['# Dflow AI Agent Guide', '', 'Old intro.', '', '## Project Context', '', '| Project | X |', '', `${label}-NOTES KEEPME`].join(eol)
    );
    const eolRun = await runConfigure(eolProj, ['2', 'y', 'y'], { tty: true });
    assert.equal(eolRun.code, 0, `${label} adoption run failed\n${eolRun.all}`);
    assert.ok(eolRun.stdout.includes(GUIDE_QUESTION), `${label} pre-marker guide must be recognized and offered adoption`);
    const eolGuide = await readFile(join(eolProj, GUIDE_REL), 'utf8');
    assert.match(
      eolGuide,
      new RegExp(`${label}-NOTES KEEPME`),
      `${label} adoption must carry the Project Context across — an empty transplant here is silent data loss`
    );
    assert.match(eolGuide, /\| Project \| X \|/, `${label} adoption must keep the Project Context table rows`);
  }

  // ---------------------------------------------------------------------------
  // (10) Doctor/configure whitespace agreement (cold-eye gate G5): a context
  // value doctor's machine-format check accepts must be the exact value
  // inference hands to strict consumers (buildSubstitutionMap compares
  // `gitflow`/`trunk` byte-for-byte; the guide's Project Context table takes
  // {prose-language} verbatim). Both sides parse via parseContextLine, so
  // whitespace inside the backticks trims identically — and a whitespace-only
  // value is rejected identically on both sides.
  // ---------------------------------------------------------------------------
  assert.equal(doctorChecks.parseContextLine('Selected Git policy: `gitflow `', doctorChecks.GIT_POLICY_LINE_RE), 'gitflow', 'padded policy value must parse trimmed');
  assert.equal(doctorChecks.parseContextLine('AI commit marker: ` none`', doctorChecks.AI_COMMIT_MARKER_LINE_RE), 'none', 'padded marker value must parse trimmed');
  assert.equal(doctorChecks.parseContextLine('Selected Git policy: ` `', doctorChecks.GIT_POLICY_LINE_RE), null, 'whitespace-only value must parse to null');
  assert.equal(doctorChecks.parseContextLine('no such line', doctorChecks.GIT_POLICY_LINE_RE), null, 'absent line must parse to null');

  const spaced = await newProject('2');
  const spacedConventionsPath = join(spaced, CONVENTIONS_REL);
  const spacedConventions = (await readFile(spacedConventionsPath, 'utf8'))
    .replace(/^Selected Git policy: `trunk`$/m, 'Selected Git policy: `trunk `')
    .replace(/^AI commit marker: `none`$/m, 'AI commit marker: ` none`')
    .replace(/^Project prose language: `zh-TW`$/m, 'Project prose language: `zh-TW `');
  assert.match(spacedConventions, /`trunk `/, 'fixture must carry the padded policy value');
  assert.match(spacedConventions, /` none`/, 'fixture must carry the padded marker value');
  assert.match(spacedConventions, /`zh-TW `/, 'fixture must carry the padded prose value');
  await writeFile(spacedConventionsPath, spacedConventions);

  const spacedDoctor = await runDoctorAt(spaced);
  assert.equal(spacedDoctor.code, 0, `doctor failed on padded values\n${spacedDoctor.stdout}${spacedDoctor.stderr}`);
  assert.doesNotMatch(spacedDoctor.stdout, /is not machine-readable/, 'doctor must accept padded-but-valid context values');

  await unlink(join(spaced, GUIDE_REL));
  const spacedRun = await runConfigure(spaced, ['2', 'y']);
  assert.equal(spacedRun.code, 0, `configure failed on padded values\n${spacedRun.all}`);
  const spacedGuide = await readFile(join(spaced, GUIDE_REL), 'utf8');
  assert.match(spacedGuide, /^\| Prose language \| zh-TW \|$/m, 'inference must hand the substitution map the trimmed prose value');

  // Reject direction: a whitespace-only value is null on both sides — doctor
  // flags the line instead of passing a value inference would refuse.
  await writeFile(spacedConventionsPath, spacedConventions.replace('Selected Git policy: `trunk `', 'Selected Git policy: ` `'));
  const blankDoctor = await runDoctorAt(spaced);
  assert.equal(blankDoctor.code, 0, 'doctor must stay exit 0 on a whitespace-only policy value');
  assert.match(blankDoctor.stdout, /## Git Policy line is not machine-readable/, 'doctor must flag a whitespace-only policy value');

  // ---------------------------------------------------------------------------
  // (11) PROPOSAL-076: context inference reads the guide's "## Project Context"
  // rows (the _overview.md rows the pre-076 code looked for never existed in any
  // packaged template). Unit-level through the exported functions: the only
  // write consumer is whole-guide creation when the guide is missing — exactly
  // when the source is absent — so the real-value read has no black-box write
  // to observe.
  // ---------------------------------------------------------------------------
  const infer = await newProject('2');
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'inference must read the init-substituted Tech stack row');
  assert.equal(await inferMigrationContext(infer), 'none', 'inference must read the init-substituted Migration row');
  assert.equal(await inferTechStackSummary(brown), 'Node 20, Express 4, Jest', 'brownfield inference parity');

  const inferGuidePath = join(infer, GUIDE_REL);
  const inferBaseGuide = await readFile(inferGuidePath, 'utf8');
  const TECH_ROW = '| Tech stack | Node 20, Express 4, Jest |';
  const MIGRATION_ROW = '| Migration / legacy context | none |';
  assert.ok(inferBaseGuide.includes(TECH_ROW) && inferBaseGuide.includes(MIGRATION_ROW), 'fixture guide must carry the substituted rows');

  // (11a) user-edited values are picked up — reading the user region is the point.
  await writeFile(inferGuidePath, inferBaseGuide
    .replace(TECH_ROW, '| Tech stack | Deno 2 + Fresh |')
    .replace(MIGRATION_ROW, '| Migration / legacy context | WebForms -> Core rewrite underway |'));
  assert.equal(await inferTechStackSummary(infer), 'Deno 2 + Fresh', 'edited Tech stack value must win');
  assert.equal(await inferMigrationContext(infer), 'WebForms -> Core rewrite underway', 'edited Migration value must win');

  // (11b) <br> cell content (PROPOSAL-072 cell line-break convention) is captured whole.
  await writeFile(inferGuidePath, inferBaseGuide.replace(TECH_ROW, '| Tech stack | Node 20<br>Express 4 |'));
  assert.equal(await inferTechStackSummary(infer), 'Node 20<br>Express 4', '<br> cells must be captured whole');

  // (11c) deleted row / whitespace-only cell / renamed section heading → fallback.
  await writeFile(inferGuidePath, inferBaseGuide.replace(/^\| Tech stack \|.*\n/m, ''));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'deleted row must fall back');
  await writeFile(inferGuidePath, inferBaseGuide.replace(TECH_ROW, '| Tech stack |   |'));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'whitespace-only cell must fall back (parseContextLine null semantics)');
  await writeFile(inferGuidePath, inferBaseGuide.replace('## Project Context', '## Contexto del Proyecto'));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'renamed Project Context heading must fall back');

  // (11c-bis) The Project Context section must END at a CommonMark-valid
  // heading, including one indented 1-3 spaces. It used to require an
  // unindented `## `, so an indented sibling heading did not close the
  // section and rows BELOW it were read as though they were inside Project
  // Context — inference returned a value from the wrong section and doctor
  // exited 0 with nothing to say (`p082-b3-g4` finding 4). This is the same
  // "one predicate is stricter than its neighbour" class as the rest of this
  // batch, in the other module.
  const bounds = await newProject('1');
  const boundsGuide = await readFile(join(bounds, GUIDE_REL), 'utf8');
  await writeFile(
    join(bounds, GUIDE_REL),
    boundsGuide.replace(/^\| Tech stack \|.*$/m, '   ## Other Section\n\n| Tech stack | DECOY STACK |')
  );
  assert.notEqual(
    await inferTechStackSummary(bounds),
    'DECOY STACK',
    'an indented heading ends Project Context — a row below it must not be read as though it were inside'
  );

  // (11d) section-scoping: a same-name row outside "## Project Context" must
  // neither supply nor shadow the value.
  await writeFile(inferGuidePath, `${inferBaseGuide.replace(/^\| Tech stack \|.*\n/m, '')}\n| Tech stack | DECOY-outside-section |\n`);
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'a Tech stack row outside Project Context must not be read');
  await writeFile(inferGuidePath, `${inferBaseGuide}\n| Tech stack | DECOY-outside-section |\n`);
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'the in-section row must win over an out-of-section decoy');

  // (11e) CRLF guide still parses.
  await writeFile(inferGuidePath, inferBaseGuide.replace(/\n/g, '\r\n'));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'CRLF guide must still parse');

  // (11e2) gate G1: a fenced example containing a fake "## Project Context"
  // heading before the real section must not bound the section.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '## Project Context',
    '```md\n## Project Context\n| Tech stack | FENCED-DECOY |\n```\n\n## Project Context'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a fenced fake Project Context heading must not bound the section');

  // (11e3) gate G1: Markdown-escaped pipes in the cell are captured whole and
  // unescaped, not truncated at the first `\|`.
  await writeFile(inferGuidePath, inferBaseGuide.replace(TECH_ROW, '| Tech stack | Node \\| Express |'));
  assert.equal(await inferTechStackSummary(infer), 'Node | Express', 'escaped pipes in the cell must be captured whole and unescaped');

  // (11e4) gate G2: a fenced decoy row INSIDE the Project Context section can
  // neither shadow the real row nor supply a value when the real row is gone.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '| Field | Value |',
    '```md\n| Tech stack | FENCED-INSIDE-DECOY |\n```\n\n| Field | Value |'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a fenced decoy row inside the section must not shadow the real row');
  await writeFile(inferGuidePath, inferBaseGuide
    .replace(/^\| Tech stack \|.*\n/m, '')
    .replace('| Field | Value |', '```md\n| Tech stack | FENCED-INSIDE-DECOY |\n```\n\n| Field | Value |'));
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'a fenced decoy row must not supply a value when the real row is gone');

  // (11e4b) gate G4: a four-backtick fence containing a three-backtick line
  // must not close early — the decoy row inside stays fenced.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '| Field | Value |',
    '````md\nnested example:\n```\n| Tech stack | FENCED-4TICK-DECOY |\n```\n````\n\n| Field | Value |'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a longer fence must not close on a shorter inner fence line');

  // (11e4d) gate G6: an info-string fence line (```js) inside an open fence is
  // content, not a close — the decoy after it stays fenced.
  await writeFile(inferGuidePath, inferBaseGuide.replace(
    '| Field | Value |',
    '```md\nexample with an inner opener:\n```js\n## Project Context\n| Tech stack | FENCED-INFOSTRING-DECOY |\n```\n\n| Field | Value |'
  ));
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'an info-string fence line inside a fence must not close it');

  // (11e4c) gate G4: a UTF-8 BOM must not defeat recognizability or parsing.
  await writeFile(inferGuidePath, '\uFEFF' + inferBaseGuide);
  assert.equal(await inferTechStackSummary(infer), 'Node 20, Express 4, Jest', 'a BOM-prefixed guide must still parse');

  // (11e5) gate G2 round-trip: bare `|` in the free-text init answers is
  // table-escaped on write and unescaped on read — no phantom cells, no
  // truncation.
  const pipeDir = join(tempRoot, `p-pipe-${projectCounter += 1}`);
  await mkdir(pipeDir, { recursive: true });
  const pipeStdout = captureStream(false);
  const pipeCode = await runInit({
    cwd: pipeDir,
    stdin: pipeStdin(['1', 'Node | Express, Jest', 'legacy | replatform', '1', '2', '1', '1', '2', 'y']),
    stdout: pipeStdout,
    stderr: captureStream(false)
  });
  assert.equal(pipeCode, 0, `pipe-answer init failed\n${pipeStdout.text}`);
  assert.match(await readFile(join(pipeDir, GUIDE_REL), 'utf8'), /^\| Tech stack \| Node \\\| Express, Jest \|$/m, 'bare pipes in Q2 must be escaped in the guide table cell');
  assert.equal(await inferTechStackSummary(pipeDir), 'Node | Express, Jest', 'pipe-carrying tech stack must round-trip through inference');
  assert.equal(await inferMigrationContext(pipeDir), 'legacy | replatform', 'pipe-carrying migration context must round-trip through inference');

  // (11f) missing guide → fallback (the known-limitation source-equals-target case).
  await unlink(inferGuidePath);
  assert.equal(await inferTechStackSummary(infer), 'unknown', 'missing guide must fall back');
  assert.equal(await inferMigrationContext(infer), 'none', 'missing guide must fall back (migration)');

  // (11g) known limitation, black-box: re-creating the missing guide records the
  // fallback values (the source died with the guide), and the result round-trips.
  const recreatedRun = await runConfigure(infer, ['2', 'y']);
  assert.equal(recreatedRun.code, 0, `guide re-creation run failed\n${recreatedRun.all}`);
  const recreatedGuide = await readFile(inferGuidePath, 'utf8');
  assert.match(recreatedGuide, /^\| Tech stack \| unknown \|$/m, 'known limitation: a re-created guide records the fallback tech stack');
  assert.match(recreatedGuide, /^\| Migration \/ legacy context \| none \|$/m, 'known limitation: a re-created guide records the fallback migration context');
  assert.equal(await inferTechStackSummary(infer), 'unknown', 're-created guide must round-trip through inference');

  // (11h) doctor: a recognizable guide missing a Project Context row gets one
  // info finding naming exactly the missing row(s); fresh projects stay clean
  // (asserted in (6)/(7)); an unrecognizable guide keeps only its own finding.
  const pcDoc = await newProject('2');
  const pcGuidePath = join(pcDoc, GUIDE_REL);
  await writeFile(pcGuidePath, (await readFile(pcGuidePath, 'utf8')).replace(/^\| Tech stack \|.*\n/m, ''));
  const pcDoctor = await runDoctorAt(pcDoc);
  assert.equal(pcDoctor.code, 0, 'doctor must stay exit 0 on a missing Project Context row');
  assert.match(pcDoctor.stdout, /^\[info\] .*"## Project Context" is missing machine-readable row\(s\): Tech stack/m, 'doctor: missing Tech stack row is reported at info level');
  assert.match(pcDoctor.stdout, /1 finding\(s\): 0 warn, 1 info\./, 'doctor: the isolated missing-row case must count as exactly one info finding');
  assert.doesNotMatch(pcDoctor.stdout, /row\(s\): Tech stack, Migration/, 'doctor: the intact Migration row must not be listed');

  await writeFile(pcGuidePath, '\uFEFF' + (await readFile(pcGuidePath, 'utf8')));
  const pcBomDoctor = await runDoctorAt(pcDoc);
  assert.match(pcBomDoctor.stdout, /missing machine-readable row\(s\): Tech stack/, 'doctor: a BOM must not defeat the row check');

  // (11h2) gate G5: a marker-managed guide whose Project Context heading was
  // renamed away still gets a doctor finding — the canonical-state check stays
  // silent (markers are fine) and inference silently falls back otherwise.
  const pcGone = await newProject('2');
  const pcGonePath = join(pcGone, GUIDE_REL);
  await writeFile(pcGonePath, (await readFile(pcGonePath, 'utf8')).replace('## Project Context', '## About This Project'));
  const pcGoneDoctor = await runDoctorAt(pcGone);
  assert.equal(pcGoneDoctor.code, 0, 'doctor must stay exit 0 on a missing Project Context section');
  assert.match(pcGoneDoctor.stdout, /has no "## Project Context" section/, 'doctor: marker-managed guide without the section is reported');
  assert.equal(await inferTechStackSummary(pcGone), 'unknown', 'inference falls back without the Project Context section');

  // (11h3) debt 23 gap G: an HTML comment opened ABOVE the heading puts it inside
  // an HTML block, so the section reads as absent while it is sitting right there
  // in the file. What used to fire is the opaque finding asserted at (11h2) —
  // whose action ("restore a section") is impossible advice for a file that
  // already has one, and whose "ignore this if you removed it on purpose" invites
  // dismissing a real malformation.
  // ⚠⚠ THE FIXTURE IS THE MARKER-MANAGED GUIDE ON PURPOSE, and the last assertion
  // here is why: the guide-canonical marker below carries `-->`, so the comment
  // CLOSES and the block is well-formed at EOF. `unclosedHtmlBlockLine` — the
  // obvious predicate, and the one the review recommended — returns -1 on exactly
  // the shape this defect takes in a real guide. Measured before implementing.
  // ⚠ The negative direction is (11h2) directly above: with the heading genuinely
  // renamed away, the opaque info finding is still what fires.
  const pcHidden = await newProject('2');
  const pcHiddenPath = join(pcHidden, GUIDE_REL);
  await writeFile(pcHiddenPath, (await readFile(pcHiddenPath, 'utf8')).replace('## Project Context', '<!-- editing note\n\n## Project Context'));
  const pcHiddenDoctor = await runDoctorAt(pcHidden);
  assert.equal(pcHiddenDoctor.code, 0, 'doctor must stay exit 0 on a guide whose Project Context is hidden');
  assert.match(pcHiddenDoctor.stdout, /^\[info\] .*has a "## Project Context" heading at line \d+ that is inside an HTML block/m, 'doctor: the HTML block is named as the cause, with the heading line');
  assert.match(pcHiddenDoctor.stdout, /The block opens at line \d+ \(`<!-- editing note`\)/, 'the opening line is quoted so the reader can see which block it is');
  assert.doesNotMatch(pcHiddenDoctor.stdout, /has no "## Project Context" section/, 'doctor must not claim the section is absent while the heading is there but unreadable');
  assert.doesNotMatch(pcHiddenDoctor.stdout, /Ignore this if you removed the section on purpose/, 'the opaque wording this replaces must not also appear');
  // ⚠ The finding must NOT diagnose which of the two situations it is
  // (`debt212223-xv1` finding 1). The same shape is produced by a comment left
  // open by accident and by a section commented out deliberately, so a claim that
  // the section is live — and an instruction not to re-add it — is unsupportable.
  assert.doesNotMatch(pcHiddenDoctor.stdout, /do not add a second one/, 'doctor must not instruct against re-adding a section it cannot prove is live');
  assert.match(pcHiddenDoctor.stdout, /doctor cannot tell them apart/, 'the finding must say it reports the shape rather than the cause');
  assert.equal(
    doctorChecks.unclosedHtmlBlockLine(await readFile(pcHiddenPath, 'utf8')), -1,
    "the fixture's comment is CLOSED by the marker below it — this is the fixture-validity assertion for why the check cannot be unclosedHtmlBlockLine"
  );

  // ⚠ The opener must be the block that actually CONTAINS the heading
  // (`debt212223-xv1` finding 2): a closed `<!-- note -->` sitting directly above an
  // open one is part of the same unbroken run of html-typed lines, so walking back
  // to the run's start names a comment that is already fine and sends the reader to
  // repair the wrong line.
  const pcTwoBlocks = await newProject('2');
  const pcTwoPath = join(pcTwoBlocks, GUIDE_REL);
  await writeFile(pcTwoPath, (await readFile(pcTwoPath, 'utf8')).replace('## Project Context', '<!-- closed note -->\n<!-- open note\n\n## Project Context'));
  const pcTwoDoctor = await runDoctorAt(pcTwoBlocks);
  assert.match(pcTwoDoctor.stdout, /The block opens at line \d+ \(`<!-- open note`\)/, 'the opener is the block containing the heading, not the closed comment above it');
  assert.doesNotMatch(pcTwoDoctor.stdout, /`<!-- closed note -->`/, 'a comment that closes on its own line is not the container and must not be named as one');

  // ⚠ Not every HTML block is a comment (`debt212223-xv1` finding 1): `<details>`
  // has no `-->` to add, so that repair must not be offered for it. ⚠ No blank line
  // before the heading here — `<details>` is a type-6 block and a blank line would
  // END it, leaving the heading visible and this fixture testing nothing.
  const pcDetails = await newProject('2');
  const pcDetailsPath = join(pcDetails, GUIDE_REL);
  await writeFile(pcDetailsPath, (await readFile(pcDetailsPath, 'utf8')).replace('## Project Context', '<details>\n## Project Context'));
  const pcDetailsDoctor = await runDoctorAt(pcDetails);
  assert.match(pcDetailsDoctor.stdout, /The block opens at line \d+ \(`<details>`\)/, 'a non-comment HTML block is named by what it actually is');
  assert.doesNotMatch(pcDetailsDoctor.stdout, /close it with `-->`/, 'the `-->` repair must not be offered for a block that has no `-->`');
  // ⚠⚠ AND THE REPAIR IT *DOES* GET MUST WORK (`debt212223-y4` finding 1). This
  // fixture used to assert only the negative — that no `-->` advice appeared — and
  // the wording it silently certified told the adopter to "close" a `<details>`.
  // A closing tag does not end a type-6 block; only a blank line does, so that
  // repair left the finding identical with nothing saying why. Asserting the absence
  // of wrong advice is not asserting the presence of right advice.
  assert.match(pcDetailsDoctor.stdout, /ends at a BLANK LINE, not at a closing tag/, 'a type-6 block must be told the truth about how it ends');
  assert.doesNotMatch(pcDetailsDoctor.stdout, /with its own end marker/, 'the end-marker repair belongs to blocks that have one');
  // The end-condition branch, so the two are pinned against each other rather than
  // one of them being free to drift into the other's case.
  const pcScript = await newProject('2');
  const pcScriptPath = join(pcScript, GUIDE_REL);
  await writeFile(pcScriptPath, (await readFile(pcScriptPath, 'utf8')).replace('## Project Context', '<script>\n## Project Context'));
  const pcScriptDoctor = await runDoctorAt(pcScript);
  assert.match(pcScriptDoctor.stdout, /with its own end marker/, 'a block that ends on a marker is told to use it');
  assert.doesNotMatch(pcScriptDoctor.stdout, /ends at a BLANK LINE/, 'the blank-line rule must not be offered to a block with an end condition');

  // ⚠ A mid-line `<!--` opens nothing (`debt212223-xv2` finding 1): an HTML block
  // begins only at a line whose START satisfies the opener condition, so comment
  // text inside an already-open block is not the container. Naming it sent the
  // reader to close a comment that never opened, on a block whose real opener was
  // the `<details>` above it.
  const pcNested = await newProject('2');
  const pcNestedPath = join(pcNested, GUIDE_REL);
  await writeFile(pcNestedPath, (await readFile(pcNestedPath, 'utf8')).replace('## Project Context', '<details>\nprose <!-- nested-looking text\n## Project Context'));
  const pcNestedDoctor = await runDoctorAt(pcNested);
  assert.match(pcNestedDoctor.stdout, /The block opens at line \d+ \(`<details>`\)/, 'the container is the block that actually opened, not mid-line comment text inside it');
  assert.doesNotMatch(pcNestedDoctor.stdout, /nested-looking text/, 'mid-line comment text must never be reported as the opener');

  // ⚠ Tag-shaped CONTENT inside an open block is not an opener either
  // (`debt212223-xv3` finding 1) — `<div>` / `<p>` lines under a `<details>` look
  // exactly like block starts from the outside. This is the doctor-level companion
  // to the `blockStart` pins on `classifyLines`.
  const pcInnerTags = await newProject('2');
  const pcInnerPath = join(pcInnerTags, GUIDE_REL);
  await writeFile(pcInnerPath, (await readFile(pcInnerPath, 'utf8')).replace('## Project Context', '<details>\n<div>inner shell</div>\n<p>content row</p>\n## Project Context'));
  const pcInnerDoctor = await runDoctorAt(pcInnerTags);
  assert.match(pcInnerDoctor.stdout, /The block opens at line \d+ \(`<details>`\)/, 'the opener is the block that opened, not the last tag-shaped line before the heading');
  assert.doesNotMatch(pcInnerDoctor.stdout, /content row/, 'HTML content inside an open block must never be reported as the opener');

  // ⚠⚠ A COMMENT MARKER ON THE OPENER LINE DOES NOT MAKE IT A COMMENT BLOCK
  // (`debt212223-xv4` finding 1). `<details><!-- note` opens a type-6 TAG block that
  // happens to contain `<!--`, so the `-->` repair does not work — the reviewer ran
  // it and the heading stayed inside the `<details>`. The advice branch must use the
  // same line-start rule the opener scan uses; this fixture is what keeps the two
  // sites of that rule from drifting apart again.
  const pcTagComment = await newProject('2');
  const pcTagCommentPath = join(pcTagComment, GUIDE_REL);
  await writeFile(pcTagCommentPath, (await readFile(pcTagCommentPath, 'utf8')).replace('## Project Context', '<details><!-- note\n## Project Context'));
  const pcTagCommentDoctor = await runDoctorAt(pcTagComment);
  assert.match(pcTagCommentDoctor.stdout, /The block opens at line \d+ \(`<details><!-- note`\)/, 'the opener line is reported as it is');
  assert.doesNotMatch(pcTagCommentDoctor.stdout, /close it with `-->`/, 'a tag block that merely contains `<!--` must not be given the comment repair');
  // ⚠ `<details><!-- note` is a type-6 TAG block, so it gets the blank-line rule —
  // not the `-->` repair (it has no `-->` to add) and not the end-marker repair
  // (type 6 has no end marker). This assertion used to pin the wording
  // `close it or move the section above it`, which was the advice `debt212223-y4`
  // finding 1 showed does not work for this class.
  assert.match(pcTagCommentDoctor.stdout, /ends at a BLANK LINE, not at a closing tag/, 'a tag block that merely contains `<!--` gets the type-6 repair');

  // ⚠⚠ THE PER-EDITION `Will defer:` LIST, PINNED BY WHAT `dflow init` ACTUALLY
  // PRINTS (`debt212223-y1` finding 3). debt 22 was the CLI promising every
  // brownfield adopter a `dflow/specs/architecture/` tree it never creates, because
  // a greenfield-only row lived in a list named COMMON — and when that was fixed,
  // `Will defer`, `buildDeferredItems` and `ADR` each had **zero** matches across
  // `test/`, with both lists module-private. So the cheapest way to bring the defect
  // back was to move one row between the two lists: the whole suite, the cross-ref
  // checker, the lifecycle checker and the tier-cascade checker all stay green while
  // the promise is wrong again. The other two items in that batch shipped with new
  // pins; this one shipped with none, which is why it is here.
  // ⚠ ORDER IS ASSERTED, not just membership: greenfield's list was produced by a
  // `splice` before the fix and by an append after it, and "same five paths" was the
  // claim that had to survive that rewrite.
  for (const [edition, projectType, expected] of [
    ['greenfield', '1', [
      'dflow/specs/domain/{context}/behavior.md',
      'dflow/specs/domain/{context}/models.md',
      'dflow/specs/domain/{context}/rules.md',
      'dflow/specs/domain/{context}/events.md',
      'dflow/specs/architecture/decisions/ADR-*.md'
    ]],
    ['brownfield', '2', [
      'dflow/specs/domain/{context}/behavior.md',
      'dflow/specs/domain/{context}/models.md',
      'dflow/specs/domain/{context}/rules.md'
    ]]
  ]) {
    const deferDir = join(tempRoot, `defer-${edition}`);
    await mkdir(deferDir, { recursive: true });
    const deferOut = captureStream(false);
    const deferCode = await runInit({
      cwd: deferDir,
      stdin: pipeStdin(initAnswers('2', projectType)),
      stdout: deferOut,
      stderr: captureStream(false)
    });
    assert.equal(deferCode, 0, `${edition} init for the deferral pin failed:\n${deferOut.text}`);
    const deferred = deferOut.text
      .split(/\r?\n/)
      .filter((line) => /\|\s*defer\s*\|/.test(line))
      .map((line) => line.split('|')[1].trim());
    assert.deepEqual(
      deferred, expected,
      `${edition} \`Will defer:\` must list exactly these paths, in this order — a row that applies to one edition only must never sit in the shared list`
    );
  }

  const pcBrown = await newProject('2', '2');
  const pcBrownGuidePath = join(pcBrown, GUIDE_REL);
  await writeFile(pcBrownGuidePath, (await readFile(pcBrownGuidePath, 'utf8')).replace(/^\| Migration \/ legacy context \|.*\n/m, ''));
  const pcBrownDoctor = await runDoctorAt(pcBrown);
  assert.match(pcBrownDoctor.stdout, /missing machine-readable row\(s\): Migration \/ legacy context/, 'doctor: brownfield missing Migration row is reported (parity)');

  assert.doesNotMatch(foreignDoctor.stdout, /missing machine-readable row/, 'doctor: unrecognizable guide must not get the Project Context row finding');

  // (11j) gate G3: a markerless guide whose ONLY "## Project Context" heading
  // sits inside a fenced example must be unrecognizable — recognizability now
  // implies locatable bounds, so an accepted adoption offer can never hit the
  // transplant internal error.
  const fencedPc = await newProject('2');
  await writeFile(
    join(fencedPc, GUIDE_REL),
    '# Dflow AI Agent Guide\n\nNotes.\n\n```md\n## Project Context\n```\n\nMore notes.\n'
  );
  const fencedPcRun = await runConfigure(fencedPc, ['2', 'y'], { tty: true });
  assert.equal(fencedPcRun.code, 0, `fenced-only-PC guide run failed\n${fencedPcRun.all}`);
  assert.ok(!fencedPcRun.stdout.includes(GUIDE_QUESTION), 'a guide whose only Project Context heading is fenced must not get the adoption offer');
  assert.match(fencedPcRun.all, /not recognizable as a Dflow guide/, 'fenced-only-PC guide must be treated as unrecognizable');
  const fencedPcDoctor = await runDoctorAt(fencedPc);
  assert.match(fencedPcDoctor.stdout, /is not recognizable as a Dflow guide/, 'doctor: fenced-only-PC guide gets the unrecognizable finding');
  assert.doesNotMatch(fencedPcDoctor.stdout, /accept the marker-adoption offer/, 'doctor: fenced-only-PC guide must not be pointed at a non-existent offer');

  // ---------------------------------------------------------------------------
  // (12) PROPOSAL-078 phase 1 — table-formatting convention delivery:
  // (a) doctor reports spec docs that hold tables but lack the convention
  //     comment (info, aggregated, whole-file comment search);
  // (b) scope boundaries: shared/ and features/completed/ are never scanned,
  //     fence-only tables never count (fresh-init cleanliness is locked by
  //     the earlier clean-project assertions);
  // (c) the canonical flow one-liner is delivered identically across BOTH
  //     tracks' references (grep-sync lock, per the P-078 amendment);
  // (d) unit edges of hasTableWithoutConventionComment.
  // ---------------------------------------------------------------------------
  const conv = await newProject('2');
  const strippedGlossary = (await readFile(join(conv, 'dflow/specs/domain/glossary.md'), 'utf8'))
    .split('\n').filter((line) => !line.includes('Formatting convention: keep table cells concise')).join('\n');
  await writeFile(join(conv, 'dflow/specs/domain/glossary.md'), strippedGlossary);
  // mid-file comment still counts as present (whole-file search, amendment #4)
  await writeFile(join(conv, 'dflow/specs/architecture/notes.md'),
    '# Notes\n\nprose first\n\n<!-- Formatting convention: keep table cells concise. -->\n\n| A | B |\n|---|---|\n| x | y |\n');
  // fenced table only -> not a table-bearing doc
  await writeFile(join(conv, 'dflow/specs/architecture/fenced.md'),
    '# Fenced\n\n```\n| A | B |\n|---|---|\n```\n');
  // completed/ archive is out of scope even when it would otherwise hit
  await mkdir(join(conv, 'dflow/specs/features/completed/SPEC-20250101-001-done'), { recursive: true });
  await writeFile(join(conv, 'dflow/specs/features/completed/SPEC-20250101-001-done/_index.md'),
    '# Done\n\n| A | B |\n|---|---|\n| x | y |\n');

  const convDoctor = await runDoctorAt(conv);
  assert.equal(convDoctor.code, 0, 'doctor stays exit 0 on convention-comment findings');
  assert.match(convDoctor.stdout, /1 spec doc\(s\) hold tables but lack the table-formatting convention comment/, 'doctor: aggregated info finding fires');
  assert.match(convDoctor.stdout, /dflow\/specs\/domain\/glossary\.md/, 'doctor: names the stripped doc');
  assert.doesNotMatch(convDoctor.stdout, /architecture\/notes\.md/, 'doctor: mid-file comment satisfies the check');
  assert.doesNotMatch(convDoctor.stdout, /architecture\/fenced\.md/, 'doctor: fence-only tables never count');
  assert.doesNotMatch(convDoctor.stdout, /completed\/SPEC-20250101-001-done/, 'doctor: completed/ is not scanned');
  assert.match(convDoctor.stdout, /Doctor never edits user-authored specs/, 'doctor: read-only stance stated in the action');

  // (12c) canonical one-liner delivered identically in both tracks
  const CANONICAL_LINE = '> **Table-cell formatting**: keep table cells concise — separate multiple short items with `<br>` (never chain them into one line with ；/; separators), and move long narrative detail out of the cell into a document section (full convention: the formatting comment at each spec doc\'s head).';
  const FLOW_SPOTS = {
    'finish-feature-flow.md': 1,
    'modify-existing-flow.md': 1,
    'new-feature-flow.md': 2,
    'new-phase-flow.md': 2,
    'drift-verification.md': 1
  };
  for (const track of ['greenfield', 'brownfield']) {
    for (const [file, expected] of Object.entries(FLOW_SPOTS)) {
      const content = await readFile(join(repoRoot, 'templates', track, 'references', file), 'utf8');
      const count = content.split(CANONICAL_LINE).length - 1;
      assert.equal(count, expected, `${track}/references/${file}: canonical table-cell line must appear exactly ${expected}x (byte-identical for grep-sync)`);
    }
  }

  // (12d) unit edges (regex boundaries per review p078-r1: single-column
  // outer-pipe tables detected, pipe-less multi-column detected, bare ---
  // excluded)
  assert.equal(doctorChecks.hasTableWithoutConventionComment('| A |\n|---|---|\n| x |\n'), true, 'bare table without comment hits');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('| A |\n|---|\n| long wall cell |\n'), true, 'single-column outer-pipe table is still a table');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('A | B\n---|---\nx | y\n'), true, 'pipe-less two-column delimiter is detected');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('<!-- Formatting convention: keep table cells concise ... -->\n| A | B |\n|---|---|\n'), false, 'comment anywhere satisfies');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('# Doc\n\n---\n\nprose\n'), false, 'thematic break is not a table');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('# Doc\n\n --- \n\nprose\n'), false, 'padded thematic break is not a table either');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('```\n|---|---|\n```\n'), false, 'fenced delimiter row is not a table');
  assert.equal(doctorChecks.hasTableWithoutConventionComment('| A | B |\r\n|---|---|\r\n| x | y |\r\n'), true, 'CRLF docs are detected too');

  // ---------------------------------------------------------------------------
  // PROPOSAL-082 G5 / PROPOSAL-083 §4 — `_conventions.md` staleness fingerprints.
  //
  // The predecessor of this check was written, wired, fixture-tested and then
  // REMOVED, because against the projection bug `f382671` later fixed it could
  // only ever report success. So the first thing asserted here is that it is not
  // vacuous: it must be silent on a real fresh project AND fire on each way a
  // section can be wrong — including the one a whole-file grep cannot see.
  // ---------------------------------------------------------------------------
  {
    // The markers are only meaningful if they are actually in the packaged
    // templates, in the section they claim. Re-derived here rather than trusted
    // from the comment beside the table.
    for (const edition of ['greenfield', 'brownfield']) {
      const packaged = await readFile(join(repoRoot, `templates/${edition}/scaffolding/_conventions.md`), 'utf8');
      for (const fp of doctorChecks.CONVENTIONS_FINGERPRINTS) {
        if (fp.editions && !fp.editions.includes(edition)) continue;
        const body = doctorChecks.conventionsSectionBody(packaged, fp.heading);
        assert.ok(body !== null, `${edition} _conventions.md must have a § ${fp.heading} section for fingerprint ${fp.id}`);
        assert.ok(body.includes(fp.marker), `${edition} _conventions.md § ${fp.heading} must carry the ${fp.id} marker`);
      }
      assert.deepEqual(
        doctorChecks.findConventionsDrift(packaged, edition),
        [],
        `the packaged ${edition} _conventions.md must be drift-free — a fingerprint that fires on the template is mis-specified`
      );
    }

    // A real project, freshly created: silent.
    const convFresh = await newProject('1');
    const freshConventions = await readFile(join(convFresh, CONVENTIONS_REL), 'utf8');
    assert.deepEqual(
      doctorChecks.findConventionsDrift(freshConventions, 'greenfield'),
      [],
      'a freshly projected _conventions.md must produce no drift findings'
    );
    const freshDoctor = await runDoctorAt(convFresh);
    assert.doesNotMatch(freshDoctor.stdout, /_conventions\.md § /, 'doctor must not report _conventions drift on a fresh project');

    // stale: the section is there, the rule is not.
    const staleBody = freshConventions.replace('cascade result is a floor', 'cascade result is a starting point');
    const staleDrift = doctorChecks.findConventionsDrift(staleBody, 'greenfield');
    assert.deepEqual(staleDrift.map((d) => `${d.id}:${d.state}`), ['ceremony-escalate-only:stale'], 'removing the escalate-only rule is detected as stale');

    // missing: the whole section is gone (every pre-f382671 project, for SPEC-ID
    // Format — no released version ever projected it).
    const missingBody = freshConventions.replace(/### SPEC-ID Format[\s\S]*?(?=### Slug Conventions)/, '');
    const missingDrift = doctorChecks.findConventionsDrift(missingBody, 'greenfield');
    assert.deepEqual(missingDrift.map((d) => `${d.id}:${d.state}`), ['spec-id-minimal-host:missing'], 'a deleted section is detected as missing, not silently passed');

    // The non-vacuity case: marker present in the FILE but not in its section.
    // A whole-file grep passes this; the section-local read must not.
    const movedBody = freshConventions
      .replace('Minimal (zero-phase) host exception', 'Minimal host note')
      .replace('## Glossary Consistency', '## Glossary Consistency\n\nMinimal (zero-phase) host exception\n');
    const movedDrift = doctorChecks.findConventionsDrift(movedBody, 'greenfield');
    assert.deepEqual(movedDrift.map((d) => `${d.id}:${d.state}`), ['spec-id-minimal-host:stale'], 'a marker in the wrong section is still stale — the check is section-local, not a file grep');

    // Levels: missing is info (content never offered), stale is warn (a live
    // contradiction inside the project's own conventions).
    await writeFile(join(convFresh, CONVENTIONS_REL), staleBody);
    const staleDoctor = await runDoctorAt(convFresh);
    assert.match(staleDoctor.stdout, /\[warn\] dflow\/specs\/shared\/_conventions\.md § Ceremony Scaling \(Project Application\) is missing the escalate-only rule/, 'a stale section warns, and its title names WHICH rule is missing — three fingerprints share this heading, so a heading-only title repeats itself');
    await writeFile(join(convFresh, CONVENTIONS_REL), missingBody);
    const missingDoctor = await runDoctorAt(convFresh);
    assert.match(missingDoctor.stdout, /\[info\] dflow\/specs\/shared\/_conventions\.md has no § SPEC-ID Format section/, 'a never-projected section is info, not warn');

    // Empty input produces no drift findings — but that is only acceptable
    // because the FILE-MISSING case is reported on its own, which is asserted
    // next. The earlier version of this assertion claimed the missing-file case
    // was "reported elsewhere" when nothing reported it at all: every
    // `_conventions` check early-returns on a missing path, so the worst state
    // of the file was the one state doctor was silent about. The parenthetical
    // gave that gap an alibi, which is why the claim is now a test.
    // Empty content has every section missing and now SAYS so. It used to
    // short-circuit to [], which made a whitespace-only file report nothing
    // while a one-character file reported all three — the emptier file getting
    // the cleaner verdict. The caller collapses this into one finding; the pure
    // function must not lie about it.
    assert.deepEqual(
      doctorChecks.findConventionsDrift('', 'greenfield').map((d) => `${d.id}:${d.state}`),
      ['ceremony-escalate-only:missing', 'spec-files-no-br-families:missing', 'spec-id-minimal-host:missing'],
      'empty content reports every section missing, exactly as a one-character file does'
    );
    // ⚠ COUNT THE FINDINGS THE USER ACTUALLY SEES, not just the ones the check
    // under test authored. The previous version of this block asserted only
    // `doesNotMatch(/has no § /)` — true, and useless: the drift block DOES
    // suppress its own three findings for a blank file, but the three OTHER
    // `_conventions` checks each carried on and emitted their own, so the file
    // produced five findings while this assertion certified "one clear finding".
    // A cross-vendor round found it (`p082-b3-g1` finding 1). The defect and the
    // blind spot are the same shape: a check verified in isolation, when the
    // property that matters is a property of the whole report.
    const conventionsFindings = (stdout) => stdout
      .split(/\r?\n/)
      .filter((l) => /^\[(warn|info)\] /.test(l) && l.includes('_conventions.md'));

    // A file that EXISTS but is whitespace-only: one clear finding, no drift spam.
    await writeFile(join(convFresh, CONVENTIONS_REL), '   \n\n');
    const emptyDoctor = await runDoctorAt(convFresh);
    assert.match(emptyDoctor.stdout, /\[warn\] dflow\/specs\/shared\/_conventions\.md is empty/, 'a present-but-empty _conventions.md is reported, not silently accepted');
    assert.doesNotMatch(emptyDoctor.stdout, /has no § /, 'an empty file gets one finding, not one per fingerprint');
    assert.deepEqual(
      conventionsFindings(emptyDoctor.stdout),
      ['[warn] dflow/specs/shared/_conventions.md is empty'],
      'a blank _conventions.md produces exactly ONE finding across ALL FOUR checks that read it — not one per check'
    );

    await rm(join(convFresh, CONVENTIONS_REL));
    const goneDoctor = await runDoctorAt(convFresh);
    assert.match(goneDoctor.stdout, /\[warn\] dflow\/specs\/shared\/_conventions\.md is missing/, 'a missing _conventions.md is reported, not passed over in silence');
    assert.doesNotMatch(goneDoctor.stdout, /All checks passed/, 'doctor must not report a clean bill of health for a project with no _conventions.md');
    assert.doesNotMatch(goneDoctor.stdout, /has no § /, 'the drift scan is skipped when the file itself is gone — three section findings about a missing file is noise');
    assert.deepEqual(
      conventionsFindings(goneDoctor.stdout),
      ['[warn] dflow/specs/shared/_conventions.md is missing'],
      'an absent _conventions.md produces exactly ONE finding across all four checks'
    );

    // (debt 23 gap F) The unclosed-block finding must name BOTH directions. It
    // used to say only that findings below it "may be caused by the unclosed
    // block rather than by real drift" — false positives — from which a reader
    // concludes the block can ADD findings but never remove them. Removal is the
    // dangerous half: the hidden text is text a check would have judged, so a
    // rule that genuinely drifted below the block is reported by nobody
    // (`p082-b3-k2` finding 4). Wording pins are weak in general, but this one
    // can fail — delete the suppression half of the sentence and it goes red.
    const unclosedProj = await newProject('2');
    const unclosedPath = join(unclosedProj, CONVENTIONS_REL);
    await writeFile(unclosedPath, `${await readFile(unclosedPath, 'utf8')}\n<!-- left open mid-edit\n`);
    const unclosedDoctor = await runDoctorAt(unclosedProj);
    // ⚠ THESE FOUR MESSAGES NAME THE SOURCE FILE AND THE FUNCTION, and that is a
    // requirement rather than a courtesy. This block is the FIRST thing a broken
    // `unclosedHtmlBlockLine` trips, so its message is the one a maintainer reads —
    // and for three consecutive rounds (`p084gate-x15`, `p084gate-y8r`,
    // `p084gate-x17`) it named only the symptom, sending the reader to the test
    // instead of to the function that changed. The other four detectors reach the
    // `DETECTOR_SOURCE` map further down; this one is checked earlier and bypassed
    // it, which is exactly the kind of hole a map cannot close on its own.
    const UNCLOSED_SOURCE = 'lib/doctor-checks.js `unclosedHtmlBlockLine`';
    assert.match(unclosedDoctor.stdout, /_conventions\.md has an unclosed HTML block at line \d+/, `${UNCLOSED_SOURCE} stopped reporting \`unclosed-html-block\` with the line it opens on, through the real CLI`);
    assert.match(unclosedDoctor.stdout, /cuts both ways/, `${UNCLOSED_SOURCE}: the detail must say the effect goes in both directions, not only false positives`);
    assert.match(unclosedDoctor.stdout, /can go unreported entirely/, `${UNCLOSED_SOURCE}: the detail must name the SUPPRESSION direction explicitly`);
    assert.match(unclosedDoctor.stdout, /as unknown — not as passing/, `${UNCLOSED_SOURCE}: the detail must tell the reader what to conclude about everything below the block`);

    // ===================================================================
    // PROPOSAL-084 — the `uncertain` result state.
    //
    // Five invariants, each with a pin that was VERIFIED to fail against a
    // broken build rather than assumed to. The module's own lesson applies with
    // full force here: "asserts existence" is not "asserts relationship", and a
    // pin that cannot fail against the defect it names is decoration.
    // ===================================================================
    {
      const uncertainLines = (stdout) => stdout.split(/\r?\n/).filter((l) => l.startsWith('[uncertain] '));
      const uncertainIds = (stdout) => [...stdout.matchAll(/^\[uncertain\] .*\(([a-z0-9-]+)\)$/gm)].map((m) => m[1]);

      // --- INVARIANT 4 first, because everything else is worthless if a fresh
      // project trips a detector: an adopter who sees `uncertain` on day one
      // learns to ignore it, and the feature has then made things worse.
      //
      // ⚠ BE HONEST ABOUT WHAT PROVED THIS ONE. The other four invariants below
      // were each mutation-verified — break the rule, this block goes red naming
      // it. This one was NOT: adding the inline-comment shape to the packaged
      // greenfield template does turn the suite red, but on the far earlier
      // `doctor must stay clean on a fresh init` assertion, which aborts the run
      // long before this block executes. So the INVARIANT is genuinely watched;
      // it is these three lines whose adequacy is unproven, and saying otherwise
      // would be the decorative-pin defect this file exists to catch.
      // What they add over the end-to-end assertion is a different LAYER, not a
      // better message: they read the template SOURCE, while the fresh-init
      // assertion reads a BUILT project, and `init` substitution sits between the
      // two. A shape that substitution introduces is caught only there; a shape
      // that substitution strips is caught only here.
      for (const edition of ['greenfield', 'brownfield']) {
        const packaged = await readFile(join(repoRoot, 'templates', edition, 'scaffolding', '_conventions.md'), 'utf8');
        for (const [id, fn] of [
          ['inline-html-comment', doctorChecks.inlineHtmlCommentLine],
          ['comment-inside-container', doctorChecks.containerHtmlCommentLine],
          ['html-block-type-7', doctorChecks.htmlBlockType7Line],
          ['unclosed-html-block', doctorChecks.unclosedHtmlBlockLine]
        ]) {
          assert.equal(
            fn(packaged), -1,
            `the packaged ${edition} _conventions.md trips the ${id} detector, so every fresh init would report uncertain — invariant 4`
          );
          // ⚠ The GUIDE is scanned too since `p084-y1` finding 8, so its packaged
          // copy carries the same obligation. Adding the surface without adding
          // this line would have left the widened scope pinned by nothing.
          const guide = await readFile(join(repoRoot, 'templates', edition, 'scaffolding', 'AI-AGENT-GUIDE.md'), 'utf8').catch(() => null);
          if (guide !== null) {
            assert.equal(
              fn(guide), -1,
              `the packaged ${edition} AI-AGENT-GUIDE.md trips the ${id} detector — invariant 4 for the surface added after y1`
            );
          }
        }
      }

      // ⚠⚠ INVARIANT 4 REACHES THE TUTORIAL OUTPUTS TOO, and until 2026-08-10 it did
      // not — which is how the greenfield tutorial shipped a file that trips
      // `comment-inside-container` (`p084-y2` finding 6, still live when
      // `p084-sol3` finding 1 re-found it and called it the one thing that should
      // block public projection). The loop above reads only
      // `templates/*/scaffolding/`, so nothing watched the door an adopter actually
      // walks through: **working the tutorial is a guaranteed path**, and the
      // invariant's whole point is that nobody meets `uncertain` on day one and
      // learns to ignore it. A true positive in reference material is still a
      // teaching failure.
      // ⚠ DISCOVERED, not listed. A hardcoded pair would let `tutorial/03-*` escape
      // silently, which is the defect class this file keeps finding. The count pin
      // below is the other half: a glob that stops matching would otherwise make
      // this block vacuously pass, and a check nobody has watched fail is not a
      // check.
      {
        const tutorialScanned = [];
        const tutorialRoot = join(repoRoot, 'tutorial');
        const walk = async (dir) => {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
            const p = join(dir, entry.name);
            if (entry.isDirectory()) await walk(p);
            else if (entry.name === '_conventions.md' || entry.name === 'AI-AGENT-GUIDE.md') {
              if (p.split(/[\\/]/).includes('outputs')) tutorialScanned.push(p);
            }
          }
        };
        await walk(tutorialRoot);
        assert.ok(
          tutorialScanned.length >= 4,
          `expected at least the two tutorials' _conventions.md + AI-AGENT-GUIDE.md under tutorial/**/outputs/, found ${tutorialScanned.length} — the discovery walk is broken, not the tutorials`
        );
        for (const file of tutorialScanned) {
          const text = await readFile(file, 'utf8');
          for (const [id, fn] of [
            ['inline-html-comment', doctorChecks.inlineHtmlCommentLine],
            ['comment-inside-container', doctorChecks.containerHtmlCommentLine],
            ['html-block-type-7', doctorChecks.htmlBlockType7Line],
            ['unclosed-html-block', doctorChecks.unclosedHtmlBlockLine]
          ]) {
            assert.equal(
              fn(text), -1,
              `${relative(repoRoot, file)} trips the ${id} detector, so a reader working the tutorial meets [uncertain] on the file the tutorial taught them to write — invariant 4, tutorial half`
            );
          }
        }
      }

      // --- one project per shape, through the real CLI. Unit probes prove the
      // detector; these prove the WIRING, which is where p082-b3-k4 said the risk
      // actually sits ("a row of detectors hanging off a mechanism that does
      // nothing").
      const shapes = [
        ['inline-html-comment', '\n## Notes\nprose <!-- ceremony scaling is escalate-only -->\n'],
        ['comment-inside-container', '\n## Notes\n- item\n  <!-- TODO revisit\n  a rule\n'],
        ['html-block-type-7', '\n## Notes\n\n<custom-element>\n---\n']
      ];
      // ⚠ WHICH SOURCE A FAILURE POINTS AT. This loop is the FIRST thing a broken
      // detector trips, so its message is the one a maintainer reads — and for one
      // round it named only the id and this line number, sending the reader to the
      // test rather than to the function that changed (`p084gate-x13` item 4,
      // `p084gate-y5` item 4, reported independently). An id is what an adopter
      // greps; a file and a function name is what a maintainer needs.
      const DETECTOR_SOURCE = {
        'inline-html-comment': 'lib/doctor-checks.js `inlineHtmlCommentLine`',
        'comment-inside-container': 'lib/doctor-checks.js `containerHtmlCommentLine`',
        'html-block-type-7': 'lib/doctor-checks.js `htmlBlockType7Line`',
        'unclosed-html-block': 'lib/doctor-checks.js `unclosedHtmlBlockLine`'
      };
      // A detector added without a row here would report through an `undefined`
      // source, which is worse than the id-only message this replaced.
      assert.deepEqual(
        Object.keys(DETECTOR_SOURCE).sort(), [...init.DOCTOR_UNCERTAINTY_IDS].sort(),
        'every shipped uncertainty id needs a source pointer here, or a failing mutation names no source at all'
      );

      const uncertainDoctorOut = new Map();
      for (const [id, suffix] of shapes) {
        const proj = await newProject('2');
        const cPath = join(proj, CONVENTIONS_REL);
        await writeFile(cPath, `${await readFile(cPath, 'utf8')}${suffix}`);
        const run = await runDoctorAt(proj);
        uncertainDoctorOut.set(id, run.stdout);

        // INVARIANT 3 — a stable, searchable id is printed with the finding.
        assert.ok(
          uncertainIds(run.stdout).includes(id),
          `${DETECTOR_SOURCE[id]} stopped reporting \`${id}\` through the real CLI on a project carrying its shape. The detector must report under its own stable id, since that id is what the explainer page is keyed by\n${run.stdout}`
        );
        // INVARIANT 1 — the clean verdict is unavailable, not merely caveated.
        assert.doesNotMatch(
          run.stdout, /All checks passed/,
          `${DETECTOR_SOURCE[id]} (\`${id}\`): a project carrying a shape Dflow is known to misread received the SAME verdict as a clean one. This is the false-clean direction, measured through the real CLI`
        );
        // INVARIANT 2 — the checks whose results stopped being trustworthy are
        // named, because doctor reports by exception and their silence would
        // otherwise read as "current".
        // ⚠⚠ THE WORDING IS PART OF THE INVARIANT AND IT WAS FALSE FOR ONE ROUND.
        // This pin said `Not evaluated …` — and those checks DO run, so a user
        // could see a `[warn]` from a check the same report called unevaluated
        // (`p084-xv6` finding 1). The invariant is not "say they did not run"; it
        // is "name them, and say their result cannot be trusted in EITHER
        // direction". A pin that fixes the false half of a sentence in place is
        // how the false half survives, so the assertion moved with the string.
        assert.match(
          run.stdout, /Ran, but cannot be trusted while this shape is present — their silence is NOT a pass, and anything they DO report may be an artefact of the shape: /,
          `${id}: an uncertain finding must name the checks whose results stopped being trustworthy, and must not claim they did not run`
        );
        assert.doesNotMatch(
          run.stdout, /[Nn]ot evaluated|did not run/,
          `${id}: the report must not claim the affected checks were skipped — they run, and saying otherwise is a false statement printed at the exact boundary this feature exists to be honest about`
        );
        assert.match(run.stdout, /This report is INCOMPLETE/, `${id}: the report must say it is incomplete`);
        assert.match(
          run.stdout, /docs\/doctor-uncertainty\.en\.md/,
          `${id}: the finding must point at the page that explains the shape — the container list lives there, not in this string`
        );
        // INVARIANT 5 — exit code unchanged (maintainer decision 2026-08-09).
        // Without a pin, "we did not change the exit code" is an unwatched
        // verbal promise.
        assert.equal(run.code, 0, `${id}: doctor still exits 0; uncertain must not become the only finding class that fails a build`);
        // Exactly one — `unclosed-html-in-container` is written as a differential
        // against the document-level scan precisely so the two cannot both fire
        // for one cause.
        assert.equal(
          uncertainLines(run.stdout).length, 1,
          `${id}: one shape must produce one finding, not one per detector that happens to notice it\n${uncertainLines(run.stdout).join('\n')}`
        );
      }

      // --- the document-level unclosed block keeps its own id and does NOT also
      // fire the container detector.
      assert.deepEqual(
        uncertainIds(unclosedDoctor.stdout), ['unclosed-html-block'],
        'a document-level unclosed block reports once, under the id that names it'
      );
      assert.equal(unclosedDoctor.code, 0, 'the unclosed-block finding is uncertain, and uncertain still exits 0');

      // The same whole-document condition applies to the other scanned product
      // file. At EOF there may be no secondary drift warning to reveal the parser
      // failure, so both editions must still lose the clean verdict explicitly.
      for (const [edition, projectType] of [['greenfield', '1'], ['brownfield', '2']]) {
        const project = await newProject('2', projectType);
        const guidePath = join(project, GUIDE_REL);
        await writeFile(guidePath, `${await readFile(guidePath, 'utf8')}\n<!-- guide block left open\n`);
        const run = await runDoctorAt(project);
        assert.deepEqual(
          uncertainIds(run.stdout),
          ['unclosed-html-block'],
          `${edition} guide EOF: an unclosed block is uncertain even when no narrower guide check happens to complain\n${run.stdout}`
        );
        assert.match(run.stdout, /AI-AGENT-GUIDE\.md has an unclosed HTML block/, `${edition} guide EOF: the finding names the affected file`);
        assert.doesNotMatch(run.stdout, /All checks passed/, `${edition} guide EOF: parser uncertainty removes the clean verdict`);
        assert.equal(run.code, 0, `${edition} guide EOF: uncertain preserves the doctor exit-code contract`);
      }

      // --- false-positive controls, at the unit level where they are cheap.
      // ⚠ The code-span control is the load-bearing one: `` `<!-- x -->` `` IS
      // rendered, so a reader DOES see it, and flagging it would be a plain false
      // positive rather than a conservative warning.
      assert.equal(doctorChecks.inlineHtmlCommentLine('# H\n`<!-- x -->` example\n'), -1, 'a comment inside a code span is visible to a reader and must not be flagged');
      // Backslash escapes follow CommonMark parity. One or three backslashes
      // escape `<`, so the apparent opener is visible text; zero or two leave a
      // live opener (two render as one literal backslash followed by a comment).
      // Keep all four directions together: pinning only the newly quiet cases
      // would allow an over-broad suppression to turn real comments silent.
      assert.notEqual(doctorChecks.inlineHtmlCommentLine('# H\nprose <!-- x -->\n'), -1, 'zero backslashes: a live inline comment must still be reported');
      assert.equal(doctorChecks.inlineHtmlCommentLine('# H\nprose \\<!-- x -->\n'), -1, 'one backslash escapes `<`, so the reader sees the comment text');
      assert.notEqual(doctorChecks.inlineHtmlCommentLine('# H\nprose \\\\<!-- x -->\n'), -1, 'two backslashes leave `<` live, so the inline comment must still be reported');
      assert.equal(doctorChecks.inlineHtmlCommentLine('# H\nprose \\\\\\<!-- x -->\n'), -1, 'three backslashes escape `<`, so the reader sees the comment text');
      assert.equal(doctorChecks.inlineHtmlCommentLine('# H\n```md\nprose <!-- x -->\n```\n'), -1, 'a fenced example must not be flagged');
      assert.equal(doctorChecks.inlineHtmlCommentLine('# H\n<!-- an ordinary block comment -->\n'), -1, 'a comment that begins a line is a block and is read correctly');
      assert.notEqual(doctorChecks.inlineHtmlCommentLine('# H\n<!-- a --> <!-- b -->\n'), -1, 'a SECOND comment on a line that opens with one is still inline — the tail is never re-scanned');
      assert.equal(doctorChecks.containerHtmlCommentLine('# H\n```md\n- item\n  <!-- open\n```\n'), -1, 'a container comment inside a fence is an example, not a defect');
      assert.equal(doctorChecks.containerHtmlCommentLine('# H\n<!-- an ordinary block comment -->\n'), -1, 'a column-0 comment opens a real HTML block and is not the container shape');
      assert.equal(doctorChecks.containerHtmlCommentLine('# H\nprose <!-- x -->\n'), -1, 'a mid-line comment belongs to the inline id, not the container one — the two must not double-report');
      assert.equal(doctorChecks.htmlBlockType7Line('# H\n<details>\n---\n'), -1, 'a type-6 tag IS implemented and must not be reported as type 7');
      assert.equal(doctorChecks.htmlBlockType7Line('# H\n<custom-element>\ntext\n'), -1, 'type 7 only diverges where it meets a setext underline');
      // ⚠⚠ THE MALFORMED-TABLE DETECTOR AND ITS ~800 LINES OF TESTS USED TO SIT
      // HERE, AND THEIR ABSENCE IS THE DECISION, NOT A GAP IN THIS FILE.
      // Six review rounds each found a document the detector stayed silent on, and
      // silence is the direction that prints `All checks passed` over a drifted
      // file. Narrowing it to measured shapes failed five times; widening it back
      // to every cell-count mismatch failed on the sixth, because the remaining
      // enumeration had moved into the delimiter-row recogniser. And one of those
      // rounds measured the same silent false clean with a delimiter row whose
      // cell count was CORRECT — so the detector's scope was a strict subset of
      // the harm and no version of it could close it. The shape now ships as a
      // stated gap, named on both explainer pages and recorded with owner and gate
      // as `doctor-section-boundary-arbiter` in `planning/opt-in-backlog.md`.
      // ⚠ If you are here to add it back, the durable fix is a different
      // instrument, not a better shape list: `marked` is already a runtime
      // dependency, so the section boundary can be taken FROM the renderer. A
      // sixth hand-written recogniser is the thing this file's history says not to
      // write. `lib/doctor-checks.js` GAP C carries the full account.
      // ⚠ The id-to-page contract below is what keeps the removal honest in the
      // other direction: drop the id without dropping its page section and the CLI
      // links a heading that no longer exists.

      // --- THE CONTRACT BETWEEN A SHIPPED ID AND ITS EXPLAINER SECTION.
      // ⚠⚠ This is the guard that makes the whole design durable, so it is worth
      // saying why it exists rather than only what it does. The action text this
      // proposal replaced was rewritten SEVEN times across two review families,
      // and every round found the next Markdown container it got wrong — because
      // an open-ended list of containers cannot be finished inside a fixed
      // string. Moving that list onto a page that can be revised without touching
      // shipped text is the fix. It only works while the id and the section
      // agree, and nothing else in this repo would notice them drifting apart:
      // the CLI would keep printing a link to a heading that no longer exists.
      // Asserted in BOTH directions and against BOTH languages, because a section
      // left behind after a detector is renamed is as misleading as a missing one
      // — it documents a shape the tool no longer reports under that name.
      for (const page of ['docs/doctor-uncertainty.en.md', 'docs/doctor-uncertainty.md']) {
        const text = await readFile(join(repoRoot, page), 'utf8');
        const documented = [...text.matchAll(/^### `([a-z0-9-]+)`$/gm)].map((m) => m[1]).sort();
        assert.deepEqual(
          documented, [...init.DOCTOR_UNCERTAINTY_IDS].sort(),
          `${page} documents a different set of detector ids than doctor can print. Every id needs a section (the CLI links this page for it), and every section needs an id (otherwise it explains a shape nothing reports).`
        );
      }
      // The runtime pointer must be the English page, per the maintainer decision
      // of 2026-08-09 — the zh page is one language-switch away, exactly as the
      // upgrade finding already does it.
      assert.match(
        (await readFile(join(repoRoot, 'lib/init.js'), 'utf8')),
        /blob\/main\/docs\/doctor-uncertainty\.en\.md/,
        'the CLI must link the English explainer page'
      );
      // ⚠ Both pages carry the language switcher, so neither is a dead end. The
      // zh page is reachable ONLY through it.
      assert.match(await readFile(join(repoRoot, 'docs/doctor-uncertainty.md'), 'utf8'), /\[English\]\(doctor-uncertainty\.en\.md\)/, 'the zh page must link its English twin');
      assert.match(await readFile(join(repoRoot, 'docs/doctor-uncertainty.en.md'), 'utf8'), /\[繁體中文\]\(doctor-uncertainty\.md\)/, 'the English page must link its zh twin');

      // --- REGRESSION PINS FROM `p084-y1`, one per finding.
      // ⚠⚠ The first two are the ones that matter, and they are pinned on the
      // property rather than on a detector's return value: **no shape may be a
      // silent pass AND undisclosed**. The first draft's repair advice moved a user
      // from the first state to the second, which is strictly worse than the defect
      // it was curing, and no assertion could have caught it — every detector was
      // behaving exactly as written.
      const noneFire = (md) => doctorChecks.inlineHtmlCommentLine(md) === -1
        && doctorChecks.containerHtmlCommentLine(md) === -1
        && doctorChecks.unclosedHtmlBlockLine(md) === -1
        && doctorChecks.htmlBlockType7Line(md) === -1;

      // y1 finding 1 — the documented repair for `inline-html-comment` used to land
      // here, firing nothing while the text stayed hidden from readers.
      assert.ok(
        !noneFire('# H\n- Ceremony scaling\n  <!-- a rule -->\n'),
        'a comment indented under a list item must be disclosed: it is exactly where the inline-comment repair advice sends a user, and its text is still read'
      );
      assert.equal(
        doctorChecks.containerHtmlCommentLine('# H\n- Ceremony scaling\n  <!-- a rule -->\n'), 3,
        'and it must be disclosed under the CONTAINER id, whose repair (leave the container) is the one that works'
      );
      // The repair the page actually prescribes must be genuinely clean.
      assert.ok(
        noneFire('# H\n- Ceremony scaling\n<!-- a rule -->\n'),
        'a comment at column 0 outside the list is the prescribed repair and must silence every detector — if this fails the page is teaching a non-fix'
      );

      // y1 finding 2 — the retired `unclosed-html-in-container` fired only on an
      // UNTERMINATED comment, so any later `-->` in the file silenced it, including
      // the one `unclosed-html-block`'s own action tells the user to add.
      assert.notEqual(
        doctorChecks.containerHtmlCommentLine('# H\n- item\n  <!-- TODO\n  a rule\n\n<!-- Seeded by Dflow. -->\n'), -1,
        'an unrelated closed comment elsewhere in the file must not silence the container finding — termination is not what makes this shape dangerous'
      );
      assert.notEqual(
        doctorChecks.containerHtmlCommentLine('# H\n- item\n  <!-- a rule -->\n'), -1,
        'a CLOSED comment inside a container is just as hidden from a reader, and must be reported'
      );

      // ===== `p084-xv1` (cross-vendor) — the partition had a hole =====
      // ⚠⚠ THE ONE THAT MATTERS. A comment at column 0 inside a `<details>` block
      // fell into NEITHER id: the container detector skipped it because the line is
      // typed `html`, the inline detector skipped it because the comment starts the
      // line's content — and `parseContextLine` then returned a policy value the
      // reader cannot see, under a full `All checks passed`. Two independent
      // predicates cannot be audited for gaps; `commentDisposition` is now one
      // function returning one of three answers, and these pin all three.
      {
        const inDetails = '## Git Policy\n\n<details>\n<!-- Selected Git policy: `trunk` -->\n</details>\n\nSelected Git policy: not-machine-readable\n';
        assert.notEqual(
          doctorChecks.containerHtmlCommentLine(inDetails), -1,
          'a comment inside an HTML block is inside a container: its text is still read while the reader sees nothing, and it must not fall between the two comment ids'
        );
        assert.equal(
          doctorChecks.parseContextLine(inDetails, doctorChecks.GIT_POLICY_LINE_RE), 'trunk',
          'the premise of that pin: doctor really does read the hidden value, which is why the shape has to be disclosed'
        );
        const escapedInDetails = '## Git Policy\n\n<details>\n\\<!-- Selected Git policy: `trunk` -->\n</details>\n\nSelected Git policy: not-machine-readable\n';
        assert.notEqual(
          doctorChecks.inlineHtmlCommentLine(escapedInDetails), -1,
          'backslash escaping is inline Markdown syntax, not raw-HTML-block syntax: the comment is still hidden inside <details> and must be disclosed'
        );
        assert.equal(
          doctorChecks.parseContextLine(escapedInDetails, doctorChecks.GIT_POLICY_LINE_RE), 'trunk',
          'the escaped-opener guard is load-bearing: doctor still reads the hidden policy value from the raw HTML'
        );
        const backtickedInDetails = '# H\n\n<details>\n`<!-- Selected Git policy: trunk -->`\n</details>\n';
        assert.notEqual(
          doctorChecks.inlineHtmlCommentLine(backtickedInDetails), -1,
          'backticks do not open a code span inside a raw HTML block, so they must not mask a real hidden comment'
        );
        const reportsCommentGap = (md) => doctorChecks.containerHtmlCommentLine(md) !== -1
          || doctorChecks.inlineHtmlCommentLine(md) !== -1;
        const { marked } = await import('marked');
        for (const [container, open, prefix, close] of [
          ['list', '- <details>', '  ', '  </details>'],
          ['blockquote', '> <details>', '> ', '> </details>']
        ]) {
          assert.equal(
            reportsCommentGap(`# H\n\n${open}\n${prefix}\\<!-- Selected Git policy: \`trunk\` -->\n${close}\n`), true,
            `${container}: inline backslash escaping does not apply inside nested raw HTML, so the hidden policy must still be disclosed`
          );
          assert.equal(
            reportsCommentGap(`# H\n\n${open}\n${prefix}\`<!-- Selected Git policy: trunk -->\`\n${close}\n`), true,
            `${container}: backticks do not open a code span inside nested raw HTML, so they must not mask the hidden comment`
          );
          assert.equal(
            reportsCommentGap(`# H\n\n${open}\n${prefix}\\\\<!-- Selected Git policy: \`trunk\` -->\n${close}\n`), true,
            `${container}: an even backslash run also leaves the nested raw HTML comment live`
          );
        }
        assert.equal(
          reportsCommentGap('# H\n\n- prose \\<!-- visible example -->\n'), false,
          'an odd-backslash apparent opener in ordinary list prose stays visible and must not become a false rejection'
        );
        assert.equal(
          reportsCommentGap('# H\n\n> prose `<!-- visible example -->`\n'), false,
          'a genuine code span in ordinary blockquote prose stays visible and must not become a false rejection'
        );
        assert.equal(
          reportsCommentGap('# H\n\n> prose\n> 2. <details>\n> \\<!-- visible example -->\n'), false,
          'an ordered marker above 1 cannot interrupt an open blockquote paragraph, so its apparent escaped comment stays visible'
        );
        assert.equal(
          reportsCommentGap('# H\n\n> 2. <details>\n> \\<!-- Selected Git policy: `trunk` -->\n> </details>\n'), true,
          'the same ordered marker at a genuine block start opens a list, so nested raw HTML must still be disclosed'
        );
        for (const [name, md] of [
          ['loose-list type-1 odd backslash', '# H\n\n- <pre>\n  body\n\n  \\<!-- Selected Git policy: `trunk` -->\n  </pre>\n'],
          ['loose-list type-1 backticks', '# H\n\n- <pre>\n  body\n\n  `<!-- Selected Git policy: trunk -->`\n  </pre>\n'],
          ['tab-gap list', '# H\n\n-\t<details>\n\t\\<!-- Selected Git policy: `trunk` -->\n\t</details>\n'],
          ['space-tab-gap list', '# H\n\n- \t<details>\n    `<!-- Selected Git policy: trunk -->`\n    </details>\n'],
          ['nested quote/tab-gap list', '# H\n\n> -\t<details>\n> \t\\<!-- Selected Git policy: `trunk` -->\n> \t</details>\n'],
          ['nested quote/space-tab-gap list', '# H\n\n> - \t<details>\n> \t`<!-- Selected Git policy: trunk -->`\n> \t</details>\n'],
          // The masking syntax is deliberately away from the tab slice boundary.
          // Replacing stringIndexAtVisualColumn with the raw visual column then
          // cuts into `prose` and loses this hidden comment instead of producing
          // a second error that happens to re-report it.
          ['visual-offset continuation body', '# H\n\n- item\n\t<pre>\n\tprose `<!-- Selected Git policy: trunk -->`\n\t</pre>\n']
        ]) {
          assert.equal(
            reportsCommentGap(md), true,
            `${name}: nested raw-HTML state must survive the real list column and end-condition transitions`
          );
        }
        for (const [name, md] of [
          ['odd backslash', '# H\n\n> <pre>\n> body\noutside\n> \\<!-- visible example -->\n'],
          ['code span', '# H\n\n> <pre>\n> body\noutside\n> `<!-- visible example -->`\n']
        ]) {
          assert.equal(
            reportsCommentGap(md), false,
            `blockquote markerless continuation / ${name}: leaving the quote ends nested raw-HTML state, so later visible prose must stay quiet`
          );
        }
        for (const [name, md, readerHidden] of [
          ['same depth', '# H\n\n> > <pre>\n> > \\<!-- QUOTE-DEPTH-CANARY -->\n> > </pre>\n', true],
          ['deeper', '# H\n\n> <pre>\n> > \\<!-- QUOTE-DEPTH-CANARY -->\n> </pre>\n', true],
          ['shallower', '# H\n\n> > <pre>\n> \\<!-- QUOTE-DEPTH-CANARY -->\n> > </pre>\n', false]
        ]) {
          assert.equal(
            reportsCommentGap(md), readerHidden,
            `${name}: doctor disclosure must follow the nested raw-HTML boundary across quote-depth transitions`
          );
          assert.equal(
            marked.parse(md).includes('<!-- QUOTE-DEPTH-CANARY -->'), readerHidden,
            `${name}: the shipped Marked renderer is the visibility arbiter for the quote-depth transition`
          );
        }
        for (const [name, md] of [
          ['outer list', '# H\n\n- <details>\n\\<!-- Selected Git policy: `trunk` -->\n</details>\n'],
          ['list inside quote', '# H\n\n> - <details>\n\\<!-- Selected Git policy: `trunk` -->\n</details>\n'],
          ['tab list', '# H\n\n-\t<pre>\nprose `<!-- Selected Git policy: trunk -->`\n</pre>\n'],
          ['ordered list', '# H\n\n1. <div>\n\\<!-- Selected Git policy: `trunk` -->\n</div>\n']
        ]) {
          assert.equal(reportsCommentGap(md), true, `${name}: a lazy list continuation stays in nested raw HTML and must be disclosed`);
          assert.ok(
            marked.parse(md).includes('<!-- Selected Git policy:'),
            `${name}: Marked keeps the lazy continuation comment raw, so the browser hides the policy value`
          );
        }

        const nestedRawProject = await newProject('2');
        const nestedRawPath = join(nestedRawProject, CONVENTIONS_REL);
        const nestedRawSource = await readFile(nestedRawPath, 'utf8');
        const nestedRawMutated = nestedRawSource.replace(
          /^Selected Git policy: `trunk`$/m,
          '- <pre>\n  body\n\n  \\<!-- Selected Git policy: `trunk` -->\n  </pre>'
        );
        assert.notEqual(nestedRawMutated, nestedRawSource, 'nested raw-HTML CLI guard must replace the live policy line');
        await writeFile(nestedRawPath, nestedRawMutated);
        const nestedRawDoctor = await runDoctorAt(nestedRawProject);
        assert.ok(
          uncertainIds(nestedRawDoctor.stdout).some((id) => id === 'inline-html-comment' || id === 'comment-inside-container'),
          `the real CLI must disclose a policy value hidden by an escaped comment inside nested raw HTML\n${nestedRawDoctor.stdout}`
        );
        assert.doesNotMatch(
          nestedRawDoctor.stdout, /All checks passed/,
          'nested raw HTML must not restore the exact false-clean verdict this uncertainty feature removes'
        );

        const tabbedConventionsProject = await newProject('2');
        const tabbedConventionsPath = join(tabbedConventionsProject, CONVENTIONS_REL);
        const tabbedConventionsSource = await readFile(tabbedConventionsPath, 'utf8');
        const tabbedConventionsMutated = tabbedConventionsSource.replace(
          /^Selected Git policy: `trunk`$/m,
          '-\t<details>\n\t\\<!-- Selected Git policy: `trunk` -->\n\t</details>'
        );
        assert.notEqual(tabbedConventionsMutated, tabbedConventionsSource, 'tabbed conventions guard must replace the live policy row');
        await writeFile(tabbedConventionsPath, tabbedConventionsMutated);
        const tabbedConventionsDoctor = await runDoctorAt(tabbedConventionsProject);
        assert.ok(
          uncertainIds(tabbedConventionsDoctor.stdout).some((id) => id === 'inline-html-comment' || id === 'comment-inside-container'),
          `the real CLI must disclose a hidden policy after a tabbed list marker\n${tabbedConventionsDoctor.stdout}`
        );
        assert.doesNotMatch(tabbedConventionsDoctor.stdout, /All checks passed/, 'tabbed list columns must not produce a conventions false-clean');

        const tabbedGuideProject = await newProject('2');
        const tabbedGuidePath = join(tabbedGuideProject, GUIDE_REL);
        const tabbedGuideSource = await readFile(tabbedGuidePath, 'utf8');
        const tabbedGuideMutated = tabbedGuideSource.replace(
          /^\| Tech stack \|.*$/m,
          '- \t<pre>\n    \\<!-- | Tech stack | hidden-stack | -->\n    </pre>'
        );
        assert.notEqual(tabbedGuideMutated, tabbedGuideSource, 'tabbed guide guard must replace the live Tech stack row');
        await writeFile(tabbedGuidePath, tabbedGuideMutated);
        const tabbedGuideDoctor = await runDoctorAt(tabbedGuideProject);
        assert.ok(
          uncertainIds(tabbedGuideDoctor.stdout).some((id) => id === 'inline-html-comment' || id === 'comment-inside-container'),
          `the real CLI must disclose a hidden guide row after a space-tab list marker\n${tabbedGuideDoctor.stdout}`
        );
        assert.doesNotMatch(tabbedGuideDoctor.stdout, /All checks passed/, 'visual list columns must not produce a guide false-clean');

        // The inner-prefix path has its own visual columns and paragraph state.
        // Exercise both product files and editions through the real CLI: unit
        // probes alone cannot prove that doctor wires the classification into the
        // final clean/uncertain verdict.
        for (const [edition, projectType] of [['greenfield', '1'], ['brownfield', '2']]) {
          for (const [surface, rel, anchor, hidden] of [
            [
              'conventions', CONVENTIONS_REL, /^Selected Git policy: `trunk`$/m,
              '> -\t<details>\n> \t\\<!-- Selected Git policy: `trunk` -->\n> \t</details>'
            ],
            [
              'guide', GUIDE_REL, /^\| Tech stack \|.*$/m,
              '> - \t<pre>\n> \t\\<!-- | Tech stack | hidden-stack | -->\n> \t</pre>'
            ]
          ]) {
            const hiddenProject = await newProject('2', projectType);
            const hiddenPath = join(hiddenProject, rel);
            const hiddenSource = await readFile(hiddenPath, 'utf8');
            const hiddenMutated = hiddenSource.replace(anchor, hidden);
            assert.notEqual(hiddenMutated, hiddenSource, `${edition}/${surface} nested-tab guard must replace its live row`);
            await writeFile(hiddenPath, hiddenMutated);
            const hiddenDoctor = await runDoctorAt(hiddenProject);
            assert.ok(
              uncertainIds(hiddenDoctor.stdout).some((id) => id === 'inline-html-comment' || id === 'comment-inside-container'),
              `${edition}/${surface}: nested quote/list tab columns must disclose the hidden value\n${hiddenDoctor.stdout}`
            );
            assert.doesNotMatch(hiddenDoctor.stdout, /All checks passed/, `${edition}/${surface}: nested tab columns must not produce a false-clean`);

            const visibleProject = await newProject('2', projectType);
            const visiblePath = join(visibleProject, rel);
            await writeFile(
              visiblePath,
              `${await readFile(visiblePath, 'utf8')}\n> prose\n> 2. <details>\n> \\<!-- visible example -->\n`
            );
            const visibleDoctor = await runDoctorAt(visibleProject);
            assert.equal(
              uncertainIds(visibleDoctor.stdout).length,
              0,
              `${edition}/${surface}: a non-interrupting ordered marker stays visible paragraph text\n${visibleDoctor.stdout}`
            );
            assert.match(visibleDoctor.stdout, /All checks passed/, `${edition}/${surface}: the visible paragraph control must retain the clean verdict`);

            const mismatchedProject = await newProject('2', projectType);
            const mismatchedPath = join(mismatchedProject, rel);
            const mismatchedSource = await readFile(mismatchedPath, 'utf8');
            const mismatchedBlock = surface === 'conventions'
              ? '<pre>\n</script>\n\\<!-- Selected Git policy: `trunk` -->\n</pre>'
              : '<pre>\n</script>\n\\<!-- | Tech stack | hidden-stack | -->\n</pre>';
            const mismatchedMutated = mismatchedSource.replace(anchor, mismatchedBlock);
            assert.notEqual(mismatchedMutated, mismatchedSource, `${edition}/${surface}: mismatched type-1 guard must replace its live row`);
            await writeFile(mismatchedPath, mismatchedMutated);
            const mismatchedDoctor = await runDoctorAt(mismatchedProject);
            assert.ok(
              uncertainIds(mismatchedDoctor.stdout).some((id) => id === 'inline-html-comment' || id === 'comment-inside-container'),
              `${edition}/${surface}: </script> cannot close <pre>; doctor must disclose the hidden value\n${mismatchedDoctor.stdout}`
            );
            assert.doesNotMatch(mismatchedDoctor.stdout, /All checks passed/, `${edition}/${surface}: a mismatched type-1 closer must not produce a false-clean`);

            for (const [transition, quoteShape, shouldReport] of [
              ['same', '> > <pre>\n> > \\<!-- QUOTE-DEPTH-CLI -->\n> > </pre>', true],
              ['deeper', '> <pre>\n> > \\<!-- QUOTE-DEPTH-CLI -->\n> </pre>', true],
              ['shallower', '> > <pre>\n> \\<!-- QUOTE-DEPTH-CLI -->\n> > </pre>', false]
            ]) {
              const quoteProject = await newProject('2', projectType);
              const quotePath = join(quoteProject, rel);
              await writeFile(quotePath, `${await readFile(quotePath, 'utf8')}\n${quoteShape}\n`);
              const quoteDoctor = await runDoctorAt(quoteProject);
              const quoteIds = uncertainIds(quoteDoctor.stdout);
              assert.equal(
                quoteIds.includes('inline-html-comment'), shouldReport,
                `${edition}/${surface}/${transition}: real CLI disclosure must match Marked quote-depth visibility\n${quoteDoctor.stdout}`
              );
              if (shouldReport) {
                assert.doesNotMatch(quoteDoctor.stdout, /All checks passed/, `${edition}/${surface}/${transition}: hidden comment suppresses clean`);
              } else {
                assert.deepEqual(quoteIds, [], `${edition}/${surface}/${transition}: visible shallower-quote text must not produce uncertainty`);
                assert.match(quoteDoctor.stdout, /All checks passed/, `${edition}/${surface}/${transition}: visible shallower-quote control retains clean`);
              }
            }

            const lazyProject = await newProject('2', projectType);
            const lazyPath = join(lazyProject, rel);
            await writeFile(
              lazyPath,
              `${await readFile(lazyPath, 'utf8')}\n- <details>\n\\<!-- LAZY-LIST-CLI -->\n</details>\n`
            );
            const lazyDoctor = await runDoctorAt(lazyProject);
            assert.ok(
              uncertainIds(lazyDoctor.stdout).includes('inline-html-comment'),
              `${edition}/${surface}: a markerless continuation of list-owned raw HTML must disclose the hidden comment\n${lazyDoctor.stdout}`
            );
            assert.doesNotMatch(lazyDoctor.stdout, /All checks passed/, `${edition}/${surface}: lazy list raw HTML must suppress clean`);
          }
        }

        const quoteExitProject = await newProject('2');
        const quoteExitPath = join(quoteExitProject, CONVENTIONS_REL);
        await writeFile(
          quoteExitPath,
          `${await readFile(quoteExitPath, 'utf8')}\n> <pre>\n> body\noutside\n> \\<!-- visible example -->\n`
        );
        const quoteExitDoctor = await runDoctorAt(quoteExitProject);
        assert.match(quoteExitDoctor.stdout, /All checks passed/, 'leaving a blockquote must not leak raw-HTML state into a later visible escaped example');
        assert.equal(uncertainIds(quoteExitDoctor.stdout).length, 0, 'the blockquote state-leak control must stay free of uncertainty findings');
      }
      // The three dispositions, pinned against each other so a future edit cannot
      // quietly move a shape from one id to the other — or to neither.
      assert.equal(doctorChecks.containerHtmlCommentLine('# H\n<!-- plain note -->\n'), -1, 'a comment that opens its OWN block at column 0 is genuinely hidden: not a finding');
      assert.equal(doctorChecks.inlineHtmlCommentLine('# H\n<!-- plain note -->\n'), -1, 'and it is not the inline shape either');
      assert.notEqual(doctorChecks.inlineHtmlCommentLine('# H\n<!-- a --> <!-- b -->\n'), -1, 'a second comment on a block-opening line is still an inline span');
      // Wrong-id risk: a prefix that only LOOKS like a container marker.
      assert.equal(
        doctorChecks.containerHtmlCommentLine('# H\nparagraph\n2. <!-- x -->\n'), -1,
        'an ordered-marker-looking prefix inside a PARAGRAPH is prose, not a container — printing "move it out of the list item" there is advice about a container the user is not in'
      );
      assert.notEqual(
        doctorChecks.inlineHtmlCommentLine('# H\nparagraph\n2. <!-- x -->\n'), -1,
        'and because it is prose, the comment is an inline span and must still be reported under that id'
      );
      // A `<script>` block is already invisible to every check, so there is no
      // divergence to disclose and a warning there would be pure noise.
      assert.equal(doctorChecks.containerHtmlCommentLine('# H\n<script>\n<!-- x -->\n</script>\n'), -1, 'content of an invisible block is already hidden from doctor: nothing to report');
      assert.equal(doctorChecks.inlineHtmlCommentLine('# H\n<script>\n<!-- x -->\n</script>\n'), -1, 'same, for the inline id');

      // ===== `p084-xv2` (cross-vendor, third round) =====
      // ⚠⚠ BLOCKER: the code-span mask created the silent pass it exists to prevent.
      // `\`<!-- rule -->\`` has ESCAPED backticks, so it is not a code span at all —
      // a reader sees two literal backticks and no rule, while doctor read the
      // hidden value and printed `All checks passed`. The mask counted the escaped
      // backticks as delimiters and skipped the comment as "visible".
      {
        const BT = String.fromCharCode(0x60);
        const BS = String.fromCharCode(0x5c);
        const escaped = `## Git Policy\n${BS}${BT}<!-- Selected Git policy: ${BT}trunk${BT} -->${BS}${BT}\n`;
        assert.notEqual(
          doctorChecks.inlineHtmlCommentLine(escaped), -1,
          'a comment wrapped in ESCAPED backticks is not in a code span: the reader sees literal backticks, doctor reads the value, and the shape must be disclosed'
        );
        assert.equal(
          doctorChecks.parseContextLine(escaped, doctorChecks.GIT_POLICY_LINE_RE), 'trunk',
          'the premise: doctor really does read the hidden policy there'
        );
        // The real code span must still be exempt — that is the false positive this
        // mask exists for, and closing the escape hole must not reopen it.
        assert.equal(
          doctorChecks.inlineHtmlCommentLine(`# H\n${BT}<!-- x -->${BT} example\n`), -1,
          'an UNescaped code span is genuinely rendered and must stay exempt'
        );
      }
      // Both boundary detectors describe a DOCUMENT-level section boundary moving.
      // Inside a list item nothing at document level moves, so firing there is noise
      // on legitimate content.
      assert.equal(
        doctorChecks.htmlBlockType7Line('## G\n- item\n  <custom-element>\n  ---\n'), -1,
        'a bare tag inside a list item is list content to both readings — no section boundary is at stake'
      );

      // ⚠⚠ xv3 BLOCKER — THE ESCAPE REPAIR MOVED THE SILENT PASS RATHER THAN
      // CLOSING IT. The first repair filtered escaped backticks out BEFORE pairing,
      // which is circular: CommonMark §6.1 says escapes do not work inside a code
      // span, so "is this backtick escaped" depends on whether a span is already
      // open. In `` `foo\` `` the real closing delimiter was discarded as escaped,
      // the opener paired with a later run, and the mask swallowed a comment no
      // reader can see. Both directions are pinned here because the two blockers
      // sat on opposite sides of the same line of code.
      {
        const BT = String.fromCharCode(0x60);
        const BS = String.fromCharCode(0x5c);
        const spanEndsInBackslash = `## Git Policy\n${BT}foo${BS}${BT} <!-- Selected Git policy: ${BT}trunk${BT} -->\n`;
        assert.notEqual(
          doctorChecks.inlineHtmlCommentLine(spanEndsInBackslash), -1,
          'a code span whose content ends in a backslash closes at the NEXT backtick — the comment after it is live text and must be disclosed'
        );
        assert.equal(
          doctorChecks.parseContextLine(spanEndsInBackslash, doctorChecks.GIT_POLICY_LINE_RE), 'trunk',
          'the premise: doctor really does read the hidden policy there'
        );
        // The unpaired-run path is the one a naive rewrite drops: a lone backtick
        // is literal text and must not swallow the rest of the line.
        assert.notEqual(
          doctorChecks.inlineHtmlCommentLine(`# H\nprose ${BT} and <!-- x -->\n`), -1,
          'an UNPAIRED backtick opens no span, so a later comment on the same line is still live'
        );
        assert.equal(
          doctorChecks.inlineHtmlCommentLine(`# H\n${BT}a${BT} t ${BT}<!-- x -->${BT}\n`), -1,
          'a SECOND real code span on the line must still be exempt — scanning must resume past the first, not give up'
        );
      }

      // xv3 finding 3 — the container test is spelled ONCE now (`inUnparsedContainer`).
      // These two detectors used to say `list | blockquote` while the comment ids said
      // `list | blockquote | html`, so the same `<details>` was container content to
      // one pair and a document-level divergence to the other.
      assert.equal(
        doctorChecks.htmlBlockType7Line('## G\n\n<details>\n<custom-element>\n---\n</details>\n'), -1,
        'a bare tag inside an HTML block is container content to both readings, exactly as it is inside a list item'
      );
      // ⚠ The other half, and it is the half that would fail silently: at document
      // level neither shape is typed `html` (this module does not implement type 7 —
      // that IS the gap — and a delimiter row is typed `table`), so widening the skip
      // to HTML blocks cannot mute the real case. Without these two the widening
      // could disable both detectors outright and the suite would stay green.
      assert.notEqual(
        doctorChecks.htmlBlockType7Line('# H\n\n<custom-element>\n---\n'), -1,
        'the document-level type-7 divergence must still fire after the container skip was widened'
      );

      // ⚠⚠ THE REPAIR MATRIX. Every container the `comment-inside-container` advice
      // names gets three cells, and the middle one is the whole point:
      //   detected     — the shape really is reported
      //   wrongRepair  — the repair the advice does NOT prescribe leaves it reported
      //   rightRepair  — the repair it DOES prescribe clears it
      // `p084-xv4` finding 3 killed the previous shape of this block: it asserted
      // only the third cell for `<textarea>`, so it stayed green whether or not the
      // detector still reached that container at all, and said nothing about the
      // wrong repair. A repaired-form assertion on its own cannot tell "the advice
      // works" from "the detector stopped looking".
      // ⚠ The composite rows are here because two rounds of advice were written as
      // if a comment sits in exactly one container. It can sit in two, and then only
      // leaving the OUTER one repairs anything.
      // ⚠ Known residual, unchanged: nothing reads the advice STRING, so a future
      // edit could restate a rule universally and this stays green. A source
      // substring pin was rejected as the brittle class this file already retracts
      // once; the durable form would derive the sentence from `blockEndsOnBlank`.
      for (const row of [
        {
          name: 'list item',
          detected: '# H\n\n- item\n  <!-- x -->\n',
          wrongRepair: '# H\n\n- item\n      <!-- x -->\n',
          wrongWhy: 're-indenting deeper stays inside the item',
          rightRepair: '# H\n\n- item\n\n<!-- x -->\n',
          rightWhy: 'column 0, outside the item'
        },
        {
          name: 'block quote',
          detected: '# H\n\n> q\n> <!-- x -->\n',
          wrongRepair: '# H\n\n> q\n>   <!-- x -->\n',
          wrongWhy: 're-indenting after the `>` stays inside the quote',
          rightRepair: '# H\n\n> q\n\n<!-- x -->\n',
          rightWhy: 'column 0 with no `>`'
        },
        {
          name: '<details> (type 6, ends at a blank line)',
          detected: '# H\n\n<details>\n<!-- x -->\n</details>\n',
          wrongRepair: '# H\n\n<details>\n</details>\n<!-- x -->\n',
          wrongWhy: 'the closing tag does NOT end a type-6 block, so below it is still inside',
          rightRepair: '# H\n\n<details>\n\n<!-- x -->\n',
          rightWhy: 'a blank line is what ends it'
        },
        {
          name: '<pre> (type 1, ends at its closing tag)',
          detected: '# H\n\n<pre>\n<!-- x -->\n</pre>\n',
          wrongRepair: '# H\n\n<pre>\n\n<!-- x -->\n</pre>\n',
          wrongWhy: 'a blank line does NOT end a type-1 block — this is the type-6 rule misapplied',
          rightRepair: '# H\n\n<pre>\n</pre>\n<!-- x -->\n',
          rightWhy: 'below its own closing tag'
        },
        {
          // ⚠ `<div>` is named in the shipped advice and had no row, while the
          // block above claimed every named container has one (`p084-xv5`
          // finding 3). A coverage claim nobody checks is the same shape as a
          // check nobody watches fail.
          name: '<div> (type 6, the other tag the advice names)',
          detected: '# H\n\n<div>\n<!-- x -->\n</div>\n',
          wrongRepair: '# H\n\n<div>\n</div>\n<!-- x -->\n',
          wrongWhy: 'the closing tag does NOT end a type-6 block',
          rightRepair: '# H\n\n<div>\n\n<!-- x -->\n',
          rightWhy: 'a blank line is what ends it'
        },
        {
          name: 'composite: <pre> inside a list item',
          detected: '# H\n\n- <pre>\n  <!-- x -->\n  </pre>\n',
          wrongRepair: '# H\n\n- <pre>\n  </pre>\n  <!-- x -->\n',
          wrongWhy: 'applying only the <pre> rule leaves the comment in the list item',
          rightRepair: '# H\n\n- <pre>\n  </pre>\n\n<!-- x -->\n',
          rightWhy: 'leaving the OUTERMOST container is what repairs it'
        },
        {
          name: 'composite: <details> inside a block quote',
          detected: '# H\n\n> <details>\n> <!-- x -->\n> </details>\n',
          wrongRepair: '# H\n\n> <details>\n>\n> <!-- x -->\n',
          wrongWhy: 'applying only the blank-line rule leaves the comment in the quote',
          rightRepair: '# H\n\n> <details>\n\n<!-- x -->\n',
          rightWhy: 'leaving the OUTERMOST container is what repairs it'
        }
      ]) {
        assert.notEqual(
          doctorChecks.containerHtmlCommentLine(row.detected), -1,
          `repair matrix / ${row.name}: the shape itself must be reported, or the other two cells prove nothing`
        );
        assert.notEqual(
          doctorChecks.containerHtmlCommentLine(row.wrongRepair), -1,
          `repair matrix / ${row.name}: ${row.wrongWhy} — it must STILL report, otherwise the advice is free to prescribe this`
        );
        assert.equal(
          doctorChecks.containerHtmlCommentLine(row.rightRepair), -1,
          `repair matrix / ${row.name}: the prescribed repair (${row.rightWhy}) must actually clear the finding`
        );
      }

      // ⚠⚠ `<textarea>` IS A FALSE POSITIVE THAT IS REPORTED ON PURPOSE. Its interior
      // is RAW TEXT: a reader sees `<!-- ... -->` verbatim, so nothing is hidden —
      // which is why naming it as a repair case once shipped the single edit that
      // would genuinely hide the text (`p084-xv4` finding 1). Suppressing it was then
      // tried three times and each attempt produced a SILENT PASS instead, so the
      // exemption was removed rather than patched a fourth time.
      // Two things are pinned, and they are pinned for different reasons: that the
      // shape IS reported (so nobody quietly reintroduces a suppressor), and that the
      // reader really does see the text (which is the premise for leaving the cited
      // line unchanged — if that ever became false, the advice would be wrong).
      {
        const ta = '## Git Policy\n\n<textarea>\n<!-- Selected Git policy: `trunk` -->\n</textarea>\n';
        assert.notEqual(
          doctorChecks.containerHtmlCommentLine(ta), -1,
          'a comment inside <textarea> IS reported — the exemption that used to suppress it was removed after producing three silent passes'
        );
        // ⚠⚠ THIS PIN USED TO CHECK THE WRONG THING (`p084-y2` finding 8). It asserted
        // `visibleTextLines(...)` contains the text — but that is DOCTOR's visibility
        // flag, not the reader's, and it could only go red in a state the assertion
        // above already catches first. The proposition the advice rests on is an HTML
        // fact: a `<textarea>`'s content is RCDATA, so the comment is displayed rather
        // than parsed as markup. Check THAT, against the renderer this package already
        // depends on.
        {
          const { marked } = await import('marked');
          const inside = /<textarea[^>]*>([\s\S]*?)<\/textarea>/i.exec(marked.parse(ta));
          assert.ok(
            inside && inside[1].includes('Selected Git policy'),
            'the premise for the ADVICE: the comment really does land INSIDE the <textarea> element, where HTML shows it verbatim. If this ever fails, the leave-this-line-unchanged advice is wrong and both pages need rewriting'
          );
        }
        assert.notEqual(
          doctorChecks.containerHtmlCommentLine('# H\n\n<pre>\n<!-- x -->\n</pre>\n'), -1,
          '<pre> shares type 1 with <textarea> but its interior is parsed as HTML, so a comment there IS hidden and must still be reported'
        );
        // ⚠⚠ THE NESTED CASE IS A RECORDED DECISION, NOT AN OVERSIGHT (`p084-xv5`
        // finding 1; maintainer, 2026-08-09). The exemption needs the enclosing tag
        // and this module does not parse container interiors, so a `<textarea>`
        // inside a list item is invisible to it and the shape is still reported.
        // The maintainer chose the noisy direction over a hand-rolled upward scan
        // whose failure mode would be silence.
        assert.notEqual(
          doctorChecks.containerHtmlCommentLine('# H\n\n- <textarea>\n  <!-- x -->\n  </textarea>\n'), -1,
          'a NESTED <textarea> is still reported — if this ever becomes -1 the exemption grew a container-aware path, and the advice below must be revisited with it'
        );
        // ⚠⚠⚠ THE `<textarea>` EXEMPTION WAS REMOVED, AND THESE ROWS ARE WHY.
        // Three consecutive attempts to suppress that false positive each produced
        // a SILENT PASS — the failure this proposal exists to remove:
        //   `p084-xv9`  — the exemption skipped the whole line, so a comment after a
        //                 same-line `</textarea>` was exempted although it really is
        //                 hidden; doctor read a policy out of it under a clean verdict.
        //   `p084-xv10` — the column version accepted `</textarea >` while the
        //                 classifier closes only on `</textarea>`. Two consumers, one
        //                 rule, no shared spelling — and a later exact close then
        //                 suppressed the unclosed fallback, so nothing fired at all.
        // Each row below is a shape that was silent under one of those versions.
        // **They now all report.** Reporting is the noisy direction, which this
        // module's own rule allows and which the maintainer twice chose in this same
        // area. If one of these ever goes back to `false`, an exemption has been
        // reintroduced — read the block comment in `doctor-checks` before deciding
        // that is an improvement.
        const reports = (md) => doctorChecks.containerHtmlCommentLine(md) !== -1
          || doctorChecks.inlineHtmlCommentLine(md) !== -1;
        assert.equal(
          reports('# H\n\n<textarea><!-- x --></textarea>\n'), true,
          'same-line <textarea>: reported'
        );
        assert.equal(
          reports('# H\n\n<textarea></textarea><!-- x -->\n'), true,
          'comment AFTER a same-line end tag — silent under the xv9 version'
        );
        assert.equal(
          reports('# H\n\n<textarea>\nv\n</textarea >\n<!-- x -->\n</textarea>\n'), true,
          'close tag with whitespace before `>`, then a later exact close — silent under the xv10 version, because two consumers spelled the same rule differently'
        );
        assert.equal(
          reports('# H\n\n<textarea><!-- a --></textarea><textarea><!-- b --></textarea>\n'), true,
          'two elements on one line: the single-cutoff model got this wrong in the noisy direction, and uniform reporting makes the question moot'
        );
        assert.equal(
          reports('# H\n\n<textarea>\n<!-- x -->\n'), true,
          'unclosed <textarea>: reported like every other shape now'
        );
        // ⚠ `<script>` / `<style>` are a DIFFERENT question and must stay exempt:
        // their interiors are invisible to the reader, so nothing is hidden that was
        // not hidden anyway. Removing the raw-text exemption must not reach them.
        assert.equal(
          reports('# H\n\n<script>\n<!-- x -->\n</script>\n'), false,
          '<script> stays exempt — its content is invisible, which is the `invisible` flag, not the removed exemption'
        );
        // ⚠⚠ THE MITIGATION IS NOW ENTIRELY A SENTENCE, so the sentence has to reach
        // EVERY id the shape can be reported under — and for one round it did not
        // (`p084-xv11` finding 1). `<textarea><!-- rule --></textarea>` on one line
        // does not start its line's content, so the partition correctly calls it
        // `inline-html-comment`; that id's action said "move the comment to a line of
        // its own at column 0", which is precisely the edit that hides displayed raw
        // text. The multi-line form routes to `comment-inside-container` and was safe.
        // One shape, two ids, one of them unprotected.
        assert.notEqual(
          doctorChecks.inlineHtmlCommentLine('# H\n\n<textarea><!-- x --></textarea>\n'), -1,
          'the same-line form is reported under the INLINE id — that is the partition working, and it is why the advice has to be on both'
        );
        {
          const initSource = await readFile(join(repoRoot, 'lib/init.js'), 'utf8');
          const textareaClauseLine = initSource.split('\n').find((line) => line.startsWith('const TEXTAREA_LEAVE_IT_ALONE = '));
          const rendererClauseLine = initSource.split('\n').find((line) => line.startsWith('const MARKED_COMMENT_CALIBRATION = '));
          assert.ok(textareaClauseLine, 'could not locate the shared <textarea> action clause');
          assert.match(textareaClauseLine, /do NOT ignore the overall uncertainty result/,
            'a harmless first <textarea> hit must not waive the file-level uncertainty');
          assert.match(textareaClauseLine, /first occurrence of each shape/,
            'the action must disclose that the cited harmless line can shadow a later genuine hit');
          assert.doesNotMatch(textareaClauseLine, /ignore this finding|does NOT apply/,
            'the retired waiver and false reassurance must not return to the shipped action');
          assert.ok(rendererClauseLine, 'could not locate the shared renderer-calibration action clause');
          assert.match(rendererClauseLine, /`dflow render`, powered by Marked/,
            'repair advice must name the shipped renderer it is calibrated against');
          for (const id of ['inline-html-comment', 'comment-inside-container']) {
            const m = initSource.match(new RegExp(`id: '${id}'[\\s\\S]*?\\n\\s*action: ([^\\n]*)`));
            assert.ok(m, `could not locate the ${id} action — repoint this pin, do not delete it`);
            assert.match(
              m[1], /TEXTAREA_LEAVE_IT_ALONE/,
              `${id}'s action must carry the shared <textarea> clause: doctor reports that shape under BOTH comment ids, and the id without the clause sends the user to hide their own visible text`
            );
            assert.match(
              m[1], /MARKED_COMMENT_CALIBRATION/,
              `${id}'s action must carry the same Marked renderer scope: either id can report the markerless list-owned raw-HTML shape`
            );
          }
          assert.equal(
            (initSource.match(/const TEXTAREA_LEAVE_IT_ALONE = /g) || []).length, 1,
            'and the clause is spelled ONCE — two copies of a rule is this codebase\'s oldest defect class, and this rule has already been rewritten three times'
          );
          assert.equal(
            (initSource.match(/const MARKED_COMMENT_CALIBRATION = /g) || []).length, 1,
            'the renderer calibration is also spelled once and shared by both comment ids'
          );
        }
        // A harmless first hit can shadow a genuine later hit under either id. The
        // detector remains deliberately first-hit-only; the safe action above, not a
        // fake clean bill of health, is what closes this noisy-direction residual.
        assert.equal(
          doctorChecks.inlineHtmlCommentLine('# H\n<textarea><!-- visible --></textarea>\nprose <!-- genuinely hidden -->\n'), 2,
          'inline detector reports only the first same-id hit, so its action must keep the whole file uncertain'
        );
        assert.equal(
          doctorChecks.containerHtmlCommentLine('# H\n<textarea>\n<!-- visible -->\n</textarea>\n- item\n  <!-- genuinely hidden -->\n'), 3,
          'container detector reports only the first same-id hit, so its action must direct a rest-of-file inspection'
        );

        // ⚠⚠ PUBLIC-DOCUMENT CONTRACTS ARE GUARDED IN READER-VISIBLE, SCOPED
        // PROSE IN BOTH LANGUAGES. `p084gate-x10` showed that no page semantics were
        // guarded at all. The first repair then searched the whole raw Markdown for
        // exact anchor strings; `p084gate-x11` defeated it by hiding those strings in
        // HTML comments while reversing all six visible contracts, and also showed a
        // meaning-preserving paraphrase went red. Runtime pins are not enough: these
        // pages are shipped guidance, and a user can follow their unsafe edit even
        // while the CLI itself prints the right sentence.
        const maskNonReaderMarkdown = (markdown) => {
          let fence = null;
          const withoutFences = (markdown.match(/[^\n]*\n|[^\n]+$/g) || []).map((line) => {
            const body = line.replace(/\r?\n$/, '');
            if (fence) {
              if (new RegExp(`^ {0,3}${fence.char}{${fence.length},}[ \\t]*$`).test(body)) fence = null;
              return line.replace(/[^\r\n]/g, ' ');
            }
            const opener = /^ {0,3}(`{3,}|~{3,})/.exec(body);
            if (!opener) return line;
            fence = { char: opener[1][0], length: opener[1].length };
            return line.replace(/[^\r\n]/g, ' ');
          }).join('');
          return withoutFences.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\r\n]/g, ' '));
        };
        const markdownContractProse = (markdown) => maskNonReaderMarkdown(markdown)
          .replace(/<[^>\n]+>/g, ' ')
          .replace(/[*_`>#]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const markdownSection = (text, start, end) => {
          const boundaries = maskNonReaderMarkdown(text);
          const from = boundaries.indexOf(start);
          const to = boundaries.indexOf(end, from + start.length);
          assert.ok(from !== -1 && to !== -1 && to > from,
            `public guidance section moved: ${start} -> ${end}; repoint the semantic guard, do not widen it to the whole page`);
          return markdownContractProse(text.slice(from, to));
        };
        const publicDocContractFailures = (text, language) => {
          const english = language === 'en';
          const firstH2 = maskNonReaderMarkdown(text).indexOf('\n## ');
          assert.notEqual(firstH2, -1, 'public guidance lost its first H2 boundary');
          const preamble = markdownContractProse(text.slice(0, firstH2));
          const inline = markdownSection(text, '### `inline-html-comment`', '### `comment-inside-container`');
          const container = markdownSection(text, '### `comment-inside-container`', '### `unclosed-html-block`');
          const commentAdvice = `${inline} ${container}`;

          const textareaSafe = english
            ? (/(?:do not|don\'t|must not)\s+(?:ignore|dismiss)|(?:keep|leave)\b.{0,45}\b(?:uncertainty|finding)\b.{0,30}\b(?:open|active)|\b(?:uncertainty|finding)\b.{0,35}\b(?:remain|stay)\w*\b.{0,20}\b(?:open|active)|\b(?:uncertainty|finding)\b.{0,25}\bcannot be (?:closed|dismissed)/i.test(commentAdvice)
              && /(?:only|just)\b.{0,24}\b(?:first|earliest)|\b(?:first|earliest)\b.{0,35}\b(?:occurrence|instance|one)\b/i.test(commentAdvice)
              && /\b(?:shadow|mask|hide|obscure|conceal)\w*\b.{0,65}\b(?:later|subsequent|following)\b.{0,65}\b(?:genuine|hidden|real)\b/i.test(commentAdvice)
              && !/\b(?:can|may|should|must)\s+(?:safely\s+)?(?:ignore|dismiss)\b.{0,55}\b(?:uncertainty|finding)\b|\baffected checks\b.{0,35}\b(?:remain|are|stay)\s+(?:trusted|reliable)\b|\bclose\b.{0,35}\b(?:overall|file-level)\b.{0,25}\b(?:finding|uncertainty)\b/i.test(commentAdvice))
            : (/(?:不要|不得).{0,12}(?:忽略|結束).{0,24}(?:不確定|finding)|(?:整體|這條).{0,18}(?:不確定|finding).{0,18}(?:仍|繼續|保持).{0,12}(?:成立|開著|開啟|保留|不能結案)|(?:不確定|finding).{0,18}(?:不能|不可).{0,12}(?:解除|結案|關閉)/.test(commentAdvice)
              && /只.{0,12}(?:回報|列出).{0,12}(?:第一|最早|最先)|(?:第一|最早|最先).{0,12}(?:處|個|位置)/.test(commentAdvice)
              && (/(?:遮住|蓋掉|掩蓋).{0,35}(?:後面|稍後|下一個).{0,35}(?:藏|真的|真正)/.test(commentAdvice)
                || /讓.{0,12}(?:之後|後面).{0,35}(?:隱藏|藏).{0,28}(?:沒有出現|漏掉)/.test(commentAdvice))
              && !/(?:可以|可|應該).{0,10}(?:忽略|結束).{0,24}(?:不確定|finding)|受影響.{0,24}(?:可信|可靠)|(?:整體\s*)?finding.{0,12}(?:可以|就能|能夠).{0,12}(?:結案|解除|關閉)/.test(commentAdvice));

          const rendererSectionSafe = (section) => {
            // Keep the alternate-renderer noun and its visibility direction in
            // the SAME sentence. Whole-section matching let an unrelated code-span
            // sentence (`會被 render 出來`, `看得到`) rescue a zh renderer sentence
            // whose own verb had been reversed to "also hides" (`p084gate-y3`).
            const sentences = section.split(/[.!?。！？]/).map((sentence) => sentence.trim()).filter(Boolean);
            const alternateRendererMayExpose = english
              ? sentences.some((sentence) =>
                /\b(?:another|other|different|some)\b.{0,35}\b(?:renderer|publishing engine)/i.test(sentence)
                && (/\b(?:may|might|can)\b.{0,45}\b(?:show|expose|display|render)\w*\b/i.test(sentence)
                  || /\b(?:another|other|different|some)\b.{0,45}\b(?:renderers?|publishing engines?)\b.{0,45}\b(?:show|expose|display|render|make)\w*\b/i.test(sentence)))
              : sentences.some((sentence) =>
                /(?:其他|別的|有些|不同).{0,20}(?:renderer|引擎)/i.test(sentence)
                && /(?:可能|也許|會).{0,30}(?:顯示|露出|看得到|看得見)/.test(sentence));
            const universalClaim = english
              ? /\b(?:every|all|any)\b.{0,25}\b(?:renderer|publishing engine)\b.{0,55}\b(?:same|hide|invisible|universal|appl(?:y|ies))\b|\buniversal renderer\b|\bregardless of\b.{0,35}\b(?:renderer|publishing engine)\b|\bwhichever\b.{0,20}\brenderer\b.{0,40}\bunchanged\b|\bunchanged\b.{0,40}\bwhichever\b.{0,20}\brenderer\b/i.test(section)
              : /(?:所有|任何).{0,20}(?:renderer|發佈引擎).{0,35}(?:一律|都會|相同|適用)|無論.{0,30}(?:renderer|發佈引擎)|每一種.{0,20}發佈引擎/i.test(section);
            return /dflow render/i.test(section)
              && /Marked/i.test(section)
              && alternateRendererMayExpose
              && !universalClaim;
          };
          const rendererScope = rendererSectionSafe(inline) && rendererSectionSafe(container);

          const sourceVsPublished = english
            ? /\bmain\b/i.test(preamble)
              && /Unreleased/i.test(preamble)
              && /@latest/i.test(preamble)
              && /published/i.test(preamble)
              && (/(?:does not|doesn\'t|may not|might not|not guaranteed|is not guaranteed).{0,85}(?:every|all|feature|report|include|released)/i.test(preamble)
                || /published package.{0,35}(?:may|might|can).{0,25}(?:lag|trail|fall behind)/i.test(preamble))
              && !/@latest[^.!?\n]{0,55}(?:includes|contains|guarantees)[^.!?\n]{0,45}(?:every|all|each)/i.test(preamble)
            : /main/i.test(preamble)
              && /Unreleased/i.test(preamble)
              && /@latest/i.test(preamble)
              && /已發佈/.test(preamble)
              && (/(?:不保證|未必|不一定).{0,55}(?:包含|納入|功能|回報)/.test(preamble)
                || /已發佈套件.{0,20}(?:可能|也許).{0,15}(?:落後|晚於)/.test(preamble))
              && !/@latest[^。！？：\n]{0,55}(?:(?<!不保證)已|會)[^。！？：\n]{0,4}(?:包含|納入|收錄)[^。！？：\n]{0,24}(?:所有|全部|每一)/.test(preamble);
          return [
            ['textarea-first-hit', textareaSafe],
            ['renderer-scope', rendererScope],
            ['main-vs-published', sourceVsPublished]
          ].filter(([, ok]) => !ok).map(([name]) => name);
        };
        for (const row of [
          {
            language: 'en',
            file: 'doctor-uncertainty.en.md',
            mutations: [
              ['textarea-first-hit', (s) => s.replace('do **not** ignore the overall uncertainty result', 'may safely ignore the overall uncertainty result')],
              ['renderer-scope', (s) => s
                .replace('Another Markdown renderer may expose an escaped apparent opener there', 'Every Markdown renderer hides this opener, so the repair applies universally')
                .replace('Some other Markdown renderers expose an escaped apparent opener instead', 'All Markdown renderers hide this opener, so the repair applies universally')],
              ['main-vs-published', (s) => s.replace(/This page tracks the source `main` branch[^\n]+/, 'Upgrade to `@latest`; it includes every report described on this page:')]
            ],
            paraphrase: (s) => s
              .replace('do **not** ignore the overall uncertainty result', 'keep the overall uncertainty result open')
              .replace('reports only the first occurrence of each shape in a file', 'emits just the earliest occurrence of each shape per file')
              .replace('shadow a later, genuinely hidden comment', 'mask a subsequent comment that is genuinely hidden'),
            extraContradictions: [
              ['textarea-first-hit', (s) => s.replace('Inspect the rest of the cited file for other apparent comment openers before trusting the affected checks.', 'You may now close the overall finding without inspecting the rest of the file.')],
              ['renderer-scope', (s) => s
                .replace('if you publish through a different renderer, inspect its output before applying the repair.', 'regardless of the renderer you use, the opener is always hidden and this repair is safe without checking output.')
                .replace('If you publish through another renderer, inspect that output before moving or deleting the comment.', 'These instructions apply unchanged to whichever renderer publishes the document.')],
              ['renderer-scope', (s) => s
                .replace('Another Markdown renderer may expose an escaped apparent opener there', 'Another Markdown renderer also hides the escaped apparent opener')
                .replace('Some other Markdown renderers expose an escaped apparent opener instead', 'Some other Markdown renderers also hide the escaped apparent opener instead')],
              ['main-vs-published', (s) => s.replace('> Everything on this page is done by editing your own Markdown', '> `@latest` is synchronized with `main` and includes each report described below.\n>\n> Everything on this page is done by editing your own Markdown')]
            ],
            extraParaphrases: [
              (s) => s.replace('it does not guarantee that every `main`-branch feature below has been released', 'the published package may lag behind what this `main`-branch page describes'),
              (s) => s
                .replace('Another Markdown renderer may expose an escaped apparent opener there', 'A different publishing engine can make the escaped opener visible')
                .replace('Some other Markdown renderers expose an escaped apparent opener instead', 'A different publishing engine can make the escaped opener visible instead'),
              (s) => s.replace(
                'But do **not** ignore the overall uncertainty result: doctor reports only the first occurrence of each shape in a file, so this harmless line can shadow a later, genuinely hidden comment with the same id.',
                'The file-level uncertainty cannot be closed: doctor emits just the earliest instance of each shape, and this harmless line can conceal a subsequent real hidden comment with the same id.'
              )
            ]
          },
          {
            language: 'zh',
            file: 'doctor-uncertainty.md',
            mutations: [
              ['textarea-first-hit', (s) => s.replace('不要忽略整體的不確定結論', '可以忽略整體的不確定結論')],
              ['renderer-scope', (s) => s
                .replace('其他 Markdown renderer 可能會顯示被 escape 的註解開頭', '所有 Markdown renderer 都會藏起這個開頭，因此修法一律適用')
                .replace('有些其他 Markdown renderer 反而會顯示被 escape 的註解開頭', '任何 Markdown renderer 都會藏起這個開頭，因此修法一律適用')],
              ['main-vs-published', (s) => s.replace(/本頁隨源碼 `main` 更新[^\n]+/, '升級到 `@latest`；它已包含本頁描述的所有回報：')]
            ],
            paraphrase: (s) => s
              .replace('不要忽略整體的不確定結論', '請讓整體 finding 保持開啟')
              .replace('只回報第一處', '只列出最早的一個位置')
              .replace('遮住後面同 id、真的被藏起來的註解', '掩蓋稍後同 id、真正隱藏的註解'),
            extraContradictions: [
              ['textarea-first-hit', (s) => s.replace('信任受影響的檢查以前，請繼續檢查該檔案其餘看似註解開頭的位置。', '現在整體 finding 就能結案，不必再檢查檔案後文。')],
              ['renderer-scope', (s) => s
                .replace('若你用別的 renderer 發佈，套用修法前請先檢查它的輸出。', '無論採用哪一個 renderer，這個開頭都會被藏起來，修法不需檢查輸出。')
                .replace('若你用別的 renderer 發佈，移動或刪除註解前請先檢查那份輸出。', '這份修法對每一種發佈引擎都不需調整。')],
              ['renderer-scope', (s) => s
                .replace('其他 Markdown renderer 可能會顯示被 escape 的註解開頭', '其他 Markdown renderer 也會藏起被 escape 的註解開頭')
                .replace('有些其他 Markdown renderer 反而會顯示被 escape 的註解開頭', '有些其他 Markdown renderer 也會藏起被 escape 的註解開頭')],
              ['main-vs-published', (s) => s.replace('> 本頁所有修法都只是改你自己的 Markdown', '> `@latest` 與 `main` 同步，已收錄下方每一項回報。\n>\n> 本頁所有修法都只是改你自己的 Markdown')]
            ],
            extraParaphrases: [
              (s) => s.replace('不保證已包含下面每一項 `main` 功能', '已發佈套件可能落後於本頁記載的 `main` 內容'),
              (s) => s
                .replace('其他 Markdown renderer 可能會顯示被 escape 的註解開頭', '不同的 Markdown 引擎可能讓被 escape 的註解開頭看得見')
                .replace('有些其他 Markdown renderer 反而會顯示被 escape 的註解開頭', '不同的 Markdown 引擎反而可能讓被 escape 的註解開頭看得見'),
              (s) => s.replace(
                '但**不要忽略整體的不確定結論**：doctor 對每種形狀在一個檔案裡只回報第一處，所以這個無害位置可能遮住後面同 id、真的被藏起來的註解。',
                '但整體不確定狀態不能解除：doctor 對每種形狀只指出最先遇到的位置，因此這個無害位置可能讓之後實際隱藏的同 id 註解沒有出現在首筆回報。'
              )
            ]
          }
        ]) {
          const page = await readFile(join(repoRoot, 'docs', row.file), 'utf8');
          assert.deepEqual(
            publicDocContractFailures(page, row.language), [],
            `${row.file}: shipped public guidance must retain all three semantic safety contracts`
          );
          for (const [contract, mutate] of row.mutations) {
            const mutant = mutate(page);
            assert.notEqual(mutant, page, `${row.file}/${contract}: mutation did not apply; update this adequacy probe with the prose`);
            assert.ok(
              publicDocContractFailures(mutant, row.language).includes(contract),
              `${row.file}/${contract}: independently removing or reversing this public-document contract must make its semantic guard go red`
            );
            const inlineHeading = '### `inline-html-comment`';
            const hiddenAnchor = contract === 'main-vs-published'
              ? page.slice(0, page.indexOf('\n## '))
              : markdownSection(page, inlineHeading,
                contract === 'renderer-scope' ? '### `unclosed-html-block`' : '### `comment-inside-container`');
            const anchorLocation = contract === 'main-vs-published' ? '# ' : inlineHeading;
            const hiddenAnchorMutant = mutant.replace(anchorLocation, `${anchorLocation}\n<!-- ${hiddenAnchor.replaceAll('-->', '-- >')} -->`);
            assert.ok(
              publicDocContractFailures(hiddenAnchorMutant, row.language).includes(contract),
              `${row.file}/${contract}: hiding the old anchors in an HTML comment must not rescue contradictory reader-visible guidance`
            );
          }
          const paraphrased = row.paraphrase(page);
          assert.notEqual(paraphrased, page, `${row.file}: meaning-preserving paraphrase probe did not apply`);
          assert.deepEqual(
            publicDocContractFailures(paraphrased, row.language), [],
            `${row.file}: reasonable meaning-preserving paraphrases must not make the semantic guard needlessly word-literal`
          );
          for (const [contract, contradict] of row.extraContradictions) {
            const mutant = contradict(page);
            assert.notEqual(mutant, page, `${row.file}/${contract}: alternative contradiction probe did not apply`);
            assert.ok(
              publicDocContractFailures(mutant, row.language).includes(contract),
              `${row.file}/${contract}: alternative visible contradiction must make the scoped semantic guard go red`
            );
          }
          for (const paraphrase of row.extraParaphrases) {
            const variant = paraphrase(page);
            assert.notEqual(variant, page, `${row.file}: extra meaning-preserving paraphrase probe did not apply`);
            assert.deepEqual(
              publicDocContractFailures(variant, row.language), [],
              `${row.file}: published, renderer, and three-concept paraphrases must remain green`
            );
          }
          const fencedHeading = page.replace(
            '### `inline-html-comment`',
            '### `inline-html-comment`\n\n```markdown\n### `comment-inside-container`\n```'
          );
          assert.deepEqual(
            publicDocContractFailures(fencedHeading, row.language), [],
            `${row.file}: a heading lookalike inside a fenced example must not move semantic section boundaries`
          );
        }
      }
      // ⚠⚠ ACCEPTED NOISE, PINNED SO IT CANNOT DRIFT SILENTLY (`p084-xv8` finding 5;
      // maintainer principle of 2026-08-09). `blankFencedBlocks` reads RAW document
      // lines and never strips a container prefix, so two shapes are not masked and
      // a comment inside them is reported: a fence opened inside a block quote, and
      // a fence at FOUR OR MORE SPACES of raw indent — past `FENCE_OPEN_RE`'s
      // `^ {0,3}`, which happens under an ordinary `- item`, not only a deep one
      // (`p084-xv9` finding 3 corrected that description; `p084-xv10` finding 4
      // caught this comment still carrying the old one). The module's own comment
      // claimed fenced examples "therefore do not fire", without the qualifier, for
      // eight rounds. Fixing it means a container-aware fence scanner whose failure
      // direction is silence; the maintainer chose the gap over that scanner.
      // ⚠⚠ AND THE GAP ITSELF PRODUCES SILENCE, not only noise (`p084-y2` finding 1):
      // an unmasked fence's content is counted as section body, so an upstream rule
      // quoted as an example inside one makes that rule look present while the live
      // copy has changed — `All checks passed` over real drift, reproduced end to end.
      // The decision was taken believing the cost was noise-only. Do not restate the
      // noise-only framing anywhere; it is retired.
      // ⚠ The two shapes clear DIFFERENTLY and the pages say so: un-indenting fixes
      // the indent case, and nothing but leaving the quote fixes the other, because
      // the line still starts with `>` at any depth (`p084-xv10` finding 2).
      // ⚠ These assertions pin a DEFECT deliberately. If one starts failing, the
      // masker grew container awareness — go and delete the paragraph on both pages
      // rather than "fixing" the test.
      assert.notEqual(
        doctorChecks.containerHtmlCommentLine('# H\n\n> ```md\n> <!-- x -->\n> ```\n'), -1,
        'accepted noise: a fence inside a block quote is not masked, so the comment in it is still reported'
      );
      assert.notEqual(
        doctorChecks.containerHtmlCommentLine('# H\n\n- item\n    ```md\n    <!-- x -->\n    ```\n'), -1,
        'accepted noise: FOUR spaces of RAW indent is past FENCE_OPEN_RE\'s `^ {0,3}`, so the fence is not masked — under an ordinary list item, not only a deep one'
      );
      assert.equal(
        doctorChecks.containerHtmlCommentLine('# H\n\n- item\n   ```md\n   <!-- x -->\n   ```\n'), -1,
        'and THREE spaces is masked — the boundary is the raw indent, which is what the comment and both pages must say'
      );
      // ⚠ The block-quote shape does NOT clear by re-indenting, at any depth, and
      // both pages said it did for one round (`p084-xv10` finding 2). The `>` is
      // still the first character, so `FENCE_OPEN_RE` never sees a fence at all.
      for (const pad of ['', '  ', '   ']) {
        assert.notEqual(
          doctorChecks.containerHtmlCommentLine(`# H\n\n> ${pad}\`\`\`md\n> ${pad}<!-- x -->\n> ${pad}\`\`\`\n`), -1,
          `a fence inside a block quote stays unmasked at indent ${JSON.stringify(pad)} — re-indenting is not a repair here, and the pages must not offer it as one`
        );
      }
      // …but the shapes the claim IS true for must stay true, or the paragraph above
      // is describing a masker that no longer masks anything.
      assert.equal(
        doctorChecks.containerHtmlCommentLine('# H\n\n```md\n<!-- x -->\n```\n'), -1,
        'a fence at column 0 is masked — this is the case the "fenced examples do not fire" sentence is about'
      );
      assert.equal(
        doctorChecks.containerHtmlCommentLine('# H\n\n- x\n  ```md\n  <!-- x -->\n  ```\n'), -1,
        'and a fence at a shallow list content column is still within the three-space indent the fence rule allows'
      );
      // ⚠⚠ …AND THE PRICE OF THAT DECISION IS PAID HERE. Doctor reports a shape it
      // should not, so the sentence the user acts on has to name it — otherwise the
      // finding above sends them to make the one edit that genuinely hides the text.
      // Four separate rounds found a repair instruction that read well and made
      // things worse; this is the first assertion that reaches that layer at all.
      // ⚠ It pins the MENTION, not the wording, and that is the honest limit: a
      // rewrite that names `<textarea>` while advising the opposite still passes.
      // The same file already pins a shipped string this way (the explainer URL),
      // and counting occurrences — the brittle form — is what this file retracts.
      // ⚠⚠ It must read the `action` LITERAL, not the file. The first version of
      // this assertion matched `/<textarea>/` against all of `lib/init.js`, where
      // the comments beside this detector name the tag several times — so deleting
      // the clause from the shipped string left the pin green. A pin satisfied by
      // the comment explaining it is not a pin.
      // ⚠ SUPERSEDED, not dropped. It read ONE id's action literal, and the clause it
      // looked for now lives in `TEXTAREA_LEAVE_IT_ALONE`, prefixed to BOTH comment
      // ids — because protecting only one of the two ids the shape can be reported
      // under is itself the defect (`p084-xv11` finding 1). The replacement is in the
      // `<textarea>` block above: it checks both ids AND that the clause is spelled
      // once. Two pins for one rule is the class this file keeps retracting.

      // y1 finding 5 — indented code is rendered verbatim; warning there is noise.
      assert.equal(
        doctorChecks.inlineHtmlCommentLine('# H\n\nExample:\n\n    prose <!-- x -->\n'), -1,
        'a comment inside an indented code block is visible to the reader — flagging it is the false-positive class gap D was rejected for'
      );

      // y1 finding 6 — a delimiter-shaped separator row in a table BODY is not a
      // header/delimiter pair, and doctor and GFM agree about the whole block.

      // y1 finding 7 — type 7 is DEFINED by not interrupting a paragraph, so a bare
      // tag continuing one is not type 7 and there is no divergence to report.
      assert.equal(
        doctorChecks.htmlBlockType7Line('# H\nsome prose\n<my-widget>\n---\n'), -1,
        'a bare tag continuing a paragraph is not HTML block type 7 — doctor already agrees with CommonMark there'
      );
      assert.notEqual(
        doctorChecks.htmlBlockType7Line('# H\n<my-widget>\n---\n'), -1,
        'a bare tag at a genuine block start above a setext underline must still fire'
      );
      // ⚠ `p084-xv5` finding 2 — CommonMark's type-7 start condition is an open tag
      // OR A COMPLETE CLOSING TAG. The detector matched only the first while both doc
      // pages described the shape in words that cover both, so `</my-widget>` above a
      // setext underline diverged from the reference renderer and was never disclosed.
      assert.notEqual(
        doctorChecks.htmlBlockType7Line('# H\n\n</my-widget>\n---\n'), -1,
        'a complete CLOSING tag also starts HTML block type 7 — the divergence is the same one and must be disclosed'
      );
      assert.equal(
        doctorChecks.htmlBlockType7Line('# H\n\n</div>\n---\n'), -1,
        'a type-6 closing tag is implemented and must not be reported as type 7 — widening the opener must not widen past the type-6 exclusion'
      );
      assert.equal(
        doctorChecks.htmlBlockType7Line('# H\n\nprose\n</my-widget>\n---\n'), -1,
        'a closing tag continuing a paragraph is not type 7 either — the paragraph-continuation rule must reach the widened shape'
      );
      // ⚠⚠ `p084-xv6` finding 2 — the widened opener shared the open-tag's attribute
      // tail and `/?` with the closing form, and a closing tag may carry NEITHER.
      // CommonMark's "complete closing tag" is `</`, a name, optional whitespace,
      // `>`. So these two are ordinary paragraph text, `---` under them really is a
      // setext heading, and this module already agrees with the spec — there is
      // nothing to disclose and firing was noise.
      // ⚠ Settled against the SPEC, not against `marked`: this repo has measured
      // `marked` to be non-conformant exactly at setext boundaries, so it cannot
      // arbitrate this pair.
      assert.equal(
        doctorChecks.htmlBlockType7Line('# H\n\n</my-widget attr>\n---\n'), -1,
        'a closing tag with an attribute is not a complete closing tag, so it does not start type 7 and there is no divergence to report'
      );
      assert.equal(
        doctorChecks.htmlBlockType7Line('# H\n\n</my-widget/>\n---\n'), -1,
        'a closing tag cannot self-close either — same reason'
      );
      assert.notEqual(
        doctorChecks.htmlBlockType7Line('# H\n\n<my-widget data-x=1>\n---\n'), -1,
        'but an OPEN tag may carry attributes and must still fire — tightening the closing form must not tighten the open one'
      );
      // ⚠⚠ A GRAMMAR-LEVEL PIN SET, and it exists because case-by-case pins were
      // measured to be the wrong instrument here (`p084-xv7` ITEM 5). Seven rounds
      // of one-off examples left the open-tag tail as `[^<>]*` — "anything without
      // angle brackets" — while CommonMark's raw-HTML grammar ALLOWS `>` inside a
      // quoted attribute value. `<my-widget title="a > b">` is therefore a complete
      // open tag that starts HTML block type 7 and swallows the underline below it,
      // this module read that underline as a setext heading, no detector fired, and
      // a real project got `All checks passed` over a genuinely stale section. That
      // is the failure class this entire proposal exists to remove, reproduced end
      // to end. So the pin follows the PRODUCTIONS — one row per thing the grammar
      // permits or forbids — rather than the examples someone happened to think of.
      // ⚠ Rejection rows are as load-bearing as acceptance rows: for each of them
      // this module and the spec AGREE, so there is no divergence to disclose and
      // firing is pure noise on user content.
      for (const [tag, shouldFire, why] of [
        ['<my-widget>', true, 'bare open tag'],
        ['<my-widget data-x=1>', true, 'unquoted attribute value'],
        ['<my-widget title="a b">', true, 'double-quoted value'],
        ['<my-widget title="a > b">', true, 'a quoted value MAY contain `>` — this is the blocker case'],
        ["<my-widget title='a > b'>", true, 'and so may a single-quoted one'],
        ['<my-widget a=1 b="2">', true, 'more than one attribute'],
        ['<my-widget hidden>', true, 'an attribute may have no value'],
        ['<my-widget a = 1>', true, 'whitespace is allowed around the `=`'],
        ['<my-widget/>', true, 'self-closing'],
        ['<my-widget a="1" />', true, 'attribute then self-closing'],
        ['<my-widget _x:y-z=1>', true, 'attribute names may start with `_` or `:` and carry `.:-`'],
        ['<my-widget =x>', false, 'an attribute name may not start with `=`, so this is not a tag'],
        ['<my-widget "x">', false, 'a bare quoted string is not an attribute'],
        ['< my-widget>', false, 'no whitespace is allowed before the tag name'],
        ['<my-widget a="1>', false, 'an unterminated quote never completes the tag'],
        ['</my-widget>', true, 'complete closing tag'],
        ['</my-widget >', true, 'whitespace before `>` is allowed in a closing tag'],
        ['</my-widget attr>', false, 'a closing tag may not carry attributes'],
        ['</my-widget/>', false, 'a closing tag may not self-close'],
        ['<div class="x">', false, 'type 6 is implemented, so a known block tag is never type 7 — with or without attributes'],
        // ⚠⚠ §4.6 attaches the name exclusion to the OPEN-TAG form only: "a
        // complete open tag (with any tag name other than pre, script, style, or
        // textarea) OR a complete closing tag". Relying on the classifier for this
        // half was not enough — `htmlBlockStart` recognises `<pre>` but not
        // `<pre/>`, so the self-closing forms escaped and were reported as
        // divergences that do not exist (`p084-xv8` finding 4).
        ['<pre/>', false, 'type 1 wins over type 7 for these four names, self-closing form included'],
        ['<script/>', false, 'same'],
        ['<style/>', false, 'same'],
        ['<textarea/>', false, 'same'],
        ['<pre>', false, 'and the plain open form'],
        ['<pre class="x">', false, 'and with attributes'],
        ['</pre>', true, 'but a complete CLOSING tag carries NO name exclusion — the spec parenthetical is on the open-tag form, so this really is type 7'],
        ['</textarea>', true, 'same, and the asymmetry is the spec\'s, not an oversight'],
        // ⚠ Productions round nine named as unpinned. Each expectation is the
        // spec's, checked against it — not a transcript of current behaviour.
        ['<my-widget a="">', true, 'an empty double-quoted value is a value'],
        ["<my-widget a=''>", true, 'and an empty single-quoted one'],
        ['<my-widget a=>', false, 'an `=` must be followed by a value'],
        ['<my-widget a=1b=2>', false, 'attributes must be separated by whitespace'],
        ['<my-widget a="x<y">', true, 'a quoted value may contain `<`'],
        ['<my-widget a="x`y">', true, 'and a backtick'],
        ['<my-widget a="x=y">', true, 'and an `=`'],
        ['<my-widget />', true, 'whitespace is allowed before the self-closing slash'],
        ['<my-widget / >', false, 'but not between the slash and the `>`'],
        ['<my-widget  a=1>', true, 'more than one space before an attribute is fine'],
        ['<my-widget a=1 >', true, 'and trailing whitespace before the `>`']
      ]) {
        const fired = doctorChecks.htmlBlockType7Line(`# H\n\n${tag}\n---\n`) !== -1;
        assert.equal(
          fired, shouldFire,
          `type-7 grammar / ${JSON.stringify(tag)}: ${why} — expected ${shouldFire ? 'a finding' : 'silence'}, got ${fired ? 'a finding' : 'silence'}`
        );
      }

      // y1 finding 9 — one rule, one spelling. The duplicated `affects` literal was
      // this module's own defect class landing in the field whose accuracy the
      // uncertain state exists to guarantee.
      //
      // ⚠ Pinned on BEHAVIOUR, not on a source substring count. The first version of
      // this assertion counted occurrences of a sentence fragment in `lib/init.js`
      // and required exactly one — which would have gone red if anyone quoted that
      // sentence in a nearby comment. A guard that refuses correct work stops every
      // run, while the defect it guards costs nothing until someone edits one copy;
      // that trade is the wrong way round, and it is the false-rejection class this
      // repo has paid for before. Comparing the rendered lines asks the real
      // question — do these two findings state the same affected set — and cannot
      // be tripped by prose.
      {
        const inlineAffects = (uncertainDoctorOut.get('inline-html-comment') || '')
          .split('\n').find((l) => l.includes('their silence is NOT a pass'));
        const unclosedAffects = unclosedDoctor.stdout
          .split('\n').find((l) => l.includes('their silence is NOT a pass'));
        assert.ok(inlineAffects && unclosedAffects, 'both findings must print an affected-checks line at all');
        assert.equal(
          inlineAffects, unclosedAffects,
          'the two visibility-gap findings must state the SAME affected set, because they share one cause (text the classifier hides from every check that reads it). Two spellings of one rule is how they drift apart.'
        );
      }

      // ⚠ The code-span rule pinned directly, not only through its two consumers:
      // it is the boundary that separates "hidden from the reader" from "shown to
      // the reader", and a consumer test cannot say which half broke.
      assert.deepEqual(
        doctorChecks.codeSpanMask('a `bc` d').map((x) => (x ? 1 : 0)),
        [0, 0, 1, 1, 1, 1, 0, 0],
        'a code span covers its delimiters and its contents, and nothing else'
      );
      assert.deepEqual(
        doctorChecks.codeSpanMask('none here').map((x) => (x ? 1 : 0)),
        new Array('none here'.length).fill(0),
        'a line with no backticks has no masked positions'
      );
    }

    // The three sibling checks stay silent on absent/blank ONLY because the
    // drift check reports it. That coupling is invisible at each call site, so
    // it is pinned here: if the owner ever stops reporting, the two assertions
    // above go to zero findings and this suite fails loudly instead of doctor
    // going quiet about the worst state the file can be in.
    assert.ok(
      conventionsFindings(goneDoctor.stdout).length > 0 && conventionsFindings(emptyDoctor.stdout).length > 0,
      'the absent/blank report must exist at all — silence here is the failure mode, not a clean bill'
    );

    // A heading indented 1-3 spaces is CommonMark-valid, and the policy-format
    // check used to demand an unindented level-2 heading while the drift check
    // accepted the indent — so one check called the section missing while the
    // other found it and inference read its value fine (`p082-b3-g1` finding 2).
    //
    // ⚠⚠ ONLY HEADINGS THAT DO NOT FOLLOW A LIST ARE INDENTED HERE, and that is
    // CommonMark rather than a workaround. A heading indented to an open list
    // item's content column belongs to THAT ITEM, so `   ## Prose Language`
    // after `- **Length target**: …` / `  (Dflow skill guidance)` is a heading
    // inside the item and not a document-level section. Verified against
    // commonmark@0.31.2: the heading node's parent is `item`, not `document`.
    // Indenting it therefore SHOULD make doctor report that section missing —
    // asserted separately below, because it is a different claim.
    //
    // The previous version of this block indented all three blindly and asserted
    // "not missing". That passed only because the old per-line parser could not
    // see list context at all; once the classification could, the assertion was
    // measuring the parser's blindness rather than the rule it names.
    const indentUnlessInList = (text) => {
      const lines = text.split('\n');
      let indented = 0;
      const out = lines.map((line, i) => {
        if (!/^## (Git Policy|AI Commit Policy|Prose Language)$/.test(line)) return line;
        let j = i - 1;
        while (j >= 0 && !lines[j].trim()) j -= 1;
        const prev = j >= 0 ? lines[j] : '';
        // A list marker, or an indented continuation of one, means a list is
        // still open here and an indented heading would land inside it.
        if (/^ {0,3}(?:[-*+]|\d{1,9}[.)])([ \t]|$)/.test(prev) || /^[ \t]/.test(prev)) return line;
        indented += 1;
        return `   ${line}`;
      }).join('\n');
      // ⚠ Without this the whole assertion below can pass vacuously: if the
      // generated file ever puts all three headings after lists, nothing gets
      // indented and "no section is missing" becomes trivially true while
      // certifying a rule it never exercised.
      assert.ok(indented > 0, 'the indent case must actually indent at least one policy heading');
      return out;
    };
    await writeFile(join(convFresh, CONVENTIONS_REL), indentUnlessInList(freshConventions));
    const indentedDoctor = await runDoctorAt(convFresh);
    assert.doesNotMatch(
      indentedDoctor.stdout,
      /_conventions\.md is missing the ## (Git Policy|AI Commit Policy|Prose Language) section/,
      'a 1-3 space indented policy heading is present, not missing — the locator must agree with doctor-checks.headingAt'
    );
    assert.doesNotMatch(
      indentedDoctor.stdout,
      /line is not machine-readable/,
      'and the policy VALUES are still read from an indented section'
    );

    // The other half of the same rule, and the reason the helper above has to
    // discriminate: a heading indented INTO an open list item is that item's
    // content, so its section really is absent from the document. Doctor says so
    // — loudly, which is the acceptable direction — instead of finding a section
    // that a Markdown renderer would not show as one.
    await writeFile(
      join(convFresh, CONVENTIONS_REL),
      freshConventions.replace(/^## Prose Language$/m, '   ## Prose Language')
    );
    const inListDoctor = await runDoctorAt(convFresh);
    assert.match(
      inListDoctor.stdout,
      /_conventions\.md is missing the ## Prose Language section/,
      'a heading indented into the preceding list item is inside that item, so the section is genuinely absent (commonmark@0.31.2: parent is `item`, not `document`)'
    );
    await writeFile(join(convFresh, CONVENTIONS_REL), freshConventions);

    // Line endings. `_conventions.md` is user-owned and hand-edited on any OS,
    // and this module's splitter has to agree with the `m`-flag regexes in
    // lib/init.js about what a line is. It did not: `/\r?\n/` left a CR-only
    // file as one giant line here while `/^> Dflow Version:/m` still parsed it
    // there, so the two checks described the same file differently
    // (`p082-b3-g1` finding 3). All three forms must give the same answer.
    const lfDrift = doctorChecks.findConventionsDrift(freshConventions, 'greenfield');
    for (const [label, eol] of [['CRLF', '\r\n'], ['CR-only', '\r']]) {
      assert.deepEqual(
        doctorChecks.findConventionsDrift(freshConventions.replace(/\n/g, eol), 'greenfield'),
        lfDrift,
        `${label} line endings must produce the same drift verdict as LF`
      );
    }

    // ATX closing sequences. CommonMark requires a `#` run at the end of a
    // heading to be PRECEDED by whitespace to count as a closing sequence;
    // otherwise it is part of the heading text. Stripping it unconditionally
    // let `## Git Policy#` resolve to `Git Policy`, so the widened policy
    // locator accepted a malformed heading that the old exact `^## X$` test had
    // rejected — the one thing the widening gave up (`p082-b3-g2` finding 2).
    for (const [line, want] of [
      ['## Git Policy', 'Git Policy'],
      ['## Git Policy #', 'Git Policy'],
      ['## Git Policy ###', 'Git Policy'],
      ['## Git Policy#', 'Git Policy#'],
      ['## Git Policy##', 'Git Policy##']
    ]) {
      assert.deepEqual(
        doctorChecks.extractH2Headings(line),
        [want],
        `${JSON.stringify(line)} is the heading ${JSON.stringify(want)}`
      );
    }
    assert.equal(
      doctorChecks.conventionsSectionBodies('## Git Policy#\n\nSelected Git policy: `gitflow`\n', 'Git Policy').length,
      0,
      'a malformed closing sequence must NOT resolve to the canonical section name'
    );

    // ═══════════════════════════════════════════════════════════════════════
    // THE CLASS GUARD. Every defect this module produced across four review
    // rounds had one shape: a block-structure predicate spelling "whitespace"
    // as JS `\s` where CommonMark means a space or a tab. `\s` additionally
    // matches U+00A0, form feed, vertical tab and a dozen Unicode spaces, so
    // such a line landed in a gap — neither the block it looked like nor a
    // paragraph — and a section either ran on past its end (silent pass: a
    // stale file reads as current) or ended early (content loss: the walker
    // pops the line carrying the marker).
    //
    // Four rounds found five instances one at a time. This asserts the class:
    // no block-structure function may contain `\s` at all. It is deliberately a
    // SOURCE-level check, because that is the only form that catches the sixth
    // instance before a reviewer does — and this repo's own note says a review
    // round is an expensive way to run a grep.
    //
    // ⚠ To add a legitimate `\s`, do not weaken this — move that expression out
    // of these functions, or narrow it to `[ \t]`. The functions listed here
    // decide Markdown BLOCK STRUCTURE; content-matching regexes elsewhere in
    // the module (the `Selected Git policy:` line, § reference trimming) use
    // `\s` correctly and are not in scope.
    // ⚠⚠ THE ONE COPY OF "WHAT THE CLASS GUARD COVERS". Two separate checks read
    // this — the source-level whitespace ban immediately below, and the
    // invisible-character pin registry near the end of this test — and they must
    // cover exactly the same set or the guard's coverage claim is two different
    // claims. Declared out here so neither can drift from the other.
    const guardedConstructs = {
      blockFunctions: [
        'isThematicBreak', 'parseAtxHeading', 'stripSpaceTab', 'blankFencedBlocks',
        'htmlBlockStart', 'stripNestedContainerOpeners', 'nestedRawHtmlContext',
        'nestedParagraphOpens', 'nestedContainerContext',
        'indentWidth', 'listContentColumn', 'stringIndexAtVisualColumn', 'classifyLines',
        'extractHeadings', 'extractH2Headings', 'unclosedHtmlBlockLine',
        'classifiedVisible', 'visibleTextLines', 'maskCodeBlocks'
      ],
      blockConstants: [
        'LINE_SPLIT_RE', 'FENCE_MARKER', 'FENCE_OPEN_RE', 'FENCE_CLOSE_RE',
        'ATX_HEADING_RE', 'TABLE_DELIMITER_ROW_RE', 'HTML_BLOCK_TYPES',
        'HTML_TYPE1_INVISIBLE_TAGS',
        // PROPOSAL-084 / `p084-xv8`. The type-1 tag names, named out of
        // `HTML_BLOCK_TYPES` for the same reason `HTML_COMMENT_OPEN_RE` was: the
        // type-7 detector needs the same list (§4.6 excludes these names from
        // type 7) and a third copy is how the two inside `HTML_BLOCK_TYPES`
        // drifted from the detector in the first place. Guarded because they are
        // still a block rule — they decide what opens a type-1 block.
        'HTML_TYPE1_TAGS', 'HTML_TYPE1_NAME_RE',
        'HTML_BLOCK_TAGS', 'HTML_BLOCK_TYPE6_RE', 'BULLET_MARKER', 'ORDERED_DELIM',
        'ORDERED_MARKER', 'LIST_ITEM_RE', 'EMPTY_LIST_ITEM_RE', 'INTERRUPTING_ITEM_RE',
        'LIST_ITEM_PREFIX_RE', 'BLOCKQUOTE_RE', 'SETEXT_UNDERLINE_RE', 'BLANK_LINE_RE',
        // PROPOSAL-084 named it out of HTML_BLOCK_TYPES so the uncertainty
        // detector could read the opener instead of writing a second copy of it.
        // Guarded because it is still a block rule; the type-2 entry it composes
        // into is unchanged.
        'HTML_COMMENT_OPEN_RE'
      ]
    };

    {
      const source = await readFile(join(repoRoot, 'lib/doctor-checks.js'), 'utf8');

      // A declaration's full text with comments stripped — used for BOTH
      // functions and constants.
      //
      // ⚠ The constant half used to read only the declaration's FIRST LINE
      // (`source.split('\n').find((l) => l.startsWith('const X ='))`). That is a
      // vacuous pass for any multi-line constant, and the debt-12 rewrite added
      // one: `HTML_BLOCK_TYPES` is an array of regex pairs whose first line is
      // just `const HTML_BLOCK_TYPES = [`, so every pattern inside it would have
      // gone unchecked while the guard reported success. Slicing to the next
      // top-level declaration is what the function half already did.
      // `kind` is 'function' or 'decl'; `name` is a plain identifier, so nothing
      // needs escaping.
      //
      // ⚠ Anchored to the START OF A LINE, not `source.indexOf`. The plain
      // indexOf found the FIRST textual occurrence, so one comment line
      // mentioning the declaration above it — `// ref: const X = the rule` —
      // made the guard read the comment and report clean while the real
      // declaration below carried the banned class. Demonstrated by a reviewer,
      // not hypothesised.
      // ⚠ `const|let|var` for the same reason the census below matches all
      // three: pinning on `const` alone let a `let` declaration escape.
      const declRegion = (kind, name) => {
        // ⚠ `\s*=`, not ` =`. Requiring exactly one space let `const NAME=/…/`
        // slip past — a reviewer defeated the guard with it by putting a literal
        // `\s` in a block-structure regex declared that way. Whitespace around
        // `=` is a formatting choice, so a check that depends on it is a check
        // an autoformatter can switch off.
        const pattern = kind === 'function' ? `function ${name}\\(` : `(?:const|let|var) ${name}\\s*=`;
        const m = source.match(new RegExp(`^${pattern}`, 'm'));
        assert.ok(m, `class guard cannot find ${kind} ${name} at the start of a line — renaming means updating its list`);
        const start = m.index;
        const rest = source.slice(start + 1);
        const next = rest.search(/\nfunction |\nconst [A-Za-z_]/);
        // ⚠ Comments must be stripped, and the first version of this guard did
        // not: it read the prose EXPLAINING the rule as a violation of it, and
        // the slice also runs up to the next declaration, so it swallows that
        // declaration's leading comment block. A guard that fires on its own
        // documentation gets weakened or deleted by the next maintainer, which
        // is worse than not having it.
        // The `// ` strip assumes no regex literal here contains a slash-slash
        // followed by a space; asserted below rather than assumed.
        return (next === -1 ? rest : rest.slice(0, next))
          .split('\n')
          .filter((l) => !l.trim().startsWith('//'))
          .map((l) => l.replace(/\/\/ .*$/, ''))
          .join('\n');
      };

      const assertTightWhitespace = (label, body) => {
        assert.ok(
          !body.includes('\\s'),
          `${label} contains \\s. CommonMark means space-or-tab here; \\s also matches U+00A0, form feed and vertical tab, which is the one defect class this module keeps producing. Use [ \\t].`
        );
        // `[^\S\r\n]` is `\s` minus line terminators — still NBSP, form feed and
        // vertical tab, so it reintroduces the exact defect while reading as a
        // deliberate narrowing. A reviewer defeated the first version of this
        // guard with it (`p082-b3-g5` finding 5).
        assert.ok(
          !body.includes('[^\\S'),
          `${label} uses a negated \\S class, which still matches NBSP / form feed / vertical tab — the very characters this guard exists to keep out. Use [ \\t].`
        );
        // ⚠⚠ `.trim()` IS THIS DEFECT CLASS IN A DIFFERENT SPELLING, and the
        // guard was blind to it for a whole round. JS `.trim()` strips exactly
        // the set the two checks above ban — U+00A0, form feed, vertical tab,
        // U+2000-200B, U+FEFF — while containing no `\s` and no `[^\S` for them
        // to match. `classifyLines` tested blankness with `!line.trim()`, so a
        // line holding only a non-breaking space was blank here and a paragraph
        // to CommonMark: the section ran on and a stale file reported `current`.
        // Silent pass. Use `BLANK_LINE_RE` for blankness and `stripSpaceTab`
        // for trimming; both spell the rule as `[ \t]` in one place.
        assert.ok(
          !body.includes('.trim('),
          `${label} calls .trim(), which strips U+00A0 / form feed / vertical tab / U+2000-200B — the same characters \\s does, and the same defect class. Use BLANK_LINE_RE to test blankness or stripSpaceTab to trim.`
        );
        // ⚠⚠ NAMING THE CHARACTERS DIRECTLY IS THE FOURTH SPELLING, and a
        // reviewer defeated the first three bans with it: an escape class
        // `/[ \f\v]+$/` inside `isThematicBreak` contains no `\s`, no
        // `[^\S`, no `.trim(` and no literal invisible character, and it made a
        // `---<NBSP>` line a thematic break — so a section that should have
        // ended ran on and a stale file reported `current`. Silent pass, with
        // the whole suite green.
        //
        // ⚠ Be honest about what this adds. It bans one more SPELLING. The guard
        // is a lint over literal substrings; it cannot see semantics, and a
        // determined edit can still express "treat U+00A0 as whitespace" some
        // way none of these four name. What actually caught that reviewer's
        // earlier drafts was the BEHAVIOURAL pins below, not this block.
        //
        // ⚠⚠ AND THAT WARNING WAS THEN PROVED, TWICE, BY THE NEXT TWO ROUNDS.
        // A fifth reviewer defeated the list with `String.fromCharCode(0xa0)`,
        // and a sixth with the hex escape `\xa0` — one character, no `\s`, no
        // named escape, no literal invisible byte, suite green, silent pass.
        // `\xa0` is added below for the cheaper error message it produces, NOT
        // as the fix: the list is now eight members and a ninth spelling exists
        // (`\u{a0}`, a code-point `Set`, `new RegExp` from parts, a
        // normalisation table). Extending it one member per defeat is a constant
        // rate, not convergence — a reviewer measured exactly that.
        // **The layer that actually holds this class shut is the pin registry
        // near the end of this file**, which requires every construct the guard
        // names to have a block-start invisible-character pin and fails when one
        // does not. A pin does not care how the whitespace test was spelled.
        for (const esc of ['\\u00a0', '\\u00A0', '\\xa0', '\\xA0', '\\f', '\\v', '\\u2007', '\\ufeff', '\\uFEFF']) {
          assert.ok(
            !body.includes(esc),
            `${label} names ${esc} directly. Block structure must not special-case an invisible character: to CommonMark it is ordinary text, and treating it as whitespace is this module's one recurring defect however it is spelled.`
          );
        }
      };

      // Everything that participates in deciding block structure. The function
      // list is far shorter than the five predicates it replaced, because
      // `classifyLines` is now the only thing that decides anything — but the
      // CONSTANT list grew, and a constant carries the defect just as well as a
      // function does.
      // ⚠ Declared in the ENCLOSING scope (`guardedConstructs`), not here. The
      // invisible-character pin registry further down asserts that every name in
      // these two lists is either pinned or explicitly excused, and a second copy
      // of the lists for it to read would be two expressions for one rule — the
      // defect class this whole file exists to hold shut.
      const { blockFunctions, blockConstants } = guardedConstructs;
      for (const name of blockFunctions) assertTightWhitespace(name, declRegion('function', name));
      for (const name of blockConstants) assertTightWhitespace(name, declRegion('decl', name));

      // The other hole the reviewer demonstrated: both lists are hand-written,
      // so a NEW block-structure declaration is simply not checked. Assert that
      // the file's function set and its top-level constant set are each exactly
      // (guarded + a known non-block allowlist), which turns "someone added one"
      // into a failing test rather than an invisible gap.
      //
      // ⚠ The constant half of this is new. Previously only functions were
      // checked for completeness, so a new block CONSTANT carrying `\s` was
      // invisible in two independent ways at once — unlisted, and (if listed)
      // read one line deep.
      {
        // ⚠⚠ THE CENSUS'S COVERAGE IS THE LOAD-BEARING HALF, and `^function name(` is
        // not the only spelling (`p084-y2` finding 8). Measured missed by the old
        // pattern: `async function`, `function*`, `class X {`, and
        // `exports.x =` / `module.exports.x =`. Three earlier defeats of this guard
        // were all "the census failed to SEE a declaration", never "judged it
        // wrongly" — so widen the spelling, do not narrow it.
        // ⚠⚠⚠ AND THE REPAIR FOR THAT FINDING WAS ITSELF DEFEATED, BY A BYTE NOBODY
        // COULD SEE (`p084-sol2` finding 2). The class branch was written `\b` and
        // what landed in the file was a literal **U+0008 backspace**, so the pattern
        // demanded a control character after the class name and could never match —
        // `class Reader {` went unseen while the suite stayed green and the comment
        // above went on claiming the gap was closed. It survived a review round.
        // Two things follow, and the second is the general one:
        //   - An editor, a diff and `Read` all render U+0008 as nothing. `cat -A`
        //     shows it as `^H`; a scan for C0 bytes finds it. There is now exactly
        //     zero of them in this file — **if you add one, this comment is wrong.**
        //   - **A guard that is silently dead looks exactly like a guard that
        //     passes.** Widening a census is not done when the regex is edited; it
        //     is done when a fixture proving each new spelling MATCHES has been run.
        // ⚠⚠⚠⚠ AND THE WIDENED VERSION STILL HAD FIVE HOLES (`p084-sol3` finding 5):
        // `async(x) =>`, `async()=>1`, `(x = fn()) =>`, `exports['x'] =`, and
        // `= class {}`. Every one of them lived in the same place — the clause that
        // tried to decide whether the RIGHT-HAND SIDE was function-shaped.
        // **So that clause is gone rather than patched a fourth time**, which is this
        // repo's own rule about a check rewritten three times.
        // Two facts made the deletion free and correct:
        //   - `lib/doctor-checks.js` contains **zero** `exports.x =` statements (it
        //     exports one `module.exports = { … }` object), so the RHS clause was
        //     protecting nothing today while carrying five ways to under-cover
        //     tomorrow.
        //   - Over-inclusion is the SAFE direction: a name the census invents must be
        //     classified by a human in `nonBlockFns`, which is the failure mode this
        //     guard wants. Under-inclusion is invisible — and invisible is how all of
        //     `p084-y2` F8, `p084-sol2` F2 and this finding happened.
        // An aliased export (`exports.pred = somePredicate`) is now counted too, which
        // the RHS clause had also been dropping.
        //
        // ⚠ SPELLED ONCE, read by both the live scan and the fixture table below that
        // proves each spelling is actually seen. A fixture carrying its own copy of
        // these expressions would prove nothing about the census — two expressions for
        // one rule is this file's own named defect class.
        const DECLARATION_CENSUS = [
          /^(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_]+)\s*\(/gm,
          /^class\s+([A-Za-z0-9_]+)\b/gm,
          // No RHS test, deliberately — see above. `m[2]` is the bracket form.
          /^(?:module\.)?exports(?:\.([A-Za-z0-9_$]+)|\[\s*['"]([^'"]+)['"]\s*\])\s*=/gm
        ];
        const censusNames = (text) =>
          DECLARATION_CENSUS.flatMap((re) => [...text.matchAll(re)]).map((m) => m[1] || m[2]);

        // --- The fixture that makes "widened" mean something -------------------
        // ⚠ `p084-sol3` finding 5's other half: the comment above claimed fixtures
        // proved each spelling, and no committed fixture existed — the claim rested
        // on one manual check. **Widening a census is not done when the regex is
        // edited; it is done when a fixture proving each new spelling MATCHES has
        // been run.** Every row below that names a round is a spelling that was
        // silently missed at some point.
        const CENSUS_MUST_SEE = [
          ['function plainFn(a) {}', 'plainFn'],
          ['async function asyncFn(a) {}', 'asyncFn'],
          ['function* genFn(a) {}', 'genFn'],
          ['async function* asyncGenFn(a) {}', 'asyncGenFn'],
          ['class Reader {', 'Reader'],                                  // y2 F8, dead until sol2 F2
          ['exports.fromFunction = function () {};', 'fromFunction'],
          ['module.exports.fromModuleFn = function () {};', 'fromModuleFn'],
          ['exports.fromArrow = (a) => a;', 'fromArrow'],
          ['exports.fromBareArrow = a => a;', 'fromBareArrow'],
          ['exports.fromAsyncArrow = async (a) => a;', 'fromAsyncArrow'],
          ['exports.fromTightAsync = async(x) => x;', 'fromTightAsync'],  // sol3 F5
          ['exports.fromTightAsyncNoArg = async()=>1;', 'fromTightAsyncNoArg'], // sol3 F5
          ['exports.fromDefaultParam = (x = fn()) => x;', 'fromDefaultParam'],  // sol3 F5
          ["exports['fromBracket'] = (x) => x;", 'fromBracket'],          // sol3 F5
          ['exports.fromClassExpr = class {};', 'fromClassExpr'],         // sol3 F5
          ['exports.fromAlias = somePredicate;', 'fromAlias']             // dropped by the old RHS clause
        ];
        for (const [line, expected] of CENSUS_MUST_SEE) {
          assert.ok(
            censusNames(line).includes(expected),
            `the declaration census does not see \`${line}\` — a spelling it cannot see is a ` +
              `construct that can be added to lib/doctor-checks.js without ever being classified`
          );
        }
        // Negatives. Kept few and obvious on purpose: over-inclusion is safe here, so
        // a long negative list would be pinning behaviour the guard does not need and
        // would make future widening look like a regression.
        for (const line of ['  function indentedHelper(a) {}', '// function commentedOut(a) {}']) {
          assert.equal(
            censusNames(line).length, 0,
            `the census matched \`${line}\` — it is anchored at column 0 on purpose, ` +
              'because only top-level declarations can be block-deciding constructs'
          );
        }
        // ⚠ The census's own file must stay free of C0 control characters, because
        // that is how the `class` branch died invisibly (`p084-sol2` finding 2): a
        // literal U+0008 where `\b` was meant, rendered as nothing by every editor,
        // diff and file reader, under a comment asserting the gap was closed.
        // ⚠ Scans the TEST file as well as the module: the byte that killed the
        // census lived in the test, so scanning only the thing under test would have
        // missed it exactly where it happened.
        for (const rel of ['test/upgrade-drift.mjs', 'lib/doctor-checks.js']) {
          const text = await readFile(join(repoRoot, ...rel.split('/')), 'utf8');
          const c0 = [...text].filter((ch) => ch.charCodeAt(0) < 32 && !'\n\r\t'.includes(ch));
          assert.equal(
            c0.length, 0,
            `${rel} contains ${c0.length} C0 control character(s) ` +
              `(${c0.map((ch) => 'U+' + ch.charCodeAt(0).toString(16).padStart(4, '0')).join(', ')}) — ` +
              'one of these silently killed this very census once; they are invisible in every editor'
          );
        }

        const declaredFns = censusNames(source);
        const nonBlockFns = [
          'parseContextLine', 'extractSectionRefs', 'normalizeHeading', 'headingResolves',
          'missingTemplateSections', 'matchesTemplateWithPlaceholders', 'escapeRegExp',
          'hasTableWithoutConventionComment', 'headingKey', 'conventionsSectionBodies',
          'conventionsSectionBody', 'normalizeForMarker', 'fingerprintAppliesTo',
          'findConventionsDrift',
          // PROPOSAL-084 uncertainty detectors. Classified as NON-block
          // deliberately, and the distinction is the one the guard actually asks
          // about: these report whether a SHAPE is present, and nothing in the
          // module consumes their output to decide where a block starts or ends.
          // `classifyLines` remains the only thing that decides anything.
          // ⚠ The failure direction if one of them is wrong is a noisy or missing
          // WARNING, never a mis-parsed document — which is why the tight-
          // whitespace rule is not the right instrument for them. They are pinned
          // behaviourally instead (positive shape + false-positive control per
          // detector) further down this file.
          // ⚠ The one block rule any of them needs — what a comment-block opener
          // looks like — is READ from `HTML_COMMENT_OPEN_RE`, which is guarded,
          // rather than restated here. That was a real correction, not a
          // formality: the first draft hand-wrote the regex a second time.
          'codeSpanMask', 'commentOpenersOutsideCode', 'inlineHtmlCommentLine',
          'containerHtmlCommentLine', 'commentContext', 'startsContent',
          // ⚠ `commentDisposition` READS the classification (type, invisible,
          // visibleFrom) to decide which uncertainty id owns a line. It never
          // decides where a block begins or ends, and nothing consumes it for that
          // — `classifyLines` remains the only thing that decides anything. It is
          // the single point that partitions the comment shapes, which is why the
          // two exported detectors are views over it rather than rival predicates.
          'commentDisposition',
          // ⚠ `inUnparsedContainer` READS the classification label and nothing
          // else. It is the single answer to "is this line inside a container
          // whose interior is not parsed", shared by the comment ids and the two
          // boundary ids — which had each restated their own version until
          // `p084-xv3` found them disagreeing about `<details>`. Non-block for the
          // same reason `commentDisposition` is: `classifyLines` has already
          // decided, this only consumes the label, and being wrong here makes a
          // warning noisy or absent rather than moving a boundary.
          'inUnparsedContainer',
          'htmlBlockType7Line'
        ];
        const strayFns = declaredFns.filter((n) => !blockFunctions.includes(n) && !nonBlockFns.includes(n));
        assert.deepEqual(
          strayFns,
          [],
          `new function(s) in lib/doctor-checks.js are not classified by the class guard: ${strayFns.join(', ')}. If it decides Markdown block structure, add it to blockFunctions; if not, add it to the allowlist. Do not skip this — an unlisted block predicate is exactly how this defect class survived four review rounds.`
        );

        // ⚠ `[A-Za-z_0-9]`, not `[A-Z_0-9]`. SCREAMING_CASE only meant a
        // camelCase top-level declaration was invisible to BOTH the completeness
        // assertion and (being absent from `blockConstants`) the whitespace
        // check. A reviewer defeated the guard with exactly that: a
        // `const isIndentedCode = (line) => /^(\t|\s{4,})/...` arrow function,
        // pointed at by branch 7, reintroducing the class with the suite green.
        // ⚠ `const|let|var`, not `const` alone. A reviewer defeated the census a
        // second way: `let TRAILING_INVISIBLES_RE = /[\s]+$/;` at top level put
        // the banned class literally in the file while being invisible to a
        // `^const` scan — unlisted, so `assertTightWhitespace` was never called
        // on it either. Suite green, silent pass restored.
        // ⚠ `\s*=`, not ` =`. A THIRD defeat came through the same census by
        // dropping the space: `const THEMATIC_SEPARATOR_RE=/^ {0,3}(-[\s]*){3,}$/;`
        // is invisible to a census that requires one — unlisted, so never
        // whitespace-checked, with a literal `\s` sitting in a block-structure
        // regex and the suite green. Three defeats, all of them the census
        // failing to SEE a declaration rather than judging it wrongly: the
        // census's coverage is the load-bearing half, so keep it maximally
        // permissive about spelling.
        const declaredConsts = [...source.matchAll(/^(?:const|let|var) ([A-Za-z_0-9]+)\s*=/gm)].map((m) => m[1]);
        const nonBlockConsts = [
          'GIT_POLICY_LINE_RE', 'AI_COMMIT_MARKER_LINE_RE', 'PROSE_LANGUAGE_LINE_RE',
          'TECH_STACK_ROW_RE', 'MIGRATION_CONTEXT_ROW_RE', 'GIT_POLICY_VALUES',
          'AI_COMMIT_MARKER_VALUES', 'SPEC_FORMATTING_CONVENTION_SNIPPET',
          'CONVENTIONS_FINGERPRINTS', 'CONVENTIONS_RETIRED',
          // PROPOSAL-084. Describes a tag shape for the type-7 DETECTOR only; it
          // is never read while classifying, so an invisible character in it can
          // make a warning noisy or absent but cannot move a block boundary.
          // Kept out of `blockConstants` for that reason — putting it there would
          // claim the guard covers a decision this constant does not make.
          'BARE_TAG_LINE_RE',
          // PROPOSAL-084 / `p084-xv6`. The tag-name fragment `BARE_TAG_LINE_RE` is
          // built from, so the open-tag and closing-tag branches can carry the
          // different tails the spec gives them without the name shape being
          // written twice. Detector-only, like the regex it feeds.
          'BARE_TAG_NAME',
          // PROPOSAL-084 / `p084-xv7`. CommonMark's raw-HTML attribute productions,
          // transcribed so the open-tag branch stops being an approximation that
          // forbids `>` inside a quoted value. Detector-only: they are read to
          // decide whether to WARN about a shape, never to classify a line.
          'HTML_ATTR_NAME', 'HTML_ATTR_VALUE', 'HTML_ATTR',
          // PROPOSAL-084. Answers "does this line's content start here", used only
          // to pick WHICH uncertainty id to report — never to decide a boundary.
          // It is built from `BULLET_MARKER` / `ORDERED_MARKER` rather than
          // restating them, so widening a list marker reaches it automatically.
          'CONTAINER_PREFIX_ONLY_RE',
          // PROPOSAL-084 / `p084-xv3`. The container-type list, spelled once and
          // read by `inUnparsedContainer`. It holds classification LABELS that
          // `classifyLines` already produced — no whitespace class, no opener
          // shape — so it cannot carry the invisible-character defect the tight-
          // whitespace rule exists for, and it decides no boundary.
          'UNPARSED_CONTAINER_TYPES',
        ];
        const strayConsts = declaredConsts.filter((n) => !blockConstants.includes(n) && !nonBlockConsts.includes(n));
        assert.deepEqual(
          strayConsts,
          [],
          `new top-level constant(s) in lib/doctor-checks.js are not classified by the class guard: ${strayConsts.join(', ')}. If it is read while deciding Markdown block structure, add it to blockConstants; if not, add it to the allowlist.`
        );
      }
      // The comment-stripping assumption above, asserted rather than trusted:
      // if a regex literal in this module ever contains `// `, the strip would
      // silently cut a real expression short and the guard would go blind on
      // the rest of that line — a false all-clear, which is the failure mode
      // this repo has paid for twice.
      for (const line of source.split('\n')) {
        if (line.trim().startsWith('//')) continue;
        assert.ok(
          !/\/[^\n]*\/\/ [^\n]*\//.test(line),
          `a regex literal on this line may contain "// ", which would blind the class guard: ${line.trim()}`
        );
      }

      // No literal invisible character may sit in the module's own source.
      // `lib/doctor-checks.js` used to demonstrate the U+00A0 defect with a REAL
      // U+00A0 inside the comment warning about it — indistinguishable from a
      // space in a diff, and an editor may normalize it away silently. This file
      // builds such characters with `String.fromCharCode` for that reason; the
      // module now has to earn the same claim rather than assert it in prose.
      for (const [i, line] of source.split('\n').entries()) {
        for (const ch of line) {
          const cp = ch.codePointAt(0);
          // ⚠ `cp === 0` ADDED after `p084-xv1` found a literal NUL sitting in this
          // module — inside a `.replace()` argument that was meant to be a space,
          // where it silently changed the answer of the since-removed table
          // cell counter for a cell
          // holding only an escaped pipe (a space trims to empty and is dropped;
          // NUL is not whitespace to JS and is not). The list above was written
          // about characters that masquerade as SPACES, so it never considered the
          // one that masquerades as nothing at all — and the cost is bigger than
          // the arithmetic: `rg` stops reading a file as text at the first NUL, so
          // every grep-based guard and every reviewer searching this module goes
          // quiet from that offset on. ⚠ Two probes disagreed about whether it was
          // there (`cat -A` said yes, `grep -P '\x00'` said no); the byte-level
          // read settled it. Do not trust a grep to find this.
          assert.ok(
            !(cp === 0 || cp === 0xa0 || cp === 0x0b || cp === 0x0c || (cp >= 0x2000 && cp <= 0x200b) || cp === 0xfeff),
            `lib/doctor-checks.js:${i + 1} contains a literal U+${cp.toString(16).toUpperCase().padStart(4, '0')}. Write it with String.fromCharCode, or delete it — an invisible character in the source of the module that exists to get invisible characters right is not a joke anyone catches twice.`
          );
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // THE BLOCK CLASSIFICATION PASS (debt 12). What the rewrite made true that
    // was not true before — each of these FAILS against the five-predicate
    // version, which is the only reason to have them.
    {
      const SENT = 'SENTINEL-MARKER-LINE';
      const bodyOf = (lines, heading = 'Target Section') => {
        const doc = ['## Target Section', '', ...lines, '', '## Next Section', ''].join('\n');
        return doctorChecks.conventionsSectionBodies(doc, heading);
      };

      // ⚠⚠ EVERY SHAPE BELOW ENDS `--- / blank / SENTINEL`, AND THE `---` IS THE
      // LOAD-BEARING PART. The first draft of these pins left it out and every
      // one of them PASSED against the pre-rewrite module — they asserted
      // something true of the buggy code and would never have failed. The defect
      // only appears when a setext-capable line follows the block: the old
      // `closesOwnBlock` recognized single-line comments only, so after an
      // unclosed block the `---` was read as a setext underline, the section
      // ended early, and the pop deleted the content line. Verified: each shape
      // here yields `false` on `HEAD:lib/doctor-checks.js` and `true` now.
      // A pin that passes on the code it is meant to indict pins nothing.
      const keepsSentinel = (block) => {
        const bodies = bodyOf([...block, '---', '', SENT]);
        assert.equal(bodies.length, 1, `expected one body for ${JSON.stringify(block)}`);
        return bodies[0].includes(SENT);
      };

      // (a) MULTILINE HTML COMMENTS — `p082-b3-g5` finding 4, the defect that
      // could not be patched per-line and so forced the rewrite. The old code
      // opened an HTML block on any `<!--` but only ever closed a SINGLE-LINE
      // comment, so the walker stopped inside the comment and dropped the line
      // after it: content-loss direction, and `findConventionsDrift` reported
      // `stale` against a file that was current.
      {
        assert.ok(
          keepsSentinel(['<!-- a note that runs', 'across two lines -->', '2. the cascade result is a floor']),
          'a multiline HTML comment must not swallow the content after it'
        );
        const doc = [
          '## Ceremony Scaling (Project Application)', '',
          '<!-- a note that runs', 'across two lines -->',
          '2. the cascade result is a floor', '---', ''
        ].join('\n');
        assert.deepEqual(
          doctorChecks.findConventionsDrift(doc).filter((d) => d.id === 'ceremony-escalate-only'),
          [],
          'the rule is present, so nothing may be reported for it'
        );
      }

      // (c) The other HTML block types, each closing by its OWN rule rather than
      // by the single rule the old code knew. Types 1-5 close on the line
      // matching their end condition; type 6 closes at a blank line.
      for (const [label, block] of [
        ['type 1 script', ['<script>', 'var x = 1;', '</script>']],
        ['type 2 comment', ['<!-- one', 'two -->']],
        ['type 3 processing instruction', ['<?php', '?>']],
        ['type 4 declaration', ['<!DOCTYPE', 'html>']],
        ['type 5 CDATA', ['<![CDATA[', 'x]]>']],
        ['type 6 known tag', ['<div>']]
      ]) {
        assert.ok(keepsSentinel(block), `${label}: the block must end and let the following line through`);
      }

      // Type 1 closes on the tag that OPENED it. A shared four-name end regex
      // lets a mismatched closer expose content that Marked keeps inside the raw
      // block. Exercise the full 4x4 identity matrix in both disclosure modes:
      // pre/textarea content is read and must warn; script/style content is
      // already invisible and must stay excluded from every downstream check.
      {
        const tags = ['script', 'pre', 'style', 'textarea'];
        for (const opener of tags) {
          for (const closer of tags) {
            const md = `# H\n\n<${opener}>\n</${closer}>\n\\<!-- HIDDEN-CANARY -->\n</${opener}>\n`;
            const info = doctorChecks.classifyLines(md.split(/\r?\n/));
            assert.equal(info[3].type, 'html', `${opener}/${closer}: the apparent closer line still belongs to the raw block`);
            assert.equal(
              info[4].type,
              opener === closer ? 'paragraph' : 'html',
              `${opener}/${closer}: only the opener's own closing tag may expose the following line`
            );
            const reports = doctorChecks.inlineHtmlCommentLine(md) !== -1
              || doctorChecks.containerHtmlCommentLine(md) !== -1;
            assert.equal(
              reports,
              opener !== closer && (opener === 'pre' || opener === 'textarea'),
              `${opener}/${closer}: disclosure follows Marked's matching-tag boundary and the block's visibility mode`
            );
            if (opener !== closer && (opener === 'script' || opener === 'style')) {
              assert.ok(
                !doctorChecks.visibleTextLines(md).join('\n').includes('HIDDEN-CANARY'),
                `${opener}/${closer}: a mismatched closer must not leak invisible script/style content into checks`
              );
            }
          }
        }
      }

      // (b) REGRESSION GUARD, NOT A BEHAVIOUR PIN — and labelled so nobody
      // counts it as evidence for the rewrite. This passes on the old code too,
      // because the old code had no HTML block state to get wrong. It is here
      // because the FIRST version of `classifyLines` omitted the "end condition
      // is checked on the opening line" rule, so `<!-- Seeded by Dflow. -->` at
      // the head of every packaged template opened a block that never closed and
      // erased every heading in the file.
      assert.deepEqual(
        doctorChecks.extractHeadings('<!-- Seeded by Dflow. -->\n\n## After The Comment\n'),
        ['After The Comment'],
        'a single-line HTML comment closes on its own line'
      );

      // (d) SETEXT HEADING TEXT IS THE WHOLE PARAGRAPH. The old code took
      // `lines[i-1]` as the text and popped exactly one line, so a soft-wrapped
      // setext heading matched under its last line only and left its earlier
      // lines in the previous section's body as if they were content.
      {
        const info = doctorChecks.classifyLines(['Ceremony Scaling', '(Project Application)', '===']);
        assert.deepEqual(
          info[2].heading,
          { level: 1, text: 'Ceremony Scaling (Project Application)', setext: true, start: 0 },
          'a soft-wrapped setext heading carries its whole paragraph as text'
        );
        const doc = ['Ceremony Scaling', '(Project Application)', '---', '', 'body text', '', '## Next', ''].join('\n');
        assert.deepEqual(
          doctorChecks.conventionsSectionBodies(doc, 'Ceremony Scaling (Project Application)'),
          ['\nbody text\n'],
          'and the section is found under the joined text, with no heading line left in the body'
        );
      }

      // (e) EMPTY ATX HEADINGS. `## #` is the empty heading, not the heading
      // `#` — the lazy-capture backtracking divergence that the two-step
      // closing-sequence strip in `parseAtxHeading` fixed. The neighbouring
      // forms are pinned with it because they are what makes the fix a rule
      // rather than a special case.
      for (const [line, want] of [
        ['## #', ''],
        ['##', ''],
        ['## ', ''],
        ['## #####', ''],
        ['## Git Policy #', 'Git Policy'],
        ['## Git Policy#', 'Git Policy#'],
        ['## Git Policy ##', 'Git Policy']
      ]) {
        assert.deepEqual(
          doctorChecks.parseAtxHeading(line),
          { level: 2, text: want, setext: false },
          `${JSON.stringify(line)} is the heading ${JSON.stringify(want)}`
        );
      }
      // ...and an empty heading still resolves no cross-reference, because `''`
      // prefix-matches everything (`p082-b3-g5` finding 1). Making empty
      // headings real is what created that hazard; this is the pin that keeps
      // the two halves together.
      assert.equal(
        doctorChecks.headingResolves('Anything At All', doctorChecks.extractHeadings('## \n')),
        false,
        'an empty heading resolves nothing'
      );

      // (f) SETEXT HEADINGS ARE VISIBLE TO extractHeadings / extractH2Headings.
      // Neither ever saw one before, because each carried its own ATX-only
      // expression — so a `§ Heading` reference to a setext heading was reported
      // dangling and a template section written that way counted as missing.
      assert.deepEqual(
        doctorChecks.extractHeadings('Underlined H1\n===\n\nUnderlined H2\n---\n'),
        ['Underlined H1', 'Underlined H2'],
        'setext headings of both levels are headings'
      );
      assert.deepEqual(
        doctorChecks.extractH2Headings('Underlined H1\n===\n\nUnderlined H2\n---\n'),
        ['Underlined H2'],
        'and only the level-2 one is an H2'
      );

      // (h) LOOSE LISTS — a blank line does not end a list item whose content
      // continues indented. Found by probing the rewrite against the reference
      // BEFORE sending it to review, not by a round: the first version of
      // `classifyLines` closed every document-level block on a blank, so the
      // `---` below became a setext underline, the section ended early and the
      // walker popped the line carrying the rule. Content loss.
      //
      // ⚠ Lists and blockquotes are deliberately NOT symmetric, and the
      // asymmetry is measured, not reasoned: a blockquote really does end at a
      // blank line. Collapsing these two into one rule reintroduces one defect
      // or the other, so both directions are pinned here together.
      for (const [label, block, sectionEnds] of [
        ['list, blank, indented continuation', ['- a bullet', '', '  continuation'], false],
        ['ordered list, blank, indented', ['1. a step', '', '   continuation'], false],
        ['list, blank, deep indent', ['- a bullet', '', '        deep indent'], false],
        ['list, blank, UNindented', ['- a bullet', '', 'unindented'], true],
        ['blockquote, blank, indented', ['> quoted', '', '  continuation'], true],
        ['heading indented INSIDE a list item', ['- a bullet', '  ## Indented Heading'], false]
      ]) {
        assert.equal(
          !keepsSentinel(block),
          sectionEnds,
          `${label}: expected the section ${sectionEnds ? 'to END at the ---' : 'to CONTINUE past the ---'}`
        );
      }

      // (i) BLANKNESS IS SPACES AND TABS ONLY. `.trim()` strips U+00A0, form
      // feed, vertical tab and U+2000-200B, so `!line.trim()` made a line
      // holding only a non-breaking space a BLANK line here and a paragraph to
      // CommonMark. `para` / NBSP / `---` then read `---` as a thematic break
      // instead of a setext underline, the section ran on, and a stale
      // `_conventions.md` reported `current`. SILENT PASS — and invisible to the
      // class guard, because `.trim()` contains no `\s`. The guard now bans
      // `.trim(` in block code for exactly this reason.
      {
        const NBSP = String.fromCharCode(0xa0);
        assert.equal(
          doctorChecks.classifyLines([NBSP])[0].type,
          'paragraph',
          'a line holding only U+00A0 is a paragraph, not a blank line'
        );
        for (const [label, code] of [['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b]]) {
          assert.equal(
            doctorChecks.classifyLines([String.fromCharCode(code)])[0].type,
            'paragraph',
            `a line holding only ${label} is not blank`
          );
        }
        for (const [label, code] of [['space', 0x20], ['tab', 0x09]]) {
          assert.equal(
            doctorChecks.classifyLines([String.fromCharCode(code)])[0].type,
            'blank',
            `a line holding only a ${label} IS blank`
          );
        }
        // End to end, in the direction that matters: the rule is present, in a
        // section an NBSP line used to run past.
        const doc = [
          '## Ceremony Scaling (Project Application)', '',
          'Our project rows are below.', NBSP, '---', '',
          'The cascade result is a floor here.', '',
          '## Filling the Templates', ''
        ].join('\n');
        assert.ok(
          doctorChecks.findConventionsDrift(doc).some((d) => d.id === 'ceremony-escalate-only'),
          'the marker sits in a LATER section, so this file is stale and must be reported — the NBSP line must not merge the two sections'
        );
      }

      // (j) A TABLE HEADER NEED NOT BE ITS PARAGRAPH'S FIRST LINE. Requiring it
      // (`open.start === i - 1`) was a regression against the predicate this
      // pass replaced: one intro sentence above a table made the whole run a
      // single paragraph, so a following `---` became a setext underline and the
      // pop deleted the ENTIRE section body. Total content loss.
      {
        const doc = ['## T', '', 'Our rows:', '| Situation | Tier |', '|---|---|', '| X | T1 |', '---', '', 'ZQZ', '', '## N', ''].join('\n');
        const bodies = doctorChecks.conventionsSectionBodies(doc, 'T');
        assert.equal(bodies.length, 1, 'intro-then-table: expected one body');
        assert.ok(bodies[0].includes('ZQZ'), 'an intro line above a table must not delete the section body');
        assert.equal(
          doctorChecks.hasTableWithoutConventionComment('Intro:\n| a | b |\n|---|---|\n'),
          true,
          'and the table is still detected when a line precedes its header'
        );
        // ⚠ NOT a defect, pinned so it is not "fixed" by a later round: with a
        // BARE `---` there is no delimiter row, so this really is a setext
        // heading. commonmark@0.31.2 and marked (GFM) both agree with us.
        assert.deepEqual(
          doctorChecks.extractH2Headings('Intro:\n| a | b |\n---\n'),
          ['Intro: | a | b |'],
          'a bare --- after pipe-bearing prose is a setext heading in BOTH parsers, not a phantom'
        );

        // ⚠⚠ THE HEADER ROW'S OWN INDENT. Widening the header rule opened a gap
        // the narrow rule had made unreachable: `TABLE_DELIMITER_ROW_RE` limits
        // the DELIMITER row to `^ {0,3}` but the header test was only
        // `.includes('|')`. A 4-column-indented header is indented code to
        // CommonMark and no table at all to GFM, yet we read a table, so the
        // `---` below stopped ending the section — SILENT PASS.
        //
        // ⚠ The pin directly above uses an UNindented header and therefore could
        // not tell the broken version from the fixed one. That was demonstrated,
        // not guessed: the fix passed the suite unchanged. A pin that cannot
        // fail against the defect it names is decoration.
        for (const indent of ['    ', '\t', '   \t', '        ']) {
          assert.ok(
            !keepsSentinel(['Our project rows are below.', `${indent}| Situation | Tier |`, '|---|---|']),
            `a header row indented to column 4+ (${JSON.stringify(indent)}) is indented code, not a table header, so --- still ends the section`
          );
        }
        // ...and the 0-3 space indents that ARE valid header rows still work.
        for (const indent of ['', ' ', '  ', '   ']) {
          assert.ok(
            keepsSentinel(['Our project rows are below.', `${indent}| Situation | Tier |`, '|---|---|', '| X | T1 |']),
            `a header row indented ${indent.length} spaces is still a table header`
          );
        }
      }

      // (l) INDENTED CODE IS DECIDED BY `indentWidth`, NOT A SECOND REGEX.
      // `INDENTED_CODE_RE = /^(\t| {4,})/` and `indentWidth` answered the same
      // question differently: a space then a tab is column 4, because a tab
      // advances to the next multiple of four. Both directions were measured, so
      // both are pinned.
      {
        const TAB = String.fromCharCode(0x09);
        // Direction A — content loss: ` \tprose` is indented code, so `---` is a
        // thematic break and the section continues. Read as a paragraph, `---`
        // became a setext underline and the pop deleted the body.
        assert.ok(
          keepsSentinel([` ${TAB}Our project rows are below.`]),
          'space-then-tab is indented code: the section continues past the ---'
        );
        // Direction B — silent pass: `   \t| a | b |` is indented code, so it is
        // not a table header and the section ends at the ---.
        assert.ok(
          !keepsSentinel([`   ${TAB}| Situation | Tier |`, '|---|---|']),
          'a space-and-tab indented pipe line is indented code, not a table header'
        );
        // The column arithmetic itself, pinned directly.
        for (const [line, want] of [[' \tx', 4], ['  \tx', 4], ['   \tx', 4], [`${TAB}x`, 4], ['   x', 3], ['    x', 4]]) {
          assert.equal(doctorChecks.classifyLines([line])[0].type, want >= 4 ? 'code' : 'paragraph',
            `${JSON.stringify(line)} sits at column ${want}`);
        }
      }

      // (j2) READER-INVISIBLE CONTENT. `classifyLines` decides what KIND a line
      // is; until `p082-b3-k1` no content extractor asked it whether the text it
      // was matching is text a reader ever sees. So a fingerprint marker inside
      // `<!-- … -->` counted as present and a stale file reported `current` —
      // silent pass, from one edit a person actually makes.
      //
      // ⚠ BOTH DIRECTIONS ARE PINNED, and the second is the one that matters:
      // "blank every html line" is the obvious over-reach, and it would delete
      // real convention prose out of a `<pre>` or a `<div>` — content loss. Type
      // 1 is the sharp case because `pre`/`textarea` and `script`/`style` share
      // one start condition and differ in whether their text renders.
      //
      // ⚠ Not an invisible-character pin: no widening of a whitespace class can
      // express "this type does not render", which is why `visibleTextLines` and
      // `HTML_TYPE1_INVISIBLE_TAGS` sit in NO_INVISIBLE_PIN with this block named
      // as what covers them. Each assertion below was verified to FAIL against
      // the module as it stood one commit earlier.
      {
        const RULE = 'cascade result is a floor';
        const visible = (lines) => doctorChecks.visibleTextLines(lines.join('\n')).join('\n');

        for (const [label, lines] of [
          ['a single-line comment', [`<!-- ${RULE} -->`]],
          ['a multi-line comment', ['<!--', RULE, '-->']],
          ['an unclosed comment', ['<!--', RULE]],
          ['a script block', ['<script>', RULE, '</script>']],
          ['a style block', ['<style>', RULE, '</style>']],
          ['a processing instruction', ['<?php', RULE, '?>']],
          ['a CDATA section', ['<![CDATA[', RULE, ']]>']],
          ['a declaration', [`<!DOCTYPE ${RULE}>`]]
        ]) {
          assert.ok(!visible(lines).includes(RULE), `${label} hides its text from a reader`);
        }

        for (const [label, lines] of [
          ['a div block', ['<div>', RULE, '</div>']],
          ['a pre block', ['<pre>', RULE, '</pre>']],
          ['a textarea block', ['<textarea>', RULE, '</textarea>']],
          ['ordinary prose', [RULE]],
          ['a table row', [`| ${RULE} |`]]
        ]) {
          assert.ok(visible(lines).includes(RULE), `${label} shows its text to a reader — blanking it would be content loss`);
        }

        // Blanked, never deleted: three consumers index by line.
        assert.equal(doctorChecks.visibleTextLines('a\n<!-- x -->\nb').length, 3, 'a blanked line is still a line');

        // And the three consumers the defect was reachable through, end to end.
        const doc = (body) => ['## Ceremony Scaling (Project Application)', '', body, '', '## Upstream Reference', ''].join('\n');
        const ceremony = (content) => doctorChecks.findConventionsDrift(content)
          .filter((d) => d.id === 'ceremony-escalate-only').map((d) => d.state);
        assert.deepEqual(ceremony(doc(`The ${RULE}: rows may only escalate.`)), [], 'a live rule is current');
        assert.deepEqual(ceremony(doc(`<!-- The ${RULE}: rows may only escalate. -->`)), ['stale'], 'a commented-out rule is ABSENT, not present');
        assert.equal(
          doctorChecks.parseContextLine('<!-- AI commit marker: `prefix` -->', doctorChecks.AI_COMMIT_MARKER_LINE_RE),
          null, 'a commented-out policy line is not the live setting'
        );
        assert.equal(
          doctorChecks.parseContextLine('AI commit marker: `prefix`', doctorChecks.AI_COMMIT_MARKER_LINE_RE),
          'prefix', 'the live policy line still parses'
        );
        assert.deepEqual(
          doctorChecks.extractSectionRefs('<!-- AI-AGENT-GUIDE.md § Nowhere -->', 'AI-AGENT-GUIDE.md'),
          [], 'a reference inside a comment is not a dangling reference'
        );
        // Routing parseContextLine through the projection would have converted a
        // caller's `undefined` into the text "undefined" and returned null —
        // "policy line absent", a finding about the user's file caused by a bug
        // in ours. It must still throw.
        assert.throws(() => doctorChecks.parseContextLine(undefined, doctorChecks.GIT_POLICY_LINE_RE), TypeError,
          'a non-string stays loud rather than becoming a silent "absent"');

        // ⚠ THE SPAN, NOT THE LINE. An end condition can leave rendered text
        // after it: `<!-- note --> rest` puts `rest` in the output. The first
        // version of the visibility rule blanked whole lines and so lost that
        // text — a retired string after a `-->` stopped being reported one
        // commit later (`p082-b3-k3` finding 2). SILENT PASS.
        assert.equal(
          doctorChecks.visibleTextLines('<!-- note --> tail text')[0].trimStart(), 'tail text',
          'text after a comment close is rendered, so it stays visible'
        );
        assert.equal(
          doctorChecks.visibleTextLines('<!-- note --> tail text')[0].length, '<!-- note --> tail text'.length,
          'the hidden span is masked to spaces, not deleted — extractSectionRefs compares column indices'
        );
        assert.equal(
          doctorChecks.visibleTextLines('<script>\nx\n</script> after')[2].trimStart(), 'after',
          'the same rule on a type-1 close'
        );
        assert.deepEqual(ceremony(doc(`x\n<!-- n --> The ${RULE}: rows may only escalate.`)), [],
          'a rule after a comment close is present, not absent');

        // ⚠ THE WRITE PATH. `configure-agents` finds its managed region by
        // string search and then SLICES the original by that index, so a marker
        // shown inside a fenced example was taken as a region boundary and the
        // user's example was overwritten (`p082-b3-k3` finding 1). USER CONTENT
        // LOSS. The mask must hide it while preserving every offset.
        {
          const S = '<!-- dflow-generated: agent-shim START -->';
          const fenced = ['# Guide', '', '```md', S, 'example KEEPME', '<!-- dflow-generated: agent-shim END -->', '```'].join('\n');
          const real = ['# Guide', '', S, 'generated', '<!-- dflow-generated: agent-shim END -->'].join('\n');
          const maskedFenced = doctorChecks.maskCodeBlocks(fenced);
          assert.ok(!maskedFenced.includes(S), 'a marker inside a fence is not a region boundary');
          assert.equal(maskedFenced.length, fenced.length, 'the mask preserves length, or every sliced index moves');
          const maskedReal = doctorChecks.maskCodeBlocks(real);
          assert.ok(maskedReal.includes(S), 'a real marker is still found');
          assert.equal(maskedReal.indexOf(S), real.indexOf(S), 'and still at the same index');
        }
        assert.equal(
          doctorChecks.extractSectionRefs('AI-AGENT-GUIDE.md § Nowhere', 'AI-AGENT-GUIDE.md').length,
          1, 'a live reference still resolves'
        );
      }

      // (k) ATX and setext heading text obey the SAME trimming rule. They did
      // not: ATX stripped `[ \t]` while setext called `.trim()`, so
      // `isRecognizableDflowGuide` rejected `# Title<NBSP>` and accepted
      // `Title<NBSP>` / `---` — the same title, two answers.
      // ⚠ Over the WHOLE character class, in BOTH positions. This pinned U+00A0
      // trailing only, while `lib/doctor-checks.js` claimed the divergence was
      // pinned "against every character the class covers" — naming one member of
      // a class and calling it the class, which is the same over-claim the
      // sentence it replaced was corrected for.
      {
        for (const [label, code] of [
          ['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b],
          ['en space', 0x2002], ['BOM', 0xfeff]
        ]) {
          const ch = String.fromCharCode(code);
          assert.equal(
            doctorChecks.parseAtxHeading(`## Project Context${ch}`).text,
            doctorChecks.classifyLines([`Project Context${ch}`, '---'])[1].heading.text,
            `the two heading kinds must trim a trailing ${label} identically`
          );
          assert.equal(
            doctorChecks.parseAtxHeading(`## ${ch}Project Context`).text,
            doctorChecks.classifyLines([`${ch}Project Context`, '---'])[1].heading.text,
            `the two heading kinds must trim a leading ${label} identically`
          );
        }
      }

      // (k2) ⚠⚠ THE HEADING-IDENTITY COMPARATOR IS DELIBERATELY TOLERANT, and
      // this pins that it stays so. `normalizeHeading` was once "fixed" to use
      // `stripSpaceTab` on the reasoning that one rule should have one spelling.
      // It is not one rule: `stripSpaceTab` decides what a heading's text IS
      // (block structure, strict, spec-following), while `normalizeHeading`
      // decides whether two heading strings NAME the same section — an identity
      // comparison over text a human retyped or pasted, which already strips
      // ``, `*` and `_` and folds case.
      //
      // What tightening it did, measured: a `_conventions.md` whose heading
      // carried a copy-pasted trailing U+00A0 reported `missing` — doctor
      // warning about a file that carries the rule. `CONVENTIONS_FINGERPRINTS`
      // records the same false `missing` happening once before for case, which
      // is why the comparison folds case; this is the whitespace repeat of it.
      //
      // ⚠ These pins are the reason the tolerance survives the next round. The
      // source-level class guard cannot express "this `.trim()` is correct" —
      // it is a lint over substrings — so without them the only thing standing
      // between a maintainer and re-breaking this is a comment.
      {
        const SECTION = 'Ceremony Scaling (Project Application)';
        for (const [label, code] of [
          ['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b],
          ['en space', 0x2002], ['BOM', 0xfeff]
        ]) {
          const ch = String.fromCharCode(code);
          for (const [position, heading] of [['trailing', `## ${SECTION}${ch}`], ['leading', `## ${ch}${SECTION}`]]) {
            const doc = [heading, '', 'the cascade result is a floor here', '', '## Next', ''].join('\n');
            assert.deepEqual(
              doctorChecks.findConventionsDrift(doc).filter((d) => d.id === 'ceremony-escalate-only'),
              [],
              `a heading carrying a ${position} ${label} still names its section — reporting it missing warns about a file that carries the rule`
            );
          }
        }
        // And the case rule the module states, at all three consumers of the one
        // normaliser rather than at whichever one a round happened to look at.
        const tpl = '## Filling the Templates\n\nbody\n';
        assert.deepEqual(doctorChecks.missingTemplateSections(tpl, '## filling the templates\n\nbody\n'), [],
          'a retyped-in-different-case heading is the same section to missingTemplateSections');
        assert.equal(doctorChecks.headingResolves('filling the templates', ['Filling the Templates']), true,
          '...and to headingResolves');
        assert.equal(doctorChecks.conventionsSectionBodies('## filling the templates\n\nbody\n', 'Filling the Templates').length, 1,
          '...and to conventionsSectionBodies, which is where the rule was already implemented');

        // ⚠ The case fold must be PREFIX-PRESERVING, because `headingResolves`
        // prefix-matches on it. `toLowerCase` is not: Greek capital sigma maps
        // to a final sigma at a word end and a medial one elsewhere, so `ΑΣ`
        // stopped resolving against `ΑΣΒΓ` and doctor reported a dangling
        // reference for one that resolves. The raw strings prefix-match, so
        // this is purely an artefact of the fold.
        const SIGMA = String.fromCharCode(0x391, 0x3a3);           // ΑΣ
        const SIGMA_LONG = String.fromCharCode(0x391, 0x3a3, 0x392, 0x393); // ΑΣΒΓ
        assert.equal(doctorChecks.headingResolves(SIGMA, [SIGMA_LONG]), true,
          'the case fold must preserve prefixes — a Greek capital sigma reference must still resolve');
        assert.equal(doctorChecks.headingResolves('workflow', ['Workflow Transparency']), true,
          '...while still doing the case-insensitive matching it was changed for');

        // ⚠ Counted, not a Set: a template with two H2s folding to one key is
        // not satisfied by one of them appearing. Latent on the packaged
        // template, which is why nothing else would catch it.
        const dupTpl = '## Filling the Templates\n\nb\n\n## FILLING THE TEMPLATES\n\nb\n';
        assert.deepEqual(
          doctorChecks.missingTemplateSections(dupTpl, '## Filling the Templates\n\nb\n'),
          ['FILLING THE TEMPLATES'],
          'one document heading cannot satisfy two template headings that fold to the same key'
        );

        // ⚠⚠ AN HTML BLOCK OPEN AT EOF MUST NOT LET A SECTION SWALLOW THE REST
        // OF THE FILE. This was a HIGH silent pass reachable with no module edit
        // at all: one `<!--` left unclosed mid-edit put every later section
        // inside that block, so `## Ceremony Scaling` reached a quoted copy of
        // the rule in an appendix and a genuinely stale file reported `current`.
        // Measured through the real doctor: closing the comment gave two
        // warnings, leaving it open gave none.
        //
        // All five block types that close only on their end condition, because
        // the first fix attempt would have covered `<!--` alone and this module
        // has been burned four times by fixing the instance a reviewer named
        // instead of the class.
        for (const opener of ['<!-- TODO', '<script>', '<![CDATA[', '<!x', '<?x']) {
          const doc = [
            '## Ceremony Scaling (Project Application)', '',
            opener, '',
            '## Upstream Reference', '',
            '**The cascade result is a floor: rows may only escalate a tier, never lower it.**', ''
          ].join('\n');
          const hit = doctorChecks.findConventionsDrift(doc).find((x) => x.id === 'ceremony-escalate-only');
          assert.equal(
            hit && hit.state, 'stale',
            `an unclosed ${opener} must not let the section reach text below it — the rule is genuinely absent from that section, so this file is stale`
          );
          assert.equal(
            doctorChecks.unclosedHtmlBlockLine(doc), 3,
            `and the user must be told where the unclosed ${opener} starts, or the resulting "stale" is correct and inexplicable`
          );
        }
        // The control: the same document with the block closed is unaffected.
        const closed = [
          '## Ceremony Scaling (Project Application)', '',
          '<!-- TODO -->', '',
          '**The cascade result is a floor: rows may only escalate a tier, never lower it.**', ''
        ].join('\n');
        // ⚠⚠ `indentWidth`'s TAB ARITHMETIC, which no check covered. CommonMark
        // 2.2: a tab advances to the next multiple of four, so `col += 4 - (col
        // % 4)`. A reviewer changed it to `col += 4` — a plausible-looking
        // simplification — and every suite stayed green while the module started
        // reading a 3-space-then-tab continuation as column 7 instead of 4.
        // Consequence: the list keeps consuming, so a section runs on. Silent
        // pass. The invisible-character machinery cannot reach this: there is no
        // character class here to widen, which is exactly why it needed a pin of
        // its own rather than an excuse.
        assert.deepEqual(
          doctorChecks.classifyLines(['-    x', '', '   \tcont']).map((c) => c.type),
          ['list', 'blank', 'code'],
          'a tab advances to the next multiple of four (CommonMark 2.2): 3 spaces then a tab is column 4, which is below this item\'s content column, so the continuation is indented code and not more list'
        );
        assert.deepEqual(
          doctorChecks.classifyLines(['- x', '', ' \tcont']).map((c) => c.type),
          ['list', 'blank', 'list'],
          '...while one space then a tab is also column 4, which IS at this item\'s content column, so it continues the item'
        );

        // ⚠⚠ TYPE 6 IS NOT "UNCLOSED" AT EOF, and the first version of the
        // marking got this wrong in a way nothing pinned. Type 6 has no end
        // condition — it closes on a blank line — so `open.endRe` is null for it.
        // Marking every open `html` block therefore flagged a document ending in
        // `</div>`, but ONLY when the file had no trailing newline, because a
        // trailing newline supplies the blank that closes it. Two files one byte
        // apart, and the shorter one got a spurious warning plus a false `stale`
        // on a section that plainly carries the rule. Content loss, on ordinary
        // hand-written HTML.
        const type6 = '## Ceremony Scaling (Project Application)\n\n<div class="note">\n**The cascade result is a floor: rows may only escalate a tier, never lower it.**\n</div>';
        for (const [label, doc] of [['no trailing newline', type6], ['trailing newline', `${type6}\n`]]) {
          assert.equal(
            doctorChecks.unclosedHtmlBlockLine(doc), -1,
            `a type-6 block closes on a blank line, so it is never "unclosed" at EOF (${label}) — only types 1-5 have an end condition`
          );
          assert.equal(
            doctorChecks.findConventionsDrift(doc).some((x) => x.id === 'ceremony-escalate-only'), false,
            `...and the rule inside it is visible content, so the section is not stale (${label})`
          );
        }

        assert.equal(doctorChecks.unclosedHtmlBlockLine(closed), -1, 'a closed comment is not reported');
        assert.equal(
          doctorChecks.findConventionsDrift(closed).some((x) => x.id === 'ceremony-escalate-only'), false,
          '...and a section that really does carry the rule still reports nothing'
        );

        // ⚠⚠ `blockStart` — the opener index every line of an HTML block carries.
        // Added because three review rounds each defeated an attempt to recover it
        // from OUTSIDE the classifier (`debt212223-xv1` F2 → `xv2` F1 → `xv3` F1);
        // the pins below are the two shapes that defeated it, and they are here
        // rather than only at the doctor level because the property belongs to this
        // function. Both directions: content that merely LOOKS like an opener does
        // not become one, and a block that really did open is not attributed to the
        // block before it.
        const blockStarts = (lines) => doctorChecks.classifyLines(lines).map((c) => c.blockStart);
        assert.deepEqual(
          blockStarts(['<details>', '<div>inner shell</div>', '<p>content row</p>', '## Project Context']),
          [0, 0, 0, 0],
          'tag-shaped lines inside an open HTML block all belong to the block that opened at line 0'
        );
        assert.deepEqual(
          blockStarts(['<!-- outer', 'prose <!-- inner-looking', '## Project Context']),
          [0, 0, 0],
          'a mid-line `<!--` inside an open comment does not start a block of its own'
        );
        assert.deepEqual(
          blockStarts(['<!-- closed note -->', '<!-- open note', '## Project Context']),
          [0, 1, 1],
          'a comment that closes on its own line owns only that line; the next opener starts its own block'
        );
        assert.deepEqual(
          blockStarts(['prose', '<!-- note', 'hidden']).slice(0, 1), [undefined],
          'a line outside any HTML block carries no blockStart'
        );
      }

      // (g) PRESERVATION PINS — these pass on the old code as well, and are here
      // because the rewrite replaced `isTableLine`'s backward scan with a
      // forward one that requires a header row. Two behaviours had to survive
      // that: a `---` after a table row is a thematic break, and ordinary prose
      // containing a pipe stays a paragraph (the `line.includes('|')` version of
      // that test ran sections on into the next one — silent success).
      assert.ok(
        keepsSentinel(['| a | b |', '|---|---|', '| c | d |']),
        'a --- after a table row does not close the section'
      );
      assert.ok(
        !keepsSentinel(['The Command | Query split.']),
        'prose containing a pipe is still a paragraph, so --- closes the section'
      );
    }

    // The ATX OPENING sequence, pinned across all three predicates that judge
    // it. CommonMark accepts only a space or tab after the hashes; JS `\s` also
    // matches U+00A0, form feed and vertical tab. While one predicate said `\s`
    // and another said `[ \t]`, such a line was neither a paragraph nor a
    // heading, so a following `---` could not close the section and it ran on —
    // silent pass (`p082-b3-g3`). U+00A0 is the realistic input: copy-paste.
    // ⚠ Separators are built with `String.fromCharCode`, so this source file
    // contains no invisible characters at all: a raw NBSP is indistinguishable
    // from a space in a diff and an editor may normalize it away. The
    // differential harness carries the same shapes and was itself corrupted
    // once by generating them through `sed`, which silently wrote the literal
    // text `00a0` and made the row compare clean against the wrong shape.
    const SENTINEL_ATX = 'SENTINEL-MARKER-LINE';
    for (const [label, code, isHeading] of [
      ['space', 0x20, true],
      ['tab', 0x09, true],
      ['NBSP', 0xa0, false],
      ['form feed', 0x0c, false],
      ['vertical tab', 0x0b, false]
    ]) {
      const line = `####${String.fromCharCode(code)}Heading`;
      const doc = ['## Target Section', '', line, '---', '', SENTINEL_ATX, '', '## Next Section', ''].join('\n');
      const bodies = doctorChecks.conventionsSectionBodies(doc, 'Target Section');
      assert.equal(bodies.length, 1, `ATX opener ${label}: expected one Target Section body`);
      // A real ATX heading is not a paragraph, so the `---` is a thematic break
      // and the section continues. A fake one IS a paragraph, so the `---` is a
      // setext heading and the section ends before the sentinel.
      assert.equal(
        bodies[0].includes(SENTINEL_ATX),
        isHeading,
        `ATX opener ${label}: ${isHeading ? 'is a heading, so the section continues past ---' : 'is NOT a heading, so --- closes the section'}`
      );
    }

    // The same whitespace rule at the other three constructs the class guard
    // covers at source level. These pin what a USER sees, which is the part
    // that matters; the source guard only stops the spelling coming back.
    // All built with `String.fromCharCode` — no invisible characters in this
    // file. (`p082-b3-g4` findings 1, 2 and 5.)
    {
      const NBSP = String.fromCharCode(0xa0);
      const SENT = 'SENTINEL-MARKER-LINE';
      const sectionEnds = (lines) => {
        const doc = ['## Target Section', '', ...lines, '', SENT, '', '## Next Section', ''].join('\n');
        const bodies = doctorChecks.conventionsSectionBodies(doc, 'Target Section');
        assert.equal(bodies.length, 1, `expected one body for ${JSON.stringify(lines)}`);
        return !bodies[0].includes(SENT);
      };

      // A list marker followed by NBSP is not a list item, so the line is a
      // paragraph and the `---` under it IS a setext heading. Reading it as a
      // list kept the section running past its end — silent pass.
      assert.equal(sectionEnds([`-${NBSP}local note`, '---']), true, 'a bullet marker followed by NBSP is prose, so --- closes the section');
      assert.equal(sectionEnds([`1.${NBSP}local note`, '---']), true, 'an ordered marker followed by NBSP is prose, so --- closes the section');
      assert.equal(sectionEnds(['- a real bullet', '---']), false, '...while a real bullet is not prose, so --- is a thematic break');

      // A setext underline may be followed only by spaces or tabs. Accepting
      // NBSP there closed the section early and the walker popped the line
      // carrying the marker — content loss, the opposite direction.
      assert.equal(sectionEnds(['local stale prose', `---${NBSP}`]), false, 'NBSP after an underline means it is not an underline, so the section continues');
      assert.equal(sectionEnds(['local stale prose', '---  ']), true, '...while trailing spaces are allowed, so this one does close it');

      // ⚠⚠ THE THEMATIC BREAK AT A BLOCK START — the hole three separate guard
      // defeats walked through, and the reason all three landed here. Every
      // other construct the source guard names had a behavioural pin at a block
      // start; `isThematicBreak` had one only in the setext-underline position
      // (the two assertions directly above), so a `\s`-tolerant thematic break
      // was invisible to the suite while being visible to a user.
      //
      // `---<NBSP>` at a block start is NOT a thematic break: NBSP is not
      // whitespace to CommonMark, so the line is a paragraph, and the plain
      // `---` beneath it is a setext H2 that ends the section.
      // `commonmark@0.31.2` returns `heading:2` for all three characters and
      // `[thematic_break, thematic_break]` for the control.
      //
      // ⚠ This pin is worth more than another banned substring, and that is the
      // point of it: the bans are a lint over literal spellings, and the space of
      // spellings is unbounded — `String.fromCharCode`, string concatenation,
      // `new RegExp` from parts, a code-point `Set`. Three demonstrated defeats
      // used three different spellings and this one assertion fails for all of
      // them, because it asks what the module DOES rather than how it is
      // written. Do not "simplify" it into the guard block above.
      for (const [label, code] of [['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b]]) {
        const ch = String.fromCharCode(code);
        assert.equal(
          sectionEnds([`---${ch}`, '---']),
          true,
          `a --- line carrying a trailing ${label} is not a thematic break, so the --- under it is a setext H2 and the section ends`
        );
      }
      assert.equal(sectionEnds(['---', '---']), false, '...while two real thematic breaks open no heading, so the section runs on');

      // A backtick fence whose info string contains a backtick does not open a
      // fence, so the heading under it is a real heading and closes the
      // section. Blanking it let a stale section run on.
      const BT = String.fromCharCode(0x60);
      assert.equal(
        sectionEnds([`${BT.repeat(3)}bad${BT}info`, '## Local Notes', BT.repeat(3)]),
        true,
        'a backtick fence with a backtick in its info string does not open a fence, so the heading inside is real'
      );
      assert.equal(
        sectionEnds([`${BT.repeat(3)}js`, '## Not A Heading', BT.repeat(3)]),
        false,
        '...while a valid fence does blank the heading inside it'
      );
    }

    // ⚠⚠ `assertOpenerIndentPartition` — the property that makes branch (7)'s
    // `indentWidth(line) >= 4` safe against every branch above it, pinned rather
    // than left to be re-derived. Branch (7) is cited at its site as depending on
    // this.
    //
    // The property: every raw-prefix opener in `lib/doctor-checks.js` is
    // `^ {0,3}` followed by a character that is neither a space nor a tab. So a
    // line matching any opener has `indentWidth <= 3`, while `indentWidth >= 4`
    // needs four spaces or a tab inside the first four columns — which no
    // `^ {0,3}X` can match. Branches (4) and (7) therefore partition cleanly.
    //
    // ⚠ It is a property of the OTHER expressions, so it breaks from a distance
    // and it breaks silently: widen any opener to `^[ \t]{0,3}` — which reads
    // like a tolerance improvement, not like a boundary change — and branch (7)
    // starts eating lines that opener was meant to claim. Nothing else in this
    // suite would fail. That is the exact shape of defect this batch has spent
    // three rounds on: the fix was right, the reason was not written next to it,
    // and the round after could not tell a safe edit from an unsafe one.
    // ⚠⚠ THE COVERAGE IS DERIVED FROM THE MODULE, NOT TYPED OUT — and the first
    // version of this sweep is why. It carried 13 hand-picked bodies, claimed in
    // its own comment to sweep "every opener", and silently covered five families
    // out of eight. A reviewer widened `FENCE_OPEN_RE`, `SETEXT_UNDERLINE_RE` and
    // HTML types 3/4/5 to `^[ \t]{0,3}` — the exact edit the comment named as the
    // thing it caught — and the suite stayed green for all three, with a real
    // silent pass or content loss behind each. **The pin added to stop "a pin
    // that cannot fail against the defect it names" was that pin.**
    //
    // A hand-written list cannot fix that, because the failure is not a missing
    // entry — it is that nothing relates the list to the module. So the census
    // below reads the module's own `^ {0,3}` sites, attributes each to the
    // declaration that owns it, and fails when an owner has no probe here or
    // when an owner's site COUNT changes. Add a sixth HTML block type, or a new
    // opener, and this test fails until someone says how to exercise it.
    //
    // ⚠ Two families are NOT reachable through `classifyLines` at all, which is
    // the specific reason they were missing: the fence regexes are read only by
    // `blankFencedBlocks`, and `SETEXT_UNDERLINE_RE` needs an open paragraph. So
    // a probe declares its own document and its own verdict vocabulary rather
    // than assuming one shape fits every opener.
    //
    // ⚠ And the deep verdict is NOT always `code`. Where an opener is only
    // reachable with a paragraph open, branch (7) cannot fire — an indented line
    // there is a lazy continuation. `deep: 'paragraph'` is that case, measured,
    // not a weaker assertion.
    {
      const TAB = String.fromCharCode(0x09);
      const BT = String.fromCharCode(0x60).repeat(3);
      const type = (lines, i) => doctorChecks.classifyLines(lines)[i].type;
      const blanked = (lines, i) => doctorChecks.blankFencedBlocks(lines.join('\n'))[i].trim() === '';

      // `sites` = how many `^ {0,3}` occurrences this declaration owns in
      // `lib/doctor-checks.js`. `bodies` must have one entry per site, so a new
      // site forces a new probe rather than hiding behind an existing one.
      const OPENER_PROBES = {
        ATX_HEADING_RE: {
          sites: 1, bodies: ['# H'],
          run: (p, b) => type([p + b], 0), shallow: 'heading', deep: 'code'
        },
        isThematicBreak: {
          sites: 3, bodies: ['---', '***', '___'],
          run: (p, b) => type([p + b], 0), shallow: 'thematic-break', deep: 'code'
        },
        FENCE_OPEN_RE: {
          sites: 1, bodies: [BT],
          run: (p, b) => (blanked(['## A', p + b, '## Hidden', BT], 2) ? 'fence' : 'not-fence'),
          shallow: 'fence', deep: 'not-fence'
        },
        FENCE_CLOSE_RE: {
          // Inverted on purpose: an indented CLOSER fails to close, so the line
          // AFTER the block stays blanked. Probing it with the opener's document
          // would have reported green whatever the closer did.
          sites: 1, bodies: [BT],
          run: (p, b) => (blanked(['## A', BT, '## Hidden', p + b, '## After'], 4) ? 'not-fence' : 'fence'),
          shallow: 'fence', deep: 'not-fence'
        },
        TABLE_DELIMITER_ROW_RE: {
          sites: 1, bodies: ['|---|---|'],
          run: (p, b) => type(['Intro.', '| a | b |', p + b], 2), shallow: 'table', deep: 'paragraph'
        },
        // ⚠ Four sites, not five: PROPOSAL-084 lifted the type-2 opener into its
        // own named constant so the inline-comment detector could read it instead
        // of writing a second copy. The site moved, it did not disappear — the
        // probe for it is `HTML_COMMENT_OPEN_RE` directly below.
        HTML_BLOCK_TYPES: {
          sites: 4, bodies: ['<script>', '<?x', '<!DOCTYPE', '<![CDATA['],
          run: (p, b) => type([p + b], 0), shallow: 'html', deep: 'code'
        },
        HTML_COMMENT_OPEN_RE: {
          sites: 1, bodies: ['<!-- c -->'],
          run: (p, b) => type([p + b], 0), shallow: 'html', deep: 'code'
        },
        HTML_BLOCK_TYPE6_RE: {
          sites: 1, bodies: ['<div>'],
          run: (p, b) => type([p + b], 0), shallow: 'html', deep: 'code'
        },
        LIST_ITEM_RE: {
          sites: 1, bodies: ['- x'],
          run: (p, b) => type([p + b], 0), shallow: 'list', deep: 'code'
        },
        EMPTY_LIST_ITEM_RE: {
          sites: 1, bodies: ['-'],
          run: (p, b) => type([p + b], 0), shallow: 'list', deep: 'code'
        },
        INTERRUPTING_ITEM_RE: {
          sites: 1, bodies: ['- x'],
          run: (p, b) => type(['prose', p + b], 1), shallow: 'list', deep: 'paragraph'
        },
        BLOCKQUOTE_RE: {
          sites: 1, bodies: ['> q'],
          run: (p, b) => type([p + b], 0), shallow: 'blockquote', deep: 'code'
        },
        stripNestedContainerOpeners: {
          // Observable through the rawHtml field the helper feeds back into the
          // one classifier; four spaces make the whole line indented code, so
          // no nested raw-HTML context may be claimed there.
          sites: 1, bodies: ['> <details>'],
          run: (p, b) => (doctorChecks.classifyLines([p + b])[0].rawHtml ? 'raw-html' : 'not-raw-html'),
          shallow: 'raw-html', deep: 'not-raw-html'
        },
        // ⚠ An EMPTY item, and an UNINDENTED follower — not `- x` with an
        // indented continuation, which was the first attempt and did not
        // discriminate. This constant measures the item's content column, and
        // the defect it carries is `listContentColumn` returning `null`: widen
        // its gap from `[ \t]*` to `[ \t]+` and a bare `-` stops matching, the
        // column becomes null, `indentWidth(line) >= null` is true for every
        // line, and the item swallows the rest of the document. Only a bare
        // marker reaches that; `- x` still matches a `+` gap and moves nothing.
        // Found by diffing the shipped module against the broken one rather
        // than by reasoning about the probe.
        LIST_ITEM_PREFIX_RE: {
          sites: 1, bodies: ['-'],
          run: (p, b) => type([p + b, '', `${p}unindented`], 2), shallow: 'paragraph', deep: 'code'
        },
        SETEXT_UNDERLINE_RE: {
          sites: 1, bodies: ['---'],
          run: (p, b) => type(['prose', p + b], 1), shallow: 'heading', deep: 'paragraph'
        },
        // PROPOSAL-084. Not reachable through `classifyLines` at all — it belongs
        // to a DETECTOR, not to the parser — so this probe declares its own
        // verdict vocabulary, which is the escape hatch this block documents for
        // the fence regexes. The opener still has to obey the 0-3 rule: at four
        // columns the line is indented code and warning about it would be the
        // false-positive direction gap D was rejected for.
        BARE_TAG_LINE_RE: {
          sites: 1, bodies: ['<custom-element>'],
          run: (p, b) => (doctorChecks.htmlBlockType7Line([p + b, '---'].join('\n')) !== -1 ? 'detected' : 'not-detected'),
          shallow: 'detected', deep: 'not-detected'
        }
      };

      // --- the census: attribute every `^ {0,3}` site to its owner ------------
      // Comments are stripped first, for the reason the guard above states: this
      // block's own prose contains `^ {0,3}` and would otherwise be counted.
      const moduleSource = await readFile(join(repoRoot, 'lib/doctor-checks.js'), 'utf8');
      const code = moduleSource
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .map((l) => l.replace(/\/\/ .*$/, ''));
      const owners = new Map();
      let owner = null;
      for (const line of code) {
        const decl = line.match(/^(?:const|let|var) ([A-Za-z_0-9]+)\s*=/) || line.match(/^function ([A-Za-z_0-9]+)\(/);
        if (decl) owner = decl[1];
        // ⚠⚠ THE INDENT MAY BE WRAPPED IN A GROUP. This matched the bare literal
        // `^ {0,3}` only, so `LIST_ITEM_PREFIX_RE` — which spells it
        // `^( {0,3})`, to capture the indent — was INVISIBLE to the census: no
        // probe demanded, all three completeness assertions silent, and the
        // one-character defect that makes a bare `-` swallow the document still
        // shipped with a green suite.
        // ⚠ The previous commit claimed to have closed this by adding an
        // `indent-group` widening. That is the MUTATION list, a different
        // mechanism entirely — it never feeds the census. A fix applied to the
        // wrong mechanism reads exactly like a fix.
        // Still invisible by construction, and deliberately so rather than
        // silently: `^[ ]{0,3}`, `^ {0, 3}`, `^\x20{0,3}`, or an indent split
        // across source lines. A named constant is safe — the census attributes
        // the site to it and demands a probe.
        const hits = (line.match(/\^(?:\((?:\?:)?)? \{0,3\}/g) || []).length;
        if (hits) owners.set(owner, (owners.get(owner) || 0) + hits);
      }

      const unprobed = [...owners.keys()].filter((n) => !OPENER_PROBES[n]);
      assert.deepEqual(
        unprobed, [],
        `lib/doctor-checks.js has a ^ {0,3} opener with no probe in OPENER_PROBES: ${unprobed.join(', ')}. Add one saying how to exercise it and what it must classify as at 0-3 columns and at 4+. Do not skip this — a sweep that does not reach an opener is the decoration this block replaced.`
      );
      const stale = [...owners.entries()]
        .filter(([n, n_]) => OPENER_PROBES[n].sites !== n_)
        .map(([n, n_]) => `${n}: module has ${n_}, OPENER_PROBES says ${OPENER_PROBES[n].sites}`);
      assert.deepEqual(stale, [], `the ^ {0,3} site count moved: ${stale.join('; ')}`);
      const missing = Object.keys(OPENER_PROBES).filter((n) => !owners.has(n));
      assert.deepEqual(missing, [], `OPENER_PROBES names an opener the module no longer has: ${missing.join(', ')}`);

      // --- the sweep itself ---------------------------------------------------
      const shallow = ['', ' ', '  ', '   '];
      const deep = ['    ', '     ', TAB, ` ${TAB}`, `  ${TAB}`, `   ${TAB}`];
      let checked = 0;
      for (const [name, probe] of Object.entries(OPENER_PROBES)) {
        assert.equal(probe.bodies.length, probe.sites, `${name}: one probe body per ^ {0,3} site`);
        for (const body of probe.bodies) {
          for (const prefix of shallow) {
            assert.equal(
              probe.run(prefix, body), probe.shallow,
              `${name} indented ${prefix.length} columns must still be ${probe.shallow}: ${JSON.stringify(prefix + body)} — if this fails, its ^ {0,3} prefix was widened to admit a space or tab and branch (7) is now stealing its lines`
            );
            checked += 1;
          }
          for (const prefix of deep) {
            assert.equal(
              probe.run(prefix, body), probe.deep,
              `${name} at column 4 or beyond must be ${probe.deep}: ${JSON.stringify(prefix + body)}`
            );
            checked += 1;
          }
        }
      }
      const sites = Object.values(OPENER_PROBES).reduce((n, p) => n + p.bodies.length, 0);
      assert.equal(checked, sites * (shallow.length + deep.length), 'every opener site x every indent form');
    }

    // ⚠⚠ EVERY GUARDED CONSTRUCT MUST HAVE A BLOCK-START INVISIBLE-CHARACTER
    // PIN, OR AN EXPLICIT REASON WHY NOT. This is the second half of the same
    // lesson as the census above, and it comes from a measurement rather than a
    // hunch: five demonstrated guard defeats in a row all landed on the ONE
    // construct that had no such pin, and when that one was pinned the next
    // defeat simply moved to the next unpinned construct. The source-level bans
    // are a lint over literal spellings — `\s`, `[^\S`, `.trim(`, seven named
    // escapes — and the sixth reviewer defeated them with an eighth spelling
    // (`\xa0`) in about a minute. A ninth exists; so does a tenth.
    //
    // Behavioural pins do not have that shape. `---<NBSP>` is `---<NBSP>`
    // however the module chose to spell its whitespace test, so one pin closes
    // every spelling at once. What was missing was not a better pin — it was
    // any relationship between the set of guarded constructs and the set of
    // pinned ones. That relationship is the assertion at the bottom of this
    // block: add a name to `guardedConstructs` and this test fails until you
    // either pin it or write down why it cannot be pinned.
    //
    // ⚠ Every construct below currently PASSES. That is the point — these are
    // regression pins for behaviour that is correct today and was protected by
    // nothing, which is exactly how the previous five defeats were possible.
    {
      const N = String.fromCharCode(0xa0);
      const BT = String.fromCharCode(0x60).repeat(3);
      const type = (lines, i) => doctorChecks.classifyLines(lines)[i].type;

      // Each pin: feed the construct's trigger with an invisible character in
      // the position that would matter, and assert the construct does NOT fire.
      // NBSP, form feed and vertical tab are not whitespace to CommonMark.
      // ⚠⚠ EVERY PIN TAKES THE MODULE AS ITS FIRST ARGUMENT, and that is not a
      // style choice — it is what makes the pins testable. A pin closed over the
      // imported module can only ever be run against the correct module, so
      // nothing can ask the question that matters: *would this pin fail if the
      // construct it names were broken?* The mutation-adequacy block below runs
      // every one of them against a deliberately broken copy, and it exists
      // because a review round found that three of these pins could not fail
      // against their own construct and one of them was a tautology.
      //
      // ⚠ `t(dc, ...)` rather than the outer `type(...)`: the outer helper is
      // bound to the shipped module, and using it here would silently test the
      // shipped module while appearing to test the mutant. That is the same
      // "tests a copy, not the code" trap this project has paid for before.
      const t = (dc, lines, i) => dc.classifyLines(lines)[i].type;
      const INVISIBLE_PINS = {
        ATX_HEADING_RE: (dc, c) => t(dc, [`#${c}H`], 0) !== 'heading' && t(dc, [`${c}# H`], 0) !== 'heading',
        // ⚠ ALL THREE MARKER ALTERNATIVES. This function is three separate
        // regexes, and pinning `-` alone certified it while the `*` and `_`
        // alternatives were free — caught by widening one class at a time.
        isThematicBreak: (dc, c) => ['---', '***', '___'].every((m) => t(dc, [`${m}${c}`], 0) !== 'thematic-break' && t(dc, [`${c}${m}`], 0) !== 'thematic-break'),
        // ⚠ Asks `blankFencedBlocks`, NOT `classifyLines`. The first version of
        // this pin was `classifyLines(...)[0] !== 'fence'` — and `'fence'` is not
        // in that function's vocabulary at all, so the assertion was true for
        // every input and every module state. A tautology, in the block whose
        // subject is checks that cannot fail. It survived because a sibling pin
        // happened to catch the same break.
        FENCE_OPEN_RE: (dc, c) => dc.blankFencedBlocks(['## A', `${c}${BT}`, '## Visible', BT].join('\n'))[2].trim() !== '',
        // ⚠ BOTH of this construct's whitespace classes: the trailing `[ \t]*$`
        // after the marker AND its own `^ {0,3}` indent. Pinning the trailing
        // one alone left the indent free — the mutation-adequacy check below is
        // what said so, which is the whole reason it exists.
        FENCE_CLOSE_RE: (dc, c) => dc.blankFencedBlocks(['## A', BT, '## Hidden', `${BT}${c}`, '## After'].join('\n'))[4].trim() === ''
          && dc.blankFencedBlocks(['## A', BT, '## Hidden', `${c}${BT}`, '## After'].join('\n'))[4].trim() === '',
        // ⚠ EVERY PADDING POSITION, not just the trailing one. This regex has
        // seven `[ 	]*` classes — leading pad, each cell's lead and trail, and
        // the final one — and a pin on the last certified all seven. Widening
        // any single inner pad made `|<NBSP>---|---|` a delimiter row, which
        // opens a table, which stops the `---` below from ending the section:
        // silent pass, suite green.
        TABLE_DELIMITER_ROW_RE: (dc, c) => [
          `|---|---|${c}`, `${c}|---|---|`, `|${c}---|---|`,
          `|---${c}|---|`, `|---|${c}---|`, `|---|---${c}|`
        ].every((row) => t(dc, ['Intro.', '| a | b |', row], 2) !== 'table'),
        // ⚠ The character goes in the TAIL, `([ \t>]|$)`, which is this
        // construct's own whitespace class. Putting it before `<script>` tested
        // the `^ {0,3}` indent instead — a live hole: widening the tail left the
        // suite green while `<script<NBSP>x` opened a type-1 block that closes
        // only at `</script>`, swallowing the rest of the file.
        HTML_BLOCK_TYPES: (dc, c) => t(dc, [`<script${c}x`], 0) !== 'html' && t(dc, [`${c}<script>`], 0) !== 'html',
        // ⚠ PINNED, NOT EXCUSED. The tempting excuse — "a fragment composed into
        // HTML_BLOCK_TYPES, which is pinned" — is the FENCE_MARKER wording, and it
        // is only honest for a fragment that carries no whitespace class of its
        // own. This one carries `^ {0,3}`, and HTML_BLOCK_TYPES' pin exercises the
        // type-1 opener, so widening THIS constant to `\s{0,3}` would leave that
        // pin green. `\s` matches U+00A0 in JS, so the widened form opens a
        // comment block on `<NBSP><!--` and hides the rest of the file from every
        // check — the silent direction.
        HTML_COMMENT_OPEN_RE: (dc, c) => t(dc, [`${c}<!-- x -->`], 0) !== 'html',
        HTML_BLOCK_TYPE6_RE: (dc, c) => t(dc, [`<div${c}>`], 0) !== 'html' && t(dc, [`${c}<div>`], 0) !== 'html',
        LIST_ITEM_RE: (dc, c) => t(dc, [`-${c}x`], 0) !== 'list' && t(dc, [`${c}- x`], 0) !== 'list',
        // ⚠ Isolated through the ONE observable this construct owns: an EMPTY
        // list item cannot interrupt a paragraph, a non-empty one can. So
        // `prose` / `-<SP><NBSP>` is a `list` while the item is non-empty, and
        // becomes a `paragraph` the moment the emptiness test starts counting
        // U+00A0 as whitespace. Direction: content loss — a real item stops
        // interrupting, the `---` under it becomes a setext underline, and the
        // section's body is emptied.
        // ⚠ Found by MEASURING which corpus documents move under the widening,
        // not by reasoning. Two earlier spellings of this pin were wrong — one
        // gated by `LIST_ITEM_RE` so it fired on a different construct, and one
        // with the direction inverted, which failed against the pristine module.
        EMPTY_LIST_ITEM_RE: (dc, c) => t(dc, ['prose', `- ${c}`], 1) === 'list',
        INTERRUPTING_ITEM_RE: (dc, c) => t(dc, ['prose', `1.${c}x`], 1) !== 'list',
        BLOCKQUOTE_RE: (dc, c) => t(dc, [`${c}> q`], 0) !== 'blockquote',
        SETEXT_UNDERLINE_RE: (dc, c) => t(dc, ['prose', `---${c}`], 1) !== 'heading' && t(dc, ['prose', `${c}---`], 1) !== 'heading',
        BLANK_LINE_RE: (dc, c) => t(dc, ['para', c, '---'], 1) !== 'blank',
        // ⚠ The invisible character must sit in the GAP AFTER THE MARKER, which
        // is the only part of this regex with a whitespace class. A first draft
        // put it after the indent instead, where the gap class never sees it.
        LIST_ITEM_PREFIX_RE: (dc, c) => t(dc, [`-  ${c}x`, '', '   continuation'], 2) === 'list',
        indentWidth: (dc, c) => t(dc, [`${c}${c}${c}${c}code?`], 0) !== 'code',
        // ⚠ BOTH ends. `stripSpaceTab` is `^[ \t]+|[ \t]+$` — two alternatives,
        // and pinning the trailing one alone left the leading one free.
        stripSpaceTab: (dc, c) => dc.parseAtxHeading(`## Title${c}`).text.endsWith(c) && dc.parseAtxHeading(`## ${c}Title`).text.startsWith(c),
        // ⚠ This function's OWN whitespace class is the closing-sequence
        // stripper `/[ \t]+#+[ \t]*$/` — the opener belongs to ATX_HEADING_RE.
        // `## Title<NBSP>###` must keep its `###` as heading TEXT, because
        // U+00A0 is not the space that introduces a closing sequence. The
        // previous spelling only re-tested the opener, so it survived a widening
        // of the one expression this function actually owns.
        parseAtxHeading: (dc, c) => dc.parseAtxHeading(`##${c}Title`) === null
          && dc.parseAtxHeading(`## Title${c}###`).text.endsWith('###'),
        extractHeadings: (dc, c) => dc.extractHeadings(`#${c}Not A Heading`).length === 0,
        extractH2Headings: (dc, c) => dc.extractH2Headings(`##${c}Not A Heading`).length === 0,
        // ⚠ ASKS THROUGH ITS OWN API, and that is the entire reason this entry
        // is allowed to exist separately: it used to be a CHARACTER-IDENTICAL
        // copy of `FENCE_OPEN_RE`'s pin (`p082-b3-k3` gap H), certifying
        // nothing its sibling did not already certify. What this function owns
        // is the PROJECTION — which lines come back blank — so it is pinned in
        // both directions at once: the content of a fence that DID open is
        // blanked, and a fence that did NOT open does not blank what follows.
        // The second half is what fails when FENCE_OPEN_RE's class is widened,
        // which is the dependency ADEQUACY_VIA declares and the relation check
        // below proves.
        blankFencedBlocks: (dc, c) => {
          const projected = dc.blankFencedBlocks(['## A', BT, 'hidden', BT, `${c}${BT}`, 'kept'].join('\n'));
          return projected[2].trim() === '' && projected[5].trim() !== '';
        },
        classifyLines: (dc, c) => t(dc, [`${c}# H`], 0) !== 'heading',
        // Isolate the optional space after `>` owned by
        // stripNestedContainerOpeners. U+00A0 must remain content, so it keeps
        // `<details>` from being a raw-HTML opener at the container boundary.
        stripNestedContainerOpeners: (dc, c) => dc.classifyLines([`>${c}<details>`])[0].rawHtml !== true
      };

      // Excused, each with the reason. A construct is only excusable when an
      // invisible character cannot reach the decision it makes.
      const NO_INVISIBLE_PIN = {
        LINE_SPLIT_RE: 'splits a document on line endings; it never inspects within-line whitespace',
        FENCE_MARKER: 'a fragment with no whitespace class, composed into FENCE_OPEN_RE / FENCE_CLOSE_RE, which are both pinned',
        HTML_BLOCK_TAGS: 'an alternation of literal tag names, composed into HTML_BLOCK_TYPE6_RE, which is pinned',
        BULLET_MARKER: 'a fragment composed into LIST_ITEM_RE / EMPTY_LIST_ITEM_RE / INTERRUPTING_ITEM_RE, all pinned',
        ORDERED_DELIM: 'a fragment ([.)]) composed into ORDERED_MARKER; carries no whitespace class of its own',
        ORDERED_MARKER: 'a fragment composed into the three list regexes, all pinned',
        htmlBlockStart: 'reads HTML_BLOCK_TYPES and HTML_BLOCK_TYPE6_RE and adds no whitespace test; both are pinned',
        nestedRawHtmlContext: 'reads htmlBlockStart and BLANK_LINE_RE and adds no whitespace test of its own; both dependencies are pinned',
        nestedParagraphOpens: 'composes the guarded block predicates and indentWidth; it adds no whitespace spelling of its own, and its paragraph/list directions are pinned in the nested raw-HTML matrix',
        nestedContainerContext: 'coordinates stripNestedContainerOpeners, nestedRawHtmlContext and nestedParagraphOpens; all whitespace decisions stay in those guarded dependencies',
        listContentColumn: 'measures a column through LIST_ITEM_PREFIX_RE and indentWidth, both pinned',
        stringIndexAtVisualColumn: 'maps a visual column to a string index by comparing literal tab characters; an invisible Unicode space cannot reach its tab-stop decision, and the nested raw-HTML matrix pins a continuation whose masking syntax sits beyond the tab slice boundary',
        unclosedHtmlBlockLine: 'reads the flag classifyLines already set and returns its index; it applies no whitespace test of its own, and the decision it reports is made by HTML_BLOCK_TYPES / HTML_BLOCK_TYPE6_RE, which are pinned',
        maskCodeBlocks: 'masks code lines to same-length spaces so the write path can search without matching a marker shown inside an example; it applies no whitespace test of its own and asks classifyLines for what code is. Pinned behaviourally under "reader-invisible content" in both directions',
        classifiedVisible: 'the single application of the invisibility rule: it returns classifyLines output alongside the lines that flag blanked. Adds no whitespace test of its own; the decision belongs to HTML_BLOCK_TYPES / HTML_TYPE1_INVISIBLE_TAGS, and its BEHAVIOUR is pinned under "reader-invisible content" in both directions',
        visibleTextLines: 'blanks the lines classifyLines marked invisible; it applies no whitespace test of its own. ⚠ Its defect surface is NOT an invisible character — it is WHICH HTML types render text, and a widening cannot express that. Pinned behaviourally instead, both directions, under "reader-invisible content", exactly as indentWidth is pinned for its arithmetic',
        HTML_TYPE1_INVISIBLE_TAGS: 'an alternation of two literal tag names with no whitespace class; which tags it names is pinned behaviourally under "reader-invisible content"',
        HTML_TYPE1_TAGS: 'an alternation of literal tag names, composed into HTML_BLOCK_TYPES, which is pinned — exactly the HTML_BLOCK_TAGS case',
        // ⚠ Not "composed into a pinned thing" — this one is used directly, so the
        // argument has to be that an invisible character cannot REACH it. It is
        // matched against a captured tag NAME, never against a line, and that name
        // comes from BARE_TAG_NAME (`[A-Za-z][A-Za-z0-9-]*`), which cannot contain
        // an invisible character: a name carrying one never matched in the first
        // place and this regex is never consulted. Which four names it holds is
        // pinned behaviourally in the type-7 grammar table.
        HTML_TYPE1_NAME_RE: 'anchored `^…$` against a captured tag name produced by BARE_TAG_NAME, which admits no invisible character; the names it holds are pinned behaviourally in the type-7 grammar table'
      };

      const { blockFunctions, blockConstants } = guardedConstructs;
      const guarded = [...blockFunctions, ...blockConstants];
      const accounted = new Set([...Object.keys(INVISIBLE_PINS), ...Object.keys(NO_INVISIBLE_PIN)]);

      const unpinned = guarded.filter((n) => !accounted.has(n));
      assert.deepEqual(
        unpinned, [],
        `the class guard names ${unpinned.join(', ')} but nothing pins its behaviour against an invisible character at a block start. Add a pin, or add it to NO_INVISIBLE_PIN with the reason an invisible character cannot reach its decision. Do not skip this — five consecutive demonstrated defeats of this guard all landed on the one construct that had no such pin.`
      );
      const strayPins = [...accounted].filter((n) => !guarded.includes(n));
      assert.deepEqual(strayPins, [], `pinned or excused but no longer a guarded construct: ${strayPins.join(', ')}`);
      const bothWays = Object.keys(INVISIBLE_PINS).filter((n) => n in NO_INVISIBLE_PIN);
      assert.deepEqual(bothWays, [], `both pinned and excused: ${bothWays.join(', ')}`);

      // ⚠⚠ TWO PINS WITH THE SAME BODY ARE ONE PIN, and nothing in this file
      // compared two pins to each other until `p082-b3-k3` (gap H) found
      // `blankFencedBlocks` holding a character-identical copy of
      // `FENCE_OPEN_RE`'s. Every invariant around it passed: it is a real pin,
      // it is not double-classified, and its ADEQUACY_VIA relation is even
      // machine-PROVEN — because a copy of X's pin trivially fails when X
      // breaks. That is the shape of a decorative check; it satisfies the
      // registry and observes nothing new. The registries could only ever ask
      // "is this name accounted for", never "does this pin add an
      // observation", so the copy read as coverage for as long as it existed.
      // ⚠⚠ EXACT TEXT, NOT WHITESPACE-NORMALIZED (`debt212223-xv2` finding 3). The
      // first version collapsed all whitespace runs, which in THIS registry destroys
      // meaning rather than formatting: these pins feed whitespace into string
      // literals as the test input (`- ${c}`, `-  ${c}x`, `## Title${c}`), so two
      // legitimately different fixtures differing only inside a literal — `['a b']`
      // vs `['a  b']` — compared equal and the guard would have blocked a valid
      // future pin. A guard that refuses correct work stops every run; this one has
      // no such direction now. The cost is deliberate and small: a copy that was
      // re-indented on the way in escapes detection. The defect this exists for is a
      // character-identical copy, which does not.
      const pinBodySeen = new Map();
      const duplicatePins = [];
      for (const [name, pin] of Object.entries(INVISIBLE_PINS)) {
        const body = pin.toString().replace(/\r\n/g, '\n');
        if (pinBodySeen.has(body)) duplicatePins.push(`${name} == ${pinBodySeen.get(body)}`);
        else pinBodySeen.set(body, name);
      }
      assert.deepEqual(
        duplicatePins, [],
        `these pins have character-identical bodies (after CRLF-to-LF normalization only), so the second certifies nothing the first does not: ${duplicatePins.join(', ')}. Rewrite it to ask about what its OWN construct decides (a consumer asks through its own api, as extractHeadings does), or drop the pin and record the relationship in ADEQUACY_VIA / NO_INVISIBLE_PIN instead.`
      );

      // The pins themselves, over the whole character class rather than NBSP
      // alone — the ban list's own escape list already covers seven characters,
      // so pinning one would be the same narrowness one level down.
      for (const [label, code] of [['NBSP', 0xa0], ['form feed', 0x0c], ['vertical tab', 0x0b]]) {
        const c = String.fromCharCode(code);
        for (const [name, pin] of Object.entries(INVISIBLE_PINS)) {
          assert.equal(pin(doctorChecks, c), true, `${name} treats ${label} as whitespace at a block start — it is not whitespace to CommonMark, and this is the defect class the guard exists to hold shut`);
        }
      }

      // ⚠⚠ MUTATION ADEQUACY — the half that was missing, and the reason five
      // consecutive rounds each defeated this guard.
      //
      // Everything above derives WHICH constructs need a pin. Nothing related a
      // pin's expression to the defect it names, so a pin could be satisfied by
      // a sibling's gate, by a value the function cannot produce, or by putting
      // the character where the construct never looks — and a review round was
      // the only thing that could tell. Three of the pins above were exactly
      // that when they shipped; one asserted `!== 'fence'` against a classifier
      // whose vocabulary contains no `'fence'`, so it was true for every input
      // and every module state.
      //
      // So: break each construct the way this class of defect actually arrives —
      // widen its whitespace class to admit U+00A0 — and require ITS OWN pin to
      // fail. A pin that survives its own construct being broken is decoration,
      // whatever it looks like.
      //
      // ⚠ Two guards on the harness itself, both learned the hard way. A mutant
      // that does not PARSE, and a mutant that parses but changes NOTHING, both
      // read exactly like a pin firing correctly. Every mutant is therefore
      // required to load and to move observable behaviour before its result is
      // believed — and a construct with no live mutant is reported, not skipped.
      {
        const NBSP_ESC = '\\u00a0';
        const moduleSource = await readFile(join(repoRoot, 'lib/doctor-checks.js'), 'utf8');
        // The byte range of a top-level declaration, from its own line to the
        // next top-level declaration. Deliberately NOT the comment-stripped
        // text the class guard uses: a mutant has to be a loadable module, so
        // the region must be spliced back verbatim.
        const declRegionRange = (source, name) => {
          const m = source.match(new RegExp(`^(?:const|let|var) ${name}\\s*=|^function ${name}\\(`, 'm'));
          if (!m) return null;
          const start = m.index;
          const rest = source.slice(start + 1);
          const next = rest.search(/\n(?:function |const |let |var )[A-Za-z_]/);
          return { start, end: next === -1 ? source.length : start + 1 + next };
        };
        const mutantDir = await mkdtemp(join(tmpdir(), 'dflow-mutadq-'));
        // The canary tells us a mutant actually changed something.
        //
        // ⚠ IT MUST CARRY THE INVISIBLE CHARACTER ITSELF. The first version was
        // an all-ASCII corpus, so a widening that only manifests on a U+00A0
        // line changed nothing in it, every mutant was classified "inert", and
        // the adequacy check reported all 21 pins UNTESTED — a harness that
        // silently measures nothing, which is the same shape as the pins it was
        // written to catch.
        const NB = String.fromCharCode(0xa0);
        // ⚠⚠ THIS LIST IS HAND-WRITTEN AND THAT IS EXACTLY THE DEFECT IT KEEPS
        // PRODUCING. `isThematicBreak` has three alternatives — `-`, `*` and `_`
        // — and this list carried `---` and `***` and not `___`. So a mutant
        // widening the underscore alternative changed nothing the canary looked
        // at, was classified INERT, and its pin was never asked: a cross-vendor
        // round weakened the `isThematicBreak` pin so it no longer covered `___`,
        // widened the module's `_` alternative, and the whole suite stayed GREEN
        // while real `doctor` flipped a stale file to `current`
        // (`p082-b3-k2` finding 2). SILENT PASS, in the machinery built to stop
        // silent passes.
        //
        // So the members are DERIVED from the module's own guarded regions
        // instead of remembered. Every punctuation character the block predicates
        // recognise becomes a base line in the three shapes those predicates
        // read: a run of three, a bare marker, and a marker with content. The
        // hand list stays for the shapes that are not single characters (tags,
        // fences, tables, indents), because those cannot be derived this way —
        // but no single-character alternative can go missing again.
        const derivedMarkerChars = (() => {
          const chars = new Set();
          for (const name of [...guardedConstructs.blockFunctions, ...guardedConstructs.blockConstants]) {
            const range = declRegionRange(moduleSource, name);
            if (!range) continue;
            const region = moduleSource.slice(range.start, range.end);
            // Character-class members and the `(X[ \t]*)` run form, which is how
            // a thematic-break alternative is spelled.
            for (const m of region.matchAll(/\[([^\]\n]*)\]|\((\\?.)\[/g)) {
              for (const ch of (m[1] || m[2] || '')) {
                if (/[-*_+.)#`|>=~:]/.test(ch)) chars.add(ch);
              }
            }
          }
          return [...chars].sort();
        })();
        // Watched failing: this is the assertion that would have caught the hole
        // above, and it is stated as the class rather than as `___`.
        for (const ch of ['-', '*', '_']) {
          assert.ok(derivedMarkerChars.includes(ch),
            `the marker-character derivation missed ${JSON.stringify(ch)}, so the canary cannot see a mutant of the alternative that uses it — which is how a decorative pin gets certified`);
        }
        const canaryBases = [
          '# H', '---', '***', '```js', '|---|---|', '<script>', '<!-- c -->', '<?x', '<!D', '<![CDATA[',
          '<div>', '- x', '-', '1. x', '> q', '> <details>', '- <details>', '    code', '\tcode', 'prose', '', ' ', 'a | b',
          ...derivedMarkerChars.flatMap((c) => [c.repeat(3), c, `${c} x`])
        ];
        // ⚠ The character must appear in EVERY position a whitespace class can
        // occupy — leading indent, immediately after the marker, inside the gap,
        // and trailing. A corpus that only prefixes it declared ten constructs
        // inert whose widenings were live; the shapes below are the ones that
        // turned out to matter, each found by measuring rather than by guessing.
        // ⚠⚠ THE CHARACTER GOES IN EVERY POSITION, and this is the only version
        // that works. Two earlier canaries hand-picked a few positions, and each
        // time a mutation that moved real behaviour was classified INERT because
        // no corpus line happened to carry the character where that construct
        // looks — which silently excused the very pin being tested. A
        // decorative pin is indistinguishable from an inert mutant unless
        // something observes the shape the mutation changes, so the corpus stops
        // guessing which shape that is.
        const canaryDocs = [];
        for (const base of canaryBases) {
          const variants = [base];
          for (let i = 0; i <= base.length; i += 1) {
            variants.push(base.slice(0, i) + NB + base.slice(i));
            variants.push(base.slice(0, i) + NB + 'x' + base.slice(i));
          }
          for (const v of variants) {
            canaryDocs.push([v]);
            canaryDocs.push(['prose', v]);
            canaryDocs.push(['| a | b |', v]);
            canaryDocs.push([v, '', '  continuation']);
            canaryDocs.push([v, '', 'unindented']);
            canaryDocs.push([v, '---']);
          }
        }
        // Marker + gap shapes, which is where the list family's own whitespace
        // classes live and where `listContentColumn` reads the content column.
        for (const marker of ['-', '*', '+', '1.', '1)']) {
          for (const gap of ['', ' ', '  ', NB, ' ' + NB, NB + ' ', '\t', ' \t']) {
            canaryDocs.push([marker + gap + 'x']);
            canaryDocs.push(['prose', marker + gap + 'x']);
            canaryDocs.push([marker + gap + 'x', '', '   cont']);
            canaryDocs.push([marker + gap]);
            canaryDocs.push(['prose', marker + gap]);
          }
        }
        const fenceDocs = [];
        for (const pre of ['', ' ', '   ', NB, ' ' + NB]) {
          for (const post of ['', ' ', NB]) {
            fenceDocs.push(['## A', pre + BT + 'js', '## Hidden', BT + post, '## After']);
            fenceDocs.push(['## A', BT, '## Hidden', pre + BT + post, '## After']);
          }
        }
        const canary = (dc) => canaryDocs.map((doc) => {
          // `rawHtml` is a block-context decision consumed by the comment
          // detectors even when the outer `type` remains list/blockquote. A
          // canary that serialises type alone cannot see this construct move.
          try { return dc.classifyLines(doc).map((c) => `${c.type}:${c.rawHtml ? 'raw' : 'inline'}`).join(''); } catch { return 'THREW'; }
        }).join(',') + '|' + [
          `## T${NB}`, `## ${NB}T`, '## T ', `##${NB}T`, `#${NB}T`, `## T${NB}##`
        ].map((h) => {
          try { const r = dc.parseAtxHeading(h); return String(r && r.text); } catch { return 'THREW'; }
        }).join(',') + '|' + fenceDocs.map((d) => {
          try { return dc.blankFencedBlocks(d.join('\n')).join('/'); } catch { return 'THREW'; }
        }).join(',') + '|' + [
          `${NB}# H`, `# H${NB}`, `${NB}## H`
        ].map((l) => {
          try { return dc.extractHeadings(l).join('+') + '/' + dc.extractH2Headings(l).join('+'); } catch { return 'THREW'; }
        }).join(',') + '|' + canaryDocs.map((doc) => {
          // ⚠ The visible-text projection, added because the canary serialised
          // `c.type` ONLY — so the newest user-facing rule in the module sat
          // entirely outside its field of view. Measured: making the type-1
          // opener non-capturing leaves every line still typed `html`, so the
          // canary saw nothing, while `<script>` content became visible again and
          // a stale file flipped to `current` (`p082-b3-k2` finding 3). The
          // direct pins caught that mutant; the ADEQUACY LAYER could not prove
          // they would, which is the difference between a check and a
          // certificate.
          try { return dc.visibleTextLines(doc.join('\n')).join('/'); } catch { return 'THREW'; }
        }).join(',');
        const pristineCanary = canary(doctorChecks);

        const loadMutant = async (source, tag) => {
          const file = join(mutantDir, `m-${tag}.cjs`);
          await writeFile(file, source, 'utf8');
          try { return (await import(`file://${file.replace(/\\/g, '/')}`)).default; } catch { return null; }
        };

        // The widenings, applied only inside the named declaration's own region.
        // They are DERIVED from the text rather than written per construct: any
        // `[ \t]` class gains U+00A0, and a bare `^ {0,3}` indent becomes a class
        // that admits it. A construct whose declaration has neither is reported
        // as having no live mutant rather than quietly passing.
        // ⚠ ANY character class that admits space and tab, not the literal
        // `[ \t]` alone. The first version matched only the exact spelling, so
        // `[ \t>]` — the tail of the HTML type-1 opener — was never widened, its
        // mutant was inert, and a decorative pin for that construct passed the
        // adequacy check. Watched failing: reverting that pin to its old
        // spelling is caught now and was not before.
        // ⚠⚠ ONE CLASS AT A TIME. The first version widened EVERY `[...]` in a
        // declaration at once and required only that the pin fail against that
        // single all-at-once mutant — so a pin exercising ONE of a construct's N
        // whitespace classes was certified adequate. Demonstrated on three
        // constructs with the suite green: `TABLE_DELIMITER_ROW_RE` has seven
        // `[ \t]*` classes and its pin looked at the trailing one;
        // `isThematicBreak` has three regexes and its pin looked at `-` only;
        // `parseAtxHeading`'s closing-sequence stripper has two and the pin
        // looked at one. "A pin that survives its own construct being broken is
        // decoration" is only true if every class it owns gets its own mutant.
        const classPositions = (s) => {
          const out = [];
          const re = /\[[^\]\n]*\]/g;
          let m;
          while ((m = re.exec(s)) !== null) {
            const inner = m[0].slice(1, -1);
            if (inner.includes(' ') && /\\\\?t/.test(inner) && !inner.includes('u00a0')) out.push(m.index);
          }
          return out;
        };
        const widenOneClass = (s, at) => {
          const m = /\[[^\]\n]*\]/y;
          m.lastIndex = at;
          const hit = m.exec(s);
          if (!hit) return s;
          return s.slice(0, at) + `[${hit[0].slice(1, -1)}${NBSP_ESC}]` + s.slice(at + hit[0].length);
        };
        const widenings = (region) => [
          ...classPositions(region).map((at, i) => [`class-${i}`, (s) => widenOneClass(s, at)]),
          ['indent', (s) => s.replace(/\^ \{0,3\}/g, `^[ ${NBSP_ESC}]{0,3}`)],
          ['indent-group', (s) => s.replace(/\^\( \{0,3\}\)/g, `^([ ${NBSP_ESC}]{0,3})`)]
        ];

        // ⚠ A pin can be valuable and still have nothing to mutate. These six
        // constructs own no whitespace CLASS: four are consumers that read
        // another construct's decision, one is gated by a sibling so its own
        // widening is unreachable, and one computes a column by comparing
        // characters rather than by matching a class. Their pins stay — they
        // pin real end-to-end behaviour — but their adequacy comes from the
        // construct named here.
        //
        // ⚠⚠ THIS IS THE "COVERED BY A SIBLING" CLAIM, WRITTEN DOWN AND CHECKED.
        // A review round found a pin resting on exactly this relationship by
        // accident, undeclared — it looked covered because another pin happened
        // to catch the same break. The difference between that and this is that
        // the target below is asserted to exist, to be pinned, and to have live
        // mutants of its own. An accidental overlap cannot survive that.
        const ADEQUACY_VIA = {
          extractHeadings: ['ATX_HEADING_RE', 'a consumer: it filters classifyLines output and adds no whitespace test'],
          extractH2Headings: ['ATX_HEADING_RE', 'a consumer: same, filtered to level 2'],
          blankFencedBlocks: ['FENCE_OPEN_RE', 'reads FENCE_OPEN_RE / FENCE_CLOSE_RE and adds no whitespace test of its own'],
          classifyLines: ['ATX_HEADING_RE', 'the cascade itself: every whitespace class it consults belongs to one of the constructs above']
        };
        // ⚠ A SEPARATE, STRONGER CATEGORY, and splitting it out is a correction.
        // Two entries used to sit in ADEQUACY_VIA claiming cover from a sibling;
        // the relation check below showed the claimed dependency does not exist.
        // The true statement about them is not "someone else catches it" but
        // "this widening cannot express a defect here at all" — and that is
        // machine-checkable as `liveCount === 0`, so it is asserted rather than
        // argued.
        const INERT_BY_CONSTRUCTION = {
          INTERRUPTING_ITEM_RE: 'no widening of it moves behaviour: a line it would newly match is already claimed further up the cascade, so the mutant is observationally identical',
          indentWidth: 'it compares characters to compute a column and owns no character class, so a class-widening cannot reach it. ⚠ Its ARITHMETIC is a separate defect surface and is NOT covered here — it has its own behavioural pin below, added after a reviewer changed `col += 4 - (col % 4)` to `col += 4` with the whole suite green'
        };
        for (const [name, [target]] of Object.entries(ADEQUACY_VIA)) {
          assert.ok(INVISIBLE_PINS[target], `${name} claims its adequacy comes from ${target}, which is not a pinned construct`);
        }
        const doubleClassified = Object.keys(INERT_BY_CONSTRUCTION).filter((n) => n in ADEQUACY_VIA);
        assert.deepEqual(doubleClassified, [], `both excused as inert and as covered by a sibling: ${doubleClassified.join(', ')}`);

        const noLiveMutant = [];
        const survived = [];
        const liveCount = {};
        const liveMutants = {};
        for (const [name, pin] of Object.entries(INVISIBLE_PINS)) {
          const region = declRegionRange(moduleSource, name);
          if (!region) { noLiveMutant.push(`${name} (declaration not found)`); continue; }
          let live = 0;
          const regionText = moduleSource.slice(region.start, region.end);
          for (const [tag, widen] of widenings(regionText)) {
            const mutatedRegion = widen(regionText);
            if (mutatedRegion === regionText) continue;
            const source = moduleSource.slice(0, region.start) + mutatedRegion + moduleSource.slice(region.end);
            const mutant = await loadMutant(source, `${name}-${tag}`);
            if (!mutant) continue;                                  // did not parse
            if (canary(mutant) === pristineCanary) continue;        // parsed, changed nothing
            live += 1;
            liveMutants[name] = liveMutants[name] || [];
            liveMutants[name].push([tag, mutant]);
            if (pin(mutant, String.fromCharCode(0xa0)) === true) {
              survived.push(`${name} (${tag})`);
            }
          }
          liveCount[name] = live;
          if (live === 0 && !ADEQUACY_VIA[name] && !INERT_BY_CONSTRUCTION[name]) noLiveMutant.push(name);
        }

        // A construct that claims cover from a sibling must not itself have live
        // mutants — if it does, the claim is hiding a real, testable defect —
        // and the sibling it names must actually be mutation-tested.
        const badlyExcused = [...Object.keys(ADEQUACY_VIA), ...Object.keys(INERT_BY_CONSTRUCTION)]
          .filter((name) => liveCount[name] > 0)
          .map((name) => `${name} (has ${liveCount[name]} live mutant(s) of its own)`);
        assert.deepEqual(badlyExcused, [], `these constructs claim their adequacy comes from a sibling, but their OWN widening is live and therefore testable: ${badlyExcused.join(', ')}. Remove the ADEQUACY_VIA entry and let the mutation check cover them directly.`);
        const hollowTargets = Object.entries(ADEQUACY_VIA)
          .filter(([, [target]]) => !(liveCount[target] > 0))
          .map(([name, [target]]) => `${name} -> ${target}`);
        assert.deepEqual(hollowTargets, [], `these constructs claim cover from a sibling that is itself untested by mutation, so the claim is empty: ${hollowTargets.join(', ')}`);

        // ⚠⚠ THE DEPENDENCY IS CHECKED, NOT DECLARED. The first version asserted
        // only that the named target exists, is pinned, and has live mutants —
        // which any pinned name satisfies. A reviewer pointed all six entries at
        // `BLOCKQUOTE_RE`, a construct none of them depends on, and the suite
        // stayed green: the comment claimed "an accidental overlap cannot
        // survive that" while the assertion enforced nothing of the kind.
        //
        // The real relation is testable with the mutants already loaded: if X is
        // covered by T, then breaking T must make X's OWN pin fail. If it does
        // not, X is not covered by T — whatever the comment says.
        const unrelated = [];
        for (const [name, [target, reason]] of Object.entries(ADEQUACY_VIA)) {
          const pin = INVISIBLE_PINS[name];
          const caught = (liveMutants[target] || []).some(([, mutant]) => pin(mutant, String.fromCharCode(0xa0)) !== true);
          if (!caught) unrelated.push(`${name} -> ${target} ("${reason}")`);
        }
        assert.deepEqual(
          unrelated, [],
          `these constructs are excused as covered by a sibling, but breaking that sibling does NOT make their own pin fail, so the dependency is not real: ${unrelated.join('; ')}`
        );

        assert.deepEqual(
          survived, [],
          `these pins PASS against a module whose own construct was widened to treat U+00A0 as whitespace, so they cannot fail against the defect they name: ${survived.join(', ')}. Rewrite the pin to ask about the construct's own whitespace class — not the indent it shares with every other opener, and not a value the function never produces.`
        );
        assert.deepEqual(
          noLiveMutant, [],
          `no mutant of these constructs both parsed and changed behaviour, so their pins are UNTESTED: ${noLiveMutant.join(', ')}. Either the widening does not reach them (extend the list) or the construct has no whitespace class of its own (move it to NO_INVISIBLE_PIN with that reason).`
        );
        await rm(mutantDir, { recursive: true, force: true });
      }
    }

    // The 0-3 space indent widening (`p082-b3-g2` finding 2 follow-on). It was
    // first left out of extractHeadings / extractH2Headings as a deliberate
    // asymmetry, then measured to be a plain divergence from the reference.
    // Pinned because it is a behaviour change to the cross-ref and
    // template-shape checks, which `p082-b3-g3` noted nothing covered.
    for (const indent of ['', ' ', '  ', '   ']) {
      assert.deepEqual(doctorChecks.extractH2Headings(`${indent}## Git Policy`), ['Git Policy'], `${indent.length}-space indented H2 is a heading`);
      assert.deepEqual(doctorChecks.extractHeadings(`${indent}#### Deep`), ['Deep'], `${indent.length}-space indented H4 is a heading`);
    }
    assert.deepEqual(doctorChecks.extractH2Headings('    ## Four spaces'), [], 'a 4-space indent is indented code, not a heading');
    assert.deepEqual(doctorChecks.extractHeadings('    #### Four spaces'), [], 'a 4-space indent is indented code, not a heading');

    // The `-` / `=` asymmetry, pinned at the predicate rather than only through
    // the shape matrix: a `-` run of 3+ is a thematic break, while NO `=` run
    // ever is. The old combined `(=+|-+)` pattern erased that and made a bare
    // `===` — ordinary paragraph text — look like a block-starting shape.
    for (const yes of ['---', '----', '***', '___', '- - -', '* * *', '_ _ _', '   ---']) {
      assert.ok(doctorChecks.isThematicBreak(yes), `${JSON.stringify(yes)} is a thematic break`);
    }
    for (const no of ['===', '=', '--', '**', '__', '-', '- a bullet', '    ---']) {
      assert.ok(!doctorChecks.isThematicBreak(no), `${JSON.stringify(no)} is NOT a thematic break`);
    }

    // The edition filter. Every shipped entry has `editions: null`, so this
    // branch is unreachable through findConventionsDrift and a test written
    // through it would prove nothing (`p082-b3-g1` finding 5). Debt 10 — the
    // greenfield DDD-Modeling-Depth fingerprint — is the known first user, so
    // the contract is pinned before it arrives rather than after.
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: null }, 'greenfield'), true, 'a shared entry applies to a resolved edition');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: null }, null), true, 'a shared entry applies when no edition could be resolved');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: ['greenfield'] }, 'greenfield'), true, 'an edition-specific entry applies to its own edition');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: ['greenfield'] }, 'brownfield'), false, 'an edition-specific entry does not apply to another edition');
    assert.equal(doctorChecks.fingerprintAppliesTo({ editions: ['greenfield'] }, null), false, 'an edition-specific entry is NOT evaluated when the edition is unknown — guessing would report a greenfield rule missing from a brownfield project');
    assert.deepEqual(
      doctorChecks.CONVENTIONS_FINGERPRINTS.concat(doctorChecks.CONVENTIONS_RETIRED).filter((fp) => fp.editions).map((fp) => fp.id),
      [],
      'no shipped entry is edition-specific yet — when the first one lands, add a findConventionsDrift case for it here'
    );

    // Retired strings (P082 G5's second fingerprint kind). Each must be
    // zero-match in the packaged templates AND the tutorial fixtures, or it
    // would fire on every project forever.
    for (const edition of ['greenfield', 'brownfield']) {
      const packaged = await readFile(join(repoRoot, `templates/${edition}/scaffolding/_conventions.md`), 'utf8');
      const fixture = await readFile(join(repoRoot, `tutorial/0${edition === 'greenfield' ? 1 : 2}-${edition}/outputs/dflow/specs/shared/_conventions.md`), 'utf8');
      for (const fp of doctorChecks.CONVENTIONS_RETIRED) {
        if (fp.editions && !fp.editions.includes(edition)) continue;
        assert.ok(!packaged.includes(fp.retired), `${edition} packaged _conventions.md must not contain the retired string for ${fp.id}`);
        assert.ok(!fixture.includes(fp.retired), `${edition} tutorial _conventions.md fixture must not contain the retired string for ${fp.id}`);
      }
      assert.deepEqual(doctorChecks.findConventionsDrift(fixture, edition), [], `the ${edition} tutorial _conventions.md fixture must be drift-free`);
    }

    // A row an adopter migrated CORRECTLY — same situation, escalated tier in the
    // form the current template teaches — must not be called retired. The
    // `ceremony-query-only-t2` anchor covered only the situation cell, so it
    // flagged this and told the developer to overwrite their own decision.
    const ceremonyRow = (row) => freshConventions.replace(
      '| {e.g. New Aggregate}',
      `${row}\n| {e.g. New Aggregate}`
    );
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremonyRow('| Adding a Query only (no write) | T1 (project convention) | We escalate all new reads |'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      [],
      'a correctly-escalated row carrying the same situation text is not reported as retired'
    );
    // ...while the retired row itself, bare tier and placeholder brace intact, is.
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremonyRow('| {e.g. Adding a Query only (no write)} | T2 | No Aggregate state change |'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      ['ceremony-query-only-t2:retired'],
      'the retired template row is still detected'
    );

    const withRetired = freshConventions.replace(
      '| {e.g. EF configuration tweak in Infrastructure} | T1 (project convention)',
      '| {e.g. EF configuration tweak in Infrastructure} | T3 if no Domain change'
    );
    assert.notEqual(withRetired, freshConventions, 'precondition: the retired-row injection applied');
    assert.deepEqual(
      doctorChecks.findConventionsDrift(withRetired, 'greenfield').map((d) => `${d.id}:${d.state}`),
      ['ceremony-ef-tweak-t3:retired'],
      'a retired PROPOSAL-082 row still present in the file is reported'
    );

    // False-positive controls (P082 requires these explicitly): a project that
    // added its OWN rows while keeping the rules must stay silent, and a
    // paraphrase of a rule is NOT the rule — the fingerprint is a substring
    // check and must not be described as understanding the text.
    const customRows = freshConventions.replace(
      '| {e.g. Domain Event payload extension} |',
      '| Our own row: nightly ETL schema touch | T1 (project convention) | We escalate anything the warehouse reads |\n| {e.g. Domain Event payload extension} |'
    );
    assert.notEqual(customRows, freshConventions, 'precondition: the custom-row injection applied');
    assert.deepEqual(doctorChecks.findConventionsDrift(customRows, 'greenfield'), [], 'project-added rows alongside the intact rules do not trigger drift');

    // Section boundaries: a `---` closes a section only where CommonMark says so.
    // Both directions have shipped a defect, so both are pinned here.
    const tail = '\n\n## Filling the Templates\n\nno-BR family variants\n\n### SPEC-ID Format\n\nMinimal (zero-phase) host exception\n';
    const ceremony = (body) => `## Ceremony Scaling (Project Application)\n\n${body}${tail}`;

    // Prose containing a pipe is NOT a table row. Testing `line.includes('|')`
    // made a `---` after such a line stop closing the section, so the body ran
    // on and matched the marker in a LATER section — reporting `current` for a
    // section that does not carry the rule. Silent success.
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremony('We escalate any change to the Command | Query split.\n---\n\nHistorical note: we dropped the wording that the cascade result is a floor.'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      ['ceremony-escalate-only:stale'],
      'a setext underline after pipe-bearing PROSE still closes the section — the body must not run on into the next one'
    );

    // A real table row is not a paragraph, so `---` after one is not setext.
    for (const delimiter of ['|---|---|', '|:---|---:|']) {
      assert.deepEqual(
        doctorChecks.findConventionsDrift(
          ceremony(`| a | b |\n${delimiter}\n| cascade result is a floor | x |\n---`),
          'greenfield'
        ),
        [],
        `a \`---\` after a table row (delimiter ${delimiter}) is a thematic break, not a heading`
      );
    }

    // ---------------------------------------------------------------------
    // The `isParagraphLine` shape matrix.
    //
    // Every exclusion in that predicate was added REACTIVELY, after a review
    // round found the case — which is why two consecutive rounds each produced
    // a defect there, one in each direction. The predicate itself was never the
    // hard part; having no systematic test was. Each row pins one shape in both
    // underline forms, so a new exclusion has to declare its expectation
    // instead of being discovered.
    //
    // ⚠ WHAT THIS DOES **NOT** CLAIM, because an earlier version of this
    // sentence claimed it and was wrong: it does not pin "every shape", and a
    // green run is not evidence that every branch of the predicate is reached.
    // The first version of this matrix said it pinned every shape while no row
    // reached the "another underline" branch at all — and four live divergences
    // were sitting in the shapes nobody had written down. The list is only ever
    // as good as its enumeration; adding a branch means adding rows here AND in
    // the differential.
    //
    // ⚠ The expectations are MEASURED, not reasoned. The arbiter is
    // `commonmark@0.31.2` (the spec's own implementation) via
    // `commonmark-differential.mjs` in the review-records folder, which carries
    // the same shapes. `marked` — this repo's own dependency — is NOT
    // conformant on several of them, and two shipped defects came from
    // settling a shape by argument instead of by measurement. Re-run the
    // differential before changing `isParagraphLine`, `isThematicBreak`,
    // `headingAt`, `blockStartIndex` or `isTableLine`.
    //
    // Method: put <shape> then <underline> inside a section, with a SENTINEL
    // line after. If the underline is a heading the section ended, so SENTINEL
    // is NOT in its body; if it is not a heading, SENTINEL IS.
    // ---------------------------------------------------------------------
    {
      const SENTINEL = 'SENTINEL-MARKER-LINE';
      // ⚠ POSITION MATTERS, and the table states it. Each row's shape is placed
      // at a BLOCK START (immediately after a blank line) unless the row itself
      // supplies the preceding lines — the `wrapped …` rows do exactly that, to
      // pin the continuation position. Several shapes flip between the two
      // positions, which is precisely where the two shipped parser defects
      // lived, so a row asserting only the block-start case would be stating an
      // unconditional expectation it cannot support.
      //
      // [label, shape lines, is a setext heading when followed by an underline]
      const shapes = [
        ['plain paragraph', ['Some ordinary prose.'], true],
        ['prose containing a pipe', ['The Command | Query split.'], true],
        ['prose with 1-3 space indent', ['   indented prose'], true],
        ['single word', ['Heading'], true],
        ['4-space indent (code block)', ['    indented code'], false],
        ['tab indent (code block)', ['\tindented code'], false],
        // Deliberately deeper than the target section: a `##` here would end the
        // section on its own and the case would prove nothing about the
        // underline, which is what this matrix is isolating.
        ['ATX heading (deeper level)', ['#### Some Heading'], false],
        ['bullet list item', ['- a bullet'], false],
        ['star list item', ['* a bullet'], false],
        ['numbered list item', ['1. a step'], false],
        ['blockquote', ['> quoted'], false],
        ['HTML comment', ['<!-- a note -->'], false],
        ['blank line', [''], false],
        ['whitespace-only line', ['   '], false],
        ['table row (pipe delimiter)', ['| a | b |', '|---|---|', '| c | d |'], false],
        ['table row (pipeless delimiter)', ['a | b', '---|---', 'c | d'], false],
        // Continuation lines. Judged by their own shape these look like
        // paragraphs, which is how a wrapped bullet's second line came to end a
        // section early and lose the marker it carried. `marked` lexes
        // `- a\n  b\n---` as `list , hr`.
        ['wrapped bullet (continuation)', ['- a bullet that wraps onto the', '  next line here'], false],
        ['wrapped numbered item', ['1. a step that wraps onto the', '   next line here'], false],
        ['wrapped blockquote', ['> quoted text that wraps onto', '  the next line here'], false],
        // A wrapped ordinary paragraph is still a paragraph, so an underline
        // after it IS a heading — the fix for the above must not swallow this.
        ['wrapped plain paragraph', ['ordinary prose that wraps onto', 'the next line here'], true],
        // Shapes that CANNOT interrupt a paragraph are part of it, so the
        // underline closes the whole thing as a setext heading. Judging these by
        // their own shape made the section run on instead — silent pass.
        // Every expectation below was measured against the CommonMark reference
        // implementation, not reasoned about; see the note on isParagraphLine.
        ['paragraph then 4-space indent', ['ordinary prose', '    indented continuation'], true],
        ['paragraph then tab indent', ['ordinary prose', '\ttabbed continuation'], true],
        ['paragraph then ordered 2.', ['ordinary prose', '2. not starting at one'], true],
        // ...while these DO interrupt, so the paragraph already ended and the
        // underline has no paragraph to close.
        ['paragraph then bullet', ['ordinary prose', '- a bullet'], false],
        ['paragraph then ordered 1.', ['ordinary prose', '1. starting at one'], false],
        ['paragraph then blockquote', ['ordinary prose', '> quoted'], false],
        ['paragraph then HTML comment', ['ordinary prose', '<!-- c -->'], false],
        // Directly under a leaf block that ends on its own line, the shape is at
        // a REAL block start — so the block-start exclusions apply and the
        // underline is not setext. Walking back over such lines treated these as
        // prose continuations, and the identical line one position further down
        // was judged correctly. Every matrix row before these sat after a blank
        // line or after a paragraph/list/blockquote, which is why nothing caught
        // it. `marked` agrees on all four.
        ['ordered 2. directly under a heading', ['#### A Heading', '2. a step'], false],
        ['4-space indent directly under a heading', ['#### A Heading', '    indented code'], false],
        ['ordered 2. directly under a thematic break', ['***', '2. a step'], false],
        ['ordered 2. directly under an HTML comment', ['<!-- n -->', '2. a step'], false],
        // ⚠ EVERY ROW BELOW WAS MISSING, AND FOUR OF THEM WERE LIVE DEFECTS.
        // A cross-vendor round read the claim above and asked which case reaches
        // the predicate's own "another underline" branch. None did — every row
        // above puts prose, a list, a quote or a heading before the underline,
        // never a break or a bare marker. It filed that as a coverage-claim
        // defect; widening the differential turned it into four divergences
        // from the CommonMark reference, one silent-pass and three
        // content-losing. The lesson is the cheap one: an unreached branch is
        // not "merely untested", it is untested AND unmeasured.
        //
        // `-` and `=` are NOT symmetric, which is what the old combined
        // `(=+|-+)` pattern erased: a `-{3,}` run is a thematic break, while
        // ANY `=+` run is ordinary paragraph text that an underline can close.
        ['bare --- (thematic break)', ['---'], false],
        ['bare ---- (thematic break)', ['----'], false],
        ['bare -- (too short for a break, so prose)', ['--'], true],
        ['bare === (prose, NOT a break)', ['==='], true],
        ['bare = (prose)', ['='], true],
        ['bare *** (thematic break)', ['***'], false],
        ['bare ** (too short, so prose)', ['**'], true],
        ['bare ___ (thematic break)', ['___'], false],
        ['bare __ (too short, so prose)', ['__'], true],
        ['spaced - - - (thematic break)', ['- - -'], false],
        ['spaced * * * (thematic break)', ['* * *'], false],
        ['spaced _ _ _ (thematic break)', ['_ _ _'], false],
        // A list marker with nothing after it is an EMPTY list item, not prose.
        // The bullet/ordered tests required whitespace after the marker, so a
        // bare `-` read as a paragraph and the following `---` ended the section
        // early — the pop then deleted the marker line.
        ['bare - (empty list item)', ['-'], false],
        ['bare * (empty list item)', ['*'], false],
        ['bare + (empty list item)', ['+'], false],
        ['bare 1. (empty ordered item)', ['1.'], false],
        ['bare 2. (empty ordered item)', ['2.'], false],
        ['bare 1) (empty ordered item)', ['1)'], false],
        // Blank-line separated so the break/underline sits at a real block
        // start rather than continuing the paragraph.
        ['paragraph, blank, then ===', ['ordinary prose', '', '==='], true],
        ['paragraph, blank, then ***', ['ordinary prose', '', '***'], false],
        ['paragraph, blank, then ---', ['ordinary prose', '', '---'], false],
        // ⚠ These test `blockStartIndex` / `closesOwnBlock`, not a line's own
        // shape, and they are where the SAME defect class turned up a second
        // time. After `isParagraphLine` stopped conflating `=` with `-`, the
        // conflation was still sitting in `closesOwnBlock`, which called any
        // `=+` run block-closing. A bare `===` is paragraph TEXT, so the line
        // after it continues that paragraph and a shape that cannot interrupt
        // a paragraph must not be read as a new block. Two of the rows below
        // were live silent-pass defects when first measured.
        ['=== then ordered 2. (continuation)', ['===', '2. a step'], true],
        ['=== then ordered 2) (continuation)', ['===', '2) a step'], true],
        ['=== then 4-space (continuation)', ['===', '    indented code'], true],
        ['=== then tab (continuation)', ['===', '\tindented code'], true],
        ['=== then prose (continuation)', ['===', 'continuation text'], true],
        ['=== then ordered, twice', ['===', '2. a step', '3. another'], true],
        // ...but shapes that DO interrupt a paragraph end it, so the underline
        // has no paragraph left to close.
        ['=== then bullet (interrupts)', ['===', '- a bullet'], false],
        ['=== then blockquote (interrupts)', ['===', '> quoted'], false],
        ['=== then ATX (interrupts)', ['===', '#### H'], false],
        // A `=+` run is only an underline when something above it is a
        // paragraph. After a heading, a comment or a break it is plain text.
        ['ATX, ===, ordered 2.', ['#### H', '===', '2. a step'], true],
        ['comment, ===, ordered 2.', ['<!-- c -->', '===', '2. a step'], true],
        ['break, ===, ordered 2.', ['***', '===', '2. a step'], true],
        ['para, ===, ordered 2.', ['ordinary prose', '===', '2. a step'], true],
        ['para, blank, ===, ordered 2.', ['ordinary prose', '', '===', '2. a step'], true],
        ['single = then ordered 2.', ['=', '2. a step'], true],
        ['-- then ordered 2.', ['--', '2. a step'], true],
        ['setext h1 then ordered 2.', ['title', '===', '2. a step'], true],
        ['setext h2 then ordered 2.', ['title', '---', '2. a step'], true],
        ['blockquote then 4-space', ['> quoted', '    indented code'], false],
        ['bullet then ordered 2.', ['- a bullet', '2. a step'], false],
        ['nested blockquote, lazy continuation', ['> outer', '> > inner', 'lazy continuation'], false],
        ['list, blank, new paragraph', ['- a bullet', '', 'new paragraph'], true]
      ];

      for (const [label, shapeLines, isHeading] of shapes) {
        for (const underline of ['---', '===']) {
          const doc = [
            '## Target Section',
            '',
            ...shapeLines,
            underline,
            '',
            SENTINEL,
            '',
            '## Next Section',
            ''
          ].join('\n');
          const bodies = doctorChecks.conventionsSectionBodies(doc, 'Target Section');
          assert.equal(bodies.length, 1, `${label} + ${underline}: expected exactly one Target Section body`);
          const sentinelInBody = bodies[0].includes(SENTINEL);
          assert.equal(
            sentinelInBody,
            !isHeading,
            isHeading
              ? `${label} + ${underline}: this IS a setext heading, so the section must end before ${SENTINEL}`
              : `${label} + ${underline}: this is NOT a setext heading, so the section must continue past it and still contain ${SENTINEL}`
          );
        }
      }

      // An underline as the very first line has no preceding line to close.
      assert.equal(
        doctorChecks.conventionsSectionBodies('---\n\n## Target Section\n\nbody text\n', 'Target Section').length,
        1,
        'a leading underline must not crash or swallow the document'
      );
    }

    // Retired anchors must not fire on legitimate adopter prose. Two shorter
    // anchors shipped and both did: `criteria table`, then
    // `for the full criteria table`.
    for (const sentence of [
      'We keep a fuller decision matrix elsewhere; see that document for the full criteria table.',
      'Ask the architecture guild for the full criteria table we agreed on.',
      'Our own criteria table below records the escalations we apply.'
    ]) {
      assert.deepEqual(
        doctorChecks.findConventionsDrift(freshConventions.replace('situations.', `situations. ${sentence}`), 'greenfield'),
        [],
        `adopter prose must not be reported as retired Dflow text: "${sentence}"`
      );
    }
    // ...while the real retired sentence still fires, including soft-wrapped.
    assert.deepEqual(
      doctorChecks.findConventionsDrift(
        ceremony('See `AI-AGENT-GUIDE.md` § Ceremony Scaling for the full\ncriteria table.\n\ncascade result is a floor'),
        'greenfield'
      ).map((d) => `${d.id}:${d.state}`),
      ['ceremony-criteria-table:retired'],
      'the actual retired pointer is still detected across its soft wrap'
    );

    const paraphrased = freshConventions.replace('cascade result is a floor', 'cascade outcome is a lower bound');
    assert.deepEqual(
      doctorChecks.findConventionsDrift(paraphrased, 'greenfield').map((d) => `${d.id}:${d.state}`),
      ['ceremony-escalate-only:stale'],
      'a paraphrase does not satisfy the fingerprint — this is a substring check, and saying so is the point'
    );
  }

  // ---------------------------------------------------------------------------
  // (14) PROPOSAL-091 — the two false-clean paths.
  //
  // ⚠⚠ EVERY CASE BELOW IS A MUTATION WITH ITS OWN CONTROL, and the controls are
  // not ceremony: this whole proposal is about checks that go SILENT, and a
  // silent check passes any assertion that only looks for the absence of a
  // string. So each pair asserts that the intact fixture reaches
  // `All checks passed` first — without that, a finding that stopped firing for
  // an unrelated reason would read as a pass here forever.
  // ---------------------------------------------------------------------------
  {
    const MANIFEST_REL = 'dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json';
    const GP_TRUNK_REL = 'dflow/specs/shared/Git-principles-trunk.md';
    const SKILL_MARKER = '<!-- dflow-generated: skill-adapter -->';

    // A project whose edition cannot be inferred by EITHER resolver: no manifest
    // (so the authoritative answer is gone) and none of the structural signals
    // either. This is the state gates 2 and 4 are about.
    //
    // ⚠ ALL THREE STRUCTURAL SIGNALS, NOT ONE. `inferExistingEdition` falls back
    // through `architecture/tech-debt.md`, `migration/tech-debt.md` and THEN
    // `domain/context-map.md`, and the first version of this fixture removed
    // only the first: the edition stayed inferable, both route-(B) assertions
    // below still saw a single candidate, and the multi-track path they exist to
    // cover was never executed. A fixture that quietly stops reaching the branch
    // it names is the same failure this whole section is about.
    const unknownEdition = async (dir) => {
      await unlink(join(dir, MANIFEST_REL));
      await rm(join(dir, 'dflow/specs/architecture'), { recursive: true, force: true });
      await rm(join(dir, 'dflow/specs/migration'), { recursive: true, force: true });
      await rm(join(dir, 'dflow/specs/domain'), { recursive: true, force: true });
      assert.equal(
        await init.inferProjectBundleEdition(dir), null,
        'the unknown-edition fixture must actually leave the edition uninferable, or every route (B) assertion below passes vacuously'
      );
    };

    // --- Gate 1: a missing `## Git Policy` value must not switch off the whole
    // Git-principles block. The value decides WHICH starter to compare against;
    // which starter files exist is visible on disk, so route (B) checks each one.
    {
      const p = await newProject('2');
      const control = await runDoctorAt(p);
      assert.match(control.stdout, /All checks passed/, 'gate 1 control: the fixture must start clean, or the mutations below prove nothing');

      const conventions = await readFile(join(p, CONVENTIONS_REL), 'utf8');
      await writeFile(join(p, CONVENTIONS_REL), conventions.replace(/^Selected Git policy: .*$/m, 'Selected Git policy: (unset)'));

      // Still pristine: an unreadable policy must not manufacture drift either.
      const unsetPristine = await runDoctorAt(p);
      assert.doesNotMatch(unsetPristine.stdout, /Git-principles-trunk\.md canonical sections differ/, 'route (B) must not report drift against a pristine starter');

      const starter = await readFile(join(p, GP_TRUNK_REL), 'utf8');
      await writeFile(join(p, GP_TRUNK_REL), starter.replace('## 1. Branch Structure', '## 1. Branch Structure\n\nEDITED INSIDE THE CANONICAL REGION.'));
      const unsetDrifted = await runDoctorAt(p);
      // ⚠ THIS EXACT LINE IS THE DEFECT PROPOSAL-091 OPENED WITH. Before route
      // (B), deleting one line from `_conventions.md` hid this finding — and it
      // is the only detection channel for the 66-line drift PROPOSAL-090 fixed.
      assert.match(unsetDrifted.stdout, /Git-principles-trunk\.md canonical sections differ/, 'gate 1: an unrecorded Git policy must not switch off the starter drift check');
      // ⚠ And the advice has to survive the same move. With no policy recorded
      // `configure-agents` declines to touch any Git principles file, so an
      // unqualified "run configure-agents" would be a false claim about a
      // sibling command — the class this check has already corrected twice.
      assert.match(unsetDrifted.stdout, /Restore the `## Git Policy` section/, 'gate 1: the action must say what to do first, because configure-agents declines while the policy is unrecorded');

      // Route (A), the fallback and the ONLY shape where the missing value
      // really does stop the check: nothing on disk to compare.
      await unlink(join(p, GP_TRUNK_REL));
      const nothingToCheck = await runDoctorAt(p);
      assert.match(nothingToCheck.stdout, /The Git-principles starter checks did not run/, 'gate 1: with no policy AND no starter file, doctor must say which checks did not run');
    }

    // --- Gates 2 and 3: `checkFeatureIndexShape`.
    {
      const p = await newProject('2');
      await unknownEdition(p);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'gate 2 control: an unknown-edition project with no features must still be clean');

      const featureDir = join(p, 'dflow/specs/features/active/BR-001-probe');
      await mkdir(featureDir, { recursive: true });
      const currentTemplate = await readFile(join(p, 'dflow/specs/shared/dflow-workflows/templates/_index.md'), 'utf8');
      await writeFile(join(featureDir, '_index.md'), currentTemplate);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'gate 2 control: a current-shape _index.md must stay clean even when the edition is unknown');

      await writeFile(join(featureDir, '_index.md'), '# BR-001 probe\n\n## Goals & Scope\n\nonly this one section.\n');
      const staleShape = await runDoctorAt(p);
      // ⚠ The edition is a fact about the PROJECT'S SHAPE; it says nothing about
      // whether the adopter's dashboard is stale. Before route (B) this returned
      // before reading a single feature and reported nothing at all.
      assert.match(staleShape.stdout, /_index\.md looks like an older _index\.md template shape/, 'gate 2: an unknown edition must not switch off the feature dashboard shape check');
      assert.match(staleShape.stdout, /every shipped track was checked and this file matches none of them/, 'gate 2: with the track unknown the report must say every track was checked');
    }

    // --- Gates 4, 5, 6: `checkGuideCanonicalState`.
    {
      const p = await newProject('2');
      await unknownEdition(p);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'gate 4 control: a pristine guide must stay clean when the edition is unknown');

      const guide = await readFile(join(p, GUIDE_REL), 'utf8');
      await writeFile(join(p, GUIDE_REL), guide.replace(START, `${START}\n\nEDITED INSIDE THE MANAGED REGION.`));
      const guideDrift = await runDoctorAt(p);
      assert.match(guideDrift.stdout, /AI-AGENT-GUIDE\.md canonical content differs from this CLI version/, 'gate 4: an unknown edition must not switch off the guide canonical comparison');
      assert.match(guideDrift.stdout, /every shipped track was checked and the region matches none of them/, 'gate 4: with the track unknown the report must say every track was checked');
    }

    // --- Gate 7: absent and corrupt are different states, and only one of them
    // is legal. `configure-agents` already splits them; doctor was the only one
    // of the three that could not.
    {
      const p = await newProject('2');
      const manifestPath = join(p, MANIFEST_REL);
      const manifest = await readFile(manifestPath, 'utf8');

      await unlink(manifestPath);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'gate 7: an absent manifest is the legal never-projected state and must stay silent');

      await writeFile(manifestPath, '{ not json');
      const corrupt = await runDoctorAt(p);
      assert.match(corrupt.stdout, /\.dflow-bundle-manifest\.json could not be read/, 'gate 7: a corrupt manifest is damage and must be reported');
      assert.doesNotMatch(corrupt.stdout, /All checks passed/, 'gate 7: a corrupt manifest must not read as healthy');

      await writeFile(manifestPath, manifest);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'gate 7: restoring the manifest must clear the finding');
    }

    // --- Problem 1: `checkAdapterAndSkillState`, all seven rows of the decision
    // table. R3: judge what is there, say nothing about what is not.
    {
      const p = await newProject('1,2,3');
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'adapter control: a fresh init must be clean — R3 is designed to be silent here, and PROPOSAL-084 invariant 4 requires it');

      // ⚠⚠ ROW 5 IS THE ACCEPTED RESIDUAL RISK, AND IT IS PINNED AS A BEHAVIOUR
      // rather than left to chance. `p097-y1` measured doctor's output as
      // byte-identical before and after deleting the whole `.claude/` layer;
      // after this check exists, "the whole layer is gone" must STILL be silent,
      // because the two states doctor would have to separate — never wanted them
      // vs. had them and lost them — are identical on disk. Detecting absence
      // was specified three times and each version misfired on a population
      // PROPOSAL-037 actively recommends. Disclosed in
      // `docs/doctor-uncertainty.md`; if `command-adapters-install-by-default`
      // ever lands, this assertion is the one to revisit.
      const beforeNuke = (await runDoctorAt(p)).stdout;
      await rm(join(p, '.claude'), { recursive: true, force: true });
      await rm(join(p, '.agents'), { recursive: true, force: true });
      await rm(join(p, '.github/skills'), { recursive: true, force: true });
      const afterNuke = (await runDoctorAt(p)).stdout;
      assert.equal(afterNuke, beforeNuke, 'row 5: removing the entire adapter and skill layer must not change doctor output by one byte — this is the accepted residual risk, not an oversight');
    }
    {
      // Row 1, claude: its own directory, so the unit is the file count.
      const p = await newProject('1,2,3');
      const adapterRun = await runConfigure(p, ['1,2,3', 'y'], { commandAdapters: true });
      assert.equal(adapterRun.code, 0, `--command-adapters run failed\n${adapterRun.all}`);
      // ⚠ Prove the generation happened before asserting on its silence. A run
      // that produced nothing also produces a clean doctor — via row 5, the
      // deliberate silence — so "clean" alone cannot tell a working full set
      // from an adapter layer that was never written.
      assert.deepEqual(
        (await readdir(join(p, '.claude/commands/dflow'))).sort().length, 11,
        'the control needs a genuinely complete adapter set, or its silence proves nothing'
      );
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'row 1 control: a full generated adapter set must be silent');

      await unlink(join(p, '.claude/commands/dflow/status.md'));
      const partialClaude = await runDoctorAt(p);
      assert.match(partialClaude.stdout, /`\.claude\/commands\/dflow\/` has 10 of 11 Dflow command adapters/, 'row 1: a partial claude set must be reported with the count');
      assert.match(partialClaude.stdout, /Missing: status/, 'row 1: the finding must name which ones are missing');

      // Row 1, copilot: `.github/prompts/` is a SHARED namespace, so the unit is
      // the `dflow-` glob. Judging the directory would let an unrelated prompt
      // file raise the severity by one level.
      await unlink(join(p, '.github/prompts/dflow-next.prompt.md'));
      assert.match((await runDoctorAt(p)).stdout, /`\.github\/prompts\/dflow-\*\.prompt\.md` has 10 of 11 Dflow command adapters/, 'row 1: copilot is judged by the dflow-* glob');
    }
    {
      // Row 5 again, from the other side: a shared `.github/prompts/` that holds
      // only the user's own prompts is NOT a partial Dflow set.
      const p = await newProject('1,2,3');
      await mkdir(join(p, '.github/prompts'), { recursive: true });
      await writeFile(join(p, '.github/prompts/my-own.prompt.md'), '# not a dflow prompt\n');
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'row 5: an unrelated prompt file must not make the absent Dflow set look like a partial one');
    }
    {
      // Row 2: 0.5.0 filenames. Derived from LEGACY_COMMAND_ADAPTERS, and
      // reported on the file's own evidence — doctor has no selected-agent list
      // to gate on, and does not need one.
      const p = await newProject('1,2,3');
      await mkdir(join(p, '.claude/commands/dflow'), { recursive: true });
      await writeFile(join(p, '.claude/commands/dflow/dflow-status.md'), '# legacy\n');
      const legacy = await runDoctorAt(p);
      assert.match(legacy.stdout, /still use the Dflow 0\.5\.0 filename/, 'row 2: a 0.5.0-era filename left behind must be reported');
    }
    {
      // Rows 3, 4 and 7. ⚠⚠ ROW 7 IS WHY THIS CHECK IS NOT CALLED
      // `checkCommandAdapters`: codex has NO command adapter, but it DOES have a
      // skill at `.agents/skills/dflow/SKILL.md`. Two review rounds caught a
      // draft that wrote "codex is silent" wholesale, which deletes a third of
      // the coverage of the only row in this proposal with a measurement behind
      // it (three SKILL.md files still on 0.14.0 wording while doctor said
      // `All checks passed`). All three paths are asserted, individually.
      for (const rel of ['.claude/skills/dflow/SKILL.md', '.agents/skills/dflow/SKILL.md', '.github/skills/dflow/SKILL.md']) {
        const p = await newProject('1,2,3');
        assert.match((await runDoctorAt(p)).stdout, /All checks passed/, `row 3 control (${rel}): a freshly projected skill must be silent`);

        const skillPath = join(p, rel);
        const skill = await readFile(skillPath, 'utf8');
        assert.ok(skill.includes(SKILL_MARKER), `${rel} must carry the Dflow marker, or rows 3 and 4 cannot be told apart`);

        await writeFile(skillPath, skill.replace('Dflow SDD/DDD workflow guardian.', 'Dflow SDD/DDD workflow guardian. STALE WORDING FROM AN OLDER RELEASE.'));
        const stale = await runDoctorAt(p);
        assert.match(stale.stdout, new RegExp(`${rel.replace(/[./]/g, '\\$&')} differs from the skill this CLI projects`), `row 3/7: a stale marker-bearing skill at ${rel} must be reported`);

        // Row 4: strip the marker and the same edited file becomes the user's
        // own, which the overwrite guard in `addSkillAdapterItems` already
        // treats as theirs. Doctor must not report drift against a template it
        // is not the source of.
        await writeFile(skillPath, skill.replace(SKILL_MARKER, '').replace('Dflow SDD/DDD workflow guardian.', 'MY OWN SKILL.'));
        assert.doesNotMatch((await runDoctorAt(p)).stdout, /differs from the skill this CLI projects/, `row 4: a marker-less ${rel} is the user's file and must be silent`);
      }
    }

    // --- ⚠⚠ A DAMAGED PACKAGE MUST NOT PRODUCE A FALSE *DIRTY* EITHER.
    // Route (B)'s claim is "your file matches NONE of the shipped tracks". With
    // the edition unknown and one packaged candidate unreadable, that premise is
    // unestablished — and both checks used to compare against whatever survived
    // and report drift anyway, contradicting the package finding they had just
    // pushed, which says in its own words that the report cannot say whether the
    // file is current.
    // ⚠ Both siblings are asserted, not just the one a round reproduced. The
    // `_index.md` half is currently latent — both editions ship the same H2 set,
    // so a file matching one matches the other — and a latent defect is exactly
    // the kind that needs a test rather than a comment.
    {
      const damagedPkg = join(tempRoot, 'damaged-package');
      await mkdir(damagedPkg, { recursive: true });
      for (const dir of ['bin', 'lib', 'templates', 'node_modules']) {
        await cp(join(repoRoot, dir), join(damagedPkg, dir), { recursive: true });
      }
      await cp(join(repoRoot, 'package.json'), join(damagedPkg, 'package.json'));
      const damagedDoctor = async (cwd) => {
        const { spawnSync } = await import('node:child_process');
        const r = spawnSync(process.execPath, [join(damagedPkg, 'bin', 'dflow.js'), 'doctor'], {
          cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024
        });
        return r.stdout || '';
      };

      const p = await newProject('2');
      await unknownEdition(p);
      // Control: the same damaged-package harness on an intact package must be
      // clean, or the mutation below proves nothing about the damage.
      assert.match(await damagedDoctor(p), /All checks passed/, 'damaged-package control: the fixture must be clean while the copied package is still intact');

      // The project guide is pristine GREENFIELD. Break only the greenfield
      // packaged guide, leaving brownfield readable.
      await unlink(join(damagedPkg, 'templates/greenfield/scaffolding/AI-AGENT-GUIDE.md'));
      const guideOut = await damagedDoctor(p);
      assert.match(guideOut, /The installed dflow package looks incomplete/, 'a packaged guide that cannot be read must still be reported');
      assert.doesNotMatch(guideOut, /canonical content differs from this CLI version/, 'a pristine guide must NOT be reported as drifted just because the track it actually matches is the unreadable one');

      // Same shape for the sibling: a feature dashboard copied verbatim from the
      // current greenfield template, with the greenfield template unreadable.
      //
      // ⚠⚠ THE BROWNFIELD TEMPLATE IS DELIBERATELY GIVEN AN EXTRA SECTION, and
      // without that this whole case is VACUOUS. Both shipped `_index.md`
      // templates carry the same H2 set today, so a file matching one matches
      // the other and doctor stays silent whether or not the guard is right —
      // measured: reverting the fix left this assertion green. Manufacturing the
      // divergence is what turns "currently unobservable" into "pinned", and the
      // day the two tracks genuinely diverge this test is already in place.
      const brownTemplatePath = join(damagedPkg, 'templates/brownfield/templates/_index.md');
      await writeFile(
        brownTemplatePath,
        `${await readFile(brownTemplatePath, 'utf8')}\n## Brownfield Only Section\n\nmanufactured divergence, see the comment in test/upgrade-drift.mjs\n`
      );
      const featureDir = join(p, 'dflow/specs/features/active/BR-002-damaged');
      await mkdir(featureDir, { recursive: true });
      await cp(join(repoRoot, 'templates/greenfield/templates/_index.md'), join(featureDir, '_index.md'));

      // Two controls, and the first version of this had them wrong — worth
      // stating, because getting them wrong is the failure this block is about.
      //
      // (i) The comparison must be LIVE in this fixture. A file matching neither
      // template is reported while both are readable.
      await writeFile(join(featureDir, '_index.md'), '# BR-002\n\n## Goals & Scope\n\nmatches neither track.\n');
      assert.match(await damagedDoctor(p), /looks like an older _index\.md template shape/, 'divergence control (i): the comparison must actually run in this fixture');

      // (ii) ⚠ A greenfield-verbatim file must be SILENT while both templates
      // are readable — it matches a candidate, and route (B) clears on any
      // match. An earlier draft asserted the opposite here and failed; that
      // silence is the rule working, not the fixture failing to arm.
      await cp(join(repoRoot, 'templates/greenfield/templates/_index.md'), join(featureDir, '_index.md'));
      assert.doesNotMatch(await damagedDoctor(p), /looks like an older _index\.md template shape/, 'divergence control (ii): matching one readable candidate clears the file');

      await unlink(join(damagedPkg, 'templates/greenfield/templates/_index.md'));
      const indexOut = await damagedDoctor(p);
      assert.match(indexOut, /packaged feature dashboard template is unusable/, 'a packaged _index.md that cannot be read must still be reported');
      assert.doesNotMatch(indexOut, /looks like an older _index\.md template shape/, 'a current dashboard must NOT be reported as an older shape while the one candidate template it actually matches is unreadable');
      // ⚠ Assert the "matches none" CLAIM, not the words "every shipped track
      // was checked" on their own — the package finding uses that phrase too,
      // and there it is true: every track really was examined for damage. It is
      // the comparison verdict hanging off it that would be the lie.
      assert.doesNotMatch(indexOut, /matches none of them/, 'the "matches none of them" claim must not be printed when one of those tracks could not be read');
    }

    // --- ⚠ Present-but-unreadable is not absent. Row 5's silence is about a file
    // that is NOT THERE; a file that is there and cannot be read is something to
    // check whose check disappeared. `checkInitOnlyStarters` has split these two
    // since `p090-b3-z1`; the skill loop had not.
    {
      const p = await newProject('1,2,3');
      const skillPath = join(p, '.claude/skills/dflow/SKILL.md');
      await unlink(skillPath);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'control: an ABSENT skill file is row 5 and must stay silent');

      // Present, but not readable as a file (EISDIR stands in for EACCES, which
      // cannot be produced portably here).
      await mkdir(skillPath, { recursive: true });
      const unreadable = await runDoctorAt(p);
      assert.match(unreadable.stdout, /\.claude\/skills\/dflow\/SKILL\.md could not be read/, 'a present-but-unreadable skill file must be reported, not silently filed under "absent"');
    }

    // --- ⚠⚠ "SOMETHING IS AT THIS PATH" IS NOT "AN ADAPTER FILE IS AT THIS
    // PATH". `pathExists` answers the first; the row is about the second, and a
    // directory at an adapter path made a broken surface read as a complete one.
    {
      const p = await newProject('1,2,3');
      const adapterRun = await runConfigure(p, ['1,2,3', 'y'], { commandAdapters: true });
      assert.equal(adapterRun.code, 0, `--command-adapters run failed\n${adapterRun.all}`);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'non-file control: a complete, genuine adapter set must be silent');

      const victim = join(p, '.claude/commands/dflow/status.md');
      await unlink(victim);
      await mkdir(victim, { recursive: true });
      const nonFile = await runDoctorAt(p);
      // The defect was the clean bill, so assert on that first and directly.
      assert.doesNotMatch(nonFile.stdout, /All checks passed/, 'a directory sitting at an adapter path must not read as a healthy, complete surface — `configure-agents --command-adapters` fails EISDIR on it');
      assert.match(nonFile.stdout, /command adapter path\(s\) are not files/, 'and the reason must be named, rather than shown as an ordinary missing adapter');
      assert.doesNotMatch(nonFile.stdout, /has 10 of 11/, 'a non-file is a third state: reporting it as a plain missing file would send the reader to a regeneration that fails');
    }

    // --- ⚠⚠ THE SCOPE NOTE MUST NOT CONTRADICT A FINDING IN ITS OWN REPORT.
    // It said absence "is never a finding here" while the very same report named
    // a missing adapter. What goes unreported is a whole surface nobody uses —
    // not members missing from a surface already in use.
    {
      const p = await newProject('1,2,3');
      const adapterRun = await runConfigure(p, ['1,2,3', 'y'], { commandAdapters: true });
      assert.equal(adapterRun.code, 0, `--command-adapters run failed\n${adapterRun.all}`);
      await unlink(join(p, '.claude/commands/dflow/status.md'));
      const partial = await runDoctorAt(p);
      assert.match(partial.stdout, /Missing: status/, 'the fixture must actually produce a partial-set finding, or the assertion below is vacuous');
      assert.doesNotMatch(partial.stdout, /absence is never a finding/, 'the scope note must not claim a silence the same report just broke');
      assert.match(partial.stdout, /a partly installed set is reported/, 'it must say which absence it does report and which it does not');
    }

    // --- ⚠⚠ AN UNKNOWN EDITION MUST NOT SWITCH OFF THE GIT-PRINCIPLES DRIFT
    // COMPARISON EITHER. This is the same rule as gates 2 and 4, in the one
    // place that was still narrowing to a single resolved track — and the same
    // mutation reported or went silent purely on whether the edition happened to
    // be inferable.
    {
      const p = await newProject('2');
      const starterPath = join(p, 'dflow/specs/shared/Git-principles-trunk.md');
      const pristine = await readFile(starterPath, 'utf8');
      const drift = () => writeFile(starterPath, pristine.replace('## 1. Branch Structure', '## 1. Branch Structure\n\nEDITED INSIDE THE CANONICAL REGION.'));

      await drift();
      assert.match((await runDoctorAt(p)).stdout, /Git-principles-trunk\.md canonical sections differ/, 'edition-known control: the drift must be reported when the edition is inferable');

      await unknownEdition(p);
      const unknownEd = await runDoctorAt(p);
      assert.match(unknownEd.stdout, /Git-principles-trunk\.md canonical sections differ/, 'the SAME drift must still be reported when the edition is not inferable — an unknown edition is a fact about the project shape, not about whether this file is stale');
      assert.match(unknownEd.stdout, /the sections match none of them/, 'and with the track unknown the report must say every track was checked');

      // ⚠ Clearing on ANY candidate is what keeps `p090-b3-y1`'s false DIRTY
      // fixed: a pristine starter must stay silent whichever track it belongs
      // to, and whatever a disagreeing manifest claims.
      await writeFile(starterPath, pristine);
      assert.doesNotMatch((await runDoctorAt(p)).stdout, /Git-principles-trunk\.md canonical sections differ/, 'a pristine starter must not be reported as drifted just because the edition is unknown');
    }

    // --- ⚠⚠ A PACKAGED SKILL THAT IS READABLE BUT UNUSABLE IS PACKAGE DAMAGE,
    // not project drift. Getting this wrong pointed the blame at three files the
    // CLI had itself just projected — and the action it printed then overwrote
    // them with the unusable content (measured 1925 -> 0 bytes, exit 0).
    {
      const skillPkg = join(tempRoot, 'unusable-skill-package');
      await mkdir(skillPkg, { recursive: true });
      for (const dir of ['bin', 'lib', 'templates', 'node_modules']) {
        await cp(join(repoRoot, dir), join(skillPkg, dir), { recursive: true });
      }
      await cp(join(repoRoot, 'package.json'), join(skillPkg, 'package.json'));
      const skillDoctor = async (cwd) => {
        const { spawnSync } = await import('node:child_process');
        const r = spawnSync(process.execPath, [join(skillPkg, 'bin', 'dflow.js'), 'doctor'], {
          cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024
        });
        return r.stdout || '';
      };
      const packagedSkillPath = join(skillPkg, 'templates/common/skill/SKILL.md');
      const packagedSkill = await readFile(packagedSkillPath, 'utf8');

      const p = await newProject('1,2,3');
      assert.match(await skillDoctor(p), /All checks passed/, 'unusable-skill control: the fixture must be clean while the copied package is intact');

      for (const [label, broken] of [['empty', ''], ['marker stripped', packagedSkill.replace(SKILL_MARKER, '')]]) {
        await writeFile(packagedSkillPath, broken);
        const out = await skillDoctor(p);
        assert.match(out, /packaged skill source/, `${label}: an unusable packaged skill must be reported as package damage`);
        assert.doesNotMatch(out, /differs from the skill this CLI projects/, `${label}: the project's own freshly projected SKILL.md files must NOT be blamed for a broken package`);
        assert.doesNotMatch(out, /to regenerate it/, `${label}: and doctor must not print an action that would project the unusable content over them`);
      }
      await writeFile(packagedSkillPath, packagedSkill);
      assert.match(await skillDoctor(p), /All checks passed/, 'restoring the packaged skill must clear the finding');
    }

    // --- ⚠ A finding that names a policy must name THIS project's policy. A
    // fixed `gitflow` example inside a finding about a trunk starter reads as an
    // instruction to write the wrong value.
    {
      const p = await newProject('2');
      const conventionsPath = join(p, CONVENTIONS_REL);
      await writeFile(conventionsPath, (await readFile(conventionsPath, 'utf8')).replace(/^Selected Git policy: .*$/m, 'Selected Git policy: (unset)'));
      const starterPath = join(p, 'dflow/specs/shared/Git-principles-trunk.md');
      await writeFile(starterPath, (await readFile(starterPath, 'utf8')).replace('## 1. Branch Structure', '## 1. Branch Structure\n\nEDITED.'));
      const out = (await runDoctorAt(p)).stdout;
      assert.match(out, /this file is the `trunk` starter, so the canonical line is `Selected Git policy: `trunk``/, 'the restore instruction must name the policy this starter actually is');
    }

    // --- ⚠⚠ PRESENT-BUT-UNREADABLE IS ITS OWN STATE, EVERYWHERE.
    // The seven approved gates all ask "is this value ABSENT". None of them asks
    // "is it there and unreadable" — and every `.catch(() => '')` /
    // `.catch(() => null)` / `catch { return }` in these checks answered both
    // questions with the absent branch. A file that is intact but locked, or
    // replaced by a directory, was variously called empty, called
    // unrecognizable, or passed over in silence.
    // ⚠ EISDIR stands in for EACCES throughout: a real permission denial is not
    // portable to produce here, and both arrive as a non-ENOENT error, which is
    // the distinction the code actually makes.
    {
      const p = await newProject('1,2,3');
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'unreadable control: the fixture must start clean');

      const asDirectory = async (rel) => {
        const target = join(p, rel);
        await unlink(target);
        await mkdir(target, { recursive: true });
      };
      const restore = async (rel, body) => {
        await rm(join(p, rel), { recursive: true, force: true });
        await writeFile(join(p, rel), body);
      };

      // The guide: an intact, current guide must never be called unrecognizable.
      const guideBody = await readFile(join(p, GUIDE_REL), 'utf8');
      await asDirectory(GUIDE_REL);
      const guideOut = await runDoctorAt(p);
      assert.match(guideOut.stdout, /AI-AGENT-GUIDE\.md could not be read/, 'an unreadable guide must say so');
      assert.doesNotMatch(guideOut.stdout, /is not recognizable as a Dflow guide/, 'doctor must not pass judgement on bytes it never read — that verdict sends the reader to rebuild an intact file');
      await restore(GUIDE_REL, guideBody);

      // `_conventions.md`: "is empty" is destructive advice for a file whose
      // content is still there.
      const conventionsBody = await readFile(join(p, CONVENTIONS_REL), 'utf8');
      await asDirectory(CONVENTIONS_REL);
      const convOut = await runDoctorAt(p);
      assert.match(convOut.stdout, /_conventions\.md could not be read/, 'an unreadable _conventions.md must say so');
      assert.doesNotMatch(convOut.stdout, /_conventions\.md is empty/, 'and must not be called empty — the action for empty tells the reader to retype their answers');
      // ⚠ The coupling three sibling checks depend on must survive the new
      // branch: this block always reports, whichever of the three states it is.
      assert.doesNotMatch(convOut.stdout, /All checks passed/, 'the always-reports coupling must hold for the unreadable state too');
      await restore(CONVENTIONS_REL, conventionsBody);
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'restoring both files must return the project to clean');

      // Feature dashboards: two exits, both of which used to be silent.
      const featureRel = 'dflow/specs/features/active/BR-003-unreadable';
      await mkdir(join(p, featureRel, '_index.md'), { recursive: true });
      assert.match((await runDoctorAt(p)).stdout, /BR-003-unreadable\/_index\.md could not be read/, 'an unreadable feature dashboard must be reported, not skipped');
      await rm(join(p, featureRel), { recursive: true, force: true });

      const activeRel = 'dflow/specs/features/active';
      await rm(join(p, activeRel), { recursive: true, force: true });
      await writeFile(join(p, activeRel), 'not a directory\n');
      assert.match((await runDoctorAt(p)).stdout, /features\/active\/ could not be listed/, 'an unlistable active/ must be reported — `All checks passed` there covers a feature set nothing looked at');
      // ⚠ ENOENT stays silent: no active/ means no features in flight, which is
      // the approved shape and the half of this exit that was always sound.
      await rm(join(p, activeRel), { recursive: true, force: true });
      assert.match((await runDoctorAt(p)).stdout, /All checks passed/, 'an ABSENT active/ must still be silent — that half of the exit was never the defect');
    }

    // --- ⚠⚠ A CORRUPT PACKAGED SKILL IS PACKAGE DAMAGE TOO. Emptiness and a
    // missing marker were only two of the ways that file can be unusable;
    // invalid UTF-8 is the third, and it is the one a plain
    // `readFile(..., 'utf8')` cannot see — the bytes become U+FFFD and sail
    // through both other tests. `readPackagedTemplate` decodes every other
    // packaged file with `fatal: true`; this one did not.
    {
      const corruptPkg = join(tempRoot, 'corrupt-skill-package');
      await mkdir(corruptPkg, { recursive: true });
      for (const dir of ['bin', 'lib', 'templates', 'node_modules']) {
        await cp(join(repoRoot, dir), join(corruptPkg, dir), { recursive: true });
      }
      await cp(join(repoRoot, 'package.json'), join(corruptPkg, 'package.json'));
      const corruptDoctor = async (cwd) => {
        const { spawnSync } = await import('node:child_process');
        const r = spawnSync(process.execPath, [join(corruptPkg, 'bin', 'dflow.js'), 'doctor'], {
          cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024
        });
        return r.stdout || '';
      };
      const packagedSkillPath = join(corruptPkg, 'templates/common/skill/SKILL.md');
      const original = await readFile(packagedSkillPath);

      const p = await newProject('1,2,3');
      assert.match(await corruptDoctor(p), /All checks passed/, 'corrupt-skill control: the fixture must be clean while the copied package is intact');

      // Non-empty, marker intact, bytes invalid.
      await writeFile(packagedSkillPath, Buffer.concat([original, Buffer.from([0xFF, 0xFE, 0xFF, 0x0A])]));
      const out = await corruptDoctor(p);
      assert.match(out, /packaged skill source/, 'a packaged skill with invalid UTF-8 must be reported as package damage');
      assert.doesNotMatch(out, /differs from the skill this CLI projects/, 'three freshly projected SKILL.md files must not be blamed for a corrupt package');
      assert.doesNotMatch(out, /to regenerate it/, 'and the action that would rewrite them with replacement characters must not be printed');
      await writeFile(packagedSkillPath, original);
      assert.match(await corruptDoctor(p), /All checks passed/, 'restoring the packaged skill must clear it');
    }

    // --- ⚠ A CRLF checkout of the package is not a broken package. The masker
    // ate the markers when the packaged guide was classified without `toLf`,
    // so doctor called an intact package incomplete — and the byte comparison
    // below it would have reported every CRLF install as drifted.
    {
      const crlfPkg = join(tempRoot, 'crlf-package');
      await mkdir(crlfPkg, { recursive: true });
      for (const dir of ['bin', 'lib', 'templates', 'node_modules']) {
        await cp(join(repoRoot, dir), join(crlfPkg, dir), { recursive: true });
      }
      await cp(join(repoRoot, 'package.json'), join(crlfPkg, 'package.json'));
      const guidePath = join(crlfPkg, 'templates/greenfield/scaffolding/AI-AGENT-GUIDE.md');
      await writeFile(guidePath, (await readFile(guidePath, 'utf8')).replace(/\r?\n/g, '\r\n'));

      const p = await newProject('1,2,3');
      const { spawnSync } = await import('node:child_process');
      const out = spawnSync(process.execPath, [join(crlfPkg, 'bin', 'dflow.js'), 'doctor'], {
        cwd: p, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024
      }).stdout || '';
      assert.match(out, /All checks passed/, 'a CRLF checkout of the package must not be reported as damaged or as drift');
    }

    // --- (d) BOUNDARY + DELEGATION. ⚠⚠ THE PARENTHESIS IS LOAD-BEARING: without
    // it the line reads as a gate ("doctor does not check it, but the AI does"),
    // and nothing enforces that the AI checks nor verifies afterwards that it
    // did. Describing a delegation as a guarantee is a defect this repo has
    // already paid to remove, so the disclaimer is pinned, not just the note.
    {
      const p = await newProject('1,2,3');
      const clean = await runDoctorAt(p);
      assert.match(clean.stdout, /doctor does not judge whether this project SHOULD have/, 'the BOUNDARY note must print on a clean run — that is the run someone asking "is my install complete?" is looking at');
      assert.match(clean.stdout, /delegation, not a guarantee/, 'the DELEGATION disclaimer must print with it');

      await writeFile(join(p, MANIFEST_REL), '{ not json');
      const dirty = await runDoctorAt(p);
      assert.match(dirty.stdout, /doctor does not judge whether this project SHOULD have/, 'the BOUNDARY note must print on a run WITH findings too — it is a statement about scope, not a consolation for a clean bill');
      assert.match(dirty.stdout, /delegation, not a guarantee/, 'the DELEGATION disclaimer must print on that run too');
    }
  }

  console.log(`PROPOSAL-058 upgrade-drift tests passed in ${tempRoot}`);
} finally {
  if (process.env.DFLOW_KEEP_SMOKE_TMP !== '1') {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
