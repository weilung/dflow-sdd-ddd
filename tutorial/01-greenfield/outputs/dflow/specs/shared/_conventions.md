<!-- Seeded by Dflow. -->

# Spec Writing Conventions — ExpenseTracker

> Created: 2026-04-28
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

- Pattern: `SPEC-YYYYMMDD-NNN` (e.g. `SPEC-20260428-001`)
- Per-day counter `NNN` resets daily, starts at `001`
- Once assigned, the SPEC-ID is immutable — it appears in the feature
  directory name, the first phase-spec filename, and the git branch
  name (see `Git-principles-trunk.md`)
- **Minimal (zero-phase) host exception.** A host that records a small
  standalone or follow-up change carries **no phase-spec**, so there is no
  phase-spec filename for the SPEC-ID to appear in — the directory name and
  the branch carry it. A **functional bug** host goes one step further: its
  branch is `bugfix/BUG-{NUMBER}-{slug}`, so it carries the BUG-NUMBER and
  not the SPEC-ID at all. In every case the host `_index.md` `branch:` field
  is authoritative, and the SPEC-ID itself stays immutable. Do not create a
  phase-spec, or rename a branch, to make the three-name rule above hold.

### Slug Conventions (Project-Specific Fill-In)

- **Language**: follow the language the feature is discussed in (Dflow
  skill policy); no translation is forced. Both Chinese and English
  slugs are valid.
- **Project-specific term list**: {fill in project-specific abbreviation
  conventions here, e.g. "bounded context name shortenings",
  "Aggregate name → slug rules"; otherwise leave empty}
  — TODO：等第一個 BC 命名落地後補上 ExpenseReport / Reimbursement 縮寫慣例。
- **Length target**: 2–4 English words or 2–6 Chinese characters
  (Dflow skill guidance)

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
| `templates/_index.md`           | Creating a feature directory (every feature) |
| `templates/phase-spec.md`       | T1 Heavy |
| `templates/lightweight-spec.md` | T2 Light — classic BR-delta form, or one of the no-BR family variants (presentation, non-breaking contract, operational / security, performance, implementation defect, intentional change) |
| `templates/context-definition.md` | When a new Bounded Context is introduced |
| `templates/aggregate-design.md` | When a new Aggregate is introduced |
| `templates/behavior.md`         | BC-level consolidated behavior spec |

Which tier applies is decided by the cascade in `AI-AGENT-GUIDE.md` § Ceremony
Scaling, never by this table — these rows only say which template a tier uses.

Project-specific guidance when filling these templates:

### DDD-specific spec conventions

- **Aggregate identification**: every phase-spec that introduces new
  behavior should explicitly name the Aggregate involved. If the
  change spans Aggregates, call that out in the spec's "Domain
  Modeling" section and explain the integration strategy (Domain
  Event? Query? ACL?).
- **Domain Events documentation**: events belong in
  `dflow/specs/domain/{context}/events.md`. When a phase-spec introduces or
  modifies an event, update `events.md` during Step 8.3 sync — do not
  only update it in the feature-level spec.
- **Aggregate state transitions**: for phase-specs that change
  Aggregate state, include explicit "state-before → state-after"
  descriptions (Mermaid state diagram or Given / When / Then + "And
  the Aggregate is in state X").
- **CQRS split**: commands (write) vs queries (read) should be
  identified during Activity 4 (Implementation Planning). Commands
  generally map 1:1 to an Aggregate method; queries bypass the
  Domain layer and read projections.

### Project-specific fill-ins

- {e.g. "All Money amounts use the `Money` value object with explicit
  currency; do not use `decimal` for money in the Domain layer."}
- {e.g. "Every Aggregate has a `CreatedAt` / `LastModifiedAt`
  shadow property; this is implemented in the Infrastructure layer
  EF configuration, not in the Domain."}
- {e.g. "Pagination for queries uses `PagedResult<T>` defined in
  SharedKernel."}
<!-- TODO: 第一個 phase-spec 走完後把實際採用的慣例寫進來 -->

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
| {e.g. New Aggregate} | cascade result + `aggregate-design.md` | No tier change — we add the design worksheet on top of whatever the cascade returns, because our invariants need somewhere to live |
| {e.g. A supporting query added for an existing screen or behaviour change} | T2 (project convention) | We want a lightweight-spec trace even when the cascade would not require a spec file |
| {e.g. A newly exposed read capability — new endpoint, new data source, or an independently callable read} | T1 (project convention) | We escalate any newly exposed read above whatever the cascade returns — our consumers treat it as a contract the moment it exists |
| {e.g. EF configuration tweak in Infrastructure} | T1 (project convention) | We escalate Infrastructure mapping tweaks above whatever the cascade returns — this layer has silently changed persisted behaviour before |
| {e.g. Domain Event payload extension} | T1 (project convention) | We escalate above whatever the cascade returns for an additive optional field, because our cross-context consumers deserialize strictly |

### DDD Modeling Depth (`AI-AGENT-GUIDE.md` § Ceremony Scaling)

Dflow further distinguishes:

- **Full** (new Aggregate / new BC): use `templates/aggregate-design.md`
  + update `context-map.md` + define events in `events.md`
- **Standard** (feature within existing BC, existing Aggregate):
  confirm Aggregate ownership + update `models.md` / `rules.md`
- **T2 / T3**: confirm the fix lands in the correct layer; no
  design-level updates required

Use this table to record project-specific interpretation if needed.

---

## Glossary Consistency

All business terms in spec documents must use names defined in
`dflow/specs/domain/glossary.md`. When a new term appears:

1. Check glossary first
2. If missing, add it **before** using the term in a spec
3. Cross-reference the BC the term belongs to
4. If the term maps to a code construct (Aggregate / VO / Event), add
   the `Code Mapping` column value

This rule is enforced by the Dflow skill during `/dflow:new-feature`
and `/dflow:new-phase` flows; the project-level convention is simply
"don't bypass the glossary update."

---

## Related Documents

- [System overview](_overview.md)
- [Git principles](Git-principles-trunk.md)
- [Context map](../domain/context-map.md)
- [Glossary](../domain/glossary.md)
- `dflow/specs/shared/AI-AGENT-GUIDE.md` — canonical source for Ceremony Scaling, flow
  selection, and template shapes.
- Dflow skill `references/ddd-modeling-guide.md` — DDD tactical
  pattern reference.
