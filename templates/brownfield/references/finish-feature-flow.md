# Finish Feature Workflow

Step-by-step guide for when a developer triggers `/dflow:finish-feature` —
the feature closeout ceremony.

This command makes the previously-implicit closeout step (originally a
sub-step of `new-feature-flow` / `modify-existing-flow`) explicit and
directly callable. It validates that all phase-specs are completed,
syncs the feature-level BR Snapshot to the bounded context's system-level
state, archives the feature directory, and emits a Git-strategy-neutral
**Integration Summary** for the developer's PR / merge / push step.

**Important boundaries**:
- This command **does not auto-merge** and never pushes or opens a PR on its
  own. Merge strategy follows the team's selected Git policy (`gitflow` /
  `trunk`, recorded in `dflow/specs/shared/_conventions.md` § Git Policy).
- Closeout is split into two gates so it works offline: a **Local-closeout
  gate** (Steps 1–4: validation, status flip, BC sync, archive + the closeout
  commit checkpoint — all doable with no network; what is optional is **who**
  runs that commit, not whether it happens, see Step 4) and an **Integration / PR
  gate** (Step 5: push / merge / PR — needs network; the AI only runs
  `git push` / `gh pr create` when you explicitly ask).
- At the archive checkpoint the AI may offer to commit using your Git identity;
  you can always decline. The commit marker mode is read from `_conventions.md`
  § AI Commit Policy. This replaces Dflow's earlier "the AI never commits"
  stance — the AI helps at natural checkpoints, you keep the final say.
- The BC-layer sync in Step 3 **reuses the existing documentation-sync
  mechanism** from `new-feature-flow` (§ 8.3) and `modify-existing-flow`
  (Step 6.3) — it does not introduce a new sync flow. Treat it as "lift
  that step out of the per-phase checklist and run it once at feature
  closeout, with the `_index.md` Current BR Snapshot as input."

**Step Gates** in this flow (stop-and-confirm before proceeding):
- Step 1 → Step 2 (validation passed → flip status)
- Step 3 → Step 4 (BC sync done → archive)
- Step 5 → Step 6 (Integration Summary emitted → follow-up reverse-link — required when the feature is a follow-up)

All other step transitions are **step-internal**: announce "Step N complete,
entering Step N+1" and proceed without waiting. See AI-AGENT-GUIDE.md § Workflow
Transparency for the full transparency protocol and confirmation signals.

## Step 1: Validate Phase Specs and `_index.md`

Before producing any closeout prose or Integration Summary text, read
`dflow/specs/shared/_conventions.md` and apply the `## Prose Language`
setting. If the setting is missing or not an explicit language tag, ask the
developer to update `_conventions.md` before continuing.

AI runs mechanical checks first. Report `✓` / `✗` for every item; if any
`✗` appears, **stop here** and ask the developer to address them before
proceeding (do not flip status, do not archive, do not emit summary).

**Hash evidence** (several checks below use this test). A hash recorded in
`_index.md` passes *hash evidence* when all three hold:
- **(a) it is a commit** — `git cat-file -t {hash}` reports `commit`;
- **(b) it is on this branch** — `git merge-base --is-ancestor {hash} HEAD`
  succeeds;
- **(c) its diff carries what the record claims** — the commit's **changed
  paths** include the artifact that row or checkpoint points at; each check
  below names which. **Tree presence is not enough**: every commit inherits the
  files an earlier one added, so a commit that only touched the implementation
  would otherwise satisfy (c) for an artifact it never wrote. (a) and (b) alone
  prove only that *some* earlier commit exists on this branch; (c) is what ties
  it to the record.

**What these checks do and do not prove.** They catch the mistakes that actually
happen — work left uncommitted, a placeholder hash never replaced, a row copied
from another feature — not a record deliberately built to look right.
Whole-history assertions ("no stray host-open commit exists anywhere on this
branch") are **review's** job, not closeout's: they belong to
`references/pr-review-checklist.md`.

> **Reconcile a mainline hotfix BEFORE you run these checks.** If a T2 / T3
> post-hoc hotfix (`modify-existing-flow.md` Step 1.8) landed on the mainline
> while this feature was in flight and the two touched the same code, settle the
> overlap **now, before the checklist below** — anything *recorded into this
> host* after the checks have passed has bypassed them.
>
> **What you classify here is the merge-resolution delta, not the hotfix.** The
> hotfix records itself in its **own** minimal host through Step 1.8 — follow-up
> or standalone, never an in-flight feature — and that host is where
> `reconciled ({merged-hotfix-hash})`, the identity citation and the per-tier
> trace live. If the hotfix has not been documented yet, run Step 1.8 for it
> first and come back; do **not** absorb it into this feature, whose ordinary
> checkpoints would record none of that. What is left for this host is only what
> *choosing between the two versions* changed. **Classify that by the cascade,
> then record what the classification calls for:**
>
> - **No tracked delta** — the cascade's **below workflow** level. It stays in
>   the integration commit message; do **not** manufacture a row or a document.
>   Nothing to validate, so nothing changes below. This is the common case.
> - **A tracked delta (T3 or above), phase-bearing host** — record it in this
>   host and let it ride the normal checkpoints, then run the checklist below
>   against the result. A phase-bearing host has no fixed commit count, so an
>   extra checkpoint is ordinary.
> - **A tracked delta (T3 or above), minimal (zero-phase) host** — it does
>   **not** go into this host: the two-commit lifecycle has one implementation
>   (or `spec-baseline`) checkpoint and one closeout, and every Lightweight
>   Changes row must belong to that first commit. This host closes on what it
>   already carries, and the delta is routed **after** Step 4 archives it — by
>   Step 5's second bullet, the same route every post-closeout leftover takes.
>   Do **not** route it now: you are mid-closeout, and routing would open a
>   second host before this one is sealed. Note it, finish the closeout, then
>   take Step 5's route — back through `/dflow:modify-existing`, which picks the
>   host the way it always does. Do not decide that here: by then this feature
>   is *completed*, so the normal completed-feature disambiguation applies and
>   the answer may be a follow-up or a standalone host.
>
> Classification decides, never "is it worth writing down". After closeout the
> host is frozen — Step 5 says what is left over, and applies the same cascade.

**What "Minimal host (zero-phase) only" selects, and what that does not prove.**
Several checks below apply only to a minimal host. Decide it from the
**persisted shape**: an **empty Phase Specs table and no `phase-spec-*` file**
in the host directory. There is no other selector — closeout runs in a fresh
session and cannot know which flow step created the host. So a host that
*carries* a phase is certified as **phase-bearing**, whatever it was intended to
be, and takes the ordinary checks rather than these. This gate does **not**
prove "this host was opened as minimal and stayed that way"; that is a claim
about history, and it belongs with the whole-history assertion already assigned
to `references/pr-review-checklist.md`. The routing rules are what keep the two
apart in practice: a T1 never records into a minimal host, and a sealed minimal
host cannot take anything further.

- [ ] Locate the feature directory at `dflow/specs/features/active/{SPEC-ID}-{slug}/`
- [ ] `_index.md` exists and parses (YAML front matter intact, and all seven
      required sections present — the Metadata front matter, Goals & Scope,
      Phase Specs, Current BR Snapshot, Lightweight Changes, Checkpoint Log,
      Resume Pointer; `Follow-up Tracking` is `templates/_index.md`'s optional
      eighth section and appears only when this feature has follow-ups)
- [ ] Every row in `_index.md` Phase Specs table has Status = `completed`
- [ ] Every phase-spec file referenced in the Phase Specs table exists at
      the path the table claims
- [ ] **And the other direction, for every host shape: every spec file in the
      host directory is named by a row** — each `phase-spec-*` by a Phase Specs
      row, each `lightweight-*.md` / `BUG-*.md` by a `Tier = T2` Lightweight
      Changes row. The checks around this one walk rows → files, so a file no
      row names is otherwise never examined. Deliberately **not** scoped to a
      host shape: an unreferenced `phase-spec-*` is precisely what makes a host
      read as *phase-bearing* to the minimal-host selector below, so a
      shape-scoped version of this check could never be the one that sees it.
      An orphan file **blocks** — either it belongs to a phase or change whose
      row is missing, or it belongs to nothing and does not belong in the host.
- [ ] Every phase-spec file's frontmatter has `status: completed`
- [ ] Every Tier = T2 row in `_index.md` Lightweight Changes references an
      existing `lightweight-*.md` / `BUG-*.md` file in the feature directory
- [ ] Every such lightweight / BUG spec file's frontmatter has
      `status: completed`
- [ ] **Minimal host (zero-phase) only** — every row in `_index.md` Lightweight
      Changes has a **non-empty `Commit` cell that passes hash evidence**; for
      (c), the commit carries that row's own work: a **T2**'s
      `lightweight-*.md` / `BUG-*.md` file; for a **T3** an `_index.md` that
      already carries this row at that hash — Step 1.7 writes every row *before*
      checkpoint 1, which is what makes that provable here; for a **baseline**
      row, the BC-layer capture it records — and for a
      baseline the capture must be **added or modified** by that commit and
      **exist in its tree**, never deleted or renamed away: a commit that
      *removes* the document cannot be the one that captured it, yet it changes
      the same path. This applies to
      **T2, T3, and baseline rows alike**. Three failures, all blocking —
      **report the one that is true**, because the message is the developer's
      only clue about what to do next: an **empty** cell means that change is not
      committed yet; a cell holding a **placeholder** (`{hash}`, `{pending}`,
      `（待 commit）` — anything `git cat-file -t` cannot resolve) means the cell
      was **never filled in**, which is a different repair and may well have a
      commit sitting there unrecorded; a **resolvable** value that fails (a)–(c)
      means the hash is the wrong one. ⚠ Do not collapse the middle case into the
      first: it is the one that reads as *filled* to every rule written against
      empty / non-empty, which is exactly why it survives elsewhere.
      (`modify-existing-flow.md` Step 1.7 "Finalize + close" is where the
      **cell** gets backfilled once its commit exists.)
      **Deliberately not run on a phase-bearing host**: a hosted T3's row rides
      the host's *next* commit (`references/git-integration.md` § Commit
      checkpoints), and nothing requires a hosted row to declare implementation
      paths — so (c) has no defined input there, and demanding it would reject
      every hosted T3. Those hosts keep the two `Tier = T2` checks above, which
      never covered a T3 row anyway — a T3 has no spec file in Dflow
      (`references/git-integration.md` § Gate Checks by Branch Type).
