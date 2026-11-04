# Dflow AI Agent Guide

This project uses Dflow for spec-first AI-assisted development.

## Project Context

| Field | Value |
|---|---|
| Project | ExpenseTracker |
| Dflow track | greenfield |
| Project type | greenfield |
| Tech stack | .NET 9 / C# 13 / ASP.NET Core 9 / EF Core 8 / MediatR 12 / xUnit |
| Migration / legacy context | 純新 build，無 migration 包袱 |
| Prose language | zh-TW |

## Before Editing Code

Do not jump from a request directly to code. First identify the matching
Dflow workflow and confirm the intended path with the developer.

Use these workflow entry points as plain chat instructions if slash commands
are not available in the current AI tool:

| Workflow | Use when |
|---|---|
| `/dflow:new-feature` | Genuinely new work is requested — a newly created navigable surface, a new user-executable domain operation, or a new independently-consumable output. Adding a control to an existing surface — or a menu entry pointing at a route that already exists — is modify-existing. |
| `/dflow:modify-existing` | Existing behavior or an existing surface changes — including adding a presentation / interaction control (copy button, filter, sort, quick-view) to a screen that already exists. |
| `/dflow:bug-fix` | A defect can be described with expected vs actual behavior. |
| `/dflow:new-phase` | An active feature needs another implementation slice. |
| `/dflow:finish-feature` | Implementation is complete and needs drift closure. |
| `/dflow:verify` | A bounded context's domain docs (`rules.md` ↔ `behavior.md`) need a consistency / drift check. |
| `/dflow:pr-review` | A change is ready for SDD/DDD review. |
| `/dflow:report-dflow-feedback` | You found a Dflow issue or improvement and want a sanitized upstream feedback draft. |
| `/dflow:status` | You need the current workflow state, current step, completed work, in-progress work, remaining work, pending decision, and next valid action. |
| `/dflow:next` | An active workflow is waiting at a step gate and the developer confirms continuing to the next step. |
| `/dflow:cancel` | The developer wants to abort the current workflow and return to free conversation without rollback. |

## Status / Control Commands

`/dflow:status` reports active workflow state. Include these fields: workflow,
step, completed, in-progress, remaining, pending decision, and next valid action.
If no workflow is active, say that no workflow is active and list valid flow-entry
or standalone commands.

`/dflow:next` is valid only at a step gate in an active workflow. Treat it as
developer confirmation equivalent to "OK" or "continue", then move to the next
workflow step.

`/dflow:cancel` aborts the current workflow and returns to free conversation.
Do not rollback changes, delete artifacts, or rewrite specs merely because the
workflow was cancelled.

When no workflow is active, `/dflow:next` and `/dflow:cancel` must report that
there is no active workflow to advance or cancel.

## Source of Truth

Dflow-owned project documents live under `dflow/specs/`.

| Area | Path |
|---|---|
| Shared conventions | `dflow/specs/shared/_conventions.md` |
| System overview | `dflow/specs/shared/_overview.md` |
| Domain glossary | `dflow/specs/domain/glossary.md` |
| Context map | `dflow/specs/domain/context-map.md` |
| External systems | `dflow/specs/domain/context-map.md` § External Systems |
| Domain analysis (cross-context) | `dflow/specs/domain/analysis.md` |
| Domain analysis (per context) | `dflow/specs/domain/{context}/analysis.md` |
| Active feature specs | `dflow/specs/features/active/` |
| Completed feature snapshots | `dflow/specs/features/completed/` |
| Technical debt | `dflow/specs/architecture/tech-debt.md` or `dflow/specs/migration/tech-debt.md` |

## Core Rules

1. Spec before code: meaningful behavior changes need a spec or lightweight bug spec before implementation.
2. Keep domain language explicit: update glossary, rules, models, and behavior snapshots when domain meaning changes — for a feature that carries phase-specs, at `/dflow:finish-feature`, from what its phase-specs recorded.
3. Keep phase delta, feature snapshot, and system state separate.
4. Check drift before calling work complete.
5. Follow `dflow/specs/shared/_conventions.md`, especially `## Prose Language`.
6. **Technical Architecture decides the shape of the code.** When `dflow/specs/shared/_overview.md` exists, its § Technical Architecture records this project's choices: the libraries and patterns it uses, the layout, and what each layer may depend on.
   - Where a flow step, checklist or template note names something else, follow Technical Architecture. The flows still decide the steps, gates and documents.
   - When the work needs a choice that Technical Architecture does not record — no `_overview.md`, no row for it, a blank value, a `{…}` placeholder, or a value marked tentative — follow what the existing code already does consistently. When the code does not settle it either, ask the developer, and suggest recording the answer in Technical Architecture. Never treat an example in Dflow's wording or in a placeholder as the project's choice.
   - The Domain's dependencies are the exception: with no allow-list recorded, the Domain depends on nothing beyond the language/runtime baseline.
   - When an accepted ADR you read names a different choice from Technical Architecture, ask the developer which one holds.

## Tool-Specific Notes

This file is the canonical Dflow guide. Root-level files such as
`AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`
should stay thin and point back here.

> **Tutorial fixture note.** This copy is abridged for the walkthrough — it
> shows the shape of an installed guide, not its full text. Sections the
> walkthroughs do not exercise (including § Ceremony Scaling, which carries
> the ordered cascade the tier judgements come from) are present in a real
> `dflow init` output but omitted here. The authoritative text is the
> scaffolding `AI-AGENT-GUIDE.md` of the matching track in the Dflow repo.

If a tool does not support Dflow slash commands, treat the command names as
plain workflow names. A real installed guide contains the runtime behavior
contract and is executed directly; this abridged fixture is for reading.
