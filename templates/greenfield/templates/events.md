<!-- Seeded by Dflow. -->

# Domain Events

> Domain event catalog for one bounded context.

## Event Catalog

| Event name | Producer | Trigger | Payload | Consumers | Delivery expectation |
|---|---|---|---|---|---|
| {EventName} | {Aggregate / Application Service} | {觸發條件} | `{Payload shape}` | {consumer names} | {in-process / outbox / integration event / manual} |

## Event Flow Notes

- {事件發生時序、交易邊界、重試或一致性注意事項;跨 aggregate 的 async(eventual
  consistency)event chain,handler 重試耗盡的最終失敗若造成 business-visible 後果
  (補償/權益/金流/庫存/合規/人工對帳)→ 升級為 BR/EC 寫進 behavior.md 與 spec,
  best-effort 副作用(通知/logging)記這裡或 tech-debt 即可;多步驟且失敗需補償
  → 見 ddd-modeling-guide 的 Long-Running Processes 段(process 判準與階梯)}

## Open Questions

- {尚未確定的事件命名、payload 或 delivery expectation}
