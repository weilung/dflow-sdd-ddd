# Minimal Host (Zero-Phase) Closeout — Greenfield Clean Architecture

Branch file of `references/finish-feature-flow.md`. It **adds** the checks and
field rules a minimal (zero-phase) host takes; it does not restate or override
anything in that flow.

**You are here when** `references/finish-feature-flow.md` Step 1's minimal-host
selector sent you — it states the condition; this file does not restate it.

**Keep this file for the whole closeout.** It adds to four of that flow's
steps — Step 1, Step 3, Step 4's post-commit verification, and Step 5 — and each
of those places points back here.

## Hash evidence

**Hash evidence** (several checks in this file use this test). A hash recorded in
`_index.md` passes *hash evidence* when all three hold:
- **(a) it is a commit** — `git cat-file -t {hash}` reports `commit`;
- **(b) it is on this branch** — `git merge-base --is-ancestor {hash} HEAD`
  succeeds;
- **(c) its diff carries what the record claims** — the commit's **changed
  paths** include the artifact that row or checkpoint points at; each check
  in this file names which. **Tree presence is not enough**: every commit
  inherits the files an earlier one added, so a commit that only touched the
  implementation would otherwise satisfy (c) for an artifact it never wrote. (a)
  and (b) alone prove only that *some* earlier commit exists on this branch; (c)
  is what ties it to the record.

## Step 1 — additional validation checks

Run these as part of `references/finish-feature-flow.md` Step 1's checklist, in
the order given here, and report `✓` / `✗` for each exactly as that flow says.
A `✗` here stops closeout there, on the same terms.

- [ ] **Minimal host (zero-phase) only** — every row in `_index.md` Lightweight
      Changes has a **non-empty `Commit` cell that passes hash evidence**; for
      (c), the commit carries that row's own work: a **T2**'s
      `lightweight-*.md` / `BUG-*.md` file, or for a **T3** an `_index.md` that
      already carries this row at that hash — Step 1.7 writes every row *before*
      checkpoint 1, which is what makes that provable here. This applies to
      **T2 and T3 rows alike**. Three failures, all blocking — **report the one
      that is true**, because the message is the developer's only clue about what
      to do next: an **empty** cell means that change is not committed yet; a
      cell holding a **placeholder** (`{hash}`, `{pending}`, `（待 commit）` —
      anything `git cat-file -t` cannot resolve) means the cell was **never
      filled in**, which is a different repair and may well have a commit sitting
      there unrecorded; a **resolvable** value that fails (a)–(c) means the hash
      is the wrong one. ⚠ Do not collapse the middle case into the first.
      (`modify-existing-flow.md` Step 1.7 "Finalize + close" is where the
      **cell** gets backfilled once its commit exists.)
      **Deliberately not run on a phase-bearing host.** Those hosts keep
      `references/finish-feature-flow.md` Step 1's two `Tier = T2` checks, which
      never covered a T3 row anyway — a T3 has
      no spec file in Dflow (`references/git-integration.md` § Gate Checks by
      Branch Type).
- [ ] **Minimal host (zero-phase) only** — the Lightweight Changes table has
      **at least one row** (a T2 or T3 row). An empty Phase Specs table **and**
      an empty Lightweight Changes table is an **empty host** → reject closeout.
- [ ] **Minimal host (zero-phase) only** — **every spec file in the host
      directory is named by a row.** The row-driven checks — this file's
      `Commit` cell check and `references/finish-feature-flow.md` Step 1's two
      `Tier = T2` items — walk rows → files, so a spec file that no row names is
      never examined by them; this item closes
      the other direction. A `phase-spec-*` always fails (the Phase Specs table
      is empty by definition); a `lightweight-*.md` / `BUG-*.md` with no
      Tier = T2 row fails the same way. A **T3-only** host carries no spec file
      at all, so any spec file there fails this check.
- [ ] **Minimal host (zero-phase) only** — the Checkpoint Log shows a
      **committed** first checkpoint before this closeout: Checkpoint
      `implementation` with Result `committed ({hash})` (normal) or `reconciled
      ({merged-hotfix-hash})` (hotfix post-hoc). A first checkpoint still
      reading `skipped` or `failed` **blocks** closeout — but they are not the
      same problem. `failed` means the commit was attempted and did not land:
      the work is genuinely uncommitted and has to land. `skipped` means only
      that **the AI's offer was declined** (`references/git-integration.md`
      § Commit Checkpoints), *not* that no commit exists — the developer may
      have made it themselves, which leaves the ledger **incomplete rather than
      final**. Complete it: `modify-existing-flow.md` Step 1.7's "Finalize +
      close" backfills the row to `committed ({hash})` with the developer's real
      hash. Do **not** waive this check for a `skipped` row, and do **not** write
      a hash you have not verified.
