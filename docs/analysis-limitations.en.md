# Known limits of `analysis.md`

> [繁體中文](analysis-limitations.md) | **English**

> This page tracks the source `main` branch, so it can describe behavior the changelog still lists under `## Unreleased`. Your project uses the templates in its own workflow bundle: if the `## Lifecycles` comment in `dflow/specs/shared/dflow-workflows/templates/analysis.md` does not mention `[*]`, your project does not have the new way of writing lifecycles yet — upgrade the CLI and run `dflow configure-agents` once.

A few things about how `analysis.md` is written and how `dflow render` draws it are known and deliberately left unguarded. This page lists each one: what goes wrong, why it is not prevented, who bears it, and what would make us reconsider.
Most are left unguarded because guarding them would mean a machine reading content it cannot judge reliably, or every document paying for a case few of them have.

## Lifecycles: creating and removing (`[*]`), values no transition has, values that cannot be written as themselves

In a lifecycle's transition table, `[*]` in From means that step creates the entity, and `[*]` in To means that step removes it; `[*]` is not a value and is not listed in the state table.
A value no transition has is listed under the diagram by `dflow render` instead of being drawn as a box; where the list of values was taken from goes in one line after the two tables that reads `Evidence:`.
A value that cannot be written as itself — an empty string, spaces only, no value at all — gets a name in State, and that `Evidence:` line says what each name stands for.

1. **Each project picks its own names, so they differ between projects.** One project writes "(not set)" for no value, another "(none)".
   - Why not prevented: within one document there is no confusion, since the `Evidence:` line after the tables says what each name stands for; a fixed notation would collide with values that really store those characters.
   - Who bears it: people reading documents across projects.
   - Reconsider: when someone reports misreading one.
2. **`[*]` in To may be written as an "end state".** An AI or author used to Mermaid or PlantUML may add a row to `[*]` for a state the entity stays in, such as "closed", so the table records a removal that never happens.
   - Why not prevented: whether the system really removes the entity is beyond what a machine can judge; the template's sentence (a value the entity stays in for good, or a soft delete, is an ordinary state) and the legend are the only reminders.
   - Who bears it: the writer and the reviewer.
   - Reconsider: when it actually happens.
3. **When the entity can be removed from many states, the diagram may not be drawn.** One row per state; from about 6 such states on, the arrows need more routing lanes than allowed, and `dflow render` prints a one-line note instead of a diagram. The table stays complete.
   - Why not prevented: writing fewer rows to get a diagram is exactly the mistake this way of writing exists to avoid.
   - Who bears it: people reading the diagram (they read the table instead).
   - Reconsider: when such lifecycles become common (for example by routing arrows to the end point on the left).
4. **`dflow render` cannot tell why a value has no transition.** Nobody has looked for its transitions yet, it appears only in old data, the code can write it but no path reaches it — all are listed under the diagram alike; the reason is in the `Evidence:` line after the tables, and render does not check that the line is there.
   - Why not prevented: the reason is prose, which a machine cannot judge reliably; a check it cannot judge only produces notices.
   - Who bears it: readers and reviewers.
   - Reconsider: when the line is often left out.
5. **`dflow doctor` does not point at existing documents.** A create step written below a table, or values taken out of a state table to get a diagram, produce no `dflow doctor` notice — it compares only the template's shape number. Only the migration note shown at upgrade reminds you, once.
   - Why not prevented: telling either case apart means reading the prose below the table and the contents of the value list.
   - Who bears it: adopters.
   - Reconsider: as for item 4.
6. **Older CLIs reading `[*]`.** CLIs from `0.15.0`, when diagrams arrived, through `0.16.4` note that `[*]` in From or To is not in the state table, and draw nothing; values put back into a state table still count toward the state limit there, which may turn a diagram into a note. Normally nothing is drawn wrong — there is just no diagram.
   **Exception**: when the document also defines a `[*]:` link, the `[*]` has no backticks, and the state table happens to hold the value `*`, an older CLI draws that row as an ordinary transition.
   - Why not prevented: those versions have already shipped.
   - Who bears it: people who have not upgraded the CLI.
   - Reconsider: not needed.
7. **What a name stands for is written only in the `Evidence:` line.** If it is left out, a reader seeing "(not set)" has to guess whether it is NULL or an empty string; `dflow render` does not check the line.
   - Why not prevented: as for item 4.
   - Who bears it: the writer and the reviewer.
   - Reconsider: when the line is often left out.
8. **Adding a start or end point can stop a diagram that just fitted.** Each point takes at least 64 of the height; a diagram that is within 960 today may become a note once a point is added. The table is not affected.
   For example, a lifecycle of 10 states in which one transition has a one-line Guard and an `inferred` tag is 898 tall today; with a start point it is 962, over the limit.
   - Why not prevented: the points need room.
   - Who bears it: people reading the diagram (they read the table instead).
   - Reconsider: when this becomes common (for example by drawing a point beside the first or last state instead of in a band of its own).
