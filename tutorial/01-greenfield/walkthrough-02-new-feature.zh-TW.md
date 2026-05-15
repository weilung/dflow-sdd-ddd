# Walkthrough 02 — `/dflow:new-feature` 建立第一個 Expense feature

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 讓讀者在還沒把 Dflow 用到自己的專案前，就能 read-through 感受到一次
`/dflow:new-feature` 的工作方式：

- 開發者如何觸發 Dflow
- AI 如何先確認需求、再引導 DDD discovery
- 哪些地方會停下來等人確認
- 會產生哪些規格與 domain 文件
- 這些文件如何把「對話中的決策」變成後續 AI coding agent 可讀的約束

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Greenfield 劇情跑完後的
最終狀態；本篇內嵌 code block 則代表 `/dflow:new-feature` 這一步結束當下的重點片段。
只讀本篇也能順著劇情理解；若想先看完整文件家族的讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.zh-TW.md)。

## 本篇適合誰讀

如果你正在評估或學習 Dflow，通常會先問這幾件事：

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| AI 會不會直接開始寫 code？ | Dflow 先跑 intake、BC、Aggregate、spec、implementation plan；本篇停在實作前。 |
| DDD 是不是只多幾個名詞？ | 本篇展示 Aggregate boundary、Entity vs Value Object、Invariant、Domain Event 如何被寫進文件。 |
| Spec-first 到底產生什麼？ | 本篇內嵌 `_index.md`、phase spec、aggregate design、domain docs 的重點片段。 |
| 開發者是否仍保有控制權？ | 本篇展示 Step 3 到 3.5、Step 4 到 5 的 phase gate。 |
| 文件會不會變成一次性草稿？ | 本篇展示 feature-level 文件與 system-level domain docs 的分工。 |

## 版本與命令表面

這裡採用目前 Dflow V1 的公開入口：

| 類型 | 本篇狀態 |
|---|---|
| `dflow init` | 已在 [〈Walkthrough 01 — `dflow init` 建立 Greenfield baseline〉](walkthrough-01-init-project.zh-TW.md) 完成，建立 `dflow/specs/` baseline。 |
| `/dflow:new-feature` | 本篇主角，用來啟動第一個 feature。 |
| `/dflow:next` | 有效的控制命令，用來在 phase gate 確認繼續。 |
| `/dflow:status` / `/dflow:cancel` | 有效的控制命令；本篇沒有使用，但 flow 中允許在 gate 或 active workflow 中使用。 |
| `/dflow:verify` / `/dflow:pr-review` | 有效的獨立檢查命令；本篇尚未進到 PR 或 drift verification 階段。 |

閱讀提示：評估時請把 `dflow init`（或 `npx dflow-sdd-ddd init`）和 `/dflow:*` 分開看：
前者是 npm CLI bootstrap，負責建立 baseline；後者是 AI coding agent 讀取 Dflow
workflow material 後執行的日常協作流程。

## 劇情背景

Alice 已經完成 [〈Walkthrough 01 — `dflow init` 建立 Greenfield baseline〉](walkthrough-01-init-project.zh-TW.md)。ExpenseTracker 現在有一個乾淨的
Dflow baseline：

```text
ExpenseTracker/
├── dflow/specs/
│   ├── shared/
│   │   ├── _overview.md
│   │   ├── _conventions.md
│   │   ├── Git-principles-trunk.md
│   │   └── AI-AGENT-GUIDE.md
│   ├── domain/
│   │   ├── glossary.md
│   │   └── context-map.md
│   ├── architecture/
│   │   ├── tech-debt.md
│   │   └── decisions/README.md
│   └── features/
│       ├── active/
│       ├── completed/
│       └── backlog/
├── AGENTS.md
├── CLAUDE.md
├── GEMINI.md
└── .github/copilot-instructions.md
```

她也花了 30 分鐘補完
[`outputs/dflow/specs/shared/_overview.md`](outputs/dflow/specs/shared/_overview.md)
中的幾個 project-specific placeholder：stakeholders、user scale、DB、Auth、Hosting。

此刻的重點是：`dflow/specs/features/active/` 還是空的，`dflow/specs/domain/`
也還沒有任何真正的 bounded context。這是第一個真正把 Dflow 推進日常 feature
開發的時刻。

Alice 決定第一個 feature 是「員工提交費用單」。這不是隨便挑的 CRUD，它是整個
ExpenseTracker 的上游入口：

