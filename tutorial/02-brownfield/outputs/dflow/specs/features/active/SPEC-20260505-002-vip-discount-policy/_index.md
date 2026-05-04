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

<!-- dflow:section resume-pointer -->
## Resume Pointer

**Current Progress**: phase 1 `vip-rate-and-contract` spec 已建立，BR-005~008、Domain concepts、implementation tasks 已整理；implementation 尚未開始。

**Next Action**: 依 Git Flow 從 `develop` 建立 `feature/SPEC-20260505-002-vip-discount-policy`，實作 `ContractValidUntil`、擴張 `DiscountPolicy`、新增 Customer reference repository query，並在同一 phase implementation task 中移除 `OrderList.aspx.cs` 的 `isVip * 0.93` dead code。
