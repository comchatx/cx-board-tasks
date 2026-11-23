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
    draft: vi.fn(), show: vi.fn(async (name: string) => { asked.push(["show", name]); return undefined; }),
    // The chat's message box as the board hands it: a field and its control; Enter or the control sends the field's words, which are
    // emptied once the page's send is fulfilled with the same words still there, and stay where it is refused.
    box: vi.fn(({ placeholder, send }: { placeholder: string; send: (text: string) => Promise<unknown> }) => {
      const box = document.createElement("div");
      box.className = "cx-box";
      const field = document.createElement("textarea");
      field.placeholder = placeholder;
      const control = document.createElement("button");
      control.type = "button";
      control.setAttribute("aria-label", "Send");
      const go = (): void => { const words = field.value; if (words.trim() === "") return; void (async () => send(words))().then(() => { if (field.value === words) field.value = ""; }, () => {}); };
      field.addEventListener("keydown", (event) => { if (event.key !== "Enter" || event.shiftKey || event.isComposing) return; event.preventDefault(); go(); });
      control.addEventListener("click", go);
      box.append(field, control);
      return box;
    }),
  };
  const tell = (name: string, value?: unknown): void => { for (const one of hearing[name] ?? []) one(value); };
  return { board, held, refuse, asked, tell, add: (file: string, text: string) => { held.set(file, { text, modified: clock++ }); } };
}

function open(files: Record<string, string>, locale = "en", asks: Record<string, unknown> = {}): Board {
  document.documentElement.dataset["locale"] = locale;
  document.body.className = "kit";
  document.body.innerHTML = BODY;
  const made = stand(files);
  Object.assign(made.board, asks);
  Object.defineProperty(window, "cxBoard", { configurable: true, value: made.board });
  new Function(KIT)();
  new Function(SCRIPT)();
  return made;
}
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

