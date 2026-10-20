<!-- dflow-shape: greenfield/context-map.md 2 — keep this line: dflow doctor reads it -->
<!-- This template is part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE in the Dflow package, or dflow/specs/shared/dflow-workflows/LICENSE in a project. Documents written from it are yours: do not copy this line into them. -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Context Map

> Bounded context relationship map for the Core architecture.

## Contexts

| Bounded Context | Responsibility | Subdomain Type | Owner / Team | Primary Module | Notes |
|---|---|---|---|---|---|
| {Context name} | {業務責任} | core / supporting / generic | {owner} | `{module/project}` | {optional notes} |

> **Subdomain Type** — 判別問句:「這塊功能換成現成 SaaS / 套件,系統的差異化會消失嗎?」
> (差異化不限商業競爭優勢;內部系統指獨特的營運優勢 / 任務成果。)會 → `core`;
> 不會、但需要為自家流程客製 → `supporting`(必要、常需客製、非差異化);
> 不會、且現成方案存在 → `generic`。多數 BC 是 supporting,`core` 通常只有 1–2 個;
> 全標 core = 沒分類。分類是可修訂的初判,改判時更新本欄並在 Notes 留一行理由。
> 它決定建模深度(見 `references/ddd-modeling-guide.md`
> § Subdomain-Aware Modeling Depth),但**不**降低 BR 紀錄、Tier ceremony、
> 或安全 / 測試 / 可靠性要求。

## Relationships

| Upstream | Downstream | Relationship Type | Published Language | ACL | Events |
|---|---|---|---|---|---|
| {Upstream context} | {Downstream context} | {Customer/Supplier, Conformist, ACL, Shared Kernel, Separate Ways, Big Ball of Mud (BBoM), OHS, etc.} | {shared terms / contract} | {Yes/No + location} | {event names or n/a} |

## External Systems

| External System | Data Exchanged | Direction | Mechanism | Timing | Used By | Notes |
|---|---|---|---|---|---|---|
| {system name} | {what passes between the two systems} | in / out / both | {API call, file transfer, shared database, message queue, manual process; which side starts it} | {on each request, nightly, yearly, on demand} | {each context that uses this exchange, and how: ACL, Conformist, ...} | {owner or contact; where the integration code lives; any value no other cell holds} |

> **External System** — a system this project does not build or deploy (another team's service, a vendor or government API, a database or file another system owns) that one of this system's bounded contexts exchanges data with. Write one row per exchange: a different direction, mechanism or timing is another row, while one exchange takes one row however many contexts use it — list every one of them in Used By. Every row names at least one context in Used By, so a change to a row is a change to those contexts; an integration no context uses (logging, monitoring, deployment tooling) is not recorded here. Direction is the way the business data moves, seen from this system; which side starts the exchange goes in Mechanism. Keep external systems out of the tables above: they name only this system's bounded contexts.

## Integration Notes

- {沒有先後順序也成立的跨 context 資料交換、contract、ACL 或 integration event 設計；有先後順序的跨 context 交手流程記在 analysis.md}

## Open Questions

- {尚未釐清的 context 邊界或 upstream/downstream 關係}
