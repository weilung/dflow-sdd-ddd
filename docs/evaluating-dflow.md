# 評估 Dflow

> **繁體中文** | [English](evaluating-dflow.en.md)

首次評估 Dflow 是否適合專案的簡明指引。
閱讀約需 10 分鐘；可選擇再花 30 分鐘在範例專案中實際試用。

## 本指引的適用對象

你正在評估是否要在一個 codebase 中引入 Dflow。你可能是正在評估 AI 輔助團隊 workflow 變更的技術主管、比較各種 AI 開發 workflow 的獨立開發者，或是在更廣泛採用前受指派評估 Dflow 的團隊成員。

本指引把最常見的評估問題彙整在一處。它不取代
[`README.md`](../README.md)（概覽）或 [`tutorial/`](../tutorial/)
（深度 walk-through）；它是一份聚焦的決策輔助文件。

## Dflow 是什麼

Dflow 是一套 AI 輔助開發的 workflow 工具集。它為 AI 程式設計助理提供具體流程，把變更需求轉成結構化規格、領域語言、與可審查的程式碼，而不是從 prompt 直接跳到程式碼。

Dflow 是 Markdown-based 的 workflow 材料加上一個 scaffolding CLI。它不需要任何 runtime、server 或 framework。`init` 跑完之後，Dflow 完全存在於你的專案的 `dflow/specs/` 目錄與 AI 指示檔中。

## `init` 產生什麼、不做什麼

`dflow init`（或免安裝路徑的 `npx dflow-sdd-ddd init`）會建立：

