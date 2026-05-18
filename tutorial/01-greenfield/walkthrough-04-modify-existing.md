# Walkthrough 04 — `/dflow:modify-existing` 調整 BR-007 reject reason 長度

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Greenfield track 的第三種日常工作型態：同一個 feature 已經有
phase 1 提交與 phase 2 主管審核後，試用者提出一個小而真實的規則修正。Alice 這次
不是新增 phase，不是新增 Aggregate，也不是修 typo；她要把 BR-007 的 reject reason
最低長度，從單一 10 字元改成對中文更合理的雙語長度規則。

本篇把 Alice 與 Dflow 的 lightweight modify 對話整理成一份可教學、可 review 的讀物，
讓讀者看懂：

- `/dflow:modify-existing` 如何先判斷 T1 / T2 / T3
- 為什麼這次是 T2 Light，而不是 `/dflow:new-phase`
- lightweight spec 與 phase spec 的差異
- BR-007 如何用 Delta format 記錄 Before / After / Reason
- `_index.md` Current BR Snapshot 什麼時候 regenerate
- 小規則修正如何仍然保持 DDD 邊界與 implementation tasks
- 為什麼 `models.md` / `context.md` 這類摘要文件可以故意不動，避免 scope 擴張

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Greenfield 劇情跑完後的
最終狀態；本步驟當下，feature 仍位於 `features/active/`，並在後續 closeout 後移到
`features/completed/`。只讀本篇也能看懂 BR-007 這次修改的發生順序；若想看 active /
completed snapshot 的完整讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| 小規則修改是不是也要開新 phase？ | 不一定。這次只修改既有 BR-007 與 `ApprovalReason` validation，因此是 T2 lightweight change。 |
| T2 Light 會不會太輕，導致規則沒被記錄？ | T2 仍有獨立 lightweight spec、Behavior Delta、implementation tasks、文件同步點。 |
| BR Snapshot 是 append 還是 regenerate？ | 有 BR wording delta 時 regenerate `_index.md` Current BR Snapshot，歷史留在 lightweight spec。 |
| DDD 邊界怎麼守？ | Aggregate、Domain Event、資料結構不變；只有既有 Value Object 驗證規則改變。 |
| 哪些文件應該同步？ | 更新 lightweight spec、feature `_index.md`、`rules.md`、`aggregate-design.md`、glossary；摘要文件不必全面追文案。 |

## 前情提要

上一篇 [〈Walkthrough 03 — `/dflow:new-phase` 在同一 feature 內新增主管審核〉](walkthrough-03-new-phase.md) 中，
Alice 用 `/dflow:new-phase` 在同一個 feature 內加入 supervisor approval phase。

到本篇開始時，這個 active feature 已經有兩個 phase：

```text
SPEC-20260428-001-employee-submit-expense
├── phase-spec-2026-04-28-mvp.md
└── phase-spec-2026-04-29-supervisor-approval.md
```

phase 2 新增了 `ApprovalDecision` Aggregate、`ApprovalReason` Value Object，以及
主管 Approve / Reject 的規則：

| BR | phase 2 當下規則 |
|---|---|
| BR-005 | 主管不可審核自己提交的 ExpenseReport。 |
| BR-006 | 只有 Submitted 的 ExpenseReport 能被 Approve / Reject。 |
| BR-007 | Reject 必須附註原因；`ApprovalReason` 至少 10 字元。 |

這裡的 10 字元規則在英文或長句輸入下看起來合理，但試用主管很快遇到中文語境問題。

## 劇情背景

2026-04-29 晚上，Alice 把 phase 2 的主管審核程式碼寫完，開發測試環境也放給幾位主管試用。
隔天中午，一位主管拿著筆電走到 Alice 座位旁：

```text
我 reject 了一張差旅單，
理由想打「金額對不上」，
但系統說「至少 10 字元」。

中文 5 個字就很完整，這個規則對中文太硬。
```

Alice 判斷這不是新的審核流程，也不是新的 Aggregate。它是既有 BR-007 的 wording delta：

```text
Before: Reject reason 至少 10 字元。
After: 至少 5 個中文字 / emoji 視覺字元 OR 至少 10 個英數字。
```

混合輸入時兩條件擇一滿足即通過；全空白不通過；半形與全形英數字視覺等價。

Alice 在 AI coding agent 裡輸入：