- 沒有 ExpenseReport，就沒有主管審核
- 沒有主管審核，就沒有財務核銷
- 沒有第一個 feature，也不會自然長出第一個 bounded context

## Before Dflow speaks

如果沒有 Dflow，Alice 很可能會直接請 AI 產生 Controller、Command、Entity、
EF migration，然後在過程中補幾句「提交後不能修改」之類的規則。

Dflow 的切入點不同。它要求先把問題拆成可審視的 domain decisions：

| Dflow 會先問的問題 | 為什麼重要 |
|---|---|
| 這個 feature 是什麼、誰需要、為什麼現在做？ | 防止 AI 把實作 scope 擴張到主管審核或財務匯款。 |
| 它屬於哪個 bounded context？ | 防止 `Expense`、`Identity`、`Reimbursement` 的語意混在一起。 |
| 哪些資料必須在同一個 transaction 保持一致？ | 用來決定 Aggregate boundary。 |
| Item 是 Entity 還是 Value Object？ | 影響後續修改單筆 item、審核時指出某筆 item 的模型能力。 |
| 哪個事件需要被發布？ | 讓後續 phase 能接上，而不是 phase 2 再回頭補 domain event。 |

這就是 Dflow 的 Spec-first 與 DDD semantic backbone：不是先產生 code，
而是先限制 AI 不能亂猜 domain。

## Step 1 — Alice 觸發 `/dflow:new-feature`

Alice 在 AI coding agent 裡輸入：

```text
Alice:
午安。_overview.md 那幾個 placeholder 我填好 commit 了。
現在準備開第一個 feature。

/dflow:new-feature
```

Dflow 沒有立刻建檔，也沒有開始寫 code。它先宣告這是 new-feature flow，
並進入 Step 1 intake：

```text
Dflow:
好，/dflow:new-feature 走的是第一個 feature 的完整 SDD 循環。
先進 Step 1 intake，三個問題：

1. What's the feature? 平實描述就好。
2. Who needs it? 哪個 stakeholder 或 user role？
3. Why now? 為什麼是現在做？

我同時會去掃 dflow/specs/domain/，看有沒有相關概念能引用。
```

Alice 回答：

```text
Alice:
1. 員工出差或公務結束後，能在系統內建一份費用申報單、
   加幾筆費用項，送出給主管審核。
2. 內部所有會出差或有零星公務支出的員工。
   下游 stakeholder 是部門主管和財務，但 phase 1 我只想做員工端提交。
3. 這是整個 ExpenseTracker 最核心的入口。
   我也想用這個 feature 把 Expense 這個 BC 的骨架立起來。
```

Dflow 掃描現有 domain docs 後，回報現在沒有可沿用的 BC：

```text
Dflow:
我掃過 dflow/specs/domain/：
- glossary.md 還是 init 留下的 placeholder
- context-map.md 還沒有 contexts / relationships
- dflow/specs/domain/{context}/ 子目錄不存在

結論：這真的是 day-0 first feature。
所有 domain 概念要從零建。

Step 1 complete (intake).
Entering Step 2: Identify the Bounded Context.
```

這個小動作很重要。AI 不是憑 prompt 記憶回答，而是先讀 repo 裡的 system state。
如果這裡已經存在 `Expense` BC，它應該引用既有文件；現在沒有，所以它明確宣告
這是第一個 BC。

## Step 2 — Dflow 先定 bounded context，不先定資料表

Dflow 接著提出 bounded context 的切法：

```text
Dflow:
這個 feature 涉及的概念是「費用申報單」「費用項」「員工」「主管」「核銷」。
核心動作圍著「費用申報資料的生命週期」。

我建議建一個叫 Expense 的 BC：

- 職責：員工費用申報資料的整個生命週期
- In Scope (MVP)：建立 / 編輯 / 提交 ExpenseReport
- Out of Scope：主管審核、財務匯款、員工身分

這個命名與切法符合你的預期嗎？
```

Alice 確認：

```text
Alice:
符合。Expense 這名字夠中性。
主管審核要不要拆成獨立 BC，我也傾向 phase 2 再決定。
現在硬切會猜錯。
```

這裡的價值不是「選了 Expense 這個名字」。價值在於 Dflow 把 boundary decision
外顯出來，讓 Alice 可以拒絕、修正或延後。AI 不會偷偷把主管審核、財務匯款、
Identity model 全塞進第一個 feature。

## Step 3 — Aggregate discovery：什麼必須一起保持一致？

