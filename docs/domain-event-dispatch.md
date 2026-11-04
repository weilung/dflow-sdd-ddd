# Domain Event 什麼時候發

> **繁體中文** | [English](domain-event-dispatch.en.md)

> 本頁跟著原始碼的 `main` 分支走，可能描述 changelog 還列在 `## Unreleased` 的行為。你的專案用的是它 workflow bundle 裡的那一版建模指引：`dflow/specs/shared/dflow-workflows/references/ddd-modeling-guide.md` 的 `### Event Flow` 那一節有一句以「**In-process handlers run after the commit.**」起頭，就表示你的專案已經是本頁的做法；沒有的話，升級 CLI 之後跑一次 `dflow configure-agents` 就會有。

本頁講 Dflow 的 DDD 建模指引（`ddd-modeling-guide.md`，兩軌共用）怎麼看同一個程序裡的 Domain Event：handler 在 commit 之前還是之後跑、handler 失敗時要不要寫成業務規則、已經用另一種做法的專案怎麼辦，以及我們知道但決定不防的幾處。

Greenfield 與 brownfield 都適用。Brownfield 沒有 `aggregate-design.md` 與 `events.md`，記錄的地方照指引開頭的 Edition note：Aggregate 的決定記在 `models.md` 與 `rules.md`，事件的失敗處理記在 `behavior.md` 或 `migration/tech-debt.md`。

## 名詞

- **commit**：資料庫交易提交成功的那一刻；在那之前存的東西都還可能整批回滾。在外層交易裡呼叫 `SaveChanges`，只是把變更寫進交易，還不是 commit。
- **in-process handler（同一個程序裡的事件處理器）**：同一支程式裡、收到 Domain Event 就執行的程式（例：更新查詢用的表、改另一個 Aggregate），不經過 message queue。
- **發（dispatch）**：把 Aggregate 累積的事件交給 handler 執行。
- **read model（查詢用的表）**：只給畫面查詢用、不守任何業務規則的資料形狀。
- **outbox**：把要發的事件和業務資料存在同一個交易裡的一張表，commit 之後再從表裡發；程式中途停掉也不會掉事件。
- **一個交易改多個 Aggregate**：同一次資料庫交易裡存了兩個以上 Aggregate 的變更。這是建模指引 Aggregate 規則第 2 條的例外：要記下業務理由、共同的原子邊界（為什麼它們能、也必須一起提交）與什麼時候重看。

## 預設：commit 成功之後才發

- 同一個程序裡的 handler 在 commit 成功之後跑。
- 改另一個 Aggregate 的 handler，是它自己的一次存檔。handler 失敗時，第一個變更已經提交，失敗看得見；要不要寫成業務規則，照下面〈handler 失敗時〉。
- 跨 bounded context 的事件也在 commit 之後送出。有 outbox 時，事件的那幾列和業務資料在同一個 commit 存，之後再從那幾列送。
- 為什麼是這個預設：Aggregate 規則第 2 條本來就預設一個交易只改一個 Aggregate。在交易裡發、handler 又改了另一個 Aggregate，就是一次改兩個，而跨 Aggregate 的規則藏在 handler 裡，spec 看不到。

## 什麼時候可以在 commit 之前跑

只有 handler 寫的東西進的是原本那個交易時：

- **handler 改另一個 Aggregate**：那就是一個交易改多個 Aggregate，照第 2 條記下理由、共同的原子邊界與什麼時候重看（greenfield 記在 `aggregate-design.md` § Design Decisions）。
- **handler 只更新 read model**：不必寫理由，read model 不守規則。也可以放到 commit 之後，那時那張表可能短暫過時；使用者看得到的過時，寫進 `behavior.md`、edge case 或設計決定。
- 判準是有沒有寫進原本的交易，不是有幾個 persistence context：兩個 context 明確共用同一個交易，也算寫進原本的交易。
- **handler 寫到別處**（另一個交易、寄信、呼叫另一個服務）：放到 commit 之後。commit 之前，原本的變更還可能回滾，寫出去的東西卻收不回來。

教學範例：greenfield 的 walkthrough-03，主管核准／退回同時改報銷單的狀態、新增一筆審核決定。開發者選了一起存，Dflow 把理由、共同的原子邊界與重看條件記進 `aggregate-design.md`。

## handler 失敗時

- 在原本的交易之外處理的 handler（commit 之後在同一個程序裡跑，或經 queue），最終失敗、而且業務看得到時，把那個結果寫成業務規則：`behavior.md` 一個 `BR-*` 加它的 Given/When/Then，spec 列一個 `EC-*` edge case。答案可以是「營運人工對帳」。
- 最終失敗包括重試用完，也包括事件根本沒被處理（程式在發之前停掉、還沒接 dispatcher）。
- 不管 handler 有沒有改到另一個 Aggregate 都適用：業務要求的通知、一定要寫出去的稽核紀錄也算。
- 可有可無的通知信、log：不必寫 BR，在 `events.md` 的 Event Flow Notes 記一句或記成技術債即可。
- 業務看不到的失敗不必寫 BR：寫的是業務看得到的最終失敗，不是每一種失敗。
- 還沒接 dispatcher：照舊記成技術債；業務看得到的事件改照這一節寫。

