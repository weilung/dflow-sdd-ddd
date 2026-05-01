# /dflow:bug-fix — Alice 修正 Reject reason emoji 截斷問題

## 劇情背景

接續 [04-modify-existing.md](04-modify-existing.md)。2026-05-04 週一，五一連假後第一個上班日，Alice 回到 office 打開 Slack，看到財務部主管 Carol 在週日晚間留下的訊息。Carol 同時也是 phase 2 小範圍試用主管之一。

> 「我昨晚（5/3 週日加班）想 reject 一張差旅單，理由打『金額對不上👍』（中文 5 字 + 1 個 emoji），系統說『reject reason 不合法』。前端字數 counter 明明寫『6 字 ✓』，為什麼被擋？」

Phase 2 supervisor approval 和上一段 T2 lightweight 規格已在連假前 implement，並上線給幾位主管試用一週。Alice 用 browser dev tools 重現：React reject form 的字數限制用 `value.substring(0, maxLen)` 截斷輸入，剛好把 emoji 的 UTF-16 surrogate pair 切成一半。送到 API 後，Domain 層 `ApprovalReason` Value Object 在 `Length` 計算路徑遇到 invalid surrogate，拋出 generic error。

這不是新的審核需求。Carol 的輸入符合 BR-007：「至少 5 個中文字或至少 10 個英數字；空白不計，半形 / 全形視覺等價，emoji 算字」。問題在實作。Alice 決定觸發 `/dflow:bug-fix`。

## 完整對話

> **Alice**：五一連假回來就有 bug。Carol 昨晚加班 reject 一張差旅單，理由打「金額對不上👍」。前端 counter 顯示「6 字 ✓」，但 API 回「reject reason 不合法」。我用 dev tools 看，React form 的 `value.substring(0, maxLen)` 把 emoji surrogate pair 截一半，送到 API 變 invalid string，Domain 的 `ApprovalReason` 在 length 計算時炸掉。`/dflow:bug-fix`

> **Dflow**：收到。這是 `/dflow:bug-fix`，不是 Git Flow 的 hotfix branch；它走 modify-existing flow 的 lightweight ceremony。
>
> 我先跑 Step 1：Assess the Change。這一步同時判斷 Ceremony Tier、Feature Linkage、Affected Layer。
>
> Part A — Tier 判定：
>
> - T1 Heavy？否。沒有新的 Aggregate、Domain Event、資料結構或新的 business rule；BR-007 wording 不變。
> - T2 Light？是。這是 production trial 回報的 logic bug，會改 Presentation 截字邏輯、補 Domain guard 與測試；不是單純 copy / 色彩 / typo。
> - T3 Trivial？否。雖然 BR 不變，但這不是 `_index.md` inline row 能描述的純表面修正；需要獨立 lightweight spec 記錄 root cause、fix approach 和 regression tests。
>
> 結論：**T2 Light**。`/dflow:bug-fix` 的 ceremony adjustment 預設就是 lightweight spec，除非 bug 本身揭露 Domain model 需要重設計才升級。

> **Alice**：對，這次不是改規則。Carol 的文字本來就應該過，是前端把 emoji 切壞。

> **Dflow**：Part B — Feature Linkage。
>
> 我掃 active feature，這個 bug 明確掛在：
>
> ```text
> dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/
> ```
>
> Host feature = `SPEC-20260428-001-employee-submit-expense`，status 還是 `in-progress`，所以可以直接在 active feature directory 裡新增 T2 bug lightweight spec。
>
> 檔名我建議用 BUG-NUMBER 格式：
>
> ```text
> BUG-001-emoji-surrogate-truncation.md
> ```
>
> T2 有兩種合法命名：`lightweight-{date}-{slug}.md` 或 `BUG-{NUMBER}-{slug}.md`。上一段已示範 date-based lightweight；這次是試用期間第一個明確 bug，使用 `BUG-001` 可以讓 bug queue、Slack 訊息和 regression tests 對齊。序號從 001 起算。

