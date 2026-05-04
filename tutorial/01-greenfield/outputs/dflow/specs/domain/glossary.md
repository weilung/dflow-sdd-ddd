<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Glossary

> Ubiquitous Language for ExpenseTracker.

## Terms

| Term | Definition | Bounded Context | Code Mapping | Notes |
|---|---|---|---|---|
| ExpenseReport | 員工針對一次出差或一段差旅期間提交的整份費用申請單；內含 1..N 個 ExpenseItem，是核銷流程的主體 Aggregate Root。 | Expense | `ExpenseTracker.Domain.Expense.ExpenseReport` | phase 2 狀態：Draft / Submitted / Approved / Rejected |
| ExpenseItem | 報銷單內單一筆費用項目（例：一張高鐵票、一筆住宿）；金額、發生日期、類別、收據編號為必要欄位。屬於 ExpenseReport 內的 Entity。 | Expense | `ExpenseTracker.Domain.Expense.ExpenseItem` | 不可獨立存在；金額必須 > 0 |
| ApprovalDecision <!-- phase-2 ADDED --> | 主管針對一次 ExpenseReport Submit 做出的核准或退回決定；記錄 Approver、Decision、DecidedAt、Note / Reason。 | Expense | `ExpenseTracker.Domain.Expense.ApprovalDecision` | 一個 Submit attempt 對應一筆 decision；Rejected 後重新 Submit 會產生新 decision |
| Approver <!-- phase-2 UPDATED --> | 負責審核 ExpenseReport 的角色（通常為員工的直屬主管或部門簽核人）。Expense BC 只以 ApproverId 引用，不建模組織階層。 | Expense | `ExpenseTracker.Domain.Expense.EmployeeId` (as ApproverId) | phase 2 已建模為審核行為參與者；主管階層合法性由 Identity / Application 層確認 |
| ApprovalReason <!-- phase-2 ADDED --> <!-- 2026-04-30 lightweight MODIFIED --> | 主管退回 ExpenseReport 時必填的原因文字。 | Expense | `ExpenseTracker.Domain.Expense.ApprovalReason` | 至少 5 個中文字或至少 10 個英數字；空白不計，半形 / 全形視覺等價，emoji 算字；對應 BR-007 |
| Reimbursement | 核銷完成後，財務匯款給員工的動作或紀錄；ExpenseReport 從 Approved 進入後續財務處理。 | Expense / Reimbursement (規劃中) | (尚未建模) | 預留術語，phase 3+ 才落到程式 |

## Open Questions

- Approval policy 若出現金額門檻、代理人、二階主管或 SLA escalation，Approver 的定義可能需要從單純 ID reference 升級成獨立模型或拆出 Approval BC。
- Reimbursement 是否要建模成獨立 Aggregate（ReimbursementBatch）還是 ExpenseReport 的狀態尾端，等 phase 3 跟財務團隊確認。