```text
Alice:
午餐剛被主管抓住。
他 reject 一張差旅單，理由想打「金額對不上」，
可是系統說 reject reason 至少 10 字元。

中文 5 個字其實很完整，
我想把規則改成「至少 5 個中文字，或至少 10 個英數字」。
這應該不是新 phase。

/dflow:modify-existing
```

這段輸入有三個重要訊號：

| 訊號 | 對 flow 的影響 |
|---|---|
| 指向既有 reject reason 規則 | Dflow 會找 active feature 與 BR-007，而不是新建 feature。 |
| 明確說不是新 phase | Dflow 仍會自行判斷，但會把 developer intent 納入 scope control。 |
| 提出具體新門檻 | 可直接形成 lightweight spec 的 Behavior Delta。 |

## Before Dflow speaks

如果沒有 Dflow，Alice 可能會直接把 `ApprovalReason.Length >= 10` 改成某個新的 helper，
然後補幾個 unit tests。那樣短期有效，但會留下幾個問題：

| 風險 | 後果 |
|---|---|
| BR-007 沒有文件化 delta | Reviewer 不知道 10 字元被改成什麼，也不知道為什麼改。 |
| `_index.md` snapshot 沒更新 | 下一個 AI session 仍可能以舊的 10 字元規則生成 code。 |
| emoji / 空白 / 全形字元邊界沒定義 | implementation 會各自猜，bug-fix 很快出現。 |
| 小改被升成新 phase | feature history 看起來像新增審核能力，但其實只是修規則門檻。 |

Dflow 的責任是把這個小修改控制在剛好的 ceremony：比 T3 更正式，但不到 T1 / new-phase。

## Step 1 — Assess the Change：判定 T2 Light

Dflow 先宣告 modify-existing flow 的 Step 1：

```text
Dflow:
收到。這是 modify-existing flow，
我先跑 Step 1：Assess the Change。
這一步同時判斷 Ceremony Tier、Feature Linkage、Affected Layer。
```

Tier 判定：

```text
Dflow:
Part A — Tier 判定：

- T1 Heavy？否。
  這次沒有新的 Aggregate、沒有新的 Domain Event、沒有新的資料結構，
  也不是 Aggregate overhaul；只是既有 ApprovalReason Value Object 的驗證規則調整。

- T2 Light？是。
  它有 BR Delta：BR-007 從「至少 10 字元」改成 bilingual length rule，
  而且會改變 Domain layer validation 的通過 / 拒絕結果。

- T3 Trivial？否。
  這不是 copy、typo、button color 或純註解；
  會改變 reject 是否成立，所以不能只寫 _index.md inline row。

結論：T2 Light。
```

Alice 確認：

```text
Alice:
對，我不想為這件事開 phase 3。
沒有新 BR，只是 BR-007 內容修正。
```

這是本篇第一個 lesson：**小改不等於無規格。**

T2 Light 的意思是 ceremony 變輕，不是讓規則留在聊天紀錄或 code diff 裡。只要它改變
observable domain behavior，就要有可追蹤的 spec 與 BR snapshot。

## Step 1 Part B — Feature Linkage：掛回 active feature

Dflow 接著找 host feature：

```text
Dflow:
Part B — Feature Linkage。

我掃 active feature，這個 change 明確屬於：

dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/

Host feature = SPEC-20260428-001-employee-submit-expense，
目前 status 是 in-progress，
所以它可以直接接 T2 lightweight change。
```

為什麼不是新 feature？

| 可能歸屬 | 判斷 |
|---|---|
| 新 feature | 錯。沒有新的 business capability；仍是 employee-submit-expense lifecycle 內的主管 reject。 |
| 新 phase | 不需要。沒有新增審核流程、狀態或資料結構。 |
| 既有 active feature 的 T2 lightweight spec | 對。這是 BR-007 的 wording / validation delta。 |

Affected layer 也被標出：

```text
Dflow:
Affected layer = Domain layer。
原因是 ApprovalReason 是 Value Object，
拒絕原因是否足夠是 Domain invariant，
不應只放 Application validator 或前端。
```

這是本篇第二個 lesson：**規則門檻看似 UI 字數問題，但 owner 是 Domain。**

前端可以提供 counter，Application 可以做 friendly validation，但真正保護 BR-007 的地方是
`ApprovalReason` Value Object。

## Step 1.5 / 1.6 — 不 reopen、不開 follow-up feature

Dflow 繼續跑 completed-feature guard：

