# Dflow AI Agent Guide

This project uses Dflow for spec-first AI-assisted development.

## Project Context

| Field | Value |
|---|---|
| Project | {System Name} |
| Dflow track | {edition} |
| Project type | {project-type} |
| Tech stack | {tech-stack-summary} |
| Migration / legacy context | {migration-context} |
| Prose language | {prose-language} |

## Before Editing Code

Do not jump from a request directly to code. First identify the matching
Dflow workflow and confirm the intended path with the developer.

Use these workflow entry points as plain chat instructions if slash commands
are not available in the current AI tool:

| Workflow | Use when |
|---|---|
| `/dflow:new-feature` | A new user-visible capability or business behavior is requested. |
| `/dflow:modify-existing` | Existing behavior needs to change. |
| `/dflow:bug-fix` | A defect can be described with expected vs actual behavior. |
| `/dflow:new-phase` | An active feature needs another implementation slice. |
| `/dflow:finish-feature` | Implementation is complete and needs drift closure. |
| `/dflow:verify` | A bounded context's domain docs (`rules.md` ↔ `behavior.md`) need a consistency / drift check. |
| `/dflow:pr-review` | A change is ready for SDD/DDD review. |
| `/dflow:report-dflow-feedback` | You found a Dflow issue or improvement and want a sanitized upstream feedback draft. |
| `/dflow:status` | You need the current workflow state, current step, completed work, in-progress work, remaining work, pending decision, and next valid action. |
| `/dflow:next` | An active workflow is waiting at a step gate and the developer confirms continuing to the next step. |
| `/dflow:cancel` | The developer wants to abort the current workflow and return to free conversation without rollback. |

Machine-readable source for rendering tool-specific thin wrappers:

<!-- dflow-command-registry:start -->
| id | label | description | arg-hint | scope |
|---|---|---|---|---|
| new-feature | /dflow:new-feature | Start a new user-visible feature or business behavior. | feature request | workflow |
| modify-existing | /dflow:modify-existing | Change existing behavior. | change request | workflow |
| bug-fix | /dflow:bug-fix | Investigate a defect described by expected vs actual behavior. | expected vs actual | workflow |
| new-phase | /dflow:new-phase | Add another implementation slice to an active feature. | feature id or phase goal | workflow |
| finish-feature | /dflow:finish-feature | Close implementation with drift checks and archived feature state. | feature id | workflow |
| verify | /dflow:verify | Check a bounded context's domain docs (`rules.md` ↔ `behavior.md`) for consistency. | bounded context or all | workflow |
| pr-review | /dflow:pr-review | Review a ready change for SDD/DDD alignment. | change or branch | workflow |
| report-dflow-feedback | /dflow:report-dflow-feedback | Draft sanitized upstream feedback about Dflow. | issue or improvement | workflow |
| status | /dflow:status | Report current workflow state and next valid action. | - | control |
| next | /dflow:next | Confirm the active step gate and continue. | - | control |
| cancel | /dflow:cancel | Abort the active workflow and return to free conversation. | - | control |
<!-- dflow-command-registry:end -->

## Routing Non-Command Input

Not every developer message maps to a `/dflow:*` workflow. Route non-command
input like this (supporting files live in the workflow bundle at
`dflow/specs/shared/dflow-workflows/`):

- **"I'm designing a domain model" / "How should I model X?"** → read
  `references/ddd-modeling-guide.md`.
- **"Quick question about..." / "How does X work?"** → check
  `dflow/specs/domain/` first and answer from the documented domain knowledge.
- **"I'm creating a branch"** → read `references/git-integration.md`.
- **"Dflow seems wrong" / "this template is confusing"** (or you notice Dflow
  guidance drift) → suggest `/dflow:report-dflow-feedback`; never submit
  anything upstream automatically.
- **Anything else code-related** → assess whether it touches business logic. If
  it does, use the auto-trigger safety net (suggest the matching `/dflow:*`
  command and wait for confirmation — see § Workflow Transparency); if not, help
  directly with no ceremony.

