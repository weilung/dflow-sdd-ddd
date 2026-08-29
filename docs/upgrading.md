# 升級既有 Dflow 專案

> **繁體中文** | [English](upgrading.en.md)

> 本頁是 latest 指引、隨源碼 `main` 更新。建議先把 CLI 升到 npm 最新版再依本頁操作：
>
> ```bash
> npm install -g dflow-sdd-ddd@latest
> ```
>
> 頁面內容以最新發佈版行為為準；「誰擁有什麼、什麼永遠不會被動」的原則對較舊版本同樣適用，個別行為若需要較新版本會另行標註。

## 升級的基本模型

Dflow 升級分兩步：更新 CLI（上面那行），然後在專案根目錄重跑投影：

```bash
dflow configure-agents
```

`configure-agents` 是 idempotent 的「重投影」：它只刷新 Dflow 自己擁有的自動層，你撰寫的內容**不會被自動改寫或遷移**——唯一會改寫 user 內容的情況，是你在互動徵詢中**明確同意**的 marker 採用（其代價見下方狀態對照）。哪些會被刷新、哪些要加 flag，見下表。

## 誰擁有什麼：ownership × flag 對照表

| 專案內的面 | 例子 | 擁有者 | flagless `dflow configure-agents` 會做什麼 | 需要的 flag |
|---|---|---|---|---|
| 起始 scaffolding 與你的 specs | `_overview.md`、`_conventions.md` 內文、`Git-principles-{policy}.md` 的檔頭與 `## 6.` 以下、`dflow/specs/` 下你寫的一切 | **你** | 不動；唯一例外是把 `_conventions.md` 的 `> Dflow Version:` 對齊行更新為本次 CLI 版本 | — |
| Workflow bundle | `dflow/specs/shared/dflow-workflows/`（flow 文件、空白模板、`.dflow-bundle-manifest.json`） | Dflow | **自動重投影**；新版已移除的檔案依 manifest 差集自動清掉 | — |
| marker 劃定的區塊 | `CLAUDE.md` / `AGENTS.md` / `.github/copilot-instructions.md` 內的 `agent-shim` marker 區；`AI-AGENT-GUIDE.md` 的 `guide-canonical` 區；`Git-principles-{policy}.md` 的 `git-principles-canonical` 區（§§ 1–5） | Dflow（marker 內）／你（marker 外） | **原地刷新 `agent-shim`、`guide-canonical` 與 `git-principles-canonical` 區**；marker 外保留不動——包含 `## Project Context`，以及 Git principles 檔的檔頭與 `## 6. AI Collaboration Rules (Project Policy)` 以下 | — |
| 工具原生命令入口 | `.claude/commands/dflow/`、`.github/prompts/dflow-*.prompt.md` 等，以及 `AGENTS.md` 內的 `codex-command-triggers` marker 區 | Dflow | 不重生成 | `--command-adapters` |
| Project-level skill | `.claude/skills/dflow/`、`.agents/skills/dflow/`、`.github/skills/dflow/` | Dflow | 既有 skill 不重生成；新選工具還沒有 skill 時會詢問（預設安裝） | `--skills`（強制全部重生成） |

⚠ **上面兩列 `dflow doctor` 只看得到「已經在的檔」。** 它會報：命令入口只裝了一部分（少了哪幾支）、留著 `0.5.0` 舊檔名的殘留、以及 Dflow 產生的 `SKILL.md` 落後於目前 CLI。它**不會**報「一支都沒有」——那是刻意的，理由與殘餘風險寫在 [`doctor-uncertainty.md`](doctor-uncertainty.md) 的「已知、但刻意不回報的形狀」一節。所以升級後如果你**要**用 `/dflow:*`，請自己跑一次 `dflow configure-agents --command-adapters` 確認，不要等 doctor 提醒你。

一句話版本：**flagless 刷新 bundle、`agent-shim`、`guide-canonical` 與 `git-principles-canonical` 區；command adapters（含 `AGENTS.md` 的 `codex-command-triggers` 區）與既有 skill 要各自加 flag；你寫的東西永遠不會被自動改寫或遷移。**

## 既有檔案會被怎麼對待

