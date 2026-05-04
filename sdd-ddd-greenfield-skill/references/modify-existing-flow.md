# Modify Existing Feature Workflow — ASP.NET Core

Step-by-step guide for changing or fixing existing functionality.

Triggered by `/dflow:modify-existing` or `/dflow:bug-fix` (or natural language implying a modification task — see SKILL.md § Workflow Transparency for the auto-trigger safety net).

**Phase Gates** in this flow (stop-and-confirm before proceeding):
- Step 2 → Step 3 (baseline captured → assess DDD impact)
- Step 3 → Step 4 (DDD impact decision → implement)
- Step 4 → Step 5 (implementation done → update documentation)

All other step transitions are **step-internal**: announce "Step N complete, entering Step N+1" and proceed without waiting. See SKILL.md § Workflow Transparency for the full transparency protocol and confirmation signals.

**Note on step count**: Core version has 5 steps (WebForms has 6) because Clean Architecture's layered structure already separates concerns — there's no "extract from Code-Behind" step to perform.

**Ceremony adjustment when triggered by `/dflow:bug-fix`**: treat as lightweight — use the Lightweight Spec Template (see `templates/lightweight-spec.md`) instead of the full spec, and Step 3 may default to "no DDD impact, fix in place" unless the bug itself is in Domain logic. T2 still generates a concise `Implementation Tasks` checklist (see Step 3).

## Step 1: Assess the Change — Ceremony Tier + Feature Linkage + Layer

Before producing any spec prose, read `dflow/specs/shared/_conventions.md`
and apply the `## Prose Language` setting. If the setting is missing or not
an explicit language tag, ask the developer to update `_conventions.md`
before continuing. This requirement also applies when this flow is entered
through `/dflow:bug-fix`.

This step has three parallel concerns:

**Part A — Determine the Ceremony Tier (T1 / T2 / T3)**

Dflow runs three ceremony tiers (full table in SKILL.md § Ceremony Scaling).
For a modification, AI judges which tier fits before deciding what to
produce:

