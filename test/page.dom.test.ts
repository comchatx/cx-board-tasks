// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const ROOT = process.cwd();
const PAGE = readFileSync(join(ROOT, "page", "inbox.html"), "utf8");
const KIT = readFileSync(join(ROOT, "node_modules", "@comchatx", "cx-board", "kit", "kit.js"), "utf8");
const SCRIPT = /<script>([\s\S]*)<\/script>/.exec(PAGE)![1]!;
const BODY = /<body[^>]*>([\s\S]*?)<script>/.exec(PAGE)![1]!;

type File = { text: string; modified: number };
type Board = ReturnType<typeof stand>;

/** The board's asks as the frame answers them, over files kept here; `refuse` makes the next asks of a verb fail with a reason. */
function stand(files: Record<string, string>) {
  let clock = 1_000;
  const held = new Map<string, File>(Object.entries(files).map(([file, text]) => [file, { text, modified: clock++ }]));
  const hearing: Record<string, ((value?: unknown) => void)[]> = { files: [], focus: [], context: [] };
  const refuse: Record<string, string[]> = {};
  const fail = (verb: string): void => { const reason = refuse[verb]?.shift(); if (reason !== undefined) throw new Error(reason); };
  const asked: [string, ...unknown[]][] = [];
  const board = {
    context: { theme: "light", locale: "en", width: 400 },
    on: (name: string, listener: (value?: unknown) => void) => { hearing[name]?.push(listener); },
    list: vi.fn(async () => { asked.push(["list"]); fail("list"); return [...held].map(([file, one]) => ({ file, modified: one.modified, size: one.text.length })); }),
    read: vi.fn(async (file: string) => { asked.push(["read", file]); fail("read"); const one = held.get(file); if (one === undefined) throw new Error("no_file"); return one.text; }),
    write: vi.fn(async (file: string, text: string) => { asked.push(["write", file, text]); fail("write"); const modified = clock++; held.set(file, { text, modified }); return { modified, size: text.length }; }),
    send: vi.fn(async (text: string, given?: { card?: string }) => { asked.push(["send", text, given?.card]); fail("send"); return "sent"; }),
    count: vi.fn(async (n: number, words?: string | null) => { asked.push(["count", n, words]); return undefined; }),
    draft: vi.fn(), show: vi.fn(),
  };
  const tell = (name: string, value?: unknown): void => { for (const one of hearing[name] ?? []) one(value); };
  return { board, held, refuse, asked, tell, add: (file: string, text: string) => { held.set(file, { text, modified: clock++ }); } };
}

function open(files: Record<string, string>, locale = "en"): Board {
  document.documentElement.dataset["locale"] = locale;
  document.body.className = "kit";
  document.body.innerHTML = BODY;
  const made = stand(files);
  Object.defineProperty(window, "cxBoard", { configurable: true, value: made.board });
  new Function(KIT)();
  new Function(SCRIPT)();
  return made;
}
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

const settle = async (): Promise<void> => { for (let n = 0; n < 20; n += 1) await new Promise((done) => setTimeout(done, 0)); };
const cards = (): string[] => [...document.querySelectorAll<HTMLElement>(".t-card")].map((one) => `${one.querySelector(".entry-title")!.textContent} ${one.querySelector("input") === null ? "tells" : "asks"}`);
const cardOf = (file: string): HTMLElement => document.querySelector<HTMLElement>(`.t-card[data-file="${file}"]`)!;
const heard = (): string | null => document.querySelector(".unseen[role=status]")!.textContent;

const ASK = "---\ntitle: Restock the blue kettle?\nasks: true\n---\n\nIt sells 6 a day.\n\n40 are left.\n";
const TELL = "---\ntitle: Storage fees rose\n---\nUp $41.20 on August.\n";

