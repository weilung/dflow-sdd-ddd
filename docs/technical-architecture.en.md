# Reading Technical Architecture Before Planning Code

> [繁體中文](technical-architecture.md) | **English**

> This page follows the source's `main` branch and may describe behavior the changelog still lists under `## Unreleased`. Your project uses the flows in its workflow bundle: if `dflow/specs/shared/dflow-workflows/references/new-feature-flow.md` has a paragraph near the top that opens with "**Technical Architecture**: before any step of this flow", your project already works as this page describes; if not, upgrade the CLI and run `dflow configure-agents` once.

This page covers Greenfield only. A Greenfield project's `dflow/specs/shared/_overview.md` has a `## Technical Architecture` section (Stack, Clean Architecture Layers, Project Layout) that records the shape this project chose for its code. Dflow's flow steps, checklists and template notes are not tied to any project, so they use generic wording and common tools (for example FluentValidation, Swagger). This page says when the AI reads that section, which one wins when the two differ, what happens when a choice is not recorded, and the places we know about but decided not to guard.

## When it is read

- The flows of `/dflow:new-feature`, `/dflow:new-phase` and `/dflow:modify-existing` (`/dflow:bug-fix` runs the last one) all open with the same paragraph: before any step of the flow that designs the domain model, plans code or writes code, read the Technical Architecture section of `_overview.md` when the file exists and this session has not read it yet. A copy already in context is used as is.
- The flow file is read on every run, so T3 (a small change recorded as one row in `_index.md`) and a session that resumes from a later step are covered too.
- In modify-existing Step 1, judging the tier (Part A) does not read it yet; choosing which layer the fix lands in (Part C) is planning and reads it first. A run that leaves the flow at Part A (handed to new-feature, or judged a change that needs no tracking) does not read it.
- At closeout, when a mainline hotfix and the feature changed the same place (`finish-feature-post-hoc-hotfix.md` § Before closeout): when choosing between the two versions changes source code, it is read first, the same way; a closeout that only touches documents does not read it.
- When the project's `AI-AGENT-GUIDE.md` does not have the rule below yet (for example a guide older than its managed markers), the flow stops before designing, planning or writing code and asks the developer to bring the guide up to date; `dflow configure-agents` adds the rule once they accept the guide's managed markers.

## What it decides and what it does not

The rule is rule 6 of § Core Rules in the Greenfield `AI-AGENT-GUIDE.md`, which every session reads.

- **It decides the shape of the code**: which libraries and patterns are used, what goes in each layer, what each layer may depend on, and where code lives. When a flow step, checklist or template note says something different, Technical Architecture wins.
- **It does not decide the flow**: the steps, gates and documents to write are still decided by Dflow's flows. When `_overview.md` describes steps or gates that contradict the flow, the flow stands.
- **The Domain's dependencies stay as they were**: with no allow-list recorded in Technical Architecture, the Domain depends on nothing beyond the language/runtime baseline.

## When a choice is not recorded

A **recorded, settled choice** means Technical Architecture has that row, and the value is not blank, not a `{…}` placeholder, and not marked tentative (for example TBD or a TODO comment). When the work needs a choice that is not recorded:

1. Follow what the existing code already does consistently: after the first feature, the existing code is a choice the project has already made.
2. When the code does not settle it either (there is no code yet, or the code does it two ways), the AI asks the developer and suggests recording the answer in Technical Architecture.
3. Examples in Dflow's own wording, and examples inside placeholders (the template's Validation row says `{e.g. FluentValidation}`), never count as the project's choice.

Dflow does not write `_overview.md` for the developer: it suggests recording the answer, and the developer decides whether and how. Once recorded, later sessions do not ask again; when neither the documents nor the code keep the answer, a later session asks again.

API documentation is one example: when Technical Architecture records that the project publishes it and in what form, follow that; when it records that the project publishes none, leave it out; when it records nothing and the existing code does not settle it, ask.

## How it relates to ADRs

Technical Architecture is the summary of the current choices. When an ADR changes a choice, Technical Architecture must be updated at the same time — that is the job of whoever writes the ADR, and Dflow does not check it. When an accepted ADR the AI reads names a different choice from Technical Architecture, the AI asks the developer which one holds instead of picking one itself.

## Brownfield is not covered