## Status / Control Commands

`/dflow:status` reports in two parts.

**Part 1 — in-flight overview (always shown, workflow active or not).**
Aggregate every in-flight feature so unfinished work surfaces without anyone
remembering to look:

- Scan this branch's `dflow/specs/features/active/*/_index.md` and print one
  line per feature: SPEC-ID / Active Workflow / Current Step / Awaiting / last
  Checkpoint Log row (read from each Resume Pointer cursor).
- Cross-branch: run `git fetch` when the network allows (skip gracefully
  offline), then `git branch --all --list '*feature/*' --list '*bugfix/*'`,
  deduplicating local and remote refs of the same branch (prefer local). For
  each branch, classify in order: (1) its feature directory exists in this
  branch's `active/` → already covered above; (2) exists in this branch's
  `completed/` → a stale undeleted branch — list as "completed; branch can be
  deleted", **not** in-flight; (3)
  `git show {branch}:dflow/specs/features/active/{dir}/_index.md` is readable
  → in flight on that branch, print its cursor line (no branch switching);
  (4) the `completed/` path is readable on that branch → closed out there,
  awaiting integration; (5) nothing readable → list the branch as unknown
  state.
- If `features/backlog/` is non-empty, append one count line.
- Inherent limit: work never committed anywhere is invisible to any git scan.

**Part 2 — current feature detail (when a workflow is active).** Read the
Resume Pointer cursor as the **declared** state, then cross-check it against
derived evidence (Checkpoint Log, phase-spec statuses, recent git log). On
mismatch, report both sides explicitly and ask the developer to correct the
cursor — the cursor is a claim; evidence wins. If the cursor fields are absent
(an older `_index.md`), fall back to pure derivation. For readability you may
expand the cursor into a step checklist (done / in progress / not started)
derived live from the flow file — display only, never stored.

Include these fields: workflow, step, completed, in-progress, remaining,
pending decision, and next valid action. If no workflow is active, say so and
list valid flow-entry or standalone commands (Part 1 still shows the
in-flight overview).

`/dflow:next` is valid only at a step gate in an active workflow. Treat it as
developer confirmation equivalent to "OK" or "continue", then move to the next
workflow step.

`/dflow:cancel` aborts the current workflow and returns to free conversation.
Do not rollback changes, delete artifacts, or rewrite specs merely because the
workflow was cancelled. If the feature directory exists, set the Resume
Pointer cursor's Active Workflow to `none` (keep Current Progress as a trace
of where the cancellation happened).

When no workflow is active, `/dflow:next` and `/dflow:cancel` must report that
there is no active workflow to advance or cancel.

## Workflow Transparency

Dflow uses a hybrid interaction design: `/dflow:*` commands are the primary
entry, natural-language auto-trigger is a safety net, and tiered transparency
keeps the developer aware of where they are in a workflow.

### Auto-Trigger Safety Net

When natural language implies a development task, detect the intent — but do
**not** auto-enter a workflow. Instead:

1. State your judgment clearly:
   > "I think this is a new-feature task."
2. Offer the developer three options:
   - Type `/dflow:new-feature` to start explicitly
   - Reply "OK" / "繼續" to confirm this workflow
   - Or correct the workflow (e.g., "no, this is a bug fix")
3. Wait for confirmation before entering any workflow.

This addresses three failure modes of pure auto-trigger: missed triggers, wrong
workflow selection, and invisible state.

### Three-Tier Transparency

During an active workflow, communicate at three levels — no more, no less:

| Level | Trigger point | AI behavior |
|---|---|---|
| **Flow entry (must confirm)** | After judging the workflow from NL | Stop and wait for confirmation (command, "OK", or implicit) |
| **Step gate (notify + optional confirm)** | Before major milestones | Announce the transition; if the developer provides next-step input, treat it as implicit confirmation |
| **Step-internal (notify only)** | Step N → Step N+1 | Announce "Step N complete, entering Step N+1" — do not wait |

