# 系統層在收尾時寫入

> **繁體中文** | [English](system-layer-at-closeout.en.md)

> 本頁跟著原始碼的 `main` 分支走，可能描述 changelog 還列在 `## Unreleased` 的行為。你的專案用的是它 workflow bundle 裡的那一版 flow：`dflow/specs/shared/dflow-workflows/references/new-feature-flow.md` 的 `### 8.3 Documentation updates` 開頭寫著「This step writes only what describes the system as built」，就表示你的專案已經是本頁的做法；沒有的話，升級 CLI 之後跑一次 `dflow configure-agents` 就會有。

一個 feature 常要來回好幾輪才定案，每一輪開一個 phase。帶 phase-spec 的 feature，它對 domain 的變更只在 `/dflow:finish-feature` 收尾時，依整個 feature 最後留下來的樣子寫進系統層一次；在那之前只留在 feature 目錄。這一頁寫怎麼運作、進行中的規則在哪裡看，以及我們知道但決定不防的幾處。

## 怎麼運作

**系統層**指 bounded context 的現行文件，跨 feature 共用：`dflow/specs/domain/` 底下的 `glossary.md`、`context-map.md`，以及每個 context 的 `rules.md`、`behavior.md`、`models.md`（greenfield 另有 `events.md`）。

- **收尾時寫**：帶 phase-spec 的 feature，新增、修改、移除的規則與情境、模型、術語、事件、context 之間的關係，由 `/dflow:finish-feature` Step 3 依整個 feature 的淨結果寫進系統層。這是唯一寫入的一步。
- **在那之前**：進行中的狀態在 feature 目錄——`_index.md` 的 Current BR Snapshot，與各份 phase-spec 的 Business Rules、Behavior Scenarios、Delta、Domain Concepts（greenfield 另有 Domain Events）。
- **掛在這種 feature 底下的 T2**（`/dflow:modify-existing` 的 lightweight-spec）：當場只寫 `analysis.md` 與技術債，其餘跟著 feature 在收尾時寫。
- **照舊當場寫的**：
  - 記系統現在樣子的：`analysis.md`（兩個位置都是）、技術債檔，以及 brownfield 的 baseline 盤點。`analysis.md` 每個 phase 做完都會複核，合回 `main` 時對的是已經做出來的東西。
  - feature 落腳的 context：`/dflow:new-feature` Step 2 的 `context.md`、`context-map.md` 那個 context 的列與 Subdomain Type。
  - 自己一個 host 的變更（minimal host：standalone、follow-up 的 minimal 變體、post-hoc hotfix）：它的 checkpoint 1 就是那筆變更做完，收尾緊接在後。
  - 沒有 bounded context 的 host 上，lightweight 變更寫的全域文件（`glossary.md` 等）：這種 host 的收尾不做 bounded context 的同步。帶 phase-spec 的這種 host，phase-spec 記的術語照樣由收尾寫進 `glossary.md`。

## 進行中的規則在哪裡看

- 讀 `dflow/specs/features/active/*/_index.md` 的 Current BR Snapshot。`/dflow:status` 的第一部分列出所有進行中的 feature。
- `/dflow:new-feature`、`/dflow:new-phase`、`/dflow:modify-existing` 開頭的掃描，會讀同一個 context 進行中 feature 的 Snapshot：這次要加或改的規則，別的 feature 已經在加或改，就停下來讓開發者決定。
- `/dflow:verify` 遇到缺 `rules.md` 或 `behavior.md` 的 context，照樣報缺檔、照樣停下；另外點名落在這個 context 的進行中 feature，說它的規則要到收尾才進這兩份檔，缺檔**可能**是這個原因。它不斷言就是這個原因：定案的檔也可能被誤刪，重建之前先查歷史。

## 每個 phase 都合回 `main` 的專案

greenfield 的 Trunk 範本建議把大的 feature 拆成幾個 phase、每個 phase 合回 `main`。這時合回的程式已經在 `main`，但 `main` 的 `rules.md` 要等收尾才看得到這個 feature 的規則；要知道進行中的規則，讀那個 feature 的 `_index.md`。

要每一個合回 `main` 的增量都有系統層文件跟上的團隊，這個做法不合適：每個 phase 都寫進系統層，放棄的 feature 會留下沒有定案的規則，系統層就變成「每個分支目前做到的」。

## 接受的風險

每一項寫：會出什麼錯、為什麼不防、誰承擔、什麼條件下會重新考慮。

1. **每個 phase 都合回 `main` 時，`main` 的 `rules.md` 看不到進行中的規則。** 直接讀 `rules.md` 的人看不到；三支 flow 的掃描讀得到同一個 context 的。
   - 為什麼不防：要讓 `main` 看得到，就得在每個 phase 寫進系統層，放棄的 feature 會留下沒有定案的規則。
   - 承擔：Trunk 專案在收尾前讀 `rules.md` 的人。
   - 重看：有 Trunk 採用者回報這造成誤判時。
2. **feature 落腳的 context 照舊當場建。** 放棄的 feature 會留下一個沒有規則的 context（`context.md` 與 `context-map.md` 那一列）。
   - 為什麼不防：之後的建模深度與每個 phase 都從那裡讀 Subdomain Type；另外存，就要在 `_index.md` 加欄位。
   - 承擔：放棄 feature 的團隊。
   - 重看：真的撞到時。
3. **`analysis.md` 照舊當場寫。** 做到一半放棄時，還沒複核的條目留著。它和 `rules.md` 的時間也不同：進行中 feature 的生命週期已經在 `analysis.md`，它引用的 BR 要收尾才進 `rules.md`。
   - 為什麼不防：延到收尾要多一節暫存，每一種 host（包括沒有 context 的）都要在收尾合併；而它每個 phase 做完都複核，合回 `main` 之前對的是已經做出來的東西。
   - 承擔：放棄 feature 的團隊。
   - 重看：真的撞到時。
4. **沒有收尾的 feature 不會進系統層。** 這是本做法要的結果：只有定案的規則進系統層。
   - 為什麼不防：不是缺陷。`/dflow:status` 列出所有進行中的 feature。
   - 承擔：—
   - 重看：不需要。
5. **技術債照舊當場寫。** 它記的是程式，合回 `main` 就是真的；放棄的 feature 若把程式改回去，那一筆要人處理。
   - 為什麼不防：技術債本來就跟著程式走，改成收尾才寫，合回 `main` 的債就沒有紀錄。
   - 承擔：放棄 feature 的團隊。
   - 重看：真的撞到時。
6. **掃描不是完整的衝突偵測。** 它只比對這次要加或改的規則，與同一個 context 進行中 feature 的 Snapshot；規則的移除、依賴別的 feature 的規則、模型與事件的變更、讀不到的分支、還沒 commit 的工作，都不在裡面。
   - 為什麼不防：完整的偵測要讀每個進行中 feature 的全部 phase-spec 並判斷語意，成本落在每一次執行。
   - 承擔：同一個 context 同時有幾個 feature 的團隊。
   - 重看：真的撞到時。
7. **掛在 feature 底下的 T2，程式先合回、feature 後來放棄。** 那筆 T2 的規則只在它的 lightweight-spec 與那個 feature 的 Snapshot，讀 `rules.md` 的人看不到；掃描只在三支 flow 執行時有用，幫不了直接讀 `rules.md` 的人。
   - 為什麼不防：T2 是那個 feature 的一部分；先寫進系統層，同一個 feature 的規則就分成兩個時間點進去。
   - 承擔：那個 context 的讀者。
   - 重看：真的撞到時。
