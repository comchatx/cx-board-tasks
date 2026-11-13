import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it } from "vitest";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { pi: unknown; files: unknown; comchatx: { skills: Record<string, unknown> } };
const scratches: string[] = [];
afterEach(() => { for (const scratch of scratches.splice(0)) rmSync(scratch, { recursive: true, force: true }); });

const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]));

it("the pinned pi lists the package's skills as its manifest names them, with nothing it could not read", async () => {
  const home = mkdtempSync(join(tmpdir(), "pi-package-"));
  scratches.push(home);
  const agentDir = join(home, "agent");
  const cwd = join(home, "project");
  for (const directory of [agentDir, cwd]) mkdirSync(directory);
  writeFileSync(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "always", packages: [ROOT] }));
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager: SettingsManager.create(cwd, agentDir) });
  await loader.reload();
  const { skills, diagnostics } = loader.getSkills();
  expect(diagnostics).toEqual([]);
  expect(manifest.pi).toEqual({ skills: ["./skills"] });
  // The Plugins page names a package's skills from its `comchatx` field alone.
  expect(skills.map((skill) => skill.name).sort()).toEqual(Object.keys(manifest.comchatx.skills).sort());
  for (const skill of skills) expect(skill.description.trim(), skill.name).not.toBe("");
});

it("ships its skills, its page, its README in English and in Chinese and its license, and nothing else", () => {
  // npm 12 keys its answer by the package's name; earlier ones answer a list.
  const answer = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: ROOT, encoding: "utf8" })) as { files: { path: string }[] }[] | Record<string, { files: { path: string }[] }>;
  const packed = Array.isArray(answer) ? answer : Object.values(answer);
  const shipped = [...walk(join(ROOT, "skills")), ...walk(join(ROOT, "page"))].map((path) => relative(ROOT, path));
  expect(packed[0]!.files.map((file) => file.path).sort()).toEqual(["LICENSE", "README.md", "README.zh-CN.md", "package.json", ...shipped].sort());
  expect(manifest.files).toEqual(["skills", "page", "README.zh-CN.md"]);
});

it("names cx-board in builds as required, so the Plugins page installs the board with the module", () => {
  // A builds entry given by its npm name alone is a required one; the module's to-dos live on the board's tab.
  expect((manifest.comchatx as Record<string, unknown>)["builds"]).toEqual(["@comchatx/cx-board"]);
});

it("the card's name, its lines and the skill's row are the ones signed on 2026-11-11", () => {
  const read = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { description: unknown; comchatx: { name?: unknown; about?: unknown; skills: Record<string, { about: { zh: unknown } }> } };
  expect([read.comchatx.name, read.description, read.comchatx.about, read.comchatx.skills["cx-board-tasks"]!.about.zh]).toEqual(["Board Inbox", "Puts what cx found and what needs your answer in your Inbox.", "cx 的发现和要你决定的事放进收件箱，在那里直接回答。", "告诉 cx 收件箱写什么、你的回答如何传回。"]);
});

it("declares its page for the module's tab, 待办, named 收件箱 / Inbox, a file it ships", () => {
  const board = (manifest.comchatx as Record<string, unknown>)["board"] as { tab: string; page: string; name: unknown };
  expect(board).toEqual({ tab: "待办", page: "page/inbox.html", name: { zh: "收件箱", en: "Inbox" } });
  expect(readFileSync(join(ROOT, board.page), "utf8")).toContain("window.cxBoard");
});
