# New Feature Workflow

Step-by-step guide for when a developer triggers `/dflow:new-feature` (or natural language implying a new-feature task — see SKILL.md § Workflow Transparency for the auto-trigger safety net behavior).

**Phase Gates** in this flow (stop-and-confirm before proceeding):
- Step 3 → Step 3.5 (domain concepts captured → confirm slug + directory + branch names)
- Step 4 → Step 5 (spec written → plan implementation)
- Step 6 → Step 7 (branch ready → start implementation)
- Step 7 → Step 8 (implementation done → completion)

All other step transitions are **step-internal**: announce "Step N complete, entering Step N+1" and proceed without waiting. See SKILL.md § Workflow Transparency for the full transparency protocol and confirmation signals.

**Ceremony**: this flow always defaults to **T1 Heavy** — the first phase of a brand-new feature is by definition a full SDD cycle. Tier judgement (T1 / T2 / T3) only applies to `/dflow:modify-existing` (see `references/modify-existing-flow.md` and SKILL.md § Ceremony Scaling).

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

**→ Transition (step-internal)**: Step 2 complete. Announce "Step 2 complete (BC identified). Entering Step 3: Domain Concept Discovery." and continue.

## Step 3: Domain Concept Discovery

Walk through these questions:

- **What are the key nouns?** → Potential Entities or Value Objects
- **What are the key verbs?** → Potential Domain Services or Entity behaviors
- **What are the rules/constraints?** → Business Rules to document
- **What are the states/statuses?** → State machines to model
- **What external data is needed?** → Interfaces to define

For each new concept:
1. Check glossary — add if missing
2. Check if it already exists in models.md — extend if needed
3. If entirely new, add to the appropriate context's models.md

If foundational domain docs are missing, create them from templates before writing content:
- `dflow/specs/domain/glossary.md` → `templates/glossary.md`
- `dflow/specs/domain/{context}/models.md` → `templates/models.md`
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`

**→ Phase Gate: Step 3 → Step 3.5**

Announce to developer:
> "Domain concepts captured. Before I create any files, let me confirm the SPEC-ID, slug, directory name, and branch name with you (Step 3.5). `/dflow:next` to proceed."

Wait for confirmation before entering Step 3.5.

## Step 3.5: Slug Confirmation

AI proposes the SPEC-ID, slug, feature directory path, and branch name in
one message and asks the developer to confirm before any directory or
branch is created. Slug follows the language of the discussion (中文 or
English — both are valid; see `references/git-integration.md` for the slug
language rule).

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

1. **Create the directory**: `dflow/specs/features/active/{SPEC-ID}-{slug}/`
2. **Create `_index.md`** using `templates/_index.md`:
   - Metadata: fill `spec-id`, `slug`, `status: in-progress`, `created`, `branch`
   - Goals & Scope: 1-3 sentences capturing what / for whom / boundary
   - Phase Specs: one row for the first phase
     (`| 1 | {date} | {slug} | in-progress | [phase-spec-{date}-{slug}.md](./phase-spec-{date}-{slug}.md) |`)
   - Current BR Snapshot: initialise from the first phase's planned BRs
     (will be refreshed when the phase-spec finalises)
   - Lightweight Changes: empty table at start
   - Resume Pointer: "phase-1 in progress: drafting phase-spec." / "Next Action: finish phase-spec, then implement."
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

**→ Phase Gate: Step 4 → Step 5**

Announce to developer:
> "Spec is drafted — behavior scenarios, business rules, and edge cases are captured. Ready to plan the implementation (Domain layer design, interfaces, thin Code-Behind)? `/dflow:next` or reply 'OK' to continue, or tell me if the spec needs another iteration first."

Wait for confirmation (`/dflow:next`, verbal OK, or implicit — see SKILL.md § Confirmation Signals) before entering Step 5.

## Step 5: Plan the Implementation

### Domain Layer First
Identify what goes into `src/Domain/`:

```csharp
// Example guidance:
// "For this feature, I'd suggest:
//  - A new Value Object: Money(Amount, Currency)
//  - A new interface: IExchangeRateService
//  - A Domain Service: ExpenseCalculationService
//  All pure C#, no WebForms dependencies."
```

### Code-Behind Thin Layer
Plan how the WebForms page will call the Domain layer:

```csharp
// Ideal Code-Behind pattern:
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
- `PAGE`    — Code-Behind / ASPX changes
- `DATA`    — Table schema or Repository impl
- `TEST`    — Test cases

