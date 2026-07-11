# Dflow 命令表面導讀

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份導讀回答一個很實際的問題：讀者在 tutorial、README、AI 對話或公司內部教學中看到
`dflow init`、`dflow doctor`、`/dflow:new-feature`、
`/dflow:next`、`/dflow:verify` 這些入口時，應該怎麼理解它們的分工？

Dflow 有兩層命令表面：

| 層級 | 形式 | 在哪裡執行 | 用途 |
|---|---|---|---|
| npm CLI | `dflow init`、`dflow doctor`、`dflow configure-agents` | shell / terminal | 建立或檢查 Dflow workspace、AI tool shim 與選配 command adapters。 |
| AI workflow command | `/dflow:new-feature`、`/dflow:modify-existing` 等 | AI coding agent 對話 | 引導 feature、phase、bug fix、finish、verify、review 等日常協作流程。 |

兩者不是替代關係。CLI 負責把 Dflow 裝進專案；`/dflow:*` workflow 負責讓 AI
coding agent 在已初始化的專案裡依規格與 DDD 流程工作。

## 本頁適合誰讀

| 你遇到的問題 | 本頁能幫你釐清什麼 |
|---|---|
| 不確定 `init` 是不是 slash command | `init` 是 npm CLI，不是 `/dflow:init-project`。 |
| 不知道 feature 要用哪個 `/dflow:*` | 本頁按工作類型整理 workflow command。 |
| 擔心 AI 一路自動做下去 | 本頁說明 `/dflow:next`、step gate、`/dflow:cancel` 的控制角色。 |
| 看過早期草稿或舊討論，命令名稱不一致 | 本頁列目前 V1 公開命令表面。 |
| 公司內部要教同事怎麼開工 | 本頁可作為 tutorial 前置閱讀。 |

## 先記住一句話

```text
先用 CLI 建立 Dflow workspace；
再用各工具支援的 Dflow 叫法讓 AI coding agent 依 workflow 做事。
```

換成實際流程：

```text
1. 在 shell 執行 dflow init（全域安裝後）
2. 檢查產生的 dflow/specs/ 與 AI instruction files
3. 打開 AI coding agent
4. 若需要工具原生命令入口，先執行 dflow configure-agents --command-adapters
5. 依工具輸入 /dflow:new-feature、/dflow-new-feature、dflow:new-feature 等
6. 在 step gate 用 /dflow:next、dflow:next 或自然語言確認是否繼續
```

## npm CLI：專案層級的建立與檢查

### `dflow init`

這是第一次導入 Dflow 的入口。它在 shell 執行，不在 AI 對話裡執行。

全域安裝後執行：

```bash
dflow init
```

> **npx 替代路徑**：若不想做全域安裝（無 admin 權限、暫時性環境、或只想一次性評估），
> 可改用 `npx dflow-sdd-ddd init`。使用此路徑時，後續所有 CLI 命令（`doctor`、
> `configure-agents`）也必須使用 `npx dflow-sdd-ddd <subcommand>` 形式。
> 完整說明見 [README.md 的「Alternative: try without installing」段](../README.md)。

它會詢問：

- greenfield 或 brownfield
- tech stack
- migration context
- prose language
- optional starter files
- 要建立哪些 AI tool shim

它會建立或準備：

```text
dflow/specs/
  shared/
  domain/
  architecture/
  features/
AGENTS.md / CLAUDE.md / .github/copilot-instructions.md
```

它不會做的事：

- 不會讀取整個 app code 後自動重構
- 不會搬移 legacy code
- 不會自動建立第一個 feature spec
- 不會取代 `/dflow:new-feature`、`/dflow:modify-existing` 等日常 workflow

Greenfield 範例可看：
[〈Walkthrough 01 — `dflow init` 建立 Greenfield baseline〉](01-greenfield/walkthrough-01-init-project.md)

Brownfield 範例可看：
[〈Walkthrough 01 — `dflow init` 建立 Brownfield baseline〉](02-brownfield/walkthrough-01-init-project.md)

### `dflow configure-agents`

如果專案已經初始化，後來團隊新增另一個 AI coding agent，就用這個命令。

```bash
dflow configure-agents
```

它只處理 AI instruction files，不重跑 init，也不重新建立 specs。

若需要 Claude Code / GitHub Copilot 的工具原生命令入口，可使用 opt-in 版本：

```bash
dflow configure-agents --command-adapters
```

這會保留 canonical `/dflow:*` 共同詞彙，但依工具實際 `/` parser 行為產生或提示不同叫法：

