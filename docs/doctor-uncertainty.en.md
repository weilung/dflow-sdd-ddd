# When `dflow doctor` says it is not sure

> [繁體中文](doctor-uncertainty.md) | **English**

> This page tracks the source `main` branch and can describe behavior still listed under `## Unreleased` in the changelog. `@latest` installs the latest **published** CLI; it does not guarantee that every `main`-branch feature below has been released:
>
> ```bash
> npm install -g dflow-sdd-ddd@latest
> ```
>
> Everything on this page is done by editing your own Markdown, so the repairs remain forward-compatible. If your `dflow doctor` never prints an `[uncertain]` line, your installed CLI may predate the feature. Use this page as forward guidance; the reports appear only in a published release whose changelog includes them.

## What `uncertain` means

`dflow doctor` answers one question about the two files whose content it makes claims about — `dflow/specs/shared/_conventions.md` and `dflow/specs/shared/AI-AGENT-GUIDE.md`: **are the rules and settings from the upstream template still in your file?**

To answer it, doctor has to work out which section each line belongs to — which means reading Markdown block structure. Its reader is a deliberately small one, and there are shapes it is known to get wrong. Rather than guess, doctor now says so:

```text
[uncertain] dflow/specs/shared/_conventions.md, line 42: an HTML comment begins part-way through a line (inline-html-comment)
        ...
        Ran, but cannot be trusted while this shape is present — their silence is NOT a pass, and anything they DO report may be an artefact of the shape: ...
```

Three things follow from an `[uncertain]` line, and the second is the one people miss:

1. **`All checks passed` is not printed.** A project in this state never gets the same verdict a clean one gets.
2. **The named checks ran — but you cannot trust what they said, in either direction.** Doctor reports by exception, so a check that says nothing normally means "this is fine". For the checks listed in the finding, that silence means *nothing reliable was measured* — do not read it as a pass. The other direction holds too: a `warn` from one of those checks may be the shape confusing the reader rather than real drift.
3. **The exit code is still `0`.** Uncertainty is not a build failure. Doctor has never used a non-zero exit for a finding, and this did not change that.

## Why doctor doesn't just fix the shape instead

Some of these are fixable and some genuinely are not, and pretending otherwise is what this page exists to avoid:

- For some the fix is a rewrite of the reader itself, and rewrites of *this* reader have a measured record of introducing new defects while closing old ones.
- One would change what counts as a table, which would move an unrelated formatting check with it.
- And for at least one shape — the table-indent gap described at the end of this page, which is deliberately **not** reported — there is **no available arbiter** to implement against.

So the honest position is: **narrow the reader where that is safe, disclose what can be detected, and record the rest in the source.** Detecting *whether a shape is present* needs none of the block-boundary logic that could be wrong, which is why these warnings can be trusted even though the thing they warn about cannot.

## The shapes

Each heading is the detector id doctor prints in brackets.

> This list is **not** exhaustive. It covers the shapes that are both known and detectable today. Markdown has more edge cases than any list, and a shape that is absent here is not thereby certified safe — it is either not yet known, or known and judged not worth warning about (see the last section).

### `inline-html-comment`

**The shape.** An HTML comment that begins part-way through a line:

```markdown
Selected Git policy: `gitflow` <!-- was trunk, revisit in Q3 -->
```

**Why it cannot be read reliably.** Doctor classifies Markdown one line at a time. A comment that *starts* a line opens a block, and doctor correctly treats its contents as invisible. A comment that opens mid-line is not a block at all — it is an inline span — so its contents are counted as live document text.

**Which way it fails.** Silently. A rule you commented out mid-line still reads as present, so doctor reports your file as current when part of it has been switched off. This is the worst direction, which is why it is disclosed rather than left alone.

**How to rewrite it.** Move the comment to a line of its own **starting at column 0**, outside any list item or block quote. There it opens a real HTML block and its contents stop being read:

```markdown
<!-- was trunk, revisit in Q3 -->
Selected Git policy: `gitflow`
```

Deleting it works too.

> ⚠ **Indenting it under a list item is not enough**, and this is worth stating because it is the obvious way to follow the instruction above. A comment indented under `- item` stays *inside* the item, where Dflow still reads it — see the next shape. The column is what matters, not the fact of being alone on the line.

Note that a comment inside a code span — `` `<!-- like this -->` `` — is *rendered*, so a reader does see it; that is not this shape and doctor does not report it.

