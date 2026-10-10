# Table checks in `dflow render`

> [繁體中文](render-table-checks.md) | **English**

> This page tracks the source `main` branch, so it can describe behavior the changelog still lists under `## Unreleased`. If `dflow render --help` has no `Tables:` paragraph, your installed CLI does not run these checks. `@latest` installs the latest **published** CLI, which does not guarantee that a feature on this page has been released — the changelog of a published release says what it includes.

Two ways a Markdown table goes wrong give no error at all: a blank line cuts the table short and the rows after it become a paragraph of text, or a `|` in a cell is not escaped, so a row has more cells than the header and the extra text is dropped. `dflow render` checks every file it converts for both, leaves a one-line notice on the page where it happens, and lists each one on stdout. Rendering still completes, and the exit code is unchanged.

This page says what is checked, how to fix what is found, where the notices appear, and the cases we know about and decided not to check.

## What is checked

Only **tables at the top level** of a page: not inside a list item or a block quote (`>`). The checks read the same parse the page is drawn from (the Markdown parser marked), so what is reported is what is really broken on the page.

### A table cut short

When the paragraph right after a table — with only blank lines or HTML comments (`<!-- … -->`) between — starts with a line written like the table's rows, it is reported:

- it starts with `|` followed by a space or tab, with at most three spaces before the `|`;
- it ends with a space or tab followed by `|` (whitespace after that last `|` does not count);
- it has as many cells as the table's header, counted as in "How cells are counted" below.

The report names the line of the cut (the blank lines and comments) and the leading lines of the paragraph that start with `|`. When the next paragraph after that one (again with only blank lines or comments between) also starts with such a line, it is reported too, compared with the same table; a table cut into several pieces gets one report per cut.

- Only the first line is read, because the cut-off rows may run straight into other text (an `Evidence:` line, say) and form one paragraph with it; a first line written like the table's rows means the table was cut.
- The space beside the bar and the matching cell count are there so that formulas starting with a bar, such as `|amount| must not exceed the limit` or `|x| = |y|`, are not reported. What that costs is in known limitations 2 and 9.
- A heading or any other block (a list, a code block, an ordinary paragraph) in between ends the search, so text in the next subsection is never counted against this table.

### A row with extra cells holding text

A row of the table (not the header or the delimiter row) with more cells than the header, where the extra cells are not all empty, is reported. That text is dropped — the page really lacks it — and the cells before it may be in the wrong columns. The usual cause is a `|` written in a cell instead of `\|`; **inside backticks it splits the cell too**, though writers often expect backticks to protect it.

Not reported: a row with fewer cells than the header (the missing cells are filled in empty, and the page is exactly the same as with those cells written empty), and a row whose extra cells are all empty (what is dropped is blank, and the page is the same as without it). Either can hide a shift between columns; see known limitation 3.

### How cells are counted

By the rule marked (the version `dflow render` uses) splits a row with, but without cutting the row down or padding it to the header:

- An unescaped `|` splits: one after an even number of `\` (zero included). A `|` inside backticks, a link or HTML splits too.
- `\|` does not split, and neither does `&#124;`.
- After splitting, one blank piece is dropped at each end, so `| | y | z |` is three cells (the first one empty), and so is `a | b | c`.

## Where the notices appear

### On stdout

When there is a problem, one more block appears after the diagrams block (`diagrams:`) and before `open:`, one line each:

```text
tables: 3 problems
  problem: migration/tech-debt.md:56 — 表格在第 56 行斷開（中間有空行或註解）：……
```

The file is relative to `--src`; the line is the line in the **source `.md` file**, counted from its first line with the frontmatter included, so opening the file at that line lands on it. Lines follow the order render processes the files, and line order within a file. Each line says how to fix it. With no problem, the block does not appear at all.

stdout and the page notices only carry file names, line numbers, row and cell counts and fixed wording, never the content of a cell or a paragraph; to see which text was dropped, open the file at the line.

### On the page

- A cut: a one-line notice **above** the text that did not make it into the table, with the line of the cut and the lines of that text.
- Extra cells: one notice **above** the table naming the row (counted from the top of the table, header not counted) and its line in the source file. A table with several such rows gets one notice listing all of them.
- The notice is a block of its own outside the table, so the cards and the table view show the same one; it has a warning-coloured line on its left, and it is printed as shown.
- The table and the text themselves are not changed by a single character: the cut-off rows are not joined back, and no cell is added or removed. The page shows the Markdown as it is — on GitHub, and in the copy the AI reads, it is broken too.

### In diagrams

When a table a diagram in `analysis.md` reads (the state, transition or flow table, picked by its columns) has a row whose extra cells hold text, or is followed by a cut, that `LC-nn` / `FL-nn` is not drawn; a one-line note says which table and which line instead, and stdout lists it on a `not drawn:` line as usual. For example:

```text
LC-01 沒有畫成圖：轉移表在原始檔第 12 行斷開，後面的列沒有讀到。
FL-01 沒有畫成圖：流程表第 2 列比表頭多出格子（原始檔第 9 行），欄位可能錯位。
```

A diagram only gets the rows before a cut, and drawn from them it would be missing the transitions or steps after it; a row with extra cells may have its values in the wrong columns. So no half diagram is drawn. The table gets its own notice as well. A table in the subsection that the diagram does not read only gets its notice, and the diagram is drawn.

## How to fix what is found

