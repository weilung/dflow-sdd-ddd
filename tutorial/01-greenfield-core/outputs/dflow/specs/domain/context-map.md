<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Context Map

> Bounded context relationship map for the ExpenseTracker Core architecture.

## Contexts

| Bounded Context | Responsibility | Owner / Team | Primary Module | Notes |
|---|---|---|---|---|
| Expense | 員工的費用申報資料生命週期：建立 / 編輯 / 提交 / 審核 / 後續核銷狀態追蹤的 ExpenseReport 主體。 | 差旅費用平台小組 | `ExpenseTracker.Domain.Expense` | 由 SPEC-20260428-001 建立；phase 2 決定 ApprovalDecision 留在 Expense BC |
| Identity (external) <!-- phase-2 ADDED --> | 員工身分、主管階層、部門與授權資料。 | 公司 SSO / HR master data owner | external service / OIDC claims | Expense BC 只引用 SubmitterId / ApproverId，不持有組織模型 |

## Relationships

| Upstream | Downstream | Relationship Type | Published Language | ACL | Events |
|---|---|---|---|---|---|
| Identity (external) | Expense | Reference data / conformist | EmployeeId / ApproverId / supervisor relation | Application Layer lookup；Domain 只接收 IDs | _(none)_ |

## Integration Notes

- phase 2 的 BR-005（主管不可審核自己提交的 ExpenseReport）讓 Identity 資料變得相關，但 Expense Domain 層只強制 `SubmitterId != ApproverId`。真正的「Approver 是否為 Submitter 的主管」由 Application Layer 查 Identity / org graph。
- ApprovalDecision 不拆出 Approval BC；因此沒有 Expense → Approval 的跨 context relationship。
- ExpenseReportApproved 可能在 phase 3 成為 Reimbursement BC 的 upstream event，目前先保持 Expense BC 內的 Domain Event。

## Open Questions

- 若未來需要金額門檻、多階簽核、代理人或 SLA escalation，是否要拆出 Approval BC？phase 2 決策是先留在 Expense BC，未來再檢視。
- Reimbursement（財務匯款）跨組織邊界（差旅平台小組 → 財務系統），預期是獨立 BC 並透過 integration event 整合，但細節未定。
