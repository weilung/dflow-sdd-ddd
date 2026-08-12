# Walkthrough 01 — `dflow init` 建立 Greenfield baseline

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Alice 如何把 Greenfield 專案接上 Dflow。它把一次完整的 CLI
init 互動整理成可教學、可 review 的讀物，讓讀者看懂：

- `dflow init` 和 `/dflow:*` commands 的分工
- init 掃描 repo 之後做的事：**拿掉第一題的預設值、要 Alice 自己選**——判定是人做的，不是它做的
- Dflow 為什麼要問 project type、tech stack、migration context、prose language
- file-list preview 如何在寫檔前建立 step gate
- baseline files、optional starter files、AI tool shims 各自負責什麼
- 為什麼 Day 0 不建立 `behavior.md` 或空的 ADR

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Greenfield 劇情跑完後的
最終狀態；本篇內嵌片段則說明 init 當下的重點。若想先理解 walkthrough excerpt 和
`outputs/` snapshot 的分工，可讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Dflow 是 npm CLI 還是 slash command？ | init 是 `dflow init`（全域安裝）；日常 workflow 才是 `/dflow:*`。 |
| init 會不會覆寫既有檔案？ | 它先列 `File plan:`（create / skip）與 `Will defer:`，等人回答 `Create these files? (y/N)` 才寫。 |
| Greenfield baseline 會建哪些 spec 檔？ | shared、domain、architecture、features workspace 與 AI guide。 |
| optional starter 怎麼選？ | 這題目前只有 `_overview.md` 一個選項，Alice 選了它。（trunk-based 的 Git guide 不在這題，是 Git policy 那題的產物。） |
| AI tool 支援怎麼維持一致？ | 建 canonical `AI-AGENT-GUIDE.md`，root tool files 只當 thin shim。 |

## 前情提要

Alice 已經完成 [〈Walkthrough 00 — Greenfield setup：Alice / ExpenseTracker 的起點〉](walkthrough-00-setup.md) 的準備：

```text
ExpenseTracker/
├── .git/
├── ExpenseTracker.sln
├── src/
│   ├── ExpenseTracker.Domain/
│   │   └── ExpenseTracker.Domain.csproj
│   ├── ExpenseTracker.Application/
│   │   └── ExpenseTracker.Application.csproj
│   ├── ExpenseTracker.Infrastructure/
│   │   └── ExpenseTracker.Infrastructure.csproj
│   └── ExpenseTracker.WebAPI/
│       └── ExpenseTracker.WebAPI.csproj
└── tests/
    ├── ExpenseTracker.Domain.Tests/
    ├── ExpenseTracker.Application.Tests/
    └── ExpenseTracker.Integration.Tests/
```

此時還沒有 `dflow/specs/`。Alice 的目標不是打開第一個 feature，而是先建立 Dflow
baseline，讓後續 `/dflow:new-feature` 有固定的 spec governance、project overview、
language convention 與 AI collaboration guide 可讀。

## Step 1 — Alice 執行 CLI init

Alice 已全域安裝 Dflow（`npm install -g dflow-sdd-ddd`），在 repo root 執行：

```bash
dflow init
```

若你尚未全域安裝，可改用 `npx dflow-sdd-ddd init`；效果完全相同，
但後續所有 CLI 命令也必須使用 `npx dflow-sdd-ddd <subcommand>` 形式。

Dflow CLI 不會直接寫檔。它會先掃描 repo 現況——但**這一步是靜默的**：
`dflow init` 從啟動到第一個問題之間，畫面上不會出現任何 inventory 報告。
偵測結果只影響第一題「What kind of project is this?」怎麼問：

| 掃描結果 | 第一題長什麼樣 |
|---|---|
| 沒有既有 source | `Enter choice [1-2] (default: 1):` —— 預設 Greenfield |
| 偵測到既有 source（頂層 `src/`，或四層內的 build manifest：`.sln`／`.csproj`／`package.json`／`pom.xml` 等） | `Enter choice [1-2]:` —— **預設被拿掉，你必須自己選** |

Alice 的 repo 已經有 `src/`，所以她看到的是後者：Dflow 不替她猜，要她明確說這是新專案。
（另外少數情況會先在 stderr 印一則 preflight warning，例如 `dflow/specs/` 已存在但是空的。）

所以下面這張表不是 CLI 的輸出，而是「Dflow 這時掌握到什麼」的還原：