| 工具 | 實際叫法 |
|---|---|
| Claude Code | `/dflow:<id>`，例如 `/dflow:new-feature` |
| GitHub Copilot | chat 文字可用 `/dflow:<id>`；VS Code prompt 選單使用 `/dflow-<id>` |
| Codex CLI | 不帶斜線的純文字 `dflow:<id>`，例如 `dflow:new-feature` |

如果從 Dflow 0.5.0 升級並使用 Claude Code adapters，請手動刪除舊的
`.claude/commands/dflow/dflow-*.md`，避免同時看到舊的 `/dflow:dflow-<id>` 與新的
`/dflow:<id>`。

典型用途：

| 情境 | 例子 |
|---|---|
| 一開始只用 Codex，後來加 Claude Code | 新增或提供 `CLAUDE.md` shim。 |
| 一開始只用 Claude Code，後來加 Codex | 新增或提供 `AGENTS.md` shim。 |
| 公司開始要求 GitHub Copilot instructions | 新增或提供 `.github/copilot-instructions.md`。 |

### `dflow doctor`

`doctor` 是 read-only health check。

```bash
dflow doctor
```

它用來檢查專案健康狀態，例如：

- `dflow/specs/shared/_conventions.md` 缺少 Dflow Version 標記行
- upgrade 後殘留、已退役的 workflow bundle 檔

它不會修檔，只回報 findings。

## AI workflow command：日常開發流程

`/dflow:*` 命令是在 AI coding agent 對話中使用。它們不是 shell command。

`/dflow:*` 是 canonical 共同詞彙，但各 AI 工具的 `/` parser 行為不同。若工具不支援
真正的 slash command，也可以把 workflow 名稱當作普通訊息輸入，例如：

```text
Run the Dflow /dflow:new-feature workflow.
```

或：

```text
請依 Dflow 的 /dflow:modify-existing workflow 處理這個需求。
```

關鍵不是 UI 是否有 slash command parser，而是 AI coding agent 能讀到專案內的
Dflow workflow instructions 與 `dflow/specs/`。

實務上：Claude Code 安裝 command adapters 後使用 `/dflow:<id>`；Copilot 可用
canonical `/dflow:<id>` 文字或 `/dflow-<id>` prompt 選單；Codex CLI 請用不帶斜線的
`dflow:<id>`，避免被 Codex 自己的 slash command parser 攔截。

## Workflow entry commands

這些命令會啟動一個主要工作流程。

| Command | 什麼時候用 | 典型產出 |
|---|---|---|
| `/dflow:new-feature` | 新的使用者能力、業務行為、或第一個 bounded context。 | feature directory、phase spec、aggregate design、domain docs updates。 |
| `/dflow:modify-existing` | 修改既有行為。 | impact analysis、delta / lightweight spec、updated rules / docs。 |
| `/dflow:bug-fix` | 有明確 expected vs actual 的 defect。 | lightweight spec、reproduction、fix plan、regression check。 |
| `/dflow:pr-review` | 變更準備 review。 | SDD / DDD compliance review、risks、gaps、follow-up。 |

### `/dflow:new-feature`

用在新的業務能力。Greenfield 第一個 feature 幾乎一定從這裡開始。

本 tutorial 已有完整中文 walkthrough：

- [01-greenfield/walkthrough-02-new-feature.md](01-greenfield/walkthrough-02-new-feature.md)

它會先做：

```text
intake -> bounded context -> domain modeling -> slug confirmation -> spec
```

然後才進 implementation plan。這就是 spec-first。

### `/dflow:modify-existing`

用在「既有行為要改」。

它特別適合 brownfield，因為 brownfield 很常不是新增乾淨 feature，而是：

- 某段 code-behind 裡的折扣規則要改
- 既有 rounding 行為要補 baseline
- 舊系統中散落的 business rule 要逐步抽出

Brownfield 劇情目前從這裡展開：

- [02-brownfield/walkthrough-02-modify-existing.md](02-brownfield/walkthrough-02-modify-existing.md)

### `/dflow:bug-fix`

用在 defect 可以明確說出 expected vs actual 的時候。

它不是 Git Flow 的 hotfix branch 概念；它是 Dflow 的 bug-fix ceremony。
branch 策略仍依專案自己的 Git principles。

典型輸入：

```text
/dflow:bug-fix Reject reason 包含 emoji 時前端截斷，Domain 收到 malformed string 後誤判長度不足。
```

Dflow 會要求把現有行為、預期行為、根因、修復位置、regression check 記錄下來。

### `/dflow:pr-review`

