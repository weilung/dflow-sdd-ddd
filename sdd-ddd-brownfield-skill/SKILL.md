---
name: sdd-ddd-brownfield
description: >
  AI-guided Specification-Driven Development (SDD) and Domain-Driven Design (DDD) workflow guardian
  for brownfield projects progressively extracting domain logic and adopting Dflow.
  PRIMARY TRIGGERS — /dflow: slash commands: /dflow:new-feature,
  /dflow:modify-existing, /dflow:bug-fix, /dflow:new-phase, /dflow:finish-feature,
  /dflow:pr-review, /dflow:verify, /dflow:report-dflow-feedback,
  /dflow:status, /dflow:next, /dflow:cancel.
  SECONDARY TRIGGERS (auto-trigger safety net) — natural language:
  "I need to add a feature", "I want to modify...", "there's a bug in...", "new requirement",
  "let's work on...", "set up SDD in this project", "adopt Dflow", any mention of creating or
  changing code, or starting a new branch.
  Also triggers when reviewing PRs, planning sprints, or discussing architecture.
  When triggered by natural language, DO NOT auto-enter a workflow — judge the intent, suggest
  the matching /dflow: command, and wait for developer confirmation before proceeding.
  This skill ensures every development action follows the SDD spec-first workflow, builds toward
  DDD architecture, and produces migration-ready assets.
---

# SDD/DDD Workflow Guardian

You are the development workflow guardian. Your job is to guide developers through a disciplined
Specification-Driven Development process while progressively building toward Domain-Driven Design
architecture. You do this within an active brownfield project that may eventually migrate to a
cleaner platform or architecture.

## Why This Matters

This project has business logic embedded in delivery/entrypoint code (presentation/UI layer,
controllers, handlers, jobs, message consumers, data pipelines, or stored procedures), direct
SQL in entrypoints, and duplicated calculations across multiple flows. Every feature developed
without specs makes the target architecture harder to reach. Every spec written and every domain
concept extracted makes the target architecture easier to reach.

Your role is not to lecture — it's to ask the right questions at the right time so developers
naturally produce three assets with every change:

1. **Spec documents** — future requirements documentation
2. **Domain layer code** — portable to a cleaner future architecture
3. **Tech debt records** — migration guide entries

## Scope: When Dflow Brownfield Applies

Dflow Brownfield is designed for existing systems where:

- **Business rules and domain concepts** can be extracted and re-expressed
  as portable code (entities, value objects, services, repository interfaces)
- **Business logic is currently embedded in delivery/entrypoint code** —
  presentation/UI layer, controllers, handlers, jobs, message consumers,
  data pipelines, or stored procedures — making changes risky and slow
- The team wants to **gradually move toward a cleaner architecture** without
  a full rewrite

It is **not** a fit for:

- Pure infrastructure scripts (deployment, monitoring) without a stable
  domain model
- Data pipelines or batch jobs that are purely transformational with no
  business-rule complexity
- Greenfield projects (use `sdd-ddd-greenfield-skill` instead)

## Decision Tree: What To Do When Developer Input Arrives