- [ ] **Minimal host (zero-phase) only** — **the Checkpoint Log carries exactly
      one row at this point.** A minimal host takes exactly two checkpoints and
      the second is the closeout row `references/finish-feature-flow.md` Step 4
      instruction 1 adds, so before closeout there is exactly one: the first
      checkpoint the preceding item validated. A second pre-closeout
      row — an extra `implementation`, or a leftover from an abandoned attempt —
      means this host did not take the two-commit lifecycle and **blocks**. A
      failed or declined attempt does **not** add a row: both are recorded by
      editing the existing one in place.
      This counts the rows in **this host's own table** — it is not
      the whole-history assertion, which stays with
      `references/pr-review-checklist.md`.
- [ ] **Minimal host (zero-phase) only** — **that first commit is real, and it
      is this host's.** The Checkpoint Log is prose; verify the hash behind it
      against **hash evidence**. Take the hash that stands for checkpoint 1 —
      for a **normal** host the `committed ({hash})` value; for a **hotfix
      post-hoc** host the Lightweight Changes row's `Commit` cell (**not** the
      `reconciled (...)` hash, which names the already-merged hotfix). For (c),
      touching *some* path under
      `dflow/specs/features/active/{SPEC-ID}-{slug}/` is **not enough** — a
      stray host-open commit does that much while the work is still
      uncommitted. Require the tier's artifact **among the commit's changed
      paths** — (c) is what this commit wrote, not what its tree contains: a
      **T2**'s `lightweight-*.md` / `BUG-*.md` spec file, or for a **T3** an
      `_index.md` the commit **changed** *and* which, as committed at that hash,
      already carries this change's Lightweight Changes row — `git show --stat
      {hash}` **and** `git show
      {hash}:dflow/specs/features/active/{SPEC-ID}-{slug}/_index.md`, both, not
      either. Any of (a)–(c) failing **blocks** closeout.
- [ ] **Minimal host (zero-phase) only** — **checkpoint 1 is *one* commit, and
      every row names it.** For a **normal** host the Checkpoint Log's
      `committed ({hash})` and **every** Lightweight Changes row's `Commit` must
      be the **same** hash, and that commit's diff must **touch the
      implementation paths** its lightweight-spec or rows describe. Step 1.7
      requires the artifact to **declare** those paths; an artifact naming none
      leaves nothing to compare against, so a missing declaration **blocks** —
      it never passes vacuously.
      Assert the **equality itself**, not merely that each value passes hash
      evidence on its own: two hashes that each resolve, are each reachable, and
      each contain some named artifact describe a **three**-commit host —
      host+spec at A, implementation at B, closeout at C — which clears every
      other check on this list while breaking the two-commit lifecycle.
      **Exempt — post-hoc hotfix only, and only this much:** the
      `reconciled (...)` checkpoint hash and the row `Commit` cells name
      different commits **by design** (Step 1.8), so do not assert equality
      *between those two*, and do not apply the implementation-path condition to
      this host's own commit — this file's `Minimal host, hotfix post-hoc only`
      check tests the merged hotfix instead.
      **Everything else still holds:** a post-hoc host can be compound too
      (Step 1.7, "minimal means zero-phase, not one-artifact"), so **every** row
      `Commit` must still name the **same single documentation commit**.
- [ ] **Minimal host (zero-phase) only** — **nothing that constitutes the change
      itself is still uncommitted.** This is deliberately not "the host
      directory is clean": **checkpoint 1 carries the change, the closeout
      commit carries the record the flow writes afterwards.** Checkpoint 1 sits
      at `modify-existing-flow.md`'s Step 4 → Step 5 gate and holds the change
      itself — for a **T2** its lightweight-spec plus the implementation source,
      for a **T3** its `_index.md` row plus the implementation source. What the
      flow writes *after* that gate — Step 5's completion checklist and Step
      1.7's "Finalize + close" — is derived record and rides into the closeout
      commit.
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
      whole-history item `references/finish-feature-flow.md` Step 1 assigns to
      `references/pr-review-checklist.md` is **not** it: that one counts commits
      under this host's spec directory, so a re-implementation commit touching
      only source never appears in its output. Review is where the missing
      assertion belongs — a reviewer has the base branch in front of them — but
      do not read the existing item as discharging it.
      **Blocks closeout:** any of the **implementation source** files this
      host's lightweight-spec or rows describe, staged or unstaged in
      `git status --porcelain`; any **untracked** file under
      `dflow/specs/features/active/{SPEC-ID}-{slug}/`; and any tracked file
      dirty beyond the closed list below.
      **May ride into the closeout commit — this list and nothing else:**
      (i) `_index.md`, with its uncommitted delta confined to Lightweight
      Changes `Commit` cells, Checkpoint Log rows, Resume Pointer, and Current
      BR Snapshot;
      (ii) an **already-committed** `lightweight-*.md` / `BUG-*.md`, with its
      uncommitted delta confined to the frontmatter `status:` flip to
      `completed` and — when the developer accepted the offer — the
      `Implementation Tasks` collapse / removal `modify-existing-flow.md`
      Step 5's completion checklist makes once those tasks are done ("applies to
      both phase-spec and lightweight-spec"). On a minimal host that checklist necessarily runs
      *after* checkpoint 1, so this edit is uncommitted here by construction;
      (iii) the Domain-layer documents **this change's Step 5.3 sweep** updates
      — under `dflow/specs/domain/`, plus
      `dflow/specs/architecture/tech-debt.md` — scoped to *this change's*
      delta. A **T3** has no Domain sweep at all (`modify-existing-flow.md`
      Step 5's tier-conditional
      note), so nothing qualifies under (iii) for a T3. A **no-BC** host has no
      *BC-scoped* sweep — a dirty `dflow/specs/domain/{context}/…` or
      `context-map.md` under one is fiction and **blocks** — but the **global**
      documents (`glossary.md`, `architecture/tech-debt.md`) belong to no
      bounded context, stay in its sweep, and therefore still qualify under
      (iii).
      Read each delta (`git diff -- {path}`) — do not infer it from the
      filename. **The list is closed** — if a later change adds another
      finalization field, add it here explicitly; "a host file is dirty" is never
      on its own a reason to pass. (Unrelated work in progress elsewhere is
      fine; say which files you judged unrelated.)
- [ ] **Minimal host (zero-phase), no-BC only** — **the host did not commit a
      bounded context it does not have.** This file's `nothing that constitutes
      the change itself is still uncommitted` check reads the *working
      tree*; this one reads the **committed** side, because a fictitious
      `{context}` invented at Step 2 and committed into checkpoint 1 leaves a
      perfectly clean tree. Inspect checkpoint 1's diff
      (`git show --stat {hash}`, with status — **not path names alone**): for a
      host that declared itself no-BC that commit must **not touch, in any way**
      — add, modify, delete or rename — any `dflow/specs/domain/{context}/…`
      document. A deletion is a BC-layer change like any other, and reading only
      the path list would accept one as if nothing had happened. The documents:
      `rules.md`, `behavior.md`, `events.md`, `models.md` — and no
      `context-map.md`. Any of them **blocks**
      (`modify-existing-flow.md` Step 2's no-BC guard is where this should have
      been caught first).
      **Do not over-reach:** this rejects only Domain documents that commit
      *added or changed* — pre-existing Domain files it never touched are
      irrelevant, and the **global** documents (`glossary.md`,
      `architecture/tech-debt.md`) belong to no bounded context and stay
      legitimate for a no-BC host, exactly as that check's allow-list says.
      **What this check cannot decide — stated, not asserted:** ⚠ **the rule it
      enforces is not minimal-host-only; only this proof is.** *No no-BC host of
      any shape may commit BC-scoped Domain material* — and what this reads is
      **checkpoint 1**, one commit. It is not a branch-range proof: a second
      commit beside checkpoint 1 carrying a `domain/{context}/…` document
      survives it, and a **phase-bearing** no-BC host has no single checkpoint to
      inspect at all, so it never runs this check in the first place. Closeout
      cannot widen it — the range needs a base branch and Dflow deliberately does
      not know yours (the same limit that working-tree check states).
      **The branch-range assertion is confirmed by
      `references/pr-review-checklist.md`'s "A no-BC host committed no BC-scoped
      Domain material" item**, in that file's *Delegated to review by
      `finish-feature-flow.md`* block, which applies to **every** no-BC host.
      Keep this check anyway: it blocks earlier and more cheaply than review.
- [ ] **Minimal host (zero-phase), follow-up only** — **the reverse link was
      opened, not only closed.** Step 1.6 requires the original feature's
      Follow-up Tracking row for this host to be created as `in-progress` and to
      ride checkpoint 1; `references/finish-feature-flow.md` Step 6 flips it to
      `completed` afterwards. Verify the
      opening half here, from committed state: for **every** SPEC-ID this host's
      `follow-up-of` names — it may be a YAML array, so check each one —
      `git show {checkpoint-1-hash}:dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
      must already carry this host's row with Status `in-progress`. A row absent
      there **blocks** closeout: the Step 6 flip would then create it directly as
      `completed`, and the `absent → in-progress → completed` history the
      follow-up contract requires never happened.
      **What this check cannot decide — stated, not asserted:** ⚠ **only this
      *proof* is minimal-host-only.** `references/finish-feature-flow.md`'s
      Step 5 → Step 6 gate carries the requirement itself and names who confirms
      it for a phase-bearing follow-up host; do not read this check's scope as
      the requirement's scope. The evidence is what stops here: that host has no
      single commit required to carry the row, so there is no committed blob for
      this check to read and it never runs there.
