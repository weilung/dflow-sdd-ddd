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
| baseline 要開發者確認什麼？確認記在哪？ | Step 6.2 的 baseline 題目一題一題問；每一個確認在 host 的 Goals & Scope 記一行。 |

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
    ——只限 BC-bearing、phase-bearing 的；開著的最小 host 或 no-BC host 收不下盤點
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

## Step 2 — 只讀要盤點的那一塊

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
- **沒有任何一條規則或單一情境講得完的系統層知識**（例如一個數字在哪幾處、怎麼算），
  以及卡在它上面、要等業務決定的熱點 → 寫進 analysis.md：歸單一 context 的
  寫進那個 context 的那一份（本案的運費歸 Shipment），跨 context 的流程、
  角色觸及與沒有單一 context 擁有的寫進 domain/analysis.md

「三處門檻判斷基準不一致」我記進 tech-debt，
標為 open、來源指回本 SPEC-ID。
它是一個待決的業務問題，不是一條已成立的規則。
```

⚠ **三處不一致不是「確認的規則、程式沒照做」。** 那種情況有自己的記法——`rules.md` 的 `Known deviations` 欄、
`behavior.md` 的 `> Known deviation:` 行，連到一列技術債（見 [walkthrough 03](walkthrough-03-baseline-capture.md)
的第 4 題）——前提是規則已經確認。這裡「以哪一個金額為準」還沒有人拍板，沒有規則可以被違反，
所以不用偏離的記法，也不建 BR：三處照實記成觀察，待決的那一題記在 tech-debt 與 HS-01。
等營運拍板、寫成 BR 之後，若還有一兩處程式不照新規則、而那一次又決定先不修，那時才是偏離。

第三條在這次也有東西要記：

```text
Dflow:
運費這個數字本身，要記進 Shipment/analysis.md：

- 它是算出來的，三處各自產出：購物車、結帳頁各算一次，
  通知信讀下單當下存進 Order.ShippingFee 的快照。記成 RM-01。
  運費讀的是 Order 的金額，但算它的是 Shipment，所以記在 Shipment 這一支。
  三處的 Given/When/Then 已在 behavior.md，RM-01 指過去，不重抄。
- 「免運門檻該拿哪個金額比」卡在 RM-01 上，要等營運／財務拍板——
  記一列熱點 HS-01（open），連回 tech-debt.md 那一列。

這支檔還不存在；這是第一次有東西要記，所以從 templates/analysis.md 建。
```

狀態與角色這兩類，這次讀的三個方法在例子裡都沒有答案，所以沒有記。

寫下去的重點片段：

```markdown
## Read Models and Derived Figures

### RM-01: 運費（`ShippingFee`）

三個產出點，彼此沒有共用實作：購物車頁 `ShoppingCart.CalculateShippingFee()` 與結帳頁 `Checkout.BindShippingSummary()` 各自計算；出貨通知信 `ShipmentNoticeBuilder.BuildFeeLine()` 不計算，讀下單時存下的快照。

購物車與結帳頁用同一份重量級距表（例：5–10kg = 150）與同一條免運門檻 2,000：拿去比的金額達到 2,000 就免運（0），未達就依級距收費。兩處拿去比的金額不同——購物車比**折扣前**金額，結帳頁比**折扣後**金額，所以同一張訂單可能一處免運、一處收費。

通知信不重算：它讀訂單建立當下寫進 `Order.ShippingFee` 的快照（下單走的是購物車那條計算路徑）。下單之後運費規則若改了，通知信照舊顯示下單當下的值。

三處的情境見 [`behavior.md`](./behavior.md)；該拿哪個金額比門檻還沒有決定，見 HS-01。

Evidence: code - `OrderManager.Web/Pages/Cart/ShoppingCart.aspx.cs` `CalculateShippingFee()`（約 lines 88-131）、`OrderManager.Web/Pages/Checkout/Checkout.aspx.cs` `BindShippingSummary()`（約 lines 152-190）、`OrderManager.Jobs/Notifications/ShipmentNoticeBuilder.cs` `BuildFeeLine()`（約 lines 44-77） (2026-05-11)

## Open Questions and Hotspots

