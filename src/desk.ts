// The desk: @z/desk's terminal on a green-phosphor monitor, the keyboard under it when it is
// wanted, the whole scaled to fill its ground. The terminal is the shared console; the
// furniture round it is the player's own, as is reading a plugged-in keyboard off the
// document -- the terminal's field is never focused here, since WebKit ends element full
// screen the moment a text field takes focus, and the tablet this view is for runs nothing else.

import { terminal, type Session } from "@z/desk";
import { keyboard } from "./keyboard.js";

export interface DeskOptions {
  /** The keyboard under the monitor. */
  keyboard: boolean;
  /** The keyboard's caps dark with pale legends, for a room with the lights off. */
  darkKeys: boolean;
  /** Draw the view again: after a command, and at a MORE. */
  redraw: () => void;
  /** A fault the machine raised on a command. */
  fail: (message: string) => void;
}

const el = (className: string): HTMLDivElement => {
  const node = document.createElement("div");
  node.className = className;
  return node;
};

/** The monitor, the glass, the terminal on it, and the keyboard under it, alone on their ground: one `.screen.desk-only` element. */
export function desk(session: Session, options: DeskOptions): HTMLElement {
  const wrap = el("screen desk-only");
  const console = terminal(session, {
    redraw: options.redraw,
    fail: options.fail,
    drawnKeyboard: options.keyboard,
    takeFocus: false,
  });
  // The monitor: the painted case, the black plastic recess in it, and the glass in that.
  const monitor = el("monitor");
  const recess = el("recess");
  const glass = el("glass");
  glass.append(console.element);
  recess.append(glass);
  monitor.append(recess);
  // The desk: the monitor, and under it the keyboard when it is wanted, as wide as the
  // monitor's case. The caps press the terminal's own `press`, as the document's keys do.
  const desk = el("desk");
  desk.append(monitor);
  if (options.keyboard) desk.append(keyboard(console.press, { dark: options.darkKeys }));
  wrap.append(desk);

  // A keyboard plugged into the tablet is read from the document, key by key, through the
  // same `press` the caps use. Escape is no exit: the desk is the app. A desk torn down --
  // back on the shelf -- lets go of the document at the first key it would have taken.
  listenToDocument((event) => {
    if (!wrap.isConnected) { listenToDocument(undefined); return; }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "Enter" || event.key === "Backspace") console.press(event.key);
    else if (event.key.length === 1) console.press(event.key);
    else return;
    event.preventDefault();
  });
  // The ground takes focus instead of the field, a plain block and no text field, so the
  // keys have a target in the page whichever way the browser delivers them.
  wrap.tabIndex = -1;
  const focusGround = (): void => wrap.focus({ preventScroll: true });
  wrap.onclick = focusGround;
  requestAnimationFrame(focusGround);
  fitDesk(desk, wrap);
  return wrap;
}

/** The document's key listener: one at a time, the last redraw's. */
let documentKeys: ((event: KeyboardEvent) => void) | undefined;
function listenToDocument(handler: ((event: KeyboardEvent) => void) | undefined): void {
  if (documentKeys !== undefined) document.removeEventListener("keydown", documentKeys);
  documentKeys = handler;
  if (handler !== undefined) document.addEventListener("keydown", handler);
}

/**
 * The desk is scaled to the window rather than reflowed: the glass is 80 columns at a
 * fixed pitch and the keyboard a fixed number of units under it, so the desk has one shape,
 * and the question is only how large. Whichever of the window's sides binds sets the scale,
 * on each resize and turn of the tablet, until the view is torn down.
 */
function fitDesk(desk: HTMLElement, ground: HTMLElement): void {
  const fit = (): void => {
    const width = ground.clientWidth;
    const height = ground.clientHeight;
    // Layout size, not the rendered box: `offsetWidth` ignores the transform.
    const scale = Math.min(width / desk.offsetWidth, height / desk.offsetHeight);
    if (Number.isFinite(scale) && scale > 0) desk.style.setProperty("--desk-scale", scale.toFixed(4));
  };
  if (typeof ResizeObserver === "undefined") { requestAnimationFrame(fit); return; }
  const observer = new ResizeObserver(() => {
    if (!ground.isConnected) { observer.disconnect(); return; }
    fit();
  });
  observer.observe(ground);
}
