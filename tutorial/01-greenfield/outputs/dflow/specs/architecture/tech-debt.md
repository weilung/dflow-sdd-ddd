<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Architecture Tech Debt

> Architecture debt backlog discovered during SDD/DDD work on ExpenseTracker.

## Debt Items

| Item | Layer | Decision / debt | Impact | Follow-up | Status |
|---|---|---|---|---|---|
| Unicode i18n 下的字元計數策略 | Domain / Presentation | 2026-05-04 由 BUG-001 回報。Reject reason bug 暴露出使用者可見的長度限制目前還沒有共用的字元計數策略。 | 範圍：`ApprovalReason` VO 與未來任何使用者可見的長度限制。風險：UI counter、API payload 與 Domain validation 對 emoji、組合字元、全形形式或 malformed Unicode 可能得出不一致結果。 | 建議做法：評估 grapheme cluster、codepoint、UTF-16 unit 三種語意；標準化共用 helper；Presentation 可用時使用 `Intl.Segmenter`，並評估 Domain 端計數的 ICU library 支援。優先度：medium。Blocked-by：none。 | open |

## Follow-up Notes

- related-feature: SPEC-20260428-001（2026-05-07 完成）
- BUG-001 只修 reject reason truncation 與 Domain malformed-input handling。更廣泛的 i18n 字元計數 policy 應該作為獨立 architecture review 處理，不要擴張到這次 T2 bug-fix 裡。