Dflow 進入 domain modeling。第一個問題不是「有哪些 class」，而是：

```text
Dflow:
在一次 transaction 內，什麼東西必須保持一致？
換句話說，當員工點「提交」那一瞬間，哪些資料是綁在一起的？
```

Alice 的回答定出 Aggregate boundary：

```text
Alice:
一份費用單裡的所有 Items 必須一起被視為「已提交」。
不能一半 submitted 一半還是 draft。

所以 ExpenseReport + 它底下的 Items 是一個 Aggregate。
員工本身不在這個 BC，跨 BC 用 ID 引。
```

Dflow 先確認 root，再追問 item 的 identity：

```text
Dflow:
所以邊界是：ExpenseReport 為 Aggregate Root，內含若干 ExpenseItem。
Employee 跨 BC 引用，只持 EmployeeId。

接下來：ExpenseItem 要設成 Entity 還是 Value Object？
VO 表達 Item 是 Report 的 immutable 值，要修改就移除再重建。
Entity 表達 Item 有自己的 identity，能被個別修改或引用。
你的業務場景偏哪種？
```

Alice 選 Entity：

```text
Alice:
Entity。
員工填錯金額會想「修改第三筆」，不會想「刪掉重建」。
而且未來主管審核時可能會對某筆 Item 提出疑義，需要穩定 ID。
```

Dflow 接著把 invariants 拉出來：

```text
Dflow:
我從你描述推出的 invariants：

- INV-01：提交時必須至少含 1 個 ExpenseItem
- INV-02：Submitted 後 Items 集合不可再變
- INV-03：每個 ExpenseItem 的金額必須 > 0

還有要補的嗎？
```

Alice 補了兩條：

```text
Alice:
同一張收據不能在同一份 Report 內出現兩次。
我們現在紙本流程就被這種 case 搞過。

還有只有 Draft 的 Report 能被 Submit。
Submitted 的 Report 再呼叫 Submit 應該炸。
```

到這裡，Dflow 已經得到第一個 Aggregate 的核心 shape：

| 決策 | 結果 |
|---|---|
| Bounded Context | Expense |
| Aggregate Root | ExpenseReport |
| Child Entity | ExpenseItem |
| External Reference | EmployeeId，不建 Employee Aggregate |
| Value Objects | Money、ReceiptReference、ExpenseCategory |
| Invariants | INV-01 到 INV-05 |
| Domain Event | ExpenseReportSubmitted |

## Step 3 裡最容易被低估的 DDD 價值

對不熟 DDD 的讀者來說，這段可能看起來只是多問了幾題。但實際上，這幾題是在防止
AI 生成出常見的錯誤模型。

| 如果跳過這段 | 常見後果 | Dflow 在這裡做的事 |
|---|---|---|
| 不問 Aggregate boundary | Controller 或 Handler 直接改多張表，規則散落。 | 用「一次 transaction 必須一致的東西」決定 ExpenseReport Aggregate。 |
| 不問 Entity vs VO | Item 沒有穩定 ID，未來審核或修改單筆 item 時補破洞。 | 先把「修改第三筆」與「主管指出某筆 item」寫成 Entity 決策理由。 |
| 不提 Money VO | 金額用 primitive decimal 到處傳，正數與幣別規則散落。 | Money 在建構時保護 Amount > 0，並綁定 Currency。 |
| 不提 Domain Event | phase 2 主管審核要開始時才發現 submit 沒有事件。 | phase 1 先 raise ExpenseReportSubmitted，consumer 可延後。 |

這是 Dflow 把 DDD 變成 AI guardrail 的地方：不是要求團隊先上完整 DDD 課程，
而是在 feature conversation 裡把關鍵設計問題問出來。

## Phase Gate — Step 3 到 Step 3.5

Step 3 結束後，Dflow 不直接建目錄。它停下來：

```text
Dflow:
Aggregate / VO / Events identified.
Before I create any files, let me confirm the SPEC-ID, slug, directory name,
and branch name with you (Step 3.5).

/dflow:next to proceed.
```

Alice 回：

```text
Alice:
/dflow:next
```

這是本篇第一個關鍵 control point。Dflow 已經完成 domain discovery，但還沒寫檔。
它先要求 Alice 同意進入命名與目錄確認，避免 AI 自己決定 SPEC-ID、slug、
branch name。

## Step 3.5 — Slug、目錄與 branch 確認

