# Walkthrough 05 — `/dflow:bug-fix` 修正 reject reason emoji 截斷

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Greenfield track 裡的 lightweight bug-fix path：既有 business rule
已經清楚，試用者的輸入也符合規則，但 implementation 在 Unicode handling 上把有效輸入弄壞。
Alice 這次不是修改 BR-007，不是新增 BR-008，也不是新增 Aggregate；她要把一個 production
trial 回報的 bug 收斂成可追蹤、可回歸測試的 T2 bug spec。

本篇把 Alice 與 Dflow 的 bug-fix 對話整理成一份可教學、可 review 的讀物，讓讀者看懂：

- `/dflow:bug-fix` 和 `/dflow:modify-existing` 的關係
- 為什麼這是 T2 Light，而不是 T1 new phase 或 T3 trivial fix
- 為什麼 BUG-001 掛回既有 active feature
- 為什麼 BR-007 wording 不變，也不新增 BR-008
- 為什麼 Current BR Snapshot 不 regenerate，卻要寫明 note
- bug spec 如何同時約束 Presentation truncation、Domain defensive guard 與 tech debt

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Greenfield 劇情跑完後的
最終狀態；本步驟當下，BUG-001 仍掛在 active feature 底下，並在後續 closeout 後隨整個
feature 移到 `features/completed/`。只讀本篇也能看懂 BUG-001 的歸屬；若想看 active /
completed snapshot 的完整讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.zh-TW.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| `/dflow:bug-fix` 是不是另一套流程？ | 它走 modify-existing flow，但 ceremony 預設偏 lightweight，先找 expected-versus-actual boundary。 |
| bug-fix 何時需要獨立 spec？ | 這次不是 typo；它有 observable behavior、root cause、fix approach、regression tests，所以是 T2。 |
| 既有 BR 沒變，要不要更新 BR Snapshot？ | 不 regenerate；只加 note 說明 BUG-001 是 implementation-level，不是 BR-level delta。 |
| invalid surrogate 算不算新的 business rule？ | 不算。它是 malformed input / sanitization，不是主管會用來決策的業務語言。 |
| tech debt 怎麼進入系統文件？ | BUG-001 修當下 reject reason，但 broader Unicode counting strategy 留到 `tech-debt.md`。 |

## 前情提要

上一篇 [〈Walkthrough 04 — `/dflow:modify-existing` 調整 BR-007 reject reason 長度〉](walkthrough-04-modify-existing.zh-TW.md)
中，Alice 用 `/dflow:modify-existing` 把 BR-007 從單一 10 字元規則調整成雙語長度規則：

```text
Reject 必須附註原因；
ApprovalReason 至少 5 個中文字或至少 10 個英數字，
否則 raise DomainException；
空白不計，半形 / 全形視覺等價，emoji 算字。
```

這個 T2 lightweight change 已在五一連假前 implement，並上線給幾位主管試用。
因此，到本篇開始時，Carol 輸入的「金額對不上👍」本來應該通過：

| 輸入 | BR-007 判斷 |
|---|---|
| `金額對不上` | 5 個中文字，通過。 |
| `金額對不上👍` | 5 個中文字 + 1 個 emoji 視覺字元，通過。 |
| 半形 / 全形英數混用 | normalized 後以同一類英數字計算。 |
| 全空白 | 不通過，空白不計入門檻。 |

也就是說，本篇的問題不是「規則太嚴」，而是「符合規則的輸入在送到 Domain 前被切壞」。

## 劇情背景

2026-05-04 週一，五一連假後第一個上班日，Alice 回到 office 打開 Slack，看到財務部主管
Carol 在週日晚間留下的訊息。Carol 同時也是 phase 2 小範圍試用主管之一。

```text
Carol:
我昨晚（5/3 週日加班）想 reject 一張差旅單，
理由打「金額對不上👍」（中文 5 字 + 1 個 emoji），
系統說「reject reason 不合法」。

前端字數 counter 明明寫「6 字 ✓」，
為什麼被擋？
```

Alice 用 browser dev tools 重現後發現：

```text
React reject form:
value.substring(0, maxLen)
```