## 已經在 commit 之前發的專案

- **沒有遷移動作。** 已經在交易裡發的專案照舊。Dflow 不會順手搬發事件的時機，因為那會改變哪些東西一起提交；AI 在做別的工作時看到，會告訴開發者它看到什麼，由開發者決定。
- 之後新寫的、改到另一個 Aggregate 的 handler，照第 2 條記一句理由。
- **刻意選 commit 之前發的專案**（例如微軟 eShop 參考程式的做法：同一個命令的副作用在同一個交易裡）：greenfield 記在 `_overview.md` 的 Technical Architecture 一節或一份 ADR，程式的形狀照它（見 [technical-architecture.md](technical-architecture.md)）；brownfield 照 Edition note，記在專案放架構決定的地方。每一個改到另一個 Aggregate 的 handler 照樣照第 2 條記一句理由：第 2 條的理由是那一個操作的業務理由，專案層的決定只說得清楚機制。

## 其他兩處

- **dispatcher 的例子不再指名 MediatR。** 指引寫的是手寫的 dispatcher，或專案已經在用的 mediator。用哪一個是專案的技術選擇，greenfield 記在 Technical Architecture；MediatR 13 起要授權金鑰，見 [examples-by-stack.md](examples-by-stack.md)。
- **檢查表對照 spec 列的事件（greenfield）。** `/dflow:new-feature` 第 7 步與 PR 檢查表的事件項，查的是 spec 列的事件有沒有在程式裡發：spec 列了、程式沒發，不過；spec 沒列，不要求。要發哪些事件在建模時決定，依指引的 § When to Use Domain Events 與 § Subdomain-Aware Modeling Depth：core 的 context 完整列，supporting 只列真的需要的，generic 通常沒有。

## 接受的風險

每一項寫：會出什麼錯、為什麼不防、誰承擔、什麼條件下會重新考慮。

1. **寫了不等於照做。** 預設是給 AI 的指示，不是會擋下的檢查；沒有機器讀程式判 handler 在交易內還是交易外。PR 檢查表的 Risk-Triggered Modeling Review 會把改了 handler 或送達方式的變更送回指引這幾段，由 AI 與審查的人判斷。
   - 為什麼不防：要讀程式才判得出來，而機器判不準。
   - 承擔：採用者與審查的人。
   - 重看：有人回報 AI 照舊在交易裡發、沒寫理由。
2. **沒有 outbox 時，事件會掉。** commit 之後、發之前程式停掉，handler 不會跑，另一個 Aggregate 不會跟上。指引把它算進〈handler 失敗時〉：業務看得到的寫 BR，答案可以是人工對帳；outbox 照舊是之後的升級。
   - 為什麼不防：outbox 對每個專案都是一筆基礎設施（一張表、轉發、清理）。
   - 承擔：照預設、沒有 outbox 的專案。
   - 重看：有人回報掉事件造成業務看得到的後果。
3. **既有專案的程式和預設不一致時，是靜默的。** 已經在交易裡發的專案照舊；之後新的跨 Aggregate handler 照第 2 條記理由，之前的那些沒有理由紀錄。
   - 為什麼不防：Dflow 不替使用者改既有的程式與文件。
   - 承擔：那些專案。
   - 重看：有人回報 AI 順手搬了發事件的時機，或希望補齊既有 handler 的理由。
4. **「只更新 read model」是判斷。** 一個在交易裡跑、說是更新 read model 的 handler，其實守了一條規則（例：額度表）時，那張表就是一個 Aggregate，要照第 2 條。指引只寫判準：read model 不守規則。
   - 為什麼不防：那張表守不守規則要看業務，機器判不出來。
   - 承擔：採用者與審查的人。
   - 重看：有人回報把守規則的表當成 read model。
5. **選了 commit 之前發的專案，每個跨 Aggregate 的 handler 都要記一句理由。**
   - 為什麼不防：第 2 條的理由是那一個操作的業務理由，專案層的 ADR 只說得清楚機制，代替不了。
   - 承擔：那些專案（每個 handler 一句）。
   - 重看：有人回報這一句變成照抄的樣板。
6. **檢查表改成對照 spec 之後，core context 的 spec 漏列一個事件，第 7 步不會發現。** 要發哪些事件，在建模時決定。
   - 為什麼不防：另加一題依 context 類型檢查事件完整不完整，每一次第 7 步與 PR 檢查都要多做一個判斷。
   - 承擔：採用者與審查的人。
   - 重看：有人回報 core context 漏了事件。
7. **在 commit 之前跑、卻寫到別處的 handler，在既有專案裡照舊。** 指引叫 AI 告訴開發者、不順手搬；開發者處理之前，原本的交易回滾時，那個 handler 已經寫出去的效果還在。
   - 為什麼不防：Dflow 不替使用者改既有的程式。
   - 承擔：那些專案。
   - 重看：有人回報因此出現對不上的資料。
