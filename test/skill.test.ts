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
  expect(skill).toContain("收件箱 / Inbox, 已处理 / Done, 已读 / Mark as read, 忽略 / Dismiss");
  expect(skill).toContain("description: The seller's Inbox on the board, where you leave what you found, changed, propose and ask, as cards the seller marks as read or answers. ");
});

it("says in the description, which cx holds at every turn, that what cx has for the seller is a card and the chat shows the card, not its words", () => {
  const description = /^description: (.*)$/m.exec(skill)?.[1] ?? "";
  for (const said of ["the seller reads what you have for them in the Inbox", "your answer to what they asked, a small one too", "the chat shows the card by its title and where it stands, with no copy of its words"]) expect(description, said).toContain(said);
  expect(description).not.toContain("Use when you leave the seller something to decide");
});

it("says where the seller reads, and that cx's steps and a question asked in the turn are the chat's", () => {
  expect(skill).toContain("The seller reads each card on its own, later, without the chat beside it");
  expect(skill).toContain("What you do on the way, your steps and a question you ask in your turn through pi's question box, is the chat's and not a card.");
});

it("states facts and no procedure: no step tells cx when to write a card, and nothing of 0.2's places and Send to cx is left", () => {
  for (const gone of ["交给 cx", "Send to cx", "you should", "always ", "must ", "`choice` or an `input` entry"]) expect(skill, gone).not.toContain(gone);
});

it("says which card stands first and in what order the rest stand, as the page draws them", () => {
  expect(skill).toContain("`reply: true` makes the card your answer to the seller's last message: the Inbox shows the newest such card first.");
  expect(skill).toContain("Then the cards that ask, then those that tell, each part newest first by the file's time.");
  expect(skill).toContain("The seller may dismiss a card that asks, 忽略 / Dismiss.");
});
