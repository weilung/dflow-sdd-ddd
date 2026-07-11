# 在 GitHub Copilot 中使用 Dflow

> **繁體中文** | [English](using-with-github-copilot.en.md)

當你的 AI 程式設計助理是 GitHub Copilot 時，Dflow 的使用體驗 walk-through。GitHub
Copilot 有兩個介面——**VS Code Copilot Chat**（IDE 內的 chat panel + inline
completions）與 **GitHub Copilot CLI**（終端機）——兩者觸發 Dflow 與調用命令的方式
不同，本指南會分開說明。閱讀約需 10 分鐘。

本指南專注於 GitHub Copilot 的具體使用體驗。工具中立的評估流程請見
[`docs/evaluating-dflow.md`](evaluating-dflow.md)。完整的 Get Started
與功能列表請見 [`README.md`](../README.md)。

## 本指南的適用對象

你正在使用或評估以 GitHub Copilot 作為 AI 程式設計助理的 Dflow。
本指南說明 `init` 之後 Copilot 看到了什麼、repository shim 的位置、
如何在 VS Code Copilot Chat 與 Copilot CLI 兩個介面呼叫 Dflow workflow，
以及幾個值得了解的 Copilot 專屬使用模式與 permission 行為。

## 前置條件

- 在你的 IDE（VS Code、JetBrains 或 GitHub.dev）中已啟用 GitHub Copilot。
- 已具備 Node.js / npm 環境（Dflow 透過 npm 發佈）。以
  `npm install -g dflow-sdd-ddd` 全域安裝，或用 `npx dflow-sdd-ddd init`
  走免安裝路徑，確保 repository shim 存在。
- 已具備 Dflow canonical 指南的基本認識：`dflow/specs/shared/AI-AGENT-GUIDE.md`。

## `init` 之後 GitHub Copilot 看到了什麼

`init` 為 Copilot 在以下路徑寫入一個小型的工具專屬薄 shim：

- `.github/copilot-instructions.md`（注意：位於 `.github/` 目錄內，非專案根目錄）

生成的 shim 範例：

```markdown
# GitHub Copilot Repository Instructions

This project uses Dflow for spec-first AI-assisted development.

For spec-impacting work — a new feature, a change to product, user-facing, or
domain behavior, a new requirement, or a bug-fix workflow — read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md` — command registry, routing rules, and project context.
- `dflow/specs/shared/dflow-workflows/` — vendored workflow bundle with executable step definitions.

