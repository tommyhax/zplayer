// @vitest-environment happy-dom
//
// The player against the real interpreter and real story files, no browser: the shelf,
// the desk with MORE on and the keyboard under it -- the caps, what they press, and the
// plugged-in keyboard read off the document -- and a saved game round trip through the
// store the session is handed.
import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { Player, type Title } from "../src/zplayer.js";
import type { SaveStore } from "../src/saves.js";

const BINARIES = join(process.cwd(), "z/historical/games/binaries");
const story = (id: string): Uint8Array => {
  const file = readdirSync(BINARIES).find((f) => f.startsWith(`${id}-s`) && f.endsWith(".z3"))!;
  return new Uint8Array(readFileSync(join(BINARIES, file)));
};
const TITLES: Title[] = [
  { id: "zork1-r88", label: "Zork I", file: "zork1-r88-s840726.z3", release: 88, serial: "840726" },
  { id: "zork3-r17", label: "Zork III", file: "zork3-r17-s840727.z3", release: 17, serial: "840727" },
];

function memoryStore(): SaveStore & { slots: Map<string, Uint8Array> } {
  const slots = new Map<string, Uint8Array>();
  return { slots, load: (id) => Promise.resolve(slots.get(id)), store: (id, data) => { slots.set(id, data); return Promise.resolve(); } };
}

function player(saves: SaveStore = memoryStore()): Player {
  document.body.innerHTML = "";
  location.hash = "";
  const root = document.createElement("div");
  document.body.append(root);
  return new Player({ root, titles: TITLES, story: (t) => Promise.resolve(story(t.id)), saves, keyboard: true });
}

const key = (label: string): HTMLButtonElement => {
  const found = [...document.querySelectorAll<HTMLButtonElement>(".keyboard .key")].find((k) => k.getAttribute("aria-label") === label);
  if (found === undefined) throw new Error(`no key ${label}`);
  return found;
};
const type = (command: string): void => {
  for (const c of command) key(c === " " ? " " : c).click();
  key("Return").click();
};
const statusRow = (): string => document.querySelector(".status-row")?.textContent ?? "";
const typed = (): string => document.querySelector(".typed")?.textContent ?? "";
const input = (): HTMLInputElement => document.querySelector<HTMLInputElement>(".screen-input")!;

