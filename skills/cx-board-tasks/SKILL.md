---
name: cx-board-tasks
description: The seller's Inbox on the board, where you leave what you found, changed, propose and ask, as cards the seller marks as read or answers. With this plugin the seller reads what you have for them in the Inbox; your answer to what they asked, a small one too, a finding, a change you made, a proposal or a question is a card there, and the chat shows the card by its title and where it stands, with no copy of its words.
---

The Inbox is a tab of the board the `cx-board` skill describes: the directory `待办` under the board, which the seller sees named 收件箱 / Inbox.

## Where the seller reads

The seller reads each card on its own, later, without the chat beside it, so a card holds all they need of it. In the chat they see the card's row, its title and where it stands, and press it to read the card. What you do on the way, your steps, is the chat's and not a card. A question for the seller can be a card: the seller answers it when they come to the Inbox, and your turn does not wait on it.

## A card

A card is a Markdown file anywhere under `待办/`, named as the `cx-board` skill says. It opens with front matter, then your words for the seller. The Inbox draws them as your answers in the chat are drawn: bold, lists, tables, code and links, any HTML in them shown as text, and no image; a link in a card opens nothing. On a board that cannot draw them so, they stand as plain paragraphs, the marks of formatting printed as typed:

```markdown
---
title: Lower the price of the blue kettle to $24.99?
asks: true
---

It sells **6 a day** and 40 are left:

- at $24.99, about 7 days of stock
- at $26.99, about 9 days
```

- `title` is the one line the seller reads first. Without it, the card's first heading is its title.
- `asks: true` makes the card one that asks: the seller answers it in a field on the card, in their own words. A card without it tells, and the seller ticks it 已读 / Mark as read.
- The seller may dismiss a card that asks, 忽略 / Dismiss.
- `reply: true` makes the card your answer to the seller's last message: the Inbox shows the newest such card first.
- Then the cards that ask, then those that tell, each part newest first by the file's time. The seller reads each card on its own.
- A card does not hold your turn. You go on, and the seller answers when they come to it.
- When a new card lands, the Inbox asks for the board to be shown: the column opens on the Inbox, waits while the seller is typing where it would cover the chat, and stays shut once the seller has closed what such an ask opened.

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