### A table cut short

- The lines belong to the table above: delete the blank lines between, and move the comment above or below the table.
- The lines are another table: first see whether the paragraph's first line is that table's header.
  - It is the header: look at the next line. If it is a delimiter row written wrong, correct it (each cell only `-`, optionally with `:`, as many cells as the header); if it is a data row, insert a delimiter row after the header, and keep every existing row as it is.
  - It is not the header: add a header row and a delimiter row before it, with the same number of cells.
- The paragraph is not a table at all (see known limitation 9): nothing needs changing; to stop the notice, put it in backticks.

### A row with extra cells

- Write a `|` in a cell as `\|`, inside backticks too (in a table, `\|` inside backticks shows as `|`).
- If the header is the one missing a column: add that column to both the header and the delimiter row.

## Not checked (known limitations)

These are the cases we know about and decided not to check. Each one says what goes wrong, why it is not prevented, who bears it, and what would make us reconsider.

1. **Only tables at the top level are checked.** A table inside a list item or a block quote that is cut short or has extra cells is not reported.
   - Why not prevented: diagrams only read top-level tables anyway; for a nested table the line numbers would have to be worked back from the list's or quote's indentation, which is easy to get wrong; such tables are rare (18 of the 755 tables we measured), and none of them was broken.
   - Who bears it: authors who write tables inside lists or quotes.
   - Reconsider: when someone reports a broken table in a list or quote that was not reported.
2. **A cut is not reported when the first cut-off line is not written like the table's rows.** For example the compact style (`|a|b|`, no space beside the bars), or a first line that itself has an extra cell. The cut-off rows still show as visible bars and text on the page; but when a table a diagram reads is cut like this, the diagram is still drawn from the rows before the cut, missing the transitions or steps after it.
   - Why not prevented: loosening the rule would report formulas that start with a bar (such as `|x| = |y|`).
   - Who bears it: people who write compact tables; people reading the page; people reading that diagram (who cannot see how many steps it lacks).
   - Reconsider: when someone reports it, or reports a diagram missing transitions or steps.
3. **Fewer cells than the header, and extra cells that are all empty, are not reported.** Both render the same as cells written empty (GFM allows leaving trailing empty cells out). But if the missing cell is one in the middle, the values after it shift one column left; and the card view (the default) hides empty fields, so a value appears under the wrong column name, looking completely normal. For example, with the header `| Item | Amount | Status |` and the row `| sample | active |`, the card says "Amount: active" and shows no Status. Extra empty cells can be the other half of the same shift.
   - Why not prevented: a machine cannot tell "left out at the end" from "missing in the middle"; reporting it would report a legitimate way of writing (the two render byte-identical HTML).
   - Who bears it: people reading the page (especially in the card view) and the writer.
   - Reconsider: when someone reports misreading a table because of it.
4. **A table that never forms is not reported**: a malformed or missing delimiter row, or a header and delimiter row with different cell counts, with no table before it. The page shows a whole paragraph of visible bars.
   - Why not prevented: with no table before it to compare with, it would mean guessing whether a paragraph starting with a bar is a table, and formulas and text would be reported.
   - Who bears it: the writer.
   - Reconsider: when someone reports it.
5. **No blank line between two tables**: the lower table's header and delimiter row become two rows of the upper one; with the same cell count nothing is reported (when the lower table is wider and the extra cells hold text, "a row with extra cells" is reported). The page shows a row of `---`.
   - Why not prevented: with the same cell count the joined result is still a valid table, and a machine cannot tell whether that was intended.
   - Who bears it: the writer.
   - Reconsider: when someone reports it.
6. **Where render's page and GitHub's differ, render's is reported.** When render removes a `dflow:section` marker before converting, the blank lines after the marker go with it; if a cut falls exactly there, the table is joined on render's page and cut on GitHub, and nothing is reported.
   - Why not prevented: the checks report what is really broken on render's page; removing the markers is how render already prepares a file.
   - Who bears it: people reading the Markdown on GitHub.
   - Reconsider: when someone reports it.
7. **Only people who run render see it.** People reading the Markdown directly on GitHub or in an editor get no notice; `dflow doctor` does not run the same checks.
   - Why not prevented: landing projects rely on `dflow doctor` to confirm an upgrade took effect, and one more kind of finding would change that output, so doctor does not share these checks.
   - Who bears it: projects that do not run render.
   - Reconsider: when someone reports being misled by a broken table without having run render — the checks are a standalone function, so doctor can use them without rewriting them.
8. **Right cell count, content in the wrong column, is not caught.** For example a row missing one cell and having one extra.
   - Why not prevented: telling that content is in the wrong column means understanding the content, which a machine cannot judge reliably.
   - Who bears it: the writer and the reviewer.
   - Reconsider: when someone reports it.
9. **Very rarely, text that is not a table is reported as a cut**: right after a table (only blank lines or comments between), its first line starting with `|` and a space, ending with a space and `|`, and with exactly as many cells as that table — for example |a| + |b| written as `| a | + | b |` right after a three-column table. The notice is shown; that text was never a table, so nothing needs changing; to stop the notice, put it in backticks.
   - Why not prevented: excluding it would mean guessing, beyond "the first line is written like the table's rows", whether the content looks like a formula; this way of writing is very rare, and the notice says what to do.
   - Who bears it: people who write such formulas.
   - Reconsider: when someone reports it.
