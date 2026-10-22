# The System Layer Is Written at Closeout

> [繁體中文](system-layer-at-closeout.md) | **English**

> This page follows the source's `main` branch and may describe behavior the changelog still lists under `## Unreleased`. Your project uses the flows in its workflow bundle: if the `### 8.3 Documentation updates` section of `dflow/specs/shared/dflow-workflows/references/new-feature-flow.md` opens with "This step writes only what describes the system as built", your project already works as this page describes; if not, upgrade the CLI and run `dflow configure-agents` once.

A feature often takes several rounds before it settles, each round a phase. For a feature that carries phase-specs, its changes to the domain are written into the system layer once, at `/dflow:finish-feature`, from what the whole feature finally leaves; until then they stay in the feature directory. This page says how that works, where to find the rules still in progress, and the cases we know about and decided not to guard against.

## How it works

The **system layer** is the bounded contexts' current documents, shared across features: `glossary.md` and `context-map.md` under `dflow/specs/domain/`, and each context's `rules.md`, `behavior.md` and `models.md` (greenfield also has `events.md`).

- **Written at closeout**: for a feature that carries phase-specs, the rules and scenarios it adds, changes or removes, and its models, terms, events and relationships between contexts, are written into the system layer by `/dflow:finish-feature` Step 3 from the feature's net result. That is the only step that writes them.
- **Until then**: the in-progress state is in the feature directory — the Current BR Snapshot in `_index.md`, and each phase-spec's Business Rules, Behavior Scenarios, Delta and Domain Concepts (greenfield also Domain Events).
- **A T2 hosted under such a feature** (a `/dflow:modify-existing` lightweight-spec): writes only `analysis.md` and the tech-debt file as it goes; the rest is written with the feature at closeout.
- **Still written as the work happens**:
  - Records of the system as it is: `analysis.md` (at either of its paths), the tech-debt file, and the brownfield baseline capture. `analysis.md` is re-checked as each phase completes, so what is merged to `main` describes what was built.
  - The bounded context the feature works in: `context.md`, and that context's row and Subdomain Type in `context-map.md`, from `/dflow:new-feature` Step 2.
  - A change on a host of its own (a minimal host: standalone, the minimal follow-up variant, a post-hoc hotfix): its checkpoint 1 is that change done, and its closeout follows right after.
  - The global documents (`glossary.md` and the like) a lightweight change writes on a host that touches no bounded context: such a host's closeout runs no bounded-context sync. On such a host that carries phase-specs, closeout still writes the terms its phase-specs record into `glossary.md`.

## Where to see the rules still in progress

- Read the Current BR Snapshot in `dflow/specs/features/active/*/_index.md`. The first part of `/dflow:status` lists every unfinished feature.
- The scan at the start of `/dflow:new-feature`, `/dflow:new-phase` and `/dflow:modify-existing` reads the Snapshot of each unfinished feature in the same bounded context: when a rule this work would add or change is one such a feature already adds or changes, it stops for the developer to decide.
- When a context is missing `rules.md` or `behavior.md`, `/dflow:verify` still reports the missing file and still stops; it also names the unfinished features in that context and says their rules reach those files only at closeout, so they **may** be why. It does not claim they are: a settled file may have been lost too, so check the history before restoring or recreating one.

## Projects that merge every phase to `main`

The greenfield Trunk template suggests splitting a large feature into several phases and merging each phase to `main`. The merged code is then on `main`, but `main`'s `rules.md` shows the feature's rules only after closeout; read that feature's `_index.md` for the rules still in progress.

For a team that wants the system-layer documents to keep up with every increment merged to `main`, this approach does not fit: writing the system layer at every phase leaves unsettled rules behind when a feature is abandoned, and the system layer comes to mean "what each branch has done so far".

## Accepted risks

Each item says what can go wrong, why we do not guard against it, who bears it, and when we would reconsider.

1. **When every phase is merged to `main`, `main`'s `rules.md` does not show the rules still in progress.** Someone reading `rules.md` directly does not see them; the scan in the three flows sees those in the same context.
   - Why not guarded: making them visible on `main` means writing the system layer at every phase, which leaves unsettled rules behind when a feature is abandoned.
   - Borne by: on a Trunk project, whoever reads `rules.md` before closeout.
   - Reconsider: when a Trunk adopter reports a misreading caused by it.
2. **The bounded context the feature works in is still created as the work happens.** An abandoned feature leaves a context with no rules (its `context.md` and its `context-map.md` row).
   - Why not guarded: the modeling depth and every later phase read its Subdomain Type from there; storing it elsewhere would add a field to `_index.md`.
   - Borne by: the team that abandons the feature.
   - Reconsider: when it actually happens.
3. **`analysis.md` is still written as the work happens.** A feature abandoned halfway leaves its entries that were never re-checked. Its timing also differs from `rules.md`'s: an unfinished feature's lifecycle is already in `analysis.md` while the BRs it refers to reach `rules.md` only at closeout.
   - Why not guarded: deferring it to closeout needs a holding section, and a merge at closeout for every kind of host, including those with no bounded context; and it is re-checked as each phase completes, so before anything is merged to `main` it describes what was built.
   - Borne by: the team that abandons the feature.
   - Reconsider: when it actually happens.
4. **A feature that never closes out never reaches the system layer.** This is the intended result: only settled rules reach the system layer.
   - Why not guarded: not a defect. `/dflow:status` lists every unfinished feature.
   - Borne by: —
   - Reconsider: not needed.
5. **Technical debt is still written as the work happens.** It records the code, which is real once merged to `main`; if an abandoned feature's code is reverted, someone has to deal with that entry.
   - Why not guarded: debt follows the code; written only at closeout, debt merged to `main` would have no record.
   - Borne by: the team that abandons the feature.
   - Reconsider: when it actually happens.
6. **The scan is not full conflict detection.** It compares only the rules this work would add or change with the Snapshots of unfinished features in the same context; removed rules, rules that depend on another feature's, model and event changes, branches it cannot read, and uncommitted work are outside it.
   - Why not guarded: full detection would read every phase-spec of every unfinished feature and judge their meaning, a cost every run would pay.
   - Borne by: teams with several features in one context at once.
   - Reconsider: when it actually happens.
7. **A T2 hosted under a feature whose code is merged first and whose feature is later abandoned.** That T2's rules are only in its lightweight-spec and that feature's Snapshot, so someone reading `rules.md` does not see them; the scan helps only while the three flows run, not someone reading `rules.md` directly.
   - Why not guarded: the T2 is part of that feature; writing it into the system layer first would bring one feature's rules in at two different times.
   - Borne by: readers of that context.
   - Reconsider: when it actually happens.
