# New Phase Workflow — ASP.NET Core

Step-by-step guide for when a developer triggers `/dflow:new-phase` —
adding a new phase-spec to an **active** feature directory.

A phase-spec captures one full "Kickoff → Domain → Design → Build → Verify"
cycle. A feature can have N phase-specs over its lifetime; together they
build up the feature in iterations. The `_index.md` dashboard aggregates
their state.

**Distinction from `/dflow:new-feature`**: this command does NOT create a
branch and does NOT create a feature directory. Both must already exist
(produced by the original `/dflow:new-feature` invocation). This command
adds a new phase to an in-progress feature only.

**Phase Gates** in this flow (stop-and-confirm before proceeding):
- Step 3 → Step 4 (phase scope confirmed → write the phase-spec)
- Step 4 → Step 5 (phase-spec drafted → refresh `_index.md`)

All other step transitions are **step-internal**: announce "Step N complete,
entering Step N+1" and proceed without waiting. See SKILL.md § Workflow
Transparency for the full transparency protocol and confirmation signals.

## Step 1: Read Active Feature Context

Before producing any spec prose, read `dflow/specs/shared/_conventions.md`
and apply the `## Prose Language` setting. If the setting is missing or not
an explicit language tag, ask the developer to update `_conventions.md`
before continuing.

AI must locate the target feature and load its current state:

1. **Identify the target feature**
   - If the developer is on a `feature/{SPEC-ID}-{slug}` branch → infer the
     feature directory at `dflow/specs/features/active/{SPEC-ID}-{slug}/`
   - Otherwise → ask the developer which feature this phase is for

2. **Refuse if the feature is in `completed/`**

   `/dflow:new-phase` strictly applies to **active features only**. If the
   target feature directory is found at `dflow/specs/features/completed/...`
   instead of `dflow/specs/features/active/...`, refuse with:

   ```
   "Feature `{SPEC-ID}-{slug}` is in completed/ — completed features are
   frozen history and cannot accept new phases.

   If you need to extend this feature's behavior, run /dflow:modify-existing
   and choose the 'follow-up' branch — that creates a new follow-up feature
   with a fresh SPEC-ID and a `follow-up-of: {SPEC-ID}` link back to this
   one."
   ```

   Do NOT offer to `git mv` the feature back to `active/` — that breaks the
   completed = frozen-history semantic and produces confusing dir-rename
   history. The follow-up path is the only correct route.

3. **Load context for the new phase**
   - Read the feature's `_index.md` — Metadata, Goals & Scope, Phase Specs,
     Current BR Snapshot, Resume Pointer
   - Read the most recent phase-spec to understand where the prior phase
     left off (its Business Rules and Delta-from-prior-phases sections in
     particular)
   - Cross-reference the bounded context's `dflow/specs/domain/{context}/rules.md`
     and `behavior.md` if the new phase is likely to touch system-level
     state (BC-level current state lives there, not in `_index.md`)

Share what you found:

> "OK — `{SPEC-ID}-{slug}` has {N} prior phases in BC `{context}`. The
> most recent (phase-{N}) ended with {一句話 from Resume Pointer}. Current BR
> Snapshot has {count} active BRs. Ready to scope the new phase."

**→ Transition (step-internal)**: Step 1 complete. Announce "Step 1 complete (active feature context loaded). Entering Step 2: Confirm Phase Scope." and continue.

## Step 2: Confirm the Phase Scope

Walk the developer through what the new phase covers:

1. **What does this phase add or change?** Plain-language description.
2. **Which BRs are touched?** Compare against the current BR Snapshot. New
   BRs (ADDED), changed BRs (MODIFIED), removed BRs (REMOVED), renamed
   (RENAMED). Items not mentioned stay UNCHANGED implicitly.
3. **Any Aggregate / Domain concepts introduced or changed?** New
   Aggregates, Value Objects, Domain Events, or invariants?
4. **Cross-context impact?** Does this phase introduce / change Domain
   Events that other contexts consume? (If yes, plan for `context-map.md`
   updates at finish-feature time.)
5. **Data structure impact?** New tables, columns, indices, EF
   configuration changes?
6. **Why now?** Priority — informs sequencing relative to other phases.

This is also the moment to ask: "Should this be its own follow-up feature
instead of a phase here?" — useful when the scope drift suggests a
separate concern (different Aggregate, different BC, etc.).

**→ Transition (step-internal)**: Step 2 complete. Announce "Step 2 complete (phase scope agreed). Entering Step 3: Phase Slug Confirmation." and continue.

## Step 3: Phase Slug Confirmation

AI proposes the new phase-spec filename and asks the developer to confirm
before any file is written.

