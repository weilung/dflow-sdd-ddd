<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Domain Events

> Domain event catalog for one bounded context.

## Event Catalog

| Event name | Producer | Trigger | Payload | Consumers | Delivery expectation |
|---|---|---|---|---|---|
| ExpenseReportSubmitted | ExpenseReport (Aggregate) | `ExpenseReport.Submit()` 成功時，於狀態變為 Submitted 後 raise | `(ExpenseReportId, SubmitterId, SubmittedAt, TotalAmount, SubmitAttemptNo)` | Pending approval read model / phase 2 query handler | in-process（MediatR `INotification`），同 process 同 transaction 內 dispatch |
| ExpenseReportApproved <!-- phase-2 ADDED --> | ExpenseReport (Aggregate) | `ExpenseReport.Approve()` 成功且 ApprovalDecision 建立後 raise | `(ExpenseReportId, SubmitterId, ApproverId, ApprovedAt, SubmitAttemptNo)` | (phase 3 Reimbursement 預期 consumer；phase 2 暫無外部 consumer) | in-process（MediatR `INotification`），同 process 同 transaction 內 dispatch |
| ExpenseReportRejected <!-- phase-2 ADDED --> | ExpenseReport (Aggregate) | `ExpenseReport.Reject()` 成功且 ApprovalDecision 建立後 raise | `(ExpenseReportId, SubmitterId, ApproverId, RejectedAt, Reason, SubmitAttemptNo)` | UI read model / future notification handler | in-process（MediatR `INotification`），同 process 同 transaction 內 dispatch |

## Event Flow Notes

- phase 2 讓 ExpenseReportSubmitted 事件有第一個實際用途：主管待審清單 / read model 可以依 Submitted report 建立查詢資料。
- ExpenseReportApproved / ExpenseReportRejected 是 phase 2 新增的 Domain Events。它們先保持 in-process Domain Event，不升級成 integration event。
- Payload 不含 ExpenseItem 細節（避免 event 太重）；consumer 若需要明細，自行透過 `IExpenseReportRepository.GetById` 重新讀取。
- SubmitAttemptNo 加入事件 payload，讓 ApprovalDecision 與「第幾次 Submit」對齊。Rejected 後重新 Submit 會產生新的 SubmitAttemptNo 與新的 ApprovalDecision。
- 同 process / 同 transaction 內 dispatch：`SaveChanges` 後由 outbox 或 MediatR pipeline behavior 統一發。phase 2 仍可沿用 phase 1 的「SaveChanges 成功後手動 Publish」，phase 3 再評估 outbox。

## Open Questions

- ExpenseReportApproved 是否要在 phase 3 升級為 integration event 給 Reimbursement BC？等財務匯款 spec 啟動時決定。
- ExpenseReportRejected 是否需要 email / Teams notification consumer？phase 2 不做通知，避免跨 BC scope 擴張。
