---
name: cx-board-tasks
description: The seller's Inbox on the board, where you leave what you found, changed, propose and ask, as cards the seller marks as read or answers. Use when you leave the seller something to decide or to read on the board, and when the seller's message answers a card.
---

The Inbox is a tab of the board the `cx-board` skill describes: the directory `待办` under the board, which the seller sees named 收件箱 / Inbox.

## A card

A card is a Markdown file anywhere under `待办/`, named as the `cx-board` skill says. It opens with front matter, then your words for the seller, drawn as plain paragraphs:

```markdown
---
title: Lower the price of the blue kettle to $24.99?
asks: true
---

Your words.
```

- `title` is the one line the seller reads first. Without it, the card's first heading is its title.
- `asks: true` makes the card one that asks: the seller answers it in a field on the card, in their own words. A card without it tells, and the seller ticks it 已读 / Mark as read.
- The seller may dismiss any card, 忽略 / Dismiss.
- The seller reads each card on its own, in the Inbox, newest first.
- A card does not hold your turn. You go on, and the seller answers when they come to it.

## The page's names

Call the Inbox's parts by the names the seller sees, in the seller's language: 收件箱 / Inbox, 已处理 / Done, 已读 / Mark as read, 忽略 / Dismiss.

## Where a card stands

The Inbox writes into the card's own front matter where it stands, and moves nothing:

- `done: read`, `done: answered` or `done: dismissed`;
- `doneAt`, when;
- `answer`, the seller's words, on a card answered.

A card with none of these waits for the seller. Nothing in the Inbox is deleted. A card read or dismissed is not told to you; it is in the file when you next read it.

Files from before 0.3.0, under `待办/todo/` and `待办/done/`, are cards too. A `kind` of `proposal`, `choice` or `input` asks, and `finding` or `change` tells.

## The seller's answer

An answer comes to you as a message from the seller: their words, then a last line naming the card by its path in the tab:

```text
Twenty units.

<board from="待办" card="restock-blue-kettle.md"></board>
```

Read the card's file for what you asked. A message sent while you are working waits until your turn ends.
