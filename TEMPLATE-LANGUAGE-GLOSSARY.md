<!-- Maintenance contract for Dflow. See proposals/PROPOSAL-013 §1.1 for origin. -->

# Template Language Glossary

This file is a human reading aid and review reference for Dflow template terminology. It is not a second template set.

Template headings, field labels, anchors, and placeholder names use canonical English. Free prose inside those sections follows the project `Prose Language` convention.

## Inclusion Criteria

A term is included in this glossary when it meets **any** of these:

1. **Cross-file structural term** — appears as a heading / column / inline label in two or more templates (e.g. `Implementation Tasks`, `Business Rules`).
2. **Translation-sensitive concept** — direct Chinese translation may lose precision or differ from common usage (e.g. `Behavior Delta` vs 「行為變更」, `Resume Pointer` vs 「接續入口」).
3. **Workflow-critical inline label** — bold inline labels that AI / tooling reads as fixed fields within a section (e.g. `**Before** / **After** / **Reason**`).
4. **Commit message convention label** — labels used in Integration Commit Message Conventions (e.g. `Feature Goal`, `Change Scope`, `Phase Count`).

A term is **NOT** included when:

- The English heading is self-explanatory and its Chinese translation is unambiguous (e.g. `Open Questions`, `Edge Cases`, `Test Strategy`, `Implementation Notes`, `Goals & Scope`, `Phase Specs`, `Problem`, `Root Cause`, `Fix Approach`, `Tech Debt Discovered`).
- It only appears once in a single template as a section heading without cross-file reference.
- It is a placeholder example (e.g. `{one-line summary}`) rather than a structural term.

The "使用位置" column refers to file paths where the term appears structurally (as heading / column / label), not necessarily a specific section. For example, `Domain Models` appears as the H1 of `models.md`, representing the file's central concept; `Implementation Tasks` appears as an H2 in two different templates.

## Glossary

| English term | 繁體中文對照 | 使用位置 | 說明 |
|---|---|---|---|
| Implementation Tasks | 實作任務 | `phase-spec.md`, `lightweight-spec.md` | AI 產生與追蹤 task checklist 的段落 |
| Behavior Scenarios | 行為情境 | `phase-spec.md`, `behavior.md` | Given/When/Then 行為規格 |
| Business Rules | 業務規則 | `rules.md`, `_index.md` | BR-ID declarative rules |
| Current BR Snapshot | 目前業務規則快照 | `_index.md` | feature-level rules snapshot |
| Domain Models | 領域模型 | `models.md` | Entities / Value Objects / Services 等模型索引 |
| Change Scope | 變動範圍 | `Git-principles-*.md`, spec templates | 描述本次變更涵蓋的功能 / 文件 / 程式碼範圍 |
| Feature Goal | 功能目標 | `Git-principles-*.md`, `finish-feature-flow.md` | Integration Summary 與整合 commit message 的主目標段落 |
| Related BR-IDs | 關聯 BR-ID 清單 | `Git-principles-*.md`, `finish-feature-flow.md` | 統整本次變更涉及的 ADDED / MODIFIED / REMOVED BR-ID |
| Phase Count | Phase 數 | `Git-principles-*.md`, `finish-feature-flow.md` | 整合摘要中描述本次 feature 涵蓋的 phase-spec 數量 |
| Lightweight Change | 輕量修改 | `_index.md`, `lightweight-spec.md`, Git principles | T2 / small change 類型的固定術語 |
| Lightweight Changes | 輕量修改紀錄 | `_index.md` | `_index.md` 中登記 T2 外連 + T3 inline 的 section heading |
| Resume Pointer | 接續入口 | `_index.md` | `_index.md` 末段「目前進展 + 下一動作」的 section heading |
| Behavior Delta | 行為變更 | `lightweight-spec.md` | lightweight-spec 中 BR delta 段的 section heading |
| Current Progress | 目前進展 | `_index.md` | Resume Pointer 段內描述當下狀態的 inline bold label（per F-04 / DD-A Path A）|
| Next Action | 下一個動作 | `_index.md` | Resume Pointer 段內描述下一動作的 inline bold label（per F-04 / DD-A Path A）|
| Before | 原本 | `lightweight-spec.md`, `phase-spec.md`, `references/modify-existing-flow.md` | Behavior Delta MODIFIED 段內描述變更前狀態的 inline bold label（per F-08 / DD-A Path A）|
| After | 改為 | `lightweight-spec.md`, `phase-spec.md`, `references/modify-existing-flow.md` | Behavior Delta MODIFIED 段內描述變更後狀態的 inline bold label（per F-08 / DD-A Path A）|
| Reason | 原因 | `lightweight-spec.md`, `phase-spec.md`, `references/modify-existing-flow.md` | Behavior Delta 段內描述變更原因的 inline bold label（per F-08 / DD-A Path A）|
| Prose Language | prose 語言 / 自由文字語言 | `dflow/specs/shared/_conventions.md`, init flow, prose-generating references | 專案層級設定，規範 AI 生成自由 prose 時使用的 explicit BCP-47 language tag，例如 `zh-TW` 或 `en` |
| Free prose | 自由 prose / 自由文字 | Templates, generated specs, workflow references | 由使用者或 AI 撰寫的段落內容，例如 task 描述、Root Cause、Fix Approach、Open Questions；遵循專案 `Prose Language` |
| Structural language | 結構性語言 | Templates, generated specs, `TEMPLATE-COVERAGE.md` | 固定文件結構語言，例如 headings、table headers、labels、placeholders、IDs、anchors；Dflow 保持 canonical English |
| Canonical English | 標準英文結構 | Templates, scaffolding, generated specs | Dflow 固定使用的英文結構詞彙，用於穩定 AI 導航、anchor 定位與跨檔維護 |
| Code-facing terms | 面向程式碼的術語 | Templates, generated specs, `_conventions.md` | 不應只為符合 prose 語言而翻譯的內容，例如 code identifiers、DDD pattern names、BR IDs、SPEC IDs、file paths、branch names、anchors、inline code |
