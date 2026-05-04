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
- This command **does not auto-merge**. It does not push, does not open a
  PR, does not run the project's merge strategy. Those decisions stay
  with the developer / project's Git principles. (See PROPOSAL-011 for
  Dflow's Git-strategy decoupling stance.)
- The BC-layer sync in Step 3 **reuses the existing Step 8.3 mechanism**
  from `new-feature-flow` — it does not introduce a new sync flow. Treat
  it as "lift Step 8.3 out of the per-phase checklist and run it once at
  feature closeout, with the `_index.md` Current BR Snapshot as input."

**Phase Gates** in this flow (stop-and-confirm before proceeding):
- Step 1 → Step 2 (validation passed → flip status)
- Step 3 → Step 4 (BC sync done → archive)
- Step 5 → Step 6 (Integration Summary emitted → optional follow-up reverse-link)

All other step transitions are **step-internal**: announce "Step N complete,
entering Step N+1" and proceed without waiting. See SKILL.md § Workflow
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
- [ ] `_index.md` exists and parses (YAML front matter intact, six required
      sections present)
- [ ] Every row in `_index.md` Phase Specs table has Status = `completed`
- [ ] Every phase-spec file referenced in the Phase Specs table exists at
      the path the table claims
- [ ] Every phase-spec file's frontmatter has `status: completed`
- [ ] `_index.md` has no obvious open items in Resume Pointer (e.g. "phase-N
      drafting" / "implementation pending" / "TODO" markers)
- [ ] Current BR Snapshot table is non-empty (or feature is intentionally
      a no-BR feature — confirm with developer if uncertain)

If any check fails:
> "Cannot finish feature `{SPEC-ID}-{slug}` yet — {N} validation issues
> found:
>   ✗ phase-spec-2026-04-15-foo.md status is still `in-progress`
>   ✗ Phase Specs table row 3 references missing file phase-spec-...
>
> Address these (run `/dflow:new-phase` to add missing work, or fix the
> stale status manually), then re-run `/dflow:finish-feature`."

**→ Phase Gate: Step 1 → Step 2**

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

Also update the **Resume Pointer** to reflect closeout:

```
**Current Progress**: feature completed ({date}); all phase-specs status = completed.
**Next Action**: merge / push (per project Git-principles).
```

**→ Transition (step-internal)**: Step 2 complete. Announce "Step 2 complete (status flipped). Entering Step 3: Sync BR Snapshot to BC layer." and continue.

## Step 3: Sync `_index.md` Current BR Snapshot to BC Layer

This step **reuses the existing sync mechanism** from `new-feature-flow`
Step 8.3 (`dflow/specs/domain/{context}/rules.md` + `behavior.md` updates). The
input is the feature's `_index.md` Current BR Snapshot table; the output
is the BC's `rules.md` and `behavior.md` updated to reflect the
feature's net effect.

Before syncing, ensure required BC files exist. If missing, create from templates:
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`

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

For `behavior.md`:

- For every BR-ID still active after this feature, ensure
  `dflow/specs/domain/{context}/behavior.md` has a scenario section (anchor)
  matching the BR-ID
- For REMOVED BR-IDs, delete the corresponding scenario section from
  `behavior.md`
- Update the BR-ID anchor's `last-updated` date in `behavior.md` to today

This is the **mechanical input that `/dflow:verify` later uses** for the
rules.md ↔ behavior.md drift check (see `references/drift-verification.md`).

Cross-reference each phase-spec's Delta-from-prior-phases section to
double-check the net result; the Snapshot is the SSOT but the per-phase
Deltas are the audit trail.

> Note: this step does NOT read individual phase-specs to re-derive the BR
> set — that work was already done by `/dflow:new-phase` Step 5 each time
> a phase finalised. We trust `_index.md` Current BR Snapshot as the
> feature-level truth here. If the developer finds drift between Snapshot
> and the phase-specs, fix `_index.md` first, then re-run
> `/dflow:finish-feature`.

Also update `migration/tech-debt.md` / `models.md` / `glossary.md` as
discovered during the feature (the same items listed in
`new-feature-flow.md` Step 8.3) — these may have been touched per phase
already; this is the closeout sweep.

**→ Phase Gate: Step 3 → Step 4**

> "BC `{context}` synced — `rules.md` updated ({n_added} added,
> {n_modified} modified, {n_removed} removed), `behavior.md` anchors
> updated, `last-updated` set to {date}. Ready to archive the feature
> directory? `/dflow:next` to proceed."

Wait for confirmation before entering Step 4.

## Step 4: Archive — `git mv` the Feature Directory

AI runs:

```bash
git mv dflow/specs/features/active/{SPEC-ID}-{slug} \
       dflow/specs/features/completed/{SPEC-ID}-{slug}
git status   # confirm rename detection
```

`git mv` is mandatory — never use plain `mv` + `git add`. This preserves
git's directory rename detection so `git log --follow` / `git blame` /
PR diff quality stays intact across the move. See
`references/git-integration.md` § "Directory Moves Must Use git mv" for
the full rule set.

After the move, also `git add` any modified files from Step 3 (the
updated `rules.md`, `behavior.md`, `glossary.md`, `tech-debt.md`, etc.)
into the same stage. AI **does not commit** — the developer commits in
their own preferred manner (and the project's Git-principles decide
whether one commit or several).

**→ Transition (step-internal)**: Step 4 complete. Announce "Step 4 complete (feature archived to completed/). Entering Step 5: Emit Integration Summary." and continue.

## Step 5: Emit Integration Summary (Git-strategy-neutral)

Produce a plain-text summary of what this feature did. The summary is
**not** a commit message template — it is reference material the
developer adapts to whichever merge strategy their project uses
(merge commit, squash, rebase, fast-forward — Dflow stays neutral).

For projects that adopted the optional PROPOSAL-010 scaffolding, the
applicable `scaffolding/Git-principles-{gitflow|trunk}.md` "Integration
Commit Message Conventions" section explains how to format the actual commit
message from this summary.

Format:

```
== Integration Summary: {SPEC-ID}-{slug} ==

Feature Goal: {1-2 sentences from _index.md Goals & Scope}

Change Scope:
- BC: {context-name}
- Phase Count: {N} (phase-spec-{date1}-{slug1} ... phase-spec-{dateN}-{slugN})
- Lightweight Changes: {n_t2} T2 lightweight specs + {n_t3} T3 inline rows

Related BR-IDs (post-closeout state):
- ADDED: BR-NN, BR-NN, ...
- MODIFIED: BR-NN, BR-NN, ...
- REMOVED: BR-NN, BR-NN, ...

Phase List:
- phase-1 ({date}): {phase-slug} — {1 line}
- phase-2 ({date}): {phase-slug} — {1 line}
- ...

Next Steps (developer):
- Per the project's Git-principles, choose a merge strategy (merge commit /
  squash / rebase / fast-forward) and execute
