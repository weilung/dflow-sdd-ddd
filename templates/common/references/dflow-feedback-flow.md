# Dflow Feedback Draft Flow

`/dflow:report-dflow-feedback` helps the developer turn a Dflow problem or
improvement observed during real project work into a high-quality upstream
feedback draft. The draft is rendered **field by field to match the upstream
GitHub issue form**, so the developer pastes each field with no reformatting.

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

Classify the feedback as one of the following. Each maps to one upstream issue
form (see "Upstream Issue Forms" below):

| Classification | Upstream issue form | Title prefix |
|---|---|---|
| Bug report | Bug report | `[Bug]: ` |
| Workflow change request | Workflow change request | `[Workflow]: ` |
| Documentation feedback | Documentation feedback | `[Docs]: ` |
| Question / unclear usage | Question | `[Question]: ` |
| Maintainer release/process feedback | Workflow change request (closest form; the upstream repo disables blank issues) | `[Workflow]: ` |
| Usage report (several observations from one stretch of real use) | Usage report | `[Usage]: ` |

Choose **Usage report** when the developer asks for one, wants to send several
observations together, or wants to continue a usage report already started.
Otherwise a single problem goes to one of the other forms.

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
- Generic project type, such as "existing legacy presentation-framework app" or
  "new internal service"
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

Before writing any field content, run a redaction check and use it as your own
gate. Confirm there are:

- No secrets, tokens, credentials, or auth headers
- No customer, tenant, or private organization names
- No proprietary business rules beyond a sanitized paraphrase
- No private repository URLs or internal hostnames
- No long proprietary source snippets

The draft ends with a short submitter self-check (Step 5); leave its items
unchecked unless the developer explicitly confirms them.

## Step 4: Resolve the Target Issue Form

Submit upstream at: **https://github.com/weilung/dflow-sdd-ddd/issues/new/choose**

Resolve the field schema for the chosen form using this priority chain (it
avoids any network dependency at draft time):

1. **Live upstream schema** — if you can read the target repo's
   `.github/ISSUE_TEMPLATE/*.yml` (for example you are working inside a
   `dflow-sdd-ddd` checkout), use that file; it is authoritative.
2. **Bundled field map** — otherwise use the field map in "Upstream Issue
   Forms" below. It is a snapshot of the upstream forms shipped with Dflow.
3. **Generic fallback** — only if the feedback matches none of the forms, use
   Step 6.

## Usage Reports: Parts and Numbering

A usage report is sent in parts. Part 1 opens a new issue through the Usage
report form. Each later part is a comment on that same issue.

**Draft file.** Each part has its own draft,
`dflow/feedback/dflow-feedback-YYYY-MM-DD-usage-report-{R}-part-{N}.md`, dated
the day the part was started. `{R}` numbers the project's usage reports (1 for
the first report, 2 for the next) and is used only locally. The draft starts
with two lines that are local notes and are never pasted:

    Part {N} — open
    Next observation number: {n}

`{N}` is the part number. `{n}` is the number the next new observation takes;
it counts across all parts of the report. When the developer confirms that the
part was posted, replace the first line with
`Part {N} — submitted: {issue URL}`. Change it only on the developer's word;
never post anything yourself (Hard Boundaries).

**Continue or start.** Before drafting, look in `dflow/feedback/` for
usage-report drafts. Take the report with the highest `{R}`, and in it the
draft with the highest part number. The dates in the file names play no part
in this choice.

- If it is `open`, add the new observations to it.
- If it is `submitted`, start part {N+1}. Copy the issue URL and the
  `Next observation number` line into the new draft.
- If the developer says this is a new usage report, start report `{R}+1` at
  part 1 with observation 1. Leave the older drafts as they are.
- If there is no usage-report draft, ask the developer whether a usage report
  was already posted. If it was, ask for three things: the issue URL, the
  number of the last part posted, and the number of the last observation.
  Start the next part of report 1 from them. If it was not, start report 1 at
  part 1 with observation 1.

**Numbering.** Give each new observation the `Next observation number`, then
add one to it. An addition to an observation from an earlier part is headed
`Addendum to item {n}`. It takes no number and leaves `Next observation number`
unchanged.

## Step 5: Render the Draft Field by Field

Write the draft as one block per upstream field, in the form's field order, so
the developer copies each block straight into the matching field.

Per field-type rules:

| Field type | How to render |
|---|---|
| `input` | One short line inside a fenced block. |
| `textarea` | Multi-line content inside a fenced block. If the field sets a non-empty `render:` attribute, do **not** add an extra fence (the form already code-blocks it). |
| `dropdown` | State the **recommended option** plus a one-line reason. If `multiple: true`, list the chosen options. |
| `checkboxes` | List every option as `- [x]` / `- [ ]`; mark any option whose schema sets `required: true`. |
| `markdown` | Display-only text in the form — produce **no** field block for it. |
| upload / attachment | Emit a manual step ("drag the relevant screenshot / log into the issue editor"); do not try to handle the file. |

Always start with a **Title** block: the form's title prefix plus a concise
one-line summary. GitHub pre-fills the prefix in the title box; the developer
can paste the full line over it.

Attribute handling: bring `value` / `default` in as starting content; surface
`placeholder` as a hint; append "(required)" to the block heading when the
field sets `required: true`.

