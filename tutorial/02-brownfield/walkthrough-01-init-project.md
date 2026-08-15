# Walkthrough 01 — `dflow init` 建立 Brownfield baseline

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Bob 如何在既有 OrderManager WebForms 系統導入 Dflow baseline。
它把一次完整的 CLI init 互動整理成可教學、可 review 的讀物，讓讀者看懂：

- `dflow init` 在 Brownfield 專案中只建立 governance files
- init 掃得出什麼、掃不出什麼：WebForms 是它從 `.aspx` 認出來的，EF 6 / SQL Server 則是 Bob 自己答的
- Brownfield baseline 為什麼建立 `migration/tech-debt.md`
- 為什麼不預建 `dflow/specs/domain/{context}/`、context map 或 `src/Domain/`
- AI guide 和 root tool shim 如何在不覆寫既有規則的前提下建立

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Brownfield 劇情跑完後的
最終狀態；本篇內嵌片段則說明 init 當下的重點。若想先理解 walkthrough excerpt 和
`outputs/` snapshot 的分工，可讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Brownfield init 會不會修改 production code？ | 不會。它只建立 `dflow/specs/` governance files 與選定 AI shim。 |
| Dflow 會不會一開始就建 Order BC？ | 不會。第一個 BC 等 `/dflow:modify-existing` 確認真實 boundary 後才建。 |
| tech debt 在 Brownfield baseline 裡有什麼角色？ | `migration/tech-debt.md` 是 Day-0 living backlog，不是事後補記。 |
| Git Flow / trunk-based 怎麼選？ | Bob 有 release / hotfix 節奏，因此選 Git Flow。 |
| AI tool file 怎麼處理？ | Bob 只選 `CLAUDE.md`，root shim 指向 canonical guide。 |

## 前情提要

Bob 已經看完 [〈Walkthrough 00 — Brownfield setup：Bob / OrderManager 的起點〉](walkthrough-00-setup.md) 的系統背景：

```text
OrderManager/
├── .git/
├── OrderManager.sln
├── OrderManager.Web/
│   └── Pages/Order/
│       ├── OrderEntry.aspx
│       └── OrderEntry.aspx.cs
├── OrderManager.DataAccess/
├── tests/OrderManager.IntegrationTests/
└── (無 src/Domain/)
```

此時還沒有 `dflow/specs/`。Bob 的目標不是在 init 時抽 domain layer，而是先建立一套
spec governance，讓後續每一次修改都有地方記錄需求、current behavior、business rule、
tech debt 與 migration context。

## Step 1 — Bob 執行 CLI init

Bob 已全域安裝 Dflow（`npm install -g dflow-sdd-ddd`），在 repo root 執行：

```bash
dflow init
```

若你尚未全域安裝，可改用 `npx dflow-sdd-ddd init`；效果完全相同，
但後續所有 CLI 命令也必須使用 `npx dflow-sdd-ddd <subcommand>` 形式。

Dflow CLI 先做 current-state inventory：

⚠ 這個掃描是**靜默的**：`dflow init` 從啟動到第一個問題之間，畫面上不會出現任何
inventory 報告。偵測結果只影響第一題怎麼問：

| 掃描結果 | 第一題長什麼樣 |
|---|---|
| 沒有既有 source | `Enter choice [1-2] (default: 1):` —— 預設 Greenfield |
| 偵測到既有 source（頂層 `src/`，或四層內的 build manifest：`.sln`／`.csproj`／`package.json`／`pom.xml` 等） | `Enter choice [1-2]:` —— **預設被拿掉，你必須自己選** |

（另外少數情況會先在 stderr 印一則 preflight warning，例如 `dflow/specs/` 已存在但是空的。）

所以下面這張表不是 CLI 的輸出，而是「Dflow 這時掌握到什麼」的還原：

| 訊號 | Bob 的 repo |
|---|---|
| `.git` | present |
| `dflow/specs/` | not yet present |
| `OrderManager.Web/` | ASP.NET WebForms 主專案 |
| `OrderManager.DataAccess/` | EF 6 + Stored Procedure wrappers |
| `tests/OrderManager.IntegrationTests/` | 少量 integration tests |
| `src/Domain/` | not present |
| `CLAUDE.md` | not present |

