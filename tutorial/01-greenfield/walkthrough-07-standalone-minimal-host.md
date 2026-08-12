# Walkthrough 07 — 沒有任何 feature 可掛時：`/dflow:modify-existing` 自動開最小 host

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

前六篇的每一次修改，都掛在一個**已經存在**的 feature 底下：walkthrough 04 的 T2
lightweight change 掛在 active 的 `SPEC-20260428-001`，walkthrough 05 的 BUG-001 也是。
那是因為當時剛好有一個 active feature 在跑。

本篇處理的是另一種情況，而且它比前者常見得多：**你要改的東西跟任何 feature 都沒關係。**
`SPEC-20260428-001` 已經在 walkthrough 06 收進 `completed/`，`active/` 是空的。這時候
來了一個一行字的錯字修正——它不屬於任何 active feature，也不是任何 completed feature
的後續。

本篇要展示的，就是 Dflow 在這個情況下**不會叫你自己想辦法**：它有一條明確的路徑，
叫做 **standalone minimal host（獨立最小 host）**。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| 沒有 feature 可掛的小修改，Dflow 怎麼處理？ | Step 1 Part B 第 3 項判定 standalone → Step 1.7 開最小 host。 |
| 「最小 host」是不是就是隨便建個資料夾？ | 不是。它有 SPEC-ID、branch、七個必要段落、兩個 checkpoint，只是**沒有 phase-spec**。 |
| 為什麼一個錯字要這麼多手續？ | 因為 host ledger 的不變式（SPEC-ID／branch／checkpoint／`_index.md` 權威）不能為了省事解開。ceremony 成本用誠實揭露處理，不是偷偷拿掉。 |
| T3 不是「單一 commit」嗎？為什麼這裡有兩個？ | 「T3 ＝ 單一 commit」講的是**掛在既有 feature 底下**的 T3。最小 host 之後沒有別的 commit 可以收攏它的 row，所以不分 tier 一律兩個 checkpoint。 |
| 這個 host 什麼時候變成 completed？ | `/dflow:finish-feature` 的 zero-phase closeout；歸檔 `git mv` 就在 closeout commit 裡。 |

## 前情提要

[〈Walkthrough 06 — `/dflow:finish-feature` 收尾第一個 Expense feature〉](walkthrough-06-finish-feature.md)
結束時，ExpenseTracker 的狀態是：

```text
dflow/specs/features/
├── active/          （空的）
├── backlog/         （空的）
└── completed/
    └── SPEC-20260428-001-employee-submit-expense/
```

也就是說：**現在沒有任何 active feature。**

## 劇情背景

2026-05-11 週一早上，Alice 收到 IT 同事 David 的訊息：

```text
David:
登入頁最上面那條公告寫「歡迎使登入本系統」，
少一個「用」字。
已經掛兩個月了，今天有新同事問我是不是壞了。
```

Alice 看了一眼 `LoginBanner.cs`：

```csharp
public const string Banner = "歡迎使登入本系統";
```

確實少一個字。改起來三秒鐘。Alice 在 AI coding agent 裡輸入：

```text
Alice:
登入頁公告橫幅少了一個字，
「歡迎使登入本系統」應該是「歡迎使用本系統登入」。
src/Web/Auth/LoginBanner.cs。

/dflow:modify-existing
```

## Before Dflow speaks

如果沒有 Dflow，這種修改的典型下場是：直接改、直接 commit 到 main、commit message 寫
「fix typo」。三個月後有人問「這句話為什麼改過」，git blame 只會給出一句 fix typo，
沒有人知道是誰回報的、當時的判斷是什麼、有沒有掃過其他頁面有沒有同樣問題。

更常見的第二種下場是：因為「沒有 feature 可以掛」，這個修改被歸到某個**不相干的**
active feature 底下，只因為那個 feature 剛好開著。那會讓那個 feature 的 Integration
Summary 宣稱它做了它沒做的事。

Dflow 的處理是第三條路：**給它一個自己的、最小的 host。**

## Step 1 Part A — Tier 判定：T3

