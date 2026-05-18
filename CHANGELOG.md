# Changelog

本文件記錄 SDD/DDD Skill 的版本變更。早期變更依 Proposal 編號分段；historical proposal records 已移到 `archive/proposals/`，新發布紀錄可直接按 release / closeout milestone 分段。

格式：每個版本標註日期、關聯 Proposal、影響範圍。新版本加在最上方。

---

## 0.3.0 — 2026-05-18 — Workflow flow completion, terminology disambiguation, bilingual public docs

**Proposals**：PROPOSAL-022（CLI install 推薦路徑）、PROPOSAL-023（line-ending normalization）、PROPOSAL-024（README zh-TW + migration reframing）、PROPOSAL-025（Phase 術語拆解：Step Gate / Activity）、PROPOSAL-026（`/dflow:new-phase` 補 implementation / verification）、PROPOSAL-027（handoff lifecycle，dev-only）、PROPOSAL-028（`docs/*.md` 雙語化）、PROPOSAL-029（tutorial 檔名 align）。

**變更**：

- **CLI install 推薦路徑改為 `npm install -g dflow-sdd-ddd` + `dflow init`**（PROPOSAL-022）；`npx dflow-sdd-ddd init` 降為 labeled alternative。README、`docs/*.md`、scaffolding 模板與 bug template 全部對齊。
- **`/dflow:new-phase` 從 5-step planning-only flow 擴為 7-step full phase workflow**（PROPOSAL-026），新增 Step 6 implementation / verification 與 Step 7 phase-level completion；phase-spec frontmatter lifecycle `status: in-progress` → `status: completed`。Greenfield / Brownfield `new-phase-flow.md`、兩份 `SKILL.md`、tutorial walkthrough-03 全部同步。
- **Phase 術語拆解**（PROPOSAL-025）：
  - `phase-spec` / `/dflow:new-phase` 保留（user-facing API）
  - **Phase Gate → Step Gate**（Workflow 內 Step ↔ Step 之間的 checkpoint）
  - **Phase 1-5 → Activity N: Name**（SDD 概念活動：Understanding / Domain Modeling / Spec Writing / Implementation Planning / Testing Strategy）
- **bilingual public docs**（PROPOSAL-024 / 028）：
  - `README.md` 改 zh-TW primary，新增 `README.en.md` 英文 alt，兩份頂部都有 language switcher
  - `docs/` 6 份 user-facing docs（`why-ddd-for-ai`、`evaluating-dflow`、`using-with-{claude-code,codex,gemini-cli,github-copilot}`）全部雙語化：`<file>.md` zh-TW + `<file>.en.md` en，含 language switcher 與 outgoing-ref 分流
- **Tutorial 檔名 align**（PROPOSAL-029）：14 份 `walkthrough-*.zh-TW.md` + 3 份 helper 全部去掉語言後綴，落到 `<file>.md`，與 README / docs pattern 統一
- **line-ending policy**（PROPOSAL-023）：新增 `.gitattributes` 以 `* text=auto eol=lf` + `.bat`/`.cmd` CRLF 例外 + 二進位防護
- **公開 docs 整體 register polish**：README round 2（reframe features around engineer problems + rewrite Documentation Model）、tier 標籤對齊、`using-with-github-copilot.md` register polish

**Breaking / migration notes**：

- **Phase Gate / Phase 1-5 在 AI agent 對話中已淘汰**。已採用 Dflow 的專案會在下次 AI 助理重新讀 skill 時自動換到新術語（skill source 已更新）。若 user 有自製 prompt / shortcut 用到 "Phase Gate" 或 "Phase 1-5"，請改成 "Step Gate" 與 "Activity N: <Name>"。
- **`/dflow:new-phase` 行為擴展**：原本只寫 phase-spec / refresh `_index.md`，現在會走完 implementation / verification / phase-level completion。既有的 phase-spec 不需 retrofit；新跑的 `/dflow:new-phase` 走新流程。
- **Tutorial 檔名變動**：若有外部連結指向 `tutorial/0X-*/walkthrough-NN-*.zh-TW.md`，需改為去掉 `.zh-TW` 後綴的版本。tutorial 是教學素材、無 runtime 影響。
- **CLI install 推薦變更**：舊文件用 `npx dflow-sdd-ddd init` 仍可用，只是 README 與 docs 預設改成全域安裝。

**邊界**：

- 無 runtime API 破壞：`bin/dflow.js`、`lib/init.js`、`test/smoke.mjs`、scaffolding mirrors 行為向後相容
- 無 `package.json#files` 變動（`.en.md` 自然透過既有 include 規則進 tarball）
- PROPOSAL-027（handoff lifecycle）為 dev-only governance，不影響 public 行為
- `docs/migrating-to-dflow-v1.md` 維持英文且未動內容（PROPOSAL-028 明確 defer 至有 real adopter 或需實質改寫時再翻譯）

**驗證**：

- `npm test`
- `npm pack --dry-run`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- `git diff --check`

詳見以下 dated entries（按時間倒序）。

---

## 2026-05-17 ～ 2026-05-18 — `docs/*.md` 雙語化 (PROPOSAL-028)

**變更**：

延續 PROPOSAL-024 的 `<file>.md` (zh-TW primary) + `<file>.en.md` (en alternative) pattern，把 `docs/` 下 6 份 user-facing 文件雙語化。每份 doc 一個 commit、Sonnet worker 草譯、Director review。

| Commit | Doc | en 行 / zh-TW 行 |
|---|---|---|
| `07c1cb9` | `docs/why-ddd-for-ai.md` | 36 / 37 |
| `0a3ddd5` | `docs/evaluating-dflow.md` | 238 / 169 |
| `8264ab4` | `docs/using-with-claude-code.md` | 208 / 199 |
| `4720280` | `docs/using-with-codex.md` | 246 / 226 |
| `3dfa428` | `docs/using-with-gemini-cli.md` | 198 / 184 |
| `d065b3f` | `docs/using-with-github-copilot.md` | 136 / 178 |

每份 doc 都掛 language switcher（在 H1 後第一行），outgoing refs 依規分流：zh-TW doc 連 `.md` + zh-TW anchor、en doc 連 `.en.md` + en anchor。Anchor 對齊例如 `#init-產生的檔案`、`#workflow-模型`、`#30-分鐘評估-playbook`。README.md 與 README.en.md、`docs/evaluating-dflow.md`(zh+en)、`docs/migrating-to-dflow-v1.md`、`docs/using-with-*.md` 互引、`planning/public-onboarding-tasklist.md` 的 incoming refs 全 sweep 並依語言分流。

**Side findings & pre-translation sweeps**（cross-model review 階段 + 翻譯過程中發現並一併處理）：

- `4023a99`：修 `docs/evaluating-dflow.md:178` tier 標籤倒置（T1 Lightweight / T2 Standard / T3 Full → T1 Heavy / T2 Light / T3 Trivial），對齊 README canonical 排序
- `3dfa428` 順手：移除 `using-with-gemini-cli.en.md` 殘留章節編號（`## 1. / ## 2. / ...`），對齊其他 3 份 per-tool en docs
- `82b3da4`：bilingualize 前先 polish `using-with-github-copilot.md` register（headings → Title Case、backtick path mentions → markdown links、合併「(verify with maintainer)」hedges 為單一 footer note）
- `d065b3f` 順手：補上 `using-with-github-copilot.en.md` 缺的「Tool / Generated shim / Loads canonical guide via」對照表，4 份 per-tool docs 兩語版本完全對稱

**Cross-model review**：

PROPOSAL-028 起草後（`9da50f6`）走 cross-model review（reviewer 另一個 session）回 `approve with modifications`。所有 modifications 整合進 Proposal 內文（`fffabcb`）：scope 收斂為 Option B 分批 commit + Worker 草譯 + Director review、新增 Acceptance criteria 段（強制 pre-translation stale sweep）、新增 Validation 段（dev commit vs dist projection 兩級）、補 outgoing refs 分流規則、補 npm tarball 驗證。

**Scope 不含**：

- `docs/migrating-to-dflow-v1.md`：deferred（runtime contingency endpoint、Dflow 目前無 user 也無非 OBTS adopter；等真有 adopter 或該檔需實質改寫時再翻譯）。本次只更新它對其他 6 份新雙語 docs 的 outgoing refs 指向 `.en.md` 版本。
- `docs/npm-publish-checklist.md`、`docs/release-versioning-policy.md`：maintainer-facing、user 是唯一 maintainer，英文 ops 文件對外更直覺，明確不譯。

**邊界**：

- dev-only；dist projection 留待 user-approved checkpoint
- 純 public-facing docs；無 lib/、bin/、test/、scaffolding 變動。`package.json` `files`、`scripts/export-dist.sh` `include_paths`、`test/smoke.mjs`、`bin/dflow.js`、`lib/init.js`、scaffolding mirrors **全部未動**（runtime 零衝擊）
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release

**驗證**：

- 每份 commit 都驗證 `git diff --check` clean、incoming refs sweep 完整、stale anchor grep 通過
- npm pack --dry-run（cross-model review 階段）：tarball 自然帶入 `.en.md`，`package.json` `files` 不需動

---

## 2026-05-17 — Tutorial 檔名與 README/docs 雙語規約對齊 (PROPOSAL-029)

**變更**：

純機械 cleanup：把 tutorial/ 內三種不一致後綴（`.zh-TW.md`、`_tw.md`、`.md`）統一到 PROPOSAL-024 規約（zh-TW primary 落在 `.md`，`.en.md` 保留給未來英文版）。

17 個 `git mv` 去掉語言後綴（commit `edd97fa`）：

- 14 個 walkthrough：`tutorial/0{1,2}-{greenfield,brownfield}/walkthrough-{00..06}-*.zh-TW.md` → `walkthrough-{00..06}-*.md`
- 2 個 tutorial-level helpers：`tutorial/dflow-command-surface.zh-TW.md` 與 `tutorial/how-to-read-dflow-specs.zh-TW.md` → 同名 `.md`
- 1 個離群檔案：`tutorial/DDD_MINDSET_SHIFT_tw.md` → `tutorial/DDD_MINDSET_SHIFT.md`

Incoming refs sweep 同 commit：`tutorial/README.md`、所有 rename 後 walkthrough 互連、`docs/evaluating-dflow.md`、`docs/using-with-{claude-code,codex,gemini-cli}.md`、`MAINTAINERS.md`、6 份 `planning/*.md`。

**保留不動**：

- `tutorial/0X-*/outputs/` 內所有 demo 專案輸出（非雙語化目標）
- `CHANGELOG.md` 歷史條目（凍結）
- `archive/**`（archived 內容凍結）

**邊界**：

- 零 runtime 影響：scaffolding mirrors、`bin/`、`lib/`、`test/`、`scripts/export-dist.sh` 完全不引用 walkthrough 檔名
- 無翻譯工作（內容語言不變）
- dev-only；dist projection 留待 user-approved checkpoint
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release

**驗證**：

- `git diff --check` clean
- 殘留 grep（`\.zh-TW\.md\|_tw\.md` 在 `tutorial`、`docs`、`MAINTAINERS.md`）：0 命中
- Git rename detection: 90–100% similarity，17 個全部偵測為 rename
- 不需 `npm test`（純檔名 cleanup、無 runtime 變動）

---

## 2026-05-17 — `/dflow:new-phase` implementation / verification flow (PROPOSAL-026)

**變更**：

- Greenfield / Brownfield `new-phase-flow.md` 從 5-step planning-only flow 改為 7-step full phase workflow：新增 Step 6 implementation / verification 與 Step 7 phase-level completion。
- `/dflow:new-phase` 現在明確處理 phase-spec frontmatter lifecycle：Step 4 建檔時 `status: in-progress`，Step 7 完成時 `status: completed`。
- 兩份 `SKILL.md` 的 command summary、Step Gate positions、Reference Files 與 `Completion Checklist Execution` 已同步，並明確區分 new-phase Step 6 -> 7 是 phase-level completion，不做 BC-level docs sync、不 archive feature directory。
- README zh-TW / English、round-2 planning note、tutorial command surface 與 walkthrough-03 已同步 7-step 語意；`/dflow:new-phase` 不再被描述成只寫文件。
- Tutorial supervisor-approval fixture 更新為 completed phase state，phase-spec status 與 tests / Implementation Tasks checkbox 對齊 completed `_index.md`。

**邊界**：

- Slash command 名稱、`phase-spec-{date}-{slug}.md` 命名、CLI runtime 不變。
- `/dflow:finish-feature` 仍負責 BC-level `rules.md` / `behavior.md` / `events.md` sync、feature directory archival 與 Integration Summary。
- Dev-only；dist projection 留待 user-approved checkpoint。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- `scripts/check-repo-consistency.sh`
- Targeted stale-grep for `new-phase` 5-step wording and missing `## Step 7`

---

## 2026-05-15 — Phase terminology disambiguation (PROPOSAL-025)

**變更**：

Dflow 內部「Phase」一詞之前同時用於三個互不相關的概念，造成 SKILL.md / templates / tutorial 內歧義。本次重命名清理：

- **(A) `phase-spec` / `/dflow:new-phase`**（feature 內一次「提案 → 實作 → 歸檔」循環）— **保留**。這是已發佈 v0.2.0 的 user-facing API
- **(B) Phase Gate → Step Gate**（Workflow 內 Step 與 Step 之間需停下等確認的 checkpoint）— 改名。標準書寫格式：`Step Gate: Step X → Step Y`。與既有 `Step-internal transition` 形成詞根對偶
- **(C) Phase 1-5 → Activity 1-5**（SDD 概念活動：Understanding / Domain Modeling / Spec Writing / Implementation Planning / Testing Strategy）— 改名。HTML comment 標準格式 `<!-- Fill timing: Activity N: Name -->`（編號 + 名稱，提升 AI 排序與人類可讀性）

**檔案範圍**：~30 個檔案、3 個 commit（atomic terminology rename）：

- `c12f909` Add PROPOSAL-025 proposal (approved, cross-model reviewed by Codex)
- `f091ffb` (B) Phase Gate → Step Gate in 12 skill source files；連帶 `/dflow:next` 與 Confirmation Signals 的 "next phase" / "next-phase" idiom 改成 "next step" 避免與 (A) 撞詞
- `f0e7bcf` (C) Phase 1-5 → Activity N: Name in 13 source + packaged mirror files；含 SKILL.md `Guiding Questions by Phase` 段、phase-spec template HTML comments、scaffolding `_conventions.md` 的 CQRS-split convention、references flow 的 `Phase 3 draft sections` checklist item
- `e287791` Tutorial walkthrough + outputs sync（9 檔）— 逐句判斷 (A)/(B)/(C) 後分別處理。Tutorial outputs 視為 live teaching artifacts（per user 決策 Q1 = A）

**保留不動的部分**：

- `/dflow:new-phase` 指令名稱、`phase-spec-{date}-{slug}.md` 檔名模式、`templates/phase-spec.md` template 檔名 — 都是 user-facing API
- `_index.md` 內 `Phase Specs` table 標題、所有 `Phase 1 phase-spec` / `Phase 2+ specs` 衍生用法 — 都屬 (A)
- `CHANGELOG.md` 內既有條目、`archive/proposals/` — 凍結歷史紀錄
- `superseded-drafts/` 內檔案 — 已標 superseded，不維護
- `PRACTICE_PLAN_tw.md` 內 `Phase 1-7`（tutorial 練習章節，第 4 種 Phase 用法）— 加入 disambiguation note；完整重命名（候選名 Module / Practice Session）留作 follow-up

**Codex cross-model review**：

提案經 Codex 獨立評審，accept with revisions。5 處具體修正全部納入（衍生用法澄清、標準書寫格式、HTML comment 格式、影響範圍補列 9 檔、atomic commit / release notes / 外部相容性配套）。User 拍板 2 個 Open Questions：tutorial outputs 視為 live artifact（Q1=A）、(B) 採 Step Gate（Q2=A）。

**邊界**：

- 無 CLI / 檔名 / 對外 API 表面變更 — 純文件術語清理
- dev-only；dist projection 留待下次 user-approved checkpoint
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release
- 解鎖 PROPOSAL-024 後續 README polish 第二輪（README workflow 模型段落可用新詞彙改寫）