```text
Dflow:
Step 1.5 — Completed-feature reopen detection：skip。

跳過理由：Step 1 找到的是 active feature，
不是 completed feature。

Step 1.6 — Create Follow-up Feature：skip。

跳過理由：沒有 completed feature follow-up。
這個 T2 直接掛在 active feature 下。
```

這個 guard 對後續很重要。等 feature closeout 完成後，feature 會移到 `completed/`；
那時未來修改就不應直接追加進 completed directory，而是要視情況建立 follow-up feature。
但本篇發生時 feature 還 active，所以 T2 可以留在同一個 feature directory。

## Step 2 — Check Documentation：先讀 baseline，不直接改 code

Dflow 進入 Step 2：

```text
Dflow:
Step 2 我會讀現有文件，先確認 baseline 已經有被記錄，
不直接改程式。

需要對照：
- _index.md
- phase-spec-2026-04-29-supervisor-approval.md
- dflow/specs/domain/Expense/rules.md
- aggregate-design.md
- dflow/specs/domain/glossary.md
```

Dflow 讀到當下 BR-007：

```text
Reject 必須附註原因；
ApprovalReason 至少 10 字元，
否則 raise DomainException。
```

baseline 足夠，所以不用補建 domain docs，也不用回頭修改 phase 2 history。這次變更會由
一份 lightweight spec 承接。

Alice 指定檔名：

```text
Alice:
檔名我想清楚一點：
lightweight-2026-04-30-approval-reason-bilingual-length.md
```

Dflow 接受：

```text
Dflow:
OK。slug = approval-reason-bilingual-length。

我會用 T2 lightweight template，不用 phase-spec template。
```

本步驟當下路徑是：

```text
dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/
└── lightweight-2026-04-30-approval-reason-bilingual-length.md
```

完整文件範例在後續 closeout 後位於：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md)

## Step 2 — 邊界 case 必須在 spec 裡拍板

Alice 接著問幾個容易被 implementation 猜錯的邊界：

```text
Alice:
有幾個邊界先問清楚。
全空白不應該通過。
半形、全形英文數字應該算同一種，主管可能會打全形。
emoji 呢？
```

Dflow 回：

```text
Dflow:
我建議這些要明確寫進 lightweight spec，
否則 implementation 會自己猜。

- 全空白 / trim 後空字串：不通過，空白不計入任何門檻。
- 半形 / 全形英數字：視覺等價，normalized 後按英數字計。
- emoji：要不要算字？如果算，會進 5-character local-text threshold。
```

Alice 拍板：

```text
Alice:
emoji 算字。
空白不算字。
半全形視覺等價。
不要把這件事擴張成 i18n 或 multi-locale policy，
現在只處理 reject reason 最低長度。
```

這是本篇第三個 lesson：**邊界 case 是規格，不是實作細節。**

如果 emoji 是否計數、空白是否計數、全形英數是否等價沒有寫進 spec，後續 bug fix 和 PR review
就沒有共同依據。本篇把它們寫進 resolved Open Questions 與 implementation tasks。

## Step 3 — Assess DDD Impact

Step 2 baseline captured 後，Dflow 停在 gate：

```text
Dflow:
Baseline captured — existing documentation reviewed,
current behavior is documented and the proposed change is marked.

Ready to assess the DDD impact
(Aggregate design, Domain Events, Value Objects)?
/dflow:next or reply OK to continue.
```

Alice：

```text
Alice:
/dflow:next
```

Dflow 的 DDD impact analysis：

```text
Dflow:
Step 3 — Assess DDD Impact。

Aggregate boundary：OK。
ExpenseReport 和 ApprovalDecision 邊界不變；
Reject reason 還是 ApprovalReason VO 的 responsibility。

Domain Events：不新增、不改 payload。
ExpenseReportRejected 仍然在 reject 成功後 raise，
payload 的 Reason 只是通過新的 VO validation。

Value Object：有影響。
ApprovalReason validation 從單一字數門檻改成 bilingual length rule。

Data structure：無。
沒有 migration，沒有 column 變更，沒有新 table / index。

Cross-context：無。
這不是 Identity / Approval policy / locale service 的議題。
```

這是本篇第四個 lesson：**有 Domain impact，不代表有 Aggregate redesign。**

這次 DDD impact 只落在既有 Value Object。`ExpenseReport`、`ApprovalDecision`、
Domain Events、DB schema 都不變，因此不需要升級成 T1。

## Step 3 — Implementation tasks 保持短，但不可消失

Dflow 產生 T2 implementation tasks：

