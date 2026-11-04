# When Domain Events Are Dispatched

> [繁體中文](domain-event-dispatch.md) | **English**

> This page follows the source's `main` branch and may describe behavior the changelog still lists under `## Unreleased`. Your project uses the modeling guide in its workflow bundle: if the `### Event Flow` section of `dflow/specs/shared/dflow-workflows/references/ddd-modeling-guide.md` has a sentence that opens with "**In-process handlers run after the commit.**", your project already works as this page describes; if not, upgrade the CLI and run `dflow configure-agents` once.

This page says how Dflow's DDD modeling guide (`ddd-modeling-guide.md`, shared by both editions) treats Domain Events inside one process: whether a handler runs before or after the commit, when a handler's failure has to become a business rule, what a project that already does it the other way should do, and the places we know about but decided not to guard.

It applies to Greenfield and Brownfield alike. Brownfield has no `aggregate-design.md` and no `events.md`, so it records these decisions where the guide's Edition note says: Aggregate decisions in `models.md` and `rules.md`, event failure handling in `behavior.md` or `migration/tech-debt.md`.

## Terms

- **commit**: the moment the database transaction is committed. Until then, everything saved can still be rolled back as a whole. Calling `SaveChanges` inside an outer transaction only writes the changes into that transaction; it is not a commit.
- **in-process handler**: code in the same program that runs when it receives a Domain Event (for example, updating a table that screens query, or changing another Aggregate), without going through a message queue.
- **dispatch**: handing the events an Aggregate collected to their handlers.
- **read model**: a data shape that only serves screens and queries and enforces no business rule.
- **outbox**: a table that saves the events to be published in the same transaction as the business data; they are published from that table after the commit, so an event is not lost if the program stops midway.
- **one transaction that changes several Aggregates**: one database transaction that saves changes to two or more Aggregates. It is the exception in the modeling guide's Aggregate Design Rule 2: record the business reason, the shared atomic boundary (why they can, and must, commit together), and when to re-evaluate.

## The default: dispatch after the commit succeeds

- In-process handlers run after the commit succeeds.
- A handler that changes another Aggregate saves it in a transaction of its own. If the handler fails, the first change is already committed and the failure is visible; whether it becomes a business rule is decided as in "When a handler fails" below.
- Events to other bounded contexts are also sent after the commit. With an outbox, the event rows are saved in the same commit as the business data and sent from those rows afterwards.
- Why this default: Aggregate Design Rule 2 already makes one Aggregate per transaction the default. Dispatching inside the transaction to a handler that changes another Aggregate changes two at once, and the rule that spans them hides in the handler, out of the spec's sight.

## When a handler may run before the commit

Only when what the handler writes joins the original transaction:

- **The handler changes another Aggregate**: that is one transaction changing several Aggregates, so record the reason, the shared atomic boundary and when to re-evaluate, as Rule 2 says (Greenfield: in `aggregate-design.md` § Design Decisions).
- **The handler only updates a read model**: no reason needs recording, because a read model enforces no rule. It can also run after the commit, and then the table can be briefly stale; staleness users can see goes into `behavior.md`, an edge case or a design decision.
- The test is whether the writes join the original transaction, not how many persistence contexts there are: two contexts that explicitly share one transaction count as joining it.
- **The handler writes anywhere else** (another transaction, mail, another service): run it after the commit. Before the commit, the original change can still roll back, and what was written elsewhere cannot be taken back.

Tutorial example: Greenfield walkthrough-03, where a supervisor's approve / reject both changes the expense report's status and adds an approval decision. The developer chose to save them together, and Dflow recorded the reason, the shared atomic boundary and the re-evaluation condition in `aggregate-design.md`.

## When a handler fails

- When a handler runs outside the original transaction (after the commit in the same process, or through a queue) and its final failure is business-visible, write that outcome as a business rule: a `BR-*` with its Given/When/Then in `behavior.md`, and an `EC-*` edge case in the spec. The answer may be "ops reconciles manually".
- A final failure includes retries running out, and also the event never being handled (the program stopped before dispatching, or no dispatcher is wired yet).
- It applies whether or not the handler changes another Aggregate: a notification or an audit record the business requires counts too.
- An optional notification email, logging: no BR needed; a line in `events.md` Event Flow Notes or a tech-debt entry is enough.
- A failure the business cannot see needs no BR: what is written is the business-visible final failure, not every failure.
- No dispatcher wired yet: record it as tech debt as before; an event whose handling is business-visible is written as this section says instead.

## Projects that already dispatch before the commit