**驗證**：

- `scripts/check-repo-consistency.sh` pass（source ↔ packaged mirror diff clean）
- 全 repo grep 無 `Phase Gate` / `phase gate` 殘留（CHANGELOG 與 PROPOSAL-025 文檔內提及為刻意）

---

## 2026-05-15 — Public README zh-TW strategy + migrating-to-v1 reframing (PROPOSAL-024)

**變更**：

- `README.md` 改為**繁體中文版**（GitHub / npm 預設顯示），新增 `README.en.md` 作為英文版備案
- 兩份 README 頂部都有 language switcher（粗體 = 當前語言、連結 = 另一語言）
- 兩份 README 都**移除**舊有的 migration-guide 廣告段（原 `README.md:254-256` 那段「If you maintain a project that adopted an early Dflow form...」）。Dflow 經驗上只有 OBTS 這個唯一 pre-V1 adopter 且已完成遷移；首頁廣告 migration guide 對新 evaluator 是干擾文字
- `scripts/export-dist.sh` `include_paths` 加 `README.en.md`，確保未來 dist projection 把雙語版都帶過去
- `docs/migrating-to-dflow-v1.md` 頂部加「Audience reality (2026-05-15)」blockquote，校正讀者期待 — 這篇 doc 仍存在是因為 `dflow doctor` / `dflow init` warning 接過來時需要它，**不是**廣告型 evangelism 文件
- `MAINTAINERS.md` 新增「README Language Strategy」段，記錄雙語政策

**邊界**：

- dev-only；dist projection 留待 user-approved checkpoint，與 PROPOSAL-022 / 023 一起 bundle
- 純 public-facing docs；無 lib/、bin/、test/、scaffolding 變動。`docs/migrating-to-dflow-v1.md` 的 runtime references（doctor、init.js warning、smoke test、scaffolding mirrors）全部保留
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release

**驗證**：

- `git diff --check` clean
- `scripts/check-repo-consistency.sh` pass
- `npm pack --dry-run`：file list 含 `README.en.md`
- `test/smoke.mjs` 不受影響（migrating-to-v1 path reference 未動）

---

## 2026-05-15 — Line-ending policy, dev-side (PROPOSAL-023)

**變更**：

- 新增 `.gitattributes` line-ending 政策（commit `f7b3cbe`）：
  - `* text=auto eol=lf` 規定全 repo 文字檔 LF（含 repo storage 與所有 OS 的 working tree）
  - `*.bat` / `*.cmd` 例外 CRLF（Windows `cmd.exe` 必需）
  - `*.png` / `*.jpg` / `*.pdf` 標記 binary（defensive future-proofing；repo 內目前無此類檔案）
- `scripts/export-dist.sh` `include_paths` 加 `.gitattributes`（commit `c887b05`，Phase 1.5；resolves Director cross-check Finding 12），確保未來 dist projection 把政策帶過去
- 一次性 brute-force WT refresh（`git ls-files -z | xargs -0 rm -f && git checkout -- .`）讓 dev 內 336 個 CRLF working-tree 檔對齊 LF。**無 commit 產生** — repo storage 早已是 LF（`autocrlf=true` 歷史），`git add --renormalize .` 是 no-op；只有 WT 不一致
- `MAINTAINERS.md` 加「Line Endings」段，說明政策、`.bat`/`.cmd` 例外、Windows 個人 `core.autocrlf=input` 建議、`.git-blame-ignore-revs` 未使用的理由與未來啟用步驟
- `planning/line-ending-finding.md` 加 closeout 註

**邊界**：

- dev-only；Phase 2（dist projection）留待 user-approved checkpoint，與 PROPOSAL-022 implementation + bug template 等 pending 變更一起 bundle
- 純 line-ending policy + WT refresh；無 semantic / API / runtime 變化
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release

**驗證**：

- `git ls-files --eol | awk '{print $1, $2}' | sort | uniq -c` → 347 `i/lf w/lf` + 3 `i/none w/none`（無 `i/lf w/crlf` 殘留）
- `scripts/check-repo-consistency.sh` pass
- `git diff --check` clean
- `git status` clean after WT refresh

---

## 2026-05-15 — Archive legacy tutorial drafts

**變更**：

- 將 14 個 legacy 非 zh-TW tutorial 草稿從 `tutorial/0X-{greenfield,brownfield}/`
  搬到 `archive/tutorial-drafts/0X-{greenfield,brownfield}/`，使用 `git mv` 保留
  rename history（檔案內容不變）：
  - greenfield 7 檔（00-setup、01-init-project、02-new-feature、03-new-phase、
    04-modify-existing、05-bug-fix、06-finish-feature）
  - brownfield 7 檔（00-setup、01-init-project、02-modify-existing、
    03-baseline-capture、04-new-feature、05-bug-fix、06-finish-feature）
- 更新 `archive/README.md`，加入 `archive/tutorial-drafts/` 子目錄說明。

**動機**：

- zh-TW canonical walkthrough（`tutorial/0X-*/walkthrough-*.zh-TW.md`）已是
  reader-facing 入口；legacy 草稿在公開閱讀流程中已無入口（PROPOSAL-022 Phase 2
  已將 `docs/*.md` 連結重新指向 zh-TW canonical）。
- `scripts/export-dist.sh` 將 `tutorial/` 整個投影到 dist；legacy 檔留在
  `tutorial/` 內會在 dist projection 時被帶上 dist。搬到已被排除的 `archive/`
  目錄即可保留 dev 歷史、不污染 dist。

**邊界**：

- 純檔案搬移；無內容變更。
- `archive/` 已在 `scripts/export-dist.sh` `excluded_stale_paths` 內。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- `scripts/check-repo-consistency.sh`
- `ls tutorial/` 與 `ls archive/tutorial-drafts/` 確認 14 檔搬移完整。

---

## 2026-05-14 — CLI install recommendation docs update (PROPOSAL-022)

**變更**：

- 更新 `README.md`：將 `npm install -g dflow-sdd-ddd` + `dflow init` 提升為
  主要安裝路徑；`npx dflow-sdd-ddd` 改為明確標示的「Alternative: try without
  installing」替代路徑，並列出 init / doctor / configure-agents 的 npx 形式。
- 更新 `tutorial/README.md`、`tutorial/dflow-command-surface.zh-TW.md`、
  `tutorial/01-greenfield/walkthrough-0{0,1,2}-*.zh-TW.md`、
  `tutorial/02-brownfield/walkthrough-0{0,1,6}-*.zh-TW.md`：
  CLI 命令參照從 `npx dflow-sdd-ddd init` 更新為 `dflow init`；
  walkthrough-01 保留一段 npx 替代路徑說明。
- 更新 `templates/` 與 `sdd-ddd-*-skill/scaffolding/` 四個 mirror pair
  (AI-AGENT-GUIDE.md、CLAUDE-md-snippet.md)：install 參照改為 neutral 措辭
  (`dflow init`, or `npx dflow-sdd-ddd init` when using the no-install path)。
- 更新 `templates/{greenfield,brownfield}/templates/CLAUDE.md` 與
  `sdd-ddd-{green,brown}field-skill/templates/CLAUDE.md` 兩對 mirror pair：
  目錄樹 comment 從「由 npx dflow-sdd-ddd init 寫入」改為「由 dflow init 寫入」。
- 更新 `docs/evaluating-dflow.md`、`docs/using-with-claude-code.md`、
  `docs/using-with-codex.md`、`docs/using-with-gemini-cli.md`、
  `docs/using-with-github-copilot.md`、`docs/migrating-to-dflow-v1.md`：
  install ordering 對齊新主路徑；重新連結四個 docs 的舊 tutorial 連結至
  zh-TW canonical walkthrough 檔案。
- 更新 `MAINTAINERS.md`：新增 contributor CLI 使用 `npm link` 的一行說明。
- `docs/npm-publish-checklist.md`：確認未動，versioned smoke checks 保持不變。
- `npx dflow-sdd-ddd` 形式繼續有效；本次只是不再作為主要文件路徑推薦。

**邊界**：

- doc-only；無 `lib/` / `bin/` / `package.json` / skill source 行為變更。
- dev-only checkpoint；dist projection 待後續 user-approved checkpoint。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- `scripts/check-repo-consistency.sh`
- 手動 grep 分類：`rg -n "npx dflow-sdd-ddd|dflow doctor|dflow configure-agents"`

---

## 2026-05-14 — Maintainer operational guardrails

**變更**：

- 更新 `MAINTAINERS.md`，將近期 handoff 中反覆出現的跨任務運作規則制度化：
  commit / push 判斷、依 changed surface 選擇驗證、dist projection cadence、
  tutorial fixture 邊界與 release boundary。
- 明確規定 docs / tutorial / planning-only 變更不需跑 `npm test`；
  `npm test` 保留給 runtime、CLI、templates、tests、package metadata 或
  release automation 等會影響 package behavior 的變更。
- 明確規定 tutorial draft 不逐次投影 dist；dist projection 需在
  user-approved checkpoint 或 full tutorial rewrite ready 時進行。
- 明確規定 `tutorial/**/outputs/` fixture 不因 wording cleanup 或翻譯工作修改；
  若要 rename，必須作為獨立 path-migration checkpoint 處理。

**邊界**：

- dev-only maintainer guidance；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`

---

## 2026-05-14 — Tutorial wording and link-label cleanup

**變更**：

- 更新 `tutorial/README.md` 開頭說明，移除「API reference」這類不直覺的對比，
  改成直接說明 tutorial 讓讀者透過 Greenfield / Brownfield 劇情理解 Dflow。
- 將 tutorial walkthrough 內指向其他教學篇章與導讀頁的連結文字，從檔名改為
  reader-facing 篇名，並在段落連結中使用 `〈...〉` 呈現篇名。
- 將 `how-to-read-dflow-specs.zh-TW.md` 的標題與說明從 `outputs snapshots`
  收斂為「Dflow 規格與完整文件範例」，降低讀者必須理解 repo 內
  `outputs/` 目錄命名的負擔。
- 更新 walkthrough 開頭的閱讀提示，將 `outputs/` 描述為完整文件範例目前的存放位置。
- 更新主 `README.md` 的 `Files Created by Init` 目錄樹，加入 tree connector 符號。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- 本次不 rename `tutorial/**/outputs/`；該目錄命名需要另行決策。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 grep tutorial walkthrough 中舊式 walkthrough filename labels

---

## 2026-05-13 — Tutorial README reader-facing labels

**變更**：

- 更新 `tutorial/README.md`，將「先讀」與 walkthrough 入口的連結文字
  從檔名改成 reader-facing 文件題名。
- 保留 Greenfield / Brownfield walkthrough 表格形式，並補上「建議順讀、
  但每篇可單篇閱讀」的導覽說明。
- 將 README 中「正在改寫中的 immersive walkthrough 系列」改為
  `zh-TW immersive walkthrough 系列`，避免過期語氣。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 grep `tutorial/README.md` 中舊式 walkthrough filename labels

---

## 2026-05-13 — Walkthrough reading-flow cleanup

**變更**：

- 清理 Greenfield / Brownfield 02-06 user / evaluator-facing walkthrough 的
  reading flow wording，範圍包含：
  `tutorial/01-greenfield/walkthrough-02-new-feature.zh-TW.md` through
  `tutorial/01-greenfield/walkthrough-06-finish-feature.zh-TW.md`，
  以及 `tutorial/02-brownfield/walkthrough-02-modify-existing.zh-TW.md`
  through `tutorial/02-brownfield/walkthrough-06-finish-feature.zh-TW.md`。
- 將重複的 `final snapshot` 說明收斂成「完整文件範例」與少量情境補充，
  避免每個文件片段都重複解釋 snapshot / excerpt 分工。
- 將「README feature claims」區塊改成 reader-facing「本篇展示的 Dflow 能力」，
  並把 `Three-layer documentation model` 改成較自然的「三層文件分工」。
- 保留每篇開頭的自足閱讀提示，讓讀者不必先跳到
  `how-to-read-dflow-specs.zh-TW.md` 才能讀懂單篇 walkthrough。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 grep 02-06 walkthroughs 中的舊式 `final snapshot` /
  `README feature claims` / `Three-layer` wording

---

## 2026-05-13 — Reader-facing walkthrough wording cleanup

**變更**：

- 清理 Greenfield / Brownfield `walkthrough-*.zh-TW.md` 的開頭與閱讀提示，
  移除 `00-setup.md`、`02-new-feature.md` 等素材檔引用，避免 user /
  evaluator-facing 文件暴露 maintainer source-material 語境。
- 將 walkthrough 的 bracketed notes 改為 reader-facing「閱讀提示」，說明
  `outputs/` 連結代表完整 snapshot、正文 excerpt 代表當下重點，並連到
  `how-to-read-dflow-specs.zh-TW.md`。
- 更新 `tutorial/dflow-command-surface.zh-TW.md`，把舊 step trace links
  改指向公開 walkthrough 入口。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check walkthrough source-material references

---

## 2026-05-13 — Dflow specs reading guide

**變更**：

- 新增 `tutorial/how-to-read-dflow-specs.zh-TW.md`，作為 cross-cutting
  reading guide，說明 walkthrough excerpt 與 `outputs/` final snapshot
  的差別、phase / lightweight / BUG specs、feature `_index.md`、BC layer
  cumulative docs、Brownfield baseline capture 與 `migration/tech-debt.md`
  的讀法。
- 更新 `tutorial/README.md` 的「先讀」入口，加入 spec / snapshot 讀法導覽。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把
  `how-to-read-dflow-specs.zh-TW.md` 從候選轉為 accepted cross-cutting
  tutorial。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；本篇只說明如何閱讀 snapshots。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-13 — Setup and init immersive walkthroughs

**變更**：

- 新增 Greenfield walkthrough 00 / 01：
  `tutorial/01-greenfield/walkthrough-00-setup.zh-TW.md` 與
  `tutorial/01-greenfield/walkthrough-01-init-project.zh-TW.md`，補齊
  Alice / ExpenseTracker 的專案起點、Clean Architecture repo state、
  `npx dflow-sdd-ddd init`、file-list preview、Greenfield baseline
  outputs、AI tool shims，以及 Day-0 不預建 `behavior.md` / ADR 的理由。
- 新增 Brownfield walkthrough 00 / 01：
  `tutorial/02-brownfield/walkthrough-00-setup.zh-TW.md` 與
  `tutorial/02-brownfield/walkthrough-01-init-project.zh-TW.md`，補齊
  Bob / OrderManager 的 legacy context、WebForms / EF 6 / Stored Procedure
  風險、Brownfield init baseline、`migration/tech-debt.md`、Git Flow 選擇，
  以及 init 不建立 `src/Domain/` 或預設 Order BC 的邊界。
- 更新 `tutorial/README.md`，讓 Greenfield 與 Brownfield walkthrough path
  都從 00-06 完整列出。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 00 / 01 四篇 zh-TW
  walkthrough 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-12 — Greenfield finish-feature immersive walkthrough

**變更**：

- 新增 `tutorial/01-greenfield/walkthrough-06-finish-feature.zh-TW.md`，
  以中文 canonical walkthrough 展示 Greenfield `/dflow:finish-feature`
  如何收尾 `SPEC-20260428-001-employee-submit-expense`：closeout
  validation、deferred item disposition、status flip、BR-001~007 sync
  到 Expense BC `rules.md`、completed archive、Integration Summary、
  tech-debt preserve，以及 completed feature frozen history 邊界。
- 更新 `tutorial/README.md` 的 Greenfield walkthrough 表格，連到新的
  finish-feature walkthrough，並將目前狀態更新為 Greenfield 02-06
  與 Brownfield 02-06 zh-TW immersive walkthroughs 已列入索引。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Greenfield
  `walkthrough-06-finish-feature.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-12 — Greenfield bug-fix immersive walkthrough

**變更**：

