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
| `/dflow:new-feature` | A new user-visible capability or business behavior is requested. |
| `/dflow:modify-existing` | Existing behavior needs to change. |
| `/dflow:bug-fix` | A defect can be described with expected vs actual behavior. |
| `/dflow:new-phase` | An active feature needs another implementation slice. |
| `/dflow:finish-feature` | Implementation is complete and needs drift closure. |
| `/dflow:verify` | Specs, domain docs, implementation, and tests need consistency checks. |
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
| Active feature specs | `dflow/specs/features/active/` |
| Completed feature snapshots | `dflow/specs/features/completed/` |
| Technical debt | `dflow/specs/architecture/tech-debt.md` or `dflow/specs/migration/tech-debt.md` |

## Core Rules

1. Spec before code: meaningful behavior changes need a spec or lightweight bug spec before implementation.
2. Keep domain language explicit: update glossary, rules, models, and behavior snapshots when domain meaning changes.
3. Keep phase delta, feature snapshot, and system state separate.
4. Check drift before calling work complete.
5. Follow `dflow/specs/shared/_conventions.md`, especially `## Prose Language`.

## Tool-Specific Notes

This file is the canonical Dflow guide. Root-level files such as
`AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md`
should stay thin and point back here.

If a tool does not support Dflow slash commands, treat the command names as
plain workflow names. This guide contains the installed runtime behavior
contract; execute the workflow semantics defined here directly.
