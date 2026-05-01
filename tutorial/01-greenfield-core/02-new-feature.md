# /dflow:new-feature — Alice 啟動「員工提交費用單」

## 劇情背景

接續上午跑完 `npx dflow-sdd-ddd init`（見 [01-init-project.md](01-init-project.md)），Alice 花了大概 30 分鐘掃過 `_overview.md`，把 stakeholders（差旅員工、部門主管、財務）、預估 user scale（公司全體 ~100 人，年度差旅 ~2000 筆）、DB（PostgreSQL 16）、Auth（公司 SSO via OIDC）、Hosting（Azure App Service）這幾欄補完，順手 commit 一發 `[INIT] fill in _overview.md placeholders`。

中午吃飽回來，repo 結構清爽，但 `dflow/specs/features/active/` 還空著，`dflow/specs/domain/` 只有兩份 placeholder。她決定下午專心開第一個 feature：**員工提交費用單（Employee Submit Expense Report）**。這是整個 ExpenseTracker 最核心、也最簡單的入口——員工出差回來能在系統內把單據建好、提交給主管。後面的「主管審核」「財務匯款」她已經放進腦中的 backlog，但這個 phase 想刻意收斂到只做「員工端的提交動作」。

她在 IDE 開啟 Claude Code，輸入指令。

## 完整對話

> **Alice**：午安。`_overview.md` 那幾個 placeholder 我填好 commit 了。現在準備開第一個 feature。`/dflow:new-feature`

> **Dflow**：好，`/dflow:new-feature` 走的是 T1 Heavy 流程——第一個 phase 一定是完整 SDD 循環。先進 Step 1 intake，三個問題：
>
> 1. **What's the feature?** 平實描述就好。
> 2. **Who needs it?** 哪個 stakeholder 或 user role？
> 3. **Why now?** 為什麼是現在做？
>
> 我同時會去掃一下 `dflow/specs/domain/` 看有沒有相關概念能引用。

> **Alice**：
> 1. 員工出差或公務結束後，能在系統內建一份費用申報單、加幾筆費用項（高鐵、住宿之類）、送出給主管審核。
> 2. 內部所有會出差或有零星公務支出的員工——主要 stakeholder 是差旅頻繁的業務 / RD / 採購；附帶的下游 stakeholder 是部門主管和財務。但 phase 1 我只想做「員工端的提交」，主管 / 財務後面再說。
> 3. 現在做是因為這是整個 ExpenseTracker 最核心的入口，沒這個其他流程都沒上游資料。我也想用這個 feature 把 Expense 這個 BC 的骨架立起來，後面 phase 才有東西延伸。

> **Dflow**：清楚。我掃過 `dflow/specs/domain/`：
> - `glossary.md` — 還是 init-project 留下的 placeholder（術語表是空的，但 TODO 註記提到 ExpenseReport / ExpenseItem / Approver / Reimbursement 是預期要進來的核心術語）
> - `context-map.md` — contexts / relationships 都還沒填
> - `dflow/specs/domain/{context}/` 任何子目錄都不存在
>
> 結論：這真的是 day-0 first feature，沒有任何既有 BC / Aggregate 可引用。所有 domain 概念要從零建。
>
> Step 1 complete (intake). Entering Step 2: Identify the Bounded Context.

> **Dflow**：Step 2 確認 BC。這個 feature 涉及的概念是「費用申報單」「費用項」「員工」「主管」「核銷」——核心動作圍著「費用申報資料的生命週期」。
>
> 我建議建一個叫 **`Expense`** 的 BC：
>
> - 中文名稱：費用申報
> - 職責：員工費用申報資料的整個生命週期（建 Draft / 加 Item / 提交 / 後續審核 / 核銷）
> - In Scope（MVP）：建立 / 編輯 / 提交 ExpenseReport
> - Out of Scope：主管審核（規劃中拆 Approval BC，或留在 Expense BC 內當另一 Aggregate，phase 2 決定）；財務匯款（Reimbursement BC，phase 3）；員工身分（Identity BC，外部，不建模）
>
> 這個命名與切法符合你的預期嗎？

