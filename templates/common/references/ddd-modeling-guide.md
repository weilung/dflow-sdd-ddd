# DDD Modeling Guide

When a developer asks "How should I model X?" or is designing domain structures,
use this guide to walk them through DDD tactical patterns.

> **Edition note — where to record decisions.** The artifact names below are the
> Greenfield spec surfaces (`aggregate-design.md` worksheet, `events.md`, ADRs
> under `architecture/decisions/`). Brownfield projects do not seed those, so
> record the same decision on the surface you have:
>
> - **Aggregate / invariant design** → the `models.md` Aggregate-Root Entity row
>   + `rules.md` (Brownfield has no separate `aggregate-design.md` worksheet —
>   do not invent one).
> - **Event contracts / failure-path notes** → `behavior.md` (as a `BR-*`
>   scenario) and/or `migration/tech-debt.md` (Brownfield has no `events.md`).
> - **Event Sourcing / architecture decisions** → an existing ADR or migration
>   plan if the project already has one; otherwise `migration/tech-debt.md`
>   § Follow-up Notes and/or the target-architecture strategy section of
>   `_overview.md`.
>
> The tactical patterns themselves are identical across editions; only the
> recording surface differs.

## The Modeling Conversation

Start with the business, not the code:

```
"Let's forget about databases and classes for a moment.
Tell me: what are the rules? What must always be true?
What can never happen?"
```

These invariants drive the entire model design.

## Subdomain-Aware Modeling Depth

Before choosing tactical patterns, decide *how much* DDD this Bounded Context
deserves. Not every context earns a rich domain model — over-modeling a
commodity capability is as wasteful as under-modeling a core one.

Classify the context (recorded as **Subdomain Type** in
`dflow/specs/domain/context-map.md`). The discriminator: **"if you replaced
this with an off-the-shelf SaaS / package, would the system's differentiation
disappear?"** (For internal systems "differentiation" means a unique
operational advantage or mission outcome, not only competitive edge.)

- **Core** — yes, it would disappear. This is the differentiator.
- **Supporting** — no, but it still needs customization to your process.
  Necessary, often customized, not a differentiator.
- **Generic** — no, and off-the-shelf options exist (auth, notifications,
  file upload, audit log are common examples).

Rule of thumb against inflation: most contexts are *supporting*; *core* is
usually only one or two. If everything is core, you haven't classified.

Modeling depth follows the type:

| Subdomain | Modeling depth | aggregate-design worksheet | Domain Events |
|---|---|---|---|
| core | **Full** — rich model, full invariants, the patterns below | required for a new Aggregate | full catalog |
| supporting | **Standard** — a sufficient model, avoid speculative abstraction | created but kept lean for a new Aggregate | events that are actually needed |
| generic | **Minimal** — thin wrapper / CRUD / off-the-shelf package behind an interface (ACL seam) | **not created** | usually none (adapter-boundary events excepted) |

**Precedence.** This subdomain-aware depth *refines / caps* the structural
DDD Modeling Depth in `AI-AGENT-GUIDE.md` § Ceremony Scaling and
`_conventions.md`: when the structural rule says "new Aggregate / BC → Full"
but the subdomain says Standard / Minimal, follow the **shallower sufficient
depth** — unless the developer explicitly chooses to model deeper and records
why (in the context-map Notes or the `aggregate-design.md` Design Decisions).

**What "shallower" does NOT mean** — three boundaries the classification must
never cross:

1. **Business rules are not exempt.** A generic context's rules still get a
   BR-ID in `rules.md` and a scenario in `behavior.md`; `/dflow:verify` works
   the same. What shrinks is the *domain model's thickness*, not the spec's
   existence.
2. **The Tier system is unchanged.** A bug fix in a generic context is still a
   T2; a new feature still runs the flow. Subdomain governs *how deep to model
   a context*; Tier governs *how much ceremony a single change needs* — they
   are orthogonal.
3. **Criticality is not downgraded.** Security, tests, SLA, audit,
   permissions, and data integrity do **not** drop with the subdomain type —
   auth or notifications can be generic *and* mission-critical. Generic lowers
   the modeling investment, nothing else.

## Pattern Selection Flowchart

