---
spec-id: SPEC-{YYYYMMDD}-{NNN}
slug: {slug-following-discussion-language}
status: in-progress    # in-progress | completed
created: {YYYY-MM-DD}
branch: feature/{SPEC-ID}-{slug}
# follow-up-of: {原 SPEC-ID}    # 選用：本 feature 為某個已 completed feature 的 follow-up 時填入
---

<!--
Template note (for AI):
  This is the **feature-level dashboard** (`_index.md`) for a feature
  directory. Place at `dflow/specs/features/active/{SPEC-ID}-{slug}/_index.md`.

  Seven required sections (see below):
    1. Metadata (YAML front matter above)
    2. Goals & Scope (prose)
    3. Phase Specs (T1 list)
    4. Current BR Snapshot (feature-level cumulative state)
    5. Lightweight Changes (T2 outbound link + T3 inline)
    6. Checkpoint Log (commit / skip timeline)
    7. Resume Pointer

  Optional section (append at end if applicable):
    - Follow-up Tracking (when this feature has follow-up features derived)

  Refresh discipline for "Current BR Snapshot":
    - Regenerate when /dflow:new-phase enters
    - Regenerate when a phase-spec is finalized (completed)
    - Regenerate when a T2 lightweight-spec is finalized
    - This table is the feature-level CURRENT STATE (not history).
      History lives in each phase-spec's "Delta from prior phases" section.

  Sync to BC layer:
    - At /dflow:finish-feature, BR Snapshot is reconciled with the bounded
      context's `dflow/specs/domain/{context}/rules.md` and `behavior.md`
      (continues the existing Step 8.3 / Step 5.3 sync mechanism — no new
      flow is introduced).
    - rules.md is the SYSTEM-LEVEL truth across features; _index.md is the
      FEATURE-LEVEL aggregation. Both can co-exist; on conflict, finish-feature
      reconciles them and rules.md wins as the system truth.

  Minimal usage:
    For a 1-commit / 1-phase feature this template can be ~30 lines —
    fill metadata + a short Goals & Scope + one row in Phase Specs +
    initial BR Snapshot + Resume Pointer. The other sections can stay empty.

  Minimal HOST usage (zero-phase) — a different shape, not a smaller one:
    A minimal host (references/modify-existing-flow.md Step 1.7 standalone, or
    its Step 1.6 follow-up minimal variant, or Step 1.8's post-hoc hotfix, whose
    linkage resolves to one of those two) carries NO phase-spec, and its
    Phase Specs table stays EMPTY. Its record lives in Lightweight Changes
    instead — at least one row, written before the first commit. Do NOT add a
    Phase Specs row or create a phase-spec to make the "1-phase" wording above
    fit: a host that carries a phase is certified as phase-bearing whatever it
    was intended to be, and closeout then checks it as one
    (references/finish-feature-flow.md Step 1).
-->

<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# {Feature Title}

## Goals & Scope

> 1-3 段：本 feature 解決什麼問題？為誰解決？邊界在哪？涉及哪些 Bounded
> Context / Aggregate？
>
> 若是 follow-up feature，AI 會在頂部自動加註：
> 「本 feature 為 `{原 SPEC-ID}-{原 slug}` 的 follow-up，原 feature 完成於
>  `{date}`，詳見 `completed/{原 SPEC-ID}-{原 slug}/_index.md`」

## Phase Specs

> T1 Heavy ceremony 產出的 phase-spec 列表（一份 phase-spec ≈ 一次完整
> Kickoff → Domain → Design → Build → Verify 循環）。

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | {YYYY-MM-DD} | {phase-slug} | in-progress / completed | [phase-spec-{date}-{phase-slug}.md](./phase-spec-{date}-{phase-slug}.md) |

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

> Feature 層的 BR 當前狀態（不是歷史）。AI 在以下時機 regenerate 本表：
> - `/dflow:new-phase` 進入時
> - 完成一份 phase-spec 時
> - T2 lightweight spec 定稿時
>
> 歷史由各 phase-spec 的「Delta from prior phases」段串接閱讀；feature
> 完成時 `/dflow:finish-feature` 把本表推進到對應 BC 的 `rules.md` /
> `behavior.md`（延續 Step 5.3 既有 sync 機制）。

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-01 | {規則描述} | phase-1 / inherited from rules.md | phase-N | active / removed |

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

