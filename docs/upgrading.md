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
- `features/active/` 內的 feature `_index.md` 還是舊模板形狀（`completed/` 不掃）——只針對沒有形狀標記的 dashboard；帶著標記的由下一項判讀
- 規格文件的**形狀標記**比現行範本舊、比現行範本新、沒有標記，或看不準（見[形狀標記](#形狀標記)）
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
   ⚠ 有一種差異不屬於這三類，而且**不要**抄過去：全新文件第一行的 `<!-- dflow-shape: ... -->`。它的號碼代表「這份文件跟第幾號範本形狀對照過」，所以既有文件的標記只能照[形狀標記](#形狀標記)那一節的做法補。

## 形狀標記

Dflow 的 flow 用來建立規格文件的每一支範本，都帶著一行標記，文件從範本建立時會一起帶過去：

```markdown
<!-- dflow-shape: greenfield/rules.md 1 — keep this line: dflow doctor reads it -->
```

它記的是**這份文件是照哪一軌的哪一支範本、第幾號形狀寫的**——就像紙本表單角落印的版號。它在文件的第一行；文件有 frontmatter 的話，在 frontmatter 收尾那一行的下一行。畫面上看不到它；請讓它留在原位。doctor 只從這個位置讀它；號碼後面那段說明（`— keep this line: …`）可有可無。文件裡別的地方只要還有一行含 `dflow-shape:`——當例子引用的、被註解掉的舊標記也算——doctor 就不判讀這份文件，而是報看不準：它不去判斷哪一行才是有效的標記。

**哪些文件有。** flow 從 workflow bundle 的範本建立的文件——`glossary.md`、`context-map.md`、各個 context 的 `models.md`、`rules.md`、`behavior.md`、`analysis.md` 與 `context.md`、`tech-debt.md`（greenfield 另有 `events.md`），以及 feature 目錄裡的 `_index.md`、phase spec 與 lightweight spec（greenfield 另有 `aggregate-design.md`）——再加上 `shared/_overview.md`。`_conventions.md`、`Git-principles-*.md`、`AI-AGENT-GUIDE.md`、agent 用的 snippet 與 ADR 資料夾的 README 沒有。

**`dflow doctor` 怎麼用它。** 拿文件上的號碼，跟你裝的這一版 CLI 裡同一支範本的現行號碼比：

| 文件上的標記 | `dflow doctor` |
|---|---|
| 與現行同號 | 不報。文件跟範本不一樣的地方，都是你自己的決定 |
| 比現行舊 | 一條 `info`，列出哪幾份文件、從第幾號到第幾號，以及這兩號之間變了什麼，分三類：<br>**新增**——段、欄或 frontmatter 欄位：可以照補；<br>**改名、拆分、搬移或移除**——只報：由你判斷怎麼改；<br>**說明與順序**——`>` 說明、HTML 註解、段落的先後：不影響結構，由你（和 AI 助手）判斷要不要跟範本同步 |
| 比現行新 | 一條 `warn`：你的 CLI 比文件舊——先升級 CLI |
| 沒有標記 | 一條 `info`，列出哪幾份；這一項檢查**不**判讀它們的形狀（見下一節）。沒有標記的 feature `_index.md` 仍然走上面列的那一項舊範本形狀檢查 |
| 看不準（標記不在它的位置、格式不對，或不只一行含 `dflow-shape:`） | 一條 `uncertain`，`unreadable-shape-marker`（[doctor-uncertainty.md](doctor-uncertainty.md)），列出行號與處理方式 |

doctor 檢查 `dflow/specs/` 底下的文件，但 `shared/` 是 Dflow 自己的檔、只檢查其中的 `shared/_overview.md`；`features/` 底下只看 `active/`，`completed/` 與 `backlog/` 都不檢查。你的專案的 workflow bundle 若來自比你裝的 CLI 還新的 Dflow，doctor 會跳過這項檢查並說明原因：那樣比，等於拿比你專案用的還舊的範本來判讀你的文件。

### 替沒有標記的文件補上標記（一次）

加入形狀標記的那一版之前建立的文件都沒有標記，所以 doctor 會把它們列出來，但不判讀它們的形狀——它不去猜哪些差異是範本造成的、哪些是你造成的。補標記是一次性的工作，最好交給你的 AI 助手一份一份做，**每一個差異都由你判斷**：

1. **拿現行範本來比。** doctor 說你的 workflow bundle 比 CLI 舊的話，先跑 `dflow configure-agents`。`_overview.md` 不在 bundle 裡：用你裝的套件裡的 `templates/<track>/scaffolding/_overview.md`，或在一個暫存目錄跑一次 `dflow init`。
2. **確認軌別**（greenfield 或 brownfield）——標記裡要寫。
3. **拿文件跟範本比**：`##` 與 `###` 標題與它們的先後、每張表的表頭、frontmatter 欄位，以及 `>` 說明與 HTML 註解。略過範例標題與範例列（帶 `{…}` 佔位字的都算）、其他說明文字；lightweight spec 如果是用沒有 BR 的那幾種 family 寫的，`## Root Cause` 與 `## Behavior Delta` 底下那個變更類型小節也略過——family 本來就會替換它們。
4. **逐一判斷每個差異。** 處理範本後來改的地方之前，先看 `dflow doctor` 的形狀 finding 有沒有替那支範本的那一項印出遷移句：有，就照它做，不套那一類的預設做法（見[自帶遷移句的變更](#自帶遷移句的變更)）。文件寫好之後範本才加的 → 補形狀：補那一段；或補那一欄，既有的列填 `{TBD}`，並在表格上方留一條註解寫明這個值是什麼、什麼時候回填、怎麼判定完成；或補那個 frontmatter 欄位。只補形狀，不補內容。文件寫好之後範本改名、拆分、搬移或移除的 → 由你決定這份文件怎麼跟著改：把範本的新寫法搬進來、又留著你原本的，會讓新舊兩段並存。你自己決定的 → 照原樣保留。（一個專案只寫一段 `## Rules`、而範本有三段，這是它的選擇；有了標記，doctor 才不會再把它當成漂移。）`>` 說明、註解與段落順序不影響結構：要不要跟範本同步由你決定，照原樣保留也可以。範本的 `>` 說明或註解已經翻成你的專案語言（`_conventions.md` 的 Prose Language）的，算同一段：保留譯文，不要再補一段英文原文，否則新舊兩段並存。分不出一個差異是範本後來改的、還是你自己的寫法時，看專案自己的 git 歷史：建立這份文件的那一顆 commit（文件改過名的話，要跟著改名往回找：`git log --follow --diff-filter=A -- <文件路徑>`）裡，workflow bundle 的範本（`dflow/specs/shared/dflow-workflows/templates/`）就是它當時照的範本——那一處在當時的範本與現行範本之間沒變，就是你自己的寫法；變了，才是範本後來改的。那一顆 commit 裡沒有這支範本時（專案導入時還沒有 bundle、文件比它的範本早寫好，或文件是不在 bundle 裡的 `shared/_overview.md`），這個比法判不了：把那個差異交給你自己判斷，**不要拿之後的 commit 來比**——之後的範本可能已經改過，範本後來加的會被誤判成你的寫法。同一個差異出現在好幾份文件裡、而且它們建立時照的是同一版範本，可以一次判斷，列出是哪幾份。
5. **加上標記那一行**：從現行範本抄過來，放在文件第一行——有 frontmatter 就放在它後面。

⚠ **號碼是你判斷過的結論，不是可以自動化的步驟。** 一份形狀其實還是舊的文件蓋上現行號碼，doctor 從此對它保持沉默——這是 doctor 唯一偵測不到的錯。
⚠ **還沒關帳的 zero-phase feature 先不要動**——也就是 minimal host：只掛一個小改動、Phase Specs 表是空的、目錄裡也沒有 phase spec 的 feature 目錄。它的關帳恰好兩個 commit，而且只允許一張封閉清單上的變動，現在補標記會讓關帳被擋下。doctor 會把這些文件分開列；關帳後它們搬進 `features/completed/`，就不再被檢查。Phase Specs 表是空的、目錄裡卻有 phase spec 的 feature，doctor 判不出是不是 minimal host，也會分開列：是 minimal host 就先別動，不是就照一般做法補。
⚠ **不要把整段範本檔頭抄進舊文件**——例如只是想補表格排版那條註解時。檔頭裡帶著範本的現行標記。

可以直接交給 AI 助手的提示：

```text
For each doc `dflow doctor` lists as having no shape marker — except the ones it says to leave alone until closeout (for a feature doctor cannot place, ask me first whether it is a minimal host) — compare it with its current template under dflow/specs/shared/dflow-workflows/templates/ (for shared/_overview.md: templates/<track>/scaffolding/_overview.md in the installed dflow package). Compare the ## and ### headings and their order, each table's header row, the frontmatter fields, and the > notes and HTML comments; ignore {…} placeholder headings and rows, other prose, and the sections a lightweight spec's no-BR family replaces. List every difference and ask me, one difference at a time (the same difference in several docs created from the same template version is one question that names the docs), whether the template added it later, the template renamed, split, moved or removed it later, or I chose it; for a note, a comment or the section order, ask me whether to bring the doc in line. To tell a later template change from my choice, compare that spot in the workflow bundle template of the commit that created the doc (following renames: git log --follow --diff-filter=A -- <doc>) with the current template; if that commit has no such template (the project predates the bundle, the doc predates its template, or the doc is shared/_overview.md), say you cannot tell and ask me — never compare against a later commit. A note or comment translated into the project's prose language is the same note as the template's: never add the English original beside it. Before handling a difference the template made later, check whether dflow doctor's shape finding printed a migration for that item of that template; if it did, follow it instead of the default for its kind. For template additions, add the shape only: the section, the column (existing rows get {TBD}, plus a comment above the table saying what the value is, when to backfill it and how to tell it is done) or the frontmatter field. For a rename, split, move or removal, show me the doc's version and the template's and let me decide how to change the doc — never keep both side by side. Keep my choices as they are. Then copy the template's <!-- dflow-shape: ... --> line into the doc, as its first line or right after its frontmatter. Change nothing else.
```

### 範本的號碼往上加的時候

升級之後，doctor 會列出落後的文件與變了什麼。自帶遷移句的變更照它做，不套那一類的預設做法（見下一節）。**新增**的項目，照上面第 4 步補形狀；**改名、拆分、搬移或移除**的項目，由你判斷文件怎麼改——照補會讓新舊兩段並存；**說明與順序**的項目不影響結構，拿現行範本的那一段對照，判斷要不要同步。處理完——補了、同步了，或判定維持原樣——就把它那一行標記的號碼改成現行號；沒改之前，doctor 每次都會再報一次。

### 自帶遷移句的變更

少數幾項變更，照那一類的預設做法處理會把文件改錯。這樣的變更帶著一句遷移句，寫明既有文件要怎麼跟上它。doctor 把它印在那一項變更後面，動作也會說照它做、不套那一類的預設做法。「沒有標記」與「標記看不準」的 finding 也會印同樣的句子，放在它適用的文件後面。doctor 只替認得出範本的文件印：有標記的看標記，沒有標記或標記讀不到的，看文件是不是在 flow 建立它的那個路徑。改過名或搬過位置、又沒有讀得到的標記的文件拿不到遷移句：doctor 認不出它是從哪支範本來的。遷移句只在 doctor 的輸出裡；這一頁不重抄，只說明其中兩句背後的理由。跟其他變更一樣，doctor 不會改你的文件；還沒跟上這項變更的文件蓋上現行號碼，doctor 從此對它保持沉默。

- **`rules.md` 的 `Known deviations` 欄。** 一條規則已經確認、程式還沒照著做、修正延後時，這一格連到記錄這個偏離的那一列技術債。這一欄出現之前就有的列填 `—`：`—` 只表示沒有用這個格式記下偏離，從來不表示有人查過程式。用舊方式記的偏離（例如寫成 edge case）不會出現在這一欄；之後的工作碰到那條規則、你也確認它是延後修的缺陷時，再改成這個記法。
- **`behavior.md` 的 Purpose 說明。** 舊的說明說這份檔記的是系統現在實際怎麼做。這份檔現在並列兩種內容：一條規則的情境寫的是規則，旁邊的偏離紀錄寫的是程式實際怎麼做。保留舊說明，等於留下一句這份檔已經不再成立的話。

這一欄與偏離紀錄平常怎麼記、收尾怎麼收掉，以及改過名或搬過位置的文件拿不到遷移句時由誰承擔，見[確認的規則與程式不一致時](confirmed-rule-vs-code.md)。

### 標記管不到的地方

以下每一項都想過，也刻意不防：要防住，每一次執行（或每一個採用者）要付的代價，比它防的錯還大。這些風險由你承擔；適用的項目會寫明什麼情況下會重新考慮。

- **AI 建文件時沒有帶上標記。** 沒有任何東西保證 AI 照範本建文件時會把那一行抄過去；那一行自己說明了用途，能降低它被弄掉的機會，但不是保證。這樣的文件會退回「沒有標記」——全新專案在建完第一個 feature 之後就可能看到。要百分之百防住，得在每一支會建文件的 flow 裡加一句指示，每次執行都要讀。*會重新考慮的情況*：實際上常常掉。
- **標記後來被刪掉或寫壞**，會退回「沒有標記」或「看不準」。doctor 會照實說，不會把它當成現行形狀。
- **標記被當成例子引用，或舊標記被註解掉**：doctor 不判斷那一行是不是有效的標記，會報看不準——多一條要處理的提示，換來不會把它讀不到的文件報成通過。
- ⚠ **號碼合法但錯誤**——例如把範本檔頭抄到舊文件上——會被當成現行形狀，doctor 保持沉默。這一種偵測不到：文件裡沒有任何東西分得出號碼是對是錯。
- **形狀以外的改動。** 形狀指的是 `##`／`###` 標題與它們的先後、表頭、frontmatter 欄位、`>` 區塊裡的說明（連同其中的表格），以及 HTML 註解——範本寫給 AI 的填寫說明多半在註解裡，lightweight spec 那幾種沒有 BR 的 family 也定義在那裡。固定的標籤文字、詞彙表的列（例如 `rules.md` 的 Status Legend）、`####` 以下、frontmatter 裡的 `#` 註解，以及上面以外的說明文字，改了不會讓範本加號，doctor 也就不會報。*會重新考慮的情況*：這種改動對真實專案造成影響。
- **同號不報——也包括 AI 不小心刪掉的段落**，不只是你刻意拿掉的。這是「同號代表你的決定」的代價。
- **不在 flow 慣用路徑上、又沒有標記的文件**（改過名或搬過位置）不會被列為沒有標記；doctor 對它們什麼都不說。在上面說的檢查範圍內，有標記的文件不論放在哪裡，都照標記判讀。
- **補了形狀卻沒改號**：doctor 下次會再報一次。改好了就改號。
- **在 Dflow 這一側**，已發布的形狀號碼由 Dflow 自己的測試裡的摘要值守住；同時改掉形狀與摘要值的改動，只有 review 看得到。
- **標記只說「跟第幾號範本形狀對照過」，不保證內容正確。**

## `0.15.0` 另外要做的事

> ⚠ **本節只適用於 `0.15.0`（含 P-082／P-083 的那一版）。** 你若裝的是 0.14.0，
> 下面講的 router 措辭還不存在，跳過即可（`dflow --version` 可確認）。

`0.15.0` 把 **決定 Dflow 何時自己出現** 的觸發措辭換掉了。舊的排除句是無限定的——
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