這段 truncation 是 UTF-16 code unit-based。當截斷點剛好落在 emoji 的 surrogate pair 中間時，
前端會送出包含 unpaired surrogate 的 invalid string。API 收到 payload 後進入 Domain，
`ApprovalReason` 在 length calculation path 遇到 malformed input，拋出 generic error。

Alice 在 AI coding agent 裡輸入：

```text
Alice:
五一連假回來就有 bug。
Carol 昨晚加班 reject 一張差旅單，
理由打「金額對不上👍」。

前端 counter 顯示「6 字 ✓」，
但 API 回「reject reason 不合法」。

我用 dev tools 看，
React form 的 value.substring(0, maxLen)
把 emoji surrogate pair 截一半，
送到 API 變 invalid string，
Domain 的 ApprovalReason 在 length 計算時炸掉。

/dflow:bug-fix
```

這段輸入已經包含 bug-fix 需要的三件事：

| 資訊 | 用途 |
|---|---|
| Expected behavior | `金額對不上👍` 應符合 BR-007。 |
| Actual behavior | UI counter 顯示 OK，但 API 拒絕。 |
| Suspected root cause | React `substring` 切壞 emoji surrogate pair。 |

## Before Dflow speaks

如果沒有 Dflow，Alice 很可能會直接把前端 `substring` 改掉，然後補一個 test。這樣可以修掉
眼前 bug，但會留下幾個 review 風險：

| 風險 | 後果 |
|---|---|
| bug 被誤判成 BR change | Reviewer 可能以為 BR-007 又要修改，或要求新增 BR-008。 |
| BR Snapshot 被不必要 regenerate | `_index.md` current state 看起來像規則變了，但其實 wording unchanged。 |
| Domain guard 被忽略 | 前端修好後，API / batch / test harness 仍可能送 malformed input。 |
| broader i18n 被偷塞進 T2 | 小 bug-fix 擴張成全系統字元計數策略重設計。 |

Dflow 的價值是把 bug fix 分成三層：現在要修的 defect、仍然不變的 business rule、需要另外追蹤的
architecture tech debt。

## Step 1 — `/dflow:bug-fix` 先判定 T2 Light

Dflow 先釐清 `/dflow:bug-fix` 的性質：

```text
Dflow:
收到。這是 /dflow:bug-fix，
不是 Git Flow 的 hotfix branch；
它走 modify-existing flow 的 lightweight ceremony。

我先跑 Step 1：Assess the Change。
這一步同時判斷 Ceremony Tier、Feature Linkage、Affected Layer。
```

Tier 判定：

```text
Dflow:
Part A — Tier 判定：

- T1 Heavy？否。
  沒有新的 Aggregate、Domain Event、資料結構或新的 business rule；
  BR-007 wording 不變。

- T2 Light？是。
  這是 production trial 回報的 logic bug，
  會改 Presentation 截字邏輯、補 Domain guard 與測試；
  不是單純 copy / 色彩 / typo。

- T3 Trivial？否。
  雖然 BR 不變，但這不是 _index.md inline row 能描述的純表面修正；
  需要獨立 lightweight spec 記錄 root cause、fix approach 和 regression tests。

結論：T2 Light。
```

Alice 確認：

```text
Alice:
對，這次不是改規則。
Carol 的文字本來就應該過，
是前端把 emoji 切壞。
```

這是本篇第一個 lesson：**bug-fix 不等於最小 ceremony。**

若只是 typo 或 copy，可以是 T3。若 bug 揭露新的業務規則或 Aggregate redesign，可能升級 T1。
這次介於中間：沒有 BR Delta，但有 observable behavior、root cause、fix approach、
implementation tasks 與 regression tests，所以是 T2。

## Step 1 Part B — Host feature 掛回 active SPEC-001

Dflow 接著找 host feature：

```text
Dflow:
Part B — Feature Linkage。

我掃 active feature，這個 bug 明確掛在：

dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/

Host feature = SPEC-20260428-001-employee-submit-expense，
status 還是 in-progress，
所以可以直接在 active feature directory 裡新增 T2 bug lightweight spec。
```

這裡 host feature 判斷很直接：bug 發生在同一個 employee-submit-expense feature 的 supervisor
reject flow，而且 BR-007 是前一段同 feature 的 T2 lightweight change。

如果 feature 已經 completed，Dflow 就要進 completed-feature reopen detection，視情況建立
follow-up feature。但本篇發生時還在 active feature 中，因此 BUG-001 直接掛在同一個 directory。