- [ ] **Minimal host, hotfix post-hoc only** — the reconciliation record is
      complete, **within a stated boundary**. This check proves **plausibility,
      not identity**: that `{merged-hotfix-hash}` is a credible candidate, and
      that the developer has said on the record which fix it is and how they
      know. Whether it is *the* merged hotfix is **not decidable from inside
      this flow** — the repository holds no independent record of which commit
      that was; only the developer and the issue tracker do. Do not read a pass
      here as identity confirmed. Identity is
      **asserted** at `modify-existing-flow.md` Step 1.8 and **confirmed** by
      `references/pr-review-checklist.md` — the same assignment
      `references/finish-feature-flow.md` Step 1 gives the whole-history
      assertion.
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
> those two).** A standalone or follow-up minimal host closes out with
> an **empty Phase Specs table** — that is valid, not a failure: the "every
> Phase Specs row is completed" check passes vacuously and there is no
> `phase-spec-*` file to look for. A no-BR / T3 host also has an intentionally
> empty Current BR Snapshot — `references/finish-feature-flow.md` Step 1's
> **Current BR Snapshot** check decides that from the host's own record, not
> from a declaration. Do **not**
> manufacture a phase-spec or a BR row to make a check "pass".

## Step 3 — sync input

**Minimal host — sync input.** A minimal host has no phase-spec: read the
"phase-spec" references in `references/finish-feature-flow.md` Step 3's sync
instructions (events "introduced by phase-specs", "each phase-spec's Delta") as
the host's **lightweight-spec** recorded delta
plus its Current BR Snapshot. A no-BR family that changed an event field or a
documented behaviour still syncs `events.md` / `behavior.md` from that
lightweight-spec's delta.
⚠ What is minimal-host-only here is the **input binding** — the instruction to
read "phase-spec" as "lightweight-spec", which a host with no phase-spec needs
and a phase-bearing one must not apply. It is **not** that step's
**Every host — lightweight-spec deltas are a sync input too** paragraph, which
every host shape needs.