For routine work (refactors, renames, chores, formatting, dependency bumps, or
general code questions), proceed normally; you need not read the guide first.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
```

重點說明：

- Copilot shim 位於 `.github/copilot-instructions.md`（見 `lib/init.js` mapping）。
- Copilot shim 是薄指標，只透過路徑指向 canonical 指南；讀取
  `dflow/specs/shared/AI-AGENT-GUIDE.md` 時需明確開啟該檔案。

## 在 GitHub Copilot 中使用 Dflow Workflow 指令

GitHub Copilot 有兩個介面，Dflow 在兩者的觸發與命令行為不同，先分清楚再用：

- **VS Code Copilot Chat**（IDE 內的 chat panel）：自然語言**會自動觸發** Dflow
  的 skill；若你 opt in prompt adapters，工具原生命令 `/dflow-<id>`（連字號）也可用。
- **GitHub Copilot CLI**（終端機）：**沒有**自然語言自動觸發；要先打 `/dflow`
  **手動喚起** skill 再由它引導；per-id 的 `/dflow-<id>` 命令在 CLI **不可用**。

兩介面共用同一組 workflow 入口（詞彙相同，差別只在怎麼喚起）：

| 指令 | 適用情境 |
|---|---|
| `/dflow:new-feature` | 需要新增一個使用者可見的功能或業務行為。 |
| `/dflow:modify-existing` | 需要修改現有行為。 |
| `/dflow:bug-fix` | 可以用預期行為 vs 實際行為描述的缺陷。 |
| `/dflow:new-phase` | 進行中的 feature 需要另一個實作 slice。 |
| `/dflow:finish-feature` | 實作完成後需要進行漂移（drift）收尾。 |
| `/dflow:verify` | 需要對 spec、領域文件、實作與測試進行一致性檢查。 |
| `/dflow:pr-review` | 變更已準備好進行 SDD/DDD review。 |
| `/dflow:report-dflow-feedback` | 你發現了 Dflow 的問題或改進點，想要一份清理過的上游回饋草稿。 |

> **語法提醒**：表中 `/dflow:<id>`（**冒號**）是 Dflow 的 canonical 詞彙，也是
> Claude / Codex 的**實際命令**語法。Copilot 的 prompt-adapter 命令改用
> `/dflow-<id>`（**連字號**），且只在 VS Code 活；在 Copilot 裡不要照字面把冒號
> 形式當命令輸入（Copilot CLI 會把 `/dflow:new-feature` 斷成 `/dflow`）。下面分介面
> 說明各自怎麼呼叫。

### 介面 A：VS Code Copilot Chat

- **自動觸發**：有。在 chat 直接用自然語言描述要做的事（例：「I want to add CSV
  export for users」），Dflow 的 skill 會自動 engage、判斷對應 workflow，並以
  **suggest-and-wait**（建議命令、等你確認）開始，不會擅自跑完整個 workflow。
- **命令**：`/dflow-<id>`（**連字號**）可用，但需先在專案跑
  `dflow configure-agents --command-adapters` 投影
  `.github/prompts/dflow-<id>.prompt.md`（見下節），之後在 prompt 選單選
  `/dflow-new-feature` 即可。
- **純文字也行**：你也可以在 chat 用普通文字描述 workflow（例：`Run the Dflow
  /dflow:new-feature workflow.`）——此時 `/dflow:new-feature` 只是被當成**文字
  稱呼**，不是被當命令解析。

### 介面 B：GitHub Copilot CLI

- **自動觸發**：**無**。直接送自然語言**不會** engage Dflow 的 skill。
- **喚起方式**：先打 `/dflow`（無 id 後綴）**手動喚起** skill；skill engage 後會
  列出可用的 workflow / 問你要做什麼，接著你用**自然語言描述**（例：「I want to
  add CSV export」）或回覆它列的選項即可繼續。它一樣以 suggest-and-wait 運作。
- **命令**：per-id 的 `/dflow-<id>` 在 CLI **不可用**——
  `.github/prompts/dflow-<id>.prompt.md` 是 VS Code Chat 專屬、**CLI 不讀取**，
  輸入 `/dflow-new-feature` 會得到 Unknown；冒號形式 `/dflow:new-feature` 則被
  CLI 斷成 `/dflow`。CLI 沒有 per-id 命令入口，統一走「`/dflow` 喚起 → 會話描述」。
- **skill 建議的命令怎麼辦**：skill engage 後可能會建議你用某個 `/dflow:<id>`
  （這是給 Claude / Codex 的 canonical 寫法）。在 Copilot **不必照字面輸入那串
  命令**——CLI 裡 skill 已經 engage，直接在會話用文字描述要的 workflow、或回覆
  確認即可；VS Code 裡則改用 prompt 選單的 `/dflow-<id>`（連字號）。

### 選配 Prompt Adapters

如果想在支援 prompt files 的 VS Code Copilot 環境中使用工具原生**命令**入口，可在
已初始化的專案中執行：

```bash
dflow configure-agents --command-adapters
```

選擇 GitHub Copilot 後，Dflow 會從 canonical guide 內的 command registry
投影產生薄 prompt wrapper：

- `.github/prompts/dflow-<id>.prompt.md`

這些 prompt **只在 VS Code Copilot Chat 的 prompt 選單**生效（形式為
`/dflow-<id>`，例如 `/dflow-new-feature`）；**Copilot CLI 不讀取**
`.github/prompts/`，所以這條命令路徑在 CLI 不可用（見上方「介面 B」）。Prompt
內容只指向 canonical `/dflow:new-feature` workflow 與
`dflow/specs/shared/AI-AGENT-GUIDE.md`，不複製 workflow 步驟。注意命令語法用
**連字號** `/dflow-<id>`，不是 canonical 的**冒號** `/dflow:<id>`——後者是
Claude / Codex 的命令寫法，在 Copilot 只能當文字稱呼、不能當命令輸入。

### Copilot 的 skill 觸發（init 預設安裝）

Dflow 會為 **Claude Code、Codex 與 GitHub Copilot**
各自投影同一份工具中立的 thin skill 到它們的 project-level skill 路徑；Copilot 的是
`.github/skills/dflow/SKILL.md`。這份 skill 現在**預設安裝**：`dflow init` 有選
Copilot 就裝（互動問一題預設 Y、非互動直接裝）、`dflow configure-agents` 對新選且
尚無 skill 的 Copilot 也補問；`dflow configure-agents --skills` 用於補裝或強制
重生成。實測（2026-06-05）確認 Copilot 會從**自己原生的
`.github/skills/`** 探索並運作（即使移除 `.claude`/`.agents` 的跨讀路徑也成立），
觸發方式依介面而異——**VS Code Chat 自然語言自動觸發**、**Copilot CLI 需打 `/dflow`
手動喚起**（細節見上方介面 A / B）。

> 註：Copilot 也會跨讀 `.claude/skills` 與 `.agents/skills`；若你同一專案同時選了
> Copilot 與 Claude / Codex，同一份 `dflow` skill 可能從多條路徑被看到。Dflow **產生**
> 的各份內容逐字相同（同 `name`），所以正常情況一致；但若你在某條路徑已有自己的
> （非 Dflow）`dflow` skill，Dflow 會原地保留、不覆寫——它可能與原生那份內容不同，
> 建議移除或改名以免同名重複。

### 產生物的版控政策與升級

`.github/prompts/dflow-<id>.prompt.md` 是從 canonical guide 投影出來的**衍生物**。Dflow 的
**建議預設**是不版控、由 clone 後重跑 `dflow configure-agents --command-adapters` 重生成；團隊若
想 clone 後立即有原生 prompt 選單，也可改為**版控**。請對同專案的所有工具採一致策略（政策總覽見
[README「Init 產生的檔案」](../README.md#init-產生的檔案)）。

採 gitignore 預設時，在專案 `.gitignore` 加入（**注意 glob 副作用**）：

```gitignore
.github/prompts/dflow-*.prompt.md
```

此 glob 會一併 ignore 你自己以 `dflow-` 開頭命名的 prompt 檔。若你有同前綴的自訂 prompt，請改用
更精確的規則或替自訂檔改名。若這些 prompt **已被版控**，新增 ignore 不會自動移出版控，需先：

```bash
git rm --cached .github/prompts/dflow-*.prompt.md
```

（`--cached` 只移出版控、保留工作目錄檔案。）

升級 dflow 後重跑 `dflow configure-agents --command-adapters`，prompt adapter 會用**新版 registry**
重投影；但既有 `dflow/specs/shared/AI-AGENT-GUIDE.md` **不會**被覆寫——「重投影 adapter」不等於
「升級 canonical guide」。請以**相同的 dflow CLI 版本**重投影。

### 對話範例

典型的 Copilot Chat workflow 如下：

```text
You: I'd like to use the /dflow:new-feature workflow. We need to add the
     ability for users to export their data as CSV.

