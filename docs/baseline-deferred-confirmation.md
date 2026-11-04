# Brownfield baseline 盤點：延後回答 6.2 的題目

> **繁體中文** | [English](baseline-deferred-confirmation.en.md)

> 本頁跟著原始碼的 `main` 分支走，可能描述 changelog 還列在 `## Unreleased` 的行為。如果 `dflow render --help` 沒有 `Confirmation records:` 那一段，就是你裝的 CLI 還不讀這些紀錄。`@latest` 裝的是最新**已發布**的 CLI，不保證本頁講的功能已經發布——一個已發布版本包含什麼，看它的 changelog。

Brownfield 的 baseline 盤點（把既有系統現在的行為記進文件、不改程式）在 Step 6.2 要開發者逐題確認：這條規則對不對、這段觀察寫得對不對、這個名詞要不要定下來。開發者不在、或題目多到想先整理成一份清單再一次看的時候，可以**明確授權**把指定的題目延後回答。

延後不是確認。AI 把還沒確認的題目記在答案會改到的那份文件裡，等開發者回來答；答完、套用之後，整筆題目紀錄拿掉，文件跟當場確認會長得**一字不差**（盤點合回之後不開 host 回答的，只有確認出處那幾格不同）。答案怎麼來的、誰在哪天答的，寫在套用答案那一顆 commit 的 message 裡，不留在文件上。

詳細的寫法規則在 workflow bundle 的 `references/modify-existing-baseline.md`（§ Deferring 6.2 questions、§ Draft basis and current observations、§ Preserve pending confirmations、§ Deferred confirmation records），盤點合回之後不開 host 回答的程序在 `references/modify-existing-baseline-confirmation.md`，AI 執行時讀那兩份；本頁說明怎麼用、會看到什麼、做不到什麼。

## 什麼時候可以延後

- **只有 baseline 盤點的 6.2 題目。** 其他 Step Gate、branch gate、commit 政策、merge 與 push 權限、盤點的兩次 checkpoint 都照舊要人在場。全程沒有人看著也能走完，不在這一頁的範圍。
- **要開發者明確授權**，指名題目或整次盤點。沒有回答、人不在、一句「繼續」、AI 自己覺得有把握，都不是授權，也都不是確認。
- 授權範圍、誰授權、哪一天、預定由誰回答，只寫在每一題的 `Deferred confirmation` 那一行。host 的 Goals & Scope 只記**真的取得的確認**，不記延後、不記待確認清單。
- 授權之後，AI 先把授權範圍內的題目整理成一份完整清單，在對話裡給開發者一次看（清單本身不寫進任何文件）：靠推論（`inferred`）或假設（`assumed`）的、來源互相衝突的、其他的，分組列出，每一項都有題號。一題只問 6.2 會單獨問的一件事——一條 BR、一筆 `analysis.md` 條目、一段 `behavior.md`、一個名詞之類——可以單獨回答；不會有兩題在問同一件事。整批回答只算開發者看得到內容與題號、而且明說接受的那幾項；收尾盤點、同意格式、同意 commit 都不算確認任何一題。

## 文件裡會多出什麼

### 還沒確認的 BR：`Draft basis`

盤點寫的 BR 到 6.2 結束還是 `draft` 時，`behavior.md` 裡那個 BR 的標題正下方、那一段的其他內容（包括第一個 Given/When/Then）之前，多一行 `Draft basis`，寫這條候選規則從哪裡來：

```text
> Draft basis: code - ReceiptsController.Create and Edit, invoice-number checks (2026-10-16) — confirmation: [SPEC-20261016-001/Q01](./rules.md#open-questions) — observation: same-scenario
```

- 種類只有 `code`、`data`、`document`、`inferred`、`assumed` 五種，意思跟 `analysis.md` 的 Evidence 寫法相同。`code` 只表示列出的入口直接做了這個檢查，不表示系統每個入口都守住，更不是開發者確認了業務規則。
- `Draft basis` 不收 `confirmed by`：它記的是**還沒確認**的候選從哪裡來。
- `inferred` 的 BR 另有一段「系統現在怎麼做」的觀察：沒有 BR-ID、自己一個標題、放在那個 BR 的段落之外，`observation` 連過去。頁面只對 draft 顯示送審按鈕、server 卻沒檢查狀態，「只有 draft 可以送審」就是推論；現況是畫面與 server 兩種觀察，在規則確認之前，兩者的差異不算偏離（`Known deviation`）。

### 待確認的題目：四種紀錄

