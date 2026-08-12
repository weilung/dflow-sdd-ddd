---
spec-id: SPEC-20260505-002
slug: vip-discount-policy
status: in-progress
created: 2026-05-05
branch: feature/SPEC-20260505-002-vip-discount-policy
---

<!-- dflow:section metadata -->
# VIP Discount Policy

<!-- dflow:section goals-scope -->
## Goals & Scope

本 feature 處理業務團隊提出的 VIP loyalty program：VIP 客戶且訂單日期落在合約有效期內時，Order BC 的 `DiscountPolicy` 需額外套用 7% off；合約過期時回到一般折扣規則。

本 feature 屬於 Order BC，因為它改變的是訂單折扣計算規則與既有 BR-001~004 的互動。Customer 的 VIP 狀態與 `ContractValidUntil` 來自 Customer reference data，但本 feature 不正式建立 Customer BC，也不建 Customer Aggregate。

Phase 1 `vip-rate-and-contract` 會擴張既有 `DiscountPolicy`，新增 `ContractValidUntil` Value Object，補上 BR-005~008，並在 implementation task 中清理 `OrderList.aspx.cs` 既有 `isVip * 0.93` dead code。該清理是 legacy debt resolution，不寫成 BR。

<!-- dflow:section phase-specs -->
## Phase Specs

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | 2026-05-05 | vip-rate-and-contract | in-progress | [phase-spec-2026-05-05-vip-rate-and-contract.md](./phase-spec-2026-05-05-vip-rate-and-contract.md) |

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-005 | `CustomerTier` 含 VIP eligibility 且 `ContractValidUntil >= OrderDate` 時，訂單額外套用 VIP 7% off（price multiplier 0.93）。 | phase-1 | phase-1 | active |
| BR-006 | VIP 客戶合約已過期時不套用 VIP 7% off，但仍依 BR-002~BR-004 評估一般滿額折扣與客戶等級折扣。 | phase-1 | phase-1 | active |
| BR-007 | VIP 折扣與其他折扣可 stack；順序為先套滿額折扣，再套 VIP 折扣，最後套 Senior customer-tier 折扣。 | phase-1 | phase-1 | active |
| BR-008 | VIP eligibility 與 Senior customer-tier 可以同時存在；若同一客戶同時符合 VIP 合約與 Senior 條件，業務允許依 BR-007 stack。 | phase-1 | phase-1 | active |

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

| Date | Tier | Description | Commit |
|---|---|---|---|
| | | | |

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> 生命週期 checkpoint 的 commit / skip 時間線。T1 記三點（spec 完／impl 完／
> closeout），每個 checkpoint 無論 commit 或 skip 都記一列。完整規則見
> `dflow/specs/shared/dflow-workflows/templates/_index.md` 與
> references/git-integration.md § Commit Checkpoints。
>
> ⚠ **這張表現在是空的，而且這是對的。** T1 的第一個 checkpoint 叫 **`spec-baseline`**
> （`new-feature-flow.md` 稱它「the spec baseline」，milestone 1 of 3；範本的合法值只有
> `branch-override` / `spec-baseline` / `implementation` / `closeout` 四個，不要自己寫
> `spec`），而它是在 **Step 6 裡、feature branch 建好之後**才被提供的——flow 的原話是
> 「**now that the feature branch exists**（branch gate 先跑過，所以這個 commit 落在
> feature branch 上、**絕不落在 base branch**），offer to commit the spec baseline」。
>
> 本 host 停在 review point、branch 還沒建（走查 04 的 Step 6：Dflow 建議了 branch 名稱，
> Bob 決定先把 spec 給同事 review）。**所以此刻不可能有任何 checkpoint 列**：規格文件已經
> 寫好躺在工作區，但承載它們的那個 commit 要等 branch。
> branch 建好、spec baseline commit 之後補第一列；impl 與 closeout 各於發生時再補一列。

| Timestamp | Checkpoint | Result |
|---|---|---|

<!-- dflow:section resume-pointer -->
## Resume Pointer

**Current Progress**: phase 1 `vip-rate-and-contract` spec 已建立，BR-005~008、Domain concepts、implementation tasks 已整理；implementation 尚未開始。

**Next Action**: 依 Git Flow 從 `develop` 建立 `feature/SPEC-20260505-002-vip-discount-policy`，實作 `ContractValidUntil`、擴張 `DiscountPolicy`、新增 Customer reference repository query，並在同一 phase implementation task 中移除 `OrderList.aspx.cs` 的 `isVip * 0.93` dead code。

**Active Workflow**: new-feature

**Current Step**: Step 6 — Git Branch

**Gates Passed**: 3→3.5, 4→5

**Awaiting**: none (mid-step)

> ⚠ **這是本 tutorial 唯一一份 active host，所以四個 cursor 欄位在這裡才看得到「活的」值。**
> 它們是 workflow 進度的宣告層：`/dflow:new-feature` 進來時設 Active Workflow，每過一個
> step gate 更新後三個（本 flow 的 gate 是 3→3.5、4→5、6→7、7→8）。本 host 已經進到
> **Step 6**（branch 名稱確認了、branch 還沒建），而 6→7 那道 gate 要等 branch 就緒才到，
> 所以 `Awaiting` 記 `none (mid-step)`——**不是**指沒事可做，是指此刻沒有停在任何 gate 上。
> closeout 或 `/dflow:cancel` 時 Active Workflow 設回 `none`——completed fixture 看到的
> `none` / `n/a` 就是那個終局值。