> ⚠ **If the cited comment is inside a `<textarea>`, leave that line unchanged** — including when it is reported under *this* id, which is what happens when the tag and the comment share a line. A `<textarea>` holds raw text, so moving the line out would hide text the reader already sees. But do **not** ignore the overall uncertainty result: doctor reports only the first occurrence of each shape in a file, so this harmless line can shadow a later, genuinely hidden comment with the same id. Inspect the rest of the cited file for other apparent comment openers before trusting the affected checks.

> ⚠ **Renderer scope:** a markerless continuation of list-owned raw HTML is calibrated to the renderer Dflow ships (`dflow render`, powered by Marked). Another Markdown renderer may expose an escaped apparent opener there; if you publish through a different renderer, inspect its output before applying the repair.

> ⚠ **If the comment is inside an HTML block** (`<details>`, `<div>`, `<pre>`, …), moving it to column 0 is not the whole repair — you are still inside the block. See `comment-inside-container` below for the per-tag rule.

### `comment-inside-container`

**The shape.** An HTML comment on its own line, but inside a container. A list item and a block quote are the everyday cases:

```markdown
- Ceremony scaling
  <!-- Escalate-only, no de-escalation. -->
```

An HTML block is one too, and it catches people out because the comment looks perfectly ordinary at column 0:

```markdown
<details>
<!-- Selected Git policy: `trunk` -->
</details>
```

**Why it cannot be read reliably.** Doctor does not parse the interior of a container as its own sequence of blocks, so a comment opened inside one never opens an HTML block as far as doctor is concerned. Its text stays in the pool of live document content. What makes something a container here is that behaviour, not its syntax — so treat the two examples above as illustrations rather than as the full set.

**Which way it fails.** Silently in `dflow render`. Its Marked renderer normally shows no comment text there; doctor reads the comment's contents as though you had written them as ordinary text. **This holds whether or not the comment is closed** — closing it changes nothing, because the problem is where it sits, not whether it ends. The `<details>` form is the more dangerous of the two, because a commented-out setting inside it can be *contradicted* by a visible line further down and doctor will still trust the hidden one.

> ⚠ **Renderer scope:** for a markerless continuation of list-owned raw HTML, the direction above is calibrated to `dflow render` (Marked). Some other Markdown renderers expose an escaped apparent opener instead. If you publish through another renderer, inspect that output before moving or deleting the comment.

**How to rewrite it.** Move the comment out of the enclosing container — or delete it. Leaving the container is the whole repair, and *how* you leave depends on which container you are in:

- **List item or block quote** — put the comment on a line of its own at column 0, with no list marker or `>` before it.
- **HTML block, most tags (`<details>`, `<div>`, …)** — a **blank line** is what ends the block; the closing tag does not. So put a blank line between the block and the comment, or move the comment above the block entirely.
- **`<pre>`** — the exception, and its rule is the opposite one: it ends at its own **closing tag**. Move the comment *below* `</pre>`. Adding a blank line inside the block does nothing, because a blank line does not end it.

⚠ **If the comment sits inside more than one container, the outermost one is the one you have to leave.** A `<pre>` inside a list item, a `<details>` inside a block quote: apply only the inner rule and the comment is still in the list item or the quote, and doctor reports the same finding again. Work outwards until the comment is at column 0 with nothing enclosing it.

⚠ The middle rule is the one that catches people: for `<details>` and friends, moving the comment below `</details>` with no blank line leaves it inside the block, and doctor will report the same finding again. It is the same blank-line rule described under `unclosed-html-block`. ⚠ And do not generalise it — apply it to `<pre>` and you will add a blank line, see the finding survive, and have no idea why.

#### `<textarea>` is not one of these shapes — and doctor sometimes reports it anyway

`<textarea>` looks like `<pre>` but behaves in the opposite way here. Its interior is **raw text**, so `<!-- like this -->` is displayed to the reader exactly as written. Nothing is hidden, so there is nothing to disclose — and **moving such a comment out would be the one edit that genuinely hides it.**

Doctor reports it anyway, deliberately. Suppressing it was tried three times and each attempt created a case where a *genuinely* hidden comment went unreported — the failure this whole check exists to prevent. Keeping the harmless line reported is safer than a clean verdict over a file doctor read wrong, so the exemption was removed rather than patched again.

> **If you get `comment-inside-container` and the cited comment is inside a `<textarea>`, leave that line unchanged, but keep the overall finding open.** Doctor reports only the first occurrence of this id in a file, so inspect the rest of the file for a later apparent comment opener before treating the affected checks as reliable.