題目放在答案會改到的那份文件，照 `analysis.md` § Open Questions and Hotspots 原本的分流：

| 題目關於 | 放在 |
|---|---|
| 業務規則 | 那個 context 的 `rules.md` § Open Questions |
| 名詞 | `glossary.md` § Open Questions |
| context 的邊界、整合責任 | `context-map.md` § Open Questions |
| 流程、生命週期、推導數字、機制、角色權限 | 對的那一份 `analysis.md` § Open Questions and Hotspots（原本的 HS 表格之後） |
| 模型 | `models.md` 裡那個模型所在的表格之後（或 Context、Code Mapping Notes 那一段之後） |
| 技術債本身 | `tech-debt.md` § Follow-up Notes |

每一筆紀錄自成一段、前後各空一行。`Question` 是清單的一項，其他三種是緊接在它後面的引用段落，依序、用得到才寫：

```text
- Question: SPEC-20261016-001/Q02 — target: domain/billing/rules.md BR-004 — asks: May only a draft be submitted for review?

> Deferred confirmation: SPEC-20261016-001/Q02 — state: pending — scope: Business rules — assigned to: Finance lead — authorized by: Dev lead (2026-10-16)

> Provisional: SPEC-20261016-001/Q02 — answer: Yes, only drafts — basis: inferred - Review.cshtml shows Submit only for draft (2026-10-16)

> Decision: SPEC-20261016-001/Q02 — outcome: unresolved — answer: cannot confirm yet; the auditor decides — confirmed by: Finance lead (2026-10-17) — applied to: not-applied with reason: ask the auditor, then apply
```

- `Provisional` 是 AI 的暫定答案，**不是確認**；沒有暫定答案就不寫這一行。
- `Decision` 只在答案還不能套用時才有，而且只有一行：還是無法確認寫 `unresolved`、要交給一般的 spec 流程套用寫 `not-applied`、答案互相衝突寫 `conflicting`。它的 `confirmed by` 只表示這個角色給了這個答覆，不表示規則或程式已經確認，也不表示答案已經套用。
- 題號是盤點那個 host 的 SPEC-ID 加 `/Q` 與至少兩位的編號。同一個 SPEC-ID 底下編號**永不重用**，紀錄拿掉之後也一樣：新題號從那個 SPEC-ID 已經用過的最大編號往上加——查版本歷史（commit message 也算），再加上還沒 commit 的這次修改已經配出去的編號（寫進過紀錄才算；只預留、從沒寫進紀錄的不算）——不是從文件裡現在還看得到的編號。

### 沒問的名詞：`not confirmed`

盤點用到、`glossary.md` 還沒有的名詞，第 7 題只逐題問要有人做選擇的：

- 程式或文件把同一個詞用在兩件以上的事上（例：「銷假」既指取消已核准的假，也指假後回來報到）；
- 同一件事有兩個以上的叫法；
- 名字和程式的做法對不上，或程式沒說清楚它是什麼（例：額度欄位是總額還是餘額）。

只是 AI 自己翻譯或取了名字，不算要選擇；翻譯之外還有上面三種情況之一，照樣要問。`glossary.md` 已經標未確認的名詞，這次碰到上面三種情況之一也會問；已經有待答題目的名詞，照它的題號回答，不另外問。

問了、定下來的名詞才寫進 Terms 表。延後、或你還定不了的，不寫那一列，只留一筆待確認題目（定不了的，題目紀錄多一行 `unresolved` 的 `Decision`）；它不寫進 Goals & Scope——那裡只記真的取得的確認。

其餘的名詞不問：AI 照程式（畫面上的字也算）或既有文件的叫法與意思寫進 Terms 表、標未確認，在同一則訊息裡連定義列給你看，連同這次用到、`glossary.md` 已經標未確認、這次沒有問的名詞。那則訊息不是題目：你明說接受或更正的名詞才算確認；沒回、或一句「OK」，名詞照樣是未確認。

未確認的名詞，Notes 那一格多一項：

```text
not confirmed - inferred - Receipt.Status value Submitted (2026-10-16)
```