| Item | ID | Affects | Why it matters | Status | Evidence |
|---|---|---|---|---|---|
| 免運門檻該拿哪個金額比 | HS-01 | RM-01 | 購物車比折扣前、結帳頁比折扣後，同一張訂單三處顯示 0 / 150 / 0<br>以哪一個為準要等營運／財務拍板，拍板前不寫成 BR<br>待決的決定記在 [`tech-debt.md`](../../migration/tech-debt.md)「Shipment 免運門檻判斷基準三處不一致」 | open | code - `ShoppingCart.aspx.cs` `CalculateShippingFee()` vs `Checkout.aspx.cs` `BindShippingSummary()` (2026-05-11) |
```

完整文件範例：
[`outputs/dflow/specs/domain/Shipment/analysis.md`](outputs/dflow/specs/domain/Shipment/analysis.md)

兩個細節：

- **`behavior.md` 記三處各自發生什麼，`analysis.md` 記這個數字怎麼來。** 三個情境的 Given/When/Then
  在 `behavior.md`；RM-01 把三處放在一起，講這個數字的產出點、比門檻用哪個金額，以及通知信那份快照
  在規則改了之後會過期——那是任何一個情境單獨講不出來的。
- **HS-01 和 tech-debt 那一列各記一半。** tech-debt 記待決的決定本身（以哪一個為準）；HS-01 記它卡在
  哪一條知識上（RM-01），並連過去。它的 `Evidence` 寫 `code`：打開那兩個方法，拿去比的金額就是不一樣，
  這就是「它還開著」的證據。

## 產出 1 — `Tier = baseline` 那一列

完整文件範例：
[`outputs/.../SPEC-20260511-001-shipment-fee-baseline/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260511-001-shipment-fee-baseline/_index.md)

```markdown
| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-11 | baseline | Shipment 運費在購物車 / 結帳 / 出貨通知三處的現行計算與顯示行為 capture（observation-only，未改任何輸出）— `dflow/specs/domain/Shipment/behavior.md`、`dflow/specs/domain/Shipment/analysis.md` | 4b17d92 |
```

三個地方要看：

| 欄位 | 值 | 為什麼 |
|---|---|---|
| `Tier` | **`baseline`** | 不是 T2、不是 T3。closeout 與 pr-review 的 reader 都認得這個值。 |
| Description 末尾的路徑 | `dflow/specs/domain/Shipment/behavior.md`、`dflow/specs/domain/Shipment/analysis.md` | 每一列都要宣告「碰到什麼」。baseline 宣告的是**它寫進去的文件**——它沒有原始碼變更。兩支都要列：closeout 會檢查 `spec-baseline` 那個 commit 帶的 BC 層文件都在這一列宣告過，漏列 `analysis.md`，它就成了不該出現的路徑，closeout 被擋下。 |
| `Commit` | `4b17d92` | 就是 `spec-baseline` 那個 checkpoint 的 hash。 |

## 產出 2 — Step 6 逐題確認，與為什麼 checkpoint 叫 `spec-baseline`

capture 記完之後不是馬上 commit。baseline 沒有實作，Step 5 跳過，但它照樣走 Step 5 → Step 6 的
step gate、跑完 Step 6，commit 才在 Step 6 結尾問：

```text
Dflow:
Baseline capture recorded. Ready to update artifacts? /dflow:next to proceed.
（這是 Step 5 → Step 6 的 step gate——baseline 沒有實作，Step 5 跳過；這一關不問 commit）
```

Bob 回 OK。Step 6 的完成檢查表對 baseline 只做重新核對，不新建任何東西：

```text
Dflow:
Step 6 完成檢查表：
- spec 那幾項：N/A（baseline 沒有 spec 檔）
- behavior.md、analysis.md：Step 2 寫的，重新核對一次
- Tier = baseline 那一列：在，宣告的兩支文件都對得上
- 6.2 需要你確認的：baseline 有自己的一組題目，下面一題一題問
```

6.2 原本五題裡，第 1 題（Delta 的意圖）與第 5 題（收掉 Implementation Tasks）對 baseline
是 N/A——沒有 Delta，也沒有 spec。其餘照 `modify-existing-baseline.md` 排好的順序問：

