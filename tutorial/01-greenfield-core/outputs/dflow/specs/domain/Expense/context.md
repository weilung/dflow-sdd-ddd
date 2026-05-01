---
context: Expense
chinese-name: 費用申報
owner: 差旅費用平台小組
created: 2026-04-28
last-updated: 2026-04-29
---

# Expense Bounded Context

## Responsibilities

負責員工差旅 / 公務費用申報資料的整個生命週期：建立草稿、加入費用項、提交給主管審核、主管核准 / 退回、（後續 phase）核銷狀態追蹤。Expense BC 是「費用單據」與其審核結果的真實來源。

## Boundaries

### In Scope
- 建立、編輯、提交 ExpenseReport
- 管理 ExpenseReport 內的 ExpenseItem（新增 / 修改 / 移除）
- ExpenseReport 狀態機：Draft → Submitted → Approved / Rejected；Rejected 可重編後再次 Submit
- 記錄主管審核決定：ApprovalDecision（一個 Submit attempt 對應一筆 decision）
- 發布 ExpenseReportSubmitted / ExpenseReportApproved / ExpenseReportRejected Domain Events

### Out of Scope
- 通知 email / Slack / Teams（後續 Notification concern）
- 審核 SLA timer / escalation（後續若需求成熟再評估是否獨立 BC）
- 核銷匯款（規劃中，phase 3）→ 由 Reimbursement BC（暫定）處理
- 員工身分管理 / 主管階層 / 代理人設定 → 由 Identity BC（外部，暫不建模）處理
- 收據影像儲存 → 由 Infrastructure 層的 file storage adapter 處理，Domain 只持有 receipt reference

## Core Domain Models

> 詳細定義在 `models.md`，這裡只列出概覽。

### Aggregates
- **ExpenseReport** — 一份費用申報單，內含 1..N 個 ExpenseItem，是核銷流程的主體 Aggregate Root
- **ApprovalDecision** — phase 2 新增；主管對一次 Submit 做出的審核決定，保存稽核軌跡

### Entities
- **ExpenseItem** — ExpenseReport 內的單筆費用項目

### Value Objects
- **Money** — 金額 + 幣別（MVP 先固定 TWD，但用 VO 預留多幣別擴充）
- **ReceiptReference** — 收據編號 / 檔案參照（Domain 不存影像，只持參照）
- **ExpenseCategory** — 費用類別（高鐵、住宿、餐費…）
- **ApprovalReason** — 退回原因；Reject 時必填，至少 10 字元

### Domain Services
- _(phase 2 仍無 Domain Service；審核規則可由 ExpenseReport + ApprovalDecision 自身處理)_

### Repository Interfaces
- **IExpenseReportRepository** — ExpenseReport 的持久化抽象（Domain 定義介面，Infrastructure 實作）
- **IApprovalDecisionRepository** — ApprovalDecision 的持久化抽象；查詢同一 Submit attempt 是否已有 decision

## Interactions with Other Contexts

| Other Context | Interaction Type | Description |
|---|---|---|
| Identity (外部) | ID reference / Application-layer lookup | Expense BC 持有 SubmitterId / ApproverId；Domain 層只強制 `SubmitterId != ApproverId`，主管階層合法性由 Application 層查 Identity / org graph |
| Reimbursement (規劃中) | 事件（ExpenseReportApproved） | phase 3 起可能訂閱核准事件啟動匯款流程 |

## Key Business Rules

> 規則索引在 `rules.md`（BR-ID + 一行摘要），完整 Behavior Scenarios 在 `behavior.md`（Given/When/Then）。這裡只列最重要的幾條。

1. ExpenseReport 提交時必須至少含 1 個 ExpenseItem（BR-001）
2. 提交後狀態變為 Submitted，不可再編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（BR-002）
3. 主管不可審核自己提交的 ExpenseReport（BR-005）
4. 只有 Submitted 的 ExpenseReport 能被 Approve / Reject（BR-006）
5. Reject 必須附註原因（BR-007）

## Boundary Decisions

### Approval 留在 Expense BC（phase 2 decided）

phase 1 的未決問題是「Approval 是新 BC 還是 Expense 內另一 Aggregate？」phase 2 決定：**留在 Expense BC 內，新增 ApprovalDecision Aggregate**。

理由：
- phase 2 審核仍緊密圍繞 ExpenseReport 生命週期，不是獨立業務能力。
- 目前沒有多階簽核、代理人、SLA、政策引擎或跨組織任務池。
- 拆 BC 會過早引入整合邊界，增加小團隊實作成本。

重新評估觸發條件：未來若 Approval policy 出現金額門檻、二階主管、代理簽核、SLA escalation 或跨系統審核任務，再重新評估是否拆出 Approval BC。

## Code Mapping

### Current Implementation
- Domain: `src/ExpenseTracker.Domain/Expense/`
- Application: `src/ExpenseTracker.Application/Expense/`
- Infrastructure: `src/ExpenseTracker.Infrastructure/Expense/`

### Architecture Notes
- 依 Clean Architecture dependency direction 維持 Domain 純淨。
- ExpenseReport 與 ApprovalDecision 都是 Aggregate Root；兩者透過 ID reference 關聯，不互相持有完整物件圖。
- Money / ReceiptReference / ExpenseCategory / ApprovalReason 為 immutable record VOs，建構式驗證。
