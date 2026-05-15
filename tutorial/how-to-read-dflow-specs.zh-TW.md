# 如何閱讀 Dflow 規格與完整文件範例

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份導讀回答 walkthrough 讀者最容易卡住的一個問題：Dflow 產生很多文件，tutorial 又常連到
完整文件範例；我到底應該先看哪一份，才不會把「歷史紀錄」、「當前狀態」、
「最後完成狀態」混在一起？

本頁不是每個範例檔案的索引。它是一份 reading guide，幫讀者理解：

- walkthrough 裡的 inline excerpt 和完整文件範例有什麼差別
- feature `_index.md`、phase spec、lightweight / BUG spec 各自保存什麼
- `rules.md` / `behavior.md` / `models.md` 等 BC layer 文件為什麼是 cumulative state
- Brownfield 的 baseline capture 和 `migration/tech-debt.md` 要怎麼讀
- review 或 verify 時應該從哪一層開始看

## 先記住一句話

```text
Walkthrough 讓你看懂當下對話；
feature specs 保存 feature 的演進；
domain / migration docs 保存系統目前相信的事；
完整文件範例是這條劇情最後跑完後的完成狀態。
```

所以不要把完整文件範例理解成「本段當下的完整檔案」。在很多 walkthrough 中，
本段當下 feature 還在 `features/active/`，但完整文件範例會因後續
`/dflow:finish-feature` 移到 `features/completed/`。Walkthrough 會用 inline excerpt
重建當下重點，再連到完整文件範例讓你檢查最後完成狀態。

## 三層文件模型

Dflow specs 可以先用三層理解。

| 層級 | 常見檔案 | 你應該怎麼讀 |
|---|---|---|
| Phase / change layer | `phase-spec-*.md`、`lightweight-*.md`、`BUG-*.md` | 讀「這一次變更」：問題、場景、Delta、implementation tasks、驗收條件。 |
| Feature layer | `features/active/.../_index.md` 或 `features/completed/.../_index.md` | 讀「這個 feature 目前累積到哪裡」：phase 列表、Current BR Snapshot、Resume Pointer、Integration Summary。 |
| System layer | `domain/{BC}/rules.md`、`behavior.md`、`models.md`、`events.md`、`migration/tech-debt.md` | 讀「整個系統目前相信什麼」：跨 feature 累積規則、行為、模型、事件與技術債狀態。 |

這三層不是重複文件。它們的時間尺度不同。

## Walkthrough excerpt 和完整文件範例的差別

Walkthrough 會常見這種 note：

```text
本篇引用的完整文件範例指向劇情全部跑完後的完成狀態。
本篇內嵌的 code block 代表這一步結束當下的重點片段。
```

讀法如下：

| 你看到的東西 | 代表什麼 |
|---|---|
| walkthrough 內嵌 code block | 教學重建的「當下片段」，用來理解這一步的 decision。 |
| 完整文件範例連結 | 這條劇情最後跑完後的完成狀態，可用來查完整上下文。 |
| 完整文件範例中多出的 phase / BUG / closeout 內容 | 後續 walkthrough 造成的結果，不代表本篇當下已存在。 |
| 完整文件範例路徑在 `features/completed/` | closeout 後的位置；本篇當下可能仍是 `features/active/`。 |

例子：Greenfield walkthrough 03 在講 `/dflow:new-phase` 時，feature 當下仍 active；
但它連到的 `_index.md` 完整文件範例已經包含後續 bug fix 和 finish-feature 的結果。
這不是矛盾，而是 tutorial 保留最後完成狀態作為 evidence，同時用正文 excerpt 說明當下。

## `_index.md` 不是歷史流水帳

Feature `_index.md` 是 feature dashboard。最重要的區塊通常是：

| 區塊 | 用途 |
|---|---|
| front matter | `spec-id`、slug、status、created、completed date、branch hint。 |
| Phase Specs table | 這個 feature 走過哪些 phase。 |
| Lightweight / BUG rows | 後續輕量修改或缺陷修復。 |
| Current BR Snapshot | 這個 feature 目前相信的 BR net result。 |
| Resume Pointer | 下一個 AI session 從哪裡接續。 |
| Integration Summary | closeout 後給 reviewer / stakeholder 的總結。 |

其中最容易誤讀的是 Current BR Snapshot。

```text
Current BR Snapshot = feature-level current state
phase spec Delta = change history
```

如果 BR-002 在 phase 2 被修改，`_index.md` 應該顯示修改後的 current wording；
它不應該把 phase 1、phase 2、bug fix 的所有歷史都 append 成流水帳。想看歷史，要回到
phase spec 或 lightweight / BUG spec 的 Delta。

## Phase spec / lightweight spec / BUG spec 怎麼分

| 文件 | 何時出現 | 讀法 |
|---|---|---|
| `phase-spec-YYYY-MM-DD-{slug}.md` | T1 feature phase 或 new-phase | 讀本 phase 的 problem、behavior scenarios、BR Delta、tasks。 |
| `lightweight-YYYY-MM-DD-{slug}.md` | T2 modify-existing，仍需 spec 但不開新 phase | 讀小範圍 BR / behavior delta 和 scoped implementation tasks。 |
| `BUG-NNN-{slug}.md` | bug-fix，有 expected vs actual | 讀 reproduction、root cause、fix approach、regression checks。 |

判斷重點不是檔名，而是 Delta 的性質。

| 情境 | 文件應該怎麼表達 |
|---|---|
| 新增 business rule | `ADDED` BR，並同步到 `_index.md` Current BR Snapshot。 |
| 修改既有 BR | `MODIFIED`，保留 Before / After / Reason。 |
| 沒有 BR 變動，只修 implementation behavior | BUG spec 說明 implementation behavior modified；`_index.md` 要寫 Snapshot intentionally unchanged note。 |
| baseline capture only | 不硬塞 T1 / T2 / T3；把 confirmed behavior、buggy behavior、unknown behavior 分流。 |