## Step 1 — BUG-NUMBER 命名

Dflow 建議用 BUG-NUMBER 格式：

```text
Dflow:
檔名我建議用 BUG-NUMBER 格式：

BUG-001-emoji-surrogate-truncation.md

T2 有兩種合法命名：
lightweight-{date}-{slug}.md 或 BUG-{NUMBER}-{slug}.md。

上一段已示範 date-based lightweight；
這次是試用期間第一個明確 bug，
使用 BUG-001 可以讓 bug queue、Slack 訊息和 regression tests 對齊。
```

Alice 同意：

```text
Alice:
好，就用 BUG-001-emoji-surrogate-truncation.md。
這樣 tutorial 也剛好示範兩種命名。
```

本步驟當下路徑是：

```text
dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/
└── BUG-001-emoji-surrogate-truncation.md
```

完整文件範例在後續 closeout 後位於：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md)

這是本篇第二個 lesson：**BUG-NUMBER 是 traceability 介面。**

`BUG-001` 讓 Slack 回報、bug spec、regression test 名稱和 feature `_index.md` 的 lightweight row
能用同一個識別碼對齊。

## Step 1 Part C — Affected Layer：Presentation primary, Domain secondary

Dflow 標出主要與次要 layer：

```text
Dflow:
Primary layer = Presentation。
真正的 defect 是 React form 用 UTF-16 code unit-based substring
截斷使用者輸入，導致 payload 變成 invalid Unicode。

Secondary layer = Domain。
ApprovalReason 是 Value Object，仍應防衛 malformed input：
先做 Unicode normalization，再偵測 invalid surrogate，
並拋明確的 InvalidApprovalReasonException，
不要讓 generic length calculation error 外洩。
```

這裡的分層很重要：

| Layer | 責任 |
|---|---|
| Presentation | 不要在 UI truncation 階段切壞使用者輸入；counter 與 truncation 策略一致。 |
| Domain | 即使收到 malformed input，也要明確拒絕，不讓泛用 calculation error 外洩。 |
| Business Rule | BR-007 wording unchanged；有效輸入仍依雙語長度規則判斷。 |

## Step 1.5 / 1.6 — 不 reopen、不開 follow-up feature

Dflow 做 completed-feature guard：

```text
Dflow:
Step 1.5 — Completed-feature reopen detection：skip。

跳過理由：host feature 在 dflow/specs/features/active/，
不是 completed feature，不觸發 completed-feature reopen。

Step 1.6 — Create Follow-up Feature：skip。

跳過理由：沒有 completed feature follow-up；
BUG-001 直接掛在 active feature 下。
```

這個 guard 和 walkthrough 04 一樣，但語意不同：04 是 rule modification，05 是 bug-fix。
兩者都掛在 active feature 下，因為當時整個 feature 尚未 `/dflow:finish-feature`。

## Step 2 — Check Documentation：確認 BR-007 已是新規則

Dflow 進入 Step 2：

```text
Dflow:
Step 2 我會先讀現有文件，不直接改程式：

- _index.md
- lightweight-2026-04-30-approval-reason-bilingual-length.md
- aggregate-design.md
- dflow/specs/domain/Expense/rules.md
- dflow/specs/architecture/tech-debt.md
```

Dflow 讀到 baseline：

```text
- BR-007 source-of-truth 已是 bilingual length rule：
  至少 5 個中文字或至少 10 個英數字，
  空白不計，半形 / 全形視覺等價，emoji 算字。

- aggregate-design.md 已把 ApprovalReason 放在 ApprovalDecision / Reject path。

- 這次沒有新的 Domain concept、event、model、BC 或 glossary term。

- tech-debt.md 還是 init-project 建出的 baseline table，
  適合承接這次發現的 i18n 字數策略債務。
```

這是本篇第三個 lesson：**先讀 baseline，才能知道 bug 是 implementation mismatch。**

如果 Dflow 沒讀 04 的 lightweight spec 和 `rules.md`，它可能會把 Carol 的回報誤判成
「BR-007 還需要調整」。讀完 baseline 後，結論變得清楚：BR-007 已經允許這個輸入，bug 在
Unicode handling。