it("draws the cards that wait, those that ask first and each part newest first, titled by front matter, heading or name, with 0.2's files among them", async () => {
  const { board } = open({
    "a.md": TELL,
    "b.md": ASK,
    "notes/c.md": "# A heading as title\n\nWords.",
    "todo/20261027-021400-choice.md": "---\nkind: choice\ntitle: Which supplier?\nat: 2026-10-27T02:14:00Z\n---\nA or B.",
    "done/old.md": "---\nkind: finding\ntitle: Old finding\ndone: read\ndoneAt: 2026-10-20T08:00:00.000Z\n---\nGone.",
    "plain.md": "No title at all.",
    "page.txt": "not a card",
  });
  await settle();
  expect(cards()).toEqual(["Which supplier? asks", "Restock the blue kettle? asks", "plain tells", "A heading as title tells", "Storage fees rose tells"]);
  expect([...cardOf("b.md").querySelectorAll(".t-words p")].map((one) => one.textContent)).toEqual(["It sells 6 a day.", "40 are left."]);
  expect(board.read.mock.calls.map(([file]) => file)).not.toContain("page.txt");
  expect(board.count).toHaveBeenLastCalledWith(5, "2 to answer, 3 to read");
});

it("sends an answer as the seller's message naming its card, then marks the card answered in its own front matter and keeps every other line", async () => {
  const { board, held } = open({ "ask/restock.md": ASK });
  await settle();
  const field = cardOf("ask/restock.md").querySelector<HTMLInputElement>("input")!;
  expect([field.getAttribute("aria-label"), field.placeholder]).toEqual(["Answer “Restock the blue kettle?”", "Answer cx"]);
  field.value = " Twenty units. ";
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  await settle();
  expect(board.send).toHaveBeenCalledWith("Twenty units.", { card: "ask/restock.md" });
  const text = held.get("ask/restock.md")!.text;
  expect(text).toMatch(/^---\ntitle: Restock the blue kettle\?\nasks: true\ndone: answered\ndoneAt: \d{4}-\d\d-\d\dT[\d:.]+Z\nanswer: "Twenty units\."\n---\n\nIt sells 6 a day\.\n\n40 are left\.\n$/);
  expect([cards(), document.querySelector(".board-empty")!.textContent]).toEqual([[], "Nothing to do"]);
  await vi.waitFor(() => expect(heard()).toBe("Sent to cx"));
});

it("keeps the words and says the answer was not sent when the send is refused, and marks nothing", async () => {
  const { board, refuse, held } = open({ "b.md": ASK });
  await settle();
  refuse["send"] = ["no_press"];
  const card = cardOf("b.md");
  card.querySelector<HTMLInputElement>("input")!.value = "Twenty";
  card.querySelector<HTMLButtonElement>(".t-reply button")!.click();
  await settle();
  const again = cardOf("b.md");
  expect([again.querySelector("input")!.value, again.querySelector(".t-fail")!.textContent, board.write.mock.calls.length, held.get("b.md")!.text]).toEqual(["Twenty", "Your answer was not sent.", 0, ASK]);
});

it("marks a card that tells as read, and a dismissed one as dismissed with a line that takes it back", async () => {
  const { held } = open({ "a.md": TELL, "b.md": ASK });
  await settle();
  cardOf("a.md").querySelector<HTMLButtonElement>(".t-mark")!.click();
  await settle();
  expect(held.get("a.md")!.text).toMatch(/^---\ntitle: Storage fees rose\ndone: read\ndoneAt: .+\n---\nUp \$41\.20 on August\.\n$/);
  const dismiss = cardOf("b.md").querySelector<HTMLButtonElement>(".t-mark")!;
  expect([dismiss.getAttribute("aria-label"), dismiss.title]).toEqual(["Dismiss “Restock the blue kettle?”", "Dismiss"]);
  dismiss.click();
  await settle();
  expect(held.get("b.md")!.text).toContain("\ndone: dismissed\n");
  const line = document.querySelector<HTMLElement>(".t-gone")!;
  expect([cards(), line.querySelector("span")!.textContent]).toEqual([[], "Dismissed “Restock the blue kettle?”"]);
  line.querySelector<HTMLButtonElement>("button")!.click();
  await settle();
  expect([held.get("b.md")!.text, cards()]).toEqual([ASK, ["Restock the blue kettle? asks"]]);
});