The specific step-gate positions for each workflow live in that flow's own file
(`dflow/specs/shared/dflow-workflows/references/<flow>.md`), which is the source
of truth for its gate sequence.

### Confirmation Signals (NL ↔ Command Equivalence)

Any of these count as "proceed to next step" — accept whichever the developer
uses:

- **Command**: `/dflow:next`
- **Verbal (English)**: OK / yes / continue / go ahead / sounds good / proceed
- **Verbal (Chinese)**: 好 / 對 / 繼續 / 可以 / 沒問題
- **Implicit**: the developer provides the information needed for the next step
  (e.g., the AI asks "Which Aggregate?" and the developer answers with the
  Aggregate name → implicit confirmation)

The implicit-confirmation rule matters — do not turn every transition into a
ceremony where the developer must say "OK" before every sentence.

### Completion Checklist Skip Guard

Completion checklists and their step ordering live in the flow files and run at
the gate each flow specifies (the feature-level completion gate in
`new-feature-flow` / `modify-existing-flow`, the phase-level gate in
`new-phase-flow`). Do not run a checklist opportunistically. But if the
developer skips the gate and commits directly, use the auto-trigger safety net
to prompt — "It looks like you're wrapping up — should I run the Step N
completion checklist?" — before giving commit guidance.

## Source of Truth

Dflow-owned project documents live under `dflow/specs/`.

| Area | Path |
|---|---|
| Shared conventions | `dflow/specs/shared/_conventions.md` |
| System overview | `dflow/specs/shared/_overview.md` |
| Domain glossary | `dflow/specs/domain/glossary.md` |
| Context map | `dflow/specs/domain/context-map.md` |
| Active feature specs | `dflow/specs/features/active/` |
| Completed feature snapshots | `dflow/specs/features/completed/` |
| Technical debt | `dflow/specs/architecture/tech-debt.md` or `dflow/specs/migration/tech-debt.md` |

### Project Structure

The full `dflow/specs/` layout Dflow seeds and maintains:

```
dflow/specs/
├── shared/                         # Project-level governance docs (seeded by npx dflow-sdd-ddd init)
│   ├── _overview.md
│   └── _conventions.md
├── domain/
│   ├── glossary.md
│   ├── context-map.md              # Bounded Context relationships
│   └── {bounded-context}/
│       ├── context.md
│       ├── models.md               # Aggregates, Entities, VOs
│       ├── rules.md                # Business rules index (BR-ID + one-line)
│       ├── behavior.md             # Consolidated behavior (Given/When/Then)
│       └── events.md               # Domain Events catalog
├── features/
│   ├── active/
│   │   └── {SPEC-ID}-{slug}/       # One feature = one directory
│   │       ├── _index.md           # Feature dashboard + BR Snapshot + Resume Pointer
│   │       ├── phase-spec-YYYY-MM-DD-{slug}.md   # T1: 0..N phase specs
│   │       └── lightweight-YYYY-MM-DD-{slug}.md  # T2: 0..N lightweight specs
│   │                                             #     (or BUG-{NUMBER}-{slug}.md)
│   ├── completed/                  # Done (whole feature directory archived here)
│   └── backlog/
│   #
│   # SPEC-ID format: SPEC-YYYYMMDD-NNN; slug follows discussion language (中文 / 英文 both OK).
│   # T3 trivial changes have NO independent file — just a row in _index.md Lightweight Changes.
└── architecture/
    ├── decisions/                  # Architecture Decision Records
    └── tech-debt.md
```

## Core Rules

1. Spec before code: meaningful behavior changes need a spec or lightweight bug spec before implementation.
2. Keep domain language explicit: update glossary, rules, models, and behavior snapshots when domain meaning changes.
3. Keep phase delta, feature snapshot, and system state separate.
4. Check drift before calling work complete.
5. Follow `dflow/specs/shared/_conventions.md`, especially `## Prose Language`.

## Ceremony Scaling