用在 code 已經準備 review 時。

它的重點不是一般 code style review，而是：

- PR 是否符合 spec intent
- BR / behavior scenarios 是否有實作或測試覆蓋
- Aggregate boundary 是否被破壞
- Domain layer 是否維持乾淨
- 是否需要補 spec、rules、events、tech-debt

如果 reviewer 不先讀 spec intent，AI-assisted SDD 的 upstream work 就失去驗證機制。

## Phase commands

### `/dflow:new-phase`

用在 active feature 需要新增一個 implementation slice。

例如 Greenfield 劇情中，phase 1 完成員工提交費用單後，phase 2 要加主管審核：

- [01-greenfield/walkthrough-03-new-phase.md](01-greenfield/walkthrough-03-new-phase.md)

`/dflow:new-phase` 的重點是：它不是開一個 unrelated new feature，而是在同一個
active feature directory 內新增 phase spec、更新 Current BR Snapshot、依
Implementation Tasks 實作與驗證，最後把該 phase 標記 completed。

限制：

- 只適用 active feature
- 如果 feature 已經在 `completed/`，應改用 `/dflow:modify-existing` 開 follow-up
- 不應該把 completed feature 重新打開硬塞新需求
- 不同步 BC-level living docs、不搬移 feature directory；那些是 `/dflow:finish-feature`
  的責任

## Closeout commands

### `/dflow:finish-feature`

用在 feature implementation 完成後的收尾。

它會做的事：

- 確認所有 phase spec 狀態
- 做 drift / completion checklist
- 將 feature-level BR snapshot 同步到 bounded-context layer
- 更新 `rules.md`、`behavior.md`、`models.md`、`events.md` 等 system docs
- 將 feature directory 從 `active/` 移到 `completed/`
- 產出 integration summary

它不會做的事：

- 不會自動 merge PR
- 不會自動 publish package
- 不會自動 tag 或 release

Greenfield closeout 範例：

- [01-greenfield/walkthrough-06-finish-feature.md](01-greenfield/walkthrough-06-finish-feature.md)

Brownfield closeout 範例：

- [02-brownfield/walkthrough-06-finish-feature.md](02-brownfield/walkthrough-06-finish-feature.md)

## Control commands

這些命令管理 active workflow 的節奏。

| Command | 用途 |
|---|---|
| `/dflow:next` | 在 step gate 確認繼續。自然語言「好」「OK」「繼續」也可作為 confirmation。 |
| `/dflow:status` | 詢問目前 workflow、step、progress、pending decision。 |
| `/dflow:cancel` | 中止目前 workflow，回到一般對話；已建立 artifacts 會保留，不自動刪除。 |

### `/dflow:next`

Dflow 不會每個小 step 都停下來等你按下一步。它只在重要的 step gate 停等。

以 `/dflow:new-feature` 為例，重要 gate 包含：

```text
Step 3 -> Step 3.5
Aggregate / VO / Events identified -> confirm SPEC-ID, slug, directory, branch

Step 4 -> Step 5
Spec written -> plan implementation

Step 6 -> Step 7
Branch ready -> start implementation

Step 7 -> Step 8
Implementation done -> completion checklist
```

`/dflow:new-phase` 也有自己的 gate：Step 3 -> 4 確認 phase slug 後寫 spec、
Step 4 -> 5 refresh `_index.md`、Step 5 -> 6 開始 implementation、Step 6 -> 7
完成 phase。

這讓 workflow 不會碎到難用，也不會在高風險轉折點自動暴衝。

### `/dflow:status`

用在你忘記目前走到哪裡時。

典型問題：

```text
/dflow:status
```

或：

```text
我們現在到哪一步？
```

Dflow 應該回報：

- active workflow
- current step
- completed items
- pending decision
- next valid action

### `/dflow:cancel`

用在你想停止 active workflow，而不是繼續讓 AI 推進。

它不代表 rollback。已經寫出的 spec 或 artifact 會保留，因為它們可能仍有參考價值。
如果需要刪檔或重置，應另外明確要求，並依 repo 規則確認。

## Verification and review

### `/dflow:verify`

`/dflow:verify` 是 AI workflow command，不是 `dflow doctor`。

| Command | 作用 |
|---|---|
| `dflow doctor` | CLI read-only 專案健康檢查。 |
| `/dflow:verify` | AI workflow drift verification，檢查 specs、domain docs、implementation、tests 是否還描述同一個系統。 |

常見用法：

```text
/dflow:verify
/dflow:verify Expense
```

它適合在：

