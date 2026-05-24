<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# System Overview — {System Name}

> Created: {YYYY-MM-DD}
> Scope: current state and target-architecture direction of {System Name}
> Audience: team members onboarding to the system + AI assistants reading
> `dflow/specs/` for context.

This file is a **project-level starting point**. It does not duplicate
Dflow's workflow rules (see `CLAUDE.md` and the Dflow skill for those) —
it captures the unique context of *this* system so that new engineers (or
AI) can quickly understand what they are working on.

---

## System Summary

{One paragraph: what this system does, who uses it, what business value it
delivers. Keep it non-technical enough that a new hire can skim it in
30 seconds.}

### Business Domain

- **Primary domain**: {e.g. expense management, HR, order processing}
- **Key stakeholders**: {e.g. finance team, HR admins, end-user employees}
- **User scale**: {e.g. ~200 internal users, 5 countries}

---

## Technical Architecture (Current)

This project runs on {Framework}. The SDD/DDD workflow is used to
progressively extract domain logic and prepare for the target architecture
(see "Target Architecture Strategy" below).

| Item | Current |
|------|---------|
| Framework | {Framework} ({Framework version}) |
| Language | {Language} |
| Database | {e.g. SQL Server 2019, MySQL 8.0} |
| ORM / persistence | {ORM / persistence} ({ORM version}) |
| Delivery / entrypoint | {Framework} |
| Auth | {e.g. session auth, OAuth/OIDC, API key, internal SSO} |
| Hosting | {e.g. on-prem VM, container platform, managed app platform} |

### Code Layout (High Level)

> **Note on directory naming**: The tree below uses generic Clean
> Architecture folder names (`src/Domain/`, `src/Delivery/`). Adapt to your
> stack's conventions — for example, Java/Spring `src/main/java/com/example/domain/`,
> Node/TS `src/domain/` + `src/routes/`, Python `domain/` package, Go
> `internal/domain/` + `internal/handler/`, PHP/Laravel `app/Domain/` +
> `app/Http/`, .NET `src/{Project}.Domain/` + `src/{Project}.WebAPI/`
> (separate `.csproj` per layer). For full per-stack examples see
> `docs/examples-by-stack.md`.

```
src/
├── Domain/        # Extracted domain logic (framework-pure; target architecture)
│   ├── {BoundedContext}/
│   └── SharedKernel/
└── Delivery/      # delivery-layer code (entrypoints, controllers, handlers)
```

The `src/Domain/` directory is where business logic lives **as it is
extracted** from delivery/entrypoint code (presentation/UI layer, controllers,
handlers, jobs, message consumers, data pipelines, or stored procedures).
Everything in `src/Domain/` must be framework-pure with no delivery-framework
dependencies (see `CLAUDE.md` and the Dflow skill for the full rule set).

---

## Existing Issues / Known Pain Points

{Optional but strongly recommended for brownfield adoption. List the
top 3–5 known issues the team wants to address as part of migration.
Link each to `migration/tech-debt.md` entries if they exist.}

1. {e.g. Business logic embedded in delivery/entrypoint code; duplicated
   calculations across multiple flows}
2. {e.g. Direct SQL in delivery/entrypoint code; inconsistent error handling}
3. {e.g. Magic numbers / undocumented statuses}

---

## Target Architecture Strategy

This system is being prepared for the project's target architecture. The
strategy follows four principles; expand / adapt each to this project:

- **Migration Awareness** — Every feature decision considers the target
  architecture. We ask "does this make the target architecture harder or easier?"
- **Domain Extraction** — Business logic gradually moves from
  delivery/entrypoint code to `src/Domain/`. Each feature is an
  opportunity to extract a little more.
- **Dual-Track Parallel** — We do not force-rewrite existing code; new
  development preferentially uses the Domain layer, and legacy entrypoints
  get touched only when they are being modified.
- **Pragmatic First** — Target-architecture work does not block feature delivery. If
  a deadline is tight, record the debt in `migration/tech-debt.md`
  and continue.

### Target Architecture

{1-2 sentences describing where this system is heading: e.g. "{Framework}
+ Clean Architecture + {ORM / persistence}, deployed to {hosting platform}."
Link to any ADR or migration plan doc if one exists.}

---

## Related Documents

- [Spec conventions](_conventions.md)
- [Git principles](Git-principles-{gitflow|trunk}.md) — choose the
  branching-strategy-specific file that matches this project
- [Glossary](../domain/glossary.md)
- [Tech debt backlog](../migration/tech-debt.md)
- Dflow skill: see `CLAUDE.md` and the in-project bundle at
  `dflow/specs/shared/dflow-workflows/` for the full AI workflow guidance.
