// Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE.
// PROPOSAL-114: notice coverage and the license's package/project lifecycle.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import doctorChecks from '../lib/doctor-checks.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLOW_NOTICE = '<!-- Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE in the Dflow package, or dflow/specs/shared/dflow-workflows/LICENSE in a project. -->';
const TEMPLATE_NOTICE = '<!-- This template is part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE in the Dflow package, or dflow/specs/shared/dflow-workflows/LICENSE in a project. Documents written from it are yours: do not copy this line into them. -->';
const CODE_NOTICE = '// Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE.';
const MARKER = '<!-- dflow-generated: workflow-bundle -->';
const BUNDLE = 'dflow/specs/shared/dflow-workflows';
const MANIFEST = `${BUNDLE}/.dflow-bundle-manifest.json`;
const LICENSE = `${BUNDLE}/LICENSE`;
const tempRoot = await mkdtemp(join(tmpdir(), 'dflow-license-'));
let scenarios = 0;

// Discover files on each run: a new source file cannot bypass the notice check
// by being absent from a frozen list of known filenames.
const sourceGroups = [
  ...['greenfield', 'brownfield', 'common'].map((e) => [`templates/${e}/references`, '.md', 'flow']),
  ...['greenfield', 'brownfield'].map((e) => [`templates/${e}/templates`, '.md', 'template']),
  ['lib', '.js', 'code'], ['test', '.mjs', 'code']
];
async function checkNotices(root) {
  const counts = { flow: 0, template: 0, code: 1 };
  for (const [dir, extension, kind] of sourceGroups) {
    for (const file of await readdir(join(root, dir))) {
      if (!file.endsWith(extension)) continue;
      const rel = `${dir}/${file}`;
      const lines = (await readFile(join(root, rel), 'utf8')).split(/\r?\n/);
      const at = kind === 'template' ? lines.findIndex((line) => line.startsWith('<!-- dflow-shape:')) + 1 : 0;
      if (kind === 'template') assert.ok(at > 0, `${rel}: missing shape marker`);
      const notice = kind === 'flow' ? FLOW_NOTICE : kind === 'template' ? TEMPLATE_NOTICE : CODE_NOTICE;
      assert.equal(lines[at], notice, `${rel}: notice must be on line ${at + 1}`);
      assert.equal(lines.filter((line) => line === notice).length, 1, `${rel}: exactly one notice`);
      counts[kind] += 1;
    }
  }
  const bin = (await readFile(join(root, 'bin/dflow.js'), 'utf8')).split(/\r?\n/);
  assert.ok(bin[0].startsWith('#!'), 'bin/dflow.js keeps its shebang');
  assert.equal(bin[1], CODE_NOTICE, 'bin/dflow.js: notice immediately after shebang');
  return counts;
}
async function filesUnder(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const p = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(p));
    else if (entry.isFile()) files.push(p);
  }
  return files;
}
function hasNotice(text) {
  return [FLOW_NOTICE, TEMPLATE_NOTICE, CODE_NOTICE].some((notice) => text.includes(notice));
}
function cli(pkg, cwd, command, input = '') {
  const result = spawnSync(process.execPath, [join(pkg, 'bin/dflow.js'), command], {
    cwd, input, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024
  });
  assert.ifError(result.error);
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` };
}
function success(result) {
  assert.equal(result.code, 0, result.output);
  return result.output;
}
async function freshProject(pkg, name, edition) {
  const dir = join(tempRoot, name);
  await mkdir(dir);
  const answers = [edition === 'greenfield' ? '1' : '2', 'Node 20, Express 4, Jest', 'none', '1', '2', '1', '1', '1', 'y'];
  success(cli(pkg, dir, 'init', `${answers.join('\n')}\n`));
  return dir;
}
async function assertBundleLicense(pkg, project) {
  const expected = Buffer.concat([Buffer.from(`${MARKER}\n\n`), await readFile(join(pkg, 'LICENSE'))]);
  assert.deepEqual(await readFile(join(project, LICENSE)), expected, 'marker, blank line, root LICENSE byte for byte');
  const manifest = JSON.parse(await readFile(join(project, MANIFEST), 'utf8'));
  assert.ok(manifest.files.includes(LICENSE), 'manifest lists bundle LICENSE');
}
const configure = (pkg, dir) => cli(pkg, dir, 'configure-agents', '1\ny\n');

try {
  assert.equal(doctorChecks.TEMPLATE_LICENSE_NOTICE, TEMPLATE_NOTICE, 'runtime constant matches the shipped text');
  const counts = await checkNotices(repoRoot);
  assert.ok(counts.flow >= 34 && counts.template >= 24 && counts.code >= 20, JSON.stringify(counts));
  scenarios += 1;

  for (const dir of ['templates/greenfield/scaffolding', 'templates/brownfield/scaffolding', 'templates/common/skill', 'docs']) {
    for (const file of await filesUnder(join(repoRoot, dir))) {
      assert.equal(hasNotice(await readFile(file, 'utf8')), false, `${file}: excluded source must have no notice`);
    }
  }
  for (const rel of ['lib/doc-shapes.json', 'README.md', 'README.en.md', 'CHANGELOG.md', 'CONTRIBUTING.md']) {
    assert.equal(hasNotice(await readFile(join(repoRoot, rel), 'utf8')), false, `${rel}: excluded source must have no notice`);
  }
  scenarios += 1;

  // Prove that dynamically adding a file without a notice fails, in all three
  // source classes. Only this synthetic tree under the environment temp is changed.
  const mutation = join(tempRoot, 'notice-mutation');
  for (const [dir] of sourceGroups) await mkdir(join(mutation, dir), { recursive: true });
  await mkdir(join(mutation, 'bin'));
  await writeFile(join(mutation, 'bin/dflow.js'), `#!/usr/bin/env node\n${CODE_NOTICE}\n`);
  await checkNotices(mutation);
  for (const rel of ['templates/common/references/new-unlicensed.md', 'templates/greenfield/templates/new-unlicensed.md', 'lib/new-unlicensed.js', 'test/new-unlicensed.mjs']) {
    const p = join(mutation, rel);
    await writeFile(p, rel.includes('/templates/') ? '<!-- dflow-shape: greenfield/new-unlicensed.md 1 -->\n# New\n' : '# New\n');
    await assert.rejects(checkNotices(mutation), /new-unlicensed/, `${rel}: discovery catches the missing notice`);
    await rm(p);
  }
  scenarios += 1;

  for (const edition of ['greenfield', 'brownfield']) {
    for (const name of await readdir(join(repoRoot, `templates/${edition}/templates`))) {
      if (!name.endsWith('.md')) continue;
      const original = await readFile(join(repoRoot, `templates/${edition}/templates`, name), 'utf8');
      const without = original.replace(`${TEMPLATE_NOTICE}\n`, '');
      const shape = (text) => doctorChecks.extractShapeSkeleton(text);
      assert.deepEqual(shape(original), shape(without), `${edition}/${name}: notice does not change recorded shape`);
      assert.notDeepEqual(shape(original.replace(TEMPLATE_NOTICE, '<!-- Another comment. -->')), shape(without), `${edition}/${name}: other comments still count`);
    }
  }
  assert.deepEqual(doctorChecks.shapeCommentSpans(`${TEMPLATE_NOTICE}\r\n`), []);
  for (const changed of [TEMPLATE_NOTICE.replace('yours:', 'YOURS:'), TEMPLATE_NOTICE.replace(' -->', '\n-->'), ` ${TEMPLATE_NOTICE}`, `${TEMPLATE_NOTICE} Other text`]) {
    assert.equal(doctorChecks.shapeCommentSpans(changed).length, 1, 'only the exact standalone notice line is excluded');
  }
  const enclosing = `<!-- Another comment\n${TEMPLATE_NOTICE}\n-->`;
  assert.equal(doctorChecks.shapeCommentSpans(enclosing)[0], enclosing.slice(0, -4), 'another comment containing the notice text is preserved byte for byte');
  scenarios += 1;

  const pkg = join(tempRoot, 'package');
  await mkdir(pkg);
  for (const rel of ['bin', 'lib', 'templates', 'package.json', 'LICENSE']) {
    await cp(join(repoRoot, rel), join(pkg, rel), { recursive: true });
  }
  const projects = {};
  for (const edition of ['greenfield', 'brownfield']) {
    const project = await freshProject(pkg, edition, edition);
    projects[edition] = project;
    await assertBundleLicense(pkg, project);
    const starters = [['domain/glossary.md', 'glossary.md'], [edition === 'greenfield' ? 'architecture/tech-debt.md' : 'migration/tech-debt.md', 'tech-debt.md']];
    if (edition === 'greenfield') starters.push(['domain/context-map.md', 'context-map.md']);
    for (const [dest, source] of starters) {
      const seeded = await readFile(join(project, 'dflow/specs', dest));
      const template = await readFile(join(pkg, `templates/${edition}/templates`, source), 'utf8');
      assert.equal(template.split('\n').filter((line) => line === TEMPLATE_NOTICE).length, 1);
      assert.deepEqual(seeded, Buffer.from(template.replace(`${TEMPLATE_NOTICE}\n`, '')), `${dest}: seeded bytes unchanged`);
      assert.equal(hasNotice(seeded.toString('utf8')), false, `${dest}: starter has no notice`);
      assert.ok((await readFile(join(project, BUNDLE, 'templates', source), 'utf8')).includes(TEMPLATE_NOTICE), 'bundle template retains notice');
    }
    const output = success(cli(pkg, project, 'doctor'));
    assert.doesNotMatch(output, /package looks incomplete|Could not read the packaged workflow bundle source/, 'healthy package');
    scenarios += 1;
  }

  // Include CRLF and a BOM to ensure the package root's bytes survive projection.
  const changedLicense = Buffer.concat([Buffer.from('\uFEFF'), await readFile(join(pkg, 'LICENSE')), Buffer.from('\r\nLicense refresh fixture.\r\n')]);
  await writeFile(join(pkg, 'LICENSE'), changedLicense);
  for (const project of Object.values(projects)) {
    success(configure(pkg, project));
    await assertBundleLicense(pkg, project);
  }
  scenarios += 1;

  const unmarked = projects.brownfield;
  await writeFile(join(unmarked, LICENSE), 'User-owned license\n');
  const skipped = success(configure(pkg, unmarked));
  assert.match(skipped, /Existing dflow\/specs\/shared\/dflow-workflows\/LICENSE is not a Dflow-generated bundle file; left unchanged/);
  assert.equal(await readFile(join(unmarked, LICENSE), 'utf8'), 'User-owned license\n');
  assert.ok(JSON.parse(await readFile(join(unmarked, MANIFEST), 'utf8')).files.includes(LICENSE));
  scenarios += 1;

  const switched = projects.greenfield;
  // Match the existing edition-switch fixture: structural signals select brownfield.
  await rm(join(switched, 'dflow/specs/architecture'), { recursive: true });
  await rm(join(switched, 'dflow/specs/domain/context-map.md'));
  await mkdir(join(switched, 'dflow/specs/migration'));
  await cp(join(unmarked, 'dflow/specs/migration/tech-debt.md'), join(switched, 'dflow/specs/migration/tech-debt.md'));
  const switching = success(configure(pkg, switched));
  assert.equal(JSON.parse(await readFile(join(switched, MANIFEST), 'utf8')).edition, 'brownfield', switching);
  await assertBundleLicense(pkg, switched);
  assert.doesNotMatch(switching, /Retired workflow bundle file.*LICENSE/);
  scenarios += 1;

  const corrupt = '{ invalid manifest\n';
  await writeFile(join(switched, MANIFEST), corrupt);
  await writeFile(join(switched, LICENSE), `${MARKER}\n\nOld license\n`);
  const degraded = success(configure(pkg, switched));
  assert.match(degraded, /manifest is unreadable.*skipped stale cleanup/);
  assert.equal(await readFile(join(switched, MANIFEST), 'utf8'), corrupt, 'corrupt manifest is not overwritten');
  assert.deepEqual(await readFile(join(switched, LICENSE)), Buffer.concat([Buffer.from(`${MARKER}\n\n`), changedLicense]), 'license still refreshes with a corrupt manifest');
  scenarios += 1;

  // The preview judged these bundle files Dflow-generated; the user replaces them
  // with files of their own while configure-agents waits for confirmation. The
  // write must keep both replacements and say so — LICENSE and a flow file alike.
  {
    const raced = await freshProject(pkg, 'race-project', 'greenfield');
    const flow = `${BUNDLE}/references/new-feature-flow.md`;
    await writeFile(join(raced, LICENSE), `${MARKER}\n\nOld bundled license\n`);
    await writeFile(join(raced, flow), `${MARKER}\n\nOld flow\n`);
    const ownLicense = 'My project-specific license; user owned.\n';
    const ownFlow = 'My own notes in place of the flow.\n';
    const run = await new Promise((resolveRun, rejectRun) => {
      const child = spawn(process.execPath, [join(pkg, 'bin/dflow.js'), 'configure-agents'], { cwd: raced, stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      let replaced = false;
      const timer = setTimeout(() => { child.kill(); rejectRun(new Error(`no confirmation prompt within 30 s:\n${output}`)); }, 30000);
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
        if (!replaced && output.includes('Create these files? (y/N)')) {
          replaced = true;
          writeFileSync(join(raced, LICENSE), ownLicense);
          writeFileSync(join(raced, flow), ownFlow);
          child.stdin.end('y\n');
        }
      });
      child.stderr.on('data', (chunk) => { output += chunk.toString(); });
      child.on('error', (error) => { clearTimeout(timer); rejectRun(error); });
      child.on('exit', (code) => { clearTimeout(timer); resolveRun({ code, output, replaced }); });
      child.stdin.write('1\n');
    });
    assert.ok(run.replaced, `reached the confirmation prompt:\n${run.output}`);
    assert.equal(run.code, 0, run.output);
    assert.equal(await readFile(join(raced, LICENSE), 'utf8'), ownLicense, 'a LICENSE replaced after the preview is left in place');
    assert.equal(await readFile(join(raced, flow), 'utf8'), ownFlow, 'a flow file replaced after the preview is left in place');
    assert.match(run.output, /Skipped dflow\/specs\/shared\/dflow-workflows\/LICENSE because it changed after the preview/);
    assert.match(run.output, /Skipped dflow\/specs\/shared\/dflow-workflows\/references\/new-feature-flow\.md because it changed after the preview/);
    scenarios += 1;
  }

  // Missing and unreadable sources fail during planning: snapshot ALL project
  // files, including an otherwise refreshable bundle file, before each command.
  async function snapshot(dir) {
    return Promise.all((await filesUnder(dir)).sort().map(async (p) => [p, (await readFile(p)).toString('base64')]));
  }
  for (const broken of ['missing', 'unreadable', 'invalid-utf8']) {
    await rm(join(pkg, 'LICENSE'));
    if (broken === 'unreadable') await mkdir(join(pkg, 'LICENSE'));
    if (broken === 'invalid-utf8') await writeFile(join(pkg, 'LICENSE'), Buffer.from([0xff]));
    const empty = join(tempRoot, `empty-${broken}`);
    await mkdir(empty);
    const answers = '1\nNode 20, Express 4, Jest\nnone\n1\n2\n1\n1\n1\ny\n';
    const failedInit = cli(pkg, empty, 'init', answers);
    assert.notEqual(failedInit.code, 0, failedInit.output);
    assert.match(failedInit.output, /packaged bundle file.*LICENSE/);
    assert.deepEqual(await readdir(empty), [], 'init wrote nothing');
    const before = await snapshot(unmarked);
    const failedConfigure = configure(pkg, unmarked);
    assert.notEqual(failedConfigure.code, 0, failedConfigure.output);
    assert.match(failedConfigure.output, /packaged bundle file.*LICENSE/);
    assert.deepEqual(await snapshot(unmarked), before, 'configure-agents wrote nothing');
    const doctor = success(cli(pkg, unmarked, 'doctor'));
    assert.match(doctor, /\[warn\] The installed dflow package looks incomplete/);
    assert.match(doctor, /packaged bundle file.*LICENSE/);
    if (broken === 'unreadable') await rm(join(pkg, 'LICENSE'), { recursive: true });
    else if (broken === 'invalid-utf8') await rm(join(pkg, 'LICENSE'));
    await writeFile(join(pkg, 'LICENSE'), changedLicense);
    scenarios += 1;
  }

  const prompt = (text) => text.match(/```text\n(For each doc[\s\S]*?)\n```/)[1];
  const zh = await readFile(join(repoRoot, 'docs/upgrading.md'), 'utf8');
  const en = await readFile(join(repoRoot, 'docs/upgrading.en.md'), 'utf8');
  assert.equal(prompt(zh), prompt(en), 'copyable English prompt stays identical');
  assert.match(prompt(en), /exclude it from the comparison and never copy it into the doc; older templates may have no such line/);
  scenarios += 1;
  console.log(`PROPOSAL-114 license-notices tests passed (${scenarios} scenarios; ${counts.flow} flow, ${counts.template} template, ${counts.code} code notices)`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
