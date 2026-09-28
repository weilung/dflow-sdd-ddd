# Checking the closeout commit: `dflow check-closeout`

> [繁體中文](closeout-check.md) | **English**

> This page tracks the source `main` branch. `dflow check-closeout` first ships in Dflow `0.16.0` (the public source has it from `0.15.5`); if `dflow check-closeout --help` answers `Unsupported subcommand`, your installed CLI predates it. `@latest` installs the latest **published** CLI, which does not guarantee that a feature on this page has been released — the changelog of a published release says what it includes.

`/dflow:finish-feature` closes a feature out: it marks the feature directory completed, moves it from `dflow/specs/features/active/` to `dflow/specs/features/completed/` with `git mv`, records the closeout in its `_index.md`, and commits — then checks the commit. Every one of those steps is an instruction the AI follows. When one is skipped, an inconsistent archive can land without anyone noticing: the directory is in `completed/` while the `_index.md` inside it still says `status: in-progress`, or a copy is left behind in `active/`. Nothing reads an archive after that.

`dflow check-closeout` moves the mechanical part of that check from "the AI remembers to run it" to "git runs it": a command whose **exit code is a gate**, for a pre-commit hook or a CI job that you set up once. Dflow does not install either for you — the templates are below.

## What it checks

It looks only at feature directories **newly archived** by the change: a directory under `dflow/specs/features/completed/` that has files after the change and had none before. Whether git pairs the files as a rename (`R`) or as a delete plus an add (`D` + `A`) does not matter.

- A directory that was in `active/` under the same name is a newly archived host, and is checked. For `--range`, "was in `active/`" means at the merge base or at any commit in the range — a feature branch usually opens its host and archives it.
- Any other new directory — renamed on the way from `active/`, created directly in `completed/`, or an archived host renamed inside `completed/` — is reported as `[uncertain]`: `/dflow:finish-feature` moves a host without renaming it, so the gate does not guess which of these a directory is, and a person confirms it.

For each newly archived host:

1. `_index.md` exists and its frontmatter says `status: completed`.
2. Nothing is left under `dflow/specs/features/active/<host>/` — the host was moved, not copied.
3. Every spec in the host says `status: completed`. The spec files are the ones the shipped templates put in a feature directory with a `status` field: `lightweight-*.md`, `BUG-*.md` and `phase-spec-*.md`. A document your project adds to a host is not checked, whatever its frontmatter says.
4. The `## Checkpoint Log` in `_index.md` has a `closeout` row whose Result is `committed` or `skipped`. The template's own placeholder row (Timestamp `{YYYY-MM-DD HH:MM}`, Result `committed / skipped / failed`) does not count. A Result of `failed` blocks: the commit you are making would record that its own commit failed — usually a hook refused an earlier attempt and the flow flipped the row.
5. With `--staged` only: nothing under the archived directory is left out of the commit — a tracked file edited or deleted but not staged, or a new file that is neither added nor ignored.

It reads the standard shapes exactly — the template's frontmatter, including a trailing `# in-progress | completed` comment and a quoted value; CRLF line endings; a byte-order mark; a directory name in any language. A document copied whole from a template's projected copy under `dflow/specs/shared/dflow-workflows/templates/` starts with `<!-- dflow-generated: workflow-bundle -->`; the frontmatter under that line is not frontmatter (to `dflow render` and `dflow doctor` either), so it fails, with the repair named: delete the line and the blank line after it.

## What it does not check

The rest of `/dflow:finish-feature`'s post-commit verification needs the closeout baseline and judgement, so it stays with the AI and with pr-review:

- the file-by-file comparison of the archive against the closeout baseline;
- that the closeout commit carries only the paths closeout may write;
- that a backfilled `Commit` cell holds that row's own implementation hash;
- for a minimal (zero-phase) host: that checkpoint 1 still carries the hash Step 1 verified, and that the host has exactly two commits. `--range` looks at the final state, so a minimal host repaired by a third commit passes here; pr-review's whole-history item counts it.

