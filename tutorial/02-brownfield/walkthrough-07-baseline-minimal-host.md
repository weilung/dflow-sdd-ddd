# Walkthrough 07 — 沒有相關 feature 的 baseline capture：tier-exempt 最小 host

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

[〈Walkthrough 03 — baseline capture 跨頁面折扣顯示行為〉](walkthrough-03-baseline-capture.md)
示範過 baseline capture，但那次有一個現成的 host：`SPEC-20260430-001-order-discount-calculation`
當時還是 active，capture 直接掛回去。

本篇處理 Brownfield 更常見的情形：**你要看清楚的那塊 legacy，和任何 feature 都沒關係。**
Bob 想在動 Shipment 之前先摸清楚運費怎麼算——而 `active/` 裡只有 VIP 折扣（Order BC），
`completed/` 裡只有折扣計算（也是 Order BC）。兩個都不相關。

沒有 host 可掛，但 baseline capture 仍然需要 SPEC-ID、branch 和 checkpoint ledger。
Dflow 的答案是 **baseline 最小 host**：一個 **tier-exempt** 的 zero-phase host，
第一個 checkpoint 叫 `spec-baseline` 而不是 `implementation`。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| 沒有 feature 可掛的 baseline capture 怎麼辦？ | Part A 判 observation-only（tier-exempt）→ Part B 三項落空 → Step 1.7 的 baseline 分支。 |
| tier-exempt 是什麼意思？和 T3 差在哪？ | 它**不在** T1/T2/T3 表內。T3 是「有改動輸出的最小修改」；baseline **完全不改輸出**。 |
| 為什麼第一個 checkpoint 不叫 implementation？ | 因為根本沒有 implementation。記成 `implementation | committed` 會留下一筆假紀錄。 |
| 它會不會被 closeout 當成「空 host」擋下？ | 不會。它產出一列合法的 `Tier = baseline` row，那就是它的記錄。 |
| baseline 寫進 BC 層之後，closeout 還要再 sync 一次嗎？ | 不用。BC 在 capture 當下就寫好了，closeout 沒有東西要再推。 |
| 為什麼不乾脆記在筆記本裡？ | 因為三個月後沒人找得到它，也沒人知道它是什麼時候看的、看的是哪個版本。 |

## 前情提要

Walkthrough 06 之後，OrderManager 的狀態是：

```text
dflow/specs/features/
├── active/
│   └── SPEC-20260505-002-vip-discount-policy/     （VIP 折扣，Order BC）
├── backlog/     （空的）
└── completed/
    └── SPEC-20260430-001-order-discount-calculation/   （折扣計算，Order BC）
```

**有 feature 在跑，但沒有一個和運費有關。**

## 劇情背景

2026-05-11 週一，客服轉來一則客訴：

```text
客服：
客戶說同一張訂單，
購物車頁顯示「免運」，
結帳頁卻顯示 150，
出貨通知信又寫免運。

他問我們到底收不收。
```

Bob 的第一反應是「先找出哪一個是對的然後改掉」。但他停住了：

```text
Bob:
我根本不知道這三個數字各自是怎麼算出來的。
運費邏輯散在三個地方，
從來沒有人寫下來過。

我現在如果直接改，
八成會把另外兩個地方弄壞。

我今天不想改任何東西。
我想先把「現在到底是怎麼算的」寫下來。
```

```text
Bob:
先不要動 code。
我要先捕捉 Shipment 運費在購物車、結帳、出貨通知三個地方
目前實際的計算與顯示行為。

/dflow:modify-existing
```

## Step 1 Part A — 不是 T1、不是 T2、不是 T3，也不是「不追蹤」

```text
Dflow:
Part A 依 AI-AGENT-GUIDE.md § Ceremony Scaling 的 ordered cascade
（步驟 0–4、先命中者勝）：

- 步驟 0（新東西 / observation-only？）**命中**。

  這是 observation-only 的 baseline capture——只記錄現況、
  不改任何輸出。步驟 0 明文說它 carries no tier at all，
  但仍然要被記錄下來。

  cascade 到此結束，後面幾步不用走。

結論：**tier-exempt**——不在 T1 / T2 / T3 內，但也**不是** below workflow。
```

Dflow 主動指出這裡有一個常見的走錯：