> T2 行：描述含「見 `lightweight-{date}-{slug}.md`」外連
> T3 行：inline 完整描述一句話 + 標籤（如 `[cosmetic]` / `[text]` /
>        `[appearance]`）；T3 不產獨立 spec 檔
>
> **minimal（zero-phase）host 的每一列都要能指出這次變更碰到的原始碼路徑**
> （寫到能和一個 commit 比對的粒度即可，不是貼 diff）。T2 由它的
> lightweight-spec `## Implementation Paths` 段承載，row 只要外連過去；**T3 沒有
> spec 檔，路徑就直接寫在 Description 裡**，接在一句話描述與標籤後面。
> `/dflow:finish-feature` 會拿 checkpoint 1 的 diff 和這些路徑比對；
> **一個路徑都沒宣告會擋下 closeout**，不會當成通過。
> **掛在 phase-bearing feature 底下的列不受此限**——closeout 對它們不跑這項檢查
> （`references/finish-feature-flow.md` Step 1 明寫此例外，理由是 hosted row 本來
> 就沒有被要求宣告路徑）。寫上去仍是好習慣，但那裡沒有 gate、也不會擋。
>
> **post-hoc hotfix 的 T3 列**（見 references/modify-existing-flow.md Step 1.8）：
> Description 另外標明這是 hotfix，並寫出識別依據（PR／incident／tracker 編號）
> ——沒有依據的 hash 會擋下 closeout。此時路徑指的是**已合併的那個 hotfix**
> 碰到的檔案；本列 `Commit` 欄填的是**補文件那個 commit** 的 hash，不是 hotfix
> 的 hash（後者記在 Checkpoint Log 的 `reconciled (...)` 列）。兩者來源不同，
> 不可互填。
>
> Tier 判準見 AI-AGENT-GUIDE.md § Ceremony Scaling 的 ordered cascade（步驟 0–4，先命中者勝）。

| Date | Tier | Description | Commit |
|---|---|---|---|
| {YYYY-MM-DD} | T2 | bug fix XYZ — 見 [`lightweight-{date}-{slug}.md`](./lightweight-{date}-{slug}.md) | {hash} |
| {YYYY-MM-DD} | T3 | 按鈕顏色從藍改綠 `[cosmetic]` — `src/Web/Checkout/PayButton.cs` | {hash} |

> ⚠ **`Commit` 還沒填就留空 —— 不要寫佔位字串。** 上面的 `{hash}` 是**範本佔位符**
> （代表「這裡放一個 commit hash」），不是可以留在真實 `_index.md` 裡的值。
> 自己發明 `{pending}`、`（待 commit）` 這類字樣會讓那一格變成**非空**，而
> **凡是照「空／非空」判的規則都會把它讀成已經填好**。在 phase-bearing host 上更徹底：
> `_index.md` 對 checkpoint 1 的那些證據檢查全都標明「minimal host（zero-phase）限定」，
> 所以**關帳（closeout）那條線上**沒有任何檢查會去看那一格 —— 要到下面說的回填與
> PR review 才有人真的去讀它。
> ⚠ **抓得到它的判準是「那條檢查會不會去解析這個值」**，不是照空／非空判的那些。
> 目前這樣的檢查有：`references/finish-feature-flow.md` **Step 1**（minimal host 的
> 關帳檢查：把佔位字串判為「**從未填入**」，與「空」和「填錯 hash」分成三種不同訊息，
> 一律**擋**）、同檔 **Step 4 指令 1**（hosted 列回填：unfilled 指「空**或**放著佔位
> 字串」，兩者以同一種方式回填）、以及 `references/pr-review-checklist.md` 的**兩項**
> ——存在性那項要 `git cat-file -t` 逐個 resolve，hosted identity 那項再用
> `git show --stat` 確認那個 hash 真的是該列自己的實作 commit（該檔明寫這兩項
> 「不可互換」）。⚠ 另有數處**複述**同一條規則但把執行交給上面那些檢查（例如
> `references/modify-existing-flow.md` 的「Commit evidence goes to two surfaces」），
> 那些是指標、不是額外的關卡。**日後新增的檢查照同一個判準算，這裡列幾項不是重點。**
> 別把它們的存在讀成「所以放佔位字串沒差」：在它們之前，每一條機械規則都已經把
> 那一格當成填好了。
> **留空是有名字的狀態；佔位字串不是。**