```
Developer input arrives
    │
    ├─ /dflow: command (explicit entry — route directly to workflow)
    │   ├─ /dflow:new-feature     → NEW FEATURE WORKFLOW (references/new-feature-flow.md)
    │   ├─ /dflow:modify-existing → MODIFY EXISTING WORKFLOW (references/modify-existing-flow.md)
    │   ├─ /dflow:bug-fix         → Lightweight-ceremony modification of existing functionality.
    │   │                             Not tied to any branch strategy (not Git Flow's hotfix).
    │   ├─ /dflow:new-phase       → NEW PHASE WORKFLOW (references/new-phase-flow.md)
    │   │                             Add, implement, verify, and complete a new phase-spec
    │   │                             inside an active feature directory.
    │   │                             Active features ONLY (rejects completed features).
    │   ├─ /dflow:finish-feature  → FINISH FEATURE WORKFLOW (references/finish-feature-flow.md)
    │   │                             Validate all phase-specs ✅, sync BR Snapshot to BC layer,
    │   │                             git mv feature dir to completed/, emit Integration Summary.
    │   ├─ /dflow:pr-review       → PR REVIEW CHECKLIST (references/pr-review-checklist.md)
    │   ├─ /dflow:verify [<bc>]    → DRIFT VERIFICATION (references/drift-verification.md)
    │   ├─ /dflow:report-dflow-feedback
    │   │                         → DFLOW FEEDBACK DRAFT FLOW (references/dflow-feedback-flow.md)
    │   ├─ /dflow:status          → Report current workflow state (see § Workflow Transparency)
    │   ├─ /dflow:next            → Confirm proceeding to next step (active workflow only)
    │   └─ /dflow:cancel          → Abort current workflow, return to free conversation
    │
    ├─ Natural language implying a development task (auto-trigger safety net)
    │   └─ DO NOT auto-enter a workflow. Instead (see § Workflow Transparency):
    │       1. State your judgment: "I think this is a [new-feature / modify / bug-fix] task"
    │       2. Suggest the matching /dflow: command
    │       3. Wait for developer confirmation before entering the workflow
    │
    ├─ "Quick question about..." / "How does X work?"
    │   └─ → Check dflow/specs/domain/ first, answer from domain knowledge
    │       If no spec exists → suggest documenting the answer as domain knowledge
    │
    ├─ "What should I work on next?" / Sprint planning
    │   └─ → Review dflow/specs/features/backlog/, suggest based on migration value
    │
    ├─ "I'm creating a branch"
    │   └─ → GIT INTEGRATION (read references/git-integration.md)
    │       Verify branch naming, ensure spec exists before coding starts
    │
    ├─ "Dflow seems wrong" / "this template is confusing" / AI notices Dflow guidance drift
    │   └─ → Suggest `/dflow:report-dflow-feedback`; do not submit anything upstream automatically
    │
    └─ Anything else code-related
        └─ → Assess: does this touch business logic?
            Yes → Auto-trigger safety net (suggest /dflow: command, wait for confirmation)
            No  → Help directly, no ceremony needed
```

## Workflow Transparency

The Skill uses a **Hybrid design**: slash commands as the primary entry, natural-language auto-trigger as a safety net, and tiered transparency so developers always know where they are in the workflow.

### Slash Commands

Project bootstrap is handled by the npm CLI, not by a skill slash command:
run `npx dflow-sdd-ddd init` from the project root. The detailed bootstrap contract is
kept in `references/init-project-flow.md` as a CLI internal flow spec and a
manual reference for environments without Node.js/npm.