## Step 3 — DDD Impact：no new BR, fix in place

Step 2 後，Dflow 停在 gate：

```text
Dflow:
Baseline captured — existing documentation reviewed.
Ready to assess DDD impact
(Aggregate design, Domain Events, Value Objects)?
/dflow:next or reply OK to continue.
```

Alice：

```text
Alice:
/dflow:next
```

Dflow 的 impact analysis：

```text
Dflow:
依 /dflow:bug-fix 的 ceremony adjustment，
Step 3 預設是 no DDD impact, fix in place，
除非 bug 本身在 Domain logic 或揭露 business rule 設計錯誤。

- Aggregate boundary：OK。
  ExpenseReport / ApprovalDecision 邊界不變。

- Domain Events：不新增、不改 payload。
  ExpenseReportRejected 還是 reject 成功後 raise。

- Value Object：有小幅 implementation guard。
  ApprovalReason constructor 要 normalize + detect invalid surrogate，
  但不改 VO 對外語義。

- Data structure：無 migration、無 column、無 index。

- BR Snapshot：不 regenerate。
  因為沒有 ADDED / MODIFIED / REMOVED / RENAMED BR；
  BR-007 wording unchanged。
```

這是本篇第四個 lesson：**Domain guard 可以改，但 BR 不一定變。**

`ApprovalReason` 的 constructor 會更防衛 malformed input，但對外語義仍是同一條 BR-007。
因此不應把 `_index.md` Current BR Snapshot 重新產生成一個看似新版本的 BR。

## Step 3 — 為什麼不新增 BR-008

Alice 問：

```text
Alice:
我想確認一下：
要不要補一條 BR-008？
例如「invalid surrogate / 不可見字元如何計算字數」。
```

Dflow 拆成三個問題：

```text
Dflow:
1. 這是財務主管會用來決策的業務語言嗎？
   不是。Carol 的需求是：
   「這個原因看起來 6 字且符合規則，為什麼被擋」。

2. invalid surrogate 是有效 user intent 嗎？
   不是。它是 UI / transport 層產生的 malformed string，
   不是主管刻意輸入的一種業務內容。

3. BR-007 現在是否已涵蓋 Carol 的案例？
   是。中文 5 字 + emoji 算 visual character，
   本來就應該通過。
```

結論：

```text
Dflow:
不新增 BR-008。
把 invalid surrogate 視為 input sanitization / defensive programming，
而不是 BR 層級規則。
```

這段是本篇最容易被低估的設計判斷。不是所有 technical edge case 都應該升成 business rule。
如果把 invalid surrogate 建成 BR-008，domain language 會被 implementation artifact 污染。

## Step 3 — Tech debt 不塞進 T2 bug-fix

Dflow 同時指出一個更大的問題：

```text
Dflow:
這次暴露出一個技術債：
整個系統未來應該定義 user-facing length limit
到底用 grapheme cluster、code point 還是 UTF-16 unit。

這不該塞進 BR-007，
也不該在這個 T2 擴張成全 i18n 重構。
我會記到 dflow/specs/architecture/tech-debt.md。
```

這是本篇第五個 lesson：**bug-fix 可以發現 tech debt，但不必一次還完。**

本篇要修的是 reject reason surrogate truncation。全站 user-facing length limit strategy 是更大的
architecture decision，應該獨立追蹤。

## Step 3 — Implementation tasks

Dflow 產生 T2 task list：

```markdown
- [ ] PRESENTATION-1: replace reject reason substring truncation with grapheme-aware truncation
- [ ] PRESENTATION-2: counter 與 truncation 共用同一套 counting strategy
- [ ] DOMAIN-1: ApprovalReason input normalize to NFC
- [ ] DOMAIN-2: invalid surrogate detection + InvalidApprovalReasonException
- [ ] TEST-1: React truncation 不切壞 金額對不上👍，counter 仍顯示 6 字 ✓
- [ ] TEST-2: ApprovalReason("金額對不上👍") pass
- [ ] TEST-3: 手動構造半個 surrogate input，應 raise InvalidApprovalReasonException
- [ ] TEST-4: API / integration test 確認 reject flow 正常
- [ ] DOC-1: 更新 _index.md Lightweight Changes 和 tech-debt.md；不 regenerate BR Snapshot
```