> **post-hoc hotfix 的列自成一個 host，不會和上面的一般列並存**
> （見 references/modify-existing-flow.md Step 1.8）：上面兩列的 checkpoint 1
> **必須**碰到它們宣告的實作路徑，而 post-hoc host 的 checkpoint 1 是**補文件那個
> commit**、按約定**不得**碰任何已宣告的實作路徑，同一個 commit 不可能兩者兼具
> （`references/finish-feature-flow.md` Step 1）；Checkpoint Log 的實作列 Result
> 也只能二擇一（`committed (...)` 或 `reconciled (...)`）。post-hoc host 本身仍
> **可以是 compound**——多個 post-hoc 列共用同一個補文件 commit——不能混的是一般列：
>
> | Date | Tier | Description | Commit |
> |---|---|---|---|
> | {YYYY-MM-DD} | T3 | 首頁公告錯字修正 `[text]` — `src/Web/Home/Notice.cs`；post-hoc hotfix，識別依據 INC-2031 | {hash} |

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> 生命週期 checkpoint 的 commit / skip 時間線（讓三週後回溯不必手動重建）。
> 每個 checkpoint 無論 commit 或 skip 都記一列。Tier 決定 checkpoint 數：
> T1 三點（spec 完 / impl 完 / closeout）、T2 兩點（spec+impl 合併 / closeout）、
> T3 單一實作 commit（其 inline row 與本列的 hash 由 host 的下一個 commit 一併帶進；
> host 若沒有後續 commit，允許一個只動 ledger 的 tracking commit 收尾，該 commit 不另成列）。
> ⚠ **上面那些「點」在本表 `Checkpoint` 欄各有固定的字面值**：spec 里程碑寫
> **`spec-baseline`**、實作寫 **`implementation`**、關帳寫 **`closeout`**（下表的
> `spec-baseline` / `implementation` / `closeout` 三列就是這幾個值；表中另有一列
> `branch-override`——本例排在最前——是紀錄列、不是生命週期 checkpoint，見下方說明）。散文裡的
> 「spec 完」是在說那個里程碑，**不是欄位值** —— 不要照著它造一個 `spec` 出來。
> ⚠ 這條只管**本表的 `Checkpoint` 欄**。`references/git-integration.md` 的選配 trailer
> `Dflow-Checkpoint: {SPEC-ID} {spec|impl|closeout}` 有它自己的三個角色名（其中就有
> `spec`）——那是另一個地方的詞彙，**不要拿本條去「修正」一個寫對的 trailer**。
>
> **Minimal host（zero-phase）例外**——見 references/modify-existing-flow.md
> Step 1.7（standalone）、Step 1.6 的 follow-up minimal 變體，或 Step 1.8 的
> post-hoc hotfix（其 linkage 落在前兩者之一）：這種 host 之後
> 沒有別的 commit 可以收攏 T3 的 row，所以**不分 tier 一律記兩個 checkpoint**
> （implementation，然後 closeout），而且 T3 的 inline row 要**寫進 checkpoint 1
> 本身**、不是等下一個 commit 帶進來。上一段「T3 單一實作 commit ／ 由下一個
> commit 帶進」講的是**掛在既有 feature 底下的** T3，不適用於 minimal host。
>
> Result 的合法值是 `committed ({hash})` / `skipped` / `failed`，外加
> **`reconciled ({merged-hotfix-hash})`**——只給 post-hoc hotfix（Step 1.8）的
> implementation 列用，意思是「本 checkpoint 記錄的是一個已經合併的變更」。
> 括號裡是**那個 hotfix 的 hash**，不是本 host 補文件那個 commit 的 hash
> （後者填在 Lightweight Changes 該列的 `Commit` 欄）。完整詞彙見
> references/git-integration.md § Commit Checkpoints, Branch Gate & AI Commits。
>
> **`branch-override` 是紀錄列，不是生命週期 checkpoint。** 在 branch gate 選了
> 「override and stay」時記一列（references/git-integration.md § Branch gate
> 定義形狀）：Checkpoint 寫 `branch-override`、Result 寫
> `override ({你留下來的分支})`。它**不是 commit**、**不計入 tier 的 checkpoint
> 數**。closeout 的分支檢查會看**有沒有任何一列**指名你現在所在的分支（不是只看最近
> 一列——一個 host 可能在不同 phase override 到不同分支，而 closeout 自己不觸發 branch
> gate、不會補寫新列）。括號裡必須是**分支名**，沒寫分支的紀錄豁免不了任何東西。
> `branch:` 欄位本身永遠不因 override 而改寫。
> ⚠ **只會出現在 phase-bearing host。** references/modify-existing-flow.md 對
> **minimal host**（Step 1.6 follow-up 變體／Step 1.7 standalone／Step 1.8
> post-hoc）**不提供**這個選項——那些 host 正是拿 `branch:` 當權威來斷言分支相等的。
>
> commit hash 只在 commit 實際成功後填入；pre-commit hook reject 或 commit
> 失敗記 `failed`、不寫假 hash。**例外：closeout 列不填 hash**——closeout
> commit 無法自含自身 hash，該列於 commit 前寫入、隨歸檔目錄一起進 commit；
> 溯源用 `git log -1 -- completed/{SPEC-ID}-{slug}` 或選配的
> `Dflow-Checkpoint` trailer（見 references/git-integration.md）。