⚠ Dflow **不會替 Bob 判定 Brownfield**。它偵測到既有 source 之後做的是把第一題的預設值
拿掉、要 Bob 自己選 2。判定是人做的，Dflow 只負責不讓人矇著眼睛按 Enter。
（順帶一提：Dflow 有一則「看起來像既有 codebase，考慮選 Brownfield」的 warning，但
**Bob 無論如何都看不到，理由比想像的簡單**——那則 warning 只在使用者第 1 題答
**Greenfield** 時才可能出現，而 Bob 答的是 Brownfield。跟他的 repo 長什麼樣沒有關係：
即使 Dflow 判不出技術方向，答 Brownfield 的人也不會被提醒去選 Brownfield。
⚠ 別把功勞算給 `OrderManager.sln`——`.sln` **不參與**技術方向的判斷，只算「有既有 source」
的證據之一。真正被讀的是 `.csproj` 的內容與 WebForms 副檔名，Bob 的 `.aspx` 屬於後者。
會踩到那則 warning 的是 Greenfield 那一邊，說明在 `01-greenfield/walkthrough-01` Step 3。）

這個判定的效果和 Greenfield 不同：

| 判定 | 後續行為 |
|---|---|
| Brownfield setup | 建 baseline governance，不假設可以重構。 |
| WebForms / EF 6 / SP wrappers | `_overview.md` 要記錄 current architecture 與 migration context。 |
| `src/Domain/` 不存在 | init 不建立 code layer；後續修改才抽 domain logic。 |
| `dflow/specs/` 不存在 | 這是第一次 Dflow baseline。 |

## Step 2 — 最小必要問題

Dflow 依序問 Bob 九個問題：

| # | 問題 | Bob 的回答 | 影響 |
|---|---|---|---|
| 1 | project type | Brownfield | 使用 Brownfield scaffolding。 |
| 2 | tech stack | .NET Framework 4.8 / WebForms / EF 6 / SQL Server 2019 / IIS | 填入 current architecture。 |
| 3 | migration context | 長期逐步遷移到 ASP.NET Core，不做大重寫 | `_overview.md` 和 tech debt 會記錄 modernization 方向。 |
| 4 | prose language | `zh-TW` | `_conventions.md` 記錄 `## Prose Language`。 |
| 5 | Git policy | Git Flow | **沒有預設值，一定要自己選**（按 Enter 會被判 invalid，三次就中止 init）。決定 branch gates 與 finish-stage merge guidance，並決定投影 `Git-principles-gitflow.md`（選 Trunk / GitHub Flow 則是 `Git-principles-trunk.md`）。 |
| 6 | AI commit marker | none | 一定會問，但**有預設值 `1. None`**——按 Enter 就是 none。寫進 `_conventions.md` 的 `## AI Commit Policy`；另兩個選項是 `Co-Authored-By` trailer 與 `[ai-assisted]` 前綴。 |
| 7 | optional starter | `_overview.md` | 這一題目前**只有這一個選項**。 |
| 8 | AI agents | `CLAUDE.md` | 建 canonical AI guide 與 Claude shim。 |
| 9 | project-level skill | 直接按 Enter（預設 Y） | 建 `.claude/skills/dflow/SKILL.md`，自然語言就能自動觸發 workflow。答 `n` 可之後用 `configure-agents --skills` 補裝。 |

⚠ 兩個容易誤會的地方。**Git policy 是第 5 題的團隊決策，不是 optional starter 選來的**
（`Git-principles-*.md` 是它的產物）。**AI commit marker 這題常被略過不談**——它有預設值、
按 Enter 就過，但它會長期影響 AI 怎麼寫 commit，維運型團隊尤其該當下講清楚。

Bob 選 Git Flow，不是因為 Git Flow 比 trunk-based 更「正確」，而是因為這個維運團隊有
release / hotfix 節奏。Dflow 在這裡只記錄專案事實，不替團隊改變 release ownership。

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
`(default: none)`——那個預設是**一家 AI agent 都不建**。按 Enter 過去，Bob 要的
`CLAUDE.md` shim、那一列 `.claude/skills/dflow/SKILL.md`，**連 canonical 的
`AI-AGENT-GUIDE.md` 都不會建**——實測 create 列從 **37 掉到 34**（Bob 只選一家，
所以 shim 與 skill 各只有一列），而那正是本篇 Step 4 在講的東西。
少掉的那份 guide 尤其要緊：它是各家 AI 工具行為一致的來源。**這題值得真的答。**

## Step 3 — File-list preview 是寫檔前的安全線

Dflow 在寫檔前列出 preview：