```text
Dflow:
我先跑 Step 1：Assess the Change。
Part A 依 AI-AGENT-GUIDE.md § Ceremony Scaling 的 ordered cascade
（步驟 0–4、先命中者勝）判定 tier：

- 步驟 0（是不是新東西 / observation-only？）否。
  這是既有輸出的修正。

- 步驟 1（T1？）否。
  沒有新業務規則、沒有 Domain 概念新增或結構變更、
  沒有資料結構或破壞性契約變更。

- 步驟 2（Dflow 不追蹤？）否。
  這是**使用者看得到**的文字。內部註解的錯字才是 below workflow。

- 步驟 3（T3？）**命中。**
  單一畫面上的顯示文字修正，不改行為、不改規則。

結論：T3。
```

Alice 追問了一句很值得記錄的話：

```text
Alice:
如果同樣的錯字在五個頁面都有呢？
```

```text
Dflow:
那就不是 T3 了。同一處掃過多個畫面會升 T2——
因為它需要一份 spec 記錄掃描範圍與遺漏風險，
一行 inline row 描述不了「我掃了哪些、沒掃哪些」。
本案只有登入頁一處，維持 T3。
```

這是本篇第一個 lesson：**tier 由 cascade 決定，不由「感覺很小」決定。**

## Step 1 Part B — 找 host：三項都落空

```text
Dflow:
Part B — Feature Linkage。我按順序走：

1. Active features：掃 dflow/specs/features/active/*/_index.md
   → 空的。沒有 active feature。

2. Completed features：掃 completed/*/_index.md 的 Goals & Scope
   → 只有 SPEC-20260428-001-employee-submit-expense（費用申報）。
     登入頁公告橫幅與費用申報在語意上不相關，
     這**不是**它的 follow-up。

3. Standalone：沒有任何 feature（active 或 completed）能承接這個變更
   → **命中**。這是一個 standalone 變更。
      T2 / T3 的 standalone 需要一個 minimal host feature directory
      來承載它——走 Step 1.7。

4. In-flight overlap scan（跨 branch）：
   git fetch；git branch --all --list '*feature/*' --list '*bugfix/*'
   → 沒有任何 in-flight branch 語意上重疊。
```

第 2 項值得停一下。Dflow **不會**因為「有一個 completed feature 存在」就把這次修改硬掛
成它的 follow-up。判準是**語意相關**，不是「剛好只有這一個」。

第 4 項也不是形式主義：如果另一條 branch 上已經有人在改同一段文案，Dflow 會先把它攤出來
等你決定，而不是讓你建出第二個 host 才發現撞車。

```text
Dflow:
Step 1 complete（tier T3 決定，host feature = new standalone minimal host，
layer = Presentation）。Entering Step 1.7。
```

## Step 1.7 — 開最小 host：四個步驟

```text
Dflow:
Step 1.7：Open a Standalone Minimal Host。

這一步的四件事**都在寫任何變更之前**做完：

1. 確認 standalone。
   判準是一個**條件**，不是路徑清單：
   「沒有 active feature 承接這個變更，
     也沒有 completed feature 被當成它的 follow-up」。
   本案兩者皆成立。

2. 配識別碼。
   依 _conventions.md § SPEC-ID Format：SPEC-20260511-001。
   本案不是功能性 bug（沒有壞掉的行為，是文字錯字），
   所以**不配 BUG-NUMBER**。
   Collision check：active/ 與 completed/ 都沒有這個 SPEC-ID，
   本地與遠端也沒有同名 branch。

3. 建最小 _index.md。
   七個必要段落一個都不少，只是內容很薄：
   - Metadata：status: in-progress、branch: （下一步要切的那個）
   - Goals & Scope：一兩句
   - Phase Specs：**空表**（最小 host 沒有 phase-spec）
   - Current BR Snapshot：**空的**（沒有 BR delta）
   - Lightweight Changes / Checkpoint Log / Resume Pointer：開始記

4. Branch gate — 依 change class。
   本案不是功能性 bug → feature/SPEC-20260511-001-login-banner-typo。
   _index.md 的 branch: 欄必須等於這個值，它對整個 host 是權威的。
```

Alice 問了那個大家都會問的問題：

```text
Alice:
一個錯字，要建資料夾、配 SPEC-ID、切 branch？
不能更輕嗎？
```

Dflow 的回答很直接，值得整段記下來：

```text
Dflow:
Dflow 評估過「更輕的 standalone-T3 ledger」這個選項，
結論是**不採用**。

理由是：更輕的做法會解開 host ledger 的不變式鏈——
SPEC-ID、branch、checkpoint、_index.md 作為權威記錄，
這四件事是互相扣住的。
只要有一類變更可以不走，「_index.md 是權威記錄」就不再成立，
之後任何工具、任何 review、任何 /dflow:verify 都不能再假設它為真。

ceremony 的成本是真的，Dflow 的處理方式是**誠實揭露**它，
而不是偷偷把某一類變更排除在外。

實務上這四步是一次對話就完成的，你不必手動做。
```