| Timestamp | Checkpoint | Result |
|---|---|---|
| {YYYY-MM-DD HH:MM} | branch-override | override ({branch-you-stayed-on}) |
| {YYYY-MM-DD HH:MM} | spec-baseline | committed ({hash}) / skipped / failed |
| {YYYY-MM-DD HH:MM} | implementation | committed ({hash}) / skipped / failed / reconciled ({merged-hotfix-hash}) |
| {YYYY-MM-DD HH:MM} | closeout | committed / skipped / failed |

## Resume Pointer

> 目前進展到哪？下一個動作是什麼？開新對話接續工作時，從這裡讀起。
>
> 下方四個 cursor 欄位是 workflow 進度的**存放層（宣告，claim）**：
> 進入 flow 時設 Active Workflow；**每過一個 step gate** 更新 Current Step /
> Gates Passed / Awaiting（與該 gate 既有的 `_index.md` 更新合併，不另加儀式）；
> `/dflow:cancel` 時 Active Workflow 設回 `none`；closeout 也設回 `none`，但**是在
> 歸檔那一步**——`finish-feature-flow.md` Step 4 的 `git mv` 之後緊接著寫，**不是**
> closeout 一開始就寫。在那之前 closeout 本身仍是進行中的 workflow，後面還有 step
> gate 要過。
> `/dflow:status` 讀 cursor 後會與推導證據（Checkpoint Log、phase-spec
> status、git log）交叉，不一致會明確報 mismatch——cursor 是宣告、證據優先。
> Phase 粒度進度由上方 Phase Specs 表承載；cursor 只補 workflow step / gate
> 粒度，不展開成 per-step 全表（步驟線性，游標可推導每一步的完成/未做）。

**Current Progress**: {one-line summary}

**Next Action**: {suggested next action}

**Active Workflow**: {new-feature | modify-existing | bug-fix | new-phase | finish-feature | none}

**Current Step**: {Step N — short step name | n/a}

**Gates Passed**: {e.g. "3→3.5, 4→5" | n/a}

**Awaiting**: {step-gate description | none}

<!--
## Follow-up Tracking
>（選用段；只有當本 feature 衍生出 follow-up feature 時才填）
> 由 `/dflow:new-feature` / `/dflow:modify-existing` 在新建 follow-up
> feature 時自動更新；新 feature 完成時 `/dflow:finish-feature` 反向更新
> 該列 Status 欄為 `completed`。
> 連結權威是新 feature 的 `follow-up-of` 欄；本表為衍生索引。

| SPEC-ID | slug | Created | Status |
|---|---|---|---|
| SPEC-{YYYYMMDD}-{NNN} | {slug} | {YYYY-MM-DD} | in-progress / completed |
-->