| 訊號 | Alice 的 repo |
|---|---|
| `.git` | present |
| `dflow/specs/` | not yet present |
| `src/` | Clean Architecture layout detected |
| `tests/` | Domain / Application / Integration test projects detected |
| `AGENTS.md` / `CLAUDE.md` / `.github/copilot-instructions.md` | not present |

→ 這些訊號讓 Dflow 對 track 有了判斷，但它**不替 Alice 決定**：因為偵測到既有 source
（`ExpenseTracker.sln` 與 `src/` 下的 `.csproj`），第一題不給預設值——Greenfield 是
Alice 自己選的。

這個判定很重要。Greenfield setup 代表：

| 判定 | 後續行為 |
|---|---|
| `dflow/specs/` 不存在 | 建立全新 baseline，而不是 merge 到既有 spec tree。 |
| Clean Architecture layout 已存在 | `_overview.md` 可以描述既有架構方向。 |
| 沒有 root tool files | AI shims 可以直接建立，不需要產 merge snippet。 |
| 沒有 legacy code 需要保護 | 不進 baseline capture；第一個 feature 才建 domain model。 |

## Step 2 — 最小必要問題

Dflow 接著依序問九個問題。這不是表單填寫，而是用來決定 baseline files 的內容與邊界。

| # | 問題 | Alice 的回答 | 影響 |
|---|---|---|---|
| 1 | project type | Greenfield | 使用 Greenfield scaffolding。 |
| 2 | tech stack | .NET 9 / C# 13 / ASP.NET Core 9 / EF Core 8 / MediatR 12 / xUnit | 填入 `_overview.md` stack table。 |
| 3 | migration context | 純新 build | 不加 migration note。 |
| 4 | prose language | `zh-TW` | `_conventions.md` 記錄 `## Prose Language`。 |
| 5 | Git policy | Trunk / GitHub Flow | **沒有預設值，一定要自己選**（按 Enter 會被判 invalid，三次就中止 init）。決定 branch gates 與 finish-stage merge guidance，並決定投影 `Git-principles-trunk.md`（選 Git Flow 則是 `Git-principles-gitflow.md`）。 |
| 6 | AI commit marker | none | 一定會問，但**有預設值 `1. None`**——按 Enter 就是 none。寫進 `_conventions.md` 的 `## AI Commit Policy`；另兩個選項是 `Co-Authored-By` trailer 與 `[ai-assisted]` 前綴。 |
| 7 | optional starter | `_overview.md` | 這一題目前**只有這一個選項**。 |
| 8 | AI agents | AGENTS、CLAUDE、GitHub Copilot 全選 | 建 canonical AI guide 與三個 thin shims。 |
| 9 | project-level skill | 直接按 Enter（預設 Y） | 為三家各建 `skills/dflow/SKILL.md`，自然語言就能自動觸發 workflow。答 `n` 可之後用 `configure-agents --skills` 補裝。 |

⚠ 兩個容易誤會的地方。**Git policy 是第 5 題的團隊決策，不是 optional starter 選來的**
（`Git-principles-*.md` 是它的產物）。**AI commit marker 這題常被略過不談**——它有預設值、
按 Enter 就過，但它會長期影響 AI 怎麼寫 commit，值得團隊當下就講清楚。

第 5 題是二選一的單選：

```text
Which Git policy does the team follow? (drives branch gates and finish-stage merge guidance)
  1. Git Flow - long-lived develop/release branches
  2. Trunk / GitHub Flow - short-lived feature branches (lightest)
Enter choice [1-2]:
```

Alice 選 2。因為是單選，不存在「兩份都挑」這種情形，Dflow 也就只會投影對應的那一份
Git guide——這示範了 init 記錄團隊選擇、而不是把兩份範本都丟進 repo。

### 哪幾題能按 Enter，哪幾題不能

判準寫在提示上——但要看的是「**提示有沒有宣告預設**」，不是只看 `(default: …)` 這個字樣。
宣告預設的寫法有三種，都能按 Enter 過：

- `(default: …)` —— 第 3 題 migration context、第 6 題 AI commit marker（**第 8 題也是這一種，見下**）
- `press Enter for recommended [1]` —— 第 7 題 optional starter
- `(Y/n)` —— 第 9 題 project-level skill，Enter 等於 Y