這是本篇第二個 lesson：**最小 host 是「零 phase」，不是「零記錄」。**

## 產出 1 — 最小 `_index.md`（checkpoint 1 之前）

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260511-001-login-banner-typo/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260511-001-login-banner-typo/_index.md)

此刻（尚未 commit）它長這樣：

```markdown
---
spec-id: SPEC-20260511-001
slug: login-banner-typo
status: in-progress
created: 2026-05-11
branch: feature/SPEC-20260511-001-login-banner-typo
---

# 登入頁公告橫幅錯字修正

## Goals & Scope

修正登入頁公告橫幅的錯字（「歡迎使登入本系統」→「歡迎使用本系統登入」）。
本變更**不觸及任何 bounded context**。

## Phase Specs

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|

## Current BR Snapshot

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|

## Lightweight Changes

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-11 | T3 | 登入頁公告橫幅錯字修正 `[text]` — `src/Web/Auth/LoginBanner.cs` |  |
```

⚠ **`Commit` 欄先留空——不要填 `{pending}` 這類佔位字串。** 最小 host 不必等到
closeout：它在 finalize（commit 之後、closeout 之前）就把 checkpoint 1 的 hash 填進來，
本走查稍後那一格會是 `a3f2c91`。**留空與佔位字串的差別在最小 host 上特別貴**——
Step 1 會拿那一格去做 hash evidence，佔位字串解不開，於是它擋下你——**而且它給的
理由就是「這一格從來沒填過」，不是「hash 填錯」**。flow 特地把三種失敗分開，並要求
「**report the one that is true**」（`references/finish-feature-flow.md` Step 1），
因為修法不一樣：**空**是那個變更還沒 commit；**佔位字串**是這格從來沒填過，很可能有一個
commit 就躺在那裡沒被記錄；**解得開但過不了 (a)–(c)** 才是 hash 填錯。
留空與佔位字串的差別，就差在你會被告知哪一件事。

三個地方要特別看：

| 欄位 | 值 | 為什麼 |
|---|---|---|
| Phase Specs | **空表** | 最小 host 的定義就是不帶 phase-spec。closeout 用「空表 + 沒有 `phase-spec-*` 檔」來判斷它是最小 host。 |
| Current BR Snapshot | **空的** | 沒有 BR delta。closeout 讀「這個 host 自己的記錄有沒有 BR delta」來決定空表合不合法，不是讀一句宣告。 |
| Lightweight Changes 那一列 | **已經寫好了** | 這是最容易做錯的地方——見下一節。 |

## 為什麼那一列必須在 commit 之前寫好

```text
Dflow:
提醒一件事：這個 T3 的 Lightweight Changes row
我**現在**就寫進 _index.md，和實作一起進 checkpoint 1。

原因是 closeout 會去讀 **checkpoint 1 那個 commit 裡的 _index.md**，
確認這一列當時就在。

一般掛在 feature 底下的 T3 不是這樣——它的 row 由 host 的**下一個** commit
順便帶進去。但最小 host 只有兩個 commit，第二個是 closeout，
沒有「下一個 commit」可以收攏它。
所以在最小 host 上，row 必須騎 checkpoint 1 本身。

唯一可以之後才填的是 `Commit` 欄——commit 還不存在，它不可能先有 hash。
```

還有一個容易漏的要求：

```text
Dflow:
**在最小 host 上**，每一列都要指出這次變更碰到的原始碼路徑。
本案是 src/Web/Auth/LoginBanner.cs，我已經寫在 Description 裡。

closeout 會拿 checkpoint 1 的 diff 跟這些路徑比對。
在最小 host 上，**一個路徑都沒宣告會擋下 closeout**——不會當成通過。

這條**只適用於最小 host**。掛在既有 feature 底下的 row 不受此限——
closeout 對它們根本不跑這項檢查，因為 hosted row 從來沒有被要求宣告路徑，
那個檢查在那裡沒有定義好的輸入。強行要求會**擋掉每一個 hosted T3**。
（walkthrough 04 / 05 的那些 row 就沒有宣告路徑，那是對的。）
```

