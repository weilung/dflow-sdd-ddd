// PROPOSAL-064: unit tests for the pure bundle-source guards in lib/init.js.
// These run on synthetic descriptor lists (no filesystem / no packaged
// templates/ mutation), so the core-invariant guards — which only fire on a
// broken installed package — are covered by automated negative tests instead of
// only by code review / the fresh-eye gate.
import assert from 'node:assert/strict';
import init from '../lib/init.js';

const { assertNoBundleCollision, assertEditionBundleComplete, assertCommonBundleComplete } = init;

const ref = (name, sourceRoot) => ({ sourceRel: `references/${name}`, dir: 'references', name, sourceRoot });
const tpl = (name, sourceRoot) => ({ sourceRel: `templates/${name}`, dir: 'templates', name, sourceRoot });

// --- collision guard (common <-> edition file-name uniqueness) ---

assert.throws(
  () => assertNoBundleCollision([ref('x.md', 'common'), ref('x.md', 'greenfield')]),
  /exists in both/,
  'collision guard: same references/ name in common + edition must fail fast'
);
assert.throws(
  () => assertNoBundleCollision([tpl('models.md', 'common'), tpl('models.md', 'brownfield')]),
  /exists in both/,
  'collision guard: same templates/ name in common + edition must fail fast'
);
assert.doesNotThrow(
  () => assertNoBundleCollision([ref('ddd-modeling-guide.md', 'common'), ref('new-feature-flow.md', 'greenfield')]),
  'collision guard: distinct names across trees must pass'
);

// --- per-edition completeness guard (common must not mask a broken edition) ---

assert.doesNotThrow(
  () => assertEditionBundleComplete(
    [ref('new-feature-flow.md', 'brownfield'), tpl('models.md', 'brownfield'), ref('ddd-modeling-guide.md', 'common')],
    'brownfield'
  ),
  'per-edition guard: edition with both references/ and templates/ passes'
);
assert.throws(
  () => assertEditionBundleComplete(
    // edition contributes only templates/; references/ comes solely from common
    [tpl('models.md', 'brownfield'), ref('ddd-modeling-guide.md', 'common')],
    'brownfield'
  ),
  /incomplete workflow bundle source/,
  'per-edition guard: missing edition references/ must throw even when common has references/'
);
assert.throws(
  () => assertEditionBundleComplete(
    // edition contributes only references/; no edition templates/
    [ref('new-feature-flow.md', 'brownfield'), ref('ddd-modeling-guide.md', 'common')],
    'brownfield'
  ),
  /incomplete workflow bundle source/,
  'per-edition guard: missing edition templates/ must throw'
);

// --- common completeness guard (a missing common file must NOT look "retired") ---
// Regression for the fresh-gate finding: if the common guide is absent from the
// package, the scanner must hard-fail, not return a valid set lacking it (which
// re-projection would then delete from the user's project as a "retired" file).

assert.doesNotThrow(
  () => assertCommonBundleComplete([ref('ddd-modeling-guide.md', 'common'), ref('new-feature-flow.md', 'brownfield')]),
  'common guard: required common guide present passes'
);
assert.throws(
  () => assertCommonBundleComplete([
    // a broken package: edition files present, but no common guide
    ref('new-feature-flow.md', 'brownfield'), tpl('models.md', 'brownfield')
  ]),
  /missing required common workflow bundle file/,
  'common guard: missing common guide must throw (not be treated as retired)'
);

console.log('PROPOSAL-064 bundle-guards tests passed');
