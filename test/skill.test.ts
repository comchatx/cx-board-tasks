import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const skill = readFileSync(join(ROOT, "skills", "cx-board-tasks", "SKILL.md"), "utf8");

it("tells cx what a card is and where it stands, the keys the base reads for any board's card", () => {
  for (const said of ["the directory `待办` under the board, which the seller sees named 收件箱 / Inbox", "A card is a Markdown file anywhere under `待办/`", "`asks: true` makes the card one that asks", "`done: read`, `done: answered` or `done: dismissed`", "`doneAt`", "`answer`", "A card does not hold your turn."]) expect(skill, said).toContain(said);
});

it("tells cx how an answer comes back: the seller's words, then the line naming the card", () => {
  expect(skill).toContain('<board from="待办" card="restock-blue-kettle.md"></board>');
  expect(skill).toContain("A message sent while you are working waits until your turn ends.");
});

it("gives the page's names as signed, and the skill's row as signed, its first sentence", () => {
  expect(skill).toContain("收件箱 / Inbox, 已处理 / Done, 已读 / Mark as read, 忽略 / Dismiss, 分组 / Grouping, 排序 / Ordering.");
  expect(skill).toContain("description: The seller's Inbox on the board, where you leave what you found, changed, propose and ask, as cards the seller marks as read or answers. ");
});

it("says in the description, which cx holds at every turn, that what cx has for the seller is a card and the chat shows the card, not its words", () => {
  const description = /^description: (.*)$/m.exec(skill)?.[1] ?? "";
  for (const said of ["the seller reads what you have for them in the Inbox", "your answer to what they asked, a small one too", "the chat shows the card by its title and where it stands, with no copy of its words"]) expect(description, said).toContain(said);
  expect(description).not.toContain("Use when you leave the seller something to decide");
});

it("says where the seller reads, that cx's steps are the chat's, and that a question can be a card the turn does not wait on", () => {
  expect(skill).toContain("The seller reads each card on its own, later, without the chat beside it");
  expect(skill).toContain("What you do on the way, your steps, is the chat's and not a card. A question for the seller can be a card: the seller answers it when they come to the Inbox, and your turn does not wait on it.");
  expect(skill).not.toContain("question box");
});

it("states facts and no procedure: no step tells cx when to write a card, and nothing of 0.2's places and Send to cx is left", () => {
  for (const gone of ["交给 cx", "Send to cx", "you should", "always ", "must ", "`choice` or an `input` entry"]) expect(skill, gone).not.toContain(gone);
});

it("says which card stands first and in what order the rest stand, as the page draws them", () => {
  expect(skill).toContain("`reply: true` makes the card your answer to the seller's last message: the Inbox shows the newest such card first.");
  expect(skill).toContain("Then the cards, as the seller groups and orders them with 分组 / Grouping and 排序 / Ordering, by kind, by urgency or by time. Until the seller picks, the cards that ask stand before those that tell, the more urgent first in each and then the newest.");
  expect(skill).toContain("The seller may dismiss a card that asks, 忽略 / Dismiss.");
});

it("tells cx the Inbox draws a card's words as the chat draws its answers, and as plain paragraphs on a board that cannot", () => {
  expect(skill).toContain("The Inbox draws them as your answers in the chat are drawn: bold, lists, tables, code and links, any HTML in them shown as text, and no image; a link in a card opens nothing.");
  expect(skill).toContain("On a board that cannot draw them so, they stand as plain paragraphs, the marks of formatting printed as typed");
  expect(skill).toContain("It sells **6 a day** and 40 are left:\n\n- at $24.99");
});

it("tells cx that the Inbox asks for the board when a card lands, and what bounds the ask", () => {
  expect(skill).toContain("When a new card lands, the Inbox asks for the board to be shown: the column opens on the Inbox, waits while the seller is typing where it would cover the chat, and stays shut once the seller has closed what such an ask opened.");
});

it("points to the board's skill for a card's level, and says a card without it is routine", () => {
  expect(skill).toContain("`level` says how urgent the card is, as the `cx-board` skill says: the Inbox marks each card by it, and a card without it is 常规 / Routine.");
});

it("tells cx how a card asks with options, in the platform's forms, and how its answer is kept and comes back", () => {
  for (const said of ["`questions` makes the card one that asks with options", "`comchatx.options/1`", "`comchatx.confirm/1`", '"several": true', '"own": false', "跳过 / Skip; a card with every question skipped is dismissed and nothing comes to you.", "`answers`, on a card that asks with options", "未作答 / Not answered"]) expect(skill, said).toContain(said);
});

it("says the seller's grouping and ordering is kept in inbox.json, which is no card", () => {
  expect(skill).toContain("How the seller groups and orders the cards is kept in `待办/inbox.json`. It is not a card: leave it as it is.");
});
