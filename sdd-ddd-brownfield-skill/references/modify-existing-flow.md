# Modify Existing Feature Workflow

Step-by-step guide for when a developer triggers `/dflow:modify-existing` or `/dflow:bug-fix` (or natural language implying a modification task — see SKILL.md § Workflow Transparency for the auto-trigger safety net).

**Phase Gates** in this flow (stop-and-confirm before proceeding):
- Step 2 → Step 3 (baseline captured → analyze code-behind)
- Step 4 → Step 5 (extraction decision → start implementation)
- Step 5 → Step 6 (implementation done → update artifacts)

All other step transitions are **step-internal**: announce "Step N complete, entering Step N+1" and proceed without waiting. See SKILL.md § Workflow Transparency for the full transparency protocol and confirmation signals.

**Ceremony adjustment when triggered by `/dflow:bug-fix`**: treat as lightweight — use the Lightweight Spec Template at the end of this file instead of the full spec, and Step 4 (extraction) may default to "defer and record in tech-debt.md" unless the bug itself is in extractable logic. T2 still generates a concise `Implementation Tasks` checklist (see Step 4).

## Mindset

Modifying existing features is your best opportunity to progressively extract domain knowledge
and business logic. Treat every modification as a chance to:
1. Document what currently exists (if no spec exists yet)
2. Extract business logic from Code-Behind to Domain layer
3. Record tech debt for future migration

## Step 1: Assess the Change — Ceremony Tier + Feature Linkage

Before producing any spec prose, read `dflow/specs/shared/_conventions.md`
and apply the `## Prose Language` setting. If the setting is missing or not
an explicit language tag, ask the developer to update `_conventions.md`
before continuing. This requirement also applies when this flow is entered
through `/dflow:bug-fix`.

This step has two parallel concerns:

**Part A — Determine the Ceremony Tier (T1 / T2 / T3)**

Dflow runs three ceremony tiers (full table in SKILL.md § Ceremony Scaling).
For a modification, AI judges which tier fits before deciding what to
produce:

