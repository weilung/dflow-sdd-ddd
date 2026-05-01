<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Domain Events

> Domain event catalog for one bounded context.

## Event Catalog

| Event name | Producer | Trigger | Payload | Consumers | Delivery expectation |
|---|---|---|---|---|---|
| {EventName} | {Aggregate / Application Service} | {觸發條件} | `{Payload shape}` | {consumer names} | {in-process / outbox / integration event / manual} |

## Event Flow Notes

- {事件發生時序、交易邊界、重試或一致性注意事項}

## Open Questions

- {尚未確定的事件命名、payload 或 delivery expectation}
