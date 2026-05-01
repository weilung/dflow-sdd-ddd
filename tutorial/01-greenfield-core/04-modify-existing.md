# /dflow:modify-existing — Alice 調整 Reject reason 長度規則

## 劇情背景

接續 [03-new-phase.md](03-new-phase.md)，Alice 在 2026-04-29 晚上把 phase 2 的主管審核程式碼寫完，開發測試環境也放給幾位主管試用。隔天（2026-04-30）午餐時間，一位主管拿著筆電走到 Alice 座位旁：

> 「我 reject 了一張差旅單，理由想打『金額對不上』，但系統說『至少 10 字元』。中文 5 個字就很完整，這個規則對中文太硬。」

這不是新的審核流程，也不是新的 Aggregate。Alice 判斷這是既有 BR-007 的 wording delta：Reject reason 的最低內容門檻要從單一 10 字元改成 **至少 5 個中文字 OR 至少 10 個英數字**。混合輸入時兩條件擇一滿足即通過。

她決定用 `/dflow:modify-existing`，不開 `/dflow:new-phase`。

## 完整對話

> **Alice**：午餐剛被主管抓住。他 reject 一張差旅單，理由想打「金額對不上」，可是系統說 reject reason 至少 10 字元。中文 5 個字其實很完整，我想把規則改成「至少 5 個中文字，或至少 10 個英數字」。這應該不是新 phase。`/dflow:modify-existing`

> **Dflow**：收到。這是 modify-existing flow，我先跑 Step 1：Assess the Change。這一步同時判斷 Ceremony Tier、Feature Linkage、Affected Layer。
>
> Part A — Tier 判定：
>
> - T1 Heavy？否。這次沒有新的 Aggregate、沒有新的 Domain Event、沒有新的資料結構，也不是 Aggregate overhaul；只是既有 `ApprovalReason` Value Object 的驗證規則調整。
> - T2 Light？是。它有 BR Delta：BR-007 從「至少 10 字元」改成 bilingual length rule，而且會改變 Domain layer validation 的通過 / 拒絕結果。
> - T3 Trivial？否。這不是 copy、typo、button color 或純註解；會改變 reject 是否成立，所以不能只寫 `_index.md` inline row。
>
> 結論：**T2 Light**。會產生一份獨立 lightweight spec，放在既有 feature directory 裡，並在 `_index.md` Lightweight Changes 表加 outbound-link row。

> **Alice**：對，我不想為這件事開 phase 3。沒有新 BR，只是 BR-007 內容修正。

> **Dflow**：Part B — Feature Linkage。
>
> 我掃 active feature，這個 change 明確屬於：
>
> ```text
> dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/
> ```
>
> Host feature = `SPEC-20260428-001-employee-submit-expense`，目前 status 是 `in-progress`，所以它可以直接接 T2 lightweight change。
>
> Part C — Layer。
>
> Affected layer = **Domain layer**。原因是 `ApprovalReason` 是 Value Object，拒絕原因是否足夠是 Domain invariant，不應只放 Application validator 或前端。
>
> Step 1 complete（tier T2 decided, host feature `SPEC-20260428-001-employee-submit-expense` identified, layer Domain）。Entering Step 1.5 check.

> **Dflow**：Step 1.5 — Completed-feature reopen detection：**skip**。
>
> 跳過理由：Step 1 找到的是 active feature，不是 completed feature。`SPEC-20260428-001-employee-submit-expense` 還在 `dflow/specs/features/active/`，所以不觸發 completed feature reopen，也不需要建立 follow-up feature。
>
> Step 1.6 — Create Follow-up Feature：**skip**。
>
> 跳過理由：沒有 Step 1.5 的 Option A，也沒有 completed feature follow-up。這個 T2 直接掛在 active feature 下。
>
> Step 1 complete including 1.5 / 1.6 skip announcement. Entering Step 2: Check Documentation.

> **Dflow**：Step 2 我會讀現有文件，先確認 baseline 已經有被記錄，不直接改程式。
>
> 需要對照：
>
> - `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md`
> - `phase-spec-2026-04-29-supervisor-approval.md`
> - `dflow/specs/domain/Expense/rules.md`
> - `aggregate-design.md`
> - `dflow/specs/domain/glossary.md`
>
> 我讀到 BR-007 目前是：
>
> ```text
> Reject 必須附註原因；ApprovalReason 至少 10 字元，否則 raise DomainException。
> ```
>
> 這個 baseline 足夠，所以不用補建 domain docs。接下來用 lightweight spec 的 Delta format 記錄這次變更。

> **Alice**：檔名我想清楚一點：`lightweight-2026-04-30-approval-reason-bilingual-length.md`。