> **Alice**：好，就用 `BUG-001-emoji-surrogate-truncation.md`。這樣 tutorial 也剛好示範兩種命名。

> **Dflow**：Part C — Layer。
>
> Primary layer = **Presentation**。真正的 defect 是 React form 用 UTF-16 code unit-based `substring` 截斷使用者輸入，導致 payload 變成 invalid Unicode。
>
> Secondary layer = **Domain**。`ApprovalReason` 是 Value Object，仍應防衛 malformed input：先做 Unicode normalization，再偵測 invalid surrogate，並拋明確的 `InvalidApprovalReasonException`，不要讓 generic length calculation error 外洩。
>
> Step 1 complete（tier T2 decided, host feature `SPEC-20260428-001-employee-submit-expense` identified, layer Presentation primary + Domain secondary）。Entering Step 1.5 check.

> **Dflow**：Step 1.5 — Completed-feature reopen detection：**skip**。
>
> 跳過理由：host feature 在 `dflow/specs/features/active/`，不是 completed feature，不觸發 completed-feature reopen。
>
> Step 1.6 — Create Follow-up Feature：**skip**。
>
> 跳過理由：沒有 completed feature follow-up；BUG-001 直接掛在 active feature 下。
>
> Step 1 complete including 1.5 / 1.6 skip announcement. Entering Step 2: Check Documentation.

> **Dflow**：Step 2 我會先讀現有文件，不直接改程式：
>
> - `_index.md`
> - `lightweight-2026-04-30-approval-reason-bilingual-length.md`
> - `aggregate-design.md`
> - `dflow/specs/domain/Expense/rules.md`
> - `dflow/specs/architecture/tech-debt.md`
>
> Baseline 讀到：
>
> - BR-007 source-of-truth 已是 bilingual length rule：至少 5 個中文字或至少 10 個英數字，空白不計，半形 / 全形視覺等價，emoji 算字。
> - `aggregate-design.md` 已把 `ApprovalReason` 放在 ApprovalDecision / Reject path。
> - 這次沒有新的 Domain concept、event、model、BC 或 glossary term。
> - `tech-debt.md` 還是 init-project 建出的 baseline table，適合承接這次發現的 i18n 字數策略債務。
>
> Baseline captured — existing documentation reviewed. Ready to assess DDD impact（Aggregate design, Domain Events, Value Objects）？`/dflow:next` or reply OK to continue.

> **Alice**：`/dflow:next`

> **Dflow**：Step 3 — Assess DDD Impact。
>
> 依 `/dflow:bug-fix` 的 ceremony adjustment，Step 3 預設是 **no DDD impact, fix in place**，除非 bug 本身在 Domain logic 或揭露 business rule 設計錯誤。
>
> 這裡我的初判：
>
> - Aggregate boundary：OK。`ExpenseReport` / `ApprovalDecision` 邊界不變。
> - Domain Events：不新增、不改 payload。`ExpenseReportRejected` 還是 reject 成功後 raise。
> - Value Object：有小幅 implementation guard。`ApprovalReason` constructor 要 normalize + detect invalid surrogate，但不改 VO 對外語義。
> - Data structure：無 migration、無 column、無 index。
> - BR Snapshot：不 regenerate。因為沒有 ADDED / MODIFIED / REMOVED / RENAMED BR；BR-007 wording unchanged。

> **Alice**：我想確認一下：要不要補一條 BR-008？例如「invalid surrogate / 不可見字元如何計算字數」。

> **Dflow**：值得問，但我建議 **不補 BR-008**。
>
> 我用三個問題拆：
>
> 1. 這是財務主管會用來決策的業務語言嗎？不是。Carol 的需求是「這個原因看起來 6 字且符合規則，為什麼被擋」。
> 2. invalid surrogate 是有效 user intent 嗎？不是。它是 UI / transport 層產生的 malformed string，不是主管刻意輸入的一種業務內容。
> 3. BR-007 現在是否已涵蓋 Carol 的案例？是。中文 5 字 + emoji 算 visual character，本來就應該通過。
>
> 所以結論是：**不新增 BR-008**。把 invalid surrogate 視為 input sanitization / defensive programming，而不是 BR 層級規則。
>
> 但這次暴露出一個技術債：整個系統未來應該定義 user-facing length limit 到底用 grapheme cluster、code point 還是 UTF-16 unit。這不該塞進 BR-007，也不該在這個 T2 擴張成全 i18n 重構。我會記到 `dflow/specs/architecture/tech-debt.md`。