這是本篇第三個 lesson：**在最小 host 上，「沒有宣告」是擋下，不是放行。**

一個什麼都沒宣告的 artifact，會讓那個檢查沒有東西可以比對。如果讓它通過，這個檢查就
變成一份文件而不是一道閘門。

## Step 4 — 實作 + checkpoint 1

Alice 改掉那一行：

```csharp
public const string Banner = "歡迎使用本系統登入";
```

```text
Dflow:
✓ Implementation 完成
   Commit here?
   [Y] Yes — AI 以你的 Git identity commit
   [N] No — 你自己 commit
```

Alice 選 Y。

```text
Dflow:
已 commit：a3f2c91
  [SPEC-20260511-001] fix login banner typo (T3)

這是 **checkpoint 1**。這個 commit 同時帶著：
- src/Web/Auth/LoginBanner.cs（實作）
- 這個 host 的 _index.md（含那一列 T3 row）
```

## Finalize — 回填兩個地方

```text
Dflow:
進 finish-feature 之前，先跑 Step 5 完成檢查表的 minimal-host finalization。

T3 沒有 spec 檔，所以只有兩件事：

1. 回填 commit evidence——**兩個面，各回答不同問題**：
   - Checkpoint Log 的 Result：這個**生命週期 checkpoint** 發生了什麼
     → committed (a3f2c91)
   - Lightweight Changes row 的 Commit 欄：帶著**這一列自己的 artifact**
     的是哪個 commit → a3f2c91

   本案兩個都是 a3f2c91（同一個 commit 帶著 artifact 和實作）。
   兩格一樣的 hash，但要**兩格都填**——空格會擋下 closeout。

2. 推進 Resume Pointer 到 closeout-ready。

host 的 status 維持 in-progress 到 closeout；
不提前翻 completed，也**不為 T3 發明一個被契約禁止的 spec 檔**。
```

## `/dflow:finish-feature` — zero-phase closeout

```text
Alice:
/dflow:finish-feature
```

Step 1 的驗證，最小 host 相關的幾項：

```text
Dflow:
Step 1 — Validate。逐項 ✓ / ✗：

✓ 七個必要段落齊全
✓ Phase Specs 空表 → zero-phase，最小 host（**這就是選擇器**：
  空的 Phase Specs 表 + host 目錄裡沒有 phase-spec-* 檔）
✓ 沒有任何 spec 檔（T3-only host 本來就不該有）
✓ Lightweight Changes 至少一列 → 1 列
✓ 每一列的 Commit 欄非空且通過 hash evidence：
    (a) a3f2c91 是一個 commit
    (b) 它是 HEAD 的 ancestor
    (c) 它**改動過**的路徑包含這一列的 artifact
        —— T3 的 artifact 就是 _index.md 本身，
           而且 a3f2c91 當下的 _index.md 已經帶著這一列
✓ checkpoint 1 碰到了這一列宣告的實作路徑
    （src/Web/Auth/LoginBanner.cs 在 a3f2c91 的 diff 裡）
✓ Checkpoint Log 此刻**恰好一列**（closeout 那列等一下才加）
✓ 你人在這個 host 的 branch 上
    （HEAD = feature/SPEC-20260511-001-login-banner-typo
     = _index.md 的 branch: 欄）
✓ Current BR Snapshot 空表 —— 這個 host 自己的記錄沒有 BR delta，
  所以空表是合法的，不是漏更
```

接著 Step 2 / 3 / 4：

```text
Dflow:
Step 2 — 只翻 status: in-progress → completed。
  **branch: 欄保持原值，永不改寫。**

Step 3 — Sync BR Snapshot to BC Layer：
  這個 host 是 **no-BC**（Goals & Scope 明說不觸及任何 bounded context）
  → **整段跳過**。
  不建 rules.md、不建 behavior.md、不建 events.md，
  也不為了讓某個項目「有東西可寫」而發明一個 bounded context。

Step 4 — Archive：
  git mv active/SPEC-20260511-001-login-banner-typo \
         completed/SPEC-20260511-001-login-banner-typo
  先寫 closeout 那一列（**不帶 hash**——commit 無法自含自身 hash），
  再 git add 整個歸檔目錄，然後 commit。

  這是 **checkpoint 2**。歸檔 rename 就在這個 commit 裡。
```

## 產出 2 — 收工後的 Checkpoint Log

