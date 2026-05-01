<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# System Overview — {System Name}

> Created: {YYYY-MM-DD}
> Scope: architectural overview and long-term direction of {System Name}.
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

## Technical Architecture

This project is an ASP.NET Core application built with **Clean
Architecture** and **Domain-Driven Design (DDD)**. Dependencies flow
inward only — the Domain layer is the core and depends on nothing.

### Stack

| Item | Choice |
|------|--------|
| Runtime | .NET {version, e.g. 8} |
| Language | C# {version, e.g. 12} |
| Web framework | ASP.NET Core (Web API / Minimal API — {which}) |
| ORM | Entity Framework Core {version} |
| Mediator | {e.g. MediatR, internal CQRS dispatcher, or none} |
| Validation | {e.g. FluentValidation} |
| Database | {e.g. PostgreSQL 16, SQL Server 2022} |
| Auth | {e.g. JWT bearer, OIDC via Azure AD, cookie auth} |
| Hosting | {e.g. Azure App Service, Kubernetes, Docker compose} |
| Testing | {e.g. xUnit + FluentAssertions + NSubstitute} |

### Clean Architecture Layers

```
Presentation  →  Application  →  Domain  ←  Infrastructure
```

| Layer | Responsibilities | Must NOT |
|-------|------------------|----------|
| Domain | Aggregates, Entities, Value Objects, Domain Events, Domain Services, repository interfaces | Depend on any NuGet package outside allowed list; know about EF Core, HTTP, DI containers |
| Application | Commands / Queries (CQRS), Validators, DTOs, Event Handlers, orchestration | Contain business logic; access database directly |
| Infrastructure | EF Core `DbContext` + configurations, repository implementations, external API clients | Contain business logic |
| Presentation | HTTP endpoints, Request / Response mapping, auth + middleware | Contain business logic; expose Domain objects directly |

### Project Layout

```
src/
├── {Project}.Domain/
│   ├── Common/                # Entity, AggregateRoot, ValueObject base classes
│   ├── {BoundedContext}/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Services/
│   │   ├── Specifications/
│   │   └── Interfaces/        # Repository / external service interfaces
│   └── SharedKernel/
├── {Project}.Application/
│   ├── Common/                # Pipeline behaviors, interfaces (IUnitOfWork, ...)
│   └── {BoundedContext}/
│       ├── Commands/
│       ├── Queries/
│       ├── DTOs/
│       └── EventHandlers/
├── {Project}.Infrastructure/
│   ├── Persistence/           # DbContext + EF Core configurations
│   ├── Repositories/
│   └── ExternalServices/
└── {Project}.WebAPI/          # Presentation layer

tests/
├── {Project}.Domain.UnitTests/
├── {Project}.Application.UnitTests/
└── {Project}.Integration.Tests/
```

---

## Bounded Contexts (Current Map)

{List the current Bounded Contexts in this system. Each entry: name +
one-line responsibility + link to its `dflow/specs/domain/{context}/` folder.
If only one BC exists at adoption time, that is fine — the map grows.}

- **{Context A}** — {responsibility}. See
  [`dflow/specs/domain/{context-a}/`](../domain/{context-a}/).
- **{Context B}** — {responsibility}. See
  [`dflow/specs/domain/{context-b}/`](../domain/{context-b}/).

Full context relationships (upstream / downstream, shared kernel,
anti-corruption layer) are documented in
[`dflow/specs/domain/context-map.md`](../domain/context-map.md).

---

## Principles This Project Adopts

Clean Architecture + DDD is more than a folder layout; the team commits
to the following design habits. Expand / adapt each to this project:

- **Domain at the Center** — Business rules live in `*.Domain`. If you
  find business logic in `*.Application` handlers or (worse) in
  controllers, raise a tech-debt entry.
- **Aggregate Boundaries** — Each transaction modifies exactly one
  Aggregate. Cross-aggregate workflows go through Domain Events.
- **Dependency Inversion** — The Domain declares interfaces; the
  Infrastructure layer implements them. No Domain code imports
  `Microsoft.EntityFrameworkCore`.
- **Ubiquitous Language** — Class / method / variable names come from
  `dflow/specs/domain/glossary.md`. When business language evolves, the
  glossary moves first, code follows.
- **Pragmatic First** — We do not gold-plate. If a feature needs a
  quick fix, record the debt in `dflow/specs/architecture/tech-debt.md` and
  ship.

---

## Architecture Decision Records (ADRs)

Significant architectural choices are recorded as ADRs under
`dflow/specs/architecture/decisions/`. Each ADR captures: decision, context,
alternatives considered, consequences. See the `decisions/` folder's
README (if present) or the ADR convention in {Michael Nygard's ADR
format / MADR / other}.

Initial ADRs that typically exist:

- **ADR-0001** — Choice of ORM / persistence approach
- **ADR-0002** — CQRS + MediatR vs direct handlers
- **ADR-0003** — Auth strategy

---

## Related Documents

- [Spec conventions](_conventions.md)
- [Git principles](Git-principles-{gitflow|trunk}.md) — choose the
  branching-strategy-specific file that matches this project
- [Context map](../domain/context-map.md)
- [Glossary](../domain/glossary.md)
- [Tech debt backlog](../architecture/tech-debt.md)
- [Architecture decisions](../architecture/decisions/)
- Dflow skill: see `CLAUDE.md` and the `sdd-ddd-core-skill/` bundle
  for the full AI workflow guidance.