> **Alice**：合理。BR-007 不動，但 Domain 不應該炸 generic error。它至少要 normalize，遇到 invalid surrogate 要丟明確 exception。

> **Dflow**：同意。Step 3 決議：
>
> - Presentation primary：把 `substring(0, maxLen)` 改為 grapheme-aware truncation。優先 `Intl.Segmenter`；至少 fallback 到 `Array.from(str)`，避免切開 surrogate pair。
> - Domain secondary：`ApprovalReason` constructor 先做 NFC normalization，再偵測 invalid / unpaired surrogate。若 input malformed，拋 `InvalidApprovalReasonException`，不要讓 generic length calculation error 外洩。
> - No new BR：BR-007 wording unchanged。
> - Tech Debt：新增「Unicode character counting strategy under i18n」，未來評估 grapheme cluster vs codepoint vs UTF-16 unit，以及是否引入 `Intl.Segmenter` / ICU library。

> **Dflow**：Implementation Tasks 我會放進 `BUG-001-emoji-surrogate-truncation.md`，保持 T2 short-fix 範圍：
>
> - PRESENTATION-1：replace reject reason `substring` truncation with grapheme-aware truncation
> - PRESENTATION-2：counter 與 truncation 共用同一套 counting strategy
> - DOMAIN-1：`ApprovalReason` input normalize to NFC
> - DOMAIN-2：invalid surrogate detection + `InvalidApprovalReasonException`
> - TEST-1：React truncation 不切壞 `金額對不上👍`，counter 仍顯示 `6 字 ✓`
> - TEST-2：`ApprovalReason("金額對不上👍")` pass
> - TEST-3：手動構造半個 surrogate input，應 raise `InvalidApprovalReasonException`
> - TEST-4：API / integration test 確認 reject flow 正常
> - DOC-1：更新 `_index.md` Lightweight Changes 和 `tech-debt.md`；不 regenerate BR Snapshot
>
> 這個 checklist 還是 T2。如果開始討論全站 i18n 字串處理、共用 ICU library 或所有欄位的長度策略，就要停下來另開 proposal / phase。
>
> DDD impact analysis done — Aggregate boundary OK, no new events, no new BR; `ApprovalReason` only gets defensive implementation guard. Ready to implement? `/dflow:next` to proceed, or adjust the design first.

> **Alice**：先把 bug spec 和 docs 落地。我等同事早會確認後，再改 React form、VO 和測試。這個 tutorial repo 不寫實際 ExpenseTracker code。

> **Dflow**：OK。Step 4 code implementation 不在本段 tutorial 輸出範圍內；我會保留 Implementation Tasks unchecked，代表 bug-fix implementation 是下一個動作。
>
> Implementation plan captured. Entering Step 5: Update Documentation.

> **Dflow**：Step 5 — Update Documentation。
>
> 我會做三件事：
>
> 1. 新增 T2 bug lightweight spec：
>
>    ```text
>    dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md
>    ```
>
> 2. 更新 `_index.md`：
>
>    - Lightweight Changes 表新增 2026-05-04 / T2 row。
>    - Description 寫「Bug-fix: 前端 substring 截斷 emoji surrogate pair 導致 reject reason 被拒」並外連 BUG-001。
>    - Current BR Snapshot **不 regenerate**，明示理由：BR-007 wording unchanged，root cause 是 implementation-level。
>    - Resume Pointer 改成「下一步實作 BUG-001」。
>
> 3. 更新 `dflow/specs/architecture/tech-debt.md`：
>
>    - 新增 `Unicode character counting strategy under i18n`
>    - reported = 2026-05-04
>    - source = BUG-001
>    - scope = ApprovalReason VO + future user-facing length limits
>    - proposed approach = 評估 grapheme cluster vs codepoint vs UTF-16 unit；評估 `Intl.Segmenter` or ICU library
>    - priority = medium
>    - blocked-by = none
>
> 故意不改：
>
> - `aggregate-design.md`：ApprovalReason VO 結構不變，只是 constructor 內部 defensive guard。
> - `dflow/specs/domain/Expense/rules.md`：BR-007 wording 不變。
> - `dflow/specs/domain/Expense/{models,events,context}.md`：無新 model / event / BC 變動。
> - `dflow/specs/domain/{glossary,context-map}.md`：無新 term / context relationship。