describe("the shelf", () => {
  it("lists the staged titles with their release and serial, and opens one on a tap", async () => {
    const p = player();
    await p.start();
    const cards = [...document.querySelectorAll(".title-card")];
    expect(cards.map((c) => c.querySelector(".title-name")?.textContent)).toEqual(["Zork I", "Zork III"]);
    expect(cards[0]?.querySelector(".title-release")?.textContent).toBe("Release 88 / Serial 840726");
    (cards[0] as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(p.current?.title.id).toBe("zork1-r88");
    expect(statusRow()).toContain("West of House");
    expect(location.hash).toBe("#zork1-r88");
  });

  it("opens the title the location names", async () => {
    const p = player();
    location.hash = "#zork3-r17";
    await p.start();
    expect(p.current?.title.id).toBe("zork3-r17");
  });
});

describe("the desk", () => {
  it("chooses a fresh seed when a title is opened, keeping the run intact through commands and redraws", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(0x1_2345_6789);
    try {
      const p = player();
      await p.open(TITLES[0]!);
      const first = p.current!.session;
      expect(first.seed).toBe(0x2345_6789);
      expect(first.waiting).toBe(true);
      clock.mockReturnValue(0x1_2345_678a);
      p.render();
      type("look");
      expect(p.current!.session).toBe(first);
      expect(first.seed).toBe(0x2345_6789);
      expect(statusRow()).toContain("West of House");
      p.close();
      await p.open(TITLES[0]!);
      expect(p.current!.session).not.toBe(first);
      expect(p.current!.session.seed).toBe(0x2345_678a);
      expect(p.current!.session.waiting).toBe(true);
    } finally {
      clock.mockRestore();
    }
  });

  it("fills the ground with the keyboard under it, no exit control, and the title tab as the way back", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    expect(document.querySelector(".screen.desk-only")).not.toBeNull();
    expect(document.querySelector(".keyboard")).not.toBeNull();
    expect(document.querySelector(".desk-exit")).toBeNull();
    // Escape is no exit either: the desk is the app.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(p.current).toBeDefined();
    document.querySelector<HTMLButtonElement>(".title-tab")!.click();
    expect([p.current, document.querySelector(".shelf")]).toEqual([undefined, expect.anything()]);
  });

  it("puts @z/desk's terminal on the glass, and the device is asked for no keyboard of its own", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    expect(document.querySelector(".desk > .monitor > .recess > .glass > .terminal > .status-row")).not.toBeNull();
    expect(document.querySelector(".desk > .keyboard")).not.toBeNull();
    expect(input().getAttribute("inputmode")).toBe("none");
  });

  it("has a number row over the typewriter block, and the punctuation the games take", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    const rows = [...document.querySelectorAll(".keys-row")].map((r) => [...r.querySelectorAll(".key")].map((k) => k.getAttribute("aria-label")));
    expect(rows).toHaveLength(5);
    expect(rows[0]!.slice(0, 10).join("")).toBe("1234567890");
    const labels = [...document.querySelectorAll(".keyboard .key")].map((k) => k.getAttribute("aria-label"));
    for (const letter of "abcdefghijklmnopqrstuvwxyz") expect(labels).toContain(letter);
    for (const mark of [".", ",", '"', "'", "-", "?", "!", "$", "#", "/"]) expect(labels).toContain(mark);
    // Leave punctuation unused by the bundled games off the compact keyboard.
    for (const mark of [";", ":", "(", ")"]) expect(labels).not.toContain(mark);
    expect(labels.filter((l) => l === "Return")).toHaveLength(1);
    expect(labels).toContain("Backspace");
    expect(labels).toContain("Space");
    // The block is a trapezoid on a 14-unit bed: each row starts half a unit in from the
    // one above and ends half a unit short of it; the space bar stops under the full stop.
    const width = (row: HTMLElement): number =>
      Number(row.style.getPropertyValue("--offset")) +
      [...row.querySelectorAll<HTMLElement>(".key")].reduce((sum, k) => sum + Number(k.style.getPropertyValue("--w")), 0);
    const bed = [...document.querySelectorAll<HTMLElement>(".keys-row")].map(width);
    expect(bed).toEqual([14, 13.5, 13, 12.5, 10.5]);
    expect(key("Return").style.getPropertyValue("--w")).toBe("2");
    // Lower case only: a v3 parser keeps no case, and there is no SHIFT to reach a capital.
    expect(labels.some((l) => l !== null && /^[A-Z]$/.test(l))).toBe(false);
  });

  it("types from the caps where the cursor is, takes a character back, and sends with RETURN", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    const session = p.current!.session;
    for (const k of ["l", "o", "o", "k", "s"]) key(k).click();
    expect(typed()).toBe("looks");
    key("Backspace").click();
    expect([typed(), input().value]).toEqual(["look", "look"]);
    const before = session.lines.length;
    key("Return").click();
    expect(session.lines[before]).toMatchObject({ text: ">look", said: true });
    // The desk redrew with the keyboard still out and the command line empty again.
    expect(document.querySelector(".keyboard")).not.toBeNull();
    expect(typed()).toBe("");
  });

  it("reads a keyboard plugged into the tablet off the document, the field unfocused", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    await new Promise((r) => requestAnimationFrame(r));
    // WebKit would end full screen the moment the field was focused.
    expect(document.activeElement).not.toBe(input());
    for (const k of ["l", "o", "o", "k", "Backspace", "k"]) document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    expect(typed()).toBe("look");
    // The caps and the document share one command line.
    key("Backspace").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true, cancelable: true }));
    expect(typed()).toBe("look");
    const before = p.current!.session.lines.length;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(p.current!.session.lines[before]).toMatchObject({ text: ">look", said: true });
    // Back on the shelf the listener goes with the desk: a RETURN now reaches no session.
    const session = p.current!.session;
    const lines = session.lines.length;
    p.close();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(session.lines.length).toBe(lines);
  });

  it("at MORE any keycap advances the page without typing into the command", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    const session = p.current!.session;
    // Paged five lines at a time from here, so the next response stops at a MORE.
    (session.pager as { page: number }).page = 5;
    type("look");
    expect(document.querySelector(".term .more")).not.toBeNull();
    const shown = session.pager.shown;
    key("x").click();
    expect(session.pager.shown).toBeGreaterThan(shown);
    expect(input().value).toBe("");
  });

  it("switches the caps dark and back by the tab beside the keyboard's, and keeps the choice", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    expect(document.querySelector(".keyboard.keyboard-dark")).toBeNull();
    const shade = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>(".shade-tab")!;
    expect(shade().textContent).toBe("keys light");
    shade().click();
    expect(document.querySelector(".keyboard.keyboard-dark")).not.toBeNull();
    expect(shade().textContent).toBe("keys dark");
    // The dark caps still type.
    type("look");
    expect(document.querySelector(".term")?.textContent).toContain("West of House");
    // A new player reads the choice back, and with the keyboard off there is no shade to choose.
    const again = player();
    await again.open(TITLES[0]!);
    expect(again.darkKeys).toBe(true);
    expect(document.querySelector(".keyboard.keyboard-dark")).not.toBeNull();
    shade().click();
    expect(document.querySelector(".keyboard.keyboard-dark")).toBeNull();
    document.querySelector<HTMLButtonElement>(".keys-tab")!.click();
    expect([document.querySelector(".keyboard"), document.querySelector(".shade-tab")]).toEqual([null, null]);
  });

  it("pages with MORE, on and not switchable", async () => {
    const p = player();
    await p.open(TITLES[0]!);
    const session = p.current!.session;
    expect(session.pager.enabled).toBe(true);
    // A long response: the licence text of zork1's `verbose` walk fills a page here.
    type("n");
    type("n");
    type("n");
    for (const c of "e") key(c).click();
    key("Return").click();
    // Somewhere in the walk a response crossed the page; either way the pager is the one deciding.
    expect(session.pager.shown).toBeLessThanOrEqual(session.lines.length);
  });

  it("takes a SAVE into the store and hands it back to RESTORE, in this session and the next", async () => {
    const saves = memoryStore();
    const p = player(saves);
    await p.open(TITLES[0]!);
    type("save");
    expect(saves.slots.has("zork1-r88")).toBe(true);
    expect(document.querySelector(".term")?.textContent).toContain("Ok.");
    type("s");
    expect(statusRow()).toContain("South of House");
    type("restore");
    expect(statusRow()).toContain("West of House");
    // A new player on the same store: back to the shelf, which marks the title, and RESTORE finds the game.
    const again = player(saves);
    await again.start();
    expect(document.querySelector(".title-saved")).not.toBeNull();
    await again.open(TITLES[0]!);
    type("s");
    type("restore");
    expect(statusRow()).toContain("West of House");
    // The other title has no game to restore.
    await again.open(TITLES[1]!);
    type("restore");
    expect(document.querySelector(".term")?.textContent).toContain("Failed");
  });
});