```markdown
- [ ] DOMAIN-1: 更新 ApprovalReason validation
- [ ] TEST-1: 中文 case（金額對不上 pass，少於 5 counted characters fail）
- [ ] TEST-2: 英文 / 英數字 case（10 normalized alphanumeric pass，少於 10 fail）
- [ ] TEST-3: 混合輸入，任一門檻滿足即 pass
- [ ] TEST-4: emoji、空白、半全形 case
- [ ] INFRA-1: 確認無 DB schema / migration
- [ ] DOC-1: 更新 _index.md、rules.md、aggregate-design.md、glossary
```

Dflow 也補上 guard：

```text
Dflow:
如果後面開始出現 locale policy、語系設定、跨 BC 字元集服務，
那就要停下來問你是否升級 T1；目前不用。
```

T2 的 task list 比 phase spec 短，但仍有幾個不可少的面向：Domain validation、unit tests、
no migration confirmation、文件同步。這讓小修改不會被偷渡成未記錄的 behavior change。

## Step 4 — 這段 tutorial 不進 code implementation

Dflow 問是否要進入實作：

```text
Dflow:
DDD impact analysis done —
Aggregate boundary OK, no new events,
existing Value Object validation changes only.

Ready to implement?
/dflow:next to proceed, or adjust the design first.
```

Alice 決定先停在 documentation package：

```text
Alice:
今天先不進 Step 4 code implementation。
我要先把 spec 和文件給同事看，
明天我會接著改 ApprovalReason 和 unit tests。
```

Dflow 回：

```text
Dflow:
OK。Step 4 Implement 不在這段 tutorial 範圍內；
我不會產生程式碼。

我會把本段需要的 documentation artifacts 落地，
且保留 implementation tasks unchecked、
lightweight spec status = in-progress。
這代表「規格已就緒，實作尚未完成」。
```

這個決策很符合 tutorial 目標：讀者要看到 Dflow 如何把變更收斂成 spec，而不是把假想
ExpenseTracker code 也寫進本 repo。

## Step 5 — Update Documentation

Dflow 宣告 Step 5 的文件更新：

```text
Dflow:
Step 5 — Update Documentation。

我會做四件事：

1. 新增 T2 lightweight spec。
2. 更新 _index.md：
   - Lightweight Changes 表新增一列 T2 outbound link。
   - Current BR Snapshot regenerate，不是 append history。
   - BR-007 Current Rule 改成 bilingual length wording。
   - BR-007 Last Updated 改成 lightweight-2026-04-30。
   - Resume Pointer 指向這份 lightweight spec 的實作。
3. 更新 living docs 的 source-of-truth wording：
   - rules.md
   - aggregate-design.md
   - glossary
4. Step 5.4 T2 Archival：
   - 不建新 phase-spec。
   - 不 move lightweight spec。
   - lightweight spec 留在 active feature directory。
   - 等整個 feature 要收尾時才跑 /dflow:finish-feature。
```

Alice 問一個常見 review 問題：

```text
Alice:
models.md 和 context.md 要不要也改？
我記得裡面有 ApprovalReason 的摘要。
```

Dflow 建議保持小：

```text
Dflow:
這段我建議不動 models.md / context.md / events.md。
理由是這次沒有新的 model、BC、event 或資料結構；
source-of-truth 的 BR wording 放在 rules.md，
VO 設計細節放在 aggregate-design.md，
團隊詞彙放在 glossary.md。
```

這是本篇第五個 lesson：**同步文件不是把所有摘要都逐字改到一致。**

真正的 source of truth 要更新；摘要文件若只是高層概覽，可以避免在 T2 中擴張 scope。
讀完整文件範例時會看到 `models.md` / `context.md` 仍保留 phase 2 的簡短摘要，這是本段
刻意保守的結果，不是 walkthrough 漏連。

## 文件片段 1 — Lightweight spec 的 Problem