**一種都沒宣告的才必須自己答**：實測是第 2 題 tech stack（按 Enter 會回
`This answer is required.`）、第 4 題 prose language 與第 5 題 Git policy；偵測到既有
source 時第 1 題也一樣。三次答不出來就中止 init。

⚠ **「能按 Enter」不等於「該按 Enter」，第 8 題是這裡最貴的一題。** 它標的是
`(default: none)`——那個預設是**一家 AI agent 都不建**。按 Enter 過去，Step 4 的三個 shim、
三份 `SKILL.md`，**連 canonical 的 `AI-AGENT-GUIDE.md` 都不會建**——實測 create 列從
**40 掉到 33**。少掉的不只是三個薄殼：`AI-AGENT-GUIDE.md` 正是整套設計讓各家 AI 工具
行為一致的那份文件。**這題值得真的答。**

## Step 3 — File-list preview 是 init 的 step gate

Dflow 在寫檔前列出 preview：

```text
Will create (40 files):
- dflow/specs/features/active/.gitkeep
- dflow/specs/features/completed/.gitkeep
- dflow/specs/features/backlog/.gitkeep
- dflow/specs/domain/glossary.md
- dflow/specs/domain/context-map.md
- dflow/specs/architecture/tech-debt.md
- dflow/specs/architecture/decisions/README.md
- dflow/specs/shared/_conventions.md
- dflow/specs/shared/_overview.md
- dflow/specs/shared/Git-principles-trunk.md
- dflow/specs/shared/AI-AGENT-GUIDE.md
- AGENTS.md
- CLAUDE.md
- .github/copilot-instructions.md
- .claude/skills/dflow/SKILL.md
- .agents/skills/dflow/SKILL.md
- .github/skills/dflow/SKILL.md
- dflow/specs/shared/dflow-workflows/references/  (10 files)
- dflow/specs/shared/dflow-workflows/templates/   (12 files)
- dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json

Will skip (0 files already present)

Will defer:
- dflow/specs/domain/{context}/behavior.md
- dflow/specs/domain/{context}/models.md
- dflow/specs/domain/{context}/rules.md
- dflow/specs/domain/{context}/events.md          # Greenfield only
- dflow/specs/architecture/decisions/ADR-*.md     # Greenfield only
```

⚠ **上面那個區塊是本篇為了好讀而重排過的，不是 CLI 的逐字輸出。** 實際畫面上，
preview 是一張 `File plan:` 的 Markdown 表格，欄位是
`| Path | Action | Source | Size | Notes |`，**每個檔各佔一列**——包括那 23 個
workflow bundle 檔，所以 Alice 螢幕上的 create 列共 **40** 列（本篇把 bundle 收成三行）。
表格之後才是 `Will defer:` 表與 `Create these files? (y/N)`。
（`Will create (40 files):`、`Will skip …` 這兩個標題是本篇的敘事寫法，不是產品字串；
`Will defer:` 則是產品真正印的段名。）

⚠ **還有一個位置要先知道：`File plan:` 與表格之間可能插進一個 `Warnings:` 區塊**——有警告
才印，沒有就直接接表格。Alice 不會看到它，因為她的 `.csproj` 讓 init 判得出這是 .NET Core
系（見 walkthrough-00 的 tree 表）。但**你自己的 repo 很可能會看到**：只要有頂層 `src/`、
而 init 讀不出技術方向，你在第 1 題選 Greenfield 就會得到

```text
Warnings:
- Note: existing source files were detected (e.g. a src/ directory or a build manifest).
  ... If this is actually an existing codebase, consider re-running and selecting Brownfield.
```

⚠ 這裡有兩個**不同**的判斷，別混在一起：Step 1 那張表講的是「**有沒有既有 source**」，
`.sln` 算數（它是 build manifest 之一），所以 Alice 的第一題才會被拿掉預設值。這裡講的是
「**是什麼技術方向**」，只看 **`.csproj` 的內容**（`Microsoft.NET.Sdk.Web` + net6 以上）
與 WebForms 副檔名（`.aspx`／`.ascx`／`.master`）——**`.sln` 對這一個判斷沒有貢獻**，
光有 solution 檔救不了。兩個判斷都成立時（有 source、但看不出方向）才會印那則提醒。
這是**資訊性提醒、不是錯誤**，Greenfield 仍然是對的答案；同一則訊息會在收尾報告的
`Warnings:` 再印一次；那一格**還可能同時列出未解決的佔位符，所以未必只有一列**——
偵測提醒與佔位符提醒是兩個獨立來源，而看不出技術方向的 repo 往往兩個都中。
**Alice 那一格印的是 `- (none)`**——
她沒有這則提醒，而 `Warnings:` 只追蹤 **init 從第 2 題抽出來的那組技術佔位符**——
`{Language}`／`{Framework}`／`{Framework version}`／`{ORM / persistence}`／`{ORM version}`／
`{Mediator}`／`{Test framework}` 共七個。Alice 第 2 題把它們**全部**答滿了
（MediatR 12 對到 `{Mediator}`、xUnit 對到 `{Test framework}`），所以那一格才是 `- (none)`。
答一個抽不出這麼多欄位的技術棧，那一格就會列出沒解掉的幾個。