it("lists what is done under Done, by how and when, with the seller's answer when a row is opened, and finds by title", async () => {
  open({
    "a.md": "---\ntitle: Raise the ad budget?\nasks: true\ndone: answered\ndoneAt: 2026-11-10T09:00:00.000Z\nanswer: \"Yes.\"\n---\nIt runs out by 15:00.",
    "b.md": "---\ntitle: Fees rose\ndone: read\ndoneAt: 2026-11-11T09:00:00.000Z\n---\nUp.",
  });
  await settle();
  document.querySelector<HTMLButtonElement>(".t-top .t-quiet")!.click();
  const rows = (): string[] => [...document.querySelectorAll(".t-row")].map((one) => `${one.querySelector(".entry-title")!.textContent} | ${one.querySelector(".t-when")!.textContent}`);
  vi.setSystemTime(new Date(2026, 10, 12, 12));
  document.querySelector<HTMLButtonElement>(".t-top .t-quiet")!.click();
  document.querySelector<HTMLButtonElement>(".t-top .t-quiet")!.click();
  expect(rows()).toEqual(["Fees rose | Read · Nov 11", "Raise the ad budget? | Answered · Nov 10"]);
  document.querySelectorAll<HTMLButtonElement>(".t-row")[1]!.click();
  expect([...document.querySelectorAll(".t-past p")].map((one) => one.textContent)).toEqual(["It runs out by 15:00.", "You: Yes."]);
  const search = document.querySelector<HTMLInputElement>("input[type=search]")!;
  search.value = "zzz";
  search.dispatchEvent(new Event("input"));
  expect(document.querySelector(".board-empty")!.textContent).toBe("No title has these words.");
});

it("brings the card the board names into view once it is read, a waiting one in the list and a done one open under Done", async () => {
  const made = open({ "b.md": ASK, "old.md": "---\ntitle: Old\ndone: read\n---\nx" });
  made.tell("focus", "b.md");
  await settle();
  expect(document.activeElement).toBe(cardOf("b.md"));
  made.tell("focus", "old.md");
  await settle();
  expect(document.activeElement?.matches(".t-row[aria-expanded=true]")).toBe(true);
});

it("reads again only what changed when the board's files change, and goes on reading after a refusal for asking too often", async () => {
  const made = open({ "a.md": TELL, "b.md": ASK });
  await settle();
  made.board.read.mockClear();
  made.add("c.md", "---\ntitle: New one\n---\n");
  made.refuse["read"] = ["too_often"];
  made.tell("files");
  await vi.waitFor(() => expect(cards()).toContain("New one tells"), { timeout: 3000 });
  expect(made.board.read.mock.calls.map(([file]) => file)).toEqual(["c.md", "c.md"]);
});

it("speaks the seller's language: the signed Chinese words", async () => {
  const { board } = open({ "b.md": ASK, "a.md": TELL }, "zh");
  await settle();
  const card = cardOf("b.md");
  expect([card.querySelector("input")!.placeholder, card.querySelector(".t-reply button")!.textContent, card.querySelector(".t-mark")!.getAttribute("aria-label"), cardOf("a.md").querySelector(".t-mark")!.getAttribute("aria-label"), document.querySelector(".t-top .t-quiet")!.textContent]).toEqual(["回答 cx", "发送", "忽略“Restock the blue kettle?”", "标为已读“Storage fees rose”", "已处理"]);
  expect(board.count).toHaveBeenLastCalledWith(2, "1 条待作答，1 条待查看");
});

it("says what cx leaves will be here before anything came", async () => {
  open({});
  await settle();
  expect(document.querySelector(".board-empty")!.textContent).toBe("What cx leaves for you will be here.");
});