> **Alice**：符合。Expense 這名字夠中性，主管審核要不要拆成獨立 BC 我也是傾向 phase 2 再決定，現在硬切會猜錯。

> **Dflow**：好。Step 2 我會在 Step 3 後一併把 `dflow/specs/domain/Expense/context.md` 建起來（per new-feature-flow.md Step 3 的「foundational domain docs 缺失就從 templates 補」規則）。
>
> Step 2 complete (BC identified: Expense). Entering Step 3: Domain Modeling.

> **Dflow**：Step 3 走三個分鏡：Aggregate identification → Domain Events → Interface definitions。
>
> 先談 **Aggregate**。問你一句：「在一次 transaction 內，什麼東西必須保持一致？」 換句話說，當員工點「提交」那一瞬間，哪些資料是綁在一起的？

> **Alice**：一份費用單裡的所有 Items 必須一起被視為「已提交」——不能一半 submitted 一半還是 draft。所以 ExpenseReport + 它底下的 Items 是一個 Aggregate。員工本身（身分資料）不在這個 BC，跨 BC 用 ID 引。

> **Dflow**：好。所以邊界是：**ExpenseReport 為 Aggregate Root，內含若干 ExpenseItem**。Employee 跨 BC 引用（只持 EmployeeId）。
>
> 接下來：**ExpenseItem 要設成 Entity 還是 VO？** 兩種都可以，差別在語意。VO 表達「Item 是 Report 的一個 immutable 值」，要修改就移除 + 重建；Entity 表達「Item 有自己的 identity，能被個別修改 / 引用」。你的業務場景偏哪種？

> **Alice**：Entity。員工填錯金額會想「修改第三筆」，不會想「刪掉重建」——那體驗很爛。而且未來主管審核時可能會「對某筆 Item 提出疑義」，需要穩定 ID。

> **Dflow**：合理。我把這個決策記到 `aggregate-design.md` § Design Decisions，未來 review 時不會再被人問「為什麼 Item 不是 VO」。
>
> 不變條件——你想到的有哪幾條？我先 dump 我從你描述推出的：
>
> - INV-01：提交時必須至少含 1 個 ExpenseItem
> - INV-02：Submitted 後 Items 集合不可再變
> - INV-03：每個 ExpenseItem 的金額必須 > 0（這個還沒討論到，但如果不守，後面財務會崩潰，先列上）
>
> 還有要補的嗎？

> **Alice**：補一條：同一張收據不能在同一份 Report 內出現兩次。我們現在紙本流程就被這種 case 搞過——員工不小心把同張高鐵票拍兩次傳上來。MVP 階段就直接擋。
>
> 還有 INV-05 我加：只有 Draft 的 Report 能被 Submit，Submitted 的 Report 再呼叫 Submit 應該炸。

> **Dflow**：兩條收下：INV-04 收據去重、INV-05 只有 Draft 能 Submit。
>
> 我順便提幾個 **Value Object** 候選，幫你把 primitive 包起來：
>
> - **Money**(Amount, Currency)——金額永遠綁幣別。MVP 雖然只用 TWD，但 VO 化未來支援多幣別不用改 schema。建構式守住 Amount > 0，把 INV-03 在型別層級就擋住。
> - **ReceiptReference**(Value)——收據編號 / 檔案參照。語意化型別比裸 string 安全，AddItem 簽名收 ReceiptReference 就不會被誤塞 ExpenseItemId。
> - **ExpenseCategory**(Code)——費用類別（高鐵、住宿、餐費…）。MVP 列舉內建類別。
>
> 這三個 VO 你有意見嗎？

> **Alice**：都收。Money 我 100% 同意，這個一旦用 primitive 早晚出事。其他兩個合理。

> **Dflow**：好。**Domain Events**——「ExpenseReport 提交成功後，系統其他部分需要知道嗎？」

> **Alice**：phase 2 開始就需要——主管審核 BC 要訂閱「有新單可審」。MVP 階段雖然沒 consumer，但 event 還是要 raise，不然 phase 2 還要回頭改 Aggregate。

