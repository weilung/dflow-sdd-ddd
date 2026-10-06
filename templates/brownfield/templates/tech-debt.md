<!-- dflow-shape: brownfield/tech-debt.md 2 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Migration Tech Debt

> Target-architecture and implementation debt discovered during SDD/DDD work.

## Debt Items

<!--
Confirmed-rule deviations: for the record payload, read `references/confirmed-rule-vs-code.md` § Scope and recording.
This project's debt file is `dflow/specs/migration/tech-debt.md`. A row that records a confirmed-rule deviation fills these columns:
- Location: the implementation file and method.
- Description: the payload, its items separated by <br>.
- Severity: by the actual impact.
- Migration impact: the actual impact on the target architecture; write none when there is none, and do not invent one.
- Status: `open` while the fix is deferred; `planned` only when the fix is scheduled.
-->

| Item | Location | Description | Severity | Migration impact | Status |
|---|---|---|---|---|---|
| {Debt item} | `{file/path/or/namespace}` | {問題描述} | {Low/Medium/High/Critical} | {對 target architecture 的影響} | {open/planned/in-progress/done} |

## Follow-up Notes

- {需要後續 proposal、refactor 或 migration plan 的事項}
