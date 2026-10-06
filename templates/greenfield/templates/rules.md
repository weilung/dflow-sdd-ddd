<!-- dflow-shape: greenfield/rules.md 2 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Business Rules

> Declarative BR-ID index for one bounded context.

<!-- dflow:section business-rules -->
## Rule Index

<!-- Known deviations column: `—` means no deviation is recorded in this format; it never means the code was checked.
Fill this column using `references/confirmed-rule-vs-code.md` § Scope and recording. -->

| BR-ID | Rule summary | Behavior anchor | Aggregate | Status | Last updated | Known deviations |
|---|---|---|---|---|---|---|
| BR-001 | {業務規則摘要} | [BR-001](./behavior.md#br-001-rule-name) | {AggregateName} | draft | {YYYY-MM-DD} | — |

## Status Legend

| Status | Meaning |
|---|---|
| draft | Rule is identified but not fully validated. |
| active | Rule is validated and expected to be enforced. |
| deprecated | Rule is retained for history but no longer active. |

## Open Questions

- {需要 domain expert 確認的規則}
