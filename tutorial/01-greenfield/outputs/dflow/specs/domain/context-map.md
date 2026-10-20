<!-- dflow-shape: greenfield/context-map.md 2 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Context Map

> Bounded context relationship map for the ExpenseTracker Core architecture.

## Contexts

| Bounded Context | Responsibility | Subdomain Type | Owner / Team | Primary Module | Notes |
|---|---|---|---|---|---|
| Expense | 員工的費用申報資料生命週期：建立 / 編輯 / 提交 / 審核 / 後續核銷狀態追蹤的 ExpenseReport 主體。 | `core` | 差旅費用平台小組 | `ExpenseTracker.Domain.Expense` | 由 SPEC-20260428-001 建立；phase 2 決定 ApprovalDecision 留在 Expense BC |

## Relationships

| Upstream | Downstream | Relationship Type | Published Language | ACL | Events |
|---|---|---|---|---|---|

## External Systems

| External System | Data Exchanged | Direction | Mechanism | Timing | Used By | Notes |
|---|---|---|---|---|---|---|
| Identity <!-- phase-2 ADDED --> | EmployeeId / ApproverId | in | OIDC claims（由外部 SSO 提供） | — | Expense（Reference data / conformist；Domain 只接收 IDs） | 能力屬 `generic`：本系統不建模、不做戰術建模<br>Owner：公司 SSO / HR master data owner<br>負責員工身分、主管階層、部門與授權資料<br>Expense 只引用 SubmitterId / ApproverId，不持有組織模型<br>Events：_(none)_ |
| Identity <!-- phase-2 ADDED --> | supervisor relation | in | Application Layer 查 Identity / org graph（本系統發起） | 檢查 Approver 是否為 Submitter 的主管時（BR-005） | Expense（Reference data / conformist；ACL：Application Layer lookup） | Owner、`generic` 同上一列<br>Events：_(none)_ |

> **External System** — a system this project does not build or deploy (another team's service, a vendor or government API, a database or file another system owns) that one of this system's bounded contexts exchanges data with. Write one row per exchange: a different direction, mechanism or timing is another row, while one exchange takes one row however many contexts use it — list every one of them in Used By. Every row names at least one context in Used By, so a change to a row is a change to those contexts; an integration no context uses (logging, monitoring, deployment tooling) is not recorded here. Direction is the way the business data moves, seen from this system; which side starts the exchange goes in Mechanism. Keep external systems out of the tables above: they name only this system's bounded contexts.

## Integration Notes

- phase 2 的 BR-005（主管不可審核自己提交的 ExpenseReport）讓 Identity 資料變得相關，但 Expense Domain 層只強制 `SubmitterId != ApproverId`。真正的「Approver 是否為 Submitter 的主管」由 Application Layer 查 Identity / org graph。
- ApprovalDecision 不拆出 Approval BC；因此沒有 Expense → Approval 的跨 context relationship。
- ExpenseReportApproved 可能在 phase 3 成為 Reimbursement BC 的 upstream event，目前先保持 Expense BC 內的 Domain Event。

## Open Questions

- 若未來需要金額門檻、多階簽核、代理人或 SLA escalation，是否要拆出 Approval BC？phase 2 決策是先留在 Expense BC，未來再檢視。
- Reimbursement（財務匯款）跨組織邊界（差旅平台小組 → 財務系統），預期是獨立 BC 並透過 integration event 整合，但細節未定。
- Identity 的 OIDC claims 什麼時候取得？原本的紀錄沒寫，改寫成 External Systems 時沒有推測，待確認。