It does not re-read hosts archived before the change, with one exception: `--staged` checks once more a host the `HEAD` commit itself archived (see "Running it" below). An archive made before this gate existed may be inconsistent, or written in an older shape; checking every old archive would block commits and merge requests that have nothing to do with it.

**Passing does not mean the closeout is clean.** It means the parts a machine can judge are consistent.

## Running it

Run it from the directory that holds `dflow/specs/`. The project may sit below the repository root.

```bash
dflow check-closeout                          # the same as --staged
dflow check-closeout --staged                 # a pre-commit hook: checks the index — what the commit will record
dflow check-closeout --range <base>..<head>   # CI: checks the final state of <head> against its merge base with <base>
```

- `--staged` also checks a host the `HEAD` commit itself archived (unless `HEAD` is a merge commit). A pre-commit hook cannot tell `git commit --amend` from a new commit, and amending is how a minimal host repairs its closeout commit, so a host already in `HEAD` has to stay in scope. The cost: the commit right after a closeout checks that host once more, and passes when it is still consistent.
- `--range` checks the **final state** of `<head>`, not each commit on the way: a closeout repaired by a later commit on the branch passes. It needs the full history (`git merge-base` has to find the base).

### Exit status

| Exit | Meaning |
|---|---|
| `0` | No feature directory is newly archived, or every one passed. |
| `1` | A check failed (`[fail]`), a shape could not be read with confidence (`[uncertain]`), or the check could not run: not a git repository, no `dflow/specs/` in the current directory, bad arguments. |

Each problem names the host, what is wrong, and how to fix it.

### When it says `[uncertain]`

An `[uncertain]` result blocks too: the gate will not report something it cannot read as passing. It appears for a shape the gate does not guess about — a spec with no frontmatter, or with two `status:` fields; no `## Checkpoint Log`, or one without `Checkpoint` and `Result` columns; a closeout row written in an older way (the explanation and the checkpoint in one cell, such as `closeout（/dflow:finish-feature）：…`); a new directory that was never in `active/` under its name — including an archived host you renamed.

1. **Fix the shape if you can.** The message says how: restore the template's `status:` line, rewrite the row as Checkpoint `closeout` and Result `committed` or `skipped`. That is the durable fix — the next run reads it.
2. **If you read it and it is right,** let that one commit through: `git commit --no-verify` for the hook; for CI, whatever your team uses to accept a merge request with a known failing job.

⚠ Because of the amend rule above, a host that `HEAD` moved from `active/` is checked once more by the commit after it. So when you let such a host through with `--no-verify`, the next commit is blocked by it again; fixing the shape avoids that, otherwise that commit needs `--no-verify` too. (A directory reported because it was never in `active/` is not checked again.)

## Pre-commit hook

```sh
#!/bin/sh
# dflow check-closeout pre-commit hook
# https://github.com/weilung/dflow-sdd-ddd/blob/main/docs/closeout-check.en.md
#
# If the Dflow project is not at the repository root, uncomment and set this:
# cd path/to/project || exit 1

# The same "before" that dflow check-closeout --staged uses: HEAD's parent when
# HEAD is an ordinary commit (so amending a closeout commit is still checked),
# HEAD itself when it is a merge or the first commit, and the empty tree before
# any commit exists.
if head=$(git rev-list --parents -n 1 HEAD 2>/dev/null); then
  set -- $head
  if [ $# -eq 2 ]; then before=HEAD^; else before=HEAD; fi
else
  before=$(git hash-object -t tree /dev/null)
fi

# Nothing under completed/ changed: an ordinary commit, and Node is not started.
if git diff --cached --quiet "$before" -- dflow/specs/features/completed/; then
  exit 0
fi

if ! command -v dflow >/dev/null 2>&1; then
  echo "dflow check-closeout skipped: no dflow CLI on this machine (a CI job is the second line)." >&2
  exit 0
fi

exec dflow check-closeout --staged
```

What it does, in order:

1. It compares the index with the same "before" as `--staged`. When nothing under `completed/` changed, it exits at once — an ordinary commit costs a couple of git calls and never starts Node. A message-only amend of a closeout commit still reaches the gate, and so does the commit right after a closeout.
2. When the `dflow` CLI is not installed on this machine, it says so in one line and lets the commit through: not everyone on a team has the CLI, and a CI job is the second line.
3. Otherwise it runs `dflow check-closeout --staged`, and its exit code decides.

