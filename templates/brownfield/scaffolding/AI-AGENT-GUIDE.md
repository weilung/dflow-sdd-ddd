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

<!-- dflow-generated: guide-canonical START -->
<!-- Everything between these markers is Dflow-managed canonical guide content.
     `dflow configure-agents` refreshes it in place on upgrade. Put project-specific
     notes in "## Project Context" above (or outside the markers), not in here. -->

## Why This Matters

This project has business logic embedded in delivery/entrypoint code
(presentation/UI layer, controllers, handlers, jobs, message consumers, data
pipelines, or stored procedures), direct SQL in entrypoints, and duplicated
calculations across multiple flows. Every feature developed without specs makes
the target architecture harder to reach; every spec written and every domain
concept extracted makes it easier to reach.

Your role is not to lecture — it's to ask the right questions at the right time
so developers naturally produce three assets with every change:

1. **Spec documents** — future requirements documentation
2. **Domain layer code** — portable to a cleaner future architecture
3. **Tech debt records** — migration guide entries

## Scope: When Brownfield Applies

Dflow Brownfield is designed for existing systems where:

- **Business rules and domain concepts** can be extracted and re-expressed as
  portable code (entities, value objects, services, repository interfaces)
- **Business logic is currently embedded in delivery/entrypoint code** —
  presentation/UI layer, controllers, handlers, jobs, message consumers, data
  pipelines, or stored procedures — making changes risky and slow
- The team wants to **gradually move toward a cleaner architecture** without a
  full rewrite

It is **not** a fit for:

- Pure infrastructure scripts (deployment, monitoring) without a stable domain
  model
- Data pipelines or batch jobs that are purely transformational with no
  business-rule complexity
- Greenfield projects (use the Greenfield track instead)

## Before Editing Code

Do not jump from a request directly to code. First identify the matching
Dflow workflow and confirm the intended path with the developer.

Use these workflow entry points as plain chat instructions if slash commands
are not available in the current AI tool:

| Workflow | Use when |
|---|---|
| `/dflow:new-feature` | A genuinely new feature, page, or capability — a **newly created** navigable surface (its own route and its own content tree), a new user-executable domain operation, or a new independently-consumable output. Adding a control to an existing surface — or a menu entry pointing at a route that already exists — is modify-existing. |
| `/dflow:modify-existing` | Existing behavior or an existing surface changes — including adding a presentation / interaction control (copy button, filter, sort, quick-view) to an existing screen. |
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
| new-feature | /dflow:new-feature | Start a genuinely new feature, page, or capability (new navigable surface, domain operation, or consumable output). | feature request | workflow |
| modify-existing | /dflow:modify-existing | Change existing behavior, or add a control to an existing surface. | change request | workflow |
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

- **"Quick question about..." / "How does X work?"** → check
  `dflow/specs/domain/` first and answer from the documented domain knowledge.
  If no spec exists yet, suggest documenting the answer as domain knowledge.
- **"What should I work on next?" / sprint planning** → review
  `dflow/specs/features/backlog/` and suggest work based on migration value.
- **"I'm creating a branch"** → read `references/git-integration.md`; verify
  branch naming, and make sure the tier's own record exists before coding starts
  (T1 / T2: a spec; T3: the host `_index.md` row — a T3 branch has no spec file).
- **"I'm designing a domain model" / "How should I model X?" / building or
  reshaping an Aggregate** → read `references/ddd-modeling-guide.md` (DDD
  tactical patterns: aggregates, invariants, value objects, domain events). It
  is written with Greenfield artifact names; see its **Edition note** for where
  Brownfield records the same decisions (`models.md` / `rules.md` /
  `behavior.md` / `migration/tech-debt.md`).
- **"Turn the specs into HTML" / "make the specs easier to read"** → run the
  CLI command `dflow render` (a human-readability tool, not a `/dflow:*`
  workflow). It mirrors `dflow/specs/` into a browsable static HTML tree
  (default output: `dflow-specs-html/`); re-run it after specs change —
  Markdown stays the AI-facing source of truth.
