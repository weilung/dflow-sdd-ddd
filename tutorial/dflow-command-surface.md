# Dflow 命令表面導讀

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份導讀回答一個很實際的問題：讀者在 tutorial、README、AI 對話或公司內部教學中看到
`dflow init`、`dflow doctor`、`/dflow:new-feature`、
`/dflow:next`、`/dflow:verify` 這些入口時，應該怎麼理解它們的分工？

Dflow 有兩層命令表面：

| 層級 | 形式 | 在哪裡執行 | 用途 |
|---|---|---|---|
| npm CLI | `dflow init`、`dflow configure-agents`、`dflow doctor`、`dflow render`（共四個子命令） | shell / terminal | 建立或檢查 Dflow workspace、AI tool shim 與選配 command adapters；`render` 另把 specs 投影成可瀏覽的 HTML。 |
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
> 可改用 `npx dflow-sdd-ddd init`。使用此路徑時，後續所有 CLI 命令（`configure-agents`、
> `doctor`、`render`）也必須使用 `npx dflow-sdd-ddd <subcommand>` 形式。
> 完整說明見 [README.md 的「Alternative: try without installing」段](../README.md)。

它會依序詢問九個問題：

1. greenfield 或 brownfield
2. tech stack
3. migration context
4. prose language
5. **Git policy**（Git Flow 或 Trunk / GitHub Flow，二選一；決定 branch gates、
   finish-stage merge guidance，也決定投影哪一份 `Git-principles-*.md`）
6. **AI commit marker**（none / `Co-Authored-By` trailer / `[ai-assisted]` 前綴；
   寫進 `_conventions.md` 的 `## AI Commit Policy`）
7. optional starter files（目前只有 `_overview.md` 一個選項）
8. 要建立哪些 AI tool shim
9. **要不要安裝 project-level skill**（自然語言自動觸發；預設 Y）

⚠ 第 5、6 題都是團隊決策，不在 optional starter 裡；`Git-principles-*.md`
是第 5 題的產物，不是第 7 題選來的。兩題的「強制程度」不同：**第 5 題沒有預設值，
必須明選**（按 Enter 會被判 invalid，三次中止 init）；**第 6 題有預設值，按 Enter 取
`none`**。判準寫在提示上，但要看的是「有沒有宣告預設」而不只是 `(default: …)` 字樣：
`(default: …)`（第 3、6、8 題）、`press Enter for recommended [1]`（第 7 題）、
`(Y/n)`（第 9 題）都能按 Enter 過。一種都沒宣告的才得自己答——實測是第 2、4、5 題，
偵測到既有 source 時第 1 題也算。
⚠ **但「能按 Enter」不等於「該按」**，第 8 題（AI agents）是例子——**而且它的預設值會變**。
在**還沒有任何 AI tool 檔**的專案裡它標 `(default: none)`，按 Enter 等於一家都不建：
選幾家就少幾個 shim 與幾份 `SKILL.md`，**而且 canonical 的 `AI-AGENT-GUIDE.md` 也不會建**。
實測的規則是：**少掉的 = 1 份 guide ＋ 每選一家 2 列**（一個 shim ＋ 一份 `SKILL.md`）。
兩軌 walkthrough 的例子就是這條規則的兩個代入：greenfield 40 → 33（Alice 選三家）、
brownfield 32 → 29（Bob 只選一家）。
但若 repo 已經**已經有別的工具留下的 `AGENTS.md`** 之類的 shim，提示會變成 `(default: 1)`
這種形式——那時按 Enter 是**沿用既有選擇**，不是不建。
預設值本身沒有錯，錯的是把「有預設」讀成「可以不管」。

它會建立或準備（以下為 Greenfield；Brownfield 沒有 `architecture/`，改建
`dflow/specs/migration/`）：