- feature closeout 後
- PR 前
- 大量修改 spec 或 domain docs 後
- 懷疑 code 與 docs drift 時

### `/dflow:pr-review`

`/dflow:pr-review` 適合在變更準備 review 時跑。

它應先理解 spec intent，再看 code。否則 review 會變成一般 code review，看不出 AI
有沒有違反 domain language、BR、aggregate boundary 或 phase scope。

## Feedback command

### `/dflow:report-dflow-feedback`

如果你或 AI 在使用 Dflow 時發現 Dflow 本身的問題，例如：

- flow 指示不清楚
- template 欄位讓人誤解
- README 與 `templates/` workflow 內容不一致
- tutorial 與現行命令表面不一致

可以用：

```text
/dflow:report-dflow-feedback
```

它的第一版設計是產生 sanitized local feedback draft，不會自動送出 GitHub issue，
也不會自動 push 或 submit。

## 常見混淆

### 混淆 1：`init` 是否已經被 `/dflow:*` 取代？

沒有。`init` 是 CLI bootstrap，仍是新專案導入 Dflow 的入口。

```bash
dflow init
```

`/dflow:*` 是 init 後的 AI workflow。

### 混淆 2：是否還有 `/dflow:init-project`？

目前公開 V1 預設入口是 npm CLI（全域安裝後）：

```bash
dflow init
```

不要把早期 `/dflow:init-project` 當成目前 tutorial 的入口。

### 混淆 3：`/dflow:verify`、`/dflow:pr-review`、`/dflow:status`、`/dflow:next`、`/dflow:cancel` 是否有效？

有效。它們是目前 Dflow `templates/` workflow 內容與 README 仍列出的命令。

差別是：

| 類型 | Commands |
|---|---|
| workflow / review | `/dflow:verify`、`/dflow:pr-review` |
| workflow control | `/dflow:status`、`/dflow:next`、`/dflow:cancel` |

### 混淆 4：`/dflow:bug-fix` 是否等於 Git Flow hotfix？

不是。`/dflow:bug-fix` 是 bug-fix workflow ceremony。

Git branch 要叫 `bugfix/...`、`hotfix/...`、或直接短命 feature branch，取決於專案的 Git principles。

### 混淆 5：`/dflow:new-phase` 和 `/dflow:new-feature` 怎麼分？

簡化判斷：

| 情境 | 用哪個 |
|---|---|
| 新的業務能力，沒有 active feature 承接 | `/dflow:new-feature` |
| active feature 還在進行中，需要下一個完整 T1 phase slice | `/dflow:new-phase` |
| completed feature 後來要改 | `/dflow:modify-existing` |

## 建議閱讀順序

第一次讀 tutorial 時，建議順序是：

1. 本頁：先理解命令表面。
2. [01-greenfield/walkthrough-00-setup.md](01-greenfield/walkthrough-00-setup.md)：理解 Alice / ExpenseTracker。
3. [01-greenfield/walkthrough-01-init-project.md](01-greenfield/walkthrough-01-init-project.md)：看 CLI init 如何建立 baseline。
4. [01-greenfield/walkthrough-02-new-feature.md](01-greenfield/walkthrough-02-new-feature.md)：看第一個 feature 如何從對話變成 spec 與 DDD 文件。

如果你維護的是既有系統，再接著讀：

1. [02-brownfield/walkthrough-00-setup.md](02-brownfield/walkthrough-00-setup.md)
2. [02-brownfield/walkthrough-01-init-project.md](02-brownfield/walkthrough-01-init-project.md)
3. [02-brownfield/walkthrough-02-modify-existing.md](02-brownfield/walkthrough-02-modify-existing.md)

## Key takeaways

- `dflow init`（全域安裝後）是 shell CLI；`/dflow:*` 是 AI workflow。
- `dflow doctor` 是 CLI health check；`/dflow:verify` 是 AI drift verification。
- `/dflow:new-feature`、`/dflow:modify-existing`、`/dflow:bug-fix` 是日常工作入口。
- `/dflow:new-phase` 只適用 active feature 的下一個 phase，會一路做到 phase-level implementation / verification / completion。
- `/dflow:finish-feature` 是 closeout，不是 merge、publish 或 release。
- `/dflow:next`、`/dflow:status`、`/dflow:cancel` 是有效的 workflow control commands。
- 各 AI tool 的 `/` parser 行為不同：Claude Code adapters 使用 `/dflow:<id>`，Copilot prompt 選單使用 `/dflow-<id>`，Codex CLI 使用不帶斜線的 `dflow:<id>`。