- [ ] `_index.md` has no obvious open items in Resume Pointer (e.g. "phase-N
      drafting" / "implementation pending" / "TODO" markers)
- [ ] **You are on this host's branch — or on a branch this host recorded a
      sanctioned override for.** `git rev-parse --abbrev-ref HEAD`
      equals `_index.md`'s `branch:` value — that field is authoritative for the
      whole host — and for a **T2** the lightweight-spec's frontmatter `branch:`
      equals it too. Steps 1–4 run *before* the merge / PR gate, so a mismatch
      means you are closing out somewhere other than where the work was
      finished, and it **blocks**. Hash evidence does not cover this: any
      sibling branch descended from checkpoint 1 satisfies (a)–(c). For a
      **post-hoc** host this compares against the **documentation** branch,
      never `hotfix-branch:`, which names the already-merged hotfix.
      **Before blocking on a mismatch, read the Checkpoint Log for a
      `branch-override` row.** `references/git-integration.md` § Branch gate
      offers "override and stay" as a sanctioned third option and defines that
      row's shape. If **any** such row's Result names the branch `HEAD` is on,
      the mismatch is one this host recorded deliberately and this item
      **passes**. `branch:` itself is still never rewritten — the override is a
      record beside it, not a correction of it.
      ⚠ **The row must name *this* branch** — that is the whole test. "An
      override happened once" would excuse closing out on any branch at all,
      which is not what the option sanctions; requiring the row to name where
      you actually are defeats that without over-blocking.
      ⚠ **Deliberately not "the most recent override".** A host can override onto
      `develop` for one phase and onto `spike/x` for the next, then close out on
      `develop` — and closeout fires no branch gate of its own, so no newer row
      is ever written. Keying on the most recent row would block a branch this
      host recorded a sanctioned override for, which is the same false block
      this clause exists to remove.
      ⚠ **What this cannot decide, stated rather than patched:** whether a
      recorded override is still the current intent. **Nothing expires a row at
      all** — not when the developer moves back to the host's own branch, not
      when a later override supersedes it, and not with distance from closeout.
      So *any* branch this host ever recorded an override for stays acceptable
      here: closing out on the base branch after the feature branch was merged
      passes, and so does closing out on an abandoned spike branch that an
      override named two phases ago. Closeout cannot separate either from a
      legitimate override. **Which branch the closeout commit actually landed on
      is visible in the PR**, and it is judged by
      `references/pr-review-checklist.md`'s **"A recorded branch override still
      matches where the closeout landed"** item.
      **When it passes this way, say so in the conversation** — name the row and
      the branch, e.g. *"HEAD differs from `branch:`; found a recorded
      `branch-override` for `{branch}` in the Checkpoint Log — verified and
      passing."* A gate that silently accepts an exception teaches the developer
      nothing about why it passed. ⚠ This announcement is a **flow instruction,
      not a gate**: nothing enforces it and no check verifies it happened.
      ⚠ What this clause repairs: the product offers "override and stay", and
      before this, taking that option meant the host could **never** close out —
      `finish-feature-flow.md` did not mention `override` anywhere.
- [ ] **Minimal host (zero-phase), baseline only** — **a `spec-baseline`
      checkpoint and a `Tier = baseline` row imply each other**, and the host
      carries the capture and nothing else, proved against the **commit**, not
      only the ledger. This check selects when **either** appears: checkpoint 1
      named `spec-baseline`, **or** any `Tier = baseline` row in the Lightweight
      Changes table. Selecting on the checkpoint alone leaves the other
      direction open — a baseline row sitting under an ordinary
      `implementation | committed ({hash})` checkpoint would never be examined,
      while `modify-existing-flow.md` Step 1.7 says a baseline capture is
      observation-only and **never** uses `implementation`. So checkpoint 1
      **must** read `spec-baseline` with Result `committed ({hash})`, and all
      three of these hold:
      (1) the Lightweight Changes table holds **exactly one** row and it is the
      `Tier = baseline` one;
      (2) the Current BR Snapshot is **empty**;
      (3) that commit's diff (`git show --stat {hash}`) contains **only this
      list and nothing else** — (i) the BC-layer documents the `Tier = baseline`
      row declares, (ii) this host's own `_index.md`, (iii) for a
      **follow-up** baseline, the `_index.md` of **every** original this host's
      `follow-up-of` names — it may be a YAML array, and Step 1.6 requires the
      opening reverse-link row in **each** of them to ride this commit, so a
      singular reading would reject the second parent — and (iv) the **global**
      documents a capture records into (`glossary.md`,
      `migration/tech-debt.md`), which belong to no bounded context and are
      named as capture destinations by Part A's observation-only routing and by
      Step 2's Systematic Baseline Capture. **Any other path blocks —
      implementation source above all.**
      `modify-existing-flow.md` Step 1.7 states the contract: a baseline capture
      is observation-only, *there is no implementation work*, which is why its
      checkpoint is not named `implementation`. (1) and (2) alone are the ledger
      talking about itself; (3) is what makes the claim true of the commit. (A
      **phase-bearing** host may legitimately hold a `Tier = baseline` row
      alongside other work; it is not zero-phase and never reaches this check.)
- [ ] Current BR Snapshot table is non-empty — **or this host's own record
      carries no BR delta**, which is what makes an empty one legitimate.
      That condition is the check; the shapes below are illustrations of it,
      not the list of them: a **T3** host; a **no-BR family T2** whose Behavior
      Delta is a `BR:` / `BR Delta:` none line; a **baseline capture**
      (observation-only, so it has no BR delta to record); a **phase-bearing**
      host — **including a T1** — whose phase-specs establish no BR delta,
      which the cascade explicitly allows (genuinely new work is
      `/dflow:new-feature` "even with no new BR / Domain / schema",
      `AI-AGENT-GUIDE.md` § Ceremony Scaling step 0, and `new-feature-flow.md`
      Step 4 initialises the Snapshot from planned BRs that may legitimately be
      none); or a shape added later that likewise carries none. Decide from the
      artifact, not from a
      declaration: "the feature is intentionally no-BR" is a claim, and the
      record is what settles it. A classic BR-delta spec carrying ADDED /
      MODIFIED / RENAMED entries **and** an empty Snapshot means finalization
      never refreshed it (`modify-existing-flow.md` Step 1.7) and **blocks**.
- [ ] **Minimal host (zero-phase) only** — the Lightweight Changes table has
      **at least one row** (a T2, T3, or baseline row). An empty Phase Specs
      table **and** an empty Lightweight Changes table is an **empty host** →
      reject closeout.
- [ ] **Minimal host (zero-phase) only** — **every spec file in the host
      directory is named by a row.** The checks above walk rows → files, so a
      spec file that no row names is never examined by them; this item closes
      the other direction. A `phase-spec-*` always fails (the Phase Specs table
      is empty by definition); a `lightweight-*.md` / `BUG-*.md` with no
      Tier = T2 row fails the same way. A **T3-only** or **baseline** host
      carries no spec file at all, so any spec file there fails this check.
- [ ] **Minimal host (zero-phase) only** — the Checkpoint Log shows a
      **committed** first checkpoint before this closeout: Checkpoint
      `implementation` with Result `committed ({hash})` (normal) or `reconciled
      ({merged-hotfix-hash})` (hotfix post-hoc), or — for a **baseline** host —
      Checkpoint `spec-baseline` with Result `committed ({hash})`. A first
      checkpoint still reading `skipped` or `failed` **blocks** closeout — but
      they are not the same problem. `failed` means the commit was attempted and
      did not land: the work is genuinely uncommitted and has to land. `skipped`
      means only that **the AI's offer was declined**
      (`references/git-integration.md` § Commit Checkpoints), *not* that no
      commit exists — the developer may have made it themselves, which leaves
      the ledger **incomplete rather than final**. Complete it:
      `modify-existing-flow.md` Step 1.7's "Finalize + close" backfills the row
      to `committed ({hash})` with the developer's real hash. Do **not** waive
      this check for a `skipped` row, and do **not** write a hash you have not
      verified.
- [ ] **Minimal host (zero-phase) only** — **the Checkpoint Log carries exactly
      one row at this point.** A minimal host takes exactly two checkpoints and
      the second is the closeout row Step 4 adds below, so before closeout there
      is exactly one: the first checkpoint validated above. A second pre-closeout
      row — an extra `implementation`, a stray `spec-baseline`, or a leftover
      from an abandoned attempt — means this host did not take the two-commit
      lifecycle and **blocks**. A failed or declined attempt does **not** add a
      row: both are recorded by editing the existing one in place. "Exactly two
      after closeout" follows from the post-commit read below, which derives its
      admitted differences from Step 2 and Step 4 instruction 1 and admits
      nothing else.
      ⚠ **Why this counts every row, with no exclusion for the
      `branch-override` record:** a minimal host cannot carry one.
      `references/modify-existing-flow.md` withholds the branch-gate override
      from exactly these hosts (Step 1.6's follow-up variant, Step 1.7, Step
      1.8), because they assert branch equality against a `branch:` cut by change
      class. **If that is ever relaxed, this count has to change with it** — that
      row is a record rather than a checkpoint, and counting it would reject a
      host for having used a sanctioned option.
      This counts the rows in **this
      host's own table** — it is not the whole-history assertion, which stays
      with `references/pr-review-checklist.md`.
- [ ] **Minimal host (zero-phase) only** — **that first commit is real, and it
      is this host's.** The Checkpoint Log is prose; verify the hash behind it
      against **hash evidence**. Take the hash that stands for checkpoint 1 —
      for a **normal** host the `committed ({hash})` value; for a **baseline**
      host the `spec-baseline` row's `committed ({hash})` value; for a **hotfix
      post-hoc** host the Lightweight Changes row's `Commit` cell (**not** the
      `reconciled (...)` hash, which names the already-merged hotfix). For (c),
      touching *some* path under
      `dflow/specs/features/active/{SPEC-ID}-{slug}/` is **not enough** — a
      stray host-open commit does that much while the work is still
      uncommitted. Require the tier's artifact **among the commit's changed
      paths** — (c) is what this commit wrote, not what its tree contains: a
      **T2**'s `lightweight-*.md` / `BUG-*.md` spec file; for a **T3** an
      `_index.md` the commit **changed** *and* which, as committed at that hash,
      already carries this change's Lightweight Changes row — `git show --stat
      {hash}` **and** `git show
      {hash}:dflow/specs/features/active/{SPEC-ID}-{slug}/_index.md`, both, not
      either; for a **baseline**, the BC-layer capture it claims to record —
      **added or modified** and present in that commit's tree, never deleted or
      renamed away — together with the `Tier = baseline` row. Any of (a)–(c)
      failing **blocks** closeout.
- [ ] **Minimal host (zero-phase) only** — **checkpoint 1 is *one* commit, and
      every row names it.** For a **normal** host the Checkpoint Log's
      `committed ({hash})` and **every** Lightweight Changes row's `Commit` must
      be the **same** hash, and that commit's diff must **touch the
      implementation paths** its lightweight-spec or rows describe. Step 1.7
      requires the artifact to **declare** those paths; an artifact naming none
      leaves nothing to compare against, so a missing declaration **blocks** —
      it never passes vacuously. For a **baseline** host the same equality holds
      between the `spec-baseline` row's `committed ({hash})` and the
      `Tier = baseline` row's `Commit`; its counterpart to "implementation
      paths" is the BC-layer documents that capture recorded.
      Assert the **equality itself**, not merely that each value passes hash
      evidence on its own: two hashes that each resolve, are each reachable, and
      each contain some named artifact describe a **three**-commit host —
      host+spec at A, implementation at B, closeout at C — which clears every
      other check on this list while breaking the two-commit lifecycle.
      **Exempt — post-hoc hotfix only, and only this much:** the
      `reconciled (...)` checkpoint hash and the row `Commit` cells name
      different commits **by design** (Step 1.8), so do not assert equality
      *between those two*, and do not apply the implementation-path condition to
      this host's own commit — the check below tests the merged hotfix instead.
      **Everything else still holds:** a post-hoc host can be compound too
      (Step 1.7, "minimal means zero-phase, not one-artifact"), so **every** row
      `Commit` must still name the **same single documentation commit**.
- [ ] **Minimal host (zero-phase) only** — **nothing that constitutes the change
      itself is still uncommitted.** This is deliberately not "the host
      directory is clean": **checkpoint 1 carries the change, the closeout
      commit carries the record the flow writes afterwards.** Checkpoint 1 sits
      at `modify-existing-flow.md`'s Step 5 → Step 6 gate and holds the change
      itself — for a **T2** its lightweight-spec plus the implementation source,
      for a **T3** its `_index.md` row plus the implementation source, and for a
      **baseline** host the BC-layer capture itself, which *is* that host's
      change. What the flow writes *after* that gate — Step 6's completion
      checklist and Step 1.7's "Finalize + close" — is derived record and rides
      into the closeout commit.
      **A post-hoc host (Step 1.8) inverts the source half, and this is where
      the reconciliation contract is enforced.** Its change is the *already
      merged* hotfix; checkpoint 1 is the **documentation** commit. So that
      commit must carry the spec / row and this host's `_index.md` and must
      **not** touch any implementation path the artifact declares — read
      `git show --stat {checkpoint-1-hash}` and block if one appears. A
      re-implementation committed there passes every other gate on this list
      (rows agree, the `reconciled` hash differs from it and touches the
      declared paths, the tree is clean) while breaking §8's "reconcile, do not
      re-run" outright, so nothing else catches it.
      **What this proves and what it does not — do not widen it here.** It
      proves checkpoint 1 is documentation-only. It does **not** prove the
      branch carries no re-implementation elsewhere: a second commit beside
      checkpoint 1, or a re-implementation in a path the artifact does not
      declare, both survive it. Widening it to the branch was tried and does not
      work from inside closeout — the range needs a base branch, and Dflow
      deliberately does not know yours. ⚠ **No check covers it today.** The
      whole-history item already assigned above to
      `references/pr-review-checklist.md` is **not** it: that one counts commits
      under this host's spec directory, so a re-implementation commit touching
      only source never appears in its output. Review is where the missing
      assertion belongs — a reviewer has the base branch in front of them — but
      do not read the existing item as discharging it.
      **Blocks closeout:** any of the **implementation source** files this
      host's lightweight-spec or rows describe, staged or unstaged in
      `git status --porcelain`; for a **baseline** host the BC-layer documents
      its `Tier = baseline` row records, which are that capture's own content
      and belong in the `spec-baseline` commit — never in closeout; any
      **untracked** file under
      `dflow/specs/features/active/{SPEC-ID}-{slug}/`; and any tracked file
      dirty beyond the closed list below.
      **May ride into the closeout commit — this list and nothing else:**
      (i) `_index.md`, with its uncommitted delta confined to Lightweight
      Changes `Commit` cells, Checkpoint Log rows, Resume Pointer, and Current
      BR Snapshot;
      (ii) an **already-committed** `lightweight-*.md` / `BUG-*.md`, with its
      uncommitted delta confined to the frontmatter `status:` flip to
      `completed` and — when the developer accepted the offer — the
      `Implementation Tasks` collapse / removal the Step 6 completion checklist
      makes once those tasks are done ("applies to both phase-spec and
      lightweight-spec"). On a minimal host that checklist necessarily runs
      *after* checkpoint 1, so this edit is uncommitted here by construction;
      (iii) the Domain-layer documents **this change's Step 6.3 sweep** updates
      — under `dflow/specs/domain/`, plus
      `dflow/specs/migration/tech-debt.md` — scoped to *this change's* delta.
      A **T3** has no Domain sweep at all (Step 6's tier-conditional note), so
      nothing qualifies under (iii) for a T3. A **no-BC** host has no
      *BC-scoped* sweep — a dirty `dflow/specs/domain/{context}/…` or
      `context-map.md` under one is fiction and **blocks** — but the **global**
      documents (`glossary.md`,
      `migration/tech-debt.md`) belong to no bounded context, stay in its sweep,
      and therefore still qualify under (iii). **(iii) never covers a baseline
      host** either — its BC-layer capture *is* the change, and is blocked
      above.
      Read each delta (`git diff -- {path}`) — do not infer it from the
      filename. **The list is closed** — if a later change adds another
      finalization field, add it here explicitly; "a host file is dirty" is never
      on its own a reason to pass. (Unrelated work in progress elsewhere is
      fine; say which files you judged unrelated.)
- [ ] **Minimal host (zero-phase), no-BC only** — **the host did not commit a
      bounded context it does not have.** The check above reads the *working
      tree*; this one reads the **committed** side, because a fictitious
      `{context}` invented at Step 2 and committed into checkpoint 1 leaves a
      perfectly clean tree. Inspect checkpoint 1's diff
      (`git show --stat {hash}`, with status — **not path names alone**): for a
      host that declared itself no-BC that commit must **not touch, in any way**
      — add, modify, delete or rename — any `dflow/specs/domain/{context}/…`
      document. A deletion is a BC-layer change like any other, and reading only
      the path list would accept one as if nothing had happened. The documents:
      `rules.md`, `behavior.md`, `models.md` — and no `context-map.md` (the
      Brownfield context map is optional and grows organically, so a no-BC host
      inventing a row in it is the same fiction). Any of them **blocks**
      (`modify-existing-flow.md` Step 2's no-BC guard is where this should have
      been caught first). A **baseline** host is not a no-BC host and this
      check does not apply to it — its BC-layer capture is the point.
      **Do not over-reach:** this rejects only Domain documents that commit
      *added or changed* — pre-existing Domain files it never touched are
      irrelevant, and the **global** documents (`glossary.md`,
      `migration/tech-debt.md`) belong to no bounded context and stay
      legitimate for a no-BC host, exactly as the allow-list above says.
- [ ] **Minimal host (zero-phase), follow-up only** — **the reverse link was
      opened, not only closed.** Step 1.6 requires the original feature's
      Follow-up Tracking row for this host to be created as `in-progress` and to
      ride checkpoint 1; Step 6 flips it to `completed` afterwards. Verify the
      opening half here, from committed state: for **every** SPEC-ID this host's
      `follow-up-of` names — it may be a YAML array, so check each one —
      `git show {checkpoint-1-hash}:dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
      must already carry this host's row with Status `in-progress`. A row absent
      there **blocks** closeout: the Step 6 flip would then create it directly as
      `completed`, and the `absent → in-progress → completed` history the
      follow-up contract requires never happened. Decidable from one commit and
      one blob per original, so it stays inside closeout's remit. A
      **completed-only baseline** host is a follow-up variant and takes this
      check too.