Dflow 加上 scope guard：

```text
Dflow:
如果開始討論全站 i18n 字串處理、共用 ICU library
或所有欄位的長度策略，
就要停下來另開 proposal / phase。
```

T2 tasks 的形狀很清楚：前端修 truncation、Domain 修 defensive guard、tests 保護 regression、
docs 記錄 BUG-001 與 tech debt。

## Step 4 — 這段 tutorial 不寫 ExpenseTracker code

Dflow 問是否要實作：

```text
Dflow:
DDD impact analysis done —
Aggregate boundary OK, no new events, no new BR；
ApprovalReason only gets defensive implementation guard.

Ready to implement?
/dflow:next to proceed, or adjust the design first.
```

Alice 決定先落地 bug spec 與 docs：

```text
Alice:
先把 bug spec 和 docs 落地。
我等同事早會確認後，
再改 React form、VO 和測試。
這個 tutorial repo 不寫實際 ExpenseTracker code。
```

Dflow 回：

```text
Dflow:
OK。Step 4 code implementation 不在本段 tutorial 輸出範圍內；
我會保留 Implementation Tasks unchecked，
代表 bug-fix implementation 是下一個動作。
```

這和 walkthrough 04 的節奏一致：tutorial 展示 Dflow 的 spec / documentation package，
不在 repo 內假造應用程式碼。

## Step 5 — Update Documentation

Dflow 宣告 Step 5：

```text
Dflow:
Step 5 — Update Documentation。

我會做三件事：

1. 新增 T2 bug lightweight spec：
   BUG-001-emoji-surrogate-truncation.md

2. 更新 _index.md：
   - Lightweight Changes 表新增 2026-05-04 / T2 row。
   - Description 寫「Bug-fix: 前端 substring 截斷 emoji surrogate pair 導致 reject reason 被拒」。
   - Current BR Snapshot 不 regenerate。
   - 明示理由：BR-007 wording unchanged，root cause 是 implementation-level。

3. 更新 dflow/specs/architecture/tech-debt.md：
   - 新增 Unicode character counting strategy under i18n。
   - source = BUG-001。
   - scope = ApprovalReason VO + future user-facing length limits。
```

Alice 特別要求：

```text
Alice:
BR Snapshot 不 regenerate 這點幫我寫清楚，
reviewer 很可能會問。
```

Dflow：

```text
Dflow:
會。我會在 _index.md Current BR Snapshot 下加一行 note：
BUG-001 沒有 BR wording 變更，
因此 snapshot 保持 2026-04-30 的 BR-007 當前狀態；
這不是漏更。
```

這是本篇最重要的 documentation lesson：**沒有 BR Delta 時，不要為了看起來有更新而 regenerate snapshot。**

## 文件片段 1 — BUG-001 Problem

