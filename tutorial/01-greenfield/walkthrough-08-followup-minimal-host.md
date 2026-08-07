# Walkthrough 08 — completed feature 上的 orphan bug：`/dflow:bug-fix` 開 follow-up 最小 host

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

上一篇的變更**和任何 feature 都無關**，所以 Dflow 開了一個 standalone 最小 host。
本篇是另外一半：這次的 bug **明確屬於** `SPEC-20260428-001-employee-submit-expense`——
但那個 feature 已經在 walkthrough 06 收進 `completed/` 了。

completed feature 是凍結歷史，**不能**直接追加 T2 / T3。那這個 bug 要記到哪裡？

答案是 **follow-up 最小 host**：一個帶著 `follow-up-of` 連回原 feature 的新 host，
零 phase，走 `bugfix/BUG-*` branch，收工後再用一個**不入任何 ledger** 的 tracking commit
把原 feature 的 Follow-up Tracking 翻成 `completed`。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| completed feature 出 bug 了怎麼辦？ | Step 1.5 的 A/B/C 提示 → Option A → Step 1.6 的 minimal 變體。 |
| 為什麼不能直接改 completed 目錄？ | 「completed ＝ 凍結」是不變式；一旦可以追加，歸檔就不再代表任何事。 |
| follow-up 和 standalone 差在哪？ | 差在**血緣**：`follow-up-of` metadata ＋ 原 feature 的 reverse-link 兩次狀態轉換。 |
| 功能性 bug 的 branch 長什麼樣？ | `bugfix/BUG-{NUMBER}-{slug}`，**不是** `feature/`。而且 closeout **不會**把它改寫掉。 |
| 那個 flip commit 算不算 checkpoint？ | 不算。它是 sanctioned post-completion mutation，**兩邊的 Checkpoint Log 都不記**。 |
| follow-up 會不會被迫產出 phase-spec？ | 不會。minimal 變體**不委派** new-feature Step 4 的無條件 first phase-spec。 |

## 前情提要

- [〈Walkthrough 05〉](walkthrough-05-bug-fix.md) 的 BUG-001 掛在**還是 active** 的
  `SPEC-20260428-001` 底下——那時候直接放進 feature 目錄就好。
- [〈Walkthrough 06〉](walkthrough-06-finish-feature.md) 把整個 feature 收進 `completed/`。
- [〈Walkthrough 07〉](walkthrough-07-standalone-minimal-host.md) 示範了與任何 feature
  都無關的 standalone 最小 host。

本篇的差別一句話講完：**同樣是 bug，host 已經凍結了。**

## 劇情背景

2026-05-12 週二，財務主管 Carol 又回報一件事：

```text
Carol:
我 reject 一張單、理由打了「金額對不上，請附收據」，
系統說成功。
但我回到列表看，那張單還是 Submitted，
沒有變成 Rejected。

重新整理也一樣。
```

Alice 重現後找到根因：`ApprovalDecision` 建立成功、`ExpenseReport.Reject()` 也呼叫了，
但 Application 層的 `SaveChangesAsync()` 只存了 `ApprovalDecision` 那個 Aggregate，
`ExpenseReport` 的狀態變更沒有被 flush。

```text
Alice:
Carol 回報 reject 後 ExpenseReport 狀態沒變。
ApprovalDecision 有建立，但 ExpenseReport.Reject() 的狀態變更沒存進去。
Application 層 SaveChangesAsync 漏掉一個 Aggregate。

/dflow:bug-fix
```

## Step 1 Part A — Tier：T2

```text
Dflow:
先講清楚：/dflow:bug-fix 走的是 modify-existing flow，
tier 由 cascade 判定、不由命令決定。

Part A cascade：
- 步驟 0（新東西 / observation-only？）否。既有行為的缺陷。
- 步驟 1（T1？）否。
  BR-002 / BR-006 文字都不變，沒有新 Aggregate、
  沒有 Domain 概念結構變更、沒有資料結構或破壞性契約變更。
  這是**持久化沒做完**，不是規則錯。
- 步驟 2（Dflow 不追蹤？）否。使用者看得到的行為壞了。
- 步驟 3（T3？）否。
  這不是顯示文字修正；它有 observable behavior、root cause、
  fix approach 和 regression test，一行 inline row 描述不了。
- 步驟 4（T2，catch-all）→ **命中**。

結論：T2。而且這是**功能性 bug**——這一點等一下決定 branch。
```

## Step 1 Part B — host 掃描：命中 completed

