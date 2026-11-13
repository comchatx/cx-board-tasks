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

it("states facts and no procedure: no step tells cx when to write a card, and nothing of 0.2's places and Send to cx is left", () => {
  for (const gone of ["交给 cx", "Send to cx", "you should", "always ", "must ", "`choice` or an `input` entry"]) expect(skill, gone).not.toContain(gone);
});