```text
Dflow:
6.2 逐題確認（baseline）：

1. Step 3 有沒有漏記的技術債？
   這次記了一列：Shipment 免運門檻判斷基準三處不一致。
Bob: 沒有漏。

2. Step 4 記下的抽離機會寫得夠清楚嗎？
   那一列寫的是「拍板後需在 Domain 建立單一的免運門檻判定 contract」。
Bob: 夠清楚。

3. analysis.md 這次寫的條目裡，有沒有 inferred / assumed 的？
   RM-01、HS-01 的 Evidence 都是 code——這題沒有要問的。

4. 這次寫進或改了的 BR？
   沒有。三處的差異是待決的業務問題，這次刻意不寫成 BR。

5. behavior.md 這次寫的每一段——有沒有 BR-ID 都算：
   「運費計算的三個產生點」、Scenario 1～3、「未捕捉的範圍」、
   「已知不一致（不在本文件裁定）」，照現況寫對了嗎？
Bob: 對。「已知不一致」那段就是我們要的寫法：記三種結果，不裁定。

6. 盤點時有沒有看到既有文件寫錯、名詞用法不一致？
   沒有。

7. 這次用到、glossary 還沒有的名詞：免運門檻。要定一個主名詞嗎？
Bob: 先不要。免運門檻怎麼判定還沒拍板（HS-01），現在寫定義等於先寫了半條規則。
     等營運拍板、那個 feature 寫 BR 時一起定。

8. models.md、context-map.md 這次有沒有新增或改了的內容？
   沒有。
```

第 5 題問的是 `behavior.md` 這次寫的**每一段**，不只有 BR-ID 的段落：本篇的三個情境與「已知不一致」
都沒有 BR-ID，但它們一樣是這次寫進去的現況，一樣要開發者確認寫對了。每一段照它寫的是什麼來問：
沒有 BR-ID 的段落寫的是觀察本身，所以本篇整題問「照現況寫對了嗎」；帶 BR-ID 的情境問的是
「寫的是不是確認的規則」，偏離行問的是觀察與證據（見 [walkthrough 03](walkthrough-03-baseline-capture.md) 的第 5 題）。

每一個確認在 host 的 Goals & Scope 記一行：它定了什麼、落在哪。baseline 最小 host 記在開頭那一兩句
（盤點的範圍）之後——本 fixture 的 Goals & Scope 還有幾段說明，確認行就接在 Goals & Scope 的最後：

```markdown
2026-05-11 baseline capture 的 6.2 確認（開發者 Bob）：
- 技術債：Step 3 沒有漏記。
- 抽離機會：「Shipment 免運門檻判斷基準三處不一致」那一列（拍板後建立單一判定 contract）寫得夠清楚。
- `Shipment/behavior.md`：「運費計算的三個產生點」、Scenario 1～3、「未捕捉的範圍」、「已知不一致（不在本文件裁定）」都照現況寫對。
- 名詞：「免運門檻」先不進 `glossary.md`，等免運門檻的判定拍板（`Shipment/analysis.md` HS-01）時一起定。
```

確認不寫進 Resume Pointer（Current Progress 維持一兩句的游標），也不另開段落。
`analysis.md` 的條目若是經 6.2 確認的，Evidence 會寫成
`confirmed by {role} - SPEC-20260511-001 Goals & Scope ({date})`——用 SPEC-ID 指 host，不寫路徑：
這個 host 收尾時會被搬進 `completed/`。（本篇的 RM-01、HS-01 都是 `code`，沒有這樣的條目。）