Dflow 提議：

```text
Dflow:
依今天的脈絡，我提：

- SPEC-ID: SPEC-20260428-001
- slug: employee-submit-expense
- feature 目錄:
  dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/
- git branch:
  feature/SPEC-20260428-001-employee-submit-expense

這樣可以嗎？或想改 slug？
```

Alice 確認英文 slug：

```text
Alice:
英文 slug 就好。
我們團隊後續也偏好 ASCII 路徑，省得跨平台 / CI 噴錯。
確認。
```

這段展示 Dflow 的另一個設計原則：人類 prose 可以用團隊語言，但 machine-facing
部分如路徑、slug、branch name 可以保守採英文 / ASCII。這對中文語系團隊很實用：
需求討論可以中文，檔名與 git branch 不必承擔跨平台風險。

## Step 4 — Dflow 寫 spec，而不是寫 code

Step 4 開始，Dflow 才寫文件。它列出會新增與修改的檔案：

| 類型 | Path | 用途 |
|---|---|---|
| 新建 feature dashboard | `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md` | feature 層索引、BR snapshot、resume pointer |
| 新建 phase spec | `phase-spec-2026-04-28-mvp.md` | phase 1 的問題、場景、BR、edge cases、implementation plan |
| 新建 aggregate design | `aggregate-design.md` | Greenfield track 特有的 Aggregate 決策文件 |
| 新建 BC context | `dflow/specs/domain/Expense/context.md` | Expense BC 的職責與邊界 |
| 新建 model catalog | `dflow/specs/domain/Expense/models.md` | Aggregate、Entity、VO、Repository |
| 新建 rules index | `dflow/specs/domain/Expense/rules.md` | BR-ID 索引 |
| 新建 event catalog | `dflow/specs/domain/Expense/events.md` | Domain Event catalog |
| 修改 glossary | `dflow/specs/domain/glossary.md` | 加入 ExpenseReport 等術語 |
| 修改 context map | `dflow/specs/domain/context-map.md` | 加入 Expense BC entry |

Dflow 同時明確說明它不建 `behavior.md`：

```text
Dflow:
不建 dflow/specs/domain/Expense/behavior.md。
這份會在完成 checklist 的 Step 8.3，從 phase-spec 的 Given/When/Then 場景 merge 進來。
現在建只會留下空殼。
```

這個說明對讀者很重要。不是每個 template 都 day-0 建好；Dflow 會依生命週期
控制文件何時出現，避免 system-level 文件被 placeholder 污染。

## 文件片段 1 — `_index.md` 當下長什麼樣

`_index.md` 是 feature dashboard。它不是完整 spec，而是讓 AI 與人類快速知道
feature 現在在哪裡、有哪些 phase、目前 BR snapshot 是什麼。

本步驟結束時的重點片段如下：

```markdown
---
spec-id: SPEC-20260428-001
slug: employee-submit-expense
status: in-progress
created: 2026-04-28
branch: feature/SPEC-20260428-001-employee-submit-expense
---

# Employee Submit Expense Report

## Goals & Scope

讓員工能在差旅或公務結束後，建立並提交一份完整的費用申報單給主管審核。
本 feature 是 ExpenseTracker 的第一個 feature，phase 1 先完成「員工端提交」。

涉及 Bounded Context：Expense。
涉及 Aggregate：ExpenseReport。

主管審核、財務匯款與通知不在 phase 1。

## Phase Specs

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | 2026-04-28 | mvp | in-progress | [phase-spec-2026-04-28-mvp.md](./phase-spec-2026-04-28-mvp.md) |

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

| BR-ID | Current Rule | First Seen | Status |
|---|---|---|---|
| BR-001 | 提交時必須至少含 1 個 ExpenseItem。 | phase-1 (mvp) | draft |
| BR-002 | Submitted 後不可編輯。 | phase-1 (mvp) | draft |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 | phase-1 (mvp) | draft |
| BR-004 | 同一 Report 內 ReceiptReference 不可重複。 | phase-1 (mvp) | draft |

## Resume Pointer

**Current Progress**: phase-1 (mvp) phase-spec drafted;
Aggregate design done; Implementation Tasks generated.

**Next Action**: 建立 branch 後，從 Domain layer 開始實作。
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)

補充：連結版本已包含 phase 2、lightweight changes、bug fix 與 integration summary；
上方內嵌片段才是本步驟當下的 `_index.md` 重點。

## 文件片段 2 — Phase spec 把對話變成驗收行為

phase spec 是 spec-first 的主要工作面。它把 Alice 與 Dflow 的對話轉成：

- problem description
- domain concepts
- behavior scenarios
- business rules
- edge cases
- domain events
- implementation plan
- test strategy
- implementation tasks

重點片段如下：

```markdown
# 員工提交費用單 — MVP phase