> **Dflow**：OK。slug = `approval-reason-bilingual-length`。
>
> 我會用 T2 lightweight template，不用 phase-spec template。這份 spec 會包含：
>
> - Problem：主管輸入「金額對不上」被 10 字元規則擋下。
> - Behavior Delta：五段都保留，`ADDED` / `REMOVED` / `RENAMED` 寫 none，`MODIFIED` 寫 BR-007，`UNCHANGED` 列 BR-001..006。
> - Root Cause：phase 2 用單一 `Length >= 10`，偏向英文輸入。
> - Fix Approach：只改 Domain layer `ApprovalReason` VO 驗證。
> - Implementation Tasks：T2 仍要有 concise checklist。
>
> Delta 的 `MODIFIED BR-007` 會保留 before / after：
>
> ```markdown
> **Before**: Reject reason 少於 10 字元就被拒絕。
> **After**: 至少 5 個中文字 / emoji visual characters OR 至少 10 個英數字；混合輸入時兩條件擇一滿足即通過。
> **Reason**: 中文短語能用較少字數表達完整退回理由，原規則對中文太硬。
> ```

> **Alice**：有幾個邊界先問清楚。全空白不應該通過。半形、全形英文數字應該算同一種，主管可能會打全形。emoji 呢？

> **Dflow**：我建議這些要明確寫進 lightweight spec，否則 implementation 會自己猜。
>
> 邊界我先列三個：
>
> - 全空白 / trim 後空字串：不通過，空白不計入任何門檻。
> - 半形 / 全形英數字：視覺等價，`ＡＢＣ１２３` normalized 後按英數字計。
> - emoji：要不要算字？如果算，會進 5-character local-text threshold；如果不算，就只能當裝飾字元忽略。
>
> 你要怎麼拍板？

> **Alice**：emoji 算字。空白不算字。半全形視覺等價。不要把這件事擴張成 i18n 或 multi-locale policy，現在只處理 reject reason 最低長度。

> **Dflow**：收到。我會寫成 resolved Open Questions：
>
> - emoji count as visual characters for the 5-character local-text threshold
> - whitespace does not count toward either threshold
> - halfwidth and fullwidth alphanumeric characters are visually equivalent
> - broader reject-reason i18n / multi-locale policy is outside this T2 change
>
> Baseline captured — existing documentation reviewed, current behavior is documented and the proposed change is marked. Ready to assess the DDD impact（Aggregate design, Domain Events, Value Objects）？`/dflow:next` or reply OK to continue.

> **Alice**：`/dflow:next`

> **Dflow**：Step 3 — Assess DDD Impact。
>
> Aggregate boundary：OK。`ExpenseReport` 和 `ApprovalDecision` 邊界不變；Reject reason 還是 `ApprovalReason` VO 的 responsibility。
>
> Domain Events：不新增、不改 payload。`ExpenseReportRejected` 仍然在 reject 成功後 raise，payload 的 Reason 只是通過新的 VO validation。
>
> Value Object：有影響。`ApprovalReason` validation 從單一字數門檻改成 bilingual length rule。
>
> Data structure：無。沒有 migration，沒有 column 變更，沒有新 table / index。
>
> Cross-context：無。這不是 Identity / Approval policy / locale service 的議題。

> **Dflow**：Implementation Tasks 我會放在 lightweight spec 裡，而且保持短清單：
>
> - DOMAIN-1：更新 `ApprovalReason` validation
> - TEST-1：中文 case（`金額對不上` pass，少於 5 counted characters fail）
> - TEST-2：英文 / 英數字 case（10 normalized alphanumeric pass，少於 10 fail）
> - TEST-3：混合輸入，任一門檻滿足即 pass
> - TEST-4：emoji、空白、半全形 case
> - INFRA-1：確認無 DB schema / migration
> - DOC-1：更新 `_index.md`、`rules.md`、`aggregate-design.md`、glossary
>
> 這個 checklist 不多，仍然符合 T2 Light。如果後面開始出現 locale policy、語系設定、跨 BC 字元集服務，那就要停下來問你是否升級 T1；目前不用。
>
> DDD impact analysis done — Aggregate boundary OK, no new events, existing Value Object validation changes only. Ready to implement? `/dflow:next` to proceed, or adjust the design first.

> **Alice**：今天先不進 Step 4 code implementation。我要先把 spec 和文件給同事看，明天我會接著改 `ApprovalReason` 和 unit tests。

> **Dflow**：OK。Step 4 Implement 不在這段 tutorial 範圍內；我不會產生程式碼。
>
> 我會把本段需要的 documentation artifacts 落地，且保留 implementation tasks unchecked、lightweight spec status = `in-progress`。這代表「規格已就緒，實作尚未完成」。
>
> Entering Step 5 documentation closeout for this tutorial segment.

