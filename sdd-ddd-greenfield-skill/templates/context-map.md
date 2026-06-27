<!-- Seeded by Dflow. -->

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

## Integration Notes

- {跨 context 的資料流、contract、ACL 或 integration event 設計}

## Open Questions

- {尚未釐清的 context 邊界或 upstream/downstream 關係}
