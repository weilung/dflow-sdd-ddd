# Drift Verification — rules.md ↔ behavior.md Consistency Check

Triggered by `/dflow:verify` or `/dflow:verify <bounded-context>`.

## Purpose

The A+C structure (`rules.md` as index + `behavior.md` as scenario content) introduces a drift risk — the two files can fall out of sync. This command provides a mechanical verification safety net that developers can run at key moments: before a PR, after a refactor, or when onboarding to an unfamiliar Bounded Context.

## Scope

### This command does (mechanical layer)

Three string-matching checks that AI can perform deterministically:

1. **BR-ID forward check**: Every `BR-*` declared in `rules.md` has a corresponding section in `behavior.md`
2. **Anchor validity**: If `rules.md` links to `behavior.md#section`, that anchor exists
3. **BR-ID reverse check**: Every `BR-*` referenced in `behavior.md` is declared in `rules.md`

### This command does NOT do (semantic layer — explicitly excluded)

Semantic verification (LLM reads the one-line summary in `rules.md` vs the Given/When/Then in `behavior.md` and judges whether they contradict) is **out of scope**. Reasons:
- Mechanical checks already catch most drift (missing IDs, broken links)
- Semantic judgment costs tokens and requires human review of LLM conclusions
- Deferred to Wave D — revisit after 10+ verify runs show the type distribution of actual drift

### This command does NOT do (feature-directory aggregation — explicitly excluded)

After PROPOSAL-009 introduced the feature directory layout
(`dflow/specs/features/active/{SPEC-ID}-{slug}/` containing `_index.md` plus
0..N `phase-spec-*.md` and 0..N `lightweight-*.md`), a tempting but
**out-of-scope** extension would be: "make `/dflow:verify` aggregate BR
state across all phase-spec files in a feature, then cross-check against
`rules.md`." Don't do that here.

Reasons (R7 Review F-03 decision):
- Feature-level BR aggregation is already maintained by `_index.md`
  Current BR Snapshot, refreshed by `/dflow:new-phase` Step 5 and
  `/dflow:finish-feature` Step 3
- BC-level current state is already maintained by `rules.md` /
  `behavior.md`, written by the same `/dflow:finish-feature` Step 3
- `/dflow:verify` keeps a small, mechanical scope: just the
  `rules.md` ↔ `behavior.md` correspondence inside one BC
- Cross-feature / cross-phase aggregation would mix `/dflow:verify`'s
  job with `/dflow:finish-feature`'s job and produce false positives
  during in-progress features

If a future need arises to add an `_index.md` Current BR Snapshot ↔
`rules.md` cross-check, that belongs in a follow-up PROPOSAL-008
extension, not in this command's current scope.

### Anchor coexistence with `dflow:section`

`dflow:section` HTML comment anchors and markdown heading anchors serve different purposes:

- Markdown heading anchors (e.g., `behavior.md#br-001-rule-name`) remain the primary link target for BR-ID verification.
- `<!-- dflow:section ... -->` anchors are helper markers for AI/tool section positioning only.
- `dflow:section` does **not** replace BR-ID markdown anchors, and does **not** change the drift-verification algorithm.

So this command still uses BR-ID + markdown auto-id anchors as its primary index; `dflow:section` is auxiliary metadata.

## Usage

```
/dflow:verify            # Verify all Bounded Contexts
/dflow:verify Expense    # Verify a single BC (recommended default)
```

When verifying all BCs, run each context independently and report per-context results.

## Verification Steps

For each Bounded Context:

### Step 1: Locate files

- Find `dflow/specs/domain/{context}/rules.md`
- Find `dflow/specs/domain/{context}/behavior.md`
- If either is missing, report and stop for that context:
  ```
  ✗ Expense: rules.md exists but behavior.md is missing
    → Create the missing file using the matching template:
      - rules.md → templates/rules.md
      - behavior.md → templates/behavior.md
      Or run the completion flow to populate it from existing completed specs
  ```

### Step 2: Extract BR-IDs from rules.md

Scan `rules.md` for all `BR-*` identifiers. Record each ID and any anchor link to `behavior.md`.