```text
Dflow:
如果照舊習慣直接問「這是 T1 還 T2 還 T3」，會走錯：

  步驟 1（T1？）否
  → 步驟 2（無受眾可感知的輸出 delta？）**會命中** below workflow
  → 變成「直接 git commit、Dflow 不追蹤」
  → baseline 就不會被記下來。

步驟 0 的 observation-only 例外就是為了擋這個。
```

這是本篇第一個 lesson：**「不改輸出」不等於「不值得記錄」。**

Brownfield 特別需要這條路徑。你常常必須先看清楚 legacy 現況才能安全修改，而那段
「看清楚」的成果如果沒有落點，下一個人（或三個月後的你）要從頭再看一次。

## Step 1 Part B — 三項落空

```text
Dflow:
Part B — Feature Linkage：

1. Active features：
   SPEC-20260505-002-vip-discount-policy
   → Goals & Scope 是 VIP 客戶折扣率與合約條款，Order BC。
     運費計算與它**不相關**。不是 host。

2. Completed features：
   SPEC-20260430-001-order-discount-calculation
   → 折扣計算與顯示，也是 Order BC。
     運費是 Shipment 的事，**不相關**。
     這不是它的 follow-up。

3. 沒有任何相關 feature（active 或 completed）。
   ——但注意：把我送到 Step 1.7 的**不是這一項**。
     這一項的措辭是「standalone T2 / T3」，而 baseline 是 tier-exempt、
     不在 T1/T2/T3 內，所以它描述的不是本案。
     真正的路由來自 **Part A 的 observation-only 分流**：
     baseline 三狀態裡的 **(c) no-feature** → Step 1.7 的 baseline 分支。
     這一項在這裡的作用是**確認 (c) 成立**（沒有相關 feature），不是路由本身。

4. In-flight overlap scan：沒有 branch 在動 Shipment。
```

第 1 項值得停一下：**`active/` 裡有東西，不代表它就是 host。** 判準是語意相關，不是
「剛好有一個開著」。把運費 baseline 掛進 VIP 折扣 feature，會讓那個 feature 的
Integration Summary 宣稱它做了它沒做的事。

Dflow 順帶說明另外兩個狀態，讓 Bob 知道自己走的是哪一條：

```text
Dflow:
baseline capture 依 host 狀態分三路：

(a) 有相關的 **active** feature  → 直接掛回去（walkthrough 03 走的就是這條）
(b) 只有相關的 **completed** feature → follow-up 最小變體（Step 1.6），
    保留 follow-up-of 與原 feature 的 reverse-link
(c) **沒有相關 feature**        → standalone 最小 host（Step 1.7）← 本案

(b) 特別容易做錯：把它當成無血緣的 standalone 歸檔，
就失去了歷史 lineage，也沒走 sanctioned 的 reverse-link。
```

## Step 1.7 — baseline 分支的最小 host

```text
Dflow:
Step 1.7：Open a Standalone Minimal Host（baseline 分支）。

1. 確認 standalone：沒有 active feature 承接、
   也沒有 completed feature 被當成它的 follow-up。成立。

2. 配識別碼：SPEC-20260511-001。
   **不配 BUG-NUMBER**——這不是功能性 bug，是觀察。
   （客訴確實揭露了一個不一致，但今天要交付的是「現況是什麼」，
     修不修、怎麼修是另一件事。）
   Collision check 通過。

3. 建最小 _index.md：七段齊全、Phase Specs **空表**。
   Goals & Scope **要指名它捕捉的 bounded context**——
   baseline capture 有真實的 BC（Shipment），這一點和
   no-BC 的 standalone T3 不同。

4. Branch gate — 依 change class：
   baseline 是 tier-exempt、不是功能性 bug
   → **feature/SPEC-20260511-001-shipment-fee-baseline**
```

## Step 2 — 只讀 immediate neighbors

```text
Dflow:
我限定閱讀範圍，不做全系統 audit：

OrderManager.Web/Pages/Cart/ShoppingCart.aspx.cs
  method CalculateShippingFee()      approx. lines 88-131

OrderManager.Web/Pages/Checkout/Checkout.aspx.cs
  method BindShippingSummary()       approx. lines 152-190

OrderManager.Jobs/Notifications/ShipmentNoticeBuilder.cs
  method BuildFeeLine()              approx. lines 44-77
```

三個 finding：

這張訂單的數字：原價合計 **2,300**，套用折扣後應付 **1,850**；免運門檻 **2,000**；
重量落在級距表「5–10kg = 150」。