完整文件範例：
[`lightweight-2026-04-30-approval-reason-bilingual-length.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md)

開頭把問題定義得很窄：

```markdown
## Problem

2026-04-30 午間主管試用 phase 2 reject flow 時，
想輸入退回原因「金額對不上」。
這是 5 個中文字，對主管而言語意完整，
但現行 ApprovalReason 驗證沿用 phase 2 的「至少 10 字元」規則，
導致系統回覆 Reject reason must contain at least 10 characters.

這是 BR-007 的文字調整與 Domain Layer Value Object 驗證調整；
沒有新增 BR、Aggregate、Domain Event 或資料結構。
```

這段的關鍵是最後一句。它明確排除新 BR、Aggregate、Event、資料結構，讓 reviewer 一眼知道
為什麼本篇不是 new-phase。

## 文件片段 2 — Behavior Delta 記錄 BR-007 的 Before / After

T2 lightweight spec 仍然有 Delta：

```markdown
### MODIFIED - BR / behavior modified

#### Rule: BR-007 Reject 必須附註原因

**Before**:
Given 一份 ExpenseReport 處於 Submitted 狀態
And ApproverId != SubmitterId
When 主管呼叫 Reject 且 Reason 少於 10 字元
Then ApprovalReason 拋出 DomainException(...)

**After**:
Given 一份 ExpenseReport 處於 Submitted 狀態
And ApproverId != SubmitterId
When 主管呼叫 Reject 且 Reason 符合
「至少 5 個中文字 / emoji 視覺字元 OR 至少 10 個英數字」
Then ApprovalReason 接受該 reason，
ExpenseReport.Status 可進入 Rejected，
並建立 ApprovalDecision。

**Reason**:
中文短語通常能用較少字數表達完整退回理由；
原本單一 10 字元限制偏向英文輸入。
```

ADDED / REMOVED / RENAMED 都是 none；UNCHANGED 明確列 BR-001..006。這讓 reviewer
可以確認：只有 BR-007 被修改，phase 2 其他規則沒有被偷改。

## 文件片段 3 — Fix Approach 把字元邊界寫進規格

Fix Approach 是 implementation 的邊界：

```markdown
在 Domain Layer 更新既有 ApprovalReason Value Object 驗證邏輯：

- 先 trim 並忽略空白；空白不計入任何門檻。
- 對英數字做半形 / 全形視覺等價處理。
- 若非空白 reason 內至少 5 個中文字或 emoji 視覺字元，通過。
- 若 normalized reason 內至少 10 個英數字，通過。
- 混合輸入時兩條件擇一滿足即通過；兩者都未達則拒絕。

不改 Application command contract、不改 API contract、
不新增 migration、不改 ApprovalDecision Aggregate 結構。
```

這段不是 code，但它足夠讓後續 AI coding agent 寫出可檢查的 `ApprovalReason` tests。

## 文件片段 4 — `_index.md` Current BR Snapshot regenerate

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)

本步驟當下，`_index.md` 的 Lightweight Changes 表新增一列：

```markdown
| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-04-30 | T2 | Reject reason 從至少 10 字元放寬為 5 中文字 OR 10 英數字。見 lightweight-2026-04-30-approval-reason-bilingual-length.md | {pending} |
```

Current BR Snapshot 中 BR-007 被 regenerate 成新 current state：

```markdown
| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 | phase-2 (supervisor-approval) | lightweight-2026-04-30 | active |
```

這是本篇最重要的 snapshot lesson：**有 BR Delta 時 regenerate current state。**

如果想知道舊規則是 10 字元，要讀 lightweight spec 的 Before；如果想知道此刻 feature 的規則，
要讀 `_index.md` Current BR Snapshot。

## 文件片段 5 — `rules.md`、`aggregate-design.md`、glossary 的分工

`rules.md` 是 BC-level BR source of truth：

```markdown
| BR-007 <!-- phase-2 ADDED --> <!-- 2026-04-30 lightweight MODIFIED --> |
Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，
否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 |
ApprovalDecision | active | 2026-04-30 |
```

完整文件範例：
[`outputs/dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md)

`aggregate-design.md` 更新 Value Object invariant 與 reject transition：

