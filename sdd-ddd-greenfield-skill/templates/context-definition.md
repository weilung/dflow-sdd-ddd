---
context: {ContextName}
chinese-name: {中文名稱}
owner: {負責的開發者或團隊}
created: {YYYY-MM-DD}
---

# {ContextName} Bounded Context

## Responsibilities

> 這個 Context 負責什麼？用 2-3 句話描述。

## Boundaries

### In Scope
- {職責 1}
- {職責 2}

### Out of Scope
- {排除項 1} → 由 {OtherContext} 處理
- {排除項 2} → 由 {OtherContext} 處理

## Core Domain Models

> 詳細定義在 `models.md`，這裡只列出概覽。

### Aggregates
- **{AggregateName}** — {一句話描述}

### Entities
- **{EntityName}** — {一句話描述}

### Value Objects
- **{VOName}** — {一句話描述}

### Domain Services
- **{ServiceName}** — {一句話描述}

### Repository Interfaces
- **{RepositoryName}** — {一句話描述}

## Interactions with Other Contexts

| Other Context | Interaction Type | Description |
|---|---|---|
| {OtherContext} | 呼叫 / 事件 / 共享資料 | {描述} |

## Key Business Rules

> 規則索引在 `rules.md`（BR-ID + 一行摘要），完整 Behavior Scenarios 在 `behavior.md`（Given/When/Then）。這裡只列最重要的幾條。

1. {最重要的規則}
2. {第二重要的規則}

## Code Mapping

### Current Implementation
- Domain: `src/{Project}.Domain/{Context}/`
- Application: `src/{Project}.Application/{Context}/`
- Infrastructure: `src/{Project}.Infrastructure/`

### Architecture Notes
- 依 Clean Architecture dependency direction 維持 Domain 純淨。