> **Dflow**：完全同意，這是「先把行為表達完整，consumer 之後再接」的標準作法。
>
> 我建議的 event：**ExpenseReportSubmitted**，payload `(ReportId, EmployeeId, SubmittedAt, TotalAmount)`。不放 Items 細節（避免 event 太肥）；consumer 要明細自行用 Repository 重讀。in-process / sync dispatch（MediatR INotification），同 transaction 內發。Outbox 等 phase 3 再評估。
>
> **Interface Definitions**——只需要一個 `IExpenseReportRepository`（GetById / Add / Update）。MVP 沒有「主管的待審核清單」這種查詢需求，等 phase 2 再加。
>
> 我整理一下 Step 3 的產出：
>
> | 項目 | 內容 |
> |---|---|
> | Bounded Context | Expense |
> | Aggregate Root | ExpenseReport |
> | Entities | ExpenseReport（root）、ExpenseItem |
> | Value Objects | Money、ReceiptReference、ExpenseCategory |
> | Invariants | INV-01..05（見上） |
> | Domain Events | ExpenseReportSubmitted |
> | Repository Interfaces | IExpenseReportRepository |
> | Domain Services | (無，MVP 不需要) |
>
> Phase Gate: Step 3 → Step 3.5。這之後我會跟你 confirm SPEC-ID / slug / 目錄 / branch 名稱。**`/dflow:next` 進 Step 3.5。**

> **Alice**：`/dflow:next`

> **Dflow**：Step 3.5 — Slug Confirmation。依今天的脈絡（init-project 用過 SPEC-20260428-001 的範例日期）我提：
>
> - **SPEC-ID**: `SPEC-20260428-001`
> - **slug**: `employee-submit-expense`（英文，因為我們整段討論是中文，但 slug 跟程式碼比較近，git branch 也可以保 ASCII 友善——per P012 後規則 slug 跟隨討論語言或團隊偏好都可以；你想改中文 slug 也行）
> - **feature 目錄**: `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/`
> - **git branch**: `feature/SPEC-20260428-001-employee-submit-expense`
>
> 這樣可以嗎？或想改 slug？

> **Alice**：英文 slug 就好。我們團隊後續也偏好 ASCII 路徑，省得跨平台 / CI 噴錯。確認。

> **Dflow**：收到。Step 3.5 complete (slug confirmed). Entering Step 4: Write the Spec.

> **Dflow**：Step 4 我會建這幾份檔。BC-level 的 4 份（context.md / models.md / rules.md / events.md）也一併在這 step 補建——per new-feature-flow.md Step 3 的「foundational domain docs 缺失就從 templates 補」規則，因為 Expense BC 是首次出現。
>
> | Path | 來源 | 性質 |
> |---|---|---|
> | `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md` | `templates/_index.md` | 新建 — feature dashboard |
> | `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md` | `templates/phase-spec.md` | 新建 — phase 1 spec |
> | `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md` | `templates/aggregate-design.md` | 新建 — Core 版特有 |
> | `dflow/specs/domain/Expense/context.md` | `templates/context-definition.md` | 新建 — BC 定義 |
> | `dflow/specs/domain/Expense/models.md` | `templates/models.md` | 新建 — BC model catalog |
> | `dflow/specs/domain/Expense/rules.md` | `templates/rules.md` | 新建 — BR-ID index |
> | `dflow/specs/domain/Expense/events.md` | `templates/events.md` | 新建 — Domain Event catalog |
> | `dflow/specs/domain/glossary.md` | (既有) | **修改** — 補 ExpenseReport / ExpenseItem / Approver / Reimbursement 4 個 term |
> | `dflow/specs/domain/context-map.md` | (既有) | **修改** — 補 Expense BC 第一個 entry |
>
> **不建** `dflow/specs/domain/Expense/behavior.md`：per Step 8.3 才從 phase-spec 的 Given/When/Then 場景 merge 進來；現在建只會留空殼。`rules.md` 的 behavior anchor 連結指過去，會是預期的 dead link，`/dflow:verify` 會把它標為「pending behavior merge」而不是 error。
>
> 開工嗎？或有 path 要調整？

> **Alice**：開工。

