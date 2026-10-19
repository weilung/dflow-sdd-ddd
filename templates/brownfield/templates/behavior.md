<!-- dflow-shape: brownfield/behavior.md 3 — keep this line: dflow doctor reads it -->
<!-- This template is part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE in the Dflow package, or dflow/specs/shared/dflow-workflows/LICENSE in a project. Documents written from it are yours: do not copy this line into them. -->
# {Bounded Context} — Behavior Specification

> **Purpose**: Consolidated current rule scenarios and observations for this context.
> BR-ID scenarios state the business rules; Known deviation records state observed
> implementation differences.
> Observations without a confirmed BR remain observations, not validated rules.
> A `draft` BR's scenarios are a candidate rule, not a confirmed one: its
> `> Draft basis:` line says where the candidate came from, and a passage without
> a BR-ID says what the system does now.
>
> **Maintenance**: AI updates this file during the completion flow (Step 8.3 / Step 6.3).
> When a feature is completed, merge its Given/When/Then scenarios here.
> When behavior is modified, update the corresponding section using the Delta result
> (not the Delta markup — merge the final state).
> When replacing or deleting a section that holds a `> Known deviation:` line, apply
> `references/confirmed-rule-vs-code.md` § Preserve during merge.
> When rewriting, confirming or deleting a `draft` BR that holds a `> Draft basis:`
> line, apply `references/modify-existing-baseline.md` § Preserve pending confirmations.
>
> **Relationship to rules.md**: `rules.md` is the declarative index (BR-ID + one-line summary).
> This file is the scenario-level detail. Each BR-ID in `rules.md` should have a
> corresponding section here. If they drift, `/dflow:verify` will catch it.

---

<!-- dflow:section behavior-scenarios -->
## {Feature Area 1}

### BR-001: {Rule Name}

Given {initial state}
When {action}
Then {expected result}

### BR-002: {Rule Name}

Given {initial state}
When {action}
Then {expected result}

#### Edge cases

- EC-001: Given {edge case state} When {action} Then {handling}

---

## {Feature Area 2}

### BR-003: {Rule Name}

Given {initial state}
When {action}
Then {expected result}

---

<!--
Maintenance notes:
- Organize by feature area, not by spec ID (specs are transient; behavior areas are stable)
- When merging a completed spec, place its scenarios under the matching feature area
- When a MODIFIED delta changes a rule, update the scenario here to reflect the NEW behavior
  (git history preserves the old version — don't keep "原本/改為" pairs here)
- When a REMOVED delta drops a rule, delete the corresponding section
- When a RENAMED delta renames a concept, update all references in this file
- Keep BR-IDs in sync with rules.md
-->
