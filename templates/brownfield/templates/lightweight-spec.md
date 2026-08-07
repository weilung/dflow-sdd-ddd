---
id: BUG-{NUMBER}    # bug-type T2 only; a non-bug T2 (lightweight-{date}-{slug}.md) carries no id — the filename identifies it
title: {簡述問題}
status: in-progress    # in-progress | completed
bounded-context: {ContextName}    # or `none` when the host has no meaningful bounded context
created: {YYYY-MM-DD}
branch: bugfix/BUG-{NUMBER}-{slug}    # must equal the host _index.md `branch:` value (that field is authoritative) — a non-bug T2 therefore carries the host's feature/{SPEC-ID}-{slug} branch
# hotfix-branch: hotfix/{name}    # ADD (uncomment) only for a post-hoc T2 — references/modify-existing-flow.md Step 1.8. The already-merged emergency fix's own branch, kept even after that branch was deleted.
# hotfix-identity: {PR / incident / tracker reference}    # ADD only for a post-hoc T2 — the source the asserted `reconciled ({merged-hotfix-hash})` identity rests on; an uncited hash blocks closeout. Keep it adjacent to hotfix-branch.
---

<!--
Template note (for AI):
  This is the **lightweight-spec** template — it corresponds to T2 Light
  ceremony in the three-tier Ceremony Scaling (T1 Heavy / T2 Light /
  T3 Trivial; see AI-AGENT-GUIDE.md § Ceremony Scaling for the tier criteria).

  - T1 Heavy → use templates/phase-spec.md instead
  - T2 Light → THIS template; produces an independent file
  - T3 Trivial → no independent file; just one inline row in _index.md
                 Lightweight Changes with a tag like [cosmetic] / [text] / [appearance]

  Instance file location and naming:
    Place the instantiated file inside the corresponding feature directory:
      dflow/specs/features/active/{SPEC-ID}-{slug}/lightweight-{YYYY-MM-DD}-{slug}.md
    or, when the lightweight change is a tracked bug:
      dflow/specs/features/active/{SPEC-ID}-{slug}/BUG-{NUMBER}-{slug}.md

    A standalone change not yet attached to any existing feature needs a
    minimal host feature directory (with a minimal _index.md) to hold this
    instance — the structure invariant is that every spec file lives under
    some feature directory. That minimal host has a defined create / record /
    close-out lifecycle: references/modify-existing-flow.md Step 1.7 for a
    standalone change, or its Step 1.6 minimal variant when the change is a
    follow-up on a completed feature; a post-hoc hotfix reaches the same
    lifecycle through Step 1.8, which resolves its linkage to one of those two.
    Follow that lifecycle rather than
    improvising one, and do not leave an empty host behind.

  No-BR variants (a T2 that carries no BR delta at all):
    The default shape below is the classic BR-delta form (Behavior Delta with
    BR-NN entries + Root Cause). It stays valid and is the right shape whenever
    the change does have a BR delta.
    A change can reach T2 carrying no BR delta at all. These families describe
    how to write a spec the cascade has ALREADY placed at T2; none of them
    makes a change T2, and none of them overrides an earlier cascade step. Do
    NOT invent a BR-NN and do NOT write a fake root cause. Pick the matching
    family, put its BR line under `## Behavior Delta` in place of the
    ADDED / MODIFIED / REMOVED / RENAMED subsections, and replace `## Root Cause`
    with that family's evidence section:

    (a) presentation — any copy / appearance change T3 would not take: a sweep
        beyond the local unit, a whole-screen rewrite, a local edit to
        high-consequence content (a security warning, a password hint,
        consent text, a payment or legal notice), or one that changes what the output *means* (an
        instruction reversed from "company email only" to "any email", a
        danger / status colour flipped)
        BR line: `BR: none — presentation`
        Evidence: `## Output Footprint` — which screens / outputs the change
        actually reaches, and **what it now says or signals** whenever the
        meaning moved or the content is high-consequence
    (b) contract change — non-breaking structured-log / export / API / event
        field or semantics change
        BR line: `BR: none — contract change`
        Evidence: `## Contract Delta`, including a `**Downstream consumers**:`
        line naming who reads it
    (c) operational — CVE / security dependency bump, or a behavior-preserving
        refactor on an auth / payment / resilience / compliance path
        BR line: `BR: none — operational`
        Evidence: `## Operational Rationale`, including a `**Trace**:` line
        (advisory / ticket / audit reference; a self-initiated case with nothing
        to cite records `**Trace**: none — self-initiated` — the line is never
        omitted)
    (d) performance — a runtime performance / resource / SLA change, including
        one no audience perceives
        BR line: `BR: none — performance`
        Evidence: `## Performance Delta`, including an
        `**SLA / resource context**:` line
    (e) implementation defect — the rule is unchanged; the implementation was
        wrong
        BR lines: `BR Delta: none — implementation defect` AND
        `Governing BR-IDs: {BR-NN, BR-NN | none}`
        Evidence: keep `## Problem` / `## Root Cause` / `## Fix Approach`, plus a
        regression task
    (f) intentional change — a planned, non-normative functional or interaction
        change with no rule in the catalogue (default tab, redirect target,
        ordering, a presentation / interaction control)
        BR line: `BR: none — intentional change`
        Evidence: `## Change Rationale`, including `**Before**` / `**After**`
        behavior lines and a `**Regression**:` line

    More than one family can fit — a behaviour-preserving payment-retry refactor
    that also shifts runtime SLA is both (c) and (d). Do not pick one and drop
    the other's evidence: write the BR line of the family with the higher
    consequence (order: (e) → (c) → (b) → (d) → (f) → (a)) and include **every**
    matching family's evidence section. A reviewer needs the operational trace
    and the SLA context, not whichever one the author chose first.

    Family (e) keeps two fields on purpose: "no BR delta" is not "no governing
    rule". `Governing BR-IDs:` lists the rules the defect sits under, so the rule
    the fix answers to stays traceable; a genuinely uncatalogued defect records
    `none`. Never collapse the pair into a single `BR: none`.
    Family (f) is non-normative only. A new normative constraint (permission /
    eligibility / threshold / approval / required outcome) is a new BR — take it
    back to the cascade rather than filing it here, even when the catalogue has
    no BR-ID for it yet.

    Legacy shapes are accepted, never migrated. Readers and gates take both the
    classic BR-delta form and the older single `BR:` line bug form (written
    before the `BR Delta:` / `Governing BR-IDs:` split) as they are; leave
    existing specs alone and use the shapes above for new ones.

  After drafting this lightweight-spec, AI must:
    1. Add an outbound-link row to the feature's _index.md Lightweight Changes table
       (Tier = T2; description includes the link to this file).
       TIMING — do this BEFORE the implementation commit, not after. On a
       minimal (zero-phase) host the row must already be inside checkpoint 1,
       and closeout's allow-list admits only the row's `Commit` cell
       afterwards, so a row added later blocks. "Drafting", not the Step 1.7
       "Finalize + close" sub-step, which runs after that commit and only fills
       the cell in.
    2. Refresh the feature's _index.md Current BR Snapshot table to reflect
       any BR ADDED / MODIFIED / REMOVED / RENAMED in this lightweight-spec
       (a no-BR family has nothing to refresh — leave the snapshot as it is)

  Implementation Paths:
    The `## Implementation Paths` section below names the source paths this
    change touches. Paths, not a diff — enough to compare a commit against.
    REQUIRED on a minimal (zero-phase) host — standalone or follow-up:
    `/dflow:finish-feature` asserts that checkpoint 1's diff touches them, so a
    spec declaring none leaves that check nothing to compare and a missing
    declaration BLOCKS closeout rather than passing vacuously
    (references/finish-feature-flow.md Step 1; written at
    references/modify-existing-flow.md Step 1.7, before the first commit).
    On a HOSTED T2 — one recorded under a phase-bearing feature — closeout runs
    no such check and nothing blocks on it, so the section is good practice
    there, not a gate. Do not read the "blocks" above as applying to a hosted
    spec; it does not.
    Keep the paths OUT of `## Implementation Tasks`: the completion checklist
    may collapse or remove that section once the tasks are done, and the paths
    must still be readable at closeout.

  Post-hoc hotfix fields — T2 only, references/modify-existing-flow.md Step 1.8:
    `hotfix-branch:` records the already-merged emergency fix's own branch
    (keep the value even when that branch has been deleted); `hotfix-identity:`
    cites what the identity claim rests on — the PR, incident, or tracker
    reference. Both live in the frontmatter, adjacent, so the trace and the
    thing it rests on stay together. They ship COMMENTED OUT: an ordinary
    (non-post-hoc) T2 leaves them commented and they are inert. Uncomment them
    only in post-hoc mode — never fill them with `none`, and never leave them
    live on an ordinary T2, which would claim a hotfix branch that never
    existed on a record nothing else re-checks.
    In post-hoc mode `## Implementation Paths` names the paths the MERGED
    HOTFIX touched: closeout compares them against the `reconciled ({hash})`
    commit, and blocks if this host's own documentation commit touches any of
    them (that would be re-implementation, not reconciliation). Closeout tests
    plausibility only and blocks on an uncited hash; the identity itself is
    confirmed by references/pr-review-checklist.md.