```markdown
## Checkpoint Log

| Timestamp | Checkpoint | Result |
|---|---|---|
| 2026-05-11 09:40 | implementation | committed (a3f2c91) |
| 2026-05-11 09:55 | closeout | committed |
```

**兩個 checkpoint，各自成一列。** 這是最小 host 的完整生命週期。

這裡要把一件容易混淆的事講清楚：

| 情境 | checkpoint 數 | 為什麼 |
|---|---|---|
| **掛在既有 feature 底下**的 T3（walkthrough 04 / 05 的模式） | 單一實作 commit | 它的 inline row 與 hash 由 host 的**下一個** commit 一併帶進。 |
| **最小 host** 上的 T3（本篇） | **兩個**（implementation、closeout） | 沒有「下一個 commit」了。row 必須騎 checkpoint 1，closeout 自成第二個。 |

兩句話**同時為真**，只是講的不是同一種 host。canonical 那句「T3 ＝ 單一 commit」在
`git-integration.md` 裡已經明寫它描述的是 hosted T3。

## 產出 3 — Integration Summary（zero-phase 的確切形狀）

> ⚠ **摘要之前還有一件事，本篇壓縮掉了。** flow 規定 Step 5 要先印 closeout
> verification 的**推導過程**（不是「通過了」，而是「怎麼算出來的」）。那是真實驗證
> 才會有的內容，本教材不編造；規定見 `finish-feature-flow.md` Step 5 開頭。

```text
== Integration Summary: SPEC-20260511-001-login-banner-typo ==

Feature Goal: 修正登入頁公告橫幅的錯字。本變更不觸及任何 bounded context。

Change Scope:
- BC: none
- Aggregates affected: none
- Phase Count: 0
- Lightweight Changes: 0 T2 lightweight specs + 1 T3 inline rows

Related BR-IDs (post-closeout state):
（空）

Domain Events Changes:
- none

Phase List:
（空）

Next Steps (developer) — Integration / PR gate (needs network):
- Per the selected Git policy (`gitflow` / `trunk` in `_conventions.md`), choose
  a merge strategy (merge commit / squash / rebase / fast-forward) and execute
- Push to remote / open a PR — the AI can run `git push` / `gh pr create` for
  you, but only when you explicitly ask; it never pushes on its own
```

`BC`、`Aggregates affected`、`Domain Events Changes` 是 `none`，因為它們報告的是
**有沒有做 sync**——這個 host 沒有。

但 `Related BR-IDs` **不是**那一類：它報告的是**這次變更自己的記錄帶了什麼**。
T3-only 的 no-BC host 兩者皆無，所以留空。把它一起寫成 `none` 會抹掉一個資訊，
在 no-BR 家族的 T2 上還會抹掉那個家族的標記。

## 產出 4 — pre-integration gate 的正反兩面

這是本篇最值得記住的一組對照。`git-integration.md` 的
`feature/ — Before Merging` gate 第一項就是 `_index.md status: completed`：

| 時點 | `_index.md` status | gate 判定 |
|---|---|---|
| checkpoint 1 之後、closeout 之前 | `in-progress` | **擋下。** 一個還沒 closeout、還沒歸檔的 host 不能 merge。 |
| closeout 之後 | `completed` | 放行。 |

最小 host 對這個 gate 的例外分得很細，**三類項目三種待遇**：

| 項目種類 | 最小 host 上怎麼讀 |
|---|---|
| **這個 host 自己的記錄**（status、歸檔就緒、phase-spec 檢查） | **原封不動適用**。它們正是擋住「記錄還開著就 merge」的那道防線。 |
| **點名 Domain / bounded-context artifact 的項目**（BR-Snapshot sync、events.md、glossary/models/rules） | 只適用於這次變更**實際碰到**的部分。no-BC host 沒有 BC 要 sync、T3 不做 Domain 工作 → 讀 N/A。但 `glossary.md` 與 tech-debt 不屬於任何 bounded context，**不是** N/A。 |
| **講原始碼規則、而不是點名文件的項目**（Domain 層零外部相依、業務邏輯不外洩、Domain entity 不掛 ORM attribute、Domain 單元測試要過） | **永遠不是 N/A。** 只要變更碰到 code 就成立——而且一個謊稱自己 no-BC 的 host，正是靠這幾項抓出來的。 |

第三類最容易被誤讀成「最小 host 一律 N/A」。**Code invariant 不是 artifact**：它沒有要你去
更新哪份文件，它是對原始碼的斷言。