- `dflow/specs/` workspace（概覽、慣例、領域詞彙表、context map、架構 / 技術債、功能 active/completed）。完整目錄樹見
  [`README.md` "Init 產生的檔案"](../README.md#init-產生的檔案)。
- 位於 `dflow/specs/shared/AI-AGENT-GUIDE.md` 的 canonical 專案指南。
- 你所選工具的可合併 AI 指示檔（例如 `CLAUDE.md`、`AGENTS.md`、`.github/copilot-instructions.md`）。每個都是指向 canonical 指南的薄 shim。

`init` **不會**：

- 檢查、重構、或遷移你的應用程式碼。
- 覆寫既有的 AI 指示檔；若檔案已存在，Dflow 改在 `dflow/specs/shared/` 下寫入 merge snippet。
- 修改你的建構系統、套件管理工具、或相依套件。
- 傳送任何資料到外部；它是本機的 scaffolding 指令。

## Dflow 如何與不同 AI 工具協作

Dflow 支援多種 AI 程式設計助理。跑完 `init` 後，你選取一個或多個工具，Dflow 就會寫入對應的 shim：

| 工具 | 產生的檔案 |
|---|---|
| Codex / Copilot coding agent | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

每個 shim 都指向 canonical 的 `dflow/specs/shared/AI-AGENT-GUIDE.md`。實際意義：

- 同一個專案可以同時啟用多個工具，而不會有 workflow 規則分歧。
- 之後切換或新增工具不需要重跑 `init`；執行 `dflow configure-agents` 即可新增 shim，或用 `dflow configure-agents --command-adapters` opt in 工具原生命令入口。
- 專案指南始終保持為 Dflow workflow 行為的單一 source of truth。

`/dflow:*` 是 canonical 共同詞彙，但各工具的 `/` parser 行為不同：Claude Code
command adapters 使用 `/dflow:<id>`，GitHub Copilot prompt 選單使用
`/dflow-<id>`（chat 文字仍可說 `/dflow:<id>`），Codex CLI 使用不帶斜線的
`dflow:<id>`。Dflow 是 Markdown-based 的 workflow 材料，能與任何可讀專案指示與
repo 上下文的 AI 助理一起運作。

關於特定工具的 `init` 寫入內容與 slash command 在對話中的呈現方式，見各工具指南：

- [在 Claude Code 中使用 Dflow](using-with-claude-code.md)
- [在 Codex CLI 中使用 Dflow](using-with-codex.md)
- [在 GitHub Copilot 中使用 Dflow](using-with-github-copilot.md)

## Greenfield 或 Brownfield：選擇 Track

選 **Greenfield** 若：

- 你正在啟動一個新系統或新的 bounded module。
- 你有空間在 legacy 限制累積前先塑形架構。
- 你想從 feature 1 就建立明確的領域模型。

選 **Brownfield** 若：

- 你正在擴充或修改一個既有的 codebase。
- 業務規則散落在 handler、stored procedure、UI 程式碼或腳本中。
- 你想漸進引入規格與領域抽出，而不必先做全面重構。

混合情境：

- 在既有 app 內加入新 module：通常選 Greenfield，scope 限定在新的 bounded context。
- 既有 app 具有乾淨架構且持續開發中：兩種 track 都可行；業務規則尚未文件化時 Brownfield 較安全。

## 30 分鐘評估 Playbook

這份 walk-through 讓你在不動到真實 codebase 的情況下看清楚 Dflow 的實際效果。

1. **建立範例專案**（Greenfield）：

   ```bash
   mkdir dflow-sample && cd dflow-sample
   git init
   ```

2. **安裝並執行 init**：

   ```bash
   npm install -g dflow-sdd-ddd
   dflow init
   ```

   若不想全域安裝，改用 `npx dflow-sdd-ddd init`。提示時選擇 Greenfield，並選取一個 AI 工具產生 shim。

3. **檢視產生的內容**：

   ```bash
   ls -la
   find dflow -type f
   ```

   開啟 `dflow/specs/shared/_overview.md`、`dflow/specs/shared/_conventions.md`、以及 `dflow/specs/shared/AI-AGENT-GUIDE.md` 看看整體架構。

4. **閱讀一份 tutorial walk-through** 以了解完整的 feature flow：
   - Greenfield：[`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md)
   - Brownfield：[`tutorial/02-brownfield/`](../tutorial/02-brownfield/walkthrough-00-setup.md)

5. **選用：試跑一個 workflow 指令**。在你的 AI 工具中開啟範例專案，依工具叫法執行 new-feature workflow（Claude Code adapters 用 `/dflow:new-feature`、Copilot prompt 選單用 `/dflow-<id>`、Codex CLI 用 `dflow:new-feature`）。檢查它寫入 `dflow/specs/` 的內容。

6. **決定並清理**。若 Dflow 不適合，直接刪除範例目錄。沒有全域狀態需要清除；除了一次性的 `npx` 快取，什麼也沒有安裝。

若你偏好不執行任何指令、只做深度閱讀，tutorial walk-through 也涵蓋同樣的 flow，並附有可供對比的預期產出。

## 若你停用 Dflow

Dflow 的設計讓試用成本低、退出成本也低：

- `init` 完成後，你的專案不依賴已安裝的 `dflow-sdd-ddd` CLI。
- 產生的檔案都是純 Markdown；用 `rm -rf dflow/` 加上刪除你不再需要的 AI 指示 shim 檔案，即可從專案中移除 Dflow。
- 既有的專案指示檔（例如原本就存在的 `CLAUDE.md`）不會被 Dflow 修改，因此復原很直接。

這表示評估一輪後，若你決定不採用，不會留下任何永久痕跡。

## 每個 Feature 的成本：概略估算

Dflow 依改動深淺將流程份量調整為三個 tier（完整說明見
[`README.md` "Workflow 模型"](../README.md#workflow-模型)）：

- **T1 Heavy** — 新 feature、新 phase、新 Aggregate 或 Bounded Context、架構變更、新業務規則。需要完整的 phase-spec，包含領域建模、行為例子、實作計畫、以及驗證與收尾檢查。成本確實存在，但與所管理的風險成正比。
- **T2 Light** — bug fix（邏輯錯誤）、UI 驗證調整、有業務規則 delta 的小幅修改。需要 lightweight spec、聚焦驗證、以及確認修復落在正確的架構層。
- **T3 Trivial** — 按鈕顏色、文案 typo、純 formatting — **不動業務規則、不動 Domain 概念、不動資料結構**。只需在 `_index.md` 寫一行，不另開 spec 檔。

Tier 不是每次都由 user 手動決定：`/dflow:new-feature` 與 `/dflow:new-phase` 預設一律 T1；`/dflow:modify-existing` 與 `/dflow:bug-fix` 則由 AI 依實際改動內容判斷 T1 / T2 / T3。純 typo / formatting commit（例如 `prettier`、`dotnet format`）可以完全跳過 Dflow 直接 `git commit` — Dflow 是給有業務語意或結構影響的變更使用的。

## 專案語言相容性

Dflow 模板使用**英文 canonical 結構**（標題、欄位標籤），讓 AI 助理能可靠地在不同專案間定位各段落。你在模板內容中自由撰寫的文字可以使用任何團隊語言 — 英文、繁體中文、簡體中文或其他。init 流程會詢問專案的文章語言，並存入 `dflow/specs/shared/_conventions.md`。

實際效果：

- AI 工具在不同專案間看到一致的英文結構。
- 人員以團隊選定的語言讀寫規格。
- 不需要翻譯模板或維護平行的在地化副本。

## 下一步

若你決定 Dflow 適合：

- 在你的真實專案執行 `init`（建議先用 branch）。
- 閱讀 [`tutorial/`](../tutorial/) 取得端到端 walk-through 與預期產出。
- 開 issue 或 pull request 前，先看 [`CONTRIBUTING.md`](../CONTRIBUTING.md)。

若你還在評估中：

- 閱讀 [為什麼 AI 時代 DDD 更重要](why-ddd-for-ai.md)，了解 spec-first 加上 DDD 背後的設計理由。
- 把 tutorial 劇情逐步與它的 `outputs/` 目錄對比，看看 Dflow 規格在接近正式的狀態下是什麼樣子。

若 Dflow 目前不適合你的專案：

- structured-spec 的概念是可移植的；你可以採用其中一部分而不需要 CLI。
- 若某個具體缺口阻礙了你，開一個 docs feedback issue（見 [`CONTRIBUTING.md`](../CONTRIBUTING.md)）。這類回饋對未來的評估者很有幫助。
