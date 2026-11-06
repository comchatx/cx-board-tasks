---
name: cx-board-tasks
description: The to-do and question module of the seller's board, where you leave what you found, changed, propose and ask, as entries the seller marks or answers. Use when you leave the seller an entry with a kind, when a question has to wait for the seller, and when the seller's message answers entries on the board.
---

This module draws on the board the `cx-board` skill describes, in a tab of its own: the directory `待办` under the board. Without it every file is a card of a title and words, and nothing more; with it the tab has two places, `待办/todo/` for what waits for the seller and `待办/done/` for what the seller has done with, an entry's front matter gives it a kind, the seller marks what is to read and answers what asks, and the column opens beside the chat by itself when a turn of yours leaves a new file.

`todo/` holds what waits for the seller. It is not your own list of steps: keep that in the chat, or with a tool for it if one is installed.

## An entry

An entry is a file under `待办/todo/`, named as the `cx-board` skill says. It opens with front matter, then your words for the seller, drawn as your answers in the chat are:

```markdown
---
kind: proposal
title: Lower the price of the blue kettle to $24.99
at: 2026-10-27T02:14:00Z
---

Your words.
```

- `kind` is one of five:
  - `finding`: something you found. The seller reads it.
  - `change`: a change you already made. The seller reads it.
  - `proposal`: something you would do, and have not done. The seller may agree.
  - `choice`: a question with options. Add `options:`, then one `- option` line each, at most twelve, each one line.
  - `input`: a question the seller answers in words. Add `hint:`, one line shown in the empty field.
- `title` is the one line the seller reads first.
- `at` is when you wrote it, in ISO 8601 with its offset.

A file without these three, or with another kind, is drawn as the base draws one: its heading or its name, and its words.

A question you can ask now, ask in your turn: in your reply, or with a tool that asks the seller if one is installed, which the seller answers on a card in the chat. A question that has to wait for the seller's answer can be written as a `choice` or an `input` entry on the board: you end your turn and go on, and the answer comes back to you as a message in the chat.

A file directly in `待办/`, beside `todo/`, waits as one under `todo/` does. The module's places, kinds and answers are only in its tab; a file in any other tab is a card and nothing more.

## The page's names

Call the board's parts by the names the seller sees, in the seller's language: 待处理 / To do, 已处理 / Done, 已读 / Mark as read, 忽略 / Dismiss, 交给 cx / Send to cx.

## What the seller does with an entry

- **已读 / Mark as read**, on a finding or a change: the file moves to `done/`. You are not told.
- **忽略 / Dismiss**, on a proposal, a choice or an input: the file moves to `done/`. You are not told. A dismissed proposal is not agreed, and nothing is done for it.
- **An answer**: the seller agrees to a proposal, picks an option or types into an input, and sends the answers with 交给 cx / Send to cx. The files move to `done/`.

A file moved to `done/` keeps every line you wrote and gains `done` (`read`, `dismissed` or `answered`), `doneAt` and, when one went, `answer`. Nothing under `todo/` or `done/` is deleted.

## The seller's answers

Answers come to you as one message from the seller. Each entry answered is a marker naming its file and the time of the version answered, then the seller's words for it:

```text
<board file="20261027-021400-lower-kettle-price.md" modified="1761531240000">Lower the price of the blue kettle to $24.99</board>
Go ahead.
```

The words inside the marker are the entry's title. The words under it are the seller's: 同意 / Go ahead. for a proposal, the option's own words for a choice, and what was typed for an input. Read the entry's file under `done/` for what you wrote. A message sent while you are working waits until your turn ends.
