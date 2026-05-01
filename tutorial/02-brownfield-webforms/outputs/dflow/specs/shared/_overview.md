<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# System Overview — OrderManager

> Created: 2026-04-29
> Scope: current state and migration direction of OrderManager
> Audience: team members onboarding to the system + AI assistants reading
> `dflow/specs/` for context.

This file is a **project-level starting point**. It does not duplicate
Dflow's workflow rules (see `CLAUDE.md` and the Dflow skill for those) —
it captures the unique context of *this* system so that new engineers (or
AI) can quickly understand what they are working on.

---

## System Summary

OrderManager 是公司內部的 B2B 訂單管理系統，支援約 200 家活躍經銷商下訂單、查庫存、追蹤出貨與收發票。內部業務、倉儲、財務與客服也依賴這套系統處理訂單生命週期。

### Business Domain

- **Primary domain**: B2B 訂單管理、庫存協調、出貨與發票流程
- **Key stakeholders**: B2B 經銷商、業務團隊、倉儲團隊、財務團隊、客服團隊
- **User scale**: 約 200 家活躍經銷商；內部跨部門使用者

---

## Technical Architecture (Current)

This project runs on ASP.NET WebForms. The SDD/DDD workflow is used to
progressively prepare for migration (see "Migration Strategy" below).

| Item | Current |
|------|---------|
| Framework | ASP.NET WebForms (.NET Framework 4.8) |
| Language | C# 7.x era codebase |
| Database | SQL Server 2019 |
| ORM / data access | Entity Framework 6 + Stored Procedures + some ADO.NET wrappers |
| UI | WebForms Pages + Code-Behind + jQuery + Bootstrap 3 |
| Auth | Existing enterprise authentication <!-- TODO: confirm exact mechanism --> |
| Hosting | IIS with existing release pipeline <!-- TODO: confirm environments --> |

### Code Layout (High Level)

```
OrderManager/
├── OrderManager.Web/
│   ├── Pages/
│   │   ├── Order/
│   │   ├── Customer/
│   │   ├── Inventory/
│   │   ├── Shipment/
│   │   └── Invoice/
│   └── App_Code/
├── OrderManager.DataAccess/
│   ├── Entities/
│   ├── Repositories/
│   └── StoredProcedures/
├── tests/
│   └── OrderManager.IntegrationTests/
└── src/
    └── Domain/        # To be created gradually by Dflow modify-existing work
```

The `src/Domain/` directory is where business logic lives **as it is
extracted** from Code-Behind. Everything in `src/Domain/` must be pure
C# with no `System.Web` dependencies (see `CLAUDE.md` and the Dflow
skill for the full rule set).

---

## Existing Issues / Known Pain Points

1. Business logic is scattered across Code-Behind event handlers,
   especially `OrderEntry.aspx.cs`.
2. Unit test coverage is effectively missing for Domain rules; most
   confidence comes from integration tests and manual regression.
3. Stored Procedures contain heavy joins and business decisions that
   are hard to trace back to requirements.
4. New features often touch multiple pages and create regression risk.
5. The team needs specs to become the source of truth for future .NET
   Core migration.

See [`../migration/tech-debt.md`](../migration/tech-debt.md) for
the baseline migration debt backlog.

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
  a deadline is tight, record the debt in `dflow/specs/migration/tech-debt.md`
  and continue.

### Migration Context Note

OrderManager cannot pause feature delivery for a big-bang rewrite. The
target direction is a future ASP.NET Core system with a portable Domain
layer, but Dflow adoption starts inside the existing WebForms codebase.
The first migration asset is not code; it is reliable specs describing
current behavior and business rules.

### Target Architecture (Post-Migration)

The long-term target is ASP.NET Core + a DDD-friendly layered structure
where Domain logic is pure C# and can be tested without WebForms,
`System.Web`, ViewState, Session, or database infrastructure.

---

## Related Documents

- [Spec conventions](_conventions.md)
- [Git principles](Git-principles-gitflow.md)
- [Glossary](../domain/glossary.md)
- [Tech debt backlog](../migration/tech-debt.md)
- Dflow skill: see `CLAUDE.md` and the `sdd-ddd-webforms-skill/` bundle
  for the full AI workflow guidance.