Brownfield flows do not read `_overview.md`. Brownfield flows, checklists and templates hard-code the location `src/Domain/` (including the grep of `src/Domain/` in the closeout completion checks), while the Code Layout section of the Brownfield `_overview.md` asks the project to change that location to fit its stack (for example `src/{Project}.Domain/` in .NET).

- What can go wrong: in a project that moved its domain code, those greps find no files and the checks pass silently. Nobody has reported this so far.
- Why not guarded yet: how to fix it (have the flows read `_overview.md`, or resolve the location from Code Layout only where a check uses `src/Domain/`) depends on where real projects keep their domain code; we will find that out first and then decide.
- Borne by: Brownfield projects that moved their domain code; the fix is owned by Dflow's maintainer.
- Reconsider: at whichever comes first — the next upgrade of the projects Dflow's maintainer runs it on (where their domain code lives is checked then), the next change to a Brownfield rule about `src/Domain/`, or a report of a check that found no files.

## Accepted risks

Each item says what can go wrong, why we do not guard against it, who bears it, and when we would reconsider.

1. **Reading it is not the same as following it.** The rule is an instruction to the AI; no machine compares the code with Technical Architecture. Only a few checklist items look at it (the Domain allow-list, where validation sits), and the AI and reviewers judge them.
   - Why not guarded: every project records different choices in its own words; no machine comparison judges every project correctly.
   - Borne by: adopters and reviewers.
   - Reconsider: when someone reports that the AI read it but still followed the generic wording.
2. **A project without `_overview.md` relies on its existing code and on questions.** The first feature will usually ask a few questions; after that the AI follows what the existing code does consistently.
   - Why not guarded: the questions cover only choices the project has truly not made, and they stop once answered or once the first feature exists; requiring every project to create `_overview.md` would put the cost on all projects.
   - Borne by: projects without `_overview.md`.
   - Reconsider: when someone reports too many questions.
3. **The phase-spec template's notes still say EF, Controller / Minimal API and Swagger.** They are hints for sorting `Implementation Tasks` by label, not steps; the rule covers template notes as well.
   - Why not guarded: changing them means bumping the template's shape number, so every in-progress feature's phase-spec would get a migration prompt, in exchange for the wording of a sorting hint.
   - Borne by: Greenfield adopters.
   - Reconsider: when someone reports that the AI treated those notes as steps.
4. **A project with a long Technical Architecture reads more every time.** One real example is about 21 KB.
   - Why not guarded: reading only one section depends on the AI tool slicing the file, and moving it into a separate file means changing the template's shape.
   - Borne by: those projects.
   - Reconsider: when someone reports running short of context.
5. **ADRs are not read one by one.** The AI notices that an ADR disagrees with Technical Architecture only when it reads that ADR (and then it asks the developer); otherwise it follows the summary, silently.
   - Why not guarded: reading every ADR each time puts the cost on every run.
   - Borne by: adopters.
   - Reconsider: when someone reports that the AI followed an outdated summary.
6. **modify-existing Step 1 does not read it while judging the tier.** Judging the tier (Part A) is not design; choosing which layer the fix lands in (Part C) is planning and reads it first.
   - Why not guarded: judging the tier does not need the project's technical choices; reading earlier would also cost the runs that leave the flow at Part A.
   - Borne by: Greenfield adopters.
   - Reconsider: when someone reports that judging the tier needed the project's technical choices.
7. **A guide older than its managed markers does not get the rule.** `configure-agents` does not rewrite such a guide and `dflow doctor` reports it as frozen, but the workflow bundle is still updated, so the paragraph at the top of the flows is there: the flow stops before designing, planning or writing code and asks the developer to bring the guide up to date.
   - Why not guarded: we do not rewrite a file whose owner has not agreed to adopt the markers.
   - Borne by: older projects that have not adopted the markers: they add the rule once, and until then the three flows do not get as far as design.
   - Reconsider: when a project deliberately does not adopt the markers and does not want to add the rule by hand either.
8. **"Follow what the existing code does consistently" is a judgement.** When the code does it two ways, or the first feature went the wrong way and Technical Architecture does not record that choice, the AI may follow the wrong one. Choices recorded in Technical Architecture are not affected (they take precedence).
   - Why not guarded: asking whenever a choice is not recorded would mean asking every time, even about choices the code already makes consistently.
   - Borne by: adopters and reviewers.
   - Reconsider: when someone reports that the AI copied the wrong way.