| # | 位置 | 觀察 | 分類 |
|---|---|---|---|
| 1 | `ShoppingCart` | 以**折扣前** 2,300 判斷免運門檻 → 達標 → **免運（0）** | **confirmed** |
| 2 | `Checkout` | 同一張級距表，但以**折扣後** 1,850 判斷 → 未達標 → 依級距收 **150** | **confirmed**（與 #1 的差異是真的） |
| 3 | `ShipmentNoticeBuilder` | 不重算，直接讀訂單建立當下寫入的 `ShippingFee`（下單走購物車那條路徑，存的是 0）→ **免運（0）** | **confirmed** |

```text
Dflow:
三個數字不一致的根因，到這裡已經看得很清楚——**同一條免運門檻，三處拿不同的金額去比**：

- 購物車：拿**折扣前** 2,300 比門檻 2,000 → 達標 → 免運（0）
- 結帳頁：拿**折扣後** 1,850 比同一條門檻 → 未達標 → 依級距收 150
- 通知信：完全不比，直接讀**下單當下存下來的值**（0）

但我**不會**在這個 host 裡修它。
baseline capture 是 observation-only；
「哪一個才是對的」是一個業務決定，
需要財務或營運拍板，那是下一個 feature 的事。
```

這是本篇第二個 lesson：**baseline capture 的紀律是「只寫你確認的，不順手修」。**

Bob 確認：

```text
Bob:
對。三個都先寫下來。
哪個才對我要問過營運。
```

Dflow 也把「不確定的」和「確定壞的」分開：

```text
Dflow:
分流規則：

- **confirmed behavior** → 寫進 BC 層 behavior.md（本案三項全是）
- **buggy implementation / unknown behavior** → 寫進 migration/tech-debt.md，
  **不要**升格成 BR

「三處門檻判斷基準不一致」我記進 tech-debt，
標為 open、來源指回本 SPEC-ID。
它是一個待決的業務問題，不是一條已成立的規則。
```

## 產出 1 — `Tier = baseline` 那一列