- **No migration step.** A project that already dispatches inside the transaction keeps doing so. Dflow does not move the dispatch as a side effect, because that changes what commits together; when the AI notices it during other work, it tells the developer what it found, and the developer decides.
- Each new handler written afterwards that changes another Aggregate gets a one-line reason under Rule 2.
- **A project that chooses to dispatch before the commit on purpose** (for example the approach of Microsoft's eShop reference application: the side effects of one command in one transaction): Greenfield records it in the Technical Architecture section of `_overview.md` or in an ADR, and the code follows it (see [technical-architecture.en.md](technical-architecture.en.md)); Brownfield records it where the project keeps architecture decisions, as the Edition note says. Each handler that changes another Aggregate still gets a one-line reason under Rule 2: Rule 2's reason is the business reason for that one operation, while a project-level decision can only explain the mechanism.

## Two other changes

- **The dispatcher example no longer names MediatR.** The guide says a hand-written dispatcher, or the mediator the project already uses. Which one is the project's technical choice, recorded in Technical Architecture for Greenfield; MediatR 13 and later require a license key, see [examples-by-stack.md](examples-by-stack.md).
- **The checklists compare against the events the spec lists (Greenfield).** The event item in `/dflow:new-feature` Step 7 and in the PR checklist checks that the events the spec lists are raised in the code: listed but not raised fails; not listed is not required. Which events to raise is decided while modeling, by the guide's § When to Use Domain Events and § Subdomain-Aware Modeling Depth: a core context lists the full catalog, a supporting one only the events actually needed, a generic one usually none.

## Accepted risks

Each item says what can go wrong, why we do not guard against it, who bears it, and when we would reconsider.

1. **Writing it down is not the same as following it.** The default is an instruction to the AI, not a check that stops anything; no machine reads the code to tell whether a handler runs inside or outside the transaction. The PR checklist's Risk-Triggered Modeling Review sends a change to a handler or a delivery expectation back to these sections of the guide, and the AI and reviewers judge it.
   - Why not guarded: telling requires reading the code, and a machine cannot judge it reliably.
   - Borne by: adopters and reviewers.
   - Reconsider: when someone reports that the AI still dispatches inside the transaction without recording a reason.
2. **Without an outbox, events can be lost.** If the program stops after the commit and before dispatch, the handler never runs and the other Aggregate never catches up. The guide counts this under "When a handler fails": a business-visible outcome gets a BR, whose answer may be manual reconciliation; an outbox remains a later upgrade.
   - Why not guarded: an outbox is a piece of infrastructure for every project (a table, forwarding, cleanup).
   - Borne by: projects that follow the default without an outbox.
   - Reconsider: when someone reports a lost event with a business-visible consequence.
3. **A project whose code differs from the default is silent about it.** A project that already dispatches inside the transaction keeps doing so; new cross-Aggregate handlers get a Rule 2 reason, the earlier ones have none on record.
   - Why not guarded: Dflow does not rewrite a user's existing code and documents.
   - Borne by: those projects.
   - Reconsider: when someone reports that the AI moved the dispatch as a side effect, or asks for reasons to be filled in for existing handlers.
4. **"Only updates a read model" is a judgment.** When a handler that runs inside the transaction, said to update a read model, actually guards a rule (for example a quota table), that table is an Aggregate and Rule 2 applies. The guide only states the test: a read model enforces no rule.
   - Why not guarded: whether the table guards a rule depends on the business, which a machine cannot tell.
   - Borne by: adopters and reviewers.
   - Reconsider: when someone reports a rule-guarding table treated as a read model.
5. **A project that dispatches before the commit records a reason for every cross-Aggregate handler.**
   - Why not guarded: Rule 2's reason is the business reason for that one operation; a project-level ADR can only explain the mechanism and cannot stand in for it.
   - Borne by: those projects (one line per handler).
   - Reconsider: when someone reports that the line has become copied boilerplate.
6. **Now that the checklists compare against the spec, a core context whose spec misses an event goes unnoticed at Step 7.** Which events to raise is decided while modeling.
   - Why not guarded: an extra check of event completeness by context type would add one more judgment to every Step 7 and every PR check.
   - Borne by: adopters and reviewers.
   - Reconsider: when someone reports a core context missing events.
7. **A handler that runs before the commit but writes elsewhere stays as it is in an existing project.** The guide tells the AI to tell the developer and not to move it as a side effect; until the developer acts, if the original transaction rolls back, what that handler already wrote elsewhere remains.
   - Why not guarded: Dflow does not rewrite a user's existing code.
   - Borne by: those projects.
   - Reconsider: when someone reports data that no longer matches because of it.