- **"Dflow seems wrong" / "this template is confusing"** (or you notice Dflow
  guidance drift) → suggest `/dflow:report-dflow-feedback`; never submit
  anything upstream automatically.
- **Anything else code-related** → run it through § Ceremony Scaling's ordered
  cascade rather than a business-logic yes/no. Only the cascade's step 2 sends
  work outside Dflow, and it is narrower than "not business logic": a display
  typo, an appearance change, a machine-consumed contract edit, security / CVE
  work and a deliberate runtime performance change are all tracked. If the
  cascade lands the request anywhere at or above T3, suggest the matching
  `/dflow:*` command and wait for confirmation (see § Workflow Transparency);
  only if it lands below workflow, help directly with no ceremony. If step 0
  takes it out of the cascade instead — observation-only work — it is neither:
  say so and record it, do not treat "no tier" as "no ceremony". This applies
  once you are already reading this guide — what makes a tool load it in the
  first place is that tool's own trigger configuration, which is narrower.

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
  (e.g., the AI asks "Which Bounded Context?" and the developer answers with the
  Bounded Context name → implicit confirmation)

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

The `dflow/specs/` layout Dflow seeds and maintains (Brownfield track):

```
dflow/specs/
├── shared/                       # Project-level governance docs (seeded by npx dflow-sdd-ddd init)
│   ├── _overview.md              # System status & migration strategy
│   └── _conventions.md           # Spec writing conventions
├── domain/                       # Domain knowledge (DDD preparation)
│   ├── glossary.md               # Ubiquitous Language
│   └── {bounded-context}/        # e.g., expense/, hr/, leave/
│       ├── context.md            # Context boundary & responsibilities
│       ├── models.md             # Entity, VO, Aggregate definitions
│       ├── rules.md              # Business rules index (BR-ID + one-line)
│       └── behavior.md           # Consolidated behavior (Given/When/Then)
├── features/
│   ├── active/                   # Currently in development
│   │   └── {SPEC-ID}-{slug}/     # One feature = one directory
│   │       ├── _index.md         # Feature dashboard + BR Snapshot + Resume Pointer
│   │       ├── phase-spec-YYYY-MM-DD-{slug}.md   # T1: 0..N phase specs
│   │       └── lightweight-YYYY-MM-DD-{slug}.md  # T2: 0..N lightweight specs
│   │                                             #     (or BUG-{NUMBER}-{slug}.md)
│   ├── completed/                # Done (whole feature directory archived here)
│   └── backlog/                  # Planned
│   #
│   # SPEC-ID format: SPEC-YYYYMMDD-NNN; slug follows discussion language (中文 / 英文 both OK).
│   # T3 trivial changes have NO independent file — just a row in _index.md Lightweight Changes.
└── migration/
    └── tech-debt.md              # Issues to fix in the target system
```

## Core Rules

1. Spec before code: meaningful behavior changes need a spec or lightweight bug spec before implementation.
2. Keep domain language explicit: update glossary, rules, models, and behavior snapshots when domain meaning changes.
3. Keep phase delta, feature snapshot, and system state separate.
4. Check drift before calling work complete.
5. Follow `dflow/specs/shared/_conventions.md`, especially `## Prose Language`.

## Ceremony Scaling

Not everything needs full ceremony — match effort to impact. Dflow uses three
tiers — **T1 Heavy / T2 Light / T3 Trivial** — plus a **below-workflow** level
Dflow doesn't track at all. `/dflow:new-feature` and `/dflow:new-phase` are
always T1 (no judgement). For `/dflow:modify-existing` and `/dflow:bug-fix`,
classify the change with the **ordered cascade — the first step that matches
wins** (order matters: a later catch-all would otherwise swallow the trivial and
below-workflow cases):

