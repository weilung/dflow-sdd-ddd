# New Feature Workflow — Greenfield Clean Architecture

Step-by-step guide for adding a new feature with full DDD and Clean Architecture.

Triggered by `/dflow:new-feature` (or natural language implying a new-feature task — see AI-AGENT-GUIDE.md § Workflow Transparency for the auto-trigger safety net behavior).

**Step Gates** in this flow (stop-and-confirm before proceeding):
- Step 3 → Step 3.5 (Aggregate / VO / Events identified → confirm slug + directory + branch names)
- Step 4 → Step 5 (spec written → plan implementation)
- Step 6 → Step 7 (branch ready → start implementation)
- Step 7 → Step 8 (implementation done → completion)

Crossing any step gate above also updates the host feature's `_index.md` Resume Pointer cursor (Active Workflow / Current Step / Gates Passed / Awaiting) once the feature directory exists — fold it into that gate's existing `_index.md` / Resume Pointer edit, no separate ceremony (see the `_index.md` template's Resume Pointer notes).

All other step transitions are **step-internal**: announce "Step N complete, entering Step N+1" and proceed without waiting. See AI-AGENT-GUIDE.md § Workflow Transparency for the full transparency protocol and confirmation signals.

**Ceremony**: this flow always defaults to **T1 Heavy** — the first phase of a brand-new feature is by definition a full SDD cycle. Tier judgement (T1 / T2 / T3) only applies to `/dflow:modify-existing` (see `references/modify-existing-flow.md` and AI-AGENT-GUIDE.md § Ceremony Scaling).

## Step 1: Intake — Understand the Request

Before producing any spec prose, read `dflow/specs/shared/_conventions.md`
and apply the `## Prose Language` setting. If the setting is missing or not
an explicit language tag, ask the developer to update `_conventions.md`
before continuing.

Ask naturally:
1. **What's the feature?** Plain-language description.
2. **Who needs it?** Stakeholder or user role.
3. **Why now?** Priority and urgency.

Check existing assets:
- Search `dflow/specs/domain/` for related concepts
- Search `dflow/specs/features/` for related features
- Check `dflow/specs/domain/glossary.md` and `context-map.md`

**In-flight overlap scan (cross-branch + other unfinished features)** — this
branch's `dflow/specs/` does not show everything in flight. Run the in-flight
scan (classification and dedup rules in `AI-AGENT-GUIDE.md` § Status / Control
Commands):

```bash
git fetch   # when the network allows; skip gracefully offline
git branch --all --list '*feature/*' --list '*bugfix/*'
```

- List other unfinished features already in this branch's `active/` (one
  cursor line each, from their `_index.md` Resume Pointer).
- Classify every listed branch by the guide's rules — in flight elsewhere /
  closed out awaiting integration / stale (completed here) / unknown — do
  not shortcut the classification. If a branch classified as **in flight
  elsewhere, closed out awaiting integration, or unknown** has an ID / slug
  that semantically overlaps this request, surface it and wait for the
  developer to decide — continue there / integrate it first / treat as
  related / unrelated — **before creating any new directory, spec, or
  branch**. Only stale (completed here) branches are non-blocking.

**→ Transition (step-internal)**: Step 1 complete. Announce "Step 1 complete (intake). Entering Step 2: Identify the Bounded Context." and continue.

## Step 2: Identify the Bounded Context

Check `dflow/specs/domain/context-map.md`:

```
"This feature involves [concepts]. It seems to belong in the
[Context] bounded context. Does that match your understanding?"
```

If a new context is needed → create `dflow/specs/domain/{new-context}/context.md` using the context-definition template (`templates/context-definition.md`).

If it crosses contexts:
```
"This touches both [Context A] and [Context B]. We need to decide:
- Which context OWNS the operation?
- How does the other context get notified? (Domain Event? Query?)
- Do we need an Anti-Corruption Layer?"
```

Once the BC is confirmed, classify and record its **Subdomain Type** as part
of the same confirmation (not a separate gate):

```
"Is this capability core (差異化來源), supporting (必要但非差異化),
or generic (可買 / 可套件 / 簡單 CRUD)? I'll record it in context-map.md."
```

If the BC already has a Subdomain Type in `context-map.md`, reuse it — don't
re-ask unless the developer wants to reclassify. Record it in
`dflow/specs/domain/context-map.md`:

- If the **Subdomain Type column is missing** (an older context-map), add the
  column **preserving every existing row** — do not rewrite their content.
- The greenfield context-map is created at init, so the file normally exists;
  if for any reason it is absent, create it from `templates/context-map.md`.