```
Is it identified by an ID that persists over time?
    │
    ├─ Yes → Is it the "boss" that protects a consistency boundary?
    │   ├─ Yes → AGGREGATE ROOT
    │   └─ No  → ENTITY (belongs inside an Aggregate)
    │
    └─ No → Is it defined entirely by its properties?
        ├─ Yes → VALUE OBJECT
        └─ No  → Does it represent an operation spanning multiple Aggregates?
            ├─ Yes → DOMAIN SERVICE
            └─ No  → Re-examine — it's probably one of the above
```

A stateful multi-step flow is not a Domain Service — see "Long-Running
Processes".

## Aggregate Design

Aggregates are the most important and most commonly misunderstood DDD concept.

### What is an Aggregate?

A cluster of objects treated as a single unit for data changes. The Aggregate Root
is the only entry point — outside code cannot reach inside and modify child entities
or value objects directly.

### Aggregate Design Rules

1. **Protect invariants** — The Aggregate exists to enforce business rules that span
   multiple objects within it.

2. **One Aggregate per transaction** — A single operation should modify only ONE
   Aggregate. If you need to modify two Aggregates, use Domain Events for eventual
   consistency.

3. **Reference other Aggregates by ID only** — Never hold a direct object reference
   to another Aggregate. Store its ID instead.

4. **Keep them small** — Large Aggregates cause concurrency issues. If two users can
   independently modify different parts, those parts should probably be separate Aggregates.
   Watch the time axis too: a child collection that grows without bound over the
   Aggregate's lifetime (audit trail, comments, history) makes every load heavier and
   every save more contended — split it out and reference by ID.

### Example: Expense Report Aggregate

```csharp
// ExpenseReport is the Aggregate Root
public class ExpenseReport : AggregateRoot
{
    private readonly List<ExpenseLineItem> _lineItems = new();

    public EmployeeId SubmittedBy { get; private set; }   // Reference by ID
    public ReportPeriod Period { get; private set; }       // Value Object
    public Money TotalAmount => CalculateTotal();          // Derived
    public ReportStatus Status { get; private set; }       // Value Object (enum-like)

    // State change through explicit methods — not property setters
    public void AddLineItem(string description, Money amount, ExpenseCategory category)
    {
        // Enforce invariants
        if (Status != ReportStatus.Draft)
            throw new DomainException("Cannot add items to a submitted report.");

        if (_lineItems.Count >= 50)
            throw new DomainException("Maximum 50 line items per report.");

        var lineItem = new ExpenseLineItem(description, amount, category);
        _lineItems.Add(lineItem);

        // Raise domain event
        AddDomainEvent(new LineItemAddedEvent(Id, lineItem.Id, amount));
    }

    public void Submit()
    {
        if (Status != ReportStatus.Draft)
            throw new DomainException("Only draft reports can be submitted.");

        if (!_lineItems.Any())
            throw new DomainException("Cannot submit an empty report.");

        Status = ReportStatus.Submitted;
        AddDomainEvent(new ExpenseReportSubmittedEvent(Id, SubmittedBy, TotalAmount));
    }
}
```

### Design Questions to Ask

When designing a new Aggregate:

1. **What are the invariants?** What business rules must ALWAYS be true?
   (Classify each one — see "Invariant Classification" below.)
2. **What's the consistency boundary?** What must be updated atomically?
3. **What can change independently?** Separate Aggregates for separate concerns.
4. **Who modifies this?** How many concurrent users? (Affects Aggregate size)
5. **What events does this produce?** What other parts of the system need to know?
6. **Will any child collection grow without bound over time?** (history,
   comments, audit entries) Unbounded growth is a split signal — move it to
   its own Aggregate or a read model and reference by ID.
7. **What would make this boundary wrong?** Record the answer in the
   worksheet's Design Decisions as a re-evaluation condition ("revisit
   when …") — it is what "Revising an Established Model" re-reads later.

### Invariant Classification

Not every `if (…) throw` is an Aggregate invariant. Before adding a rule to an
Aggregate design, ask: **how many objects' state must you see at once to check
this rule?**

1. **Local constraint (VO / Entity invariant)** — checkable inside a single
   object. Route it by nature:
   - Pure input shape (required, format, max length) → request validation in
     the Application layer (e.g. a Validator).
   - Domain meaning, even within one object → enforce it in the Value Object /
     Entity constructor or method. `DateRange` rejecting `Start > End` (see
     the Value Objects section below) is a **domain invariant**, not input
     validation — it lives in the VO so an invalid range can never exist.