**Installing it** — pick one:

- **Shared with the team.** Save it as `.githooks/pre-commit` in the repository, make it executable (`chmod +x .githooks/pre-commit`), commit it, and have every clone run once:

  ```bash
  git config core.hooksPath .githooks
  ```

- **This clone only.** Save it as `.git/hooks/pre-commit` and make it executable.
- **You already use a hook manager.** Save the script in the repository (for example `.githooks/dflow-closeout.sh`) and call it from the manager's configuration:
  - husky — add a line to `.husky/pre-commit`: `sh .githooks/dflow-closeout.sh`
  - lefthook — in `lefthook.yml`:

    ```yaml
    pre-commit:
      commands:
        dflow-closeout:
          run: sh .githooks/dflow-closeout.sh
    ```

  - pre-commit — in `.pre-commit-config.yaml`:

    ```yaml
    repos:
      - repo: local
        hooks:
          - id: dflow-closeout
            name: dflow check-closeout
            entry: sh .githooks/dflow-closeout.sh
            language: system
            pass_filenames: false
            always_run: true
    ```

    ⚠ The pre-commit framework sets unstaged edits to tracked files aside before it runs hooks, so check 5 does not see those there. Checks 1–4 read what is being committed either way.

On Windows, Git for Windows runs the hook with its own `sh`. When the Dflow project is below the repository root, uncomment the `cd` line: a hook starts at the repository root.

## CI

The CI job is the second line: it catches what reached the branch without the hook — a clone that never set it up, a machine without the CLI, a `--no-verify`. Both templates run the CLI with `npx`, taking the version from your project's workflow bundle (`"version"` in `dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json`), so the gate follows the rules of the Dflow version your project uses — and follows it again after you upgrade. That version must include `check-closeout`; a CLI of another version judges by its own rules. The job needs Node 22 or later (`package.json` `engines`), and the full history.

### GitLab (merge request pipeline)

```yaml
dflow-closeout:
  image: node:22
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  variables:
    GIT_DEPTH: "0"
  script:
    # - cd path/to/project   # if the Dflow project is not at the repository root
    - DFLOW_VERSION=$(node -p "require('./dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json').version")
    # A merged results pipeline builds on a merge commit; the source branch head is what this merge request archived.
    - npx --yes "dflow-sdd-ddd@$DFLOW_VERSION" check-closeout --range "$CI_MERGE_REQUEST_DIFF_BASE_SHA..${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA:-$CI_COMMIT_SHA}"
```

The image needs `git` as well as Node — `node:22` has it; an Alpine image does not.

### GitHub Actions (pull request)

```yaml
name: Dflow closeout check
on: pull_request
jobs:
  closeout:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 22
      - name: dflow check-closeout
        # working-directory: path/to/project   # if the Dflow project is not at the repository root
        env:
          PR_BASE: ${{ github.event.pull_request.base.sha }}
          PR_HEAD: ${{ github.event.pull_request.head.sha }}
        run: |
          DFLOW_VERSION=$(node -p "require('./dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json').version")
          npx --yes "dflow-sdd-ddd@$DFLOW_VERSION" check-closeout --range "$PR_BASE..$PR_HEAD"
```

`--range` uses the pull request's head commit, not the merge commit GitHub checks out: a merge commit also carries whatever reached the base branch in the meantime, and someone else's archive should not decide your pull request.

## What is left open

- **Nothing is protected until it is set up.** This is set up once per repository (CI) and once per clone (the hook); it is never on by default.
- **It can be bypassed:** `git commit --no-verify`, or a machine without the CLI. Only a CI job closes that.
- **Only the mechanical part is checked** (above). The AI's verification in `/dflow:finish-feature` and pr-review still carry the rest.
- **It follows the templates.** If a later template changes how `status` or the Checkpoint Log is written, the gate changes with it in the same release; a CLI and a bundle of different versions can disagree.