- **未經編輯的 Dflow shim**（整檔都是 Dflow 產的、你沒改過）→ 直接原地重生成。
- **檔案內已有 Dflow marker 區** → 只刷新區塊內文字，marker 外保留。
- **既有、尚未指向 canonical 指南的 agent 檔** → 於整體 preview 確認後在檔尾附加帶 marker 的管理區塊。
- **你自己寫、已指向 canonical 指南的 agent 檔** → init 不改它、僅提示；**互動的 `configure-agents`** 會徵詢是否加掛 marker 管理區塊（預設**否**），非互動一律略過並警告。
- **agent 檔的 `agent-shim` marker 損壞或衝突** → 不動你的檔案，把待合併內容寫成 merge snippet 放到 `dflow/specs/shared/`，由你手動合併。
- **`AGENTS.md` 的 `codex-command-triggers` marker 損壞** → 只在 `--command-adapters` 管理它的那次執行觸發同樣的「不動檔案＋merge snippet」處理；flagless 執行不碰損壞的 trigger 區、仍照常刷新同檔的 `agent-shim` 區——前提是 trigger 區沒有與 shim 區重疊或交錯；重疊時即使 flagless 也整檔不動、走 merge snippet。
- **`AI-AGENT-GUIDE.md` 的 `guide-canonical` marker 損壞** → 指南保持不動，改以訊息指引你修復或移除 marker（不產 merge snippet）。
- **較舊版本建立、還沒有 marker 的 `AI-AGENT-GUIDE.md`** → 互動的 `configure-agents` 徵詢是否採用 marker。**注意採用的代價**：接受後指南會以套件模板重建——只有 `## Project Context` 被保留，**其餘自訂段落都會被取代**；若你改過其他段落，應婉拒採用、改走手動合併。未採用前 `dflow doctor` 會回報該檔處於凍結狀態、不會被自動刷新。
- **`Git-principles-{policy}.md` 的 `git-principles-canonical` marker 損壞** → 檔案保持不動，改以訊息指引你修復或移除 marker（不產 merge snippet）。`dflow doctor` 會把這個狀態單獨回報、不會併進「還沒有 marker」——被改壞的檔若被當成沒有 marker，採納提問就會去改寫沒有人重讀過的 §§ 1–5。
- **較舊版本建立、還沒有 marker 的 `Git-principles-{policy}.md`** → 互動的 `configure-agents` 徵詢是否採用 marker。**這個提問的範圍比指南那個窄得多**：只有 §§ 1–5 會被換成本版內容，檔頭（含你填的 `> Created:`）與 `## 6. AI Collaboration Rules (Project Policy)` 以下——包含你的 CI／CD 段——內容原封保留。（有一項全檔都適用、而且一直都在的正規化：換行符會統一成該檔原本佔多數的那一種，所以**混合**換行的檔案回來會是一致的，而不是逐位元組相同。）只有在你改過 §§ 1–5 之中的東西時才需要婉拒。未採用前 `dflow doctor` 會回報 canonical 區處於凍結狀態、不會被自動刷新。
  ⚠ **trunk 專案另注意**：舊版把採用者要填的選擇放在 canonical 區內——greenfield 是 `## 3.` 的 merge 策略；brownfield 則是 `## 3.` 的 merge 策略**加上** `## 2.` 的「要不要 Conventional Commits」。新版已把那些**選擇**移到 `## 6.` 底下，取捨說明留在原處。因為 `## 6.` 在區外，`configure-agents` **不會**幫你補上那一小節——升級後請自行在 `## 6.` 記下你的選擇。
- **Dflow 認不出來的 `Git-principles-{policy}.md`**（`## 1. Branch Structure` 與 `## 6. AI Collaboration Rules (Project Policy)` 兩個標題沒有各出現恰好一次）→ 不動並警告，也不提供採納：少了任一個錨，就沒有辦法判斷 canonical 區到哪裡結束、你的內容從哪裡開始。

## 升級後第一步：`dflow doctor`

```bash
dflow doctor
```

doctor 是**唯讀**檢查——只回報、不寫任何檔案。升級相關的檢查包括：

- `_conventions.md` 的對齊版本落後於目前 CLI
- `_conventions.md` 缺少政策段落（`## Git Policy` / `## AI Commit Policy` /
  `## Prose Language`）——會直接點名並告訴你怎麼補
- 政策段落不再是機器可讀格式
- `_conventions.md` **整份缺漏或空白**
- `_conventions.md` 的**內容小節**落後於現行契約——缺少現行規則、或仍留著 P-082
  已退休的敘述（Ceremony Scaling 的 escalate-only 規則、Filling the Templates 的
  no-BR 家族、SPEC-ID Format 的 minimal-host 例外）。逐節點名,並告訴你該補什麼
- guide 凍結（無 marker）、或 bundle 的 `§` 參照指向不存在的段落
- 你所選 Git policy 對應的 `Git-principles-{policy}.md` starter 缺漏，或其 **canonical §§ 1–5** 與本版不同——另外三種狀態分開回報：還沒採納 marker、marker 損壞、以及安裝的套件自己那份 starter 不堪用。只比 §§ 1–5，所以你自己的段落永遠不會被報成 drift
- `features/active/` 內的 feature `_index.md` 還是舊模板形狀（`completed/` 不掃）
- 已指向 canonical 指南、卻未受 Dflow 管理的 agent 檔
- 命令入口**只裝了一部分**——`.claude/commands/dflow/` 或 `.github/prompts/dflow-*.prompt.md` 有幾支但不是 11 支全到，以及留著 `0.5.0` 舊檔名的殘留。⚠ **整組都不存在時不會報**，理由見上面 ownership 表下方那段
- Dflow 產生的 `SKILL.md`（Claude／Codex／Copilot 三份任一）內容落後於目前 CLI——它的 `description` frontmatter 就是工具拿去比對、決定要不要自動接手的那段文字，所以落後的那份等於還用著舊版的觸發邊界。沒有 Dflow marker 的 `SKILL.md` 是你的檔，永遠不報
- `.dflow-bundle-manifest.json` 存在但讀不到或解析不了。從來沒寫過 manifest 是正常狀態、保持沉默；**壞掉**的會報，因為它會連帶靜默關掉 bundle 版本檢查，以及其他檢查向它要的 edition 值

