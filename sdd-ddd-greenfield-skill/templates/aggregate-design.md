---
aggregate: {AggregateName}
bounded-context: {ContextName}
created: {YYYY-MM-DD}
---

# {AggregateName} Aggregate

## Purpose

> 這個 Aggregate 代表什麼業務概念？一句話描述。

## Invariants

> 必須永遠為真的規則。這是 Aggregate 存在的理由。

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

> 為什麼 Aggregate 的邊界劃在這裡？有沒有考慮過其他方案？