> **Dflow**：Step 5 — Update Documentation。
>
> 我會做四件事：
>
> 1. 新增 T2 lightweight spec：
>
>    ```text
>    dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md
>    ```
>
> 2. 更新 `_index.md`：
>
>    - Lightweight Changes 表新增一列 T2 outbound link。
>    - Current BR Snapshot **regenerate**，不是 append history。
>    - BR-007 Current Rule 改成 bilingual length wording。
>    - BR-007 Last Updated 改成 `lightweight-2026-04-30`。
>    - Resume Pointer 指向這份 lightweight spec 的實作。
>
> 3. 更新 living docs 的 source-of-truth wording：
>
>    - `dflow/specs/domain/Expense/rules.md`：BR-007 加 `<!-- 2026-04-30 lightweight MODIFIED -->`，Last updated = 2026-04-30。
>    - `aggregate-design.md`：只更新 `ApprovalReason` validation 描述，不改 Aggregate structure。
>    - `dflow/specs/domain/glossary.md`：同步 `ApprovalReason` 條目的最低長度說明。
>
> 4. Step 5.4 T2 Archival：
>
>    - 不建新 phase-spec。
>    - 不 move lightweight spec。
>    - lightweight spec 留在 active feature directory。
>    - `_index.md` 的 Lightweight Changes outbound-link row 是索引。
>    - 等整個 feature 要收尾時才跑 `/dflow:finish-feature`，那時才移動整個 feature directory。

> **Alice**：models.md 和 context.md 要不要也改？我記得裡面有 ApprovalReason 的摘要。

> **Dflow**：這段我建議不動 `models.md` / `context.md` / `events.md`。理由是這次沒有新的 model、BC、event 或資料結構；source-of-truth 的 BR wording 放在 `rules.md`，VO 設計細節放在 `aggregate-design.md`，團隊詞彙放在 `glossary.md`。
>
> 如果同事 review 後覺得所有摘要文件都要完全同步，也可以在同一個 T2 commit 補文案，但那不是這段 tutorial 的必要改動。

> **Alice**：好，保持小。這段的重點就是 T2 delta，不要讓同事以為小規則修正也要跑完整 phase。

> **Dflow**：完成本段 documentation package。T2 lightweight spec ready, `_index.md` Lightweight Changes row added, BR Snapshot regenerated, BR-007 source-of-truth wording updated in `rules.md`, and `ApprovalReason` VO design wording updated.
>
> 下一步是明天進 Step 4：改 `ApprovalReason` validation 和 unit tests。實作完成後再回到 modify-existing Step 4 → Step 5 completion checklist，確認 tasks 是否全勾、是否需要把 spec status 改成 completed。

## 本段產出的檔案

**新增**
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/lightweight-2026-04-30-approval-reason-bilingual-length.md)

**修改**
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md)
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md)
- [`dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md)
- [`dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md)

**故意不建 / 不改**
- 不建新 `phase-spec-*` — 這是 T2 Light，不是 `/dflow:new-phase`。
- 不動 `events.md` — 沒有新 Domain Event，也沒有 event payload 變更。
- 不動 `models.md` / `context.md` — 沒有新 model、BC 或資料結構。
- 不動 `phase-spec-2026-04-29-supervisor-approval.md` — phase 2 history 保留原始決策，這次變更由 lightweight spec 的 Delta 承接。

## 觀察重點

- **T2 vs T1 vs T3 判定邏輯**：Step 1 Part A 明確檢查三件事：沒有 Aggregate overhaul / 新資料結構，因此不是 T1；有 BR-007 Delta，因此是 T2；不是純 typo / copy / formatting，因此不是 T3。
- **lightweight-spec 與 phase-spec 的差異**：這段產出簡短 lightweight spec，不含新的 Aggregate / Domain Event 段，也不重跑完整 phase planning；但 T2 仍必須包含 `Implementation Tasks`，不能因為「只是小修」就跳過。
- **`_index.md` Lightweight Changes 表**：T2 必須有 outbound-link row 指向 `lightweight-2026-04-30-approval-reason-bilingual-length.md`；Current BR Snapshot 也要 regenerate，BR-007 Last Updated 改成 `lightweight-2026-04-30`。
- **BR-007 MODIFIED 標記位置**：`rules.md` 是 BC-level source-of-truth，BR-007 row 加 `<!-- 2026-04-30 lightweight MODIFIED -->`；lightweight spec 的 Behavior Delta 也用 `MODIFIED BR-007` 寫 before / after / reason。
- **邊界 case 怎麼落 spec**：emoji / 空白 / 半全形不是口頭約定，而是寫進 lightweight spec 的 Fix Approach、Implementation Tasks 和 Open Questions resolved items，讓 VO validation 與 unit tests 有可檢查依據。

## 下一個劇情段

→ [05-bug-fix.md](05-bug-fix.md)