- Push to remote / open a PR
```

Print the summary to the conversation; do not write it to a file (it is
ephemeral closeout output).

**→ Phase Gate: Step 5 → Step 6**

If the feature has `follow-up-of: {原 SPEC-ID}` in its Metadata, prompt
the developer:
> "This feature is a follow-up of `{原 SPEC-ID}`. Ready to update the
> original feature's `_index.md` Follow-up Tracking row to mark this
> follow-up as `completed`? `/dflow:next` to proceed (or skip if you
> prefer to do it manually)."

If no `follow-up-of` field, skip Step 6 and announce closeout complete:
> "`/dflow:finish-feature` complete for `{SPEC-ID}-{slug}`. Feature
> directory is now at `dflow/specs/features/completed/{SPEC-ID}-{slug}/`.
> Stage is set; commit / merge / push at your discretion."

## Step 6: Reverse-Update Follow-up Tracking (only if follow-up)

For features that were created as follow-ups of an earlier completed
feature (decision 18 in PROPOSAL-009), update the original feature's
Follow-up Tracking table.

1. Locate `dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
2. Find the Follow-up Tracking section's row for this feature's SPEC-ID
3. Flip Status → `completed`

```bash
# AI does the edit; commits stay with the developer
```

After the update:
> "Follow-up Tracking row in `{原 SPEC-ID}-{原 slug}/_index.md` updated
> to Status = `completed`. Closeout complete."

The connection is bidirectional and weakly redundant: the new feature's
`follow-up-of` field is the authoritative source; the old feature's
Follow-up Tracking row is a derived index. If they ever disagree, trust
`follow-up-of`.
