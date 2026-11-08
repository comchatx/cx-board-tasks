# Changelog

- 0.2.0: the module owns every state of the board: the places `todo/` and `done/`, 已读 and 忽略, and the history, all taken from `@comchatx/cx-board` 0.3.0, which keeps the directory alone. A question cx can ask now is asked in the turn; an entry is for a question that has to wait. `todo/` is the seller's, not cx's list of steps. The module lives in a tab of its own, the directory `待办`, and its places, kinds and answers are only there.
- 0.1.1: the README in Chinese, `README.zh-CN.md`, which the Plugins page draws as the Overview in Chinese.
- 0.1.0: the kinds, the places, the answers and Send to cx, taken from `@comchatx/cx-board` 0.1.2 when the board kept its base alone; one fact added, that a question which has to wait for the seller can be a choice or an input entry, its answer coming back as a chat message.