9. **An older document that uses a `[*]` link for a value named `*`.** When the document defines `[*]:` and a From or To cell holds `[*]` without backticks, `dflow render` cannot tell whether the author means create or remove, or the value `*`, so it draws nothing and prints a note asking the author to rewrite the cell: `[*]` in backticks for create or remove, `*` in backticks for the value. Nothing is drawn wrong.
   - Why not prevented: whichever way it guessed, it would draw some other document wrong.
   - Who bears it: the author of that document (very rare).
   - Reconsider: not needed.
10. **HTML, an image or a character reference in a State, From or To cell.** What these show on the page is up to the browser: HTML can hide text (for example `<span hidden>`), and references such as `&amp;` or `&#91;` turn into another character. `dflow render` does not imitate that, so when one of these three cells holds HTML other than `<br>`, an image, or a character reference outside backticks, it draws nothing and prints a note asking the author to write the value in backticks, as the template does (for example `` `R&D` ``). The same holds when an earlier cell or paragraph opened a `<pre>`, `<code>`, `<kbd>` or `<script>` and has not closed it: the text after these tags reaches the page as written. Nothing is drawn wrong. The template's way of writing (values in backticks), plain text and bold are not affected, nor are descriptive cells such as Trigger and Guard.
   HTML in a descriptive cell is outside this rule, though: a few tags left open swallow the cells after them (for example `<textarea>`, `<style>`, `<template>`, an HTML comment), so those cells disappear from the page or turn into stray text, while the diagram still follows the values written in the Markdown.
   - Why not prevented: reading them reliably would mean reading all HTML and references by the browser's rules; covering only some of them always leaves a form nobody thought of read wrong, and a wrong reading draws a wrong diagram. Refusing HTML in descriptive cells too would cost every document that uses HTML there, and where a tag swallows cells, the table on the page is visibly broken already.
   - Who bears it: the author of a document that writes these cells this way (very rare); for descriptive cells, readers comparing the diagram with the table.
   - Reconsider: when someone reports a common way of writing being refused, or HTML in a descriptive cell making the diagram and the table disagree.

## Function / Role Index: what each role can do (`Role-specific actions`)

1. **Searching for an action by keyword finds words, not permissions.** The matching line may state a restriction (for example "cannot edit once locked") rather than something a role can do.
   - Why not prevented: any wording has this, and reading the line tells the two apart.
   - Who bears it: readers and the AI.
   - Reconsider: when "who can do this action" is asked often, or authorization tests are to be derived from this table — then consider a separate permission table with one row per action.
2. **No machine check.** `dflow doctor` and `dflow render` do not check that the role at the start of each line is in Roles, that a line holds one action or one reference, or that a row written `—` was really checked.
   - Why not prevented: each needs the content read to judge, and a check that cannot judge only produces notices.
   - Who bears it: the writer and the reviewer.
   - Reconsider: when such a mistake actually happens and nobody notices.
3. **The column is input to an authorization analysis, not an authorization policy.** It records only actions not every role has, may record only a reference to a rule, and may record behavior observed in the code that nobody has confirmed. A rewrite of the system still has to resolve the references, separate actions from conditions, add back what every role can do, and decide whether observed behavior is a confirmed rule.
   - Why not prevented: the table's job is an index, not an authorization specification.
   - Who bears it: whoever rewrites the system.
   - Reconsider: as for item 1.
4. **`—` in Bounded Context means "none of the contexts recorded so far fits"**, not "belongs to no context, ever"; for functions that never belong to a business context (login, personal settings and the like), the answer to that question says so.
   - Why not prevented: recording the two cases apart would take one more notation.
   - Who bears it: readers.
   - Reconsider: when the two need telling apart.
5. **`dflow doctor` does not read cell contents.** It compares only shape numbers, so existing empty Bounded Context cells are not pointed out after an upgrade, and whether the migration note was followed cannot be judged.
   - Why not prevented: as for item 2.
   - Who bears it: adopters, who write the row by the new rule the next time they touch it.
   - Reconsider: as for item 2.
6. **Rows for several roles written before the upgrade are "not checked yet".** The migration adds the column without checking; until someone checks, an empty cell in those rows means nothing.
   - Why not prevented: checking means reading code or asking people, which is not mechanical.
   - Who bears it: readers, and whoever rewrites the system (who must check first).
   - Reconsider: if few people go back to check after upgrading — then consider a `dflow doctor` notice for rows for several roles that nobody has checked.