> **Dflow**：寫檔過程：
>
> - ✓ `dflow/specs/domain/Expense/context.md` — Responsibilities / In&Out Scope / Aggregates / VOs / Repository / Interactions（標 Approval BC 為「規劃中」，event 已有但 consumer 暫無）
> - ✓ `dflow/specs/domain/Expense/models.md` — 1 Aggregate / 2 Entity / 3 VO / 1 Repository、Code Mapping 指向 `src/ExpenseTracker.Domain/Expense/`
> - ✓ `dflow/specs/domain/Expense/rules.md` — BR-001..004（draft 狀態，等 Step 8.3 升 active）
> - ✓ `dflow/specs/domain/Expense/events.md` — ExpenseReportSubmitted (payload 不含 Items 細節)
> - ✓ `dflow/specs/domain/glossary.md` — 補 ExpenseReport / ExpenseItem / Approver / Reimbursement 4 term；後兩個目前 code mapping 留 `(尚未建模)`，預留給 phase 2/3
> - ✓ `dflow/specs/domain/context-map.md` — Expense BC 進 contexts 表；relationships 表保持空（單 BC 無關係可填），integration notes 加註 phase 2 預期
> - ✓ `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md` — INV-01..05、Structure ASCII tree、State Transition Methods 表（Submit raise event）、Design Decisions（Item 為何是 Entity / 為何 Money 是 VO 等）
> - ✓ `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md` — Problem / Domain Concepts / Behavior Scenarios（含主成功 + 2 個替代）/ Business Rules（BR-001..004 一行 + Implementation Location）/ Edge Cases（EC-001..003）/ Domain Events 表 / Implementation Plan 四層 / Test Strategy / Open Questions / Implementation Tasks（生成放到 Step 5 末尾）
> - ✓ `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md` — 6 sections 全：Metadata / Goals & Scope / Phase Specs / Current BR Snapshot（4 條 BR）/ Lightweight Changes（空）/ Resume Pointer
>
> Step 4 內 phase-spec 的 Behavior Scenarios 段我寫了一個主成功（3 個 Item 提交成功）+ 2 個替代（空 Items 提交、Submitted 後再 AddItem），Edge Cases 寫了 3 條（EC-001 金額 = 0、EC-002 重複收據、EC-003 二次 Submit）。Edge cases 直接衍生出 BR-003 / BR-004，這也順便驗證 BR 跟 EC 的一致性。
>
> Phase Gate: Step 4 → Step 5。Spec 寫好了——behavior scenarios、Aggregate state transitions、Domain Events、CQRS 切分都齊了。準備規劃 layer-by-layer 實作？`/dflow:next` 或回 OK，需要再迭代 spec 也告訴我。

> **Alice**：spec 我快速掃一遍……Behavior Scenarios 和 Edge Cases 都對。BR-004 的「重複收據處理方式」MVP 採「拒絕」沒問題，open question 也記下來了。`/dflow:next`。

> **Dflow**：Step 5 — 層層規劃實作。順序：Domain → Application → Infrastructure → Presentation。
>
> **Domain Layer（先做）**：
> 1. Money / ReceiptReference / ExpenseCategory 三個 VO（record，建構式驗證）
> 2. ExpenseItem Entity（金額 > 0；private setters）
> 3. ExpenseReport Aggregate Root（Status enum、`_items` 集合、Submit/AddItem/RemoveItem/ModifyItem 方法、DomainEvents 集合）
> 4. ExpenseReportSubmitted Domain Event (record)
> 5. IExpenseReportRepository interface
> 6. Domain unit tests（INV-01..05 + BR-001..004 + EC-001..003）
>
> **Application Layer**：
> 1. CreateExpenseReportCommand + Handler + Validator
> 2. AddExpenseItemCommand + Handler + Validator
> 3. SubmitExpenseReportCommand + Handler + Validator
> 4. DTOs（ExpenseReportDto / ExpenseItemDto）
>
> **Infrastructure Layer**：
> 1. ExpenseReportConfiguration（EF Fluent API；Owned Type 配 Money / ReceiptReference / ExpenseCategory）
> 2. ExpenseReportRepository 實作
> 3. InitialExpenseSchema migration
>
> **Presentation Layer**：
> 1. ExpenseReportsController：`POST /api/expense-reports`、`POST /api/expense-reports/{id}/items`、`POST /api/expense-reports/{id}/submit`
> 2. Request / Response models
> 3. Swagger annotations
>
> 這個切法有要調整的嗎？

