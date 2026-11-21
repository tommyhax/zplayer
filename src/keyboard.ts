// The keyboard drawn under the monitor, for a tablet with none of its own.

import type { Key } from "@z/desk";

/** A keycap: what it types, its legend when that is not the character, and its width in key units. */
export interface Cap {
  key: Key;
  legend?: string;
  width?: number;
  /** Dark against the pale alphanumerics. */
  dark?: boolean;
}

const cap = (key: Key, width?: number): Cap => (width === undefined ? { key } : { key, width });
const caps = (row: string): Cap[] => [...row].map((key) => cap(key));
const RETURN: Cap = { key: "Enter", legend: "RETURN", width: 2, dark: true };
const BACKSPACE: Cap = { key: "Backspace", legend: "DELETE", width: 2, dark: true };

/**
 * Five rows on a 14-unit bed, staggered a half unit a row at both edges -- each row starts
 * half a unit in from the one above and ends half a unit short of it, so the block is a
 * shallow trapezoid: a number row over the typewriter block. The input parser folds
 * commands to lower case, so the keyboard has no Shift key. Punctuation supports
 * word separators, hyphenated and apostrophized words, slash-separated commands,
 * and special commands beginning with # or $. The number row holds - and /;
 * the qwerty row ends with double quote, #, and $; the home row holds apostrophe;
 * and the bottom letter row holds comma, period, ?, and !. Delete and Return
 * occupy two units each at the ends of the number and home rows.
 */
export const ROWS: { offset: number; caps: Cap[] }[] = [
  { offset: 0, caps: [...caps("1234567890"), cap("-"), cap("/"), BACKSPACE] },
  { offset: 0.5, caps: [...caps("qwertyuiop"), cap('"'), cap("#"), cap("$")] },
  { offset: 1, caps: [...caps("asdfghjkl"), cap("'"), RETURN] },
  { offset: 1.5, caps: [...caps("zxcvbnm"), cap(","), cap("."), cap("?"), cap("!")] },
  // The space bar runs from under X to under the full stop, as a keyboard's does; the bed
  // either side is where its modifiers would sit, and there are none to draw.
  { offset: 2.5, caps: [{ key: " ", legend: "", width: 8 }] },
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** How the caps are lit: pale or dark. */
export interface KeyboardOptions {
  dark?: boolean;
}

/**
 * The keyboard, drawn under the monitor for a tablet: the typewriter block in
 * outline, in the case's slate blue, with pale alphanumeric caps and the modifiers in
 * charcoal -- or, `dark`, every cap in charcoal with pale legends, for playing in the dark
 * where the pale caps threw more light than the glass. Each cap is a button that presses
 * through the terminal's own `press`, the same one a plugged-in keyboard reaches, so the
 * two never disagree about what a key does; the button takes no focus.
 */
export function keyboard(press: (key: Key) => void, options: KeyboardOptions = {}): HTMLElement {
  const deck = el("div", options.dark === true ? "keyboard keyboard-dark" : "keyboard");
  deck.setAttribute("role", "group");
  deck.setAttribute("aria-label", "On-screen keyboard");
  const button = (c: Cap): HTMLButtonElement => {
    const key = el("button", `key${c.dark === true ? " key-dark" : ""}`);
    key.type = "button";
    key.tabIndex = -1;
    key.style.setProperty("--w", String(c.width ?? 1));
    const legend = c.legend ?? c.key; // "" is a blank cap, as the space bar's is
    key.append(el("span", `cap${legend.length > 1 ? " word" : ""}`, legend));
    key.setAttribute("aria-label", c.key === " " ? "Space" : c.key === "Enter" ? "Return" : c.key === "Backspace" ? "Backspace" : c.key);
    key.onpointerdown = (event) => event.preventDefault();
    key.onclick = () => press(c.key);
    return key;
  };
  const block = el("div", "keys-main");
  for (const row of ROWS) {
    const line = el("div", "keys-row");
    line.style.setProperty("--offset", String(row.offset));
    for (const c of row.caps) line.append(button(c));
    block.append(line);
  }
  deck.append(block);
  return deck;
}