## Step 4 — post-commit verification, additionally

Add this to `references/finish-feature-flow.md` Step 4's post-commit
verification, inside its archived-host-directory item:

**Minimal host (zero-phase) additionally**: the **first** checkpoint row
still carries the hash this file's Step 1 checks validated —
`implementation` with `committed ({hash})` or
`reconciled ({merged-hotfix-hash})`.

## Step 5 — Integration Summary, exact fields

**Zero-phase minimal host — exact fields** (these must match the
`references/finish-feature-flow.md` Step 3 branch — do not require a field that
step left empty). A standalone or follow-up
minimal host has `Phase Count: 0`, an empty Phase List, and at least one row in
Lightweight Changes.

- a **no-BC host** (that step's case ii) sets the fields that report a **sync** to
  none — `BC: none`, `Aggregates affected: none`, `Domain Events Changes:
  none` (nothing was synced). **`Related BR-IDs` is not one of them**: it
  reports what this change's own record carries, not what was synced, so it
  takes the same values a BC-bearing host would — **empty**, or the
  **per-family no-BR marker** when the T2 carries one. A T3-only no-BC host has
  neither and leaves it empty.
- a **BC-bearing host** (that step's case i) sets `BC:` to the context and fills
  each Domain field with **what it actually touched**: `Related BR-IDs:` a real
  set, the per-family no-BR marker, or empty for a no-BR host; `Aggregates
  affected:` and `Domain Events Changes:` the ones it changed, or `none` for
  those it did not.

**What is scoped here and what is not.** This block fixes the *whole* field set
for a zero-phase host — `Phase Count: 0`, the empty Phase List, and which fields
each Step 3 branch leaves empty — and that part is genuinely zero-phase-only.
The `none`-for-unchanged rule on the last bullet is **not**: every BC-bearing
host needs it, and it is now stated where every one of them reads it, in
**`references/finish-feature-flow.md` Step 3 case (i)**. The two say the same
thing on purpose; if you change one, change the other.

⚠ **No proof obligation is delegated from this block, and that is not an
omission.** These are field-filling instructions — they order values, they do
not test anything — so there is no evidence duty here for another host shape to
discharge or for review to take over. **N/A, stated rather than left blank**:
elsewhere in this file a scoped check that cannot reach another host shape hands
that shape to `references/pr-review-checklist.md` by name, and a reader who
finds no such hand-off here should not conclude one went missing.
