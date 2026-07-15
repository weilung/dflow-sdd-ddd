# New Feature Workflow

Step-by-step guide for when a developer triggers `/dflow:new-feature` (or natural language implying a new-feature task — see AI-AGENT-GUIDE.md § Workflow Transparency for the auto-trigger safety net behavior).

**Step Gates** in this flow (stop-and-confirm before proceeding):
- Step 3 → Step 3.5 (domain concepts captured → confirm slug + directory + branch names)
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

Ask these questions (naturally, not as a checklist dump):

1. **What's the feature?** Get a plain-language description.
2. **Who needs it?** Identify the stakeholder or user role.
3. **Why now?** Understand priority and urgency (affects ceremony level).

Then check existing assets:
- Search `dflow/specs/domain/` for related concepts
- Search `dflow/specs/features/` for related or overlapping features
- Check `dflow/specs/domain/glossary.md` for relevant terms

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

Share what you found: "I see we already have [X] documented. This new feature seems to extend
that — is that right?"

**→ Transition (step-internal)**: Step 1 complete. Announce "Step 1 complete (intake). Entering Step 2: Identify the Bounded Context." and continue.

## Step 2: Identify the Bounded Context

Guide the developer to place this feature in the right context:

```
"This feature involves [concepts]. Looking at our domain structure,
it seems to fit in the [Context] bounded context. Does that match
your understanding?"
```

If no matching context exists:
1. Propose a new context name
2. Create `dflow/specs/domain/{new-context}/context.md` using the context-definition template
3. Get developer confirmation before proceeding

Once the BC is confirmed, classify and record its **Subdomain Type** as part
of the same confirmation (not a separate gate):

```
"Is this capability core (差異化來源), supporting (必要但非差異化),
or generic (可買 / 可套件 / 簡單 CRUD)? I'll record it in context-map.md."
```

If the BC already has a Subdomain Type, reuse it — don't re-ask unless the
developer wants to reclassify. Record it in
`dflow/specs/domain/context-map.md`:

- If the file **does not exist** (the Brownfield track does not mandate it —
  contexts emerge organically), create it from `templates/context-map.md`.
- If it exists but the **Subdomain Type column is missing**, add the column
  **preserving every existing row** — do not rewrite their content.

**→ Transition (step-internal)**: Step 2 complete. Announce "Step 2 complete (BC identified). Entering Step 3: Domain Concept Discovery." and continue.

## Step 3: Domain Concept Discovery

Walk through these questions:

- **What are the key nouns?** → Potential Entities or Value Objects
- **What are the key verbs?** → Potential Domain Services or Entity behaviors
- **What are the rules/constraints?** → Business Rules to document
- **What are the states/statuses?** → State machines to model
- **What external data is needed?** → Interfaces to define

