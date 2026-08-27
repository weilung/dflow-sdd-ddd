# Finish Feature Workflow — Greenfield Clean Architecture

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
  (Step 5.3) — it does not introduce a new sync flow. Treat it as "lift
  that step out of the per-phase checklist and run it once at feature
  closeout, with the `_index.md` Current BR Snapshot as input."

**Step Gates** in this flow (stop-and-confirm before proceeding):
- Step 1 → Step 2 (validation passed → flip status)
- Step 3 → Step 4 (BC sync done → archive)

**Step 5 → Step 6 is deliberately not a step gate, and when the host carries a
`follow-up-of` field it also stops and waits.** It is this flow's
**post-Local-closeout confirmation**: by the time it is reached the archive has
landed and this feature's cursor reads `none`, so the step-gate protocol —
`/dflow:next` and `/dflow:cancel`, and the cursor update a step gate carries —
does not apply to it. **Step 5 states what it accepts.** Do not treat it as a
step gate because it waits, and do not treat it as step-internal because it is
not a gate.

**Every other step transition is step-internal**: announce "Step N complete,
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
> **Open `references/finish-feature-post-hoc-hotfix.md` and follow it there.**
> What you classify, where the merge-resolution delta may be recorded, and what
> must not be routed mid-closeout are decided there.

**What "Minimal host (zero-phase) only" selects, and what that does not prove.**
A minimal host takes extra checks and extra field rules. Decide it from the
**persisted shape**: an **empty Phase Specs table and no `phase-spec-*` file**
in the host directory. There is no other selector — closeout runs in a fresh
session and cannot know which flow step created the host. So a host that
*carries* a phase is certified as **phase-bearing**, whatever it was intended to
be, and takes the ordinary checks rather than these. This gate does **not**
prove "this host was opened as minimal and stayed that way"; that is a claim
about history, and it belongs with the whole-history assertion already assigned
to `references/pr-review-checklist.md`.

**Open `references/finish-feature-minimal-host.md` and follow it there.** Do
this only when this host is minimal; a **phase-bearing** host does not open it
at all. Its rules live in that file and are not repeated here, and it stays open
for the whole closeout — it adds to this checklist, to Step 3's sync input, to
Step 4's post-commit verification, and to Step 5's Integration Summary fields.

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
      Changes row. An orphan file **blocks** — either it belongs to a phase or
      change whose row is missing, or it belongs to nothing and does not belong
      in the host.
      **One file is legitimately unrowed**: an `aggregate-design.md` worksheet,
      which `AI-AGENT-GUIDE.md` § Ceremony Scaling orders into the feature
      directory for a T1 introducing a new Aggregate / BC. No table names it by
      design — it is a worksheet, not a spec — so it is not an orphan.
- [ ] Every phase-spec file's frontmatter has `status: completed`
- [ ] Every Tier = T2 row in `_index.md` Lightweight Changes references an
      existing `lightweight-*.md` / `BUG-*.md` file in the feature directory
- [ ] Every such lightweight / BUG spec file's frontmatter has
      `status: completed`