0. **Scope.** The cascade classifies a *modification*. Genuinely new work — a
   new feature, page, or capability — is `/dflow:new-feature` (T1), even with no
   new BR / Domain / schema. Adding a presentation or interaction control to an
   **existing** surface (copy button, date-range filter, sort control, quick-view
   drawer / tab, or filling a missing `aria-label`) is a *modification* (stays in
   the cascade). A new user-executable domain operation (e.g. one-click return), a
   new independently-consumable output or delivery channel (Download-PDF / export /
   emailed report), or a **newly created** navigable surface (its own route and its
   own content tree) **is** new-feature. Adding a menu entry or link that points at
   a route that already exists is an access control on an existing surface —
   a modification, not a new surface. **Unit of classification**: classify one
   coherent requested change. Split a compound request into its atomic changes,
   run each through the cascade, and let the highest tier govern the whole — each
   lower-tier part still records its own artifact under the same host. Mechanical
   fallout you did not ask for (formatter noise, lint churn) neither raises nor
   lowers the result.
   **Observation-only work is also outside the
   cascade**: capturing existing behaviour as a baseline (Brownfield) changes no
   output, so it carries no tier at all — record it and do not read step 2's
   "below workflow" as permission to skip the record.
1. **T1 — Heavy.** A **new** business rule or normative constraint (permission /
   eligibility / threshold / approval / required outcome — regardless of whether a
   BR-ID already exists). *New* means a rule that can be stated and broken on its
   own: take the change away and the original rule still works exactly as before.
   Changing an existing rule's parameters is **T2** — a different threshold value,
   or adding to a set the rule already checks (one more allowed country, one more
   approver role). Adding an independent condition the rule never had (an approver
   predicate for a specific payment channel) is a new rule, and T1. A Domain concept (Aggregate / Entity / VO / Event)
   **added or structurally changed** (identity, VO equality components, aggregate
   boundary, or removing / renaming / redefining a spec-tracked member — a Domain
   concept **rename** is T1); a persistent **data-structure** change (table /
   column / relation / index added, removed, renamed, or its type / nullability /
   constraint / logical definition changed); an **architectural** change
   (inter-layer dependency direction, deployment / module boundary, runtime /
   platform ownership, or overturning an architecture decision — behavior-
   preserving still counts); or a **breaking** cross-consumer contract (API /
   event). Contracts run **inbound** too — a required env var / deployment config
   key, a CLI flag, an exit code, a scheduled-automation calling convention. What
   breaks a caller is T1: removing or renaming one, changing what one means, or
   adding a **required** key with no backward-compatible default (deployments must
   act) — making an existing operation's parameter **required** breaks callers the
   same way. Adding an *optional* key or parameter with a backward-compatible
   default is non-breaking — T2 via step 4.
2. **Below workflow — not tracked.** No audience-perceivable output delta **and**
   no machine-consumed-contract or operational-semantics touch: auto-formatter
   runs, whitespace, internal comments, internal-doc typos, commit messages, and
   behavior-preserving **routine** refactors / dependency bumps. **Routine** =
   touches no operational-semantics axis (security / safety / resilience /
   compliance / payment) and is not architectural — **breadth is not the test** (a
   behavior-preserving refactor across hundreds of call sites is still below
   workflow; a single-file change that touches an operational axis is not). Never
   below workflow, even when invisible: any BR-ID delta, any machine-consumed
   structured-log / export / contract change, any deliberate runtime performance /
   resource / SLA change, or any security / CVE / compliance work — those reach
   step 1 or 4 by audience. `git commit` directly.