- [ ] **Minimal host, hotfix post-hoc only** — the reconciliation record is
      complete, **within a stated boundary**. This check proves **plausibility,
      not identity**: that `{merged-hotfix-hash}` is a credible candidate, and
      that the developer has said on the record which fix it is and how they
      know. Whether it is *the* merged hotfix is **not decidable from inside
      this flow** — the repository holds no independent record of which commit
      that was; only the developer and the issue tracker do. Do not read a pass
      here as identity confirmed. Identity is
      **asserted** at `modify-existing-flow.md` Step 1.8 and **confirmed** by
      `references/pr-review-checklist.md` — the same assignment the
      whole-history assertion gets above.
      The plausibility conditions, all required: the
      `reconciled ({merged-hotfix-hash})` value passes hash evidence — (a) and
      (b) as usual, and for **(c)** its diff touches the implementation paths
      the T2 lightweight-spec or the T3 row **declares** (Step 1.7 requires that
      declaration; an artifact naming none leaves (c) nothing to compare and
      **blocks** rather than passing vacuously). It must also **differ**
      from the Lightweight Changes row's documentation-commit hash (different
      provenance; see Step 1.8). The per-tier trace must exist too: a **T2**
      carries `hotfix-branch:` in its lightweight-spec frontmatter, a **T3** has
      its Lightweight Changes row Description marked as a hotfix. Finally the
      developer's identity assertion must be **present and cited** — Step 1.8
      requires the source it rests on (PR / incident / tracker reference), and
      it lives with the per-tier trace, so look for it there: beside
      `hotfix-branch:` in a **T2**'s lightweight-spec, in the row Description
      for a **T3**. An uncited hash **blocks** closeout: it leaves pr-review
      nothing to confirm against, and this gate is not a substitute for that
      confirmation.

