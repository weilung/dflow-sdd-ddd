# 收尾 commit 的機械檢查：`dflow check-closeout`

> **繁體中文** | [English](closeout-check.en.md)

> 本頁跟著原始碼的 `main` 分支走。`dflow check-closeout` 從 Dflow `0.15.5` 起才有；如果 `dflow check-closeout --help` 回 `Unsupported subcommand`，就是你裝的 CLI 比它早。`@latest` 裝的是最新**已發布**的 CLI，不保證本頁講的功能已經發布——一個已發布版本包含什麼，看它的 changelog。

`/dflow:finish-feature` 收尾一個 feature 時：把 feature 目錄標成完成、用 `git mv` 從 `dflow/specs/features/active/` 搬到 `dflow/specs/features/completed/`、在 `_index.md` 記下收尾，然後 commit——commit 完再檢查一遍。這些步驟每一步都是交給 AI 照做的指示。其中一步被跳過，不一致的歸檔就可能沒有人發現地落地：目錄已經在 `completed/`，裡面的 `_index.md` 卻還寫著 `status: in-progress`；或是 `active/` 裡留著一份副本。落地之後，不會再有任何東西去讀這份歸檔。

`dflow check-closeout` 把這份檢查裡機械判得準的部分，從「靠 AI 記得跑」改成「由 git 觸發」：它是一個**以結束碼當閘**的指令，接在 pre-commit hook 或 CI job 上，設定一次就好。Dflow 不會替你安裝這兩者——接法範本在下面。

## 檢查什麼

它只看這次變動**新歸檔**的 feature 目錄：`dflow/specs/features/completed/` 底下，變動之後有檔、變動之前一個檔都沒有的目錄。git 把這些檔配成改名（`R`）還是刪除加新增（`D` ＋ `A`），不影響判斷。

- 原本在 `active/`、而且同名的目錄，就是新歸檔的 host（掛載這次變更的規格紀錄目錄，不是程式目錄），要檢查。用 `--range` 時，「原本在 `active/`」指的是 merge base 當時在，或範圍裡任何一顆 commit 碰過它——一條 feature 分支通常自己建 host、也自己收尾。
- 其餘新出現的目錄——從 `active/` 搬過來時順便改了名、直接建在 `completed/`、或替 `completed/` 裡已歸檔的 host 改名——報成 `[uncertain]`：`/dflow:finish-feature` 搬 host 時不改名，所以閘不去猜它是其中哪一種，交給人確認。

每一個新歸檔的 host 檢查五項：

1. `_index.md` 存在，frontmatter 寫的是 `status: completed`。
2. `dflow/specs/features/active/<host>/` 底下沒有留下任何檔——host 是搬走的，不是複製的。
3. host 裡每一份 spec 都寫著 `status: completed`。哪些是 spec，看出貨範本放進 feature 目錄、而且帶 `status` 欄位的那幾種：`lightweight-*.md`、`BUG-*.md`、`phase-spec-*.md`。專案自己加進 host 的文件不檢查，不管它的 frontmatter 寫了什麼。
4. `_index.md` 的 `## Checkpoint Log` 有一列 `closeout`，Result 是 `committed` 或 `skipped`。範本自帶的那一列佔位（Timestamp `{YYYY-MM-DD HH:MM}`、Result `committed / skipped / failed`）不算。Result 是 `failed` 會擋下：你正要做的這顆 commit 會記下「它自己的 commit 失敗了」——通常是先前一次被 hook 擋下，flow 把那一列改成了 `failed`。
5. 只有 `--staged`：歸檔目錄底下沒有被這顆 commit 漏掉的東西——已追蹤的檔改了或刪了卻沒 stage，或是新檔既沒 add、也沒被忽略。

標準寫法它都判得準：範本的 frontmatter（包括行尾的 `# in-progress | completed` 註解、加了引號的值）、CRLF 換行、BOM（檔案開頭的位元組順序標記）、任何語言的目錄名。整份照 `dflow/specs/shared/dflow-workflows/templates/` 底下投影出去的範本複製的文件，第一行會是 `<!-- dflow-generated: workflow-bundle -->`；那一行底下的 frontmatter 不算 frontmatter（`dflow render` 與 `dflow doctor` 也這樣讀），所以會擋下，並寫明修法：刪掉那一行和它後面的空行。