- 種類照 `Draft basis` 的五種；`inferred` 表示名字或意思是 AI 推的（例如畫面上沒有中文字，AI 把程式裡的 `Submitted` 翻成「已送審」）。
- 確認之後，確認的出處取代這一項：在 host 裡確認寫 SPEC-ID；有題號的名詞題不開 host 回答時寫 `confirmed by {role} - version history ({date})`。列出、沒問的名詞沒有題號，不開 host 回答碰不到它們，要在之後的盤點確認。Notes 裡其他的備註照留。
- 之後的 feature 或 lightweight 變更寫到這一列：它的 spec 新增或改了這個名詞，收尾時換成那個 feature 的 SPEC-ID；只是用到它，標記照留。
- 列出、沒問的名詞不是延後的題目：沒有題號、沒有紀錄，延後也不會替它們開題。
- 從 brownfield 把文件搬進新的 greenfield 專案時（README 的模式選擇與遷移），這個標記會跟著過去，greenfield 的流程不認得它：搬之前在 brownfield 的盤點確認，或搬過去之後在 greenfield 的 spec 裡定下來。

## 之後怎麼回答

| 什麼時候答 | 怎麼做 |
|---|---|
| 盤點的 checkpoint 1 之前 | 直接套用；checkpoint 1 commit 的就是最終形狀，確認照常記在這次盤點的 Goals & Scope |
| checkpoint 1 之後、收尾之前 | 照那個 host 的 checkpoint 規矩；盤點文件的修改不能塞進收尾的 commit |
| 盤點已經收尾 | 另開一次普通的 baseline 盤點（`/dflow:modify-existing`）來答；確認記在**這一次**的 host、用這一次的 SPEC-ID。從一次較大的盤點裡挑幾題回答，不會因此變成那次盤點的 follow-up |
| 盤點已經收尾，而且合回了整合分支 | 也可以不開 host，直接回答既有的題目（下一節） |

### 不開 host 直接回答（盤點合回之後）

盤點收尾、合回專案的整合分支之後，如果只是回來回答它延後的題目，不必另開一次盤點：跟 AI 說要回答哪一次盤點（SPEC-ID）的哪幾題，或那次盤點全部還在等的題目，`/dflow:modify-existing` 會辨識出來。這條路不分 tier、不開 host、不配新的 SPEC-ID、不記 checkpoint，最後只有一顆文件 commit。同一個請求還要盤點新的東西或改程式時，AI 會先拆開：這條路只答題，其餘當成另一個請求、照一般的 `/dflow:modify-existing` 做，先做哪一個問你，兩邊都不會漏掉。

- **開始之前**：盤點還沒收尾，就在那次盤點自己的 workflow 裡答；收尾了還沒合回，先合回。有 workflow 正在改同一條規則或同一份文件時，AI 列出重疊、問你先完成哪一個，不去動那個 host。
- **分支**：gitflow 從含有這次盤點的整合分支，開一個專案允許的文件分支，照專案的 PR 規矩合回同一個分支；trunk 照專案對文件 commit 的規矩。專案沒有文件分支的慣例時，AI 會問你用哪個分支、怎麼合回；Dflow 不訂分支名稱，也不會復活盤點的 feature 分支。
- **先重新查依據**：盤點之後文件可能變了。BR 改了名、規則的意思變了、觀察的入口搬了、題目指的東西不見了，或已經有別的答案時，AI 把差異給你看，問的是**現在的**內容；題目不再適用，就換成新題號的題目。對舊候選的同意，不會套到新版本上。
- **回答**：AI 列出全部選定的題目（題號、指的是什麼、問什麼，有暫定答案就附上）。可以逐題答、指名一組題號整批答，也可以只答一部分，其餘照樣待確認。同意 diff 或 commit 不算確認任何一題。
- **套用**：跟在 host 裡答的一樣（見下一節的表），文件最後跟當場在 6.2 確認一字不差，只有確認出處那幾格不同：`analysis.md` 條目的 Evidence、`glossary.md` 名詞的 Notes、偏離技術債的 `Rule evidence` 寫 `confirmed by {role} - version history ({date})`；確認程式現況的，在原本的證據後面接上 `; confirmed by {role} - version history ({date})`。`version history` 指寫下這一格的那顆 commit：想知道是誰、怎麼答的，打開那一格的版本歷史。`rules.md` 與 `migration/tech-debt.md` 照舊不加確認附註。
- **這條路不做的事**：不做新的盤點、不改程式、不順便整理別的、不改 `active` 規則的意思、不寫進已完成的 host、不把偏離的技術債標成已修（那是 finish-feature Step 3 的事）。要重新盤點才答得出來的題目照樣待確認，交給一次普通的盤點。答案會改到正在進行的 feature 的 Current BR Snapshot 所承載的規則時，照樣只記 `not-applied` 的 `Decision`，交給一般的 spec 流程。
- **commit**：AI 先檢查——每一處改動都對得到一個答案；受影響的 context 跑 `/dflow:verify` 的 BR-ID 與 anchor 檢查；跑 `dflow render`、`dflow doctor`；照專案的 hook 或 CI 跑 `dflow check-closeout`；已完成的 host、Checkpoint Log 與程式都沒動——再把 diff 與還在等的題目給你看，提議一顆文件 commit。主旨照專案自己的慣例，不是 `[SPEC-ID]` 的形式（它不屬於任何 host）；message 寫出盤點的 SPEC-ID、每一個題號、誰在哪天答、答了什麼、改了什麼。commit 不等於 merge：確認規則不代表可以開 PR、merge 或 push。