> **Zero-phase minimal host (`modify-existing-flow.md` Step 1.7 / the Step 1.6
> minimal variant / Step 1.8's post-hoc hotfix, whose linkage resolves to one of
> those two).** A standalone / follow-up minimal host, or a baseline
> capture, closes out with an **empty Phase Specs table** — that is valid, not
> a failure: the "every
> Phase Specs row is completed" check passes vacuously and there is no
> `phase-spec-*` file to look for. A no-BR / T3 host also has an intentionally
> empty Current BR Snapshot — the **Current BR Snapshot** check above decides
> that from the host's own record, not from a declaration. Do **not**
> manufacture a phase-spec or a BR row to make a check "pass".

If any check fails:
> "Cannot finish feature `{SPEC-ID}-{slug}` yet — {N} validation issues
> found:
>   ✗ phase-spec-2026-04-15-foo.md status is still `in-progress`
>   ✗ Phase Specs table row 3 references missing file phase-spec-...
>   ✗ lightweight-2026-06-20-rounding.md frontmatter status is still `in-progress`
>
> Address these (run `/dflow:new-phase` to add missing work, or fix the
> stale status manually), then re-run `/dflow:finish-feature`."

**Once every item above reads `✓`, record the baseline the post-commit check
compares against.** For **every file in the host directory** — not only the
`_index.md` and the spec files the tables name — run `git hash-object {path}`
and state the resulting `path → blob` list in the conversation. **That list is
the baseline** — Step 4's post-commit verification compares each committed blob
against it, **over the same span**.
⚠ **This is a flow instruction, not a gate.** Nothing enforces it and omitting
it does not block closeout. But the check has no other durable baseline: "the
tree Step 1 read" otherwise lives only in this session's working memory, and
**`HEAD^` is not a substitute** — at this point the working tree legitimately
carries uncommitted finalization edits and this change's documentation-sweep
deltas, so comparing against the parent commit reports every one of them as a
difference no step ordered.

**→ Step Gate: Step 1 → Step 2**

If all checks pass:
> "All {N} phase-specs are completed and `_index.md` is internally
> consistent. Ready to flip the feature status to `completed`?
> `/dflow:next` to proceed."

Wait for confirmation before entering Step 2.

## Step 2: Flip `_index.md` Status to `completed`

Update the feature's `_index.md` Metadata block:

```yaml
---
spec-id: SPEC-{YYYYMMDD}-{NNN}
slug: {slug}
status: completed         # ← flipped from in-progress
created: {YYYY-MM-DD}
branch: {unchanged — keep the host's existing value}   # feature/{SPEC-ID}-{slug} or bugfix/BUG-{NUMBER}-{slug}; never rewrite
---
```

**Flip `status` only — never rewrite `branch:`.** The `branch:` field is
authoritative and stays exactly as opened: a bugfix host keeps its
`bugfix/BUG-{NUMBER}-{slug}` value, a **non-bug** standalone / follow-up host —
and every baseline capture, which is never a functional bug — keeps its
`feature/{SPEC-ID}-{slug}` value. The branch follows the **change class**, not
how the host was opened — a functional-bug standalone or follow-up host **is** a
bugfix host and keeps `bugfix/BUG-*` (the branch-by-class rule at
`modify-existing-flow.md` Step 1.7 step 4). Overwriting it to `feature/...` at
closeout would break branch equality for a bugfix host.

Also update the **Resume Pointer** to reflect closeout — this writes the
cursor's terminal state (after closeout no workflow is active on this
feature; do not edit the cursor again after the Step 4 closeout commit):