3. **T3 — Trivial.** A **local, low-risk, meaning-preserving pure copy or
   appearance change a product audience perceives** — display-text typo / wording
   polish, colour, spacing, layout polish, or polishing existing alt / ARIA
   wording — on a **single screen / component or single independently-consumed
   page / file**, at the **element level**. **Excluded from T3**: high-consequence
   content (security warnings, password hints, consent, payment / legal notices);
   meaning-changing appearance (danger / status-colour semantics); anything
   affecting operability, default state, interaction order, or task completion
   ("just CSS" is no exemption); adding a **missing** accessible name (compliance
   remediation); and text a machine consumes — an API error string or code a client
   parses is contract, not display copy, so it is never T3: route it by the contract
   axis instead (breaks the consumer → step 1, T1; otherwise → step 4, T2). **Locality is
   the rendered audience footprint, not the number of source files**: one shared
   component or localization key whose output appears on several screens is beyond
   the local unit (T2), while edits to several files that surface in one place stay
   T3. Anything beyond that unit is T2 — a typo swept across many screens, a
   whole-screen visual rewrite, a cross-page sweep. The limit follows the whole
   intent, so splitting one cross-screen typo sweep into per-screen requests does
   not turn it into several T3s.
4. **T2 — Light (catch-all — everything else).** Functional / semantic behavior
   delta (logic, validation, interaction flow, display calculation, an
   **existing** BR's delta, non-breaking contract semantics); performance-only
   changes (perceivable or not); and copy / appearance sweeps escalated from step
   3. Functional bug fixes are T2 (root-cause + regression notes).

| Tier | Output | Command / Trigger |
|---|---|---|
| **T1 Heavy** | Independent `phase-spec-YYYY-MM-DD-{slug}.md` placed in the feature directory + `_index.md` Phase Specs row + refresh BR Snapshot | `/dflow:new-feature` / `/dflow:new-phase` — also where a `/dflow:modify-existing` or `/dflow:bug-fix` request goes when the cascade lands it at T1 |
| **T2 Light** | Independent `lightweight-YYYY-MM-DD-{slug}.md` (or `BUG-{NUMBER}-{slug}.md`) inside the feature directory + `_index.md` Lightweight Changes row (outbound link) + refresh BR Snapshot | `/dflow:modify-existing` or `/dflow:bug-fix` — the usual landing for a functional defect |
| **T3 Trivial** | **Inline row in the host `_index.md` Lightweight Changes only** (no independent spec file) | `/dflow:modify-existing` or `/dflow:bug-fix` (`_index`-only branch — e.g. a defect that is only a display-text typo) |

**Audience** = any human audience of the product perceives the output: UI
(including alt / ARIA read by assistive tech), email, exports. Public / adopter-
facing docs (product README, public API reference) and operator surfaces
(dashboard labels, alerts) are product-audience: pure wording = T3 (single page;
a cross-page sweep escalates to T2 at step 3), meaning change = T2. Raw internal
diagnostic logs / traces are internal (copy-only fixes are below workflow).
Structured logs / machine-readable exports a downstream consumer depends on are
contract: breaking cross-consumer = step 1 T1, non-breaking = step 4 T2.

**Project conventions can only escalate.** `_conventions.md` Ceremony (Project
Application) rows are a floor-raising overlay applied *after* the cascade: a
project may push a T2 up to T1, but may not lower a cascade T1, nor drop a
tracked class below workflow.

**Lightweight spec** = Problem + Expected behavior + 1–2 Given/When/Then. The
instantiated file is placed inside the feature directory (see
`templates/lightweight-spec.md`).

## Behavior Source of Truth (rules.md + behavior.md)

Each Bounded Context has two complementary files that together describe the
system's current behavior:

- **`rules.md`** — declarative index: lists each BR-ID with a one-line summary.
  Quick lookup, easy to scan.
- **`behavior.md`** — scenario-level detail: the full Given/When/Then scenarios
  for each BR-ID. This is the consolidated source of truth for "what does the
  system actually do right now?"

`dflow/specs/features/completed/` is a historical archive (individual change
records). `behavior.md` is the **merged current state** — when a feature is
completed, the AI merges its scenarios into `behavior.md`; when behavior is
modified, the AI updates the corresponding section to reflect the new behavior
(git preserves history). See the `behavior.md` template in the workflow bundle
at `dflow/specs/shared/dflow-workflows/templates/behavior.md`.

## Guiding Questions by Activity

SDD has five conceptual activities (Understanding / Domain Analysis / Spec
Writing / Implementation Planning / Tech Debt Awareness) that the AI walks the
developer through inside a workflow. They cut across workflow steps — Activity 2
(Domain Analysis) might span Step 2 and Step 3 of new-feature-flow, for example.

When a developer starts working, guide them with these questions in order. Don't
dump all questions at once — ask naturally as the conversation progresses.

**Activity markers in the phase-spec template**: each section in
`templates/phase-spec.md` carries an HTML comment (e.g.,
`<!-- Fill timing: Activity 2: Domain Analysis -->`) indicating the activity in
which that section should be filled. These markers align with the activities
below and are used by `/dflow:status` and the completion checklist to track
progress. When guiding a developer, fill sections in activity order; do not jump
ahead to Activity 4 (Implementation Planning) before Activity 3 (Spec Writing)
is agreed. The `Implementation Tasks` section at the end of the template is
produced by the AI at the end of Activity 4 — see new-feature-flow.md Step 5 /
new-phase-flow.md Step 4 / modify-existing-flow.md Step 4.

Note: the phase-spec template HTML comments cover Activity 1–4; Activity 5 (Tech
Debt Awareness) is a closeout-time concern handled when updating `tech-debt.md`
during the completion checklist, not via template section markers.

### Activity 1: Understanding (What & Why)
- What problem does this solve? Who asked for it?
- What's the expected behavior from the user's perspective?
- Are there existing specs or domain docs related to this?

### Activity 2: Domain Analysis (Where does it live?)
- Which Bounded Context does this belong to? (Check dflow/specs/domain/)
- What domain concepts are involved? (Entities, Value Objects, Services)
- Are there new terms? → Update glossary.md
- Are there new or changed business rules? → Document in rules.md

### Activity 3: Spec Writing (Document before coding)
- Write the spec using the template (see `templates/phase-spec.md`)
- Define Given/When/Then scenarios for key behaviors
- Identify edge cases and business rule interactions

### Activity 4: Implementation Planning (How to build it)
- Can the business logic live in `src/Domain/` as framework-pure code?
- What interfaces are needed? (Repository, external services)
- How thin can the delivery/entrypoint code be? (Ideally: parse input → call Domain → return or display result)

### Activity 5: Tech Debt Awareness (What did we find?)
- Did we discover scattered business logic? → Record in tech-debt.md
- Are there duplicated calculations? → Record
- Direct SQL in delivery/entrypoint code? → Record
- Magic numbers or undocumented statuses? → Record and add to glossary

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
| `/dflow:bug-fix` | `dflow/specs/shared/dflow-workflows/references/modify-existing-flow.md` (same flow; tier comes from the cascade, not from the command) |
| `/dflow:new-phase` | `dflow/specs/shared/dflow-workflows/references/new-phase-flow.md` |
| `/dflow:finish-feature` | `dflow/specs/shared/dflow-workflows/references/finish-feature-flow.md` |
| `/dflow:verify` | `dflow/specs/shared/dflow-workflows/references/drift-verification.md` |
| `/dflow:pr-review` | `dflow/specs/shared/dflow-workflows/references/pr-review-checklist.md` |
| `/dflow:report-dflow-feedback` | `dflow/specs/shared/dflow-workflows/references/dflow-feedback-flow.md` |

Supporting files (templates, drift checklist) are also in
`dflow/specs/shared/dflow-workflows/` under the same relative paths used
by the flow files.

## Tool-Specific Notes

This file is the canonical Dflow guide (registry + rules + router). Root-level
files such as `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`
should stay thin and point back here.

If a tool does not support Dflow slash commands, treat the command names as
plain workflow names and follow the matching flow file from the workflow bundle
at `dflow/specs/shared/dflow-workflows/`.

<!-- dflow-generated: guide-canonical END -->
