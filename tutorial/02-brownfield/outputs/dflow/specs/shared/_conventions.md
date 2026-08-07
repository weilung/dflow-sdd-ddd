<!-- Seeded by Dflow. -->

# Spec Writing Conventions — OrderManager

> Created: 2026-04-29
> Scope: how spec documents are authored and named in this project.
> Audience: engineers writing specs; AI assistants producing spec drafts.
> **本檔為 tutorial 節錄版**，不是逐字的 `dflow init` 產出——省略了
> `> Dflow Version:` 行與 `## Git Policy` / `## AI Commit Policy` 兩段。

This file captures **project-level** conventions only. Template shapes
and Ceremony criteria are defined by Dflow itself (the Ceremony tier criteria
live in `AI-AGENT-GUIDE.md` § Ceremony Scaling; template shapes live in the
workflow bundle); here we just record how *this* project fills them in.

---

## Where Specs Live

All spec documents live under `dflow/specs/`. The feature directory pattern
and file names follow Dflow (see `AI-AGENT-GUIDE.md` § Source of Truth
for the full tree):

```
dflow/specs/features/active/{SPEC-ID}-{slug}/
├── _index.md                              # Feature dashboard
├── phase-spec-{YYYY-MM-DD}-{slug}.md      # T1 Heavy (one per phase)
└── lightweight-{YYYY-MM-DD}-{slug}.md     # T2 Light (or BUG-{NUMBER}-{slug}.md)
```

T3 Trivial changes do **not** produce a separate file — they are
recorded as one row in `_index.md` Lightweight Changes.

### SPEC-ID Format

- Pattern: `SPEC-YYYYMMDD-NNN` (e.g. `SPEC-20260429-001`)
- Per-day counter `NNN` resets daily, starts at `001`
- Once assigned, the SPEC-ID is immutable — it appears in the feature
  directory name, the first phase-spec filename, and the git branch
  name (see `Git-principles-*.md`)
- **Minimal (zero-phase) host exception.** A host that records a small
  standalone or follow-up change — or a baseline capture — carries **no
  phase-spec**, so there is no phase-spec filename for the SPEC-ID to appear
  in; the directory name and the branch carry it. A **functional bug** host
  goes one step further: its branch is `bugfix/BUG-{NUMBER}-{slug}`, so it
  carries the BUG-NUMBER and not the SPEC-ID at all. In every case the host
  `_index.md` `branch:` field is authoritative, and the SPEC-ID itself stays
  immutable. Do not create a phase-spec, or rename a branch, to make the
  three-name rule above hold.

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

---

## Filling the Templates

Dflow ships these templates (do **not** re-inline their content here
— always read the canonical template from the skill):

| Template | Used when |
|----------|-----------|
| `templates/_index.md` | Creating a feature directory (every feature) |
| `templates/phase-spec.md` | T1 Heavy |
| `templates/lightweight-spec.md` | T2 Light — classic BR-delta form, or one of the no-BR family variants (presentation, non-breaking contract, operational / security, performance, implementation defect, intentional change) |
| `templates/context-definition.md` | When a new Bounded Context is introduced |
| `templates/behavior.md` | BC-level consolidated behavior spec |

Which tier applies is decided by the cascade in `AI-AGENT-GUIDE.md` § Ceremony
Scaling, never by this table — these rows only say which template a tier uses.

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

Dflow defines three tiers — **T1 Heavy / T2 Light / T3 Trivial** —
plus a below-workflow level. See `AI-AGENT-GUIDE.md` § "Ceremony Scaling" for the
full ordered cascade. We do not re-define the tier criteria here; this
section records how *this* project applies them in borderline
situations.

**The cascade result is a floor: rows in this section may only escalate a
tier, never lower it.** A row may take a change Dflow would call T2 and
make it T1 for this project; no row may lower a T1, and no row may move a
tracked change below workflow.

Write `T<n> (project convention)` in the Tier column when this project raises the
tier, and `cascade result` when it adds an obligation but no tier change. Do not
write a bare tier — that restates the cascade instead of recording a decision,
and it is how the two drift apart.

| Situation (project-specific) | Tier we default to | Why |
|------------------------------|--------------------|-----|
| 修改 Order submit、金額計算、信用額度或庫存預留 | T1 (project convention) | 這一區塊我們一律往上升、不論 cascade 給什麼——常牽涉 Domain extraction，寧可多寫規格。 |
| 修正單一頁面顯示文字，但不改資料或流程 | cascade result + 抽離紀錄一行 | 不改 tier；加註是為了讓後續 delivery-layer 掃描找得到。 |
| 調整 Stored Procedure 查詢條件且影響訂單結果 | T1 (project convention) | 即使程式碼在 SQL，我們仍往上升，因為這裡改的是業務結果。 |
| 小型 validation bug fix，有 1-2 個 Given/When/Then 足以描述 | T2 (project convention) | 這類修正我們一律留一份 lightweight-spec，即使 cascade 認為不必開檔——事後查得到才算數。 |

If the team disagrees on tier classification for a specific change,
run through the ordered cascade (in `AI-AGENT-GUIDE.md` § Ceremony Scaling) and
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
- `dflow/specs/shared/AI-AGENT-GUIDE.md` — canonical source for Ceremony Scaling, flow
  selection, and template shapes.