it("keeps what cx wrote to a card while its answer was on its way, and what it wrote to a dismissed card before it was taken back", async () => {
  const made = open({ "b.md": ASK });
  await settle();
  let accept: (said: string) => void = () => {};
  made.board.send.mockImplementationOnce(() => new Promise<string>((done) => { accept = done; }));
  const field = cardOf("b.md").querySelector<HTMLInputElement>("input")!;
  field.value = "Twenty";
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  await settle();
  made.add("b.md", ASK.replace("40 are left.", "40 are left.\n\ncx: the supplier answered."));
  accept("sent");
  await settle();
  expect(made.held.get("b.md")!.text).toMatch(/\ndone: answered\n[\s\S]*cx: the supplier answered\.\n$/);
  made.add("c.md", "---\ntitle: Raise the budget?\nasks: true\n---\nWords.\n");
  made.tell("files");
  await settle();
  cardOf("c.md").querySelector<HTMLButtonElement>(".t-mark")!.click();
  await settle();
  made.add("c.md", `${made.held.get("c.md")!.text}\ncx: a later line.\n`);
  document.querySelector<HTMLElement>(".t-gone button")!.click();
  await settle();
  expect(made.held.get("c.md")!.text).toBe("---\ntitle: Raise the budget?\nasks: true\n---\nWords.\n\ncx: a later line.\n");
});

it("keeps the words typed in every card that has not sent them when the page draws again", async () => {
  const made = open({ "a.md": ASK, "b.md": ASK.replace("Restock the blue kettle?", "Raise the budget?") });
  await settle();
  cardOf("a.md").querySelector<HTMLInputElement>("input")!.value = "Twenty";
  const other = cardOf("b.md").querySelector<HTMLInputElement>("input")!;
  other.value = "Yes";
  other.focus();
  made.add("c.md", TELL);
  made.tell("files");
  await settle();
  expect([cardOf("a.md").querySelector("input")!.value, cardOf("b.md").querySelector("input")!.value]).toEqual(["Twenty", "Yes"]);
});

it("sends an answer once while it is on its way, its field and Send held until it is", async () => {
  const made = open({ "b.md": ASK });
  await settle();
  let accept: (said: string) => void = () => {};
  made.board.send.mockImplementationOnce(() => new Promise<string>((done) => { accept = done; }));
  cardOf("b.md").querySelector<HTMLInputElement>("input")!.value = "Twenty";
  cardOf("b.md").querySelector<HTMLButtonElement>(".t-reply button")!.click();
  await settle();
  const held = cardOf("b.md");
  expect([held.querySelector("input")!.disabled, held.querySelector<HTMLButtonElement>(".t-reply button")!.disabled, held.querySelector("input")!.value]).toEqual([true, true, "Twenty"]);
  held.querySelector<HTMLButtonElement>(".t-reply button")!.click();
  held.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  accept("sent");
  await settle();
  expect(made.board.send).toHaveBeenCalledTimes(1);
});

it("reaches a card's answer, then Send, then its dismiss by Tab", async () => {
  open({ "b.md": ASK });
  await settle();
  const order = [...cardOf("b.md").querySelectorAll<HTMLElement>("input, button:not([hidden])")].map((one) => one.getAttribute("aria-label") ?? one.textContent);
  expect(order).toEqual(["Answer “Restock the blue kettle?”", "Send", "Dismiss “Restock the blue kettle?”"]);
});

it("puts cx's answer to the seller's last message first, the newest card that says it is one, over those that ask", async () => {
  open({
    "fee.md": "---\ntitle: The fee is $3.86 a unit\nreply: true\n---\nFrom the fee preview.\n",
    "b.md": ASK,
    "a.md": TELL,
  });
  await settle();
  expect(cards()).toEqual(["The fee is $3.86 a unit tells", "Restock the blue kettle? asks", "Storage fees rose tells"]);
});

it("puts only the newest reply first, an older one in its part", async () => {
  const made = open({ "old.md": "---\ntitle: Old answer\nreply: true\n---\nx\n", "b.md": ASK });
  await settle();
  made.add("new.md", "---\ntitle: New answer\nreply: true\n---\ny\n");
  made.tell("files");
  await settle();
  expect(cards()).toEqual(["New answer tells", "Restock the blue kettle? asks", "Old answer tells"]);
});

it("keeps the keyboard on the card that had it when the page draws again", async () => {
  const made = open({ "b.md": ASK, "a.md": TELL });
  await settle();
  cardOf("a.md").focus();
  made.add("c.md", "---\ntitle: New one\n---\n");
  made.tell("files");
  await settle();
  expect(document.activeElement).toBe(cardOf("a.md"));
});