Copilot: I'll help you structure this as a new feature. Let me start by
         reviewing the AI-AGENT-GUIDE to understand the spec format.

         Before drafting the feature spec, I need to understand the scope:

         1. Should the CSV include all user data fields or a selected subset?
         2. Which user roles should be able to trigger the export?
         3. Are there any compliance or performance constraints I should know?

You: All fields, only admin users, and exports should complete within 30 seconds
     for datasets up to 1 million rows.

Copilot: Got it. I'll create the feature spec at dflow/specs/features/active/
         with these constraints. Let me also outline the implementation phases...
```

### 既有的 Repository 指示

如果你的專案中已有 `.github/copilot-instructions.md`，`init` 不會覆蓋自訂內容。
已是 Dflow-generated shim 的檔案會原地刷新；其他已指向
`dflow/specs/shared/AI-AGENT-GUIDE.md` 的檔案會略過。若既有檔案尚未指向 guide，
Dflow 會在確認 preview 顯示並於檔案末尾附加帶有
`<!-- dflow-generated: agent-shim START/END -->` markers 的 Dflow block；重跑會
原地更新同一段，不會重複。這樣可以避免破壞你已有的自訂 Copilot 指示。若你刪除
該 block，下一次 `init` / `configure-agents` 會再附加它。

只有遇到衝突或 malformed Dflow markers 時，才到
`dflow/specs/shared/copilot-instructions-snippet.md` 找 fallback merge snippet，
再手動處理你現有的 `.github/copilot-instructions.md`。

### `/dflow:<id>`（冒號形式）能不能直接輸入？

canonical 的 `/dflow:<id>`（冒號）是給 Claude / Codex 的命令寫法。在 Copilot
**兩個介面都不要把它當命令字面輸入**：

- **VS Code Chat**：當文字稱呼可以（Copilot 會理解你指的 workflow）；要命令入口
  請用 prompt-adapter 的 `/dflow-<id>`（連字號）。
- **Copilot CLI**：輸入 `/dflow:new-feature` 會被斷成 `/dflow`（只喚起 skill、不帶
  id）。直接打 `/dflow` 喚起後，用文字描述要的 workflow 即可。

任何介面只要 slash 形式沒被識別，就改用普通文字重新送出請求：

```text
You: Please help me start a new Dflow feature workflow. Read
     dflow/specs/shared/AI-AGENT-GUIDE.md first.