| Tier | When to choose | Production |
|---|---|---|
| **T1 Heavy** | Architectural change / new BR / new Aggregate or VO / new Domain Event / new data structure → escalate to `/dflow:new-phase` (if extending an active feature) or `/dflow:new-feature` (if it's truly a new concern) | Full phase-spec via the appropriate flow |
| **T2 Light** | Bug fix / UI input validation tweak / flow branch change — **has BR Delta** but no Aggregate / data-structure overhaul | Independent `lightweight-{date}-{slug}.md` placed in feature directory + outbound-link row in `_index.md` Lightweight Changes |
| **T3 Trivial** | Button colour / copy fix / typo / formatting / pure comments — **all four T3 criteria** must hold (no BR change, no Domain concept change, no data structure change, only UI surface / comments / formatting) | **Inline row in `_index.md` Lightweight Changes only** (no independent spec file) |

If any T3 criterion fails → drop to T2. If Domain / BR / data structure
is touched → escalate to T1.

**Below T3** (pure typo, formatting commit) → tell the developer Dflow
doesn't track this and they can `git commit` directly.

**Part B — Locate the Feature this Change Belongs To**

Walk through these in order:

1. **Active features**: scan `dflow/specs/features/active/*/_index.md`. Does
   the change belong inside an existing active feature directory? If
   yes, use that as the host (T1 → `/dflow:new-phase`; T2 → place
   lightweight-spec inside; T3 → inline row in that `_index.md`).
2. **Completed features**: scan `dflow/specs/features/completed/*/_index.md`
   Goals & Scope sections. If the change description is semantically
   related to a completed feature, this becomes the **completed feature
   reopen** scenario — go to Step 1.5 below.
3. **Standalone**: if no related feature exists (active or completed),
   this is a new concern. For T1, use `/dflow:new-feature`. For T2 / T3
   on a standalone bug, see Step 1.5 — `/dflow:bug-fix` will create a
   minimal feature directory to host the lightweight-spec.

> **Why scan completed too?** Decision 17 in PROPOSAL-009: completed
> features are frozen history and **cannot accept** any T2 / T3 directly
> (would break the "completed = frozen" semantic). Reopen routes through
> a new follow-up feature instead — see Step 1.5.

**Part C — Identify the Affected Layer (Clean Architecture)**

This still matters for picking the right fix location:
- Domain invariant broken → Domain fix
- Application orchestration issue → Application fix
- Infrastructure bug (DB, external service) → Infrastructure fix
- API contract change → Presentation fix (becomes T1 if behaviour changes)

**→ Transition (step-internal)**: Step 1 complete. Announce "Step 1 complete (tier {T1/T2/T3} decided, host feature {SPEC-ID-slug / new / follow-up} identified, layer {Domain/Application/Infrastructure/Presentation}). Entering Step 1.5 / Step 2 as appropriate." and continue.

## Step 1.5: Completed-Feature Reopen Detection (only if Step 1 found a related completed feature)

If Step 1 Part B identified a semantically related completed feature, AI
must explicitly disambiguate the user's intent **before** writing any
files:

```
"I notice this change overlaps with completed feature
`{SPEC-ID}-{slug}` (Goals & Scope: '{first 1-2 sentences}', completed on
{date}).

Is this a follow-up to that feature, or an independent new concern?

Option A — follow-up of `{SPEC-ID}-{slug}`
  → Build a new feature with a fresh SPEC-ID and `follow-up-of:
    {SPEC-ID}` link back to the original. Inherits BR Snapshot baseline
    from the BC's rules.md.
Option B — independent new requirement
  → Run /dflow:new-feature normally; no link to the completed feature.
Option C — actually I think it's just a tiny lightweight tweak, no
            new feature needed
  → Refused. Completed features are frozen — even T3 inline rows must
    live in a new follow-up feature directory. (You can still pick A
    and have the new feature contain only one T3 row in _index.md if
    that fits the change.)"
```

**Wait for the developer's explicit choice (A / B / C).**

If A (follow-up): proceed to **Step 1.6: Create Follow-up Feature**.
If B (independent): tell the developer to `/dflow:new-feature`; this
flow ends.
If C: gently re-explain (per decision 17) that completed features
cannot accept direct T2 / T3 writes; offer Option A (follow-up with
just a T3 inline row) as the lightweight equivalent.

## Step 1.6: Create Follow-up Feature (only if user picked Option A)

Build the follow-up feature using the same machinery as
`/dflow:new-feature` (see `new-feature-flow.md` Steps 3.5 and 4), with
these follow-up-specific differences:

- **New SPEC-ID** (today's date sequence — do NOT reuse the original
  SPEC-ID): e.g. original `SPEC-20260201-003-訂單折扣` → follow-up
  `SPEC-20260424-002-訂單折扣-匯率擴充` (or any new slug)
- **New slug**: not required to equal the original slug; pick whatever
  best describes the follow-up scope
- **`_index.md` Metadata**: `follow-up-of: {原 SPEC-ID}` is REQUIRED
  (uncomment the optional line in the template; can be a YAML array if
  the follow-up spans multiple originals)
- **`_index.md` Goals & Scope** auto-prepended note:
  ```
  > 本 feature 為 `{原 SPEC-ID}-{原 slug}` 的 follow-up，原 feature
  > 完成於 `{date}`，詳見 `completed/{原 SPEC-ID}-{原 slug}/_index.md`。
  ```
- **`_index.md` Current BR Snapshot baseline**: AI reads the BC's
  `dflow/specs/domain/{context}/rules.md` and inherits the BRs that are
  in-scope for this follow-up. Mark each inherited row with First Seen
  = `inherited from rules.md` and Last Updated = (empty until the new
  feature's first phase Delta touches it)

**Reverse-link into the old `_index.md`**: AI also updates
`dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md` —
uncomment the Follow-up Tracking section (if not already present) and
add a row:

```
| {新 SPEC-ID} | {新 slug} | {today} | in-progress |
```

This update is **part of the same change set** (the developer commits
both at once; commit message should mention "Add follow-up reference to
`{新 SPEC-ID}`"). The reverse link is a derived index — the new
feature's `follow-up-of` field is the authoritative source.

After the follow-up feature is set up, this flow hands off to the
`/dflow:new-phase` flow (or stays in this flow at Step 2 for the first
phase's content).

## Step 2: Check Documentation

## Step 2: Check Documentation

- Spec in `dflow/specs/features/completed/`?
- Domain model in `dflow/specs/domain/{context}/models.md`?
- Business rules in `rules.md`?
- Domain events in `events.md`?

If no documentation exists, capture current behavior BEFORE changing — use the **Delta** format below.

If baseline domain docs are missing, create them from templates before filling content:
- `dflow/specs/domain/glossary.md` → `templates/glossary.md`
- `dflow/specs/domain/{context}/models.md` → `templates/models.md`
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`
- `dflow/specs/domain/{context}/events.md` → `templates/events.md`
- `dflow/specs/domain/context-map.md` (when cross-context mapping is needed) → `templates/context-map.md`
- `dflow/specs/architecture/tech-debt.md` (if missing) → `templates/tech-debt.md`

### Delta Spec Format (for modifications)

Use ADDED / MODIFIED / REMOVED / RENAMED + an optional UNCHANGED section. Keep Given/When/Then for each rule; the Delta section lives inside the spec and does not accumulate into `dflow/specs/domain/{context}/behavior.md` (git history already covers the trail).

```markdown
## Behavior Delta

### ADDED - BR / behavior added
#### Rule: BR-NN {規則名稱}
Given {Aggregate 初始狀態}
When {呼叫的 Command 或 Aggregate 方法}
Then {新的 Aggregate 狀態}
And {產生的 Domain Event}

### MODIFIED - BR / behavior modified
#### Rule: BR-NN {規則名稱}
**Before**: Given … When … Then {old result} / {old event}
**After**: Given … When … Then {new result} / {new event}
**Reason**: {why this change}

### REMOVED - BR removed
#### Rule: BR-NN {規則名稱}
**Reason**: {why removed}

### RENAMED - BR renamed
#### Rule: {old name} -> {new name}
**Reason**: {why renamed — e.g. terminology evolution / Aggregate split / glossary alignment}

### UNCHANGED - explicitly unaffected (optional)
- BR-003 金額上限
- BR-005 提交後不可修改
```

**Section rules**:
- Use **ADDED / MODIFIED / REMOVED / RENAMED** for every behavioral change; skip a sub-section if it has no entries.
- `MODIFIED` must keep the "原本 / 改為" pair so reviewers see the before/after without guessing.
- `RENAMED` is only about naming (e.g., 「簽核」→「審批」、「Order → CustomerOrder」). If the behavior also changed, split into RENAMED + MODIFIED entries.
- `UNCHANGED` is **recommended but optional**; fill it when regression risk is high or MODIFIED entries are many.
- Always pair with `## Reason for Change` (why this PR exists — ticket / stakeholder ask).
- For Aggregate state transitions and Domain Events, include them in the Given/When/Then — this is how `/dflow:pr-review` Step 0 understands the intent.

**→ Phase Gate: Step 2 → Step 3**

Announce to developer:
> "Baseline captured — existing documentation reviewed, current behavior is documented and the proposed change is marked. Ready to assess the DDD impact (Aggregate design, Domain Events, Value Objects)? `/dflow:next` or reply 'OK' to continue."

Wait for confirmation before entering Step 3.

## Step 3: Assess DDD Impact

### Is the Aggregate design still correct?

Changes that require Aggregate redesign:
- New invariant that spans objects currently in different Aggregates
- Performance issue from too-large Aggregate
- Concurrency conflict from too-large Aggregate
- Business rule that now crosses Aggregate boundary

```
"This change affects [invariant]. Does the current Aggregate
boundary still make sense, or do we need to split/merge?"
```

### Do we need new Domain Events?

If the behavior change means other parts of the system need to react differently:
- Add new events
- Modify event payloads (careful: backward compatibility)
- Add new event handlers

### Are Value Objects still valid?

If constraints change:
- Update Value Object validation
- Check all usages of the Value Object

### Generate Implementation Tasks List

For a phase-spec modification, AI generates a concrete task list and writes it into the spec's `Implementation Tasks` section using `[LAYER]-[NUMBER]：description` (DOMAIN / APP / INFRA / API / TEST).

For a lightweight-spec (T2), AI still generates a concise `Implementation Tasks` checklist instead of skipping task generation.

If the lightweight checklist looks larger than a short-fix checklist, AI must pause and ask the developer whether to keep T2 or upgrade to T1. Do not auto-upgrade based on task count alone.

**→ Phase Gate: Step 3 → Step 4**

Announce to developer:
> "DDD impact analysis done — {Aggregate boundary OK / needs redesign}, {no new events / new events needed}. Ready to implement? `/dflow:next` to proceed, or adjust the design first."

Wait for confirmation before entering Step 4.

## Step 4: Implement

Follow the layer order: Domain → Application → Infrastructure → Presentation.

Even for bug fixes, verify:
- [ ] Fix is in the correct layer
- [ ] Aggregate invariants still hold
- [ ] Domain Events still fire correctly
- [ ] Tests updated to cover the fix
- [ ] No business logic leaked to wrong layer

**→ Phase Gate: Step 4 → Step 5**

Announce to developer:
> "Implementation appears complete. Ready to update documentation (spec, models.md, rules.md, events.md, glossary, tech-debt)? `/dflow:next` to proceed."

Wait for confirmation before entering Step 5. This phase gate is where the completion checklist is triggered — do not skip.

## Step 5: Update Documentation

Triggered by the Step 4 → Step 5 Phase Gate. AI runs the completion checklist in the order below; do **not** skip a section. `Implementation Tasks` checks apply to both `phase-spec.md` and `lightweight-spec.md` (T3 inline-only has no task section).

### 5.1 Verification — AI runs independently

Items marked *(post-5.3)* are re-verified after the documentation merge in 5.3 lands:

- [ ] Every ADDED / MODIFIED / REMOVED / RENAMED entry in the Delta section is covered by implementation or tests
- [ ] The fix is in the correct layer (Domain / Application / Infrastructure / Presentation)
- [ ] Domain layer project has **no** external NuGet dependencies (check `*.Domain.csproj`)
- [ ] Aggregate invariants still hold; state changes go through methods
- [ ] Any new / changed Domain Events are raised in the implementation
- [ ] EF Core configuration uses Fluent API only (no attributes on Domain entities)
- [ ] `Implementation Tasks` section (`phase-spec.md` or `lightweight-spec.md`): all tasks checked, or unchecked items explicitly labelled as follow-up
- [ ] *(post-5.3)* `dflow/specs/domain/{context}/behavior.md` has a section anchor for every `BR-*` in ADDED / MODIFIED entries; REMOVED entries' anchors have been deleted (mechanical input for `/dflow:verify`)
- [ ] *(post-5.3)* `dflow/specs/domain/{context}/behavior.md` `last-updated` is later than this spec's `created` date (mechanical drift guard)

If any item fails, report the gap and pause — don't proceed to 5.2.

### 5.2 Verification — needs developer confirmation

- [ ] Does the fix faithfully express the **intent** of the Delta entries? (AI lists delta → impl location; developer judges fit)
- [ ] Is the Aggregate boundary still correct after this change (especially for MODIFIED / RENAMED entries)?
- [ ] Are Domain Event payloads and handler placements still correct?
- [ ] Did we miss any tech debt worth recording?
- [ ] Do the scenarios merged into `behavior.md` (incl. Aggregate transitions + Events) faithfully express the Delta's final-state behavior? (AI lists updated anchors; developer judges)
- [ ] Should the `Implementation Tasks` section in the spec be collapsed / removed now that it's complete? (team convention — developer decides; applies to both phase-spec and lightweight-spec)

Ask these one-by-one.

### 5.3 Documentation updates

- [ ] Update or create the feature / bug spec; set `status: completed`
- [ ] `dflow/specs/domain/{context}/models.md` — Aggregate structure updates
- [ ] `dflow/specs/domain/{context}/rules.md` — business rule updates
- [ ] `dflow/specs/domain/{context}/events.md` — Domain Event updates
- [ ] `dflow/specs/domain/glossary.md` — new / renamed terms (mirror any RENAMED delta entries here)
- [ ] `dflow/specs/domain/{context}/behavior.md` — update scenarios to reflect Delta result (merge final state, not Delta markup). Sub-steps:
      - Promote any Phase 3 draft sections (from B3 mid-sync) to formal sections
      - Update the corresponding `rules.md` anchor's `last-updated` date (B4)
- [ ] `behavior.md` draft cleanup — if the Delta was abandoned mid-way, keep the `## 提案中變更` section's history or explicitly REMOVE it
- [ ] `dflow/specs/domain/context-map.md` — updated if cross-context interaction changed
- [ ] `dflow/specs/architecture/tech-debt.md` — findings recorded

### 5.4 Archival

If this modification was a **T1 new-phase** within an existing active
feature, archival happens at the *feature* level, not the *phase* level —
do NOT move individual phase-spec files. Instead:

- [ ] Mark this phase-spec's `status` field `completed` in its frontmatter
- [ ] Keep the phase-spec inside its feature directory at
      `dflow/specs/features/active/{SPEC-ID}-{slug}/` (it stays alongside
      sibling phase-specs)
- [ ] When the developer is ready to wrap the whole feature, run
      `/dflow:finish-feature` — that command does the BC-layer sync,
      `git mv`s the **whole feature directory** to `completed/`, and
      emits an Integration Summary

If this modification was a **T2 lightweight** spec, archival is
similarly at the feature level — the lightweight-spec stays in the
feature directory and `_index.md`'s Lightweight Changes row references it. No
file move at this point. The whole feature directory moves to
`completed/` when the developer eventually runs `/dflow:finish-feature`.

If this modification was a **T3 inline-only** change, no spec file
exists — archival is just leaving the row in `_index.md` Lightweight Changes.

If the modification was a **standalone follow-up feature** (created
via Step 1.6), the same rule applies: this flow does not archive the
new follow-up directory; that happens at `/dflow:finish-feature` time.

Only announce "change complete" after the appropriate archival step
above (or the Step 5.3 docs sweep) is done.
