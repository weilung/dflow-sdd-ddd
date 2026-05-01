<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# Spec Writing Conventions — OrderManager

> Created: 2026-04-29
> Scope: how spec documents are authored and named in this project.
> Audience: engineers writing specs; AI assistants producing spec drafts.

This file captures **project-level** conventions only. Template shapes
and Ceremony criteria are defined by the Dflow skill; here we just
record how *this* project fills them in.

---

## Where Specs Live

All spec documents live under `dflow/specs/`. The feature directory pattern
and file names follow Dflow (see the Dflow skill § "Project Structure
Reference" for the full tree):

```
dflow/specs/features/active/{SPEC-ID}-{slug}/
├── _index.md                              # Feature dashboard
├── phase-spec-{YYYY-MM-DD}-{slug}.md      # T1 Heavy (one per phase)
└── lightweight-{YYYY-MM-DD}-{slug}.md     # T2 Light (or BUG-{NUMBER}-{slug}.md)
```

T3 Trivial changes do **not** produce a separate file — they are
recorded as one row in `_index.md` Lightweight Changes.

## Prose Language

Project prose language: `zh-TW`

Dflow templates keep canonical English structural language: headings,
table headers, fixed labels, placeholders, IDs, anchors, and code-facing
terms remain English.

Free prose written inside those sections should follow the project prose
language:

- `en`: write free prose in English.
- `zh-TW`: write free prose in Traditional Chinese.
- `{xx-XX}`: write free prose in that explicit BCP-47 language.

Do not translate code identifiers, DDD pattern names, BR IDs, SPEC IDs,
file paths, branch names, anchors, or inline code only to satisfy the
prose-language setting.

### SPEC-ID Format

- Pattern: `SPEC-YYYYMMDD-NNN` (e.g. `SPEC-20260429-001`)
- Per-day counter `NNN` resets daily, starts at `001`
- Once assigned, the SPEC-ID is immutable — it appears in the feature
  directory name, the first phase-spec filename, and the git branch
  name (see `Git-principles-*.md`)

### Slug Conventions (Project-Specific Fill-In)

- **Language**: use the language the feature is discussed in; no forced
  translation. For OrderManager, English slugs are preferred for Git
  branch readability.
- **Project-specific term list**:
  - order entry → `order-entry`
  - available-to-promise → `atp`
  - credit limit → `credit-limit`
  - inventory reservation → `inventory-reservation`
- **Length target**: 2–4 English words or 2–6 Chinese characters.

---

## Filling the Templates

Dflow ships these templates (do **not** re-inline their content here
— always read the canonical template from the skill):

| Template | Used when |
|----------|-----------|
| `templates/_index.md` | Creating a feature directory (every feature) |
| `templates/phase-spec.md` | T1 Heavy — new feature / new phase / architectural change |
| `templates/lightweight-spec.md` | T2 Light — bug fix / small tweak with BR Delta |
| `templates/context-definition.md` | When a new Bounded Context is introduced |
| `templates/behavior.md` | BC-level consolidated behavior spec |

Project-specific guidance when filling these templates:

- For brownfield changes, record current behavior before proposing the
  changed behavior. If current behavior is unclear, mark it as an Open
  Question instead of guessing.
- When a spec touches `OrderEntry.aspx.cs`, explicitly identify which
  code path or event handler was inspected.
- For monetary calculations, list currency, rounding rule, tax handling
  and discount order in Given/When/Then scenarios.
- For inventory-related rules, separate "can submit order" from
  "reserve stock"; do not collapse both into one vague rule.

---

## Ceremony Scaling (Project Application)

The Dflow skill defines three tiers — **T1 Heavy / T2 Light / T3
Trivial**. See the Dflow skill § "Ceremony Scaling" for the full
criteria table. We do not re-define the tier criteria here; this
section records how *this* project applies them in borderline
situations.

| Situation (project-specific) | Tier we default to | Why |
|------------------------------|--------------------|-----|
| 修改 Order submit、金額計算、信用額度或庫存預留 | T1 | 這些都是 business rules，且常牽涉 Domain extraction。 |
| 修正單一頁面顯示文字，但不改資料或流程 | T3 | 無 BR change、無 Domain concept change、無資料結構改動。 |
| 調整 Stored Procedure 查詢條件且影響訂單結果 | T1 | 即使程式碼在 SQL，仍然改變業務結果，需要 spec。 |
| 小型 validation bug fix，有 1-2 個 Given/When/Then 足以描述 | T2 | 需要 trace，但不一定要完整 phase-spec。 |

If the team disagrees on tier classification for a specific change,
run through the T3 four-criteria checklist (in the Dflow skill) and
record the decision here the first time it arises.

---

## Glossary Consistency

All business terms in spec documents must use names defined in
`dflow/specs/domain/glossary.md`. When a new term appears:

1. Check glossary first
2. If missing, add it **before** using the term in a spec
3. Cross-reference the BC the term belongs to

This rule is enforced by the Dflow skill during `/dflow:new-feature`
and `/dflow:new-phase` flows; the project-level convention is simply
"don't bypass the glossary update."

---

## Brownfield Baseline Capture

For `/dflow:modify-existing`, every spec should include a short
baseline note:

- Which WebForms page / Code-Behind handler was inspected
- Which repository / Stored Procedure paths were touched
- What existing behavior is known from code
- What existing behavior still needs confirmation from a domain expert

This prevents accidental rewriting of undocumented behavior while still
allowing the team to extract Domain logic incrementally.

---

## Related Documents

- [System overview](_overview.md)
- [Git principles](Git-principles-gitflow.md)
- [Glossary](../domain/glossary.md)
- Dflow skill SKILL.md — canonical source for Ceremony Scaling, flow
  selection, and template shapes.
