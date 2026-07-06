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
      The system-level current state lives in the bounded context's
      rules.md / behavior.md, synced at /dflow:finish-feature.

  Minimal usage:
    For a 1-commit / 1-phase feature this template can be ~30 lines —
    fill metadata + a short Goals & Scope + one row in Phase Specs +
    initial BR Snapshot + Resume Pointer. The other sections can stay empty.
-->

# {Feature Title}

## Goals & Scope

> 1-3 段：本 feature 解決什麼問題？為誰解決？邊界在哪？
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
> `behavior.md`（延續 Step 8.3 既有 sync 機制）。

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-01 | {規則描述} | phase-1 / inherited from rules.md | phase-N | active / removed |

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

> T2 行：描述含「見 `lightweight-{date}-{slug}.md`」外連
> T3 行：inline 完整描述一句話 + 標籤（如 `[cosmetic]` / `[text]` /
>        `[format]`）；T3 不產獨立 spec 檔
>
> Tier 判準見 AI-AGENT-GUIDE.md § Ceremony Scaling 三層表。

| Date | Tier | Description | Commit |
|---|---|---|---|
| {YYYY-MM-DD} | T2 | bug fix XYZ — 見 [`lightweight-{date}-{slug}.md`](./lightweight-{date}-{slug}.md) | {hash} |
| {YYYY-MM-DD} | T3 | 按鈕顏色從藍改綠 `[cosmetic]` | {hash} |

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> 生命週期 checkpoint 的 commit / skip 時間線（讓三週後回溯不必手動重建）。
> 每個 checkpoint 無論 commit 或 skip 都記一列。Tier 決定 checkpoint 數：
> T1 三點（spec 完 / impl 完 / closeout）、T2 兩點（spec+impl 合併 / closeout）、
> T3 單一 commit。
>
> commit hash 只在 commit 實際成功後填入；pre-commit hook reject 或 commit
> 失敗記 `failed`、不寫假 hash。**例外：closeout 列不填 hash**——closeout
> commit 無法自含自身 hash，該列於 commit 前寫入、隨歸檔目錄一起進 commit；
> 溯源用 `git log -1 -- completed/{SPEC-ID}-{slug}` 或選配的
> `Dflow-Checkpoint` trailer（見 references/git-integration.md）。

| Timestamp | Checkpoint | Result |
|---|---|---|
| {YYYY-MM-DD HH:MM} | spec-baseline | committed ({hash}) / skipped / failed |
| {YYYY-MM-DD HH:MM} | implementation | committed ({hash}) / skipped / failed |
| {YYYY-MM-DD HH:MM} | closeout | committed / skipped / failed |

## Resume Pointer

> 目前進展到哪？下一個動作是什麼？開新對話接續工作時，從這裡讀起。
>
> 下方四個 cursor 欄位是 workflow 進度的**存放層（宣告，claim）**：
> 進入 flow 時設 Active Workflow；**每過一個 step gate** 更新 Current Step /
> Gates Passed / Awaiting（與該 gate 既有的 `_index.md` 更新合併，不另加儀式）；
> closeout / `/dflow:cancel` 時 Active Workflow 設回 `none`。
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