⚠ **這不代表 `_overview.md` 沒有佔位符要補**——實測仍有 8 個 `{e.g. …}` 沒填（連她答過
`xUnit` 的 `Testing` 那格都還是佔位符），只是它們不在 `Warnings:` 的追蹤範圍內。
Step 5 會示範補其中五個；**`Primary domain`、`Validation`、`Testing` 這三格本篇不會回頭處理**，
同樣要自己補。

總列數會隨 init 問答的選擇而變（選幾家 AI agent、要不要 optional starter 等），
所以你自己跑出來的數字未必是 40；**不變的是 bundle 那 23 檔**。

本 tutorial 的 `outputs/` 沒有收錄這個 bundle（它是什麼、為什麼不收，見 Step 4）——
所以 `outputs/` 裡指向 `dflow/specs/shared/dflow-workflows/` 的各種引用
（`CLAUDE.md` 等 shim、`_overview.md`、feature `_index.md` 的註記）在 fixture 裡
都點不到目標，在你自己的專案裡則確實存在。

Dflow 停下來等 Alice：

```text
Create these files? (y/N)
```

這就是那道 step gate：預設是 `N`，不回答就什麼都不會寫。Alice 輸入 `y`：

```text
y
```

⚠ 這道 gate 只認 `y` 或 `yes`（會先去空白、轉小寫）。**其他任何輸入都當成 N 並中止**——
包括「`yes，開工。`」這種看起來像答應的句子。這裡不是自然語言對話。

這就是 init 的安全邊界：在 filesystem 改動前，Dflow 先讓人看清楚「會建什麼、不會建什麼、為什麼不建」。

## Step 4 — Baseline files 寫入 repo

Alice 確認後，Dflow 寫入 baseline。重要分組如下。

**features workspace**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/features/active/.gitkeep`](outputs/dflow/specs/features/active/.gitkeep) | 進行中的 feature 目錄。 |
| [`outputs/dflow/specs/features/completed/.gitkeep`](outputs/dflow/specs/features/completed/.gitkeep) | 已完成 feature 的歸檔區。 |
| [`outputs/dflow/specs/features/backlog/.gitkeep`](outputs/dflow/specs/features/backlog/.gitkeep) | 尚未開工的 feature backlog。 |

**domain / architecture baseline**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | Ubiquitous Language 起點，等第一個 feature 補核心術語。 |
| [`outputs/dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) | Bounded Context 關係圖起點，contexts 先留 TODO。 |
| [`outputs/dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md) | Greenfield 架構債 backlog。 |
| [`outputs/dflow/specs/architecture/decisions/README.md`](outputs/dflow/specs/architecture/decisions/README.md) | ADR home，說明何時建立 ADR。 |

**shared governance**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/shared/_conventions.md`](outputs/dflow/specs/shared/_conventions.md) | spec writing conventions，含 `## Prose Language: zh-TW`。（本 fixture 是節錄版：省略 `> Dflow Version:` 行與 `## Git Policy`／`## AI Commit Policy` 兩段；實際 `dflow init` 產出是完整的。） |
| [`outputs/dflow/specs/shared/_overview.md`](outputs/dflow/specs/shared/_overview.md) | ExpenseTracker overview、tech stack、stakeholder TODO。 |
| [`outputs/dflow/specs/shared/Git-principles-trunk.md`](outputs/dflow/specs/shared/Git-principles-trunk.md) | trunk-based / GitHub Flow 慣例。 |
| [`outputs/dflow/specs/shared/AI-AGENT-GUIDE.md`](outputs/dflow/specs/shared/AI-AGENT-GUIDE.md) | AI tool-neutral canonical guide（本 fixture 是節錄版：省略 walkthrough 沒走到的段落，例如帶 ordered cascade 的 § Ceremony Scaling；實際 `dflow init` 產出是完整的）。 |

