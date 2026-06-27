# Why Dflow (Even When AI Already Knows DDD)

> [繁體中文](why-dflow.md) | **English**

If your instinct is "today's AI already knows DDD — tell it to *build a feature using DDD* and out come aggregates, value objects, events; isn't a spec-first tool on top of that over-engineering?" — this document is written for you. It is not trying to convince you; it lays Dflow's value, the evidence, and the limits flat so you can judge for yourself.

## What Dflow is

Dflow does not teach AI what DDD is — it is a scaffold: it forces the AI to keep a full record of the trade-offs behind each design decision, and fills in the blind spots the AI tends to miss while filling in details on its own and that review can't easily catch.

Split "AI knows DDD" into two things and you see why it is still needed:

1. **Can the AI state the correct DDD answer?** Yes. The model has read the textbooks — aggregate boundaries, invariants, ubiquitous language, it can recite them all.
2. **When you review it, does the AI leave a complete enough record to audit — which options it weighed, why it chose this one, what it left undecided — and does it proactively catch the traps it tends to miss on its own?** Not necessarily — it depends on how you ask.

So the real comparison is not "AI tool vs process" but:

- **AI alone** output = AI knowledge × the implicit prompt structure × your ability to review it
- **AI + Dflow** output = AI knowledge × an **explicit elicitation scaffold** × an **auditable record of the decisions (trade-offs, rejected options, open questions)** × your ability to review it

The difference is not "a smarter AI." It is "**a more reviewable AI**."

## Dflow's DDD guidance is grown, not copied from a textbook

Part of Dflow's value is this: its guidance is fed back from real blind spots, and once added, the model actually reuses it afterward. A concrete, checkable example —

**Blind spot**: modeling on its own, the model guarded "a connector can have at most one in-progress charging session" — a uniqueness rule — with just an in-memory `if Status == InUse throw` check inside the aggregate. By the DDD textbook this is correct, but under concurrency two requests each read `Available`, each pass the check, and each save → the invariant is broken (modeling-correct, production-broken).

**Feedback**: that blind spot was written up as a section of guidance and added to Dflow's `ddd-modeling-guide.md` — "Set-Based / Uniqueness Invariants": for any "only one active X at a time" rule, no matter how you slice the aggregate, an in-memory check is never enough under concurrency; you need a DB unique / partial index or a concurrency token, and you must translate the conflict into an HTTP 409.

**Reuse**: on a different domain (cold-chain sensors, "a sensor is attached to at most one carton at a time," structurally parallel) and with the model unaware it was being tested, it **proactively cited that section** and produced the full three-layer protection (in-memory guard + a concurrency token + a DB partial unique index + a 409).

What this proves is something concrete: **Dflow turns "the blind spots AI misses on its own" into reusable guidance it actually follows.** This is not the grand conclusion "a few runs prove AI+process wins across the board" (the sample is small); it is evidence that Dflow's guidance loop works — **blind spot → add guidance → the model reuses it**. You can reproduce it yourself (see the end).

> An honesty note: the domain and the framing also differ between the two runs, but both cut against the "it wasn't the guidance" counter-argument — neither domain is a high-frequency concurrency-design topic in the model's pre-training; the framing in the second run is purer (unaware of the test), and if that were the cause the result should be worse, not better. Once those two are pushed down as less plausible, the best remaining explanation for the flip is whether that section is present.

## A few more things Dflow forces on the record that AI misses on its own

The same observation round also showed (each point is "what Dflow does → what happens without it"):

- **Forces the rejected-alternative reasoning**: one prompt in the aggregate-design template elicits a full decision block — "this boundary + why + which alternatives were considered + why rejected." On its own the AI usually hands you a single option, and at review you cannot audit "did it consider X?"
- **Step gates turn decisions into reviewable moments**: the model naturally stops to confirm at naming and model-spike points; on its own the AI writes all the way to code and tests before you get to review, by which time the aggregate boundary is no longer negotiable.
- **Open Questions get logged for the domain expert**: the model lists uncertain points as OQs awaiting an answer, instead of "guess something plausible" and burying the assumption in code logic.
- **Ubiquitous language does not drift**: a glossary plus code mapping keeps spec / model / code on one set of terms; on its own the AI can mix `Sensor` / `Device` / `Tracker` within a single paragraph.
- **Rules are queryable**: each business rule has an ID, a status, an owning aggregate, and a behavior link; on its own the AI scatters rules across prose, so "which tests does BR-003 affect?" is answerable only by grep and inference.

## The honest trade-off

Not hiding the limits is what makes the argument trustworthy:

- **Scope**: the observations so far ran on a single model × a few moderate-complexity domains × lightweight modeling scope (through domain modeling, not the implementation phase). Whether the guidance is equally effective at the implementation phase, and whether a different model behaves the same, is **untested**.
- **Prior**: the tested model already has a DDD pre-training prior. Dflow demonstrates it can turn "knows DDD but doesn't always think carefully" into "thinks carefully" — **not** "turns an AI with no DDD concept into one that does."
- **Adoption implies compliance**: Dflow is a spec-first tool; it only works when it is followed. Cases where the AI or a person deliberately bypasses it are outside the claim. That is a property of the tool, not a bug.

For audit-sensitive settings — medical, finance, compliance, safety-sensitive, or anything where a production failure is expensive or carries personal liability — this reviewability difference is a deal-breaker. The cost has two sides. *Producing* the DDD documents is no longer the pre-AI era when DDD by hand carried a heavy labor cost — the AI generates the specs, the decision record, and the domain model for you, so the marginal cost is mainly a few more tokens and running the workflow; and just being constrained by the domain model during generation already makes the output steadier (as in the concurrency blind spot above), a layer you get even if you never read the record closely. Dflow's DDD is also deliberately pragmatic (not the full academic suite), fitting a typical company's mid-sized systems with a low adoption barrier (a team need not be DDD experts first). But cashing in the further "reviewable" value still takes a person actually reviewing that record — that is the key cost in human attention and discipline. So the trade-off stands and is worth discussing: when stakes are high, an audit is needed, or a team maintains it long-term, the investment clearly pays off; when you won't review it, the cost of failure is low, and iteration is fast, AI alone may still be the more practical choice — Dflow does not always win.

## Verify it yourself

Don't trust any of the above — run it once (about 10–30 minutes):

```bash
npm install -g dflow-sdd-ddd
mkdir dflow-test && cd dflow-test
git init && git commit --allow-empty -m "init"
dflow init           # choose greenfield + your AI tool + your stack
```

Then in your AI coding agent run `/dflow:new-feature` and assign a feature with a "cross-instance uniqueness" invariant, e.g. "at most one active session per account at a time." Watch whether, at domain modeling, the model reaches the "Set-Based / Uniqueness Invariants" section (in Dflow's `ddd-modeling-guide.md`), cites it, and adds a DB unique / partial index + a concurrency token + a 409. Note: installing the latest version verifies the half "when the guidance is present the model uses it"; the "without the guidance the model misses it" half was established by the run above before the guidance was added, and is not a variable you can toggle on the latest version — which always contains it.

---

Dflow does not claim to make the AI smarter; it makes the AI more reviewable: spec-first, domain meaning made explicit, decisions and rejected alternatives kept on the record, AI constrained before implementation, and drift verified before the work is called done. For why domain meaning itself matters more in the AI era, see [Why DDD Matters More with AI](why-ddd-for-ai.en.md).