```
**Current Progress**: feature completed ({date}); all phase-specs status = completed.
**Next Action**: integration — push / merge / PR per the selected Git policy.
**Active Workflow**: none
**Current Step**: n/a
**Gates Passed**: n/a
**Awaiting**: none
```

**→ Transition (step-internal)**: Step 2 complete. Announce "Step 2 complete (status flipped). Entering Step 3: Sync BR Snapshot to BC layer." and continue.

## Step 3: Sync `_index.md` Current BR Snapshot to BC Layer

**First, branch on what this host actually carries** — "zero-phase" (no
phase-spec) is independent of whether a bounded context exists, so a minimal
host may still touch a real BC, or none at all:

- **(i) BC-bearing** — the host touched a real bounded context, **whether or
  not it carries a BR delta** (BC presence and BR presence are independent). Run
  the sync below **for the documents this host actually changed**: a BR delta
  updates `rules.md` / `behavior.md`; a no-BR family that touched a documented
  behaviour still updates `behavior.md`. Fill the Integration Summary's BC field
  with the context, and its BR-IDs with whatever applies — a real set, the
  per-family no-BR marker, or empty. Do **not** skip, and do **not** manufacture
  a BR delta a no-BR host does not have. (A host whose **entire** payload is a
  baseline capture is **(iii)**, not this case.)
- **(ii) no-BC** — the host touched **no** bounded context at all (a display
  T3, an appearance sweep). **Skip this sync entirely** — do **not** create
  `rules.md` / `behavior.md`, and do not invent a BC to sync into. Its
  Integration Summary sets the field that **reports a sync** — `BC` — to
  `none`. **`Related BR-IDs` is not one of those**: it reports what this
  change's own record carries, so it stays empty or keeps the per-family no-BR
  marker. Step 5's "exact fields" block is the authority on the shape; do not
  flatten it to "all BR fields are none" here.
- **(iii) baseline pre-captured** — this host's **entire** payload is the
  baseline capture: a **zero-phase minimal host** whose only Lightweight Changes
  row is the `Tier = baseline` one. That capture already wrote the BC-layer
  documents when it ran (`modify-existing-flow.md` Step 1.7), so there is
  **nothing more to sync**; the Integration Summary's BC field names the
  captured context (not `none`). A **phase-bearing** host carrying a baseline row
  alongside other work takes **(i)** instead and syncs everything except the
  baseline. A *minimal* host cannot be in that position at all — Step 1 blocks a
  `spec-baseline` host that carries anything beyond its capture.

For a **BC-bearing host (case i only)**, continue with the sync. This step **reuses the
existing sync mechanism** from `new-feature-flow`
Step 8.3 (`dflow/specs/domain/{context}/rules.md` + `behavior.md` updates). The
input is the feature's `_index.md` Current BR Snapshot table; the output
is the BC's `rules.md` and `behavior.md` updated to reflect the
feature's net effect.

**Minimal host — sync input.** A minimal host has no phase-spec: read the
"phase-spec" references in the steps below ("each phase-spec's Delta") as the
host's **lightweight-spec** recorded delta plus its Current BR Snapshot. A
no-BR family that changed a documented behaviour still syncs `behavior.md` from
that lightweight-spec's delta.

Before syncing, ensure the BC files **this sync actually writes** exist; create a
missing one from its template **only when this host's delta writes to it**. Case
(i) above syncs "the documents this host actually changed", so a document this
host does not touch is **not** created — a BC-bearing **T3**, or a no-BR family
that touched only one of them, leaves the others absent, exactly as case (ii)
does for a no-BC host. Creating one anyway plants the same fiction the no-BC
guard refuses:
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`

> **Table-cell formatting**: keep table cells concise — separate multiple short items with `<br>` (never chain them into one line with ；/; separators), and move long narrative detail out of the cell into a document section (full convention: the formatting comment at each spec doc's head).

For each row in Current BR Snapshot — **every** row, not only the `active` ones.
The branch below is selected by the row's own Status, and a `removed` row is
exactly what the REMOVED branch needs:

- Status `active`, and the BR-ID is **not yet in `rules.md`** → add it (new
  ADDED rule introduced by this feature)
- Status `active`, and the BR-ID is **already in `rules.md`** but the rule text
  differs → update it (MODIFIED rule, reflect the new text)
- If the BR-ID was previously in `rules.md` and is now in Current BR
  Snapshot with Status = `removed` → remove the corresponding section in
  `rules.md` (REMOVED rule)
- For any RENAMED BR-ID → rename the BR-ID in `rules.md` and update
  `glossary.md` if the term itself changed
- For every BR-ID added, modified, or renamed above, set its `Last updated`
  date in `rules.md`'s Rule Index to today

For `behavior.md`:

- For every BR-ID still active after this feature, ensure
  `dflow/specs/domain/{context}/behavior.md` has a scenario section (anchor)
  matching the BR-ID
- For REMOVED BR-IDs, delete the corresponding scenario section from
  `behavior.md`

This is the **mechanical input that `/dflow:verify` later uses** for the
rules.md ↔ behavior.md drift check (see `references/drift-verification.md`).

Cross-reference each phase-spec's Delta-from-prior-phases section to
double-check the net result; the Snapshot is the SSOT but the per-phase
Deltas are the audit trail.

> Note: this step does NOT read individual phase-specs to re-derive the BR
> set — that work was already reconciled by `/dflow:new-phase` Step 7 each
> time a phase completed. We trust `_index.md` Current BR Snapshot as the
> feature-level truth here. If the developer finds drift between Snapshot
> and the phase-specs, fix `_index.md` first, then re-run
> `/dflow:finish-feature`.

Also update `migration/tech-debt.md` / `models.md` / `glossary.md` as
discovered during the feature (the same items listed in
`new-feature-flow.md` Step 8.3) — these may have been touched per phase
already; this is the closeout sweep.

**→ Step Gate: Step 3 → Step 4**

> "BC `{context}` synced — `rules.md` updated ({n_added} added,
> {n_modified} modified, {n_removed} removed), `behavior.md` anchors
> updated, `last-updated` set to {date}. Ready to archive the feature
> directory? `/dflow:next` to proceed."

For a **no-BC host** (case ii) the sync was skipped — do **not** announce a
sync that did not happen. Say instead: "No BC-scoped sync was performed (no-BC
host). Ready to archive the feature directory? `/dflow:next` to proceed." Do
**not** say "nothing was written to the Domain layer" — a no-BC host may still
have updated a **global** document (`glossary.md`, `migration/tech-debt.md`);
those belong to no bounded context and Step 4 must still stage them.

For a **baseline host** (case iii) the BC was already captured at baseline —
nothing further to sync. Say instead: "BC `{context}` was pre-captured at
baseline; nothing further to sync. Ready to archive the feature directory?
`/dflow:next` to proceed."

Wait for confirmation before entering Step 4.

## Step 4: Archive — `git mv` the Feature Directory

AI runs:

```bash
git mv dflow/specs/features/active/{SPEC-ID}-{slug} \
       dflow/specs/features/completed/{SPEC-ID}-{slug}
git status   # confirm rename detection AND check for `RM` — an `M` next to
             # a rename means unstaged edits you must re-add before committing
```

`git mv` is mandatory — never use plain `mv` + `git add`. This preserves
git's directory rename detection so `git log --follow` / `git blame` /
PR diff quality stays intact across the move. See
`references/git-integration.md` § "Directory Moves Must Use git mv" for
the full rule set.

**Closeout commit checkpoint** (completes the offline Local-closeout gate):

```
✓ Feature archived to completed/ and closeout ready to stage
   Commit this closeout now?
   [Y] Yes — the AI commits with your Git identity (marker per _conventions.md § AI Commit Policy)
   [N] No — skip; you commit yourself
