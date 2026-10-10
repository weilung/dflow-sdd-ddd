# Step 5: The Contexts a Baseline Row Records — Brownfield Progressive Extraction

Branch file of `references/finish-feature-flow.md` (brownfield only). It
**adds** the rule for which bounded contexts a `Tier = baseline` row puts in
the Integration Summary's `BC:` field; it does not restate or override
anything in that flow.

**You are here because** that flow's Step 5 sent you: this host's Lightweight
Changes has a `Tier = baseline` row. Which contexts each host shape lists in
`BC:`, and when it falls back to the context of the capture's scope, stay in
that flow's `BC:` field rules. Take what this file derives back to Step 5.

## What a baseline row derives

A `Tier = baseline` row derives, entry by entry, every context it recorded: the
context of each BC-layer document it wrote; each context a domain-root entry it
wrote names (a role-index row's Bounded Context unless it is `—`, a flow's From / To, the paths
an Affects line cites); the Bounded Context of each `glossary.md` row it wrote;
the contexts each `context-map.md` row it wrote names (a Context List row's
Bounded Context, a Relationships row's Source and Target Context); and the
context each `migration/tech-debt.md` row it wrote is about, read from
that row's Location and Description — or, when neither shows one, the context
of the capture's scope. The scope is the area the opening sentences of a
baseline minimal host's Goals & Scope name (after a follow-up's prepended
note), or a hosted row's Description. Read what the row wrote by host shape:
- **Baseline minimal host** — the `spec-baseline` commit's changes, with
  `git show` (`--stat` does not show which domain-root or glossary rows
  changed). Closeout's baseline check
  (`references/finish-feature-minimal-host.md`) guarantees only that commit's
  paths: which rows of a global document belong to this capture is held by
  its scope and by review.
- **Phase-bearing host** — the row's declared paths and its Description, not a
  commit: nothing checks that row's `Commit` cell, and one commit can carry
  other work. A hosted row may declare nothing, and a declaration names files,
  not rows: count only the entries and debt rows its Description or
  declaration identifies, and give the rest the context of the capture's scope.