- [ ] `_index.md` has no obvious open items in Resume Pointer (e.g. "phase-N
      drafting" / "implementation pending" / "TODO" markers)
- [ ] **You are on this host's branch — or on a branch this host recorded a
      sanctioned override for.** `git rev-parse --abbrev-ref HEAD`
      equals `_index.md`'s `branch:` value — that field is authoritative for the
      whole host — and for a **T2** the lightweight-spec's frontmatter `branch:`
      equals it too. Steps 1–4 run *before* the merge / PR gate, so a mismatch
      means you are closing out somewhere other than where the work was
      finished, and it **blocks**. A hash check does not cover this: any sibling
      branch descended from checkpoint 1 carries the same commits, so every hash
      this host's record names still resolves and is still an ancestor. For a
      **post-hoc** host this compares against the **documentation** branch,
      never `hotfix-branch:`, which names the already-merged hotfix.
      **Before blocking on a mismatch, read the Checkpoint Log for a
      `branch-override` row.** `references/git-integration.md` § Branch gate
      offers "override and stay" as a sanctioned third option and defines that
      row's shape. If **any** such row's Result names the branch `HEAD` is on,
      the mismatch is one this host recorded deliberately and this item
      **passes**. `branch:` itself is still never rewritten — the override is a
      record beside it, not a correction of it.
      ⚠ **The row must name *this* branch** — that is the whole test.
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
      passing."*
- [ ] Current BR Snapshot table is non-empty — **or this host's own record
      carries no BR delta**, which is what makes an empty one legitimate.
      That condition is the check; the shapes below are illustrations of it,
      not the list of them: a **T3** host; a **no-BR family T2** whose Behavior
      Delta is a `BR:` / `BR Delta:` none line; a **phase-bearing** host —
      **including a T1** — whose phase-specs establish no BR delta, which the
      cascade explicitly allows; or a shape added later that likewise carries
      none. Decide from the artifact, not from a declaration:
      "the feature is intentionally no-BR" is a claim, and the record is what
      settles it. A classic BR-delta spec carrying ADDED / MODIFIED / RENAMED
      entries **and** an empty Snapshot means finalization never refreshed it
      (`modify-existing-flow.md` Step 1.7) and **blocks**.

If any check fails:
> "Cannot finish feature `{SPEC-ID}-{slug}` yet — {N} validation issues
> found:
>   ✗ phase-spec-2026-04-15-foo.md status is still `in-progress`
>   ✗ Phase Specs table row 3 references missing file phase-spec-...
>   ✗ lightweight-2026-06-20-rounding.md frontmatter status is still `in-progress`
>
> Address these (run `/dflow:new-phase` to add missing work, or fix the
> stale status manually), then re-run `/dflow:finish-feature`."

**Once every item above — and every item this host's branch file added — reads
`✓`, record the baseline the post-commit check compares against.** For **every
file in the host directory** — not only the
`_index.md` and the spec files the tables name — run
`git hash-object -w {path}` and state the resulting `path → blob` list in the
conversation. **That list is the baseline** — Step 4's post-commit verification
compares each committed blob against it, **over the same span**.
⚠ **The `-w` is mandatory.** It writes each blob into the object database, so
Step 4 can read the baseline's **content** back; without it the recorded list is
fingerprints only, and Step 4's comparison cannot run.
The check has no other durable baseline: "the tree Step 1 read" otherwise lives
only in this session's working memory, and **`HEAD^` is not a substitute** — at
this point the working tree legitimately carries uncommitted finalization edits
and this change's documentation-sweep deltas, so comparing against the parent
commit reports every one of them as a difference no step ordered.

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
`bugfix/BUG-{NUMBER}-{slug}` value, a **non-bug** standalone / follow-up host
keeps its `feature/{SPEC-ID}-{slug}` value. The branch follows the **change
class**, not how the host was opened — a functional-bug standalone or
follow-up host **is** a bugfix host and keeps `bugfix/BUG-*` (the branch-by-class
rule at `modify-existing-flow.md` Step 1.7 step 4). Overwriting it to
`feature/...` at closeout would break branch equality for a bugfix host.

Also update the **Resume Pointer** — to the state closeout is actually in, which
is **not** the terminal state. **Step 4 writes the terminal value**, immediately
after the `git mv`:

```
**Current Progress**: status flipped to `completed` ({date}); closeout in progress.
**Next Action**: continue closeout — sync the BR Snapshot to the BC layer (Step 3).
**Active Workflow**: finish-feature
**Current Step**: Step 3 — sync BR Snapshot to BC layer
**Gates Passed**: 1→2
**Awaiting**: none (mid-step)
```

⚠ **`Awaiting` is `none (mid-step)`, never `gate 3→4`.** Step 3 has not run at
this point, and a cursor that says otherwise sends the next session to
`/dflow:next`, **skipping the BC sync**. `none (mid-step)` is the existing
convention for this position.

**→ Transition (step-internal)**: Step 2 complete. Announce "Step 2 complete (status flipped). Entering Step 3: Sync BR Snapshot to BC layer." and continue.

## Step 3: Sync `_index.md` Current BR Snapshot to BC Layer

**First, branch on what this host actually carries** — "zero-phase" (no
phase-spec) is independent of whether a bounded context exists, so a minimal
host may still touch a real BC, or none at all:

- **(i) BC-bearing** — the host touched a real bounded context, **whether or
  not it carries a BR delta** (BC presence and BR presence are independent). Run
  the sync below **for the documents this host actually changed**: a BR delta
  updates `rules.md` / `behavior.md`; a no-BR family that touched, say, an event
  field updates `events.md`. Fill the Integration Summary's BC field with the
  context, and its BR-IDs with whatever applies — a real set, the per-family
  no-BR marker, or empty. Do **not** skip, and do **not** manufacture a BR delta
  a no-BR host does not have.
  **`Aggregates affected:` and `Domain Events Changes:` take what this host
  actually changed — and `none` for those it did not.** ⚠ **Every BC-bearing
  host, not only a zero-phase one.** An unchanged field is reported `none`, never
  left blank: a blank cannot be told apart from a field nobody filled in, and the
  reader of this summary has no other source for the difference. The same shape
  for a zero-phase host, and the authority on that host's *whole* field set, is
  `references/finish-feature-minimal-host.md` § Step 5. This sentence is the
  half that was only ever written there.
- **(ii) no-BC** — the host touched **no** bounded context at all (a display
  T3, an appearance sweep). **Skip this sync entirely** — do **not** create
  `rules.md` / `behavior.md` / `events.md`, and do not invent a BC to sync into.
  Its Integration Summary sets the fields that **report a sync** to `none` —
  `BC`, `Aggregates affected`, `Domain Events Changes`. **`Related BR-IDs` is
  not one of those**: it reports what this change's own record carries, so it
  stays empty or keeps the per-family no-BR marker. Step 5's "exact fields"
  block is the authority on the shape; do not flatten it to "all BR fields are
  none" here.

For a **BC-bearing** host, continue with the sync. This step **reuses the
existing sync mechanism** from `new-feature-flow`
Step 8.3 / `modify-existing-flow` Step 5.3 (`dflow/specs/domain/{context}/rules.md`
+ `behavior.md` + `events.md` + `context-map.md` updates). The input is
the feature's `_index.md` Current BR Snapshot table; the output is the
BC's `rules.md` / `behavior.md` updated to reflect the feature's net
effect.

**Minimal host — sync input.** A minimal host reads "phase-spec" differently
here, and a phase-bearing host must not apply that reading. The rule is
`references/finish-feature-minimal-host.md` § Step 3.

**Every host — lightweight-spec deltas are a sync input too.** A host of **any**
shape may carry hosted Lightweight Changes rows: Step 1's two `Tier = T2` checks
carry no host-shape restriction, so they reach a phase-bearing host as well. So
a phase-bearing host can hold a hosted T2 whose delta belongs in
this sync, and **the steps below name phase-specs only**. Read them as *this
feature's phase-specs **and** its hosted lightweight-specs' recorded deltas*.
⚠ **Where this bites hardest is a no-BR family**, because the BR-driven sections
below cannot reach it at all: with no BR-ID there is no Current BR Snapshot row
to iterate, so a hosted T2 that changed only an event field or a documented
behaviour is visible **solely** in its own recorded delta. Miss it and
`events.md` / `behavior.md` silently lose a change that a phase-bearing closeout
had no other instruction to look for.

Before syncing, ensure the BC files **this sync actually writes** exist; create a
missing one from its template **only when this host's delta writes to it**. Case
(i) above syncs "the documents this host actually changed", so a document this
host does not touch is **not** created — a BC-bearing **T3**, or a no-BR family
that touched only one of them, leaves the others absent, exactly as case (ii)
does for a no-BC host. Creating one anyway plants the same fiction the no-BC
guard refuses:
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`
- `dflow/specs/domain/{context}/events.md` → `templates/events.md`

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
  matching the BR-ID; the scenario should include Aggregate state
  transitions and Domain Events as appropriate
- For REMOVED BR-IDs, delete the corresponding scenario section from
  `behavior.md`

For `events.md`:
- Add any new Domain Events introduced by this feature — **by its phase-specs
  and by its hosted lightweight-specs alike** (see "Every host — lightweight-spec
  deltas are a sync input too" above; a hosted no-BR T2 appears in neither the
  phase-specs nor the BR Snapshot)
- Remove events that were REMOVED across the feature's net delta
- Update producers / consumers if Aggregate ownership shifted

For `context-map.md`:
- Update if any cross-context interaction was added, changed, or removed
  across the feature

This is the **mechanical input that `/dflow:verify` later uses** for the
rules.md ↔ behavior.md drift check (see `references/drift-verification.md`).

Cross-reference each phase-spec's Delta-from-prior-phases section to
double-check the net result; the Snapshot is the SSOT but the per-phase
Deltas are the audit trail. **Cross-reference each hosted lightweight-spec's
recorded delta the same way** — on any host shape, for the reason above.

> Note: this step does NOT read individual phase-specs to re-derive the BR
> set — that work was already reconciled by `/dflow:new-phase` Step 7 each
> time a phase completed. We trust `_index.md` Current BR Snapshot as the
> feature-level truth here. If the developer finds drift between Snapshot
> and the phase-specs, fix `_index.md` first, then re-run
> `/dflow:finish-feature`.

Also update `architecture/tech-debt.md` / `models.md` / `glossary.md` as
discovered during the feature (the same items listed in
`new-feature-flow.md` Step 8.3) — these may have been touched per phase
already; this is the closeout sweep.

**→ Step Gate: Step 3 → Step 4**

> "BC `{context}` synced — `rules.md` updated ({n_added} added,
> {n_modified} modified, {n_removed} removed), `behavior.md` anchors
> updated, `events.md` reflects {n_events} new / changed events,
> `context-map.md` {updated / unchanged}, `last-updated` set to {date}.
> Ready to archive the feature directory? `/dflow:next` to proceed."

For a **no-BC host** (case ii) the sync was skipped — do **not** announce a
sync that did not happen. Say instead: "No BC-scoped sync was performed (no-BC
host). Ready to archive the feature directory? `/dflow:next` to proceed." Do
**not** say "nothing was written to the Domain layer" — a no-BC host may still
have updated a **global** document (`glossary.md`,
`architecture/tech-debt.md`); those belong to no bounded context and Step 4
must still stage them.

Wait for confirmation before entering Step 4.

## Step 4: Archive — `git mv` the Feature Directory

AI runs:

```bash
git mv dflow/specs/features/active/{SPEC-ID}-{slug} \
       dflow/specs/features/completed/{SPEC-ID}-{slug}
```

`git mv` is mandatory — never use plain `mv` + `git add`. See
`references/git-integration.md` § "Directory Moves Must Use git mv" for
the full rule set.

**Immediately after the `git mv`, write the Resume Pointer's terminal value into
the moved `_index.md`.** Write both prose lines and all four cursor fields —
all six lines of the Resume Pointer — because this write sets each line's final
value:

```
**Current Progress**: feature completed ({date}); all phase-specs status = completed.
**Next Action**: integration — push / merge / PR per the selected Git policy.
**Active Workflow**: none
**Current Step**: n/a
**Gates Passed**: n/a
**Awaiting**: none
```

⚠⚠ **The `git mv` and this write are one uninterruptible pair.** Nothing goes
between them — not the Y / N prompt below, not a question to the developer, not
a tool call that can wait on input, and not the `git status` check below.

⚠ **From here the cursor is terminal and closeout does not edit it again** — not
when the developer declines the commit (N), not when the commit fails, not when
the post-commit verification below reports `✗`. **Do not restore it to an
in-progress value on any of those paths.** What surfaces a closeout that failed
after this point is `git status` — the staged rename plus the uncommitted
`_index.md` edits — not the cursor, which no global scan reads once the host has
left `active/`.

**Now check the rename landed**, with the terminal cursor already written:

```bash
git status --short   # confirm rename detection AND check for `RM` — an `M`
                     # next to a rename means unstaged edits you must re-add
                     # before committing. --short is required: the default long
                     # format lists the rename and the modification separately
                     # and never prints a two-column `RM`.
```

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
   **last-committed** content, so **every** working-tree edit to the moved files
   stays **unstaged** until this `git add` — Step 2's status flip and its
   in-progress cursor, whatever gate 3 → 4 wrote to the cursor, the terminal
   cursor value written just after the `git mv`, and **everything instruction 1
   ordered**: the checkpoint row *and* every hosted `Commit` cell it backfilled.
   Take that last part from instruction 1 itself, not from this sentence — it is
   the step that orders those edits, and a copy kept here would go stale the
   next time it changes. In `git status --short`, the moved `_index.md` showing
   `RM` instead of plain `R` is exactly this signal — the same `--short`
   requirement as the rename check above. Then also `git add`
   **every external document this closeout carries.** That set is defined
   here, once, and it covers **every** host shape — take it from this
   instruction, not from a list kept somewhere else:
   **(a)** whatever Step 3 wrote (`rules.md`, `behavior.md`, `events.md`,
   `models.md`, `context-map.md`, `glossary.md`, `architecture/tech-debt.md`) —
   Step 3 is **skipped entirely for a no-BC host**, so this half is empty there;
   **and**
   **(b)** the **documentation-sweep step of the flow that produced *this
   change*** — take the paths from that step, not from a list kept here. It runs
   *after* that flow's implementation checkpoint and *before* closeout, so **that
   flow** leaves its deltas uncommitted; a later phase's own checkpoints may have
   committed them since, and staging an already-committed path is a no-op.
   Those sweeps reach
   Domain-layer documents under `dflow/specs/domain/`, plus the **global**
   documents `glossary.md` and `architecture/tech-debt.md`, which belong to no
   bounded context and stay legitimate for a **no-BC** host. The two that exist
   today —
   `modify-existing-flow.md` **Step 5.3** and `new-feature-flow.md`
   **§ 8.3 Documentation updates** — are **illustrations, not the definition**:
   a later flow with a sweep of its own is covered without editing this line.
   ⚠ **Key it on the flow that produced the change, never on the flow that
   opened the host.**
   ⚠ **How to tell which flow produced a change: it is determined by the
   artifact, and it is recorded nowhere.** The ledger has no producer column, so
   read it off the shape.
   A **Lightweight Changes row** was produced by `modify-existing-flow.md` **by
   construction** — that is the only flow that writes such a row
   (`/dflow:bug-fix` routes into the same file, and `new-feature-flow.md` creates
   that table empty and never adds to it), so its sweep is **Step 5.3**.
   A **phase-spec** has three possible producers — `/dflow:new-feature`,
   `/dflow:new-phase`, or `modify-existing-flow.md` Step 1.6 / 5.4 routing into
   the new-feature machinery — and **you do not have to tell them apart**:
   § 8.3 and Step 5.3 enumerate the same external paths, and `/dflow:new-phase`
   has no sweep at all, so every branch yields the same set or the empty set.
   ⚠ **`/dflow:new-phase` has no sweep and is deliberately absent here.**
   `new-phase-flow.md` Step 7 updates the phase-spec and this host's own tables,
   and says so in as many words — "The bounded context's `rules.md` /
   `behavior.md` / `events.md` and the feature directory move to `completed/`
   remain `/dflow:finish-feature` responsibilities. **Do not sync BC-level
   current state**". It produces no external delta for this instruction to carry.
   On a **minimal host** that set is exactly what allow-list member (iii) of
   `references/finish-feature-minimal-host.md`'s uncommitted-source check
   admitted. On a **phase-bearing** host there is **no allow-list at all** —
   that check is minimal-host-only and lives in that branch file — so read the
   sweep directly and **do not go looking for a list that host never produced.**
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
      blocks, are judged over exactly that span.
      ⚠ **The span is derived from what was staged, not from what the tables
      name.**
      **The baseline is the `path → blob` list Step 1 recorded** — the tree
      Step 1 read, captured rather than remembered. **Match on the path relative
      to the host directory**: Step 1 recorded them under
      `active/{SPEC-ID}-{slug}/`, this commit carries them under
      `completed/{SPEC-ID}-{slug}/`, and the `git mv` preserved the relative
      tree.
      **Compare the two path sets first, before any blob comparison.** A
      **baseline path missing from the span** is a file removed after Step 1; a
      **span path with no baseline entry** is a file added after Step 1. Each is
      a difference and is judged like any other: it **blocks** unless a step of
      this closeout ordered it.
      Then, for each path the two sets share, take the committed blob with
      `git rev-parse HEAD:{completed path}`. **Different from that path's
      baseline blob → read the delta itself with `git diff {baseline blob}
      HEAD:{completed path}`, and judge that delta against the derived
      condition below. Equal → that path carries no difference at all, which
      satisfies the condition only where no step of this closeout ordered an
      edit to it; where one did, the ordered edit never landed and this
      **blocks**.**
      ⚠ **Blob ids alone answer only *same* / *different*, which cannot decide
      the derived condition.**
      ⚠ **If that list was not recorded, or a baseline blob does not read back
      (`git cat-file -p {baseline blob}` fails), report this check as degraded
      and say so — do not substitute `HEAD^`.**
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
      blob differs from that baseline in **exactly the edits Step 2, Step 4's
      terminal Resume Pointer write and Step 4 instruction 1 ordered, carrying
      the values those steps state, and in nothing else**. Read those three
      steps and compute the set — do not keep a second copy of it here. Any
      difference **no step of this closeout ordered** is edit fallout and
      **blocks**.
      ⚠ **This compares final net state, not the sequence of edits.** Step 2
      writes an in-progress cursor and gate 3 → 4 updates it again; Step 4's
      terminal write then overwrites every field either of them touched, so
      neither appears in the committed blob. **Their absence is not a difference
      and must not block**, and nothing here proves they happened. What this
      comparison settles is that the *terminal* value is the one that landed.
      **What this check cannot decide — stated, not asserted:** whether a
      backfilled hosted `Commit` cell holds *that row's own* implementation hash
      rather than some other commit's. Instruction 1 orders that value and is
      the single place the constraint lives; closeout cannot verify it, because
      the hash-evidence test is minimal-host-only and lives in
      `references/finish-feature-minimal-host.md`, so on a phase-bearing host
      **no check reads the value at all**.
      **Identity is confirmed by `references/pr-review-checklist.md`'s
      "Hosted `Commit` cell identity" item**, which sits in that file's
      *Delegated to review by `finish-feature-flow.md`* block — the same
      assignment this file already makes for the whole-history assertion.
      ⚠ **Not** its "Every Lightweight Changes row now carries a `Commit` hash"
      item: that one asserts **presence, not correctness**, and pointing a
      boundary at a presence check would make it a hole rather than a division
      of labour.
      ⚠ A **hosted** row on a phase-bearing host may legitimately reach closeout
      with an **empty** cell — it is filled by the host's **next** commit, which
      may be a later phase's implementation commit or, when none follows, this
      closeout via instruction 1 (`git-integration.md` § Commit checkpoints). An
      empty cell is therefore not on its own a failure of this check.
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
      **Minimal host (zero-phase) additionally**: one further condition on the
      first checkpoint row, stated in
      `references/finish-feature-minimal-host.md` § Step 4.
- [ ] **The closeout commit contains only what closeout is allowed to write.**
      Read its changed paths (`git show --stat HEAD`) and admit **only** the
      archived host directory — the `git mv` rename plus the finalization
      Step 1 validated — **plus exactly the external paths Step 4 instruction 2
      ordered staged**. That is the same derivation the item above uses, applied
      to the other half of "closeout is clean": the permitted set comes from the
      instruction that ordered the staging, never from a copy kept here.
      **Anything else blocks**: implementation source, or a
      `domain/{context}/…` document under a host that declared itself no-BC.
      ⚠ **That no-BC half applies to every host shape, and on a phase-bearing
      host this is the only place closeout tests it.** The
      `Minimal host (zero-phase), no-BC only` check in
      `references/finish-feature-minimal-host.md` reads checkpoint 1, and a
      phase-bearing host has no checkpoint 1 to read — so do not treat "the
      minimal-host branch file already covers no-BC" as true here. It is true
      only for a minimal host.
      **Scope: this is a path-level spill check and nothing more.** It proves no
      unpermitted *file* entered the commit — not that the permitted ones carry
      only this host's delta. Judging a hunk inside `rules.md` as "this host's
      change rather than an unrelated BR edit" needs the intended delta, which
      lives in the spec and the row, not in a path list. The item that reads one
      against the other is `references/pr-review-checklist.md`'s
      **"The closeout commit carries only this host's delta"**.
      Say that plainly rather than implying the stronger claim.
      ⚠ **And its span is this one commit.** Between them, the minimal-host
      branch file's check (a minimal host's checkpoint 1) and this one (any
      host's closeout commit)
      still leave every *other* commit on the branch unread — where a no-BC host
      is concerned, that gap is closed by
      `references/pr-review-checklist.md`'s **"A no-BC host committed no
      BC-scoped Domain material"** item, which takes the branch range for
      **every** no-BC host.
- [ ] `dflow/specs/features/active/{SPEC-ID}-{slug}/` no longer exists (the
      directory was moved, not copied)
- [ ] `git status --short` shows no leftovers related to this feature
      (working tree clean; identify any unrelated dirty files explicitly)

If any item fails, do **not** declare closeout complete — fix it and re-verify.
**How you may fix it depends on the host.** A **phase-bearing** feature has no
fixed commit count, so re-add and amend *or* a follow-up commit both work; the
developer chooses. A **minimal (zero-phase) host** does not: its lifecycle is
exactly checkpoint 1 plus closeout, and every check its branch file adds rests
on that, so the
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
   Step 2, Step 4's terminal Resume Pointer write, or Step 4 instruction 1. This
   is the set the check *derives* instead of listing, so printing it is what
   lets a reader check the derivation rather than trust it. Say as well that the
   comparison reads final net state, so the transitional cursor values Step 2
   and gate 3 → 4 wrote are outside what it can show.
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
- Aggregates affected: {Aggregate1}, {Aggregate2}
- Phase Count: {N} (phase-spec-{date1}-{slug1} ... phase-spec-{dateN}-{slugN})
- Lightweight Changes: {n_t2} T2 lightweight specs + {n_t3} T3 inline rows

Related BR-IDs (post-closeout state):
- ADDED: BR-NN, BR-NN, ...
- MODIFIED: BR-NN, BR-NN, ...
- REMOVED: BR-NN, BR-NN, ...

Domain Events Changes:
- ADDED: {Event1}, {Event2}
- MODIFIED: {Event3}
- REMOVED: {Event4}

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

**Zero-phase minimal host — exact fields.** A zero-phase host does not fill the
format above the way a phase-bearing one does. Its whole field set, and the
authority on that shape, is `references/finish-feature-minimal-host.md`
§ Step 5.

Print the summary to the conversation; do not write it to a file (it is
ephemeral closeout output).

**A mainline hotfix that overlapped this feature.** Step 4 has already archived
and committed this host — **it is frozen**, so anything a merge with the
mainline leaves over is routed elsewhere and never recorded back into it. What
is left over, how to classify it, and where each class goes are decided in
`references/finish-feature-post-hoc-hotfix.md` § After closeout — the same
branch file Step 1's hotfix callout dispatches to.

**→ Post-Local-closeout confirmation: Step 5 → Step 6**

**This stops and waits, and it is not a step gate.** By now the host is in
`completed/` and its cursor reads `none`. **Confirming here updates no cursor**,
and nothing below re-opens the workflow.

If the feature has `follow-up-of` in its Metadata, prompt the developer —
naming **every** original it lists (the field may be a YAML array):
> "This feature is a follow-up of `{原 SPEC-ID}` (and `{原 SPEC-ID-2}`, …).
> Ready to update **each** original feature's `_index.md` Follow-up Tracking row
> to mark this follow-up as `completed`? (Or tell me you'll do it manually —
> either way this tracking commit is **required** before closeout is complete;
> see Step 6.)"

**What this confirmation accepts** — this governs the follow-up prompt above; a
host with no `follow-up-of` never reaches it and takes the branch below instead:

- **Any affirmative reply → enter Step 6.** The verbal signals the guide lists
  (`AI-AGENT-GUIDE.md` § Confirmation Signals) are illustrations, **not the
  list**: a reply that plainly means "go ahead" counts however it is worded.
  **Implicit confirmation counts too** — a developer who supplies what Step 6
  needs, by naming the originals or by saying they will make the commit
  themselves, has confirmed, not declined.
- **`/dflow:next` and `/dflow:cancel` do not apply here.** No workflow is
  active, and the guide requires both to be refused in that state. Refuse as the
  guide says, **then ask this question again in plain language**. ⚠ **Do not
  read either as a decline** — every earlier gate in this flow asked for
  `/dflow:next`, so typing it here is a trained reflex, not an answer.
- **A request to change something first** — revise what was asked about, then
  ask again. Nothing already committed is undone, and the Local-closeout gate
  stays satisfied.
- **A plain decline, or "not now" — stop, and do not ask again.** There is
  nothing to revise, so re-asking is the same question and reads as pressure.
  Report that closeout is **not complete**, name the Step 6 flip as what is
  still owed, and leave restarting to the developer.

⚠ **Declining does not waive the tracking commit** — Step 6's flip is required
either way. `references/finish-feature-follow-up.md` holds that rule and states
what it takes to satisfy it.

**The reverse link must have been opened, not only closed — and that is not
minimal-host-only.** This confirmation point puts no host shape on
`follow-up-of`, so a phase-bearing host can carry it too, but it has no single
commit required to carry the row. The requirement still holds for that host; nothing in closeout
tests it. **The opening half is confirmed for a phase-bearing follow-up host by
`references/pr-review-checklist.md`'s "A follow-up's reverse link was opened,
not only closed" item**, in that file's *Delegated to review by
`finish-feature-flow.md`* block — it reads the branch history, which is exactly
what closeout cannot take.

If no `follow-up-of` field, skip Step 6 and announce closeout complete:
> "`/dflow:finish-feature` complete for `{SPEC-ID}-{slug}`. Feature
> directory is now at `dflow/specs/features/completed/{SPEC-ID}-{slug}/`,
> with the Local-closeout gate satisfied (closeout committed and verified).
> Integration — merge / push / PR — follows the selected Git policy, at
> your discretion."

**In-flight reminder** — after the closeout announcement (with or without
Step 6), run the in-flight overview scan (see `AI-AGENT-GUIDE.md` § Status /
Control Commands) and list any other unfinished features in `active/` and any
in-flight feature / bugfix branches.

## Step 6: Reverse-Update Follow-up Tracking (only if follow-up)

**Open `references/finish-feature-follow-up.md` and follow it there.** This
step's rules live in that file and are not repeated here.