```text
Will create (37 files):
- dflow/specs/features/active/.gitkeep
- dflow/specs/features/completed/.gitkeep
- dflow/specs/features/backlog/.gitkeep
- dflow/specs/domain/glossary.md
- dflow/specs/migration/tech-debt.md
- dflow/specs/shared/_conventions.md
- dflow/specs/shared/_overview.md
- dflow/specs/shared/Git-principles-gitflow.md
- dflow/specs/shared/AI-AGENT-GUIDE.md
- CLAUDE.md
- .claude/skills/dflow/SKILL.md
- dflow/specs/shared/dflow-workflows/references/  (15 files)
- dflow/specs/shared/dflow-workflows/templates/   (10 files)
- dflow/specs/shared/dflow-workflows/.dflow-bundle-manifest.json

Will skip (0 files already present)

Will defer:
- dflow/specs/domain/{context}/behavior.md
- dflow/specs/domain/{context}/models.md
- dflow/specs/domain/{context}/rules.md
```

⚠ **上面那個區塊是本篇為了好讀而重排過的，不是 CLI 的逐字輸出。** 實際畫面上，
preview 是一張 `File plan:` 的 Markdown 表格，欄位是
`| Path | Action | Source | Size | Notes |`，**每個檔各佔一列**——包括那 26 個
workflow bundle 檔，所以 Bob 螢幕上的 create 列共 **37** 列（本篇把 bundle 收成三行）。
表格之後才是 `Will defer:` 表與 `Create these files? (y/N)`。
（`Will create (37 files):`、`Will skip …` 這兩個標題是本篇的敘事寫法，不是產品字串；
`Will defer:` 則是產品真正印的段名。）

總列數會隨 init 問答的選擇而變（選幾家 AI agent、要不要 optional starter 等），
所以你自己跑出來的數字未必是 37；**不變的是 bundle 那 26 檔**。

還有一件關於 `Will defer:` 的事值得先講：它列的是「Dflow 這次不建、但之後會建」的
**Dflow 檔案**，所以 Bob 最在意的 `src/Domain/`、Code-Behind 根本不在表上——
Dflow 從頭到尾就不碰它們。

本 tutorial 的 `outputs/` 沒有收錄這個 bundle（它是什麼、為什麼不收，見 Step 4）——
所以 `outputs/` 裡指向 `dflow/specs/shared/dflow-workflows/` 的各種引用
（`CLAUDE.md` 等 shim、`_overview.md`、feature `_index.md` 的註記）在 fixture 裡
都點不到目標，在你自己的專案裡則確實存在。

Dflow 停下來等 Bob。這道 gate 的提示是 `Create these files? (y/N)`，預設 `N`；
Bob 輸入 `y`：

```text
y
```

⚠ 它只認 `y` 或 `yes`（會先去空白、轉小寫）。**其他任何輸入都當成 N 並中止**——
包括「`yes。`」這種帶標點、看起來像答應的回答。這裡不是自然語言對話。

這個 preview 是 Brownfield init 最重要的保護機制。它讓團隊明確看到 Dflow 不會：

- 搬 Code-Behind
- 建 `src/Domain/`
- 預設第一個 bounded context
- 開第一個 feature directory
- 改 release / hotfix workflow

## Step 4 — Baseline files 寫入 repo

Bob 確認後，Dflow 寫入 baseline。

**features workspace**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/features/active/.gitkeep`](outputs/dflow/specs/features/active/.gitkeep) | 進行中的 feature 工作區，目前沒有 feature 目錄。 |
| [`outputs/dflow/specs/features/completed/.gitkeep`](outputs/dflow/specs/features/completed/.gitkeep) | 已完成 feature 的歸檔區。 |
| [`outputs/dflow/specs/features/backlog/.gitkeep`](outputs/dflow/specs/features/backlog/.gitkeep) | 尚未開工或 deferred 的 feature backlog。 |

**domain / migration baseline**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | Ubiquitous Language 起點，先放核心術語與 open questions。 |
| [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | Brownfield tech debt backlog，記錄 Code-Behind、SP、測試與 migration gap。 |

**shared governance**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/shared/_conventions.md`](outputs/dflow/specs/shared/_conventions.md) | spec writing conventions，含 Brownfield modify-existing 補充與 `zh-TW` prose language。（本 fixture 是節錄版：省略 `> Dflow Version:` 行與 `## Git Policy`／`## AI Commit Policy` 兩段；實際 `dflow init` 產出是完整的。） |
| [`outputs/dflow/specs/shared/_overview.md`](outputs/dflow/specs/shared/_overview.md) | OrderManager overview、current architecture、migration context 與 pain points。 |
| [`outputs/dflow/specs/shared/Git-principles-gitflow.md`](outputs/dflow/specs/shared/Git-principles-gitflow.md) | release / hotfix 節奏對應的 Git Flow guide。 |
| [`outputs/dflow/specs/shared/AI-AGENT-GUIDE.md`](outputs/dflow/specs/shared/AI-AGENT-GUIDE.md) | AI tool-neutral canonical guide（本 fixture 是節錄版：省略 walkthrough 沒走到的段落，例如帶 ordered cascade 的 § Ceremony Scaling；實際 `dflow init` 產出是完整的）。 |