```

Then, in this order:

1. **Record the checkpoint row first.** Write one row in the moved
   `_index.md` Checkpoint Log — `closeout | committed` for Y, `closeout |
   skipped` for N. The closeout row carries **no commit hash**: the closeout
   commit cannot contain its own hash. Trace it later via
   `git log -1 -- dflow/specs/features/completed/{SPEC-ID}-{slug}` (or the
   optional `Dflow-Checkpoint` trailer). The "hash only after success" rule
   still applies to spec / implementation rows — closeout is the documented
   exception (see `references/git-integration.md` § Commit Checkpoints,
   Branch Gate & AI Commits).
   **Backfill any unfilled hosted `Commit` cell in the same edit** — a hosted row
   waits for the host's *next* commit and this is it. **Unfilled means empty *or*
   holding a placeholder** — `{hash}`, `{pending}`, `（待 commit）`, anything that
   `git cat-file -t` cannot resolve; both are backfilled the same way, and the
   placeholder case matters more because the cell is **non-empty** and therefore
   invisible to every rule written against empty / non-empty. Write each row's own
   implementation hash, never the closeout hash. After closeout there is no next
   commit, which is why `references/pr-review-checklist.md` asserts it there.
2. **Stage the whole archived feature directory:**

   ```bash
   git add dflow/specs/features/completed/{SPEC-ID}-{slug}
   ```

   This is required, not optional: `git mv` stages the rename with the
   **last-committed** content, so working-tree edits made earlier in this
   flow to the moved files — the Step 2 status flip and Resume Pointer
   update, plus the checkpoint row you just wrote — stay **unstaged** until
   this `git add`. In `git status`, the moved `_index.md` showing `RM`
   instead of plain `R` is exactly this signal. Then also `git add`
   **every external document this closeout carries.** That set is defined
   here, once, and it covers **every** host shape — take it from this
   instruction, not from a list kept somewhere else:
   **(a)** whatever Step 3 wrote (`rules.md`, `behavior.md`, `models.md`,
   `glossary.md`, `migration/tech-debt.md`) — Step 3 is **skipped entirely for a
   no-BC host** (and for a baseline host), so this half is empty there; **and**
   **(b)** the **documentation-sweep step of the flow that produced *this
   change*** — take the paths from that step, not from a list kept here. It runs
   *after* that flow's implementation checkpoint and *before* closeout, so **that
   flow** leaves its deltas uncommitted; a later phase's own checkpoints may have
   committed them since, and staging an already-committed path is a no-op.
   Those sweeps reach
   Domain-layer documents under `dflow/specs/domain/`, plus the **global**
   documents `glossary.md` and `migration/tech-debt.md`, which belong to no
   bounded context and stay legitimate for a **no-BC** host. The two that exist
   today —
   `modify-existing-flow.md` **Step 6.3** and `new-feature-flow.md`
   **§ 8.3 Documentation updates** — are **illustrations, not the definition**:
   a later flow with a sweep of its own is covered without editing this line.
   ⚠ **Key it on the flow that produced the change, never on the flow that
   opened the host.** Those differ, and keying on the host is how the deadlock
   came back: `modify-existing-flow.md` Step 1.6 opens a **phase-bearing** host
   for a T1 follow-up, and Step 6.4 puts a T1 new-phase or a T2 lightweight
   *inside* a host opened by `/dflow:new-feature` — each of those runs Step 6.3
   as its own sweep. Ask "which flow opened this host" and a hosted **T2** on a
   phase-bearing **no-BC** host has no arm at all: half (a) is empty because
   Step 3 is skipped, and the `glossary.md` rename its Step 6.3 made belongs to a
   sweep the question refused to look at. Unstaged it fails the clean-tree item;
   staged it is attributable to nothing. Deriving from *this change's* flow is
   the fix — not widening the set to "anything dirty".
   ⚠ **How to tell which flow produced a change: it is determined by the
   artifact, and it is recorded nowhere.** The ledger has no producer column, so
   read it off the shape.
   A **Lightweight Changes row** was produced by `modify-existing-flow.md` **by
   construction** — that is the only flow that writes such a row
   (`/dflow:bug-fix` routes into the same file, and `new-feature-flow.md` creates
   that table empty and never adds to it), so its sweep is **Step 6.3**.
   A **phase-spec** has three possible producers — `/dflow:new-feature`,
   `/dflow:new-phase`, or `modify-existing-flow.md` Step 1.6 / 6.4 routing into
   the new-feature machinery — and **you do not have to tell them apart**:
   § 8.3 and Step 6.3 enumerate the same external paths, and `/dflow:new-phase`
   has no sweep at all, so every branch yields the same set or the empty set.
   ⚠⚠ **That second half holds by coincidence, not by design.** It is true only
   while those two sweeps list the same paths. **Change either sweep so the sets
   diverge and this instruction stops being executable — which flow produced a
   given phase is written down nowhere.** Re-open this paragraph before editing
   either sweep.
   ⚠ **`/dflow:new-phase` has no sweep and is deliberately absent here.**
   `new-phase-flow.md` Step 7 updates the phase-spec and this host's own tables,
   and says so in as many words — "System-level domain docs, migration debt sync,
   and the feature directory move to `completed/` remain
   `/dflow:finish-feature` responsibilities. **Do not sync system-level current
   state**". It produces no external delta for this instruction to carry.
   On a **minimal host** that set is exactly what Step 1 admitted as allow-list
   member (iii). On a **phase-bearing** host Step 1 produces **no allow-list at
   all** — that checkbox is `Minimal host (zero-phase) only` — so read the sweep
   directly and **do not go looking for a list that host never produced.**
   ⚠ Keying this on Step 1's allow-list is what deadlocked the one shape where
   both halves are empty: a **phase-bearing, no-BC** host that swept a global
   document has nothing from Step 3 *and* no Step 1 allow-list, while this
   instruction still requires the delta staged and the post-commit path check
   would then reject it as unpermitted — two mandatory requirements that could
   not both be met.
   Read each delta (`git diff -- {path}`) and scope every one to *this change*;
   staging only "what Step 3 wrote" leaves a no-BC host's global delta dirty and
   the post-commit clean-tree check fails.
3. **Commit (Y) or stop (N).** For Y the AI commits. If a pre-commit hook
   rejects it or the commit fails, flip the checkpoint row to `failed` (the
   row is not committed yet — edit it directly), surface the error, and
   treat the gate as unsatisfied.

**Post-commit closeout verification** — after a successful commit, and before
declaring the Local-closeout gate satisfied, AI runs and reports `✓` / `✗` for
every item:

- [ ] `git ls-tree -r --name-only HEAD
      dflow/specs/features/completed/{SPEC-ID}-{slug}/` — **every file this
      commit carries from inside the archived host directory** — then
      `git show HEAD:<path>` for each.
      **The span, fixed once and used by both halves of this check:** exactly
      that set — nothing wider, nothing narrower. What may differ, and what
      blocks, are judged over exactly that span. (An earlier form let the two
      halves drift apart, which produced two of the three defects this rewrite
      replaces.)
      ⚠ **The span is derived from what was staged, not from what the tables
      name.** Instruction 2 stages the archived directory **whole**, so a span
      built from the Phase Specs and Lightweight Changes rows is narrower than
      the commit. Greenfield's Step 1 permits one such file by name (an
      `aggregate-design.md` worksheet); brownfield has no counterpart today, and
      keying on `git ls-tree` means it needs no edit if one ever appears.
      **The baseline is the `path → blob` list Step 1 recorded** — the tree
      Step 1 read, captured rather than remembered. **Match on the path relative
      to the host directory**: Step 1 recorded them under
      `active/{SPEC-ID}-{slug}/`, this commit carries them under
      `completed/{SPEC-ID}-{slug}/`, and the `git mv` preserved the relative
      tree — so the two lists line up entry for entry once the prefix is set
      aside. Compare each with `git rev-parse HEAD:{completed path}`.
      ⚠ **If that list was not recorded, report this check as degraded and say
      so — do not substitute `HEAD^`.** The parent commit is not the tree Step 1
      read: the edits legitimately uncommitted at Step 1 would each surface as a
      difference no step ordered, and the check would block a correct closeout.
      Step 1 blocks unless every
      spec in the host already reads `status: completed`, so those flips are
      already **in** the baseline whichever step made them: a **minimal** host's
      come from `modify-existing-flow.md` Step 1.7's finalization, a
      **phase-bearing** host's from its phases completing — no phase-bearing
      host runs Step 1.7, whichever flow opened it. Either way the
      flips are not differences this check admits; they are part of what it
      compares against. (They are differences only from the *pre-flip* record,
      which is not the baseline.)
      **The condition is derived, not listed:** within that span, the committed
      blob differs from that baseline in **exactly the edits Step 2 and Step 4
      instruction 1 ordered, carrying the values those steps state, and in
      nothing else**. Read those two steps and compute the set — do not keep a
      second copy of it here. Any difference **no step of this closeout ordered**
      is edit fallout and **blocks**.
      ⚠ **Deliberately not a checklist of admitted edits.** An earlier form kept
      a hand-synced copy of what Step 2 and instruction 1 already say, and it
      grew a fresh defect — in the interaction between that copy and something
      else — every time it was touched. **The failure mode was the duplication,
      not the wording**, so another wording is not the repair: a check that has
      to be rewritten repeatedly is a design question, and the exit is a stated
      boundary rather than one more predicate. **Adding a required edit to
      Step 2 or to instruction 1 needs no edit here** — that is what deriving
      buys, and it is why the maintenance instruction that used to sit at this
      spot is gone.
      **What this check cannot decide — stated, not asserted:** whether a
      backfilled hosted `Commit` cell holds *that row's own* implementation hash
      rather than some other commit's. Instruction 1 orders that value and is
      the single place the constraint lives; closeout cannot verify it, because
      on a phase-bearing host Step 1's hash-evidence test is minimal-host-only
      and so **no check here reads the value at all**.
      **Identity is confirmed by `references/pr-review-checklist.md`'s
      "Hosted `Commit` cell identity" item**, which sits in that file's
      *Delegated to review by `finish-feature-flow.md`* block — the same
      assignment this file already makes for the whole-history assertion and for
      hotfix identity.
      ⚠ **Not** its "Every Lightweight Changes row now carries a `Commit` hash"
      item: that one asserts **presence, not correctness**, and pointing a
      boundary at a presence check would make it a hole rather than a division
      of labour.
      **Do not re-add a predicate for it here**: asserting a constraint at a
      point that cannot decide it is what made the previous form read like a
      gate while proving nothing.
      ⚠ A **hosted** row on a phase-bearing host may legitimately reach closeout
      with an **empty** cell — it is filled by the host's **next** commit, which
      may be a later phase's implementation commit or, when none follows, this
      closeout via instruction 1 (`git-integration.md` § Commit checkpoints). An
      empty cell is therefore not on its own a failure of this check. Omitting
      that case blocked the path outright.
      **Scope, stated so it is not read as more than it is:** this gate re-reads
      the archived **host directory** only — what the archived record *says*.
      What the closeout **commit** *contains* is the separate item below; neither
      implies the other, and "closeout is clean" needs both.
      What has actually gone missing this way: `branch:` rewritten away from the
      value the host opened with (Step 2 flips `status` only, so a bugfix host
      still reads `bugfix/BUG-{NUMBER}-{slug}`); `follow-up-of` dropped by the
      Step 2 metadata edit — Step 5 skips Step 6 when it is absent, so losing it
      strands the original feature's reverse link at `in-progress` while
      closeout reports success; a Lightweight Changes row, or its `Commit` cell,
      deleted — archiving an effectively empty host.
      The closeout row's Result must also **not** be `failed`: you are reading a
      commit that landed, so `failed` contradicts reality (`committed` on the Y
      path, `skipped` when the developer declined and committed it themselves).
      **Minimal host (zero-phase) additionally**: the **first** checkpoint row
      still carries the hash Step 1 validated —
      `implementation` with `committed ({hash})`,
      `reconciled ({merged-hotfix-hash})`, or — for a **baseline** host —
      `spec-baseline` with `committed ({hash})`.
      Reading the **committed** blob is what catches "the rename carried stale
      content" and "the row never made it into the commit".
- [ ] **The closeout commit contains only what closeout is allowed to write.**
      Read its changed paths (`git show --stat HEAD`) and admit **only** the
      archived host directory — the `git mv` rename plus the finalization
      Step 1 validated — **plus exactly the external paths Step 4 instruction 2
      ordered staged**. That is the same derivation the item above uses, applied
      to the other half of "closeout is clean": the permitted set comes from the
      instruction that ordered the staging, never from a copy kept here.
      ⚠ **Keyed on instruction 2, and deliberately not on Step 1's allow-list.**
      Step 1 produces an allow-list only for a `Minimal host (zero-phase)`; a
      phase-bearing host has none. Keying this item on it — with "plus whatever
      Step 3 wrote" as the other half — left a **phase-bearing, no-BC** host with
      **both** sources empty (Step 3 is skipped for a no-BC host and for a
      baseline host) while instruction 2 still required its global sweep delta
      staged: stage it and this item rejected the path, skip it and the
      clean-tree item failed. Instruction 2 is the one statement that covers
      every host shape, which is why it is the source.
      **Anything else blocks**: implementation source, or a
      `domain/{context}/…` document under a host that declared itself no-BC.
      **Scope: this is a path-level spill check and nothing more.** It proves no
      unpermitted *file* entered the commit — not that the permitted ones carry
      only this host's delta. Judging a hunk inside `rules.md` as "this host's
      change rather than an unrelated BR edit" needs the intended delta, which
      lives in the spec and the row, not in a path list. The item that reads one
      against the other is `references/pr-review-checklist.md`'s
      **"The closeout commit carries only this host's delta"**.
      Say that plainly rather than implying the stronger claim. A clean
      tree does not even cover the path level — it proves the changes were
      committed, not that only permitted ones were — and Step 4's staging
      instructions prove nothing on the developer-commit path.
- [ ] `dflow/specs/features/active/{SPEC-ID}-{slug}/` no longer exists (the
      directory was moved, not copied)
- [ ] `git status --short` shows no leftovers related to this feature
      (working tree clean; identify any unrelated dirty files explicitly)

If any item fails, do **not** declare closeout complete — fix it and re-verify.
**How you may fix it depends on the host.** A **phase-bearing** feature has no
fixed commit count, so re-add and amend *or* a follow-up commit both work; the
developer chooses. A **minimal (zero-phase) host** does not: its lifecycle is
exactly checkpoint 1 plus closeout, and every check above rests on that, so the
repair must go **into the closeout commit itself** — re-add and amend. Nothing
has been pushed yet (integration is Step 5), so amending is safe here. A
follow-up commit would give the host a third host-mutating commit while its
ledger still claims two; the Step 6 flip is the *only* sanctioned
post-closeout commit, and it touches the original feature, not this host.

The Local-closeout gate is satisfied **only when the closeout is committed and
the verification above passes**. If you declined the commit (chose N) or it
failed, Local-closeout is **not** satisfied yet — commit the staged closeout
yourself before continuing; do not enter the Integration / PR gate with
uncommitted changes. Once committed and verified, the gate stands on its own
offline; integration happens in Step 5 when you have network.

**→ Transition (step-internal)**: Step 4 complete. Branch on the verification result:

- **Closeout commit landed and post-commit verification passed** → announce "Step 4 complete (feature archived; Local-closeout gate satisfied). Entering Step 5: Integration / PR gate." and continue.
- **Closeout commit was declined (N), failed, or verification reported `✗`** → **stop here.** Announce "Step 4 complete (feature archived), but the Local-closeout gate is not satisfied yet — the closeout is staged but uncommitted, or the committed content failed verification. Commit the staged changes (or fix the failure), then resume to Step 5." Do **not** enter Step 5 with uncommitted or unverified closeout changes.

## Step 5: Emit Integration Summary (Git-strategy-neutral)

**First, print the closeout verification's derivation.** Before the summary
itself, state in the conversation *how* Step 4's post-commit verification
reached its result — not that it passed, but how it was computed:

1. **The baseline** — the tree Step 1 read, and which step put each spec's
   `status: completed` flip into it (Step 1.7's finalization on a minimal host;
   the phases completing on a phase-bearing one, which never runs Step 1.7).
2. **The differences you derived, each with the step that ordered it** —
   Step 2 or Step 4 instruction 1. This is the set the check *derives* instead
   of listing, so printing it is what lets a reader check the derivation rather
   than trust it.
3. **The external paths admitted, and which half of Step 4 instruction 2 each
   came from** — what Step 3 wrote, or this change's own sweep.
4. **What the check could not decide, and who holds it** — for a backfilled
   hosted `Commit` cell, that closeout cannot decide whether the value is that
   row's own implementation hash, and that
   `references/pr-review-checklist.md`'s **"Hosted `Commit` cell identity"**
   item is where it gets confirmed (not its presence check). Say this **even
   when there was nothing to backfill**, so its absence is visible rather than
   silent.
5. **Any check that passed on a recorded exception** — e.g. a branch mismatch
   honoured by a `branch-override` row, naming the row and the branch.

**Why this is here.** The verification derives its admitted set instead of
reading a list — that is what keeps the list and its sources from drifting
apart — but it also means a reader cannot see the set by looking at the
checklist. Printing the derivation keeps the flow inspectable instead of a box
that answers `✓` without showing its working.

⚠ **This is a flow instruction, not a gate.** Nothing enforces it, no check
verifies it happened, and omitting it does not block closeout — Step 4's
verification is the gate and it has already run. Do not cite or restate this
paragraph as a guard: describing an instruction as a gate is a defect this repo
has paid to remove before.

Then produce a plain-text summary of what this feature did. The summary is
**not** a commit message template — it is reference material the
developer adapts to whichever merge strategy their project uses
(merge commit, squash, rebase, fast-forward — Dflow stays neutral).

The selected Git policy's `Git-principles-{gitflow|trunk}.md` (seeded at init
under `dflow/specs/shared/`) explains, in its "Integration Commit Message
Conventions" section, how to format the actual commit / merge message from this
summary.

Format:

```
== Integration Summary: {SPEC-ID}-{slug} ==