```

## 與其他 AI 工具的差異

canonical 指南（`dflow/specs/shared/AI-AGENT-GUIDE.md`）在各工具之間是相同的。
只有根目錄層的 shim 有所不同：

| 工具 | 產生的 shim | 載入 canonical 指南的方式 |
|---|---|---|
| GitHub Copilot | `.github/copilot-instructions.md` | 直接讀取 repository 指示 |
| Claude Code | `CLAUDE.md` | 啟動時直接讀取檔案內容 |
| Codex / Copilot coding agent | `AGENTS.md` | 啟動時直接讀取檔案內容 |

- Shim 路徑：Copilot 使用 `.github/copilot-instructions.md`（不是 `AGENTS.md`
  或 `CLAUDE.md`）。
- 載入方式：Copilot shim 是薄指標、不 inline 指南（與其他工具一致）；
  canonical 指南按需載入。
- 工具模型：Copilot 有兩個介面——VS Code Chat（chat panel + inline completions）
  與 Copilot CLI（終端機）；Codex / Claude Code 是 CLI-based agent。兩個 Copilot
  介面與 Dflow 的互動方式不同（見上方介面 A / B）。
- Workflow 呼叫：canonical `/dflow:*` 是共同詞彙，但各工具 `/` parser 行為不同。
  Claude / Codex 直接吃 `/dflow:<id>`（冒號）當命令；Copilot **不行**——VS Code
  的命令入口是 prompt-adapter 的 `/dflow-<id>`（連字號，需 `--command-adapters`），
  Copilot CLI 則沒有 per-id 命令、改打 `/dflow` 喚起 skill（見上方介面 A / B）。
- Permission 模型：Copilot 依賴 IDE 的 permission 與 extension sandbox。它可能
  受 editor-level approvals 管理；CLI 工具通常有明確的 sandbox flags 與獨立的
  permission gates。

## 常見模式與注意事項

- 保持 `.github/copilot-instructions.md` 精簡。Canonical Dflow 指南
  （`dflow/specs/shared/AI-AGENT-GUIDE.md`）才是 source of truth。
- 若 Copilot 看起來只從 shim 文字工作，請明確要求它開啟或讀取
  `dflow/specs/shared/AI-AGENT-GUIDE.md` 後再繼續。
- Copilot 的 inline completions 可能在未走 Dflow workflow 的情況下直接建議程式碼；
  需要 spec-driven 輸出時，請明確要求執行 workflow。
- Copilot Chat context 不一定會在所有 IDE 版本中自動包含 `.github/` 目錄下的
  repository 指示檔；行為因 Copilot / IDE 版本而異（見頁尾說明）。
- 先分清楚介面：VS Code Chat 自然語言自動觸發、命令用 `/dflow-<id>`；Copilot CLI
  無自動觸發、先打 `/dflow` 喚起、沒有 per-id 命令（見上方介面 A / B）。
- 當 slash 形式沒被識別（VS Code Chat 偶發、或 Copilot CLI 的 `/dflow-<id>`
  Unknown）時，改用普通文字描述 workflow，或在 CLI 先打 `/dflow` 喚起 skill。
- Prompt adapter 是從 canonical command registry 產生的薄 wrapper；不要在
  `.github/prompts/` 中手寫或複製 Dflow workflow 步驟。

## 下一步

如果你還沒有執行 `init`：

- 執行 `dflow init`（安裝後）或 `npx dflow-sdd-ddd init`，選擇 Copilot 目標
  以建立 `.github/copilot-instructions.md`。參考
  [評估者指南 Playbook](evaluating-dflow.md#30-分鐘評估-playbook) 在可拋棄的
  範例專案中試用。

如果你已執行 `init` 且想查看端到端的 workflow 範例：

- 閱讀 [`dflow/specs/shared/AI-AGENT-GUIDE.md`](../templates/greenfield/scaffolding/AI-AGENT-GUIDE.md)
  （或 brownfield 等效版本）後再開始 workflow。
- 閱讀 [`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md)，
  其中有展示 Copilot chat flow 的對話範例。

如果你想了解設計理念：

- 閱讀[為什麼 AI 時代 DDD 更重要](why-ddd-for-ai.md)。

---

行為說明：本指南描述的介面差異（VS Code Chat 自然語言自動觸發、Copilot CLI 以
`/dflow` 手動喚起、prompt adapters 僅 VS Code）依 2026-06-05 實測；`.github/`
指示檔的自動包含與各介面的 `/` 命令解析仍可能因 Copilot / IDE 版本而異，依賴確切
語意前請向 maintainer 確認。