⚠ 上面有幾項檢查以前會在「它要讀的值不存在」時**把自己關掉、而且不吭聲**——缺 `## Git Policy` 段、推不出 edition、讀不到套件內的範本，都屬於這種。現在不會了：值缺席但檢查仍做得下去的，改成把所有候選都比一次；真的做不下去的，doctor 會明說哪些檢查沒有跑。所以處在這幾種狀態的專案升級後，會看到以前沒看過的 finding——**那些狀況本來就一直存在**。

## 徹底驗證（基準做法）

doctor 是第一道；要完整確認升級沒有漏，基準做法是「乾淨對照」：

1. 在別的空目錄跑一個**同 edition、同答案**的全新 `dflow init`（用同一版 CLI）。
2. 拿它與你的專案逐檔 diff。
3. 每個差異都應能歸類為三者之一：「你的 user content」、「已知的 marker 外區域」，或
   **「較新版模板新增、而你的專案成立時還沒有的段落」**。第三類有兩條線索：
   `dflow doctor`（上一節）認得的缺漏段落會直接點名並附補法；doctor 沒點名的，
   看 `CHANGELOG.md` 該版條目——它會說明那是什麼、要不要補，位置有講究時會一併
   寫明（例如 P-083 補回 `_conventions.md` 的 `### SPEC-ID Format` 與
   `### Slug Conventions`，就註明要放在 `## Prose Language` 之前）。這兩節裡，
   `### SPEC-ID Format` 現在 doctor 會直接點名；`### Slug Conventions` 沒有指紋，
   仍屬「只能靠 CHANGELOG」那一類。
   三類都歸不進去的差異才是漏修，逐一處理。

## 含 P-082／P-083 那一版另外要做的事

> ⚠ **本節只適用於含 P-082／P-083 的版本。** 你若裝的是 0.14.0，下面講的 router
> 措辭還不存在，跳過即可（`dflow --version` 可確認）。

那一版把 **決定 Dflow 何時自己出現** 的觸發措辭換掉了。舊的排除句是無限定的——
refactors／renames／chores／formatting／dependency bumps 一律不觸發，root shim 還
額外寫著「你不需要先讀 guide」。但同一版的 cascade 判定 security／CVE 的 dependency
bump、碰 payment 這類操作語意面的 refactor、Domain／schema rename 都**要**進
workflow。留著舊措辭，等於留著一個會安靜否決 security 類工作的觸發器——沒有任何測試
看得見一個「決定不出現」的觸發器，所以它不會自己浮出來。

兩個載體要各自處理：

- **Skill**（`.claude/skills/dflow/`、`.agents/…`、`.github/…`）→ 跑
  `dflow configure-agents --skills`。**flagless 執行不會重生成既有 skill**（見上面
  的 ownership 表），所以這個 flag 是必要的。
- **Root shim**（`CLAUDE.md`／`AGENTS.md`／`.github/copilot-instructions.md`）→ 依
  你有沒有動過它：
  - **沒編輯過的整檔 Dflow shim** → flagless `dflow configure-agents` 就地重生成。
    **v0.1.1 以後 `dflow init` 產出的每一種 shim 內文都在辨識集內**（三種：v0.1.1–
    v0.7.0 的 pre-bundle 形、**0.8.0–v0.9.0** 的 pre-scoping 形、0.10.0–0.14.0 的
    scoped 形），不會被誤判成你的手寫檔。
    **例外是 v0.1.0**：那一版的 `CLAUDE.md` 走的是另一條路徑（由 snippet 模板產生、
    且帶專案專屬代入值），沒有固定內文可比對，所以它會被當成「你自己維護的檔案」——
    `dflow doctor` 會點名，routine 段要手動換。
  - **檔案裡有 `agent-shim` marker** → 只刷新 marker 區內文字，區外不動。
  - **你編輯過、而且沒有 marker** → Dflow 不會動它。`dflow doctor` 會點名這個狀態；
    請手動把 routine 段換成新措辭，或在互動式 `configure-agents` 接受 marker 管理
    區塊之後再重生成。

想確認新舊：新的 routine 段會出現「**Routine is narrower than it sounds**」這句，並
把裁決權指回 guide 的 § Ceremony Scaling；舊的沒有。

## 版本相容注意

- 重投影請用**與你要對齊的同一版 CLI**：先升 CLI、再跑 `dflow configure-agents`。
- 避免用**較舊**的 CLI 對較新的專案 layout 跑 `configure-agents`——舊版可能把舊內容投影回新檔案。
- 產生物（command adapters / skills）的版控建議與 gitignore 片段，見 [README](../README.md) 的「產生物的版控政策」一節與 `docs/` 內各工具指南。