-->

# {問題簡述}

## Problem

{什麼東西壞了？或什麼行為不正確？}

## Behavior Delta

> 精簡 delta 格式：bug fix 多數只需 MODIFIED；若確實是新增規則可改用 ADDED、移除用 REMOVED、改名用 RENAMED。多項變更時照類別列。
>
> 完全沒有 BR delta 時改用 no-BR 家族形（見檔首 Template note 的 No-BR variants）：本段只留該家族的 BR 行（例如 `BR: none — presentation`；家族 (e) 是 `BR Delta:` + `Governing BR-IDs:` 兩行），不要為了填滿 delta 子段捏造 BR-NN。

### MODIFIED - behavior modified in this fix
#### Rule: BR-NN {規則名稱}
**Before**: Given {current state} When {action} Then {current (incorrect) result}
**After**: Given {same state} When {same action} Then {correct result}
**Reason**: {why this change — bug / requirement clarification / spec alignment}

<!-- 若需要 ADDED / REMOVED / RENAMED / UNCHANGED 請比照 references/modify-existing-flow.md 的 Delta 格式 -->


## Root Cause

> classic BR-delta 形與 no-BR 家族 (e) 保留本段；家族 (a)–(d)、(f) 以該家族的 evidence 段取代本段（見檔首 Template note 的 No-BR variants）。