## Problem Description

員工出差或公務結束後，目前公司流程是手填紙本或 Excel 寄信給主管，
丟失率高、難稽核、跨部門對帳痛苦。第一個 phase 要讓員工至少能在系統內
建立費用申報單、加入費用項、提交給主管。

主管審核 / 財務匯款都暫不在 MVP 範圍。

## Behavior Scenarios

Scenario: 員工成功提交一份含 3 個費用項的 ExpenseReport
  Given 一份 ExpenseReport 處於 Draft 狀態
  And 內含 3 個 ExpenseItem，金額分別為 1500 / 2800 / 800 TWD
  When 員工呼叫 ExpenseReport.Submit()
  Then ExpenseReport.Status 變為 Submitted
  And SubmittedAt 被設為當下時間
  And 一個 ExpenseReportSubmitted Domain Event 被 raise
  And ExpenseReport 不再可被編輯

Scenario: 員工嘗試提交一份沒有費用項的 ExpenseReport
  Given 一份 ExpenseReport 處於 Draft 狀態
  And 內無任何 ExpenseItem
  When 員工呼叫 ExpenseReport.Submit()
  Then 拋出 DomainException
  And ExpenseReport.Status 維持 Draft
  And 不 raise 任何 Domain Event
```

這裡展示的是 Dflow 的 Spec-first development：AI 後續要寫 code 時，不是只靠
「幫我做提交費用單」這句話，而是有具體 Given/When/Then 和 BR-ID 可對照。

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md)

## 文件片段 3 — `aggregate-design.md` 記錄為什麼這樣設計

如果只看 class diagram，很難知道為什麼 `ExpenseItem` 是 Entity、為什麼 `Money`
是 VO、為什麼 employee 只用 ID reference。`aggregate-design.md` 的價值就是留下
設計理由。

本步驟結束時的核心片段：

```markdown
# Expense Aggregates

## Aggregate: ExpenseReport

### Invariants

| ID | Invariant | Behavior on Violation |
|---|---|---|
| INV-01 | ExpenseReport 提交時必須至少含 1 個 ExpenseItem | Submit() 拋 DomainException |
| INV-02 | Submitted 狀態下，Items 集合與其內容不可被改變 | AddItem / RemoveItem / ModifyItem 拋 DomainException |
| INV-03 | 每個 ExpenseItem 的 Money.Amount 必須 > 0 | Money 建構式拒絕無效金額 |
| INV-04 | 同一 ExpenseReport 內，相同 ReceiptReference 不可重複出現 | AddItem() 偵測重複後拒絕 |
| INV-05 | 只有 Draft 狀態的 ExpenseReport 能被 Submit | Submit() 檢查 Status |

### Structure

ExpenseReport (Aggregate Root)
├── ExpenseReportId
├── SubmitterId
├── Status
├── CreatedAt / SubmittedAt
└── _items: List<ExpenseItem>
        ├── ExpenseItemId
        ├── Money
        ├── ExpenseCategory
        ├── ReceiptReference
        └── OccurredOn

### Design Decisions

為什麼 ExpenseItem 是 Entity 而非 Value Object？
因為「員工修改第三筆 item」和「主管指出某筆 item」都需要穩定 identity。

為什麼 Money 是 VO，而不是 primitive decimal？
金額永遠帶幣別語義；用 VO 可以在建構時保護 Amount > 0，
也避免未來多幣別時不同 currency 被直接相加。
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md)

補充：連結版本後續會出現 phase 2 加入的 `ApprovalDecision` aggregate；
本段重點仍是第一個 feature 當下的 `ExpenseReport`。

## 文件片段 4 — System-level domain docs 開始長出來

Feature spec 是短期執行文件；domain docs 是長期 system state。Dflow 在 Step 4
同時建立第一個 BC 的 system-level 文件，讓未來 feature 不必重新猜。

### `domain/Expense/context.md`

