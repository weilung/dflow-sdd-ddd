// PROPOSAL-064: unit tests for the pure bundle-source guards in lib/init.js.
// These run on synthetic descriptor lists (no filesystem / no packaged
// templates/ mutation), so the core-invariant guards — which only fire on a
// broken installed package — are covered by automated negative tests instead of
// only by code review / the fresh-eye gate.
import assert from 'node:assert/strict';
import init from '../lib/init.js';

const {
  REQUIRED_COMMON_BUNDLE_FILES,
  assertNoBundleCollision,
  assertEditionBundleComplete,
  assertCommonBundleComplete
} = init;

const ref = (name, sourceRoot) => ({ sourceRel: `references/${name}`, dir: 'references', name, sourceRoot });
const tpl = (name, sourceRoot) => ({ sourceRel: `templates/${name}`, dir: 'templates', name, sourceRoot });

// --- collision guard (common <-> edition file-name uniqueness) ---

assert.throws(
  () => assertNoBundleCollision([ref('x.md', 'common'), ref('x.md', 'greenfield')]),
  /exists in both/,
  'collision guard: same references/ name in common + edition must fail fast'
);
// Case-variant duplicate: a case-sensitive checkout or CI can hold both
// spellings, and the adopter's filesystem (Windows, default macOS) cannot —
// so the pair ships and one silently overwrites the other. An exact-match key
// saw no collision here at all. Pure assertion, so it runs on a
// case-insensitive host that could never create the files themselves.
assert.throws(
  () => assertNoBundleCollision([ref('x.md', 'common'), ref('X.md', 'greenfield')]),
  /exists in both/,
  'collision guard: names differing only in case must also fail fast'
);
// Same hazard INSIDE one tree: two spellings in templates/common/ are still one
// path on the adopter's filesystem. Keying the check on sourceRoot alone missed
// this half entirely.
assert.throws(
  () => assertNoBundleCollision([ref('x.md', 'common'), ref('X.md', 'common')]),
  /exists twice in/,
  'collision guard: case-variant names within ONE tree must fail fast too'
);
assert.doesNotThrow(
  () => assertNoBundleCollision([ref('x.md', 'common'), ref('x.md', 'common')]),
  'collision guard: the same file listed twice from ONE tree is not a collision'
);
// NFC/NFD. ⚠ Not a macOS-only concern, which is how this was first framed: the
// measured reach is on WINDOWS, whose filesystem is case-insensitive but
// normalization-SENSITIVE, so an NFD/NFC pair coexists in one directory there
// and the guard fires at runtime. macOS default folds them away instead.
// Unreachable while every real key is ASCII -- which is the point, since the
// fold is where that assumption lives.
// Built from explicit code points, never typed literals: two visually identical
// "cafe.md" sources would be the SAME bytes, and the assertion would then pass
// on the plain cross-tree rule while proving nothing about normalisation -- a
// test green for the wrong reason.
const NFD_NAME = 'caf\u0065\u0301.md'; // e + combining acute
const NFC_NAME = 'caf\u00e9.md';        // precomposed e-acute
assert.notEqual(
  NFD_NAME,
  NFC_NAME,
  'the two spellings must differ as strings or the NFC case below is vacuous'
);
assert.throws(
  () => assertNoBundleCollision([ref(NFD_NAME, 'common'), ref(NFC_NAME, 'greenfield')]),
  /exists in both/,
  'collision guard: NFD and NFC spellings of one name must fail fast'
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

// Fixtures are derived from the real REQUIRED_COMMON_BUNDLE_FILES rather than
// restating it. A hardcoded list went stale the moment a second file joined it,
// and it surfaced as the *positive* case throwing — an assertion error that
// reads like the guard is broken rather than like the fixture is behind.
const requiredCommon = REQUIRED_COMMON_BUNDLE_FILES.map((sourceRel) => {
  const [dir, ...rest] = sourceRel.split('/');
  return { sourceRel, dir, name: rest.join('/'), sourceRoot: 'common' };
});

// Deriving the fixture from the constant makes every assertion below quantified
// over that same binding, so fixture and oracle shrink in lockstep: drop an
// entry from REQUIRED_COMMON_BUNDLE_FILES and this suite stays green while the
// file silently stops being guarded — and a tarball missing it would then have
// the installed copy DELETED from the user's project as "retired". The
// non-empty check below closes only the fully-empty case; these anchors close
// the rest. They are a lower bound, not a closed list: adding a fourth required
// file keeps them green, while removing one of these two goes red naming the
// file.
for (const anchor of ['references/ddd-modeling-guide.md', 'references/dflow-feedback-flow.md', 'references/flow-rationale-registry.md']) {
  assert.ok(
    REQUIRED_COMMON_BUNDLE_FILES.includes(anchor),
    `common guard: ${anchor} must stay in REQUIRED_COMMON_BUNDLE_FILES`
  );
}

// Without this, an empty required-list would make every case below vacuous:
// the positive passes trivially and the per-file loop never runs, so the guard
// could be gutted and the suite would still report success.
assert.ok(
  requiredCommon.length > 0,
  'common guard: REQUIRED_COMMON_BUNDLE_FILES must be non-empty or the cases below prove nothing'
);

// The real scanner (scanBundleSourceRoot, which listBundleSourceFiles calls once per
// source tree) iterates a FIXED dir list (`['references', 'templates']`, an inline
// literal since the scan was extracted) with a NON-RECURSIVE readdir,
// keeping only stat.isFile() entries. So it can return neither a nested path
// nor one under any other top-level dir — while the derivation above happily
// fabricates both. Either would pass the fixture-derived assertions (the guard
// compares sourceRel only) and then hard-fail EVERY real init /
// configure-agents for BOTH editions on the common-completeness guard.
//
// Match the scanner's whole domain, not just the nesting half: `other/foo.md`
// derives a slash-free name and would slip past an `!includes('/')` check.
const SCANNER_REACHABLE = /^(references|templates)\/[^/]+$/;
for (const f of requiredCommon) {
  assert.match(
    f.sourceRel,
    SCANNER_REACHABLE,
    `common guard: ${f.sourceRel} is not reachable by listBundleSourceFiles — ` +
    'a required common file must sit directly in templates/common/references/ or ' +
    'templates/common/templates/ (no nesting, no other top-level dir)'
  );
}

// ⚠ The edition-side filler below is still a hardcoded literal. If
// new-feature-flow.md is ever promoted to templates/common/ (the declared
// endgame of the two-track-single-source backlog item), this fixture becomes a
// state assertNoBundleCollision hard-rejects — present under both common and
// brownfield — and this suite would keep passing on an impossible package.
// Pick a different edition-only file for the filler when that lands.
assert.doesNotThrow(
  () => assertCommonBundleComplete([...requiredCommon, ref('new-feature-flow.md', 'brownfield')]),
  'common guard: all required common files present passes'
);

// Each required file must be independently guarded. A single "none of them are
// present" negative would still pass if the guard only ever checked the first
// entry, so drop exactly one file per iteration and keep the rest.
for (const missing of REQUIRED_COMMON_BUNDLE_FILES) {
  assert.throws(
    () => assertCommonBundleComplete([
      // a broken package: edition files present, and every required common file
      // except this one
      ...requiredCommon.filter((f) => f.sourceRel !== missing),
      ref('new-feature-flow.md', 'brownfield'), tpl('models.md', 'brownfield')
    ]),
    /missing required common workflow bundle file/,
    `common guard: missing ${missing} must throw (not be treated as retired)`
  );
}

console.log('PROPOSAL-064 bundle-guards tests passed');
