# 規劃程式之前讀 Technical Architecture

> **繁體中文** | [English](technical-architecture.en.md)

> 本頁跟著原始碼的 `main` 分支走，可能描述 changelog 還列在 `## Unreleased` 的行為。你的專案用的是它 workflow bundle 裡的那一版 flow：`dflow/specs/shared/dflow-workflows/references/new-feature-flow.md` 開頭有一段以「**Technical Architecture**: before any step of this flow」起頭，就表示你的專案已經是本頁的做法；沒有的話，升級 CLI 之後跑一次 `dflow configure-agents` 就會有。

本頁只講 greenfield。Greenfield 專案的 `dflow/specs/shared/_overview.md` 有一節 `## Technical Architecture`（Stack、Clean Architecture Layers、Project Layout），記這個專案替程式選的形狀。Dflow 的流程步驟、檢查表與範本說明不綁專案，寫的是通用字眼與常見工具（例如 FluentValidation、Swagger）。這一頁寫 AI 什麼時候讀那一節、兩者不同時以哪個為準、選擇沒記下時怎麼做，以及我們知道但決定不防的幾處。

## 什麼時候讀

- `/dflow:new-feature`、`/dflow:new-phase`、`/dflow:modify-existing`（`/dflow:bug-fix` 也走這一支）的流程開頭都有同一段：這支流程任何要設計領域模型、規劃或寫程式的步驟之前，有 `_overview.md`、這一場還沒讀過，就讀它的 § Technical Architecture。已經在 context 裡的那一份照用。
- 流程檔每次執行都會讀，所以 T3（只在 `_index.md` 記一列的小改動）與從後面的步驟接續的 session 也涵蓋在內。
- modify-existing 第 1 步判 tier（Part A）時還不讀；選修正落在哪一層（Part C）算規劃，在它之前讀。在 Part A 就離開這支流程的執行（轉去 new-feature、或判定不需要追蹤的改動）不讀。
- 收尾時處理主線 hotfix 與 feature 改到同一處（`finish-feature-post-hoc-hotfix.md` § Before closeout）：在兩版之間做選擇、會改到程式時，先照同樣的寫法讀；只動文件的收尾不讀。
- 專案的 `AI-AGENT-GUIDE.md` 還沒有下面那一條規則時（例如採用 managed markers 之前的舊 guide），流程在設計、規劃或寫程式之前停下來，請開發者把 guide 補上；接受 guide 的 managed markers 之後，`dflow configure-agents` 會補。

## 它決定什麼、不決定什麼

這一條規則寫在 greenfield `AI-AGENT-GUIDE.md` § Core Rules 的第 6 條，每一場都會讀。

- **決定程式的形狀**：用哪些套件與模式、每一層放什麼、可以依賴什麼、程式放在哪裡。流程步驟、檢查表或範本說明寫的和它不同時，照 Technical Architecture。
- **不決定流程**：步驟、閘、要寫哪些文件，照舊由 Dflow 的流程決定。`_overview.md` 寫了和流程相反的步驟或閘時，流程照舊。
- **Domain 的依賴照舊**：Technical Architecture 沒有記允許清單時，Domain 除了語言與 runtime 本身，什麼都不依賴。

## 選擇沒記下時

**記下、定下來的選擇**指：Technical Architecture 有那一列、值不是空白、不是 `{…}` 佔位字，也沒有標成暫定（例：TBD、TODO 註解）。工作需要的選擇沒記下時：

1. 先照現有程式一致的做法：第一個功能之後，現有程式就是專案已經做過的選擇。
2. 程式也定不了（還沒有程式，或程式裡有兩種寫法），AI 問開發者，並建議把答案記進 Technical Architecture。
3. Dflow 自己字眼裡的例子、佔位字裡的例子（範本的 Validation 那一列就寫著 `{e.g. FluentValidation}`），一律不算專案的選擇。

Dflow 不替開發者寫 `_overview.md`：它建議記下，記不記、怎麼記由開發者決定。記下之後，之後的 session 不必再問；文件與程式都沒留下答案時，之後的 session 會再問一次。

API 文件是一個例子：Technical Architecture 記了要發佈、用什麼形式，就照做；明記不發佈，就略過；沒記、現有程式也定不了，就問。

## 和 ADR 的關係

Technical Architecture 是現行選擇的摘要。用 ADR 改了選擇時，要同時更新 Technical Architecture——這是寫 ADR 的人的事，Dflow 不檢查。AI 讀到的 accepted ADR 和 Technical Architecture 選的不同時，問開發者哪個為準，不自己挑。

## brownfield 不在涵蓋範圍