```text
Dflow:
✓ 變更完成（Step 6 跑完）
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
        dflow/specs/domain/Shipment/behavior.md 與
        dflow/specs/domain/Shipment/analysis.md，
        而且那兩份文件都**存在於它的樹裡**
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
  Resume Pointer 寫**進行中**的值——Active Workflow: finish-feature、
  Current Step: Step 3 — sync BR Snapshot to BC layer、
  Awaiting: none (mid-step)。closeout 還沒跑完，終局值在 Step 4 寫。

Step 3 — Sync BR Snapshot to BC Layer：
  先收集 debt 訊號：這個 host 沒有任何 spec 檔（只有一次 baseline capture）
  → 沒有訊號。Debt reconciliation: no signal

  接著看 host 形狀：這是 **(iii) baseline-precaptured** 的情況——
  BC 層在 capture 當下就已經寫好了（隨 checkpoint 1 進版控），
  closeout **沒有東西要再 sync**。

  注意這和 no-BC 的「跳過 BC 範圍的同步」不一樣：
  本 host **有** bounded context（Shipment），
  只是它的內容早就寫進去了。
  Integration Summary 的 BC: 欄填 **Shipment**，不是 none。

Step 4 — git mv 歸檔，**緊接著寫 Resume Pointer 終局值**
  （Active Workflow: none、Current Step / Gates Passed: n/a、Awaiting: none），
  中間不插任何等待點；再寫 closeout 列、git add、commit（checkpoint 2）。

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
差別。baseline 有真實的 bounded context，這一次捕捉的內容就住在那裡。

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
| 新建 | [`.../SPEC-20260511-001-shipment-fee-baseline/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260511-001-shipment-fee-baseline/_index.md) | baseline 最小 host：七個必要段落、`Tier = baseline` 列、`spec-baseline` checkpoint、Goals & Scope 末尾的 6.2 確認行。（`BC: Shipment` 是 Integration Summary 的欄位，不在 fixture 裡；fixture 對 BC 的宣告在 Goals & Scope。） |
| 新建 | [`outputs/dflow/specs/domain/Shipment/behavior.md`](outputs/dflow/specs/domain/Shipment/behavior.md) | 三處 confirmed behavior 的捕捉結果，含「未捕捉的範圍」與「已知不一致（不在本文件裁定）」。 |
| 新建 | [`outputs/dflow/specs/domain/Shipment/analysis.md`](outputs/dflow/specs/domain/Shipment/analysis.md) | RM-01：運費的三個產出點、比門檻用哪個金額、通知信讀的快照；HS-01：免運門檻該拿哪個金額比（open，連回 tech-debt）。Step 2 第一次有東西要記時從範本建。 |
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
- **依 host 狀態分三路**：(a) 有 BC-bearing、phase-bearing 的 active → 掛回去；(b) 只有 completed → follow-up 變體；(c) 都沒有 → standalone 最小 host。
- **Step 6.2 有 baseline 自己的一組題目**：沒有 BR-ID 的 `behavior.md` 段落也要確認；每一個確認在 Goals & Scope 記一行。
- **第一個 checkpoint 叫 `spec-baseline`**，不是 `implementation`——沒有實作就不要在 ledger 裡宣稱有。
- **產出一列合法的 `Tier = baseline` row**，那就是它的記錄；不產 spec 檔。
- **BC 在 capture 當下就寫好**，closeout 沒有東西要再 sync；但 `BC:` 欄填真實的 context，不是 `none`。
- **confirmed 進 `behavior.md`，unknown / buggy 進 `tech-debt.md`**，不硬升成 BR。
- **還沒有確認的規則，就沒有偏離**：三處不一致記成觀察與待決題，不用 `Known deviations` 欄與 `> Known deviation:` 行。
- **一個數字在哪幾處、怎麼算，以及卡在它上面的待決決定，進 `analysis.md`**；它指回 `behavior.md` 的情境與 `tech-debt.md` 的待決那一列，不重抄。
- **不留空的 active feature**——baseline host 走完生命週期並歸檔。

## 下一個 walkthrough

Brownfield 主線到這裡把四種 host 形狀都走過了：**hosted**（02 / 03 / 05）、
**phase-bearing new feature**（04）、**closeout**（06），以及本篇的
**baseline 最小 host**。

想看 Greenfield 側的 standalone 與 follow-up 最小 host，可讀
[〈Greenfield Walkthrough 07 — 沒有任何 feature 可掛時〉](../01-greenfield/walkthrough-07-standalone-minimal-host.md)
與 [〈Greenfield Walkthrough 08 — completed feature 上的 orphan bug〉](../01-greenfield/walkthrough-08-followup-minimal-host.md)。