- 新增 `tutorial/01-greenfield/walkthrough-05-bug-fix.zh-TW.md`，
  以中文 canonical walkthrough 展示 Greenfield `/dflow:bug-fix`
  如何處理 reject reason emoji surrogate truncation：T2 Light 判定、
  BUG-001 命名、active host feature linkage、Presentation primary /
  Domain secondary layer split、BR-007 wording unchanged、Current BR
  Snapshot intentionally unchanged note，以及 Unicode character counting
  tech debt 分流。
- 更新 `tutorial/README.md` 的 Greenfield walkthrough 表格，連到新的
  bug-fix walkthrough，並將目前狀態更新為只剩 Greenfield 06 尚未
  改寫。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Greenfield
  `walkthrough-05-bug-fix.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-12 — Greenfield modify-existing immersive walkthrough

**變更**：

- 新增 `tutorial/01-greenfield/walkthrough-04-modify-existing.zh-TW.md`，
  以中文 canonical walkthrough 展示 Greenfield `/dflow:modify-existing`
  如何把 BR-007 reject reason 從單一 10 字元調整為 bilingual length
  rule：T2 Light 判定、active host feature linkage、completed-feature
  reopen skip、lightweight spec Delta、Current BR Snapshot regenerate、
  `ApprovalReason` Value Object impact，以及 `models.md` / `context.md`
  故意不擴張同步的邊界。
- 更新 `tutorial/README.md` 的 Greenfield reading path 與 immersive
  walkthrough 區塊，連到新的 modify-existing walkthrough。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Greenfield
  `walkthrough-04-modify-existing.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-11 — Greenfield new-phase immersive walkthrough

**變更**：

- 新增 `tutorial/01-greenfield/walkthrough-03-new-phase.zh-TW.md`，
  以中文 canonical walkthrough 展示 Greenfield `/dflow:new-phase`
  如何在既有 `SPEC-20260428-001-employee-submit-expense` 內新增
  supervisor approval phase：active feature context loading、phase scope
  confirmation、ApprovalDecision Aggregate 邊界、ADDED / MODIFIED Delta、
  Current BR Snapshot regenerate，以及 living domain docs sync。
- 更新 `tutorial/README.md` 的 Greenfield reading path 與 immersive
  walkthrough 區塊，連到新的 new-phase walkthrough。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Greenfield
  `walkthrough-03-new-phase.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-11 — Brownfield finish-feature immersive walkthrough

**變更**：

- 新增 `tutorial/02-brownfield/walkthrough-06-finish-feature.zh-TW.md`，
  以中文 canonical walkthrough 展示 Brownfield `/dflow:finish-feature`
  如何收尾 `SPEC-20260430-001-order-discount-calculation`：closeout
  validation、BR-001~004 sync、BR-005~008 preserve、completed archive、
  Integration Summary、tech-debt sweep，以及 completed feature frozen
  history 邊界。
- 更新 `tutorial/README.md` 的 Brownfield reading path 與 immersive
  walkthrough 區塊，連到新的 finish-feature walkthrough。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Brownfield
  `walkthrough-06-finish-feature.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-11 — Brownfield bug-fix immersive walkthrough

**變更**：

- 新增 `tutorial/02-brownfield/walkthrough-05-bug-fix.zh-TW.md`，
  以中文 canonical walkthrough 展示 Brownfield `/dflow:bug-fix`
  如何處理跨頁 rounding inconsistency：T2 Light 判定、BUG-001 命名、
  host feature 歸屬 SPEC-001、`Money.ToDisplay()` implementation contract
  收斂、BR Snapshot intentionally unchanged note，以及 `tech-debt.md`
  resolved disposition。
- 更新 `tutorial/README.md` 的 Brownfield reading path 與 immersive
  walkthrough 區塊，連到新的 bug-fix walkthrough。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Brownfield
  `walkthrough-05-bug-fix.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-11 — Brownfield new-feature immersive walkthrough

**變更**：

- 新增 `tutorial/02-brownfield/walkthrough-04-new-feature.zh-TW.md`，
  以中文 canonical walkthrough 展示 Brownfield 已有 Order BC 後如何用
  `/dflow:new-feature` 新增 VIP discount policy，並說明 `isVip * 0.93`
  dead code disposition、Customer reference data 邊界、BR-005~008 與
  既有 BR-001~004 的互動。
- 更新 `tutorial/README.md` 的 Brownfield reading path 與 immersive
  walkthrough 區塊，連到新的 new-feature walkthrough。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Brownfield
  `walkthrough-04-new-feature.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-10 — Brownfield baseline-capture immersive walkthrough

**變更**：

- 新增 `tutorial/02-brownfield/walkthrough-03-baseline-capture.zh-TW.md`，
  以中文 canonical walkthrough 展示 baseline-only path：不硬塞 T1 / T2 /
  T3、不改 code、不建 spec、不改 rules，而是把跨頁面 `OrderList` /
  `OrderDetail` 現況分成 confirmed / buggy / unknown 並分流到
  `behavior.md` 與 `tech-debt.md`。
- 更新 `tutorial/README.md` 的 Brownfield reading path，連到新的
  baseline-capture walkthrough。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Brownfield
  `walkthrough-03-baseline-capture.zh-TW.md` 加入 accepted pattern。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-10 — Brownfield modify-existing immersive walkthrough

**變更**：

- 新增 `tutorial/02-brownfield/walkthrough-02-modify-existing.zh-TW.md`，
  以中文 canonical walkthrough 展示 Brownfield `/dflow:modify-existing`
  如何從 WebForms 客訴進入 T1 判定、無 host feature 時升級為
  `/dflow:new-feature`、捕捉 baseline contrast、建立第一個 Order BC，
  並把折扣計算抽成可測試 Domain logic。
- 更新 `tutorial/README.md` 的 Brownfield reading path 與 immersive
  walkthrough 區塊，連到新 walkthrough。
- 更新 `planning/immersive-tutorial-suite-plan.md`，把 Brownfield
  `walkthrough-02-modify-existing.zh-TW.md` 加入 accepted pattern。
- 更新 `MAINTAINERS.md` 與 active tutorial plan，記錄 tutorial-only
  變更不需要 `npm test`，且 active tutorial rewrite 期間 dev commits
  不必每次投影 dist；等 user-approved tutorial checkpoint 或 full rewrite
  ready 時再 export。

**邊界**：

- dev-only checkpoint；本次不投影 dist。
- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- 手動 spot-check 新增 tutorial link targets

---

## 2026-05-10 — Bilingual immersive tutorial suite

**變更**：

- 新增 `tutorial/dflow-command-surface.zh-TW.md`，整理現行 Dflow 命令表面：
  `npx dflow-sdd-ddd init` / `dflow doctor` / `dflow configure-agents`
  與 `/dflow:*` AI workflow commands 的分工，並明確列出 workflow /
  phase / closeout / control / verify / review / feedback commands。
- 新增 `tutorial/01-greenfield/walkthrough-02-new-feature.zh-TW.md`，
  作為第一份中文 canonical immersive walkthrough，展示
  `/dflow:new-feature` 如何從 AI 對話、DDD discovery、phase gate、
  generated document excerpts 走到 implementation task list。
- 更新 `tutorial/README.md`，移除不存在的 `outputs-tour.md` forward-links，
  改連到已存在的中文 command surface 與 Greenfield walkthrough；Brownfield
  walkthrough 標為後續 incremental work。
- 新增 `planning/immersive-tutorial-suite-plan.md` 作為目前 tutorial rewrite
  的 active source of truth，記錄 zh-TW first、English adaptation later、
  「讀者」用詞、cross-cutting tutorials、Worker 分工策略。
- 將 `planning/full-tutorial-rewrite-plan.md` 收斂為 superseded stub，避免
  舊 English-first / `outputs-tour.md` 設計干擾後續 session；歷史細節由 git
  history 保留。
- 更新 `planning/public-onboarding-tasklist.md` 的 tutorial rewrite 狀態，
  指向新的 immersive tutorial suite plan。

**邊界**：

- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更。
- `outputs/` tree 完全未動；walkthrough 只以連結與內嵌 excerpt 引用。
- 不 bump `package.json`、不 `npm publish`、不 `git tag`、不建 GitHub Release。

**驗證**：

- `git diff --check`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --dry-run`
- dist `npm test`
- dist `npm pack --dry-run`
- dist `git diff --check`

---

## 2026-05-09 — Tutorial English-first promotion (full tutorial rewrite Batch 1)

**變更**：

- `tutorial/README.md` 推升為 English-first canonical entry：
  - 開頭兩段英文 orientation；既有 zh-TW 表格與 `使用方式` 段落移至
    `## 中文導讀` companion section，保留現有內容
  - 新增 `## Two Scenarios` 概述 Greenfield (Alice / ExpenseTracker)
    與 Brownfield (Bob / OrderManager) 適配對象
  - 每條 scenario 新增 `### Reading Order` 段落，每個 step file 一段
    1-2 句英文 plot summary
  - 新增 `### Curated Outputs Tour` 區塊，前向連到尚未存在的
    `01-greenfield/outputs-tour.md` 與 `02-brownfield/outputs-tour.md`
    （由本 rewrite 計畫的 Batch 2 / Batch 3 建立）
  - mermaid workflow chart 保留為 language-neutral，置於英文段內
- 對 `docs/evaluating-dflow.md`、`docs/using-with-{claude-code,codex}.md`
  與 root `README.md` 採 cross-link，不重述 evaluator playbook /
  per-tool surface / Get Started 內容（per
  `planning/full-tutorial-rewrite-plan.md` Non-duplication guardrails）
- 14 個 step file 內容未動（English summary header 屬本 rewrite 計畫
  的 Batch 4 / Batch 5 範疇）

**邊界**：

- doc-only；無 `lib/` / `templates/` / `bin/` / skill source 變更
- 依 `planning/full-tutorial-rewrite-plan.md` §3.4，本次走 independent
  public docs update：不 bump `package.json`、不 `npm publish`、不
  `git tag`、不建 GitHub Release
- `outputs/` tree 完全未動（無 file move / delete / rename / 內容修改）

**驗證**：

- `npm test`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm pack --dry-run`
- `git diff --check`
- 手動 link spot-check：`../docs/evaluating-dflow.md`、
  `../docs/using-with-claude-code.md`、`../docs/using-with-codex.md`、
  step file paths、`outputs/` tree 連結均可達；`outputs-tour.md` 兩條
  forward-link 為設計性故意，將於 Batch 2 / Batch 3 落地

---

## 0.2.0 — 2026-05-09 — Public migration tooling, governance baseline, and evaluator onboarding

**Proposals**：PROPOSAL-016（governance baseline）、PROPOSAL-017（AI-assisted feedback flow）、PROPOSAL-018（repository consistency）、PROPOSAL-021（verification-only CI）。其餘為 backlog 推進的公開 docs 與 migration tooling 累積項。

**變更**：
- 新增 CLI 子命令 `dflow doctor`，read-only 健檢三條 V1 migration signal（root `specs/`、`_共用/`、缺 `> Dflow Version:` 行），輸出指向 `docs/migrating-to-dflow-v1.md`。
- 生成檔 shape 調整：`dflow/specs/shared/_conventions.md` front matter 新增 `> Dflow Version: <version>` 行，由 `lib/init.js` 用 `package.json#version` 替換為實際版本。
- 新增 `/dflow:report-dflow-feedback` workflow，AI 將 upstream 觀察整理為本地 sanitized draft，不自動送出（PROPOSAL-017）。
- `AI-AGENT-GUIDE.md` 新增 `## Pre-V1 Artifacts Detection` 段，要求 AI 偵測 6 類 pre-V1 殘留訊號並 surface，禁止 silent rewrite。
- 新增 `docs/migrating-to-dflow-v1.md` 人讀 migration guide 覆蓋 5 條 V1 baseline 變更；README Status 與 `lib/init.js` legacy `specs/` warning 都加 cross-link。
- Public governance baseline（PROPOSAL-016）：`CONTRIBUTING.md`、`docs/release-versioning-policy.md`、`docs/npm-publish-checklist.md`、4 套 GitHub issue templates。
- Public onboarding：`docs/evaluating-dflow.md` 公開評估者指引、`docs/using-with-claude-code.md`、`docs/using-with-codex.md` per-tool walkthrough、`tutorial/README.md` English Reading Guide、README Get Started cross-link。
- Verification-only GitHub Actions workflow（PROPOSAL-021），對 `pull_request` / `push` 至 `main` 自動跑 `npm test` + `npm pack --dry-run` + `git diff --check`，不附 publish-capable secrets。
- Dev-only consistency tooling（PROPOSAL-018）：`scripts/check-repo-consistency.sh` 一鍵驗證；`scripts/export-dist.sh` 新增 `--check` / `--dry-run`。
- npm package hygiene：`package.json#files` 涵蓋 `CONTRIBUTING.md`、`CHANGELOG.md`、`TEMPLATE-COVERAGE.md`、`TEMPLATE-LANGUAGE-GLOSSARY.md`。
- `TEMPLATE-COVERAGE.md` / `TEMPLATE-LANGUAGE-GLOSSARY.md` 內 PROPOSAL-013 reference 改指 `archive/proposals/PROPOSAL-013-system-document-template-coverage.md`。

**Migration notes**：
- 既有 0.1.x 專案的 generated `_conventions.md` 不會自動補 `> Dflow Version:` 行；可手動加，或循 `docs/migrating-to-dflow-v1.md` 在新建專案時自動帶入。
- Pre-V1 採用者循 `docs/migrating-to-dflow-v1.md` 5 條 manual migration paths；CLI 對 legacy 路徑仍 warn-only，無 destructive auto-migration。

**驗證**：
- `npm test`
- `npm pack --dry-run`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- `git diff --check`

詳見以下 dated entries（按時間倒序）。

---

## 2026-05-08 — `dflow doctor` read-only health check command

**變更**：
- 新增 `dflow doctor` CLI 子命令（`bin/dflow.js` + `lib/init.js`
  `runDoctor`），提供 read-only 健檢，不修改任何檔案
- 健檢三條 signal：
  - 偵測 root `specs/` 是否含 Dflow 內容（指向 migration guide §1）
  - 偵測 `_共用/` 是否殘留於 `specs/` 或 `dflow/specs/`（指向 §2）
  - 偵測 `dflow/specs/shared/_conventions.md` 是否缺 `> Dflow Version:`
    front-matter 行（建議 manual backfill）
- 輸出格式列出 finding level（warn / info）、title、detail、action 與
  finding 統計，並明示 doctor 為 read-only
- `bin/dflow.js` 新增 `doctor` 子命令、`--help` 與 main help 說明
- `test/smoke.mjs` 新增兩條 doctor 斷言（clean V1 init 與 legacy specs/
  專案各一），驗證 finding 文字與 read-only stance
- README "Get Started" 加段提到 `dflow doctor`；
  `docs/migrating-to-dflow-v1.md` "Before You Start" 補一條 cross-link

**邊界**：
- read-only：doctor 不寫 / 不改 / 不刪除任何檔案；exit code 為操作成功
  與否（findings 存在仍 exit 0），便於互動式檢查與 CI smoke
- 依 `docs/release-versioning-policy.md`，新增 CLI 子命令屬 minor，本次
  不 bump version、不 publish、不 tag、不建 GitHub Release；變更 accumulate
  到下次 minor release window

**驗證**：
- `npm test`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-08 — AI-AGENT-GUIDE adds Pre-V1 artifacts detection segment

**變更**：
- `AI-AGENT-GUIDE.md` scaffolding 新增 `## Pre-V1 Artifacts Detection`
  段，要求 AI agent 在偵測到 6 類 pre-V1 殘留訊號時 surface 給使用者
  並指向 `docs/migrating-to-dflow-v1.md`，明確禁止 silent rewrite
  - top-level `specs/` 含 Dflow 內容
  - `_共用/` directory
  - V1 templates 應為 canonical English 但實際為繁中 heading
  - 文件提及 runtime `/dflow:init-project` slash command
  - root `CLAUDE.md` / `AGENTS.md` 為 full file 而非 thin shim
  - `_conventions.md` 缺 `> Dflow Version:` 前 matter 行
