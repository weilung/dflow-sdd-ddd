# {Bounded Context} — Behavior Specification

> **Purpose**: Consolidated source of truth for this context's current behavior.
> Unlike `dflow/specs/features/completed/` (historical archive), this file always reflects
> the **current** system behavior — what the system does right now.
>
> **Maintenance**: AI updates this file during the completion flow (Step 8.3 / Step 6.3).
> When a feature is completed, merge its Given/When/Then scenarios here.
> When behavior is modified, update the corresponding section using the Delta result
> (not the Delta markup — merge the final state).
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