/** A time `hours` before the run, so a done card stays in its week's recent rows whatever the day the tests run. */
const ago = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();
const settle = async (): Promise<void> => { for (let n = 0; n < 20; n += 1) await new Promise((done) => setTimeout(done, 0)); };
const cards = (): string[] => [...document.querySelectorAll<HTMLElement>(".t-card")].map((one) => `${one.querySelector(".entry-title")!.textContent} ${one.querySelector<HTMLTextAreaElement>(".cx-box textarea") === null ? "tells" : "asks"}`);
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
  const field = cardOf("ask/restock.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!;
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
  card.querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value = "Twenty";
  card.querySelector<HTMLButtonElement>(".cx-box button")!.click();
  await settle();
  const again = cardOf("b.md");
  expect([again.querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value, again.querySelector(".t-fail")!.textContent, board.write.mock.calls.length, held.get("b.md")!.text]).toEqual(["Twenty", "Your answer was not sent.", 0, ASK]);
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
  const rows = (): string[] => [...document.querySelectorAll(".t-done")].map((one) => `${one.querySelector(".entry-title")!.textContent} | ${one.querySelector(".t-when")!.textContent}`);
  vi.setSystemTime(new Date(2026, 10, 12, 12));
  document.querySelector<HTMLButtonElement>(".t-top .t-quiet")!.click();
  document.querySelector<HTMLButtonElement>(".t-top .t-quiet")!.click();
  expect(rows()).toEqual(["Raise the ad budget? | Answered · Nov 10", "Fees rose | Read · Nov 11"]);
  document.querySelectorAll<HTMLButtonElement>(".t-open")[0]!.click();
  expect([...document.querySelectorAll(".t-done p")].map((one) => one.textContent)).toEqual(["It runs out by 15:00.", "You: Yes."]);
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
  expect(document.activeElement?.matches(".t-open[aria-expanded=true]")).toBe(true);
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
  expect([card.querySelector<HTMLTextAreaElement>(".cx-box textarea")!.placeholder, card.querySelector(".t-mark")!.getAttribute("aria-label"), cardOf("a.md").querySelector(".t-mark")!.getAttribute("aria-label"), document.querySelector(".t-top .t-quiet")!.textContent]).toEqual(["回答 cx", "忽略“Restock the blue kettle?”", "标为已读“Storage fees rose”", "已处理"]);
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
  const field = cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!;
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
  cardOf("a.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value = "Twenty";
  const other = cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!;
  other.value = "Yes";
  other.focus();
  made.add("c.md", TELL);
  made.tell("files");
  await settle();
  expect([cardOf("a.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value, cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value]).toEqual(["Twenty", "Yes"]);
});

it("takes an answered card from the list at the press, before its answer is sent, and sends it once", async () => {
  const made = open({ "b.md": ASK });
  await settle();
  let accept: (said: string) => void = () => {};
  made.board.send.mockImplementationOnce(() => new Promise<string>((done) => { accept = done; }));
  const field = cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!;
  field.value = "Twenty";
  cardOf("b.md").querySelector<HTMLButtonElement>(".cx-box button")!.click();
  expect(cards()).toEqual([]);
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  accept("sent");
  await settle();
  expect([made.board.send.mock.calls.length, made.board.write.mock.calls.length, cards()]).toEqual([1, 1, []]);
  expect(made.held.get("b.md")!.text).toContain("\ndone: answered\n");
});

it("brings a card back as it was when its mark is not written: a tick and a dismiss with no line of their own, an answer with its words and its line", async () => {
  const made = open({ "a.md": TELL, "b.md": ASK });
  await settle();
  made.refuse["write"] = ["unavailable", "unavailable"];
  cardOf("a.md").querySelector<HTMLButtonElement>(".t-mark")!.click();
  expect(cards()).toEqual(["Restock the blue kettle? asks"]);
  await settle();
  expect([cards(), document.querySelector(".t-fail")]).toEqual([["Restock the blue kettle? asks", "Storage fees rose tells"], null]);
  cardOf("b.md").querySelector<HTMLButtonElement>(".t-mark")!.click();
  expect(document.querySelector(".t-gone")).not.toBeNull();
  await settle();
  expect([cards(), document.querySelector(".t-gone"), document.querySelector(".t-fail")]).toEqual([["Restock the blue kettle? asks", "Storage fees rose tells"], null, null]);
  made.refuse["send"] = ["unavailable"];
  cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value = "Twenty";
  cardOf("b.md").querySelector<HTMLButtonElement>(".cx-box button")!.click();
  expect(cards()).toEqual(["Storage fees rose tells"]);
  await settle();
  expect([cards(), cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value, cardOf("b.md").querySelector(".t-fail")!.textContent]).toEqual([["Restock the blue kettle? asks", "Storage fees rose tells"], "Twenty", "Your answer was not sent."]);
  expect([made.held.get("a.md")!.text, made.held.get("b.md")!.text]).toEqual([TELL, ASK]);
});

it("draws an answered card where its file says once the next read comes, when the answer was sent and its mark was not written, and sends nothing again", async () => {
  const made = open({ "a.md": TELL, "b.md": ASK });
  await settle();
  made.refuse["write"] = ["unavailable"];
  typeIn("b.md", "Twenty");
  cardOf("b.md").querySelector<HTMLButtonElement>(".cx-box button")!.click();
  expect(cards()).toEqual(["Storage fees rose tells"]);
  await settle();
  made.tell("files");
  await settle();
  expect([cards(), document.querySelector(".t-fail"), made.held.get("b.md")!.text, made.board.send.mock.calls.length]).toEqual([["Restock the blue kettle? asks", "Storage fees rose tells"], null, ASK, 1]);
});

it("draws every card of a tab longer than the frame's 32 asks out at once, and asks again a second later for a read refused busy", async () => {
  const files = Object.fromEntries(Array.from({ length: 45 }, (_, n) => [`f${String(n).padStart(2, "0")}.md`, `---\ntitle: Card ${n}\n---\nx\n`]));
  document.documentElement.dataset["locale"] = "en";
  document.body.className = "kit";
  document.body.innerHTML = BODY;
  const made = stand(files);
  const read = made.board.read.getMockImplementation()!;
  let out = 0, most = 0, busy = 0;
  made.board.read.mockImplementation(async (file) => {
    if (out >= 32 || (busy < 2 && file === "f44.md")) { busy += 1; throw new Error("busy"); }
    out += 1; most = Math.max(most, out);
    try { await new Promise((done) => setTimeout(done, 10)); return await read(file); } finally { out -= 1; }
  });
  Object.defineProperty(window, "cxBoard", { configurable: true, value: made.board });
  new Function(KIT)();
  new Function(SCRIPT)();
  await vi.waitFor(() => expect(cards()).toHaveLength(45), { timeout: 4000 });
  const cardReads = (): number => made.board.read.mock.calls.filter(([file]) => !file.endsWith(".json")).length;
  const asked = cardReads();
  await new Promise((done) => setTimeout(done, 1200));
  expect([busy, most <= 32, cardReads(), asked]).toEqual([2, true, 47, 47]);
});

it("asks for the board by a card's own name when a read brings a waiting card it did not hold, and never on its first read", async () => {
  const made = open({ "a.md": TELL });
  await settle();
  made.tell("files");
  await settle();
  expect(made.board.show).not.toHaveBeenCalled();
  made.add("a.md", TELL.replace("Up", "Now up"));
  made.add("done/old.md", "---\ntitle: Old\ndone: read\ndoneAt: 2026-10-20T08:00:00.000Z\n---\nGone.");
  made.tell("files");
  await settle();
  expect(made.board.show).not.toHaveBeenCalled();
  made.add("x/new.md", "---\ntitle: New\n---\nWords.");
  made.add("x/newer.md", "---\ntitle: Newer\n---\nWords.");
  made.tell("files");
  await settle();
  expect(made.board.show.mock.calls).toEqual([["x/newer.md"]]);
});

it("answers in the board's own message box, one a card for as long as the page lives, and draws no field or Send of its own", async () => {
  const made = open({ "a.md": ASK, "b.md": ASK.replace("blue", "red"), "c.md": TELL });
  await settle();
  made.tell("files");
  await settle();
  expect(made.board.box.mock.calls.map(([given]) => given.placeholder)).toEqual(["Answer cx", "Answer cx"]);
  expect([document.querySelectorAll(".t-card .cx-box").length, document.querySelectorAll(".t-card input[type=text]").length, cardOf("c.md").querySelector(".cx-box")]).toEqual([2, 0, null]);
  expect([...cardOf("a.md").querySelector(".cx-box")!.children].map((one) => one.tagName)).toEqual(["TEXTAREA", "BUTTON"]);
});

it("reaches a card's answer, then the box's Send, then its dismiss by Tab", async () => {
  open({ "b.md": ASK });
  await settle();
  const order = [...cardOf("b.md").querySelectorAll<HTMLElement>("input, textarea, button:not([hidden])")].map((one) => one.getAttribute("aria-label") ?? one.textContent);
  expect(order).toEqual(["Urgency: routine", "Answer “Restock the blue kettle?”", "Send", "Dismiss “Restock the blue kettle?”"]);
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

const gate = () => { let release!: () => void; const promise = new Promise<void>((done) => { release = done; }); return { promise, release }; };
const typeIn = (file: string, words: string): HTMLTextAreaElement => { const field = cardOf(file).querySelector<HTMLTextAreaElement>(".cx-box textarea")!; field.value = words; return field; };

it("keeps what the seller typed after a refused send over the words that were refused, when the page draws again", async () => {
  const made = open({ "a.md": ASK, "b.md": ASK });
  await settle();
  made.refuse["send"] = ["no_press"];
  typeIn("a.md", "Old ten").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  await settle();
  typeIn("a.md", "New twenty");
  typeIn("b.md", "B draft").focus();
  made.tell("context", { width: 1280 });
  expect(cardOf("a.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value).toBe("New twenty");
  expect(cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value).toBe("B draft");
});

it("keeps an unsent answer while the seller looks under Done and comes back", async () => {
  open({ "a.md": ASK });
  await settle();
  typeIn("a.md", "Unsent while I read Done");
  document.querySelector<HTMLButtonElement>(".t-top button")!.click();
  document.querySelector<HTMLButtonElement>(".t-top button")!.click();
  expect(cardOf("a.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.value).toBe("Unsent while I read Done");
});

it("keeps the words the seller selected selected, in their direction, when the page draws again", async () => {
  const made = open({ "a.md": ASK });
  await settle();
  const field = typeIn("a.md", "abcdef");
  field.focus();
  field.setSelectionRange(1, 5, "forward");
  made.tell("context", { width: 1280 });
  const active = document.activeElement as HTMLInputElement;
  expect([active.selectionStart, active.selectionEnd, active.selectionDirection]).toEqual([1, 5, "forward"]);
});

for (const action of ["tick", "dismiss", "undo"] as const) it(action === "undo" ? "does one undo for two presses while the first is on its way, its control held until it is" : `moves a card at its ${action}, before the file is read and written, and does it once`, async () => {
  const made = open({ "a.md": action === "tick" ? TELL : ASK });
  await settle();
  if (action === "undo") { cardOf("a.md").querySelector<HTMLButtonElement>(".t-mark")!.click(); await settle(); }
  const read = made.board.read.getMockImplementation()!;
  const g = gate();
  made.board.read.mockClear();
  made.board.read.mockImplementation(async (file) => { await g.promise; return await read(file); });
  const press = (): HTMLButtonElement => action === "undo" ? document.querySelector<HTMLButtonElement>(".t-gone button")! : cardOf("a.md").querySelector<HTMLButtonElement>(".t-mark")!;
  const first = press();
  first.click();
  if (action === "undo") expect(press().disabled).toBe(true);
  else expect([cards(), document.querySelector(".t-gone") !== null]).toEqual([[], action === "dismiss"]);
  first.click();
  expect(made.board.read).toHaveBeenCalledTimes(1);
  g.release();
  await settle();
  expect(made.board.write).toHaveBeenCalledTimes(action === "undo" ? 2 : 1);
  if (action === "undo") expect(made.held.get("a.md")!.text).toBe(ASK);
  else expect(made.held.get("a.md")!.text).toContain(`done: ${action === "tick" ? "read" : "dismissed"}`);
});

it("reads every card it does not hold at once, not one after another", async () => {
  const g = gate();
  document.documentElement.dataset["locale"] = "en";
  document.body.className = "kit";
  document.body.innerHTML = BODY;
  const board = stand({ "a.md": TELL, "b.md": ASK, "c.md": "---\ntitle: Third\n---\nx\n" });
  const read = board.board.read.getMockImplementation()!;
  board.board.read.mockImplementation(async (file) => { if (!file.endsWith(".json")) await g.promise; return await read(file); });
  Object.defineProperty(window, "cxBoard", { configurable: true, value: board.board });
  new Function(KIT)();
  new Function(SCRIPT)();
  await settle();
  expect(board.board.read.mock.calls.map(([file]) => file).filter((file) => !file.endsWith(".json"))).toHaveLength(3);
  g.release();
  await settle();
  expect(cards()).toHaveLength(3);
});

it("draws a card's words as cx's answers in the chat are, by the board's markdown ask, and as paragraphs until it answers, where it refuses, or where the board has none", async () => {
  const LISTED = "---\ntitle: Profit this week\n---\n\n**Profit** by store:\n\n- US $1,284\n- UK £310\n";
  const drawnBy = vi.fn(async (text: string) => `<p><strong>drawn</strong> ${text.length}</p>`);
  const made = open({ "a.md": LISTED, "b.md": ASK }, "en", { markdown: drawnBy });
  await settle();
  const body = (file: string): HTMLElement => cardOf(file).querySelector<HTMLElement>(".t-words")!;
  expect(drawnBy.mock.calls.map(([text]) => text).sort()).toEqual(["\n**Profit** by store:\n\n- US $1,284\n- UK £310\n", "\nIt sells 6 a day.\n\n40 are left.\n"].sort());
  expect([body("a.md").classList.contains("markdown"), body("a.md").innerHTML]).toEqual([true, `<p><strong>drawn</strong> ${"\n**Profit** by store:\n\n- US $1,284\n- UK £310\n".length}</p>`]);
  // Drawn once a version: another drawing asks nothing more; a file written since is asked again.
  made.tell("context", { width: 500 });
  await settle();
  expect(drawnBy).toHaveBeenCalledTimes(2);
  made.add("a.md", LISTED.replace("1,284", "1,300"));
  made.tell("files");
  await settle();
  expect(drawnBy).toHaveBeenCalledTimes(3);
  // A refusal leaves the words as paragraphs, and is not asked again until the file changes.
  drawnBy.mockRejectedValueOnce(new Error("too_large"));
  made.add("a.md", LISTED);
  made.tell("files");
  await settle();
  expect([body("a.md").classList.contains("markdown"), [...body("a.md").querySelectorAll("p")].map((one) => one.textContent)]).toEqual([false, ["**Profit** by store:", "- US $1,284 - UK £310"]]);
  made.tell("context", { width: 600 });
  await settle();
  expect(drawnBy).toHaveBeenCalledTimes(4);
});

it("asks for a card's drawing again a second after the frame turns it away as busy, and draws paragraphs on a board with no markdown ask", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const drawnBy = vi.fn(async () => "<p>drawn</p>");
  drawnBy.mockRejectedValueOnce(new Error("busy"));
  open({ "b.md": ASK }, "en", { markdown: drawnBy });
  await settle();
  expect(cardOf("b.md").querySelector(".t-words")!.classList.contains("markdown")).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  await settle();
  expect([drawnBy.mock.calls.length, cardOf("b.md").querySelector(".t-words")!.innerHTML]).toEqual([2, "<p>drawn</p>"]);
  vi.useRealTimers();
  open({ "b.md": ASK });
  await settle();
  expect([...cardOf("b.md").querySelectorAll(".t-words > p")].map((one) => one.textContent)).toEqual(["It sells 6 a day.", "40 are left."]);
});

it("draws a done card's words by the same drawing when its row is opened", async () => {
  const made = open({ "a.md": "---\ntitle: Storage fees rose\ndone: read\n---\n\nUp **$41.20**.\n" }, "en", { markdown: vi.fn(async () => "<p>Up <strong>$41.20</strong>.</p>") });
  await settle();
  made.tell("focus", "a.md");
  await settle();
  expect(document.querySelector(".t-done .t-past-words.markdown strong")?.textContent).toBe("$41.20");
});

it("says the answer field's placeholder in the page's language as it is now, not as it was when the field was made", async () => {
  const made = open({ "b.md": ASK });
  await settle();
  expect(cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.placeholder).toBe("Answer cx");
  document.documentElement.dataset["locale"] = "zh";
  made.tell("context", { locale: "zh" });
  await settle();
  expect(cardOf("b.md").querySelector<HTMLTextAreaElement>(".cx-box textarea")!.placeholder).toBe("回答 cx");
});

/**
 * The frame's bound on a page's asks, as the platform's proxy holds it: at most 32 out at once across every verb, any past them refused
 * `busy`; each answer comes a few milliseconds later, as across the frame.
 */
function bounded(made: Board, asks: Record<string, (...given: never[]) => Promise<unknown>>): { most: () => number; refused: string[] } {
  let out = 0, most = 0;
  const refused: string[] = [];
  const all = { ...asks };
  for (const verb of ["list", "read", "write", "send", "count", "show"] as const) all[verb] = made.board[verb].getMockImplementation() as never;
  for (const [verb, answer] of Object.entries(all)) {
    const one = async (...given: never[]): Promise<unknown> => {
      if (out >= 32) { refused.push(verb); throw new Error("busy"); }
      out += 1; most = Math.max(most, out);
      try { await new Promise((done) => setTimeout(done, 5)); return await answer(...given); } finally { out -= 1; }
    };
    if (verb in made.board && vi.isMockFunction((made.board as Record<string, unknown>)[verb])) (made.board as unknown as Record<string, { mockImplementation: (fn: unknown) => void }>)[verb]!.mockImplementation(one);
    else Object.assign(made.board, { [verb]: one });
  }
  return { most: () => most, refused };
}

it("leaves the frame's asks room for the icon's count with forty cards waiting, drawing their words a few at a time, and counts all forty", async () => {
  const files = Object.fromEntries(Array.from({ length: 40 }, (_, n) => [`f${String(n).padStart(2, "0")}.md`, `---\ntitle: Card ${n}\n---\n\n**${n}** left.\n`]));
  document.documentElement.dataset["locale"] = "en";
  document.body.className = "kit";
  document.body.innerHTML = BODY;
  const made = stand(files);
  const asks = bounded(made, { markdown: async (text: string) => `<p>${text.trim()}</p>` });
  Object.defineProperty(window, "cxBoard", { configurable: true, value: made.board });
  new Function(KIT)();
  new Function(SCRIPT)();
  await vi.waitFor(() => expect(document.querySelectorAll(".t-card .t-words.markdown")).toHaveLength(40), { timeout: 4000 });
  const counts = made.asked.filter(([verb]) => verb === "count").map(([, n]) => n);
  expect([counts.at(-1), asks.refused.filter((verb) => verb === "count"), asks.most() <= 32]).toEqual([40, [], true]);
});

it("asks for the count again at the next drawing when the board refused it, and only then holds it as told", async () => {
  const made = open({ "b.md": ASK });
  const answer = made.board.count.getMockImplementation()!;
  made.board.count.mockImplementation(async (n, words) => { if (n === 1 && made.board.count.mock.calls.filter(([one]) => one === 1).length === 1) throw new Error("busy"); return answer(n, words); });
  await settle();
  const told = (): number => made.board.count.mock.calls.filter(([n]) => n === 1).length;
  const before = told();
  made.tell("context", { width: 500 });
  await settle();
  const after = told();
  made.tell("context", { width: 600 });
  await settle();
  expect([before, after, told()]).toEqual([1, 2, 2]);
});

it("keeps a card's words as text where the board's drawing answers anything but text", async () => {
  for (const answer of [null, false, 17, ["<img src=x>"], { html: "<b>x</b>" }]) {
    open({ "b.md": ASK }, "en", { markdown: vi.fn(async () => answer) });
    await settle();
    const words = cardOf("b.md").querySelector(".t-words")!;
    expect([String(answer), words.classList.contains("markdown"), [...words.querySelectorAll("p")].map((one) => one.textContent), words.querySelector("img")]).toEqual([String(answer), false, ["It sells 6 a day.", "40 are left."], null]);
  }
});

const LEVELED = (title: string, level: number | undefined, asks = false): string => `---\ntitle: ${title}\n${asks ? "asks: true\n" : ""}${level === undefined ? "" : `level: ${level}\n`}---\nx\n`;
const lit = (file: string): number => cardOf(file).querySelectorAll(".t-level .t-bars rect.lit").length;
const heads = (): string[] => [...document.querySelectorAll(".t-part:not(.t-none) .t-parthead")].map((one) => one.textContent!.trim());

it("marks a card's urgency by its level, a card with none as routine, and orders by kind, the more urgent first inside a kind", async () => {
  open({ "a.md": LEVELED("Old and very urgent", 3, true), "b.md": LEVELED("New and routine", undefined, true), "c.md": LEVELED("Urgent notice", 2), "d.md": LEVELED("Plain notice", 1) });
  await settle();
  expect(cards()).toEqual(["Old and very urgent asks", "New and routine asks", "Urgent notice tells", "Plain notice tells"]);
  expect([lit("a.md"), lit("b.md"), lit("c.md"), lit("d.md")]).toEqual([3, 1, 2, 1]);
  expect(cardOf("a.md").querySelector(".t-level")!.getAttribute("aria-label")).toBe("Urgency: very urgent");
  expect(heads()).toEqual(["2 to answer", "2 to read"]);
});

it("shows a mark's level in a small card under the pointer, and Escape takes it away", async () => {
  open({ "a.md": LEVELED("Hot", 2, true), "b.md": TELL });
  await settle();
  const mark = cardOf("a.md").querySelector<HTMLButtonElement>(".t-level")!;
  mark.dispatchEvent(new Event("mouseenter"));
  expect(cardOf("a.md").querySelector(".t-tip")?.textContent).toBe("Urgent");
  mark.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(document.querySelector(".t-tip")).toBeNull();
});

it("draws the two presses and the columns in both views with no card, one card or many, and keeps the pairing picked in inbox.json", async () => {
  const presses = (): (string | null)[] => [...document.querySelectorAll(".t-sortbtn")].map((press) => press.getAttribute("aria-label"));
  const none = open({});
  await settle();
  expect([presses(), document.querySelector(".board-empty") !== null]).toEqual([["Grouping: Type", "Ordering: Urgency"], true]);
  document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!.click();
  await settle();
  expect(presses()).toEqual(["Grouping: Type", "Ordering: Urgency"]);
  expect(none.board.write).not.toHaveBeenCalled();
  const one = open({ "a.md": TELL, "d.md": `---\ntitle: Old\ndone: read\ndoneAt: ${ago(24)}\n---\nGone.` });
  await settle();
  expect([presses(), document.querySelector(".t-heads"), cards()]).toEqual([["Grouping: Type", "Ordering: Urgency"], null, ["Storage fees rose tells"]]);
  document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!.click();
  await settle();
  expect([presses(), document.querySelector(".t-heads"), document.querySelector(".t-done .entry-title")?.textContent]).toEqual([["Grouping: Type", "Ordering: Urgency"], document.getElementById("page"), "Old"]);
  document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!.click();
  await settle();
  document.querySelector<HTMLButtonElement>("#sort-by")!.click();
  document.querySelectorAll<HTMLButtonElement>("#sort-by-menu [role=menuitemradio]")[2]!.click();
  await settle();
  expect([one.held.get("inbox.json")?.text, presses(), document.querySelector(".t-heads"), cards()]).toEqual(['{"by":"time","in":"level"}\n', ["Grouping: Date", "Ordering: Urgency"], document.getElementById("page"), ["Storage fees rose tells"]]);
  one.board.write.mockClear();
  const made = open({ "a.md": LEVELED("Hot", 3), "b.md": LEVELED("Cold", 1, true), "c.md": LEVELED("Warm", 2) });
  await settle();
  expect(one.board.write).not.toHaveBeenCalled();
  expect([...document.querySelectorAll(".t-sortbtn")].map((press) => press.getAttribute("aria-label"))).toEqual(["Grouping: Type", "Ordering: Urgency"]);
  document.querySelector<HTMLButtonElement>("#sort-by")!.click();
  expect([...document.querySelectorAll("#sort-by-menu [role=menuitemradio]")].map((item) => `${item.textContent}${item.getAttribute("aria-checked") === "true" ? " ✓" : ""}`)).toEqual(["Type ✓", "Urgency", "Date"]);
  document.querySelectorAll<HTMLButtonElement>("#sort-by-menu [role=menuitemradio]")[1]!.click();
  await settle();
  expect(heads()).toEqual(["Very urgent1", "Urgent1", "Routine1"]);
  expect([...document.querySelectorAll(".t-sortbtn")].map((press) => press.getAttribute("aria-label"))).toEqual(["Grouping: Urgency", "Ordering: Newest"]);
  expect(made.held.get("inbox.json")?.text).toBe('{"by":"level","in":"time"}\n');
  expect(cards()).toEqual(["Hot tells", "Warm tells", "Cold asks"]);
  const again = open({ "a.md": LEVELED("Hot", 3), "b.md": LEVELED("Cold", 1, true), "inbox.json": '{"by":"time","in":"kind"}\n' });
  await settle();
  expect([...document.querySelectorAll(".t-sortbtn")].map((press) => press.getAttribute("aria-label"))).toEqual(["Grouping: Date", "Ordering: Type"]);
  expect(cards()).toEqual(["Cold asks", "Hot tells"]);
  expect(again.board.read.mock.calls.map(([file]) => file)).not.toContain("inbox.md");
});

it("names the two presses and the ways in the signed Chinese", async () => {
  open({ "a.md": TELL, "b.md": ASK }, "zh");
  await settle();
  expect([...document.querySelectorAll(".t-sortbtn")].map((press) => press.getAttribute("aria-label"))).toEqual(["分组：类型", "排序：紧急程度"]);
  expect(cardOf("b.md").querySelector(".t-level")!.getAttribute("aria-label")).toBe("紧急程度：常规");
});

it("lays out Done in columns by the same two presses, each card's mark, state and day at its foot", async () => {
  open({
    "a.md": "---\ntitle: Raise the ad budget?\nasks: true\nlevel: 3\ndone: answered\ndoneAt: 2026-11-10T09:00:00.000Z\n---\nx",
    "b.md": "---\ntitle: Fees rose\ndone: read\ndoneAt: 2026-11-11T09:00:00.000Z\n---\nUp.",
    "c.md": "---\ntitle: Dropped\nasks: true\ndone: dismissed\ndoneAt: 2026-11-11T10:00:00.000Z\n---\nx",
  });
  vi.setSystemTime(new Date(2026, 10, 12, 12));
  await settle();
  document.querySelector<HTMLButtonElement>(".t-top .t-quiet")!.click();
  expect(heads()).toEqual(["Questions2", "Updates1"]);
  const foot = (one: Element): string => `${one.lastElementChild!.querySelectorAll("rect.lit").length} ${one.lastElementChild!.textContent}`;
  expect([...document.querySelectorAll(".t-done")].map(foot)).toEqual(["3 Answered · Nov 10", "1 Dismissed · Nov 11", "1 Read · Nov 11"]);
  expect([...document.querySelectorAll(".t-sortbtn")]).toHaveLength(2);
  expect(document.querySelector("input[type=search]")).not.toBeNull();
});

const FORM = (questions: unknown[]): string => `---\ntitle: Pick a supplier\nlevel: 2\nquestions: ${JSON.stringify(JSON.stringify({ form: "comchatx.options/1", questions }))}\n---\nWho ships it?\n`;
const ONE = [{ words: "Which supplier?", options: [{ name: "Yiwu A" }, { name: "Ningbo B" }] }];
const TWO = [...ONE, { words: "How many?", options: [{ name: "200" }, { name: "500" }] }];

it("draws a card that asks with options by the kit's questionnaire, sends the answer naming its card, and keeps it as answer and answers", async () => {
  const made = open({ "q.md": FORM(ONE), "a.md": TELL });
  await settle();
  const card = cardOf("q.md");
  expect(card.querySelector(".kit-asked .entry-title")!.textContent).toBe("Which supplier?");
  expect(card.querySelectorAll(".t-level rect.lit")).toHaveLength(2);
  expect([...card.querySelectorAll("button")].map((one) => one.textContent || one.getAttribute("aria-label"))).not.toContain("Skip");
  card.querySelectorAll<HTMLInputElement>(".kit-option input")[1]!.click();
  cardOf("q.md").querySelector<HTMLButtonElement>(".kit-asked-foot .primary")!.click();
  await settle();
  expect(made.board.send).toHaveBeenCalledWith("Which supplier?\nNingbo B", { card: "q.md" });
  const text = made.held.get("q.md")!.text;
  expect(text).toContain("done: answered\n");
  expect(text).toContain('answer: "Which supplier?\\nNingbo B"\n');
  const answers = /^answers: (.*)$/m.exec(text)![1]!;
  expect(JSON.parse(JSON.parse(answers))).toEqual({ form: "comchatx.options/1", answers: [{ chosen: ["Ningbo B"] }] });
  expect(cards()).toEqual(["Storage fees rose tells"]);
});

it("reads a question holding a line or paragraph separator whole, as the form was written", async () => {
  const words = ["Ship by sea\u2028or by air?", "Which\u2029warehouse?"];
  open({ "q.md": FORM(words.map((one) => ({ words: one, options: [{ name: "Yes" }, { name: "No" }] }))) });
  await settle();
  expect(cardOf("q.md").querySelector(".kit-asked .entry-title")?.textContent ?? "").toContain(words[0]);
});

it("offers Skip where a card asks several questions, keeps the picks across a draw, sends each question over its answer, and dismisses a card with every question skipped", async () => {
  const made = open({ "q.md": FORM(TWO), "s.md": FORM(TWO).replace("Pick a supplier", "Skip me"), "a.md": TELL });
  await settle();
  const press = (file: string, word: string): void => [...cardOf(file).querySelectorAll<HTMLButtonElement>(".kit-asked-foot button")].find((one) => one.textContent === word)!.click();
  cardOf("q.md").querySelectorAll<HTMLInputElement>(".kit-option input")[0]!.click();
  made.tell("context");
  expect(cardOf("q.md").querySelectorAll<HTMLInputElement>(".kit-option input")[0]!.checked).toBe(true);
  press("q.md", "Next question");
  press("q.md", "Skip");
  await settle();
  expect(made.board.send).toHaveBeenCalledWith("Which supplier?\nYiwu A\n\nHow many?\nNot answered", { card: "q.md" });
  press("s.md", "Skip");
  press("s.md", "Skip");
  await settle();
  expect(made.board.send).toHaveBeenCalledTimes(1);
  expect(made.held.get("s.md")!.text).toContain("done: dismissed\n");
});

it("dismisses a card that asks with options by its ×, sending nothing", async () => {
  const made = open({ "q.md": FORM(ONE) });
  await settle();
  cardOf("q.md").querySelector<HTMLButtonElement>(".t-mark")!.click();
  await settle();
  expect(made.board.send).not.toHaveBeenCalled();
  expect(made.held.get("q.md")!.text).toContain("done: dismissed\n");
});

it("says each question and its answer once under Done", async () => {
  const answers = JSON.stringify(JSON.stringify({ form: "comchatx.options/1", answers: [{ chosen: ["Yiwu A"] }, null] }));
  const made = open({ "q.md": FORM(TWO).replace("level: 2\n", `level: 2\ndone: answered\ndoneAt: 2026-11-10T09:00:00.000Z\nanswers: ${answers}\n`) });
  await settle();
  made.tell("focus", "q.md");
  await settle();
  expect([...document.querySelectorAll(".t-done p")].map((one) => one.textContent)).toEqual(["Which supplier?", "Yiwu A", "How many?", "Not answered"]);
});

const CONFIRM = (title: string, more = ""): string => `---\ntitle: ${title}\n${more}questions: ${JSON.stringify(JSON.stringify({ form: "comchatx.confirm/1", title }))}\n---\nThe kettle sells 6 a day.\n`;

it("reads a saved answer only in its form's shape, so one in no shape draws from its words and invents no yes", async () => {
  const done = (answer: string, answers: unknown): string => `done: answered\ndoneAt: 2026-11-10T09:00:00.000Z\nanswer: ${JSON.stringify(answer)}\nanswers: ${JSON.stringify(JSON.stringify(answers))}\n`;
  const made = open({
    "q.md": FORM(ONE).replace("level: 2\n", `level: 2\n${done("Ningbo B", { form: "comchatx.options/1", answers: [{ chosen: 5 }] })}`),
    "c.md": CONFIRM("Ship 10 units?", done("No", { form: "comchatx.confirm/1", confirmed: "no" })),
  });
  await settle();
  made.tell("focus", "q.md");
  await settle();
  made.tell("focus", "c.md");
  await settle();
  made.tell("context");
  await settle();
  const all = [...document.querySelectorAll(".t-done p")].map((one) => one.textContent);
  expect(all).toEqual(expect.arrayContaining(["Who ships it?", "You: Ningbo B", "The kettle sells 6 a day.", "You: No"]));
  expect(all).not.toContain("Yes");
});

it("sends a confirm as its question over the yes, and writes it onto no other question the file holds by then", async () => {
  const made = open({ "c.md": CONFIRM("Ship 10 units?") });
  await settle();
  const sent = made.board.send.getMockImplementation()!;
  made.board.send.mockImplementation(async (...asked) => { made.add("c.md", CONFIRM("Ship 500 units?")); return await sent(...asked); });
  cardOf("c.md").querySelector<HTMLButtonElement>('[data-focus="yes"]')!.click();
  await settle();
  expect(made.board.send).toHaveBeenCalledWith("Ship 10 units?\nYes", { card: "c.md" });
  expect(made.held.get("c.md")!.text).toBe(CONFIRM("Ship 500 units?"));
});

it("keeps the seller's picks, own words and place when the board refuses the send, and across a rewrite of the card's words alone", async () => {
  const made = open({ "q.md": FORM(TWO) });
  await settle();
  const press = (name: string): void => cardOf("q.md").querySelector<HTMLElement>(`[data-focus="${name}"]`)!.click();
  press("o1");
  made.add("q.md", FORM(TWO).replace("Who ships it?", "Who ships it, and when?"));
  made.tell("files");
  await settle();
  expect(cardOf("q.md").querySelector<HTMLInputElement>('[data-focus="o1"]')!.checked).toBe(true);
  press("next");
  press("other");
  const own = cardOf("q.md").querySelector<HTMLInputElement>('[data-focus="own"]')!;
  own.value = "  Keep these words  ";
  own.dispatchEvent(new Event("input"));
  made.refuse["send"] = ["busy"];
  press("main");
  await settle();
  expect(cardOf("q.md").querySelector(".t-fail")).not.toBeNull();
  expect(cardOf("q.md").querySelector(".kit-asked .entry-title")!.textContent).toContain("How many?");
  expect(cardOf("q.md").querySelector<HTMLInputElement>('[data-focus="own"]')!.value).toBe("Keep these words");
  press("previous");
  expect(cardOf("q.md").querySelector<HTMLInputElement>('[data-focus="o1"]')!.checked).toBe(true);
  press("next");
  press("main");
  await settle();
  expect(made.board.send).toHaveBeenLastCalledWith("Which supplier?\nNingbo B\n\nHow many?\nKeep these words", { card: "q.md" });
  expect(made.held.get("q.md")!.text).toContain("done: answered\n");
});

it("draws nothing and counts nothing until its first read is whole, and keeps every card it holds and its count while it reads again", async () => {
  const files = { "a.md": TELL, "b.md": ASK, "c.md": "---\ntitle: Third\n---\nx\n" };
  document.documentElement.dataset["locale"] = "en";
  document.body.className = "kit";
  document.body.innerHTML = BODY;
  const made = stand(files);
  const read = made.board.read.getMockImplementation()!;
  let g = gate();
  made.board.read.mockImplementation(async (file) => { if (file !== "b.md") await g.promise; return await read(file); });
  Object.defineProperty(window, "cxBoard", { configurable: true, value: made.board });
  new Function(KIT)();
  new Function(SCRIPT)();
  await settle();
  expect([cards(), document.querySelector(".board-empty"), made.board.count.mock.calls]).toEqual([[], null, []]);
  g.release();
  await settle();
  expect(cards()).toHaveLength(3);
  expect(made.board.count.mock.calls).toEqual([[3, "1 to answer, 2 to read"]]);
  g = gate();
  for (const [file, text] of Object.entries(files)) made.add(file, text.replace("x", "y"));
  made.tell("files");
  await settle();
  expect(cards()).toHaveLength(3);
  expect(made.board.count.mock.calls).toHaveLength(1);
  g.release();
  await settle();
  expect(cards()).toHaveLength(3);
});

it("draws the skill's own card that asks with options as the questionnaire it describes", async () => {
  const skill = readFileSync(join(ROOT, "skills", "cx-board-tasks", "SKILL.md"), "utf8");
  const example = /```markdown\n(---\n[^`]*questions: [^`]*)```/.exec(skill)![1]!;
  open({ "kettle.md": example });
  await settle();
  expect([...cardOf("kettle.md").querySelectorAll(".kit-option-words")].map((one) => one.textContent)).toEqual(["Yiwu A$3.10 a unit, 12 days", "Ningbo B$3.40 a unit, 6 days", "Another answer"]);
});

/** Counts the reads of a card's words' and title's heights, by which the page measures 「展开」. */
function foldReads(): { count: () => number; done: () => void } {
  const spies = [vi.spyOn(Element.prototype, "scrollHeight", "get"), vi.spyOn(HTMLElement.prototype, "clientHeight", "get")];
  return { count: () => spies.reduce((sum, spy) => sum + spy.mock.calls.length, 0), done: () => { for (const spy of spies) spy.mockRestore(); } };
}

it("takes out at a press that card's element alone: every other card stays the element it was, and no card's fold is measured again", async () => {
  open({ "a.md": TELL, "b.md": "---\ntitle: Second\n---\ny\n", "c.md": "---\ntitle: Third\n---\nz\n", "d.md": ASK });
  await settle();
  const stay = ["b.md", "c.md", "d.md"];
  const before = stay.map(cardOf);
  const reads = foldReads();
  try {
    cardOf("a.md").querySelector<HTMLButtonElement>(".t-mark")!.click();
    expect(cardOf("a.md")).toBeNull();
    await settle();
    document.querySelector<HTMLButtonElement>(`.t-card[data-file="d.md"] .t-mark`)!.click();
    await settle();
    expect([cardOf("a.md"), cardOf("d.md"), ...stay.slice(0, 2).map((file, at) => cardOf(file) === before[at])]).toEqual([null, null, true, true]);
    expect(reads.count()).toBe(0);
  } finally { reads.done(); }
});

it("measures a card's fold when its words or the page's width change, not at a draw for anything else", async () => {
  const made = open({ "a.md": TELL, "b.md": "---\ntitle: Second\n---\ny\n" });
  await settle();
  const reads = foldReads();
  const width = window.innerWidth;
  try {
    made.tell("context");
    expect(reads.count()).toBe(0);
    made.add("a.md", "---\ntitle: Storage fees rose\n---\nUp $41.20 on September.\n");
    made.tell("files");
    await settle();
    const one = reads.count();
    expect(one).toBeGreaterThan(0);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width + 100 });
    window.dispatchEvent(new Event("resize"));
    expect(reads.count()).toBeGreaterThan(one);
  } finally { reads.done(); Object.defineProperty(window, "innerWidth", { configurable: true, value: width }); }
});

it("keeps the done cards it read in a file of their own, never in inbox.json, and a later page reads a done card the board still gives at that time only once 已处理 is opened", async () => {
  const DONE = "---\ntitle: Old\ndone: read\ndoneAt: 2026-10-20T08:00:00.000Z\n---\nGone.";
  const first = open({ "a.md": TELL, "d.md": DONE });
  await settle();
  const list = first.held.get("inbox-done.json")!.text;
  expect([JSON.parse(list), first.held.has("inbox.json")]).toEqual([{ "d.md": first.held.get("d.md")!.modified }, false]);
  const made = open({ "a.md": TELL, "d.md": DONE, "inbox-done.json": list });
  await settle();
  expect(made.board.read.mock.calls.map(([file]) => file).sort()).toEqual(["a.md", "inbox-done.json", "inbox.json"]);
  document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!.click();
  await settle();
  document.querySelector<HTMLButtonElement>(".t-week")!.click();
  expect([made.board.read.mock.calls.map(([file]) => file).filter((file) => file === "d.md"), document.querySelector(".t-done .entry-title")?.textContent]).toEqual([["d.md"], "Old"]);
  expect(made.board.write).not.toHaveBeenCalled();
});

it("lands a press held across a files notice between its down and its up: the button pressed is still the one drawn, on a card and on the top bar, in both views", async () => {
  const made = open({ "a.md": TELL, "b.md": "---\ntitle: Second\n---\ny\n" });
  await settle();
  let more = 0;
  const across = async (button: HTMLButtonElement): Promise<void> => {
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    made.add(`new-${more++}.md`, "---\ntitle: Third\n---\nz\n");
    made.tell("files");
    await settle();
    expect(button.isConnected).toBe(true);
    button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    button.click();
    await settle();
  };
  await across(cardOf("a.md").querySelector<HTMLButtonElement>(".t-mark")!);
  expect(made.held.get("a.md")!.text).toContain("\ndone: read\n");
  await across(document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!);
  expect(document.querySelector(".t-done .entry-title")?.textContent).toBe("Storage fees rose");
  await across(document.querySelector<HTMLButtonElement>(".t-done .t-open")!);
  expect(document.querySelector(".t-done .t-open")!.getAttribute("aria-expanded")).toBe("true");
  await across(document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!);
  expect([document.querySelector(".t-done"), cards().sort()]).toEqual([null, ["Second tells", ...Array.from({ length: 4 }, () => "Third tells")]]);
});

it("draws 已处理's rows as their files come, newest first, with no line saying nothing is done while they are read", async () => {
  const files = Object.fromEntries(Array.from({ length: 20 }, (_, n) => [`d${String(n).padStart(2, "0")}.md`, `---\ntitle: Done ${n}\ndone: read\ndoneAt: ${ago(24)}\n---\nx\n`]));
  const first = open({ "a.md": TELL, ...files });
  await settle();
  const made = open({ "a.md": TELL, ...files, "inbox-done.json": first.held.get("inbox-done.json")!.text });
  await settle();
  const read = made.board.read.getMockImplementation()!;
  let release: () => void = () => {};
  const rest = new Promise<void>((done) => { release = done; });
  let reads = 0;
  made.board.read.mockImplementation(async (file) => { if (file.startsWith("d") && reads++ >= 16) await rest; return await read(file); });
  const titles = (): string[] => [...document.querySelectorAll(".t-done .entry-title")].map((one) => one.textContent ?? "").sort();
  document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!.click();
  expect([titles(), document.querySelector(".board-empty")]).toEqual([[], null]);
  await settle();
  expect([titles(), document.querySelector(".board-empty")]).toEqual([Array.from({ length: 16 }, (_, n) => `Done ${n + 4}`).sort(), null]);
  release();
  await settle();
  expect(titles()).toHaveLength(20);
});

it("never writes inbox.json for a done card: the grouping another page chose on the same board stands when this page reads a card done", async () => {
  const made = open({ "a.md": TELL, "b.md": "---\ntitle: Second\n---\ny\n" });
  await settle();
  made.add("inbox.json", `${JSON.stringify({ by: "date", in: "level" })}\n`);
  made.add("a.md", `${TELL.replace("---\nUp", `done: read\ndoneAt: ${ago(1)}\n---\nUp`)}`);
  made.tell("files");
  await settle();
  expect([JSON.parse(made.held.get("inbox.json")!.text), made.held.has("inbox-done.json")]).toEqual([{ by: "date", in: "level" }, true]);
  expect(made.board.write.mock.calls.map(([file]) => file)).toEqual(["inbox-done.json"]);
});

it("keeps the stored grouping when its first read of inbox.json is refused, and reads every file when the done list is refused", async () => {
  const DONE = "---\ntitle: Old\ndone: read\ndoneAt: 2026-10-20T08:00:00.000Z\n---\nGone.";
  const first = open({ "a.md": TELL, "d.md": DONE });
  await settle();
  const list = first.held.get("inbox-done.json")!.text;
  document.body.replaceChildren();
  const stored = `${JSON.stringify({ by: "date", in: "level" })}\n`;
  document.documentElement.dataset["locale"] = "en";
  document.body.className = "kit";
  document.body.innerHTML = BODY;
  const made = stand({ "a.md": TELL, "d.md": DONE, "inbox.json": stored, "inbox-done.json": list });
  const read = made.board.read.getMockImplementation()!;
  made.board.read.mockImplementation(async (file) => { if (file.endsWith(".json")) throw new Error("too_often"); return await read(file); });
  Object.defineProperty(window, "cxBoard", { configurable: true, value: made.board });
  new Function(KIT)();
  new Function(SCRIPT)();
  await settle();
  expect(made.held.get("inbox.json")!.text).toBe(stored);
  expect(made.board.read.mock.calls.map(([file]) => file).filter((file) => file.endsWith(".md")).sort()).toEqual(["a.md", "d.md"]);
});

it("keeps the page's width and the top bar as they were when a second card or a second done row arrives, so a press held on 已处理 or 返回 lands", async () => {
  const made = open({ "a.md": TELL, "d.md": `---\ntitle: Old\ndone: read\ndoneAt: ${ago(24)}\n---\nGone.` });
  await settle();
  const page = document.getElementById("page")!;
  // The page's width is its stylesheet's one rule for #page: no class it takes sizes it.
  expect(/<style>([\s\S]*?)<\/style>/.exec(PAGE)![1]!.match(/#page[.:][^{]*\{[^}]*max-width/g)).toBeNull();
  const across = async (file: string, text: string): Promise<void> => {
    const button = document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!, bar = button.parentElement, width = page.classList.contains("t-wide");
    button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    made.add(file, text);
    made.tell("files");
    await settle();
    expect(button.isConnected).toBe(true);
    expect(document.querySelector(".t-top") === bar).toBe(true);
    expect(page.classList.contains("t-wide")).toBe(width);
    button.click();
    await settle();
  };
  await across("b.md", "---\ntitle: Second\n---\ny\n");
  expect(document.querySelector(".t-done .entry-title")?.textContent).toBe("Old");
  await across("e.md", `---\ntitle: Older\ndone: read\ndoneAt: ${ago(48)}\n---\nGone.`);
  expect([document.querySelector(".t-done"), cards().sort()]).toEqual([null, ["Second tells", "Storage fees rose tells"]]);
});

it("hides 「展开」 again when a wider page shows a card's words whole", async () => {
  open({ "a.md": TELL });
  await settle();
  const more = cardOf("a.md").querySelector<HTMLButtonElement>(".t-more")!;
  const width = window.innerWidth;
  let tall = 189;
  const spies = [vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) { return this.classList.contains("t-words") ? tall : 0; }),
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("t-words") ? 57 : 0; })];
  try {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 288 });
    window.dispatchEvent(new Event("resize"));
    await settle();
    expect(more.hidden).toBe(false);
    tall = 57;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
    window.dispatchEvent(new Event("resize"));
    await settle();
    expect([cardOf("a.md").querySelector(".t-more"), more.hidden]).toEqual([more, true]);
  } finally { for (const spy of spies) spy.mockRestore(); Object.defineProperty(window, "innerWidth", { configurable: true, value: width }); }
});

it("reads the done files newest first across every folder, so the newest done row is in the first wave", async () => {
  const flat = Object.fromEntries(Array.from({ length: 16 }, (_, n) => [`d${String(n).padStart(2, "0")}.md`, `---\ntitle: Done ${n}\ndone: read\ndoneAt: ${ago(72)}\n---\nx\n`]));
  const files = { "a.md": TELL, ...flat, "done/new.md": `---\ntitle: Newest\ndone: read\ndoneAt: ${ago(1)}\n---\nx\n` };
  const first = open(files);
  await settle();
  const made = open({ ...files, "inbox-done.json": first.held.get("inbox-done.json")!.text });
  await settle();
  const read = made.board.read.getMockImplementation()!;
  let reads = 0;
  made.board.read.mockImplementation(async (file) => { if (file.endsWith(".md") && reads++ >= 16) await new Promise(() => {}); return await read(file); });
  document.querySelector<HTMLButtonElement>(".t-top > .t-quiet")!.click();
  await settle();
  expect([...document.querySelectorAll(".t-done .entry-title")].map((one) => one.textContent)).toContain("Newest");
});

const regroup = async (by: string, steps: readonly [number, boolean, boolean][]): Promise<void> => {
  // One column of three is wide and holds the words whole; the one column by type is narrower and cuts them.
  const wide = (): boolean => document.getElementById("page")?.classList.contains("t-c3") === true;
  const spies = [vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) { return this.classList.contains("t-words") ? (wide() ? 57 : 189) : 0; }),
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("t-words") ? 57 : 0; })];
  try {
    const made = open({ "a.md": TELL, "inbox.json": `${JSON.stringify({ by, in: "level" })}\n` });
    await settle();
    const box = cardOf("a.md"), more = box.querySelector<HTMLButtonElement>(".t-more")!;
    for (const [n, isWide, hidden] of steps) {
      if (n >= 0) {
        document.querySelector<HTMLButtonElement>("#sort-by")!.click();
        document.querySelectorAll<HTMLButtonElement>("#sort-by-menu [role=menuitemradio]")[n]!.click();
        await settle();
      }
      expect([wide(), cardOf("a.md"), more.hidden]).toEqual([isWide, box, hidden]);
    }
    expect(made.board.write).toHaveBeenCalled();
  } finally { for (const spy of spies) spy.mockRestore(); }
};

it("shows 「展开」 when a pick of grouping narrows a kept card's column and its words no longer fit", async () => {
  await regroup("time", [[-1, true, true], [0, false, false]]);
});

it("hides 「展开」 when a pick of grouping widens a kept card's column and its words fit whole", async () => {
  await regroup("kind", [[-1, false, false], [2, true, true]]);
});