The classification sets the modeling depth used in Step 3 (see
`references/ddd-modeling-guide.md` § Subdomain-Aware Modeling Depth).

**→ Transition (step-internal)**: Step 2 complete. Announce "Step 2 complete (BC identified). Entering Step 3: Domain Modeling." and continue.

## Step 3: Domain Modeling

This is where the Greenfield Clean Architecture workflow diverges
significantly from the Brownfield edition.
Read `references/ddd-modeling-guide.md` for detailed patterns. Apply the
modeling depth set by this BC's Subdomain Type from Step 2 (see that guide's
§ Subdomain-Aware Modeling Depth): a `generic` context gets a thin model, not
the full tactical treatment below.

Walk through:

### Aggregate Identification
```
"What must be consistent in a single transaction?
Those things form an Aggregate. Everything else is eventually consistent."
```

- What are the invariants?
- What is the Aggregate Root?
- What entities belong inside this Aggregate?
- What Value Objects can we extract?

### Domain Events
```
"After this happens, what else in the system needs to know?"
```

- What events does this feature produce?
- What events does it consume?
- Are handlers in the same context (synchronous) or cross-context (async)?

### Interface Definitions
```
"What external data does the domain need to make decisions?"
```

- Repository interfaces for persistence
- Service interfaces for external systems
- Define in Domain layer, implement in Infrastructure

If foundational domain docs are missing, create them from templates before writing content:
- `dflow/specs/domain/glossary.md` → `templates/glossary.md`
- `dflow/specs/domain/{context}/models.md` → `templates/models.md`
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md` — at this step create only the skeleton + one section anchor per `BR-*`; the Given/When/Then scenarios are merged in later at Step 8.3 (finish-feature), not now
- `dflow/specs/domain/{context}/events.md` (when Domain Events are involved) → `templates/events.md`
- `dflow/specs/domain/context-map.md` (when cross-context relationships are involved) → `templates/context-map.md`

**→ Step Gate: Step 3 → Step 3.5**

Announce to developer:
> "Aggregate / VO / Events identified. Before I create any files, let me confirm the SPEC-ID, slug, directory name, and branch name with you (Step 3.5). `/dflow:next` to proceed."

Wait for confirmation before entering Step 3.5.

## Step 3.5: Slug Confirmation

AI proposes the SPEC-ID, slug, feature directory path, and branch name in
one message and asks the developer to confirm before any directory or
branch is created. Slug follows the language of the discussion (中文 or
English — both are valid; see `references/git-integration.md` for the slug
language rule).

Before confirming, surface the path-encoding caveat: a non-ASCII (e.g. 中文)
slug yields non-ASCII feature-directory and branch paths. These work on common
Git hosts but a handful of CI runners / toolchains mishandle them. If the
project's pipeline is unknown, offer an ASCII slug as an alternative. See
`references/git-integration.md` for the full risk note.

Example (中文 discussion):

> 「依我們的討論：
>  - SPEC-ID: `SPEC-20260424-001`
>  - slug: `報表調整`（跟隨中文討論）
>  - feature 目錄: `dflow/specs/features/active/SPEC-20260424-001-報表調整/`
>  - git branch: `feature/SPEC-20260424-001-報表調整`
>
>  這樣可以嗎？或你想改 slug？」

Example (English discussion):

> "Per our discussion:
>  - SPEC-ID: `SPEC-20260424-002`
>  - slug: `submit-expense-report` (English following our discussion)
>  - feature directory: `dflow/specs/features/active/SPEC-20260424-002-submit-expense-report/`
>  - git branch: `feature/SPEC-20260424-002-submit-expense-report`
>
>  Sound good? Or would you prefer a different slug?"

Wait for explicit confirmation. The slug agreed here is reused for:
- The feature directory name
- The first phase-spec filename (`phase-spec-{date}-{slug}.md`)
- The git branch (Step 6)

If the developer asks to change the slug, re-propose and re-confirm.

**→ Transition (step-internal)**: Step 3.5 complete. Announce "Step 3.5 complete (slug confirmed). Entering Step 4: Write the Spec." and continue.

## Step 4: Write the Spec

Create the **feature directory** + **`_index.md`** + **first phase-spec**:

```
dflow/specs/features/active/{SPEC-ID}-{slug}/
├── _index.md
└── phase-spec-{YYYY-MM-DD}-{slug}.md
```

1. **Create the directory**: `dflow/specs/features/active/{SPEC-ID}-{slug}/`
2. **Create `_index.md`** using `templates/_index.md`:
   - Metadata: fill `spec-id`, `slug`, `status: in-progress`, `created`, `branch`
   - Goals & Scope: 1-3 sentences capturing what / for whom / boundary; mention
     the BC and Aggregate(s) involved
   - Phase Specs: one row for the first phase
     (`| 1 | {date} | {slug} | in-progress | [phase-spec-{date}-{slug}.md](./phase-spec-{date}-{slug}.md) |`)
   - Current BR Snapshot: initialise from the first phase's planned BRs
     (will be refreshed when the phase-spec finalises)
   - Lightweight Changes: empty table at start
   - Resume Pointer: "phase-1 in progress: drafting phase-spec." / "Next Action: finish phase-spec, then implement Domain layer." / cursor fields: Active Workflow `new-feature`, Current Step `Step 4 — write the spec`, Gates Passed `3→3.5`, Awaiting `none (mid-step)`
3. **Create the first phase-spec** at `phase-spec-{YYYY-MM-DD}-{slug}.md`
   using `templates/phase-spec.md`. The "Delta from prior phases" section
   is filled with "首 phase，無前置 Delta" (first phase has nothing to
   delta against).
4. **If this feature introduces a new Aggregate**, whether to create an
   `aggregate-design.md` worksheet from `templates/aggregate-design.md`
   **inside this feature directory** follows the BC's Subdomain Type (Step 2;
   see `references/ddd-modeling-guide.md` § Subdomain-Aware Modeling Depth):
   **core** → create it; **supporting** → create it but keep it lean;
   **generic** → skip by default (a thin wrapper needs no design worksheet)
   unless the developer explicitly opts into deeper modeling and records why.
   When created, it is a working artifact scoped to the feature; the
   Aggregate's durable, long-lived catalog entry still lives in
   `dflow/specs/domain/{context}/models.md` — `aggregate-design.md`
   complements `models.md`, it does not replace it.

Key additions compared to Brownfield edition:
- **Aggregate State Transitions**: Document how Aggregate state changes
- **Domain Events**: List events produced and expected handlers
- **CQRS Split**: Identify which parts are Commands (write) vs Queries (read)

### Behavior Specification
```gherkin
Scenario: Submit expense report
  Given an expense report in Draft status with 3 line items totaling 5,000 TWD
  When the employee submits the report
  Then the report status changes to Submitted
  And a ExpenseReportSubmitted event is raised
  And the report can no longer be modified