If one concept gathers rules / invariants that must hold together — **a state
machine over its lifecycle, or invariants spanning several of its fields /
child records** — treat it as a candidate **Aggregate Root** (a consistency
boundary = atomic, not mere relatedness), not just an Entity. Note its
invariants and what must change atomically against its `models.md` Entity row,
and confirm the boundary with the developer. (A state machine is one common
signal, not a prerequisite.) For the tactical patterns — invariant
classification, set-based / uniqueness rules, value objects, aggregate sizing —
read `references/ddd-modeling-guide.md` (its **Edition note** maps recording
surfaces to brownfield's `models.md` / `rules.md`).

The mirror case — the concept is **already modeled**: when extending an
existing Aggregate / modeled concept, re-read what was recorded when it was
shaped (its `models.md` row + Notes and the relevant `rules.md` entries)
before extending it. If this change matches a recorded re-evaluation
condition ("revisit when …") or trips a model-resistance signal, follow
`references/ddd-modeling-guide.md` § "Revising an Established Model":
record one short passage in the spec's design decisions / open questions —
proceed as-is, split, or rename, with the reason. Deciding to keep the
current model, recorded, is a valid outcome; extending silently is not.

For each new concept:
1. Check glossary — add if missing
2. Check if it already exists in models.md — extend if needed
3. If entirely new, add to the appropriate context's models.md

If foundational domain docs are missing, create them from templates before writing content:
- `dflow/specs/domain/glossary.md` → `templates/glossary.md`
- `dflow/specs/domain/{context}/models.md` → `templates/models.md`
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md` — at this step create only the skeleton + one section anchor per `BR-*`; the Given/When/Then scenarios are merged in later at Step 8.3 (finish-feature), not now

**→ Step Gate: Step 3 → Step 3.5**

Announce to developer:
> "Domain concepts captured. Before I create any files, let me confirm the SPEC-ID, slug, directory name, and branch name with you (Step 3.5). `/dflow:next` to proceed."

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
>  - slug: `jpy-currency-support` (English following our discussion)
>  - feature directory: `dflow/specs/features/active/SPEC-20260424-002-jpy-currency-support/`
>  - git branch: `feature/SPEC-20260424-002-jpy-currency-support`
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

> **Table-cell formatting**: keep table cells concise — separate multiple short items with `<br>` (never chain them into one line with ；/; separators), and move long narrative detail out of the cell into a document section (full convention: the formatting comment at each spec doc's head).

1. **Create the directory**: `dflow/specs/features/active/{SPEC-ID}-{slug}/`
2. **Create `_index.md`** using `templates/_index.md`:
   - Metadata: fill `spec-id`, `slug`, `status: in-progress`, `created`, `branch`
   - Goals & Scope: 1-3 sentences capturing what / for whom / boundary
   - Phase Specs: one row for the first phase
     (`| 1 | {date} | {slug} | in-progress | [phase-spec-{date}-{slug}.md](./phase-spec-{date}-{slug}.md) |`)
   - Current BR Snapshot: initialise from the first phase's planned BRs
     (will be refreshed when the phase-spec finalises)
   - Lightweight Changes: empty table at start
   - Resume Pointer: "phase-1 in progress: drafting phase-spec." / "Next Action: finish phase-spec, then implement." / cursor fields: Active Workflow `new-feature`, Current Step `Step 4 — write the spec`, Gates Passed `3→3.5`, Awaiting `none (mid-step)`
3. **Create the first phase-spec** at `phase-spec-{YYYY-MM-DD}-{slug}.md`
   using `templates/phase-spec.md`. The "Delta from prior phases" section
   is filled with "首 phase，無前置 Delta" (first phase has nothing to
   delta against).

Guide the developer through each section:

### Behavior Specification (Given/When/Then)
This is the most important part. Help the developer think through scenarios:

```
"Let's walk through the main success scenario first.
Given [initial state], when the user [does action], then [what should happen]?"
```

Then probe for variations:
- "What if [input is invalid]?"
- "What if [related data doesn't exist]?"
- "What happens with [boundary values]?"
- "Are there permission/role requirements?"

### Business Rules
Extract explicit rules from the scenarios:

```
"From what you've described, I see these business rules:
BR-01: [rule]
BR-02: [rule]
Do these capture the logic correctly? Anything I'm missing?"
```

### Edge Cases
Specifically ask about:
- Empty/null inputs
- Concurrent modifications
- Large data volumes
- Currency/decimal precision (if financial)
- Date/timezone boundaries
- Character encoding (CJK, special characters)

**→ Step Gate: Step 4 → Step 5**

Announce to developer:
> "Spec is drafted — behavior scenarios, business rules, and edge cases are captured. Ready to plan the implementation (Domain layer design, interfaces, thin delivery/entrypoint code — presentation/UI layer, controllers, handlers, jobs, message consumers, data pipelines, or stored procedures)? `/dflow:next` or reply 'OK' to continue, or tell me if the spec needs another iteration first."

Wait for confirmation (`/dflow:next`, verbal OK, or implicit — see AI-AGENT-GUIDE.md § Confirmation Signals) before entering Step 5.

## Step 5: Plan the Implementation

### Domain Layer First
Identify what goes into `src/Domain/`:

```csharp
// Example guidance:
// "For this feature, I'd suggest:
//  - A new Value Object: Money(Amount, Currency)
//  - A new interface: IExchangeRateService
//  - A Domain Service: ExpenseCalculationService
//  All framework-pure, no delivery-framework dependencies."
```

### Delivery/Entrypoint Thin Layer
Plan how the current delivery/entrypoint layer will call the Domain layer:

```csharp
// Ideal delivery/entrypoint pattern:
protected void btnSubmit_Click(object sender, EventArgs e)
{
    // 1. Parse UI inputs
    var input = ParseFormInput();

    // 2. Call Domain layer
    var result = _domainService.Process(input);

    // 3. Display result
    BindResult(result);
}
```

### Interface Definitions
For any external dependency (database, API, file system), define an interface
in `src/Domain/{Context}/Interfaces/`:

```csharp
// src/Domain/Expense/Interfaces/IExpenseRepository.cs
public interface IExpenseRepository
{
    ExpenseItem GetById(int id);
    void Save(ExpenseItem item);
}
```

### Generate Implementation Tasks List

After the plan is agreed, AI generates a concrete task list and writes it into the spec's `Implementation Tasks` section (see `templates/phase-spec.md`). Each task follows the format `[LAYER]-[NUMBER]：description`:

- `DOMAIN` — Domain classes, VOs, Services, Interfaces
- `DELIVERY` — Delivery-layer code (entrypoints, controllers, handlers, UI/API adapters)
- `DATA`    — Table schema or Repository impl
- `TEST`    — Test cases

Example seed (replace with feature-specific tasks):

```markdown
- [ ] DOMAIN-1：Create Money value object with currency conversion
- [ ] DOMAIN-2：Define IExchangeRateService interface
- [ ] DELIVERY-1：Thin the relevant delivery/entrypoint code to call the domain service
- [ ] DATA-1：Add ExchangeRate table + Repository
- [ ] TEST-1：Money equality and conversion unit tests
```

The list becomes the execution punch-list for Step 7 and the completion checklist in Step 8.

**→ Transition (step-internal)**: Step 5 complete. Announce "Step 5 complete (implementation plan + task list ready). Entering Step 6: Git Branch." and continue.

## Step 6: Git Branch

After the spec is written and reviewed:

```
Branch naming: feature/{SPEC-ID}-{slug}
Examples:
  feature/SPEC-20260424-002-jpy-currency-support   (English slug)
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
> "Branch `feature/{SPEC-ID}-{description}` is created. Ready to start implementation? `/dflow:next` to proceed, or discuss implementation order / scope first."

> Commit checkpoint (T1 milestone 1 of 3 — see `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI Commits): now that the feature branch exists (the branch gate above ran first, so this commit lands on the feature branch — never on a base branch), offer to commit the spec baseline, then record the result (committed / skipped) in the `_index.md` Checkpoint Log. Milestone 2 = implementation (Step 7→8); milestone 3 = closeout (`/dflow:finish-feature`).

Wait for confirmation before entering Step 7.

## Step 7: Implementation

During implementation, continuously check:
- [ ] Is business logic going into src/Domain/ (not delivery/entrypoint code)?
- [ ] Are new terms in the glossary?
- [ ] Does delivery/entrypoint code only do input parsing, orchestration, and output binding?
- [ ] Are interfaces used for external dependencies?
- [ ] Did we discover any tech debt? → Record in tech-debt.md

**→ Step Gate: Step 7 → Step 8**

Announce to developer:
> "Implementation appears complete. Ready to run the completion checklist (verify against spec, update domain docs, archive the spec)? `/dflow:next` to proceed."

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
- [ ] Domain layer has **no** delivery-framework references (grep `src/Domain/`)
- [ ] *(post-8.3)* `dflow/specs/domain/{context}/behavior.md` contains a section anchor for every `BR-*` introduced by this spec (mechanical input for `/dflow:verify`)
- [ ] *(post-8.3)* `dflow/specs/domain/{context}/rules.md` `last-updated` is later than this spec's `created` date (mechanical drift guard)

If any item fails, report the gap and pause — don't proceed to 8.2.

### 8.2 Verification — needs developer confirmation

AI lists findings one at a time and waits for the developer to confirm each:

- [ ] Does the implementation faithfully express the **intent** of each BR? (AI lists BR → impl location; developer judges fit)
- [ ] Are the edge case handling decisions appropriate? (AI lists EC → handling; developer judges)
- [ ] Did we miss any tech debt worth recording? (AI lists what it saw; developer adds misses)
- [ ] Do the scenarios merged into `behavior.md` faithfully express the intended behavior? (AI lists merged anchors; developer judges)
- [ ] Should the `Implementation Tasks` section in the spec be collapsed / removed now that it's complete? (team convention — developer decides)

Ask these one-by-one; do not dump all five at once.

### 8.3 Documentation updates

> **Table-cell formatting**: keep table cells concise — separate multiple short items with `<br>` (never chain them into one line with ；/; separators), and move long narrative detail out of the cell into a document section (full convention: the formatting comment at each spec doc's head).

- [ ] `dflow/specs/domain/glossary.md` — new terms added
- [ ] `dflow/specs/domain/{context}/models.md` — model definitions updated
- [ ] `dflow/specs/domain/{context}/rules.md` — business rules updated
- [ ] `dflow/specs/domain/{context}/behavior.md` — merge completed spec's Given/When/Then scenarios into consolidated behavior. Sub-steps:
      - Promote any Activity 3 (Spec Writing) draft sections (from B3 mid-sync) to formal sections
      - Update the corresponding `rules.md` anchor's `last-updated` date (B4)
- [ ] `behavior.md` draft cleanup — if the spec was abandoned mid-way, keep the `## 提案中變更` section's history or explicitly REMOVE it
- [ ] `dflow/specs/migration/tech-debt.md` — tech debt discovered during implementation recorded

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