Brownfield 的流程不讀 `_overview.md`。Brownfield 的流程、檢查表與範本寫死 `src/Domain/` 這個位置（包含收尾完成檢查裡對 `src/Domain/` 的 grep），而 brownfield `_overview.md` 裡的 Code Layout 一節請專案照自己的技術棧改這個位置（例：.NET 的 `src/{Project}.Domain/`）。

- 會出什麼錯：改了領域程式位置的專案，那些 grep 找不到檔，檢查靜默通過。目前沒有人回報過。
- 為什麼現在不防：怎麼修（讓流程讀 `_overview.md`，或只在用到 `src/Domain/` 的檢查處照 Code Layout 找位置）要看實際專案把領域程式放在哪裡，我們先查清楚再決定。
- 承擔：改了領域程式位置的 brownfield 專案；修法由 Dflow 的 maintainer 負責。
- 重看：下面先到的那一個——Dflow 的 maintainer 拿來實跑的專案下一次升級時（那時會查它們的領域程式放在哪）、下一次改 brownfield 講 `src/Domain/` 的規則時，或有人回報檢查沒找到檔時。

## 接受的風險

每一項寫：會出什麼錯、為什麼不防、誰承擔、什麼條件下會重新考慮。

1. **讀了不等於照做。** 那一條規則是給 AI 的指示，沒有機器比對程式和 Technical Architecture；檢查表裡對著它的只有幾項（Domain 的允許清單、驗證放在哪裡），由 AI 與審查判斷。
   - 為什麼不防：各專案記的選擇和寫法都不同，沒有一種機器比對能對每個專案都判得準。
   - 承擔：採用者與審查的人。
   - 重看：有人回報 AI 讀了卻照通用字眼寫。
2. **沒有 `_overview.md` 的專案靠現有程式與問答。** 第一個功能多半要問幾題，之後照現有程式一致的做法。
   - 為什麼不防：問的只是專案真的還沒做的選擇，答過、或第一個功能寫出來之後就不再問；為此要求每個專案都建 `_overview.md`，代價落在所有專案。
   - 承擔：沒有 `_overview.md` 的專案。
   - 重看：有人回報問得太多。
3. **phase-spec 範本的說明仍寫 EF、Controller／Minimal API、Swagger。** 那是 `Implementation Tasks` 標籤分類的提示，不是步驟；那一條規則也涵蓋範本說明。
   - 為什麼不防：改了要升範本的形狀號碼，每個進行中 feature 的 phase-spec 都會收到一次遷移提示，換來的只是分類提示的用詞。
   - 承擔：greenfield 採用者。
   - 重看：有人回報 AI 把那段說明當成步驟。
4. **Technical Architecture 寫得很長的專案，每次讀得多。** 實例有約 21 KB 的。
   - 為什麼不防：只讀一節要靠 AI 工具切檔，把它拆成別的檔要動範本的形狀。
   - 承擔：那些專案。
   - 重看：有人回報 context 吃緊。
5. **ADR 不逐份讀。** AI 讀到那份 ADR 時才會發現它和 Technical Architecture 不一致（那時問開發者）；沒讀到就照摘要做，而且是靜默的。
   - 為什麼不防：每次逐份讀 ADR，成本落在每一次執行。
   - 承擔：採用者。
   - 重看：有人回報照了過時的摘要。
6. **modify-existing 第 1 步判 tier 時還沒讀。** 判 tier（Part A）不是設計；選修正落在哪一層（Part C）才算規劃，在它之前讀。
   - 為什麼不防：判 tier 不需要專案的技術選擇；提前讀，在 Part A 就離開這支流程的執行也要付。
   - 承擔：greenfield 採用者。
   - 重看：有人回報判 tier 需要專案的技術選擇。
7. **採用 managed markers 之前的舊 guide 拿不到那一條規則。** `configure-agents` 不改寫那種 guide，`dflow doctor` 回報它凍結；workflow bundle 卻照常更新，所以流程開頭那一段照樣在：在設計、規劃或寫程式之前停下來，請開發者把 guide 補上。
   - 為什麼不防：不替使用者改沒有同意採用 marker 的檔。
   - 承擔：沒有採用 marker 的舊專案：補一次；補上之前，那三支流程走不到設計。
   - 重看：有專案刻意不採用 marker、又不願手動補那一條。
8. **「照現有程式一致的做法」是判斷。** 程式裡有兩種寫法、或第一個功能寫偏了而 Technical Architecture 沒記那個選擇時，AI 可能照偏的那一種。Technical Architecture 有記的選擇不受影響（它優先）。
   - 為什麼不防：改成沒記下就一律問，程式已經一致的選擇也得每次問。
   - 承擔：採用者與審查的人。
   - 重看：有人回報照抄了偏的寫法。