```

**→ Step Gate: Step 4 → Step 5**

Announce to developer:
> "Spec is drafted — behavior scenarios, Aggregate state transitions, Domain Events, and CQRS split are captured. Ready to plan the layer-by-layer implementation (Domain → Application → Infrastructure → Presentation)? `/dflow:next` or reply 'OK' to continue, or tell me if the spec needs another iteration first."

Wait for confirmation (`/dflow:next`, verbal OK, or implicit — see AI-AGENT-GUIDE.md § Confirmation Signals) before entering Step 5.

## Step 5: Plan the Implementation (Layer by Layer)

### Domain Layer (implement first)
```
1. Create/update Aggregate Root with state-changing methods
2. Create Value Objects with validation in constructors
3. Define Domain Events (record types)
4. Define Repository interface
5. Write Domain unit tests
```

### Application Layer (implement second)
```
1. Create Command + CommandHandler (for writes)
2. Create Query + QueryHandler (for reads)
3. Create CommandValidator (FluentValidation)
4. Create Domain Event handlers (if needed)
5. Define DTOs for input/output
```

### Infrastructure Layer (implement third)
```
1. ORM / persistence configuration (mapping configuration, NOT Domain attributes/annotations)
2. Repository implementation
3. External service adapters
4. Migration script
```

### Presentation Layer (implement last)
```
1. API endpoint (Controller or Minimal API)
2. Request/Response models
3. Swagger documentation
```

### Generate Implementation Tasks List

After the layer-by-layer plan is agreed, AI generates a concrete task list and writes it into the spec's `Implementation Tasks` section (see `templates/phase-spec.md`). Each task follows `[LAYER]-[NUMBER]：description` and maps to Clean Architecture layers:

- `DOMAIN` — Aggregate / Entity / VO / Domain Event / Domain Service / Repository Interface
- `APP`    — Command/Query / Handler / Validator / DTO / Event Handler
- `INFRA`  — EF Configuration / Repository Impl / external adapter / Migration
- `API`    — Controller / Minimal API / Request/Response / Swagger
- `TEST`   — Tests per layer

Recommended authoring order mirrors implementation order: `DOMAIN → APP → INFRA → API` (with `TEST` interleaved).

Example seed (replace with feature-specific tasks):

```markdown
- [ ] DOMAIN-1：ExpenseReport aggregate with Submit() state transition
- [ ] DOMAIN-2：ExpenseReportSubmitted domain event
- [ ] APP-1：SubmitExpenseReportCommand + Handler
- [ ] INFRA-1：EF config + ExpenseReportRepository
- [ ] API-1：POST /expense-reports/{id}/submit endpoint
- [ ] TEST-1：Aggregate invariants + handler unit tests
```

The list becomes the execution punch-list for Step 7 and the completion checklist in Step 8.

**→ Transition (step-internal)**: Step 5 complete. Announce "Step 5 complete (layer-by-layer plan + task list ready). Entering Step 6: Git Branch." and continue.

## Step 6: Git Branch

```
Branch naming: feature/{SPEC-ID}-{slug}
Examples:
  feature/SPEC-20260424-002-submit-expense-report   (English slug)
  feature/SPEC-20260424-001-報表調整                  (Chinese slug)
