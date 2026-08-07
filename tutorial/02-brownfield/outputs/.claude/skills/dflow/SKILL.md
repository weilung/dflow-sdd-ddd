---
name: dflow
description: >
  Dflow SDD/DDD workflow guardian. PRIMARY: the canonical /dflow:* commands
  (/dflow:new-feature, /dflow:modify-existing, /dflow:bug-fix,
  /dflow:new-phase, /dflow:finish-feature, /dflow:pr-review, /dflow:verify,
  /dflow:report-dflow-feedback, /dflow:status, /dflow:next, /dflow:cancel).
  SECONDARY — engage for anything Dflow tracks: a product-visible change, or
  one touching a machine-consumed contract (log/export/API/event, env
  var/CLI flag/exit code), data structure, operational semantics
  (security/CVE, safety, resilience, compliance, payment),
  performance/resource/SLA, BR-ID, or architecture/domain model. Indirect
  phrasings: "I want to build/add ...", "we need to support ...", "users
  should be able to ...". Do NOT engage for behavior-preserving routine work
  touching none of those — refactors, renames, chores, formatting, routine
  dependency bumps — or code questions. When engaged by natural language, DO
  NOT auto-enter a workflow: judge the intent, suggest the matching /dflow:
  command, and wait for confirmation.
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
