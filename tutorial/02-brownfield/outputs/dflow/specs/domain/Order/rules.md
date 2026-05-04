<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Business Rules

> Order bounded context 的 declarative BR-ID index。

<!-- dflow:section business-rules -->
## Rule Index

| BR-ID | Rule summary | Behavior anchor | Status | Last updated |
|---|---|---|---|---|
| BR-001 | 訂單折扣前總金額等於所有 `OrderLine.UnitPrice * Quantity` 的加總。 | [BR-001](./behavior.md#br-001-pre-discount-total) | active | 2026-04-30 |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off（price multiplier 0.9）。 | [BR-002](./behavior.md#br-002-full-threshold-discount) | active | 2026-04-30 |
| BR-003 | `CustomerTier = 'Senior'` 的老客戶可額外套用客戶等級折扣率 5% off（price multiplier 0.95）。 | [BR-003](./behavior.md#br-003-senior-customer-discount) | active | 2026-04-30 |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`。 | [BR-004](./behavior.md#br-004-compound-discount-accumulation) | active | 2026-04-30 |
| BR-005 | 2026-05-05 SPEC-002 ADDED：VIP 客戶且 `ContractValidUntil >= OrderDate` 時，額外套用 VIP 7% off。 | [BR-005](./behavior.md#br-005-vip-contract-valid-discount) | active | 2026-05-05 |
| BR-006 | 2026-05-05 SPEC-002 ADDED：VIP 合約過期時不套用 VIP 7% off，但仍依一般折扣規則計算。 | [BR-006](./behavior.md#br-006-expired-vip-contract-fallback) | active | 2026-05-05 |
| BR-007 | 2026-05-05 SPEC-002 ADDED：多折扣 stack order 為 full-threshold -> VIP -> Senior，並以乘法累積。 | [BR-007](./behavior.md#br-007-vip-discount-stacking-order) | active | 2026-05-05 |
| BR-008 | 2026-05-05 SPEC-002 ADDED：VIP eligibility 與 Senior customer-tier 可以同時存在，業務允許同時 stack。 | [BR-008](./behavior.md#br-008-vip-and-senior-can-stack) | active | 2026-05-05 |

## Lifecycle

- BR-001~004 finalized as of 2026-05-12 from `SPEC-20260430-001-order-discount-calculation` completion.
- BR-005~008 are owned by `SPEC-20260505-002-vip-discount-policy` and remain active while that feature is still in progress.
- 多 feature 並存於 Order BC 時，`rules.md` 是 cross-feature cumulative state；`/dflow:finish-feature` 只 reconcile 本次 completed feature owned BR，不覆寫其他 active feature 的 BR。

## Status Legend

| Status | Meaning |
|---|---|
| draft | 規則已識別，但尚未完整驗證。 |
| active | 規則已驗證，預期由系統執行。 |
| deprecated | 規則保留作為歷史紀錄，但不再 active。 |

## Open Questions

- Tax calculation 與 invoice rounding 尚未納入這些 BR。
- 後續確認 `Senior` 以外的 customer tiers 是否需要 generalized discount table 或 policy strategy。
- `ContractValidUntil` 最終欄位來源需在 `SPEC-20260505-002` implementation 前由 Customer 資料 owner 確認。