**workflow bundle（Dflow 管理；`outputs/` 未收錄）**

`dflow init` 另外把一份 workflow bundle vendor 到
`dflow/specs/shared/dflow-workflows/`，Brownfield 共 26 個檔：15 份 reference
文件（各指令的 flow 步驟文件，加上兩軌共用的參考檔）、10 份空白 spec 模板、
1 份 manifest。
（比 Greenfield 少兩份：`aggregate-design.md` 與 `events.md` 是 Greenfield 專屬模板。）
它由 Dflow 管理，`dflow configure-agents` 每次都會重新投影，**不要手動編輯**
（下次投影會被覆蓋）。因為它與本篇劇情無關、內容也只是 Dflow 套件的複本，
本 tutorial 的 `outputs/` 沒有收錄；你自己的專案裡它會在。

> **關於 `dflow doctor`**：在本 tutorial 的 `outputs/` 上跑 `dflow doctor` 會得到
> 6 條 findings（3 warn、3 info）。它們**全部**來自 fixture 的手工節錄與凍結——
> 剛跑完 `dflow init` 的樹跑 doctor 是 `All checks passed`。所以那 6 條不是
> 你的專案該有的狀態，也不是 Dflow 的預設輸出。

**AI tool shim**

| Path | 用途 |
|---|---|
| [`outputs/CLAUDE.md`](outputs/CLAUDE.md) | Claude Code shim，指向 canonical AI guide。 |

**project-level skill（自然語言自動觸發）**

| Path | 用途 |
|---|---|
| [`outputs/.claude/skills/dflow/SKILL.md`](outputs/.claude/skills/dflow/SKILL.md) | Claude Code 專案層 skill。Bob 說「訂單折扣好像算錯了」這類自然語言時，Claude 會依觸發描述自動建議對應 workflow。skill 檔是衍生物；產品建議的預設做法是 gitignore、clone 後用 `configure-agents --skills` 重投影，但 commit 進版控也是可以的。 |

**optional command adapters**

`dflow init` 建立 root shim 與 project-level skill。若 Bob 想在 Claude Code 中
看到工具原生 Dflow 命令入口，可以在 init 後執行：

```bash
dflow configure-agents --command-adapters
```

選擇 Claude Code 後，Dflow 會產生 `.claude/commands/dflow/<id>.md`，Claude Code
中的叫法是 `/dflow:<id>`，例如 `/dflow:modify-existing`。若同一專案也啟用其他
工具，GitHub Copilot 的 prompt 選單是 `/dflow-<id>`，Codex CLI 則使用不帶斜線的
`dflow:<id>`。這些都指回 `AI-AGENT-GUIDE.md` 的 canonical `/dflow:*` workflow；
差別只在各工具 `/` parser 行為。

## 為什麼 init 不建 `Order` BC

Order 是最可能先處理的候選，但 init 仍不建立 `dflow/specs/domain/Order/`。

原因是 Brownfield 的第一個風險不是「沒有 model」，而是「太早把不確定的 legacy 行為
寫成 model」。Bob 還沒有完成 baseline capture，也還沒有把第一個折扣問題拆成：

- confirmed current behavior
- buggy code result
- expected business rule
- unknown cross-page behavior
- tech debt disposition

因此 Dflow 只先建立 `glossary.md` 與 `migration/tech-debt.md`。真正的
`Order/context.md`、`Order/models.md`、`Order/rules.md`、`Order/behavior.md` 會在
[〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)
和後續 baseline-capture 中由具體 evidence 推出。

## Step 5 — Results and next step

Dflow 最後印出結果報告——依序是 `Created:`（37 行路徑）、`Updated:`、`Removed:`、
`Skipped:`、`Warnings:`、`Deferred:`，然後是收尾。

⚠ **`Warnings:` 對 Bob 不是空的，這一段要看。** 那一格是 init 回報「還沒解決的佔位符」的地方，
Bob 實跑會拿到：

```text
Warnings:
- Unresolved placeholders remain for later SDD workflows: {Language}, {ORM / persistence},
  {ORM version}. Fill them in (or leave for the workflow to resolve) in:
  dflow/specs/shared/_overview.md, ...
```