```markdown
# Expense Bounded Context

## Responsibilities

負責員工差旅 / 公務費用申報資料的整個生命週期：
建立草稿、加入費用項、提交給主管審核，以及後續審核與核銷狀態追蹤。

## Boundaries

### In Scope
- 建立、編輯、提交 ExpenseReport
- 管理 ExpenseReport 內的 ExpenseItem
- ExpenseReport 狀態機：Draft -> Submitted
- 發布 ExpenseReportSubmitted Domain Event

### Out of Scope
- 通知 email / Slack / Teams
- 核銷匯款
- 員工身分管理 / 主管階層
- 收據影像儲存
```

完整文件範例：
[`outputs/dflow/specs/domain/Expense/context.md`](outputs/dflow/specs/domain/Expense/context.md)

### `domain/Expense/models.md`

```markdown
# Domain Models

## Aggregates

| Aggregate | Root Entity | Invariants | Notes |
|---|---|---|---|
| ExpenseReport | ExpenseReport | 提交時必須 >=1 個 ExpenseItem；Submitted 不可編輯 | phase 1 狀態機：Draft / Submitted |

## Entities

| Entity | Responsibility | Key Identity | Aggregate |
|---|---|---|---|
| ExpenseReport | 費用申報單主體；管理狀態變遷與 Items 集合 | ExpenseReportId | ExpenseReport |
| ExpenseItem | 單筆費用項目 | ExpenseItemId | ExpenseReport |

## Value Objects

| Value Object | Responsibility | Notes |
|---|---|---|
| Money | 金額 + 幣別 | MVP 固定 TWD，但預留多幣別 |
| ReceiptReference | 收據編號或檔案參照 | Domain 不存影像本體 |
| ExpenseCategory | 費用類別 | MVP 列舉內建類別 |
```

完整文件範例：
[`outputs/dflow/specs/domain/Expense/models.md`](outputs/dflow/specs/domain/Expense/models.md)

### `domain/Expense/events.md`

```markdown
# Domain Events

## Event Catalog

| Event name | Producer | Trigger | Payload | Consumers |
|---|---|---|---|---|
| ExpenseReportSubmitted | ExpenseReport | Submit() 成功時 | ReportId, SubmitterId, SubmittedAt, TotalAmount | phase 2 Approval handler |

## Event Flow Notes

Payload 不含 ExpenseItem 細節，避免 event 太重。
consumer 若需要明細，自行透過 repository 重新讀取。
```

完整文件範例：
[`outputs/dflow/specs/domain/Expense/events.md`](outputs/dflow/specs/domain/Expense/events.md)

這些 system-level docs 會在後續 feature、bug fix、PR review、drift verification
中被 AI 反覆讀取。這就是 Dflow 三層文件模型的第一個實例：

| 文件層 | 本篇例子 | 生命週期 |
|---|---|---|
| Phase Delta | `phase-spec-2026-04-28-mvp.md` | 本 phase 的工作面 |
| Feature Snapshot | `_index.md`、`aggregate-design.md` | feature 的累積決策與 resume point |
| System State | `domain/Expense/*.md`、`glossary.md`、`context-map.md` | 後續所有 feature 的長期上下文 |

## Phase Gate — Step 4 到 Step 5

Spec 寫完後，Dflow 再次停下來：

```text
Dflow:
Spec is drafted — behavior scenarios, Aggregate state transitions,
Domain Events, and CQRS split are captured.

Ready to plan the layer-by-layer implementation
(Domain -> Application -> Infrastructure -> Presentation)?

/dflow:next or reply OK to continue,
or tell me if the spec needs another iteration first.
```

Alice 快速掃過 behavior scenarios 和 edge cases，確認 scope 正確：

```text
Alice:
spec 我快速掃一遍，Behavior Scenarios 和 Edge Cases 都對。
BR-004 的「重複收據處理方式」MVP 採「拒絕」沒問題。

/dflow:next
```

這個 gate 的價值是：Dflow 已經把需求轉成 spec，但還沒開始規劃實作。Alice 可以在這裡
要求調整 BR、edge case、scope 或 event payload。這比 code 寫完後才 review
便宜很多。

## Step 5 — Implementation plan 仍然先 Domain layer

Dflow 依 Clean Architecture 順序規劃：