這也是為什麼 walkthrough 會一直強調 Delta：Delta 讓 reviewer 不用猜「這次到底改了規則，
還是只修正實作」。

## Domain / BC layer 是 cumulative state

`dflow/specs/domain/{BC}/` 下面的文件不是某個 feature 私有的。它們代表 bounded context
目前累積的系統狀態。

| 文件 | 典型內容 |
|---|---|
| `context.md` | BC 職責、in-scope / out-of-scope、upstream / downstream 關係。 |
| `models.md` | Aggregate、Entity、Value Object、Domain Service、Repository interface。 |
| `rules.md` | BR-ID、規則 wording、status、lifecycle note。 |
| `behavior.md` | behavior scenarios，特別適合 Brownfield confirmed behavior。 |
| `events.md` | Domain Events 與 payload / consumer 註記。 |
| `glossary.md` | Ubiquitous Language。 |

關鍵讀法：

```text
single feature _index.md = feature-level current state
domain/{BC}/rules.md = BC-level cumulative state
```

Brownfield finish-feature 的例子很典型：SPEC-001 closeout 時只 finalize BR-001~004；
同一個 `Order/rules.md` 裡的 BR-005~008 屬於仍 active 的 SPEC-002，不能被 SPEC-001
closeout 覆寫或刪除。

## Brownfield 要特別看 baseline 與 tech debt

Greenfield 的主要讀法是從 feature phase 長出 domain model。Brownfield 還多兩個重點：

| 文件 / 區塊 | 讀法 |
|---|---|
| `behavior.md` 的 confirmed behavior | 目前已確認的 legacy 行為，可能跨多個頁面。 |
| `migration/tech-debt.md` | 尚未修的 legacy risk、buggy behavior、unknown behavior、migration blocker。 |
| baseline-capture row | 這次沒有改 code，但有新增系統知識。 |
| resolved / deferred note | 這個 tech debt 是否已由某個 BUG / feature 處理，或仍需追蹤。 |

Brownfield 最重要的紀律是：

```text
讀到錯誤程式碼，不等於把它寫成 business rule。
```

例如 rounding inconsistency 可以先進 `tech-debt.md`，等到 bug-fix walkthrough 再轉成
`BUG-001`。這讓團隊知道某個行為是 confirmed、buggy，還是 unknown。

## Review / verify 時的建議讀法

如果你是 reviewer，或準備跑 `/dflow:verify` / `/dflow:pr-review`，不要從所有檔案亂讀。
可以用下面順序。

### 檢查一個 active feature

1. 先讀 feature `_index.md`：確認 status、phase rows、Current BR Snapshot、Resume Pointer。
2. 讀最新 phase spec / lightweight spec / BUG spec：確認本次 Delta 和 tasks。
3. 讀相關 BC layer：`rules.md`、`models.md`、`behavior.md`、`events.md`。
4. 檢查 implementation / tests 是否覆蓋 spec 中的 BR、behavior scenarios、edge cases。
5. 如果是 Brownfield，再讀 `migration/tech-debt.md` 的 disposition。

### 檢查一個 completed feature

1. 先讀 completed `_index.md` 的 Integration Summary。
2. 看 phase / lightweight / BUG rows 是否都 completed 或有明確 disposition。
3. 對照 BC layer 是否已 sync net result。
4. 確認未完成事項被放到 future considerations、backlog 或 tech debt，而不是留在 active work。
5. 未來要改 completed feature 行為時，開 follow-up feature，不直接修改 completed history。

### 檢查整個 BC

1. 先讀 `domain/{BC}/context.md`，確認 boundary。
2. 讀 `rules.md`，看 BR active / deprecated / lifecycle。
3. 讀 `behavior.md`，看 scenario 和 confirmed behavior。
4. 讀 `models.md` / `events.md`，確認 tactical model 和 integration signals。
5. 回到 feature directories 追溯某條 BR 是哪個 feature / phase 引入的。

## 常見誤讀

| 誤讀 | 正確讀法 |
|---|---|
| 完整文件範例裡有後續內容，所以 walkthrough 當下也應該有 | 完整文件範例是劇情結束後 evidence；當下看正文 excerpt。 |
| `_index.md` 應該保存所有歷史 | `_index.md` 保存 feature current snapshot；歷史在 phase / lightweight / BUG specs。 |
| `rules.md` 只屬於正在 finish 的 feature | `rules.md` 是 BC cumulative state，可能同時含 completed 與 active feature 的 BR。 |
| 沒有 BR Delta 就不需要記文件 | bug fix、baseline capture、tech debt disposition 仍可能需要文件。 |
| Brownfield 看到 code 行為就等於 business rule | 要先分 confirmed / buggy / unknown，再決定寫到 behavior、rules 或 tech debt。 |
| completed feature 可以繼續追加 T2 | completed directory 是 frozen history；後續變更走 follow-up feature。 |

## 和 walkthrough 系列怎麼搭配

建議讀者先看：

1. [〈Dflow 命令表面導讀〉](dflow-command-surface.zh-TW.md)
2. 本頁
3. Greenfield 或 Brownfield 的 00 / 01
4. 對應 scenario walkthrough 02-06

讀 02-06 時，如果看到 `Current BR Snapshot`、`Delta from prior phases`、`完整文件範例`、
`BC layer sync`、`tech-debt disposition` 這些詞，可以回到本頁確認它們分別屬於哪一層。