**workflow bundle（Dflow 管理；`outputs/` 未收錄）**

`dflow init` 另外把一份 workflow bundle vendor 到
`dflow/specs/shared/dflow-workflows/`，Greenfield 共 23 個檔：10 份 reference
文件（9 份 flow／參考文件 ＋ DDD 建模指引）、12 份空白 spec 模板、1 份 manifest。
它由 Dflow 管理，`dflow configure-agents` 每次都會重新投影，**不要手動編輯**
（下次投影會被覆蓋）。因為它與本篇劇情無關、內容也只是 Dflow 套件的複本，
本 tutorial 的 `outputs/` 沒有收錄；你自己的專案裡它會在。

> **關於 `dflow doctor`**：在本 tutorial 的 `outputs/` 上跑 `dflow doctor` 會得到
> 6 條 findings（3 warn、3 info）。它們**全部**來自 fixture 的手工節錄與凍結——
> 剛跑完 `dflow init` 的樹跑 doctor 是 `All checks passed`。所以那 6 條不是
> 你的專案該有的狀態，也不是 Dflow 的預設輸出。

**AI tool shims**

| Path | 用途 |
|---|---|
| [`outputs/AGENTS.md`](outputs/AGENTS.md) | Codex / coding agent shim。 |
| [`outputs/CLAUDE.md`](outputs/CLAUDE.md) | Claude Code shim，指向 canonical guide。 |
| [`outputs/.github/copilot-instructions.md`](outputs/.github/copilot-instructions.md) | GitHub Copilot repository instruction shim。 |

**project-level skill（自然語言自動觸發）**

Alice 在 skill 題直接按 Enter（預設 Y），Dflow 為三家各建同一份 thin skill：

| Path | 用途 |
|---|---|
| [`outputs/.claude/skills/dflow/SKILL.md`](outputs/.claude/skills/dflow/SKILL.md) | Claude Code 專案層 skill。 |
| [`outputs/.agents/skills/dflow/SKILL.md`](outputs/.agents/skills/dflow/SKILL.md) | Codex 專案層 skill（內容與 Claude 份逐字相同）。 |
| [`outputs/.github/skills/dflow/SKILL.md`](outputs/.github/skills/dflow/SKILL.md) | GitHub Copilot 專案層 skill（VS Code Chat 自動觸發；Copilot CLI 打 `/dflow` 喚起）。 |

有了它，Alice 說「我想加一個報銷功能」這類自然語言時，工具會依 skill 的觸發描述
自動建議對應的 `/dflow:*` workflow，不必記命令。skill 檔是 Dflow 衍生物；產品建議的
預設做法是 gitignore、clone 後用 `dflow configure-agents --skills` 重投影，
但**commit 進版控也是可以的**——團隊自己決定。

**optional command adapters**

`dflow init` 建立 canonical guide、root shims 與 project-level skill；若團隊想讓
工具 UI 顯示 Dflow 命令入口，Alice 會在 init 後再執行 opt-in 設定：

```bash
dflow configure-agents --command-adapters
```

選擇 AGENTS、Claude Code、GitHub Copilot 後，叫法依工具不同：

| 工具 | 產生 / 使用方式 |
|---|---|
| Claude Code | 產生 `.claude/commands/dflow/<id>.md`，在 Claude 中輸入 `/dflow:<id>`，例如 `/dflow:new-feature`。 |
| GitHub Copilot | 產生 `.github/prompts/dflow-<id>.prompt.md`；chat 文字可說 `/dflow:<id>`，VS Code prompt 選單用 `/dflow-<id>`。 |
| Codex CLI | 不產生命令檔；在 `AGENTS.md` / snippet 中強化文字 trigger，實際輸入不帶斜線的 `dflow:<id>`。 |

這個差異是因為各工具 `/` parser 行為不同；canonical `/dflow:*` 仍是
`AI-AGENT-GUIDE.md` 中的共同詞彙。

## 為什麼有些檔故意不建

Dflow 在 preview 的 `Will defer:` 表裡列出**五個路徑**，理由分成兩類：