#### A fenced example can still be reported

Doctor masks fenced code before looking for these shapes, so an example inside ```` ``` ```` normally does not fire. Its fence scanner reads raw document lines, though, and never strips a container prefix — so there are fences it does not recognise. The known ones:

- a fence opened **inside a block quote** (`> ` before the backticks);
- a fence whose **raw indent is four spaces or more**, which happens under an ordinary `- item` as soon as you indent the fence that far;
- a fence opened **on the list-marker line itself** (`` - ```md ``), whose raw line starts with `-`, so the un-indent repair below cannot reach it.

> ⚠ This list is **not** exhaustive. An earlier version said the scanner "misses exactly two shapes", and the very next review round found the third (`p084gate-x14`). The rule is that the fence's raw line does not start at column 0, or carries a container prefix — not a list you can check off.

A comment inside any of them is still reported, and there is a second consequence that is easy to miss: **the text inside an unmasked fence is read as ordinary section content.** If your example happens to quote a rule that has since been changed elsewhere in the file, doctor can read the example as the live rule and report the file as current. So an unmasked fence is not only noisy — it can also hide real drift.

They clear differently:

- **The indent case** — un-indent the fence to two or three spaces and the report stops. This is the one place where re-indenting helps, and it is the exception to the rule stated above.
- **The block quote case** — re-indenting does **not** help at any depth, because the line still starts with `>` and the fence scanner never sees the fence at all. Move the example out of the quote, or ignore the report.
- **The list-marker-line case** — un-indenting cannot help either, because the raw line begins with the marker. Move the fence to a line of its own below the marker, or ignore the report. ⚠ Do **not** follow the generic repair the CLI prints for this id here: moving or deleting the comment would remove example text your reader can see.

Re-indenting the **comment** inside the container never helps. ⚠ That is about the comment. Un-indenting a *fence* is a different edit and it does help — see the fenced-example note above, which is the one exception on this page.

### `unclosed-html-block`

**The shape.** An HTML block opened at the start of a line that never closes — most often a `<!--` left behind mid-edit.

**Why it cannot be read reliably.** Everything from that line to the end of the file is inside the block, so it is not section content and cannot be assessed.

**Which way it fails.** Both ways at once, and this is the one worth reading twice. A `missing` or `is missing the rule` finding below the block may be caused by the block rather than by real drift — *and* a rule that genuinely has drifted below it can go unreported entirely, because the block hides the text the check would have read. Treat every result about content below that line as unknown, not as passing.

**How to rewrite it.** Close the block. For an HTML comment that means adding `-->`; other block types that carry an end condition (`<script>`, `<style>`, `<pre>`, `<textarea>`, `<?`, `<!DOCTYPE`, `<![CDATA[`) each have their own closing form.

Only blocks with an end condition can produce this finding at all. A tag like `<details>` opens a different kind of HTML block that ends at the next **blank line**, so it always "closes" and never reaches this report — if a `<details>` section is swallowing content, the shape you are looking for is the missing blank line, not a missing tag.

### `html-block-type-7`

**The shape.** A complete tag whose name is not one of CommonMark's known block tag names, standing alone at the start of a block, directly above a `---` or `===` line:

```markdown
<my-widget>
---
```

A **closing** tag counts as well — `</my-widget>` above the same underline is the same shape and is reported the same way. So does a self-closing one.

**Why it cannot be read reliably.** That construction is HTML block type 7. It is the only HTML block type that cannot interrupt a paragraph, and recognising it properly needs a real tag parser. Doctor does not implement it.

**Which way it fails.** Usually loudly: doctor ends the section earlier than a renderer does, so it reports drift that is not there — and a `stale` you cannot reproduce is its own problem, which is why it is named rather than left as a mystery. ⚠ But not *only* loudly, and this was stated too confidently for several rounds: ending the section early also drops the rest of it, so a retired rule sitting below the shape stops being seen and its finding disappears. Treat results about that section as unknown in **both** directions.

**How to rewrite it.** Put a blank line between the tag and the underline. If the tag is being *shown* rather than used, fence it as an example.

## Shapes that are known and deliberately not reported

Disclosure has a cost of its own: a warning that fires on correct files teaches people to ignore all of them.

**A malformed table delimiter row** — one whose cell count differs from the header row above it — is in this section too, and its reason is different enough to be worth stating.