## 不檢查什麼

`/dflow:finish-feature` 在 commit 之後的驗證，其餘部分需要收尾時的基準（baseline）與判斷，所以仍然由 AI 做、由 pr-review 把關：

- 歸檔內容對照收尾基準的逐檔比對；
- 收尾 commit 只帶收尾准許寫的路徑；
- 回填的 `Commit` 格填的是那一列自己的實作 hash；
- 最小 host（沒有 phase 的 host）：checkpoint 1 仍帶著 Step 1 驗過的 hash，以及這個 host 剛好兩顆 commit。`--range` 看的是最終狀態，所以用第三顆 commit 修好的最小 host 在這裡會通過；那一顆由 pr-review 檢查整段歷史的那一項數到。

這次變動之前就歸檔的 host，它不回頭讀，只有一個例外：`--staged` 會再檢查一次 `HEAD` 這顆 commit 自己歸檔的 host（見下面「怎麼跑」）。這個閘出現之前的歸檔，可能本來就不一致，或是用較早的寫法寫成；每次都把舊歸檔全部讀一遍，會擋下跟它們毫無關係的 commit 與 merge request。

**通過不代表收尾是乾淨的。** 它只代表機器判得準的那一部分是一致的。

## 怎麼跑

在含有 `dflow/specs/` 的目錄執行。專案可以在 repository 根目錄底下的子目錄。

```bash
dflow check-closeout                          # 同 --staged
dflow check-closeout --staged                 # pre-commit hook：檢查 index，也就是這顆 commit 要記下的內容
dflow check-closeout --range <base>..<head>   # CI：拿 <head> 的最終狀態，和它與 <base> 的 merge base 比
```

- `--staged` 也會檢查 `HEAD` 這顆 commit 自己歸檔的 host（`HEAD` 是 merge commit 時除外）。pre-commit hook 分不出 `git commit --amend` 和一顆新 commit，而最小 host 修正收尾 commit 的方式正是 amend，所以已經在 `HEAD` 裡的 host 必須留在範圍內。代價是：收尾之後的下一顆 commit 會再檢查一次那個 host——它仍然一致就照樣通過。
- `--range` 檢查 `<head>` 的**最終狀態**，不是一顆一顆 commit 查：收尾之後在分支上用另一顆 commit 修好的，照樣通過。它需要完整的歷史（`git merge-base` 要找得到基準）。

### 結束碼

| 結束碼 | 意思 |
|---|---|
| `0` | 沒有新歸檔的 feature 目錄，或每一個都通過。 |
| `1` | 有檢查沒過（`[fail]`）、有它看不準的寫法（`[uncertain]`），或跑不起來：不是 git repository、目前目錄沒有 `dflow/specs/`、參數錯。 |

每一個問題都會寫出是哪個 host、哪裡不對、怎麼修。

### 它說 `[uncertain]` 的時候

`[uncertain]` 一樣會擋下：閘不會把它讀不準的東西報成通過。它出現在閘不去猜的寫法上——spec 沒有 frontmatter，或有兩個 `status:`；沒有 `## Checkpoint Log`，或那張表沒有 `Checkpoint` 與 `Result` 欄；closeout 列用了較早的寫法（說明與 checkpoint 寫在同一格，例如 `closeout（/dflow:finish-feature）：…`）；新出現的目錄從來沒以這個名字在 `active/` 裡——包括你替已歸檔的 host 改了名。

1. **能改成標準寫法就改。** 訊息會說怎麼改：把範本的 `status:` 那一行放回去、把那一列改寫成 Checkpoint `closeout`、Result `committed` 或 `skipped`。這是一勞永逸的做法——下一次就讀得到。
2. **你讀過、確認沒問題的話**，只讓這一顆 commit 通過：hook 用 `git commit --no-verify`；CI 則照你們團隊接受「已知某個 job 失敗」的 merge request 的方式處理。