> "Proposed phase-spec for `{SPEC-ID}-{slug}`:
>
>     phase-spec-{YYYY-MM-DD}-{phase-slug}.md
>
> Phase slug follows our discussion language (中文/英文皆可). Do you want
> to keep `{phase-slug}`, or use a different slug?"

Slug rules (matches the feature-level slug rule):
- Follows the language the developer / AI discuss the phase in (no forced
  translation)
- Keep it short (2–4 words / 2–6 中文字)
- Avoid characters that would break filesystems on the developer's
  platform (slashes, colons, etc.)

Wait for the developer to confirm before proceeding.

**→ Phase Gate: Step 3 → Step 4**

Announce to developer:
> "Phase slug confirmed as `{phase-slug}`. Ready to draft the phase-spec
> (`phase-spec-{date}-{phase-slug}.md`) — I'll cover problem / domain
> modeling / behavior (with Aggregate transitions + Events) / business
> rules / Delta-from-prior-phases / edge cases / layer-by-layer
> implementation plan? `/dflow:next` to proceed, or adjust the scope
> first."

Wait for confirmation before entering Step 4.

## Step 4: Write the Phase Spec

Create the file at:

```
dflow/specs/features/active/{SPEC-ID}-{slug}/phase-spec-{YYYY-MM-DD}-{phase-slug}.md
```

Use the `templates/phase-spec.md` template. Phase-2-onward specs **must**
fill in the **Delta from prior phases** section (the first phase typically
has just "首 phase，無前置 Delta"; this is phase 2+, so the section is
required).

Walk the developer through each section, in the same way `new-feature-flow`
Step 4 does — Behavior (with Aggregate state transitions and Domain
Events) / Business Rules / Delta / Edge Cases / Domain Events / layer-by-
layer implementation plan — but only list NEW or MODIFIED BRs in Business Rules;
UNCHANGED BRs from prior phases stay in the Current BR Snapshot table on
`_index.md` and are NOT re-copied here. The Delta section uses the same
ADDED / MODIFIED / REMOVED / RENAMED + optional UNCHANGED format defined
in `references/modify-existing-flow.md` (Aggregate state transitions and
Domain Events go in the Given/When/Then within each Delta entry).

After the spec body is drafted, generate the `Implementation Tasks` section
(format `[LAYER]-[NUMBER]：description` with Core layer tags
DOMAIN / APP / INFRA / API / TEST — see `new-feature-flow.md` Step 5 for
the detailed list, recommended order: DOMAIN → APP → INFRA → API).

**→ Phase Gate: Step 4 → Step 5**

Announce to developer:
> "Phase-spec drafted at
> `dflow/specs/features/active/{SPEC-ID}-{slug}/phase-spec-{date}-{phase-slug}.md`.
> Ready to refresh `_index.md` (add Phase Specs row, regenerate Current BR
> Snapshot from the Delta)? `/dflow:next` to proceed."

Wait for confirmation before entering Step 5.

## Step 5: Refresh `_index.md`

Update the feature's `_index.md`:

1. **Phase Specs table** — add a new row for this phase:
   ```
   | {N+1} | {YYYY-MM-DD} | {phase-slug} | in-progress | [phase-spec-{date}-{phase-slug}.md](./phase-spec-{date}-{phase-slug}.md) |
   ```

2. **Current BR Snapshot table** — regenerate to reflect the new phase's
   Delta:
   - **ADDED** entries → new rows (First Seen = `phase-{N+1}`, Last Updated =
     `phase-{N+1}`, Status = `active`)
   - **MODIFIED** entries → update Current Rule + bump Last Updated to `phase-{N+1}`
   - **REMOVED** entries → flip Status to `removed`, bump Last Updated to
     `phase-{N+1}` (do NOT delete the row — keep the audit trail)
   - **RENAMED** entries → update BR-ID / Current Rule as appropriate; bump
     Last Updated

3. **Resume Pointer** — update to "phase-{N+1} in progress:
   {one-line about what's actively being worked on}" and "Next Action:
   implement DOMAIN-1 / write Aggregate ... / etc."

The Snapshot is the feature-level CURRENT STATE, not history. Do not let
it grow into a cumulative log; the per-phase Delta sections are the
historical audit trail. The bounded context's `rules.md` / `behavior.md`
remain the system-level current state and are NOT updated here — that
synchronisation happens at `/dflow:finish-feature`.

After the refresh, summarize for the developer:
> "Phase-spec ready, `_index.md` refreshed. Snapshot now shows
> {n_active} active BRs ({n_added} added in this phase, {n_modified}
> modified, {n_removed} removed). Ready to start implementation —
> follow the phase-spec's Implementation Tasks list (DOMAIN → APP → INFRA → API),
> then run `/dflow:finish-feature` when all phases are completed and the
> feature is ready to wrap up."