> **Alice**：MVP 我想再簡化一點——`AddExpenseItemCommand` 跟 `CreateExpenseReportCommand` 都需要嗎？我覺得 MVP 階段建單跟加 Item 可以共用同一個 endpoint「直接 POST 一份完整 Draft」，省掉一輪 round-trip。

> **Dflow**：合理。但這樣的話 UX 假設員工會在前端編好整份再 POST，沒有「邊建 Draft 邊加 Item」的能力。你的前端 phase 1 是怎麼設計的？

> **Alice**：phase 1 前端就是一頁式表單，員工填完整份按提交。Draft 暫存功能 phase 2 再做。所以你說得對——MVP 階段 CreateExpenseReportCommand 就直接帶 Items 一起進來，AddExpenseItemCommand 留到 phase 2 再加。

> **Dflow**：那我把 Implementation Plan 的 Application Layer 改成兩個 Command：
>
> 1. CreateExpenseReportCommand（含 Items 陣列）+ Handler + Validator
> 2. SubmitExpenseReportCommand + Handler + Validator
>
> AddExpenseItemCommand 移到 phase 2 backlog（不在本 phase 的 task 內）。
>
> 我把 Implementation Tasks 列表生成出來——這份會放在 phase-spec.md 結尾，作為 Step 7 實作的 punch-list 和 Step 8 完成驗收的 checklist：
>
> ```
> - [ ] DOMAIN-1: 建 Money / ReceiptReference / ExpenseCategory 三個 VO
> - [ ] DOMAIN-2: 建 ExpenseItem Entity（金額 > 0）
> - [ ] DOMAIN-3: 建 ExpenseReport Aggregate Root（Submit/AddItem/RemoveItem/ModifyItem + DomainEvents）
> - [ ] DOMAIN-4: 建 ExpenseReportSubmitted Domain Event
> - [ ] DOMAIN-5: 建 IExpenseReportRepository interface
> - [ ] APP-1: CreateExpenseReportCommand + Handler + Validator
> - [ ] APP-2: SubmitExpenseReportCommand + Handler + Validator
> - [ ] APP-3: DTOs (ExpenseReportDto, ExpenseItemDto)
> - [ ] INFRA-1: ExpenseReportConfiguration（EF Fluent API + Owned Types）
> - [ ] INFRA-2: ExpenseReportRepository 實作
> - [ ] INFRA-3: InitialExpenseSchema migration
> - [ ] API-1: ExpenseReportsController + 兩個 endpoints + Request/Response + Swagger
> - [ ] TEST-1: Domain unit tests（6 案例：BR-001..004 + EC-001..003）
> - [ ] TEST-2: Application handler tests（Submit handler 主場景 + Validator）
> - [ ] TEST-3: Integration test（Repository round-trip）
> ```
>
> （我會等等把這列表 inline 寫進 phase-spec.md 的 `## Implementation Tasks` 段；現有 phase-spec 還是 Step 4 留下的版本，我這就 update。）
>
> Step 5 complete (layer-by-layer plan + task list ready). Entering Step 6: Git Branch.

> **Dflow**：Step 6 — git branch。命名 `feature/SPEC-20260428-001-employee-submit-expense`（slug 沿用 Step 3.5 確認的）。
>
> 不過今天我們是在 tutorial 模式，branch 我不實際幫你建——那是你開實際開發時才做的動作。phase-spec 的 metadata `branch:` 欄已經寫好了，到時候 `git checkout -b feature/SPEC-20260428-001-employee-submit-expense` 即可對應。
>
> Phase Gate: Step 6 → Step 7。Branch info 已備妥。準備從 Domain layer 開始實作（DOMAIN-1）？`/dflow:next` 進 Step 7，或先討論 task 順序 / scope。

> **Alice**：今天到這邊就好。spec 有了、Aggregate 有了、Tasks 有了，明天我先跑 DOMAIN-1..5 + TEST-1，Domain layer 完整跑通再進 Application。Step 7 / Step 8 等我實際 commit 完再跟你回報。
>
> 你幫我 update 一下 `_index.md` 的 Resume Pointer，這樣明天我接續工作能直接從那裡讀。