⚠ 因為上面那條 amend 的規則，`HEAD` 從 `active/` 搬過來的 host，下一顆 commit 還會再檢查一次。所以這樣的 host 用 `--no-verify` 放過之後，下一顆 commit 會再被它擋一次；改成標準寫法就沒有這個問題，不改的話，那一顆也要 `--no-verify`。（因為從來沒在 `active/` 裡而被報出來的目錄，不會再檢查一次。）

## pre-commit hook

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

它依序做三件事：

1. 拿 index 和 `--staged` 用的同一個「之前」比。`completed/` 底下什麼都沒變，就直接放行——一般的 commit 只多幾次 git 呼叫，不會啟動 Node。只改訊息的 amend 收尾 commit 照樣會呼叫閘，收尾之後的下一顆 commit 也會。
2. 這台電腦沒裝 `dflow` CLI 時，印一行說明，然後放行：團隊裡不一定每個人都裝了 CLI，第二道防線是 CI job。
3. 其餘情況執行 `dflow check-closeout --staged`，由它的結束碼決定放不放行。

**安裝方式**——三選一：

- **跟團隊共用。** 存成 repository 裡的 `.githooks/pre-commit`，設為可執行（`chmod +x .githooks/pre-commit`）並 commit；每個 clone 各執行一次：

  ```bash
  git config core.hooksPath .githooks
  ```

- **只給這個 clone 用。** 存成 `.git/hooks/pre-commit`，設為可執行。
- **已經在用 hook 管理工具。** 把腳本存進 repository（例如 `.githooks/dflow-closeout.sh`），在管理工具的設定裡呼叫它：
  - husky——在 `.husky/pre-commit` 加一行：`sh .githooks/dflow-closeout.sh`
  - lefthook——在 `lefthook.yml`：

    ```yaml
    pre-commit:
      commands:
        dflow-closeout:
          run: sh .githooks/dflow-closeout.sh
    ```

  - pre-commit——在 `.pre-commit-config.yaml`：

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

    ⚠ pre-commit 這套工具在跑 hook 之前，會把已追蹤檔案上沒 stage 的修改先收起來，所以在它底下，第 5 項看不到這些修改。第 1–4 項讀的本來就是要 commit 的內容，不受影響。

在 Windows 上，Git for Windows 用它自帶的 `sh` 跑 hook。Dflow 專案不在 repository 根目錄時，把 `cd` 那一行的註解拿掉並改成實際路徑：hook 一開始是在 repository 根目錄。

## CI

CI job 是第二道防線：它抓的是沒經過 hook 就進了分支的東西——沒設定 hook 的 clone、沒裝 CLI 的電腦、`--no-verify`。兩份範本都用 `npx` 跑 CLI，版號取自專案的 workflow bundle（`dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json` 的 `"version"`），所以閘照專案正在用的那一版 Dflow 的規則判，升級之後也會跟著換。那一版必須已經有 `check-closeout`；換成別的版本，就照那一版自己的規則判。job 需要 Node 22 以上（`package.json` 的 `engines`），以及完整的歷史。

### GitLab（merge request pipeline）

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

image 除了 Node 還要有 `git`——`node:22` 有；Alpine 的 image 沒有。

### GitHub Actions（pull request）

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

`--range` 用的是 pull request 的 head commit，不是 GitHub checkout 出來的那顆 merge commit：merge commit 還帶著這段期間進了 base 分支的其他東西，別人的歸檔不該決定你的 pull request。

## 做了之後仍然存在的風險

- **沒接就沒有保護。** 這是每個 repository 設定一次（CI）、每個 clone 設定一次（hook）的東西，不是預設開啟。
- **可以繞過：** `git commit --no-verify`，或一台沒裝 CLI 的電腦。只有 CI job 補得上這一塊。
- **只檢查機械判得準的那一部分**（見上）。其餘仍然靠 `/dflow:finish-feature` 裡 AI 的驗證與 pr-review。
- **它跟著範本走。** 之後的範本若改了 `status` 或 Checkpoint Log 的寫法，閘會在同一個版本跟著改；CLI 與 bundle 版本不同時，兩者可能判得不一樣。