Dflow uses three tiers — **T1 Heavy / T2 Light / T3 Trivial** — chosen by the AI
per change. `/dflow:new-feature` and `/dflow:new-phase` always default to T1 (no
judgement needed). The criteria below apply when `/dflow:modify-existing` or
`/dflow:bug-fix` decides which tier fits a modification.

| Tier | Scenario | Output | Command / Trigger |
|---|---|---|---|
| **T1 Heavy** | New feature, new phase, new Aggregate / BC, architectural change, new BR | Independent `phase-spec-YYYY-MM-DD-{slug}.md` placed in the feature directory + `_index.md` Phase Specs row + refresh BR Snapshot. For a new Aggregate / BC also create an `aggregate-design.md` from `templates/aggregate-design.md` **in the feature directory** (working worksheet; the durable summary stays in `models.md`) + update `context-map.md` + `events.md`. | `/dflow:new-feature` / `/dflow:new-phase` |
| **T2 Light** | Bug fix (logic error), UI input validation tweak, flow branch change — has BR Delta | Independent `lightweight-{YYYY-MM-DD}-{slug}.md` (or `BUG-{NUMBER}-{slug}.md`) inside the feature directory + `_index.md` Lightweight Changes row (outbound link) + refresh BR Snapshot. Confirm the fix lands in the correct architectural layer. | `/dflow:bug-fix` or `/dflow:modify-existing` (lightweight branch) |
| **T3 Trivial** | Button colour, copy/text fix, typo, formatting, pure comments — **no BR change, no Domain concept change, no data structure change** | **Inline row in `_index.md` Lightweight Changes only** (no independent spec file) | `/dflow:modify-existing` (`_index-only` branch) |

**T3 criteria** (the AI must satisfy **all four** before classifying T3):

1. No BR-ID change (no ADDED / MODIFIED / REMOVED / RENAMED business rule)
2. No Domain concept added or changed (Aggregate / Entity / VO / Event)
3. No data structure change (table, column, relation, index)
4. Only changes UI surface (colour, text, layout), pure comments, or pure formatting

If any criterion fails → drop to T2; if Domain / BR / data structure is touched → escalate to T1.

**Below T3 — Dflow doesn't track at all**: pure typo fixes, commit-message
typos, pure formatting commits (e.g. `prettier` / `dotnet format` auto-runs).
You can `git commit` directly without writing even a T3 inline row.

**DDD Modeling Depth (still informs T1 scope)**:

- New Aggregate / BC → **Full**: create an `aggregate-design.md` from `templates/aggregate-design.md` in the feature directory (durable summary stays in `models.md`), update `context-map.md`, define Domain Events in `events.md`
- Feature within an existing BC → **Standard**: confirm Aggregate ownership, update `models.md` and `rules.md`
- T2 / T3 → confirm the fix lands in the correct architectural layer; no design-level updates required

## Behavior Source of Truth (rules.md + behavior.md)

Each Bounded Context has two complementary files that together describe the
system's current behavior:

- **`rules.md`** — declarative index: lists each BR-ID with a one-line summary.
  Quick lookup, easy to scan.
- **`behavior.md`** — scenario-level detail: the full Given/When/Then scenarios
  for each BR-ID, including Aggregate state transitions and Domain Events. This
  is the consolidated source of truth for "what does the system actually do
  right now?"

`dflow/specs/features/completed/` is a historical archive (individual change
records). `behavior.md` is the **merged current state** — when a feature is
completed, the AI merges its scenarios into `behavior.md`; when behavior is
modified, the AI updates the corresponding section to reflect the new behavior
(git preserves history). See the `behavior.md` template in the workflow bundle
at `dflow/specs/shared/dflow-workflows/templates/behavior.md`.

## Guiding Questions by Activity

SDD has five conceptual activities (Understanding / Domain Modeling / Spec
Writing / Implementation Planning / Testing Strategy) that the AI walks the
developer through inside a workflow. They cut across workflow steps — Activity 2
(Domain Modeling) might span Step 2 and Step 3 of new-feature-flow, for example.