## 答完套用之後

答案能套用時，同一次修改裡：套用答案、拿掉那一題的整筆紀錄、拿掉候選規則的 `Draft basis`、處理「系統現在怎麼做」那一段。不寫「已完成」，不留決定的歷史。帶著這次修改的 commit，在 message 裡寫出它拿掉或換掉紀錄的每一個題號——在那顆 commit 之前就開了又拿掉的題也算——以及答案是誰在哪天給的、改了什麼。答案怎麼來的（延後、AI 暫定）就留在那裡，不進文件；之後配新題號時，也是靠它才看得到用過的編號。

| 開發者的答案 | 文件變成 |
|---|---|
| 接受候選規則 | `draft` 改 `active`；拿掉 `Draft basis` 與題目紀錄；程式符合時，觀察段落裡屬於這一題的內容拿掉 |
| 確認規則，程式不一樣，而且明說先不修 | 照 [確認的規則與程式不一致時](confirmed-rule-vs-code.md) 寫偏離紀錄與技術債，觀察段落轉成偏離紀錄 |
| 說沒有這條規則 | 拿掉那一列 `draft`、那個 BR 的情境段、`Draft basis` 與題目紀錄；程式現況留成沒有 BR-ID 的一般段落，不留下指向被否定 BR-ID 的連結 |
| 還是無法確認 | 加一行 `unresolved` 的 `Decision`；規則維持 `draft` |
| 答案會改到正在進行的 feature 的 Current BR Snapshot 所承載的規則 | 題目保留，`Decision` 寫 `not-applied`，交給一般的 spec 流程；spec 真的套用之後才拿掉紀錄 |
| 同一天的答覆互相衝突，或分不出先後 | 一行 `conflicting` 的 `Decision` 寫下各個答覆；題目保持待確認，請開發者釐清，不照行序猜 |

觀察段落還有別的題目或候選在用時，只拿掉屬於這一題的內容，其餘留下或拆成新段落、連結一起更新，不讓還在等答案的題目指向被刪掉的段落。

## 五個地方怎麼讀

- **`rules.md` 那一列**：`draft` 就是還沒確認；有沒有 `Draft basis` 都一樣。依據沿著 Behavior anchor 到 `behavior.md` 看，題目在 Open Questions。這一欄刻意不加。
- **Goals & Scope**：只有真的取得的確認與落點。盤點收尾（`completed`）只表示盤點結束，不表示每一題都答了。不開 host 回答的確認不在任何 Goals & Scope 裡：它的出處寫 `version history`，去讀寫下那一格的 commit。
- **Current BR Snapshot**：baseline 盤點的 host 留空。follow-up host 只從 `rules.md` 繼承 `active` 的規則；`draft` 的規則與它的題目留在原文件。`Draft basis` 與題目紀錄不進規則文字、不進 Snapshot。
- **`dflow render`**：見下一節。
- **下一個 session**：要依賴一條 `draft` 規則、或改寫帶 `Draft basis` 的情境之前，先讀還在等答案的題目與還沒套用的答覆；已套用的答案已經在文件裡了。沒有標記的舊 `draft` 一樣不是 `active`。

## `dflow render` 怎麼呈現