Feature Goal: {1-2 sentences from _index.md Goals & Scope}

Change Scope:
- BC: {context-name}
- Phase Count: {N} (phase-spec-{date1}-{slug1} ... phase-spec-{dateN}-{slugN})
- Lightweight Changes: {n_t2} T2 lightweight specs + {n_t3} T3 inline rows + {n_baseline} baseline rows

Related BR-IDs (post-closeout state):
- ADDED: BR-NN, BR-NN, ...
- MODIFIED: BR-NN, BR-NN, ...
- REMOVED: BR-NN, BR-NN, ...

Phase List:
- phase-1 ({date}): {phase-slug} — {1 line}
- phase-2 ({date}): {phase-slug} — {1 line}
- ...

Next Steps (developer) — Integration / PR gate (needs network):
- Per the selected Git policy (`gitflow` / `trunk` in `_conventions.md`), choose
  a merge strategy (merge commit / squash / rebase / fast-forward) and execute
- Push to remote / open a PR — the AI can run `git push` / `gh pr create` for
  you, but only when you explicitly ask; it never pushes on its own
```

**Zero-phase minimal host — exact fields** (these must match the Step 3
branch — do not require a field Step 3 left empty). A standalone or follow-up
minimal host has `Phase Count: 0`, an empty Phase List, and at least one row in
Lightweight Changes.

- a **no-BC host** (Step 3 case ii) sets `BC: none` (nothing was synced).
  **`Related BR-IDs` is not fixed to `none`**: it reports what this change's own
  record carries, not what was synced, so it takes the same values a BC-bearing
  host would — **empty**, or the **per-family no-BR marker** when the T2 carries
  one. A T3-only no-BC host has neither and leaves it empty. Forcing `none` here
  would erase a marker the approved zero-phase shape requires.
- a **BC-bearing host** (Step 3 case i) sets `BC:` to the context and `Related
  BR-IDs:` to what it actually touched — a real set, the per-family no-BR
  marker, or empty for a no-BR host.
- a **baseline minimal host** (Step 3 case iii) sets `BC:` to the captured
  context (not `none`); **every other field keeps its zero-phase form**, and
  `Related BR-IDs:` is **empty** — an observation-only capture has no BR delta,
  and BRs it merely *found* already in the code are system state, not this
  change's evidence.

Print the summary to the conversation; do not write it to a file (it is
ephemeral closeout output).

**A mainline hotfix that overlapped this feature.** A T2 / T3 post-hoc hotfix
(`modify-existing-flow.md` Step 1.8) records itself in its own host, so when
this feature's branch finally meets the mainline both may have touched the same
code, and whoever merges picks between two existing versions. By the time you
read this, **Step 4 has already archived and committed this feature — its host
is frozen.** Classify whatever is left by the cascade (`AI-AGENT-GUIDE.md`
§ Ceremony Scaling), never by "is it worth writing down":

- **No conflict, or a resolution with no tracked delta** — it stays in the
  integration commit message. That is the cascade's **below workflow** level:
  do not manufacture a document, and do not reopen this feature.
- **A tracked delta (T3 or above)** — completed features are frozen, so it goes
  where every post-completion change goes: back through
  `/dflow:modify-existing`, which opens a follow-up or standalone host for it.
  Do **not** edit the archived `_index.md`.
- **The resolution moves system state** — if choosing between the two versions
  changes a business rule, a documented behaviour, or an extracted model, the
  owning document (`rules.md` / `behavior.md` / `models.md`) **must** be
  updated. That update is itself a tracked change and takes the route above;
  system-state truth is never below workflow.
- **It is bigger than a merge** — if resolving it means *new or changed*
  behaviour rather than choosing between two that already exist, it is not a
  merge question at all: run it through the cascade and open the flow its tier
  calls for.

**Reconciling before closeout is simpler.** If the branches meet while this
feature is still in flight — a rebase onto the mainline, say — handle it then
as ordinary in-flow work — but **which host takes it depends on this host's
shape**. A **phase-bearing** host absorbs a tracked delta (T3 or above) and
rides the normal checkpoints; a **minimal (zero-phase)** host **cannot** once
checkpoint 1 has landed, because every Lightweight Changes row must belong to
that commit — it closes on what it carries and the delta is routed afterwards.
No tracked delta stays below workflow, in the integration commit message.
Step 1's pre-checklist callout states that whole side in full, minimal-host
branch included. The four bullets above decide it whichever side of closeout you are on —
they are principles, not a checklist; the situation is rare and varied, so use
judgement.

**→ Step Gate: Step 5 → Step 6**

If the feature has `follow-up-of` in its Metadata, prompt the developer —
naming **every** original it lists (the field may be a YAML array):
> "This feature is a follow-up of `{原 SPEC-ID}` (and `{原 SPEC-ID-2}`, …).
> Ready to update **each** original feature's `_index.md` Follow-up Tracking row
> to mark this follow-up as `completed`? `/dflow:next` to proceed (or tell me
> you'll do it manually — either way this tracking commit is **required** before
> closeout is complete; see Step 6)."

If no `follow-up-of` field, skip Step 6 and announce closeout complete:
> "`/dflow:finish-feature` complete for `{SPEC-ID}-{slug}`. Feature
> directory is now at `dflow/specs/features/completed/{SPEC-ID}-{slug}/`,
> with the Local-closeout gate satisfied (closeout committed and verified).
> Integration — merge / push / PR — follows the selected Git policy, at
> your discretion."

**In-flight reminder** — after the closeout announcement (with or without
Step 6), run the in-flight overview scan (see `AI-AGENT-GUIDE.md` § Status /
Control Commands) and list any other unfinished features in `active/` and any
in-flight feature / bugfix branches. Surfacing them at closeout is deliberate:
attention is about to move elsewhere, and this is exactly where half-done work
sinks.

## Step 6: Reverse-Update Follow-up Tracking (only if follow-up)

For features that were created as follow-ups of an earlier completed
feature, update the Follow-up Tracking table of **every** original this host's
`follow-up-of` names — one parent, or several when the field is a YAML array.
For each of them:

1. Locate `dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
2. Find the Follow-up Tracking section's row for this feature's SPEC-ID
3. Flip Status → `completed`