**Activity markers in the phase-spec template**: each section in
`templates/phase-spec.md` carries an HTML comment (e.g.,
`<!-- Fill timing: Activity 2: Domain Modeling -->`) indicating the activity in
which that section should be filled. These markers align with the activities
below and are used by `/dflow:status` and the completion checklist to track
progress. When guiding a developer, fill sections in activity order; do not jump
ahead to Activity 4 (Implementation Planning) before Activity 3 (Spec Writing)
is agreed. The `Implementation Tasks` section at the end of the template is
produced by the AI at the end of Activity 4 — see new-feature-flow.md Step 5 /
new-phase-flow.md Step 4 / modify-existing-flow.md Step 3.

Note: the phase-spec template HTML comments cover Activity 1–4; Activity 5
(Testing Strategy) is a conceptual category folded into the Test Strategy
section that the template marks with Activity 4 timing. In `new-phase-flow`,
Activity 5 is exercised operationally in Step 6 when implementation and tests
are verified against the phase-spec before Step 7 completion.

### Activity 1: Understanding (What & Why)
- What problem does this solve? Who asked for it?
- What's the expected behavior from the user's perspective?
- Are there existing specs or domain docs related to this?

### Activity 2: Domain Modeling (DDD)
- Which Bounded Context? (Check context-map.md)
- What Aggregate does this belong to? Or is it a new Aggregate?
- What are the invariants this Aggregate must protect?
- Are there Value Objects to extract? (Money, DateRange, Address...)
- Will this produce Domain Events? Who consumes them?
- Does this cross Aggregate / Context boundaries? → Need an integration strategy

### Activity 3: Spec Writing
- Write the spec using the template (see `templates/phase-spec.md`)
- Define Given/When/Then with Aggregate state transitions
- Document Domain Events produced and consumed
- Identify edge cases around Aggregate invariants

### Activity 4: Implementation Planning
- Domain layer: Aggregate design, Value Objects, Domain Events
- Application layer: Command / Query, handlers, validation
- Infrastructure: Repository implementation, persistence / ORM configuration
- Presentation: API endpoint design

### Activity 5: Testing Strategy
- Domain unit tests: invariants, business rules, value object equality
- Application tests: command / query handler behavior
- Integration tests: repository, external services

## Workflow Steps

This guide is the **command registry, routing rules, and project context**.
Executable workflow steps (Step 1→N, step gates, completion checklists) are
**not** defined here. They live in the vendored workflow bundle projected into
this project at:

- `dflow/specs/shared/dflow-workflows/`

When executing a `/dflow:*` command, read the matching flow file from that
directory first. For example:

| Command | Flow file |
|---|---|
| `/dflow:new-feature` | `dflow/specs/shared/dflow-workflows/references/new-feature-flow.md` |
| `/dflow:modify-existing` | `dflow/specs/shared/dflow-workflows/references/modify-existing-flow.md` |
| `/dflow:bug-fix` | `dflow/specs/shared/dflow-workflows/references/modify-existing-flow.md` (lightweight-ceremony branch) |
| `/dflow:new-phase` | `dflow/specs/shared/dflow-workflows/references/new-phase-flow.md` |
| `/dflow:finish-feature` | `dflow/specs/shared/dflow-workflows/references/finish-feature-flow.md` |
| `/dflow:verify` | `dflow/specs/shared/dflow-workflows/references/drift-verification.md` |
| `/dflow:pr-review` | `dflow/specs/shared/dflow-workflows/references/pr-review-checklist.md` |
| `/dflow:report-dflow-feedback` | `dflow/specs/shared/dflow-workflows/references/dflow-feedback-flow.md` |

Supporting files (templates, domain modeling guide, drift checklist) are also
in `dflow/specs/shared/dflow-workflows/` under the same relative paths used
by the flow files.

## Tool-Specific Notes

This file is the canonical Dflow guide (registry + rules + router). Root-level
files such as `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`
should stay thin and point back here.

If a tool does not support Dflow slash commands, treat the command names as
plain workflow names and follow the matching flow file from the workflow bundle
at `dflow/specs/shared/dflow-workflows/`.