- 兩 track 同步：`sdd-ddd-greenfield-skill/scaffolding/AI-AGENT-GUIDE.md`、
  `sdd-ddd-brownfield-skill/scaffolding/AI-AGENT-GUIDE.md` 與 packaged
  template mirror 全部更新

**邊界**：
- 行為性質：AI 偵測後只 surface 觀察與建議手動 migration；不允許 AI
  自行改寫既有檔案路徑或 heading
- 不 bump version、不 publish、不 tag、不建 GitHub Release
- 既有專案的 AI-AGENT-GUIDE 不會自動更新；要 backfill 可手動將該段
  貼入 `dflow/specs/shared/AI-AGENT-GUIDE.md`，或在新建專案時自動帶入

**驗證**：
- `npm test`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-08 — Init records Dflow Version in generated `_conventions.md`

**變更**：
- `_conventions.md` scaffolding template 在 front matter 新增一行
  `> Dflow Version: {dflow-version}`，由 `lib/init.js` 在 init 時用
  `package.json#version` 替換為實際版本號
- 兩 track 同步：`sdd-ddd-greenfield-skill/scaffolding/_conventions.md`、
  `sdd-ddd-brownfield-skill/scaffolding/_conventions.md` 與 packaged
  template mirrors 全部更新
- `test/smoke.mjs` 補兩條 assertions（Greenfield / Brownfield）驗證
  該欄位存在且符合 semver 格式
- 既有 0.1.0 / 0.1.1 init 過的專案不會自動補欄位；要補可在
  `dflow/specs/shared/_conventions.md` front matter 自行加一行，或參考
  `docs/migrating-to-dflow-v1.md` 的「Pre-V1 / V1 升級」流程後在新建
  專案時自動帶入

**邊界**：
- 不改既有 init 行為的其他輸出，不新增 prompt
- 不 bump version、不 publish、不 tag、不建 GitHub Release

**驗證**：
- `npm test`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-08 — Migration guide cross-links from README and init warning

**變更**：
- `README.md` Status 段補一行連到 `docs/migrating-to-dflow-v1.md`，
  讓既有 pre-V1 Dflow 採用者從首頁就能找到 manual migration checklist
- `lib/init.js` 偵測到 legacy root `specs/` 時的 warning 文末附上
  migration guide 連結，使 init 階段的 hint 可直接導向人讀步驟
- CLI 行為仍為 warn-only：不修改既有檔案、不執行任何 migration 動作；
  V1 clean cut 立場不變

**邊界**：
- 不 bump version、不 publish、不 tag、不建 GitHub Release
- 不擴張 init 行為（無新 prompt、無自動 migration）

**驗證**：
- `npm test`
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-08 — Manual migration guide for V1 baseline

**變更**：
- 新增 `docs/migrating-to-dflow-v1.md`：人工 migration guide，覆蓋五條 V1 baseline 變更
  - root `specs/` → `dflow/specs/`（PROPOSAL-014）
  - `dflow/specs/_共用/` → `dflow/specs/shared/`（PROPOSAL-012）
  - Chinese template heading → canonical English heading（PROPOSAL-013）
  - `/dflow:init-project` runtime slash command → `npx dflow-sdd-ddd init` shell command（PROPOSAL-014）
  - Claude-only init → multi-AI thin shim（PROPOSAL-020）
- 文件刻意保留 manual：V1 不提供 auto-migration、`dflow doctor`、`dflow migrate`；相關 trigger 條件記錄於 `planning/version-upgrade-migration-strategy.md`

**邊界**：
- 不修 README cross-link（避免本批次擴張到 README rewriting）
- 不 bump version、不 publish、不 tag、不建 GitHub Release

**驗證**：
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm test`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-08 — Template coverage / glossary archived P013 link fix

**變更**：
- `TEMPLATE-COVERAGE.md` 與 `TEMPLATE-LANGUAGE-GLOSSARY.md` 的 HTML comment 與 anchor-add 步驟改指向 `archive/proposals/PROPOSAL-013-system-document-template-coverage.md`
- 舊路徑 `proposals/PROPOSAL-013` 已於 P013 implementation closeout 時 archive，公開讀者沿著舊 link 會 404

**驗證**：
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm test`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-08 — Per-tool walkthrough docs (Claude Code, Codex CLI)

**變更**：
- 新增 `docs/using-with-claude-code.md`：說明 `init` 在 Claude Code 環境下產生的檔案、`/dflow:*` slash commands 在 Claude Code 中如何呼叫、project-level 與 user-level 安裝差異
- 新增 `docs/using-with-codex.md`：同範本對應 Codex CLI，覆蓋 `AGENTS.md` shim 與 Codex CLI 對 Dflow workflow 的呼叫方式
- README "Files Created by Init" 段加 per-tool walkthrough cross-link
- `docs/evaluating-dflow.md` AI tool support 段補上 per-tool walkthrough 連結

**邊界**：
- Gemini CLI / GitHub Copilot 兩條 walkthrough 本次不附，仍 gated；trigger 條件記錄於 `planning/public-onboarding-tasklist.md` §5

**驗證**：
- `scripts/export-dist.sh --check`
- dist `npm test`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-08 — Public evaluator guide and onboarding cross-links

**變更**：
- 新增 `docs/evaluating-dflow.md`：public-facing decision aid，涵蓋 What `init` Creates and Does Not Do、Greenfield or Brownfield 選擇指引、30-Minute Evaluation Playbook、AI tool 支援
- README "Get Started" 段加 evaluator guide 與 `tutorial/` cross-link，將 evaluator guide 定位為公開試用主入口
- README "Files Created by Init" 段澄清 `init` 不複製 `tutorial/`，`tutorial/` 為 source repo 的 evaluation material，並連到 tutorial reading guide
- `tutorial/README.md` 開頭加入 English Reading Guide：scenario 命名、step-file 編號、`outputs/` 鏡像規則、與 `docs/evaluating-dflow.md` 的分工
- README 與 `CONTRIBUTING.md` 補 verification CI 說明：PR 會自動跑 GitHub Actions verification workflow，CI 為 verification-only

**驗證**：
- `scripts/export-dist.sh --check`
- dist `npm test`
- dist `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-07 — Verification-only CI workflow

**Proposal**：PROPOSAL-021（implemented）

**變更**：
- 新增 `.github/workflows/verification.yml`：對 `pull_request` 至 `main`、`push` 至 `main`、`workflow_dispatch` 三類事件執行 `npm test`、`npm pack --dry-run`、`git diff --check`
- Workflow 採 `permissions: contents: read`、workflow-level `concurrency`、Node 22；dev-only `scripts/check-repo-consistency.sh` 由 `MAINTAINERS.md` / 該腳本自身雙重 guard，dist workflow 自動 skip 該步
- Actions runtime 升至 Node 24 compatible：`actions/checkout@v6`、`actions/setup-node@v6`
- 新增 dev `.gitattributes`：`*.sh text eol=lf`，確保 shell scripts 在 Windows checkout 時不會被 CRLF 化破壞執行

**邊界**：
- CI 為 verification-only，不執行 publish、tag、Release，不需 publish-capable secrets
- 詳細 release-boundary 設計與決策見 `archive/proposals/PROPOSAL-021-verification-ci-and-release-boundary.md`

**驗證**：
- dev / dist Verification GitHub Actions run 均 success
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- `git diff --check`

---

## 2026-05-06 — Public package docs polish

**變更**：
- README Get Started 補 Node.js / npm prerequisite，並說明 `init` 只建立 workflow docs / AI instruction files，不會 inspect、refactor、migrate application code
- README 補建議 first adoption pass 可先用 branch 或 disposable sample project 檢查 generated `dflow/specs/`
- CONTRIBUTING 補 template / scaffolding change 時需同步 skill source 與 packaged templates
- CONTRIBUTING 的 common shared flow list 補 `dflow-feedback-flow.md`
- Release / publish docs 補 maintainer-facing 語氣，避免 contributor 誤以為一般 PR 需要執行 publish checklist

**驗證**：
- `scripts/check-repo-consistency.sh`
- `scripts/export-dist.sh --check`
- dist `npm test`
- dist `npm pack --dry-run`
- dist `git diff --check`

---

## 2026-05-06 — Repository consistency local verification

**Proposal**：PROPOSAL-018（implemented）

**變更**：
- 新增 dev-only `scripts/check-repo-consistency.sh`
- 一鍵執行 `npm test`、`npm pack --dry-run`、`git diff --check`
- 補 skill source vs npm packaged template mirror byte-compare
- 補 Greenfield / Brownfield common reference flow coverage 檢查
- 補 track-specific file manifest、`package.json#files`、`bin/dflow.js` shebang / executable、retired localized skill references 檢查
- `AGENTS.md` / `CLAUDE.md` 補 dev repo consistency check 規則
- Phase 1 不新增 GitHub Actions、不改 release ownership、不碰 npm publish / tag / GitHub Release

**驗證**：
- `scripts/check-repo-consistency.sh`
- `git diff --check`

---

## 2026-05-06 — Dist sync script hardening

**變更**：
- `scripts/export-dist.sh` 新增 `--check`，可非破壞性確認 dist repo 已等同 dev public file set
- `scripts/export-dist.sh` 新增 `--dry-run`，可預覽會 copy / update / remove 的 public distribution paths
- 正常 export 結尾新增 known excluded stale path 驗證，避免 dev-only material 殘留在 dist repo
- `AGENTS.md` 補上 `--check` / `--dry-run` 的長期操作規則

**驗證**：
- `bash -n scripts/export-dist.sh`
- `scripts/export-dist.sh --check`
- `scripts/export-dist.sh --dry-run`
- `npm test`
- `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-06 — Public README release-state clarification

**變更**：
- README Status 補清楚 npm latest 仍為 `0.1.1`
- README Status 補清楚 GitHub source 可能已包含 post-`0.1.1` docs / governance / feedback-flow 更新，實際 release history 以 `CHANGELOG.md` 為準
- Smoke test harness 改用 synchronous subprocess + scripted stdin，避免非 TTY 環境下等待 first output 導致 init 未實際執行

**驗證**：
- `npm test`
- `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-06 — npm package hygiene: include referenced maintainer docs

**變更**：
- `package.json#files` 新增 `CHANGELOG.md`、`TEMPLATE-COVERAGE.md`、`TEMPLATE-LANGUAGE-GLOSSARY.md`
- 原因：`CONTRIBUTING.md` 已進 npm package，且會指引 contributor 閱讀 template coverage / glossary；release policy 也以 `CHANGELOG.md` 作為 release history source
- 保持 `.github/` 不進 npm package；issue templates 仍只屬 GitHub public repo surface

**驗證**：
- `npm test`
- `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-06 — npm package hygiene: include contributing guide

**變更**：
- `package.json#files` 新增 `CONTRIBUTING.md`
- 原因：README 已連到 `CONTRIBUTING.md`；下一次 npm package 應包含該文件，避免 npm package / npm README 上的 governance link 指向 package 內不存在的檔案
- `.github/` 維持只屬於 GitHub public repo，不納入 npm package

**驗證**：
- `npm test`
- `npm pack --dry-run`
- `git diff --check`

---

## 2026-05-06 — AI-assisted Dflow feedback draft flow

**Proposal**：PROPOSAL-017（implemented）

**變更**：
- 新增 `/dflow:report-dflow-feedback` standalone flow，讓 AI 將使用 Dflow 時發現的 upstream 問題或改良點整理成本地草稿
- 新增雙版 `references/dflow-feedback-flow.md`，規範分類、safe evidence capture、redaction checklist、GitHub issue body draft、optional PR plan
- 雙版 `SKILL.md` command routing、reference table、standalone command list 同步新增 feedback flow
- 雙版 `AI-AGENT-GUIDE.md` 與 `CLAUDE-md-snippet.md`（含 packaged `templates/*/scaffolding/` source）同步新增命令說明
- README / CONTRIBUTING 補 AI-assisted feedback draft 說明
- `TEMPLATE-COVERAGE.md` 補 reference flow parity note，明示 GitHub CLI submission 需另案

**邊界**：
- 不自動執行 `gh issue create` / `gh pr create`
- 不 push、不開 PR、不將本地資訊送出
- 使用者必須審核 redaction checklist 後才可自行提交

**驗證**：
- `npm test`
- `git diff --check`

---

## 2026-05-06 — Public project governance baseline

**Proposal**：PROPOSAL-016（implemented）

**變更**：
- 新增 `CONTRIBUTING.md`，定義 public issue / PR guidance、Greenfield/Brownfield common-flow sync expectations、template heading change guard
- 新增 `docs/release-versioning-policy.md`，定義 0.x patch / minor / breaking-change handling，以及 dev repo / dist repo / npm / GitHub Release 的 release surface
- 新增 `docs/npm-publish-checklist.md`，整理 manual publish、post-publish smoke、tag、GitHub Release、dist sync closeout
- 新增 GitHub issue templates：bug report、workflow change request、docs feedback、question
- README 補 contributing / release policy / publish checklist links，並將 status wording 更新到 `0.1.1`
- `planning/public-distribution-backlog.md` 標記 governance baseline 已由 P016 接管；release automation 仍保留為後續議題

**驗證**：
- `git diff --check`

---

## 0.1.1 — 2026-05-05 — Multi-AI init guide and tool shims

