# The Inbox page

What `page/inbox.html` does, for the one who builds it.

- The page is the signed Inbox, sheet 8 of comchatx `spikes/inbox-wide` (signed 2026-11-18). Cards stand in this order: cx's newest card marked `reply: true`, its answer to the seller's last message; then the cards in columns by the seller's two presses, 分组 / Grouping (type, urgency or date) and 排序 / Ordering (the two ways not grouped by). The default is by type, urgency inside, then the newest file. By type a column stands only where both kinds wait; by urgency or date every column stands, three side by side from 63rem.
- The presses are drawn where two cards or more can change places, at the head of the page at every width; with none or one card there are no presses and no columns. The pair picked is written to `inbox.json` in the tab, `{"by":…,"in":…}`, and read beside the first read; a tab without it, or one it cannot read, has the default.
- 已处理 / Done stands in columns by the same two presses, a card's mark, what was done and the day at its foot, its older weeks folded in each column. The title search is kept.
- A card's `level` (1, 2 or 3; absent is 1) draws three bars, as many in ink as the level; its small card is the level's name, under the pointer and the keyboard's focus as the kit's label is, and Escape takes it away.
- A card with `questions` (the platform's `comchatx.options/1` or `comchatx.confirm/1`, as JSON) is drawn by the kit's `Kit.questions`, one element a card for as long as it waits in one language, so a draw keeps the picks. Its answer is sent as any answer is, `board.send(words, { card })`, and written as `done: answered`, `answer` (the words sent) and `answers` (the platform's `OptionAnswers` or `{ form, confirmed }`, as JSON). × dismisses the whole card; with every question skipped the card is dismissed and nothing is sent.
- The page draws a read once it is whole: until the first read is whole it draws nothing and sets no count, and while it reads again it keeps every card it holds and the count it set. A board's 重新加载 makes a new page, so its first read draws nothing until it is whole.
- Two lines stand in for words the copy seat has not yet written: 已处理's column heads by type, 提问 / Questions and 通知 / Notices (`W.kinds`).
- A tab of more than 32 cards is read in parts: when the board says the page asks too often, the page waits a second and reads on.
- Marking a card reads its file and writes it back with the marks. Words written to it between that read and the write are lost.
- The page changes only `done`, `doneAt`, `answer` and `answers` in a card's front matter, and writes `inbox.json`. It writes the file with LF line ends and plain `---` fences, without a BOM.