Example seed (replace with feature-specific tasks):

```markdown
- [ ] DOMAIN-1：Create Money value object with currency conversion
- [ ] DOMAIN-2：Define IExchangeRateService interface
- [ ] PAGE-1：Thin ExpenseForm.aspx.cs to call domain service
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

**→ Phase Gate: Step 6 → Step 7**

Announce to developer:
> "Branch `feature/{SPEC-ID}-{description}` is created. Ready to start implementation? `/dflow:next` to proceed, or discuss implementation order / scope first."

Wait for confirmation before entering Step 7.

## Step 7: Implementation

During implementation, continuously check:
- [ ] Is business logic going into src/Domain/ (not Code-Behind)?
- [ ] Are new terms in the glossary?
- [ ] Does Code-Behind only do UI binding?
- [ ] Are interfaces used for external dependencies?
- [ ] Did we discover any tech debt? → Record in tech-debt.md

**→ Phase Gate: Step 7 → Step 8**

Announce to developer:
> "Implementation appears complete. Ready to run the completion checklist (verify against spec, update domain docs, archive the spec)? `/dflow:next` to proceed."

Wait for confirmation before entering Step 8. This phase gate is where the completion checklist is triggered — do not skip.

## Step 8: Completion

Triggered by the Step 7 → Step 8 Phase Gate. AI runs the completion checklist in the order below; do **not** skip a section.

### 8.1 Verification — AI runs independently

AI reports `✓` / `✗` for every item before touching docs. Items marked *(post-8.3)* are re-verified after the documentation merge in 8.3 lands:

- [ ] `Implementation Tasks` section: all tasks checked, or unchecked items explicitly labelled as follow-up (linked to spec / tech-debt entry)
- [ ] Every `Given/When/Then` scenario in the spec is covered by implementation or tests
- [ ] Every `BR-*` business rule is covered by implementation or tests
- [ ] Every `EC-*` edge case is handled
- [ ] Domain layer has **no** `System.Web` references (grep `src/Domain/`)
- [ ] *(post-8.3)* `dflow/specs/domain/{context}/behavior.md` contains a section anchor for every `BR-*` introduced by this spec (mechanical input for `/dflow:verify`)
- [ ] *(post-8.3)* `dflow/specs/domain/{context}/behavior.md` `last-updated` is later than this spec's `created` date (mechanical drift guard)

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

- [ ] `dflow/specs/domain/glossary.md` — new terms added
- [ ] `dflow/specs/domain/{context}/models.md` — model definitions updated
- [ ] `dflow/specs/domain/{context}/rules.md` — business rules updated
- [ ] `dflow/specs/domain/{context}/behavior.md` — merge completed spec's Given/When/Then scenarios into consolidated behavior. Sub-steps:
      - Promote any Phase 3 draft sections (from B3 mid-sync) to formal sections
      - Update the corresponding `rules.md` anchor's `last-updated` date (B4)
- [ ] `behavior.md` draft cleanup — if the spec was abandoned mid-way, keep the `## 提案中變更` section's history or explicitly REMOVE it
- [ ] `dflow/specs/migration/tech-debt.md` — tech debt discovered during implementation recorded

### 8.4 Archival

For a single-phase feature, this is the closeout point. For a multi-phase
feature, the developer typically reaches this point at the end of the
final phase — at which time `/dflow:finish-feature` is the recommended
trigger (it bundles steps 8.1 / 8.2 verification, BC sync, and archival
into one explicit ceremony). Either path is acceptable; pick the one
that matches the developer's habit.

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
