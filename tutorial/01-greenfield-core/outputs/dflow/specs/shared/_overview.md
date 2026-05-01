<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# System Overview — ExpenseTracker

> Created: 2026-04-28
> Scope: architectural overview and long-term direction of ExpenseTracker.
> Audience: team members onboarding to the system + AI assistants reading
> `dflow/specs/` for context.

This file is a **project-level starting point**. It does not duplicate
Dflow's workflow rules (see `CLAUDE.md` and the Dflow skill for those) —
it captures the unique context of *this* system so that new engineers (or
AI) can quickly understand what they are working on.

---

## System Summary

ExpenseTracker 是公司內部的**企業差旅費用申報與核銷**系統：員工在出差後提交差旅費用申報，直屬主管審核並核准，財務團隊則進行核銷匯款。系統取代以試算表為主的流程，目標是讓財務從提交到銀行轉帳都有可稽核的軌跡。

### Business Domain

- **Primary domain**: 企業差旅費用申報與核銷（公司差旅費用申報與核銷）
- **Key stakeholders**: {e.g. 出差員工、直屬主管、財務團隊、稽核}
  <!-- TODO: 與 PO 確認 stakeholder 細節 -->
- **User scale**: {e.g. ~200 內部員工、單一公司}
  <!-- TODO: 第一輪規格收斂前補上 -->

---

## Technical Architecture

This project is an ASP.NET Core application built with **Clean
Architecture** and **Domain-Driven Design (DDD)**. Dependencies flow
inward only — the Domain layer is the core and depends on nothing.

### Stack

| Item | Choice |
|------|--------|
| Runtime | .NET 9 |
| Language | C# 13 |
| Web framework | ASP.NET Core 9 (Web API) |
| ORM | Entity Framework Core 8 |
| Mediator | MediatR 12 |
| Validation | {e.g. FluentValidation} <!-- TODO: 確認 validator 選型 --> |
| Database | {e.g. SQL Server 2022} <!-- TODO: 與 infra 團隊確認 --> |
| Auth | {e.g. JWT bearer / Azure AD OIDC} <!-- TODO --> |
| Hosting | {e.g. Azure App Service / on-prem IIS} <!-- TODO --> |
| Testing | xUnit |

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
├── ExpenseTracker.Domain/
│   ├── Common/                # Entity, AggregateRoot, ValueObject base classes
│   ├── {BoundedContext}/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Services/
│   │   ├── Specifications/
│   │   └── Interfaces/        # Repository / external service interfaces
│   └── SharedKernel/
├── ExpenseTracker.Application/
│   ├── Common/                # Pipeline behaviors, interfaces (IUnitOfWork, ...)
│   └── {BoundedContext}/
│       ├── Commands/
│       ├── Queries/
│       ├── DTOs/
│       └── EventHandlers/
├── ExpenseTracker.Infrastructure/
│   ├── Persistence/           # DbContext + EF Core configurations
│   ├── Repositories/
│   └── ExternalServices/
└── ExpenseTracker.WebAPI/     # Presentation layer

tests/
├── ExpenseTracker.Domain.UnitTests/
├── ExpenseTracker.Application.UnitTests/
└── ExpenseTracker.Integration.Tests/
```

---

## Bounded Contexts (Current Map)

{List the current Bounded Contexts in this system. Each entry: name +
one-line responsibility + link to its `dflow/specs/domain/{context}/` folder.
If only one BC exists at adoption time, that is fine — the map grows.}

<!-- TODO: 第一個 BC 由 /dflow:new-feature Step 8.3 baseline capture 建立後補入 -->

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

- **Domain at the Center** — Business rules live in `ExpenseTracker.Domain`. If you
  find business logic in `ExpenseTracker.Application` handlers or (worse) in
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
<!-- TODO: 第一個 ADR 真正出現時再決定 ADR 格式偏好 -->

Initial ADRs that typically exist:

- **ADR-0001** — Choice of ORM / persistence approach
- **ADR-0002** — CQRS + MediatR vs direct handlers
- **ADR-0003** — Auth strategy

---

## Related Documents

- [Spec conventions](_conventions.md)
- [Git principles](Git-principles-trunk.md)
- [Context map](../domain/context-map.md)
- [Glossary](../domain/glossary.md)
- [Tech debt backlog](../architecture/tech-debt.md)
- [Architecture decisions](../architecture/decisions/)
- Dflow skill: see `CLAUDE.md` and the `sdd-ddd-core-skill/` bundle
  for the full AI workflow guidance.