換句話說：**新加的例外沒有順手把那道防線一起繞過去。** 這正是它們被寫成
「依每一項讀什麼來分」而不是「最小 host 一律 N/A」的原因。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/.../SPEC-20260511-001-login-banner-typo/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260511-001-login-banner-typo/_index.md) | 最小 host 的完整形狀：七個必要段落、空 Phase Specs、空 BR Snapshot、一列 T3、兩列 checkpoint。**Integration Summary 不在裡面**——見上一節。 |
| 故意不建 | `phase-spec-*.md` | 最小 host 的定義就是不帶 phase-spec。 |
| 故意不建 | `lightweight-*.md` / `BUG-*.md` | T3 在 Dflow 裡**不產** spec 檔；inline row 就是它的全部記錄。 |
| 故意不建 | `dflow/specs/domain/{context}/*` | no-BC host。發明一個 bounded context 會留下永久的虛構檔案。 |
| 故意不改 | `outputs/dflow/specs/features/completed/SPEC-20260428-001-*/` | 這次修改與費用申報無關，不是它的 follow-up。 |

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| 沒有 host 也有明確路徑 | Part B 三項落空 → Step 1.7，不需要開發者自己發明做法。 |
| 不變式優先於便利 | 拒絕「更輕的 T3 ledger」，並說明理由，而不是靜靜地放行。 |
| 記錄先於 commit | T3 row 在 checkpoint 1 之前寫入，closeout 讀 committed blob 驗證。 |
| 不製造虛構 artifact | no-BC host 跳過 BC sync，不建 rules.md / behavior.md / events.md。 |
| 例外有邊界 | 最小 host 的 merge-gate 例外只放寬 Domain-artifact 項目，保留 status 檢查。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| 小修改沒有任何記錄 | 直接 commit 到 main，三個月後 blame 只剩「fix typo」。 | 一個最小 host 記下 SPEC-ID、路徑、兩個 checkpoint。 |
| 小修改被硬掛到不相干的 feature | 那個 feature 的 Integration Summary 宣稱它做了沒做的事。 | Part B 第 2 項用**語意相關**判斷，不是「剛好只有這一個」。 |
| 為了通過檢查而發明文件 | 建一個空的 bounded context 或假的 phase-spec。 | no-BC / zero-phase 分支明文說「記 N/A，不要製造 artifact」。 |
| 未 closeout 就 merge | 一個半開的 host 進了 main，記錄永遠停在 in-progress。 | merge gate 第一項擋下，且最小 host 的例外沒有繞過它。 |

## Key takeaways

- **沒有任何 feature 可掛，是一條有定義的路徑**，不是例外狀況：Part B 第 3 項 → Step 1.7。
- **最小 host ＝ 零 phase，不是零記錄。** 七個段落齊全、SPEC-ID、branch、兩個 checkpoint，只是沒有 phase-spec。
- **branch 依 change class**：本案不是功能性 bug，切 `feature/{SPEC-ID}-{slug}`；功能性 bug 走 `bugfix/BUG-*`（下一篇）。
- **T3 的 row 必須在 checkpoint 1 之前寫好**，因為 closeout 讀的是 checkpoint 1 那個 commit 裡的 `_index.md`。
- **最小 host 的每一列都要宣告實作路徑**；沒有宣告會**擋下** closeout，不會當成通過。這條**只管最小 host**——hosted row 從未被要求宣告，closeout 對它們不跑這項檢查（強行要求會擋掉每一個 hosted T3）。
- **「T3 ＝ 單一 commit」講的是 hosted T3**；最小 host 上不分 tier 都是兩個 checkpoint。
- **no-BC closeout 跳過 BC sync**，不建 `rules.md` / `behavior.md` / `events.md`。

## 下一個 walkthrough

下一篇 [〈Walkthrough 08 — completed feature 上的 orphan bug：follow-up 最小 host〉](walkthrough-08-followup-minimal-host.md)
處理另一半的情況：這次的變更**和一個 completed feature 有關**。Alice 會看到
`/dflow:bug-fix` 如何在 `SPEC-20260428-001` 已經凍結的情況下，開一個帶
`follow-up-of` 的最小 host、切 `bugfix/BUG-002-*` branch，並在 closeout 之後用一個
**不入任何 ledger** 的 tracking commit 把原 feature 的 Follow-up Tracking 翻成 completed。
