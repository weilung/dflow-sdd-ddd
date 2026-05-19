# Dflow Feedback Draft Flow

`/dflow:report-dflow-feedback` helps the developer turn a Dflow problem or
improvement observed during real project work into a high-quality upstream
feedback draft.

This flow is **not** a project feature workflow and does not change the
application being built. It is a standalone governance/support flow for Dflow
itself.

## Hard Boundaries

- Do not submit anything to GitHub automatically.
- Do not run `gh issue create`, `gh pr create`, `git push`, or any networked
  submission command from this flow.
- Do not expose private project details, business rules, customer data,
  secrets, tokens, internal URLs, or proprietary source snippets.
- Always show the draft to the developer before anything leaves the local
  machine.
- If the developer later asks to submit through GitHub CLI, stop and treat that
  as a separate explicit task with fresh permission and environment checks.

## Trigger Conditions

Enter this flow when:

- The developer explicitly runs `/dflow:report-dflow-feedback`.
- The developer says the Dflow process, template, generated file, or docs seem
  wrong or improvable.
- The AI notices a clear contradiction or gap in Dflow guidance and asks:
  "This looks like a possible Dflow upstream issue. Should I draft feedback for
  you to review?"

Do not interrupt normal development for minor preference differences. If the
observation is speculative, ask before drafting.

## Output Location

Write the draft to:

```text
dflow/feedback/dflow-feedback-YYYY-MM-DD-{slug}.md
```

Create `dflow/feedback/` if it does not exist. The file is local project
working material; the developer decides whether to copy it into a GitHub issue,
turn it into a PR, or discard it.

## Step 1: Classify the Feedback

Classify the feedback as one of:

- Bug report
- Workflow change request
- Documentation feedback
- Question / unclear usage
- Maintainer release/process feedback

Capture:

- Observed during which flow or command
- Affected Dflow track: Greenfield, Brownfield, both, or unknown
- Affected area: CLI, generated template, scaffolding, skill reference,
  tutorial, README/docs, release/governance
- Whether the issue blocks current project work

## Step 2: Capture Evidence Safely

Collect only the evidence needed to explain the Dflow issue.

Allowed evidence:

- Dflow command name
- Dflow version if known
- Template or reference file name
- Generic project type, such as "existing brownfield app" or "legacy batch-processing system"
- Minimal paraphrased symptom
- Short sanitized snippets from Dflow-owned files

Avoid:

- Internal business rules
- Customer or tenant names
- Private repository names or URLs
- Secrets, tokens, credentials, or auth headers
- Long proprietary code snippets
- Full logs containing private paths or environment data

## Step 3: Redaction Pass

Before writing the issue body section, perform a redaction check and include it
in the draft:

```markdown
## Redaction Checklist

- [ ] No secrets, tokens, credentials, or auth headers
- [ ] No customer, tenant, or private organization names
- [ ] No proprietary business rules beyond sanitized paraphrase
- [ ] No private repository URLs or internal hostnames
- [ ] No long proprietary source snippets
- [ ] Developer reviewed before submission
```

Leave the final "Developer reviewed before submission" unchecked unless the
developer explicitly confirms it.

## Step 4: Write the Feedback Draft

Use this structure:

```markdown
# Dflow Feedback Draft: {short-title}

## Summary

{One or two sentences.}

## Type

{Bug report | Workflow change request | Documentation feedback | Question | Maintainer process feedback}

## Observed While Using

- Dflow version: {version-or-unknown}
- Command / flow: {command-or-flow}
- Track: {Greenfield | Brownfield | both | unknown}
- Project context: {sanitized generic context}

## Affected Dflow Area

- {CLI | template | scaffolding | skill reference | tutorial | docs | governance}
- Files or concepts: {sanitized list}

## Problem

{What happened, why it is confusing or harmful, and who is affected.}

## Expected Behavior or Improvement

{What Dflow should do or explain instead.}

## Evidence

{Minimal sanitized observations.}

## Compatibility / Breaking-Change Risk

{None | low | medium | high}, with reasoning.

## Suggested GitHub Issue Body

{Copy-ready issue body matching the closest issue template.}

## Optional PR Plan

{Only include if the change is small and concrete. Otherwise write "Not recommended yet; start with an issue."}

## Redaction Checklist

- [ ] No secrets, tokens, credentials, or auth headers
- [ ] No customer, tenant, or private organization names
- [ ] No proprietary business rules beyond sanitized paraphrase
- [ ] No private repository URLs or internal hostnames
- [ ] No long proprietary source snippets
- [ ] Developer reviewed before submission
```

## Step 5: Present Submission Options

After writing the draft, summarize the options:

- Copy the suggested issue body manually into GitHub.
- Use the optional PR plan as implementation guidance in a Dflow source
  checkout.
- Discard the draft if it was only a local observation.

Do not submit anything automatically. End by naming the draft file path and
whether any redaction checklist items remain unchecked.
