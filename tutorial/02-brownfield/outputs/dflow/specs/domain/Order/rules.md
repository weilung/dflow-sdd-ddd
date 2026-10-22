<!-- dflow-shape: brownfield/rules.md 2 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Business Rules

> Order bounded context 的 declarative BR-ID index。

<!-- dflow:section business-rules -->
## Rule Index

<!-- Known deviations column: `—` means no deviation is recorded in this format; it never means the code was checked.
Fill this column using `references/confirmed-rule-vs-code.md` § Scope and recording. -->

| BR-ID | Rule summary | Behavior anchor | Status | Last updated | Known deviations |
|---|---|---|---|---|---|
| BR-001 | 訂單折扣前總金額等於所有 `OrderLine.UnitPrice * Quantity` 的加總。 | [BR-001](./behavior.md#br-001-pre-discount-total) | active | 2026-05-12 | — |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off（price multiplier 0.9）。 | [BR-002](./behavior.md#br-002-full-threshold-discount) | active | 2026-05-12 | — |
| BR-003 | `CustomerTier = 'Senior'` 的老客戶可額外套用客戶等級折扣率 5% off（price multiplier 0.95）。 | [BR-003](./behavior.md#br-003-senior-customer-discount) | active | 2026-05-12 | — |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`。 | [BR-004](./behavior.md#br-004-compound-discount-accumulation) | active | 2026-05-12 | — |

## Lifecycle

- BR-001~004 finalized as of 2026-05-12 from `SPEC-20260430-001-order-discount-calculation` completion.
- `SPEC-20260505-002-vip-discount-policy` is still in progress; its BR-005~008 are in its own `_index.md` and reach this file only at its `/dflow:finish-feature`.
- 多 feature 並存於 Order BC 時，`rules.md` 只放收尾過的 feature 定案的規則；`/dflow:finish-feature` 只 reconcile 本次 completed feature owned BR，不覆寫其他 feature 已經寫進來的 BR。

## Status Legend

| Status | Meaning |
|---|---|
| draft | 規則已識別，但尚未完整驗證。 |
| active | 規則已驗證，預期由系統執行。 |

## Open Questions

- Tax calculation 與 invoice rounding 尚未納入這些 BR。
- 後續確認 `Senior` 以外的 customer tiers 是否需要 generalized discount table 或 policy strategy。