**Fence escaping (dynamic).** Wrap each field's content in a backtick fence
whose length is *(longest backtick run in the content) + 1*, minimum 3. The
fence is only a local wrapper so the content survives in the draft file — when
pasting into the issue form, the developer copies the **inner** content, not
the fence. State this in the draft.

Draft skeleton:

````markdown
# {Issue form name} — {short title}

## Where to submit

https://github.com/weilung/dflow-sdd-ddd/issues/new/choose → choose
**"{Issue form name}"**. (A GitHub account is all you need; the title is
auto-prefixed with `{prefix}`.)

## Title

```
{prefix}{concise one-line summary}
```

## {Field label} (required)

```
{field content; copy the inner text only, not this fence}
```

... one block per field, in form order ...

## Before you submit (submitter self-check)

- [ ] Any real file names / customer names / internal project code names to redact?
- [ ] If you attach screenshots, do they show sensitive content (internal systems, tokens, passwords)?
- [ ] Is opening a public issue within what your organization allows?
````

**Usage report parts.** Part 1 is rendered field by field, like any other
form. A later part is a comment, not a form, so it is rendered this way
instead:

- Write no Title block.
- Under "Where to submit", give the issue URL from the draft and tell the
  developer to add a new comment there.
- Write one block headed `## Comment` that holds the whole comment, wrapped in
  one dynamic fence (the fence rule above applies to the whole comment). Its
  first line is `# Usage report — part {N} ({date})`. Then write each form
  field in form order as a `## {Field label}` heading followed by its content
  as plain Markdown; for a dropdown, write the chosen option. Do not fence the
  fields one by one.
- Put the submitter self-check after the block, outside it.

Keep the draft **submitter-facing only**: no maintainer tracking notes, no
internal references, no "for your friend / for yourself" audience switches.

## Upstream Issue Forms (bundled field map)

> Snapshot of the `weilung/dflow-sdd-ddd` issue forms. If the live `.yml` is
> reachable (Step 4 priority 1), prefer it. Resync this map when the upstream
> forms change.

### Bug report — title `[Bug]: `

| Field | Type | Required | Notes |
|---|---|---|---|
| Dflow version | input | yes | placeholder `0.2.0` |
| Node.js version | input | yes | from `node --version` |
| Project track | dropdown | yes | Greenfield / Brownfield / Not sure |
| Command or workflow | textarea | yes | the command or `/dflow:*` workflow used |
| Expected behavior | textarea | yes | |
| Actual behavior | textarea | yes | include relevant output |
| Reproduction steps | textarea | yes | smallest steps that reproduce |
| Additional context | textarea | no | screenshots / snippets / environment |

### Workflow change request — title `[Workflow]: `

| Field | Type | Required | Notes |
|---|---|---|---|
| Problem | textarea | yes | |
| Proposed change | textarea | yes | |
| Affected track | dropdown | yes | Greenfield / Brownfield / Both / Not sure |
| Affected area | checkboxes | no | CLI command / Generated template / Generated scaffolding / Skill workflow guidance / Tutorial or examples / Documentation only |
| Compatibility risk | textarea | yes | |
| Alternatives considered | textarea | no | |

### Documentation feedback — title `[Docs]: `

| Field | Type | Required | Notes |
|---|---|---|---|
| Affected page or file | input | yes | placeholder `README.md` |
| Reader goal | textarea | yes | what you were trying to understand or do |
| What was confusing? | textarea | yes | the missing, unclear, or misleading part |
| Suggested improvement | textarea | no | optional wording or structure |

### Question — title `[Question]: `

| Field | Type | Required | Notes |
|---|---|---|---|
| Project type | dropdown | yes | New project / Existing project / Not sure |
| Dflow track you are considering | dropdown | yes | Greenfield / Brownfield / Not sure |
| What are you trying to do? | textarea | yes | the workflow or decision you need help with |
| Project context | textarea | no | framework, team workflow, AI agent, constraints |

### Usage report — title `[Usage]: `

| Field | Type | Required | Notes |
|---|---|---|---|
| Dflow version | input | yes | placeholder `0.16.6` |
| Project track | dropdown | yes | Greenfield / Brownfield / Not sure |
| What you used Dflow for | textarea | yes | flows and commands, about how many sessions, kind of work |
| Observations | textarea | yes | numbered from 1; each: doing / Dflow file or command / expected / actual / quoted Dflow text / cost |
| What worked well | textarea | no | |
| Anything else | textarea | no | AI agent, environment |

Part 1 only; later parts are comments (see "Usage Reports: Parts and Numbering").

## Step 6: Generic Fallback

Use this only when the feedback matches none of the forms above. The upstream
repo disables blank issues, so direct the developer to pick the closest form at
`https://github.com/weilung/dflow-sdd-ddd/issues/new/choose` and adapt. Emit
two paste-ready blocks — a `Title` and a `Body` — plus the URL. Do **not** fall
back to a generic `## Problem` / `## Evidence` Markdown draft.

## Step 7: Present Submission Options

After writing the draft, name the draft file path and whether any submitter
self-check items remain unchecked, then summarize the options:

- Open the chosen issue form and paste each field block.
- For a later usage-report part: open the issue and paste the inner content of
  the Comment block as a new comment.
- Discard the draft if it was only a local observation.

Do not submit anything automatically.
