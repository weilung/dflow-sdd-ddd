---
name: dflow
description: >
  Dflow SDD/DDD workflow guardian for this project. PRIMARY: the canonical
  /dflow:* commands (/dflow:new-feature, /dflow:modify-existing, /dflow:bug-fix,
  /dflow:new-phase, /dflow:finish-feature, /dflow:pr-review, /dflow:verify,
  /dflow:report-dflow-feedback, /dflow:status, /dflow:next, /dflow:cancel).
  SECONDARY (auto-trigger safety net) — engage ONLY for: adding or changing
  product/domain behavior, new requirements, a feature or bug-fix workflow, or
  spec-impacting architecture/domain-model decisions. Do NOT engage for pure
  refactors, infrastructure chores, formatting, or general code questions.
  When engaged by natural language, DO NOT auto-enter a workflow: judge the
  intent, suggest the matching /dflow: command, and wait for confirmation.
---

<!-- dflow-generated: skill-adapter -->

# Dflow SDD/DDD Workflow Guardian

This project uses Dflow for spec-first AI-assisted development.

When this skill engages:

1. Read `dflow/specs/shared/AI-AGENT-GUIDE.md` — command registry, routing
   rules, and project context.
2. Read the matching workflow flow file from the vendored bundle at
   `dflow/specs/shared/dflow-workflows/references/<flow>.md` for the executable
   step definitions (Step 1→N, step gates, completion checklists).

Do not duplicate or invent workflow steps — the flow files are the authoritative
source for executable steps; the guide is the registry and router.

If engaged by natural language (not an explicit `/dflow:` command): identify
which `/dflow:` command fits, suggest it, and wait for the developer to confirm
before entering any workflow.
