<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Context Map

> Optional bounded context relationship map for Brownfield discovery.

## Context List

| Bounded Context | Responsibility | Subdomain Type | Owner / Team | Primary Code Area | Notes |
|---|---|---|---|---|---|
| {Context name} | {業務責任} | core / supporting / generic | {owner} | `{project/path/or/namespace}` | {optional notes} |

> **Subdomain Type** — 判別問句:「這塊功能換成現成 SaaS / 套件,系統的差異化會消失嗎?」
> (差異化不限商業競爭優勢;內部系統指獨特的營運優勢 / 任務成果。)會 → `core`;
> 不會、但需要為自家流程客製 → `supporting`(必要、常需客製、非差異化);
> 不會、且現成方案存在 → `generic`。多數 BC 是 supporting,`core` 通常只有 1–2 個;
> 全標 core = 沒分類。分類是可修訂的初判,改判時更新本欄並在 Notes 留一行理由。
> 它影響漸進抽離的取捨(`generic` 傾向整塊替換而非逐條抽離,見 modify-existing-flow
> Step 4),但**不**降低 BR 紀錄、Tier ceremony、或安全 / 測試 / 可靠性要求。

## Relationships

| Source Context | Target Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|---|
| {Source} | {Target} | {Customer/Supplier, Conformist, ACL, Shared Kernel, Separate Ways, Big Ball of Mud (BBoM), OHS, etc.} | {DB table, service call, file, manual process} | {optional notes} |

## Integration Notes

- {跨 context 的資料流、權責邊界或 legacy coupling}

## Open Questions

- {尚未釐清的 context 邊界或整合責任}