原因是他第 2 題答的是 `.NET Framework 4.8 / WebForms / EF 6 / SQL Server 2019 / IIS`
——這句話人看得懂，但 init 沒辦法把它拆進 `_overview.md` 的每一格。Bob 該做的是打開
`dflow/specs/shared/_overview.md` 補上三格：

| 佔位符 | Bob 填什麼 |
|---|---|
| `{Language}` | `C#`（.NET Framework 4.8 的預設語言版本是 C# 7.3） |
| `{ORM / persistence}` | `Entity Framework` |
| `{ORM version}` | `6`——他第 2 題只答到「EF 6」。真實專案請填 `packages.config` 裡的實際版本，別照抄 |

⚠ **先講產品寫出來的形狀，免得你打開自己的檔案以為做錯了**：這三個佔位符在
`_overview.md` 的 `## Technical Architecture (Current)` 那張表裡只佔**兩列**——init 寫的是
`| ORM / persistence | {ORM / persistence} ({ORM version}) |`，**版本包在括號裡、沒有獨立的版本列**。
兩列是產品的形狀，不是誰事後改的。
（⚠ `{ORM / persistence}` 在檔案裡其實還有第三處——`### Target Architecture` 那段散文也用到它，
而 init 掃佔位符是掃全檔，所以那一處也是 Bob 的 `Warnings:` 會點名它的原因之一。）
（同一張表還有 `| Database | {e.g. SQL Server 2019, MySQL 8.0} |` 也是空的——即使 Bob
第 2 題就答過 SQL Server 2019。init 不會把那句話拆進各欄，所以這格同樣要自己補。）

再對照本篇 `outputs/` 的 [`_overview.md`](outputs/dflow/specs/shared/_overview.md)，
措辭又不一樣：Bob 把列名改成 `ORM / data access`、值寫成
`Entity Framework 6 + Stored Procedures + some ADO.NET wrappers`，`Language` 那格寫
`C# 7.x era codebase`。**那些才是他自己決定的**——列名與措辭可以改，
重點是那幾個佔位符都不再是佔位符。

不補也不會壞——後續 SDD workflow 會再問一次；但那三格是 AI 讀 `_overview.md` 時判斷技術
邊界的依據，愈早填愈少猜。收尾長這樣：

```text
Dflow init complete.

Recommended next steps:
- For a new feature, use the Dflow new-feature workflow when it becomes available as a CLI command.
- For brownfield changes, use the Dflow modify-existing workflow when it becomes available as a CLI command.
- Before generating more specs, make sure dflow/specs/shared/_conventions.md has the correct Prose Language section.
- For stack-specific examples (.NET, Java/Spring, Node/TypeScript, Python, Go, PHP/Laravel), see docs/examples-by-stack.md in the Dflow repo.
- Project-level skill files (.claude/skills/, .agents/skills/, .github/skills/) are Dflow-managed derivatives: the recommended default is to gitignore them and re-run `dflow configure-agents --skills` after cloning; committing them also works if the team prefers.
```

⚠ 這份清單是**產品自己印的、而且兩軌一模一樣**——它不會針對 Brownfield 給不同建議，
也**沒有**叫你去跑 `/dflow:modify-existing`（它說那些 workflow「when it becomes
available as a CLI command」）。真正的入口在 AI coding agent 那一側，不在 shell。

Bob 的下一步不是重構，而是等待第一個具體修改需求。他會從一張折扣計算客訴進來，讓 Dflow
先判斷修改重量、feature linkage 與 baseline capture 範圍。

## Dflow feature / benefit mapping

| Dflow 行為 | 讀者應該看到的 benefit |
|---|---|
| Brownfield current-state inventory | 先讀現有 repo，而不是套 Greenfield 假設。 |
| migration context 問答 | 把 modernization 目標記進 baseline，但不立即大重寫。 |
| `migration/tech-debt.md` | Day-0 就開始累積 future migration source of truth。 |
| `Will defer:` 區塊 | 防止 init 預建假的 Order model 或空 context map。 |
| Claude shim + canonical guide | 讓 AI 協作規則集中，不散在各工具檔。 |
| 結尾的 `Recommended next steps:` | 收尾就把注意力導回「下一個具體修改」與 `_conventions.md` 的待辦，不是抽象架構重畫。（⚠ 這份清單是通用的，不會指名 `/dflow:modify-existing`——那個入口在 AI agent 側。） |

## 下一個劇情段

→ [〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)：Bob
用一個真實折扣計算問題啟動 Brownfield modify-existing flow，先捕捉 current behavior，
再建立第一段 Order Domain logic。
