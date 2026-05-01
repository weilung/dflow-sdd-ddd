<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# System Overview — {System Name}

> Created: {YYYY-MM-DD}
> Scope: current state and migration direction of {System Name}
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

This project runs on ASP.NET WebForms. The SDD/DDD workflow is used to
progressively prepare for migration (see "Migration Strategy" below).

| Item | Current |
|------|---------|
| Framework | ASP.NET WebForms ({.NET Framework version}) |
| Language | C# {version} |
| Database | {e.g. SQL Server 2019, MySQL 8.0} |
| ORM / data access | {e.g. Entity Framework 6, ADO.NET, stored procedures} |
| UI | WebForms Pages + Code-Behind + {CSS framework if any} |
| Auth | {e.g. Forms authentication, Windows auth} |
| Hosting | {e.g. IIS on-prem, Azure App Service} |

### Code Layout (High Level)

```
src/
├── Domain/        # Extracted domain logic (pure C#; migration target)
│   ├── {BoundedContext}/
│   └── SharedKernel/
└── Pages/         # WebForms pages (.aspx + Code-Behind)
```

The `src/Domain/` directory is where business logic lives **as it is
extracted** from Code-Behind. Everything in `src/Domain/` must be pure
C# with no `System.Web` dependencies (see `CLAUDE.md` and the Dflow
skill for the full rule set).

---

## Existing Issues / Known Pain Points

{Optional but strongly recommended for brownfield adoption. List the
top 3–5 known issues the team wants to address as part of migration.
Link each to `migration/tech-debt.md` entries if they exist.}

1. {e.g. Business logic scattered across Code-Behind; duplicated
   calculations in multiple pages}
2. {e.g. Direct SQL in Code-Behind; inconsistent error handling}
3. {e.g. Magic numbers / undocumented statuses}

---

## Migration Strategy

This system is being prepared for migration to ASP.NET Core. The
migration follows four principles; expand / adapt each to this project:

- **Migration Awareness** — Every feature decision considers future
  migration. We ask "does this make the migration harder or easier?"
- **Domain Extraction** — Business logic gradually moves from
  Code-Behind to `src/Domain/`. Each feature is an opportunity to
  extract a little more.
- **Dual-Track Parallel** — We do not force-rewrite existing code; new
  development preferentially uses the Domain layer, and legacy pages
  get touched only when they are being modified.
- **Pragmatic First** — Migration does not block feature delivery. If
  a deadline is tight, record the debt in `migration/tech-debt.md`
  and continue.

### Target Architecture (Post-Migration)

{1-2 sentences describing where this system is heading: e.g. "ASP.NET
Core 8 + Clean Architecture + EF Core, deployed to Azure App Service."
Link to any ADR or migration plan doc if one exists.}

---

## Related Documents

- [Spec conventions](_conventions.md)
- [Git principles](Git-principles-{gitflow|trunk}.md) — choose the
  branching-strategy-specific file that matches this project
- [Glossary](../domain/glossary.md)
- [Tech debt backlog](../migration/tech-debt.md)
- Dflow skill: see `CLAUDE.md` and the `sdd-ddd-webforms-skill/` bundle
  for the full AI workflow guidance.