> **Dflow**：好。`_index.md` Resume Pointer 已更新：
>
> > **Current Progress**: phase-1 (mvp) phase-spec drafted; Aggregate design done; Implementation Tasks generated. 尚未進入 Step 6 git branch。
> >
> > **Next Action**: 跑 `/dflow:next` 進入 Step 6 建 git branch `feature/SPEC-20260428-001-employee-submit-expense`，再進 Step 7 從 Domain layer 開始實作（DOMAIN-1 起）。
>
> Step 9 — Results report：
>
> ```
>   New BC scaffolded: Expense
>     ✓ dflow/specs/domain/Expense/context.md
>     ✓ dflow/specs/domain/Expense/models.md
>     ✓ dflow/specs/domain/Expense/rules.md      (BR-001..004, draft)
>     ✓ dflow/specs/domain/Expense/events.md     (ExpenseReportSubmitted)
>
>   New feature: SPEC-20260428-001 employee-submit-expense
>     ✓ dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md
>     ✓ dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md
>     ✓ dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md
>
>   Updated existing:
>     ✓ dflow/specs/domain/glossary.md          (+4 terms: ExpenseReport / ExpenseItem / Approver / Reimbursement)
>     ✓ dflow/specs/domain/context-map.md       (+1 BC entry: Expense)
>
>   Deferred (not created here by design):
>     - dflow/specs/domain/Expense/behavior.md   — 由 Step 8.3 從 phase-spec 場景 merge 進來
>     - phase-2 spec / AddExpenseItemCommand — 移到 phase 2 backlog
> ```
>
> **接續工作提醒**：
>
> - 今天還沒建 git branch；明天開實作前記得 `git checkout -b feature/SPEC-20260428-001-employee-submit-expense`
> - 實作完成後 Step 8 要做：把 phase-spec.md 的 Given/When/Then 場景 merge 進 `dflow/specs/domain/Expense/behavior.md`（merge 時 BR-001..004 在 rules.md 從 draft 升 active）
> - phase 1 收尾後跑 `/dflow:new-phase` 啟動 phase 2「主管審核」（會自動繼承 Current BR Snapshot，並要求 Delta 段）

> **Alice**：清楚。週五前把 Domain 層跑完。明天開工再叫你。

## 本段產出的檔案

`/dflow:new-feature` 在 Alice 的 ExpenseTracker repo 寫入了 **7 個新檔 + 修改 2 個既有檔**，按目錄分組如下：

**新建 — feature 目錄（3 檔）**
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md) — feature dashboard，含 6 個 sections（Metadata / Goals & Scope / Phase Specs / Current BR Snapshot / Lightweight Changes / Resume Pointer）+ canonical English headings + `<!-- dflow:section ... -->` anchors
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md) — phase 1 spec，「首 phase，無前置 Delta」 + 4 個 BR + 3 個 EC + 15 個 Implementation Tasks
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md) — Core 版特有；ExpenseReport 5 條 invariants + State Transition Methods + 4 個 Design Decisions