- 格式完全正確的紀錄，那一行前面加一個標示：`Question` 是「待確認題目」、`Deferred confirmation` 是「待確認」、`Provisional` 是「AI 暫定・不是確認」、`Decision` 是「答覆已記錄・尚未套用」加上 outcome、`Draft basis` 是「draft 依據・未確認」。有這些紀錄的頁面，頁首多一行摘要。
- 標示只代表**讀到這個格式**，不代表角色、授權、程式或規則已經查證；沒有任何一種標示表示「已確認」。沒有標示也不代表沒有待確認的事：答完的題目不留紀錄，用一般文字寫的題目不會被讀到。
- 一行以 `Question`、`Deferred confirmation`、`Provisional`、`Decision`（`behavior.md` 另加 `Draft basis`）開頭——大小寫、冒號、縮排、清單或引用的寫法有出入也算——而且帶著題號（`SPEC-YYYYMMDD-NNN/QNN`），卻不完全照格式時，頁面在那裡加一行提醒、摘要把它列為未判定，命令列在 `confirmation records:` 那一行底下逐處列出檔名、行號、哪裡不對、預期的格式與處理方式。那一行原文照留，不加標示。轉換照常完成，結束碼不變。
- 會被報的情況：欄位缺了或順序不對、分隔符不是「 — 」、日期不是有效的 `YYYY-MM-DD`、題號格式不對、`Question` 不是最外層清單的一項或其他紀錄不是最外層的引用段落、紀錄那一行有 Tab、一筆紀錄的上一行或下一行不是空行（例如兩筆紀錄寫在相鄰的兩行）、放在不收這種紀錄的檔或段落、在有表格的段落裡寫在表格之前（`analysis.md` 的 HS 表格；`models.md` 的 Entities、Value Objects、Domain Services、Repository Interfaces 一律要在那一節的表格之後）、`Draft basis` 不是緊接在它那個 BR 的標題下面、沒有緊接在同一題的 `Question` 後面、同一題的同一種紀錄在整份 specs 裡出現不只一次（每一份都報）。
- 不會被讀的：沒有題號的行（例如 `Decision: whether invoices may be cancelled is still an open question.`）、程式碼區塊、HTML 註解、行內程式碼裡的範例。
- 處理方式：打開那一行與相鄰的題目，對照 `references/modify-existing-baseline.md` 的格式；保留答案與證據，改寫成標準格式；如果它只是一般文字，拿掉題號或開頭的關鍵字。處理之前，不要依那一行判定任何事已確認。專案的 specs 裡沒有 brownfield 的 workflow bundle 時，提醒改指向本頁。

## 升級既有文件

這一版的 brownfield 範本 `behavior.md` 升到形狀 3、`_index.md` 升到形狀 4，`dflow doctor` 會提示：

- `behavior.md` 的 Purpose 與 Maintenance 說明換成新範本的。既有的 `draft` 情境與觀察照樣有效；**不要從文字猜它們的依據或確認狀態**。要等下一次盤點寫到或實質改寫那條 `draft` BR 時，才補上它的 `Draft basis`。
- `_index.md` 的 Current BR Snapshot 說明跟新範本比對，繼承規則時照 follow-up 的規定。既有的 Snapshot 列與已完成的紀錄**不要**當成形狀遷移去改；`draft` 與確認的衝突，在正在跑的 workflow 裡解決之後再同步。

`dflow configure-agents` 不會改你已經寫好的文件。

## 做了之後仍然存在的風險

