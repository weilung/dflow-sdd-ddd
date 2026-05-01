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

  Six required sections (see below):
    1. Metadata (YAML front matter above)
    2. Goals & Scope (prose)
    3. Phase Specs (T1 list)
    4. Current BR Snapshot (feature-level cumulative state)
    5. Lightweight Changes (T2 outbound link + T3 inline)
    6. Resume Pointer

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
-->

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
>        `[format]`）；T3 不產獨立 spec 檔
>
> Tier 判準見 SKILL.md § Ceremony Scaling 三層表。

| Date | Tier | Description | Commit |
|---|---|---|---|
| {YYYY-MM-DD} | T2 | bug fix XYZ — 見 [`lightweight-{date}-{slug}.md`](./lightweight-{date}-{slug}.md) | {hash} |
| {YYYY-MM-DD} | T3 | 按鈕顏色從藍改綠 `[cosmetic]` | {hash} |

## Resume Pointer

> 一句話：目前進展到哪？下一個動作是什麼？
> 開新對話接續工作時，從這裡讀起。

**Current Progress**: {one-line summary}

**Next Action**: {suggested next action}

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