**新建 — Expense BC 目錄（4 檔）**
- [`dflow/specs/domain/Expense/context.md`](outputs/dflow/specs/domain/Expense/context.md) — BC 定義：Responsibilities / In Scope / Out of Scope / 概覽各模型 / Interactions / Code Mapping
- [`dflow/specs/domain/Expense/models.md`](outputs/dflow/specs/domain/Expense/models.md) — model catalog：1 Aggregate / 2 Entity / 3 VO / 1 Repository
- [`dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md) — BR Index 表（BR-001..004 draft）+ behavior anchor 連結（指向尚未建立的 behavior.md，預期 dead link）
- [`dflow/specs/domain/Expense/events.md`](outputs/dflow/specs/domain/Expense/events.md) — Event catalog（ExpenseReportSubmitted，MVP 無 consumer）

**修改 — domain/ 既有 living document（2 檔）**
- [`dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) — 補 4 個 term（ExpenseReport / ExpenseItem / Approver / Reimbursement）；後兩個 code mapping 留 `(尚未建模)` 預留 phase 2/3
- [`dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) — 補 Expense BC entry；relationships 留空（單 BC 無關係）；integration notes 註明 phase 2 預期

**未建（per skill 規定）**
- `dflow/specs/domain/Expense/behavior.md` — Step 8.3 才 merge phase-spec 場景進來
- phase-2 spec — 屬另一段（`03-new-phase.md`）

## 觀察重點

- **Step 3 → Step 3.5 的 Phase Gate 真的等 confirm**：Step 3 結束時 announce「等 `/dflow:next` 進 Step 3.5」，Alice 回 `/dflow:next` 才進。slug 確認也是先 propose 再等回應，沒有自動建目錄。對照 new-feature-flow.md `Phase Gates` 列表的 4 道 gate（Step 3→3.5、Step 4→5、Step 6→7、Step 7→8），其他 step transition（如 Step 1→2、Step 2→3、Step 3.5→4、Step 5→6）都是 step-internal「announce + 直接繼續」——這個對話完整體現了兩種 transition 的差別。
- **BR / EC / INV 的三層職責劃分清楚**：INV 是 Aggregate 不變條件（aggregate-design.md），BR 是業務規則（rules.md），EC 是邊界場景（phase-spec.md）。EC-001（金額=0）衍生出 BR-003 + INV-03，三層都對得起來，這是 P003 + P008 的 source-of-truth 結構在 Core 版的具體展現。同事 review 時可以特別檢查這三層有沒有矛盾。
- **`_index.md` 的 6 sections + canonical English headings + dflow:section anchors**（per R8b cascade）都到位：Goals & Scope / Phase Specs / Current BR Snapshot / Lightweight Changes / Resume Pointer 五段內容 + Metadata frontmatter。`<!-- dflow:section current-br-snapshot -->` 和 `<!-- dflow:section lightweight-changes -->` 兩個 anchor 注入點都有，方便 `/dflow:status` 或自動工具定位。
- **`aggregate-design.md` 的 Design Decisions 段被刻意填滿**：「為什麼 ExpenseItem 是 Entity 而非 VO」「為什麼 Aggregate 邊界劃在一份 Report」「為什麼 Money 是 VO」「為什麼 ReceiptReference 是 VO」——這四個決策都在對話中被討論到並寫進 spec。未來 review 時不會再被同事問「為什麼這樣設計」。模板的 Design Decisions 段如果只填一句話會浪費這個 review 介面。
- **glossary 補 term 的時機策略**：Approver / Reimbursement 兩個 term 在 MVP phase 還沒對應到任何 code，但因為它們會被 BR-002 / Goals & Scope 提到，**先入詞表 + code mapping 留 `(尚未建模)`**——避免「術語出現在 spec 但 glossary 查不到」的斷層。Code mapping 等對應 phase 落地時再回補。同事讀 spec 時不會卡在「Approver 是什麼」。
- **「不建 behavior.md」的設計理由 announce 出來了**：rules.md 的 behavior anchor 連結會是 dead link，但 `/dflow:verify` 不會把它判為 error（會標 pending behavior merge）——這是 P011 / 8.3 設計的 explicit 留白，對話中明確點出，避免同事看到 dead link 以為流程出 bug。
- **「Implementation Tasks 在 Step 5 末尾才生成」的 timing**：對話呈現 Step 4 寫 phase-spec 時還沒寫 Implementation Tasks 段，Step 5 layer-by-layer plan 完成後才 inline 寫進去。這個順序符合 phase-spec.md template 的 `<!-- Fill timing: generated by AI after Phase 4 -->` 標記。

## 下一個劇情段

→ [03-new-phase.md](03-new-phase.md)：Alice 跑完 phase 1 MVP（Domain 層 + Application 層 + Infra 層 + 一條最小 API endpoint + 對應測試）兩天後，準備啟動 phase 2「主管審核」，使用 `/dflow:new-phase` 在同一個 active feature 目錄內加新 phase（會引入 Approval 流程、ExpenseReport 狀態加 Approved / Rejected、新增 Domain Event ExpenseReportApproved / ExpenseReportRejected、會出現第一份「Delta from prior phases」）。