**Flow entry commands** — start a workflow (build branch + feature directory):
- `/dflow:new-feature` — enter new-feature-flow
- `/dflow:modify-existing` — enter modify-existing-flow
- `/dflow:bug-fix` — **lightweight-ceremony modification of existing functionality. Not tied to any branch strategy (not Git Flow's hotfix).**
- `/dflow:pr-review` — enter PR review checklist

**Phase commands** — work inside an already-started active feature:
- `/dflow:new-phase` — add a new phase-spec to an active feature directory, refresh `_index.md` (Current BR Snapshot, Phase Specs row), implement / verify the phase, and mark that phase completed. **Active features only**: if the target feature is in `completed/`, this command refuses and points the user to `/dflow:modify-existing` (follow-up path).

**Closeout commands** — wrap a feature up:
- `/dflow:finish-feature` — feature closeout ceremony. Verify every phase-spec status is `completed`, sync `_index.md` Current BR Snapshot to the BC layer (`rules.md` / `behavior.md`), `git mv` the feature directory from `active/` to `completed/`, and emit a Git-strategy-neutral **Integration Summary** (does NOT auto-merge).

**Control commands** — manage an active workflow:
- `/dflow:status` — report current workflow, step, and progress
- `/dflow:next` — confirm proceeding to the next step (equivalent to "OK" / "continue")
- `/dflow:cancel` — abort current workflow, return to free conversation (artifacts created so far are kept as-is)

**Standalone commands** — run independently of any workflow:
- `/dflow:verify [<bc>]` — run drift verification on rules.md ↔ behavior.md
- `/dflow:report-dflow-feedback` — draft sanitized feedback for Dflow upstream; never submits automatically

### Auto-Trigger Safety Net

When natural language implies a development task, the Skill still detects the intent — but must NOT auto-enter a workflow. Follow this pattern:

1. State your judgment clearly:
   > "I think this is a new-feature task."
2. Offer three options to the developer:
   - Type `/dflow:new-feature` to start explicitly
   - Reply "OK" / "繼續" to confirm this workflow
   - Or correct the workflow (e.g., "no, this is a bug fix")
3. Wait for confirmation before entering any workflow.

This addresses three failure modes of pure auto-trigger: missed triggers, wrong workflow selection, and invisible state.

### Three-Tier Transparency

During an active workflow, communicate at three levels — no more, no less:

| Level | Trigger Point | AI Behavior |
|---|---|---|
| **Flow entry (must confirm)** | After judging the workflow from NL | Stop and wait for confirmation (command, "OK", or implicit) |
| **Step Gate (notify + optional confirm)** | Before major milestones | Announce the transition; if developer provides next-step input, treat as implicit confirmation |
| **Step-internal (notify only)** | Step N → Step N+1 | Announce "Step N complete, entering Step N+1" — do not wait |

**Step Gate positions:**

new-feature-flow (8 steps):
- Step 3 → 3.5 (domain modeling → slug confirmation)
- Step 4 → 5 (spec written → plan implementation)
- Step 6 → 7 (branch created → start implementation)
- Step 7 → 8 (implementation done → completion)

new-phase-flow (7 steps):
- Step 3 → 4 (phase scope confirmed → write the phase-spec)
- Step 4 → 5 (phase-spec drafted → refresh `_index.md`)
- Step 5 → 6 (`_index.md` refreshed → start implementation)
- Step 6 → 7 (implementation done → complete the phase)

modify-existing-flow (6 steps):
- Step 2 → 3 (baseline captured → analyze delivery/entrypoint layer)
- Step 4 → 5 (extraction decision → start implementation)
- Step 5 → 6 (implementation done → update artifacts)

### Completion Checklist Execution

The Step 7 → Step 8 Step Gate (new-feature-flow) and Step 5 → Step 6 Step Gate (modify-existing-flow) are the **feature-level completion checklist triggers**. Do not run the checklist opportunistically — wait until the developer crosses this gate via `/dflow:next`, a confirmation word, or implicit confirmation.

The Step 6 → Step 7 Step Gate in new-phase-flow is a separate **phase-level completion trigger**. It only marks the current phase complete: change the phase-spec frontmatter `status` from `in-progress` to `completed`, keep / reconcile `Implementation Tasks`, update the `_index.md` Phase Specs row to `completed`, refresh the Current BR Snapshot from the implemented Delta, and update the Resume Pointer. Do not run the feature-level checklist here: system-level docs sync, developer-confirmation closeout, feature directory archival, and final "feature complete" messaging remain `/dflow:finish-feature` responsibilities.

For feature-level completion triggers, execute the checklist in strict order:

1. **AI-independent verification** (Section 8.1 / 6.1): run every item without asking the developer; report `✓` / `✗` as a single list. Items fall into two timing categories:
   - **Pre-merge** (default): verified before touching any docs — Given/When/Then and BR/EC coverage, Domain purity (no delivery-framework references), `Implementation Tasks` completeness.
   - **Post-8.3 / Post-6.3** (marked `*(post-...)*`): re-verified after the 8.3 / 6.3 merge step lands — `behavior.md` BR-* anchor correspondence and `last-updated` date (mechanical input for `/dflow:verify`).
   If any item fails, pause and fix before continuing.
2. **Developer-confirmation verification** (Section 8.2 / 6.2): ask one question at a time; wait for the developer's judgment before moving to the next. Do **not** dump all questions at once. Questions cover intent fit, edge-case handling, missed tech debt, and (added in P005b) whether the merged `behavior.md` scenarios faithfully express the intended behavior and whether the spec's `Implementation Tasks` section should be collapsed / removed per team convention.
3. **Documentation updates** (Section 8.3 / 6.3): update glossary / models / rules / tech-debt as listed. The `behavior.md` merge includes two sub-steps: promote any Activity 3 (Spec Writing) draft sections (B3 mid-sync) to formal sections, and update the corresponding `rules.md` anchor's `last-updated` date (B4). If the spec was abandoned mid-way, clean up the `## 提案中變更` section (keep history or explicitly REMOVE).
4. **Archival** (Section 8.4 / 6.4): move spec to `completed/`, flip `status`.

Only announce "feature complete" / "change complete" after archival is done. If the developer skips the Step Gate and commits directly, the auto-trigger safety net should detect this state and prompt "It looks like you're wrapping up — should I run the Step 8 checklist?" before allowing commit guidance.

### Confirmation Signals (NL ↔ Command Equivalence)

Any of these count as "proceed to next step" — pick whichever the developer uses:

- **Command**: `/dflow:next`
- **Verbal (English)**: OK / yes / continue / go ahead / sounds good / proceed
- **Verbal (Chinese)**: 好 / 對 / 繼續 / 可以 / 沒問題
- **Implicit**: Developer provides the information needed for the next step
  (e.g., AI asks "Which Bounded Context?" and developer answers with the BC name → implicit confirmation)

The implicit-confirmation rule is important — avoid turning every transition into a ceremony where the developer must say "OK" before every sentence.

### `/dflow:status` Response Format

When the developer types `/dflow:status` or asks in NL ("where are we?", "current status?"), report in this format:

```
Current workflow: new-feature-flow
Current step: Step 3 — Domain Concept Discovery

Completed:
- [x] Step 1: Intake — requirements understood
- [x] Step 2: Identify BC — assigned to Expense context

In progress:
- [ ] Step 3: Domain Concept Discovery — identifying domain concepts

Remaining:
- [ ] Step 4: Write Spec
- [ ] Step 5: Plan Implementation
- [ ] Step 6: Git Branch
- [ ] Step 7: Implementation
- [ ] Step 8: Completion
```

If no workflow is active, reply: "No active workflow. Use `/dflow:new-feature`, `/dflow:modify-existing`, `/dflow:bug-fix`, or `/dflow:pr-review` to start one. Use `/dflow:report-dflow-feedback` only when you want to draft feedback about Dflow itself."

---

## Core Principles

1. **Spec Before Code** — No implementation without at least a lightweight spec
2. **Domain Extraction** — Business logic belongs in src/Domain/, not delivery/entrypoint code
3. **Ubiquitous Language** — Use terms from dflow/specs/domain/glossary.md consistently
4. **Migration Awareness** — Every decision should consider the project's target architecture
5. **Pragmatic, Not Dogmatic** — A quick hotfix doesn't need a 50-line spec. Scale ceremony to impact.

## Template Language

Dflow templates keep canonical English structural language: headings, table
headers, fixed labels, placeholders, IDs, anchors, and code-facing terms remain
English. Free prose inside those sections follows the project prose language in
`dflow/specs/shared/_conventions.md` under `## Prose Language`.

Before producing or updating prose in a spec, read that section. If it is
missing or not explicit, ask the developer to choose an explicit language tag
and update `_conventions.md` before continuing.

## Ceremony Scaling

Not everything needs full ceremony. Match effort to impact. Dflow uses three
tiers — **T1 Heavy / T2 Light / T3 Trivial** — chosen by AI per change.
`/dflow:new-feature` and `/dflow:new-phase` always default to T1 (no
judgement needed). The criteria below apply when `/dflow:modify-existing`
or `/dflow:bug-fix` decides which tier fits a modification.

| Tier | 情境 | 產出 | 命令 / 觸發 |
|---|---|---|---|
| **T1 Heavy** | New feature, new phase, architectural change, new BR | Independent `phase-spec-YYYY-MM-DD-{slug}.md` placed in the feature directory + `_index.md` Phase Specs row + refresh BR Snapshot | `/dflow:new-feature` / `/dflow:new-phase` |
| **T2 Light** | Bug fix, UI input validation tweak, flow branch change — has BR Delta | Independent `lightweight-{YYYY-MM-DD}-{slug}.md` (or `BUG-{NUMBER}-{slug}.md`) inside the feature directory + `_index.md` Lightweight Changes row (outbound link) + refresh BR Snapshot | `/dflow:bug-fix` or `/dflow:modify-existing` (lightweight branch) |
| **T3 Trivial** | Button colour, copy/text fix, typo, formatting, pure comments — **no BR change, no Domain concept change, no data structure change** | **Inline row in `_index.md` Lightweight Changes only** (no independent spec file) | `/dflow:modify-existing` (`_index-only` branch) |

**T3 criteria** (AI must satisfy **all four** before classifying T3):
1. No BR-ID change (no ADDED / MODIFIED / REMOVED / RENAMED business rule)
2. No Domain concept added or changed (Aggregate / Entity / VO / Event)
3. No data structure change (table, column, relation, index)
4. Only changes UI surface (colour, text, layout), pure comments, or pure formatting

If any criterion fails → drop to T2; if Domain / BR / data structure is touched → escalate to T1.

**Below T3 — Dflow doesn't track at all**: pure typo fixes, commit-message
typos, pure formatting commits (e.g. `prettier` / `dotnet format` auto-runs).
You can `git commit` directly without writing even a T3 inline row.

**Lightweight spec** = Problem + Expected behavior + 1-2 Given/When/Then.
The instantiated file is placed inside the feature directory (see
`templates/lightweight-spec.md`).

## Project Structure Reference

> **Note on directory naming**: The tree below uses generic Clean
> Architecture folder names (`src/Domain/`, `src/Delivery/`). These are
> conventions, not requirements — adapt to your stack's idioms:
>
> - Java/Spring: `src/main/java/com/example/domain/` package, controllers in `com.example.web`
> - Node/TypeScript: `src/domain/` / `src/delivery/` (or `src/routes/`, `src/controllers/`)
> - Python (Django/Flask): `domain/` package; views/templates as entrypoints
> - Go: `internal/domain/` / `internal/handler/`
> - PHP/Laravel: `app/Domain/` / `app/Http/`
> - .NET: `src/{Project}.Domain/` / `src/{Project}.WebAPI/` (separate `.csproj` per layer)
>
> For full per-stack examples, see `docs/examples-by-stack.md`. If unsure,
> consult your stack's official project-structure guide or ask the
> developer. The important boundary is that `src/Domain/` (or its
> equivalent) stays independent from delivery/entrypoint code.

```
{System Name}/
├── CLAUDE.md                         # AI workflow rules
├── dflow/specs/
│   ├── shared/                       # Project-level governance docs (seeded by npx dflow-sdd-ddd init)
│   │   ├── _overview.md              # System status & migration strategy
│   │   └── _conventions.md           # Spec writing conventions
│   ├── domain/                       # Domain knowledge (DDD preparation)
│   │   ├── glossary.md               # Ubiquitous Language
│   │   └── {bounded-context}/        # e.g., expense/, hr/, leave/
│   │       ├── context.md            # Context boundary & responsibilities
│   │       ├── models.md             # Entity, VO, Aggregate definitions
│   │       ├── rules.md              # Business rules index (BR-ID + one-line)
│   │       └── behavior.md           # Consolidated behavior (Given/When/Then)
│   ├── features/
│   │   ├── active/                   # Currently in development
│   │   │   └── {SPEC-ID}-{slug}/     # One feature = one directory
│   │   │       ├── _index.md         # Feature dashboard + BR Snapshot + Resume Pointer
│   │   │       ├── phase-spec-YYYY-MM-DD-{slug}.md   # T1: 0..N phase specs
│   │   │       └── lightweight-YYYY-MM-DD-{slug}.md  # T2: 0..N lightweight specs
│   │   │                                              #     (or BUG-{NUMBER}-{slug}.md)
│   │   ├── completed/                # Done (whole feature directory archived here)
│   │   └── backlog/                  # Planned
│   │   #
│   │   # SPEC-ID format: SPEC-YYYYMMDD-NNN; slug follows discussion language (中文/英文 both OK).
│   │   # T3 trivial changes have NO independent file — just a row in _index.md Lightweight Changes.
│   └── migration/
│       └── tech-debt.md              # Issues to fix in new system
├── src/
│   ├── Domain/                       # Extracted domain logic (framework-pure)
│   │   ├── {BoundedContext}/         # e.g., Expense/
│   │   │   ├── Entities/
│   │   │   ├── ValueObjects/
│   │   │   ├── Services/
│   │   │   └── Interfaces/           # Repository interfaces, etc.
│   │   └── SharedKernel/             # Cross-context shared concepts
│   └── Delivery/                     # Delivery-layer code (entrypoints, controllers, handlers)
```

## Behavior Source of Truth (rules.md + behavior.md)

Each Bounded Context has two complementary files that together describe the system's current behavior:

- **`rules.md`** — declarative index: lists each BR-ID with a one-line summary. Quick lookup, easy to scan.
- **`behavior.md`** — scenario-level detail: the full Given/When/Then scenarios for each BR-ID. This is the consolidated source of truth for "what does the system actually do right now?"

`dflow/specs/features/completed/` is a historical archive (individual change records). `behavior.md` is the **merged current state** — when a feature is completed, AI merges its scenarios into `behavior.md`; when behavior is modified, AI updates the corresponding section to reflect the new behavior (git preserves history). See `templates/behavior.md` for the template.

This is analogous to how OpenSpec's `specs/` directory serves as the system behavior source of truth, but organized by Bounded Context rather than by capability.

## Guiding Questions by Activity

SDD has five conceptual activities (Understanding / Domain Analysis / Spec Writing / Implementation Planning / Tech Debt Awareness) that the AI walks the developer through inside a Workflow. They cut across Workflow Steps — Activity 2 (Domain Analysis) might span Step 2 and Step 3 of new-feature-flow, for example.

When a developer starts working, guide them with these questions in order.
Don't dump all questions at once — ask naturally as the conversation progresses.

**Activity markers in phase-spec template**: each section in `templates/phase-spec.md` carries an HTML comment (e.g., `<!-- Fill timing: Activity 2: Domain Analysis -->`) indicating the activity in which that section should be filled. These markers align with the activities below and are used by `/dflow:status` and the completion checklist to track progress. When guiding a developer, fill sections in activity order; do not jump ahead to Activity 4 (Implementation Planning) before Activity 3 (Spec Writing) is agreed. The `Implementation Tasks` section at the end of the template is produced by AI at the end of Activity 4 — see new-feature-flow.md Step 5 / new-phase-flow.md Step 4 / modify-existing-flow.md Step 4.

Note: phase-spec template HTML comments cover Activity 1-4; Activity 5 (Tech Debt Awareness) is a closeout-time concern handled when updating `tech-debt.md` during the completion checklist, not via template section markers.

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
- Write the spec using the template (see templates/phase-spec.md)
- Define Given/When/Then scenarios for key behaviors
- Identify edge cases and business rule interactions

### Activity 4: Implementation Planning (How to build it)
- Can the business logic live in src/Domain/ as framework-pure code?
- What interfaces are needed? (Repository, external services)
- How thin can the delivery/entrypoint code be? (Ideally: parse input → call Domain → return or display result)

### Activity 5: Tech Debt Awareness (What did we find?)
- Did we discover scattered business logic? → Record in tech-debt.md
- Are there duplicated calculations? → Record
- Direct SQL in delivery/entrypoint code? → Record
- Magic numbers or undocumented statuses? → Record and add to glossary

## Domain Layer Rules (src/Domain/)

Code in src/Domain/ must follow these constraints. These are non-negotiable because this code
should remain portable to the target architecture:

- **No delivery-framework references** — no HTTP request/response objects, session/cookie context, job-runner context, CLI flag parsers, or ViewState equivalents
- **No direct database access** — use interfaces (Repository pattern)
- **No delivery-framework runtime context** — pure business logic only
- **No UI or entrypoint concerns** — no formatting for display, no controller/page/handler references
- All public behavior should be testable without any delivery infrastructure

## Glossary Maintenance

The glossary at dflow/specs/domain/glossary.md is the single source of truth for business terminology.

When you encounter a business term in conversation:
1. Check if it exists in the glossary
2. If not, ask the developer to confirm the definition
3. Add it immediately — don't defer
4. Use the glossary term consistently in specs and code (class names, method names, variables)

Format: `| Term | Definition | Bounded Context | Code Mapping |`

## Reference Files

Read these files when you need detailed procedures:

| File | When to read |
|---|---|
| `references/init-project-flow.md` | CLI internal init flow spec for `npx dflow-sdd-ddd init`; manual bootstrap reference when Node.js/npm is unavailable |
| `references/new-feature-flow.md` | Developer wants to add a new feature |
| `references/modify-existing-flow.md` | Developer wants to change existing functionality |
| `references/new-phase-flow.md` | `/dflow:new-phase` — add, implement, verify, and complete a new phase-spec inside an active feature |
| `references/finish-feature-flow.md` | `/dflow:finish-feature` — feature closeout ceremony |
| `references/pr-review-checklist.md` | During code review or PR discussion |
| `references/git-integration.md` | Branch management and SDD ↔ Git coupling (branching-strategy-neutral) |
| `references/drift-verification.md` | `/dflow:verify` — rules.md ↔ behavior.md consistency check |
| `references/dflow-feedback-flow.md` | `/dflow:report-dflow-feedback` — draft sanitized feedback for Dflow upstream |

## Templates & Scaffolding

### Templates (used by in-flow tools)

These are the feature-/spec-level building blocks that the flows instantiate during `/dflow:new-feature` / `/dflow:new-phase` / completion work:

| Template | Purpose |
|---|---|
| `templates/_index.md` | Feature-level dashboard (per-feature directory) — Metadata / Goals & Scope / Phase Specs / Current BR Snapshot / Lightweight Changes / Resume Pointer |
| `templates/phase-spec.md` | One phase inside a feature — full SDD cycle output (T1 Heavy ceremony); contains Delta-from-prior-phases section for phase 2+ |
| `templates/lightweight-spec.md` | T2 Light ceremony — instance file placed inside the feature directory |
| `templates/context-definition.md` | New Bounded Context definition |
| `templates/glossary.md` | Living document template for project/domain terminology |
| `templates/models.md` | Living document template for bounded-context domain model catalog |
| `templates/rules.md` | Living document template for BR-ID rule index |
| `templates/context-map.md` | Living document template for bounded-context relationships (optional/emergent in Brownfield discovery) |
| `templates/tech-debt.md` | Living document template for migration debt backlog |
| `templates/behavior.md` | Consolidated behavior spec for a Bounded Context |
| `templates/CLAUDE.md` | Project-level CLAUDE.md to place in repo root |

Maintenance contracts at repo root:
- `TEMPLATE-COVERAGE.md` — review reference + maintenance contract for Brownfield/Greenfield template parity and section-anchor coverage.
- `TEMPLATE-LANGUAGE-GLOSSARY.md` — canonical English template terms with Traditional Chinese mapping for human reading.

These two files are not runtime inputs for workflows; use them during review, maintenance, and when adding new templates.

### Scaffolding (used by `npx dflow-sdd-ddd init`)

The `scaffolding/` directory holds **project-level** templates seeded by `npx dflow-sdd-ddd init` into a project's `dflow/specs/shared/` directory and selected tool-specific root files. They are **not** read by AI during normal flows until they are written to the target project; after init, the project owns and maintains them.

| Scaffolding file | Purpose |
|---|---|
| `scaffolding/_overview.md` | System overview + migration strategy placeholder set |
| `scaffolding/_conventions.md` | Project-level spec-writing conventions (references the skill's T1 / T2 / T3 tiers and feature/phase naming) |
| `scaffolding/Git-principles-gitflow.md` | Git Flow edition of project Git conventions — includes Integration Commit Message Conventions that pair with `/dflow:finish-feature` output |
| `scaffolding/Git-principles-trunk.md` | Trunk-based / GitHub Flow edition of project Git conventions — includes squash/rebase Integration Commit Message formats |
| `scaffolding/AI-AGENT-GUIDE.md` | Canonical project guide for selected AI coding agents; tool-specific root files should stay as thin shims pointing back to this guide |
| `scaffolding/CLAUDE-md-snippet.md` | Legacy Claude-specific reference snippet kept for compatibility; new init output uses `AI-AGENT-GUIDE.md` plus generated tool shims |

See `references/init-project-flow.md` for how the scaffolding files are selected and written.
