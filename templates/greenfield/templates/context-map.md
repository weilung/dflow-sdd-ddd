<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Context Map

> Bounded context relationship map for the Core architecture.

## Contexts

| Bounded Context | Responsibility | Owner / Team | Primary Module | Notes |
|---|---|---|---|---|
| {Context name} | {業務責任} | {owner} | `{module/project}` | {optional notes} |

## Relationships

| Upstream | Downstream | Relationship Type | Published Language | ACL | Events |
|---|---|---|---|---|---|
| {Upstream context} | {Downstream context} | {Customer/Supplier, Conformist, ACL, Shared Kernel, etc.} | {shared terms / contract} | {Yes/No + location} | {event names or n/a} |

## Integration Notes

- {跨 context 的資料流、contract、ACL 或 integration event 設計}

## Open Questions

- {尚未釐清的 context 邊界或 upstream/downstream 關係}
