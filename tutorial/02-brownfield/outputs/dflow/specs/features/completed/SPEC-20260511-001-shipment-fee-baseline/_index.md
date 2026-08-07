---
spec-id: SPEC-20260511-001
slug: shipment-fee-baseline
status: completed
created: 2026-05-11
completed_date: 2026-05-11
branch: feature/SPEC-20260511-001-shipment-fee-baseline
---

# Shipment 運費現行行為 baseline capture

## Goals & Scope

捕捉 Shipment 運費在**購物車頁**、**結帳頁**、**出貨通知信**三處的現行計算與顯示行為。
2026-05-11 由客服轉來的客訴觸發（同一張訂單：購物車顯示免運、結帳頁收 150、出貨通知信又寫免運）。

**observation-only —— 本次未改動任何輸出。** 目標是先寫下「現在到底是怎麼算的」，
「哪一個才正確」是待決的業務決定，不在本次 scope 內。

涉及 Bounded Context：**Shipment**。

**tier-exempt**（`AI-AGENT-GUIDE.md` § Ceremony Scaling 步驟 0 的 observation-only 例外）：
本 host 不在 T1 / T2 / T3 內，但也**不是** below workflow——它必須被記錄下來。

**這是 baseline 最小 host、(c) no-feature 狀態**
（`references/modify-existing-flow.md` Step 1.7 的 baseline 分支）：
`active/` 的 `SPEC-20260505-002-vip-discount-policy`（VIP 折扣，Order BC）與
`completed/` 的 `SPEC-20260430-001-order-discount-calculation`（折扣計算，Order BC）
都與運費**不相關**，因此沒有 feature 能承接這次 capture，也沒有 completed feature
被當成它的 follow-up。

## Phase Specs

> 最小 host 不帶 phase-spec，本表**刻意保持空白**。

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

> **刻意保持空白。** baseline capture 是 observation-only、tier-exempt——它不建立 BR，
> snapshot 也不是它的記錄面。三處免運門檻判斷基準不一致是**待決的業務問題**，
> 已記入 `dflow/specs/migration/tech-debt.md`，**不**升格成 BR。

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

> `Tier` 欄的值是 **`baseline`**——不是 T2、不是 T3。closeout 與 `/dflow:pr-review` 的
> reader 都認得這個值（P082 契約）。
>
> Description 末尾宣告這次變更碰到的路徑。baseline 沒有原始碼變更，它宣告的是
> **自己寫進去的 BC 層文件**。closeout 會拿 `spec-baseline` checkpoint 的 diff 與它比對；
> 一個路徑都沒宣告會擋下 closeout。

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-11 | baseline | Shipment 運費在購物車 / 結帳 / 出貨通知三處的現行計算與顯示行為 capture（observation-only，未改任何輸出）— `dflow/specs/domain/Shipment/behavior.md` | 4b17d92 |

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> 第一個 checkpoint 名為 **`spec-baseline`**，不是 `implementation`——本 host 沒有實作。
> 把它記成 `implementation | committed` 會在 ledger 裡留下一筆「這裡發生過實作」的假紀錄。
>
> closeout 列不帶 hash（commit 無法自含自身 hash）。

| Timestamp | Checkpoint | Result |
|---|---|---|
| 2026-05-11 11:30 | spec-baseline | committed (4b17d92) |
| 2026-05-11 11:50 | closeout | committed |

## Resume Pointer

**Current Progress**: baseline capture completed (2026-05-11)；zero-phase、tier-exempt minimal host，已歸檔。

**Next Action**: integration — push / merge / PR per the selected Git policy。三處免運門檻不一致待營運拍板後另開 feature。

**Active Workflow**: none

**Current Step**: n/a

**Gates Passed**: n/a

**Awaiting**: none

<!--
本 fixture 到 Resume Pointer 為止，只有那七個必要段落。理由是
`references/finish-feature-flow.md` Step 5 明寫 Integration Summary
「Print the summary to the conversation; **do not write it to a file**」。

**這是明文指示，不是 gate。** Step 1 檢查的是七段**都在**、不是「不准有別的」；
post-commit 驗證比的是 Step 1 讀到的內容有沒有被改動。多一段不會被擋下——
這裡不寫，是因為 Step 5 這麼說。

三處 capture 的結果本身住在 BC 層：dflow/specs/domain/Shipment/behavior.md
待決的業務問題住在：dflow/specs/migration/tech-debt.md

Integration Summary 的逐欄形狀（含 brownfield 沒有 `Aggregates affected` /
`Domain Events Changes` 這兩欄）與生命週期說明，都在 walkthrough 正文：
tutorial/02-brownfield/walkthrough-07-baseline-minimal-host.md
-->