完整文件範例：
[`BUG-001-emoji-surrogate-truncation.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md)

Problem 把 expected / actual / root cause 收斂在一起：

```markdown
2026-05-04 早上，財務部主管 Carol 回報：
她在 2026-05-03 週日加班時想 reject 一張差旅單，
退回原因輸入「金額對不上👍」。
前端 counter 顯示「6 字 ✓」，
但送出後 API 回應「reject reason 不合法」。

Alice 用 browser dev tools 重現後確認：
React form 在限制 reject reason 長度時使用 value.substring(0, maxLen)，
在 emoji 的 UTF-16 surrogate pair 中間截斷。
```

spec 也明確說明：

```markdown
這是 bug-fix，不是新的審核需求。
BR-007 的 rule wording 維持不變；
修正範圍是 Presentation Layer 的截字邏輯，
以及 Domain Layer 對 malformed Unicode input 的防衛與錯誤訊息。
```

這兩句讓 reviewer 不會把 BUG-001 看成新規則設計。

## 文件片段 2 — Behavior Delta 是 implementation behavior modified

BUG-001 的 Delta 故意不寫成 BR modified：

```markdown
### MODIFIED - implementation behavior modified in this fix

#### Rule: BR-007 Reject 必須附註原因

**Before**:
Given 一份 ExpenseReport 處於 Submitted 狀態
And ApproverId != SubmitterId
When 主管在 React reject form 輸入 金額對不上👍
And 前端 counter 顯示 6 字 ✓
And form 用 substring(0, maxLen) 截斷 value
Then payload 可能包含 invalid surrogate
And ApprovalReason 在字數計算時拋出泛用錯誤
And reject 被拒絕。

**After**:
Given 同樣輸入 金額對不上👍
When React reject form 需要限制長度
Then Presentation Layer 使用 grapheme-aware 截斷，
不會切開 surrogate pair
And payload 保持 valid Unicode string
And ApprovalReason normalize 後依 BR-007 接受該 reason，
reject 可繼續完成。

**Reason**:
BR-007 本身已允許中文短語與 emoji 視覺字元；
錯誤在 implementation-level Unicode handling，
而不是 business rule wording。
```

ADDED / REMOVED / RENAMED 都是 none；UNCHANGED 明確列 BR-001..007，並特別寫：

```text
BR-007 wording unchanged — root cause is implementation-level, not BR-level.
```

## 文件片段 3 — Fix Approach 分成 Presentation 與 Domain

Fix Approach 先修主要缺陷：

```markdown
主要修正在 Presentation Layer：

- 將 value.substring(0, maxLen) 改成 grapheme-aware 截斷。
- 可用時優先使用 Intl.Segmenter 做 visual-character 分段。
- 使用 Array.from(str) 作為最低 fallback，確保 surrogate pairs 不會被切開。
- 確保 reject reason input 的可見 counter 與截斷後的 value 使用相同計數策略。
```

再補 Domain 防衛：

```markdown
次要防衛在 Domain Layer：

- 在 length checks 前，將 ApprovalReason input normalize 成 Unicode NFC。
- 在 counting characters 前偵測 invalid / unpaired surrogate。
- 對 malformed Unicode input 拋出明確訊息的 InvalidApprovalReasonException。
- BR-007 thresholds 維持不變；不要新增 BR-008。
```

這段把「修 bug」與「不改規則」放在同一個 implementation contract 裡。

## 文件片段 4 — `_index.md` 不 regenerate BR Snapshot

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)

Lightweight Changes 表新增 BUG-001：

```markdown
| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-04 | T2 | Bug-fix: 前端 substring 截斷 emoji surrogate pair 導致 reject reason 被拒。見 BUG-001-emoji-surrogate-truncation.md | {pending} |
```

Current BR Snapshot 保持 walkthrough 04 的 BR-007 current state：

```markdown
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 | phase-2 (supervisor-approval) | lightweight-2026-04-30 | active |
```

然後加 note：

```markdown
2026-05-04 BUG-001 note：
Current BR Snapshot 刻意不重新產生。
BR-007 文字不變；
根因是 implementation-level Unicode truncation / sanitization，
不是 BR-level delta。
```

這就是本篇和 walkthrough 04 的關鍵差異：

| Walkthrough | BR-007 wording | `_index.md` Current BR Snapshot |
|---|---|---|
| 04 modify-existing | 有 BR wording delta | regenerate |
| 05 bug-fix | wording unchanged | intentionally unchanged + note |

## 文件片段 5 — `tech-debt.md` 只記 broader strategy

完整文件範例：
[`outputs/dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md)

BUG-001 加入一筆 architecture debt：

```markdown
| Unicode i18n 下的字元計數策略 | Domain / Presentation |
2026-05-04 由 BUG-001 回報。
Reject reason bug 暴露出使用者可見的長度限制目前還沒有共用的字元計數策略。 |
範圍：ApprovalReason VO 與未來任何使用者可見的長度限制。 |
建議做法：評估 grapheme cluster、codepoint、UTF-16 unit 三種語意；
標準化共用 helper；
Presentation 可用時使用 Intl.Segmenter，
並評估 Domain 端計數的 ICU library 支援。 |
open |
```

Follow-up Notes 補清楚邊界：

```markdown
BUG-001 只修 reject reason truncation 與 Domain malformed-input handling。
更廣泛的 i18n 字元計數 policy 應該作為獨立 architecture review 處理，
不要擴張到這次 T2 bug-fix 裡。
```

