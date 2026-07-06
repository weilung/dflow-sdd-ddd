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
  gate** (Steps 1–4: validation, status flip, BC sync, archive + an optional
  commit checkpoint — all doable with no network) and an **Integration / PR
  gate** (Step 5: push / merge / PR — needs network; the AI only runs
  `git push` / `gh pr create` when you explicitly ask).
- At the archive checkpoint the AI may offer to commit using your Git identity;
  you can always decline. The commit marker mode is read from `_conventions.md`
  § AI Commit Policy. This replaces Dflow's earlier "the AI never commits"
  stance — the AI helps at natural checkpoints, you keep the final say.
- The BC-layer sync in Step 3 **reuses the existing Step 5.3 mechanism**
  from `new-feature-flow` (Step 8.3) and `modify-existing-flow` (Step
  5.3) — it does not introduce a new sync flow. Treat it as "lift Step
  5.3 / 8.3 out of the per-phase checklist and run it once at feature
  closeout, with the `_index.md` Current BR Snapshot as input."

**Step Gates** in this flow (stop-and-confirm before proceeding):
- Step 1 → Step 2 (validation passed → flip status)
- Step 3 → Step 4 (BC sync done → archive)
- Step 5 → Step 6 (Integration Summary emitted → optional follow-up reverse-link)

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

- [ ] Locate the feature directory at `dflow/specs/features/active/{SPEC-ID}-{slug}/`
- [ ] `_index.md` exists and parses (YAML front matter intact, seven required
      sections present, including the Checkpoint Log)
- [ ] Every row in `_index.md` Phase Specs table has Status = `completed`
- [ ] Every phase-spec file referenced in the Phase Specs table exists at
      the path the table claims
- [ ] Every phase-spec file's frontmatter has `status: completed`
- [ ] Every Tier = T2 row in `_index.md` Lightweight Changes references an
      existing `lightweight-*.md` / `BUG-*.md` file in the feature directory
- [ ] Every such lightweight / BUG spec file's frontmatter has
      `status: completed`
- [ ] `_index.md` has no obvious open items in Resume Pointer (e.g. "phase-N
      drafting" / "implementation pending" / "TODO" markers)
- [ ] Current BR Snapshot table is non-empty (or feature is intentionally
      a no-BR feature — confirm with developer if uncertain)

If any check fails:
> "Cannot finish feature `{SPEC-ID}-{slug}` yet — {N} validation issues
> found:
>   ✗ phase-spec-2026-04-15-foo.md status is still `in-progress`
>   ✗ Phase Specs table row 3 references missing file phase-spec-...
>   ✗ lightweight-2026-06-20-rounding.md frontmatter status is still `in-progress`
>
> Address these (run `/dflow:new-phase` to add missing work, or fix the
> stale status manually), then re-run `/dflow:finish-feature`."

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
branch: feature/{SPEC-ID}-{slug}
---
```

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

This step **reuses the existing sync mechanism** from `new-feature-flow`
Step 8.3 / `modify-existing-flow` Step 5.3 (`dflow/specs/domain/{context}/rules.md`
+ `behavior.md` + `events.md` + `context-map.md` updates). The input is
the feature's `_index.md` Current BR Snapshot table; the output is the
BC's `rules.md` / `behavior.md` updated to reflect the feature's net
effect.

Before syncing, ensure required BC files exist. If missing, create from templates:
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`
- `dflow/specs/domain/{context}/events.md` → `templates/events.md`

For each row in Current BR Snapshot where Status = `active`:

- If the BR-ID is **not yet in `rules.md`** → add it (new ADDED rule
  introduced by this feature)
- If the BR-ID is **already in `rules.md`** but the rule text differs →
  update it (MODIFIED rule, reflect the new text)
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
- Add any new Domain Events introduced by phase-specs in this feature
- Remove events that were REMOVED across the feature's net delta
- Update producers / consumers if Aggregate ownership shifted

For `context-map.md`:
- Update if any cross-context interaction was added, changed, or removed
  across the feature

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
2. **Stage the whole archived feature directory:**

   ```bash
   git add dflow/specs/features/completed/{SPEC-ID}-{slug}
   ```

   This is required, not optional: `git mv` stages the rename with the
   **last-committed** content, so working-tree edits made earlier in this
   flow to the moved files — the Step 2 status flip and Resume Pointer
   update, plus the checkpoint row you just wrote — stay **unstaged** until
   this `git add`. In `git status`, the moved `_index.md` showing `RM`
   instead of plain `R` is exactly this signal. Then also `git add` the
   files updated in Step 3 (the updated `rules.md`, `behavior.md`,
   `events.md`, `context-map.md`, `glossary.md`,
   `architecture/tech-debt.md`, etc.) into the same stage.
3. **Commit (Y) or stop (N).** For Y the AI commits. If a pre-commit hook
   rejects it or the commit fails, flip the checkpoint row to `failed` (the
   row is not committed yet — edit it directly), surface the error, and
   treat the gate as unsatisfied.

**Post-commit closeout verification** — after a successful commit, and before
declaring the Local-closeout gate satisfied, AI runs and reports `✓` / `✗` for
every item:

- [ ] `git show HEAD:dflow/specs/features/completed/{SPEC-ID}-{slug}/_index.md`
      — one blob read verifying **two** things: frontmatter `status: completed`
      **and** the Checkpoint Log contains the closeout row. This reads the
      **committed** content, not the working tree — the former catches "rename
      carried stale content", the latter catches "row never made it into the
      commit".
- [ ] `dflow/specs/features/active/{SPEC-ID}-{slug}/` no longer exists (the
      directory was moved, not copied)
- [ ] `git status --short` shows no leftovers related to this feature
      (working tree clean; identify any unrelated dirty files explicitly)

If any item fails, do **not** declare closeout complete — fix it (re-add and
amend, or a follow-up commit; the developer chooses) and re-verify.

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

Produce a plain-text summary of what this feature did. The summary is
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

Print the summary to the conversation; do not write it to a file (it is
ephemeral closeout output).

**→ Step Gate: Step 5 → Step 6**

If the feature has `follow-up-of: {原 SPEC-ID}` in its Metadata, prompt
the developer:
> "This feature is a follow-up of `{原 SPEC-ID}`. Ready to update the
> original feature's `_index.md` Follow-up Tracking row to mark this
> follow-up as `completed`? `/dflow:next` to proceed (or skip if you
> prefer to do it manually)."

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
feature, update the original feature's
Follow-up Tracking table.

1. Locate `dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
2. Find the Follow-up Tracking section's row for this feature's SPEC-ID
3. Flip Status → `completed`

```bash
# The AI makes the edit and may offer to commit it (Y / N), per the AI commit policy
```

After the update:
> "Follow-up Tracking row in `{原 SPEC-ID}-{原 slug}/_index.md` updated
> to Status = `completed`. Closeout complete."

The connection is bidirectional and weakly redundant: the new feature's
`follow-up-of` field is the authoritative source; the old feature's
Follow-up Tracking row is a derived index. If they ever disagree, trust
`follow-up-of`.