**變更**：
- CLI init 新增 Q6 AI coding agents，可選 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md`
- 新增 `dflow configure-agents`，供已初始化專案後續追加 AI tool shims，不需重跑 init
- 新增 `dflow/specs/shared/AI-AGENT-GUIDE.md` 作為 tool-neutral canonical guide
- Tool-specific root files 改為 thin shim，既有檔案不覆寫，改產生 `dflow/specs/shared/*-snippet.md`
- Optional starter Q5 移除 Claude-only 選項，避免 public init 看起來綁定單一 AI 工具
- README、init contract、tutorial init 段與 coverage matrix 同步 multi-AI wording

**驗證**：
- `npm test`
- `npm pack --dry-run`
- `diff -qr` skill source vs packaged templates
- `git diff --check`

---

## 2026-05-04 — Public distribution naming：Greenfield / Brownfield tracks

**變更**：
- 公開 track naming 從早期 `core` / `webforms` 改為 `greenfield` / `brownfield`
- CLI init 移除第二題 edition prompt；Q1 project type 直接決定 packaged template set
- package templates 目錄改為 `templates/greenfield/` 與 `templates/brownfield/`
- AI-facing skill source 目錄改為 `sdd-ddd-greenfield-skill/` 與 `sdd-ddd-brownfield-skill/`
- Tutorial 目錄改為 `tutorial/01-greenfield/` 與 `tutorial/02-brownfield/`
- README / package metadata 同步 public dist repo wording，並納入 `docs/why-ddd-for-ai.md`

**驗證**：
- `npm test`
- `npm pack --dry-run`
- `diff -qr` skill source vs packaged templates
- `git diff --check`

---

## 2026-05-01 — Public npm publish：`dflow-sdd-ddd@0.1.0`

**發布**：`dflow-sdd-ddd@0.1.0` 已發布到 npm public registry。

**驗證**：
- `npx dflow-sdd-ddd --version` 回傳 `0.1.0`
- `npx dflow-sdd-ddd --help` 顯示 `Dflow CLI 0.1.0`
- `npx dflow-sdd-ddd init` 已在乾淨 temp project 寫出 Core greenfield baseline：`CLAUDE.md`、`dflow/specs/shared/*`、`dflow/specs/domain/*`、`dflow/specs/architecture/tech-debt.md`

**Post-publish docs cleanup**：
- 分段 tutorial 的 init 劇本標明為教學化轉寫，避免被誤讀為 `dflow-sdd-ddd@0.1.0` 的逐字 CLI transcript
- 移除已退場的 P001 前 / P001 hybrid 單檔 tutorial，避免後續 AI 或人讀者誤用過期流程素材
- 將歷史 proposal / review 材料移入 `archive/`，讓 `proposals/`、`reviews/` 保留給後續 active work
- 完成 Closeout C2 tutorial 索引收尾：新增 `tutorial/README.md`、補 `01-greenfield/00-setup.md`，並加入 Mermaid reading map

**備註**：npm publish 使用 npm Security Key / WebAuthn 2FA flow；不要使用 TOTP `--otp` 作為新帳號的預設發布路徑。

---

## 2026-05-01 — Post-R9 Publish Prep：npm package name 與 metadata

**背景**：npm 上 unscoped `dflow` package name 已被既有 package 使用；本 repo 不能直接以 `dflow` 發布。

**變更**：
- `package.json` package name 改為 `dflow-sdd-ddd`
- CLI bin 保留 `dflow`，並新增 `dflow-sdd-ddd` alias
- README、skill source、package templates、tutorial init entry 更新為 `npx dflow-sdd-ddd init`
- 補 npm publish metadata：keywords、repository、bugs、homepage、`publishConfig.access`
- 新增 MIT `LICENSE`

**使用方式**：
- V1 public default：`npx dflow-sdd-ddd init`
- 進階 global install：`npm install -g dflow-sdd-ddd` 後執行 `dflow init`

---

## 2026-05-01 — R9 Implement：PROPOSAL-014 CLI init + `dflow/specs/` namespace、PROPOSAL-015 prose language convention

**前置**：PROPOSAL-014 / PROPOSAL-015 已於 2026-04-30 approved；實作採 shared-cut，避免 init flow、path namespace、prose-language convention 反覆 cascade
**Proposal**：`proposals/PROPOSAL-014-cli-init-and-dflow-root-namespace.md`、`proposals/PROPOSAL-015-templates-prose-language-convention.md`（implemented）

**W1 — init contract + npm package skeleton**
- 新增 `planning/init-contract-spec.md` 作為 `npx dflow init` 的 authoritative contract
- 新增 npm CLI skeleton：`package.json`、`bin/dflow.js`、`lib/init.js`
- 打包 `templates/{core,webforms}/`；init 預設寫入 `dflow/specs/`
- init Q&A 納入必填 `prose-language`，並寫入 `dflow/specs/shared/_conventions.md`

**W2a — skill source cascade**
- 雙版 `SKILL.md` 移除 `/dflow:init-project` runtime slash command 入口，init 改由 npm CLI 負責
- 雙版 references、templates、scaffolding 路徑 cascade 到 `dflow/specs/`
- 五條 prose-generating flow 在 Step 1 讀取 `dflow/specs/shared/_conventions.md` 的 `Prose Language`
- 雙版 `_conventions.md` scaffolding 新增 `## Prose Language` 段

**W2b — tutorial cascade**
- Tutorial 對話與 outputs 改為 `npx dflow init` + `dflow/specs/`
- Tutorial outputs 搬移到 `outputs/dflow/specs/**`
- 補齊 brownfield WebForms init 段，承接後續 modify-existing / baseline-capture 劇情

**W2c — root docs / closeout**
- README adoption 改為 npm CLI first；V1 預設入口為 `npx dflow init`
- `TEMPLATE-COVERAGE.md` generated / maintained paths 改為 `dflow/specs/...`
- 明示 repo / project root `CLAUDE.md` 是特殊例外，維持在 root 供 AI tools 探測
- `TEMPLATE-LANGUAGE-GLOSSARY.md` 補 `Prose Language`、`free prose`、`structural language` 等術語對照
- P014 / P015 狀態更新為 `implemented`，保留原 user evaluation 決策紀錄語氣

**Post-review fixes**
- 修正 `dflow/specs/shared/` scaffolding 內指向 sibling `domain/`、`architecture/`、`migration/` 的 relative links，避免 generated `_overview.md` / `_conventions.md` 指到 `shared/` 底下的錯路徑
- 補 smoke test assertion，防止 shared scaffolding link target 回歸為 unqualified sibling path
- 補 planning docs closeout note，標明 W1a handoff / public-distribution backlog 中已由 P014 / P015 收斂的決策

**V1 clean cut**
- 新 baseline 是 `npx dflow init` + `dflow/specs/`
- 不提供 legacy root `specs/` migration tool、dual-read 或自動搬移
- R7 / R8 既有 CHANGELOG 歷史條目保留原樣，不追溯改寫

---

## 2026-04-28 — R8b 實施：PROPOSAL-013 系統文件樣板覆蓋與 Template Coverage Matrix

**前置**：R8a / PROPOSAL-012 已 implemented；R8b Review + Approve 處理 17 個 finding（accept: 11 / accept-with-choice: 6）；4 項設計決策拍板 per `reviews/round-8b-decisions.md`
**Proposal**：`proposals/PROPOSAL-013-system-document-template-coverage.md`（implemented）

**Sub-wave 1 — 純新增**
- 新增 `templates/glossary.md` / `models.md` / `rules.md` / `context-map.md` / `tech-debt.md` 雙版共 10 檔
- 新增 `templates/events.md`（Core only）
- 新增 `scaffolding/architecture-decisions-README.md`（Core only，per F-07 / F-16 修補 P010 baseline）
- 新增 `<repo root>/TEMPLATE-COVERAGE.md`（含 Section anchors 欄，per F-06 Path A）
- 新增 `<repo root>/TEMPLATE-LANGUAGE-GLOSSARY.md`（per F-11 Path A 雙版共用）

**Sub-wave 2 — 既有 templates / scaffolding canonical English + anchor 注入**
- 修改 `templates/_index.md` / `phase-spec.md` / `lightweight-spec.md` / `behavior.md` / `context-definition.md`（雙版共 10 檔）
- 修改 `templates/aggregate-design.md`（Core only）
- 修改 `templates/CLAUDE.md`（雙版，per F-01 Path A 全 H2/H3 英文化）
- 修改 `scaffolding/_conventions.md`（雙版，per F-04 cascade 將「輕量修改紀錄」改為 `Lightweight Changes`）；`scaffolding/_overview.md` 雙版檢查 verify 為已英文化結構，無需修改
- 修改 `scaffolding/Git-principles-{gitflow,trunk}.md`（雙版共 4 檔，per F-14 精化 Integration Commit labels）
- 修改 `scaffolding/CLAUDE-md-snippet.md`（雙版，per F-01 Path A 同步全英化）
- 注入 6 個 initial `<!-- dflow:section X -->` anchor 到對應 templates
- 擴充 `<repo root>/TEMPLATE-LANGUAGE-GLOSSARY.md`

**Sub-wave 3 — references cascade + SKILL.md**
- 修改 `references/init-project-flow.md` / `new-feature-flow.md` / `modify-existing-flow.md` / `finish-feature-flow.md` / `drift-verification.md` / `pr-review-checklist.md` / `git-integration.md`（雙版共 14 檔）+ `ddd-modeling-guide.md`（Core only）
- `finish-feature-flow.md` Step 5 Integration Summary labels 英文化（per F-04）
- `drift-verification.md` 補 Anchor coexistence rule 段（per F-08）
- `pr-review-checklist.md` section name cascade 同步（per F-03）
- `git-integration.md` 檢查級別，加 R8b verified 註記（per F-17）
- `ddd-modeling-guide.md` 補 context-map.md 缺檔處理（per F-13）
- 修改 `SKILL.md`（雙版，per F-05：Templates 表 + Coverage Matrix 引用 + section name cascade）

**Sub-wave 4 — lightweight-spec Implementation Tasks + task guard**
- 修改 `templates/lightweight-spec.md`（雙版）：補 `Implementation Tasks` 段 per §7 + 雙版 layer tags
- 修改 `references/modify-existing-flow.md`（雙版）：完善 task guard 流程（不以項目數自動升級；AI 主動詢問）

**繁中版同步**：延至 Post-Review Closeout C1（依 review-workflow.md §七）

**設計動機補寫**（R8b approve 階段識別並落地於 P013）：
- §1 補 Anchor coexistence rule 段 + Anchor naming rules（namespacing only，versioning 延後到 backlog § 7）+ Design intent 段（明示 anchor 機制啟用 localized heading 的長期動機）
- `planning/public-distribution-backlog.md` § 1 加註 P013 接管；新增 §1.1「anchor-enabled localized heading（P013 後）」候選方向

**下一步**：R8b Implement Review（仿 R7 Implement Review pattern）

---

## 2026-04-27 — R8a Implement：PROPOSAL-012 路徑英文化（`specs/_共用/` → `specs/shared/`）

**前置**：R8a Review（Cursor Claude Opus 4.7，`reviews/round-8a-report.md`）+ R8a Approve（Claude Opus 4.7，`reviews/round-8a-decisions.md`）；PROPOSAL-012 處理 10 個 finding（accept 5 / accept-with-choice 3 / reject 2 / defer 0）後 approved
**決議文件**：`reviews/round-8a-decisions.md`
**實作範圍**：

- **Path policy 落地**：`/dflow:init-project` 產生的專案級 scaffolding 目的地由 `specs/_共用/` 改為 `specs/shared/`，符合「machine-facing paths and filenames default to English」政策（P012 §1）
- **Skill 引用同步**：
  - 雙版 `SKILL.md § Templates & Scaffolding` 段路徑文字更新
  - 雙版 `references/init-project-flow.md`（Step 2 Q5、Step 3 file-list preview、Step 4 `CLAUDE.md` special handling、Step 5 results report）全部 `_共用/` → `shared/`
  - 雙版 `scaffolding/CLAUDE-md-snippet.md`：WebForms 5 處 inline 引用 + directory tree 範例（`_overview.md` / `_conventions.md` / `Git-principles-*.md` 從 `specs/` 直接子節點移到 `specs/shared/` 之下）；Core 1 處 inline 引用
- **`templates/CLAUDE.md` tree 同步 + 兩版 oversight 補全**（per F-04 Path B）：
  - WebForms `templates/CLAUDE.md` directory tree 將 `_overview.md` / `_conventions.md` 從 `specs/` 直接子節點移到 `specs/shared/`
  - Core `templates/CLAUDE.md` directory tree 順手補上漏列的 `_overview.md` / `_conventions.md`（兩版 init-project-flow 都會產生，但 Core tree 是 P010 之前就存在的 oversight）
- **`planning/project-review-brief.md` 過時引用更新**（per F-01 Path A）：line 51 移除「P012 後預期改名」前瞻性段落；§ 3.1 / § 3.2 directory tree 註解去除前瞻性 wording；§10 P012 候選議題段加註「（已由 P012 處理）」
- **README.md 確認**（per P012 §影響範圍 「可能只需確認」）：grep verify README.md 無 `_共用` 字面引用，無需修改

**歷史條目保持原樣**（per F-10 accept）：CHANGELOG.md 既有 **2026-04-24 R7 Implement Review Fix 段下的 F-03 條目**、**2026-04-22 R7 Wave 3 段下的 P010 init-project `CLAUDE.md` 特別處理條目** 對 `specs/_共用/` 的引用是當時的事實紀錄，**不改寫**；implementer 不應對 CHANGELOG 做全域 grep-and-replace。（內容式自指；P012 §影響範圍 row 10 描述的 line 17 / line 61 行號是 R8a 修訂期、新段尚未插入時的位置，新段加入後行號位移屬正常）

**實際修改檔案（10 檔；P012 §影響範圍 11 列中 `README.md` 經 verify 無 `_共用` 引用、無需修改）**：
- `sdd-ddd-{webforms|core}-skill/SKILL.md`（2 檔）
- `sdd-ddd-{webforms|core}-skill/references/init-project-flow.md`（2 檔，replace_all）
- `sdd-ddd-{webforms|core}-skill/scaffolding/CLAUDE-md-snippet.md`（2 檔；WebForms 含 tree restructure）
- `sdd-ddd-{webforms|core}-skill/templates/CLAUDE.md`（2 檔；WebForms tree restructure；Core 補檔 + tree restructure）
- `planning/project-review-brief.md`（4 處更新）
- `CHANGELOG.md`（本段新增）

**不納入**（per P012 §不納入影響範圍）：
- 文件內容語言（中文 heading 不英文化；由 PROPOSAL-013 處理，包含 canonical English templates + `TEMPLATE-LANGUAGE-GLOSSARY.md`）
- 繁中版（`sdd-ddd-*-skill-tw/`）（延到 Closeout C1）
- npm / package files（延到 `planning/public-distribution-backlog.md § 2`）
- Dflow 文件根目錄命名（`specs/` vs `dflow/`）（延到 backlog § 6）

**剩餘待辦**：R8a Implement Review（仿 R7 pattern）；R8b（PROPOSAL-013）Implement 啟動依賴本實作完成。

---

## 2026-04-24 — R7 Implement Review Fix：4 findings 修正

**前置**：R7 Implement Review（Codex gpt-5.4 xhigh，`reviews/round-7-implement-review-report.md`）對 Wave 1-3 實施產物產出 4 個 findings（1 Critical / 2 Major / 1 Minor / 0 Question）
**決議文件**：`reviews/round-7-implement-review-decisions.md`（Approve + Fix 合併 session）
**修正項目**：

- **F-01 (Critical, accept + 擴 scope)**：`new-phase-flow.md` Step 5 row 範例的 `_index.md` 檔案連結誤用 `{slug}` 而非 `{phase-slug}`，會產生失配連結破壞 P009 Path A-3 命名一致性。修正：雙版 `new-phase-flow.md` 第 5 欄 `{slug}` → `{phase-slug}`；scope 擴至 `templates/_index.md` 雙版 row 1 範例（同類 within-row 不一致 typo）。`new-feature-flow.md` 雙版保持不動（self-consistent 設計；首 phase 預設 phase-slug = feature-slug）
- **F-02 (Major, accept-with-choice Path B)**：Wave 1 `git-flow-integration.md` → `git-integration.md` 的 rename 在 git 預設門檻看不出。Verify 結果：**`git mv` 實際有執行**，但同 commit 大幅內容重寫使相似度（WebForms 43%、Core 18%）低於 `-M50` 預設。採 Path B：保留 commit 歷史 + 修 CHANGELOG 自述 + 雙版 `git-integration.md` 頂部加 file history note。理由：(a) Codex review report 以 `bf5bb85` 為對照 hash，改 history 破壞可追溯性；(b) Dflow 非活躍 blame repo；(c) 誠實記錄 > 修歷史。**教訓（後記於本 CHANGELOG Wave 1 段）**：`git mv` + 大重寫需拆為兩個 commit（先純 rename、再內容改寫），未來納入 `git-integration.md`「Directory Moves Must Use git mv」段
- **F-03 (Major, accept)**：WebForms `CLAUDE-md-snippet.md` 5 處路徑（3 個 unique pattern）引用 `specs/_overview.md` / `specs/_conventions.md` / `specs/Git-principles-*.md`，但 `init-project-flow.md` 實際產出 `specs/_共用/...`；Core 版已正確。修正：WebForms 版所有相關路徑加 `_共用/` 前綴
- **F-04 (Minor, accept)**：雙版 `templates/CLAUDE.md` 引用 `scaffolding/Git-原則-gitflow.md`（中文化檔名），Wave 3 實際檔名為 `Git-principles-gitflow.md`（英文）。修正：兩版 `Git-原則-gitflow.md` → `Git-principles-gitflow.md`

**修改檔案**（10 檔英文版）：
- `sdd-ddd-{webforms|core}-skill/references/new-phase-flow.md`（F-01）
- `sdd-ddd-{webforms|core}-skill/templates/_index.md`（F-01 擴 scope）
- `CHANGELOG.md` Wave 1 段 + 新增本段（F-02）
- `sdd-ddd-{webforms|core}-skill/references/git-integration.md`（F-02，頂部加 file history note）
- `sdd-ddd-brownfield-skill/scaffolding/CLAUDE-md-snippet.md`（F-03，5 處路徑修正）
- `sdd-ddd-{webforms|core}-skill/templates/CLAUDE.md`（F-04）

**不變動**：
- Wave 1 / 2 / 3 commit history（採 Path B 保留歷史）
- 繁中版檔案（延至 Closeout C1）
- Proposal 本身（已 approved，不修）
- `new-feature-flow.md` 雙版（F-01 self-consistent 設計，不擴 scope）

**統計**：accept 3 / accept-with-choice 1 / reject 0 / defer 0 / clarify 0 / out-of-scope 0

**下一步**：**R7 全部完成**。進入 Post-R7 —— Global Sweep（選擇性）→ Closeout C1（繁中同步）→ Closeout C2（Tutorial 重建）→ 改名 + 遷移新 repo → Dflow V1 ships

---

## 2026-04-24 — R7 Wave 3 實施：PROPOSAL-010 `dflow init` 機制 + Scaffolding 範本集

**前置**：R7 Wave 1（PROPOSAL-011 Git Flow Decoupling）+ Wave 2（PROPOSAL-009 Feature 目錄化 + 多階段規格 + 新命令）已完成（見下方兩段 CHANGELOG）；R7 Review + Approve 處理 3 個 PROPOSAL-010 相關 finding（accept-with-choice：F-04 Path B；accept：F-05、F-07）
**Proposal**：`proposals/PROPOSAL-010-dflow-init-and-scaffolding.md`（implemented）
**影響範圍**：

**新增 Scaffolding 目錄**（雙版共 10 檔）
- `sdd-ddd-{webforms|core}-skill/scaffolding/_overview.md` —— 系統概觀範本（WebForms 版強調漸進式 Domain 抽離 + 遷移策略；Core 版強調 Clean Architecture 四層 + ADR）
- `sdd-ddd-{webforms|core}-skill/scaffolding/_conventions.md` —— 規格撰寫慣例範本（引用 SKILL.md 的三層 Ceremony T1/T2/T3，不重寫判準；Core 版補 Aggregate / VO / Domain Event 的 DDD 特有慣例）
- `sdd-ddd-{webforms|core}-skill/scaffolding/Git-principles-gitflow.md` —— Git Flow 版專案 Git 規範範本；**含 Integration Commit 訊息慣例段（F-04 Path B）** 對應 `/dflow:finish-feature` 產出的 Integration Summary 的 `--no-ff` merge commit 格式；含 hotfix 24h 補 spec 時限（人對人承諾，Dflow 不追蹤）
- `sdd-ddd-{webforms|core}-skill/scaffolding/Git-principles-trunk.md` —— Trunk-based / GitHub Flow 版；**含 Integration Commit 訊息慣例段（F-04 Path B）** 的 Squash / Rebase / Fast-forward 三種 commit 格式；不含 hotfix / release branch 規範（trunk-based 不用）
- `sdd-ddd-{webforms|core}-skill/scaffolding/CLAUDE-md-snippet.md` —— 加入專案 `CLAUDE.md` 的片段；**沿用 P007c 的 H2 分段**（系統脈絡 / 開發流程），明示完整 Dflow 決策邏輯在 skill 本體、不重抄
- 每份 scaffolding 檔頂部有版本註記：`<!-- Scaffolding template maintained alongside Dflow skill. See proposals/PROPOSAL-010 for origin. -->`（proposal 風險 1 緩解）
- Scaffolding 不重疊 skill 本體：不重述 SKILL.md 的 AI 決策邏輯、不重複 references/ 的 flow 文件；專注「專案治理」

**新增 Flow 文件**（雙版）
- `sdd-ddd-{webforms|core}-skill/references/init-project-flow.md` —— `/dflow:init-project` 五步流程（Step 1 現況盤點 / Step 2 專案資訊 5 題問答 / Step 3 File-list 預覽（Phase Gate：AI 列出 create / skip 清單供使用者確認，proposal 風險 2 緩解）/ Step 4 逐檔 Write，既有檔不覆寫 / Step 5 結果報告 + 下一步建議）
  - Step 3「必產清單」依 skill 版本分拆（**F-05 決議**）：
    - WebForms 版必產：`specs/features/{active,completed,backlog}/`、`specs/domain/glossary.md`、`specs/migration/tech-debt.md`
    - Core 版必產：`specs/features/{active,completed,backlog}/`、`specs/domain/glossary.md`、`specs/domain/context-map.md`、`specs/architecture/tech-debt.md`、`specs/architecture/decisions/README.md`
  - **`behavior.md` 不在 init 階段產生**（F-05 決議）：明確註記由 `/dflow:new-feature` Step 8.3 或 P007a baseline capture 於首個 bounded context 建立時產生，不在 init 階段製造 stale placeholder
  - `CLAUDE.md` 特別處理：已存在則不覆寫，以 `specs/_共用/CLAUDE-md-snippet.md` 形式提供片段供使用者合併；不存在則建立最小版

**修改**
- `sdd-ddd-{webforms|core}-skill/SKILL.md` —— Frontmatter Primary triggers 加入 `/dflow:init-project` + NL 二次觸發詞（"set up SDD in this project" / "adopt Dflow"）；決策樹新增 `/dflow:init-project` 節點；Slash Commands 表新增「專案級命令」子分類**置於「啟動類」之上**（proposal § 5）；Reference Files 表新增 `references/init-project-flow.md` 列；Templates 段改為「Templates & Scaffolding」，新增 Scaffolding 子段（5 檔清單 + 一句話說明 + 引用 `init-project-flow.md`）
- `README.md`（repo 根）—— 新增「How to adopt Dflow in your project」四步流程段：步驟 1 **用中立措辭不寫死 `.claude/skills/` 路徑**（F-07 決議；以 "using the current Claude Code skill-installation mechanism" + "Refer to Claude Code's official documentation" + "installation paths and conventions change over time, so Dflow deliberately does **not** hardcode a specific directory" 表達）；新增 V2 / Dflow 分工說明子段（4-column 對照表 + 共存 note + C2 Tutorial 重建鉤子）；**未改動既有「如何使用」段**（不鋪張不改寫舊內容）

**繁中版同步**：延至 Post-Review Closeout C1（依 review-workflow.md §七）；scaffolding 範本若使用者選中文語言，可選擇性新增繁中版（屬人讀內容，本 wave 先以英文版為主，繁中版選擇性）

**範圍外（嚴格遵守）**：
- 繁中版（`*-tw/`）—— 延到 Closeout C1
- PROPOSAL-009 / PROPOSAL-011 scope 產物未被修改（`templates/_index.md` / `templates/phase-spec.md` / `references/new-phase-flow.md` / `references/finish-feature-flow.md` / `references/git-integration.md` / SKILL.md 的三層 Ceremony + `/dflow:new-phase` / `/dflow:finish-feature` 段）
- V2 級別的完整 onboarding 文件（`SDD-AI協作開發模式介紹.md` / `使用說明.md` 等）—— 屬 Closeout C2 範圍
- R1-R6 既有機制的核心結構 —— 只擴充，不動核

**下一步**：R7 Implement 三 wave 全部完成；進入 **R7 實作品質審查**（Codex review，仿 R1-R6 pattern）

---

## 2026-04-24 — R7 Wave 2 實施：PROPOSAL-009 Feature 目錄化 + 多階段規格 + 新命令

**前置**：R7 Wave 1（PROPOSAL-011 Git Flow Decoupling）已完成（見下段 CHANGELOG）；R7 Review + Approve 處理 4 個 finding（accept-with-choice：F-01 Path A-3 / F-02 Path C / F-04 Path B；accept：F-03）
**Proposal**：`proposals/PROPOSAL-009-feature-directory-and-phases.md`（implemented）
**影響範圍**：

**結構 + 命名 + 範本（Sub-wave 9a）**
- 新增：`templates/_index.md`（雙版）—— feature 級 dashboard 六段範本（Metadata / 目標與範圍 / Phase Specs / Current BR Snapshot / 輕量修改紀錄 / 接續入口）+ 選用 Follow-up Tracking 段；含 Snapshot refresh 時機註解（new-phase / phase-spec 完成 / T2 lightweight 定稿）
- `git mv`：`templates/feature-spec.md` → `templates/phase-spec.md`（雙版）—— 在「業務規則」之後新增「Delta from prior phases」段（首 phase 免填 / phase 2+ 必填，沿用 P002/P004 ADDED/MODIFIED/REMOVED/RENAMED + 選用 UNCHANGED 格式）；範本 note 補充 phase-spec 語意 + phase 2+ 業務規則段只列新增/修改 BR
- 修改：`templates/lightweight-spec.md`（雙版）—— 範本內容不變，補充 Template note 明確對應 T2 ceremony、實例化檔位置（feature 目錄內，命名 `lightweight-{date}-{slug}.md` / `BUG-{NUMBER}-{slug}.md`）、定稿後 AI 須更新 `_index.md` 輕量修改紀錄 + Current BR Snapshot
- 修改：`SKILL.md`（雙版）—— Project Structure 範例改為目錄形式（`active/{SPEC-ID}-{slug}/` 含 `_index.md` / `phase-spec-*.md` / `lightweight-*.md`）；Ceremony Scaling 表重寫為三層（T1 Heavy / T2 Light / T3 Trivial）含 T3 四項判準 + Dflow 不走的底線；Templates 表加入 `_index.md` + `phase-spec.md`，移除 `feature-spec.md`；Phase 3 Spec Writing 引用更新

**新命令 + Flow（Sub-wave 9b）**
- 新增：`references/new-phase-flow.md`（雙版）—— `/dflow:new-phase` 五步流程（Step 1 Read context with active-only refusal / Step 2 Confirm scope / Step 3 Slug Confirmation / Step 4 Write phase-spec with Delta / Step 5 Refresh `_index.md` BR Snapshot + Phase Specs row + 接續入口）；嚴格只適用於 active feature，遇 completed 拒絕並導向 `/dflow:modify-existing` follow-up
- 新增：`references/finish-feature-flow.md`（雙版）—— `/dflow:finish-feature` 六步流程（Step 1 驗證 phase-specs + `_index.md` / Step 2 flip status / Step 3 同步 BR Snapshot 到 BC 層 `rules.md` / `behavior.md`，延續 Step 8.3 / 5.3 既有機制 / Step 4 `git mv` 整目錄到 `completed/` / Step 5 emit Integration Summary（**Git-strategy-neutral**，F-04 Path B）/ Step 6 反向更新舊 feature 的 Follow-up Tracking）；明確「AI 做 git mv + add，不 commit、不 merge、不 push」（風險 5 緩解）
- 修改：`SKILL.md`（雙版）—— Frontmatter Primary triggers 加入 `/dflow:new-phase` + `/dflow:finish-feature`；決策樹對應節點；Slash Commands 表加入「Phase commands」+「Closeout commands」兩個子分類；Reference Files 表加入兩新 flow
- 修改：`references/new-feature-flow.md`（雙版）—— Step 3 → Step 3.5 Phase Gate 新增；Step 3.5 Slug Confirmation（中英文 slug 範例各一份）；Step 4 改為「建 feature 目錄 + `_index.md`（含初始 BR Snapshot）+ 第一份 phase-spec（首 phase Delta 註明免填）」；Step 6 branch naming 補中英文範例；Step 8.4 archival 改為整目錄 `git mv` + 推薦多 phase feature 走 `/dflow:finish-feature`
- 修改：`references/modify-existing-flow.md`（雙版）—— Step 1 重寫為三層 Ceremony 判準表（Part A）+ feature 定位（Part B：active / completed / standalone）+ layer 識別（Part C，僅 Core 版）；新增 Step 1.5 Completed-Feature Reopen Detection（A/B/C 三選項，C 拒絕並導向 follow-up）；新增 Step 1.6 Create Follow-up Feature（新 SPEC-ID + `follow-up-of` + BR Snapshot baseline 從 `rules.md` 繼承 + 反向 Follow-up Tracking 同 commit）；Step 5.4 / 6.4 archival 改為 feature-level 不再搬單檔，整目錄交 `/dflow:finish-feature`

**既有文件同步（Sub-wave 9c）**
- 修改：`references/git-integration.md`（雙版）—— 新增完整「Directory Moves Must Use `git mv`」段（理由、6 種適用情境、commit message 提示、什麼不該做、驗證方式、CI hook 未來方向），取代 P011 留的 placeholder；Branch naming 加 Slug Language 子段（中英文 slug 都合法、Obts 實測背書、slug-shape guidance）；Gate Checks 路徑假設更新為 `active/{SPEC-ID}-{slug}/` 目錄形式（`_index.md` + 多 phase-spec），Pre-PR checklist 加入 BC 層同步 + `git mv` 驗證項
- 修改：`references/pr-review-checklist.md`（雙版）—— Step 0 重寫為「先讀 `_index.md` 取得 feature 全貌 → 識別 PR 觸及的 phase-spec / lightweight-spec / T3 inline 哪一類 → 全部讀過」；Spec Compliance 拆為「Per-feature checks」（含 `_index.md` 完整性 + follow-up 連結驗證）+「Per-phase-spec / lightweight-spec checks」（多份逐一檢查 + Delta integrity）+「If closeout commit」（BC 同步 + `git mv` rename detection + Integration Summary）
- 修改（輕量）：`references/drift-verification.md`（雙版）—— 新增「This command does NOT do (feature-directory aggregation — explicitly excluded)」明確段（F-03 決議：不擴張 scope 到跨 phase-spec 聚合，BR 現況聚合由 `_index.md` Snapshot 承擔）；新增「Path Assumptions (post-PROPOSAL-009)」段，明示 verify 不讀 feature 目錄；When to Run 加入「After `/dflow:finish-feature` lands」觸發點
- 修改：`templates/CLAUDE.md`（雙版）—— 「目錄結構」段 features 子樹改為目錄形式；「開發流程」段重寫為 Ceremony 三層 + 五個命令分節（new-feature / new-phase / modify-existing / bug-fix / finish-feature），明示 follow-up 規則與 BC 同步動作；「系統脈絡」段（P007c segmentation）保持不動

**繁中版同步**：延至 Post-Review Closeout C1（依 review-workflow.md §七）

**範圍外（嚴格遵守）**：
- 繁中版（`*-tw/`）—— 延到 Closeout C1
- PROPOSAL-010 scope（`scaffolding/`、`init-project-flow.md`、`CLAUDE-md-snippet.md`、`README.md`）—— 屬 R7 Wave 3
- P003 / P005 / P007 / P008 既有核心結構 —— 只更新引用 / 路徑，不改核心

**下一步**：R7 Wave 3（PROPOSAL-010 實施）—— 本 proposal 完成後，`/dflow:init-project` 可引用本輪定義的 `_index.md` 範本與 feature 目錄結構

---

## 2026-04-24 — R7 Wave 1 實施：PROPOSAL-011 Git Flow Decoupling

**前置**：R7 Review（Codex，2026-04-22 產出 `reviews/round-7-report.md`）+ R7 Approve（2026-04-22）處理 2 個 finding（accept-with-choice：F-04 Path B；accept：F-06）
**Proposal**：`proposals/PROPOSAL-011-git-flow-decoupling.md`（implemented）
**影響範圍**：
- 重命名：`references/git-flow-integration.md` → `references/git-integration.md`（雙版，**實際執行 `git mv`**；但因同 commit 內大幅內容重寫，git 預設 rename detection（`-M50`）無法識別為 rename，詳見下方 F-02 後記 —— R7 Implement Review F-02）
- 內容重構：`git-integration.md`（雙版）—— 移除 Git Flow 專屬段（develop/release/hotfix 分支圖、release checklist、hotfix expedited process、24h 補 spec）、保留 SDD ↔ Git 核心耦合（feature branch per feature、`git mv` 規範總則、Gate Checks、Commit Message Convention、CI/CD Future Enhancement）
- 修改：`SKILL.md`（雙版）—— references 表檔名更新 + 描述中立化、決策樹「I'm creating a branch」節點檔名引用更新、`/dflow:bug-fix` 語意澄清（不綁分支策略，雙處：決策樹 + Slash Commands 段）
- 修改：`drift-verification.md`(雙版)—— 移除「Before a release branch cut」觸發點；Purpose 段的「before a release」passing mention 同步中立化（當場移除 Git Flow 殘餘語句，符合 proposal § 5 指導）
- 修改：`templates/CLAUDE.md`（雙版）—— 「Git Flow」段標題改為「Git 整合」，加註「分支策略由專案決定，Dflow 不強制」，移除 `hotfix/` / `release/` 預設分支命名與 24h 補 spec 規則，新增「若採 Git Flow 可參考 scaffolding 範本」指引

**不在本輪 scope（已於 R7 Review F-06 verify 過現況無 Git Flow 字樣）**：
- `modify-existing-flow.md`（雙版）
- `pr-review-checklist.md`（雙版）

**繁中版同步**：延至 Post-Review Closeout C1（依 review-workflow.md §七）

**R7 Implement Review F-02 後記（2026-04-24）**：

Codex R7 Implement Review 指出本 commit（`bf5bb85`）在 `git diff-tree --summary` 預設（`-M50`）顯示為 delete+add 而非 rename。經 verify，**實際上有執行 `git mv`**，但此 commit 同時刪除 Git Flow 專屬內容並新增大量新內容，新舊檔相似度：WebForms 版 43%、Core 版 18%，低於 git 預設 rename detection 門檻（50%）。

查看 rename 軌跡的指令：
- WebForms：`git log --follow -M30 sdd-ddd-brownfield-skill/references/git-integration.md`
- Core：`git log --follow -M10 sdd-ddd-greenfield-skill/references/git-integration.md`

**教訓**：`git mv` **不等於** git 會自動把 commit 識別為 rename。當 rename 與大幅內容改寫發生在同一 commit 時，git 依新舊檔相似度判斷；若低於 `-M50` 預設門檻，會顯示為 delete+add。

**對未來大重寫的建議**（應納入 `git-integration.md` 的「Directory Moves Must Use git mv」段長期原則）：
1. 先用獨立 commit 執行純 `git mv`（不改內容）—— 這樣 git 100% 能識別為 rename
2. 再用後續 commit 進行內容改寫 —— rename 軌跡不受影響

**本輪採 Path B（保留歷史，更新 CHANGELOG 與 `git-integration.md` 頂部 file history note）**，不 rewrite commit history。理由：(a) Codex review report 以 `bf5bb85` 為對照 hash，改 history 會失去可追溯性；(b) Dflow 為方法論 repo，`git blame` 穿 rename 的實用價值有限；(c) 誠實記錄比修歷史更具教學價值。

**下一步**：R7 Wave 2（PROPOSAL-009 實施）—— 本 proposal 完成後，`git-integration.md` 基底穩定，009 可在其上擴增「Directory Moves Must Use git mv」完整段與 slug 語言段

---

## 2026-04-21 — Round 4 審查修正：Source of Truth 與漂移驗證（P003 + P008）

**關聯 Proposal**: P003, P008
**審查輪次**: R4
**對應決議文件**: `reviews/round-4-decisions.md`

### 修正項目

- **F-01 (Major)**: `/dflow:verify` 在 SKILL.md Slash Commands 段被歸類於 Control commands（manage an active workflow），但同條目又以括號註記「standalone, no active workflow needed」自相矛盾 → 新增第三類 `Standalone commands` 小節，將 `/dflow:verify [<bc>]` 從 Control commands 移出並移除原括號註記。
- **F-02 (Major)**: `drift-verification.md` Step 3 的 BR-ID 擷取規則將「section headings」與「body text」等值處理，違背 P008「對應情境段落」原意，會造成誤通過（body-text 提到就當 pass）與誤告警兩類雜訊 → Step 3 改為建立 primary set（scenario-bound，section headings 或 Given/When/Then 中的 BR-NNN marker）與 supplementary set（僅 body-text 提及）兩層；Step 4 三項檢查改以 primary set 為主要比對基礎，supplementary set 不能單獨滿足 forward / reverse 條件；Step 5 報告格式新增 ℹ 資訊狀態與區分失敗訊息（no scenario section for BR-NNN vs body-text only reference）。

### 影響檔案

- `sdd-ddd-brownfield-skill/SKILL.md`
- `sdd-ddd-greenfield-skill/SKILL.md`
- `sdd-ddd-brownfield-skill/references/drift-verification.md`
- `sdd-ddd-greenfield-skill/references/drift-verification.md`

### 繁中版同步狀態

延後至 Post-Review Closeout 階段統一處理（見 `proposals/review-workflow.md` 第七節）。

---

## 2026-04-20 — Round 2 審查修正：變更描述格式（P002 + P004）

**關聯 Proposal**: P002, P004
**審查輪次**: R2
**對應決議文件**: `reviews/round-2-decisions.md`

### 修正項目

- **F-01 (Major)**: 兩版 `references/new-feature-flow.md` Step 8.1 的「實作任務」驗證項未依 PROPOSAL-004 實施紀錄自述的「加入第一項」位置語放在清單首位（WebForms 版落第 5 項、Core 版落第 8 項） → 將該驗證項移到 Step 8.1 清單第 1 項，其餘項相對順序不動。

### 影響檔案

- `sdd-ddd-brownfield-skill/references/new-feature-flow.md`
- `sdd-ddd-greenfield-skill/references/new-feature-flow.md`

### 繁中版同步狀態

延後至 Post-Review Closeout 階段統一處理（見 `proposals/review-workflow.md` 第七節）。

---

## 2026-04-20 — Round 1 審查修正：流程入口與透明度（P001 + P007b）

**關聯 Proposal**: P001, P007b
**審查輪次**: R1
**對應決議文件**: `reviews/round-1-decisions.md`

### 修正項目

- **F-01 (Major)**: Core `SKILL.md` 的 `/dflow:status` Response Format 範例 Step 3 沿用 WebForms 版 `Domain Concept Discovery`，與 Core `references/new-feature-flow.md` 正式名稱 `Domain Modeling` 不一致 → 將範例中 Step 3 兩處（line 179 status line、line 186 in-progress checklist）改為 `Domain Modeling`，與 Core flow 檔對齊。

### 影響檔案

- `sdd-ddd-greenfield-skill/SKILL.md`

### 繁中版同步狀態

延後至 Post-Review Closeout 階段統一處理（見 `proposals/review-workflow.md` 第七節）。

---

## 2026-04-17 — Tutorial 同步 P001–P008：兩份 hybrid 教學文件更新

**關聯 Proposal**: 無（非 Proposal，為 P001 Hybrid 教學的 P002–P008 累積同步）

**目的**：`TUTORIAL_WEBFORMS_tw_hybrid.md` / `TUTORIAL_CORE_tw_hybrid.md` 兩份「情境帶領、身歷其境」的教學文件原本只反映 P001 Hybrid，P002–P008 完成後需同步，否則新人照著教學體驗不到新行為。

### 新增

- **WebForms 教學新增情境五：Brownfield 基準線補寫（P007a）**——以「請假單退回規則要改，但沒寫過 spec」的場景展示 B1–B4 四步（定位 → 抽取 → 結構化 → 確認），補完後接回 modify-existing-flow 用 Delta 記錄變更。
- **兩份教學在 Scenario 1 / 2 加入四層完成 checklist narrative**：5.1 / 8.1 AI 獨立跑、5.2 / 8.2 一題一題問、5.3 / 8.3 動文件（含 behavior.md B3/B4 子步驟）、5.4 / 8.4 歸檔（P005a / P005b）。
- **兩份教學 Scenario 2 spec 輸出加入 Phase markers 與 `實作任務` 段**（P004），Step 5 規劃後展示 `[LAYER]-[NUMBER]` 任務清單。
- **Core 教學 Scenario 2 spec frontmatter 加入 `ddd-modeling-depth`**（P006a），narrative 解釋輕 / 中 / 重三級與 PR Review 嚴格度的對應。
- **兩份教學 Scenario 2 結尾加入 `/dflow:verify` 執行示範**（P008），展示 drift 機械檢查回報格式。
- **WebForms 教學 Scenario 3 / Core 教學 Scenario 4（PR Review）加入 A+C 結構對齊檢查與 DDD Depth 嚴格度調整**（P003 / P006a / P007b）。

### 變更

- **兩份教學的 title 與 intro**：從「P001 實作後」改為「P001–P008 實作後」，並明示本文涵蓋的所有新特性。
- **兩份教學「原版 vs 新版」對照表**：加入 Delta 格式、A+C 結構、DDD Depth（Core 限定）、四層完成、verify、Brownfield（WebForms 限定）等新列。
- **兩份教學指令速查表**：加入 `/dflow:verify`；其餘指令的用途欄位補上新特性標註（Phase markers、Delta、Aggregate 邊界複檢、Step 0 Spec Intent）。
- **兩份教學 flow 圖**：Step 5 / Step 8 展開為四層子結構；Scenario 2 的 Step 4 標示含 Phase markers + 實作任務段。
- **Core 教學 Ceremony Scaling 表新增 `DDD Modeling Depth` 欄**（P006a），行數擴展到涵蓋「新 Aggregate」「跨 / 內 Aggregate 規則變更」「Domain 層 bug 修復」等更細的情境。
- **WebForms 教學 Ceremony Scaling 表新增 `格式` 欄**（feature-spec / Delta / Brownfield 基準線 / lightweight），與「要抽 Domain？」欄互補。
- **WebForms 教學目錄加入情境五的連結**。

### 設計判斷

- **教學文件不重寫 scenario，只添加新特性敘述**：為了保留原 P001 教學的情境故事性（使用者身歷其境），採「在既有情境裡插入新特性 narrative」而非另開 P002–P008 專屬情境。例外是 Brownfield（P007a）——因它改變整個進入流程，必須獨立成一個情境。
- **Core vs WebForms 差異保留**：DDD Modeling Depth 欄位僅 Core 教學呈現（P006a 本為 Core-only）；Brownfield 基準線補寫僅 WebForms 教學呈現（P007a 本為 WebForms-only）。

### 影響檔案

- `tutorial/TUTORIAL_WEBFORMS_tw_hybrid.md`
- `tutorial/TUTORIAL_CORE_tw_hybrid.md`

---

## 2026-04-17 — P005b 實施：完成流程 Checklist 補完 behavior.md + Tasks 分層項（Wave B 子集）

**關聯 Proposal**: `PROPOSAL-005b-completion-checklist-wave-b.md`（approved → implemented）

**Wave**: B（依賴 P003 + P004，兩者已於 Wave A / Wave B 先行實施）

### 新增

- **X.1 AI 可獨立驗證** 加入兩項標 `*(post-X.3)*` 的 post-merge 項（兩版 new-feature-flow Step 8、WebForms modify Step 6、Core modify Step 5）：
  - `behavior.md` 對本 spec 的每個 `BR-*` 有對應 section anchor（`/dflow:verify` 機械輸入）
  - `behavior.md` `last-updated` 晚於 spec `created` 日期（機械 drift 防線）
  - modify-existing 版特別提 REMOVED delta 的 anchor 刪除
- **X.2 需開發者確認** 加入兩題：
  - 合併進 `behavior.md` 的情境是否忠實表達預期行為（Core 版補 Aggregate 轉換 + Events）
  - 完成後 spec 的 `實作任務` 段要不要摺疊 / 移除（團隊慣例）
- **X.3 文件更新** 的 `behavior.md` bullet 擴充含兩個子步驟：
  - 把 Phase 3 draft 段落（B3 中途同步）轉為正式段落
  - 更新對應 `rules.md` anchor 的 `last-updated` 日期（B4）
- **X.3 新增 `behavior.md` 草稿清理 bullet**：中途放棄的 spec 要保留 `## 提案中變更` 段歷史或明確 REMOVE

### 變更

- **兩版 SKILL.md `Completion Checklist Execution` / `完成流程 Checklist 的執行方式` 子節**：
  - AI-independent 段落拆成「合併前」/「X.3 之後」兩類時機說明，讓 post-merge 項目的執行順序清晰。
  - Developer-confirmation 段落加入 P005b 的兩題。
  - 文件更新段落加入 `behavior.md` 合併的兩個子步驟（B3 / B4）與草稿清理指引。

### 設計判斷

- **8.1 放 post-merge 項還是另闢新段？** 選擇放回 8.1 用 `*(post-X.3)*` 標籤區分，避免 checklist 多一層結構。SKILL.md 描述段明確區分兩類時機。
- **B3 / B4 的前瞻性**：P003 實作時採精簡版，尚未正式建立「Phase 3 draft 段落」與「rules.md anchor last-updated」的機械結構。本次 checklist 引導語為前瞻性——後續補強這些結構時，文字無需再改。

### 影響檔案

EN（6 個）：兩版 new-feature-flow.md、兩版 modify-existing-flow.md、兩版 SKILL.md
TW（6 個）：兩版 new-feature-flow_tw.md、兩版 modify-existing-flow_tw.md、兩版 SKILL_tw.md

另：`proposals/PROPOSAL-005b-completion-checklist-wave-b.md`（status + 實施紀錄）

---

## 2026-04-17 — P008 實施：Drift Verification 指令（/dflow:verify）

**關聯 Proposal**: `PROPOSAL-008-drift-verification.md`（approved → implemented）

**前置依賴**: P003（A+C 結構），同日提前實施後解除封鎖。

### 新增

- **`references/drift-verification.md`（兩版）**：5 步驟驗證流程——找檔案 → 擷取 rules.md BR-ID → 擷取 behavior.md BR-ID → 交叉比對 → 回報。三項機械檢查：正向（rules→behavior）、anchor 有效性、反向（behavior→rules）。Core 版額外含 events.md 交叉引用警告。語意層明確排除（Wave D）。
- **`drift-verification_tw.md`（兩版）**：繁體中文翻譯。

### 變更

- **兩版 SKILL.md**：`/dflow:verify [<bc>]` 加入 description frontmatter、決策樹、Slash Commands 段、Reference Files 表格
- **兩版 SKILL_tw.md**：決策樹、Slash 指令段、參考文件表格同步新增 `/dflow:verify`

### 影響檔案

EN（4 個）：兩版 references/drift-verification.md（新增）、兩版 SKILL.md
TW（4 個）：兩版 drift-verification_tw.md（新增）、兩版 SKILL_tw.md

---

## 2026-04-17 — P003 實施：系統現狀 Source of Truth（behavior.md）

**關聯 Proposal**: `PROPOSAL-003-system-source-of-truth.md`（draft → implemented）

**原排程**: Wave B（等 Checkpoint A）。提前實施理由：用戶實際使用 OpenSpec 後確認「一覽行為全貌」是核心需求，不需等團隊回饋。

### 新增

- **`templates/behavior.md`（兩版）**：行為規格彙整模板。按功能區域組織、每個 BR-ID 一個 section 含 Given/When/Then。Core 版額外強調 Aggregate 狀態轉換和 Domain Events。
- **「Behavior Source of Truth」段（兩版 SKILL.md + SKILL_tw.md）**：說明 A+C 結構——`rules.md`（宣告式索引）+ `behavior.md`（情境式內容）——的分工與維護方式。對比 OpenSpec 的 `specs/` 目錄角色。
- **完成流程文件更新段加入 behavior.md**（四個 EN flow + 四個 TW flow）：new-feature-flow 完成時合併 spec 情境；modify-existing-flow 完成時依 Delta 結果更新（合併最終狀態，不保留 Delta 標記）。

### 變更

- **兩版 SKILL.md Project Structure**：`rules.md` 註解改為「BR-ID index」，新增 `behavior.md` 行
- **兩版 `templates/context-definition.md`**：關鍵業務規則段提及 rules.md + behavior.md 分工
- **兩版 SKILL.md Templates 表格**：新增 `behavior.md` 條目

### 影響檔案

EN（12 個）：兩版 templates/behavior.md（新增）、兩版 SKILL.md、四個 flow 檔案、兩版 templates/context-definition.md

TW（6 個）：兩版 SKILL_tw.md、四個 flow TW 檔案

---

## 2026-04-17 — Wave C 實施：P006a / P007a / P007c

**關聯 Proposal**: `PROPOSAL-006a-ddd-depth-column.md`、`PROPOSAL-007a-brownfield-reverse-documentation.md`、`PROPOSAL-007c-claude-md-segmentation.md`（全部 approved → implemented）

**Wave**: C（獨立微調，無前置依賴）

**備註**: P008（`/dflow:verify` drift 驗證）排程為 Wave C 但依賴 P003（A+C 結構，Wave B），本次未實施。

### P006a — Ceremony Scaling 加入 DDD 建模深度欄

- Core 版 `SKILL.md` Ceremony Scaling 表格欄位 `DDD Modeling` → `DDD Modeling Depth`
- 四級深度定義：Full（Aggregate 設計 + Events + Context Map）/ Standard（確認歸屬 + 更新 models/rules）/ Lightweight（確認正確的層）/ Skip
- 「New feature」拆為「New Aggregate / BC」（Full）和「New feature (within existing BC)」（Standard）
- 繁中版同步更新

### P007a — Brownfield 系統性逆向文件化

- WebForms 版 `modify-existing-flow.md` Step 2 新增「Systematic Baseline Capture」子段
- 5 步機會主義掃描指引：讀相關 Code-Behind → 提取業務規則 → 識別領域概念 → 檢查重複邏輯 → 記錄到 domain docs + tech-debt
- 範圍限定在被修改功能和鄰近頁面，不做完整 codebase 掃描
- 繁中版同步更新

### P007c — CLAUDE.md 標題分段強化

- 兩版 `templates/CLAUDE.md` 重構為兩大區塊：
  - `## 系統脈絡（What is this system?）` — 背景、架構、目錄結構
  - `## 開發流程（How do we work?）` — SDD 流程、Git Flow、Domain 規範、AI 協作
- 模板為 AI 使用（英文），無需繁中同步

### 影響檔案

- `sdd-ddd-greenfield-skill/SKILL.md`（P006a）
- `sdd-ddd-greenfield-skill-tw/SKILL_tw.md`（P006a 繁中）
- `sdd-ddd-brownfield-skill/references/modify-existing-flow.md`（P007a）
- `sdd-ddd-brownfield-skill-tw/modify-existing-flow_tw.md`（P007a 繁中）
- `sdd-ddd-brownfield-skill/templates/CLAUDE.md`（P007c）
- `sdd-ddd-greenfield-skill/templates/CLAUDE.md`（P007c）
- `proposals/PROPOSAL-006a-ddd-depth-column.md`（status + 實施紀錄）
- `proposals/PROPOSAL-007a-brownfield-reverse-documentation.md`（status + 實施紀錄）
- `proposals/PROPOSAL-007c-claude-md-segmentation.md`（status + 實施紀錄）

---

## 2026-04-17 — 繁體中文版同步 Wave A 全部變更（P001 / P002 / P004 / P005a / P007b）

**關聯 Proposal**: Wave A 全部（P001、P002、P004、P005a、P007b）

### 同步內容

將 Wave A 實施的所有英文版變更同步到繁體中文版（`sdd-ddd-brownfield-skill-tw/` 和 `sdd-ddd-greenfield-skill-tw/`），包括：

- **P001**：決策樹改為雙軌（/dflow: 指令 + NL 安全網）；新增完整「工作流程透明度」章節（三層透明度、Phase Gate 位置、確認訊號、/dflow:status 格式）
- **P002**：modify-existing-flow 的 Step 2 改用 Delta 格式（ADDED / MODIFIED / REMOVED / RENAMED + 可選 UNCHANGED）
- **P004**：SKILL 引導問題加 Phase 標記說明；new-feature-flow / modify-existing-flow 加「產生實作任務清單」子段
- **P005a**：new-feature-flow Step 8 / modify-existing-flow 最終 Step 改為四段分層 Completion Checklist（X.1 AI 驗證 / X.2 開發者確認 / X.3 文件更新 / X.4 歸檔）；SKILL 加「完成流程 Checklist 的執行方式」子段
- **P007b**：pr-review-checklist 開頭加 Step 0（理解變更意圖）
- **所有 flow 檔案**加 Phase Gate / step-internal 轉換標記

### 影響檔案（8 個）

- `sdd-ddd-brownfield-skill-tw/SKILL_tw.md`
- `sdd-ddd-brownfield-skill-tw/new-feature-flow_tw.md`
- `sdd-ddd-brownfield-skill-tw/modify-existing-flow_tw.md`
- `sdd-ddd-brownfield-skill-tw/pr-review-checklist_tw.md`
- `sdd-ddd-greenfield-skill-tw/SKILL_tw.md`
- `sdd-ddd-greenfield-skill-tw/new-feature-flow_tw.md`
- `sdd-ddd-greenfield-skill-tw/modify-existing-flow_tw.md`
- `sdd-ddd-greenfield-skill-tw/pr-review-checklist_tw.md`

---

## 2026-04-16 — P007b 實施：PR Review Step 0（Spec Intent）

**關聯 Proposal**: `PROPOSAL-007b-pr-review-spec-intent.md`（approved → implemented）

**Wave**: A（D1 優先級從 Wave C 提前至 Wave A，理由：完成 SDD 回饋迴路）

### 新增

- **PR Review Step 0**（兩版 pr-review-checklist.md 開頭）：`/dflow:pr-review` 進入時第一步。四項 checkbox：讀 spec / 讀 Delta（含 RENAMED、可選 UNCHANGED）/ 用一句話陳述 PR 意圖 / 然後才進入 code review。
- **無 spec 的引導話術**：要求 PR author 提供 spec 位置或先開 lightweight-spec。
- **Core 版額外檢查**：若 `behavior.md` 存在，交叉確認 Delta 是否已反映（B3 中途同步 review 閘門）；特別留意 Delta 中的 Aggregate 狀態轉換與 Domain Events。

### 為什麼 D1 提前

原排程放 Wave C 是工作量導向判斷失誤。真正價值在於：沒有 Step 0，reviewer 不會先看 spec，前面所有規格工作（Delta、behavior.md、tasks）就失去驗證機制。SDD 流程的回饋迴路必須由 Step 0 收合。

### 影響檔案

- `sdd-ddd-brownfield-skill/references/pr-review-checklist.md`
- `sdd-ddd-greenfield-skill/references/pr-review-checklist.md`
- `proposals/PROPOSAL-007b-pr-review-spec-intent.md`（status + 實施紀錄）

### 繁中版同步狀態

- 已同步（2026-04-17）— 見「繁體中文版同步 Wave A 全部變更」entry。

---

## 2026-04-16 — P005a 實施：完成流程分層 Checklist（Wave A 子集）

**關聯 Proposal**: `PROPOSAL-005a-completion-checklist-wave-a.md`（approved → implemented）；`PROPOSAL-005-completion-flow.md` 同步改為 `superseded`，新增 `PROPOSAL-005b-completion-checklist-wave-b.md`（approved，Wave B，暫不實施）。

**Wave**: A

### 拆分決定

原 P005 依賴 P003 / P004，整體排到 Wave B。評估後發現其中「Domain 純淨度、Given/When/Then 覆蓋、文件更新、歸檔」這些項目不依賴 P003/P004，先行實施可建立驗證文化。拆為 P005a（Wave A，本次實施）+ P005b（Wave B，等 P003/P004 穩定後補上 behavior.md 轉正式 + Tasks 勾選整併）。

### 新增

- **四段分層 Completion Checklist**（兩版 new-feature-flow.md Step 8、modify-existing-flow WebForms Step 6 / Core Step 5）：
  - `X.1 AI-independent verification`：BR/EC/Given-When-Then 覆蓋、Domain 純淨度（無 `System.Web` / 無外部 NuGet）、Tasks 狀態；Core 版補 Aggregate invariants、Domain Events raised、EF Fluent API only。
  - `X.2 Developer-confirmation verification`：AI 一次問一項，不 dump；涵蓋意圖一致性、Aggregate boundary、Domain Event placements、tech-debt 補漏。
  - `X.3 Documentation updates`：glossary / models / rules / events / context-map / tech-debt。
  - `X.4 Archival`：`status` → `completed`、檔案移到 `completed/`。
- **Completion Checklist Execution 子節**（兩版 SKILL.md）：明定 Phase Gate 是唯一觸發點、執行順序嚴格為 X.1 → X.4、AI-independent 一次報完 ✓/✗、Developer-confirmation 一次問一項；若開發者跳過 Phase Gate 直接 commit，auto-trigger 安全網須攔截並引導跑 checklist。

### 重要簡化

取消原提案的「自然語言完成信號偵測」。直接用 P001 `/dflow:next` Phase Gate 作為觸發點，理由：精準、開發者控制感強、免維護信號詞表。

### 新增 Proposal 檔

- `PROPOSAL-005a-completion-checklist-wave-a.md`（本次實施）
- `PROPOSAL-005b-completion-checklist-wave-b.md`（Wave B，尚未實施）
- `PROPOSAL-005-completion-flow.md` 狀態改為 `superseded`，`superseded-by` 指向 P005a + P005b

### 影響檔案

- `sdd-ddd-brownfield-skill/references/new-feature-flow.md`
- `sdd-ddd-greenfield-skill/references/new-feature-flow.md`
- `sdd-ddd-brownfield-skill/references/modify-existing-flow.md`
- `sdd-ddd-greenfield-skill/references/modify-existing-flow.md`
- `sdd-ddd-brownfield-skill/SKILL.md`
- `sdd-ddd-greenfield-skill/SKILL.md`
- `proposals/PROPOSAL-005-completion-flow.md`
- `proposals/PROPOSAL-005a-completion-checklist-wave-a.md`（新檔）
- `proposals/PROPOSAL-005b-completion-checklist-wave-b.md`（新檔）

### 繁中版同步狀態

- 已同步（2026-04-17）— 見「繁體中文版同步 Wave A 全部變更」entry。

---

## 2026-04-16 — P002 實施：Delta Spec 變更描述格式（含 RENAMED + UNCHANGED）

**關聯 Proposal**: `PROPOSAL-002-delta-spec-format.md`（approved → implemented）

**Wave**: A

### 新增

- **Delta Spec 格式**（兩版 modify-existing-flow.md Step 2）：ADDED / MODIFIED / REMOVED / RENAMED 四種變更操作 + 可選的 UNCHANGED 段落，取代原本自由文字的 Current Behavior / Changed Behavior 對照。
  - `MODIFIED` 必填「原本 / 改為」對照。
  - `RENAMED`（B1 追加）：brownfield 常見的業務概念改名（「簽核」→「審批」等）。
  - `UNCHANGED`（B2 追加）：建議但非必填；regression 風險高時主動填。
  - Core 版的 Delta 格式包含 Aggregate 狀態轉換與 Domain Events，讓 `/dflow:pr-review` Step 0 能讀出語義。
- **lightweight-spec Delta 精簡版**（兩版）：原「現有行為 / 預期行為」改為單一 MODIFIED 條目，保留「原本 / 改為 / 原因」結構；若需要其他 delta 類型指引開發者參考 modify-existing-flow.md。

### 重要澄清（寫入 PROPOSAL-002）

Delta 標記**僅用於變更 spec**，不累積到 P003 的 `behavior.md`（consolidated source of truth）。behavior.md 讀取 delta 後 merge 成當前真相，不保留歷史軌跡（git 已覆蓋）。

### 影響檔案

- `sdd-ddd-brownfield-skill/references/modify-existing-flow.md`
- `sdd-ddd-greenfield-skill/references/modify-existing-flow.md`
- `sdd-ddd-brownfield-skill/templates/lightweight-spec.md`
- `sdd-ddd-greenfield-skill/templates/lightweight-spec.md`
- `proposals/PROPOSAL-002-delta-spec-format.md`（status + B1/B2 追加 + 評估紀錄）

### 繁中版同步狀態

- 已同步（2026-04-17）— 見「繁體中文版同步 Wave A 全部變更」entry。

---

## 2026-04-16 — P004 實施：Spec 模板 Phase 標記 + 實作任務清單（精簡版）

**關聯 Proposal**: `PROPOSAL-004-spec-template-restructure.md`（approved → implemented，精簡版）

**Wave**: A

### 精簡化決定

原方案要求將 feature-spec 模板重構為顯式五段式章節。評估後採精簡版：保留既有段落結構不動，改用 HTML comment phase 標記 + 新增實作任務段落。理由：既有 spec 不需要破壞性遷移；Phase 歸屬可以機讀但對人不干擾。

### 新增

- **HTML comment phase 標記**（兩版 feature-spec.md）：每個段落 heading 行尾加 `<!-- 填寫時機：Phase N -->`，對應 SKILL.md § Guiding Questions by Phase。模板頂部加 template note 區塊說明用途。
- **實作任務段落**（兩版 feature-spec.md）：
  - WebForms 分類 `DOMAIN / PAGE / DATA / TEST`
  - Core 分類對應 Clean Architecture `DOMAIN / APP / INFRA / API / TEST`，標註建議產出順序 `DOMAIN → APP → INFRA → API`
- **Tasks 產生指引**（new-feature-flow Step 5、modify-existing-flow WebForms Step 4 / Core Step 3）：規定 AI 在計畫定稿後把 task 清單寫入 spec，提供格式與範例。
- **Tasks 驗證項**（new-feature-flow Step 8、modify-existing-flow WebForms Step 6 / Core Step 5）：完成時驗證實作任務段全部勾選，或未勾選項明確標註 follow-up。

### 變更

- **SKILL.md § Guiding Questions by Phase**（兩版）：段首補上 HTML comment 標記約定說明，指向「實作任務」段由哪個 flow step 產生。
- modify-existing-flow 中的 tasks 產生限定為「使用完整 feature-spec 時才產生」，bug-fix lightweight-spec 模式跳過。

### 影響檔案

- `sdd-ddd-brownfield-skill/templates/feature-spec.md`
- `sdd-ddd-greenfield-skill/templates/feature-spec.md`
- `sdd-ddd-brownfield-skill/references/new-feature-flow.md`
- `sdd-ddd-greenfield-skill/references/new-feature-flow.md`
- `sdd-ddd-brownfield-skill/references/modify-existing-flow.md`
- `sdd-ddd-greenfield-skill/references/modify-existing-flow.md`
- `sdd-ddd-brownfield-skill/SKILL.md`
- `sdd-ddd-greenfield-skill/SKILL.md`

### 繁中版同步狀態

- 已同步（2026-04-17）— 見「繁體中文版同步 Wave A 全部變更」entry。

---

## 2026-04-16 — P001 實施：指令化入口 + 流程透明化（Hybrid）

**關聯 Proposal**: `PROPOSAL-001-workflow-transparency.md`（approved → implemented）

**Wave**: A

### 新增

- **`/dflow:` slash command 族**：`/dflow:new-feature`、`/dflow:modify-existing`、`/dflow:bug-fix`、`/dflow:pr-review`、`/dflow:status`、`/dflow:next`、`/dflow:cancel`
- **Workflow Transparency 章節**（兩版 SKILL.md）：涵蓋 Slash Commands 定義、Auto-Trigger Safety Net 規則、Three-Tier Transparency（Flow entry / Phase gate / Step-internal）、Confirmation Signals（NL ↔ command 等價）、`/dflow:status` 回應格式
- **Phase Gate markers**（兩版 new-feature-flow.md + modify-existing-flow.md）：每個 step 邊界標註為 Phase Gate 或 step-internal，Phase Gate 處有具體發話內容 + wait for confirmation 規則

### 變更

- **description 欄位**（兩版 SKILL.md）：從單純 NL 觸發改為 PRIMARY（/dflow: commands）+ SECONDARY（NL 安全網，判斷後等確認、不自動前進）
- **Decision Tree**（兩版 SKILL.md）：重寫為「/dflow: 命令 → 直接路由；NL → 判斷後等確認」雙軌結構
- **modify-existing-flow 的 `/dflow:bug-fix` 說明**：兩版在頂部明確寫出 bug-fix 模式下的 ceremony 調整（用 lightweight-spec、預設 defer 抽離/DDD 影響判斷）

### 實施期發現的結構差異

- Core 版 modify-existing-flow 實際為 5 步（非原 P001 假設的 6 步），Phase Gate 位置對應調整為 2→3 / 3→4 / 4→5。兩版 SKILL.md 的 Workflow Transparency 段落分別列出各自的 Phase Gate 位置。

### 影響檔案

- `sdd-ddd-brownfield-skill/SKILL.md`
- `sdd-ddd-brownfield-skill/references/new-feature-flow.md`
- `sdd-ddd-brownfield-skill/references/modify-existing-flow.md`
- `sdd-ddd-greenfield-skill/SKILL.md`
- `sdd-ddd-greenfield-skill/references/new-feature-flow.md`
- `sdd-ddd-greenfield-skill/references/modify-existing-flow.md`

### 繁中版同步狀態

- 已同步（2026-04-17）— 見「繁體中文版同步 Wave A 全部變更」entry。