```text
dflow/specs/
  shared/
    dflow-workflows/     # Dflow 管理的 workflow bundle
  domain/
  architecture/
  features/
AGENTS.md / CLAUDE.md / .github/copilot-instructions.md
.claude/skills/dflow/SKILL.md 等 project-level skill（預設安裝）
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

它處理 AI instruction files **與 Dflow 管理的 workflow bundle**
（`dflow/specs/shared/dflow-workflows/`）；它不重跑 init，也不動你自己寫的 specs。

⚠ bundle 是**每次都重新投影**的：實測在 bundle 裡手改一個檔、再刪掉一個檔，
然後跑一次不帶旗標的 `configure-agents`——手改被覆蓋、被刪的檔被還原，
而同一次執行裡使用者自己寫的 `_overview.md` 完全沒被動。這正是升級機制
（新版移除的檔會依 manifest 差集自動清掉），所以不要手動編輯 bundle 內的檔。

（想自己重現的話注意：`configure-agents` 和 `init` 一樣有 `Create these files? (y/N)`
這道 gate，而且同樣只認 `y` / `yes`。在那裡按 Enter 等於答 N，它會印出計畫然後中止、
什麼都不改——看起來就像「bundle 沒被重投影」。）

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

### `dflow render`

把 specs 的 Markdown 樹投影成一份可用瀏覽器閱讀的靜態 HTML 鏡像，給不跑 Dflow
的人（PM、reviewer、新人）看。

```bash
dflow render --src dflow/specs --out dflow-specs-html --title "我的專案 specs"
```

| 選項 | 預設 | 說明 |
|---|---|---|
| `--src <dir>` | `dflow/specs` | 要投影的 specs 根目錄。 |
| `--out <dir>` | `dflow-specs-html` | 輸出目錄；產生 `index.html` 檔案樹，`file://` 直接開得起來。 |
| `--title <text>` | `dflow specs` | `index.html` 的頁面標題。 |

要點：

- **Markdown 仍是 AI 面的 source of truth**；HTML 只是給人讀的投影，每次執行都是全量重建。
- 它**只寫 `--out`，不碰 `--src`**。輸出目錄由 render 擁有（每個產出檔內嵌
  generated-by 標記，另有 `.dflow-render-manifest.json` 帳本），來源被刪或改名的殘檔會在
  下次執行時清掉。輸出目錄通常該 gitignore。
- 它是**人類可讀性工具，不是 workflow command**：不在 `/dflow:*` 那 11 個命令裡，
  也沒有 command adapter。

本 tutorial 的 fixture 就可以直接拿來試：

```bash
dflow render --src tutorial/01-greenfield/outputs/dflow/specs --out /tmp/expense-html
```

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
| `/dflow:new-feature` | 真正新的功能、頁面、能力或第一個 bounded context（**新建**的可導航介面——自有 route 且自有內容樹、新的使用者可執行 domain 操作、或新的獨立可消費產出；對既有介面加控制項、或為既有 route 加選單項目，都算 modify-existing）。 | feature directory、phase spec、aggregate design、domain docs updates。 |
| `/dflow:modify-existing` | 修改既有行為。 | impact analysis、delta / lightweight spec、updated rules / docs。 |
| `/dflow:bug-fix` | 有明確 expected vs actual 的 defect。 | AI 依 AI-AGENT-GUIDE.md § Ceremony Scaling 的 ordered cascade 判 tier（多落 T2 lightweight spec，但 cascade 也會把 defect 判到其他層級）、reproduction、fix plan、regression check。 |
| `/dflow:pr-review` | 變更準備 review。 | SDD / DDD compliance review、risks、gaps、follow-up。 |

### `/dflow:new-feature`

用在真正新的功能／頁面／能力（**新建**的可導航介面、新的使用者可執行 domain 操作、或新的獨立可消費產出；對既有介面加控制項、或為既有 route 加選單項目，都走 modify-existing）。Greenfield 第一個 feature 幾乎一定從這裡開始。

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

tier 由 cascade 決定，不由命令決定。這個例子是功能性 defect（T2），所以 Dflow 會要求把現有行為、預期行為、根因、修復位置、regression check 記錄下來；若這個 bug 只是單一畫面上的顯示文字打錯，就是 T3（同一處掃過多個畫面則升 T2；動到高後果內容也是 T2），就只在所屬 feature 的 `_index.md` 記一行、不建獨立 spec 檔。

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
- 更新 `rules.md`、`behavior.md`、`models.md` 等 system docs（Greenfield 另含 `events.md`；Brownfield 沒有這一份）
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
| 真正新的能力／頁面／獨立產出（非對既有 surface 加控制），沒有 active feature 承接 | `/dflow:new-feature` |
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
- CLI 共四個子命令：`init`、`configure-agents`、`doctor`、`render`。`render` 把 specs
  投影成給人讀的 HTML，不是 workflow command。
- `/dflow:new-feature`、`/dflow:modify-existing`、`/dflow:bug-fix` 是日常工作入口。
- `/dflow:new-phase` 只適用 active feature 的下一個 phase，會一路做到 phase-level implementation / verification / completion。
- `/dflow:finish-feature` 是 closeout，不是 merge、publish 或 release。
- `/dflow:next`、`/dflow:status`、`/dflow:cancel` 是有效的 workflow control commands。
- 各 AI tool 的 `/` parser 行為不同：Claude Code adapters 使用 `/dflow:<id>`，Copilot prompt 選單使用 `/dflow-<id>`，Codex CLI 使用不帶斜線的 `dflow:<id>`。
