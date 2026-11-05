import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const skill = readFileSync(join(ROOT, "skills", "cx-board-tasks", "SKILL.md"), "utf8");

it("tells cx of the module's kinds, places and answers, and that a question which must wait can be an entry answered in the chat", () => {
  for (const kind of ["`finding`", "`change`", "`proposal`", "`choice`", "`input`"]) expect(skill, kind).toContain(kind);
  for (const said of ["忽略 / Dismiss", "交给 cx / Send to cx", "<board file=", "`answered`"]) expect(skill, said).toContain(said);
  expect(skill).toContain("A question that has to wait for the seller's answer can be written as a `choice` or an `input` entry on the board: you end your turn and go on, and the answer comes back to you as a message in the chat.");
  for (const gone of ["timed_out", "prefer the board"]) expect(skill, gone).not.toContain(gone);
});