{為什麼會這樣？是邏輯錯誤？資料問題？還是需求理解有誤？}

## Fix Approach

{怎麼修？有沒有抽到 Domain 層的機會？}

## Implementation Paths

> The source paths this change touches — paths, not a diff, at a granularity a
> commit can be compared against. **Required on a minimal (zero-phase) host**:
> `/dflow:finish-feature` asserts checkpoint 1's diff touches them, and
> declaring none **blocks** closeout instead of passing. On a **hosted** T2 —
> recorded under a phase-bearing feature — closeout runs no such check, so this
> is good practice there rather than a gate. Do not move the list into
> `## Implementation Tasks`: that section may be collapsed once the tasks are
> done, and these paths must still be readable at closeout.
>
> **Post-hoc hotfix (Step 1.8)**: list what the **already-merged hotfix**
> touched. This host's own documentation commit must **not** touch any of them.

- `{src/path/touched}`
- `{src/another/path/touched}`

<!-- dflow:section implementation-tasks -->
## Implementation Tasks

> Keep T2 Light tasks concise. If the fix scope starts to expand, AI should pause and ask the developer whether to keep this as T2 or upgrade it to T1. Do not auto-upgrade based on task count alone.
>
> Recommended layer tags (Brownfield): `DOMAIN` / `DELIVERY` / `DATA` / `TEST` / `DOC`
> (`DELIVERY` covers delivery/entrypoint code: presentation/UI layer, controllers,
> handlers, jobs, message consumers, data pipelines, or stored procedures)

- [ ] {LAYER}-1: {minimal required change}
- [ ] TEST-1: {minimal verification / regression test}
- [ ] DOC-1: Update `_index.md` Lightweight Changes and Current BR Snapshot

Layer tag list above is the recommended set; the developer may extend with project-specific tags as needed.

## Tech Debt Discovered (if any)

{在修這個 bug 時發現的其他問題，記錄到 tech-debt.md}