這讓未來 reviewer 能看懂：為什麼 bug spec 沒有把所有 Unicode strategy 一次解完。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md) | T2 bug spec：Problem、implementation behavior delta、root cause、fix approach、tasks。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md) | Lightweight Changes row；Current BR Snapshot intentionally unchanged note。 |
| 修改 | [`outputs/dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md) | Unicode character counting strategy under i18n 的 follow-up debt。 |
| 故意不改 | `outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md` | `ApprovalReason` VO 結構不變，只補 implementation guard。 |
| 故意不改 | `outputs/dflow/specs/domain/Expense/rules.md` | BR-007 wording 不變，沒有 BR-008。 |
| 故意不改 | `outputs/dflow/specs/domain/Expense/{models,events,context}.md` | 沒有新 model、event、BC 或資料結構。 |
| 故意不改 | `outputs/dflow/specs/domain/{glossary,context-map}.md` | 沒有新 ubiquitous language term 或 context relationship。 |

上表連到完整文件範例；本篇只關注 BUG-001 這個 T2 bug-fix step。

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Hybrid workflow control | `/dflow:bug-fix` 先做 tier / host / layer 判斷，不直接改 code。 |
| Spec-first development | BUG-001 spec 和 tasks 先落地，implementation 保持 unchecked。 |
| DDD semantic backbone | Dflow 區分 BR-007 business wording、`ApprovalReason` defensive guard、Unicode tech debt。 |
| 三層文件分工 | bug spec 管 defect delta，`_index.md` 管 feature snapshot note，`tech-debt.md` 管 broader architecture follow-up。 |
| Drift verification readiness | Regression tests、expected-vs-actual、root cause 與 BR Snapshot note 都能支援後續 PR review。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| bug 被誤當規則修改 | Reviewer 要求改 BR-007 或新增 BR-008。 | BUG-001 明確寫 BR wording unchanged。 |
| Snapshot 被亂更新 | `_index.md` 看起來像 BR-007 又被改過一次。 | Current BR Snapshot intentionally unchanged，並加 note。 |
| 前端修完但 Domain 無防衛 | 其他入口送 malformed input 仍爆 generic error。 | Domain secondary task 要 normalize + invalid surrogate detection。 |
| T2 擴張成 i18n 專案 | 開始討論所有欄位、ICU、全站 helper。 | broader strategy 進 `tech-debt.md`，不塞進 BUG-001 scope。 |
| bug 無法回歸驗證 | 只改 code，沒有 test naming / scenario。 | BUG-001 tasks 明確列 Presentation、Domain、API regression tests。 |

## 對不熟 bug-fix path 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **這是規則錯，還是 implementation 錯？**
   本篇答案是 implementation 錯。BR-007 已允許 `金額對不上👍`。

2. **為什麼要有 BUG-001 spec？**
   因為這不是 typo；它影響 observable reject flow，需要 root cause、fix approach 和 tests。

3. **為什麼不新增 BR-008？**
   invalid surrogate 不是業務語言，而是 malformed input。不要讓 implementation artifact 污染 BR index。

4. **為什麼不 regenerate BR Snapshot？**
   沒有 BR wording delta。Snapshot 仍代表 current business rules；BUG-001 只在 note 和 lightweight row 中留下 trace。

Bug-fix path 的價值，是讓團隊修掉真實缺陷，同時不把 bug 的技術細節誤寫成新的 domain rule。

## Key takeaways

- `/dflow:bug-fix` 走 modify-existing flow 的 lightweight ceremony；它不是 Git branch hotfix 的同義詞。
- T2 bug spec 要記錄 expected-versus-actual、root cause、fix approach、regression tasks。
- BUG-NUMBER 命名適合試用或 production 回報的明確 defect。
- BR-007 wording unchanged 時，Current BR Snapshot 不 regenerate；用 note 說明原因。
- `ApprovalReason` 可以新增 defensive guard，但不代表要新增 BR。
- 更廣泛的 Unicode counting strategy 屬 architecture tech debt，不塞進這次 T2 fix。

## 下一個 walkthrough

下一個 Greenfield walkthrough 可接 [〈Walkthrough 06 — `/dflow:finish-feature` 收尾第一個 Expense feature〉](walkthrough-06-finish-feature.zh-TW.md)：
Alice 把 `SPEC-20260428-001` 收尾，整理 Integration Summary，將 feature directory 從 active
移到 completed，並說明完成後未來變更應透過 follow-up feature，不再直接追加到 completed
feature directory。