2. **Aggregate boundary invariant** — requires the state of **multiple objects
   inside one Aggregate instance** ("total across all line items must not
   exceed the limit", "cannot submit an empty report"). These are the reason
   the boundary exists — they are the main entries of an `aggregate-design.md`
   Invariants table.
3. **Set-based invariant** — spans **multiple Aggregate instances** selected
   by a key or status ("email unique across all Users", "one active session
   per connector"). The Aggregate alone can never enforce it; list it tagged
   `set-based` with its store-level guard named, and see "Set-Based /
   Uniqueness Invariants" below.

Mis-filing level 1 rules into the Invariants table dilutes it — reviewers can
no longer see why the boundary exists. Missing the store-level guard on a
level 3 rule ships a race condition.

### Set-Based / Uniqueness Invariants

Some invariants are not about one Aggregate but about a **set selected by a
business key or status**: "email (normalized) is unique across all Users", "each
seat holds at most one active booking", "each connector has at most one
in-progress charging session". A single Aggregate instance cannot see the rest of
that set, so it cannot enforce the rule on its own.

Handle them the same way **regardless of which Aggregate boundary you choose**:

1. **As separate Aggregates** (e.g. `User` and `Booking` are distinct): the
   Application layer *orchestrates* the check — via a repository query, a
   Specification, or a domain service (the rule stays domain-named; it is not an
   inline `if-else` in the command handler) — and the **database enforces it with
   a unique / partial (filtered) unique index**. The DB constraint is the real
   guarantee under concurrency; the orchestrated check just returns a friendlier
   error first.

2. **Folded into one Aggregate** (e.g. the active session lives *inside* a
   `Connector` as a child entity): the in-memory check (`if (Status == InUse)
   throw …`) is logically correct, **but is still not concurrency-safe by
   itself**. Two concurrent commands can each load the Aggregate, both pass the
   check, and both save. Close the race with **optimistic concurrency** (a
   `rowversion` / version token on the Aggregate root) or a DB constraint — but
   the version check only protects you if every save actually touches the root's
   token: inserting a child row without bumping the root's version leaves the
   race open. Translate the resulting concurrency exception / unique violation
   into a meaningful business conflict (e.g. HTTP 409), not a generic 500.

**Key point:** an in-memory check — at *any* layer — is never the final guarantee
for a uniqueness / "only one active X" rule under concurrent requests. The durable
enforcement is a DB unique / filtered index, an optimistic-concurrency token, or
an equivalent conditional write / compare-and-swap. Pick the Aggregate boundary on
modeling grounds (does the inner thing have an independent lifecycle / history
worth querying?), then add the store-level guard either way. (Heavier
serialization tactics — distributed locks, per-key actors, aggregate-per-key
sharding — exist but are advanced; reach for a store-level constraint or version
check first.)

## Revising an Established Model

The sections above are about getting a boundary right the first time. This
one is about the other half of a model's life: an established model whose
original decision was right — until the conditions changed. **A recorded
design decision is not settled law.** It is a decision *plus the conditions
under which it was right*; when those conditions expire, the decision is
due for review, not deference.

### The re-read rule

**When extending an existing Aggregate, re-read its recorded Design
Decisions before adding to it** (the `aggregate-design.md` worksheet;
Brownfield — see the Edition note). You are not reading for format — you
are checking two things:

1. Does any recorded **re-evaluation condition** ("revisit when …") match
   the change in front of you?
2. Did the original rationale assume something that is no longer true?

### Signals that the model is resisting

Any of these appearing in your change is a signal — go to the ladder below:

- **Bending a field to fit** — a field that was previously required by the
  entity's lifecycle is made nullable to fit a new case.
- **Discriminator creep** — adding a `Purpose` / `Type` discriminator so
  one entity carries materially different lifecycles, required fields, or
  rules.
- **Stacking another branch** — a third or later *distinct business branch*
  on the same decision axis (validation / error variants don't count; the
  count is an anchor, not an automatic refactor rule).
- **Qualifying a term to use it** — you keep saying "the Order here means
  the cart-order"; one glossary term now covers two lifecycles.
- **A recorded re-evaluation condition matches** the current change.
- **Cross-instance transaction pressure** — a new invariant or operation
  needs same-transaction writes across Aggregate instances because the
  current boundary cannot own the rule (see Aggregate Design Rules #2; a
  flow over *time* is a different topic — see "Long-Running Processes").
- **A child collection grows without bound** — the split signal from
  Aggregate Design Rules #4 and Common Mistakes #7 applies to established
  models too.

### What to do when a signal fires — take the lowest rung that fits

1. **Name it in the spec** (mandatory when a signal fires; zero design
   cost). One short passage in the spec's design decisions / open
   questions: which signal fired, the options, and the decision —
   **proceed as-is, split, or rename — with the reason**. Deciding *not*
   to split, recorded, is a perfectly good outcome when the rationale
   still holds. What is not acceptable is extending the model as if the
   question did not exist.
2. **Treat the revision as its own change** when the answer is "split" or
   "rename": record it as tech debt or a follow-up feature — or, if the
   feature cannot proceed sanely on the old boundary, make the split /
   rename the feature's first phase (T1 ceremony; the glossary moves
   first, RENAMED deltas, code follows).

Two guards, so this section cannot become its own kind of
over-engineering:

> Signals are the trigger, not a schedule. Do not re-litigate the model on
> every touch: no signal → no ceremony; one signal → name it; several
> signals, or a matched re-evaluation condition → evaluate seriously.

> A signal triggers **review, not redesign**. Do not split or rename just
> because a signal fired. A short recorded decision to keep the current
> model is a valid outcome when the rationale still holds.

This applies where a model exists to revise — core / supporting contexts.
A generic context's thin wrapper (see "Subdomain-Aware Modeling Depth")
has no worksheet and needs none of this ceremony.

## Value Objects

### When to Use Value Objects

If the answer to ALL of these is "yes", it's a Value Object:
- Is it defined by its properties, not by an ID?
- Is it immutable once created?
- Can two instances with the same properties be considered equal?

### Common Value Objects

```csharp
// Money — the classic example
public record Money(decimal Amount, Currency Currency)
{
    public static Money Zero(Currency currency) => new(0, currency);

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new CurrencyMismatchException(Currency, other.Currency);
        return new Money(Amount + other.Amount, Currency);
    }

    public Money ConvertTo(Currency target, ExchangeRate rate)
    {
        return new Money(rate.Convert(Amount), target);
    }
}

// DateRange
public record DateRange
{
    public DateOnly Start { get; }
    public DateOnly End { get; }

    public DateRange(DateOnly start, DateOnly end)
    {
        if (start > end) throw new DomainException("Start must be before End.");
        Start = start;
        End = end;
    }

    public bool Contains(DateOnly date) => date >= Start && date <= End;
    public int Days => End.DayNumber - Start.DayNumber + 1;
}

// Currency (constrained string)
public record Currency
{
    public string Code { get; }
    public int DecimalPlaces { get; }

    public static readonly Currency TWD = new("TWD", 0);
    public static readonly Currency USD = new("USD", 2);
    public static readonly Currency JPY = new("JPY", 0);

    private Currency(string code, int decimalPlaces)
    {
        Code = code;
        DecimalPlaces = decimalPlaces;
    }

    public decimal Round(decimal amount) =>
        Math.Round(amount, DecimalPlaces, MidpointRounding.AwayFromZero);
}
```

### Value Object Design Questions

1. **Does it have behavior?** Good VOs have methods, not just properties.
2. **Does it enforce constraints?** Constructor should reject invalid states.
3. **Is it reusable?** `Money` can be used across many Aggregates.

### Strong-Typed IDs and Domain Primitives

**IDs should be strong-typed.** Use a typed id (`ExpenseReportId`, `EmployeeId`
— the examples above already do) instead of a raw `Guid` / `int` / `string`, so
the compiler rejects passing one Aggregate's id where another's is expected.

```csharp
// Raw: both are Guid — swap them and the compiler stays silent
void Transfer(Guid from, Guid to, Money amount)

// Typed: passing a CustomerId where an AccountId is expected won't compile
void Transfer(AccountId from, AccountId to, Money amount)
```

A typed id is a **Value Object wrapping the identifier value** — a
value-by-identity special case — not the Entity it identifies. (So it does not
contradict the Pattern Selection flowchart's "identified by an ID → Entity":
that question is about the *concept*; this is about giving the *id value* a type.)

**For other primitives, wrap only when the value carries a rule** — a format
(`Email`), a unit (`Money`, `Weight`), a constrained comparison / value semantic
(`DateRange` with start ≤ end), or an **allowed value set / constrained
vocabulary / domain code** (the `Currency` constrained string and the
`ReportStatus` enum-like value above are exactly this). A plain rule-less
`string` / `int` should **not** be wrapped — that is over-engineering. The point
of wrapping a primitive is to **bind a rule to the type**; with no rule, there is
no reason to wrap.

## Domain Events

### What Are Domain Events?

Something that happened in the domain that other parts of the system care about.
Past tense naming: `ExpenseReportSubmitted`, `LineItemAdded`, `ReportApproved`.

> **Not event sourcing.** Dflow's Domain Events are state-change
> *notifications* — the Aggregate's persisted state stays the source of truth,
> and events are never replayed to rebuild it. Adopting event sourcing is a
> separate, heavyweight architecture decision: if genuinely needed, record it
> as an ADR (`dflow/specs/architecture/decisions/`; Brownfield — see the
> Edition note); never introduce it as a side effect of modeling.

### When to Use Domain Events

- When one Aggregate needs to trigger changes in another Aggregate
- When side effects (email, notification, audit log) should happen after a domain action
- When different Bounded Contexts need to communicate

### Event Design

```csharp
public record ExpenseReportSubmittedEvent(
    ExpenseReportId ReportId,
    EmployeeId SubmittedBy,
    Money TotalAmount
) : IDomainEvent;
```

### Payload Guideline

Default to a **thin payload**: the IDs involved, the fact that happened, and
the values that changed — not a snapshot of the whole Aggregate.

- Same-context consumers that need more state should load it by ID — a fat
  payload is a stale copy the moment it is published.
- Across Bounded Contexts, every field you publish is something downstream may
  start depending on — a fat payload becomes an implicit contract. If a
  consumer genuinely needs state transfer, make that an explicit **integration
  event** decision (record the Delivery expectation in `events.md`; Brownfield —
  see the Edition note) and treat
  the payload as a published contract: add fields if you must, never change
  their meaning. Ceremony-wise, extending an event payload that crosses
  contexts is a T1 contract change (see the ceremony examples in
  `_conventions.md`).

### Event Flow

```
1. Aggregate method called → state changes → event added to DomainEvents list
2. Repository saves Aggregate
3. After save (in same transaction or via outbox):
   - In-process handlers: update read models, trigger other commands
   - Cross-context: publish to message queue
```

### Event Handling Guidelines

- **Same Bounded Context**: Handle synchronously (same transaction OK for read models)
- **Cross Bounded Context**: Handle asynchronously (eventual consistency)
- Event handlers should be idempotent (safe to process multiple times)
- **The failure path is a business scenario, not a technical detail**: when a
  cross-Aggregate chain is async (eventually consistent) **and** a handler's
  final failure — after retries are exhausted — would be business-visible
  (compensation, customer entitlements, money, inventory, compliance, manual
  reconciliation), write that outcome as a `BR-*` with its own Given/When/Then
  in `behavior.md` and list the failure as an `EC-*` edge case in the spec —
  even if the documented answer is "ops reconciles manually". Best-effort side
  effects (notification email, logging) don't need a BR; a line in `events.md`
  Event Flow Notes or a tech-debt entry is enough.
- **Dispatch / clear lifecycle**: clear `DomainEvents` at the Repository / Unit
  of Work **save boundary** — the UoW clears them *after* the save succeeds and
  the events have been dispatched (or the outbox row persisted, or dispatch
  explicitly decided to be dropped/deferred). Never clear inside an Aggregate
  method, and never before the save succeeds. A simple in-process dispatcher
  (e.g. `IPublisher` / MediatR) is enough for Phase 1; an **outbox /
  integration-event bridge is the Phase 2+ upgrade** for reliable cross-service
  delivery. If no dispatcher is wired yet, record it as deferred tech debt — but
  still clear on a successful save so events cannot accumulate unbounded.

## Long-Running Processes

The Aggregate design rules above already cover the simple case: one Aggregate
per transaction, with cross-Aggregate work flowing through Domain Events and
eventual consistency. This section is for the flows where that is not the
whole story — where the multi-step flow is itself a business thing with
state, and that state needs a home.

### Process or event chain?

Use an event chain when each reaction can succeed or fail independently — a
later failure does not change the earlier domain commitment. Treat the flow
as a **process** when the business must track and decide the multi-step
**outcome**: compensate or reverse an earlier commitment, answer current
progress, enforce a deadline, or enforce an ordered cross-Aggregate workflow
whose intermediate state matters.

The quickest entry test: **if a later step fails, must an earlier step be
undone?** "Payment failed → release the reserved stock" is a process, not an
event chain.

Further signals that the flow is a process:

- The business asks "where is order #123 in the flow?" and no single
  Aggregate can answer.
- A deadline is part of the rules ("if payment is not confirmed within 30
  minutes, release the seats").
- Steps across Aggregates must run in a prescribed order **and** the
  intermediate state matters to the business — being ordered by itself is
  not enough.

**Not a process:** fire-and-forget notifications, read-model updates,
logging, and other best-effort side effects — even when ordered, even when
they cross Aggregates. Those remain plain event chains; their failure
handling is already covered by the failure-path guideline under Event
Handling Guidelines.

### Where does the process state live? Take the lowest rung that fits

1. **A status field on the Aggregate that owns the flow** — the first choice
   when the process is naturally part of one Aggregate's lifecycle:
   `Order.Status = PendingPayment → Paid → Shipped`. Event handlers advance
   the status; each compensation is an explicit state-transition method
   (`order.Cancel(reason)`) with its own BR. Most mid-size flows stop here.
   The boundary: a status field is enough only when the process is naturally
   part of that Aggregate's lifecycle — do not store every downstream
   system's bookkeeping on the owner just to avoid a process Aggregate.

2. **A dedicated process Aggregate** (the DDD shape of a *process manager*) —
   when the coordination belongs to no existing Aggregate, or the flow needs
   its own bookkeeping (steps completed, retries, deadline): a small
   Aggregate (e.g. `OrderFulfillment`) whose state *is* the flow's progress.
   It reacts to events, issues commands, and its invariants are process
   rules ("cannot ship before payment is confirmed"). It is an ordinary
   Aggregate — same aggregate-design worksheet, same Invariants table,
   events cataloged in `events.md` like any other (Brownfield — see the
   Edition note). Two boundaries: a process Aggregate **coordinates
   progress** — it does not pull the participating Aggregates into one
   transaction or take over their invariants. And do not create one for a
   two-step event reaction with no compensation, no deadline, and no
   business-visible progress to answer — keep that as an event chain, or as
   the owner Aggregate's normal state if it already has one.

3. **An orchestration framework / workflow engine** — the Phase 2+ upgrade,
   worth it only at operational scale (versioning long-lived in-flight
   flows, visibility dashboards). Like event sourcing, this is a separate,
   heavyweight architecture decision: record it as an ADR if genuinely
   needed; never introduce it as a side effect of modeling.

### Compensation is business behavior, not plumbing

A compensating action is not a rollback — the mail was sent, the money
moved; they cannot un-happen. Compensation is a **new domain fact**
(`RefundIssued`, `ReservationReleased`) with its own BR and Given/When/Then
in `behavior.md`. The failure-path guideline under Event Handling Guidelines
says *which* final failures must become BRs; this section says *where the
logic that answers them lives*.

### Deadlines

A deadline is part of the process state. Detecting expiry is infrastructure
(a scheduled check), but the decision — "expired → release the seats" — is a
domain rule, expressed as a domain event (`BookingExpired`) and handled like
any other.

Two search terms, so you can find the literature: *choreography* is a plain
event chain; *orchestration* means an explicit process owner. These are
search terms, not a framework choice.

## Specifications

For complex query logic that belongs to the domain:

```csharp
public class PendingApprovalSpec : Specification<ExpenseReport>
{
    private readonly EmployeeId _approverId;

    public PendingApprovalSpec(EmployeeId approverId)
    {
        _approverId = approverId;
    }

    public override Expression<Func<ExpenseReport, bool>> ToExpression()
    {
        return report =>
            report.Status == ReportStatus.Submitted &&
            report.ApproverId == _approverId;
    }
}
```

## Read Models (Query Side)

The **write side** goes through an Aggregate (to protect invariants). The
**read side** usually should not. Lists, reports, dashboards, dropdowns — work
that only *displays* data — can query a denormalized projection / DTO directly,
without loading an Aggregate and without going through the Domain layer.

```csharp
// Don't: load 50 full Order Aggregates (each pulling line items, status
// history, …) just to render an order list → object-graph bloat, N+1
var orders = orderRepository.GetAll();

// Do: project only the columns the screen needs straight into a DTO
//   SELECT OrderNumber, CustomerName, Total, OrderDate FROM Orders
//   → IReadOnlyList<OrderListItemDto>
```

**When to still go through the Aggregate**: when you read in order to *change*
(read-modify-write). "Cancel order #123" must enforce "cannot cancel a shipped
order" → load the `Order` Aggregate, call `order.Cancel()`, save. Pure display →
read model; about to mutate → Aggregate.

**Read Model vs Specification**: a `Specification` is a domain predicate /
write-side decision — it carries a rule (see "Specifications" above). A read
model is a presentation / reporting query shape that carries **no** invariant.
Don't conflate them.

**Keep it simple.** This is the query side of CQRS — it does **not** require
event sourcing or a separate database. Two common shapes:

- A **live query DTO against the same database** — always fresh; the simplest
  and most common read model.
- An **event-updated denormalized table** — can be **stale**. If that staleness
  is user-visible (e.g. a just-placed order missing from the list for a moment),
  say so in `behavior.md` / an edge case / a design decision. This is the same
  mechanism as the "same-transaction read model update" note under Event
  Handling Guidelines.

A read model is a *simplification* of the read path, not an extra layer to
build. (Read model ≠ event sourcing.)

## Domain Services

Use Domain Services for operations that:
- Involve multiple Aggregates (read-only access to the second Aggregate)
- Require external information (through interfaces) to make domain decisions
- Don't naturally belong to any single Entity

A Domain Service can make a **stateless** cross-Aggregate decision. It is
not a home for process progress, retries, deadlines, or compensation state.
When the flow has state, use the "Long-Running Processes" ladder.

```csharp
// Domain Service — in Domain layer
public class ExpenseApprovalService
{
    private readonly IApprovalPolicyRepository _policyRepo;

    public ApprovalResult Evaluate(ExpenseReport report, ApprovalPolicy policy)
    {
        if (report.TotalAmount.Amount > policy.AutoApprovalLimit)
            return ApprovalResult.RequiresManagerApproval;

        if (policy.RestrictedCategories.Overlaps(report.Categories))
            return ApprovalResult.RequiresComplianceReview;

        return ApprovalResult.AutoApproved;
    }
}
```

## Factories

When *creating* an object is itself complex — many parts to assemble, an
implementation type to choose, or creation rules that span several objects —
don't cram it into the constructor. Pick the lightest tool that fits:

- **Simple construction → the constructor.** A `new` whose constructor enforces
  the object's own invariants is enough. Don't add a factory just to have one.
- **Creating a child entity / needs the Aggregate's internal state → a factory
  method on the Aggregate Root** (e.g. `order.AddLine(...)` — the root stays in
  control of its invariants).
- **Complex creation across several objects / choosing an implementation type →
  a standalone Factory** (or a Domain Service).

### Reconstitution ≠ creation

The blind spot is the other half of an object's lifecycle: **rebuilding an
existing object from persistence is not creating a new one.** Reconstitution
must **not** run the creation workflow, **not** re-raise creation events, and
**not** reject old data just because a *new* creation rule was added later.

```csharp
// Creation: this Order comes into existence for the first time
var order = Order.Create(customerId, items);
//   → assigns a new OrderId, checks "at least one line",
//     raises OrderPlaced (which sends mail, decrements stock)

// Reconstitution: the same Order loaded back next week
var order = repository.GetById(orderId);
//   → must NOT raise OrderPlaced again (mail re-sent, stock re-decremented)
//   → must NOT be rejected by a creation rule added after it was placed
```

ORMs reconstitute through a backing / `private` constructor; reserve the
`Create(...)` factory path for genuinely new instances.

**But "reconstitution validates nothing" is the wrong reading.** Structural /
version-compatibility invariants can and should still be checked on hydration;
genuinely corrupt or legacy-incompatible data should be routed to migration or
quarantine, not silently accepted. What you drop is *re-running the creation
workflow and its side effects* — not *integrity*.

## Bounded Context Relationships

If `dflow/specs/domain/context-map.md` does not exist yet, create it from `templates/context-map.md` before documenting relationships.

Document in `dflow/specs/domain/context-map.md`:

| Relationship | Pattern | Example |
|---|---|---|
| Context A calls Context B | Customer-Supplier | Expense → HR (get employee info) |
| Contexts share data | Shared Kernel | Currency, Money in SharedKernel/ |
| Context A translates B's language | Anti-Corruption Layer | Expense → External Accounting System |
| Fire and forget | Domain Events | Expense → Notification (report submitted) |
| Two contexts have no compelling reason to integrate | Separate Ways | Shipping vs Marketing each keep their own product fields |
| Integrating with an unmodeled legacy region | Big Ball of Mud (+ ACL) | a new Order context wrapping a legacy accounting module |

The less-obvious three — when to reach for them:

- **Separate Ways** — when integration cost > duplication cost **and** the "shared"
  concept isn't actually the same thing in both contexts: don't build an ACL or a
  Shared Kernel, just duplicate the small overlap; revisit only if the duplication
  painfully diverges later. (Counters "integrate because DDD".) **Do NOT** use
  Separate Ways when one context genuinely needs the other's authoritative
  lifecycle, fresh state, workflow coordination, or invariant protection — that is
  required integration, not a duplication candidate.
- **Big Ball of Mud (+ ACL)** — when a region has no coherent model (often legacy)
  and you must integrate with it: mark it `BBoM` on the context map, wrap it behind
  an Anti-Corruption Layer, and translate at the boundary so its (lack of) structure
  can't leak into your clean contexts — don't try to model the mud in place. In
  Brownfield extraction, the legacy you are pulling away from is usually this.
- **Open Host Service (OHS)** — when **many** downstream contexts need the same
  integration from one upstream, publish a single Open Host Service with a Published
  Language (a documented, stable protocol) instead of each consumer integrating
  separately. OHS standardizes the upstream's published surface; it does **not**
  remove a consumer-side ACL where that consumer still needs local translation.

## Common Mistakes to Catch

1. **Anemic Domain Model** — Entities with only getters/setters, all logic in services
   → Move behavior INTO the Entity/Aggregate

2. **Too-large Aggregates** — Aggregate that loads entire object graph
   → Split into smaller Aggregates, reference by ID

3. **Business logic in Application layer** — If-else rules in command handlers
   → Move to Domain (Entity methods or Domain Services)

4. **Business logic in Infrastructure** — Rules in SQL queries or EF configurations
   → Domain defines WHAT, Infrastructure defines HOW

5. **Direct cross-Aggregate modification** — One command modifying two Aggregates
   → Use Domain Events for the second Aggregate

6. **Set-based invariant guarded only in memory** — A "unique" / "only one active"
   rule enforced solely by an in-app check, with no DB unique constraint or
   optimistic-concurrency token → two concurrent requests can both pass and break it
   → Back it with a DB constraint / `rowversion`; see "Set-Based / Uniqueness Invariants"

7. **Unbounded collection inside an Aggregate** — A child list that grows forever
   (history, comments, audit trail) makes every load heavier and every save more
   contended → Split it into its own Aggregate or a read model, reference by ID

8. **Fat event payload as implicit contract** — Publishing whole-Aggregate
   snapshots couples consumers to your internal shape and hands them stale data
   → Default to IDs + event facts + changed values; cross-context state transfer
   must be an explicit integration-event contract (see "Payload Guideline")

9. **Creation validation / events re-run on reconstitution** — Loading an
   existing Aggregate from the database through the creation path re-raises
   creation events (re-sends mail, re-decrements stock) or rejects valid old data
   by a newer creation rule → Reconstitute through a backing constructor; keep
   integrity checks but not the creation workflow; see "Reconstitution ≠ creation"

10. **Forcing every query through repository + Aggregate** — Loading full
    Aggregates just to display a list / report causes object-graph bloat and N+1
    → Use a read model (denormalized projection / DTO) for the display path; see
    "Read Models (Query Side)"

11. **Compensation logic scattered across event handlers** — Each handler
    patches state on its own; no one owns the process, and nobody can answer
    "where is order #123 in the flow"
    → Give the process a home (a status field on the owning Aggregate or a
    dedicated process Aggregate); write each compensating action as a BR; see
    "Long-Running Processes"

12. **Treating recorded design decisions as settled law** — Extending an
    Aggregate while bending it to fit (a lifecycle-required field turned
    nullable for a new case, a `Purpose` / `Type` discriminator making one
    entity carry materially different lifecycles or rules), never re-reading
    the Design Decisions whose re-evaluation condition the change just
    triggered
    → Re-read recorded decisions when extending an existing Aggregate; when a
    resistance signal fires, name the revision question in the spec (proceed /
    split / rename, with reason); see "Revising an Established Model"