```bash
# The AI makes the edit and may offer to commit it (Y / N), per the AI commit policy
```

This flip is a **sanctioned post-completion mutation, not a checkpoint** —
the follow-up host is already closed out and archived, so it is recorded in
**no** Checkpoint Log (neither this original feature's nor the follow-up
host's). It **must still be committed**, though: the flip is a real edit to
the original feature's `_index.md`. Require the tracking commit — the AI offers
it (Y / N); if the developer declines or the commit fails, **stop and do not
declare closeout complete** until the flip is committed. After it commits,
verify **per original** with
`git show HEAD:dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
that the Follow-up Tracking row now reads `completed` in the **committed** blob,
and that `git status --short` is clean. **Then check the commit itself, two ways
— neither replaces the other.**
**(1) Its full path set** (`git show --stat HEAD`) contains **only** the
`_index.md` of the originals this host's `follow-up-of` names: nothing under the
archived follow-up host — that would be a third host-mutating commit, which the
two-checkpoint lifecycle does not allow — and nothing else at all.
**(2) Its patch per original** (`git show HEAD -- {that path}`) carries **that
row's own transition** — the `in-progress` line removed, the `completed` line
added — and **no Checkpoint Log change**: this flip enters *neither* ledger, so
a Checkpoint Log row appearing in a parent is a violation even when the flip
itself is correct.
Why both: the blob proves the final state, not who wrote it — a commit that
merely edits other text in parent A while flipping parent B leaves both blobs
reading `completed` with the flips split across two commits — and the patch in
(2) is **path-filtered**, so it cannot see what else the commit touched. Only
(1) can. The commit message references the
follow-up host's SPEC-ID. Where there are several originals, flip them **in one
commit** — for a minimal follow-up host that keeps this the single post-closeout
tracking commit named in `modify-existing-flow.md` Step 1.6's minimal variant.

After the update:
> "Follow-up Tracking row updated to Status = `completed` in
> `{原 SPEC-ID}-{原 slug}/_index.md` (and every other original listed).
> Closeout complete."

The connection is bidirectional and weakly redundant: the new feature's
`follow-up-of` field is the authoritative source; the old feature's
Follow-up Tracking row is a derived index. If they ever disagree, trust
`follow-up-of`.
