// The player: a shelf of story files, and the desk to play the chosen one on -- @z/desk's
// terminal on the player's own green-phosphor monitor (desk.ts). The desk fills the window,
// scaled to it, with the keyboard under the monitor where the pointer is a finger; MORE
// after every screenful, as the console had it. Back to the shelf by the tab on the ground
// that names the title.

import { Session, clockSeed } from "@z/desk";
import { desk } from "./desk.js";
import type { SaveStore } from "./saves.js";

export interface Title {
  id: string;
  label: string;
  /** The staged story file, relative to `stories/`. */
  file: string;
  release: number;
  serial: string;
}

export interface PlayerOptions {
  root: HTMLElement;
  titles: readonly Title[];
  /** The story file's bytes. */
  story: (title: Title) => Promise<Uint8Array>;
  saves: SaveStore;
  /** The keyboard under the monitor; absent, on where the pointer is a finger. */
  keyboard?: boolean;
  /** The keyboard's caps dark; absent, pale. */
  darkKeys?: boolean;
}

const KEYBOARD_KEY = "z-player:keyboard";
const KEYS_KEY = "z-player:keys";

function readKeysPreference(): boolean {
  try {
    return localStorage.getItem(KEYS_KEY) === "dark";
  } catch {
    return false;
  }
}

function readKeyboardPreference(): boolean {
  try {
    const stored = localStorage.getItem(KEYBOARD_KEY);
    if (stored === "on" || stored === "off") return stored === "on";
  } catch { /* fall through to the device */ }
  return typeof matchMedia === "function" && matchMedia("(any-pointer: coarse)").matches;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string | null, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== null) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Player {
  /** The title on the desk, its session, and the saved game the session hands RESTORE. */
  current: { title: Title; session: Session; saved: Uint8Array | undefined } | undefined;
  /** Titles with a saved game, for the shelf to mark. */
  private saved = new Set<string>();
  private notice: string | undefined;
  private keyboardShown: boolean;
  private keysDark: boolean;

  constructor(private readonly options: PlayerOptions) {
    this.keyboardShown = options.keyboard ?? readKeyboardPreference();
    this.keysDark = options.darkKeys ?? readKeysPreference();
  }

  get keyboard(): boolean {
    return this.keyboardShown;
  }

  set keyboard(shown: boolean) {
    this.keyboardShown = shown;
    try { localStorage.setItem(KEYBOARD_KEY, shown ? "on" : "off"); } catch { /* the choice lasts the session */ }
  }

  /** The caps dark with pale legends, for playing in the dark; the choice is kept like the keyboard's. */
  get darkKeys(): boolean {
    return this.keysDark;
  }

  set darkKeys(dark: boolean) {
    this.keysDark = dark;
    try { localStorage.setItem(KEYS_KEY, dark ? "dark" : "light"); } catch { /* the choice lasts the session */ }
  }

  /** Mark the shelf, then open the title the location names, if it names one. */
  async start(): Promise<void> {
    for (const title of this.options.titles) {
      if ((await this.options.saves.load(title.id).catch(() => undefined)) !== undefined) this.saved.add(title.id);
    }
    const wanted = typeof location === "undefined" ? "" : location.hash.slice(1);
    const title = this.options.titles.find((t) => t.id === wanted);
    if (title !== undefined) await this.open(title);
    else this.render();
  }

  /** Put a title on the desk: its bytes, its saved game, and a fresh session at the first prompt. */
  async open(title: Title): Promise<void> {
    const story = await this.options.story(title);
    const saved = await this.options.saves.load(title.id).catch(() => undefined);
    const current = { title, session: undefined as unknown as Session, saved };
    // `Machine` asks synchronously: SAVE takes what is handed here and the store is written
    // behind it; RESTORE gets the last thing SAVE took, or what the store held at opening.
    current.session = new Session(story, {
      seed: clockSeed(),
      save: (data) => {
        current.saved = data;
        this.saved.add(title.id);
        void this.options.saves.store(title.id, data).catch(() => { this.notice = "The saved game could not be kept."; this.render(); });
        return true;
      },
      restore: () => current.saved,
    });
    this.current = current;
    current.session.start();
    if (typeof history !== "undefined") history.replaceState(null, "", `#${title.id}`);
    this.render();
  }

  /** Back to the shelf. The session goes: a story left is a story to RESTORE. */
  close(): void {
    this.current = undefined;
    if (typeof history !== "undefined") history.replaceState(null, "", location.pathname + location.search);
    this.render();
  }

  render(): void {
    const root = this.options.root;
    root.textContent = "";
    root.append(this.current === undefined ? this.shelf() : this.ground(this.current));
  }

  private shelf(): HTMLElement {
    const shelf = el("div", "shelf");
    const head = el("header", "shelf-head");
    head.append(el("h1", null, "zPlayer"), el("p", null, "Interactive fiction, as shipped. Tap a title."));
    shelf.append(head);
    const list = el("ul", "titles");
    for (const title of this.options.titles) {
      const item = el("li", null);
      const card = el("button", "title-card");
      card.type = "button";
      card.append(el("span", "title-name", title.label), el("span", "title-release", `Release ${title.release} / Serial ${title.serial}`));
      if (this.saved.has(title.id)) card.append(el("span", "title-saved", "saved game"));
      card.onclick = () => { void this.open(title); };
      item.append(card);
      list.append(item);
    }
    shelf.append(list);
    return shelf;
  }

  private ground(current: NonNullable<Player["current"]>): HTMLElement {
    const ground = el("div", "ground");
    ground.append(desk(current.session, {
      keyboard: this.keyboard,
      darkKeys: this.darkKeys,
      redraw: () => this.render(),
      fail: (message) => { this.notice = message; this.render(); },
    }));
    // The way back: the title's own name, quiet on the ground's corner.
    const tab = el("button", "title-tab", current.title.label);
    tab.type = "button";
    tab.onpointerdown = (event) => event.preventDefault();
    tab.onclick = () => this.close();
    ground.append(tab);
    // The keyboard's two switches in the other corner: on or off, and while it is on, its
    // caps light or dark -- the pale caps are a lamp in a dark room.
    const tabs = el("div", "ground-tabs");
    if (this.keyboard) {
      const shade = el("button", "shade-tab", this.darkKeys ? "keys dark" : "keys light");
      shade.type = "button";
      shade.onpointerdown = (event) => event.preventDefault();
      shade.onclick = () => { this.darkKeys = !this.darkKeys; this.render(); };
      tabs.append(shade);
    }
    const keys = el("button", "keys-tab", this.keyboard ? "keyboard on" : "keyboard off");
    keys.type = "button";
    keys.onpointerdown = (event) => event.preventDefault();
    keys.onclick = () => { this.keyboard = !this.keyboard; this.render(); };
    tabs.append(keys);
    ground.append(tabs);
    if (this.notice !== undefined) {
      ground.append(el("div", "notice", this.notice));
      this.notice = undefined;
    }
    return ground;
  }
}
