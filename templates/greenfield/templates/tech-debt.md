<!-- dflow-shape: greenfield/tech-debt.md 2 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Architecture Tech Debt

> Architecture and implementation debt discovered during SDD/DDD work.

## Debt Items

<!--
Confirmed-rule deviations: for the record payload, read `references/confirmed-rule-vs-code.md` § Scope and recording.
This project's debt file is `dflow/specs/architecture/tech-debt.md`. A row that records a confirmed-rule deviation fills these columns:
- Layer: the layer the code is in.
- Decision / debt: the payload, its items separated by <br>, plus a `Location: {file/method}` item for the code; this table has no Location column.
- Impact: the actual impact.
- Follow-up: the repair direction or its link; once the row is resolved, the SPEC-ID that resolved it.
- Status: `open` while the fix is deferred; `planned` only when the fix is scheduled.
-->

| Item | Layer | Decision / debt | Impact | Follow-up | Status |
|---|---|---|---|---|---|
| {Debt item} | {Domain/Application/Infrastructure/API} | {決策或債務描述} | {影響範圍} | {後續處理方式} | {open/planned/in-progress/done} |

## Follow-up Notes

- {需要後續 proposal、ADR、refactor 或 architecture review 的事項}