完整文件範例：
[`outputs/.../SPEC-20260511-001-shipment-fee-baseline/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260511-001-shipment-fee-baseline/_index.md)

```markdown
| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-11 | baseline | Shipment 運費在購物車 / 結帳 / 出貨通知三處的現行計算與顯示行為 capture（observation-only，未改任何輸出）— `dflow/specs/domain/Shipment/behavior.md` | 4b17d92 |
```

三個地方要看：

| 欄位 | 值 | 為什麼 |
|---|---|---|
| `Tier` | **`baseline`** | 不是 T2、不是 T3。closeout 與 pr-review 的 reader 都認得這個值。 |
| Description 末尾的路徑 | `dflow/specs/domain/Shipment/behavior.md` | 每一列都要宣告「碰到什麼」。baseline 宣告的是**它寫進去的 BC 層文件**——它沒有原始碼變更。 |
| `Commit` | `4b17d92` | 就是 `spec-baseline` 那個 checkpoint 的 hash。 |

## 產出 2 — 為什麼 checkpoint 叫 `spec-baseline`

```text
Dflow:
✓ Baseline capture 完成
   Commit here?
```

Bob 選 Y。

```text
Dflow:
已 commit：4b17d92
  [SPEC-20260511-001] baseline capture: Shipment fee across cart / checkout / notice

Checkpoint Log 記的是：

| 2026-05-11 11:30 | spec-baseline | committed (4b17d92) |

**不是** implementation。

理由：這個 host 沒有 implementation。
記成 `implementation | committed` 會在 ledger 裡留下一筆
「這裡發生過實作」的假紀錄——三個月後回頭看的人會去找那次實作，
而它從來不存在。

Checkpoint 的名字要說出實際發生的事。
```

這是本篇第三個 lesson：**ledger 的欄位是給未來的人讀的，寫錯名字就是寫錯歷史。**

## 產出 3 — closeout：BC 已經寫好了，沒有東西要再 sync

```text
Bob:
/dflow:finish-feature
```

```text
Dflow:
Step 1 — Validate（最小 host 相關項）：

✓ Phase Specs 空表、無 phase-spec-* 檔 → 最小 host
✓ Lightweight Changes 至少一列 → 1 列（Tier = baseline）
✓ 那一列的 Commit 欄非空且通過 hash evidence：
    (a) 4b17d92 是 commit
    (b) 是 HEAD 的 ancestor
    (c) 它改動過的路徑包含這一列宣告的
        dflow/specs/domain/Shipment/behavior.md，
        而且那份文件**存在於它的樹裡**
        —— 這是 baseline 列在**最小 host** 上的加強條款
        （Step 1 那組檢查整組標著 Minimal host (zero-phase) only）：
        capture 必須由這個 commit 新增或修改，刪掉或改名走的
        commit 一樣會動到同一個路徑，但它不可能是捕捉它的那一個。
        同一種 baseline 列掛在 phase-bearing host 上時 Step 1 不跑，
        改由 pr-review-checklist.md 接手，那裡沒有 tree 這一半
✓ **baseline 專項**：Checkpoint Log 第一列是 `spec-baseline`
  且 Result = committed (4b17d92)
✓ Checkpoint Log 此刻恰好一列
✓ HEAD = feature/SPEC-20260511-001-shipment-fee-baseline
        = _index.md 的 branch:
✓ Current BR Snapshot 空表 —— baseline host 是 tier-exempt、
  observation-only，snapshot 不是它的記錄面

Step 2 — status → completed，branch: 保持不變。

Step 3 — Sync BR Snapshot to BC Layer：
  這是 **(iii) baseline-precaptured** 的情況——
  BC 層在 capture 當下（checkpoint 1）就已經寫好了，
  closeout **沒有東西要再 sync**。

  注意這和 no-BC 的「整段跳過」不一樣：
  本 host **有** bounded context（Shipment），
  只是它的內容早就寫進去了。
  Integration Summary 的 BC: 欄填 **Shipment**，不是 none。

Step 4 — git mv 歸檔 + closeout commit（checkpoint 2）。

Step 6 — skip（本 host 沒有 follow-up-of，它是 (c) no-feature 那條路）。
```

## 產出 4 — Integration Summary（baseline 的形狀）

> ⚠ **摘要之前還有一件事，本篇壓縮掉了。** flow 規定 Step 5 要先印 closeout
> verification 的**推導過程**（不是「通過了」，而是「怎麼算出來的」）。那是真實驗證
> 才會有的內容，本教材不編造；規定見 `finish-feature-flow.md` Step 5 開頭。

```text
== Integration Summary: SPEC-20260511-001-shipment-fee-baseline ==

Feature Goal: 捕捉 Shipment 運費在購物車 / 結帳 / 出貨通知三處的現行行為。
observation-only，未改任何輸出。

Change Scope:
- BC: Shipment
- Phase Count: 0
- Lightweight Changes: 0 T2 lightweight specs + 0 T3 inline rows + 1 baseline rows

Related BR-IDs (post-closeout state):
（空 —— baseline capture 不建立 BR；三處門檻不一致是待決的業務問題，
  已記入 migration/tech-debt.md）

Phase List:
（空 —— zero-phase）

Next Steps (developer) — Integration / PR gate (needs network):
- Per the selected Git policy (`gitflow` / `trunk` in `_conventions.md`), choose
  a merge strategy (merge commit / squash / rebase / fast-forward) and execute
- Push to remote / open a PR — the AI can run `git push` / `gh pr create` for
  you, but only when you explicitly ask; it never pushes on its own
```

`BC:` 是 **`Shipment`** 而不是 `none`——這是 baseline host 與 no-BC standalone host 最明顯的
差別。baseline 有真實的 bounded context，它捕捉的內容就住在那裡。

**注意這裡沒有 `Aggregates affected:` 也沒有 `Domain Events Changes:`。** 那兩欄是
**Greenfield** Integration Summary 才有的。Brownfield 的 canonical 形狀
（`references/finish-feature-flow.md` Step 5）是 `BC:` → `Phase Count:` →
`Lightweight Changes:`——Brownfield 沒有 `events.md`，Step 3 的 sync 只涵蓋 `rules.md`
與 `behavior.md`。把 Greenfield 的欄位抄進 Brownfield 的摘要，是很容易犯的錯。

## 產出 5 — 沒有留下空的 active feature

```text
dflow/specs/features/
├── active/
│   └── SPEC-20260505-002-vip-discount-policy/    （VIP 折扣，原本就在）
└── completed/
    ├── SPEC-20260430-001-order-discount-calculation/
    └── SPEC-20260511-001-shipment-fee-baseline/   ← 收工歸檔
```

baseline host **走完整個生命週期然後歸檔**，不會以一個半開的 active feature 留在那裡。
這一點在 Brownfield 特別重要：baseline capture 做得越多，留下的空殼就越多，
而空殼會讓 `/dflow:status` 的 in-flight 清單失去意義。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`.../SPEC-20260511-001-shipment-fee-baseline/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260511-001-shipment-fee-baseline/_index.md) | baseline 最小 host：七個必要段落、`Tier = baseline` 列、`spec-baseline` checkpoint。（`BC: Shipment` 是 Integration Summary 的欄位，不在 fixture 裡；fixture 對 BC 的宣告在 Goals & Scope。） |
| 新建 | [`outputs/dflow/specs/domain/Shipment/behavior.md`](outputs/dflow/specs/domain/Shipment/behavior.md) | 三處 confirmed behavior 的捕捉結果，含「未捕捉的範圍」與「已知不一致（不在本文件裁定）」。 |
| 修改 | [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | 「三處免運門檻判斷基準不一致」記為 open，來源指回本 SPEC-ID。 |
| 故意不建 | `phase-spec-*.md` / `lightweight-*.md` | baseline 不產 spec 檔；`Tier = baseline` 那一列就是它的記錄。 |
| 故意不改 | 任何 `.aspx.cs` / `.cs` | observation-only。今天不改輸出。 |
| 故意不建 | 任何 BR | 「哪一個門檻才對」是待決的業務決定，不是已成立的規則。 |

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| 觀察也是一等公民 | cascade 步驟 0 的 observation-only 例外，擋住「無輸出 delta ⇒ 不追蹤」的誤判。 |
| host 判斷看語意 | `active/` 有 feature，但不相關就不是 host。 |
| ledger 說實話 | 第一個 checkpoint 叫 `spec-baseline`，因為沒有 implementation。 |
| confirmed / unknown 分流 | 確認的進 `behavior.md`，不確定與可疑的進 `tech-debt.md`，不硬升成 BR。 |
| 不留空殼 | baseline host 走完生命週期並歸檔。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| 沒看清楚就動手 | 修好購物車、弄壞通知信。 | 先 capture 三處現況，根因一次看清。 |
| baseline 記在個人筆記 | 三個月後找不到，也不知道看的是哪個版本。 | 進 repo、有 SPEC-ID、有 commit hash。 |
| 觀察被誤判成「不用追蹤」 | 步驟 2 命中 below workflow，capture 消失。 | 步驟 0 的 observation-only 例外先命中。 |
| 可疑行為被寫成 BR | 「結帳頁用折扣後金額判斷免運」被當成規則寫進 `rules.md`。 | 分流規則：unknown / buggy 進 tech-debt，不升 BR。 |
| baseline 掛到不相干的 feature | 那個 feature 宣稱它做了運費工作。 | Part B 用語意相關判斷，不是「剛好有一個開著」。 |

## Key takeaways

- **baseline capture 是 tier-exempt**：不在 T1/T2/T3 內，但也不是 below workflow（cascade 步驟 0）。
- **依 host 狀態分三路**：(a) 有 active → 掛回去；(b) 只有 completed → follow-up 變體；(c) 都沒有 → standalone 最小 host。
- **第一個 checkpoint 叫 `spec-baseline`**，不是 `implementation`——沒有實作就不要在 ledger 裡宣稱有。
- **產出一列合法的 `Tier = baseline` row**，那就是它的記錄；不產 spec 檔。
- **BC 在 capture 當下就寫好**，closeout 沒有東西要再 sync；但 `BC:` 欄填真實的 context，不是 `none`。
- **confirmed 進 `behavior.md`，unknown / buggy 進 `tech-debt.md`**，不硬升成 BR。
- **不留空的 active feature**——baseline host 走完生命週期並歸檔。

## 下一個 walkthrough

Brownfield 主線到這裡把四種 host 形狀都走過了：**hosted**（02 / 03 / 05）、
**phase-bearing new feature**（04）、**closeout**（06），以及本篇的
**baseline 最小 host**。

想看 Greenfield 側的 standalone 與 follow-up 最小 host，可讀
[〈Greenfield Walkthrough 07 — 沒有任何 feature 可掛時〉](../01-greenfield/walkthrough-07-standalone-minimal-host.md)
與 [〈Greenfield Walkthrough 08 — completed feature 上的 orphan bug〉](../01-greenfield/walkthrough-08-followup-minimal-host.md)。