```text
Dflow:
Step 5 — 層層規劃實作。
順序：Domain -> Application -> Infrastructure -> Presentation。

Domain Layer:
1. Money / ReceiptReference / ExpenseCategory 三個 VO
2. ExpenseItem Entity
3. ExpenseReport Aggregate Root
4. ExpenseReportSubmitted Domain Event
5. IExpenseReportRepository interface
6. Domain unit tests

Application Layer:
1. CreateExpenseReportCommand
2. SubmitExpenseReportCommand
3. DTOs

Infrastructure Layer:
1. ExpenseReportConfiguration
2. ExpenseReportRepository
3. InitialExpenseSchema migration

Presentation Layer:
1. ExpenseReportsController
2. Request / Response models
3. Swagger annotations
```

Alice 在這裡做了一個 scope 修正：MVP 不需要 `AddExpenseItemCommand` 作為獨立 round-trip；
前端是一頁式表單，可以直接送一份完整 Draft。

```text
Alice:
MVP 我想再簡化一點。
CreateExpenseReportCommand 就直接帶 Items 一起進來。
AddExpenseItemCommand 留到 phase 2 再加。
```

Dflow 接受這個調整，並把 task list 寫進 phase spec：

```markdown
## Implementation Tasks

- [ ] DOMAIN-1: 建 Money / ReceiptReference / ExpenseCategory 三個 VO
- [ ] DOMAIN-2: 建 ExpenseItem Entity
- [ ] DOMAIN-3: 建 ExpenseReport Aggregate Root
- [ ] DOMAIN-4: 建 ExpenseReportSubmitted Domain Event
- [ ] DOMAIN-5: 建 IExpenseReportRepository interface
- [ ] APP-1: CreateExpenseReportCommand + Handler + Validator
- [ ] APP-2: SubmitExpenseReportCommand + Handler + Validator
- [ ] APP-3: DTOs
- [ ] INFRA-1: ExpenseReportConfiguration
- [ ] INFRA-2: ExpenseReportRepository
- [ ] INFRA-3: InitialExpenseSchema migration
- [ ] API-1: ExpenseReportsController + endpoints
- [ ] TEST-1: Domain unit tests
- [ ] TEST-2: Application handler tests
- [ ] TEST-3: Integration test
```

這段展示 Dflow 的 Hybrid workflow control：AI 會提出預設實作計畫，但 developer
仍可基於產品 scope 調整。調整後的結果會寫回 spec，而不是只留在聊天紀錄。

## Step 6 — Branch info 到位，但 tutorial 不實際建 branch

Dflow 接著進入 Step 6：

```text
Dflow:
Step 6 — git branch。
命名：feature/SPEC-20260428-001-employee-submit-expense。

不過今天我們是在 tutorial 模式，branch 我不實際幫你建。
phase-spec 的 metadata branch 欄已經寫好了。
```

Alice 決定今天停在 spec 與 implementation plan：

```text
Alice:
今天到這邊就好。
spec 有了、Aggregate 有了、Tasks 有了。
明天我先跑 DOMAIN-1..5 + TEST-1。

你幫我 update 一下 _index.md 的 Resume Pointer。
```

Dflow 更新 resume pointer，讓下一次 AI session 可以從 `_index.md` 接續，而不是靠聊天記憶：

```markdown
## Resume Pointer

**Current Progress**:
phase-1 (mvp) phase-spec drafted; Aggregate design done;
Implementation Tasks generated. 尚未進入 Step 6 git branch。

**Next Action**:
跑 /dflow:next 進入 Step 6 建 git branch
feature/SPEC-20260428-001-employee-submit-expense，
再進 Step 7 從 Domain layer 開始實作。
```

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md) | Feature dashboard、BR snapshot、resume pointer。 |
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md) | Problem、behavior scenarios、BR、edge cases、implementation tasks。 |
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md) | Invariants、state transition methods、design decisions。 |
| 新建 | [`outputs/dflow/specs/domain/Expense/context.md`](outputs/dflow/specs/domain/Expense/context.md) | Expense BC 的職責、邊界、out-of-scope。 |
| 新建 | [`outputs/dflow/specs/domain/Expense/models.md`](outputs/dflow/specs/domain/Expense/models.md) | Aggregate、Entity、VO、repository interface。 |
| 新建 | [`outputs/dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md) | BR-ID index。 |
| 新建 | [`outputs/dflow/specs/domain/Expense/events.md`](outputs/dflow/specs/domain/Expense/events.md) | ExpenseReportSubmitted event catalog。 |
| 修改 | [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | ExpenseReport、ExpenseItem、Approver、Reimbursement 等 ubiquitous language。 |
| 修改 | [`outputs/dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) | Expense BC 加入 context map。 |
| 延後 | `dflow/specs/domain/Expense/behavior.md` | Step 8.3 / finish-feature 時才從 phase spec merge。 |