> **Alice**：BR Snapshot 不 regenerate 這點幫我寫清楚，reviewer 很可能會問。

> **Dflow**：會。我會在 `_index.md` Current BR Snapshot 下加一行 note：`BUG-001` 沒有 BR wording 變更，因此 snapshot 保持 2026-04-30 的 BR-007 當前狀態；這不是漏更。
>
> 完成本段 documentation package：BUG-001 lightweight spec ready, `_index.md` Lightweight Changes row added, BR Snapshot intentionally unchanged, and tech-debt entry recorded.
>
> 下一步是實作 bug fix：先改 Presentation truncation，再補 Domain guard 與 regression tests。等這些 tasks 完成後，可以回到 `/dflow:finish-feature` 收尾整個 `SPEC-20260428-001`。

## 本段產出的檔案

**新增**
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/BUG-001-emoji-surrogate-truncation.md)

**修改**
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md)
- [`dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md)

**故意不改**
- 不改 `aggregate-design.md` — ApprovalReason VO 結構不變，只補 constructor 內部 normalization / invalid surrogate detection。
- 不改 `dflow/specs/domain/Expense/rules.md` — BR-007 wording 不變，沒有 BR-008。
- 不改 `dflow/specs/domain/Expense/{models,events,context}.md` — 無新 model、Domain Event 或 BC 變動。
- 不改 `dflow/specs/domain/{glossary,context-map}.md` — 無新 ubiquitous language term 或 context relationship。
- 不改既有 phase spec / lightweight spec — BUG-001 以新的 T2 bug spec 承接。

## 觀察重點

- **`/dflow:bug-fix` 與 `/dflow:modify-existing` 的差異**：兩者走同一個 modify-existing flow，但 bug-fix 有 ceremony adjustment：預設 lightweight，Step 3 預設 no DDD impact / fix in place，除非 bug 揭露 Domain logic 或模型本身錯誤。
- **BUG-NUMBER 命名格式**：T2 可以用 `lightweight-{date}-{slug}.md` 或 `BUG-{NUMBER}-{slug}.md`。段 4 用 date-based 命名；本段因為是第一個試用 bug，使用 `BUG-001-emoji-surrogate-truncation.md`，方便對齊 bug queue 與 regression tests。
- **要不要補 BR 的判斷邏輯**：Carol 的輸入已被 BR-007 涵蓋，invalid surrogate 是 malformed input / sanitization，不是 business language；因此不補 BR-008，而是把跨系統 character counting 策略記為 tech debt。
- **BR Snapshot 不 regenerate 的時機**：沒有 ADDED / MODIFIED / REMOVED / RENAMED BR 時，`_index.md` Current BR Snapshot 保持原狀；本段只在 snapshot 區塊加 note 說明 BR-007 wording unchanged。
- **tech-debt.md 條目格式**：沿用 init-project 建出的 table，新增一列實際債務，並在 Follow-up Notes 補 reported date、source、scope、priority、blocked-by；不是只在 lightweight spec 口頭提到。

## 下一個劇情段

→ [06-finish-feature.md](06-finish-feature.md)（Alice 把 `SPEC-20260428-001` 收尾，整理 Integration Summary，將 feature directory 從 `active/` 移到 `completed/`，並更新 features index。）