GFM requires the delimiter row to carry exactly as many cells as the header, and treats a mismatched pair as ordinary prose: it is **not a table at all**. Doctor does not enforce that rule, so the two can disagree about whether this is a table, and then about where the section ends. The shape genuinely does make doctor misread, in **both** directions — the section can run on past where you see it end, or be cut short so content below is never examined.

So why is it not reported? **Because it was, and it could not be made to work.** Across six consecutive review rounds, every round found a document the detector stayed silent on — and silence here is worse than saying nothing, because it prints `All checks passed` over a file that has drifted. Narrowing it to the shapes where a divergence had been measured failed five times; widening it back to every mismatch failed on the sixth, because the remaining list had simply moved into the code that recognises a delimiter row. One of those rounds also measured the same silent failure with a delimiter row whose cell count was **correct**, which means the detector's scope was only ever part of the problem.

The durable fix is a different instrument rather than a better list of shapes: `marked` — the renderer `dflow render` uses — is already a dependency of this package, so the section boundary can be taken **from** the renderer instead of guessed alongside it and compared shape by shape. That is a separate design change with its own evaluation. Until then this page says plainly that the check is not made, rather than shipping one that goes quiet on documents nobody thought to try.

If you are chasing a drift result that makes no sense and your file has a delimiter row whose cell count differs from its header, that is worth fixing first.

Another known gap — **an indented continuation line inside a table** — is left unreported for a different reason. A prototype detector for it produced five false reports across 151 real files, all of them triggered by ordinary indented code and examples. There is also no reference implementation available that can settle who is right about that shape: the two that could arbitrate disagree, and one of them has no notion of tables at all. For it, the warning really would be worse than the gap.

It is not the only unreported one. Others are recorded in the source (`lib/doctor-checks.js`, under "what this deliberately does not implement") rather than here, because they have no detectable shape to key a report to — the interior of a nested container not being parsed as its own sequence of blocks is the broadest of them, and the two comment shapes above are the specific cases of it that *could* be detected.

So if you are chasing a drift result that makes no sense and none of the shapes above are present in your file, the table-indent gap is **one** candidate worth checking — not the last one. The end of this page is not the end of the list.

**One more deliberate silence, of a different kind: command files and skill files that are not there at all.** Everything above is about a file doctor might *misread*. This one is not a misreading — it is a whole layer doctor does not look for.

`dflow doctor` does check `.claude/commands/dflow/`, `.github/prompts/dflow-*.prompt.md` and the three `SKILL.md` files, but it judges **only the ones already present**: a partial set is reported, a `0.5.0`-era filename left behind is reported, and a Dflow-generated `SKILL.md` that has fallen behind this version is reported. **When none of them exist at all, it says nothing.**

**The failure this leaves open.** A project never ran `dflow configure-agents --command-adapters` — or ran it once and the files were not regenerated after a clone — so not one `/dflow:*` command is available, and `dflow doctor` reports `All checks passed` throughout. This is not hypothetical: one real project went six releases with no `.claude/commands/dflow/` files at all, and doctor was silent the whole way.

**Why it is deliberately not defended.** Doctor cannot separate two kinds of adopter — "I never wanted those files" and "I had them and they are gone" — because the two states are identical on disk, and **both are legitimate**. Dflow never records which tools a project intends to use (the boundary `PROPOSAL-058` set, which `checkRootAgentShims` also follows), while `PROPOSAL-037` positively **recommends** that adopters gitignore these generated files and regenerate them after a clone — so "not one of them present" in a fresh clone is exactly what following that advice looks like. A detector for this was specified three times, and each time a path was found where it fired on an innocent project; one version reported on **every fresh `dflow init`**. The sentence this section opens with — a warning that fires on correct files teaches people to ignore all of them — is about precisely this.

**Who carries the residual risk.** The adopter. Doctor states the boundary at the end of every run and names who picks it up: the AI you run Dflow with. ⚠ **That is a delegation, not a guarantee** — nothing makes it happen, and nothing verifies afterwards that it did.

**What would make us reconsider.** If command adapters became installed by default, the "I never wanted them" adopter would no longer exist and the detection collapses into the simple question "is it there?". That is a separate product decision — it would overturn `PROPOSAL-074`'s explicit choice to keep adapters opt-in — and it has not been made. If it is, this entry gets revisited with it.

## If none of this explains your result

Doctor is read-only; it never edits your files, so nothing here can have damaged anything. A drift report you cannot account for is worth reporting — include the `_conventions.md` section it points at, and the detector id if one was printed.