| 失敗情境 | 為什麼沒有防 | 誰承擔 | 什麼時候重新考慮 |
|---|---|---|---|
| `code` 依據只查了部分入口，漏掉繞過的路徑 | 格式與連結證明不了入口查齊了；不另做程式語意的驗證 | 確認的人、之後的開發者、reviewer | 真的因為依據分錯而做錯，或入口遺漏一再發生 |
| AI 把「可以先做」當成接受全部規則，或把確認規則當成確認程式現況 | 機械檢查證明不了對話裡的意思，靠 AI 與 review 分辨 | 執行的 AI、開發者、reviewer | 出現錯誤的 `active` 或錯誤的程式現況確認 |
| 開發者一直沒回來，題目一直待確認 | 不加通知、期限或升級 | 專案維護者與接手的人 | 累積到妨礙工作 |
| 用一般文字寫的 AI 暫定答案沒被 `dflow render` 抓到 | 只保證讀到標準格式與帶題號的近似寫法，不辨識所有自然語言 | 文件作者與讀者 | 某種常見寫法一再漏判 |
| 只看 `rules.md` 那一列，看不出依據是推論還是程式 | 刻意不加欄；依據要沿 Behavior anchor 看 | 只查那一列的讀者 | 真的因為只讀那一列而誤用 |
| 舊的 `draft` 沒有依據，接手的 AI 自己猜 | 不自動遷移，原本的依據可能已經還原不了 | 原作者與下一次碰到的開發者 | 舊資料被誤用成為主要回報 |
| 題目多、紀錄變長，開發者整批同意卻漏看高風險的推論 | 分組與逐項標題號保證不了人真的讀過 | 確認的人與之後的使用者 | 一再發生形式上確認、實際沒讀 |
| 版本歷史不完整（例如淺層 clone）時，新題號撞到已拿掉的題號 | 題號從版本歷史配發，文件裡不另留用過的題號（文件只記現況） | 開新題的 AI 與開發者 | 撞號真的造成追查錯誤 |
| 只讀文件，看不出答案是怎麼取得的 | 過程只在版本歷史裡，這是刻意的文件原則 | 需要過程的讀者：去讀套用答案那一顆 commit 的 message 與 diff | 版本歷史取不到時，另評估專案的保存方式 |
| 全程沒有人在，仍然卡在其他 Step Gate | 只開放延後 6.2，沒有一般的「預先同意往下走」 | 想無人值守的採用者 | 處理一般的預先同意時一併驗證 |
| 舊版已經把 `draft` 帶成 Snapshot 的 `active` | 新規則不回頭改既有 host，只在碰到衝突時停下來問 | 該專案與當次收尾的人 | 出現大量可重現的誤記 |
| 不開 host 回答時，開始之後或審查期間文件又變了，答案套到錯的版本 | 開始前會重新查依據，但跨分支沒有語意上的鎖 | 回寫的人與 merge 時的 reviewer | 多分支衝突變得常見，人工比對的成本超過做版本快照 |
| 不開 host 回答的那顆 commit 夾帶了同一份檔的其他列，`dflow check-closeout` 照樣 exit 0 | CLI 不驗文件改動的語意；逐列的範圍靠 AI 與審查 | 回寫的人與 reviewer | 真的發生範圍被污染，再評估定位方式或改動清單的驗證 |
| 不開 host 確認的出處沒有 host 可以引用 | 熟悉 Dflow 的讀者看得出確認不是在盤點裡取得的；這是刻意接受的差異 | 文件讀者：需要過程時讀那顆 commit | 追查確認來源的需求超出版本歷史能給的 |
| AI 把有歧義的名詞照程式寫進 `glossary.md`、只標 `not confirmed`，沒有問 | 「要不要做選擇」是判斷，機器判不了；列出的那則訊息帶著定義，讓開發者看得到 | 執行的 AI、開發者 | 回報有歧義的名詞被標成未確認、沒有問 |
| 讀的人沒看 Notes，把未確認的名字當成業務定下的主名詞，拿去命名新的程式或 spec | 標記只在 Notes 那一格，不另加欄：加欄要升範本的形狀號碼，每個專案遷移一次 | 讀者與之後的開發者 | 回報照未確認的名字命名而出錯 |
| 收尾時把 spec 只是用到的名詞判成改了，標記被換成 SPEC-ID（其實沒有人確認）；或 feature 裡談定了名詞、spec 卻沒改到它，標記照留，要等之後的盤點列出來時確認 | 「新增或改了」與「只是用到」是判斷，機器判不了；收尾的 diff 看得到那一格 | 執行收尾或 lightweight 變更的 AI、開發者、reviewer | 回報標記被換掉、名詞被當成已確認 |
| 一句「OK」不算確認，未確認的名詞可能一直是未確認，之後每一次盤點用到就再列一次 | 整批回答只算明說接受的，和延後的題目同一條規定 | 專案維護者 | 未確認的名詞多到妨礙工作 |
| 想在盤點之外確認一個列出的名詞，沒有規定的寫法：它沒有題號，不開 host 回答碰不到 | 不為它另開一條路 | 想在盤點之外確認名詞的開發者：照舊可以另開一次盤點，或在之後的 feature 的 spec 裡定 | 回報要在盤點之外確認名詞、找不到寫法 |
| 舊版開的名詞題照舊等答案，不會變成未確認 | 不回頭改既有的題目紀錄 | 那些專案 | 回報舊的名詞題太多、想整批改成未確認 |
| 把 brownfield 的文件搬進新的 greenfield 專案，標記跟著過去：greenfield 的流程不認得它，之後寫那一列時可能被當成一般的備註蓋掉 | greenfield 不產生標記；搬文件是遷移時人手動做的一次性動作，不另訂搬法 | 做遷移的團隊 | 回報遷移後的 greenfield 專案把未確認的名詞當成已確認 |

設計理由（為什麼候選與現況分開寫、為什麼答完就拿掉紀錄、為什麼題目跟著知識放）在 workflow bundle 的 `references/flow-rationale-registry.md`，查 `R-ME-BLDEFER-`；名詞為什麼只問要做選擇的、之後的收尾什麼時候換掉標記，查 `R-ME-BLTERMS-01`、`R-FF-TERMMARK-01`。