```markdown
INV-09 <!-- phase-2 ADDED --> <!-- 2026-04-30 lightweight MODIFIED -->
Rejected decision 必須有 ApprovalReason；
ApprovalReason 至少 5 個中文字或至少 10 個英數字，
空白不計，半形 / 全形視覺等價，emoji 算字。
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md)

glossary 更新團隊語言：

```markdown
| ApprovalReason <!-- phase-2 ADDED --> <!-- 2026-04-30 lightweight MODIFIED --> |
主管退回 ExpenseReport 時必填的原因文字。 |
Expense |
... |
至少 5 個中文字或至少 10 個英數字；空白不計，半形 / 全形視覺等價，emoji 算字；對應 BR-007 |
```

完整文件範例：
[`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md)

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md) | T2 lightweight spec：Problem、BR-007 Delta、Fix Approach、implementation tasks、resolved questions。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md) | Lightweight Changes row 與 regenerated Current BR Snapshot。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md) | `ApprovalReason` validation wording 與 `Reject()` precondition。 |
| 修改 | [`outputs/dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md) | BR-007 source-of-truth wording 與 `2026-04-30 lightweight MODIFIED` 標記。 |
| 修改 | [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | `ApprovalReason` term 的團隊語言同步。 |
| 故意不改 | `outputs/dflow/specs/domain/Expense/models.md` | 沒有新 model 或資料結構；完整文件範例仍保留 phase 2 摘要文字。 |
| 故意不改 | `outputs/dflow/specs/domain/Expense/context.md` | BC overview 不因 T2 wording delta 全面重寫。 |
| 故意不改 | `outputs/dflow/specs/domain/Expense/events.md` | 沒有新 Domain Event，也沒有 event payload 變更。 |
| 故意不建 | `phase-spec-2026-04-30-*.md` | 這是 T2 Light，不是 new phase。 |

上表連到完整文件範例；本篇只關注 2026-04-30 這個 T2 modify-existing step。

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Hybrid workflow control | Dflow 沒照 Alice 的直覺直接改 code，而是先判斷 T2、host feature、affected layer。 |
| Spec-first development | lightweight spec 與 BR Delta 先落地；implementation tasks 保持 unchecked。 |
| DDD semantic backbone | `ApprovalReason` 被視為 Value Object invariant，不是 UI-only 字數限制。 |
| 三層文件分工 | lightweight spec 管 delta，`_index.md` 管 current snapshot，`rules.md` / aggregate design 管 system state。 |
| Drift verification readiness | BR-007 Before / After、edge cases、tests 都能支援後續 PR review 或 `/dflow:verify`。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| 小改沒留下決策脈絡 | Code diff 顯示 helper 改了，但看不出中文主管回饋與 BR-007 delta。 | lightweight spec 寫 Problem、Before / After / Reason。 |
| AI 下一次仍用舊規則 | `_index.md` 或 `rules.md` 未更新，後續生成仍依 10 字元。 | Current BR Snapshot 與 rules.md 都同步成 bilingual rule。 |
| 字元邊界各自實作 | emoji、空白、全形英數沒有共同規格。 | Fix Approach 與 Open Questions 決議明確寫出。 |
| scope 膨脹成 i18n 專案 | 小規則修正被拉到 locale policy、字元集服務、跨 BC 設計。 | Dflow 明確排除 broader i18n / multi-locale policy。 |
| new-phase 被濫用 | 每個小調整都建立 phase spec，feature history 變重。 | T2 lightweight spec 承接修改，不建新 phase。 |

## 對不熟 T2 lightweight 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **這次到底改了哪條 BR？**
   本篇答案是 BR-007。BR-001..006 明確 unchanged。

2. **這次有沒有新模型？**
   沒有。`ApprovalReason` 是既有 Value Object，只有 validation rule 改變。

3. **為什麼不是 T3？**
   因為 reject 是否成立會改變，且需要 tests；這不是 copy 或 formatting。

4. **為什麼不是 T1？**
   因為 Aggregate boundary、Domain Events、data structure、cross-context relationship 都不變。

T2 lightweight 的價值，是讓小而真實的 domain behavior change 有足夠紀錄，但不被完整
phase ceremony 壓垮。

## Key takeaways

- `/dflow:modify-existing` 的第一步是 scope 判斷，不是直接改 code。
- T2 Light 仍要有獨立 lightweight spec、Behavior Delta、implementation tasks。
- BR-007 是 MODIFIED，不是新增 BR；Before / After / Reason 要寫在 lightweight spec。
- 有 BR wording delta 時，`_index.md` Current BR Snapshot 要 regenerate 成 current state。
- `ApprovalReason` 的雙語長度規則屬於 Domain Value Object validation，不只是前端 counter。
- 摘要文件可以故意不動；source-of-truth 文件要更新，避免 T2 擴張成全面文案同步。

## 下一個 walkthrough

下一個 Greenfield walkthrough 可接 [〈Walkthrough 05 — `/dflow:bug-fix` 修正 reject reason emoji 截斷〉](walkthrough-05-bug-fix.md)：
Alice 回到 office 後處理 `金額對不上👍` 被錯誤拒絕的 bug。那一篇會展示
`/dflow:bug-fix` 如何掛回同一個 active feature、使用 `BUG-001` 命名，並說明為什麼
BR-007 wording 不變時，Current BR Snapshot 不應 regenerate。