```text
Dflow:
Part B：

1. Active features：掃 active/*/_index.md → 空的。

2. Completed features：掃 completed/*/_index.md 的 Goals & Scope
   → **命中** SPEC-20260428-001-employee-submit-expense。
     它的 phase 2 就是「主管端 Approve / Reject」，
     BR-002 明說「被 Reject 後可重新編輯並再次 Submit」。
     這個 bug 正落在它交付的行為上。

   這是 **completed-feature-reopen** 的情況 → Step 1.5。

3. Standalone：不適用（第 2 項已命中）。

4. In-flight overlap scan：沒有重疊。
```

注意順序：**第 2 項命中就不會走到第 3 項。** 上一篇的錯字是第 2 項落空才進 standalone 的。
兩篇的差別完全由這一步決定。

## Step 1.5 — A / B / C 提示

Dflow **不會**自己決定這是不是 follow-up，它會問：

```text
Dflow:
我注意到這個變更與 completed feature
`SPEC-20260428-001-employee-submit-expense` 重疊
（Goals & Scope：「讓員工能在差旅或公務結束後，建立並提交一份完整的費用申報單
給主管審核……」，完成於 2026-05-07）。

這是那個 feature 的 follow-up，還是一個獨立的新需求？

Option A — follow-up of SPEC-20260428-001-employee-submit-expense
  → 建一個新 SPEC-ID 的 feature，並以 follow-up-of 連回原 feature。

Option B — 獨立新需求
  → 依 Part A 判定的 tier 分流：T2 / T3 走 Step 1.7（standalone），
    與原 completed feature 不建立任何連結。

Option C — 只是個小調整，不需要新 feature
  → 拒絕。completed feature 是凍結的——即使是 T3 inline row
    也必須住在一個新的 follow-up feature 目錄裡。
```

Alice 選 A：

```text
Alice:
A。這就是 phase 2 那段 reject flow 沒做完，
血緣要留著，不然三個月後沒人知道這個 bug 屬於哪個 feature。
```

這是本篇第一個 lesson：**「獨立 standalone」和「follow-up」不是 Dflow 猜的，是開發者決定的。**

如果選了 B，這個 bug 會被當成一個與費用申報無關的獨立變更歸檔——`follow-up-of` 不會寫、
原 feature 的 reverse-link 不會建，血緣就斷了。Option B 存在是因為**有時候它真的是對的**
（同一塊程式碼、完全不同的需求），但這次不是。

## Step 1.6 — follow-up 的 minimal 變體

```text
Dflow:
Step 1.6：Create Follow-up Feature。

Part A 判的是 **T2**，所以走**最小（zero-phase）變體**：
它不委派 new-feature Step 4 那個**無條件**建立 first phase-spec 的動作。

如果委派了，一個「Application 層漏存一個 Aggregate」的修正
會被迫產出一份 T1 規格的 phase-spec——那是 ceremony 錯配。

最小變體借用 Step 1.7 的 mechanics，但**只借 2–4 步**：

  2. 配識別碼：
     - 新 SPEC-ID（**不重用**原 feature 的）：SPEC-20260512-001
     - 這是**功能性 bug** → 另配 BUG-NUMBER。
       掃 dflow/specs/** （active + completed）既有 BUG-*：
       只有 BUG-001（walkthrough 05）。max+1 → **BUG-002**。
     - Collision check：無同名目錄、無同名 branch。

  3. 建最小 _index.md：七段齊全、Phase Specs **空表**、
     follow-up-of: SPEC-20260428-001（**必填**）。

  4. Branch gate — 依 change class：
     功能性 bug → **bugfix/BUG-002-reject-not-persisted**
     （**不是** feature/。new-feature 的路徑 hardcode feature/，
       最小變體在這裡覆寫它。）

Step 1.7 的**第 1 步不適用**——那是 standalone 的分類閘門，
而你已經在 Step 1.5 把這個 case 分類成 follow-up 了。
```

這是本篇第二個 lesson：**branch 跟著 change class 走，不是跟著「host 怎麼開的」走。**

一個功能性 bug 的 follow-up host **就是**一個 bugfix host。它的 `_index.md` `branch:` 欄
從頭到尾是 `bugfix/BUG-002-*`，而且——下面會看到——closeout **不會**把它改寫回 `feature/`。

## Step 1.6 — reverse-link：開，而且要「開」得看得見

```text
Dflow:
我同時更新原 feature 的 _index.md：
dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md

打開（或新增）Follow-up Tracking 段，加一列：

| SPEC-20260512-001 | reject-not-persisted | 2026-05-12 | in-progress |

這一列**現在**就要建成 in-progress，而且**跟著 checkpoint 1 一起 commit**。
```