```

The slug **must match the slug agreed in Step 3.5** (which is also the
feature directory name). The SPEC-ID + slug links the branch to its
feature directory and `_index.md`.

**Branch gate (policy-aware).** A feature branch is mandatory under both Git
policies (`gitflow` / `trunk`, per `_conventions.md` § Git Policy). The gate
checks whether you are already on this feature's `feature/{SPEC-ID}-{slug}`
branch: if so, it is satisfied. If you are not yet on it (still on the base
branch the project cuts from, or an unrelated branch), the AI offers to create
and switch to `feature/{SPEC-ID}-{slug}`, switch to an existing matching branch,
or override and stay (recorded in the `_index.md` Checkpoint Log; three
consecutive overrides → the AI suggests re-running `dflow init`). Dflow does not
need to know which branch is your base. See `references/git-integration.md`
§ Commit Checkpoints, Branch Gate & AI Commits.

**→ Step Gate: Step 6 → Step 7**

Announce to developer:
> "Branch `feature/{SPEC-ID}-{description}` is created. Ready to start layer-by-layer implementation (Domain first)? `/dflow:next` to proceed, or discuss layer order / scope first."

> Commit checkpoint (T1 milestone 1 of 3 — see `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI Commits): now that the feature branch exists (the branch gate above ran first, so this commit lands on the feature branch — never on a base branch), offer to commit the spec baseline, then record the result (committed / skipped) in the `_index.md` Checkpoint Log. Milestone 2 = implementation (Step 7→8); milestone 3 = closeout (`/dflow:finish-feature`).

Wait for confirmation before entering Step 7.

## Step 7: Implementation Checklist

During implementation, continuously verify:

**Domain Layer**
- [ ] Aggregate protects all invariants
- [ ] State changes only through methods (no public setters)
- [ ] Value Objects are immutable with validation
- [ ] Domain Events raised for significant state changes
- [ ] Zero external dependencies (check the Domain package/module manifest)
- [ ] Unit tests cover invariants and business rules

**Application Layer**
- [ ] No business logic in handlers (only orchestration)
- [ ] Command/Query separation maintained
- [ ] Validation in Validator, not Handler
- [ ] DTOs map to/from Domain objects (no Domain objects in API)

**Infrastructure Layer**
- [ ] EF Config in Fluent API (no attributes on Domain entities)
- [ ] Repository implements Domain interface correctly
- [ ] No business logic in queries

**Presentation Layer**
- [ ] Controller is thin (parse → dispatch → respond)
- [ ] No domain objects exposed to API consumers
- [ ] Proper HTTP status codes

**→ Step Gate: Step 7 → Step 8**

Announce to developer:
> "Implementation appears complete across all four layers. Ready to run the completion checklist (verify against spec, update domain docs + context-map, ensure test coverage, archive the spec)? `/dflow:next` to proceed."

> Commit checkpoint (T1 milestone 2 of 3): offer to commit the implementation, then record the result in the `_index.md` Checkpoint Log. Milestone 3 (closeout) is the `/dflow:finish-feature` checkpoint.

Wait for confirmation before entering Step 8. This step gate is where the completion checklist is triggered — do not skip.

## Step 8: Completion

Triggered by the Step 7 → Step 8 Step Gate. AI runs the completion checklist in the order below; do **not** skip a section.

### 8.1 Verification — AI runs independently

AI reports `✓` / `✗` for every item before touching docs. Items marked *(post-8.3)* are re-verified after the documentation merge in 8.3 lands:

- [ ] `Implementation Tasks` section: all tasks checked, or unchecked items explicitly labelled as follow-up (linked to spec / tech-debt entry)
- [ ] Every `Given/When/Then` scenario in the spec is covered by implementation or tests
- [ ] Every `BR-*` business rule is covered by implementation or tests
- [ ] Every `EC-*` edge case is handled
- [ ] Every Domain Event listed in the spec is raised in the implementation
- [ ] Domain layer/package has **no** external package-manager dependencies beyond the language/runtime baseline
- [ ] Aggregate invariants still hold after the change (all state changes go through methods, no public setters)
- [ ] ORM / persistence mapping is kept outside Domain entities (no persistence attributes/annotations on Domain entities)
- [ ] *(post-8.3)* `dflow/specs/domain/{context}/behavior.md` contains a section anchor for every `BR-*` introduced by this spec (mechanical input for `/dflow:verify`)
- [ ] *(post-8.3)* `dflow/specs/domain/{context}/rules.md` `last-updated` is later than this spec's `created` date (mechanical drift guard)

If any item fails, report the gap and pause — don't proceed to 8.2.

### 8.2 Verification — needs developer confirmation

AI lists findings one at a time and waits for the developer to confirm each:

- [ ] Does the implementation faithfully express the **intent** of each BR? (AI lists BR → impl location; developer judges fit)
- [ ] Are the edge case handling decisions appropriate? (AI lists EC → handling; developer judges)
- [ ] Are Domain Event payloads and handler placements (same-context sync vs cross-context async) correct? (AI lists; developer confirms)
- [ ] Did we miss any tech debt worth recording?
- [ ] Do the scenarios merged into `behavior.md` (incl. Aggregate transitions + Events) faithfully express the intended behavior? (AI lists merged anchors; developer judges)
- [ ] Should the `Implementation Tasks` section in the spec be collapsed / removed now that it's complete? (team convention — developer decides)

Ask these one-by-one; do not dump all six at once.

### 8.3 Documentation updates

- [ ] `dflow/specs/domain/glossary.md` — new terms added
- [ ] `dflow/specs/domain/{context}/models.md` — model definitions updated
- [ ] `dflow/specs/domain/{context}/rules.md` — business rules updated
- [ ] `dflow/specs/domain/{context}/behavior.md` — merge completed spec's Given/When/Then scenarios (incl. Aggregate transitions + Events) into consolidated behavior. Sub-steps:
      - Promote any Activity 3 (Spec Writing) draft sections (from B3 mid-sync) to formal sections
      - Update the corresponding `rules.md` anchor's `last-updated` date (B4)
- [ ] `behavior.md` draft cleanup — if the spec was abandoned mid-way, keep the `## 提案中變更` section's history or explicitly REMOVE it
- [ ] `dflow/specs/domain/{context}/events.md` — Domain Events updated
- [ ] `dflow/specs/domain/context-map.md` — updated if cross-context interaction was added or changed
- [ ] `dflow/specs/architecture/tech-debt.md` — tech debt discovered during implementation recorded

### 8.4 Archival

For a single-phase feature, this is the closeout point. If the feature has
later phases still ahead, this phase is complete but the feature is not —
don't archive yet; run `/dflow:new-phase` to start the next phase, not
`/dflow:finish-feature` yet. For a multi-phase feature, the developer
typically reaches this point at the end of the final phase — at which time
`/dflow:finish-feature` is the recommended trigger (it bundles steps 8.1 /
8.2 verification, BC sync, and archival into one explicit ceremony). Either
path is acceptable; pick the one that matches the developer's habit.

- [ ] `_index.md` `status` field changed to `completed`
- [ ] All `phase-spec-*.md` files in the feature directory have `status:
      completed` in their frontmatter
- [ ] **Whole feature directory** moved from `dflow/specs/features/active/`
      to `dflow/specs/features/completed/` using `git mv` (preserves rename
      tracking — see `references/git-integration.md` § "Directory Moves
      Must Use git mv"):
      ```
      git mv dflow/specs/features/active/{SPEC-ID}-{slug} \
             dflow/specs/features/completed/{SPEC-ID}-{slug}
      ```

> **Recommended path for multi-phase features**: instead of doing
> 8.1–8.4 manually at the end of every phase, run `/dflow:finish-feature`
> once the feature's last phase is complete. It executes the same checks
> + BC sync + `git mv` + emits an Integration Summary. See
> `references/finish-feature-flow.md`.

Only announce "feature complete" after 8.4 is done.
