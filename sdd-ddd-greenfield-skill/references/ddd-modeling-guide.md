# DDD Modeling Guide

When a developer asks "How should I model X?" or is designing domain structures,
use this guide to walk them through DDD tactical patterns.

## The Modeling Conversation

Start with the business, not the code:

```
"Let's forget about databases and classes for a moment.
Tell me: what are the rules? What must always be true?
What can never happen?"
```

These invariants drive the entire model design.

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
2. **What's the consistency boundary?** What must be updated atomically?
3. **What can change independently?** Separate Aggregates for separate concerns.
4. **Who modifies this?** How many concurrent users? (Affects Aggregate size)
5. **What events does this produce?** What other parts of the system need to know?

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
public record DateRange(DateOnly Start, DateOnly End)
{
    public DateRange
    {
        if (Start > End) throw new DomainException("Start must be before End.");
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

## Domain Events

### What Are Domain Events?

Something that happened in the domain that other parts of the system care about.
Past tense naming: `ExpenseReportSubmitted`, `LineItemAdded`, `ReportApproved`.

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

## Domain Services

Use Domain Services for operations that:
- Involve multiple Aggregates (read-only access to the second Aggregate)
- Require external information (through interfaces) to make domain decisions
- Don't naturally belong to any single Entity

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

## Bounded Context Relationships

If `dflow/specs/domain/context-map.md` does not exist yet, create it from `templates/context-map.md` before documenting relationships.

Document in `dflow/specs/domain/context-map.md`:

| Relationship | Pattern | Example |
|---|---|---|
| Context A calls Context B | Customer-Supplier | Expense → HR (get employee info) |
| Contexts share data | Shared Kernel | Currency, Money in SharedKernel/ |
| Context A translates B's language | Anti-Corruption Layer | Expense → External Accounting System |
| Fire and forget | Domain Events | Expense → Notification (report submitted) |

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