Alice 問了一個好問題：

```text
Alice:
反正 closeout 之後會翻成 completed，
中間這個 in-progress 有什麼用？
```

```text
Dflow:
它讓「absent → in-progress → completed」這段歷史真的發生過。

如果初始那一列沒建，Step 6 的 flip 會**直接建出一列 completed**——
最終狀態看起來一模一樣，但原 feature 從來沒有任何時刻顯示
「有一個 follow-up 正在進行中」。

所以 finish-feature 在最小 follow-up host 上會檢查這件事，
而且是從 **checkpoint 1 那個 commit 的 blob** 讀原 feature 的 _index.md：
那一列必須當時就在，且 Status = in-progress。
不在就擋下 closeout。
```

還有一個容易做錯的細節：

```text
Dflow:
另外——最小變體**不會**提議一個獨立的 host-open commit。

T1 的 follow-up 可以先 commit「建 host + 初始 reverse-link」，
因為 phase-bearing host 的 commit 數本來就不固定。
但最小 host 恰好兩個 checkpoint，多開一個 host-open commit
會讓它變成三個。

所以初始 reverse-link 的編輯**騎進 checkpoint 1**，和實作一起。
```

## 產出 1 — follow-up 最小 host（checkpoint 1 之前）

完整文件範例：
[`outputs/.../SPEC-20260512-001-reject-not-persisted/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260512-001-reject-not-persisted/_index.md)

```markdown
---
spec-id: SPEC-20260512-001
slug: reject-not-persisted
status: in-progress
created: 2026-05-12
branch: bugfix/BUG-002-reject-not-persisted
follow-up-of: SPEC-20260428-001
---

# Reject 後 ExpenseReport 狀態未持久化

## Goals & Scope

> 本 feature 為 `SPEC-20260428-001-employee-submit-expense` 的 follow-up，
> 原 feature 完成於 `2026-05-07`，
> 詳見 `completed/SPEC-20260428-001-employee-submit-expense/_index.md`。

...
```

`## Phase Specs` 一樣是**空表**，`## Lightweight Changes` 有一列 T2 外連到
`BUG-002-reject-not-persisted.md`。

## 產出 2 — T2 的 spec 檔與它必須宣告的東西

完整文件範例：
[`outputs/.../BUG-002-reject-not-persisted.md`](outputs/dflow/specs/features/completed/SPEC-20260512-001-reject-not-persisted/BUG-002-reject-not-persisted.md)

和 walkthrough 05 的 BUG-001 一樣，這份 spec 用 no-BR 家族 (e)：

```markdown
## Behavior Delta

BR Delta: none — implementation defect
Governing BR-IDs: BR-002, BR-006
```

規則沒錯，實作漏了。`Governing BR-IDs` 保留「這個缺陷歸哪幾條規則管」的追溯線。

但最小 host 多要求一件 BUG-001 當年不需要的東西：

```markdown
## Implementation Paths

- `src/Application/Expense/RejectExpenseReportHandler.cs`
- `src/Infrastructure/Persistence/ExpenseUnitOfWork.cs`
```

```text
Dflow:
最小 host 的每一列都要能指出這次變更碰到的原始碼路徑。
T2 由 lightweight-spec 的 ## Implementation Paths 段承載，
Lightweight Changes 的 row 只要外連過去就好。

closeout 會拿 checkpoint 1 的 diff 跟這些路徑比對。
**一個路徑都沒宣告會擋下 closeout。**

（掛在 phase-bearing feature 底下的 row 不受此限——
 那裡沒有這道 gate。BUG-001 當年就沒被要求。）
```

## checkpoint 1 — 一個 commit，三樣東西

```text
Dflow:
已 commit：7c41e8d
  [SPEC-20260512-001] BUG-002 persist ExpenseReport state on reject (T2);
  add follow-up reference to SPEC-20260512-001

這個 commit 帶著：
- 實作（RejectExpenseReportHandler.cs、ExpenseUnitOfWork.cs）
- 這個 host 的 _index.md + BUG-002 spec
- **原 feature 的 _index.md**（初始 reverse-link，in-progress）

這是 checkpoint 1。到目前為止這條 branch 上**只有這一個 commit**。
```

## Finalize + closeout

```text
Dflow:
finalization（T2）：
- BUG-002 spec 的 frontmatter status → completed
- 回填兩個 commit evidence 面：
    Checkpoint Log Result → committed (7c41e8d)
    Lightweight Changes row 的 Commit 欄 → 7c41e8d
- Current BR Snapshot：這個 host 是 **BC-bearing**（Expense），
  所以要**繼承 baseline**，不是留空。

  Step 1.6：BC-bearing 的 follow-up 要讀該 BC 的 rules.md，
  把與本 follow-up 相關的 BR 繼承進來——
  BR-002、BR-006，每列標 First Seen = inherited from rules.md，
  Last Updated 留空。

  「留空整張表」那條規則是寫給 **no-BC** follow-up 的，本 host 不適用。

  **繼承**和**有沒有 delta** 是兩件事：
  這次沒有 BR delta（BR-002 / BR-006 的規則文字不變，
  behavior.md 的場景描述也仍然正確——它描述的就是「應該」發生的事，
  這次修的是實作沒做到那個描述），
  所以 Last Updated 全部留空、也不新增 BR；
  但 baseline 仍然要在，否則 closeout 讀不到這個 host
  治理在哪幾條規則之下。

Step 1 驗證（最小 host 相關項）：
✓ Phase Specs 空表、無 phase-spec-* 檔 → 最小 host
✓ 每一個 spec 檔都被某一列指名（BUG-002 ← Tier=T2 那列）
✓ 每一列 Commit 欄非空且通過 hash evidence
✓ checkpoint 1 碰到了宣告的實作路徑
✓ Checkpoint Log 此刻恰好一列
✓ HEAD = bugfix/BUG-002-reject-not-persisted = _index.md 的 branch:
✓ **follow-up 專項**：從 checkpoint 1 的 blob 讀原 feature 的 _index.md，
  SPEC-20260512-001 那一列在，且 Status = in-progress
```

```text
Dflow:
Step 2 — status → completed。
  **branch: 欄保持 bugfix/BUG-002-reject-not-persisted。**
  一個功能性 bug 的 host **就是** bugfix host；
  把它改寫成 feature/ 會讓 branch equality 從此對不上。

Step 4 — git mv 歸檔 + closeout commit（checkpoint 2）。

Step 5 — Integration Summary。

Step 6 — **Reverse-Update Follow-up Tracking**（本案不 skip）。
```

## 產出 3 — Step 6 的 flip：一個不入任何 ledger 的 commit

```text
Dflow:
這個 feature 有 follow-up-of: SPEC-20260428-001。
要把原 feature 的 Follow-up Tracking 那一列翻成 completed 嗎？
```

```text
Alice:
/dflow:next
```

```text
Dflow:
已 commit：e5b02a4
  [SPEC-20260512-001] flip follow-up tracking row to completed

驗證：
✓ 這個 commit 的**完整路徑集合**只有一個檔案——
  completed/SPEC-20260428-001-employee-submit-expense/_index.md。
  歸檔後的 follow-up host 目錄底下**什麼都沒有**：
  那會是第三個動到 host 的 commit，兩 checkpoint 生命週期不允許。
✓ 這個 commit 對該檔案的 patch 只有那一列的
  in-progress → completed 轉換，**沒有任何 Checkpoint Log 變動**。
```

這是本篇第三個 lesson，也是最容易被寫錯的一條：

> **flip 是 sanctioned post-completion mutation，不是 checkpoint。**
> 它**兩邊的 Checkpoint Log 都不記**——不記在 follow-up host（它已經關帳歸檔了），
> 也不記在原 feature（它的 ledger 不該被別的 feature 汙染）。

但它**必須被 commit**。它是對原 feature `_index.md` 的真實編輯；不 commit 就等於
closeout 宣稱完成、而磁碟上的狀態沒有進 git。

## 產出 4 — 收工後的 commit graph

```text
bugfix/BUG-002-reject-not-persisted：

  7c41e8d  implementation（實作 + host + BUG-002 spec + 初始 reverse-link）
  9a1d3f0  closeout（git mv 歸檔 + status flip + closeout 列）
  e5b02a4  flip（原 feature 的 Follow-up Tracking → completed）
```

**恰好三個 commit，而且只有前兩個是 checkpoint。**

| commit | 是 checkpoint？ | 記在哪個 Checkpoint Log |
|---|---|---|
| `7c41e8d` implementation | ✅ | follow-up host |
| `9a1d3f0` closeout | ✅ | follow-up host |
| `e5b02a4` flip | ❌ | **兩邊都不記** |

沒有第四個 commit，特別是**沒有獨立的 host-open commit**——最小變體不提議它。

## 產出 5 — 歸檔後 `branch:` 仍然是 `bugfix/`

```markdown
---
spec-id: SPEC-20260512-001
slug: reject-not-persisted
status: completed
branch: bugfix/BUG-002-reject-not-persisted   ← 沒有被改寫
follow-up-of: SPEC-20260428-001               ← 沒有被 Step 2 的 metadata 編輯弄丟
---
```

兩個欄位都是「closeout 最常見的兩種掉東西方式」，所以 post-commit 驗證會明確再讀一次：

- `branch:` 被改寫 → 這個 host 的 branch equality 從此對不上。
- `follow-up-of` 掉了 → Step 5 會因為讀不到它而 **skip Step 6**，原 feature 的 reverse-link
  永遠停在 `in-progress`，而 closeout 回報成功。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`.../SPEC-20260512-001-reject-not-persisted/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260512-001-reject-not-persisted/_index.md) | follow-up 最小 host：`follow-up-of`、`bugfix/` branch、空 Phase Specs、兩列 checkpoint。 |
| 新建 | [`.../BUG-002-reject-not-persisted.md`](outputs/dflow/specs/features/completed/SPEC-20260512-001-reject-not-persisted/BUG-002-reject-not-persisted.md) | T2 bug spec：no-BR 家族 (e)、`Governing BR-IDs`、**`## Implementation Paths`**。 |
| 修改 | [`.../SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md) | Follow-up Tracking 段：`absent → in-progress → completed` 的終態。 |
| 故意不建 | `phase-spec-*.md` | minimal 變體不委派 new-feature Step 4 的無條件 first phase-spec。 |
| 故意不改 | `outputs/dflow/specs/domain/Expense/rules.md` | BR-002 / BR-006 文字不變；這是實作缺陷。 |

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| completed 是真的凍結 | Option C 被拒絕；即使一行 T3 也要住在新的 follow-up 目錄。 |
| 血緣不靠記憶 | `follow-up-of` ＋ 原 feature 的 reverse-link 兩次轉換，兩邊互相指認。 |
| ceremony 跟著 tier | T2 follow-up 走 minimal 變體，不被迫產出 T1 的 phase-spec。 |
| branch 跟著 change class | 功能性 bug 的 follow-up host 是 `bugfix/BUG-*`，closeout 不改寫它。 |
| 非 checkpoint 的變更也要 commit | flip 不入任何 ledger，但必須 commit，且路徑集合被檢查。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| 直接改 completed 目錄 | 歸檔失去意義，沒有人知道哪些是原始交付、哪些是後來補的。 | Option C 明確拒絕，導向 follow-up。 |
| 血緣斷掉 | 新 bug spec 和原 feature 沒有任何互指，三個月後查不回去。 | `follow-up-of` ＋ reverse-link，且 closeout 檢查「開」的那一半。 |
| 小修被迫走重 ceremony | 為了開 follow-up 而產出一份沒人要的 phase-spec。 | minimal 變體不委派 Step 4。 |
| bugfix branch 被改寫成 feature | 歸檔後 branch equality 對不上，稽核線斷掉。 | Step 2 只翻 status；post-commit 驗證再讀一次。 |

## Key takeaways

- **completed feature 出 bug → follow-up 最小 host**，不是直接改歸檔目錄，也不是無血緣的 standalone。
- **A / B / C 由開發者決定**：Dflow 提示、不自己猜；選錯 B 會永久失去血緣。
- **新 SPEC-ID，不重用原 feature 的**；功能性 bug 另配 BUG-NUMBER（`max+1` 掃 active + completed）。
- **branch 依 change class**：功能性 bug ＝ `bugfix/BUG-*`，且 closeout **不改寫** `branch:`。
- **初始 reverse-link 騎 checkpoint 1**，沒有獨立的 host-open commit；closeout 從 checkpoint 1 的 blob 驗證那一列當時是 `in-progress`。
- **flip commit 不是 checkpoint**，兩邊 Checkpoint Log 都不記——但它必須被 commit，且只能碰原 feature 的 `_index.md`。
- 最終 commit graph 恰好三個：implementation、closeout、flip。

## 下一個 walkthrough

Greenfield 主線到這裡把三種 host 形狀都走過了：**hosted**（04 / 05）、**standalone
minimal**（07）、**follow-up minimal**（08）。

想看 Brownfield 如何處理「先看清楚 legacy 現況、再動手」的第四種形狀，可接
[〈Brownfield Walkthrough 07 — 沒有相關 feature 的 baseline capture〉](../02-brownfield/walkthrough-07-baseline-minimal-host.md)：
Bob 要捕捉一段與任何 feature 都無關的既有行為，Dflow 為它開一個 **tier-exempt** 的
baseline 最小 host，第一個 checkpoint 叫 `spec-baseline` 而不是 `implementation`。