| 不建立 | 理由 |
|---|---|
| `dflow/specs/domain/{context}/behavior.md`<br>`dflow/specs/domain/{context}/models.md`<br>`dflow/specs/domain/{context}/rules.md`<br>`dflow/specs/domain/{context}/events.md` | Day 0 還沒有真正的 bounded context——`{context}` 根本還沒有值。要等第一個 feature 的 domain modeling（`new-feature-flow.md` Step 3）或 baseline capture 之後才建立。⚠ 是 **Step 3 建立**、不是收尾才建立；`behavior.md` 在那一步只建骨架（每條 BR 一個 anchor），Given/When/Then 要到 finish-feature 才 merge 進來。（`events.md` 另標註 Greenfield only；下一列的 ADR 也是。） |
| `dflow/specs/architecture/decisions/ADR-*.md` | 目前沒有具體 trade-off。預建空 ADR 只會留下假文件。⚠ **這一列也是 Greenfield only**——Brownfield 建的是 `dflow/specs/migration/`，它的 `Will defer:` 只有上面那三列、沒有這一列。 |

這是 Greenfield track 的一個 DDD guardrail：**不要在沒有 feature pressure 前假裝模型已經存在。**

Alice 知道 Expense 很可能是第一個 BC，但 Dflow 仍然等到
[〈Walkthrough 02 — `/dflow:new-feature` 建立第一個 Expense feature〉](walkthrough-02-new-feature.md) 才正式建立
`dflow/specs/domain/Expense/`。這讓第一個 BC 由真需求推導，而不是由專案名稱或資料表猜測。

## Step 5 — Results and next step

最後 Dflow 印出結果報告——依序是 `Created:`（40 行路徑）、`Updated:`、`Removed:`、
`Skipped:`、`Warnings:`、`Deferred:`，然後是收尾：

```text
Dflow init complete.

Recommended next steps:
- For a new feature, use the Dflow new-feature workflow when it becomes available as a CLI command.
- For brownfield changes, use the Dflow modify-existing workflow when it becomes available as a CLI command.
- Before generating more specs, make sure dflow/specs/shared/_conventions.md has the correct Prose Language section.
- For stack-specific examples (.NET, Java/Spring, Node/TypeScript, Python, Go, PHP/Laravel), see docs/examples-by-stack.md in the Dflow repo.
- Project-level skill files (.claude/skills/, .agents/skills/, .github/skills/) are Dflow-managed derivatives: the recommended default is to gitignore them and re-run `dflow configure-agents --skills` after cloning; committing them also works if the team prefers.
```

⚠ 一個容易誤讀的地方：CLI **沒有**叫你去跑 `/dflow:new-feature`——它說那些
workflow「when it becomes available as a CLI command」。真正的入口在 AI coding agent
那一側，不在 shell；Alice 接下來是回到 AI 工具裡啟動
[〈Walkthrough 02〉](walkthrough-02-new-feature.md) 的 `/dflow:new-feature`。

Alice 接下來會先補 `_overview.md` 中幾個 project-specific placeholder：

| Placeholder | Alice 會補的內容 |
|---|---|
| stakeholders | 員工、部門主管、財務、平台維護團隊。 |
| user scale | 內部使用者規模與提交量級。 |
| DB | PostgreSQL 16。 |
| Auth | Company SSO via OIDC。 |
| Hosting | Azure App Service。 |

這些 placeholder 不急著在 init 時硬填。Dflow 把「已知資訊」與「待補資訊」分開，讓 baseline
可以先落地，又不把缺資訊的地方偽裝成已決策。

## Dflow feature / benefit mapping

| Dflow 行為 | 讀者應該看到的 benefit |
|---|---|
| current-state inventory | 不靠 prompt 猜 repo 狀態，先讀 filesystem。 |
| project type 問答 | Greenfield / Brownfield scaffolding 分流。 |
| prose language baseline | 後續 specs 自由敘述用 `zh-TW`，固定結構保留 English。 |
| file-list preview | 寫檔前先建立人類確認 gate。 |
| AI guide + shims | 多 tool 使用同一份 Dflow rules，不讓規則分岔。 |
| `Will defer:` 區塊 | 避免 Day-0 空殼文件污染 domain truth。 |

## 下一個劇情段

→ [〈Walkthrough 02 — `/dflow:new-feature` 建立第一個 Expense feature〉](walkthrough-02-new-feature.md)：Alice
啟動第一個 feature「員工提交費用單」，由真需求建立 Expense BC、ExpenseReport Aggregate
與第一批 feature specs。