### Step 3: Extract BR-IDs from behavior.md

Build two sets:

- **Primary set (scenario-bound)**: BR-IDs that appear in section headings
  (e.g. `## Amount Validation (BR-001)`) or in the formal `(BR-NNN)` marker
  inside a Given/When/Then scenario block. These represent BR-IDs that have
  a dedicated scenario section.
- **Supplementary set (body-text mentions)**: BR-IDs that appear only in
  prose / discussion text, outside any Given/When/Then block. These are
  informational references, not equivalent to a scenario section.

### Step 4: Cross-reference

Run the three checks using the primary set from Step 3 as the main comparison basis:

| Check | Pass condition | Fail message |
|---|---|---|
| Forward | Every BR-ID in rules.md has a corresponding scenario section in behavior.md (primary set) | `✗ BR-NNN declared in rules.md but has no scenario section in behavior.md` |
| Anchor | Every `behavior.md#anchor` in rules.md resolves to an existing heading | `✗ BR-NNN links to behavior.md#section but anchor not found` |
| Reverse | Every BR-ID formally referenced in behavior.md (primary set) is declared in rules.md | `✗ BR-NNN referenced in behavior.md scenario but not declared in rules.md` |

Body-text mentions (supplementary set) do **not** satisfy forward / reverse
pass conditions on their own. They are reported separately as informational
signals (see Step 5).

### Step 5: Report

Output format:

```
Verifying {Context} — rules.md ↔ behavior.md consistency

✓ BR-001 → scenario section exists and references BR-001
✓ BR-002 → scenario section exists and references BR-002
✗ BR-003 → behavior.md has no scenario section for BR-003
          (note: BR-003 appears in body text of another section,
           but that does not satisfy the forward check)
ℹ BR-005 → body text reference only — no dedicated scenario section;
           confirm this is intentional (e.g. cross-reference to another BR)

✗ BR-010 → formally referenced in a behavior.md scenario but not
          declared in rules.md

Summary: 3 passed, 2 issues, 1 informational

Issues:
1. rules.md declares BR-003, but behavior.md has no corresponding
   scenario section
   → Possible cause: rule was implemented but behavior.md wasn't
     updated in the completion flow; or a body-text mention was
     mistaken for a scenario
   → Action: check the implementation, then either add the scenario
     to behavior.md (preferred) or remove BR-003 from rules.md if
     deprecated

2. behavior.md's {scenario section name} formally references BR-010,
   but rules.md doesn't declare it
   → Possible cause: scenario was added directly to behavior.md
     without updating rules.md
   → Action: add BR-010 to rules.md with a one-line summary, or
     remove the stale scenario reference from behavior.md
```

## When to Run

Recommended trigger points (not enforced — developer's judgment):
- Before creating a PR (`/dflow:verify` as a pre-PR sanity check)
- After a refactor that touched multiple specs or domain docs
- When onboarding to an unfamiliar Bounded Context (verify before trusting the docs)
- After running `/dflow:finish-feature` — that command writes BC layer
  updates from the feature's `_index.md` Current BR Snapshot; verify
  catches any anchor / link drift introduced by the merge

## Path Assumptions (post-PROPOSAL-009)

This command operates entirely within `dflow/specs/domain/{context}/` files
(`rules.md` and `behavior.md`). It does **not** read from
`dflow/specs/features/active/{SPEC-ID}-{slug}/` directories — the feature
directory layout introduced by PROPOSAL-009 is not part of verify's
input. The only effect of feature directory layout on this command is
ensuring `last-updated` dates in `behavior.md` are bumped at
`/dflow:finish-feature` time (so verify's mechanical drift guard stays
useful).

## Interaction with Other Commands

- `/dflow:verify` is a **standalone command** — it does not require an active workflow
- It can be run mid-workflow (e.g., during Step 7 implementation to check you haven't drifted)
- It can be run after `/dflow:finish-feature` lands — that's the moment
  BC-layer files get rewritten; verify catches mechanical issues from
  the merge
- If issues are found, the developer decides whether to fix now or defer — the command does not block other workflows