上表連到完整文件範例；本篇重點是 step 02 如何建立這些文件的第一個可審視版本。

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Spec-first development | Dflow 先寫 phase spec、behavior scenarios、BR、tasks；本篇沒有進入 code generation。 |
| Greenfield track | 第一個 BC、Aggregate、VO、Domain Event 從 clean project 長出來。 |
| Hybrid workflow control | `/dflow:new-feature` 明確進入；phase gates 等 Alice `/dflow:next`。 |
| DDD semantic backbone | BC、Aggregate、Entity/VO、Invariant、Domain Event 都有對話與文件化決策。 |
| 三層文件分工 | phase spec、feature `_index.md`、system-level domain docs 分別承擔不同生命週期。 |
| Drift verification readiness | BR-ID、behavior scenarios、events、tasks 都已具備後續 `/dflow:verify` 或 PR review 可讀的依據。 |

## 這一段帶來的實際好處

對 Alice 來說，這一步還沒有寫任何 production code，但已經降低了幾個後續風險。

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| scope 膨脹 | 第一個 feature 一口氣做提交、審核、匯款、通知。 | Out of Scope 明確排除主管審核、財務匯款、通知。 |
| domain 決策漂移 | 今天說 Item 是 Entity，明天 AI 又寫成 immutable value。 | `aggregate-design.md` 記錄 Entity 決策理由。 |
| business rule 散落 | submit 檢查在 controller、validator、handler 各一份。 | BR 與 invariants 先集中寫入 spec / rules / aggregate design。 |
| 後續 AI 不知道上下文 | 新 session 只能讀聊天紀錄或猜測。 | `_index.md` resume pointer 與 domain docs 成為 repo 內 source of truth。 |
| DDD 概念空轉 | 文件有 Aggregate 名詞，但沒有規則與行為。 | 每條 invariant 對應 behavior、exception、test strategy。 |

## 對不熟 DDD 的讀者的讀法

如果你還不熟 DDD，不需要先把所有名詞背起來。讀這篇時可以抓住四個問題：

1. **這個功能的真實邊界在哪裡？**
   本篇答案是 Expense BC，只處理費用申報生命週期；Identity 和 Reimbursement 先留在外部。

2. **哪個物件負責保護規則？**
   本篇答案是 ExpenseReport Aggregate。提交、修改 item、避免重複收據，不能散在 Controller。

3. **哪些值不該只是 primitive？**
   本篇答案是 Money、ReceiptReference、ExpenseCategory。它們讓程式碼承載 domain 語意。

4. **系統發生重要事情時誰需要知道？**
   本篇答案是 ExpenseReportSubmitted。即使 phase 1 沒有 consumer，也先把 domain event 表達出來。

這就是 DDD 對 AI 協作的價值：它把「什麼是正確」放在生成之前，而不是生成之後靠 reviewer
猜 AI 是否理解業務。

## Key takeaways

- `/dflow:new-feature` 的第一個價值是讓 AI 慢下來：先讀既有 docs、問清楚 feature、
  找 BC、建模 Aggregate，再寫 spec。
- Phase gate 不是儀式感；它讓 developer 在「AI 要擴大工作面」之前確認方向。
- `aggregate-design.md` 是 reviewer 介面。它保留「為什麼這樣設計」，不是只有最後的 class 名稱。
- `phase-spec` 是 execution surface。後續 coding agent 可以照 behavior scenarios、
  BR、edge cases、tasks 來實作與驗證。
- `domain/Expense/*.md` 是 long-lived system state。下一個 feature 或 bug fix 會從這裡讀，
  不必重新從 prompt 猜 domain。

## 下一個 walkthrough

下一步會進入 [〈Walkthrough 03 — `/dflow:new-phase` 在同一 feature 內新增主管審核〉](walkthrough-03-new-phase.zh-TW.md)：Alice 跑完 phase 1 後，
使用 `/dflow:new-phase` 在同一個 active feature 內加入「主管審核」。那一段會展示：

- 既有 feature 如何新增 phase，而不是開一個 unrelated new feature
- Current BR Snapshot 如何被繼承與修改
- ApprovalDecision 為什麼留在 Expense BC
- phase 2 如何新增 `ExpenseReportApproved` / `ExpenseReportRejected`
- Dflow 如何處理「這是延伸，還是新的 bounded context」的判斷
