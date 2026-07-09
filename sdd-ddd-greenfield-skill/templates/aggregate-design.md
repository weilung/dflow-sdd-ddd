---
aggregate: {AggregateName}
bounded-context: {ContextName}
created: {YYYY-MM-DD}
---

<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# {AggregateName} Aggregate

## Purpose

> 這個 Aggregate 代表什麼業務概念？一句話描述。

## Invariants

> 必須永遠為真的規則。這是 Aggregate 存在的理由。
> 主體列 **boundary invariants**(需同時看到 Aggregate 內多個物件的狀態才能判的規則)。
> 單一物件可判的 local constraint 不列這裡 — 純格式/必填走 Validator、有 domain
> 語意走 VO / Entity constructor。跨 instance 的規則(唯一性、僅一筆 active)可列,
> 但標 `set-based` 並在 Behavior on Violation 寫明 store-level guard(unique /
> partial index、concurrency token;見 ddd-modeling-guide 的 Invariant
> Classification 與 Set-Based 段)。

| ID | Invariant | Behavior on Violation |
|---|---|---|
| INV-01 | {必須為真的條件} | 拋出 DomainException |
| INV-02 | {必須為真的條件} | 拋出 DomainException |

## Structure

```
{AggregateName} (Aggregate Root)
├── {ChildEntity}       (Entity)
├── {ValueObject1}      (Value Object)
└── {ValueObject2}      (Value Object)
```

## Aggregate Root

| Property | Type | Description |
|---|---|---|
| Id | {AggregateName}Id | 唯一識別 |
| {Property} | {Type} | {說明} |

## State Transition Methods

| Method | Preconditions | Postconditions | Domain Event |
|---|---|---|---|
| {MethodName}() | {必須滿足什麼} | {狀態如何改變} | {EventName} |

## Domain Events

| Event | Trigger | Consumer |
|---|---|---|
| {EventName} | {觸發條件} | {處理者或 Context} |

## Referenced Aggregates (ID only)

| Aggregate | Reference Type | Purpose |
|---|---|---|
| {OtherAggregate} | {OtherAggregate}Id | {為什麼需要引用} |

## Design Decisions

> 為什麼 Aggregate 的邊界劃在這裡？有沒有考慮過其他方案？每個決策附
> **再評估條件**：什麼情況出現時，這個決策應該被重看？（「revisit when …」）
