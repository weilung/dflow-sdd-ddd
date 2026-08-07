# AGENTS.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

For spec-impacting work — a new feature, a change to product, user-facing, or
domain behavior, a new requirement, or a bug-fix workflow — read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md` — command registry, routing rules, and project context.
- `dflow/specs/shared/dflow-workflows/` — vendored workflow bundle with executable step definitions.

For routine work (refactors, renames, chores, formatting, routine dependency
bumps, or general code questions), proceed normally; you need not read the guide
first. **Routine is narrower than it sounds** — it excludes anything a product
audience perceives (UI, email, exports, public docs such as a product README or
API reference, and operator surfaces like dashboard labels and alerts), where
**size is not the test**: a single-element wording or appearance change still
counts. It also excludes anything touching architecture, data structure, a
machine-consumed contract, a BR-ID, operational semantics (security / CVE,
safety, resilience, compliance, payment), or deliberate performance / resource /
SLA work. When unsure, read the guide's § Ceremony Scaling —
it decides, not this page.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
