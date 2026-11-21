import "@z/desk/terminal.css";
import "./desk.css";
import "./styles.css";
import { Player, type Title } from "./zplayer.js";
import { indexedDbSaves, noSaves } from "./saves.js";

const found = document.getElementById("root");
if (found === null) throw new Error("no #root");
const root: HTMLElement = found;

async function bytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const manifest = (await (await fetch("stories/manifest.json")).json()) as { titles: Title[] };
  const player = new Player({
    root,
    titles: manifest.titles,
    story: (title) => bytes(`stories/${title.file}`),
    saves: typeof indexedDB === "undefined" ? noSaves() : indexedDbSaves(),
  });
  await player.start();
}

void main().catch((error: unknown) => {
  root.textContent = error instanceof Error ? error.message : String(error);
});