| Tier | When to choose | Production |
|---|---|---|
| **T1 Heavy** | Architectural change / new BR / new Domain concept / new data structure → escalate to `/dflow:new-phase` (if extending an active feature) or `/dflow:new-feature` (if it's truly a new concern) | Full phase-spec via the appropriate flow |
| **T2 Light** | Bug fix / UI input validation tweak / flow branch change — **has BR Delta** but no Domain or data-structure overhaul | Independent `lightweight-{date}-{slug}.md` placed in feature directory + outbound-link row in `_index.md` Lightweight Changes |
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

**→ Transition (step-internal)**: Step 1 complete. Announce "Step 1 complete (tier {T1/T2/T3} decided, host feature {SPEC-ID-slug / new / follow-up} identified). Entering Step 1.5 / Step 2 as appropriate." and continue.

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

## Step 2: Document Current Behavior (if no spec exists)

## Step 2: Document Current Behavior (if no spec exists)

This is critical. Before changing anything, capture what currently exists:

```
"Before we change this, let me help you document the current behavior.
This way we have a baseline and the change is traceable."
```

Create a spec with status `in-progress` that includes:
- Current behavior description
- Current business rules (extracted from Code-Behind)
- The proposed change clearly marked — use the **Delta** format below

If baseline domain docs are missing, create them from templates before filling content:
- `dflow/specs/domain/glossary.md` → `templates/glossary.md`
- `dflow/specs/domain/{context}/models.md` → `templates/models.md`
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`
- `dflow/specs/migration/tech-debt.md` (if missing) → `templates/tech-debt.md`

### Delta Spec Format (for modifications)

Use ADDED / MODIFIED / REMOVED / RENAMED + an optional UNCHANGED section. Keep Given/When/Then for each rule; the Delta section lives inside the spec and does not accumulate into `dflow/specs/domain/{context}/behavior.md` (git history already covers the trail).

```markdown
## Behavior Delta

### ADDED - BR / behavior added
#### Rule: BR-NN {規則名稱}
Given {狀態}
When {操作}
Then {新的預期結果}

### MODIFIED - BR / behavior modified
#### Rule: BR-NN {規則名稱}
**Before**: Given … When … Then {old result}
**After**: Given … When … Then {new result}
**Reason**: {why this change}

### REMOVED - BR removed
#### Rule: BR-NN {規則名稱}
**Reason**: {why removed}

### RENAMED - BR renamed
#### Rule: {old name} -> {new name}
**Reason**: {why renamed — e.g. terminology evolution / glossary alignment}

### UNCHANGED - explicitly unaffected (optional)
- BR-003 金額上限
- BR-005 提交後不可修改
```

**Section rules**:
- Use **ADDED / MODIFIED / REMOVED / RENAMED** for every behavioral change; skip a sub-section if it has no entries.
- `MODIFIED` must keep the "原本 / 改為" pair so reviewers see the before/after without guessing.
- `RENAMED` is only about naming (e.g., 「簽核」→「審批」). If the behavior also changed, split into RENAMED + MODIFIED entries.
- `UNCHANGED` is **recommended but optional**; fill it when regression risk is high or MODIFIED entries are many.
- Always pair with `## Reason for Change` (why this PR exists — ticket / stakeholder ask).

### Systematic Baseline Capture (when no prior spec exists)

When the feature being modified has no existing spec, take the opportunity to do a broader baseline capture — not just the single behavior being changed. Proactively:

1. Read the related Code-Behind files (the page being modified + pages that share logic)
2. Extract all business rules found (if/else conditions, calculations, validations)
3. Identify domain concepts (potential Entities, Value Objects, Services)
4. Check for duplicated logic across pages
5. Record findings in the appropriate domain docs (`models.md`, `rules.md`) and `tech-debt.md`

This is an **opportunistic** strategy — "capture while we're already here." Do not force a full codebase scan; scope it to the modified feature and its immediate neighbors. Share what you find:

```
"Since there's no spec for this feature yet, I took a broader look at
the related Code-Behind. I found:
- 3 business rules in {PageName}.aspx.cs (documented in rules.md)
- Duplicated validation logic shared with {OtherPage}.aspx.cs (recorded in tech-debt.md)
- A potential Money value object hiding in the calculation at line {N}
This gives us a better baseline before we make our change."
```

**→ Phase Gate: Step 2 → Step 3**

Announce to developer:
> "Baseline captured — current behavior is documented and the proposed change is marked. Ready to analyze the Code-Behind to identify business logic and tech debt? `/dflow:next` or reply 'OK' to continue."

Wait for confirmation before entering Step 3.

## Step 3: Analyze the Code-Behind

Read the existing Code-Behind and identify:

### Business Logic to Extract
Look for:
- **Calculations** — anything with math, comparisons, or transformations
- **Validation rules** — any if/else that checks business conditions
- **State transitions** — status changes, approval flows
- **Data transformations** — converting between formats, currencies, units

### Tech Debt to Record
Look for:
- Direct SQL queries in Code-Behind
- Business logic duplicated across multiple pages
- Magic numbers (e.g., `if (status == 3)`)
- Session/ViewState storing business state
- Try/catch blocks swallowing exceptions silently
- String concatenation for SQL (SQL injection risk)

Record each finding in `dflow/specs/migration/tech-debt.md` with:
```markdown
- [ ] {File}:{Line} — {Description} — Severity: {High|Medium|Low}
```

**→ Transition (step-internal)**: Step 3 complete. Announce "Step 3 complete (code-behind analyzed, tech debt recorded). Entering Step 4: Evaluate Extraction Opportunity." and continue.

## Step 4: Evaluate Extraction Opportunity

For the code being modified, ask:

```
"The business logic for [X] is currently in {PageName}.aspx.cs.
Since we're already touching this code, should we extract it to
src/Domain/{Context}/? This would:
- Make it testable
- Make it reusable
- Make it ready for ASP.NET Core migration"
```

Decision framework:
- **Extract now** if: the logic is being significantly modified anyway
- **Extract now** if: the logic is duplicated elsewhere and we need the single source of truth
- **Defer extraction** if: the change is a one-line fix and the surrounding code is too tangled
- **Always record** the extraction opportunity in tech-debt.md even if deferring

### Generate Implementation Tasks List

For a phase-spec modification, AI generates a concrete task list and writes it into the spec's `Implementation Tasks` section using `[LAYER]-[NUMBER]：description` (DOMAIN / PAGE / DATA / TEST).

For a lightweight-spec (T2), AI still generates a concise `Implementation Tasks` checklist instead of skipping task generation.

If the lightweight checklist looks larger than a short-fix checklist, AI must pause and ask the developer whether to keep T2 or upgrade to T1. Do not auto-upgrade based on task count alone.

**→ Phase Gate: Step 4 → Step 5**

Announce to developer:
> "Extraction decision made — {extract now / defer and record}. Ready to start implementation? `/dflow:next` to proceed, or adjust the extraction scope first."

Wait for confirmation before entering Step 5.

## Step 5: Implement the Change

If extracting to Domain layer:

```csharp
// BEFORE (Code-Behind)
protected void Calculate()
{
    decimal amount = decimal.Parse(txtAmount.Text);
    decimal rate = GetExchangeRate(ddlCurrency.SelectedValue);
    decimal result = Math.Round(amount * rate, 0); // JPY has no decimals
    lblResult.Text = result.ToString("N0");
}

// AFTER (Domain layer)
// src/Domain/Expense/ValueObjects/Money.cs
public record Money(decimal Amount, Currency Currency)
{
    public Money ConvertTo(Currency target, ExchangeRate rate)
    {
        var converted = Amount * rate.Rate;
        return new Money(target.Round(converted), target);
    }
}

// Code-Behind becomes thin:
protected void Calculate()
{
    var money = new Money(decimal.Parse(txtAmount.Text), selectedCurrency);
    var rate = _exchangeRateService.GetRate(selectedCurrency, Currency.TWD, reportDate);
    var result = money.ConvertTo(Currency.TWD, rate);
    lblResult.Text = result.Amount.ToString("N0");
}
```

**→ Phase Gate: Step 5 → Step 6**

Announce to developer:
> "Implementation appears complete. Ready to update artifacts (spec, rules.md, models.md, glossary, tech-debt)? `/dflow:next` to proceed."

Wait for confirmation before entering Step 6. This phase gate is where the completion checklist is triggered — do not skip.

## Step 6: Update Artifacts

Triggered by the Step 5 → Step 6 Phase Gate. AI runs the completion checklist in the order below; do **not** skip a section. `Implementation Tasks` checks apply to both `phase-spec.md` and `lightweight-spec.md` (T3 inline-only has no task section).

### 6.1 Verification — AI runs independently

Items marked *(post-6.3)* are re-verified after the documentation merge in 6.3 lands:

- [ ] Every ADDED / MODIFIED / REMOVED / RENAMED entry in the Delta section is covered by implementation or tests
- [ ] Domain layer has **no** `System.Web` references (grep `src/Domain/`)
- [ ] Extracted logic (if Step 4 decided "extract now") lives under `src/Domain/` with pure C# only
- [ ] `Implementation Tasks` section (`phase-spec.md` or `lightweight-spec.md`): all tasks checked, or unchecked items explicitly labelled as follow-up
- [ ] *(post-6.3)* `dflow/specs/domain/{context}/behavior.md` has a section anchor for every `BR-*` in ADDED / MODIFIED entries; REMOVED entries' anchors have been deleted (mechanical input for `/dflow:verify`)
- [ ] *(post-6.3)* `dflow/specs/domain/{context}/behavior.md` `last-updated` is later than this spec's `created` date (mechanical drift guard)

If any item fails, report the gap and pause — don't proceed to 6.2.

### 6.2 Verification — needs developer confirmation

- [ ] Does the fix faithfully express the **intent** of the Delta entries? (AI lists delta → impl location; developer judges fit)
- [ ] Did we miss any tech debt worth recording during the Step 3 analysis pass?
- [ ] If extraction was deferred, is the tech-debt entry in `tech-debt.md` clear enough for a future picker?
- [ ] Do the scenarios merged into `behavior.md` faithfully express the Delta's final-state behavior? (AI lists updated anchors; developer judges)
- [ ] Should the `Implementation Tasks` section in the spec be collapsed / removed now that it's complete? (team convention — developer decides; applies to both phase-spec and lightweight-spec)

Ask these one-by-one.

### 6.3 Documentation updates

- [ ] Update or create the feature / bug spec; set `status: completed`
- [ ] `dflow/specs/domain/{context}/rules.md` — business rules updated
- [ ] `dflow/specs/domain/{context}/models.md` — domain model updated
- [ ] `dflow/specs/domain/glossary.md` — new / renamed terms (mirror any RENAMED delta entries here)
- [ ] `dflow/specs/domain/{context}/behavior.md` — update scenarios to reflect Delta result (merge final state, not Delta markup). Sub-steps:
      - Promote any Phase 3 draft sections (from B3 mid-sync) to formal sections
      - Update the corresponding `rules.md` anchor's `last-updated` date (B4)
- [ ] `behavior.md` draft cleanup — if the Delta was abandoned mid-way, keep the `## 提案中變更` section's history or explicitly REMOVE it
- [ ] `dflow/specs/migration/tech-debt.md` — findings recorded

### 6.4 Archival

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
above (or the Step 6.3 docs sweep) is done.

## Lightweight Spec Template (for bug fixes)

For small bug fixes, a lightweight spec is enough:

```markdown
---
id: BUG-042
title: Fix rounding inconsistency in expense calculation
status: in-progress
bounded-context: Expense
created: 2025-02-12
---

## Problem
Page A uses Math.Round(amount, 0, MidpointRounding.AwayFromZero) (四捨五入)
Page B uses Math.Floor(amount) (無條件捨去)
They should both use the same rounding rule.

## Expected Behavior
Given an expense amount of 123.5 TWD
When displayed on any page
Then it should show 124 (四捨五入 per accounting standard)

## Root Cause
Duplicated calculation logic — recorded in tech-debt.md

## Fix
Extract rounding to Money.Round() in Domain layer, both pages call it.
```
